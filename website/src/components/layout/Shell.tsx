import type { ReactNode } from 'react'

export function Shell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="grid h-full w-full grid-cols-[280px_1fr]">
      <aside className="h-full overflow-hidden border-r border-white/[0.06] bg-black/30 backdrop-blur-2xl">
        {sidebar}
      </aside>
      <main className="h-full overflow-hidden">{children}</main>
    </div>
  )
}
