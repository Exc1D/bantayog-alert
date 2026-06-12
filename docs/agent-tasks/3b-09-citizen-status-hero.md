# 3B-09 — Citizen Status Hero (Human-Readable Tracking Lead)

**Priority:** P1 (the tracking page leads with the raw status enum — the
single weakest emotional moment in the citizen loop)

**Goal:** The own-report DetailSheet leads with a human status hero — large
plain-language message, one-line explanation, what-happens-next guidance,
last-updated time — so a stressed citizen understands the situation before
reading the technical timeline. Today the headline renders
`report.status.replace(/_/g, ' ')` (DetailSheet.tsx ~line 286): a citizen
literally sees "fire · awaiting verify".

## Files (≤3)

- `apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx` (replace the raw
  status headline with the hero; keep the existing timeline below it)
- `apps/citizen-pwa/src/components/MapTab/DetailSheet.test.tsx` (extend)
- (only if the copy map grows past ~40 lines) extract a pure
  `citizen-status-copy.ts` module next to the component so the map is
  unit-testable without rendering

## Design constraints

- Status → message map covers every `MyReport` status the existing
  `buildTrackingTimeline` handles. Anchor copy (adjust to fit, keep the
  register calm and factual — no exclamation points, no gamification):
  - queued/draft_inbox: "Saved on this phone" / "It will send automatically
    when you are back online."
  - new/awaiting_verify: "Your report was received" / "An operator is
    checking the details. You do not need to submit again unless the
    situation changes."
  - verified: "Your report was verified" / "It is now being handled."
  - assigned/acknowledged: "A responder has been assigned" / "Please stay
    safe and avoid the affected area."
  - en_route: "Help is on the way" (matches the 3A-03 push copy — keep them
    identical)
  - on_scene: "Responders are at or near the area"
  - resolved/closed: closure variant — "This report was resolved" plus the
    submitted→resolved span derived from `submittedAt`/`lastStatusAt`
    ("Reported 2:18 PM, resolved 3:01 PM"). This is the emotional payoff
    that makes a citizen report again; treat it as a designed terminal
    state, not a grey label.
  - rejected: "This report could not be verified" — factual, no blame; the
    existing terminal timeline copy stays.
  - cancelled/merged: reuse the existing withdrawal/merge terminal copy.
- Hero shows `Updated <timeAgo>` using the existing `updatedMeta` logic and
  keeps the tracking-code block exactly where it is.
- Citizen-safe only: never surface responder identity, internal notes, or
  ops-only fields. Severity chip and timeline remain unchanged below.
- No new dependencies, no backend or rules changes, no layout system
  changes — this is copy + one component within the existing sheet.

## Red-first test

Extend DetailSheet tests: for an `en_route` own report, assert the sheet
renders "Help is on the way" and does NOT render the raw enum text
("en route" as the headline). Must fail before the change.

## Out of scope

- Map-tab situational headline (3B-11), readiness card (3B-10), resolved
  feedback prompt (3B-05 — the hero's resolved variant is where 3B-05's
  prompt will attach later, do not build the prompt here), push copy
  changes, localization (3X-LOC gate).

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/components/MapTab/DetailSheet.test.tsx`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
