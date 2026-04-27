import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../app/firebase'

interface SystemHealthDoc {
  streamingGapSeconds: number
  batchGapSeconds: number
  healthy: boolean
  checkedAt: unknown
}

interface ProvinceMetrics {
  activeReports: number
  respondersAvailable: number
  avgResponseTimeMinutes: number | null
  resolvedToday: number
  health: SystemHealthDoc | null
}

export function useProvinceMetrics(): ProvinceMetrics {
  const [activeReports, setActiveReports] = useState(0)
  const [respondersAvailable, setRespondersAvailable] = useState(0)
  const [snapshotMetrics, setSnapshotMetrics] = useState<{
    avg: number | null
    resolved: number
  }>({ avg: null, resolved: 0 })
  const [health, setHealth] = useState<SystemHealthDoc | null>(null)

  // Stable date string — re-mounts at midnight via the key pattern if needed
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    return onSnapshot(
      query(
        collection(db, 'reports'),
        where('status', 'in', ['submitted', 'verified', 'assigned']),
      ),
      (snap) => {
        setActiveReports(snap.size)
      },
    )
  }, [])

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'responders'), where('availabilityStatus', '==', 'available')),
      (snap) => {
        setRespondersAvailable(snap.size)
      },
    )
  }, [])

  useEffect(() => {
    return onSnapshot(doc(db, 'analytics_snapshots', today, 'province', 'summary'), (snap) => {
      const data = snap.data()
      setSnapshotMetrics({
        avg: typeof data?.avgResponseTimeMinutes === 'number' ? data.avgResponseTimeMinutes : null,
        resolved: typeof data?.resolvedToday === 'number' ? data.resolvedToday : 0,
      })
    })
  }, [today])

  useEffect(() => {
    return onSnapshot(doc(db, 'system_health', 'latest'), (snap) => {
      const data = snap.data()
      if (
        data !== undefined &&
        typeof data.streamingGapSeconds === 'number' &&
        typeof data.batchGapSeconds === 'number' &&
        typeof data.healthy === 'boolean'
      ) {
        setHealth({
          streamingGapSeconds: data.streamingGapSeconds,
          batchGapSeconds: data.batchGapSeconds,
          healthy: data.healthy,
          checkedAt: data.checkedAt,
        })
      } else {
        setHealth(null)
      }
    })
  }, [])

  return {
    activeReports,
    respondersAvailable,
    avgResponseTimeMinutes: snapshotMetrics.avg,
    resolvedToday: snapshotMetrics.resolved,
    health,
  }
}
