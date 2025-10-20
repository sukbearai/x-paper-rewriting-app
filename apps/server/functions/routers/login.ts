import { Hono } from 'hono'
import { z } from 'zod'
import type { AuthResponse } from '@supabase/supabase-js'
import { createErrorResponse, createSuccessResponse } from '@/utils/response'
import type { DataBaseEnvBindings } from '@/utils/db'
import { createSupabaseClient } from '@/utils/db'

interface LoginRequestBody {
  username?: string
  password?: string
  phone?: string
  otp?: string
}

// 错误消息常量
const ERROR_MESSAGES = {
  INVALID_JSON: '请求体格式错误，应为 JSON',
  VALIDATION_FAILED: '参数校验失败',
  PROVIDE_CREDENTIALS: '请提供用户名密码或手机号验证码进行登录',
  USERNAME_PASSWORD_REQUIRED: '用户名登录需要密码',
  PASSWORD_USERNAME_REQUIRED: '密码登录需要用户名',
  PHONE_OTP_REQUIRED: '手机号登录需要验证码',
  OTP_PHONE_REQUIRED: '验证码登录需要手机号',
  LOGIN_FAILED: '登录失败',
  INVALID_CREDENTIALS: '用户名或密码错误',
  INVALID_OTP: '验证码不正确或已过期',
  PROFILE_ERROR: '获取用户信息失败',
  SERVER_ERROR: '服务器内部错误',
  LOGIN_SUCCESS: '登录成功',
} as const

const login = new Hono<{ Bindings: DataBaseEnvBindings }>()

function preprocessOptionalString(value: unknown) {
  if (typeof value !== 'string')
    return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const loginSchema = z.object({
  username: z.preprocess(
    preprocessOptionalString,
    z.string().min(1, '用户名不能为空').optional(),
  ),
  password: z.preprocess(
    preprocessOptionalString,
    z.string().min(1, '密码不能为空').optional(),
  ),
  phone: z.preprocess(
    preprocessOptionalString,
    z.string().regex(/^\+?\d{6,15}$/, '手机号格式不正确').optional(),
  ),
  otp: z.preprocess(
    preprocessOptionalString,
    z.string().regex(/^\d{4,8}$/, '验证码格式不正确').optional(),
  ),
}).superRefine((data, ctx) => {
  const hasUsernamePassword = data.username && data.password
  const hasPhoneOtp = data.phone && data.otp

  if (!hasUsernamePassword && !hasPhoneOtp) {
    ctx.addIssue({
      code: 'custom',
      message: ERROR_MESSAGES.PROVIDE_CREDENTIALS,
    })
  }

  if (data.username && !data.password) {
    ctx.addIssue({
      code: 'custom',
      message: ERROR_MESSAGES.USERNAME_PASSWORD_REQUIRED,
      path: ['password'],
    })
  }

  if (data.password && !data.username) {
    ctx.addIssue({
      code: 'custom',
      message: ERROR_MESSAGES.PASSWORD_USERNAME_REQUIRED,
      path: ['username'],
    })
  }

  if (data.phone && !data.otp) {
    ctx.addIssue({
      code: 'custom',
      message: ERROR_MESSAGES.PHONE_OTP_REQUIRED,
      path: ['otp'],
    })
  }

  if (data.otp && !data.phone) {
    ctx.addIssue({
      code: 'custom',
      message: ERROR_MESSAGES.OTP_PHONE_REQUIRED,
      path: ['phone'],
    })
  }
})

login.post('/', async (c) => {
  try {
    let payload: LoginRequestBody
    try {
      payload = await c.req.json<LoginRequestBody>()
    }
    catch {
      return c.json(createErrorResponse(ERROR_MESSAGES.INVALID_JSON, 400), 400)
    }

    const parsed = loginSchema.safeParse(payload)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return c.json(createErrorResponse(issue?.message || ERROR_MESSAGES.VALIDATION_FAILED, 400), 400)
    }

    const { username, password, phone, otp } = parsed.data
    const supabase = createSupabaseClient(c.env)

    let authResult: AuthResponse | undefined

    if (username && password) {
      const { data, error } = await supabase
        .from('profiles')
        .select('email, user_id')
        .eq('username', username)
        .maybeSingle()

      if (error) {
        return c.json(createErrorResponse(error.message || ERROR_MESSAGES.LOGIN_FAILED, 500), 500)
      }

      if (!data) {
        return c.json(createErrorResponse(ERROR_MESSAGES.INVALID_CREDENTIALS, 401), 401)
      }

      const signInResult = await supabase.auth.signInWithPassword({
        email: data.email,
        password,
      })

      if (signInResult.error) {
        return c.json(createErrorResponse(ERROR_MESSAGES.INVALID_CREDENTIALS, 401), 401)
      }

      authResult = signInResult
    }
    else if (phone && otp) {
      const result = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      })

      if (result.error) {
        return c.json(createErrorResponse(ERROR_MESSAGES.INVALID_OTP, 401), 401)
      }

      authResult = result
    }

    if (!authResult || !authResult.data.user || !authResult.data.session) {
      return c.json(createErrorResponse(ERROR_MESSAGES.LOGIN_FAILED, 500), 500)
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, email, phone, role, points_balance, invite_code, created_at')
      .eq('user_id', authResult.data.user.id)
      .single()

    if (profileError || !profile) {
      return c.json(createErrorResponse(ERROR_MESSAGES.PROFILE_ERROR, 500), 500)
    }

    return c.json(
      createSuccessResponse(
        {
          user: {
            id: profile.id,
            username: profile.username,
            email: profile.email,
            phone: profile.phone,
            role: profile.role,
            pointsBalance: profile.points_balance,
            inviteCode: profile.invite_code,
            createdAt: profile.created_at,
          },
          session: {
            accessToken: authResult.data.session.access_token,
            refreshToken: authResult.data.session.refresh_token,
            expiresIn: authResult.data.session.expires_in,
          },
        },
        ERROR_MESSAGES.LOGIN_SUCCESS,
      ),
      200,
    )
  }
  catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.SERVER_ERROR
    return c.json(createErrorResponse(message || ERROR_MESSAGES.SERVER_ERROR, 500), 500)
  }
})

export default login
