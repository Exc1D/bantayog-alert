# 3A-04 — Resolution Push to Citizen

**Priority:** P0 (closes the loop: the citizen learns their report was resolved)

**Goal:** When a dispatch reaches `resolved`, the reporting citizen's device
receives a push ("Your report was resolved"), with a `notification_attempted`
record in `report_events`.

## Files (≤3)

- `functions/src/domains/dispatches/advance-dispatch.ts` (or the
  dispatch→report status mirror — **recon in-slice decides** where the
  resolved transition lands the report status, and hooks there)
- `functions/src/domains/dispatches/__tests__/advance-dispatch.test.ts`
  (extend the existing emulator test)

## Design constraints

- Send only on the `resolved` transition, not on
  acknowledged/en_route/on_scene (those stay in-app timeline states).
- Call `sendFcmToCitizen` (3A-01) after the transaction commits, best-effort;
  warnings recorded on the `notification_attempted` report_events doc.
- Copy: title "Your report was resolved", body with the incident type or a
  resolution summary excerpt — no responder PII.
- Payload `data` carries `reportId` for 3A-02 tap-through.
- Replay inside the `withIdempotency` envelope must not double-send.

## Red-first test

Extend the emulator test's resolved-path case: after advancing to `resolved`,
assert a `report_events` doc with `type: 'notification_attempted'` exists.
Must fail before the hook is added.

## Out of scope

- Dispatch/rejection pushes (3A-03/05), post-resolution feedback prompt
  (3B-05), client display (3A-02).

## Verification

- Rebuild `functions/lib` first, then from `functions/`:
  `firebase emulators:exec --only firestore,database 'npx vitest run src/domains/dispatches/__tests__/advance-dispatch.test.ts'`
- `pnpm --dir functions exec tsc --noEmit && pnpm --dir functions exec eslint src`
- `pnpm proof:mvp-loop` still green.
