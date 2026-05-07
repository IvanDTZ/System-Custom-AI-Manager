import { useEffect, useMemo, useState, useRef } from 'react'
import type { AIModel } from '../../types'
import { listModels } from '../../api/chat'
import { cn } from '../../utils/cn'

export function ModelPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (modelName: string) => void
}) {
  const [models, setModels] = useState<AIModel[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    listModels().then(({ models }) => setModels(models)).catch(() => setModels([]))
  }, [])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const grouped = useMemo(() => {
    const byCat = new Map<string, AIModel[]>()
    for (const m of models) {
      const key = m.category?.name ?? 'General'
      if (!byCat.has(key)) byCat.set(key, [])
      byCat.get(key)!.push(m)
    }
    return Array.from(byCat.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [models])

  const current = models.find(m => m.ollama_name === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white/90 transition-colors',
          'hover:bg-white/[0.07] hover:border-white/20',
        )}
      >
        <span className="size-1.5 rounded-full bg-emerald-400/80" />
        <span className="font-medium">{current?.display_name ?? value ?? 'Select a model'}</span>
        <svg viewBox="0 0 24 24" className="size-4 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-[#111114]/95 shadow-2xl backdrop-blur-2xl">
          {models.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-text-muted">
              No enabled models. Ask an admin to enable one.
            </div>
          )}
          <div className="max-h-80 overflow-auto py-1">
            {grouped.map(([category, list]) => (
              <div key={category} className="py-1">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-subtle">{category}</div>
                {list.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { onChange(m.ollama_name); setOpen(false) }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.06]',
                      m.ollama_name === value && 'bg-white/[0.05]',
                    )}
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{m.display_name}</span>
                      <span className="text-[11px] text-text-subtle">
                        {m.parameter_size} · {m.family || m.ollama_name}
                      </span>
                    </span>
                    {m.ollama_name === value && (
                      <svg viewBox="0 0 24 24" className="size-4 text-violet-300" fill="none" stroke="currentColor" strokeWidth="2.4">
                        <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
