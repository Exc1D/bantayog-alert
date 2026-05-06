import { useEffect, useState } from 'react'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../app/firebase'
import type { DispatchStatus } from '@bantayog/shared-types'

const TERMINAL_STATUSES: DispatchStatus[] = [
  'resolved',
  'declined',
  'timed_out',
  'cancelled',
  'unable_to_complete',
]

export interface DispatchHistoryRow {
  dispatchId: string
  reportId: string
  status: DispatchStatus
  dispatchedAt: number
  resolvedAt?: number
}

function toMs(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  if (v !== null && typeof v === 'object' && 'toMillis' in v) {
    return (v as { toMillis: () => number }).toMillis()
  }
  return undefined
}

export function useDispatchHistory(uid: string | undefined, maxRows = 20) {
  const [history, setHistory] = useState<DispatchHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) {
      queueMicrotask(() => {
        setHistory([])
        setLoading(false)
      })
      return
    }

    const q = query(
      collection(db, 'dispatches'),
      where('assignedTo.uid', '==', uid),
      where('status', 'in', TERMINAL_STATUSES),
      orderBy('dispatchedAt', 'desc'),
      limit(maxRows),
    )

    return onSnapshot(
      q,
      (snap) => {
        setHistory(
          snap.docs.map((d) => {
            const data = d.data()
            const row: DispatchHistoryRow = {
              dispatchId: d.id,
              reportId: String(data.reportId),
              status: data.status as DispatchStatus,
              dispatchedAt: toMs(data.dispatchedAt) ?? 0,
            }
            const resolved = toMs(data.resolvedAt)
            if (resolved != null) row.resolvedAt = resolved
            return row
          }),
        )
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[useDispatchHistory] listener error:', err)
        setError(err.message)
        setLoading(false)
      },
    )
  }, [uid, maxRows])

  return { history, loading, error }
}
