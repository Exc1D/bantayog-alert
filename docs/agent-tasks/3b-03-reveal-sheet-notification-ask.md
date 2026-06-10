# 3B-03 — Notification Permission Ask at Submission Success

**Priority:** P1 (depends on 3A-01/02/03 — without the ask, registered users
never grant permission and the push backbone reaches nobody)

**Goal:** After a successful report submission (RevealSheet success state),
the citizen is offered "Get notified when help is on the way" — registered
users trigger the existing FCM permission flow; anonymous users see a
register nudge instead.

## Files (≤3)

- `apps/citizen-pwa/src/components/RevealSheet/RevealSheet.tsx` (success-state
  prompt)
- `apps/citizen-pwa/src/components/RevealSheet.test.tsx` (extend)
- (only if wiring requires) the success-state subcomponent recon identifies
  inside `components/RevealSheet/`

## Design constraints

- Reuse `useFcmToken().requestPermission` — no new permission plumbing.
- Show only when `Notification.permission === 'default'` (never re-ask after
  denied; granted shows nothing).
- Anonymous users: no permission prompt (their token isn't persisted) — show
  "Create an account to get notified when help is on the way" linking to the
  existing /register route.
- Declining is a designed path: dismiss quietly, no nagging on the same
  submission. Ethical-retention rules apply — informative, zero pressure.

## Red-first test

Component test: registered user + permission `default` → prompt renders and
the accept button calls `requestPermission`; anonymous user → register nudge
renders instead. Must fail before the change.

## Out of scope

- Anonymous push delivery (gate 3A-06), SW handlers (3A-02), settings-page
  notification toggle (already exists).

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/components/RevealSheet.test.tsx`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
