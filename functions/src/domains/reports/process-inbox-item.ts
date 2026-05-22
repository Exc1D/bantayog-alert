import { randomUUID } from 'node:crypto'
import type { Firestore } from 'firebase-admin/firestore'
import ngeohash from 'ngeohash'
import {
  BantayogError,
  BantayogErrorCode,
  logDimension,
  reportInboxDocSchema,
  inboxPayloadSchema,
  type InboxPayload,
} from '@bantayog/shared-validators'
import { reverseGeocodeToMunicipality } from '../shared/geocode.js'
import { withIdempotency } from '../../idempotency/guard.js'

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

export interface CitizenReportMaterializationInput {
  db: Firestore
  reporterUid: string
  clientCreatedAt: number
  publicRef: string
  secretHash: string
  correlationId: string
  payload: InboxPayload
  municipalityId: string
  municipalityLabel: string
  barangayId: string
  now?: () => number
}

export type CitizenReportMaterializationResult = ProcessInboxItemCoreResult

export async function materializeCitizenReportCore(
  input: CitizenReportMaterializationInput,
): Promise<CitizenReportMaterializationResult> {
  const now = input.now ?? (() => Date.now())
  const createdAt = now()
  const exactLocation = input.payload.exactLocation
  const pendingMediaIds = input.payload.pendingMediaIds ?? []
  const pendingMediaDocs = new Map<
    string,
    { storagePath: string; mimeType: string; strippedAt: number }
  >()

  for (const uploadId of pendingMediaIds) {
    const pendingSnap = await input.db.collection('pending_media').doc(uploadId).get()
    if (pendingSnap.exists) {
      pendingMediaDocs.set(
        uploadId,
        pendingSnap.data() as { storagePath: string; mimeType: string; strippedAt: number },
      )
    } else {
      log({
        severity: 'WARNING',
        code: 'INBOX_PENDING_MEDIA_MISSING',
        message: `pending_media doc not found: ${uploadId} (public ref ${input.publicRef})`,
        data: { publicRef: input.publicRef, uploadId },
      })
    }
  }

  return input.db.runTransaction(async (tx) => {
    const lookupRef = input.db.collection('report_lookup').doc(input.publicRef)
    const lookupSnap = await tx.get(lookupRef)
    if (lookupSnap.exists) {
      const lookup = lookupSnap.data() as { reportId?: unknown; tokenHash?: unknown } | undefined
      if (lookup?.tokenHash !== input.secretHash) {
        throw new BantayogError(BantayogErrorCode.CONFLICT, 'publicRef already exists')
      }
      if (typeof lookup.reportId !== 'string' || lookup.reportId.length === 0) {
        throw new BantayogError(BantayogErrorCode.CONFLICT, 'publicRef lookup is malformed')
      }
      return {
        materialized: true,
        replayed: true,
        reportId: lookup.reportId,
        publicRef: input.publicRef,
      }
    }

    const reportId = randomUUID()

    tx.set(input.db.collection('reports').doc(reportId), {
      municipalityId: input.municipalityId,
      municipalityLabel: input.municipalityLabel,
      barangayId: input.barangayId,
      reporterRole: 'citizen',
      reportType: input.payload.reportType,
      severity: input.payload.severity,
      status: 'new',
      publicLocation: input.payload.publicLocation,
      mediaRefs: pendingMediaIds,
      description: input.payload.description,
      submittedAt: input.clientCreatedAt,
      retentionExempt: false,
      visibilityClass: 'internal',
      visibility: { scope: 'municipality', sharedWith: [] },
      source: input.payload.source,
      hasPhotoAndGPS: false,
      schemaVersion: 1,
      correlationId: input.correlationId,
    })

    tx.set(input.db.collection('report_private').doc(reportId), {
      municipalityId: input.municipalityId,
      reporterUid: input.reporterUid,
      isPseudonymous: false,
      publicTrackingRef: input.publicRef,
      contactPhone: input.payload.contact?.phone ?? null,
      createdAt,
      schemaVersion: 1,
      ...(exactLocation != null ? { exactLocation } : {}),
    })

    tx.set(input.db.collection('report_ops').doc(reportId), {
      reportId,
      municipalityId: input.municipalityId,
      status: 'new',
      severity: input.payload.severity,
      createdAt,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      reportType: input.payload.reportType,
      ...(exactLocation
        ? { locationGeohash: ngeohash.encode(exactLocation.lat, exactLocation.lng, 6) }
        : {}),
      visibility: { scope: 'municipality', sharedWith: [] },
      updatedAt: createdAt,
      schemaVersion: 1,
    })

    tx.set(input.db.collection('reports').doc(reportId).collection('status_log').doc(), {
      from: 'draft_inbox',
      to: 'new',
      actor: 'system:processInboxItem',
      at: createdAt,
      correlationId: input.correlationId,
      schemaVersion: 1,
    })

    tx.set(input.db.collection('report_lookup').doc(input.publicRef), {
      publicTrackingRef: input.publicRef,
      reportId,
      tokenHash: input.secretHash,
      expiresAt: createdAt + 90 * 24 * 60 * 60 * 1000,
      createdAt,
      schemaVersion: 1,
    })

    if (input.payload.source === 'web') {
      tx.set(input.db.collection('secret_lookup').doc(input.secretHash), {
        publicRef: input.publicRef,
        reportId,
        expiresAt: createdAt + 90 * 24 * 60 * 60 * 1000,
      })
    }

    tx.set(input.db.collection('report_events').doc(), {
      reportId,
      correlationId: input.correlationId,
      eventType: 'report_submitted',
      municipalityId: input.municipalityId,
      actor: 'system',
      at: createdAt,
      schemaVersion: 1,
    })

    for (const uploadId of pendingMediaIds) {
      const data = pendingMediaDocs.get(uploadId)
      if (!data) continue
      tx.set(input.db.collection('reports').doc(reportId).collection('media').doc(uploadId), {
        uploadId,
        storagePath: data.storagePath,
        mimeType: data.mimeType,
        strippedAt: data.strippedAt,
        addedAt: createdAt,
        schemaVersion: 1,
      })
      tx.delete(input.db.collection('pending_media').doc(uploadId))
    }

    return {
      materialized: true,
      replayed: false,
      reportId,
      publicRef: input.publicRef,
    }
  })
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

  const idempotencyResult = await withIdempotency<
    { inboxId: string; publicRef: string },
    CitizenReportMaterializationResult
  >(
    db,
    { key: `processInboxItem:${inboxId}`, payload: { inboxId, publicRef: inbox.publicRef }, now },
    async () => {
      const result = await materializeCitizenReportCore({
        db,
        reporterUid: inbox.reporterUid,
        clientCreatedAt: inbox.clientCreatedAt,
        publicRef: inbox.publicRef,
        secretHash: inbox.secretHash,
        correlationId: inbox.correlationId,
        payload,
        municipalityId,
        municipalityLabel,
        barangayId,
        now,
      })

      await inboxRef.update({ processedAt: now() })

      log({
        severity: 'INFO',
        code: 'INBOX_MATERIALIZED',
        message: `Report ${result.reportId} created from inbox ${inboxId}`,
        data: { reportId: result.reportId, inboxId, municipalityId },
      })

      return result
    },
  )

  const { result, fromCache } = idempotencyResult
  return {
    materialized: result.materialized,
    replayed: fromCache || result.replayed,
    reportId: result.reportId,
    publicRef: result.publicRef,
  }
}
