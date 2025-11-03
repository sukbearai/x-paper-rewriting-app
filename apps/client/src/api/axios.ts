import type { AxiosRequestConfig } from 'axios'
import axios from 'axios'
import { ElMessage } from 'element-plus'

axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8'
// 使用环境变量或相对路径，以便通过 Vite 代理避免 CORS
axios.defaults.baseURL = (import.meta as any).env?.VITE_API_BASE || '/'
const axiosInstance = axios.create({
  timeout: 10000,
  withCredentials: false, // 通过同源代理，无需跨域凭证
})

axiosInstance.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

axiosInstance.interceptors.response.use(
  (response) => {
    if (response?.status === 200) {
      return Promise.resolve(response.data)
    }
    else {
      return Promise.reject(response)
    }
  },
  (error) => {
    if (error?.message?.includes?.('timeout')) {
      console.log('timeout')
    }
    else {
      console.log(error)
    }
    Promise.reject(error)
  },
)

function request<ResponseType = unknown>(url: string, options?: AxiosRequestConfig<unknown>): Promise<ResponseType> {
  return new Promise((resolve, reject) => {
    axiosInstance({
      url,
      ...options,
    })
      .then((res) => {
        resolve(res?.data)
      })
      .catch((error) => {
        if (error.response) {
          // 有响应体，按业务码处理
          ElMessage.error(error.response.data?.msg || '服务异常')
        }
        else if (error.code === 'ERR_NETWORK') {
          ElMessage.error('网络错误或跨域')
        }
        else {
          ElMessage.error(error.message)
        }
        return reject(error)
      })
  })
}
export { axiosInstance, request }
