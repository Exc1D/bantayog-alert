import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  type Firestore,
  type Query,
} from 'firebase/firestore'
import { useAuth } from '@bantayog/shared-ui'

export interface ResponderFleetMember {
  uid: string
  displayName: string
  availabilityStatus: 'available' | 'unavailable' | 'off_duty'
  lastSeenAt: number
  municipalityId?: string
  agencyId?: string
  onlineStatus: 'online' | 'away' | 'offline'
}

interface ResponderDoc {
  displayName?: string
  availabilityStatus?: 'available' | 'unavailable' | 'off_duty'
  lastSeenAt?: number
  municipalityId?: string
  agencyId?: string
}

const FIVE_MINUTES_MS = 5 * 60 * 1000
const THIRTY_MINUTES_MS = 30 * 60 * 1000

function deriveOnlineStatus(lastSeenAt: number): ResponderFleetMember['onlineStatus'] {
  const elapsed = Date.now() - lastSeenAt
  if (elapsed < FIVE_MINUTES_MS) return 'online'
  if (elapsed < THIRTY_MINUTES_MS) return 'away'
  return 'offline'
}

const ALLOWED_ADMIN_ROLES = new Set(['provincial_superadmin', 'municipal_admin', 'agency_admin'])

export function useResponderFleet(db: Firestore) {
  const { claims, loading: authLoading } = useAuth()
  const role = typeof claims?.role === 'string' ? claims.role : null
  const municipalityId = typeof claims?.municipalityId === 'string' ? claims.municipalityId : null
  const agencyId = typeof claims?.agencyId === 'string' ? claims.agencyId : null

  const [responders, setResponders] = useState<ResponderFleetMember[]>([])
  const [error, setError] = useState<string | null>(null)

  // Derive loading from authLoading — no setState in effect
  const loading = authLoading

  useEffect(() => {
    if (authLoading) return

    const isSupportedRole = role !== null && ALLOWED_ADMIN_ROLES.has(role)

    if (
      !isSupportedRole ||
      (role === 'municipal_admin' && !municipalityId) ||
      (role === 'agency_admin' && !agencyId)
    ) {
      // Clear stale data and set error — one-time derivation from auth claims
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResponders([])
      setError('unauthorized')
      return
    }

    setError(null)

    const respondersCol = collection(db, 'responders')
    let respondersRef: Query = respondersCol

    if (role === 'municipal_admin' && municipalityId) {
      respondersRef = query(respondersRef, where('municipalityId', '==', municipalityId))
    } else if (role === 'agency_admin' && agencyId) {
      respondersRef = query(respondersRef, where('agencyId', '==', agencyId))
    }

    respondersRef = query(
      respondersRef,
      where('availabilityStatus', '==', 'available'),
      where('accountStatus', '==', 'active'),
      orderBy('lastSeenAt', 'desc'),
    )

    const unsubscribe = onSnapshot(
      respondersRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => {
          const doc = d.data() as ResponderDoc
          const lastSeenAt = doc.lastSeenAt ?? 0
          const member: ResponderFleetMember = {
            uid: d.id,
            displayName: doc.displayName ?? '',
            availabilityStatus: doc.availabilityStatus ?? 'unavailable',
            lastSeenAt,
            onlineStatus: deriveOnlineStatus(lastSeenAt),
          }
          if (doc.municipalityId !== undefined) {
            member.municipalityId = doc.municipalityId
          }
          if (doc.agencyId !== undefined) {
            member.agencyId = doc.agencyId
          }
          return member
        })
        setResponders(data)
        setError(null)
      },
      (err) => {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [db, authLoading, role, municipalityId, agencyId])

  return { responders, loading, error }
}
