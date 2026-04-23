import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../app/firebase'
import {
  dispatchDocSchema,
  type DispatchDoc as SharedDispatchDoc,
} from '@bantayog/shared-validators'
import {
  getResponderUiState,
  getTerminalSurface,
  type ResponderUiState,
  type TerminalSurface,
} from '../lib/dispatch-presentation'

export type DispatchDoc = SharedDispatchDoc & {
  dispatchId: string
  uiStatus: ResponderUiState
  terminalSurface: TerminalSurface
}

function toMillis(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'toMillis' in value) {
    const candidate = value as { toMillis: () => number }
    if (typeof candidate.toMillis === 'function') {
      return candidate.toMillis()
    }
  }
  return undefined
}

function normalizeDispatchSnapshot(data: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}
  const schemaKeys = [
    'reportId',
    'assignedTo',
    'dispatchedBy',
    'dispatchedByRole',
    'dispatchedAt',
    'status',
    'statusUpdatedAt',
    'acknowledgementDeadlineAt',
    'acknowledgedAt',
    'enRouteAt',
    'onSceneAt',
    'resolvedAt',
    'cancelledAt',
    'cancelledBy',
    'cancelReason',
    'timeoutReason',
    'declineReason',
    'resolutionSummary',
    'proofPhotoUrl',
    'requestedByMunicipalAdmin',
    'requestId',
    'idempotencyKey',
    'idempotencyPayloadHash',
    'schemaVersion',
  ] as const

  for (const key of schemaKeys) {
    if (key in data) {
      normalized[key] = data[key]
    }
  }

  const millisFields = [
    'dispatchedAt',
    'statusUpdatedAt',
    'acknowledgementDeadlineAt',
    'acknowledgedAt',
    'enRouteAt',
    'onSceneAt',
    'resolvedAt',
    'cancelledAt',
  ] as const

  for (const field of millisFields) {
    const value = toMillis(normalized[field])
    if (typeof value === 'number') {
      normalized[field] = value
    }
  }

  return normalized
}

export function useDispatch(dispatchId: string | undefined) {
  const [dispatch, setDispatch] = useState<DispatchDoc | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>(undefined)

  useEffect(() => {
    if (!dispatchId) {
      queueMicrotask(() => {
        setDispatch(undefined)
        setError(undefined)
        setLoading(false)
      })
      return
    }
    const unsub = onSnapshot(
      doc(db, 'dispatches', dispatchId),
      (snap) => {
        try {
          if (!snap.exists()) {
            setDispatch(undefined)
            setError(undefined)
            return
          }

          const parsed = dispatchDocSchema.parse(
            normalizeDispatchSnapshot(snap.data() as Record<string, unknown>),
          )
          setDispatch({
            ...parsed,
            dispatchId: snap.id,
            uiStatus: getResponderUiState(parsed.status),
            terminalSurface: getTerminalSurface(parsed.status),
          })
          setError(undefined)
        } catch (err: unknown) {
          console.error('[useDispatch] snapshot mapping failed:', err)
          setDispatch(undefined)
          setError(err instanceof Error ? err : new Error(String(err)))
        } finally {
          setLoading(false)
        }
      },
      (err) => {
        const error = err as { code?: string; message?: string }
        console.error('[useDispatch] listener error:', error.code, error.message)
        setError(err as Error)
        setLoading(false)
      },
    )
    return unsub
  }, [dispatchId])

  return { dispatch, loading, error }
}
