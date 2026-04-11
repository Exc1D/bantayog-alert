// firebase-messaging-sw.js
// Firebase Cloud Messaging service worker for Bantayog Alert
// Handles background push notifications for emergency alerts

importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

// Initialize Firebase - config is injected at build time via VITE_FIREBASE_* env vars
// or replaced during deployment. Using placeholders for development.
firebase.initializeApp({
  apiKey: "REPLACE_WITH_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_FIREBASE_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_FIREBASE_PROJECT_ID",
  messagingSenderId: "REPLACE_WITH_FIREBASE_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_FIREBASE_APP_ID"
});

const messaging = firebase.messaging();

// Force service worker activation
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Claim all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  // Validate payload structure for safety
  if (!payload || typeof payload !== 'object') {
    console.error('Invalid FCM payload received');
    return;
  }

  const notificationTitle = payload.notification?.title || 'New Alert';
  const notificationBody = payload.notification?.body || 'Check for updates';
  const data = payload.data || {};

  // Determine if this is an urgent/emergency alert
  const isEmergency = data.severity === 'emergency';
  const isWarning = data.severity === 'warning';

  const notificationOptions = {
    body: notificationBody,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-48x48.png',
    data: data,
    // Urgent alerts should remain on screen until user interacts
    requireInteraction: isEmergency || isWarning,
    // Vibration pattern for urgent alerts
    vibrate: (isEmergency || isWarning) ? [200, 100, 200, 100, 200] : [100],
    // High priority for urgent alerts
    priority: isEmergency ? 'high' : 'normal',
    actions: [
      { action: 'view', title: 'View Alert' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    // Check if there's already an open window at /alerts
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Try to focus an existing window first
        for (const client of clientList) {
          if (client.url.includes('/alerts') && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        return clients.openWindow('/?tab=alerts');
      })
    );
  }
});

// Track when notifications are dismissed without interaction
self.addEventListener('notificationclose', (event) => {
  // Could track analytics here if needed
  const data = event.notification.data || {};
  console.log('Notification dismissed:', data);
});