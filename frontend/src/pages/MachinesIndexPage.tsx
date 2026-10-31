import { Navigate } from 'react-router-dom'
import { useFleetList } from '../hooks/queries'
import { useSelectedMachine } from '../hooks/useSelectedMachine'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/primitives'

/** /machines has no list of its own: it opens the remembered machine, or the highest-risk one. */
export default function MachinesIndexPage() {
  const [selected] = useSelectedMachine()
  const top = useFleetList({ page: 1, pageSize: 1, sortBy: 'risk_score', sortOrder: 'desc' })
  if (selected) return <Navigate to={`/machines/${encodeURIComponent(selected)}`} replace />
  if (top.isLoading) return <div className="p-6"><Skeleton className="h-24 w-full" /></div>
  if (top.isError) return <ErrorState error={top.error} onRetry={() => top.refetch()} context="Fleet" />
  const first = top.data?.items[0]
  if (!first) return <EmptyState title="No machines available" message="The backend has no analysed machines yet. Seed the demo fleet and run the pipeline." />
  return <Navigate to={`/machines/${encodeURIComponent(first.machine_id)}`} replace />
}
