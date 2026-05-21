import { onRequest } from 'firebase-functions/v2/https'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('smsDeliveryReport')

// Delivery status mapping from provider statuses to internal statuses
const SEMAPHORE_STATUS_MAP: Record<string, string> = {
  '4': 'delivered',
  '6': 'failed',
  '8': 'deferred',
}

const GLOBELABS_STATUS_MAP: Record<string, string> = {
  DELIVRD: 'delivered',
  UNDELIV: 'failed',
  EXPIRED: 'failed',
  REJECTD: 'failed',
  UNKNOWN: 'failed',
}

// Zod schemas for provider payloads
const semaphoreDeliverySchema = z.object({
  message_id: z.string().min(1),
  status: z.string(),
  recipient: z.string().optional(),
  timestamp: z.number().optional(),
})

const globelabsDeliverySchema = z.object({
  messageId: z.string().min(1),
  status: z.string(),
  recipientAddress: z.string().optional(),
  timestamp: z.number().optional(),
})

// HMAC verification helper
async function verifyHmacSignature(body: string, signature: string | undefined): Promise<boolean> {
  if (!signature || !process.env.SMS_WEBHOOK_SECRET) {
    // In development/emulator, allow unsigned requests
    if (process.env.FUNCTIONS_EMULATOR === 'true') return true
    return false
  }

  const crypto = await import('node:crypto')
  const expected = crypto
    .createHmac('sha256', process.env.SMS_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

interface DeliveryReportInput {
  providerMessageId: string
  providerId: 'semaphore' | 'globelabs'
  status: string
  rawPayload: Record<string, unknown>
}

async function processDeliveryReport(input: DeliveryReportInput): Promise<void> {
  const db = getFirestore()

  // Find the outbox entry by provider message ID (idempotent upsert)
  const outboxSnap = await db
    .collection('sms_outbox')
    .where('providerMessageId', '==', input.providerMessageId)
    .limit(1)
    .get()

  if (outboxSnap.empty) {
    log({
      severity: 'WARNING',
      code: 'DLR_ORPHAN',
      message: `Delivery report for unknown providerMessageId: ${input.providerMessageId}`,
      data: { providerMessageId: input.providerMessageId, providerId: input.providerId },
    })
    return
  }

  const outboxDoc = outboxSnap.docs[0]
  if (!outboxDoc) return

  const outboxData = outboxDoc.data() as { status?: string }

  // Idempotency: skip if already in a terminal state
  const terminalStates = ['delivered', 'failed', 'abandoned']
  if (outboxData.status && terminalStates.includes(outboxData.status)) {
    return
  }

  const now = Timestamp.now()
  const updateData: Record<string, unknown> = {
    status: input.status,
    updatedAt: now.toMillis(),
  }

  if (input.status === 'delivered') {
    updateData.deliveredAt = now.toMillis()
  } else if (input.status === 'failed') {
    updateData.failedAt = now.toMillis()
    updateData.terminalReason = 'dlr_failed'
    updateData.statusReason = `provider_${input.providerId}_reported_failure`
  }

  await outboxDoc.ref.update(updateData)

  log({
    severity: 'INFO',
    code: 'DLR_PROCESSED',
    message: `Delivery report processed for ${input.providerMessageId}`,
    data: {
      providerMessageId: input.providerMessageId,
      providerId: input.providerId,
      status: input.status,
      outboxId: outboxDoc.id,
    },
  })
}

export const smsDeliveryReport = onRequest(
  {
    region: 'asia-southeast1',
    maxInstances: 50,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    // Only accept POST
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    // Verify HMAC signature
    const rawBody = JSON.stringify(req.body ?? {})
    const signature = req.headers['x-signature'] as string | undefined

    if (!(await verifyHmacSignature(rawBody, signature))) {
      log({
        severity: 'WARNING',
        code: 'DLR_AUTH_FAILED',
        message: 'SMS delivery report rejected: invalid or missing signature',
      })
      res.status(401).json({ error: 'invalid signature' })
      return
    }

    try {
      // Detect provider and parse payload
      const body = req.body as Record<string, unknown> | undefined
      if (!body) {
        res.status(400).json({ error: 'empty body' })
        return
      }

      // Semaphore: has 'message_id' field
      if ('message_id' in body) {
        const parsed = semaphoreDeliverySchema.safeParse(body)
        if (!parsed.success) {
          res.status(400).json({ error: 'invalid semaphore payload' })
          return
        }
        const internalStatus = SEMAPHORE_STATUS_MAP[parsed.data.status] ?? 'failed'
        await processDeliveryReport({
          providerMessageId: parsed.data.message_id,
          providerId: 'semaphore',
          status: internalStatus,
          rawPayload: body,
        })
        res.status(200).json({ status: 'ok' })
        return
      }

      // Globe Labs: has 'messageId' field
      if ('messageId' in body) {
        const parsed = globelabsDeliverySchema.safeParse(body)
        if (!parsed.success) {
          res.status(400).json({ error: 'invalid globelabs payload' })
          return
        }
        const internalStatus = GLOBELABS_STATUS_MAP[parsed.data.status] ?? 'failed'
        await processDeliveryReport({
          providerMessageId: parsed.data.messageId,
          providerId: 'globelabs',
          status: internalStatus,
          rawPayload: body,
        })
        res.status(200).json({ status: 'ok' })
        return
      }

      res.status(400).json({ error: 'unknown provider payload format' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      log({
        severity: 'ERROR',
        code: 'DLR_PROCESSING_FAILED',
        message: `SMS delivery report processing failed: ${message}`,
      })
      res.status(500).json({ error: 'internal error' })
    }
  },
)
