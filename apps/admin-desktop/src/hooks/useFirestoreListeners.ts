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

interface ReportDoc {
  id: string
  type: string
  severity: string
  municipality: string
  barangay: string
  createdAt: string
  status: string
  description: string
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

  useEffect(() => {
    if (!db) return
    if (authLoading) return

    const isSupportedRole =
      role === 'provincial_superadmin' || role === 'municipal_admin' || role === 'agency_admin'

    // Unauthorized when role is not on the admin-desktop allowlist or scope IDs are missing
    if (
      !isSupportedRole ||
      (role === 'municipal_admin' && !municipalityId) ||
      (role === 'agency_admin' && !agencyId)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReports([])
      setReportOps([])
      setAlerts([])
      setResponders([])
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

    // Role-scoped reports listener
    const reportsCol = collection(db, 'reports')
    let reportsRef: Query = reportsCol
    if (role === 'municipal_admin' && municipalityId) {
      reportsRef = query(reportsCol, where('municipalityId', '==', municipalityId))
    } else if (role === 'agency_admin' && agencyId) {
      reportsRef = query(reportsCol, where('agencyId', '==', agencyId))
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
      },
      (err) => {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        if (retryCount < MAX_RETRIES) {
          retryTimerRef.current = setTimeout(
            () => {
              setRetryCount((c) => c + 1)
            },
            1000 * (retryCount + 1),
          )
        }
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
      },
      (err) => {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        if (retryCount < MAX_RETRIES) {
          retryTimerRef.current = setTimeout(
            () => {
              setRetryCount((c) => c + 1)
            },
            1000 * (retryCount + 1),
          )
        }
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
      },
      (err) => {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        if (retryCount < MAX_RETRIES) {
          retryTimerRef.current = setTimeout(
            () => {
              setRetryCount((c) => c + 1)
            },
            1000 * (retryCount + 1),
          )
        }
      },
    )
    unsubscribers.push(unsubAlerts)

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
