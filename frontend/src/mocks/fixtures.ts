/**
 * ISOLATED DEMO FIXTURES — used only when VITE_DATA_MODE=mock.
 * Everything here is synthetic and internally consistent (seeded, deterministic). It mirrors the shape of the real
 * backend's SYNTHETIC_FLEET_DEMO scenario and must never be presented as real industrial observations.
 */
import type {
  BenchmarkSummary,
  EvidenceItem,
  HistoricalMatch,
  HistoryPoint,
  MachineDetail,
  MachineSensors,
  MachineSummary,
  PipelineRun,
  SensorBaseline,
  SensorDrift,
  SignatureGroup,
} from '../schemas/api'

export const MOCK_DATASET = 'MOCK_FIXTURE_DEMO'
const BASELINE_WINDOW = 30
const WATCH = 45
const CRITICAL = 75
const STAMP = '2026-10-30 09:00:00'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const VALID_SENSORS = ['s2', 's3', 's4', 's6', 's7', 's8', 's9', 's11', 's12', 's13', 's14', 's15', 's17', 's20', 's21'] as const
const INVALID_SENSORS = ['s1', 's5', 's10', 's16', 's18', 's19'] as const
const NOMINAL: Record<string, { mean: number; std: number }> = {
  s1: { mean: 518.67, std: 0 }, s2: { mean: 642.5, std: 0.45 }, s3: { mean: 1585, std: 5.2 }, s4: { mean: 1405, std: 6.1 },
  s5: { mean: 14.62, std: 0 }, s6: { mean: 21.61, std: 0.01 }, s7: { mean: 553.5, std: 0.5 }, s8: { mean: 2388.05, std: 0.07 },
  s9: { mean: 9050, std: 12 }, s10: { mean: 1.3, std: 0 }, s11: { mean: 47.3, std: 0.25 }, s12: { mean: 521.8, std: 0.65 },
  s13: { mean: 2388.08, std: 0.055 }, s14: { mean: 8130, std: 9 }, s15: { mean: 8.42, std: 0.035 }, s16: { mean: 0.03, std: 0 },
  s17: { mean: 392, std: 1.2 }, s18: { mean: 2388, std: 0 }, s19: { mean: 100, std: 0 }, s20: { mean: 38.9, std: 0.16 }, s21: { mean: 23.3, std: 0.08 },
}

interface Spec {
  id: string
  cycles: number
  onset: number | null
  severity: number // 0..1 — fraction of the way to maximum degradation at the final cycle
  sensors: string[] // sensors that drift (ordered by onset)
  failed: boolean // run-to-failure historical case
  seed: number
}

const SPECS: Spec[] = [
  { id: 'M001', cycles: 109, onset: 83, severity: 0.7, sensors: ['s4', 's21', 's17', 's12'], failed: true, seed: 11 },
  { id: 'M002', cycles: 87, onset: 58, severity: 0.82, sensors: ['s11', 's2', 's21', 's12'], failed: true, seed: 12 },
  { id: 'M003', cycles: 118, onset: 84, severity: 0.9, sensors: ['s3', 's8', 's9', 's14'], failed: true, seed: 13 },
  { id: 'M004', cycles: 112, onset: 79, severity: 0.88, sensors: ['s3', 's8', 's9'], failed: true, seed: 14 },
  { id: 'M005', cycles: 96, onset: 70, severity: 0.8, sensors: ['s8', 's9', 's14'], failed: true, seed: 15 },
  { id: 'M006', cycles: 87, onset: 52, severity: 0.84, sensors: ['s11', 's12', 's2'], failed: true, seed: 16 },
  { id: 'M007', cycles: 127, onset: 102, severity: 0.95, sensors: ['s8', 's14', 's3', 's9'], failed: false, seed: 17 },
  { id: 'M008', cycles: 74, onset: 53, severity: 0.78, sensors: ['s2', 's21', 's11', 's12'], failed: false, seed: 18 },
  { id: 'M009', cycles: 92, onset: 80, severity: 0.4, sensors: ['s15', 's20'], failed: false, seed: 19 },
  { id: 'M010', cycles: 101, onset: null, severity: 0, sensors: [], failed: false, seed: 20 },
  { id: 'M011', cycles: 64, onset: null, severity: 0, sensors: [], failed: false, seed: 21 },
  { id: 'M012', cycles: 24, onset: null, severity: 0, sensors: [], failed: false, seed: 22 }, // insufficient data
  { id: 'M013', cycles: 98, onset: 76, severity: 0.86, sensors: ['s6', 's13', 's7'], failed: false, seed: 23 }, // unique pattern → no match
]

function categorize(cycle: number, risk: number): string {
  if (cycle < BASELINE_WINDOW) return 'INSUFFICIENT_DATA'
  if (risk >= CRITICAL) return 'CRITICAL'
  if (risk >= WATCH) return 'WATCH'
  return 'HEALTHY'
}

function buildHistory(s: Spec): HistoryPoint[] {
  const rnd = mulberry32(s.seed)
  const out: HistoryPoint[] = []
  for (let c = 1; c <= s.cycles; c++) {
    let risk = 0
    if (c >= BASELINE_WINDOW) {
      risk = 2 + rnd() * 4
      if (s.onset && c >= s.onset) {
        const progress = Math.min(1, (c - s.onset + 1) / Math.max(8, s.cycles - s.onset + 1))
        risk = 8 + Math.pow(progress, 1.15) * (s.severity * 88) + rnd() * 3
      } else if (s.onset) {
        risk += ((c - BASELINE_WINDOW) / Math.max(1, s.onset - BASELINE_WINDOW)) * 14
      }
    }
    risk = Math.min(99, Math.round(risk * 100) / 100)
    out.push({ cycle: c, health_score: Math.round((100 - risk) * 100) / 100, risk_score: risk, risk_category: categorize(c, risk) })
  }
  return out
}

function sensorZ(s: Spec, sensor: string, risk: number): number {
  const idx = s.sensors.indexOf(sensor)
  if (idx === -1) {
    const r = mulberry32(s.seed * 31 + sensor.length * 7 + sensor.charCodeAt(1))
    return Math.round((r() - 0.5) * 2.2 * 100) / 100
  }
  const sign = (sensor.charCodeAt(1) + s.seed) % 2 === 0 ? 1 : -1
  const mag = (3.2 + (risk / 100) * 3.4) * (1 - idx * 0.12)
  return Math.round(sign * mag * 100) / 100
}

export interface MockMachine {
  spec: Spec
  history: HistoryPoint[]
  detail: MachineDetail
  summary: MachineSummary
  sensors: MachineSensors
  evidence: EvidenceItem[]
  sustained: string[]
}

function build(s: Spec): MockMachine {
  const history = buildHistory(s)
  const last = history[history.length - 1]!
  const category = last.risk_category
  const sustained = category === 'INSUFFICIENT_DATA' || !s.onset ? [] : s.sensors.filter((_, i) => last.risk_score > 20 + i * 3)
  const sustainedSet = new Set(sustained)

  const drifts: SensorDrift[] = VALID_SENSORS.map((name) => {
    const z = category === 'INSUFFICIENT_DATA' ? 0 : sensorZ(s, name, last.risk_score)
    const nom = NOMINAL[name]!
    const crossed = sustainedSet.has(name)
    const rate = crossed ? Math.round((z / 40) * 10000) / 10000 : Math.round(z * 0.004 * 10000) / 10000
    return {
      sensor_name: name,
      current_raw_value: Math.round((nom.mean + z * nom.std) * 10000) / 10000,
      baseline_mean: nom.mean,
      baseline_std: nom.std,
      current_z_score: z,
      smoothed_z_score: Math.round(z * 0.93 * 100) / 100,
      drift_rate: rate,
      anomaly_score: Math.abs(z),
      is_sustained: crossed,
      threshold_crossed: crossed,
    }
  }).sort((a, b) => Number(b.threshold_crossed) - Number(a.threshold_crossed) || b.anomaly_score - a.anomaly_score)

  const baselines: SensorBaseline[] = [...VALID_SENSORS, ...INVALID_SENSORS].map((name) => ({
    sensor_name: name,
    sample_count: Math.min(BASELINE_WINDOW, s.cycles),
    mean: NOMINAL[name]!.mean,
    std: NOMINAL[name]!.std,
    median: NOMINAL[name]!.mean,
    mad: NOMINAL[name]!.std * 0.6,
    window_start_cycle: 1,
    window_end_cycle: Math.min(BASELINE_WINDOW, s.cycles),
    is_valid: !(INVALID_SENSORS as readonly string[]).includes(name) && s.cycles >= BASELINE_WINDOW,
    baseline_method: 'STANDARD_NORMAL',
  }))

  const evidence: EvidenceItem[] = drifts
    .filter((d) => d.threshold_crossed)
    .map((d, i) => {
      const persistence = Math.min(10, Math.max(3, s.cycles - (s.onset ?? s.cycles)))
      const dev = Math.abs(d.smoothed_z_score)
      return {
        rank: i + 1,
        sensor_name: d.sensor_name,
        raw_reading: d.current_raw_value,
        baseline_mean: d.baseline_mean,
        baseline_std: d.baseline_std,
        deviation_magnitude: dev,
        drift_rate: d.drift_rate,
        persistence,
        contribution_score: Math.round((0.4 * dev + 0.3 * Math.abs(d.drift_rate) * 25 + 0.2 * persistence / 2 + 0.1) * 100) / 100,
        first_sustained_anomaly_cycle: s.onset! + i * 2,
        evidence_explanation: `Sensor ${d.sensor_name} deviated by ${dev.toFixed(2)} standard deviations from its healthy baseline (mean: ${d.baseline_mean}), exhibiting a drift rate of ${d.drift_rate}/cycle.`,
      }
    })
    .sort((a, b) => b.contribution_score - a.contribution_score)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  const rul = category === 'CRITICAL' || category === 'WATCH' ? Math.max(0, Math.round((s.failed ? 0 : (1 - last.risk_score / 100) * 60) * 10) / 10) : null
  const explanation =
    category === 'INSUFFICIENT_DATA'
      ? `Machine ${s.id} has only ${s.cycles} cycles, which is inside the ${BASELINE_WINDOW}-cycle baseline window. No reliable assessment is possible yet.`
      : `Machine ${s.id} is evaluated at cycle ${s.cycles}. Classification: ${category} (Risk score: ${last.risk_score.toFixed(1)}/100).${
          evidence.length ? ` Top contributing sensor signals: ${evidence.slice(0, 3).map((e) => e.sensor_name).join(', ')}.` : ''
        }${s.onset ? ` First sustained anomaly observed at cycle ${s.onset}.` : ''}`

  const detail: MachineDetail = {
    machine_id: s.id,
    current_cycle: s.cycles,
    health_score: last.health_score,
    risk_score: last.risk_score,
    risk_category: category,
    contributing_sensor_count: sustained.length,
    first_sustained_anomaly_cycle: category === 'INSUFFICIENT_DATA' ? null : s.onset,
    estimated_rul: rul,
    rul_confidence: null,
    dataset_id: MOCK_DATASET,
    data_quality_state: category === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT_READINGS' : 'VALID',
    baseline_window: BASELINE_WINDOW,
    explanation,
  }
  const summary: MachineSummary = {
    machine_id: s.id,
    cycle: s.cycles,
    health_score: last.health_score,
    risk_score: last.risk_score,
    risk_category: category,
    contributing_sensor_count: sustained.length,
    first_sustained_anomaly_cycle: detail.first_sustained_anomaly_cycle,
    estimated_rul: rul,
    dataset_id: MOCK_DATASET,
    last_updated: STAMP,
  }
  return { spec: s, history, detail, summary, sensors: { machine_id: s.id, cycle: s.cycles, baselines, drifts }, evidence, sustained }
}

export const MACHINES: Record<string, MockMachine> = Object.fromEntries(SPECS.map((s) => [s.id, build(s)]))

export function matchesFor(machineId: string): HistoricalMatch[] {
  const me = MACHINES[machineId]
  if (!me || me.sustained.length === 0) return []
  const mine = new Set(me.sustained)
  return Object.values(MACHINES)
    .filter((m) => m.spec.failed && m.spec.id !== machineId)
    .map((m) => {
      const theirs = new Set(m.spec.sensors)
      const shared = [...mine].filter((x) => theirs.has(x))
      const union = new Set([...mine, ...theirs]).size
      return { m, shared, score: shared.length / union }
    })
    .filter((x) => x.shared.length >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ m, shared, score }) => ({
      matched_machine_id: m.spec.id,
      similarity_score: Math.round(score * 100) / 100,
      shared_sensor_evidence: shared.sort(),
      historical_total_cycles: m.spec.cycles,
      outcome: 'RUN_TO_FAILURE',
      observation_window: `Cycles 1 - ${m.spec.cycles}`,
      similarity_interpretation: `Machine ${m.spec.id} exhibited sustained degradation across matching sensors: ${shared.sort().join(', ')}. Reached run-to-failure at cycle ${m.spec.cycles}.`,
    }))
}

export const GROUPS: SignatureGroup[] = [
  { group_id: 'GRP_01', group_name: 'Failure Archetype Pattern 1', member_count: 3, clustering_method: 'K-Means on Onset Latency & Peak Deviation', representative_pattern: { dominant_sensors: ['s11', 's12', 's2'], onset_phase: 'Mid-to-Late Life', degradation_pattern: 'Thermal-Mechanical Drift' }, member_machine_ids: ['M002', 'M006', 'M008'] },
  { group_id: 'GRP_02', group_name: 'Failure Archetype Pattern 2', member_count: 4, clustering_method: 'K-Means on Onset Latency & Peak Deviation', representative_pattern: { dominant_sensors: ['s3', 's8', 's9'], onset_phase: 'Mid-to-Late Life', degradation_pattern: 'Thermal-Mechanical Drift' }, member_machine_ids: ['M003', 'M004', 'M005', 'M007'] },
  { group_id: 'GRP_03', group_name: 'Failure Archetype Pattern 3', member_count: 1, clustering_method: 'K-Means on Onset Latency & Peak Deviation', representative_pattern: { dominant_sensors: ['s4', 's21', 's17'], onset_phase: 'Mid-to-Late Life', degradation_pattern: 'Thermal-Mechanical Drift' }, member_machine_ids: ['M001'] },
]

export const PIPELINE: PipelineRun = {
  run_id: 'pipe_mockfixture',
  start_time: '2026-10-30T08:59:55',
  end_time: '2026-10-30T09:00:00',
  dataset_id: MOCK_DATASET,
  rows_processed: Object.values(MACHINES).reduce((n, m) => n + m.spec.cycles, 0),
  machines_processed: SPECS.length,
  pipeline_version: 'v1.0-mock',
  status: 'SUCCESS',
  error_summary: null,
  processing_duration_sec: 5,
}

export const BENCHMARKS: BenchmarkSummary = {
  total_runs: 4,
  fastest_operation: 'Fleet Risk Aggregation',
  slowest_operation: 'Root-Cause Ranking Query',
  results: [
    ['Fleet Risk Aggregation', 1.1, 1], ['Fleet Risk Aggregation', 1.0, 2],
    ['Root-Cause Ranking Query', 3.5, 1], ['Root-Cause Ranking Query', 3.4, 2],
  ].map(([op, ms, rep], i) => ({
    run_id: 'bench_mockfixture',
    dataset_id: MOCK_DATASET,
    machine_count: SPECS.length,
    cycle_count: PIPELINE.rows_processed,
    operation_name: op as string,
    measured_duration_ms: ms as number,
    repeat_number: rep as number,
    environment_metadata: 'MOCK FIXTURE — illustrative values, not measured on any database',
    created_at: `2026-10-30T09:0${i}:00`,
  })),
}
