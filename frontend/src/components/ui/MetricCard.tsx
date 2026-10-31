import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

export function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
  hint,
  active,
  onClick,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  accent: string
  hint?: string
  active?: boolean
  onClick?: () => void
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="micro">{label}</span>
        <Icon aria-hidden className={cn('size-4', accent)} />
      </div>
      <div className="display tabular mt-2 text-4xl">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-faint">{hint}</div>}
    </>
  )
  const cls = cn('rounded-2xl border bg-surface p-4 text-left transition-colors', active ? 'border-accent bg-elevated' : 'border-line', onClick && 'tb-lift cursor-pointer hover:bg-elevated')
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}
