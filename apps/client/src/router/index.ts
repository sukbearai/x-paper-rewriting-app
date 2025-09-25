import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import Home from '../page/Home.vue'
import SmsAuth from '../page/SmsAuth.vue'
import Proxy from '../page/Proxy.vue'
import UserCenter from '../page/UserCenter.vue'
import BalanceRecharge from '../page/BalanceRecharge.vue'

declare module 'vue-router' {
  interface RouteMeta {
    roles?: string[]
  }
}
const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { roles: ['user', 'admin', 'guest'] },
  },
  {
    path: '/login',
    name: 'Login',
    component: SmsAuth,
    meta: { roles: ['guest'] },
  },
  {
    path: '/proxy',
    name: 'Proxy',
    component: Proxy,
    meta: { roles: ['user', 'admin', 'guest'] },
  },
  {
    path: '/userCenter',
    name: 'UserCenter',
    component: UserCenter,
    meta: { roles: ['user', 'admin', 'guest'] },
  },
  {
    path: '/balanceRecharge',
    name: 'BalanceRecharge',
    component: BalanceRecharge,
    meta: { roles: ['user', 'admin', 'guest'] },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})
router.beforeEach((to, from, next) => {
  const userRole = localStorage.getItem('userRole') || 'guest' // 默认为访客

  if (to.meta.roles && !to.meta.roles.includes(userRole)) {
    next({ name: 'Home' }) // 如果没有权限，重定向到首页
  }
  else {
    next()
  }
})

export default router
