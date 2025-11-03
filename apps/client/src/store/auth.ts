import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { login as apiLogin, register as apiRegister } from '../api/services'

export const useAuthStore = defineStore('auth', () => {
  const mobile = ref('')
  const password = ref('')
  const amount = ref('')
  const inviteCode = ref('')
  const token = ref('')
  const expire = ref(0)

  const isLogin = computed(() => !!token.value && Date.now() < expire.value)

  async function login(form: { mobile: string, password: string }) {
    const { data } = await apiLogin(form)
    token.value = data.token
    expire.value = data.expire
    mobile.value = form.mobile
    amount.value = data.amount
    ElMessage.success('登录成功')
  }

  async function register(form: {
    mobile: string
    password: string
    code: string
    inviteCode?: string
  }) {
    await apiRegister(form)
    await login({ mobile: form.mobile, password: form.password })
    inviteCode.value = form.inviteCode || ''
  }

  function logout() {
    token.value = ''
    expire.value = 0
    mobile.value = ''
    password.value = ''
    inviteCode.value = ''
  }

  return {
    mobile,
    password,
    amount,
    inviteCode,
    token,
    expire,
    isLogin,
    login,
    register,
    logout,
  }
}, {
  persist: true,
})
