import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../app/firebase'

export interface MuniReportRow {
  reportId: string
  status: string
  severity: string
  reportType?: string
  duplicateClusterId?: string
  barangayId?: string
  createdAt: Timestamp
  municipalityLabel: string
}

const ACTIVE_STATUSES = ['new', 'awaiting_verify', 'verified', 'assigned'] as const

export function useMuniReports(municipalityId: string | undefined) {
  const [limitCount, setLimitCount] = useState(100)
  const [reports, setReports] = useState<MuniReportRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!municipalityId) {
      queueMicrotask(() => {
        setReports([])
        setLoading(false)
      })
      return
    }
    queueMicrotask(() => {
      setLoading(true)
    })
    const q = query(
      collection(db, 'report_ops'),
      where('municipalityId', '==', municipalityId),
      where('status', 'in', ACTIVE_STATUSES),
      orderBy('createdAt', 'desc'),
      limit(limitCount + 1),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => {
          const data = d.data()
          const row: MuniReportRow = {
            reportId: d.id,
            status: String(data.status),
            severity: String(data.severity ?? 'medium'),
            createdAt: data.createdAt as Timestamp,
            municipalityLabel: String(data.municipalityLabel ?? ''),
          }
          if (data.reportType !== undefined) row.reportType = String(data.reportType)
          if (data.duplicateClusterId !== undefined)
            row.duplicateClusterId = String(data.duplicateClusterId)
          if (data.barangayId !== undefined) row.barangayId = String(data.barangayId)
          return row
        })
        setHasMore(all.length > limitCount)
        setReports(all.slice(0, limitCount))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsub
  }, [municipalityId, limitCount])

  return {
    reports,
    hasMore,
    loadMore: () => {
      setLimitCount((n) => n + 100)
    },
    loading,
    error,
  }
}
