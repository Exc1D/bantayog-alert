import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'
import { adminDb } from '../../admin-init.js'
import { withIdempotency } from '../../idempotency/guard.js'
import { shouldEnforceAppCheck } from '../shared/app-check-config.js'
import { sendFcmToResponder, type FcmSendResult } from '../ops/fcm-send.js'
import { getRedispatchDeadlineMs } from './redispatch-policy.js'

const TERMINAL_ESCALATION_STATUSES = new Set(['resolved', 'cancelled', 'superseded'])

const InputSchema = z
  .object({
    dispatchId: z.string().min(1).max(128),
    newResponderUid: z.string().min(1).max(128),
    idempotencyKey: z.uuid(),
  })
  .strict()

type FcmResult = 'sent' | 'no_token' | 'network_error' | 'sent_with_invalid_tokens'

function mapFcmResult(fcm: FcmSendResult): FcmResult {
  if (fcm.warnings.includes('fcm_no_token')) return 'no_token'
  if (fcm.warnings.includes('fcm_network_error')) return 'network_error'
  if (fcm.warnings.length > 0) return 'sent_with_invalid_tokens'
  return 'sent'
}

export interface EscalateDispatchCoreDeps {
  dispatchId: string
  newResponderUid: string
  idempotencyKey: string
  actor: {
    uid: string
    claims: { role?: string; municipalityId?: string }
  }
  now: Timestamp
}

export async function escalateDispatchCore(db: Firestore, deps: EscalateDispatchCoreDeps) {
  const correlationId = crypto.randomUUID()
  const parsed = InputSchema.parse({
    dispatchId: deps.dispatchId,
    newResponderUid: deps.newResponderUid,
    idempotencyKey: deps.idempotencyKey,
  })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { now: _now, ...idempotentPayload } = deps
  // fallow-ignore-next-line code-duplication
  const { result } = await withIdempotency(
    db,
    {
      key: `escalateDispatch:${deps.actor.uid}:${deps.idempotencyKey}`,
      payload: idempotentPayload,
      now: () => deps.now.toMillis(),
    },
    // FCM send, notification event, and retry-queue enqueue live inside the
    // idempotent operation so a cached-result retry cannot double-send.
    async () => {
      // fallow-ignore-next-line complexity
      const txResult = await db.runTransaction(async (tx) => {
        const dispatchRef = db.collection('dispatches').doc(parsed.dispatchId)
        const dispatchSnap = await tx.get(dispatchRef)
        if (!dispatchSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found')
        }

        const dispatch = dispatchSnap.data() as {
          municipalityId?: string
          assignedTo?: { uid: string; agencyId: string; municipalityId: string }
          status?: string
          escalationCount?: number
          previouslyNotifiedResponderUids?: string[]
          reportId?: string
        }

        if (dispatch.status !== undefined && TERMINAL_ESCALATION_STATUSES.has(dispatch.status)) {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `cannot escalate a ${dispatch.status} dispatch`,
          )
        }

        // Authz: municipal_admin can only escalate in their municipality
        // provincial_superadmin can escalate anywhere
        const role = deps.actor.claims.role
        const municipalityId = dispatch.municipalityId
        if (role === 'municipal_admin') {
          const adminMuni = deps.actor.claims.municipalityId
          if (municipalityId !== adminMuni) {
            throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'not your municipality')
          }
        } else if (role === 'provincial_superadmin') {
          // superadmin can escalate any dispatch
        } else {
          throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'admin required')
        }

        // Verify new responder is active
        const responderRef = db.collection('responders').doc(parsed.newResponderUid)
        const responderSnap = await tx.get(responderRef)
        if (!responderSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'responder not found')
        }
        const responder = responderSnap.data() as {
          accountStatus?: string
          agencyId?: string
          municipalityId?: string
        }
        if (responder.accountStatus !== 'active') {
          throw new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, 'responder is not active')
        }

        // Read the report before any write so the SLA deadline can be recomputed
        // from severity; the new responder gets a fresh acknowledgement window.
        let severityDerived: unknown
        if (dispatch.reportId) {
          const reportSnap = await tx.get(db.collection('reports').doc(dispatch.reportId))
          severityDerived = (reportSnap.data() as { severityDerived?: unknown } | undefined)
            ?.severityDerived
        }

        // Exclude previously notified
        const previouslyNotified = new Set(dispatch.previouslyNotifiedResponderUids ?? [])
        if (previouslyNotified.has(parsed.newResponderUid)) {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            'responder already notified',
          )
        }

        const currentEscalationCount =
          typeof dispatch.escalationCount === 'number' ? dispatch.escalationCount : 0
        const previousResponderUid = dispatch.assignedTo?.uid ?? ''
        const previouslyNotifiedResponderUids = Array.from(
          new Set(
            previousResponderUid
              ? [...(dispatch.previouslyNotifiedResponderUids ?? []), previousResponderUid]
              : (dispatch.previouslyNotifiedResponderUids ?? []),
          ),
        )

        tx.update(dispatchRef, {
          assignedTo: {
            uid: parsed.newResponderUid,
            agencyId: responder.agencyId,
            municipalityId: responder.municipalityId,
          },
          escalationCount: currentEscalationCount + 1,
          previouslyNotifiedResponderUids,
          escalationReason: 'admin_override',
          monitorLeaseAt: deps.now.toMillis(),
          status: 'pending',
          statusUpdatedAt: deps.now.toMillis(),
          acknowledgementDeadlineAt: deps.now.toMillis() + getRedispatchDeadlineMs(severityDerived),
        })

        tx.set(db.collection('dispatch_events').doc(), {
          type: 'escalation_attempted',
          dispatchId: parsed.dispatchId,
          fromResponderUid: dispatch.assignedTo?.uid ?? '',
          toResponderUid: parsed.newResponderUid,
          agencyId: responder.agencyId,
          municipalityId: responder.municipalityId,
          reason: 'admin_override',
          at: deps.now.toMillis(),
          correlationId,
          schemaVersion: 1,
        })

        return {
          dispatchId: parsed.dispatchId,
          status: 'pending' as const,
          reportId: dispatch.reportId ?? '',
          responder: {
            agencyId: responder.agencyId,
            municipalityId: responder.municipalityId,
          },
          correlationId,
        }
      })

      const fcm = await sendFcmToResponder({
        uid: parsed.newResponderUid,
        title: 'Dispatch escalated',
        body: `Report ${txResult.reportId.slice(0, 8)} — see app for details`,
        data: {
          dispatchId: txResult.dispatchId,
          reportId: txResult.reportId,
          correlationId: txResult.correlationId,
        },
      })

      const fcmResult = mapFcmResult(fcm)
      const nowMillis = deps.now.toMillis()

      await db.collection('dispatch_events').add({
        type: 'notification_attempted',
        dispatchId: txResult.dispatchId,
        responderUid: parsed.newResponderUid,
        agencyId: txResult.responder.agencyId,
        municipalityId: txResult.responder.municipalityId,
        fcmResult,
        fcmWarnings: fcm.warnings,
        at: nowMillis,
        correlationId: txResult.correlationId,
        schemaVersion: 1,
      })

      await db.collection('dispatches').doc(txResult.dispatchId).update({
        fcmResult,
        fcmWarnings: fcm.warnings,
      })

      if (fcmResult === 'network_error') {
        await db.collection('fcm_retry_queue').add({
          dispatchId: txResult.dispatchId,
          responderUid: parsed.newResponderUid,
          attemptCount: 0,
          lastAttemptAt: nowMillis,
          nextAttemptAt: nowMillis + 30_000,
          originalError: 'fcm_network_error',
          status: 'pending',
        })
      }

      return {
        ...txResult,
        fcmResult,
        fcmWarnings: fcm.warnings,
      }
    },
  )

  return result
}

export const escalateDispatch = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 100,
  },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'token required')
    const role = claims.role as string | undefined
    if (role !== 'municipal_admin' && role !== 'provincial_superadmin') {
      throw new HttpsError('permission-denied', 'admin required')
    }
    if (claims.accountStatus !== 'active') {
      throw new HttpsError('permission-denied', 'account not active')
    }
    const parsed = InputSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    return await escalateDispatchCore(adminDb, {
      dispatchId: parsed.data.dispatchId,
      newResponderUid: parsed.data.newResponderUid,
      idempotencyKey: parsed.data.idempotencyKey,
      actor: {
        uid: req.auth.uid,
        claims: {
          role: claims.role as string,
          municipalityId: claims.municipalityId as string,
        },
      },
      now: Timestamp.now(),
    })
  },
)
