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
  const parsed = inputSchema.parse(input)
  const doc = await db.collection('erasure_requests').doc(parsed.erasureRequestId).get()
  if (!doc.exists) {
    throw new HttpsError('not-found', 'erasure_request_not_found')
  }
  const status = parsed.approved ? 'approved_pending_anonymization' : 'denied'
  await doc.ref.update({
    status,
    reviewedBy: actor.uid,
    reviewedAt: Date.now(),
    ...(parsed.reason ? { reviewReason: parsed.reason } : {}),
  })
  void streamAuditEvent({
    eventType: 'erasure_request_reviewed',
    actorUid: actor.uid,
    targetDocumentId: parsed.erasureRequestId,
    metadata: { approved: parsed.approved },
    occurredAt: Date.now(),
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
