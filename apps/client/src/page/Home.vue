<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { InfoFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRequest } from 'vue-hooks-plus'
import { useAuthStore } from '@/store/auth'
import { queryTaskResult, submitReduceTask } from '@/api/services'
import type { SubmitTaskParams, TaskResultParams } from '@/api/interface'

const authStore = useAuthStore()
const router = useRouter()
const inputText = ref('')
const charCount = ref(0)
const resultCharCount = ref(0)
const outputText = ref('')
const currentTaskId = ref('')
const currentService = ref<'reduceai' | 'cheeyuan'>('reduceai')
const isProcessing = ref(false)
const processingStatus = ref<'idle' | 'processing' | 'completed' | 'failed'>('idle')
const processingProgress = ref(0)

const selectedTool = ref(0)
const aiTools = [
  {
    name: '降AI率（知网版）',
    price: '3.00积分/千字',
    tooltip: '1、专注降低文本AIGC率，不做降重；2、适配知网检测；3、语句自然通顺，适合审稿前精修；4、实测可将AIGC率稳定降至15%以下',
    type: 'reduce-ai-rate' as const,
    platform: 'zhiwang' as const,
  },
  {
    name: '降AI率（维普版）',
    price: '3.00积分/千字',
    tooltip: '1、专注降低文本AIGC率，不做降重；2、适配维普检测；3、保持文本结构稳定；4、支持多轮优化，降低审查风险',
    type: 'reduce-ai-rate' as const,
    platform: 'weipu' as const,
  },
  {
    name: '降重（知网版）',
    price: '3.00积分/千字',
    tooltip: '1、专注降低文本重复率；2、适配知网查重；3、在保持原意的前提下降低重复率；4、配合格式调整可提升通过率',
    type: 'reduce-plagiarism' as const,
    platform: 'zhiwang' as const,
  },
  {
    name: '降重（维普版）',
    price: '3.00积分/千字',
    tooltip: '1、专注降低文本重复率；2、适配维普查重；3、优化语序和表达，保持逻辑连贯；4、适合维普终审前的深度优化',
    type: 'reduce-plagiarism' as const,
    platform: 'weipu' as const,
  },
]

// 获取积分信息
const { data: pointsData, runAsync: fetchPoints } = useRequest(authStore.fetchPoints, {
  manual: true,
})

// 提交任务
const { runAsync: submitTaskAsync, loading: submitLoading } = useRequest(submitReduceTask, {
  manual: true,
  onSuccess: (result) => {
    currentTaskId.value = result.taskId
    currentService.value = result.service
    isProcessing.value = true
    processingStatus.value = 'processing'
    ElMessage.success(`任务提交成功，预计消耗${result.cost}积分`)
    // 开始轮询任务状态
    startPollingTaskStatus()
  },
})

const POLLING_INTERVAL = 5000
const POLLING_TIMEOUT = 300000

// 查询任务结果（利用 useRequest 轮询能力）
const { runAsync: queryResultAsync, cancel: cancelQueryPolling } = useRequest(queryTaskResult, {
  manual: true,
  pollingInterval: POLLING_INTERVAL,
  pollingWhenHidden: false,
  onSuccess: (result) => {
    processingProgress.value = result.progress
    if (result.status === 'completed') {
      clearPollingTimer()
      processingStatus.value = 'completed'
      outputText.value = result.result || ''
      resultCharCount.value = outputText.value.length
      isProcessing.value = false
      ElMessage.success('任务处理完成')
      // 刷新积分余额
      fetchPoints()
    }
    else if (result.status === 'failed') {
      clearPollingTimer()
      processingStatus.value = 'failed'
      isProcessing.value = false
      ElMessage.error('任务处理失败')
      // 刷新积分余额
      fetchPoints()
    }
  },
})

function handleToolClick(index: number) {
  selectedTool.value = index
  console.log('选中工具:', aiTools[index])
}

const estimatedCost = computed(() => {
  return (charCount.value / 1000) * 3.0 // 每1000字3积分
})

const currentPoints = computed(() => {
  return pointsData.value?.points_balance ?? authStore.points ?? 0
})
const truncatedCurrentPoints = computed(() => {
  const value = Math.floor(currentPoints.value * 1000) / 1000
  return value.toFixed(3)
})

function updateCharCount() {
  charCount.value = inputText.value.length
}

async function startProcessing() {
  if (!authStore.isAuthenticated) {
    ElMessage.warning('请先登录')
    return
  }

  if (!inputText.value.trim()) {
    ElMessage.warning('请输入要处理的文本')
    return
  }

  if (charCount.value > 3000) {
    ElMessage.warning('文本长度不能超过3000字')
    return
  }

  // 检查积分是否足够
  if (currentPoints.value < estimatedCost.value) {
    ElMessageBox.confirm(
      `积分不足，当前积分：${currentPoints.value}，需要积分：${estimatedCost.value.toFixed(3)}。是否去充值？`,
      '积分不足',
      {
        confirmButtonText: '去充值',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
      .then(() => {
        // 跳转到充值页面
        router.push('/balanceRecharge')
      })
      .catch(() => {
        // 用户取消
      })
    return
  }

  const tool = aiTools[selectedTool.value]
  const params: SubmitTaskParams = {
    text: inputText.value,
    platform: tool.platform,
    type: tool.type,
  }

  try {
    clearPollingTimer()
    await submitTaskAsync(params)
  }
  catch {
    // 错误已在请求封装中统一提示
  }
}

let pollingTimeoutId: number | null = null

function startPollingTaskStatus() {
  if (!currentTaskId.value)
    return

  clearPollingTimer()

  queryResultAsync({
    taskId: currentTaskId.value,
    service: currentService.value,
  }).catch(() => {
    // 错误已在请求封装中统一提示
  })

  pollingTimeoutId = window.setTimeout(() => {
    clearPollingTimer()
    if (isProcessing.value) {
      isProcessing.value = false
      ElMessage.warning('任务处理超时，请稍后手动查询结果')
    }
  }, POLLING_TIMEOUT)
}

function clearPollingTimer() {
  cancelQueryPolling()
  if (pollingTimeoutId) {
    window.clearTimeout(pollingTimeoutId)
    pollingTimeoutId = null
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('复制成功')
  }
  catch {
    // 如果 clipboard API 不可用，使用降级方案
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      ElMessage.success('复制成功')
    }
    catch {
      ElMessage.error('复制失败')
    }
    document.body.removeChild(textArea)
  }
}

onMounted(() => {
  // 页面加载时获取积分信息
  if (authStore.isAuthenticated) {
    fetchPoints()
  }
})

onBeforeUnmount(() => {
  clearPollingTimer()
})
</script>

<template>
  <div class="home-container">
    <div class="home-content">
      <div class="left-sidebar">
        <div class="space-y-4">
          <!-- 积分信息卡片 -->
          <el-card class="mb-4 points-card">
            <div class="points-info">
              <div class="points-label">
                当前积分
              </div>
              <div class="points-value">
                {{ truncatedCurrentPoints }}
              </div>
              <el-button type="text" :loading="!pointsData" @click="fetchPoints">
                刷新积分
              </el-button>
            </div>
          </el-card>

          <el-card
            v-for="(tool, index) in aiTools" :key="tool.name"
            class="mb-4 tool-card" :class="[{ 'selected-tool': selectedTool === index }]"
            @click="handleToolClick(index)"
          >
            <div class="flex items-center space-x-2">
              <h3 class="font-medium text-gray-900">
                {{ tool.name }}
              </h3> <el-tooltip
                :content="tool.tooltip"
                placement="right"
                effect="light"
              >
                <el-button type="text" class="ml-2">
                  <el-icon>
                    <InfoFilled />
                  </el-icon>
                </el-button>
              </el-tooltip>
            </div>
            <p class="text-sm text-gray-500">
              {{ tool.price }}
            </p>
          </el-card>

          <el-alert title="温馨提示：" type="info" :closable="false" class="mb-4">
            <div class="space-y-2 text-sm">
              <p>1. 问题咨询请联系客服微信：wwdjai</p>
              <p class="text-red-500">
                2. 想成为分站代理，请您联系客服微信：wwdjai
              </p>
            </div>
          </el-alert>
        </div>
      </div>

      <div class="main-content">
        <el-card class="input-card">
          <template #header>
            <div class="card-header">
              <h2 class="text-lg font-medium text-gray-900">
                {{ aiTools[selectedTool].name }}
              </h2>
              <span class="text-sm text-gray-500">单次处理最多 3000 字</span>
            </div>
          </template>

          <div class="input-area">
            <el-input
              v-model="inputText" type="textarea" placeholder="请输入需要处理的文本"
              resize="none"
              class="mb-4" @input="updateCharCount"
            />
          </div>
          <template #footer>
            <div class="card-footer">
              <div class="footer-info">
                <span>当前字数：{{ charCount }}</span>
                <span>当前积分：{{ truncatedCurrentPoints }}</span>
                <span>预计消耗：{{ estimatedCost.toFixed(3) }}积分</span>
              </div>
              <div class="footer-buttons">
                <el-button
                  type="primary" plain size="large" :disabled="!inputText.trim()"
                  @click="inputText = ''"
                >
                  重置
                </el-button>
                <el-button
                  type="primary" size="large" :disabled="!inputText.trim() || isProcessing || submitLoading"
                  :loading="isProcessing || submitLoading" @click="startProcessing"
                >
                  {{ isProcessing ? `处理中(${processingProgress}%)` : '开始生成' }}
                </el-button>
              </div>
            </div>
          </template>
        </el-card>
      </div>

      <div class="right-sidebar">
        <el-card class="result-card">
          <template #header>
            <div class="card-header">
              <h3 class="font-medium text-gray-900">
                结果展示
              </h3>
              <el-button type="primary" :disabled="!outputText" @click="copyToClipboard(outputText)">
                复制结果
              </el-button>
            </div>
          </template>

          <div class="result-area">
            <!-- 处理状态显示 -->
            <div v-if="isProcessing" class="processing-status">
              <!-- <el-progress :percentage="processingProgress" :status="processingStatus === 'failed' ? 'exception' : undefined" /> -->
              <p class="text-center text-sm text-gray-500 mt-2">
                {{ processingStatus === 'processing' ? '正在处理中，请稍候...'
                  : processingStatus === 'failed' ? '任务处理失败' : '处理完成' }}
              </p>
            </div>

            <el-input
              v-else-if="outputText" v-model="outputText" type="textarea"
              resize="none" class="mb-4" disabled
            />
            <el-empty v-else description="生成的结果将显示在这里" :image-size="80" class="new-content" />
          </div>
          <template #footer>
            <div class="card-footer">
              <span class="text-sm text-gray-500">结果字数：{{ resultCharCount }}</span>
            </div>
          </template>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.home-content {
  flex: 1;
  display: flex;
  gap: 24px;
  padding: 12px 24px 24px 24px;
  min-height: 0;
}

.left-sidebar {
  flex: 0 0 280px;
  overflow-y: auto;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  background: #fff;
}

.right-sidebar {
  flex: 0 0 400px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  background: #fff;
}

.input-card, .result-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  /* min-height: 0; */
  overflow: visible;
}

.input-area, .result-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.result-area {
  min-height: 360px;
}

.input-area :deep(.el-textarea) {
  flex: 1;
  min-height: 300px;
  resize: none;
}

.input-area :deep(.el-textarea__inner) {
  min-height: 300px !important;
  border: none;
  box-shadow: none;
}

.result-area :deep(.el-textarea) {
  flex: 1;
  resize: none;
}

.result-area :deep(.el-textarea__inner) {
  min-height: 280px !important;
  resize: none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.footer-info {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #6b7280;
}

.footer-buttons {
  display: flex;
  gap: 8px;
}

/* Custom styles for Element Plus integration */
:deep(.el-tabs__nav-wrap::after) {
    display: none;
}

:deep(.el-header) {
    padding: 0 24px;
}

:deep(.el-card) {
    border-radius: 8px;
}

:deep(.el-alert) {
    border-radius: 8px;
}

/* 积分卡片样式 */
.points-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
}

.points-card :deep(.el-card__body) {
    text-align: center;
    padding: 20px;
}

.points-label {
    font-size: 14px;
    opacity: 0.9;
    margin-bottom: 8px;
}

.points-value {
    font-size: 28px;
    font-weight: bold;
    margin-bottom: 12px;
}

/* 工具卡片样式 */
.tool-card {
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid transparent;
}

.tool-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.tool-card.selected-tool {
    border-color: #409EFF;
    background-color: #f0f9ff;
}

/* 处理状态样式 */
.processing-status {
    padding: 40px 20px;
    text-align: center;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
</style>
