# CPWA-05 — Home Dynamic Hero (truth-gated, dominant-not-takeover) (B2, U2)

**Priority:** P1

**Depends on:** cpwa-01 (status registry for hazard/severity/freshness),
cpwa-04 (the secondary stack must exist so "hero recedes, stack stays present"
is real, not aspirational).

**Goal:** Build the top "Your Local Brief" hero that swaps between **calm /
incident / alert** states from settled data only. The hero is the one dominant
element on Home but is bounded by the **emergency-hero ceiling**: even at peak it
renders as the dominant in-Home hero **within Home's normal layout — never a
full-screen takeover.** The secondary stack recedes but stays present and
scrollable; Report FAB + nav stay reachable (§14.4).

## Recon to re-verify before editing

- `apps/citizen-pwa/src/components/HomeTab/index.tsx` — the hero slot (top of
  §6.3 order) and the cpwa-04 secondary stack beneath it.
- The existing active-alert source feeding the old Alerts tab + the CitizenShell
  foreground-alert modal. The hero reads the **same** settled alert/incident state
  — it does not introduce a parallel truth. Re-find it; reuse it.
- The CitizenShell foreground-alert **modal** (danger-600/Siren, focus trap). It
  stays the separate interrupt-on-arrival channel — the hero is the _persistent_
  in-Home representation, the modal is the _interrupt_. Do not merge them.
- cpwa-01 `hazardType` / `severity` / `freshness` axes for the hero's status
  rendering.

## Design constraints

- **Three truth-gated states:**
  - **calm:** no active alert/incident affecting the user's area → orienting
    headline + the §6.14 "deliberate ending" copy ("You're caught up through
    7:12 AM", wording settled here — see open seam in index). Calm must **never**
    mean "still loading" or "failed to refresh" (the existing Map situational
    headline truth-gate rule in learnings.md applies verbatim).
  - **incident:** nearby public incident(s) but no official alert → factual
    summary, links to Nearby / Map.
  - **alert:** active official alert for the area → dominant hazard hero, routes
    to `/alerts`.
- **Emergency-hero ceiling (the binding constraint):** alert state is the
  dominant hero **inside Home's scroll**, never a full-bleed route or overlay.
  Secondary stack stays mounted and scrollable; nav + Report FAB stay reachable.
  The modal remains the only full-bleed interrupt. A slice that wants a takeover
  must stop and escalate — it is explicitly rejected in the index.
- **Two signals (§14.3):** hazard hero pairs icon/shape + label + token from
  cpwa-01; color is never alone.
- **No fabricated progress / no inferred state (§5.6, §9.6):** the hero reflects
  only confirmed alert/incident/freshness state.
- **Preserve teal** (U6); hazard palette comes from cpwa-01 tokens.
- Static here — the calm→alert transition is **not** animated in this slice
  (cpwa-06 owns motion). Render correctness first, decorate later.

## Red-first test

Extend the HomeTab test (new `HomeHero.test.tsx`):

- with no active alert and settled data → calm headline + ending copy, **not** a
  loading or error string;
- while alert/incident/own-report state is still loading or errored → hero
  withholds the calm headline (truth-gate);
- with an active official alert → dominant hazard hero (icon + label, registry
  token) that routes to `/alerts`, **and the secondary stack test id is still in
  the document** (proves no takeover).

## Out of scope

- Motion / transitions between states (cpwa-06).
- The resolved-report feedback prompt (3B-05) — the hero's resolved variant lives
  on the Response Thread (cpwa-07), not here.
- Wiring the modal (already exists in CitizenShell — untouched).

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/components/HomeTab/HomeHero.test.tsx`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
