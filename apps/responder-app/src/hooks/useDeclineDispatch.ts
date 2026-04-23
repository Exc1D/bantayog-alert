import { useEffect, useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../app/firebase'
import { awaitFreshAuthToken } from '../app/await-auth-token'

interface DeclineDispatchRequest {
  dispatchId: string
  declineReason: string
  idempotencyKey: string
}

export function useDeclineDispatch(dispatchId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  const keyRef = useRef(crypto.randomUUID())

  useEffect(() => {
    keyRef.current = crypto.randomUUID()
  }, [dispatchId])

  async function decline(declineReason: string) {
    const trimmedReason = declineReason.trim()
    if (!trimmedReason) {
      const error = new Error('declineReason_required')
      setError(error)
      throw error
    }

    setLoading(true)
    setError(undefined)
    try {
      await awaitFreshAuthToken(auth)
      const fn = httpsCallable<DeclineDispatchRequest, { status: string }>(
        functions,
        'declineDispatch',
      )
      await fn({
        dispatchId,
        declineReason: trimmedReason,
        idempotencyKey: keyRef.current,
      })
    } catch (err: unknown) {
      console.error('[useDeclineDispatch] decline failed:', err)
      if (err instanceof Error) setError(err)
      else setError(new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }

  return { decline, loading, error }
}
