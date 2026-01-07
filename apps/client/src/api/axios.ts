import type { AxiosRequestConfig } from 'axios'
import axios from 'axios'
import { ElMessage } from 'element-plus'

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  timestamp: number
}

class ApiError<T = unknown> extends Error {
  code: number
  payload?: T

  constructor(message: string, code: number, payload?: T) {
    super(message)
    this.code = code
    this.payload = payload
  }
}

function getStoredAccessToken(): string {
  try {
    const raw = localStorage.getItem('auth')
    if (!raw)
      return ''
    const parsed = JSON.parse(raw)
    return parsed?.accessToken || ''
  }
  catch {
    return ''
  }
}

axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8'
// 使用环境变量或默认线上地址
axios.defaults.baseURL = (import.meta as any).env?.VITE_API_BASE || 'https://rewriting.congrongtech.cn/'
const axiosInstance = axios.create({
  timeout: 10000,
  withCredentials: true,
})

axiosInstance.interceptors.request.use(
  (config) => {
    const token = getStoredAccessToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

let isRefreshing = false
let requestsQueue: Array<{ resolve: (token: string) => void, reject: (error: any) => void }> = []

export function setupInterceptors(store: any) {
  axiosInstance.interceptors.response.use(
    response => response,
    async (error) => {
      const originalRequest = error.config
      
      // 处理超时
      if (error?.message?.includes?.('timeout')) {
        console.log('timeout')
        return Promise.reject(error)
      }

      // 如果是401错误，且不是刷新token接口本身的请求
      if (error.response?.status === 401 && !originalRequest.url?.includes('/user/refresh')) {
        if (isRefreshing) {
          // 如果正在刷新，将请求加入队列
          return new Promise((resolve, reject) => {
            requestsQueue.push({
              resolve: (token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`
                resolve(axiosInstance(originalRequest))
              },
              reject: (err) => {
                reject(err)
              },
            })
          })
        }

        originalRequest._retry = true
        isRefreshing = true

        try {
          // 尝试刷新token
          const { session } = await store.attemptRefreshSession()
          const newToken = session.access_token

          // 刷新成功，重试队列中的请求
          requestsQueue.forEach(({ resolve }) => resolve(newToken))
          requestsQueue = []
          
          // 重试当前请求
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return axiosInstance(originalRequest)
        }
        catch (refreshError) {
          console.error('[Axios] Auto-refresh failed:', refreshError)
          // 刷新失败，清空队列并拒绝所有请求
          requestsQueue.forEach(({ reject }) => reject(refreshError))
          requestsQueue = []
          
          // 退出登录
          await store.logout()
          return Promise.reject(refreshError)
        }
        finally {
          isRefreshing = false
        }
      }

      // 其他错误
      if (error?.response) {
        console.log(error)
      }
      return Promise.reject(error)
    },
  )
}

async function request<ResponseType = unknown>(url: string, options?: AxiosRequestConfig<unknown>): Promise<ResponseType> {
  try {
    const { data: payload } = await axiosInstance<ApiResponse<ResponseType>>({
      url,
      ...options,
    })
    if (payload.code === 0) {
      return payload.data
    }

    ElMessage.error(payload.message || '服务异常')
    throw new ApiError(payload.message || '服务异常', payload.code, payload.data)
  }
  catch (error: any) {
    if (error?.response) {
      // 有响应体，按业务码处理
      const { data } = error.response
      ElMessage.error(data?.message || data?.msg || '服务异常')
    }
    else if (error?.code === 'ERR_NETWORK') {
      ElMessage.error('网络错误或跨域')
    }
    else if (error?.message) {
      ElMessage.error(error.message)
    }
    throw error
  }
}
export { ApiError, axiosInstance, request }
