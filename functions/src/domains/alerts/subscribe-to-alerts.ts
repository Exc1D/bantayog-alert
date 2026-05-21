import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { type Firestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { withIdempotency } from '../../idempotency/guard.js'
import { adminDb } from '../../admin-init.js'

const subscribeSchema = z.object({
  token: z.string().min(1),
})

export interface SubscribeToAlertsCoreDeps {
  token: string
  actor: { uid: string }
  now: Timestamp
}

export async function subscribeToAlertsCore(
  db: Firestore,
  deps: SubscribeToAlertsCoreDeps,
): Promise<{ success: true }> {
  const { token, actor, now } = deps

  const { result } = await withIdempotency(
    db,
    {
      key: `subscribeToAlerts:${actor.uid}:${token}`,
      payload: { token },
      now: () => now.toMillis(),
    },
    async () => {
      // Import messaging dynamically to avoid loading unless needed
      const { messaging } = await import('firebase-admin')

      // Subscribe to the alerts topic
      await messaging().subscribeToTopic([token], 'alerts')

      return { success: true as const }
    },
  )

  return result
}

export const subscribeToAlerts = onCall(
  { region: 'asia-southeast1' },
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in')
    }

    const parsed = subscribeSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'malformed payload')
    }

    try {
      return await subscribeToAlertsCore(adminDb, {
        token: parsed.data.token,
        actor: { uid: request.auth.uid },
        now: Timestamp.now(),
      })
    } catch (error) {
      console.error('Failed to subscribe to alerts topic:', error)
      throw new HttpsError('internal', 'Failed to subscribe to alerts')
    }
  },
)
