import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, logDimension } from '@bantayog/shared-validators'
import type { UserRole } from '@bantayog/shared-types'
import { adminDb } from '../admin-init.js'
import { bantayogErrorToHttps } from './https-error.js'
import { withIdempotency } from '../idempotency/guard.js'
import { checkRateLimit } from '../services/rate-limit.js'

const log = logDimension('mergeDuplicates')

const inputSchema = z.object({
  primaryReportId: z.string().min(1),
  duplicateReportIds: z.array(z.string().min(1)).min(1).max(50),
  idempotencyKey: z.uuid(),
})

export interface MergeDuplicatesActor {
  uid: string
  claims: { role: UserRole; municipalityId?: string; active: boolean; auth_time: number }
}

export type MergeDuplicatesResult =
  | { success: true; mergedCount: number }
  | { success: false; errorCode: string }

interface OpsRow {
  id: string
  municipalityId?: string
  duplicateClusterId?: string
}

export async function mergeDuplicatesCore(
  db: FirebaseFirestore.Firestore,
  input: z.infer<typeof inputSchema>,
  actor: MergeDuplicatesActor,
  correlationId = crypto.randomUUID(),
): Promise<MergeDuplicatesResult> {
  if (actor.claims.role !== 'municipal_admin' && actor.claims.role !== 'provincial_superadmin') {
    log({
      severity: 'ERROR',
      code: 'merge.permission_denied',
      message: 'Caller role not allowed',
      data: { role: actor.claims.role, correlationId },
    })
    return { success: false, errorCode: 'permission-denied' }
  }

  if (!actor.claims.active) {
    log({
      severity: 'ERROR',
      code: 'merge.permission_denied',
      message: 'Caller account is not active',
      data: { correlationId },
    })
    return { success: false, errorCode: 'permission-denied' }
  }

  const { primaryReportId, duplicateReportIds, idempotencyKey } = input

  if (duplicateReportIds.includes(primaryReportId)) {
    log({
      severity: 'ERROR',
      code: 'merge.invalid_primary_in_duplicates',
      message: 'primaryReportId cannot be in duplicateReportIds',
      data: { correlationId },
    })
    return { success: false, errorCode: 'invalid-argument' }
  }
  const allIds = [primaryReportId, ...duplicateReportIds]

  const opsSnaps = await Promise.all(allIds.map((id) => db.collection('report_ops').doc(id).get()))
  const opsData: OpsRow[] = opsSnaps.map((s) => {
    const d = s.data()
    return {
      id: s.id,
      municipalityId: d?.municipalityId,
      duplicateClusterId: d?.duplicateClusterId,
    }
  })

  const municipalities = new Set(opsData.map((d) => d.municipalityId))
  if (municipalities.size > 1) {
    log({
      severity: 'ERROR',
      code: 'merge.invalid_argument',
      message: 'Reports belong to different municipalities',
      data: { correlationId },
    })
    return { success: false, errorCode: 'invalid-argument' }
  }

  const clusterIds = new Set(
    opsData.filter((d) => d.duplicateClusterId).map((d) => d.duplicateClusterId),
  )
  if (clusterIds.size > 1) {
    log({
      severity: 'ERROR',
      code: 'merge.failed_precondition',
      message: 'Reports do not share a duplicateClusterId',
      data: { correlationId },
    })
    return { success: false, errorCode: 'failed-precondition' }
  }

  const municipalityId = opsData[0]?.municipalityId
  if (actor.claims.role === 'municipal_admin' && actor.claims.municipalityId !== municipalityId) {
    log({
      severity: 'ERROR',
      code: 'merge.permission_denied',
      message: 'municipal_admin cannot merge reports from another municipality',
      data: { correlationId },
    })
    return { success: false, errorCode: 'permission-denied' }
  }

  const { result: cached } = await withIdempotency(
    db,
    { key: `mergeDuplicates:${actor.uid}:${idempotencyKey}`, payload: input },
    async () => {
      return db.runTransaction(async (tx) => {
        const reportSnaps = await Promise.all(
          allIds.map((id) => tx.get(db.collection('reports').doc(id))),
        )

        for (const snap of reportSnaps) {
          if (!snap.exists) {
            return { success: false, errorCode: 'not-found' } as MergeDuplicatesResult
          }
        }

        const primarySnap = reportSnaps.find((s) => s.id === primaryReportId)
        if (!primarySnap) {
          return { success: false, errorCode: 'not-found' } as MergeDuplicatesResult
        }
        const primaryReportData = primarySnap.data()
        if (!primaryReportData) {
          return { success: false, errorCode: 'not-found' } as MergeDuplicatesResult
        }

        const primaryMediaRefs = primaryReportData.mediaRefs
        const safePrimaryMediaRefs = Array.isArray(primaryMediaRefs)
          ? primaryMediaRefs.filter((r): r is string => typeof r === 'string')
          : []
        const allMediaRefs = new Set<string>(safePrimaryMediaRefs)

        for (const s of reportSnaps) {
          if (s.id === primaryReportId) continue
          const dupMediaRefs = s.data()?.mediaRefs
          if (Array.isArray(dupMediaRefs)) {
            for (const ref of dupMediaRefs) {
              if (typeof ref === 'string') {
                allMediaRefs.add(ref)
              }
            }
          }
        }

        tx.update(db.collection('reports').doc(primaryReportId), {
          mediaRefs: Array.from(allMediaRefs),
          updatedAt: Timestamp.now(),
        })
        tx.update(db.collection('report_ops').doc(primaryReportId), {
          updatedAt: Timestamp.now(),
        })

        const eventRef = db.collection('report_events').doc()
        tx.set(eventRef, {
          eventId: eventRef.id,
          reportId: primaryReportId,
          actor: actor.uid,
          actorRole: actor.claims.role,
          at: Timestamp.now(),
          correlationId,
          schemaVersion: 1,
          mergedCount: duplicateReportIds.length,
          mergedDuplicateIds: duplicateReportIds,
        })

        for (const dupId of duplicateReportIds) {
          tx.update(db.collection('reports').doc(dupId), {
            status: 'merged_as_duplicate',
            mergedInto: primaryReportId,
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

        return { success: true, mergedCount: duplicateReportIds.length } as MergeDuplicatesResult
      })
    },
  )

  return cached
}

export const mergeDuplicates = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true, maxInstances: 100 },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'token required')
    if (claims.role !== 'municipal_admin' && claims.role !== 'provincial_superadmin') {
      throw new HttpsError('permission-denied', 'municipal_admin or provincial_superadmin required')
    }
    if (claims.active !== true) {
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
        role: claims.role as UserRole,
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
