import { useEffect, useState, useCallback } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../app/firebase'

export type ResponderAvailabilityStatus = 'available' | 'unavailable' | 'off_duty'

export interface UseResponderAvailabilityReturn {
  status: ResponderAvailabilityStatus | null
  loading: boolean
  error: string | null
  setAvailability: (status: ResponderAvailabilityStatus, reason?: string) => Promise<void>
}

function mapFromFirestore(raw: string): ResponderAvailabilityStatus | null {
  if (raw === 'on_duty') return 'available'
  if (raw === 'available' || raw === 'unavailable' || raw === 'off_duty') return raw
  return null
}

export function useResponderAvailability(uid: string | undefined): UseResponderAvailabilityReturn {
  const [status, setStatus] = useState<ResponderAvailabilityStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) {
      queueMicrotask(() => {
        setStatus(null)
        setLoading(false)
        setError(null)
      })
      return
    }

    const ref = doc(db, 'responders', uid)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          const mapped = mapFromFirestore(String(data.availabilityStatus ?? ''))
          setStatus(mapped)
        } else {
          setStatus(null)
        }
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[useResponderAvailability] Firestore listener error:', err)
        setStatus(null)
        setLoading(false)
        setError(err.message)
      },
    )
    return unsub
  }, [uid])

  const setAvailability = useCallback(
    async (newStatus: ResponderAvailabilityStatus, reason?: string): Promise<void> => {
      if (!uid) throw new Error('auth_required')
      if (newStatus !== 'available' && !reason) {
        throw new Error('reason_required')
      }

      const ref = doc(db, 'responders', uid)
      await setDoc(
        ref,
        {
          availabilityStatus: newStatus,
          ...(reason ? { availabilityReason: reason } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    },
    [uid],
  )

  return { status, loading, error, setAvailability }
}
