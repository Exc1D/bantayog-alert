import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode, logEvent } from '@bantayog/shared-validators'
import { adminDb, rtdb as adminRtdb } from '../admin-init.js'
import { withIdempotency } from '../idempotency/guard.js'
import { checkRateLimit } from '../services/rate-limit.js'
import { bantayogErrorToHttps } from './https-error.js'
import { isAccountActive } from './admin-auth.js'
import { getAdminCallableCorsOrigins } from './callable-config.js'
import { shouldEnforceAppCheck } from './app-check-config.js'
import { sendFcmToResponder, type FcmSendResult } from '../services/fcm-send.js'
import {
  validateDispatchTransaction,
  type DispatchResponderCoreDeps,
} from './dispatch-responder-validation.js'
import type { Database } from 'firebase-admin/database'
import { writeDispatchDocs } from './dispatch-responder-writes.js'

const InputSchema = z
  .object({
    reportId: z.string().min(1).max(128),
    responderUid: z.string().min(1).max(128),
    idempotencyKey: z.uuid(),
  })
  .strict()

const DEADLINE_BY_SEVERITY: Record<'critical' | 'high' | 'low' | 'medium', number> = {
  critical: 5 * 60 * 1_000,
  high: 5 * 60 * 1_000,
  medium: 15 * 60 * 1_000,
  low: 30 * 60 * 1_000,
}

function isValidSeverity(s: unknown): s is keyof typeof DEADLINE_BY_SEVERITY {
  return typeof s === 'string' && Object.hasOwn(DEADLINE_BY_SEVERITY, s)
}

export type { DispatchResponderCoreDeps } from './dispatch-responder-validation.js'

type FcmResult = 'sent' | 'no_token' | 'network_error' | 'sent_with_invalid_tokens'

function mapFcmResult(fcm: FcmSendResult): FcmResult {
  if (fcm.warnings.includes('fcm_no_token')) return 'no_token'
  if (fcm.warnings.includes('fcm_network_error')) return 'network_error'
  if (fcm.warnings.length > 0) return 'sent_with_invalid_tokens'
  return 'sent'
}

async function writeFcmTracking(
  db: FirebaseFirestore.Firestore,
  dispatchId: string,
  responderUid: string,
  agencyId: string,
  municipalityId: string,
  fcmResult: FcmResult,
  fcmWarnings: string[],
  nowMillis: number,
  correlationId: string,
): Promise<void> {
  await db.collection('dispatch_events').add({
    type: 'notification_attempted',
    dispatchId,
    responderUid,
    agencyId,
    municipalityId,
    fcmResult,
    fcmWarnings,
    at: nowMillis,
    correlationId,
    schemaVersion: 1,
  })
}

async function updateDispatchFcmResult(
  db: FirebaseFirestore.Firestore,
  dispatchId: string,
  fcmResult: FcmResult,
  fcmWarnings: string[],
): Promise<void> {
  await db.collection('dispatches').doc(dispatchId).update({
    fcmResult,
    fcmWarnings,
  })
}

async function queueFcmRetry(
  db: FirebaseFirestore.Firestore,
  dispatchId: string,
  responderUid: string,
  nowMillis: number,
): Promise<void> {
  await db.collection('fcm_retry_queue').add({
    dispatchId,
    responderUid,
    attemptCount: 0,
    lastAttemptAt: nowMillis,
    nextAttemptAt: nowMillis + 30_000,
    originalError: 'fcm_network_error',
    status: 'pending',
  })
}

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
        const deadlineMs = DEADLINE_BY_SEVERITY[severity]

        const dispatchId = deps.reportId + '_' + deps.responderUid
        const dispatchRef = db.collection('dispatches').doc(dispatchId)

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

        return {
          dispatchId,
          status: 'pending' as const,
          reportId: deps.reportId,
          correlationId,
          responder,
        }
      })
    },
  )

  const fcm = await sendFcmToResponder({
    uid: deps.responderUid,
    title: 'New dispatch',
    body: `Report ${deps.reportId.slice(0, 8)} — see app for details`,
    data: {
      dispatchId: result.dispatchId,
      reportId: deps.reportId,
      correlationId: result.correlationId,
    },
  })

  const fcmResult = mapFcmResult(fcm)
  const nowMillis = deps.now.toMillis()

  await writeFcmTracking(
    db,
    result.dispatchId,
    deps.responderUid,
    result.responder.agencyId,
    result.responder.municipalityId,
    fcmResult,
    fcm.warnings,
    nowMillis,
    result.correlationId,
  )

  await updateDispatchFcmResult(db, result.dispatchId, fcmResult, fcm.warnings)

  if (fcmResult === 'network_error') {
    await queueFcmRetry(db, result.dispatchId, deps.responderUid, nowMillis)
  }

  return {
    dispatchId: result.dispatchId,
    status: result.status,
    reportId: result.reportId,
    correlationId: result.correlationId,
    fcmResult,
    fcmWarnings: fcm.warnings,
  }
}

export const dispatchResponder = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 100,
    cors: getAdminCallableCorsOrigins(),
    secrets: [],
  },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'token required')
    if (claims.role !== 'municipal_admin' && claims.role !== 'provincial_superadmin') {
      throw new HttpsError('permission-denied', 'municipal_admin or provincial_superadmin required')
    }
    if (!isAccountActive(claims)) throw new HttpsError('permission-denied', 'account is not active')
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
            ...(Array.isArray(claims.permittedMunicipalityIds) &&
            claims.permittedMunicipalityIds.length > 0
              ? {
                  permittedMunicipalityIds: claims.permittedMunicipalityIds.filter(
                    (id): id is string => typeof id === 'string',
                  ),
                }
              : {}),
          },
        },
        now: Timestamp.now(),
      })

      return result
    } catch (err: unknown) {
      if (err instanceof BantayogError) {
        throw bantayogErrorToHttps(err)
      }
      throw err
    }
  },
)
