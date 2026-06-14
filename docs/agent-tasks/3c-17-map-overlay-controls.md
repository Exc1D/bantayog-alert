# 3C-17 — Map Overlay Controls: Remove the Dead Toggles

**Priority:** P1 (false-authority control — the clearest "clickable no-op" in the
admin app)

**Status:** Doc only (not implemented). Frontend-only; no backend, no rules, no
schema.

**Origin:** `docs/admin-control-contract.md` finding **N1**. The entire
`MapOverlayControls` panel on `/map` flips `activeOverlays` (Zustand store + URL)
but **no map layer reads it** — `ProvincialMap` renders unfiltered `reports` and
`IncidentLayer` never sees `activeOverlays`. Two of the toggles ship hint copy
that promises data the map does not draw ("Live GPS positions of active
responders", "Density visualization of incident locations"). This is exactly the
memo's concern: a control that looks like power and delivers none.

**Goal:** Make every visible overlay control true. Implement the one toggle that
is cheap to make real (the All / Active Only incident filter) and **remove** the
three that have no backing layer (Heatmap, Responder Locations, Municipal Labels)
rather than ship checkboxes that lie.

## Recon facts (verified 2026-06-14, re-verify before editing)

- `apps/admin-desktop/src/components/MapOverlayControls.tsx`
  - Segmented `PRIMARY_OPTIONS`: `all_incidents` (`:12`), `active_only` (`:13`).
  - `CHECKBOX_OPTIONS`: `heatmap` + hint "Density visualization of incident
    locations" (`:17`); `responder_locations` + hint "Live GPS positions of
    active responders" (`:19`); `municipal_labels` + hint "Boundary lines and
    municipality names" (`:24`).
  - `onToggleOverlay(overlayId)` is the only output (`:7`); checkbox handlers
    call it at `:84`/`:121`, the segmented handler at `:38`/`:39`.
- `apps/admin-desktop/src/stores/commandCenterStore.ts`: `activeOverlays:
Set<string>` initialized `new Set(['all_incidents'])` (`:71`); `toggleOverlay`
  mutates the set (`:94`–`:99`). **No consumer outside the store + the toggle UI
  reads it.**
- `apps/admin-desktop/src/components/ProvincialMap.tsx`: `interface Props` is
  `{ reports, selectedReportId, onPinClick }` (`:6`–`:15`) — it does **not**
  accept `activeOverlays` or `responders`. It renders `<IncidentLayer
reports={reports} … />` unconditionally (`:23`–`:24`).
- `apps/admin-desktop/src/pages/MapPage.tsx`: renders `<ProvincialMap reports=…>`
  (`:322`) with the full report list and `<MapOverlayControls … />` (`:340`). The
  page already holds the report array it would filter.
- `learnings.md` (UX): _"Do not conditionally remove action regions; it reads as
  silent failure"_ — note this is about **hiding working actions on state
  change**, not about deleting a control that never worked. Removing a dead
  control is the opposite of a silent failure: it stops the lie.

## Approach (recommended: make one real, delete the other three)

- **All / Active Only (make real).** This needs no new map layer — it is a filter
  over data already in scope. In `MapPage`, derive the list passed to
  `ProvincialMap` from `activeOverlays.has('active_only')`: when active-only is
  on, pass only reports in active lifecycle states; otherwise pass all. The
  segmented control then visibly changes the pins, which is what it claims.
- **Heatmap / Responder Locations / Municipal Labels (remove).** Each would
  require a whole new Leaflet layer (density raster, live RTDB GPS layer,
  boundary GeoJSON) — net-new features, not bug fixes, and out of this slice
  (YAGNI). Delete the three `CHECKBOX_OPTIONS` entries and their render block so
  the panel only shows controls that do something. Drop the now-unused checkbox
  rendering path.
- Leave `activeOverlays` in the store (it still backs `all_incidents`/
  `active_only` and the URL sync). Do **not** invent a `responders`/heatmap prop
  on `ProvincialMap` just to satisfy a deleted toggle.

If a reviewer wants the responder-GPS or heatmap layer built for real, that is a
separate, larger slice (new map layer + scoped data listener + tests) — capture
it as a future `3c-NN`, do not smuggle it in here.

## Files (≤3 + tests)

- `apps/admin-desktop/src/components/MapOverlayControls.tsx` (modify) — remove the
  three dead checkbox options and their render path; keep the segmented filter.
- `apps/admin-desktop/src/pages/MapPage.tsx` (modify) — filter the `reports` array
  passed to `ProvincialMap` on `active_only`.
- Test file(s) below.

## Red-first tests

- `MapPage` test (`vi.mock('../app/firebase', () => ({ db: {} }))` per 3c-00 rule
  6): with a mix of active and resolved/closed reports loaded, toggling **Active
  Only** reduces the pins/markers handed to `ProvincialMap`; toggling back to
  **All** restores them. Fails today because filtering does not happen.
- `MapOverlayControls` test: the Heatmap / Responder Locations / Municipal Labels
  checkboxes are **absent**. Fails today because they render.

## Out of scope

- Building a real heatmap, responder-GPS, or municipal-boundary layer (each is a
  separate feature slice). Changing `commandCenterStore`'s overlay model beyond
  what removal requires. The Map reject defect (that is **3c-18 / N2**). Any
  backend/rules/index/schema/deploy change.

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/pages/MapPage.test.tsx src/components/MapOverlayControls.test.tsx`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
