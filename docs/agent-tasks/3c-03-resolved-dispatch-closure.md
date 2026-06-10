# 3C-03 — Resolved-Dispatch Closure State

**Priority:** P0 (resolved work has no designed terminal state on admin surfaces)

**Goal:** Resolved (and otherwise terminal) dispatches get a designed closure
presentation on /dispatches — visually grouped/segregated from active work,
with resolution time and summary visible — instead of disappearing or lingering
indistinctly.

## Files (≤3)

- `apps/admin-desktop/src/pages/DispatchMonitorPage.tsx` (or
  `DispatchLifecycleTable.tsx` — recon in-slice picks where terminal rows
  render today)
- `apps/admin-desktop/src/hooks/useDispatchLifecycle.ts` (only if the lifecycle
  query needs to include `resolved` — recon confirms current statuses)
- `apps/admin-desktop/src/__tests__/DispatchMonitorPage.test.tsx` (extend)

## Design constraints

- Terminal grouping: a "Recently resolved" section (bounded — e.g. last N or
  last 24h client-side) below active queues, showing resolved-at time and the
  responder's resolution summary if present on the doc.
- Do not widen Firestore queries beyond what rules already allow; if the
  lifecycle read must add the `resolved` status to an existing scoped query,
  that is a client query change only — no rules/index edits. If recon shows
  an index would be required, stop and escalate.
- Reuse existing severity/status tokens; adaptive density per learnings.md.

## Red-first test

Extend DispatchMonitorPage test: a mocked resolved dispatch renders inside the
closure section with resolved time, and not in the active queues. Must fail
before the change.

## Out of scope

- SLA countdown (3C-02), report-side closure (citizen timeline already shows
  it), archival/export, backend changes.

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/DispatchMonitorPage.test.tsx`
- `pnpm --dir apps/admin-desktop exec vitest run src/hooks/useDispatchLifecycle.test.ts`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
