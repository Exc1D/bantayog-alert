# 3B-01 — Lookup Success Dead-End Fix

**Priority:** P0 (journey ends without a next step: lookup succeeds → bare `/`)

**Goal:** A successful anonymous tracking-code lookup lands the citizen on
their found report (selected/tracking view), not an unexplained home screen.

## Files (≤3)

- `apps/citizen-pwa/src/components/LookupScreen.tsx`
- `apps/citizen-pwa/src/components/LookupScreen.test.tsx` (extend)
- (only if recon requires) the MapTab selection entry point that accepts the
  found report — prefer reusing the existing tracked-report state from
  localForage/`useMyActiveReports` upgrade path

## Design constraints

- Recon in-slice: how MapTab/DetailSheet select a report today (URL param vs
  store state) — reuse that mechanism; do not invent a new routing scheme.
- On success the lookup already persists the tracked ref locally; the fix is
  navigation + selection so the citizen sees the status timeline immediately,
  plus a brief success confirmation ("Report found — tracking enabled").
- Failure/invalid-code paths stay as they are (3B-06 handles offline).

## Red-first test

Extend LookupScreen test: successful lookup asserts navigation to the report
view with the found report selected (mock navigate + selection), not bare
`/`. Must fail before the change.

## Out of scope

- Offline state for lookup (3B-06), `useMyActiveReports` error state (3B-02),
  backend changes.

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/components/LookupScreen.test.tsx`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
