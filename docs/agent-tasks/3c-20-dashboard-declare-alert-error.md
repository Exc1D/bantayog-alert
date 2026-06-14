# 3C-20 — Dashboard Declare-Alert Error Surfacing

**Priority:** P1 (failure-state gap on a high-stakes action — declaring a public
alert) but **small** (one handler).

**Status:** Doc only (not implemented). Frontend-only; no backend, no rules, no
schema.

**Origin:** `docs/admin-control-contract.md` finding **N4**. When an operator
declares a public alert from the Dashboard and the callable fails, the Dashboard's
`onAlertError` handler only `console.error`s — the operator gets **no visible
signal** that the alert was not declared. The Map and Dispatch monitor both surface
this same failure to the operator; only the Dashboard swallows it. For a control
that broadcasts a province-wide emergency alert, a silent failure is the worst
possible failure mode (the operator believes the alert went out).

**Goal:** A failed alert declaration on the Dashboard must show the operator a
visible error, matching how Map and Dispatches already handle it.

## Recon facts (verified 2026-06-14, re-verify before editing)

- `apps/admin-desktop/src/pages/DashboardPage.tsx`
  - `onAlertError={(msg) => { console.error('Alert declaration failed:', msg) }}`
    (`:778`–`:780`) — log only, no UI.
  - The Dashboard **already** has the machinery to do this right:
    `const [actionError, setActionError] = useState<string | null>(null)` (`:558`),
    and `actionError` already renders through `ActionErrorBanner` in the modals
    subtree (`:320`, `:729`). Re-dispatch and verify failures already call
    `setActionError(...)` (`:627`, `:651`).
  - `DeclareAlertModal` is wired `onError={onAlertError}` (`:525`), so the error
    message already reaches this handler.
- Precedent to match: `DispatchMonitorPage.tsx` sets `setDispatchError(...)` on
  declare-alert failure (`onError → setDispatchError`, ~`:796`); `MapPage` surfaces
  `actionError` likewise. The Dashboard is the lone swallow.

## Approach (recommended: reuse the existing `actionError` path)

- In the `onAlertError` callback, call `setActionError(msg)` (keep the
  `console.error` for logs if desired). That is the entire fix — the banner,
  dismiss handler, and rendering already exist. No new component, no new state.
- Confirm the `ActionErrorBanner` is visible from the Dashboard's main view when
  the alert modal closes on failure (the existing `actionError` render at `:320`
  is inside `DashboardModals`; verify the banner shows where the operator will see
  it after the modal dismisses — if it only renders inside the modal, surface it
  on the page shell instead, mirroring re-dispatch/verify errors).

## Files (≤3 + tests)

- `apps/admin-desktop/src/pages/DashboardPage.tsx` (modify) — `onAlertError` sets
  `actionError`; ensure the banner renders where the operator sees it.
- Test file below.

## Red-first test

- Dashboard test (`vi.mock('../app/firebase', () => ({ db: {} }))` per 3c-00 rule
  6): when `DeclareAlertModal` invokes `onError('…')`, the Dashboard shows the
  error message (assert the `ActionErrorBanner` / error text is visible). Fails
  today because the handler only logs.

## Out of scope

- The FCM/avg-accept metric truth-gate (that is 3c-19). Changing
  `DeclareAlertModal`, `declareAlert`, or the alert backend. Adding retry to the
  alert flow (the modal owns its own submit retry; this slice is only about
  surfacing the terminal failure). Any rules/index/schema/deploy change.

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run` (the Dashboard test file touched)
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
