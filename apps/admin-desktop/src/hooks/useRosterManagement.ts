import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../app/firebase'
import { callables } from '../services/callables'

export type ResponderType = 'POL' | 'FIR' | 'MED' | 'ENG' | 'SAR' | 'SW' | 'GEN'

export interface RosterResponder {
  uid: string
  displayName: string
  availabilityStatus: string
  lastTelemetryAt: number | null
  municipalityId: string
  responderType: ResponderType
  specializations: string[]
}

export function useRosterManagement(agencyId: string | undefined) {
  const [responders, setResponders] = useState<RosterResponder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    queueMicrotask(() => {
      setResponders([])
      setError(null)
    })

    if (!agencyId) {
      queueMicrotask(() => {
        setLoading(false)
      })
      return
    }

    queueMicrotask(() => {
      setLoading(true)
    })

    const q = query(collection(db, 'responders'), where('agencyId', '==', agencyId))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const VALID_TYPES: ResponderType[] = ['POL', 'FIR', 'MED', 'ENG', 'SAR', 'SW', 'GEN']
        const docs: RosterResponder[] = snapshot.docs.map((d) => {
          const data = d.data()
          const rawType = String(data.responderType ?? 'GEN')
          return {
            uid: d.id,
            displayName: String(data.displayName ?? d.id),
            availabilityStatus: String(data.availabilityStatus ?? 'unknown'),
            lastTelemetryAt: typeof data.lastTelemetryAt === 'number' ? data.lastTelemetryAt : null,
            municipalityId: String(data.municipalityId ?? ''),
            responderType: VALID_TYPES.includes(rawType as ResponderType)
              ? (rawType as ResponderType)
              : 'GEN',
            specializations: Array.isArray(data.specializations)
              ? (data.specializations as unknown[]).filter((s) => typeof s === 'string')
              : [],
          }
        })
        setResponders(docs)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [agencyId])

  const suspendResponder = async (uid: string) => {
    await callables.suspendResponder({ uid, idempotencyKey: crypto.randomUUID() })
  }

  const revokeResponder = async (uid: string) => {
    await callables.revokeResponder({ uid, idempotencyKey: crypto.randomUUID() })
  }

  const bulkAvailabilityOverride = async (
    uids: string[],
    status: 'available' | 'unavailable' | 'off_duty',
  ) => {
    await callables.bulkAvailabilityOverride({
      uids,
      status,
      idempotencyKey: crypto.randomUUID(),
    })
  }

  return { responders, loading, error, suspendResponder, revokeResponder, bulkAvailabilityOverride }
}
