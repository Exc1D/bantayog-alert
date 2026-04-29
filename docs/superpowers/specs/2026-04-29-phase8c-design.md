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
The arch spec specifies 6-month anonymize / 12-month purge. Phase 8C adopts 1-week anonymize / 1-month hard-delete for unverified reports. Rationale: faster cleanup is more privacy-protective and pilot scale does not require the longer retention windows. This applies to unverified reports only. Verified reports are retained indefinitely as public record (anonymized to `citizen_deleted` on erasure). This deviation must be registered in the platform's DPIA before citizen data processing begins.

**Audit trail retention: 7 years.**
`erasure_requests` documents and their `auditLog` subcollections are retained for 7 years from `requestedAt`, consistent with the civil code statute of limitations under RA 10173.

**Pseudonymous erasure gap — production launch blocker for SMS registration flow.**
`erasureSweep` only processes reports linked by `submittedBy === citizenUid`. Citizens who submitted via SMS (pseudonymous, no Auth UID) before registering an account have no erasure path for pre-registration data — their PII lives in `sms_inbox`/`sms_sessions` under a `senderMsisdnHash` that the system cannot link to their new Auth UID. This is a direct RA 10173 §16 compliance gap. It affects the primary feature-phone onboarding path, not a niche case.

Production launch gate: This gap must be resolved — or explicitly acknowledged by PDRRMO legal counsel as a deferred compliance risk with a documented mitigation timeline — before the citizen SMS onboarding path is activated in production. The gap is not a Phase 8C exit blocker; it is a production launch blocker for the SMS registration flow. Resolution requires a UID-linkage mechanism at registration time, tracked as a named issue.

---

## Scope

### In Scope

- `requestDataErasure` callable — citizen-facing erasure request submission
- `erasureSweep` scheduled function — anonymization executor (post-approval)
- `retentionSweep` scheduled function — time-based anonymize and delete for unverified reports
- Citizen PWA "Delete my account" screen and confirmation flow
- Modification to `approveErasureRequest` — add Auth rollback discipline to the deny path

### Out of Scope

- Pseudonymous submission erasure — pseudonymous reports have no UID linkage to authenticated citizens and are handled exclusively by `retentionSweep` time-based deletion. See Decision Log for compliance gap and production launch gate.
- "Right to Access" / data export flow (separate feature)
- Breach notification workflow
- Verified report deletion — verified reports are retained as public record under RA 10173 §18 (public interest / legal obligation exemption). Formal legal review and NPC registration confirmation required before production launch. Erasure anonymizes in-place; hard-delete is never performed on verified reports.

---

## Architecture

### Four new production units

| Unit                      | Type         | Trigger                          |
| ------------------------- | ------------ | -------------------------------- |
| `requestDataErasure`      | Callable     | Citizen taps "Delete my account" |
| `erasureSweep`            | Scheduled CF | Every 15 minutes                 |
| `retentionSweep`          | Scheduled CF | Daily                            |
| PWA delete-account screen | UI           | Settings → Privacy flow          |

### One new callable + one modified

| Unit                    | Change                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `approveErasureRequest` | Add Auth re-enable + rollback discipline to the deny path; preserve existing transaction gate |
| `setErasureLegalHold`   | New — superadmin + MFA; sets/clears `legalHold` flag on `erasure_requests/{id}`               |

### Data flow

```
Citizen "Delete my account"
  → requestDataErasure callable
      → write erasure_active/{uid} sentinel + erasure_requests/{id} (atomic transaction)
      → disable Firebase Auth (Admin SDK)
      → rollback (delete docs) if Auth disable fails
  → client signOut()

Superadmin approves in Admin Desktop
  → approveErasureRequest callable (Firestore transaction gate)
      → status: 'approved_pending_anonymization'

Superadmin sets legal hold
  → setErasureLegalHold callable
      → legalHold: true/false on erasure_requests/{id}

erasureSweep (every 15 min, sequential claim)
  → skip if legalHold === true (surface in system_health)
  → claim one record: status → 'executing', sweepRunId: <uuid>
  → collect report IDs by citizenUid
  → read report_private for senderMsisdnHashes (before nulling)
  → anonymize reports, report_private, report_contacts, sms docs
  → delete Storage blobs (all reports)
  → hard-delete Firebase Auth account  ← last
  → delete erasure_active/{uid} sentinel
  → status: 'completed'
  → on failure: re-enable Auth, status → 'dead_lettered'

Superadmin denies
  → re-enable Firebase Auth (Firestore transaction gate)
  → delete erasure_active/{uid} sentinel
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
| `legalHold`          | `boolean`     | `setErasureLegalHold` callable (default `false`)   |
| `legalHoldReason`    | `string?`     | `setErasureLegalHold` callable                     |
| `legalHoldSetBy`     | `string?`     | `setErasureLegalHold` callable                     |
| `requestedAt`        | `number` (ms) | `requestDataErasure` callable                      |
| `reviewedBy`         | `string`      | `approveErasureRequest` callable                   |
| `reviewedAt`         | `number` (ms) | `approveErasureRequest` callable                   |
| `reviewReason`       | `string?`     | `approveErasureRequest` callable                   |
| `executionStartedAt` | `number` (ms) | `erasureSweep` at claim                            |
| `sweepRunId`         | `string`      | `erasureSweep` at claim — guards double-processing |
| `completedAt`        | `number` (ms) | `erasureSweep` on success                          |
| `deadLetteredAt`     | `number` (ms) | `erasureSweep` on failure                          |
| `deadLetterReason`   | `string`      | `erasureSweep` on failure                          |

**Subcollection:** `erasure_requests/{id}/auditLog/{eventId}` — one entry per status transition with actor, timestamp, and metadata. Separate from the BigQuery audit stream so the record survives even if streaming is degraded. Retained for 7 years from `requestedAt` (RA 10173 + civil code statute of limitations).

**Idempotency gate in `requestDataErasure`:** Enforced atomically via a sentinel doc `erasure_active/{citizenUid}`. The callable writes the sentinel and the `erasure_requests` doc in a single Firestore transaction — if the sentinel already exists, the transaction fails with `already-exists`. The sentinel is deleted when the request reaches `completed`, `denied`, or `dead_lettered`. This prevents the double-call race where two concurrent submissions both pass a status check before either writes.

Re-submission allowed (sentinel absent) when prior request is `∈ ['completed', 'denied', 'dead_lettered']`.

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

**Invariant:** `reports/{id}` is never deleted by `erasureSweep` — only anonymized. Verified reports survive as public record under the RA 10173 §18 public interest / legal obligation exemption, with `submittedBy: 'citizen_deleted'` and `mediaRedacted: true`. The `retentionSweep`'s `submittedBy !== 'citizen_deleted'` guard ensures these are never re-processed. This exemption requires formal legal review and NPC registration before production launch.

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
1. In a single Firestore transaction:
   a. Attempt to create erasure_active/{uid} (fails atomically if it exists)
      → throw 'already-exists' if sentinel present
   b. Write erasure_requests/{newId} {
        citizenUid: uid,
        status: 'pending_review',
        legalHold: false,
        requestedAt: Date.now()
      }
   ← doc write before Auth disable: if write fails, no side effects

2. updateUser(uid, { disabled: true })   ← Admin SDK

3. If step 2 fails:
   → delete erasure_requests/{newId} and erasure_active/{uid}   ← rollback
   → throw 'internal'

4. streamAuditEvent('erasure_request_submitted', ...)
```

**Client after callable returns:** calls `signOut()` — the account is already server-side disabled; sign-out is the UX signal.

---

### `approveErasureRequest` (modify existing — deny path)

The approval path (`approved: true`) is unchanged — wraps the status check and update in a Firestore transaction that reads and verifies `status === 'pending_review'` before writing, preventing concurrent approve+deny from both reading `pending_review` and both succeeding. The existing implementation already uses `db.runTransaction()`; the deny path modification must preserve this wrapper.

**Deny path (new behavior):**

```
1. Firestore transaction:
   a. Read erasure_requests/{id}
   b. Verify status === 'pending_review' → throw 'failed-precondition' if not

2. updateUser(citizenUid, { disabled: false })   ← re-enable Auth

3. Firestore transaction:
   a. Update erasure_requests/{id} { status: 'denied', reviewedBy, reviewedAt, reviewReason }
   b. Delete erasure_active/{citizenUid}   ← release sentinel

4. If step 3 fails:
   → updateUser(citizenUid, { disabled: true })   ← re-disable Auth
   → throw 'internal' — operator sees failure, retries

5. streamAuditEvent('erasure_request_denied', ...)
```

---

### `setErasureLegalHold` (new)

Superadmin-facing. Pauses or resumes `erasureSweep` processing for a specific request without altering its status.

**Auth:** Superadmin + MFA (`requireAuth(request, ['superadmin'])`, `requireMfaAuth(request)`).

**Input:** `{ erasureRequestId: string, hold: boolean, reason: string }`.

**Execution:**

```
1. Read erasure_requests/{id} → throw 'not-found' if absent
2. Verify status ∈ ['pending_review', 'approved_pending_anonymization', 'executing']
   → throw 'failed-precondition' if completed, denied, or dead_lettered
3. Update { legalHold: hold, legalHoldReason: reason, legalHoldSetBy: actor.uid }
4. streamAuditEvent('erasure_legal_hold_set' | 'erasure_legal_hold_cleared', ...)
```

`erasureSweep` checks `legalHold === true` before claiming any record. Held records are surfaced in `system_health/latest` as a separate counter so operators know they exist without manual Firestore queries.

---

## Sweep Behavior

### `erasureSweep` — runs every 15 minutes

**Scope constraint (explicit):** Only processes reports where `submittedBy === citizenUid`. Pseudonymous submissions have no authenticated UID linkage and are not in scope. They are handled exclusively by `retentionSweep`.

**Claim step (sequential — one record per invocation):** Query `erasure_requests` where `status === 'approved_pending_anonymization'` and `legalHold !== true`, limit 1. Skip any record where `legalHold === true` — surface held records in `system_health/latest.legalHoldErasureCount` so operators see them without manual queries. Atomically write `{ status: 'executing', sweepRunId: <uuid>, executionStartedAt: Date.now() }` before any destructive work on the claimed record. Records stuck in `executing` for > 30 min are re-claimable; re-claim writes a new `sweepRunId`, overwriting the stale one. Sequential claiming prevents mid-batch timeout from stranding unclaimed records in `executing` state.

**Execution order per record:**

```
1. Collect report IDs where submittedBy === citizenUid
2. Read report_private for each → extract senderMsisdnHashes (deduplicated)
   ← must happen before report_private is nulled
3. Anonymize reports/{id}: submittedBy → 'citizen_deleted', mediaRedacted → true
4. Null report_private/{id}: citizenName, rawPhone, gpsExact, addressText
5. Null report_contacts/{id}: all content fields
6. Null sms_sessions where senderMsisdnHash ∈ collected hashes
7. Null sms_inbox docs where senderMsisdnHash ∈ collected hashes
   (join is via senderMsisdnHash on sms_inbox, not a sessionId foreign key)
8. Delete Storage blobs for all citizen reports (verified and unverified)
9. Hard-delete Firebase Auth account  ← last, non-reversible
10. Delete erasure_active/{citizenUid} sentinel
11. status → 'completed', completedAt: Date.now()
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

## Firestore Rules

### `erasure_requests/{id}`

| Operation | Who                                                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create    | Authenticated citizen where `citizenUid === request.auth.uid` and `status === 'pending_review'`                                                                             |
| Read      | Citizen where `citizenUid === request.auth.uid`, or superadmin                                                                                                              |
| Update    | Service account only — status allowlist enforced: clients cannot write `executing`, `completed`, `dead_lettered`, `approved_pending_anonymization`, or `legalHold` directly |
| Delete    | Nobody — documents are terminal audit records                                                                                                                               |

### `erasure_requests/{id}/auditLog/{eventId}`

| Operation | Who                       |
| --------- | ------------------------- |
| Read      | Superadmin only           |
| Write     | Service account only      |
| Delete    | Nobody — 7-year retention |

### `erasure_active/{citizenUid}` (sentinel)

| Operation | Who                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------- |
| Create    | Authenticated citizen where `citizenUid === request.auth.uid` (callable-only path in practice) |
| Read      | Citizen where `citizenUid === request.auth.uid`, or superadmin                                 |
| Delete    | Service account only (on completion, denial, or dead-letter)                                   |

---

## Storage Rules

Citizens' report media (`/reports/{uid}/...`) is not public by default:

| Operation            | Who                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Read                 | Authenticated citizen where the path UID matches `request.auth.uid`, or authenticated staff (superadmin, municipal admin, agency admin) |
| Write / Delete       | Service account only (sweeps handle all blob deletion)                                                                                  |
| Unauthenticated read | Denied — no public blob access                                                                                                          |

Admin SDK (sweeps) bypasses Storage rules — no rule change needed for deletion paths.

---

## Verification

### Callable tests — `requestDataErasure`

- Rejects unauthenticated callers
- Rejects non-citizen roles
- Blocks submission atomically via `erasure_active/{uid}` sentinel — concurrent double-call produces exactly one success and one `already-exists`
- Allows re-submission when sentinel is absent (prior request `dead_lettered`, `completed`, or `denied`)
- Writes doc and sentinel before disabling Auth (doc write with no Auth side effect on failure)
- Auth disable failure rolls back: deletes doc and sentinel, throws `internal`
- Streams audit event on success

### Callable tests — `approveErasureRequest` (deny path additions)

- Approve and deny both use Firestore transaction to gate on `status === 'pending_review'`; concurrent approve + deny on same record: exactly one succeeds, one receives `failed-precondition`
- Deny re-enables Firebase Auth account
- Deny deletes `erasure_active/{uid}` sentinel on success
- Deny rollback: re-disables Auth if status doc write fails
- Deny surfaces error to operator on rollback

### Callable tests — `setErasureLegalHold`

- Rejects non-superadmin callers
- Rejects callers without MFA
- Sets `legalHold: true` with reason and actor UID
- Clears `legalHold: false`
- Rejects hold on completed, denied, or dead-lettered request
- Streams audit event for both set and clear

### `erasureSweep` tests

- Claims only `approved_pending_anonymization` records where `legalHold !== true`
- Skips records where `legalHold === true`; increments `system_health/latest.legalHoldErasureCount`
- Claims one record per invocation (sequential); does not bulk-claim
- Re-claims stale `executing` records (> 30 min old); new `sweepRunId` overwrites the stale one
- Pseudonymous report (no `submittedBy`) present in Firestore: assert sweep completes with zero documents processed and zero fields modified — explicit skip, not a coincidental no-op from UID not matching
- Execution order: `senderMsisdnHash` extraction happens before `report_private` is nulled
- Verified reports anonymized in-place: `submittedBy → 'citizen_deleted'`, `mediaRedacted → true`
- Unverified reports anonymized in-place (same fields)
- `report_private` content fields nulled; structural fields survive
- `report_contacts` content fields nulled
- `sms_inbox` and `sms_sessions` joined via `senderMsisdnHash` and nulled
- Storage blobs deleted for all reports (verified and unverified)
- Firebase Auth hard-delete is step 9 — final, after all Firestore and Storage steps
- `erasure_active/{uid}` sentinel deleted after Auth hard-delete
- On step failure: Auth re-enabled, status → `dead_lettered`, audit event fired
- On Auth re-enable failure: CRITICAL alert fired at separate severity from dead-letter audit event
- `dead_lettered` request does not block re-submission (sentinel is absent after dead-letter cleanup)

### `retentionSweep` tests

- Skips reports where `submittedBy === 'citizen_deleted'`
- Active erasure skip: seed a report owned by a citizen with `status: 'executing'` erasure request; assert `retentionAnonymizedAt` is NOT set after sweep — confirms the in-memory UID check ran and excluded it
- 1-week anonymize: nulls PII fields, deletes Storage blobs, sets `retentionAnonymizedAt` and `retentionHardDeleteEligibleAt`
- 1-month delete: hard-deletes report + subcollections, writes audit log doc with `retentionDeletedAt`
- Hard-delete query targets `retentionHardDeleteEligibleAt < now` — does not attempt to find deleted documents

### Firestore rules tests

- Citizen can create `erasure_requests` with own UID and `status === 'pending_review'` only
- Citizen can read own request; cannot read another citizen's request
- Citizen cannot write `executing`, `completed`, `dead_lettered`, `approved_pending_anonymization`, or `legalHold` directly
- Superadmin can read all requests
- `auditLog` subcollection: superadmin can read; citizen cannot read or write; service account writes
- Sentinel `erasure_active/{uid}`: citizen can read own; service account deletes

### Staging drills

- Submit erasure request → verify doc written first, then Auth disabled, sentinel created, status `pending_review`
- Approve request → verify `erasureSweep` picks it up within 15 min, all docs anonymized in order, Auth hard-deleted last, sentinel deleted, status `completed`
- Deny request → verify Auth re-enabled, sentinel deleted, status `denied`
- Set legal hold on approved request → verify sweep skips it; clear hold → verify sweep processes it on next run
- Force sweep failure (mock step 5) → verify dead-letter path fires, Auth re-enabled, sentinel cleaned up
- Force sweep failure + Auth re-enable failure → verify CRITICAL alert fires at distinct severity
- Retention 1-week drill: seed unverified report with `submittedAt` > 7 days ago, run sweep, verify PII nulled and `retentionHardDeleteEligibleAt` set
- Retention 1-month drill: seed report with `retentionHardDeleteEligibleAt` in the past, run sweep, verify hard-delete and audit log doc written

---

## Exit Criteria

Phase 8C is complete when all of the following are true:

- `requestDataErasure` callable deployed; sentinel-based idempotency tested; doc-before-Auth order verified; rollback tested
- `approveErasureRequest` deny path re-enables Auth with transaction gate and rollback discipline; concurrent approve+deny race tested
- `setErasureLegalHold` callable deployed; sweep skip verified; superadmin + MFA gate tested
- `erasureSweep` deployed; sequential claim verified (no bulk claiming); approved requests processed within 15 min in staging; all doc classes anonymized in correct order; Auth deleted last; sentinel deleted; legal hold skip tested; dead-letter path tested
- `retentionSweep` deployed; 1-week anonymize and 1-month hard-delete verified in staging; active erasure skip confirmed via in-memory check test
- Firestore rules for `erasure_requests`, `auditLog` subcollection, and `erasure_active` sentinel deployed and rules tests pass
- Storage rules deployed; unauthenticated reads denied; citizen read-own-blobs verified
- Citizen PWA delete-account flow tested end-to-end in staging browser
- Pseudonymous erasure gap documented in `docs/progress.md` as a named production launch blocker with RA 10173 §16 compliance risk
- `docs/learnings.md` updated with Phase 8C decisions
- `docs/progress.md` updated with Phase 8C status
