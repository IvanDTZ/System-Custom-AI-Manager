import { useEffect, useState } from 'react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { PageHeader } from '../components/admin/PageHeader'
import * as adminApi from '../api/models'
import type { SystemStatus } from '../types'

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-text-subtle">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-text-muted">{hint}</div>}
    </Card>
  )
}

export default function AdminDashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    function refresh() {
      adminApi.systemStatus()
        .then(s => alive && setStatus(s))
        .catch(e => alive && setError((e as Error).message))
    }
    refresh()
    const t = window.setInterval(refresh, 15000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="High-level health of your AI Manager instance." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-text-subtle">Ollama</div>
          <div className="mt-2 flex items-center gap-2">
            <span className={
              'size-2 rounded-full ' + (status?.ollama_connected ? 'bg-emerald-400' : 'bg-red-400')
            } />
            <span className="text-lg font-semibold">
              {status?.ollama_connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="mt-1 text-xs text-text-muted">Local /api/tags ping</div>
        </Card>
        <Metric label="Models installed" value={status?.models_installed ?? '—'} hint="Visible to admin" />
        <Metric label="Active users" value={status?.users_active ?? '—'} />
        <Metric label="Chats" value={status?.chats_total ?? '—'} hint="Total across all users" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Recent activity</div>
              <div className="text-xs text-text-muted">Messages exchanged in the last 24h</div>
            </div>
            <Badge tone="info">{status?.recent_messages_24h ?? 0} msgs</Badge>
          </div>
          <div className="mt-6 grid h-32 place-items-center text-sm text-text-subtle">
            Time-series chart goes here.
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-medium">System</div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between text-text-muted">
              <span>Frontend</span><span className="text-white">React 19 + Vite</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Backend</span><span className="text-white">Go + Gin + GORM</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Inference</span><span className="text-white">Ollama (local)</span>
            </div>
          </div>
        </Card>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
      )}
    </div>
  )
}
