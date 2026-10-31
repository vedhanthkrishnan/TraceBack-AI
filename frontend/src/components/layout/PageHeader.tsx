import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export function PageHeader({ title, subtitle, actions, crumbs, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; crumbs?: { to?: string; label: string }[]; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6">
      {crumbs && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-faint">
            {crumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3" aria-hidden />}
                {c.to ? (
                  <Link to={c.to} className="hover:text-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-muted">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="micro mb-1.5 flex items-center gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full bg-accent-2" />
              {eyebrow}
            </p>
          )}
          <h1 className="display display-lg break-words">{title}</h1>
          {subtitle && <p className="mt-2 max-w-3xl text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
