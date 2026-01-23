<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { InfoFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRequest } from 'vue-hooks-plus'
import dayjs from 'dayjs'
import { useAuthStore } from '@/store/auth'
import { createWordsCount, queryTaskResult, rewriteParagraph, submitReduceTask } from '@/api/services'
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
    name: '全文改写（降重）',
    price: '3.00积分/千字',
    tooltip: '1、深度改写整段文本；2、保持核心语义不变；3、降低重复率；4、适合论文、报告等长文本优化',
    type: 'rewrite-paragraph' as const,
    platform: 'other' as any,
    subType: 0,
  },
  {
    name: '全文改写（降AI）',
    price: '3.00积分/千字',
    tooltip: '1、深度改写整段文本；2、保持核心语义不变；3、降低AIGC痕迹；4、适合论文、报告等长文本优化',
    type: 'rewrite-paragraph' as const,
    platform: 'other' as any,
    subType: 1,
  },
  {
    name: '知网,维普,格子达文档版',
    price: '3.00积分/千字',
    tooltip: '上传文档进行全文改写，支持 .docx 格式',
    type: 'rewrite-docx' as const,
    platform: 'other' as any,
    isExternal: true,
    path: '/rewrite',
  },
  // {
  //   name: '降AI率（知网版）',
  //   price: '3.00积分/千字',
  //   tooltip: '1、专注降低文本AIGC率，不做降重；2、适配知网检测；3、语句自然通顺，适合审稿前精修；4、实测可将AIGC率稳定降至15%以下',
  //   type: 'reduce-ai-rate' as const,
  //   platform: 'weipu' as const,
  // },
  // {
  //   name: '降AI率（维普版）',
  //   price: '3.00积分/千字',
  //   tooltip: '1、专注降低文本AIGC率，不做降重；2、适配维普检测；3、保持文本结构稳定；4、支持多轮优化，降低审查风险',
  //   type: 'reduce-ai-rate' as const,
  //   platform: 'zhiwang' as const,
  // },
  // {
  //   name: '降重（知网版）',
  //   price: '3.00积分/千字',
  //   tooltip: '1、专注降低文本重复率；2、适配知网查重；3、在保持原意的前提下降低重复率；4、配合格式调整可提升通过率',
  //   type: 'reduce-plagiarism' as const,
  //   platform: 'zhiwang' as const,
  // },
  // {
  //   name: '降重（维普版）',
  //   price: '3.00积分/千字',
  //   tooltip: '1、专注降低文本重复率；2、适配维普查重；3、优化语序和表达，保持逻辑连贯；4、适合维普终审前的深度优化',
  //   type: 'reduce-plagiarism' as const,
  //   platform: 'weipu' as const,
  // },
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
  const tool = aiTools[index]
  if ((tool as any).isExternal && (tool as any).path) {
    router.push((tool as any).path)
    return
  }
  selectedTool.value = index
  console.log('选中工具:', aiTools[index])
}

const maxCharLimit = computed(() => {
  const tool = aiTools[selectedTool.value]
  return tool.name.includes('全文改写') ? 500 : 3000
})

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

  if (charCount.value > maxCharLimit.value) {
    if (maxCharLimit.value === 500) {
      ElMessageBox.confirm(
        '当前文本超过500字，建议使用文档版处理',
        '提示',
        {
          confirmButtonText: '去文档版',
          cancelButtonText: '取消',
          type: 'warning',
        },
      )
        .then(() => {
          router.push('/rewrite')
        })
        .catch(() => {})
      return
    }
    ElMessage.warning(`文本长度不能超过${maxCharLimit.value}字`)
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

  if (tool.type === 'rewrite-paragraph') {
    try {
      isProcessing.value = true
      processingStatus.value = 'processing'

      const res = await rewriteParagraph({
        text: inputText.value,
        type: (tool as any).subType ?? 0,
      })

      if (res) {
        outputText.value = res.text || ''
        resultCharCount.value = outputText.value.length
        processingStatus.value = 'completed'
        ElMessage.success(res.msg || '改写完成')

        // 调用字数统计接口
        try {
          await createWordsCount({
            clientWordsCount: charCount.value,
            createTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          })
        }
        catch (err) {
          console.error('字数统计记录失败:', err)
        }

        // Update balance if cost returned
        if (res.new_balance !== undefined) {
          // We might need to manually update local state or just refetch
          fetchPoints()
        }
        else {
          fetchPoints()
        }
      }
    }
    catch (error: any) {
      console.error(error)
      processingStatus.value = 'failed'
      ElMessage.error(error.message || '改写失败')
    }
    finally {
      isProcessing.value = false
    }
    return
  }

  const params: SubmitTaskParams = {
    text: inputText.value,
    platform: tool.platform as any,
    type: tool.type as any,
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
        <el-card class="sidebar-panel" :body-style="{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }">
          <div class="points-section">
            <div class="points-label">
              当前积分
            </div>
            <div class="points-value">
              {{ truncatedCurrentPoints }}
            </div>
            <el-button type="text" class="recharge-btn" @click="router.push('/balanceRecharge')">
              前往充值
            </el-button>
          </div>

          <div class="tools-list">
            <div
              v-for="(tool, index) in aiTools" :key="tool.name"
              class="tool-item" :class="[{ 'selected-tool': selectedTool === index }]"
              @click="handleToolClick(index)"
            >
              <div class="flex items-center justify-between mb-1">
                <div class="flex items-center space-x-2">
                  <span class="font-medium text-gray-900">{{ tool.name }}</span>
                  <el-tooltip
                    :content="tool.tooltip"
                    placement="right"
                    effect="light"
                  >
                    <el-icon class="info-icon">
                      <InfoFilled />
                    </el-icon>
                  </el-tooltip>
                </div>
              </div>
              <p class="text-xs text-gray-500">
                {{ tool.price }}
              </p>
            </div>
          </div>
        </el-card>
      </div>

      <div class="main-content">
        <el-card class="input-card">
          <template #header>
            <div class="card-header">
              <h2 class="text-lg font-medium text-gray-900">
                {{ aiTools[selectedTool].name }}
              </h2>
              <span class="text-sm text-gray-500">
                单次处理最多 {{ maxCharLimit }} 字{{ maxCharLimit === 500 ? '，建议文档版处理' : '' }}
              </span>
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
                  {{ isProcessing ? `处理中` : '开始生成' }}
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

.input-card :deep(.el-card__body),
.result-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 20px; /* Preserve padding if needed, or adjust */
}

.result-area {
  min-height: 360px;
}

.input-area :deep(.el-textarea) {
  height: 100%;
  resize: none;
}

.input-area :deep(.el-textarea__inner) {
  height: 100% !important;
  border: none;
  box-shadow: none;
}

.result-area :deep(.el-textarea) {
  height: 100%;
  resize: none;
}

.result-area :deep(.el-textarea__inner) {
  height: 100% !important;
  resize: none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  min-height: 50px; /* Standardize header height */
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  min-height: 60px; /* Standardize footer height to accommodate large buttons */
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

/* Sidebar Panel Styles */
.sidebar-panel {
  height: 100%;
  border: none;
  display: flex;
  flex-direction: column;
}

.points-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px 20px;
  text-align: center;
  flex-shrink: 0;
}

.recharge-btn {
  color: rgba(255, 255, 255, 0.9);
  padding: 0;
  height: auto;
}

.recharge-btn:hover {
  color: #fff;
  text-decoration: underline;
}

.tools-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-item {
  cursor: pointer;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  background-color: #f9fafb;
}

.tool-item:hover {
  background-color: #f3f4f6;
  transform: translateY(-1px);
}

.tool-item.selected-tool {
  background-color: #ecf5ff;
  border-color: #409EFF;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.15);
}

.info-icon {
  color: #909399;
  font-size: 14px;
  cursor: help;
  margin-top: 2px;
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
