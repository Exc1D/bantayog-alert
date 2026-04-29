# Bantayog Alert — Degraded-Mode Runbook

**Version:** 1.0  
**Last Tabletop:** ___________________

---

## Scenario 1 — Firebase Hosting Unavailable

**Detection:** bantayog.camarines-norte.gov.ph returns 5xx or is unreachable.
Cloud Monitoring alert fires (Functions error rate elevated). Ops on-call email notified.

**First-responder action:**
1. Confirm Firebase Hosting status at https://status.firebase.google.com
2. Post SMS instructions to barangay announcement channels:
   `BANTAYOG <type> <barangay name>` — example: `BANTAYOG BAHA DAET CENTRO`
3. Notify MDRRMO admins via direct SMS: "Citizen PWA temporarily down. Citizens may
   report via SMS: BANTAYOG TYPE BARANGAY"
4. Post status update to PDRRMO Facebook page.

**Escalation:** If unresolved >30 min, escalate to PDRRMO Director.

**Recovery:** Firebase Hosting self-heals. Verify by loading the public URL.
No data loss — SMS reports in sms_inbox are processed normally on recovery.

**Rollback if bad deploy caused it:**
```
git checkout v1.0.0-pilot
firebase deploy --project bantayog-alert --only hosting
```

---

## Scenario 2 — Cloud Functions Unavailable

**Detection:** Report intake stops. Cloud Monitoring alert fires (Functions errors > 5 per 5 min).
Backend on-call email notified.

**First-responder action:**
1. Check Cloud Functions console for error details.
2. If our deploy caused it, rollback immediately:
   ```
   git checkout v1.0.0-pilot
   firebase deploy --project bantayog-alert --only functions
   ```
3. If Firebase platform issue, set manual ops mode:
   In Firestore console: `system_config/manual_ops_mode` → `{ enabled: true, reason: "Functions unavailable", setAt: <timestamp> }`
4. Notify MDRRMO admins via SMS: "System in manual operations mode. Use paper forms.
   Hotline: [PDRRMO direct phone number]"

**Escalation:** If unresolved >1h, open Firebase support ticket: https://firebase.google.com/support

**Recovery:** Redeploy from v1.0.0-pilot (command above). Clear manual_ops_mode after:
`npx tsx functions/scripts/smoke-test-prod.ts bantayog-alert` must exit 0.

---

## Scenario 3 — SMS Provider Down (Both Semaphore + Globe Labs)

**Detection:** SMS delivery success rate drops to 0 on both providers.
Dead-letter queue alert fires (ops on-call email).
Check sms_outbox in Firestore for status="dead_letter".

**First-responder action:**
1. Check provider status:
   - Semaphore: https://semaphore.co
   - Globe Labs: https://developer.globelabs.com.ph
2. Publish PDRRMO direct phone hotline to all channels:
   Facebook + barangay channels: "SMS reporting temporarily unavailable. Call PDRRMO: [phone number]"
3. Web PWA remains fully functional — redirect citizens to web.

**Escalation:** Semaphore: semaphore.co support. Globe Labs: developer support via API portal.

**Recovery:** Providers auto-recover. Circuit-breaker restores active provider automatically.
reconcileSmsDeliveryStatus replays queued messages. Monitor sms_outbox for status="sent".
No manual replay needed.

---

## Scenario 4 — Firebase RTDB Unavailable (Responder Map Stale)

**Detection:** Responder location telemetry stops updating (stale >5 min in admin map).
Cloud Monitoring RTDB alert fires. Ops on-call email notified.

**Impact:** Responder map stale or blank. All Firestore-based workflows continue normally
(report submission, dispatch, verify, resolve, field notes — unaffected).

**First-responder action:**
1. Confirm RTDB unavailability at https://status.firebase.google.com
2. Notify MDRRMO admins via SMS: "Responder map may be stale. Contact dispatched
   responders by phone for location updates. All other functions are normal."
3. Instruct responders via radio/phone to verbally relay position to dispatch.

**Escalation:** RTDB outages are Firebase platform issues — no internal rollback.
Monitor Firebase status. Escalate to PDRRMO Director if outage >30 min.

**Recovery:** RTDB self-heals. Telemetry resumes automatically. No data replay needed —
telemetry is ephemeral. Responder map recovers within 30 seconds of RTDB restore.

---

## Tabletop Verification Checklist

Run before Track 3 (Track 2 tabletop — discovery) and on Track 3 day (fidelity confirmation).

- [ ] All scenario public URLs resolve (bantayog.camarines-norte.gov.ph, admin subdomain)
- [ ] All credential references exist in Secret Manager for this environment
- [ ] Rollback commands: `git tag -l` confirms v1.0.0-pilot tag present
- [ ] Rollback commands: `firebase deploy --project bantayog-alert` — project name confirmed correct
- [ ] Smoke test command: `npx tsx functions/scripts/smoke-test-prod.ts bantayog-alert` — path confirmed
- [ ] PDRRMO hotline number: [FILL IN] — verified reachable
- [ ] Firebase support URL: https://firebase.google.com/support — confirmed accessible
- [ ] Semaphore status URL: https://semaphore.co — confirmed accessible
