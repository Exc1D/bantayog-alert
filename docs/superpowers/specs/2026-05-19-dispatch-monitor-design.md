# Design Spec: Admin Desktop Dispatch Monitor

**Date:** 2026-05-19
**Status:** Approved (Post-Review v2)
**Owner:** Senior Pragmatic Engineer (AI)

## 1. Overview

The Dispatch Monitor is the operational heart of the admin desktop. It provides real-time visibility into the dispatch lifecycle, identifies "stalled" dispatches that failed auto-escalation, and allows admins to manually re-assign dispatches to new responders.

### Goals

- **Zero-Latency Visibility:** Use a "Heavy Hook" pattern to merge dispatch and event streams for instant UI response.
- **Actionable Intelligence:** Surface "Needs Admin" dispatches in a high-priority queue.
- **High-Friction Prevention:** Use a "Smart Suggester" to minimize cognitive load of manual re-dispatching.
- **Concurrency Safety:** All state transitions protected by Firestore transactions + server-side validation.

---

## 2. Technical Architecture

### 2.1 Data Layer: `useDispatchLifecycle` Hook

The hook implements a client-side merge of two Firestore collections to provide a unified "Lifecycle Row" state.

**Input:**

- `claims`: User role and scope (`municipalityId` / `agencyId`).

**Listeners:**

1. **Dispatch Stream:** `collection('dispatches')` filtered by scope and `status IN ['pending', 'accepted', 'declined', 'needs_admin']`. Limited to 100 docs per scope (municipality/agency) or 100 global for province, ordered by `dispatchedAt DESC`.
2. **Event Stream:** `collection('dispatch_events')` filtered by scope and `where('at', '>', now - 24h)`, ordered by `at DESC`. **Requires composite index:** `dispatch_events` collection with fields `[at ASCENDING, municipalityId ASCENDING]` (or `agencyId ASCENDING` for agency scope). Index already added in Phase 1 Task 8.

**Merge Logic:**

- The hook maintains a `Map<dispatchId, dispatchData>` and a `Map<dispatchId, DispatchEvent[]>`.
- On every snapshot update, it recalculates the merged `DispatchLifecycleRow[]` list.
- **Re-render protection:** Merge function wrapped in `useMemo`. Snapshot processing debounced to 100ms to prevent storm during high event volume.
- **Error handling:** Hook exposes `error` state. UI renders `<OfflineBanner>` or "Connection lost" toast with auto-retry.

**Complexity:**

- Time: $O(N + E)$ where $N \le 100$ and $E$ is 24h events.
- Memory: Bounded by 24h window. At scale, ~2-5MB per admin session.

### 2.2 Data Layer: `useResponderFleet` Hook

Single Firestore listener for available responders.

**Query:**

- `where('availabilityStatus', '==', 'available')`
- `where('accountStatus', '==', 'active')`
- `where('lastSeenAt', '>', now - 5 minutes)`
- Scope-filtered by `municipalityId` or `agencyId`

**Online Status Derivation:**

- "Online": `lastSeenAt > now - 5 minutes`
- "Away": `5-30 minutes`
- "Offline": `> 30 minutes`

---

## 3. Component Design

### 3.1 Ops Pulse Header (`DispatchStatsCards`)

A row of 4 compact cards providing aggregate health:

- **Active Now:** Total dispatches in non-terminal states.
- **Stalled:** Count of `needs_admin` dispatches.
- **Avg Accept Time:** Derived from `getOpsMetrics` (cached).
- **FCM Health:** % of successful attempts vs failures.

### 3.2 Escalation Queue (`EscalationQueueSection`)

A high-contrast area appearing only when `needs_admin` count > 0.

- **Display:** Horizontal scrolling list of stalled dispatch cards.
- **Action:** "Re-dispatch" button opens the `ReDispatchModal`.

### 3.3 Smart Suggester (`ReDispatchModal`)

The modal for resolving stalled dispatches. **Two-step confirmation** (select → confirm dialog → execute).

**Candidate Selection Logic:**

1. **Recommended (Top 3):** Sorted by `lastSeenAt DESC`, then municipality match, then availability duration.
2. **Fallback Expansion:** If < 3 local candidates:
   - Same agency, different municipality
   - Neighboring municipalities (centroid distance ≤ 50km via existing `reverseGeocodeToMunicipality` logic)
   - "No candidates available" with manual override option
3. **Manual Search:** Full searchable list of active responders in expanded scope.

**Constraints:**

- Filters out `previouslyNotifiedResponderUids` (UX-only; server re-validates).
- `previouslyNotifiedResponderUids` capped at 50 entries (oldest rotated via `arrayRemove`).
- **Deadlock escape hatch:** If exclusion list eliminates ALL candidates, "Force Re-notify" button appears. Admin confirms "This responder was already notified. Re-notify?" Server accepts `forceOverride: true` flag to bypass the previously-notified check. This is the guaranteed resolution path for single-responder municipalities.

**Idempotency:**

- Per-click UUID v4 generated client-side, server-validated with 5min TTL.

**Action:** Calls `escalateDispatch` callable with rate limiting (10/min per admin, 3/hour per dispatch).

### 3.4 Lifecycle Table (`DispatchLifecycleTable`)

The main feed of live-updating dispatches.

- **Columns:** Report ID, Responder, Status (Badge), Deadline, FCM Status (Icon), Actions.
- **Expanding Rows:** Toggles the `DispatchTimeline` view (data pre-loaded by Heavy Hook).
- **Virtualization:** `react-window` `FixedSizeList` for table body to prevent DOM explosion at 100+ dispatches.

### 3.5 Event Timeline (`DispatchTimeline`)

A vertical sequence of events mapped from `DispatchEvent` documents:

- `notification_attempted` → "FCM Sent"
- `notification_delivered` → "Responder Notified"
- `deadline_exceeded` → "Deadline Passed"
- `escalation_attempted` → "Re-assigned"
- **Unknown types:** Render as generic event with raw type label (no silent drops).

### 3.6 Fleet Status (`ResponderAvailabilityPanel`)

A side panel providing a live view of the responder pool:

- Sorts by `lastSeenAt` DESC.
- Visual indicators for online/away/offline and available/busy.

---

## 4. Data Flow & Interactions

### 4.1 Manual Re-dispatch Flow

1. Admin clicks "Re-dispatch" in `EscalationQueue`.
2. `ReDispatchModal` opens → `useResponderFleet` provides candidates.
3. Admin selects a responder → confirmation dialog → calls `escalateDispatch`.
4. **Server-side validation:**
   - Rate limit check (10/min per admin, 3/hour per dispatch)
   - Responder active + not previously notified
   - Lease check: if `monitorLeaseAt` active (< 120s), reject with `lease-active` error
   - Idempotency key validation
5. Backend updates `assignedTo`, increments `escalationCount`, writes `escalation_attempted` event.
6. **FCM sent AFTER transaction commits** (never before).
7. Firestore listener triggers → Row status flips from `needs_admin` to `pending` → Card moves from Queue to Table.

### 4.2 Concurrency Guards

- **Dual acceptance race:** `acceptDispatch` uses Firestore transaction with `status == 'pending'` precondition. UI handles `failed-precondition` with "Already accepted" toast.
- **Monitor lease race:** Admin callable checks `monitorLeaseAt`. If active, rejects. Admin can force-override with explicit "Steal lease" confirmation (audit logged).
- **Simultaneous re-dispatch:** Second admin's call fails with `dispatch-already-reassigned` error. UI shows toast.
- **Lease steal audit:** When admin force-overrides an active monitor lease, a `lease_stolen` event is written to `dispatch_events` with fields: `{ type: 'lease_stolen', dispatchId, adminUid, reason, stolenFromMonitorRunId, at: serverTimestamp() }`.

### 4.3 Cancellation Flow

- `cancelDispatch` callable writes `dispatch_cancelled` event.
- Triggers FCM "Stand down" notification to assigned responder.
- Row removed from table or marked as cancelled.

---

## 5. Non-Functional Requirements

### 5.1 Performance

- **No-Refresh Updates:** All components use `onSnapshot` streams.
- **Throttled Merges:** `useMemo` + 100ms debounce on snapshot processing.
- **Virtualization:** Windowed table rendering for 100+ dispatches.

### 5.2 Security

- **Server-Sourced Scope:** Hook derives Firestore queries from `claims` in auth token.
- **Server-Side Validation:** UI filters are UX-only. Server **must** re-validate all constraints (rate limits, previously notified, lease status).
- **Rate Limiting:** `escalateDispatch` enforced at 10/min per admin, 3/hour per dispatch.

### 5.3 Data Retention

- **dispatch_events:** 30-day TTL via Cloud Scheduler `pruneDispatchEvents` job.
- **previouslyNotifiedResponderUids:** Capped at 50 entries with FIFO rotation.
- **fcm_retry_queue:** Max 3 attempts, then `permanent_failure` + dead-letter logging.

### 5.4 Scheduled Function Overflow Strategy

`monitorDispatchDeadlines` uses `maxInstances: 3` (up from 1) with lease-based dedup. During disasters, up to 3 instances run concurrently, each processing a disjoint set of dispatches via the lease mechanism. Cloud Scheduler's max queue size is 1, so if all 3 instances are busy, the next invocation is queued (not dropped). For sustained overload, Cloud Tasks can replace Scheduler for unbounded fan-out (future work).

### 5.5 Cost Model

`monitorDispatchDeadlines` uses `maxInstances: 3` (up from 1) with lease-based dedup. During disasters, up to 3 instances run concurrently, each processing a disjoint set of dispatches via the lease mechanism. Cloud Scheduler's max queue size is 1, so if all 3 instances are busy, the next invocation is queued (not dropped). For sustained overload, Cloud Tasks can replace Scheduler for unbounded fan-out (future work).

- 2 listeners × 50 admins = 100 persistent listeners.
- Mitigated by 24h event window + 100 dispatch limit per scope (municipality/agency) or 100 global for province.
- Estimated ~$15/mo at 50 admins.

### 5.6 Testing Strategy

- **Hook Tests:** Mock Firestore snapshots to verify merge logic (events grouped by `dispatchId`, 24h window enforced).
- **Modal Tests:** Verify `previouslyNotifiedResponderUids` filtered client-side, server re-validates.
- **Concurrency Tests:** Simulate dual accept, simultaneous re-dispatch, monitor lease collision.
- **UI Tests:** Verify `needs_admin` dispatches appear in Escalation Queue, error states render banners.

---

## 6. Known Limitations & Future Work

| ID  | Issue                                                                     | Status                                              |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| M1  | dispatchId collision on re-dispatch of same responder to same report      | Track: silent history overwrite possible (low risk) |
| M8  | Clock skew between `Date.now()` and `Timestamp.now()` across functions    | Track: use server timestamps consistently           |
| M9  | getOpsMetrics / fcmSuccessRate sources can diverge if counter write fails | Track: eventual consistency acceptable              |
| M10 | Hard-coded magic numbers (500 cap, 100 max, 3 candidates)                 | Future: move to `system_config/monitor`             |

---

## 7. State Machine Clarification

**Removed:** `escalated` status (unreachable dead code).
**Terminal admin-intervention state:** `needs_admin` only.

Valid transitions:

- `pending` → `accepted` / `declined` / `needs_admin` / `cancelled`
- `accepted` → `acknowledged` / `needs_admin` (timeout) / `cancelled`
- `needs_admin` → `pending` (admin re-dispatch) / `cancelled`

**Accepted Timeout Mechanism:**
When a responder accepts, `acceptedDeadlineAt` is set to `now + 5 minutes` (server timestamp). The monitor cron (`monitorDispatchDeadlines`) queries `accepted` dispatches where `acceptedDeadlineAt < now` AND no `acknowledged` event exists. If exceeded, the dispatch is flipped to `needs_admin` with reason `acceptance_timeout`. This prevents ghost dispatches when a responder's phone dies after accepting. The monitor query is extended to: `where('status', 'in', ['pending', 'accepted'])` with a secondary check on `acceptedDeadlineAt` for accepted dispatches.
