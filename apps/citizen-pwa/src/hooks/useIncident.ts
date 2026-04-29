import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db, hasFirebaseConfig } from '../services/firebase.js'
import type { PublicIncident } from '../components/MapTab/types.js'

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

    void getDoc(doc(db(), 'reports', id))
      .then((snap) => {
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
        setError(err)
        setLoading(false)
      })
  }, [firebaseConfigured, id])

  return { incident, loading, error }
}
