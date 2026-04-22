import { useState, useCallback } from 'react'

const MAX_RETRY_COUNT = 3

export type SubmissionState =
  | 'idle'
  | 'submitting'
  | 'success'
  | 'queued'
  | 'failed_retryable'
  | 'failed_terminal'
  | 'closed'

export interface SubmissionMachineReturn {
  state: SubmissionState
  transition: (nextState: SubmissionState) => void
  dismiss: () => void
  setError: (error: { code: string; message: string }) => void
  incrementRetry: () => void
  retryCount: number
  lastError: { code: string; message: string; timestamp: number } | null
}

export function useSubmissionMachine(): SubmissionMachineReturn {
  const [state, setState] = useState<SubmissionState>('idle')

  const [retryCount, setRetryCount] = useState(0)

  const [lastError, setLastError] = useState<{
    code: string
    message: string
    timestamp: number
  } | null>(null)

  const transition = useCallback((nextState: SubmissionState) => {
    setState(nextState)
    // Reset retry counter when transitioning to queued or success
    if (nextState === 'queued' || nextState === 'success') {
      setRetryCount(0)
      setLastError(null)
    }
  }, [])

  const dismiss = useCallback(() => {
    if (state === 'success') {
      setState('closed')
    }
  }, [state])

  const setError = useCallback((error: { code: string; message: string }) => {
    setLastError({ ...error, timestamp: Date.now() })
  }, [])

  const incrementRetry = useCallback(() => {
    setRetryCount((prev) => {
      const newCount = prev + 1
      if (newCount >= MAX_RETRY_COUNT) {
        setState('failed_terminal')
      }
      return newCount
    })
  }, [])

  return {
    state,
    transition,
    dismiss,
    setError,
    incrementRetry,
    retryCount,
    lastError,
  }
}
