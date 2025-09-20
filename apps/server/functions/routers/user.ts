import { Hono } from 'hono'
import { createErrorResponse, createSuccessResponse } from '@/utils/response'
import type { EnvConfig } from '@/utils/db'
import { createSupabaseClient } from '@/utils/db'

const user = new Hono<{ Bindings: EnvConfig }>()

user.get('/', async (c) => {
  try {
    const supabase = createSupabaseClient(c.env)
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) {
      return c.json(createErrorResponse(error.message, 400), 400)
    }
    return c.json(createSuccessResponse(data, '获取成功'))
  }
  catch (err: any) {
    const message = err?.message || '服务器内部错误'
    return c.json(createErrorResponse(message, 500), 500)
  }
})

export default user
