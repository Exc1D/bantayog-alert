# 3C-06 — Retry Affordance on ActionErrorBanner

**Priority:** P1 (failed admin commands strand the operator at an error with
no path forward)

**Goal:** When an admin command (verify/reject/dispatch) fails, the error
banner offers a "Retry" action that re-runs the same command with the same
payload, instead of forcing the operator to redo the selection flow.

## Files (≤3)

- `apps/admin-desktop/src/components/ActionErrorBanner.tsx` (optional
  `onRetry` prop + button)
- one calling surface wired (recon in-slice: pick the surface with the most
  command traffic — TriagePage or DispatchMonitorPage — and thread the retry
  callback; remaining surfaces adopt it opportunistically later)
- `apps/admin-desktop/src/components/ActionErrorBanner.test.tsx` (new or
  extend)

## Design constraints

- Retry reuses the original idempotency key where the command pattern carries
  one (recon confirms per existing callable wrappers) so a retry after an
  ambiguous failure cannot double-execute.
- Banner keeps current role/alert semantics; retry button disabled while the
  retry is in flight; a second failure keeps the banner with the same
  affordance.
- Non-retryable errors (`permission-denied`, validation) recon-listed and
  rendered without the retry button — retrying those is noise.

## Red-first test

Component test: banner with `onRetry` renders the button and invokes the
callback; without `onRetry` no button. Wiring test: failed command then retry
calls the callable twice with identical payload/key. Must fail first.

## Out of scope

- Automatic/background retries, queueing offline commands, backend changes,
  permission-denied state design (3C-05).

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/components/ActionErrorBanner.test.tsx`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
