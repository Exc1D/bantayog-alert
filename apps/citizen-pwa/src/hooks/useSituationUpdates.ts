import { useEffect, useRef, useState } from 'react'
import { hasFirebaseConfig } from '../services/firebase.js'
import { subscribeSituationUpdates, type SituationUpdate } from '../services/situation-updates.js'

export interface SituationUpdateFilters {
  municipality: string
}

export function useSituationUpdates(filters: SituationUpdateFilters): {
  updates: SituationUpdate[]
  loading: boolean
  error: unknown
} {
  const firebaseConfigured = hasFirebaseConfig()
  const [updates, setUpdates] = useState<SituationUpdate[]>([])
  const [loading, setLoading] = useState(firebaseConfigured)
  const [error, setError] = useState<unknown>(null)
  const versionRef = useRef(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null)

    if (!firebaseConfigured) {
      setUpdates([])
      setLoading(false)
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
  }, [firebaseConfigured, filters.municipality])

  return { updates, loading, error }
}
