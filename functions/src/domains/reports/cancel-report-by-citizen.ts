import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode, logDimension } from '@bantayog/shared-validators'
import { adminDb } from '../../admin-init.js'
import { withIdempotency } from '../../idempotency/guard.js'
import { checkRateLimit } from '../shared/rate-limit.js'
import { bantayogErrorToHttps } from '../shared/https-error.js'
import { shouldEnforceAppCheck } from '../shared/app-check-config.js'

const InputSchema = z
  .object({
    reportId: z.string().min(1).max(128),
    idempotencyKey: z.uuid(),
  })
  .strict()

const CANCELLABLE_STATUSES = ['new', 'awaiting_verify'] as const

export interface CancelReportByCitizenCoreDeps {
  reportId: string
  idempotencyKey: string
  actor: { uid: string; claims: { role?: string } }
  now: Timestamp
}

export interface CancelReportByCitizenResult {
  reportId: string
}

const log = logDimension('cancelReportByCitizen')

export async function cancelReportByCitizenCore(
  db: Firestore,
  deps: CancelReportByCitizenCoreDeps,
): Promise<CancelReportByCitizenResult> {
  const correlationId = crypto.randomUUID()

  const { result } = await withIdempotency(
    db,
    {
      key: `cancelReportByCitizen:${deps.actor.uid}:${deps.idempotencyKey}`,
      payload: { reportId: deps.reportId, actorUid: deps.actor.uid },
      now: () => deps.now.toMillis(),
    },
    async () => {
      const lookupQ = db.collection('report_lookup').where('reportId', '==', deps.reportId).limit(1)
      const lookupSnap = await lookupQ.get()
      const lookupDoc = lookupSnap.docs[0]

      return db.runTransaction(async (tx) => {
        const reportRef = db.collection('reports').doc(deps.reportId)
        const snap = await tx.get(reportRef)
        if (!snap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found')
        }
        const report = snap.data() as Record<string, unknown>
        const status = report.status as string
        if (!CANCELLABLE_STATUSES.includes(status as (typeof CANCELLABLE_STATUSES)[number])) {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `cancelReportByCitizen is only valid from new or awaiting_verify, got ${status}`,
            { reportId: deps.reportId, status },
          )
        }

        const privateRef = db.collection('report_private').doc(deps.reportId)
        const privateSnap = await tx.get(privateRef)
        const reporterUid = privateSnap.data()?.reporterUid as string | undefined
        if (reporterUid !== deps.actor.uid) {
          throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'You do not own this report')
        }

        tx.delete(reportRef)
        tx.delete(privateRef)

        const contactsRef = db.collection('report_contacts').doc(deps.reportId)
        tx.delete(contactsRef)

        if (lookupDoc) {
          tx.delete(lookupDoc.ref)
        }

        const eventRef = db.collection('report_events').doc()
        tx.set(eventRef, {
          eventId: eventRef.id,
          reportId: deps.reportId,
          from: status,
          to: 'citizen_cancelled',
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'citizen',
          at: deps.now.toMillis(),
          correlationId,
          schemaVersion: 1,
        })

        log({
          severity: 'INFO',
          code: 'report.citizen_cancelled',
          message: `Report ${deps.reportId} cancelled by citizen ${deps.actor.uid}`,
          data: {
            correlationId,
            reportId: deps.reportId,
            actorUid: deps.actor.uid,
          },
        })

        return { reportId: deps.reportId }
      })
    },
  )

  const storage = getStorage()
  try {
    const [files] = await storage.bucket().getFiles({ prefix: `report_media/${deps.reportId}/` })
    for (const file of files) {
      await file.delete()
    }
  } catch (err: unknown) {
    log({
      severity: 'WARNING',
      code: 'report.citizen_cancelled_media_cleanup_failed',
      message: `Report ${deps.reportId} cancelled, but media cleanup failed`,
      data: { correlationId, reportId: deps.reportId, err: String(err) },
    })
  }

  return result
}

export const cancelReportByCitizen = onCall(
  { region: 'asia-southeast1', enforceAppCheck: shouldEnforceAppCheck(), maxInstances: 100 },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'sign-in required')
    if (claims.role !== 'citizen') {
      throw new HttpsError('permission-denied', 'citizen role required')
    }
    if (claims.active !== true) {
      throw new HttpsError('permission-denied', 'account is not active')
    }
    const parsed = InputSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    const rl = await checkRateLimit(adminDb, {
      key: `cancelReportByCitizen:${req.auth.uid}`,
      limit: 30,
      windowSeconds: 60,
      now: Timestamp.now(),
    })
    if (!rl.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit', {
        retryAfterSeconds: rl.retryAfterSeconds,
      })
    }

    try {
      return await cancelReportByCitizenCore(adminDb, {
        reportId: parsed.data.reportId,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: {
          uid: req.auth.uid,
          claims: {
            role: claims.role,
          },
        },
        now: Timestamp.now(),
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError) throw bantayogErrorToHttps(err)
      throw err
    }
  },
)
