import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, hint, id, ...rest },
  ref,
) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</span>}
      <input
        ref={ref}
        id={id}
        className={cn(
          'h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-[15px] text-white placeholder:text-text-subtle',
          'transition-colors duration-150 focus:border-white/30 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-white/20',
          error && 'border-red-400/40 focus:border-red-400/60 focus:ring-red-400/30',
          className,
        )}
        {...rest}
      />
      {error ? (
        <span className="text-xs text-red-300">{error}</span>
      ) : hint ? (
        <span className="text-xs text-text-subtle">{hint}</span>
      ) : null}
    </label>
  )
})
