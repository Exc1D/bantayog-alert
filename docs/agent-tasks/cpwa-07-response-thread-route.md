# CPWA-07 — Response Thread Route `/track/:id` (U5, §9)

**Priority:** P0 (the spec names §9 tracking the **primary** surface; today it
only lives inside the Map's `DetailSheet`. This is the structural heart of the
revamp.)

**Depends on:** cpwa-01 (status registry for the stepper), cpwa-02 (the
`/track/:id` route placeholder + `hideBottomNav` must already be registered).

**Goal:** Turn the cpwa-02 `ResponseThread` placeholder into the real
single-scroll tracking surface: **sticky §9.4 header → §9.2 five-stage stepper →
§9.8 dated narrative**. This becomes the one convergence point for every
own-report entry (Home "Your Report", Profile list, `ReportStatusPill`, Map
marker, notification tap).

## Recon to re-verify before editing

- `apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx` — the private inline
  `buildTrackingTimeline(report: MyReport): TrackingEvent[]` (~line 360) is the
  logic to **extract** into a shared module, then **remap to the §9.2 five
  groups** (saved/sending · received · being reviewed · response coordinated ·
  addressed/closed) plus the terminal not-accepted variant. Read it fully before
  moving it — preserve its existing terminal-state handling.
- The own-report data source (`useMyActiveReports` / the `MyReport` shape). The
  route loads one report by `:id` from the source already mounted; **do not add a
  new Firestore read** if the existing hook already has the report.
- cpwa-01 `operationalStage` axis — the stepper renders each stage from the
  registry (icon + label + token), which is exactly why cpwa-01 is a dependency.
- The 3B-09 status-hero copy already specified for own-report stages — reuse that
  copy register; `en_route` must stay "Help is on the way" (matches the 3A-03
  push). Do not re-invent the wording.

## Files (≤3)

- `apps/citizen-pwa/src/components/ResponseThread/index.tsx` (new — the route
  component: sticky header + stepper + narrative)
- `apps/citizen-pwa/src/utils/tracking-timeline.ts` (new — extracted from
  DetailSheet, remapped to §9.2 five groups; pure, unit-testable)
- `apps/citizen-pwa/src/utils/tracking-timeline.test.ts` (new — red-first)

(`DetailSheet.tsx` re-points to the extracted helper in **cpwa-08**, not here, to
keep this slice ≤3 files. If the import swap is trivial it may ride along, but the
sheet's demotion to a peek is cpwa-08's concern.)

## Design constraints

- **§9.2 five grouped stages**, tappable to progressively disclose the finer
  Layer-C states (verified / assigned / acknowledged / en route / on scene)
  **without fabricating progress (§9.6)** and **without inferring transitions
  (§5.6)** — only render a stage as reached if the report's state proves it.
- **Sticky §9.4 header:** report identity + tracking code + current stage at a
  glance; stays pinned through the scroll.
- **§9.8 dated narrative:** chronological, plain-language, citizen-safe — never
  responder identity, internal notes, or ops-only fields (same boundary as the
  existing timeline).
- **Two signals (§14.3)** on every stage via cpwa-01; resolved is a designed
  terminal payoff (the emotional close), not a grey label; not-accepted is
  factual, no blame.
- `hideBottomNav` (already on the route) — full-height surface, **no dead end**: a
  visible back affordance returns to the entry context.
- Pure timeline module: no React/DOM/I/O; unknown status → defined non-throwing
  default. `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` — guard lookups.

## Red-first test

`tracking-timeline.test.ts` (fails before the module exists):

- a report at each lifecycle status maps to the correct §9.2 group with the
  finer Layer-C sub-state available but **no later group marked reached** (proves
  §9.6 no-fabrication);
- a terminal not-accepted report renders the terminal group, not a stalled
  "pending responder" path;
- an unknown/garbage status returns the default group without throwing.

## Out of scope

- Demoting `DetailSheet` to a peek + repointing `ReportStatusPill` / Map marker /
  Profile / Home / notifications (cpwa-08).
- The Map's alert-zone layer (cpwa-09).
- Any backend/projection change — this reads the same `MyReport` the sheet reads.

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/utils/tracking-timeline.test.ts`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
