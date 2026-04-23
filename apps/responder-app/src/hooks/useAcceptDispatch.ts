import { useEffect, useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../app/firebase'
import { awaitFreshAuthToken } from '../app/await-auth-token'

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
      const user = await awaitFreshAuthToken(auth)
      if (!user) throw new Error('auth_required')
      const fn = httpsCallable<{ dispatchId: string; idempotencyKey: string }, { status: string }>(
        functions,
        'acceptDispatch',
      )
      await fn({ dispatchId, idempotencyKey: keyRef.current })
    } catch (err: unknown) {
      console.error('[useAcceptDispatch] accept failed:', err)
      if (err instanceof Error) setError(err)
      else setError(new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }

  return { accept, loading, error }
}
