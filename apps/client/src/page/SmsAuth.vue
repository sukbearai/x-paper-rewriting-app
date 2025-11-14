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
const loginMode = ref<'otp' | 'password'>('otp')
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
    ElMessage.warning('请切换到短信验证码登录')
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
  if (authStore.isAuthenticated.value)
    router.replace('/')
  else
    showAuthModal.value = true
})

watch(
  () => authStore.isAuthenticated.value,
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
  <div class="landing-container">
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
    <el-dialog v-model="showAuthModal" title="" width="500px" :show-close="true">
      <h2 style="font-size: 24px; font-weight: bold;display: flex;align-items: center;justify-content: center;">
        <svg-icon name="renyuan" style="height: 24px; width: 24px;margin-right: 4px;" />欢迎您！
      </h2>
      <p style="color: #ccc;margin-top: 10px;text-align: center;">
        登录或注册以继续
      </p>
      <el-tabs v-model="activeName" class="auth-tabs">
        <!-- 登录 -->
        <el-tab-pane label="登录" name="login">
          <div class="login-mode-toggle">
            <el-radio-group v-model="loginMode" size="small">
              <el-radio-button label="otp">
                验证码登录
              </el-radio-button>
              <el-radio-button label="password">
                密码登录
              </el-radio-button>
            </el-radio-group>
          </div>

          <el-form
            v-if="loginMode === 'otp'"
            ref="loginOtpRef"
            :model="loginOtpForm"
            :rules="loginOtpRules"
            label-width="80px"
          >
            <el-form-item label="手机号" prop="phone">
              <el-input
                v-model="loginOtpForm.phone"
                placeholder="请输入11位手机号"
                maxlength="11"
                pattern="[0-9]*"
                inputmode="numeric"
              >
                <template #prepend>
                  +86
                </template>
              </el-input>
            </el-form-item>

            <el-form-item label="验证码" prop="code">
              <el-input v-model="loginOtpForm.code" placeholder="请输入短信验证码" maxlength="6">
                <template #append>
                  <el-button :disabled="cooldown > 0 || smsLoading" :loading="smsLoading" @click="sendSms('login')">
                    {{ cooldown > 0 ? `${cooldown}s` : '获取验证码' }}
                  </el-button>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" style="width: 100%" :loading="loginButtonLoading" @click="submit('login')">
                登录
              </el-button>
            </el-form-item>
          </el-form>

          <el-form
            v-else
            ref="loginPasswordRef"
            :model="loginPasswordForm"
            :rules="loginPasswordRules"
            label-width="80px"
          >
            <el-form-item label="用户名" prop="username">
              <el-input v-model="loginPasswordForm.username" placeholder="请输入用户名" />
            </el-form-item>

            <el-form-item label="密码" prop="password">
              <el-input v-model="loginPasswordForm.password" type="password" placeholder="请输入密码" show-password />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" style="width: 100%" :loading="loginButtonLoading" @click="submit('login')">
                登录
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 注册 -->
        <el-tab-pane label="注册" name="register">
          <el-form ref="registerRef" :model="registerForm" :rules="registerRules" label-width="80px">
            <el-form-item label="用户名" prop="username">
              <el-input v-model="registerForm.username" placeholder="请输入用户名" maxlength="20" />
            </el-form-item>

            <el-form-item label="邮箱" prop="email">
              <el-input v-model="registerForm.email" placeholder="请输入邮箱" />
            </el-form-item>

            <el-form-item label="手机号" prop="phone">
              <el-input
                v-model="registerForm.phone"
                placeholder="请输入11位手机号"
                maxlength="11"
                pattern="[0-9]*"
                inputmode="numeric"
              >
                <!-- 固定前缀 -->
                <template #prepend>
                  +86
                </template>
              </el-input>
            </el-form-item>

            <el-form-item label="密码" prop="password">
              <el-input v-model="registerForm.password" type="password" placeholder="请输入密码" show-password />
            </el-form-item>

            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input v-model="registerForm.confirmPassword" type="password" placeholder="请确认密码" show-password />
            </el-form-item>

            <el-form-item label="验证码" prop="code">
              <el-input v-model="registerForm.code" placeholder="请输入短信验证码" maxlength="6">
                <template #append>
                  <el-button :disabled="cooldown > 0 || smsLoading" :loading="smsLoading" @click="sendSms('register')">
                    {{ cooldown > 0 ? `${cooldown}s` : '获取验证码' }}
                  </el-button>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item label="邀请码" prop="invite">
              <el-input v-model="registerForm.invite" placeholder="请输入邀请码（可选）" />
            </el-form-item>

            <el-form-item>
              <el-button type="success" style="width: 100%" :loading="registerLoading" @click="submit('register')">
                注册
              </el-button>
            </el-form-item>
          </el-form>
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
:deep(.el-tabs__nav-scroll){
  width: 100%;
}
.auth-tabs:deep(.el-tabs__nav-wrap) {
  display: flex;
  justify-content: space-between;
}

.auth-tabs:deep(.el-tabs__nav) {
  width: 100%;
  display: flex;
}

.auth-tabs:deep(.el-tabs__item) {
  flex: 1;
  text-align: center;
}
:deep(.el-dialog) {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);
}

:deep(.el-dialog__header) {
  padding: 20px 20px 0 20px;
}

:deep(.el-dialog__body) {
  padding: 20px;
}

:deep(.el-tabs__nav-wrap::after) {
  background-color: #e4e7ed;
}

:deep(.el-tabs__active-bar) {
  background-color: #409EFF;
}

:deep(.el-tabs__item.is-active) {
  color: #409EFF;
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
