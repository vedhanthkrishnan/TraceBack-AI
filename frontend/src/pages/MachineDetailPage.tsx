import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Cpu, MessageSquareText, SearchX } from 'lucide-react'
import {
  useMachineDetail,
  useMachineDirectory,
  useMachineEvidence,
  useMachineHistory,
  useMachineRootCause,
  useMachineSensors,
  useMachineSignatures,
} from '../hooks/queries'
import { useSelectedMachine } from '../hooks/useSelectedMachine'
import { Button, Card, CardHeader, EmptyState, ErrorState, Pill, RiskBadge, Skeleton, Term } from '../components/ui/primitives'
import { PageHeader } from '../components/layout/PageHeader'
import { HealthTrendChart } from '../components/charts/HealthTrendChart'
import { SensorDeviationChart } from '../components/charts/SensorDeviationChart'
import { SensorEvidenceTable } from '../components/machine/SensorEvidenceTable'
import { FailureTimeline } from '../components/machine/FailureTimeline'
import { HistoricalMatches } from '../components/machine/HistoricalMatches'
import { CopilotPanel } from '../components/copilot/CopilotPanel'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { ApiError } from '../lib/errors'
import { fmtNumber, fmtPercent, humanizeToken } from '../lib/formatting'
import { riskStyle } from '../lib/risk'
import { isMockMode } from '../lib/config'
import { cn } from '../lib/cn'

const WINDOWS = [
  { key: 'all', label: 'All cycles', size: null },
  { key: '50', label: 'Last 50', size: 50 },
  { key: '25', label: 'Last 25', size: 25 },
] as const

function MachineNotFound({ machineId }: { machineId: string }) {
  const dir = useMachineDirectory()
  const near = dir.data?.filter((m) => m.machine_id.toLowerCase().includes(machineId.toLowerCase().slice(0, 3))).slice(0, 5) ?? []
  return (
    <div className="mx-auto max-w-xl p-6">
      <EmptyState
        icon={<SearchX className="size-9" aria-hidden />}
        title={`Machine “${machineId}” was not found`}
        message="The backend has no analysed machine with this ID. Check the spelling, or choose a machine from the fleet."
        action={
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Link to="/" className="inline-flex h-9 items-center rounded-md bg-accent px-3.5 text-sm font-semibold text-on-accent">Back to Fleet Overview</Link>
            {near.map((m) => <Link key={m.machine_id} to={`/machines/${m.machine_id}`} className="inline-flex h-9 items-center rounded-md border border-line px-3 text-sm hover:border-accent-2">{m.machine_id}</Link>)}
          </div>
        }
      />
    </div>
  )
}

export default function MachineDetailPage() {
  const { machineId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const location = useLocation()
  const [, setSelected] = useSelectedMachine()
  const directory = useMachineDirectory()

  const detail = useMachineDetail(machineId)
  const history = useMachineHistory(machineId)
  const sensors = useMachineSensors(machineId)
  const rootCause = useMachineRootCause(machineId)
  const signatures = useMachineSignatures(machineId)
  const bundle = useMachineEvidence(machineId)

  const sensorParam = params.get('sensor')
  const cycleParam = params.get('cycle') ? Number(params.get('cycle')) : null
  const [windowKey, setWindowKey] = useState<(typeof WINDOWS)[number]['key']>('all')
  const [seed, setSeed] = useState<string | null>(null)

  useEffect(() => {
    if (detail.data) setSelected(machineId)
  }, [detail.data, machineId, setSelected])

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params)
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k)
        else next.set(k, v)
      }
      setParams(next, { replace: true })
    },
    [params, setParams],
  )
  const selectSensor = useCallback((s: string | null) => setParam({ sensor: s }), [setParam])
  const selectCycle = useCallback((c: number | null) => setParam({ cycle: c === null ? null : String(c) }), [setParam])

  // Follow evidence links (e.g. from a Copilot citation): scroll to the hash target once the content exists.
  const hash = location.hash.slice(1)
  const ready = !!detail.data && !!rootCause.data
  useEffect(() => {
    if (!ready || !hash) return
    document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [ready, hash, sensorParam, cycleParam])

  const hist = useMemo(() => history.data?.history ?? [], [history.data])
  const win = useMemo<[number, number] | null>(() => {
    const size = WINDOWS.find((w) => w.key === windowKey)?.size
    if (!size || hist.length === 0) return null
    const lastCycle = hist[hist.length - 1]!.cycle
    return [Math.max(hist[0]!.cycle, lastCycle - size + 1), lastCycle]
  }, [windowKey, hist])

  if (detail.error instanceof ApiError && detail.error.isNotFound) return <MachineNotFound machineId={machineId} />
  if (detail.isError) return <div className="p-6"><ErrorState error={detail.error} onRetry={() => detail.refetch()} context={`Machine ${machineId}`} /></div>

  const d = detail.data
  const top = rootCause.data?.evidence_items[0]
  const risk = d ? riskStyle(d.risk_category) : null
  const inspected = cycleParam != null ? hist.find((h) => h.cycle === cycleParam) : null
  const insufficient = d?.risk_category === 'INSUFFICIENT_DATA'

  const askAbout = (sensor: string) => {
    setSeed(`Why does sensor ${sensor} matter for ${machineId}? When did it start deviating, and what does it suggest I check?`)
    document.getElementById('copilot')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const suggestions = [
    `Why is ${machineId} ${risk ? risk.label.toLowerCase() : 'at this risk level'}?`,
    top ? `Explain the strongest abnormal sensor (${top.sensor_name}).` : 'Which sensors are abnormal, if any?',
    'When did deterioration begin?',
    'Find similar historical failures.',
    'What should I investigate next?',
  ]

  // Deterministic summary from validated fields — no LLM involved.
  const uncertainty: string[] = []
  if (d) {
    if (insufficient) uncertainty.push(`Only ${d.current_cycle} cycles recorded; the ${d.baseline_window}-cycle baseline window is not complete, so no reliable assessment exists.`)
    if (d.estimated_rul != null) uncertainty.push('The remaining-life figure is a regression estimate that is not validated in this interface (a value of 0 is a model floor).')
    const bad = sensors.data?.baselines.filter((b) => !b.is_valid).length ?? 0
    if (bad) uncertainty.push(`${bad} sensor${bad === 1 ? ' has' : 's have'} no valid baseline (constant during the baseline window) and ${bad === 1 ? 'is' : 'are'} excluded from the analysis.`)
    if (signatures.data && signatures.data.matches.length === 0) uncertainty.push('No sufficiently similar historical pattern was found.')
    uncertainty.push('Scores reflect statistical drift from this machine’s own baseline, not verified physical causation or failure probability.')
  }

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6">
      <PageHeader
        crumbs={[{ to: '/', label: 'Fleet Overview' }, { label: 'Machine Investigation' }, { label: machineId }]}
title={
          <span className="flex flex-wrap items-center gap-3">
            <Cpu className="size-5 text-accent-2" aria-hidden /> Machine {machineId}
            {d && <RiskBadge category={d.risk_category} />}
          </span>
        }
        actions={
          <>
            <Link to="/" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm text-muted hover:border-line-strong hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> Fleet</Link>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <span className="sr-only sm:not-sr-only">Machine</span>
              <select value={machineId} onChange={(e) => nav(`/machines/${encodeURIComponent(e.target.value)}`)} className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:border-accent-2" aria-label="Switch machine">
                {!directory.data?.some((m) => m.machine_id === machineId) && <option value={machineId}>{machineId}</option>}
                {directory.data?.map((m) => <option key={m.machine_id} value={m.machine_id}>{m.machine_id} — {riskStyle(m.risk_category).label}</option>)}
              </select>
            </label>
            <Button variant="primary" onClick={() => { setSeed(null); document.getElementById('copilot')?.scrollIntoView({ behavior: 'smooth' }) }}><MessageSquareText className="size-4" aria-hidden /> Ask Copilot</Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-5">
          {/* Header facts + evidence summary */}
          <Card>
            <CardHeader title="Evidence summary" />
            <div className="px-4 pb-4">
              {detail.isLoading || !d ? (
                <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-16 w-full" /></div>
              ) : (
                <>
                  <dl className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 [&>div]:min-w-0">
                    <div><dt className="text-[11px] text-faint"><Term tip="0–100 where 100 is perfectly healthy relative to this machine’s own baseline. It is not a probability of failure.">Health score</Term></dt><dd className="tabular text-xl font-semibold">{fmtNumber(d.health_score, 1)}</dd></div>
                    <div><dt className="text-[11px] text-faint"><Term tip="100 − health score. Higher means more deviation from baseline.">Risk score</Term></dt><dd className={cn('tabular text-xl font-semibold', risk?.text)}>{fmtNumber(d.risk_score, 1)}</dd></div>
                    <div><dt className="text-[11px] text-faint">Current cycle</dt><dd className="tabular text-xl font-semibold">{d.current_cycle}</dd></div>
                    <div><dt className="text-[11px] text-faint">First sustained anomaly</dt><dd className="tabular text-xl font-semibold">{d.first_sustained_anomaly_cycle ?? '—'}</dd></div>
                    <div><dt className="text-[11px] text-faint">Data quality</dt><dd className="mt-1"><Pill tone={d.data_quality_state === 'VALID' ? 'ok' : 'warn'}>{humanizeToken(d.data_quality_state)}</Pill></dd></div>
                    <div><dt className="text-[11px] text-faint">Dataset</dt><dd className="mt-1 break-all text-sm font-medium">{d.dataset_id}{isMockMode && <span className="ml-1 text-[10px] text-watch-fg">(demo)</span>}</dd></div>
                  </dl>
                  <p className="text-sm leading-relaxed text-ink">{bundle.data?.summary_verdict ?? d.explanation}</p>
                  {bundle.isError && <p className="mt-1 text-[11px] text-watch-fg">The consolidated summary could not be loaded; showing the machine explanation instead.</p>}
                  <ul className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <li className="rounded-md border border-line bg-bg/40 px-3 py-2"><span className="text-faint">Strongest abnormal signals: </span><span className="font-medium text-ink">{rootCause.data?.evidence_items.slice(0, 3).map((e) => `${e.sensor_name} (${fmtNumber(e.deviation_magnitude, 1)}σ)`).join(', ') || (rootCause.isLoading ? '…' : 'none')}</span></li>
                    <li className="rounded-md border border-line bg-bg/40 px-3 py-2"><span className="text-faint">Timing: </span><span className="font-medium text-ink">{d.first_sustained_anomaly_cycle ? `deterioration began at cycle ${d.first_sustained_anomaly_cycle} of ${d.current_cycle}` : 'no sustained anomaly recorded'}</span></li>
                    <li className="rounded-md border border-line bg-bg/40 px-3 py-2"><span className="text-faint">Closest historical match: </span><span className="font-medium text-ink">{signatures.data?.matches[0] ? `${signatures.data.matches[0].matched_machine_id} (${fmtPercent(signatures.data.matches[0].similarity_score)} similarity)` : signatures.isLoading ? '…' : 'none found'}</span></li>
                    <li className="rounded-md border border-line bg-bg/40 px-3 py-2"><span className="text-faint">Remaining life: </span><span className="font-medium text-ink">{d.estimated_rul == null || insufficient ? 'no estimate available' : d.estimated_rul === 0 ? '0 cycles (unvalidated model floor)' : `≈ ${fmtNumber(d.estimated_rul, 0)} cycles (unvalidated model estimate)`}</span></li>
                  </ul>
                  <details className="mt-3 text-xs text-muted">
                    <summary className="cursor-pointer select-none text-faint hover:text-ink">Uncertainty and missing data ({uncertainty.length})</summary>
                    <ul className="mt-1.5 list-disc space-y-1 pl-5">{uncertainty.map((u, i) => <li key={i}>{u}</li>)}</ul>
                  </details>
                </>
              )}
            </div>
          </Card>

          <Card id="health" aria-labelledby="health-h" className="scroll-mt-20">
            <CardHeader
              id="health-h"
              title="Health trend"
              actions={
                <div role="group" aria-label="Observation window" className="flex rounded-md border border-line p-0.5">
                  {WINDOWS.map((w) => (
                    <button key={w.key} type="button" aria-pressed={windowKey === w.key} onClick={() => setWindowKey(w.key)} className={cn('rounded px-2.5 py-1 text-xs', windowKey === w.key ? 'bg-elevated text-ink' : 'text-muted hover:text-ink')}>{w.label}</button>
                  ))}
                </div>
              }
            />
            <div className="px-3 pb-3">
              {history.isLoading ? <Skeleton className="h-72 w-full" /> : history.isError ? <ErrorState compact error={history.error} onRetry={() => history.refetch()} context="Health history" /> : (
                <ErrorBoundary label="The health chart" resetKey={machineId}>
                  <HealthTrendChart history={hist} baselineWindow={d?.baseline_window ?? 30} firstAnomalyCycle={d?.first_sustained_anomaly_cycle} window={win} selectedCycle={cycleParam} onSelectCycle={selectCycle} />
                </ErrorBoundary>
              )}
              {inspected && (
                <div role="status" className="mx-1 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-line bg-bg/50 px-3 py-2 text-xs">
                  <span className="font-semibold text-accent-2">Cycle {inspected.cycle}</span>
                  <span>Health <strong className="tabular">{fmtNumber(inspected.health_score, 2)}</strong></span>
                  <span>Risk <strong className="tabular">{fmtNumber(inspected.risk_score, 2)}</strong></span>
                  <RiskBadge category={inspected.risk_category} size="sm" />
                  <button type="button" onClick={() => selectCycle(null)} className="ml-auto text-faint hover:text-ink">Clear</button>
                </div>
              )}
            </div>
          </Card>

          <div className="grid gap-5 2xl:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader title="Sensor drift" />
              <div className="px-3 pb-3">
                {sensors.isLoading ? <Skeleton className="h-64 w-full" /> : sensors.isError ? <ErrorState compact error={sensors.error} onRetry={() => sensors.refetch()} context="Sensor drift" /> : sensors.data ? (
                  <ErrorBoundary label="The sensor chart" resetKey={machineId}>
                    <SensorDeviationChart drifts={sensors.data.drifts} baselines={sensors.data.baselines} selected={sensorParam} onSelect={(s) => { setParam({ sensor: s }); document.getElementById('evidence')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }} cycle={sensors.data.cycle} />
                  </ErrorBoundary>
                ) : null}
              </div>
            </Card>

            <Card className="min-w-0">
              <CardHeader title="Failure timeline" />
              {d && history.data && rootCause.data ? (
                <FailureTimeline detail={d} history={hist} evidence={rootCause.data.evidence_items} selected={sensorParam} onSelectSensor={selectSensor} onSelectCycle={selectCycle} />
              ) : history.isError || rootCause.isError ? <ErrorState compact error={history.error ?? rootCause.error} onRetry={() => { void history.refetch(); void rootCause.refetch() }} context="Timeline" /> : <div className="space-y-3 px-4 pb-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>}
            </Card>
          </div>

          <Card id="evidence" className="scroll-mt-20">
            <CardHeader title="Root-cause evidence — likely contributing signals" subtitle="Leading indicators, not a confirmed cause." />
            {rootCause.isLoading ? <div className="space-y-2 px-4 pb-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div> : rootCause.isError ? <ErrorState compact error={rootCause.error} onRetry={() => rootCause.refetch()} context="Root-cause evidence" /> : rootCause.data ? (
              <SensorEvidenceTable items={rootCause.data.evidence_items} drifts={sensors.data?.drifts ?? []} baselines={sensors.data?.baselines ?? []} selected={sensorParam} onSelect={selectSensor} onAsk={askAbout} methodology={rootCause.data.methodology_note} />
            ) : null}
          </Card>

          <Card id="matches" className="scroll-mt-20">
            <CardHeader title="Historical matches" subtitle="Similarity is pattern overlap, not failure probability." />
            {signatures.isLoading ? <div className="space-y-2 px-4 pb-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div> : signatures.isError ? <ErrorState compact error={signatures.error} onRetry={() => signatures.refetch()} context="Historical matches" /> : signatures.data ? (
              <HistoricalMatches machineId={machineId} matches={signatures.data.matches} message={signatures.data.message} sustained={(signatures.data.current_signature?.sustained_sensors as string[] | undefined) ?? []} />
            ) : null}
          </Card>
        </div>

        <aside id="copilot" className="scroll-mt-20 xl:sticky xl:top-[72px] xl:self-start">
          <CopilotPanel machineId={machineId} suggestions={suggestions} seedQuestion={seed} onSeedConsumed={() => setSeed(null)} className="xl:max-h-[calc(100vh-96px)]" />
        </aside>
      </div>
    </div>
  )
}
