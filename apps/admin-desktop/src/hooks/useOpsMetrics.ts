/**
 * useOpsMetrics.ts
 *
 * Polls the getOpsMetrics callable every 60 seconds to provide
 * real-time aggregate dispatch metrics for the admin dashboard.
 */

import { useEffect, useState } from 'react'
import { callables } from '../services/callables'

export interface OpsMetricsResult {
  avgAcceptSeconds: number | null
  fcmSuccessRate: number
  totalDispatches: number
  acceptedCount: number
  declinedCount: number
  escalatedCount: number
  needsAdminCount: number
}

const POLL_INTERVAL_MS = 60_000

export function useOpsMetrics(timeRange: '1h' | '24h' | '7d' = '24h') {
  const [metrics, setMetrics] = useState<OpsMetricsResult | null>(null)
  const [lastPollAt, setLastPollAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchMetrics = async () => {
      try {
        const result = await callables.getOpsMetrics({ timeRange })
        if (!cancelled) {
          setMetrics({
            avgAcceptSeconds: result.metrics.avgAcceptSeconds,
            fcmSuccessRate: result.metrics.fcmSuccessRate,
            totalDispatches: result.metrics.totalDispatches,
            acceptedCount: result.metrics.acceptedCount,
            declinedCount: result.metrics.declinedCount,
            escalatedCount: result.metrics.escalatedCount,
            needsAdminCount: result.metrics.needsAdminCount,
          })
          setLastPollAt(Date.now())
          setLoading(false)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      }
    }

    void fetchMetrics()
    const interval = setInterval(() => {
      void fetchMetrics()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [timeRange])

  return { metrics, loading, error, lastPollAt }
}
