// src/utils/request.ts
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../store/auth'

// 创建axios实例
const service: AxiosInstance = axios.create({
  baseURL: '123.123.123.123:8080', // API基础URL
  timeout: 15000, // 请求超时时间
})

// 请求拦截器
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authStore = useAuthStore()
    // 如果token存在，则在请求头中添加Authorization
    if (authStore.token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return config
  },
  (error) => {
    // 请求错误处理
    console.error('Request error:', error)
    return Promise.reject(error)
  },
)

// 响应拦截器
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data

    // 根据后端返回的状态码进行处理
    if (res.code !== 200) {
      ElMessage({
        message: res.message || 'Error',
        type: 'error',
        duration: 5 * 1000,
      })

      // 处理特定错误码，如401未授权
      if (res.code === 401) {
        const authStore = useAuthStore()
        authStore.logout()
        // 可以在这里跳转到登录页
      }
      return Promise.reject(new Error(res.message || 'Error'))
    }
    else {
      return res
    }
  },
  (error) => {
    console.error('Response error:', error)
    ElMessage({
      message: error.message || 'Request Error',
      type: 'error',
      duration: 5 * 1000,
    })
    return Promise.reject(error)
  },
)

export default service
