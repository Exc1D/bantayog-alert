import { randomUUID } from 'node:crypto'
import type { Firestore } from 'firebase-admin/firestore'
import {
  BantayogError,
  BantayogErrorCode,
  logDimension,
  reportInboxDocSchema,
  inboxPayloadSchema,
} from '@bantayog/shared-validators'
import { reverseGeocodeToMunicipality } from '../services/geocode.js'
import { withIdempotency } from '../idempotency/guard.js'
import { enqueueSms } from '../services/send-sms.js'

const log = logDimension('processInboxItem')

export interface ProcessInboxItemCoreInput {
  db: Firestore
  inboxId: string
  now?: () => number
}

export interface ProcessInboxItemCoreResult {
  materialized: boolean
  replayed: boolean
  reportId: string
  publicRef: string
}

export async function processInboxItemCore(
  input: ProcessInboxItemCoreInput,
): Promise<ProcessInboxItemCoreResult> {
  const { db, inboxId } = input
  const now = input.now ?? (() => Date.now())

  const inboxRef = db.collection('report_inbox').doc(inboxId)
  const inboxSnap = await inboxRef.get()
  if (!inboxSnap.exists) {
    throw new BantayogError(BantayogErrorCode.NOT_FOUND, `inbox ${inboxId} missing`)
  }

  const parsed = reportInboxDocSchema.safeParse(inboxSnap.data())
  if (!parsed.success) {
    await db
      .collection('moderation_incidents')
      .doc(inboxId)
      .set({
        inboxId,
        reason: 'schema_invalid',
        detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        createdAt: now(),
        schemaVersion: 1,
      })
    throw new BantayogError(
      BantayogErrorCode.INVALID_ARGUMENT,
      `inbox schema invalid: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
    )
  }

  const inbox = parsed.data
  const payloadResult = inboxPayloadSchema.safeParse(inbox.payload)
  if (!payloadResult.success) {
    await db
      .collection('moderation_incidents')
      .doc(inboxId)
      .set({
        inboxId,
        reason: 'payload_schema_invalid',
        detail: payloadResult.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
        createdAt: now(),
        schemaVersion: 1,
      })
    throw new BantayogError(
      BantayogErrorCode.INVALID_ARGUMENT,
      `payload schema invalid: ${payloadResult.error.issues[0]?.message ?? 'unknown'}`,
    )
  }
  const payload = payloadResult.data

  let geo: Awaited<ReturnType<typeof reverseGeocodeToMunicipality>> | null = null
  if (payload.publicLocation) {
    geo = await reverseGeocodeToMunicipality(db, payload.publicLocation)
  }

  if (!geo) {
    const reason = payload.publicLocation ? 'out_of_jurisdiction' : 'location_missing'
    await db.collection('moderation_incidents').doc(inboxId).set({
      inboxId,
      reason,
      createdAt: now(),
      schemaVersion: 1,
    })
    throw new BantayogError(
      BantayogErrorCode.INVALID_ARGUMENT,
      reason === 'location_missing' ? 'location missing from payload' : 'out of jurisdiction',
    )
  }

  const createdAt = now()
  const pendingMediaIds = payload.pendingMediaIds ?? []

  const idempotencyResult = await withIdempotency<
    { inboxId: string; publicRef: string },
    { materialized: true; reportId: string }
  >(
    db,
    { key: `processInboxItem:${inboxId}`, payload: { inboxId, publicRef: inbox.publicRef }, now },
    async () => {
      const reportId = randomUUID()

      const pendingMediaDocs = new Map<
        string,
        { storagePath: string; mimeType: string; strippedAt: number }
      >()
      for (const uploadId of pendingMediaIds) {
        const pendingSnap = await db.collection('pending_media').doc(uploadId).get()
        if (pendingSnap.exists) {
          pendingMediaDocs.set(
            uploadId,
            pendingSnap.data() as { storagePath: string; mimeType: string; strippedAt: number },
          )
        }
      }

      // pending_media docs are write-once by onMediaFinalize and only deleted here,
      // so reads outside the transaction are safe by design.

      await db.runTransaction(async (tx) => {
        const lookupRef = db.collection('report_lookup').doc(inbox.publicRef)
        const lookupSnap = await tx.get(lookupRef)
        if (lookupSnap.exists && lookupSnap.data()?.reportId !== reportId) {
          throw new BantayogError(BantayogErrorCode.CONFLICT, 'publicRef already exists')
        }

        tx.set(db.collection('reports').doc(reportId), {
          municipalityId: geo.municipalityId,
          municipalityLabel: geo.municipalityLabel,
          barangayId: geo.barangayId,
          reporterRole: 'citizen',
          reportType: payload.reportType,
          severity: payload.severity,
          status: 'new',
          publicLocation: payload.publicLocation,
          mediaRefs: pendingMediaIds,
          description: payload.description,
          submittedAt: inbox.clientCreatedAt,
          retentionExempt: false,
          visibilityClass: 'internal',
          visibility: { scope: 'municipality', sharedWith: [] },
          source: payload.source,
          hasPhotoAndGPS: false,
          schemaVersion: 1,
          correlationId: inbox.correlationId,
        })

        tx.set(db.collection('report_private').doc(reportId), {
          municipalityId: geo.municipalityId,
          reporterUid: inbox.reporterUid,
          isPseudonymous: false,
          publicTrackingRef: inbox.publicRef,
          createdAt,
          schemaVersion: 1,
        })

        tx.set(db.collection('report_ops').doc(reportId), {
          municipalityId: geo.municipalityId,
          status: 'new',
          severity: payload.severity,
          createdAt,
          agencyIds: [],
          activeResponderCount: 0,
          requiresLocationFollowUp: false,
          visibility: { scope: 'municipality', sharedWith: [] },
          updatedAt: createdAt,
          schemaVersion: 1,
        })

        tx.set(db.collection('reports').doc(reportId).collection('status_log').doc(), {
          from: 'draft_inbox',
          to: 'new',
          actor: 'system:processInboxItem',
          at: createdAt,
          correlationId: inbox.correlationId,
          schemaVersion: 1,
        })

        tx.set(db.collection('report_lookup').doc(inbox.publicRef), {
          reportId,
          tokenHash: inbox.secretHash,
          expiresAt: createdAt + 90 * 24 * 60 * 60 * 1000,
          createdAt,
          schemaVersion: 1,
        })

        // smsConsent check is intentional — presence of contact.phone implies smsConsent=true
        // (schema enforces contact.smsConsent as z.literal(true))
        if (payload.contact?.phone) {
          const salt = process.env.SMS_MSISDN_HASH_SALT
          if (!salt) {
            log({
              severity: 'ERROR',
              code: 'sms.salt.missing',
              message: 'SMS_MSISDN_HASH_SALT env not set — skipping enqueue',
            })
          } else {
            const muniLocale = geo.defaultSmsLocale ?? 'tl'
            enqueueSms(db, tx, {
              reportId,
              purpose: 'receipt_ack',
              recipientMsisdn: payload.contact.phone,
              locale: muniLocale,
              publicRef: inbox.publicRef,
              salt,
              nowMs: createdAt,
              providerId: 'semaphore',
            })
            tx.set(db.collection('report_sms_consent').doc(reportId), {
              reportId,
              phone: payload.contact.phone,
              locale: muniLocale,
              smsConsent: true,
              createdAt,
              schemaVersion: 1,
            })
          }
        }

        tx.set(db.collection('report_events').doc(), {
          reportId,
          correlationId: inbox.correlationId,
          eventType: 'report_submitted',
          municipalityId: geo.municipalityId,
          actor: 'system',
          at: createdAt,
          schemaVersion: 1,
        })

        for (const uploadId of pendingMediaIds) {
          const data = pendingMediaDocs.get(uploadId)
          if (!data) continue
          tx.set(db.collection('reports').doc(reportId).collection('media').doc(uploadId), {
            uploadId,
            storagePath: data.storagePath,
            mimeType: data.mimeType,
            strippedAt: data.strippedAt,
            addedAt: createdAt,
            schemaVersion: 1,
          })
          tx.delete(db.collection('pending_media').doc(uploadId))
        }
      })

      await inboxRef.update({ processedAt: now() })

      log({
        severity: 'INFO',
        code: 'INBOX_MATERIALIZED',
        message: `Report ${reportId} created from inbox ${inboxId}`,
        data: { reportId, inboxId, municipalityId: geo.municipalityId },
      })

      return { materialized: true, reportId, publicRef: inbox.publicRef }
    },
  )

  const { result, fromCache } = idempotencyResult
  const r = result as { materialized: boolean; reportId: string; publicRef: string }
  return {
    materialized: r.materialized,
    replayed: fromCache,
    reportId: r.reportId,
    publicRef: r.publicRef,
  }
}
