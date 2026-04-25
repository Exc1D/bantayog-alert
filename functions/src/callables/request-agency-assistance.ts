import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  BantayogError,
  BantayogErrorCode,
  type AgencyAssistanceRequestDoc,
  type CommandChannelThreadDoc,
} from '@bantayog/shared-validators'
import { adminDb } from '../admin-init.js'
import { IdempotencyMismatchError, withIdempotency } from '../idempotency/guard.js'
import { bantayogErrorToHttps, requireAuth } from './https-error.js'
import { checkRateLimit } from '../services/rate-limit.js'

const TERMINAL_STATUSES = new Set([
  'closed',
  'resolved',
  'cancelled',
  'cancelled_false_report',
  'merged_as_duplicate',
] as const)

const VALID_AGENCY_ASSISTANCE_TYPES = new Set([
  'BFP',
  'PNP',
  'PCG',
  'RED_CROSS',
  'DPWH',
  'OTHER',
] as const)

const RequestAgencyAssistanceInputSchema = z
  .object({
    reportId: z.string().min(1).max(128),
    agencyId: z.string().min(1).max(128),
    message: z.string().max(1000).optional().default(''),
    priority: z.enum(['urgent', 'normal']).optional().default('normal'),
    idempotencyKey: z.uuid(),
  })
  .strict()

export interface RequestAgencyAssistanceCoreDeps {
  reportId: string
  agencyId: string
  message?: string
  priority?: 'urgent' | 'normal'
  idempotencyKey: string
  actor: {
    uid: string
    claims: {
      role: string
      municipalityId?: string
    }
  }
  now: Timestamp
}

export async function requestAgencyAssistanceCore(
  db: FirebaseFirestore.Firestore,
  deps: RequestAgencyAssistanceCoreDeps,
): Promise<{ status: 'created'; requestId: string }> {
  const { reportId, agencyId, idempotencyKey, actor, now } = deps
  const message = deps.message ?? ''
  const priority = deps.priority ?? 'normal'

  // Validate agencyId against allowed requestType values before entering transaction.
  // Normalize once and use canonical value everywhere to avoid case mismatch bugs.
  const canonicalAgencyId = agencyId.trim().toUpperCase()
  if (
    !VALID_AGENCY_ASSISTANCE_TYPES.has(
      canonicalAgencyId as typeof VALID_AGENCY_ASSISTANCE_TYPES extends Set<infer T> ? T : never,
    )
  ) {
    throw new BantayogError(
      BantayogErrorCode.INVALID_ARGUMENT,
      `Invalid agencyId: "${agencyId}" must be one of ${[...VALID_AGENCY_ASSISTANCE_TYPES].join(', ')}`,
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { now: _now, ...idempotentPayload } = deps

  const { result } = await withIdempotency(
    db,
    {
      key: `requestAgencyAssistance:${actor.uid}:${idempotencyKey}`,
      payload: idempotentPayload,
      now: () => now.toMillis(),
    },
    async () => {
      const rl = await checkRateLimit(db, {
        key: `requestAgencyAssistance:${actor.uid}`,
        limit: 30,
        windowSeconds: 60,
        now,
        updatedAt: now.toMillis(),
      })
      if (!rl.allowed) {
        throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
          retryAfterSeconds: rl.retryAfterSeconds,
        })
      }

      // Query active agency admins outside transaction for performance.
      // Trade-off: participantUids may be slightly stale if admins change concurrently.
      const agencyAdminsSnap = await db
        .collection('users')
        .where('role', '==', 'agency_admin')
        .where('agencyId', '==', canonicalAgencyId)
        .where('accountStatus', '==', 'active')
        .get()
      const agencyAdminUids = agencyAdminsSnap.docs.map((d) => d.id)

      return db.runTransaction(async (tx) => {
        // Read report_ops first
        const reportOpsRef = db.collection('report_ops').doc(reportId)
        const reportOpsSnap = await tx.get(reportOpsRef)

        if (!reportOpsSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found')
        }

        const reportOps = reportOpsSnap.data() as {
          municipalityId: string
          status: string
        }

        // Authorization: only municipal_admin in the same municipality
        if (actor.claims.role !== 'municipal_admin') {
          throw new BantayogError(
            BantayogErrorCode.FORBIDDEN,
            'Only municipal_admin can request agency assistance',
          )
        }

        if (actor.claims.municipalityId !== reportOps.municipalityId) {
          throw new BantayogError(
            BantayogErrorCode.FORBIDDEN,
            'Cannot request assistance for a report in another municipality',
          )
        }

        // Terminal status check
        if (
          TERMINAL_STATUSES.has(
            reportOps.status as typeof TERMINAL_STATUSES extends Set<infer T> ? T : never,
          )
        ) {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `Cannot request assistance for a report with status ${reportOps.status}`,
          )
        }

        // Create agency_assistance_requests doc
        const requestRef = db.collection('agency_assistance_requests').doc()
        const requestId = requestRef.id

        // Create command_channel_thread
        const threadRef = db.collection('command_channel_threads').doc()
        const threadId = threadRef.id

        const nowMs = now.toMillis()
        const expiresAt = nowMs + 24 * 60 * 60 * 1000 // 24 hours

        tx.set(requestRef, {
          reportId,
          requestedByMunicipalId: actor.claims.municipalityId,
          // Label placeholder — municipality names lookup is out of scope for Phase 5.
          // actor.claims.municipalityId is the stable identifier; the label is
          // for display only and will be resolved when a municipal names collection
          // is added in a later phase.
          requestedByMunicipality: actor.claims.municipalityId ?? 'unknown',
          targetAgencyId: canonicalAgencyId,
          requestType: canonicalAgencyId as AgencyAssistanceRequestDoc['requestType'],
          message,
          priority,
          status: 'pending',
          fulfilledByDispatchIds: [],
          createdAt: nowMs,
          expiresAt,
          schemaVersion: 1,
        } satisfies AgencyAssistanceRequestDoc)

        tx.set(threadRef, {
          threadId,
          reportId,
          threadType: 'agency_assistance' as const,
          assistanceRequestId: requestId,
          subject: `Agency Assistance Request — ${canonicalAgencyId}`,
          // participantUids includes the municipal admin who requested + all active
          // agency admins for the target agency (queried before the transaction).
          participantUids: {
            [actor.uid]: true,
            ...Object.fromEntries(agencyAdminUids.map((uid) => [uid, true])),
          },
          createdBy: actor.uid,
          createdAt: nowMs,
          updatedAt: nowMs,
          schemaVersion: 1,
        } satisfies Omit<CommandChannelThreadDoc, 'lastMessageAt' | 'closedAt'>)

        return { status: 'created' as const, requestId }
      })
    },
  )

  return result
}

export async function requestAgencyAssistanceHandler(
  request: CallableRequest<unknown>,
): Promise<{ status: 'created'; requestId: string }> {
  const actor = requireAuth(request, ['municipal_admin'])
  if (actor.claims.accountStatus !== 'active') {
    throw new HttpsError('permission-denied', 'account is not active')
  }
  const parsed = RequestAgencyAssistanceInputSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

  try {
    return await requestAgencyAssistanceCore(adminDb, {
      reportId: parsed.data.reportId,
      agencyId: parsed.data.agencyId,
      message: parsed.data.message,
      priority: parsed.data.priority,
      idempotencyKey: parsed.data.idempotencyKey,
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
    if (error instanceof IdempotencyMismatchError) {
      throw new HttpsError('already-exists', 'duplicate request with different payload')
    }
    throw error
  }
}

export const requestAgencyAssistance = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 10,
    minInstances: 1,
  },
  requestAgencyAssistanceHandler,
)

// ─── Accept ──────────────────────────────────────────────────────────────────

export interface AcceptAgencyAssistanceCoreDeps {
  requestId: string
  idempotencyKey: string
  actor: {
    uid: string
    claims: {
      role: string
      agencyId?: string
      accountStatus?: string
    }
  }
  now: Timestamp
}

export async function acceptAgencyAssistanceCore(
  db: FirebaseFirestore.Firestore,
  deps: AcceptAgencyAssistanceCoreDeps,
): Promise<{ status: 'accepted' }> {
  const { requestId, idempotencyKey, actor, now } = deps

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { now: _now, ...idempotentPayload } = deps

  const { result } = await withIdempotency(
    db,
    {
      key: `acceptAgencyAssistance:${actor.uid}:${idempotencyKey}`,
      payload: idempotentPayload,
      now: () => now.toMillis(),
    },
    async () => {
      const rl = await checkRateLimit(db, {
        key: `acceptAgencyAssistance:${actor.uid}`,
        limit: 30,
        windowSeconds: 60,
        now,
        updatedAt: now.toMillis(),
      })
      if (!rl.allowed) {
        throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
          retryAfterSeconds: rl.retryAfterSeconds,
        })
      }

      return db.runTransaction(async (tx) => {
        const requestRef = db.collection('agency_assistance_requests').doc(requestId)
        const requestSnap = await tx.get(requestRef)

        if (!requestSnap.exists) {
          throw new BantayogError(
            BantayogErrorCode.NOT_FOUND,
            'Agency assistance request not found',
          )
        }

        const request = requestSnap.data() as AgencyAssistanceRequestDoc

        // Authorization: only the target agency_admin
        if (actor.claims.role !== 'agency_admin') {
          throw new BantayogError(
            BantayogErrorCode.FORBIDDEN,
            'Only agency_admin can accept agency assistance',
          )
        }

        const actorAgencyId = actor.claims.agencyId?.trim().toUpperCase()
        if (actorAgencyId !== request.targetAgencyId) {
          throw new BantayogError(
            BantayogErrorCode.FORBIDDEN,
            'Agency ID does not match the request',
          )
        }

        // Idempotent: already accepted is a no-op
        if (request.status === 'accepted') {
          return { status: 'accepted' as const }
        }

        if (request.status !== 'pending') {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `Cannot accept request with status ${request.status}`,
          )
        }

        const nowMs = now.toMillis()
        tx.update(requestRef, {
          status: 'accepted',
          respondedAt: nowMs,
          respondedBy: actor.uid,
        })

        return { status: 'accepted' as const }
      })
    },
  )

  return result
}

export async function acceptAgencyAssistanceHandler(
  request: CallableRequest<unknown>,
): Promise<{ status: 'accepted' }> {
  const actor = requireAuth(request, ['agency_admin'])
  if (actor.claims.accountStatus !== 'active') {
    throw new HttpsError('permission-denied', 'account is not active')
  }
  const parsed = z
    .object({
      requestId: z.string().min(1).max(128),
      idempotencyKey: z.uuid(),
    })
    .strict()
    .safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

  try {
    return await acceptAgencyAssistanceCore(adminDb, {
      requestId: parsed.data.requestId,
      idempotencyKey: parsed.data.idempotencyKey,
      actor: {
        uid: actor.uid,
        claims: actor.claims as { role: string; agencyId?: string; accountStatus?: string },
      },
      now: Timestamp.now(),
    })
  } catch (error: unknown) {
    if (error instanceof BantayogError) {
      throw bantayogErrorToHttps(error)
    }
    if (error instanceof IdempotencyMismatchError) {
      throw new HttpsError('already-exists', 'duplicate request with different payload')
    }
    throw error
  }
}

export const acceptAgencyAssistance = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 10,
    minInstances: 1,
  },
  acceptAgencyAssistanceHandler,
)

export interface DeclineAgencyAssistanceCoreDeps {
  requestId: string
  reason: string
  idempotencyKey: string
  actor: {
    uid: string
    claims: {
      role: string
      agencyId?: string
      accountStatus?: string
    }
  }
  now: Timestamp
}

export async function declineAgencyAssistanceCore(
  db: FirebaseFirestore.Firestore,
  deps: DeclineAgencyAssistanceCoreDeps,
): Promise<{ status: 'declined' }> {
  const { requestId, reason, idempotencyKey, actor, now } = deps

  const trimmedReason = reason.trim()
  if (!trimmedReason) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'decline reason is required')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { now: _now, ...idempotentPayload } = { ...deps, reason: trimmedReason }

  const { result } = await withIdempotency(
    db,
    {
      key: `declineAgencyAssistance:${actor.uid}:${idempotencyKey}`,
      payload: idempotentPayload,
      now: () => now.toMillis(),
    },
    async () => {
      const rl = await checkRateLimit(db, {
        key: `declineAgencyAssistance:${actor.uid}`,
        limit: 30,
        windowSeconds: 60,
        now,
        updatedAt: now.toMillis(),
      })
      if (!rl.allowed) {
        throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
          retryAfterSeconds: rl.retryAfterSeconds,
        })
      }

      return db.runTransaction(async (tx) => {
        const requestRef = db.collection('agency_assistance_requests').doc(requestId)
        const requestSnap = await tx.get(requestRef)

        if (!requestSnap.exists) {
          throw new BantayogError(
            BantayogErrorCode.NOT_FOUND,
            'Agency assistance request not found',
          )
        }

        const request = requestSnap.data() as AgencyAssistanceRequestDoc

        // Authorization: only the target agency_admin
        if (actor.claims.role !== 'agency_admin') {
          throw new BantayogError(
            BantayogErrorCode.FORBIDDEN,
            'Only agency_admin can decline agency assistance',
          )
        }

        const actorAgencyId = actor.claims.agencyId?.trim().toUpperCase()
        if (actorAgencyId !== request.targetAgencyId) {
          throw new BantayogError(
            BantayogErrorCode.FORBIDDEN,
            'Agency ID does not match the request',
          )
        }

        if (request.status !== 'pending') {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `Cannot decline request with status ${request.status}`,
          )
        }

        const nowMs = now.toMillis()

        // Update request status
        tx.update(requestRef, {
          status: 'declined',
          declinedReason: trimmedReason,
          respondedAt: nowMs,
          respondedBy: actor.uid,
        })

        // Find and close associated thread inside transaction for consistency
        const threadSnap = await tx.get(
          db
            .collection('command_channel_threads')
            .where('assistanceRequestId', '==', requestId)
            .where('threadType', '==', 'agency_assistance')
            .limit(1),
        )

        if (!threadSnap.empty) {
          const threadDoc = threadSnap.docs[0]
          if (threadDoc) {
            tx.update(threadDoc.ref, {
              closedAt: nowMs,
              updatedAt: nowMs,
            })
          }
        }

        return { status: 'declined' as const }
      })
    },
  )

  return result
}

export async function declineAgencyAssistanceHandler(
  request: CallableRequest<unknown>,
): Promise<{ status: 'declined' }> {
  const actor = requireAuth(request, ['agency_admin'])
  if (actor.claims.accountStatus !== 'active') {
    throw new HttpsError('permission-denied', 'account is not active')
  }
  const parsed = z
    .object({
      requestId: z.string().min(1).max(128),
      reason: z.string().trim().min(1).max(200),
      idempotencyKey: z.uuid(),
    })
    .strict()
    .safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

  try {
    return await declineAgencyAssistanceCore(adminDb, {
      requestId: parsed.data.requestId,
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.idempotencyKey,
      actor: {
        uid: actor.uid,
        claims: actor.claims as { role: string; agencyId?: string; accountStatus?: string },
      },
      now: Timestamp.now(),
    })
  } catch (error: unknown) {
    if (error instanceof BantayogError) {
      throw bantayogErrorToHttps(error)
    }
    if (error instanceof IdempotencyMismatchError) {
      throw new HttpsError('already-exists', 'duplicate request with different payload')
    }
    throw error
  }
}

export const declineAgencyAssistance = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 10,
    minInstances: 1,
  },
  declineAgencyAssistanceHandler,
)
