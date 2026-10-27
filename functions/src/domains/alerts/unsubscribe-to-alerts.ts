import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { type Firestore, Timestamp } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { adminDb } from '../../admin-init.js'
import { shouldEnforceAppCheck } from '../shared/app-check-config.js'
import { enforceRateLimit } from '../shared/enforce-rate-limit.js'
import { tokenSchema, verifyTokenOwnership } from './subscribe-to-alerts.js'

export interface UnsubscribeFromAlertsDeps {
  token: string
  actor: { uid: string }
  now: Timestamp
}

export async function unsubscribeFromAlertsCore(
  db: Firestore,
  deps: UnsubscribeFromAlertsDeps,
): Promise<{ success: true }> {
  await enforceRateLimit(db, {
    key: `unsubscribeFromAlerts:${deps.actor.uid}`,
    limit: 20,
    windowSeconds: 60,
    now: deps.now,
  })

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

    const parsed = tokenSchema.safeParse(request.data)
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
