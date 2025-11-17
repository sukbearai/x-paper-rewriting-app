import { Hono } from 'hono'
import type { Variables } from '../middleware/external-tokens'
import type { AuthVariables } from '../middleware/auth'
import { authMiddleware } from '../middleware/auth'
import { createErrorResponse, createSuccessResponse } from '@/utils/response'
import type { DataBaseEnvBindings } from '@/utils/db'
import { createSupabaseAdminClient } from '@/utils/db'

const ai = new Hono<{
  Bindings: DataBaseEnvBindings
  Variables: Variables & AuthVariables
}>()

// 任务消耗积分配置
const POINTS_PER_1000_CHARS = 3 // 每1000字消耗3积分

type TaskPlatform = 'zhiwang' | 'weipu'
type TaskType = 'reduce-plagiarism' | 'reduce-ai-rate'

function resolveTaskLabel(platform: TaskPlatform, type: TaskType): string {
  if (type === 'reduce-ai-rate')
    return platform === 'zhiwang' ? '降AI率（知网版）' : '降AI率（维普版）'

  return platform === 'zhiwang' ? '降重（知网版）' : '降重（维普版）'
}

/**
 * 计算任务积分消耗
 */
function calculateTaskCost(textLength: number): number {
  // 每1000字消耗3积分，按实际字数比例计算，保留3位小数不四舍五入
  const cost = (textLength / 1000) * POINTS_PER_1000_CHARS
  return Math.trunc(cost * 1000) / 1000 // 保留3位小数，截取而不四舍五入
}

/**
 * 查询用户积分余额
 */
async function getUserPoints(env: DataBaseEnvBindings, userId: string): Promise<number> {
  const supabase = createSupabaseAdminClient(env)
  const { data, error } = await supabase
    .from('profiles')
    .select('points_balance')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    console.error('[getUserPoints] 查询用户积分失败:', error)
    return 0
  }

  return data.points_balance || 0
}

/**
 * 扣除用户积分并记录交易
 */
async function deductUserPoints(env: DataBaseEnvBindings, userId: string, points: number, taskId: string, service: string, taskLabel: string): Promise<{ success: boolean, newBalance?: number }> {
  const supabase = createSupabaseAdminClient(env)

  // 先查询当前积分
  const currentPoints = await getUserPoints(env, userId)
  if (currentPoints < points) {
    return { success: false }
  }

  // 获取profile_id
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (profileError || !profileData) {
    console.error(`[deductUserPoints][${service}] 获取用户档案失败:`, profileError)
    return { success: false }
  }

  // 扣除积分
  const newBalance = Math.trunc((currentPoints - points) * 1000) / 1000 // 保留3位小数，截取而不四舍五入
  const { error } = await supabase
    .from('profiles')
    .update({
      points_balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) {
    console.error(`[deductUserPoints][${service}] 扣除积分失败:`, error)
    return { success: false }
  }

  // 记录积分交易明细
  const { error: transactionError } = await supabase
    .from('points_transactions')
    .insert({
      profile_id: profileData.id,
      transaction_type: 'spend',
      amount: -points,
      balance_after: newBalance,
      description: taskLabel,
      reference_id: taskId,
      is_successful: true, // 初始标记为成功，如果后续任务失败会更新
    })

  if (transactionError) {
    console.error(`[deductUserPoints][${service}] 记录积分交易失败:`, transactionError)
    // 交易记录失败不影响积分扣除操作
  }

  return { success: true, newBalance }
}

/**
 * 更新任务状态为失败
 */
async function markTaskAsFailed(env: DataBaseEnvBindings, userId: string, taskId: string, service: string): Promise<void> {
  const supabase = createSupabaseAdminClient(env)

  // 获取profile_id
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (profileError || !profileData) {
    console.error(`[markTaskAsFailed][${service}] 获取用户档案失败:`, profileError)
    return
  }

  // 更新交易记录为失败
  const { error: updateError } = await supabase
    .from('points_transactions')
    .update({
      is_successful: false,
    })
    .eq('profile_id', profileData.id)
    .eq('reference_id', taskId)
    .eq('transaction_type', 'spend')

  if (updateError) {
    console.error(`[markTaskAsFailed][${service}] 更新交易记录失败:`, updateError)
  }
}

// 应用认证中间件到所有路由
ai.use('*', authMiddleware)

/**
 * POST /ai/reduce-task
 *
 * 提交降重或降AI率任务
 *
 * 请求体：
 * {
 *   "text": "待处理的文本内容（最多3000字）",
 *   "platform": "zhiwang" | "weipu",
 *   "type": "reduce-plagiarism" | "reduce-ai-rate"
 * }
 *
 * 成功响应：
 * {
 *   "code": 0,
 *   "message": "任务提交成功",
 *   "data": {
 *     "taskId": "任务ID",
 *     "service": "reduceai" | "cheeyuan",
 *     "newBalance": 462,
 *     "cost": 3.5
 *   },
 *   "timestamp": "2025-01-01T00:00:00.000Z"
 * }
 *
 * 注意：积分会在任务成功提交到AI服务后扣除，并在积分交易记录中标记。
 * 如果AI服务返回错误，任务会被标记为失败，积分交易记录也会相应更新。
 */
ai.post('/reduce-task', async (c) => {
  try {
    // 获取当前用户信息（从认证中间件设置）
    const userId = c.get('userId')
    const username = c.get('username')

    console.log(`[ai-reduce-task] 用户 ${username}(${userId}) 提交降重/降AI率任务`)

    const { text, platform, type } = await c.req.json<{
      text?: string
      platform?: string
      type?: string
    }>()

    // 参数验证
    if (!text || typeof text !== 'string') {
      return c.json(createErrorResponse('缺少文本内容参数', 400), 400)
    }

    if (text.length > 3000) {
      return c.json(createErrorResponse('文本内容不能超过3000字', 400), 400)
    }

    if (!platform || !['zhiwang', 'weipu'].includes(platform)) {
      return c.json(createErrorResponse('平台参数错误，必须为zhiwang或weipu', 400), 400)
    }

    if (!type || !['reduce-plagiarism', 'reduce-ai-rate'].includes(type)) {
      return c.json(createErrorResponse('类型参数错误，必须为reduce-plagiarism或reduce-ai-rate', 400), 400)
    }

    const taskPlatform = platform as TaskPlatform
    const taskType = type as TaskType
    const taskLabel = resolveTaskLabel(taskPlatform, taskType)

    // 检查用户积分余额
    const userPoints = await getUserPoints(c.env, userId)
    const taskCost = calculateTaskCost(text.length)
    console.log(`[ai-reduce-task] 用户当前积分: ${userPoints}, 文本字数: ${text.length}, 需要积分: ${taskCost}`)

    if (userPoints < taskCost) {
      return c.json(createErrorResponse(`积分不足，当前积分：${userPoints}，需要积分：${taskCost}`, 400), 400)
    }

    // 根据平台和类型选择服务
    const service = taskPlatform === 'zhiwang' && taskType === 'reduce-ai-rate' ? 'cheeyuan' : 'reduceai'

    let result: any

    if (service === 'cheeyuan') {
      // CHEEYUAN处理知网降AI率
      const response = await fetch(`${c.env.CHEEYUAN_API_URL}/tools/freechangeword/async`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${(c.var as Variables).cheeyuanToken}`,
        },
        body: JSON.stringify({
          content: text,
          product_type: 78, // 知网降AI率固定值
        }),
      })

      if (!response.ok) {
        console.error('CHEEYUAN任务提交失败:', response.status, response.statusText)
        // AI服务请求失败，标记任务为失败
        await markTaskAsFailed(c.env, userId, 'cheeyuan-request-failed', 'cheeyuan')
        return c.json(createErrorResponse('CHEEYUAN任务提交失败', 500), 500)
      }

      const cheeyuanResult = await response.json() as {
        code?: number
        message?: string
        data?: number
      }

      if (cheeyuanResult.code !== 1 || !cheeyuanResult.data) {
        // AI服务返回错误，标记任务为失败
        await markTaskAsFailed(c.env, userId, 'cheeyuan-no-data', 'cheeyuan')
        return c.json(createErrorResponse(cheeyuanResult.message || 'CHEEYUAN任务提交失败', 500), 500)
      }

      result = {
        taskId: cheeyuanResult?.data?.toString(),
        service: 'cheeyuan',
      }
    }
    else {
      // REDUCEAI处理知网/维普降重和维普降AI率
      let toolName: string

      if (taskType === 'reduce-ai-rate') {
        toolName = 'onlyai' // 仅降AI
      }
      else {
        toolName = 'onlyjc' // 仅降重
      }

      const response = await fetch(`${c.env.REDUCEAI_API_URL}/ai/reduce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${(c.var as Variables).reduceAiToken}`,
        },
        body: JSON.stringify({
          text,
          toolName,
        }),
      })

      if (!response.ok) {
        console.error('REDUCEAI任务提交失败:', response.status, response.statusText)
        // AI服务请求失败，标记任务为失败
        await markTaskAsFailed(c.env, userId, 'reduceai-request-failed', 'reduceai')
        return c.json(createErrorResponse('REDUCEAI任务提交失败', 500), 500)
      }

      const reduceAiResult = await response.json() as {
        taskId?: string
        newBalance?: number
      }

      if (!reduceAiResult.taskId) {
        // AI服务返回错误，标记任务为失败
        await markTaskAsFailed(c.env, userId, 'reduceai-no-task-id', 'reduceai')
        return c.json(createErrorResponse('任务提交失败，未获取到任务ID', 500), 500)
      }

      result = {
        taskId: reduceAiResult.taskId,
        service: 'reduceai',
        ...(reduceAiResult.newBalance && { newBalance: reduceAiResult.newBalance }),
      }
    }

    // 只有在AI服务成功返回结果后才扣除用户积分
    const deductResult = await deductUserPoints(c.env, userId, taskCost, result.taskId, service, taskLabel)
    if (!deductResult.success) {
      console.error('[ai-reduce-task] 扣除积分失败，但任务已提交成功')
      // 扣除积分失败不应该影响用户的任务结果，记录日志即可
      // 但是需要在任务结果查询时标记为失败
    }

    return c.json(createSuccessResponse({
      ...result,
      newBalance: deductResult.newBalance || await getUserPoints(c.env, userId),
      cost: taskCost,
    }, '任务提交成功'))
  }
  catch (err) {
    console.error('任务提交异常:', err)
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(message, 500), 500)
  }
})

/**
 * POST /ai/result
 *
 * 查询任务结果
 *
 * 请求体：
 * {
 *   "taskId": "任务ID",
 *   "service": "reduceai" | "cheeyuan"
 * }
 *
 * 成功响应：
 * {
 *   "code": 0,
 *   "message": "查询成功",
 *   "data": {
 *     "status": "completed" | "processing" | "failed",
 *     "progress": 100,
 *     "result": "处理后的文本内容",
 *     "cost": 5,
 *     "queuePosition": 5,
 *     "created_at": "2025-01-01T00:00:00.000Z",
 *     "updated_at": "2025-01-01T00:00:00.000Z"
 *   },
 *   "timestamp": "2025-01-01T00:00:00.000Z"
 * }
 *
 * 注意：如果任务状态为"failed"，对应的积分交易记录会被标记为失败(is_successful=false)
 */
ai.post('/result', async (c) => {
  try {
    // 获取当前用户信息（从认证中间件设置）
    const userId = c.get('userId')
    const username = c.get('username')

    console.log(`[ai-result] 用户 ${username}(${userId}) 查询AI处理结果`)

    const { taskId, service } = await c.req.json<{
      taskId?: string
      service?: string
    }>()

    // 参数验证
    if (!taskId || typeof taskId !== 'string') {
      return c.json(createErrorResponse('缺少任务ID参数', 400), 400)
    }

    if (!service || !['reduceai', 'cheeyuan'].includes(service)) {
      return c.json(createErrorResponse('服务参数错误，必须为reduceai或cheeyuan', 400), 400)
    }

    if (service === 'cheeyuan') {
      // CHEEYUAN查询结果
      const response = await fetch(`${c.env.CHEEYUAN_API_URL}/tools/common/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${(c.var as Variables).cheeyuanToken}`,
        },
        body: JSON.stringify({
          id: Number.parseInt(taskId),
        }),
      })

      if (!response.ok) {
        console.error('CHEEYUAN结果查询失败:', response.status, response.statusText)
        return c.json(createErrorResponse('CHEEYUAN结果查询失败', 500), 500)
      }

      const result = await response.json() as {
        code?: number
        message?: string
        data?: {
          id?: number
          resulttext?: string
          created_at?: string
          updated_at?: string
          deal_status?: number
          [key: string]: any
        }
      }

      if (result.code !== 1) {
        return c.json(createErrorResponse(result.message || 'CHEEYUAN结果查询失败', 500), 500)
      }

      const data = result.data
      if (!data) {
        return c.json(createErrorResponse('查询结果数据异常', 500), 500)
      }

      // 判断处理状态
      const status: 'completed' | 'processing' | 'failed'
        = data.deal_status === 1 && data.resulttext
          ? 'completed'
          : data.deal_status === 2 ? 'failed' : 'processing'

      // 如果任务失败，更新交易记录
      if (status === 'failed') {
        await markTaskAsFailed(c.env, userId, taskId, 'cheeyuan')
      }

      return c.json(createSuccessResponse({
        status,
        progress: status === 'completed' ? 100 : (status === 'failed' ? 0 : 0),
        result: status === 'completed' ? data.resulttext : null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      }, '查询成功'))
    }
    else {
      // REDUCEAI查询结果
      const response = await fetch(`${c.env.REDUCEAI_API_URL}/result/${taskId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${(c.var as Variables).reduceAiToken}`,
        },
      })

      if (!response.ok) {
        console.error('REDUCEAI结果查询失败:', response.status, response.statusText)
        // return c.json(createErrorResponse('REDUCEAI结果查询失败', 500), 500)
        return c.json(createSuccessResponse({
          status: 'processing',
          progress: 0,
          result: null,
        }, '查询成功'))
      }

      const result = await response.json() as {
        status?: string
        progress?: number
        result?: string
        queuePosition?: number
        cost?: number
        [key: string]: any
      }

      // 如果任务失败，更新交易记录
      if (result.status === 'failed') {
        await markTaskAsFailed(c.env, userId, taskId, 'reduceai')
      }

      // 处理可能的直接结果格式
      if (result.result && typeof result.result === 'string') {
        return c.json(createSuccessResponse({
          status: 'completed',
          progress: 100,
          result: result.result,
        }, '查询成功'))
      }

      return c.json(createSuccessResponse({
        status: result.status || 'processing',
        progress: result.progress || 0,
        result: result.result || null,
        queuePosition: result.queuePosition,
        cost: result.cost,
      }, '查询成功'))
    }
  }
  catch (err) {
    console.error('结果查询异常:', err)
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(message, 500), 500)
  }
})

/**
 * POST /ai/points
 *
 * 查询用户积分余额
 *
 * 请求头：
 * ```
 * Authorization: Bearer <access_token>
 * ```
 *
 * 成功响应：
 * {
 *   "code": 0,
 *   "message": "查询成功",
 *   "data": {
 *     "points_balance": 450,
 *     "task_cost": 10,
 *     "cost_per_1000_chars": 3
 *   },
 *   "timestamp": "2025-01-01T00:00:00.000Z"
 * }
 *
 * 说明：task_cost 和 cost_per_1000_chars 表示每1000字消耗的积分数（当前为3积分）
 */
ai.post('/points', async (c) => {
  try {
    // 获取当前用户信息（从认证中间件设置）
    const userId = c.get('userId')
    const username = c.get('username')

    console.log(`[ai-points] 用户 ${username}(${userId}) 查询积分余额`)

    // 查询用户积分余额
    const pointsBalance = await getUserPoints(c.env, userId)

    return c.json(createSuccessResponse({
      points_balance: pointsBalance,
      task_cost: POINTS_PER_1000_CHARS,
      cost_per_1000_chars: POINTS_PER_1000_CHARS,
    }, '查询成功'))
  }
  catch (err) {
    console.error('积分查询异常:', err)
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(message, 500), 500)
  }
})

export default ai
