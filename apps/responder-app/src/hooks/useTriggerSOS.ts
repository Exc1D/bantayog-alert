import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import { useCallableAction } from './useCallableAction'

interface TriggerSOSRequest {
  dispatchId: string
}

export function useTriggerSOS(dispatchId: string) {
  const { run, loading, error } = useCallableAction('useTriggerSOS', dispatchId)

  async function trigger() {
    await run(async () => {
      const fn = httpsCallable<TriggerSOSRequest, { status: 'sos_triggered'; dispatchId: string }>(
        functions,
        'triggerSOS',
      )
      await fn({ dispatchId })
    })
  }

  return { trigger, loading, error }
}
