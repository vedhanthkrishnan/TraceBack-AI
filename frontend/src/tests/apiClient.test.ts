import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { machineApi, fleetApi, copilotApi } from '../services/api'
import { ApiError } from '../lib/errors'

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data, error: null, message: null, request_id: 'rid-1' }), { status, headers: { 'X-Request-ID': 'rid-1', 'Content-Type': 'application/json' } })

const detail = {
  machine_id: 'M1', current_cycle: 10, health_score: 90, risk_score: 10, risk_category: 'HEALTHY', contributing_sensor_count: 0,
  dataset_id: 'DS', data_quality_state: 'VALID', baseline_window: 30,
}

describe('API client', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())
  const mock = () => vi.mocked(fetch)

  it('returns validated data and tolerates missing optional fields', async () => {
    mock().mockResolvedValueOnce(ok(detail))
    const d = await machineApi.detail('M1')
    expect(d.machine_id).toBe('M1')
    expect(d.estimated_rul).toBeUndefined()
  })

  it('rejects malformed payloads as invalid-response', async () => {
    mock().mockResolvedValueOnce(ok({ ...detail, risk_score: 'high' }))
    await expect(machineApi.detail('M1')).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('maps 404 envelopes to a not-found ApiError with request id', async () => {
    mock().mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, error: 'MachineNotFoundError', message: "Machine 'X' was not found.", request_id: 'abc' }), { status: 404 }),
    )
    const err = await machineApi.detail('X').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.isNotFound).toBe(true)
    expect(err.requestId).toBe('abc')
    expect(err.message).toContain('not found')
  })

  it('maps 5xx to retryable http errors', async () => {
    mock().mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: 'InternalServerError', message: 'boom' }), { status: 500 }))
    const err = await fleetApi.summary().catch((e) => e)
    expect(err.kind).toBe('http')
    expect(err.isRetryable).toBe(true)
  })

  it('maps network failures to a network ApiError', async () => {
    mock().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(fleetApi.summary()).rejects.toMatchObject({ kind: 'network' })
  })

  it('times out slow requests', async () => {
    vi.useFakeTimers()
    mock().mockImplementation((_u, init) => new Promise((_res, rej) => (init as RequestInit).signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))))
    const p = machineApi.detail('M1').catch((e) => e)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(await p).toMatchObject({ kind: 'timeout' })
    vi.useRealTimers()
  })

  it('honours caller cancellation', async () => {
    const c = new AbortController()
    mock().mockImplementation((_u, init) => new Promise((_res, rej) => (init as RequestInit).signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))))
    const p = machineApi.detail('M1', c.signal).catch((e) => e)
    c.abort()
    expect(await p).toMatchObject({ kind: 'cancelled' })
  })

  it('accepts empty lists', async () => {
    mock().mockResolvedValueOnce(ok({ items: [], total: 0, page: 1, page_size: 10, total_pages: 1 }))
    const page = await fleetApi.list({ page: 1, pageSize: 10, sortBy: 'risk_score', sortOrder: 'desc' })
    expect(page.items).toEqual([])
  })

  it('sends encoded machine ids, query params and JSON bodies', async () => {
    mock().mockResolvedValueOnce(ok(detail))
    await machineApi.detail('M 1/x')
    expect(String(mock().mock.calls[0]![0])).toContain('/machines/M%201%2Fx')
    mock().mockResolvedValueOnce(ok({ answer: 'a', provider: 'p', model: 'm' }))
    await copilotApi.chat({ question: 'hi', machine_id: 'M1' })
    const init = mock().mock.calls[1]![1] as RequestInit
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({ question: 'hi', machine_id: 'M1' })
  })

  it('surfaces Copilot provider unavailability and defaults missing arrays', async () => {
    mock().mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: 'ProviderUnavailable', message: 'LLM provider unavailable.' }), { status: 503 }))
    await expect(copilotApi.chat({ question: 'x' })).rejects.toMatchObject({ kind: 'http', status: 503, isRetryable: true })
    mock().mockResolvedValueOnce(ok({ answer: 'ok', provider: 'p', model: 'm' }))
    const r = await copilotApi.chat({ question: 'x' })
    expect(r.evidence_references).toEqual([])
    expect(r.limitations).toEqual([])
  })

  it('never falls back to mock data when the live API fails', async () => {
    mock().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(fleetApi.list({ page: 1, pageSize: 10, sortBy: 'risk_score', sortOrder: 'desc' })).rejects.toBeInstanceOf(ApiError)
  })
})
