# Bantayog Alert — Track 3 Cutover Procedure

**Target:** bantayog-prod goes live for the Daet pilot  
**Required participants:**

- Engineer (Exxeed) — technical lead
- PDRRMO coordinator — available for signoff
- BFP pilot responder — available for Step 6 field drill

---

## Pre-Session Checklist (complete day before)

- [ ] All Track 2 exit gates confirmed green
- [ ] BFP pilot responder scheduled and briefed on drill scenario
- [ ] PDRRMO Director confirmed available for Step 7 signoff
- [ ] Globe Labs keyword confirmation received. Date: \_\_\_
- [ ] Pilot-launch statement: pre-approved template printed and ready to sign
- [ ] Rollback commands tested in staging (git checkout v1.0.0-pilot, firebase hosting rollback)
- [ ] pilot-staff-manifest.csv prepared with 3+ MDRRMO + 10+ BFP accounts
- [ ] DNS propagation initiated — Firebase custom domain configured ≥24h before Track 3 day

---

## Step 1 — Apply monitoring module to prod

Add to `infra/terraform/main.tf`:

```hcl
module "monitoring" {
  source                  = "./modules/monitoring/prod"
  project_id              = var.project_id
  oncall_backend_email    = "davidaviado.dla@gmail.com"
  oncall_ops_email        = "davidaviado.dla@gmail.com"
  oncall_compliance_email = "davidaviado.dla@gmail.com"
}
```

```
cd infra/terraform
terraform plan -var-file=envs/prod/terraform.tfvars    # review
terraform apply -var-file=envs/prod/terraform.tfvars   # explicit user approval required
```

**Exit gate — confirm notification channel reachable:**

```
terraform output
gcloud alpha monitoring policies test \
  --notification-channels=<backend_channel_id>
```

Confirm on-call email receives the test notification.
Policy existence alone is not sufficient — a misconfigured channel is invisible until 2 AM.

Rollback: remove monitoring module from main.tf, re-apply. ~10 min.

---

## Step 2 — Prod degraded-mode runbook fidelity check

10-minute tabletop against live prod. Read each scenario in docs/runbooks/degraded-mode.md.
Verify every URL, credential, rollback command against prod (read-only steps — do not trigger).

This is staging→prod fidelity confirmation. Track 2 tabletop found gaps; this step only
confirms prod matches staging. If new gaps are found, halt and fix before proceeding.

---

## Step 3 — Provision pilot staff accounts

Prepare pilot-staff-manifest.csv before Track 3 day with real staff data.

```
npx tsx scripts/provision-pilot-staff.ts \
  --project bantayog-alert \
  --input scripts/pilot-staff-manifest.csv
```

Review per-account status table. Halt on any failure — fix and re-run (idempotent).
Commit the status table (without email addresses) to docs/pilot-staff-provisioning-log.md.

Rollback: set accountStatus='suspended' on all provisioned accounts via Admin SDK.

---

## Step 4 — Confirm public URL is live

```
curl -I https://bantayog.camarines-norte.gov.ph
```

Expected: HTTP 200, Firebase Hosting headers.
If DNS is not propagated, halt. Do not proceed until URL is confirmed live.

Open in fresh browser (no cache). Confirm:

- Citizen PWA loads
- Privacy notice modal renders bilingually
- Version gate does NOT block (1.0.0 >= 1.0.0)

Rollback: `firebase hosting:channel:rollback live --project bantayog-alert`

---

## Step 5 — Activate Globe Labs SMS keyword

Send one test SMS from a non-staff number: `BANTAYOG TEST`

Confirm:

- Message appears in prod sms_inbox collection
- Auto-reply is received on the test device

This is the operational point of no return for SMS.

If Globe Labs confirmation was not received: halt here. Proceed through Steps 6 and 7,
note SMS deferral in pilot-launch statement signature block.

Rollback: deactivate keyword via Globe Labs portal. Treat as irreversible within the session.

---

## Step 6 — BFP field drill: first report to resolved

BFP responder acts as both citizen-reporter and dispatched responder.

Scenario: Responder submits test flood report via citizen PWA → MDRRMO admin verifies and
dispatches → Responder accepts via responder app → Responder marks resolved → Admin closes.

Record timestamps:
| Event | Timestamp | Elapsed |
|-------|-----------|---------|
| Citizen submit | | |
| Admin visible | | |
| Admin dispatches | | |
| FCM delivered to responder | | |
| Responder accepts | | |
| Responder marks resolved | | |
| Admin closes | | |

The 30-day operational clock starts when this report reaches 'resolved' in prod Firestore.
Clock start time: **\*\*\*\***\_\_\_**\*\*\*\***

---

## Step 7 — PDRRMO Director signoff

Director reviews in admin dashboard:

- Resolved test report visible
- Staff accounts listed in User Management page
- System Health page (/system_health) shows green indicators
- Monitoring alerts active in Cloud Monitoring console (show browser)

Director signs the pre-approved pilot-launch statement.
Scan → `docs/pilot-launch-statement-signed.pdf` → commit.

This is the legal and operational point of no return.

---

## Post-Launch Commit

```
git add infra/terraform/main.tf
git commit -m "chore(track3): wire monitoring module to prod, cutover complete"

git tag v1.0.0-pilot-live
git push origin v1.0.0-pilot-live
```

Update docs/progress.md:

- Mark Phase 9 COMPLETE
- Record: 30-day pilot clock start date/time
- Record: BFP drill SLO baseline measurements

---

## Track 3 Exit Gate

- [ ] Monitoring alerts active; on-call email confirmed reachable via test notification
- [ ] Runbook fidelity check passed; no new gaps found
- [ ] All pilot staff accounts provisioned; status log committed
- [ ] Public URL live; privacy notice renders correctly in fresh browser
- [ ] SMS keyword active (or deferral noted in pilot-launch statement)
- [ ] First report confirmed resolved in prod; SLO baseline measurements recorded
- [ ] PDRRMO Director signature obtained; signed PDF filed at docs/pilot-launch-statement-signed.pdf
- [ ] 30-day clock start time recorded in docs/progress.md
- [ ] v1.0.0-pilot-live tag pushed
