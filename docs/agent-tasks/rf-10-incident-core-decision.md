# RF-10 — Decide the Fate of the Speculative `incident-core` Layer

**Priority:** P2 (carrying cost: a large untyped-by-runtime contract module
plus its test bulk inside shared-validators, maintained but consumed by
nothing)

**Gate:** User decision required — Option A or B below. The executing agent
implements the chosen option only.

**Goal:** `packages/shared-validators/src/incident-core.ts` either has a
recorded reason to exist or is removed; no third state.

## Recon facts (2026-06-12 — re-verify before editing)

- Consumers of `incident-core`: only shared-validators' own barrel
  (`src/index.ts`) and its own test (`src/incident-core.test.ts`), plus
  generated `lib/` output. No app, functions, or e2e import — verify:
  `grep -rln "incident-core\|IncidentCore\|publicIncidentCard" apps functions e2e-tests --include='*.ts*' | grep -v node_modules`
  (note: citizen-pwa's `PublicIncident` in `MapTab/types.ts` is unrelated —
  do not confuse them).
- History: built 2026-06-07 as greenfield Incident/PostGIS contracts.
  The 2026 roadmap explicitly takes PostGIS runtime migration off the table
  for 2026. Branch `codex/incident-core-contracts` preserves the work.

## Option A — Remove (recommended)

YAGNI: zero consumers, the runtime it was designed for is deferred past
2026, and git preserves it perfectly. Removal per learnings.md full-surface
rule: `src/incident-core.ts`, `src/incident-core.test.ts`, the barrel
export line in `src/index.ts`, generated `lib/incident-core*` output; then
rebuild shared-validators (its `exports` point at `lib`).

**Files (≤3):** the two source files + `src/index.ts` (lib output is
generated).

**Red-first:** delete the barrel export first, build all consumers
(`pnpm build` + `pnpm typecheck` at root) — green build proves nothing
imported it; then delete the files.

## Option B — Keep as documented future contracts

No code change. Add an ADR (`docs/architecture/`) stating: incident-core is
inert until the post-2026 greenfield resumes, it must gain no new schemas
until a consumer exists, and rf-11 must treat it as frozen. This converts
"speculative" into "explicitly parked".

## Out of scope

- Any other shared-validators schema; PostGIS SQL under `infra/postgres/`
  (separate, already-approved artifacts); rf-11's consolidation.

## Verification

- Option A: `pnpm --dir packages/shared-validators exec vitest run` green;
  root `pnpm build && pnpm typecheck && pnpm test` green; the grep above
  stays empty; stale `lib/incident-core*` files confirmed absent after
  rebuild (learnings.md: remove stale lib output after renames/removals).
- Option B: ADR exists, linked from the ADR index; no runtime diff
  (`git diff --stat` shows docs only).
