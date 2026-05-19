import { useEffect, useMemo, useRef, useState } from 'react'
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
  escalationCount?: number
  fcmResult?: string | null
  fcmWarnings?: string[] | null
  assignedTo?: { uid: string; agencyId?: string; municipalityId?: string }
  previouslyNotifiedResponderUids?: string[]
}

const ALLOWED_STATUSES = ['pending', 'accepted', 'declined', 'needs_admin']
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export function useDispatchLifecycle(db: Firestore) {
  const { claims, loading: authLoading } = useAuth()
  const role = typeof claims?.role === 'string' ? claims.role : null
  const municipalityId = typeof claims?.municipalityId === 'string' ? claims.municipalityId : null
  const agencyId = typeof claims?.agencyId === 'string' ? claims.agencyId : null

  const [rows, setRows] = useState<DispatchLifecycleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const dispatchDataRef = useRef<Map<string, DispatchDoc>>(new Map())
  const eventsDataRef = useRef<Map<string, DispatchEvent[]>>(new Map())

  const mergeRows = useMemo(
    () =>
      (
        dispatchMap: Map<string, DispatchDoc>,
        eventsMap: Map<string, DispatchEvent[]>,
      ): DispatchLifecycleRow[] => {
        const result: DispatchLifecycleRow[] = []
        for (const [dispatchId, doc] of dispatchMap) {
          const events = eventsMap.get(dispatchId) ?? []
          const row: DispatchLifecycleRow = {
            dispatchId,
            reportId: doc.reportId ?? '',
            status: doc.status ?? '',
            responderName: doc.responderName ?? '',
            responderAgency: doc.responderAgency ?? '',
            dispatchedAt: doc.dispatchedAt ?? 0,
            deadlineAt: doc.deadlineAt ?? 0,
            escalationCount: doc.escalationCount ?? 0,
            fcmResult: doc.fcmResult ?? null,
            fcmWarnings: doc.fcmWarnings ?? null,
            timeline: events,
          }
          if (doc.assignedTo) {
            row.assignedTo = doc.assignedTo
          }
          if (doc.previouslyNotifiedResponderUids) {
            row.previouslyNotifiedResponderUids = doc.previouslyNotifiedResponderUids
          }
          result.push(row)
        }
        return result
      },
    [],
  )

  useEffect(() => {
    if (authLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true)
      setError(null)
      return
    }

    const isSupportedRole =
      role === 'provincial_superadmin' || role === 'municipal_admin' || role === 'agency_admin'

    if (
      !isSupportedRole ||
      (role === 'municipal_admin' && !municipalityId) ||
      (role === 'agency_admin' && !agencyId)
    ) {
      setLoading(false)
      setError('unauthorized')
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribers: (() => void)[] = []

    // dispatches listener
    const dispatchesCol = collection(db, 'dispatches')
    let dispatchesRef: Query = dispatchesCol

    if (role === 'municipal_admin' && municipalityId) {
      dispatchesRef = query(dispatchesRef, where('municipalityId', '==', municipalityId))
    } else if (role === 'agency_admin' && agencyId) {
      dispatchesRef = query(dispatchesRef, where('agencyId', '==', agencyId))
    }

    dispatchesRef = query(
      dispatchesRef,
      where('status', 'in', ALLOWED_STATUSES),
      orderBy('dispatchedAt', 'desc'),
      limit(100),
    )

    const unsubDispatches = onSnapshot(
      dispatchesRef,
      (snapshot) => {
        const newMap = new Map<string, DispatchDoc>()
        for (const d of snapshot.docs) {
          const data = d.data() as DispatchDoc
          newMap.set(d.id, data)
        }
        dispatchDataRef.current = newMap
        setRows(mergeRows(dispatchDataRef.current, eventsDataRef.current))
        setLoading(false)
        setError(null)
      },
      (err) => {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        setLoading(false)
      },
    )
    unsubscribers.push(unsubDispatches)

    // dispatch_events listener (last 24h)
    const eventsCol = collection(db, 'dispatch_events')
    const since = Date.now() - TWENTY_FOUR_HOURS_MS
    let eventsRef: Query = eventsCol

    if (role === 'municipal_admin' && municipalityId) {
      eventsRef = query(eventsRef, where('municipalityId', '==', municipalityId))
    } else if (role === 'agency_admin' && agencyId) {
      eventsRef = query(eventsRef, where('agencyId', '==', agencyId))
    }

    eventsRef = query(eventsRef, where('at', '>', since), orderBy('at', 'desc'))

    const unsubEvents = onSnapshot(
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
        // Sort timelines descending (newest → oldest) to match query order
        for (const list of newMap.values()) {
          list.sort((a, b) => b.at - a.at)
        }
        eventsDataRef.current = newMap
        setRows(mergeRows(dispatchDataRef.current, eventsDataRef.current))
        setLoading(false)
        setError(null)
      },
      (err) => {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        setLoading(false)
      },
    )
    unsubscribers.push(unsubEvents)

    return () => {
      unsubscribers.forEach((unsub) => {
        unsub()
      })
    }
  }, [db, authLoading, role, municipalityId, agencyId, mergeRows])

  return { rows, loading, error }
}
