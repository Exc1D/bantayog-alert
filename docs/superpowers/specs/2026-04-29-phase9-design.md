# Phase 9 — Pilot-Deployable Milestone: Design Spec

**Date:** 2026-04-29
**Status:** Approved — ready for implementation planning
**Author:** Brainstorming session (Exxeed + Claude)
**Companion:** Implementation Plan v1.0 §Phase 9, Arch Spec v8.0 §13

---

## 1. Scope Decision

Phase 9 launches the Daet pilot with **web PWA + staff-registered SMS only**. Anonymous feature-phone SMS onboarding is deferred until the pseudonymous erasure linkage mechanism (RA 10173 §16 blocker from Phase 8C) is resolved. The pilot-launch statement explicitly documents this limitation. This is not a degraded launch — the web PWA covers the majority of digitally-connected Daet citizens; SMS anonymous onboarding is a follow-on scope item.

---

## 2. Structure: Three Sequential Tracks

Each track has a hard exit gate. Track N+1 does not begin until Track N's exit gate is fully green.

```
Track 1 — Prod Infra Bootstrap     (~2 days)
Track 2 — Build & Harden           (~1 week, staging-parity gated)
Track 3 — Cutover & Go-Live        (1 planned session)
```

**Staging parity rule (applies to Track 2):** Every artifact built in Track 2 must pass an end-to-end staging run before it is considered complete. Nothing goes to prod that has not been validated in staging.

---

## 3. Track 1 — Prod Infra Bootstrap

**Goal:** `bantayog-prod` is provisioned and functional. No public URL. No monitoring alerts. Staff-only access. All prod-specific infrastructure surprises are surfaced here, not on cutover day.

### Step 1 — Resolve prod placeholder

`infra/terraform/envs/prod/terraform.tfvars` has a `REPLACE_WITH_PROJECT_NUMBER_AT_BOOTSTRAP` value. Retrieve and commit before any Terraform command:

```bash
gcloud projects describe bantayog-alert --format="value(projectNumber)"
# Edit terraform.tfvars, commit to git
```

### Step 2 — State bucket bootstrap

The prod state bucket must be created manually before Terraform can initialize:

```bash
gsutil mb -l asia-southeast1 gs://bantayog-tf-state-prod
gsutil versioning set on gs://bantayog-tf-state-prod
```

### Step 3 — Secrets pre-flight

New script: `scripts/check-prod-secrets.ts` (Track 1 deliverable). Reads a manifest of required secret names from Secret Manager and exits non-zero for any missing or empty secret. **Do not proceed to Terraform apply if any secret is missing.**

Required secrets:

```
SEMAPHORE_API_KEY
GLOBE_LABS_APP_ID
GLOBE_LABS_APP_SECRET
GLOBE_LABS_SHORT_CODE
FIREBASE_WEB_API_KEY
BREAK_GLASS_CODE_A
BREAK_GLASS_CODE_B
```

Missing secrets indicate either the Terraform secrets module did not run or credentials were never populated. Both are blockers that must be resolved before infrastructure provisioning.

### Step 4 — Terraform init + plan + apply

The Terraform apply for prod includes a **new `bigquery` module** (alongside existing modules) that provisions:

- `bantayog_audit` dataset
- `streaming_events` table (schema derived from `functions/src/services/audit-stream.ts`)
- `batch_events` table (schema derived from `functions/src/triggers/audit-export-batch.ts`)

**BigQuery schema process constraint:** These schemas are derived from TypeScript interfaces, not auto-generated. Any field addition to `audit-stream.ts` or the batch export function requires a coordinated Terraform schema update before deploy. There is no automatic pickup — schema drift will cause silent insert failures on the new field.

The monitoring module is **not included** in this apply. It is written in Track 2 and applied in Track 3 Step 1.

```bash
cd infra/terraform
terraform init -backend-config=envs/prod/backend.hcl
terraform plan -var-file=envs/prod/terraform.tfvars   # review output in full
# STOP — explicit user approval required before apply (§8.4 risky-change protocol)
terraform apply -var-file=envs/prod/terraform.tfvars
```

### Step 5 — IAM role verification

Immediately after `terraform apply`, verify service account roles:

```bash
gcloud projects get-iam-policy bantayog-alert \
  --flatten="bindings[].members" \
  --filter="bindings.members:bantayog-functions@bantayog-alert.iam.gserviceaccount.com OR bindings.members:bantayog-ci-deploy@bantayog-alert.iam.gserviceaccount.com" \
  --format="table(bindings.role,bindings.members)"
```

`bantayog-functions` must have all of:

- `roles/datastore.user`
- `roles/bigquery.dataEditor`
- `roles/secretmanager.secretAccessor`
- `roles/firebase.sdkAdminServiceAgent`
- `roles/storage.objectCreator`
- `roles/pubsub.publisher`

Any missing role is fixed in Terraform and re-applied. Do not paper over with manual IAM grants — the Terraform state must be authoritative.

### Step 6 — Tag the release and Firebase CLI deploy

Tag before deploy so the deployed artifact is fully traceable:

```bash
git tag v1.0.0-pilot
git push origin v1.0.0-pilot
```

**Tag convention:** `v1.0.0-pilot` scopes this as the pilot milestone. `v1.0.0` (no suffix) is reserved for the post-Phase-12 production-expansion release. All Firebase CLI prod deploys reference a tag, never an untagged commit.

**Firebase CLI target syntax must be verified against staging first.** Run the exact command against `bantayog-staging` and confirm each target appears in the CLI output (a wrong target silently skips — check explicitly):

```bash
firebase deploy --project bantayog-staging \
  --only "firestore:rules,firestore:indexes,database,storage,functions,hosting"
```

Once confirmed, run against prod:

```bash
firebase deploy --project bantayog-alert \
  --only "firestore:rules,firestore:indexes,database,storage,functions,hosting"
```

No public domain yet. Firebase default hosting URL exists but is not published externally.

### Step 7 — system_config seed + smoke test

Seed `system_config` and update URLs:

```bash
npx ts-node functions/scripts/bootstrap-phase1.ts --project prod
```

The seed script must also write `system_config/update_urls` with per-surface upgrade destinations:

```ts
system_config/update_urls: {
  citizen:   "https://bantayog.camarines-norte.gov.ph",
  responder: "https://testflight.apple.com/join/<token>",  // iOS; Android MDM URL
  admin:     "https://admin.bantayog.camarines-norte.gov.ph"
}
```

Then run the smoke test script (new Track 1 deliverable: `scripts/smoke-test-prod.ts`):

- Firestore read/write succeeds (Admin SDK)
- RTDB read/write succeeds
- Storage bucket accessible
- At least one Cloud Function invocable (`setStaffClaims` with a test UID, then delete)
- `system_config/min_app_version` doc present and readable
- `system_config/update_urls` doc present and readable
- `bantayog_audit.streaming_events` table exists and accepts a test insert (row deleted after)

Script exits non-zero on any failure. Do not proceed to Step 8 if smoke test fails.

### Step 8 — Break-glass seed

Sequenced after smoke test — do not write security-critical config to a broken environment:

```bash
npx ts-node scripts/seed-break-glass-config.ts --project prod
```

Confirm seeded:

```bash
gcloud firestore documents get \
  projects/bantayog-alert/databases/\(default\)/documents/system_config/break_glass_config
```

### Track 1 Exit Gate

All must be green before Track 2 begins:

- [ ] Secrets pre-flight: all required secrets confirmed present
- [ ] `terraform apply` completed with no errors; state in GCS
- [ ] IAM roles confirmed for `bantayog-functions` and `bantayog-ci-deploy` (all 6 roles)
- [ ] Firebase CLI deploy confirmed each target processed (not silently skipped)
- [ ] Smoke test exits 0 (including BigQuery insert check)
- [ ] `system_config/update_urls` confirmed readable
- [ ] Break-glass config confirmed seeded

---

## 4. Track 2 — Build & Harden

**Goal:** All new code and documents needed for go-live are built, staging-validated, and ready to apply to prod. The monitoring module is written here but applied in Track 3.

**Dependency order (each item unblocks the next):**

### Item 1 — `min_app_version` enforcement

Each surface reads `system_config/min_app_version` on app start, before any auth or Firestore read. If `appVersion < minVersion[surface]`, render a full-screen upgrade gate — no bypass, no timer.

The gate displays the destination URL from `system_config/update_urls[surface]`. Static fallback URLs are hardcoded per surface in case `system_config/update_urls` is missing (defensive; avoids a blank gate on first boot).

Three `min_app_version` fields (`citizen`, `responder`, `admin`) are set to `"1.0.0"` in the Track 1 seed. The enforcement logic must be present and verified in all three apps before staff provisioning — staff should not be able to log in on a pre-1.0.0 build without the gate triggering.

**Staging exit gate:** Set `citizen: "99.0.0"` in staging `system_config`, reload citizen PWA, confirm full-screen gate renders with correct upgrade URL. Reset after test. Repeat for responder and admin surfaces.

### Item 2 — Staff provisioning scripts

New script: `scripts/provision-pilot-staff.ts`. Idempotent — safe to re-run. Takes a CSV input `scripts/pilot-staff-manifest.csv` with columns `{email, role, municipalityId, agencyId}`.

Per row:

1. Create Firebase Auth account if it doesn't exist
2. Call `setStaffClaims` with role and jurisdiction
3. Set `accountStatus: 'active'` in `active_accounts/{uid}`
4. Send password-reset email (staff sets own credential)

Outputs a per-account status table. Exits non-zero on any failure.

TOTP enrollment is staff-initiated on first login via `/totp-enroll`. The script provisions accounts; humans complete enrollment. Run `scripts/check-staff-totp-enrollment.ts` after Track 3 Step 3 to audit completion rate (logged, not a gate).

**Staging exit gate:** Provision three synthetic MDRRMO and two BFP accounts in staging. Confirm claims correct via Firebase Auth Explorer. Confirm password-reset email delivered. Re-run script; confirm idempotent (no duplicate accounts, no errors).

### Item 3 — Monitoring Terraform module

New module: `infra/terraform/modules/monitoring/prod/`. Covers every signal in Arch Spec §13.7. Structure:

- Cloud Monitoring alert policies (one per signal)
- Notification channels per owner category: backend on-call, ops on-call, compliance, finance
- Log-based metrics for signals not natively available (dead-letter growth rate, audit gap, etc.)
- A `test_alert_trigger` custom metric policy used only for staging validation (disabled in prod after validation)

**This module is written and reviewed in Track 2 but not applied to prod until Track 3 Step 1.** Applying it to prod before go-live would generate zero-load false positives against operators who are not yet on-call.

**Staging exit gate:** Apply module to staging. Run `scripts/trigger-test-alert.ts` (new script) which writes a synthetic data point via Cloud Monitoring API above one policy's threshold — no real function invoked, no staging traffic affected. Confirm on-call email receives notification. Clean up by writing a point below threshold.

```ts
// scripts/trigger-test-alert.ts — pseudocode
await monitoring.createTimeSeries({
  name: `projects/${stagingProjectId}`,
  timeSeries: [
    {
      metric: { type: 'custom.googleapis.com/bantayog/test_alert_trigger' },
      points: [{ interval: { endTime: now }, value: { int64Value: THRESHOLD + 1 } }],
    },
  ],
})
```

### Item 4 — Privacy notices

Two components. Both bilingual: Tagalog and English in the same notice (no locale detection).

**Citizen PWA:** Full-screen modal shown before the submission form on first use. Dismissed to `localStorage` key `bantayog_privacy_v1`. Anonymous/pseudonymous users: no backend write. Registered users: `privacyNoticeVersion: "1.0"` written to `users/{uid}` as a direct Firestore write on dismissal.

**Responder app:** Modal shown before the dispatch queue on first login. `privacyNoticeVersion: "1.0"` written to `users/{uid}`. Responders are always registered.

**Admin desktop:** Same pattern as responder.

**Version migration policy (pilot):** No migration path. Bumping `privacyNoticeVersion` to `"1.1"` triggers a re-prompt only for users on a new device or cleared `localStorage`. Returning users who dismissed `"1.0"` will not see `"1.1"` without clearing state. Acceptable for pilot. Active re-consent on version bump is a v2 backlog item.

No SMS auto-reply privacy notice update in Track 2 — anonymous SMS onboarding is deferred.

**Staging exit gate:** Clear `localStorage`, open citizen PWA, confirm modal renders in both languages, dismiss, confirm no re-render on reload. Confirm `users/{uid}.privacyNoticeVersion` written for a registered test user. Repeat for responder and admin.

### Item 5 — Pilot-launch statement template

New document: `docs/pilot-launch-statement-template.md`. Drafted in Track 2, reviewed with PDRRMO Director before Track 3. Sections:

- Platform name and version (`Bantayog Alert v1.0.0-pilot`)
- Pilot scope: municipality (Daet), agencies (Daet MDRRMO, BFP Daet), start date
- SMS scope at launch: web PWA + staff-registered SMS. Anonymous feature-phone SMS deferred pending RA 10173 §16 erasure resolution.
- SLOs committed to: reference Arch Spec §13.2 table verbatim
- Named pilot coordinator: PDRRMO Director (full name, position)
- Named technical responsible: Exxeed (solo developer)
- Acknowledgment that 30-day operational clock starts on signature date
- Signature block and date fields

The PDRRMO Director must have read and pre-approved the template content before Track 3 day. Track 3 Step 7 is execution of a pre-agreed document, not a first reading.

### Item 6 — Degraded-mode runbook

New document: `docs/runbooks/degraded-mode.md`. Four failure scenarios:

**Scenario 1 — Firebase hosting down:**
Detection: citizen PWA unreachable. Action: post SMS instructions to barangay announcement channels (`BANTAYOG <type> <barangay>`). Admins notified via FCM + direct SMS. Recovery: Firebase hosting self-heals; no data loss.

**Scenario 2 — Functions unavailable:**
Detection: report intake stops; Cloud Functions error rate alert fires. Action: declare manual operations mode (`system_config/manual_ops_mode: true`). Citizens see offline UI. Admins use paper intake forms and log incidents manually. Recovery: Functions redeploy from `v1.0.0-pilot` tag.

**Scenario 3 — SMS provider both down:**
Detection: SMS delivery success rate below threshold on both Semaphore and Globe Labs. Action: publish PDRRMO direct phone hotline number via all available channels. Recovery: circuit-breaker auto-restores on provider recovery; delivery queue replays via `reconcileSmsDeliveryStatus`.

**Scenario 4 — RTDB unavailable:**
Detection: stale telemetry rate alert fires (>20% of dispatched responders). Action: notify all active admins that the responder map is stale; instruct responders to verbally relay position via radio/phone. Firestore-based workflows (dispatch, verify, resolve, field notes) continue normally — this is a partial outage, not a full stop. Recovery: RTDB self-heals; telemetry is ephemeral, no replay needed.

Each scenario documents: detection signal, first-responder action, escalation path, recovery verification step.

**Staging exit gate (Track 2):** 10-minute tabletop — read each scenario against the live staging system. Verify every URL resolves, every credential reference exists in Secret Manager, every contact number is reachable, every rollback command is valid (read-only steps only). This is a discovery exercise — finding gaps is the point.

### Item 7 — Restore drill

Execute the quarterly full-stack restore drill in staging, targeting ≤4h RTO (Arch Spec §13.2).

Procedure:

1. Export staging Firestore to Cloud Storage (snapshot)
2. Wipe staging Firestore collections (simulate data loss)
3. Restore from export
4. Re-deploy rules, indexes, functions, hosting from `v1.0.0-pilot` tag
5. Re-seed `system_config` and break-glass config
6. Run `scripts/smoke-test-prod.ts` against staging
7. Confirm `bantayog_audit.streaming_events` is receiving writes post-restore

Clock starts at step 1. Stops when smoke test exits 0. Must complete in ≤4h.

Document result in `docs/runbooks/restore-drill-log.md` with: start time, stop time, elapsed time, issues found, resolution for each issue.

**Exit gate:** Elapsed ≤4h, smoke test exits 0, drill log committed to git.

### Globe Labs SMS keyword pre-registration

**Initiate during Track 2 tail** — not Track 3 day. Process must be clarified before Track 2 starts:

- If activation is via Globe Labs API call: schedule 24h before Track 3
- If activation requires a support ticket: submit no later than 5 business days before Track 3 day (treat 48h lead time as optimistic)

Pre-session checklist hard gate:

```
BANTAYOG keyword pre-registration submitted: date ___
Globe Labs confirmation received: date ___
```

If confirmation is not received by Track 3 start: **halt at Step 5**. Proceed through Steps 1–4. Do not sign the pilot-launch statement until SMS keyword is confirmed live (or explicitly note the deferral in the statement).

### Track 2 Exit Gate

All must be green before Track 3 begins:

- [ ] `min_app_version` enforcement staging-validated on all three surfaces
- [ ] Staff provisioning script staging-validated (idempotent, correct claims, password-reset email delivered)
- [ ] Monitoring Terraform module written, reviewed, staging-applied, and one alert confirmed firing via synthetic metric
- [ ] Privacy notices staging-validated (render, dismiss, persist `privacyNoticeVersion`) on all three surfaces
- [ ] Pilot-launch statement template drafted and pre-approved by PDRRMO Director
- [ ] Degraded-mode runbook staging tabletop passed with all details verified
- [ ] Restore drill completed in staging within ≤4h RTO, drill log committed
- [ ] Globe Labs keyword activation status confirmed (submitted + received, or explicit hold)

---

## 5. Track 3 — Cutover & Go-Live

**Goal:** `bantayog-prod` goes live for the Daet pilot. Single planned session with named participants.

**Named participants required:**

- Engineer (Exxeed)
- PDRRMO coordinator (available for signoff)
- One BFP pilot responder (available for Step 6 field drill)

**Pre-session checklist (day before):**

- [ ] All Track 2 exit gates confirmed green
- [ ] BFP pilot responder scheduled and briefed on drill scenario
- [ ] PDRRMO Director confirmed available for signoff
- [ ] Globe Labs keyword: confirmation received (date: \_\_\_)
- [ ] Pilot-launch statement: pre-approved template printed and ready to sign
- [ ] Rollback commands prepared and tested in staging

### Step 1 — Apply monitoring module to prod

```bash
cd infra/terraform
terraform apply -var-file=envs/prod/terraform.tfvars
# Monitoring module now included — alerts go live from this moment
```

**Exit gate:** Send a test notification via Cloud Monitoring after apply:

```bash
gcloud alpha monitoring policies test \
  --notification-channels=<channel-id>
```

Confirm on-call email address receives the test notification. Policy existence alone is insufficient — a misconfigured notification channel is invisible until it fails to fire at 2 AM.

Rollback: remove monitoring module from Terraform, re-apply. ~10 min.

### Step 2 — Prod degraded-mode runbook fidelity check

10-minute tabletop: read each scenario in `docs/runbooks/degraded-mode.md` against the live prod system. Verify every URL resolves, every credential reference exists in prod Secret Manager, every contact detail is accurate, every rollback command is valid against prod (read-only steps only — do not trigger).

This is a **staging→prod fidelity confirmation**, not a discovery exercise. The Track 2 tabletop (Item 6) found the gaps; this step only confirms prod matches staging. Expected duration: 10 minutes. If new gaps are found, halt and address before proceeding.

No rollback needed — verification only.

### Step 3 — Provision pilot staff accounts

```bash
npx ts-node scripts/provision-pilot-staff.ts \
  --project prod \
  --input scripts/pilot-staff-manifest.csv
```

`pilot-staff-manifest.csv` is prepared before Track 3 day: 3–5 MDRRMO admin accounts, 10+ BFP responder accounts. Script outputs a per-account status table. Halt on any failure — fix and re-run (idempotent).

TOTP enrollment is staff-initiated on first login. Do not gate on TOTP completion here — `check-staff-totp-enrollment.ts` is run post-launch as an audit, not a go-live blocker.

Rollback: set `accountStatus: 'suspended'` on all provisioned accounts via Admin SDK script. ~5 min.

### Step 4 — Publish citizen PWA public URL

Configure custom domain in Firebase Hosting console (`bantayog.camarines-norte.gov.ph`). SSL provisioned automatically. DNS propagation up to 24h — **initiate in Track 2 tail**, not Track 3 day. Confirm URL is live and resolves before proceeding.

Verify: open the URL in a fresh browser (no cache), confirm the citizen PWA loads and the privacy notice modal appears in both languages on first load.

Do not proceed to Step 5 until the public URL is confirmed live.

Rollback: Firebase Hosting channel rollback to previous release. ~1 min.

### Step 5 — Activate Globe Labs SMS keyword

Confirm `BANTAYOG` keyword is live on the registered webhook URL. Send one test SMS from a non-staff number:

```
BANTAYOG TEST
```

Confirm the message routes to `sms_inbox` in prod Firestore and the auto-reply is received on the test device.

**This is the operational point of no return for SMS.** Citizens who text `BANTAYOG` after this point reach the live system.

Rollback: deactivate keyword via Globe Labs (API call or support ticket). Unknown lead time — treat as effectively irreversible within the session. Do not activate until Steps 1–4 are confirmed green.

**If Globe Labs confirmation was not received:** halt here. Proceed through Step 6 (BFP drill uses web PWA only) and Step 7 noting SMS deferral in the pilot-launch statement.

### Step 6 — BFP field drill: first submission to `resolved`

A pre-briefed BFP responder completes the full citizen→admin→responder lifecycle on prod.

**Identity note:** The BFP responder acts as both citizen-reporter (submitting via the citizen PWA) and the dispatched responder (accepting and resolving the dispatch). This is intentional for drill simplicity — it tests system functionality across the full lifecycle, not realistic triage behavior (the admin knows it's a drill and will fast-track verification). A realistic independent-citizen drill (unknown reporter, full triage pressure) is Phase 11 scope, not a Phase 9 gate.

**Scenario:** Responder submits a test flood report in Daet → MDRRMO admin verifies and dispatches → Responder accepts via responder app → Responder marks resolved → Admin closes.

**Record and document:**

- Citizen submit → admin verify latency
- Verify → dispatch latency and FCM delivery time
- Dispatch → resolve wall-clock time

These measurements become the pilot baseline for Arch Spec §13.2 SLOs.

The 30-day operational clock starts when this report reaches `resolved` state in prod Firestore.

### Step 7 — PDRRMO Director signoff

PDRRMO Director reviews:

- The resolved test report visible in the admin dashboard
- Staff accounts listed in the user management page
- System Health page (`/system_health`) showing green indicators
- Monitoring alerts active in Cloud Monitoring (show console)

Signs the pre-approved pilot-launch statement. Scan and store as `docs/pilot-launch-statement-signed.pdf`.

**This is the legal and operational point of no return.** Once signed, the platform is live for real citizens and real emergencies.

### Track 3 Exit Gate

- [ ] Monitoring alerts active; at least one notification channel confirmed reachable
- [ ] Runbook fidelity check passed; no unresolved gaps found
- [ ] All pilot staff accounts provisioned; per-account status table committed to `docs/`
- [ ] Public URL live; privacy notice renders correctly in fresh browser
- [ ] SMS keyword active (or deferred with explicit note in pilot-launch statement)
- [ ] First report confirmed `resolved` in prod; baseline SLO measurements recorded
- [ ] PDRRMO Director pilot-launch statement signed, scanned, and filed
- [ ] 30-day clock start time recorded in `docs/progress.md`

---

## 6. New Artifacts Summary

| Artifact                                          | Type             | Track |
| ------------------------------------------------- | ---------------- | ----- |
| `scripts/check-prod-secrets.ts`                   | Script           | 1     |
| `scripts/smoke-test-prod.ts`                      | Script           | 1     |
| `functions/scripts/bootstrap-phase1.ts` (updated) | Code change      | 1     |
| `infra/terraform/modules/bigquery/`               | Terraform module | 1     |
| `infra/terraform/modules/monitoring/prod/`        | Terraform module | 2     |
| `scripts/trigger-test-alert.ts`                   | Script           | 2     |
| `scripts/provision-pilot-staff.ts`                | Script           | 2     |
| `scripts/pilot-staff-manifest.csv`                | Data             | 2     |
| `docs/runbooks/degraded-mode.md`                  | Runbook          | 2     |
| `docs/runbooks/restore-drill-log.md`              | Log template     | 2     |
| `docs/pilot-launch-statement-template.md`         | Document         | 2     |
| `system_config/update_urls` seed                  | Data             | 1     |
| Privacy notice components (3 surfaces)            | UI               | 2     |
| `min_app_version` enforcement (3 surfaces)        | Code             | 2     |

---

## 7. Key Constraints

- **Anonymous SMS deferred:** RA 10173 §16 erasure blocker from Phase 8C is not resolved. Web PWA + staff-registered SMS only at launch.
- **BigQuery schema drift:** Schema in `infra/terraform/modules/bigquery/` is derived from TypeScript interfaces. Any change to `audit-stream.ts` or batch export interfaces requires a coordinated Terraform update — no automatic pickup.
- **Monitoring alerts activate at Track 3 Step 1 only:** Zero-load false positives during infrastructure setup and build are avoided by design.
- **Tag discipline:** All prod Firebase CLI deploys reference `v1.0.0-pilot`. Never deploy from an untagged commit. A fix during Track 2 or 3 cuts `v1.0.1-pilot`.
- **Irreversibility order:** Steps 1–4 of Track 3 are reversible. Step 5 (SMS keyword) is operationally irreversible within a session. Step 7 (signoff) is legally irreversible.
- **Privacy notice version migration:** No migration path for pilot. Version bump triggers re-prompt only for new devices/cleared state. Active re-consent is v2 backlog.
- **BFP drill identity:** Responder acts as both reporter and dispatched responder. Tests system functionality, not realistic triage. Phase 11 covers independent-citizen drill.

---

## 8. Deferred Items (Out of Phase 9 Scope)

- Anonymous feature-phone SMS onboarding (blocked: RA 10173 §16 erasure gap)
- Phase 10: Hazard & Geoanalytics
- Phase 11: Independent-citizen field drill; 72-hour breach drill; capability contract tests; training curriculum
- Privacy notice active re-consent on version bump (v2 backlog)
