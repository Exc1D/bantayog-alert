import { useCallback, useEffect, useRef, useState } from 'react'
import type { Draft } from '../services/draft-store'
import { draftStore } from '../services/draft-store'
import { ensureSignedIn } from '../services/firebase'
import {
  submitCitizenReport,
  type SubmitCitizenReportInput,
  type SubmitCitizenReportResult,
} from '../services/callables'
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

function isValidContact(contact: { phone?: string; smsConsent?: boolean }): boolean {
  return (
    typeof contact.phone === 'string' &&
    contact.phone.trim().length > 0 &&
    typeof contact.smsConsent === 'boolean'
  )
}

// Exponential backoff between retries when the network was the problem.
// Capped at 30s so a long flaky window doesn't push retries hours apart.
const BACKOFF_BASE_MS = 2_000
const BACKOFF_CAP_MS = 30_000

export function backoffDelay(retryCount: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** retryCount, BACKOFF_CAP_MS)
}

const logDraftError = (context: string, err: unknown) => {
  console.warn(`[draft-store] ${context}:`, err)
}

export interface SubmitDraftOnlineDeps {
  ensureSignedIn(): Promise<string>
  submitCitizenReport(input: SubmitCitizenReportInput): Promise<SubmitCitizenReportResult>
  timeoutMs?: number
}

function buildSubmitCitizenReportInput(draft: Draft): SubmitCitizenReportInput {
  return {
    clientCreatedAt: draft.clientCreatedAt,
    idempotencyKey: draft.idempotencyKey,
    publicRef: draft.publicRef,
    secretHash: draft.secretHash,
    correlationId: draft.correlationId,
    payload: {
      reportType: draft.reportType,
      description: draft.description,
      severity: draft.severity,
      source: 'web',
      clientDraftRef: draft.clientDraftRef,
      ...(draft.location ? { publicLocation: draft.location } : {}),
      ...(draft.municipalityId ? { municipalityId: draft.municipalityId } : {}),
      ...(draft.barangayId ? { barangayId: draft.barangayId } : {}),
      ...(draft.nearestLandmark ? { nearestLandmark: draft.nearestLandmark } : {}),
      ...(draft.contact && isValidContact(draft.contact)
        ? {
            contact: {
              phone: draft.contact.phone.trim(),
              smsConsent: draft.contact.smsConsent,
            },
          }
        : {}),
    },
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('timeout'))
    }, ms)
    promise
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((err: unknown) => {
        clearTimeout(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      })
  })
}

export async function submitDraftOnline(
  draft: Draft,
  deps: SubmitDraftOnlineDeps,
): Promise<string> {
  await deps.ensureSignedIn()
  const submit = deps.submitCitizenReport(buildSubmitCitizenReportInput(draft))
  const result =
    deps.timeoutMs === undefined ? await submit : await withTimeout(submit, deps.timeoutMs)
  return result.publicRef
}

function isNetworkError(err: unknown): boolean {
  // Firebase auth/network-request-failed is transient and behaves like a network error
  if (err !== null && typeof err === 'object' && 'code' in err) {
    if (String(err.code) === 'auth/network-request-failed') return true
  }
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

// Firebase auth and App Check errors will not succeed on retry — go terminal
// immediately to avoid burning all retries on unrecoverable token issues.
function isNonRetryableError(err: unknown): boolean {
  if (err !== null && typeof err === 'object' && 'code' in err) {
    const code = String(err.code)
    return code.startsWith('auth/') || code.startsWith('appCheck/')
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

      try {
        await draftStore.save({
          ...d,
          syncState: 'syncing',
          retryCount: attemptCount,
          updatedAt: Date.now(),
        })

        const ref = await submitDraftOnline(d, {
          ensureSignedIn,
          submitCitizenReport,
          timeoutMs: SUBMIT_TIMEOUT_MS,
        })
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
          retryCountRef.current = attemptCount
          setRetryCount(attemptCount)
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
          // Register SW background sync for queued drafts (best-effort).
          try {
            const reg = await navigator.serviceWorker.ready
            if ((reg as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync) {
              await (
                reg as unknown as { sync: { register: (tag: string) => Promise<void> } }
              ).sync.register('submit-report')
            }
          } catch (err: unknown) {
            console.warn('[useSubmissionMachine] Background Sync registration failed:', err)
          }
          return null
        }

        if (isNonRetryableError(err)) {
          console.warn('[SubmissionPanel] Non-retryable error — going terminal immediately', err)
          await persistRetryCount(MAX_RETRIES)
          setState('failed_terminal')
          onTerminal()
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

    // Skip the 10s Firestore timeout when we know we're already offline.
    if (!isOnline) {
      setState('queued')
      try {
        const reg = await navigator.serviceWorker.ready
        if ((reg as unknown as { sync?: { register(tag: string): Promise<void> } }).sync) {
          await (
            reg as unknown as { sync: { register(tag: string): Promise<void> } }
          ).sync.register('submit-report')
        }
      } catch {
        // Background Sync is best-effort; ignore registration failures
      }
      return
    }

    setState('submitting')

    const publicRef = await doSubmit(retryCountRef.current)
    if (publicRef) {
      setState('server_confirmed')
      onSuccess(publicRef)
    }
  }, [state, isOnline, doSubmit, onSuccess])

  const sendSmsFallback = useCallback(() => {
    const d = draftRef.current
    const now = Date.now()
    const nextDraft = {
      ...d,
      smsFallbackSentAt: now,
      syncState: 'local_only' as const,
      retryCount: 0,
      updatedAt: now,
    }
    draftStore.save(nextDraft).catch((e: unknown) => {
      logDraftError('sms fallback save', e)
    })
    draftRef.current = nextDraft
    setState('idle')
    retryCountRef.current = 0
    setRetryCount(0)
  }, [])

  // Keep a ref to the latest onSuccess so the retry effect always calls
  // the current callback without needing to re-subscribe when it changes.
  const onSuccessRef = useRef(onSuccess)
  useEffect(() => {
    onSuccessRef.current = onSuccess
  })

  useEffect(() => {
    if (!isOnline) {
      return
    }
    if (state !== 'queued' && state !== 'failed_retryable') {
      return
    }
    const delay = backoffDelay(Math.max(0, retryCountRef.current - 1))
    const timer = setTimeout(() => {
      setState('submitting')
      void doSubmit(retryCountRef.current).then((publicRef) => {
        if (publicRef) {
          setState('server_confirmed')
          onSuccessRef.current(publicRef)
        }
      })
    }, delay)
    return () => {
      clearTimeout(timer)
    }
  }, [isOnline, state, doSubmit])

  return {
    state,
    retryCount,
    isOnline,
    submit,
    sendSmsFallback,
  }
}
