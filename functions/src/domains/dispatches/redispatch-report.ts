import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode, logDimension } from '@bantayog/shared-validators'
import { adminDb } from '../../admin-init.js'
import { withIdempotency } from '../../idempotency/guard.js'
import { checkRateLimit } from '../../services/rate-limit.js'
import { bantayogErrorToHttps, requireAuth } from '../../callables/https-error.js'

export const redispatchReportSchema = z
  .object({
    oldDispatchId: z.string().min(1).max(128),
    newResponderUid: z.string().min(1).max(128),
    reason: z.string().trim().min(1).max(500),
    idempotencyKey: z.uuid(),
  })
  .strict()

const TERMINAL_DISPATCH_STATES = ['declined', 'timed_out', 'cancelled'] as const

const DEADLINE_BY_SEVERITY: Record<'critical' | 'high' | 'low' | 'medium', number> = {
  critical: 5 * 60 * 1000,
  high: 5 * 60 * 1000,
  medium: 15 * 60 * 1000,
  low: 30 * 60 * 1000,
}

function isValidSeverity(s: unknown): s is keyof typeof DEADLINE_BY_SEVERITY {
  return typeof s === 'string' && Object.hasOwn(DEADLINE_BY_SEVERITY, s)
}

const log = logDimension('redispatchReport')

export interface RedispatchReportCoreDeps {
  oldDispatchId: string
  newResponderUid: string
  reason: string
  idempotencyKey: string
  actor: {
    uid: string
    claims: { role?: string; municipalityId?: string; permittedMunicipalityIds?: string[] }
  }
  now: Timestamp
}

export async function redispatchReportCore(
  db: Firestore,
  deps: RedispatchReportCoreDeps,
): Promise<{ newDispatchId: string; status: 'pending'; reportId: string }> {
  const correlationId = crypto.randomUUID()

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { now: _now, ...idempotentPayload } = deps
  const { result } = await withIdempotency<
    Omit<RedispatchReportCoreDeps, 'now'>,
    { newDispatchId: string; status: 'pending'; reportId: string }
  >(
    db,
    {
      key: `redispatchReport:${deps.actor.uid}:${deps.idempotencyKey}`,
      payload: idempotentPayload,
      now: () => deps.now.toMillis(),
    },
    async () => {
      const rl = await checkRateLimit(db, {
        key: `redispatchReport:${deps.actor.uid}`,
        limit: 30,
        windowSeconds: 60,
        now: deps.now,
      })
      if (!rl.allowed) {
        throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
          retryAfterSeconds: rl.retryAfterSeconds,
        })
      }

      return db.runTransaction(async (tx) => {
        const oldDispatchRef = db.collection('dispatches').doc(deps.oldDispatchId)
        const oldDispatchSnap = await tx.get(oldDispatchRef)
        if (!oldDispatchSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Old dispatch not found')
        }

        const oldDispatch = oldDispatchSnap.data() as {
          status: string
          reportId: string
          assignedTo?: { uid: string; agencyId: string; municipalityId: string }
        }

        if (
          !TERMINAL_DISPATCH_STATES.includes(
            oldDispatch.status as (typeof TERMINAL_DISPATCH_STATES)[number],
          )
        ) {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `Cannot redispatch from status ${oldDispatch.status} (must be terminal)`,
          )
        }

        const reportRef = db.collection('reports').doc(oldDispatch.reportId)
        const reportSnap = await tx.get(reportRef)
        if (!reportSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found')
        }
        const report = reportSnap.data() as Record<string, unknown>

        const actorMuniIds: string[] = []
        if (deps.actor.claims.municipalityId) {
          actorMuniIds.push(deps.actor.claims.municipalityId)
        }
        if (deps.actor.claims.permittedMunicipalityIds?.length) {
          actorMuniIds.push(...deps.actor.claims.permittedMunicipalityIds)
        }
        if (
          actorMuniIds.length > 0 &&
          typeof report.municipalityId === 'string' &&
          !actorMuniIds.includes(report.municipalityId)
        ) {
          throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Report not in your municipality')
        }

        if (report.status !== 'verified') {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `Report must be verified to redispatch (current: ${String(report.status)})`,
          )
        }

        const responderRef = db.collection('responders').doc(deps.newResponderUid)
        const responderSnap = await tx.get(responderRef)
        if (!responderSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Responder not found')
        }
        const responder = responderSnap.data() as Record<string, unknown>

        if (typeof responder.municipalityId !== 'string' || !responder.municipalityId) {
          throw new BantayogError(
            BantayogErrorCode.INVALID_ARGUMENT,
            'Responder missing municipalityId',
          )
        }
        if (typeof responder.agencyId !== 'string' || !responder.agencyId) {
          throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Responder missing agencyId')
        }
        if (responder.isActive !== true) {
          throw new BantayogError(
            BantayogErrorCode.INVALID_STATUS_TRANSITION,
            'Responder is not active',
          )
        }

        const reportMunicipalityId = report.municipalityId as string
        if (responder.municipalityId !== reportMunicipalityId) {
          throw new BantayogError(
            BantayogErrorCode.FORBIDDEN,
            'Responder not in report municipality',
          )
        }

        // Mark old dispatch as superseded.
        tx.update(oldDispatchRef, {
          status: 'superseded',
          supersededAt: deps.now.toMillis(),
          supersededReason: deps.reason,
          supersededBy: deps.actor.uid,
          lastStatusAt: deps.now.toMillis(),
        })

        // Create new dispatch.
        const newDispatchId = oldDispatch.reportId + '_' + deps.newResponderUid
        const newDispatchRef = db.collection('dispatches').doc(newDispatchId)

        const existingNewSnap = await tx.get(newDispatchRef)
        const severity = isValidSeverity(report.severityDerived) ? report.severityDerived : 'medium'
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const deadlineMs = DEADLINE_BY_SEVERITY[severity] ?? DEADLINE_BY_SEVERITY.high

        const newDispatchData = {
          dispatchId: newDispatchId,
          reportId: oldDispatch.reportId,
          status: 'pending',
          assignedTo: {
            uid: deps.newResponderUid,
            agencyId: responder.agencyId,
            municipalityId: responder.municipalityId,
          },
          dispatchedAt: deps.now.toMillis(),
          dispatchedBy: deps.actor.uid,
          lastStatusAt: deps.now.toMillis(),
          acknowledgementDeadlineAt: deps.now.toMillis() + deadlineMs,
          correlationId,
          schemaVersion: 1,
        }

        if (existingNewSnap.exists) {
          tx.update(newDispatchRef, newDispatchData)
        } else {
          tx.set(newDispatchRef, newDispatchData)
        }

        tx.update(reportRef, {
          status: 'assigned',
          lastStatusAt: deps.now.toMillis(),
          lastStatusBy: deps.actor.uid,
          currentDispatchId: newDispatchId,
        })

        const reportEvRef = db.collection('report_events').doc()
        tx.set(reportEvRef, {
          eventId: reportEvRef.id,
          reportId: oldDispatch.reportId,
          from: 'verified',
          to: 'assigned',
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          at: deps.now.toMillis(),
          correlationId,
          schemaVersion: 1,
        })

        const dispatchEvRef = db.collection('dispatch_events').doc()
        tx.set(dispatchEvRef, {
          eventId: dispatchEvRef.id,
          dispatchId: newDispatchId,
          reportId: oldDispatch.reportId,
          from: null,
          to: 'pending',
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          at: deps.now.toMillis(),
          correlationId,
          schemaVersion: 1,
        })

        const supersededEvRef = db.collection('dispatch_events').doc()
        tx.set(supersededEvRef, {
          eventId: supersededEvRef.id,
          dispatchId: deps.oldDispatchId,
          reportId: oldDispatch.reportId,
          from: oldDispatch.status,
          to: 'superseded',
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          reason: deps.reason,
          at: deps.now.toMillis(),
          correlationId,
          schemaVersion: 1,
        })

        log({
          severity: 'INFO',
          code: 'dispatch.redispatched',
          message: `Dispatch ${deps.oldDispatchId} superseded; new dispatch ${newDispatchId} created`,
          data: {
            oldDispatchId: deps.oldDispatchId,
            newDispatchId,
            reportId: oldDispatch.reportId,
            actorUid: deps.actor.uid,
            correlationId,
          },
        })

        return { newDispatchId, status: 'pending' as const, reportId: oldDispatch.reportId }
      })
    },
  )

  return result
}

export const redispatchReport = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 15,
    minInstances: 1,
  },
  async (request: CallableRequest<unknown>) => {
    const actor = requireAuth(request, ['municipal_admin', 'provincial_superadmin'])
    if (actor.claims.accountStatus !== 'active') {
      throw new HttpsError('permission-denied', 'account is not active')
    }

    const parsed = redispatchReportSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    try {
      return await redispatchReportCore(adminDb, {
        oldDispatchId: parsed.data.oldDispatchId,
        newResponderUid: parsed.data.newResponderUid,
        reason: parsed.data.reason,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: {
          uid: actor.uid,
          claims: {
            ...(typeof actor.claims.role === 'string' && { role: actor.claims.role }),
            ...(typeof actor.claims.municipalityId === 'string' && {
              municipalityId: actor.claims.municipalityId,
            }),
            ...(Array.isArray(actor.claims.permittedMunicipalityIds) && {
              permittedMunicipalityIds: (actor.claims.permittedMunicipalityIds as unknown[]).filter(
                (id): id is string => typeof id === 'string',
              ),
            }),
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
