import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { cn } from '../../lib/cn'
import { isMockMode } from '../../lib/config'
import { ErrorBoundary } from '../ui/ErrorBoundary'

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDrawer(false)
    main.current?.focus({ preventScroll: true })
  }, [pathname])

  // Drawer: close on Escape and keep keyboard focus inside while open.
  useEffect(() => {
    if (!drawer) return
    const el = drawerRef.current
    el?.querySelector<HTMLElement>('a,button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false)
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')]
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawer])

  return (
    <div className="flex h-full bg-bg text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent">
        Skip to content
      </a>
      <aside className={cn('hidden shrink-0 border-r border-line transition-[width] duration-200 lg:block', collapsed ? 'w-[60px]' : 'w-60')}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} aria-hidden />
          <div ref={drawerRef} className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line shadow-2xl">
            <Sidebar collapsed={false} mobile onToggle={() => {}} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenNav={() => setDrawer(true)} />
        {isMockMode && (
          <div role="note" className="flex items-center gap-2 border-b border-watch/30 bg-watch/10 px-4 py-1.5 text-xs text-watch-fg">
            <FlaskConical className="size-3.5 shrink-0" aria-hidden />
            <span>
              <strong>Mock mode.</strong> All data comes from synthetic demo fixtures — not real observations and not the live backend. Set VITE_DATA_MODE=live to connect.
            </span>
          </div>
        )}
        <main id="main" ref={main} tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto outline-none">
          <ErrorBoundary resetKey={pathname}>
            <div key={pathname} className="tb-rise"><Outlet /></div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
