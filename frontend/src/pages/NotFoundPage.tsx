import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '../components/ui/primitives'

export default function NotFoundPage() {
  return (
    <div className="p-6">
      <EmptyState
        icon={<Compass className="size-9" aria-hidden />}
        title="Page not found"
        message="That address doesn’t match any TraceBack page. Check the URL or return to the fleet."
        action={
          <Link to="/" className="mt-2 inline-flex h-9 items-center rounded-md bg-accent px-3.5 text-sm font-semibold text-on-accent">
            Back to Fleet Overview
          </Link>
        }
      />
    </div>
  )
}
