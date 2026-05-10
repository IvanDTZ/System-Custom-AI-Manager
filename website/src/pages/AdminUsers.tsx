import { useEffect, useMemo, useState } from 'react'
import * as usersApi from '../api/users'
import type { User, Role } from '../types'
import { PageHeader } from '../components/admin/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { Pagination } from '../components/ui/Pagination'
import { confirm, notify } from '../components/ui/dialogs'
import { usePagination } from '../hooks/usePagination'

function statusTone(s: string) {
  if (s === 'active') return 'success' as const
  if (s === 'pending') return 'warning' as const
  return 'danger' as const
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [resetting, setResetting] = useState<User | null>(null)

  async function refresh() {
    const r = await usersApi.listUsers({ status: statusFilter || undefined, search: search || undefined })
    setUsers(r.users)
  }

  useEffect(() => { refresh() }, [statusFilter])

  const filtered = useMemo(() => users, [users])
  const pagination = usePagination(filtered, { pageSize: 20 })

  async function handleApprove(u: User) {
    await usersApi.approveUser(u.id); refresh()
  }
  async function handleDisable(u: User) {
    const ok = await confirm({
      title: 'Disable user',
      message: <>Disable <span className="font-medium text-white">{u.email}</span>? They won't be able to sign in until you enable them again.</>,
      confirmLabel: 'Disable',
      danger: true,
    })
    if (!ok) return
    await usersApi.disableUser(u.id); refresh()
  }
  async function handleEnable(u: User) {
    await usersApi.enableUser(u.id); refresh()
  }

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Approve, disable and manage every user in the system."
        actions={<Button onClick={() => setCreating(true)}>+ New user</Button>}
      />

      <Card className="mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            placeholder="Search by name, email or username"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && refresh()}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </Select>
        </div>
        <Button variant="secondary" onClick={refresh}>Apply</Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-white/[0.03] text-left text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Provider</th>
                <th className="px-4 py-2.5 font-medium">Last login</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {pagination.total === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">No users</td></tr>
              )}
              {pagination.pageItems.map(u => (
                <tr key={u.id} className="border-t border-white/[0.05] hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="grid size-8 place-items-center rounded-full bg-white/[0.06] text-xs font-semibold">
                        {(u.name || u.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{u.name || u.username || u.email}</div>
                        <div className="truncate text-xs text-text-subtle">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><Badge tone={statusTone(u.status)}>{u.status}</Badge></td>
                  <td className="px-4 py-2.5">
                    <Badge tone={u.role === 'SUPER_ADMIN' ? 'info' : u.role === 'ADMIN' ? 'success' : 'neutral'}>{u.role.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{u.provider}</td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap justify-end gap-1">
                      {u.status === 'pending' && (
                        <Button size="sm" variant="secondary" onClick={() => handleApprove(u)}>Approve</Button>
                      )}
                      {u.status === 'disabled' && (
                        <Button size="sm" variant="secondary" onClick={() => handleEnable(u)}>Enable</Button>
                      )}
                      {u.status === 'active' && (
                        <Button size="sm" variant="ghost" onClick={() => handleDisable(u)}>Disable</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>Edit</Button>
                      {u.provider === 'local' && (
                        <Button size="sm" variant="ghost" onClick={() => setResetting(u)}>Reset pwd</Button>
                      )}
                    </div>
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
            itemLabel="users"
          />
        </div>
      </Card>

      <CreateUserModal open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh() }} />
      <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} onSaved={() => setResetting(null)} />
    </div>
  )
}

function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('USER')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true); setError(null)
    try {
      await usersApi.createUser({ name, username, email, password, role })
      onCreated()
      setName(''); setUsername(''); setEmail(''); setPassword('')
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create user"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={submit}>Create</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} />
        <Input label="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <PasswordInput label="Password" hint="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
        <Select label="Role" value={role} onChange={e => setRole(e.target.value as Role)}>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
        </Select>
        {error && <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}
      </div>
    </Modal>
  )
}

function EditUserModal({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<Role>('USER')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) { setName(user.name); setUsername(user.username); setRole(user.role); setError(null) }
  }, [user])

  async function submit() {
    if (!user) return
    setBusy(true); setError(null)
    try {
      await usersApi.updateUser(user.id, { name, username, role })
      onSaved()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={`Edit ${user?.email ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={submit}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} />
        <Input label="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <Select label="Role" value={role} onChange={e => setRole(e.target.value as Role)}>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
        </Select>
        {error && <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}
      </div>
    </Modal>
  )
}

function ResetPasswordModal({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const [pwd, setPwd] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setPwd(''); setError(null) }, [user])

  async function submit() {
    if (!user) return
    if (pwd.length < 8) { setError('Password must be at least 8 characters'); return }
    setBusy(true); setError(null)
    try {
      await usersApi.resetPassword(user.id, pwd)
      onSaved()
      await notify({
        title: 'Password updated',
        message: <>The password for <span className="font-medium text-white">{user.email}</span> was changed successfully.</>,
        tone: 'success',
      })
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={`Reset password for ${user?.email ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={submit}>Set new password</Button>
        </>
      }
    >
      <PasswordInput label="New password" hint="At least 8 characters" value={pwd} onChange={e => setPwd(e.target.value)} />
      {error && <div className="mt-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}
    </Modal>
  )
}
