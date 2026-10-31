const env = import.meta.env

export type DataMode = 'live' | 'mock'

export const config = {
  apiBaseUrl: (env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000/api/v1',
  dataMode: ((env.VITE_DATA_MODE as string | undefined) === 'mock' ? 'mock' : 'live') as DataMode,
  timeoutMs: Number(env.VITE_REQUEST_TIMEOUT_MS ?? 15000),
  /** Configured fallback thresholds on the 0-100 RISK score. The backend does not expose these. */
  watchRiskThreshold: Number(env.VITE_WATCH_RISK_THRESHOLD ?? 45),
  criticalRiskThreshold: Number(env.VITE_CRITICAL_RISK_THRESHOLD ?? 75),
  appVersion: '1.0.0',
}

export const isMockMode = config.dataMode === 'mock'
