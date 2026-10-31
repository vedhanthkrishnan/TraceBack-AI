import { z } from 'zod'
import { request, requestNullable } from './apiClient'
import {
  benchmarkSummarySchema,
  comparisonSchema,
  copilotResponseSchema,
  copilotStatusSchema,
  evidenceBundleSchema,
  fleetPageSchema,
  fleetSummarySchema,
  healthSchema,
  historySchema,
  machineDetailSchema,
  pipelineRunSchema,
  readinessSchema,
  rootCauseSchema,
  sensorsSchema,
  signatureGroupSchema,
  signaturesSchema,
  type CopilotChatRequest,
} from '../schemas/api'
import { config } from '../lib/config'

const id = (machineId: string) => encodeURIComponent(machineId)

export interface FleetQuery {
  page: number
  pageSize: number
  sortBy: 'risk_score' | 'health_score' | 'machine_id' | 'cycle'
  sortOrder: 'asc' | 'desc'
  riskCategory?: string
  search?: string
  datasetId?: string
}

export const systemApi = {
  health: (signal?: AbortSignal) => request('/health', healthSchema, { signal, timeoutMs: 5000 }).then((r) => r.data),
  readiness: (signal?: AbortSignal) => request('/readiness', readinessSchema, { signal, timeoutMs: 5000 }).then((r) => r.data),
  pipelineStatus: (signal?: AbortSignal) => requestNullable('/pipeline/status', pipelineRunSchema, { signal }),
  runPipeline: (datasetId: string, signal?: AbortSignal) =>
    request('/pipeline/run', pipelineRunSchema, {
      method: 'POST',
      query: { dataset_id: datasetId },
      signal,
      timeoutMs: config.timeoutMs * 8,
    }).then((r) => r.data),
}

export const fleetApi = {
  summary: (datasetId?: string, signal?: AbortSignal) =>
    request('/fleet/summary', fleetSummarySchema, { query: { dataset_id: datasetId }, signal }).then((r) => r.data),
  list: (q: FleetQuery, signal?: AbortSignal) =>
    request('/fleet', fleetPageSchema, {
      query: {
        page: q.page,
        page_size: q.pageSize,
        sort_by: q.sortBy,
        sort_order: q.sortOrder,
        risk_category: q.riskCategory,
        search: q.search,
        dataset_id: q.datasetId,
      },
      signal,
    }).then((r) => r.data),
}

export const machineApi = {
  detail: (machineId: string, signal?: AbortSignal) => request(`/machines/${id(machineId)}`, machineDetailSchema, { signal }).then((r) => r.data),
  history: (machineId: string, signal?: AbortSignal) => request(`/machines/${id(machineId)}/history`, historySchema, { signal }).then((r) => r.data),
  sensors: (machineId: string, signal?: AbortSignal) => request(`/machines/${id(machineId)}/sensors`, sensorsSchema, { signal }).then((r) => r.data),
  rootCause: (machineId: string, signal?: AbortSignal) => request(`/machines/${id(machineId)}/root-cause`, rootCauseSchema, { signal }).then((r) => r.data),
  signatures: (machineId: string, signal?: AbortSignal) => request(`/machines/${id(machineId)}/signatures`, signaturesSchema, { signal }).then((r) => r.data),
  evidence: (machineId: string, signal?: AbortSignal) => request(`/machines/${id(machineId)}/evidence`, evidenceBundleSchema, { signal }).then((r) => r.data),
  compare: (machineIds: string[], signal?: AbortSignal) =>
    request('/machines/compare', comparisonSchema, { method: 'POST', body: { machine_ids: machineIds }, signal }).then((r) => r.data),
}

export const groupsApi = {
  list: (signal?: AbortSignal) => request('/groups', z.array(signatureGroupSchema), { signal }).then((r) => r.data),
  detail: (groupId: string, signal?: AbortSignal) => request(`/groups/${encodeURIComponent(groupId)}`, signatureGroupSchema, { signal }).then((r) => r.data),
}

export const copilotApi = {
  status: (signal?: AbortSignal) => request('/copilot/status', copilotStatusSchema, { signal, timeoutMs: 5000 }).then((r) => r.data),
  chat: (body: CopilotChatRequest, signal?: AbortSignal) =>
    request('/copilot/chat', copilotResponseSchema, { method: 'POST', body, signal, timeoutMs: config.timeoutMs * 3 }).then((r) => r.data),
}

export const benchmarkApi = {
  /** Reads persisted benchmark runs without executing any. */
  history: (signal?: AbortSignal) => request('/benchmarks/history', benchmarkSummarySchema, { signal }).then((r) => r.data),
  /** Executes NEW benchmark runs on the backend (GET /benchmarks has side effects: it records results). */
  run: (datasetId: string, repeats: number, signal?: AbortSignal) =>
    request('/benchmarks', benchmarkSummarySchema, {
      query: { dataset_id: datasetId, repeats },
      signal,
      timeoutMs: config.timeoutMs * 4,
    }).then((r) => r.data),
}
