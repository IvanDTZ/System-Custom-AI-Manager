import type { ReactNode } from 'react'
import { useSidebar } from '../../contexts/SidebarContext'
import { cn } from '../../utils/cn'

export function Shell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const { isOpen, close } = useSidebar()
  return (
    <div className="grid h-full w-full md:grid-cols-[280px_1fr]">
      {/* Desktop sidebar — fixed slot in the grid */}
      <aside className="hidden h-full overflow-hidden border-r border-white/[0.06] bg-black/30 backdrop-blur-2xl md:block">
        {sidebar}
      </aside>

      {/* Mobile drawer + backdrop. The drawer is always in the DOM so the
          slide animation runs both ways; visibility is driven by transform
          and pointer-events. */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-200 md:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={close}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[320px] overflow-hidden border-r border-white/[0.06] bg-[#0a0a0d]/95 backdrop-blur-2xl transition-transform duration-200 ease-out md:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Sidebar"
        aria-hidden={!isOpen}
      >
        {sidebar}
      </aside>

      <main className="h-full overflow-hidden">{children}</main>
    </div>
  )
}

// Hamburger button — drop this into any topbar that lives inside <Shell>.
// Hidden on md+ where the sidebar is permanently visible.
export function SidebarTrigger({ className }: { className?: string }) {
  const { toggle } = useSidebar()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Open menu"
      className={cn(
        'grid size-9 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white md:hidden',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
        <line x1="4" x2="20" y1="6" y2="6" />
        <line x1="4" x2="20" y1="12" y2="12" />
        <line x1="4" x2="20" y1="18" y2="18" />
      </svg>
    </button>
  )
}
