import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode, logDimension } from '@bantayog/shared-validators'
import { adminDb } from '../admin-init.js'
import { withIdempotency } from '../idempotency/guard.js'
import { checkRateLimit } from '../services/rate-limit.js'
import { bantayogErrorToHttps } from './https-error.js'
import { isAccountActive } from './admin-auth.js'
import { getAdminCallableCorsOrigins } from './callable-config.js'
import { shouldEnforceAppCheck } from './app-check-config.js'

const UNPUBLISH_REASONS = [
  'sensitive_content',
  'privacy_request',
  'false_or_misleading',
  'legal_request',
  'other',
] as const
type UnpublishReason = (typeof UNPUBLISH_REASONS)[number]

const InputSchema = z
  .object({
    reportId: z.string().min(1).max(128),
    reason: z.enum(UNPUBLISH_REASONS),
    notes: z.string().max(500).optional(),
    idempotencyKey: z.uuid(),
  })
  .strict()

export interface UnpublishReportResult {
  reportId: string
  visibilityClass: 'internal'
  updatedAt: number
}

export interface UnpublishReportCoreDeps {
  reportId: string
  reason: UnpublishReason
  notes?: string | undefined
  idempotencyKey: string
  actor: { uid: string; claims: { role?: string; municipalityId?: string } }
  now: Timestamp
}

const log = logDimension('unpublishReport')

export async function unpublishReportCore(
  db: Firestore,
  deps: UnpublishReportCoreDeps,
): Promise<UnpublishReportResult> {
  // Defense-in-depth role gate — only admin roles may unpublish
  const role = deps.actor.claims.role
  if (role !== 'municipal_admin' && role !== 'provincial_superadmin') {
    throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Admin role required to unpublish')
  }

  const correlationId = crypto.randomUUID()

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { now: _now, ...idempotentPayload } = deps
  const { result } = await withIdempotency<
    Omit<UnpublishReportCoreDeps, 'now'>,
    UnpublishReportResult
  >(
    db,
    {
      key: `unpublishReport:${deps.actor.uid}:${deps.idempotencyKey}`,
      payload: idempotentPayload,
      now: () => deps.now.toMillis(),
    },
    async () =>
      db.runTransaction(async (tx) => {
        const reportRef = db.collection('reports').doc(deps.reportId)
        const snap = await tx.get(reportRef)
        if (!snap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found')
        }
        const report = snap.data() as Record<string, unknown>
        // Require both IDs present and equal — don't allow implicit cross-municipality when either is missing
        const reportMuni = report.municipalityId
        const actorMuni = deps.actor.claims.municipalityId
        if (
          deps.actor.claims.role !== 'provincial_superadmin' &&
          !(reportMuni !== undefined && reportMuni === actorMuni)
        ) {
          throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Report not in your municipality')
        }
        const fromVisibilityClass = report.visibilityClass
        if (fromVisibilityClass !== 'public_alertable') {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            'unpublishReport is only valid for public reports',
            { reportId: deps.reportId, fromVisibilityClass },
          )
        }

        const updatedAt = deps.now.toMillis()
        tx.update(reportRef, {
          visibilityClass: 'internal',
          updatedAt,
          lastStatusAt: updatedAt,
          lastStatusBy: deps.actor.uid,
          unpublishedAt: updatedAt,
          unpublishedBy: deps.actor.uid,
          unpublishReason: deps.reason,
        })

        const incRef = db.collection('moderation_incidents').doc()
        tx.set(incRef, {
          incidentId: incRef.id,
          reportId: deps.reportId,
          action: 'unpublish',
          reason: deps.reason,
          notes: deps.notes ?? null,
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          at: updatedAt,
          correlationId,
          schemaVersion: 1,
        })

        const evRef = db.collection('report_events').doc()
        tx.set(evRef, {
          eventId: evRef.id,
          eventType: 'report_unpublished',
          reportId: deps.reportId,
          fromVisibilityClass,
          toVisibilityClass: 'internal',
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          at: updatedAt,
          correlationId,
          schemaVersion: 1,
        })

        return { reportId: deps.reportId, visibilityClass: 'internal', updatedAt }
      }),
  )

  // Log only after the transaction commits successfully so we don't replay logs on Firestore retries
  log({
    severity: 'INFO',
    code: 'report.unpublished',
    message: `Report ${deps.reportId} unpublished as ${deps.reason}`,
    data: {
      correlationId,
      reportId: deps.reportId,
      reason: deps.reason,
      actorUid: deps.actor.uid,
    },
  })

  return result
}

export const unpublishReport = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 100,
    cors: getAdminCallableCorsOrigins(),
  },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token as Record<string, unknown> | null
    if (!claims) throw new HttpsError('unauthenticated', 'sign-in required')
    if (claims.role !== 'municipal_admin' && claims.role !== 'provincial_superadmin') {
      throw new HttpsError('permission-denied', 'municipal_admin or provincial_superadmin required')
    }
    if (!isAccountActive(claims)) throw new HttpsError('permission-denied', 'account is not active')

    const parsed = InputSchema.safeParse(req.data)
    if (!parsed.success) {
      console.error('unpublishReport validation failed:', z.treeifyError(parsed.error))
      throw new HttpsError('invalid-argument', 'malformed payload')
    }

    const rl = await checkRateLimit(adminDb, {
      key: `unpublishReport:${req.auth.uid}`,
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
      return await unpublishReportCore(adminDb, {
        reportId: parsed.data.reportId,
        reason: parsed.data.reason,
        notes: parsed.data.notes,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: {
          uid: req.auth.uid,
          claims: {
            role: claims.role,
            municipalityId: claims.municipalityId as string,
          },
        },
        now: Timestamp.now(),
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError) throw bantayogErrorToHttps(err)
      throw err
    }
  },
)
