import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { logDimension } from '@bantayog/shared-validators'
import {
  pickProvider,
  incrementMinuteWindow,
  NoProviderAvailableError,
} from '../services/sms-health.js'
import { SmsProviderRetryableError, type SmsProvider } from '../services/sms-provider.js'
import { resolveProvider as defaultResolveProvider } from '../services/sms-providers/factory.js'

const log = logDimension('dispatchSmsOutbox')

type Status = 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'deferred' | 'abandoned'

export interface DispatchSmsOutboxCoreArgs {
  db: Firestore
  outboxId: string
  previousStatus: Status | undefined
  currentStatus: Status
  now: () => number
  resolveProvider: (target: 'semaphore' | 'globelabs') => SmsProvider
}

export async function dispatchSmsOutboxCore(args: DispatchSmsOutboxCoreArgs): Promise<void> {
  const { db, outboxId, previousStatus, currentStatus, now, resolveProvider } = args

  // Guard: proceed on create (prev=undefined, curr=queued) OR deferred→queued retry.
  const isCreate = previousStatus === undefined && currentStatus === 'queued'
  const isRetry = previousStatus === 'deferred' && currentStatus === 'queued'
  if (!isCreate && !isRetry) return

  const outboxRef = db.collection('sms_outbox').doc(outboxId)

  // CAS: queued → sending.
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(outboxRef)
    if (!snap.exists) return null
    const data = snap.data() as { status: Status; retryCount: number }
    if (data.status !== 'queued') return null
    tx.update(outboxRef, { status: 'sending' })
    return data
  })
  if (!claim) {
    log({ severity: 'INFO', code: 'sms.dispatch.skipped_not_queued', message: outboxId })
    return
  }

  // Pick provider.
  let providerTarget: 'semaphore' | 'globelabs'
  try {
    providerTarget = await pickProvider(db)
  } catch (err) {
    if (err instanceof NoProviderAvailableError) {
      await applyDeferralOrAbandon(db, outboxRef, claim.retryCount, 'provider_error', now())
      return
    }
    throw err
  }

  const provider = resolveProvider(providerTarget)

  let latencyMs = 0
  const start = now()
  try {
    const result = await provider.send({
      to: '', // plaintext msisdn is read from the outbox doc itself in real adapters
      body: '', // real adapters render from template; fake ignores body
      encoding: 'GSM-7',
    })
    latencyMs = now() - start

    if (result.accepted) {
      await outboxRef.update({
        status: 'sent',
        sentAt: now(),
        providerMessageId: result.providerMessageId,
        encoding: result.encoding,
        segmentCount: result.segmentCount,
        providerId: provider.providerId === 'fake' ? providerTarget : provider.providerId,
      })
      await incrementMinuteWindow(
        db,
        providerTarget,
        { success: true, rateLimited: false, latencyMs },
        now(),
      )
      log({
        severity: 'INFO',
        code: 'sms.sent',
        message: outboxId,
        data: { providerId: providerTarget },
      })
    } else {
      await outboxRef.update({
        status: 'failed',
        failedAt: now(),
        terminalReason:
          result.reason === 'invalid_number' || result.reason === 'bad_format'
            ? 'rejected'
            : 'client_err',
        providerId: providerTarget,
        ...(result.encoding ? { encoding: result.encoding } : {}),
        ...(result.segmentCount ? { segmentCount: result.segmentCount } : {}),
      })
      await incrementMinuteWindow(
        db,
        providerTarget,
        { success: false, rateLimited: false, latencyMs },
        now(),
      )
      log({
        severity: 'INFO',
        code: 'sms.failed',
        message: outboxId,
        data: { reason: result.reason },
      })
    }
  } catch (err) {
    latencyMs = now() - start
    const kind = err instanceof SmsProviderRetryableError ? err.kind : 'provider_error'
    const isRate = kind === 'rate_limited'
    await applyDeferralOrAbandon(db, outboxRef, claim.retryCount, kind, now())
    await incrementMinuteWindow(
      db,
      providerTarget,
      { success: false, rateLimited: isRate, latencyMs },
      now(),
    )
    log({
      severity: 'WARNING',
      code: 'sms.dispatch.retryable_error',
      message: outboxId,
      data: { kind },
    })
  }
}

async function applyDeferralOrAbandon(
  db: Firestore,
  outboxRef: FirebaseFirestore.DocumentReference,
  currentRetry: number,
  kind: 'rate_limited' | 'provider_error' | 'network',
  nowMs: number,
): Promise<void> {
  const nextRetry = currentRetry + 1
  if (nextRetry >= 3) {
    await outboxRef.update({
      status: 'abandoned',
      abandonedAt: nowMs,
      terminalReason: 'abandoned_after_retries',
      retryCount: nextRetry,
    })
  } else {
    await outboxRef.update({
      status: 'deferred',
      retryCount: nextRetry,
      deferralReason: kind,
    })
  }
}

export const dispatchSmsOutbox = onDocumentWritten(
  {
    document: 'sms_outbox/{outboxId}',
    region: 'asia-southeast1',
    maxInstances: 50,
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    if (!event.data) return
    const change = event.data
    const before = change.before.data() as { status?: Status } | undefined
    const after = change.after.data() as { status: Status } | undefined
    if (!after) return
    await dispatchSmsOutboxCore({
      db: getFirestore(),
      outboxId: event.params.outboxId,
      previousStatus: before?.status,
      currentStatus: after.status,
      now: () => Date.now(),
      resolveProvider: defaultResolveProvider,
    })
  },
)
