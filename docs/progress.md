# Progress

## Current

### Phase 6 Responder App — Task 5: Responder location projection (2026-04-26)

- Status: DONE
- Branch: `phase6/responder-app`
- Files changed:
  - `functions/src/scheduled/project-responder-locations.ts` — new scheduled Cloud Function running every 30s; reads `/responder_locations/`, groups by `municipalityId` via `/responder_index/{uid}`, rounds lat/lng to 3 decimal places (~100m grid), computes freshness bands (fresh/degraded/stale/offline) from telemetry age, writes to `/shared_projection/{municipalityId}/{uid}`, deletes offline responders, and applies 90s TTL cleanup on stale projection entries
  - `functions/src/index.ts` — exports `projectResponderLocations`
  - `functions/src/__tests__/scheduled/project-responder-locations.test.ts` — 9 tests covering grid rounding, freshness band boundaries, active responder projection, offline deletion, TTL cleanup, and municipality grouping
- Verification:
  - `pnpm --filter @bantayog/functions typecheck` — PASS
  - `pnpm --filter @bantayog/functions lint` — PASS
  - `pnpm dlx firebase-tools emulators:exec --only database "pnpm --filter @bantayog/functions exec vitest run src/__tests__/scheduled/project-responder-locations.test.ts"` — PASS (9/9)

### Phase 6 Responder App — Task 6: Responder field callables (2026-04-26)

- Status: DONE
- Branch: `phase6/responder-app`
- Files changed:
  - `functions/src/callables/submit-responder-witnessed-report.ts` — new callable for responders to file a witness report while on dispatch; includes rate limiting, idempotency, report + report_private + report_ops + report_lookup + report_events + admin_notifications writes
  - `functions/src/callables/trigger-sos.ts` — new callable to trigger SOS on an active dispatch; writes `sosTriggeredAt` to dispatch and creates admin notification
  - `functions/src/callables/request-backup.ts` — new callable to request backup on an active dispatch; creates `backup_requests` doc and admin notification
  - `functions/src/callables/mark-dispatch-unable-to-complete.ts` — new callable to mark a dispatch as `unable_to_complete`; updates dispatch status, resets report to `verified`, and creates dispatch + report events
  - `functions/src/index.ts` — exports four new callables
  - `packages/shared-validators/src/dispatches.ts` — added `unable_to_complete` to `DispatchStatus` enum validation
  - `packages/shared-validators/src/state-machines/dispatch-states.ts` — added `unable_to_complete` as terminal state with transitions from active states
  - `packages/shared-types/src/enums.ts` — added `unable_to_complete` to `DispatchStatus` enum
  - `packages/shared-types/lib/` — rebuilt
- Verification:
  - `pnpm --filter @bantayog/functions typecheck` — PASS
  - `pnpm --filter @bantayog/functions lint` — PASS

### Phase 6 Responder App — Task 4: Native telemetry capture (2026-04-26)

- Status: DONE
- Branch: `phase6/responder-app`
- Files changed:
  - `apps/responder-app/src/services/telemetry-client.ts` — new unified telemetry client using `@capacitor-community/background-geolocation` on native, falling back to `navigator.geolocation.watchPosition` on web; exports `startTracking`, `stopTracking`, `getBatteryPercentage`
  - `apps/responder-app/src/hooks/useResponderTelemetry.ts` — new hook that starts tracking when dispatch is active, throttles RTDB writes by motion state and battery level, validates payload with `responderTelemetryPayloadSchema`, writes to `responder_locations/{uid}` and `responders/{uid}.lastTelemetryAt`
  - `apps/responder-app/src/App.tsx` — added `TelemetryProvider` component that feeds the first active dispatch into `useResponderTelemetry`
  - `apps/responder-app/src/pages/DispatchDetailPage.tsx` — added `useResponderTelemetry` call scoped to the viewed dispatch
- Verification:
  - `pnpm --filter @bantayog/responder-app typecheck` — PASS
  - `pnpm --filter @bantayog/responder-app lint` — PASS

### Phase 6 Responder App — Task 3: Telemetry contracts and RTDB write boundaries (2026-04-26)

- Status: DONE
- Branch: `phase6/responder-app`
- Files changed:
  - `packages/shared-validators/src/responders.ts` — added `responderTelemetryPayloadSchema` with `capturedAt`, `receivedAt` (optional, server-side), `lat`, `lng`, `accuracy`, `batteryPct`, `motionState`, `appVersion`, `telemetryStatus`
  - `packages/shared-validators/src/index.ts` — re-exported `responderTelemetryPayloadSchema` + `ResponderTelemetryPayload` type
  - `infra/firebase/database.rules.json` — tightened `capturedAt` lower bound from 10 min to 60 s; added `motionState` to `.validate`; added `.write: false` at `shared_projection/$municipalityId` level
  - `functions/src/__tests__/rtdb.rules.test.ts` — added `motionState` to `validPayload`; updated stale test from 10 min to 60 s; added parent-path write denial test for `shared_projection`
- Verification:
  - `pnpm --filter @bantayog/shared-validators test` — PASS (223 tests)
  - `firebase emulators:exec --only firestore,database,storage "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rtdb.rules.test.ts src/__tests__/rules/responders.rules.test.ts"` — PASS (22 tests)

### Phase 6 Responder App — Task 2: Native push abstraction (2026-04-26)

- Status: DONE
- Branch: `phase6/responder-app`
- Files changed:
  - `apps/responder-app/src/services/push-client.ts` — new unified push abstraction using `@capacitor/push-notifications` on native, falling back to Firebase web FCM on web
  - `apps/responder-app/src/hooks/useRegisterFcmToken.ts` — now calls `acquirePushToken()` from push-client instead of directly using `acquireFcmToken()`; removed service worker logic from hook
  - `apps/responder-app/src/App.tsx` — `FcmSetup` skips SW registration on native; added `NotificationRouter` component that wires foreground push listener and routes notification tap-throughs to `/dispatches/:id`
- Summary: Replaced the web-only FCM path with a runtime-native push abstraction. On `Capacitor.isNativePlatform()`: uses Capacitor push-notifications plugin for token registration, foreground handling, and tap-through deep linking. On web: preserves existing service worker + Firebase messaging flow. Firestore write contract (`responders/{uid}.hasFcmToken = true`) preserved.
- Verification:
  - `pnpm --filter @bantayog/responder-app typecheck` — PASS
  - `pnpm --filter @bantayog/responder-app lint` — PASS

### Phase 6 Responder App — Task 1: Lock native mobile foundation (2026-04-26)

- Status: DONE
- Branch: `phase6/responder-app`
- Files changed:
  - `apps/responder-app/package.json` — added `@capacitor/push-notifications`, `@capacitor/network`, `@capacitor/preferences`, `@capacitor/device`, `@capacitor-community/background-geolocation`, `@capacitor/ios`, `@capacitor/android`
  - `apps/responder-app/capacitor.config.ts` — added comment documenting background geolocation plugin choice
  - `apps/responder-app/ios/App/App/Info.plist` — added `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `UIBackgroundModes` with `location`
  - `apps/responder-app/android/app/src/main/AndroidManifest.xml` — added `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`
  - Native projects created under `apps/responder-app/ios/` and `apps/responder-app/android/`
- Summary: Installed and locked Capacitor v8 plugin set. Chose `@capacitor-community/background-geolocation` because `@capawesome/capacitor-background-geolocation` does not exist on npm and `@capacitor/background-runner` is designed for periodic tasks, not continuous tracking. iOS and Android native shells generated, web app embedded via `cap sync`. Build and sync verified.

### Test fixture fix — command_channel_threads/messages seed data (2026-04-26)

- Status: DONE
- Branch: `fix/mass-alert-rules-security-tests`
- Rollout gates: Deploy to dev emulator first, run full rules test suite including `public-collections.rules.test.ts`, request explicit approval before staging, overnight soak in staging before prod
- Files changed: `functions/src/__tests__/rules/public-collections.rules.test.ts`, `functions/src/__tests__/helpers/seed-factories.ts` (beforeAll seed addition for command_channel_threads/messages, getDoc vs getDocs workaround)
- Summary: Tests for superadmin reading `command_channel_threads` and `command_channel_messages` failed because rules check `participantUids[uid]` on each doc. Seed data added to the `beforeAll` block. `getDoc` used instead of `getDocs` due to emulator collection-list indexing quirk.

### Phase 5 Cluster C + PRE-C — Broadcast + Intelligence (2026-04-25)

- Status: DONE
- Branch: `phase5-cluster-c`
- Scope:
  - PRE-C.1: `hasFcmToken` maintenance in registration + cleanup paths (`useRegisterFcmToken.ts`, `fcm-send.ts`)
  - PRE-C.2: `reportSmsConsentDocSchema` extended with `municipalityId` + `followUpConsent`; `process-inbox-item.ts` updated
  - PRE-C.3: `massAlertRequestDocSchema` status enum expanded (8 states); `firestore.rules` updated for ndrrmc flow
  - C.1: `mass_alert` SMS template + `renderBroadcastTemplate` + `enqueueBroadcastSms`; `sendMassAlertFcm` batched FCM; 4 mass-alert callables (`massAlertReachPlanPreview`, `sendMassAlert`, `requestMassAlertEscalation`, `forwardMassAlertToNDRRMC`); `MassAlertModal` UI
  - C.2: `CAMARINES_NORTE_MUNICIPALITY_IDS` in shared-data; `analyticsSnapshotWriter` scheduled CF; `AnalyticsDashboardPage` with React Query + SVG trend chart + `/analytics` route
- Verification:
  - Functions tests: 31/31 pass (PRE-C.2, mass-alert rules, mass-alert callables, analytics snapshot writer)
  - Admin-desktop tests: 3/3 analytics dashboard pass; 10/10 mass-alert modal pass (2 pre-existing failures in AgencyAssistanceQueuePage unrelated)
  - `npx turbo run lint typecheck` — 26/26 pass
- Commits: `6471065..663da6e` (13 commits)
- Bug fixed: `analytics-snapshot-writer.ts` had province aggregate write inside municipality for-loop (overwriting per iteration); moved outside loop

### Task 8: A.3 — ShiftHandoffModal + incoming handoff banner UI (2026-04-25)

- Status: DONE
- Branch: `phase5-cluster-a-task2`
- Scope:
  - `callables.ts`: added `initiateShiftHandoff` and `acceptShiftHandoff` callable wrappers
  - `usePendingHandoffs.ts`: new hook querying `shift_handoffs` collection for pending handoffs
  - `TriageQueuePage.tsx`: added "Start Handoff" button, ShiftHandoffModal dialog, incoming handoff banner with accept buttons
  - `shift-handoff-modal.test.tsx`: 4 tests (button renders, modal opens, initiate callable, no banner when empty)
  - `triage-queue.test.tsx`: added `usePendingHandoffs` mock to fix existing tests
- Verification:
  - `pnpm --filter @bantayog/admin-desktop exec vitest run src/__tests__/shift-handoff-modal.test.tsx` — PASS (4/4)
  - `pnpm --filter @bantayog/admin-desktop exec vitest run src/__tests__/triage-queue.test.tsx` — PASS (8/8)
  - `pnpm --filter @bantayog/admin-desktop lint` — PASS
  - `pnpm --filter @bantayog/admin-desktop typecheck` — PASS
- Note: `functions/src/index.ts` was included in the commit (pre-staged from prior task — exports `initiateShiftHandoff` and `acceptShiftHandoff` callables)

### PR #63 CodeRabbit follow-up fixes (2026-04-24)

- Status: DONE locally - resolved the remaining review comments on schema validation, inbox materialization, and Firestore rules
- Scope:
  - shared validators: derived responder FCM flag, widened persisted report type enum, runtime lookup expiry check
  - inbox trigger: removed redundant exact-location guard, added `report_sms_consent.municipalityId`, strengthened geohash regression coverage
  - Firestore rules: report messages, report sharing events, field mode sessions, and report notes authorization/data-consistency fixes
- Verification:
  - `pnpm --filter @bantayog/shared-validators test` - PASS
  - `firebase emulators:exec --only firestore,database,storage "pnpm --filter @bantayog/functions exec vitest run src/__tests__/triggers/process-inbox-item.test.ts src/__tests__/rules/report-sharing.rules.test.ts src/__tests__/rules/report-notes.rules.test.ts src/__tests__/rules/report-messages.rules.test.ts src/__tests__/rules/field-mode-sessions.rules.test.ts"` - PASS
  - `pnpm --filter @bantayog/shared-validators typecheck` - PASS
  - `pnpm --filter @bantayog/functions lint` - PASS

### Phase 5 PRE-B - Schema + Rules Foundation (2026-04-24)

- Status: DONE locally - schema amendments, rules additions, and inbox materialization updates landed
- Scope:
  - shared validators: coordination, responders, users, reports, and export updates
  - Firestore rules: field mode sessions, report notes, report messages, command channel map-key lookup, report sharing events, and shared report reads
  - inbox trigger: `report_ops.reportType`, optional `locationGeohash`, and explicit `exactLocation` payload support derived from the inbox item
- Verification:
  - `pnpm --filter @bantayog/shared-validators exec vitest run src/coordination.test.ts src/responders.test.ts src/users.test.ts src/reports.test.ts` - PASS
  - `firebase emulators:exec --only firestore,database,storage "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rules/field-mode-sessions.rules.test.ts src/__tests__/rules/report-notes.rules.test.ts src/__tests__/rules/report-messages.rules.test.ts src/__tests__/rules/coordination.rules.test.ts src/__tests__/rules/report-sharing.rules.test.ts"` - PASS
  - `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions exec vitest run src/__tests__/triggers/process-inbox-item.test.ts"` - PASS
  - `npx turbo run lint typecheck` - PASS

### Refactor Audit 2026-04-23 — Implementation Continuation

**Branch:** `refactor/audit-2026-04-23-continuation`

**Completed Items:**

- **P1 #3:** `inbound.ts` split into modules — `parser.ts` (192 lines), `gazetteer.ts`, `levenshtein.ts`, `auto-reply.ts`. All 6 `@ts-expect-error` comments eliminated. Stale `lib/inbound.js` build artifacts cleaned up.
- **P1 #4:** `dispatch-responder.ts` extraction — validation (`dispatch-responder-validation.ts`), notification (`dispatch-responder-notify.ts`), Firestore writes (`dispatch-responder-writes.ts`). Added `municipalityId` runtime validation and fixed spread-order bug in validatedResponder.
- **P2 #7:** Standardized all remaining implicit-any catch patterns — 14 occurrences across 10 production source files converted to `catch (err: unknown)` / `catch (error: unknown)`. One missed occurrence in `sms-inbound-processor.ts:184` also fixed.
- **P2 #8:** Replaced `console.log` with `console.info` in `shared-validators/src/logging.ts` with clarifying comment about Cloud Functions stdout ingestion.
- **P3 #9:** Confirmed `batchResponse: any` already removed from `fcm-send.ts`; no source `any` types remain in production code.
- **P3 #10:** Converted TODO to `TICKET(BANTAYOG-PHASE6)` with deferral rationale.
- **P2 #6:** Consolidated auth provider + protected route into `shared-ui` — new `AuthProvider` (with `active` guard, `refreshClaims`, `useCallback` memoization) and `ProtectedRoute` (configurable via `allowedRoles`, `requireActive`, `requireMunicipalityIdForRoles` props). Updated both `admin-desktop` and `responder-app` to consume from `@bantayog/shared-ui`. Deleted 4 duplicated files.
- **P2 #5 (shared-ui):** Added test infrastructure (vitest, testing-library, happy-dom) and 11 characterization tests for `AuthProvider` and `ProtectedRoute`.

**Files Created:**

- `packages/shared-ui/src/auth-provider.tsx`
- `packages/shared-ui/src/protected-route.tsx`
- `packages/shared-ui/src/auth-provider.test.tsx`
- `packages/shared-ui/src/protected-route.test.tsx`
- `packages/shared-ui/vitest.config.ts`
- `functions/src/callables/dispatch-responder-validation.ts`
- `functions/src/callables/dispatch-responder-notify.ts`
- `functions/src/callables/dispatch-responder-writes.ts`

**Files Deleted:**

- `apps/admin-desktop/src/app/auth-provider.tsx`
- `apps/admin-desktop/src/app/protected-route.tsx`
- `apps/responder-app/src/app/auth-provider.tsx`
- `apps/responder-app/src/app/protected-route.tsx`
- `packages/shared-sms-parser/src/inbound.ts` (renamed to `parser.ts`)
- `packages/shared-sms-parser/lib/inbound.js` (stale build artifact)
- `packages/shared-sms-parser/lib/inbound.d.ts` (stale build artifact)

**Verification:**

- `npx turbo run lint typecheck` — PASS (25/25)
- `pnpm --filter @bantayog/shared-sms-parser test` — PASS (13/13)
- `pnpm --filter @bantayog/shared-ui test` — PASS (11/11)

**Remaining (deferred to future sprints):**

- `apps/admin-desktop` — 0 tests (LoginPage, TriageQueuePage, DispatchModal)
- `apps/responder-app` — 1 test (DispatchListPage, DispatchDetailPage, useAcceptDispatch)
- `packages/shared-data` — 0 tests
- `packages/shared-types` — 0 tests

---

### Step2WhoWhere Refactoring — Phase 3 & 4: Components & Simplification (2026-04-23)

- Status: Phases 3-4 COMPLETE — integrated extracted components and simplified main component
- Files modified:
  - `apps/citizen-pwa/src/components/SubmitReportForm/Step2WhoWhere.tsx` — integrated MunicipalitySelector, BarangaySelector, ContactFields components; reduced from 707 to 289 lines (-418 lines, -59%)
- Impact:
  - Main component now orchestrates sub-components instead of rendering inline
  - Each concern is separated: GPS (hook), location selection (components), contact fields (component)
  - Component is now maintainable and testable
- Verification:
  - `pnpm --filter @bantayog/citizen-pwa typecheck` — PASS
  - `pnpm --filter @bantayog/citizen-pwa lint` — PASS
  - `pnpm --filter @bantayog/citizen-pwa test` — PASS (137 passed, 2 todo)

### Step2WhoWhere Refactoring — Phase 2: Custom Hooks (2026-04-23)

- Status: Phase 2 COMPLETE — extracted custom hooks and integrated existing useGpsLocation
- Files created:
  - `apps/citizen-pwa/src/hooks/useMunicipalityBarangays.ts` — new hook for municipality/barangay selection state with computed barangay options
- Files modified:
  - `apps/citizen-pwa/src/components/SubmitReportForm/Step2WhoWhere.tsx` — integrated useGpsLocation and useMunicipalityBarangays hooks; removed local GPS state, municipality state, barangay filtering logic
  - `apps/citizen-pwa/src/hooks/useGpsLocation.ts` — added `setLocationMethod` to return type for manual mode switching
- Impact:
  - GPS logic now fully reusable via existing useGpsLocation hook (with comprehensive tests)
  - Municipality/barangay selection is encapsulated and testable
- Verification:
  - `pnpm --filter @bantayog/citizen-pwa typecheck` — PASS
  - `pnpm --filter @bantayog/citizen-pwa lint` — PASS
  - `pnpm --filter @bantayog/citizen-pwa test` — PASS (137 passed, 2 todo)

### Step2WhoWhere Refactoring — Phase 1: Data & Utilities (2026-04-23)

- Status: Phase 1 COMPLETE — extracted data constants and utility functions
- Files created:
  - `apps/citizen-pwa/src/data/fallback-barangays.ts` — extracted FALLBACK_BARANGAYS constant (282 lines) with TypeScript interface
  - `apps/citizen-pwa/src/utils/storage-errors.ts` — extracted isQuotaExceededError and isSecurityError functions with JSDoc
- Files modified:
  - `apps/citizen-pwa/src/components/SubmitReportForm/Step2WhoWhere.tsx` — reduced from 707 to 424 lines (-283 lines); added imports for extracted modules
- Impact:
  - Reusable barangay data now available across the app
  - Storage error utilities can be used by other components
- Verification:
  - `pnpm --filter @bantayog/citizen-pwa typecheck` — PASS
  - `pnpm --filter @bantayog/citizen-pwa lint` — PASS
  - `pnpm --filter @bantayog/citizen-pwa test` — PASS (137 passed, 2 todo)

### Code quality & security refactor (2026-04-23)

- Status: DONE — audit-driven fixes across monorepo
- Files changed:
  - `packages/shared-sms-parser/src/__tests__/inbound.test.ts` — fix 2 failing tests by using barangays present in fallback gazetteer (`LANG` for ambiguous match, `ANAHAW` for exact match)
  - `packages/shared-validators/vitest.config.ts` — add `include: ['src/**/*.test.ts']` to prevent duplicate test execution (was running tests from both `src/` and `lib/`)
  - `apps/citizen-pwa/src/components/SubmitReportForm/Step2WhoWhere.tsx` — type 2 bare `catch {}` blocks (`_err: unknown`) for localStorage/sessionStorage private-mode failures
  - `apps/citizen-pwa/src/services/draft-store.ts` — type bare `catch {}` in `isBlobReadable`
  - `apps/citizen-pwa/src/hooks/useOnlineStatus.ts` — type bare `catch {}` in network probe
  - `packages/shared-sms-parser/src/inbound.ts` — type bare `catch {}` in gazetteer require fallback
  - `packages/shared-validators/src/msisdn.ts` — type bare `catch {}` in `node:crypto` require fallback
  - `functions/src/services/fcm-send.ts` — capture and append FCM retry error to warnings; keep outer catch bare (intentional retry)
  - `functions/src/services/sms-providers/semaphore.ts` — include original parse error in thrown `SmsProviderRetryableError`
  - `functions/src/http/sms-inbound.ts` — capture and log MSISDN normalization error
  - `functions/src/triggers/on-media-finalize.ts` — capture and log corrupt-image processing error
  - `functions/src/firestore/sms-inbound-processor.ts` — capture and log MSISDN decryption error
  - `functions/src/triggers/inbox-reconciliation-sweep.ts` — restore bare catch with explicit comment (transaction contention is intentional skip)
  - `functions/src/__tests__/callables/https-error.test.ts` — NEW: 8 tests for critical auth boundary (`requireAuth`, `bantayogErrorToHttps`, code mapping)
- Verification:
  - `npx turbo run lint` — PASS (25/25)
  - `npx turbo run typecheck` — PASS (25/25)
  - `pnpm --filter @bantayog/shared-sms-parser test` — PASS (13/13)
  - `pnpm --filter @bantayog/shared-validators test` — PASS (190/190, no duplicates)
  - `pnpm --filter @bantayog/functions test src/__tests__/callables/https-error.test.ts` — PASS (8/8)

### Phase 5 Responder MVP — PR #60 review fixes (2026-04-23)

- Status: DONE — all CodeRabbit + CodeQL review comments addressed
- Files changed:
  - `apps/responder-app/src/app/await-auth-token.ts` — fix hanging promise: moved `getIdToken(true)` inside Promise constructor, rejects on error
  - `apps/responder-app/src/app/auth-provider.tsx` — add `active` flag + uid guard to prevent stale promise overwriting state after auth change
  - `apps/responder-app/src/hooks/useAcceptDispatch.ts` — null check on `awaitFreshAuthToken` return before callable
  - `apps/responder-app/src/hooks/useDeclineDispatch.ts` — same null check
  - `apps/responder-app/src/hooks/useAdvanceDispatch.ts` — same null check
  - `apps/responder-app/src/hooks/useDispatch.ts` — derive `schemaKeys` from `dispatchDocSchema.shape` instead of hardcoded list
  - `apps/responder-app/src/pages/DispatchDetailPage.tsx` — retry button now visible when `status=accepted && advanceState.error`; removed false `permission-denied`→"cancelled by admin" mapping
  - `packages/shared-sms-parser/index.js` — remove unused `reportTypeSchema`+`z` import; add `typeof body !== 'string'` guard; narrow `getBarangayGazetteer` catch to `MODULE_NOT_FOUND` only
  - `functions/src/__tests__/triggers/dispatch-mirror-to-report.test.ts` — use named app instance; replace `.resolves.not.toThrow()` with direct `await`
  - `docs/reviews/2026-04-23-phase5-responder-mvp-review.md` — add `text` language specifier to code fence
  - `pnpm-lock.yaml` — regenerated after `@bantayog/shared-validators` was added to e2e-tests (fixes CI `ERR_PNPM_OUTDATED_LOCKFILE`)
- Verification:
  - `pnpm --filter @bantayog/responder-app typecheck` — PASS
  - `pnpm --filter @bantayog/responder-app lint` — PASS
  - `pnpm --filter @bantayog/functions typecheck` — PASS
  - `pnpm --filter @bantayog/functions lint` — PASS
  - `pnpm --filter @bantayog/shared-sms-parser test` — PASS (13/13)

### Phase 5 Responder MVP — dispatch loop slice (2026-04-23)

- Status: DONE locally — responder callable, decline flow, and Playwright smoke are verified; deep dispatch scenarios remain intentionally skipped
- Scope:
  - backend responder decline callable with required reason + idempotency
  - responder presentation helpers for queue grouping, collapsed UI state, and terminal surface mapping
  - responder decline hook plus normalized queue/detail hooks
  - queue/detail page wiring for auto-entry, decline form, and terminal cancelled/race-loss screens
- Verification:
  - `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/decline-dispatch.test.ts"` — PASS (7 tests)
  - `pnpm --filter @bantayog/functions typecheck` — PASS
  - `pnpm --filter @bantayog/functions lint` — PASS
  - `pnpm --filter @bantayog/shared-sms-parser typecheck` — PASS
  - `pnpm --filter @bantayog/shared-sms-parser test` — PASS (13/13)
  - `pnpm --filter @bantayog/responder-app typecheck` — PASS
  - `pnpm --filter @bantayog/responder-app lint` — PASS
  - `firebase emulators:exec --project bantayog-alert-dev --only auth,functions,firestore,pubsub "pnpm --filter @bantayog/e2e-tests exec playwright test specs/responder.spec.ts"` — PASS (6 passed, 4 skipped)
- Notes:
  - The responder smoke run now boots cleanly after fixing the Firestore rules compile error, adding a JS entrypoint for `@bantayog/shared-sms-parser`, moving `FcmSetup` inside the responder `AuthProvider`, and fixing the callable idempotency hash path to use async Web Crypto.
  - E2E harness fixes (2026-04-23): Firestore emulator port 8080→8081; `VITE_USE_EMULATOR=true` + `VITE_FIREBASE_PROJECT_ID=bantayog-alert-dev` added to `apps/responder-app/.env.local` so the browser SDK connects to the emulator instead of staging; `getIdTokenResult(true)` (force refresh) in `auth-provider.tsx` and `LoginPage.tsx`; cancelled-dispatch test now waits for the dispatch list heading before navigating to the detail route.
  - The deeper dispatch scenarios in `e2e-tests/specs/responder.spec.ts` remain intentionally skipped for now.
  - Post-remediation fix (2026-04-23): E2E decline test was failing with `FirebaseError: internal` because `functions/lib/callables/decline-dispatch.js` had a stale `enforceAppCheck: true` — the source had been changed to `process.env.NODE_ENV === 'production'` but functions were never rebuilt. Fix: `pnpm --filter @bantayog/functions build`. All 6 E2E tests now pass again.

### 3-Step Wizard Wiring — feature/3-step-wizard-wiring (2026-04-23)

- Status: DONE locally — 3 commits on branch, ready for PR
- Branch: `feature/3-step-wizard-wiring`
- Scope:
  - `SubmitReportForm/index.tsx` rewritten as `WizardContainer` (Step1→2→3 with data accumulation) + `SubmissionPanel` (drives RevealSheet via `useSubmissionMachine`)
  - Dead `showSmsFallback` variable removed by code-quality review
  - `/report` consolidated to new wizard; `/report/new` removed; old `SubmitReportForm.tsx` deleted
  - `App.routes.test.tsx` mock path updated to new wizard module
  - `SubmissionPanel` auto-starts `machine.submit()` on mount — no double-confirm after wizard Step3
  - `failed_terminal` renders `RevealSheet state="failed_retryable"` instead of raw `OfflineBanner + SmsFallbackButton`
- Verification:
  - `pnpm --filter @bantayog/citizen-pwa typecheck` — PASS
  - `pnpm --filter @bantayog/citizen-pwa lint` — PASS
  - `pnpm --filter @bantayog/citizen-pwa exec vitest run` — PASS (101 passed, 2 todo)

### PR #57 Review Fixes — feature/map-tab (2026-04-22)

- Status: in progress — reviewer comments are being resolved on `feature/map-tab`
- Scope:
  - clipboard copy now waits for a successful write before showing success
  - invalid Leaflet coordinates are skipped in incident and personal report layers
  - stale map selections clear when filters or data refresh remove the selected pin
  - local cache/report lookup failures are handled without blocking the primary submit flow
  - `usePublicIncidents` clears stale error state on successful resubscribe

### Citizen PWA — Firebase env fallback for `pnpm dev` (2026-04-22)

- Status: DONE locally — citizen PWA no longer hard-crashes when `VITE_FIREBASE_*` vars are missing
- Scope:
  - `usePublicIncidents` now short-circuits to empty/offline state when Firebase is not configured
  - `useMyActiveReports` now returns localForage-backed queued reports without live Firestore/Functions access
  - `SubmitReportForm` and `LookupScreen` now show a clear Firebase-config error instead of throwing
- Verification:
  - `pnpm --filter @bantayog/citizen-pwa typecheck` — PASS
  - `pnpm --filter @bantayog/citizen-pwa lint` — PASS
  - `pnpm --filter @bantayog/citizen-pwa test` — PASS (filtered package suite, 51/51)

### Map Tab — full implementation (2026-04-22)

- Status: DONE locally — full map tab slice implemented in `feature/map-tab`
- Scope:
  - `CitizenShell` top/bottom chrome + route updates
  - `MapTab` orchestrator with Leaflet map, public incident layer, own-report layer, peek/detail sheets, filters, offline banner, and empty state
  - `PeekSheet` / `DetailSheet` / `IncidentLayer` / `MyReportLayer`
  - `useMyActiveReports` exact-optional-property cleanup for `id`
- Verification:
  - `pnpm --filter @bantayog/citizen-pwa typecheck` — PASS
  - `pnpm --filter @bantayog/citizen-pwa lint` — PASS
  - `pnpm --filter @bantayog/citizen-pwa test` — PASS (filtered package suite, 38/38)

### Map Tab — Task 5: usePublicIncidents hook (TDD) (2026-04-22)

- Status: DONE — committed to `feature/map-tab`
- Files created:
  - `apps/citizen-pwa/src/components/MapTab/types.ts` — `PublicIncident`, `MyReport`, `Filters` interfaces
  - `apps/citizen-pwa/src/hooks/usePublicIncidents.ts` — Firestore `onSnapshot` hook with severity/window filters
  - `apps/citizen-pwa/src/hooks/usePublicIncidents.test.ts` — 4 tests (loading state, snapshot return, severity filter, error handling)
- Verification:
  - `pnpm --filter @bantayog/citizen-pwa test` — PASS (targeted package suite, 22/22)
  - `pnpm --filter @bantayog/citizen-pwa lint` — PASS
  - `pnpm --filter @bantayog/citizen-pwa typecheck` — PASS

### PR #56 Review Fixes — feat(citizen-pwa): manual location fallback (2026-04-22)

- Status: In progress — fixes applied to `feature/citizen-report-flow` worktree
- PR: https://github.com/Exc1D/bantayog-alert/pull/56
- Reviewers: CodeRabbit (Changes Requested), Sourcery (Commented)

**Issues fixed:**

1. `useReport.ts` — Guard empty `reportRef` to prevent invalid `doc(db(), 'reports/')` path (crash)
2. `useReport.ts` — Wrap `mapReportFromFirestore` in try-catch inside `onSnapshot` callback
3. `useReport.ts` — Async `queryFn` with `enabled: !!reportRef` + `placeholderData: keepPreviousData` to prevent "Report not found" flash
4. `TrackingScreen.tsx` — Switch `isLoading` → `isPending` for correct loading state
5. `RevealSheet.tsx` — `handlePrimaryAction` for `queued`/`failed_retryable` now calls `onClose?.()` instead of `closeSheet()` (fixes state desync)
6. `inboxPayloadSchema` — Add `municipalityId`, `barangayId`, `nearestLandmark` optional fields for location picker
7. `submit-report.ts` — Extend `SubmitReportInput` with location fields + forward to payload
8. `SubmitReportForm/index.tsx` — Replace inline submission logic with `submitReport(deps, input)` call (fixes secret discard + DRY)
9. `putBlob` error now includes HTTP response body
10. `Step1Evidence.tsx` — Fix `INCIDENT_TYPES` to match `reportDocSchema` values (`flood`, `fire`, `earthquake`, `typhoon`, `landslide`, `storm_surge`)
11. `Step1Evidence.tsx` — Add `useRef` + `useEffect` cleanup for blob URL `URL.revokeObjectURL`
12. `Step1Evidence.tsx` — "No photo" button now properly skips photo instead of re-opening picker
13. `Step3Review.tsx` — Fix `INCIDENT_TYPES` to match schema; third progress dot now active
14. `Step2WhoWhere.tsx` — `nearestLandmark` state initialized as `''` (not `undefined`) — fixes uncontrolled input
15. `Step2WhoWhere.tsx` — GPS `catch` block now logs error with `console.error` (not swallowed)
16. `submit-flow.test.tsx` — Replace placeholder tests with `it.todo` stubs (TICKET-56, TICKET-57)
17. `test-utils.tsx` — Add `MemoryRouter` + Firestore `RulesTestEnvironment` for emulator-backed tests
18. `Step1Evidence.tsx` — Replace blob URL `<img src>` preview with `createImageBitmap` + `<canvas>` render path to address CodeQL `js/xss-through-dom`; add targeted upload-preview test

**Verification:**

- `pnpm --filter @bantayog/shared-validators typecheck` PASS
- `pnpm --filter @bantayog/shared-validators lint` PASS
- `pnpm --filter citizen-pwa typecheck` PASS
- `pnpm --filter citizen-pwa lint` PASS
- `pnpm --filter @bantayog/citizen-pwa exec vitest run src/__tests__/submit-flow.test.tsx` PASS
- `pnpm --filter citizen-pwa test` PASS (8 passed, 2 todo)

**Note:** The two `add/add` design-token conflicts (`design-tokens.ts`, `design-tokens.css`) are identical on both sides — trivial resolution needed at merge.

### Phase 4b SMS Inbound Pipeline (2026-04-22)

- Status: Complete — All tasks done (Tasks 1-10)
- Branches:
  - `feature/phase-4b-sms-inbound` — worktree at `dae2848`
  - `main` — all commits merged here
- Key commits:
  - `f2cdaa5` fix(sms-parser): address TypeScript strict-mode errors
  - `f1eb24e` feat(validators): add SMS-originated report_inbox Zod schema
  - `47c5da8` feat(process-inbox): return publicRef from processInboxItemCore
  - `896f8ea` feat(sms-inbound): add thin webhook for Globe Labs SMS ingress
  - `9a96e82` feat(sms-inbound): encrypt MSISDN in sms_inbox for Phase 4b auto-reply
  - `7479d28` feat(sms-inbound): add smsInboundProcessor trigger with auto-reply
  - `10d9b5b` fix(sms-inbound): add async wrapper to db.runTransaction
  - `082b8c4` feat(sms-inbound): add integration tests for Phase 4b SMS inbound pipeline
  - `6007e05` feat(phase-4b): add acceptance harness for SMS inbound pipeline
- Files created/modified:
  - `packages/shared-sms-parser/src/inbound.ts` — BANTAYOG parser with fuzzy barangay matching
  - `packages/shared-sms-parser/src/index.ts` — re-exports parser
  - `packages/shared-sms-parser/src/__tests__/inbound.test.ts` — 13 unit tests (all passing)
  - `packages/shared-sms-parser/vitest.config.ts` — vitest configuration
  - `packages/shared-sms-parser/package.json` — added test script and zod dependency
  - `packages/shared-validators/src/sms.ts` — added `smsReportInboxFieldsSchema` + `senderMsisdnEnc` field
  - `packages/shared-validators/src/index.ts` — re-exports new schema
  - `functions/src/http/sms-inbound.ts` — thin webhook for Globe Labs SMS ingress (refactored to extract smsInboundWebhookCore)
  - `functions/src/firestore/sms-inbound-processor.ts` — onCreate trigger, parses SMS, writes report_inbox, queues auto-reply
  - `functions/src/triggers/process-inbox-item.ts` — added `publicRef` to ProcessInboxItemCoreResult
  - `functions/src/index.ts` — exports new webhook and trigger
  - `functions/src/__tests__/sms-inbound.test.ts` — 13 integration tests (all passing)
  - `functions/src/__tests__/acceptance/phase-4b-acceptance.test.ts` — 3 acceptance tests (all passing)
  - `scripts/phase-4b/acceptance.ts` — standalone acceptance harness reference
  - `functions/package.json` — added `@bantayog/shared-sms-parser` dependency
  - `docs/superpowers/plans/2026-04-22-phase-4b-sms-inbound.md` — implementation plan
  - `docs/superpowers/specs/2026-04-22-phase-4b-sms-inbound-design.md` — design spec
- Notes:
  - MSISDN encryption: AES-256-GCM with `SMS_MSISDN_ENCRYPTION_KEY` env var
  - Pre-commits resolved via `// eslint-disable-next-line @typescript-eslint/require-await` on the one fire-and-forget transaction call
  - The `autoReplyText` from the parser is currently unused (trigger sends `receipt_ack` purpose SMS via enqueueSms)
  - Integration tests use `env.unauthenticatedContext().firestore()` for seeding and `env.withSecurityRulesDisabled()` for test body
  - Parser test expectations corrected: CALASGAN→low (dist=2), LANIT→none (not in gazetteer), details case preserved lowercase
  - **Bug fixed (2026-04-22):** `publicLocation: null` written to `report_inbox` caused `processInboxItemCore` to fail `inboxPayloadSchema` validation and throw `out_of_jurisdiction`, silently routing reports to `moderation_incidents` instead of materializing them. Fix: made `publicLocation` optional in `inboxPayloadSchema`, omitted it from SMS writes, added `location_missing` detection in `processInboxItemCore`.
- **Typecheck error fixed (2026-04-22):** `phase-4b-acceptance.test.ts:182` had `tx` implicit `any` in `db.runTransaction(async (tx) => {...})`. Fixed with `tx: unknown` on callback + `tx as any` at enqueueSms call — bridges `rules-unit-testing` compat SDK to admin SDK `Transaction` type.

### Phase 4b Bug Fixes — pending_review SMS auto-reply (2026-04-22)

- Status: Complete — 4 commits, shippable after adversarial review
- **Problem:** SMS reports missing `publicLocation` never got an auto-reply — `location_missing` and `out_of_jurisdiction` errors silently swallowed
- **Fix:** Detect location errors in `smsInboundProcessor` catch block, send `pending_review` SMS, update `parseStatus` to `pending_review`

**Files changed:**

- `packages/shared-validators/src/sms.ts` — `pending_review` added to `smsInboxDocSchema.parseStatus` and `smsOutboxDocSchema.purpose` enums
- `packages/shared-validators/src/sms-templates.ts` — `pending_review` added to `SmsPurpose` type and `TEMPLATES` record
- `functions/src/services/send-sms.ts` — `pending_review` added to `VALID_PURPOSES` set
- `functions/src/triggers/process-inbox-item.ts` — `moderation_incidents` doc enriched with `reportType`, `description`, `publicRef`
- `functions/src/firestore/sms-inbound-processor.ts` — catch block detects location errors, sends `pending_review` SMS; `parseStatus` written BEFORE enqueue attempt

**Design decisions:**

- `parseStatus: 'pending_review'` written BEFORE enqueue — wrong status prevented if transaction fails
- Inner try/catch around `decryptMsisdn` and `enqueueSms` — failures logged, not rethrown, do not affect parseStatus
- MSISDN decryption failure logged as WARNING — does not affect parseStatus
- Both `location_missing` and `out_of_jurisdiction` get `pending_review` reply — same moderator dependency

**Known acceptable limitations:**

- `schema_invalid`/`payload_schema_invalid` → no SMS reply (programmer error, not reporter-fixable)
- `decryptMsisdn` catch logs no diagnostic — insufficient for production encryption key debugging
- `correlationId: sms:${msgId}` violates `z.uuid()` schema — pre-existing, affects all SMS inboxes

**Verification:** `pnpm run typecheck --filter=@bantayog/functions` + `pnpm run lint --filter=@bantayog/functions` pass.

### Phase 4a Git Recovery (2026-04-21)

- Status: complete
- Verification:
  `git ls-remote --heads origin recovery/phase-4a-outbound-sms` → `b7dc97121ebaa4ca53f39ce1232e5cb271c99c95`
- Notes:
  Restored the orphaned Phase 4a branch tip to `origin/recovery/phase-4a-outbound-sms`.
  Confirmed `main` already contains the bulk Phase 4a code via squash commit `e05a25c`; the recovery branch preserves original commit history rather than replaying the entire stack.

### Phase 4a Acceptance Fixes (2026-04-21)

- Status: PASS locally via emulator acceptance gate

### Phase 4a TypeScript Errors Fix (2026-04-21)

- Status: COMPLETE
- Fixes applied to `functions/src/__tests__/acceptance/phase-4a-acceptance.ts`:
  - Replaced scheduled/onRequest wrappers (`reconcileSmsDeliveryStatus`, `evaluateSmsProviderHealth`, `smsDeliveryReport`) with their `*Core` variants
  - Fixed Admin/Client SDK mixing by using `adminDb` (from `getFirestore()`) directly for all `setDoc` calls
  - Removed `resolveProvider` from `processInboxItemCore` call (not in interface)
  - Removed `severity` and `notes` from `dispatchResponderCore` call (not in `DispatchResponderCoreDeps`)
  - Fixed `staffClaims` return type for `exactOptionalPropertyTypes` compliance
  - Fixed `smsConsent: false` type error by omitting `reporterContact` in seed (interface requires `smsConsent: true`)
  - Added `resolveProvider` import back (required by `dispatchSmsOutboxCore`)
- Verification: `pnpm run typecheck` → 0 errors for `phase-4a-acceptance.ts`
- Note: `.test.ts` sibling file still has `assert` import errors — separate issue

### Phase 4a Acceptance Fixes (2026-04-21)

- Status: PASS locally via emulator acceptance gate; typecheck now passing for `.ts` file
- Verification: `firebase emulators:exec --only firestore,database,auth "pnpm exec tsx scripts/phase-4a/acceptance.ts"` → `13/13 passing`
- Notes:
  Repaired the phase 4a acceptance harness to run each case against clean Firestore + RTDB emulator state.
  Fixed `verifyReport`, `closeReport`, and `dispatchResponder` so transactional reads happen before writes.
  Corrected SMS fallback `publicRef` generation when `report_lookup` is absent.
  Fixed ~17 TypeScript errors: Admin/Client SDK mixing, wrong function imports, interface mismatches.

### Phase 1 Identity Spine

- Status: in progress; verification still incomplete
- Verification snapshot:
  `pnpm test` FAIL — `apps/citizen-pwa/src/App.test.tsx` still imports Jest DOM via the Jest path instead of `@testing-library/jest-dom/vitest`.
  `pnpm --filter @bantayog/functions test:unit` PASS
  `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test:rules"` SKIP locally
  `pnpm lint && pnpm typecheck && pnpm build` PASS
- Built:
  Identity spine documents and auth claim issuance/revocation Cloud Functions.
  Phase 1 auth and Firestore rules coverage.
  Phase 1 bootstrap script.

## Completed

### Phase 3b Admin Triage + Dispatch

- Status: complete in code; manual staging UI verification still blocked by hosting/cert issues
- Key verification:
  `pnpm lint && pnpm typecheck` PASS
  `pnpm test` PASS (`127 tests`)
  Backend staging callable verification PASS (`5/5`)
- Remaining blockers:
  `staging.bantayog.web.app` certificate mismatch
  IAM Credentials API disabled for acceptance flow
  No valid staging hosting deploy

### Phase 0 Foundation

- Status: complete
- Key verification:
  install, lint, format, typecheck, test, build, emulator, and Terraform validate all passed
- Notable fixes:
  corrected root Vitest workspace setup
  reformatted docs/rules files
  removed broken package-level workspace assumptions
