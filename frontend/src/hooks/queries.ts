import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { benchmarkApi, copilotApi, fleetApi, groupsApi, machineApi, systemApi, type FleetQuery } from '../services/api'
import { ApiError } from '../lib/errors'

const STALE = 30_000

/** Don't retry things that cannot succeed on retry (404, validation errors). */
const retry = (count: number, err: unknown) => count < 1 && err instanceof ApiError && err.isRetryable

export const qk = {
  health: ['health'] as const,
  readiness: ['readiness'] as const,
  pipeline: ['pipeline-status'] as const,
  fleetSummary: (ds?: string) => ['fleet', 'summary', ds ?? null] as const,
  fleetList: (q: FleetQuery) => ['fleet', 'list', q] as const,
  machine: (id: string) => ['machine', id] as const,
  groups: ['groups'] as const,
  copilotStatus: ['copilot-status'] as const,
  benchmarks: ['benchmarks'] as const,
}

export const useHealth = () =>
  useQuery({ queryKey: qk.health, queryFn: ({ signal }) => systemApi.health(signal), refetchInterval: 60_000, retry: false, staleTime: 15_000 })

export const useReadiness = () =>
  useQuery({ queryKey: qk.readiness, queryFn: ({ signal }) => systemApi.readiness(signal), refetchInterval: 60_000, retry: false, staleTime: 15_000 })

export const usePipelineStatus = () =>
  useQuery({ queryKey: qk.pipeline, queryFn: ({ signal }) => systemApi.pipelineStatus(signal), staleTime: STALE, retry })

export const useFleetSummary = (datasetId?: string) =>
  useQuery({ queryKey: qk.fleetSummary(datasetId), queryFn: ({ signal }) => fleetApi.summary(datasetId, signal), staleTime: STALE, retry })

export const useFleetList = (q: FleetQuery) =>
  useQuery({ queryKey: qk.fleetList(q), queryFn: ({ signal }) => fleetApi.list(q, signal), staleTime: STALE, placeholderData: keepPreviousData, retry })

/** One big page of machines for selectors / search (backend max page_size is 100). */
export const useMachineDirectory = () =>
  useQuery({
    queryKey: ['fleet', 'directory'],
    queryFn: ({ signal }) => fleetApi.list({ page: 1, pageSize: 100, sortBy: 'machine_id', sortOrder: 'asc' }, signal),
    staleTime: 60_000,
    select: (d) => d.items,
    retry,
  })

export const useMachineDetail = (id: string) =>
  useQuery({ queryKey: [...qk.machine(id), 'detail'], queryFn: ({ signal }) => machineApi.detail(id, signal), enabled: !!id, staleTime: STALE, retry })
export const useMachineHistory = (id: string) =>
  useQuery({ queryKey: [...qk.machine(id), 'history'], queryFn: ({ signal }) => machineApi.history(id, signal), enabled: !!id, staleTime: STALE, retry })
export const useMachineSensors = (id: string) =>
  useQuery({ queryKey: [...qk.machine(id), 'sensors'], queryFn: ({ signal }) => machineApi.sensors(id, signal), enabled: !!id, staleTime: STALE, retry })
export const useMachineRootCause = (id: string) =>
  useQuery({ queryKey: [...qk.machine(id), 'root-cause'], queryFn: ({ signal }) => machineApi.rootCause(id, signal), enabled: !!id, staleTime: STALE, retry })
export const useMachineSignatures = (id: string) =>
  useQuery({ queryKey: [...qk.machine(id), 'signatures'], queryFn: ({ signal }) => machineApi.signatures(id, signal), enabled: !!id, staleTime: STALE, retry })
export const useMachineEvidence = (id: string) =>
  useQuery({ queryKey: [...qk.machine(id), 'evidence'], queryFn: ({ signal }) => machineApi.evidence(id, signal), enabled: !!id, staleTime: STALE, retry })

export const useComparison = (ids: string[]) =>
  useQuery({
    queryKey: ['compare', ...ids],
    queryFn: ({ signal }) => machineApi.compare(ids, signal),
    enabled: ids.length >= 2,
    staleTime: STALE,
    retry,
  })

export const useGroups = () => useQuery({ queryKey: qk.groups, queryFn: ({ signal }) => groupsApi.list(signal), staleTime: 60_000, retry })
export const useGroupDetail = (id: string | null) =>
  useQuery({ queryKey: ['group', id], queryFn: ({ signal }) => groupsApi.detail(id!, signal), enabled: !!id, staleTime: 60_000, retry })

export const useCopilotStatus = () =>
  useQuery({ queryKey: qk.copilotStatus, queryFn: ({ signal }) => copilotApi.status(signal), staleTime: 60_000, retry: false })

export const useBenchmarkHistory = () =>
  useQuery({ queryKey: qk.benchmarks, queryFn: ({ signal }) => benchmarkApi.history(signal), staleTime: STALE, retry })

export function useRunBenchmarks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { datasetId: string; repeats: number }) => benchmarkApi.run(v.datasetId, v.repeats),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.benchmarks }),
  })
}

export function useRunPipeline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (datasetId: string) => systemApi.runPipeline(datasetId),
    onSuccess: () => {
      // New analytics invalidate everything derived from them.
      void qc.invalidateQueries({ queryKey: ['fleet'] })
      void qc.invalidateQueries({ queryKey: ['machine'] })
      void qc.invalidateQueries({ queryKey: ['group'] })
      void qc.invalidateQueries({ queryKey: qk.groups })
      void qc.invalidateQueries({ queryKey: qk.pipeline })
      void qc.invalidateQueries({ queryKey: qk.readiness })
    },
  })
}
