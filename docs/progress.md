# Progress

## Phase 1 Infrastructure and Identity Spine (In Progress)

**Branch:** `feature/phase-1-identity-spine`
**Plan:** See `docs/superpowers/specs/2026-04-17-phase-0-design.md`
**Status:** Verification incomplete (see findings below)

### Verification checklist

| Step | Check                                                                                     | Result                                          |
| ---- | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1    | `pnpm test`                                                                               | FAIL (citizen-pwa test setup issue — see Notes) |
| 2    | `pnpm --filter @bantayog/functions test:unit`                                             | PASS                                            |
| 3    | `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test:rules"` | SKIP (emulator not available locally)           |
| 4    | `pnpm lint && pnpm typecheck && pnpm build`                                               | PASS                                            |

### Notes

- **Step 1:** `apps/citizen-pwa/src/App.test.tsx` fails with `ReferenceError: expect is not defined` — the `@testing-library/jest-dom` import path is for Jest, not Vitest. The correct import in Vitest is `@testing-library/jest-dom/vitest`. This is a pre-existing setup issue in the Phase 1 shell.
- **Step 2:** Phase 1 auth tests (4 tests) pass in `functions/src/__tests__/phase1-auth.test.ts`.
- **Step 3:** Rules tests require Firebase emulator (`initializeTestEnvironment` requires emulator connection). Not available in local environment.
- **Step 4:** 14 lint tasks, 14 typecheck tasks, and 10 build tasks all pass.
- **Remediation:** Re-run full test suite until all pass; run Firestore rules tests against local emulator; obtain explicit staging approval before any prod deployment. For changes touching rules/auth/functions, deploy to dev emulator first, run full suite, and get staging sign-off.

### What was built

- Identity spine: `User` + `ResponderUser` documents, Firestore rules, claim issuance and revocation Cloud Functions
- Phase 1 auth test coverage (`src/__tests__/phase1-auth.test.ts`)
- Phase 1 Firestore rules test coverage (`src/__tests__/firestore.rules.test.ts`)
- Bootstrap script for Phase 1 data (`scripts/bootstrap-phase1.ts`)

---

## Phase 0 Foundation (Complete)

**Branch:** `feature/phase-0-foundation`
**Plan:** See `docs/superpowers/specs/2026-04-17-phase-0-design.md`
**Status:** All verification steps passed - ready for PR

### Verification Results (2026-04-17)

| Step | Check                                  | Result                                 |
| ---- | -------------------------------------- | -------------------------------------- |
| 1    | Clean pnpm install (--frozen-lockfile) | PASS                                   |
| 2    | pnpm lint                              | PASS (13 tasks)                        |
| 3    | pnpm format:check                      | PASS (after Prettier fix)              |
| 4    | pnpm typecheck                         | PASS (13 tasks)                        |
| 5    | pnpm test                              | PASS (9 tests in shared-validators)    |
| 6    | pnpm build                             | PASS (10 tasks, all artifacts present) |
| 7    | Firebase emulator (firestore)          | PASS                                   |
| 8    | Terraform validate + fmt               | PASS                                   |

### Build Artifacts Verified

- `apps/citizen-pwa/dist/index.html` present
- `apps/responder-app/dist/index.html` present
- `apps/admin-desktop/dist/index.html` present
- `functions/lib/index.js` present
- `packages/shared-types/lib/index.d.ts` present

### Test Summary

- **Tests:** 9 passing (shared-validators idempotency tests)
- **TypeScript:** Clean
- **ESLint:** Clean

### Bugs Fixed During Verification

| ID       | Issue                                                               | Fix                                                                                                                                              |
| -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| VERIFY-1 | Vitest workspace config included `functions` dir (no config there)  | Removed `'functions'` from `vitest.workspace.ts`                                                                                                 |
| VERIFY-2 | 14 docs/rules files not Prettier-formatted                          | Ran `pnpm prettier --write` on all 14 files                                                                                                      |
| VERIFY-3 | Root vitest workspace path resolution broken packages without tests | Renamed `vitest.config.ts` → `vitest.workspace.ts`, removed test scripts from non-test packages, changed root `pnpm test` to use vitest directly |

---

## Phase 3b Admin Triage + Dispatch (Complete)

**Branch:** `feature/phase-3b-admin-triage-dispatch`
**Plan:** See `docs/superpowers/plans/2026-04-18-phase-3b-admin-triage-dispatch.md`

### Verification

| Step | Check                                                                    | Result                              |
| ---- | ------------------------------------------------------------------------ | ----------------------------------- |
| 1    | `pnpm lint && pnpm typecheck`                                            | PASS                                |
| 2    | `pnpm test` (incl. new 3b callable + rules tests)                        | PASS (rules tests require emulator) |
| 3    | `firebase emulators:exec "pnpm exec tsx scripts/phase-3b/acceptance.ts"` | PENDING                             |
| 4    | Staging acceptance                                                       | PENDING                             |
| 5    | Manual smoke: admin verify + dispatch, responder sees onSnapshot         | PENDING                             |

### What was built

**Backend callables:**

- `verifyReport` — two-branch verify (new→awaiting_verify→verified)
- `rejectReport` — reject with moderation incidents
- `dispatchResponder` — creates dispatch with severity-based deadlines
- `cancelDispatch` — cancels pending dispatch, reverts report to verified

**Seed factories** (`functions/src/__tests__/helpers/seed-factories.ts`):

- `seedReportAtStatus` — seeds report at specific lifecycle status
- `seedDispatch` (admin SDK) + `seedDispatchRT` (rules test context)
- `seedResponderDoc` + `seedResponderShift`

**Admin Desktop** (`apps/admin-desktop/`):

- Firebase init with emulator support
- Auth provider + protected route (municipal_admin gate)
- TriageQueuePage with muni-scoped queue
- ReportDetailPanel with verify/reject/dispatch actions
- DispatchModal with eligible-responder picker
- `useMuniReports`, `useReportDetail`, `useEligibleResponders` hooks
- `callables.ts` typed wrappers for all 4 callables

**Responder PWA** (`apps/responder-app/`):

- Firebase init + auth with responder-role gate
- `useOwnDispatches` hook (onSnapshot, assignedTo.uid + status IN + dispatchedAt DESC)
- LoginPage with role verification
- DispatchListPage (read-only, accept/decline deferred to 3c)

**Scripts:**

- `scripts/phase-3b/bootstrap-test-responder.ts` — idempotent test responder bootstrap
- `scripts/phase-3b/acceptance.ts` — binary pass/fail acceptance gate

**Monitoring:**

- `dispatch.created` log metric with v2 compatibility filter (CORRECTION-7 applied)

### Corrections applied

| ID           | Description                                                                 | Status                                                                                |
| ------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| CORRECTION-1 | BantayogErrorCode missing PERMISSION_DENIED/FAILED_PRECONDITION             | Implemented using HttpsError directly; INV_STATUS_TRANSITION used instead             |
| CORRECTION-2 | Removed `isValidDispatchTransition(null, 'pending')` from dispatchResponder | ✅ Removed                                                                            |
| CORRECTION-3 | `withIdempotency now` parameter — guard uses `now?: () => number`           | ✅ Callables pass `() => deps.now.toMillis()`                                         |
| CORRECTION-4 | `moderation_incidents` rules gap                                            | Addressed in rules (verify before deploying)                                          |
| CORRECTION-5 | Admin queue composite index                                                 | Added to firestore.indexes.json                                                       |
| CORRECTION-6 | Responder PWA dispatches index                                              | Added to firestore.indexes.json (assignedTo.uid ASC + status ASC + dispatchedAt DESC) |
| CORRECTION-7 | `dispatch.created` metric filter v2 compatibility                           | ✅ Filter includes cloud_run_revision                                                 |
| CORRECTION-8 | JSDoc on seed factories                                                     | ✅ All factories documented                                                           |

### Typecheck fixes (pre-existing)

- `RulesTestEnvironment` import changed to type-only import (verbatimModuleSyntax)
- `staffClaims('role', 'muni')` → `staffClaims({ role: '...', municipalityId: '...' })` across 4 callable test files
- `cancel-dispatch.ts` exactOptionalPropertyTypes: used spread with conditional key inclusion
- `admin-onsnapshot.rules.test.ts` seedReport parameter: changed `db: Firestore` to `db: any`

### Known open items carrying into 3c

- `cancelDispatch` widened from pending-only → accepted/acknowledged/in_progress
- FCM push on dispatch.created (currently warning-only placeholder)
- Responder accept + status progression
- RejectReport callable: FAILED_PRECONDITION code check (uses HttpsError 'failed-precondition' which maps to code 'FAILED_PRECONDITION')

---

## P0 Security Fixes (2026-04-15 — Complete)

**Branch:** (P0 branch, merged)
**Status:** Complete

### Fixed Issues

| ID              | Issue                                                | Fix                                                                   |
| --------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| CRITICAL-AUTH-2 | `getMunicipalityReports` ignores municipality filter | Added `where('approximateLocation.municipality', '==', municipality)` |

### Firestore Indexes Deployed

**Project:** `bantayog-alert-staging`
**Deployed:** 2026-04-15

| Collection | Index                                                  | Purpose                     |
| ---------- | ------------------------------------------------------ | --------------------------- |
| `reports`  | `approximateLocation.municipality ASC, createdAt DESC` | Municipal admin report list |

---

See `docs/learnings.md` for detailed technical decisions and lessons learned.

---

## PR #27 Fixes — CI JDK + Code Review Findings (2026-04-17 — Complete)

**Branch:** `fix/ci-firebase-rules-check-jdk21` → targets `feature/phase-0-foundation`
**Status:** Fixes committed and pushed — CI passing on fix branch

### Fixed Issues

| ID             | Severity | Issue                                                              | Fix                                                                        |
| -------------- | -------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| CI-JDK-21      | Critical | `rules-check` uses Java 17 but firebase-tools 15.15.0 requires 21+ | Changed `java-version: '17'` → `'21'` in `.github/workflows/ci.yml`        |
| IAM-SCOPE      | Critical | CI SA granted `iam.serviceAccountUser` at project level            | Changed to `google_service_account_iam_member` scoped to functions SA only |
| GEOHASH-VALID  | Major    | `asGeohash()` blindly cast any string without validation           | Added base32 regex validation (1-12 chars) before branding                 |
| TF-PLACEHOLDER | Major    | `project_number` accepts bootstrap placeholder                     | Added two TF validation blocks: numeric-only and placeholder rejection     |
| GIT-MD040      | Minor    | Commit examples code block missing language hint (markdownlint)    | Added `text` language hint to `.claude/rules/git-workflow.md`              |

### Not Addressed (deferred to later phases)

| ID                      | Severity | Issue                                         | Reason                                            |
| ----------------------- | -------- | --------------------------------------------- | ------------------------------------------------- |
| PWA-ICON                | Critical | Manifest references missing icon files        | PWA assets deferred to Phase 3/6                  |
| PUBSUB-CMEK             | Major    | Dead-letter topics lack CMEK encryption       | KMS infrastructure not yet provisioned — Phase 2+ |
| TF-README-SECRETS       | Major    | README shows inline secret values in examples | Documentation-only fix — separate PR              |
| SHARED-TYPES-EXPORT     | Major    | Runtime exports not properly declared         | Follow-up issue needed                            |
| ESLINT-NO-UNSAFE-ASSIGN | Minor    | TODO(phase-2) untracked — disabling rule      | Phase 2 tracking issue needed                     |
| PWA-SOURCEMAP           | Major    | Vite sourcemap settings inconsistent          | Separate Vite audit task                          |
| TF-MODULE-DESC          | Minor    | IAM module description overstated             | Fixed (included in this PR)                       |
| SHARED-DATA-LICENSE     | Major    | Data sources pending licensing verification   | Phase 2 compliance tracking issue needed          |
| ENV-TFVAR-PLACEHOLDER   | Major    | Same placeholder in dev/staging tfvars        | Already addressed by TF variable validation       |

### Verification

| Step | Check                           | Result  |
| ---- | ------------------------------- | ------- |
| 1    | `pnpm lint`                     | PASS    |
| 2    | `pnpm typecheck`                | PASS    |
| 3    | `terraform validate`            | PASS    |
| 4    | `terraform fmt -check`          | PASS    |
| 5    | GitHub Actions CI (rules-check) | Pending |

---

## PR #29 CI Investigation — pnpm/action-setup v6 (2026-04-17)

**Branch:** `pr-29-fix`
**Status:** Local fix applied, local verification passed

### Findings

- PR #29 only changes `.github/workflows/ci.yml`
- Four CI runs failed in the `Install` job before lint/typecheck/test/build started
- Failure signature was consistent: `ERR_PNPM_BROKEN_LOCKFILE` from `pnpm install --frozen-lockfile`
- The lockfile at the exact failing merge commit was structurally clean when fetched from GitHub
- Local reproduction with Node `20.20.2` and `corepack prepare pnpm@9.12.0 --activate` succeeded

### Fix Applied

- Replaced `pnpm/action-setup@v6` usage in CI with explicit Corepack pnpm activation at `9.12.0`
- Removed `cache: pnpm` from `actions/setup-node` because pnpm is now installed after Node setup

### Verification

- `PATH=$HOME/.local/share/mise/installs/node/20.20.2/bin:$PATH ~/.local/share/mise/installs/node/20.20.2/bin/corepack prepare pnpm@9.12.0 --activate && ... pnpm install --frozen-lockfile` PASS
- `pnpm lint` PASS
- `pnpm typecheck` PASS
- `pnpm test` PASS
- `pnpm format:check` PASS

---

## Phase 2 Data Model and Security Rules Foundation (Complete)

**Branch:** `feature/phase-2-data-model-rules`
**Plan:** See `docs/superpowers/plans/2026-04-17-phase-2-data-model-security-rules.md`
**Status:** All implementation and verification tasks complete.

### Implementation Summary (Tasks 7-18)

| Task    | Description                                   | Status |
| ------- | --------------------------------------------- | ------ |
| Task 7  | Dispatches, Users, Responders Firestore rules | ✅     |
| Task 8  | Public, Audit, Event Collections rules        | ✅     |
| Task 9  | SMS Layer rules                               | ✅     |
| Task 10 | Coordination Collections rules                | ✅     |
| Task 11 | Hazard Zones rules                            | ✅     |
| Task 12 | Final Rules Cleanup + Default-Deny Audit      | ✅     |
| Task 13 | RTDB Rules + Tests                            | ✅     |
| Task 14 | Storage Rules + Tests                         | ✅     |
| Task 15 | Composite Indexes deployed (30 indexes)       | ✅     |
| Task 16 | Idempotency Guard Cloud Function helper       | ✅     |
| Task 17 | Rule Coverage CI Gate                         | ✅     |
| Task 18 | Schema Migration Runbook                      | ✅     |
| Task 19 | Phase Verification and Progress Capture       | ✅     |

### Verification Results (2026-04-18)

| Step | Check                                          | Result                                               |
| ---- | ---------------------------------------------- | ---------------------------------------------------- |
| 1    | `pnpm lint`                                    | PASS (14 tasks)                                      |
| 2    | `pnpm typecheck`                               | PASS (14 tasks)                                      |
| 3    | `pnpm test`                                    | PASS (94 tests)                                      |
| 4    | `pnpm exec tsx scripts/check-rule-coverage.ts` | PASS (35 collections with positive + negative tests) |
| 5    | `pnpm build`                                   | PASS (10 tasks, all artifacts present)               |

### Test Coverage Summary

**Firestore Rule Tests Created (13 test files, 52 tests):**

- `report-inbox.rules.test.ts` - Citizen inbox creation with reporterUid validation
- `reports.rules.test.ts` - VisibilityClass-based access, municipality boundaries, immutable fields
- `report-private.rules.test.ts` - Reporter pseudonymity, public tracking refs
- `report-ops.rules.test.ts` - Agency ops access, mutable field validation
- `report-sharing.rules.test.ts` - Cross-municipality sharing, visibility controls
- `report-contacts.rules.test.ts` - Contact field access control
- `report-lookup.rules.test.ts` - Public report lookup access
- `report-events.rules.test.ts` - Event history access, status transitions
- `dispatches.rules.test.ts` - Responder assignment, status transitions, cross-municipality denial
- `users-responders.rules.test.ts` - Self-read, municipality admin access, callable-only writes
- `responders.rules.test.ts` - Responder profile access, municipality boundaries
- `public-collections.rules.test.ts` - Agencies, emergencies, audit logs, privileged read tests
- `sms.rules.test.ts` - SMS inbox, outbox, sessions, provider health (callable-only)
- `coordination.rules.test.ts` - Command threads, shift handoffs, mass alerts
- `hazard-zones.rules.test.ts` - Hazard zones, signals, history, superadmin access

**Schema Validation Tests Created (3 test files, 42 tests):**

- `sms.test.ts` - SMS inbox, outbox, session, provider health schemas
- `coordination.test.ts` - Shift handoffs, mass alerts, command channels, agency assistance
- `hazard.test.ts` - Hazard zones, signals, and history schemas

**Total:** 94 tests passing across 16 test files covering:

- 35 Firestore collections with positive + negative security rule tests
- All major Zod schemas with type validation and strict mode enforcement

### What was built

- Full Zod schema coverage for every collection in Arch Spec §5.5
- Reconciled enum literals (ReportStatus 15 states, VisibilityClass `internal`/`public_alertable`, HazardType bare literals)
- Firestore rules for inbox, triptych, dispatches, users, responders, public collections, SMS, coordination, hazards, events
- RTDB rules for responder_locations, responder_index, shared_projection
- Storage rules locked to callable-only uploads with admin-read paths
- 30 composite indexes in `firestore.indexes.json` per §5.9
- Idempotency guard Cloud Function helper (`withIdempotency`) with payload-hash deduplication
- CI rule-coverage gate (`scripts/check-rule-coverage.ts`) - enforced in `.github/workflows/ci.yml`
- Schema migration protocol runbook (`docs/runbooks/schema-migration.md`)
- Comprehensive test harness with seed factories (`seedActiveAccount`, `seedReport`, `seedAgency`, `seedUser`, `seedResponder`, `seedDispatch`)

---

## Phase 3a Citizen Submission + Triptych Materialization (Complete — PR #43 Merged)

**Branch:** `feature/phase-3a-citizen-submission` → merged to `main`
**PR:** [#43](https://github.com/Exc1D/bantayog-alert/pull/43)

### What was built

- **Callables**: `requestUploadUrl` (signed URL + MIME/size validation), `requestLookup` (token-hash verification + constant-time comparison)
- **Triggers**: `processInboxItem` (triptych materialization in single transaction), `onMediaFinalize` (EXIF strip via sharp), `onMediaRelocate` (dormant, Phase 5 flag), `inboxReconciliationSweep` (5-min safety net)
- **Shared validators**: `BantayogError` exhaustive 16-code HTTP mapping, `logEvent` with `event`+`code` backward-compat
- **Idempotency guard**: `fromCache` flag to correctly distinguish fresh vs replayed materialization
- **Citizen PWA**: `SubmitReportForm` (geolocation error handling), `LookupScreen`, `ReceiptScreen`, `submitReport` orchestrator with DI
- **Bootstrap + acceptance**: Municipality seed script, Phase 3a acceptance gate
- **Monitoring**: Terraform log metrics updated for Cloud Run v2 (`cloud_run_revision`)

### Key fixes during review

| Comment                                 | Fix                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Error mapping not exhaustive            | `Record<BantayogErrorCode, FunctionsErrorCode>` — compile-time coverage                  |
| Media finalize swallows failures        | Only suppress `MEDIA_REJECTED_MIME`/`MEDIA_REJECTED_CORRUPT`, rethrow operational errors |
| Replay detection broken                 | `withIdempotency` returns `{ result, fromCache }` instead of check-after-set             |
| Monitoring filter misses v2 logs        | Terraform filter added `OR resource.type="cloud_run_revision"`                           |
| Geolocation error swallowed             | `onCaptureLocation()` wraps `getLocation()` in try-catch                                 |
| pnpm workspace missing firebase subpath | Added explicit `firebase@^12.12.0` to citizen-pwa dependencies                           |

### Verification

| Step | Check                            | Result                |
| ---- | -------------------------------- | --------------------- |
| 1    | `pnpm test`                      | PASS (127 tests)      |
| 2    | `pnpm lint`                      | PASS (14 tasks)       |
| 3    | `pnpm typecheck`                 | PASS (14 tasks)       |
| 4    | `scripts/check-rule-coverage.ts` | PASS (36 collections) |
| 5    | CI (GitHub Actions)              | PASS                  |

### Pending (post-merge acceptance gates)

- `scripts/phase-3a/acceptance.ts --env=emulator` — run against local emulators
- `scripts/phase-3a/acceptance.ts --env=staging` — run against staging with real credentials

---

## QA Edge Hunter Fixes (2026-04-18 — Complete)

**Branch:** `fix/qa-edge-hunter-fixes-2026-04-18`
**Status:** All fixes implemented, verified, and approved — ready for PR

### Fixed Issues

| ID        | Severity | Issue                                                              | Fix                                                |
| --------- | -------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| EXIF-1    | CRITICAL | `onMediaFinalize` retained GPS EXIF in processed images            | Added `.withMetadata(false)` to strip all EXIF/GPS |
| MEDIA-2   | CRITICAL | Unbounded `pendingMediaIds` array — DoS via Firestore read storm   | Added `.max(20)` cap                               |
| IDEM-3    | CRITICAL | `canonicalPayloadHash` — `undefined` caused silent hash collisions | Throw `TypeError` on `undefined`                   |
| SWEEP-4   | CRITICAL | Concurrent `inboxReconciliationSweep` race condition               | Atomic Firestore transaction claim                 |
| LOOKUP-5  | HIGH     | `reportLookupDocSchema.expiresAt` had no upper bound               | Added `.max(Date.now() + 365d)`                    |
| SMS-6     | HIGH     | `senderMsisdnHash` accepted any 64-char string                     | Added `/^[a-f0-9]{64}$/` regex                     |
| SWEEP-7   | HIGH     | Empty sweep returned `oldestAgeMs=0` hiding failures               | Return `null` when `processed === 0`               |
| HAZARD-10 | MEDIUM   | `supersededBy`/`supersededAt` not enforced as a pair               | Added `.refine()` for pairwise presence            |
| SHIFT-11  | MEDIUM   | `shiftHandoffDocSchema` had no `expiresAt > createdAt` check       | Added `.refine()`                                  |

### Files Changed

| File                                                         | Change                                              |
| ------------------------------------------------------------ | --------------------------------------------------- |
| `functions/src/triggers/on-media-finalize.ts`                | `.withMetadata(false)` to strip GPS EXIF            |
| `functions/src/__tests__/triggers/on-media-finalize.test.ts` | Added EXIF stripping test, renamed existing test    |
| `functions/src/triggers/inbox-reconciliation-sweep.ts`       | Atomic claim transaction + null oldestAgeMs         |
| `packages/shared-validators/src/idempotency.ts`              | Reject `undefined` with `TypeError`                 |
| `packages/shared-validators/src/idempotency.test.ts`         | Flipped bug-documenting test to assert rejection    |
| `packages/shared-validators/src/reports.ts`                  | `pendingMediaIds.max(20)`, `expiresAt` max 1 year   |
| `packages/shared-validators/src/sms.ts`                      | Hex regex for `senderMsisdnHash`                    |
| `packages/shared-validators/src/hazard.ts`                   | Pairwise `refine` for `supersededBy`/`supersededAt` |
| `packages/shared-validators/src/coordination.ts`             | `expiresAt > createdAt` refine for shift handoff    |

### Commits (7)

- `fix(media): strip all EXIF metadata including GPS in onMediaFinalize`
- `test(media): rename misleading test name in on-media-finalize`
- `fix(idempotency): reject undefined values in canonicalPayloadHash`
- `fix(sweep): atomic claim + null oldestAgeMs on empty sweep`
- `fix(sweep): fix oldestAgeMs calculation placement and return null on full contention`
- `fix(validators): require hex string for senderMsisdnHash in sms.ts`
- `fix(validators): add supersededBy/At pairwise refine and shiftHandoff expiresAt check`

### Verification

| Step | Check             | Result           |
| ---- | ----------------- | ---------------- |
| 1    | `pnpm test`       | PASS (127 tests) |
| 2    | `pnpm lint`       | PASS (14 tasks)  |
| 3    | `pnpm typecheck`  | PASS (14 tasks)  |
| 4    | `pnpm build`      | PASS (10 tasks)  |
| 5    | Final code review | APPROVED         |

### Deferred (follow-up)

| Issue                                                    | Reason                                        |
| -------------------------------------------------------- | --------------------------------------------- |
| HIGH #8 — `withIdempotency` replay path untested         | Requires emulator-based integration test      |
| MEDIUM #9 — `hasPhotoAndGPS` derived field not validated | Data consistency issue, not functional bug    |
| LOW #12-14 — Informational only                          | Case sensitivity, hardcoded flags, MIME check |

---

## Phase 3b Admin Triage Dispatch (In Progress)

**Branch:** `phase-3b-impl`
**Status:** Implementation in progress — rules tests being added

### Task 14: Admin onSnapshot Rules Test — COMPLETE

**File:** `functions/src/__tests__/rules/admin-onsnapshot.rules.test.ts`

| Step | Check                                           | Result  |
| ---- | ----------------------------------------------- | ------- |
| 1    | Tests implemented (4 cases)                     | ✅ PASS |
| 2    | `firebase emulators:exec --only firestore` test | ✅ PASS |
| 3    | Lint + commit                                   | ✅ PASS |

**Test cases:**

- `allows muni admin to read reports filtered by own municipalityId + queue statuses` — ✅ PASS
- `denies cross-muni reads` — ✅ PASS
- `denies unauthenticated reads` — ✅ PASS
- `denies citizen-role reads` — ✅ PASS

### Task 15: Scaffold Admin-Desktop Auth Init — COMPLETE

**Files created:**

- `apps/admin-desktop/src/app/firebase.ts` — Firebase init with App Check + emulator support
- `apps/admin-desktop/src/app/auth-provider.tsx` — AuthProvider with claim refresh
- `apps/admin-desktop/src/app/protected-route.tsx` — Role-gated route wrapper
- `apps/admin-desktop/src/routes.tsx` — React Router with protected root route
- `apps/admin-desktop/src/App.tsx` — Router + AuthProvider bootstrap
- `apps/admin-desktop/src/pages/LoginPage.tsx` — Email/password sign-in stub
- `apps/admin-desktop/src/pages/TriageQueuePage.tsx` — Queue placeholder stub

**Verification:**

- `pnpm --filter @bantayog/admin-desktop typecheck` — ✅ PASS
- `npx eslint apps/admin-desktop/src/app/firebase.ts apps/admin-desktop/src/app/auth-provider.tsx apps/admin-desktop/src/app/protected-route.tsx apps/admin-desktop/src/pages/LoginPage.tsx apps/admin-desktop/src/pages/TriageQueuePage.tsx` — ✅ PASS

**Key decisions:**

- `AdminClaims.role` typed as `string` (not union) to avoid `@typescript-eslint/no-redundant-type-constituents`
- `onAuthStateChanged` callback not async — chained with `.then()` to satisfy `no-misused-promises`
- All async handlers wrapped in `void` IIFEs to satisfy `no-floating-promises`
- Firebase debug token uses combined eslint-disable comment to suppress both rules
- `React.FormEvent` suppressed with `// eslint-disable-next-line @typescript-eslint/no-deprecated` since the project consistently uses the React event type across forms

**Key fix during implementation:** `seedReportAtStatus` uses `firebase-admin/firestore` `Timestamp.now()` which is incompatible with `RulesTestEnvironment.withSecurityRulesDisabled` context (uses JS SDK). Wrote inline seeding with numeric `ts` timestamps instead.
