# Progress

## Current Status (2026-05-21)

**Architecture refactoring complete. Polish follow-up: municipalityLabel fencepost fixed.**

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
