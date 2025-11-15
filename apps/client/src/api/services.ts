import { request } from '@/api/axios'
import type {
  ChangePasswordParams,
  LoginResponse,
  LoginWithOtpParams,
  LoginWithPasswordParams,
  PointsResponse,
  PointsTransactionsQueryParams,
  PointsTransactionsResponse,
  RefundPointsPayload,
  RefundPointsResponse,
  RegisterParams,
  RegisterResponse,
  SmsCodeParams,
  SubmitTaskParams,
  SubmitTaskResponse,
  TaskResultData,
  TaskResultParams,
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

export function refundPointsTransaction(transactionId: number) {
  const payload: RefundPointsPayload = { transaction_id: transactionId }
  return request<RefundPointsResponse>('/points/refund', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data: payload,
  })
}
