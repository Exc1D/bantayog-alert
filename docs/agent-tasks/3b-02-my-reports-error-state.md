# 3B-02 — `useMyActiveReports` Double-Failure Error State

**Priority:** P1 (silent empty list when both data paths fail)

**Goal:** When the Firestore listener is denied AND the `requestLookup`
fallback fails, the citizen sees a designed error state ("We can't load your
reports right now") with retry, instead of a silently empty report list.

## Files (≤3)

- `apps/citizen-pwa/src/hooks/useMyActiveReports.ts` (surface an `error`
  status from the double-failure path)
- the consuming surface that renders the list (recon in-slice: MapTab/
  ProfileTab report list) — render the error + retry
- `apps/citizen-pwa/src/hooks/useMyActiveReports.test.ts` (extend)

## Design constraints

- Distinguish three terminal states: genuinely empty (no tracked reports),
  loading, and failed. Only the failed state gets the error UI.
- Retry re-runs the lookup fallback; keep any cached/stale data visible with a
  staleness note rather than blanking it (learnings.md stale-vs-error rule).
- Per learnings.md: filter invalid stored reports individually; this slice
  must not change that behavior.

## Red-first test

Hook test: mock Firestore denial + `requestLookup` rejection → hook reports
`status: 'error'` (or equivalent) instead of empty success. Must fail first.

## Out of scope

- Lookup screen UX (3B-01/3B-06), offline queue behavior, backend changes.

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/hooks/useMyActiveReports.test.ts`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
