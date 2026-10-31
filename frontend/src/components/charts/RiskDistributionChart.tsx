import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FleetSummary } from '../../schemas/api'
import { riskStyle } from '../../lib/risk'
import { P } from '../../lib/palette'

export function riskDistribution(s: FleetSummary) {
  return [
    { key: 'CRITICAL', count: s.critical_count },
    { key: 'WATCH', count: s.watch_count },
    { key: 'HEALTHY', count: s.healthy_count },
    { key: 'INSUFFICIENT_DATA', count: s.insufficient_data_count },
  ].map((d) => ({ ...d, label: `${riskStyle(d.key).label} · ${d.count}`, fill: riskStyle(d.key).hex }))
}

export function RiskDistributionChart({ summary, onSelect }: { summary: FleetSummary; onSelect?: (category: string) => void }) {
  const data = riskDistribution(summary)
  const total = summary.total_machines
  const text = data.map((d) => `${d.count} ${d.label.toLowerCase()}`).join(', ')
  return (
    <figure aria-label="Fleet risk distribution" className="m-0">
      <div className="h-44" role="img" aria-label={`Bar chart of ${total} machines by risk category: ${text}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }}>
            <XAxis type="number" hide domain={[0, 'dataMax']} allowDecimals={false} />
            <YAxis type="category" dataKey="label" width={140} tick={{ fill: P.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(148,163,184,0.08)' }}
              contentStyle={{ background: P.elevated, border: `1px solid ${P.lineStrong}`, borderRadius: 8, fontSize: 12 }}
              formatter={(v) => [`${v} of ${total} machines`, 'Count']}
            />
            <Bar dataKey="count" radius={4} barSize={18} cursor={onSelect ? 'pointer' : undefined} onClick={(d) => onSelect?.((d as unknown as { key: string }).key)}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{text}</figcaption>
    </figure>
  )
}
