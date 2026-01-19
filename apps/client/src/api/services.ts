import { axiosInstance, request } from '@/api/axios'
import type {
  ChangePasswordParams,
  CreateAlipayPaymentParams,
  LoginResponse,
  LoginWithOtpParams,
  LoginWithPasswordParams,
  PayForDownlineParams,
  PointsResponse,
  PointsTransactionsQueryParams,
  PointsTransactionsResponse,
  RechargeRecordsQueryParams,
  RechargeRecordsResponse,
  RefreshSessionParams,
  RefundPointsPayload,
  RefundPointsResponse,
  RegisterParams,
  RegisterResponse,
  RewriteDocxParams,
  RewriteDocxResponse,
  RewriteStateParams,
  RewriteStateResponse,
  SmsCodeParams,
  SubmitTaskParams,
  SubmitTaskResponse,
  TaskResultData,
  TaskResultParams,
  UpdateUserPointsParams,
  UpdateUserPointsResponse,
  UpdateUserRateParams,
  UpdateUserRateResponse,
  UpdateUserRoleParams,
  UpdateUserRoleResponse,
  UserListQueryParams,
  UserListResponse,
} from '@/api/interface'

export function sendSmsCode(data: SmsCodeParams) {
  return request<null>('/otp', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}

export function registerUser(data: RegisterParams) {
  return request<RegisterResponse>('/user/register', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}

export function loginWithPassword(data: LoginWithPasswordParams) {
  return request<LoginResponse>('/user/login', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}

export function loginWithOtp(data: LoginWithOtpParams) {
  return request<LoginResponse>('/user/login', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}

export function refreshSession(data: RefreshSessionParams) {
  return request<LoginResponse>('/user/refresh', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}

export function logout(refreshToken?: string) {
  return request<null>('/user/logout', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
    },
  })
}

export function queryUserList(params: UserListQueryParams = {}) {
  return request<UserListResponse>('/user/list', {
    method: 'get',
    headers: { 'Content-Type': 'application/json' },
    params,
  })
}

export function changePassword(data: ChangePasswordParams) {
  return request<null>('/user/change-password', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}

export function submitReduceTask(data: SubmitTaskParams) {
  return request<SubmitTaskResponse>('/ai/reduce-task', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}

export function queryTaskResult(data: TaskResultParams) {
  return request<TaskResultData>('/ai/result', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}

export function queryPoints() {
  return request<PointsResponse>('/ai/points', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
  })
}

export function queryPointsTransactions(params: PointsTransactionsQueryParams = {}) {
  return request<PointsTransactionsResponse>('/points/transactions', {
    method: 'get',
    headers: { 'Content-Type': 'application/json' },
    params,
  })
}

export function queryRechargeRecords(params: RechargeRecordsQueryParams = {}) {
  return request<RechargeRecordsResponse>('/points/recharges', {
    method: 'get',
    headers: { 'Content-Type': 'application/json' },
    params,
  })
}

export function refundPointsTransaction(transactionId: number) {
  const payload: RefundPointsPayload = { transaction_id: transactionId }
  return request<RefundPointsResponse>('/points/refund', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data: payload,
  })
}

export function updateUserRole(data: UpdateUserRoleParams) {
  return request<UpdateUserRoleResponse>('/user/update-role', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}

export function updateUserRate(data: UpdateUserRateParams) {
  return request<UpdateUserRateResponse>('/user/update-rate', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}

export function updateUserPoints(data: UpdateUserPointsParams) {
  return request<UpdateUserPointsResponse>('/user/update-points', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}

export async function createAlipayPayment(data: CreateAlipayPaymentParams) {
  // Use axiosInstance directly to handle HTML/Text response
  const response = await axiosInstance.post<string>('/alipay/pay', data, {
    headers: { 'Content-Type': 'application/json' },
  })
  return response.data
}

/**
 * 代理为下级用户充值
 * @param data 充值参数
 * @returns 支付表单HTML
 */
export async function payForDownline(data: PayForDownlineParams) {
  // Use axiosInstance directly to handle HTML/Text response
  const response = await axiosInstance.post<string>('/alipay/pay-for-downline', data, {
    headers: { 'Content-Type': 'application/json' },
  })
  return response.data
}

export function rewriteDocx(data: RewriteDocxParams) {
  const formData = new FormData()
  formData.append('file', data.file)
  formData.append('rewrite_type', data.rewrite_type)

  return request<RewriteDocxResponse>('/rewrite/rewrite_docx', {
    method: 'post',
    headers: { 'Content-Type': 'multipart/form-data' },
    data: formData,
  })
}

export function checkRewriteState(data: RewriteStateParams) {
  return request<RewriteStateResponse>('/rewrite/rewrite_state', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}
