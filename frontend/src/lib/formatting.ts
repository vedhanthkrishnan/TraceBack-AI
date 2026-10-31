export function fmtNumber(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function fmtSigned(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const s = fmtNumber(Math.abs(n), digits)
  return `${n < 0 ? '−' : n > 0 ? '+' : ''}${s}`
}

/** Raw sensor values span very different magnitudes (0.03 … 9050), so precision adapts. */
export function fmtReading(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const a = Math.abs(n)
  const d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 3 : 4
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export function fmtPercent(fraction: number | null | undefined, digits = 0): string {
  if (fraction === null || fraction === undefined) return '—'
  return `${(fraction * 100).toFixed(digits)}%`
}

export function fmtDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`
  return `${ms.toFixed(ms < 10 ? 2 : 1)} ms`
}

/** Backend timestamps are naive ISO-like strings ("2026-10-30 14:58:21"); display them as-is, without claiming a timezone. */
export function fmtTimestamp(ts: string | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function humanizeToken(s: string): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

export function datasetLabel(mode: string | null | undefined): { label: string; kind: 'real' | 'synthetic' | 'mock' | 'none' | 'custom' } {
  if (!mode) return { label: 'Dataset unknown', kind: 'none' }
  if (mode === 'REAL_NASA_CMAPSS_FD001') return { label: 'NASA C-MAPSS FD001 · real data', kind: 'real' }
  if (mode === 'SYNTHETIC_FLEET_DEMO') return { label: 'Synthetic fleet · not real observations', kind: 'synthetic' }
  if (mode === 'NO_DATA') return { label: 'No data loaded', kind: 'none' }
  return { label: mode.replace(/^CUSTOM_/, 'Custom: '), kind: 'custom' }
}
