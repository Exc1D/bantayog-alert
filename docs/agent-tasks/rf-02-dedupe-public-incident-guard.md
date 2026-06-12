# RF-02 — Dedupe the `isPublicIncidentData` Type Guard

**Priority:** P2 (two hand-maintained copies of the citizen map's data
validation boundary; a field added to one and not the other silently drops
incidents from one surface)

**Goal:** One shared `isPublicIncidentData` guard module consumed by both
`usePublicIncidents` and `useIncident`; the copies deleted.

## Recon facts (2026-06-12 — re-verify before editing)

- Duplicate definitions: `apps/citizen-pwa/src/hooks/usePublicIncidents.ts:10`
  and `apps/citizen-pwa/src/hooks/useIncident.ts:41`, both typed
  `value is Omit<PublicIncident, 'id'>` (cyclomatic 22 — it is a long field
  checklist, which is fine for a guard; the problem is the copy, not the
  branching).
- `PublicIncident` lives in `apps/citizen-pwa/src/components/MapTab/types.ts`.
- Existing test: `apps/citizen-pwa/src/hooks/usePublicIncidents.test.ts`.
  Check whether `useIncident` has its own test file; if not, the new guard
  test is its safety net.
- Confirm the two copies are byte-identical or note every difference before
  merging them — a divergence is a latent bug to surface, not silently pick
  one side of.

## Files (≤3)

- `apps/citizen-pwa/src/hooks/public-incident-guard.ts` (new — the guard +
  its focused field checks; app-local, NOT shared-validators: only
  citizen-pwa consumes it)
- `apps/citizen-pwa/src/hooks/usePublicIncidents.ts` + `useIncident.ts`
  (delete local copies, import the shared one)
- `apps/citizen-pwa/src/hooks/public-incident-guard.test.ts` (new)

## Design constraints

- Behavior-neutral: accepted/rejected payload sets must be identical before
  and after. No new fields, no loosening.
- Match local file-naming convention in `hooks/` if it differs from
  kebab-case.

## Red-first test

New guard test file fails before the module exists (`Cannot find module`).
Cover: a valid payload passes; each required-field omission fails; a
malformed visibility/status value fails.

## Out of scope

- Decomposing `buildIncidents` (rf-03); touching MapTab rendering; any
  change to what the guard accepts.

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/hooks/public-incident-guard.test.ts src/hooks/usePublicIncidents.test.ts`
- `grep -rn "function isPublicIncidentData" apps/citizen-pwa/src` → exactly one definition
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
