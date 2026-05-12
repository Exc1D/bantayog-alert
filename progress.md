# Progress Log

## 2026-05-11 — Feature Removal & Cleanup

### Completed

#### Backend Audit & Verification

- Ran parallel agent review of admin-desktop backend
- Audited security, tech debt, dead code, code simplification, and architecture
- Ran 10 verification subagents to confirm all audit findings

#### SMS Feature Removal

- Deleted all SMS provider implementations (Semaphore, GlobeLabs, Fake)
- Deleted SMS webhooks (inbound, delivery report)
- Deleted SMS triggers (dispatch outbox, health evaluation, delivery reconciliation, minute window cleanup)
- Deleted SMS inbox processor
- Deleted SMS health circuit breaker
- Removed SMS consent logic from `verify-report`, `close-report`, `dispatch-responder`, `process-inbox-item`
- Removed SMS nulling from `retention-sweep` and `erasure-sweep`
- Removed SMS fields from `request-data-export`
- Removed `sms_inbox` from `set-retention-exempt` collection enum
- Removed `defaultSmsLocale` and `mdrrmoSmsShortCode` from municipality schema and seed data
- Removed SMS rules from `firestore.rules`
- Removed 3 `sms_outbox` indexes from `firestore.indexes.json`

#### NDRRMC Escalation Removal

- Deleted `request-provincial-escalation.ts`
- Deleted `requestMassAlertEscalation` and `forwardMassAlertToNDRRMC` callables
- Removed NDRRMC route from mass alert types

#### PAGASA Integration Removal

- Deleted `declare-hazard-signal.ts`, `replay-signal-dead-letter.ts`, `prewarm-surge.ts`
- Deleted `pagasa-signal-poll.ts` and `hazard-signal-expiry-sweep.ts` triggers
- Deleted `hazard-signal-projector.ts` service
- Removed hazard signal rules from `firestore.rules`

#### Break Glass Protocol Removal

- Deleted `break-glass.ts` callable
- Deleted `sweep-expired-break-glass-sessions.ts` trigger
- Removed break glass event rules from `firestore.rules`

#### Mass Alert System Removal

- Deleted `mass-alert.ts` callable
- Deleted `fcm-mass-send.ts` service
- Removed mass alert callables from frontend `callables.ts`

#### Frontend Cleanup

- Removed `SmsOutboxEntry` interface from `apps/admin-desktop/src/types/index.ts`
- Removed 10 callables from `apps/admin-desktop/src/services/callables.ts`:
  - `massAlertReachPlanPreview`
  - `sendMassAlert`
  - `requestMassAlertEscalation`
  - `forwardMassAlertToNDRRMC`
  - `initiateBreakGlass`
  - `deactivateBreakGlass`
  - `replayDeadLetter`
  - `prewarmSurge`
  - `requestProvincialEscalation`

#### Test Cleanup

- Deleted 24+ test files for removed features
- Removed SMS test cases from 9 remaining test files:
  - `process-inbox-item.test.ts`
  - `process-inbox-item-prc2.test.ts`
  - `erasure-sweep.test.ts`
  - `close-report.test.ts`
  - `dispatch-responder.test.ts`
  - `verify-report.test.ts`
  - `public-collections.rules.test.ts`
- Removed SMS salt setup and `sms_outbox` assertions

#### Verification

- TypeScript compile check: **PASSED** (0 errors)
- Test suite: **243/243 tests passing**

### Files Deleted

**Source files (25):**

- `functions/src/services/send-sms.ts`
- `functions/src/services/sms-health.ts`
- `functions/src/services/sms-provider.ts`
- `functions/src/services/sms-providers/factory.ts`
- `functions/src/services/sms-providers/fake.ts`
- `functions/src/services/sms-providers/globelabs.ts`
- `functions/src/services/sms-providers/semaphore.ts`
- `functions/src/services/fcm-mass-send.ts`
- `functions/src/services/hazard-signal-projector.ts`
- `functions/src/http/sms-delivery-report.ts`
- `functions/src/http/sms-inbound.ts`
- `functions/src/firestore/sms-inbound-processor.ts`
- `functions/src/triggers/dispatch-sms-outbox.ts`
- `functions/src/triggers/evaluate-sms-provider-health.ts`
- `functions/src/triggers/reconcile-sms-delivery-status.ts`
- `functions/src/triggers/cleanup-sms-minute-windows.ts`
- `functions/src/triggers/pagasa-signal-poll.ts`
- `functions/src/triggers/hazard-signal-expiry-sweep.ts`
- `functions/src/triggers/sweep-expired-break-glass-sessions.ts`
- `functions/src/callables/mass-alert.ts`
- `functions/src/callables/request-provincial-escalation.ts`
- `functions/src/callables/declare-hazard-signal.ts`
- `functions/src/callables/replay-signal-dead-letter.ts`
- `functions/src/callables/prewarm-surge.ts`
- `functions/src/callables/break-glass.ts`
- `functions/src/callables/dispatch-responder-notify.ts`
- `functions/src/callables/replay-audit-dead-letter.ts`

**Test files (24+):**

- All SMS tests, integration tests, and rules tests
- Break glass tests
- Mass alert tests
- PAGASA tests
- Acceptance tests for removed features

### Current State

- **Backend:** Clean, no SMS/NDRRMC/PAGASA/BreakGlass references
- **Frontend:** All removed callable references stripped
- **Rules:** SMS rules removed, indexes cleaned
- **Tests:** 243 passing, all SMS-related tests removed
- **Build:** TypeScript compiles without errors

### Next Steps

- Continue with core incident management workflow development
- Focus on municipal and provincial coordination features
- Revisit deferred features (SMS, NDRRMC, PAGASA, Break Glass) in future phases as requirements evolve
