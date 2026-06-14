# 3C-08 — Publication-Queue Hardening

**Priority:** P1

**Status:** Doc only (not implemented). Frontend-only when built; no backend.

**Goal:** Make the report publication pipeline on `FeedPage` (New / Pending /
Live tabs) safe and legible: confirm destructive/irreversible transitions,
ground the scrub editor in the real backend limit, and let operators find a
report. Today these actions commit instantly with spinner-only feedback and a
copy claim the code does not honor.

## Recon facts (verified 2026-06-13, re-verify before editing)

- `apps/admin-desktop/src/pages/FeedPage.tsx` (771 lines) owns three tabs via
  `activeTab: 'new' | 'pending' | 'live'`. `handleVerify` ("send to
  moderation") and `publishScrubbed` commit with no confirmation; only
  `handleUnpublish` is gated (`confirmUnpublishReport` + ConfirmationModal).
- `publishScrubbed` validates the scrubbed copy as **non-empty only**
  (`FeedPage.tsx:303`). There is no character count and no comparison against
  the real backend description limit.
- `FeedPage.tsx:288` sets `'Some photos failed to load. They will retry
automatically.'` — there is **no** retry path; the copy is false.

## Files (≤3 + tests)

- `apps/admin-desktop/src/pages/feed-queue-filters.ts` (new, pure): a
  `filterPublicationReports(reports, { query, municipalityId?, hazardType? })`
  module — municipality filter for superadmins, hazard-type filter, and a
  text search over report id / summary / place. Pure and unit-tested.
- `apps/admin-desktop/src/pages/FeedPage.tsx` (modify): reuse the existing
  `ConfirmationModal` before send-to-moderation and before publish (the
  publish confirm shows the scrubbed preview); add a live character count on
  the scrub editor against the real backend description limit (import the limit
  from the shared report validator, do not hardcode) plus an "edited from
  original" indicator; wire the filter module above the queue.
- Replace the false media-retry copy with a manual **Retry** button that
  re-runs the media fetch for the affected report.

## Red-first tests

- `feed-queue-filters.test.ts`: query/municipality/hazard matrix, including the
  empty-query passthrough and superadmin-vs-municipal scoping. Fails before the
  module exists.
- Extend `FeedPage` test: send-to-moderation and publish now require
  confirmation; the scrub char count reflects the real limit; the media-error
  surface exposes a Retry button, not the auto-retry copy.

## Out of scope

- The official-alerts sidebar widget (3C-10) and citizen-post widget (3C-09).
- Any backend/callable/rules change. Pagination of the report queue (the
  publication queue is bounded by the live listener; large-volume paging is a
  separate concern).

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/pages/feed-queue-filters.test.ts src/pages/FeedPage.test.tsx`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
