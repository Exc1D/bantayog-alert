import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminDb } from '../admin-init.js'
import { withIdempotency } from '../idempotency/guard.js'
import { bantayogErrorToHttps, requireAuth } from './https-error.js'

const requestSchema = z
  .object({
    threadId: z.string().min(1).max(128),
    body: z.string().min(1).max(2000),
    idempotencyKey: z.uuid(),
  })
  .strict()

export interface AddCommandChannelMessageDeps {
  threadId: string
  body: string
  idempotencyKey: string
  actor: { uid: string; claims: { role: string; accountStatus: string } }
  now: Timestamp
}

export async function addCommandChannelMessageCore(
  db: FirebaseFirestore.Firestore,
  deps: AddCommandChannelMessageDeps,
): Promise<{ status: 'sent' }> {
  const { threadId, body, idempotencyKey, actor, now } = deps
  const nowMs = now.toMillis()
  const trimmedBody = body.trim()

  if (!trimmedBody) throw new HttpsError('invalid-argument', 'body cannot be empty')
  if (trimmedBody.length > 2000) throw new HttpsError('invalid-argument', 'body exceeds 2000 chars')

  const threadSnap = await db.collection('command_channel_threads').doc(threadId).get()
  if (!threadSnap.exists) throw new HttpsError('not-found', 'thread not found')
  const thread = threadSnap.data() as Record<string, unknown>

  const participantUids = thread.participantUids as Record<string, boolean>
  if (!participantUids[actor.uid]) {
    throw new HttpsError('permission-denied', 'caller is not a thread participant')
  }

  await withIdempotency(
    db,
    {
      key: `addChannelMessage:${actor.uid}:${idempotencyKey}`,
      payload: { threadId, body: trimmedBody },
      now: () => nowMs,
    },
    async () => {
      const msgRef = db.collection('command_channel_messages').doc()
      // eslint-disable-next-line @typescript-eslint/require-await
      await db.runTransaction(async (tx) => {
        tx.set(msgRef, {
          threadId,
          authorUid: actor.uid,
          authorRole: actor.claims.role,
          body: trimmedBody,
          createdAt: nowMs,
          schemaVersion: 1,
        })
        tx.update(db.collection('command_channel_threads').doc(threadId), {
          lastMessageAt: nowMs,
          updatedAt: nowMs,
        })
      })
      return { status: 'sent' as const }
    },
  )
  return { status: 'sent' }
}

export const addCommandChannelMessage = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (req: CallableRequest) => {
    const actor = requireAuth(req)
    const input = requestSchema.parse(req.data)
    try {
      return await addCommandChannelMessageCore(adminDb, {
        ...input,
        actor: {
          uid: actor.uid,
          claims: actor.claims as { role: string; accountStatus: string },
        },
        now: Timestamp.now(),
      })
    } catch (err: unknown) {
      throw bantayogErrorToHttps(err as Parameters<typeof bantayogErrorToHttps>[0])
    }
  },
)
