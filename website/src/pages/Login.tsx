import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { ApiError } from '../api/client'

export default function Login() {
  const { user, signIn } = useAuth()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to={loc.state?.from ?? '/chat'} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(identifier, password)
      nav(loc.state?.from ?? '/chat', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'account_pending') {
          nav('/auth/pending?status=pending', { replace: true })
          return
        }
        if (err.code === 'account_disabled') {
          nav('/auth/pending?status=disabled', { replace: true })
          return
        }
        setError(err.message)
      } else {
        setError((err as Error).message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-full place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-white to-zinc-300 text-black shadow-2xl">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
              <path d="M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-text-muted">Sign in to your AI Manager workspace</p>
        </div>

        <Card className="p-6">
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input
              label="Email or username"
              autoFocus
              autoComplete="username"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            {error && <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
            <Button type="submit" size="lg" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] uppercase tracking-wider text-text-subtle">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <a
            href="/api/auth/google"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium text-white transition-colors hover:bg-white/[0.08]"
          >
            <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 7 29.3 5 24 5c-7.6 0-14.1 4.3-17.7 10.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.7 26.7 36.6 24 36.6c-5.2 0-9.7-3.3-11.3-7.9l-6.5 5C9.6 39.7 16.3 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.5l6.2 5.2C40.8 35.6 44 30.2 44 24c0-1.2-.1-2.4-.4-3.5z"/>
            </svg>
            Continue with Google
          </a>
        </Card>
      </div>
    </div>
  )
}
