import { Webhook } from 'standardwebhooks'
import { Hono } from 'hono'
import { handle } from 'hono-alibaba-cloud-fc3-adapter'

// ---- Types -----------------------------------------------------------------

interface SmsEnvBindings {
  SUPABASE_HOOK_SECRET: string
  SECRET_ID: string
  SECRET_KEY: string
  TENCENT_SMS_SDK_APP_ID: string
  TENCENT_SMS_SIGN: string
  TENCENT_SMS_TEMPLATE_ID: string
  TENCENT_SMS_REGION?: string
  TENCENT_SMS_TOKEN?: string
  TENCENT_SMS_LANGUAGE?: string
}

// Supabase send-sms webhook (minimal shape we rely on)
interface SupabaseSmsWebhookEvent {
  user?: { phone?: string }
  sms?: { otp?: string }
  [k: string]: unknown
}

// Tencent SMS request payload (subset we construct)
interface TencentSmsPayload {
  SmsSdkAppId: string
  TemplateId: string
  PhoneNumberSet: string[]
  SignName?: string
  TemplateParamSet?: string[]
  ExtendCode?: string
  SessionContext?: string
  SenderId?: string
}

// Tencent SMS single send status item
interface TencentSendStatus {
  Code?: string
  Message?: string
  SerialNo?: string
  PhoneNumber?: string
  Fee?: number
  SessionContext?: string
}

// Tencent SMS API response (partial)
interface TencentSmsResponse {
  Response?: {
    SendStatusSet?: TencentSendStatus[]
    Error?: { Code?: string, Message?: string }
    RequestId?: string
  }
  [k: string]: unknown
}

// 开发调试接口 - 直接发送短信测试
interface DevSendSmsRequest {
  phone?: string
  code?: string
}

// ---- 工具函数 --------------------------------------------------------------

function createErrorResponse(message: string, code?: number, details?: unknown) {
  return {
    success: false,
    error: {
      code: code || 500,
      message,
      ...(details ? { details } : {})
    }
  }
}

function createSuccessResponse(data?: unknown, message?: string) {
  return {
    success: true,
    message: message || '操作成功',
    data
  }
}

function getEnvOrThrow(c: any, key: keyof SmsEnvBindings): string {
  const v = c.env?.[key]
  if (!v)
    throw new Error(`环境变量 ${String(key)} 未设置`)
  return v as string
}

function getEnvOptional(c: any, key: keyof SmsEnvBindings): string | undefined {
  const v = c.env?.[key]
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined
}

async function sha256Hex(str: string) {
  const encoder = new TextEncoder()
  return crypto.subtle.digest('SHA-256', encoder.encode(str)).then((buf) => {
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  })
}

async function hmac(key: ArrayBuffer | Uint8Array | string, data: string) {
  const enc = new TextEncoder()
  const rawKey = typeof key === 'string' ? enc.encode(key) : key instanceof Uint8Array ? key : new Uint8Array(key)
  const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
  return new Uint8Array(sig)
}

function toHex(u8: Uint8Array) {
  return Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ---- 腾讯云签名函数 --------------------------------------------------------

async function signTc3(secretId: string, secretKey: string, service: string, host: string, action: string, version: string, region: string, payload: TencentSmsPayload, contentType: string) {
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const httpRequestMethod = 'POST'
  const canonicalUri = '/'
  const canonicalQueryString = ''
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const body = JSON.stringify(payload)
  const hashedRequestPayload = await sha256Hex(body)
  const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`
  const algorithm = 'TC3-HMAC-SHA256'
  const credentialScope = `${date}/${service}/tc3_request`
  const hashedCanonicalRequest = await sha256Hex(canonicalRequest)
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`
  const secretDate = await hmac(`TC3${secretKey}`, date)
  const secretService = await hmac(secretDate, service)
  const secretSigning = await hmac(secretService, 'tc3_request')
  const signatureBytes = await hmac(secretSigning, stringToSign)
  const signature = toHex(signatureBytes)
  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  return { authorization, timestamp }
}

// ---- 腾讯云短信发送函数 ----------------------------------------------------

async function sendTencentSms(c: any, phone: string, code: string): Promise<TencentSmsResponse> {
  const SECRET_ID = getEnvOrThrow(c, 'SECRET_ID')
  const SECRET_KEY = getEnvOrThrow(c, 'SECRET_KEY')
  const SDK_APP_ID = getEnvOrThrow(c, 'TENCENT_SMS_SDK_APP_ID')
  const SIGN_NAME = getEnvOrThrow(c, 'TENCENT_SMS_SIGN')
  const TEMPLATE_ID = getEnvOrThrow(c, 'TENCENT_SMS_TEMPLATE_ID')

  const service = 'sms'
  const host = 'sms.tencentcloudapi.com'
  const action = 'SendSms'
  const version = '2021-01-11'
  const region = getEnvOptional(c, 'TENCENT_SMS_REGION') ?? 'ap-guangzhou'
  const sessionToken = getEnvOptional(c, 'TENCENT_SMS_TOKEN')
  const language = getEnvOptional(c, 'TENCENT_SMS_LANGUAGE')
  const contentType = 'application/json; charset=utf-8'

  // 腾讯要求 E.164 格式，例如 +8613711112222
  const phoneNumberSet = [/^1\d{10}$/.test(phone) ? `+86${phone}` : phone]

  const payload: TencentSmsPayload = {
    SmsSdkAppId: SDK_APP_ID,
    SignName: SIGN_NAME,
    TemplateId: TEMPLATE_ID,
    PhoneNumberSet: phoneNumberSet,
    TemplateParamSet: [code],
  }

  const { authorization, timestamp } = await signTc3(SECRET_ID, SECRET_KEY, service, host, action, version, region, payload, contentType)

  const resp = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'Host': host,
      'X-TC-Action': action,
      'X-TC-Version': version,
      'X-TC-Region': region,
      'X-TC-Timestamp': String(timestamp),
      'Authorization': authorization,
      ...(sessionToken ? { 'X-TC-Token': sessionToken } : {}),
      ...(language ? { 'X-TC-Language': language } : {}),
    },
    body: JSON.stringify(payload),
  })
  const data: TencentSmsResponse = await resp.json().catch(() => ({} as TencentSmsResponse))
  return data
}

// ---- 创建应用 ---------------------------------------------------------------

const app = new Hono()

// ---- 主要SMS接口 -----------------------------------------------------------

app.post('/', async (c) => {
  try {
    const rawBody = await c.req.text()
    const headers = Object.fromEntries(c.req.raw.headers.entries())

    const hookSecretRaw = getEnvOrThrow(c, 'SUPABASE_HOOK_SECRET')
    const base64Secret = hookSecretRaw.startsWith('v1,whsec_') ? hookSecretRaw.replace('v1,whsec_', '') : hookSecretRaw

    let event: SupabaseSmsWebhookEvent
    try {
      const wh = new Webhook(base64Secret)
      event = wh.verify(rawBody, headers) as SupabaseSmsWebhookEvent
    }
    catch {
      return c.json(createErrorResponse('Webhook 签名校验失败', 401), 401)
    }

    const phone = event?.user?.phone
    const code = event?.sms?.otp
    if (!phone || !code)
      return c.json(createErrorResponse('缺少 phone 或 otp', 400), 400)
    if (!/^1\d{10}$/.test(phone) && !/^\+\d{6,15}$/.test(phone))
      return c.json(createErrorResponse('手机号格式不正确', 400), 400)
    if (!/^\d{1,6}$/.test(code))
      return c.json(createErrorResponse('验证码格式不正确，需为 1-6 位数字', 400), 400)

    const result = await sendTencentSms(c, phone, code)

    const status = result?.Response?.SendStatusSet?.[0]
    if (status?.Code === 'Ok') {
      return c.json({})
    }

    const errorMessage = status?.Message || result?.Response?.Error?.Message || '短信发送失败'
    return c.json(createErrorResponse(errorMessage, 500, { requestId: result?.Response?.RequestId, tencentResult: result }), 500)
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

// ---- 开发调试接口 -----------------------------------------------------------

app.post('/dev', async (c) => {
  try {
    let payload: DevSendSmsRequest
    try {
      payload = await c.req.json<DevSendSmsRequest>()
    }
    catch {
      return c.json(createErrorResponse('请求体格式错误，应为 JSON', 400), 400)
    }

    const phone = payload?.phone?.trim()
    const code = payload?.code?.trim()

    if (!phone || !code)
      return c.json(createErrorResponse('缺少 phone 或 code 参数', 400), 400)

    if (!/^1\d{10}$/.test(phone) && !/^\+\d{6,15}$/.test(phone))
      return c.json(createErrorResponse('手机号格式不正确', 400), 400)

    if (!/^\d{1,6}$/.test(code))
      return c.json(createErrorResponse('验证码格式不正确，需为 1-6 位数字', 400), 400)

    const result = await sendTencentSms(c, phone, code)

    const status = result?.Response?.SendStatusSet?.[0]
    if (status?.Code === 'Ok') {
      return c.json(createSuccessResponse({ phone, code, serialNo: status.SerialNo, requestId: result?.Response?.RequestId }, '短信发送成功'))
    }

    const errorMessage = status?.Message || result?.Response?.Error?.Message || '短信发送失败'
    return c.json(createErrorResponse(errorMessage, 500, { requestId: result?.Response?.RequestId, tencentResult: result }), 500)
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return c.json(createErrorResponse(message || '服务器内部错误', 500), 500)
  }
})

app.get('/', c => c.text('Hello fc3 with SMS!'))

export const handler = handle(app)