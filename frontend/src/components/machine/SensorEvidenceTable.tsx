import { Fragment } from 'react'
import { ChevronDown, ChevronRight, MessageSquareText } from 'lucide-react'
import type { EvidenceItem, SensorBaseline, SensorDrift } from '../../schemas/api'
import { fmtNumber, fmtReading, fmtSigned } from '../../lib/formatting'
import { cn } from '../../lib/cn'
import { Button, EmptyState, Term } from '../ui/primitives'

export function SensorEvidenceTable({
  items,
  drifts,
  baselines,
  selected,
  onSelect,
  onAsk,
  methodology,
}: {
  items: EvidenceItem[]
  drifts: SensorDrift[]
  baselines: SensorBaseline[]
  selected?: string | null
  onSelect: (sensor: string | null) => void
  onAsk: (sensor: string) => void
  methodology?: string
}) {
  if (items.length === 0)
    return <EmptyState title="No abnormal sensors ranked" message="No sensor currently shows sustained deviation from its healthy baseline, so there is no root-cause evidence to rank." />

  return (
    <div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">Likely contributing signals ranked by contribution score</caption>
          <thead>
            <tr className="border-y border-line bg-sidebar/60 text-[11px] font-medium uppercase tracking-wider text-muted">
              <th scope="col" className="w-10 px-3 py-2 text-left">#</th>
              <th scope="col" className="px-3 py-2 text-left">Sensor</th>
              <th scope="col" className="px-3 py-2 text-right">Reading</th>
              <th scope="col" className="px-3 py-2 text-right">Baseline</th>
              <th scope="col" className="px-3 py-2 text-right"><Term tip="Smoothed distance of the reading from the machine’s own healthy baseline, in standard deviations (σ).">Deviation</Term></th>
              <th scope="col" className="px-3 py-2 text-right"><Term tip="Average change in the smoothed deviation per operating cycle over the rolling drift window.">Drift/cycle</Term></th>
              <th scope="col" className="px-3 py-2 text-right"><Term tip="First cycle at which this sensor stayed beyond the anomaly threshold for several consecutive cycles.">Onset</Term></th>
              <th scope="col" className="px-3 py-2 text-right"><Term tip="Number of recent consecutive cycles the sensor has stayed abnormal.">Persist.</Term></th>
              <th scope="col" className="px-3 py-2 text-right"><Term tip="Backend ranking score blending deviation, drift rate, persistence and onset order. It orders signals for inspection; it is not a probability.">Contribution</Term></th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => {
              const open = selected === e.sensor_name
              const drift = drifts.find((d) => d.sensor_name === e.sensor_name)
              const base = baselines.find((b) => b.sensor_name === e.sensor_name)
              const maxScore = Math.max(...items.map((i) => i.contribution_score), 0.0001)
              return (
                <Fragment key={e.sensor_name}>
                  <tr className={cn('border-b border-line/60 transition-colors', open ? 'bg-accent/8' : 'hover:bg-elevated/60')}>
                    <td className="tabular px-3 py-2 text-muted">{e.rank}</td>
                    <th scope="row" className="px-3 py-2 text-left">
                      <button type="button" aria-expanded={open} aria-controls={`ev-${e.sensor_name}`} onClick={() => onSelect(open ? null : e.sensor_name)} className="inline-flex items-center gap-1.5 font-semibold hover:text-accent-2">
                        {open ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
                        {e.sensor_name}
                      </button>
                    </th>
                    <td className="tabular px-3 py-2 text-right">{fmtReading(e.raw_reading)}</td>
                    <td className="tabular px-3 py-2 text-right text-muted">{fmtReading(e.baseline_mean)}</td>
                    <td className="tabular px-3 py-2 text-right font-medium">{fmtNumber(e.deviation_magnitude, 2)} σ</td>
                    <td className="tabular px-3 py-2 text-right">{fmtSigned(e.drift_rate, 4)}</td>
                    <td className="tabular px-3 py-2 text-right">{e.first_sustained_anomaly_cycle ?? '—'}</td>
                    <td className="tabular px-3 py-2 text-right">{e.persistence} cyc</td>
                    <td className="px-3 py-2">
                      <div className="ml-auto flex w-28 items-center justify-end gap-2">
                        <span className="tabular text-sm font-medium">{fmtNumber(e.contribution_score, 2)}</span>
                        <span aria-hidden className="h-1.5 w-10 overflow-hidden rounded-full bg-elevated"><span className="block h-full rounded-full bg-accent" style={{ width: `${(e.contribution_score / maxScore) * 100}%` }} /></span>
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr id={`ev-${e.sensor_name}`} className="border-b border-line bg-accent/5">
                      <td />
                      <td colSpan={8} className="px-3 py-3">
                        <p className="text-sm text-ink">{e.evidence_explanation}</p>
                        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
                          {drift && (
                            <>
                              <div><dt className="text-faint">Current z-score</dt><dd className="tabular font-medium">{fmtSigned(drift.current_z_score, 2)} σ</dd></div>
                              <div><dt className="text-faint">Smoothed z-score</dt><dd className="tabular font-medium">{fmtSigned(drift.smoothed_z_score, 2)} σ</dd></div>
                              <div><dt className="text-faint">Sustained</dt><dd className="font-medium">{drift.is_sustained ? 'Yes' : 'No'}</dd></div>
                              <div><dt className="text-faint">Threshold crossed</dt><dd className="font-medium">{drift.threshold_crossed ? 'Yes' : 'No'}</dd></div>
                            </>
                          )}
                          <div><dt className="text-faint">Baseline mean ± σ</dt><dd className="tabular font-medium">{fmtReading(e.baseline_mean)} ± {fmtReading(e.baseline_std)}</dd></div>
                          {base && <div><dt className="text-faint">Baseline window</dt><dd className="tabular font-medium">cycles {base.window_start_cycle}–{base.window_end_cycle} (n={base.sample_count})</dd></div>}
                          {base && <div><dt className="text-faint">Baseline method</dt><dd className="font-medium">{base.baseline_method}</dd></div>}
                        </dl>
                        <div className="mt-3">
                          <Button size="sm" onClick={() => onAsk(e.sensor_name)}>
                            <MessageSquareText className="size-3.5 text-accent-2" aria-hidden /> Ask Copilot why {e.sensor_name} matters
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {methodology && <p className="border-t border-line px-4 py-2.5 text-[11px] leading-snug text-faint">{methodology}</p>}
    </div>
  )
}
