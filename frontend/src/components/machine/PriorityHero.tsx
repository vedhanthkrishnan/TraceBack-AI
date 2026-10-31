import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, MessageSquareText } from 'lucide-react'
import { RiskBadge } from '../ui/primitives'
import { useFleetList } from '../../hooks/queries'
import { useSelectedMachine } from '../../hooks/useSelectedMachine'
import { fmtNumber } from '../../lib/formatting'
import type { FleetQuery } from '../../services/api'

/** Fixed query (independent of the table's filters/sort) so the hero always shows the top risk score. */
const TOP_RISK: FleetQuery = { page: 1, pageSize: 1, sortBy: 'risk_score', sortOrder: 'desc' }

/**
 * "Next race"-style callout (landonorris.com idea): the machine with the highest current risk score.
 * Honest framing: this is a ranking by statistical drift score, not a prediction of which machine fails next.
 * Renders nothing while loading, on error, or with an empty fleet (the table below owns those states).
 */
export function PriorityHero() {
  const q = useFleetList(TOP_RISK)
  const [, setSelected] = useSelectedMachine()
  const nav = useNavigate()
  const top = q.data?.items[0]
  if (!top) return null

  const open = (path: string) => {
    setSelected(top.machine_id)
    nav(path)
  }
  const id = encodeURIComponent(top.machine_id)

  return (
    <section aria-label="Highest risk machine" className="tb-rise mb-6 grid gap-3 md:grid-cols-3">
      <button
        type="button"
        onClick={() => open(`/machines/${id}`)}
        className="tb-lift group relative flex flex-col justify-between gap-6 overflow-hidden rounded-3xl border border-line bg-surface p-5 text-left md:col-span-2 sm:p-7"
      >
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-peach/60 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="micro">highest risk</span>
          <RiskBadge category={top.risk_category} size="sm" />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="display display-xl break-all text-ink">{top.machine_id}</div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
              <div><dt className="micro inline">health </dt><dd className="tabular inline font-semibold text-ink">{fmtNumber(top.health_score, 1)}</dd></div>
              <div><dt className="micro inline">cycle </dt><dd className="tabular inline font-semibold text-ink">{top.cycle}</dd></div>
              <div><dt className="micro inline">flagged sensors </dt><dd className="tabular inline font-semibold text-ink">{top.contributing_sensor_count}</dd></div>
              <div><dt className="micro inline">first anomaly </dt><dd className="tabular inline font-semibold text-ink">{top.first_sustained_anomaly_cycle ?? '—'}</dd></div>
            </dl>
          </div>
          <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent transition-transform group-hover:translate-x-0.5">
            Investigate <ArrowUpRight className="size-4" aria-hidden />
          </span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => open(`/copilot?machine=${id}`)}
        className="tb-lift relative flex flex-col justify-between gap-6 overflow-hidden rounded-3xl border border-wine bg-wine p-5 text-left text-white sm:p-7"
      >
        <span aria-hidden className="pointer-events-none absolute -bottom-16 -right-12 size-56 rounded-full bg-peach/30 blur-2xl" />
        <div>
          <MessageSquareText className="relative mb-3 size-6 text-peach" aria-hidden />
          <div className="display display-lg relative">Ask the copilot</div>
        </div>
      </button>
    </section>
  )
}
