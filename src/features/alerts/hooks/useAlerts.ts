/**
 * useAlerts Hook
 *
 * Subscribes to government alerts from Firestore using real-time onSnapshot.
 * Supports filtering by municipality, role, severity, and alert type.
 *
 * Expiration filtering is applied server-side by alert.service.ts on every
 * snapshot update — this hook receives already-filtered active alerts.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { subscribeToAlerts, subscribeToAlertsByMunicipality } from '../services/alert.service'
import { cacheAlerts, loadCachedAlerts } from './alertsCache'
import type { Alert } from '@/shared/types/firestore.types'
import type { UserRole } from '@/shared/types/auth.types'

export interface UseAlertsOptions {
  municipality?: string
  role?: UserRole
  severity?: Alert['severity']
  type?: Alert['type']
}

export interface UseAlertsResult {
  alerts: Alert[]
  isLoading: boolean
  isError: boolean
  isRefetching: boolean
  refetch: () => void
  error: Error | null
}

export function useAlerts(options: UseAlertsOptions = {}): UseAlertsResult {
  const { municipality, role, severity, type } = options

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [isRefetching, setIsRefetching] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Ref to hold the last known alert set — needed by handleError since state updates are async
  const latestAlertsRef = useRef<Alert[]>([])

  useEffect(() => {
    latestAlertsRef.current = alerts
  }, [alerts])

  useEffect(() => {
    const unsubscribers: (() => void)[] = []

    async function handleError(err: Error) {
      // Persist current alerts to cache before surfacing the error
      cacheAlerts(latestAlertsRef.current).catch(() => {/* fire-and-forget */})
      // Load cached alerts as fallback so UI isn't blank
      const cached = await loadCachedAlerts()
      if (cached.length > 0) setAlerts(cached)
      setIsError(true)
      setError(err)
      setIsLoading(false)
      // Stop all onSnapshot listeners — they are no longer needed once an error has been surfaced
      unsubscribers.forEach((unsub) => unsub())
    }

    function handleFirstSnapshot() {
      setIsLoading(false)
      setIsRefetching(false)
    }

    setIsLoading(true)
    setIsError(false)
    setError(null)
    setAlerts([])

    const useDualSubscription = Boolean(municipality && role)

    if (useDualSubscription) {
      // Run two listeners in parallel — merge + dedupe results
      setIsRefetching(true)

      let bothCalled = 0
      const total = 2

      function checkDone() {
        bothCalled++
        if (bothCalled === total) handleFirstSnapshot()
      }

      const unsubAlerts = subscribeToAlerts(
        { severity, type, role },
        (alertsFromRole) => {
          setAlerts((prev) => {
            // Merge new role alerts with municipality alerts, dedupe
            const merged = [...prev, ...alertsFromRole]
            const seen = new Set<string>()
            return merged.filter((a) => {
              if (seen.has(a.id)) return false
              seen.add(a.id)
              return true
            })
          })
          checkDone()
        },
        handleError
      )

      const unsubMunicipality = subscribeToAlertsByMunicipality(
        municipality ?? '',
        (alertsFromMunicipality) => {
          setAlerts((prev) => {
            const merged = [...prev, ...alertsFromMunicipality]
            const seen = new Set<string>()
            return merged.filter((a) => {
              if (seen.has(a.id)) return false
              seen.add(a.id)
              return true
            })
          })
          checkDone()
        },
        handleError
      )

      unsubscribers.push(unsubAlerts, unsubMunicipality)
    } else if (municipality) {
      const unsub = subscribeToAlertsByMunicipality(
        municipality,
        (alertsFromMunicipality) => {
          setAlerts(alertsFromMunicipality)
          handleFirstSnapshot()
        },
        handleError
      )
      unsubscribers.push(unsub)
    } else {
      const unsub = subscribeToAlerts(
        { severity, type },
        (alertsFromSubscription) => {
          setAlerts(alertsFromSubscription)
          handleFirstSnapshot()
        },
        handleError
      )
      unsubscribers.push(unsub)
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [municipality, role, severity, type])

  const refetch = useCallback(() => {
    // onSnapshot pushes updates automatically — refetch is a no-op here.
    // Exists only for API compatibility with callers that expect a refetch fn.
  }, [])

  return { alerts, isLoading, isError, isRefetching, refetch, error }
}
