import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  BantayogError,
  BantayogErrorCode,
  isValidReportTransition,
  logDimension,
  type ReportStatus,
} from '@bantayog/shared-validators'
import { adminDb } from '../admin-init.js'
import { withIdempotency } from '../idempotency/guard.js'
import { checkRateLimit } from '../services/rate-limit.js'
import { bantayogErrorToHttps } from './https-error.js'

export const closeReportRequestSchema = z.object({
  reportId: z.string().min(1).max(128),
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  idempotencyKey: z.string().uuid(),
  closureSummary: z.string().trim().min(1).max(2000).optional(),
})
export type CloseReportRequest = z.infer<typeof closeReportRequestSchema>

export interface CloseReportResult {
  status: ReportStatus
  reportId: string
}

export interface CloseReportActor {
  uid: string
  claims: {
    role?: string
    municipalityId?: string
    active?: boolean
  }
}

export interface CloseReportCoreDeps {
  reportId: string
  idempotencyKey: string
  closureSummary?: string | undefined
  actor: CloseReportActor
  now: Timestamp
}

export async function closeReportCore(
  db: Firestore,
  deps: CloseReportCoreDeps,
): Promise<CloseReportResult> {
  const correlationId = crypto.randomUUID()

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { now: _now, ...idempotentPayload } = deps
  const { result } = await withIdempotency<Omit<CloseReportCoreDeps, 'now'>, CloseReportResult>(
    db,
    {
      key: `closeReport:${deps.actor.uid}:${deps.idempotencyKey}`,
      payload: idempotentPayload,
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
        if (reportData.municipalityId !== deps.actor.claims.municipalityId) {
          throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Report is not in your municipality')
        }

        const from = reportData.status as ReportStatus
        const to = 'closed' as const

        if (from !== 'resolved') {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `closeReport requires status resolved (got: ${from})`,
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
        if (deps.closureSummary !== undefined) {
          updates.closureSummary = deps.closureSummary
        }
        tx.update(reportRef, updates)

        const eventRef = db.collection('report_events').doc()
        tx.set(eventRef, {
          eventId: eventRef.id,
          reportId: deps.reportId,
          from,
          to,
          actor: deps.actor.uid,
          // Falls back to 'municipal_admin' when role is undefined (should not happen for municipal_admin callers,
          // but provincial_superadmin tokens may omit role)
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          at: deps.now,
          correlationId,
          schemaVersion: 1,
        })

        const log = logDimension('closeReport')
        log({
          severity: 'INFO',
          code: 'report.closed',
          message: `Report ${deps.reportId} transitioned ${from} → ${to}`,
          data: {
            reportId: deps.reportId,
            from,
            to,
            actorUid: deps.actor.uid,
            correlationId,
            hasClosureSummary: deps.closureSummary !== undefined,
          },
        })

        return { status: to, reportId: deps.reportId }
      })
    },
  )
  return result
}

export const closeReport = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true, maxInstances: 100 },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'token required')
    if (claims.role !== 'municipal_admin' && claims.role !== 'provincial_superadmin') {
      throw new HttpsError('permission-denied', 'municipal_admin or provincial_superadmin required')
    }
    if (claims.active !== true) {
      throw new HttpsError('permission-denied', 'account is not active')
    }
    // municipal_admin requires a municipalityId; provincial_superadmin does not
    if (claims.role === 'municipal_admin' && claims.municipalityId === undefined) {
      throw new HttpsError('permission-denied', 'municipalityId missing from token claims')
    }

    const parsed = closeReportRequestSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    const rl = await checkRateLimit(adminDb, {
      key: `closeReport:${req.auth.uid}`,
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
      return await closeReportCore(adminDb, {
        reportId: parsed.data.reportId,
        idempotencyKey: parsed.data.idempotencyKey,
        closureSummary: parsed.data.closureSummary,
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
