import { request } from '@/api/axios'
import type { LoginParams, RegisterParams } from '@/api/interface'

export function login(data: LoginParams) {
  return request('/api/login', {
    method: 'post',
    data,
  })
}

export function register(data: RegisterParams) {
  return request('/api/register', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}

export function sendSmsCode(data: { phone: string }) {
  return request('/otp', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}
