# RF-08 — Dedupe Functions Test Scaffolding (Batched)

**Priority:** P2 (the single largest duplication mass: fallow attributes
most of the repo's 20.7% duplication to test/spec files, with
`functions/src` the top directory — copy-pasted emulator setup and seed
fixtures drift independently and have already caused stale-assumption bugs)

**Goal:** Shared test helpers for the functions domain suites (env setup,
seed builders, common assertions) so each new domain test starts from
helpers instead of a copied 100-line preamble. Executed as repeated small
batches — one domain directory per branch, this doc governs all batches.

## Recon facts (2026-06-12 — re-verify per batch)

- Scope each batch with fallow, not intuition:
  `fallow dupes --format json --quiet --top 20 2>/dev/null || true` and pick
  the largest clone group whose members all live under one
  `functions/src/domains/<domain>/__tests__/` directory.
- Known repeated blocks: rules-test env creation, report/dispatch seed docs
  (severity defaults! seeded reports without explicit severity get
  `severityDerived: medium` → 15-minute SLA), RTDB shift/index setup,
  idempotency replay assertions.

## Files (≤3 per batch)

- `functions/src/__tests__/helpers/<area>.ts` (new or extended — e.g.
  `seed-report.ts`, `dispatch-env.ts`)
- The batch's test files (replace inlined copies with helper calls)
- No production source files — ever, in this slice.

## Design constraints

- Behavior-neutral on coverage: per-file test counts identical before/after;
  a batch that "passes" by executing fewer tests is a failed batch
  (learnings.md: focused emulator runs can report success while running
  zero tests — check the counts in the output).
- Emulator guards must be settled before Vitest registers tests: helpers
  use top-level await/static env, runtime `skip(...)` inside test bodies —
  never collection-time `itif(available)`.
- Helpers take explicit overrides (`createSeedReport({ severity: 'high' })`)
  — no hidden defaults that mask SLA/severity assumptions.
- Never mix Admin SDK and Client SDK Firestore calls in one rules-test
  context.

## Red-first test

Per batch: run the target suite, record exact pass counts. After helper
adoption, the same command must show the same counts. Helper modules with
logic (seed builders) get their own small unit test that fails before the
helper exists.

## Out of scope

- App-level test dedup (admin/citizen/responder — separate future batches);
  weakening or merging assertions; production code; new test frameworks.

## Verification (per batch)

- `firebase emulators:exec --only firestore,database,storage 'npx vitest run src/domains/<domain>'` (from `functions/`) — same pass counts as the pre-batch baseline, 0 newly skipped
- `fallow dupes --format json --quiet 2>/dev/null | head -50 || true` — the batch's clone group gone or shrunk
- `pnpm --dir functions exec tsc --noEmit && pnpm --dir functions exec eslint src`; fallow audit gate passes
