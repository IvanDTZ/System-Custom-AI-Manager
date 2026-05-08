import { request, getToken } from './client'
import type { Chat, AIModel } from '../types'

export async function listChats(): Promise<{ chats: Chat[] }> {
  return request('/chats')
}

export async function createChat(modelName: string, title = 'New chat'): Promise<{ chat: Chat }> {
  return request('/chats', { method: 'POST', body: { model_name: modelName, title } })
}

export async function getChat(id: number): Promise<{ chat: Chat }> {
  return request(`/chats/${id}`)
}

export async function deleteChat(id: number): Promise<void> {
  await request(`/chats/${id}`, { method: 'DELETE' })
}

export async function listModels(): Promise<{ models: AIModel[] }> {
  return request('/models')
}

export interface StreamHandlers {
  onToken: (chunk: string) => void
  onDone: (info: { chat_id: number; message_id: number }) => void
  onError: (message: string) => void
  onQueued?: (position: number) => void
  onReady?: () => void
}

/**
 * POSTs a chat message with SSE streaming. Returns an AbortController so the
 * caller can cancel.
 */
export function streamMessage(chatId: number, content: string, h: StreamHandlers): AbortController {
  const ctrl = new AbortController()
  ;(async () => {
    try {
      const token = getToken()
      const res = await fetch(`/api/chats/${chatId}/stream`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content }),
      })
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        h.onError(text || `HTTP ${res.status}`)
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
          let payload: unknown
          try { payload = JSON.parse(data) } catch { continue }
          if (event === 'token') {
            const p = payload as { content?: string }
            if (p.content) h.onToken(p.content)
          } else if (event === 'queued') {
            const p = payload as { position?: number }
            h.onQueued?.(p.position ?? 1)
          } else if (event === 'ready') {
            h.onReady?.()
          } else if (event === 'done') {
            h.onDone(payload as { chat_id: number; message_id: number })
          } else if (event === 'error') {
            const p = payload as { error?: string }
            h.onError(p.error ?? 'stream error')
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      h.onError((e as Error).message)
    }
  })()
  return ctrl
}
