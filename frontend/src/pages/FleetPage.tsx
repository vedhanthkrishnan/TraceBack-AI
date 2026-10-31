import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CircleCheck, CircleHelp, Eye, Gauge, OctagonAlert, RefreshCw, Search, Server } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button, Card, CardHeader, ErrorState, Skeleton } from '../components/ui/primitives'
import { MetricCard } from '../components/ui/MetricCard'
import { RiskDistributionChart } from '../components/charts/RiskDistributionChart'
import { FleetTable } from '../components/machine/FleetTable'
import { PipelineCard } from '../components/machine/PipelineCard'
import { PriorityHero } from '../components/machine/PriorityHero'
import { useFleetList, useFleetSummary } from '../hooks/queries'
import { useDebounced } from '../hooks/useDebounced'
import { useSelectedMachine } from '../hooks/useSelectedMachine'
import { fmtNumber } from '../lib/formatting'
import { RISK_CATEGORIES } from '../schemas/api'
import type { FleetQuery } from '../services/api'
import { riskStyle } from '../lib/risk'

const PAGE_SIZE = 10
const SORTS = ['risk_score', 'health_score', 'machine_id', 'cycle'] as const

export default function FleetPage() {
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [, setSelected] = useSelectedMachine()

  const risk = params.get('risk') && (RISK_CATEGORIES as readonly string[]).includes(params.get('risk')!) ? params.get('risk')! : undefined
  const sortBy = (SORTS as readonly string[]).includes(params.get('sort') ?? '') ? (params.get('sort') as FleetQuery['sortBy']) : 'risk_score'
  const sortOrder = params.get('order') === 'asc' ? 'asc' : params.get('order') === 'desc' ? 'desc' : sortBy === 'machine_id' ? 'asc' : 'desc'
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const urlQ = params.get('q') ?? ''

  const [search, setSearch] = useState(urlQ)
  const dSearch = useDebounced(search, 250)

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (dSearch !== urlQ) update({ q: dSearch || undefined, page: undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dSearch])

  const query: FleetQuery = { page, pageSize: PAGE_SIZE, sortBy, sortOrder, riskCategory: risk, search: urlQ || undefined }
  const summary = useFleetSummary()
  const list = useFleetList(query)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['fleet'] })
    void qc.invalidateQueries({ queryKey: ['pipeline-status'] })
    void qc.invalidateQueries({ queryKey: ['readiness'] })
  }
  const refreshing = (summary.isFetching || list.isFetching) && !summary.isLoading

  const hasFilters = !!risk || !!urlQ

  const s = summary.data
  const cards = [
    { key: undefined, label: 'Machines analysed', value: s?.total_machines, icon: Server, accent: 'text-accent-2' },
    { key: 'HEALTHY', label: 'Healthy', value: s?.healthy_count, icon: CircleCheck, accent: 'text-healthy-fg' },
    { key: 'WATCH', label: 'On watch', value: s?.watch_count, icon: Eye, accent: 'text-watch-fg' },
    { key: 'CRITICAL', label: 'Critical', value: s?.critical_count, icon: OctagonAlert, accent: 'text-critical-fg' },
    { key: 'INSUFFICIENT_DATA', label: 'Insufficient data', value: s?.insufficient_data_count, icon: CircleHelp, accent: 'text-unknown' },
  ] as const

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6">
      <PageHeader
title="Fleet Overview"
        actions={
          <>
            <Button onClick={refresh} disabled={refreshing} aria-label="Refresh fleet data">
              <RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} aria-hidden /> Refresh
            </Button>
          </>
        }
      />

      <PriorityHero />

      {summary.isError ? (
        <Card className="mb-5"><ErrorState error={summary.error} onRetry={() => summary.refetch()} context="Fleet summary" /></Card>
      ) : (
        <section aria-label="Fleet summary" className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {cards.map((c) =>
            summary.isLoading ? (
              <Skeleton key={c.label} className="h-[92px]" />
            ) : (
              <MetricCard key={c.label} label={c.label} value={c.value ?? '—'} icon={c.icon} accent={c.accent} active={c.key ? risk === c.key : !risk} onClick={() => update({ risk: c.key, page: undefined })} />
            ),
          )}
          {summary.isLoading ? (
            <Skeleton className="h-[92px]" />
          ) : (
            <MetricCard label="Average health" value={s ? fmtNumber(s.average_health_score, 1) : '—'} icon={Gauge} accent="text-accent-2" />
          )}
        </section>
      )}

      <div className="mb-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Risk distribution" />
          <div className="px-4 pb-3">
            {summary.isLoading ? <Skeleton className="h-44 w-full" /> : s ? <RiskDistributionChart summary={s} onSelect={(k) => update({ risk: k, page: undefined })} /> : null}
          </div>
        </Card>
        <PipelineCard />
      </div>

      <Card>
        <CardHeader
          title="Machine fleet"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <label htmlFor="fleet-search" className="sr-only">Search machines by ID</label>
                <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
                <input id="fleet-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search machine ID" className="h-8 w-44 rounded-md border border-line bg-bg pl-7 pr-2 text-xs placeholder:text-faint focus:border-accent-2" />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <span>Risk</span>
                <select value={risk ?? ''} onChange={(e) => update({ risk: e.target.value || undefined, page: undefined })} className="h-8 rounded-md border border-line bg-bg px-2 text-xs text-ink focus:border-accent-2">
                  <option value="">All</option>
                  {RISK_CATEGORIES.map((c) => <option key={c} value={c}>{riskStyle(c).label}</option>)}
                </select>
              </label>
            </div>
          }
        />
        <FleetTable
          data={list.data}
          loading={list.isLoading}
          fetching={list.isFetching}
          error={list.error}
          query={query}
          hasFilters={hasFilters}
          onRetry={() => list.refetch()}
          onClearFilters={() => { setSearch(''); update({ risk: undefined, q: undefined, page: undefined }) }}
          onPage={(p) => update({ page: p === 1 ? undefined : String(p) })}
          onSort={(c) => update({ sort: c, order: sortBy === c ? (sortOrder === 'asc' ? 'desc' : 'asc') : c === 'machine_id' ? 'asc' : 'desc', page: undefined })}
          onOpen={(id) => { setSelected(id); nav(`/machines/${encodeURIComponent(id)}`) }}
        />
      </Card>
    </div>
  )
}
