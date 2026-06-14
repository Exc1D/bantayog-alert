# 3C-16 — Dashboard Coverage Truth-Gate

**Priority:** P1 (data-integrity defect — independent, can land in parallel)

**Status:** Doc only (not implemented). Frontend-only; no backend, no rules, no
schema.

**Goal:** Stop the Dashboard from showing a **false "uncovered municipalities"
count**. `getUncoveredMunicipalityCount` reads `municipality.activeResponders`, a
field `buildMunicipalData` never populates, so the value is always `undefined ??
0 === 0` and **every** municipality with activity is counted as uncovered. The
StatusBar metric is alarmist noise: it never reflects real coverage.

## Recon facts (verified 2026-06-13, re-verify before editing)

- `apps/admin-desktop/src/pages/DashboardPage.tsx`: `getUncoveredMunicipalityCount`
  filters municipalities where `(municipality.activeResponders ?? 0) === 0`.
- `buildMunicipalData` returns rows shaped `{ activeIncidents, municipality }` and
  **never sets `activeResponders`** → the predicate is always true.
- The Dashboard already loads responder data via `useResponderFleet(db)` (available
  - active responders, with `municipalityId`/`agencyId` per member) and renders a
    `MunicipalPerformanceTable`. So a real per-municipality available-responder count
    is derivable from data already in scope.
- `learnings.md` (UX): _"Truth-gate derived live fields: make uncertain data
  optional and render a clear fallback."_

## Approach (recommended: derive real coverage; fall back to removal)

Prefer **A**; do **B** only if A is not cheaply correct:

- **A — Derive it honestly.** Compute available-responder counts per municipality
  from the `useResponderFleet` members already loaded, populate `activeResponders`
  on the municipal rows, and let `getUncoveredMunicipalityCount` mean what it says.
  Note the caveat: `useResponderFleet` is available+active only, which is exactly
  the right denominator for "covered right now," but agency_admin/municipal scoping
  means a single operator may not see every agency's responders — so the count is
  "uncovered **in your scope**." Label it accordingly.
- **B — Remove the metric.** If a correct count is not derivable from in-scope data
  (e.g. scoping makes it misleading), delete the `uncoveredMunicipalities` StatusBar
  field rather than show a fabricated number. A missing metric beats a false one.

Decide A vs B in-slice based on whether the derived number is provably correct for
the operator's scope. Record the decision in the progress entry.

## Files (≤3)

- `apps/admin-desktop/src/pages/DashboardPage.tsx` (modify) — fix
  `buildMunicipalData`/`getUncoveredMunicipalityCount` (A) or remove the field (B).
- The StatusBar component (modify) — only if copy/label changes (A) or the field
  is removed (B).
- Test file below.

## Red-first test

- Dashboard test: with municipalities that **do** have available responders in the
  loaded fleet, the uncovered count is **not** all of them (today's bug: it is).
  For **A**, assert the count equals municipalities with zero in-scope available
  responders. For **B**, assert the field is gone. Mock the data hooks;
  `vi.mock('../app/firebase', () => ({ db: {} }))`.

## Out of scope

- Responder roster work (3C-13..15) — related but separable; this slice only fixes
  the count's data source. New backend coverage data. Changing `useResponderFleet`.
  Rules/index/schema/deploy.

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run` (the Dashboard test file touched)
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
