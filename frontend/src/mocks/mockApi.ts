/** Mock transport: answers the same paths and JSON envelope as the real backend, from isolated fixtures. */
import { BENCHMARKS, GROUPS, MACHINES, MOCK_DATASET, PIPELINE, matchesFor } from './fixtures'
import type { CopilotChatRequest, CopilotResponse, EvidenceReference } from '../schemas/api'
import { ApiError } from '../lib/errors'

type Query = Record<string, string | number | boolean | null | undefined> | undefined
interface MockResult {
  status: number
  json: unknown
}

const ok = (data: unknown): MockResult => ({ status: 200, json: { success: true, data, error: null, message: null, request_id: 'mock-request' } })
const fail = (status: number, error: string, message: string): MockResult => ({
  status,
  json: { success: false, error, message, details: null, request_id: 'mock-request' },
})
const notFound = (id: string) => fail(404, 'MachineNotFoundError', `Machine '${id}' was not found in the mock fixtures.`)

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new ApiError('cancelled', 'Request cancelled.'))
    })
  })

function fleetList(q: NonNullable<Query>) {
  let items = Object.values(MACHINES).map((m) => m.summary)
  const cat = q.risk_category ? String(q.risk_category) : ''
  const search = q.search ? String(q.search).toLowerCase() : ''
  if (cat) items = items.filter((m) => m.risk_category === cat)
  if (search) items = items.filter((m) => m.machine_id.toLowerCase().includes(search))
  const key = (q.sort_by ? String(q.sort_by) : 'risk_score') as 'risk_score' | 'health_score' | 'machine_id' | 'cycle'
  const dir = q.sort_order === 'asc' ? 1 : -1
  items = [...items].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * dir)
  const page = Number(q.page ?? 1)
  const size = Number(q.page_size ?? 20)
  return {
    items: items.slice((page - 1) * size, page * size),
    total: items.length,
    page,
    page_size: size,
    total_pages: Math.max(1, Math.ceil(items.length / size)),
  }
}

function fleetSummary() {
  const all = Object.values(MACHINES).map((m) => m.summary)
  const count = (c: string) => all.filter((m) => m.risk_category === c).length
  const scored = all.filter((m) => m.risk_category !== 'INSUFFICIENT_DATA')
  const avg = (f: (m: (typeof all)[number]) => number) => Math.round((scored.reduce((s, m) => s + f(m), 0) / Math.max(1, scored.length)) * 10) / 10
  return {
    total_machines: all.length,
    healthy_count: count('HEALTHY'),
    watch_count: count('WATCH'),
    critical_count: count('CRITICAL'),
    insufficient_data_count: count('INSUFFICIENT_DATA'),
    average_health_score: avg((m) => m.health_score),
    average_risk_score: avg((m) => m.risk_score),
    active_dataset_id: MOCK_DATASET,
    last_pipeline_run: PIPELINE.end_time,
  }
}

function copilotAnswer(req: CopilotChatRequest): MockResult {
  const q = req.question.toLowerCase()
  const requestedId = req.machine_id ?? (/m\d{3}/i.exec(req.question)?.[0]?.toUpperCase() ?? null)
  if (!requestedId) {
    const s = fleetSummary()
    const body: CopilotResponse = {
      answer: `The mock fleet has ${s.total_machines} machines: ${s.critical_count} critical, ${s.watch_count} on watch, ${s.healthy_count} healthy and ${s.insufficient_data_count} with insufficient data. Select a machine to ask about specific sensors.`,
      machine_id: null,
      evidence_references: [],
      suggested_actions: [],
      limitations: ['No machine was selected, so no sensor-level evidence is cited.'],
      provider: 'Mock fixture responder',
      model: 'mock',
    }
    return ok(body)
  }
  const m = MACHINES[requestedId]
  if (!m) return notFound(requestedId)
  const d = m.detail
  const refs: EvidenceReference[] = [
    { evidence_type: 'HEALTH_SCORE', cycle: d.current_cycle, metric_value: d.risk_score, detail: `Machine ${d.machine_id} classified as ${d.risk_category} with risk score ${d.risk_score.toFixed(2)}/100 at cycle ${d.current_cycle}.` },
  ]
  m.evidence.slice(0, 3).forEach((e) =>
    refs.push({ evidence_type: 'ROOT_CAUSE', sensor_name: e.sensor_name, metric_value: e.deviation_magnitude, detail: `Sensor ${e.sensor_name} deviated by ${e.deviation_magnitude.toFixed(2)} std deviations (drift rate ${e.drift_rate}/cycle).` }),
  )
  const match = matchesFor(d.machine_id)[0]
  if (match) refs.push({ evidence_type: 'HISTORICAL_MATCH', metric_value: match.similarity_score, detail: `${match.matched_machine_id}: ${Math.round(match.similarity_score * 100)}% sensor-set overlap (${match.shared_sensor_evidence.join(', ')}).` })

  let answer: string
  if (d.risk_category === 'INSUFFICIENT_DATA') {
    answer = `Machine ${d.machine_id} has only ${d.current_cycle} cycles, within the ${d.baseline_window}-cycle baseline window, so TraceBack cannot assess it yet.`
  } else if (/when|began|begin|first|onset/.test(q)) {
    answer = d.first_sustained_anomaly_cycle
      ? `The first sustained anomaly on ${d.machine_id} was observed at cycle ${d.first_sustained_anomaly_cycle}; the machine is now at cycle ${d.current_cycle}.`
      : `No sustained anomaly has been recorded for ${d.machine_id}.`
  } else if (/similar|histor|match/.test(q)) {
    answer = match
      ? `The closest historical case is ${match.matched_machine_id} (similarity ${Math.round(match.similarity_score * 100)}%, a sensor-set overlap measure — not a failure probability). Shared sensors: ${match.shared_sensor_evidence.join(', ')}.`
      : `No sufficiently similar historical pattern was found for ${d.machine_id}.`
  } else {
    const top = m.evidence[0]
    answer = `${d.machine_id} is classified ${d.risk_category} (risk ${d.risk_score.toFixed(1)}/100 at cycle ${d.current_cycle}).${
      top ? ` The strongest abnormal signal is ${top.sensor_name}, ${top.deviation_magnitude.toFixed(2)} standard deviations from its baseline.` : ' No sensors currently show sustained deviation.'
    }`
  }
  const body: CopilotResponse = {
    answer,
    machine_id: d.machine_id,
    evidence_references: d.risk_category === 'INSUFFICIENT_DATA' ? [] : refs,
    suggested_actions: m.evidence[0] ? [`Review the ${m.evidence[0].sensor_name} sensor trace and verify its calibration.`] : [],
    limitations: ['Evidence reflects statistical anomaly detection, not verified physical causality.', 'Mock fixture data — not real observations.'],
    provider: 'Mock fixture responder',
    model: 'mock',
  }
  return ok(body)
}

export async function mockRequest(path: string, method: string, query: Query, body: unknown, signal?: AbortSignal): Promise<MockResult> {
  await delay(path.startsWith('/copilot/chat') ? 500 : 120, signal)
  const clean = path.replace(/^\/+/, '/')

  if (clean === '/health')
    return ok({ status: 'healthy', service: 'TraceBack AI (mock fixtures)', version: '1.0.0-mock', timestamp: String(Date.now() / 1000), database: { connected: true, engine: 'Mock fixtures (no database)', is_mock: true }, copilot: { provider: 'Mock fixture responder', is_configured: true } })
  if (clean === '/readiness')
    return ok({ ready: true, database_connected: true, schema_initialized: true, engine: 'Mock fixtures (no database)', is_mock: true, dataset_mode: `CUSTOM_${MOCK_DATASET}`, active_dataset: MOCK_DATASET, llm_provider: 'Mock fixture responder', pipeline_status: 'SUCCESS', notes: ['Demo fixtures — synthetic and deterministic'] })
  if (clean === '/pipeline/status') return ok(PIPELINE)
  if (clean === '/pipeline/run' && method === 'POST') return ok(PIPELINE)
  if (clean === '/fleet/summary') return ok(fleetSummary())
  if (clean === '/fleet') return ok(fleetList(query ?? {}))
  if (clean === '/groups') return ok(GROUPS)
  const g = /^\/groups\/([^/]+)$/.exec(clean)
  if (g) {
    const grp = GROUPS.find((x) => x.group_id === decodeURIComponent(g[1]!))
    return grp ? ok(grp) : fail(404, 'TraceBackException', `Signature group '${g[1]}' was not found.`)
  }
  if (clean === '/copilot/status')
    return ok({ provider: 'Mock fixture responder', is_available: true, model: 'mock', available_tools: ['mock fixtures only'], mock_fallback_active: true })
  if (clean === '/copilot/chat' && method === 'POST') return copilotAnswer(body as CopilotChatRequest)
  if (clean === '/benchmarks' || clean === '/benchmarks/history') return ok(BENCHMARKS)

  if (clean === '/machines/compare' && method === 'POST') {
    const ids = ((body as { machine_ids?: string[] })?.machine_ids ?? []).filter(Boolean)
    const missing = ids.find((i) => !MACHINES[i])
    if (missing) return notFound(missing)
    const profiles = ids.map((i) => {
      const m = MACHINES[i]!
      return { machine_id: i, current_cycle: m.detail.current_cycle, health_score: m.detail.health_score, risk_score: m.detail.risk_score, risk_category: m.detail.risk_category, first_sustained_anomaly_cycle: m.detail.first_sustained_anomaly_cycle ?? null, top_abnormal_sensors: m.evidence.slice(0, 4).map((e) => e.sensor_name), estimated_rul: m.detail.estimated_rul ?? null }
    })
    const sets = profiles.map((p) => new Set(p.top_abnormal_sensors))
    const all = new Set(profiles.flatMap((p) => p.top_abnormal_sensors))
    const shared = [...all].filter((s) => sets.every((x) => x.has(s))).sort()
    const divergent = [...all].filter((s) => !shared.includes(s)).sort()
    return ok({ comparison: profiles, shared_anomalies: shared, divergent_sensors: divergent, comparative_summary: `Compared ${ids.length} machines. Shared abnormal sensors: ${shared.join(', ') || 'none'}. Divergent sensors: ${divergent.join(', ') || 'none'}.` })
  }

  const mm = /^\/machines\/([^/]+)(?:\/([a-z-]+))?$/.exec(clean)
  if (mm) {
    const machineId = decodeURIComponent(mm[1]!)
    const m = MACHINES[machineId]
    if (!m) return notFound(machineId)
    switch (mm[2]) {
      case undefined: return ok(m.detail)
      case 'history': return ok({ machine_id: machineId, total_cycles: m.history.length, history: m.history })
      case 'sensors': return ok(m.sensors)
      case 'root-cause': return ok({ machine_id: machineId, cycle: m.detail.current_cycle, health_score: m.detail.health_score, risk_score: m.detail.risk_score, risk_category: m.detail.risk_category, evidence_items: m.evidence, methodology_note: 'Contribution score is an interpretable ranking metric derived from normalized deviation magnitude, rolling drift rate, persistence, and temporal onset order. It indicates leading signals requiring inspection, not definitive proof of physical component failure.' })
      case 'signatures':
      case 'comparisons': {
        const matches = matchesFor(machineId)
        return ok({ machine_id: machineId, current_cycle: m.detail.current_cycle, current_signature: m.sustained.length ? { sustained_sensors: m.sustained, cycle: m.detail.current_cycle } : null, matches, message: matches.length ? `Found ${matches.length} resembling historical failure trajectory cases.` : 'No sufficiently similar historical failure pattern was found.' })
      }
      case 'evidence': {
        const matches = matchesFor(machineId)
        return ok({ machine_id: machineId, cycle: m.detail.current_cycle, health_score: m.detail.health_score, risk_score: m.detail.risk_score, risk_category: m.detail.risk_category, baseline_window: m.detail.baseline_window, first_sustained_anomaly_cycle: m.detail.first_sustained_anomaly_cycle ?? null, estimated_rul: m.detail.estimated_rul ?? null, top_root_cause_evidence: m.evidence.slice(0, 5), top_historical_matches: matches, sensor_drift_highlights: m.sensors.drifts.filter((d) => d.threshold_crossed), summary_verdict: m.detail.explanation ?? '' })
      }
    }
  }
  return fail(404, 'NotFound', `No mock route for ${method} ${path}.`)
}
