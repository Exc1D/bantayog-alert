import { useEffect, useRef, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  where,
  type Firestore,
  type Query,
} from 'firebase/firestore'
import { ref, onValue, type Database } from 'firebase/database'
import { useAuth } from '@bantayog/shared-ui'

interface Props {
  windowType: 'dashboard' | 'map'
  db?: Firestore
  rtdb?: Database
}

export interface ReportDoc {
  id: string
  reportType?: string
  type?: string
  severity: string
  municipalityLabel?: string
  municipalityId?: string
  municipality?: string
  barangayId?: string
  barangay?: string
  submittedAt?: number | string | { toDate(): Date }
  createdAt?: number | string | { toDate(): Date }
  status: string
  description: string
  publicLocation?: unknown
  location?: unknown
  latitude?: number
  longitude?: number
  featuredMediaIds?: string[]
}

export interface ReportOpsDoc {
  id: string
  reportId: string
  acknowledgedAt?: string
  status?: string
}

export interface SituationUpdateDoc {
  id: string
  authorUid?: string
  createdAt?: number | string | { toDate(): Date }
  updatedAt?: number | string | { toDate(): Date }
  municipalityId?: string
  municipalityLabel?: string
  barangayLabel?: string
  hazardType?: string
  condition?: string
  body?: string
  visibility?: string
  reportedCount?: number
}

export function isReportOpsDoc(doc: unknown): doc is ReportOpsDoc {
  if (doc == null || typeof doc !== 'object') return false
  const d = doc as Record<string, unknown>
  return typeof d.id === 'string' && typeof d.reportId === 'string'
}

const MAX_RETRIES = 3
const LOADING_TIMEOUT_MS = 5000
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

interface ScopeFields {
  municipal: string
  agency: string
  agencyOperator?: '==' | 'array-contains'
}

function scopeQuery(
  base: Query,
  role: string | null,
  municipalityId: string | null,
  agencyId: string | null,
  fields: ScopeFields,
): Query {
  if (role === 'municipal_admin' && municipalityId) {
    return query(base, where(fields.municipal, '==', municipalityId))
  }
  if (role === 'agency_admin' && agencyId) {
    return query(base, where(fields.agency, fields.agencyOperator ?? '==', agencyId))
  }
  return base
}

function snapshotError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function useFirestoreListeners({ windowType, db, rtdb }: Props) {
  const { claims, loading: authLoading } = useAuth()
  const role = typeof claims?.role === 'string' ? claims.role : null
  const municipalityId = typeof claims?.municipalityId === 'string' ? claims.municipalityId : null
  const agencyId = typeof claims?.agencyId === 'string' ? claims.agencyId : null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reports, setReports] = useState<ReportDoc[]>([])
  const [reportOps, setReportOps] = useState<ReportOpsDoc[]>([])
  const [alerts, setAlerts] = useState<unknown[]>([])
  const [situationUpdates, setSituationUpdates] = useState<SituationUpdateDoc[]>([])
  const [responders, setResponders] = useState<[string, unknown][]>([])
  const [retryCount, setRetryCount] = useState(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scopeKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!db) return

    // Flush state when visibility scope changes (tenant switch or token refresh)
    const nextScopeKey = authLoading
      ? null
      : `${role ?? 'none'}:${municipalityId ?? ''}:${agencyId ?? ''}:${windowType}`

    if (scopeKeyRef.current !== nextScopeKey) {
      scopeKeyRef.current = nextScopeKey
      setReports([])
      setReportOps([])
      setAlerts([])
      setSituationUpdates([])
      setResponders([])
      setRetryCount(0)
    }

    if (authLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null)
      setLoading(true)
      return
    }

    if (!isAuthorized(role, municipalityId, agencyId)) {
      setLoading(false)
      setError('unauthorized')
      return
    }

    setLoading(true)
    setError(null)

    const loadingTimeout = setTimeout(() => {
      setLoading(false)
    }, LOADING_TIMEOUT_MS)

    const scheduleRetry = () => {
      if (retryCount >= MAX_RETRIES) return
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      retryTimerRef.current = setTimeout(
        () => {
          setRetryCount((c) => c + 1)
        },
        1000 * (retryCount + 1),
      )
    }

    const resetRetryBudget = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      setRetryCount(0)
    }

    const unsubscribers: (() => void)[] = []

    // reports — agency_admin sees full collection (Firestore rules filter)
    const reportsRef = scopeQuery(collection(db, 'reports'), role, municipalityId, agencyId, {
      municipal: 'municipalityId',
      agency: 'municipalityId',
    })
    unsubscribers.push(
      onSnapshot(
        reportsRef,
        (snapshot) => {
          setReports(
            snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReportDoc, 'id'>) })),
          )
          setLoading(false)
          setError(null)
          resetRetryBudget()
        },
        (err) => {
          setError(snapshotError(err))
          scheduleRetry()
        },
      ),
    )

    // report_ops
    const reportOpsRef = scopeQuery(collection(db, 'report_ops'), role, municipalityId, agencyId, {
      municipal: 'municipalityId',
      agency: 'agencyIds',
      agencyOperator: 'array-contains',
    })
    unsubscribers.push(
      onSnapshot(
        reportOpsRef,
        (snapshot) => {
          setReportOps(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter(isReportOpsDoc))
          setError(null)
          resetRetryBudget()
        },
        (err) => {
          setError(snapshotError(err))
          scheduleRetry()
        },
      ),
    )

    // alerts — scoped so municipal admins can moderate their citizen-visible alerts.
    const alertsRef =
      role === 'municipal_admin' && municipalityId
        ? query(
            collection(db, 'alerts'),
            where('affectedMunicipalityIds', 'array-contains', municipalityId),
          )
        : role === 'agency_admin'
          ? query(collection(db, 'alerts'), where('visibility', '==', 'public'))
          : collection(db, 'alerts')
    unsubscribers.push(
      onSnapshot(
        alertsRef,
        (snapshot) => {
          setAlerts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
          setError(null)
          resetRetryBudget()
        },
        (err) => {
          setError(snapshotError(err))
          scheduleRetry()
        },
      ),
    )

    if (role === 'municipal_admin' || role === 'provincial_superadmin') {
      const situationRef =
        role === 'municipal_admin' && municipalityId
          ? query(
              collection(db, 'situation_updates'),
              where('municipalityId', '==', municipalityId),
            )
          : collection(db, 'situation_updates')
      unsubscribers.push(
        onSnapshot(
          situationRef,
          (snapshot) => {
            setSituationUpdates(
              snapshot.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<SituationUpdateDoc, 'id'>),
              })),
            )
            setError(null)
            resetRetryBudget()
          },
          (err) => {
            setError(snapshotError(err))
            scheduleRetry()
          },
        ),
      )
    }

    // map-only: responder accounts
    if (windowType === 'map') {
      const respondersRef = scopeQuery(
        query(collection(db, 'responders'), where('isActive', '==', true)),
        role,
        municipalityId,
        agencyId,
        { municipal: 'municipalityId', agency: 'agencyId' },
      )
      unsubscribers.push(
        onSnapshot(
          respondersRef,
          (snapshot) => {
            setResponders(snapshot.docs.map((d) => [d.id, d.data()]))
            setError(null)
            resetRetryBudget()
          },
          (err) => {
            setError(snapshotError(err))
            scheduleRetry()
          },
        ),
      )
    }

    // map-only: responder locations (RTDB)
    if (windowType === 'map' && rtdb) {
      unsubscribers.push(
        onValue(
          ref(rtdb, 'responder_locations'),
          (snapshot) => {
            const data = (snapshot.val() ?? {}) as Record<string, unknown>
            setResponders(Object.entries(data))
          },
          (err) => {
            setError(snapshotError(err))
          },
        ),
      )
    }

    return () => {
      clearTimeout(loadingTimeout)
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      unsubscribers.forEach((unsub) => {
        unsub()
      })
    }
  }, [windowType, db, rtdb, retryCount, role, municipalityId, agencyId, authLoading])

  return { loading, error, reports, reportOps, alerts, situationUpdates, responders }
}
