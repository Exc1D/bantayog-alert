import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '../app/firebase'
import type { DispatchStatus } from '@bantayog/shared-types'
import {
  groupDispatchRows,
  getResponderUiState,
  type QueueDispatchRow,
} from '../lib/dispatch-presentation'
import { toMillis } from '../lib/to-millis'

export interface OwnDispatchRow {
  dispatchId: string
  reportId: string
  status: DispatchStatus
  uiStatus: ReturnType<typeof getResponderUiState>
  dispatchedAt: number
  acknowledgementDeadlineAt?: number
}

export function useOwnDispatches(uid: string | undefined) {
  const [rows, setRows] = useState<OwnDispatchRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [loading, setLoading] = useState(!!uid)

  const retry = () => {
    setRetryCount((c) => c + 1)
  }

  useEffect(() => {
    if (!uid) {
      queueMicrotask(() => {
        setRows([])
        setError(null)
        setLoading(false)
      })
      return
    }
    const q = query(
      collection(db, 'dispatches'),
      where('assignedTo.uid', '==', uid),
      where('status', 'in', ['pending', 'accepted', 'acknowledged', 'en_route', 'on_scene']),
      orderBy('dispatchedAt', 'desc'),
    )
    return onSnapshot(
      q,
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data()
            const status = data.status as DispatchStatus
            const row: OwnDispatchRow = {
              dispatchId: d.id,
              reportId: String(data.reportId),
              status,
              uiStatus: getResponderUiState(status),
              dispatchedAt: toMillis(data.dispatchedAt) ?? 0,
            }
            if (data.acknowledgementDeadlineAt) {
              const deadline = toMillis(data.acknowledgementDeadlineAt)
              if (deadline !== undefined) {
                row.acknowledgementDeadlineAt = deadline
              }
            }
            return row
          }),
        )
        setError(null)
        setLoading(false)
      },
      (err) => {
        console.error('[useOwnDispatches] Firestore listener error:', err)
        setRows([])
        setError(err.message)
        setLoading(false)
      },
    )
  }, [uid, retryCount])
  const presentationRows: QueueDispatchRow[] = rows.map((row) => ({
    dispatchId: row.dispatchId,
    reportId: row.reportId,
    status: row.status,
    dispatchedAt: row.dispatchedAt,
    uiStatus: row.uiStatus,
    ...(row.acknowledgementDeadlineAt != null
      ? { acknowledgementDeadlineAt: row.acknowledgementDeadlineAt }
      : {}),
  }))
  return { rows, groups: groupDispatchRows(presentationRows), error, retry, loading }
}
