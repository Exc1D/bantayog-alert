# 2F-01 — Staging Firebase Console Fixes (HUMAN)

**Goal:** Clear the two open console blockers so staging auth and App Check
work for the callable lifecycle proof and app logins.

**Owner:** Human (requires Firebase Console access). Agents cannot do this.

## Steps

1. Firebase Console → `bantayog-alert-staging` → Authentication → Sign-in
   method: enable the providers the apps use (Email/Password at minimum;
   Phone if citizen OTP login is required for the pilot).
2. Firebase Console → App Check → Apps: confirm each registered web app has
   the correct reCAPTCHA v3 site key, and that the key's domain list includes
   the staging Hosting domains. The App Check 400s on staging are most likely
   a site-key/domain mismatch (see `docs/learnings.md` App Check entries).
3. Firebase Console → App Check → Apps → (web app) → Manage debug tokens:
   create a debug token named `staging-callable-proof` and store its value
   locally as `STAGING_APP_CHECK_DEBUG_TOKEN` (never commit it).
4. Fetch the staging web SDK config to fill local `.env.staging` files:
   `firebase apps:sdkconfig web --project bantayog-alert-staging`.
   Export `STAGING_FIREBASE_API_KEY` and `STAGING_FIREBASE_APP_ID` for the
   proof scripts.

## Out of scope

- Any production project change.
- Disabling App Check enforcement (`ENFORCE_APP_CHECK`) to work around 400s.

## Verification

- `pnpm staging:e2e-proof` still passes (deployment health check).
- 2F-03 lifecycle proof can exchange the debug token for an App Check token
  (its first step fails loudly if this slice is incomplete).

## Done evidence

- Debug token registered; `STAGING_*` env vars available locally; App Check
  no longer returns 400 for a staging web app load.
