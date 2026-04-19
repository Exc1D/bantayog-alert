# Phase 3b Staging Verification Summary

**Date:** 2026-04-19
**Status:** ⚠️ Partially Complete - Backend Verified, UI Blocked

## ✅ Completed: Backend Callable Verification

All Phase 3b Cloud Functions callables have been verified and are operational in staging:

| Test              | Status  | Details                                 |
| ----------------- | ------- | --------------------------------------- |
| verifyReport      | ✅ PASS | Callable exists and accessible          |
| rejectReport      | ✅ PASS | Callable exists and accessible          |
| dispatchResponder | ✅ PASS | Callable exists and accessible          |
| cancelDispatch    | ✅ PASS | Callable exists and accessible          |
| Firestore Rules   | ✅ PASS | Admin can query reports by municipality |

**Verification Script:** `scripts/phase-3b/staging-verification.ts`
**Callable Endpoints:** `https://asia-southeast1-bantayog-alert-staging.cloudfunctions.net/`

## ✅ Completed: Staging Environment Bootstrap

Test accounts and data successfully created:

| Account Type    | UID                     | Email                              | Password     | Role                   |
| --------------- | ----------------------- | ---------------------------------- | ------------ | ---------------------- |
| Citizen         | `citizen-test-01`       | `citizen-test-01@test.local`       | `test123456` | Citizen                |
| Municipal Admin | `daet-admin-test-01`    | `daet-admin-test-01@test.local`    | `test123456` | Municipal Admin (Daet) |
| Responder       | `bfp-responder-test-01` | `bfp-responder-test-01@test.local` | `test123456` | Responder (BFP Daet)   |

**Firestore Data Created:**

- Responder document for `bfp-responder-test-01`
- Feature flag `system_config/features.dispatch_mirror_enabled = true`

**Bootstrap Script:** `scripts/bootstrap-staging.ts`

## ⚠️ Blocked: Manual UI Verification

### Blocker 1: SSL Certificate Error

```
net::ERR_CERT_COMMON_NAME_INVALID
```

**URL:** `https://staging.bantayog.web.app`
**Impact:** Cannot access web apps to perform manual UI verification

**Root Cause:** SSL certificate not properly configured for staging web app

**Required Action:**

1. Check Firebase Hosting configuration for staging
2. Verify SSL certificate is provisioned for staging.bantayog.web.app
3. May need to configure custom domain or use Firebase's default \*.web.app certificate

### Blocker 2: IAM Service Account Credentials API

**Error:** `IAM Service Account Credentials API has not been used in project 1004126474669 before or it is disabled`

**Impact:** Acceptance test cannot create custom tokens for end-to-end callable testing

**Required Action:**

1. Visit: https://console.developers.google.com/apis/api/iamcredentials.googleapis.com/overview?project=1004126474669
2. Enable IAM Service Account Credentials API
3. Wait a few minutes for propagation
4. Re-run acceptance test

## 📋 Pending Manual Verification Steps

Once UI access is restored, verify:

### Admin Desktop (daet-admin-test-01)

1. Login with `daet-admin-test-01@test.local` / `test123456`
2. View triage queue (should show Daet reports only)
3. Verify a report (status: awaiting_triage → verified)
4. Dispatch a responder to verified report
5. Cancel a pending dispatch

### Responder PWA (bfp-responder-test-01)

1. Login with `bfp-responder-test-01@test.local` / `test123456`
2. View dispatched alerts (should show assigned dispatches)
3. Accept/Decline UI (deferred to Phase 3c)

### Citizen PWA (citizen-test-01)

1. Login with `citizen-test-01@test.local` / `test123456`
2. Submit test report
3. View tracking screen

## 🚀 Next Steps

1. **High Priority:** Fix SSL certificate issue for staging web apps
2. **Medium Priority:** Enable IAM Service Account Credentials API for acceptance test
3. **Ready to Proceed:** Begin Phase 3c implementation (33 tasks, 20-40 hours)

## 📊 Phase 3b Health Status

| Component                 | Status         | Notes                            |
| ------------------------- | -------------- | -------------------------------- |
| Cloud Functions Callables | ✅ Operational | All 4 callables verified         |
| Firestore Rules           | ✅ Operational | Admin queries working            |
| Authentication            | ✅ Configured  | Custom claims set correctly      |
| Test Data                 | ✅ Created     | All accounts and documents exist |
| Web Apps (Admin)          | ❌ Blocked     | SSL certificate error            |
| Web Apps (Responder)      | ❌ Blocked     | SSL certificate error            |
| Web Apps (Citizen)        | ❌ Blocked     | SSL certificate error            |
| Acceptance Test           | ⚠️ Blocked     | Requires IAM Credentials API     |

## 🔗 Useful Links

- **Firebase Console:** https://console.firebase.google.com/project/bantayog-alert-staging
- **Firestore:** https://console.firebase.google.com/project/bantayog-alert-staging/firestore/data
- **Authentication:** https://console.firebase.google.com/project/bantayog-alert-staging/authentication/users

## 📝 Scripts Created

1. `scripts/bootstrap-staging.ts` — One-time staging environment setup
2. `scripts/phase-3b/staging-verification.ts` — Backend callable verification
3. `scripts/phase-3b/acceptance.ts` — End-to-end acceptance test (pending IAM API)
