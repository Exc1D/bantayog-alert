import { useCallback, useRef, useState } from 'react'
import { addDoc, collection } from 'firebase/firestore'
import type { Draft } from '../services/draft-store'
import { draftStore } from '../services/draft-store'
import { db } from '../services/firebase'
import { useOnlineStatus } from './useOnlineStatus'

export type SubmissionState =
  | 'idle'
  | 'submitting'
  | 'server_confirmed'
  | 'queued'
  | 'failed_retryable'
  | 'failed_terminal'

export interface UseSubmissionMachineOptions {
  draft: Draft
  onSuccess: (publicRef: string) => void
  onTerminal: () => void
}

export interface UseSubmissionMachineReturn {
  state: SubmissionState
  retryCount: number
  isOnline: boolean
  submit(): Promise<void>
  sendSmsFallback(): void
}

const SUBMIT_TIMEOUT_MS = 10_000
const MAX_RETRIES = 3

const swallow = (_err: unknown) => {
  void _err
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('net::') ||
      msg === 'timeout'
    )
  }
  return false
}

export function useSubmissionMachine({
  draft,
  onSuccess,
  onTerminal,
}: UseSubmissionMachineOptions): UseSubmissionMachineReturn {
  const { isOnline } = useOnlineStatus()

  const [state, setState] = useState<SubmissionState>(() =>
    draft.retryCount >= MAX_RETRIES ? 'failed_terminal' : 'idle',
  )
  const [retryCount, setRetryCount] = useState(() => draft.retryCount)

  const draftRef = useRef(draft)
  const retryCountRef = useRef(draft.retryCount)

  const persistRetryCount = useCallback(async (count: number) => {
    retryCountRef.current = count
    setRetryCount(count)
    await draftStore
      .save({ ...draftRef.current, retryCount: count, updatedAt: Date.now() })
      .catch(swallow)
  }, [])

  const doSubmit = useCallback(
    async (currentRetryCount: number): Promise<string | null> => {
      const d = draftRef.current
      await draftStore.save({
        ...d,
        syncState: 'syncing',
        retryCount: currentRetryCount,
        updatedAt: Date.now(),
      })

      try {
        const ref = await writeWithTimeout(d, SUBMIT_TIMEOUT_MS)
        await draftStore
          .save({ ...d, syncState: 'synced', retryCount: currentRetryCount })
          .catch(swallow)
        await draftStore.clear(d.id).catch(swallow)
        return ref
      } catch (err: unknown) {
        if (isNetworkError(err)) {
          await draftStore
            .save({
              ...d,
              syncState: 'syncing',
              retryCount: currentRetryCount,
              updatedAt: Date.now(),
            })
            .catch(swallow)
          setState('queued')
          return null
        }

        const nextRetryCount = currentRetryCount + 1
        await draftStore
          .save({ ...d, syncState: 'syncing', retryCount: nextRetryCount, updatedAt: Date.now() })
          .catch(swallow)

        if (nextRetryCount >= MAX_RETRIES) {
          await persistRetryCount(nextRetryCount)
          setState('failed_terminal')
          onTerminal()
          return null
        }

        await persistRetryCount(nextRetryCount)
        setState('failed_retryable')
        return null
      }
    },
    [onTerminal, persistRetryCount],
  )

  const submit = useCallback(async () => {
    if (state !== 'idle') {
      return
    }

    setState('submitting')

    const newRetryCount = retryCountRef.current + 1
    await persistRetryCount(newRetryCount)

    const publicRef = await doSubmit(newRetryCount)
    if (publicRef) {
      setState('server_confirmed')
      onSuccess(publicRef)
    }
  }, [state, doSubmit, onSuccess, persistRetryCount])

  const sendSmsFallback = useCallback(() => {
    const d = draftRef.current
    draftStore
      .save({ ...d, smsFallbackSentAt: Date.now(), syncState: 'local_only', updatedAt: Date.now() })
      .catch(swallow)
    setState('idle')
    retryCountRef.current = 0
    setRetryCount(0)
  }, [])

  return {
    state,
    retryCount,
    isOnline,
    submit,
    sendSmsFallback,
  }
}

async function writeWithTimeout(draft: Draft, ms: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('timeout'))
    }, ms)
    addDoc(collection(db(), 'report_inbox'), draft)
      .then((ref: { id: string }) => {
        clearTimeout(timer)
        resolve(ref.id)
      })
      .catch((err: unknown) => {
        clearTimeout(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      })
  })
}
