<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import isoWeek from 'dayjs/plugin/isoWeek'
import { queryWordsCountList } from '@/api/services'
import type { WordsCountListItem } from '@/api/interface'

dayjs.extend(isBetween)
dayjs.extend(isoWeek)

const isCnMode = ref(false)
const currentTime = ref('day')
const chartRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const timeOptions = [
  { label: '日', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
  { label: '年', value: 'year' },
]

const stats = ref({
  total: 0,
  avg: 0,
  max: 0,
  period: '今日',
})

// Store fetched data
const allRecords = ref<WordsCountListItem[]>([])

// Processed data for chart
const chartData = ref<{ labels: string[], data: number[], period: string }>({
  labels: [],
  data: [],
  period: '',
})

const formatNumber = (num: number) => num.toLocaleString()

function switchStyle(type: 'cn' | 'global') {
  isCnMode.value = type === 'cn'
  // Also toggle body class for global background if needed, but scoping to container is safer for SPA.
  // The requirement says "background: #f5f7fa" on body. In SPA, changing body class affects other pages.
  // I will just change container style and maybe wrap the component with a div that fills screen if needed.
  // The provided CSS had `body.cn-mode`.
  // I'll emit or just style local container. The user's prompt implies full page style.
  // I'll stick to container styling to be safe, or add class to container wrapper.
  updateChartStyle()
}

function switchTime(type: string) {
  currentTime.value = type
  processData()
}

async function fetchData() {
  try {
    const res = await queryWordsCountList({ page: 1, limit: 10000 })
    if (res && res.list) {
      allRecords.value = res.list
      // Assume server returns data sorted by time desc, or we sort it?
      // Safer to sort.
      allRecords.value.sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime())
      processData()
    }
  }
  catch (e) {
    console.error('Failed to fetch words count', e)
  }
}

function processData() {
  const records = allRecords.value
  let labels: string[] = []
  let data: number[] = []
  let periodText = ''

  const now = dayjs()
  let filtered: WordsCountListItem[] = []

  if (currentTime.value === 'day') {
    periodText = '今日'
    const todayStart = now.startOf('day')
    const todayEnd = now.endOf('day')
    filtered = records.filter(r => dayjs(r.createTime).isBetween(todayStart, todayEnd, null, '[]'))

    const hours = ['00', '04', '08', '12', '16', '20']
    // Buckets: 0-3, 4-7, 8-11, 12-15, 16-19, 20-23
    labels = hours.map(h => `${h}时`)
    data = Array.from({ length: hours.length }, () => 0)

    filtered.forEach((r) => {
      const h = dayjs(r.createTime).hour()
      const bucketIndex = Math.floor(h / 4)
      if (bucketIndex < data.length) {
        data[bucketIndex] += r.clientWordsCount
      }
    })
  }
  else if (currentTime.value === 'week') {
    periodText = '本周'
    // Monday to Sunday of current week
    const startOfWeek = now.startOf('isoWeek')
    const endOfWeek = now.endOf('isoWeek')

    filtered = records.filter(r => dayjs(r.createTime).isBetween(startOfWeek, endOfWeek, null, '[]'))

    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    labels = days
    data = Array.from({ length: 7 }, () => 0)

    filtered.forEach((r) => {
      const day = dayjs(r.createTime).isoWeekday() // 1-7 (Mon-Sun)
      const idx = day - 1
      if (idx >= 0 && idx < 7)
        data[idx] += r.clientWordsCount
    })
  }
  else if (currentTime.value === 'month') {
    periodText = '本月'
    const startOfMonth = now.startOf('month')
    const endOfMonth = now.endOf('month')
    const daysInMonth = now.daysInMonth()

    filtered = records.filter(r => dayjs(r.createTime).isBetween(startOfMonth, endOfMonth, null, '[]'))

    labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}日`)
    data = Array.from({ length: daysInMonth }, () => 0)

    filtered.forEach((r) => {
      const d = dayjs(r.createTime).date() // 1-31
      const idx = d - 1
      if (idx >= 0 && idx < daysInMonth)
        data[idx] += r.clientWordsCount
    })
  }
  else if (currentTime.value === 'year') {
    periodText = '本年'
    const startOfYear = now.startOf('year')
    const endOfYear = now.endOf('year')

    filtered = records.filter(r => dayjs(r.createTime).isBetween(startOfYear, endOfYear, null, '[]'))

    labels = Array.from({ length: 12 }, (_, i) => `${i + 1}月`)
    data = Array.from({ length: 12 }, () => 0)

    filtered.forEach((r) => {
      const m = dayjs(r.createTime).month() // 0-11
      data[m] += r.clientWordsCount
    })
  }

  const total = data.reduce((a, b) => a + b, 0)
  // Avg: for 'day', mock says '日均' but shows avg of the points?
  // Mock logic: avg = total / data.length.
  // For 'day', data.length is 6 (buckets). Max is max of buckets.
  const count = data.length

  stats.value = {
    total,
    avg: count ? Math.round(total / count) : 0,
    max: Math.max(...data, 0),
    period: periodText,
  }

  chartData.value = { labels, data, period: periodText }
  renderChart()
}

function updateChartStyle() {
  if (!chartInstance)
    return
  const themeColor = isCnMode.value ? 'rgb(230, 57, 70)' : 'rgb(0, 120, 212)'
  const bgColor = isCnMode.value ? 'rgba(230, 57, 70, 0.1)' : 'rgba(0, 120, 212, 0.1)'

  const dataset = chartInstance.data.datasets[0] as any
  dataset.borderColor = themeColor
  dataset.backgroundColor = bgColor
  dataset.pointBackgroundColor = themeColor
  chartInstance.update()
}

function renderChart() {
  if (!chartRef.value)
    return

  const ctx = chartRef.value.getContext('2d')
  if (!ctx)
    return

  if (chartInstance) {
    chartInstance.destroy()
  }

  const { labels, data } = chartData.value
  const themeColor = isCnMode.value ? 'rgb(230, 57, 70)' : 'rgb(0, 120, 212)'
  const bgColor = isCnMode.value ? 'rgba(230, 57, 70, 0.1)' : 'rgba(0, 120, 212, 0.1)'

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '字符使用量',
        data,
        fill: true,
        backgroundColor: bgColor,
        borderColor: themeColor,
        tension: 0.3,
        pointBackgroundColor: themeColor,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: '字符数量' } },
        x: { title: { display: true, text: getTimeLabel() } },
      },
    },
  })
}

function getTimeLabel() {
  const map: Record<string, string> = {
    day: '时段',
    week: '星期',
    month: '月份',
    year: '年份',
  }
  return map[currentTime.value]
}

function exportToExcel() {
  const { labels, data, period } = chartData.value

  const excelData = [
    ['统计维度', period],
    ['', ''],
    ['时段/周期', '字符使用量'],
    ...labels.map((label, index) => [label, data[index]]),
    ['', ''],
    ['总计', stats.value.total],
    ['平均值', stats.value.avg],
    ['最大值', stats.value.max],
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(excelData)
  XLSX.utils.book_append_sheet(wb, ws, '字符使用统计')
  XLSX.writeFile(wb, `字符使用统计_${period}.xlsx`)
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="stats-container" :class="[{ 'cn-mode': isCnMode }]">
    <div class="header">
      <h1>文档字符使用统计后台</h1>
      <div class="control-group">
        <button class="style-btn cn-btn" @click="switchStyle('cn')">
          国内风格
        </button>
        <button class="style-btn global-btn" @click="switchStyle('global')">
          国际风格
        </button>
        <button class="export-btn" @click="exportToExcel">
          导出Excel
        </button>
      </div>
      <div class="control-group">
        <button
          v-for="t in timeOptions"
          :key="t.value"
          class="time-btn" :class="[{ active: currentTime === t.value }]"
          @click="switchTime(t.value)"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <div class="stats-card">
      <div class="card-item">
        <div class="card-label">
          总使用字符数
        </div>
        <div class="card-value">
          {{ formatNumber(stats.total) }}
        </div>
      </div>
      <div class="card-item">
        <div class="card-label">
          日均/周均/月均
        </div>
        <div class="card-value">
          {{ formatNumber(stats.avg) }}
        </div>
      </div>
      <div class="card-item">
        <div class="card-label">
          最高使用量
        </div>
        <div class="card-value">
          {{ formatNumber(stats.max) }}
        </div>
      </div>
      <div class="card-item">
        <div class="card-label">
          统计周期
        </div>
        <div class="card-value">
          {{ stats.period }}
        </div>
      </div>
    </div>

    <div class="chart-wrap">
      <canvas ref="chartRef" />
    </div>
  </div>
</template>

<style scoped>
.stats-container {
    width: 100%;
    height: 100vh;
    min-height: 600px;
    margin: 0;
    padding: 30px;
    background: #fff;
    border-radius: 0;
    border: none;
    transition: background .3s;
    display: flex;
    flex-direction: column;
}

/* Header */
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 15px; flex-shrink: 0; }
h1 { color: #0078d4; transition: color .3s; font-size: 24px; margin: 0; }
.control-group { display: flex; gap: 10px; }
.style-btn, .time-btn, .export-btn { padding: 6px 16px; border: none; border-radius: 20px; cursor: pointer; font-weight: 500; }
.style-btn, .export-btn { color: #fff; }
.cn-btn { background: #e63946; }
.global-btn { background: #0078d4; }
.export-btn { background: #2a9d8f; }
.time-btn { background: #f1f3f5; color: #333; transition: all .2s; }
.time-btn.active { background: #0078d4; color: #fff; }

/* Stats Cards */
.stats-card { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; flex-shrink: 0; }
.card-item { padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center; }
.card-label { font-size: 14px; color: #666; margin-bottom: 8px; }
.card-value { font-size: 28px; font-weight: bold; color: #0078d4; transition: color .3s; }

/* Chart */
.chart-wrap { width: 100%; position: relative; flex: 1; min-height: 0; }

/* Styles for CN mode */
.stats-container.cn-mode { border-color: #e63946; }
.stats-container.cn-mode h1 { color: #e63946; }
.stats-container.cn-mode .time-btn.active { background: #e63946; }
.stats-container.cn-mode .card-value { color: #e63946; }
</style>
