import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore } from 'firebase-admin/firestore'
import { logDimension } from '@bantayog/shared-validators'
import { processInboxItemCore } from './process-inbox-item.js'

const log = logDimension('inboxReconciliationSweep')

const STALENESS_MS = 2 * 60 * 1000
const BATCH = 100

export interface SweepInput {
  db: ReturnType<typeof getFirestore>
  now?: () => number
}

export interface SweepResult {
  candidates: number
  processed: number
  failed: number
  oldestAgeMs: number
}

export async function inboxReconciliationSweepCore(input: SweepInput): Promise<SweepResult> {
  const now = input.now ?? (() => Date.now())
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
    const data = d.data() as { processedAt?: number; clientCreatedAt: number }
    if (data.processedAt) continue
    oldestAgeMs = Math.max(oldestAgeMs, now() - data.clientCreatedAt)
    try {
      await processInboxItemCore({ db: input.db, inboxId: d.id, now })
      processed++
    } catch (err: unknown) {
      failed++
      log({
        severity: 'WARNING',
        code: 'INBOX_RECONCILIATION_RETRY_FAILED',
        message: `inbox ${d.id} retry failed: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }
  return { candidates: snap.size, processed, failed, oldestAgeMs }
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
      severity: result.processed > 3 || result.oldestAgeMs > 15 * 60 * 1000 ? 'ERROR' : 'INFO',
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
