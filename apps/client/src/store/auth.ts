import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  ChangePasswordParams,
  LoginResponse,
  LoginUser,
  LoginWithOtpParams,
  LoginWithPasswordParams,
  PointsResponse,
  RegisterParams,
} from '@/api/interface'
import {
  changePassword as changePasswordApi,
  loginWithOtp,
  loginWithPassword,
  logout as logoutApi,
  queryPoints,
  registerUser,
} from '@/api/services'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref('')
  const refreshToken = ref('')
  const expiresAt = ref(0)
  const user = ref<LoginUser | null>(null)
  const points = ref<number | null>(null)
  const pointsMeta = ref<PointsResponse | null>(null)

  const isAuthenticated = computed(() => {
    if (!accessToken.value || !expiresAt.value)
      return false
    return Date.now() < expiresAt.value
  })

  const displayName = computed(() => user.value?.username || user.value?.phone || '')

  function applySession(payload: LoginResponse) {
    accessToken.value = payload.session.access_token
    refreshToken.value = payload.session.refresh_token
    expiresAt.value = payload.session.expires_at ? payload.session.expires_at * 1000 : 0
    user.value = payload.user
    points.value = payload.user?.points_balance ?? null
    pointsMeta.value = null
    localStorage.setItem('userRole', payload.user?.role || 'user')
  }

  function clearSession() {
    accessToken.value = ''
    refreshToken.value = ''
    expiresAt.value = 0
    user.value = null
    points.value = null
    pointsMeta.value = null
    localStorage.setItem('userRole', 'guest')
  }

  async function loginByPassword(params: LoginWithPasswordParams) {
    const response = await loginWithPassword(params)
    applySession(response)
    return response
  }

  async function loginByOtp(params: LoginWithOtpParams) {
    const response = await loginWithOtp(params)
    applySession(response)
    return response
  }

  async function registerAccount(params: RegisterParams) {
    return registerUser(params)
  }

  async function logout() {
    try {
      if (accessToken.value)
        await logoutApi(refreshToken.value || undefined)
    }
    finally {
      clearSession()
      // 强制页面重定向到登录页
      window.location.href = '/login'
    }
  }

  async function fetchPoints() {
    if (!accessToken.value)
      return null

    const response = await queryPoints()
    points.value = response.points_balance ?? 0
    pointsMeta.value = response
    return response
  }

  async function changePassword(payload: ChangePasswordParams) {
    await changePasswordApi(payload)
  }

  return {
    accessToken,
    refreshToken,
    expiresAt,
    user,
    points,
    pointsMeta,
    isAuthenticated,
    displayName,
    applySession,
    clearSession,
    loginByPassword,
    loginByOtp,
    registerAccount,
    logout,
    fetchPoints,
    changePassword,
  }
}, {
  persist: true,
})
