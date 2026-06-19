import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode, logDimension } from '@bantayog/shared-validators'
import { adminDb } from '../../admin-init.js'
import { withIdempotency } from '../../idempotency/guard.js'
import { checkRateLimit } from '../shared/rate-limit.js'
import { bantayogErrorToHttps, requireAuth } from '../shared/https-error.js'
import { shouldEnforceAppCheck } from '../shared/app-check-config.js'
import {
  assertRedispatchResponderData,
  assertRedispatchTerminalStatus,
  assertReportInActorMunicipality,
  assertResponderInReportMunicipality,
  assertVerifiedReportStatus,
  buildRedispatchDispatchData,
  getActorMunicipalityIds,
  getRedispatchDeadlineMs,
} from './redispatch-policy.js'

const redispatchIdSchema = z.string().min(1).max(128)
const redispatchReasonSchema = z.string().trim().min(1).max(500)

export const redispatchReportSchema = z
  .object({
    oldDispatchId: redispatchIdSchema,
    newResponderUid: redispatchIdSchema,
    reason: redispatchReasonSchema,
    idempotencyKey: z.uuid(),
  })
  .strict()

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

        assertRedispatchTerminalStatus(oldDispatch.status)

        const reportRef = db.collection('reports').doc(oldDispatch.reportId)
        const reportSnap = await tx.get(reportRef)
        if (!reportSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found')
        }
        const report = reportSnap.data() as Record<string, unknown>

        const actorMuniIds = getActorMunicipalityIds(deps.actor.claims)
        assertReportInActorMunicipality(actorMuniIds, report.municipalityId)

        assertVerifiedReportStatus(report.status)

        const responderRef = db.collection('responders').doc(deps.newResponderUid)
        const responderSnap = await tx.get(responderRef)
        if (!responderSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Responder not found')
        }
        const responder = responderSnap.data() as Record<string, unknown>

        assertRedispatchResponderData(responder)

        const reportMunicipalityId = report.municipalityId as string
        assertResponderInReportMunicipality(responder.municipalityId, reportMunicipalityId)

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
        const deadlineMs = getRedispatchDeadlineMs(report.severityDerived)

        const newDispatchData = buildRedispatchDispatchData({
          newDispatchId,
          reportId: oldDispatch.reportId,
          newResponderUid: deps.newResponderUid,
          responderAgencyId: responder.agencyId,
          responderMunicipalityId: responder.municipalityId,
          actorUid: deps.actor.uid,
          nowMillis: deps.now.toMillis(),
          deadlineMs,
          correlationId,
        })

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
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 10,
    timeoutSeconds: 15,
    memory: '512MiB',
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
