<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useRequest } from 'vue-hooks-plus'
import { sendSmsCode } from '@/api/services'
import { useAuthStore } from '@/store/auth'
import type { LoginOtpForm, LoginWithPasswordParams, RegisterForm, RegisterParams } from '@/api/interface'

const authStore = useAuthStore()
const router = useRouter()

const activeName = ref<'login' | 'register'>('login')
const loginMode = ref<'otp' | 'password'>('password')
const loginOtpRef = ref<FormInstance>()
const loginPasswordRef = ref<FormInstance>()
const registerRef = ref<FormInstance>()
const cooldown = ref(0)
const showAuthModal = ref(false)

const loginOtpForm = reactive<LoginOtpForm>({ phone: '', code: '' })
const loginPasswordForm = reactive<LoginWithPasswordParams>({ username: '', password: '' })
const registerForm = reactive<RegisterForm>({
  username: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  code: '',
  invite: '',
})

const phonePattern = /^1[3-9]\d{9}$/
const emailPattern = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/

const loginOtpRules = reactive<FormRules>({
  phone: [
    { required: true, message: '请输入正确的中国大陆手机号', trigger: 'blur' },
    { pattern: phonePattern, message: '手机号格式错误', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^\d{4,6}$/, message: '验证码为 4-6 位数字', trigger: 'blur' },
  ],
})

const loginPasswordRules = reactive<FormRules>({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能小于6位', trigger: 'blur' },
  ],
})

const registerRules = reactive<FormRules>({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度需在 3-20 个字符', trigger: 'blur' },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { pattern: emailPattern, message: '邮箱格式不正确', trigger: 'blur' },
  ],
  phone: [
    { required: true, message: '请输入正确的中国大陆手机号', trigger: 'blur' },
    { pattern: phonePattern, message: '手机号格式错误', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能小于6位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== registerForm.password) {
          callback(new Error('两次输入的密码不一致'))
        }
        else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码为 6 位数字', trigger: 'blur' },
  ],
  invite: [
    { required: true, message: '请输入邀请码', trigger: 'blur' },
  ],
})

const { runAsync: loginOtpAsync, loading: loginOtpLoading } = useRequest(authStore.loginByOtp, {
  manual: true,
  onSuccess: () => {
    ElMessage.success('登录成功')
    showAuthModal.value = false
    router.push('/')
  },
})

const { runAsync: loginPasswordAsync, loading: loginPasswordLoading } = useRequest(authStore.loginByPassword, {
  manual: true,
  onSuccess: () => {
    ElMessage.success('登录成功')
    showAuthModal.value = false
    router.push('/')
  },
})

const { runAsync: registerAsync, loading: registerLoading } = useRequest(authStore.registerAccount, {
  manual: true,
  onSuccess: () => {
    ElMessage.success('注册成功，请登录')
    clearCooldownTimer()
    cooldown.value = 0
    activeName.value = 'login'
    loginOtpForm.phone = registerForm.phone
    loginOtpForm.code = ''
    loginMode.value = 'otp'
    showAuthModal.value = true
  },
})

const { runAsync: sendSmsAsync, loading: smsLoading } = useRequest(sendSmsCode, {
  manual: true,
  onSuccess: () => {
    ElMessage.success('验证码已发送')
    startCooldown()
  },
})

const loginButtonLoading = computed(() => (loginMode.value === 'otp' ? loginOtpLoading.value : loginPasswordLoading.value))

let timer: number | null = null

function clearCooldownTimer() {
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
}

function startCooldown() {
  cooldown.value = 60
  clearCooldownTimer()
  timer = window.setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) {
      clearCooldownTimer()
      cooldown.value = 0
    }
  }, 1000)
}

async function sendSms(type: 'login' | 'register') {
  if (type === 'login' && loginMode.value !== 'otp') {
    ElMessage.warning('请切换到手机登录')
    return
  }

  const formRef = type === 'login' ? loginOtpRef.value : registerRef.value
  const phone = type === 'login' ? loginOtpForm.phone : registerForm.phone
  if (!formRef)
    return

  try {
    await formRef.validateField('phone')
  }
  catch {
    ElMessage.warning('请先修正手机号')
    return
  }

  try {
    const intlPhone = phone.startsWith('+') ? phone : `+86${phone}`
    await sendSmsAsync({ phone: intlPhone, purpose: type === 'login' ? 'login' : 'signup' })
  }
  catch {
    // 错误已在请求封装中统一提示
  }
}

async function submit(type: 'login' | 'register') {
  if (type === 'login') {
    if (loginMode.value === 'otp') {
      if (!loginOtpRef.value)
        return
      try {
        await loginOtpRef.value.validate()
      }
      catch {
        ElMessage.warning('请完整填写表单')
        return
      }

      try {
        const intlPhone = loginOtpForm.phone.startsWith('+') ? loginOtpForm.phone : `+86${loginOtpForm.phone}`
        await loginOtpAsync({
          phone: intlPhone,
          verification_code: loginOtpForm.code,
        })
      }
      catch {
        // 错误已在请求封装中统一提示
      }
    }
    else {
      if (!loginPasswordRef.value)
        return
      try {
        await loginPasswordRef.value.validate()
      }
      catch {
        ElMessage.warning('请完整填写表单')
        return
      }

      try {
        await loginPasswordAsync({
          username: loginPasswordForm.username,
          password: loginPasswordForm.password,
        })
      }
      catch {
        // 错误已在请求封装中统一提示
      }
    }
    return
  }

  if (!registerRef.value)
    return

  try {
    await registerRef.value.validate()
  }
  catch {
    ElMessage.warning('请完整填写表单')
    return
  }

  const payload: RegisterParams = {
    username: registerForm.username,
    email: registerForm.email,
    phone: registerForm.phone ? `+86${registerForm.phone}` : undefined,
    password: registerForm.password,
    verification_code: registerForm.code || undefined,
    invite_code: registerForm.invite || undefined,
  }

  try {
    await registerAsync(payload)
  }
  catch {
    // 错误已在请求封装中统一提示
  }
}

function openAuthModal() {
  showAuthModal.value = true
}

onMounted(() => {
  if (authStore.isAuthenticated)
    router.replace('/')
  else
    showAuthModal.value = true
})

watch(
  () => authStore.isAuthenticated,
  (loggedIn) => {
    if (loggedIn) {
      showAuthModal.value = false
      router.replace('/')
    }
  },
)

onBeforeUnmount(() => {
  clearCooldownTimer()
})
</script>

<template>
  <div class="landing-container" style="height: 100vh; overflow: hidden;">
    <!-- Main Content -->
    <div class="landing-content">
      <div class="content-left">
        <h1 class="main-title">
          帮助润色<br>您的文章
        </h1>
        <p class="subtitle">
          优质技术 | 专业解决方案
        </p>

        <div class="action-buttons">
          <el-button class="start-now-btn" size="large" @click="openAuthModal">
            立即使用
          </el-button>
        </div>
      </div>
    </div>

    <!-- Authentication Modal -->
    <el-dialog
      v-model="showAuthModal"
      class="auth-dialog"
      :style="{ '--el-dialog-width': '640px' }"
      :show-close="true"
    >
      <template #header>
        <div class="dialog-header">
          <div class="dialog-title">
            <svg-icon name="renyuan" class="dialog-title__icon" />
            <span>欢迎您！</span>
          </div>
          <p class="dialog-subtitle">
            登录或注册以继续
          </p>
        </div>
      </template>
      <el-tabs v-model="activeName" class="auth-tabs">
        <!-- 登录 -->
        <el-tab-pane label="登录" name="login">
          <div class="auth-panel">
            <div class="auth-panel__toggle">
              <el-radio-group v-model="loginMode" size="small">
                <el-radio-button label="password">
                  用户名登录
                </el-radio-button>
                <el-radio-button label="otp">
                  手机登录
                </el-radio-button>
              </el-radio-group>
            </div>

            <el-form
              v-if="loginMode === 'otp'"
              ref="loginOtpRef"
              :model="loginOtpForm"
              :rules="loginOtpRules"
              class="auth-form"
              label-position="top"
              @submit.prevent="submit('login')"
            >
              <el-form-item label="手机号" prop="phone">
                <el-input
                  v-model="loginOtpForm.phone"
                  placeholder="请输入11位手机号"
                  maxlength="11"
                  pattern="[0-9]*"
                  inputmode="numeric"
                  @keyup.enter.prevent="submit('login')"
                >
                  <template #prepend>
                    +86
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="验证码" prop="code">
                <el-input
                  v-model="loginOtpForm.code"
                  placeholder="请输入短信验证码"
                  maxlength="6"
                  @keyup.enter.prevent="submit('login')"
                >
                  <template #append>
                    <el-button :disabled="cooldown > 0 || smsLoading" :loading="smsLoading" @click="sendSms('login')">
                      {{ cooldown > 0 ? `${cooldown}s` : '获取验证码' }}
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item>
                <el-button type="primary" class="submit-btn" :loading="loginButtonLoading" @click="submit('login')">
                  登录
                </el-button>
              </el-form-item>
            </el-form>

            <el-form
              v-else
              ref="loginPasswordRef"
              :model="loginPasswordForm"
              :rules="loginPasswordRules"
              class="auth-form"
              label-position="top"
              @submit.prevent="submit('login')"
            >
              <el-form-item label="用户名" prop="username">
                <el-input
                  v-model="loginPasswordForm.username"
                  placeholder="请输入用户名"
                  @keyup.enter.prevent="submit('login')"
                />
              </el-form-item>

              <el-form-item label="密码" prop="password">
                <el-input
                  v-model="loginPasswordForm.password"
                  type="password"
                  placeholder="请输入密码"
                  show-password
                  @keyup.enter.prevent="submit('login')"
                />
              </el-form-item>

              <el-form-item>
                <el-button type="primary" class="submit-btn" :loading="loginButtonLoading" @click="submit('login')">
                  登录
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- 注册 -->
        <el-tab-pane label="注册" name="register">
          <div class="auth-panel">
            <el-form
              ref="registerRef"
              :model="registerForm"
              :rules="registerRules"
              class="auth-form"
              label-position="top"
              @submit.prevent="submit('register')"
            >
              <el-form-item label="用户名" prop="username">
                <el-input
                  v-model="registerForm.username"
                  placeholder="请输入用户名"
                  maxlength="20"
                  @keyup.enter.prevent="submit('register')"
                />
              </el-form-item>

              <el-form-item label="邮箱" prop="email">
                <el-input
                  v-model="registerForm.email"
                  placeholder="请输入邮箱"
                  @keyup.enter.prevent="submit('register')"
                />
              </el-form-item>

              <el-form-item label="手机号" prop="phone">
                <el-input
                  v-model="registerForm.phone"
                  placeholder="请输入11位手机号"
                  maxlength="11"
                  pattern="[0-9]*"
                  inputmode="numeric"
                  @keyup.enter.prevent="submit('register')"
                >
                  <!-- 固定前缀 -->
                  <template #prepend>
                    +86
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="密码" prop="password">
                <el-input
                  v-model="registerForm.password"
                  type="password"
                  placeholder="请输入密码"
                  show-password
                  @keyup.enter.prevent="submit('register')"
                />
              </el-form-item>

              <el-form-item label="确认密码" prop="confirmPassword">
                <el-input
                  v-model="registerForm.confirmPassword"
                  type="password"
                  placeholder="请确认密码"
                  show-password
                  @keyup.enter.prevent="submit('register')"
                />
              </el-form-item>

              <el-form-item label="验证码" prop="code">
                <el-input
                  v-model="registerForm.code"
                  placeholder="请输入短信验证码"
                  maxlength="6"
                  @keyup.enter.prevent="submit('register')"
                >
                  <template #append>
                    <el-button :disabled="cooldown > 0 || smsLoading" :loading="smsLoading" @click="sendSms('register')">
                      {{ cooldown > 0 ? `${cooldown}s` : '获取验证码' }}
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="邀请码" prop="invite">
                <el-input
                  v-model="registerForm.invite"
                  placeholder="请输入邀请码"
                  @keyup.enter.prevent="submit('register')"
                />
              </el-form-item>

              <el-form-item>
                <el-button type="success" class="submit-btn" :loading="registerLoading" @click="submit('register')">
                  注册
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<style scoped>
.landing-container {
  height: 100%;
  background: url('../assets/images/bg.png') no-repeat center center;
  background-size: cover;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  position: relative;
  overflow: hidden;
}

.landing-content {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 40px;
  position: relative;
  z-index: 2;
}

.content-left {
  max-width: 500px;
  min-height: 500px;
}
.main-title {
  font-size: 4.5rem;
  font-weight: bold;
  line-height: 1.2;
  margin: 0 0 80px 0;
  letter-spacing: 20px;
  background: linear-gradient(135deg, #1a1919 0%, #9f9d9d 50%, #1f1d1d 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  font-size: 1.1rem;
  color: #cccccc;
  margin-bottom: 40px;
  letter-spacing: 1px;
}

.action-buttons {
  display: flex;
  gap: 20px;
}

.view-company-btn {
  background: transparent;
  border: 2px solid #666666;
  color: #cccccc;
  padding: 12px 30px;
  border-radius: 25px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.view-company-btn:hover {
  border-color: #999999;
  color: #ffffff;
  transform: translateY(-2px);
}

.start-now-btn {
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  border: none;
  color: #000000;
  padding: 12px 30px;
  border-radius: 25px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
}

.start-now-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(255, 215, 0, 0.4);
  background: linear-gradient(135deg, #FFA500 0%, #FFD700 100%);
}

.logo-container {
  position: absolute;
  bottom: 30px;
  right: 50px;
  z-index: 2;
}

/* Modal Styles */
:deep(.auth-dialog) {
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.auth-dialog .el-dialog) {
  border-radius: 18px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 251, 255, 0.94) 100%);
  backdrop-filter: blur(16px);
  box-shadow: 0 24px 50px rgba(15, 23, 42, 0.15);
  max-width: min(680px, calc(100vw - 32px));
}

:deep(.auth-dialog .el-dialog__header) {
  padding: 30px 32px 0 32px;
  margin: 0;
}

:deep(.auth-dialog .el-dialog__headerbtn) {
  top: 24px;
  right: 24px;
}

:deep(.auth-dialog .el-dialog__body) {
  padding: 24px 32px 36px;
}

.dialog-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 26px;
  font-weight: 600;
  color: #1f2937;
}

.dialog-title__icon {
  width: 34px;
  height: 34px;
  color: #2563eb;
}

.dialog-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.auth-tabs:deep(.el-tabs__nav-wrap) {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.auth-tabs:deep(.el-tabs__nav-scroll) {
  width: 100%;
}

.auth-tabs:deep(.el-tabs__nav) {
  width: 100%;
  display: flex;
  gap: 6px;
}

.auth-tabs:deep(.el-tabs__item) {
  flex: 1;
  text-align: center;
  border-radius: 12px 12px 0 0;
  transition: background-color 0.2s ease;
}

.auth-tabs:deep(.el-tabs__item.is-active) {
  color: #2563eb;
  font-weight: 600;
}

.auth-tabs:deep(.el-tab-pane) {
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.auth-tabs:deep(.el-tabs__nav-wrap::after) {
  background-color: transparent;
}

.auth-tabs:deep(.el-tabs__active-bar) {
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, #2563eb 0%, #38bdf8 100%);
}

.auth-panel {
  width: min(420px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.auth-panel__toggle {
  display: flex;
  justify-content: center;
  margin-bottom: 4px;
}

.auth-panel__toggle :deep(.el-radio-button__inner) {
  padding: 8px 18px;
}

.auth-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.auth-form :deep(.el-form-item) {
  margin-bottom: 0;
  width: 100%;
}

.auth-form :deep(.el-form-item__label) {
  padding-bottom: 4px;
  font-weight: 500;
  color: #374151;
}

.auth-form :deep(.el-form-item__content) {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.auth-form :deep(.el-form-item__content > .el-button) {
  width: 262px;
  align-self: center;
}

.auth-form :deep(.el-input__wrapper) {
  border-radius: 10px;
  padding: 12px 14px;
}

.auth-form :deep(.el-input-group__prepend) {
  padding: 0 12px;
}

.auth-form :deep(.el-input-group__prepend),
.auth-form :deep(.el-input-group__append) {
  background: #f3f4f6;
  border: none;
  display: flex;
  align-items: center;
}

.auth-form :deep(.el-input-group--prepend .el-input__wrapper) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-top-right-radius: 10px;
  border-bottom-right-radius: 10px;
}

.auth-form :deep(.el-input-group--append .el-input__wrapper) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-top-left-radius: 10px;
  border-bottom-left-radius: 10px;
}

.auth-form :deep(.el-input-group__prepend) {
  border-radius: 10px 0 0 10px;
  padding: 0 16px;
}

.auth-form :deep(.el-input-group__append) {
  border-radius: 0 10px 10px 0;
  padding: 0;
  overflow: hidden;
}

.auth-form :deep(.el-input-group__append .el-button) {
  border-radius: 0;
  height: 100%;
  border: none;
  padding: 0 18px;
  white-space: nowrap;
  min-width: 120px;
  justify-content: center;
}

.submit-btn {
  width: 100%;
  height: 44px;
  border-radius: 10px;
  font-weight: 600;
  letter-spacing: 1px;
}

.submit-btn.el-button--primary {
  background: linear-gradient(135deg, #2563eb 0%, #38bdf8 100%);
  border: none;
}

.submit-btn.el-button--primary:hover {
  background: linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%);
}

.submit-btn.el-button--success {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  border: none;
}

.submit-btn.el-button--success:hover {
  background: linear-gradient(135deg, #059669 0%, #22c55e 100%);
}

/* Responsive Design */
@media (max-width: 768px) {
  .landing-content {
    flex-direction: column;
    text-align: center;
    padding: 40px 20px;
    height: auto;
    min-height: 100vh;
    justify-content: center;
  }

  .content-left {
    max-width: 100%;
    margin-bottom: 40px;
  }

  .main-title {
    font-size: 2.5rem;
  }

  .action-buttons {
    justify-content: center;
    flex-wrap: wrap;
  }

  .logo-container {
    bottom: 20px;
    right: 50%;
    transform: translateX(50%);
  }
}

@media (max-width: 480px) {
  .main-title {
    font-size: 2rem;
  }

  .action-buttons {
    flex-direction: column;
    align-items: center;
  }

  .view-company-btn,
  .start-now-btn {
    width: 200px;
  }
}
</style>
