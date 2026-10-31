import type { CopilotStatus } from '../schemas/api'

/**
 * The backend's `mock_fallback_active` flag is false even for its built-in offline engine (that provider reports
 * is_configured=true), so the provider name is also checked before claiming a live LLM is in use.
 */
export function isOfflineEngine(s: Pick<CopilotStatus, 'provider' | 'mock_fallback_active'> | undefined | null): boolean {
  if (!s) return false
  return s.mock_fallback_active || /offline|mock/i.test(s.provider)
}
