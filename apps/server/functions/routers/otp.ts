import { Hono } from 'hono'
import { z } from 'zod'
import { createErrorResponse, createSuccessResponse } from '@/utils/response'
import type { DataBaseEnvBindings } from '@/utils/db'
import { createSupabaseClient } from '@/utils/db'

type OtpPurpose = 'signup' | 'login'

interface SendOtpRequestBody {
  phone?: string
  purpose?: OtpPurpose
}

const otpRouter = new Hono<{ Bindings: DataBaseEnvBindings }>()

const sendOtpSchema = z.object({
  phone: z.string()
    .trim()
    .regex(/^\+?\d{6,15}$/, '手机号格式不正确'),
  purpose: z.enum(['signup', 'login']).default('signup'),
})

otpRouter.post('/', async (c) => {
  try {
    let payload: SendOtpRequestBody
    try {
      payload = await c.req.json<SendOtpRequestBody>()
    }
    catch {
      return c.json(createErrorResponse('请求体格式错误，应为 JSON', 400), 400)
    }

    const parsed = sendOtpSchema.safeParse(payload)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return c.json(createErrorResponse(issue?.message || '参数校验失败', 400), 400)
    }

    const { phone, purpose } = parsed.data
    const supabase = createSupabaseClient(c.env)

    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    if (profileError)
      return c.json(createErrorResponse(profileError.message || '验证码发送失败', 500), 500)

    if (purpose === 'signup' && existingProfile)
      return c.json(createErrorResponse('该手机号已注册，请直接登录', 409), 409)

    if (purpose === 'login' && !existingProfile)
      return c.json(createErrorResponse('该手机号尚未注册', 404), 404)

    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        channel: 'sms',
        // 登录时也需设置为 true 以绕过 Supabase "Signups not allowed" 的检查，
        // 但由于我们有前置的用户存在性判断，这不会导致重复注册。
        shouldCreateUser: true,
      },
    })

    if (error)
      return c.json(createErrorResponse(error.message || '验证码发送失败', 400), 400)

    return c.json(createSuccessResponse(null, '验证码发送成功'))
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

export default otpRouter
