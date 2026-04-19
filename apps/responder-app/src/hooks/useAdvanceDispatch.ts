import { useCallback, useState } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../app/firebase'
import type { DispatchStatus } from '@bantayog/shared-types'

export function useAdvanceDispatch(dispatchId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)

  const advance = useCallback(
    async function (to: DispatchStatus, extras?: { resolutionSummary?: string }) {
      setLoading(true)
      setError(undefined)
      try {
        const ref = doc(db, 'dispatches', dispatchId)
        const patch: Record<string, unknown> = {
          status: to,
          lastStatusAt: serverTimestamp(),
        }
        if (to === 'resolved') {
          if (!extras?.resolutionSummary) {
            throw new Error('resolutionSummary_required')
          }
          patch.resolutionSummary = extras.resolutionSummary
        }
        await updateDoc(ref, patch)
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
