# RF-05 — Decompose the `merge-duplicates` Core

**Priority:** P2 (cyclomatic 22 / cognitive 28 in a report-lifecycle Cloud
Function)

**Gate:** Only execute if rf-01's approved matrix KEEPS `mergeDuplicates`
(bucket C). If the user retires it, this slice is void — do not refactor
code scheduled for deletion.

**Goal:** The oversized arrow function in
`functions/src/domains/reports/merge-duplicates.ts` (287 LOC) is split into
pure helpers (merge-set validation, survivor/loser field reconciliation,
event construction) with thin transaction orchestration.

## Recon facts (2026-06-12 — re-verify before editing)

- Safety nets exist: `functions/src/domains/reports/__tests__/merge-duplicates.unit.test.ts`
  (11 tests, same `createMockDb` harness as rf-04) and an emulator test
  `merge-duplicates.test.ts`. `inputSchema` is exported specifically so
  tests can assert the contract — keep that export.
- Check `merge-duplicates.test.ts` for the collection-time
  `itif(available)` anti-pattern; if present, convert to runtime `skip(...)`
  first (learnings.md: such files can report success while running zero
  tests) — that conversion is part of this slice's red-first setup.

## Files (≤3)

- `functions/src/domains/reports/merge-duplicates.ts` (decompose)
- `functions/src/domains/reports/merge-duplicates-policy.ts` (new — pure
  helpers; no Firestore imports)
- `functions/src/domains/reports/__tests__/merge-duplicates-policy.test.ts` (new)

## Design constraints

- Behavior-neutral: the 11 unit tests + emulator tests pass unchanged.
- Transaction discipline: all reads before first write; idempotency result
  persistence stays atomic; side effects stay inside `withIdempotency`.
- Stable error codes over message matching; omit optional fields instead of
  `undefined`/`null`.

## Red-first test

New policy test file fails before the module exists. Cover: survivor field
reconciliation, loser terminal-state assignment, rejection of invalid merge
sets (self-merge, cross-municipality if currently rejected), event payload
shape.

## Out of scope

- Changing merge semantics or the callable contract; admin UI for merge
  (that is a rf-01 bucket-C product decision); duplicate-detection logic.

## Verification

- `npx vitest run src/domains/reports/__tests__/merge-duplicates.unit.test.ts src/domains/reports/__tests__/merge-duplicates-policy.test.ts` (from `functions/`)
- `firebase emulators:exec --only firestore,database 'npx vitest run src/domains/reports/__tests__/merge-duplicates.test.ts'` (from `functions/`) — confirm tests actually ran, not skipped
- `pnpm --dir functions exec tsc --noEmit && pnpm --dir functions exec eslint src`; fallow audit gate passes
