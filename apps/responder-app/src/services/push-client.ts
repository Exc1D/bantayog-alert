/**
 * push-client.ts
 *
 * Unified push notification abstraction for the responder app.
 *
 * On Capacitor native platforms: uses @capacitor/push-notifications for token
 * registration, foreground message handling, and notification tap-through.
 * On web: falls back to the existing Firebase web FCM flow.
 */

import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { acquireFcmToken, subscribeForeground, type FcmTokenResult } from './fcm-client.js'

export type { FcmTokenResult }

/**
 * Request notification permission and acquire a push registration token.
 * On native: uses the Capacitor push-notifications plugin.
 * On web: delegates to acquireFcmToken with the existing service worker.
 */
export async function acquirePushToken(): Promise<FcmTokenResult> {
  if (Capacitor.isNativePlatform()) {
    const perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') {
      return { token: null, error: 'permission_denied' }
    }

    return new Promise((resolve, reject) => {
      let isSettled = false

      const resolveOnce = (result: FcmTokenResult) => {
        if (!isSettled) {
          isSettled = true
          resolve(result)
        }
      }
      const rejectOnce = (err: unknown) => {
        if (!isSettled) {
          isSettled = true
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      }

      void (async () => {
        try {
          const [registrationHandle, registrationErrorHandle] = await Promise.all([
            PushNotifications.addListener('registration', (token) => {
              void registrationHandle.remove()
              void registrationErrorHandle.remove()
              resolveOnce({ token: token.value })
            }),
            PushNotifications.addListener('registrationError', (err) => {
              void registrationHandle.remove()
              void registrationErrorHandle.remove()
              resolveOnce({ token: null, error: err.error })
            }),
          ])

          try {
            await PushNotifications.register()
          } catch (err: unknown) {
            void registrationHandle.remove()
            void registrationErrorHandle.remove()
            rejectOnce(err)
          }
        } catch (err: unknown) {
          rejectOnce(err)
        }
      })()
    })
  }

  // Web fallback
  const swContainer = 'serviceWorker' in navigator ? navigator.serviceWorker : null
  if (!swContainer) {
    return { token: null, error: 'service_worker_unavailable' }
  }

  const sw = await swContainer.ready
  return acquireFcmToken(sw)
}

/**
 * Subscribe to foreground push notifications.
 * Returns an unsubscribe function.
 */
export function subscribeForegroundPush(onPayload: (payload: unknown) => void): () => void {
  if (Capacitor.isNativePlatform()) {
    const handlePromise = PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        onPayload(notification)
      },
    )
    return () => {
      void handlePromise.then((h) => h.remove())
    }
  }

  return subscribeForeground(onPayload)
}

/**
 * Subscribe to notification tap-through events.
 * On native: extracts dispatchId from notification data and calls onTap.
 * On web: no-op (the service worker handles notificationclick).
 * Returns an unsubscribe function.
 */
export function subscribeNotificationTap(onTap: (dispatchId: string) => void): () => void {
  if (!Capacitor.isNativePlatform()) {
    // Web tap-through is handled by the service worker notificationclick event.
    return () => undefined
  }

  const handlePromise = PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action) => {
      const data = action.notification.data as Record<string, unknown> | undefined
      const dispatchId = data?.dispatchId
      if (
        typeof dispatchId === 'string' &&
        dispatchId.trim().length > 0 &&
        !dispatchId.includes('/')
      ) {
        onTap(dispatchId.trim())
      }
    },
  )
  return () => {
    void handlePromise.then((h) => h.remove())
  }
}
