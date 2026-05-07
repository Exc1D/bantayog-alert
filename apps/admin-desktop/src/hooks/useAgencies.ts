import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface Agency {
  id: string
  name: string
  type: string
}

export function useAgencies(municipalityId: string | undefined): Agency[] {
  const [agencies, setAgencies] = useState<Agency[]>([])

  useEffect(() => {
    if (!municipalityId) {
      queueMicrotask(() => {
        setAgencies([])
      })
      return
    }
    const q = query(collection(db, 'agencies'), where('municipalityId', '==', municipalityId))
    return onSnapshot(q, (snap) => {
      setAgencies(
        snap.docs.map((d) => ({
          id: d.id,
          name: String(d.data().name ?? d.id),
          type: String(d.data().type ?? 'unknown'),
        })),
      )
    })
  }, [municipalityId])

  return agencies
}
