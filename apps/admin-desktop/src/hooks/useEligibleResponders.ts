import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../app/firebase'
import { getDatabase, ref, onValue } from 'firebase/database'
import { firebaseApp } from '../app/firebase'

export type Freshness = 'fresh' | 'degraded' | 'stale' | 'offline'

function computeFreshness(lastTelemetryAt: number | null): Freshness {
  if (lastTelemetryAt == null) return 'offline'
  const ageMs = Date.now() - lastTelemetryAt
  if (ageMs < 30_000) return 'fresh'
  if (ageMs < 90_000) return 'degraded'
  if (ageMs < 300_000) return 'stale'
  return 'offline'
}

const FRESHNESS_ORDER: Record<Freshness, number> = {
  fresh: 0,
  degraded: 1,
  stale: 2,
  offline: 3,
}

export interface EligibleResponder {
  uid: string
  displayName: string
  agencyId: string
  availabilityStatus: string
  lastTelemetryAt: number | null
  freshness: Freshness
}

export function useEligibleResponders(municipalityId: string | undefined) {
  const [responders, setResponders] = useState<Record<string, EligibleResponder>>({})
  const [shift, setShift] = useState<Record<string, { isOnShift: boolean }>>({})

  useEffect(() => {
    if (!municipalityId) {
      queueMicrotask(() => {
        setResponders({})
      })
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
        const lastTelemetryAt =
          typeof data.lastTelemetryAt === 'number' ? data.lastTelemetryAt : null
        out[d.id] = {
          uid: d.id,
          displayName: String(data.displayName ?? d.id),
          agencyId: String(data.agencyId ?? 'unknown'),
          availabilityStatus: String(data.availabilityStatus ?? 'unknown'),
          lastTelemetryAt,
          freshness: computeFreshness(lastTelemetryAt),
        }
      })
      setResponders(out)
    })
  }, [municipalityId])

  useEffect(() => {
    if (!municipalityId) {
      queueMicrotask(() => {
        setShift({})
      })
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
    .sort((a, b) => {
      // Available first
      const aAvailable = a.availabilityStatus === 'available' ? 0 : 1
      const bAvailable = b.availabilityStatus === 'available' ? 0 : 1
      if (aAvailable !== bAvailable) return aAvailable - bAvailable
      // Then by freshness
      const aFresh = FRESHNESS_ORDER[a.freshness]
      const bFresh = FRESHNESS_ORDER[b.freshness]
      if (aFresh !== bFresh) return aFresh - bFresh
      // Then by name
      return a.displayName.localeCompare(b.displayName)
    })
  return eligible
}
