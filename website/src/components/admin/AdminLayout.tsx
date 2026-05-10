import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Shell, SidebarTrigger } from '../layout/Shell'
import { UserMenu } from '../layout/UserMenu'
import { cn } from '../../utils/cn'
import { SidebarProvider } from '../../contexts/SidebarContext'
import { useModelInstall } from '../../contexts/ModelInstallContext'
import { InstallStatusBar } from './InstallStatusBar'

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: (
    <path d="M3 13h8V3H3v10ZM13 21h8V11h-8v10ZM3 21h8v-6H3v6ZM13 9h8V3h-8v6Z" />
  )},
  { to: '/admin/users', label: 'Users', icon: (
    <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM2 21a8 8 0 0 1 16 0H2Z" />
  )},
  { to: '/admin/models', label: 'Models', icon: (
    <path d="M3 7l9-4 9 4-9 4-9-4Zm0 6 9 4 9-4M3 17l9 4 9-4" />
  )},
  { to: '/admin/categories', label: 'Categories', icon: (
    <path d="M4 6h16M4 12h16M4 18h10" />
  )},
  { to: '/admin/chats', label: 'Chats', icon: (
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
  )},
]

export function AdminLayout() {
  // Only poll the server for cross-admin installs while we're inside the
  // admin section. Avoids needless 403s for plain USERs and saves bandwidth.
  const install = useModelInstall()
  useEffect(() => {
    install.setPollingEnabled(true)
    return () => install.setPollingEnabled(false)
  }, [install])

  return (
    <SidebarProvider>
      <Shell
        sidebar={
          <div className="flex h-full flex-col">
            <NavLink to="/admin" className="flex items-center gap-2 px-5 py-4 text-[15px] font-semibold tracking-tight">
              <img src="/Logo.png" alt="AI Manager" className="size-11 rounded-xl object-contain" />
              Admin · AI Manager
            </NavLink>
            <NavLink to="/chat" className="mx-3 mb-3 flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-white/80 hover:bg-white/[0.07]">
              ← Back to chat
            </NavLink>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
              {NAV.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive ? 'bg-white/[0.08] text-white' : 'text-text-muted hover:bg-white/[0.05] hover:text-white',
                  )}
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {item.icon}
                  </svg>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <UserMenu />
          </div>
        }
      >
        <div className="flex h-full flex-col">
          {/* Mobile-only topbar with hamburger */}
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2 backdrop-blur-2xl md:hidden">
            <SidebarTrigger />
            <img src="/Logo.png" alt="" className="size-7 rounded-md object-contain" />
            <span className="text-sm font-medium">Admin</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-7">
            <InstallStatusBar />
            <Outlet />
          </div>
        </div>
      </Shell>
    </SidebarProvider>
  )
}
