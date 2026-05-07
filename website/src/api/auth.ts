import { request } from './client'
import type { User } from '../types'

export interface LoginResponse {
  token: string
  user: User
}

export async function login(identifier: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { identifier, password },
  })
}

export async function me(): Promise<{ user: User }> {
  return request<{ user: User }>('/auth/me')
}

export async function logout(): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' })
}

export function googleAuthURL(): string {
  return '/api/auth/google'
}
