import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { z } from 'zod'
import { replayHazardSignalProjection } from '../services/hazard-signal-projector.js'
import { pagasaSignalPollCore } from '../triggers/pagasa-signal-poll.js'

const replaySignalDeadLetterInputSchema = z
  .object({
    category: z.enum(['pagasa_scraper', 'hazard_signal_projection']),
  })
  .strict()

type ReplaySignalDeadLetterInput = z.infer<typeof replaySignalDeadLetterInputSchema>

interface ReplaySignalDeadLetterActor {
  uid: string
  role: string
}

function assertPrivilegedActor(actor: ReplaySignalDeadLetterActor): void {
  if (actor.role !== 'provincial_superadmin') {
    throw new HttpsError('permission-denied', 'superadmin_required')
  }
}

function extractReplayableHtml(payload: unknown): string | null {
  if (typeof payload === 'string') return payload
  if (!payload || typeof payload !== 'object') return null

  const html = (payload as { html?: unknown }).html
  if (typeof html === 'string' && html.length > 0) return html

  return null
}

export async function replaySignalDeadLetterCore(
  db: Firestore,
  input: ReplaySignalDeadLetterInput,
  actor: ReplaySignalDeadLetterActor,
): Promise<{ replayed: number }> {
  assertPrivilegedActor(actor)
  const snap = await db
    .collection('dead_letters')
    .where('category', '==', input.category)
    .limit(20)
    .get()
  const now = Date.now()

  if (input.category === 'hazard_signal_projection') {
    if (snap.size === 0) return { replayed: 0 }
    await replayHazardSignalProjection({ db, now })
    await Promise.all(
      snap.docs.map(async (doc) => {
        await doc.ref.update({
          resolvedAt: now,
          resolvedBy: actor.uid,
        })
      }),
    )
    return { replayed: snap.size }
  }

  let replayed = 0
  for (const doc of snap.docs) {
    const payload = extractReplayableHtml(doc.data().payload)
    if (payload === null) {
      throw new HttpsError('failed-precondition', 'dead_letter_payload_unreplayable')
    }

    const result = await pagasaSignalPollCore({
      db,
      fetchHtml: () => Promise.resolve(payload),
      now: () => now,
    })
    if (result.status !== 'updated') continue

    await doc.ref.update({
      resolvedAt: now,
      resolvedBy: actor.uid,
    })
    replayed++
  }

  return { replayed }
}

export const replaySignalDeadLetter = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const role = request.auth.token.role
    const actor = {
      uid: request.auth.uid,
      role: typeof role === 'string' ? role : '',
    }

    const parsed = replaySignalDeadLetterInputSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'unsupported replay category')
    }

    assertPrivilegedActor(actor)
    return replaySignalDeadLetterCore(getFirestore(), parsed.data, actor)
  },
)
