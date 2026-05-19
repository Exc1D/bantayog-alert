# Admin Desktop Dispatch Hardening + Observability Dashboards

**Date:** 2026-05-19
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
   - Track FCM delivery status end-to-end
   - Give admins real-time visibility into every dispatch lifecycle
   - Prevent runaway auto-escalation (escalate once, then pause for admin)

2. **Observability Dashboards**
   - In-app ops dashboard for real-time decision-making (response times, queue depth, responder availability)
   - External dashboards for SLA compliance, cost, and audit (Cloud Monitoring + BigQuery)

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
           │  monitorDispatchDeadlines │ ◄── 1-min Cloud Schedule
           │   (scheduled function)    │
           │                           │
           │  • Finds past-deadline     │
           │    pending dispatches      │
           │  • Auto-escalates ONCE to  │
           │    next nearest responder  │
           │  • If 2nd also misses,     │
           │    marks "needs_admin"     │
           └──────────────────────────┘
                    │
                    ▼
           ┌──────────────────────────┐
           │  Admin Dispatch Monitor    │
           │  (new admin-desktop page)  │
           │                           │
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

### 4.1 New / Modified Cloud Functions

| Function                   | Type                 | Change     | Purpose                                                                                                                                                                  |
| -------------------------- | -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dispatchResponder`        | `onCall`             | **Extend** | After writing dispatch docs, also write `notification_attempted` event to `dispatch_events`. Return FCM result in callable response so admin UI can show it immediately. |
| `monitorDispatchDeadlines` | `onSchedule` (1 min) | **New**    | Scans `dispatches` where `status == 'pending'` and `acknowledgementDeadlineAt < now`. Auto-escalates once if `escalationCount < 1`, then flips to `needs_admin`.         |
| `escalateDispatch`         | `onCall`             | **New**    | Admin manually triggers re-dispatch for `needs_admin` dispatches. Finds next available responder (excludes previously notified ones).                                    |
| `acceptDispatch`           | `onCall`             | **Extend** | Write `notification_delivered` event with `action: 'accepted'`.                                                                                                          |
| `declineDispatch`          | `onCall`             | **Extend** | Write `notification_delivered` event with `action: 'declined'`.                                                                                                          |
| `getOpsMetrics`            | `onCall`             | **New**    | Returns pre-aggregated counts from Firestore queries for the in-app dashboard.                                                                                           |

### 4.2 Data Model Additions

#### `dispatches` document — new fields

```typescript
interface DispatchDoc {
  // ... existing fields (reportId, assignedTo, status, dispatchedAt, etc.) ...
  acknowledgementDeadlineAt: number // already exists, now enforced
  escalationCount: number // default 0
  previouslyNotifiedResponderUids: string[] // default []
  escalationReason?: 'deadline_exceeded' | 'declined' | 'admin_override'
}
```

**Rules:**

- `escalationCount` increments atomically inside the transaction.
- `previouslyNotifiedResponderUids` is append-only; the monitor and the admin callable both append.

#### `dispatch_events` — new event types

```typescript
type DispatchEvent =
  | {
      type: 'notification_attempted'
      dispatchId: string
      responderUid: string
      fcmResult: 'sent' | 'no_token' | 'network_error'
      at: number
    }
  | {
      type: 'notification_delivered'
      dispatchId: string
      responderUid: string
      action: 'accepted' | 'declined'
      at: number
    }
  | {
      type: 'deadline_exceeded'
      dispatchId: string
      responderUid: string
      escalationCount: number
      at: number
    }
  | {
      type: 'escalation_attempted'
      dispatchId: string
      fromResponderUid: string
      toResponderUid: string
      reason: string
      at: number
    }
```

All events include `correlationId` and `schemaVersion: 1` (existing pattern).

### 4.3 Escalation Logic (monitorDispatchDeadlines)

```
FOR each pending dispatch where deadline < now AND escalationCount < 1:
    1. Read dispatch doc → get agencyId, municipalityId, reportLocation
    2. Query responders collection:
       - availability == 'available'
       - accountStatus == 'active'
       - NOT in previouslyNotifiedResponderUids
       - (v1) same municipality OR same agency
       - (v2, deferred) order by GPS proximity to reportLocation
    3. If candidate found:
       - Call escalateDispatchCore (reuses dispatch-responder transaction)
       - Append old responderUid to previouslyNotifiedResponderUids
       - Increment escalationCount
       - Write deadline_exceeded + escalation_attempted events
       - Send FCM push to new responder
    4. If no candidate found:
       - Update dispatch status to 'needs_admin'
       - Write deadline_exceeded event
       - Write admin alert to `alerts` collection (so admin sees it in AnomalyAlertBanner)
```

**Important:** `escalationCount` caps at 1 for auto-escalation. Further escalations require admin approval via the `escalateDispatch` callable. This prevents a runaway loop that could notify every responder in the province.

### 4.4 FCM Delivery Tracking

The `dispatchResponder` callable already calls `sendFcmToResponder`. We extend it to:

1. Return the FCM result (`sent`, `no_token`, `network_error`) in the callable response.
2. Write a `notification_attempted` event to `dispatch_events` with the same result.

Admin UI reads this event to show the FCM status immediately.

---

## 5. Admin Desktop UI Design

### 5.1 New Route: `/dispatches`

A dedicated **Dispatch Monitor** page. Accessible from the CommandHeader nav between "Dashboard" and "Map".

### 5.2 Page Structure

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
│   │   • Status (badge: pending | accepted | declined | needs_admin | escalated)
│   │   • Deadline (countdown, turns red at < 2 min)
│   │   • FCM (icon: sent ✓ | no token ⚠ | error ✗)
│   │   • Actions (Re-dispatch button for needs_admin)
│   └── Expanded row: full event timeline
│       • notification_attempted at 14:02:15 (sent)
│       • deadline_exceeded at 14:07:15
│       • escalation_attempted at 14:07:16 → Responder B
│       • notification_delivered at 14:08:03 (accepted)
└── ResponderAvailabilityPanel (bottom)
    └── Live list of available responders with last-seen location freshness
```

### 5.3 Status Visuals

| State                      | Badge                 | Color       | Admin Action                  |
| -------------------------- | --------------------- | ----------- | ----------------------------- |
| `pending` + time remaining | "PENDING — 3m"        | Amber       | None                          |
| `pending` + past deadline  | "EXPIRED"             | Red         | None (auto-escalating)        |
| `accepted`                 | "ACCEPTED"            | Green       | None                          |
| `declined`                 | "DECLINED — reason"   | Gray        | Re-dispatch button            |
| `needs_admin`              | "NEEDS ADMIN" + pulse | Red + alert | Re-dispatch to next responder |
| `escalated`                | "AUTO-ESCALATED"      | Orange      | View history                  |

### 5.4 FCM Delivery Indicator

Per-row small icon:

- ✅ FCM sent and acknowledged by device (from `sendEachForMulticast` success response)
- ⚠️ Responder has no FCM token (`fcm_no_token` warning)
- ❌ FCM network error (`fcm_network_error` warning)

Tooltip on hover shows the exact event time and result.

### 5.5 Re-dispatch Flow

1. Admin clicks "Re-dispatch" on a `needs_admin` row
2. Modal opens: "Select next responder" with a filtered list (excludes previously notified)
3. Admin selects responder, clicks "Dispatch"
4. Calls `escalateDispatch` callable
5. Row updates live via Firestore `onSnapshot`

### 5.6 Cross-Window Sync

Dispatch status changes are broadcast via `WindowSyncProvider` with message type `dispatch:status_changed`. If the admin has `/map` open, dispatch pins update color (pending = amber, accepted = green, needs_admin = red).

### 5.7 Keyboard Shortcuts

- `R` — re-dispatch focused `needs_admin` dispatch
- `Enter` — expand/collapse focused row
- `Escape` — clear selection, close modal

---

## 6. Observability Dashboards

### 6.1 In-App Ops Dashboard (`/ops-dashboard`)

**New page, separate from existing `/dashboard`.** The existing `/dashboard` handles triage queue + verification. `/ops-dashboard` handles operational metrics.

**Audience:** Municipal admin, agency admin, provincial superadmin (role-scoped data).

**Panels:**

| Panel                       | Data                                               | Scope                    |
| --------------------------- | -------------------------------------------------- | ------------------------ |
| **Active Dispatch Summary** | Live counts by status                              | Role-scoped              |
| **Responder Fleet Status**  | Available / On-scene / Off-duty counts             | Role-scoped              |
| **Response Time Trend**     | Median accept time, last 24h, by hour              | Municipality or province |
| **Report Volume**           | Reports received, verified, dispatched, last 24h   | Role-scoped              |
| **Escalation Rate**         | % of dispatches that auto-escalated                | Role-scoped              |
| **FCM Delivery Rate**       | % successful push notifications                    | Role-scoped              |
| **System Alert Feed**       | `alerts` collection (deadline breaches, anomalies) | Role-scoped              |

**Data source:**

- Live panels: Firestore `onSnapshot` on `dispatches`, `responders`, `alerts`
- Historical panels: `getOpsMetrics` callable (pre-aggregated, <500ms)

**Scoped visibility rules:**

- `municipal_admin` → `where('municipalityId', '==', claims.municipalityId)`
- `agency_admin` → `where('agencyId', '==', claims.agencyId)` or `agencyIds array-contains`
- `provincial_superadmin` → unscoped, province-wide

### 6.2 External Dashboards

#### 6.2.1 Cloud Monitoring — SRE / SLA Dashboard

**Metrics source:** Structured logs from Cloud Functions with `logEvent()` / `logDimension()`.

**Log-based metrics to create:**

| Metric Name                           | Filter                                          | Purpose              |
| ------------------------------------- | ----------------------------------------------- | -------------------- |
| `bantayog/dispatch_created`           | `jsonPayload.code="dispatch.created"`           | Dispatch volume      |
| `bantayog/dispatch_accepted`          | `jsonPayload.code="dispatch.accepted"`          | Acceptance volume    |
| `bantayog/dispatch_declined`          | `jsonPayload.code="dispatch.declined"`          | Decline volume       |
| `bantayog/dispatch_deadline_exceeded` | `jsonPayload.code="dispatch.deadline_exceeded"` | SLA breach           |
| `bantayog/dispatch_escalated`         | `jsonPayload.code="dispatch.escalated"`         | Escalation rate      |
| `bantayog/fcm_sent`                   | `jsonPayload.code="fcm.sent"`                   | Push volume          |
| `bantayog/fcm_failed`                 | `jsonPayload.code="fcm.failed"`                 | Push failure rate    |
| `bantayog/callable_latency`           | All callable logs with `latencyMs` field        | Function performance |
| `bantayog/callable_error`             | Callable logs with `severity=ERROR`             | Error rate           |

**Dashboards:**

1. **Dispatch SLA Dashboard**
   - Time-series: dispatches created vs accepted vs deadline_exceeded
   - Alert: deadline_exceeded rate > 5% in 10-minute window
   - Alert: callable_latency p99 > 3s

2. **Function Health Dashboard**
   - Error rate by callable name
   - Cold start latency
   - Active instance count

#### 6.2.2 BigQuery — Compliance / Audit Dashboard

**Data pipeline:**

```
Cloud Functions structured logs
    │
    ▼
Cloud Logging log sink → BigQuery dataset `bantayog_audit`
    │
    ├──▶ Table: `dispatch_events` (all dispatch lifecycle events)
    ├──▶ Table: `report_events` (all report state changes)
    ├──▶ Table: `audit_events` (RA 10173 erasure, data incidents)
    └──▶ Table: `function_invocations` (callable latency, errors)
```

**Scheduled queries (daily):**

| Query                       | Output Table                  | Purpose                                   |
| --------------------------- | ----------------------------- | ----------------------------------------- |
| Daily dispatch summary      | `daily_dispatch_summary`      | Response time percentiles by municipality |
| Daily responder utilization | `daily_responder_utilization` | Availability rate, shift coverage         |
| Erasure audit trail         | `erasure_audit`               | RA 10173 compliance proof                 |
| Data incident timeline      | `incident_timeline`           | DPA incident response documentation       |

**Dashboards:**

1. **Compliance Dashboard** (BigQuery Data Studio / Looker)
   - Erasure requests processed / pending / denied
   - Data incident response time (detected → resolved)
   - Retention policy adherence rate

2. **Cost Dashboard** (Cloud Billing export to BigQuery)
   - Daily cost by service (Firestore, Functions, FCM, Storage)
   - Cost per dispatch (total cost / dispatches created)
   - Projected monthly spend

#### 6.2.3 Alerting Rules

| Alert                      | Condition                                   | Notification           |
| -------------------------- | ------------------------------------------- | ---------------------- |
| High dispatch failure rate | `deadline_exceeded / created > 0.05` in 10m | PagerDuty / Slack #ops |
| FCM delivery failure spike | `fcm_failed / fcm_sent > 0.10` in 10m       | Slack #ops             |
| Callable error rate        | `callable_error > 5` in 5m                  | PagerDuty              |
| Function latency           | `callable_latency p99 > 3000ms` in 15m      | Slack #perf            |
| Cost anomaly               | Daily cost > 150% of 7-day moving average   | Slack #finance         |

---

## 7. API Contracts

### 7.1 `dispatchResponder` callable — extended response

```typescript
// Request (unchanged)
{
  reportId: string
  responderUid: string
  idempotencyKey: string
}

// Response (new field)
{
  dispatchId: string
  status: 'pending'
  reportId: string
  correlationId: string
  fcmResult: 'sent' | 'no_token' | 'network_error' // NEW
}
```

### 7.2 `escalateDispatch` callable — new

```typescript
// Request
{
  dispatchId: string
  newResponderUid: string
  idempotencyKey: string
  reason: 'deadline_exceeded' | 'declined' | 'admin_override'
}

// Response
{
  newDispatchId: string
  status: 'pending'
  reportId: string
  fcmResult: 'sent' | 'no_token' | 'network_error'
}
```

**Auth:** `municipal_admin` or `provincial_superadmin`, same as `dispatchResponder`.
**Rate limit:** 30/min per admin UID.

### 7.3 `getOpsMetrics` callable — new

```typescript
// Request
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
    fcmSuccessRate: number  // 0.0–1.0
    responderAvailabilityRate: number  // 0.0–1.0
  }
}
```

**Auth:** Any admin role (`municipal_admin`, `agency_admin`, `provincial_superadmin`).
**Implementation:** Firestore aggregation queries on `dispatches` and `responders`. No BigQuery dependency — must return in <500ms.

---

## 8. Frontend Changes

### 8.1 New Files

| File                                                               | Purpose                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------- |
| `apps/admin-desktop/src/pages/DispatchMonitorPage.tsx`             | Main dispatch monitor page                              |
| `apps/admin-desktop/src/components/DispatchLifecycleTable.tsx`     | Table with expandable rows                              |
| `apps/admin-desktop/src/components/DispatchStatsCards.tsx`         | Top-row stat cards                                      |
| `apps/admin-desktop/src/components/EscalationQueueSection.tsx`     | "Needs admin" dispatch queue                            |
| `apps/admin-desktop/src/components/ResponderAvailabilityPanel.tsx` | Live responder list                                     |
| `apps/admin-desktop/src/components/FcmStatusIcon.tsx`              | FCM delivery status icon                                |
| `apps/admin-desktop/src/components/DispatchTimeline.tsx`           | Expanded row timeline                                   |
| `apps/admin-desktop/src/components/ReDispatchModal.tsx`            | Admin re-dispatch modal                                 |
| `apps/admin-desktop/src/pages/OpsDashboardPage.tsx`                | In-app ops dashboard                                    |
| `apps/admin-desktop/src/components/OpsMetricCard.tsx`              | Reusable metric card                                    |
| `apps/admin-desktop/src/hooks/useDispatchLifecycle.ts`             | Firestore subscription for dispatch events + dispatches |
| `apps/admin-desktop/src/hooks/useOpsMetrics.ts`                    | `getOpsMetrics` callable wrapper                        |
| `apps/admin-desktop/src/services/callables.ts`                     | Add `escalateDispatch`, `getOpsMetrics` wrappers        |

### 8.2 Modified Files

| File                                                      | Change                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------- |
| `apps/admin-desktop/src/routes.tsx`                       | Add `/dispatches` and `/ops-dashboard` routes                 |
| `apps/admin-desktop/src/components/CommandHeader.tsx`     | Add nav links to Dispatch Monitor and Ops Dashboard           |
| `apps/admin-desktop/src/services/callables.ts`            | Extend `dispatchResponder` return type to include `fcmResult` |
| `apps/admin-desktop/src/stores/commandCenterStore.ts`     | Add `dispatchId` to selection state for cross-window sync     |
| `apps/admin-desktop/src/providers/WindowSyncProvider.tsx` | Add `dispatch:status_changed` message type                    |

### 8.3 `useDispatchLifecycle` Hook

```typescript
// Subscribes to dispatches + dispatch_events for a scope
// Returns live rows with merged event timeline

interface DispatchLifecycleRow {
  dispatchId: string
  reportId: string
  reportType: string
  responderName: string
  responderAgency: string
  status: DispatchStatus | 'needs_admin'
  dispatchedAt: number
  deadlineAt: number
  escalationCount: number
  fcmResult: 'sent' | 'no_token' | 'network_error' | null
  timeline: DispatchEvent[]
}

function useDispatchLifecycle(scope: { municipalityId?: string; agencyId?: string })
```

**Implementation:**

- Firestore `onSnapshot` on `dispatches` scoped by `municipalityId` or `agencyId`
- Per-dispatch `onSnapshot` on `dispatch_events` subcollection (or query by `dispatchId`)
- Merge and sort events by `at` timestamp

### 8.4 `useOpsMetrics` Hook

```typescript
function useOpsMetrics(timeRange: '1h' | '24h' | '7d'): {
  metrics: OpsMetrics | null
  loading: boolean
  error: string | null
}
```

Polls `getOpsMetrics` callable every 60 seconds. No Firestore subscription needed for historical aggregates.

---

## 9. Testing Strategy

### 9.1 Backend Tests

| Test File                                                                   | Coverage                                                                    |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `functions/src/__tests__/callables/dispatch-responder-fcm-tracking.test.ts` | `notification_attempted` event written, `fcmResult` returned                |
| `functions/src/__tests__/callables/monitor-dispatch-deadlines.test.ts`      | Deadline detection, auto-escalation once, `needs_admin` when no candidates  |
| `functions/src/__tests__/callables/escalate-dispatch.test.ts`               | Admin re-dispatch, rate limiting, idempotency, previouslyNotified exclusion |
| `functions/src/__tests__/callables/get-ops-metrics.test.ts`                 | Aggregation correctness, role scoping, time range filtering                 |
| `functions/src/__tests__/callables/accept-dispatch-event.test.ts`           | `notification_delivered` event written                                      |
| `functions/src/__tests__/callables/decline-dispatch-event.test.ts`          | `notification_delivered` event written                                      |

### 9.2 Frontend Tests

| Test File                                                          | Coverage                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------ |
| `apps/admin-desktop/src/__tests__/DispatchLifecycleTable.test.tsx` | Row rendering, expansion, status badges                      |
| `apps/admin-desktop/src/__tests__/DispatchMonitorPage.test.tsx`    | Page layout, Firestore subscription wiring, re-dispatch flow |
| `apps/admin-desktop/src/__tests__/EscalationQueueSection.test.tsx` | Needs-admin queue, re-dispatch button visibility             |
| `apps/admin-desktop/src/__tests__/FcmStatusIcon.test.tsx`          | Icon states, tooltip                                         |
| `apps/admin-desktop/src/__tests__/OpsDashboardPage.test.tsx`       | Metric cards, `getOpsMetrics` polling, role scoping          |
| `apps/admin-desktop/src/__tests__/useDispatchLifecycle.test.ts`    | Firestore subscription, event merging, timeline sort         |

### 9.3 E2E Tests

| Test                    | Flow                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Full dispatch lifecycle | Admin dispatches → responder accepts → admin sees "ACCEPTED" in monitor                                         |
| Deadline escalation     | Admin dispatches → responder ignores → monitor auto-escalates → admin sees "AUTO-ESCALATED"                     |
| Admin re-dispatch       | Admin dispatches → responder declines → admin clicks Re-dispatch → selects new responder → new dispatch created |
| FCM failure visibility  | Responder has no FCM token → admin sees ⚠️ icon immediately                                                     |

---

## 10. Rollout Plan

### Phase 1: Backend Foundation (1–2 days)

1. Extend `dispatchResponder` to write `notification_attempted` and return `fcmResult`
2. Extend `acceptDispatch` and `declineDispatch` to write `notification_delivered`
3. Create `monitorDispatchDeadlines` scheduled function
4. Create `escalateDispatch` callable
5. Add `escalationCount` and `previouslyNotifiedResponderUids` to `dispatches` writes
6. Backend tests for all new functions

### Phase 2: Admin Desktop Dispatch Monitor (2–3 days)

1. Create `useDispatchLifecycle` hook
2. Build `DispatchLifecycleTable`, `EscalationQueueSection`, `DispatchStatsCards`
3. Build `ReDispatchModal`
4. Create `/dispatches` page, wire into routes + header
5. Add cross-window sync for dispatch status changes
6. Frontend tests

### Phase 3: In-App Ops Dashboard (2 days)

1. Create `getOpsMetrics` callable
2. Create `useOpsMetrics` hook
3. Build `OpsDashboardPage` with metric cards + live panels
4. Wire `/ops-dashboard` route + header nav
5. Frontend + backend tests

### Phase 4: External Observability (2–3 days)

1. Add structured log fields for all new events
2. Create Cloud Monitoring log-based metrics
3. Build Cloud Monitoring dashboards (Dispatch SLA, Function Health)
4. Set up BigQuery log sink for `dispatch_events`, `audit_events`
5. Create BigQuery scheduled queries
6. Build compliance + cost dashboards
7. Create alerting rules

### Phase 5: Integration & Hardening (1–2 days)

1. E2E tests on emulator
2. Performance test: `getOpsMetrics` <500ms with 10k dispatches
3. Load test: `monitorDispatchDeadlines` with 500 pending dispatches
4. Review and tighten Firestore rules for new fields
5. Update `docs/learnings.md` with any new gotchas

**Total estimate:** 8–12 days of focused implementation.

---

## 11. Risks & Mitigations

| Risk                                                               | Likelihood | Impact             | Mitigation                                                                                                                                                   |
| ------------------------------------------------------------------ | ---------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `monitorDispatchDeadlines` fires too frequently and costs too much | Medium     | Cost               | Start with 1-minute cron; monitor invocation count. Can reduce to 5-minute if volume is low.                                                                 |
| Auto-escalation notifies too many responders, creating noise       | Low        | Operational        | Cap at 1 auto-escalation. Admin must approve further.                                                                                                        |
| Firestore `in` query on `status` exceeds 30-item limit             | Medium     | Breakage           | `monitorDispatchDeadlines` uses a range query on `acknowledgementDeadlineAt` + `status == 'pending'` composite index, not `status in [...]`.                 |
| `dispatch_events` subcollection query per dispatch is too chatty   | Medium     | Performance        | Use a top-level `dispatch_events` collection with `where('dispatchId', '==', id)` and `orderBy('at')`. Firestore charges 1 read per event, not per listener. |
| BigQuery log sink setup requires elevated IAM permissions          | Low        | Deployment blocker | Document exact IAM roles needed (`roles/logging.configWriter`, `roles/bigquery.dataEditor`).                                                                 |

---

## 12. Open Questions

None — all clarified during brainstorming session.

---

## 13. Spec Self-Review Checklist

- [x] **Placeholder scan:** No TBDs, TODOs, or vague requirements.
- [x] **Internal consistency:** Architecture matches feature descriptions. Escalation cap at 1 is stated in multiple places consistently.
- [x] **Scope check:** Two related features (dispatch hardening + observability) but share the same backend event infrastructure. Kept in one spec because the observability dashboards depend on the dispatch events.
- [x] **Ambiguity check:** All requirements are explicit. Auto-escalation cap = 1. FCM result values are enumerated. Role scoping rules are explicit.

---

## 14. Approval

**Design presented:** 2026-05-19
**User approval:** ✅
**Spec written:** 2026-05-19
**Next step:** Invoke `writing-plans` skill to create implementation plan.
