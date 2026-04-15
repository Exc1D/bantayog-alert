# Responder Dispatch Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the responder rollout by hardening Firestore access, adding the missing indexes and migration path, covering the dispatch-to-SOS flow with E2E coverage, and introducing Remote Config kill switches.

**Architecture:** Treat "system" access as Firebase Admin SDK / Cloud Functions access, not as a Firestore client role. Normalize responder dispatch documents around `responderId` and an operational `status` alias while keeping the existing `assignedTo` and `responderStatus` fields during migration so current responder code does not break mid-rollout.

**Tech Stack:** Firebase Web SDK 12, Firestore Security Rules, Firestore indexes, Firebase Admin SDK, Playwright, Vitest, Vite

---

## Research Summary

- Current rules already protect `report_ops` for admins and assigned responders, but they still key responder access off `assignedTo` and do not define `sos_events` at all.
- Current responder client code is split across two schemas:
  - list/detail reads use `assignedTo` and `responderStatus`
  - SOS documents already use `responderId` and `status`
- Task 11 as written assumes `report_ops` has `responderId` and `status`, but the repo does not currently persist either field consistently on `report_ops`.
- Current responder components exist, but no route mounts `DispatchList` or `SOSButton`, so Task 13 needs a small routing/UI harness before Playwright can exercise the full flow.
- Firebase docs pulled via Context7 were enough to confirm the plan assumptions that:
  - security rules should rely on `request.auth.uid` and `request.auth.token` claims for client access control
  - Firebase Remote Config on web is initialized from `getRemoteConfig(app)`
  - Admin SDK / Cloud Functions bypass client security rules, which is the right interpretation of "system only"

## Scope Assumptions

- `report_ops` should end up with both legacy and normalized fields during rollout:
  - legacy: `assignedTo`, `responderStatus`
  - normalized: `responderId`, `status`
- `status` on `report_ops` means responder operational status, not public report lifecycle status from `reports.status`.
- `sos_events` should not be readable from the client SDK by any role. If admins or automated flows need visibility, they must use Admin SDK code.
- Feature flags should default to safe values and fail closed for responder-only features.

## File Map

### Task 10-12: Rules, Indexes, Migration

**Modify**
- `firestore.rules`
- `firestore.indexes.json`
- `tests/firestore/firestore.rules.test.ts`
- `tests/integration/test-helpers.ts`
- `tests/fixtures/data.fixtures.ts`
- `src/shared/types/firestore.types.ts`
- `src/domains/citizen/services/firestore.service.ts`
- `src/domains/municipal-admin/services/firestore.service.ts`
- `src/domains/responder/hooks/useDispatches.ts`
- `src/domains/responder/hooks/useQuickStatus.ts`
- `src/domains/responder/services/firestore.service.ts`

**Create**
- `scripts/backfill-report-ops-responder-id.ts`

### Task 13: E2E

**Modify**
- `src/app/routes.tsx`
- `src/app/components/ProfileRoute.tsx`
- `src/features/profile/components/RegisteredProfile.tsx`
- `playwright.config.ts`
- `package.json`
- `tests/integration/test-helpers.ts`

**Create**
- `tests/e2e/responder-dispatch-sos.spec.ts`
- `tests/e2e/helpers/responder-seed.ts`

### Task 14: Feature Flags

**Modify**
- `src/app/firebase/config.ts`
- `src/app/App.tsx`
- `src/domains/responder/components/DispatchList.tsx`
- `src/domains/responder/components/SOSButton.tsx`
- `src/domains/responder/hooks/useDispatches.ts`
- `src/domains/responder/hooks/useSOS.ts`

**Create**
- `src/shared/services/remote-config.service.ts`
- `src/shared/hooks/useRemoteFlags.ts`
- `src/shared/services/__tests__/remote-config.service.test.ts`

## Task 10: Firestore Rules

**Objective:** Lock down `report_ops` and `sos_events` so the client can only read and write the responder records it owns, while preserving Admin SDK access for backend automation.

**Design Notes**
- `report_ops` read:
  - responder: allowed only when `resource.data.responderId == request.auth.uid` or legacy `assignedTo == request.auth.uid`
  - admins: keep current municipal/provincial read access
- `report_ops` write:
  - responder: allow update only on docs they own, and only for responder-controlled fields
  - "system": handled through Admin SDK, so no extra rules branch is needed
- `sos_events` read:
  - deny all client reads
- `sos_events` write:
  - create/update only for authenticated responders on their own `responderId`
  - deny deletes from the client to preserve auditability

- [ ] Add helper functions in `firestore.rules` for responder ownership against both `responderId` and `assignedTo`.
- [ ] Add `match /sos_events/{eventId}` with explicit client create/update restrictions and `allow read: if false`.
- [ ] Tighten `match /report_ops/{opsId}` update rules to whitelist responder fields:
  - `responderStatus`
  - `status`
  - `responderNotes`
  - `responderArrivalTime`
  - `responderDepartureTime`
  - `statusUpdatedAt`
  - `timeline`
- [ ] Keep municipal and provincial admin reads on `report_ops`; do not add admin client reads for `sos_events`.
- [ ] Expand `tests/firestore/firestore.rules.test.ts` with cases for:
  - assigned responder can read `report_ops`
  - unassigned responder cannot read `report_ops`
  - assigned responder can update allowed fields only
  - responder cannot reassign `responderId` / `assignedTo`
  - responder can create own `sos_events` document
  - responder cannot create another responder's `sos_events`
  - responder cannot read any `sos_events`
  - admin cannot read `sos_events` from client SDK
- [ ] Run `npm run test:rules`.

**Verification**
- `npm run test:rules`
- Expected: rules tests pass and emulator denies unauthorized `sos_events` reads

## Task 11: Firestore Indexes

**Objective:** Add the indexes needed for responder dispatch and SOS queries, using the normalized field names the rollout is converging on.

**Design Notes**
- Current code queries:
  - `report_ops`: `assignedTo == uid`, `responderStatus not-in ['completed']`, `orderBy('assignedAt', 'desc')`
  - `sos_events`: `responderId == uid`, `status == 'active'`
- The requested index names imply a schema normalization step. Recommendation:
  - update dispatch queries to `where('responderId', '==', uid)` and use `status` as the operational alias
  - keep writing the legacy fields until rollout is complete

- [ ] Update `useDispatches` and responder service queries to read from `responderId`.
- [ ] Decide one of these two options and keep it consistent everywhere:
  - recommended: add `status` as a mirror of `responderStatus`
  - fallback: change Task 11 to use `responderStatus` instead of `status`
- [ ] Add composite indexes in `firestore.indexes.json` for:
  - `report_ops`: `responderId ASC`, `status ASC`, `assignedAt DESC`
  - `sos_events`: `responderId ASC`, `status ASC`
- [ ] Verify the updated queries match the declared indexes exactly.

**Verification**
- `firebase firestore:indexes > /dev/null` is not required here; validate by running the query-backed tests under the emulator.
- `npm run test:integration`
- Expected: responder dispatch and SOS queries run without missing-index errors

## Task 12: Migration Script

**Objective:** Backfill `responderId` on existing `report_ops` documents and optionally `status` when missing, without breaking current reads.

**Design Notes**
- The backfill should copy, not move:
  - `responderId = assignedTo ?? null`
  - `status = responderStatus ?? 'assigned'` only if the team accepts the normalized alias
- Make the script idempotent so rerunning is safe.
- Use Admin SDK from a one-off script, not client SDK code.

- [ ] Create `scripts/backfill-report-ops-responder-id.ts`.
- [ ] Read all `report_ops` docs in batches.
- [ ] For each doc:
  - skip if `responderId` already matches `assignedTo`
  - otherwise set `responderId`
  - optionally set `status` when missing and `responderStatus` exists
- [ ] Log totals for:
  - scanned
  - updated
  - skipped
  - failed
- [ ] Add a dry-run mode via `--dry-run`.
- [ ] Add a package script:
  - `backfill:report-ops:responder-id`
- [ ] Document the runbook in the plan handoff:
  - export emulator or production project env
  - run dry-run first
  - run live mode once
  - keep the script for auditability

**Verification**
- Dry run against emulator data seeded through `tests/integration/test-helpers.ts`
- Spot-check a migrated doc with both old and new fields populated

## Task 13: E2E Tests

**Objective:** Cover the real responder path from assignment visibility through status update and SOS activation.

**Design Notes**
- This task is blocked by missing UI wiring. `DispatchList` and `SOSButton` exist but are not mounted anywhere in the router.
- The smallest safe path is to expose a responder-only panel from `ProfileRoute` or `RegisteredProfile` when the user profile role is `responder`.
- Prefer emulator seeding over fragile UI-only setup for admin assignment.

- [ ] Add a responder surface that renders:
  - `DispatchList`
  - `SOSButton`
- [ ] Add Playwright seed helpers under `tests/e2e/helpers/` that use emulator-backed Admin SDK writes to create:
  - responder auth user and `users/{uid}` profile
  - report in `reports`
  - matching `report_ops` document with `assignedTo`, `responderId`, `responderStatus`, `status`, `assignedAt`
- [ ] Add `tests/e2e/responder-dispatch-sos.spec.ts` covering:
  - responder signs in
  - assigned dispatch appears
  - responder taps `En Route`
  - Firestore `report_ops` reflects updated status and timeline entry
  - responder activates SOS
  - Firestore `sos_events` has one `active` document for the responder
  - responder cancels within window, if the cancel UX is intended for the happy path
- [ ] Keep the test single-browser first (`chromium`) before expanding to the full matrix.
- [ ] Wire the spec into existing `npm run test:e2e:ci`.

**Verification**
- `npm run test:e2e:ci -- tests/e2e/responder-dispatch-sos.spec.ts`
- Expected: full flow passes against Firebase emulators

## Task 14: Feature Flags

**Objective:** Add Remote Config kill switches for responder dispatch and SOS so rollout can be paused without a redeploy.

**Design Notes**
- Keys:
  - `responder_dispatch_enabled`
  - `sos_enabled`
- Defaults should fail closed for responder-only functionality.
- Remote Config should not block initial app render; fetch asynchronously and expose cached/default values.

- [ ] Initialize Remote Config from the existing Firebase app in `src/app/firebase/config.ts` or a dedicated service module.
- [ ] Create `src/shared/services/remote-config.service.ts` with:
  - typed defaults
  - `fetchAndActivate`
  - boolean getters
- [ ] Create `src/shared/hooks/useRemoteFlags.ts` to surface flags to React code.
- [ ] Gate responder UI and writes:
  - hide or disable `DispatchList` when `responder_dispatch_enabled` is false
  - hide or disable `SOSButton` and short-circuit `useSOS.activateSOS` when `sos_enabled` is false
- [ ] Add unit tests proving:
  - defaults are applied when fetch fails
  - disabled flags prevent responder actions
- [ ] Add rollout notes for Firebase console parameter creation:
  - boolean parameter `responder_dispatch_enabled`
  - boolean parameter `sos_enabled`
  - default `false` until production validation is complete

**Verification**
- Unit tests for service and hooks
- Manual emulator smoke:
  - set defaults false and confirm responder controls are hidden or disabled
  - flip local overrides to true and confirm controls reappear

## Recommended Execution Order

1. Task 10 — rules first, so responder writes are either explicitly allowed or explicitly blocked in tests.
2. Task 12 — backfill schema aliases before shifting client queries.
3. Task 11 — move dispatch reads to `responderId` and land the matching indexes.
4. Task 14 — add flags before exposing the responder surface more broadly.
5. Task 13 — add the responder route/harness and the Playwright happy-path spec last.

## Risks and Open Questions

- `system only` is not represented in current custom claims. Recommendation: interpret this as Admin SDK access only.
- Task 11 references `(responderId, status)` for `report_ops`, but current code persists `assignedTo` and `responderStatus`. Recommendation: normalize the schema instead of forcing the index to mirror legacy field names.
- The current E2E suite mostly targets citizen/auth flows and contains stale assumptions like `/login`; expect some cleanup before adding responder-path coverage.
- Remote Config is new to this app. If fetch latency or browser support causes issues, the service should expose defaults immediately and update in the background.

## Minimum Acceptance Criteria

- `report_ops` rules enforce responder ownership on writes.
- `sos_events` is unreadable from the client SDK.
- All responder dispatch docs have `responderId` populated.
- Responder queries use the normalized schema and have matching indexes.
- One Playwright spec covers dispatch visibility, status update, and SOS creation.
- Remote Config can disable dispatch and SOS without a code change.
