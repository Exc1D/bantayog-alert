import { useEffect, useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'

export function useAcceptDispatch(dispatchId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  // Idempotency key generated once per hook mount — equivalent to 30-second client memory
  const keyRef = useRef(crypto.randomUUID())
  useEffect(() => {
    keyRef.current = crypto.randomUUID()
  }, [dispatchId])

  async function accept() {
    setLoading(true)
    setError(undefined)
    try {
      const fn = httpsCallable<{ dispatchId: string; idempotencyKey: string }, { status: string }>(
        functions,
        'acceptDispatch',
      )
      await fn({ dispatchId, idempotencyKey: keyRef.current })
    } catch (err: unknown) {
      if (err instanceof Error) setError(err)
      else setError(new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }

  return { accept, loading, error }
}
