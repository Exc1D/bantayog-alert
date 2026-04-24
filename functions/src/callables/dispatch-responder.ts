import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode, logEvent } from '@bantayog/shared-validators'
import { adminDb, rtdb as adminRtdb } from '../admin-init.js'
import { withIdempotency } from '../idempotency/guard.js'
import { checkRateLimit } from '../services/rate-limit.js'
import { bantayogErrorToHttps } from './https-error.js'
import { sendFcmToResponder, FCM_VAPID_PRIVATE_KEY } from '../services/fcm-send.js'
import {
  validateDispatchTransaction,
  type DispatchResponderCoreDeps,
} from './dispatch-responder-validation.js'
import type { Database } from 'firebase-admin/database'
import { enqueueDispatchSms } from './dispatch-responder-notify.js'
import { buildSmsPayload, writeDispatchDocs } from './dispatch-responder-writes.js'

const InputSchema = z
  .object({
    reportId: z.string().min(1).max(128),
    responderUid: z.string().min(1).max(128),
    idempotencyKey: z.uuid(),
  })
  .strict()

const DEADLINE_BY_SEVERITY: Record<'critical' | 'high' | 'low' | 'medium', number> = {
  critical: 5 * 60 * 1000,
  high: 5 * 60 * 1000,
  medium: 15 * 60 * 1000,
  low: 30 * 60 * 1000,
}

function isValidSeverity(s: unknown): s is keyof typeof DEADLINE_BY_SEVERITY {
  return typeof s === 'string' && Object.hasOwn(DEADLINE_BY_SEVERITY, s)
}

export type { DispatchResponderCoreDeps } from './dispatch-responder-validation.js'

export async function dispatchResponderCore(
  db: FirebaseFirestore.Firestore,
  rtdb: Database,
  deps: DispatchResponderCoreDeps,
) {
  const correlationId = crypto.randomUUID()

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { now: _now, ...idempotentPayload } = deps
  const { result } = await withIdempotency(
    db,
    {
      key: `dispatchResponder:${deps.actor.uid}:${deps.idempotencyKey}`,
      payload: idempotentPayload,
      now: () => deps.now.toMillis(),
    },
    async () => {
      if (!deps.actor.claims.municipalityId) {
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'municipalityId is required')
      }

      return db.runTransaction(async (tx) => {
        const reportRef = db.collection('reports').doc(deps.reportId)
        const responderRef = db.collection('responders').doc(deps.responderUid)

        const { report, responder, from } = await validateDispatchTransaction({
          tx,
          rtdb,
          deps,
          reportRef,
          responderRef,
        })

        const severity = isValidSeverity(report.severityDerived) ? report.severityDerived : 'medium'
        const deadlineMs =
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          DEADLINE_BY_SEVERITY[severity] ?? DEADLINE_BY_SEVERITY.high

        let smsPublicRef = deps.reportId
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 8)

        const salt = process.env.SMS_MSISDN_HASH_SALT
        const smsPayload = salt
          ? await buildSmsPayload({
              db,
              tx,
              reportId: deps.reportId,
              salt,
              defaultPublicRef: smsPublicRef,
            })
          : null
        if (smsPayload) {
          smsPublicRef = smsPayload.publicRef
        }

        const dispatchRef = db.collection('dispatches').doc()
        const dispatchId = dispatchRef.id

        const reportEvRef = db.collection('report_events').doc()
        const dispatchEvRef = db.collection('dispatch_events').doc()

        writeDispatchDocs({
          tx,
          deps,
          dispatchRef,
          reportRef,
          reportEvRef,
          dispatchEvRef,
          responder,
          deadlineMs,
          correlationId,
          from,
          to: 'assigned',
        })

        if (salt && smsPayload) {
          enqueueDispatchSms({
            db,
            tx,
            reportId: deps.reportId,
            dispatchId,
            recipientMsisdn: smsPayload.recipientMsisdn,
            locale: smsPayload.locale,
            publicRef: smsPublicRef,
            salt,
            nowMs: deps.now.toMillis(),
          })
        }

        logEvent({
          severity: 'INFO',
          code: 'dispatch.created',
          message: `Dispatch ${dispatchId} created for report ${deps.reportId}`,
          dimension: 'dispatchResponder',
          data: {
            correlationId,
            reportId: deps.reportId,
            dispatchId,
            actorUid: deps.actor.uid,
            severity_report: severity,
          },
        })

        return { dispatchId, status: 'pending' as const, reportId: deps.reportId, correlationId }
      })
    },
  )
  return result
}

export const dispatchResponder = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: true,
    maxInstances: 100,
    secrets: [FCM_VAPID_PRIVATE_KEY],
  },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'token required')
    if (claims.role !== 'municipal_admin' && claims.role !== 'provincial_superadmin') {
      throw new HttpsError('permission-denied', 'municipal_admin or provincial_superadmin required')
    }
    if (claims.active !== true) throw new HttpsError('permission-denied', 'account is not active')
    const parsed = InputSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')
    const rl = await checkRateLimit(adminDb, {
      key: `dispatchResponder:${req.auth.uid}`,
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
      const result = await dispatchResponderCore(adminDb, adminRtdb, {
        reportId: parsed.data.reportId,
        responderUid: parsed.data.responderUid,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: {
          uid: req.auth.uid,
          claims: {
            role: claims.role,
            ...(typeof claims.municipalityId === 'string'
              ? { municipalityId: claims.municipalityId }
              : {}),
          },
        },
        now: Timestamp.now(),
      })

      // Best-effort FCM push — does not fail the callable.
      const fcm = await sendFcmToResponder({
        uid: parsed.data.responderUid,
        title: 'New dispatch',
        body: `Report ${parsed.data.reportId.slice(0, 8)} — see app for details`,
        data: {
          dispatchId: result.dispatchId,
          reportId: parsed.data.reportId,
          correlationId: result.correlationId,
        },
      })

      return { ...result, warnings: fcm.warnings }
    } catch (err: unknown) {
      if (err instanceof BantayogError) {
        throw bantayogErrorToHttps(err)
      }
      throw err
    }
  },
)
