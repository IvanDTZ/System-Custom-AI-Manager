import type { SelectHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export function Select({ className, label, children, ...rest }: SelectProps) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</span>}
      <select
        {...rest}
        className={cn(
          'h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.03] px-3.5 pr-9 text-[15px] text-white',
          'transition-colors duration-150 focus:border-white/30 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-white/20',
          'bg-no-repeat bg-[length:14px_14px] bg-[position:right_12px_center]',
          // Inline chevron via background
          "[background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")]",
          className,
        )}
      >
        {children}
      </select>
    </label>
  )
}
