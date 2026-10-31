export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'invalid-response' | 'cancelled'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly code?: string
  readonly requestId?: string | null
  readonly details?: Record<string, unknown> | null

  constructor(
    kind: ApiErrorKind,
    message: string,
    opts: { status?: number; code?: string; requestId?: string | null; details?: Record<string, unknown> | null } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = opts.status
    this.code = opts.code
    this.requestId = opts.requestId
    this.details = opts.details
  }

  get isNotFound() {
    return this.kind === 'http' && this.status === 404
  }
  get isRetryable() {
    return this.kind === 'network' || this.kind === 'timeout' || (this.kind === 'http' && (this.status ?? 0) >= 500) || this.status === 429
  }
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e
  return new ApiError('network', e instanceof Error ? e.message : 'Unexpected error')
}

/** User-facing message. Never exposes stack traces or raw server internals. */
export function describeError(e: unknown): { title: string; message: string; hint?: string } {
  const err = toApiError(e)
  switch (err.kind) {
    case 'network':
      return {
        title: 'Backend unreachable',
        message: 'The TraceBack API could not be reached.',
        hint: 'Check that the backend is running and VITE_API_BASE_URL is correct.',
      }
    case 'timeout':
      return { title: 'Request timed out', message: 'The backend took too long to respond.', hint: 'Retry in a moment.' }
    case 'invalid-response':
      return {
        title: 'Unexpected response format',
        message: 'The backend returned data that does not match the expected contract.',
        hint: err.message,
      }
    case 'cancelled':
      return { title: 'Request cancelled', message: 'The request was cancelled.' }
    case 'http':
      if (err.status === 404) return { title: 'Not found', message: err.message }
      if (err.status === 429) return { title: 'Rate limited', message: 'Too many requests. Wait a moment and retry.' }
      if (err.status === 422) return { title: 'Invalid request', message: err.message }
      return { title: `Backend error${err.status ? ` (${err.status})` : ''}`, message: err.message }
  }
}
