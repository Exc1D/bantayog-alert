import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { getStorage, ref, getDownloadURL } from 'firebase/storage'
import { db, hasFirebaseConfig } from '../services/firebase.js'
import type { PublicIncident, Filters } from '../components/MapTab/types.js'

// Always load the last 30 days — municipality filter is applied client-side.
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

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

    const cutoff = Date.now() - THIRTY_DAYS_MS
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
        async function buildIncidents() {
          const all: PublicIncident[] = []
          for (const d of snap.docs) {
            const raw: unknown = d.data()
            if (!isPublicIncidentData(raw)) {
              console.error('Skipping invalid public incident document', d.id)
              continue
            }
            const doc = raw as Record<string, unknown>
            let featuredMediaUrls: string[] | undefined
            const mediaRefs = doc.mediaRefs
            if (Array.isArray(mediaRefs) && mediaRefs.length > 0) {
              const urls: string[] = []
              for (const path of mediaRefs.slice(0, 3)) {
                if (typeof path !== 'string') continue
                try {
                  const url = await getDownloadURL(ref(getStorage(), path))
                  urls.push(url)
                } catch {
                  /* skip failed URLs */
                }
              }
              if (urls.length > 0) {
                featuredMediaUrls = urls
              }
            }
            const incident: PublicIncident = {
              id: d.id,
              ...raw,
            }
            if (featuredMediaUrls) {
              incident.featuredMediaUrls = featuredMediaUrls
            }
            all.push(incident)
          }
          const filtered = filters.municipality
            ? all.filter((i) => i.municipalityLabel === filters.municipality)
            : all
          setError(null)
          setIncidents(filtered)
          setLoading(false)
        }
        void buildIncidents()
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return () => {
      unsub()
    }
  }, [firebaseConfigured, filters.municipality])

  return { incidents, loading, error }
}
