import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore'
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
    const q = query(
      collection(db, 'shift_handoffs'),
      where('municipalityId', '==', municipalityId),
      where('status', '==', 'pending'),
    )
    return onSnapshot(
      q,
      (snap) => {
        setHandoffs(
          snap.docs.map((d) => ({
            id: d.id,
            fromUid: String(d.data().fromUid),
            createdAt: (d.data().createdAt as Timestamp | undefined) ?? Timestamp.now(),
            notes: String(d.data().notes ?? ''),
            activeIncidentIds: (d.data().activeIncidentIds ?? []) as string[],
          })),
        )
        setError(null)
      },
      (err) => {
        setError(err.message)
      },
    )
  }, [municipalityId])

  return { handoffs, error }
}
