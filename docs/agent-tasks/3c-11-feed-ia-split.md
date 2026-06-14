# 3C-11 — Feed IA Split

**Priority:** P2

**Status:** Doc only (not implemented). Depends on 3C-08, 3C-09, 3C-10.

**Goal:** `FeedPage` today conflates three unrelated moderation concerns —
report publication pipeline, citizen-post moderation, and official-alerts
management — on one cramped screen with two of them demoted to capped sidebar
widgets. Split it into a thin shell with three primary tabs plus a public-feed
preview, so each concern gets the full surface 3C-08/09/10 build.

## Recon facts (verified 2026-06-13, re-verify before editing)

- `FeedPage.tsx` (771 lines) holds all three concerns. The publication pipeline
  already uses an internal tab state (`activeTab: 'new' | 'pending' | 'live'`);
  alerts and citizen posts are sidebar widgets.
- 3C-08 hardens the publication pipeline; 3C-09 extracts the citizen-post queue
  into `CitizenPostModerationQueue`; 3C-10 extracts the alerts manager into
  `OfficialAlertsManager`. After those land, the shell mostly needs to host
  them as tabs and delete the dead sidebar code.

## Files (≤3)

- `apps/admin-desktop/src/pages/FeedPage.tsx` (modify): becomes a thin shell
  with three primary tabs — **Publication queue** | **Citizen posts** |
  **Official alerts** — plus the existing public-feed preview. Delete the dead
  sidebar widget code once 3C-09/10 own those surfaces.
- Routing (recon in-slice): optional `/feed/:tab` deep-link so a tab is
  linkable and survives refresh (Navigation category in the audit). Keep the
  default tab to today's behavior if deep-linking is deferred.

## Note on sequencing

If 3C-09 and 3C-10 land their components as tabs directly (coordinated through
this doc), 3C-11 may shrink to navigation wiring + dead-code deletion. Build
3C-08/09/10 first; re-scope this slice against what they actually produced.

## Red-first tests

- `FeedPage` test: three named tabs render their respective surfaces; switching
  tabs preserves listener data; the public-feed preview still renders; (if
  deep-linking lands) `/feed/citizen-posts` opens that tab on load.

## Out of scope

- Any backend/callable/rules change. The moderation behavior itself (owned by
  3C-08/09/10). New moderation capabilities.

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/pages/FeedPage.test.tsx`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
