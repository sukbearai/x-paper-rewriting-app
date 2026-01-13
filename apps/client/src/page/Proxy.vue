<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import DragTable from '@/components/drag-table.vue'
import type { RechargeRecord, UserListItem, UserRole } from '@/api/interface'
import { payForDownline, queryRechargeRecords, queryUserList, updateUserPoints, updateUserRate, updateUserRole } from '@/api/services'
import { useAuthStore } from '@/store/auth'

type TabKey = 'users' | 'recharges'
type RechargeScope = 'all' | 'downline'

const DEFAULT_PAGE_SIZE = 30

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
const isAgent = computed(() => currentUser.value?.role === 'agent')
const canViewRecharges = computed(() => isAdmin.value || isAgent.value)
const roleUpdating = ref<Record<string, boolean>>({})
const rateUpdating = ref<Record<string, boolean>>({})
const pointsUpdating = ref<Record<string, boolean>>({})

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

function resolveRoleLabel(role?: string | null) {
  if (!role)
    return roleLabelMap.user
  const normalized = role.toLowerCase() as UserRole
  return roleLabelMap[normalized] ?? role
}

// 用户列表
const usersLoading = ref(false)
const usersRequestId = ref(0)
const usersColumns = ref([
  // { prop: 'id', label: 'ID', width: 80 },
  { prop: 'username', label: '用户名', minWidth: 100 },
  // { prop: 'email', label: '邮箱', minWidth: 130 },
  { prop: 'phone', label: '手机号', minWidth: 110 },
  { prop: 'role', label: '角色', width: 120, slot: 'role' },
  { prop: 'rate', label: '费率', width: 160, slot: 'rate' },
  { prop: 'points_balance', label: '积分余额', minWidth: 140, slot: 'points_balance' },
  { prop: 'invite_code', label: '邀请码', minWidth: 60 },
  { prop: 'invited_by_username', label: '邀请人用户名', minWidth: 100 },
  { prop: 'created_at', label: '创建时间', minWidth: 180, slot: 'created_at' },
  { prop: 'actions', label: '操作', width: 120, slot: 'actions', fixed: 'right' as const },
])
const usersData = ref<UserListItem[]>([])
const usersPage = ref<PaginationState>({
  total: 0,
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
})
const searchPhone = ref('')
const searchUsername = ref('')

function handleSearch() {
  usersPage.value.pageNum = 1
  getUsersData()
}

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
      phone: searchPhone.value || undefined,
      username: searchUsername.value || undefined,
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

function setRateUpdating(userId: string, value: boolean) {
  rateUpdating.value[userId] = value
}

function isRateUpdating(target: UserListItem) {
  const key = String(target.user_id || target.id)
  return !!rateUpdating.value[key]
}

function setPointsUpdating(userId: string, value: boolean) {
  pointsUpdating.value[userId] = value
}

function isPointsUpdating(target: UserListItem) {
  const key = String(target.user_id || target.id)
  return !!pointsUpdating.value[key]
}

async function handleRateChange(target: UserListItem, nextRate: number | null) {
  if (!isAdmin.value || nextRate === null)
    return

  const targetId = String(target.user_id || target.id)
  if (!targetId)
    return

  if (rateUpdating.value[targetId] || target.rate === nextRate)
    return

  const previousRate = target.rate
  target.rate = nextRate
  setRateUpdating(targetId, true)

  try {
    const response = await updateUserRate({
      target_user_id: targetId,
      rate: nextRate,
    })

    target.rate = response.rate
    ElMessage.success('费率更新成功')
  }
  catch {
    target.rate = previousRate
  }
  finally {
    setRateUpdating(targetId, false)
  }
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

async function handlePointsChange(target: UserListItem, nextBalance: number | null) {
  if (!isAdmin.value || nextBalance === null)
    return

  const targetId = String(target.user_id || target.id)
  if (!targetId)
    return

  if (pointsUpdating.value[targetId] || target.points_balance === nextBalance)
    return

  const previousBalance = target.points_balance
  const amount = nextBalance - previousBalance

  if (amount === 0)
    return

  target.points_balance = nextBalance
  setPointsUpdating(targetId, true)

  try {
    const response = await updateUserPoints({
      target_user_id: targetId,
      amount,
      description: `管理员 ${currentUser.value?.username} 通内联方式调整积分`,
    })

    target.points_balance = response.points_balance
    ElMessage.success('积分更新成功')
  }
  catch (err: any) {
    target.points_balance = previousBalance
    const msg = err?.response?.data?.message || '积分更新失败'
    ElMessage.error(msg)
  }
  finally {
    setPointsUpdating(targetId, false)
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

function formatPoints(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value))
    return '0.000'

  const numeric = Number(value)
  if (Number.isNaN(numeric))
    return '0.000'

  const factor = 1000
  const truncated = numeric >= 0
    ? Math.floor(numeric * factor) / factor
    : Math.ceil(numeric * factor) / factor
  return truncated.toFixed(3)
}

// 充值记录
const rechargesLoading = ref(false)
const rechargesRequestId = ref(0)
const rechargesColumns = ref([
  { prop: 'id', label: '记录ID', width: 100 },
  { prop: 'username', label: '充值用户', minWidth: 160, slot: 'username' },
  { prop: 'user_id', label: '用户ID', minWidth: 220, slot: 'user_id' },
  { prop: 'email', label: '邮箱', minWidth: 200, slot: 'email' },
  { prop: 'phone', label: '手机号', minWidth: 160, slot: 'phone' },
  { prop: 'role', label: '角色', width: 120, slot: 'profile_role' },
  { prop: 'inviter', label: '邀请人', minWidth: 160, slot: 'inviter' },
  { prop: 'amount', label: '充值积分', minWidth: 140, slot: 'amount' },
  { prop: 'balance_after', label: '变动后余额', minWidth: 140, slot: 'balance' },
  { prop: 'description', label: '备注', minWidth: 220, slot: 'description' },
  { prop: 'status', label: '状态', width: 120, slot: 'status' },
  { prop: 'created_at', label: '充值时间', minWidth: 180, slot: 'created_at' },
])
const rechargesData = ref<RechargeRecord[]>([])
const rechargesPage = ref<PaginationState>({
  total: 0,
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
})
const rechargeScope = ref<RechargeScope | null>(null)

const rechargeScopeLabel = computed(() => {
  if (!canViewRecharges.value)
    return '无权限'
  if (!rechargeScope.value)
    return isAdmin.value ? '全部充值记录' : '下级充值记录'
  return rechargeScope.value === 'all' ? '全部充值记录' : '下级充值记录'
})

function resetRechargesState() {
  rechargesData.value = []
  rechargesPage.value.total = 0
  rechargesPage.value.pageNum = 1
  rechargesPage.value.pageSize = DEFAULT_PAGE_SIZE
  rechargesRequestId.value = 0
  rechargesLoading.value = false
  rechargeScope.value = null
}

async function getRechargesData() {
  if (!isAuthenticated.value || !canViewRecharges.value) {
    resetRechargesState()
    return
  }

  const requestId = rechargesRequestId.value + 1
  rechargesRequestId.value = requestId
  rechargesLoading.value = true

  try {
    const response = await queryRechargeRecords({
      page: rechargesPage.value.pageNum,
      limit: rechargesPage.value.pageSize,
    })

    if (rechargesRequestId.value !== requestId)
      return

    rechargesData.value = response?.records ?? []
    rechargesPage.value.total = response?.pagination?.total ?? rechargesData.value.length
    rechargeScope.value = response?.scope ?? null
  }
  catch {
    if (rechargesRequestId.value !== requestId)
      return

    rechargesData.value = []
    rechargesPage.value.total = 0
    rechargeScope.value = null
  }
  finally {
    if (rechargesRequestId.value === requestId)
      rechargesLoading.value = false
  }
}

function handleRechargesPageChange(payload: PageChangePayload) {
  if (!payload?.page)
    return

  rechargesPage.value.pageNum = payload.page
  rechargesPage.value.pageSize = payload.size
  getRechargesData()
}

function handleRechargesSizeChange(payload: PageChangePayload) {
  if (!payload?.size)
    return

  rechargesPage.value.pageSize = payload.size
  rechargesPage.value.pageNum = payload.page
  getRechargesData()
}

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
      resetRechargesState()
      return
    }

    if (activeTab.value === 'users')
      getUsersData()
    if (activeTab.value === 'recharges' && canViewRecharges.value)
      getRechargesData()
  },
  { immediate: true },
)

watch(activeTab, (tab) => {
  if (tab === 'users')
    getUsersData()
  else if (tab === 'recharges' && canViewRecharges.value)
    getRechargesData()
})

watch(() => currentUser.value?.role, () => {
  if (!isAuthenticated.value)
    return

  if (!canViewRecharges.value) {
    resetRechargesState()
    return
  }

  if (activeTab.value === 'recharges')
    getRechargesData()
})

// 代理代付充值功能
const rechargeDialogVisible = ref(false)
const rechargeForm = ref({
  targetUserId: '',
  targetUsername: '',
  amount: 100,
  subject: '代理充值',
})
const rechargeFormRef = ref()
const rechargeSubmitting = ref(false)

// 计算预计到账积分（使用代理费率）
const estimatedPoints = computed(() => {
  if (!rechargeForm.value.amount || !currentUser.value?.rate)
    return 0
  const agentRate = Number(currentUser.value.rate ?? 1)
  return (rechargeForm.value.amount * agentRate).toFixed(3)
})

// 选中下级的费率
const selectedUserRate = computed(() => {
  if (!rechargeForm.value.targetUserId)
    return 0
  const user = usersData.value.find(u => u.user_id === rechargeForm.value.targetUserId)
  return user?.rate ?? 0
})

// 费率优惠（代理费率 - 下级费率）
const rateAdvantage = computed(() => {
  if (!currentUser.value?.rate || !selectedUserRate.value)
    return 0
  const agentRate = Number(currentUser.value.rate ?? 1)
  return (agentRate - selectedUserRate.value).toFixed(3)
})

// 打开充值弹窗
function openRechargeDialog(user: UserListItem) {
  rechargeForm.value = {
    targetUserId: user.user_id,
    targetUsername: user.username || user.email || user.user_id,
    amount: 100,
    subject: '代理充值',
  }
  rechargeDialogVisible.value = true
}

// 关闭充值弹窗
function closeRechargeDialog() {
  rechargeDialogVisible.value = false
  rechargeFormRef.value?.resetFields()
}

// 处理充值提交
async function handleRechargeSubmit() {
  if (!rechargeForm.value.targetUserId || !rechargeForm.value.amount) {
    ElMessage.warning('请填写完整的充值信息')
    return
  }

  if (rechargeForm.value.amount < 1 || !Number.isInteger(rechargeForm.value.amount)) {
    ElMessage.warning('充值金额必须为正整数')
    return
  }

  rechargeSubmitting.value = true
  try {
    const html = await payForDownline({
      target_user_id: rechargeForm.value.targetUserId,
      total_amount: rechargeForm.value.amount,
      subject: rechargeForm.value.subject || '代理充值',
      return_url: 'https://www.ttdjai.com/proxy',
    })

    // 创建一个隐藏的容器来渲染支付表单
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    // 自动提交表单
    const form = container.querySelector('form')
    if (form) {
      form.submit()
    }

    closeRechargeDialog()
    ElMessage.success('正在跳转到支付页面...')
  }
  catch (err: any) {
    const msg = err?.response?.data?.message || '充值失败'
    ElMessage.error(msg)
  }
  finally {
    rechargeSubmitting.value = false
  }
}

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
      resetRechargesState()
      return
    }

    if (activeTab.value === 'users')
      getUsersData()
    if (activeTab.value === 'recharges' && canViewRecharges.value)
      getRechargesData()
  },
  { immediate: true },
)

watch(activeTab, (tab) => {
  if (tab === 'users')
    getUsersData()
  else if (tab === 'recharges' && canViewRecharges.value)
    getRechargesData()
})

watch(() => currentUser.value?.role, () => {
  if (!isAuthenticated.value)
    return

  if (!canViewRecharges.value) {
    resetRechargesState()
    return
  }

  if (activeTab.value === 'recharges')
    getRechargesData()
})
</script>

<template>
  <div class="home">
    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="用户列表" name="users">
        <div class="filter-container">
          <el-input
            v-model="searchUsername"
            placeholder="搜索用户名"
            style="width: 200px; margin-right: 10px;"
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-input
            v-model="searchPhone"
            placeholder="搜索手机号"
            style="width: 200px; margin-right: 10px;"
            clearable
            maxlength="11"
            @input="searchPhone = searchPhone.replace(/\D/g, '')"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" @click="handleSearch">
            搜索
          </el-button>
        </div>
        <DragTable
          fit
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
            <el-tag v-else>
              {{ roleLabelMap[row.role as UserRole] ?? row.role }}
            </el-tag>
          </template>
          <template #rate="{ row }">
            <el-input-number
              v-if="isAdmin"
              :model-value="row.rate"
              size="small"
              :min="0"
              :max="10"
              :step="1"
              :disabled="isRateUpdating(row)"
              @change="handleRateChange(row, $event ?? null)"
            />
            <span v-else>{{ row.rate }}</span>
          </template>
          <template #points_balance="{ row }">
            <el-input-number
              v-if="isAdmin"
              :model-value="row.points_balance"
              size="small"
              :precision="3"
              :step="1"
              :disabled="isPointsUpdating(row)"
              @change="handlePointsChange(row, $event ?? null)"
            />
            <span v-else>{{ formatPoints(row.points_balance) }}</span>
          </template>
          <template #created_at="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
          <template #actions="{ row }">
            <el-button
              v-if="(isAgent || isAdmin) && row.user_id !== currentUser?.id"
              type="primary"
              size="small"
              @click="openRechargeDialog(row)"
            >
              充值
            </el-button>
          </template>
        </DragTable>
      </el-tab-pane>

      <el-tab-pane label="充值记录" name="recharges">
        <template v-if="canViewRecharges">
          <div class="scope-tip">
            当前范围：{{ rechargeScopeLabel }}
          </div>
          <DragTable
            fit
            :data="{ name: 'recharges', data: rechargesData }"
            :columns="rechargesColumns"
            :loading="rechargesLoading"
            border
            :show-pagination="true"
            :total="rechargesPage.total"
            :page-size="rechargesPage.pageSize"
            :page-num="rechargesPage.pageNum"
            @page-num-change="handleRechargesPageChange"
            @page-size-change="handleRechargesSizeChange"
          >
            <template #username="{ row }">
              {{ row.profile?.username ?? '--' }}
            </template>
            <template #user_id="{ row }">
              {{ row.profile?.user_id ?? '--' }}
            </template>
            <template #email="{ row }">
              {{ row.profile?.email ?? '--' }}
            </template>
            <template #phone="{ row }">
              {{ row.profile?.phone ?? '--' }}
            </template>
            <template #profile_role="{ row }">
              <el-tag size="small" effect="plain">
                {{ resolveRoleLabel(row.profile?.role ?? null) }}
              </el-tag>
            </template>
            <template #inviter="{ row }">
              {{ row.profile?.invited_by_username ?? '--' }}
            </template>
            <template #amount="{ row }">
              <span :class="row.amount >= 0 ? 'amount-positive' : 'amount-negative'">
                {{ formatPoints(row.amount) }}
              </span>
            </template>
            <template #balance="{ row }">
              {{ formatPoints(row.balance_after) }}
            </template>
            <template #description="{ row }">
              <span class="text-muted">{{ row.description || '--' }}</span>
              <span v-if="row.reference_id" class="reference-hint">
                ({{ row.reference_id }})
              </span>
            </template>
            <template #status="{ row }">
              <el-tag :type="row.is_successful ? 'success' : 'warning'" size="small">
                {{ row.is_successful ? '成功' : '失败' }}
              </el-tag>
            </template>
            <template #created_at="{ row }">
              {{ formatDate(row.created_at) }}
            </template>
          </DragTable>
        </template>
        <div v-else class="recharge-empty-hint">
          仅管理员或代理可查看充值记录
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 代理代付充值弹窗 -->
    <el-dialog
      v-model="rechargeDialogVisible"
      title="为下级充值"
      width="500px"
      :close-on-click-modal="false"
      @close="closeRechargeDialog"
    >
      <el-form
        ref="rechargeFormRef"
        :model="rechargeForm"
        label-width="120px"
      >
        <el-form-item label="充值用户">
          <el-input
            v-model="rechargeForm.targetUsername"
            disabled
            placeholder="用户名"
          />
        </el-form-item>

        <el-form-item label="充值金额（元）" required>
          <el-input-number
            v-model="rechargeForm.amount"
            :min="1"
            :step="1"
            :precision="0"
            style="width: 100%"
          />
          <div style="margin-top: 8px; font-size: 13px; color: #6b7280;">
            <div>
              预计到账积分: <span style="color: #16a34a; font-weight: 500;">{{ estimatedPoints }}</span> 点
              （使用您的代理费率 {{ currentUser?.rate || 1 }}）
            </div>
            <div v-if="Number(rateAdvantage) > 0" style="color: #16a34a; margin-top: 4px;">
              💰 比下级自己充值多获得: {{ (rechargeForm.amount * Number(rateAdvantage)).toFixed(3) }} 积分
            </div>
          </div>
        </el-form-item>

        <el-form-item label="充值说明">
          <el-input
            v-model="rechargeForm.subject"
            placeholder="例如：月度充值"
            maxlength="50"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="closeRechargeDialog">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="rechargeSubmitting"
          @click="handleRechargeSubmit"
        >
          {{ rechargeSubmitting ? '处理中...' : '确认充值' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.home {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
:deep(.el-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
:deep(.el-tabs__content) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
:deep(.el-tab-pane) {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
:deep(.table-box) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
:deep(.tableInner) {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
:deep(.pager) {
  flex-shrink: 0;
}
.scope-tip {
  margin-bottom: 12px;
  font-size: 13px;
  color: #6b7280;
}
.filter-container {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
}
.recharge-empty-hint {
  height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #6b7280;
  text-align: center;
  padding: 0 12px;
}
.amount-positive {
  color: #16a34a;
}
.amount-negative {
  color: #dc2626;
}
.text-muted {
  color: #6b7280;
}
.reference-hint {
  margin-left: 4px;
  font-size: 12px;
  color: #9ca3af;
}
</style>
