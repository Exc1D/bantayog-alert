import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface OwnDispatchRow {
  dispatchId: string
  reportId: string
  status: string
  dispatchedAt: Timestamp
  acknowledgementDeadlineAt?: Timestamp
}

export function useOwnDispatches(uid: string | undefined) {
  const [rows, setRows] = useState<OwnDispatchRow[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!uid) {
      setRows([])
      setError(null)
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
            const row: OwnDispatchRow = {
              dispatchId: d.id,
              reportId: String(data.reportId),
              status: String(data.status),
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
  return { rows, error }
}
