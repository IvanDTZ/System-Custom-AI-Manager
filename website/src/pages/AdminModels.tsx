import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/admin/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { Pagination } from '../components/ui/Pagination'
import { ProgressBar } from '../components/ui/ProgressBar'
import { confirm } from '../components/ui/dialogs'
import { usePagination } from '../hooks/usePagination'
import * as adminApi from '../api/models'
import type { AIModel, Category } from '../types'
import { AVAILABLE_MODELS } from '../data/availableModels'
import { useModelInstall } from '../contexts/ModelInstallContext'

const CUSTOM_OPTION = '__custom__'

function fmtBytes(n: number) {
  if (!n) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0; let v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${units[i]}`
}

export default function AdminModels() {
  const [models, setModels] = useState<AIModel[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedModel, setSelectedModel] = useState<string>(AVAILABLE_MODELS[1]?.name ?? '')
  const [customName, setCustomName] = useState('')
  const [editing, setEditing] = useState<AIModel | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const install = useModelInstall()
  const installing = install.active?.status === 'installing'
  const installLog = install.active?.log ?? ''
  const logRef = useRef<HTMLPreElement>(null)

  const installedNames = useMemo(
    () => new Set(models.filter(m => m.is_installed).map(m => m.ollama_name)),
    [models],
  )
  const installName = selectedModel === CUSTOM_OPTION ? customName.trim() : selectedModel
  const selectedMeta = AVAILABLE_MODELS.find(m => m.name === selectedModel)
  const alreadyInstalled = installName !== '' && installedNames.has(installName)

  const pagination = usePagination(models, { pageSize: 20 })

  async function refresh() {
    const [m, c] = await Promise.all([adminApi.adminListModels(), adminApi.listCategories()])
    setModels(m.models); setCategories(c.categories)
  }
  useEffect(() => { refresh().catch(e => setError((e as Error).message)) }, [])

  // Keep the install log scrolled to the bottom as new lines stream in.
  // scrollTo with `behavior: 'smooth'` for a calm pull instead of a jolt.
  useEffect(() => {
    const el = logRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [installLog])

  // Refresh the table once an install lands, so the new model shows up with
  // is_installed=true. Keep the success banner visible briefly so the user
  // sees the confirmation, then let the context clear it.
  useEffect(() => {
    if (install.active?.status === 'done') {
      refresh()
      setCustomName('')
      const t = setTimeout(() => install.clear(), 4000)
      return () => clearTimeout(t)
    }
  }, [install.active?.status, install])

  async function handleSync() {
    setSyncing(true); setError(null)
    try {
      const r = await adminApi.syncModels()
      setModels(r.models)
    } catch (e) { setError((e as Error).message) }
    finally { setSyncing(false) }
  }

  function handleInstall() {
    const name = installName
    if (!name) return
    install.start(name)
  }

  async function handleUninstall(name: string) {
    const ok = await confirm({
      title: 'Uninstall model',
      message: <>Remove <span className="font-medium text-white">{name}</span> from Ollama? You can re-install it any time, but it will redownload the full model.</>,
      confirmLabel: 'Uninstall',
      danger: true,
    })
    if (!ok) return
    await adminApi.uninstallModel(name)
    refresh()
  }

  async function handleForget(m: AIModel) {
    const ok = await confirm({
      title: 'Remove from list',
      message: <>Remove <span className="font-medium text-white">{m.ollama_name}</span> from this list? Ollama is not affected — this just deletes the row in the admin table. Re-install it from the dropdown to bring it back.</>,
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    try {
      await adminApi.forgetModel(m.id)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleToggleEnabled(m: AIModel) {
    await adminApi.updateModel(m.id, { is_enabled: !m.is_enabled })
    refresh()
  }

  return (
    <div>
      <PageHeader
        title="Models"
        subtitle="Install, categorise and toggle visibility of Ollama models."
        actions={
          <>
            <Button variant="secondary" onClick={handleSync} loading={syncing}>Sync with Ollama</Button>
          </>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Select
              label="Install model"
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
            >
              <optgroup label="Light — best for 8 GB Macs">
                {AVAILABLE_MODELS.filter(m => m.recommended === 'low-end').map(m => (
                  <option key={m.name} value={m.name}>
                    {m.label} · {m.size}{installedNames.has(m.name) ? ' · installed' : ''}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Medium — 16 GB+ recommended">
                {AVAILABLE_MODELS.filter(m => m.recommended === 'mid').map(m => (
                  <option key={m.name} value={m.name}>
                    {m.label} · {m.size}{installedNames.has(m.name) ? ' · installed' : ''}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Heavy — high-RAM Macs only">
                {AVAILABLE_MODELS.filter(m => m.recommended === 'high-end').map(m => (
                  <option key={m.name} value={m.name}>
                    {m.label} · {m.size}{installedNames.has(m.name) ? ' · installed' : ''}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Other">
                <option value={CUSTOM_OPTION}>Custom name…</option>
              </optgroup>
            </Select>
          </div>
          {selectedModel === CUSTOM_OPTION && (
            <div className="flex-1">
              <Input
                label="Custom Ollama name"
                placeholder="e.g. mixtral:8x7b"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
              />
            </div>
          )}
          <Button onClick={handleInstall} loading={installing} disabled={!installName || alreadyInstalled || installing}>
            {alreadyInstalled ? 'Already installed' : installing ? `Installing ${install.active?.name}…` : 'Pull from Ollama'}
          </Button>
        </div>
        {selectedMeta && selectedModel !== CUSTOM_OPTION && (
          <p className="mt-2 text-xs text-text-muted">
            <span className="text-text-subtle">{selectedMeta.ramHint} · </span>
            {selectedMeta.description}
          </p>
        )}
        {installLog && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-text-subtle">
              <span>
                {install.active?.name && (
                  <>Pull log · <span className="text-white/80">{install.active.name}</span></>
                )}
              </span>
              {install.active?.status === 'installing' && (
                <button
                  type="button"
                  onClick={install.cancel}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/80 hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
              )}
            </div>
            <pre
              ref={logRef}
              className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/50 p-3 text-[11px] leading-5 text-text-muted"
            >
              {installLog.trim()}
            </pre>
            {install.active && (
              <div className="mt-2">
                <ProgressBar
                  value={install.active.latest?.total
                    ? (install.active.latest.completed ?? 0) / install.active.latest.total
                    : null}
                  indeterminate={install.active.status === 'installing' && !install.active.latest?.total}
                  tone={
                    install.active.status === 'error' ? 'danger'
                      : install.active.status === 'done' ? 'success'
                      : 'accent'
                  }
                  label={install.active.latest?.status ?? install.active.status}
                />
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-white/[0.03] text-left text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Model</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Size</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {pagination.total === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-text-muted">
                  No models. Click "Sync with Ollama" or install one above.
                </td></tr>
              )}
              {pagination.pageItems.map(m => (
                <tr key={m.id} className="border-t border-white/[0.05] hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{m.display_name || m.ollama_name}</div>
                    <div className="text-xs text-text-subtle">{m.ollama_name} · {m.parameter_size || '—'} · {m.family || '—'}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    {m.categories && m.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {m.categories.map(cat => (
                          <span key={cat.id} className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-white/80">
                            {cat.name}
                          </span>
                        ))}
                      </div>
                    ) : m.category?.name ? (
                      <span className="text-text-muted">{m.category.name}</span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{fmtBytes(m.size)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={m.is_installed ? 'success' : 'warning'}>{m.is_installed ? 'installed' : 'missing'}</Badge>
                      <Badge tone={m.is_enabled ? 'info' : 'neutral'}>{m.is_enabled ? 'enabled' : 'disabled'}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleToggleEnabled(m)}>
                        {m.is_enabled ? 'Disable' : 'Enable'}
                      </Button>
                      {m.is_installed ? (
                        <Button size="sm" variant="ghost" onClick={() => handleUninstall(m.ollama_name)}>Uninstall</Button>
                      ) : (
                        <Button size="sm" variant="danger" onClick={() => handleForget(m)}>Remove</Button>
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
            itemLabel="models"
          />
        </div>
      </Card>

      <EditModelModal model={editing} categories={categories} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />

      {error && (
        <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
      )}
    </div>
  )
}

function EditModelModal({ model, categories, onClose, onSaved }: {
  model: AIModel | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (model) {
      setDisplayName(model.display_name)
      setDescription(model.description)
      const fromMulti = model.categories?.map(c => c.id) ?? []
      const initial = new Set<number>(fromMulti)
      // Fall back to legacy category_id if categories[] is empty (older rows).
      if (initial.size === 0 && model.category_id) initial.add(model.category_id)
      setSelectedCategoryIds(initial)
      setError(null)
    }
  }, [model])

  function toggleCategory(id: number) {
    setSelectedCategoryIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    if (!model) return
    setBusy(true); setError(null)
    try {
      const ids = Array.from(selectedCategoryIds)
      await adminApi.updateModel(model.id, {
        display_name: displayName,
        description,
        category_ids: ids,
      })
      onSaved()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal
      open={!!model}
      onClose={onClose}
      title={`Edit ${model?.ollama_name ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={submit}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Categories</span>
          <div className="flex flex-wrap gap-1.5">
            {categories.length === 0 && (
              <span className="text-xs text-text-subtle">No categories yet — create some in the Categories page.</span>
            )}
            {categories.map(c => {
              const checked = selectedCategoryIds.has(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  aria-pressed={checked}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    checked
                      ? 'border-violet-300/40 bg-violet-400/15 text-violet-100'
                      : 'border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]'
                  }`}
                >
                  {checked && <span className="mr-1">✓</span>}
                  {c.name}
                </button>
              )
            })}
          </div>
          <span className="text-xs text-text-subtle">Click to toggle. A model can belong to multiple categories.</span>
        </div>
        {error && <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}
      </div>
    </Modal>
  )
}
