import { createHash } from 'node:crypto'
import type { Transaction, Firestore } from 'firebase-admin/firestore'
import {
  detectEncoding,
  hashMsisdn,
  renderTemplate,
  renderBroadcastTemplate,
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
  'mass_alert',
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

export interface EnqueueBroadcastSmsArgs {
  recipientMsisdn: string
  salt: string
  locale: SmsLocale
  vars: { municipalityName: string; body: string }
  providerId: string
  massAlertRequestId: string
  nowMs: number
}

export function enqueueBroadcastSms(
  db: Firestore,
  tx: Transaction,
  args: EnqueueBroadcastSmsArgs,
): { outboxId: string } {
  const body = renderBroadcastTemplate({ locale: args.locale, vars: args.vars })
  const { encoding, segmentCount } = detectEncoding(body)
  const recipientMsisdnHash = hashMsisdn(args.recipientMsisdn, args.salt)
  const raw = `mass_alert:${args.massAlertRequestId}:${args.recipientMsisdn}`
  const idempotencyKey = createHash('sha256').update(raw).digest('hex')
  const payload = {
    providerId: args.providerId,
    recipientMsisdnHash,
    recipientMsisdn: args.recipientMsisdn,
    purpose: 'mass_alert' as const,
    predictedEncoding: encoding,
    predictedSegmentCount: segmentCount,
    bodyPreviewHash: createHash('sha256').update(body).digest('hex'),
    status: 'queued' as const,
    idempotencyKey,
    retryCount: 0,
    locale: args.locale,
    massAlertRequestId: args.massAlertRequestId,
    createdAt: args.nowMs,
    queuedAt: args.nowMs,
    schemaVersion: 2,
  }
  const outboxRef = db.collection('sms_outbox').doc(idempotencyKey)
  tx.set(outboxRef, payload, { merge: true })
  return { outboxId: idempotencyKey }
}
