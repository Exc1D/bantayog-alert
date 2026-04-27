import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { requireAuth, requireMfaAuth } from './https-error.js'
import { streamAuditEvent } from '../services/audit-stream.js'

const ALLOWED_COLLECTIONS = ['reports', 'report_private', 'report_ops', 'sms_inbox'] as const

export async function setRetentionExemptCore(
  db: Firestore,
  input: { collection: string; documentId: string; exempt: boolean; reason: string },
  actor: { uid: string },
): Promise<void> {
  if (!(ALLOWED_COLLECTIONS as readonly string[]).includes(input.collection)) {
    throw new HttpsError('invalid-argument', 'collection_not_allowed')
  }
  await db.collection(input.collection).doc(input.documentId).update({
    retentionExempt: input.exempt,
    retentionExemptReason: input.reason,
    retentionExemptSetBy: actor.uid,
    retentionExemptSetAt: Date.now(),
  })
  void streamAuditEvent({
    eventType: 'retention_exempt_set',
    actorUid: actor.uid,
    targetCollection: input.collection,
    targetDocumentId: input.documentId,
    metadata: { exempt: input.exempt },
    occurredAt: Date.now(),
  })
}

export const setRetentionExempt = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    const { uid } = requireAuth(request, ['superadmin'])
    requireMfaAuth(request)
    await setRetentionExemptCore(
      getFirestore(),
      request.data as { collection: string; documentId: string; exempt: boolean; reason: string },
      { uid },
    )
  },
)
