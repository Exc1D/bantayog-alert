/**
 * firebase-messaging-sw.js
 *
 * Firebase Cloud Messaging service worker.
 * Handles background push notifications when the app is not in focus.
 * Placed in /public so it is served at the root scope (/).
 */

import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'

// Injected by Vite at build time.
const {
  VITE_FIREBASE_API_KEY: apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: authDomain,
  VITE_FIREBASE_PROJECT_ID: projectId,
  VITE_FIREBASE_STORAGE_BUCKET: storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: messagingSenderId,
  VITE_FIREBASE_APP_ID: appId,
} = import.meta.env

let messaging = null

try {
  const app = initializeApp({
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  })
  messaging = getMessaging(app)
} catch (err) {
  console.warn('FCM SW init failed:', err)
}

if (messaging) {
  onBackgroundMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? 'New Dispatch'
    const body = payload.notification?.body ?? 'Open the app for details'
    const dispatchId = payload.data?.dispatchId

    self.registration.showNotification(title, {
      body,
      data: payload.data,
      icon: '/favicon.svg',
      tag: dispatchId ? `dispatch-${dispatchId}` : 'dispatch',
    })
  })

  self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const dispatchId = event.notification.data?.dispatchId
    const target = dispatchId ? `/dispatches/${dispatchId}` : '/'
    event.waitUntil(self.clients.openWindow(target))
  })
}
