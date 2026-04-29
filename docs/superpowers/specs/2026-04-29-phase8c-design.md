# Phase 8C Design — RA 10173 Erasure & Anonymization Execution

**Date:** 2026-04-29
**Status:** Approved
**Branch:** TBD — implementation branch to be created

---

## Overview

Phase 8C closes the RA 10173 (Philippine Data Privacy Act) compliance loop. Phase 7A built the approval gate (`approveErasureRequest` callable, `erasure_requests` collection, erasure drawer in Admin Desktop). Phase 8C adds the execution side: the citizen-facing deletion request, the anonymization executor, and the automated retention sweep.

Phase 8A (surge validation) and Phase 8B (signal ingest, operator control) are already complete. Phase 8C is independent of both.

---

## Decision Log

**Retention schedule overrides arch spec §11.2 for unverified reports.**
The arch spec specifies 6-month anonymize / 12-month purge. Phase 8C adopts 1-week anonymize / 1-month hard-delete for unverified reports. Rationale: faster cleanup is more privacy-protective and pilot scale does not require the longer retention windows. This applies to unverified reports only. Verified reports are retained indefinitely as public record (anonymized to `citizen_deleted` on erasure).

---

## Scope

### In Scope

- `requestDataErasure` callable — citizen-facing erasure request submission
- `erasureSweep` scheduled function — anonymization executor (post-approval)
- `retentionSweep` scheduled function — time-based anonymize and delete for unverified reports
- Citizen PWA "Delete my account" screen and confirmation flow
- Modification to `approveErasureRequest` — add Auth rollback discipline to the deny path

### Out of Scope

- Pseudonymous submission erasure — pseudonymous reports have no UID linkage to authenticated citizens and are handled exclusively by `retentionSweep` time-based deletion
- "Right to Access" / data export flow (separate feature)
- Breach notification workflow
- Verified report deletion — verified reports are public record and are anonymized in-place, never hard-deleted

---

## Architecture

### Four new production units

| Unit                      | Type         | Trigger                          |
| ------------------------- | ------------ | -------------------------------- |
| `requestDataErasure`      | Callable     | Citizen taps "Delete my account" |
| `erasureSweep`            | Scheduled CF | Every 15 minutes                 |
| `retentionSweep`          | Scheduled CF | Daily                            |
| PWA delete-account screen | UI           | Settings → Privacy flow          |

### One existing unit modified

| Unit                    | Change                                                    |
| ----------------------- | --------------------------------------------------------- |
| `approveErasureRequest` | Add Auth re-enable + rollback discipline to the deny path |

### Data flow

```
Citizen "Delete my account"
  → requestDataErasure callable
      → disable Firebase Auth (Admin SDK)
      → write erasure_requests/{id} { status: 'pending_review' }
      → rollback (re-enable Auth) if doc write fails
  → client signOut()

Superadmin approves in Admin Desktop
  → approveErasureRequest callable
      → status: 'approved_pending_anonymization'

erasureSweep (every 15 min)
  → claims: status → 'executing', sweepRunId: <uuid>
  → collect report IDs by citizenUid
  → read report_private for msisdnHashes (before nulling)
  → anonymize reports, report_private, report_contacts, sms docs
  → delete Storage blobs (all reports)
  → hard-delete Firebase Auth account  ← last
  → status: 'completed'
  → on failure: re-enable Auth, status → 'dead_lettered'

Superadmin denies
  → re-enable Firebase Auth
  → status: 'denied'
  → rollback (re-disable) if doc write fails

retentionSweep (daily)
  → unverified, unerasured reports > 1 week: anonymize in-place
  → retentionHardDeleteEligibleAt < now: hard-delete
```

### Architectural boundaries

- `requestDataErasure` never touches Firestore report documents — that is sweep-only.
- `erasureSweep` only processes reports where `submittedBy === citizenUid`. Pseudonymous submissions are not in scope.
- `erasureSweep` never touches a doc in `executing` state it did not claim in the current run.
- Auth hard-delete is always the last operation in `erasureSweep`, never earlier.
- `retentionSweep` does not process `erasure_requests` — that is `erasureSweep`'s domain.
- `retentionSweep` never touches reports where `submittedBy === 'citizen_deleted'` — those have been through `erasureSweep` and are done.
- The two sweeps touch disjoint sets of documents.

---

## Data Model

### `erasure_requests/{id}`

**Status lifecycle:**

```
pending_review
  → approved_pending_anonymization  (superadmin approves)
  → denied                          (superadmin denies — Auth re-enabled)

approved_pending_anonymization
  → executing                       (sweep claims it)

executing
  → completed                       (all steps succeeded)
  → dead_lettered                   (non-retryable failure or max retries exceeded)
```

**Fields:**

| Field                | Type          | Set by                                             |
| -------------------- | ------------- | -------------------------------------------------- |
| `citizenUid`         | `string`      | `requestDataErasure` callable                      |
| `status`             | enum (above)  | status transitions                                 |
| `requestedAt`        | `number` (ms) | `requestDataErasure` callable                      |
| `reviewedBy`         | `string`      | `approveErasureRequest` callable                   |
| `reviewedAt`         | `number` (ms) | `approveErasureRequest` callable                   |
| `reviewReason`       | `string?`     | `approveErasureRequest` callable                   |
| `executionStartedAt` | `number` (ms) | `erasureSweep` at claim                            |
| `sweepRunId`         | `string`      | `erasureSweep` at claim — guards double-processing |
| `completedAt`        | `number` (ms) | `erasureSweep` on success                          |
| `deadLetteredAt`     | `number` (ms) | `erasureSweep` on failure                          |
| `deadLetterReason`   | `string`      | `erasureSweep` on failure                          |

**Subcollection:** `erasure_requests/{id}/auditLog/{eventId}` — one entry per status transition with actor, timestamp, and metadata. Separate from the BigQuery audit stream so the record survives even if streaming is degraded.

**Idempotency gate in `requestDataErasure`:** Blocks new submission if existing request has status `∈ ['pending_review', 'approved_pending_anonymization', 'executing']`. Allows re-submission if status `∈ ['completed', 'denied', 'dead_lettered']`.

---

### Fields anonymized per collection during `erasureSweep`

| Collection             | Operation                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `reports/{id}`         | `submittedBy → 'citizen_deleted'`, `mediaRedacted → true`                           |
| `report_private/{id}`  | Null: `citizenName`, `rawPhone`, `gpsExact`, `addressText`. Keep structural fields. |
| `report_contacts/{id}` | Null all content fields. Keep structural fields for analytics.                      |
| `sms_sessions`         | Null: `msisdn`, sender identity fields                                              |
| `sms_inbox`            | Null identity fields linked via session                                             |
| Firebase Storage       | Hard-delete all blobs for all citizen reports (verified and unverified)             |
| Firebase Auth          | Hard-delete last — non-reversible                                                   |

**Invariant:** `reports/{id}` is never deleted by `erasureSweep` — only anonymized. Verified reports survive as public record with `submittedBy: 'citizen_deleted'` and `mediaRedacted: true`. The `retentionSweep`'s `submittedBy !== 'citizen_deleted'` guard ensures these are never re-processed.

---

### Retention fields on `reports/{id}`

| Field                           | Type           | Set by                            | Meaning                                                                     |
| ------------------------------- | -------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `retentionAnonymizedAt`         | `number?` (ms) | `retentionSweep` only             | Clock-based retention policy anonymized this report at the 1-week threshold |
| `retentionHardDeleteEligibleAt` | `number?` (ms) | `retentionSweep` at anonymization | `retentionAnonymizedAt + 30 days` — used by the hard-delete query           |
| `mediaRedacted`                 | `boolean`      | `erasureSweep`                    | Storage blobs deleted as part of citizen erasure                            |

`erasureSweep` signals its work via `erasure_requests/{id}.completedAt`. It does not set `retentionAnonymizedAt` on the report docs it touches — the two triggers are distinct and use different field signals.

---

### Two erasure paths — disjoint

| Path                          | Trigger                          | Scope                                      | Verified reports                              |
| ----------------------------- | -------------------------------- | ------------------------------------------ | --------------------------------------------- |
| Auth-erasure (`erasureSweep`) | Citizen request + admin approval | Authenticated citizens, UID-based          | Anonymized in-place, survive indefinitely     |
| Time-based (`retentionSweep`) | Report age                       | Pseudonymous + unverified, no UID required | Anonymized at 1 week, hard-deleted at 1 month |

The `submittedBy !== 'citizen_deleted'` guard in `retentionSweep` is the single line that enforces this separation. Worth a comment in the implementation.

---

## Callable Behavior

### `requestDataErasure` (new)

Citizen-facing. Called from the PWA "Delete my account" confirmation flow.

**Auth:** Requires valid citizen auth token (`requireAuth(request, ['citizen'])`). Not available to staff roles.

**Input:** None — `citizenUid` derived from `request.auth.uid`.

**Execution:**

```
1. Check no active erasure_request for this UID
   (status ∈ ['pending_review', 'approved_pending_anonymization', 'executing'])
   → throw 'already-exists' if one exists

2. updateUser(uid, { disabled: true })   ← Admin SDK

3. Write erasure_requests/{newId} {
     citizenUid: uid,
     status: 'pending_review',
     requestedAt: Date.now()
   }

4. If step 3 fails:
   → updateUser(uid, { disabled: false })   ← rollback
   → throw 'internal'

5. streamAuditEvent('erasure_request_submitted', ...)
```

**Client after callable returns:** calls `signOut()` — the account is already server-side disabled; sign-out is the UX signal.

---

### `approveErasureRequest` (modify existing — deny path)

The approval path (`approved: true`) is unchanged — sets status to `approved_pending_anonymization`.

**Deny path (new behavior):**

```
1. Verify status === 'pending_review' (existing gate)

2. updateUser(citizenUid, { disabled: false })   ← re-enable Auth

3. Update erasure_requests/{id} { status: 'denied', reviewedBy, reviewedAt, reviewReason }

4. If step 3 fails:
   → updateUser(citizenUid, { disabled: true })   ← re-disable Auth
   → throw 'internal' — operator sees failure, retries

5. streamAuditEvent('erasure_request_denied', ...)
```

---

## Sweep Behavior

### `erasureSweep` — runs every 15 minutes

**Scope constraint (explicit):** Only processes reports where `submittedBy === citizenUid`. Pseudonymous submissions have no authenticated UID linkage and are not in scope. They are handled exclusively by `retentionSweep`.

**Claim step:** Query `erasure_requests` where `status === 'approved_pending_anonymization'`, batch of 10. Atomically write `{ status: 'executing', sweepRunId: <uuid>, executionStartedAt: Date.now() }` before any destructive work. Records stuck in `executing` for > 30 min are re-claimable; re-claim writes a new `sweepRunId`, overwriting the stale one.

**Execution order per record:**

```
1. Collect report IDs where submittedBy === citizenUid
2. Read report_private for each → extract msisdnHashes (deduplicated)
   ← must happen before report_private is nulled
3. Anonymize reports/{id}: submittedBy → 'citizen_deleted', mediaRedacted → true
4. Null report_private/{id}: citizenName, rawPhone, gpsExact, addressText
5. Null report_contacts/{id}: all content fields
6. Null sms_sessions where msisdnHash ∈ collected hashes
7. Null sms_inbox docs linked to those sessions
   ← implementation note: verify the foreign-key field on sms_inbox
     that references the session (e.g. sessionId or msisdnHash)
     against the actual schema before implementing this step
8. Delete Storage blobs for all citizen reports (verified and unverified)
9. Hard-delete Firebase Auth account  ← last, non-reversible
10. status → 'completed', completedAt: Date.now()
```

Steps 1–8 are idempotent and safe to retry. Step 9 is not retryable if it succeeds.

**On failure at any step:**

```
→ attempt updateUser(uid, { disabled: false })   ← re-enable Auth
→ if re-enable fails:
    fire CRITICAL alert: "dead-letter AND failed to re-enable Auth — manual intervention required"
    (separate severity from normal dead-letter — citizen is locked out until human action)
→ status → 'dead_lettered', deadLetterReason: '<step N error>', deadLetteredAt: Date.now()
→ streamAuditEvent('erasure_request_dead_lettered_with_auth_unblocked', ...)
```

`dead_lettered` status does not block the citizen from submitting a new `requestDataErasure` after the failure.

---

### `retentionSweep` — runs daily

Operates independently of `erasure_requests`. Targets `reports` where `verified === false`.

**1-week threshold — anonymize in-place:**

```
Query: reports where verified === false
       AND submittedBy !== 'citizen_deleted'
       AND submittedAt < now - 7 days
       AND retentionAnonymizedAt is null

For each:
  → Skip if report's citizenUid has an active erasure_requests record
    (status ∈ ['pending_review', 'approved_pending_anonymization', 'executing'])
    Rationale: erasureSweep owns those — in-memory UID check after query,
    not a Firestore filter (cross-collection NOT IN is unsupported)
  → Read report_private → extract msisdnHashes (before nulling)
  → Null report_private fields (citizenName, rawPhone, gpsExact, addressText)
  → Null report_contacts fields (all content)
  → Delete Storage blobs; set mediaRedacted: true on reports/{id}
  → Null sms_inbox / sms_sessions via msisdnHash join
  → Set retentionAnonymizedAt: Date.now()
  → Set retentionHardDeleteEligibleAt: Date.now() + 30 days
```

**1-month threshold — hard-delete:**

```
Query: reports where retentionHardDeleteEligibleAt < now

For each:
  → Delete reports/{id}
  → Delete report_private/{id}
  → Delete report_contacts/{id}
  → Write audit log doc: { reportId, retentionDeletedAt: Date.now(), reason: 'retention_policy' }
```

**Invariant:** `retentionSweep` skips any report belonging to an active `erasure_requests` record (`status ∈ ['pending_review', 'approved_pending_anonymization', 'executing']`).

---

## Citizen PWA

### Entry point

Settings → Privacy → **"Delete my account"** — destructive action, visually distinct. No in-app status tracking after submission.

### Confirmation flow

**Step 1 — Warning screen:**

> "Delete your account?"
>
> This will permanently:
>
> - Remove your name, contact info, and account
> - Anonymize your reports (they remain as public record)
> - Sign you out immediately
>
> This cannot be undone. Your request will be reviewed before deletion is complete.
>
> [Cancel] [Yes, delete my account →]

**Step 2 — Final confirmation:**

> "Are you sure?"
>
> Type DELETE to confirm.
>
> [Cancel] [Confirm deletion]

Typing gate prevents accidental tap-through on mobile.

### On submission

```
1. Call requestDataErasure callable
2. On success:
   → call signOut() (Firebase client SDK)
   → navigate to /goodbye
3. On failure (generic):
   → "Something went wrong. Your account has not been deleted. Please try again."
4. On failure (already-exists):
   → "A deletion request is already pending for this account."
   (implementation detail — not a spec requirement)
```

### `/goodbye` screen

Static, unauthenticated. Plain message: "Your deletion request has been submitted. You have been signed out. You will not receive further notifications." Firebase Auth session is already terminated before the citizen lands here — the screen is a finality signal, not a security control.

---

## Firestore Rules — `erasure_requests/{id}`

| Operation | Who                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------- |
| Create    | Authenticated citizen where `citizenUid === request.auth.uid` and `status === 'pending_review'` |
| Read      | Citizen where `citizenUid === request.auth.uid`, or superadmin                                  |
| Update    | Sweep / service account only — no client write path after creation                              |
| Delete    | Nobody — documents are terminal audit records                                                   |

---

## Verification

### Callable tests — `requestDataErasure`

- Rejects unauthenticated callers
- Rejects non-citizen roles
- Blocks submission when active request exists (`pending_review`, `approved_pending_anonymization`, `executing`)
- Allows re-submission when prior request is `dead_lettered`, `completed`, or `denied`
- Disables Firebase Auth before writing erasure request doc
- Rolls back (re-enables Auth) if doc write fails
- Streams audit event on success

### Callable tests — `approveErasureRequest` (deny path additions)

- Deny re-enables Firebase Auth account
- Deny rollback: re-disables Auth if status doc write fails
- Deny surfaces error to operator on rollback

### `erasureSweep` tests

- Claims only `approved_pending_anonymization` records; skips `executing`, `completed`, `denied`, `dead_lettered`
- Re-claims stale `executing` records (> 30 min old); new `sweepRunId` overwrites the stale one
- Pseudonymous report (no `submittedBy`) present in Firestore: sweep completes with zero documents processed, no error (explicit skip, not silent failure)
- Execution order: SMS join reads happen before `report_private` is nulled
- Verified reports anonymized in-place: `submittedBy → 'citizen_deleted'`, `mediaRedacted → true`
- Unverified reports anonymized in-place (same fields)
- `report_private` content fields nulled; structural fields survive
- `report_contacts` content fields nulled
- Storage blobs deleted for all reports (verified and unverified)
- Firebase Auth hard-delete is the final step
- On step failure: Auth re-enabled, status → `dead_lettered`, audit event fired
- On Auth re-enable failure: CRITICAL alert fired at separate severity from dead-letter audit event
- `dead_lettered` request does not block re-submission via `requestDataErasure`

### `retentionSweep` tests

- Skips reports where `submittedBy === 'citizen_deleted'`
- Skips reports belonging to active erasure requests
- 1-week anonymize: nulls PII fields, deletes Storage blobs, sets `retentionAnonymizedAt` and `retentionHardDeleteEligibleAt`
- 1-month delete: hard-deletes report + subcollections, writes audit log doc
- Hard-delete query targets `retentionHardDeleteEligibleAt < now` — does not search deleted documents

### Firestore rules tests

- Citizen can create `erasure_requests` with own UID and `pending_review` status only
- Citizen can read own request; cannot read another citizen's request
- Citizen cannot update status after creation
- Superadmin can read all requests
- Client cannot write `executing`, `completed`, or `dead_lettered` status directly

### Staging drills

- Submit erasure request → verify Auth disabled, doc created with `pending_review`
- Approve request → verify `erasureSweep` picks it up within 15 min, all docs anonymized, Auth hard-deleted, status `completed`
- Deny request → verify Auth re-enabled, status `denied`
- Force sweep failure (mock step 5) → verify dead-letter path fires, Auth re-enabled
- Force sweep failure + Auth re-enable failure → verify CRITICAL alert fires at distinct severity
- Retention 1-week drill: seed report with `submittedAt` > 7 days ago, run sweep, verify anonymization and `retentionHardDeleteEligibleAt` set
- Retention 1-month drill: seed report with `retentionHardDeleteEligibleAt` in the past, run sweep, verify hard-delete and audit log doc written

---

## Exit Criteria

Phase 8C is complete when all of the following are true:

- `requestDataErasure` callable deployed; citizen can submit from PWA; Auth disabled on submission; rollback tested
- `approveErasureRequest` deny path re-enables Auth with rollback discipline; tested
- `erasureSweep` deployed; approved requests processed within 15 min in staging; all doc classes anonymized; Auth deleted last; dead-letter path tested
- `retentionSweep` deployed; 1-week anonymize and 1-month hard-delete verified in staging
- Firestore rules cover create/read/update access for `erasure_requests`; rules tests pass
- Citizen PWA delete-account flow tested end-to-end in staging browser
- `docs/learnings.md` updated with Phase 8C decisions
- `docs/progress.md` updated with Phase 8C status
