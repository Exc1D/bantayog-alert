/**
 * Alert Service
 *
 * Firestore queries for government alerts:
 * - One-shot fetches with client-side expiration filtering
 * - Real-time subscriptions via onSnapshot
 * - Pagination support via document cursors
 *
 * Client-side expiration filtering avoids needing a composite Firestore index.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '@/app/firebase/config'
import type { Alert } from '@/shared/types/firestore.types'
import type { UserRole } from '@/shared/types/auth.types'

const ALERTS_LIMIT = 50

/**
 * Alert query filters
 */
export interface AlertFilters {
  /** Filter to active alerts. Defaults to true when omitted. */
  active?: boolean
  /** Filter by severity level. */
  severity?: Alert['severity']
  /** Filter by alert type. */
  type?: Alert['type']
  /** Filter to a specific municipality via affectedAreas. */
  municipality?: string
  /** Filter to alerts targeting a specific role. */
  role?: UserRole
}

// ── One-shot fetches ─────────────────────────────────────────────────────────

/**
 * Fetch alerts with optional filters.
 *
 * Applies isActive filter (default: true) and filters expired alerts
 * client-side to avoid a composite Firestore index.
 */
export async function getAlerts(filters: AlertFilters = {}): Promise<Alert[]> {
  const { active = true, severity, type } = filters
  const now = Date.now()

  const constraints: QueryConstraint[] = []

  if (active) {
    constraints.push(where('isActive', '==', true))
  }

  if (severity) {
    constraints.push(where('severity', '==', severity))
  }

  if (type) {
    constraints.push(where('type', '==', type))
  }

  constraints.push(orderBy('createdAt', 'desc'))
  constraints.push(limit(ALERTS_LIMIT))

  const alertsRef = collection(db, 'alerts')
  const q = query(alertsRef, ...constraints)

  let alerts: Alert[]

  try {
    const snap = await getDocs(q)
    alerts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Alert))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to fetch alerts: ${message}`)
  }

  // Filter expired alerts client-side — avoids composite index on expiresAt
  return alerts.filter((a) => !a.expiresAt || a.expiresAt > now)
}

/**
 * Fetch alerts scoped to a specific municipality.
 *
 * Uses affectedAreas.municipalities array-contains to match location.
 */
export async function getAlertsByMunicipality(municipality: string): Promise<Alert[]> {
  const now = Date.now()
  const alertsRef = collection(db, 'alerts')

  const q = query(
    alertsRef,
    where('affectedAreas.municipalities', 'array-contains', municipality),
    orderBy('createdAt', 'desc'),
    limit(ALERTS_LIMIT)
  )

  let alerts: Alert[]

  try {
    const snap = await getDocs(q)
    alerts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Alert))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to fetch alerts for municipality ${municipality}: ${message}`)
  }

  return alerts.filter((a) => !a.expiresAt || a.expiresAt > now)
}

/**
 * Fetch alerts targeting a specific user role.
 */
export async function getAlertsByRole(role: UserRole): Promise<Alert[]> {
  const now = Date.now()
  const alertsRef = collection(db, 'alerts')

  const q = query(
    alertsRef,
    where('targetAudience', '==', 'role'),
    where('targetRole', '==', role),
    orderBy('createdAt', 'desc'),
    limit(ALERTS_LIMIT)
  )

  let alerts: Alert[]

  try {
    const snap = await getDocs(q)
    alerts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Alert))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to fetch alerts for role ${role}: ${message}`)
  }

  return alerts.filter((a) => !a.expiresAt || a.expiresAt > now)
}

// ── Real-time subscriptions ───────────────────────────────────────────────────

/**
 * Subscribe to alerts with real-time updates.
 *
 * @param filters - Query filters
 * @param callback - Called with the current alert list on each snapshot
 * @param onError - Called when a snapshot error occurs
 * @returns Unsubscribe function — call to stop listening
 */
export function subscribeToAlerts(
  filters: AlertFilters = {},
  callback: (alerts: Alert[]) => void,
  onError?: (err: Error) => void
): () => void {
  const { active = true, severity, type } = filters

  const constraints: QueryConstraint[] = []

  if (active) {
    constraints.push(where('isActive', '==', true))
  }

  if (severity) {
    constraints.push(where('severity', '==', severity))
  }

  if (type) {
    constraints.push(where('type', '==', type))
  }

  constraints.push(orderBy('createdAt', 'desc'))
  constraints.push(limit(ALERTS_LIMIT))

  const alertsRef = collection(db, 'alerts')
  const q = query(alertsRef, ...constraints)

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      const now = Date.now()
      const alerts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Alert))
      // Filter expired alerts on every update — recalculate now to avoid stale timestamps
      const active = alerts.filter((a) => !a.expiresAt || a.expiresAt > now)
      callback(active)
    },
    (err) => {
      onError?.(err as Error)
    }
  )

  return unsubscribe
}

/**
 * Subscribe to alerts for a specific municipality with real-time updates.
 *
 * @returns Unsubscribe function — call to stop listening
 */
export function subscribeToAlertsByMunicipality(
  municipality: string,
  callback: (alerts: Alert[]) => void,
  onError?: (err: Error) => void
): () => void {
  const alertsRef = collection(db, 'alerts')

  const q = query(
    alertsRef,
    where('affectedAreas.municipalities', 'array-contains', municipality),
    orderBy('createdAt', 'desc'),
    limit(ALERTS_LIMIT)
  )

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      const now = Date.now()
      const alerts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Alert))
      const active = alerts.filter((a) => !a.expiresAt || a.expiresAt > now)
      callback(active)
    },
    (err) => {
      onError?.(err as Error)
    }
  )

  return unsubscribe
}

// ── Pagination ────────────────────────────────────────────────────────────────

/**
 * Fetch a page of alerts using a document cursor.
 *
 * @param lastDoc - The last document from the previous page (cursor)
 * @returns The next page of alerts and the next cursor (null if no more)
 */
export async function getAlertsPage(
  lastDoc?: DocumentSnapshot
): Promise<{ alerts: Alert[]; nextCursor: DocumentSnapshot | null }> {
  const now = Date.now()
  const alertsRef = collection(db, 'alerts')

  const constraints: QueryConstraint[] = [
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
    limit(ALERTS_LIMIT),
  ]

  if (lastDoc) {
    constraints.push(startAfter(lastDoc))
  }

  const q = query(alertsRef, ...constraints)

  try {
    const snap = await getDocs(q)
    const alerts: Alert[] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Alert))

    const nextCursor = snap.docs.length === ALERTS_LIMIT
      ? (snap.docs[snap.docs.length - 1] as DocumentSnapshot)
      : null

    return {
      alerts: alerts.filter((a) => !a.expiresAt || a.expiresAt > now),
      nextCursor,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to fetch alerts page: ${message}`)
  }
}
