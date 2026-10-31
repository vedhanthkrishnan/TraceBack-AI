import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, Copy, RotateCcw, SendHorizonal, Square, Trash2, Info } from 'lucide-react'
import { useCopilotChat, type ChatMessage } from '../../hooks/useCopilotChat'
import { useCopilotStatus } from '../../hooks/queries'
import { EvidenceCitation } from './EvidenceCitation'
import { Button, Pill } from '../ui/primitives'
import { describeError } from '../../lib/errors'
import { cn } from '../../lib/cn'
import { isOfflineEngine } from '../../lib/copilot'

function TypingIndicator() {
  return (
    <div role="status" aria-label="Copilot is analysing the evidence" className="flex items-center gap-1.5 rounded-xl border border-line bg-elevated px-3 py-2.5 text-xs text-muted">
      <span className="tb-dot size-1.5 rounded-full bg-accent-2" />
      <span className="tb-dot size-1.5 rounded-full bg-accent-2 [animation-delay:150ms]" />
      <span className="tb-dot size-1.5 rounded-full bg-accent-2 [animation-delay:300ms]" />
      <span className="ml-1">Analysing machine evidence…</span>
    </div>
  )
}

function AssistantMessage({ m }: { m: ChatMessage }) {
  const [copied, setCopied] = useState(false)
  const r = m.response
  const refs = r?.evidence_references ?? []
  return (
    <div className="max-w-full space-y-2">
      <div className="rounded-xl border border-line bg-elevated px-3.5 py-3">
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{m.content}</p>
        {r && r.suggested_actions.length > 0 && (
          <div className="mt-3 border-t border-line pt-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Suggested next checks</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">{r.suggested_actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
        )}
        {r && r.limitations.length > 0 && (
          <div className="mt-3 rounded-md border border-watch/30 bg-watch/8 px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-watch-fg"><Info className="size-3" aria-hidden /> Limitations stated by the backend</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-muted">{r.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>
        )}
      </div>
      {r && (
        refs.length > 0 ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Evidence ({refs.length})</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {refs.map((ref, i) => <EvidenceCitation key={i} evidence={ref} machineId={r.machine_id ?? m.machineId} />)}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-faint">The backend returned no evidence references for this answer — treat it as unverified.</p>
        )
      )}
      <div className="flex items-center gap-2 text-[11px] text-faint">
        {r && <span>{r.provider}{r.model ? ` · ${r.model}` : ''}</span>}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(m.content)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            } catch { /* clipboard unavailable */ }
          }}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-elevated hover:text-ink"
          aria-label="Copy response"
        >
          {copied ? <Check className="size-3 text-healthy-fg" aria-hidden /> : <Copy className="size-3" aria-hidden />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export function CopilotPanel({
  machineId,
  suggestions,
  seedQuestion,
  onSeedConsumed,
  className,
  tall,
}: {
  machineId: string | null
  suggestions: string[]
  seedQuestion?: string | null
  onSeedConsumed?: () => void
  className?: string
  tall?: boolean
}) {
  const chat = useCopilotChat()
  const status = useCopilotStatus()
  const [draft, setDraft] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const inputId = useId()
  const seeded = useRef<string | null>(null)

  // A question handed over from another part of the page (e.g. “Ask Copilot why s8 matters”) is sent once.
  useEffect(() => {
    if (!seedQuestion) seeded.current = null
    if (seedQuestion && seeded.current !== seedQuestion) {
      seeded.current = seedQuestion
      void chat.send(seedQuestion, machineId)
      onSeedConsumed?.()
    }
  }, [seedQuestion, machineId, chat, onSeedConsumed])

  // Auto-scroll only when the reader is already at the bottom.
  useEffect(() => {
    const el = scroller.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [chat.messages.length, chat.pending, chat.error])

  const submit = () => {
    const q = draft.trim()
    if (!q || chat.pending) return
    setDraft('')
    stick.current = true
    void chat.send(q, machineId)
  }
  const err = chat.error ? describeError(chat.error) : null
  const unavailable = status.isError
  const empty = chat.messages.length === 0

  return (
    <section aria-label="TraceBack Copilot" className={cn('flex min-h-0 flex-col rounded-xl border border-line bg-surface', className)}>
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">TraceBack Copilot</h2>
          <p className="truncate text-[11px] text-muted">{machineId ? <>Context: machine <strong className="text-ink">{machineId}</strong></> : 'No machine selected — fleet-level questions only'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {status.data && <Pill tone={isOfflineEngine(status.data) ? 'warn' : 'ok'} title={`${status.data.provider} · ${status.data.model}`}>{isOfflineEngine(status.data) ? 'Offline engine' : 'Live LLM'}</Pill>}
          {!empty && (
            <Button size="sm" variant="ghost" onClick={chat.clear} aria-label="Clear conversation"><Trash2 className="size-3.5" aria-hidden /></Button>
          )}
        </div>
      </header>

      <div
        ref={scroller}
        onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60 }}
        className={cn('min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3', tall ? 'min-h-[320px]' : 'max-h-[460px] min-h-[220px]')}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {empty && !chat.pending && (
          <div className="space-y-3 py-2">
            <div className="flex flex-col gap-1.5">
              {suggestions.map((s) => (
                <button key={s} type="button" disabled={chat.pending || unavailable} onClick={() => { stick.current = true; void chat.send(s, machineId) }} className="rounded-lg border border-line bg-bg/50 px-3 py-2 text-left text-xs text-ink transition-colors hover:border-accent-2 hover:bg-elevated disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl bg-accent/90 px-3 py-2 text-[13px] text-on-accent">{m.content}</div>
            </div>
          ) : (
            <AssistantMessage key={m.id} m={m} />
          ),
        )}
        {chat.pending && <TypingIndicator />}
        {err && (
          <div role="alert" className="rounded-lg border border-critical/40 bg-critical/10 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-critical-fg"><AlertTriangle className="size-3.5" aria-hidden /> {err.title}</p>
            <p className="mt-0.5 text-xs text-muted">{err.message}{err.hint ? ` ${err.hint}` : ''}</p>
            <p className="mt-1 text-[11px] text-faint">No answer was generated; nothing has been substituted for it.</p>
            {(chat.error?.isRetryable) && <Button size="sm" className="mt-2" onClick={() => void chat.retry()}><RotateCcw className="size-3.5" aria-hidden /> Retry</Button>}
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        {unavailable && <p role="status" className="mb-2 text-[11px] text-watch-fg">Copilot status could not be read; questions may fail. The rest of the dashboard is unaffected.</p>}
        <div className="flex items-end gap-2">
          <label htmlFor={inputId} className="sr-only">Ask the Copilot a question</label>
          <textarea
            id={inputId}
            rows={2}
            value={draft}
            maxLength={1000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }}
            placeholder={machineId ? `Ask about ${machineId}… (Enter to send, Shift+Enter for a new line)` : 'Ask about the fleet… (Enter to send)'}
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent-2"
          />
          {chat.pending ? (
            <Button variant="danger" onClick={chat.stop} aria-label="Stop generating"><Square className="size-4" aria-hidden /></Button>
          ) : (
            <Button variant="primary" onClick={submit} disabled={!draft.trim()} aria-label="Send question"><SendHorizonal className="size-4" aria-hidden /></Button>
          )}
        </div>
        <p className="mt-2 text-[10px] leading-snug text-faint">
          Statistical evidence, not proven cause.{' '}
          {machineId && <Link to={`/machines/${encodeURIComponent(machineId)}`} className="text-muted underline-offset-2 hover:underline">Open {machineId}</Link>}
        </p>
      </div>
    </section>
  )
}
