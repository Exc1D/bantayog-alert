import { useCallback, useEffect, useRef, useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
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
export const MAX_RETRIES = 3

const logDraftError = (context: string, err: unknown) => {
  console.warn(`[draft-store] ${context}:`, err)
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
      .catch((e: unknown) => {
        logDraftError('persist retryCount', e)
      })
  }, [])

  const doSubmit = useCallback(
    async (currentRetryCount: number): Promise<string | null> => {
      const d = draftRef.current
      const attemptCount = currentRetryCount + 1
      await draftStore.save({
        ...d,
        syncState: 'syncing',
        retryCount: attemptCount,
        updatedAt: Date.now(),
      })

      try {
        const ref = await writeWithTimeout(d, SUBMIT_TIMEOUT_MS)
        await draftStore
          .save({ ...d, syncState: 'synced', retryCount: attemptCount })
          .catch((e: unknown) => {
            logDraftError('save synced', e)
          })
        await draftStore.clear(d.id).catch((e: unknown) => {
          logDraftError('clear draft', e)
        })
        return ref
      } catch (err: unknown) {
        if (isNetworkError(err)) {
          await draftStore
            .save({
              ...d,
              syncState: 'syncing',
              retryCount: attemptCount,
              updatedAt: Date.now(),
            })
            .catch((e: unknown) => {
              logDraftError('save queued', e)
            })
          setState('queued')
          return null
        }

        await persistRetryCount(attemptCount)

        if (attemptCount >= MAX_RETRIES) {
          setState('failed_terminal')
          onTerminal()
          return null
        }

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

    const publicRef = await doSubmit(retryCountRef.current)
    if (publicRef) {
      setState('server_confirmed')
      onSuccess(publicRef)
    }
  }, [state, doSubmit, onSuccess])

  const sendSmsFallback = useCallback(() => {
    const d = draftRef.current
    draftStore
      .save({
        ...d,
        smsFallbackSentAt: Date.now(),
        syncState: 'local_only',
        retryCount: 0,
        updatedAt: Date.now(),
      })
      .catch((e: unknown) => {
        logDraftError('sms fallback save', e)
      })
    draftRef.current = { ...d, retryCount: 0 }
    setState('idle')
    retryCountRef.current = 0
    setRetryCount(0)
  }, [])

  useEffect(() => {
    if (!isOnline) {
      return
    }
    if (state !== 'queued' && state !== 'failed_retryable') {
      return
    }
    const triggerRetry = () => {
      setState('submitting')
      void doSubmit(retryCountRef.current).then((publicRef) => {
        if (publicRef) {
          setState('server_confirmed')
          onSuccess(publicRef)
        }
      })
    }
    triggerRetry()
  }, [isOnline, state, doSubmit, onSuccess])

  return {
    state,
    retryCount,
    isOnline,
    submit,
    sendSmsFallback,
  }
}

async function writeWithTimeout(draft: Draft, ms: number): Promise<string> {
  const docId = draft.clientDraftRef
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('timeout'))
    }, ms)
    setDoc(doc(db(), 'report_inbox', docId), draft)
      .then(() => {
        clearTimeout(timer)
        resolve(docId)
      })
      .catch((err: unknown) => {
        clearTimeout(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      })
  })
}
