# 3B-06 — Lookup Offline State

**Priority:** P1 (offline lookup failure reads as "something went wrong")

**Goal:** The anonymous tracking-code lookup distinguishes "you're offline"
from genuine lookup failure, with copy that tells the citizen the code is
fine and to retry when connected.

## Files (≤3)

- `apps/citizen-pwa/src/components/LookupScreen.tsx`
- `apps/citizen-pwa/src/components/LookupScreen.test.tsx` (extend)

## Design constraints

- Reuse the existing `useOnlineStatus()` signal (recon in-slice: confirm its
  contract — tests must stub fetch per learnings.md because it probes
  `/__/firebase.json`).
- Offline at submit time: block the call, show "You're offline — your code is
  saved, try again when connected" and keep the entered code in the field.
- Network-shaped callable failure while "online": show the offline-flavored
  retry copy rather than the generic failure, when the error is
  `unavailable`/network — recon lists the codes; validation errors keep the
  current invalid-code message.
- Retry is manual (button), not auto-polling.

## Red-first test

Screen test: offline state renders the offline copy and does not call
`requestLookup`; preserved input asserted. Must fail before the change.

## Out of scope

- Success-path navigation (3B-01), background sync for lookups, backend
  changes.

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/components/LookupScreen.test.tsx`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
