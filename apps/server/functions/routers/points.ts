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
  start_date?: string
  end_date?: string
}

const points = new Hono<{ Bindings: DataBaseEnvBindings } & { Variables: AuthVariables }>()

// 查询积分交易记录的参数验证
const pointsTransactionsSchema = z.object({
  page: z.coerce.number().int().min(1, '页码必须大于0').default(1),
  limit: z.coerce.number().int().min(1, '每页数量必须大于0').max(100, '每页数量不能超过100').default(20),
  transaction_type: z.enum(['recharge', 'spend', 'transfer']).optional(),
  start_date: z.string().datetime('开始日期格式不正确').optional(),
  end_date: z.string().datetime('结束日期格式不正确').optional(),
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

    // 处理start_date参数
    const startDateParam = c.req.query('start_date')
    if (startDateParam) {
      queryParams.start_date = startDateParam
    }

    // 处理end_date参数
    const endDateParam = c.req.query('end_date')
    if (endDateParam) {
      queryParams.end_date = endDateParam
    }

    // 验证参数
    const parsed = pointsTransactionsSchema.safeParse(queryParams)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return c.json(createErrorResponse(issue?.message || '参数校验失败', 400), 400)
    }

    const { page, limit, transaction_type, start_date, end_date } = parsed.data
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
    if (start_date) {
      query = query.gte('created_at', start_date)
    }
    if (end_date) {
      query = query.lte('created_at', end_date)
    }

    // 获取总数
    const { count, error: countError } = await supabase
      .from('points_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profile.id)
      .eq(transaction_type ? 'transaction_type' : '', transaction_type || '')
      .gte('created_at', start_date || '1970-01-01T00:00:00Z')
      .lte('created_at', end_date || '2099-12-31T23:59:59Z')

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
