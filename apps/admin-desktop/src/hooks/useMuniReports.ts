import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy, limit, Timestamp } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface MuniReportRow {
  reportId: string
  status: string
  severityDerived: string
  createdAt: Timestamp
  municipalityLabel: string
}

export function useMuniReports(municipalityId: string | undefined) {
  const [rows, setRows] = useState<MuniReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!municipalityId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'reports'),
      where('municipalityId', '==', municipalityId),
      where('status', 'in', ['new', 'awaiting_verify', 'verified', 'assigned']),
      orderBy('createdAt', 'desc'),
      limit(100),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              reportId: d.id,
              status: String(data.status),
              severityDerived: String(data.severityDerived ?? 'medium'),
              createdAt: data.createdAt as Timestamp,
              municipalityLabel: String(data.municipalityLabel ?? ''),
            }
          }),
        )
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsub
  }, [municipalityId])

  return { rows, loading, error }
}
