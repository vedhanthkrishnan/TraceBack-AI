import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SensorBaseline, SensorDrift } from '../../schemas/api'
import { EmptyState } from '../ui/primitives'
import { Button } from '../ui/primitives'
import { fmtSigned } from '../../lib/formatting'
import { P } from '../../lib/palette'

const DEFAULT_VISIBLE = 8

export function SensorDeviationChart({
  drifts,
  baselines,
  selected,
  onSelect,
  cycle,
}: {
  drifts: SensorDrift[]
  baselines: SensorBaseline[]
  selected?: string | null
  onSelect: (sensor: string) => void
  cycle: number
}) {
  const [showAll, setShowAll] = useState(false)
  const ranked = useMemo(() => [...drifts].sort((a, b) => Number(b.threshold_crossed) - Number(a.threshold_crossed) || b.anomaly_score - a.anomaly_score), [drifts])
  const invalid = baselines.filter((b) => !b.is_valid).map((b) => b.sensor_name)
  const visible = useMemo(() => {
    const base = showAll ? ranked : ranked.slice(0, DEFAULT_VISIBLE)
    // A sensor selected from elsewhere (evidence table, Copilot link) must always be visible.
    const sel = selected ? ranked.find((d) => d.sensor_name === selected) : undefined
    return sel && !base.includes(sel) ? [...base, sel] : base
  }, [ranked, showAll, selected])

  if (drifts.length === 0)
    return <EmptyState title="No sensor deviation data" message="The backend returned no drift metrics for this machine — it may still be inside its baseline window." />

  const crossed = ranked.filter((d) => d.threshold_crossed).length
  const summary = `Standardised deviation (z-score) of ${visible.length} sensors at cycle ${cycle}. ${crossed} sensor${crossed === 1 ? ' has' : 's have'} crossed the anomaly threshold: ${ranked.filter((d) => d.threshold_crossed).map((d) => `${d.sensor_name} (${fmtSigned(d.current_z_score, 1)}σ)`).join(', ') || 'none'}.`
  const max = Math.max(3, ...visible.map((d) => Math.abs(d.current_z_score)))
  const bound = Math.ceil(max + 0.5)

  return (
    <figure className="m-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[11px] text-faint">
          Snapshot at cycle {cycle} · deviation from baseline (σ)
        </p>
        {ranked.length > DEFAULT_VISIBLE && (
          <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)} aria-pressed={showAll}>
            {showAll ? 'Show top sensors' : `Show all ${ranked.length} sensors`}
          </Button>
        )}
      </div>
      <div style={{ height: Math.max(180, visible.length * 30 + 40) }} role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={visible} layout="vertical" margin={{ top: 4, right: 20, bottom: 18, left: 4 }} barCategoryGap={5}>
            <CartesianGrid stroke={P.line} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[-bound, bound]} tick={{ fill: P.muted, fontSize: 11 }} stroke={P.lineStrong} tickFormatter={(v) => `${v}σ`} label={{ value: 'Deviation from healthy baseline (σ)', position: 'insideBottom', offset: -10, fill: P.faint, fontSize: 11 }} />
            <YAxis type="category" dataKey="sensor_name" width={44} tick={{ fill: P.ink, fontSize: 12 }} axisLine={false} tickLine={false} />
            <ReferenceLine x={0} stroke={P.faint} />
            <Tooltip
              cursor={{ fill: 'rgba(148,163,184,0.08)' }}
              contentStyle={{ background: P.elevated, border: `1px solid ${P.lineStrong}`, borderRadius: 8, fontSize: 12 }}
              formatter={(v) => [`${fmtSigned(Number(v), 2)} σ`, 'Current deviation']}
              labelFormatter={(l, p) => {
                const d = p?.[0]?.payload as SensorDrift | undefined
                return `${l}${d?.threshold_crossed ? ' · crossed anomaly threshold' : ' · within normal range'}${d?.is_sustained ? ' · sustained' : ''}`
              }}
            />
            <Bar dataKey="current_z_score" radius={3} cursor="pointer" onClick={(d) => onSelect((d as unknown as SensorDrift).sensor_name)} isAnimationActive={false}>
              {visible.map((d) => (
                <Cell key={d.sensor_name} fill={d.threshold_crossed ? P.coral : P.idleBar} stroke={d.sensor_name === selected ? P.ink : 'none'} strokeWidth={d.sensor_name === selected ? 2.5 : 0} fillOpacity={selected && d.sensor_name !== selected ? 0.55 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-critical" /> Crossed anomaly threshold (flagged by backend)</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-idle" /> Within normal range</span>
        {invalid.length > 0 && <span className="text-faint">Not shown: {invalid.join(', ')} — constant during the baseline window, so no valid baseline.</span>}
      </figcaption>
      <p className="sr-only">{summary}</p>
    </figure>
  )
}
