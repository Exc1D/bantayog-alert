# 3A-02 — Citizen Service Worker Push + Click Handlers

**Priority:** P0 (without this, citizen push never reaches a closed app)

**Goal:** The citizen PWA service worker displays incoming Web Push
notifications and tap-through opens the app with the report in focus; FCM
token registration binds to the existing root SW instead of the missing
default `firebase-messaging-sw.js`.

## Files (≤3)

- `apps/citizen-pwa/public/sw.js` (add `push` + `notificationclick` handlers)
- `apps/citizen-pwa/src/hooks/useFcmToken.ts` (pass
  `serviceWorkerRegistration` to both `getToken` calls)
- `apps/citizen-pwa/src/hooks/useFcmToken.test.ts` (new or extend)

## Design constraints

- Raw Web Push handling in the SW — no Firebase SDK inside the service worker
  (learnings.md: SWs cannot use the Firebase JS SDK).
- `push` handler: parse the FCM webpush JSON envelope defensively
  (`event.data?.json()` in try/catch), show `notification.title/body` with
  `data` attached; generic fallback title on parse failure.
- `notificationclick`: focus an existing client if open, else `openWindow` to
  `/` with the report identified via the notification `data` payload. Recon
  in-slice: verify the exact MapTab selection param/state before choosing the
  deep-link shape.
- `getToken(messaging, { vapidKey, serviceWorkerRegistration })` using
  `navigator.serviceWorker.ready` (or the registration the app already holds).
  Plan fallback: if firebase 12's deprecated `getToken` rejects the custom-SW
  path, add `public/firebase-messaging-sw.js` like responder-app instead
  (still ≤3 files).

## Red-first test

Hook test asserting `getToken` is called with a `serviceWorkerRegistration`
option (mock `firebase/messaging` via `vi.hoisted`). SW handlers are plain
functions — unit-harness them if practical, otherwise document manual
verification in the slice PR.

## Out of scope

- Backend sends (3A-01/03/04/05), permission-ask UX (3B-03), anonymous
  delivery (3A-06).

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/hooks/useFcmToken.test.ts`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
