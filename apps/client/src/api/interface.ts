export interface SmsCodeParams {
  phone: string
  purpose?: 'signup' | 'login'
}

export interface SmsCodeResponse {
  code: number
  message: string
  data: null
  timestamp: number
}

export interface RegisterParams {
  username: string
  email: string
  password: string
  phone?: string
  verification_code?: string
  invite_code?: string
}

export interface RegisterResponse {
  id: number
  username: string
  email: string
  phone?: string
  invite_code?: string
  role: string
  points_balance: number
  created_at: string
  invited_by?: string
}

export interface LoginWithPasswordParams {
  username: string
  password: string
}

export interface LoginWithOtpParams {
  phone: string
  verification_code: string
}

export type LoginParams = LoginWithPasswordParams | LoginWithOtpParams

export interface SessionInfo {
  access_token: string
  refresh_token: string
  expires_at: number
}

export interface LoginUser {
  id: string
  username: string
  email: string
  phone?: string
  role: string
  points_balance: number
  invite_code?: string
  created_at: string
}

export interface LoginResponse {
  user: LoginUser
  session: SessionInfo
}

export interface LogoutResponse {
  success: boolean
}

export interface ChangePasswordParams {
  current_password: string
  new_password: string
}

export interface SubmitTaskParams {
  text: string
  platform: 'zhiwang' | 'weipu'
  type: 'reduce-plagiarism' | 'reduce-ai-rate'
}

export interface SubmitTaskResponse {
  taskId: string
  service: 'reduceai' | 'cheeyuan'
  newBalance: number
  cost: number
}

export interface TaskResultParams {
  taskId: string
  service: 'reduceai' | 'cheeyuan'
}

export interface TaskResultCommon {
  status: 'processing' | 'completed' | 'failed'
  progress: number
  result: string | null
  cost?: number
}

export interface ReduceAiResult extends TaskResultCommon {
  queuePosition?: number
}

export interface CheeYuanResult extends TaskResultCommon {
  created_at?: string
  updated_at?: string
}

export type TaskResultData = ReduceAiResult | CheeYuanResult

export interface PointsResponse {
  points_balance: number
  task_cost: number
  cost_per_1000_chars: number
}

export type PointsTransactionType = 'recharge' | 'spend' | 'transfer'

export interface PointsTransaction {
  id: number
  profile_id: number
  transaction_type: PointsTransactionType
  amount: number
  balance_after: number
  description: string
  reference_id?: string | null
  is_successful: boolean
  created_at: string
}

export interface PointsTransactionsPagination {
  current_page: number
  per_page: number
  total: number
  total_pages: number
  has_next_page: boolean
  has_prev_page: boolean
}

export interface PointsTransactionsResponse {
  transactions: PointsTransaction[]
  pagination: PointsTransactionsPagination
}

export interface PointsTransactionsQueryParams {
  page?: number
  limit?: number
  transaction_type?: PointsTransactionType
  start_date?: string
  end_date?: string
}

// 表单数据
export interface LoginOtpForm {
  phone: string
  code: string
}

export interface RegisterForm {
  username: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  code: string
  invite?: string
}
