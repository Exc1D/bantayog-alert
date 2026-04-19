# FCM VAPID Key Rotation Runbook

**Purpose:** Rotate Firebase Cloud Messaging (FCM) VAPID keys for web push notifications.

**VAPID Key Pair:**

- **Public Key:** Exposed as `VITE_FCM_VAPID_PUBLIC_KEY` environment variable
- **Private Key:** Stored in Google Secret Manager as `fcm-vapid-private-key`
- **Purpose:** Enables web push notifications for responder PWA

---

## When to Rotate

Rotate VAPID keys when:

- Keys are compromised or exposed
- Annual security rotation (recommended)
- Migrating to new FCM infrastructure

---

## Prerequisites

1. **Firebase Project:** `bantayog-alert-staging` or `bantayog-alert-prod`
2. **Google Cloud SDK:** `gcloud` CLI installed and authenticated
3. **Project Access:** Owner or Secret Manager Admin role

---

## Step 1: Generate New VAPID Key Pair

```bash
# Using web-push library (Node.js)
npx web-push generate-vapid-keys

# Output example:
# VAPID public key: BCxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# VAPID private key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Save both keys securely.** The private key is sensitive and must never be committed to git.

---

## Step 2: Store Private Key in Secret Manager

```bash
# For staging
gcloud secrets create fcm-vapid-private-key \
  --project=bantayog-alert-staging \
  --data-file=<(echo "YOUR_PRIVATE_KEY_HERE") \
  --labels=env=staging,purpose=fcm-vapid

# For production
gcloud secrets create fcm-vapid-private-key \
  --project=bantayog-alert-prod \
  --data-file=<(echo "YOUR_PRIVATE_KEY_HERE") \
  --labels=env=prod,purpose=fcm-vapid
```

**If secret already exists (rotation):**

```bash
# Add new version
gcloud secrets versions add fcm-vapid-private-key \
  --project=bantayog-alert-staging \
  --data-file=<(echo "YOUR_NEW_PRIVATE_KEY_HERE")

# Set as latest (automatic)
# Optionally disable old version after verification
gcloud secrets versions disable VERSION_ID \
  --project=bantayog-alert-staging \
  --secret=fcm-vapid-private-key
```

---

## Step 3: Grant Access to Cloud Functions Service Account

```bash
# Get the default Compute Service Account for the project
PROJECT_ID="bantayog-alert-staging"
SA_EMAIL="${PROJECT_ID}@appspot.gserviceaccount.com"

# Grant Secret Manager Viewer access
gcloud secrets add-iam-policy-binding fcm-vapid-private-key \
  --project=$PROJECT_ID \
  --role="roles/secretmanager.secretAccessor" \
  --member="serviceAccount:$SA_EMAIL"
```

---

## Step 4: Update Environment Variables

### For Development (.env.local)

```bash
# .env.local (never commit)
VITE_FCM_VAPID_PUBLIC_KEY=BCxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### For Staging/Production (Firebase Hosting config)

Update `firebase.json` or hosting config:

```json
{
  "hosting": {
    "env": {
      "VITE_FCM_VAPID_PUBLIC_KEY": {
        "value": "BCxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "apply": "staging"
      }
    }
  }
}
```

Or use `firebase functions:config:set`:

```bash
firebase functions:config:set fcm.vapid_public_key="BCxxxxxxxxxxxxxxxxx" \
  --project=bantayog-alert-staging
```

---

## Step 5: Deploy Updated Configuration

```bash
# Deploy hosting config with new env vars
firebase deploy --only hosting --project=bantayog-alert-staging

# If using Cloud Functions environment
firebase deploy --only functions --project=bantayog-alert-staging
```

---

## Step 6: Verify Push Notifications Work

1. **Open responder PWA:** `https://staging.bantayog-alert.web.app`
2. **Accept notification prompt** (or enable in settings)
3. **Subscribe to FCM topics** (if applicable)
4. **Trigger test dispatch** from admin desktop
5. **Verify push notification received** on responder device

**Debug FCM issues:**

- Browser DevTools → Application → Service Workers
- Check Firebase Console → Cloud Messaging → Reports
- Verify `navigator.serviceWorker.ready` resolves

---

## Rollback Procedure

If issues occur after rotation:

1. **Revert to previous secret version:**

   ```bash
   gcloud secrets versions enable OLD_VERSION_ID \
     --project=bantayog-alert-staging \
     --secret=fcm-vapid-private-key

   gcloud secrets versions disable NEW_VERSION_ID \
     --project=bantayog-alert-staging \
     --secret=fcm-vapid-private-key
   ```

2. **Redeploy Cloud Functions** (if using config):

   ```bash
   firebase deploy --only functions --project=bantayog-alert-staging
   ```

3. **Verify notifications resume**

---

## Security Notes

- **Private keys are single-use.** Never reuse a private key across projects.
- **Public keys are safe to expose.** They're sent to browsers for subscription validation.
- **Store private keys securely.** Use Secret Manager, never commit to git.
- **Rotate regularly.** Annual rotation is recommended for security hygiene.
- **Monitor access.** Use Cloud Audit Logs to track who accesses secrets.

---

## References

- [Firebase Web Push](https://firebase.google.com/docs/cloud-messaging/js/client)
- [VAPID Keys Specification](https://datatracker.ietf.org/doc/html/rfc8292)
- [Secret Manager Access Control](https://cloud.google.com/secret-manager/docs/access-control)

---

**Last Updated:** 2026-04-19
**Status:** Template — Requires execution before Phase 3c deployment
