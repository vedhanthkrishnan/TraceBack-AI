import { CircleCheck, CircleHelp, Eye, OctagonAlert, type LucideIcon } from 'lucide-react'
import { P } from './palette'

export interface RiskStyle {
  label: string
  icon: LucideIcon
  text: string
  bg: string
  border: string
  hex: string
  rank: number
}

/** Risk is conveyed by label + icon + colour — never colour alone. */
export const RISK: Record<string, RiskStyle> = {
  CRITICAL: { label: 'Critical', icon: OctagonAlert, text: 'text-critical-fg', bg: 'bg-critical/10', border: 'border-critical/40', hex: P.red, rank: 3 },
  WATCH: { label: 'Watch', icon: Eye, text: 'text-watch-fg', bg: 'bg-watch/10', border: 'border-watch/40', hex: P.amber, rank: 2 },
  HEALTHY: { label: 'Healthy', icon: CircleCheck, text: 'text-healthy-fg', bg: 'bg-healthy/10', border: 'border-healthy/40', hex: P.sage, rank: 1 },
  INSUFFICIENT_DATA: { label: 'Insufficient data', icon: CircleHelp, text: 'text-unknown', bg: 'bg-unknown/10', border: 'border-unknown/40', hex: P.unknown, rank: 0 },
}

export const riskStyle = (category: string): RiskStyle =>
  RISK[category] ?? { label: category, icon: CircleHelp, text: 'text-unknown', bg: 'bg-unknown/10', border: 'border-unknown/40', hex: P.unknown, rank: 0 }
