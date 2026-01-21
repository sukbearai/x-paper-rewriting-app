import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import Home from '../page/Home.vue'
import SmsAuth from '../page/SmsAuth.vue'
import Proxy from '../page/Proxy.vue'
import UserCenter from '../page/UserCenter.vue'
import BalanceRecharge from '../page/BalanceRecharge.vue'
import Rewrite from '../page/Rewrite.vue'
import WordsCountStats from '../page/WordsCountStats.vue'

interface PersistedAuthState {
  accessToken?: string
  expiresAt?: number
  user?: {
    role?: string
  }
}

function readPersistedAuth(): PersistedAuthState | null {
  try {
    const raw = localStorage.getItem('auth')
    return raw ? JSON.parse(raw) : null
  }
  catch {
    return null
  }
}

function hasValidSession(auth: PersistedAuthState | null): boolean {
  if (!auth?.accessToken || !auth?.expiresAt)
    return false
  return Date.now() < auth.expiresAt
}

declare module 'vue-router' {
  interface RouteMeta {
    roles?: string[]
    fullScreen?: boolean
  }
}
const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { roles: ['user', 'admin', 'agent', 'guest'] },
  },
  {
    path: '/login',
    name: 'Login',
    component: SmsAuth,
    meta: { roles: ['user', 'admin', 'agent', 'guest'] },
  },
  {
    path: '/proxy',
    name: 'Proxy',
    component: Proxy,
    meta: { roles: ['admin', 'agent'] },
  },
  {
    path: '/userCenter',
    name: 'UserCenter',
    component: UserCenter,
    meta: { roles: ['user', 'admin', 'agent'] },
  },
  {
    path: '/balanceRecharge',
    name: 'BalanceRecharge',
    component: BalanceRecharge,
    meta: { roles: ['user', 'admin', 'agent'] },
  },
  {
    path: '/rewrite',
    name: 'Rewrite',
    component: Rewrite,
    meta: { roles: ['user', 'admin', 'agent'] },
  },
  {
    path: '/wordsCountStats',
    name: 'WordsCountStats',
    component: WordsCountStats,
    meta: { roles: ['user', 'admin', 'agent', 'guest'], fullScreen: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})
router.beforeEach((to, from, next) => {
  const authState = readPersistedAuth()
  const isLoggedIn = hasValidSession(authState)
  const userRole = authState?.user?.role || localStorage.getItem('userRole') || 'guest'
  const allowedRoles = (to.meta.roles as string[] | undefined) || []
  const allowsGuest = allowedRoles.includes('guest')

  // 如果要去登录页面，且已登录，重定向到首页
  if (to.name === 'Login' && isLoggedIn) {
    next({ name: 'Home' })
    return
  }

  // 如果未登录且不是登录页面，重定向到登录页
  if (!isLoggedIn && to.name !== 'Login' && !allowsGuest) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }

  // 已登录但无访问权限时退回首页
  if (allowedRoles.length && !allowedRoles.includes(userRole)) {
    next({ name: 'Home' })
    return
  }

  next()
})

export default router
