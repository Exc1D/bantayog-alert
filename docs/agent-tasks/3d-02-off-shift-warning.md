# 3D-02 — Responder Off-Shift Warning

**Priority:** P1 (backend RTDB `isOnShift` gate blocks assignment silently)

**Goal:** A responder who is off shift / unavailable sees an explicit "While
off duty you will not receive dispatches" notice on their Profile page, so the
backend assignment gate is never a silent surprise.

## Files (≤3)

- `apps/responder-app/src/pages/ProfilePage.tsx` (warning copy near the
  availability segmented control)
- `apps/responder-app/src/pages/ProfilePage.test.tsx` (extend)

## Design constraints

- Recon in-slice: how ProfilePage models availability/shift state today (the
  segmented control from the 2026-05-28 pass) — derive the warning from that
  same state, no new listener.
- Copy is informational, not blocking: shown while the off-duty/unavailable
  state is selected, disappears when available. `role="status"`, not a modal.
- Mirror the deployed truth: `dispatchResponder` requires RTDB
  `isOnShift === true` (learnings.md) — if the UI availability state and the
  RTDB shift flag are different axes, recon must confirm which one the copy
  keys off, and say so in the test name.

## Red-first test

Page test: off-duty/unavailable state renders the warning; available state
does not. Must fail before the change.

## Out of scope

- Changing shift/availability semantics, push permission banner (3D-01),
  backend changes.

## Verification

- `pnpm --dir apps/responder-app exec vitest run src/pages/ProfilePage.test.tsx`
- `pnpm --dir apps/responder-app exec tsc --noEmit && pnpm --dir apps/responder-app exec eslint src`
