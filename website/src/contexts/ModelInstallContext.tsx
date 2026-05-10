import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { installModel, listInstalls, type InstallEntry } from '../api/models'

// Lives above the page tree so an in-flight `ollama pull` survives navigation,
// AND so any admin can see what every other admin is currently installing.
//
//   - `active` is what THIS browser kicked off via start(). It owns the SSE
//     stream and the AbortController, so navigation doesn't tear it down.
//   - `serverInstalls` is what the BACKEND knows about: a snapshot of every
//     pull currently running on the host, polled every 3 s while polling is
//     enabled. Includes pulls another admin started.

export interface InstallProgress {
  status: string
  total?: number
  completed?: number
}

export type InstallStatus = 'installing' | 'done' | 'error' | 'cancelled'

export interface InstallState {
  name: string
  log: string
  status: InstallStatus
  errorMessage?: string
  startedAt: number
  latest?: InstallProgress
}

interface ModelInstallContextValue {
  active: InstallState | null
  serverInstalls: InstallEntry[]
  start: (name: string) => void
  cancel: () => void
  clear: () => void
  setPollingEnabled: (enabled: boolean) => void
}

const Ctx = createContext<ModelInstallContextValue | null>(null)

export function ModelInstallProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<InstallState | null>(null)
  const [serverInstalls, setServerInstalls] = useState<InstallEntry[]>([])
  const [pollingEnabled, setPollingEnabled] = useState(false)
  const ctrlRef = useRef<AbortController | null>(null)

  // ---- Local install (this browser) -------------------------------------

  const start = useCallback((name: string) => {
    ctrlRef.current?.abort()
    setActive({ name, log: '', status: 'installing', startedAt: Date.now() })

    ctrlRef.current = installModel(name, {
      onProgress: ev => {
        const pctSuffix = ev.total ? ` (${Math.round(((ev.completed ?? 0) / ev.total) * 100)}%)` : ''
        setActive(prev => prev && prev.name === name && prev.status === 'installing'
          ? { ...prev, log: prev.log + `\n${ev.status}${pctSuffix}`, latest: ev }
          : prev,
        )
      },
      onDone: () => {
        setActive(prev => prev && prev.name === name ? { ...prev, status: 'done' } : prev)
      },
      onError: msg => {
        setActive(prev => prev && prev.name === name
          ? { ...prev, status: 'error', errorMessage: msg, log: prev.log + `\nERROR: ${msg}` }
          : prev,
        )
      },
    })
  }, [])

  const cancel = useCallback(() => {
    ctrlRef.current?.abort()
    ctrlRef.current = null
    setActive(prev => prev ? { ...prev, status: 'cancelled' } : prev)
  }, [])

  const clear = useCallback(() => {
    ctrlRef.current?.abort()
    ctrlRef.current = null
    setActive(null)
  }, [])

  // ---- Server poll (sees other admins' pulls) ---------------------------

  useEffect(() => {
    if (!pollingEnabled) {
      setServerInstalls([])
      return
    }
    let cancelled = false
    async function tick() {
      try {
        const r = await listInstalls()
        if (!cancelled) setServerInstalls(r.installs)
      } catch {
        // 401/403/down → silently ignore. Don't spam the console.
      }
    }
    tick()
    const id = setInterval(tick, 3000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [pollingEnabled])

  return (
    <Ctx.Provider value={{ active, serverInstalls, start, cancel, clear, setPollingEnabled }}>
      {children}
    </Ctx.Provider>
  )
}

export function useModelInstall(): ModelInstallContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useModelInstall must be used inside <ModelInstallProvider>')
  return ctx
}
