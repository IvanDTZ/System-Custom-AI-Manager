import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
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
          <img src="/Logo.png" alt="AI Manager" className="mx-auto mb-6 size-40 rounded-3xl object-contain shadow-2xl sm:size-48 md:size-56" />
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
            <PasswordInput
              label="Password"
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

          {/* Google sign-in is hidden in the UI but the backend route is still
              live (GET /api/auth/google). To bring it back, restore the divider
              and the <a href="/api/auth/google"> button — see git history. */}
        </Card>
      </div>
    </div>
  )
}
