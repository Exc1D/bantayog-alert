import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { detectEncoding, logDimension } from '@bantayog/shared-validators'
import { adminDb } from '../admin-init.js'
import { requireAuth } from './https-error.js'
import { withIdempotency } from '../idempotency/guard.js'
import { sendMassAlertFcm } from '../services/fcm-mass-send.js'

const log = logDimension('massAlert')

const ADMIN_ROLES = ['municipal_admin', 'agency_admin', 'provincial_superadmin'] as const
const MAX_DIRECT_ROUTE = 5000

const targetScopeSchema = z.object({
  municipalityIds: z.array(z.string().min(1)).min(1).max(12),
})

const reachPlanSchema = z.object({
  route: z.enum(['direct', 'ndrrmc_escalation']),
  fcmCount: z.number().int().nonnegative(),
  smsCount: z.number().int().nonnegative(),
  segmentCount: z.number().int().positive(),
  unicodeWarning: z.boolean(),
})

export interface MassAlertActor {
  uid: string
  claims: { role: string; municipalityId?: string; active: boolean; auth_time: number }
}

function canActOnScope(actor: MassAlertActor, municipalityIds: string[]): boolean {
  if (actor.claims.role === 'provincial_superadmin') return true
  if (!actor.claims.municipalityId) return false
  return municipalityIds.length === 1 && municipalityIds[0] === actor.claims.municipalityId
}

export async function massAlertReachPlanPreviewCore(
  db: FirebaseFirestore.Firestore,
  input: { targetScope: { municipalityIds: string[] }; message: string },
  actor: MassAlertActor,
) {
  if (!ADMIN_ROLES.includes(actor.claims.role as (typeof ADMIN_ROLES)[number])) {
    return { success: false as const, errorCode: 'permission-denied' as const }
  }
  if (!canActOnScope(actor, input.targetScope.municipalityIds)) {
    return { success: false as const, errorCode: 'permission-denied' as const }
  }

  const { municipalityIds } = input.targetScope

  const [fcmSnap, smsSnap] = await Promise.all([
    db
      .collection('responders')
      .where('hasFcmToken', '==', true)
      .where('municipalityId', 'in', municipalityIds)
      .count()
      .get(),
    db
      .collection('report_sms_consent')
      .where('followUpConsent', '==', true)
      .where('municipalityId', 'in', municipalityIds)
      .count()
      .get(),
  ])

  const fcmCount = fcmSnap.data().count
  const smsCount = smsSnap.data().count
  const total = fcmCount + smsCount

  const route =
    total > MAX_DIRECT_ROUTE || municipalityIds.length > 1 ? 'ndrrmc_escalation' : 'direct'

  const { encoding, segmentCount } = detectEncoding(input.message)

  return {
    success: true as const,
    reachPlan: {
      route,
      fcmCount,
      smsCount,
      segmentCount,
      unicodeWarning: encoding === 'UCS-2',
    },
  }
}

export async function sendMassAlertCore(
  db: FirebaseFirestore.Firestore,
  input: {
    reachPlan: z.infer<typeof reachPlanSchema>
    message: string
    targetScope: { municipalityIds: string[] }
    idempotencyKey: string
  },
  actor: MassAlertActor,
) {
  if (!ADMIN_ROLES.includes(actor.claims.role as (typeof ADMIN_ROLES)[number])) {
    return { success: false as const, errorCode: 'permission-denied' as const }
  }
  if (!canActOnScope(actor, input.targetScope.municipalityIds)) {
    return { success: false as const, errorCode: 'permission-denied' as const }
  }
  if (input.reachPlan.route !== 'direct') {
    return { success: false as const, errorCode: 'permission-denied' as const }
  }

  const { result: cached } = await withIdempotency(
    db,
    { key: `send-mass-alert:${input.idempotencyKey}`, payload: input, now: () => Date.now() },
    async () => {
      const serverPreview = await massAlertReachPlanPreviewCore(
        db,
        {
          targetScope: input.targetScope,
          message: input.message,
        },
        actor,
      )
      if (!serverPreview.success || serverPreview.reachPlan.route !== 'direct') {
        return { success: false as const, errorCode: 'permission-denied' as const }
      }

      const requestId = crypto.randomUUID()
      const now = Date.now()

      await db
        .collection('mass_alert_requests')
        .doc(requestId)
        .set({
          requestedByMunicipality: actor.claims.municipalityId ?? 'province',
          requestedByUid: actor.uid,
          body: input.message,
          targetType: 'municipality',
          targetGeometryRef: JSON.stringify({ municipalityIds: input.targetScope.municipalityIds }),
          severity: 'high',
          estimatedReach: input.reachPlan.fcmCount + input.reachPlan.smsCount,
          status: 'sent',
          createdAt: now,
          schemaVersion: 1,
        })

      sendMassAlertFcm(db, {
        municipalityIds: input.targetScope.municipalityIds,
        title: 'BANTAYOG ALERT',
        body: input.message,
        data: { massAlertRequestId: requestId },
      }).catch((err: unknown) => {
        log({
          severity: 'ERROR',
          code: 'mass.fcm.failed',
          message: err instanceof Error ? err.message : 'FCM send error',
        })
      })

      log({
        severity: 'INFO',
        code: 'mass.sent',
        message: `Mass alert ${requestId} sent by ${actor.uid}`,
      })
      return { success: true as const, requestId }
    },
  )

  return cached
}

export async function requestMassAlertEscalationCore(
  db: FirebaseFirestore.Firestore,
  input: {
    message: string
    targetScope: { municipalityIds: string[] }
    evidencePack: {
      linkedReportIds: string[]
      pagasaSignalRef?: string | undefined
      notes?: string | undefined
    }
    idempotencyKey: string
  },
  actor: MassAlertActor,
) {
  if (!ADMIN_ROLES.includes(actor.claims.role as (typeof ADMIN_ROLES)[number])) {
    return { success: false as const, errorCode: 'permission-denied' as const }
  }

  const { result: cached } = await withIdempotency(
    db,
    { key: `escalate-mass-alert:${input.idempotencyKey}`, payload: input, now: () => Date.now() },
    async () => {
      const requestId = crypto.randomUUID()
      await db
        .collection('mass_alert_requests')
        .doc(requestId)
        .set({
          requestedByMunicipality: actor.claims.municipalityId ?? 'province',
          requestedByUid: actor.uid,
          body: input.message,
          targetType: 'municipality',
          targetGeometryRef: JSON.stringify({ municipalityIds: input.targetScope.municipalityIds }),
          severity: 'high',
          estimatedReach: 0,
          evidencePack: input.evidencePack,
          status: 'pending_ndrrmc_review',
          createdAt: Date.now(),
          schemaVersion: 1,
        })

      sendMassAlertFcm(db, {
        municipalityIds: input.targetScope.municipalityIds,
        title: 'NDRRMC Escalation Request',
        body: `Mass alert escalation from ${actor.claims.municipalityId ?? 'municipality'} — review required`,
        data: { massAlertRequestId: requestId, type: 'escalation_review' },
      }).catch((err: unknown) => {
        log({
          severity: 'WARNING',
          code: 'mass.escalate.fcm.failed',
          message: err instanceof Error ? err.message : 'FCM failed',
        })
      })

      log({
        severity: 'INFO',
        code: 'mass.escalated',
        message: `Mass alert ${requestId} escalated by ${actor.uid}`,
      })
      return { success: true as const, requestId }
    },
  )

  return cached
}

export async function forwardMassAlertToNDRRMCCore(
  db: FirebaseFirestore.Firestore,
  input: { requestId: string; forwardMethod: string; ndrrrcRecipient: string },
  actor: MassAlertActor,
) {
  if (actor.claims.role !== 'provincial_superadmin') {
    return { success: false as const, errorCode: 'permission-denied' as const }
  }

  const snap = await db.collection('mass_alert_requests').doc(input.requestId).get()
  if (!snap.exists) return { success: false as const, errorCode: 'not-found' as const }
  if (snap.data()?.status !== 'pending_ndrrmc_review') {
    return { success: false as const, errorCode: 'failed-precondition' as const }
  }

  await snap.ref.update({
    status: 'forwarded_to_ndrrmc',
    forwardedAt: Date.now(),
    forwardedBy: actor.uid,
    forwardMethod: input.forwardMethod,
    ndrrrcRecipient: input.ndrrrcRecipient,
  })

  log({
    severity: 'INFO',
    code: 'mass.forwarded',
    message: `Request ${input.requestId} forwarded to NDRRMC by ${actor.uid}`,
  })
  return { success: true as const }
}

export const massAlertReachPlanPreview = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (request) => {
    const actor = requireAuth(request, ADMIN_ROLES as unknown as string[])
    const input = z
      .object({
        targetScope: targetScopeSchema,
        message: z.string().min(1).max(1024),
      })
      .safeParse(request.data)
    if (!input.success) throw new HttpsError('invalid-argument', input.error.message)
    const result = await massAlertReachPlanPreviewCore(adminDb, input.data, {
      uid: actor.uid,
      claims: actor.claims as MassAlertActor['claims'],
    })
    if (!result.success) {
      throw new HttpsError(result.errorCode, 'preview failed')
    }
    return result.reachPlan
  },
)

export const sendMassAlert = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (request) => {
    const actor = requireAuth(request, ADMIN_ROLES as unknown as string[])
    const input = z
      .object({
        reachPlan: reachPlanSchema,
        message: z.string().min(1).max(1024),
        targetScope: targetScopeSchema,
        idempotencyKey: z.uuid(),
      })
      .safeParse(request.data)
    if (!input.success) throw new HttpsError('invalid-argument', input.error.message)
    const result = await sendMassAlertCore(adminDb, input.data, {
      uid: actor.uid,
      claims: actor.claims as MassAlertActor['claims'],
    })
    if (!result.success) {
      throw new HttpsError(result.errorCode, 'send failed')
    }
    return { requestId: result.requestId }
  },
)

export const requestMassAlertEscalation = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (request) => {
    const actor = requireAuth(request, ADMIN_ROLES as unknown as string[])
    const input = z
      .object({
        message: z.string().min(1).max(1024),
        targetScope: targetScopeSchema,
        evidencePack: z
          .object({
            linkedReportIds: z.array(z.string()),
            pagasaSignalRef: z.string().optional(),
            notes: z.string().max(2000).optional(),
          })
          .optional(),
        idempotencyKey: z.uuid(),
      })
      .safeParse(request.data)
    if (!input.success) throw new HttpsError('invalid-argument', input.error.message)
    const result = await requestMassAlertEscalationCore(
      adminDb,
      {
        message: input.data.message,
        targetScope: input.data.targetScope,
        evidencePack: input.data.evidencePack ?? { linkedReportIds: [] },
        idempotencyKey: input.data.idempotencyKey,
      },
      {
        uid: actor.uid,
        claims: actor.claims as MassAlertActor['claims'],
      },
    )
    if (!result.success) {
      throw new HttpsError(result.errorCode, 'escalation failed')
    }
    return { requestId: result.requestId }
  },
)

export const forwardMassAlertToNDRRMC = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (request) => {
    const actor = requireAuth(request, ['provincial_superadmin'])
    const input = z
      .object({
        requestId: z.string().min(1),
        forwardMethod: z.enum(['email', 'sms', 'portal']),
        ndrrrcRecipient: z.string().min(1),
      })
      .safeParse(request.data)
    if (!input.success) throw new HttpsError('invalid-argument', input.error.message)
    const result = await forwardMassAlertToNDRRMCCore(adminDb, input.data, {
      uid: actor.uid,
      claims: actor.claims as MassAlertActor['claims'],
    })
    if (!result.success) {
      throw new HttpsError(result.errorCode, 'forward failed')
    }
    return result
  },
)
