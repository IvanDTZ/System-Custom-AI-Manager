import { useEffect, useState } from 'react'
import { PageHeader } from '../components/admin/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import * as adminApi from '../api/models'
import type { Category } from '../types'

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  async function refresh() {
    const r = await adminApi.listCategories()
    setCategories(r.categories)
  }
  useEffect(() => { refresh() }, [])

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Group models so users can filter the picker."
        actions={<Button onClick={() => setCreating(true)}>+ New category</Button>}
      />

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {categories.map(c => (
              <tr key={c.id} className="border-t border-white/[0.05] hover:bg-white/[0.03]">
                <td className="px-4 py-2.5 font-medium">{c.name}</td>
                <td className="px-4 py-2.5 text-text-muted">{c.description || '—'}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={c.is_system ? 'info' : 'neutral'}>{c.is_system ? 'system' : 'custom'}</Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <CategoryModal
        open={creating || !!editing}
        category={editing}
        onClose={() => { setCreating(false); setEditing(null) }}
        onSaved={() => { setCreating(false); setEditing(null); refresh() }}
      />
    </div>
  )
}

function CategoryModal({ open, category, onClose, onSaved }: {
  open: boolean
  category: Category | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '')
      setDescription(category?.description ?? '')
      setError(null)
    }
  }, [open, category])

  async function submit() {
    setBusy(true); setError(null)
    try {
      if (category) await adminApi.updateCategory(category.id, { name, description })
      else await adminApi.createCategory({ name, description })
      onSaved()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? 'Edit category' : 'New category'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={submit}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} />
        <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} />
        {error && <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}
      </div>
    </Modal>
  )
}
