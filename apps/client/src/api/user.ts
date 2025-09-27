// src/api/user.ts
import request from '../utils/request'

export function login(data: { mobile: string, password: string }) {
  return request({
    url: '/api/login',
    method: 'post',
    data,
  })
}

export function register(data: {
  mobile: string
  password: string
  code: string
  invite?: string
}) {
  return request({
    url: '/api/register',
    method: 'post',
    data,
  })
}
