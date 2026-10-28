import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import type { DispatchStatus } from '@bantayog/shared-types'
import type { AdvanceDispatchRequest, AdvanceDispatchTarget } from '@bantayog/shared-validators'
import { useCallableAction } from './useCallableAction'

export function useAdvanceDispatch(dispatchId: string) {
  const { run, loading, error, keyRef } = useCallableAction('useAdvanceDispatch', dispatchId)

  async function advance(to: AdvanceDispatchTarget, extras?: { resolutionSummary?: string }) {
    await run(async ({ idempotencyKey }) => {
      if (to === 'resolved' && !extras?.resolutionSummary) {
        throw new Error('resolutionSummary_required')
      }
      const advanceDispatch = httpsCallable<AdvanceDispatchRequest, { status: DispatchStatus }>(
        functions,
        'advanceDispatch',
      )
      const payload: AdvanceDispatchRequest = { dispatchId, to, idempotencyKey }
      if (typeof extras?.resolutionSummary === 'string') {
        payload.resolutionSummary = extras.resolutionSummary
      }
      await advanceDispatch(payload)
      // Each step (en_route → on_scene → resolved) is a distinct action and needs its own key.
      keyRef.current = crypto.randomUUID()
    })
  }

  return { advance, loading, error }
}
