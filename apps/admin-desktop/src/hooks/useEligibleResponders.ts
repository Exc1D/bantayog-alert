import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../app/firebase'
import { getDatabase, ref, onValue } from 'firebase/database'
import { firebaseApp } from '../app/firebase'

export interface EligibleResponder {
  uid: string
  displayName: string
  agencyId: string
}

export function useEligibleResponders(municipalityId: string | undefined) {
  const [responders, setResponders] = useState<Record<string, EligibleResponder>>({})
  const [shift, setShift] = useState<Record<string, { isOnShift: boolean }>>({})

  useEffect(() => {
    if (!municipalityId) {
      setResponders({})
      return
    }
    const q = query(
      collection(db, 'responders'),
      where('municipalityId', '==', municipalityId),
      where('isActive', '==', true),
    )
    return onSnapshot(q, (snap) => {
      const out: Record<string, EligibleResponder> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        out[d.id] = {
          uid: d.id,
          displayName: String(data.displayName ?? d.id),
          agencyId: String(data.agencyId ?? 'unknown'),
        }
      })
      setResponders(out)
    })
  }, [municipalityId])

  useEffect(() => {
    if (!municipalityId) {
      setShift({})
      return
    }
    const rtdb = getDatabase(firebaseApp)
    const node = ref(rtdb, `/responder_index/${municipalityId}`)
    const unsub = onValue(node, (s) => {
      const snapVal = s.val()
      setShift(snapVal !== null ? (snapVal as Record<string, { isOnShift: boolean }>) : {})
    })
    return unsub
  }, [municipalityId])

  const eligible = Object.values(responders)
    .filter((r) => shift[r.uid]?.isOnShift === true)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
  return eligible
}
