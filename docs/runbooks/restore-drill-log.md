# Bantayog Alert — Restore Drill Log

Target RTO: ≤ 4 hours (Arch Spec §13.2)

---

## Drill Entry Template

---

**Date:** **\*\*\*\***\_\_\_**\*\*\*\***  
**Conductor:** **\*\*\*\***\_\_\_**\*\*\*\***  
**Environment:** staging / prod  
**Clock start:** **\*\*\*\***\_\_\_**\*\*\*\*** (Step 1 begins)  
**Clock stop:** **\*\*\*\***\_\_\_**\*\*\*\*** (smoke test exits 0)  
**Elapsed time:** **\*\*\*\***\_\_\_**\*\*\*\***  
**RTO target met:** YES / NO

### Steps Executed

- [ ] Step 1: Export Firestore to Cloud Storage

  ```
  gcloud firestore export gs://bantayog-tf-state-staging/restore-drill-YYYYMMDD \
    --project=bantayog-alert-staging
  ```

  Completed at: **\*\*\*\***\_\_\_**\*\*\*\***

- [ ] Step 2: Wipe Firestore collections (staging only — simulate data loss)
      Use Firebase console or Admin SDK to delete all documents in:
      report_inbox, dispatches, sms_inbox, alerts, system_config
      Completed at: **\*\*\*\***\_\_\_**\*\*\*\***

- [ ] Step 3: Restore from export

  ```
  gcloud firestore import gs://bantayog-tf-state-staging/restore-drill-YYYYMMDD \
    --project=bantayog-alert-staging
  ```

  Completed at: **\*\*\*\***\_\_\_**\*\*\*\***

- [ ] Step 4: Re-deploy from v1.0.0-pilot tag

  ```
  git checkout v1.0.0-pilot
  firebase deploy --project bantayog-alert-staging \
    --only "firestore:rules,firestore:indexes,database,storage,functions,hosting"
  ```

  Completed at: **\*\*\*\***\_\_\_**\*\*\*\***

- [ ] Step 5: Re-seed system_config and break-glass config

  ```
  npx tsx functions/scripts/bootstrap-phase1.ts --project bantayog-alert-staging
  npx tsx scripts/seed-break-glass-config.ts --project bantayog-alert-staging
  ```

  Completed at: **\*\*\*\***\_\_\_**\*\*\*\***

- [ ] Step 6: Run smoke test

  ```
  npx tsx functions/scripts/smoke-test-prod.ts bantayog-alert-staging
  ```

  Exit code: **\_\_\_** Completed at: **\*\*\*\***\_\_\_**\*\*\*\***

- [ ] Step 7: Confirm BigQuery receiving writes post-restore
      Check bantayog_audit.streaming_events in BigQuery console for entries after restore time.
      Confirmed: YES / NO

### Issues Found

| #   | Step | Issue | Resolution | Time to fix |
| --- | ---- | ----- | ---------- | ----------- |

### Notes

---

---

## Drill History

| Date | Environment | Elapsed | RTO Met | Conductor |
| ---- | ----------- | ------- | ------- | --------- |
