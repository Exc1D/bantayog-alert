# RF-04 — Decompose the `redispatch-report` Core

**Priority:** P2 (cyclomatic 24 / cognitive 22 in a live dispatch-path Cloud
Function; escalation logic must be readable during incidents)

**Goal:** The oversized arrow function in
`functions/src/domains/dispatches/redispatch-report.ts` (318 LOC) is split
into named pure helpers (validation, escalation-state derivation, doc
construction) with the transaction/idempotency orchestration left thin.

## Recon facts (2026-06-12 — re-verify before editing)

- Safety net exists: `functions/src/domains/dispatches/__tests__/redispatch-report.unit.test.ts`
  (12 tests; hoisted `withIdempotency` mock + `createMockDb` exposing
  `_txGet`/`_txUpdate`/`_txSet` and asserting ref paths — keep this harness
  working unchanged).
- Single-dispatch escalation contract (learnings.md): mutates `assignedTo`,
  increments `escalationCount`, appends the old responder to
  `previouslyNotifiedResponderUids`. Dispatch docs must keep
  `dispatchedByRole`, `statusUpdatedAt`, `idempotencyKey`, `municipalityId`,
  and omit optional fields rather than write `undefined`/`null`.

## Files (≤3)

- `functions/src/domains/dispatches/redispatch-report.ts` (decompose)
- `functions/src/domains/dispatches/redispatch-policy.ts` (new — pure
  helpers; no Firestore imports, plain data in/out)
- `functions/src/domains/dispatches/__tests__/redispatch-policy.test.ts` (new)

## Design constraints

- Behavior-neutral: the 12 existing unit tests pass unchanged — do not edit
  them to make the refactor fit.
- In transactions, all reads stay before the first write; notification side
  effects stay INSIDE the `withIdempotency` operation (learnings.md: cached
  replays must not double-send).
- Prefer concrete transaction values over Admin `FieldValue` transforms in
  the extracted core (rules-test harness compatibility precedent).
- Stale `functions/lib/` causes fake failures — rebuild before trusting
  emulator output.

## Red-first test

New policy test file fails before the module exists. Cover: escalation
field derivation (count increment, previous-responder append), payload
construction with omitted optionals, rejection of invalid transitions.

## Out of scope

- Changing escalation semantics, deadlines, notification copy, or the
  `withIdempotency` wrapper itself; `dispatchResponder`/`cancelDispatch`.

## Verification

- `npx vitest run src/domains/dispatches/__tests__/redispatch-report.unit.test.ts src/domains/dispatches/__tests__/redispatch-policy.test.ts` (from `functions/`)
- `firebase emulators:exec --only firestore,database 'npx vitest run src/domains/dispatches'` (from `functions/`)
- `pnpm --dir functions exec tsc --noEmit && pnpm --dir functions exec eslint src`; fallow audit gate passes
