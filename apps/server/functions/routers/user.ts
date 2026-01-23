import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import type { AuthVariables } from '../middleware/auth'
import { createErrorResponse, createSuccessResponse } from '@/utils/response'
import type { DataBaseEnvBindings } from '@/utils/db'
import { createSupabaseAdminClient, createSupabaseClient } from '@/utils/db'

interface LoginRequestBody {
  username?: string
  password?: string
  phone?: string
  verification_code?: string
}

interface RegisterRequestBody {
  username?: string
  email?: string
  phone?: string
  verification_code?: string
  password?: string
  invite_code?: string
}

interface ChangePasswordRequestBody {
  current_password?: string
  new_password?: string
}

interface UpdateUserRoleRequestBody {
  target_user_id?: string
  role?: string
}

interface UpdateUserRateRequestBody {
  target_user_id?: string
  rate?: number
}

interface UpdateUserPointsRequestBody {
  target_user_id?: string
  amount?: number
  description?: string
}

interface ProfileRecord {
  id: number
  user_id: string
  username: string | null
  email: string | null
  phone: string | null
  role: string | null
  points_balance: number | null
  rate: number | null
  invite_code: string | null
  invited_by: number | null
  created_at: string
}

const user = new Hono<{ Bindings: DataBaseEnvBindings, Variables: AuthVariables }>()

const loginSchema = z.object({
  username: z.string()
    .trim()
    .min(1, '用户名不能为空')
    .optional(),
  password: z.string()
    .min(1, '密码不能为空')
    .optional(),
  phone: z.string()
    .trim()
    .regex(/^\+?\d{6,15}$/, '手机号格式不正确')
    .optional(),
  verification_code: z.string()
    .trim()
    .min(4, '验证码格式不正确')
    .max(6, '验证码格式不正确')
    .optional(),
}).refine((data) => {
  // 用户名密码登录：两者都必须提供
  const isUsernameLogin = data.username && data.password
  // 手机号OTP登录：两者都必须提供
  const isPhoneLogin = data.phone && data.verification_code
  // 必须是其中一种登录方式
  return isUsernameLogin || isPhoneLogin
}, {
  message: '请提供用户名密码或手机号验证码进行登录',
  path: [],
}).refine((data) => {
  // 不能同时提供两种登录方式
  const isUsernameLogin = data.username && data.password
  const isPhoneLogin = data.phone && data.verification_code
  return !(isUsernameLogin && isPhoneLogin)
}, {
  message: '只能选择一种登录方式',
  path: [],
})

const registerSchema = z.object({
  username: z.string()
    .trim()
    .min(3, '用户名至少3个字符')
    .max(20, '用户名最多20个字符')
    .regex(/^[\w\u4E00-\u9FA5]+$/, '用户名只能包含字母、数字、下划线和中文字符'),
  email: z.string()
    .trim()
    .email('邮箱格式不正确'),
  phone: z.string()
    .trim()
    .regex(/^\+?\d{6,15}$/, '手机号格式不正确')
    .optional(),
  verification_code: z.string()
    .trim()
    .min(4, '验证码格式不正确')
    .max(6, '验证码格式不正确')
    .optional(),
  password: z.string()
    .min(6, '密码至少6个字符')
    .max(100, '密码最多100个字符'),
  invite_code: z.string()
    .trim()
    .optional(),
}).refine((data) => {
  // 如果提供了手机号，则验证码是必需的
  return !(data.phone && !data.verification_code)
}, {
  message: '提供手机号时必须提供验证码',
  path: ['verification_code'],
})

const changePasswordSchema = z.object({
  current_password: z.string()
    .min(1, '当前密码不能为空'),
  new_password: z.string()
    .min(6, '新密码至少6个字符')
    .max(100, '新密码最多100个字符'),
}).refine(data => data.current_password !== data.new_password, {
  message: '新密码不能与当前密码相同',
  path: ['new_password'],
})

const updateUserRoleSchema = z.object({
  target_user_id: z.string()
    .trim()
    .uuid('用户ID格式不正确'),
  role: z.preprocess(
    value => typeof value === 'string' ? value.trim().toLowerCase() : value,
    z.preprocess(
      value => value === '' ? undefined : value,
      z.enum(['admin', 'agent', 'user']),
    ),
  ),
})

const updateUserRateSchema = z.object({
  target_user_id: z.string()
    .trim()
    .uuid('用户ID格式不正确'),
  rate: z.number()
    .min(0, '费率不能小于0')
    .max(10, '费率不能超过10'),
})

const updateUserPointsSchema = z.object({
  target_user_id: z.string()
    .trim()
    .uuid('用户ID格式不正确'),
  amount: z.number()
    .min(-1000000, '积分调整金额过小')
    .max(1000000, '积分调整金额过大')
    .refine(val => val !== 0, '积分调整金额不能为0'),
  description: z.string()
    .trim()
    .max(200, '描述信息过长')
    .optional(),
})

const refreshSessionSchema = z.object({
  refresh_token: z.string()
    .trim()
    .min(1, 'refresh_token不能为空'),
})

// 生成6位随机邀请码
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

user.post('/login', async (c) => {
  try {
    let payload: LoginRequestBody
    try {
      payload = await c.req.json<LoginRequestBody>()
    }
    catch {
      return c.json(createErrorResponse('请求体格式错误，应为 JSON', 400), 400)
    }

    const parsed = loginSchema.safeParse(payload)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return c.json(createErrorResponse(issue?.message || '参数校验失败', 400), 400)
    }

    const { username, password, phone, verification_code } = parsed.data
    const supabase = createSupabaseClient(c.env)

    // 用户名密码登录
    if (username && password) {
      // 查询用户档案
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, username, email, phone, role, points_balance, rate, invite_code, created_at')
        .eq('username', username)
        .single()

      if (profileError || !profile) {
        return c.json(createErrorResponse('用户名或密码错误', 401), 401)
      }

      // 使用Supabase Auth进行密码验证
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      })

      if (signInError || !authData.session) {
        return c.json(createErrorResponse('用户名或密码错误', 401), 401)
      }

      // 返回用户信息和token
      return c.json(createSuccessResponse({
        user: {
          id: profile.user_id,
          username: profile.username,
          email: profile.email,
          phone: profile.phone,
          role: profile.role,
          points_balance: profile.points_balance,
          rate: profile.rate,
          invite_code: profile.invite_code,
          created_at: profile.created_at,
        },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
        },
      }, '登录成功'))
    }

    // 手机号OTP登录
    if (phone && verification_code) {
      // 去掉手机号开头的+号，因为Supabase存储时会去掉+号
      const normalizedPhone = phone.replace(/^\+/, '')

      // 查询用户档案
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, username, email, phone, role, points_balance, rate, invite_code, created_at')
        .eq('phone', normalizedPhone)
        .single()

      if (profileError || !profile) {
        return c.json(createErrorResponse('手机号未注册', 404), 404)
      }

      // 验证OTP
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: verification_code,
        type: 'sms',
      })

      if (verifyError || !verifyData.session || !verifyData.user) {
        return c.json(createErrorResponse('验证码错误或已过期', 401), 401)
      }

      // 返回用户信息和token
      return c.json(createSuccessResponse({
        user: {
          id: profile.user_id,
          username: profile.username,
          email: profile.email,
          phone: profile.phone,
          role: profile.role,
          points_balance: profile.points_balance,
          rate: profile.rate,
          invite_code: profile.invite_code,
          created_at: profile.created_at,
        },
        session: {
          access_token: verifyData.session.access_token,
          refresh_token: verifyData.session.refresh_token,
          expires_at: verifyData.session.expires_at,
        },
      }, '登录成功'))
    }

    // 理论上不会执行到这里，因为有schema验证
    return c.json(createErrorResponse('登录参数错误', 400), 400)
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

user.post('/refresh', async (c) => {
  try {
    let payload: { refresh_token?: string }
    try {
      payload = await c.req.json<{ refresh_token?: string }>()
    }
    catch {
      return c.json(createErrorResponse('请求体格式错误，应为 JSON', 400), 400)
    }

    const parsed = refreshSessionSchema.safeParse(payload)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return c.json(createErrorResponse(issue?.message || '参数校验失败', 400), 400)
    }

    const { refresh_token } = parsed.data
    const supabase = createSupabaseClient(c.env)
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({ refresh_token })

    if (refreshError || !refreshData.session || !refreshData.user) {
      console.error('[user:refresh] 刷新会话失败:', refreshError)
      return c.json(createErrorResponse('刷新会话失败，请重新登录', 401), 401)
    }

    const session = refreshData.session
    const userInfo = refreshData.user

    if (!session.access_token || !session.refresh_token || !session.expires_at) {
      console.error('[user:refresh] Supabase返回的会话信息不完整')
      return c.json(createErrorResponse('刷新会话失败，请重新登录', 401), 401)
    }

    const adminSupabase = createSupabaseAdminClient(c.env)
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('user_id, username, email, phone, role, points_balance, rate, invite_code, created_at')
      .eq('user_id', userInfo.id)
      .single()

    if (profileError || !profile) {
      console.error('[user:refresh] 查询用户档案失败:', profileError)
      return c.json(createErrorResponse('刷新会话失败，请重新登录', 401), 401)
    }

    return c.json(createSuccessResponse({
      user: {
        id: profile.user_id,
        username: profile.username,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        points_balance: profile.points_balance,
        rate: profile.rate,
        invite_code: profile.invite_code,
        created_at: profile.created_at,
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      },
    }, '刷新会话成功'))
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    console.error('[user:refresh] 刷新会话异常:', err)
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

user.post('/register', async (c) => {
  try {
    let payload: RegisterRequestBody
    try {
      payload = await c.req.json<RegisterRequestBody>()
    }
    catch {
      return c.json(createErrorResponse('请求体格式错误，应为 JSON', 400), 400)
    }

    const parsed = registerSchema.safeParse(payload)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return c.json(createErrorResponse(issue?.message || '参数校验失败', 400), 400)
    }

    const { username, email, phone, verification_code, password, invite_code } = parsed.data
    const supabase = createSupabaseClient(c.env)
    const adminSupabase = createSupabaseAdminClient(c.env) // 添加admin客户端
    let authUserId: string | null = null

    // 批量检查用户名、邮箱、手机号是否已存在
    console.log('[register] 批量检查用户信息是否存在', { username, email })

    const batchChecks = await adminSupabase
      .from('profiles')
      .select('username, email, phone, invite_code')
      .or(`username.eq.${username},email.eq.${email}${phone ? `,phone.eq.${phone.replace(/^\+/, '')}` : ''}`)
      .limit(100)

    if (batchChecks.error) {
      return c.json(createErrorResponse(`批量检查失败: ${'服务器内部错误'} [步骤: 1/4]`, 500), 500)
    }

    // 检查用户名是否已存在
    const existingUsername = batchChecks.data?.find(item => item.username === username)
    if (existingUsername) {
      return c.json(createErrorResponse('用户名已存在', 409), 409)
    }

    // 检查邮箱是否已存在
    const existingEmail = batchChecks.data?.find(item => item.email === email)
    if (existingEmail) {
      return c.json(createErrorResponse('邮箱已被注册', 409), 409)
    }

    // 如果提供了手机号，使用 admin API 检查是否已存在
    let existingPhone = null
    if (phone) {
      const normalizedPhone = phone.replace(/^\+/, '')
      existingPhone = batchChecks.data?.find(item => item.phone === normalizedPhone)
      if (existingPhone) {
        return c.json(createErrorResponse('手机号已被注册', 409), 409)
      }
    }

    // 如果提供了邀请码，使用 admin API 验证其有效性
    let invitedByProfile = null
    if (invite_code) {
      console.log('[register] 验证邀请码:', { invite_code })

      const { data: inviterData, error: inviterError } = await adminSupabase
        .from('profiles')
        .select('id, username')
        .eq('invite_code', invite_code.toUpperCase())
        .maybeSingle()

      if (inviterError) {
        return c.json(createErrorResponse(`邀请码验证失败: ${inviterError.message || '服务器内部错误'} [步骤: 2/4]`, 500), 500)
      }

      if (!inviterData) {
        return c.json(createErrorResponse('邀请码无效', 404), 404)
      }

      invitedByProfile = inviterData
    }

    if (phone) {
      if (!verification_code) {
        return c.json(createErrorResponse('提供手机号时必须提供验证码', 400), 400)
      }

      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: verification_code,
        type: 'sms',
      })

      if (verifyError || !verifyData.session || !verifyData.user) {
        return c.json(createErrorResponse('验证码错误或已过期', 400), 400)
      }

      // 去掉手机号开头的+号进行比较，因为Supabase存储时会去掉+号
      const normalizedPhone = phone.replace(/^\+/, '')
      if (verifyData.user.phone !== normalizedPhone) {
        return c.json(createErrorResponse('手机号与验证码不匹配', 400), 400)
      }

      const session = verifyData.session
      if (!session.access_token || !session.refresh_token) {
        return c.json(createErrorResponse('验证码会话无效，请重新获取验证码', 400), 400)
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })

      if (setSessionError) {
        return c.json(createErrorResponse(`设置会话失败: ${setSessionError.message || '设置账号信息失败'} [步骤: 5/8]`, 400), 400)
      }

      try {
        // 使用 admin API 直接更新用户，避免邮箱验证要求
        const adminSupabase = createSupabaseAdminClient(c.env)
        const { data: updatedUser, error: updateError } = await adminSupabase.auth.admin.updateUserById(
          verifyData.user.id,
          {
            email,
            password,
            phone,
            user_metadata: {
              username,
            },
            // 确认邮箱，避免登录时的邮箱验证问题
            email_confirm: true,
          },
        )

        if (updateError || !updatedUser.user) {
          return c.json(createErrorResponse(`更新认证用户失败: ${updateError?.message || '设置账号信息失败'} [步骤: 3/4]`, 400), 400)
        }

        authUserId = updatedUser.user.id
      }
      finally {
        try {
          await supabase.auth.signOut({ scope: 'global' })
        }
        catch (signOutError) {
          console.warn('[register] Failed to sign out temporary session', signOutError)
        }
      }
    }
    else {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      })

      if (signUpError || !authData.user) {
        return c.json(createErrorResponse(`邮箱注册失败: ${signUpError?.message || '注册失败'} [步骤: 4/4]`, 400), 400)
      }

      authUserId = authData.user.id
    }

    if (!authUserId) {
      console.error('[register] Missing auth user id after auth flow')
      return c.json(createErrorResponse('注册失败，请稍后重试', 500), 500)
    }

    // 生成唯一邀请码 - 批量优化版本
    let userInviteCode = generateInviteCode()
    let inviteCodeCheckCount = 0
    const maxInviteCodeAttempts = 10

    // 收集所有需要避免的邀请码（包括已存在的和输入的邀请码）
    const existingInviteCodes = new Set(
      batchChecks.data?.map(item => item.invite_code).filter(Boolean) || [],
    )
    if (invite_code) {
      existingInviteCodes.add(invite_code.toUpperCase())
    }

    // 生成不冲突的邀请码
    while (inviteCodeCheckCount < maxInviteCodeAttempts) {
      if (!existingInviteCodes.has(userInviteCode)) {
        // 验证生成的邀请码确实不存在
        const { data: inviteCheck } = await adminSupabase
          .from('profiles')
          .select('id')
          .eq('invite_code', userInviteCode)
          .maybeSingle()

        if (!inviteCheck) {
          break // 找到唯一邀请码
        }
        existingInviteCodes.add(userInviteCode)
      }
      userInviteCode = generateInviteCode()
      inviteCodeCheckCount++
    }

    if (inviteCodeCheckCount >= maxInviteCodeAttempts) {
      return c.json(createErrorResponse('邀请码生成失败，请重试 [步骤: 3/4]', 500), 500)
    }

    // 使用 admin API 创建用户档案
    const { data: profileData, error: profileError } = await adminSupabase
      .from('profiles')
      .insert({
        user_id: authUserId,
        username,
        email,
        phone: phone ? phone.replace(/^\+/, '') : null, // 去掉+号存储，与数据库保持一致
        invite_code: userInviteCode,
        invited_by: invitedByProfile?.id || null,
        role: 'user',
        points_balance: invitedByProfile ? 1 : 0,
        rate: 1,
      })
      .select('id, username, email, phone, invite_code, role, points_balance, rate, created_at')
      .single()

    if (profileError) {
      console.error('[register] Failed to create profile', {
        authUserId,
        error: profileError.message,
      })

      // 档案创建失败，需要清理已创建的认证用户
      try {
        const adminSupabase = createSupabaseAdminClient(c.env)
        await adminSupabase.auth.admin.deleteUser(authUserId)
        console.log('[register] Successfully cleaned up auth user after profile creation failure')
      }
      catch (cleanupError) {
        console.error('[register] Failed to cleanup auth user after profile creation failure:', cleanupError)
      }

      return c.json(createErrorResponse(`创建用户档案失败: ${profileError.message || '用户档案创建失败'} [步骤: 4/4]`, 500), 500)
    }

    // 如果有邀请人，记录积分赠送交易
    if (invitedByProfile) {
      try {
        await adminSupabase.from('points_transactions').insert({
          profile_id: profileData.id,
          transaction_type: 'recharge',
          amount: 1,
          balance_after: 1,
          description: '注册邀请奖励',
          is_successful: true,
        })
      }
      catch (transactionError) {
        console.error('[register] Failed to record bonus transaction:', transactionError)
        // 交易记录失败不阻止注册流程，但记录错误日志
      }
    }

    return c.json(createSuccessResponse({
      id: profileData.id,
      username: profileData.username,
      email: profileData.email,
      phone: profileData.phone,
      invite_code: profileData.invite_code,
      role: profileData.role,
      points_balance: profileData.points_balance,
      rate: profileData.rate,
      created_at: profileData.created_at,
      invited_by: invitedByProfile?.username || null,
    }, '注册成功'))
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(`注册过程未知错误: ${message || '服务器内部错误'} [步骤: 异常捕获]`, 500), 500)
  }
})

user.get('/list', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const username = c.get('username')
    const roleRaw = c.get('role')

    const role = (roleRaw || '').toLowerCase()

    // 获取查询参数
    const phoneQuery = c.req.query('phone')
    const usernameQuery = c.req.query('username')
    const pageQuery = c.req.query('page')
    const limitQuery = c.req.query('limit')

    // 分页参数
    const page = Math.max(1, Number.parseInt(pageQuery || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitQuery || '10', 10) || 10))
    const offset = (page - 1) * limit

    console.log(`[user:list] 用户 ${username}(${userId}) 请求用户列表，角色：${role}，分页：${page}/${limit}${phoneQuery ? `，手机号搜索：${phoneQuery}` : ''}${usernameQuery ? `，用户名搜索：${usernameQuery}` : ''}`)

    if (role !== 'admin' && role !== 'agent') {
      return c.json(createErrorResponse('无权访问', 403), 403)
    }

    const supabase = createSupabaseAdminClient(c.env)

    let usersData: ProfileRecord[] = []
    let total = 0

    if (role === 'admin') {
      // 先查询总数
      let countQuery = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })

      if (phoneQuery) {
        countQuery = countQuery.ilike('phone', `%${phoneQuery}%`)
      }
      if (usernameQuery) {
        countQuery = countQuery.ilike('username', `%${usernameQuery}%`)
      }

      const { count, error: countError } = await countQuery
      if (countError) {
        console.error('[user:list] 管理员查询用户总数失败:', countError)
      }
      total = count ?? 0

      // 再查询分页数据
      let query = supabase
        .from('profiles')
        .select('id, user_id, username, email, phone, role, points_balance, rate, invite_code, invited_by, created_at')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (phoneQuery) {
        query = query.ilike('phone', `%${phoneQuery}%`)
      }

      if (usernameQuery) {
        query = query.ilike('username', `%${usernameQuery}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error('[user:list] 管理员查询用户列表失败:', error)
        return c.json(createErrorResponse('获取用户列表失败', 500), 500)
      }

      usersData = (data || []) as ProfileRecord[]
    }
    else {
      const { data: agentProfile, error: agentProfileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (agentProfileError || !agentProfile) {
        console.error('[user:list] 代理用户档案查询失败:', agentProfileError)
        return c.json(createErrorResponse('用户档案不存在', 404), 404)
      }

      // 先查询总数
      let countQuery = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('invited_by', agentProfile.id)

      if (phoneQuery) {
        countQuery = countQuery.ilike('phone', `%${phoneQuery}%`)
      }
      if (usernameQuery) {
        countQuery = countQuery.ilike('username', `%${usernameQuery}%`)
      }

      const { count, error: countError } = await countQuery
      if (countError) {
        console.error('[user:list] 代理查询用户总数失败:', countError)
      }
      total = count ?? 0

      // 再查询分页数据
      let query = supabase
        .from('profiles')
        .select('id, user_id, username, email, phone, role, points_balance, rate, invite_code, invited_by, created_at')
        .eq('invited_by', agentProfile.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (phoneQuery) {
        query = query.ilike('phone', `%${phoneQuery}%`)
      }

      if (usernameQuery) {
        query = query.ilike('username', `%${usernameQuery}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error('[user:list] 代理查询下级用户失败:', error)
        return c.json(createErrorResponse('获取下级用户失败', 500), 500)
      }

      usersData = (data || []) as ProfileRecord[]
    }

    const inviterIds = Array.from(new Set(
      usersData
        .map(item => item.invited_by)
        .filter((id): id is number => typeof id === 'number'),
    ))

    let inviterUsernameMap: Record<number, string | null> = {}

    if (inviterIds.length > 0) {
      const { data: inviterProfiles, error: inviterError } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', inviterIds)

      if (inviterError) {
        console.error('[user:list] 查询邀请人用户名失败:', inviterError)
      }
      else {
        inviterUsernameMap = (inviterProfiles || []).reduce<Record<number, string | null>>((acc, profile) => {
          acc[profile.id as number] = profile.username ?? null
          return acc
        }, {})
      }
    }

    const users = usersData.map(item => ({
      id: item.id,
      user_id: item.user_id,
      username: item.username,
      email: item.email,
      phone: item.phone,
      role: item.role || 'user',
      points_balance: item.points_balance ?? 0,
      rate: item.rate ?? 1,
      invite_code: item.invite_code,
      invited_by: item.invited_by,
      invited_by_username: typeof item.invited_by === 'number' ? inviterUsernameMap[item.invited_by] ?? null : null,
      created_at: item.created_at,
    }))

    return c.json(createSuccessResponse({
      users,
      total,
      page,
      limit,
      scope: role === 'admin' ? 'all' : 'downline',
    }, '获取用户列表成功'))
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    console.error('[user:list] 获取用户列表异常:', err)
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

user.post('/update-role', authMiddleware, async (c) => {
  try {
    const requesterId = c.get('userId')
    const requesterName = c.get('username')
    const requesterRole = (c.get('role') || '').toLowerCase()

    if (requesterRole !== 'admin') {
      return c.json(createErrorResponse('仅管理员可修改用户角色', 403), 403)
    }

    let payload: UpdateUserRoleRequestBody
    try {
      payload = await c.req.json<UpdateUserRoleRequestBody>()
    }
    catch {
      return c.json(createErrorResponse('请求体格式错误，应为 JSON', 400), 400)
    }

    const parsed = updateUserRoleSchema.safeParse(payload)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return c.json(createErrorResponse(issue?.message || '参数校验失败', 400), 400)
    }

    const { target_user_id, role: targetRole } = parsed.data
    const adminSupabase = createSupabaseAdminClient(c.env)

    const { data: targetProfile, error: targetProfileError } = await adminSupabase
      .from('profiles')
      .select('id, user_id, username, email, phone, role, points_balance, rate, invite_code, invited_by, created_at')
      .eq('user_id', target_user_id)
      .single()

    if (targetProfileError || !targetProfile) {
      console.error('[user:update-role] 未找到目标用户:', targetProfileError)
      return c.json(createErrorResponse('目标用户不存在', 404), 404)
    }

    const previousRoleRaw = targetProfile.role || 'user'
    const previousRole = typeof previousRoleRaw === 'string' ? previousRoleRaw.toLowerCase() : 'user'

    if (previousRole === targetRole) {
      console.log(`[user:update-role] 管理员 ${requesterName}(${requesterId}) 调整用户 ${target_user_id} 角色，但角色已为 ${targetRole}`)
      return c.json(createSuccessResponse({
        id: targetProfile.id,
        user_id: targetProfile.user_id,
        username: targetProfile.username,
        email: targetProfile.email,
        phone: targetProfile.phone,
        role: targetProfile.role || 'user',
        points_balance: targetProfile.points_balance ?? 0,
        rate: targetProfile.rate ?? 1,
        invite_code: targetProfile.invite_code,
        invited_by: targetProfile.invited_by,
        created_at: targetProfile.created_at,
      }, '角色已是最新状态'))
    }

    const { data: updatedProfile, error: updateError } = await adminSupabase
      .from('profiles')
      .update({
        role: targetRole,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', target_user_id)
      .select('id, user_id, username, email, phone, role, points_balance, rate, invite_code, invited_by, created_at')
      .single()

    if (updateError || !updatedProfile) {
      console.error('[user:update-role] 更新用户角色失败:', updateError)
      return c.json(createErrorResponse('更新用户角色失败', 500), 500)
    }

    console.log(`[user:update-role] 管理员 ${requesterName}(${requesterId}) 将用户 ${target_user_id} 角色从 ${previousRole} 更新为 ${targetRole}`)

    return c.json(createSuccessResponse({
      id: updatedProfile.id,
      user_id: updatedProfile.user_id,
      username: updatedProfile.username,
      email: updatedProfile.email,
      phone: updatedProfile.phone,
      role: updatedProfile.role || targetRole,
      previous_role: previousRole,
      points_balance: updatedProfile.points_balance ?? 0,
      rate: updatedProfile.rate ?? 1,
      invite_code: updatedProfile.invite_code,
      invited_by: updatedProfile.invited_by,
      created_at: updatedProfile.created_at,
    }, '角色更新成功'))
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    console.error('[user:update-role] 修改用户角色异常:', err)
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

user.post('/update-rate', authMiddleware, async (c) => {
  try {
    const requesterId = c.get('userId')
    const requesterName = c.get('username')
    const requesterRole = (c.get('role') || '').toLowerCase()

    if (requesterRole !== 'admin') {
      return c.json(createErrorResponse('仅管理员可修改用户费率', 403), 403)
    }

    let payload: UpdateUserRateRequestBody
    try {
      payload = await c.req.json<UpdateUserRateRequestBody>()
    }
    catch {
      return c.json(createErrorResponse('请求体格式错误，应为 JSON', 400), 400)
    }

    const parsed = updateUserRateSchema.safeParse(payload)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return c.json(createErrorResponse(issue?.message || '参数校验失败', 400), 400)
    }

    const { target_user_id, rate: targetRate } = parsed.data
    const adminSupabase = createSupabaseAdminClient(c.env)

    const { data: targetProfile, error: targetProfileError } = await adminSupabase
      .from('profiles')
      .select('id, user_id, username, email, phone, role, points_balance, rate, invite_code, invited_by, created_at')
      .eq('user_id', target_user_id)
      .single()

    if (targetProfileError || !targetProfile) {
      console.error('[user:update-rate] 未找到目标用户:', targetProfileError)
      return c.json(createErrorResponse('目标用户不存在', 404), 404)
    }

    const previousRate = targetProfile.rate ?? 1

    if (previousRate === targetRate) {
      console.log(`[user:update-rate] 管理员 ${requesterName}(${requesterId}) 调整用户 ${target_user_id} 费率，但费率已为 ${targetRate}`)
      return c.json(createSuccessResponse({
        id: targetProfile.id,
        user_id: targetProfile.user_id,
        username: targetProfile.username,
        email: targetProfile.email,
        phone: targetProfile.phone,
        role: targetProfile.role || 'user',
        points_balance: targetProfile.points_balance ?? 0,
        rate: targetProfile.rate ?? 1,
        invite_code: targetProfile.invite_code,
        invited_by: targetProfile.invited_by,
        created_at: targetProfile.created_at,
      }, '费率已是最新状态'))
    }

    const { data: updatedProfile, error: updateError } = await adminSupabase
      .from('profiles')
      .update({
        rate: targetRate,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', target_user_id)
      .select('id, user_id, username, email, phone, role, points_balance, rate, invite_code, invited_by, created_at')
      .single()

    if (updateError || !updatedProfile) {
      console.error('[user:update-rate] 更新用户费率失败:', updateError)
      return c.json(createErrorResponse('更新用户费率失败', 500), 500)
    }

    console.log(`[user:update-rate] 管理员 ${requesterName}(${requesterId}) 将用户 ${target_user_id} 费率从 ${previousRate} 更新为 ${targetRate}`)

    return c.json(createSuccessResponse({
      id: updatedProfile.id,
      user_id: updatedProfile.user_id,
      username: updatedProfile.username,
      email: updatedProfile.email,
      phone: updatedProfile.phone,
      role: updatedProfile.role || 'user',
      points_balance: updatedProfile.points_balance ?? 0,
      rate: updatedProfile.rate ?? targetRate,
      previous_rate: previousRate,
      invite_code: updatedProfile.invite_code,
      invited_by: updatedProfile.invited_by,
      created_at: updatedProfile.created_at,
    }, '费率更新成功'))
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    console.error('[user:update-rate] 修改用户费率异常:', err)
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

user.post('/update-points', authMiddleware, async (c) => {
  try {
    const requesterId = c.get('userId')
    const requesterName = c.get('username')
    const requesterRole = (c.get('role') || '').toLowerCase()

    if (requesterRole !== 'admin') {
      return c.json(createErrorResponse('仅管理员可修改用户积分', 403), 403)
    }

    let payload: UpdateUserPointsRequestBody
    try {
      payload = await c.req.json<UpdateUserPointsRequestBody>()
    }
    catch {
      return c.json(createErrorResponse('请求体格式错误，应为 JSON', 400), 400)
    }

    const parsed = updateUserPointsSchema.safeParse(payload)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return c.json(createErrorResponse(issue?.message || '参数校验失败', 400), 400)
    }

    const { target_user_id, amount, description } = parsed.data
    const adminSupabase = createSupabaseAdminClient(c.env)

    // 1. 获取目标用户档案
    const { data: targetProfile, error: targetProfileError } = await adminSupabase
      .from('profiles')
      .select('id, user_id, points_balance')
      .eq('user_id', target_user_id)
      .single()

    if (targetProfileError || !targetProfile) {
      console.error('[user:update-points] 未找到目标用户:', targetProfileError)
      return c.json(createErrorResponse('目标用户不存在', 404), 404)
    }

    const currentBalance = targetProfile.points_balance ?? 0
    const newBalanceRaw = currentBalance + amount
    // 保留3位小数并处理浮点误差
    const newBalance = Math.trunc(newBalanceRaw * 1000) / 1000

    if (newBalance < 0) {
      return c.json(createErrorResponse(`积分余额不足，当前余额: ${currentBalance}`, 400), 400)
    }

    // 2. 更新用户积分余额
    const { data: updatedProfile, error: updateError } = await adminSupabase
      .from('profiles')
      .update({
        points_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', target_user_id)
      .select('id, user_id, username, email, phone, role, points_balance, rate, invite_code, invited_by, created_at')
      .single()

    if (updateError || !updatedProfile) {
      console.error('[user:update-points] 更新用户积分失败:', updateError)
      return c.json(createErrorResponse('更新用户积分失败', 500), 500)
    }

    // 3. 记录交易日志
    const { error: transactionError } = await adminSupabase
      .from('points_transactions')
      .insert({
        profile_id: targetProfile.id,
        transaction_type: 'recharge', // 管理员增加积分统一记为充值类型
        amount,
        balance_after: newBalance,
        description: description || `管理员 ${requesterName} 手动调整积分`,
        is_successful: true,
      })

    if (transactionError) {
      console.warn('[user:update-points] 记录积分交易失败:', transactionError)
      // 注意：这里更新已经成功，只是日志记录失败，暂不对用户报错，但在日志中记录
    }

    console.log(`[user:update-points] 管理员 ${requesterName}(${requesterId}) 将用户 ${target_user_id} 积分从 ${currentBalance} 调整为 ${newBalance} (调整量: ${amount})`)

    return c.json(createSuccessResponse({
      id: updatedProfile.id,
      user_id: updatedProfile.user_id,
      username: updatedProfile.username,
      email: updatedProfile.email,
      phone: updatedProfile.phone,
      role: updatedProfile.role || 'user',
      points_balance: updatedProfile.points_balance ?? 0,
      rate: updatedProfile.rate ?? 1,
      invite_code: updatedProfile.invite_code,
      invited_by: updatedProfile.invited_by,
      created_at: updatedProfile.created_at,
    }, '积分更新成功'))
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    console.error('[user:update-points] 修改用户积分异常:', err)
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

// 用户退出登录 - 使用中间件方式
user.post('/logout', authMiddleware, async (c) => {
  try {
    // 从中间件获取的用户信息
    const userId = c.get('userId')
    const username = c.get('username')
    const accessToken = c.get('accessToken')

    console.log(`[logout] 用户 ${username}(${userId}) 退出登录`)

    // 从请求头获取refresh_token
    const refreshToken = c.req.header('refresh_token')

    if (!accessToken) {
      console.error('[logout] 缺少访问令牌')
      return c.json(createErrorResponse('认证信息缺失，请重新登录', 401), 401)
    }

    // 创建supabase客户端来处理退出
    const supabase = createSupabaseClient(c.env, accessToken)

    // 执行退出登录
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })

    if (signOutError) {
      console.error('[logout] Supabase signOut error:', signOutError)
      // 即使signOut失败，也继续处理，因为token可能已经过期
    }

    // 如果提供了refresh_token，尝试撤销它
    if (refreshToken) {
      try {
        const adminSupabase = createSupabaseAdminClient(c.env)
        await adminSupabase.auth.admin.signOut(refreshToken)
      }
      catch (revokeError) {
        console.warn('[logout] Failed to revoke refresh token:', revokeError)
        // 不阻止退出流程
      }
    }

    return c.json(createSuccessResponse(null, '退出登录成功'))
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

// 用户修改密码 - 使用中间件方式
user.post('/change-password', authMiddleware, async (c) => {
  try {
    // 从中间件获取的用户信息
    const userId = c.get('userId')
    const username = c.get('username')
    const email = c.get('email')
    const accessToken = c.get('accessToken')

    console.log(`[change-password] 用户 ${username}(${userId}) 修改密码`)

    if (!accessToken) {
      console.error('[change-password] 缺少访问令牌')
      return c.json(createErrorResponse('认证信息缺失，请重新登录', 401), 401)
    }

    let payload: ChangePasswordRequestBody
    try {
      payload = await c.req.json<ChangePasswordRequestBody>()
    }
    catch {
      return c.json(createErrorResponse('请求体格式错误，应为 JSON', 400), 400)
    }

    const parsed = changePasswordSchema.safeParse(payload)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return c.json(createErrorResponse(issue?.message || '参数校验失败', 400), 400)
    }

    const { current_password, new_password } = parsed.data
    const supabase = createSupabaseClient(c.env, accessToken)

    // 验证当前密码
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: current_password,
    })

    if (signInError) {
      return c.json(createErrorResponse('当前密码错误', 401), 401)
    }

    // 更新密码
    const { error: updateError } = await supabase.auth.updateUser({
      password: new_password,
    })

    if (updateError) {
      console.error('[change-password] Update password error:', updateError)
      return c.json(createErrorResponse('密码更新失败', 500), 500)
    }

    // 退出所有会话（强制用户重新登录）
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })

    if (signOutError) {
      console.warn('[change-password] SignOut error:', signOutError)
      // 不影响主要功能，密码已更新成功
    }

    return c.json(createSuccessResponse(null, '密码修改成功，请重新登录'))
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

export default user
