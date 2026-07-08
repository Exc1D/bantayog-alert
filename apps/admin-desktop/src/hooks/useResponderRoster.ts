import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  where,
  type Firestore,
  type Query,
} from 'firebase/firestore'
import { useAuth } from '@bantayog/shared-ui'

export interface ResponderRosterMember {
  uid: string
  displayName: string
  availabilityStatus: 'available' | 'unavailable' | 'off_duty'
  accountStatus: 'active' | 'suspended' | 'revoked'
  lastActivityAt: number
  municipalityId?: string
  agencyId?: string
}

interface RosterDoc {
  displayName?: string
  availabilityStatus?: 'available' | 'unavailable' | 'off_duty'
  accountStatus?: 'active' | 'suspended' | 'revoked'
  lastSeenAt?: number
  lastTelemetryAt?: number
  updatedAt?: number
  municipalityId?: string
  agencyId?: string
}

const ALLOWED_ROLES = new Set(['provincial_superadmin', 'municipal_admin', 'agency_admin'])

// Duplicated from useResponderFleet on purpose: the fleet query is the dispatch-candidate
// boundary (available + active only); the roster is the full scoped set. Extract when a 3rd
// caller needs the scope logic.
function isAuthorized(
  role: string | null,
  municipalityId: string | null,
  agencyId: string | null,
): boolean {
  if (!ALLOWED_ROLES.has(role ?? '')) return false
  if (role === 'municipal_admin' && !municipalityId) return false
  if (role === 'agency_admin' && !agencyId) return false
  return true
}

function scopeQuery(
  base: Query,
  role: string | null,
  municipalityId: string | null,
  agencyId: string | null,
): Query {
  if (role === 'municipal_admin' && municipalityId) {
    return query(base, where('municipalityId', '==', municipalityId))
  }
  if (role === 'agency_admin' && agencyId) {
    return query(base, where('agencyId', '==', agencyId))
  }
  return base
}

export function useResponderRoster(db: Firestore) {
  const { claims, loading: authLoading } = useAuth()
  const role = typeof claims?.role === 'string' ? claims.role : null
  const municipalityId = typeof claims?.municipalityId === 'string' ? claims.municipalityId : null
  const agencyId = typeof claims?.agencyId === 'string' ? claims.agencyId : null

  const [members, setMembers] = useState<ResponderRosterMember[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    if (!isAuthorized(role, municipalityId, agencyId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMembers([])
      setError('unauthorized')
      return
    }

    setError(null)
    setMembers([])

    // ponytail: no orderBy (avoids a composite index); sort client-side — the roster is bounded.
    const rosterRef = scopeQuery(collection(db, 'responders'), role, municipalityId, agencyId)

    const unsubscribe = onSnapshot(
      rosterRef,
      (snapshot) => {
        const data = snapshot.docs
          .map((d) => {
            const doc = d.data() as RosterDoc
            const activityAt = Math.max(
              doc.lastSeenAt ?? 0,
              doc.lastTelemetryAt ?? 0,
              doc.updatedAt ?? 0,
            )
            return {
              uid: d.id,
              displayName: doc.displayName ?? '',
              availabilityStatus: doc.availabilityStatus ?? 'unavailable',
              accountStatus: doc.accountStatus ?? 'active',
              lastActivityAt: activityAt,
              ...(doc.municipalityId && { municipalityId: doc.municipalityId }),
              ...(doc.agencyId && { agencyId: doc.agencyId }),
            }
          })
          .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
        setMembers(data)
        setError(null)
      },
      (err) => {
        setMembers([])
        setError(err instanceof Error ? err.message : String(err))
      },
    )

    return () => {
      unsubscribe()
    }
  }, [db, authLoading, role, municipalityId, agencyId])

  return { members, loading: authLoading, error }
}
