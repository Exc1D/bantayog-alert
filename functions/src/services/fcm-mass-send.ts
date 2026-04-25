import { getMessaging } from 'firebase-admin/messaging'
import { logDimension } from '@bantayog/shared-validators'
import type { Firestore } from 'firebase-admin/firestore'

const log = logDimension('fcmMassSend')

const TOKEN_BATCH_SIZE = 500
const MAX_BATCHES = 10

export interface MassSendResult {
  successCount: number
  failureCount: number
  batchCount: number
}

/**
 * Send a mass FCM notification to all responders with hasFcmToken == true
 * within a given set of municipality IDs.
 *
 * Batches tokens in groups of 500 (Firebase sendEachForMulticast limit).
 * Hard cap: 10 batches = 5000 tokens maximum per call.
 */
export async function sendMassAlertFcm(
  db: Firestore,
  opts: {
    municipalityIds: string[]
    title: string
    body: string
    data?: Record<string, string>
  },
): Promise<MassSendResult> {
  if (opts.municipalityIds.length === 0) {
    return { successCount: 0, failureCount: 0, batchCount: 0 }
  }

  // Firestore 'in' query supports max 10 values; chunk and merge.
  const IN_QUERY_LIMIT = 10
  const tokenSet = new Set<string>()
  for (let i = 0; i < opts.municipalityIds.length; i += IN_QUERY_LIMIT) {
    const chunk = opts.municipalityIds.slice(i, i + IN_QUERY_LIMIT)
    const snaps = await db
      .collection('responders')
      .where('hasFcmToken', '==', true)
      .where('municipalityId', 'in', chunk)
      .get()
    for (const doc of snaps.docs) {
      const tokens = doc.data().fcmTokens as string[] | undefined
      if (!tokens) continue
      for (const token of tokens) {
        if (token) tokenSet.add(token)
      }
    }
  }

  const allTokens = [...tokenSet]
  if (allTokens.length === 0) return { successCount: 0, failureCount: 0, batchCount: 0 }

  const hardCap = TOKEN_BATCH_SIZE * MAX_BATCHES
  if (allTokens.length > hardCap) {
    log({
      severity: 'ERROR',
      code: 'fcm.mass.too_many_tokens',
      message: `Refusing partial mass send: ${String(allTokens.length)} tokens exceeds hard cap ${String(hardCap)}`,
    })
    return { successCount: 0, failureCount: allTokens.length, batchCount: 0 }
  }

  const messaging = getMessaging()
  let successCount = 0
  let failureCount = 0
  let batchCount = 0

  for (let i = 0; i < allTokens.length; i += TOKEN_BATCH_SIZE) {
    const batch = allTokens.slice(i, i + TOKEN_BATCH_SIZE)
    batchCount++
    try {
      const msg: Parameters<typeof messaging.sendEachForMulticast>[0] = {
        tokens: batch,
        notification: { title: opts.title, body: opts.body },
      }
      if (opts.data) msg.data = opts.data
      const result = await messaging.sendEachForMulticast(msg)
      successCount += result.successCount
      failureCount += result.failureCount
    } catch (err: unknown) {
      log({
        severity: 'ERROR',
        code: 'fcm.mass.batch.failed',
        message: err instanceof Error ? err.message : 'Batch send failed',
      })
      failureCount += batch.length
    }
  }

  log({
    severity: 'INFO',
    code: 'fcm.mass.done',
    message: `Mass FCM sent ${String(successCount)} ok / ${String(failureCount)} failed across ${String(batchCount)} batches`,
  })
  return { successCount, failureCount, batchCount }
}
