/**
 * fcm-client.ts
 *
 * FCM client helpers for the responder PWA.
 * Handles token acquisition and foreground message handling.
 */

import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { app } from '../app/firebase.js'

export interface FcmTokenResult {
  token: string | null
  error?: string
}

/**
 * Request browser notification permission and acquire an FCM registration token.
 * Returns `null` if permission is denied or if the browser doesn't support push.
 */
export async function acquireFcmToken(
  serviceWorkerRegistration: ServiceWorkerRegistration,
): Promise<FcmTokenResult> {
  if (!('Notification' in self) || !('serviceWorker' in self)) {
    return { token: null, error: 'unsupported' }
  }

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    return { token: null, error: 'permission_denied' }
  }

  try {
    const vapidKey = import.meta.env.VITE_FCM_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      return { token: null, error: 'vapid_key_missing' }
    }
    const messaging = getMessaging(app)
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    })
    return { token }
  } catch (err) {
    return { token: null, error: err instanceof Error ? err.message : 'unknown' }
  }
}

/**
 * Subscribe to foreground FCM messages.
 * Returns an unsubscribe function.
 */
export function subscribeForeground(onPayload: (payload: unknown) => void): () => void {
  const messaging = getMessaging(app)
  return onMessage(messaging, onPayload)
}
