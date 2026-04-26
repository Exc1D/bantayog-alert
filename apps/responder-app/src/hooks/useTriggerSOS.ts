import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../app/firebase'
import { awaitFreshAuthToken } from '../app/await-auth-token'

interface TriggerSOSRequest {
  dispatchId: string
}

export function useTriggerSOS(dispatchId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()

  async function trigger() {
    setLoading(true)
    setError(undefined)
    try {
      const user = await awaitFreshAuthToken(auth)
      if (!user) throw new Error('auth_required')
      const fn = httpsCallable<TriggerSOSRequest, { status: 'sos_triggered'; dispatchId: string }>(
        functions,
        'triggerSOS',
      )
      await fn({ dispatchId })
    } catch (err: unknown) {
      console.error('[useTriggerSOS] trigger failed:', err)
      if (err instanceof Error) setError(err)
      else setError(new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }

  return { trigger, loading, error }
}
