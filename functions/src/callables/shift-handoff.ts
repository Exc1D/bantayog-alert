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
import { withIdempotency } from '../idempotency/guard.js'
import { checkRateLimit } from '../services/rate-limit.js'
import { BantayogError, logDimension, type ReportStatus } from '@bantayog/shared-validators'
import { type UserRole } from '@bantayog/shared-types'

interface ShiftHandoff {
  fromUid: string
  municipalityId: string
  notes: string
  activeIncidentIds: string[]
  status: 'pending' | 'accepted'
  createdAt: Timestamp
  expiresAt: Timestamp
  schemaVersion: number
}

const log = logDimension('shiftHandoff')

const initiateSchema = z.object({
  notes: z.string().max(2000),
  idempotencyKey: z.uuid(),
})

const acceptSchema = z.object({
  handoffId: z.string().min(1),
  idempotencyKey: z.uuid(),
})

const ADMIN_ROLES: UserRole[] = ['municipal_admin', 'agency_admin', 'provincial_superadmin']
const ACTIVE_REPORT_STATUSES: ReportStatus[] = ['assigned', 'acknowledged', 'en_route', 'on_scene']
const ACTIVE_DISPATCH_STATUSES = ['accepted', 'acknowledged', 'en_route', 'on_scene']

export interface HandoffActor {
  uid: string
  claims: { role: UserRole; municipalityId?: string; active: boolean; auth_time: number }
}

export type InitiateResult =
  | { success: true; handoffId: string }
  | { success: false; errorCode: string }

export type AcceptResult = { success: true } | { success: false; errorCode: string }

export async function initiateShiftHandoffCore(
  db: FirebaseFirestore.Firestore,
  input: z.infer<typeof initiateSchema>,
  actor: HandoffActor,
  correlationId: string,
): Promise<InitiateResult> {
  if (!actor.claims.active) {
    log({
      severity: 'ERROR',
      code: 'handoff.initiate.inactive',
      message: 'Caller account is not active',
      data: { uid: actor.uid, correlationId },
    })
    return { success: false, errorCode: 'permission-denied' }
  }

  const municipalityId = actor.claims.municipalityId
  if (!municipalityId) {
    log({
      severity: 'ERROR',
      code: 'handoff.initiate.missing_municipality',
      message: 'municipalityId missing',
      data: { uid: actor.uid, correlationId },
    })
    return { success: false, errorCode: 'permission-denied' }
  }

  const handoffId = createHash('sha256')
    .update(`${actor.uid}:${input.idempotencyKey}`)
    .digest('hex')
    .slice(0, 20)

  const result = await db.runTransaction(async (tx) => {
    const existingRef = db.collection('shift_handoffs').doc(handoffId)
    const existing = await tx.get(existingRef)
    if (existing.exists) {
      return { success: true as const, handoffId }
    }

    const [opsSnap, dispatchSnap] = await Promise.all([
      db
        .collection('report_ops')
        .where('municipalityId', '==', municipalityId)
        .where('status', 'in', ACTIVE_REPORT_STATUSES)
        .get(),
      db
        .collection('dispatches')
        .where('municipalityId', '==', municipalityId)
        .where('status', 'in', ACTIVE_DISPATCH_STATUSES)
        .get(),
    ])

    const activeIncidentIds = [
      ...opsSnap.docs.map((d) => d.id),
      ...dispatchSnap.docs.map((d) => d.id),
    ]

    const now = Timestamp.now()

    tx.set(existingRef, {
      fromUid: actor.uid,
      municipalityId,
      notes: input.notes,
      activeIncidentIds,
      status: 'pending',
      createdAt: now,
      expiresAt: Timestamp.fromMillis(now.toMillis() + 30 * 60 * 1000),
      schemaVersion: 1,
    })

    log({
      severity: 'INFO',
      code: 'handoff.initiated',
      message: `Shift handoff ${handoffId} created by ${actor.uid}`,
      data: { handoffId, uid: actor.uid, correlationId },
    })
    return { success: true as const, handoffId }
  })

  return result
}

export async function acceptShiftHandoffCore(
  db: FirebaseFirestore.Firestore,
  input: z.infer<typeof acceptSchema>,
  actor: HandoffActor,
  correlationId: string,
): Promise<AcceptResult> {
  if (!actor.claims.active) {
    log({
      severity: 'ERROR',
      code: 'handoff.accept.inactive',
      message: 'Caller account is not active',
      data: { uid: actor.uid, correlationId },
    })
    return { success: false, errorCode: 'permission-denied' }
  }

  const { result: cached } = await withIdempotency<z.infer<typeof acceptSchema>, AcceptResult>(
    db,
    { key: `acceptShiftHandoff:${actor.uid}:${input.idempotencyKey}`, payload: input },
    async () => {
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(db.collection('shift_handoffs').doc(input.handoffId))
        if (!snap.exists) return { success: false, errorCode: 'not-found' }

        const handoff = snap.data() as ShiftHandoff | undefined
        if (handoff === undefined) return { success: false, errorCode: 'not-found' }

        if (
          actor.claims.role === 'municipal_admin' &&
          handoff.municipalityId !== actor.claims.municipalityId
        ) {
          log({
            severity: 'ERROR',
            code: 'handoff.accept.wrong_municipality',
            message: `Municipality mismatch: ${handoff.municipalityId} vs ${actor.claims.municipalityId ?? 'undefined'}`,
            data: { handoffId: input.handoffId, uid: actor.uid, correlationId },
          })
          return { success: false, errorCode: 'permission-denied' }
        }

        if (handoff.fromUid === actor.uid) {
          return { success: false, errorCode: 'failed-precondition' }
        }

        if (handoff.expiresAt.toMillis() < Date.now()) {
          return { success: false, errorCode: 'failed-precondition' }
        }

        if (handoff.status === 'accepted') return { success: true as const }

        tx.update(snap.ref, {
          status: 'accepted',
          toUid: actor.uid,
          acceptedAt: Timestamp.now(),
        })

        log({
          severity: 'INFO',
          code: 'handoff.accepted',
          message: `Handoff ${input.handoffId} accepted by ${actor.uid}`,
          data: { handoffId: input.handoffId, uid: actor.uid, correlationId },
        })
        return { success: true as const }
      })
    },
  )

  return cached
}

export const initiateShiftHandoff = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true, maxInstances: 100 },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'token required')
    if (!ADMIN_ROLES.includes(claims.role as UserRole)) {
      throw new HttpsError('permission-denied', 'admin role required')
    }
    if (claims.active !== true) {
      throw new HttpsError('permission-denied', 'account is not active')
    }
    if (claims.role === 'municipal_admin' && claims.municipalityId === undefined) {
      throw new HttpsError('permission-denied', 'municipalityId missing from token claims')
    }

    const parsed = initiateSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.message)

    const rl = await checkRateLimit(adminDb, {
      key: `initiateShiftHandoff:${req.auth.uid}`,
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
    const actor: HandoffActor = {
      uid: req.auth.uid,
      claims: {
        role: claims.role as UserRole,
        ...(claims.municipalityId !== undefined
          ? { municipalityId: claims.municipalityId as string }
          : {}),
        active: claims.active as boolean,
        auth_time: claims.auth_time as number,
      },
    }

    try {
      const result = await initiateShiftHandoffCore(adminDb, parsed.data, actor, correlationId)
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

export const acceptShiftHandoff = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true, maxInstances: 100 },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'token required')
    if (!ADMIN_ROLES.includes(claims.role as UserRole)) {
      throw new HttpsError('permission-denied', 'admin role required')
    }
    if (claims.active !== true) {
      throw new HttpsError('permission-denied', 'account is not active')
    }
    if (claims.role === 'municipal_admin' && claims.municipalityId === undefined) {
      throw new HttpsError('permission-denied', 'municipalityId missing from token claims')
    }

    const parsed = acceptSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.message)

    const rl = await checkRateLimit(adminDb, {
      key: `acceptShiftHandoff:${req.auth.uid}`,
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
    const actor: HandoffActor = {
      uid: req.auth.uid,
      claims: {
        role: claims.role as UserRole,
        ...(claims.municipalityId !== undefined
          ? { municipalityId: claims.municipalityId as string }
          : {}),
        active: claims.active as boolean,
        auth_time: claims.auth_time as number,
      },
    }

    try {
      const result = await acceptShiftHandoffCore(adminDb, parsed.data, actor, correlationId)
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
