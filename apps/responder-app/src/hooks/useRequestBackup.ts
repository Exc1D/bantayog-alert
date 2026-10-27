import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import { useCallableAction } from './useCallableAction'

interface RequestBackupRequest {
  dispatchId: string
  reason: string
  idempotencyKey: string
}

export function useRequestBackup(dispatchId: string) {
  const { run, fail, loading, error } = useCallableAction('useRequestBackup', dispatchId)

  async function request(reason: string) {
    const trimmedReason = reason.trim()
    if (!trimmedReason) fail('reason_required')
    if (!dispatchId) fail('dispatch_id_required')

    await run(async ({ idempotencyKey }) => {
      const fn = httpsCallable<
        RequestBackupRequest,
        { status: 'requested'; backupRequestId: string }
      >(functions, 'requestBackup')
      await fn({ dispatchId, reason: trimmedReason, idempotencyKey })
    })
  }

  return { request, loading, error }
}
