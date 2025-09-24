<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Discount, User } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const activeMenu = ref('0')
const menuItems = [
  {
    icon: 'HomeFilled',
    label: '工具',
    clickHandler: () => {},
  },
  {
    icon: 'WalletFilled',
    label: '代理中心',
    clickHandler: () => {},
  },
  {
    icon: 'UserFilled',
    label: '登录/注册',
    clickHandler: goToLogin,
  },
]

// 监听路由变化更新菜单激活状态
watch(
  () => route.path,
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
</script>

<template>
  <div id="app">
    <!-- 使用Home.vue中的菜单样式 -->
    <el-menu
      :default-active="activeMenu" class="el-menu-demo bg-white shadow-md h-16 border-b border-gray-200"
      mode="horizontal" :ellipsis="false" text-color="#606266" active-text-color="#409EFF"
      @select="handleMenuSelect"
    >
      <h1 class="text-xl font-bold text-gray-900 flex items-center gap-1 pl-6">
        <svg-icon name="xingxi" style="height: 34px; width: 34px;" />
        星辰写作
      </h1>
      <div class="flex-grow" />
      <el-menu-item
        v-for="(item, index) in menuItems"
        :key="index"
        :index="index.toString()"
        @click="item.clickHandler"
      >
        <el-icon class="menu-icon" :class="{ 'active-icon': activeMenu === index.toString() }">
          <component :is="item.icon" />
        </el-icon>
        {{ item.label }}
      </el-menu-item>
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

.main-content {
  padding: 0;
  height: calc(100vh - 64px);
  overflow-y: auto;
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
