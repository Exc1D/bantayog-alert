import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { withIdempotency } from '../idempotency/guard.js'

const log = console

const subscribeSchema = z.object({
  token: z.string().min(1),
})

export const subscribeToAlerts = onCall(
  withIdempotency({
    fn: async (request) => {
      // Only authenticated users can subscribe
      const auth = (request as { auth?: { uid: string } | null }).auth
      if (!auth) {
        throw new HttpsError('unauthenticated', 'Must be signed in')
      }

      const { token } = subscribeSchema.parse((request as { data: unknown }).data)

      try {
        // Import messaging dynamically to avoid loading unless needed
        const { messaging } = await import('firebase-admin')

        // Subscribe to the alerts topic
        await messaging().subscribeToTopic([token], 'alerts')

        log(`User ${auth.uid} subscribed to alerts topic`)

        return { success: true }
      } catch (error) {
        log('Failed to subscribe to alerts topic:', error)
        throw new HttpsError('internal', 'Failed to subscribe to alerts')
      }
    },
    idempotencyKey: 'token', // Use token as idempotency key to prevent duplicate subscriptions
  }),
)
