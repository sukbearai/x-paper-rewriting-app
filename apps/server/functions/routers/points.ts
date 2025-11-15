import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import type { AuthVariables } from '../middleware/auth'
import { createErrorResponse, createSuccessResponse } from '@/utils/response'
import type { DataBaseEnvBindings } from '@/utils/db'
import { createSupabaseAdminClient, createSupabaseClient } from '@/utils/db'

interface PointsTransactionsQueryParams {
  page?: number
  limit?: number
  transaction_type?: string
}

const points = new Hono<{ Bindings: DataBaseEnvBindings } & { Variables: AuthVariables }>()

// 查询积分交易记录的参数验证
const pointsTransactionsSchema = z.object({
  page: z.coerce.number().int().min(1, '页码必须大于0').default(1),
  limit: z.coerce.number().int().min(1, '每页数量必须大于0').max(100, '每页数量不能超过100').default(20),
  transaction_type: z.enum(['recharge', 'spend', 'transfer']).optional(),
})

const refundRequestSchema = z.object({
  transaction_id: z.number().int('交易ID必须为整数').positive('交易ID必须大于0'),
})

// 查询积分余额
points.get('/balance', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const username = c.get('username')
    const accessToken = c.get('accessToken')

    console.log(`[points:balance] 用户 ${username}(${userId}) 查询积分余额`)

    if (!accessToken) {
      console.error('[points:balance] 缺少访问令牌')
      return c.json(createErrorResponse('认证信息缺失，请重新登录', 401), 401)
    }

    const supabase = createSupabaseClient(c.env, accessToken)

    // 查询用户积分余额
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('points_balance')
      .eq('user_id', userId)
      .single()

    if (profileError || !profile) {
      return c.json(createErrorResponse('用户信息不存在', 404), 404)
    }

    return c.json(createSuccessResponse({
      points_balance: profile.points_balance,
    }, '查询积分余额成功'))
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

// 查询积分交易记录
points.get('/transactions', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const username = c.get('username')
    const accessToken = c.get('accessToken')

    console.log(`[points:transactions] 用户 ${username}(${userId}) 查询积分交易记录`)

    if (!accessToken) {
      console.error('[points:transactions] 缺少访问令牌')
      return c.json(createErrorResponse('认证信息缺失，请重新登录', 401), 401)
    }

    // 解析查询参数
    const queryParams: PointsTransactionsQueryParams = {}

    // 处理page参数
    const pageParam = c.req.query('page')
    if (pageParam) {
      queryParams.page = Number.parseInt(pageParam, 10)
    }

    // 处理limit参数
    const limitParam = c.req.query('limit')
    if (limitParam) {
      queryParams.limit = Number.parseInt(limitParam, 10)
    }

    // 处理transaction_type参数
    const transactionTypeParam = c.req.query('transaction_type')
    if (transactionTypeParam) {
      queryParams.transaction_type = transactionTypeParam
    }

    // 验证参数
    const parsed = pointsTransactionsSchema.safeParse(queryParams)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return c.json(createErrorResponse(issue?.message || '参数校验失败', 400), 400)
    }

    const { page, limit, transaction_type } = parsed.data
    const supabase = createSupabaseClient(c.env, accessToken)

    // 首先获取用户的profile_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (profileError || !profile) {
      return c.json(createErrorResponse('用户信息不存在', 404), 404)
    }

    // 构建查询
    let query = supabase
      .from('points_transactions')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false })

    // 添加交易类型过滤
    if (transaction_type) {
      query = query.eq('transaction_type', transaction_type)
    }

    // 获取总数
    let countQuery = supabase
      .from('points_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profile.id)

    if (transaction_type) {
      countQuery = countQuery.eq('transaction_type', transaction_type)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('[points:transactions] 查询总数失败:', countError)
      return c.json(createErrorResponse('查询交易记录总数失败', 500), 500)
    }

    // 分页查询
    const offset = (page - 1) * limit
    const { data: transactions, error: transactionsError } = await query
      .range(offset, offset + limit - 1)

    if (transactionsError) {
      console.error('[points:transactions] 查询交易记录失败:', transactionsError)
      return c.json(createErrorResponse('查询交易记录失败', 500), 500)
    }

    // 计算分页信息
    const total = count || 0
    const totalPages = Math.ceil(total / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    return c.json(createSuccessResponse({
      transactions: transactions || [],
      pagination: {
        current_page: page,
        per_page: limit,
        total,
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage,
      },
    }, '查询积分交易记录成功'))
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

points.post('/refund', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const username = c.get('username')

    console.log(`[points:refund] 用户 ${username}(${userId}) 请求返还积分`)

    const body = await c.req.json().catch(() => ({}))
    const parsed = refundRequestSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return c.json(createErrorResponse(issue?.message || '参数校验失败', 400), 400)
    }

    const { transaction_id } = parsed.data
    const supabase = createSupabaseAdminClient(c.env)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, points_balance')
      .eq('user_id', userId)
      .single()

    if (profileError || !profile) {
      console.error('[points:refund] 用户档案不存在:', profileError)
      return c.json(createErrorResponse('用户信息不存在', 404), 404)
    }

    const { data: transaction, error: transactionError } = await supabase
      .from('points_transactions')
      .select('id, profile_id, transaction_type, amount, is_successful, description, reference_id')
      .eq('id', transaction_id)
      .eq('profile_id', profile.id)
      .single()

    if (transactionError || !transaction) {
      console.error('[points:refund] 未找到对应交易或不属于当前用户:', transactionError)
      return c.json(createErrorResponse('交易记录不存在', 404), 404)
    }

    if (transaction.transaction_type !== 'spend') {
      return c.json(createErrorResponse('仅消费记录支持返还', 400), 400)
    }

    if (transaction.is_successful) {
      return c.json(createErrorResponse('成功交易无需返还', 400), 400)
    }

    if (!transaction.amount || transaction.amount >= 0) {
      return c.json(createErrorResponse('无效的交易金额，无法返还', 400), 400)
    }

    const refundReferenceId = `refund:${transaction.id}`
    const { data: existingRefund, error: existingRefundError } = await supabase
      .from('points_transactions')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('reference_id', refundReferenceId)
      .limit(1)
      .maybeSingle()

    if (existingRefundError) {
      console.error('[points:refund] 查询返还记录失败:', existingRefundError)
      return c.json(createErrorResponse('返还状态查询失败，请稍后再试', 500), 500)
    }

    if (existingRefund) {
      return c.json(createErrorResponse('该交易已返还积分，请勿重复操作', 400), 400)
    }

    const refundAmount = Math.abs(transaction.amount)
    const currentBalance = typeof profile.points_balance === 'number' ? profile.points_balance : 0
    const newBalanceRaw = currentBalance + refundAmount
    const newBalance = Math.trunc(newBalanceRaw * 1000) / 1000

    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({
        points_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (updateProfileError) {
      console.error('[points:refund] 更新用户积分失败:', updateProfileError)
      return c.json(createErrorResponse('更新积分余额失败', 500), 500)
    }

    const description = transaction.description && transaction.description.includes('已返还积分')
      ? transaction.description
      : `${transaction.description || '任务积分消耗'}（已返还积分）`

    const { error: markOriginalError } = await supabase
      .from('points_transactions')
      .update({ description })
      .eq('id', transaction.id)

    if (markOriginalError) {
      console.warn('[points:refund] 更新原交易备注失败:', markOriginalError)
    }

    const { error: insertRefundError } = await supabase
      .from('points_transactions')
      .insert({
        profile_id: profile.id,
        transaction_type: 'recharge',
        amount: refundAmount,
        balance_after: newBalance,
        description: `任务失败返还积分（原交易ID: ${transaction.id}）`,
        reference_id: refundReferenceId,
        is_successful: true,
      })

    if (insertRefundError) {
      console.error('[points:refund] 写入返还交易失败:', insertRefundError)
      const { error: revertError } = await supabase
        .from('profiles')
        .update({
          points_balance: currentBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)

      if (revertError)
        console.error('[points:refund] 返还失败后回滚余额失败:', revertError)
      return c.json(createErrorResponse('记录返还交易失败', 500), 500)
    }

    return c.json(createSuccessResponse({
      success: true,
      points_balance: newBalance,
    }, '积分返还成功'))
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    console.error('[points:refund] 积分返还异常:', err)
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

export default points
