import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { z } from 'zod'
import { requireAuth, requireMfaAuth } from './https-error.js'
import { streamAuditEvent } from '../services/audit-stream.js'

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

  // Deny path: update doc + delete sentinel FIRST, then re-enable Auth.
  const snap = await requestRef.get()
  if (!snap.exists) throw new HttpsError('not-found', 'erasure_request_not_found')
  const citizenUid = snap.data()?.citizenUid as string

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
    // Re-throw domain errors (not-found, failed-precondition) as-is.
    if (err instanceof HttpsError) throw err
    const originalReason = err instanceof Error ? err.message : String(err)
    throw new HttpsError('internal', `deny_write_failed: ${originalReason}`)
  }

  // Re-enable Auth after successful denial.
  try {
    await auth.updateUser(citizenUid, { disabled: false })
  } catch (reEnableErr: unknown) {
    const reason = reEnableErr instanceof Error ? reEnableErr.message : String(reEnableErr)
    console.error('CRITICAL: Auth re-enable failed after erasure denial for', citizenUid, reason)
    throw new HttpsError('internal', `auth_reenable_failed_after_deny: ${reason}`)
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
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    const { uid } = requireAuth(request, ['superadmin'])
    requireMfaAuth(request)
    await approveErasureRequestCore(getFirestore(), getAuth(), request.data, { uid })
  },
)
