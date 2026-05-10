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
  const [responders, setResponders] = useState<unknown[]>([])

  useEffect(() => {
    if (!db) return

    const unsubscribers: (() => void)[] = []

    // Always listen to reports
    const reportsRef = collection(db, 'reports')
    const unsubReports = onSnapshot(reportsRef, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ReportDoc, 'id'>),
      }))
      setReports(data)
      setLoading(false)
    })
    unsubscribers.push(unsubReports)

    if (windowType === 'map' && rtdb) {
      // Listen to responder locations in RTDB
      const locationsRef = ref(rtdb, 'responder_locations')
      const unsubLocations = onValue(locationsRef, (snapshot) => {
        const data = (snapshot.val() ?? {}) as Record<string, unknown>
        setResponders(Object.entries(data))
      })
      unsubscribers.push(unsubLocations)
    }

    return () => {
      unsubscribers.forEach((unsub) => {
        unsub()
      })
    }
  }, [windowType, db, rtdb])

  return { loading, reports, responders }
}
