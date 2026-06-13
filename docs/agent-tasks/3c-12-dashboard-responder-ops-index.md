# 3C-12 — Dashboard + Responder Operations UX-Completeness (Index)

**Status:** Backlog index. This is the separate evaluation that `3c-00`
deferred ("Out of scope for this index"): the Dashboard (`/dashboard`) and the
Dispatch/responder-roster surfaces (`/dispatches`, `ResponderAvailabilityPanel`).
Each `3c-NN` file below is one executable slice for one agent on one branch.
Recon verified 2026-06-13; every slice re-verifies its own facts before editing.

**Nothing here is built yet. This backlog needs sign-off before any slice runs.**

## Scope of this audit

`evaluate-ux-completeness` was run against the operator surfaces the user called
"pretentious / lacking the functionality they should have":

- **Dashboard** (`apps/admin-desktop/src/pages/DashboardPage.tsx`) — status bar,
  escalation queue, report-command queue, dispatch-volume chart, recent events,
  responder-availability panel, municipal-performance table.
- **Dispatch / roster** (`apps/admin-desktop/src/pages/DispatchMonitorPage.tsx`
  - `components/ResponderAvailabilityPanel.tsx`) — responder status queue,
    responder-assignment queue, escalation queue, dispatch-lifecycle table, and the
    one roster affordance that exists today (create responder + read-only list).

The user's explicit ask: **"Admin should have a way to create and manage
responder rosters as well as create, delete responder accounts."** Create exists;
manage and delete do not.

## The core finding (data layer)

`apps/admin-desktop/src/hooks/useResponderFleet.ts` queries:

```ts
query(
  scopeQuery(collection(db, 'responders'), role, municipalityId, agencyId),
  where('availabilityStatus', '==', 'available'),
  where('accountStatus', '==', 'active'),
  orderBy('lastSeenAt', 'desc'),
)
```

So the "responder panel" on both Dashboard and Dispatch is a **dispatch-candidate
list, not a roster**. Off-duty, unavailable, suspended, and revoked responders are
invisible. There is no surface on which an operator can see the people they are
supposed to manage, let alone act on them. This matches the standing rule in
`learnings.md`: _"Dispatch candidates and roster management are different datasets.
A roster workbench must include unavailable, off-duty, suspended, and revoked
responders; filter to active/available only at the dispatch-selection boundary."_

`useResponderFleet` must **not** change — `MapPage` and the assignment queue
depend on the available+active filter. The roster needs its own dataset (3C-13).

## Wired vs unwired callables (verified 2026-06-13)

| Callable                                       | Backend gate (verified)                                       | Wired in admin-desktop?                              |
| ---------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| `createResponder`                              | (verify in 3C-13)                                             | **Yes** — `DispatchMonitorPage.tsx:199`              |
| `dispatchResponder`                            | —                                                             | **Yes** — `DispatchMonitorPage.tsx:229`, `MapPage`   |
| `escalateDispatch`                             | —                                                             | **Yes** — escalation queue                           |
| `bulkAvailabilityOverride`                     | `agency_admin` only, own-agency, actor `accountStatus active` | **No call site** (lost its 2026-06-04 wiring, rf-00) |
| `suspendResponder`                             | `agency_admin` only, own-agency, actor `accountStatus active` | **No call site**                                     |
| `revokeResponder`                              | `agency_admin` only, own-agency, actor `accountStatus active` | **No call site**                                     |
| `createUser`                                   | (staff creation — verify; superadmin)                         | **No call site** (staff-account family)              |
| `suspendUser` / `revokeUser` / `resetUserTotp` | (staff lifecycle)                                             | **No call site** (staff-account family)              |

`responder-roster.ts` semantics (verified): `suspendResponder`/`revokeResponder`
set `accountStatus` → `'suspended'`/`'revoked'` **and** `availabilityStatus` →
`'off_duty'` on the `responders/{uid}` Firestore doc; revoke is audit-preserving,
**not** a hard delete. `bulkAvailabilityOverride` sets `availabilityStatus` for
each uid. All three `requireAuth(request, ['agency_admin'])` — see Decision Gate 1.

## UX-completeness scorecard (Dashboard + roster)

| Category           | Score             | Headline finding                                                                                                                                                                           |
| ------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| States & Feedback  | Partial           | Report-command queue has optimistic UI + banners; roster panel is spinner→list only. No per-responder action states (no busy/disabled/confirm) because no actions exist.                   |
| Navigation         | Partial → Missing | No dedicated roster surface. Roster is a sub-panel of `/dispatches` that only shows available responders, so there is no place that represents "the roster" at all.                        |
| Forms & Input      | Partial           | `CreateResponderForm` is solid (required vs optional fields, validation). No edit/availability/suspend/revoke forms exist.                                                                 |
| Content & Copy     | Partial           | Roster empty state ("No responders online") describes _availability_, not _roster membership_, so an agency with 10 off-duty responders reads as having none.                              |
| Edge Cases         | **Missing**       | Suspended/revoked/off-duty responders are unreachable through the UI. No conflict/permission-denied handling for management actions (none exist).                                          |
| Accessibility      | Partial           | Existing panels use labelled controls; new action surfaces must add confirm dialogs with focus traps + screen-reader labels (re-audit with `impeccable audit` after 3C-13..15).            |
| Responsive         | N/A (desktop)     | Operator workstation app; mobile out of product scope.                                                                                                                                     |
| Onboarding         | Partial           | Tour exists; roster surface has no first-run guidance because it does not exist.                                                                                                           |
| **Data integrity** | **Defect**        | Dashboard `getUncoveredMunicipalityCount` reads `municipality.activeResponders`, a field `buildMunicipalData` never populates → **every** municipality always counts as uncovered (3C-16). |

**Overall: Needs Work** — one Missing category (Edge Cases: the management
capability is absent) plus a live data-integrity defect on the Dashboard.

## Ranked slices

| Rank | Slice | Concern                                                               | Priority | Status   |
| ---- | ----- | --------------------------------------------------------------------- | -------- | -------- |
| 1    | 3c-13 | Responder roster dataset + surface (show all statuses)                | P1       | Doc only |
| 2    | 3c-16 | Dashboard coverage truth-gate (kill the false "uncovered" metric)     | P1       | Doc only |
| 3    | 3c-14 | Per-responder availability override (wire `bulkAvailabilityOverride`) | P1       | Doc only |
| 4    | 3c-15 | Suspend / revoke (deactivate) responder account                       | P1       | Doc only |

3C-13 ranks first because it is the **prerequisite dataset** — 3C-14 and 3C-15
have nothing to act on until a surface lists non-available responders. 3C-16 is
cheap, independent, and removes a metric that actively misinforms operators, so
it can land in parallel. 3C-14 before 3C-15 because availability override is
reversible and low-stakes; suspend/revoke is destructive and carries the
auth-claims question (Decision Gate 3).

## Decision gates (answer before building the affected slice)

**Gate 1 — Who may manage the roster?** The three management callables are
`agency_admin`-only + own-agency at the backend, but `useResponderFleet`'s
`ALLOWED_ROLES` (and the apps' mental model) also include `provincial_superadmin`
and `municipal_admin`. Two coherent options:

- **A (recommended, zero backend change):** Show the management actions only to an
  active `agency_admin`, scoped to their agency. `municipal_admin`/superadmin get a
  read-only roster. This ships UI-only and respects the existing gate.
- **B:** Broaden the backend role gate so municipal_admin/superadmin can manage
  responders. This is an **auth-scope change** to live callables → needs its own
  slice, the §8.4 risky-change protocol, and explicit sign-off. Not bundled into
  3C-14/15.

**Gate 2 — Dedicated `/responders` route, or a panel on `/dispatches`?**
Recommendation: a roster **section/tab on `/dispatches`** (roster lives with
dispatch ops; avoids a new route + nav entry for an MVP). Promote to a route only
if the surface outgrows the panel. 3C-13 decides and records this.

**Gate 3 — Does revoke propagate to Firebase Auth?** `responder-roster.ts`
appears to update only the Firestore doc, but `learnings.md` requires that
suspend/revoke also `setCustomUserClaims`, because issued ID tokens live ~1 hour
("`suspendStaffAccount` must update Firebase Auth custom claims"). 3C-15 must
**verify** this. If the backend does not propagate, that is a **security gap to
escalate** as its own backend slice — 3C-15 (a UI wiring slice) must not silently
paper over it.

**Gate 4 — Staff/admin account management (`createUser` family).** The user said
"create, delete responder accounts" (covered by 3C-13/15). Creating/suspending/
revoking **staff** accounts and `resetUserTotp` is a larger, separate surface
(role assignment, MFA, the §7 two-phase auth+doc creation risk). Out of scope
for this backlog; flag as a future `3c-17` evaluation if the pilot needs it.

## Execution rules (binding for every slice)

Inherits `3c-00`'s rules verbatim:

1. One slice = one branch = one PR; branch `feat/3c-NN-<slug>`; never bundle.
2. Re-run the slice's recon before editing; if a fact drifted, stop and report.
3. Red-first: one failing test, run it, see a meaningful failure, then implement.
4. **Zero rules/index/schema edits without explicit approval** (§8.4). Roster
   management uses Admin SDK callables; their role gate lives in the callable, so
   no `firestore.rules` change is expected (verify the `responders` read rules
   already permit the scoped roster query in 3C-13).
5. Worktree hygiene: `git branch -vv` + clean status; `pnpm install --frozen-lockfile`
   in a fresh worktree; build `@bantayog/shared-validators` + `functions` `lib/`
   before trusting emulator tests.
6. Any new/edited admin-desktop test that imports `../app/firebase` must
   `vi.mock('../app/firebase', () => ({ db: {} }))` (`firebase.ts:51` eager
   `getAuth` throws `auth/invalid-api-key` with no `VITE_FIREBASE_API_KEY`).
7. Finish with a `docs/progress.md` entry (and `docs/learnings.md` if a durable
   rule emerged), then two-stage review before merge.

## Explicitly rejected

- **A full Dashboard rewrite.** The Dashboard is functional (report-command queue,
  escalation, charts, municipal performance all work). The real defects are one
  false metric (3C-16) and the missing roster dataset (3C-13). Rewriting it would
  violate smallest-safe-change and risk the working command queue.
- **Hard-deleting responder accounts.** Disaster-response records are audit
  material; "delete" maps to `revokeResponder` (audit-preserving) per the standing
  citizen-withdrawal precedent in `learnings.md`. No hard-delete path.
- **Broadening the agency_admin gate inside a UI slice** (Gate 1B) — auth-scope
  changes need their own slice + §8.4 protocol.
- **A `system_config` / generic settings framework** — same YAGNI verdict as 3C-00.
