/**
 * useDispatches Hook — Responder Dispatch Subscription
 *
 * Subscribes to dispatches assigned to the authenticated responder via
 * Firestore onSnapshot. Returns real-time dispatch list with loading/error state.
 * Set subscribe=false to fetch once without real-time updates.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  onSnapshot,
  query,
  where,
  orderBy,
  collection,
  getDocs,
  getFirestore,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import type { AssignedDispatch, QuickStatus } from '../types'
import { useUserContext } from '@/shared/hooks/UserContext'
import type { DispatchesError } from '../types'
import { MAX_SYNC_RETRIES, SYNC_RETRY_DELAY_MS, SYNC_MAX_DELAY_MS } from '../config/time.config'

interface UseDispatchesReturn {
  dispatches: AssignedDispatch[]
  isLoading: boolean
  error: DispatchesError | null
  refresh: () => Promise<void>
}

/**
 * Build the Firestore query for active dispatches assigned to a responder,
 * scoped to a specific municipality for access-control filtering.
 */
function buildDispatchesQuery(
  db: ReturnType<typeof getFirestore>,
  uid: string,
  municipality: string
) {
  return query(
    collection(db, 'report_ops'),
    where('assignedTo', '==', uid),
    where('municipality', '==', municipality),
    where('responderStatus', 'not-in', ['completed']),
    orderBy('assignedAt', 'desc')
  )
}

/** Valid QuickStatus values — must match QuickStatus type exactly */
const VALID_DISPATCH_STATUSES: QuickStatus[] = ['en_route', 'on_scene', 'needs_assistance', 'completed']

/**
 * Validate incidentLocation structure.
 * Returns true if the object has valid latitude, longitude, and address.
 */
function isValidIncidentLocation(location: unknown): location is { latitude: number; longitude: number; address: string } {
  if (!location || typeof location !== 'object') return false
  const loc = location as Record<string, unknown>
  return (
    Number.isFinite(loc.latitude) &&
    Number.isFinite(loc.longitude) &&
    typeof loc.address === 'string'
  )
}

/**
 * Normalize assignedAt to a numeric epoch timestamp.
 * Handles Firestore Timestamp objects and numbers.
 */
function normalizeAssignedAt(assignedAt: unknown): number {
  if (Number.isFinite(assignedAt)) {
    return assignedAt as number
  }
  if (assignedAt && typeof assignedAt === 'object') {
    const timestamp = assignedAt as Record<string, unknown>
    if (typeof timestamp.toMillis === 'function') {
      return (timestamp.toMillis as () => number)()
    }
    if (typeof timestamp.toDate === 'function') {
      return ((timestamp.toDate as () => Date)()).getTime()
    }
  }
  return Date.now()
}

/**
 * Convert a Firestore snapshot to AssignedDispatch array.
 */
function snapshotToDispatches(snap: QuerySnapshot) {
  const dispatches: AssignedDispatch[] = []
  snap.forEach((doc: QueryDocumentSnapshot) => {
    const data = doc.data()
    // Validate both status and responderStatus against QuickStatus whitelist
    const status: QuickStatus = (data.responderStatus && VALID_DISPATCH_STATUSES.includes(data.responderStatus))
      ? data.responderStatus
      : (data.status && VALID_DISPATCH_STATUSES.includes(data.status)
          ? data.status
          : 'en_route') as QuickStatus
    // responderStatus on the dispatched object is also validated — raw data.responderStatus
    // could be an invalid value (e.g. 'pending', 'dispatch') that would cause type mismatches
    const validatedResponderStatus: QuickStatus = VALID_DISPATCH_STATUSES.includes(data.responderStatus)
      ? data.responderStatus
      : status
    dispatches.push({
      id: doc.id,
      type: data.type,
      status,
      urgency: data.urgency,
      incidentLocation: isValidIncidentLocation(data.incidentLocation)
        ? data.incidentLocation
        : { latitude: 0, longitude: 0, address: 'Location pending...' },
      assignedAt: normalizeAssignedAt(data.assignedAt),
      responderStatus: validatedResponderStatus,
    } as AssignedDispatch)
  })
  return dispatches
}

export function useDispatches(options?: { subscribe?: boolean }): UseDispatchesReturn {
  const [dispatches, setDispatches] = useState<AssignedDispatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<DispatchesError | null>(null)

  // municipality is required for access-control filtering — without it we cannot
  // safely scope the query and must return no data.
  const { municipality } = useUserContext()

  const abortControllerRef = useRef<AbortController | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const dbRef = useRef<ReturnType<typeof getFirestore> | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    // Reset retry counter on manual refresh
    retryCountRef.current = 0

    try {
      setError(null)
      const user = getAuth().currentUser

      if (!user || signal.aborted) {
        if (!signal.aborted) {
          setError({
            code: 'AUTH_EXPIRED',
            message: 'You must be logged in to view dispatches',
            isFatal: true
          })
        }
        return
      }

      // Guard: municipality filter is required for access control.
      // If the user has no municipality in their profile, deny access.
      if (!municipality) {
        setError({
          code: 'AUTH_EXPIRED',
          message: 'Municipality not set — cannot load dispatches',
          isFatal: true
        })
        setIsLoading(false)
        return
      }

      if (!dbRef.current) {
        dbRef.current = getFirestore()
      }
      const q = buildDispatchesQuery(dbRef.current, user.uid, municipality)

      const snapshot = await getDocs(q)

      if (signal.aborted) return

      setDispatches(snapshotToDispatches(snapshot))
    } catch (err: unknown) {
      if (signal.aborted) return

      const errorCode = (err as { code?: string })?.code
      if (errorCode === 'permission-denied') {
        setError({
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to view dispatches',
          isFatal: true
        })
      } else if ((err as Error).name !== 'AbortError') {
        setError({
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Failed to load dispatches',
          isFatal: false
        })
      }
    } finally {
      // Clear abort controller ref on completion (aborted or success)
      abortControllerRef.current = null
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const subscribe = () => {
      const user = getAuth().currentUser
      if (!user || !mounted) return

      // Guard: municipality filter is required for access control.
      // If the user has no municipality in their profile, deny access.
      if (!municipality) {
        setError({
          code: 'AUTH_EXPIRED',
          message: 'Municipality not set — cannot load dispatches',
          isFatal: true
        })
        setDispatches([])
        setIsLoading(false)
        return
      }

      if (!dbRef.current) {
        dbRef.current = getFirestore()
      }
      const q = buildDispatchesQuery(dbRef.current, user.uid, municipality)

      const unsubscribe = onSnapshot(
        q,
        {
          next: (snapshot) => {
            if (!mounted) return

            // Verify user hasn't changed auth state mid-subscription
            const currentUser = getAuth().currentUser
            if (!currentUser || currentUser.uid !== user.uid) return

            setDispatches(snapshotToDispatches(snapshot))
            if (isLoading) setIsLoading(false)
            if (error !== null) setError(null)
            retryCountRef.current = 0
          },

          error: (err) => {
            if (!mounted) return

            const errorCode = (err as { code?: string })?.code

            if (errorCode === 'permission-denied') {
              setError({
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to view dispatches',
                isFatal: true
              })
              setIsLoading(false)
              return
            }

            if (retryCountRef.current < MAX_SYNC_RETRIES) {
              const delay = Math.min(
                SYNC_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current),
                SYNC_MAX_DELAY_MS
              )

              reconnectTimeoutRef.current = setTimeout(() => {
                if (mounted) {
                  retryCountRef.current++
                  subscribe()
                }
              }, delay)
            } else {
              setError({
                code: 'NETWORK_ERROR',
                message: 'Unable to connect. Please check your connection and tap to retry.',
                isFatal: false
              })
              setIsLoading(false)
            }
          }
        }
      )

      unsubscribeRef.current = unsubscribe
    }

    if (options?.subscribe !== false) {
      subscribe()
    } else {
      refresh().finally(() => setIsLoading(false))
    }

    return () => {
      mounted = false
      unsubscribeRef.current?.()
      reconnectTimeoutRef.current && clearTimeout(reconnectTimeoutRef.current)
      abortControllerRef.current?.abort()
    }
  }, [options?.subscribe, refresh, municipality])

  return { dispatches, isLoading, error, refresh }
}