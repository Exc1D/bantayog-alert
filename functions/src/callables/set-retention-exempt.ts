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
  actor: { uid: string; permittedMunicipalityIds: string[] },
): Promise<void> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'invalid_retention_exempt_payload')
  }
  const data = parsed.data
  const docRef = db.collection(data.collection).doc(data.documentId)
  const docSnap = await docRef.get()
  if (!docSnap.exists) {
    throw new HttpsError('not-found', 'document_not_found')
  }
  const docData = docSnap.data() as Record<string, unknown>
  const docMunicipalityId = docData.municipalityId as string | undefined
  if (docMunicipalityId && !actor.permittedMunicipalityIds.includes(docMunicipalityId)) {
    throw new HttpsError('permission-denied', 'municipality_not_permitted')
  }
  await docRef.update({
    retentionExempt: data.exempt,
    retentionExemptReason: data.reason,
    retentionExemptSetBy: actor.uid,
    retentionExemptSetAt: Date.now(),
  })
  void streamAuditEvent({
    eventType: 'retention_exempt_set',
    actorUid: actor.uid,
    targetCollection: data.collection,
    targetDocumentId: data.documentId,
    metadata: { exempt: data.exempt },
    occurredAt: Date.now(),
  })
}

export const setRetentionExempt = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    const { uid, claims } = requireAuth(request, ['superadmin'])
    requireMfaAuth(request)
    const permittedMunicipalityIds = Array.isArray(claims.permittedMunicipalityIds)
      ? (claims.permittedMunicipalityIds as string[])
      : []
    await setRetentionExemptCore(getFirestore(), request.data, { uid, permittedMunicipalityIds })
  },
)
