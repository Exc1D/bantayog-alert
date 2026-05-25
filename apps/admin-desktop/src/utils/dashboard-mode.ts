export type DashboardMode = 'calm' | 'active' | 'degraded' | 'surge'

export const MODE_THRESHOLDS = {
  SURGE_STALLED_MIN: 1,
  SURGE_ACTIVE_INCIDENTS: 20,
  SURGE_FCM_RATE: 0.5,
  DEGRADED_STALE_MS: 300_000,
} as const

export function deriveDashboardMode(
  stalledCount: number,
  activeCount: number,
  fcmRate: number,
  hookErrors: string[],
  dataFreshnessMs: number,
): DashboardMode {
  // SURGE takes precedence over DEGRADED
  if (
    stalledCount >= MODE_THRESHOLDS.SURGE_STALLED_MIN ||
    activeCount > MODE_THRESHOLDS.SURGE_ACTIVE_INCIDENTS ||
    fcmRate < MODE_THRESHOLDS.SURGE_FCM_RATE
  ) {
    return 'surge'
  }
  if (hookErrors.length > 0 || dataFreshnessMs > MODE_THRESHOLDS.DEGRADED_STALE_MS) {
    return 'degraded'
  }
  if (activeCount > 0) {
    return 'active'
  }
  return 'calm'
}
