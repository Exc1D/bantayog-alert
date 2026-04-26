import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'
import { adminDb } from '../admin-init.js'
import { withIdempotency } from '../idempotency/guard.js'
import { bantayogErrorToHttps, requireAuth } from './https-error.js'
import { checkRateLimit } from '../services/rate-limit.js'

export const markDispatchUnableToCompleteSchema = z
  .object({
    dispatchId: z.string().min(1).max(128),
    reason: z.string().trim().min(1).max(500),
    idempotencyKey: z.uuid(),
  })
  .strict()

export interface MarkDispatchUnableToCompleteCoreDeps {
  dispatchId: string
  reason: string
  idempotencyKey: string
  actor: { uid: string; claims: { role: string; municipalityId?: string } }
  now: Timestamp
}

export async function markDispatchUnableToCompleteCore(
  db: Firestore,
  deps: MarkDispatchUnableToCompleteCoreDeps,
): Promise<{ status: 'unable_to_complete'; dispatchId: string }> {
  const { dispatchId, reason, idempotencyKey, actor, now } = deps

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { now: _now, ...idempotentPayload } = deps

  const { result } = await withIdempotency(
    db,
    {
      key: `markDispatchUnableToComplete:${actor.uid}:${idempotencyKey}`,
      payload: idempotentPayload,
      now: () => now.toMillis(),
    },
    async () => {
      const rl = await checkRateLimit(db, {
        key: `markDispatchUnableToComplete:${actor.uid}`,
        limit: 30,
        windowSeconds: 60,
        now,
      })
      if (!rl.allowed) {
        throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
          retryAfterSeconds: rl.retryAfterSeconds,
        })
      }

      return db.runTransaction(async (tx) => {
        const dispatchRef = db.collection('dispatches').doc(dispatchId)
        const dispatchSnap = await tx.get(dispatchRef)

        if (!dispatchSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found')
        }

        const dispatch = dispatchSnap.data() as {
          status: string
          assignedTo?: { uid: string; agencyId: string; municipalityId: string }
          reportId: string
        }

        if (dispatch.assignedTo?.uid !== actor.uid) {
          throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Not assigned to this dispatch')
        }

        const activeStates = ['accepted', 'acknowledged', 'en_route', 'on_scene']
        if (!activeStates.includes(dispatch.status)) {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `Dispatch must be active (current: ${dispatch.status})`,
          )
        }

        const reportRef = db.collection('reports').doc(dispatch.reportId)
        const reportSnap = await tx.get(reportRef)
        if (!reportSnap.exists) {
          throw new BantayogError(
            BantayogErrorCode.NOT_FOUND,
            `Report "${dispatch.reportId}" not found`,
          )
        }
        const currentReportStatus = (reportSnap.data() as { status?: string }).status

        tx.update(dispatchRef, {
          status: 'unable_to_complete',
          unableToCompleteReason: reason,
          statusUpdatedAt: now.toMillis(),
          lastStatusAt: now.toMillis(),
        })

        tx.update(reportRef, {
          status: 'verified',
          currentDispatchId: null,
          lastStatusAt: now.toMillis(),
        })

        const nowMs = now.toMillis()
        const correlationId = crypto.randomUUID()

        tx.set(db.collection('dispatch_events').doc(), {
          dispatchId,
          reportId: dispatch.reportId,
          actor: actor.uid,
          actorRole: 'responder',
          fromStatus: dispatch.status,
          toStatus: 'unable_to_complete',
          reason,
          createdAt: nowMs,
          correlationId,
          schemaVersion: 1,
        })

        tx.set(db.collection('report_events').doc(), {
          reportId: dispatch.reportId,
          from: currentReportStatus ?? 'assigned',
          to: 'verified',
          actor: actor.uid,
          actorRole: 'responder',
          at: nowMs,
          correlationId,
          schemaVersion: 1,
        })

        return { status: 'unable_to_complete' as const, dispatchId }
      })
    },
  )

  return result
}

export const markDispatchUnableToComplete = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 10,
    minInstances: 1,
  },
  async (request: CallableRequest<unknown>) => {
    const actor = requireAuth(request, ['responder'])
    if (actor.claims.accountStatus !== 'active') {
      throw new HttpsError('permission-denied', 'account is not active')
    }

    const parsed = markDispatchUnableToCompleteSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    try {
      return await markDispatchUnableToCompleteCore(adminDb, {
        dispatchId: parsed.data.dispatchId,
        reason: parsed.data.reason,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: {
          uid: actor.uid,
          claims: actor.claims as { role: string; municipalityId?: string },
        },
        now: Timestamp.now(),
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError) throw bantayogErrorToHttps(err)
      throw err
    }
  },
)
