import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { requireAuth } from './https-error.js'
import { streamAuditEvent } from '../services/audit-stream.js'

export async function toggleMutualAidVisibilityCore(
  db: Firestore,
  input: { agencyId: string; visible: boolean },
  actor: { uid: string },
): Promise<void> {
  const agencyRef = db.collection('agencies').doc(input.agencyId)
  const agencyDoc = await agencyRef.get()
  if (!agencyDoc.exists) {
    throw new HttpsError('not-found', 'agency_not_found')
  }
  await agencyRef.update({
    mutualAidVisible: input.visible,
  })
  void streamAuditEvent({
    eventType: 'mutual_aid_visibility_toggled',
    actorUid: actor.uid,
    targetCollection: 'agencies',
    targetDocumentId: input.agencyId,
    metadata: { visible: input.visible },
    occurredAt: Date.now(),
  })
}

export const toggleMutualAidVisibility = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    const { uid } = requireAuth(request, ['superadmin', 'pdrrmo'])
    await toggleMutualAidVisibilityCore(
      getFirestore(),
      request.data as { agencyId: string; visible: boolean },
      { uid },
    )
  },
)
