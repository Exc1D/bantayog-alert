import { useCallback, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import type { DispatchStatus } from '@bantayog/shared-types'
import type { AdvanceDispatchRequest, AdvanceDispatchTarget } from '@bantayog/shared-validators'

export function useAdvanceDispatch(dispatchId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)

  const advance = useCallback(
    async function (to: AdvanceDispatchTarget, extras?: { resolutionSummary?: string }) {
      setLoading(true)
      setError(undefined)
      try {
        if (to === 'resolved' && !extras?.resolutionSummary) {
          throw new Error('resolutionSummary_required')
        }
        const advanceDispatch = httpsCallable<AdvanceDispatchRequest, { status: DispatchStatus }>(
          functions,
          'advanceDispatch',
        )
        await advanceDispatch({
          dispatchId,
          to,
          resolutionSummary: extras?.resolutionSummary,
          idempotencyKey: crypto.randomUUID(),
        })
      } catch (err: unknown) {
        if (err instanceof Error) setError(err)
        else setError(new Error(String(err)))
      } finally {
        setLoading(false)
      }
    },
    [dispatchId],
  )

  return { advance, loading, error }
}
