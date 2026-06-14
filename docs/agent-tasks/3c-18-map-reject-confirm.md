# 3C-18 — Map Reject: Confirmation + Reason Picker

**Priority:** P1 (destructive moderation with a fabricated reason and no guard)

**Status:** Doc only (not implemented). Frontend-only; no backend, no rules, no
schema.

**Origin:** `docs/admin-control-contract.md` finding **N2**. On `/map`,
`handleReject` calls `rejectReport` with a **hardcoded** `reason:
'obviously_false'` and **no confirmation and no reason picker**. The verify path
two handlers up already routes through `ConfirmationModal`; `/triage` already
proves the correct reject pattern (reason `<select>` from the real enum +
`ConfirmationModal` showing the count/reason/note — 3c-04). The Map reject is the
one place that rejects a citizen's emergency report on a guess, silently.

**Goal:** A Map reject must (1) let the operator pick the real reason and (2)
confirm before it commits — matching the Triage reject contract — so no report is
rejected on a fabricated reason or a stray click.

## Recon facts (verified 2026-06-14, re-verify before editing)

- `apps/admin-desktop/src/pages/MapPage.tsx`
  - `handleReject` (`:172`) calls `callables.rejectReport(...)` with
    `reason: 'obviously_false'` hardcoded (`:179`). No modal, no reason argument.
  - `handleVerify` (`:146`) already gates through `ConfirmationModal` (rendered
    `:403`, confirm calls `handleVerify(verifyPendingId)` `:411`) — the verify
    flow is the in-file precedent for a guarded action.
  - The reject button is wired via `onReject={(id) => void handleReject(id)}`
    (`:352`), passed into the triage panel component on the map.
- Triage reference (the pattern to copy): `apps/admin-desktop/src/pages/TriagePage.tsx`
  already builds a reason `<select>` over the backend reject-reason enum, defaults
  to `insufficient_detail`, trims an optional note (≤500), and shows a
  `ConfirmationModal` with the count + reason + note before calling
  `rejectReport` (3c-04). Reuse the same enum source and modal component — do not
  invent a second reason list.
- `learnings.md`: _"Phase 1 triage rejection can reuse the existing backend reason
  enum; keep `insufficient_detail` as the default."_ The Map reject must use the
  **same** enum, not its own `obviously_false` constant.

## Approach (recommended: adopt the Triage reject pattern on the Map)

- Replace the fire-and-forget `handleReject(id)` with a two-step flow:
  1. The reject button opens a confirm modal (reuse `ConfirmationModal`, mirroring
     the existing verify modal in this same file) carrying a reason `<select>`
     seeded from the shared reject-reason enum (default `insufficient_detail`,
     **not** `obviously_false`), plus the optional trimmed note already supported
     by `rejectReport`.
  2. Only on confirm does `rejectReport` run, with the **chosen** reason.
- Prefer reusing the existing Triage reject control if it is already extractable
  as a shared component; if it is still inline in `TriagePage`, the lighter move
  is to replicate the `ConfirmationModal` + reason-select inline on the Map (as
  the verify modal is inline here) rather than do a larger extraction in this
  slice. Either way the **reason enum and default must be the shared ones**.
- Keep the existing error/retry banner behavior on failure (the Map reject already
  surfaces `actionError`); confirmation is additive, not a replacement.

## Files (≤3 + tests)

- `apps/admin-desktop/src/pages/MapPage.tsx` (modify) — gate `handleReject` behind
  a reason-carrying `ConfirmationModal`; pass the chosen reason to `rejectReport`.
- The reject-trigger component on the map (modify) — only if the button must open
  the modal instead of calling reject directly.
- Test file below.

## Red-first tests

- `MapPage` test (`vi.mock('../app/firebase', () => ({ db: {} }))` per 3c-00 rule
  6): clicking reject **does not** call `rejectReport` immediately — it opens a
  confirm modal; `rejectReport` is called only after confirm, and with the
  operator-selected reason (assert a reason other than `obviously_false` is
  threaded through). Fails today because reject fires instantly with the hardcoded
  reason.

## Out of scope

- The dead overlay panel (that is **3c-17 / N1**). Changing `rejectReport`'s
  backend contract, the reason enum, notes limit, or any rules/index/schema. A
  full shared-reject-component extraction across Triage + Map (worthwhile, but a
  larger refactor — note it as a follow-up if the inline duplication is the only
  cost).

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/pages/MapPage.test.tsx`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
