<script setup lang="ts">
import { computed, ref } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const inputText = ref('')
const charCount = ref(0)
const resultCharCount = ref(0)
const outputText = ref('')
const aiTools = [
  {
    name: '同时降AI率和降重(全平台版)',
    price: '1.00积分/千字',
    tooltip: '1、该功能可大幅度降低句子的AIGC率和降重，全平台一次过；2、已处理近万篇，实测95%概率能直接降到15%以下，90%概率能降到10%以下；3、没有其余两个模型语句通顺',
  },
  {
    name: '仅降AI率(进阶版)',
    price: '1.00积分/千字',
    tooltip: '1、该功能仅大幅度降低句子的AIGC率，不支持降重，全平台一次过；2、不会提高文本重复率；3、比【同时降AI率和降重(全平台)】语句更通顺；4.已处理近万篇，实测95%概率能直接降到15%以下，90%概率能降到10%以下',
  },
  {
    name: '仅降重(全平台版)',
    price: '1.00积分/千字',
    tooltip: '1、该功能仅大幅度降低句子的重复率，不支持降AIGC，全平台一次过；2、不会提高文本AIGC率；3、比【同时降AI率和降重】降重效果更好；4.已处理近万篇，实测95%概率能直接降到15%以下，90%概率能降到10%以下',
  },
]
function handleToolClick(tool) {
  console.log('Clicked tool:', tool)
}
const estimatedCost = computed(() => {
  return (charCount.value / 1000) * 1.0
})

function updateCharCount() {
  charCount.value = inputText.value.length
}

function startProcessing() {
  if (!inputText.value.trim())
    return

  // Simulate processing
  console.log('开始处理文本:', inputText.value)
  // Here you would typically make an API call to process the text
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
</script>

<template>
  <div style="height: 100%">
    <div class="px-4 sm:px-6 lg:px-8 py-3" style="height: 100%">
      <el-row :gutter="24" style="height: calc(100% - 20px)">
        <!-- Left Sidebar -->
        <el-col :lg="6" :md="8" :sm="24">
          <div class="space-y-4">
            <el-card v-for="tool in aiTools" :key="tool.name" class="mb-4" @click="handleToolClick(tool)">
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
        </el-col>

        <!-- Main Content Area -->
        <el-col :lg="9" :md="16" :sm="24">
          <!-- Replace custom card with el-card -->
          <el-card style="height: 100%;">
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-medium text-gray-900">
                  同时降AI率和降重(全平台版)
                </h2>
                <span class="text-sm text-gray-500">单次处理最多 6000 字</span>
              </div>
            </template>

            <el-input
              v-model="inputText" type="textarea" placeholder="请输入需要处理的文本" :rows="21" resize="none"
              class="mb-4" @input="updateCharCount"
            />
            <template #footer>
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4 text-sm text-gray-500">
                  <span>当前字数：{{ charCount }}</span>
                  <span>预计消耗：{{ estimatedCost.toFixed(3) }}元</span>
                </div>
                <el-button
                  type="primary" plain size="large" :disabled="!inputText.trim()"
                  @click="inputText = ''"
                >
                  重置
                </el-button>
                <el-button
                  type="primary" size="large" :disabled="!inputText.trim()"
                  @click="startProcessing"
                >
                  开始生成
                </el-button>
              </div>
            </template>
          </el-card>
        </el-col>

        <!-- Right Sidebar - Results -->
        <el-col :lg="9" :md="24" :sm="24">
          <el-card style="height: 100%;">
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-medium text-gray-900">
                  结果展示
                </h3>
                <el-button type="text" @click="copyToClipboard(outputText)">
                  复制结果
                </el-button>
              </div>
            </template>
            <el-input
              v-if="outputText" v-model="outputText" type="textarea" :rows="21"
              resize="none" class="mb-4" disabled
            />
            <el-empty v-else description="生成的结果将显示在这里" :image-size="80" class="new-content" />

            <template #footer>
              <div class="text-sm text-gray-500">
                结果字数：{{ resultCharCount }}
              </div>
            </template>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<style scoped>
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
:deep(.el-card__body){
    height: calc(100% - 135px);
}
</style>
