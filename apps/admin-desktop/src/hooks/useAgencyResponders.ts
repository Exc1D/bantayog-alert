import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface AgencyResponder {
  uid: string
  displayName: string
  agencyId: string
  availabilityStatus: string
  lastTelemetryAt: number | null
}

/**
 * Subscribes to on-duty responders within the given agency.
 * Only returns responders where availabilityStatus !== 'off_duty'.
 * Agency admins can only dispatch their own agency's responders.
 */
export function useAgencyResponders(agencyId: string | undefined): AgencyResponder[] {
  const [responders, setResponders] = useState<AgencyResponder[]>([])

  useEffect(() => {
    if (!agencyId) {
      queueMicrotask(() => {
        setResponders([])
      })
      return
    }

    const q = query(
      collection(db, 'responders'),
      where('agencyId', '==', agencyId),
      where('isActive', '==', true),
    )

    return onSnapshot(q, (snap) => {
      const eligible = snap.docs
        .map((d) => {
          const data = d.data()
          return {
            uid: d.id,
            displayName: String(data.displayName ?? d.id),
            agencyId: String(data.agencyId ?? agencyId),
            availabilityStatus: String(data.availabilityStatus ?? 'unknown'),
            lastTelemetryAt: typeof data.lastTelemetryAt === 'number' ? data.lastTelemetryAt : null,
          }
        })
        .filter((r) => r.availabilityStatus !== 'off_duty')
        .sort((a, b) => {
          const aAvail = a.availabilityStatus === 'available' ? 0 : 1
          const bAvail = b.availabilityStatus === 'available' ? 0 : 1
          if (aAvail !== bAvail) return aAvail - bAvail
          const aTime = a.lastTelemetryAt ?? 0
          const bTime = b.lastTelemetryAt ?? 0
          return bTime - aTime
        })
      setResponders(eligible)
    })
  }, [agencyId])

  return responders
}
