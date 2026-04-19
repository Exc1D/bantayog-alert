import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  BantayogError,
  BantayogErrorCode,
  isValidDispatchTransition,
  logDimension,
  type DispatchStatus,
} from '@bantayog/shared-validators'
import { adminDb } from '../admin-init.js'
import { withIdempotency } from '../idempotency/guard.js'
import { checkRateLimit } from '../services/rate-limit.js'
import { bantayogErrorToHttps } from './https-error.js'

const CANCEL_REASONS = [
  'responder_unavailable',
  'duplicate_report',
  'admin_error',
  'citizen_withdrew',
] as const
export type CancelReason = (typeof CANCEL_REASONS)[number]

const InputSchema = z
  .object({
    dispatchId: z.string().min(1).max(128),
    reason: z.enum(CANCEL_REASONS),
    idempotencyKey: z.uuid(),
  })
  .strict()

const CANCELLABLE_FROM_STATES: readonly string[] = ['pending']

export interface CancelDispatchCoreDeps {
  dispatchId: string
  reason: CancelReason
  idempotencyKey: string
  actor: { uid: string; claims: { role?: string; municipalityId?: string } }
  now: Timestamp
}

export async function cancelDispatchCore(db: Firestore, deps: CancelDispatchCoreDeps) {
  const correlationId = crypto.randomUUID()

  const { result } = await withIdempotency(
    db,
    {
      key: `cancelDispatch:${deps.actor.uid}:${deps.idempotencyKey}`,
      payload: deps,
      now: () => deps.now.toMillis(),
    },
    async () =>
      db.runTransaction(async (tx) => {
        const dispatchRef = db.collection('dispatches').doc(deps.dispatchId)
        const dispatchSnap = await tx.get(dispatchRef)
        if (!dispatchSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found')
        }
        const dispatch = dispatchSnap.data()
        if (!dispatch) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch data unavailable')
        }
        if (
          (dispatch.assignedTo as { municipalityId?: string } | null | undefined)
            ?.municipalityId !== deps.actor.claims.municipalityId
        ) {
          throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Dispatch not in your municipality')
        }

        const from = dispatch.status as string
        const to = 'cancelled' as const

        if (!CANCELLABLE_FROM_STATES.includes(from)) {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `Cannot cancel dispatch in status ${from} (3b scope: pending-only)`,
          )
        }

        if (!isValidDispatchTransition(from as DispatchStatus, to)) {
          throw new BantayogError(BantayogErrorCode.INVALID_STATUS_TRANSITION, 'invalid transition')
        }

        tx.update(dispatchRef, {
          status: to,
          lastStatusAt: deps.now,
          cancelledBy: deps.actor.uid,
          cancelReason: deps.reason,
        })

        const reportRef = db.collection('reports').doc(dispatch.reportId as string)
        const reportSnap = await tx.get(reportRef)
        if (reportSnap.exists) {
          const reportData = reportSnap.data()
          if (reportData?.currentDispatchId === deps.dispatchId) {
            tx.update(reportRef, {
              status: 'verified',
              currentDispatchId: null,
              lastStatusAt: deps.now,
              lastStatusBy: deps.actor.uid,
            })
            const revertEv = db.collection('report_events').doc()
            tx.set(revertEv, {
              eventId: revertEv.id,
              reportId: dispatch.reportId,
              from: 'assigned',
              to: 'verified',
              actor: deps.actor.uid,
              actorRole: deps.actor.claims.role ?? 'municipal_admin',
              at: deps.now,
              correlationId,
              schemaVersion: 1,
            })
          }
        }

        const evRef = db.collection('dispatch_events').doc()
        tx.set(evRef, {
          eventId: evRef.id,
          dispatchId: deps.dispatchId,
          reportId: dispatch.reportId,
          from,
          to,
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          reason: deps.reason,
          at: deps.now,
          correlationId,
          schemaVersion: 1,
        })

        const log = logDimension('cancelDispatch')
        log({
          severity: 'INFO',
          code: 'dispatch.cancelled',
          message: `Dispatch ${deps.dispatchId} cancelled by ${deps.actor.uid}`,
          data: {
            dispatchId: deps.dispatchId,
            reportId: dispatch.reportId,
            reason: deps.reason,
            actorUid: deps.actor.uid,
            from,
            correlationId,
          },
        })

        return { status: to, dispatchId: deps.dispatchId }
      }),
  )
  return result
}

export const cancelDispatch = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true, maxInstances: 100 },
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
      key: `cancelDispatch:${req.auth.uid}`,
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
      return await cancelDispatchCore(adminDb, {
        dispatchId: parsed.data.dispatchId,
        reason: parsed.data.reason,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: {
          uid: req.auth.uid,
          claims: {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            ...(claims.role !== undefined && { role: claims.role as string }),
            ...(claims.municipalityId !== undefined && {
              municipalityId: claims.municipalityId as string,
            }),
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
