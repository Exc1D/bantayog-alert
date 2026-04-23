import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from '../app/firebase'
import type { DispatchStatus } from '@bantayog/shared-types'
import {
  groupDispatchRows,
  getResponderUiState,
  type QueueDispatchRow,
} from '../lib/dispatch-presentation'

export interface OwnDispatchRow {
  dispatchId: string
  reportId: string
  status: DispatchStatus
  uiStatus: ReturnType<typeof getResponderUiState>
  dispatchedAt: Timestamp
  acknowledgementDeadlineAt?: Timestamp
}

export function useOwnDispatches(uid: string | undefined) {
  const [rows, setRows] = useState<OwnDispatchRow[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!uid) {
      queueMicrotask(() => {
        setRows([])
        setError(null)
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
              dispatchedAt: data.dispatchedAt as Timestamp,
            }
            if (data.acknowledgementDeadlineAt) {
              row.acknowledgementDeadlineAt = data.acknowledgementDeadlineAt as Timestamp
            }
            return row
          }),
        )
        setError(null)
      },
      (err) => {
        console.error('[useOwnDispatches] Firestore listener error:', err)
        setRows([])
        setError(err.message)
      },
    )
  }, [uid])
  const presentationRows: QueueDispatchRow[] = rows.map((row) => ({
    dispatchId: row.dispatchId,
    reportId: row.reportId,
    status: row.status,
    dispatchedAt: row.dispatchedAt.toMillis(),
    uiStatus: row.uiStatus,
    ...(row.acknowledgementDeadlineAt
      ? { acknowledgementDeadlineAt: row.acknowledgementDeadlineAt }
      : {}),
  }))
  return { rows, groups: groupDispatchRows(presentationRows), error }
}
