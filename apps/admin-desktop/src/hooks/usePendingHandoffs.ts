import { useEffect, useState } from 'react'
import { Timestamp, collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface PendingHandoff {
  id: string
  fromUid: string
  createdAt: Timestamp
  notes: string
  activeIncidentIds: string[]
}

export function usePendingHandoffs(municipalityId: string | undefined) {
  const [handoffs, setHandoffs] = useState<PendingHandoff[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!municipalityId) {
      queueMicrotask(() => {
        setHandoffs([])
        setError(null)
      })
      return
    }

    // Clear before subscribing
    queueMicrotask(() => {
      setHandoffs([])
      setError(null)
    })

    const q = query(
      collection(db, 'shift_handoffs'),
      where('municipalityId', '==', municipalityId),
      where('status', '==', 'pending'),
    )
    return onSnapshot(
      q,
      (snap) => {
        setHandoffs(
          snap.docs.map((d) => {
            const raw = d.data()
            const activeIncidentIds = Array.isArray(raw.activeIncidentIds)
              ? raw.activeIncidentIds.filter((id): id is string => typeof id === 'string')
              : []
            return {
              id: d.id,
              fromUid: typeof raw.fromUid === 'string' ? raw.fromUid : '',
              createdAt: raw.createdAt instanceof Timestamp ? raw.createdAt : Timestamp.now(),
              notes: typeof raw.notes === 'string' ? raw.notes : '',
              activeIncidentIds,
            }
          }),
        )
        setError(null)
      },
      (err) => {
        setHandoffs([]) // Clear on error
        setError(err.message)
      },
    )
  }, [municipalityId])

  return { handoffs, error }
}
