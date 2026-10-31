import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { FleetPage } from '../../schemas/api'
import { fmtNumber, fmtTimestamp } from '../../lib/formatting'
import { Button, EmptyState, ErrorState, ProgressBar, RiskBadge, Skeleton } from '../ui/primitives'
import { riskStyle } from '../../lib/risk'
import { cn } from '../../lib/cn'
import type { FleetQuery } from '../../services/api'

type SortKey = FleetQuery['sortBy']

export function RulCell({ rul, category }: { rul: number | null | undefined; category: string }) {
  if (rul === null || rul === undefined || category === 'INSUFFICIENT_DATA') return <span className="text-faint" title="No estimate available">—</span>
  const tip = 'Regression-model output, not validated in this interface. A value of 0 is the model’s floor, not a prediction of immediate failure.'
  return (
    <span title={tip} className="cursor-help">
      {rul === 0 ? <span className="text-faint">floor (0)</span> : <>≈ {fmtNumber(rul, 0)} <span className="text-[10px] text-faint">cycles</span></>}
    </span>
  )
}

function SortHeader({ label, col, query, onSort, align = 'left' }: { label: string; col?: SortKey; query: FleetQuery; onSort: (c: SortKey) => void; align?: 'left' | 'right' }) {
  const active = col && query.sortBy === col
  const Icon = !col ? null : active ? (query.sortOrder === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <th
      scope="col"
      aria-sort={active ? (query.sortOrder === 'asc' ? 'ascending' : 'descending') : col ? 'none' : undefined}
      className={cn('px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted', align === 'right' && 'text-right')}
    >
      {col ? (
        <button type="button" onClick={() => onSort(col)} className={cn('inline-flex items-center gap-1 uppercase hover:text-ink', active && 'text-ink')}>
          {label}
          {Icon && <Icon aria-hidden className="size-3" />}
        </button>
      ) : (
        label
      )}
    </th>
  )
}

export function FleetTable({
  data,
  loading,
  error,
  fetching,
  query,
  onSort,
  onPage,
  onRetry,
  onClearFilters,
  hasFilters,
  onOpen,
}: {
  data?: FleetPage
  loading: boolean
  error: unknown
  fetching?: boolean
  query: FleetQuery
  onSort: (c: SortKey) => void
  onPage: (p: number) => void
  onRetry: () => void
  onClearFilters: () => void
  hasFilters: boolean
  onOpen: (id: string) => void
}) {
  if (error && !data) return <ErrorState error={error} onRetry={onRetry} context="Fleet table" />
  return (
    <div>
      <div className={cn('relative overflow-x-auto', fetching && !loading && 'opacity-70 transition-opacity')} aria-busy={loading || fetching}>
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <caption className="sr-only">Machines ranked by {query.sortBy.replace('_', ' ')}, {query.sortOrder === 'desc' ? 'highest' : 'lowest'} first</caption>
          <thead>
            <tr className="border-y border-line bg-sidebar/60 text-left">
              <SortHeader label="Machine" col="machine_id" query={query} onSort={onSort} />
              <SortHeader label="Health score" col="health_score" query={query} onSort={onSort} />
              <SortHeader label="Risk" col="risk_score" query={query} onSort={onSort} />
              <SortHeader label="Cycle" col="cycle" query={query} onSort={onSort} align="right" />
              <SortHeader label="Flagged sensors" query={query} onSort={onSort} align="right" />
              <SortHeader label="First anomaly" query={query} onSort={onSort} align="right" />
              <SortHeader label="RUL (unvalidated)" query={query} onSort={onSort} />
              <SortHeader label="Last analysed" query={query} onSort={onSort} />
              <th scope="col" className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-line/60">
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))}
            {!loading &&
              data?.items.map((m) => {
                const s = riskStyle(m.risk_category)
                return (
                  <tr
                    key={m.machine_id}
                    className="group cursor-pointer border-b border-line/60 transition-colors hover:bg-elevated/70"
                    onClick={() => onOpen(m.machine_id)}
                  >
                    <th scope="row" className="px-3 py-2.5 text-left font-semibold">
                      <Link to={`/machines/${encodeURIComponent(m.machine_id)}`} onClick={(e) => e.stopPropagation()} className="hover:text-accent-2">
                        {m.machine_id}
                      </Link>
                    </th>
                    <td className="px-3 py-2.5">
                      <div className="flex w-36 items-center gap-2">
                        <span className="tabular w-10 text-right font-medium">{fmtNumber(m.health_score, 1)}</span>
                        <ProgressBar value={m.health_score} label={`Health score ${m.machine_id}`} tone={m.risk_category === 'CRITICAL' ? 'critical' : m.risk_category === 'WATCH' ? 'watch' : m.risk_category === 'HEALTHY' ? 'healthy' : 'accent'} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><RiskBadge category={m.risk_category} size="sm" /><span className="sr-only"> {s.label}</span></td>
                    <td className="tabular px-3 py-2.5 text-right text-muted">{m.cycle}</td>
                    <td className="tabular px-3 py-2.5 text-right">{m.risk_category === 'INSUFFICIENT_DATA' ? <span className="text-faint">—</span> : m.contributing_sensor_count}</td>
                    <td className="tabular px-3 py-2.5 text-right">{m.first_sustained_anomaly_cycle ?? <span className="text-faint">—</span>}</td>
                    <td className="px-3 py-2.5 text-xs"><RulCell rul={m.estimated_rul} category={m.risk_category} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{fmtTimestamp(m.last_updated)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Link to={`/machines/${encodeURIComponent(m.machine_id)}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-ink hover:border-accent-2">
                        Investigate <ChevronRight className="size-3" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {!loading && data && data.items.length === 0 && (
        <EmptyState
          icon={<SearchX className="size-8" aria-hidden />}
          title="No machines match the current filters"
          message={hasFilters ? 'Try a different search term or clear the risk filter.' : 'The backend returned no machines. Seed the demo fleet and run the pipeline.'}
          action={hasFilters ? <Button size="sm" onClick={onClearFilters}>Clear filters</Button> : undefined}
        />
      )}

      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-muted">
          <span aria-live="polite">
            Showing {(data.page - 1) * data.page_size + 1}–{Math.min(data.page * data.page_size, data.total)} of {data.total} machines
          </span>
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={() => onPage(data.page - 1)} disabled={data.page <= 1} aria-label="Previous page"><ChevronLeft className="size-3.5" aria-hidden /></Button>
            <span className="tabular px-1">Page {data.page} / {data.total_pages}</span>
            <Button size="sm" onClick={() => onPage(data.page + 1)} disabled={data.page >= data.total_pages} aria-label="Next page"><ChevronRight className="size-3.5" aria-hidden /></Button>
          </div>
        </div>
      )}
    </div>
  )
}
