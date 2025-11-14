<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
    name: '同时降AI率和降重(全平台版)',
    price: '3.00积分/千字',
    tooltip: '1、该功能可大幅度降低句子的AIGC率和降重，全平台一次过；2、已处理近万篇，实测95%概率能直接降到15%以下，90%概率能降到10%以下；3、没有其余两个模型语句通顺',
    type: 'reduce-plagiarism' as const,
    platform: 'zhiwang' as const,
  },
  {
    name: '仅降AI率(进阶版)',
    price: '3.00积分/千字',
    tooltip: '1、该功能仅大幅度降低句子的AIGC率，不支持降重，全平台一次过；2、不会提高文本重复率；3、比【同时降AI率和降重(全平台)】语句更通顺；4.已处理近万篇，实测95%概率能直接降到15%以下，90%概率能降到10%以下',
    type: 'reduce-ai-rate' as const,
    platform: 'zhiwang' as const,
  },
  {
    name: '仅降重(全平台版)',
    price: '3.00积分/千字',
    tooltip: '1、该功能仅大幅度降低句子的重复率，不支持降AIGC，全平台一次过；2、不会提高文本AIGC率；3、比【同时降AI率和降重】降重效果更好；4.已处理近万篇，实测95%概率能直接降到15%以下，90%概率能降到10%以下',
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

// 查询任务结果
const { runAsync: queryResultAsync } = useRequest(queryTaskResult, {
  manual: true,
  onSuccess: (result) => {
    processingProgress.value = result.progress
    if (result.status === 'completed') {
      processingStatus.value = 'completed'
      outputText.value = result.result || ''
      resultCharCount.value = outputText.value.length
      isProcessing.value = false
      ElMessage.success('任务处理完成')
      // 刷新积分余额
      fetchPoints()
    }
    else if (result.status === 'failed') {
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
    await submitTaskAsync(params)
  }
  catch {
    // 错误已在请求封装中统一提示
  }
}

let pollingTimer: number | null = null

function startPollingTaskStatus() {
  if (!currentTaskId.value)
    return

  pollingTimer = window.setInterval(async () => {
    try {
      await queryResultAsync({
        taskId: currentTaskId.value,
        service: currentService.value,
      })
    }
    catch {
      // 错误已在请求封装中统一提示
    }
  }, 3000) // 每3秒查询一次

  // 设置超时，避免无限轮询
  setTimeout(() => {
    if (pollingTimer) {
      window.clearInterval(pollingTimer)
      pollingTimer = null
      if (isProcessing.value) {
        isProcessing.value = false
        ElMessage.warning('任务处理超时，请稍后手动查询结果')
      }
    }
  }, 300000) // 5分钟超时
}

function clearPollingTimer() {
  if (pollingTimer) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
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
                {{ currentPoints.toFixed(1) }}
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
              <p>1. 问题咨询请联系客服微信：lwwz6122</p>
              <p>2. 整篇改造，请您先在wps里将文本格式改为docx，并对要修改正文(从摘要到参考文献的内容)标记红色，文本处理后会把红色改为蓝色</p>
              <p>3. 仅降AI不会降重文本重复率，仅降重不会降低文本AIGC率，使用前不要求，请入群使用</p>
              <p>4. 平台AI降重可以对取/维普/万方/格子达/paperyy等主流平台，首码过不了paperpass</p>
              <p class="text-red-500">
                5. 9月开学季特惠：2025/9/04-2025/9/30充值，充充值100元以上，冲多少送多少
              </p>
              <p class="text-red-500">
                6. 想成为分站代理，请您联系客服微信：lwwz6122（可享受代理返利，代理返利比例高达70%）
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
                <span>当前积分：{{ currentPoints.toFixed(1) }}</span>
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
              <el-button type="text" :disabled="!outputText" @click="copyToClipboard(outputText)">
                复制结果
              </el-button>
            </div>
          </template>

          <div class="result-area">
            <!-- 处理状态显示 -->
            <div v-if="isProcessing" class="processing-status">
              <el-progress :percentage="processingProgress" :status="processingStatus === 'failed' ? 'exception' : undefined" />
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
}

.right-sidebar {
  flex: 0 0 400px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.input-card, .result-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.input-area, .result-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
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
  min-height: 0;
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

/* 响应式设计 */
@media (max-width: 1024px) {
  .home-content {
    flex-direction: column;
    gap: 16px;
  }

  .left-sidebar, .right-sidebar {
    flex: none;
    width: 100%;
  }

  .main-content {
    min-height: 300px;
  }
}

@media (max-width: 768px) {
  .home-content {
    padding: 12px 16px;
  }

  .footer-info {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .footer-buttons {
    flex-direction: column;
    width: 100%;
  }

  .footer-buttons .el-button {
    width: 100%;
  }
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

/* 优化滚动条样式 */
:deep(.el-textarea__inner) {
    scrollbar-width: thin;
    scrollbar-color: #c1c1c1 transparent;
}

:deep(.el-textarea__inner)::-webkit-scrollbar {
    width: 6px;
}

:deep(.el-textarea__inner)::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 3px;
}

:deep(.el-textarea__inner)::-webkit-scrollbar-thumb {
    background-color: #c1c1c1;
    border-radius: 3px;
    transition: background-color 0.2s ease;
}

:deep(.el-textarea__inner)::-webkit-scrollbar-thumb:hover {
    background-color: #a8a8a8;
}

.left-sidebar::-webkit-scrollbar {
    width: 6px;
}

.left-sidebar::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
}

.left-sidebar::-webkit-scrollbar-thumb {
    background-color: #c1c1c1;
    border-radius: 3px;
    transition: background-color 0.2s ease;
}

.left-sidebar::-webkit-scrollbar-thumb:hover {
    background-color: #a8a8a8;
}
</style>
