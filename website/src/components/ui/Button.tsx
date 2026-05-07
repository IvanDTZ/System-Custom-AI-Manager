import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children?: ReactNode
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-11 px-5 text-[15px] rounded-xl',
}

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-white to-zinc-300 text-black shadow-[0_8px_30px_-12px_rgba(255,255,255,0.4)] hover:from-white hover:to-zinc-200 active:from-zinc-200 active:to-zinc-400 disabled:opacity-50',
  secondary:
    'bg-white/[0.05] border border-white/10 text-white hover:bg-white/[0.09] hover:border-white/20 disabled:opacity-50',
  ghost:
    'bg-transparent text-white/85 hover:bg-white/[0.06] disabled:opacity-50',
  danger:
    'bg-red-500/15 border border-red-400/30 text-red-200 hover:bg-red-500/25 disabled:opacity-50',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {loading && (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current/40 border-t-current" />
      )}
      {children}
    </button>
  )
}
