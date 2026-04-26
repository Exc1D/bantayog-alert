import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../app/firebase'

import { computeFreshness, type Freshness } from '../utils/freshness'

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
  const [responders, setResponders] = useState<EligibleResponder[]>([])

  useEffect(() => {
    if (!municipalityId) {
      queueMicrotask(() => {
        setResponders([])
      })
      return
    }
    const q = query(
      collection(db, 'responders'),
      where('municipalityId', '==', municipalityId),
      where('isActive', '==', true),
    )
    return onSnapshot(q, (snap) => {
      const eligible = snap.docs
        .map((d) => {
          const data = d.data()
          const lastTelemetryAt =
            typeof data.lastTelemetryAt === 'number' ? data.lastTelemetryAt : null
          return {
            uid: d.id,
            displayName: String(data.displayName ?? d.id),
            agencyId: String(data.agencyId ?? 'unknown'),
            availabilityStatus: String(data.availabilityStatus ?? 'unknown'),
            lastTelemetryAt,
            freshness: computeFreshness(lastTelemetryAt),
          }
        })
        .filter((r) => r.availabilityStatus !== 'off_duty')
        .sort((a, b) => {
          const aAvailable = a.availabilityStatus === 'available' ? 0 : 1
          const bAvailable = b.availabilityStatus === 'available' ? 0 : 1
          if (aAvailable !== bAvailable) return aAvailable - bAvailable
          const aFresh = FRESHNESS_ORDER[a.freshness]
          const bFresh = FRESHNESS_ORDER[b.freshness]
          if (aFresh !== bFresh) return aFresh - bFresh
          return a.displayName.localeCompare(b.displayName)
        })
      setResponders(eligible)
    })
  }, [municipalityId])

  return responders
}
