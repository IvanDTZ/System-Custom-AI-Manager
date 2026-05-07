import { useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import type { Chat } from '../../types'
import { cn } from '../../utils/cn'
import { UserMenu } from '../layout/UserMenu'

function bucketFor(date: Date): string {
  const now = new Date()
  const d = new Date(date)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.floor((today.getTime() - day.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return 'This week'
  if (diffDays <= 30) return 'This month'
  return 'Older'
}

export function ChatSidebar({
  chats,
  activeId,
  onNewChat,
  onDelete,
}: {
  chats: Chat[]
  activeId?: number
  onNewChat: () => void
  onDelete: (id: number) => void
}) {
  const nav = useNavigate()

  const groups = useMemo(() => {
    const m = new Map<string, Chat[]>()
    for (const c of chats) {
      const b = bucketFor(new Date(c.updated_at))
      if (!m.has(b)) m.set(b, [])
      m.get(b)!.push(c)
    }
    return Array.from(m.entries())
  }, [chats])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-4">
        <NavLink to="/chat" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-white to-zinc-300 text-black">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
              <path d="M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4Z" />
            </svg>
          </span>
          AI Manager
        </NavLink>
      </div>
      <button
        onClick={onNewChat}
        className="mx-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] text-sm font-medium text-white transition-colors hover:bg-white/[0.10]"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
          <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
        </svg>
        New chat
      </button>

      <nav className="mt-4 flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        {groups.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-text-subtle">
            No conversations yet.
          </div>
        )}
        {groups.map(([bucket, items]) => (
          <div key={bucket}>
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-subtle">
              {bucket}
            </div>
            <ul className="mt-1 space-y-0.5">
              {items.map(c => (
                <li key={c.id}>
                  <div
                    className={cn(
                      'group flex items-center gap-1 rounded-lg pl-3 pr-1.5 transition-colors',
                      c.id === activeId ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]',
                    )}
                  >
                    <button
                      onClick={() => nav(`/chat/${c.id}`)}
                      className="flex-1 truncate py-2 text-left text-[13.5px] text-white/90"
                    >
                      {c.title || 'Untitled'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(c.id) }}
                      title="Delete chat"
                      className="grid size-7 place-items-center rounded-md text-text-subtle opacity-0 transition-opacity hover:bg-white/10 hover:text-red-300 group-hover:opacity-100"
                    >
                      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <UserMenu />
    </div>
  )
}
