<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import mammoth from 'mammoth'
import dayjs from 'dayjs'
import { checkRewriteState, createWordsCount, queryPoints, rewriteDocx } from '@/api/services'

const rewriteTypes = [
  { label: '降低重复率', value: '0' },
  { label: '降低AIGC痕迹', value: '1' },
]

const currentType = ref('0')
const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const processing = ref(false)
const completed = ref(false)
const orderId = ref('')
const downloadUrl = ref('')
const pollTimer = ref<any>(null)
const uploadInfo = ref({ wordCount: 0, cost: 0 })
const fileWordCount = ref(0)
const countingWords = ref(false)
const currentBalance = ref(0)
const estimatedCost = ref(0)

onMounted(async () => {
  try {
    const res = await queryPoints()
    if (res && res.points_balance !== undefined) {
      currentBalance.value = res.points_balance
    }
  }
  catch (error) {
    console.error('获取积分余额失败:', error)
  }
})

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    validateAndSetFile(target.files[0])
  }
}

function handleDrop(event: DragEvent) {
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    validateAndSetFile(event.dataTransfer.files[0])
  }
}

async function validateAndSetFile(file: File) {
  if (!file.name.endsWith('.docx')) {
    ElMessage.error('仅支持 .docx 格式的文件')
    return
  }
  selectedFile.value = file
  fileWordCount.value = 0
  estimatedCost.value = 0

  // 读取文档字数
  try {
    countingWords.value = true
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    const text = result.value
    // 统计汉字和英文字母的数量
    const words = text.match(/[a-z\u4E00-\u9FA5]/gi)
    const count = words ? words.length : 0
    fileWordCount.value = count

    // 计算预估积分: 每1000字3积分
    const POINTS_PER_1000_CHARS = 3
    estimatedCost.value = Math.max(0.01, Math.trunc((count / 1000 * POINTS_PER_1000_CHARS) * 1000) / 1000)
  }
  catch (error) {
    console.error('读取文档失败:', error)
    ElMessage.warning('无法读取文档字数')
  }
  finally {
    countingWords.value = false
  }
}

async function startRewrite() {
  if (!selectedFile.value)
    return

  if (currentBalance.value < estimatedCost.value) {
    ElMessage.error(`积分不足，需要 ${estimatedCost.value} 积分，当前余额 ${currentBalance.value} 积分`)
    return
  }

  try {
    processing.value = true
    const res = await rewriteDocx({
      file: selectedFile.value,
      rewrite_type: currentType.value,
    })

    if (res && res.order_id) {
      orderId.value = res.order_id
      if (res.word_count)
        uploadInfo.value.wordCount = Number(res.word_count)
      if (res.cost)
        uploadInfo.value.cost = Number(res.cost)

      // 更新余额
      if (res.new_balance !== undefined) {
        currentBalance.value = res.new_balance
      }

      startPolling()
    }
    else {
      throw new Error('Invalid response from server')
    }
  }
  catch (error: any) {
    ElMessage.error(error.message || '上传失败，请重试')
    processing.value = false
  }
}

function startPolling() {
  if (pollTimer.value)
    clearInterval(pollTimer.value)

  pollTimer.value = setInterval(async () => {
    try {
      const res = await checkRewriteState({
        order_id: orderId.value,
      })

      if (res.state === 2 && res.download_url) {
        downloadUrl.value = res.download_url
        completed.value = true
        processing.value = false
        stopPolling()

        // 调用字数统计接口
        try {
          await createWordsCount({
            clientWordsCount: fileWordCount.value,
            serverWordsCount: uploadInfo.value.wordCount || undefined,
            downloadUrl: res.download_url,
            orderId: orderId.value,
            createTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          })
        }
        catch (err) {
          console.error('字数统计记录失败:', err)
        }
      }
      else if (res.state !== 0 && res.state !== 2) {
        // Assuming other states might indicate failure or stopped processing?
        // User didn't specify failure codes, but if it's not 0 (processing) and not 2 (success), might be error.
        // For now, let's just log it or maybe timeout will handle it.
        // Let's assume if success is false, it's failed.
        if (res.success === false) {
          ElMessage.error('改写失败，请稍后重试')
          processing.value = false
          stopPolling()
        }
      }
    }
    catch (error) {
      console.error('Polling error:', error)
      // Optional: stop polling after certain failures or keep retrying
    }
  }, 2000) // Poll every 2 seconds
}

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

function reset() {
  selectedFile.value = null
  processing.value = false
  completed.value = false
  orderId.value = ''
  downloadUrl.value = ''
  if (fileInput.value)
    fileInput.value.value = ''
  // 刷新余额
  queryPoints().then((res) => {
    if (res && res.points_balance !== undefined) {
      currentBalance.value = res.points_balance
    }
  }).catch(console.error)
}

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="max-w-4xl mx-auto p-6">
    <div class="bg-white rounded-xl shadow-lg p-8">
      <h1 class="text-2xl font-bold mb-6 text-gray-800">
        文档改写 (Document Rewrite)
      </h1>

      <!-- Upload Section -->
      <div v-if="!processing && !completed" class="space-y-6">
        <div
          class="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
          @drop.prevent="handleDrop"
          @dragover.prevent
          @click="triggerFileInput"
        >
          <input
            ref="fileInput"
            type="file"
            class="hidden"
            accept=".docx"
            @change="handleFileChange"
          >
          <div v-if="selectedFile" class="text-green-600 font-medium text-lg">
            <span class="mr-2">📄</span> {{ selectedFile.name }}
            <div v-if="countingWords" class="text-sm text-gray-500 mt-1">
              正在统计字数...
            </div>
            <div v-else-if="fileWordCount > 0" class="text-sm text-gray-500 mt-1 space-y-1">
              <div>文档字数：{{ fileWordCount }} 字</div>
              <div class="flex items-center justify-center gap-4">
                <span>预估消耗：<span class="font-bold">{{ estimatedCost }}</span> 积分</span>
                <span :class="currentBalance < estimatedCost ? 'text-red-500' : 'text-green-600'">
                  (当前余额: <span class="font-bold">{{ currentBalance }}</span>)
                </span>
              </div>
              <div v-if="currentBalance < estimatedCost" class="text-red-500 text-xs font-bold">
                您的积分不足，请充值后再试
              </div>
            </div>
          </div>
          <div v-else class="text-gray-500">
            <p class="text-xl mb-2">
              点击或拖拽文件到此处上传
            </p>
            <p class="text-sm">
              仅支持 .docx 格式文档
            </p>
            <p class="text-xs mt-2 text-gray-400">
              当前余额: {{ currentBalance }} 积分
            </p>
          </div>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-bold text-gray-700">改写类型 (Rewrite Type)</label>
          <div class="flex space-x-4">
            <button
              v-for="type in rewriteTypes"
              :key="type.value"
              class="px-4 py-2 rounded-lg border transition-all" :class="[currentType === type.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100']"
              @click="currentType = type.value"
            >
              {{ type.label }}
            </button>
          </div>
        </div>

        <button
          :disabled="!selectedFile || currentBalance < estimatedCost"
          class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="startRewrite"
        >
          开始改写 (Start Rewrite)
        </button>
      </div>

      <!-- Processing Section -->
      <div v-else-if="processing" class="text-center py-12">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6" />
        <h2 class="text-xl font-bold text-gray-800 mb-2">
          正在处理中... (Processing)
        </h2>
        <p class="text-gray-600 mb-2">
          请稍候，我们正在重写您的文档。这可能需要几分钟时间。
        </p>
        <p v-if="uploadInfo.wordCount > 0" class="text-sm text-gray-500">
          文档字数: {{ uploadInfo.wordCount }} 字 | 消耗积分: {{ uploadInfo.cost }}
        </p>
        <p class="text-gray-400 text-sm mt-4">
          Order ID: {{ orderId }}
        </p>
      </div>

      <!-- Completed Section -->
      <div v-else-if="completed" class="text-center py-12 space-y-6">
        <div class="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl">
          ✓
        </div>
        <div>
          <h2 class="text-2xl font-bold text-gray-800 mb-2">
            改写完成! (Completed)
          </h2>
          <p class="text-gray-600">
            您的文档已成功改写。
          </p>
        </div>

        <div class="p-4 bg-gray-50 rounded-lg max-w-lg mx-auto border border-gray-200">
          <p class="font-medium text-gray-700 mb-1">
            {{ selectedFile?.name }}
          </p>
          <p class="text-sm text-gray-500 mb-4">
            改写版本
          </p>
          <a
            :href="downloadUrl"
            target="_blank"
            class="inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors"
          >
            ⬇️ 下载文档 (Download)
          </a>
        </div>

        <button
          class="text-blue-600 hover:underline mt-4"
          @click="reset"
        >
          改写另一个文档 (Rewrite Another)
        </button>
      </div>
    </div>
  </div>
</template>
