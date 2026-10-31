import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GitCompareArrows, SearchX } from 'lucide-react'
import type { HistoricalMatch } from '../../schemas/api'
import { useComparison } from '../../hooks/queries'
import { fmtPercent, fmtNumber, humanizeToken } from '../../lib/formatting'
import { Button, EmptyState, ErrorState, Pill, ProgressBar, RiskBadge, Skeleton, Term } from '../ui/primitives'

function ComparisonPanel({ machineId, otherId, onClose }: { machineId: string; otherId: string; onClose: () => void }) {
  const q = useComparison([machineId, otherId])
  return (
    <div className="mt-3 rounded-lg border border-line bg-bg/60 p-3" role="region" aria-label={`Comparison of ${machineId} and ${otherId}`}>
      {q.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : q.isError ? (
        <ErrorState compact error={q.error} onRetry={() => q.refetch()} context="Comparison" />
      ) : q.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {q.data.comparison.map((p) => (
              <div key={p.machine_id} className="rounded-md border border-line bg-surface p-2.5">
                <div className="flex items-center justify-between">
                  <Link to={`/machines/${encodeURIComponent(p.machine_id)}`} className="text-sm font-semibold hover:text-accent-2">{p.machine_id}</Link>
                  <RiskBadge category={p.risk_category} size="sm" />
                </div>
                <dl className="mt-1.5 grid grid-cols-2 gap-1 text-xs">
                  <dt className="text-faint">Cycle</dt><dd className="tabular text-right">{p.current_cycle}</dd>
                  <dt className="text-faint">Risk score</dt><dd className="tabular text-right">{fmtNumber(p.risk_score, 1)}</dd>
                  <dt className="text-faint">First anomaly</dt><dd className="tabular text-right">{p.first_sustained_anomaly_cycle ?? '—'}</dd>
                  <dt className="text-faint">Top sensors</dt><dd className="text-right">{p.top_abnormal_sensors.join(', ') || '—'}</dd>
                </dl>
              </div>
            ))}
          </div>
          <div className="mt-2.5 space-y-1 text-xs">
            <p><span className="text-faint">Shared abnormal sensors: </span><span className="font-medium text-accent-2">{q.data.shared_anomalies.join(', ') || 'none'}</span></p>
            <p><span className="text-faint">Divergent sensors: </span><span className="font-medium">{q.data.divergent_sensors.join(', ') || 'none'}</span></p>
            <p className="text-muted">{q.data.comparative_summary}</p>
          </div>
        </>
      ) : null}
      <div className="mt-2"><Button size="sm" variant="ghost" onClick={onClose}>Close comparison</Button></div>
    </div>
  )
}

export function HistoricalMatches({ machineId, matches, message, sustained }: { machineId: string; matches: HistoricalMatch[]; message?: string; sustained?: string[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (matches.length === 0)
    return (
      <EmptyState
        icon={<SearchX className="size-8" aria-hidden />}
        title="No sufficiently similar historical pattern"
        message={<>TraceBack could not find a historical run-to-failure machine whose abnormal-sensor set resembles this one{sustained?.length ? <> (current sustained sensors: {sustained.join(', ')})</> : ''}. {message}</>}
      />
    )
  return (
    <ul className="space-y-2.5 px-4 pb-4">
      {matches.map((m) => (
        <li key={m.matched_machine_id} className="rounded-lg border border-line bg-bg/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Link to={`/machines/${encodeURIComponent(m.matched_machine_id)}`} className="text-sm font-semibold hover:text-accent-2">{m.matched_machine_id}</Link>
              <Pill tone="neutral">{humanizeToken(m.outcome)}</Pill>
              <span className="text-xs text-faint">{m.observation_window}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-28">
                <div className="mb-0.5 flex justify-between text-[11px]">
                  <Term tip="Overlap between this machine’s abnormal-sensor set and the historical machine’s (Jaccard similarity). It measures pattern resemblance, not the probability of failure.">Similarity</Term>
                  <span className="tabular font-semibold">{fmtPercent(m.similarity_score)}</span>
                </div>
                <ProgressBar value={m.similarity_score} max={1} label={`Similarity with ${m.matched_machine_id}`} />
              </div>
              <Button size="sm" aria-expanded={open === m.matched_machine_id} onClick={() => setOpen(open === m.matched_machine_id ? null : m.matched_machine_id)}>
                <GitCompareArrows className="size-3.5" aria-hidden /> Compare
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">{m.similarity_interpretation}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-faint">Shared abnormal sensors:</span>
            {m.shared_sensor_evidence.map((s) => <span key={s} className="rounded bg-accent/12 px-1.5 py-0.5 font-medium text-accent-2">{s}</span>)}
            <span className="ml-auto text-faint">{m.historical_total_cycles} cycles in history</span>
          </p>
          {open === m.matched_machine_id && <ComparisonPanel machineId={machineId} otherId={m.matched_machine_id} onClose={() => setOpen(null)} />}
        </li>
      ))}
    </ul>
  )
}
