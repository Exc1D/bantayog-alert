# Surge Pre-warm Runbook

**Trigger:** TCWS signal level 2 or higher is declared in the System Health page.

**Purpose:** Raise `minInstances` on 4 hot-path Cloud Functions from 3 → 20 to eliminate cold-start latency during surge. Without pre-warm, the first 17 concurrent requests to each function after a cold period take 3-8 seconds for container startup.

**Target functions:**

- `processInboxItem`
- `acceptDispatch`
- `dispatchResponder`
- `projectResponderLocations`

---

## Option A: Terraform (preferred — IaC-tracked)

Only available if these functions are configured in Terraform. Check `infra/terraform/main.tf`.

1. Open `infra/terraform/variables.tf` and confirm `surge_min_instances` exists.
2. Run:
   ```bash
   cd infra/terraform
   terraform apply -var="surge_min_instances=20"
   ```
3. Verify in Firebase Console → Functions → each target function shows `Min instances: 20`.
4. Estimated apply time: ~3 min.

## Option B: Firebase Console (manual fallback)

Use this if functions are not managed by Terraform.

1. Go to Firebase Console → Functions.
2. For each of the 4 target functions:
   - Click the function name → Edit → Scroll to "Min instances" → Set to `20` → Save.
3. Estimated time: ~5 min per function.

---

## Revert

**When to revert:** When signal drops below level 2, **or** if signal stays elevated, revert after 6 hours — whichever comes first.

**Option A — Terraform:**

```bash
cd infra/terraform
terraform apply -var="surge_min_instances=3"
```

**Option B — Firebase Console:** Set Min instances back to `3` on each of the 4 target functions.

---

## Automation gap

This runbook is human-executed. There is no automated trigger. If the team adopts PagerDuty or OpsGenie before Phase 9 exit, migrate this runbook there before the pilot launches (tracked in `docs/progress.md`).

---

## Drill procedure (required before Phase 8A exit)

1. Declare a test TCWS signal on System Health page.
2. Execute apply (Option A or B above) — verify `minInstances: 20` in Firebase Console.
3. Execute revert — verify `minInstances: 3` in Firebase Console.
4. Record drill date in `docs/progress.md`.
