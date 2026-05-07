import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<Tone, string> = {
  neutral: 'bg-white/[0.06] text-white/80 border-white/10',
  success: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
  warning: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  danger: 'bg-red-500/15 text-red-200 border-red-400/30',
  info: 'bg-violet-500/15 text-violet-200 border-violet-400/30',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
