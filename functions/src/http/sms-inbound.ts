import * as crypto from 'node:crypto'
import { createCipheriv, randomBytes } from 'node:crypto'
import { onRequest } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { normalizeMsisdn, hashMsisdn, logDimension } from '@bantayog/shared-validators'
import { smsInboxDocSchema } from '@bantayog/shared-validators'

const log = logDimension('smsInbound')

const ENCRYPTION_KEY = process.env.SMS_MSISDN_ENCRYPTION_KEY ?? ''

function encryptMsisdn(msisdn: string): string {
  if (!ENCRYPTION_KEY) return `unencrypted:${msisdn}`
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(msisdn, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.from(
    JSON.stringify({
      iv: iv.toString('hex'),
      ct: encrypted.toString('hex'),
      tag: authTag.toString('hex'),
    }),
  ).toString('base64')
}

function buildMsgId(): string {
  return crypto.randomUUID()
}

export const smsInboundWebhook = onRequest(
  { region: 'asia-southeast1', maxInstances: 10, timeoutSeconds: 10 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    const allowedIpRange = process.env.GLOBE_LABS_WEBHOOK_IP_RANGE
    if (allowedIpRange) {
      const ip = req.ip ?? ''
      const prefix = allowedIpRange.replace(/\/\d+$/, '')
      if (!ip.startsWith(prefix)) {
        log({
          severity: 'WARNING',
          code: 'sms.inbound.ip_rejected',
          message: `IP ${ip} not in allowlist`,
        })
        res.status(403).send('Forbidden')
        return
      }
    }

    const expectedSecret = process.env.GLOBE_LABS_WEBHOOK_SECRET
    if (expectedSecret) {
      const received = req.headers['x-webhook-secret'] ?? req.headers['x-globe-labs-secret'] ?? ''
      if (received !== expectedSecret) {
        res.status(403).send('Forbidden')
        return
      }
    }

    const raw = req.body as { from?: unknown; message?: unknown; id?: unknown } | null
    if (!raw || typeof raw.message !== 'string' || typeof raw.from !== 'string') {
      res.status(400).send('Bad Request')
      return
    }

    const {
      from: rawFrom,
      message: rawBody,
      id: globeMsgId,
    } = raw as { from: string; message: string; id?: string }

    let msisdnHash: string
    try {
      const normalized = normalizeMsisdn(rawFrom)
      const salt = process.env.SMS_MSISDN_HASH_SALT ?? ''
      msisdnHash = hashMsisdn(normalized, salt)
    } catch {
      msisdnHash = crypto.createHash('sha256').update(rawFrom).digest('hex')
      log({
        severity: 'WARNING',
        code: 'msisdn.invalid',
        message: 'Invalid MSISDN received',
        data: { rawFrom: rawFrom.slice(0, 6) + '****' },
      })
    }

    const db = getFirestore()
    const msgId = globeMsgId ?? buildMsgId()

    const inboxData = {
      providerId: 'globelabs' as const,
      receivedAt: Date.now(),
      senderMsisdnHash: msisdnHash,
      senderMsisdnEnc: encryptMsisdn(rawFrom),
      body: rawBody.slice(0, 1600),
      parseStatus: 'pending' as const,
      schemaVersion: 1,
    }

    const parseResult = smsInboxDocSchema.safeParse(inboxData)
    if (!parseResult.success) {
      log({
        severity: 'ERROR',
        code: 'sms.inbound.schema_invalid',
        message: parseResult.error.message,
      })
      res.status(200).json({ ok: false })
      return
    }

    await db.collection('sms_inbox').doc(msgId).set(inboxData, { merge: true })

    log({
      severity: 'INFO',
      code: 'sms.inbox.received',
      message: `SMS inbox item ${msgId} written`,
      data: { msgId, msisdnHash: msisdnHash.slice(0, 8) + '****' },
    })

    res.status(200).json({ ok: true })
  },
)
