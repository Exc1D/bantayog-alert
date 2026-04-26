import { createHash, randomUUID } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import {
  onCall,
  type CallableRequest,
  HttpsError,
  type FunctionsErrorCode,
} from 'firebase-functions/v2/https'
import { z } from 'zod'
import { adminDb } from '../admin-init.js'
import { bantayogErrorToHttps } from './https-error.js'
import {
  withIdempotency,
  IdempotencyInProgressError,
  IdempotencyMismatchError,
} from '../idempotency/guard.js'
import { checkRateLimit } from '../services/rate-limit.js'
import { BantayogError, logDimension } from '@bantayog/shared-validators'

interface ResponderShiftHandoff {
  fromUid: string
  toUid: string
  agencyId: string
  municipalityId: string
  reason: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: Timestamp
  expiresAt: Timestamp
  schemaVersion: number
}

const log = logDimension('responderShiftHandoff')

const initiateSchema = z
  .object({
    toUid: z.string().min(1),
    reason: z.string().trim().min(1).max(1000),
    idempotencyKey: z.uuid(),
  })
  .strict()

const acceptSchema = z
  .object({
    handoffId: z.string().min(1),
    idempotencyKey: z.uuid(),
  })
  .strict()

export interface ResponderHandoffActor {
  uid: string
  claims: Record<string, unknown>
}

export type InitiateResult =
  | { success: true; handoffId: string }
  | { success: false; errorCode: string }

export type AcceptResult = { success: true } | { success: false; errorCode: string }

export async function initiateResponderHandoffCore(
  db: FirebaseFirestore.Firestore,
  input: z.infer<typeof initiateSchema>,
  actor: ResponderHandoffActor,
  correlationId: string,
): Promise<InitiateResult> {
  if (actor.claims.accountStatus !== 'active') {
    log({
      severity: 'ERROR',
      code: 'responderHandoff.initiate.inactive',
      message: 'Caller account status is not active',
      data: { uid: actor.uid, correlationId },
    })
    return { success: false, errorCode: 'permission-denied' }
  }

  if (actor.uid === input.toUid) {
    return { success: false, errorCode: 'invalid-argument' }
  }

  const handoffId = createHash('sha256')
    .update(`${actor.uid}:${input.toUid}:${input.idempotencyKey}`)
    .digest('hex')
    .slice(0, 20)

  const result = await db.runTransaction(async (tx) => {
    const existingRef = db.collection('responder_shift_handoffs').doc(handoffId)
    const existing = await tx.get(existingRef)
    if (existing.exists) {
      return { success: true as const, handoffId }
    }

    const [fromSnap, toSnap] = await Promise.all([
      tx.get(db.collection('responders').doc(actor.uid)),
      tx.get(db.collection('responders').doc(input.toUid)),
    ])

    if (!fromSnap.exists || !toSnap.exists) {
      return { success: false as const, errorCode: 'not-found' }
    }

    const fromData = fromSnap.data()
    const toData = toSnap.data()
    if (!fromData || !toData) {
      return { success: false as const, errorCode: 'not-found' }
    }

    if (fromData.isActive !== true || toData.isActive !== true) {
      return { success: false as const, errorCode: 'failed-precondition' }
    }

    if (fromData.agencyId !== toData.agencyId) {
      log({
        severity: 'ERROR',
        code: 'responderHandoff.initiate.agency_mismatch',
        message: `Agency mismatch: ${String(fromData.agencyId)} vs ${String(toData.agencyId)}`,
        data: { uid: actor.uid, toUid: input.toUid, correlationId },
      })
      return { success: false as const, errorCode: 'failed-precondition' }
    }

    const now = Timestamp.now()

    tx.set(existingRef, {
      fromUid: actor.uid,
      toUid: input.toUid,
      agencyId: fromData.agencyId,
      municipalityId: fromData.municipalityId,
      reason: input.reason,
      status: 'pending',
      createdAt: now,
      expiresAt: Timestamp.fromMillis(now.toMillis() + 30 * 60 * 1000),
      schemaVersion: 1,
    })

    log({
      severity: 'INFO',
      code: 'responderHandoff.initiated',
      message: `Responder shift handoff ${handoffId} created by ${actor.uid} to ${input.toUid}`,
      data: { handoffId, uid: actor.uid, toUid: input.toUid, correlationId },
    })
    return { success: true as const, handoffId }
  })

  return result
}

export async function acceptResponderHandoffCore(
  db: FirebaseFirestore.Firestore,
  input: z.infer<typeof acceptSchema>,
  actor: ResponderHandoffActor,
  correlationId: string,
): Promise<AcceptResult> {
  if (actor.claims.accountStatus !== 'active') {
    log({
      severity: 'ERROR',
      code: 'responderHandoff.accept.inactive',
      message: 'Caller account status is not active',
      data: { uid: actor.uid, correlationId },
    })
    return { success: false, errorCode: 'permission-denied' }
  }

  const { result: cached } = await withIdempotency<z.infer<typeof acceptSchema>, AcceptResult>(
    db,
    { key: `acceptResponderHandoff:${actor.uid}:${input.idempotencyKey}`, payload: input },
    async () => {
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(db.collection('responder_shift_handoffs').doc(input.handoffId))
        if (!snap.exists) return { success: false, errorCode: 'not-found' }

        const handoff = snap.data() as ResponderShiftHandoff | undefined
        if (handoff === undefined) return { success: false, errorCode: 'not-found' }

        if (handoff.toUid !== actor.uid) {
          log({
            severity: 'ERROR',
            code: 'responderHandoff.accept.wrong_target',
            message: `Acceptor ${actor.uid} is not the target responder ${handoff.toUid}`,
            data: { handoffId: input.handoffId, uid: actor.uid, correlationId },
          })
          return { success: false, errorCode: 'permission-denied' }
        }

        if (handoff.expiresAt.toMillis() < Date.now()) {
          return { success: false, errorCode: 'failed-precondition' }
        }

        if (handoff.status === 'accepted') {
          return { success: true as const }
        }

        if (handoff.status !== 'pending') {
          return { success: false, errorCode: 'failed-precondition' }
        }

        tx.update(snap.ref, { status: 'accepted' })

        log({
          severity: 'INFO',
          code: 'responderHandoff.accepted',
          message: `Responder handoff ${input.handoffId} accepted by ${actor.uid}`,
          data: { handoffId: input.handoffId, uid: actor.uid, correlationId },
        })
        return { success: true as const }
      })
    },
  ).catch((err: unknown): { result: AcceptResult; fromCache: boolean } => {
    if (err instanceof IdempotencyInProgressError) {
      return { result: { success: false, errorCode: 'resource-exhausted' }, fromCache: false }
    }
    if (err instanceof IdempotencyMismatchError) {
      return { result: { success: false, errorCode: 'already-exists' }, fromCache: false }
    }
    throw err
  })

  return cached
}

export const initiateResponderHandoff = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    maxInstances: 100,
  },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'token required')
    if (claims.role !== 'responder') {
      throw new HttpsError('permission-denied', 'responder role required')
    }
    if (claims.accountStatus !== 'active') {
      throw new HttpsError('permission-denied', 'account status is not active')
    }

    const parsed = initiateSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.message)

    const rl = await checkRateLimit(adminDb, {
      key: `initiateResponderHandoff:${req.auth.uid}`,
      limit: 60,
      windowSeconds: 60,
      now: Timestamp.now(),
    })
    if (!rl.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit', {
        retryAfterSeconds: rl.retryAfterSeconds,
      })
    }

    const correlationId = randomUUID()
    const actor: ResponderHandoffActor = {
      uid: req.auth.uid,
      claims,
    }

    try {
      const result = await initiateResponderHandoffCore(adminDb, parsed.data, actor, correlationId)
      if (!result.success)
        throw new HttpsError(result.errorCode as FunctionsErrorCode, 'initiate failed')
      return result
    } catch (err: unknown) {
      if (err instanceof HttpsError) throw err
      if (err instanceof BantayogError) throw bantayogErrorToHttps(err)
      throw err
    }
  },
)

export const acceptResponderHandoff = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    maxInstances: 100,
  },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'token required')
    if (claims.role !== 'responder') {
      throw new HttpsError('permission-denied', 'responder role required')
    }
    if (claims.accountStatus !== 'active') {
      throw new HttpsError('permission-denied', 'account status is not active')
    }

    const parsed = acceptSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.message)

    const rl = await checkRateLimit(adminDb, {
      key: `acceptResponderHandoff:${req.auth.uid}`,
      limit: 60,
      windowSeconds: 60,
      now: Timestamp.now(),
    })
    if (!rl.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit', {
        retryAfterSeconds: rl.retryAfterSeconds,
      })
    }

    const correlationId = randomUUID()
    const actor: ResponderHandoffActor = {
      uid: req.auth.uid,
      claims,
    }

    try {
      const result = await acceptResponderHandoffCore(adminDb, parsed.data, actor, correlationId)
      if (!result.success)
        throw new HttpsError(result.errorCode as FunctionsErrorCode, 'accept failed')
      return result
    } catch (err: unknown) {
      if (err instanceof HttpsError) throw err
      if (err instanceof BantayogError) throw bantayogErrorToHttps(err)
      throw err
    }
  },
)
