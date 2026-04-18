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
  useEffect(() => {
    if (!uid) {
      return
    }
    const q = query(
      collection(db, 'dispatches'),
      where('assignedTo.uid', '==', uid),
      where('status', 'in', ['pending', 'accepted', 'acknowledged', 'in_progress']),
      orderBy('dispatchedAt', 'desc'),
    )
    return onSnapshot(q, (snap) => {
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
    })
  }, [uid])
  return rows
}
