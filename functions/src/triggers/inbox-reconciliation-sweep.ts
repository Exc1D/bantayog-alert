import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore } from 'firebase-admin/firestore'
import { logDimension } from '@bantayog/shared-validators'
import {
  processInboxItemCore,
  type ProcessInboxItemCoreInput,
  type ProcessInboxItemCoreResult,
} from './process-inbox-item.js'

const log = logDimension('inboxReconciliationSweep')

const STALENESS_MS = 2 * 60 * 1000
const BATCH = 100

export interface SweepInput {
  db: ReturnType<typeof getFirestore>
  now?: () => number
  processInboxItem?: (input: ProcessInboxItemCoreInput) => Promise<ProcessInboxItemCoreResult>
}

export interface SweepResult {
  candidates: number
  processed: number
  failed: number
  oldestAgeMs: number | null
}

export async function inboxReconciliationSweepCore(input: SweepInput): Promise<SweepResult> {
  const now = input.now ?? (() => Date.now())
  const processInboxItem = input.processInboxItem ?? processInboxItemCore
  const threshold = now() - STALENESS_MS
  const snap = await input.db
    .collection('report_inbox')
    .where('clientCreatedAt', '<', threshold)
    .orderBy('clientCreatedAt')
    .limit(BATCH)
    .get()

  let processed = 0
  let failed = 0
  let oldestAgeMs = 0
  for (const d of snap.docs) {
    const data = d.data() as {
      processedAt?: number
      processingStartedAt?: number | null
      clientCreatedAt: number
    }
    if (data.processedAt) continue
    // Atomically claim this item so concurrent scheduler instances don't duplicate work
    const claimRef = input.db.collection('report_inbox').doc(d.id)
    let claimed = false
    let claimStartedAt: number | null = null
    try {
      const claimTimestamp = now()
      claimed = await input.db.runTransaction(async (tx) => {
        const snap = await tx.get(claimRef)
        const current = snap.data() as
          | { processedAt?: number; processingStartedAt?: number | null }
          | undefined
        if (current?.processedAt) return false
        if (
          typeof current?.processingStartedAt === 'number' &&
          current.processingStartedAt > now() - STALENESS_MS
        ) {
          return false
        }
        tx.update(claimRef, { processingStartedAt: claimTimestamp })
        return true
      })
      if (claimed) claimStartedAt = claimTimestamp
    } catch {
      // Transaction contention — another instance claimed it; skip
    }
    if (!claimed) continue
    oldestAgeMs = Math.max(oldestAgeMs, now() - data.clientCreatedAt)
    try {
      await processInboxItem({ db: input.db, inboxId: d.id, now })
      processed++
    } catch (err: unknown) {
      failed++
      // Check if a moderation incident was written (permanent failure) and mark processed
      const incidentSnap = await input.db.collection('moderation_incidents').doc(d.id).get()
      if (incidentSnap.exists) {
        await d.ref.update({ processedAt: now() })
      } else {
        // Only clear our own claim to avoid clobbering a newer concurrent claim
        await input.db.runTransaction(async (tx) => {
          const latestSnap = await tx.get(claimRef)
          const latest = latestSnap.data() as { processingStartedAt?: number | null } | undefined
          if (claimStartedAt === null || latest?.processingStartedAt !== claimStartedAt) return
          tx.update(claimRef, {
            processingStartedAt: null,
            lastProcessingFailedAt: now(),
            lastProcessingError: err instanceof Error ? err.message : String(err),
          })
        })
      }
      log({
        severity: 'WARNING',
        code: 'INBOX_RECONCILIATION_RETRY_FAILED',
        message: `inbox ${d.id} retry failed: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }
  return {
    candidates: snap.size,
    processed,
    failed,
    oldestAgeMs: processed === 0 ? null : oldestAgeMs,
  }
}

export const inboxReconciliationSweep = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'asia-southeast1',
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const result = await inboxReconciliationSweepCore({ db: getFirestore() })
    log({
      severity:
        result.processed > 3 || (result.oldestAgeMs !== null && result.oldestAgeMs > 15 * 60 * 1000)
          ? 'ERROR'
          : 'INFO',
      code: 'INBOX_RECONCILIATION_SWEEP',
      message:
        'sweep completed: ' +
        String(result.processed) +
        ' processed, ' +
        String(result.failed) +
        ' failed',
      data: result as unknown as Record<string, unknown>,
    })
  },
)
