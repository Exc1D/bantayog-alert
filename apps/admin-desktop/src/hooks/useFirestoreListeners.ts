import { useEffect, useState } from 'react'
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

export function useFirestoreListeners({ windowType, db, rtdb }: Props) {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<ReportDoc[]>([])
  const [reportOps, setReportOps] = useState<unknown[]>([])
  const [alerts, setAlerts] = useState<unknown[]>([])
  const [responders, setResponders] = useState<[string, unknown][]>([])

  useEffect(() => {
    if (!db) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }

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
      },
      (err) => {
        console.error('[useFirestoreListeners] reports listener failed', err)
        setLoading(false)
      },
    )
    unsubscribers.push(unsubReports)

    // Listen to report_ops
    const reportOpsRef = collection(db, 'report_ops')
    const unsubReportOps = onSnapshot(
      reportOpsRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        setReportOps(data)
      },
      (err) => {
        console.error('[useFirestoreListeners] report_ops listener failed', err)
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
      },
      (err) => {
        console.error('[useFirestoreListeners] alerts listener failed', err)
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
          console.error('[useFirestoreListeners] responder_locations listener failed', err)
        },
      )
      unsubscribers.push(unsubLocations)
    }

    return () => {
      unsubscribers.forEach((unsub) => {
        unsub()
      })
    }
  }, [windowType, db, rtdb])

  return { loading, reports, reportOps, alerts, responders }
}
