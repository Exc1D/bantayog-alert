import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy, type Firestore } from 'firebase/firestore'
import { useAuth } from '@bantayog/shared-ui'
import { isAuthorized, scopeQuery, snapshotError } from './admin-scope'

export interface ResponderFleetMember {
  uid: string
  displayName: string
  availabilityStatus: 'available' | 'unavailable' | 'off_duty'
  lastActivityAt: number
  municipalityId?: string
  agencyId?: string
  onlineStatus: 'online' | 'away' | 'offline'
}

interface ResponderDoc {
  displayName?: string
  availabilityStatus?: 'available' | 'unavailable' | 'off_duty'
  lastSeenAt?: number
  lastTelemetryAt?: number
  updatedAt?: number
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

export function useResponderFleet(db: Firestore) {
  const { claims, loading: authLoading } = useAuth()
  const role = typeof claims?.role === 'string' ? claims.role : null
  const municipalityId = typeof claims?.municipalityId === 'string' ? claims.municipalityId : null
  const agencyId = typeof claims?.agencyId === 'string' ? claims.agencyId : null

  const [responders, setResponders] = useState<ResponderFleetMember[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    if (!isAuthorized(role, municipalityId, agencyId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResponders([])
      setError('unauthorized')
      return
    }

    setError(null)
    setResponders([])

    const respondersRef = query(
      scopeQuery(collection(db, 'responders'), role, municipalityId, agencyId),
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
          const activityAt = Math.max(lastSeenAt, doc.lastTelemetryAt ?? 0, doc.updatedAt ?? 0)
          return {
            uid: d.id,
            displayName: doc.displayName ?? '',
            availabilityStatus: doc.availabilityStatus ?? 'unavailable',
            lastActivityAt: activityAt,
            onlineStatus: deriveOnlineStatus(activityAt),
            ...(doc.municipalityId && { municipalityId: doc.municipalityId }),
            ...(doc.agencyId && { agencyId: doc.agencyId }),
          }
        })
        setResponders(data)
        setError(null)
      },
      (err) => {
        setResponders([])
        setError(snapshotError(err))
      },
    )

    return () => {
      unsubscribe()
    }
  }, [db, authLoading, role, municipalityId, agencyId])

  return { responders, loading: authLoading, error }
}
