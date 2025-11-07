import { createMiddleware } from 'hono/factory'
import { createErrorResponse } from '@/utils/response'
import { createSupabaseClient } from '@/utils/db'
import type { DataBaseEnvBindings } from '@/utils/db'

// 用户认证后的上下文变量
export interface AuthVariables {
  userId: string
  username: string
  email: string
  role: string
}

/**
 * JWT认证中间件
 * 验证用户的访问令牌是否有效
 */
export const authMiddleware = createMiddleware<{
  Bindings: DataBaseEnvBindings
  Variables: AuthVariables
}>(async (c, next) => {
  // 获取Authorization头
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(createErrorResponse('缺少访问令牌', 401), 401)
  }

  const accessToken = authHeader.replace('Bearer ', '')

  if (!accessToken) {
    return c.json(createErrorResponse('访问令牌格式错误', 401), 401)
  }

  try {
    // 使用Supabase验证JWT令牌
    const supabase = createSupabaseClient(c.env, accessToken)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      console.error('[auth-middleware] Token validation failed:', error)
      return c.json(createErrorResponse('访问令牌无效', 401), 401)
    }

    // 检查用户是否被禁用（如果用户表有status字段的话）
    // 这里可以根据需要添加额外的用户状态检查

    // 将用户信息设置到上下文中
    c.set('userId', user.id)
    c.set('username', user.user_metadata?.username || user.email?.split('@')[0] || '')
    c.set('email', user.email || '')
    c.set('role', user.user_metadata?.role || 'user')

    await next()
  } catch (err) {
    console.error('[auth-middleware] Authentication error:', err)
    return c.json(createErrorResponse('认证失败', 401), 401)
  }
})

/**
 * 可选的JWT认证中间件
 * 如果提供了令牌则验证，否则继续执行（用于可选认证的接口）
 */
export const optionalAuthMiddleware = createMiddleware<{
  Bindings: DataBaseEnvBindings
  Variables: AuthVariables
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 没有提供令牌，继续执行但不设置用户信息
    await next()
    return
  }

  const accessToken = authHeader.replace('Bearer ', '')

  if (!accessToken) {
    await next()
    return
  }

  try {
    const supabase = createSupabaseClient(c.env, accessToken)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      console.warn('[optional-auth-middleware] Invalid token provided:', error)
      // 令牌无效但继续执行（可选认证）
      await next()
      return
    }

    // 设置用户信息
    c.set('userId', user.id)
    c.set('username', user.user_metadata?.username || user.email?.split('@')[0] || '')
    c.set('email', user.email || '')
    c.set('role', user.user_metadata?.role || 'user')

    await next()
  } catch (err) {
    console.warn('[optional-auth-middleware] Authentication error:', err)
    // 认证出错但继续执行（可选认证）
    await next()
  }
})