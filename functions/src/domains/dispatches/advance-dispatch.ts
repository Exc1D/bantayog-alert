import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  BantayogError,
  BantayogErrorCode,
  advanceDispatchRequestSchema,
  type AdvanceDispatchRequest,
  type DispatchDoc,
  invalidTransitionError,
} from '@bantayog/shared-validators'
import { adminDb } from '../../admin-init.js'
import { withIdempotency } from '../../idempotency/guard.js'
import { requireAuth, bantayogErrorToHttps } from '../../callables/https-error.js'
import { shouldEnforceAppCheck } from '../../callables/app-check-config.js'
import { mirrorDispatchStatusToReportInTransaction } from '../reports/dispatch-report-mirror.js'

export const advanceDispatchCore = async (
  db: FirebaseFirestore.Firestore,
  req: AdvanceDispatchRequest & {
    actor: { uid: string; claims: { role: string; municipalityId?: string } }
    now: Timestamp
  },
) => {
  const { dispatchId, to, resolutionSummary, idempotencyKey, actor, now } = req

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { now: _now, ...idempotentPayload } = req
  const { result } = await withIdempotency(
    db,
    {
      key: `advanceDispatch:${actor.uid}:${idempotencyKey}`,
      payload: idempotentPayload,
      now: () => now.toMillis(),
    },
    async () =>
      db.runTransaction(async (transaction) => {
        const dispatchRef = db.collection('dispatches').doc(dispatchId)
        const dispatchSnap = await transaction.get(dispatchRef)

        if (!dispatchSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found')
        }

        const dispatch = dispatchSnap.data() as DispatchDoc

        // Access control
        if (actor.claims.role !== 'responder' || dispatch.assignedTo.uid !== actor.uid) {
          throw new BantayogError(
            BantayogErrorCode.FORBIDDEN,
            'Only assigned responder can advance',
          )
        }

        const from = dispatch.status

        // Valid transitions
        const validTransitions: Record<string, string[]> = {
          accepted: ['acknowledged'],
          acknowledged: ['en_route'],
          en_route: ['on_scene'],
          on_scene: ['resolved'],
        }

        if (!validTransitions[from]?.includes(to)) {
          throw invalidTransitionError(from, to, {
            code: BantayogErrorCode.INVALID_STATUS_TRANSITION,
          })
        }

        if (to === 'resolved' && !resolutionSummary) {
          throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'resolutionSummary required')
        }

        const nowMillis = now.toMillis()
        const patch: Record<string, unknown> = {
          status: to,
          statusUpdatedAt: nowMillis,
          lastStatusAt: nowMillis,
        }

        if (to === 'acknowledged') patch.acknowledgedAt = nowMillis
        if (to === 'en_route') patch.enRouteAt = nowMillis
        if (to === 'on_scene') patch.onSceneAt = nowMillis
        if (to === 'resolved') {
          patch.resolvedAt = nowMillis
          patch.resolutionSummary = resolutionSummary
        }

        await mirrorDispatchStatusToReportInTransaction({
          db,
          tx: transaction,
          dispatchId,
          reportId: dispatch.reportId,
          afterStatus: to,
          actorUid: actor.uid,
          actorRole: 'responder',
          nowMillis,
          correlationId: crypto.randomUUID(),
        })

        transaction.update(dispatchRef, patch)

        const evRef = db.collection('dispatch_events').doc()
        transaction.set(evRef, {
          dispatchId,
          from,
          to,
          actorUid: actor.uid,
          actorRole: actor.claims.role,
          createdAt: nowMillis,
        })

        return { status: to }
      }),
  )

  return result
}

export const advanceDispatch = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    consumeAppCheckToken: false,
    cors: ['http://localhost:5174', 'http://localhost:5175'],
  },
  async (request) => {
    const actor = requireAuth(request, ['responder'])

    try {
      const data = advanceDispatchRequestSchema.parse(request.data)
      return await advanceDispatchCore(adminDb, {
        ...data,
        actor: {
          uid: actor.uid,
          claims: actor.claims as { role: string; municipalityId?: string },
        },
        now: Timestamp.now(),
      })
    } catch (error: unknown) {
      if (error instanceof BantayogError) {
        throw bantayogErrorToHttps(error)
      }
      if (error instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', error.issues[0]?.message ?? 'Invalid argument')
      }
      throw error
    }
  },
)
