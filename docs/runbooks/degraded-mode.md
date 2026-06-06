# Bantayog Alert — Degraded-Mode Runbook

**Version:** 1.0  
**Last Tabletop:** **\*\*\*\***\_\_\_**\*\*\*\***

---

## Scenario 1 — Firebase Hosting Unavailable

**Detection:** bantayog.camarines-norte.gov.ph returns 5xx or is unreachable.
Cloud Monitoring alert fires (Functions error rate elevated). Ops on-call email notified.

**First-responder action:**

1. Confirm Firebase Hosting status at https://status.firebase.google.com
2. Post hotline and walk-in reporting instructions to barangay announcement channels.
3. Notify MDRRMO admins: "Citizen PWA temporarily down. Use paper/manual intake.
   Hotline: [PDRRMO direct phone number]"
4. Post status update to PDRRMO Facebook page.

**Escalation:** If unresolved >30 min, escalate to PDRRMO Director.

**Recovery:** Firebase Hosting self-heals. Verify by loading the public URL.
Manual intake records should be reconciled by MDRRMO staff after recovery.

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
4. Notify MDRRMO admins: "System in manual operations mode. Use paper forms.
   Hotline: [PDRRMO direct phone number]"

**Escalation:** If unresolved >1h, open Firebase support ticket: https://firebase.google.com/support

**Recovery:** Redeploy from v1.0.0-pilot (command above). Clear manual_ops_mode after:
`npx tsx functions/scripts/smoke-test-prod.ts bantayog-alert` must exit 0.

---

## Scenario 3 — Public Communications Channel Disrupted

**Detection:** Barangay or public announcement channel cannot reach citizens.
Ops on-call or PDRRMO communications lead confirms the channel outage.

**First-responder action:**

1. Publish PDRRMO direct phone hotline through every available alternate channel.
2. Ask barangay focal persons to relay the hotline and walk-in reporting locations.
3. Web PWA remains fully functional when hosting is healthy — redirect citizens to web.

**Escalation:** If no public channel is available within 30 minutes, escalate to PDRRMO Director.

**Recovery:** Communications lead confirms the primary channel is usable again.
Reconcile any manual hotline or walk-in reports into the normal report workflow.

---

## Scenario 4 — Firebase RTDB Unavailable (Responder Map Stale)

**Detection:** Responder location telemetry stops updating (stale >5 min in admin map).
Cloud Monitoring RTDB alert fires. Ops on-call email notified.

**Impact:** Responder map stale or blank. All Firestore-based workflows continue normally
(report submission, dispatch, verify, resolve, field notes — unaffected).

**First-responder action:**

1. Confirm RTDB unavailability at https://status.firebase.google.com
2. Notify MDRRMO admins: "Responder map may be stale. Contact dispatched
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
