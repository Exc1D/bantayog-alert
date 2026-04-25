import {
  onCall,
  type CallableRequest,
  HttpsError,
  type FunctionsErrorCode,
} from 'firebase-functions/v2/https'
import { z } from 'zod'
import { adminDb } from '../admin-init.js'
import { requireAuth, bantayogErrorToHttps } from './https-error.js'
import { withIdempotency } from '../idempotency/guard.js'
import { BantayogError, logDimension } from '@bantayog/shared-validators'

const log = logDimension('shiftHandoff')

const initiateSchema = z.object({
  notes: z.string().max(2000),
  activeIncidentIds: z.array(z.string()),
  idempotencyKey: z.uuid(),
})

const acceptSchema = z.object({
  handoffId: z.string().min(1),
  idempotencyKey: z.uuid(),
})

const ADMIN_ROLES = ['municipal_admin', 'agency_admin', 'provincial_superadmin'] as const
const ACTIVE_DISPATCH_STATUSES = ['assigned', 'acknowledged', 'en_route']

export interface HandoffActor {
  uid: string
  claims: { role: string; municipalityId?: string; active: boolean; auth_time: number }
}

export interface InitiateResult {
  success: boolean
  handoffId?: string
  errorCode?: string
}

export interface AcceptResult {
  success: boolean
  errorCode?: string
}

export async function initiateShiftHandoffCore(
  db: FirebaseFirestore.Firestore,
  input: z.infer<typeof initiateSchema>,
  actor: HandoffActor,
): Promise<InitiateResult> {
  if (!ADMIN_ROLES.includes(actor.claims.role as (typeof ADMIN_ROLES)[number])) {
    return { success: false, errorCode: 'permission-denied' }
  }

  const municipalityId = actor.claims.municipalityId
  if (!municipalityId) return { success: false, errorCode: 'permission-denied' }

  const { result: cached } = await withIdempotency(
    db,
    { key: `initiate-handoff:${input.idempotencyKey}`, payload: input },
    async () => {
      const [opsSnap, dispatchSnap] = await Promise.all([
        db
          .collection('report_ops')
          .where('municipalityId', '==', municipalityId)
          .where('status', 'in', ACTIVE_DISPATCH_STATUSES)
          .get(),
        db
          .collection('dispatches')
          .where('municipalityId', '==', municipalityId)
          .where('status', '==', 'accepted')
          .get(),
      ])

      const activeIncidentSnapshot = [
        ...opsSnap.docs.map((d) => d.id),
        ...dispatchSnap.docs.map((d) => d.id),
      ]

      const handoffId = crypto.randomUUID()
      const now = Date.now()

      await db
        .collection('shift_handoffs')
        .doc(handoffId)
        .set({
          fromUid: actor.uid,
          municipalityId,
          notes: input.notes,
          activeIncidentSnapshot,
          status: 'pending',
          createdAt: now,
          expiresAt: now + 30 * 60 * 1000,
          schemaVersion: 1,
        })

      log({
        severity: 'INFO',
        code: 'handoff.initiated',
        message: `Shift handoff ${handoffId} created by ${actor.uid}`,
      })
      return { success: true, handoffId }
    },
  )

  return cached
}

export async function acceptShiftHandoffCore(
  db: FirebaseFirestore.Firestore,
  input: z.infer<typeof acceptSchema>,
  actor: HandoffActor,
): Promise<AcceptResult> {
  if (!ADMIN_ROLES.includes(actor.claims.role as (typeof ADMIN_ROLES)[number])) {
    return { success: false, errorCode: 'permission-denied' }
  }

  const { result: cached } = await withIdempotency(
    db,
    { key: `accept-handoff:${input.idempotencyKey}`, payload: input },
    async () => {
      const snap = await db.collection('shift_handoffs').doc(input.handoffId).get()
      if (!snap.exists) return { success: false, errorCode: 'not-found' }

      const handoff = snap.data()
      if (handoff === undefined) return { success: false, errorCode: 'not-found' }
      if (handoff.municipalityId !== actor.claims.municipalityId) {
        return { success: false, errorCode: 'permission-denied' }
      }

      if (handoff.status === 'accepted') return { success: true }

      await snap.ref.update({
        status: 'accepted',
        toUid: actor.uid,
        acceptedAt: Date.now(),
      })

      log({
        severity: 'INFO',
        code: 'handoff.accepted',
        message: `Handoff ${input.handoffId} accepted by ${actor.uid}`,
      })
      return { success: true }
    },
  )

  return cached
}

export const initiateShiftHandoff = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (req: CallableRequest<unknown>) => {
    const authed = requireAuth(req, [...ADMIN_ROLES])
    const input = initiateSchema.safeParse(req.data)
    if (!input.success) throw new HttpsError('invalid-argument', input.error.message)
    const muni =
      typeof authed.claims.municipalityId === 'string' ? authed.claims.municipalityId : undefined
    const actor: HandoffActor = {
      uid: authed.uid,
      claims: {
        role: authed.claims.role as string,
        ...(muni ? { municipalityId: muni } : {}),
        active: authed.claims.active as boolean,
        auth_time: authed.claims.auth_time as number,
      },
    }
    try {
      const result = await initiateShiftHandoffCore(adminDb, input.data, actor)
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
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (req: CallableRequest<unknown>) => {
    const authed = requireAuth(req, [...ADMIN_ROLES])
    const input = acceptSchema.safeParse(req.data)
    if (!input.success) throw new HttpsError('invalid-argument', input.error.message)
    const muni =
      typeof authed.claims.municipalityId === 'string' ? authed.claims.municipalityId : undefined
    const actor: HandoffActor = {
      uid: authed.uid,
      claims: {
        role: authed.claims.role as string,
        ...(muni ? { municipalityId: muni } : {}),
        active: authed.claims.active as boolean,
        auth_time: authed.claims.auth_time as number,
      },
    }
    try {
      const result = await acceptShiftHandoffCore(adminDb, input.data, actor)
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
