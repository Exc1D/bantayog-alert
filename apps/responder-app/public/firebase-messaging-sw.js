/**
 * firebase-messaging-sw.js
 *
 * Firebase Cloud Messaging service worker.
 * Handles background push notifications when the app is not in focus.
 * Uses classic script (importScripts) for broad browser compatibility.
 */

const FIREBASE_APP_SCRIPT = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js'
const FIREBASE_MESSAGING_SCRIPT =
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js'

importScripts(FIREBASE_APP_SCRIPT)
importScripts(FIREBASE_MESSAGING_SCRIPT)

let messaging = null

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG' && !messaging) {
    try {
      const app = firebase.initializeApp(event.data.config)
      messaging = firebase.messaging(app)

      messaging.onBackgroundMessage((payload) => {
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
    } catch (err) {
      console.warn('FCM SW init failed:', err)
    }
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const dispatchId = event.notification.data?.dispatchId
  const target = dispatchId ? `/dispatches/${dispatchId}` : '/'
  event.waitUntil(self.clients.openWindow(target))
})
