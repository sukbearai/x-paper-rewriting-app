<script setup lang="ts">
import { ref } from 'vue'

import type { ElTable } from 'element-plus'
// import { useStore } from '@/stores'

// 类型定义
interface ColumnItem {
  prop?: string
  label?: string
  width?: string | number
  minWidth?: string | number
  align?: 'left' | 'center' | 'right'
  fixed?: boolean | 'left' | 'right'
  sort?: boolean | 'custom'
  slot?: string
  header?: string
  tooltip?: boolean
}

interface TableData {
  name: string
  data: Record<string, any>[]
}

interface PageParam {
  page: number
  size: number
}

interface Group {
  name: string
  pull: boolean | string | string[] | ((evt: any) => string | boolean)
  put: boolean | string | string[] | ((evt: any) => string | boolean)
}

// props
interface Props {
  loading?: boolean
  border?: boolean
  height?: string | number | null
  contentHeight?: string | number
  fixedTable?: boolean
  showNo?: boolean
  selection?: boolean
  radio?: boolean
  radioModel?: string
  radioValue?: string | number
  highlight?: boolean
  columns: ColumnItem[]
  data: TableData
  customRowClass?: (row: any) => string
  showPagination?: boolean
  layout?: string
  total?: number
  pageNum?: number
  pageSize?: number
  pagerCount?: number
  pageSizeOptions?: number[]
  drag?: boolean
  rowKey?: string
  id?: string
  group?: Group
  spanMethod?: (params: any) => any[] | { rowspan: number, colspan: number }
  fit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  border: false,
  height: null,
  contentHeight: '100%',
  fixedTable: false,
  showNo: false,
  selection: false,
  radio: false,
  radioModel: 'id',
  radioValue: '',
  highlight: false,
  columns: () => [],
  data: () => ({ name: 'list', data: [] }),
  customRowClass: () => '',
  showPagination: false,
  layout: 'total,sizes,prev, pager, next, jumper',
  total: 0,
  pageNum: 1,
  pageSize: 10,
  pagerCount: 7,
  pageSizeOptions: () => [10, 30, 50, 100],
  drag: false,
  rowKey: 'id',
  id: 'id',
  group: () => ({ name: 'group', pull: true, put: true }),
  spanMethod: () => ({ rowspan: 1, colspan: 1 }),
  fit: false,
})

// emits
const emit = defineEmits<{
  (e: 'input', val: any): void
  (e: 'select', selection: any[], row: any): void
  (e: 'selectAll', selection: any[]): void
  (e: 'pageNumChange', page: PageParam): void
  (e: 'pageSizeChange', page: PageParam): void
  (e: 'sortChange', val: any): void
  (e: 'add', ...args: any[]): void
  (e: 'highlightCurrentChange', row: any): void
  (e: 'contextmenu', row: any, col: any, cell: HTMLElement, event: MouseEvent): void
  (e: 'customRowClass', row: any): void
}>()

// store
// const store = useStore()

// 响应式变量
const radioValue = ref<string | number>(props.radioValue)
const isFixed = ref<boolean>(props.columns.some(item => 'fixed' in item))

// 序号计算
const indexMethod = (index: number) => index + 1 + props.pageSize * (props.pageNum - 1)

// 单选/多选/高亮/右键/排序/行样式
const RowSelectChange = ($event: any) => emit('input', $event)
const tableSelect = (selection: any[], row: any) => emit('select', selection, row)
const tableSelectAll = (selection: any[]) => emit('selectAll', selection)
const checkSelectable = (row: any) => !row.disabled
const highlightCurrentChange = (row: any) => emit('highlightCurrentChange', row)
const contextmenu = (row: any, col: any, cell: HTMLElement, event: MouseEvent) => emit('contextmenu', row, col, cell, event)
const sortChange = (val: any) => emit('sortChange', val)
const tableRowClassName = ({ row }: { row: any }) => props.customRowClass(row)

// 分页
const handleSizeChange = (val: number) => emit('pageSizeChange', { page: 1, size: val })
const handleCurrentChange = (val: number) => emit('pageNumChange', { page: val, size: props.pageSize })

// 表格实例
const elTableRef = ref<InstanceType<typeof ElTable>>()

// 对外暴露方法
defineExpose({
  elTableRef,
  radioValue,
  sort: (prop: string, order: string) => elTableRef.value?.sort(prop, order),
  clearSort: () => elTableRef.value?.clearSort(),
})
</script>

<template>
  <div class="table-box" :class="{ 'is-fit': fit }">
    <div class="sf-query-btn">
      <slot name="sel-query" />
    </div>
    <div class="tableInner" :class="{ 'is-fit': fit }" :style="{ height: !fit ? (height ?? 'auto') : 'auto' }">
      <el-table
        :id="id"
        ref="elTableRef"
        v-loading="loading"
        :data="data.data"
        :border="border"
        :height="contentHeight"
        :stripe="false"
        fit
        :row-key="rowKey"
        style="width: 100%"
        empty-text="暂无数据"
        :highlight-current-row="highlight"
        :row-class-name="tableRowClassName"
        :span-method="spanMethod"
        @select="tableSelect"
        @select-all="tableSelectAll"
        @selection-change="RowSelectChange"
        @sort-change="sortChange"
        @current-change="highlightCurrentChange"
        @cell-contextmenu="contextmenu"
      >
        <el-table-column
          v-if="selection && !radio"
          type="selection"
          :selectable="checkSelectable"
          width="55"
          align="center"
          :fixed="isFixed"
        />
        <el-table-column
          v-if="radio && !selection"
          label=""
          width="55"
          align="center"
          :fixed="isFixed"
        >
          <template #default="scope">
            <el-radio-group v-model="radioValue" class="ml-4" @change="RowSelectChange(scope.row)">
              <el-radio :label="scope.row[radioModel]">
                <span />
              </el-radio>
            </el-radio-group>
          </template>
        </el-table-column>
        <el-table-column
          v-if="showNo"
          type="index"
          width="70"
          :fixed="isFixed"
          label="序号"
          align="center"
          :resizable="false"
          :index="indexMethod"
          class-name="indexNo"
        />
        <template v-for="item in columns" :key="item.prop">
          <el-table-column
            v-if="!item.slot"
            :prop="item.prop"
            :sortable="item.sort"
            :label="item.label"
            :width="item.width"
            :min-width="item.minWidth ?? 100"
            :align="item.align ?? 'left'"
            :fixed="item.fixed"
            show-overflow-tooltip
          >
            <template v-if="item.header" #header>
              <slot :name="item.header" :column="item" />
            </template>
          </el-table-column>
          <el-table-column
            v-else
            :prop="item.prop"
            :sortable="item.sort"
            :label="item.label"
            :width="item.width"
            :min-width="item.minWidth ?? 100"
            :align="item.align"
            :fixed="item.fixed"
            show-overflow-tooltip
          >
            <template v-if="item.header" #header>
              <slot :name="item.header" :column="item" />
            </template>
            <template #default="scope">
              <slot :name="item.slot" :scope="scope" :row="scope.row" :index="scope.$index" />
            </template>
          </el-table-column>
        </template>
      </el-table>
    </div>
    <div v-if="showPagination" class="pager">
      <el-pagination
        background
        :layout="layout"
        :total="total"
        :pager-count="pagerCount"
        :page-sizes="pageSizeOptions"
        :page-size="pageSize"
        :current-page="pageNum"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.el-table__body-wrapper) {
  height: calc(100% - 40px);
  .el-scrollbar__view {
    height: 100%;
    tbody {
      min-height: calc(100% - 40px);
    }
  }
}
.table-box {
  height: 100%;
}
.pager {
  width: 100%;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 10px;
}

.table-box.is-fit {
  display: flex;
  flex-direction: column;
  height: 100%;

  .tableInner.is-fit {
    flex: 1;
    height: auto !important;
    min-height: 0;

    :deep(.el-table) {
      height: 100% !important;
    }
  }
}
</style>
