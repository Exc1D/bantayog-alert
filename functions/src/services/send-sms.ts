import { createHash } from 'node:crypto'
import type { Transaction, Firestore } from 'firebase-admin/firestore'
import {
  detectEncoding,
  hashMsisdn,
  renderTemplate,
  type SmsPurpose,
  type SmsLocale,
} from '@bantayog/shared-validators'

export interface EnqueueSmsArgs {
  reportId: string
  dispatchId?: string | undefined
  purpose: SmsPurpose
  recipientMsisdn: string
  locale: SmsLocale
  publicRef: string
  salt: string
  nowMs: number
  providerId: 'semaphore' | 'globelabs'
}

export interface OutboxPayload {
  providerId: 'semaphore' | 'globelabs'
  recipientMsisdnHash: string
  recipientMsisdn: string
  purpose: SmsPurpose
  predictedEncoding: 'GSM-7' | 'UCS-2'
  predictedSegmentCount: number
  bodyPreviewHash: string
  status: 'queued'
  idempotencyKey: string
  retryCount: number
  locale: SmsLocale
  reportId: string
  createdAt: number
  queuedAt: number
  schemaVersion: 2
}

function buildIdempotencyKey(args: EnqueueSmsArgs): string {
  const raw =
    args.purpose === 'status_update'
      ? `${args.dispatchId ?? ''}:${args.purpose}`
      : `${args.reportId}:${args.purpose}`
  return createHash('sha256').update(raw).digest('hex')
}

const VALID_PURPOSES = new Set([
  'receipt_ack',
  'verification',
  'status_update',
  'resolution',
  'pending_review',
])

export function buildEnqueueSmsPayload(args: EnqueueSmsArgs): OutboxPayload {
  if (!VALID_PURPOSES.has(args.purpose)) {
    throw new Error(`Unsupported purpose in Phase 4a: ${args.purpose satisfies string}`)
  }
  const body = renderTemplate({
    purpose: args.purpose,
    locale: args.locale,
    vars: { publicRef: args.publicRef },
  })
  const { encoding, segmentCount } = detectEncoding(body)
  const bodyPreviewHash = createHash('sha256').update(body).digest('hex')
  const recipientMsisdnHash = hashMsisdn(args.recipientMsisdn, args.salt)
  const idempotencyKey = buildIdempotencyKey(args)

  return {
    providerId: args.providerId,
    recipientMsisdnHash,
    recipientMsisdn: args.recipientMsisdn,
    purpose: args.purpose,
    predictedEncoding: encoding,
    predictedSegmentCount: segmentCount,
    bodyPreviewHash,
    status: 'queued',
    idempotencyKey,
    retryCount: 0,
    locale: args.locale,
    reportId: args.reportId,
    createdAt: args.nowMs,
    queuedAt: args.nowMs,
    schemaVersion: 2,
  }
}

export function enqueueSms(
  db: Firestore,
  tx: Transaction,
  args: EnqueueSmsArgs,
): { outboxId: string; outboxRef: FirebaseFirestore.DocumentReference } {
  const payload = buildEnqueueSmsPayload(args)
  const outboxRef = db.collection('sms_outbox').doc(payload.idempotencyKey)
  tx.set(outboxRef, payload, { merge: true })
  return { outboxId: payload.idempotencyKey, outboxRef }
}
