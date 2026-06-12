import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import {
  BantayogError,
  BantayogErrorCode,
  canonicalPayloadHash,
  reportFeedbackDocSchema,
  submitReportFeedbackInputSchema,
} from '@bantayog/shared-validators'
import { adminDb } from '../../admin-init.js'
import { withIdempotency } from '../../idempotency/guard.js'
import { isAccountActive } from '../ops/admin-auth.js'
import { shouldEnforceAppCheck } from '../shared/app-check-config.js'
import { getCitizenCallableCorsOrigins } from '../shared/callable-config.js'
import { bantayogErrorToHttps } from '../shared/https-error.js'
import { checkRateLimit } from '../shared/rate-limit.js'

export interface SubmitReportFeedbackCoreDeps {
  reportId: string
  addressed: boolean
  comment?: string | undefined
  actor: { uid: string; claims: { role?: string } }
  now: Timestamp
}

export interface SubmitReportFeedbackResult {
  reportId: string
  addressed: boolean
  submittedAt: number
  updatedAt: number
}

export async function submitReportFeedbackCore(
  db: Firestore,
  deps: SubmitReportFeedbackCoreDeps,
): Promise<SubmitReportFeedbackResult> {
  const parsed = submitReportFeedbackInputSchema.parse({
    reportId: deps.reportId,
    addressed: deps.addressed,
    comment: deps.comment,
  })
  const idempotentPayload = {
    reportId: parsed.reportId,
    addressed: parsed.addressed,
    comment: parsed.comment ?? null,
    actorUid: deps.actor.uid,
  }
  const payloadHash = await canonicalPayloadHash(idempotentPayload)

  const { result } = await withIdempotency(
    db,
    {
      key: `submitReportFeedback:${deps.actor.uid}:${parsed.reportId}:${payloadHash}`,
      payload: idempotentPayload,
      now: () => deps.now.toMillis(),
    },
    async () => {
      return db.runTransaction(async (tx) => {
        const reportRef = db.collection('reports').doc(parsed.reportId)
        const reportSnap = await tx.get(reportRef)
        if (!reportSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found')
        }

        const privateRef = db.collection('report_private').doc(parsed.reportId)
        const privateSnap = await tx.get(privateRef)
        if (!privateSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report owner not found')
        }

        const reporterUid = privateSnap.data()?.reporterUid
        if (reporterUid !== deps.actor.uid) {
          throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'You do not own this report')
        }

        const reportStatus = reportSnap.data()?.status
        if (reportStatus !== 'resolved') {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `submitReportFeedback is only valid for resolved reports, got ${String(reportStatus)}`,
            { reportId: parsed.reportId, status: reportStatus },
          )
        }

        const nowMs = deps.now.toMillis()
        const feedbackRef = db.collection('report_feedback').doc(parsed.reportId)
        const feedbackSnap = await tx.get(feedbackRef)
        const existingFeedback = feedbackSnap.data() as { submittedAt?: unknown } | undefined
        const submittedAt =
          typeof existingFeedback?.submittedAt === 'number' ? existingFeedback.submittedAt : nowMs

        const feedbackDoc = reportFeedbackDocSchema.parse({
          reportId: parsed.reportId,
          reporterUid: deps.actor.uid,
          addressed: parsed.addressed,
          ...(parsed.comment === undefined ? {} : { comment: parsed.comment }),
          submittedAt,
          updatedAt: nowMs,
          schemaVersion: 1,
        })

        tx.set(feedbackRef, feedbackDoc)

        return {
          reportId: parsed.reportId,
          addressed: parsed.addressed,
          submittedAt,
          updatedAt: nowMs,
        }
      })
    },
  )

  return result
}

export const submitReportFeedback = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 50,
    timeoutSeconds: 10,
    cors: getCitizenCallableCorsOrigins(),
  },
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = request.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'sign-in required')
    if (claims.role !== 'citizen') {
      throw new HttpsError('permission-denied', 'citizen role required')
    }
    if (!isAccountActive(claims)) {
      throw new HttpsError('permission-denied', 'account is not active')
    }

    const parsed = submitReportFeedbackInputSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    const now = Timestamp.now()
    const rateLimit = await checkRateLimit(adminDb, {
      key: `submitReportFeedback:${request.auth.uid}`,
      limit: 30,
      windowSeconds: 60,
      now,
    })
    if (!rateLimit.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit exceeded', {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      })
    }

    try {
      return await submitReportFeedbackCore(adminDb, {
        reportId: parsed.data.reportId,
        addressed: parsed.data.addressed,
        comment: parsed.data.comment,
        actor: {
          uid: request.auth.uid,
          claims: {
            role: 'citizen',
          },
        },
        now,
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError) throw bantayogErrorToHttps(err)
      throw err
    }
  },
)
