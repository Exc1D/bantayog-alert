# Bantayog Alert Security Hardening - 2026-05-26

## Scope

This pass focused on abuse resistance and DDoS readiness for the Firebase/Cloud Functions surface. It did not edit Firebase rules, Terraform, environment variables, secrets, or deploy configuration.

## Current Controls Found

- Callable functions generally enforce App Check through `shouldEnforceAppCheck()`.
- Callable functions set `maxInstances`, limiting runaway function scale and cost.
- High-risk citizen paths such as report submission, lookup, upload URL requests, and alert declaration already use explicit rate limits.
- Firebase Hosting headers include CSP/security headers from the prior security audit.
- Firestore, RTDB, and Storage rules have emulator-backed tests.

## Gaps Found

- Several callable files still do not call `checkRateLimit`; some are admin-only, but subscription and account/privacy paths are still abuse surfaces.
- Root Terraform does not wire a Cloud Armor/load-balancer DDoS boundary for HTTP traffic.
- Root Terraform does not currently wire the monitoring modules found under `infra/terraform/modules/monitoring`.
- Budget alerts and quota-near-limit alerting were not found in Terraform.
- App Check replay protection is not enabled for the most sensitive callables.

## Code Hardening Applied

- `subscribeToAlertsCore` now applies a per-user limit of 20 subscription attempts per 60 seconds before token ownership and FCM calls.
- `unsubscribeFromAlertsCore` now applies a per-user limit of 20 unsubscribe attempts per 60 seconds before token ownership and FCM calls.
- The alert subscription callable wrappers now preserve `HttpsError` codes instead of converting rate-limit or permission errors to `internal`.
- Added regression tests proving exhausted quota returns `resource-exhausted` and does not call FCM.
- `requestLookup` now logs unexpected backend errors server-side and returns a generic `internal` message to clients, preventing anonymous callers from seeing backend/index/project details.
- `requestUploadUrl` now logs unexpected storage signing errors server-side and returns a generic `internal` message to clients, preventing authenticated users from seeing service-account or storage internals.

## Zero-Day Follow-Up - 2026-05-26

The fresh scan found a directly exploitable information-disclosure pattern: callable wrappers must never return raw unexpected exception messages. `requestLookup` was patched first because public report lookup is reachable by unauthenticated users with a reference and secret; `requestUploadUrl` was patched next because signed URL failures can expose storage or service-account internals to authenticated users.

Remaining high-value hardening that needs a separate rollout:

1. Enable App Check replay protection only after adding client `limitedUseAppCheckTokens: true` and the required `Firebase App Check Token Verifier` IAM role.
2. Add a lint-style regression test or grep gate for `new HttpsError('internal', err.message)`.

## Terraform Proposal - Approval Required Before Editing Config

Deployment configuration changes must be reviewed as a full diff before they are applied. The next safe Terraform slice is:

1. Add root variables for `oncall_backend_email`, `oncall_ops_email`, and `oncall_compliance_email`.
2. Wire `infra/terraform/modules/monitoring/prod` from root `main.tf` only when `env` is `staging` or `prod`.
3. Add root outputs for the monitoring notification channel IDs.
4. Add environment tfvars values for staging first, using non-production test aliases until real on-call emails are confirmed.
5. Run `terraform fmt -check`, then `terraform plan` against staging after billing and project numbers are fixed.

Do not add Cloud Armor resources until the public HTTP/load-balancer boundary is explicitly designed. Firebase callable endpoints are not automatically protected by adding a standalone security policy; Cloud Armor needs an eligible backend behind an external Application Load Balancer.

## Recommended DDoS Plan

1. Put externally reachable HTTP surfaces that can sit behind a load balancer behind Cloud Armor.
2. Enable Cloud Armor Adaptive Protection for L7 HTTP flood detection and alerting.
3. Add explicit rate-limit rules for expensive endpoints and suspicious paths.
4. Wire monitoring modules into root Terraform for staging first, then production after soak.
5. Add budget alerts and quota-near-limit alerting for Firestore, Functions, Storage, Hosting, and FCM.
6. Enable App Check replay protection on the most sensitive callable paths after client SDK support is confirmed.
7. Keep callable `maxInstances` tuned to normal traffic plus disaster surge capacity, not theoretical peak attack traffic.
8. Add an incident runbook with rollback commands, traffic triage steps, and escalation contacts.

## Sources

- Firebase security checklist: https://firebase.google.com/support/guides/security-checklist
- Firebase App Check for Cloud Functions: https://firebase.google.com/docs/app-check/cloud-functions
- Google Cloud Armor Adaptive Protection: https://docs.cloud.google.com/armor/docs/adaptive-protection-overview
