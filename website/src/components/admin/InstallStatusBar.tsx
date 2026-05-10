import { useNavigate } from 'react-router-dom'
import { useModelInstall } from '../../contexts/ModelInstallContext'
import { ProgressBar } from '../ui/ProgressBar'
import type { InstallEntry } from '../../api/models'

// Sticky banner above every admin page. Shows:
//   1. The install THIS admin started (full controls + log link).
//   2. Anything other admins are pulling on the same backend (read-only,
//      derived from the polled /admin/models/installs endpoint).
export function InstallStatusBar() {
  const install = useModelInstall()
  const nav = useNavigate()
  const local = install.active
  const localName = local?.name ?? null

  // De-dupe: hide a server entry that's already represented by `local`,
  // otherwise the same pull would appear twice during overlap.
  const others = install.serverInstalls.filter(e => e.name !== localName)

  if (!local && others.length === 0) return null

  return (
    <div className="mb-4 space-y-2">
      {local && <LocalRow />}
      {others.map(entry => (
        <RemoteRow key={entry.name} entry={entry} onView={() => nav('/admin/models')} />
      ))}
    </div>
  )
}

function LocalRow() {
  const install = useModelInstall()
  const nav = useNavigate()
  const active = install.active!

  const tone =
    active.status === 'error' ? 'border-red-400/40 bg-red-500/10 text-red-100'
      : active.status === 'done' ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
      : active.status === 'cancelled' ? 'border-white/10 bg-white/[0.05] text-white/80'
      : 'border-amber-300/30 bg-amber-300/[0.07] text-amber-100'

  const pct = active.latest?.total
    ? Math.min(100, Math.round(((active.latest.completed ?? 0) / active.latest.total) * 100))
    : null

  const label =
    active.status === 'installing' ? `Installing ${active.name}${pct != null ? ` · ${pct}%` : ''}`
      : active.status === 'done' ? `Installed ${active.name}`
      : active.status === 'error' ? `Failed: ${active.name}`
      : `Cancelled ${active.name}`

  return (
    <div className={`rounded-xl border px-3 py-2.5 text-sm ${tone}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={active.status === 'installing' ? 'inline-block size-2 animate-pulse rounded-full bg-current' : 'inline-block size-2 rounded-full bg-current'} />
        <span className="font-medium">{label}</span>
        {active.latest?.status && active.status === 'installing' && (
          <span className="text-xs opacity-80">{active.latest.status}</span>
        )}
        <span className="rounded-md border border-current/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider opacity-80">You</span>
        <div className="ml-auto flex gap-1.5">
          <button type="button" onClick={() => nav('/admin/models')} className="rounded-md border border-current/30 px-2 py-1 text-xs hover:bg-current/10">View</button>
          {active.status === 'installing' ? (
            <button type="button" onClick={install.cancel} className="rounded-md border border-current/30 px-2 py-1 text-xs hover:bg-current/10">Cancel</button>
          ) : (
            <button type="button" onClick={install.clear} className="rounded-md border border-current/30 px-2 py-1 text-xs hover:bg-current/10">Dismiss</button>
          )}
        </div>
      </div>
      {active.status === 'installing' && (
        <div className="mt-2">
          <ProgressBar
            value={active.latest?.total ? (active.latest.completed ?? 0) / active.latest.total : null}
            indeterminate={!active.latest?.total}
            size="sm"
            tone="accent"
          />
        </div>
      )}
    </div>
  )
}

function RemoteRow({ entry, onView }: { entry: InstallEntry; onView: () => void }) {
  const tone =
    entry.status === 'error' ? 'border-red-400/40 bg-red-500/10 text-red-100'
      : entry.status === 'done' ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
      : 'border-violet-400/30 bg-violet-500/[0.08] text-violet-100'

  const pct = entry.total ? Math.min(100, Math.round((entry.completed / entry.total) * 100)) : null

  const label =
    entry.status === 'installing' ? `Another admin is installing ${entry.name}${pct != null ? ` · ${pct}%` : ''}`
      : entry.status === 'done' ? `Just installed: ${entry.name}`
      : `Pull failed: ${entry.name}`

  return (
    <div className={`rounded-xl border px-3 py-2.5 text-sm ${tone}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={entry.status === 'installing' ? 'inline-block size-2 animate-pulse rounded-full bg-current' : 'inline-block size-2 rounded-full bg-current'} />
        <span className="font-medium">{label}</span>
        {entry.latest && entry.status === 'installing' && (
          <span className="text-xs opacity-80">{entry.latest}</span>
        )}
        <span className="rounded-md border border-current/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider opacity-80">Shared</span>
        <button type="button" onClick={onView} className="ml-auto rounded-md border border-current/30 px-2 py-1 text-xs hover:bg-current/10">View</button>
      </div>
      {entry.status === 'installing' && (
        <div className="mt-2">
          <ProgressBar
            value={entry.total ? entry.completed / entry.total : null}
            indeterminate={!entry.total}
            size="sm"
            tone="accent"
          />
        </div>
      )}
    </div>
  )
}
