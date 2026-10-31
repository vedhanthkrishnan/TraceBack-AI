import { useState } from 'react'
import { Activity, Loader2, Play } from 'lucide-react'
import { useReadiness, usePipelineStatus, useRunPipeline } from '../../hooks/queries'
import { fmtNumber, fmtTimestamp } from '../../lib/formatting'
import { Button, Card, CardHeader, ErrorState, Pill, Skeleton } from '../ui/primitives'
import { describeError } from '../../lib/errors'

export function PipelineCard() {
  const status = usePipelineStatus()
  const ready = useReadiness()
  const run = useRunPipeline()
  const [confirm, setConfirm] = useState(false)
  const ds = ready.data?.active_dataset
  const p = status.data

  return (
    <Card>
      <CardHeader title="Latest pipeline run" />
      <div className="px-4 pb-4">
        {status.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : status.isError ? (
          <ErrorState compact error={status.error} onRetry={() => status.refetch()} context="Pipeline status" />
        ) : !p ? (
          <p className="text-xs text-muted">No pipeline run has been recorded yet. Run the pipeline to compute health scores.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3 [&>div]:min-w-0">
            <div><dt className="text-faint">Status</dt><dd className="mt-0.5"><Pill tone={p.status === 'SUCCESS' ? 'ok' : p.status === 'FAILED' ? 'bad' : 'warn'}>{p.status}</Pill></dd></div>
            <div><dt className="text-faint">Dataset</dt><dd className="mt-0.5 break-words font-medium" title={p.dataset_id}>{p.dataset_id}</dd></div>
            <div><dt className="text-faint">Finished</dt><dd className="mt-0.5 font-medium">{fmtTimestamp(p.end_time ?? p.start_time)}</dd></div>
            <div><dt className="text-faint">Rows processed</dt><dd className="tabular mt-0.5 font-medium">{p.rows_processed.toLocaleString()}</dd></div>
            <div><dt className="text-faint">Machines</dt><dd className="tabular mt-0.5 font-medium">{p.machines_processed}</dd></div>
            <div><dt className="text-faint">Duration</dt><dd className="tabular mt-0.5 font-medium">{p.processing_duration_sec != null ? `${fmtNumber(p.processing_duration_sec, 2)} s` : '—'}</dd></div>
            {p.error_summary && <div className="col-span-full text-critical-fg">Error: {p.error_summary}</div>}
          </dl>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {!confirm ? (
            <Button size="sm" onClick={() => setConfirm(true)} disabled={!ds || run.isPending}>
              <Play className="size-3.5" aria-hidden /> Re-run pipeline
            </Button>
          ) : (
            <>
              <span className="text-xs text-muted">Recompute all analytics for <strong className="text-ink">{ds}</strong>? This may take several seconds.</span>
              <Button size="sm" variant="primary" disabled={run.isPending} onClick={() => run.mutate(ds!, { onSettled: () => setConfirm(false) })}>
                {run.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Activity className="size-3.5" aria-hidden />} {run.isPending ? 'Running…' : 'Confirm'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={run.isPending}>Cancel</Button>
            </>
          )}
          {run.isError && <span role="alert" className="text-xs text-critical-fg">{describeError(run.error).title}: {describeError(run.error).message}</span>}
          {run.isSuccess && <span role="status" className="text-xs text-healthy-fg">Pipeline finished — data refreshed.</span>}
        </div>
      </div>
    </Card>
  )
}
