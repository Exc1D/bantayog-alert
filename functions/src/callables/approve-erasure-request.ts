import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
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
  input: unknown,
  actor: { uid: string },
): Promise<void> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const issues = parsed.error.issues
    let msg = 'invalid_input'
    if (issues.length > 0) {
      const firstIssue = issues[0]
      if (firstIssue) {
        msg = firstIssue.message
      }
    }
    throw new HttpsError('invalid-argument', msg)
  }
  const data = parsed.data

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(db.collection('erasure_requests').doc(data.erasureRequestId))
    if (!doc.exists) {
      throw new HttpsError('not-found', 'erasure_request_not_found')
    }
    const currentStatus = doc.data()?.status
    if (currentStatus !== 'pending') {
      throw new HttpsError('failed-precondition', 'erasure_already_reviewed')
    }
    const status = data.approved ? 'approved_pending_anonymization' : 'denied'
    tx.update(doc.ref, {
      status,
      reviewedBy: actor.uid,
      reviewedAt: Date.now(),
      ...(data.reason ? { reviewReason: data.reason } : {}),
    })
    void streamAuditEvent({
      eventType: 'erasure_request_reviewed',
      actorUid: actor.uid,
      targetDocumentId: data.erasureRequestId,
      metadata: { approved: data.approved },
      occurredAt: Date.now(),
    })
  })
}

export const approveErasureRequest = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    const { uid } = requireAuth(request, ['superadmin'])
    requireMfaAuth(request)
    await approveErasureRequestCore(getFirestore(), request.data, { uid })
  },
)
