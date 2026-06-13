# 3C-13 — Responder Roster Dataset + Surface

**Priority:** P1 (prerequisite for 3C-14, 3C-15)

**Status:** Doc only (not implemented). Frontend-only when built; no backend,
no rules, no schema.

**Goal:** Give operators a surface that shows **the whole roster** — every
responder regardless of availability or account status — so they can see the
people they manage. Today the only responder list (`useResponderFleet`) is a
dispatch-candidate list filtered to `availabilityStatus=='available'` AND
`accountStatus=='active'`, so off-duty, unavailable, suspended, and revoked
responders are invisible everywhere in the app.

## Recon facts (verified 2026-06-13, re-verify before editing)

- `apps/admin-desktop/src/hooks/useResponderFleet.ts` — query filters to
  available + active (the dispatch-candidate set). **Consumed by `MapPage` and the
  `DispatchMonitorPage` assignment queue, so it must not change.** `ResponderFleetMember`,
  `deriveOnlineStatus` (<5m online / <30m away / else offline), `scopeQuery`
  (municipal_admin→municipalityId, agency_admin→agencyId, superadmin→all), and
  `ALLOWED_ROLES = {provincial_superadmin, municipal_admin, agency_admin}` live
  here and can be reused/exported.
- `apps/admin-desktop/src/components/ResponderAvailabilityPanel.tsx` — create form
  - read-only list; empty state "No responders online" (availability wording, not
    roster). No per-responder actions.
- `responders/{uid}` doc fields used downstream: `displayName`, `availabilityStatus`
  (`available|unavailable|off_duty`), `accountStatus` (`active|suspended|revoked`),
  `lastSeenAt`, `agencyId`, `municipalityId`, optional `specializations`.
- **Verify the `responders` read rules** allow the scoped roster query (broader
  than the available+active query). If they don't, that is a rules question →
  stop and escalate per §8.4 (do not edit rules in this slice).

## Approach

New dataset, reuse the scoping. Do **not** touch `useResponderFleet`.

- New `useResponderRoster(db)` hook: same `scopeQuery` role scoping, but **no**
  `availabilityStatus`/`accountStatus` filters — returns all members in scope,
  ordered by `displayName` (roster reads, not freshness). Reuse the exported
  `ResponderFleetMember` shape + `deriveOnlineStatus`; add `accountStatus` to the
  member type so the surface can badge suspended/revoked.
- New roster surface that lists every member with two distinct indicators:
  **account status** (active / suspended / revoked — not color-only; icon+label)
  and **availability** (online/away/offline dot + available/unavailable/off-duty).
  Roster-membership empty state ("No responders in this agency yet") distinct from
  the availability-based one.

## Decision to make in-slice (Gate 2 from 3c-12)

Dedicated `/responders` route **vs** a roster section/tab on `/dispatches`.
Recommended: a section/tab on `/dispatches` (roster belongs with dispatch ops; no
new route/nav for MVP). Record the decision in the progress entry.

## Files (≤3)

- `apps/admin-desktop/src/hooks/useResponderRoster.ts` (new)
- `apps/admin-desktop/src/components/ResponderRosterPanel.tsx` (new) — or extend
  the Dispatch page section per Gate 2.
- `apps/admin-desktop/src/pages/DispatchMonitorPage.tsx` (modify) — mount it.

## Red-first tests

- `useResponderRoster.test.ts`: returns suspended + revoked + off_duty members
  (proving the available+active filter is gone); respects role scoping
  (municipal_admin sees only their municipality; agency_admin only their agency).
- `ResponderRosterPanel.test.tsx`: renders account-status + availability badges
  for a mixed-status roster; roster-membership empty state; **must**
  `vi.mock('../app/firebase', () => ({ db: {} }))` if it imports firebase.

## Out of scope

- Any per-responder mutation (availability → 3C-14; suspend/revoke → 3C-15).
- Changing `useResponderFleet` or the assignment/dispatch candidate path.
- Backend, rules, indexes, schema, deploy. Staff (`createUser` family) accounts.

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/hooks/useResponderRoster.test.ts src/components/ResponderRosterPanel.test.tsx`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
