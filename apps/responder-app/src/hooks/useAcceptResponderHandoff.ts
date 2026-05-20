import { useEffect, useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../app/firebase'
import { awaitFreshAuthToken } from '../app/await-auth-token'

export function useAcceptResponderHandoff(handoffId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  const keyRef = useRef(crypto.randomUUID())

  useEffect(() => {
    keyRef.current = crypto.randomUUID()
  }, [handoffId])

  async function accept() {
    setLoading(true)
    setError(undefined)
    try {
      const user = await awaitFreshAuthToken(auth)
      if (!user) throw new Error('auth_required')
      const fn = httpsCallable<
        { handoffId: string; idempotencyKey: string },
        { success: true } | { success: false; errorCode: string }
      >(functions, 'acceptResponderHandoff')
      await fn({ handoffId, idempotencyKey: keyRef.current })
    } catch (err: unknown) {
      console.error('[useAcceptResponderHandoff] accept failed:', err)
      const normalized = err instanceof Error ? err : new Error(String(err))
      setError(normalized)
      throw normalized
    } finally {
      setLoading(false)
    }
  }

  return { accept, loading, error }
}
