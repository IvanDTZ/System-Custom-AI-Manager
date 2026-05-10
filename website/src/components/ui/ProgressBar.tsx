import { cn } from '../../utils/cn'

export interface ProgressBarProps {
  // 0..1 — values outside this range are clamped.
  value?: number | null
  // When true, renders a marquee instead of a static bar.
  indeterminate?: boolean
  label?: string
  rightLabel?: string
  tone?: 'accent' | 'success' | 'danger' | 'neutral'
  size?: 'sm' | 'md'
  className?: string
}

const TONES = {
  accent: 'bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-300',
  success: 'bg-gradient-to-r from-emerald-400 to-emerald-300',
  danger: 'bg-gradient-to-r from-red-400 to-red-300',
  neutral: 'bg-gradient-to-r from-white via-zinc-200 to-white/80',
} as const

const SIZES = {
  sm: 'h-1.5',
  md: 'h-2.5',
} as const

export function ProgressBar({
  value,
  indeterminate,
  label,
  rightLabel,
  tone = 'accent',
  size = 'md',
  className,
}: ProgressBarProps) {
  const clamped = value == null ? 0 : Math.max(0, Math.min(1, value))
  const pct = Math.round(clamped * 100)
  const computedRight = rightLabel ?? (value != null && !indeterminate ? `${pct}%` : null)

  return (
    <div className={cn('w-full', className)}>
      {(label || computedRight) && (
        <div className="mb-1 flex items-center justify-between text-[11px] text-text-muted">
          {label && <span className="truncate">{label}</span>}
          {computedRight && <span className="ml-2 shrink-0 tabular-nums text-white/80">{computedRight}</span>}
        </div>
      )}
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.05]',
          SIZES[size],
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : pct}
      >
        {indeterminate ? (
          <div
            className={cn(
              'absolute inset-y-0 left-0 w-1/3 rounded-full',
              TONES[tone],
              'animate-[progress-marquee_1.4s_ease-in-out_infinite]',
            )}
          />
        ) : (
          <div
            className={cn('h-full rounded-full transition-[width] duration-300 ease-out', TONES[tone])}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  )
}
