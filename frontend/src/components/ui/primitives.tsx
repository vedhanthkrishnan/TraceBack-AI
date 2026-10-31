import { forwardRef, useId, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/cn'
import { riskStyle } from '../../lib/risk'
import { describeError } from '../../lib/errors'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-105 font-semibold',
  secondary: 'bg-elevated text-ink border border-line hover:border-line-strong hover:bg-line',
  ghost: 'text-muted hover:text-ink hover:bg-elevated',
  danger: 'bg-critical/15 text-critical-fg border border-critical/40 hover:bg-critical/25',
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }>(
  ({ variant = 'secondary', size = 'md', className, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variants[variant],
        className,
      )}
      {...rest}
    />
  ),
)
Button.displayName = 'Button'

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, actions, id }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 pb-3">
      <div className="min-w-0">
        <h2 id={id} className="font-display text-[15px] font-bold tracking-tight text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function RiskBadge({ category, size = 'md' }: { category: string; size?: 'sm' | 'md' }) {
  const s = riskStyle(category)
  const Icon = s.icon
  return (
    <span
      data-risk={category}
      className={cn('inline-flex items-center gap-1 rounded-full border font-sans font-medium normal-case leading-normal tracking-normal whitespace-nowrap [font-stretch:100%]', s.bg, s.border, s.text, size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs')}
    >
      <Icon aria-hidden className={size === 'sm' ? 'size-3' : 'size-3.5'} />
      {s.label}
    </span>
  )
}

export function Pill({ children, tone = 'neutral', title }: { children: ReactNode; tone?: 'neutral' | 'info' | 'warn' | 'ok' | 'bad'; title?: string }) {
  const tones = {
    neutral: 'border-line text-muted bg-elevated',
    info: 'border-accent/40 text-accent-2 bg-accent/10',
    warn: 'border-watch/40 text-watch-fg bg-watch/10',
    ok: 'border-healthy/40 text-healthy-fg bg-healthy/10',
    bad: 'border-critical/40 text-critical-fg bg-critical/10',
  }
  return (
    <span title={title} className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap', tones[tone])}>
      {children}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('tb-skeleton', className)} />
}

export function EmptyState({ title, message, action, icon }: { title: string; message?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center" role="status">
      <div className="text-faint">{icon ?? <Inbox className="size-8" aria-hidden />}</div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {message && <p className="max-w-md text-xs text-muted">{message}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry, context, compact }: { error: unknown; onRetry?: () => void; context?: string; compact?: boolean }) {
  const d = describeError(error)
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-2 text-center', compact ? 'px-4 py-6' : 'px-6 py-10')}>
      <AlertTriangle className="size-7 text-critical-fg" aria-hidden />
      <p className="text-sm font-medium text-ink">
        {context ? `${context}: ` : ''}
        {d.title}
      </p>
      <p className="max-w-md text-xs text-muted">{d.message}</p>
      {d.hint && <p className="max-w-md text-xs text-faint">{d.hint}</p>}
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden /> Retry
        </Button>
      )}
    </div>
  )
}

/** Accessible hover/focus tooltip for jargon. Uses aria-describedby; content is also reachable by keyboard. */
export function Term({ children, tip }: { children: ReactNode; tip: string }) {
  const id = useId()
  return (
    <span className="group relative inline-flex">
      <span tabIndex={0} aria-describedby={id} className="cursor-help border-b border-dotted border-faint">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-60 -translate-x-1/2 rounded-md border border-line-strong bg-elevated px-2.5 py-1.5 text-left text-[11px] font-normal normal-case leading-snug text-ink shadow-lg group-hover:block group-focus-within:block"
      >
        {tip}
      </span>
    </span>
  )
}

export function ProgressBar({ value, max = 100, label, tone = 'accent' }: { value: number; max?: number; label: string; tone?: 'accent' | 'critical' | 'watch' | 'healthy' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const color = { accent: 'bg-teal', critical: 'bg-coral', watch: 'bg-orange', healthy: 'bg-green' }[tone]
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
      <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}
