# Incident Response Runbook

## Purpose

This runbook describes who to contact, what to check, and how to escalate when the Bantayog Alert system fails during a **demo**, **pilot**, or **production incident**.

It assumes you have access to the Firebase Console, `firebase-cli`, and the team communication channel (`#incidents` or equivalent).

## Severity Levels

| Level     | Description                                                          | Example                                                        | Response Time         |
| --------- | -------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------- |
| **SEV-1** | Total outage. System unusable for all users.                         | All Cloud Functions down; Firestore unreachable.               | Immediate — all hands |
| **SEV-2** | Partial degradation. Core feature broken for a subset of users.      | Report submission fails; responder dispatches are not created. | Within 30 minutes     |
| **SEV-3** | Minor degradation or data quality issue. Does not block primary use. | Duplicate reports not clustering; stale dashboard cache.       | Within 4 hours        |
| **SEV-4** | Documentation gap or cosmetic issue.                                 | Runbook typo; UI label inconsistency.                          | Next business day     |

## Initial Assessment (First 5 Minutes)

### 1. Confirm the Scope

Ask these questions:

- Is it **all users** or **some users**? (Check if affected users share a region, device type, or role.)
- Is it **all features** or **one feature**? (Can citizens still submit even if admin triage is broken?)
- Is it **platform-wide** or **our code**? (Check https://status.firebase.google.com/.)

### 2. Check the Vital Signs

Run these checks in order:

```bash
# Check if Firebase platform is healthy
open https://status.firebase.google.com/

# Check Functions error rates
firebase functions:log --limit 50 --project <project-id>

# Check if Firestore is accessible
firebase firestore:documents:get reports/seed-report-daet-flood-001 --project <project-id>

# Check if the hosting sites are up
curl -I https://<app>.web.app
```

### 3. Identify Recent Changes

```bash
# Last deploy
git log --oneline --since="24 hours ago"

# Check if someone ran staging seed recently
# (Ask in #deploys or check CI/CD pipeline history)
```

## Response Chain

### SEV-1: Total Outage

1. **Call the primary on-call engineer immediately.**
2. **Post in `#incidents`** with:
   - Severity: SEV-1
   - Symptom (one sentence)
   - Affected project (staging / production)
   - Timestamp when detected
3. **Begin rollback** (see [Rollback Runbook](./rollback.md)).
4. **Enable maintenance mode** if applicable:
   - Update Firebase Hosting `404.html` or equivalent to show a maintenance message.
   - Or disable the most problematic Cloud Function temporarily.
5. **Do not try to debug in production.** Roll back to the last known good state first.
6. After recovery, schedule a post-mortem within 24 hours.

### SEV-2: Partial Degradation

1. **Post in `#incidents`** with symptom, affected feature, and estimated users impacted.
2. **Try to reproduce** locally with emulators (`pnpm dev:all`).
3. **Check Firebase Functions logs** for the specific callable that is failing.
4. If the fix is a one-line revert, apply it and deploy. Otherwise, roll back first.
5. Monitor for 30 minutes after fix.

### SEV-3: Data Quality or Minor Issue

1. **Log the issue** in the backlog (GitHub issue or internal tracker).
2. **Assess if a manual correction is needed.** (Example: mark 50 spam reports as rejected.)
3. **If manual correction is needed**, document the exact steps and get a second person to review before executing.
4. Schedule the fix for the next maintenance window.

## Communication Templates

### Initial Incident Post

```
🚨 INCIDENT SEV-[1/2/3]
Project: [staging | production]
Detected: [timestamp]
Symptom: [one sentence]
Scope: [all users | subset | single feature]
Actions taken so far: [none | rollback attempted | investigating]
ETA for update: [time]
```

### Status Update

```
📋 UPDATE — SEV-[1/2/3]
Status: [investigating | mitigated | resolved]
Last action: [what you did]
Next action: [what you are doing now]
ETA: [time]
```

### Resolution Post

```
✅ RESOLVED — SEV-[1/2/3]
Duration: [start time] to [end time]
Root cause (tentative): [sentence]
Action taken: [rollback / hotfix / data correction]
Follow-up: [post-mortem scheduled / ticket created / monitoring alert adjusted]
```

## Post-Incident Review (Within 24 Hours for SEV-1, Within 72 Hours for SEV-2)

Document:

1. Timeline of events (detected → acknowledged → mitigated → resolved).
2. Root cause (technical or procedural).
3. What worked well.
4. What did not work well.
5. Action items with owners and deadlines.

## LGU Pilot Specific Guidance

During an LGU-managed pilot, the system is co-monitored by both the dev team and the LGU operations desk.

- **LGU operations desk** should contact the dev team `#incidents` channel for technical issues.
- **Dev team** should not make unilateral production changes during a pilot without notifying the LGU coordinator.
- **All production deploys** during a pilot require a 24-hour advance notice to the LGU coordinator.
- **Data correction** (marking reports rejected, updating statuses manually) must be done through the Admin Desktop, never via direct Firestore edits, and must be logged.

## Related Runbooks

- [Rollback Runbook](./rollback.md) — Reverting bad deploys and data mutation.
- [Data Privacy Runbook](./data-privacy.md) — PII exposure incidents, retention, and erasure.
- [Pilot Demo Runbook](./pilot-demo.md) — Local emulator setup and demo procedures.
