import { Hono } from 'hono'
import { createErrorResponse, createSuccessResponse } from '@/utils/response'
import {
  createPublicUrl,
  createR2Client,
  createR2ObjectKey,
  resolveR2Config,
  uploadR2Object,
} from '@/utils/r2'
import type { R2EnvBindings, R2ResolvedConfig } from '@/utils/r2'

const upload = new Hono<{ Bindings: R2EnvBindings }>()

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

upload.post('/', async (c) => {
  try {
    const { client, config } = ensureClient(c.env)
    const body = await c.req.parseBody()
    const candidate = body.file
    const file = Array.isArray(candidate) ? candidate[0] : candidate

    if (!file || typeof file === 'string') {
      return c.json(createErrorResponse('缺少文件或文件格式错误', 400), 400)
    }

    // 检查文件对象是否具有必要的属性
    if (!('name' in file && 'size' in file && 'type' in file)) {
      return c.json(createErrorResponse('文件对象格式错误', 400), 400)
    }

    // 获取文件内容，保持原始格式
    let fileBuffer: ArrayBuffer
    if ('arrayBuffer' in file && typeof file.arrayBuffer === 'function') {
      fileBuffer = await file.arrayBuffer()
    }
    else if ('stream' in file && typeof file.stream === 'function') {
      const reader = file.stream().getReader()
      const chunks: Uint8Array[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done)
          break
        chunks.push(value)
      }
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const result = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }
      fileBuffer = result.buffer
    }
    else {
      return c.json(createErrorResponse('不支持的文件格式', 400), 400)
    }

    const key = createR2ObjectKey(file.name as string, { prefix: 'test' })
    const publicUrl = createPublicUrl(config, key)

    await uploadR2Object(client, {
      bucket: config.bucket,
      key,
      body: fileBuffer,
      contentType: file.type as string || 'application/octet-stream',
    })

    return c.json(createSuccessResponse({
      bucket: config.bucket,
      key,
      size: file.size as number,
      type: file.type as string,
      url: publicUrl,
    }, '上传成功'))
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '上传失败'
    return c.json(createErrorResponse(message, 500), 500)
  }
})

export default upload
