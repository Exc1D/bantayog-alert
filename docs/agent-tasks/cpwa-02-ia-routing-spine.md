# CPWA-02 — IA / Routing Migration Spine (U1, U2, B3)

**Priority:** P0 (structural spine — Home content, the Response Thread, and the
Map's new role all land on this; nothing in R2–R4 can start until it exists)

**Depends on:** none structurally. Land before cpwa-03..09.

**Goal:** Move the citizen IA to `Home · Map · Report · Feed · Profile` with Home
at `/` and Map at `/map`, register the new `/track/:id` route, and drop Alerts
from the bottom nav while keeping its route. This slice ships the **shell**: a
minimal `HomeTab` placeholder (header skeleton + empty module slots) so the route
migration is real, testable, and reviewable on its own before content arrives.

## Recon to re-verify before editing (verified 2026-06-19)

- `apps/citizen-pwa/src/routes.tsx`: `index: true` renders
  `<CitizenShell><MapTab/></CitizenShell>`. `lazyWithRetry(factory, 3, 500)` is
  the lazy helper. `handle: { hideBottomNav: true }` is the existing
  nav-hiding mechanism (used by report, incidents/:id, goodbye, register, login,
  settings). `/alerts`, `/feed`, `/profile` are `CitizenShell`-wrapped tabs.
- `apps/citizen-pwa/src/components/CitizenShell.tsx`:
  `TAB_PATHS = ['/', '/feed', '/report', '/alerts', '/profile']`; center Report
  is the elevated `fab-breathe` FAB; `layoutId="navbar-indicator"`; the alert
  unread badge (`badge-shake`) currently sits on the Alerts tab.

## Files (≤3)

- `apps/citizen-pwa/src/components/HomeTab/index.tsx` (new — placeholder shell:
  header region + the §6.3 module slots rendered as labelled skeletons; no data)
- `apps/citizen-pwa/src/routes.tsx` (index → `HomeTab`; add `/map` →
  `CitizenShell > MapTab`; add `/track/:id` → lazy `ResponseThread` with
  `handle: { hideBottomNav: true }` — a thin placeholder component is fine this
  slice, cpwa-07 fills it; keep `/alerts` route as-is)
- `apps/citizen-pwa/src/components/CitizenShell.tsx` (`TAB_PATHS` →
  `['/', '/map', '/report', '/feed', '/profile']`; move the Map nav item in,
  remove the Alerts nav item; relocate the alert unread badge onto the new
  Home-header bell **affordance hook** — wire the count in cpwa-03, but do not
  strand the badge on a removed tab)

## Design constraints

- **No dead ends.** Every previously reachable surface stays reachable: Alerts
  via the route + the Home bell affordance; Map via `/map` and the new nav item.
- Preserve `lazyWithRetry`, `Suspense` fallbacks, `AnimatePresence`
  `PAGE_VARIANTS`, the offline/draft banners, the foreground-alert modal, the
  skip link, and `layoutId="navbar-indicator"` — this is an IA move, not a shell
  rewrite.
- `HomeTab` placeholder must be layout-stable (§14.4): the skeleton slots occupy
  the same boxes the real modules will, so cpwa-03..05 swap content without
  reflow.
- Deep-link integrity: anything currently linking to `/` expecting the map (e.g.
  `ReportStatusPill` navigates to `/`) must be inventoried; if a caller means
  "the map", it is repointed to `/map` **in the slice that owns it** (pill →
  cpwa-08), not silently broken here. List such callers in the PR description.

## Red-first test

Extend/!add `routes`/shell tests:

- rendering the index route shows `HomeTab` (a Home-only test id), **not** the
  Map;
- `/map` renders the Map inside `CitizenShell`;
- the bottom nav exposes exactly Home/Map/Report/Feed/Profile and **not** an
  Alerts tab;
- `/track/:id` renders with the bottom nav hidden.
  All must fail against current `routes.tsx`/`CitizenShell`.

## Out of scope

- Home header content, bell count wiring, and any module data (cpwa-03+).
- Filling `ResponseThread` (cpwa-07). The Map sheet demotion (cpwa-08).
- Animating the Home entrance (cpwa-06).

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run` (focused shell/routes specs)
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
