<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'

const activeName = ref<'login' | 'register'>('login')
const loginRef = ref<FormInstance>()
const registerRef = ref<FormInstance>()
const cooldown = ref(0)

interface Form {
  mobile: string
  password?: string
  confirmPassword?: string
  code?: string
  invite?: string
}

const loginForm = reactive<Form>({ mobile: '', password: '' })
const registerForm = reactive<Form>({
  mobile: '',
  password: '',
  confirmPassword: '',
  code: '',
  invite: '',
})

const rules = reactive<FormRules>({
  mobile: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式错误', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能小于6位', trigger: 'blur' },
  ],
})

const registerRules = reactive<FormRules>({
  mobile: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式错误', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能小于6位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
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

let timer: number | null = null
function startCooldown() {
  cooldown.value = 60
  if (timer) {
    clearInterval(timer)
  }

  timer = window.setInterval(() => {
    if (--cooldown.value <= 0)
      clearInterval(timer!)
  }, 1000)
}

async function sendSms(type: 'login' | 'register') {
  const ref = type === 'login' ? loginRef : registerRef
  if (!ref.value)
    return
  try {
    await ref.value.validateField('mobile')
    // TODO: 调后端发送短信接口
    ElMessage.success('验证码已发送')
    startCooldown()
  }
  catch {
    ElMessage.warning('请先修正手机号')
  }
}

async function submit(type: 'login' | 'register') {
  const ref = type === 'login' ? loginRef : registerRef
  if (!ref.value)
    return
  try {
    await ref.value.validate()
    ElMessage.success(type === 'login' ? '登录成功' : '注册成功')
    // TODO: 调用真实登录/注册接口
  }
  catch {
    ElMessage.warning('请完整填写表单')
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-content">
      <el-card class="auth-card">
        <el-tabs v-model="activeName">
          <!-- 登录 -->
          <el-tab-pane label="登录" name="login">
            <el-form ref="loginRef" :model="loginForm" :rules="rules" label-width="80px">
              <el-form-item label="手机号" prop="mobile">
                <el-input v-model="loginForm.mobile" placeholder="请输入手机号" maxlength="11" />
              </el-form-item>

              <el-form-item label="密码" prop="password">
                <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" show-password />
              </el-form-item>

              <el-form-item>
                <el-button type="primary" style="width: 100%" @click="submit('login')">
                  登录
                </el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- 注册 -->
          <el-tab-pane label="注册" name="register">
            <el-form ref="registerRef" :model="registerForm" :rules="registerRules" label-width="80px">
              <el-form-item label="手机号" prop="mobile">
                <el-input v-model="registerForm.mobile" placeholder="请输入手机号" maxlength="11" />
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
                    <el-button :disabled="cooldown > 0" @click="sendSms('register')">
                      {{ cooldown > 0 ? `${cooldown}s` : '获取验证码' }}
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="邀请码" prop="invite">
                <el-input v-model="registerForm.invite" placeholder="" />
              </el-form-item>

              <el-form-item>
                <el-button type="success" style="width: 100%" @click="submit('register')">
                  注册
                </el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.auth-container {
  height: calc(100vh - 70px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ffffff 0%, #87CEEB 50%, #ffffff 100%);
}

.auth-content {
  display: flex;
  width: 600px;
  height: auto;
  min-height: 400px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.auth-image {
  display: none;
}

.auth-card {
  width: 100%;
  padding: 40px;
  border: none;
  border-radius: 0;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
}
</style>
