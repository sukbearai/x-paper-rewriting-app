<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import DragTable from '@/components/drag-table.vue'

/* ----- 状态 ----- */
const amount = ref('')
const activeTab = ref<'recharge' | 'transfer'>('recharge')
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)

const rechargeList = ref<any[]>([])
const transferList = ref<any[]>([]) // 模拟空列表

/* ----- 表格列 ----- */
const rechargeColumns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'payAmount', label: '付费金额', width: 120 },
  { prop: 'amount', label: '到账余额', width: 120 },
  { prop: 'remark', label: '备注', minWidth: 300, slot: 'remark' },
  { prop: 'createTime', label: '创建时间', width: 180 },
]

const transferColumns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'payAmount', label: '转账金额', width: 120 },
  { prop: 'toUser', label: '接收人', width: 120 },
  { prop: 'createTime', label: '创建时间', width: 180 },
]

/* ----- 模拟数据 ----- */
function mockRecharge() {
  return Array.from({ length: 11 }, (_, i) => ({
    id: 14259 - i,
    payAmount: (3000 - i * 500).toFixed(3),
    amount: (18000 - i * 2000).toFixed(3),
    remark: `用户：18236582833通过在线支付${(3000 - i * 500).toFixed(2)}元充值${(18000 - i * 2000).toFixed(0)}元`,
    createTime: `2025-08-${25 - i} 09:45:54`,
  }))
}

/* ----- 方法 ----- */
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
  ElMessage.success(`已发起充值：${amount.value} 元`)
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

/* ----- 挂载 ----- */
onMounted(() => fetchData())
</script>

<template>
  <div class="px-6 pt-3">
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
</style>
