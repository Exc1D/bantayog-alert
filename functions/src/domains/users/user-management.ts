import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode, logDimension } from '@bantayog/shared-validators'
import { adminDb } from '../../admin-init.js'
import { withIdempotency } from '../../idempotency/guard.js'
import { checkRateLimit } from '../../services/rate-limit.js'
import { bantayogErrorToHttps, requireAuth } from '../../callables/https-error.js'
import { getAuth } from 'firebase-admin/auth'

const log = logDimension('userManagement')

export const suspendUserSchema = z
  .object({
    uid: z.string().min(1).max(128),
    idempotencyKey: z.uuid(),
  })
  .strict()

export const revokeUserSchema = z
  .object({
    uid: z.string().min(1).max(128),
    idempotencyKey: z.uuid(),
  })
  .strict()

export const resetUserTotpSchema = z
  .object({
    uid: z.string().min(1).max(128),
    idempotencyKey: z.uuid(),
  })
  .strict()

interface SuspendUserDeps {
  uid: string
  idempotencyKey: string
  actor: { uid: string; claims: Record<string, unknown> }
  now: Timestamp
}

function assertCanManageUser(
  actor: { uid: string; claims: Record<string, unknown> },
  targetUser: { municipalityId?: string; role?: string },
) {
  const actorRole = actor.claims.role as string | undefined
  const actorMunicipalityId = actor.claims.municipalityId as string | undefined

  if (actorRole === 'provincial_superadmin') {
    return
  }

  if (actorRole === 'municipal_admin') {
    if (typeof targetUser.role !== 'string') {
      throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'target user role is missing')
    }
    if (targetUser.role === 'provincial_superadmin') {
      throw new BantayogError(
        BantayogErrorCode.FORBIDDEN,
        'insufficient privileges to manage provincial superadmin',
      )
    }
    if (
      typeof targetUser.municipalityId !== 'string' ||
      targetUser.municipalityId !== actorMunicipalityId
    ) {
      throw new BantayogError(
        BantayogErrorCode.FORBIDDEN,
        'cannot manage users outside your municipality',
      )
    }
    return
  }

  throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'insufficient privileges')
}

function writeUserManagementEvent(
  db: Firestore,
  tx: FirebaseFirestore.Transaction,
  params: {
    actor: { uid: string; claims: Record<string, unknown> }
    from: string
    to: string
    now: Timestamp
    correlationId: string
  },
) {
  const eventRef = db.collection('report_events').doc()
  tx.set(eventRef, {
    eventId: eventRef.id,
    eventType: 'user_management',
    actor: params.actor.uid,
    actorRole: params.actor.claims.role ?? 'unknown',
    from: params.from,
    to: params.to,
    at: params.now,
    correlationId: params.correlationId,
    schemaVersion: 1,
  })
}

export async function suspendUserCore(
  db: Firestore,
  auth: ReturnType<typeof getAuth>,
  deps: SuspendUserDeps,
): Promise<{ uid: string; status: 'suspended' }> {
  const { uid, idempotencyKey, actor, now } = deps
  const correlationId = crypto.randomUUID()

  const { result } = await withIdempotency(
    db,
    {
      key: `suspendUser:${actor.uid}:${uid}:${idempotencyKey}`,
      payload: { uid, idempotencyKey },
      now: () => now.toMillis(),
    },
    async () => {
      const rl = await checkRateLimit(db, {
        key: `suspendUser:${actor.uid}`,
        limit: 60,
        windowSeconds: 60,
        now,
      })
      if (!rl.allowed) {
        throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
          retryAfterSeconds: rl.retryAfterSeconds,
        })
      }

      const txResult = await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(uid)
        const userSnap = await tx.get(userRef)

        if (!userSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, `User '${uid}' not found`)
        }

        const user = userSnap.data() as {
          status?: string
          municipalityId?: string
          role?: string
        }

        assertCanManageUser(actor, user)

        if (user.status === 'suspended') {
          return { uid, status: 'suspended' as const, previousStatus: user.status ?? 'active' }
        }

        tx.update(userRef, {
          status: 'suspended',
          suspendedAt: now.toMillis(),
          updatedAt: now.toMillis(),
        })

        writeUserManagementEvent(db, tx, {
          actor,
          from: user.status ?? 'active',
          to: 'suspended',
          now,
          correlationId,
        })

        return { uid, status: 'suspended' as const, previousStatus: user.status ?? 'active' }
      })

      log({
        severity: 'INFO',
        code: 'user.suspended',
        message: `User ${uid} suspended`,
        data: { uid, actorUid: actor.uid },
      })

      // Disable auth account outside the transaction to avoid holding the lock
      // during an external API call. Rollback Firestore on auth failure.
      try {
        await auth.updateUser(uid, { disabled: true })
      } catch (authErr) {
        console.warn('[suspendUser] auth update failed, rolling back', authErr)
        await db.collection('users').doc(uid).update({
          status: txResult.previousStatus,
          suspendedAt: FieldValue.delete(),
        })
        throw authErr
      }

      return { uid, status: txResult.status }
    },
  )

  return result
}

interface RevokeUserDeps {
  uid: string
  idempotencyKey: string
  actor: { uid: string; claims: Record<string, unknown> }
  now: Timestamp
}

export async function revokeUserCore(
  db: Firestore,
  auth: ReturnType<typeof getAuth>,
  deps: RevokeUserDeps,
): Promise<{ uid: string; status: 'revoked' }> {
  const { uid, idempotencyKey, actor, now } = deps
  const correlationId = crypto.randomUUID()

  const { result } = await withIdempotency(
    db,
    {
      key: `revokeUser:${actor.uid}:${uid}:${idempotencyKey}`,
      payload: { uid, idempotencyKey },
      now: () => now.toMillis(),
    },
    async () => {
      const rl = await checkRateLimit(db, {
        key: `revokeUser:${actor.uid}`,
        limit: 60,
        windowSeconds: 60,
        now,
      })
      if (!rl.allowed) {
        throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
          retryAfterSeconds: rl.retryAfterSeconds,
        })
      }

      const txResult = await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(uid)
        const userSnap = await tx.get(userRef)

        if (!userSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, `User '${uid}' not found`)
        }

        const user = userSnap.data() as {
          status?: string
          municipalityId?: string
          role?: string
        }

        assertCanManageUser(actor, user)

        if (user.status === 'revoked') {
          return { uid, status: 'revoked' as const, previousStatus: user.status ?? 'active' }
        }

        tx.update(userRef, {
          status: 'revoked',
          revokedAt: now.toMillis(),
          updatedAt: now.toMillis(),
        })

        writeUserManagementEvent(db, tx, {
          actor,
          from: user.status ?? 'active',
          to: 'revoked',
          now,
          correlationId,
        })

        return { uid, status: 'revoked' as const, previousStatus: user.status ?? 'active' }
      })

      log({
        severity: 'INFO',
        code: 'user.revoked',
        message: `User ${uid} revoked`,
        data: { uid, actorUid: actor.uid },
      })

      try {
        await auth.updateUser(uid, { disabled: true })
      } catch (authErr) {
        console.warn('[revokeUser] auth update failed, rolling back', authErr)
        await db.collection('users').doc(uid).update({
          status: txResult.previousStatus,
          revokedAt: FieldValue.delete(),
        })
        throw authErr
      }

      return { uid, status: txResult.status }
    },
  )

  return result
}

interface ResetUserTotpDeps {
  uid: string
  idempotencyKey: string
  actor: { uid: string; claims: Record<string, unknown> }
  now: Timestamp
}

export async function resetUserTotpCore(
  db: Firestore,
  auth: ReturnType<typeof getAuth>,
  deps: ResetUserTotpDeps,
): Promise<{ uid: string; reset: true }> {
  const { uid, idempotencyKey, actor, now } = deps
  const correlationId = crypto.randomUUID()

  const { result } = await withIdempotency(
    db,
    {
      key: `resetUserTotp:${actor.uid}:${uid}:${idempotencyKey}`,
      payload: { uid, idempotencyKey },
      now: () => now.toMillis(),
    },
    async () => {
      const rl = await checkRateLimit(db, {
        key: `resetUserTotp:${actor.uid}`,
        limit: 60,
        windowSeconds: 60,
        now,
      })
      if (!rl.allowed) {
        throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
          retryAfterSeconds: rl.retryAfterSeconds,
        })
      }

      const txResult = await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(uid)
        const userSnap = await tx.get(userRef)

        if (!userSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, `User '${uid}' not found`)
        }

        const user = userSnap.data() as {
          municipalityId?: string
          role?: string
          totpSecret?: string | null
          totpEnrolledAt?: number | null
        }

        assertCanManageUser(actor, user)

        if (!user.totpSecret && !user.totpEnrolledAt) {
          return {
            uid,
            reset: true as const,
            hadEnrollment: false as const,
            previousTotpSecret: user.totpSecret ?? null,
            previousTotpEnrolledAt: user.totpEnrolledAt ?? null,
          }
        }

        tx.update(userRef, {
          totpSecret: null,
          totpEnrolledAt: null,
          updatedAt: now.toMillis(),
        })

        writeUserManagementEvent(db, tx, {
          actor,
          from: 'totp_enrolled',
          to: 'totp_reset',
          now,
          correlationId,
        })

        return {
          uid,
          reset: true as const,
          hadEnrollment: true as const,
          previousTotpSecret: user.totpSecret ?? null,
          previousTotpEnrolledAt: user.totpEnrolledAt ?? null,
        }
      })

      log({
        severity: 'INFO',
        code: 'user.totp_reset',
        message: `User ${uid} TOTP reset`,
        data: { uid, actorUid: actor.uid },
      })

      if (txResult.hadEnrollment) {
        try {
          await auth.updateUser(uid, { multiFactor: { enrolledFactors: [] } })
        } catch (authErr) {
          console.warn('[resetUserTotp] auth update failed, rolling back', authErr)
          await db.collection('users').doc(uid).update({
            totpSecret: txResult.previousTotpSecret,
            totpEnrolledAt: txResult.previousTotpEnrolledAt,
          })
          throw authErr
        }
      }

      return { uid, reset: txResult.reset }
    },
  )

  return result
}

export const suspendUser = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 10,
    minInstances: 1,
  },
  async (request: CallableRequest<unknown>) => {
    const actor = requireAuth(request, ['provincial_superadmin', 'municipal_admin'])

    const parsed = suspendUserSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    try {
      return await suspendUserCore(adminDb, getAuth(), {
        uid: parsed.data.uid,
        idempotencyKey: parsed.data.idempotencyKey,
        actor,
        now: Timestamp.now(),
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError) throw bantayogErrorToHttps(err)
      throw err
    }
  },
)

export const revokeUser = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 10,
    minInstances: 1,
  },
  async (request: CallableRequest<unknown>) => {
    const actor = requireAuth(request, ['provincial_superadmin', 'municipal_admin'])

    const parsed = revokeUserSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    try {
      return await revokeUserCore(adminDb, getAuth(), {
        uid: parsed.data.uid,
        idempotencyKey: parsed.data.idempotencyKey,
        actor,
        now: Timestamp.now(),
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError) throw bantayogErrorToHttps(err)
      throw err
    }
  },
)

export const resetUserTotp = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 10,
    minInstances: 1,
  },
  async (request: CallableRequest<unknown>) => {
    const actor = requireAuth(request, ['provincial_superadmin', 'municipal_admin'])

    const parsed = resetUserTotpSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    try {
      return await resetUserTotpCore(adminDb, getAuth(), {
        uid: parsed.data.uid,
        idempotencyKey: parsed.data.idempotencyKey,
        actor,
        now: Timestamp.now(),
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError) throw bantayogErrorToHttps(err)
      throw err
    }
  },
)
