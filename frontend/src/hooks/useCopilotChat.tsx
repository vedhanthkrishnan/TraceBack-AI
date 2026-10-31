import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { copilotApi } from '../services/api'
import { toApiError, type ApiError } from '../lib/errors'
import type { CopilotResponse, ConversationTurn } from '../schemas/api'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  machineId?: string | null
  response?: CopilotResponse
  createdAt: number
}

interface ChatState {
  messages: ChatMessage[]
  pending: boolean
  error: ApiError | null
  lastQuestion: { question: string; machineId: string | null } | null
  send: (question: string, machineId: string | null) => Promise<void>
  retry: () => Promise<void>
  stop: () => void
  clear: () => void
}

const Ctx = createContext<ChatState | null>(null)
const MAX_HISTORY_TURNS = 6
let counter = 0
const nextId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`

/**
 * Conversation is held in memory only (a session-scoped provider). Nothing is persisted: the backend has no
 * conversation storage, so a page reload clears it.
 */
export function CopilotChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [lastQuestion, setLast] = useState<ChatState['lastQuestion']>(null)
  const abortRef = useRef<AbortController | null>(null)
  const pendingRef = useRef(false)
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages

  const run = useCallback(async (question: string, machineId: string | null, appendUser: boolean) => {
    const q = question.trim()
    if (!q || pendingRef.current) return // blocks empty and duplicate submissions
    pendingRef.current = true
    setPending(true)
    setError(null)
    setLast({ question: q, machineId })

    const history: ConversationTurn[] = messagesRef.current
      .filter((m) => m.content)
      .slice(-MAX_HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }))

    if (appendUser) setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: q, machineId, createdAt: Date.now() }])
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await copilotApi.chat({ question: q, machine_id: machineId, conversation_history: history }, controller.signal)
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: res.answer, machineId: res.machine_id ?? machineId, response: res, createdAt: Date.now() }])
    } catch (e) {
      const err = toApiError(e)
      if (err.kind !== 'cancelled') setError(err)
    } finally {
      pendingRef.current = false
      abortRef.current = null
      setPending(false)
    }
  }, [])

  const value = useMemo<ChatState>(
    () => ({
      messages,
      pending,
      error,
      lastQuestion,
      send: (q, m) => run(q, m, true),
      retry: async () => {
        if (lastQuestion) await run(lastQuestion.question, lastQuestion.machineId, false)
      },
      stop: () => abortRef.current?.abort(),
      clear: () => {
        abortRef.current?.abort()
        setMessages([])
        setError(null)
        setLast(null)
      },
    }),
    [messages, pending, error, lastQuestion, run],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCopilotChat() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCopilotChat must be used inside CopilotChatProvider')
  return v
}
