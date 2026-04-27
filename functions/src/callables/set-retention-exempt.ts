import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { z } from 'zod'
import { requireAuth, requireMfaAuth } from './https-error.js'
import { streamAuditEvent } from '../services/audit-stream.js'

const inputSchema = z.object({
  collection: z.enum(['reports', 'report_private', 'report_ops', 'sms_inbox']),
  documentId: z.string().min(1),
  exempt: z.boolean(),
  reason: z.string().min(1),
})

export async function setRetentionExemptCore(
  db: Firestore,
  input: unknown,
  actor: { uid: string },
): Promise<void> {
  const parsed = inputSchema.parse(input)
  const docRef = db.collection(parsed.collection).doc(parsed.documentId)
  const docSnap = await docRef.get()
  if (!docSnap.exists) {
    throw new HttpsError('not-found', 'document_not_found')
  }
  await docRef.update({
    retentionExempt: parsed.exempt,
    retentionExemptReason: parsed.reason,
    retentionExemptSetBy: actor.uid,
    retentionExemptSetAt: Date.now(),
  })
  void streamAuditEvent({
    eventType: 'retention_exempt_set',
    actorUid: actor.uid,
    targetCollection: parsed.collection,
    targetDocumentId: parsed.documentId,
    metadata: { exempt: parsed.exempt },
    occurredAt: Date.now(),
  })
}

export const setRetentionExempt = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    const { uid } = requireAuth(request, ['superadmin'])
    requireMfaAuth(request)
    await setRetentionExemptCore(getFirestore(), request.data, { uid })
  },
)
