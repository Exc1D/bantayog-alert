import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'
import { adminDb } from '../admin-init.js'
import { withIdempotency } from '../idempotency/guard.js'
import { bantayogErrorToHttps } from './https-error.js'
import { checkRateLimit } from '../services/rate-limit.js'

export const acceptDispatchRequestSchema = z
  .object({
    dispatchId: z.string().min(1).max(128),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    idempotencyKey: z.string().uuid(),
  })
  .strict()

export type AcceptDispatchRequest = z.infer<typeof acceptDispatchRequestSchema>

export interface AcceptDispatchCoreDeps {
  dispatchId: string
  idempotencyKey: string
  actor: { uid: string }
  now: Timestamp
}

export async function acceptDispatchCore(
  db: Firestore,
  deps: AcceptDispatchCoreDeps,
): Promise<{ status: 'accepted'; dispatchId: string; fromCache: boolean }> {
  const correlationId = crypto.randomUUID()

  // Enforce rate limit: 30 accepts/minute per responder
  const rl = await checkRateLimit(db, {
    key: `accept::${deps.actor.uid}`,
    limit: 30,
    windowSeconds: 60,
    now: deps.now,
  })
  if (!rl.allowed) {
    throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
      retryAfterSeconds: rl.retryAfterSeconds,
    })
  }

  const { result, fromCache } = await withIdempotency(
    db,
    {
      key: `acceptDispatch:${deps.actor.uid}:${deps.idempotencyKey}`,
      payload: deps,
      now: () => deps.now.toMillis(),
    },
    async () =>
      db.runTransaction(async (tx) => {
        const dispatchRef = db.collection('dispatches').doc(deps.dispatchId)
        const snap = await tx.get(dispatchRef)
        if (!snap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found')
        }
        const d = snap.data() as { status: string; assignedTo: { uid: string } }
        if (d.assignedTo.uid !== deps.actor.uid) {
          throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Not assigned to this responder')
        }
        if (d.status !== 'pending') {
          throw new BantayogError(
            BantayogErrorCode.CONFLICT,
            `Dispatch is no longer pending (current status: ${d.status})`,
          )
        }

        tx.update(dispatchRef, {
          status: 'accepted',
          acceptedAt: FieldValue.serverTimestamp(),
          lastStatusAt: deps.now,
        })

        const evRef = db.collection('dispatch_events').doc()
        tx.set(evRef, {
          dispatchId: deps.dispatchId,
          from: 'pending',
          to: 'accepted',
          actorUid: deps.actor.uid,
          actorRole: 'responder',
          at: deps.now,
          correlationId,
          schemaVersion: 1,
        })

        return { status: 'accepted' as const, dispatchId: deps.dispatchId }
      }),
  )

  return { ...result, fromCache }
}

export const acceptDispatch = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true, timeoutSeconds: 10, minInstances: 1 },
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = request.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'token required')
    if (claims.role !== 'responder') {
      throw new HttpsError('permission-denied', 'responder role required')
    }
    if (claims.active !== true) throw new HttpsError('permission-denied', 'account is not active')

    const parsed = acceptDispatchRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    try {
      const result = await acceptDispatchCore(adminDb, {
        dispatchId: parsed.data.dispatchId,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: { uid: request.auth.uid },
        now: Timestamp.now(),
      })
      return result
    } catch (err: unknown) {
      if (err instanceof BantayogError) throw bantayogErrorToHttps(err)
      throw err
    }
  },
)
