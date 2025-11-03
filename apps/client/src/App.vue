<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Discount, User } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()
const activeMenu = ref('0')
const isLoggedIn = ref(true)
const menuItems = [
  {
    icon: 'HomeFilled',
    label: '工具',
    clickHandler: () => { },
  },
  {
    icon: 'WalletFilled',
    label: '代理中心',
    clickHandler: () => { },
  },
  {
    icon: 'UserFilled',
    label: '登录',
    clickHandler: goToLogin,
  },
]

// 监听路由变化更新菜单激活状态
watch(
  () => route?.path,
  (newPath) => {
    switch (newPath) {
      case '/':
      case '/home':
        activeMenu.value = '0'
        break
      case '/proxy':
        activeMenu.value = '1'
        break
      case '/login':
        activeMenu.value = '2'
        break
      default:
        activeMenu.value = '0'
    }
  },
  { immediate: true },
)

// 菜单点击处理
function handleMenuSelect(index: string) {
  activeMenu.value = index
  switch (index) {
    case '0':
      router.push('/')
      break
    case '1':
      router.push('/proxy')
      break
    case '2':
      router.push('/login')
      break
  }
}

// 登录菜单项点击处理
function goToLogin() {
  activeMenu.value = '2'
  router.push('/login')
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
      // 执行退出登录逻辑
      isLoggedIn.value = false
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
      <template v-for="(item, index) in menuItems" :key="index">
        <!-- 非登录菜单项正常显示 -->
        <el-menu-item
          v-if="index !== 2 || !isLoggedIn"
          :index="index.toString()"
          @click="item.clickHandler"
        >
          <el-icon class="menu-icon" :class="{ 'active-icon': activeMenu === index.toString() }">
            <component :is="item.icon" />
          </el-icon>
          {{ item.label }}
        </el-menu-item>

        <!-- 登录后显示用户下拉菜单 -->
        <el-sub-menu
          v-else
          :index="index.toString()"
          popper-class="user-dropdown"
        >
          <template #title>
            <el-icon class="menu-icon">
              <User />
            </el-icon>
            <!-- {{ userPhone }} -->
          </template>

          <el-menu-item @click="goToUserCenter">
            <el-icon><User /></el-icon>
            个人中心
          </el-menu-item>

          <el-menu-item @click="goToRecharge">
            <el-icon><Discount /></el-icon>
            余额：{{ 1000 }}元
          </el-menu-item>

          <el-menu-item @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>
            退出登录
          </el-menu-item>
        </el-sub-menu>
      </template>
    </el-menu>

    <!-- 内容区域 -->
    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<style>
#app {
  height: 100%;
}

.gradient-bg {
  background: linear-gradient(to right, #f8f9fa, rgba(248, 249, 250, 0.95));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
.main-content {
  padding: 0;
  height: calc(100vh - 64px);
  overflow-y: auto;
  background: linear-gradient(to right, #e6f3ff, #ffffff, #e6f3ff);

}

/* 保持与Home.vue一致的菜单样式 */
.el-menu-demo {
  height: 64px;
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
