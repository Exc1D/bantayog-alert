# 3A-07 — Verify-Report Courtesy Push

**Priority:** P2 (optional courtesy — the citizen timeline already shows
verification in-app; dispatch push (3A-03) is the meaningful moment)

**Goal:** When a report reaches `verified`, optionally push "Your report was
verified" to the reporting citizen, with the standard
`notification_attempted` report_events record.

## Files (≤3)

- `functions/src/domains/reports/verify-report.ts`
- `functions/src/domains/reports/__tests__/verify-report.test.ts` (extend)

## Design constraints

- Same pattern as 3A-03/04/05: `sendFcmToCitizen` after commit, best-effort,
  never fails the command, idempotent under replay.
- Send only on the transition into `verified` (not the
  new → awaiting_verify step — that's noise).
- Consider collapse: use a `collapseKey` so a verify push followed minutes
  later by the dispatch push doesn't stack as clutter — recon decides.
- Execute only after 3A-03/04/05 are proven in staging; if pilot feedback
  says two pushes (verify + dispatch) within minutes is noisy, this slice
  gets dropped rather than tuned.

## Red-first test

Extend the verify-report emulator test: second verification (into `verified`)
produces a `notification_attempted` report_events doc. Must fail before the
hook is added.

## Out of scope

- Dispatch/resolution/rejection pushes (3A-03/04/05), client display (3A-02).

## Verification

- Rebuild `functions/lib`, then from `functions/`:
  `firebase emulators:exec --only firestore,database 'npx vitest run src/domains/reports/__tests__/verify-report.test.ts'`
- `pnpm --dir functions exec tsc --noEmit && pnpm --dir functions exec eslint src`
- `pnpm proof:mvp-loop` still green.
