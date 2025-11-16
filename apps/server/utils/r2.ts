import { S3mini } from 's3mini'
import type { S3Config } from 's3mini'

export interface R2EnvBindings {
  R2_ENDPOINT?: string
  R2_ACCOUNT_ID?: string
  R2_BUCKET_NAME?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_PUBLIC_URL?: string
}

export interface R2ResolvedConfig {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicUrl?: string
}

function readEnvString(source: Record<string, unknown>, key: keyof R2EnvBindings): string | undefined {
  const raw = source[key]
  if (typeof raw !== 'string') {
    return undefined
  }

  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function resolveR2Config(env: R2EnvBindings | Record<string, unknown>): R2ResolvedConfig {
  const source = env as Record<string, unknown>

  const directEndpoint = readEnvString(source, 'R2_ENDPOINT')
  const accountId = readEnvString(source, 'R2_ACCOUNT_ID')
  const bucketName = readEnvString(source, 'R2_BUCKET_NAME')
  const accessKeyId = readEnvString(source, 'R2_ACCESS_KEY_ID')
  const secretAccessKey = readEnvString(source, 'R2_SECRET_ACCESS_KEY')
  const publicUrl = readEnvString(source, 'R2_PUBLIC_URL')

  let endpoint = directEndpoint

  if (!endpoint && accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`
  }

  const missing: string[] = []

  if (!endpoint)
    missing.push('R2_ENDPOINT or R2_ACCOUNT_ID')
  if (!bucketName)
    missing.push('R2_BUCKET_NAME')
  if (!accessKeyId)
    missing.push('R2_ACCESS_KEY_ID')
  if (!secretAccessKey)
    missing.push('R2_SECRET_ACCESS_KEY')

  if (missing.length > 0) {
    throw new Error(`[r2] Missing environment configuration: ${missing.join(', ')}`)
  }

  return {
    endpoint: endpoint!,
    bucket: bucketName!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    publicUrl,
  }
}

export function createR2Client(config: R2ResolvedConfig, overrides: Partial<S3Config> = {}): S3mini {
  const {
    endpoint: endpointOverride,
    accessKeyId: overrideAccessKeyId,
    secretAccessKey: overrideSecretAccessKey,
    region,
    requestSizeInBytes,
    requestAbortTimeout,
    logger,
  } = overrides

  const endpointWithBucket = endpointOverride ?? ensureBucketInEndpoint(config.endpoint, config.bucket)

  const clientConfig: S3Config = {
    accessKeyId: overrideAccessKeyId ?? config.accessKeyId,
    secretAccessKey: overrideSecretAccessKey ?? config.secretAccessKey,
    endpoint: endpointWithBucket,
    region: region ?? 'auto',
    ...(typeof requestSizeInBytes === 'number' ? { requestSizeInBytes } : {}),
    ...(typeof requestAbortTimeout === 'number' ? { requestAbortTimeout } : {}),
    ...(logger ? { logger } : {}),
  }

  return new S3mini(clientConfig)
}

export interface UploadR2ObjectParams {
  bucket: string
  key: string
  body: string | ArrayBuffer | ArrayBufferView
  contentType?: string
  cacheControl?: string
  metadata?: Record<string, string>
}

export async function uploadR2Object(client: S3mini, params: UploadR2ObjectParams): Promise<{ key: string }> {
  const normalizedKey = params.key.replace(/^\/+/, '')
  const headerCandidate = buildAdditionalHeaders(params)
  const headers = Object.keys(headerCandidate).length > 0 ? headerCandidate : undefined

  // 在 Cloudflare Functions 中创建一个 Buffer-like 对象
  let data: Uint8Array
  if (typeof params.body === 'string') {
    data = new TextEncoder().encode(params.body)
  } else if (params.body instanceof ArrayBuffer) {
    data = new Uint8Array(params.body)
  } else {
    data = new Uint8Array(params.body.buffer, params.body.byteOffset, params.byteLength)
  }

  // 创建一个类似 Buffer 的对象
  const bufferLike = {
    buffer: data.buffer,
    byteOffset: data.byteOffset,
    byteLength: data.byteLength,
    length: data.length,
    [Symbol.iterator]: () => data[Symbol.iterator](),
    slice: (begin?: number, end?: number) => data.slice(begin, end),
    subarray: (begin?: number, end?: number) => data.subarray(begin, end),
    // 添加 toString 方法，根据内容类型决定处理方式
    toString: () => {
      // 检查是否是文本内容类型
      const contentType = params.contentType ?? 'application/octet-stream'
      const isTextType = contentType.startsWith('text/') ||
                       contentType.includes('json') ||
                       contentType.includes('xml') ||
                       contentType.includes('javascript') ||
                       contentType.includes('css')

      if (isTextType) {
        // 文本内容直接返回字符串
        return new TextDecoder().decode(data)
      } else {
        // 二进制内容使用 base64 编码
        if (typeof btoa !== 'undefined') {
          const binaryString = Array.from(data, byte => String.fromCharCode(byte)).join('')
          return btoa(binaryString)
        }
        // 如果没有 btoa，fallback 到原始字符串（可能会损坏二进制数据）
        return new TextDecoder().decode(data)
      }
    }
  } as any

  await client.putObject(
    normalizedKey,
    bufferLike,
    params.contentType ?? 'application/octet-stream',
    undefined,
    headers as Parameters<S3mini['putObject']>[4],
  )

  return { key: normalizedKey }
}

export interface CreateObjectKeyOptions {
  prefix?: string
}

export function createR2ObjectKey(filename: string, options: CreateObjectKeyOptions = {}): string {
  const safeFilename = filename
    .split('/')
    .pop()
    ?.replace(/[^\w.-]/g, '-')
    || 'object'

  const prefix = options.prefix ? `${options.prefix.replace(/\/+$/, '')}/` : ''
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

  return `${prefix}${unique}-${safeFilename}`
}

export function createPublicUrl(config: R2ResolvedConfig, key: string): string | null {
  if (!config.publicUrl) {
    return null
  }

  const normalizedKey = key.replace(/^\/+/, '')
  const baseUrl = config.publicUrl.replace(/\/+$/, '')

  return `${baseUrl}/${normalizedKey}`
}

function ensureBucketInEndpoint(endpoint: string, bucket: string): string {
  const normalizedBucket = bucket.trim().replace(/^\/+/g, '').replace(/\/+$/g, '')
  if (!normalizedBucket)
    return endpoint.replace(/\/+$/g, '')

  try {
    const url = new URL(endpoint)
    const bucketLower = normalizedBucket.toLowerCase()
    const hostParts = url.hostname.split('.')
    const bucketInHost = hostParts.some(part => part?.toLowerCase() === bucketLower)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    const bucketInPath = pathSegments.some(segment => segment.toLowerCase() === bucketLower)

    if (!bucketInHost && !bucketInPath) {
      const trimmedPath = url.pathname.replace(/\/+$|^\/+/g, '')
      url.pathname = trimmedPath ? `/${trimmedPath}/${normalizedBucket}` : `/${normalizedBucket}`
    }

    return url.toString().replace(/\/+$/g, '')
  }
  catch {
    const trimmedEndpoint = endpoint.replace(/\/+$/g, '')
    return `${trimmedEndpoint}/${normalizedBucket}`
  }
}

function buildAdditionalHeaders(params: Pick<UploadR2ObjectParams, 'cacheControl' | 'metadata'>): Record<string, string> {
  const headers: Record<string, string> = {}

  if (params.cacheControl)
    headers['cache-control'] = params.cacheControl

  if (params.metadata) {
    for (const [key, value] of Object.entries(params.metadata)) {
      if (typeof value !== 'string')
        continue

      const safeKey = key
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')

      if (!safeKey)
        continue

      headers[`x-amz-meta-${safeKey}`] = value
    }
  }

  return headers
}
