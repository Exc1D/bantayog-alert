# 3B-08 — Withdrawal Success Confirmation

**Priority:** P2 (polish — withdrawal currently completes without explicit
confirmation feedback)

**Goal:** After a citizen withdraws a report, they see explicit success
feedback ("Your report was withdrawn") and the report's terminal withdrawn
state, instead of the sheet just closing.

## Files (≤3)

- the withdrawal flow surface (recon in-slice: `DeleteSheet.tsx` /
  MapTab withdrawal path — confirm where the cancel-report callable resolves)
- its test file (extend)

## Design constraints

- Success state names the audit-preserving semantics in citizen terms
  (learnings.md: withdrawal, not hard delete): "Your report was withdrawn and
  is no longer active."
- Use the existing Toast/sheet success pattern — recon picks whichever the
  flow already uses; no new notification system.
- Failure path keeps its current error handling; this slice only adds the
  missing success feedback.

## Red-first test

Flow test: successful withdrawal renders the confirmation (toast or terminal
sheet state) before/with dismissal. Must fail before the change.

## Out of scope

- Withdrawal semantics/backend, undo, terminal timeline copy (already done in
  Phase 1C).

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run <recon-chosen test file>`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
