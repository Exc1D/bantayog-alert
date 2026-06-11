# 3B-04 — `submitReportFeedback` Callable

**Priority:** P1 (backend half of post-resolution feedback; 3B-05 consumes it)

**Goal:** A callable that lets the reporting citizen answer "was this
addressed?" on their resolved report, persisting to a server-only
`report_feedback` collection — the pilot's satisfaction metric.

## Files (≤3)

- `functions/src/domains/reports/submit-report-feedback.ts` (new callable +
  export wiring per existing domain index pattern)
- `packages/shared-validators` feedback schema (recon in-slice: add to the
  existing reports schema module rather than a new file if it fits)
- `functions/src/domains/reports/__tests__/submit-report-feedback.test.ts`
  (new emulator test)

## Design constraints

- Input: `{ reportId, addressed: boolean, comment? (≤500, trimmed, optional) }`.
- Authorization: `request.auth.uid` must equal
  `report_private/{reportId}.reporterUid`, report must be in a terminal
  resolved state; otherwise stable error codes (`permission-denied`,
  `failed-precondition`, `not-found`).
- Writes via Admin SDK to `report_feedback/{reportId}` — **one feedback per
  report** (idempotent: second submission overwrites or rejects —
  recon decides, document choice). Collection stays default-deny: **no
  firestore.rules edit** (callable-only writes). If anything forces a rules
  edit, stop and escalate.
- No PII in the feedback doc beyond reporterUid linkage already implied;
  comment is free text from the reporter about their own report.
- `withIdempotency` envelope + active-account guard per existing callables.

## Red-first test

Emulator test: reporter submits feedback on a resolved seeded report →
`report_feedback` doc exists; non-reporter and non-resolved cases rejected
with stable codes. Must fail before the callable exists.

## Out of scope

- The citizen UI prompt (3B-05), admin feedback dashboards, aggregation.

## Verification

- Rebuild `functions/lib`, then from `functions/`:
  `firebase emulators:exec --only firestore,database 'npx vitest run src/domains/reports/__tests__/submit-report-feedback.test.ts'`
- `pnpm --dir functions exec tsc --noEmit && pnpm --dir functions exec eslint src`
