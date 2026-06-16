import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { type Firestore, Timestamp } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { z } from 'zod'
import { adminDb } from '../../admin-init.js'
import { shouldEnforceAppCheck } from '../shared/app-check-config.js'
import { checkRateLimit } from '../shared/rate-limit.js'

const unsubscribeSchema = z.object({
  token: z.string().min(1),
})

export interface UnsubscribeFromAlertsDeps {
  token: string
  actor: { uid: string }
  now: Timestamp
}

async function verifyTokenOwnership(db: Firestore, uid: string, token: string): Promise<void> {
  const userSnap = await db.collection('users').doc(uid).get()
  if (userSnap.exists && userSnap.data()?.fcmToken === token) {
    return
  }

  const responderSnap = await db.collection('responders').doc(uid).get()
  const tokens = responderSnap.data()?.fcmTokens
  if (Array.isArray(tokens) && tokens.includes(token)) {
    return
  }

  throw new HttpsError('permission-denied', 'Token does not belong to caller')
}

export async function unsubscribeFromAlertsCore(
  db: Firestore,
  deps: UnsubscribeFromAlertsDeps,
): Promise<{ success: true }> {
  const rl = await checkRateLimit(db, {
    key: `unsubscribeFromAlerts:${deps.actor.uid}`,
    limit: 20,
    windowSeconds: 60,
    now: deps.now,
  })
  if (!rl.allowed) {
    throw new HttpsError('resource-exhausted', 'rate limit exceeded', {
      retryAfterSeconds: rl.retryAfterSeconds,
    })
  }

  await verifyTokenOwnership(db, deps.actor.uid, deps.token)

  const response = await getMessaging().unsubscribeFromTopic([deps.token], 'alerts')
  if (response.failureCount > 0 && response.errors.length > 0) {
    const errors = response.errors
      .map((e) => (typeof e.error === 'string' ? e.error : JSON.stringify(e.error)))
      .join(', ')
    throw new Error(`Failed to unsubscribe from alerts topic: ${errors}`)
  }
  return { success: true }
}

export const unsubscribeFromAlerts = onCall(
  { region: 'asia-southeast1', enforceAppCheck: shouldEnforceAppCheck(), maxInstances: 10 },
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in')
    }

    const parsed = unsubscribeSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'malformed payload')
    }

    try {
      return await unsubscribeFromAlertsCore(adminDb, {
        token: parsed.data.token,
        actor: { uid: request.auth.uid },
        now: Timestamp.now(),
      })
    } catch (error) {
      if (error instanceof HttpsError) throw error
      console.error('Failed to unsubscribe from alerts topic:', error)
      throw new HttpsError('internal', 'Failed to unsubscribe from alerts')
    }
  },
)
