import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import { useCallableAction } from './useCallableAction'

export function useAcceptDispatch(dispatchId: string) {
  const { run, loading, error } = useCallableAction('useAcceptDispatch', dispatchId)

  async function accept() {
    await run(async ({ idempotencyKey }) => {
      const fn = httpsCallable<{ dispatchId: string; idempotencyKey: string }, { status: string }>(
        functions,
        'acceptDispatch',
      )
      await fn({ dispatchId, idempotencyKey })
    })
  }

  return { accept, loading, error }
}
