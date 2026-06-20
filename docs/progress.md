# Progress

## 2026-06-18 - RF-08 Dedupe Firestore emulator test context

- Extracted the repeated `RulesTestEnvironment.withSecurityRulesDisabled` skip/cast wrapper from `functions/src/domains/reports/__tests__/reject-report.test.ts` into `functions/src/__tests__/helpers/firestore-emulator-context.ts`, with a small helper test covering the unavailable-emulator skip path.
- Refactored `reject-report.test.ts` to use `withFirestoreRulesDisabled` and local intent-named helpers for the repeated municipal-admin setup, awaiting-verify report seed, failed-precondition expectation, and moderation-incident assertion. Production code unchanged.
- Red-first proof: the new helper test first failed on the missing module, then passed after the helper was added. Baseline `reject-report.test.ts` was 5/5 before the extraction; after the refactor the same focused emulator suite remained 5/5 with no newly skipped tests.
- Verification: rebuilt `@bantayog/shared-validators` first to remove stale source-map warning noise, then `pnpm --dir functions exec vitest run src/__tests__/helpers/firestore-emulator-context.test.ts`, `firebase emulators:exec --only firestore,database,storage 'cd functions && npx vitest run src/domains/reports/__tests__/reject-report.test.ts'`, `pnpm --dir functions exec tsc --noEmit`, `pnpm --dir functions exec eslint src`, scoped Prettier, `git diff --check`, and `fallow audit --format json --quiet --base main --gate new-only` passed. No deploy; no Firestore rules, RTDB rules, indexes, or schema/migration files changed.
  > Condensed log. Each entry keeps the durable what/why/decisions; routine verification-command lists and "no deploy/no rules changed" boilerplate were dropped (recoverable from git).

## 2026-06-19 - CI Security and Code Quality Hardening

- Hardened `.github/workflows/ci.yml`: default `contents: read` permissions + a `Supply Chain` job running `pnpm audit --audit-level high --prod`. Extended `codeql.yml` with the `actions` language to scan workflow files.
- Removed the PR-only `actions/dependency-review-action@v4` gate (repo lacks Dependency Graph; the action fails before comparing). Did not wire `check-secrets.sh` into CI — it still scans generated artifacts/worktrees.

## 2026-06-18 - RF-01 Backend-only callable runbook

- Documented the remaining RF-01 Bucket B/C Admin callable wrappers as intentionally backend-only for the pilot (`cancelDispatch`, `closeReport`, `mergeDuplicates`, `suspendResponder`, `revokeResponder`, `bulkAvailabilityOverride`, `setRetentionExempt`, `setErasureLegalHold`, `approveErasureRequest`, `suspendUser`, `revokeUser`, `resetUserTotp`, `createUser`, `reopenReport`) in `docs/runbooks/pilot-demo.md#backend-only-operations` with each callable's role/payload/use.

## 2026-06-18 - RF-01 Retire mutual-aid callable batch 1

- Retired Bucket A batch (`shareReport`, `requestAgencyAssistance`, `acceptAgencyAssistance`, `declineAgencyAssistance`, `toggleMutualAidVisibility`) from Admin wrappers, Functions exports/source, tests, and `functions/lib`. Kept Firestore rules: `report_sharing`/`command_channel_threads`/`agency_assistance_requests` are still used by `borderAutoShareTrigger` and `adminOperationsSweep`.

## 2026-06-18 - PR #228 Conflict Resolution + Review Follow-up

- Merged `origin/main`, resolved `TriagePanel.tsx`/`subscribe-to-alerts.ts` conflicts. `ConfirmationModal` now routes backdrop/Escape/Close/Cancel through one loading-aware cancel guard (Close disabled while loading). `TriagePanel` catches async `onReject` failures at the boundary. `buildResponderStatusClaims` treats Firestore `mfaEnrolled` as external input — only forwards booleans, malformed → `false`.

## 2026-06-18 - RF-01 Retire scoped operations map callable

- Retired `listScopedOperationsMap` (Admin wrapper, unused no-payload helper, Functions source/test, stale `lib`) in its own branch.

## 2026-06-18 - RF-10 Remove speculative incident-core contracts

- Executed RF-10 Option A: removed the unused speculative `packages/shared-validators/src/incident-core.ts` layer, its dedicated test, the shared-validators barrel exports, and stale generated `lib/incident-core*` outputs.
- Red-first proof followed the task doc: removed only the barrel export first, then root `pnpm build` and `pnpm typecheck` both passed, proving no runtime consumer imports the public `incident-core` surface.
- This does not touch the PostGIS SQL/history artifacts or revive the deferred runtime migration. No rules, indexes, schema/migration files, or deploy changes.

## 2026-06-18 - PR #227 Conflict Resolution

- Merged `origin/main` to resolve conflicts: kept the PR #226 `WindowSyncMessage` export/alias while preserving PR #227's removal of the dead `suppressNextBroadcast` state/setter. Removed the stale `setSuppressNextBroadcast(true)` from `DashboardPage.handleSelectMunicipality`.

## 2026-06-16 - Remove dead `suppressNextBroadcast` cross-window flag (admin-desktop)

- Removed the set-but-never-read flag from `commandCenterStore.ts` (chose remove over wiring a phantom reader; `WindowSyncProvider` already prevents self-echoes via UUID dedup). Removed the interface field, setter, initial value, the `MapPage.tsx` call site, and 6 `setState` test fixtures. The 3c-21 `DashboardPage` sender lives on an unmerged branch and needs the same removal when it merges.

## 2026-06-15 - 3c-18 Map Reject: Confirmation + Real Reason Picker

- Extracted `REJECTION_REASONS`/`RejectionReason` from `TriagePage.tsx` into `constants/report.ts` (single source). Map `handleReject` now takes `(id, reason, note)`, uses the chosen reason via a `ConfirmationModal` with reason `<select>` + optional note, surfaces errors. `TriagePanel` delegates confirm+reason UX to the page-level modal.

## 2026-06-15 - Phase 3C-20 Dashboard Declare-Alert Error Surfacing

- Fixed the silent failure where a failed province-wide alert only `console.error`'d: added `setActionError(msg)` to `onAlertError`, mirroring re-dispatch/verify handlers. `actionError` already renders via `DashboardFeedbackBanners`.

## 2026-06-15 - 3c-19a Dashboard FCM Metric Truth-Gate

- `getStatusFcmSuccessRate` now returns `?? null` (display) instead of `?? 0`, widened through `StatusBar`/`StatusExpanded`; renders `—` when null, `N%` otherwise. `getModeFcmSuccessRate` keeps `?? 1.0` by design. `StatusBar` gains optional `metricsError` rendering a `role="status"` indicator in the always-visible row.

## 2026-06-15 - 3c-19b Dispatch FCM Metric Truth-Gate

- Mirrors 3c-19a on `/dispatches`: `DispatchStatsCards.fcmSuccessRate` widened to `number | null` with a strict `!== null` guard (`isFcmHigh` false when null); renders `—`/`N%`. `DispatchMonitorPage` surfaces `metricsError` as a non-alarmist `role="status"` banner.

## 2026-06-15 - Round 3 UX Evaluation: command authority, not decoration (admin-desktop)

- New `docs/ux-evaluation-admin-desktop-2026-06-15.md`. Headline numbers: only 9/26 callables in `callables.ts` are UI-invoked (17 server-capable but admin-blind); five built-and-tested components (`ActiveIncidentsTable`, `TrendAnalysisPanel`, `AnomalyAlertPanel`, `ResponderLayer`, `OnboardingTour`) are never mounted; "1-click inspection" is really page navigation; no map on the dashboard; Responder panel discards jurisdiction context; KPI cards lack target/trend/status. Verdict: a read-only monitor with partial write surface, not a command surface. Fix = integration (~3-4 wk), not architecture; earlier rounds graded code-in-place, too generously.

## 2026-06-14 - Admin Control-Contract Fix Slices (3c-17 → 3c-21, docs only)

- Authored 5 fix slices for the control-audit truth defects. 3c-17 (N1): Map overlay panel flips state no layer reads — make All/Active-Only real, drop the rest (YAGNI). 3c-18 (N2): Map reject hardcodes `obviously_false`/no confirm — adopt Triage reject contract. 3c-19 (N3): fabricated `0%` FCM pre-poll. 3c-20 (N4): silent declare-alert failure. 3c-21 (N6+N7): municipality drill-down broken on both paths — dead `select:municipality` branch + Dashboard navigates `?municipality=` while `useUrlSync` reads `?municipalityId=` (a "Real"-rated control silently broken; downgraded to Partial). All audit findings now sliced.

## 2026-06-14 - PR #212 Review Follow-up: Hotline Validation + Responder Auth Gate

- Hoisted `getDocMock` via `vi.hoisted()`; normalized callable error codes by stripping the `functions/` prefix; reused `mdrrmoLabelSchema.maxLength` with an exact digit-count failure message. Closed the responder suspend/revoke Auth gap: backend now calls `setCustomUserClaims` after the Firestore status change (preserving role/scope/`mfaEnrolled`/`lastClaimIssuedAt`). Gate 3: no deactivation UI until Auth propagation is verified.

## 2026-06-13 - Round 2 UX & Design Evaluation (admin-desktop)

- New `docs/ux-evaluation-admin-desktop-2026-06-13.md`: design health 26/40→33/40. May-25 P0 (re-dispatch no-op) and P1 list verified fixed; SLA countdown + resolved-closure new and working. New P0s: no map/geography on dashboard, KPI cards lack meaning, mobile still hard-blocked. Bones (cross-window sync, error discipline, focus traps, idempotency, stale banners, mode logic) all present and tested.

## 2026-06-13 - Phase 3C-12 Dashboard + Responder Operations UX Backlog (docs only)

- Core finding: the only responder list (`useResponderFleet`) filters to available+active — a dispatch-candidate list, not a roster (off-duty/suspended/revoked invisible everywhere); roster needs its own dataset. Dashboard `getUncoveredMunicipalityCount` reads `municipality.activeResponders`, never populated, so every municipality always counts as uncovered. Authored index + slices 3c-13 (roster dataset), 3c-16 (coverage truth-gate), 3c-14 (per-responder override via `bulkAvailabilityOverride`), 3c-15 (suspend/revoke). Gates flagged: management callables are `agency_admin`-only; `/responders` vs roster section; **verify suspend/revoke propagate to Auth claims before shipping**; `createUser` family is a separate surface.

## 2026-06-13 - Phase 3C-07 Admin Hotline Config + Admin-UX Slice Backlog

- Implemented hotline config end-to-end: validators (`mdrrmoLabelSchema`, `MDRRMO_HOTLINE_REGEX`, `updateMunicipalityContactInputSchema`); new `update-municipality-contact` core/callable (role gate `municipal_admin` own-scope / `provincial_superadmin` any, last-write-wins so no `idempotencyKey`, audit via `streamAuditEvent`); Admin `EditHotlineModal` from `CommandHeader` with a keyed `HotlineEditor` child for the one-shot prefill. Zero `firestore.rules` changes (SDK bypasses rules). Authored 6 backlog slices (3c-00 index, 3c-08…3c-11, 3b-12). Dashboard/roster rebuild remains a separate concern.

## 2026-06-13 - Phase 3E Exit Proof

- Hardened `proof-mvp-loop.test.ts` to assert notification evidence by `type` with stable `fcm_no_token` warnings in dispatch/resolution paths. Extended `full-loop.spec.ts` for the live browser states (citizen lookup landing, admin new-report badge/title, responder push-warning banner, dispatch SLA chip). Recorded exit note in `docs/mvp-readiness.md`.

## 2026-06-13 - PR #209 Review Follow-up

- Moved failed re-dispatch error/retry inside `ReDispatchModal` (keeps retry in the focus trap). Cleared stale single-command retry state before failed bulk verify/reject. Extracted `errorClassification.ts` helpers. Applied narrow `// fallow-ignore-next-line complexity` only where the changed-code gate hit inherited page complexity.

## 2026-06-13 - Pre-3D Audit + Phase 3C Dispatch Retry Closure

- Audit: 3B done through 3B-11; 3A P0 backbone through 3A-05 (3A-06 anonymous push is a user gate, 3A-07 verify push waits for staging proof). Closed the `/dispatches` gap: failed first-assignment and re-dispatch commands expose the `ActionErrorBanner` Retry, replaying the original payload/idempotency key; non-retryable errors suppress Retry.

## 2026-06-13 - Phase 3C Admin Operator Completion

- Added rejection confirmation for single + bulk triage reject (reason, trimmed note, count). Added a dedicated Admin permission-denied state for unauthorized listener failures. Added retry for failed single-report actions (replays original payload/key).

## 2026-06-13 - Phase 3C-03 Resolved Dispatch Closure

- `/dispatches` now includes resolved rows in the scoped query, keeps them out of active queues/counts, and renders a bounded "Recently resolved" section with resolved time + resolution summary.

## 2026-06-13 - Phase 3A/3B Audit + Phase 3C-02 SLA Countdown

- Audit: 3B through 3B-11; 3A P0 through 3A-05. Implemented SLA visibility: `/dispatches` includes pending dispatches in the status queue, maps backend `acknowledgementDeadlineAt` to the row deadline, shows a live SLA chip with an overdue state.

## 2026-06-13 - Phase 3B Citizen Experience Completion (3B-09/10/11)

- 3B-09: own-report status hero in the Map detail sheet (plain-language lifecycle copy + next steps, replacing raw enums). 3B-10: review-step readiness guidance from a pure helper (factual, non-blocking, no scores). 3B-11: map situational headline from existing listeners, suppressed while loading/errored/offline, routing active-alert headlines to `/alerts`. PR #208 follow-up: extracted Step 3 render sections for changed-code Fallow.

## 2026-06-12 - Phase 3B Experience-Layer Slices (3B-09/10/11)

- Reviewed the "experiences not screens" proposal: receipt UX, citizen-safe timeline, offline reassurance, advisory surface, hotline disclaimers already exist. One real defect: own-report DetailSheet rendered the raw status enum (3B-09). Added P2 3B-10 (readiness card) and 3B-11 (situational headline). Rejected action-first home restructure, a second reference-number format, and gamified stakes.

## 2026-06-12 - Phase 3B-03 RevealSheet Notification Ask

- Added a success-state notification offer (registered users, `Notification.permission === 'default'`) via `useFcmToken().requestPermission`. Anonymous success CTA links to `/register` rather than asking for permission. Extracted `NotificationPrompt`; fixed consent copy (status + public alerts); robust `requestPermission` failure handling; guarded mount rehydration with `hasFirebaseConfig()`.

## 2026-06-12 - Phase 3B-02 Citizen My Reports Error State

- Added a retryable "My Reports" failure state for the double-failure path (Firestore denied + `requestLookup` fallback fails). Extended `useMyActiveReports` with `status`/`error`/`retry`, keeping cached rows visible with a stale-data note. Wired into ProfileTab.

## 2026-06-11 - Phase 3C-01 Admin New-Report Signal

- Scoped report listeners publish snapshots; the shell keeps a session watermark; `CommandHeader` shows unread count, audio mute, triage nav. Title shows `(N) Bantayog Command` while unseen, restores after visiting `/triage`.

## 2026-06-11 - Phase 3D-01 Responder Push Permission Banner

- Per-session warning for unresolved push permission: `denied` → browser-settings guidance; `default` after failed/skipped token registration → Enable-notifications retry. Wired into `FcmSetup` without changing token acquisition.

## 2026-06-10 - Phase 2F-03 Staging Callable Lifecycle Proof

- `scripts/staging-callable-proof.ts` drives the full loop through deployed staging callables (submit → verify ×2 → dispatch → accept → advance to resolved), mints tokens, exchanges App Check debug token, sets responder RTDB shift, asserts final state + PII isolation, cleans up in `finally`. Requires `STAGING_FIREBASE_API_KEY`/`_APP_ID`/`_APP_CHECK_DEBUG_TOKEN`. Drift recorded: deployed `dispatchResponder` needs RTDB shift `staging:seed` doesn't set. Live run pending (needs operator's local key + env).

## 2026-06-08 - Phase 1L Admin Rejection Notes

- Optional Admin note on `/triage` threaded into existing `rejectReport.notes` (blank omitted, 500-char cap). Verify unchanged (wrapper exposes no verification notes).

## 2026-06-08 - Phase 1K Responder Status Queue

- Expanded Admin lifecycle reads to include `acknowledged`/`en_route`/`on_scene`; added a read-only `/dispatches` responder status queue.

## 2026-06-08 - Phase 1J Triage Stale Data Messaging

- Added a triage stale-data banner when the queue hasn't refreshed in >5 min; listener errors stay on `OfflineBanner`.

## 2026-06-08 - Phase 1I Basic Incident Export

- Added a CSV export of currently-visible filtered triage rows, limited to non-private operational fields (id, type, severity, status, municipality, barangay, description, created time).

## 2026-06-08 - Phase 1H Rejection Reason Selection

- Added a rejection-reason selector to `/triage`, threaded into single + bulk `rejectReport`; default `insufficient_detail`.

## 2026-06-08 - Phase 1G Triage Filters

- Added local filters (status, severity, type, free-text) to `/triage`; changing a filter clears hidden selections so bulk actions can't hit hidden rows.

## 2026-06-08 - Phase 1F Demo Seed/Reset Scripts

- Added local demo seed/reset/reseed scripts around the fixed-ID Camarines Norte seed; reset deletes only known seeded `reports`/`report_ops`/`dispatches`/`alerts`, guarded by Firestore emulator. No prod/broad-wipe.

## 2026-06-08 - Phase 1E MVP Firestore Rule Tests

- Added a rules spine test: citizen-owned tracking reads, cross-citizen denial, anonymous read-only lookup, verified-report municipal queries, callable-only dispatch creation. Test-only.

## 2026-06-08 - Phase 1D Responder Assignment Screen

- Added a first-dispatch assignment queue to `/dispatches` fed by scoped report reads + available fleet, wired to existing `dispatchResponder` with idempotency keys and the re-dispatch success/error pattern.

## 2026-06-08 - Phase 1C Citizen Tracking Timeline

- Replaced the own-report progress strip with a citizen-facing tracking timeline from `MyReport` status/time fields; added terminal copy for rejected reports.

## 2026-06-08 - Phase 1B Admin Triage Workbench

- Added `/triage` as a dedicated workbench (scoped report reads + existing lifecycle callables) so row-level review/verify/reject/route-to-Map no longer lives in Dashboard metrics.

## 2026-06-07 - Phase 1A Citizen Report Form Improvements

- Added real intake fields (description, injured, trapped, location confidence, optional urgency reason); replaced hardcoded severity with `deriveReportSeverity` persisted through snapshot → draft → callable → validators → `report_ops`.

## 2026-06-07 - Phase 0 Stabilize and Narrow Docs

- Added MVP scope, Phase 0 architecture map, repo checklist, Phase 1 backlog. Renamed mismatched ADR filenames (report projections, MVP role scope). Normalized feature-boundary README scaffolds. Documentation-only.

## 2026-06-07 - Architecture Alignment for MVP Core Loop

- Added `docs/architecture/architecture-alignment.md` centering Phase 0/1 on the incident lifecycle (report → triage → verify/reject → dispatch → status → resolution → tracking), a checklist + ADR index, eight Nygard ADRs, and feature-boundary READMEs. No runtime change.

## 2026-06-07 - Fallow-Driven Cloud Functions Unit-Test Coverage

- Extracted `apps/admin-desktop/src/test-utils.tsx`; decomposed `RevealSheet`/`mappers`/`StatusBar`/`MapTab` (+`useMapTab`). Exported `inputSchema` from `merge-duplicates.ts`. Wrote pure-mock unit tests for `redispatch-report` (12) and `merge-duplicates` (11) cores via a shared `createMockDb` pattern asserting Firestore ref paths.

## 2026-06-07 - Fallow-Driven DeclareAlertModal Decomposition

- Split `DeclareAlertModal.tsx` (719 LOC) into `useDeclareAlert` hook, `AlertFormFields`, and a ~195-LOC orchestrator shell; preserved all props/behavior/a11y. No consumer changes.

## 2026-06-07 - Fallow-Driven ProfileTab Decomposition

- Split `ProfileTab.tsx` (778 LOC) into `useProfileTab` + `MilestoneTracker`/`BadgeList`/`ReportCard` + a ~230-LOC shell; preserved `WITHDRAWABLE_STATUSES` export. 3 pre-existing `PeekSheet.test.tsx` failures unrelated.

## 2026-06-07 - Greenfield PostGIS Stage 1 Migration Diff

- Added approved executable Stage 1 artifacts under `infra/postgres/`: incident-core schema SQL, down migration, smoke/query/RLS SQL, runner docs. Creates lifecycle root + report/verification/dispatch/responder-status/geo/alert/privacy/audit/public-card tables with GiST indexes and RLS forced on every table. No Cloud SQL change, no deploy; disposable-DB execution pending (no local psql/Docker).

## 2026-06-07 - Greenfield PostGIS Stage 1 Migration Plan

- Added the Stage 1 plan under `docs/runbooks/migrations/`: old shape, target `incident_core` tables, PostGIS indexes, RLS/default-deny, query proofs, compatibility matrix, rollback, monitoring. Proposal-only.

## 2026-06-07 - Greenfield Architecture Boundary Contracts

- Extended the `@bantayog/shared-validators` incident/PostGIS contracts: lifecycle child-record links, PostGIS store refs, duplicate-cluster query inputs, grouped command route params, a role-aware Ops surface, and public projection events (publish/refresh/unpublish). Non-runtime contract layer.

## 2026-06-07 - Greenfield Incident-Core Contract Seed

- Started the greenfield rebuild as strict incident-core schemas in `@bantayog/shared-validators`: separate operational/verification/publication axes, PostGIS point/bbox/nearby inputs, grouped command envelopes, audit events, private reporter records, sanitized public cards (reject private reporter fields).

## 2026-06-06 - Fallow Duplicate E2E Cleanup

- Removed the weaker Admin UI/UX Playwright spec (kept the auth-hardened `comprehensive-ui-ux.spec.ts`); refactored Responder dispatch detail + Profile and Admin Dashboard out of complexity hotspots into named sections/hooks; consolidated repeated e2e auth/IndexedDB logic; retired stale phase/boundary scripts; consolidated three barangay lists into `@bantayog/shared-validators` and removed `shared-sms-parser`. Duplicated lines 22,393→21,257, dead-code 0.

## 2026-06-06 - Fallow Dead-Code Cleanup

- Removed stale scripts, fixed Functions domain test mock paths + root script deps, pruned misplaced package deps, broke the Citizen query-provider re-export cycle. Added Fallow ignores for generated output dirs. Dead-code → 0.

## 2026-06-06 - Retired Feature Residue Removal

- Removed dead surfaces (field mode, shift handoff, data incident declaration/events, provincial resources, command-channel manual message, retired dispatch timeout sweep) from exports/wrappers/tests/sweeps + PAGASA hazard-signal validators + `breakGlassSession` claim; removed retired rules/index entries. Kept command-channel rules (report sharing + agency assistance still use them). ~20 Admin wrappers with no UI ref now need a product decision (wire/document/retire).

## 2026-06-06 - Audit-Preserving Actions + Dispatch UX

- Option B citizen deletion = withdrawal: backend preserves report/private/contact/lookup and records `cancelReason: citizen_withdrew`. Renamed alert delete→retire/restore; wired responder creation into Dispatch via `createResponder`; added citizen foreground alert + responder-on-way modals; kept verified situation updates 24 h; replaced responder dispatch state list with an accessible progress ring.

## 2026-06-06 - Declare Alert Modal Policy Extraction

- Extracted pure form policy (`declare-alert-form.ts`), confirmation/unsaved-changes dialogs (`declare-alert-dialogs.tsx`), and static options (`declare-alert-options.ts`) from `DeclareAlertModal`, leaving the modal focused on state/validation/submit.

## 2026-06-05 - Simplicity Audit + Dashboard Command Queue Completion

- First no-code simplicity audit: package consolidation still a standalone candidate; highest-confidence win was the Dashboard workflow gap. Completed the Dashboard report command queue (new→review, review→verify, verified→`/map?reportId=`; rejection Feed-owned, assignment Map-owned). Fixed the Map permission banner by removing the denied RTDB `responder_locations` parent listener. Cleaned full-suite warning noise with `act(...)`.

## 2026-06-05 - Admin Responder Presence Correction

- Admin roster mapping now uses the freshest of `lastSeenAt`/`lastTelemetryAt`/availability `updatedAt`, preserving the active+available query, so a just-available responder no longer shows Away.

## 2026-06-04 - Emulator Report Submission Fix

- Fixed three interlocking dev:all bugs: (1) `shared-firebase` used `ReCaptchaV3Provider` unconditionally → App Check 400 cascade; added `CustomProvider` for `VITE_USE_EMULATOR`. (2) `useGpsLocation` lacked a Strict-Mode ref guard → double GPS prompt. (3) `isNonRetryableError` only checked `auth/`; extended to `appCheck/`.

## 2026-06-04 - Admin Desktop Report Flow Browser Proof

- Walked the live loop (Citizen fire report → Feed publish → Map verified dispatch → Dispatch Monitor → Citizen status). Fixed the Map blocker (denied RTDB parent listener → scoped Firestore roster); corrected Feed wording (public map preview).

## 2026-06-04 - Admin Desktop Feed / Dispatch Operational Pass

- Reframed Feed as a Public Information Desk (no backend change). Turned Dispatch into a roster workbench: scoped reads now include unavailable/off-duty/suspended; agency admins add via `createResponder` and set availability via `bulkAvailabilityOverride`.

## 2026-06-04 - Admin Desktop Dashboard Command Queue

- Turned the Dashboard from a read-only wall into a report command surface: new→review, awaiting→verify, every queued report opens the Map with `reportId` selected.

## 2026-06-04 - Local Demo Spine Repaired

- Normal dev seed now creates `municipalities/daet` + active BFP roster fields so manual-Daet reports materialize for Map dispatch. Aligned `seedLocalProofAccounts()` shape; root `pnpm dev` launches `scripts/dev-all.mjs` (frontend-only = `pnpm dev:apps`).

## 2026-06-03 - Investor Demo / Proof Hardening

- Seeded canonical citizen/admin/superadmin/BFP-responder accounts + roster metadata; removed emulator startup hangs (Functions registration, Cloud Logging protobuf, manual inbox). Hardened Declare Alert (public framing, scope guidance, final confirm). Proof now selects the exact row, dismisses onboarding at the click point, verifies citizen/responder alert visibility, dispatch progression, Feed hide/restore, idempotent replay, status mirroring + responder GPS-denial/mobile/reduced-motion/offline/overflow checks.

## 2026-06-03 - PR #168 / CI Proof Follow-Up

- `dev:all` injects emulator-safe Firebase web env defaults (no untracked `.env` dependency). Aligned dev/proof project IDs, normalized responder `agencyId: bfp-daet`, projected query-provable alert municipality scope, deduped Declare Alert input. `proof:local` builds shared packages in fresh checkouts, warms routes, opens explicit login routes, mirrors multi-municipality fixtures (omit scalar `municipalityId`).

## 2026-06-02 - CI Green Main + Dependency Batch

- Fixed main CI blockers (format/eslint drift, Terraform BigQuery expiry, missing Storage emulator, missing root `esbuild`, firebase CLI resolution, emulator list-query fragility, empty claims in active-account rules tests). Merged dependabot #160-#166 (skipped #167).

## 2026-06-02 - Security / Governance Audit

- Fixed P0 secret logging in `request-lookup.ts`. Hardened `report_inbox`/`situation_updates`/`secret_lookup` rules + reporter-only `secret_lookup` coverage. Added Admin Desktop `StrictMode`. Deferred package consolidation to a standalone refactor.

## 2026-06-02 to 2026-05-29 - Citizen PWA Public Content

- Hardened Situation Feed (freshness/retry, offline draft preservation, privacy copy, municipality empty state, server-ordered latest-100 backed by `situation_updates(visibility, createdAt desc)`). Replaced stale Playwright coverage with deterministic report-review/offline-queue/GPS-denial/reduced-motion/skip-nav/touch-target evidence. Added backend-enforced visibility + moderation for citizen posts and official alerts; report publication stays the Map visibility path.

## 2026-05-28 - Citizen Engagement UX

- Feed became a separate community situation loop (composer, municipality filters, post cards, Community Pulse, moderation reporting, `situation_updates`); emergency reporting stays separate. Profile gamification reframed around real lifecycle impact (`Impact Path`, next-step guidance), not badge chasing.

## 2026-05-28 to 2026-05-26 - Responder App UX

- Dispatches: compact `DispatchRow`, adaptive density, removed auto-navigation, resume banner, removed meaningless progress ring, live freshness heartbeat. Alerts: hazard-specific colors, freshness, capped stale labels. Profile: flattened cards, segmented availability control, removed dead streaks + responder-to-responder handoff (kept municipality-level). Dispatch detail: retry, offline indicator, textarea limits, reduced-motion SOS.

## 2026-05-25 to 2026-05-22 - Dashboard / Emulator Reliability

- Dashboard redesign review fixed 14 issues (mode/state precedence, Tailwind JIT purging, PR decomposition, debounce asymmetry, timer cleanup, geography derivation). RTDB/emulator hardening fixed parent `.read`, zombie emulators, anonymous auth lifecycle, runtime dep checks. Verified Citizen→inbox→materialization→Triage E2E; fixed protobuf, schema, centroid, `.env.local`, feed moderation, unpublish, inbox reconciliation.

## 2026-05-14 to 2026-05-21 - Staging / Security / Responder Core

- Deployed responder staging (prod-build guard, municipality rules, PWA icons, seeded bootstrap). Addressed 36 security findings (active-account checks, idempotency atomicity, MFA bypass controls, signed-URL TTL, App Check enforcement, FCM rate limits, anonymous submission rules). Functions reached 885 passing tests; Admin superadmin gating landed. Responder PWA rebuild: shell, login, dispatch list/detail, messages, map, profile.

## 2026-05-02 to 2026-05-12 - Foundation Hardening

- Admin reset: severity/brand tokens, role-scoped reads, municipal performance truth-gates, hold-to-dispatch keyboard parity, sticky bulk actions, window-sync dedup, offline banner ordering. PR #115 review fixed Zod 4 migration, races, modal ARIA/focus, redispatch safety, auth orphan prevention. Citizen auth/wizard: resumability, PWA install/offline/backoff/image-compression/background-sync, cancel report, live sync.

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

## 2026-06-08 - Dependency Fix: `@firebase/database-compat` missing from functions dev deps

- Root cause: `firebase@12` modularized the compat database API that `@firebase/rules-unit-testing@5` uses; `.database()`/`.clearDatabase()` threw `TypeError`. Fixed with `-D @firebase/database-compat` in `functions/`. Full emulator suite then 610/775 passing, 0 failures.

## 2026-06-12 - Ranked Refactor Backlog (rf-00 to rf-11)

- Authored 12 `docs/agent-tasks/rf-*.md` slices: rf-00 index, rf-01 orphaned-callable disposition (20 wrappers, 3 buckets, user-gated), rf-02/03 citizen incident-guard dedup + `buildIncidents` decomp, rf-04/05 functions core decomps, rf-06/07 SubmitReportForm extractions, rf-08 test-scaffolding dedup, rf-09 `shared-sms-parser` removal, rf-10 incident-core keep/remove, rf-11 package-consolidation assessment. Recon corrections: `shared-sms-parser/` still exists with zero consumers despite the 2026-06-06 removal claim; `bulkAvailabilityOverride` lost its Dispatch wiring (only `createResponder` wired). Rejected a whole-codebase rewrite (fallow health 68/C, avg cyclomatic 1.6 = localized debt).

## Open

1. Firebase Console: Phone Auth disabled; App Check 400 errors on staging.
2. Staging redeploy to verify accumulated fixes.
3. Phase 7.C: Staff TOTP enrollment audit.
4. Deferred: four observability dashboards for Phase 11.

## 2026-06-08 - Phase 1G Responder Status Update Loop Completion

- Trimmed the resolution summary before `DispatchDetailPage` sends `advanceDispatch`; added page-level coverage proving the cleaned summary reaches the wrapper.

## 2026-06-08 - advanceDispatch / Responder-Status / Dispatch-Assignment Emulator Harness Fixes

- Converted `advance-dispatch`, then `acceptDispatch`/`declineDispatch`/`markDispatchUnableToComplete`, then `dispatchResponder`/`cancelDispatch`/`escalateDispatch` tests from collection-time `itif(available)` to runtime `skip(...)` so unavailable emulators couldn't make files report success with zero tests. Enabling real coverage exposed stale assumptions: count events by `type` (decline writes `status_changed` + `notification_delivered`; dispatch writes lifecycle + FCM `notification_attempted`); default seeded severity is `medium` (15-min deadline). Replaced `escalateDispatchCore` Admin `FieldValue` transforms with concrete transaction values.

## 2026-06-09 - Phase 2A MVP Pilot Readiness

- Added `proof-mvp-loop.test.ts`: full lifecycle (verify→dispatch→accept→advance→resolve) asserting final report/dispatch/ops/event state, citizen-safe `report_lookup` separation, PII isolation, plus the reject path. Added `proof:mvp-loop` script. Published `docs/runbooks/pilot-demo.md` + `docs/mvp-readiness.md` (recommends 2B staging hardening before P2).

## 2026-06-10 - Phase 2B Staging Pilot Hardening

- Added `.env.staging.example` for all three apps. `staging-seed.ts`/`staging-reset.ts` with 3 guards (refuse if `FIRESTORE_EMULATOR_HOST` set, refuse prod project `bantayog-alert`, require creds); reset deletes only the known seed paths. Added `staging:seed`/`staging:reset`.

## 2026-06-10 - Phase 2D Operational Hardening

- Added runbooks: `rollback.md` (bad Functions/Hosting/rules deploy, broad mutation, report flood), `incident-response.md` (SEV levels, comms templates, LGU escalation), `data-privacy.md` (PII map, retention 30d/90d/1yr, erasure/moderation procedures, compliance checklist). Linked from `mvp-readiness.md`/`pilot-demo.md`.

## 2026-06-10 - Phase 2E Staging Smoke Proof

- Rewrote `staging-smoke-proof.ts` into deterministic seed-ID validation (reports 001-010 shape, `report_lookup` reject citizen-unsafe fields, dispatch/alerts by id, audit counts as notes). Added `staging-e2e-proof.ts` deployment health check (Firestore access, test users + claims, Cloud Run services deployed, seed reports readable) — explicitly does NOT call deployed callables. Real staging execution succeeded (seeded 10 reports/10 lookups/5 alerts/1 dispatch; both proofs passed).

## 2026-06-10 - 2026 Direction Roadmap

- Added `docs/roadmap-2026.md`: end goal = one real LGU pilot live (Daet) by 2026-12-31. Sequence 2F→3 (UX completeness)→4 (prod hardening/observability)→5 (pilot package)→6 (staged live pilot). Slice convention `docs/agent-tasks/<phase>-<seq>-<slug>.md`; PostGIS runtime migration off the table for 2026.

## 2026-06-10 - Phase 2F Kickoff + 2F-02 Callable Client Harness

- Wrote 5 slices (2F-01 console fixes, 2F-02 client harness, 2F-03 lifecycle proof, 2F-04 hosting deploy, 2F-05 Playwright smoke). Implemented 2F-02 `staging-callable-client.ts`: pure REST helpers with injected `fetch` (custom→ID token, App Check debug token, v2 callable invocation); `StagingCallableError.status` exposes the callable error status; same staging guards.

## 2026-06-11 - Phase 3 UX-Completeness Slice Inventory

- Ran the structured audit, wrote 26 slices (3A notifications ×7, 3B citizen ×8, 3C admin ×6, 3D responder ×2, 3E proof ×2, 3X gates ×1). Headline P0 3A: citizen push doesn't exist — `sendFcmToCitizen` helper, SW push/click handlers, in-callable sends on dispatch/resolution/rejection with `notification_attempted` evidence (in-callable, no new trigger, registered tokens only). P2 gates: anonymous push (3A-06, needs rules approval), Filipino/Bikol localization (3X-LOC, blocked on pilot LGU).

## 2026-06-11 - Phase 3A-01 sendFcmToCitizen Helper

- Added `sendFcmToCitizen` to `fcm-send.ts`: resolves `report_private.reporterUid`→`users.fcmToken` (registered only), `sendEachForMulticast` + 1 retry, clears invalid token best-effort, never throws; stable codes `fcm_no_token`/`fcm_network_error`/`fcm_one_token_invalid`. Anonymous reporters → `fcm_no_token` by design. Omitted dead `collapseKey` (YAGNI).

## 2026-06-11 - Phase 3A-02 Citizen Service Worker Push Handlers

- Added raw `push`/`notificationclick` handlers to `public/sw.js` (no Firebase SDK / second SW); defensive parsing, keeps `reportId`, clicks focus existing client or open `/` with `reportId`. `useFcmToken` now waits for `navigator.serviceWorker.ready` and passes the registration to `getToken`.

## 2026-06-11 - Phase 3A-03/04/05 Citizen Push (dispatch / resolution / rejection)

- 3A-03 dispatch: "Help is on the way" + `report_events` `notification_attempted` (push/citizen); moved responder + citizen side effects inside `withIdempotency` so replays don't double-send. 3A-04 resolution: send only on `resolved`, bounded summary excerpt, inside the idempotent op. 3A-05 rejection: neutral "Update on your report" with only `reportId`. Repaired `reject-report.test.ts` from collection-time `itif` to runtime `skip`. Updated `proof:mvp-loop` event counts.

## 2026-06-12 - Fallow CI Quality Gate

- Added a PR-only `fallow-audit` job (`fallow-rs/fallow@v2`, `gate: new-only`, `fail-on-issues`, `fetch-depth: 0`). Full-repo fail gates rejected (inherited debt would fail every PR). Caveat: ~930 plugin-derived entry points disable unused-export detection in app `src/`, but introduced complexity/duplication/dependency/circular findings are caught.

## 2026-06-12 - Phase 3B-04 submitReportFeedback Callable

- Added the citizen `submitReportFeedback` callable/core (active auth, reporter match, `resolved`-only) + validators for payload and `report_feedback/{reportId}`. Overwrite semantics for one-feedback-per-report (corrections replace, preserve original `submittedAt`); idempotent retries.

## 2026-06-12 - Phase 3B-05 Resolved Report Feedback Prompt

- Added a registered-citizen-only "Was this addressed?" prompt to the own-report detail sheet on `resolved`, wired to `submitReportFeedback` (yes/no + optional trimmed comment, retryable failure, local submitted flag). Anonymous/idless reports excluded.

## 2026-06-12 - Phase 3B-06 Lookup Offline State

- Offline-aware anonymous lookup: keeps the entered code, skips the remote callable, shows "You're offline — your code is saved, try again when connected." Mapped `functions/unavailable`/network failures to the same copy; kept the invalid-code message for `not-found`/`permission-denied`.

## 2026-06-13 - Phase 3B-07 PWA Install Prompt Surfacing

- Added `useInstallPrompt` (captures `beforeinstallprompt`, Chromium/iOS state, hides while standalone, one dismissal per surface) + a non-blocking onboarding install panel. RevealSheet wiring is the explicit follow-up (3-file cap).

## 2026-06-13 - Phase 3B-08 Withdrawal Success Confirmation

- Successful withdrawal now says "Your report was withdrawn and is no longer active." from Map and Profile flows; semantics unchanged.

## 2026-06-13 - Phase 3D Responder Safety Warnings

- Verified 3D-01 push banner. Added 3D-02 Profile off-duty/unavailable/on-break advisory (`role="status"`, hidden when available) from the same availability state as the segmented control.

## 2026-06-16 - PR #226 Review Follow-up: WindowSyncMessage + Shared Test Utilities

- Extracted duplicated `WindowSyncProvider` mocks into `test-utils.tsx` (`createWindowSyncContextMock`, module-mock factory, `WindowSyncMessage` re-export). Hardened ingress to full `WindowSyncMessage` validation (storage fallback parses `data`/`timestamp` as `unknown`, validates before dedupe). Fixed Vitest hoisting via async `vi.mock` factories with dynamic `await import('../test-utils')`.

## 2026-06-18 - PR #226 CI and Review Follow-up

- Added runtime rejection-note length enforcement in `MapPage` (>500 trimmed chars stop before `rejectReport`). Simplified `WindowSyncProvider` validation helpers + moved scaffolding to `test-utils.tsx` → Fallow `fail`→`warn`. Added a `renderSelectedMapReport` guard narrowing `report.id` to `string | number` before `String(...)`.

## 2026-06-18 - RF-04/RF-05 Functions Core Decompositions

- RF-04: extracted `redispatch-policy.ts` (terminal-status validation, actor scope, severity deadline, new-dispatch doc) from `redispatch-report.ts`, keeping transaction orchestration/idempotency/events inside. RF-05: extracted `merge-duplicates-policy.ts` (id-set checks, actor/ops validation, primary media reconciliation, terminal update, merge-event payload) from `merge-duplicates.ts`. Converted the merge emulator test to runtime `ctx.skip()`.

## 2026-06-18 - RF-02/RF-03 Citizen Public-Incident Dedup + Mapping Decomposition

- RF-02: extracted `public-incident-guard.ts`, consumed by `usePublicIncidents` + `useIncident`, applying the stricter detail boundary consistently. RF-03: extracted `public-incident-mapping.ts` (raw→`PublicIncident`, media selection, municipality filter); tightened the guard to reject `verifiedAt: null`; `usePublicIncidents` assigns a fresh snapshot version per callback so stale async media resolution can't overwrite newer data.

## 2026-06-18 - RF-06 Wizard Container Decomposition

- Added a runtime guard to `renderSelectedMapReport` so missing or invalid `report.id` values fail fast instead of stringifying to bad selected-report ids in test setup. The guard now narrows `report.id` to `string | number` before `String(...)` to satisfy the repo lint rule.
- Verification: focused `map-firestore-wiring.test.tsx` and `MapPage.ux-completeness.test.tsx` passed 17/17, then `pnpm --dir apps/admin-desktop run typecheck` and `pnpm --dir apps/admin-desktop run lint` passed.

## 2026-06-18 - RF-09 Remove Leftover shared-sms-parser Package

- Removed the stale `packages/shared-sms-parser` workspace package after recon confirmed it had no consumers outside its own manifest.
- Removed the package's lint-baseline row and regenerated `pnpm-lock.yaml` so the workspace inventory no longer includes `@bantayog/shared-sms-parser`.
- Corrected the earlier progress record by append-only note rather than rewriting history. No deploy; no Firestore rules, RTDB rules, indexes, or schema/migration files changed.
- Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test` (26 files / 228 tests), `pnpm build`, scoped Prettier check, `git diff --check`, and `fallow audit --format json --quiet --base main --gate new-only` passed.

## 2026-06-18 - RF-07 Step2WhoWhere Policy Extraction

- Extracted `Step2WhoWhere.handleNext` validation and next-payload derivation into pure `step2-policy.ts`, using the shared Camarines Norte municipality constants for manual centroid/label lookup.
- Kept session-storage persistence, GPS behavior, and React error state in `Step2WhoWhere`; the handler now clears errors, delegates to the policy, maps policy errors back to existing copy, then persists contact memory and calls `onNext`.
- Added policy coverage for valid manual input, valid GPS input with missing location confidence fallback, missing manual municipality, blank reporter name, and blank reporter phone number.
- Verification: red-first `step2-policy.test.ts` failed on missing `./step2-policy.js`, then passed 5/5 after implementation. `pnpm --dir packages/shared-validators build` removed fresh-worktree source-map warning noise. `pnpm --dir apps/citizen-pwa exec vitest run src/components/SubmitReportForm` passed 7 files / 38 tests. `pnpm --dir apps/citizen-pwa exec tsc --noEmit`, `pnpm --dir apps/citizen-pwa exec eslint src`, scoped Prettier check, `git diff --check`, and `fallow audit --format json --quiet --base main --gate new-only` passed with only inherited findings. No deploy; no Firestore rules, RTDB rules, indexes, or schema/migration files changed.
- Extracted report-wizard state, snapshot hydration, draft creation, and post-submit local-save side effects from `SubmitReportForm/index.tsx` into `useReportWizard`.
- Kept `SubmitReportForm` as a thin render shell plus small step panels; `SubmissionPanel` behavior stayed in place and was not broadened.
- Added a hook-level regression test for step transitions, snapshot-load autosave gating, and final draft payload creation.
- Verification: red-first `useReportWizard.test.tsx` failed on missing `./useReportWizard.js`, then passed 3/3 after implementation. The RF-06 Citizen PWA suite passed 10 files / 45 tests. `pnpm --dir apps/citizen-pwa exec tsc --noEmit`, `pnpm --dir apps/citizen-pwa exec eslint src`, scoped Prettier check, `git diff --check`, and `fallow audit --format json --quiet --base main --gate new-only` passed. No deploy; no Firestore rules, RTDB rules, indexes, or schema/migration files changed.
- Turned the resolved `/grill-me` decisions for `docs/bantayog-alert-citizen-pwa-spec.md` (v2.0) into `cpwa-00` index + 9 slices. Resolved: bottom nav `Home · Map · Report · Feed · Profile` (Alerts→Home bell, `/alerts` route survives); Home `/` "Your Local Brief" hero; Map demotes to `/map`; §9 Response Thread becomes primary tracking at `/track/:id`; one shared status registry (cpwa-01); Home-only motion override (cpwa-06, reduced-motion fallback mandatory). P0: cpwa-01, cpwa-02 (IA/routing), cpwa-07 (Response Thread). Open seams: §6.14 ending copy (cpwa-05), weather as truth-gated empty slot (cpwa-04), Map alert-zone layer defers if alert docs lack geometry. Rejected: full-screen takeover, looping hazard backgrounds, tracking-in-Map-sheet, second status component per surface.

## 2026-06-19 - CPWA-01 Shared Two-Signal Status Registry

- Added one pure registry for severity, public operational stage, hazard type, and freshness presentations; every entry exposes a color token, icon, and label with defined unknown-value fallbacks.
- Re-pointed `getSeverityStyle` to the registry without changing its public shape or rendered values.
- Verification: red-first missing-module and missing-axis failures were observed; focused Vitest passed 2 files / 9 tests, then Citizen typecheck, lint, scoped Prettier, and `git diff --check` passed. No deploy; no rules, indexes, schema, or migration files changed.

## 2026-06-19 - CPWA-02 Citizen IA and Routing Spine

- Moved Home to `/`, Map to `/map`, added a hidden-nav `/track/:id` placeholder, and changed the bottom nav to Home, Map, Report, Feed, Profile while preserving `/alerts` through a working Home-header bell.
- Added layout-stable labelled Home slots for the local brief, report, nearby, weather, and emergency contacts. Unread-count wiring remains in CPWA-03.
- Map-intent `/` callers inventoried for owning slices: `ReportStatusPill`, `LookupScreen`, Profile report cards, and Map router-state cleanup.
- Verification: each route/nav contract was observed red first; focused route/shell tests passed 18/18, full Citizen Vitest passed 80 files / 557 tests, and Citizen typecheck, lint, scoped Prettier, and `git diff --check` passed. No deploy; no rules, indexes, schema, or migration files changed.

## 2026-06-19 - CPWA-03 Home Header and Alerts Bell

- Replaced the Home header skeleton with a time-of-day greeting, optional municipality chip, truth-gated freshness, and an alerts bell whose unread badge renders a visible count and uses the CPWA-01 freshness token.
- Added `HomeDataProvider` at `CitizenShell` so Home, later Home modules, and `ReportStatusPill` can share the shell-owned alert/report snapshots instead of adding another live subscription.
- Verification: red-first `HomeHeader.test.tsx` failed on the missing module; shell integration failed while Home still rendered the skeleton. Focused Home header/shell/status-pill tests now pass 20/20, and Citizen typecheck, lint, scoped Prettier, and `git diff --check` passed. No deploy; no rules, indexes, schema, or migration files changed.
- Stabilized the App route smoke test around the new shell-owned Home data path by mocking live shell hooks and moving mocked splash completion into `useEffect`; the route file now passes cleanly without React `act(...)` warnings.
- Final verification: focused App-route/Home-header/shell/status-pill Vitest passed 4 files / 30 tests; full Citizen Vitest passed 81 files / 561 tests (remaining stderr belongs to pre-existing offline/error-log and unrelated act-warning tests); Citizen typecheck, lint, build, scoped Prettier, `git diff --check`, and Fallow `new-only` audit passed. No deploy; no rules, indexes, schema, or migration files changed.

## 2026-06-20 - CPWA-04a Home Secondary Stack: Report and Nearby

- Replaced the Home `Your report` placeholder with a compact active-report card that maps existing report statuses through the CPWA-01 operational-stage registry, renders icon plus label, and links to the current Profile report surface until CPWA-07 owns `/track/:id`.
- Replaced the Home `Nearby` placeholder with an independent public-incident card that reuses `usePublicIncidents` only after Home has a known coordinate, computes client-side distance bands from known report coordinates, and keeps module-scoped loading, empty, error, and retry states so sibling modules remain visible.
- Kept `Today's weather` truth-gated as unavailable because Citizen PWA has no real weather source yet; emergency contacts remain a CPWA-04b follow-up to keep the slice bounded.
- Verification: red-first secondary-stack Vitest failed on missing `SecondaryStack`; a follow-up red test caught the no-location Nearby wrapper still subscribing to public incidents; focused CPWA/Home route tests passed 5 files / 34 tests, Citizen typecheck, lint, and scoped Prettier passed, full Citizen Vitest passed 82 files / 565 tests with inherited shared-validator source-map/offline/error-path stderr, Citizen production build passed, `git diff --check` passed, and Fallow `new-only` passed. No deploy; no rules, indexes, schema, or migration files changed.

## 2026-06-20 - CPWA-05 Home Dynamic Hero

- Replaced the Home `Your local brief` skeleton with a bounded dynamic hero that renders loading, stale/error, unknown-area, calm, nearby-incident, and official-alert states without taking over the full screen.
- Propagated shell-owned alert/report loading and error status through `HomeDataProvider` so calm copy appears only after alert, report, and incident sources are settled.
- Hoisted the Home public-incident subscription result once and fed both the hero and Nearby card from it; if Home lacks a known report coordinate, the hero withholds calm and Nearby stays empty instead of subscribing to all public incidents.
- Extended the shared severity registry for `critical` official alerts so the hero keeps icon plus `CRITICAL` label instead of falling through to the unknown `INFO` fallback.
- Verification: red-first `HomeHero.test.tsx` failed against the placeholder hero; a second red test caught critical severity falling through to `INFO`; a post-review red test caught empty municipality labels widening the public-incident subscription; focused hero/registry tests passed 2 files / 9 tests, full Citizen Vitest passed 83 files / 570 tests with inherited shared-validator source-map/offline/error-path stderr, Citizen typecheck, lint, scoped Prettier, production build, `git diff --check`, and Fallow `new-only` passed. No deploy; no rules, indexes, schema, or migration files changed.

## 2026-06-20 - CPWA-06 Home Motion Layer

- Added stable Home-only Motion wrappers for the hero and secondary modules, with a one-shot entrance sequence that uses transform and opacity without changing reserved layout.
- Added a mandatory reduced-motion branch that renders immediate opacity-only transitions with no transform, stagger, pulse, or press scaling.
- Added a restrained official-alert entrance, receded secondary modules, and stopped the Home alert badge and Report FAB ambient motion while emergency content is active.
- Verification: red-first `motion.test.tsx` failed on the missing Home motion wrappers, and the shell regression test failed while the emergency Report FAB still retained `fab-breathe`; focused motion/shell tests passed 2 files / 13 tests, full Citizen Vitest passed 84 files / 574 tests with inherited shared-validator source-map/offline/error-path and unrelated `act(...)` stderr, Citizen typecheck, lint, scoped Prettier, production build, `git diff --check`, and Fallow `new-only` passed with zero introduced findings. No deploy; no rules, indexes, schema, or migration files changed.

## 2026-06-20 - CPWA-07 Response Thread

- Replaced the `/track/:id` placeholder with a full-height Response Thread that reuses the existing active-report source and accepts either the report ID or public tracking reference.
- Added a pure five-stage tracking model with a conservative unknown-status fallback, an explicit not-accepted path, non-fabricating cancellation and duplicate closure, and narrative events only when exact timestamps exist.
- Added a sticky identity/current-stage header, icon-plus-label stepper, progressive stage disclosure, citizen-safe dated updates, and loading, retry, not-found, and back-navigation states without the main bottom navigation.
- Verification: the red-first timeline test failed on the missing model and the route test failed against the placeholder; timeline coverage now passes 18/18, focused route/model coverage passes 2 files / 28 tests, and full Citizen Vitest passes 85 files / 592 tests with inherited shared-validator source-map/offline/error-path and unrelated `act(...)` stderr. Citizen typecheck, lint, scoped Prettier, production build, `git diff --check`, and Fallow `new-only` passed with zero introduced findings. No deploy; no rules, indexes, schema, or migration files changed.

## 2026-06-20 - CPWA-08 Detail Sheet Peek and Deep Links

- Demoted the Map detail sheet to compact public-incident and own-report peeks; own reports reuse the CPWA-07 timeline model and CPWA-01 operational-stage registry, while public incidents link to `/incidents/:id`.
- Removed the own-report sheet's embedded full timeline and page-like actions, then linked its status summary and tracking code to `/track/:id`.
- Replaced the report status pill's color-only status signal with the shared icon-plus-label presentation and repointed its expanded state, responder notice, Home card, Profile card, and successful submission sheet to `/track/:id`.
- Verification: red-first tests failed on the missing deep links, legacy status presentation, and embedded timeline; focused coverage passed 5 files / 40 tests, full Citizen Vitest passed 85 files / 568 tests with inherited shared-validator source-map/offline/error-path and unrelated `act(...)` stderr, Citizen typecheck, lint, scoped Prettier, production build, `git diff --check`, and Fallow `new-only` passed with zero introduced findings. No deploy; no rules, indexes, schema, or migration files changed.

## 2026-06-20 - CPWA-09 Map Secondary Surface

- Made each Home Nearby incident an accessible link to `/map?municipality=...`; Map applies that URL value once through its existing municipality filter, then leaves later chip selection under user control.
- Aligned public-incident and own-report pin labels with the CPWA-01 hazard, severity, and operational-stage registry while preserving the existing marker layers, colors, listeners, and peek-to-detail routes.
- Deferred alert/affected-area zones because the current alert documents expose municipality IDs but no geometry; no circle, polygon, or other affected area was fabricated.
- Verification: the red-first Nearby test failed because no link existed, then focused coverage passed 1 file / 4 tests; full Citizen Vitest passed 85 files / 568 tests with inherited shared-validator source-map/offline/error-path and unrelated `act(...)` stderr. Citizen typecheck, lint, scoped Prettier, production build, `git diff --check`, and Fallow `new-only` passed with zero introduced findings. No deploy; no rules, indexes, schema, or migration files changed.

## 2026-06-20 - CPWA Ponytail Cleanup

- Removed dead freshness registry states, test-only registry exports, and the test-only `NearbyCardFromSource` wrapper from the CPWA stack.
- Collapsed `getSeverityStyle` to return the shared severity registry presentation directly while preserving the existing compatibility type for callers.
- Verification: focused status-registry, severity-style, and secondary-stack Vitest passed 3 files / 13 tests; Citizen typecheck, lint, scoped Prettier, and `git diff --check` passed. No deploy; no rules, indexes, schema, or migration files changed.

## 2026-06-20 - CPWA-04b Home Emergency Contacts

- Wired the empty Home "Emergency contacts" slot to the existing `useMunicipalityContact` hook: `HomeTab` maps the resolved location label to a municipality id (`municipalityIdFromLabel` using the shared `MUNI_LABELS_SORTED` constants), subscribes for `{ label, hotline }`, and renders an `EmergencyContactsCard` with a real `tel:` call link.
- `phoneHref` strips formatting to a dialable `tel:` value and returns `undefined` when no digits remain, in which case the card shows a `role="alert"` "Hotline unavailable" fallback instead of a dead link. The hook always falls back to `DEFAULT_CONTACT` (Daet MDRRMO) so the slot is never empty.
- Applied on top of the Ponytail Cleanup base, so the now-removed `usePublicIncidents`/`NearbyCardFromSource` wrapper was not reintroduced.
- Verification: focused `secondary-stack` Vitest covers the `tel:0547211216` link from `(054) 721-1216`; Citizen typecheck and lint passed. No deploy; no rules, indexes, schema, or migration files changed.
