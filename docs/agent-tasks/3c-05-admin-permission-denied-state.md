# 3C-05 — Designed Permission-Denied State for Admin Hooks

**Priority:** P1 (`unauthorized` hook errors currently have no designed UI)

**Goal:** When an admin listener/hook reports an `unauthorized` error (role
claim missing/narrowed, scope mismatch), the operator sees a designed
"You don't have access to this data" state with sign-out/re-auth guidance —
not a generic error banner or a blank surface.

## Files (≤3)

- `apps/admin-desktop/src/components/PermissionDeniedState.tsx` (new — small
  presentational component)
- the surface wiring (recon in-slice: which pages/hooks emit `unauthorized`
  today — wire the highest-traffic one, likely the triage/map listener error
  path; further surfaces reuse it in later slices if needed)
- `apps/admin-desktop/src/components/PermissionDeniedState.test.tsx` (new)

## Design constraints

- Per learnings.md: on unauthorized state hooks already set an error and
  return early — this slice renders that state distinctly from network/offline
  errors (OfflineBanner owns those).
- Copy explains the likely cause (account role changed, session stale) and the
  action (sign out and back in); no raw error message text.
- Do not auto-sign-out — claims can refresh within an hour; the operator
  decides.

## Red-first test

Component test: renders role guidance + sign-out affordance; wiring test on
the chosen surface: an `unauthorized` hook error renders the component
instead of the generic banner. Must fail before the change.

## Out of scope

- Auth flow changes, claim refresh automation, backend changes, covering
  every admin surface (first surface only; reuse is follow-up).

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/components/PermissionDeniedState.test.tsx`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
