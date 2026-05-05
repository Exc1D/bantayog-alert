import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { streamAuditEvent, type AuditStreamEvent } from '../services/audit-stream.js'

interface ReplayAuditDeadLetterActor {
  uid: string
  role: string
}

function assertSuperadmin(actor: ReplayAuditDeadLetterActor): void {
  if (actor.role !== 'provincial_superadmin') {
    throw new HttpsError('permission-denied', 'superadmin_required')
  }
}

export async function replayAuditDeadLetterCore(
  db: Firestore,
  actor: ReplayAuditDeadLetterActor,
): Promise<{ replayed: number }> {
  assertSuperadmin(actor)

  const snap = await db
    .collection('dead_letters')
    .where('category', '==', 'audit_stream')
    .limit(20)
    .get()

  // Filters in memory to avoid composite index requirement.
  // If first 20 are already streamed, caller may need to retry.
  const failed = snap.docs.filter((d) => d.data().status === 'failed_to_stream')
  const now = Date.now()
  let replayed = 0

  for (const doc of failed) {
    const data = doc.data()
    try {
      await streamAuditEvent(data.payload as AuditStreamEvent)
      await doc.ref.update({
        status: 'streamed',
        streamedAt: now,
        streamedBy: actor.uid,
      })
      replayed++
    } catch (err) {
      console.warn('[replay-audit-dead-letter] failed to replay', doc.id, err)
    }
  }

  return { replayed }
}

export const replayAuditDeadLetter = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const role = request.auth.token.role
    const actor = {
      uid: request.auth.uid,
      role: typeof role === 'string' ? role : '',
    }

    return await replayAuditDeadLetterCore(getFirestore(), actor)
  },
)
