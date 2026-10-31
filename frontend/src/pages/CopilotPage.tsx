import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { CopilotPanel } from '../components/copilot/CopilotPanel'
import { Card, CardHeader, Pill, RiskBadge, Skeleton } from '../components/ui/primitives'
import { useCopilotStatus, useMachineDetail, useMachineDirectory, useReadiness } from '../hooks/queries'
import { useSelectedMachine } from '../hooks/useSelectedMachine'
import { datasetLabel, fmtNumber } from '../lib/formatting'
import { riskStyle } from '../lib/risk'
import { isMockMode } from '../lib/config'
import { isOfflineEngine } from '../lib/copilot'

export default function CopilotPage() {
  const [params, setParams] = useSearchParams()
  const [remembered] = useSelectedMachine()
  const dir = useMachineDirectory()
  const ready = useReadiness()
  const status = useCopilotStatus()
  const machineParam = params.get('machine')
  const machineId = machineParam ?? remembered ?? null
  const detail = useMachineDetail(machineId ?? '')
  const known = machineId ? dir.data?.some((m) => m.machine_id === machineId) : true

  // Suggested prompts use real identifiers from the loaded fleet — never hardcoded ones.
  const suggestions = useMemo(() => {
    const ranked = [...(dir.data ?? [])].sort((a, b) => b.risk_score - a.risk_score)
    const focus = machineId ? dir.data?.find((m) => m.machine_id === machineId) : ranked[0]
    const other = ranked.find((m) => m.machine_id !== focus?.machine_id && m.risk_category !== 'INSUFFICIENT_DATA')
    const id = focus?.machine_id
    if (!id) return ['What is the overall fleet risk status?', 'Explain how TraceBack calculates its health index and risk thresholds.']
    const cat = riskStyle(focus.risk_category).label.toLowerCase()
    return [
      `Why is Machine ${id} at ${cat} risk?`,
      'Which sensors changed first?',
      other ? `Compare Machines ${id} and ${other.machine_id}.` : 'How does this machine compare with the rest of the fleet?',
      'Explain the closest historical failure pattern.',
      'What evidence supports this risk assessment?',
      'What data is missing from this investigation?',
    ]
  }, [dir.data, machineId])

  const ds = datasetLabel(ready.data?.dataset_mode)

  return (
    <div className="mx-auto max-w-[1300px] p-4 sm:p-6">
      <PageHeader
title="TraceBack Copilot"
        actions={
          <label className="flex items-center gap-2 text-xs text-muted">
            Machine context
            <select
              aria-label="Machine context"
              value={machineId ?? ''}
              onChange={(e) => { const n = new URLSearchParams(params); if (e.target.value) n.set('machine', e.target.value); else n.delete('machine'); setParams(n, { replace: true }) }}
              className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:border-accent-2"
            >
              <option value="">Fleet-level (no machine)</option>
              {!known && machineId && <option value={machineId}>{machineId} (not in fleet)</option>}
              {dir.data?.map((m) => <option key={m.machine_id} value={m.machine_id}>{m.machine_id} — {riskStyle(m.risk_category).label}</option>)}
            </select>
          </label>
        }
      />
      {!known && machineId && <p role="alert" className="mb-3 rounded-md border border-watch/40 bg-watch/10 px-3 py-2 text-xs text-watch-fg">Machine “{machineId}” is not in the loaded fleet. The Copilot will report that it cannot find it.</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <CopilotPanel machineId={machineId} suggestions={suggestions} tall className="min-h-[560px] lg:h-[calc(100vh-200px)]" />

        <div className="space-y-4">
          <Card>
            <CardHeader title="Data context" />
            <dl className="space-y-2 px-4 pb-4 text-xs">
              <div className="flex items-center justify-between gap-2"><dt className="text-faint">Dataset</dt><dd>{isMockMode ? <Pill tone="warn">Demo fixture</Pill> : <Pill tone={ds.kind === 'real' ? 'ok' : 'warn'}>{ds.label}</Pill>}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-faint">Provider</dt><dd className="text-right font-medium">{status.data?.provider ?? (status.isError ? 'Unavailable' : '…')}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-faint">Mode</dt><dd className="font-medium">{status.data ? (isOfflineEngine(status.data) ? 'Offline grounded engine' : 'Live LLM provider') : '—'}</dd></div>
              {status.data && <div><dt className="text-faint">Data tools available</dt><dd className="mt-1 flex flex-wrap gap-1">{status.data.available_tools.map((t) => <span key={t} className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-muted">{t.replace(/_/g, ' ')}</span>)}</dd></div>}
            </dl>
          </Card>

          {machineId && (
            <Card>
              <CardHeader title={`Machine ${machineId}`} actions={detail.data && <RiskBadge category={detail.data.risk_category} size="sm" />} />
              <div className="px-4 pb-4 text-xs">
                {detail.isLoading ? <Skeleton className="h-16 w-full" /> : detail.data ? (
                  <>
                    <p className="text-muted">{detail.data.explanation}</p>
                    <p className="mt-2 text-faint">Risk {fmtNumber(detail.data.risk_score, 1)}/100 · cycle {detail.data.current_cycle}</p>
                    <Link to={`/machines/${encodeURIComponent(machineId)}`} className="mt-2 inline-block font-medium text-accent-2 hover:underline">Open full investigation →</Link>
                  </>
                ) : <p className="text-faint">No details available for this machine.</p>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
