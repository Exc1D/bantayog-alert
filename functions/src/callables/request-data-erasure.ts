import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { requireAuth } from './https-error.js'
import { streamAuditEvent } from '../services/audit-stream.js'

export async function requestDataErasureCore(
  db: Firestore,
  auth: Auth,
  actor: { uid: string },
): Promise<void> {
  const sentinelRef = db.collection('erasure_active').doc(actor.uid)
  const requestRef = db.collection('erasure_requests').doc()
  const now = Date.now()

  // Atomic: create sentinel + request doc. Transaction fails if sentinel exists.
  await db.runTransaction(async (tx) => {
    const sentinel = await tx.get(sentinelRef)
    if (sentinel.exists) {
      throw new HttpsError('already-exists', 'erasure_request_already_active')
    }
    tx.create(sentinelRef, { citizenUid: actor.uid, createdAt: now })
    tx.create(requestRef, {
      citizenUid: actor.uid,
      status: 'pending_review',
      legalHold: false,
      requestedAt: now,
    })
  })

  // Disable Auth after successful doc write. Rollback docs if Auth fails.
  try {
    await auth.updateUser(actor.uid, { disabled: true })
  } catch {
    await Promise.allSettled([requestRef.delete(), sentinelRef.delete()])
    throw new HttpsError('internal', 'auth_disable_failed')
  }

  void streamAuditEvent({
    eventType: 'erasure_request_submitted',
    actorUid: actor.uid,
    targetDocumentId: requestRef.id,
    metadata: {},
    occurredAt: now,
  })
}

export const requestDataErasure = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    const { uid } = requireAuth(request, ['citizen'])
    await requestDataErasureCore(getFirestore(), getAuth(), { uid })
  },
)
