import { useState, useEffect, useRef } from 'react'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { getStorage, ref, getDownloadURL } from 'firebase/storage'
import { db, hasFirebaseConfig } from '../services/firebase.js'
import type { PublicIncident, Filters } from '../components/MapTab/types.js'
import { isPublicIncidentData } from './public-incident-guard.js'

// Always load the last 30 days — municipality filter is applied client-side.
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export function usePublicIncidents(filters: Filters): {
  incidents: PublicIncident[]
  loading: boolean
  error: unknown
} {
  const firebaseConfigured = hasFirebaseConfig()
  const [incidents, setIncidents] = useState<PublicIncident[]>([])
  const [loading, setLoading] = useState(firebaseConfigured)
  const [error, setError] = useState<unknown>(null)
  const versionRef = useRef(0)

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

    const currentVersion = ++versionRef.current
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
            const featuredMediaIds = doc.featuredMediaIds
            if (Array.isArray(featuredMediaIds) && featuredMediaIds.length > 0) {
              const urls: string[] = []
              for (const id of (featuredMediaIds as unknown[]).slice(0, 3)) {
                if (typeof id !== 'string') continue
                try {
                  const url = await getDownloadURL(ref(getStorage(), id))
                  urls.push(url)
                } catch (e) {
                  console.error(
                    `Failed to resolve featured media URL for incident ${d.id}, media ${id}`,
                    e,
                  )
                }
              }
              if (urls.length > 0) {
                featuredMediaUrls = urls
              }
            }
            // Fallback to legacy mediaRefs only when featuredMediaIds yields nothing
            if (!featuredMediaUrls) {
              const mediaRefs = doc.mediaRefs
              if (Array.isArray(mediaRefs) && mediaRefs.length > 0) {
                const urls: string[] = []
                for (const path of mediaRefs.slice(0, 3)) {
                  if (typeof path !== 'string') continue
                  try {
                    const url = await getDownloadURL(ref(getStorage(), path))
                    urls.push(url)
                  } catch (e) {
                    console.error(
                      `Failed to resolve media URL for incident ${d.id}, path ${path}`,
                      e,
                    )
                  }
                }
                if (urls.length > 0) {
                  featuredMediaUrls = urls
                }
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
          // Ignore stale snapshots
          if (versionRef.current !== currentVersion) return
          setError(null)
          setIncidents(filtered)
          setLoading(false)
        }
        void buildIncidents()
      },
      (err) => {
        if (versionRef.current !== currentVersion) return
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
