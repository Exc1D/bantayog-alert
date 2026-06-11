# 3A-05 — Rejection Push to Citizen

**Priority:** P0 (a rejected report must not look forever-pending on a closed app)

**Goal:** When an admin rejects a report, the reporting citizen's device
receives a push ("Your report was not accepted"), with a
`notification_attempted` record in `report_events`.

## Files (≤3)

- `functions/src/domains/reports/reject-report.ts`
- `functions/src/domains/reports/__tests__/reject-report.test.ts` (extend the
  existing emulator test)

## Design constraints

- Call `sendFcmToCitizen` (3A-01) after the transaction commits, best-effort;
  warnings recorded on the `notification_attempted` report_events doc.
- Copy: neutral, non-punitive — title "Update on your report", body "Your
  report was not accepted. Open the app for details." The reason enum stays
  in-app (DetailSheet terminal copy), not in the push.
- Payload `data` carries `reportId` for 3A-02 tap-through.
- Replay inside the `withIdempotency` envelope must not double-send.
- Works for both single and bulk rejection paths if they share the callable;
  recon in-slice confirms bulk goes through the same core.

## Red-first test

Extend the emulator test: reject a seeded report and assert a `report_events`
doc with `type: 'notification_attempted'` exists. Must fail before the hook
is added.

## Out of scope

- Dispatch/resolution pushes (3A-03/04), verify push (3A-07), client display
  (3A-02).

## Verification

- Rebuild `functions/lib` first, then from `functions/`:
  `firebase emulators:exec --only firestore,database 'npx vitest run src/domains/reports/__tests__/reject-report.test.ts'`
- `pnpm --dir functions exec tsc --noEmit && pnpm --dir functions exec eslint src`
- `pnpm proof:mvp-loop` still green.
