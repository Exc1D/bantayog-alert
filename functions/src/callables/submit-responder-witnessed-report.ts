import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'
import { adminDb } from '../admin-init.js'
import { withIdempotency } from '../idempotency/guard.js'
import { bantayogErrorToHttps, requireAuth } from './https-error.js'
import { checkRateLimit } from '../services/rate-limit.js'
import { randomBytes, createHash, randomInt } from 'node:crypto'

export const submitResponderWitnessedReportSchema = z
  .object({
    dispatchId: z.string().min(1).max(128),
    reportType: z.enum([
      'flood',
      'fire',
      'earthquake',
      'typhoon',
      'landslide',
      'storm_surge',
      'medical',
      'accident',
      'structural',
      'security',
      'other',
    ]),
    description: z.string().min(1).max(5000),
    severity: z.enum(['low', 'medium', 'high']),
    publicLocation: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .strict(),
    photoUrl: z.url().optional(),
    idempotencyKey: z.uuid(),
  })
  .strict()

export interface SubmitResponderWitnessedReportCoreDeps {
  dispatchId: string
  reportType: string
  description: string
  severity: 'low' | 'medium' | 'high'
  publicLocation: { lat: number; lng: number }
  photoUrl?: string
  idempotencyKey: string
  actor: { uid: string; claims: { role: string; municipalityId?: string } }
  now: Timestamp
}

function generatePublicRef(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 8 }, () => chars[randomInt(chars.length)]).join('')
}

export async function submitResponderWitnessedReportCore(
  db: Firestore,
  deps: SubmitResponderWitnessedReportCoreDeps,
): Promise<{ reportId: string; publicTrackingRef: string }> {
  const {
    dispatchId,
    reportType,
    description,
    severity,
    publicLocation,
    photoUrl,
    idempotencyKey,
    actor,
    now,
  } = deps

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { now: _now, ...idempotentPayload } = deps

  const { result } = await withIdempotency(
    db,
    {
      key: `submitResponderWitnessedReport:${actor.uid}:${idempotencyKey}`,
      payload: idempotentPayload,
      now: () => now.toMillis(),
    },
    async () => {
      const rl = await checkRateLimit(db, {
        key: `submitResponderWitnessedReport:${actor.uid}`,
        limit: 30,
        windowSeconds: 60,
        now,
      })
      if (!rl.allowed) {
        throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
          retryAfterSeconds: rl.retryAfterSeconds,
        })
      }

      return db.runTransaction(async (tx) => {
        const dispatchRef = db.collection('dispatches').doc(dispatchId)
        const dispatchSnap = await tx.get(dispatchRef)

        if (!dispatchSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found')
        }

        const dispatch = dispatchSnap.data() as {
          status: string
          assignedTo?: { uid: string; agencyId: string; municipalityId: string }
          reportId: string
        }

        if (dispatch.assignedTo?.uid !== actor.uid) {
          throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Not assigned to this dispatch')
        }

        const activeStates = ['accepted', 'acknowledged', 'en_route', 'on_scene']
        if (!activeStates.includes(dispatch.status)) {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `Dispatch must be active (current: ${dispatch.status})`,
          )
        }

        const reportId = db.collection('reports').doc().id
        const publicRef = generatePublicRef()
        const nowMs = now.toMillis()
        const municipalityId = dispatch.assignedTo.municipalityId
        const correlationId = crypto.randomUUID()

        tx.set(db.collection('reports').doc(reportId), {
          reportId,
          municipalityId,
          barangayId: 'unknown',
          reporterRole: 'responder',
          reportType,
          severity,
          status: 'new',
          publicLocation,
          mediaRefs: photoUrl ? [photoUrl] : [],
          description,
          submittedAt: nowMs,
          retentionExempt: false,
          visibilityClass: 'internal',
          visibility: { scope: 'municipality', sharedWith: [] },
          source: 'responder_witness',
          hasPhotoAndGPS: !!photoUrl,
          witnessPriorityFlag: true,
          schemaVersion: 1,
          municipalityLabel: municipalityId,
          correlationId,
        })

        tx.set(db.collection('report_private').doc(reportId), {
          municipalityId,
          reporterUid: actor.uid,
          isPseudonymous: false,
          publicTrackingRef: publicRef,
          createdAt: nowMs,
          schemaVersion: 1,
        })

        tx.set(db.collection('report_ops').doc(reportId), {
          municipalityId,
          status: 'new',
          severity,
          createdAt: nowMs,
          agencyIds: [dispatch.assignedTo.agencyId],
          activeResponderCount: 0,
          requiresLocationFollowUp: false,
          witnessPriorityFlag: true,
          visibility: { scope: 'municipality', sharedWith: [] },
          updatedAt: nowMs,
          schemaVersion: 1,
        })

        tx.set(db.collection('report_lookup').doc(publicRef), {
          publicTrackingRef: publicRef,
          reportId,
          tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
          expiresAt: nowMs + 365 * 24 * 60 * 60 * 1000,
          createdAt: nowMs,
          schemaVersion: 1,
        })

        tx.set(db.collection('report_events').doc(), {
          reportId,
          from: null,
          to: 'new',
          actor: actor.uid,
          actorRole: 'responder',
          at: nowMs,
          correlationId,
          schemaVersion: 1,
        })

        tx.set(db.collection('admin_notifications').doc(), {
          type: 'responder_witness_report',
          reportId,
          responderUid: actor.uid,
          agencyId: dispatch.assignedTo.agencyId,
          municipalityId,
          createdAt: nowMs,
          read: false,
          schemaVersion: 1,
        })

        return { reportId, publicTrackingRef: publicRef }
      })
    },
  )

  return result
}

export const submitResponderWitnessedReport = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 10,
    minInstances: 1,
  },
  async (request: CallableRequest<unknown>) => {
    const actor = requireAuth(request, ['responder'])
    if (actor.claims.accountStatus !== 'active') {
      throw new HttpsError('permission-denied', 'account is not active')
    }

    const parsed = submitResponderWitnessedReportSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    try {
      return await submitResponderWitnessedReportCore(adminDb, {
        dispatchId: parsed.data.dispatchId,
        reportType: parsed.data.reportType,
        description: parsed.data.description,
        severity: parsed.data.severity,
        publicLocation: parsed.data.publicLocation,
        ...(parsed.data.photoUrl !== undefined ? { photoUrl: parsed.data.photoUrl } : {}),
        idempotencyKey: parsed.data.idempotencyKey,
        actor: {
          uid: actor.uid,
          claims: actor.claims as { role: string; municipalityId?: string },
        },
        now: Timestamp.now(),
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError) throw bantayogErrorToHttps(err)
      throw err
    }
  },
)
