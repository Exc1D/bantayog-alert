/**
 * useQuickStatus Hook
 *
 * Provides optimistic status updates for responder dispatch workflow.
 * Updates are validated pre-flight then written optimistically with rollback on failure.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { runTransaction, doc, getFirestore, arrayUnion } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { canUpdateStatus } from '../services/validation.service'
import type { QuickStatus } from '../types'
import type { QuickStatusError } from '../types'

interface UseQuickStatusReturn {
  updateStatus: (dispatchId: string, status: QuickStatus) => Promise<void>
  isUpdating: boolean
  error: QuickStatusError | null
  pendingStatus: Map<string, QuickStatus>
  isValidating: boolean
}

export function useQuickStatus(): UseQuickStatusReturn {
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<QuickStatusError | null>(null)
  const [pendingStatus, setPendingStatus] = useState<Map<string, QuickStatus>>(new Map())
  const [isValidating, setIsValidating] = useState(false)
  // Store timer ID to clear on unmount — prevents state update on dead component
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateStatus = useCallback(async (dispatchId: string, status: QuickStatus): Promise<void> => {
    setIsUpdating(true)
    setIsValidating(true)
    setError(null) // Clear any previous error; isValidating signals "validating" state

    try {
      // Pre-flight validation
      const validationResult = await canUpdateStatus(dispatchId, status)
      if (!validationResult.valid) {
        const isNotAssigned = validationResult.code === 'NOT_ASSIGNED'
        const errorCode = isNotAssigned ? 'NOT_ASSIGNED' : 'INVALID_STATUS'
        setError({
          code: errorCode,
          message: validationResult.message || 'Validation failed',
          isFatal: isNotAssigned
        } as QuickStatusError)
        return
      }

      setIsValidating(false)
      setError(null)

      // Optimistic update
      setPendingStatus((prev) => new Map(prev).set(dispatchId, status))

      // Attempt online write
      try {
        await runTransaction(getFirestore(), async (transaction) => {
          const dispatchRef = doc(getFirestore(), 'report_ops', dispatchId)
          const dispatchSnap = await transaction.get(dispatchRef)

          if (!dispatchSnap.exists()) {
            throw Object.assign(new Error('Dispatch not found'), { code: 'not-found' })
          }

          transaction.update(dispatchRef, {
            responderStatus: status,
            statusUpdatedAt: Date.now(),
            timeline: arrayUnion({
              type: 'status_change',
              from: dispatchSnap.data().responderStatus,
              to: status,
              timestamp: Date.now(),
              actor: 'responder',
              actorId: (await getAuth().currentUser)?.uid || ''
            })
          })
        })

        // Success: clear after 500ms for visual confirmation
        // Clear any existing timer first to prevent double-clearing
        if (successTimerRef.current) {
          clearTimeout(successTimerRef.current)
        }
        successTimerRef.current = setTimeout(() => {
          setPendingStatus((prev) => {
            const next = new Map(prev)
            if (next.get(dispatchId) === status) {
              next.delete(dispatchId)
            }
            return next
          })
        }, 500)

      } catch (networkError: unknown) {
        const errorCode = (networkError as { code?: string })?.code

        if (errorCode === 'unavailable' || errorCode === 'deadline-exceeded') {
          // Clear pending status since we cannot roll back (no offline queue implemented)
          setPendingStatus((prev) => {
            const next = new Map(prev)
            next.delete(dispatchId)
            return next
          })
          setError({
            code: 'NETWORK_ERROR',
            message: 'Connection unavailable. Please try again when online.',
            isFatal: false
          })
          console.error('[QUICK_STATUS_ERROR]', 'Network unavailable:', errorCode)
          return
        }

        throw networkError
      }

    } catch (err: unknown) {
      // Rollback optimistic state
      setPendingStatus((prev) => {
        const next = new Map(prev)
        next.delete(dispatchId)
        return next
      })

      const errorCode = (err as { code?: string })?.code

      if (errorCode === 'permission-denied') {
        setError({
          code: 'PERMISSION_DENIED',
          message: 'Your session has expired. Please log in again.',
          isFatal: true
        })
        console.error('[QUICK_STATUS_ERROR]', 'Permission denied:', err)
      } else if (errorCode === 'not-found') {
        setError({
          code: 'NOT_ASSIGNED',
          message: 'This dispatch no longer exists or has been reassigned.',
          isFatal: true
        })
        console.error('[QUICK_STATUS_ERROR]', 'Dispatch not found:', err)
      } else {
        setError({
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Failed to update status',
          isFatal: false
        })
        console.error('[QUICK_STATUS_ERROR]', 'Transaction failed:', err)
      }
    } finally {
      setIsUpdating(false)
      setIsValidating(false)
    }
  }, [])

  // Clear success timer on unmount — prevents state update on dead component
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current)
      }
    }
  }, [])

  return { updateStatus, isUpdating, error, pendingStatus, isValidating }
}