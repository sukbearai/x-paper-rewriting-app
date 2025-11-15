import { Hono } from 'hono'
import { createErrorResponse, createSuccessResponse } from '@/utils/response'
import {
  createR2Client,
  createR2ObjectKey,
  resolveR2Config,
  uploadR2Object,
} from '@/utils/r2'
import type { R2EnvBindings, R2ResolvedConfig } from '@/utils/r2'

const storage = new Hono<{ Bindings: R2EnvBindings }>()

let cachedClient: ReturnType<typeof createR2Client> | null = null
let cachedConfig: R2ResolvedConfig | null = null
let cachedSignature: string | null = null

function ensureClient(env: R2EnvBindings) {
  const resolved = resolveR2Config(env)
  const signature = JSON.stringify(resolved)

  if (!cachedClient || !cachedConfig || cachedSignature !== signature) {
    cachedClient = createR2Client(resolved)
    cachedConfig = resolved
    cachedSignature = signature
  }

  if (!cachedClient || !cachedConfig) {
    throw new Error('R2 客户端初始化失败')
  }

  return { client: cachedClient, config: cachedConfig }
}

storage.get('/health', (c) => {
  try {
    const { config } = ensureClient(c.env)

    return c.json(createSuccessResponse({
      endpoint: config.endpoint,
      bucket: config.bucket,
    }, 'R2 配置正常'))
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'R2 配置错误'
    return c.json(createErrorResponse(message, 500), 500)
  }
})

storage.post('/test-upload', async (c) => {
  try {
    const { client, config } = ensureClient(c.env)
    const body = await c.req.parseBody()
    const candidate = body.file
    const file = Array.isArray(candidate) ? candidate[0] : candidate

    if (!(file instanceof File)) {
      return c.json(createErrorResponse('缺少文件或文件格式错误', 400), 400)
    }

    const key = createR2ObjectKey(file.name, { prefix: 'test' })
    const arrayBuffer = await file.arrayBuffer()

    await uploadR2Object(client, {
      bucket: config.bucket,
      key,
      body: new Uint8Array(arrayBuffer),
      contentType: file.type || 'application/octet-stream',
    })

    return c.json(createSuccessResponse({
      bucket: config.bucket,
      key,
      size: file.size,
      type: file.type,
    }, '测试上传成功'))
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '上传失败'
    return c.json(createErrorResponse(message, 500), 500)
  }
})

export default storage
