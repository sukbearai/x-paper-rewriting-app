<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument, Lock } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useRequest } from 'vue-hooks-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useAuthStore } from '../store/auth'

const auth = useAuthStore()
const router = useRouter()

// 表单相关
const passwordFormRef = ref<FormInstance>()
const showPasswordForm = ref(false)
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const passwordRules = computed<FormRules>(() => ({
  currentPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' },
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能小于6位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== passwordForm.value.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        }
        else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}))

// 修改密码
const { runAsync: changePasswordAsync, loading: changePasswordLoading } = useRequest(auth.changePassword, {
  manual: true,
  onSuccess: () => {
    ElMessage.success('密码修改成功，请重新登录')
    auth.logout()
    router.replace('/login')
  },
})

// 复制 Token
async function copyToken() {
  try {
    await navigator.clipboard.writeText(auth.accessToken)
    ElMessage.success('已复制到剪贴板')
  }
  catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

// 复制邀请码
async function copyInviteCode() {
  const inviteCode = auth.user.value?.invite_code
  if (!inviteCode) {
    ElMessage.warning('暂无邀请码')
    return
  }

  try {
    await navigator.clipboard.writeText(inviteCode)
    ElMessage.success('邀请码已复制到剪贴板')
  }
  catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

// 提交修改密码
async function submitPasswordChange() {
  if (!passwordFormRef.value)
    return

  try {
    await passwordFormRef.value.validate()
  }
  catch {
    ElMessage.warning('请完整填写表单')
    return
  }

  ElMessageBox.confirm(
    '修改密码后会自动退出登录，确认继续吗？',
    '确认修改',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    },
  )
    .then(async () => {
      try {
        await changePasswordAsync({
          current_password: passwordForm.value.currentPassword,
          new_password: passwordForm.value.newPassword,
        })
      }
      catch {
        // 错误已在请求封装中统一提示
      }
    })
    .catch(() => {
      // 用户取消
    })
}

// 重置密码表单
function resetPasswordForm() {
  passwordForm.value = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  }
  showPasswordForm.value = false
  if (passwordFormRef.value) {
    passwordFormRef.value.clearValidate()
  }
}

// 获取用户信息显示名称
const displayName = computed(() => {
  return auth.user?.username || auth.user?.email || auth.user?.phone || '未知用户'
})

const phoneDisplay = computed(() => {
  const phone = auth.user?.phone
  if (!phone)
    return '未绑定'
  // 隐藏中间4位数字
  return phone.replace(/(\+86\d{3})\d{4}(\d{4})/, '$1****$2')
})

const pointsBalance = computed(() => {
  return auth.user?.points_balance ?? 0
})

const inviteCode = computed(() => {
  return auth.user?.invite_code || '暂无'
})

// 退出登录
function handleLogout() {
  ElMessageBox.confirm(
    '确认要退出登录吗？',
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    },
  )
    .then(() => {
      auth.logout()
      ElMessage.success('已退出登录')
      router.replace('/login')
    })
    .catch(() => {
      // 用户取消
    })
}

// 获取积分信息
const { runAsync: fetchPoints } = useRequest(auth.fetchPoints, {
  manual: true,
})

onMounted(() => {
  if (auth.isAuthenticated) {
    fetchPoints()
  }
})
</script>

<template>
  <div class="p-6" style="height: calc(100vh - 64px); overflow-y: auto;">
    <el-card shadow="never" class="max-w-3xl mx-auto">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-lg font-semibold">个人中心</span>
          <el-button type="danger" size="small" @click="handleLogout">
            退出登录
          </el-button>
        </div>
      </template>

      <!-- 用户信息 -->
      <el-descriptions :column="1" border class="mb-6">
        <el-descriptions-item label="用户名">
          {{ displayName }}
        </el-descriptions-item>
        <el-descriptions-item label="邮箱">
          {{ auth.user?.email || '未绑定' }}
        </el-descriptions-item>
        <el-descriptions-item label="手机号">
          {{ phoneDisplay }}
        </el-descriptions-item>
        <el-descriptions-item label="积分余额">
          <span class="text-red-600 font-bold">{{ pointsBalance }} 积分</span>
        </el-descriptions-item>
        <el-descriptions-item label="邀请码">
          <div class="flex items-center gap-2">
            <el-tag size="small" type="success">
              {{ inviteCode }}
            </el-tag>
            <el-button v-if="inviteCode !== '暂无'" type="text" size="small" @click="copyInviteCode">
              <el-icon><CopyDocument /></el-icon>
            </el-button>
          </div>
        </el-descriptions-item>
        <el-descriptions-item label="注册时间">
          {{ auth.user?.created_at ? new Date(auth.user.created_at).toLocaleDateString() : '未知' }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- 修改密码按钮 -->
      <div class="mb-6">
        <el-button type="primary" :icon="Lock" @click="showPasswordForm = !showPasswordForm">
          修改密码
        </el-button>
      </div>

      <!-- 修改密码表单 -->
      <el-card v-if="showPasswordForm" class="password-form-card">
        <template #header>
          <span class="font-medium">修改密码</span>
        </template>

        <el-form
          ref="passwordFormRef"
          :model="passwordForm"
          :rules="passwordRules"
          label-width="100px"
          status-icon
        >
          <el-form-item label="当前密码" prop="currentPassword">
            <el-input
              v-model="passwordForm.currentPassword"
              type="password"
              placeholder="请输入当前密码"
              show-password
            />
          </el-form-item>

          <el-form-item label="新密码" prop="newPassword">
            <el-input
              v-model="passwordForm.newPassword"
              type="password"
              placeholder="请输入新密码"
              show-password
            />
          </el-form-item>

          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input
              v-model="passwordForm.confirmPassword"
              type="password"
              placeholder="请再次输入新密码"
              show-password
            />
          </el-form-item>

          <el-form-item>
            <div class="flex gap-3">
              <el-button
                type="primary"
                :loading="changePasswordLoading"
                @click="submitPasswordChange"
              >
                确认修改
              </el-button>
              <el-button @click="resetPasswordForm">
                取消
              </el-button>
            </div>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- Token 区域 -->
      <el-card class="token-card">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="font-medium">访问令牌</span>
            <el-button type="text" size="small" @click="copyToken">
              <el-icon><CopyDocument /></el-icon>
              复制
            </el-button>
          </div>
        </template>

        <div class="token-display">
          <span class="token-text">{{ auth.accessToken || '暂无令牌' }}</span>
        </div>

        <el-alert
          title="请注意"
          type="warning"
          :closable="false"
          class="mt-3"
        >
          访问令牌用于API调用，请妥善保管，不要泄露给他人
        </el-alert>
      </el-card>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
/* 让卡片更圆润 */
.el-card {
  border-radius: 12px;
}

/* 密码表单卡片样式 */
.password-form-card {
  margin-top: 16px;

  :deep(.el-card__header) {
    background-color: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
  }
}

/* Token卡片样式 */
.token-card {
  margin-top: 16px;
}

.token-display {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px;
  min-height: 60px;
  display: flex;
  align-items: center;
}

.token-text {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #495057;
  word-break: break-all;
  line-height: 1.4;
}

/* 表单样式优化 */
:deep(.el-form-item__label) {
  font-weight: 500;
}

:deep(.el-input__wrapper) {
  border-radius: 6px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .el-descriptions {
    :deep(.el-descriptions__label) {
      width: 120px;
    }
  }
}
</style>
