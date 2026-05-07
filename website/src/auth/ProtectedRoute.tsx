import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import type { Role } from '../types'

export function ProtectedRoute({
  children,
  requireRoles,
}: {
  children: ReactNode
  requireRoles?: Role[]
}) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (requireRoles && !requireRoles.includes(user.role)) {
    return <Navigate to="/chat" replace />
  }
  return <>{children}</>
}

function FullPageLoader() {
  return (
    <div className="grid h-full place-items-center text-text-muted">
      <div className="size-7 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
    </div>
  )
}
