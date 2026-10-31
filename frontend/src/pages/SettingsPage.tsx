import type { ReactNode } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader, ErrorState, Pill, Skeleton } from '../components/ui/primitives'
import { useCopilotStatus, useHealth, useMachineDetail, useMachineDirectory, usePipelineStatus, useReadiness } from '../hooks/queries'
import { config, isMockMode } from '../lib/config'
import { datasetLabel, fmtTimestamp } from '../lib/formatting'
import { isOfflineEngine } from '../lib/copilot'

function Row({ k, children, note }: { k: string; children: ReactNode; note?: string }) {
  return (
    <div className="grid gap-1 border-b border-line/60 px-4 py-2.5 text-sm last:border-0 sm:grid-cols-[220px_1fr]">
      <dt className="text-muted">{k}</dt>
      <dd><div className="font-medium">{children}</div>{note && <p className="mt-0.5 text-[11px] font-normal text-faint">{note}</p>}</dd>
    </div>
  )
}

export default function SettingsPage() {
  const health = useHealth()
  const ready = useReadiness()
  const pipeline = usePipelineStatus()
  const copilot = useCopilotStatus()
  const dir = useMachineDirectory()
  const first = dir.data?.[0]?.machine_id ?? ''
  const sample = useMachineDetail(first)
  const ds = datasetLabel(ready.data?.dataset_mode)

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <PageHeader title="Settings & data context" />

      <Card className="mb-5">
        <CardHeader title="Backend connection" />
        {health.isError ? <ErrorState compact error={health.error} onRetry={() => health.refetch()} context="Health check" /> : health.isLoading ? <div className="px-4 pb-4"><Skeleton className="h-20 w-full" /></div> : (
          <dl>
            <Row k="Status"><Pill tone={health.data?.status === 'healthy' ? 'ok' : 'warn'}>{health.data?.status}</Pill></Row>
            <Row k="Service">{health.data?.service} · v{health.data?.version}</Row>
            <Row k="Database engine" note={health.data?.database.is_mock ? 'A local SQLite mock engine is active — not an Exasol cluster.' : undefined}>{health.data?.database.engine}</Row>
            <Row k="API base URL"><code className="text-xs">{isMockMode ? '(mock mode — no network)' : config.apiBaseUrl}</code></Row>
            <Row k="Data mode">{isMockMode ? <Pill tone="warn">Mock fixtures</Pill> : <Pill tone="ok">Live backend</Pill>}</Row>
          </dl>
        )}
      </Card>

      <Card className="mb-5">
        <CardHeader title="Dataset & provenance" />
        {ready.isError ? <ErrorState compact error={ready.error} onRetry={() => ready.refetch()} context="Readiness" /> : ready.isLoading ? <div className="px-4 pb-4"><Skeleton className="h-20 w-full" /></div> : (
          <dl>
            <Row k="Active dataset">{ready.data?.active_dataset ?? 'None loaded'}</Row>
            <Row k="Provenance"><Pill tone={ds.kind === 'real' ? 'ok' : ds.kind === 'synthetic' ? 'warn' : 'neutral'}>{ds.label}</Pill></Row>
            <Row k="Ready to serve queries">{ready.data?.ready ? 'Yes' : 'No'}</Row>
            {ready.data?.notes.length ? <Row k="Backend notes"><ul className="list-disc pl-4 text-xs font-normal text-muted">{ready.data.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></Row> : null}
          </dl>
        )}
      </Card>

      <Card className="mb-5">
        <CardHeader title="Analytics pipeline" />
        <dl>
          <Row k="Pipeline version">{pipeline.data?.pipeline_version ?? '—'}</Row>
          <Row k="Latest run">{pipeline.data ? `${pipeline.data.status} · ${fmtTimestamp(pipeline.data.end_time ?? pipeline.data.start_time)}` : pipeline.isLoading ? '…' : 'No run recorded'}</Row>
          <Row k="Baseline window" note="Reported per machine by the API.">{sample.data ? `${sample.data.baseline_window} cycles (from ${first})` : '—'}</Row>
          <Row k="Drift window" note="Not exposed by the API.">—</Row>
          <Row k="Risk thresholds (configured in this UI)" note="The backend does not publish its thresholds. These values only position the dashed reference lines on charts (VITE_WATCH_RISK_THRESHOLD / VITE_CRITICAL_RISK_THRESHOLD) and are not learned or authoritative.">Watch ≥ {config.watchRiskThreshold} · Critical ≥ {config.criticalRiskThreshold} (risk score, 0–100)</Row>
        </dl>
      </Card>

      <Card className="mb-5">
        <CardHeader title="AI Copilot" />
        {copilot.isError ? <ErrorState compact error={copilot.error} onRetry={() => copilot.refetch()} context="Copilot status" /> : (
          <dl>
            <Row k="Provider">{copilot.data?.provider ?? '…'}</Row>
            <Row k="Availability">{copilot.data ? <Pill tone={copilot.data.is_available ? 'ok' : 'bad'}>{copilot.data.is_available ? 'Available' : 'Unavailable'}</Pill> : '…'}</Row>
            <Row k="Mode">{copilot.data ? (isOfflineEngine(copilot.data) ? 'Offline grounded engine (no external LLM in use)' : `Live LLM · ${copilot.data.model}`) : '…'}</Row>
          </dl>
        )}
      </Card>

      <Card>
        <CardHeader title="Application" />
        <dl><Row k="Frontend version">{config.appVersion}</Row></dl>
      </Card>
    </div>
  )
}
