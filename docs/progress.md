# Progress

## Current — Phase 7 Provincial Superadmin + NDRRMC + Break-Glass

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

### 7.A — Security Callables (branch: `feature/phase7-a`) — IN PROGRESS

### 7.B — Superadmin UI (branch: `feature/phase7-b`) — BLOCKED by 7.A

### 7.C — Drill & Verification — BLOCKED by 7.B

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
- **Citizen PWA Firebase env fallback (2026-04-22)** — Graceful degradation when `VITE_FIREBASE_*` vars missing.
- **Map Tab (2026-04-22)** — Full Leaflet implementation with public incident + own-report layers.
- **PR #56 Review Fixes (2026-04-22)** — 18 fixes across citizen PWA: guard empty report ref, canvas blob preview for CodeQL, offline state fixes, schema alignment.
- **Phase 4b SMS Inbound Pipeline (2026-04-22)** — Globe Labs webhook, SMS parser with fuzzy barangay matching, auto-reply, integration + acceptance tests. Bug: `publicLocation: null` caused `out_of_jurisdiction` silent routing; fixed by making field optional.
- **Phase 4a Git Recovery (2026-04-21)** — Restored orphaned branch tip to `origin/recovery/phase-4a-outbound-sms`.

## Older Completed

- Phase 3b Admin Triage + Dispatch — Code complete; staging UI verification blocked by hosting/cert issues.
- Phase 0 Foundation — All tooling (install, lint, format, typecheck, test, build, emulator, Terraform) passing.
