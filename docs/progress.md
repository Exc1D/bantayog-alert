# Progress

## 2026-05-02 — Citizen PWA Auth + Wizard Resumability (branch: `fix/citizen-pwa-auth-and-wizard-followups`)

Round 2 of the QA staging pass. 5 real code bugs from a 9-issue list — the
remaining 4 are either Firebase Console config (Phone Auth disabled) or
already-fixed-in-code waiting on a staging redeploy (commit `90f29ef`
two-step `report_lookup` for tracking 404).

| #          | Issue                                                                                          | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                         | Files                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A-2        | RegisterPage phone input lacked `id`/`name`/`autocomplete="tel"` (a11y warning)                | Added all three + a real `<label htmlFor="register-phone">`                                                                                                                                                                                                                                                                                                                                                                                 | `pages/RegisterPage.tsx`                                                                                                                 |
| A-3        | Phone number lost when bouncing between `/login` and `/register`                               | Both pages now seed and write `sessionStorage["bantayog.last-phone"]` on every keystroke; resume effect on RegisterPage still wins when `currentUser.phoneNumber` exists                                                                                                                                                                                                                                                                    | `pages/LoginPage.tsx` + `pages/RegisterPage.tsx`                                                                                         |
| B-5        | Step 1 "Skip photo for now" silently advanced with the seeded `'flood'` default                | `useState(initialReportType)` defaults to `''`; `handleNext` validates and shows inline `role="alert"` error when missing; the 8 type buttons clear the error on click                                                                                                                                                                                                                                                                      | `components/SubmitReportForm/Step1Evidence.tsx`                                                                                          |
| B-9 + B-10 | No mid-form persistence and no step restoration on refresh — wizard always restarted at Step 1 | New `wizard-snapshot` service (localforage, 24h TTL, single-snapshot model). `WizardContainer` loads on mount, saves on every `step`/`formData` change, clears on submit success and on Step-1 back-to-home. Photo files intentionally not persisted (File serialization to IDB bloats per-keystroke writes); user re-attaches if needed. `Step1Evidence` accepts `initialReportType` so back-to-Step-1 from Step 2/3 keeps the picked type | `components/SubmitReportForm/index.tsx` (wire) + `services/wizard-snapshot.ts` (NEW) + `services/wizard-snapshot.test.ts` (NEW, 8 tests) |

**Gate:** `pnpm --filter @bantayog/citizen-pwa lint typecheck` clean,
`npx vitest run` 327/327 pass (54 files, +8 from snapshot tests),
`pnpm build` clean (SubmitReportForm chunk +1 KB for snapshot wiring).

**Booked / not in this PR:**

- **A-5 RegisterPage architecture** — `linkWithPhoneNumber` requires `currentUser`, but the codebase has no `signInAnonymously` call anywhere. Fresh users hitting `/register` directly get "Not signed in" toast instead of a usable flow. This is a design question (link vs. fresh sign-in vs. anon-then-link) that needs a dedicated decision, not a 5-line patch.
- **Step 2 back-from-Step-3 field loss** — `Step2WhoWhere` mounts fresh on back navigation; reporter name + msisdn survive via existing localStorage, but location/anyoneHurt/patientCount don't. Snapshot stores them in `formData.step2`, but `Step2WhoWhere` doesn't accept `initialValues` props — adding that would expand scope. Defer until QA flags it.
- **Photo persistence in snapshot** — keep deferred; canvas re-encoding pre-write is a route-level optimization, not a per-keystroke one.

**Verification still required (manual, after staging redeploy):**

1. `/login` → enter phone → navigate `/register` → confirm `+63XXXXXXXXXX` is preserved in the input.
2. `/report` → pick "Flood" → tap Continue (advances to Step 2). Refresh. Confirm wizard resumes at Step 2 with reportType still "Flood" if you tap Back.
3. `/report` → tap "Skip photo for now" without picking a type → confirm "Please select an incident type to continue." appears below the grid (red, `role="alert"`).
4. `/report` → complete Step 1 + Step 2 → tap Submit → confirm receipt screen renders. Refresh while on receipt → confirm snapshot was cleared (visiting `/report` starts fresh).

---

## 2026-05-02 — Citizen PWA QA Follow-ups (branch: `fix/citizen-pwa-qa-followups`)

Round 1 of the QA staging pass. Addressed 4 issues from the 10-subagent
staging QA pass. Scope intentionally narrow (3 files) — broader a11y
`<main>` sweep across non-shell pages booked as a follow-up.

| #   | Issue                                                   | Fix                                                                                                                                                                                  | Files                                                                |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | Offline mode showed Chrome dinosaur                     | Precache `/`, `/index.html`, `/manifest.webmanifest`, both icons on `install`; navigation fetches fall back to cached `/index.html`; cache version bumped `bantayog_shell_v1` → `v2` | `apps/citizen-pwa/public/sw.js`                                      |
| 2   | Settings labels failed WCAG AA contrast (3.1:1 / 4.0:1) | Replaced 6× `text-[#768081]` → `text-surface-600` (~7.4:1) and 1× `text-[#a3adae]` → `text-surface-500` (~5.8:1) using existing Tailwind tokens                                      | `apps/citizen-pwa/src/pages/SettingsPage.tsx`                        |
| 3   | Missing `<main>` landmark on Settings                   | Outer `<div>` → `<main id="main-content">` (matches the skip-link target ID used by `CitizenShell`)                                                                                  | same file as #2                                                      |
| 4   | Wizard Step 2 silently swallowed empty submit           | Bottom action region is now always rendered: shows a `role="status"`/`aria-live="polite"` hint while `locationMethod === null`; renders the existing Button once a method is picked  | `apps/citizen-pwa/src/components/SubmitReportForm/Step2WhoWhere.tsx` |

**Gate:** `pnpm --filter @bantayog/citizen-pwa lint typecheck` clean,
`npx vitest run` 319/319 pass, `pnpm build` emits all 5 precache URLs.

**Pending follow-up sweep (NOT in this PR):** `<main>` landmarks for the other
non-shell screens — RegisterPage, LoginPage, NotFoundPage, GoodbyeScreen,
SubmitReportForm root, LookupScreen, TrackingScreen, ReceiptScreen,
IncidentDetailPage, Onboarding. Defer until QA flags them or the next a11y
sweep — bundling them now would have blown the 3-file scope budget.

**Verification still required (manual, after staging redeploy):**

1. Chrome DevTools → Network → Offline → reload `/` → app shell renders (not dino)
2. Lighthouse a11y on `/settings` → score ≥ 95, no contrast violations
3. `/report` → Step 2 → confirm "Pick a location method above…" hint visible before tapping GPS/Manual

---

## 2026-05-02 — Citizen PWA Hardening Sweep (branch: feat/per-jurisdiction-config)

### All 7 Clusters — COMPLETE

| Cluster | Theme                                                                                                       | PR                                | Status  |
| ------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------- | ------- |
| 1       | 6 critical correctness fixes (PWA install, dead toggles, terminal RevealSheet, photo validation)            | `fix/citizen-pwa-correctness`     | ✅ DONE |
| 2       | Reliability (exponential backoff, error sanitization, FCM rollback + setDoc merge)                          | `fix/citizen-pwa-reliability`     | ✅ DONE |
| 3       | Per-jurisdiction config (municipalityDocSchema ext, useMunicipalityContact hook, parameterized RevealSheet) | `feat/per-jurisdiction-config`    | ✅ DONE |
| 4       | Performance + cleanup (lazy RevealSheet, deleted dead lib files)                                            | `chore/citizen-pwa-cleanup`       | ✅ DONE |
| 5a      | Service Worker background sync (submit-report tag, Firestore REST write)                                    | `feat/citizen-pwa-bg-sync`        | ✅ DONE |
| 5b      | Client image compression (canvas downscale, 200KB skip threshold)                                           | `feat/citizen-pwa-image-compress` | ✅ DONE |
| 6       | Real data export backend (profile + reports + media URLs, GCS envelope + signed URL)                        | `feat/data-export-callable`       | ✅ DONE |

**Gate:** `pnpm lint && pnpm typecheck && npx vitest run` — all green (318 tests pass, 53 files)

**New files:** `useMunicipalityContact.ts`, `RevealSheet.lazy.tsx`, `imageCompress.ts`, `imageCompress.test.ts`, `useMunicipalityContact.test.ts`, `useResumeRegistration.test.ts`

**Deleted:** `lib/photoUpload.ts`, `lib/draftManager.ts`, `lib/localforage.ts`, `lib/__tests__/draftManager.test.ts`

**Pre-approved items deployed:**

- Schema change to `municipalities.ts` — re-run `scripts/bootstrap-municipalities.ts` on emulator before staging promotion
- Storage rules update for `data_exports/` — owner-read rule added with tests (requires emulator verification)

**Post-impl-review fixes applied:**

- SW IndexedDB name fixed from `bantayog_drafts` → `bantayog-drafts` to match localforage instance (with architecture warning comment)
- SW cache cleanup expanded to delete legacy `bantayog-shell-*` caches alongside `bantayog_shell_*`
- `storage.rules`: added `data_exports/{uid}/{file}` owner-only read + write-deny (defense-in-depth)
- Added 3 new test files covering imageCompress, useMunicipalityContact, useResumeRegistration
- `REPORT_INBOX_PATH` dead constant removed from sw.js

---

## Current — Phase 9 Citizen PWA Redesign (branch: feat/citizen-pwa-redesign) — COMPLETE

### Citizen PWA — All 18 Tasks — COMPLETE

| Task                                      | Status  | Notes                                                                             |
| ----------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| 1. Shared `utils/incident-meta.tsx`       | ✅ DONE | 12 incident type icon/label maps + tests                                          |
| 2. Wordmark "VIGILANT" → "BANTAYOG ALERT" | ✅ DONE | CitizenShell + App.routes.test.tsx                                                |
| 3. FeedTab polish                         | ✅ DONE | Lucide icons, chip styles, badge sizing + tests                                   |
| 4. ProfileTab polish                      | ✅ DONE | Same consolidation + auth-aware redesign + tests                                  |
| 5. AlertsTab polish                       | ✅ DONE | Lucide severity icons, issuedBy attribution + tests                               |
| 6. RevealSheet ceremony                   | ✅ DONE | Typewriter (60ms/char), `navigator.vibrate(200)`, secret code copy prompt + tests |
| 7. `useReducedMotion` hook                | ✅ DONE | matchMedia listener + tests                                                       |
| 8. `Toggle` component                     | ✅ DONE | Accessible switch, keyboard, reduced-motion guard + tests                         |
| 9. `useToast` + `Toast`                   | ✅ DONE | 3s auto-dismiss, slide-up + tests                                                 |
| 10. `useOfflineQueueCount` hook           | ✅ DONE | Polls draftStore every 5s + tests                                                 |
| 11. Offline banner in CitizenShell        | ✅ DONE | `useOnlineStatus` + `useOfflineQueueCount` + test                                 |
| 12. Auth-aware ProfileTab                 | ✅ DONE | `onAuthStateChanged`, pseudonymous banner, settings gear + tests                  |
| 13. AlertsTab `issuedBy` row              | ✅ DONE | Attribution + tests                                                               |
| 14. LookupScreen redesign                 | ✅ DONE | Navy header, dual-code inputs, `requestLookup` callable + tests                   |
| 15. RegisterPage (3-step OTP)             | ✅ DONE | Phone → OTP → name with RecaptchaVerifier + tests                                 |
| 16. SettingsPage                          | ✅ DONE | Push/offline toggles, storage estimate, data export, sign-out + tests             |
| 17. Routes (/register, /settings)         | ✅ DONE | routes.tsx + App.routes.test.tsx mocks + tests                                    |
| 18. `requestDataExport` callable wrapper  | ✅ DONE | Placeholder (backend callable not yet implemented) + tests                        |

**Gate:** `pnpm lint && pnpm typecheck && npx vitest run` — all green (203 tests pass, 38/38 files)

**New components/hooks:** FeedTab, IncidentDetailPage, ProfileTab, AlertsTab, useIncident, useAlerts, useReducedMotion, Toggle, useToast, Toast, useOfflineQueueCount, RegisterPage, SettingsPage

---

## Phase 8C — RA 10173 Erasure & Anonymization

### 8C — RA 10173 Erasure Execution — COMPLETE

| Task                            | Status  | Notes                                                      |
| ------------------------------- | ------- | ---------------------------------------------------------- |
| requestDataErasure callable     | ✅ DONE | Sentinel idempotency, write-before-disable order           |
| approveErasureRequest deny path | ✅ DONE | Auth re-enable, sentinel delete, transaction gate          |
| setErasureLegalHold callable    | ✅ DONE | Superadmin + MFA, terminal status guard                    |
| erasureSweep (15 min)           | ✅ DONE | Sequential claim, all-or-nothing, dead-letter path         |
| retentionSweep (daily)          | ✅ DONE | 1-week anonymize, 1-month hard-delete, active erasure skip |
| Firestore rules                 | ✅ DONE | erasure_requests, erasure_active, auditLog                 |
| Storage rules                   | ✅ DONE | Citizen read-own media                                     |
| Citizen PWA delete-account flow | ✅ DONE | Two-step modal, GoodbyeScreen, /goodbye route              |

**Open production launch blocker:** Pseudonymous erasure gap (RA 10173 §16) — citizens who submitted via SMS before registering have no erasure path for pre-registration sms_inbox/sms_sessions data. SMS onboarding path cannot go to production until this is resolved. Requires UID-linkage mechanism at registration time.

---

## 2026-05-01 — QA Test Report Update & Bug Fixes

### QA Test Report Updated

- Rewrote `QA_TEST_REPORT.md` with honest verification status.
- **Important:** Many fixes (both this session and prior commits) are code-only and require a Firebase Hosting redeploy to staging before they can be verified as resolved in the staging environment.

### Fixes Applied in This Session (Code Only — Needs Redeploy)

| Fix                        | File                                            | Issue                                                        |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| PH MSISDN 10-digit support | `packages/shared-validators/src/msisdn.ts`      | `normalizeMsisdn` rejected `9XXXXXXXXX` (no leading zero)    |
| SEO meta tags              | `apps/citizen-pwa/index.html`                   | Missing description, OG tags, Twitter card                   |
| Manifest icons             | `apps/citizen-pwa/public/icons/`                | Created `icon-192.png` and `icon-512.png`                    |
| Onboarding icon            | `apps/citizen-pwa/src/pages/Onboarding.tsx`     | Replaced `watchtower.svg` with `TowerControl` (lucide-react) |
| Code splitting             | `apps/citizen-pwa/vite.config.ts`, `routes.tsx` | 900KB monobundle → ~31KB index + vendor chunks               |
| PWA install prompt         | `apps/citizen-pwa/src/main.tsx`                 | Missing `beforeinstallprompt` handler                        |
| robots.txt + sitemap       | `apps/citizen-pwa/public/`                      | Missing SEO crawler files                                    |
| Test timeouts              | `functions/vitest.config.ts`                    | Emulator tests timing out at 5s default                      |

### Prior Commits Already in Code (Not Yet Verified in Staging)

| Commit    | Fix                                                       |
| --------- | --------------------------------------------------------- |
| `90f29ef` | Report tracking 404 (two-step lookup via `report_lookup`) |
| `edcbebb` | Firestore reporter self-read permission                   |
| `0f2289b` | Anonymous `report_inbox` writes allowed                   |
| `2884b63` | App Check optional, GPS hard timeout                      |
| `0837a56` | Settings gear for unregistered users                      |
| `bdb642e` | Peek/Detail sheet z-index                                 |

### Test Results

- `shared-validators` tests: **18/18 pass** (includes new 10-digit MSISDN test)
- Type checking: **10/10 packages pass**
- Function tests: **172 pass, 99 fail, 519 skipped** (failures are emulator timeout issues, not logic bugs)

### Remaining Blockers

1. **Firebase Console:** Phone Auth disabled — enable in Authentication → Sign-in method
2. **Firebase Console:** App Check 400 errors — verify/disable enforcement on staging Firestore
3. **Deploy:** Redeploy citizen-pwa to staging to verify all code fixes

---

## Phase 7 Provincial Superadmin + NDRRMC + Break-Glass

### PRE-7 — Audit & Auth Foundation (branch: `feature/phase7-pre`)

| Task                                    | Status  | Notes                                                                                             |
| --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| 1. Schema additions (shared-validators) | ✅ DONE | `dataIncidentDocSchema`, extended `breakglassEventDocSchema` + `agencyDocSchema`. 229 tests pass. |
| 2. `requireMfaAuth()` + tests           | ✅ DONE | 6 test cases including edge cases (null auth, missing firebase, non-string factor). 14/14 pass.   |
| 3. `audit-stream.ts` service            | ✅ DONE | Fire-and-forget BigQuery streaming. `@google-cloud/bigquery@^7.9.2` added.                        |
| 4. Audit export batch + health check    | ✅ DONE | 5min batch, 10min health check with FCM alert. `@google-cloud/logging` added.                     |
| 5. Analytics snapshot extension         | ✅ DONE | `resolvedToday` + `avgResponseTimeMinutes` on province summary. 7/7 tests.                        |
| 6. Bare-bones TOTP enrollment page      | ✅ DONE | `/totp-enroll` route, unprotected. Firebase v12 TOTP MFA.                                         |
| 7. Seed break-glass config script       | ✅ DONE | `bcryptjs`, idempotent, `system_config/break_glass_config`.                                       |

**Staging gate:** Pending — needs 24h soak before 7.A can deploy.

### 7.A — Security Callables (branch: `feature/phase7-a`) — COMPLETE

| Task                                                                          | Status  | Notes                                                                                                          |
| ----------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| 1. `initiateBreakGlass` + `deactivateBreakGlass`                              | ✅ DONE | Dual-code bcryptjs verification, 4h session, custom claims, audit stream. Tests pass.                          |
| 2. `sweepExpiredBreakGlassSessions` trigger                                   | ✅ DONE | Scheduled every 5min, clears claims + updates event doc on expiry.                                             |
| 3. `declareEmergency` callable                                                | ✅ DONE | Firestore transaction + FCM fan-out + SMS enqueue. requireMfaAuth enforced.                                    |
| 4. `declareDataIncident` + `recordIncidentResponseEvent`                      | ✅ DONE | Flat top-level collections, forward-only phase transitions.                                                    |
| 5. `setRetentionExempt`, `approveErasureRequest`, `toggleMutualAidVisibility` | ✅ DONE | Collection allowlist, approval-only workflow, mutualAidVisible field.                                          |
| 6. Provincial resources callables                                             | ✅ DONE | `upsertProvincialResource` + `archiveProvincialResource`.                                                      |
| 7. Firestore rules additions                                                  | ✅ DONE | data_incidents, provincial_resources, erasure_requests, system_health, breakglass_events rules added.          |
| 8. Export all + admin-desktop callable wrappers                               | ✅ DONE | All callables exported from functions/src/index.ts; typed wrappers in admin-desktop/src/services/callables.ts. |

### 7.B — Superadmin UI (branch: `feature/phase7-b`) — COMPLETE

| Task                                                          | Status  | Notes                                                                                                                   |
| ------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1. Routes + sidebar nav extension                             | ✅ DONE | `/province/*` routes behind ProtectedRoute; PROVINCE sidebar section (purple), Break-Glass (red, divider).              |
| 2. `useProvinceMetrics` + `useMunicipalPerformance`           | ✅ DONE | 4 onSnapshot sources; 12-municipality batch reads via `CAMARINES_NORTE_MUNICIPALITIES` constant.                        |
| 3. Province Analytics Dashboard                               | ✅ DONE | 6 KPI cards, anomaly alert, MunicipalPerformanceTable (sortable), NDRRMC widget, quick actions, 7-day trend table.      |
| 4. NDRRMC escalation drawer                                   | ✅ DONE | email/sms/portal methods, receipt input, reject-with-reason, sticky disclaimer. Live Firestore query.                   |
| 5. Emergency Declaration modal                                | ✅ DONE | 2-step (form → TOTP verify), impact note, callDeclareEmergency. Trigger button gated to provincial_superadmin.          |
| 6. `useBreakGlass` hook + Break-Glass page                    | ✅ DONE | Force token refresh after initiate/deactivate. Countdown timer. Red banners.                                            |
| 7. ProvinceMap, UserManagement, Resources, SystemHealth pages | ✅ DONE | Map with responder + incident data; user table + erasure drawer; resource CRUD (add/edit/archive); health gaps display. |
| 8. Polished TOTP enrollment page                              | ✅ DONE | 3-step: QR scan (qrcode.react), verify code, recovery codes (generated once, downloadable). Navigates to dashboard.     |

### 7.C — Drill & Verification — IN PROGRESS

| Task                                               | Status         | Notes                                                                                     |
| -------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| 1. Drill test helpers and fixtures                 | ✅ DONE        | `src/__tests__/callables/break-glass.drill.test.ts` covers all 5 drill scenarios.         |
| 2. Final lint + typecheck gate                     | ✅ DONE        | `pnpm exec turbo run lint typecheck` passes after the latest Phase 7.C cleanup.           |
| 3. 100% TOTP enrollment for staff test accounts    | 🔄 IN PROGRESS | `scripts/check-staff-totp-enrollment.ts` audits `multiFactor.enrolledFactors` in staging. |
| 4. Update `docs/progress.md` + `docs/learnings.md` | ✅ DONE        | Progress and learning notes updated for the verification slice.                           |

---

## Phase 6 — Responder App (branch: `phase6/responder-app`) — COMPLETE

| Task                                             | Status  | Notes                                                                                                                                                                          |
| ------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 10: Drill spec + acceptance evidence             | ✅ DONE | 24/24 callable tests pass; 6 E2E scenarios written but skipped (emulator/fixture blockers). Fixed port mismatches (808x→8081) and `Timestamp`→`.toMillis()` for JS SDK compat. |
| 9: Admin desktop agency responder ops            | ✅ DONE | Roster management (`/roster`), agency assistance queue refactor, eligible responder freshness sorting. 37/37 tests pass.                                                       |
| 8: Responder-to-responder handoff + availability | ✅ DONE | `responder_shift_handoffs` schema, `initiate/acceptResponderHandoff` callables, availability status badge + reason in responder app. 227 shared-validators tests pass.         |
| 7: Responder field UX                            | ✅ DONE | Witness report, SOS, backup request, unable-to-complete pages + hooks.                                                                                                         |
| 6: Responder field callables                     | ✅ DONE | 4 new callables (`submitResponderWitnessedReport`, `triggerSOS`, `requestBackup`, `markDispatchUnableToComplete`) + `unable_to_complete` state machine entry.                  |
| 5: Responder location projection                 | ✅ DONE | Scheduled CF every 30s; RTDB `responder_locations` → `shared_projection` with freshness bands + TTL. 9/9 tests pass.                                                           |
| 4: Native telemetry capture                      | ✅ DONE | Unified telemetry client (`@capacitor-community/background-geolocation` native, `navigator.geolocation` web).                                                                  |
| 3: Telemetry contracts + RTDB rules              | ✅ DONE | `responderTelemetryPayloadSchema`, tightened RTDB rules (`capturedAt` 60s floor, `motionState` validation).                                                                    |
| 2: Native push abstraction                       | ✅ DONE | Unified push client (`@capacitor/push-notifications` native, Firebase web FCM).                                                                                                |
| 1: Lock native mobile foundation                 | ✅ DONE | Capacitor v8 plugins installed, iOS/Android shells generated.                                                                                                                  |

**Skipped / residual risks:** E2E dispatch progression, race-loss, native push token registration, background geolocation telemetry — require physical device or deeper emulator orchestration.

## Recently Completed

- **CodeRabbit Round 3 / PR #68 (2026-04-27)** — In progress. Fixed `availabilityReason` rules validation (size cap + null handling), stale `refCount` cleanup, telemetry leak prevention, missing shared-validators exports. Typecheck + lint pass across responder-app, admin-desktop, functions, shared-validators.
- **Test fixture fix (2026-04-26)** — `command_channel_threads/messages` seed data for rules tests.
- **Phase 5 Cluster C + PRE-C (2026-04-25)** — Mass alert SMS/FCM broadcast, NDRRMC escalation flow, analytics dashboard. 31/31 functions tests pass; lint/typecheck 26/26 pass.
- **Task 8: A.3 ShiftHandoffModal + banner (2026-04-25)** — Admin triage queue handoff UI. 4/4 + 8/8 tests pass.
- **PR #63 CodeRabbit fixes (2026-04-24)** — Schema validation, inbox materialization, Firestore rules auth/data-consistency fixes.
- **Phase 5 PRE-B (2026-04-24)** — Schema amendments, rules additions, inbox trigger updates.
- **Refactor audit continuation (2026-04-23)** — `inbound.ts` → `parser.ts` extraction, `dispatch-responder.ts` split, `catch` patterns typed, `shared-ui` `AuthProvider`/`ProtectedRoute` consolidated, 11 shared-ui tests added.
- **Step2WhoWhere refactoring (2026-04-23)** — Phases 1-4: extracted data, hooks, components; reduced 707→289 lines (-59%). 137 tests pass.
- **Code quality + security refactor (2026-04-23)** — 14 `catch (err: unknown)` conversions, error logging improvements, 8 new https-error tests.
- **Phase 5 Responder MVP (2026-04-23)** — Decline callable, queue/detail hooks, Playwright smoke (6 pass, 4 skipped). Fixed stale `enforceAppCheck` binary causing E2E `internal` error.
- **3-Step Wizard Wiring (2026-04-23)** — WizardContainer + SubmissionPanel. 101 tests pass.
- **Phase 8B cost snapshot writer (2026-04-28)** — Scheduled BigQuery summarizer now writes `costSnapshot` into `system_health/latest`; focused writer test passes.
- **Citizen PWA Firebase env fallback (2026-04-22)** — Graceful degradation when `VITE_FIREBASE_*` vars missing.
- **Map Tab (2026-04-22)** — Full Leaflet implementation with public incident + own-report layers.
- **PR #56 Review Fixes (2026-04-22)** — 18 fixes across citizen PWA: guard empty report ref, canvas blob preview for CodeQL, offline state fixes, schema alignment.
- **Phase 4b SMS Inbound Pipeline (2026-04-22)** — Globe Labs webhook, SMS parser with fuzzy barangay matching, auto-reply, integration + acceptance tests. Bug: `publicLocation: null` caused `out_of_jurisdiction` silent routing; fixed by making field optional.
- **Phase 4a Git Recovery (2026-04-21)** — Restored orphaned branch tip to `origin/recovery/phase-4a-outbound-sms`.

## Deferred Decisions

- **4 observability dashboards (Arch Spec §13.9)** — Ops, Backend, Compliance, Cost views deferred to Phase 11 (Audit Hardening). System Health page from 8B already covers surge-time operator needs. These dashboards are a reporting/compliance concern, not a pilot-gate concern.

## Older Completed

- Phase 3b Admin Triage + Dispatch — Code complete; staging UI verification blocked by hosting/cert issues.
- Phase 0 Foundation — All tooling (install, lint, format, typecheck, test, build, emulator, Terraform) passing.
