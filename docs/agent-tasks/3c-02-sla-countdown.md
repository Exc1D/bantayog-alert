# 3C-02 — SLA Countdown on Dispatch Cards

**Priority:** P0 (operators cannot see acknowledgement deadlines they are accountable for)

**Goal:** Assignment-queue and responder-status cards on /dispatches show a
live countdown to `acknowledgementDeadlineAt`, turning overdue state into a
visible operator signal.

## Files (≤3)

- `apps/admin-desktop/src/components/SlaCountdown.tsx` (new — small pure
  component: deadline millis in, formatted remaining/overdue out)
- `apps/admin-desktop/src/pages/DispatchMonitorPage.tsx` (wire into
  assignment + status queue rows)
- `apps/admin-desktop/src/components/SlaCountdown.test.tsx` (new)

## Design constraints

- `acknowledgementDeadlineAt` already exists on every dispatch doc
  (`packages/shared-validators/src/dispatches.ts` — int millis). No backend
  change.
- Countdown only while the dispatch is awaiting acknowledgement; once
  acknowledged/en_route/on_scene/resolved, show nothing or the static SLA
  outcome — recon in-slice picks based on what the row already renders.
- Tick at 1s via a single interval per component; clean up on unmount; use
  fake timers in tests (learnings.md: fake timers pair with `fireEvent`).
- Overdue state: visually distinct (existing severity token, not a new color),
  with accessible text ("Overdue by 2m"), not color alone.

## Red-first test

Component test with fake timers: future deadline renders remaining time and
counts down; past deadline renders the overdue state. Must fail before the
component exists.

## Out of scope

- Escalation automation, new queries/indexes, backend SLA changes,
  resolved-dispatch closure (3C-03).

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/components/SlaCountdown.test.tsx`
- `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/DispatchMonitorPage.test.tsx`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
