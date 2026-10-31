import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, MessageSquareText, Search } from 'lucide-react'
import { useHealth, useMachineDirectory, usePipelineStatus, useReadiness } from '../../hooks/queries'
import { useDebounced } from '../../hooks/useDebounced'
import { useSelectedMachine } from '../../hooks/useSelectedMachine'
import { datasetLabel, fmtTimestamp } from '../../lib/formatting'
import { cn } from '../../lib/cn'
import { isMockMode } from '../../lib/config'
import { Pill, RiskBadge } from '../ui/primitives'

export function ConnectionStatus() {
  const health = useHealth()
  const ready = useReadiness()
  let tone: 'neutral' | 'ok' | 'warn' | 'bad' = 'neutral'
  let label = 'Checking API…'
  let tip = 'Backend health has not been checked yet.'
  if (health.isError) {
    tone = 'bad'
    label = isMockMode ? 'Mock error' : 'API offline'
    tip = 'The health check failed — the backend is unreachable.'
  } else if (health.data) {
    const degraded = health.data.status !== 'healthy' || (ready.data && !ready.data.ready)
    tone = degraded ? 'warn' : 'ok'
    label = isMockMode ? 'Mock mode' : degraded ? 'API degraded' : 'API connected'
    tip = degraded ? (ready.data?.notes.join(' · ') ?? 'Backend reports degraded status.') : `Engine: ${health.data.database.engine}`
  }
  const dot = { neutral: 'bg-faint', ok: 'bg-healthy', warn: 'bg-watch', bad: 'bg-critical' }[tone]
  return (
    <span role="status" aria-live="polite">
      <Pill tone={tone} title={tip}>
        <span aria-hidden className={cn('size-1.5 rounded-full', dot)} />
        {label}
      </Pill>
    </span>
  )
}

export function DatasetBadge() {
  const ready = useReadiness()
  if (isMockMode) return <Pill tone="warn" title="All data comes from isolated demo fixtures">Demo fixture data</Pill>
  if (!ready.data) return null
  const d = datasetLabel(ready.data.dataset_mode)
  return (
    <Pill tone={d.kind === 'real' ? 'ok' : d.kind === 'synthetic' ? 'warn' : 'neutral'} title={`${ready.data.engine}${ready.data.is_mock ? ' (local mock engine, not Exasol)' : ''}`}>
      {d.label}
    </Pill>
  )
}

function MachineSearch() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const dq = useDebounced(q, 150)
  const dir = useMachineDirectory()
  const [, setSelected] = useSelectedMachine()
  const nav = useNavigate()
  const listId = useId()
  const box = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const term = dq.trim().toLowerCase()
    if (!term || !dir.data) return []
    return dir.data.filter((m) => m.machine_id.toLowerCase().includes(term)).slice(0, 7)
  }, [dq, dir.data])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const go = (id: string) => {
    setSelected(id)
    setOpen(false)
    setQ('')
    nav(`/machines/${encodeURIComponent(id)}`)
  }

  return (
    <div ref={box} className="relative w-full max-w-xs">
      <label htmlFor={`${listId}-in`} className="sr-only">
        Search machines by ID
      </label>
      <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input
        id={`${listId}-in`}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={q}
        placeholder="Jump to machine…"
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            const r = results[active]
            if (r) go(r.machine_id)
            else if (q.trim()) go(q.trim())
          } else if (e.key === 'Escape') setOpen(false)
        }}
        className="h-9 w-full rounded-md border border-line bg-surface pl-8 pr-2.5 text-sm text-ink placeholder:text-faint focus:border-accent-2"
      />
      {open && dq.trim() && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-line-strong bg-elevated shadow-xl">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted" role="option" aria-selected="false">
              {dir.isLoading ? 'Loading machines…' : <>No machine matches “{dq}”. Press Enter to try the ID anyway.</>}
            </li>
          ) : (
            results.map((m, i) => (
              <li key={m.machine_id} role="option" aria-selected={i === active}>
                <button onMouseEnter={() => setActive(i)} onClick={() => go(m.machine_id)} className={cn('flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm', i === active && 'bg-accent/10')}>
                  <span className="font-medium">{m.machine_id}</span>
                  <RiskBadge category={m.risk_category} size="sm" />
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const pipeline = usePipelineStatus()
  const [selected] = useSelectedMachine()
  const last = pipeline.data?.end_time ?? pipeline.data?.start_time
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-bg/90 px-3 backdrop-blur sm:px-5">
      <button aria-label="Open navigation" onClick={onOpenNav} className="rounded-md p-2 text-muted hover:bg-elevated hover:text-ink lg:hidden">
        <Menu className="size-5" />
      </button>
      <MachineSearch />
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-2 md:flex">
          <DatasetBadge />
          {last && pipeline.data?.status === 'SUCCESS' && (
            <span className="hidden text-[11px] text-faint xl:inline" title="Last successful analytics pipeline run (as reported by the backend)">
              Last analysis {fmtTimestamp(last)}
            </span>
          )}
        </div>
        <ConnectionStatus />
        <Link
          to={selected ? `/copilot?machine=${encodeURIComponent(selected)}` : '/copilot'}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-elevated px-3 text-sm text-ink hover:border-accent-2"
        >
          <MessageSquareText className="size-4 text-accent-2" aria-hidden />
          <span className="hidden sm:inline">Copilot</span>
        </Link>
      </div>
    </header>
  )
}
