# 3B-11 — Map Tab Situational Headline

**Priority:** P2 (the map answers "what is happening near me" only by pin
inspection; a one-line interpretation is the cheap high-leverage read)

**Goal:** The Map tab leads with a single plain-language situational line
derived from data already on the client: "Daet is calm. No active alerts."
vs "2 active alerts in your area — tap to view." The citizen gets the felt
meaning before parsing pins.

## Files (≤3)

- `apps/citizen-pwa/src/components/MapTab/index.tsx` (or the header slot the
  recon identifies — render the headline; reuse `useMapTab` data)
- a new pure `situational-headline.ts` helper (input: active alert count +
  visible incident count + selected municipality label; output: one string)
- one test file for the helper

## Design constraints

- Derive ONLY from listeners the Map tab already holds (public alerts +
  visible incidents). No new Firestore queries, no new listeners, no rules
  or index changes.
- Copy register: calm authority, factual counts, no urgency theatrics.
  - Zero alerts, zero visible incidents: "<Municipality> is calm. No active
    alerts."
  - Alerts active: "N active alert(s) for <municipality> — tap Alerts to
    view." (deep-links/tab-switches to the existing Alerts tab; do not
    duplicate alert content on the map)
  - Incidents but no alerts: "N incident(s) reported nearby."
- Truth-gate per learnings.md: if listener state is loading or errored,
  render nothing (no skeleton headline, no stale "calm" claim — a wrong
  "calm" is worse than no headline).
- Stale data: if the existing stale/offline banner is showing, suppress the
  headline rather than contradicting it.
- One line, no card chrome, no icon zoo — it must not push the map or the
  report CTA down meaningfully on a 390px viewport.

## Red-first test

Helper test: zero alerts/incidents yields the calm line with the
municipality label; two alerts yields the count line. A focused render test
asserts the headline is absent while alert state is loading. Must fail
before the helper exists.

## Out of scope

- Status hero (3B-09), Alerts tab changes, new alert queries, weather or
  hazard-feed integration, push, localization (3X-LOC gate).

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/components/MapTab`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
