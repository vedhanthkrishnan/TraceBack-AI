import { NavLink, useLocation } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, Gauge, Layers, MessageSquareText, Microscope, Settings, Timer, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useSelectedMachine } from '../../hooks/useSelectedMachine'

const Logo = () => (
  <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
    <rect width="32" height="32" rx="8" fill="#8A1820" />
    <path d="M5 21l6-8 5 5 6-10 5 7" fill="none" stroke="#FEC097" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function Sidebar({ collapsed, onToggle, onNavigate, mobile }: { collapsed: boolean; onToggle: () => void; onNavigate?: () => void; mobile?: boolean }) {
  const [selected] = useSelectedMachine()
  const { pathname } = useLocation()
  const items = [
    { to: '/', label: 'Fleet Overview', icon: Gauge, end: true },
    { to: selected ? `/machines/${encodeURIComponent(selected)}` : '/machines', label: 'Machine Investigation', icon: Microscope, match: '/machines' },
    { to: '/patterns', label: 'Failure Patterns', icon: Layers },
    { to: '/copilot', label: 'AI Copilot', icon: MessageSquareText },
    { to: '/benchmarks', label: 'Benchmarks', icon: Timer },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]
  const isCollapsed = collapsed && !mobile
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className={cn('flex h-14 items-center gap-2.5 border-b border-line px-3.5', isCollapsed && 'justify-center px-0')}>
        <Logo />
        {!isCollapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <div className="display truncate text-xl text-ink">TraceBack<span className="text-accent-2"> AI</span></div>
          </div>
        )}
        {mobile && (
          <button aria-label="Close navigation" onClick={onNavigate} className="rounded-md p-1.5 text-muted hover:bg-elevated hover:text-ink">
            <X className="size-4" />
          </button>
        )}
      </div>
      <nav aria-label="Primary" className="flex-1 space-y-0.5 p-2">
        {items.map(({ to, label, icon: Icon, end, match }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            onClick={onNavigate}
            title={isCollapsed ? label : undefined}
            className={({ isActive }) => {
              const active = match ? pathname.startsWith(match) : isActive
              return cn(
                'group relative flex items-center gap-3 rounded-full px-3 py-2 text-[13px] font-medium transition-colors',
                isCollapsed && 'justify-center px-0',
                active ? 'bg-accent text-on-accent' : 'text-muted hover:bg-elevated hover:text-ink',
              )
            }}
          >
            {({ isActive }) => {
              const active = match ? pathname.startsWith(match) : isActive
              return (
                <>
                  <Icon className={cn('size-[18px] shrink-0', active ? 'text-on-accent' : 'text-faint group-hover:text-muted')} aria-hidden />
                  {!isCollapsed && <span className="truncate">{label}</span>}
                  {active && <span className="sr-only">(current page)</span>}
                </>
              )
            }}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line p-2">
        {!mobile && (
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            className="flex w-full items-center justify-center rounded-md p-2 text-faint hover:bg-elevated hover:text-ink"
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        )}
      </div>
    </div>
  )
}
