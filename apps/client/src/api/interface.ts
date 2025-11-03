// 登录表单接口
export interface LoginForm {
  phone: string
  password: string
}

// 注册表单接口
export interface RegisterForm {
  phone: string
  password: string
  confirmPassword: string
  code: string
  invite?: string
}

// 登录请求参数
export interface LoginParams {
  phone: string
  password: string
}
// 注册请求参数
export interface RegisterParams {
  email: string
  password: string
  username: string
  phone: string
  otp: string
  inviteCode?: string
}

// 登录响应数据
export interface LoginResponse {
  token: string
  userInfo: {
    id: number
    phone: string
    nickname: string
  }
}

// 注册响应数据
export interface RegisterResponse {
  success: boolean
  message: string
}
