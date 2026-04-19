# Phase 3c Implementation Ready - Next Steps

**Date:** 2026-04-19  
**Branch:** `feature/phase-3c-responder-loop-e2e`  
**Status:** ✅ AUTOMATED FIXES COMPLETE - Manual staging verification required

---

## ✅ Completed Work Summary

### Critical Blockers Resolved

1. **✅ State machine architecture fixed**
   - Dispatch states: `pending` → `accepted` → `acknowledged` → `en_route` → `on_scene` → `resolved`
   - 21 state transitions (up from 5)
   - All 127 tests passing
   - Firestore rules regenerated

2. **✅ Helper functions ready**
   - `dispatchToReportState()` for mirror trigger
   - State machine properly owned by validators package

3. **✅ Documentation complete**
   - VAPID rotation runbook: `docs/runbooks/fcm-vapid-rotation.md`
   - Precondition verification guide: `scripts/phase-3c/PRECONDITION_VERIFICATION.md`
   - Session summary: `docs/phase-3c-fix-session-summary.md`

4. **✅ Feature branch ready**
   - `feature/phase-3c-responder-loop-e2e` created
   - 3 commits on branch with all fixes

---

## ⚠️ Remaining Manual Verification

**Access Required:** Firebase Console (staging) + GCP Secret Manager

### Quick Verification Checklist

1. **Test Accounts** (2 min)

   ```
   Firebase Console → Authentication → Users
   Verify accounts exist:
   ☐ citizen-test-01
   ☐ daet-admin-test-01 (claims: role=municipal_admin, municipalityId=daet, active=true)
   ☐ bfp-responder-test-01 (claims: role=responder, municipalityId=daet, active=true)
   ```

2. **Responder Document** (1 min)

   ```
   Firestore Console → Data → responders → bfp-responder-test-01
   Verify:
   ☐ isActive: true
   ☐ fcmTokens: [] (empty array)
   ☐ municipalityId: daet
   ☐ agencyId: bfp-daet
   ```

3. **Feature Flag** (1 min)

   ```
   Firestore Console → Data → system_config → features
   Verify:
   ☐ dispatch_mirror_enabled: true
   ```

4. **VAPID Secrets** (2 min)
   ```bash
   gcloud secrets versions list fcm-vapid-private-key \
     --project=bantayog-alert-staging
   ```
   Expected: At least one version listed

---

## 🚀 Implementation Readiness

### Ready to Implement Phase 3c Features

Once manual verification is complete, you can begin implementing the 33 Phase 3c tasks:

**Priority Order:**

**Group B (3 hours)** - acceptDispatch callable

- Task 4-6: Create callable, add tests, integrate with dispatcher

**Group C (2 hours)** - Widen cancelDispatch

- Task 7-8: Allow cancel from accepted/acknowledged/en_route/on_scene

**Group D (2 hours)** - closeReport callable

- Task 9-10: Create callable for admin incident closure

**Group E (4 hours)** - Mirror trigger

- Task 11-12: dispatch-mirror-to-report trigger with state mapping

**Group F (3 hours)** - Firestore rules

- Task 13-14: Rules for responder direct-write, admin operations

**Group G (6 hours)** - Responder PWA UI

- Task 15-19: Dispatch detail page, progression buttons, cancelled screen

**Group H (5 hours)** - FCM pipeline

- Task 20-24: Service worker, FCM hooks, push notification sending

**Group I (2 hours)** - Admin UI

- Task 25-26: Close report modal integration

**Group J (8 hours)** - E2E tests

- Task 27-31: Playwright specs for citizen, admin, responder, full-loop, race-loss

**Group K (2 hours)** - Acceptance script

- Task 32: End-to-end acceptance test

**Group L (2 hours)** - Monitoring/docs

- Task 33: Metrics and runbooks

**Total Estimate:** 20-40 hours

---

## 📋 Implementation Commands

### 1. Verify Staging (Manual)

Follow checklist in `scripts/phase-3c/PRECONDITION_VERIFICATION.md`

### 2. Run 3b Acceptance Test (After Staging Verification)

```bash
# Against local emulator
firebase emulators:exec --only firestore \
  "pnpm exec tsx scripts/phase-3b/acceptance.ts"

# Against staging (requires service account)
firebase emulators:start --only firestore
pnpm exec tsx scripts/phase-3b/acceptance.ts --env=staging
```

### 3. Start Phase 3c Implementation

```bash
# You're already on the correct branch
git branch  # Should show feature/phase-3c-responder-loop-e2e

# Reference plan
cat docs/superpowers/plans/2026-04-18-phase-3c-responder-loop-e2e.md

# Start with Group B: acceptDispatch callable
```

---

## 🔑 Key Implementation Notes

### State Machine Changes Impact

The following now work with the new state machine:

1. **Responder Progression UI**
   - "Heading there" button: `acknowledged → en_route`
   - "Arrived on scene" button: `en_route → on_scene`
   - "Complete incident" button: `on_scene → resolved`

2. **Mirror Trigger**
   - Uses `dispatchToReportState()` helper
   - Maps: `en_route → 'en_route'`, `on_scene → 'on_scene'`
   - Returns `null` for `cancelled` (cancelDispatch owns report write)

3. **Firestore Rules**
   - `validResponderTransition()` function includes all 21 transitions
   - Responder can direct-write status updates
   - Admin can cancel from any mid-lifecycle state

### FCM Integration Points

When implementing Group H (FCM pipeline):

- VAPID keys must be provisioned first (see runbook)
- Service worker registration: `apps/responder-app/src/sw/firebase-messaging-sw.ts`
- FCM token registration: `useRegisterFcmToken` hook
- Push notification sending: `functions/src/services/fcm-send.ts`

---

## 📊 Commit History

```
a91e839 docs(phase-3c): add verification guide and session summary
b9cde85 docs(runbooks): add FCM VAPID key rotation runbook
d2925e2 fix(state-machine): prepare dispatch machine for Phase 3c responder loop
79311ef feat(admin): Phase 3b — Admin Triage Dispatch (#44)
```

---

## ✅ Exit Criteria

Before marking Phase 3c ready, ensure:

- [x] State machine uses `en_route` and `on_scene`
- [x] All 21 transitions defined and tested
- [x] Firestore rules regenerated
- [x] All tests pass (127/127)
- [ ] Staging accounts verified (manual)
- [ ] Feature flag verified (manual)
- [ ] VAPID secrets provisioned (manual)
- [ ] 3b acceptance test passes

**Current Status:** Automated fixes ✅ | Manual verification ⏳

---

**Next Action:** Complete the manual staging verification checklist (above), then proceed with Group B implementation following the plan.

---

**Implementation Plan:** `docs/superpowers/plans/2026-04-18-phase-3c-responder-loop-e2e.md`  
**Verification Guide:** `scripts/phase-3c/PRECONDITION_VERIFICATION.md`  
**Session Summary:** `docs/phase-3c-fix-session-summary.md`
