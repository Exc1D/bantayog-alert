import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import { useCallableAction } from './useCallableAction'

interface DeclineDispatchRequest {
  dispatchId: string
  declineReason: string
  idempotencyKey: string
}

export function useDeclineDispatch(dispatchId: string) {
  const { run, fail, loading, error } = useCallableAction('useDeclineDispatch', dispatchId)

  async function decline(declineReason: string) {
    const trimmedReason = declineReason.trim()
    if (!trimmedReason) fail('declineReason_required')

    await run(async ({ idempotencyKey }) => {
      const fn = httpsCallable<DeclineDispatchRequest, { status: string }>(
        functions,
        'declineDispatch',
      )
      await fn({ dispatchId, declineReason: trimmedReason, idempotencyKey })
    })
  }

  return { decline, loading, error }
}
