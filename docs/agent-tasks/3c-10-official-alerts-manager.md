# 3C-10 — Official-Alerts Manager

**Priority:** P1

**Status:** Doc only (not implemented). Frontend-only when built; no backend.

**Goal:** Replace the 5-cap official-alerts sidebar widget with a full manager:
active and retired alerts in one list, retire/restore behind a confirmation
with a reason picker, and the affected municipalities + times shown so the
operator knows what each alert covers.

## Recon facts (verified 2026-06-13, re-verify before editing)

- `FeedPage.tsx:149-159` caps official alerts at `.slice(0, 5)`; retired alerts
  beyond the window are invisible.
- Retire/restore flows through the same `handleCitizenContentVisibility('alerts',
...)` path that hardcodes `reason: 'other'`; the backend enum is the same
  5-reason set as 3C-09.
- `DeclareAlertModal` is the existing create/broadcast entry point and is
  already a strong form (confirm + unsaved-changes guard); reuse it as the
  manager's "Declare alert" action rather than rebuilding alert creation.

## Files (≤3 + tests)

- `apps/admin-desktop/src/components/OfficialAlertsManager.tsx` (new): full list
  (active + retired, no cap, incremental load if needed), each row showing the
  alert's affected municipalities and declared/published times; retire/restore
  behind `ConfirmationModal` + reason picker bound to the real enum; a
  "Declare alert" button that opens the existing `DeclareAlertModal`.
- `apps/admin-desktop/src/pages/FeedPage.tsx` (modify): swap the capped widget
  for the new component (or the "Official alerts" tab from 3C-11 — coordinate).
- Reuse `callables.setCitizenContentVisibility` for retire/restore; no new
  callable.

## Red-first tests

- Component test: renders both active and retired alerts beyond 5; retire opens
  the confirm with a reason select; the chosen reason reaches the callable;
  affected municipalities + times render; "Declare alert" opens the modal.

## Out of scope

- Editing alert content, auto-expiry, or any push-notification behavior change.
- New callables, rules, or indexes.

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/components/OfficialAlertsManager.test.tsx src/pages/FeedPage.test.tsx`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
