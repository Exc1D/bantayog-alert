import { useCallback, useEffect, useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../app/firebase'
import { awaitFreshAuthToken } from '../app/await-auth-token'
import type { DispatchStatus } from '@bantayog/shared-types'
import type { AdvanceDispatchRequest, AdvanceDispatchTarget } from '@bantayog/shared-validators'

export function useAdvanceDispatch(dispatchId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)
  const keyRef = useRef(crypto.randomUUID())

  useEffect(() => {
    keyRef.current = crypto.randomUUID()
  }, [dispatchId])

  const advance = useCallback(
    async function (to: AdvanceDispatchTarget, extras?: { resolutionSummary?: string }) {
      setLoading(true)
      setError(undefined)
      try {
        if (to === 'resolved' && !extras?.resolutionSummary) {
          throw new Error('resolutionSummary_required')
        }
        const user = await awaitFreshAuthToken(auth)
        if (!user) throw new Error('auth_required')
        const advanceDispatch = httpsCallable<AdvanceDispatchRequest, { status: DispatchStatus }>(
          functions,
          'advanceDispatch',
        )
        const payload: AdvanceDispatchRequest = {
          dispatchId,
          to,
          idempotencyKey: keyRef.current,
        }
        if (typeof extras?.resolutionSummary === 'string') {
          payload.resolutionSummary = extras.resolutionSummary
        }
        await advanceDispatch(payload)
        keyRef.current = crypto.randomUUID()
      } catch (err: unknown) {
        console.error('[useAdvanceDispatch] advance failed:', err)
        const normalized = err instanceof Error ? err : new Error(String(err))
        setError(normalized)
        throw normalized
      } finally {
        setLoading(false)
      }
    },
    [dispatchId],
  )

  return { advance, loading, error }
}
