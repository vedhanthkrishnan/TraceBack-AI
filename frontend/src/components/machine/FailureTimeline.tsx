import { Flag, Radio, ShieldCheck, TrendingDown, Waypoints } from 'lucide-react'
import type { HistoryPoint, MachineDetail, EvidenceItem } from '../../schemas/api'
import { deriveTransitions } from '../charts/HealthTrendChart'
import { riskStyle } from '../../lib/risk'
import { Pill } from '../ui/primitives'
import { EmptyState } from '../ui/primitives'
import { cn } from '../../lib/cn'

interface Ev {
  cycle: number
  title: string
  detail: string
  kind: 'observed' | 'derived' | 'predicted'
  icon: typeof Flag
  onClick?: () => void
}

/** Events come only from backend fields. Category transitions are derived from the history series and say so. */
export function FailureTimeline({
  detail,
  history,
  evidence,
  selected,
  onSelectSensor,
  onSelectCycle,
}: {
  detail: MachineDetail
  history: HistoryPoint[]
  evidence: EvidenceItem[]
  selected?: string | null
  onSelectSensor: (s: string) => void
  onSelectCycle: (c: number) => void
}) {
  const events: Ev[] = []
  const bw = detail.baseline_window
  events.push({ cycle: 1, title: 'Baseline observation window', detail: `Cycles 1–${bw} define the machine’s healthy reference.`, kind: 'observed', icon: ShieldCheck })
  if (detail.first_sustained_anomaly_cycle)
    events.push({ cycle: detail.first_sustained_anomaly_cycle, title: 'First sustained anomaly', detail: 'Sensors began to stay outside their healthy range.', kind: 'observed', icon: Flag, onClick: () => onSelectCycle(detail.first_sustained_anomaly_cycle!) })
  for (const e of evidence) {
    if (e.first_sustained_anomaly_cycle)
      events.push({ cycle: e.first_sustained_anomaly_cycle, title: `${e.sensor_name} sustained deviation`, detail: `${e.deviation_magnitude.toFixed(2)} σ from baseline at latest cycle.`, kind: 'observed', icon: Radio, onClick: () => onSelectSensor(e.sensor_name) })
  }
  for (const t of deriveTransitions(history)) {
    if (t.from === 'INSUFFICIENT_DATA') continue
    events.push({ cycle: t.cycle, title: `${riskStyle(t.from).label} → ${riskStyle(t.to).label}`, detail: 'Risk-category transition (derived from the health history).', kind: 'derived', icon: TrendingDown, onClick: () => onSelectCycle(t.cycle) })
  }
  events.push({ cycle: detail.current_cycle, title: 'Latest observation', detail: `Risk ${detail.risk_score.toFixed(1)}/100 — ${riskStyle(detail.risk_category).label}.`, kind: 'observed', icon: Waypoints, onClick: () => onSelectCycle(detail.current_cycle) })
  if (detail.estimated_rul && detail.estimated_rul > 0)
    events.push({ cycle: detail.current_cycle + Math.round(detail.estimated_rul), title: 'Model-estimated end of life', detail: 'Regression estimate; not validated and not an observed event.', kind: 'predicted', icon: Flag })

  events.sort((a, b) => a.cycle - b.cycle)
  if (events.length < 2) return <EmptyState title="No timeline events" message="The backend supplied no events for this machine." />

  return (
    <ol className="relative space-y-0 px-4 pb-4" aria-label="Failure timeline">
      {events.map((e, i) => {
        const Icon = e.icon
        const sel = e.title.startsWith(`${selected} `)
        const body = (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular text-xs font-semibold text-accent-2">Cycle {e.cycle}</span>
              <span className="text-sm font-medium">{e.title}</span>
              <Pill tone={e.kind === 'observed' ? 'neutral' : e.kind === 'derived' ? 'info' : 'warn'}>{e.kind === 'observed' ? 'Observed' : e.kind === 'derived' ? 'Derived from history' : 'Predicted'}</Pill>
            </div>
            <p className="mt-0.5 text-xs text-muted">{e.detail}</p>
          </>
        )
        return (
          <li key={`${e.cycle}-${e.title}-${i}`} className="relative flex gap-3 pb-3 last:pb-0">
            {i < events.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 bottom-0 w-px bg-line" />}
            <span aria-hidden className={cn('z-[1] mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-surface', e.kind === 'predicted' ? 'border-dashed border-watch text-watch-fg' : 'border-line-strong text-muted', sel && 'border-accent-2 text-accent-2')}>
              <Icon className="size-3.5" />
            </span>
            {e.onClick ? (
              <button type="button" onClick={e.onClick} className="min-w-0 flex-1 rounded-md px-2 py-1 text-left hover:bg-elevated">{body}</button>
            ) : (
              <div className="min-w-0 flex-1 px-2 py-1">{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
