import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, type Firestore } from 'firebase/firestore'
import { ref, onValue, type Database } from 'firebase/database'

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

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)

    setError(null)

    // Safety timeout: always exit loading state within 5s even if Firestore is slow or denied
    const loadingTimeout = setTimeout(() => {
      setLoading(false)
    }, 5000)

    const unsubscribers: (() => void)[] = []

    // Always listen to reports
    const reportsRef = collection(db, 'reports')
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

    // Listen to report_ops
    const reportOpsRef = collection(db, 'report_ops')
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
  }, [windowType, db, rtdb, retryCount])

  return { loading, error, reports, reportOps, alerts, responders }
}
