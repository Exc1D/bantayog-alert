# RF-03 — Decompose `buildIncidents` (Worst Function in the Repo)

**Priority:** P2 (cognitive 48, cyclomatic 19 — the highest cognitive
complexity fallow reports anywhere; it is the citizen map's data path, so a
2 AM incident reader will meet it)

**Goal:** `buildIncidents` in
`apps/citizen-pwa/src/hooks/usePublicIncidents.ts` (line 66) becomes a thin
loop over small, individually tested pure helpers; fallow no longer reports
it as a critical finding.

**Ordering:** Execute after rf-02 — the shared guard extraction already
removes part of this function's bulk.

## Recon facts (2026-06-12 — re-verify before editing)

- File is 149 LOC; the complexity is concentrated in per-doc validation,
  field mapping/derivation, and filter handling inside one closure.
- Safety net exists: `apps/citizen-pwa/src/hooks/usePublicIncidents.test.ts`.
  Read it first; if it does not pin the mapping behavior (malformed doc
  skipped, ordering, filter application), add characterization tests BEFORE
  refactoring.
- Use `fallow health --file apps/citizen-pwa/src/hooks/usePublicIncidents.ts --format json --quiet 2>/dev/null || true`
  before and after for the score delta.

## Files (≤3)

- `apps/citizen-pwa/src/hooks/usePublicIncidents.ts` (decompose)
- `apps/citizen-pwa/src/hooks/public-incident-mapping.ts` (new — pure
  helpers: doc → `PublicIncident | null`, filter predicate)
- `apps/citizen-pwa/src/hooks/public-incident-mapping.test.ts` (new)

## Design constraints

- Behavior-neutral. Per learnings.md: filter invalid stored/snapshot items
  individually — one malformed doc must never discard the whole array.
- Pure-policy-first pattern (the DeclareAlertModal/ProfileTab precedent):
  extract pure functions with focused tests, keep the hook as orchestration.
- No new abstractions beyond the extracted functions — no mapper classes,
  no config-driven validation.

## Red-first test

New mapping test file fails before the module exists. Cover: valid doc maps
fully; malformed doc returns null (not throw); filters include/exclude
correctly; result ordering preserved.

## Out of scope

- Changing query shape, Firestore reads, or filter semantics; MapTab UI;
  `useIncident` (single-doc path stays as-is after rf-02).

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/hooks/public-incident-mapping.test.ts src/hooks/usePublicIncidents.test.ts`
- fallow health on the file: `buildIncidents` no longer in critical findings
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
