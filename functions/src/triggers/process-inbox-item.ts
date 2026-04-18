import { randomUUID } from 'node:crypto'
import type { Firestore } from 'firebase-admin/firestore'
import {
  BantayogError,
  BantayogErrorCode,
  logDimension,
  reportInboxDocSchema,
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
  replayed?: boolean
  reportId: string
}

interface InboxPayload {
  reportType: string
  description: string
  severity: 'low' | 'medium' | 'high'
  source: 'web' | 'sms' | 'responder_witness'
  publicLocation: { lat: number; lng: number }
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
  const payload = inbox.payload as unknown as InboxPayload

  const geo = await reverseGeocodeToMunicipality(db, payload.publicLocation)
  if (!geo) {
    await db.collection('moderation_incidents').doc(inboxId).set({
      inboxId,
      reason: 'out_of_jurisdiction',
      createdAt: now(),
      schemaVersion: 1,
    })
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'out of jurisdiction')
  }

  const createdAt = now()

  const result = await withIdempotency<
    { inboxId: string; publicRef: string },
    ProcessInboxItemCoreResult
  >(
    db,
    { key: `processInboxItem:${inboxId}`, payload: { inboxId, publicRef: inbox.publicRef }, now },
    async () => {
      const reportId = randomUUID()

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
          mediaRefs: [],
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
          expiresAt: now() + 90 * 24 * 60 * 60 * 1000,
          createdAt,
          schemaVersion: 1,
        })

        tx.set(db.collection('report_events').doc(), {
          reportId,
          correlationId: inbox.correlationId,
          eventType: 'report_submitted',
          municipalityId: geo.municipalityId,
          actor: 'system',
          at: createdAt,
          schemaVersion: 1,
        })
      })

      log({
        severity: 'INFO',
        code: 'INBOX_MATERIALIZED',
        message: `Report ${reportId} created from inbox ${inboxId}`,
        data: { reportId, inboxId, municipalityId: geo.municipalityId },
      })

      return { materialized: true, reportId }
    },
  )

  return result
}
