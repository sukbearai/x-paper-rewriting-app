import { Hono } from 'hono'
import type { EnvConfig } from '@/utils/db'
import { createSupabaseClient } from '@/utils/db'

const user = new Hono<{ Bindings: EnvConfig }>()

user.post('/', async (c) => {
//   const body = await c.req.parseBody()
  const supabase = createSupabaseClient(c.env)
  const { data, error } = await supabase.from('profiles').select('*')
  if (error) {
    return c.json({ error: error.message }, 400)
  }
  return c.json(data)
})

export default user
