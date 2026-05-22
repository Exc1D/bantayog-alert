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

export function isReportOpsDoc(doc: unknown): doc is ReportOpsDoc {
  if (doc == null || typeof doc !== 'object') return false
  const d = doc as Record<string, unknown>
  return typeof d.id === 'string' && typeof d.reportId === 'string'
}

const MAX_RETRIES = 3

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
  const [responders, setResponders] = useState<[string, unknown][]>([])
  const [retryCount, setRetryCount] = useState(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scopeKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!db) return

    // Flush prior-tenant state when the visibility scope changes (e.g.,
    // municipal_admin M001 → M002, or a token refresh that flips authLoading
    // back to true). Without this, React keeps rendering the previous
    // tenant's docs until the new onSnapshot callback fires.
    const nextScopeKey = authLoading
      ? null
      : `${role ?? 'none'}:${municipalityId ?? ''}:${agencyId ?? ''}:${windowType}`

    const scopeChanged = scopeKeyRef.current !== nextScopeKey
    scopeKeyRef.current = nextScopeKey

    if (scopeChanged) {
      setReports([])
      setReportOps([])
      setAlerts([])
      setResponders([])
      // Reset retry budget so the new scope doesn't inherit an exhausted
      // counter from the prior tenant. The pending retry timer (if any) is
      // already cleared by the effect cleanup that ran before this re-entry.
      setRetryCount(0)
    }

    if (authLoading) {
      // Clear any stale onSnapshot error from the prior scope before flipping
      // back to loading; otherwise a token refresh would leave error+loading
      // both set, and the UI would render the "failed" state on top of a
      // spinner.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null)
      setLoading(true)
      return
    }

    const isSupportedRole =
      role === 'provincial_superadmin' || role === 'municipal_admin' || role === 'agency_admin'

    // Unauthorized when role is not on the admin-desktop allowlist or scope IDs are missing
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

    // Safety timeout: always exit loading state within 5s even if Firestore is slow or denied
    const loadingTimeout = setTimeout(() => {
      setLoading(false)
    }, 5000)

    const unsubscribers: (() => void)[] = []

    // Shared retry scheduler for all listeners. Clears any previously-scheduled
    // retry timer before overwriting the ref — without this, when multiple
    // listeners fail in the same effect run only the last assignment is
    // reachable via cleanup, and the prior ones become orphans that still fire
    // setRetryCount and trigger spurious effect re-runs after authLoading flips
    // or unmount.
    const scheduleRetry = () => {
      if (retryCount >= MAX_RETRIES) return
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
      }
      retryTimerRef.current = setTimeout(
        () => {
          setRetryCount((c) => c + 1)
        },
        1000 * (retryCount + 1),
      )
    }

    // Reset the shared retry budget on a successful connection. Without this,
    // a listener that recovered after MAX_RETRIES would permanently disable
    // future retries (scheduleRetry short-circuits on retryCount >= MAX_RETRIES),
    // and a pending retry timer from the failing window would still fire and
    // trigger a spurious effect re-run.
    const resetRetryBudget = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      setRetryCount(0)
    }

    // Role-scoped reports listener
    const reportsCol = collection(db, 'reports')
    let reportsRef: Query = reportsCol
    if (role === 'municipal_admin' && municipalityId) {
      reportsRef = query(reportsCol, where('municipalityId', '==', municipalityId))
    } else if (role === 'agency_admin' && agencyId) {
      // reports docs do not have agencyId. Agency admins see reports that
      // are public_alertable or that their agency handles (enforced by
      // Firestore rules), so we query the full collection and let rules
      // filter. The responders listener below already scopes by agency.
      reportsRef = reportsCol
    }
    const unsubReports = onSnapshot(
      reportsRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ReportDoc, 'id'>),
        }))
        setReports(data)
        setLoading(false)
        setError(null)
        resetRetryBudget()
      },
      (err) => {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        scheduleRetry()
      },
    )
    unsubscribers.push(unsubReports)

    // Role-scoped report_ops listener
    const reportOpsCol = collection(db, 'report_ops')
    let reportOpsRef: Query = reportOpsCol
    if (role === 'municipal_admin' && municipalityId) {
      reportOpsRef = query(reportOpsCol, where('municipalityId', '==', municipalityId))
    } else if (role === 'agency_admin' && agencyId) {
      reportOpsRef = query(reportOpsCol, where('agencyIds', 'array-contains', agencyId))
    }
    const unsubReportOps = onSnapshot(
      reportOpsRef,
      (snapshot) => {
        const data = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .filter(isReportOpsDoc)
        setReportOps(data)
        setError(null)
        resetRetryBudget()
      },
      (err) => {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        scheduleRetry()
      },
    )
    unsubscribers.push(unsubReportOps)

    // Listen to alerts
    const alertsRef = collection(db, 'alerts')
    const unsubAlerts = onSnapshot(
      alertsRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        setAlerts(data)
        setError(null)
        resetRetryBudget()
      },
      (err) => {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        scheduleRetry()
      },
    )
    unsubscribers.push(unsubAlerts)

    if (windowType === 'map') {
      const respondersCol = collection(db, 'responders')
      let respondersRef: Query = query(respondersCol, where('isActive', '==', true))
      if (role === 'municipal_admin' && municipalityId) {
        respondersRef = query(respondersRef, where('municipalityId', '==', municipalityId))
      } else if (role === 'agency_admin' && agencyId) {
        respondersRef = query(respondersRef, where('agencyId', '==', agencyId))
      }
      const unsubResponderAccounts = onSnapshot(
        respondersRef,
        (snapshot) => {
          setResponders(snapshot.docs.map((d) => [d.id, d.data()]))
          setError(null)
          resetRetryBudget()
        },
        (err) => {
          const message = err instanceof Error ? err.message : String(err)
          setError(message)
          scheduleRetry()
        },
      )
      unsubscribers.push(unsubResponderAccounts)
    }

    if (windowType === 'map' && rtdb) {
      // Listen to responder locations in RTDB
      const locationsRef = ref(rtdb, 'responder_locations')
      const unsubLocations = onValue(
        locationsRef,
        (snapshot) => {
          const data = (snapshot.val() ?? {}) as Record<string, unknown>
          setResponders(Object.entries(data))
        },
        (err) => {
          const message = err instanceof Error ? err.message : String(err)
          setError(message)
        },
      )
      unsubscribers.push(unsubLocations)
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

  return { loading, error, reports, reportOps, alerts, responders }
}
