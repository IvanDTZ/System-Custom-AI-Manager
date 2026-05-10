import { useEffect, useState } from 'react'
import { PageHeader } from '../components/admin/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Pagination } from '../components/ui/Pagination'
import { usePagination } from '../hooks/usePagination'
import * as adminApi from '../api/models'
import { Markdown } from '../components/chat/Markdown'
import type { Chat } from '../types'

export default function AdminChats() {
  const [chats, setChats] = useState<Chat[]>([])
  const [openChat, setOpenChat] = useState<Chat | null>(null)

  useEffect(() => {
    adminApi.adminListAllChats().then(r => setChats(r.chats)).catch(() => setChats([]))
  }, [])

  const pagination = usePagination(chats, { pageSize: 20 })

  async function viewChat(id: number) {
    const r = await adminApi.adminGetChat(id)
    setOpenChat(r.chat)
  }

  return (
    <div>
      <PageHeader title="Chats" subtitle="Inspect every conversation in the system." />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-white/[0.03] text-left text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Model</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {pagination.total === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-text-muted">No chats yet.</td></tr>
              )}
              {pagination.pageItems.map(c => (
                <tr key={c.id} className="border-t border-white/[0.05] hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5 font-medium">{c.title}</td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {c.user ? (
                      <div className="min-w-0">
                        <div className="truncate">{c.user.name || c.user.username}</div>
                        <div className="truncate text-xs text-text-subtle">{c.user.email}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone="neutral">{c.model_name || '—'}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{new Date(c.updated_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="secondary" onClick={() => viewChat(c.id)}>View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-white/[0.05]">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            rangeStart={pagination.rangeStart}
            rangeEnd={pagination.rangeEnd}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
            itemLabel="chats"
          />
        </div>
      </Card>

      <Modal
        open={!!openChat}
        onClose={() => setOpenChat(null)}
        title={openChat?.title}
        className="!max-w-3xl"
        footer={<Button variant="secondary" onClick={() => setOpenChat(null)}>Close</Button>}
      >
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {(openChat?.messages ?? []).map(m => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
              <div className={
                m.role === 'user'
                  ? 'max-w-[85%] rounded-2xl rounded-br-md border border-white/10 bg-white/[0.06] px-3.5 py-2 text-sm'
                  : 'w-full'
              }>
                {m.role === 'assistant' ? (
                  <>
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-text-subtle">
                      Assistant{m.model_name ? ` · ${m.model_name}` : ''}
                    </div>
                    <Markdown content={m.content} />
                  </>
                ) : m.content}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
