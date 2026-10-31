import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMachineSignatures, useMachineDetail } from '../hooks/queries'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
)

describe('machine query hooks', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('does not call the API when no machine is selected (no /machines// requests)', async () => {
    renderHook(() => useMachineSignatures(''), { wrapper })
    renderHook(() => useMachineDetail(''), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches once an id is present', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: true, data: { machine_id: 'M1', current_cycle: 1, health_score: 100, risk_score: 0, risk_category: 'HEALTHY', contributing_sensor_count: 0, dataset_id: 'D', data_quality_state: 'VALID', baseline_window: 30 }, request_id: 'r' }), { status: 200 }))
    const { result } = renderHook(() => useMachineDetail('M1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
