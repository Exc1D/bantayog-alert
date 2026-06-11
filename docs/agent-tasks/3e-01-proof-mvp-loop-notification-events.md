# 3E-01 — Proof: Notification Events in the MVP Loop

**Priority:** Exit (run after the 3A track lands)

**Goal:** `pnpm proof:mvp-loop` asserts the notification backbone: every
cross-role handoff in the lifecycle leaves its `notification_attempted`
evidence — responder side (dispatch_events, existing) and citizen side
(report_events, new from 3A-03/04/05).

## Files (≤3)

- `functions/src/__tests__/proof-mvp-loop.test.ts` (extend assertions)

## Design constraints

- Happy path: after `dispatchResponder`, assert a citizen
  `notification_attempted` report_events record exists alongside the
  responder dispatch_events one; after the resolved transition, assert the
  resolution record.
- Reject path: after `rejectReport`, assert the rejection
  `notification_attempted` record.
- Seeded reporters have no FCM token in the emulator — assert the events
  exist and carry the stable warning (`fcm_no_token`), which proves the send
  path executed without real FCM. Do not mock Messaging inside the proof;
  the warning is the designed observable.
- Count events by `type` (learnings.md: total-collection counts hide stale
  assumptions).

## Red-first test

Add the new assertions before 3A lands only if executing out of order —
normally this slice runs after 3A, so red-first means: add an assertion,
run, watch it fail only if the 3A wiring is incomplete. A first run that is
immediately green is acceptable here **only** with evidence the asserted
events come from the new code (temporarily break the hook to see red, then
restore).

## Out of scope

- Browser-level proof (3E-02), staging callable proof changes, new proof
  scripts.

## Verification

- `pnpm proof:mvp-loop` green with the new assertions shown in output.
- `pnpm --dir functions exec tsc --noEmit && pnpm --dir functions exec eslint src`
