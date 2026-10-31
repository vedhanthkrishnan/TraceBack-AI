import type { z } from 'zod'
import { envelope } from '../schemas/api'
import { ApiError } from '../lib/errors'
import { config } from '../lib/config'
import { mockRequest } from '../mocks/mockApi'

export interface RequestOptions {
  method?: 'GET' | 'POST'
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

export interface ApiResult<T> {
  data: T
  requestId: string | null
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const base = config.apiBaseUrl.replace(/\/$/, '')
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return `${base}${path}${qs ? `?${qs}` : ''}`
}

async function rawRequest(path: string, opts: RequestOptions): Promise<{ status: number; json: unknown; requestId: string | null }> {
  if (config.dataMode === 'mock') {
    const r = await mockRequest(path, opts.method ?? 'GET', opts.query, opts.body, opts.signal)
    return { status: r.status, json: r.json, requestId: 'mock-request' }
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, opts.timeoutMs ?? config.timeoutMs)
  const onAbort = () => controller.abort()
  opts.signal?.addEventListener('abort', onAbort)

  try {
    const res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers: { Accept: 'application/json', ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
    let json: unknown = null
    try {
      json = await res.json()
    } catch {
      json = null
    }
    return { status: res.status, json, requestId: res.headers.get('X-Request-ID') }
  } catch (e) {
    if (timedOut) throw new ApiError('timeout', 'The request timed out.')
    if (opts.signal?.aborted) throw new ApiError('cancelled', 'Request cancelled.')
    throw new ApiError('network', e instanceof Error ? e.message : 'Network error')
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Central typed request. Validates the standard {success,data,error,message,request_id} envelope and the data payload.
 * Never falls back to mock data: mock mode is chosen explicitly via VITE_DATA_MODE=mock.
 */
export async function request<S extends z.ZodType>(path: string, schema: S, opts: RequestOptions = {}): Promise<ApiResult<z.infer<S>>> {
  const { status, json, requestId } = await rawRequest(path, opts)
  const parsedEnv = envelope(schema).safeParse(json)

  if (status >= 400 || (parsedEnv.success && !parsedEnv.data.success)) {
    const body = (json ?? {}) as { error?: string; message?: string; request_id?: string; details?: Record<string, unknown> }
    const detailMsg = Array.isArray((body.details as { validation_errors?: unknown[] } | undefined)?.validation_errors)
      ? ' Check the submitted values.'
      : ''
    throw new ApiError('http', (body.message ?? `Request failed with status ${status}.`) + detailMsg, {
      status,
      code: body.error,
      requestId: body.request_id ?? requestId,
      details: body.details,
    })
  }

  if (!parsedEnv.success) {
    const issue = parsedEnv.error.issues[0]
    throw new ApiError('invalid-response', `${path}: ${issue?.path.join('.') || 'envelope'} — ${issue?.message ?? 'invalid'}`, { requestId })
  }
  const payload = parsedEnv.data.data
  if (payload === null || payload === undefined) {
    throw new ApiError('invalid-response', `${path}: response contained no data.`, { requestId: parsedEnv.data.request_id ?? requestId })
  }
  return { data: payload as z.infer<S>, requestId: parsedEnv.data.request_id ?? requestId }
}

/** For endpoints whose data may legitimately be null (e.g. no pipeline run yet). */
export async function requestNullable<S extends z.ZodType>(path: string, schema: S, opts: RequestOptions = {}): Promise<z.infer<S> | null> {
  const { status, json, requestId } = await rawRequest(path, opts)
  const parsed = envelope(schema).safeParse(json)
  if (status >= 400 || (parsed.success && !parsed.data.success)) {
    const body = (json ?? {}) as { message?: string; error?: string }
    throw new ApiError('http', body.message ?? `Request failed with status ${status}.`, { status, code: body.error, requestId })
  }
  if (!parsed.success) throw new ApiError('invalid-response', `${path}: ${parsed.error.issues[0]?.message ?? 'invalid'}`, { requestId })
  return (parsed.data.data ?? null) as z.infer<S> | null
}
