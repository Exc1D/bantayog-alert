# 3C-07 — Per-Municipality Hotline Config

**Priority:** P1 (Missing-grade capability gap: no surface existed at all)

**Status:** **Done** (2026-06-13). This doc describes what shipped.

**Goal:** Let an authorized admin set the MDRRMO contact card (office name +
hotline number) that citizens see on the post-submission RevealSheet, the
SMS/hotline fallback, and report-failure states — without a manual Firestore
console edit. `municipal_admin` edits their own municipality; `provincial_superadmin`
edits any. Zero `firestore.rules` changes: the callable runs on the Admin SDK
and enforces the role gate itself.

## What shipped

### Backend

- `packages/shared-validators/src/municipalities.ts`
  - `mdrrmoLabelSchema` (`z.string().min(1).max(80)`),
    `MDRRMO_HOTLINE_REGEX` (`/^[+\d(][\d\s\-()]{6,20}$/`), `mdrrmoHotlineSchema`.
  - `updateMunicipalityContactInputSchema` (`.strict()`): `municipalityId`
    refined against the known Camarines Norte id set, plus both required
    `mdrrmoLabel`/`mdrrmoHotline`. `UpdateMunicipalityContactInput` type.
  - `municipalityDocSchema` (still `.strict()`) extended with optional
    `mdrrmoLabel`, `mdrrmoHotline`, `contactUpdatedAt`, `contactUpdatedBy` so
    written/seed docs still validate.
  - Exported from `packages/shared-validators/src/index.ts`.
- `functions/src/domains/ops/update-municipality-contact.ts` (new)
  - `updateMunicipalityContactCore(db, deps)` — role gate
    (`provincial_superadmin` any; `municipal_admin` scoped to own
    `claims.municipalityId`; else `permission-denied`), doc-exists check →
    `not-found`, `ref.update({ mdrrmoLabel, mdrrmoHotline, contactUpdatedAt,
contactUpdatedBy })`, and a fire-and-forget `streamAuditEvent({ eventType:
'municipality_contact_updated', ... })` (declareAlert's audit pattern, not
    moderation-incident semantics).
  - `updateMunicipalityContact` `onCall` (region `asia-southeast1`, App Check
    enforced via `shouldEnforceAppCheck()`, `maxInstances: 10`, admin CORS):
    `requireAuth(request, [PROVINCIAL_SUPERADMIN, 'municipal_admin'])` →
    `safeParse` → `invalid-argument` → `checkRateLimit` (10/60s) → conditional
    `actorClaims` build (exactOptionalPropertyTypes) → core. No `idempotencyKey`
    (last-write-wins config set is naturally idempotent).
  - Registered in `functions/src/index.ts`.

### Admin UI (CommandHeader-launched modal)

- `apps/admin-desktop/src/components/hotline-form.ts` (new, pure):
  `canEditHotlines(claims)` and `validateHotlineForm(values)` reusing
  `MDRRMO_HOTLINE_REGEX` with operator-friendly copy.
- `apps/admin-desktop/src/components/EditHotlineModal.tsx` (new): parent
  `EditHotlineModal` (no effects; derives `selectedMunicipalityId`, owns the
  superadmin `<select>` vs municipal locked label, focus trap) + keyed child
  `HotlineEditor` (one effect that prefills via `getDoc`, only setting state in
  async callbacks). Loading/error-with-retry/no-hotline note/inline validation/
  success states. Submit → `callables.updateMunicipalityContact`.
- `apps/admin-desktop/src/components/CommandHeader.tsx` (modified): renders a
  gated "Hotlines" button (Phone icon) when `canEditHotlines(claims)`; opens
  the modal. Self-contained — no per-page wiring.
- `apps/admin-desktop/src/services/callables.ts` (modified): typed
  `updateMunicipalityContact` wrapper.

## Design decisions worth keeping

- **Keyed-child pattern** for the prefill effect: a parent that resets several
  `useState`s in a `useEffect` trips `react-hooks/set-state-in-effect`. Moving
  load state into a child keyed on `municipalityId:reloadNonce` keeps the
  effect's setState calls inside async callbacks (not flagged) and makes a
  municipality switch a clean remount. (learnings.md)
- **Admin SDK callable, not rules**: the SDK bypasses `firestore.rules`, so the
  scoped role gate lives in the callable and no rules/index file changes.
- Both contact fields required: a label without a hotline is meaningless to the
  citizen-facing contact card and to `toContact`.

## Out of scope (became other slices / future work)

- Feed restructure (3C-08..11) — docs only.
- Citizen-side fallback cleanup in `RateLimitError.tsx` (3B-12) — doc only.
- A general `system_config` Settings page — rejected (YAGNI).

## Verification (all green, 2026-06-13)

- `pnpm --filter @bantayog/shared-validators run test` (181) + `build` + `typecheck`.
- `firebase emulators:exec --only firestore 'npx vitest run src/domains/ops/__tests__/update-municipality-contact.test.ts'` (5) and the wrapper test (4); functions `tsc --noEmit`, `eslint src`, `build` clean.
- `pnpm --dir apps/admin-desktop exec vitest run src/components/hotline-form.test.ts src/components/EditHotlineModal.test.tsx src/__tests__/CommandHeader.test.tsx src/hooks/useNewReportSignal.test.tsx` (22); admin-desktop `tsc --noEmit` + `eslint src` clean.
