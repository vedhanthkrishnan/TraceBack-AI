import { Link } from 'react-router-dom'
import { Activity, Gauge, History, ArrowUpRight } from 'lucide-react'
import type { EvidenceReference } from '../../schemas/api'
import { fmtNumber } from '../../lib/formatting'

const META: Record<string, { label: string; icon: typeof Gauge }> = {
  ROOT_CAUSE: { label: 'Sensor evidence', icon: Activity },
  SENSOR_DRIFT: { label: 'Sensor drift', icon: Activity },
  HEALTH_SCORE: { label: 'Health score', icon: Gauge },
  HISTORICAL_MATCH: { label: 'Historical match', icon: History },
}

/** Builds the in-app destination for a backend evidence reference. Only fields the backend returned are used. */
export function evidenceHref(ref: EvidenceReference, machineId: string | null | undefined): string | null {
  if (!machineId) return null
  const base = `/machines/${encodeURIComponent(machineId)}`
  const p = new URLSearchParams()
  if (ref.sensor_name) p.set('sensor', ref.sensor_name)
  if (ref.evidence_type === 'HEALTH_SCORE' && ref.cycle != null) p.set('cycle', String(ref.cycle))
  const hash = ref.evidence_type === 'HISTORICAL_MATCH' ? '#matches' : ref.sensor_name ? '#evidence' : '#health'
  const qs = p.toString()
  return `${base}${qs ? `?${qs}` : ''}${hash}`
}

export function EvidenceCitation({ evidence, machineId }: { evidence: EvidenceReference; machineId?: string | null }) {
  const meta = META[evidence.evidence_type] ?? { label: evidence.evidence_type, icon: Activity }
  const Icon = meta.icon
  const href = evidenceHref(evidence, machineId)
  const title = evidence.sensor_name ? `View ${evidence.sensor_name} evidence` : evidence.evidence_type === 'HEALTH_SCORE' ? `View health at cycle ${evidence.cycle ?? 'latest'}` : `View ${meta.label.toLowerCase()}`
  const inner = (
    <>
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-2">
        <Icon className="size-3" aria-hidden /> {title}
        {href && <ArrowUpRight className="size-3 opacity-70" aria-hidden />}
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-muted">{evidence.detail}</span>
      <span className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-faint">
        {machineId && <span>Machine {machineId}</span>}
        {evidence.sensor_name && <span>Sensor {evidence.sensor_name}</span>}
        {evidence.cycle != null && <span>Cycle {evidence.cycle}</span>}
        {evidence.metric_value != null && <span className="tabular">Value {fmtNumber(evidence.metric_value, 2)}</span>}
      </span>
    </>
  )
  const cls = 'block rounded-md border border-line bg-bg/60 px-2.5 py-2 text-left transition-colors'
  return href ? (
    <Link to={href} data-testid="evidence-citation" className={`${cls} hover:border-accent-2 hover:bg-elevated`}>{inner}</Link>
  ) : (
    <div data-testid="evidence-citation" className={cls}>{inner}</div>
  )
}
