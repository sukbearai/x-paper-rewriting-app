import { createClient } from '@supabase/supabase-js'

export interface DataBaseEnvBindings {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

export function createSupabaseClient(env: DataBaseEnvBindings, access_token?: string) {
  return createClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: access_token
          ? {
              Authorization: `Bearer ${access_token}`,
            }
          : {},
      },
    },
  )
}

export function createSupabaseAdminClient(env: DataBaseEnvBindings) {
  return createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  )
}

export const cookieOptions = {
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
  secure: true,
  sameSite: 'lax',
  httpOnly: false,
}
