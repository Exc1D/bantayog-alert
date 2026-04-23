import { useEffect, useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'

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
      setError(new Error('declineReason_required'))
      return
    }

    setLoading(true)
    setError(undefined)
    try {
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
      if (err instanceof Error) setError(err)
      else setError(new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }

  return { decline, loading, error }
}
