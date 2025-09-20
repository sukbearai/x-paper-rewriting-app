import { createClient } from '@supabase/supabase-js'

export interface EnvConfig {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
}

export function createSupabaseClient(env: EnvConfig, access_token?: string) {
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
