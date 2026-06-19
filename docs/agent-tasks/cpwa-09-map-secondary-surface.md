# CPWA-09 — Map Secondary Surface (alert zones + entry-point coherence) (U4, U6)

**Priority:** P2 (finishes the Map's reduced role; the loop already works without
it once Home + Response Thread land)

**Depends on:** cpwa-01 (status tokens for the zones layer), cpwa-02 (`/map`
exists as a deliberate destination, not the index).

**Goal:** Make `/map` a coherent **secondary spatial situational-awareness**
surface rather than the demoted former home screen: public incident pins +
**official alert / affected-area zones** + own-report pins, all reading the cpwa-01
status tokens, with Home "Nearby" deep-linking into it.

## Recon to re-verify before editing

- `apps/citizen-pwa/src/components/MapTab/` — current layers (pins, the now-peek
  `DetailSheet` from cpwa-08). Re-confirm what zone/affected-area data the app
  already has from the active-alert source before adding a layer; **reuse the
  existing alert source, add no new listener.**
- Whether affected-area geometry already exists on the alert documents the app
  reads. **If alerts carry no zone geometry, this slice ships only the
  entry-point coherence + token alignment, and the zones layer is deferred** (it
  would otherwise need a backend/projection change — an escalation, not a slice,
  per index rule 4). Do not invent geometry.
- cpwa-04 Nearby card — add the deep-link from a Nearby item to `/map` focused on
  that incident (reuse the existing map-focus/`reportId`-in-URL mechanism;
  learnings.md notes MapTab has no URL-driven selection contract yet, so if none
  exists, scope this to centering on the municipality, not auto-opening a pin).

## Files (≤3)

- `apps/citizen-pwa/src/components/MapTab/...` (add the alert-zones layer **iff**
  geometry exists; otherwise just align pin/legend tokens to cpwa-01)
- `apps/citizen-pwa/src/components/HomeTab/modules/NearbyCard.tsx` (deep-link into
  `/map`)
- a focused test file for whichever of the two actually changes (red-first)

## Design constraints

- **Reuse the teal system (U6)** extended with cpwa-01 status tokens — extend,
  never replace `#0d7377`. Zones/pins/legend all read the registry so the Map's
  status language matches Home and the Response Thread (one status vocabulary
  across surfaces — the whole point of cpwa-01).
- **Two signals (§14.3):** pins and zones carry icon/shape + label, not color
  alone (especially important on a map where color overload is easy).
- **Entry-point coherence (no dead ends):** Nearby → `/map` lands somewhere
  meaningful (focused incident or at least the right municipality), and the peek
  still deep-links out to `/track/:id` / `/incidents/:id` (cpwa-08). The Map is a
  hub that always offers a next step.
- **Truth-gate (§5):** no fabricated zones; render only confirmed
  alert/affected-area data. Missing geometry → no zone, not a guessed circle.
- Do not regress the existing Map dispatch/listener behavior or re-introduce the
  denied RTDB `responder_locations` parent read (learnings.md).

## Red-first test

Whichever changes:

- if the zones layer ships: an alert **with** geometry renders a zone with a
  registry token + label; an alert **without** geometry renders **no** fabricated
  zone (truth-gate);
- the Nearby deep-link routes to `/map` with the expected focus param.
  Must fail before the change.

## Out of scope

- Any backend/projection change to add affected-area geometry (escalation, not a
  slice — defer the zones layer if geometry is absent).
- Migrating remaining `AlertsTab`/`FeedTab` color maps (separate slices).
- Re-expanding the peek into a full tracking surface (cpwa-07 owns tracking).

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run <the touched test file>`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
