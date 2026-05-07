import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getToken, setToken } from '../api/client'
import * as authApi from '../api/auth'
import type { User } from '../types'

export interface AuthState {
  user: User | null
  loading: boolean
  signIn: (identifier: string, password: string) => Promise<User>
  signInWithToken: (token: string) => Promise<User>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      const token = getToken()
      if (!token) { setLoading(false); return }
      try {
        const { user } = await authApi.me()
        if (!cancelled) setUser(user)
      } catch {
        setToken(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => { cancelled = true }
  }, [])

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    async signIn(identifier, password) {
      const { token, user } = await authApi.login(identifier, password)
      setToken(token)
      setUser(user)
      return user
    },
    async signInWithToken(token) {
      setToken(token)
      const { user } = await authApi.me()
      setUser(user)
      return user
    },
    async signOut() {
      try { await authApi.logout() } catch { /* noop */ }
      setToken(null)
      setUser(null)
    },
    async refresh() {
      try {
        const { user } = await authApi.me()
        setUser(user)
      } catch { setUser(null) }
    },
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
