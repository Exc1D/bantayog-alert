import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db, hasFirebaseConfig } from '../services/firebase.js'
import type { PublicIncident, Filters } from '../components/MapTab/types.js'

function windowMs(w: Filters['window']): number {
  if (w === '24h') return 24 * 60 * 60 * 1000
  if (w === '7d') return 7 * 24 * 60 * 60 * 1000
  return 30 * 24 * 60 * 60 * 1000
}

export function usePublicIncidents(filters: Filters): {
  incidents: PublicIncident[]
  loading: boolean
  error: unknown
} {
  const firebaseConfigured = hasFirebaseConfig()
  const [incidents, setIncidents] = useState<PublicIncident[]>([])
  const [loading, setLoading] = useState(firebaseConfigured)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setError(null)
      setLoading(true)
    }, 0)

    if (!firebaseConfigured) {
      const resetTimeout = window.setTimeout(() => {
        setError(null)
        setIncidents([])
        setLoading(false)
      }, 0)
      window.clearTimeout(timeout)
      return () => {
        window.clearTimeout(resetTimeout)
      }
    }

    const cutoff = Date.now() - windowMs(filters.window)
    const q = query(
      collection(db(), 'reports'),
      where('visibilityClass', '==', 'public_alertable'),
      where('submittedAt', '>=', cutoff),
      orderBy('submittedAt', 'desc'),
      limit(100),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PublicIncident, 'id'>),
        }))
        const filtered =
          filters.severity === 'all' ? all : all.filter((doc) => doc.severity === filters.severity)
        setError(null)
        setIncidents(filtered)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return () => {
      window.clearTimeout(timeout)
      unsub()
    }
  }, [firebaseConfigured, filters.severity, filters.window])

  return { incidents, loading, error }
}
