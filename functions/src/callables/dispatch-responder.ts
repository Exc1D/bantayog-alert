import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import type { Database } from 'firebase-admin/database'
import { z } from 'zod'
import {
  BantayogError,
  BantayogErrorCode,
  isValidReportTransition,
  logEvent,
} from '@bantayog/shared-validators'
import { adminDb, rtdb as adminRtdb } from '../admin-init.js'
import { withIdempotency } from '../idempotency/guard.js'
import { checkRateLimit } from '../services/rate-limit.js'
import { bantayogErrorToHttps } from './https-error.js'
import { sendFcmToResponder, FCM_VAPID_PRIVATE_KEY } from '../services/fcm-send.js'
import { enqueueSms } from '../services/send-sms.js'

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

export interface DispatchResponderCoreDeps {
  reportId: string
  responderUid: string
  idempotencyKey: string
  actor: { uid: string; claims: { role?: string; municipalityId?: string } }
  now: Timestamp
}

export async function dispatchResponderCore(
  db: Firestore,
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
      const shiftSnap = await rtdb
        .ref(`/responder_index/${deps.actor.claims.municipalityId}/${deps.responderUid}`)
        .get()
      const shiftData = shiftSnap.val() as { isOnShift?: boolean } | null
      const isOnShift = shiftData?.isOnShift === true
      if (!isOnShift) {
        throw new BantayogError(
          BantayogErrorCode.INVALID_STATUS_TRANSITION,
          'Responder is not on shift',
          { responderUid: deps.responderUid },
        )
      }

      return db.runTransaction(async (tx) => {
        const reportRef = db.collection('reports').doc(deps.reportId)
        const responderRef = db.collection('responders').doc(deps.responderUid)

        const [reportSnap, responderSnap] = await Promise.all([
          tx.get(reportRef),
          tx.get(responderRef),
        ])

        // Re-check shift status inside transaction scope to mitigate TOCTOU race
        const shiftSnap = await rtdb
          .ref(`/responder_index/${deps.actor.claims.municipalityId ?? ''}/${deps.responderUid}`)
          .get()
        const shiftData = shiftSnap.val() as { isOnShift?: boolean } | null
        if (shiftData?.isOnShift !== true) {
          throw new BantayogError(
            BantayogErrorCode.INVALID_STATUS_TRANSITION,
            'Responder went off-shift before dispatch could be created',
          )
        }

        if (!reportSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found')
        }
        if (!responderSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Responder not found')
        }
        const report = reportSnap.data() as Record<string, unknown>
        const responder = responderSnap.data() as Record<string, unknown>

        if (report.municipalityId !== deps.actor.claims.municipalityId) {
          throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Report not in your municipality')
        }
        if (responder.municipalityId !== deps.actor.claims.municipalityId) {
          throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Responder not in your municipality')
        }
        if (responder.isActive !== true) {
          throw new BantayogError(
            BantayogErrorCode.INVALID_STATUS_TRANSITION,
            'Responder is not active',
          )
        }

        const from = report.status as 'verified'
        const to = 'assigned' as const
        if (!isValidReportTransition(from, to)) {
          throw new BantayogError(
            BantayogErrorCode.INVALID_STATUS_TRANSITION,
            `Cannot dispatch from status ${from}`,
          )
        }

        const severity = ((report.severityDerived as string | null | undefined) ??
          'medium') as keyof typeof DEADLINE_BY_SEVERITY
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const deadlineMs = DEADLINE_BY_SEVERITY[severity] ?? DEADLINE_BY_SEVERITY.high

        let smsRecipientPhone: string | undefined
        let smsLocale: 'tl' | 'en' = 'tl'
        let smsPublicRef = deps.reportId
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 8)

        const salt = process.env.SMS_MSISDN_HASH_SALT
        if (salt) {
          const consentSnap = await tx.get(db.collection('report_sms_consent').doc(deps.reportId))
          if (consentSnap.exists) {
            const consentData = consentSnap.data()
            if (consentData?.phone) {
              smsRecipientPhone = consentData.phone as string
              smsLocale = (consentData.locale as 'tl' | 'en' | undefined) ?? 'tl'

              const lookupQ = db
                .collection('report_lookup')
                .where('reportId', '==', deps.reportId)
                .limit(1)
              const lookupSnap = await tx.get(lookupQ)
              const lookupDoc = lookupSnap.docs[0]
              smsPublicRef = lookupDoc?.id ?? smsPublicRef
            }
          }
        }

        const dispatchRef = db.collection('dispatches').doc()
        const dispatchId = dispatchRef.id

        tx.set(dispatchRef, {
          dispatchId,
          reportId: deps.reportId,
          status: 'pending',
          assignedTo: {
            uid: deps.responderUid,
            agencyId: responder.agencyId,
            municipalityId: responder.municipalityId,
          },
          dispatchedAt: deps.now,
          dispatchedBy: deps.actor.uid,
          lastStatusAt: deps.now,
          acknowledgementDeadlineAt: Timestamp.fromMillis(deps.now.toMillis() + deadlineMs),
          correlationId,
          schemaVersion: 1,
        })

        tx.update(reportRef, {
          status: to,
          lastStatusAt: deps.now,
          lastStatusBy: deps.actor.uid,
          currentDispatchId: dispatchId,
        })

        const reportEvRef = db.collection('report_events').doc()
        tx.set(reportEvRef, {
          eventId: reportEvRef.id,
          reportId: deps.reportId,
          from,
          to,
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          at: deps.now,
          correlationId,
          schemaVersion: 1,
        })

        const dispatchEvRef = db.collection('dispatch_events').doc()
        tx.set(dispatchEvRef, {
          eventId: dispatchEvRef.id,
          dispatchId,
          reportId: deps.reportId,
          from: null,
          to: 'pending',
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          at: deps.now,
          correlationId,
          schemaVersion: 1,
        })

        if (salt && smsRecipientPhone) {
          enqueueSms(db, tx, {
            reportId: deps.reportId,
            dispatchId,
            purpose: 'status_update',
            recipientMsisdn: smsRecipientPhone,
            locale: smsLocale,
            publicRef: smsPublicRef,
            salt,
            nowMs: deps.now.toMillis(),
            providerId: 'semaphore',
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
          claims: claims as { role?: string; municipalityId?: string },
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
