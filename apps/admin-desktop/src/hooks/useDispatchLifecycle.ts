import { useEffect, useRef, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  type Firestore,
  type Query,
} from 'firebase/firestore'
import { useAuth } from '@bantayog/shared-ui'

export interface DispatchEvent {
  id: string
  type: string
  dispatchId: string
  at: number
  [key: string]: unknown
}

export interface DispatchLifecycleRow {
  dispatchId: string
  reportId: string
  status: string
  responderName: string
  responderAgency: string
  dispatchedAt: number
  deadlineAt: number
  resolvedAt?: number
  resolutionSummary?: string
  escalationCount: number
  fcmResult: string | null
  fcmWarnings: string[] | null
  timeline: DispatchEvent[]
  assignedTo?: { uid: string; agencyId?: string; municipalityId?: string }
  previouslyNotifiedResponderUids?: string[]
}

interface DispatchDoc {
  reportId?: string
  status?: string
  responderName?: string
  responderAgency?: string
  dispatchedAt?: number
  deadlineAt?: number
  acknowledgementDeadlineAt?: number
  resolvedAt?: number
  resolutionSummary?: string
  escalationCount?: number
  fcmResult?: string | null
  fcmWarnings?: string[] | null
  assignedTo?: { uid: string; agencyId?: string; municipalityId?: string }
  previouslyNotifiedResponderUids?: string[]
}

const ALLOWED_STATUSES = [
  'pending',
  'accepted',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'declined',
  'needs_admin',
  'escalated',
]
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
const DEBOUNCE_MS = 100
const ALLOWED_ROLES = new Set(['provincial_superadmin', 'municipal_admin', 'agency_admin'])

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

function snapshotError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function resolveDispatchDeadlineAt(doc: {
  acknowledgementDeadlineAt?: number
  deadlineAt?: number
}): number {
  return doc.acknowledgementDeadlineAt ?? doc.deadlineAt ?? 0
}

function buildRows(
  dispatchMap: Map<string, DispatchDoc>,
  eventsMap: Map<string, DispatchEvent[]>,
): DispatchLifecycleRow[] {
  const result: DispatchLifecycleRow[] = []
  for (const [dispatchId, doc] of dispatchMap) {
    result.push({
      dispatchId,
      reportId: doc.reportId ?? '',
      status: doc.status ?? '',
      responderName: doc.responderName ?? '',
      responderAgency: doc.responderAgency ?? '',
      dispatchedAt: doc.dispatchedAt ?? 0,
      deadlineAt: resolveDispatchDeadlineAt(doc),
      ...(doc.resolvedAt !== undefined && { resolvedAt: doc.resolvedAt }),
      ...(doc.resolutionSummary !== undefined && { resolutionSummary: doc.resolutionSummary }),
      escalationCount: doc.escalationCount ?? 0,
      fcmResult: doc.fcmResult ?? null,
      fcmWarnings: doc.fcmWarnings ?? null,
      timeline: eventsMap.get(dispatchId) ?? [],
      ...(doc.assignedTo && { assignedTo: doc.assignedTo }),
      ...(doc.previouslyNotifiedResponderUids && {
        previouslyNotifiedResponderUids: doc.previouslyNotifiedResponderUids,
      }),
    })
  }
  return result
}

export function useDispatchLifecycle(db: Firestore) {
  const { claims, loading: authLoading } = useAuth()
  const role = typeof claims?.role === 'string' ? claims.role : null
  const municipalityId = typeof claims?.municipalityId === 'string' ? claims.municipalityId : null
  const agencyId = typeof claims?.agencyId === 'string' ? claims.agencyId : null

  const [rows, setRows] = useState<DispatchLifecycleRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const dispatchDataRef = useRef<Map<string, DispatchDoc>>(new Map())
  const eventsDataRef = useRef<Map<string, DispatchEvent[]>>(new Map())
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleMerge = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setRows(buildRows(dispatchDataRef.current, eventsDataRef.current))
    }, DEBOUNCE_MS)
  }

  useEffect(() => {
    if (authLoading) return

    if (!isAuthorized(role, municipalityId, agencyId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows([])
      setError('unauthorized')
      return
    }

    setError(null)

    const unsubscribers: (() => void)[] = []

    // dispatches listener
    const dispatchesRef = query(
      scopeQuery(collection(db, 'dispatches'), role, municipalityId, agencyId),
      where('status', 'in', ALLOWED_STATUSES),
      orderBy('dispatchedAt', 'desc'),
      limit(100),
    )

    unsubscribers.push(
      onSnapshot(
        dispatchesRef,
        (snapshot) => {
          const newMap = new Map<string, DispatchDoc>()
          for (const d of snapshot.docs) {
            newMap.set(d.id, d.data())
          }
          dispatchDataRef.current = newMap
          scheduleMerge()
          setError(null)
        },
        (err) => {
          setError(snapshotError(err))
        },
      ),
    )

    // dispatch_events listener (last 24h)
    const since = Date.now() - TWENTY_FOUR_HOURS_MS
    const eventsRef = query(
      scopeQuery(collection(db, 'dispatch_events'), role, municipalityId, agencyId),
      where('at', '>', since),
      orderBy('at', 'desc'),
    )

    unsubscribers.push(
      onSnapshot(
        eventsRef,
        (snapshot) => {
          const newMap = new Map<string, DispatchEvent[]>()
          for (const d of snapshot.docs) {
            const data = d.data() as Omit<DispatchEvent, 'id'>
            const event: DispatchEvent = { id: d.id, ...data } as DispatchEvent
            const list = newMap.get(event.dispatchId) ?? []
            list.push(event)
            newMap.set(event.dispatchId, list)
          }
          for (const list of newMap.values()) {
            list.sort((a, b) => b.at - a.at)
          }
          eventsDataRef.current = newMap
          scheduleMerge()
          setError(null)
        },
        (err) => {
          setError(snapshotError(err))
        },
      ),
    )

    return () => {
      unsubscribers.forEach((unsub) => {
        unsub()
      })
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      dispatchDataRef.current.clear()
      eventsDataRef.current.clear()
    }
  }, [db, authLoading, role, municipalityId, agencyId])

  return { rows, loading: authLoading, error }
}
