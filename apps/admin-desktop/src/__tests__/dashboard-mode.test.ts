import { describe, it, expect } from 'vitest'
import { deriveDashboardMode, MODE_THRESHOLDS } from '../utils/dashboard-mode'

describe('deriveDashboardMode', () => {
  it('returns calm when no incidents and no errors', () => {
    const result = deriveDashboardMode(0, 0, 1.0, [], 0)
    expect(result).toBe('calm')
  })

  it('returns active when incidents exist but below surge threshold', () => {
    const result = deriveDashboardMode(0, 5, 1.0, [], 0)
    expect(result).toBe('active')
  })

  it('returns surge when stalled dispatches exist', () => {
    const result = deriveDashboardMode(1, 0, 1.0, [], 0)
    expect(result).toBe('surge')
  })

  it('returns surge when active incidents > 20', () => {
    const result = deriveDashboardMode(0, 21, 1.0, [], 0)
    expect(result).toBe('surge')
  })

  it('returns surge when FCM rate < 0.5', () => {
    const result = deriveDashboardMode(0, 0, 0.4, [], 0)
    expect(result).toBe('surge')
  })

  it('returns degraded when hook errors exist', () => {
    const result = deriveDashboardMode(0, 0, 1.0, ['hook error'], 0)
    expect(result).toBe('degraded')
  })

  it('returns degraded when data is stale > 5min', () => {
    const result = deriveDashboardMode(0, 0, 1.0, [], MODE_THRESHOLDS.DEGRADED_STALE_MS + 1)
    expect(result).toBe('degraded')
  })

  it('surge takes precedence over degraded', () => {
    const result = deriveDashboardMode(
      1,
      0,
      1.0,
      ['hook error'],
      MODE_THRESHOLDS.DEGRADED_STALE_MS + 1,
    )
    expect(result).toBe('surge')
  })
})
