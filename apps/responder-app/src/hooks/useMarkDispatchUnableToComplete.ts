import { useEffect, useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../app/firebase'
import { awaitFreshAuthToken } from '../app/await-auth-token'

interface MarkDispatchUnableToCompleteRequest {
  dispatchId: string
  reason: string
  idempotencyKey: string
}

export function useMarkDispatchUnableToComplete(dispatchId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  const keyRef = useRef(crypto.randomUUID())

  useEffect(() => {
    keyRef.current = crypto.randomUUID()
  }, [dispatchId])

  async function markUnableToComplete(reason: string) {
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      const err = new Error('reason_required')
      setError(err)
      throw err
    }
    if (!dispatchId) {
      const err = new Error('dispatch_id_required')
      setError(err)
      throw err
    }
    setLoading(true)
    setError(undefined)
    try {
      const user = await awaitFreshAuthToken(auth)
      if (!user) throw new Error('auth_required')
      const fn = httpsCallable<
        MarkDispatchUnableToCompleteRequest,
        { status: 'unable_to_complete'; dispatchId: string }
      >(functions, 'markDispatchUnableToComplete')
      await fn({ dispatchId, reason: trimmedReason, idempotencyKey: keyRef.current })
    } catch (err: unknown) {
      const normalized = err instanceof Error ? err : new Error(String(err))
      console.error('[useMarkDispatchUnableToComplete]', normalized)
      setError(normalized)
      throw normalized
    } finally {
      setLoading(false)
    }
  }

  return { markUnableToComplete, loading, error }
}
