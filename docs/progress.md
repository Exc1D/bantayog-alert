# Progress

## Current Status (2026-05-19)

**Phase 3 Admin Desktop Frontend — In Progress**

- ✅ **Task 11:** `DispatchMonitorPage.tsx` — composes `DispatchStatsCards`, `EscalationQueueSection`, `DispatchLifecycleTable`, `ResponderAvailabilityPanel`, `ReDispatchModal`. State-managed re-dispatch flow with `callables.escalateDispatch`. TDD with 9 tests. Typecheck/lint clean.
- ✅ **Task 12:** `EscalationQueueSection.tsx` — high-contrast red section for `needs_admin` dispatches. Horizontal scrolling stalled dispatch cards. TDD with 6 tests. Committed to `feat/dispatch-hardening-observability`.
- **Remaining:** Task 13 (`OpsDashboard`)

**Dispatch Hardening + Observability Backend (Phase 1 Complete)** · [PR #149](https://github.com/Exc1D/bantayog-alert/pull/149)

- ✅ Task 1: `needs_admin` + `escalated` added to `dispatchStatusSchema`; `dispatchTimeoutSweep` retired
- ✅ Task 2: `dispatchResponder` extended with FCM tracking (notification_attempted events, fcmResult/fcmWarnings, fcm_retry_queue)
- ✅ Task 3: `acceptDispatch`/`declineDispatch` write `notification_delivered` events
- ✅ Task 4: `monitorDispatchDeadlines` — 1-min cron, lease protection (2-min expiry), auto-escalation with `needs_admin` cap, responder chunking (Firestore 10-value `in` limit), fallback 2h window, ≤200 responders. Includes `monitor-config` (30s TTL) + `dispatch-counter`.
- ✅ Task 5: `escalateDispatch` callable — municipal_admin/provincial_superadmin, validates active + not previously notified
- ✅ Task 6: `getOpsMetrics` callable — server-derived scope, reads `metrics_daily/{scopeId}_{date}`, returns aggregated metrics + `avgAcceptSeconds` + `fcmSuccessRate`
- ✅ Task 7: `retryFcmDelivery` — 30s scheduled, exponential backoff (30s/60s/120s), max 3 attempts
- ✅ Task 8: Firestore rules + composite indexes for agency_admin, fcm_retry_queue, system_config/monitor

**Remaining Phases:** Phase 2 (responder FCM receipt, deferred to Phase 4) · Phase 3 (admin-desktop frontend, in progress) · Phase 4 (emulator E2E + responder FCM handler) · Phase 5 (Cloud Monitoring/BigQuery)

---

## 2026-05-18 — E2E Report Flow Fix (Citizen PWA → Admin Desktop)

Five root causes for reports not appearing in admin-desktop:

1. **Upstream emulator bug:** `onDocumentCreated` trigger on `report_inbox` crashes 100% (`protobufjs` ESM module caching in `firebase-tools` v15.x + `firebase-functions` v7.x). **Prod impact: zero.** Workaround: `functions/scripts/process-inbox-manual.ts` for local E2E.
2. **Unsupported inbox fields:** `reporterName` + `reporterMsisdnHash` removed from Draft/CreateDraftInput/useSubmissionMachine/SubmitReportForm — `inboxPayloadSchema` rejected them.
3. **Empty description:** PWA has no description field; fallback was `""`. Changed to `"Report submitted via Bantayog Alert."` in `SubmitReportForm/index.tsx`.
4. **Missing municipality centroids:** Emulator seed had no `centroid` → geocoder threw "out of jurisdiction". Fixed via `scripts/seed-centroids-rem.cjs`.
5. **`.env.local` override:** Both apps had `VITE_USE_EMULATOR=false` in `.env.local` overriding `.env`'s `true`. Updated both.

**Gate:** Full E2E verified — PWA submit → emulator `report_inbox` → manual fallback → report visible in admin Triage Queue.

---

## 2026-05-17 — Admin Desktop Live Report Surfacing + Feed Moderation

- ✅ Map right panel is status-aware (new→Advance, awaiting_verify→Verify/Reject, dispatch controls reserved for verified/active)
- ✅ `/feed` moderation page: scoped live reports, pending/public separation, scrubbed publishing via `verifyReport.scrubbedDescription`
- ✅ `unpublishReport` backend for post-public takedown (flips `visibilityClass` to `internal`, writes audit evidence)
- ✅ `inboxReconciliationSweep` no longer marks transient retries as `processedAt`
- **Gate:** 36 files/223 tests pass · typecheck/lint clean

---

## 2026-05-15 — Staging E2E Root Cause Fixes

- ✅ Dashboard Timestamp: `mapReportDocToReport` converts Firestore Timestamp→ISO string (11/11 tests)
- ✅ Bootstrap claims: `active: true` → `accountStatus: 'active'` + `lastClaimIssuedAt`
- ✅ `active_accounts` doc creation in bootstrap (required by `isActivePrivileged()`)
- ✅ Dispatches composite index already exists — no change needed

---

## 2026-05-14 — Staging QA Triage + Responder Deploy

- ✅ Responder staging root cause: deployed artifact built with `VITE_USE_EMULATOR=true`
- ✅ Production-build guard: `vite build` fails closed when emulator mode enabled
- ✅ Municipality contact rules: `municipalities/{id}` now public read / client-write denied
- ✅ Responder staging deploy complete: https://bantayog-responder-staging.web.app
- ✅ Hotfix: aligned shared-ui peer deps, cleaned stale Firebase packages, shipped real PWA icons
- ✅ Shell contract cleanup: uppercase header, online status pill, 3-tab nav, Vitest coverage
- **Still open:** staging admin/responder test accounts in Firebase Auth; App Check 400 errors

---

## 2026-05-12 — Admin Desktop Interface-Design Critique Remediation

- ✅ Phase 0: Consolidated severity + brand tokens in `design-tokens.css`. Deleted orphaned `severity-colors.ts`.
- ✅ P0.1: Role-scoped Firestore reads in `useFirestoreListeners.ts`. Narrowed claims via `typeof`; gates unauthorized scoped roles BEFORE `onSnapshot`. 7 new scoping tests.
- ✅ P1.8: MunicipalPerformanceTable truth gate — 4 optional fields, `—` for undefined, sort treats undefined avgResponseTime as Infinity.
- ✅ P2.9: Hold-to-Dispatch keyboard parity (Space/Enter with `e.repeat` guard, blur/unmount cleanup).
- ✅ P2.10: Sticky bulk-action bar (`sticky top-0 z-20` above `z-10` thead).
- ✅ P2.11: WindowSyncProvider message dedup via `crypto.randomUUID()` + in-memory `Map` with TTL.
- ✅ P2.12: OfflineBanner renders before spinner in loading branches.
- **Gate:** 29 files/147 tests pass · typecheck/lint clean

---

## 2026-05-10 — Admin Desktop Greenfield Reset

- ✅ Deleted all previous UI components, hooks, pages, stores. Clean infrastructure slate. Placeholder page created.

---

## 2026-05-08 — PR #115 Review Fixes + Adversarial Review

**PR #115 (29 CodeRabbit comments):**
Zod 4 migration (`z.string().uuid()`→`z.uuid()`), race condition fixes (removed `queueMicrotask`), ARIA/focus on 4 modals, redispatch safety (tx.get + merge-update), auth orphan prevention (adminAuth.deleteUser compensation), audit collection correction (`report_events`→`audit_events`), 6 responder fixes (phone normalization, MIME validation, geolocation guard, TOTP token refresh, route param standardization, Storage URL encoding).

**Adversarial Review (12 findings):**
Critical: SosPage/BackupRequestPage route param migration was incomplete; create-responder audit target fixed. High: E.164 regex alignment, TotpEnrollment token failure handling. Medium: modal a11y completeness, idempotency key persistence, role validation relocation.

**Gate:** Build 10/10 · Lint/typecheck clean · Responder 197 tests · Admin 185 tests

---

## 2026-05-08 — UI Audit Fixes (3-App Parallel)

Addressed P0/P1/P2 findings from `docs/ui-audit-findings-2026-05-07.md`:

**responder-app** (branch `fix/audit-responder-app-ui`): `<span>`→`<button>`, label `htmlFor` on textareas, legend dot contrast fix, empty-state aria, severity CSS vars, emoji→Lucide icons, SOS icon a11y, prefers-reduced-motion. Gate: 149 tests.

**citizen-pwa** (branch `fix/audit-citizen-pwa-ui`): eager import for SubmitReportForm, nav text contrast, RevealSheet spring easing, `aria-current` conditional spread, centralized `useSeverityStyle`, danger banner contrast, FAB overlap fix at 320px. Teal palette intentionally unchanged. Gate: 374 tests.

**admin-desktop** (branch `fix/audit-admin-desktop-ui`): palette canonization, CSS module extraction, particle animation removal, logo/button color alignment, chart constants, superadmin badge contrast, live indicator aria, OTP autocomplete, notification a11y, anomaly card contrast, Inter font, focus-visible ring, reduced-motion, skip-to-content. Analytics/scoped ops bridges with callable-backed agency map feed. Gate: 110 tests.

---

## 2026-05-07 — Functions Test Suite Zero Failures

Reduced from ~118 failures to 0. Fixed: missing `report_ops` seeds (border-auto-share), TOCTOU race simulation (erasure-sweep), pagination after batch-delete (cleanup-sms), public alerts read assertion (firestore.rules), version expectation (phase1-auth), missing `hazard_signal_status` rule (public-collections), storage emulator resilience via `itif(storageAvailable)`. Gate: 114 files/885 tests/0 failures.

---

## 2026-05-07 — Admin Desktop Superadmin Route Gating

Legacy prototype URLs redirected: `/dashboard`→`/province/dashboard`, `/map`→`/province/map`, `/users`→`/province/users`, `/health`→`/province/system-health`, `/reports`→`/analytics`. Retired `/emergency`,`/ndrrmc`,`/audit`,`/handoff`,`/settings`→`/province/dashboard`; `/erasure`→`/province/users`. Removed non-live TCWS placeholder from SystemHealthPage. Added Vitest coverage for all redirected routes.

---

## 2026-05-06 — Responder PWA Frontend Rebuild

12 commits on `feature/responder-pwa-frontend`. 12 tasks: global styles + PWA manifest, Shell + tab nav + SosHoldButton, route restructuring, branded LoginPage, `useReport` hook, DispatchListPage (amber pending/green active cards), DispatchDetailPage (state-machine UI), `useMessages`/`useSendMessage` hooks, MessagesPage + MessageThreadPage, MapPage (react-leaflet + OSM + geolocation), ProfilePage (hero card + stats + availability), ShiftHandoffPage + terminal screens.

Post-review hardening: 2 Firestore rule fixes, 15 UX/perf concerns (offline markers, GPS battery, one-shot fly, scroll guard, displayName fallback, severity allowlist, SOS keyboard + timer), centralized incident labels, 8 new test files, Vite manualChunks. Gate: 102 tests.

---

## 2026-05-05 — Admin Desktop SMS Audit + System Health Controls

**SMS Audit Page:** Outbox/Inbox/Provider Health tabs with color-coded status badges. Gate: 9 tests.

> Removed in `9f520d99` (2026-05-11 feature deferral).

**System Health Controls:** `replayAuditDeadLetter` callable (superadmin-only, replays failed audit events from `dead_letters`). `prewarmSurge` callable (HTTP GET pings to warm CF instances). `audit-stream.ts` dead-letter write on BigQuery failure. SystemHealthPage wired. Gate: functions 17 tests, admin 88 tests.

> `prewarmSurge` removed in `9f520d99`; `replayAuditDeadLetter` remains.

---

## 2026-05-04 — Citizen PWA Multi-Feature Day

**Cancel Own Report + Draggable Status Pill:** `cancelReportByCitizen` callable, client wrapper, localForage cleanup, draggable pill via pointer events. Gate: 243 tests.

**Report Tracking + Profile Stats Fixes:** TrackingScreen seeds from localForage, individual invalid-entry filtering (not nuclear wipe), `municipalityLabel` saved to localForage. Gate: 364 tests.

**Report Flow QA (10 subagents):** 5 passes, 4 bugs found (consent checkbox, severity color inconsistency, offline auth block), 3 missing features (offline RevealSheet, detail sheet fields).

**Live Status Sync + Richer Timeline:** Live `onSnapshot` subscriptions per stored report, permission-denied fallback, multi-step timeline synthesis from per-step timestamps. Gate: 363 tests.

**Public Verification Wiring:** `visibilityClass` flip during admin verification, Firestore timestamp normalization for live timeline. Gate: 49 tests.

**Active Report + Tracking Fixes:** 4 citizen-facing bugs, legacy `public_disturbance`→`security` normalization, secret-code lookup normalization. Gate: 43 tests.

---

## 2026-05-03 — UX Bug Fixes + QA Sweep

**10 UX fixes:** TrackingScreen nav, RevealSheet iOS, FilterBar z-index, municipality chips filter, saveReport wiring, FeedTab consistency. Gate: 330 tests.

**QA Findings (45 items):** 7 P0, 8 P1, 10 P2/P3. Key: RevealSheet nav, CORS/auth, SW retry, iOS meta tags, push toggle, GPS fallback, sign-out, contrast, motion-safe, Tagalog labels. Gate: lint 0 errors.

**PR #91 follow-ups:** SW precache resilience, aria-hidden→status role, extracted phone-session-storage, wizard load catch, TTL test fix. Gate: 243 tests.

---

## 2026-05-02 — Auth + Wizard + Hardening

**Auth + Wizard Resumability:** RegisterPage a11y, phone preservation via sessionStorage, Step 1 validation, wizard-snapshot service (localforage, 24h TTL). Gate: 327 tests.

**QA Round 1:** Offline precache, Settings contrast, `<main>` landmark, wizard hint visibility. Gate: 319 tests.

**Hardening Sweep (7 clusters):** Correctness (PWA install, toggles, RevealSheet, photo validation), reliability (backoff, error sanitization, FCM rollback), per-jurisdiction config, performance (lazy RevealSheet, dead code), background sync + image compression, data export (GCS signed URLs). New: `useMunicipalityContact.ts`, `RevealSheet.lazy.tsx`, `imageCompress.ts`. Deleted: `photoUpload.ts`, `draftManager.ts`, `localforage.ts`. Gate: 318 tests.

---

## Older Completed Phases

| Phase | Status | Notes |
|---|---|---|
| Phase 9: Citizen PWA Redesign | DONE | 18 tasks — Feed/Profile/Alerts tabs, RevealSheet, Toggle, Toast, offline banner, auth-aware ProfileTab, RegisterPage, SettingsPage, routes, data export |
| Phase 8C: RA 10173 Erasure | DONE | 8 tasks — callables, sweeps, rules, delete-account flow |
| Phase 7.A: Security Callables | DONE | 7 callables + Firestore rules |
| Phase 7.B: Superadmin UI | DONE | Analytics dashboard, emergency declaration, TOTP enrollment (NDRRMC/break-glass removed in `9f520d99`) |
| Phase 6: Responder App | DONE | Native foundation, push, telemetry, location, field UX, handoffs. Residual: E2E dispatch, push tokens, background geolocation (need devices) |
| Phase 5: Cluster C + PRE-C | DONE | Analytics (mass alerts/NDRRMC escalation removed in `9f520d99`) |
| Phase 4b: SMS Inbound Pipeline | DEFERRED | Removed in `9f520d99`; citizen SMS rewired to hotline |
| Phase 3b: Admin Triage + Dispatch | DONE | Code complete |
| Phase 0: Foundation | DONE | All tooling passing |

> Features removed in `9f520d99` (2026-05-11): SMS inbound pipeline, NDRRMC escalation, PAGASA hazard signals, Break Glass protocol, mass alert broadcast. Entries retained for historical accuracy.

---

## Open Blockers

1. ~~SMS data erasure gap~~ **RESOLVED (2026-05-11):** SMS features removed in `9f520d99`.
2. Firebase Console: Phone Auth disabled; App Check 400 errors on staging
3. Deploy needed: Staging redeploy to verify accumulated code fixes
4. Phase 7.C: Staff TOTP enrollment audit in progress
5. Deferred to Phase 11: 4 observability dashboards (Ops, Backend, Compliance, Cost)
