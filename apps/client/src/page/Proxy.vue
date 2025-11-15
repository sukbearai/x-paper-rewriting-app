<script setup lang="ts">
import { ref, watch } from 'vue'
import DragTable from '@/components/drag-table.vue'
import type { UserListItem } from '@/api/interface'
import { queryUserList } from '@/api/services'
import { useAuthStore } from '@/store/auth'

type TabKey = 'users' | 'transfers'

const DEFAULT_PAGE_SIZE = 10

interface PaginationState {
  total: number
  pageNum: number
  pageSize: number
}

interface PageChangePayload {
  page: number
  size: number
}

const authStore = useAuthStore()

const activeTab = ref<TabKey>('users')

// 用户列表
const usersLoading = ref(false)
const usersRequestId = ref(0)
const usersColumns = ref([
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'username', label: '用户名', minWidth: 140 },
  { prop: 'email', label: '邮箱', minWidth: 200 },
  { prop: 'phone', label: '手机号', minWidth: 160 },
  { prop: 'role', label: '角色', width: 120 },
  { prop: 'points_balance', label: '积分余额', minWidth: 140 },
  { prop: 'invite_code', label: '邀请码', minWidth: 140 },
  { prop: 'invited_by', label: '邀请人', minWidth: 140 },
  { prop: 'created_at', label: '创建时间', minWidth: 180 },
])
const usersData = ref<UserListItem[]>([])
const usersPage = ref<PaginationState>({
  total: 0,
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
})

async function getUsersData() {
  if (!authStore.isAuthenticated)
    return

  const requestId = usersRequestId.value + 1
  usersRequestId.value = requestId
  usersLoading.value = true

  try {
    const response = await queryUserList({
      page: usersPage.value.pageNum,
      limit: usersPage.value.pageSize,
    })

    if (usersRequestId.value !== requestId)
      return

    usersData.value = response?.users ?? []
    usersPage.value.total = response?.total ?? usersData.value.length
  }
  catch {
    if (usersRequestId.value !== requestId)
      return

    usersData.value = []
    usersPage.value.total = 0
  }
  finally {
    if (usersRequestId.value === requestId)
      usersLoading.value = false
  }
}

function handleUsersPageChange(payload: PageChangePayload) {
  if (!payload?.page)
    return

  usersPage.value.pageNum = payload.page
  usersPage.value.pageSize = payload.size
  getUsersData()
}

function handleUsersSizeChange(payload: PageChangePayload) {
  if (!payload?.size)
    return

  usersPage.value.pageSize = payload.size
  usersPage.value.pageNum = payload.page
  getUsersData()
}

// 模拟转账记录
const transfersColumns = ref([
  { prop: 'toUser', label: '转账给用户' },
  { prop: 'remark', label: '备注' },
  { prop: 'createdAt', label: '创建时间' },
])

function getTransfersData() {
  // getTransfers(transfersPage.value.pageNum, transfersPage.value.pageSize).then((res) => {
  //   transfersData.value = res.data
  //   transfersPage.value.total = res.total
  // })
}

const transfersPage = ref<PaginationState>({
  total: 2,
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
})

function handleTransfersPageChange(payload: PageChangePayload) {
  if (!payload?.page)
    return

  transfersPage.value.pageNum = payload.page
  transfersPage.value.pageSize = payload.size
  getTransfersData()
}

function handleTransfersSizeChange(payload: PageChangePayload) {
  if (!payload?.size)
    return

  transfersPage.value.pageSize = payload.size
  transfersPage.value.pageNum = payload.page
  getTransfersData()
}

const transfersData = ref([
  {
    id: 6079,
    toUser: 'scott',
    remark: '您从付费账户已支付1000元为用户scott充值1000元',
    createdAt: '2025-09-24 10:42:01',
  },
  {
    id: 6078,
    toUser: 'Zxriwzy',
    remark: '您从付费账户已支付500元为用户Zxriwzy充值500元',
    createdAt: '2025-09-24 10:40:33',
  },
])

watch(
  () => authStore.isAuthenticated,
  (isAuthed) => {
    if (!isAuthed) {
      usersData.value = []
      usersPage.value.total = 0
      usersPage.value.pageNum = 1
      usersPage.value.pageSize = DEFAULT_PAGE_SIZE
      usersRequestId.value = 0
      usersLoading.value = false
      return
    }

    if (activeTab.value === 'users')
      getUsersData()
  },
  { immediate: true },
)

watch(activeTab, (tab) => {
  if (tab === 'users')
    getUsersData()
})
</script>

<template>
  <div class="home">
    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="用户列表" name="users">
        <DragTable
          height="70vh"
          :data="{ name: 'users', data: usersData }"
          :columns="usersColumns"
          :loading="usersLoading"
          border
          :show-pagination="true"
          :total="usersPage.total"
          :page-size="usersPage.pageSize"
          :page-num="usersPage.pageNum"
          @page-num-change="handleUsersPageChange"
          @page-size-change="handleUsersSizeChange"
        />
      </el-tab-pane>

      <el-tab-pane label="转账记录" name="transfers">
        <DragTable
          height="70vh"
          :data="{ name: 'transfers', data: transfersData }"
          :columns="transfersColumns"
          border
          :show-pagination="true"
          :total="transfersPage.total"
          :page-size="transfersPage.pageSize"
          :page-num="transfersPage.pageNum"
          @page-num-change="handleTransfersPageChange"
          @page-size-change="handleTransfersSizeChange"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.home {
  padding: 20px;
  height: 100%;
}
:deep(.el-tabs){
  height: 100%;
}
</style>
