import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HistoryPoint } from '../../schemas/api'
import { config } from '../../lib/config'
import { riskStyle } from '../../lib/risk'
import { EmptyState } from '../ui/primitives'
import { fmtNumber } from '../../lib/formatting'
import { P } from '../../lib/palette'

export interface Transition {
  cycle: number
  from: string
  to: string
}

/** Risk-category changes derived directly from the backend history series (no invented events). */
export function deriveTransitions(history: HistoryPoint[]): Transition[] {
  const out: Transition[] = []
  for (let i = 1; i < history.length; i++) {
    const a = history[i - 1]!
    const b = history[i]!
    if (a.risk_category !== b.risk_category) out.push({ cycle: b.cycle, from: a.risk_category, to: b.risk_category })
  }
  return out
}

export function HealthTrendChart({
  history,
  baselineWindow,
  firstAnomalyCycle,
  window: win,
  selectedCycle,
  onSelectCycle,
}: {
  history: HistoryPoint[]
  baselineWindow: number
  firstAnomalyCycle?: number | null
  window?: [number, number] | null
  selectedCycle?: number | null
  onSelectCycle?: (cycle: number) => void
}) {
  const data = useMemo(() => (win ? history.filter((p) => p.cycle >= win[0] && p.cycle <= win[1]) : history), [history, win])
  if (history.length === 0) return <EmptyState title="No health history available" message="The backend returned no cycle-level scores for this machine. Run the analytics pipeline to compute them." />

  // Thresholds are configured on the RISK score; health = 100 − risk. They are configuration, not learned values.
  const watchHealth = 100 - config.watchRiskThreshold
  const criticalHealth = 100 - config.criticalRiskThreshold
  const transitions = deriveTransitions(history).filter((t) => !win || (t.cycle >= win[0] && t.cycle <= win[1]))
  const last = history[history.length - 1]!
  const min = Math.min(...history.map((h) => h.health_score))
  const summary = `Health score by cycle for ${history.length} cycles, from ${fmtNumber(history[0]!.health_score, 0)} at cycle ${history[0]!.cycle} to ${fmtNumber(last.health_score, 1)} at cycle ${last.cycle}; lowest ${fmtNumber(min, 1)}. ${transitions.length} risk-category change${transitions.length === 1 ? '' : 's'}${firstAnomalyCycle ? `; first sustained anomaly at cycle ${firstAnomalyCycle}` : ''}.`

  return (
    <figure className="m-0">
      <div className="h-72" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: -8 }} onClick={(e) => { const c = (e as { activeLabel?: string | number } | null)?.activeLabel; if (c !== undefined && onSelectCycle) onSelectCycle(Number(c)) }}>
            <defs>
              <linearGradient id="healthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={P.wine} stopOpacity={0.28} />
                <stop offset="100%" stopColor={P.wine} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={P.line} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="cycle" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: P.muted, fontSize: 11 }} stroke={P.lineStrong} label={{ value: 'Operating cycle', position: 'insideBottom', offset: -2, fill: P.faint, fontSize: 11 }} height={36} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: P.muted, fontSize: 11 }} stroke={P.lineStrong} label={{ value: 'Health score (0–100)', angle: -90, position: 'insideLeft', offset: 18, fill: P.faint, fontSize: 11, style: { textAnchor: 'middle' } }} width={52} />
            <ReferenceArea x1={Math.max(1, win?.[0] ?? 1)} x2={baselineWindow} fill={P.muted} fillOpacity={0.08} ifOverflow="hidden" label={{ value: 'Baseline window', fill: P.faint, fontSize: 10, position: 'insideTop' }} />
            <ReferenceLine y={watchHealth} stroke={P.amber} strokeDasharray="5 4" strokeOpacity={0.8} label={{ value: `Watch ≤ ${watchHealth} (configured)`, fill: P.amberText, fontSize: 10, position: 'insideBottomLeft' }} />
            <ReferenceLine y={criticalHealth} stroke={P.red} strokeDasharray="5 4" strokeOpacity={0.8} label={{ value: `Critical ≤ ${criticalHealth} (configured)`, fill: P.redText, fontSize: 10, position: 'insideBottomLeft' }} />
            {firstAnomalyCycle ? <ReferenceLine x={firstAnomalyCycle} stroke={P.ink} strokeWidth={1.5} label={{ value: 'First sustained anomaly', fill: P.ink, fontSize: 10, position: 'insideTopRight' }} /> : null}
            {selectedCycle ? <ReferenceLine x={selectedCycle} stroke={P.ink} strokeOpacity={0.5} strokeDasharray="2 3" /> : null}
            <Tooltip
              contentStyle={{ background: P.elevated, border: `1px solid ${P.lineStrong}`, borderRadius: 8, fontSize: 12 }}
              labelFormatter={(c) => `Cycle ${c}`}
              formatter={(v, _n, item) => [`${fmtNumber(Number(v), 2)} · ${riskStyle((item.payload as HistoryPoint).risk_category).label}`, 'Health score']}
            />
            <Area type="monotone" dataKey="health_score" stroke="none" fill="url(#healthFill)" isAnimationActive={false} />
            <Line type="monotone" dataKey="health_score" stroke={P.wine} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: P.peach, stroke: P.ink }} isAnimationActive={false} />
            {transitions.map((t) => {
              const pt = history.find((h) => h.cycle === t.cycle)
              return pt ? <ReferenceDot key={`${t.cycle}-${t.to}`} x={t.cycle} y={pt.health_score} r={5} fill={riskStyle(t.to).hex} stroke={P.surface} strokeWidth={2} ifOverflow="hidden" /> : null
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-faint">
        <span>Dashed lines: <strong className="text-muted">configured</strong> thresholds</span>
      </figcaption>
      <p className="sr-only">{summary}</p>
    </figure>
  )
}
