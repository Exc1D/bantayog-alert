export type Freshness = 'fresh' | 'degraded' | 'stale' | 'offline'

export function computeFreshness(lastTelemetryAt: number | null): Freshness {
  if (lastTelemetryAt == null) return 'offline'
  const ageMs = Date.now() - lastTelemetryAt
  if (ageMs < 30_000) return 'fresh'
  if (ageMs < 90_000) return 'degraded'
  if (ageMs < 300_000) return 'stale'
  return 'offline'
}
