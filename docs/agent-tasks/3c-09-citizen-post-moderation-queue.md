# 3C-09 — Citizen-Post Moderation Queue

**Priority:** P1

**Status:** Doc only (not implemented). Frontend-only when built; no backend.

**Goal:** Replace the cramped, capped citizen-post moderation widget with a
real moderation surface: an uncapped list with "load more", a reason picker on
the hide action (the backend already accepts a 5-reason enum but the UI
hardcodes one), and optimistic toggling with rollback.

## Recon facts (verified 2026-06-13, re-verify before editing)

- `FeedPage.tsx:161-167` caps citizen situation updates at `.slice(0, 10)`;
  overflow is silently invisible.
- `handleCitizenContentVisibility` (`FeedPage.tsx:187-224`) hardcodes
  `reason: 'sensitive_content'` for the `feed` surface and `'other'` for
  `alerts`. The backend `setCitizenContentVisibility` callable accepts the enum
  `['sensitive_content', 'privacy_request', 'false_or_misleading',
'legal_request', 'other']` (`functions/src/domains/ops/citizen-content-visibility.ts`).
- The toggle is spinner-only via `moderatingContentIds`; there is no
  optimistic state and no confirmation.

## Files (≤3 + tests)

- `apps/admin-desktop/src/components/CitizenPostModerationQueue.tsx` (new): the
  full surface — uncapped list with incremental "load more", filters
  (municipality for superadmins, public-vs-internal visibility), per-row
  hide/restore behind the existing `ConfirmationModal` with a **reason select**
  bound to the real enum, optimistic toggle with rollback on failure following
  the `useOptimisticFeedActions` pattern already in the codebase.
- `apps/admin-desktop/src/pages/FeedPage.tsx` (modify): swap the sidebar widget
  for the new component (or render it where 3C-11 places the "Citizen posts"
  tab — coordinate ordering with 3C-11).
- Reuse `callables.setCitizenContentVisibility`; do not add a callable.

## Red-first tests

- Component test: list renders beyond 10 with "load more"; hide opens the
  confirm with a reason select defaulting to `sensitive_content`; the chosen
  reason reaches the callable payload; a rejected call rolls the optimistic
  toggle back and surfaces an error.

## Out of scope

- The official-alerts widget (3C-10) and report publication queue (3C-08).
- New callables, rules, or indexes. Editing citizen post content (moderation is
  visibility-only).

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/components/CitizenPostModerationQueue.test.tsx src/pages/FeedPage.test.tsx`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
