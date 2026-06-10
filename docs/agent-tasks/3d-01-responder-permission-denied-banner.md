# 3D-01 — Responder Push Permission-Denied Banner

**Priority:** P0 (a responder who denied notifications silently misses dispatches)

**Goal:** A responder whose notification permission is denied (or who never
granted it) sees a persistent, dismissible warning that they will not receive
dispatch push notifications, with a retry path — replacing today's silent
`console.warn` in App.tsx.

## Files (≤3)

- `apps/responder-app/src/App.tsx` (replace the silent warn with banner state)
- `apps/responder-app/src/components/PushPermissionBanner.tsx` (new)
- `apps/responder-app/src/components/PushPermissionBanner.test.tsx` (new)

## Design constraints

- Show when `Notification.permission === 'denied'` or when permission is
  `default` and the FCM token request failed/was skipped. Recon in-slice: read
  the existing App.tsx permission flow before deciding the exact trigger
  states.
- `denied`: explain that the browser blocks notifications and point to browser
  settings (no in-app retry possible). `default`: offer a "Enable
  notifications" button that re-runs the existing permission request.
- Dismissible per-session, but reappears on next launch while unresolved —
  this is a safety-critical warning, not a one-time toast.
- Match existing responder banner/`role="alert"` patterns; reduced-motion
  safe; no `backdrop-blur` (PRODUCT.md ban).

## Red-first test

Component test: with mocked `Notification.permission = 'denied'`, banner
renders with settings guidance; with `default` + failed token, the enable
button invokes the permission request. Must fail before the component exists.

## Out of scope

- Citizen permission ask (3B-03), off-shift warning (3D-02), backend changes.

## Verification

- `pnpm --dir apps/responder-app exec vitest run src/components/PushPermissionBanner.test.tsx`
- `pnpm --dir apps/responder-app exec tsc --noEmit && pnpm --dir apps/responder-app exec eslint src`
