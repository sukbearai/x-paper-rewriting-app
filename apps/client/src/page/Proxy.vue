<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import DragTable from '@/components/drag-table.vue'
import type { UserListItem, UserRole } from '@/api/interface'
import { queryUserList, updateUserRole } from '@/api/services'
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
const { user: currentUser, isAuthenticated } = storeToRefs(authStore)

const activeTab = ref<TabKey>('users')
const isAdmin = computed(() => currentUser.value?.role === 'admin')
const roleUpdating = ref<Record<string, boolean>>({})

const roleOptions: Array<{ label: string, value: UserRole }> = [
  { label: '管理员', value: 'admin' },
  { label: '代理', value: 'agent' },
  { label: '普通用户', value: 'user' },
]

const roleLabelMap: Record<UserRole, string> = {
  admin: '管理员',
  agent: '代理',
  user: '普通用户',
}

// 用户列表
const usersLoading = ref(false)
const usersRequestId = ref(0)
const usersColumns = ref([
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'username', label: '用户名', minWidth: 140 },
  { prop: 'email', label: '邮箱', minWidth: 200 },
  { prop: 'phone', label: '手机号', minWidth: 160 },
  { prop: 'role', label: '角色', width: 160, slot: 'role' },
  { prop: 'points_balance', label: '积分余额', minWidth: 140 },
  { prop: 'invite_code', label: '邀请码', minWidth: 140 },
  { prop: 'invited_by_username', label: '邀请人用户名', minWidth: 160 },
  { prop: 'created_at', label: '创建时间', minWidth: 180, slot: 'created_at' },
])
const usersData = ref<UserListItem[]>([])
const usersPage = ref<PaginationState>({
  total: 0,
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
})

async function getUsersData() {
  if (!isAuthenticated.value)
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

function setRoleUpdating(userId: string, value: boolean) {
  roleUpdating.value[userId] = value
}

function isRoleUpdating(target: UserListItem) {
  const key = String(target.user_id || target.id)
  return !!roleUpdating.value[key]
}

async function handleRoleChange(target: UserListItem, nextRole: UserRole) {
  if (!isAdmin.value)
    return

  const targetId = String(target.user_id || target.id)
  if (!targetId)
    return

  if (roleUpdating.value[targetId] || target.role === nextRole)
    return

  const previousRole = target.role
  target.role = nextRole
  setRoleUpdating(targetId, true)

  try {
    const response = await updateUserRole({
      target_user_id: targetId,
      role: nextRole,
    })

    target.role = response.role
    if (currentUser.value && currentUser.value.id === response.user_id) {
      currentUser.value.role = response.role
      localStorage.setItem('userRole', response.role)
    }

    ElMessage.success('角色更新成功')
  }
  catch {
    target.role = previousRole
  }
  finally {
    setRoleUpdating(targetId, false)
  }
}

function handleRoleSelect(target: UserListItem, value: string) {
  void handleRoleChange(target, value as UserRole)
}

function formatDate(value?: string | null) {
  if (!value)
    return '-'

  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value
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
  isAuthenticated,
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
        >
          <template #role="{ row }">
            <el-select
              v-if="isAdmin"
              :model-value="row.role"
              size="small"
              placeholder="选择角色"
              :loading="isRoleUpdating(row)"
              :disabled="isRoleUpdating(row)"
              @change="handleRoleSelect(row, $event)"
            >
              <el-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <el-tag v-else>{{ roleLabelMap[row.role] ?? row.role }}</el-tag>
          </template>
          <template #created_at="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </DragTable>
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
