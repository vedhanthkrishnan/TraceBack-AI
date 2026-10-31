/**
 * Zod schemas mirroring the TraceBack FastAPI backend (backend/app/schemas/*.py).
 * Types are inferred from these schemas so runtime validation and static types cannot drift apart.
 * Source of truth: the backend's /openapi.json — update here when the backend changes.
 */
import { z } from 'zod'

export const RISK_CATEGORIES = ['CRITICAL', 'WATCH', 'HEALTHY', 'INSUFFICIENT_DATA'] as const
export type RiskCategory = (typeof RISK_CATEGORIES)[number]
/** Backend types this as a free string; unknown values are preserved and rendered as "unknown". */
export const riskCategorySchema = z.string()

const num = z.number()
const optNum = z.number().nullish()
const optStr = z.string().nullish()

export const envelope = <T extends z.ZodType>(data: T) =>
  z.object({
    success: z.boolean(),
    data: data.nullable().optional(),
    error: optStr,
    message: optStr,
    request_id: optStr,
    details: z.record(z.string(), z.unknown()).nullish(),
  })

export const healthSchema = z.object({
  status: z.string(),
  service: z.string(),
  version: z.string(),
  timestamp: z.string(),
  database: z.object({ connected: z.boolean(), engine: z.string(), is_mock: z.boolean() }).passthrough(),
  copilot: z.object({ provider: z.string(), is_configured: z.boolean() }).passthrough(),
})
export type Health = z.infer<typeof healthSchema>

export const readinessSchema = z.object({
  ready: z.boolean(),
  database_connected: z.boolean(),
  schema_initialized: z.boolean(),
  engine: z.string(),
  is_mock: z.boolean(),
  dataset_mode: z.string(),
  active_dataset: optStr,
  llm_provider: z.string(),
  pipeline_status: optStr,
  notes: z.array(z.string()).default([]),
})
export type Readiness = z.infer<typeof readinessSchema>

export const pipelineRunSchema = z.object({
  run_id: z.string(),
  start_time: z.string(),
  end_time: optStr,
  dataset_id: z.string(),
  rows_processed: num,
  machines_processed: num,
  pipeline_version: z.string(),
  status: z.string(),
  error_summary: optStr,
  processing_duration_sec: optNum,
})
export type PipelineRun = z.infer<typeof pipelineRunSchema>

export const machineSummarySchema = z.object({
  machine_id: z.string(),
  cycle: num,
  health_score: num,
  risk_score: num,
  risk_category: riskCategorySchema,
  contributing_sensor_count: num.default(0),
  first_sustained_anomaly_cycle: optNum,
  estimated_rul: optNum,
  dataset_id: z.string(),
  last_updated: optStr,
})
export type MachineSummary = z.infer<typeof machineSummarySchema>

export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), total: num, page: num, page_size: num, total_pages: num })

export const fleetPageSchema = paginatedSchema(machineSummarySchema)
export type FleetPage = z.infer<typeof fleetPageSchema>

export const fleetSummarySchema = z.object({
  total_machines: num,
  healthy_count: num,
  watch_count: num,
  critical_count: num,
  insufficient_data_count: num,
  average_health_score: num,
  average_risk_score: num,
  active_dataset_id: optStr,
  last_pipeline_run: optStr,
})
export type FleetSummary = z.infer<typeof fleetSummarySchema>

export const machineDetailSchema = z.object({
  machine_id: z.string(),
  current_cycle: num,
  health_score: num,
  risk_score: num,
  risk_category: riskCategorySchema,
  contributing_sensor_count: num,
  first_sustained_anomaly_cycle: optNum,
  estimated_rul: optNum,
  rul_confidence: optNum,
  dataset_id: z.string(),
  data_quality_state: z.string(),
  baseline_window: num,
  explanation: optStr,
})
export type MachineDetail = z.infer<typeof machineDetailSchema>

export const historyPointSchema = z.object({
  cycle: num,
  health_score: num,
  risk_score: num,
  risk_category: riskCategorySchema,
})
export type HistoryPoint = z.infer<typeof historyPointSchema>

export const historySchema = z.object({
  machine_id: z.string(),
  total_cycles: num,
  history: z.array(historyPointSchema),
})
export type MachineHistory = z.infer<typeof historySchema>

export const sensorBaselineSchema = z.object({
  sensor_name: z.string(),
  sample_count: num,
  mean: num,
  std: num,
  median: optNum,
  mad: optNum,
  window_start_cycle: num,
  window_end_cycle: num,
  is_valid: z.boolean(),
  baseline_method: z.string(),
})
export type SensorBaseline = z.infer<typeof sensorBaselineSchema>

export const sensorDriftSchema = z.object({
  sensor_name: z.string(),
  current_raw_value: num,
  baseline_mean: num,
  baseline_std: num,
  current_z_score: num,
  smoothed_z_score: num,
  drift_rate: num,
  anomaly_score: num,
  is_sustained: z.boolean(),
  threshold_crossed: z.boolean(),
})
export type SensorDrift = z.infer<typeof sensorDriftSchema>

export const sensorsSchema = z.object({
  machine_id: z.string(),
  cycle: num,
  baselines: z.array(sensorBaselineSchema),
  drifts: z.array(sensorDriftSchema),
})
export type MachineSensors = z.infer<typeof sensorsSchema>

export const evidenceItemSchema = z.object({
  rank: num,
  sensor_name: z.string(),
  raw_reading: num,
  baseline_mean: num,
  baseline_std: num,
  deviation_magnitude: num,
  drift_rate: num,
  persistence: num,
  contribution_score: num,
  first_sustained_anomaly_cycle: optNum,
  evidence_explanation: z.string(),
})
export type EvidenceItem = z.infer<typeof evidenceItemSchema>

export const rootCauseSchema = z.object({
  machine_id: z.string(),
  cycle: num,
  health_score: num,
  risk_score: num,
  risk_category: riskCategorySchema,
  evidence_items: z.array(evidenceItemSchema),
  methodology_note: z.string(),
})
export type RootCause = z.infer<typeof rootCauseSchema>

export const historicalMatchSchema = z.object({
  matched_machine_id: z.string(),
  similarity_score: num,
  shared_sensor_evidence: z.array(z.string()),
  historical_total_cycles: num,
  outcome: z.string(),
  observation_window: z.string(),
  similarity_interpretation: z.string(),
})
export type HistoricalMatch = z.infer<typeof historicalMatchSchema>

export const signaturesSchema = z.object({
  machine_id: z.string(),
  current_cycle: num,
  current_signature: z.record(z.string(), z.unknown()).nullish(),
  matches: z.array(historicalMatchSchema),
  message: z.string(),
})
export type MachineSignatures = z.infer<typeof signaturesSchema>

export const evidenceBundleSchema = z.object({
  machine_id: z.string(),
  cycle: num,
  health_score: num,
  risk_score: num,
  risk_category: riskCategorySchema,
  baseline_window: num,
  first_sustained_anomaly_cycle: optNum,
  estimated_rul: optNum,
  top_root_cause_evidence: z.array(evidenceItemSchema),
  top_historical_matches: z.array(historicalMatchSchema),
  sensor_drift_highlights: z.array(sensorDriftSchema),
  summary_verdict: z.string(),
})
export type EvidenceBundle = z.infer<typeof evidenceBundleSchema>

export const signatureGroupSchema = z.object({
  group_id: z.string(),
  group_name: z.string(),
  member_count: num,
  clustering_method: z.string(),
  representative_pattern: z.record(z.string(), z.unknown()),
  member_machine_ids: z.array(z.string()).default([]),
})
export type SignatureGroup = z.infer<typeof signatureGroupSchema>

export const comparisonProfileSchema = z.object({
  machine_id: z.string(),
  current_cycle: num,
  health_score: num,
  risk_score: num,
  risk_category: riskCategorySchema,
  first_sustained_anomaly_cycle: optNum,
  top_abnormal_sensors: z.array(z.string()),
  estimated_rul: optNum,
})
export const comparisonSchema = z.object({
  comparison: z.array(comparisonProfileSchema),
  shared_anomalies: z.array(z.string()),
  divergent_sensors: z.array(z.string()),
  comparative_summary: z.string(),
})
export type MachineComparison = z.infer<typeof comparisonSchema>

export const evidenceReferenceSchema = z.object({
  evidence_type: z.string(),
  sensor_name: optStr,
  cycle: optNum,
  metric_value: optNum,
  detail: z.string(),
})
export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>

export const copilotResponseSchema = z.object({
  answer: z.string(),
  machine_id: optStr,
  evidence_references: z.array(evidenceReferenceSchema).default([]),
  suggested_actions: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  provider: z.string(),
  model: z.string(),
  tokens_used: optNum,
})
export type CopilotResponse = z.infer<typeof copilotResponseSchema>

export const copilotStatusSchema = z.object({
  provider: z.string(),
  is_available: z.boolean(),
  model: z.string(),
  available_tools: z.array(z.string()),
  mock_fallback_active: z.boolean(),
})
export type CopilotStatus = z.infer<typeof copilotStatusSchema>

export const benchmarkResultSchema = z.object({
  run_id: z.string(),
  dataset_id: z.string(),
  machine_count: num,
  cycle_count: num,
  operation_name: z.string(),
  measured_duration_ms: num,
  repeat_number: num,
  environment_metadata: optStr,
  created_at: optStr,
})
export type BenchmarkResult = z.infer<typeof benchmarkResultSchema>

export const benchmarkSummarySchema = z.object({
  total_runs: num,
  results: z.array(benchmarkResultSchema),
  fastest_operation: optStr,
  slowest_operation: optStr,
})
export type BenchmarkSummary = z.infer<typeof benchmarkSummarySchema>

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}
export interface CopilotChatRequest {
  question: string
  machine_id?: string | null
  conversation_history?: ConversationTurn[]
}
