# Phase 3c Precondition Verification

**Date:** 2026-04-19  
**Branch:** `feature/phase-3c-responder-loop-e2e`  
**Purpose:** Verify staging infrastructure before Phase 3c implementation

---

## ✓ Automated Checks (Complete)

1. ✅ **State machine fixed** — Dispatch states now have `en_route` and `on_scene`
2. ✅ **Transitions expanded** — 21 transitions (up from 5)
3. ✅ **Firestore rules regenerated** — Rules include new transitions
4. ✅ **Tests passing** — All 127 tests pass with new state machine
5. ✅ **VAPID runbook created** — `docs/runbooks/fcm-vapid-rotation.md`
6. ✅ **Feature branch created** — `feature/phase-3c-responder-loop-e2e`

---

## ⚠️ Manual Verification Required

### 1. Test Accounts Exist in Staging

**Accounts to verify:**

| Account ID              | Type            | Purpose                      | Verification Command                      |
| ----------------------- | --------------- | ---------------------------- | ----------------------------------------- |
| `citizen-test-01`       | Citizen         | Reporter in acceptance tests | Firebase Console → Authentication → Users |
| `daet-admin-test-01`    | Municipal Admin | Admin triage acceptance      | Firebase Console → Authentication → Users |
| `bfp-responder-test-01` | Responder       | Responder dispatch tests     | Firebase Console → Authentication → Users |

**Verification Steps:**

1. Open Firebase Console: https://console.firebase.google.com/project/bantayog-alert-staging/authentication/users
2. Search for each account by UID
3. Verify claims for each:
   - `citizen-test-01`: No special claims needed (citizen role)
   - `daet-admin-test-01`: `role: municipal_admin`, `municipalityId: daet`, `active: true`
   - `bfp-responder-test-01`: `role: responder`, `municipalityId: daet`, `agencyId: bfp-daet`, `active: true`

**If accounts missing, run bootstrap:**

```bash
# For emulator (local testing)
pnpm exec tsx scripts/phase-3b/bootstrap-test-responder.ts --emulator

# For staging (requires admin SDK credentials)
GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json pnpm exec tsx scripts/phase-3b/bootstrap-test-responder.ts
```

**Verify responder document:**

1. Open Firestore Console: https://console.firebase.google.com/project/bantayog-alert-staging/firestore/data
2. Navigate to: `responders/bfp-responder-test-01`
3. Verify:
   - `isActive: true`
   - `fcmTokens: []` (empty until Phase 3c registers token)
   - `municipalityId: daet`
   - `agencyId: bfp-daet`

---

### 2. Feature Flag Enabled

**Document:** `system_config/features/dispatch_mirror_enabled`

**Verification Steps:**

1. Open Firestore Console: https://console.firebase.google.com/project/bantayog-alert-staging/firestore/data
2. Navigate to: `system_config/features`
3. Verify field `dispatch_mirror_enabled` is `true`

**Expected document structure:**

```javascript
{
  dispatch_mirror_enabled: true,
  updatedAt: Timestamp(...),
  // ... other feature flags
}
```

**If missing, create document:**

```javascript
// Via Firestore Console
collection: system_config
document ID: features
fields:
  dispatch_mirror_enabled: true
  updatedAt: FieldValue.serverTimestamp()
```

Or via Firebase shell:

```bash
firebase firestore:main --project bantayog-alert-staging <<EOF
collection system_config
  doc features
    set {
      dispatch_mirror_enabled: true,
      updatedAt: Timestamp.now()
    }
EOF
```

---

### 3. VAPID Secrets Provisioned

**Secrets to verify:**

| Secret Name                 | Purpose                | Location                 |
| --------------------------- | ---------------------- | ------------------------ |
| `fcm-vapid-private-key`     | FCM push notifications | Secret Manager (staging) |
| `VITE_FCM_VAPID_PUBLIC_KEY` | Web push subscription  | Environment variable     |

**Verification Steps:**

1. Check Secret Manager:

   ```bash
   gcloud secrets versions list fcm-vapid-private-key --project=bantayog-alert-staging
   ```

   Expected: At least one version listed (e.g., `1`)

2. Check environment variable:
   - Open Firebase Console → Hosting → Config
   - Verify `VITE_FCM_VAPID_PUBLIC_KEY` is set

**If missing, follow VAPID rotation runbook:**

```bash
# 1. Generate VAPID keys
npx web-push generate-vapid-keys

# 2. Store private key in Secret Manager
gcloud secrets create fcm-vapid-private-key \
  --project=bantayog-alert-staging \
  --data-file=<(echo "YOUR_PRIVATE_KEY_HERE")

# 3. Grant access to functions service account
PROJECT_ID="bantayog-alert-staging"
SA_EMAIL="${PROJECT_ID}@appspot.gserviceaccount.com"

gcloud secrets add-iam-policy-binding fcm-vapid-private-key \
  --project=$PROJECT_ID \
  --role="roles/secretmanager.secretAccessor" \
  --member="serviceAccount:$SA_EMAIL"

# 4. Update environment variables (see docs/runbooks/fcm-vapid-rotation.md)
```

---

## ✓ Verification Checklist

Run this checklist before starting Phase 3c implementation:

- [ ] `citizen-test-01` auth account exists
- [ ] `daet-admin-test-01` exists with valid claims (role, muni, active)
- [ ] `bfp-responder-test-01` exists with valid claims
- [ ] `responders/bfp-responder-test-01` document exists (isActive: true, fcmTokens: [])
- [ ] `system_config/features/dispatch_mirror_enabled` is `true`
- [ ] `fcm-vapid-private-key` secret exists in Secret Manager (staging)
- [ ] `VITE_FCM_VAPID_PUBLIC_KEY` environment variable is set

**All boxes checked?** → Proceed with Phase 3c implementation  
**Any box unchecked?** → Complete setup step before proceeding

---

## 🚨 Blockers

If any of these are missing, Phase 3c implementation **CANNOT PROCEED**:

1. ❌ Missing test accounts → Run bootstrap scripts
2. ❌ Feature flag missing → Create `system_config/features` document
3. ❌ VAPID secrets missing → Follow VAPID rotation runbook (critical for FCM)

---

## 📋 Post-Verification Actions

Once all preconditions are verified:

1. **Run acceptance test** (verifies 3b still works):

   ```bash
   firebase emulators:exec --only firestore "pnpm exec tsx scripts/phase-3b/acceptance.ts"
   ```

2. **Create tracking issue** for Phase 3c implementation tasks

3. **Begin Phase 3c implementation** following plan:
   - `docs/superpowers/plans/2026-04-18-phase-3c-responder-loop-e2e.md`

---

**Verification Script:** `scripts/phase-3c/verify-preconditions.ts` (automates staging checks when run with `--env=staging`)

---

**Last Updated:** 2026-04-19  
**Status:** Manual verification required before 3c implementation
