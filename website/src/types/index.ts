export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'USER'
export type UserStatus = 'pending' | 'active' | 'disabled'
export type Provider = 'local' | 'google'

export interface User {
  id: number
  name: string
  username: string
  email: string
  provider: Provider
  google_id?: string
  role: Role
  status: UserStatus
  avatar_url?: string
  last_login_at?: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: number
  name: string
  description: string
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface AIModel {
  id: number
  ollama_name: string
  display_name: string
  description: string
  category_id?: number | null
  category?: Category | null
  is_installed: boolean
  is_enabled: boolean
  size: number
  family: string
  parameter_size: string
  quantization: string
  created_at: string
  updated_at: string
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: number
  chat_id: number
  role: MessageRole
  content: string
  model_name?: string
  created_at: string
}

export interface Chat {
  id: number
  user_id: number
  title: string
  model_name: string
  created_at: string
  updated_at: string
  user?: User
  messages?: ChatMessage[]
}

export interface SystemStatus {
  ollama_connected: boolean
  models_installed: number
  users_active: number
  chats_total: number
  recent_messages_24h: number
}
