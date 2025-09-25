<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth'

const auth = useAuthStore()
const router = useRouter()

/* 复制 Token */
async function copyToken() {
  try {
    await navigator.clipboard.writeText(auth.token)
    ElMessage.success('已复制到剪贴板')
  }
  catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

/* 退出登录 */
function handleLogout() {
  auth.logout()
  ElMessage.success('已退出登录')
  router.replace('/login')
}
</script>

<template>
  <div class="p-6">
    <el-card shadow="never" class="max-w-3xl mx-auto">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-lg font-semibold">用户信息</span>
          <el-button type="danger" size="small" @click="handleLogout">
            退出登录
          </el-button>
        </div>
      </template>
      <!-- 用户信息 -->
      <el-descriptions :column="1" border>
        <el-descriptions-item label="用户账号">
          {{ auth.mobile }}
        </el-descriptions-item>
        <el-descriptions-item label="手机号">
          {{ auth.mobile }}
        </el-descriptions-item>
        <el-descriptions-item label="余额">
          <span class="text-red-600 font-bold">￥{{ auth.amount }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="邀请码">
          <el-tag size="small">
            {{ auth.inviteCode }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
      <!-- Token 区域 -->
      <div class="my-4">
        <label class="block text-sm font-medium text-gray-700 mb-1">Token（点击复制）</label>
        <div
          class="flex items-center justify-between bg-gray-100 px-3 py-2 rounded cursor-pointer"
          @click="copyToken"
        >
          <span class="text-xs text-gray-600 break-all">{{ auth.token }}</span>
          <el-icon class="ml-2 text-gray-500">
            <CopyDocument />
          </el-icon>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
/* 让卡片更圆润 */
.el-card {
  border-radius: 12px;
}
</style>
