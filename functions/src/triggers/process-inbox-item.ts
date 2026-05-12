import { randomUUID } from 'node:crypto'
import type { Firestore } from 'firebase-admin/firestore'
import ngeohash from 'ngeohash'
import {
  BantayogError,
  BantayogErrorCode,
  logDimension,
  reportInboxDocSchema,
  inboxPayloadSchema,
} from '@bantayog/shared-validators'
import { reverseGeocodeToMunicipality } from '../services/geocode.js'
import { withIdempotency } from '../idempotency/guard.js'

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
  const exactLocation = payload.exactLocation

  if (!payload.publicLocation) {
    await db.collection('moderation_incidents').doc(inboxId).set({
      inboxId,
      reason: 'location_missing',
      reportType: payload.reportType,
      description: payload.description,
      publicRef: inbox.publicRef,
      createdAt: now(),
      schemaVersion: 1,
    })
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'location missing from payload')
  }

  let municipalityId: string
  let municipalityLabel: string
  let barangayId: string

  if (payload.municipalityId) {
    const muniSnap = await db.collection('municipalities').doc(payload.municipalityId).get()
    if (!muniSnap.exists) {
      throw new BantayogError(
        BantayogErrorCode.MUNICIPALITY_NOT_FOUND,
        `Municipality '${payload.municipalityId}' is not in jurisdiction.`,
      )
    }
    const muniData = muniSnap.data() as { label: string }
    municipalityId = payload.municipalityId
    municipalityLabel = muniData.label
    barangayId = payload.barangayId ?? 'unknown'
  } else {
    const geo = await reverseGeocodeToMunicipality(db, payload.publicLocation)
    if (!geo) {
      await db.collection('moderation_incidents').doc(inboxId).set({
        inboxId,
        reason: 'out_of_jurisdiction',
        reportType: payload.reportType,
        description: payload.description,
        publicRef: inbox.publicRef,
        createdAt: now(),
        schemaVersion: 1,
      })
      throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'out of jurisdiction')
    }
    municipalityId = geo.municipalityId
    municipalityLabel = geo.municipalityLabel
    barangayId = geo.barangayId
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
        } else {
          log({
            severity: 'WARNING',
            code: 'INBOX_PENDING_MEDIA_MISSING',
            message: `pending_media doc not found: ${uploadId} (inbox ${inboxId})`,
            data: { inboxId, uploadId },
          })
        }
      }

      // Reads outside the transaction are a known race; we accept it because
      // pending_media is append-only and deletion is best-effort.

      await db.runTransaction(async (tx) => {
        const lookupRef = db.collection('report_lookup').doc(inbox.publicRef)
        const lookupSnap = await tx.get(lookupRef)
        if (lookupSnap.exists && lookupSnap.data()?.reportId !== reportId) {
          throw new BantayogError(BantayogErrorCode.CONFLICT, 'publicRef already exists')
        }

        tx.set(db.collection('reports').doc(reportId), {
          municipalityId,
          municipalityLabel,
          barangayId,
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
          municipalityId,
          reporterUid: inbox.reporterUid,
          isPseudonymous: false,
          publicTrackingRef: inbox.publicRef,
          contactPhone: payload.contact?.phone ?? null,
          createdAt,
          schemaVersion: 1,
          ...(exactLocation != null ? { exactLocation } : {}),
        })

        tx.set(db.collection('report_ops').doc(reportId), {
          municipalityId,
          status: 'new',
          severity: payload.severity,
          createdAt,
          agencyIds: [],
          activeResponderCount: 0,
          requiresLocationFollowUp: false,
          reportType: payload.reportType,
          ...(exactLocation
            ? { locationGeohash: ngeohash.encode(exactLocation.lat, exactLocation.lng, 6) }
            : {}),
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

        // Write secret_lookup only for web submissions — SMS uses a random tokenHash
        // the user never sees, so a secret-only lookup makes no sense for those.
        if (payload.source === 'web') {
          tx.set(db.collection('secret_lookup').doc(inbox.secretHash), {
            publicRef: inbox.publicRef,
            reportId,
            expiresAt: createdAt + 90 * 24 * 60 * 60 * 1000,
          })
        }

        tx.set(db.collection('report_events').doc(), {
          reportId,
          correlationId: inbox.correlationId,
          eventType: 'report_submitted',
          municipalityId,
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
        data: { reportId, inboxId, municipalityId },
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
