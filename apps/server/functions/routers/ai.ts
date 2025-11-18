import { Hono } from 'hono'
import type { Variables } from '../middleware/external-tokens'
import type { AuthVariables } from '../middleware/auth'
import { authMiddleware } from '../middleware/auth'
import { createErrorResponse, createSuccessResponse } from '@/utils/response'
import type { DataBaseEnvBindings } from '@/utils/db'
import { createSupabaseAdminClient } from '@/utils/db'
import {
  createPublicUrl,
  createR2Client,
  createR2ObjectKey,
  resolveR2Config,
  uploadR2Object,
} from '@/utils/r2'
import type { R2EnvBindings, R2ResolvedConfig } from '@/utils/r2'

type AiEnvBindings = DataBaseEnvBindings & R2EnvBindings
interface R2Resources {
  client: ReturnType<typeof createR2Client>
  config: R2ResolvedConfig
}

type AiVariables = Variables & AuthVariables & {
  r2Client?: R2Resources['client']
  r2Config?: R2Resources['config']
}

const ai = new Hono<{
  Bindings: AiEnvBindings
  Variables: AiVariables
}>()

let cachedR2Client: ReturnType<typeof createR2Client> | null = null
let cachedR2Config: R2ResolvedConfig | null = null
let cachedR2Signature: string | null = null
let r2BootstrapFailed = false

const AI_SNAPSHOT_PREFIX = 'ai-tasks'
const TASK_SNAPSHOT_KV_PREFIX = 'ai-task'

type SnapshotVariant = 'input' | 'output' | 'combined'

interface SnapshotPayload {
  userId: string
  taskId: string
  variant: SnapshotVariant
  content: string
}

interface TaskSnapshotKV {
  userId: string
  taskId: string
  service: string
  platform?: TaskPlatform
  type?: TaskType
  username?: string
  inputText?: string
  resultText?: string
  createdAt?: string
  completedAt?: string
}

function ensureR2Resources(env: AiEnvBindings) {
  const resolved = resolveR2Config(env)
  const signature = JSON.stringify(resolved)

  if (!cachedR2Client || !cachedR2Config || cachedR2Signature !== signature) {
    cachedR2Client = createR2Client(resolved)
    cachedR2Config = resolved
    cachedR2Signature = signature
  }

  if (!cachedR2Client || !cachedR2Config) {
    throw new Error('[ai][r2] Failed to initialize client')
  }

  return { client: cachedR2Client, config: cachedR2Config }
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^\w-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown'
}

async function uploadTaskSnapshot(resources: R2Resources, payload: SnapshotPayload): Promise<string> {
  const prefixSegments = [AI_SNAPSHOT_PREFIX, sanitizePathSegment(payload.userId), sanitizePathSegment(payload.taskId)]
    .filter(Boolean)
    .join('/')

  const key = createR2ObjectKey(`${payload.variant}.txt`, { prefix: prefixSegments })

  const { key: storedKey } = await uploadR2Object(resources.client, {
    bucket: resources.config.bucket,
    key,
    body: payload.content,
    contentType: 'text/plain; charset=utf-8',
    metadata: {
      task_id: payload.taskId,
      variant: payload.variant,
    },
  })

  return createPublicUrl(resources.config, storedKey) ?? storedKey
}

async function tryUploadTaskSnapshot(resources: R2Resources, payload: SnapshotPayload): Promise<string | null> {
  try {
    return await uploadTaskSnapshot(resources, payload)
  }
  catch (error) {
    console.error(`[ai][r2] 上传${payload.variant}文本失败:`, error)
    return null
  }
}

function createTaskSnapshotKey(userId: string, taskId: string): string {
  return `${TASK_SNAPSHOT_KV_PREFIX}:${sanitizePathSegment(userId)}:${sanitizePathSegment(taskId)}`
}

async function readTaskSnapshotFromKV(userId: string, taskId: string): Promise<TaskSnapshotKV | null> {
  try {
    const stored = await paper_rewriting_kv.get(createTaskSnapshotKey(userId, taskId))

    if (!stored || typeof stored !== 'string')
      return null

    return JSON.parse(stored) as TaskSnapshotKV
  }
  catch (error) {
    console.error('[ai][kv] 读取任务快照失败:', error)
    return null
  }
}

async function saveTaskSnapshotToKV(snapshot: TaskSnapshotKV): Promise<void> {
  try {
    await paper_rewriting_kv.put(createTaskSnapshotKey(snapshot.userId, snapshot.taskId), JSON.stringify(snapshot))
  }
  catch (error) {
    console.error('[ai][kv] 保存任务快照失败:', error)
  }
}

async function writeTaskSnapshotResult(userId: string, taskId: string, resultText: string): Promise<TaskSnapshotKV | null> {
  try {
    const existing = await readTaskSnapshotFromKV(userId, taskId)
    const payload: TaskSnapshotKV = {
      userId,
      taskId,
      service: existing?.service ?? 'unknown',
      platform: existing?.platform,
      type: existing?.type,
      username: existing?.username,
      inputText: existing?.inputText,
      createdAt: existing?.createdAt,
      resultText,
      completedAt: new Date().toISOString(),
    }

    await paper_rewriting_kv.put(createTaskSnapshotKey(userId, taskId), JSON.stringify(payload))
    return payload
  }
  catch (error) {
    console.error('[ai][kv] 写入任务结果失败:', error)
    return null
  }
}

async function deleteTaskSnapshotFromKV(userId: string, taskId: string): Promise<void> {
  try {
    await paper_rewriting_kv.delete(createTaskSnapshotKey(userId, taskId))
  }
  catch (error) {
    console.error('[ai][kv] 删除任务快照失败:', error)
  }
}

interface CombinedSnapshotDetails {
  taskId: string
  userId: string
  username?: string
  service?: string
  platform?: TaskPlatform
  type?: TaskType
  createdAt?: string
  completedAt?: string
  inputText?: string
  resultText: string
}

function buildCombinedSnapshotDocument(details: CombinedSnapshotDetails): string {
  // const header = [
  //   `Task ID: ${details.taskId}`,
  //   `User ID: ${details.userId}`,
  //   `Username: ${details.username ?? 'unknown'}`,
  //   `Service: ${details.service ?? 'unknown'}`,
  //   `Platform: ${details.platform ?? 'unknown'}`,
  //   `Type: ${details.type ?? 'unknown'}`,
  //   `Created At: ${details.createdAt ?? 'unknown'}`,
  //   `Completed At: ${details.completedAt ?? new Date().toISOString()}`,
  // ]

  const userInput = details.inputText && details.inputText.trim().length > 0 ? details.inputText : '(empty)'
  const aiOutput = details.resultText && details.resultText.trim().length > 0 ? details.resultText : '(empty)'

  return [
    // ...header,
    '---------------------输入原文--------------------',
    '',
    userInput,
    '',
    '---------------------AI改写结果--------------------',
    '',
    aiOutput,
  ].join('\n')
}

type TransactionFileUpdate = Partial<{
  user_input_file_url: string
  ai_response_file_url: string
}>

function buildTransactionFileUpdate(update: TransactionFileUpdate): Record<string, string> {
  const payload: Record<string, string> = {}

  if (typeof update.user_input_file_url === 'string' && update.user_input_file_url.length > 0)
    payload.user_input_file_url = update.user_input_file_url

  if (typeof update.ai_response_file_url === 'string' && update.ai_response_file_url.length > 0)
    payload.ai_response_file_url = update.ai_response_file_url

  return payload
}

async function updateTransactionFilesById(env: DataBaseEnvBindings, transactionId: number | string, update: TransactionFileUpdate): Promise<boolean> {
  const payload = buildTransactionFileUpdate(update)

  if (Object.keys(payload).length === 0)
    return false

  const supabase = createSupabaseAdminClient(env)

  // Ensure we compare using a numeric id when possible
  const idToMatch = typeof transactionId === 'number' ? transactionId : Number(transactionId)

  try {
    const { data, error } = await supabase
      .from('points_transactions')
      .update(payload)
      .eq('id', idToMatch)

    if (error) {
      console.error('[updateTransactionFilesById] 更新积分交易文件字段失败:', error)
      return false
    }

    // Log success for debugging (can be removed later)
    console.log('[updateTransactionFilesById] 更新成功, id=', idToMatch, 'payload=', payload, 'rows=', JSON.stringify(data))
    return true
  }
  catch (err) {
    console.error('[updateTransactionFilesById] 异常:', err)
    return false
  }
}

async function updateTransactionFilesByReference(env: DataBaseEnvBindings, userId: string, taskId: string, update: TransactionFileUpdate): Promise<void> {
  const payload = buildTransactionFileUpdate(update)

  if (Object.keys(payload).length === 0)
    return

  const supabase = createSupabaseAdminClient(env)
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (profileError || !profileData) {
    console.error('[updateTransactionFilesByReference] 获取用户档案失败:', profileError)
    return
  }

  const { error } = await supabase
    .from('points_transactions')
    .update(payload)
    .eq('profile_id', profileData.id)
    .eq('reference_id', taskId)
    .eq('transaction_type', 'spend')

  if (error) {
    console.error('[updateTransactionFilesByReference] 更新积分交易文件字段失败:', error)
  }
}

function bootstrapR2(env: AiEnvBindings) {
  if (r2BootstrapFailed)
    return null

  try {
    return ensureR2Resources(env)
  }
  catch (error) {
    r2BootstrapFailed = true
    console.error('[ai][r2] 初始化 R2 客户端失败:', error)
    return null
  }
}

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
async function deductUserPoints(env: DataBaseEnvBindings, userId: string, points: number, taskId: string, service: string, taskLabel: string): Promise<{ success: boolean, newBalance?: number, transactionId?: number }> {
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
  const { data: transactionRow, error: transactionError } = await supabase
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
    .select('id')
    .single()

  if (transactionError) {
    console.error(`[deductUserPoints][${service}] 记录积分交易失败:`, transactionError)
    // 交易记录失败不影响积分扣除操作
  }

  // Normalize transaction id to number when possible
  const returnedId = transactionRow?.id
  const numericId = typeof returnedId === 'number' ? returnedId : (returnedId ? Number(returnedId) : undefined)

  return { success: true, newBalance, transactionId: numericId }
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

ai.use('*', async (c, next) => {
  const r2Resources = bootstrapR2(c.env)

  if (r2Resources) {
    c.set('r2Client', r2Resources.client)
    c.set('r2Config', r2Resources.config)
  }

  await next()
})

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
    const r2Client = c.get('r2Client')
    const r2Config = c.get('r2Config')
    const r2Resources: R2Resources | null = r2Client && r2Config ? { client: r2Client, config: r2Config } : null

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

    await saveTaskSnapshotToKV({
      userId,
      username,
      taskId: result.taskId,
      service,
      platform: taskPlatform,
      type: taskType,
      inputText: text,
      createdAt: new Date().toISOString(),
    })

    // 只有在AI服务成功返回结果后才扣除用户积分
    const deductResult = await deductUserPoints(c.env, userId, taskCost, result.taskId, service, taskLabel)
    if (!deductResult.success) {
      console.error('[ai-reduce-task] 扣除积分失败，但任务已提交成功')
      // 扣除积分失败不应该影响用户的任务结果，记录日志即可
      // 但是需要在任务结果查询时标记为失败
    }
    else if (r2Resources) {
      const inputUrl = await tryUploadTaskSnapshot(r2Resources, {
        userId,
        taskId: result.taskId,
        variant: 'input',
        content: text,
      })

      if (inputUrl) {
        let updated = false

        if (deductResult.transactionId) {
          updated = await updateTransactionFilesById(c.env, deductResult.transactionId, {
            user_input_file_url: inputUrl,
          })
        }

        if (!updated) {
          await updateTransactionFilesByReference(c.env, userId, result.taskId, {
            user_input_file_url: inputUrl,
          })
        }
      }
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
    const r2Client = c.get('r2Client')
    const r2Config = c.get('r2Config')
    const r2Resources: R2Resources | null = r2Client && r2Config ? { client: r2Client, config: r2Config } : null

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

      if (status === 'completed' && data.resulttext) {
        const snapshot = await writeTaskSnapshotResult(userId, taskId, data.resulttext)

        if (r2Resources) {
          const combinedDocument = buildCombinedSnapshotDocument({
            taskId,
            userId,
            username,
            service: snapshot?.service ?? service,
            platform: snapshot?.platform,
            type: snapshot?.type,
            createdAt: snapshot?.createdAt,
            completedAt: snapshot?.completedAt,
            inputText: snapshot?.inputText,
            resultText: snapshot?.resultText ?? data.resulttext,
          })

          const outputUrl = await tryUploadTaskSnapshot(r2Resources, {
            userId,
            taskId,
            variant: 'combined',
            content: combinedDocument,
          })

          if (outputUrl) {
            await updateTransactionFilesByReference(c.env, userId, taskId, {
              ai_response_file_url: outputUrl,
            })
            await deleteTaskSnapshotFromKV(userId, taskId)
          }
        }
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
        const snapshot = await writeTaskSnapshotResult(userId, taskId, result.result)

        if (r2Resources) {
          const combinedDocument = buildCombinedSnapshotDocument({
            taskId,
            userId,
            username,
            service: snapshot?.service ?? service,
            platform: snapshot?.platform,
            type: snapshot?.type,
            createdAt: snapshot?.createdAt,
            completedAt: snapshot?.completedAt,
            inputText: snapshot?.inputText,
            resultText: snapshot?.resultText ?? result.result,
          })

          const outputUrl = await tryUploadTaskSnapshot(r2Resources, {
            userId,
            taskId,
            variant: 'combined',
            content: combinedDocument,
          })

          if (outputUrl) {
            await updateTransactionFilesByReference(c.env, userId, taskId, {
              ai_response_file_url: outputUrl,
            })
            await deleteTaskSnapshotFromKV(userId, taskId)
          }
        }

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
