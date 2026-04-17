# Phase 3 Design: End-to-End Thin Slice — Citizen → Admin → Responder

**Date:** 2026-04-18
**Status:** Proposed, validated in-session
**Depends on:** Phase 2 complete (data model + rules + schema + 94 tests passing)
**Source documents:** `prd/bantayog-alert-prd-v1.0.md`, `prd/bantayog-alert-implementation-plan-v1.0.md`, `prd/bantayog-alert-architecture-spec-v8.md`

---

## 1. Goal

Animate the Phase 2 data model with behavior. One simulated citizen in Daet submits a report on the web PWA. A Daet municipal admin verifies it and dispatches a BFP responder. The responder accepts, progresses through field status transitions, and resolves. The admin closes the report. The full triptych lifecycle, dispatch state machine, and event audit chain complete end-to-end in staging.

This phase is the highest-risk in the pilot program because it is the first time the whole stack stands up together. Every phase after widens this slice.

---

## 2. Scope Boundary

### 2.1 Unified design, separate implementation plans

Phase 3 is specified as one coherent design because the state machines, triptych, callables, and three surfaces are deeply coupled. Execution is chunked into three sub-phases, each with its own implementation plan written from this spec. Each sub-phase has a demonstrable exit milestone.

### 2.2 Thin-slice inclusions

- Citizen PWA: single-page submission form (text, severity, description, optional photo with GPS) plus tracking-reference lookup screen
- Media upload via signed URL + `onFinalize` trigger (EXIF strip, MIME magic-byte verify)
- `processInboxItem` trigger + `inboxReconciliationSweep` + `minInstances: 3`
- Triptych materialization (`reports` + `report_private` + `report_ops`) inside one Firestore transaction
- Append-only `report_events` and `dispatch_events` streams
- Admin Desktop bare-bones: authenticated list of `awaiting_verify` reports in admin's municipality, side-panel detail, Verify / Reject / Dispatch actions
- Callables: `verifyReport`, `rejectReport`, `dispatchResponder`, `cancelDispatch`, `acceptDispatch`, `closeReport`, `requestUploadUrl`, `requestLookup`
- Responder PWA (plain web; Capacitor config scaffolded but not built): own-dispatches list, FCM web-push receipt, accept/decline, status transitions through `acknowledged → en_route → on_scene → resolved`
- Report state machine wired at rule + callable layer for all 15 states defined in Arch Spec §5.3 (transitions in scope happen; unused transitions are rule-rejected)
- Dispatch state machine wired for all 9 states (§5.4)
- Race-loss recovery: responder direct-write rejected when admin cancel commits first; client shows "cancelled by [institutional label]" screen
- Shared transition tables in `packages/shared-validators` consumed by both callables and Firestore rules (rules via codegen)
- Playwright E2E full-loop test running against emulator (every PR) and staging (release candidate)
- Phase-exit acceptance scripts: one per sub-phase, executable via `firebase emulators:exec`
- Minimum observability: correlation ID threading, structured logs, four-panel Cloud Monitoring dashboard with alerts

### 2.3 Deferred to later phases

| Item                                                               | Owning phase | Why                                                                                                                |
| ------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Merge reports / duplicate clustering                               | 5            | Requires surge triage + duplicate detection surface                                                                |
| Dispatch timeout sweep                                             | 5            | Requires severity-tuned defaults + agency override                                                                 |
| Cancel-report and reopen-report callables                          | 5            | Separate admin workflow; out of thin-slice                                                                         |
| Admin triage filters, sort, search, keyboard shortcuts, surge mode | 5            | Widening the slice                                                                                                 |
| Shift handoff (active-incident snapshot + receiving-admin ack)     | 5            | Coordination surface; needs multi-admin state and active-incident materializer                                     |
| Admin-to-reporter in-report messaging                              | 4            | Citizen comms channel lives in SMS layer; in-app messaging piggybacks on SMS outbound                              |
| Citizen status-change push notifications (FCM)                     | 4            | Bundled with SMS status updates; Phase 3 citizen path is pull-only via `requestLookup` — documented degraded UX    |
| Responder field notes (free-text observations on a dispatch)       | 6            | Responder feature surface; requires note subcollection + moderation path                                           |
| Responder location telemetry (own-agency full + cross-agency grid) | 6            | Requires Capacitor background location + RTDB projection pipeline; Phase 3 dispatch modal shows name + agency only |
| `submitResponderWitnessedReport` callable + UI                     | 6            | Responder feature, not loop                                                                                        |
| Responder offline persistence, battery-aware telemetry, geofence   | 6            | Capacitor-native scope                                                                                             |
| Citizen offline drafts, localForage, SMS status                    | 4            | SMS layer                                                                                                          |
| SMS outbound on status changes                                     | 4            | SMS layer                                                                                                          |
| Audit streaming to BigQuery                                        | 7            | Superadmin phase                                                                                                   |
| NDRRMC escalation, break-glass, full MFA                           | 7            | Superadmin phase                                                                                                   |
| Hazard zone auto-tag at ingest                                     | 10           | Hazard feature                                                                                                     |
| k6 surge tests, circuit breakers, PAGASA signal ingest             | 8            | Surge readiness                                                                                                    |
| Apple TestFlight / native Capacitor build                          | 6            | Native wrap                                                                                                        |

### 2.4 Forward-compat posture

Rules written in Phase 3 must remain valid (or already-permissive) for paths that later phases activate. In particular:

- Triptych `create` rules must admit `source == 'responder_witness'` writes by responders with correct claims, even though the callable ships in Phase 6. Negative tests cover rejection by non-responders.
- `system_config/features/media_canonical_migration.enabled` is a dormant flag read by the pre-wired `onMediaRelocate` trigger. Default `false`; Phase 5 flips it.

---

## 3. Architecture and Sub-Phase Structure

### 3.1 The spine

```
Citizen PWA ──────────────► report_inbox ────► processInboxItem (trigger)
  (form + photo)                                  │
                                                  │ transaction
                                                  ▼
                                   reports + report_private + report_ops
                                   + report_events (append) + report_lookup
                                                  │
                                                  ▼
            ┌─────────────── Admin Desktop ◄──────┘ (onSnapshot, muni-scoped)
            │
            │ verifyReport / rejectReport / dispatchResponder (callable)
            │
            ▼
       dispatches/{id} ────► FCM push ────► Responder PWA
                                                  │
                                                  │ acceptDispatch (callable, race-safe)
                                                  │ then direct writes for subsequent states
                                                  ▼
                             acknowledged → en_route → on_scene → resolved
                                                  │
                                                  │ (rules-gated by transition table;
                                                  │  dispatch-mirror trigger propagates
                                                  │  status onto reports)
                                                  ▼
                                 Admin Desktop closes via closeReport callable
```

### 3.2 Surface responsibilities

| Surface                  | Path                                                          | Phase 3 role                                                                                                  |
| ------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Citizen PWA              | `apps/citizen-pwa`                                            | Write-only to `report_inbox`; reads its own tracking ref via `requestLookup`. No privileged data on the wire. |
| Admin Desktop            | `apps/admin-desktop`                                          | Reads muni-scoped reports + dispatches via `onSnapshot`; all writes through callables.                        |
| Responder PWA            | `apps/responder-app` (Capacitor config scaffolded, not built) | Reads own dispatches; receives FCM; accept via callable; subsequent status via rule-gated direct writes.      |
| Cloud Functions          | `functions/src`                                               | Triggers, scheduled sweeps, callables.                                                                        |
| Shared transition tables | `packages/shared-validators/src/state-machines`               | Source of truth for client UI gating and Firestore rules.                                                     |

### 3.3 Sub-phases

**3a — Citizen submission + triptych materialization.**
Exit milestone: a real citizen submission from the web PWA lands as a correct triptych in staging, with event log, lookup reference, and pending media reference. No admin UI.

**3b — Admin triage + dispatch.**
Exit milestone: admin can verify + dispatch a real report; dispatch is persisted correctly; cross-muni dispatch is rejected; responder can see the dispatch via `onSnapshot` (no FCM yet).

**3c — Responder loop + E2E.**
Exit milestone: FCM reaches the responder; full loop passes Playwright in staging on 3 consecutive runs; race-loss recovery verified; all Phase 3 exit-checklist items (§10) green.

---

## 4. Shared Transition Tables and Callables Catalog

### 4.1 Source-of-truth location

```
packages/shared-validators/src/state-machines/
  report-states.ts       # ReportStatus union, REPORT_TRANSITIONS, isValidReportTransition()
  dispatch-states.ts     # DispatchStatus union, DISPATCH_TRANSITIONS, isValidDispatchTransition()
  index.ts
```

Codegen emits a `.rules.inc` fragment from the TS tables. A `firebase.json` `predeploy` hook runs `pnpm tsx scripts/build-rules.ts`, concatenating the fragment into `firestore.rules` before any `firebase deploy --only firestore:rules` step. CI also runs the script and fails if `firestore.rules` differs post-build, preventing the "forgot to regenerate" class of bug.

Firestore rules DSL has no native include; the rules file is therefore a build artifact, not source. The build script is the only approved path to produce it.

### 4.2 Report state transitions in Phase 3

Fifteen states total per Arch Spec §5.3. Phase 3 exercises the happy-path subset; other transitions remain rule-rejected.

| From              | To                       | Actor                | Write path                                           | In Phase 3? |
| ----------------- | ------------------------ | -------------------- | ---------------------------------------------------- | ----------- |
| —                 | `draft_inbox`            | Citizen              | Direct to `report_inbox`                             | 3a          |
| `draft_inbox`     | `new`                    | System trigger       | `processInboxItem`                                   | 3a          |
| `new`             | `awaiting_verify`        | Municipal Admin      | `verifyReport` callable (branch 1)                   | 3b          |
| `awaiting_verify` | `verified`               | Municipal Admin      | `verifyReport` callable (branch 2)                   | 3b          |
| `awaiting_verify` | `cancelled_false_report` | Municipal Admin      | `rejectReport` callable                              | 3b          |
| `verified`        | `assigned`               | Municipal Admin      | `dispatchResponder` callable                         | 3b          |
| `assigned`        | `acknowledged`           | Responder            | Direct, rule-gated (via dispatch mirror)             | 3c          |
| `acknowledged`    | `en_route`               | Responder            | Direct, rule-gated                                   | 3c          |
| `en_route`        | `on_scene`               | Responder            | Direct, rule-gated                                   | 3c          |
| `on_scene`        | `resolved`               | Responder            | Direct, rule-gated                                   | 3c          |
| `resolved`        | `closed`                 | Municipal Admin      | `closeReport` callable                               | 3c          |
| `draft_inbox`     | `rejected`               | Trigger (moderation) | Deferred → Phase 5                                   | —           |
| Any               | `merged_as_duplicate`    | Admin                | Deferred → Phase 5                                   | —           |
| `closed`          | `reopened`               | Admin                | Out of scope                                         | —           |
| Any active        | `cancelled`              | Admin                | Out of scope (dispatch-level cancel only in Phase 3) | —           |

**`verifyReport` behavior.** The callable observes `reports.status` inside its transaction and branches:

- If `new`: transitions to `awaiting_verify`; logs `report_events` with `{from:'new', to:'awaiting_verify'}`.
- If `awaiting_verify`: transitions to `verified`; writes `verifiedBy` and `verifiedAt`; logs `report_events` with `{from:'awaiting_verify', to:'verified'}`.
- Otherwise: returns `FAILED_PRECONDITION`.

Event log records the actual transition, not the callable name. A Phase 5 surge UI that splits the button can consume the same callable and same events.

### 4.3 Dispatch state transitions in Phase 3

Nine states total per Arch Spec §5.4.

| From                                      | To             | Actor           | Write path                            | In Phase 3? |
| ----------------------------------------- | -------------- | --------------- | ------------------------------------- | ----------- |
| —                                         | `pending`      | Admin           | `dispatchResponder` callable          | 3b          |
| `pending`                                 | `accepted`     | Responder       | `acceptDispatch` callable (race-safe) | 3c          |
| `pending`                                 | `declined`     | Responder       | Direct, rule-gated                    | 3c          |
| `pending`                                 | `cancelled`    | Admin           | `cancelDispatch` callable             | 3b          |
| `accepted`                                | `acknowledged` | Responder       | Direct, rule-gated                    | 3c          |
| `acknowledged`                            | `in_progress`  | Responder       | Direct, rule-gated                    | 3c          |
| `in_progress`                             | `resolved`     | Responder       | Direct, rule-gated                    | 3c          |
| `accepted \| acknowledged \| in_progress` | `cancelled`    | Admin           | `cancelDispatch` callable             | 3c          |
| `pending`                                 | `timed_out`    | Scheduled sweep | Deferred → Phase 5                    | —           |
| Any terminal                              | `superseded`   | Re-dispatch     | Deferred → Phase 5                    | —           |

### 4.4 Callables catalog

| Callable            | Sub-phase | Auth                                                         | Transaction scope                                                                                  | Idempotency key                             |
| ------------------- | --------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `requestUploadUrl`  | 3a        | Citizen (App Check required)                                 | Stateless; returns signed URL valid 5 min                                                          | N/A (URL is the idempotency)                |
| `requestLookup`     | 3a        | Any (rate-limited per publicRef)                             | Read-only; returns sanitized status                                                                | N/A                                         |
| `verifyReport`      | 3b        | Muni Admin or Superadmin (`isActivePrivileged` + muni scope) | `reports` + `report_ops` + `report_events`                                                         | `(reportId, 'verify', actorUid)`            |
| `rejectReport`      | 3b        | Muni Admin or Superadmin                                     | `reports` + `report_ops` + `report_events` + `moderation_incidents`                                | `(reportId, 'reject', actorUid)`            |
| `dispatchResponder` | 3b        | Muni Admin                                                   | `reports` + `dispatches` + `report_events` + `dispatch_events`                                     | `(reportId, responderUid, 'dispatch')`      |
| `cancelDispatch`    | 3b → 3c   | Muni Admin                                                   | `dispatches` + `dispatch_events` (+ `reports` if last dispatch and admin-cancelled while assigned) | `(dispatchId, 'cancel', actorUid)`          |
| `acceptDispatch`    | 3c        | Responder (matching `assignedTo.uid`)                        | `dispatches` + `dispatch_events`                                                                   | `(dispatchId, 'accept')` (from-state guard) |
| `closeReport`       | 3c        | Muni Admin                                                   | `reports` + `report_ops` + `report_events`                                                         | `(reportId, 'close', actorUid)`             |

All callables accept an explicit client-generated `idempotencyKey` argument (UUID v4) in addition to the semantic key above. Phase 2's `withIdempotency` helper handles the dedup-table-first pattern.

### 4.5 Triggers catalog

| Trigger                    | Sub-phase    | Event                                   | Responsibility                                                                          |
| -------------------------- | ------------ | --------------------------------------- | --------------------------------------------------------------------------------------- |
| `processInboxItem`         | 3a           | `onCreate(report_inbox/{inboxId})`      | Validate, dedup-check, materialize triptych + events + lookup in one transaction        |
| `onMediaFinalize`          | 3a           | Storage `onFinalize` on `reports/` path | MIME verify, EXIF strip, register to `reports/{id}/media/{mediaId}` by `uploadId`       |
| `onMediaRelocate`          | 3a (dormant) | Storage `onFinalize` with feature flag  | Pre-wired migration from `pending/` to `reports/{id}/{mediaId}`; disabled until Phase 5 |
| `inboxReconciliationSweep` | 3a           | Scheduled every 5 min                   | Pick up `report_inbox` items older than 2 min without `processedAt`; retry idempotently |
| `dispatchMirrorToReport`   | 3c           | `onWrite(dispatches/{id})`              | Mirror dispatch status onto linked `reports/{reportId}` via same transition table       |

### 4.6 Direct-write rule gating

For every rule-gated direct write (responder status transitions, responder decline), Firestore rules reference the generated transition table:

```
function isValidDispatchTransition(from, to) {
  return from in DISPATCH_TRANSITIONS && to in DISPATCH_TRANSITIONS[from];
}

match /dispatches/{id} {
  allow update: if isResponder()
    && resource.data.assignedTo.uid == request.auth.uid
    && isValidDispatchTransition(resource.data.status, request.resource.data.status)
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['status','lastStatusAt','statusReason']);
}
```

The `DISPATCH_TRANSITIONS` object is inlined by codegen. Same mechanism for `REPORT_TRANSITIONS`.

### 4.7 Phase 2 schema deltas required before 3a

Small, targeted schema additions land in `packages/shared-validators` as the first commit of 3a (before any callable or trigger work):

- `ReportSchema`: add `municipalityLabel: z.string().min(1).max(64)` — denormalized at materialization from the `municipalities` lookup. Rationale in §5.3 / §5.4; avoids per-lookup join on `requestLookup` and sidesteps exposing `municipalityId` semantics to non-admin callers.
- `ReportSchema`: add `correlationId: z.string().uuid()` — per the denormalization decision in §9.1.
- `ReportInboxSchema`: add `publicRef: z.string().regex(/^[a-z0-9]{8}$/)`, `secretHash: z.string().regex(/^[a-f0-9]{64}$/)`, `correlationId: z.string().uuid()`.
- `MunicipalitySchema` (new if not already in Phase 2): `{ id, label, provinceId, centroid }`. Seeded once via bootstrap script for the 12 Camarines Norte municipalities.

Each delta is a `.strict()` additive change; the Phase 2 rule-coverage gate re-runs as part of the 3a PR.

---

## 5. Data Flow Walkthrough

Tracing one happy-path report. This is the reference for reviewing rules, callables, and triggers together.

### 5.1 Citizen submits (3a)

1. Citizen PWA form captures `type`, `severity` (defaults `auto`, parser resolves on keywords; citizen can override), `description`, optional photo, GPS with precision banner.
2. If photo: client calls `requestUploadUrl({mimeType, sizeBytes, sha256})`, receives signed PUT URL valid 5 minutes scoped to `gs://bantayog-media-{env}/pending/{uploadId}`, PUTs directly to Storage.
3. Client generates `publicRef` (8-char base32) and `secret` (UUID v4) locally; shows them on the submit-receipt screen immediately.
4. Client writes `report_inbox/{inboxId}` with `reporterUid`, `source: 'citizen_pwa'`, payload, `pendingMediaIds`, `submittedAt`, `correlationId`, `idempotencyKey`, `publicRef`, `secretHash` (SHA-256 of secret), `appCheckPassed`.
5. Phase 2 rules admit the write (authenticated + schema-valid + `reporterUid == request.auth.uid` + rate limits). Rule additionally enforces `publicRef` matches `^[a-z0-9]{8}$` and `secretHash` is a 64-char hex.
6. `processInboxItem` writes `report_lookup/{publicRef}` inside its transaction. If `publicRef` collides (astronomically rare), the transaction aborts, the inbox item is flagged `rejected_collision`, and the client sees `FAILED_PRECONDITION` on next lookup attempt with a retry-submit hint.

### 5.2 Storage onFinalize (3a)

1. `onMediaFinalize` fires on the new object.
2. Validates MIME magic bytes via file-signature inspection.
3. Strips EXIF (GPS, serial, software tags) via `exifr` + re-encode via `sharp`.
4. Registers a `media` subcollection entry under `reports/{reportId}/media/{mediaId}` keyed by `uploadId`. Because `reportId` may not yet exist (race with `processInboxItem`), the trigger writes into a holding `pending_media/{uploadId}` doc keyed by `inboxId`, and `processInboxItem` moves the reference into `reports/{reportId}/media` inside its transaction.
5. Object stays in `gs://.../pending/{uploadId}` for Phase 3. `onMediaRelocate` is wired but disabled.

### 5.3 processInboxItem runs (3a)

1. Zod validate against `ReportInboxSchema`. Invalid → write `moderation_incidents/{inboxId}`; do not materialize.
2. Check `idempotency_keys/{key}` via Phase 2 helper. `ALREADY_SUCCESS` → noop. `ALREADY_PROCESSING` → abort (sweep will retry).
3. Reverse-geocode coordinates to `municipalityId` and barangay. Failure (out of jurisdiction) → `moderation_incidents` with `reason: 'out_of_jurisdiction'`; do not materialize. Resolve `municipalityLabel` via an in-memory map keyed by `municipalityId` (loaded once per function instance from `municipalities` collection at cold start; 12 entries for Camarines Norte).
4. Transaction (single Firestore transaction):
   - Write `reports/{reportId}` with `status: 'new'`, `municipalityId`, `municipalityLabel` (denormalized from step 3), `source`, `severityDerived`, `correlationId`, `createdAt`.
   - Write `report_private/{reportId}` with `reporterUid`, `rawDescription`, `coordinatesPrecise`.
   - Write `report_ops/{reportId}` with `verifyQueuePriority`, `assignedMunicipalityAdmins: []`.
   - Append `report_events/{eventId}`: `{from: 'draft_inbox', to: 'new', actor: 'system:processInboxItem', at, correlationId}`.
   - Write `report_lookup/{publicRef}` with `{reportId, tokenHash: inbox.secretHash, expiresAt: +30 days}`. If `report_lookup/{publicRef}` already exists with a different `reportId`, abort and flag the inbox item `rejected_collision`.
   - If `pending_media/{uploadId}` exists for this inbox: move reference into `reports/{reportId}/media/{mediaId}`.
   - Flip idempotency key to `ALREADY_SUCCESS`.
5. Outside transaction: mark `report_inbox/{inboxId}.processedAt`. Best-effort; a crash here is harmless (next sweep is a noop because the idempotency key already says SUCCESS).
6. Hazard auto-tag: deferred to Phase 10. `reports.hazardZoneIds` unset.

### 5.4 Citizen lookup (3a)

1. Citizen enters `publicRef + secret` on the lookup screen.
2. Client calls `requestLookup({publicRef, secret})`.
3. Callable: hash `secret`, compare against `tokenHash`, rate-limit (per-publicRef primary: 10 per hour; per-IP fallback: 100 per hour).
4. Returns sanitized `{status, lastStatusAt, municipalityLabel}` — `municipalityLabel` is read from the denormalized field on `reports` (see §5.3 step 3). No PII, no responder data.
5. Rules deny direct client reads of `report_lookup`. Rules deny direct client reads of `reports/{id}` by non-admin roles.

### 5.5 Admin triage (3b)

1. Muni admin signs in. Header badge reads the municipality from custom claim.
2. `onSnapshot` on `reports` filtered by `municipalityId == claim.municipalityId` AND `status in ['new','awaiting_verify']`. Phase 2 index covers this.
3. Admin opens a row → side panel reads triptych scoped to role (`reports` + `report_ops` readable; `report_private` denied at rule level).
4. Admin clicks **Verify** → `verifyReport({reportId, idempotencyKey})`.
5. Callable observes current state and advances one step (`new → awaiting_verify` or `awaiting_verify → verified`), writes event, commits.
6. Second click advances to `verified`.
7. Admin can click **Reject** (only when `awaiting_verify`) → `rejectReport`. Transitions to `cancelled_false_report` + writes `moderation_incidents`.

### 5.6 Admin dispatches (3b)

1. Admin sees `status: 'verified'` → clicks **Dispatch**.
2. Modal shows eligible responders (filtered by `municipalityId`, `isOnShift: true`) read from `responders` + RTDB minimal shift flag. **Phase 3 fidelity: name + agency only.** No map pin, no real-time location, no distance/ETA calculation. Responder location telemetry (own-agency full + cross-agency grid projection per Arch Spec §6) is deferred to Phase 6 when Capacitor background location lands.
3. Admin selects a responder → `dispatchResponder({reportId, responderUid, idempotencyKey})`.
4. Callable transaction: verify report `status == 'verified'`; verify responder eligible; create `dispatches/{dispatchId}` with `status: 'pending'`, `assignedTo: {uid, agencyId, municipalityId}`, `acknowledgementDeadlineAt` (severity-based defaults per Arch Spec §5.4); transition report to `assigned`; log both event streams.
5. FCM fires in 3c; in 3b the responder sees the dispatch only via `onSnapshot`.

### 5.7 Responder accepts (3c)

1. Service worker receives FCM push → notification → tap opens responder PWA at `/dispatches/{id}`.
2. Responder taps **Accept** → `acceptDispatch({dispatchId, idempotencyKey})`.
3. Callable transaction: read `dispatches/{dispatchId}` fresh; assert `status == 'pending'` AND `assignedTo.uid == caller`.
4. Writes `status: 'accepted'`, logs event. If race lost (another responder won, or admin cancelled): returns `ALREADY_EXISTS` with current state.

### 5.8 Responder progresses (3c)

Direct writes on `dispatches/{id}`, rule-gated by the transition table:

- `accepted → acknowledged` (auto-advances on accept screen render)
- `acknowledged → en_route` (user taps "Heading there")
- `en_route → on_scene` (user taps "Arrived")
- `on_scene → resolved` with required `resolutionSummary`

Each write fires `dispatchMirrorToReport` which appends `dispatch_events` and mirrors `reports.status` via the report transition table. The mirror trigger is the only path that updates `reports.status` from responder actions — keeps `reports` single-writer and audit simple.

### 5.9 Admin closes (3c)

1. Admin sees `reports.status: 'resolved'` → clicks **Close**.
2. `closeReport({reportId, idempotencyKey})` transitions `resolved → closed`.
3. Rule: post-`closed`, report `update` denied for Phase 3 (reopen is out of scope).
4. SMS closure to reporter deferred to Phase 4.

### 5.10 Citizen notification path in Phase 3 — pull only

Explicit degraded UX: the citizen receives no proactive notification of status changes during Phase 3. After submission they see the receipt screen with `publicRef + secret`; to check status, they must return to the lookup screen and call `requestLookup` manually. Both push (FCM) and SMS status updates are deferred to Phase 4 and implemented together (see §2.3). Citizen PWA copy on the receipt screen calls this out: "We'll notify you when we can; for now, check back with your reference number."

---

## 6. Error Handling, Idempotency, Reconciliation, Race Loss

### 6.1 processInboxItem failure modes

| Failure                                     | Recovery                                                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Cold start > transaction deadline           | `inboxReconciliationSweep` picks up any `report_inbox/{id}` older than 2 min without `processedAt`; calls the same core idempotently |
| Zod validation fails                        | Write `moderation_incidents/{inboxId}`; mark inbox `status: 'rejected_schema'`                                                       |
| Reverse-geocode fails                       | `moderation_incidents` with `reason: 'out_of_jurisdiction'`                                                                          |
| Transaction contention                      | Auto-retry up to 5 times; if exhausted, back to sweep queue                                                                          |
| Idempotency key stuck `PROCESSING` > 10 min | Sweep treats as eligible for retry                                                                                                   |

Idempotency key for `processInboxItem` is `(inboxId)`. Running twice produces exactly one triptych.

### 6.2 inboxReconciliationSweep behavior

Scheduled every 5 minutes:

```
1. Query report_inbox where processedAt == null AND submittedAt < now - 2min
2. For each (max 100 per run):
    a. Call processInboxItemCore(inboxId)
    b. Success → structured log with correlationId
    c. Fail-again → attemptCount++; if > 5 → dead_letters/{inboxId} + alert
```

**Alert thresholds:**

- Staging: every sweep-caught item produces a warning log; 5-min suppression prevents spam.
- Prod: page on `count > 3 in a single run` OR `oldestItemAge > 15 min`.

### 6.3 Callable error shapes

Typed `BantayogError` with stable `code`. Clients match `code` only.

| Code                  | When                                                         | Client UX                                                |
| --------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| `FAILED_PRECONDITION` | State transition invalid                                     | Refresh; "this report has already been verified"         |
| `PERMISSION_DENIED`   | Auth or scope wrong                                          | Re-auth or "not your municipality"                       |
| `ALREADY_EXISTS`      | Idempotency hit with different payload OR lost dispatch race | Show current state; don't retry                          |
| `RESOURCE_EXHAUSTED`  | Rate limit                                                   | Retry-after banner                                       |
| `NOT_FOUND`           | Target document absent                                       | Refresh                                                  |
| `UNAUTHENTICATED`     | No auth                                                      | Redirect to login                                        |
| `INTERNAL`            | Unexpected                                                   | "Something went wrong — your action was not saved" + log |

Never `INVALID_ARGUMENT` unless payload is malformed. Bad state is always `FAILED_PRECONDITION`.

Error enum + `BantayogError` class live in `packages/shared-validators/src/errors.ts`.

### 6.4 Race-loss recovery — responder vs admin

Arch Spec §5.4 pilot blocker. Phase 3 ships a functional version; Phase 6 polishes.

- Admin path always wins: `cancelDispatch` callable reads fresh state in transaction and commits the cancel.
- Responder's in-flight direct write (e.g., `in_progress → resolved`) is rejected by rule (from-state mismatch).
- Client handling: on `permission-denied` for a dispatch status write, responder PWA re-fetches the dispatch. If `status == 'cancelled'`, screen replaces with "This dispatch was cancelled by Daet MDRRMO" + reason.
- Phase 3 Playwright scenario in 3c exercises this path.

### 6.5 FCM delivery failures

FCM is best-effort. Dispatches are always visible via `onSnapshot`; the push is a speed optimization.

| Failure                 | Handling                                                |
| ----------------------- | ------------------------------------------------------- |
| No registration token   | Callable returns `{result, warnings: ['fcm_no_token']}` |
| Token expired / invalid | Remove from `responders/{uid}.fcmTokens`; warn          |
| FCM network error       | Retry once; then warn                                   |

Callables never fail on FCM failure. Dispatch is Firestore truth; push is a notification. The `warnings` array surfaces to the admin UI as a non-blocking banner.

### 6.6 Idempotency — client responsibility

Every client-initiated callable takes an explicit `idempotencyKey: string` generated by the client. The client stores the key in memory for 30 seconds; double-tap reuses it; callable returns cached result on the second hit. Without this, a flaky-network retry can create two dispatches for one admin click.

### 6.7 Transaction boundary discipline

**Inside transaction:** primary document writes + event-log writes. Event log is audit truth and must match state exactly.

**Outside transaction:** FCM send, outbound SMS queueing, BigQuery audit streaming, analytics. Fire-and-forget. Never block transaction success.

---

## 7. Performance Budgets and API Limits

Phase 3 operates pre-surge. Budgets here are the floor; Phase 8 validates them under load.

### 7.1 Cloud Functions configuration

| Function                   | Min instances | Max instances       | Timeout | Memory                       |
| -------------------------- | ------------- | ------------------- | ------- | ---------------------------- |
| `processInboxItem`         | 3             | 100                 | 30s     | 512 MiB                      |
| `onMediaFinalize`          | 1             | 50                  | 60s     | 1 GiB (sharp needs headroom) |
| `inboxReconciliationSweep` | 0 (scheduled) | 1 (single-instance) | 9 min   | 256 MiB                      |
| `dispatchMirrorToReport`   | 1             | 50                  | 10s     | 256 MiB                      |
| All callables              | 1             | 100                 | 10s     | 512 MiB                      |

### 7.2 Rate limits per callable (Phase 3 ceiling)

| Callable            | Per-actor limit           | Per-IP limit    | Purpose                                          |
| ------------------- | ------------------------- | --------------- | ------------------------------------------------ |
| `requestUploadUrl`  | 20 / hour                 | 100 / hour      | Prevents signed-URL enumeration                  |
| `requestLookup`     | 10 / publicRef / hour     | 100 / IP / hour | Brute-force resistance                           |
| `verifyReport`      | 60 / minute per admin     | —               | Allows fast triage; surge pace raised in Phase 5 |
| `rejectReport`      | 60 / minute per admin     | —               | Same as verify                                   |
| `dispatchResponder` | 30 / minute per admin     | —               | Dispatch is higher-stakes; lower ceiling         |
| `cancelDispatch`    | 30 / minute per admin     | —               |                                                  |
| `acceptDispatch`    | 30 / minute per responder | —               | Responder typically handles 1 at a time          |
| `closeReport`       | 60 / minute per admin     | —               |                                                  |

Rate limits read from Phase 1's `rate_limits/{key}` collection. A breach returns `RESOURCE_EXHAUSTED` with `retryAfterSeconds`.

### 7.3 Firestore read/write budget per report lifecycle

Rough ceiling for a single happy-path report:

| Path                                              | Reads            | Writes                           |
| ------------------------------------------------- | ---------------- | -------------------------------- |
| Inbox write                                       | 0                | 1                                |
| processInboxItem                                  | ~3               | 5 (triptych + event + lookup)    |
| Admin sees report (onSnapshot over a queue of 50) | ~50 (with cache) | 0                                |
| Verify (2 calls)                                  | 2 × 2            | 2 × 3                            |
| Dispatch                                          | 3                | 4 (dispatch + report + 2 events) |
| Responder onSnapshot                              | 1                | 0                                |
| Accept + progress (4 writes)                      | 4                | 4 × 2 (doc + event)              |
| Close                                             | 2                | 3                                |

Roughly **~70 reads, ~25 writes per happy-path report.** At 500 reports/hour during surge, this is ~12 reads/s and ~4 writes/s across Firestore — well inside free-tier comfort. The real risk is `onSnapshot` amplification under 100 admins and the `isActivePrivileged` rule function's `get()` on every privileged write; both flagged for Phase 8 measurement.

### 7.4 Storage upload ceilings

- Max photo size per upload: 10 MiB (matches Arch Spec §10.6).
- Max photos per report: 3.
- Signed URL TTL: 5 minutes.
- MIME whitelist: `image/jpeg`, `image/png`, `image/webp`.

### 7.5 FCM message payload

- Max payload: 4 KB (FCM platform limit).
- Collapse key: `dispatch-{dispatchId}` (multiple pushes for the same dispatch collapse).
- Priority: `high` for initial dispatch; `normal` for status updates.

---

## 8. Testing Strategy

### 8.1 Test layers

| Layer                      | Tool                                    | Target                                                                                      | Runs where                     | Gate         |
| -------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------ | ------------ |
| Unit — pure                | Vitest                                  | Transition tables, error constructors, validators                                           | Node in-memory                 | Every PR     |
| Unit — callable with mocks | Vitest + `firebase-functions-test`      | Callable happy + error paths                                                                | Node in-memory                 | Every PR     |
| Integration — rules        | Vitest + `@firebase/rules-unit-testing` | All new paths (positive + negative)                                                         | Firestore Emulator             | Every PR     |
| Integration — triggers     | Vitest + emulator                       | `processInboxItem`, `onMediaFinalize`, `inboxReconciliationSweep`, `dispatchMirrorToReport` | Firestore + Storage Emulator   | Every PR     |
| E2E                        | Playwright                              | Full citizen → admin → responder loop                                                       | Emulator (PR) and Staging (RC) | PR + release |
| Acceptance                 | TS script via `firebase emulators:exec` | Phase-exit 3a / 3b / 3c gates                                                               | Emulator (dev), Staging (RC)   | Release gate |

### 8.2 Coverage targets

| Kind                     | Target                                                                       | Enforced                                                            |
| ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| New callable happy path  | 100%                                                                         | CI fails if any new callable lacks a test                           |
| New callable error paths | ≥ 1 test per returnable typed code                                           | CI grep gate (throws `FAILED_PRECONDITION` → needs matching test)   |
| Rules: new paths         | 100% positive + 100% negative                                                | Phase 2 `check-rule-coverage.ts` extended to Phase 3 collections    |
| Transition table         | Every valid transition asserted; every invalid transition asserted to reject | Property-based matrix test (~225 tests for 15 states; runs in < 2s) |
| UI component logic       | No explicit target; smoke-covered by Playwright                              | —                                                                   |

### 8.3 Phase-exit acceptance scripts

One per sub-phase at `scripts/phase-3*/acceptance.ts`. Each:

- Executable via `firebase emulators:exec`
- Binary pass/fail with structured JSON output
- Runnable against staging with `--env=staging` flag and pre-provisioned test accounts

**3a acceptance.** Seeds a test reporter, uploads a synthetic photo to signed URL, writes to `report_inbox`, waits up to 10s for triptych materialization. Asserts:

- `reports/{reportId}` exists with `status: 'new'`, `correlationId` present.
- `report_private/{reportId}` exists with `reporterUid` and `coordinatesPrecise`.
- `report_ops/{reportId}` exists.
- `report_events/{eventId}` has ≥ 1 entry with `from: 'draft_inbox', to: 'new'`.
- `report_lookup/{publicRef}` exists.
- `reports/{reportId}/media/{mediaId}` contains the pending media reference keyed by `uploadId` (verifies the `onMediaFinalize` path end-to-end without relying on the deferred canonical migration).
- `requestLookup(publicRef, secret)` returns sanitized status.
- Reconciliation scenario: disable trigger, write another inbox item, wait 5 min, assert sweep materializes it.

**3b acceptance.** 3a passes + admin signs in via emulator auth + verifyReport (twice, crossing both transition branches) + dispatchResponder. Asserts:

- `dispatches/{dispatchId}` exists with `status: 'pending'`.
- `reports/{reportId}.status == 'assigned'`.
- Both event streams have appended entries.
- Cross-muni negative: wrong-muni admin calls `verifyReport` → `PERMISSION_DENIED`.
- Cross-muni negative: admin dispatches a responder from another muni → `PERMISSION_DENIED`.

**3c acceptance.** 3b passes + responder accepts + progresses through `acknowledged → en_route → on_scene → resolved` + admin closes. Asserts:

- All state transitions reflected in both `dispatches` and `reports` via mirror trigger.
- Race-loss: admin `cancelDispatch` between `in_progress` and `resolved` → responder `permission-denied` → client re-fetches → state is `cancelled`.
- Full Playwright loop runs 3 consecutive times green.

### 8.4 Playwright strategy

Fresh `apps/e2e-tests/` workspace package. Playwright 1.47+. Specs: `citizen.spec.ts`, `admin.spec.ts`, `responder.spec.ts`, `full-loop.spec.ts`.

- Against emulator: fast (single-digit seconds), runs every PR. FCM mocked via service-worker injection using `page.evaluate()`.
- Against staging: slower (30s+ with real FCM), runs release-candidate tag only. Uses pre-provisioned test accounts (`citizen-test-01`, `daet-admin-test-01`, `bfp-responder-test-01`). Gates the 3c phase exit.
- **Not** on every merge to `main` — `main` gets emulator-only E2E to keep merge feedback fast.

**FCM testing caveat documented here:** web push on localhost is only possible via service worker + a real VAPID keypair. Staging uses the real FCM keypair from Secret Manager; emulator uses a fake keypair with a mock notification injector. A future engineer unaware of this will lose a day; the spec is the warning.

### 8.5 Test data factories

Extend Phase 2 factories in `packages/shared-validators/src/test-factories/`:

- `seedCitizenInboxItem(reporterUid, overrides)` → `{inboxId}`
- `seedVerifiedReport(municipalityId, overrides)` → `{reportId}` (bypasses inbox; sets triptych directly for mid-lifecycle tests)
- `seedDispatch(reportId, responderUid, overrides)` → `{dispatchId}`
- `seedResponderOnShift(uid, agencyId, municipalityId, overrides)` → `{uid}`
- `seedMunicipalAdmin(municipalityId, overrides)` → `{uid, customClaims}`

Factories are pure functions that schema-validate their output. A factory producing a doc that fails its own Zod schema is a test bug.

### 8.6 Flakiness budget

Phase 2 set the bar at "zero flaky tests across 20 consecutive runs." Phase 3 holds it. Known flake-prone patterns to avoid:

- `setTimeout` polling for eventual consistency — use `await` on callable response instead.
- Playwright race on `onSnapshot` updates — always `expect(locator).toHaveText(...)` with explicit timeout.
- FCM mock timing — `page.evaluate()` injects synchronously, not via timer.

### 8.7 What is not tested in Phase 3

- k6 load / surge (Phase 8)
- Battery / background behavior (Phase 6)
- Offline persistence (Phase 4)
- iOS Safari pre-16.4 web push (skipped)
- BigQuery audit streaming (Phase 7)

---

## 9. Observability

### 9.1 Correlation ID

Every request gets a `correlationId: string` (UUID v4) threading the entire pipeline:

- Citizen PWA generates on form submit, writes into `report_inbox.correlationId`.
- `processInboxItem` propagates onto `reports.correlationId` (denormalized for debugging ergonomics) and into every event entry.
- Callables generate a new correlationId per invocation and record `parentCorrelationId` when acting on an existing report.
- FCM payloads carry the dispatch's correlationId.
- Every structured log line includes `correlationId` as a top-level field.

One string in Cloud Logging returns the full journey of one report.

### 9.2 Structured logging

All Cloud Functions use `firebase-functions/logger` via a shared helper `logEvent({severity, event, correlationId, ...fields})` in `packages/shared-validators/src/logging.ts`.

Required fields:

- `severity` (`INFO | WARN | ERROR`)
- `event` (discriminated string enum: `inbox.received`, `inbox.processed`, `inbox.reconciliation`, `triptych.materialized`, `dispatch.created`, `dispatch.accepted`, `fcm.sent`, `fcm.failed`, etc.)
- `correlationId`
- `environment`

Optional domain fields: `reportId`, `dispatchId`, `municipalityId`, `actorUid`, `durationMs`.

No freeform strings. `"something happened with ${id}"` is dead weight when an operator searches.

### 9.3 Minimum dashboard

One Cloud Monitoring dashboard page, four panels, provisioned via Terraform in `infra/terraform/modules/monitoring/phase-3`:

| Panel               | Metric                                   | Source                          | Alert                                      |
| ------------------- | ---------------------------------------- | ------------------------------- | ------------------------------------------ |
| Inbox backlog       | `report_inbox where processedAt == null` | Firestore query (1 min cadence) | Prod: page if > 10 for > 5 min             |
| Dispatch rate       | Dispatches created in last 5 min         | Log metric `dispatch.created`   | None — informational                       |
| Function error rate | Error count / function / 5 min           | Log metric `severity: ERROR`    | Page if any function > 1% sustained 10 min |
| FCM failure rate    | `fcm.failed / (fcm.sent + fcm.failed)`   | Log metric                      | Warn at 10%, page at 25%                   |

Reconciliation sweep alert: two-dimension per §6.2. Prod pages on `count > 3 in a single run` OR `oldestItemAge > 15 min`. Staging warns per item with 5-min suppression.

### 9.4 Alerting routing

Phase 3 alerts land in a single Slack channel or email list via Cloud Monitoring notification channel.

- Page-level: ops channel + PagerDuty (if wired).
- Warn-level: ops channel only.

Per-role and audience-scoped routing arrives in Phase 7.

---

## 10. Exit Criteria for Phase 3

Before declaring Phase 3 done:

- [ ] `scripts/phase-3a/acceptance.ts` passes in staging.
- [ ] `scripts/phase-3b/acceptance.ts` passes in staging, including cross-muni negatives.
- [ ] `scripts/phase-3c/acceptance.ts` passes in staging, including race-loss recovery.
- [ ] Full Playwright loop passes in staging on 3 consecutive runs.
- [ ] Minimum dashboard shows live data for 24 continuous hours in staging.
- [ ] `inboxReconciliationSweep` has fired at least once during 24h staging soak (or been artificially triggered and its behavior verified).
- [ ] Rule-coverage CI gate extended to Phase 3 collections; 100% positive + negative coverage.
- [ ] Pre-deploy rules-concat script confirmed firing in deploy pipeline; CI drift-check gate green.
- [ ] `docs/progress.md` updated with Phase 3 verification results.
- [ ] `docs/learnings.md` updated with any new patterns discovered during implementation.
- [ ] Phase 3 PRs merged to `main`; staging tagged `phase-3-complete`.

---

## 11. Open Dependencies and Risks

### 11.1 Dependencies to confirm before 3a start

- **Real iOS + Android test devices** for FCM validation in 3c. Decision: responder is plain web PWA for Phase 3, so device is needed only for Playwright/FCM-on-mobile-browser smoke. Desktop browser covers most of the loop.
- **Apple Developer Account** — not required for Phase 3 (Capacitor config scaffolded only). Required for Phase 6.
- **BFP preliminary MOU** allowing a test responder account in staging. Real MOU not required.
- **Staging FCM VAPID keypair** in Secret Manager. If not already present, provision before 3c.
- **Cloud Monitoring API** enabled on staging project. Terraform diff will reveal.

### 11.2 Phase-specific risks

| Risk                                                                                          | Mitigation                                                                                                                           |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Rules codegen drift: engineer edits `firestore.rules` by hand, next build overwrites the edit | CI drift-check gate treats any post-build diff as failure; in-file comment header warns that the file is build-generated             |
| Transaction contention on `processInboxItem` under inbox bursts                               | `inboxReconciliationSweep` is the safety net; Phase 8 surge test validates the ceiling                                               |
| FCM web-push flakiness on iOS Safari                                                          | Documented as skipped; Phase 6 Capacitor native push is the production path                                                          |
| `reports.status` drift between mirror trigger and direct callables                            | Single transition table guards both paths; dispatch-mirror trigger is the only path mutating `reports.status` from responder actions |
| `requestLookup` brute-force                                                                   | Two-dimension rate limit (per-publicRef + per-IP); 30-day lookup TTL limits window                                                   |
| Admin Desktop keeps an old `verifyReport` idempotency key across sessions                     | Keys scoped to 30-second client memory; session reload generates fresh keys                                                          |

### 11.3 Forward-compat obligations recorded

- Triptych `create` rules admit `source == 'responder_witness'` for responders with correct claims (Phase 6 `submitResponderWitnessedReport`).
- `onMediaRelocate` trigger deployed and disabled; Phase 5 flips `system_config/features/media_canonical_migration.enabled`.
- `verifyReport` callable branches internally; Phase 5 surge-mode UI can split into two buttons without callable changes.

---

## 12. Sub-Phase Summary

| Sub-phase | Exit milestone                                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3a        | Real citizen submission lands as correct triptych + event + lookup + pending media reference. `scripts/phase-3a/acceptance.ts` green in staging. No admin UI.                |
| 3b        | Admin verifies + dispatches a real report; dispatch persisted; cross-muni denied. Responder sees dispatch via `onSnapshot` (no FCM). `scripts/phase-3b/acceptance.ts` green. |
| 3c        | Full loop green in staging; FCM delivery working; race-loss recovery verified. Playwright full-loop green 3 consecutive runs. Phase 3 exit checklist (§10) complete.         |

---

**End of Phase 3 Design**
