import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  BantayogError,
  BantayogErrorCode,
  isValidReportTransition,
  type ReportStatus,
} from '@bantayog/shared-validators'
import { bantayogErrorToHttps } from './https-error.js'
import { adminDb } from '../firebase-admin'
import { withIdempotency } from '../idempotency/guard'
import { checkRateLimit } from '../services/rate-limit'
import { logDimension } from '@bantayog/shared-validators'

const InputSchema = z
  .object({
    reportId: z.string().min(1).max(128),
    idempotencyKey: z.uuid(),
  })
  .strict()

export interface VerifyReportInput {
  reportId: string
  idempotencyKey: string
}

export interface VerifyReportResult {
  status: ReportStatus
  reportId: string
}

export interface VerifyReportActor {
  uid: string
  claims: {
    role?: string
    municipalityId?: string
    active?: boolean
  }
}

export interface VerifyReportCoreDeps {
  reportId: string
  idempotencyKey: string
  actor: VerifyReportActor
  now: Timestamp
}

export async function verifyReportCore(
  db: Firestore,
  deps: VerifyReportCoreDeps,
): Promise<VerifyReportResult> {
  const correlationId = crypto.randomUUID()

  const { result } = await withIdempotency<VerifyReportCoreDeps, VerifyReportResult>(
    db,
    {
      key: `verifyReport:${deps.actor.uid}:${deps.idempotencyKey}`,
      payload: deps,
      now: () => deps.now.toMillis(),
    },
    async () => {
      return db.runTransaction(async (tx) => {
        const reportRef = db.collection('reports').doc(deps.reportId)
        const reportSnap = await tx.get(reportRef)
        if (!reportSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found', {
            reportId: deps.reportId,
          })
        }
        const reportData = reportSnap.data()
        if (!reportData) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report data missing', {
            reportId: deps.reportId,
          })
        }
        const report = reportData
        if (report.municipalityId !== deps.actor.claims.municipalityId) {
          throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Report is not in your municipality')
        }

        const from = report.status as ReportStatus
        let to: ReportStatus
        if (from === 'new') to = 'awaiting_verify'
        else if (from === 'awaiting_verify') to = 'verified'
        else {
          throw new BantayogError(
            BantayogErrorCode.INVALID_STATUS_TRANSITION,
            `verifyReport cannot advance from status ${from}`,
            { reportId: deps.reportId, from },
          )
        }

        if (!isValidReportTransition(from, to)) {
          throw new BantayogError(
            BantayogErrorCode.INVALID_STATUS_TRANSITION,
            'invalid transition',
            {
              from,
              to,
            },
          )
        }

        const updates: Record<string, unknown> = {
          status: to,
          lastStatusAt: deps.now,
          lastStatusBy: deps.actor.uid,
        }
        if (to === 'verified') {
          updates.verifiedBy = deps.actor.uid
          updates.verifiedAt = deps.now
        }
        tx.update(reportRef, updates)

        const eventRef = db.collection('report_events').doc()
        tx.set(eventRef, {
          eventId: eventRef.id,
          reportId: deps.reportId,
          from,
          to,
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          at: deps.now,
          correlationId,
          schemaVersion: 1,
        })

        const log = logDimension('verifyReport')
        log({
          severity: 'INFO',
          code: 'report.verified',
          message: `Report ${deps.reportId} transitioned ${from} → ${to}`,
          data: { reportId: deps.reportId, from, to, actorUid: deps.actor.uid, correlationId },
        })

        return { status: to, reportId: deps.reportId }
      })
    },
  )
  return result
}

export const verifyReport = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true, maxInstances: 100 },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'sign-in required')
    if (claims.role !== 'municipal_admin' && claims.role !== 'provincial_superadmin') {
      throw new HttpsError('permission-denied', 'municipal_admin or provincial_superadmin required')
    }
    if (claims.active !== true) {
      throw new HttpsError('permission-denied', 'account is not active')
    }

    const parsed = InputSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    const rl = await checkRateLimit(adminDb, {
      key: `verifyReport:${req.auth.uid}`,
      limit: 60,
      windowSeconds: 60,
      now: Timestamp.now(),
    })
    if (!rl.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit', {
        retryAfterSeconds: rl.retryAfterSeconds,
      })
    }

    try {
      return await verifyReportCore(adminDb, {
        reportId: parsed.data.reportId,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: {
          uid: req.auth.uid,
          claims: {
            role: claims.role as string,
            municipalityId: claims.municipalityId as string,
            active: claims.active as boolean,
          },
        },
        now: Timestamp.now(),
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError) {
        throw bantayogErrorToHttps(err)
      }
      throw err
    }
  },
)
