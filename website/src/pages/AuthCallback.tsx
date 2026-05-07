import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export default function AuthCallback() {
  const [params] = useSearchParams()
  const { signInWithToken } = useAuth()
  const nav = useNavigate()

  useEffect(() => {
    const token = params.get('token')
    if (!token) { nav('/login', { replace: true }); return }
    signInWithToken(token)
      .then(() => nav('/chat', { replace: true }))
      .catch(() => nav('/login', { replace: true }))
  }, [params, signInWithToken, nav])

  return (
    <div className="grid min-h-full place-items-center text-text-muted">
      <div className="size-7 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
    </div>
  )
}
