# Progress

## 2026-06-08 - Phase 1L Admin Rejection Notes

- Added an optional Admin note control to the `/triage` workbench and threaded trimmed notes into existing `rejectReport` calls.
- Kept the slice on the existing callable contract: blank notes are omitted, notes remain capped at the backend's 500-character limit, and verify actions were not changed because the Admin wrapper does not expose verification notes.
- Verification: red-first `TriagePage` test failed on the missing Admin note control, then `pnpm --dir apps/admin-desktop exec vitest run src/pages/TriagePage.test.tsx` passed.

## 2026-06-08 - Phase 1K Responder Status Queue

- Expanded Admin dispatch lifecycle reads to include active field statuses: `acknowledged`, `en_route`, and `on_scene`.
- Added a read-only `/dispatches` responder status queue so Admin operators can see accepted/acknowledged/en-route/on-scene progress without mutating responder state.
- Verification: red-first hook test failed on the missing lifecycle query statuses, red-first page test failed on the missing status queue, then `pnpm --dir apps/admin-desktop exec vitest run src/hooks/useDispatchLifecycle.test.ts` and `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/DispatchMonitorPage.test.tsx` passed.

## 2026-06-08 - Phase 1J Triage Stale Data Messaging

- Added a triage-specific stale-data banner when the `/triage` queue has not refreshed for more than five minutes.
- Kept listener error/offline handling on the existing `OfflineBanner`; the new stale banner is a degraded-data warning rather than a blocking error.
- Verification: red-first fake-timer test failed on the missing stale status, then `pnpm --dir apps/admin-desktop exec vitest run src/pages/TriagePage.test.tsx`, focused triage/header/table tests, Admin Desktop typecheck, and Admin Desktop lint passed.

## 2026-06-08 - Phase 1I Basic Incident Export

- Added a basic CSV export button to Admin `/triage` that downloads the currently visible filtered triage rows.
- Kept export intentionally limited to non-private operational fields already visible to operators: report ID, type, severity, status, municipality, barangay, description, and created time.
- Verification: red-first CSV export test failed on the missing builder, then `pnpm --dir apps/admin-desktop exec vitest run src/pages/TriagePage.test.tsx`, focused triage/header/table tests, Admin Desktop typecheck, and Admin Desktop lint passed.

## 2026-06-08 - Phase 1H Rejection Reason Selection

- Added a rejection-reason selector to the Admin `/triage` workbench and threaded the selected reason into single and bulk `rejectReport` calls.
- Preserved the existing default `insufficient_detail` reason, so current behavior remains the default until an operator chooses `duplicate`, `obviously_false`, or `test_submission`.
- Verification: red-first `TriagePage` test failed on the missing rejection selector, then `pnpm --dir apps/admin-desktop exec vitest run src/pages/TriagePage.test.tsx`, focused triage/header/table tests, Admin Desktop typecheck, and Admin Desktop lint passed.

## 2026-06-08 - Phase 1G Triage Filters

- Added local filters to the Admin `/triage` workbench for status, severity, report type, and free-text search across summary/place/type/report ID.
- Kept the slice frontend-only and command-safe: scoped Firestore reads, verify/reject callables, bulk actions, and Map routing are unchanged; changing filters clears selected rows so hidden rows cannot be bulk-commanded accidentally.
- Verification: red-first `TriagePage` test failed on missing filter controls, then `pnpm --dir apps/admin-desktop exec vitest run src/pages/TriagePage.test.tsx`, focused triage/header/table tests, Admin Desktop typecheck, and Admin Desktop lint passed.

## 2026-06-08 - Phase 1F Demo Seed/Reset Scripts

- Added local demo seed/reset/reseed package scripts around the existing fixed-ID Camarines Norte incident seed data.
- Extended the seed companion script with explicit reset paths for seeded `reports`, `report_ops`, `dispatches`, and `alerts`, guarded so resets only run against a Firestore emulator.
- Kept this slice local-demo only: no production/staging reset command, no broad collection wipe, no Firestore rules/index edits, no backend callable changes, and no deploy.
- Verification: `pnpm exec vitest run scripts/dev-all.ports.test.ts scripts/seed-staging-incidents.test.ts` passed 13 tests; `firebase emulators:exec --only firestore 'pnpm demo:reseed'` reset 26 fixed demo docs and seeded 10 reports, 10 `report_ops`, 1 dispatch, and 5 alerts; root TypeScript passed. The focused script ESLint command completed but reported both seed files are ignored by the repo ignore pattern, so there is no lint coverage for these script files yet.

## 2026-06-08 - Phase 1E MVP Firestore Rule Tests

- Added an MVP Firestore rules spine test covering citizen-owned report tracking reads, cross-citizen denial, anonymous read-only lookup recovery, verified-report municipal assignment queries, and callable-only dispatch creation.
- Kept this slice test-only: no `firestore.rules`, rules template, index, backend callable, schema/migration, deploy config, or production data changes.
- Verification: `firebase emulators:exec --only firestore 'npx vitest run src/__tests__/rules/mvp-loop.rules.test.ts'` passed 5 tests; `firebase emulators:exec --only firestore 'npx vitest run src/__tests__/rules'` passed 28 files / 220 tests; `pnpm --dir functions exec tsc --noEmit` and `pnpm --dir functions exec eslint src` passed.

## 2026-06-08 - Phase 1D Responder Assignment Screen

- Added a first-dispatch responder assignment queue to `/dispatches`, fed by existing scoped report reads and the available responder fleet.
- Wired assignment to the existing `dispatchResponder` callable with idempotency keys and the same success/error banner pattern used by re-dispatch.
- Kept this slice narrow: no new backend entry point, route, Firestore rules/index edits, schema/migration files, responder mobile changes, auto-ranking, or deploy config.
- Verification so far: red-first `DispatchMonitorPage` test failed on the missing assignment queue, then `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/DispatchMonitorPage.test.tsx src/__tests__/map-firestore-wiring.test.tsx src/__tests__/TriagePanel.test.tsx`, `pnpm --dir apps/admin-desktop exec tsc --noEmit`, and `pnpm --dir apps/admin-desktop exec eslint src` passed.

## 2026-06-08 - Phase 1C Citizen Tracking Timeline

- Replaced the Citizen PWA own-report progress strip with a citizen-facing tracking timeline derived from existing `MyReport` status, submission time, and last-status time fields.
- Added terminal copy for rejected reports so citizens see that the report was not accepted instead of a misleading pending responder path.
- Kept this slice frontend-only: no Firestore rules/index edits, backend callable changes, projection contract, deploy config, schema/migration files, or new dependencies.
- Verification so far: red-first `DetailSheet` tests failed on the missing timeline/terminal outcome, then `pnpm --dir apps/citizen-pwa exec vitest run src/components/MapTab/DetailSheet.test.tsx`, `pnpm --dir apps/citizen-pwa exec tsc --noEmit`, and `pnpm --dir apps/citizen-pwa exec eslint src` passed.

## 2026-06-08 - Phase 1B Admin Triage Workbench

- Added `/triage` as a dedicated Admin Desktop workbench for the Phase 1 report review loop, backed by scoped Firestore report reads and existing lifecycle command callables.
- Added the Triage command tab and surfaced report summaries in the triage queue so operators can review, verify, reject, or route verified reports to Map dispatch without using the Dashboard queue as the primary triage surface.
- Kept this slice narrow: no Firestore rules/index edits, backend callable changes, responder assignment screen, deploy config, or new dependencies.
- Verification so far: red-first `TriagePage` test failed on the missing page, then focused triage/header/table tests, Admin Desktop typecheck, Admin Desktop lint, and the full `pnpm --dir apps/admin-desktop exec vitest run` suite passed.

## 2026-06-07 - Phase 1A Citizen Report Form Improvements

- Added real Citizen intake fields for description, people injured, people trapped, location confidence, and optional urgency reason while keeping the existing three-step wizard and photo path.
- Replaced hardcoded Citizen severity with `deriveReportSeverity`, then persisted triage through wizard snapshots, local drafts, callable submission, shared validators, and `report_ops` materialization.
- Kept this Phase 1A slice narrow: no Admin triage console, SMS work, Firestore rules/index edits, deploy config, schema migration, or new dependencies.
- Verification so far: focused Citizen tests passed, shared report validator tests passed, and the Functions callable test skipped because the Firestore emulator was unavailable.

## 2026-06-07 - Phase 0 Stabilize and Narrow Docs

- Added the requested Phase 0 docs: MVP scope, Phase 0 architecture map, repo-level checklist, and Phase 1 backlog.
- Renamed the mismatched ADR filenames for report projections and MVP role scope so each ADR number has one canonical requested file.
- Normalized the requested feature-boundary README scaffolds around purpose, ownership, exclusions, and Phase 1 intended work without moving runtime code.
- Kept the pass documentation-only: no Firestore rules, Cloud Functions behavior, dependencies, runtime folders, schema/migration files, deploys, or Phase 1 UI were changed.

## 2026-06-07 - Architecture Alignment for MVP Core Loop

- Added `docs/architecture/architecture-alignment.md` to center Phase 0/1 work on the incident lifecycle: Citizen report → Admin triage → Verify/reject → Dispatch responder → Responder status update → Resolution → Citizen tracking.
- Added architecture checklist and ADR index docs, plus eight Nygard-style ADRs covering the MVP loop, canonical submission path, command-function writes, report triptych, future notification outbox, offline boundaries, MVP role scope, and thin apps/shared domain rules.
- Added lightweight feature boundary README scaffolds for Citizen reporting/tracking, Admin triage/dispatch, and Responder assignments/status updates without moving runtime code.
- No runtime behavior, Firestore rules, Cloud Functions exports, deployment config, dependencies, or major folders were changed.

## 2026-06-07 - Fallow-Driven Cloud Functions Unit-Test Coverage

- Ran Fallow analysis and identified high-complexity / high-duplication files.
- Extracted shared test utilities into `apps/admin-desktop/src/test-utils.tsx`.
- Decomposed `RevealSheet.tsx`, `mappers.ts`, `StatusBar.tsx`, and `MapTab` (with `useMapTab.ts` hook) — zero breaking changes, all existing tests pass.
- Exported `inputSchema` from `merge-duplicates.ts` (previously private const) so unit tests can directly assert schema contracts.
- Wrote pure-mock unit tests for `redispatch-report` core (12 tests passing) and `merge-duplicates` core (11 tests passing) using the same pattern: hoist mock `withIdempotency`, construct `createMockDb` that exposes `_txGet`, `_txUpdate`, `_txSet`, and asserts Firestore ref paths.
- Verification: both unit files pass together (`npx vitest run src/domains/dispatches/__tests__/redispatch-report.unit.test.ts src/domains/reports/__tests__/merge-duplicates.unit.test.ts`), `tsc --noEmit` clean for functions package.

## 2026-06-07 - Fallow-Driven DeclareAlertModal Decomposition

- Decomposed `DeclareAlertModal.tsx` (719 LOC, cognitive 24, cyclomatic 35) into three modules:
  - `useDeclareAlert.ts` — new hook with all state, effects, callbacks, validation, and submission logic (~360 LOC).
  - `AlertFormFields.tsx` — pure presentational component for all form inputs (~260 LOC).
  - `DeclareAlertModal.tsx` — orchestrator shell (~195 LOC): backdrop, dialog, focus trap, footer, confirmation dialogs.
- Preserved every existing prop contract, behavior, accessibility attribute, and event handler. No consumer changes required.
- Verification: `pnpm --dir apps/admin-desktop exec vitest run` (523 tests passed), `tsc --noEmit` clean, ESLint clean.

## 2026-06-07 - Fallow-Driven ProfileTab Decomposition

- Decomposed `ProfileTab.tsx` (778 LOC, cognitive 23, cyclomatic 25) into five modules:
  - `useProfileTab.ts` — new hook with all state, auth effects, badges, and action handlers (~210 LOC). Exported `useBadges` and `BadgeDef` for reuse.
  - `ProfileTab/components/MilestoneTracker.tsx` — pure presentational component for the impact path tracker (~80 LOC).
  - `ProfileTab/components/BadgeList.tsx` — pure presentational component for the guardian skills badge list (~50 LOC).
  - `ProfileTab/components/ReportCard.tsx` — pure presentational component for individual report cards (~90 LOC).
  - `ProfileTab.tsx` — orchestrator shell (~230 LOC): hero headers, stats grid, settings/track buttons, report list, sign-out, and conditional anonymous/registered flows.
- Preserved `WITHDRAWABLE_STATUSES` export (consumed by `MapTab/index.tsx`). No consumer changes required.
- Verification: `pnpm --dir apps/citizen-pwa exec vitest run src/components/ProfileTab.test.tsx` (6/6 pass), `tsc --noEmit` clean, ESLint clean. Full citizen-pwa suite: 452/455 pass (3 pre-existing `PeekSheet.test.tsx` failures unrelated to this change).

## 2026-06-07 - Greenfield PostGIS Stage 1 Migration Diff

- Added the approved executable Stage 1 PostGIS migration artifacts under `infra/postgres/`: incident-core schema SQL, down migration, smoke/query/RLS SQL, and local runner documentation.
- The migration creates the incident lifecycle root plus report, verification, dispatch, responder status, geospatial, alert, privacy, audit, public incident card, and public alert card tables with PostGIS GiST indexes and RLS enabled/forced on every table.
- Kept the apply boundary intact: no Cloud SQL instance was modified, no Firebase deploy was run, and the SQL smoke test remains a disposable-database command until a Postgres/PostGIS test database is available.
- Verification: `git diff --check`, targeted SQL privilege/read-model text guards, `pnpm typecheck`, `pnpm lint`, and `pnpm test` passed. Disposable PostGIS execution could not run here because host `psql` is unavailable and the Docker daemon is not running.

## 2026-06-07 - Greenfield PostGIS Stage 1 Migration Plan

- Added the Stage 1 migration plan for the greenfield PostGIS incident core under `docs/runbooks/migrations/`, covering the old Firestore/RTDB shape, target `incident_core` tables, PostGIS indexes, RLS/default-deny model, query proofs, compatibility matrix, rollback requirements, and monitoring signals.
- Kept the plan proposal-only: no executable SQL migration, Cloud SQL Terraform, RLS policy file, runtime dependency, backend export change, or deploy was added.

## 2026-06-07 - Greenfield Architecture Boundary Contracts

- Extended the greenfield Incident/PostGIS contract slice in `@bantayog/shared-validators`: added incident lifecycle child-record links, PostGIS store references, duplicate-cluster query inputs, grouped command route params, one role-aware Ops app surface, and public incident projection events for publish/refresh/unpublish.
- Kept this as a non-runtime contract layer: no Firebase rules/indexes, Postgres migrations, RLS SQL, Cloud Run server, live Functions export collapse, or Admin/Responder app merge were changed in this pass.
- Verification: red-first `incident-core` tests failed on the missing contracts, then `pnpm --dir packages/shared-validators exec vitest run src/incident-core.test.ts`, `pnpm --dir packages/shared-validators exec tsc --noEmit`, `pnpm --dir packages/shared-validators exec eslint src`, and `pnpm --dir packages/shared-validators build` passed.

## 2026-06-07 - Greenfield Incident-Core Contract Seed

- Started the greenfield Incident/PostGIS rebuild as a safe contract slice in `@bantayog/shared-validators`: added strict incident-core schemas for separate operational, verification, and publication axes; PostGIS-ready point/bbox/nearby-responder inputs; grouped command envelopes; audit events; private reporter privacy records; and sanitized public incident cards.
- Preserved the public map/read-model boundary by proving citizen-facing incident cards reject private reporter fields instead of reading operational report/private documents directly.
- Verification: red-first `incident-core` test failed before the module existed, then `pnpm --dir packages/shared-validators exec vitest run src/incident-core.test.ts`, `pnpm --dir packages/shared-validators exec tsc --noEmit`, `pnpm --dir packages/shared-validators exec eslint src`, and `pnpm --dir packages/shared-validators build` passed.

## 2026-06-06 - Fallow Duplicate E2E Cleanup

- Re-ran full Fallow after the dead-code cleanup: dead-code stayed at 0, while broad legacy health and duplication findings remained.
- Removed the weaker duplicate Admin Desktop UI/UX Playwright spec and kept `comprehensive-ui-ux.spec.ts`, which preserves the same inspection coverage with stronger login/setup handling.
- Refactored the Responder dispatch detail surface out of a single high-complexity render function into named same-file sections/hooks; Fallow moved it out of the full-report top hotspots and changed-file audit no longer flags it.
- Consolidated repeated Admin e2e Firebase Auth emulator calls and Citizen query-cache IndexedDB open/upgrade logic; also settled the Citizen App smoke test so it passes without React `act(...)` warning noise.
- Retired standalone phase/boundary scripts that were no longer package entry points, then corrected stale runbook/checklist references; Fallow critical health findings dropped from 23 to 18 at that point.
- Refactored Responder Profile and Admin Dashboard out of Fallow's hotspot list while preserving focused behavior tests; Dashboard dropped from 40/28 complexity to no remaining finding.
- Consolidated three duplicate Camarines Norte barangay lists into `@bantayog/shared-validators` and removed the stale `shared-sms-parser` workspace package; Fallow duplicated lines dropped from 22,393 to 21,257 and dead-code stayed at 0.

## 2026-06-06 - Fallow Dead-Code Cleanup

- Ran Fallow across the monorepo and cleaned the concrete dead-code layer: removed stale one-off scripts, fixed stale Functions domain test mock paths, fixed root script dependency declarations, pruned misplaced unused package dependencies, and broke the Citizen query-provider re-export cycle.
- Added Fallow ignore coverage for generated output directories that are not source-of-truth entry points, so future Fallow reports do not count compiled `functions/lib` or stale declaration output as source debt.
- Verification: Fallow dead-code now reports 0 issues; focused Functions tests passed for the edited test files, Citizen App smoke test passed without localhost probe noise, Citizen/Functions lint and typecheck passed, and root lint/typecheck passed with only the known root-process Functions Node 22 engine warning.

## 2026-06-06 - Retired Feature Residue Removal

- Removed the approved dead backend/admin surfaces for field mode, shift handoff, data incident declaration/events, provincial resources, command-channel manual message posting, and the retired dispatch timeout sweep from source exports, Admin callable wrappers, direct tests, and scheduled sweep code.
- Removed PAGASA hazard signal validator contracts while preserving hazard-zone reference/custom zone schemas, and removed the stale `breakGlassSession` shared auth claim.
- Removed retired Firestore rules/index entries for `field_mode_sessions`, `shift_handoffs`, `incident_response_events`, `data_incidents`, and `provincial_resources`; kept command-channel collection rules because report sharing and agency assistance still use those records.
- Cleaned operator-facing runbooks and monitoring so degraded-mode, restore, Track 3 cutover, and logging metrics no longer instruct operators to use retired SMS/NDRRMC/PAGASA/break-glass paths.
- Remaining Admin callable wrappers with no Admin Desktop source reference after this sweep: `cancelDispatch`, `closeReport`, `shareReport`, `mergeDuplicates`, `acceptAgencyAssistance`, `declineAgencyAssistance`, `suspendResponder`, `revokeResponder`, `bulkAvailabilityOverride`, `setRetentionExempt`, `setErasureLegalHold`, `approveErasureRequest`, `toggleMutualAidVisibility`, `suspendUser`, `revokeUser`, `resetUserTotp`, `requestAgencyAssistance`, `listScopedOperationsMap`, `createUser`, `reopenReport`. These need a product decision: wire UI, document backend-only use, or retire.

## 2026-06-06 - Audit-Preserving Actions + Dispatch UX

- Implemented Option B semantics for citizen report deletion: citizens now withdraw unverified reports from Map/Profile, while the backend preserves the report, private/contact/lookup audit trail, and records `cancelReason: citizen_withdrew`.
- Made Admin Desktop action notifications centered and more prominent, renamed official-alert delete affordances to retire/restore, and wired responder account creation into Dispatch through the existing `createResponder` callable.
- Added Citizen foreground alert and responder-on-way modal notifications, kept verified situation updates visible in Feed for 24 hours, and replaced the responder dispatch state list with an accessible progress ring.
- Verification: red-first targeted tests failed on the missing behaviors, then Admin/Citizen/Responder typecheck + lint passed; focused Admin/Citizen/Responder tests passed; Functions typecheck/lint/build passed under Node 22; `cancel-report-by-citizen` ran under Firestore + RTDB emulators with 8 passing tests.

## 2026-06-06 - Declare Alert Modal Policy Extraction

- Started the targeted refactor pass with the oversized Admin Desktop `DeclareAlertModal`: extracted pure form policy for default sectors, validation, and callable payload construction into `declare-alert-form.ts` without changing the modal UI or page callers.
- Continued the same narrow refactor by extracting the submit confirmation and unsaved-changes alert dialogs into small typed components inside `DeclareAlertModal.tsx`, preserving copy, roles, loading state, and backdrop behavior.
- Moved those alert dialog components into `declare-alert-dialogs.tsx`, leaving the shared modal focused on form state, validation, and submit orchestration while preserving the multi-entry-point Declare Alert contract.
- Extracted the remaining static hazard, sector, municipality, barangay, and summary-list options into `declare-alert-options.ts`, removing option-data construction from the modal render module.
- Verification: red-first helper/dialog tests failed on missing modules, then the helper/modal-focused tests, Admin Desktop typecheck, and Admin Desktop lint passed.

## 2026-06-05 - Simplicity Audit + Dashboard Command Queue Completion

- Ran the first no-code simplicity audit pass: package consolidation is still a standalone refactor candidate, but the highest-confidence simplification was the admin Dashboard workflow gap, not deleting packages.
- Completed the Dashboard report command queue against existing callables and surfaces: new reports can be sent to review, reviewed reports can be verified, verified reports deep-link to `/map?reportId=...`, rejection stays Feed-owned, and responder assignment stays Map-owned.
- Fixed the browser-discovered Admin Map permission banner by removing the denied RTDB `responder_locations` parent listener; Map dispatch now uses the scoped Firestore responder roster.
- Verification: red-first Dashboard ops and listener tests failed on the missing queue / denied RTDB parent listener, then passed with `dashboard-redispatch`; Admin Desktop lint/typecheck, root lint/typecheck/test, and live Citizen/Admin/Responder browser smoke pass.
- Cleaned up the Admin Desktop full-suite warning noise: async hook tests now settle updates inside `act(...)`, cross-window message delivery is wrapped in `act(...)`, and the dashboard Firestore wiring test no longer mounts real ops metrics against the Functions emulator.

## 2026-06-05 - Admin Responder Presence Correction

- Fixed the admin roster status mismatch where a responder who had just set themselves Available could still appear Away because Admin Desktop derived presence only from stale `lastSeenAt`.
- Admin roster mapping now uses the freshest known activity timestamp across `lastSeenAt`, `lastTelemetryAt`, and availability `updatedAt`, preserving the existing active/available query and role scoping.
- Verification: red-first `useResponderFleet` regression now covers stale telemetry plus fresh availability update, and the focused Admin Desktop hook test passes.

## 2026-06-04 - Emulator Report Submission Fix

- Diagnosed and fixed three interlocking issues breaking report submission in `pnpm dev:all` emulator mode:
  1. **App Check 400 cascade**: `packages/shared-firebase/src/app.ts` unconditionally used `ReCaptchaV3Provider`; against the emulator this always 400, throttling auth + function calls. Added `isEmulator` param and `CustomProvider` with dummy token when `VITE_USE_EMULATOR=true`.
  2. **GPS double-invocation**: `useGpsLocation(autoAttemptOnMount)` lacked a ref guard, so React Strict Mode invoked it twice, causing duplicate console errors and apparent "screen refreshed three times". Added `hasAutoAttemptedRef` guard + regression test with `StrictMode` wrapper.
  3. **appCheck/ not treated as non-retryable**: `isNonRetryableError` only checked `auth/` prefix, so App Check throttling consumed all 3 retries before giving up. Extended to also catch `appCheck/` errors.
- Verified: all 451 citizen-pwa tests pass, typecheck and lint pass across the monorepo.

## 2026-06-04 - Admin Desktop Report Flow Browser Proof

- Ran `pnpm dev:all` against a clean local emulator stack and walked the live report loop: Citizen PWA manual fire report -> Admin Feed moderation/publish -> Admin Map verified dispatch -> Dispatch Monitor active row -> Citizen active-report status.
- Fixed a live Admin Map blocker where `useFirestoreListeners` subscribed to the denied RTDB `responder_locations` parent path; map dispatch now relies on the scoped Firestore responder roster and no longer shows the false permission banner.
- Corrected Admin Feed wording from public feed preview to public map preview after browser proof showed Citizen Feed is the separate situation-update surface, while emergency reports publish to the citizen map/status flow.

## 2026-06-04 - Admin Desktop Feed / Dispatch Operational Pass

- Reframed the Feed tab as a Public Information Desk without changing the backend moderation path: raw reports, scrubbed publication, official alerts, citizen posts, and public preview now read as citizen-facing information work instead of generic feed cards.
- Turned the Dispatch responder list into a roster workbench: scoped responder reads now include unavailable/off-duty/suspended roster entries, agency admins can add responders through `createResponder`, and selected responders can be marked available/off-duty/unavailable through `bulkAvailabilityOverride`.
- Verification: red-first focused tests now cover full-scope roster reads, roster metadata, first-responder add from an empty roster, bulk availability override, agency-admin gating, and Feed public-information copy.

## 2026-06-04 - Admin Desktop Dashboard Command Queue

- Started the admin-desktop functionality refactor by turning the Dashboard from a read-only metrics wall into an operational report command surface.
- Added a Report command queue for `new` and `awaiting_verify` reports: new reports can be sent to review, awaiting reports can be verified for dispatch, and every queued report can open the Map with `reportId` selected for the existing dispatch flow.
- Verification: red-first focused Dashboard test now covers queue rendering, `verifyReport` calls for both lifecycle states, and Map navigation.

## 2026-06-04 - Local Demo Spine Repaired

- Fixed the real `pnpm dev` demo path, not just the proof fixture. Normal dev seed now creates `municipalities/daet` and active BFP responder roster fields (`agencyId: bfp-daet`, `accountStatus`, `lastSeenAt`) so Citizen manual-Daet reports materialize for Admin Map dispatch.
- Aligned `seedLocalProofAccounts()` with normal dev seed shape and added a dev-seed Playwright regression for Citizen submission -> Admin `/map` marker dispatch -> Responder accept without proof reseeding.
- Root `pnpm dev` now launches `scripts/dev-all.mjs`; frontend-only work remains available as `pnpm dev:apps`.
- Verification: dev-seed port/unit guard, focused map-dispatch Playwright, `pnpm proof:local`, lint, and typecheck pass.

## 2026-06-03 - Investor Demo / Proof Hardening

- Prepared the manual three-app investor flow for `pnpm dev:all`: seeded canonical citizen, municipal admin, superadmin, and BFP responder accounts; added responder roster metadata without workflow records; and removed emulator startup hangs from Functions registration, Cloud Logging protobuf init, and manual inbox processing.
- Hardened Declare Alert without changing the visual system: public-alert framing, municipality scope guidance, selected-municipality feedback, final `Declare public alert?` confirmation, loading/failure copy, and proof-helper updates.
- Reliability proof now selects the exact admin report row, dismisses onboarding at the protected click point, verifies citizen/responder alert visibility, responder dispatch progression, Feed hide/restore, idempotent replay, and report status mirroring.
- Responder dispatch demo UX proof now covers GPS-denial recovery, notification tap routing, mobile `390x844`, reduced motion, offline-after-load stability, no horizontal overflow, readable timeline hint, and pre-arrival fallback copy.
- Verification included focused modal regression, admin lint/typecheck, e2e TypeScript, live local alert persistence, and `pnpm proof:local` checkpoints C00-C10.

## 2026-06-03 - PR #168 / CI Proof Follow-Up

- Made `dev:all` inject emulator-safe Firebase web env defaults so CI does not depend on untracked app `.env` files.
- Aligned dev/proof project IDs, normalized seeded responder agency ID to `bfp-daet`, projected alert municipality scope with query-provable maps, deduped Declare Alert municipality input, hardened CLI cleanup, and added a regression guard in `scripts/dev-all.ports.test.ts`.
- `proof:local` now builds shared app packages in fresh checkouts, warms Vite routes before C00, opens explicit admin/responder login routes, and mirrors production multi-municipality alert fixtures by omitting scalar `municipalityId`.

## 2026-06-02 - CI Green Main + Dependency Batch

- Fixed main CI blockers: formatting/eslint drift, Terraform BigQuery `default_table_expiration_ms`, missing Storage emulator in Functions rules CI, missing root `esbuild`, `firebase` CLI resolution in dev-all, emulator list-query fragility, and empty custom claims in active-account rules tests.
- Merged dependabot PRs #160-#166; skipped #167 per instruction.
- Follow-up at the time: E2E Full-Loop Proof still needed verification for `pnpm dlx firebase-tools` in the prepare-functions-deploy -> dev-all chain.

## 2026-06-02 - Security / Governance Audit

- Fixed P0 secret logging in `request-lookup.ts`.
- Hardened rules for `report_inbox`, `situation_updates`, and `secret_lookup`; added reporter-only `secret_lookup` coverage and kept rules/template parity except the known transition-table template placeholder.
- Investigated TypeScript 6.0.3 alias/RC, shared micro-package consolidation, and shared-validator test volume; no immediate change except deferring package consolidation to a standalone refactor.
- Added Admin Desktop `StrictMode`.
- Verification: Admin Desktop lint/typecheck, Functions lint, and targeted rules/template diff review passed.

## 2026-06-02 to 2026-05-29 - Citizen PWA Public Content

- Hardened Situation Feed with freshness/retry, offline draft preservation, privacy/moderation copy, missing-field guidance, municipality-specific empty state, and server-ordered latest-100 public query backed by `situation_updates(visibility, createdAt desc)`.
- Replaced stale Citizen PWA Playwright coverage with deterministic report review, offline queue recovery, GPS denial fallback, empty lookup validation, reduced motion, skip navigation, touch target, and overflow evidence.
- Added backend-enforced visibility and admin moderation for citizen situation posts and official alerts, while preserving report publication as the Citizen Map/report visibility path.
- Verification: focused Feed/hook/service tests, Firestore rules emulator tests, full Citizen PWA suite, Citizen PWA lint/typecheck/build, e2e TypeScript, and focused Chromium evidence passed.

## 2026-05-28 - Citizen Engagement UX

- Feed became a separate community situation loop with composer, municipality filters, post cards, Community Pulse counts, moderation reporting, and `situation_updates`; emergency reporting stayed separate.
- Profile gamification was reframed around real lifecycle impact: `Impact Path`, compact completion cues, next-step guidance, and copy focused on reporting skill instead of badge chasing.

## 2026-05-28 to 2026-05-26 - Responder App UX

- Dispatches tab: added compact `DispatchRow`, adaptive list density, removed single-dispatch auto-navigation, added resume banner, removed meaningless active-progress ring, added live freshness heartbeat, and cleaned navigation/CSS issues.
- Alerts tab: added hazard-specific color coding, freshness indicator, capped stale time labels, and removed anti-reference punctuation.
- Profile tab: flattened secondary cards, converted availability to a segmented control, removed dead streak data, clarified metrics copy, and removed responder-to-responder handoff while preserving municipality-level handoff.
- Dispatch detail hardening added retry, offline indicator, textarea limits/counters, reduced-motion SOS behavior, and related tests.

## 2026-05-25 to 2026-05-22 - Dashboard / Emulator Reliability

- Dashboard redesign review fixed 14 issues, including mode/state precedence, Tailwind JIT class purging, PR decomposition, debounce asymmetry, timer cleanup, and affected-geography derivation.
- RTDB/emulator hardening fixed parent `.read`, zombie emulator detection, anonymous auth lifecycle, and runtime dependency checks.
- Admin surfacing/report flow E2E verified Citizen PWA -> emulator inbox -> materialization -> Admin Triage Queue, then fixed protobuf, schema, centroid, `.env.local`, feed moderation, unpublish, and inbox reconciliation issues.

## 2026-05-14 to 2026-05-21 - Staging / Security / Responder Core

- Deployed responder staging with production-build guard, shell cleanup, municipality rules, PWA icons, and seeded account bootstrap.
- Addressed 36 security findings: active-account checks, idempotency atomicity, MFA bypass controls, signed URL TTL, App Check enforcement, FCM rate limits, and anonymous submission rules.
- Functions reached 885 passing tests; Admin Desktop superadmin gating landed.
- Responder PWA rebuild delivered shell, login, dispatch list/detail, messages, map, and profile.

## 2026-05-02 to 2026-05-12 - Foundation Hardening

- Admin Desktop reset consolidated severity/brand tokens, role-scoped reads, municipal performance truth-gates, hold-to-dispatch keyboard parity, sticky bulk actions, window-sync dedup, and offline banner ordering.
- PR #115 review fixed Zod 4 migration issues, race conditions, modal ARIA/focus, redispatch safety, and auth orphan prevention; follow-up 3-app UI audit covered responder, citizen, and admin accessibility/design fixes.
- Citizen auth/wizard work added resumability, QA fixes, PWA install/offline/backoff/image compression/background sync, cancel report flow, live sync, and UX cleanup.

## Older Completed Phases

| Phase    | Status | Notes                                                                               |
| -------- | ------ | ----------------------------------------------------------------------------------- |
| Phase 9  | DONE   | Citizen PWA redesign: Feed/Profile/Alerts, RevealSheet, auth, registration          |
| Phase 8C | DONE   | Erasure (RA 10173): callables, sweeps, rules, delete-account flow                   |
| Phase 7  | DONE   | Security callables, superadmin UI, analytics dashboard, emergency declaration, TOTP |
| Phase 6  | DONE   | Responder app: native shell, push, telemetry, location, field UX                    |
| Phase 5  | DONE   | Analytics: Cluster C + PRE-C                                                        |
| Phase 3b | DONE   | Admin triage + dispatch code complete                                               |
| Phase 0  | DONE   | Foundation tooling passing                                                          |

Removed in `9f520d99` (2026-05-11): SMS inbound pipeline, NDRRMC escalation, PAGASA hazard signals, Break Glass, mass alert broadcast.

## 2026-06-08 - Dependency Fix: `@firebase/database-compat` missing from functions dev dependencies

- Diagnosed and fixed 9 failing tests in `functions/src/domains/ops/__tests__/project-responder-locations.test.ts` and one suite error in `src/__tests__/rtdb.rules.test.ts`.
- Root cause: `firebase@12.14.0` modularized the compat database API that `@firebase/rules-unit-testing@5.0.0` relies on under the hood. `@firebase/database-compat` was not in the lockfile, so `.database()` and `.clearDatabase()` calls returned `TypeError: this.getApp(...).database is not a function`.
- Fix: Added `-D @firebase/database-compat` to `functions/package.json` with `pnpm --dir functions add -D @firebase/database-compat`.
- Verification: Full emulator suite (`firebase emulators:exec --only firestore,database,storage 'npx vitest run'` inside functions/) now passes 79/104 suites, 610/775 tests, 0 failures (25 skipped are emulator-guarded). Root `pnpm test` (23 files, 199 tests) still green. Lint and typecheck clean.

## Open

1. Firebase Console: Phone Auth disabled; App Check 400 errors on staging.
2. Staging redeploy to verify accumulated fixes.
3. Phase 7.C: Staff TOTP enrollment audit.
4. Deferred: four observability dashboards for Phase 11.

## 2026-06-08 - Phase 1G Responder Status Update Loop Completion

- Completed the smallest responder status-update loop gap by trimming the resolution summary before `DispatchDetailPage` sends the existing `advanceDispatch` command.
- Added page-level regression coverage that drives the on-scene resolution action through the UI and proves the cleaned summary reaches the callable wrapper.
- Kept the slice on existing lifecycle commands and read models: no new callable, no direct client lifecycle write, no Admin/Citizen surface change, and no rules/index/schema files touched.
- Verification: red-first `pnpm --dir apps/responder-app exec vitest run src/pages/DispatchDetailPage.test.tsx` failed on the untrimmed summary payload, then passed 16 tests after the patch; `pnpm --dir apps/responder-app exec vitest run src/hooks/useAdvanceDispatch.test.ts` passed 6 tests; responder typecheck and ESLint passed. The focused `advanceDispatch` Firestore-emulator command exited 0 but skipped 6 tests because that test file registers `it.skip` before its `beforeAll` emulator guard updates availability.

## 2026-06-08 - advanceDispatch Emulator Test Harness Fix

- Fixed the focused `advanceDispatch` backend test harness so tests register normally and call Vitest `skip` inside the test body only when the Firestore emulator guard fails.
- The same Firestore-emulator command that previously exited 0 with 6 skipped tests now executes the backend command coverage and passes 6 tests.
- Verification: `firebase emulators:exec --only firestore 'npx vitest run src/domains/dispatches/__tests__/advance-dispatch.test.ts'`, Functions typecheck, Functions ESLint, and focused Responder app status-loop tests passed.

## 2026-06-08 - Responder Status Emulator Harness Follow-up

- Fixed the same emulator-availability collection gap in the focused `acceptDispatch`, `declineDispatch`, and `markDispatchUnableToComplete` backend tests by initializing the Firestore guard before Vitest collects `itif(available)` tests.
- Baseline gap: the three-file responder-status emulator command previously exited 0 with 3 skipped files / 32 skipped tests even though the Firestore emulator was running.
- Enabling `declineDispatch` coverage exposed stale event-count assertions; the command intentionally writes one `status_changed` event and one `notification_delivered` event, so the idempotency test now asserts one of each event type instead of one total event.
- Verification: the repaired three-file responder-status command passed 32 tests, the combined `advanceDispatch`/accept/decline/unable-to-complete emulator command passed 38 tests, Functions typecheck/ESLint passed, and focused Responder app status-loop tests/typecheck/ESLint passed.

## 2026-06-08 - Dispatch Assignment Emulator Harness Follow-up

- Fixed the same collection-time emulator guard gap in `dispatchResponder`, `cancelDispatch`, and `escalateDispatch` backend tests by initializing guarded Firestore/RTDB test environments before Vitest collects `itif(available)` tests.
- Baseline gap: the three-file assignment/cancel/escalate command previously exited 0 with 3 skipped files / 21 skipped tests while Firestore and RTDB were running.
- Enabling coverage exposed stale assumptions: default seeded dispatch severity is `medium` with a 15-minute acknowledgement deadline, and dispatch creation now writes both a lifecycle event and an FCM `notification_attempted` event.
- Replaced `escalateDispatchCore` Admin `FieldValue` transforms with concrete transaction values from the dispatch snapshot, preserving behavior while keeping the core runnable under the rules-test Firestore harness.
- Verification: the repaired three-file command passed 21 tests, the combined dispatch command subset passed 59 tests, and Functions typecheck/ESLint passed.
