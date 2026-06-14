# 3C-14 — Per-Responder Availability Override

**Priority:** P1

**Status:** Doc only (not implemented). Depends on 3C-13 (needs the roster
surface to act on). Frontend-only — wires an existing callable; no backend, no
rules, no schema.

**Goal:** Let an agency admin set a responder's `availabilityStatus`
(`available` / `unavailable` / `off_duty`) from the roster — for example, marking
a responder off-duty when they go off shift, or available when they return. The
`bulkAvailabilityOverride` callable already exists and has a typed wrapper but
**zero call sites**; it lost its 2026-06-04 Dispatch wiring (rf-00).

## Recon facts (verified 2026-06-13, re-verify before editing)

- `apps/admin-desktop/src/services/callables.ts`: `bulkAvailabilityOverride`
  wrapper exists — `{ uids: string[]; status: AvailabilityStatus; idempotencyKey }`
  → `{ updated: number }`. `type AvailabilityStatus = 'available' | 'unavailable' | 'off_duty'`.
- Backend `functions/src/domains/users/responder-roster.ts`:
  `bulkAvailabilityOverride` → `requireAuth(request, ['agency_admin'])`, actor
  `accountStatus` must be `'active'`, each target scoped by
  `data.agencyId === actor.claims.agencyId`, sets `availabilityStatus: status`.
  Takes a `uids[]`, so a single-responder override is `uids: [uid]`.

## Gate 1 (from 3c-12) — who sees the action

Backend is **agency_admin-only + own-agency**. Per Gate 1A (recommended, no
backend change): show the availability control **only to an active
`agency_admin`** for responders in their own agency. `municipal_admin` and
`provincial_superadmin` see the roster read-only (no override control). Broadening
the gate is Gate 1B — a separate auth-scope slice, not this one.

## Approach

Availability is **reversible and low-stakes**, so no confirmation modal — use an
inline control (segmented control or menu: Available / Unavailable / Off-duty) on
each roster row, optimistic update with rollback on failure, following the
`useOptimisticFeedActions` pattern already in the Feed surfaces. Surface a busy
state on the row while the callable is in flight and an inline error with the
status reverted on rejection. Generate a fresh `idempotencyKey` per action
(`crypto.randomUUID()`).

## Files (≤3)

- `apps/admin-desktop/src/components/ResponderRosterPanel.tsx` (modify, from 3C-13)
  — add the availability control + optimistic state, gated to active agency_admin.
- A small hook or helper if the optimistic logic warrants it (e.g.
  `useResponderAvailability.ts`) — only if it keeps the panel readable.
- `apps/admin-desktop/src/services/callables.ts` — no change expected (wrapper
  already exists); confirm signature.

## Red-first test

- `ResponderRosterPanel.test.tsx` (extend): agency_admin sees the control and
  changing it calls `bulkAvailabilityOverride` with `{ uids: [uid], status, idempotencyKey }`;
  a rejected call rolls the row back and shows an inline error; a
  `municipal_admin`/superadmin does **not** see the control. Mock `callables` and
  `useAuth`; `vi.mock('../app/firebase', () => ({ db: {} }))`.

## Out of scope

- Suspend/revoke (3C-15). Multi-select bulk override UI (single-row first; the
  callable supports bulk later). Backend/rules/schema/deploy. Broadening the role
  gate (Gate 1B).

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/components/ResponderRosterPanel.test.tsx`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
