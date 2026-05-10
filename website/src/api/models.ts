import { request, getToken } from './client'
import type { AIModel, Category, SystemStatus, Chat } from '../types'

export async function adminListModels(): Promise<{ models: AIModel[] }> {
  return request('/admin/models')
}

export async function syncModels(): Promise<{ models: AIModel[] }> {
  return request('/admin/models/sync', { method: 'POST' })
}

export async function uninstallModel(name: string): Promise<{ ok: boolean }> {
  return request(`/admin/models/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

// forgetModel removes the row from our DB without touching Ollama. Only works
// for already-uninstalled models — used to clean stale entries.
export async function forgetModel(id: number): Promise<{ ok: boolean }> {
  return request(`/admin/models/${id}/forget`, { method: 'POST' })
}

// InstallEntry mirrors back/internal/services/ollama.InstallEntry so we can
// render every in-flight `ollama pull`, even those started by other admins.
export interface InstallEntry {
  name: string
  status: 'installing' | 'done' | 'error'
  latest: string
  total: number
  completed: number
  error?: string
  started_at: string
  updated_at: string
  started_by: number
}

export async function listInstalls(): Promise<{ installs: InstallEntry[] }> {
  return request('/admin/models/installs')
}

export async function updateModel(id: number, input: {
  display_name?: string
  description?: string
  category_id?: number | null
  category_ids?: number[]
  is_enabled?: boolean
}): Promise<{ model: AIModel }> {
  return request(`/admin/models/${id}`, { method: 'PATCH', body: input })
}

export async function listCategories(): Promise<{ categories: Category[] }> {
  return request('/admin/categories')
}

export async function createCategory(input: { name: string; description?: string }) {
  return request<{ category: Category }>('/admin/categories', { method: 'POST', body: input })
}

export async function updateCategory(id: number, input: { name: string; description?: string }) {
  return request<{ category: Category }>(`/admin/categories/${id}`, { method: 'PATCH', body: input })
}

export async function systemStatus(): Promise<SystemStatus> {
  return request('/admin/system/status')
}

export async function adminListAllChats(): Promise<{ chats: Chat[] }> {
  return request('/admin/chats')
}

export async function adminListChatsByUser(userId: number): Promise<{ chats: Chat[] }> {
  return request(`/admin/users/${userId}/chats`)
}

export async function adminGetChat(id: number): Promise<{ chat: Chat }> {
  return request(`/admin/chats/${id}`)
}

export interface InstallHandlers {
  onProgress: (ev: { status: string; total?: number; completed?: number }) => void
  onDone: () => void
  onError: (message: string) => void
}

export function installModel(name: string, h: InstallHandlers): AbortController {
  const ctrl = new AbortController()
  ;(async () => {
    try {
      const token = getToken()
      const res = await fetch('/api/admin/models/install', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name }),
      })
      if (!res.ok || !res.body) {
        h.onError(`HTTP ${res.status}`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const ev of events) {
          if (!ev.trim()) continue
          let event = 'message'
          let data = ''
          for (const line of ev.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            else if (line.startsWith('data:')) data += line.slice(5).trim()
          }
          if (!data) continue
          try {
            const payload = JSON.parse(data)
            if (event === 'progress') h.onProgress(payload)
            else if (event === 'done') h.onDone()
            else if (event === 'error') h.onError(payload.error ?? 'install error')
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      h.onError((e as Error).message)
    }
  })()
  return ctrl
}
