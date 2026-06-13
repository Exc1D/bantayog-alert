# 3C-15 — Suspend / Revoke (Deactivate) Responder Account

**Priority:** P1

**Status:** Doc only (not implemented). Depends on 3C-13. **Has a backend
verification gate (Gate 3) that may turn this into two slices.**

**Goal:** Let an agency admin **suspend** (temporary) or **revoke** (permanent,
audit-preserving) a responder account from the roster. This is the "delete
responder accounts" the user asked for — mapped to `revokeResponder`, not a hard
delete. Both callables exist with typed wrappers but have **zero call sites**.

## Recon facts (verified 2026-06-13, re-verify before editing)

- `apps/admin-desktop/src/services/callables.ts`: `suspendResponder`
  (`{ uid, idempotencyKey }` → `{ uid, status: 'suspended' }`) and
  `revokeResponder` (`{ uid, idempotencyKey }` → `{ uid, status: 'revoked' }`).
- Backend `functions/src/domains/users/responder-roster.ts`: both
  `requireAuth(request, ['agency_admin'])`, actor `accountStatus` must be
  `'active'`, target scoped by `responder.agencyId === actor.claims.agencyId`. The
  core sets `accountStatus` → `'suspended'`/`'revoked'` **and** `availabilityStatus`
  → `'off_duty'` on the `responders/{uid}` doc, and is idempotent (returns early if
  `responder.accountStatus === targetStatus`). **Revoke is audit-preserving — the
  doc is kept, not deleted.**

## Gate 3 (BLOCKING) — does deactivation propagate to Firebase Auth?

`learnings.md` (Security): _"`suspendStaffAccount` must update Firebase Auth
custom claims because existing ID tokens can live for an hour."_ The
`responder-roster.ts` core appears to update **only the Firestore doc** (no
`adminAuth.setCustomUserClaims` seen in recon). Before wiring UI:

1. **Verify** whether `suspendResponder`/`revokeResponder` propagate the change to
   Auth custom claims (directly, via a claim-revocation doc + trigger, or via
   token-revocation).
2. **If they do not:** a suspended/revoked responder keeps a valid token for up to
   ~1 hour and can still act. That is a **backend security gap** — escalate it as
   its own backend slice (`functions/` + §8.4 risky-change protocol + tests) and do
   **not** ship UI that implies immediate deactivation until it is fixed. This UI
   slice depends on that fix.

Resolve Gate 3 first. The rest of this doc assumes propagation is correct (or a
prior slice fixed it).

## Gate 1 (from 3c-12) — who sees the actions

Backend is **agency_admin-only + own-agency**. Show suspend/revoke **only to an
active `agency_admin`** for own-agency responders (Gate 1A). Others get a
read-only roster.

## Approach

Suspend/revoke are **destructive**, so each goes behind a `ConfirmationModal`
(reuse the Feed/DeclareAlert confirm pattern: role/name preserved, disabled +
loading states, focus trap, backdrop). Honest copy: suspend = "Temporarily blocks
their access; you can reactivate later"; revoke = "Permanently removes access. The
record is kept for audit — this is not a delete." Optimistic row state with
rollback on rejection; fresh `idempotencyKey` per action. After success, the
roster row reflects the new `accountStatus` badge (relies on 3C-13 showing all
statuses).

## Files (≤3)

- `apps/admin-desktop/src/components/ResponderRosterPanel.tsx` (modify, from 3C-13)
  — suspend/revoke actions gated to active agency_admin + own agency.
- A confirm-dialog component if one is not already reusable (prefer reusing the
  existing alertdialog component).
- `apps/admin-desktop/src/services/callables.ts` — no change (wrappers exist).

## Red-first test

- `ResponderRosterPanel.test.tsx` (extend): revoke opens a confirm dialog; confirm
  calls `revokeResponder` with `{ uid, idempotencyKey }`; cancel calls nothing;
  rejection rolls back + shows an inline error; suspend path likewise; a
  `municipal_admin`/superadmin sees neither action. Mock `callables`/`useAuth`;
  `vi.mock('../app/firebase', () => ({ db: {} }))`.

## Out of scope

- Hard delete (never — audit-preserving revoke only). Reactivation/un-suspend UI
  (separate slice; check whether a callable exists first). Availability override
  (3C-14). Staff (`createUser` family) accounts. Broadening the role gate (Gate 1B).
- The Gate 3 backend fix itself if it is needed — that is its own `functions/` slice.

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/components/ResponderRosterPanel.test.tsx`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
