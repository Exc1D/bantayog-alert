import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db, hasFirebaseConfig } from '../services/firebase.js'
import type { PublicIncident, Filters } from '../components/MapTab/types.js'

function getWindowMs(w: Filters['window']): number {
  if (w === '24h') return 24 * 60 * 60 * 1000
  if (w === '7d') return 7 * 24 * 60 * 60 * 1000
  return 30 * 24 * 60 * 60 * 1000
}

function isPublicIncidentData(value: unknown): value is Omit<PublicIncident, 'id'> {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  const location = data.publicLocation
  return (
    typeof data.reportType === 'string' &&
    typeof data.severity === 'string' &&
    typeof data.status === 'string' &&
    typeof data.barangayId === 'string' &&
    typeof data.municipalityLabel === 'string' &&
    typeof data.submittedAt === 'number' &&
    Number.isFinite(data.submittedAt) &&
    !!location &&
    typeof location === 'object' &&
    typeof (location as Record<string, unknown>).lat === 'number' &&
    Number.isFinite((location as Record<string, unknown>).lat) &&
    typeof (location as Record<string, unknown>).lng === 'number' &&
    Number.isFinite((location as Record<string, unknown>).lng)
  )
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null)
    setLoading(true)

    if (!firebaseConfigured) {
      setIncidents([])
      setLoading(false)
      return undefined
    }

    const cutoff = Date.now() - getWindowMs(filters.window)
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
        const all = snap.docs.flatMap((d) => {
          const data: unknown = d.data()
          if (!isPublicIncidentData(data)) {
            console.error('Skipping invalid public incident document', d.id)
            return []
          }
          return [{ id: d.id, ...data }]
        })
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
      unsub()
    }
  }, [firebaseConfigured, filters.severity, filters.window])

  return { incidents, loading, error }
}
