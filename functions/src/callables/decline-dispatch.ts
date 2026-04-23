import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminDb } from '../admin-init.js'
import {
  BantayogError,
  BantayogErrorCode,
  type DispatchDoc,
  invalidTransitionError,
} from '@bantayog/shared-validators'
import { withIdempotency } from '../idempotency/guard.js'
import { bantayogErrorToHttps, requireAuth } from './https-error.js'

export const declineDispatchRequestSchema = z
  .object({
    dispatchId: z.string().min(1).max(128),
    declineReason: z.string().trim().min(1),
    idempotencyKey: z.uuid(),
  })
  .strict()

export interface DeclineDispatchCoreDeps {
  dispatchId: string
  declineReason: string
  idempotencyKey: string
  actor: { uid: string; claims: { role: string; municipalityId?: string } }
  now: Timestamp
}

export async function declineDispatchCore(
  db: FirebaseFirestore.Firestore,
  deps: DeclineDispatchCoreDeps,
): Promise<{ status: 'declined' }> {
  const { dispatchId, declineReason, idempotencyKey, actor, now } = deps
  const normalizedDeclineReason = declineReason.trim()
  if (!normalizedDeclineReason) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'declineReason required')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { now: _now, ...idempotentPayload } = {
    ...deps,
    declineReason: normalizedDeclineReason,
  }

  const { result } = await withIdempotency(
    db,
    {
      key: `declineDispatch:${actor.uid}:${idempotencyKey}`,
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

        if (actor.claims.role !== 'responder' || dispatch.assignedTo.uid !== actor.uid) {
          throw new BantayogError(
            BantayogErrorCode.FORBIDDEN,
            'Only assigned responder can decline',
          )
        }

        if (dispatch.status !== 'pending') {
          throw invalidTransitionError(dispatch.status, 'declined', {
            code: BantayogErrorCode.INVALID_STATUS_TRANSITION,
          })
        }

        transaction.update(dispatchRef, {
          status: 'declined',
          declineReason: normalizedDeclineReason,
          statusUpdatedAt: now.toMillis(),
          lastStatusAt: now,
        })

        transaction.set(db.collection('dispatch_events').doc(), {
          dispatchId,
          from: dispatch.status,
          to: 'declined',
          actorUid: actor.uid,
          actorRole: actor.claims.role,
          reason: normalizedDeclineReason,
          createdAt: now.toMillis(),
        })

        return { status: 'declined' as const }
      }),
  )

  return result
}

export const declineDispatch = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: true,
    timeoutSeconds: 10,
    minInstances: 1,
  },
  async (request: CallableRequest<unknown>) => {
    const actor = requireAuth(request, ['responder'])
    const parsed = declineDispatchRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    try {
      return await declineDispatchCore(adminDb, {
        dispatchId: parsed.data.dispatchId,
        declineReason: parsed.data.declineReason,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: {
          uid: actor.uid,
          claims: actor.claims as { role: string; municipalityId?: string },
        },
        now: Timestamp.now(),
      })
    } catch (error) {
      if (error instanceof BantayogError) {
        throw bantayogErrorToHttps(error)
      }
      throw error
    }
  },
)
