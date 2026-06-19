import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, logDimension } from '@bantayog/shared-validators'
import type { UserRole } from '@bantayog/shared-types'
import { adminDb } from '../../admin-init.js'
import { bantayogErrorToHttps } from '../shared/https-error.js'
import {
  withIdempotency,
  IdempotencyInProgressError,
  IdempotencyMismatchError,
} from '../../idempotency/guard.js'
import { checkRateLimit } from '../shared/rate-limit.js'
import { shouldEnforceAppCheck } from '../shared/app-check-config.js'
import {
  buildMergeDuplicateReportUpdate,
  buildMergeEventData,
  buildPrimaryMergeReportUpdate,
  excludesPrimaryReportId,
  hasUniqueDuplicateReportIds,
  type MergeOpsRow,
  type MergeReportRow,
  validateMergeActorClaims,
  validateMergeOpsRows,
} from './merge-duplicates-policy.js'

const log = logDimension('mergeDuplicates')

export const inputSchema = z
  .object({
    primaryReportId: z.string().min(1),
    duplicateReportIds: z.array(z.string().min(1)).min(1).max(50),
    idempotencyKey: z.uuid(),
  })
  .refine((data) => hasUniqueDuplicateReportIds(data.duplicateReportIds), {
    message: 'duplicateReportIds must be unique',
    path: ['duplicateReportIds'],
  })
  .refine((data) => excludesPrimaryReportId(data.primaryReportId, data.duplicateReportIds), {
    message: 'primaryReportId cannot be in duplicateReportIds',
    path: ['duplicateReportIds'],
  })

export interface MergeDuplicatesActor {
  uid: string
  claims: { role: UserRole; municipalityId?: string; active: boolean; auth_time: number }
}

export type MergeDuplicatesResult =
  | { success: true; mergedCount: number }
  | { success: false; errorCode: string }

export async function mergeDuplicatesCore(
  db: FirebaseFirestore.Firestore,
  input: z.infer<typeof inputSchema>,
  actor: MergeDuplicatesActor,
  correlationId = crypto.randomUUID(),
): Promise<MergeDuplicatesResult> {
  const actorPolicy = validateMergeActorClaims(actor.claims)
  if (!actorPolicy.success && actorPolicy.reason === 'role') {
    log({
      severity: 'ERROR',
      code: 'merge.permission_denied',
      message: 'Caller role not allowed',
      data: { role: actor.claims.role, correlationId },
    })
    return { success: false, errorCode: 'permission-denied' }
  }

  if (!actorPolicy.success && actorPolicy.reason === 'inactive') {
    log({
      severity: 'ERROR',
      code: 'merge.permission_denied',
      message: 'Caller account is not active',
      data: { correlationId },
    })
    return { success: false, errorCode: 'permission-denied' }
  }

  const { primaryReportId, duplicateReportIds, idempotencyKey } = input
  const allIds = [primaryReportId, ...duplicateReportIds]

  const { result: cached } = await withIdempotency(
    db,
    { key: `mergeDuplicates:${actor.uid}:${idempotencyKey}`, payload: input },
    async (): Promise<MergeDuplicatesResult> => {
      return db.runTransaction(async (tx): Promise<MergeDuplicatesResult> => {
        // Read report_ops inside transaction
        const opsSnaps = await Promise.all(
          allIds.map((id) => tx.get(db.collection('report_ops').doc(id))),
        )

        // Fail fast if any missing
        for (const snap of opsSnaps) {
          if (!snap.exists) {
            return { success: false, errorCode: 'not-found' }
          }
        }

        const opsData: MergeOpsRow[] = opsSnaps.map((s) => {
          const d = s.data()
          return {
            id: s.id,
            municipalityId: d?.municipalityId,
            duplicateClusterId: d?.duplicateClusterId,
          }
        })

        const opsPolicy = validateMergeOpsRows(opsData, actor.claims)
        if (!opsPolicy.success) return { success: false, errorCode: opsPolicy.errorCode }

        const reportSnaps = await Promise.all(
          allIds.map((id) => tx.get(db.collection('reports').doc(id))),
        )

        for (const snap of reportSnaps) {
          if (!snap.exists) {
            return { success: false, errorCode: 'not-found' }
          }
        }

        const primarySnap = reportSnaps.find((s) => s.id === primaryReportId)
        if (!primarySnap) {
          return { success: false, errorCode: 'not-found' }
        }
        if (!primarySnap.data()) {
          return { success: false, errorCode: 'not-found' }
        }

        const reportRows: MergeReportRow[] = reportSnaps.map((snap) => ({
          id: snap.id,
          mediaRefs: snap.data()?.mediaRefs,
        }))

        tx.update(db.collection('reports').doc(primaryReportId), {
          ...buildPrimaryMergeReportUpdate(primaryReportId, reportRows),
          updatedAt: Timestamp.now(),
        })
        tx.update(db.collection('report_ops').doc(primaryReportId), {
          updatedAt: Timestamp.now(),
        })

        const eventRef = db.collection('report_events').doc()
        tx.set(eventRef, {
          ...buildMergeEventData({
            eventId: eventRef.id,
            primaryReportId,
            actorUid: actor.uid,
            actorRole: actor.claims.role,
            at: Timestamp.now(),
            correlationId,
            duplicateReportIds,
          }),
        })

        for (const dupId of duplicateReportIds) {
          tx.update(db.collection('reports').doc(dupId), {
            ...buildMergeDuplicateReportUpdate(primaryReportId),
            updatedAt: Timestamp.now(),
          })
          tx.update(db.collection('report_ops').doc(dupId), {
            status: 'merged_as_duplicate',
            updatedAt: Timestamp.now(),
          })
        }

        log({
          severity: 'INFO',
          code: 'merge.complete',
          message: `Merged ${String(duplicateReportIds.length)} duplicates into ${primaryReportId}`,
          data: { correlationId },
        })

        return { success: true, mergedCount: duplicateReportIds.length }
      })
    },
  ).catch((err: unknown): { result: MergeDuplicatesResult; fromCache: boolean } => {
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

export const mergeDuplicates = onCall(
  { region: 'asia-southeast1', enforceAppCheck: shouldEnforceAppCheck(), maxInstances: 100 },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'token required')
    if (claims.role !== 'municipal_admin' && claims.role !== 'provincial_superadmin') {
      throw new HttpsError('permission-denied', 'municipal_admin or provincial_superadmin required')
    }
    const accountStatus = claims.accountStatus as string | undefined
    if (claims.active !== true && accountStatus !== 'active') {
      throw new HttpsError('permission-denied', 'account is not active')
    }
    if (claims.role === 'municipal_admin' && claims.municipalityId === undefined) {
      throw new HttpsError('permission-denied', 'municipalityId missing from token claims')
    }

    const parsed = inputSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    const rl = await checkRateLimit(adminDb, {
      key: `mergeDuplicates:${req.auth.uid}`,
      limit: 60,
      windowSeconds: 60,
      now: Timestamp.now(),
    })
    if (!rl.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit', {
        retryAfterSeconds: rl.retryAfterSeconds,
      })
    }

    try {
      const correlationId = crypto.randomUUID()
      const actorClaims: MergeDuplicatesActor['claims'] = {
        role: claims.role,
        active: claims.active as boolean,
        auth_time: claims.auth_time as number,
      }
      if (typeof claims.municipalityId === 'string') {
        actorClaims.municipalityId = claims.municipalityId
      }
      return await mergeDuplicatesCore(
        adminDb,
        parsed.data,
        {
          uid: req.auth.uid,
          claims: actorClaims,
        },
        correlationId,
      )
    } catch (err: unknown) {
      if (err instanceof BantayogError) {
        throw bantayogErrorToHttps(err)
      }
      throw err
    }
  },
)
