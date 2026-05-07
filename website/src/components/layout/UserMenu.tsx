import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { Badge } from '../ui/Badge'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const nav = useNavigate()
  if (!user) return null
  const initials = (user.name || user.email).split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="border-t border-white/[0.06] p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.04]">
        <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-white/15 to-white/[0.04] text-sm font-semibold">
          {user.avatar_url ? <img src={user.avatar_url} alt="" className="size-9 rounded-full" /> : initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user.name || user.username}</div>
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs text-text-subtle">{user.email}</span>
          </div>
        </div>
        <Badge tone={user.role === 'SUPER_ADMIN' ? 'info' : user.role === 'ADMIN' ? 'success' : 'neutral'}>
          {user.role.replace('_', ' ')}
        </Badge>
      </div>
      <div className="mt-2 flex gap-2">
        {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
          <button
            onClick={() => nav('/admin')}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] py-1.5 text-xs hover:bg-white/[0.08]"
          >
            Admin
          </button>
        )}
        <button
          onClick={() => { signOut().then(() => nav('/login')) }}
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] py-1.5 text-xs hover:bg-white/[0.08]"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
