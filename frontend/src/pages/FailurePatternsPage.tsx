import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Layers } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button, Card, CardHeader, EmptyState, ErrorState, Pill, RiskBadge, Skeleton } from '../components/ui/primitives'
import { HistoricalMatches } from '../components/machine/HistoricalMatches'
import { useGroupDetail, useGroups, useMachineDirectory, useMachineSignatures, useReadiness } from '../hooks/queries'
import { datasetLabel } from '../lib/formatting'
import { cn } from '../lib/cn'
import type { SignatureGroup } from '../schemas/api'

const sensorsOf = (g: SignatureGroup | undefined): string[] => {
  const v = g?.representative_pattern?.dominant_sensors
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}
const otherFields = (g: SignatureGroup) => Object.entries(g.representative_pattern).filter(([k, v]) => k !== 'dominant_sensors' && (typeof v === 'string' || typeof v === 'number'))

function SequenceChart({ sensors, highlight }: { sensors: string[]; highlight?: Set<string> }) {
  if (sensors.length === 0) return <p className="text-xs text-faint">No sensor sequence reported for this group.</p>
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Sensor event sequence">
      {sensors.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold', highlight?.has(s) ? 'border-accent-2/60 bg-accent-2/10 text-accent-2' : 'border-line bg-elevated text-ink')}>
            <span className="tabular text-[10px] font-normal text-faint">{i + 1}</span>{s}
          </span>
          {i < sensors.length - 1 && <ArrowRight className="size-3.5 text-faint" aria-hidden />}
        </li>
      ))}
    </ol>
  )
}

export default function FailurePatternsPage() {
  const groups = useGroups()
  const ready = useReadiness()
  const dir = useMachineDirectory()
  const [sel, setSel] = useState<string | null>(null)
  const [cmp, setCmp] = useState<string>('')
  const [matchId, setMatchId] = useState<string>('')

  const list = groups.data ?? []
  const activeId = sel ?? list[0]?.group_id ?? null
  const detail = useGroupDetail(activeId)
  const active = detail.data ?? list.find((g) => g.group_id === activeId)
  const other = list.find((g) => g.group_id === cmp)
  const sigs = useMachineSignatures(matchId)
  const ds = datasetLabel(ready.data?.dataset_mode)

  const compare = useMemo(() => {
    const a = sensorsOf(active)
    const b = sensorsOf(other)
    const shared = a.filter((s) => b.includes(s))
    return { a, b, shared, onlyA: a.filter((s) => !b.includes(s)), onlyB: b.filter((s) => !a.includes(s)) }
  }, [active, other])

  const totalMembers = list.reduce((n, g) => n + g.member_count, 0)
  const members = (active?.member_machine_ids ?? []).map((id) => dir.data?.find((m) => m.machine_id === id) ?? { machine_id: id })

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6">
      <PageHeader title="Failure Patterns" />

      <section aria-label="Pattern overview" className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Signature groups', groups.isLoading ? '…' : list.length],
          ['Machines across groups', groups.isLoading ? '…' : totalMembers],
          ['Clustering method', list[0]?.clustering_method ?? '—'],
          ['Dataset', ds.label],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-xl border border-line bg-surface p-3.5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{k}</div>
            <div className="mt-1.5 text-sm font-semibold leading-snug">{v}</div>
          </div>
        ))}
      </section>

      {groups.isError ? <Card><ErrorState error={groups.error} onRetry={() => groups.refetch()} context="Signature groups" /></Card> : groups.isLoading ? (
        <div className="grid gap-3 md:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      ) : list.length === 0 ? (
        <Card><EmptyState icon={<Layers className="size-8" aria-hidden />} title="No signature groups available" message="No valid historical failure signatures were extracted. Run the analytics pipeline on a dataset containing run-to-failure machines." /></Card>
      ) : (
        <>
          <section aria-label="Signature groups" className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((g) => (
              <button key={g.group_id} type="button" aria-pressed={g.group_id === activeId} onClick={() => { setSel(g.group_id); if (cmp === g.group_id) setCmp('') }} className={cn('rounded-xl border bg-surface p-4 text-left transition-colors hover:bg-elevated', g.group_id === activeId ? 'border-accent-2' : 'border-line')}>
                <div className="flex items-center justify-between"><span className="text-sm font-semibold">{g.group_id}</span><Pill tone="neutral">{g.member_count} members</Pill></div>
                <p className="mt-0.5 text-xs text-muted">{g.group_name}</p>
                <div className="mt-3"><SequenceChart sensors={sensorsOf(g)} /></div>
                <div className="mt-3 text-[11px] text-faint">{otherFields(g).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')}</div>
              </button>
            ))}
          </section>

          <div className="grid gap-5 xl:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader title={`Signature explorer — ${active?.group_id ?? ''}`} actions={
                list.length > 1 && (
                  <label className="flex items-center gap-1.5 text-xs text-muted">Compare with
                    <select value={cmp} onChange={(e) => setCmp(e.target.value)} className="h-8 rounded-md border border-line bg-bg px-2 text-xs text-ink focus:border-accent-2">
                      <option value="">None</option>
                      {list.filter((g) => g.group_id !== activeId).map((g) => <option key={g.group_id} value={g.group_id}>{g.group_id}</option>)}
                    </select>
                  </label>
                )
              } />
              <div className="space-y-3 px-4 pb-4">
                {active && <SequenceChart sensors={sensorsOf(active)} highlight={other ? new Set(compare.shared) : undefined} />}
                {active && <p className="text-xs text-muted">{active.clustering_method} · order is not confirmed as onset order</p>}
                {other && (
                  <div className="rounded-lg border border-line bg-bg/50 p-3 text-xs">
                    <p className="mb-2 font-semibold">{activeId} vs {other.group_id}</p>
                    <SequenceChart sensors={compare.b} highlight={new Set(compare.shared)} />
                    <dl className="mt-3 grid gap-1.5 sm:grid-cols-3">
                      <div><dt className="text-faint">Shared sensors</dt><dd className="font-medium text-accent-2">{compare.shared.join(', ') || 'none'}</dd></div>
                      <div><dt className="text-faint">Only in {activeId}</dt><dd className="font-medium">{compare.onlyA.join(', ') || 'none'}</dd></div>
                      <div><dt className="text-faint">Only in {other.group_id}</dt><dd className="font-medium">{compare.onlyB.join(', ') || 'none'}</dd></div>
                    </dl>
                    <p className="mt-2 text-faint">Differences in drift magnitude and event timing are not provided by the API, so they are not compared.</p>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title={`Group members — ${activeId ?? ''}`} subtitle="Membership does not confirm failure." />
              {detail.isLoading ? <div className="px-4 pb-4"><Skeleton className="h-28 w-full" /></div> : detail.isError ? <ErrorState compact error={detail.error} onRetry={() => detail.refetch()} context="Group detail" /> : members.length === 0 ? <EmptyState title="No members reported" message="The backend returned no member machines for this group." /> : (
                <div className="relative overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <caption className="sr-only">Machines in the selected group</caption>
                    <thead><tr className="border-y border-line bg-sidebar/60 text-[11px] font-medium uppercase tracking-wider text-muted"><th scope="col" className="px-4 py-2 text-left">Machine</th><th scope="col" className="px-3 py-2 text-left">Current risk</th><th scope="col" className="px-3 py-2 text-left">Group outcome</th><th scope="col" className="px-3 py-2"><span className="sr-only">Action</span></th></tr></thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.machine_id} className="border-b border-line/60">
                          <th scope="row" className="px-4 py-2 text-left font-semibold">{m.machine_id}</th>
                          <td className="px-3 py-2">{'risk_category' in m ? <RiskBadge category={m.risk_category} size="sm" /> : <span className="text-xs text-faint">—</span>}</td>
                          <td className="px-3 py-2 text-xs text-faint">Not reported</td>
                          <td className="px-3 py-2 text-right"><Link to={`/machines/${encodeURIComponent(m.machine_id)}`} className="text-xs text-accent-2 hover:underline">View machine</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <Card className="mt-5">
        <CardHeader title="Machine matching" actions={
          <label className="flex items-center gap-1.5 text-xs text-muted">Machine
            <select value={matchId} onChange={(e) => setMatchId(e.target.value)} className="h-8 rounded-md border border-line bg-bg px-2 text-xs text-ink focus:border-accent-2">
              <option value="">Select…</option>
              {dir.data?.filter((m) => m.risk_category !== 'INSUFFICIENT_DATA').map((m) => <option key={m.machine_id} value={m.machine_id}>{m.machine_id}</option>)}
            </select>
          </label>
        } />
        {!matchId ? <EmptyState title="Select a machine" message="Choose a machine above to retrieve its closest historical failure patterns." /> : sigs.isLoading ? <div className="px-4 pb-4"><Skeleton className="h-24 w-full" /></div> : sigs.isError ? <ErrorState compact error={sigs.error} onRetry={() => sigs.refetch()} context="Matches" /> : sigs.data ? (
          <HistoricalMatches machineId={matchId} matches={sigs.data.matches} message={sigs.data.message} sustained={(sigs.data.current_signature?.sustained_sensors as string[] | undefined) ?? []} />
        ) : null}
        {matchId && <div className="px-4 pb-3"><Button size="sm" variant="ghost" onClick={() => setMatchId('')}>Clear</Button></div>}
      </Card>
    </div>
  )
}
