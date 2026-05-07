import { type ReactNode, useEffect } from 'react'
import { cn } from '../../utils/cn'

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  footer,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  className?: string
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          'relative w-full max-w-md rounded-2xl border border-white/10 bg-[#111114]/90 p-5 shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-150',
          className,
        )}
        role="dialog"
        aria-modal
      >
        {title && (
          <div className="mb-4 text-base font-semibold tracking-tight">{title}</div>
        )}
        <div>{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
