# Progress

## MVP Reliability Spine (2026-05-24)

### Shipped

- **Stale SMS / NDRRMC / break-glass source cleanup**:
  - Removed `smsDeliveryReport` HTTP handler (deleted `functions/src/http/sms-delivery-report.ts`)
  - Removed `buildSmsPayload`, `SmsPayload`, `report_sms_consent` reads from `dispatch-responder-writes.ts`
  - Removed `sms_outbox` and `sms_inbox` from `declare-data-incident.ts` allow-list (with tests proving rejection)
  - Deleted SMS-only validator source files and tests (`sms.ts`, `sms-encoding.ts`, `sms-templates.ts` + test files)
  - Removed stale exports from `packages/shared-validators/src/index.ts` and `coordination.ts`
- **Firebase rules cleanup**:
  - Removed `breakglass_events` match block from both `firestore.rules` and `.template`
  - Removed `'sms'` from `user_consents.method` allowlist
  - Removed breakglass read/write/superadmin tests from `public-collections.rules.test.ts`
  - Added `user-consents.rules.test.ts` assertion that `method: 'sms'` is rejected
- **Admin Desktop public feed and official alerts**:
  - `FeedPage` now splits into moderation queue (left) + public feed preview + recents alerts (right)
  - Public feed renders `visibilityClass === 'public_alertable'` reports with `submittedAt` desc sort
  - Hides private reporter/contact fields; renders `'Location pending'` and `'Report details pending'` fallbacks
  - Recent alerts from `alerts` listener render with hazard type + municipality scope
- **Responder `/feed` + `/alerts`**:
  - `usePublicFeed` — Firestore subscription to `reports` with `visibilityClass === 'public_alertable'` + `orderBy('submittedAt', 'desc')` + `limit(50)`
  - `useOfficialAlerts` — Firestore subscription to `alerts` with `orderBy('publishedAt', 'desc')` + `limit(20)`
  - `FeedPage` and `AlertsPage` with loading / empty / error states, `timeAgo`, media grid, status chips
  - Shell bottom nav reordered: **Dispatches · Map · Feed · Alerts · Profile** (5 tabs; CSS adjusted for 5-column grid)
  - Routes updated with `/feed` and `/alerts` inside `<Shell>`; detail routes remain outside
- **Dispatch error clarity on admin map**:
  - `MapPage` now preserves specific `Error.message` text from `dispatchResponder` rejections
  - Action-error banner clears before new dispatch/verify attempts
  - `TriagePanel` dispatches only when `report.status === 'verified'`

### Deferred (post-MVP)

- Semaphore / Globe Labs SMS delivery layer
- NDRRMC escalation queue (`requestMassAlertEscalation`, `massAlertReachPlanPreview`)
- PAGASA scraper / hazard signal ingest (`hazard_signals` automated updates)
- Break-glass session / dual-control unseal (`breakglass_events`, `sweep-expired-break-glass-sessions`)
- Province-wide mass alert direct send >5k recipients (all routed to NDRRMC escalation)

### Tests passing gate

- Admin Desktop: 17/17 (`feed-page.test.tsx`, `map-firestore-wiring.test.tsx`)
- Responder App: 31/31 (hooks + pages + routes + Shell)
- Functions: typecheck clean
- Rules: `public-collections.rules.test.ts` + `user-consents.rules.test.ts` updated

### Browser verification (emulator + dev servers)

- Admin `/feed` at 1280×800 — moderation queue + official alerts + public feed preview render correctly; no console errors
- Responder `/feed` at 375×812 — "Public Feed" header + 5 bottom tabs (Dispatches · Map · Feed · Alerts · Profile) with no overlap; empty state readable
- Responder `/alerts` at 375×812 — "Alerts" header + same 5-tab nav; no overlapping labels
- Privacy notice modal appears for first-time responder login (expected behavior)

---

## Current Status (2026-05-22)

**Security audit complete. ALL Critical + High findings fixed (22 of 22). 55 of 59 total fixed or confirmed safe.**
**Remaining: 4 findings — M-20 (VPC Service Controls, infra-only), L-1/L-2/L-17 (documented acceptable risks)**

**Phase 1 — Domain reorg:**

- `functions/src/callables/` (53 files) → 8 domain directories under `functions/src/domains/`
- `functions/src/triggers/` (13 files) → moved to respective domains
- `functions/src/scheduled/` (5 files) → moved to respective domains
- `functions/src/services/` (8 files) → domain-specific moved, cross-cutting retained
- `functions/src/auth/` (2 files) → moved to `domains/users/`
- `index.ts` updated incrementally — all 55 exports now point to domain paths
- `vitest.config.ts` extended to discover `src/domains/**/__tests__/**/*.test.ts`
- **121 domain files** organized by business domain (media, users, alerts, agency, ops, reports, dispatches, erasure)

**Phase 2 — shared-state-machines extraction:**

- New `@bantayog/shared-state-machines` package created at `packages/shared-state-machines/`
- Extracted from `packages/shared-validators/src/state-machines/`: 3 transition-table state machine files + 2 test files
- `shared-validators` re-exports from new package; `scripts/build-rules.ts` path updated
- Removed stale `shared-types/src/states.ts`

**Phase 3 — Cross-cutting to domains/shared/:**

- Moved 7 files into `functions/src/domains/shared/` (`https-error`, `app-check-config`, `callable-config`, `geocode`, `municipality-lookup`, `rate-limit`, `responder-eligibility`)
- ~100 import paths updated across 43 domain files + 6 test files
- Empty `callables/` and `services/` directories removed

**Test migration:**

- 15 test files moved from `functions/src/__tests__/` to respective domain `__tests__/` directories (35 import paths updated)
- 31 infrastructure/rules tests remain in `functions/src/__tests__/`

**municipalityLabel fencepost fix:**

- `baseFromStored()` in `useMyActiveReports.ts` now reads `municipalityLabel` from localForage on initial seed

**Architecture hardening sweep (2026-05-21):**

- **Suspended superadmin fix**: `isAccountActive()` guard added to `setStaffClaims` + `suspendStaffAccount` in `users/account-lifecycle.ts`
- **Arbitrary FCM subscription fix**: `verifyTokenOwnership()` added to `subscribeToAlerts` + `unsubscribeFromAlerts` in `alerts/` domain
- **App Check normalization**: 18 files migrated from `process.env.NODE_ENV === 'production'` to `shouldEnforceAppCheck()` helper; 6 callables that completely lacked `enforceAppCheck` now have it
- **CORS fix**: `users/account-lifecycle.ts` superadmin callables now use `getAdminCallableCorsOrigins()` instead of citizen PWA origins
- **RTDB rule fix**: Removed broken `root.child('responders')` lookup from `responder_index/$uid/.write` (Firestore data does not exist in RTDB)
- **Memory config**: 7 heavy callables upgraded to `memory: '512MiB'` (`createResponder`, `createUser`, `getOpsMetrics`, `shareReport`, `dispatchResponder`, `redispatchReport`, `declareAlert`)
- **Admin-desktop code splitting**: Added `manualChunks` (vendor + firebase) in `vite.config.ts`
- **Legacy claim migration**: `cancelReportByCitizen` now uses `isAccountActive()` instead of raw `claims.active === true`

**Design spec**: `docs/superpowers/specs/2026-05-20-architecture-refactoring-design.md`
**Gate**: `pnpm --dir functions typecheck` clean · `pnpm --dir functions lint` clean · 98 domain tests pass · `@bantayog/shared-state-machines` typecheck + test + build clean

---

## Sprint Log (May 2026)

### 2026-05-21 — Security Audit + Week 1-3 Critical Fixes

- **Full security audit**: 59 findings across backend, frontend, and infrastructure (6 Critical, 14 High, 22 Medium, 17 Low)
- **C-1 Fixed**: `escalateDispatch` — added role + account status check at callable entry
- **C-2 Fixed**: `registerCitizen` — added existing-role guard to prevent privileged claim stripping
- **C-3 Fixed**: Idempotency guard — result persistence now atomic via transaction
- **C-4 Fixed**: Erasure sweep — resumable with checkpoint tracking + batched Firestore writes (400 ops/batch)
- **C-5 Fixed**: `system_config` — restricted read to authenticated users
- **C-6 Fixed**: Implemented missing `smsDeliveryReport` HTTP webhook with HMAC verification, provider detection (Semaphore/GlobeLabs), idempotent processing
- **H-1 Fixed**: `requireAuth` — added `accountStatus === 'active'` check (cascade fixes H-2, H-4)
- **H-3 Fixed**: `advanceDispatch` — added rate limiting (30/60s, consistent with accept/decline)
- **H-4 Fixed**: `report_inbox` create rule — now uses `isAuthed()` helper
- **H-5 Fixed**: `requestUploadUrl` — TTL reduced from 5min to 60s; storage path now user-bound `pending/{uid}/{uploadId}`
- **H-6 Fixed**: MFA now required in staging; explicit `ALLOW_MFA_BYPASS=true` env var required for bypass
- **H-7 Fixed**: RTDB `capturedAt` window tightened to +10s/-60s (was ±60s)
- **H-9 Fixed**: `admin-init.ts` — fails fast if `GCLOUD_PROJECT` is missing in production
- **H-13 Fixed**: Reporter name moved from `localStorage` to `sessionStorage` (auto-cleared on tab close)
- **H-14 Fixed**: CSP + security headers (X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy) added to all 3 Firebase Hosting targets
- **M-4 Fixed**: Localhost CORS origins now conditional on `FUNCTIONS_EMULATOR` / `NODE_ENV` — excluded from production deploys
- **H-8 Fixed**: Storage rules now require `status == 'verified'` for public media access (was any `public_alertable` report)
- **H-10 Fixed**: Terraform IAM documented; Firestore rules remain primary access control (GCP limitation)
- **H-11 Fixed**: CI deploy SA replaced `firebase.admin` with scoped roles (`firebasehosting.admin`, `firebaserules.admin`, `datastore.owner`)
- **H-12 Fixed**: Phone number moved from `sessionStorage` to in-memory store (cleared on page unload)
- **H-2 Fixed**: `getOpsMetrics` — added explicit `accountStatus === 'active'` check (was manual auth, not covered by H-1 cascade)
- **H-15 Fixed**: `shift-handoff` (initiate + accept) — added `accountStatus` check alongside legacy `active` claim
- **H-16 Fixed**: `merge-duplicates` — added `accountStatus` check alongside legacy `active` claim
- **M-1 Fixed**: `secret_lookup` read denied to all clients — server-side only via Admin SDK
- **M-13 Fixed**: `setStaffClaims` now writes to `audit_logs` via `streamAuditEvent`
- **M-16 Fixed**: `declareAlert` now has rate limiting (5 per 5 minutes per user)
- **M-18 Fixed**: `declareDataIncident.affectedCollections` validated against known collection allowlist
- **L-3 Fixed**: `declareAlert.hazardType` constrained to enum (13 known hazard types)
- **M-12 Fixed**: `suspendStaffAccount` now revokes Firebase custom claims immediately (was 1-hour window)
- **M-10 Fixed**: `imageCompress.ts` now validates MIME type against allowlist (jpeg/png/webp/heic/heif), rejects gif/bmp/svg/etc
- **M-14 Fixed**: FCM retry queue now has stale `in_progress` detection (5-min timeout recovery via secondary query)
- **M-15 Fixed**: `declareDataIncident` now has rate limiting (3 per 5 minutes per user)
- **M-2 Fixed**: `bulkAvailabilityOverride` now errors on unauthorized/missing UIDs instead of silently skipping (prevents roster enumeration)
- **L-4 Fixed**: ErrorBoundary now sanitizes console output in production — logs error name + message only, no component stack
- **L-8 Fixed**: WindowSyncProvider now validates BroadcastChannel messages against known SyncMessage types (`select:report`, `select:municipality`, `triage:action`) before dispatch
- **L-10 Fixed**: `audit-stream.ts` now uses structured `logDimension` logger instead of `console.warn/error` for BigQuery failures and dead-letter writes
- **L-13 Fixed**: Removed dead code `onMediaRelocate` trigger (feature flag with no implementation, exported but never used)
- **M-3 Confirmed already fixed**: `subscribe-to-alerts` has `verifyTokenOwnership()` validating FCM tokens against Firestore
- **L-9 Confirmed already safe**: `admin-init.ts` malformed FIREBASE_CONFIG catch returns undefined without logging
- **M-7 Confirmed already fixed**: Security headers (CSP, X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy) present in all 3 Firebase Hosting targets
- **M-17 Fixed**: App Check staging bypass now requires explicit `ENFORCE_APP_CHECK=true` env var (was automatic for any `-staging` project)
- **L-5 Fixed**: LoginPage now maps Firebase auth error codes to user-friendly messages — no internal error details exposed to users
- **M-8 Fixed**: Service worker now only caches same-origin GET responses (prevents cross-origin cache poisoning)
- **M-22 Fixed**: smoke-test-prod.ts now uses try/finally for guaranteed cleanup of test data in Firestore, RTDB, and Storage
- **L-14 Fixed**: process-inbox-manual.ts emoji replaced with plain text tags ([INFO], [OK], [FAIL]) for encoding-safe log output
- **M-9 Fixed**: SW background sync now reads Firebase ID token from shared IndexedDB auth store — requires authenticated session
- **M-11 Fixed**: firebase-messaging-sw.js now has security documentation + version pinning (SRI via self-hosting documented as TODO)
- **M-5 Fixed**: `requestAgencyAssistance` now allows `provincial_superadmin` to request agency assistance for any municipality
- **M-15 Fixed**: `analytics-snapshot-writer` now processes municipalities sequentially (was 486 concurrent Promise.all queries)
- **L-12 Fixed**: `retention-sweep` now skips reports with active dispatches before hard-delete (prevents orphaning responders on scene)
- **Tests updated**: `https-error.test.ts` extended with account status + MFA bypass test cases; `callable-config.test.ts` rewritten for environment-aware testing; `callables.test.ts` updated for user-bound storage path; `imageCompress.test.ts` extended with MIME type validation tests
- **Gate**: `pnpm typecheck` clean (20/20) · `pnpm lint` clean (20/20) · 408 citizen-pwa tests pass · 80+ functions tests pass in changed areas
- **Audit report**: `docs/security-audit-2026-05-21.md`
- **Learnings**: `docs/learnings.md` updated with security audit patterns

### 2026-05-22 — Security Audit Final Batch (M-19, L-6, L-7, TS fix)

- **M-19 Fixed**: BigQuery Terraform dataset now has explicit access control (`bigquery.dataOwner` for SA, `bigquery.dataViewer` for analysts, no project-level inheritance)
- **L-6 Fixed**: IndexedDB query cache now strips sensitive queries (`users`, `responders`, `report_private`) and enforces 2MB size limit
- **L-7 Confirmed already safe**: `window.location.href` usages are hardcoded internal paths (`/`) or `tel:`/`sms:` URI schemes — not open redirects
- **TS fix**: `query-client.tsx` `stripSensitiveQueries` — filtered queries now typed as `DehydratedQuery[]` (was `{}`)
- **Final count**: 55 of 59 findings fixed or confirmed safe. 4 remaining: M-20 (VPC Service Controls, infra-only), L-1/L-2/L-17 (documented acceptable risks)
- **Gate**: `pnpm typecheck` clean (20/20) · `pnpm lint` clean (20/20) · 222+ functions tests pass

### 2026-05-20 — Reliability Spine, Emulator Fixes, Frontend Polish

- **Reliability Spine**: Local cross-app proof green (C00-C09). Staging preflight, hardened cleanup, manual inbox processor tests, root `pnpm proof:local` command. Critical dispatch-to-report mirroring moved into responder callable transactions. Proof preflights every port, closes browser contexts before cleanup.
- **Emulator fixes**: Restored Dashboard Declare Alert button. Fixed admin-desktop AppCheck emulator init (`CustomProvider`). Normalised 16 callable files to `shouldEnforceAppCheck()`. Rebuilt `functions-dist`.
- **Frontend**: Responder Map pins now match Admin Desktop ops language (`L.divIcon`, severity colours). Callable parity AST audit clean both ways (55/55). Citizen PWA pins left intentionally distinct.

### 2026-05-19 — OpsDashboard + Dispatch Hardening Backend

- **OpsDashboard (Phase 3)**: `DispatchVolumeChart`, `RecentEventsFeed`, `MunicipalPerformanceTable`, `DispatchStatsCards`, `EscalationQueueSection`, `DashboardPage` rewrite. 50/50 new tests pass; 363/363 total admin-desktop tests pass.
- **Dispatch Hardening (Phase 1)**: Added `needs_admin` + `escalated` to `dispatchStatusSchema`. `dispatchResponder` extended with FCM tracking. `monitorDispatchDeadlines` cron with lease protection, responder chunking, circuit breaker. `escalateDispatch`, `getOpsMetrics`, `retryFcmDelivery` callables. Firestore rules + composite indexes.

### 2026-05-18 — E2E Report Flow Fix

- Fixed 5 independent root causes blocking Citizen PWA → Admin Desktop report flow:
  1. **Upstream emulator bug**: `onDocumentCreated` trigger crashes with protobuf decode error. Workaround: `functions/scripts/process-inbox-manual.ts`.
  2. **Payload schema mismatch**: Removed `reporterName` and `reporterMsisdnHash` from citizen draft/submission.
  3. **Empty description**: Fallback to `"Report submitted via Bantayog Alert."` when `patientCount === 0`.
  4. **Missing centroids**: Seeded `centroid: { lat, lng }` for emulator municipalities.
  5. **`.env.local` override**: Both apps had `VITE_USE_EMULATOR=false` in `.env.local`; corrected to `true`.

### 2026-05-17 — Admin Desktop Live Report Surfacing + Feed Moderation

- Map right panel status-aware (`new` → review, `awaiting_verify` → verify/reject).
- Feed moderation page with publish via `verifyReport.scrubbedDescription` and takedown via `unpublishReport`.
- `inboxReconciliationSweep` non-terminal processing claims.

### 2026-05-15 — Staging E2E Root Cause Fixes

- Fixed Dashboard Timestamp React error #31 (`mapReportDocToReport` converts Firestore Timestamp to ISO).
- Fixed bootstrap claims keys (`active: true` → `accountStatus: 'active'`, added `lastClaimIssuedAt`).
- Added `active_accounts` document creation to bootstrap script.

### 2026-05-12 — Admin Desktop Interface Design Remediation

- Consolidated severity + brand tokens in `design-tokens.css`.
- Role-scoped Firestore reads in `useFirestoreListeners.ts` with `typeof` checks and unauthorized short-circuits.
- Truth-gate pattern for `MunicipalPerformanceTable`.
- Hold-to-Dispatch keyboard parity, sticky bulk-action bar, WindowSyncProvider dedup, OfflineBanner ordering.

### 2026-05-10 — Admin Desktop Greenfield Reset

- Deleted all previous frontend UI components, hooks, pages, stores.
- Clean slate with only infrastructure files + placeholder page.

### 2026-05-08 — PR #115 Review Fixes + 3-App UI Audit

- **PR #115**: Zod 4 migration, race condition fixes, ARIA focus management, redispatch safety, auth orphan prevention, audit collection correction, responder app hardening (11 fixes).
- **Adversarial review**: 12 findings addressed including route param migration, `create-responder` audit path, TOTP token refresh, modal focus, idempotency keys.
- **UI Audit**: 3-app parallel agent team. Responder app (8 fixes), Citizen PWA (13 fixes), Admin Desktop (11 fixes + analytics/ops bridges).

### 2026-05-07 — Functions Zero Failures + Superadmin Route Gating

- Reduced functions test failures from ~118 to 0 (7 files fixed: border-auto-share, erasure-sweep, cleanup-sms, firestore.rules, phase1-auth, public-collections, storage.rules).
- Added provincial-superadmin route gate; legacy URLs redirect to live pages or safe fallbacks.

### 2026-05-06 — Responder PWA Frontend Rebuild

- Full UI layer: Shell, routes, LoginPage, `useReport`, DispatchListPage, DispatchDetailPage, `useMessages`, MessagesPage, MapPage, ProfilePage, ShiftHandoffPage.
- Post-review hardening: Firestore-rule field-name fixes, offline Leaflet markers, GPS battery pause, map recenter button, `incident-labels.ts`.

### 2026-05-05 — SMS Audit + System Health Controls

- `SmsPage` with Outbox, Inbox, Provider Health tabs.
- `replayAuditDeadLetter` and `prewarmSurge` callables with SystemHealthPage wiring.

### 2026-05-04 — Citizen PWA Report Flow Fixes

- **Cancel own report**: `cancelReportByCitizen` callable, client wrapper, local cache clear, draggable `ReportStatusPill`.
- **Tracking fixes**: Seed from localForage, remove `loadReports` nuclear option, save `municipalityLabel`.
- **Public verification wiring**: `visibilityClass` flip on admin verification, live timeline synthesis from per-step timestamps.

---

## Recent Merged Work

### Citizen PWA — Live Status Sync + Richer Timeline (2026-05-04)

- `useMyActiveReports` uses live Firestore subscriptions per stored report.
- `mapReportFromFirestore` synthesises multi-step timeline from timestamp fields.
- Gate: 363/363 tests pass.

### UX Bug Fixes — 10 Issues (2026-05-03)

- TrackingScreen nav header, RevealSheet iOS fix, button text, FilterBar z-index, municipality chips, `saveReport()` wiring, `bantayog:report-saved` event, ProfileTab CTA.

### QA Findings Sweep (2026-05-03)

- 45 findings addressed: 7 P0, 8 P1, 10 P2/P3.

### Auth + Wizard Resumability (2026-05-02)

- RegisterPage a11y, phone number persistence via `sessionStorage`, step validation, `wizard-snapshot` service (localforage, 24h TTL).

### Hardening Sweep (2026-05-02)

- 7 clusters: correctness, reliability, per-jurisdiction config, performance, background sync, image compression, data export backend.

---

## Completed Phase Reference

| Phase                             | Status   | Notes                                                                                                      |
| --------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| Phase 9: Citizen PWA Redesign     | DONE     | 18 tasks — Feed/Profile/Alerts, RevealSheet, offline banner, auth-aware ProfileTab, RegisterPage, Settings |
| Phase 8C: RA 10173 Erasure        | DONE     | 8 tasks — callables, sweeps, rules, delete-account flow                                                    |
| Phase 7.A: Security Callables     | DONE     | 7 callables + Firestore rules                                                                              |
| Phase 7.B: Superadmin UI          | DONE     | Analytics dashboard, emergency declaration, TOTP enrollment                                                |
| Phase 6: Responder App            | DONE     | Native foundation, push, telemetry, location projection, field UX, handoffs                                |
| Phase 5: Cluster C + PRE-C        | DONE     | Analytics (mass alerts, NDRRMC escalation removed in 9f520d99)                                             |
| Phase 4b: SMS Inbound Pipeline    | DEFERRED | Removed in 9f520d99; citizen SMS fallback rewired to hotline                                               |
| Phase 3b: Admin Triage + Dispatch | DONE     | Code complete                                                                                              |
| Phase 0: Foundation               | DONE     | All tooling passing                                                                                        |

> **NOTE:** SMS inbound pipeline, NDRRMC escalation, PAGASA hazard signals, Break Glass protocol, and mass alert broadcast were removed in commit `9f520d99` as part of the feature deferral decision.

---

## Open Blockers & Deferred Items

1. **Firebase Console:** Phone Auth disabled; App Check 400 errors on staging.
2. **Deploy needed:** Staging redeploy required to verify many code fixes.
3. **Phase 7.C:** Staff TOTP enrollment audit in progress.
4. **Deferred to Phase 11:** 4 observability dashboards (Ops, Backend, Compliance, Cost).

---

## 2026-05-22 — Report Lifecycle End-to-End Fix

**Root causes found via systematic debugging:**

1. **Citizen PWA submission failing:** `isAuthed()` in `firestore.rules` required `accountStatus == 'active'`, but anonymous auth users have NO custom claims. The `report_inbox` create rule rejected all anonymous submissions with permission-denied.
2. **Admin can't see new reports:** `FeedPage` filter intentionally excluded `status === 'new'` reports. Admins had no UI to find and verify them, stalling the lifecycle.
3. **Responder can't read reports:** `canReadReportDoc(data)` used `data.reportId`, but `reports` documents don't store `reportId` in their data — the ID is only the document path. Responders with valid dispatches were permanently denied.
4. **Agency admin query broken:** `useFirestoreListeners` queried `reports` by `agencyId`, a field that doesn't exist on report docs. Always returned empty.

**Fixes applied (5 files):**

| File                                                                     | Change                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `infra/firebase/firestore.rules`                                         | `report_inbox` create: `isAuthed()` → `request.auth != null`; `canReadReportDoc(data, reportId)` now accepts path variable and uses it for dispatch lookup; added agency_admin read via `report_ops.agencyIds` |
| `apps/admin-desktop/src/pages/FeedPage.tsx`                              | Include `new` reports in feed; add "Send to moderation" button calling `verifyReport`                                                                                                                          |
| `apps/admin-desktop/src/hooks/useFirestoreListeners.ts`                  | `agency_admin` reports query: removed broken `agencyId` filter, now queries full collection (rules gate access)                                                                                                |
| `apps/admin-desktop/src/__tests__/feed-page.test.tsx`                    | Updated to expect `new` reports in feed                                                                                                                                                                        |
| `apps/admin-desktop/src/__tests__/useFirestoreListeners.scoping.test.ts` | Updated to assert no `agencyId` query and correct `agencyIds` array-contains query                                                                                                                             |

**Verification:**

- `pnpm typecheck` — 20/20 packages pass
- Admin-desktop tests — 371 passed (2 previously-failing tests now pass with updated assertions)
- Citizen-PWA tests — 421 passed (1 unrelated timeout in `App.routes.test.tsx`)
- Functions integration test — 5 passed (report lifecycle: submit → verify → dispatch)
- Firestore rules tests — skipped (emulator not running locally; will run in CI)

---

## 2026-05-22 — Backend Reliability Spine

**Implemented:**

1. Added `submitCitizenReport` callable fast path for online Citizen PWA submissions. It requires Firebase Auth, validates the existing inbox payload shape, rate-limits by UID, and reuses the same materialization core as `processInboxItemCore`.
2. Extracted shared report materialization so callable and `report_inbox` fallback both write `reports`, `report_private`, `report_ops`, `report_lookup`, `secret_lookup`, status log, event docs, and media subdocs consistently.
3. Made `publicRef + secretHash` the replay key: same hash returns the existing `reportId`; different hash fails with conflict.
4. Updated Citizen online submission to call `submitCitizenReport`, while network/timeout failures still queue the draft for the offline inbox path.
5. Updated seed/proof data so seeded reports include canonical `municipalityId`, matching `report_ops`, and an active dispatch for `bfp-responder-test-01`.
6. Updated Responder report decoding to accept canonical `publicLocation: { lat, lng }`, while keeping `{ latitude, longitude }` as a fallback.
7. Updated the local proof to assert callable materialization directly instead of assuming an inbox-first online path.

**Verification:**

- Functions emulator tests — 17 passed (`process-inbox-item`, `submit-citizen-report`)
- Citizen PWA targeted tests — 26 passed
- Responder targeted tests — 11 passed
- Seed companion tests — 3 passed
- `pnpm typecheck` — 20/20 packages pass
- `pnpm lint` — 20/20 tasks pass
- `pnpm proof:local` — C00-C09 passed locally

**Residual note:**

- `proof:local` still logs non-fatal Firebase emulator protobuf decode errors from `dispatchMirrorToReport` during dispatch updates/shutdown. The proof exits 0 and report/dispatch state advances correctly, but the emulator log noise should be tracked separately so it does not hide a real trigger failure later.
