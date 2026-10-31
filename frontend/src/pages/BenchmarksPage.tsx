import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, Loader2, Play, Timer } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button, Card, CardHeader, EmptyState, ErrorState, Pill, Skeleton } from '../components/ui/primitives'
import { useBenchmarkHistory, usePipelineStatus, useReadiness, useRunBenchmarks } from '../hooks/queries'
import { describeError } from '../lib/errors'
import { datasetLabel, fmtDuration, fmtTimestamp } from '../lib/formatting'
import { isMockMode } from '../lib/config'
import type { BenchmarkResult } from '../schemas/api'
import { P } from '../lib/palette'

const PALETTE = [P.teal, P.yellow, P.orange, P.green]

function dsKind(id: string, activeId?: string | null, mode?: string) {
  if (id === 'NASA_FD001') return 'Real NASA C-MAPSS'
  if (id === 'SYNTHETIC_FLEET_DEMO') return 'Synthetic'
  if (activeId === id) return datasetLabel(mode).kind === 'synthetic' ? 'Synthetic' : 'Active dataset'
  return 'Unclassified'
}

export default function BenchmarksPage() {
  const hist = useBenchmarkHistory()
  const ready = useReadiness()
  const pipeline = usePipelineStatus()
  const run = useRunBenchmarks()
  const [dsFilter, setDsFilter] = useState('all')
  const [opFilter, setOpFilter] = useState('all')
  const [repeats, setRepeats] = useState(3)
  const [confirm, setConfirm] = useState(false)

  const all: BenchmarkResult[] = useMemo(() => hist.data?.results ?? [], [hist.data])
  const datasets = useMemo(() => [...new Set(all.map((r) => r.dataset_id))], [all])
  const ops = useMemo(() => [...new Set(all.map((r) => r.operation_name))], [all])
  const rows = useMemo(() => all.filter((r) => (dsFilter === 'all' || r.dataset_id === dsFilter) && (opFilter === 'all' || r.operation_name === opFilter)), [all, dsFilter, opFilter])

  const chart = useMemo(() => {
    const by = new Map<string, Record<string, number | string>>()
    const acc = new Map<string, { sum: number; n: number }>()
    for (const r of rows) {
      const k = `${r.operation_name}|${r.dataset_id}`
      const a = acc.get(k) ?? { sum: 0, n: 0 }
      a.sum += r.measured_duration_ms
      a.n += 1
      acc.set(k, a)
      if (!by.has(r.operation_name)) by.set(r.operation_name, { operation: r.operation_name })
    }
    for (const [k, a] of acc) {
      const [op, ds] = k.split('|') as [string, string]
      by.get(op)![ds] = Math.round((a.sum / a.n) * 100) / 100
    }
    return [...by.values()]
  }, [rows])
  const shown = [...new Set(rows.map((r) => r.dataset_id))]
  const empties = rows.filter((r) => r.machine_count === 0 || r.cycle_count === 0)
  const mockEngine = rows.some((r) => /mock/i.test(r.environment_metadata ?? ''))
  const activeDs = ready.data?.active_dataset ?? null

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6">
      <PageHeader title="Benchmarks" />

      <Card className="mb-5">
        <CardHeader title="Run a new benchmark" />
        <div className="flex flex-wrap items-center gap-3 px-4 pb-4 text-xs">
          <span className="text-muted">Dataset: <strong className="text-ink">{activeDs ?? 'none loaded'}</strong></span>
          <label className="flex items-center gap-1.5 text-muted">Repeats
            <select value={repeats} onChange={(e) => setRepeats(Number(e.target.value))} className="h-8 rounded-md border border-line bg-bg px-2 text-ink focus:border-accent-2">{[1, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          {!confirm ? (
            <Button size="sm" onClick={() => setConfirm(true)} disabled={!activeDs || run.isPending}><Play className="size-3.5" aria-hidden /> Run benchmark</Button>
          ) : (
            <>
              <Button size="sm" variant="primary" disabled={run.isPending} onClick={() => run.mutate({ datasetId: activeDs!, repeats }, { onSettled: () => setConfirm(false) })}>{run.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Timer className="size-3.5" aria-hidden />} {run.isPending ? 'Running…' : `Confirm: run ${repeats}×`}</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={run.isPending}>Cancel</Button>
            </>
          )}
          {run.isError && <span role="alert" className="text-critical-fg">{describeError(run.error).title}: {describeError(run.error).message}</span>}
          {run.isSuccess && <span role="status" className="text-healthy-fg">Recorded {run.data.total_runs} new measurements.</span>}
          <span className="text-faint">Backend CLI alternative: <code className="rounded bg-elevated px-1 py-0.5">python backend/scripts/run_pipeline.py</code></span>
        </div>
      </Card>

      {hist.isError ? <Card><ErrorState error={hist.error} onRetry={() => hist.refetch()} context="Benchmarks" /></Card> : hist.isLoading ? <Skeleton className="h-80 w-full" /> : all.length === 0 ? (
        <Card><EmptyState icon={<Timer className="size-8" aria-hidden />} title="No benchmarks have been recorded" message="Use “Run benchmark” above, or run the backend benchmark workflow, to record measured timings. Nothing is shown until real measurements exist." /></Card>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-muted">Dataset
              <select value={dsFilter} onChange={(e) => setDsFilter(e.target.value)} className="h-8 rounded-md border border-line bg-surface px-2 text-ink focus:border-accent-2"><option value="all">All</option>{datasets.map((d) => <option key={d} value={d}>{d}</option>)}</select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted">Operation
              <select value={opFilter} onChange={(e) => setOpFilter(e.target.value)} className="h-8 rounded-md border border-line bg-surface px-2 text-ink focus:border-accent-2"><option value="all">All</option>{ops.map((d) => <option key={d} value={d}>{d}</option>)}</select>
            </label>
            <span className="text-xs text-faint">{rows.length} of {all.length} measurements</span>
          </div>

          {(mockEngine || isMockMode) && <p role="note" className="mb-3 rounded-md border border-watch/40 bg-watch/10 px-3 py-2 text-xs text-watch-fg">These timings were recorded on a local mock engine{isMockMode ? ' / demo fixtures' : ' (SQLite), not on an Exasol cluster'}. They say nothing about Exasol performance.</p>}
          {empties.length > 0 && <p role="alert" className="mb-3 flex items-start gap-2 rounded-md border border-watch/40 bg-watch/10 px-3 py-2 text-xs text-watch-fg"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {empties.length} measurement{empties.length === 1 ? '' : 's'} ran against a dataset with 0 machines/cycles loaded (e.g. “{empties[0]!.dataset_id}”), so they time empty queries and are not meaningful workload benchmarks. Benchmark the active dataset instead.</p>}

          <div className="mb-5 grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Mean execution time by operation" />
              <div className="px-3 pb-3">
                {chart.length === 0 ? <EmptyState title="No data for this filter" message="Change the dataset or operation filter." /> : (
                  <div className="h-72" role="img" aria-label={`Bar chart of mean execution time in milliseconds for ${chart.length} operations`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chart} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                        <CartesianGrid stroke={P.line} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="operation" tick={{ fill: P.muted, fontSize: 11 }} stroke={P.lineStrong} interval={0} />
                        <YAxis tick={{ fill: P.muted, fontSize: 11 }} stroke={P.lineStrong} label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: P.faint, fontSize: 11 }} />
                        <Tooltip cursor={{ fill: 'rgba(14,43,60,0.06)' }} contentStyle={{ background: P.elevated, border: `1px solid ${P.lineStrong}`, borderRadius: 8, fontSize: 12 }} formatter={(v) => [fmtDuration(Number(v)), 'Mean']} />
                        {shown.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                        {shown.map((d, i) => <Bar key={d} dataKey={d} fill={PALETTE[i % PALETTE.length]} radius={3} isAnimationActive={false} />)}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Run context" />
              <dl className="space-y-2 px-4 pb-4 text-xs">
                <div className="flex justify-between gap-2"><dt className="text-faint">Pipeline version</dt><dd className="font-medium">{pipeline.data?.pipeline_version ?? '—'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-faint">Engine</dt><dd className="text-right font-medium">{ready.data?.engine ?? '—'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-faint">Fastest</dt><dd className="text-right font-medium">{hist.data?.fastest_operation ?? '—'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-faint">Slowest</dt><dd className="text-right font-medium">{hist.data?.slowest_operation ?? '—'}</dd></div>
                <p className="border-t border-line pt-2 text-faint">No comparison with other databases is made: none was measured under controlled conditions.</p>
              </dl>
            </Card>
          </div>

          <Card>
            <CardHeader title="Measurements" />
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <caption className="sr-only">Individual benchmark measurements</caption>
                <thead><tr className="border-y border-line bg-sidebar/60 text-left text-[11px] font-medium uppercase tracking-wider text-muted">
                  {['Dataset', 'Type', 'Machines', 'Records', 'Operation', 'Time', 'Repeat', 'Environment', 'Recorded'].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.run_id}-${r.operation_name}-${r.repeat_number}-${i}`} className="border-b border-line/60">
                      <td className="px-3 py-2 font-medium">{r.dataset_id}</td>
                      <td className="px-3 py-2"><Pill tone="neutral">{dsKind(r.dataset_id, activeDs, ready.data?.dataset_mode)}</Pill></td>
                      <td className="tabular px-3 py-2">{r.machine_count}</td>
                      <td className="tabular px-3 py-2">{r.cycle_count.toLocaleString()}</td>
                      <td className="px-3 py-2">{r.operation_name}</td>
                      <td className="tabular px-3 py-2 font-semibold">{fmtDuration(r.measured_duration_ms)}</td>
                      <td className="tabular px-3 py-2">{r.repeat_number}</td>
                      <td className="max-w-[260px] truncate px-3 py-2 text-xs text-muted" title={r.environment_metadata ?? ''}>{r.environment_metadata ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{fmtTimestamp(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
