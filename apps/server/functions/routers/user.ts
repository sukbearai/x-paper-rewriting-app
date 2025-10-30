import { Hono } from 'hono'
import { z } from 'zod'
import { createErrorResponse, createSuccessResponse } from '@/utils/response'
import type { DataBaseEnvBindings } from '@/utils/db'
import { createSupabaseClient } from '@/utils/db'

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

const user = new Hono<{ Bindings: DataBaseEnvBindings }>()

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
        .select('user_id, username, email, phone, role, points_balance, invite_code, created_at')
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
      // 查询用户档案
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, username, email, phone, role, points_balance, invite_code, created_at')
        .eq('phone', phone)
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
    let authUserId: string | null = null

    // 检查用户名是否已存在
    const { data: existingUsername, error: usernameError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (usernameError) {
      return c.json(createErrorResponse(usernameError.message || '服务器内部错误', 500), 500)
    }

    if (existingUsername) {
      return c.json(createErrorResponse('用户名已存在', 409), 409)
    }

    // 检查邮箱是否已存在
    const { data: existingEmail, error: emailError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (emailError) {
      return c.json(createErrorResponse(emailError.message || '服务器内部错误', 500), 500)
    }

    if (existingEmail) {
      return c.json(createErrorResponse('邮箱已被注册', 409), 409)
    }

    // 如果提供了手机号，检查是否已存在
    let existingPhone = null
    if (phone) {
      const { data: existingPhoneData, error: phoneError } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .maybeSingle()

      if (phoneError) {
        return c.json(createErrorResponse(phoneError.message || '服务器内部错误', 500), 500)
      }

      existingPhone = existingPhoneData
      if (existingPhone) {
        return c.json(createErrorResponse('手机号已被注册', 409), 409)
      }
    }

    // 如果提供了邀请码，验证其有效性
    let invitedByProfile = null
    if (invite_code) {
      const { data: inviterData, error: inviterError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('invite_code', invite_code.toUpperCase())
        .maybeSingle()

      if (inviterError) {
        return c.json(createErrorResponse(inviterError.message || '服务器内部错误', 500), 500)
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

      if (verifyData.user.phone !== phone) {
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
        return c.json(createErrorResponse(setSessionError.message || '设置账号信息失败', 400), 400)
      }

      try {
        const { data: updatedUser, error: updateError } = await supabase.auth.updateUser({
          email,
          password,
          phone,
          data: {
            username,
          },
        })

        if (updateError || !updatedUser.user) {
          return c.json(createErrorResponse(updateError?.message || '设置账号信息失败', 400), 400)
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
        return c.json(createErrorResponse(signUpError?.message || '注册失败', 400), 400)
      }

      authUserId = authData.user.id
    }

    if (!authUserId) {
      console.error('[register] Missing auth user id after auth flow')
      return c.json(createErrorResponse('注册失败，请稍后重试', 500), 500)
    }

    // 生成唯一邀请码
    let userInviteCode = generateInviteCode()
    let { data: existingInviteCode } = await supabase
      .from('profiles')
      .select('id')
      .eq('invite_code', userInviteCode)
      .maybeSingle()

    // 确保邀请码唯一
    while (existingInviteCode) {
      userInviteCode = generateInviteCode()
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('invite_code', userInviteCode)
        .maybeSingle()
      existingInviteCode = data
    }

    // 创建用户档案
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authUserId,
        username,
        email,
        phone: phone || null,
        invite_code: userInviteCode,
        invited_by: invitedByProfile?.id || null,
        role: 'user',
        points_balance: 0,
      })
      .select('id, username, email, phone, invite_code, role, points_balance, created_at')
      .single()

    if (profileError) {
      console.error('[register] Failed to create profile', {
        authUserId,
        error: profileError.message,
      })
      return c.json(createErrorResponse(profileError.message || '创建用户档案失败', 500), 500)
    }

    return c.json(createSuccessResponse({
      id: profileData.id,
      username: profileData.username,
      email: profileData.email,
      phone: profileData.phone,
      invite_code: profileData.invite_code,
      role: profileData.role,
      points_balance: profileData.points_balance,
      created_at: profileData.created_at,
      invited_by: invitedByProfile?.username || null,
    }, '注册成功'))
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

// 用户退出登录
user.post('/logout', async (c) => {
  try {
    // 从请求头获取token
    const accessToken = c.req.header('Authorization')?.replace('Bearer ', '')
    const refreshToken = c.req.header('refresh_token')

    // 至少需要提供access_token
    if (!accessToken) {
      return c.json(createErrorResponse('缺少访问令牌', 400), 400)
    }

    const supabase = createSupabaseClient(c.env, accessToken)

    // 验证token有效性并获取用户信息
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return c.json(createErrorResponse('访问令牌无效', 401), 401)
    }

    // 执行退出登录
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })

    if (signOutError) {
      console.error('[logout] Supabase signOut error:', signOutError)
      // 即使signOut失败，也继续处理，因为token可能已经过期
    }

    // 如果提供了refresh_token，尝试撤销它
    if (refreshToken) {
      try {
        // 创建新的客户端实例用于撤销refresh token
        const adminSupabase = createSupabaseClient(c.env)
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

// 用户修改密码
user.post('/change-password', async (c) => {
  try {
    // 从请求头获取access_token
    const accessToken = c.req.header('Authorization')?.replace('Bearer ', '')

    if (!accessToken) {
      return c.json(createErrorResponse('缺少访问令牌', 400), 400)
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

    // 验证token有效性并获取用户信息
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return c.json(createErrorResponse('访问令牌无效', 401), 401)
    }

    // 查询用户邮箱用于密码验证
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return c.json(createErrorResponse('用户档案不存在', 404), 404)
    }

    // 验证当前密码
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
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
