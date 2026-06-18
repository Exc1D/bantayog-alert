import { useState, useEffect, useRef } from 'react'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { getStorage, ref, getDownloadURL } from 'firebase/storage'
import { db, hasFirebaseConfig } from '../services/firebase.js'
import type { PublicIncident, Filters } from '../components/MapTab/types.js'
import {
  filterPublicIncidentsByMunicipality,
  getPublicIncidentMediaCandidates,
  mapPublicIncidentData,
} from './public-incident-mapping.js'

// Always load the last 30 days — municipality filter is applied client-side.
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

async function resolveMediaUrls(
  incidentId: string,
  refs: string[],
  source: 'featured' | 'legacy',
): Promise<string[]> {
  const urls: string[] = []
  for (const mediaRef of refs) {
    try {
      const url = await getDownloadURL(ref(getStorage(), mediaRef))
      urls.push(url)
    } catch (e) {
      const label = source === 'featured' ? 'media' : 'path'
      const prefix = source === 'featured' ? 'featured media URL' : 'media URL'
      console.error(
        `Failed to resolve ${prefix} for incident ${incidentId}, ${label} ${mediaRef}`,
        e,
      )
    }
  }
  return urls
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
            const incident = mapPublicIncidentData(d.id, raw)
            if (!incident) {
              console.error('Skipping invalid public incident document', d.id)
              continue
            }
            const { featuredMediaIds, mediaRefs } = getPublicIncidentMediaCandidates(raw)
            let featuredMediaUrls: string[] = []
            if (featuredMediaIds.length > 0) {
              featuredMediaUrls = await resolveMediaUrls(d.id, featuredMediaIds, 'featured')
            }
            if (featuredMediaUrls.length === 0 && mediaRefs.length > 0) {
              featuredMediaUrls = await resolveMediaUrls(d.id, mediaRefs, 'legacy')
            }
            if (featuredMediaUrls.length > 0) {
              incident.featuredMediaUrls = featuredMediaUrls
            }
            all.push(incident)
          }
          const filtered = filterPublicIncidentsByMunicipality(all, filters.municipality)
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
