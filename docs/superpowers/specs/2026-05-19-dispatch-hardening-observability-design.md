# Admin Desktop Dispatch Hardening + Observability Dashboards

**Date:** 2026-05-19 (Revised after adversarial review)
**Status:** Draft — awaiting user review
**Scope:** Two independent features:

1. Three-app dispatch coordination hardening
2. Observability dashboards (in-app + external)

---

## 1. Context

### Current State (as of 2026-05-19)

The `dispatchResponder` callable exists and works for the happy path:

- Admin selects a report, clicks "Dispatch", picks a responder
- Backend writes `dispatches/{id}` doc, `dispatch_events` event, sends FCM push
- Responder sees push notification + Firestore subscription via `useOwnDispatches`
- Responder accepts via `acceptDispatch` or declines via `declineDispatch`

**What works:** Basic dispatch creation, FCM best-effort send, accept/decline with idempotency guards.

**What is broken / missing:**

1. **No deadline enforcement.** A `pending` dispatch can sit indefinitely. The `acknowledgementDeadlineAt` field exists but nothing checks it.
2. **No escalation when responder doesn't respond.** If the responder's phone is off, the dispatch silently stalls.
3. **No FCM delivery tracking.** Admin can't tell if the push was sent, delivered, or failed.
4. **No admin visibility after dispatch.** Once the admin clicks "Dispatch", the dispatch disappears from admin view. Admin has no idea if the responder accepted, declined, or never saw it.
5. **No observability dashboards.** The deferred Phase 11 dashboards (Ops, Backend, Compliance, Cost) do not exist.

### Why This Matters

In a real disaster, a firefighter's phone being off cannot be a silent failure. The admin needs to know within minutes, and the system needs to find the next responder automatically.

---

## 2. Goals

1. **Dispatch Coordination Hardening**
   - Enforce `acknowledgementDeadlineAt` with automatic escalation
   - Track FCM delivery status end-to-end (API attempted + device received)
   - Give admins real-time visibility into every dispatch lifecycle
   - Prevent runaway auto-escalation (escalate once automatically, then pause for admin)
   - Provide a kill switch and circuit breaker for the monitor

2. **Observability Dashboards**
   - In-app ops dashboard for real-time decision-making (response times, queue depth, responder availability) using Firestore listeners for live data
   - External dashboards for SLA compliance, cost, and audit (Cloud Monitoring + BigQuery)
   - Clear separation: in-app for decisions, external for reporting

---

## 3. Architecture

### 3.1 High-Level Flow (Hardened Dispatch)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Admin clicks │────▶│ dispatchResp.│────▶│ FCM push (best   │
│   "Dispatch"  │     │   callable   │     │    effort)       │
└──────────────┘     └──────────────┘     └──────────────────┘
                                                   │
                    ┌───────────────────────────────┘
                    ▼
           ┌──────────────┐     ┌──────────────┐
           │ Responder gets │────▶│   Accepts /  │
           │   push + F.S.│     │   Declines / │
           │   subscription│     │   Ignores    │
           └──────────────┘     └──────────────┘
                                          │
                    ┌─────────────────────┘
                    ▼
           ┌──────────────────────────┐
           │  monitorDispatchDeadlines   │ ◄── 1-min Cloud Schedule
           │   (scheduled function)     │
           │                            │
           │  • Replaces dispatchTimeout│
           │    Sweep entirely            │
           │  • Reads config doc first    │
           │    (kill switch, max batch) │
           │  • Finds past-deadline       │
           │    pending dispatches (LIMIT│
           │    50, with lease)          │
           │  • For each: single Firestore │
           │    transaction that updates  │
           │    assignedTo on SAME doc,   │
           │    increments escalationCount│
           │    (auto cap at 1)           │
           │  • If no candidate found or  │
           │    cap reached: status       │
           │    becomes 'needs_admin'     │
           │  • Batched FCM sends (500    │
           │    tokens per multicast)     │
           └──────────────────────────┘
                    │
                    ▼
           ┌──────────────────────────┐
           │  Admin Dispatch Monitor    │
           │  (new admin-desktop page)  │
           │                           │
           │  • Single Firestore        │
           │    listener on dispatches  │
           │    (not per-dispatch)      │
           │  • Single Firestore        │
           │    listener on             │
           │    dispatch_events scoped  │
           │    by municipality/agency  │
           │  • Real-time lifecycle rows│
           │  • "Re-dispatch" button    │
           │    for needs_admin state   │
           │  • Escalation history      │
           │    (who was notified when) │
           └──────────────────────────┘
```

### 3.2 Observability Separation

| Layer                   | Purpose                                  | Technology                                                     | Audience                                 |
| ----------------------- | ---------------------------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| **In-app Dashboards**   | Real-time ops decisions                  | Firestore subscriptions + React in admin-desktop               | Municipal admins, provincial superadmins |
| **External Dashboards** | SLA, compliance, cost, historical trends | Cloud Monitoring metrics + BigQuery + Cloud Monitoring Console | SRE, compliance officers, finance        |

**Rule:** In-app dashboards drive operational decisions in the moment. External dashboards prove compliance and optimize cost.

---

## 4. Backend Design

### 4.1 Retirement of `dispatchTimeoutSweep`

**The existing `dispatchTimeoutSweep` scheduled function is deleted.** Its logic is subsumed into `monitorDispatchDeadlines`.

**Why:** Two scheduled functions racing over the same `pending` + past-deadline documents guarantees state corruption. One unified function atomically decides: if `escalationCount < 1` and candidate exists → escalate; else → `needs_admin`.

### 4.2 New / Modified Cloud Functions

| Function                   | Type                     | Change     | Purpose                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dispatchResponder`        | `onCall`                 | **Extend** | After transaction commits, call FCM, THEN write `notification_attempted` event. Return FCM API result in response.                                                                                                                                                                                                               |
| `monitorDispatchDeadlines` | `onSchedule` (1 min)     | **New**    | Replaces `dispatchTimeoutSweep`. Reads `system_config/monitor` kill switch. Queries with `LIMIT 50` + lease. Processes each dispatch in a single Firestore transaction that mutates the SAME dispatch doc (updates `assignedTo`, appends to `previouslyNotifiedResponderUids`, increments `escalationCount`). Batches FCM sends. |
| `escalateDispatch`         | `onCall`                 | **New**    | Admin manually triggers re-dispatch for `needs_admin` dispatches. Finds next available responder (excludes previously notified). Mutates SAME dispatch doc.                                                                                                                                                                      |
| `acceptDispatch`           | `onCall`                 | **Extend** | Write `notification_delivered` event with `action: 'accepted'`.                                                                                                                                                                                                                                                                  |
| `declineDispatch`          | `onCall`                 | **Extend** | Write `notification_delivered` event with `action: 'declined'`.                                                                                                                                                                                                                                                                  |
| `getOpsMetrics`            | `onCall`                 | **New**    | Returns pre-aggregated counts from **counter documents** (not raw Firestore scans). Server-derived scope from auth claims; rejects client-provided scope. Rate-limited.                                                                                                                                                          |
| `retryFcmDelivery`         | `onSchedule` (every 30s) | **New**    | Polls `fcm_retry_queue` for pending items, retries FCM sends with exponential backoff, deletes succeeded docs, increments `retryCount` on failures.                                                                                                                                                                              |

### 4.3 Data Model

#### `dispatches` document — fields

```typescript
interface DispatchDoc {
  // ... existing fields (reportId, assignedTo, status, dispatchedAt, etc.) ...
  acknowledgementDeadlineAt: number // server millis; now enforced
  escalationCount: number // increments on every escalation (auto or manual)
  previouslyNotifiedResponderUids: string[] // append-only via arrayUnion
  escalationReason?: 'deadline_exceeded' | 'declined' | 'admin_override'
  monitorLeaseAt?: number // timestamp of last monitor processing
  fcmResult?: 'sent' | 'no_token' | 'network_error' | 'sent_with_invalid_tokens'
  fcmWarnings?: string[] // e.g., ['fcm_one_token_invalid']
}
```

**Rules:**

- `escalationCount` increments atomically via `FieldValue.increment(1)` inside the transaction.
- `previouslyNotifiedResponderUids` appended via `FieldValue.arrayUnion(responderUid)`. Never read-modify-write.
- Auto-escalation cap: `escalationCount < 1` for the monitor. Admin `escalateDispatch` has no cap.
- `monitorLeaseAt` written by the monitor to prevent overlapping invocations processing the same dispatch.

#### `dispatch_events` — unified schema

**All events (old and new) include `agencyId` and a `type` discriminator.**

```typescript
type DispatchEvent =
  | {
      type: 'status_changed'
      dispatchId: string
      reportId: string
      from: string
      to: string
      actorUid: string
      actorRole: string
      agencyId: string
      municipalityId: string
      at: number
      correlationId: string
      schemaVersion: 1
    }
  | {
      type: 'notification_attempted'
      dispatchId: string
      responderUid: string
      agencyId: string
      municipalityId: string
      fcmResult: 'sent' | 'no_token' | 'network_error' | 'sent_with_invalid_tokens'
      fcmWarnings?: string[]
      at: number
      correlationId: string
      schemaVersion: 1
    }
  | {
      type: 'notification_delivered'
      dispatchId: string
      responderUid: string
      agencyId: string
      municipalityId: string
      action: 'accepted' | 'declined'
      at: number
      correlationId: string
      schemaVersion: 1
    }
  | {
      type: 'notification_received'
      dispatchId: string
      responderUid: string
      agencyId: string
      municipalityId: string
      deviceId?: string
      at: number
      correlationId: string
      schemaVersion: 1
    }
  | {
      type: 'deadline_exceeded'
      dispatchId: string
      responderUid: string
      agencyId: string
      municipalityId: string
      escalationCount: number
      at: number
      correlationId: string
      schemaVersion: 1
    }
  | {
      type: 'escalation_attempted'
      dispatchId: string
      fromResponderUid: string
      toResponderUid: string
      agencyId: string
      municipalityId: string
      reason: string
      at: number
      correlationId: string
      schemaVersion: 1
    }
```

**Legacy event migration:** Existing `dispatch_events` without `type` are treated as `type: 'status_changed'` by the frontend renderer. All new events written by callables include `type` explicitly.

#### `system_config/monitor` — kill switch document

```typescript
interface MonitorConfig {
  autoEscalationEnabled: boolean // default true
  maxDispatchesPerRun: number // default 50
  maxEscalationsPerRun: number // default 50
  enableCircuitBreaker: boolean // default true
  circuitBreakerThreshold: number // default 100 (dispatches processed in one run)
  circuitBreakerErrorThreshold: number // default 10 (errors in one run)
  updatedAt: number
  updatedBy: string
}
```

The monitor reads this document at the start of every invocation. An admin can flip `autoEscalationEnabled: false` in the Firebase Console in <10 seconds without deploying code.

#### `fcm_retry_queue` — retry queue

```typescript
interface FcmRetryQueueItem {
  dispatchId: string
  responderUid: string
  attemptCount: number // 0, 1, 2
  lastAttemptAt: number
  nextAttemptAt: number
  originalError: string
  status: 'pending' | 'in_progress' | 'success' | 'permanent_failure'
}
```

When `dispatchResponder` or `monitorDispatchDeadlines` encounters a `network_error`, it writes a doc to this collection. A separate **scheduled function** (`retryFcmDeliveryScheduled`, every 30s) polls `fcm_retry_queue` where `status == 'pending' && nextAttemptAt <= now` and processes items in batches. This avoids thundering herd of `onDocumentCreated` triggers. **Cap:** `attemptCount >= 3` → `status = 'permanent_failure'`, emit `bantayog/fcm_permanent_failure` log metric, do NOT create new queue item. Max instances: 1.

### 4.4 Escalation Logic (monitorDispatchDeadlines)

```text
1. Read system_config/monitor. If autoEscalationEnabled == false, exit.

2. Query dispatches:
   .where('status', '==', 'pending')
   .where('acknowledgementDeadlineAt', '<', now)
   .where('monitorLeaseAt', '<', now - 120000)   // lease expired or never set
   .orderBy('acknowledgementDeadlineAt')
   .limit(maxDispatchesPerRun)

3. If count > circuitBreakerThreshold, write alert and exit.

4. Batch-query responders ONCE per run (chunk municipalityIds into groups of 10 to respect Firestore `in` limit):
   FOR each chunk of municipalityIds (max 10):
     query = .where('availabilityStatus', '==', 'available')
              .where('accountStatus', '==', 'active')
              .where('lastSeenAt', '>', now - 30 * 60 * 1000)
              .where('municipalityId', 'in', chunk)
   Merge all chunk results in-memory into a single candidate list.
   Fallback: if strict query returns empty, run a second query with `lastSeenAt > now - 2h` and same `availabilityStatus` filter.
   Cap total in-memory responders at 200 per run. If exceeded, log warning and use 200 most-recently-active.

 5. For each dispatch:
    a. Start a Firestore transaction.
    b. Re-read the dispatch doc inside the transaction (ensure still pending + past deadline).
    c. If escalationCount >= 1: skip to step 5e (cap reached).   // CHECK CAP FIRST
    d. Check assignedResponder.accountStatus == 'active'. If suspended, skip to step 5e (no candidate).
    e. Find next candidate from the batched responder list:
       - Exclude previouslyNotifiedResponderUids
       - Sort by lastSeenAt descending (most recently active first)
    f. If candidate found:
       - Update dispatch: assignedTo = new responder, escalationCount += 1,
         previouslyNotifiedResponderUids = arrayUnion(oldUid),
         escalationReason = 'deadline_exceeded', monitorLeaseAt = now,
         status = 'pending' (remains pending, new responder must accept)
       - Write deadline_exceeded + escalation_attempted events
       - Add to FCM batch list
    g. If no candidate found or cap reached:
       - Update dispatch: status = 'needs_admin', monitorLeaseAt = now
       - Write deadline_exceeded event
       - Write grouped alert to alerts collection (update existing batch doc, not new doc)
       - Alert document ID: `{municipalityId}_{YYYYMMDD}` — use transaction to upsert count

6. Send batched FCM multicast for all escalations.

7. For any FCM network_error, write to fcm_retry_queue.

8. Log metrics: processedCount, escalatedCount, needsAdminCount, errors.
```

**Important:** No code may parse `dispatchId` to extract `responderUid`. Always read `assignedTo.uid` from the document. Pre-implementation: grep codebase for `dispatchId.split` or regex patterns and refactor. Old responder whose `assignedTo` was updated will see dispatch disappear from `useOwnDispatches`; send optional FCM "Unassigned" notification to old responder. Consider migrating ID scheme to `reportId + '_' + dispatchedAt` or auto-ID to remove temptation.

**Key invariants:**

- One dispatch doc per report. Never create a new dispatch doc for escalation.
- Each dispatch processed in its own transaction. No batching multiple dispatches into one write batch.
- Responder query is batched once per run, not per-dispatch (N+1 eliminated).
- FCM sends are batched per run, not per-dispatch.

### 4.5 FCM Delivery Tracking (Two-Phase)

**Phase 1: API Attempted (server-side)**

- `dispatchResponder` callable calls `sendFcmToResponder`
- After FCM API responds, write `notification_attempted` event to `dispatch_events`
- Update `dispatches/{id}` with `fcmResult` and `fcmWarnings`
- **This happens OUTSIDE the original transaction** because the FCM result is not known until after the API call

**Phase 2: Device Received (client-side)**

- Responder app receives FCM message (foreground or background)
- App writes `notification_received` event to `dispatch_events` via Firestore client write (or callable if background)
- If no `notification_received` within 30 seconds of `notification_attempted`, the monitor treats the push as potentially undelivered and may re-send if within retry window

**Admin UI indicator:**

- 🟢 `notification_attempted` = sent AND `notification_received` exists within 30s
- 🟡 `notification_attempted` = sent but no `notification_received` after 30s
- 🔴 `notification_attempted` = no_token or network_error
- ⚠️ `notification_attempted` = sent_with_invalid_tokens (some tokens cleaned up)

### 4.6 Scope and Authorization (Server-Derived)

**All callables derive scope from auth claims. Client-provided scope is rejected.**

```typescript
function deriveScope(claims: Record<string, unknown>) {
  const role = claims.role as string
  if (role === 'municipal_admin') {
    return { type: 'municipality', id: claims.municipalityId as string }
  }
  if (role === 'agency_admin') {
    return { type: 'agency', id: claims.agencyId as string }
  }
  if (role === 'provincial_superadmin') {
    return { type: 'province' }
  }
  throw new HttpsError('permission-denied', 'unknown role')
}
```

- `getOpsMetrics`: Reject request if `'scope' in payload` regardless of value (`null`, `undefined`, empty string). Use `deriveScope(req.auth.token)`.
- `escalateDispatch`: Read dispatch doc, extract `municipalityId` from `assignedTo.municipalityId` or report doc. Enforce `adminOf(municipalityId)`.
- `dispatchResponder`: Already checks `municipalityId` ownership. Verify responder `accountStatus == 'active'` before assignment. Do NOT enforce `lastSeenAt > now - 30min` at manual dispatch time (admin discretion); keep the 30min filter only in the auto-monitor.

---

## 5. Firestore Security Rules Changes

### 5.1 `dispatches` collection

```rules
allow list: if isActivePrivileged() && (
  (isResponder() && assignedTo.uid == uid())
  || adminOf(municipalityId)
  || (isAgencyAdmin() && assignedTo.agencyId == myAgency())
);

allow create, update, delete: if false;  // WARNING: CALLABLES USE ADMIN SDK AND BYPASS THESE RULES. DO NOT ADD client write permissions here.
```

### 5.2 `dispatch_events` collection

**Rules fallback for legacy events missing `agencyId`:**

```rules
allow list: if isActivePrivileged() && (
  (isResponder() && data.assignedTo.uid == uid())
  || adminOf(data.municipalityId)
  || (isAgencyAdmin() && (!('agencyId' in data) || data.agencyId == myAgency()))
  || isProvincialSuperadmin()
);

allow create, update, delete: if false;  // WARNING: CALLABLES USE ADMIN SDK AND BYPASS THESE RULES. DO NOT ADD client write permissions here.
```

**All new `dispatch_events` must include `agencyId` and `municipalityId`. Legacy events without `agencyId` are handled by the rules fallback but should be backfilled via a one-time migration script before deployment.**

### 5.3 `alerts` collection

```rules
allow list, get: if isActivePrivileged() && (
  adminOf(data.municipalityId)
  || (isAgencyAdmin() && data.agencyId == myAgency())
  || isProvincialSuperadmin()
);

allow create, update, delete: if false;  // callable-only
```

**Alert documents are minimal:** `type`, `municipalityId`, `agencyId`, `count`, `createdAt`. No `reportId` or `responderUid` in publicly readable alerts.

### 5.4 `system_config/monitor`

```rules
allow get: if isProvincialSuperadmin();
allow update: if isProvincialSuperadmin();
```

### 5.5 Required Composite Indexes

Add to `infra/firebase/firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "dispatches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "acknowledgementDeadlineAt", "order": "ASCENDING" },
        { "fieldPath": "monitorLeaseAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dispatchedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "municipalityId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dispatchedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "agencyId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dispatchedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatch_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "municipalityId", "order": "ASCENDING" },
        { "fieldPath": "at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatch_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "agencyId", "order": "ASCENDING" },
        { "fieldPath": "at", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 6. Admin Desktop UI Design

### 6.1 New Route: `/dispatches`

A dedicated **Dispatch Monitor** page. Accessible from the CommandHeader nav.

### 6.2 Page Structure

```
/DispatchMonitorPage
├── DispatchStatsCards (top row)
│   ├── Active Dispatches
│   ├── Pending (not yet accepted)
│   ├── Timed Out / Needs Admin
│   └── Avg Accept Time (last 24h)
├── EscalationQueueSection (prominent when non-empty)
│   └── "needs_admin" dispatches with "Re-dispatch" button
├── DispatchLifecycleTable (main)
│   ├── Columns:
│   │   • Report ID (clickable → opens report in map)
│   │   • Responder (name + agency)
│   │   • Status (badge)
│   │   • Deadline (countdown, turns red at < 2 min)
│   │   • FCM (icon + tooltip with timeline)
│   │   • Actions (Re-dispatch button for needs_admin)
│   └── Expanded row: full event timeline
└── ResponderAvailabilityPanel (bottom)
    └── Live list of available responders with last-seen freshness
```

### 6.3 Status Visuals

| State                      | Badge                 | Color       | Admin Action                  |
| -------------------------- | --------------------- | ----------- | ----------------------------- |
| `pending` + time remaining | "PENDING — 3m"        | Amber       | None                          |
| `pending` + past deadline  | "EXPIRED"             | Red         | None (auto-escalating)        |
| `accepted`                 | "ACCEPTED"            | Green       | None                          |
| `declined`                 | "DECLINED — reason"   | Gray        | Re-dispatch button            |
| `needs_admin`              | "NEEDS ADMIN" + pulse | Red + alert | Re-dispatch to next responder |
| `escalated` (auto)         | "AUTO-ESCALATED"      | Orange      | View history                  |

### 6.4 FCM Delivery Indicator

| Icon | Meaning                               | Tooltip                                                                            |
| ---- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| 🟢   | API sent + device received within 30s | "FCM delivered to device at 14:02:18"                                              |
| 🟡   | API sent, no device receipt after 30s | "FCM sent but device has not acknowledged. Possible: app killed, DND, no network." |
| 🔴   | No token or network error             | "FCM failed: {reason}"                                                             |
| ⚠️   | Sent but some tokens invalid          | "FCM sent, but cleaned up invalid tokens"                                          |

### 6.5 Re-dispatch Flow

1. Admin clicks "Re-dispatch" on a `needs_admin` row
2. Modal opens: "Select next responder" with filtered list (excludes previously notified, shows last seen)
3. Admin selects responder, clicks "Dispatch"
4. Calls `escalateDispatch` callable
5. Row updates live via single Firestore `onSnapshot` on `dispatches`

### 6.6 Data Loading (Fixed Listener Pattern)

**One listener on `dispatches`, one listener on `dispatch_events`.** No per-dispatch listeners.

```typescript
// useDispatchLifecycle hook — scope derived from Firebase Auth claims, never from caller
function useDispatchLifecycle() {
  const { claims } = useAuth()
  const scope = deriveClientScope(claims) // ignores any caller-provided scope

  // Build queries based on role
  let dispatchQuery: QueryConstraint[]
  let eventsQuery: QueryConstraint[]

  if (claims.role === 'municipal_admin') {
    dispatchQuery = [
      where('municipalityId', '==', claims.municipalityId),
      where('status', 'in', ['pending', 'accepted', 'declined', 'needs_admin', 'escalated']),
      orderBy('dispatchedAt', 'desc'),
      limit(100),
    ]
    eventsQuery = [
      where('municipalityId', '==', claims.municipalityId),
      orderBy('at', 'desc'),
      limit(500),
    ]
  } else if (claims.role === 'agency_admin') {
    dispatchQuery = [
      where('agencyId', '==', claims.agencyId),
      where('status', 'in', ['pending', 'accepted', 'declined', 'needs_admin', 'escalated']),
      orderBy('dispatchedAt', 'desc'),
      limit(100),
    ]
    eventsQuery = [where('agencyId', '==', claims.agencyId), orderBy('at', 'desc'), limit(500)]
  } else if (claims.role === 'provincial_superadmin') {
    // Never unscoped — always time-filtered + limited
    dispatchQuery = [
      where('status', 'in', ['pending', 'accepted', 'declined', 'needs_admin', 'escalated']),
      where('dispatchedAt', '>', now - 24 * 60 * 60 * 1000),
      orderBy('dispatchedAt', 'desc'),
      limit(100),
    ]
    eventsQuery = [where('at', '>', now - 24 * 60 * 60 * 1000), orderBy('at', 'desc'), limit(500)]
  } else {
    throw new Error('Unauthorized')
  }

  // Subscribe with single listeners
  // Client-side merge: group events by dispatchId
}
```

**For `provincial_superadmin`:** Add `where('dispatchedAt', '>', now - 24h)` and `limit(100)` to prevent unscoped listener bomb.

### 6.7 Keyboard Shortcuts

- `R` — re-dispatch focused `needs_admin` dispatch
- `Enter` — expand/collapse focused row
- `Escape` — clear selection, close modal

---

## 7. Observability Dashboards

### 7.1 In-App Ops Dashboard (`/ops-dashboard`)

**New page, separate from existing `/dashboard`.**

**Panel data sources:**

| Panel                         | Data Source                                                            | Type       |
| ----------------------------- | ---------------------------------------------------------------------- | ---------- |
| **Active Dispatch Summary**   | Firestore `onSnapshot` on `dispatches`                                 | LIVE       |
| **Responder Fleet Status**    | Firestore `onSnapshot` on `responders`                                 | LIVE       |
| **Needs Admin Queue**         | Firestore `onSnapshot` on `dispatches` where `status == 'needs_admin'` | LIVE       |
| **Response Time Trend (24h)** | `getOpsMetrics` callable                                               | HISTORICAL |
| **Report Volume (24h)**       | `getOpsMetrics` callable                                               | HISTORICAL |
| **Escalation Rate (24h)**     | `getOpsMetrics` callable                                               | HISTORICAL |
| **FCM Delivery Rate (24h)**   | `getOpsMetrics` callable                                               | HISTORICAL |
| **System Alert Feed**         | Firestore `onSnapshot` on `alerts`                                     | LIVE       |

**Live panels** update in real-time via Firestore listeners.
**Historical panels** show "Last updated: Xs ago" and poll every 60s.

### 7.2 `getOpsMetrics` Implementation (Counter Pattern)

Instead of scanning raw `dispatches` and `dispatch_events`, maintain pre-computed counter documents:

```text
metrics_daily/{municipalityId}_{YYYYMMDD}
metrics_daily/{agencyId}_{YYYYMMDD}
metrics_daily/province_{YYYYMMDD}
```

```typescript
interface DailyMetricsDoc {
  scopeType: 'municipality' | 'agency' | 'province'
  scopeId: string
  date: string // YYYY-MM-DD
  totalDispatches: number
  acceptedCount: number
  declinedCount: number
  escalatedCount: number
  needsAdminCount: number
  fcmSuccessCount: number
  fcmFailureCount: number
  totalAcceptSeconds: number
  acceptCountWithTimestamps: number
  updatedAt: number
}
```

**Maintenance:** Cloud Functions (`dispatchResponder`, `acceptDispatch`, `declineDispatch`, `monitorDispatchDeadlines`) increment the appropriate counter doc via `FieldValue.increment()` in the same transaction.

**`getOpsMetrics` callable** reads only the counter docs for the requested date range. Guaranteed <100ms.

### 7.3 External Dashboards

#### Cloud Monitoring — SRE / SLA

**Log-based metrics:**

| Metric Name                           | Filter                                                  |
| ------------------------------------- | ------------------------------------------------------- |
| `bantayog/dispatch_created`           | `jsonPayload.code="dispatch.created"`                   |
| `bantayog/dispatch_accepted`          | `jsonPayload.code="dispatch.accepted"`                  |
| `bantayog/dispatch_declined`          | `jsonPayload.code="dispatch.declined"`                  |
| `bantayog/dispatch_deadline_exceeded` | `jsonPayload.code="dispatch.deadline_exceeded"`         |
| `bantayog/dispatch_escalated`         | `jsonPayload.code="dispatch.escalated"`                 |
| `bantayog/fcm_sent`                   | `jsonPayload.code="fcm.sent"`                           |
| `bantayog/fcm_failed`                 | `jsonPayload.code="fcm.failed"`                         |
| `bantayog/callable_latency`           | `jsonPayload.latencyMs > 0`                             |
| `bantayog/callable_error`             | `severity=ERROR` AND `jsonPayload.dimension="callable"` |

**Adaptive alerting rules:**

| Alert                  | Condition                                                             | Action                 |
| ---------------------- | --------------------------------------------------------------------- | ---------------------- |
| **Severity 1 (PAGE)**  | `deadline_exceeded rate > 5%` AND dispatch volume within normal range | PagerDuty              |
| **Severity 2 (SLACK)** | `deadline_exceeded rate > 5%` AND dispatch volume > 3x baseline       | Slack #ops             |
| **Severity 3 (LOG)**   | `fcm_failed rate > 10%` during known incident                         | Cloud Logging only     |
| **Function latency**   | `callable_latency p99 > 3000ms` in 15m                                | Slack #perf            |
| **Circuit breaker**    | `monitor_circuit_opened` event                                        | PagerDuty + Slack #ops |
| **Cost anomaly**       | Daily cost > 150% of 7-day moving average                             | Slack #finance         |

**Incident mode:** When an admin declares "incident mode" in the UI, write to `system_config/alerts`. Cloud Monitoring alert policies reference this doc to suppress non-critical alerts.

#### BigQuery — Compliance / Audit / Cost

**Log sink:** `bantayog_audit` dataset.

**Tables:**

| Table                  | Source                        | Retention |
| ---------------------- | ----------------------------- | --------- |
| `dispatch_events`      | Cloud Logging structured logs | 90 days   |
| `audit_events`         | Cloud Logging structured logs | 1 year    |
| `function_invocations` | Cloud Logging structured logs | 90 days   |

**Scheduled queries (daily):**

| Query                       | Output                        | Purpose                                   |
| --------------------------- | ----------------------------- | ----------------------------------------- |
| Daily dispatch summary      | `daily_dispatch_summary`      | Response time percentiles by municipality |
| Daily responder utilization | `daily_responder_utilization` | Availability rate, shift coverage         |
| Erasure audit trail         | `erasure_audit`               | RA 10173 compliance proof                 |
| Data incident timeline      | `incident_timeline`           | DPA incident response documentation       |
| Daily cost attribution      | `daily_cost_by_service`       | Cost per dispatch, per service            |

**BigQuery row-level security:**

- Raw `responderUid` columns: restricted to `roles/bigquery.dataViewer` + `bantayog-superadmin` IAM group
- Aggregated summaries: accessible to `bantayog-compliance` group
- Hashed `responderUid` in all non-restricted views

---

## 8. API Contracts

### 8.1 `dispatchResponder` callable — extended response

```typescript
// Request (unchanged)
{ reportId: string; responderUid: string; idempotencyKey: string }

// Response (new fields)
{
  dispatchId: string
  status: 'pending'
  reportId: string
  correlationId: string
  fcmResult: 'sent' | 'no_token' | 'network_error' | 'sent_with_invalid_tokens'
  fcmWarnings?: string[]
}
```

### 8.2 `escalateDispatch` callable — new

```typescript
// Request (scope derived server-side from claims)
{
  dispatchId: string
  newResponderUid: string
  idempotencyKey: string
  // reason is server-derived:
  //   'deadline_exceeded' only if acknowledgementDeadlineAt < now
  //   'declined' only if status === 'declined'
  //   'admin_override' if admin explicitly overrides
}

// Response
{
  dispatchId: string
  status: 'pending'
  reportId: string
  fcmResult: 'sent' | 'no_token' | 'network_error' | 'sent_with_invalid_tokens'
}
```

**Auth:** `municipal_admin` or `provincial_superadmin`.
**Ownership check:** Server reads dispatch doc, verifies `adminOf(municipalityId)`.
**Rate limit:** 30/min per admin UID.
**Responder validation:** New responder must have `accountStatus == 'active'` and `lastSeenAt > now - 30min`.

### 8.3 `getOpsMetrics` callable — new

```typescript
// Request (no scope — derived server-side)
{
  timeRange: '1h' | '24h' | '7d'
}

// Response
{
  timeRange: '1h' | '24h' | '7d'
  scope: {
    type: 'municipality' | 'agency' | 'province'
    id?: string
  }
  metrics: {
    totalDispatches: number
    acceptedCount: number
    declinedCount: number
    escalatedCount: number
    needsAdminCount: number
    avgAcceptSeconds: number | null
    fcmSuccessRate: number
    responderAvailabilityRate: number
  }
  // HISTORICAL data only. Real-time counts come from Firestore listeners.
}
```

**Auth:** Any admin role. Server derives scope from claims. Rejects request if payload contains `scope`.
**Rate limit:** 60/min per UID.
**Cache:** In-memory LRU cache per scope, 10s TTL.

---

## 9. Frontend Changes

### 9.1 New Files

| File                                                               | Purpose                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| `apps/admin-desktop/src/pages/DispatchMonitorPage.tsx`             | Main dispatch monitor page                           |
| `apps/admin-desktop/src/components/DispatchLifecycleTable.tsx`     | Table with expandable rows                           |
| `apps/admin-desktop/src/components/DispatchStatsCards.tsx`         | Top-row stat cards                                   |
| `apps/admin-desktop/src/components/EscalationQueueSection.tsx`     | "Needs admin" dispatch queue                         |
| `apps/admin-desktop/src/components/ResponderAvailabilityPanel.tsx` | Live responder list                                  |
| `apps/admin-desktop/src/components/FcmStatusIcon.tsx`              | FCM delivery status icon                             |
| `apps/admin-desktop/src/components/DispatchTimeline.tsx`           | Expanded row timeline                                |
| `apps/admin-desktop/src/components/ReDispatchModal.tsx`            | Admin re-dispatch modal                              |
| `apps/admin-desktop/src/pages/OpsDashboardPage.tsx`                | In-app ops dashboard                                 |
| `apps/admin-desktop/src/components/OpsMetricCard.tsx`              | Reusable metric card                                 |
| `apps/admin-desktop/src/hooks/useDispatchLifecycle.ts`             | Single Firestore listener for dispatches + events    |
| `apps/admin-desktop/src/hooks/useOpsMetrics.ts`                    | `getOpsMetrics` callable wrapper (60s polling)       |
| `apps/admin-desktop/src/hooks/useResponderFleet.ts`                | Single Firestore listener for responder availability |
| `apps/admin-desktop/src/services/callables.ts`                     | Add `escalateDispatch`, `getOpsMetrics` wrappers     |

### 9.2 Modified Files

| File                                                      | Change                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/admin-desktop/src/routes.tsx`                       | Add `/dispatches` and `/ops-dashboard` routes                                |
| `apps/admin-desktop/src/components/CommandHeader.tsx`     | Add nav links to Dispatch Monitor and Ops Dashboard                          |
| `apps/admin-desktop/src/services/callables.ts`            | Extend `dispatchResponder` return type to include `fcmResult`, `fcmWarnings` |
| `apps/admin-desktop/src/stores/commandCenterStore.ts`     | Add `dispatchId` to selection state for cross-window sync                    |
| `apps/admin-desktop/src/providers/WindowSyncProvider.tsx` | Add `dispatch:status_changed` message type                                   |
| `packages/shared-validators/src/dispatches.ts`            | Add `needs_admin` and `escalated` to `dispatchStatusSchema`                  |
| `infra/firebase/firestore.rules`                          | Add `agency_admin` path to `dispatches` and `dispatch_events` list rules     |
| `infra/firebase/firestore.indexes.json`                   | Add composite indexes for monitor queries, scoped dashboards                 |
| `functions/src/index.ts`                                  | Export new callables and scheduled function                                  |

### 9.3 `useDispatchLifecycle` Hook (Single Listener)

```typescript
// Derives scope from Firebase Auth claims, ignores caller-provided scope
function useDispatchLifecycle(): {
  rows: DispatchLifecycleRow[]
  loading: boolean
  error: string | null
}

// Implementation:
// 1. Read current user's claims (role, municipalityId, agencyId)
// 2. Build a single dispatches query with role-appropriate filters + limit(100)
// 3. Build a single dispatch_events query with same scope + orderBy('at', 'desc') + limit(500)
// 4. Client-side group events by dispatchId
// 5. Merge into rows
```

### 9.4 `useResponderFleet` Hook (Single Listener)

```typescript
// Returns available responders scoped by role
function useResponderFleet(): {
  responders: ResponderFleetRow[]
  loading: boolean
}
```

**Query:**

- `municipal_admin`: `.where('municipalityId', '==', claims.municipalityId).where('availabilityStatus', '==', 'available')`
- `agency_admin`: `.where('agencyId', '==', claims.agencyId).where('availabilityStatus', '==', 'available')`
- `provincial_superadmin`: `.where('availabilityStatus', '==', 'available').limit(100)`

---

## 10. Testing Strategy

### 10.1 Backend Tests

| Test File                                                                          | Coverage                                                                                                                 |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `functions/src/__tests__/callables/dispatch-responder-fcm-tracking.test.ts`        | `notification_attempted` event written AFTER FCM completes, `fcmResult` returned                                         |
| `functions/src/__tests__/callables/monitor-dispatch-deadlines.test.ts`             | Deadline detection, lease behavior, auto-escalation once, `needs_admin` when no candidates, batch query, circuit breaker |
| `functions/src/__tests__/callables/escalate-dispatch.test.ts`                      | Admin re-dispatch, ownership check, rate limiting, idempotency, responder validation                                     |
| `functions/src/__tests__/callables/get-ops-metrics.test.ts`                        | Counter doc reads, server-derived scope rejection, role scoping, rate limiting                                           |
| `functions/src/__tests__/callables/accept-dispatch-event.test.ts`                  | `notification_delivered` event written                                                                                   |
| `functions/src/__tests__/callables/decline-dispatch-event.test.ts`                 | `notification_delivered` event written                                                                                   |
| `functions/src/__tests__/scheduled/monitor-dispatch-deadlines-integration.test.ts` | Full integration: 50 pending dispatches, monitor runs, correct escalations and needs_admin counts                        |
| `functions/src/__tests__/rules/dispatches.rules.test.ts`                           | `agency_admin` can list dispatches by agencyId                                                                           |
| `functions/src/__tests__/rules/dispatch-events.rules.test.ts`                      | `agency_admin` can read events with agencyId                                                                             |

### 10.2 Load Testing (Phase 1, Before Frontend)

**Harness:** `firebase emulators:exec` with seed script.

**Scenarios:**

1. **500 pending dispatches:** Seed 500 `dispatches` docs with `acknowledgementDeadlineAt` in the past. Run monitor. Assert: completes in <30s, zero errors, no double escalations, exactly 50 processed (LIMIT), remaining 450 processed on next run.
2. **Overlapping invocations:** Trigger monitor twice simultaneously. Assert: second invocation exits early due to lease, zero double escalations.
3. **FCM batching:** 100 escalations in one run. Assert: single `sendEachForMulticast` call (or batched), not 100 individual calls.
4. **Circuit breaker:** Seed 200 pending dispatches with `maxDispatchesPerRun: 50`. Assert: only 50 processed, alert written.

### 10.3 Frontend Tests

| Test File                                                          | Coverage                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `apps/admin-desktop/src/__tests__/DispatchLifecycleTable.test.tsx` | Row rendering, expansion, status badges, FCM icons                   |
| `apps/admin-desktop/src/__tests__/DispatchMonitorPage.test.tsx`    | Page layout, Firestore subscription wiring, re-dispatch flow         |
| `apps/admin-desktop/src/__tests__/EscalationQueueSection.test.tsx` | Needs-admin queue, re-dispatch button visibility                     |
| `apps/admin-desktop/src/__tests__/FcmStatusIcon.test.tsx`          | Icon states, tooltip                                                 |
| `apps/admin-desktop/src/__tests__/OpsDashboardPage.test.tsx`       | Live vs historical panel boundaries, `getOpsMetrics` polling         |
| `apps/admin-desktop/src/__tests__/useDispatchLifecycle.test.ts`    | Single listener pattern, scope derivation from claims, event merging |

### 10.4 E2E Tests

| Test                    | Flow                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Full dispatch lifecycle | Admin dispatches → responder accepts → admin sees "ACCEPTED" in monitor                                     |
| Deadline escalation     | Admin dispatches → responder ignores → monitor auto-escalates → admin sees "AUTO-ESCALATED"                 |
| Admin re-dispatch       | Admin dispatches → responder declines → admin clicks Re-dispatch → selects new responder → dispatch updated |
| FCM failure visibility  | Responder has no FCM token → admin sees 🔴 immediately                                                      |
| Device receipt tracking | Responder receives push → app writes `notification_received` → admin sees 🟢                                |
| Kill switch             | Admin flips `autoEscalationEnabled: false` → monitor exits without escalating                               |

---

## 11. Rollout Plan

### Phase 1: Backend Foundation + Load Testing (3–4 days)

1. Delete `dispatchTimeoutSweep` (or disable its schedule)
2. Extend `dispatchResponder` to track FCM result and write `notification_attempted` outside transaction
3. Extend `acceptDispatch` and `declineDispatch` to write `notification_delivered`
4. Create `monitorDispatchDeadlines` scheduled function with lease + pagination + batching
5. Create `escalateDispatch` callable with ownership checks
6. Create `getOpsMetrics` callable using counter pattern
7. Create `retryFcmDelivery` scheduled function (polls `fcm_retry_queue` every 30s)
8. Update `dispatchStatusSchema` with `needs_admin` and `escalated`
9. Update Firestore rules for `agency_admin` access
10. Add composite indexes to `firestore.indexes.json`
11. **Load test:** 500 pending dispatches, verify <30s, zero errors

### Phase 2: Admin Desktop Dispatch Monitor (2–3 days)

1. Create `useDispatchLifecycle` hook (single listener pattern)
2. Build `DispatchLifecycleTable`, `EscalationQueueSection`, `DispatchStatsCards`
3. Build `ReDispatchModal`
4. Create `/dispatches` page, wire into routes + header
5. Add cross-window sync for dispatch status changes
6. Frontend tests

### Phase 3: In-App Ops Dashboard (2 days)

1. Create `useOpsMetrics` hook (polling, 60s)
2. Create `useResponderFleet` hook (live listener)
3. Build `OpsDashboardPage` with live + historical panels
4. Wire `/ops-dashboard` route + header nav
5. Frontend + backend tests

### Phase 4: Responder App FCM Receipt (1 day)

1. Add FCM message handler that writes `notification_received` event
2. Handle background message via service worker
3. Responder app tests

### Phase 5: External Observability (2–3 days)

1. Add structured log fields for all new events
2. Create Cloud Monitoring log-based metrics
3. Build Cloud Monitoring dashboards (Dispatch SLA, Function Health)
4. Set up BigQuery log sink with retention policies
5. Create BigQuery scheduled queries
6. Build compliance + cost dashboards
7. Create alerting rules with adaptive thresholds

### Phase 6: Integration & Hardening (1–2 days)

1. E2E tests on emulator
2. Performance test: `getOpsMetrics` <100ms with 10k dispatches (counter pattern)
3. Review and tighten Firestore rules for new fields
4. Update `docs/learnings.md` with new gotchas
5. Deploy to staging, soak for 24h

**Total estimate:** 11–15 days.

---

## 12. Risks & Mitigations

| Risk                                                      | Likelihood | Impact      | Mitigation                                                                                                               |
| --------------------------------------------------------- | ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `monitorDispatchDeadlines` OOMs with high dispatch volume | Medium     | Breakage    | LIMIT 50, batched responder query, batched FCM sends. Circuit breaker at 100.                                            |
| Auto-escalation creates alert fatigue                     | Low        | Operational | Cap at 1 auto-escalation. Grouped alerts (single doc with count). Kill switch in Firebase Console.                       |
| Firestore composite index missing → query fails           | Low        | Breakage    | Indexes enumerated in spec. Deploy indexes BEFORE function. Add startup index check in monitor.                          |
| FCM delivery tracking is complex (device receipt)         | Medium     | Delay       | Phase 4 is isolated. Device receipt is a nice-to-have; API-level tracking (sent/no_token/error) is MVP.                  |
| Counter pattern adds write overhead                       | Low        | Cost        | Counter updates are `FieldValue.increment()` in existing transactions — one extra write per dispatch action. Acceptable. |
| BigQuery cost exceeds budget                              | Medium     | Finance     | Retention policies (90d ops, 1yr audit). Cost alerts at $20/day. Sampling for high-volume logs.                          |
| Responder app FCM receipt not implemented                 | Medium     | Blind spot  | Device receipt is Phase 4. Without it, admin sees 🟡 (sent but no receipt) instead of 🟢. Still actionable.              |

---

## 13. Changelog from Original Spec

| #   | Change                                                       | Reason                                                                                     |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1   | Retired `dispatchTimeoutSweep`                               | Race condition with new monitor (CRITICAL finding)                                         |
| 2   | Single-dispatch-doc escalation                               | New dispatch doc per escalation broke one-report-one-dispatch invariant (CRITICAL finding) |
| 3   | `escalationCount` on same doc                                | Per-dispatch cap now meaningful; prevents infinite chain (CRITICAL finding)                |
| 4   | Server-derived scope for all callables                       | Client-provided scope = exfiltration vector (CRITICAL finding)                             |
| 5   | `agency_admin` rules for dispatches + events                 | Agency admins couldn't see anything (CRITICAL finding)                                     |
| 6   | Monitor lease + LIMIT 50 + batching                          | No pagination = timeout + double-escalation (CRITICAL finding)                             |
| 7   | Single listener pattern in frontend                          | 100 per-dispatch listeners = 100,000 reads (CRITICAL finding)                              |
| 8   | `FieldValue.arrayUnion` for exclusion list                   | Read-modify-write lost updates under concurrency (HIGH finding)                            |
| 9   | FCM event written AFTER API call                             | Event written inside transaction before FCM result known (HIGH finding)                    |
| 10  | Per-dispatch transactions in monitor                         | Batch writes = partial failure, docs stuck in limbo (HIGH finding)                         |
| 11  | `needs_admin` + `escalated` added to schema                  | Missing from shared validators (HIGH finding)                                              |
| 12  | All `dispatch_events` include `agencyId`                     | Agency admin timeline rendered blank (HIGH finding)                                        |
| 13  | Composite index enumeration                                  | Deployment would fail on first run (HIGH finding)                                          |
| 14  | Two-phase FCM tracking (attempted + received)                | `'sent'` ≠ device received (HIGH finding)                                                  |
| 15  | `fcm_retry_queue` + `retryFcmDelivery`                       | No retry for transient network errors (HIGH finding)                                       |
| 16  | Live metrics via Firestore listeners, historical via polling | 60s polling for critical metrics useless in incidents (HIGH finding)                       |
| 17  | Batch responder query once per run                           | N+1 query = timeout at 500 dispatches (HIGH finding)                                       |
| 18  | Kill switch (`system_config/monitor`)                        | No way to stop mass-escalation without deploy (HIGH finding)                               |
| 19  | Adaptive alerting with incident mode                         | Naive thresholds page constantly in disasters (HIGH finding)                               |
| 20  | Counter pattern for `getOpsMetrics`                          | Firestore scan <500ms claim was unrealistic (MEDIUM finding)                               |
| 21  | `minInstances: 1` for scheduled function                     | Cold start every minute = 3-8% time budget lost (LOW finding)                              |

---

## 14. Open Questions

None — all clarified during brainstorming and adversarial review.

---

## 15. Spec Self-Review Checklist

- [x] **Placeholder scan:** No TBDs, TODOs, or vague requirements.
- [x] **Internal consistency:** Architecture matches features. Single-dispatch-doc model is consistent throughout. Scope derivation is consistent.
- [x] **Scope check:** Two features (dispatch hardening + observability) sharing backend event infrastructure. Kept in one spec because observability depends on the hardened events.
- [x] **Ambiguity check:** All requirements explicit. Auto-escalation cap = 1 per dispatch doc. FCM result enum expanded. Role scoping rules explicit.
- [x] **Adversarial review addressed:** All CRITICAL and HIGH findings from both reviews incorporated with specific fixes.

---

## 16. Approval

**Design presented:** 2026-05-19
**User approval:** ✅
**Adversarial review:** 2 agents, 27 findings addressed
**Spec revised:** 2026-05-19
**Next step:** Invoke `writing-plans` skill to create implementation plan.
