import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface ResponderProfile {
  displayName: string
  responderType: string
  agencyId: string
  stationLabel?: string
  phone?: string
  availabilityStatus: string
  specializations?: string[]
}

export function useResponderProfile(uid: string | undefined) {
  const [profile, setProfile] = useState<ResponderProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!uid) {
      queueMicrotask(() => {
        setProfile(null)
        setLoading(false)
      })
      return
    }

    const ref = doc(db, 'responders', uid)
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setProfile(null)
          setLoading(false)
          setError(null)
          return
        }
        const d = snap.data()
        const next: ResponderProfile = {
          displayName: String(d.displayName ?? 'Responder'),
          responderType: String(d.responderType ?? 'general'),
          agencyId: String(d.agencyId ?? ''),
          availabilityStatus: String(d.availabilityStatus ?? 'available'),
        }
        if (d.stationLabel != null) next.stationLabel = String(d.stationLabel)
        if (d.phone != null) next.phone = String(d.phone)
        if (Array.isArray(d.specializations)) {
          next.specializations = (d.specializations as unknown[]).map(String)
        }
        setProfile(next)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[useResponderProfile] listener error:', err)
        setError(err.message)
        setLoading(false)
      },
    )
  }, [uid, retryKey])

  const refetch = () => {
    setRetryKey((k) => k + 1)
  }

  return { profile, loading, error, refetch }
}
