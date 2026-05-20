import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { z } from 'zod'
import { requireAuth, requireMfaAuth } from './https-error.js'
import { PRIVILEGED_ROLES } from '../constants/roles.js'
import { streamAuditEvent } from '../services/audit-stream.js'
import { shouldEnforceAppCheck } from './app-check-config.js'

const inputSchema = z.object({
  erasureRequestId: z.string().min(1),
  approved: z.boolean(),
  reason: z.string().max(1000).optional(),
})

export async function approveErasureRequestCore(
  db: Firestore,
  auth: Auth,
  input: unknown,
  actor: { uid: string },
): Promise<void> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    throw new HttpsError('invalid-argument', firstIssue?.message ?? 'invalid_input')
  }
  const data = parsed.data

  // Transaction gate: read + verify status before writing.
  // Prevents concurrent approve+deny both succeeding on 'pending_review'.
  const requestRef = db.collection('erasure_requests').doc(data.erasureRequestId)

  if (data.approved) {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(requestRef)
      if (!snap.exists) throw new HttpsError('not-found', 'erasure_request_not_found')
      if (snap.data()?.status !== 'pending_review') {
        throw new HttpsError('failed-precondition', 'erasure_already_reviewed')
      }
      tx.update(requestRef, {
        status: 'approved_pending_anonymization',
        reviewedBy: actor.uid,
        reviewedAt: Date.now(),
        ...(data.reason ? { reviewReason: data.reason } : {}),
      })
    })
    void streamAuditEvent({
      eventType: 'erasure_request_reviewed',
      actorUid: actor.uid,
      targetDocumentId: data.erasureRequestId,
      metadata: { approved: true },
      occurredAt: Date.now(),
    })
    return
  }

  // Deny path: read citizenUid first, re-enable Auth, then update doc + delete sentinel.
  // If the tx fails after Auth was re-enabled, re-disable Auth to restore the previous state.
  const initialSnap = await requestRef.get()
  if (!initialSnap.exists) throw new HttpsError('not-found', 'erasure_request_not_found')
  const initialData = initialSnap.data()
  if (initialData?.status !== 'pending_review') {
    throw new HttpsError('failed-precondition', 'erasure_already_reviewed')
  }
  const citizenUid = initialData.citizenUid as string

  await auth.updateUser(citizenUid, { disabled: false })

  try {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(requestRef)
      if (!fresh.exists) throw new HttpsError('not-found', 'erasure_request_not_found')
      if (fresh.data()?.status !== 'pending_review') {
        throw new HttpsError('failed-precondition', 'erasure_already_reviewed')
      }
      const sentinelRef = db.collection('erasure_active').doc(citizenUid)
      tx.update(requestRef, {
        status: 'denied',
        reviewedBy: actor.uid,
        reviewedAt: Date.now(),
        ...(data.reason ? { reviewReason: data.reason } : {}),
      })
      tx.delete(sentinelRef)
    })
  } catch (err: unknown) {
    // Re-disable Auth to restore previous state.
    try {
      await auth.updateUser(citizenUid, { disabled: true })
    } catch (reDisableErr: unknown) {
      const reason = reDisableErr instanceof Error ? reDisableErr.message : String(reDisableErr)
      console.error('CRITICAL: Auth re-disable failed during deny rollback for', citizenUid, reason)
    }
    if (err instanceof HttpsError) throw err
    const originalReason = err instanceof Error ? err.message : String(err)
    throw new HttpsError('internal', `deny_write_failed: ${originalReason}`)
  }

  void streamAuditEvent({
    eventType: 'erasure_request_reviewed',
    actorUid: actor.uid,
    targetDocumentId: data.erasureRequestId,
    metadata: { approved: false },
    occurredAt: Date.now(),
  })
}

export const approveErasureRequest = onCall(
  { region: 'asia-southeast1', enforceAppCheck: shouldEnforceAppCheck() },
  async (request) => {
    const { uid } = requireAuth(request, PRIVILEGED_ROLES)
    requireMfaAuth(request)
    await approveErasureRequestCore(getFirestore(), getAuth(), request.data, { uid })
  },
)
