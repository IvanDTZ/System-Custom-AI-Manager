import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
  hint?: string
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, label, error, hint, id, ...rest },
  ref,
) {
  const [shown, setShown] = useState(false)
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</span>}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={shown ? 'text' : 'password'}
          className={cn(
            'h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 pr-11 text-[15px] text-white placeholder:text-text-subtle',
            'transition-colors duration-150 focus:border-white/30 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-white/20',
            error && 'border-red-400/40 focus:border-red-400/60 focus:ring-red-400/30',
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShown(s => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-white transition-colors hover:bg-white/10"
        >
          {shown ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" x2="22" y1="2" y2="22" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {error ? (
        <span className="text-xs text-red-300">{error}</span>
      ) : hint ? (
        <span className="text-xs text-text-subtle">{hint}</span>
      ) : null}
    </label>
  )
})
