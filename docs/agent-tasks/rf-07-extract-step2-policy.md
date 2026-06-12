# RF-07 — Extract `Step2WhoWhere.handleNext` Validation Policy

**Priority:** P2 (cyclomatic 21 / cognitive 23 inside a 456-LOC step
component; the who/where validation rules are unreadable inline)

**Goal:** The validation/derivation logic inside `handleNext` in
`apps/citizen-pwa/src/components/SubmitReportForm/Step2WhoWhere.tsx` moves
to a pure, tested policy module; the handler becomes
validate → set errors or advance.

## Recon facts (2026-06-12 — re-verify before editing)

- Map what `handleNext` actually does before extracting: which fields it
  validates (people injured/trapped counts, location confidence,
  municipality/barangay, GPS state), what it derives, and every distinct
  error message. The policy module's API falls out of that list — do not
  design it in advance.
- Canonical municipality/barangay data comes from
  `@bantayog/shared-validators` constants (learnings.md) — do not introduce
  an app-local copy while extracting.
- This is the "extract pure policy first" precedent from the
  DeclareAlertModal refactor: policy module + tests land BEFORE any JSX
  moves.

## Files (≤3)

- `apps/citizen-pwa/src/components/SubmitReportForm/step2-policy.ts` (new —
  pure validation/derivation: form values in, `{ errors } | { next }` out)
- `apps/citizen-pwa/src/components/SubmitReportForm/Step2WhoWhere.tsx`
  (handleNext delegates to the policy)
- `apps/citizen-pwa/src/components/SubmitReportForm/step2-policy.test.ts`
  (new)

## Design constraints

- Behavior-neutral: identical error messages for identical inputs, same
  advance/block decisions. Copy changes are NOT allowed in this slice.
- No side effects in the policy module (no GPS calls, no storage) — those
  stay in the component/hooks.
- Numeric fields under `noUncheckedIndexedAccess`/strict flags: guard
  parsed values explicitly.

## Red-first test

New policy test fails before the module exists. Cover: valid input
advances; each validation rule blocks with its exact current message;
boundary values (zero/negative/non-numeric counts); missing location
confidence.

## Out of scope

- rf-06's container work (coordinate if both land — rebase, do not merge
  concerns); UX/copy changes; Step1/Step3; GPS hook behavior.

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/components/SubmitReportForm/step2-policy.test.ts`
- `pnpm --dir apps/citizen-pwa exec vitest run src/components/SubmitReportForm` (existing suites green, same counts)
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`; fallow audit gate passes
