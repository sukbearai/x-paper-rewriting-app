import { Hono } from 'hono'
import { z } from 'zod'
import { createErrorResponse, createSuccessResponse } from '@/utils/response'
import type { DataBaseEnvBindings } from '@/utils/db'
import { createSupabaseClient } from '@/utils/db'

interface SignupRequestBody {
  email?: string
  password?: string
  username?: string
  phone?: string
  inviteCode?: string
  otp?: string
}

const signup = new Hono<{ Bindings: DataBaseEnvBindings }>()

function preprocessOptionalString(value: unknown) {
  if (typeof value !== 'string')
    return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const signupSchema = z.object({
  email: z.string()
    .trim()
    .min(1, '邮箱不能为空')
    .email('请输入有效的邮箱地址')
    .transform(val => val.toLowerCase()),
  password: z.string()
    .trim()
    .min(6, '密码长度至少为 6 位'),
  username: z.string()
    .trim()
    .min(2, '用户名长度至少为 2 位'),
  phone: z.preprocess(
    preprocessOptionalString,
    z.string().regex(/^\+?\d{6,15}$/, '手机号格式不正确').optional(),
  ),
  inviteCode: z.preprocess(
    preprocessOptionalString,
    z.string().optional(),
  ),
  otp: z.preprocess(
    preprocessOptionalString,
    z.string().regex(/^\d{4,8}$/, '验证码格式不正确').optional(),
  ),
}).superRefine((data, ctx) => {
  if (data.phone && !data.otp) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '手机号注册需要验证码',
      path: ['otp'],
    })
  }
})

signup.post('/', async (c) => {
  try {
    let payload: SignupRequestBody
    try {
      payload = await c.req.json<SignupRequestBody>()
    }
    catch {
      return c.json(createErrorResponse('请求体格式错误，应为 JSON', 400), 400)
    }

    const parsed = signupSchema.safeParse(payload)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return c.json(createErrorResponse(issue?.message || '参数校验失败', 400), 400)
    }

    const { email, password, username, phone, inviteCode, otp } = parsed.data

    const supabase = createSupabaseClient(c.env)

    if (phone) {
      const { error: otpError } = await supabase.auth.verifyOtp({
        phone,
        token: otp!,
        type: 'sms',
      })

      if (otpError)
        return c.json(createErrorResponse('验证码不正确或已过期', 400), 400)
    }

    const { data, error } = await supabase.rpc('register_user_with_invite', {
      p_email: email,
      p_password: password,
      p_username: username,
      p_phone: phone || null,
      p_invite_code: inviteCode || null,
    })

    if (error)
      return c.json(createErrorResponse(error.message || '注册失败', 500), 500)

    const result = data as { success?: boolean, message?: string, error?: string, user_id?: string, profile_id?: number } | null

    if (!result || result.success === false)
      return c.json(createErrorResponse(result?.error || '注册失败', 400), 400)

    return c.json(
      createSuccessResponse(
        {
          userId: result.user_id,
          profileId: result.profile_id,
          inviteCode: inviteCode || null,
        },
        result.message || '注册成功',
      ),
      201,
    )
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

export default signup
