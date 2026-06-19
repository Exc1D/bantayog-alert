import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db, hasFirebaseConfig } from '../services/firebase.js'
import type { PublicIncident } from '../components/MapTab/types.js'
import { isPublicIncidentData } from './public-incident-guard.js'

export function useIncident(id: string): {
  incident: PublicIncident | null
  loading: boolean
  error: unknown
} {
  const firebaseConfigured = hasFirebaseConfig()
  const [incident, setIncident] = useState<PublicIncident | null>(null)
  const [loading, setLoading] = useState(firebaseConfigured && id.length > 0)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIncident(null)

      setLoading(false)
      return
    }

    setError(null)

    setLoading(true)

    if (!firebaseConfigured) {
      setIncident(null)

      setLoading(false)
      return
    }

    let cancelled = false

    void getDoc(doc(db(), 'reports', id))
      .then((snap) => {
        if (cancelled) return
        if (!snap.exists()) {
          setIncident(null)
          setLoading(false)
          return
        }
        const data: unknown = snap.data()
        if (!isPublicIncidentData(data)) {
          setError(new Error('Incident data is invalid or not public'))
          setLoading(false)
          return
        }
        setIncident({ id: snap.id, ...data })
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [firebaseConfigured, id])

  return { incident, loading, error }
}
