import { useCallback, useEffect, useRef, useState } from 'react'
import { hasFirebaseConfig } from '../services/firebase.js'
import { subscribeSituationUpdates, type SituationUpdate } from '../services/situation-updates.js'

export interface SituationUpdateFilters {
  municipality: string
}

export function useSituationUpdates(filters: SituationUpdateFilters): {
  updates: SituationUpdate[]
  loading: boolean
  error: unknown
  lastUpdatedAt: number | null
  retry: () => void
} {
  const firebaseConfigured = hasFirebaseConfig()
  const [updates, setUpdates] = useState<SituationUpdate[]>([])
  const [loading, setLoading] = useState(firebaseConfigured)
  const [error, setError] = useState<unknown>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const versionRef = useRef(0)

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null)

    if (!firebaseConfigured) {
      setUpdates([])
      setLoading(false)
      setLastUpdatedAt(null)
      return undefined
    }

    setLoading(true)
    const currentVersion = ++versionRef.current
    const unsubscribe = subscribeSituationUpdates(
      (allUpdates) => {
        if (versionRef.current !== currentVersion) return
        const filtered = filters.municipality
          ? allUpdates.filter((update) => update.municipalityLabel === filters.municipality)
          : allUpdates
        setUpdates(filtered)
        setLastUpdatedAt(Date.now())
        setLoading(false)
      },
      (err) => {
        if (versionRef.current !== currentVersion) return
        setError(err)
        setLoading(false)
      },
    )
    return () => {
      unsubscribe()
    }
  }, [firebaseConfigured, filters.municipality, retryToken])

  return { updates, loading, error, lastUpdatedAt, retry }
}
