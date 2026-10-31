import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RiskBadge, EmptyState, ErrorState } from '../components/ui/primitives'
import { MetricCard } from '../components/ui/MetricCard'
import { FleetTable } from '../components/machine/FleetTable'
import { SensorEvidenceTable } from '../components/machine/SensorEvidenceTable'
import { HealthTrendChart } from '../components/charts/HealthTrendChart'
import { SensorDeviationChart } from '../components/charts/SensorDeviationChart'
import { EvidenceCitation, evidenceHref } from '../components/copilot/EvidenceCitation'
import { ApiError } from '../lib/errors'
import { Gauge } from 'lucide-react'
import type { EvidenceItem, FleetPage } from '../schemas/api'
import type { FleetQuery } from '../services/api'

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('RiskBadge', () => {
  it.each([['CRITICAL', 'Critical'], ['WATCH', 'Watch'], ['HEALTHY', 'Healthy'], ['INSUFFICIENT_DATA', 'Insufficient data']])('shows a text label for %s (not colour alone)', (cat, label) => {
    render(<RiskBadge category={cat} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
  it('degrades gracefully for an unknown category', () => {
    render(<RiskBadge category="MYSTERY" />)
    expect(screen.getByText('MYSTERY')).toBeInTheDocument()
  })
})

describe('MetricCard', () => {
  it('is a pressable button when clickable and reports clicks', async () => {
    const onClick = vi.fn()
    render(<MetricCard label="Critical" value={2} icon={Gauge} accent="" onClick={onClick} active />)
    const b = screen.getByRole('button', { name: /Critical/ })
    expect(b).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(b)
    expect(onClick).toHaveBeenCalled()
  })
})

const query: FleetQuery = { page: 1, pageSize: 10, sortBy: 'risk_score', sortOrder: 'desc' }
const page: FleetPage = {
  items: [
    { machine_id: 'M010', cycle: 74, health_score: 21.6, risk_score: 78.4, risk_category: 'CRITICAL', contributing_sensor_count: 4, first_sustained_anomaly_cycle: 53, estimated_rul: 0, dataset_id: 'DS', last_updated: '2026-10-30 14:58:21' },
    { machine_id: 'M020', cycle: 20, health_score: 100, risk_score: 0, risk_category: 'INSUFFICIENT_DATA', contributing_sensor_count: 0, first_sustained_anomaly_cycle: null, estimated_rul: null, dataset_id: 'DS', last_updated: null },
  ],
  total: 2, page: 1, page_size: 10, total_pages: 1,
}
const tableProps = { loading: false, error: null, query, onSort: vi.fn(), onPage: vi.fn(), onRetry: vi.fn(), onClearFilters: vi.fn(), hasFilters: false, onOpen: vi.fn() }

describe('FleetTable', () => {
  it('renders rows, never invents RUL or anomaly values for unknown fields', () => {
    wrap(<FleetTable {...tableProps} data={page} />)
    expect(screen.getByText('M010')).toBeInTheDocument()
    const row = screen.getByText('M020').closest('tr')!
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(3) // sensors, first anomaly, RUL
  })
  it('sorts via keyboard-operable header buttons and reports the column', async () => {
    const onSort = vi.fn()
    wrap(<FleetTable {...tableProps} onSort={onSort} data={page} />)
    await userEvent.click(screen.getByRole('button', { name: /Health score/i }))
    expect(onSort).toHaveBeenCalledWith('health_score')
    expect(screen.getByRole('columnheader', { name: /Risk/ })).toHaveAttribute('aria-sort', 'descending')
  })
  it('opens the machine when a row is clicked', async () => {
    const onOpen = vi.fn()
    wrap(<FleetTable {...tableProps} onOpen={onOpen} data={page} />)
    await userEvent.click(screen.getByText('M010').closest('tr')!)
    expect(onOpen).toHaveBeenCalledWith('M010')
  })
  it('shows skeletons while loading, an empty state with a clear action, and an error with retry', async () => {
    const { container, rerender } = wrap(<FleetTable {...tableProps} loading data={undefined} />)
    expect(container.querySelectorAll('.tb-skeleton').length).toBeGreaterThan(0)
    const onClear = vi.fn()
    rerender(<MemoryRouter><FleetTable {...tableProps} hasFilters onClearFilters={onClear} data={{ ...page, items: [], total: 0 }} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onClear).toHaveBeenCalled()
    const onRetry = vi.fn()
    rerender(<MemoryRouter><FleetTable {...tableProps} onRetry={onRetry} error={new ApiError('network', 'x')} data={undefined} /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable')
    await userEvent.click(screen.getByRole('button', { name: /Retry/ }))
    expect(onRetry).toHaveBeenCalled()
  })
})

const ev = (n: string, rank: number): EvidenceItem => ({ rank, sensor_name: n, raw_reading: 640.1, baseline_mean: 642.4, baseline_std: 0.36, deviation_magnitude: 4.67, drift_rate: -0.13, persistence: 10, contribution_score: 2.78, first_sustained_anomaly_cycle: 53, evidence_explanation: `Sensor ${n} deviated.` })

describe('SensorEvidenceTable', () => {
  it('ranks signals, expands a sensor on click and offers a Copilot action', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(<SensorEvidenceTable items={[ev('s2', 1), ev('s21', 2)]} drifts={[]} baselines={[]} onSelect={onSelect} onAsk={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 's2' }))
    expect(onSelect).toHaveBeenCalledWith('s2')
    const onAsk = vi.fn()
    rerender(<SensorEvidenceTable items={[ev('s2', 1)]} drifts={[]} baselines={[]} selected="s2" onSelect={onSelect} onAsk={onAsk} />)
    expect(screen.getByText('Sensor s2 deviated.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Ask Copilot why s2 matters/ }))
    expect(onAsk).toHaveBeenCalledWith('s2')
  })
  it('explains an empty ranking instead of showing a blank table', () => {
    render(<SensorEvidenceTable items={[]} drifts={[]} baselines={[]} onSelect={vi.fn()} onAsk={vi.fn()} />)
    expect(screen.getByText('No abnormal sensors ranked')).toBeInTheDocument()
  })
})

describe('chart empty states', () => {
  it('health chart explains missing history', () => {
    render(<HealthTrendChart history={[]} baselineWindow={30} />)
    expect(screen.getByText('No health history available')).toBeInTheDocument()
  })
  it('sensor chart explains missing drift data', () => {
    render(<SensorDeviationChart drifts={[]} baselines={[]} onSelect={vi.fn()} cycle={5} />)
    expect(screen.getByText('No sensor deviation data')).toBeInTheDocument()
  })
  it('health chart has a descriptive text alternative built from real values', () => {
    render(<HealthTrendChart baselineWindow={30} firstAnomalyCycle={53} history={[{ cycle: 1, health_score: 100, risk_score: 0, risk_category: 'INSUFFICIENT_DATA' }, { cycle: 74, health_score: 21.63, risk_score: 78.37, risk_category: 'CRITICAL' }]} />)
    expect(screen.getByRole('img', { name: /from 100 at cycle 1 to 21\.6 at cycle 74.*cycle 53/ })).toBeInTheDocument()
  })
})

describe('Copilot evidence references', () => {
  it('links sensor evidence to the machine sensor view', () => {
    expect(evidenceHref({ evidence_type: 'ROOT_CAUSE', sensor_name: 's8', detail: 'd' }, 'M 1')).toBe('/machines/M%201?sensor=s8#evidence')
    expect(evidenceHref({ evidence_type: 'HEALTH_SCORE', cycle: 74, detail: 'd' }, 'M1')).toBe('/machines/M1?cycle=74#health')
    expect(evidenceHref({ evidence_type: 'HISTORICAL_MATCH', detail: 'd' }, 'M1')).toBe('/machines/M1#matches')
    expect(evidenceHref({ evidence_type: 'ROOT_CAUSE', sensor_name: 's8', detail: 'd' }, null)).toBeNull()
  })
  it('renders only metadata the backend returned and is a real link', () => {
    wrap(<EvidenceCitation machineId="M010" evidence={{ evidence_type: 'ROOT_CAUSE', sensor_name: 's2', metric_value: 4.67, detail: 'Sensor s2 deviated by 4.67 std.' }} />)
    const link = screen.getByRole('link', { name: /View s2 evidence/ })
    expect(link).toHaveAttribute('href', '/machines/M010?sensor=s2#evidence')
    expect(screen.getByText('Sensor s2')).toBeInTheDocument()
    expect(screen.queryByText(/Cycle/)).not.toBeInTheDocument()
  })
})

describe('states', () => {
  it('EmptyState and ErrorState expose accessible roles and never show raw errors', () => {
    const { rerender } = render(<EmptyState title="Nothing here" message="Explain" />)
    expect(screen.getByRole('status')).toHaveTextContent('Nothing here')
    rerender(<ErrorState error={new ApiError('http', 'Machine X not found', { status: 404 })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Not found')
    rerender(<ErrorState error={new Error('TypeError: x is undefined\n at stack...')} />)
    expect(screen.getByRole('alert')).not.toHaveTextContent('stack')
  })
})
