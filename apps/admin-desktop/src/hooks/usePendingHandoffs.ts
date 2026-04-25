import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, type Timestamp } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface PendingHandoff {
  id: string
  fromUid: string
  createdAt: Timestamp
  notes: string
  activeIncidentSnapshot: string[]
}

export function usePendingHandoffs(municipalityId: string | undefined) {
  const [handoffs, setHandoffs] = useState<PendingHandoff[]>([])

  useEffect(() => {
    if (!municipalityId) return
    const q = query(
      collection(db, 'shift_handoffs'),
      where('municipalityId', '==', municipalityId),
      where('status', '==', 'pending'),
    )
    return onSnapshot(q, (snap) => {
      setHandoffs(
        snap.docs.map((d) => ({
          id: d.id,
          fromUid: String(d.data().fromUid),
          createdAt: d.data().createdAt as Timestamp,
          notes: String(d.data().notes ?? ''),
          activeIncidentSnapshot: (d.data().activeIncidentSnapshot ?? []) as string[],
        })),
      )
    })
  }, [municipalityId])

  return handoffs
}
