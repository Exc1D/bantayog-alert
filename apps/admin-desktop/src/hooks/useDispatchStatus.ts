import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../app/firebase'

export function useDispatchStatus(dispatchId: string | undefined): string | null {
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!dispatchId) {
      queueMicrotask(() => {
        setStatus(null)
      })
      return
    }
    return onSnapshot(
      doc(db, 'dispatches', dispatchId),
      (snap) => {
        setStatus(snap.exists() ? String(snap.data().status ?? '') : null)
      },
      () => {
        setStatus(null)
      },
    )
  }, [dispatchId])

  return status
}
