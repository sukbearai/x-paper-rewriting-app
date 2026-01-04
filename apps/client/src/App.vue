<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Discount, HomeFilled, SwitchButton, User, UserFilled, WalletFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/store/auth'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const activeMenu = ref('home')

const isLoggedIn = computed(() => authStore.isAuthenticated)
const userName = computed(() => authStore.displayName)
const userPoints = computed(() => authStore.points ?? authStore.user?.points_balance ?? 0)
const userRole = computed(() => authStore.user?.role || localStorage.getItem('userRole') || 'guest')
const canAccessProxy = computed(() => isLoggedIn.value && (userRole.value === 'admin' || userRole.value === 'agent'))

watch(
  isLoggedIn,
  (loggedIn) => {
    if (loggedIn)
      authStore.fetchPoints()
  },
  { immediate: true },
)

// 监听路由变化更新菜单激活状态
watch(
  () => route?.path,
  (newPath) => {
    switch (newPath) {
      case '/':
      case '/home':
        activeMenu.value = 'home'
        break
      case '/proxy':
        activeMenu.value = 'proxy'
        break
      case '/login':
        activeMenu.value = 'login'
        break
      case '/userCenter':
        activeMenu.value = 'user:center'
        break
      case '/balanceRecharge':
        activeMenu.value = 'user:recharge'
        break
      default:
        activeMenu.value = 'home'
    }
  },
  { immediate: true },
)

// 菜单点击处理
function handleMenuSelect(index: string) {
  activeMenu.value = index
  switch (index) {
    case 'home':
      router.push('/')
      break
    case 'proxy':
      router.push('/proxy')
      break
    case 'login':
      router.push('/login')
      break
    case 'user:center':
      goToUserCenter()
      break
    case 'user:recharge':
      goToRecharge()
      break
    case 'user:logout':
      handleLogout()
      break
    default:
      break
  }
}

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
      authStore.logout()
      router.push('/login')
      ElMessage({
        type: 'success',
        message: '已成功退出登录',
      })
    })
    .catch(() => {
      // 用户点击取消，不做任何操作
    })
}
function goToUserCenter() {
  router.push('/userCenter')
}

function goToRecharge() {
  router.push('/balanceRecharge')
}
</script>

<template>
  <div id="app">
    <!-- 使用Home.vue中的菜单样式 -->
    <el-menu
      :default-active="activeMenu" class="el-menu-demo h-16 border-b border-gray-200 gradient-bg"
      mode="horizontal" :ellipsis="false" text-color="#606266" active-text-color="#409EFF" @select="handleMenuSelect"
    >
      <h1 class="text-xl font-bold text-gray-900 flex items-center gap-1 pl-6" style="font-family: 'Ma Shan Zheng', cursive;">
        <!-- <svg-icon name="xingxi" style="height: 34px; width: 34px;" /> -->
        星辰写作
      </h1>
      <div class="flex-grow" />
      <el-menu-item index="home">
        <el-icon class="menu-icon" :class="{ 'active-icon': activeMenu === 'home' }">
          <HomeFilled />
        </el-icon>
        AI改写
      </el-menu-item>

      <el-menu-item v-if="canAccessProxy" index="proxy">
        <el-icon class="menu-icon" :class="{ 'active-icon': activeMenu === 'proxy' }">
          <WalletFilled />
        </el-icon>
        代理中心
      </el-menu-item>

      <el-menu-item v-if="!isLoggedIn" index="login">
        <el-icon class="menu-icon" :class="{ 'active-icon': activeMenu === 'login' }">
          <UserFilled />
        </el-icon>
        登录
      </el-menu-item>

      <el-sub-menu v-else index="user" popper-class="user-dropdown">
        <template #title>
          <el-icon class="menu-icon">
            <User />
          </el-icon>
          <span class="ml-1">{{ userName || '用户' }}</span>
        </template>

        <el-menu-item index="user:center">
          <el-icon><User /></el-icon>
          个人中心
        </el-menu-item>

        <el-menu-item index="user:recharge">
          <el-icon><Discount /></el-icon>
          积分：{{ userPoints }}
        </el-menu-item>

        <el-menu-item index="user:logout">
          <el-icon><SwitchButton /></el-icon>
          退出登录
        </el-menu-item>
      </el-sub-menu>
    </el-menu>

    <!-- 内容区域 -->
    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<style>
#app {
  min-width: 1240px;
  min-height: 610px;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.gradient-bg {
  background: linear-gradient(to right, #f8f9fa, rgba(248, 249, 250, 0.95));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
.main-content {
  padding: 0;
  flex: 1;
  overflow: hidden;
  background: linear-gradient(to right, #e6f3ff, #ffffff, #e6f3ff);
}

/* 保持与Home.vue一致的菜单样式 */
.el-menu-demo {
  height: 64px;
  flex-shrink: 0;
}

.menu-icon {
  font-size: 20px;
  margin-right: 4px;
  color: #606266;
}

.active-icon {
  color: #409EFF !important;
}
</style>
