# CPWA-08 — `DetailSheet` → Peek + Deep-Link Out (U4, U5)

**Priority:** P1

**Depends on:** cpwa-02 (the `/map` + `/track/:id` routes), cpwa-07 (the
`/track/:id` surface + the extracted `tracking-timeline.ts` must exist to deep-link
into).

**Goal:** Demote the Map's `DetailSheet` from the tracking _home_ to a **peek**:
a compact glance that deep-links out — own reports → `/track/:id` (cpwa-07),
public incidents → `/incidents/:id` (already exists). Repoint every caller that
treated the sheet (or `/`) as the tracking destination.

## Recon to re-verify before editing

- `apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx` — after cpwa-07,
  `buildTrackingTimeline` lives in `utils/tracking-timeline.ts`. Swap the sheet's
  inline copy for the import (if cpwa-07 didn't already), then strip the full
  timeline body down to a peek (status hero line + "View full response" link).
- `apps/citizen-pwa/src/components/ReportStatusPill.tsx` — currently navigates to
  `/` (the old map-as-index). Re-point to `/track/:id` for the tracked report.
  **This is the deep-link-integrity item cpwa-02 deferred to this slice.**
- Every other own-report tap that currently opens the sheet (Map marker click in
  `MapTab`, any Profile/Home link landing on `/`): inventory and repoint to
  `/track/:id`. Public-incident taps keep going to `/incidents/:id`.
- Confirm `/incidents/:id` (`IncidentDetailPage`) still exists and is public-only.

## Files (≤3)

- `apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx` (demote to peek +
  deep-link buttons)
- `apps/citizen-pwa/src/components/ReportStatusPill.tsx` (navigate to
  `/track/:id`, not `/`)
- `apps/citizen-pwa/src/components/MapTab/DetailSheet.test.tsx` (update/extend —
  red-first for the new peek + routing)

(If the Map marker handler lives in a separate `MapTab/index.tsx`, the repoint may
need that file instead — keep total touched files ≤3; if it spills, split the
caller repoint into a tiny follow-up rather than a 4-file PR.)

## Design constraints

- **Peek, not page** (the learnings.md "1-click inspection = drawer/peek, not
  navigation" rule): the sheet stays a fast glance; the _full_ timeline is one tap
  away at `/track/:id`. Don't duplicate the §9.2 stepper inside the peek.
- **No dead ends / no broken deep links (§ cpwa-02 constraint):** every own-report
  entry resolves to `/track/:id`; every public-incident entry to `/incidents/:id`.
  No caller is left pointing at `/` expecting tracking.
- **Two signals (§14.3):** the peek's status line uses the cpwa-01 registry —
  this finally retires `ReportStatusPill`'s color-only `severityDotColor` dot
  (consume the registry, delete the local color map per index rule 7).
- Citizen-safe peek: status + code + deep-link only; no responder identity / ops
  fields.
- Preserve teal (U6).

## Red-first test

Update `DetailSheet.test.tsx`:

- an own-report peek renders the status (icon + label, registry — not a color-only
  dot) and a "View full response" control that routes to `/track/:id`;
- a public-incident peek routes to `/incidents/:id`;
- `ReportStatusPill` navigates to `/track/:id` (not `/`).
  All must fail before the change.

## Out of scope

- Building `/track/:id` internals (cpwa-07 did).
- The Map's alert-zone layer + Nearby→Map deep-link (cpwa-09).
- Migrating `AlertsTab`/`FeedTab` color maps (their own future slices).

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/components/MapTab/DetailSheet.test.tsx`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
