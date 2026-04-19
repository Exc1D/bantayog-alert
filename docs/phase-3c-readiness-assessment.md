# Phase 3c Readiness Assessment

**Assessment Date:** 2026-04-19  
**Branch:** main (commit 79311ef - Phase 3b merge)  
**Plan Reference:** `docs/superpowers/plans/2026-04-18-phase-3c-responder-loop-e2e.md`

---

## Executive Summary

**❌ NOT READY TO PROCEED**

Phase 3c implementation is **blocked by critical architectural issues** in the dispatch state machine and missing infrastructure. The current codebase has diverged from the Phase 3c specification in ways that will cause widespread breakage if implementation begins without fixes.

**Key Findings:**

- Dispatch state machine uses `in_progress` instead of required `en_route`/`on_scene` states
- Missing 6 of 11 required state transitions
- State machine source-of-truth is fragmented across packages
- All 8 major 3c backend components are missing
- Critical preconditions (VAPID secrets, staging accounts) unverified

**Estimated Fix Time:** 2-4 hours for state machine refactor + precondition verification  
**Phase 3c Work:** 33 tasks estimated at 20-40 hours

---

## 🔴 Critical Blockers

### 1. Dispatch State Machine Mismatch (Architecture Breaking)

**Problem:** The plan specifies a granular responder progression flow, but the current codebase uses a collapsed `in_progress` state.

**Current Implementation (WRONG):**

```typescript
// packages/shared-validators/src/dispatches.ts
export const dispatchStatusSchema = z.enum([
  'pending',
  'accepted',
  'acknowledged',
  'in_progress', // ← Conflates 3 states
  'resolved',
  'declined',
  'timed_out',
  'cancelled',
  'superseded',
])
```

**Plan Specification:**

```typescript
// Expected (from plan §Group A, Task 1):
;('acknowledged',
  'en_route', // ← Missing
  'on_scene', // ← Missing
  'resolved')
```

**Impact Breakdown:**

- [ ] **Responder UI progression buttons** - Cannot implement `Heading there` / `Arrived on scene` without these states
- [ ] **Mirror trigger** - `dispatchToReportState()` helper will map wrong states to reports
- [ ] **FCM push notifications** - Will notify users about wrong state transitions
- [ ] **Firestore rules** - Transition validation logic is based on wrong state machine
- [ ] **Admin UI** - Cancel dispatch modal will gate on wrong statuses
- [ ] **Testing** - All 3c test scenarios reference non-existent states

**Severity:** BLOCKS ALL 3C WORK

---

### 2. Transitions Table Severely Incomplete

**Problem:** Only 5 transitions exist; 11 required.

**Current (5 transitions):**

```typescript
// packages/shared-validators/src/state-machines/report-states.ts
export const DISPATCH_TRANSITIONS: readonly [DispatchStatus, DispatchStatus][] = [
  ['accepted', 'acknowledged'],
  ['acknowledged', 'in_progress'], // ← Wrong state
  ['in_progress', 'resolved'], // ← Wrong state
  ['pending', 'cancelled'],
  ['pending', 'declined'],
]
```

**Required (11+ transitions from plan §Task 2):**

```typescript
['pending', ['accepted', 'declined', 'cancelled', 'timed_out', 'superseded']],
['accepted', ['acknowledged', 'cancelled', 'superseded']],
['acknowledged', ['en_route', 'cancelled', 'superseded']],      // ← Missing
['en_route', ['on_scene', 'cancelled', 'superseded']],            // ← Missing
['on_scene', ['resolved', 'cancelled', 'superseded']],          // ← Missing
['resolved', []],                                                // ← Missing
['declined', []],                                                // ← Missing
['timed_out', []],                                               // ← Missing
['cancelled', []],                                              // ← Missing
['superseded', []],                                              // ← Missing
```

**Missing Transitions:**

1. `acknowledged → en_route` (responder starts moving)
2. `en_route → on_scene` (responder arrives)
3. `on_scene → resolved` (responder completes incident)
4. `resolved → []` (terminal state)
5. Terminal states for `declined`, `timed_out`, `superseded`
6. Admin cancel from `accepted`, `acknowledged`, `en_route`, `on_scene`

**Severity:** BLOCKS ALL 3C WORK

---

### 3. State Machine Source-of-Truth Fragmented

**Problem:** Dispatch states are re-exported from wrong locations, breaking the validators-own-the-state-machine pattern.

**Current Code:**

```typescript
// packages/shared-validators/src/state-machines/dispatch-states.ts
export { DISPATCH_TRANSITIONS } from './report-states.js' // ← WRONG FILE
export type { DispatchStatus } from '@bantayog/shared-types' // ← WRONG PACKAGE
```

**Why This Breaks Things:**

1. **Report states** and **dispatch states** are different lifecycles
2. Shared-types package should NOT own domain logic (validators should)
3. Re-exporting from `report-states.js` means dispatch and report transitions are coupled
4. The Zod schema in `dispatches.ts` doesn't match the transition table
5. Codegen rules build from the wrong source of truth

**Correct Pattern (from plan §Task 3):**

```typescript
// Should be:
export type { DispatchStatus } from '../../dispatches.js'
export { DISPATCH_TRANSITIONS } from './dispatch-states.js' // Self-contained
```

**Severity:** ARCHITECTURAL SMELL - Causes confusion and bugs

---

## 🟡 Missing Phase 3c Infrastructure

### Backend Components (All Missing)

| Component                        | File Path                                                             | Status     | Blocks                     |
| -------------------------------- | --------------------------------------------------------------------- | ---------- | -------------------------- |
| `acceptDispatch` callable        | `functions/src/callables/accept-dispatch.ts`                          | ❌ Missing | Responder cannot accept    |
| `closeReport` callable           | `functions/src/callables/close-report.ts`                             | ❌ Missing | Admin cannot close reports |
| `dispatchMirrorToReport` trigger | `functions/src/triggers/dispatch-mirror-to-report.ts`                 | ❌ Missing | No report↔dispatch sync    |
| `fcm-send` service               | `functions/src/services/fcm-send.ts`                                  | ❌ Missing | No push notifications      |
| `dispatchToReportState` helper   | `packages/shared-validators/src/state-machines/dispatch-to-report.ts` | ❌ Missing | Mirror trigger broken      |

### Frontend Components (All Missing)

| Component                  | File Path                                             | Status     | Blocks              |
| -------------------------- | ----------------------------------------------------- | ---------- | ------------------- |
| `useDispatch` hook         | `apps/responder-app/src/hooks/useDispatch.ts`         | ❌ Missing | No detail page      |
| `useAcceptDispatch` hook   | `apps/responder-app/src/hooks/useAcceptDispatch.ts`   | ❌ Missing | No accept button    |
| `useAdvanceDispatch` hook  | `apps/responder-app/src/hooks/useAdvanceDispatch.ts`  | ❌ Missing | No progression UI   |
| `useRegisterFcmToken` hook | `apps/responder-app/src/hooks/useRegisterFcmToken.ts` | ❌ Missing | No FCM tokens       |
| `DispatchDetailPage`       | `apps/responder-app/src/pages/DispatchDetailPage.tsx` | ❌ Missing | No detail view      |
| `CancelledScreen`          | `apps/responder-app/src/pages/CancelledScreen.tsx`    | ❌ Missing | No race-loss UX     |
| FCM service worker         | `apps/responder-app/src/sw/firebase-messaging-sw.ts`  | ❌ Missing | No background push  |
| `CloseReportModal`         | `apps/admin-desktop/src/pages/CloseReportModal.tsx`   | ❌ Missing | Can't close reports |

### E2E Testing (Completely Missing)

| Component           | File Path                                | Status     | Blocks                    |
| ------------------- | ---------------------------------------- | ---------- | ------------------------- |
| E2E workspace       | `apps/e2e-tests/`                        | ❌ Missing | No E2E coverage           |
| Playwright config   | `apps/e2e-tests/playwright.config.ts`    | ❌ Missing | Can't run full-loop tests |
| `citizen.spec.ts`   | `apps/e2e-tests/specs/citizen.spec.ts`   | ❌ Missing | No citizen flow test      |
| `admin.spec.ts`     | `apps/e2e-tests/specs/admin.spec.ts`     | ❌ Missing | No admin flow test        |
| `responder.spec.ts` | `apps/ee-tests/specs/responder.spec.ts`  | ❌ Missing | No responder flow test    |
| `full-loop.spec.ts` | `apps/e2e-tests/specs/full-loop.spec.ts` | ❌ Missing | No integration test       |
| `race-loss.spec.ts` | `apps/e2e-tests/specs/race-loss.spec.ts` | ❌ Missing | No race-loss test         |

**Severity:** BLOCKS ALL 3C WORK

---

## 🟡 Documentation & Precondition Gaps

### Unverified Preconditions

| Precondition                                           | Status            | Risk         | Verification Command                                                                                    |
| ------------------------------------------------------ | ----------------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| Staging test accounts exist                            | ⚠️ Not verified   | HIGH         | `firebase emulators:exec --only firestore "pnpm exec tsx scripts/phase-3b/bootstrap-test-responder.ts"` |
| VAPID secrets provisioned                              | ❌ Not done       | CRITICAL     | `gcloud secrets versions list fcm-vapid-private-key --project=bantayog-alert-staging`                   |
| `system_config/features/dispatch_mirror_enabled: true` | ⚠️ Not verified   | HIGH         | Manual check in Firestore console                                                                       |
| Phase 3c branch created                                | ❌ Does not exist | BLOCKS START | `git checkout -b feature/phase-3c-responder-loop-e2e main`                                              |

### Missing Documentation

| Artifact               | Status     | Blocks                                  |
| ---------------------- | ---------- | --------------------------------------- |
| VAPID rotation runbook | ❌ Missing | Operator won't know how to rotate keys  |
| Responder-loop runbook | ❌ Missing | Ops can't troubleshoot stuck dispatches |
| FCM metrics Terraform  | ❌ Missing | No monitoring for push failures         |
| Mirror drift metrics   | ❌ Missing | No alerting for sync failures           |

---

## Required Fixes Before Starting 3c

### Phase A: Fix State Machine (2-4 hours, CRITICAL)

**Task 1:** Extend `dispatchStatusSchema` (plan §Task 1)

- [ ] Add `en_route` to dispatch enum
- [ ] Add `on_scene` to dispatch enum
- [ ] Remove `in_progress` from dispatch enum
- [ ] Update Zod schema
- [ ] Run tests to verify

**Task 2:** Rewrite `DISPATCH_TRANSITIONS` (plan §Task 2)

- [ ] Replace 5-transition table with 11-transition table
- [ ] Add missing responder progression transitions
- [ ] Add terminal state declarations
- [ ] Add admin cancel from mid-lifecycle states
- [ ] Regenerate Firestore rules via `pnpm exec tsx scripts/build-rules.ts`

**Task 3:** Add `dispatchToReportState` helper (plan §Task 3)

- [ ] Create pure translation function
- [ ] Add exhaustive test matrix (9 states → ReportStatus|null)
- [ ] Export from state-machines/index.ts
- [ ] Verify `cancelled` returns `null` (cancel callable owns report write)

### Phase B: Verify Preconditions (1-2 hours, CRITICAL)

**Task 4:** Confirm staging infrastructure

- [ ] Verify citizen-test-01 account exists
- [ ] Verify daet-admin-test-01 account exists
- [ ] Verify bfp-responder-test-01 account exists
- [ ] Check `responders/{uid}` has `isActive: true` and `fcmTokens: []`

**Task 5:** Provision VAPID secrets

- [ ] Run `docs/runbooks/fcm-vapid-rotation.md` (create this first)
- [ ] Provision `fcm-vapid-public-key` in Secret Manager
- [ ] Provision `fcm-vapid-private-key` in Secret Manager
- [ ] Grant access to functions runtime service account
- [ ] Expose public key as `VITE_FCM_VAPID_PUBLIC_KEY` env var

**Task 6:** Create feature branch

- [ ] Run `git checkout main`
- [ ] Run `git pull origin main`
- [ ] Run `git checkout -b feature/phase-3c-responder-loop-e2e`

**Task 7:** Verify feature flags

- [ ] Check `system_config/features/dispatch_mirror_enabled: true` in staging Firestore
- [ ] If missing, seed document with `{ value: true, updatedAt: Timestamp.now() }`

---

## Detailed Findings

### State Machine Analysis

**Current Dispatch States:**

```
pending → accepted → acknowledged → in_progress → resolved
                                   ↓
                              declined/timed_out/cancelled/superseded
```

**Required Dispatch States (plan):**

```
pending → accepted → acknowledged → en_route → on_scene → resolved
         ↓            ↓              ↓            ↓
      declined      cancelled      cancelled    cancelled
      timed_out     superseded     superseded   superseded
```

**The Problem:**

- `in_progress` is a collapsed state that hides responder location
- Missing `en_route` and `on_scene` means responders can't report their ETA
- The mirror trigger has no way to map `in_progress` to a report state
- Admin UI shows "In progress" instead of "En route" or "On scene"

### Firestore Rules Impact

The rules codegen pipeline (`scripts/build-rules.ts`) generates:

```javascript
// Current generated rules (WRONG):
allow update: if isValidDispatchTransition(resource.data.status, request.resource.data.status)

// This validates against the 5-transition table, which means:
// - acknowledged → en_route is DENIED (transition not in table)
// - en_route → on_scene is DENIED (transition not in table)
// - on_scene → resolved is DENIED (transition not in table)
```

**Effect:** All responder direct-write operations will be rejected by security rules until the state machine is fixed and rules are regenerated.

### Database Index Gaps

Current `firestore.indexes.json` has only one dispatch index:

```json
{
  "collectionGroup": "dispatches",
  "fields": [
    { "fieldPath": "responderId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "dispatchedAt", "order": "DESCENDING" }
  ]
}
```

**Missing indexes needed for 3c:**

1. Admin triage queue composite index (municipalityId + status + createdAt)
2. Responder dispatch list composite index (assignedTo.uid + status + dispatchedAt)
3. Mirror trigger query optimization (reportId lookup)

---

## Risk Assessment

### High-Risk Areas

| Risk                                           | Severity | Mitigation                                                   |
| ---------------------------------------------- | -------- | ------------------------------------------------------------ |
| State machine refactor breaks existing 3b code | HIGH     | 3b tests must still pass after refactor; run full test suite |
| VAPID secret rotation in production            | HIGH     | Document in runbook; add rotation reminder to calendar       |
| FCM service worker caching                     | MEDIUM   | Add version stamp and update detection                       |
| Mirror trigger race conditions                 | MEDIUM   | Transactional writes + skip logic for cancelled              |
| Playwright timing flakiness in staging         | MEDIUM   | 3 consecutive run requirement gates flaky tests              |

### Forward Compatibility Concerns

The plan claims these hooks are preserved:

- Responder direct-write rule allowlist
- `dispatchToReportState` returning null for cancelled
- FCM warnings return type

**Reality check:** These don't exist yet, so forward compat is untested. The plan assumes these will be implemented correctly, but we have no proof.

---

## Timeline Estimate

### State Machine Fix (MUST DO FIRST)

- Task 1: Extend schema: 30 min
- Task 2: Rewrite transitions: 45 min
- Task 3: Add helper + tests: 45 min
- **Total:** ~2 hours

### Preconditions Verification

- Staging accounts: 15 min
- VAPID secrets: 45 min (if runbook exists) or 2 hours (if creating from scratch)
- Feature flag check: 15 min
- Branch creation: 5 min
- **Total:** 1-3 hours

### Phase 3c Implementation (from plan)

- Group A (Tasks 1-3): Included in state machine fix above
- Group B (Tasks 4-6): acceptDispatch callable - 3 hours
- Group C (Tasks 7-8): widen cancelDispatch - 2 hours
- Group D (Tasks 9-10): closeReport callable - 2 hours
- Group E (Tasks 11-12): mirror trigger - 4 hours
- Group F (Tasks 13-14): Firestore rules - 3 hours
- Group G (Tasks 15-19): Responder PWA UI - 6 hours
- Group H (Tasks 20-24): FCM pipeline - 5 hours
- Group I (Tasks 25-26): Admin UI - 2 hours
- Group J (Tasks 27-31): E2E tests - 8 hours
- Group K (Task 32): Acceptance script - 2 hours
- Group L (Task 33): Monitoring/docs - 2 hours
- **Total:** 39 hours (plan says "20-40 hours")

### Critical Path

1. Fix state machine (2h) ← **BLOCKER**
2. Verify preconditions (1-3h) ← **BLOCKER**
3. Implement 3c (39h)

**Earliest start:** After 3-5 hours of prep work  
**Earliest completion:** ~2-3 days of focused development

---

## Recommendations

### Immediate Actions (Before Any 3c Work)

1. **DO NOT start Phase 3c implementation yet**

2. **Fix state machine as focused effort:**

   ```bash
   # Create prep branch
   git checkout -b fix/phase-3c-state-machine

   # Implement Tasks 1-3 from plan
   # Modify: packages/shared-validators/src/dispatches.ts
   # Modify: packages/shared-validators/src/state-machines/dispatch-states.ts
   # Create: packages/shared-validators/src/state-machines/dispatch-to-report.ts
   # Run: pnpm exec tsx scripts/build-rules.ts
   # Test: pnpm test
   # Commit, PR, merge to main
   ```

3. **Verify all preconditions:**
   - Check staging accounts exist
   - Provision VAPID secrets (or document that they're required)
   - Create feature branch
   - Verify system_config flags

4. **Then start Phase 3c implementation following plan exactly**

### Red Flags in Plan

The plan itself has some issues:

1. **Task 1 step ordering:** Plan says "write failing test first" but the test file `dispatches.test.ts` already exists and would need modification, not creation
2. **State machine coupling:** Plan has dispatch states re-exported from report-states, which contradicts the "validators own the state machine" principle
3. **Missing verification:** No task to verify VAPID secrets exist before Task 21
4. **E2E complexity:** 8 hours of Playwright tests is likely underestimated; browser automation with race-loss scenarios is notoriously flaky

### Alternative Approach

Consider **splitting Phase 3c into smaller phases:**

**Phase 3c-Alpha:** State machine fix + acceptDispatch + basic mirror trigger

- Validates the new state machine works
- No FCM complexity
- No E2E tests yet
- Can verify in staging quickly

**Phase 3c-Beta:** FCM + responder progression UI

- Adds push notifications
- Adds responder detail page
- Still no admin close

**Phase 3c-Gamma:** Admin close + E2E tests

- Completes the loop
- Adds full Playwright coverage
- Exit gating

This reduces risk and allows validation at each checkpoint.

---

## Conclusion

**We are NOT ready for Phase 3c.**

The dispatch state machine has architectural drift that must be fixed first. The current `in_progress` state is incompatible with the specified `en_route`/`on_scene` progression. Additionally, all major 3c components are missing, and critical preconditions are unverified.

**Required work before starting:**

1. Fix dispatch state machine (2 hours)
2. Verify staging infrastructure (1-3 hours)
3. Create feature branch (5 minutes)

**Total prep time:** 3-5 hours

**Phase 3c implementation time:** 39 hours (per plan)

**Recommendation:** Complete the state machine refactor as a focused prep effort, verify all preconditions, then begin Phase 3c implementation following the plan task-by-task.

---

**Assessment By:** Claude (Senior Staff Engineer)  
**Date:** 2026-04-19  
**Confidence:** HIGH (based on code audit against specification)
