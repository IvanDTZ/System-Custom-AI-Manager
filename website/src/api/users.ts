import { request } from './client'
import type { User } from '../types'

export async function listUsers(params: { status?: string; search?: string } = {}): Promise<{ users: User[] }> {
  const q = new URLSearchParams()
  if (params.status) q.set('status', params.status)
  if (params.search) q.set('search', params.search)
  const suffix = q.toString() ? `?${q}` : ''
  return request(`/admin/users${suffix}`)
}

export async function createUser(input: {
  name: string
  username: string
  email: string
  password: string
  role?: string
}): Promise<{ user: User }> {
  return request('/admin/users', { method: 'POST', body: input })
}

export async function updateUser(id: number, input: { name?: string; username?: string; role?: string }) {
  return request<{ user: User }>(`/admin/users/${id}`, { method: 'PATCH', body: input })
}

export async function approveUser(id: number) {
  return request<{ user: User }>(`/admin/users/${id}/approve`, { method: 'POST' })
}

export async function disableUser(id: number) {
  return request<{ user: User }>(`/admin/users/${id}/disable`, { method: 'POST' })
}

export async function enableUser(id: number) {
  return request<{ user: User }>(`/admin/users/${id}/enable`, { method: 'POST' })
}

export async function resetPassword(id: number, newPassword: string) {
  return request<{ ok: boolean }>(`/admin/users/${id}/reset-password`, {
    method: 'POST',
    body: { new_password: newPassword },
  })
}
