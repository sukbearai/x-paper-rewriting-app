import { createMiddleware } from 'hono/factory'
import { createErrorResponse } from '@/utils/response'
import type { KVNamespace } from '@/functions/env'

export interface Variables {
  cheeyuanToken: string
  reduceAiToken: string
}

interface StoredTokenPayload {
  token: string
  expiresAt: string
}

interface TokenSource {
  kvKey: string
  contextKey: 'cheeyuanToken' | 'reduceAiToken'
  login: () => Promise<string>
}

interface ExternalTokenEnvConfig {
  cheeyuanApiUrl: string
  cheeyuanAccount: string
  cheeyuanPassword: string
  reduceAiApiUrl: string
  reduceAiUsername: string
  reduceAiPassword: string
}

type ExternalTokenEnvKey =
  | 'CHEEYUAN_API_URL'
  | 'CHEEYUAN_LOGIN_ACCOUNT'
  | 'CHEEYUAN_LOGIN_PASSWORD'
  | 'REDUCEAI_API_URL'
  | 'REDUCEAI_LOGIN_USERNAME'
  | 'REDUCEAI_LOGIN_PASSWORD'

const EIGHT_HOURS_IN_MS = 8 * 60 * 60 * 1000
const CHEEYUAN_LOGIN_PATH = 'user/login'
const REDUCEAI_LOGIN_PATH = 'auth/login'

async function readTokenFromKV(kv: KVNamespace, key: string): Promise<StoredTokenPayload | null> {
  const raw = await kv.get(key, { type: 'text' }) as string | null

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as StoredTokenPayload

    if (!parsed.token || !parsed.expiresAt) {
      return null
    }

    return parsed
  }
  catch (error) {
    console.warn(`[token-middleware] Failed to parse KV payload for ${key}:`, error)
    return null
  }
}

async function writeTokenToKV(kv: KVNamespace, key: string, token: string): Promise<StoredTokenPayload> {
  const payload: StoredTokenPayload = {
    token,
    expiresAt: new Date(Date.now() + EIGHT_HOURS_IN_MS).toISOString(),
  }

  await kv.put(key, JSON.stringify(payload))

  return payload
}

function isTokenExpired(payload: StoredTokenPayload | null): boolean {
  if (!payload) {
    return true
  }

  const expiresAt = Number(new Date(payload.expiresAt))

  return Number.isNaN(expiresAt) || Date.now() >= expiresAt
}

function readEnvString(source: Record<string, unknown>, key: ExternalTokenEnvKey): string | undefined {
  const value = source[key]
  return typeof value === 'string' && value.length > 0
    ? value
    : undefined
}

function resolveExternalTokenEnv(source: Record<string, unknown>):
  | { ok: true, config: ExternalTokenEnvConfig }
  | { ok: false, missing: ExternalTokenEnvKey[] } {
  const raw = {
    CHEEYUAN_API_URL: readEnvString(source, 'CHEEYUAN_API_URL'),
    CHEEYUAN_LOGIN_ACCOUNT: readEnvString(source, 'CHEEYUAN_LOGIN_ACCOUNT'),
    CHEEYUAN_LOGIN_PASSWORD: readEnvString(source, 'CHEEYUAN_LOGIN_PASSWORD'),
    REDUCEAI_API_URL: readEnvString(source, 'REDUCEAI_API_URL'),
    REDUCEAI_LOGIN_USERNAME: readEnvString(source, 'REDUCEAI_LOGIN_USERNAME'),
    REDUCEAI_LOGIN_PASSWORD: readEnvString(source, 'REDUCEAI_LOGIN_PASSWORD'),
  }

  const missing = (Object.entries(raw) as Array<[ExternalTokenEnvKey, string | undefined]>)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    return { ok: false, missing }
  }

  return {
    ok: true,
    config: {
      cheeyuanApiUrl: raw.CHEEYUAN_API_URL!,
      cheeyuanAccount: raw.CHEEYUAN_LOGIN_ACCOUNT!,
      cheeyuanPassword: raw.CHEEYUAN_LOGIN_PASSWORD!,
      reduceAiApiUrl: raw.REDUCEAI_API_URL!,
      reduceAiUsername: raw.REDUCEAI_LOGIN_USERNAME!,
      reduceAiPassword: raw.REDUCEAI_LOGIN_PASSWORD!,
    },
  }
}

function buildEndpoint(base: string, path: string): string {
  const trimmedBase = base.endsWith('/') ? base : `${base}/`
  const normalizedPath = path.replace(/^\/+/, '')
  return new URL(normalizedPath, trimmedBase).toString()
}

function createTokenSources(config: ExternalTokenEnvConfig): TokenSource[] {
  const cheeyuanLoginUrl = buildEndpoint(config.cheeyuanApiUrl, CHEEYUAN_LOGIN_PATH)
  const reduceAiLoginUrl = buildEndpoint(config.reduceAiApiUrl, REDUCEAI_LOGIN_PATH)

  return [
    {
      kvKey: 'external-token:cheeyuan',
      contextKey: 'cheeyuanToken',
      login: async () => {
        const response = await fetch(cheeyuanLoginUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account: config.cheeyuanAccount,
            password: config.cheeyuanPassword,
          }),
        })

        if (!response.ok) {
          throw new Error(`CheeYuan login failed (${response.status} ${response.statusText})`)
        }

        const result = await response.json() as {
          code?: number
          message?: string
          data?: { token?: string }
        }

        const token = result?.data?.token

        if (!token) {
          throw new Error(`CheeYuan login succeeded without token: ${JSON.stringify(result)}`)
        }

        return token
      },
    },
    {
      kvKey: 'external-token:reduceai',
      contextKey: 'reduceAiToken',
      login: async () => {
        const response = await fetch(reduceAiLoginUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: config.reduceAiUsername,
            password: config.reduceAiPassword,
          }),
        })

        if (!response.ok) {
          throw new Error(`ReduceAI login failed (${response.status} ${response.statusText})`)
        }

        const result = await response.json() as {
          token?: string
        }

        if (!result?.token) {
          throw new Error(`ReduceAI login succeeded without token: ${JSON.stringify(result)}`)
        }

        return result.token
      },
    },
  ]
}

export const externalTokenMiddleware = createMiddleware<{
  Variables: Variables
}>(async (c, next) => {
  const envResult = resolveExternalTokenEnv(c.env as Record<string, unknown>)

  if (!envResult.ok) {
    console.error('[token-middleware] Missing environment variables:', envResult.missing.join(', '))
    return c.json(createErrorResponse('外部服务配置缺失，请联系管理员', 500), 500)
  }

  const sources = createTokenSources(envResult.config)
  const kv = await paper_rewriting_kv

  for (const source of sources) {
    const cached = await readTokenFromKV(kv, source.kvKey)
    const expired = isTokenExpired(cached)

    let tokenPayload = cached

    if (expired) {
      try {
        const freshToken = await source.login()
        tokenPayload = await writeTokenToKV(kv, source.kvKey, freshToken)
      }
      catch (error) {
        console.error(`[token-middleware] Failed to refresh token for ${source.kvKey}:`, error)
        return c.json(createErrorResponse('外部服务登录失败，请稍后重试', 500), 500)
      }
    }

    if (!tokenPayload) {
      console.error(`[token-middleware] Missing token payload after refresh for ${source.kvKey}`)
      return c.json(createErrorResponse('外部服务登录状态异常', 500), 500)
    }

    c.set(source.contextKey, tokenPayload.token)
  }

  await next()
})
