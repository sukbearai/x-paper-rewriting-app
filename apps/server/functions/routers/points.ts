import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import type { AuthVariables } from '../middleware/auth'
import { createErrorResponse, createSuccessResponse } from '@/utils/response'
import type { DataBaseEnvBindings } from '@/utils/db'
import { createSupabaseClient } from '@/utils/db'

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

// 查询积分余额
points.get('/balance', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const username = c.get('username')

    console.log(`[points:balance] 用户 ${username}(${userId}) 查询积分余额`)

    const supabase = createSupabaseClient(c.env)

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

    console.log(`[points:transactions] 用户 ${username}(${userId}) 查询积分交易记录`)

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
    const supabase = createSupabaseClient(c.env)

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

    // 添加日期范围过滤
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

export default points
