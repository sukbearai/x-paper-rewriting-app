<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { TrendCharts, Wallet } from '@element-plus/icons-vue'
import { useRequest } from 'vue-hooks-plus'
import { useAuthStore } from '@/store/auth'
import DragTable from '@/components/drag-table.vue'

const authStore = useAuthStore()

// 状态
const amount = ref('')
const activeTab = ref<'recharge' | 'transfer' | 'points'>('points') // 默认显示积分页面
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)

const rechargeList = ref<any[]>([])
const transferList = ref<any[]>([]) // 模拟空列表

// 获取积分信息
const { data: pointsData, runAsync: fetchPoints, loading: pointsLoading } = useRequest(authStore.fetchPoints, {
  manual: true,
})

// 计算属性
const currentPoints = computed(() => {
  return pointsData.value?.points_balance ?? authStore.points ?? 0
})

const costPerThousand = computed(() => {
  return pointsData.value?.cost_per_1000_chars ?? 3
})

const taskCost = computed(() => {
  return pointsData.value?.task_cost ?? 3
})

// 表格列
const rechargeColumns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'payAmount', label: '付费金额', width: 120 },
  { prop: 'amount', label: '到账积分', width: 120 },
  { prop: 'remark', label: '备注', minWidth: 300, slot: 'remark' },
  { prop: 'createTime', label: '创建时间', width: 180 },
]

const transferColumns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'payAmount', label: '转账金额', width: 120 },
  { prop: 'toUser', label: '接收人', width: 120 },
  { prop: 'createTime', label: '创建时间', width: 180 },
]

// 模拟数据
function mockRecharge() {
  return Array.from({ length: 11 }, (_, i) => ({
    id: 14259 - i,
    payAmount: (3000 - i * 500).toFixed(2),
    amount: (18000 - i * 2000).toFixed(0),
    remark: `用户：18236582833通过在线支付${(3000 - i * 500).toFixed(2)}元充值${(18000 - i * 2000).toFixed(0)}积分`,
    createTime: `2025-08-${25 - i} 09:45:54`,
  }))
}

// 方法
async function fetchData() {
  loading.value = true
  setTimeout(() => {
    rechargeList.value = mockRecharge()
    total.value = rechargeList.value.length
    loading.value = false
  }, 300)
}

function handleRecharge() {
  if (!amount.value || Number(amount.value) <= 0) {
    ElMessage.warning('请输入有效金额')
    return
  }

  // 跳转到支付页面或打开支付弹窗
  ElMessage.info(`充值功能开发中，充值金额：${amount.value} 元`)
  amount.value = ''
  fetchData()
}

function handlePageChange({ page }: any) {
  pageNum.value = page
  fetchData()
}

function handleSizeChange({ size }: any) {
  pageSize.value = size
  pageNum.value = 1
  fetchData()
}

// 刷新积分
function refreshPoints() {
  fetchPoints()
}

// 挂载
onMounted(() => {
  if (authStore.isAuthenticated) {
    fetchPoints()
  }
  fetchData()
})
</script>

<template>
  <div class="px-6 pt-3" style="height: calc(100vh - 64px); overflow-y: auto;">
    <!-- 积分信息卡片 -->
    <el-card shadow="never" class="mb-3 points-info-card">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <el-icon class="text-blue-500">
              <Wallet />
            </el-icon>
            <span class="text-lg font-semibold">积分信息</span>
          </div>
          <el-button
            type="text"
            size="small"
            :loading="pointsLoading"
            @click="refreshPoints"
          >
            刷新
          </el-button>
        </div>
      </template>

      <div class="points-grid">
        <div class="points-item current-balance">
          <div class="points-label">
            当前积分余额
          </div>
          <div class="points-value">
            {{ currentPoints.toFixed(1) }}
          </div>
        </div>

        <div class="points-item cost-info">
          <div class="points-label">
            每千字消耗积分
          </div>
          <div class="points-value">
            {{ costPerThousand }} 积分
          </div>
        </div>

        <div class="points-item task-info">
          <div class="points-label">
            基础任务费用
          </div>
          <div class="points-value">
            {{ taskCost }} 积分
          </div>
        </div>
      </div>

      <el-alert
        title="充值说明"
        type="info"
        :closable="false"
        class="mt-4"
      >
        <ul class="space-y-1 text-sm">
          <li>• 积分按实际字数比例计算，每1000字消耗{{ costPerThousand }}积分</li>
          <li>• 积分计算结果保留3位小数，采用截取而非四舍五入</li>
          <li>• 任务失败时对应的积分交易记录会被标记为失败状态</li>
          <li>• 失败任务的积分不会自动退还，需要联系客服手动处理</li>
        </ul>
      </el-alert>
    </el-card>

    <!-- 充值卡片 -->
    <el-card shadow="never" class="mb-3">
      <template #header>
        <span class="text-lg font-semibold">普通充值</span>
      </template>

      <div class="flex items-end gap-4">
        <el-input
          v-model="amount"
          placeholder="请输入充值金额"
          type="number"
          min="10"
          style="width: 240px"
        />
        <el-button type="primary" @click="handleRecharge">
          点击充值
        </el-button>
      </div>
    </el-card>

    <!-- 记录区域 -->
    <el-card shadow="never">
      <el-tabs v-model="activeTab">
        <el-tab-pane name="points">
          <template #label>
            <div class="flex items-center gap-1">
              <el-icon><TrendCharts /></el-icon>
              <span>积分详情</span>
            </div>
          </template>

          <div class="points-detail-content">
            <div class="points-summary">
              <div class="summary-item">
                <span class="summary-label">可用积分</span>
                <span class="summary-value available">{{ currentPoints.toFixed(1) }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">消耗标准</span>
                <span class="summary-value">{{ costPerThousand }}积分/千字</span>
              </div>
            </div>

            <div class="usage-info">
              <h4 class="usage-title">
                使用说明
              </h4>
              <div class="usage-list">
                <div class="usage-item">
                  <span class="usage-text">短文本（1000字以内）</span>
                  <span class="usage-cost">{{ (costPerThousand).toFixed(1) }}积分</span>
                </div>
                <div class="usage-item">
                  <span class="usage-text">中等文本（2000字）</span>
                  <span class="usage-cost">{{ (costPerThousand * 2).toFixed(1) }}积分</span>
                </div>
                <div class="usage-item">
                  <span class="usage-text">长文本（3000字）</span>
                  <span class="usage-cost">{{ (costPerThousand * 3).toFixed(1) }}积分</span>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="充值记录" name="recharge">
          <DragTable
            height="50vh"
            :columns="rechargeColumns"
            :data="{ name: 'rechargeList', data: rechargeList }"
            :loading="loading"
            :show-pagination="true"
            :total="total"
            :page-num="pageNum"
            :page-size="pageSize"
            @page-num-change="handlePageChange"
            @page-size-change="handleSizeChange"
          >
            <template #remark="{ row }">
              <span class="text-gray-600">{{ row.remark }}</span>
            </template>
          </DragTable>
        </el-tab-pane>

        <el-tab-pane label="转账记录" name="transfer">
          <DragTable
            height="50vh"
            :columns="transferColumns"
            :data="{ name: 'transferList', data: transferList }"
            :loading="loading"
            :show-pagination="true"
            :total="total"
            :page-num="pageNum"
            :page-size="pageSize"
            @page-num-change="handlePageChange"
            @page-size-change="handleSizeChange"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
/* 让 card 圆角更柔和 */
.el-card {
  border-radius: 12px;
}

/* 积分信息卡片样式 */
.points-info-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;

  :deep(.el-card__header) {
    background: rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }
}

.points-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  margin-top: 20px;
}

.points-item {
  text-align: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.points-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.points-value {
  font-size: 28px;
  font-weight: bold;
}

.current-balance {
  background: rgba(255, 255, 255, 0.15);
}

.current-balance .points-value {
  color: #ffd700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* 积分详情页面样式 */
.points-detail-content {
  padding: 20px;
}

.points-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.summary-item {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #e9ecef;
}

.summary-label {
  display: block;
  font-size: 14px;
  color: #6c757d;
  margin-bottom: 8px;
}

.summary-value {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #495057;
}

.summary-value.available {
  color: #28a745;
}

.usage-info {
  background: #ffffff;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.usage-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #495057;
}

.usage-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.usage-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.usage-text {
  color: #495057;
  font-size: 14px;
}

.usage-cost {
  color: #007bff;
  font-weight: bold;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .points-grid {
    grid-template-columns: 1fr;
  }

  .points-summary {
    grid-template-columns: 1fr;
  }

  .usage-list {
    gap: 8px;
  }

  .usage-item {
    padding: 8px 12px;
  }
}
</style>
