import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'
import { adminDb } from '../admin-init.js'
import { bantayogErrorToHttps, requireAuth } from './https-error.js'

export const triggerSosSchema = z
  .object({
    dispatchId: z.string().min(1).max(128),
  })
  .strict()

export interface TriggerSosCoreDeps {
  dispatchId: string
  actor: { uid: string; claims: { role: string; municipalityId?: string } }
  now: Timestamp
}

export async function triggerSosCore(
  db: Firestore,
  deps: TriggerSosCoreDeps,
): Promise<{ status: 'sos_triggered'; dispatchId: string }> {
  const { dispatchId, actor, now } = deps

  return db.runTransaction(async (tx) => {
    const dispatchRef = db.collection('dispatches').doc(dispatchId)
    const dispatchSnap = await tx.get(dispatchRef)

    if (!dispatchSnap.exists) {
      throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found')
    }

    const dispatch = dispatchSnap.data() as {
      status: string
      assignedTo?: { uid: string; agencyId: string; municipalityId: string }
      sosTriggeredAt?: unknown
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

    if (dispatch.sosTriggeredAt != null) {
      throw new BantayogError(
        BantayogErrorCode.FAILED_PRECONDITION,
        'SOS already triggered for this dispatch',
      )
    }

    tx.update(dispatchRef, {
      sosTriggeredAt: now,
      lastStatusAt: now,
    })

    const nowMs = now.toMillis()
    tx.set(db.collection('admin_notifications').doc(), {
      type: 'sos_triggered',
      dispatchId,
      responderUid: actor.uid,
      agencyId: dispatch.assignedTo.agencyId,
      municipalityId: dispatch.assignedTo.municipalityId,
      createdAt: nowMs,
      read: false,
      schemaVersion: 1,
    })

    return { status: 'sos_triggered' as const, dispatchId }
  })
}

export const triggerSOS = onCall(
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

    const parsed = triggerSosSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    try {
      return await triggerSosCore(adminDb, {
        dispatchId: parsed.data.dispatchId,
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
