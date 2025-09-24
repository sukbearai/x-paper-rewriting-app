<script setup lang="ts">
import { ref } from 'vue'
import DragTable from '../components/drag-table.vue'

const activeTab = ref('users')
// 用户列表
const usersColumns = ref([
  {
    label: '用户名',
    prop: 'username',
  },
  { prop: 'username', label: '用户名' },
  { prop: 'balance', label: '余额' },
  { prop: 'totalReceived', label: '接受转账总额' },
  { prop: 'createdAt', label: '创建时间' },
  {
    prop: 'operation',
    label: '操作',
    slot: 'operation',
  },
])
const usersData = ref([
  {
    id: 29079,
    username: '码字小能手',
    balance: 599.108,
    totalReceived: 600.0,
    createdAt: '2025-09-19 20:49:49',
  },
  {
    id: 29031,
    username: 'lunwen',
    balance: 8400.0,
    totalReceived: 9000.0,
    createdAt: '2025-09-17 13:45:52',
  },
])
function getUsersData() {
  // getUsers(usersPage.value.pageNum, usersPage.value.pageSize).then((res) => {
  //   usersData.value = res.data
  //   usersPage.value.total = res.total
  // })
}
const usersPage = ref({
  total: 2,
  pageNum: 1,
  pageSize: 10,
})
function handleUsersPageChange(pageNum: number) {
  usersPage.value.pageNum = pageNum
  getUsersData()
}
function handleUsersSizeChange(pageSize: number) {
  usersPage.value.pageSize = pageSize
  getUsersData()
}
// 模拟转账记录
const transfersColumns = ref([
  { prop: 'toUser', label: '转账给用户' },
  { prop: 'remark', label: '备注' },
  { prop: 'createdAt', label: '创建时间' },
])
function getTransfersData() {
  // getUsers(usersPage.value.pageNum, usersPage.value.pageSize).then((res) => {
  //   transfersData.value = res.data
  //   transfersPage.value.total = res.total
  // })
}
const transfersPage = ref({
  total: 2,
  pageNum: 1,
  pageSize: 10,
})
function handleTransfersPageChange(pageNum: number) {
  transfersPage.value.pageNum = pageNum
  getTransfersData()
}
function handleTransfersSizeChange(pageSize: number) {
  transfersPage.value.pageSize = pageSize
  getTransfersData()
}
const transfersData = ref([
  {
    id: 6079,
    toUser: 'scott',
    remark: '您从付费账户已支付1000元为用户scott充值1000元',
    createdAt: '2025-09-24 10:42:01',
  },
  {
    id: 6078,
    toUser: 'Zxriwzy',
    remark: '您从付费账户已支付500元为用户Zxriwzy充值500元',
    createdAt: '2025-09-24 10:40:33',
  },
])
</script>

<template>
  <div class="home">
    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="用户列表" name="users">
        <DragTable
          height="70vh"
          :data="{ name: 'users', data: usersData }"
          :columns="usersColumns"
          border
          :show-pagination="true"
          :total="usersPage.total"
          :page-size="usersPage.pageSize"
          :page-num="usersPage.pageNum"
          @page-num-change="handleUsersPageChange"
          @page-size-change="handleUsersSizeChange"
        />
      </el-tab-pane>

      <el-tab-pane label="转账记录" name="transfers">
        <DragTable
          height="70vh"
          :data="{ name: 'transfers', data: transfersData }"
          :columns="transfersColumns"
          border
          :show-pagination="true"
          :total="transfersPage.total"
          :page-size="transfersPage.pageSize"
          :page-num="transfersPage.pageNum"
          @page-num-change="handleTransfersPageChange"
          @page-size-change="handleTransfersSizeChange"
        />
      </el-tab-pane>

      <el-tab-pane label="代理微信配置" name="wechat">
        <el-form label-width="120px">
          <el-form-item label="微信号">
            <el-input placeholder="请输入微信号" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary">
              保存
            </el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="代理网站配置" name="website">
        <el-form label-width="120px">
          <el-form-item label="网站域名">
            <el-input placeholder="请输入网站域名" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary">
              保存
            </el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.home {
  padding: 20px;
  height: 100%;
}
:deep(.el-tabs){
  height: 100%;
}
</style>
