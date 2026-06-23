import type { DashboardMode } from './dashboard-mode'

export type DispatchKpiStatus = 'OK' | 'Watch' | 'Action required' | 'Unavailable'

export const DISPATCH_KPI_TARGETS = {
  activeMax: 20,
  avgAcceptSecondsMax: 300,
  fcmSuccessRateMin: 0.9,
} as const

export function getActiveKpiStatus(mode: DashboardMode): DispatchKpiStatus {
  if (mode === 'surge') return 'Action required'
  if (mode === 'active' || mode === 'degraded') return 'Watch'
  return 'OK'
}

export function getStalledKpiStatus(stalledCount: number): DispatchKpiStatus {
  return stalledCount === 0 ? 'OK' : 'Action required'
}

export function getAvgAcceptKpiStatus(seconds: number | null): DispatchKpiStatus {
  if (seconds === null) return 'Unavailable'
  if (seconds <= DISPATCH_KPI_TARGETS.avgAcceptSecondsMax) return 'OK'
  if (seconds <= 600) return 'Watch'
  return 'Action required'
}

export function getFcmKpiStatus(rate: number | null): DispatchKpiStatus {
  if (rate === null) return 'Unavailable'
  if (rate >= DISPATCH_KPI_TARGETS.fcmSuccessRateMin) return 'OK'
  if (rate >= 0.8) return 'Watch'
  return 'Action required'
}
