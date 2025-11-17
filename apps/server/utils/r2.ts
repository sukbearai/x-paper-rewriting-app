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

  const payload = normalizeBody(params.body)

  await client.putObject(
    normalizedKey,
    payload as Parameters<S3mini['putObject']>[1],
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

function normalizeBody(body: string | ArrayBuffer | ArrayBufferView): string | ArrayBufferView {
  if (typeof body === 'string')
    return body

  const bufferCtor = ensureBufferAlias()

  if (isNodeBufferConstructor(bufferCtor)) {
    if (body instanceof ArrayBuffer)
      return bufferCtor.from(body)
    if (ArrayBuffer.isView(body))
      return bufferCtor.from(body.buffer, body.byteOffset, body.byteLength)
  }

  if (body instanceof ArrayBuffer)
    return new Uint8Array(body)

  if (ArrayBuffer.isView(body))
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength)

  throw new Error('[r2] Unsupported body type, expected string, ArrayBuffer, or ArrayBufferView')
}

type BufferCtorCandidate = typeof Uint8Array | BufferConstructor

function ensureBufferAlias(): BufferCtorCandidate {
  const existing = Reflect.get(globalThis, 'Buffer') as BufferCtorCandidate | undefined
  if (existing)
    return existing

  Reflect.set(globalThis, 'Buffer', Uint8Array)
  return Uint8Array
}

function isNodeBufferConstructor(candidate: BufferCtorCandidate | undefined): candidate is BufferConstructor {
  return typeof candidate === 'function'
    && candidate !== Uint8Array
    && typeof (candidate as BufferConstructor).from === 'function'
    && typeof (candidate as BufferConstructor).isBuffer === 'function'
}
