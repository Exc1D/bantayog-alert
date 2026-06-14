# 3C-21 — Municipality Drill-Down (Dashboard → Map)

**Priority:** P2 (low-severity dead code + a silently-broken drill-down; no data
risk, but two controls imply a capability that does not work).

**Status:** Doc only (not implemented). Frontend-only; no backend, no rules, no
schema.

**Origin:** `docs/admin-control-contract.md` finding **N6** — plus **N7**,
discovered while re-verifying N6's recon. "Drill into a municipality from the
Dashboard" is one user capability with two delivery paths, and **both are
broken**:

- **N6 (dead window-sync branch):** the `select:municipality` cross-window
  message handler on the Map is an empty branch (comment only). For separate
  Dashboard/Map browser windows, selecting a municipality in one does nothing in
  the other.
- **N7 (URL param mismatch):** the Dashboard municipality-row click — rated
  **Real** in the contract — navigates `/map?municipality=…`, but `useUrlSync`
  reads `?municipalityId=`. The param names disagree, so the Map never selects
  the municipality. Same-window row-click drill-down silently fails today.

**Goal:** Clicking a municipality on the Dashboard actually selects it on the Map
(populating the existing `MunicipalPerformance` panel), whether the Map is the
same window (route param) or a separate window (cross-window sync) — or, if
multi-window municipality sync is deemed unwanted, the dead branch and its unused
message type are removed. Either way, no control is left implying drill-down it
does not perform.

## Recon facts (verified 2026-06-14, re-verify before editing)

- `apps/admin-desktop/src/pages/MapPage.tsx`
  - The cross-window receiver (`:121`–`:131`) handles `select:report` by calling
    `selectReport(msg.reportId)` (`:124`), but the `select:municipality` branch
    (`:126`–`:129`) is **empty** — only a comment: _"Municipality selection on map
    centers the map; drill-down data not yet available without a lookup helper."_
  - **The comment is stale.** `selectMunicipality` is already destructured in scope
    (`:58`) and already used elsewhere in the file (`:369`). `selectedMunicipalityId`
    already drives the `municipalityData` memo (`:111`–`:118`,
    `reports.filter(r => r.municipality === selectedMunicipalityId)`), which renders
    the `MunicipalPerformance` panel. So the "drill-down data" already exists — one
    call to `selectMunicipality(msg.municipalityId)` makes the branch real, exactly
    mirroring the `select:report` line above it. No lookup helper is needed.
  - `useUrlSync` is wired with `onMunicipalityIdChange: selectMunicipality` and
    `municipalityId: selectedMunicipalityId` (`:64`–`:69`).
- `apps/admin-desktop/src/hooks/useUrlSync.ts`
  - Reads `searchParams.get('municipalityId')` (`:40`) and writes the same key
    (`:66`). It does **not** read `municipality`.
- `apps/admin-desktop/src/pages/DashboardPage.tsx`
  - Municipality row click: `void navigate('/map?municipality=${encodeURIComponent(municipality)}')`
    (`:638`) — wrong key (`municipality`, not `municipalityId`). Grep confirms **no
    code reads `?municipality=`** anywhere; only `?municipalityId=` is read.
- `apps/admin-desktop/src/stores/commandCenterStore.ts`
  - `SyncMessage` union includes `{ type: 'select:municipality'; municipalityId: string;
source: 'dashboard' | 'map'; id? }` (`:15`–`:20`).
- `apps/admin-desktop/src/providers/WindowSyncProvider.tsx`
  - `VALID_MESSAGE_TYPES` includes `'select:municipality'` (`:15`).
- **No production code sends `select:municipality`.** The only `sendSync(...)` call
  in non-test source is `select:report` from `MapPage.tsx:137`. So the N6 branch is
  doubly dead: empty receiver **and** no sender. Implementing N6 fully would also
  require a Dashboard sender (a `sendSync({ type: 'select:municipality', … })` on row
  click) if cross-window sync is the chosen path.
- `learnings.md`: _"Window-sync dedup needs `crypto.randomUUID()` plus an in-memory
  TTL map."_ Any new `sendSync` must follow the existing `select:report` dedup
  pattern (`setSuppressNextBroadcast(true)` before send — `MapPage.tsx:136`).

## Approach (recommended: make the row-click path real; decide N6 explicitly)

Two independent fixes; do both so the capability is actually true:

1. **N7 — fix the row-click param (required, one line).** Change
   `DashboardPage.tsx:638` to `/map?municipalityId=${encodeURIComponent(municipality)}`
   so `useUrlSync` (`:40`) picks it up and calls `selectMunicipality`. Confirm the
   identifier passed (the dashboard `municipality` value) is the same id space that
   `r.municipality` / `selectedMunicipalityId` compare against (`MapPage.tsx:113`);
   if the dashboard passes a display name while reports key on an id, that
   normalization is part of this fix, not a separate slice.
2. **N6 — decide and either implement or remove (pick one, state it in the PR):**
   - **Make real (recommended if multi-window is in scope):** fill the empty branch
     with `selectMunicipality(msg.municipalityId)`, mirroring the `select:report`
     handler, **and** add the Dashboard sender (`sendSync({ type:
'select:municipality', municipalityId, source: 'dashboard' })` on row click,
     guarded by the existing suppress-next-broadcast dedup). Drop the stale comment.
   - **Remove (recommended if multi-window municipality sync is YAGNI):** delete the
     empty branch, the `select:municipality` member from the `SyncMessage` union
     (`commandCenterStore.ts:15`–`20`), and its entry in `VALID_MESSAGE_TYPES`
     (`WindowSyncProvider.tsx:15`). Update/remove the synthetic
     `cross-window-sync.test.tsx` cases that exercise it. The row-click path (fix 1)
     remains the supported drill-down.

Map-centering (pan/zoom the Leaflet map to the municipality) is **out of scope** —
that needs a centroid lookup (a new data dependency), like the deferred overlay
layers in 3c-17. Selecting the municipality (which populates the existing
performance panel) is the truthful minimum.

## Files (≤3 + tests)

- `apps/admin-desktop/src/pages/DashboardPage.tsx` (modify) — N7: correct the
  navigate param to `municipalityId` (and add the sender if N6 is implemented).
- `apps/admin-desktop/src/pages/MapPage.tsx` (modify) — N6: implement the
  `select:municipality` branch, **or** leave untouched if N6 is the "remove" path
  (then edit `commandCenterStore.ts` + `WindowSyncProvider.tsx` instead — choose the
  pair that keeps the slice ≤3 source files).
- Test file(s) below.

If the chosen N6 path + N7 would touch more than 3 source files, ship N7 (the
broken row-click) first as the priority and split N6 into a follow-up — the
row-click is the path users actually exercise.

## Red-first tests

- **N7:** a Dashboard test asserting the municipality row click navigates to a URL
  carrying `municipalityId=` (not bare `municipality=`). Fails today
  (`vi.mock('../app/firebase', () => ({ db: {} }))` per 3c-00 rule 6).
- **N6 (make-real path):** a `MapPage` test that delivering a synthetic
  `select:municipality` message from `source: 'dashboard'` selects that municipality
  (assert the `MunicipalPerformance` panel renders for it / `selectMunicipality` was
  called). Fails today because the branch is empty.
- **N6 (remove path):** assert `select:municipality` is no longer a valid sync
  message type (and the dead branch is gone). The existing
  `cross-window-sync.test.tsx` municipality cases must be updated accordingly.

## Out of scope

- Map-centering / pan-zoom to a municipality (needs centroid data — a separate
  feature slice). The overlay panel (3c-17) and Map reject (3c-18). Any change to
  `select:report` behavior, the window-sync transport, dedup mechanism, or any
  backend/rules/index/schema/deploy.

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/pages/MapPage.test.tsx src/pages/DashboardPage.test.tsx src/__tests__/cross-window-sync.test.tsx`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
