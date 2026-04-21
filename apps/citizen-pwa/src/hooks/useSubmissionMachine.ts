import { useState, useCallback } from 'react'

export type SubmissionState =
  | 'idle'
  | 'submitting'
  | 'success'
  | 'queued'
  | 'failed_retryable'
  | 'failed_terminal'

export interface SubmissionMachineReturn {
  state: SubmissionState
  transition: (nextState: SubmissionState) => void
  dismiss: () => void
  setError: (error: { code: string; message: string }) => void
  incrementRetry: () => void
}

export function useSubmissionMachine(): SubmissionMachineReturn {
  const [state, setState] = useState<SubmissionState>('idle')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [retryCount, setRetryCount] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    setRetryCount((prev) => prev + 1)
  }, [])

  return {
    state,
    transition,
    dismiss,
    setError,
    incrementRetry,
  }
}
