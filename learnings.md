# Learnings & Decisions

## Feature Removals — 2026-05-11

### SMS Features Deferred

**Decision:** Remove all SMS-related functionality from admin-desktop for now.

**Scope removed:**

- Citizen SMS reception (sms-inbound webhook, sms-inbound-processor)
- SMS outbound queue and dispatch (send-sms, dispatch-sms-outbox trigger)
- SMS providers: Semaphore, GlobeLabs, Fake testing provider
- SMS webhooks: delivery reports, inbound messages
- SMS health monitoring and circuit breaker
- SMS consent tracking (report_sms_consent collection)
- SMS session management (sms_sessions collection)
- SMS minute window rate limiting cleanup

**Rationale:** SMS features are being deferred to a later phase. The current focus is on the core incident management workflow without SMS dependencies.

**Impact:**

- Deleted 25 source files and 24+ test files
- Removed `defaultSmsLocale` and `mdrrmoSmsShortCode` from municipality schema
- Removed SMS rules from `firestore.rules`
- Removed 3 `sms_outbox` indexes from `firestore.indexes.json`
- Stripped SMS enqueue logic from `verify-report`, `close-report`, `dispatch-responder`, `process-inbox-item`
- Removed SMS fields from retention/erasure sweeps and data export

---

### NDRRMC Escalation Removed

**Decision:** Remove National DRRMC escalation features.

**Scope removed:**

- `requestProvincialEscalation` callable
- `requestMassAlertEscalation` callable
- `forwardMassAlertToNDRRMC` callable
- Mass alert reach plan preview with NDRRMC route
- `sendMassAlert` callable

**Rationale:** NDRRMC escalation is out of scope for the current phase. The system will focus on municipal and provincial-level coordination.

---

### PAGASA Integration Removed

**Decision:** Remove PAGASA hazard signal integration.

**Scope removed:**

- `declareHazardSignal` and `clearHazardSignal` callables
- `replaySignalDeadLetter` callable
- `pagasa-signal-poll` trigger
- `hazard-signal-expiry-sweep` trigger
- `hazard-signal-projector` service
- Hazard signal status projection

**Rationale:** PAGASA integration is deferred. Hazard signals and automated polling are not required for the current release.

---

### Break Glass Protocol Removed

**Decision:** Remove Break Glass emergency access protocol.

**Scope removed:**

- `initiateBreakGlass` and `deactivateBreakGlass` callables
- `sweepExpiredBreakGlassSessions` trigger
- Break glass session management
- Break glass event logging

**Rationale:** Break Glass protocol is deferred to a later phase. Emergency access controls will be revisited when audit and compliance requirements are finalized.

---

### Mass Alert System Removed

**Decision:** Remove mass alert broadcast functionality.

**Scope removed:**

- `massAlertReachPlanPreview` callable
- `sendMassAlert` callable
- `fcm-mass-send` service
- Mass alert request collection rules

**Rationale:** Mass alerting depends on SMS and NDRRMC escalation, both of which are deferred. This feature will be reconsidered when those dependencies are reintroduced.

---

## Verification

- **TypeScript compile:** Passed with 0 errors
- **Test suite:** 243/243 tests passing
- **Firestore rules:** SMS rules block removed, all remaining rules validated
- **Frontend:** All removed callable references stripped from `callables.ts` and types

---

## Files Modified Summary

| File                                               | Changes                                          |
| -------------------------------------------------- | ------------------------------------------------ |
| `functions/src/index.ts`                           | Removed 26 exports                               |
| `infra/firebase/firestore.rules`                   | Removed SMS rules (lines 429-450)                |
| `infra/firebase/firestore.indexes.json`            | Removed 3 sms_outbox indexes                     |
| `packages/shared-validators/src/municipalities.ts` | Removed `defaultSmsLocale`, `mdrrmoSmsShortCode` |
| `apps/admin-desktop/src/types/index.ts`            | Removed `SmsOutboxEntry` interface               |
| `apps/admin-desktop/src/services/callables.ts`     | Removed 10 callables                             |
| `functions/src/services/geocode.ts`                | Removed `defaultSmsLocale` from types            |
| `functions/src/triggers/process-inbox-item.ts`     | Removed SMS locale variable                      |
| 9 test files                                       | Removed SMS-related test cases                   |
