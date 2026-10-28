import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import { useCallableAction } from './useCallableAction'

interface MarkDispatchUnableToCompleteRequest {
  dispatchId: string
  reason: string
  idempotencyKey: string
}

export function useMarkDispatchUnableToComplete(dispatchId: string) {
  const { run, fail, loading, error } = useCallableAction(
    'useMarkDispatchUnableToComplete',
    dispatchId,
  )

  async function markUnableToComplete(reason: string) {
    const trimmedReason = reason.trim()
    if (!trimmedReason) fail('reason_required')
    if (!dispatchId) fail('dispatch_id_required')

    await run(async ({ idempotencyKey }) => {
      const fn = httpsCallable<
        MarkDispatchUnableToCompleteRequest,
        { status: 'unable_to_complete'; dispatchId: string }
      >(functions, 'markDispatchUnableToComplete')
      await fn({ dispatchId, reason: trimmedReason, idempotencyKey })
    })
  }

  return { markUnableToComplete, loading, error }
}
