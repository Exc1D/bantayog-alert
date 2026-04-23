import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../app/firebase'
import type { DispatchStatus } from '@bantayog/shared-types'
import {
  getResponderUiState,
  getTerminalSurface,
  type ResponderUiState,
  type TerminalSurface,
} from '../lib/dispatch-presentation'

export interface DispatchDoc {
  dispatchId: string
  reportId: string
  assignedTo: { uid: string; agencyId: string; municipalityId: string }
  dispatchedBy: string
  dispatchedByRole: string
  dispatchedAt: number
  status: DispatchStatus
  lastStatusAt: number
  acknowledgementDeadlineAt?: number
  acknowledgedAt?: number
  enRouteAt?: number
  onSceneAt?: number
  resolvedAt?: number
  cancelledAt?: number
  cancelledBy?: string
  cancelReason?: string
  declineReason?: string
  resolutionSummary?: string
  proofPhotoUrl?: string
  requestedByMunicipalAdmin?: boolean
  requestId?: string
  idempotencyKey?: string
  idempotencyPayloadHash?: string
  schemaVersion?: number
  uiStatus: ResponderUiState
  terminalSurface: TerminalSurface
}

export function useDispatch(dispatchId: string | undefined) {
  const [dispatch, setDispatch] = useState<DispatchDoc | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>(undefined)

  useEffect(() => {
    if (!dispatchId) {
      queueMicrotask(() => {
        setDispatch(undefined)
        setLoading(false)
      })
      return
    }
    const unsub = onSnapshot(
      doc(db, 'dispatches', dispatchId),
      (snap) => {
        if (!snap.exists()) {
          setDispatch(undefined)
        } else {
          const data = snap.data()
          const status = data.status as DispatchStatus
          setDispatch({
            ...(data as Omit<DispatchDoc, 'dispatchId' | 'uiStatus' | 'terminalSurface'>),
            dispatchId: snap.id,
            status,
            uiStatus: getResponderUiState(status),
            terminalSurface: getTerminalSurface(status),
          })
        }
        setLoading(false)
      },
      (err) => {
        setError(err as Error)
        setLoading(false)
      },
    )
    return unsub
  }, [dispatchId])

  return { dispatch, loading, error }
}
