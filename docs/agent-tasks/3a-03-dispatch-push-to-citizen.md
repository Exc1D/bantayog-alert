# 3A-03 — "Help is on the way" Push on `dispatchResponder`

**Priority:** P0 (the headline cross-role handoff: responder assigned → citizen)

**Goal:** When an admin dispatches a responder, the reporting citizen's device
receives a push ("Help is on the way"), and a `notification_attempted` record
lands in `report_events` mirroring the existing `dispatch_events` pattern.

## Files (≤3)

- `functions/src/domains/dispatches/dispatch-responder.ts` (or
  `dispatch-responder-writes.ts` — recon in-slice picks the post-commit hook
  point next to the existing responder `notification_attempted` write)
- `functions/src/domains/dispatches/__tests__/dispatch-responder.test.ts`
  (extend the existing emulator test)

## Design constraints

- Call `sendFcmToCitizen` (3A-01) after the transaction commits, best-effort —
  a push failure must never fail the dispatch (mirror how the responder send
  is handled today, including warning propagation).
- Write one `report_events` record `type: 'notification_attempted'` with the
  send warnings, parallel to the dispatch_events write in
  `dispatch-responder.ts`.
- Copy: title "Help is on the way", body naming the agency or responder role —
  no responder PII (name/phone) in the push payload.
- Payload `data` carries `reportId` for 3A-02 tap-through.
- Idempotency: stays inside the existing `withIdempotency` envelope — a
  replayed command must not double-send.

## Red-first test

Extend the emulator test: dispatch a seeded report and assert a
`report_events` doc with `type: 'notification_attempted'` exists for the
report. Must fail before the hook is added.

## Out of scope

- Resolution/rejection pushes (3A-04/05), client display (3A-02), verify push
  (3A-07).

## Verification

- Rebuild `functions/lib` first, then from `functions/`:
  `firebase emulators:exec --only firestore,database 'npx vitest run src/domains/dispatches/__tests__/dispatch-responder.test.ts'`
- `pnpm --dir functions exec tsc --noEmit && pnpm --dir functions exec eslint src`
- `pnpm proof:mvp-loop` still green.
