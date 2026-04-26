# Phase 6 Responder App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the native-capable responder experience needed for real shift drills: Capacitor builds, native push, motion-aware telemetry, responder-witness intake, incident escalation flows, and race-loss recovery that behaves correctly under concurrent admin actions.

**Architecture:** Build on the existing responder web shell instead of replacing it. Phase 6 adds a native execution layer and telemetry pipeline around the already-working dispatch loop, then extends the backend and admin surfaces for responder-driven field workflows. Native platform work is gated first because telemetry, reliable push, and battery validation are not credible on the current web-only path.

**Tech Stack:** React 19 + Vite + Capacitor v8, Firebase Auth/Firestore/RTDB/Functions, existing shared validators/types/UI packages, native push via `@capacitor/push-notifications`, background telemetry via a background-geolocation-capable Capacitor plugin plus native permission wiring.

---

## Current Baseline

- Existing responder app already has:
  - Web shell at `apps/responder-app/`
  - Dispatch list/detail routes
  - Accept / decline / advance hooks
  - Basic race-loss and cancelled screens
  - Web FCM token registration flow
  - Capacitor config scaffold only
- Existing backend already has:
  - `acceptDispatch`, `advanceDispatch`, `declineDispatch`
  - `dispatchMirrorToReport`
  - shift-handoff callables for admin handoff
  - agency-assistance request/accept/decline callables
- Existing schemas already have useful forward-compat hooks:
  - `ResponderDoc.lastTelemetryAt`
  - report `source: 'responder_witness'`
  - report `witnessPriorityFlag`

## Planning Notes

- The architecture spec names `@capacitor-community/background-geolocation` and an iOS motion-activity path. Current official Capacitor docs confirm `@capacitor/geolocation` does not directly provide full background geolocation, and `@capacitor/motion` is web-API based rather than the required native motion-activity abstraction. Treat plugin selection and native feasibility as a first-class task, not as solved plumbing.
- Phase 6 should not rewrite the Phase 3/5 dispatch loop. It should extend the existing hooks, screens, callables, rules, and admin pages in-place.
- Keep write authority aligned with the architecture spec:
  - server-authoritative for SOS, backup, unable-to-complete, responder-witness intake, projection jobs
  - rule-bounded direct writes only for responder self-state and allowed sequential transitions

## Phase 6 Workstreams

### Task 1: Lock the native mobile foundation

**Why first:** No telemetry, native push, or battery validation work is trustworthy until iOS/Android shells and plugin choices are settled.

**Primary files:**

- Modify: `apps/responder-app/package.json`
- Modify: `apps/responder-app/capacitor.config.ts`
- Create/modify native platform files under `apps/responder-app/ios/` and `apps/responder-app/android/` after `npx cap add`
- Modify: `docs/progress.md`

**Deliverables:**

- Add native platforms for responder app.
- Install and lock the Phase 6 plugin set.
- Document the final plugin decision:
  - `@capacitor/push-notifications`
  - `@capacitor/network`
  - `@capacitor/preferences`
  - `@capacitor/device`
  - one background-geolocation-capable plugin that supports the architecture’s battery goals
- Add required iOS capabilities and Android manifest permissions.
- Replace the current “Capacitor scaffold only” status in progress notes with actual native shell status.

**Verification:**

- `pnpm --filter @bantayog/responder-app build`
- `pnpm --filter @bantayog/responder-app exec cap sync`
- smoke build succeeds for both iOS and Android native projects

**Exit condition:** Native projects boot the existing responder app without telemetry or push enabled yet.

### Task 2: Replace the web FCM path with a native push abstraction

**Primary files:**

- Create: `apps/responder-app/src/services/push-client.ts`
- Modify: `apps/responder-app/src/services/fcm-client.ts`
- Modify: `apps/responder-app/src/hooks/useRegisterFcmToken.ts`
- Modify: `apps/responder-app/src/App.tsx`
- Modify: `apps/responder-app/src/app/firebase.ts`

**Deliverables:**

- Introduce a single responder push abstraction that chooses:
  - native push on Capacitor
  - existing web FCM flow only as local dev / browser fallback
- Handle token registration, token refresh, foreground notification handling, and tap-through deep linking to `/dispatches/:id`.
- Preserve the existing Firestore responder token write contract so backend senders do not change.

**Verification:**

- responder app typecheck and lint
- manual device check: token registers and updates `responders/{uid}.hasFcmToken`
- tap on push opens the intended dispatch detail route

**Exit condition:** The same responder account can receive a dispatch notification through native push and land in the correct dispatch screen.

### Task 3: Define telemetry contracts and RTDB write boundaries

**Primary files:**

- Modify: `packages/shared-validators/src/responders.ts`
- Modify: `packages/shared-validators/src/index.ts`
- Modify: `functions/src/__tests__/rules/responders.rules.test.ts`
- Modify: `functions/src/__tests__/rtdb.rules.test.ts`
- Modify: `infra/firebase/database.rules.json`

**Deliverables:**

- Formalize the telemetry payload contract used by responder clients and RTDB rules:
  - `capturedAt`
  - `receivedAt`
  - `lat`
  - `lng`
  - `accuracy`
  - `batteryPct`
  - `motionState`
  - `appVersion`
  - `telemetryStatus`
- Tighten RTDB rule tests for:
  - self-only responder location writes
  - municipality/agency-gated reads
  - timestamp plausibility
  - projection node read/write separation

**Verification:**

- `pnpm --filter @bantayog/shared-validators test`
- `firebase emulators:exec --only firestore,database,storage "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rtdb.rules.test.ts src/__tests__/rules/responders.rules.test.ts"`

**Exit condition:** Telemetry writes have an explicit schema and the rule layer rejects malformed or cross-user writes.

### Task 4: Implement native telemetry capture and duty-aware emission

**Primary files:**

- Create: `apps/responder-app/src/services/telemetry-client.ts`
- Create: `apps/responder-app/src/hooks/useResponderTelemetry.ts`
- Modify: `apps/responder-app/src/pages/DispatchDetailPage.tsx`
- Modify: `apps/responder-app/src/pages/DispatchListPage.tsx`
- Modify: `apps/responder-app/src/main.tsx`

**Deliverables:**

- Start telemetry only when responder is on an active dispatch or an explicitly enabled duty state.
- Encode the architecture’s sampling tiers:
  - moving high-priority
  - walking/normal
  - still at staging
  - low battery
  - no active dispatch = no tracking
- Persist enough local state to survive app pause/resume without duplicate watchers.
- Write telemetry to RTDB and update `responders/{uid}.lastTelemetryAt`.

**Verification:**

- responder app typecheck/lint
- device drill with logging enabled shows cadence changes when dispatch state or motion state changes
- RTDB node updates at expected intervals during emulator-backed dev session

**Exit condition:** Telemetry emission is active, bounded, and stops when the responder is not supposed to be tracked.

### Task 5: Build the server-side projection and stale-state pipeline

**Primary files:**

- Create: `functions/src/scheduled/project-responder-locations.ts`
- Modify: `functions/src/index.ts`
- Modify: `functions/src/__tests__/scheduled/admin-operations-sweep.test.ts`
- Create: `functions/src/__tests__/scheduled/project-responder-locations.test.ts`

**Deliverables:**

- Create the scheduled job that projects active responder locations into `shared_projection/{municipalityId}/{uid}`.
- Implement 100m grid rounding, municipality grouping, and 90s TTL cleanup.
- Compute stale/degraded/offline freshness bands from recent telemetry.
- Keep own-agency full-fidelity reads separate from cross-agency projection reads.

**Verification:**

- targeted vitest for projection job
- emulator run validating RTDB writes and expiry behavior

**Exit condition:** Admin surfaces can subscribe to cross-agency responder positions without reading every agency’s raw location feed.

### Task 6: Extend the responder field workflow callables

**Primary files:**

- Create: `functions/src/callables/submit-responder-witnessed-report.ts`
- Create: `functions/src/callables/trigger-sos.ts`
- Create: `functions/src/callables/request-backup.ts`
- Create: `functions/src/callables/mark-dispatch-unable-to-complete.ts`
- Modify: `functions/src/index.ts`
- Create tests under `functions/src/__tests__/callables/`

**Deliverables:**

- `submitResponderWitnessedReport`
- `triggerSOS`
- `requestBackup`
- `markDispatchUnableToComplete`
- idempotency and rate-limit coverage for each callable
- notification fanout for SOS and witness-report attention paths

**Verification:**

- targeted callable tests
- functions lint + typecheck
- emulator-backed acceptance test for unable-to-complete returning work to admin queue

**Exit condition:** Responder-only high-stakes actions are server-authoritative and audit-friendly.

### Task 7: Upgrade responder UX for field operation, not just dispatch state changes

**Primary files:**

- Modify: `apps/responder-app/src/routes.tsx`
- Modify: `apps/responder-app/src/pages/DispatchDetailPage.tsx`
- Create: `apps/responder-app/src/pages/ResponderWitnessReportPage.tsx`
- Create: `apps/responder-app/src/pages/SosPage.tsx`
- Create: `apps/responder-app/src/pages/BackupRequestPage.tsx`
- Create responder tests under `apps/responder-app/src/`

**Deliverables:**

- responder-witness report form
- SOS trigger UI with confirmation and failure recovery
- backup request UI
- unable-to-complete flow
- better race-loss recovery:
  - re-fetch server state after write rejection
  - show institutional cancellation screen, not generic modal
  - preserve operator context for follow-up actions

**Verification:**

- responder app tests for race-loss, witness form validation, and escalation actions
- manual device drill for push → accept → cancel race

**Exit condition:** The responder app supports the field workflows the architecture spec explicitly assigns to responders.

### Task 8: Add responder-to-responder handoff and availability management

**Primary files:**

- Create: `functions/src/callables/responder-shift-handoff.ts` or extend existing handoff module with responder-specific docs
- Modify: `packages/shared-validators/src/coordination.ts`
- Modify: `apps/responder-app/src/pages/DispatchListPage.tsx`
- Create handoff hooks/pages/tests in `apps/responder-app/src/`

**Deliverables:**

- responder-to-responder handoff doc flow (`responder_shift_handoffs`)
- availability controls:
  - `available`
  - `unavailable`
  - `off_duty`
  - required reason for non-available states
- escalation for unaccepted handoffs within 30 minutes

**Verification:**

- callable tests
- coordination schema tests
- responder app tests for handoff acceptance and availability toggles

**Exit condition:** A responder can end a shift or temporarily step away without losing auditability or leaving admins blind.

### Task 9: Extend the admin desktop for agency responder operations

**Primary files:**

- Modify: `apps/admin-desktop/src/routes.tsx`
- Modify: `apps/admin-desktop/src/pages/AgencyAssistanceQueuePage.tsx`
- Modify: `apps/admin-desktop/src/pages/DispatchModal.tsx`
- Modify: `apps/admin-desktop/src/hooks/useEligibleResponders.ts`
- Modify: `apps/admin-desktop/src/services/callables.ts`
- Create tests in `apps/admin-desktop/src/__tests__/`

**Deliverables:**

- agency-admin roster management:
  - create responder
  - suspend responder
  - revoke responder access
- bulk availability controls
- specialization tags surfaced in dispatch selection
- responder selection enriched with telemetry-derived context where available:
  - freshness
  - last known position
  - optional distance/ETA if feasible without widening callable contracts
- agency-admin handling for assistance request accept/decline in the main desktop workflow

**Verification:**

- targeted admin-desktop vitest runs
- lint + typecheck for admin-desktop

**Exit condition:** Agency admins can manage the people whose device and telemetry behavior now matter in production drills.

### Task 10: Run the Phase 6 drill and lock the acceptance evidence

**Primary files:**

- Create: `tests/e2e/responder-phase-6.spec.ts` or extend existing e2e package with phase-specific spec
- Modify: `docs/progress.md`
- Modify: `docs/learnings.md`

**Deliverables:**

- device drill script covering:
  - native push delivery
  - accept/advance flow
  - race-loss during resolve
  - responder-witness report
  - unable-to-complete → reassignment
  - telemetry freshness and projection visibility
- battery drill evidence for 12-hour staging test
- explicit record of residual risks by device/platform

**Verification:**

- emulator acceptance tests green
- responder-app, admin-desktop, functions lint/typecheck green
- documented real-device drill results written to progress notes

**Exit condition:** Phase 6 is not “done” until the device drill evidence exists and the pilot-blocker scenarios are either passing or explicitly recorded as open blockers.

## Recommended Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
9. Task 9
10. Task 10

## Parallelism Notes

- After Task 1, Tasks 2 and 3 can run in parallel.
- Task 4 depends on Tasks 1, 2, and 3.
- Task 5 depends on Task 3 and should start once telemetry contract work is merged.
- Task 6 can start after Task 3 if schema/rule changes needed by responder-witness and escalation flows are available.
- Task 7 depends on Tasks 2 and 6.
- Task 8 depends on Task 6 if responder handoff uses new callable surfaces.
- Task 9 can overlap late with Tasks 7 and 8 once backend contracts stabilize.
- Task 10 is the final gate and should not be split from evidence capture in `docs/progress.md`.

## Verification Matrix

- Shared validators:
  - `pnpm --filter @bantayog/shared-validators test`
- Functions targeted:
  - `pnpm --filter @bantayog/functions lint`
  - `pnpm --filter @bantayog/functions typecheck`
  - `pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/*.test.ts`
  - `firebase emulators:exec --only firestore,database,storage "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rtdb.rules.test.ts src/__tests__/rules/responders.rules.test.ts src/__tests__/scheduled/project-responder-locations.test.ts"`
- Responder app:
  - `pnpm --filter @bantayog/responder-app lint`
  - `pnpm --filter @bantayog/responder-app typecheck`
  - `pnpm --filter @bantayog/responder-app build`
- Admin desktop:
  - `pnpm --filter @bantayog/admin-desktop lint`
  - `pnpm --filter @bantayog/admin-desktop typecheck`
  - targeted vitest for agency/responder management UI
- Real-device gates:
  - iOS native build boots and receives push
  - Android native build boots and receives push
  - 12-hour battery drill evidence recorded

## Open Technical Decisions To Resolve Early

1. Background telemetry plugin choice.
   Reason: the architecture’s expected behavior is stricter than official `@capacitor/geolocation` directly provides.

2. Motion-state source of truth on iOS.
   Reason: official `@capacitor/motion` is web-API based, while the architecture expects native motion-activity behavior.

3. Whether responder handoff reuses the existing `shift_handoffs` module or gets a responder-specific callable/module split.
   Reason: admin handoff and responder handoff are similar, but not the same workflow or data retention story.

4. Whether distance/ETA enrichment stays client-side or gains a backend helper.
   Reason: the current admin responder selection contract is intentionally thin and should not be widened casually.

## Definition of Done

- Native iOS and Android responder builds exist and are reproducible.
- Native push replaces the web-only responder notification path for real devices.
- Telemetry writes, rules, and cross-agency projection are live and tested.
- Responder-witness, SOS, backup, unable-to-complete, and responder handoff flows are implemented with tests.
- Agency-admin desktop supports the responder operations that Phase 6 introduces.
- Real device drill evidence exists for battery, push, race-loss, and stale/offline telemetry behavior.
- `docs/progress.md` records Phase 6 status and `docs/learnings.md` captures non-obvious implementation constraints discovered during the work.
