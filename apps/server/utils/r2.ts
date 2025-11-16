import { S3mini } from 's3mini'
import type { S3Config } from 's3mini'

export interface R2EnvBindings {
  R2_ENDPOINT?: string
  R2_ACCOUNT_ID?: string
  R2_BUCKET_NAME?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  S3_API?: string
  S3_BUCKET_NAME?: string
  S3_ACCESS_ID?: string
  S3_ACCESS_KEY?: string
}

export interface R2ResolvedConfig {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

interface ParseS3ApiResult {
  endpoint: string
  bucket?: string
}

function parseS3Api(value: string): ParseS3ApiResult | null {
  try {
    const url = new URL(value)
    const bucketFromPath = url.pathname.replace(/^\/+/, '').split('/')[0]

    return {
      endpoint: `${url.protocol}//${url.host}`,
      bucket: bucketFromPath || undefined,
    }
  }
  catch (error) {
    console.warn('[r2] Unable to parse S3_API value:', error)
    return null
  }
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
  const bucketFromEnv = readEnvString(source, 'R2_BUCKET_NAME') ?? readEnvString(source, 'S3_BUCKET_NAME')
  const accessKeyId = readEnvString(source, 'R2_ACCESS_KEY_ID') ?? readEnvString(source, 'S3_ACCESS_ID')
  const secretAccessKey = readEnvString(source, 'R2_SECRET_ACCESS_KEY') ?? readEnvString(source, 'S3_ACCESS_KEY')
  const s3ApiValue = readEnvString(source, 'S3_API')

  let endpoint = directEndpoint
  let bucket = bucketFromEnv

  if (!endpoint && s3ApiValue) {
    const parsed = parseS3Api(s3ApiValue)
    if (parsed) {
      endpoint = parsed.endpoint
      bucket = bucket ?? parsed.bucket
    }
  }

  if (!endpoint && accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`
  }

  const missing: string[] = []

  if (!endpoint)
    missing.push('R2_ENDPOINT or R2_ACCOUNT_ID or S3_API')
  if (!bucket)
    missing.push('R2_BUCKET_NAME or S3_BUCKET_NAME or S3_API path')
  if (!accessKeyId)
    missing.push('R2_ACCESS_KEY_ID or S3_ACCESS_ID')
  if (!secretAccessKey)
    missing.push('R2_SECRET_ACCESS_KEY or S3_ACCESS_KEY')

  if (missing.length > 0) {
    throw new Error(`[r2] Missing environment configuration: ${missing.join(', ')}`)
  }

  return {
    endpoint: endpoint!,
    bucket: bucket!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
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
  const payload = normalizeUploadBody(params.body)
  const headerCandidate = buildAdditionalHeaders(params)
  const headers = Object.keys(headerCandidate).length > 0 ? headerCandidate : undefined

  await client.putObject(
    normalizedKey,
    payload,
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

function normalizeUploadBody(body: UploadR2ObjectParams['body']): string | Uint8Array {
  if (typeof body === 'string')
    return body
  if (body instanceof ArrayBuffer)
    return new Uint8Array(body)
  if (ArrayBuffer.isView(body))
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength)

  throw new TypeError('[r2] Unsupported upload body type')
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
