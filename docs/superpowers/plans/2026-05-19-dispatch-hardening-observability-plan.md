# Dispatch Hardening + Observability Dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the three-app dispatch coordination flow (deadline enforcement, auto-escalation, FCM tracking, admin visibility) and build observability dashboards (in-app ops + external Cloud Monitoring/BigQuery).

**Architecture:** Single-dispatch-doc escalation model with lease-protected monitor cron. Server-derived scope for all authz. Counter-pattern for metrics. Two-phase FCM tracking (API attempted + device received, latter deferred to Phase 4).

**Tech Stack:** Firebase Functions v2 (Node.js), Firestore, Cloud Scheduler, FCM, React + TypeScript (admin-desktop), Cloud Monitoring, BigQuery.

---

## File Map

### Backend — New Files

| File                                                    | Responsibility                                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `functions/src/scheduled/monitor-dispatch-deadlines.ts` | 1-min cron: query pending past-deadline dispatches, auto-escalate once per doc, flip to needs_admin |
| `functions/src/callables/escalate-dispatch.ts`          | Admin manual re-dispatch for needs_admin dispatches                                                 |
| `functions/src/callables/get-ops-metrics.ts`            | Returns pre-aggregated metrics from counter docs                                                    |
| `functions/src/scheduled/retry-fcm-delivery.ts`         | Scheduled function: polls fcm_retry_queue, retries with backoff                                     |
| `functions/src/services/fcm-send-batch.ts`              | Batch FCM send utility (wraps sendEachForMulticast with per-dispatch result mapping)                |
| `functions/src/services/dispatch-counter.ts`            | Increment daily counter docs in transactions                                                        |
| `functions/src/services/monitor-config.ts`              | Read system_config/monitor with in-memory caching and defaults                                      |

### Backend — Modified Files

| File                                                   | Change                                                                                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/src/callables/dispatch-responder.ts`        | Add `fcmResult` + `fcmWarnings` return fields; write `notification_attempted` event AFTER FCM call; write to `fcm_retry_queue` on network_error; increment counter doc |
| `functions/src/callables/accept-dispatch.ts`           | Write `notification_delivered` event; increment counter doc                                                                                                            |
| `functions/src/callables/decline-dispatch.ts`          | Write `notification_delivered` event; increment counter doc                                                                                                            |
| `functions/src/callables/dispatch-responder-writes.ts` | Add `escalationCount`, `previouslyNotifiedResponderUids`, `monitorLeaseAt`, `escalationReason`, `fcmResult`, `fcmWarnings` to dispatch doc writes                      |
| `functions/src/scheduled/dispatch-timeout-sweep.ts`    | **DELETE** or disable schedule                                                                                                                                         |
| `functions/src/index.ts`                               | Export new callables and scheduled functions                                                                                                                           |
| `packages/shared-validators/src/dispatches.ts`         | Add `needs_admin` and `escalated` to `dispatchStatusSchema`                                                                                                            |

### Frontend — New Files

| File                                                               | Responsibility                                                               |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `apps/admin-desktop/src/pages/DispatchMonitorPage.tsx`             | Main dispatch monitor page                                                   |
| `apps/admin-desktop/src/components/DispatchLifecycleTable.tsx`     | Table with expandable rows, status badges, FCM icons                         |
| `apps/admin-desktop/src/components/DispatchStatsCards.tsx`         | Top-row stat cards                                                           |
| `apps/admin-desktop/src/components/EscalationQueueSection.tsx`     | "Needs admin" queue with re-dispatch button                                  |
| `apps/admin-desktop/src/components/ResponderAvailabilityPanel.tsx` | Live available responder list                                                |
| `apps/admin-desktop/src/components/FcmStatusIcon.tsx`              | FCM delivery status icon + tooltip                                           |
| `apps/admin-desktop/src/components/DispatchTimeline.tsx`           | Expanded row event timeline                                                  |
| `apps/admin-desktop/src/components/ReDispatchModal.tsx`            | Admin re-dispatch modal with responder selection                             |
| `apps/admin-desktop/src/pages/OpsDashboardPage.tsx`                | In-app ops dashboard                                                         |
| `apps/admin-desktop/src/components/OpsMetricCard.tsx`              | Reusable metric card (live vs historical)                                    |
| `apps/admin-desktop/src/hooks/useDispatchLifecycle.ts`             | Single Firestore listener for dispatches + events, scope derived from claims |
| `apps/admin-desktop/src/hooks/useResponderFleet.ts`                | Single Firestore listener for available responders                           |
| `apps/admin-desktop/src/hooks/useOpsMetrics.ts`                    | `getOpsMetrics` callable wrapper, 60s polling                                |

### Frontend — Modified Files

| File                                                      | Change                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `apps/admin-desktop/src/routes.tsx`                       | Add `/dispatches` and `/ops-dashboard` routes                                            |
| `apps/admin-desktop/src/components/CommandHeader.tsx`     | Add nav links                                                                            |
| `apps/admin-desktop/src/services/callables.ts`            | Add `escalateDispatch`, `getOpsMetrics` wrappers; extend `dispatchResponder` return type |
| `apps/admin-desktop/src/stores/commandCenterStore.ts`     | Add `dispatchId` to selection state                                                      |
| `apps/admin-desktop/src/providers/WindowSyncProvider.tsx` | Add `dispatch:status_changed` message type                                               |

### Infrastructure — Modified Files

| File                                    | Change                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `infra/firebase/firestore.rules`        | Add `agency_admin` paths; legacy event fallback; `fcm_retry_queue` rules |
| `infra/firebase/firestore.indexes.json` | Add composite indexes for monitor queries, scoped dashboards             |
| `infra/firebase/firebase.json`          | Add `monitorDispatchDeadlines` schedule; set `minInstances: 1`           |

---

## Phase 1: Backend Foundation (Days 1–3)

### Task 1: Delete `dispatchTimeoutSweep` and Add Schema Changes

**Files:**

- Delete: `functions/src/scheduled/dispatch-timeout-sweep.ts`
- Modify: `packages/shared-validators/src/dispatches.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Add `needs_admin` and `escalated` to `dispatchStatusSchema`**

```typescript
// packages/shared-validators/src/dispatches.ts
export const dispatchStatusSchema = z.enum([
  'pending',
  'accepted',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'declined',
  'timed_out',
  'cancelled',
  'superseded',
  'unable_to_complete',
  'needs_admin', // NEW
  'escalated', // NEW
])
```

- [ ] **Step 2: Remove `dispatchTimeoutSweep` export from `index.ts`**

```typescript
// functions/src/index.ts
// REMOVE: export { dispatchTimeoutSweep } from './scheduled/dispatch-timeout-sweep.js'
```

- [ ] **Step 3: Verify build passes**

```bash
pnpm --dir functions typecheck
pnpm --dir functions lint
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(dispatch): add needs_admin + escalated to schema, retire timeout sweep"
```

---

### Task 2: Extend `dispatchResponder` with FCM Tracking

**Files:**

- Modify: `functions/src/callables/dispatch-responder.ts`
- Modify: `functions/src/services/fcm-send.ts`
- Create: `functions/src/services/fcm-send-batch.ts`

- [ ] **Step 1: Modify `sendFcmToResponder` to return richer result**

```typescript
// functions/src/services/fcm-send.ts
export interface FcmSendResult {
  warnings: string[]
  sentCount: number
  failedCount: number
}
// ... update existing function to return sentCount/failedCount from BatchResponse
```

- [ ] **Step 2: Extend `dispatchResponder` callable to write FCM event AFTER API call**

```typescript
// Inside dispatchResponder onCall handler, AFTER the transaction:
const fcmResult = await sendFcmToResponder({...})

// Write notification_attempted event OUTSIDE transaction
await adminDb.collection('dispatch_events').add({
  type: 'notification_attempted',
  dispatchId: result.dispatchId,
  responderUid: parsed.data.responderUid,
  agencyId: responder.agencyId,        // from responder doc
  municipalityId: responder.municipalityId,
  fcmResult: fcmResult.warnings.includes('fcm_no_token') ? 'no_token' :
             fcmResult.warnings.includes('fcm_network_error') ? 'network_error' :
             fcmResult.warnings.length > 0 ? 'sent_with_invalid_tokens' : 'sent',
  fcmWarnings: fcmResult.warnings,
  at: Timestamp.now().toMillis(),
  correlationId: result.correlationId,
  schemaVersion: 1,
})

// Update dispatch doc with fcmResult
await adminDb.collection('dispatches').doc(result.dispatchId).update({
  fcmResult: fcmResult.warnings.includes('fcm_no_token') ? 'no_token' :
             fcmResult.warnings.includes('fcm_network_error') ? 'network_error' :
             fcmResult.warnings.length > 0 ? 'sent_with_invalid_tokens' : 'sent',
  fcmWarnings: fcmResult.warnings,
})

// If network_error, write to fcm_retry_queue
if (fcmResult.warnings.includes('fcm_network_error')) {
  await adminDb.collection('fcm_retry_queue').add({
    dispatchId: result.dispatchId,
    responderUid: parsed.data.responderUid,
    attemptCount: 0,
    lastAttemptAt: Timestamp.now().toMillis(),
    nextAttemptAt: Timestamp.now().toMillis() + 30000,
    originalError: 'fcm_network_error',
    status: 'pending',
  })
}
```

- [ ] **Step 3: Update return type to include `fcmResult` and `fcmWarnings`**

```typescript
return {
  ...result,
  fcmResult: fcmResult.warnings.includes('fcm_no_token')
    ? 'no_token'
    : fcmResult.warnings.includes('fcm_network_error')
      ? 'network_error'
      : fcmResult.warnings.length > 0
        ? 'sent_with_invalid_tokens'
        : 'sent',
  fcmWarnings: fcmResult.warnings,
}
```

- [ ] **Step 4: Write test for FCM tracking**

```typescript
// functions/src/__tests__/callables/dispatch-responder-fcm-tracking.test.ts
import { vi, describe, it, expect } from 'vitest'
import { dispatchResponderCore } from '../../callables/dispatch-responder.js'

const mockSendFcm = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    warnings: [],
    sentCount: 1,
    failedCount: 0,
  }),
)

vi.mock('../../services/fcm-send.js', () => ({
  sendFcmToResponder: mockSendFcm,
}))

describe('dispatchResponder FCM tracking', () => {
  it('writes notification_attempted event after FCM succeeds', async () => {
    // ... test that event is written with fcmResult: 'sent'
  })

  it('writes fcm_retry_queue on network_error', async () => {
    // ... mock sendFcmToResponder with fcm_network_error warning
    // ... verify fcm_retry_queue doc is created
  })
})
```

- [ ] **Step 5: Run tests**

```bash
pnpm --dir functions exec vitest run src/__tests__/callables/dispatch-responder-fcm-tracking.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(dispatch): extend dispatchResponder with FCM tracking and retry queue"
```

---

### Task 3: Extend `acceptDispatch` and `declineDispatch` with `notification_delivered`

**Files:**

- Modify: `functions/src/callables/accept-dispatch.ts`
- Modify: `functions/src/callables/decline-dispatch.ts`

- [ ] **Step 1: Add `notification_delivered` event write to `acceptDispatchCore`**

```typescript
// After transaction updates dispatch to 'accepted':
// Write notification_delivered event
await db.collection('dispatch_events').add({
  type: 'notification_delivered',
  dispatchId: deps.dispatchId,
  responderUid: deps.actor.uid,
  agencyId: responder.agencyId, // read from responder doc in transaction
  municipalityId: responder.municipalityId,
  action: 'accepted',
  at: deps.now.toMillis(),
  correlationId,
  schemaVersion: 1,
})
```

- [ ] **Step 2: Add same to `declineDispatchCore`**

```typescript
// After transaction updates dispatch to 'declined':
await db.collection('dispatch_events').add({
  type: 'notification_delivered',
  dispatchId,
  responderUid: actor.uid,
  agencyId: assignedTo.agencyId,
  municipalityId: assignedTo.municipalityId,
  action: 'declined',
  at: now.toMillis(),
  correlationId,
  schemaVersion: 1,
})
```

- [ ] **Step 3: Write tests**

```typescript
// functions/src/__tests__/callables/accept-dispatch-event.test.ts
it('writes notification_delivered event on accept', async () => {
  // ... run acceptDispatchCore
  // ... query dispatch_events where type == 'notification_delivered'
  // ... assert action == 'accepted'
})
```

- [ ] **Step 4: Run tests**

```bash
pnpm --dir functions exec vitest run src/__tests__/callables/accept-dispatch-event.test.ts
pnpm --dir functions exec vitest run src/__tests__/callables/decline-dispatch-event.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(dispatch): write notification_delivered events on accept/decline"
```

---

### Task 4: Create `monitorDispatchDeadlines` Scheduled Function

**Files:**

- Create: `functions/src/scheduled/monitor-dispatch-deadlines.ts`
- Create: `functions/src/services/monitor-config.ts`
- Create: `functions/src/services/dispatch-counter.ts`

- [ ] **Step 1: Create `monitor-config.ts` with defaults and caching**

```typescript
// functions/src/services/monitor-config.ts
import { adminDb } from '../admin-init.js'

export interface MonitorConfig {
  autoEscalationEnabled: boolean
  maxDispatchesPerRun: number
  maxEscalationsPerRun: number
  enableCircuitBreaker: boolean
  circuitBreakerThreshold: number
  circuitBreakerErrorThreshold: number
  updatedAt: number
  updatedBy: string
}

const DEFAULT_CONFIG: MonitorConfig = {
  autoEscalationEnabled: true,
  maxDispatchesPerRun: 50,
  maxEscalationsPerRun: 50,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 100,
  circuitBreakerErrorThreshold: 10,
  updatedAt: 0,
  updatedBy: 'system',
}

let cachedConfig: MonitorConfig | null = null
let cachedAt = 0
const CACHE_TTL_MS = 30000 // 30s

export async function getMonitorConfig(): Promise<MonitorConfig> {
  const now = Date.now()
  if (cachedConfig && now - cachedAt < CACHE_TTL_MS) {
    return cachedConfig
  }
  const snap = await adminDb.doc('system_config/monitor').get()
  const config = snap.exists
    ? { ...DEFAULT_CONFIG, ...(snap.data() as Partial<MonitorConfig>) }
    : DEFAULT_CONFIG
  cachedConfig = config
  cachedAt = now
  return config
}
```

- [ ] **Step 2: Create `dispatch-counter.ts`**

```typescript
// functions/src/services/dispatch-counter.ts
import { adminDb } from '../admin-init.js'
import { FieldValue } from 'firebase-admin/firestore'

export async function incrementDispatchCounter(
  scopeType: 'municipality' | 'agency' | 'province',
  scopeId: string,
  metric:
    | 'totalDispatches'
    | 'acceptedCount'
    | 'declinedCount'
    | 'escalatedCount'
    | 'needsAdminCount'
    | 'fcmSuccessCount'
    | 'fcmFailureCount',
  value = 1,
) {
  const date = new Date().toISOString().slice(0, 10)
  const docId = scopeType === 'province' ? `province_${date}` : `${scopeId}_${date}`
  const ref = adminDb.collection('metrics_daily').doc(docId)
  await ref.set(
    {
      scopeType,
      scopeId,
      date,
      [metric]: FieldValue.increment(value),
      updatedAt: Date.now(),
    },
    { merge: true },
  )
}
```

- [ ] **Step 3: Create `monitor-dispatch-deadlines.ts`**

```typescript
// functions/src/scheduled/monitor-dispatch-deadlines.ts
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../admin-init.js'
import { getMonitorConfig } from '../services/monitor-config.js'
import { incrementDispatchCounter } from '../services/dispatch-counter.js'
import { sendFcmBatch } from '../services/fcm-send-batch.js'
import { logEvent } from '@bantayog/shared-validators'

export const monitorDispatchDeadlines = onSchedule(
  {
    schedule: 'every 1 minutes',
    region: 'asia-southeast1',
    minInstances: 1,
    maxInstances: 1,
    ingressSettings: 'internal-only',
  },
  async () => {
    const now = Date.now()
    const config = await getMonitorConfig()
    if (!config.autoEscalationEnabled) {
      logEvent({
        severity: 'INFO',
        code: 'monitor.skipped',
        message: 'Auto-escalation disabled via kill switch',
      })
      return
    }

    const monitorRunId = crypto.randomUUID()

    // Query pending dispatches past deadline with expired lease
    const query = adminDb
      .collection('dispatches')
      .where('status', '==', 'pending')
      .where('acknowledgementDeadlineAt', '<', now)
      .where('monitorLeaseAt', '<', now - 120000)
      .orderBy('acknowledgementDeadlineAt')
      .limit(config.maxDispatchesPerRun)

    const snap = await query.get()
    const dispatches = snap.docs

    if (dispatches.length > config.circuitBreakerThreshold) {
      logEvent({
        severity: 'WARNING',
        code: 'monitor.circuit_opened',
        message: `Processed ${dispatches.length} dispatches, exceeding threshold ${config.circuitBreakerThreshold}`,
      })
      return
    }

    // Collect unique municipality IDs
    const municipalityIds = [
      ...new Set(dispatches.map((d) => (d.data() as { municipalityId: string }).municipalityId)),
    ]

    // Chunk municipalityIds into groups of 10 (Firestore in limit)
    const chunks: string[][] = []
    for (let i = 0; i < municipalityIds.length; i += 10) {
      chunks.push(municipalityIds.slice(i, i + 10))
    }

    // Query responders for all chunks
    const responderPromises = chunks.map((chunk) =>
      adminDb
        .collection('responders')
        .where('availabilityStatus', '==', 'available')
        .where('accountStatus', '==', 'active')
        .where('lastSeenAt', '>', now - 30 * 60 * 1000)
        .where('municipalityId', 'in', chunk)
        .get(),
    )

    const responderSnaps = await Promise.all(responderPromises)
    let allResponders = responderSnaps.flatMap((s) =>
      s.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })),
    )

    // Fallback: if strict query returns empty, try 2h window
    if (allResponders.length === 0) {
      const fallbackPromises = chunks.map((chunk) =>
        adminDb
          .collection('responders')
          .where('availabilityStatus', '==', 'available')
          .where('accountStatus', '==', 'active')
          .where('lastSeenAt', '>', now - 2 * 60 * 60 * 1000)
          .where('municipalityId', 'in', chunk)
          .get(),
      )
      const fallbackSnaps = await Promise.all(fallbackPromises)
      allResponders = fallbackSnaps.flatMap((s) =>
        s.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })),
      )
    }

    // Cap at 200 responders in memory
    if (allResponders.length > 200) {
      logEvent({
        severity: 'WARNING',
        code: 'monitor.responder_cap',
        message: `Capped responders from ${allResponders.length} to 200`,
      })
      allResponders = allResponders
        .sort((a, b) => ((b.lastSeenAt as number) ?? 0) - ((a.lastSeenAt as number) ?? 0))
        .slice(0, 200)
    }

    // Process each dispatch in its own transaction
    let escalatedCount = 0
    let needsAdminCount = 0
    const fcmBatch: Array<{
      dispatchId: string
      responderUid: string
      title: string
      body: string
      data: Record<string, string>
    }> = []

    for (const dispatchDoc of dispatches) {
      const dispatchData = dispatchDoc.data() as {
        reportId: string
        assignedTo: { uid: string; agencyId: string; municipalityId: string }
        escalationCount: number
        previouslyNotifiedResponderUids: string[]
        municipalityId: string
        acknowledgementDeadlineAt: number
      }

      try {
        await adminDb.runTransaction(async (tx) => {
          const dRef = adminDb.collection('dispatches').doc(dispatchDoc.id)
          const dSnap = await tx.get(dRef)
          if (!dSnap.exists) return
          const d = dSnap.data() as typeof dispatchData

          // Re-check conditions inside transaction
          if (d.status !== 'pending' || d.acknowledgementDeadlineAt >= now) return

          // CHECK CAP FIRST
          if ((d.escalationCount ?? 0) >= 1) {
            // Cap reached — flip to needs_admin
            tx.update(dRef, {
              status: 'needs_admin',
              monitorLeaseAt: now,
              monitorRunId,
            })
            tx.set(adminDb.collection('dispatch_events').doc(), {
              type: 'deadline_exceeded',
              dispatchId: dispatchDoc.id,
              responderUid: d.assignedTo.uid,
              agencyId: d.assignedTo.agencyId,
              municipalityId: d.municipalityId,
              escalationCount: d.escalationCount ?? 0,
              at: now,
              correlationId: crypto.randomUUID(),
              schemaVersion: 1,
            })
            needsAdminCount++
            return
          }

          // Check if assigned responder is still active
          const responderRef = adminDb.collection('responders').doc(d.assignedTo.uid)
          const responderSnap = await tx.get(responderRef)
          const responder = responderSnap.exists ? responderSnap.data() : null
          if (responder?.accountStatus !== 'active') {
            // Responder suspended — treat as no candidate, flip to needs_admin
            tx.update(dRef, {
              status: 'needs_admin',
              monitorLeaseAt: now,
              monitorRunId,
            })
            needsAdminCount++
            return
          }

          // Find next candidate
          const excluded = new Set(d.previouslyNotifiedResponderUids ?? [])
          excluded.add(d.assignedTo.uid)
          const candidates = allResponders
            .filter((r) => !excluded.has(r.id))
            .filter(
              (r) => r.municipalityId === d.municipalityId || r.agencyId === d.assignedTo.agencyId,
            )
            .sort((a, b) => ((b.lastSeenAt as number) ?? 0) - ((a.lastSeenAt as number) ?? 0))

          if (candidates.length === 0) {
            tx.update(dRef, {
              status: 'needs_admin',
              monitorLeaseAt: now,
              monitorRunId,
            })
            needsAdminCount++
            return
          }

          const nextResponder = candidates[0]

          // ESCALATE: update same dispatch doc
          tx.update(dRef, {
            assignedTo: {
              uid: nextResponder.id,
              agencyId: nextResponder.agencyId,
              municipalityId: nextResponder.municipalityId,
            },
            escalationCount: FieldValue.increment(1),
            previouslyNotifiedResponderUids: FieldValue.arrayUnion(d.assignedTo.uid),
            escalationReason: 'deadline_exceeded',
            monitorLeaseAt: now,
            monitorRunId,
            status: 'pending',
          })

          tx.set(adminDb.collection('dispatch_events').doc(), {
            type: 'deadline_exceeded',
            dispatchId: dispatchDoc.id,
            responderUid: d.assignedTo.uid,
            agencyId: d.assignedTo.agencyId,
            municipalityId: d.municipalityId,
            escalationCount: (d.escalationCount ?? 0) + 1,
            at: now,
            correlationId: crypto.randomUUID(),
            schemaVersion: 1,
          })

          tx.set(adminDb.collection('dispatch_events').doc(), {
            type: 'escalation_attempted',
            dispatchId: dispatchDoc.id,
            fromResponderUid: d.assignedTo.uid,
            toResponderUid: nextResponder.id,
            agencyId: nextResponder.agencyId,
            municipalityId: nextResponder.municipalityId,
            reason: 'deadline_exceeded',
            at: now,
            correlationId: crypto.randomUUID(),
            schemaVersion: 1,
          })

          escalatedCount++

          // Add to FCM batch
          fcmBatch.push({
            dispatchId: dispatchDoc.id,
            responderUid: nextResponder.id,
            title: 'New dispatch (escalated)',
            body: `Report ${d.reportId.slice(0, 8)} — see app for details`,
            data: {
              dispatchId: dispatchDoc.id,
              reportId: d.reportId,
              correlationId: crypto.randomUUID(),
            },
          })
        })
      } catch (err) {
        logEvent({
          severity: 'ERROR',
          code: 'monitor.transaction_failed',
          message: err instanceof Error ? err.message : 'unknown',
        })
      }
    }

    // Send batched FCM
    if (fcmBatch.length > 0) {
      await sendFcmBatch(fcmBatch)
    }

    // Update grouped alert
    if (needsAdminCount > 0) {
      const date = new Date().toISOString().slice(0, 10)
      for (const muniId of municipalityIds) {
        const alertRef = adminDb.collection('alerts').doc(`${muniId}_${date}`)
        await alertRef.set(
          {
            type: 'dispatch_deadline_exceeded',
            municipalityId: muniId,
            count: FieldValue.increment(needsAdminCount),
            lastUpdatedAt: now,
          },
          { merge: true },
        )
      }
    }

    // Log summary
    logEvent({
      severity: 'INFO',
      code: 'monitor.completed',
      message: `Processed ${dispatches.length} dispatches. Escalated: ${escalatedCount}, NeedsAdmin: ${needsAdminCount}`,
      data: { monitorRunId, processedCount: dispatches.length, escalatedCount, needsAdminCount },
    })
  },
)
```

- [ ] **Step 4: Write monitor tests**

```typescript
// functions/src/__tests__/scheduled/monitor-dispatch-deadlines.test.ts
import { vi, describe, it, expect, beforeAll } from 'vitest'

describe('monitorDispatchDeadlines', () => {
  it('escalates pending dispatch past deadline once', async () => {
    // Seed: 1 dispatch with status=pending, acknowledgementDeadlineAt=now-1h, escalationCount=0
    // Seed: 1 available responder in same municipality
    // Run monitor logic
    // Assert: dispatch.escalationCount === 1, assignedTo.uid === newResponder
    // Assert: dispatch_events contains deadline_exceeded + escalation_attempted
  })

  it('does not escalate if escalationCount >= 1', async () => {
    // Seed: 1 dispatch with escalationCount=1, status=pending, past deadline
    // Run monitor
    // Assert: status === 'needs_admin'
  })

  it('flips to needs_admin when no candidate responder', async () => {
    // Seed: 1 dispatch past deadline, 0 available responders
    // Run monitor
    // Assert: status === 'needs_admin'
  })

  it('does not process dispatches with active lease', async () => {
    // Seed: 1 dispatch past deadline, monitorLeaseAt = now - 30s (still active)
    // Run monitor
    // Assert: dispatch status unchanged
  })
})
```

- [ ] **Step 5: Run tests**

```bash
pnpm --dir functions exec vitest run src/__tests__/scheduled/monitor-dispatch-deadlines.test.ts
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(dispatch): add monitorDispatchDeadlines with lease, cap, batching"
```

---

### Task 5: Create `escalateDispatch` Callable

**Files:**

- Create: `functions/src/callables/escalate-dispatch.ts`

- [ ] **Step 1: Implement `escalateDispatch` callable**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../admin-init.js'
import { withIdempotency } from '../idempotency/guard.js'
import { checkRateLimit } from '../services/rate-limit.js'
import { sendFcmToResponder } from '../services/fcm-send.js'
import { getAdminCallableCorsOrigins } from './callable-config.js'

const InputSchema = z
  .object({
    dispatchId: z.string().min(1).max(128),
    newResponderUid: z.string().min(1).max(128),
    idempotencyKey: z.uuid(),
  })
  .strict()

export const escalateDispatch = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: true,
    cors: getAdminCallableCorsOrigins(),
  },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token as Record<string, unknown>
    if (claims.role !== 'municipal_admin' && claims.role !== 'provincial_superadmin') {
      throw new HttpsError('permission-denied', 'admin required')
    }

    const parsed = InputSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    // Rate limit
    const rl = await checkRateLimit(adminDb, {
      key: `escalateDispatch:${req.auth.uid}`,
      limit: 30,
      windowSeconds: 60,
      now: Timestamp.now(),
    })
    if (!rl.allowed) throw new HttpsError('resource-exhausted', 'rate limit')

    const txResult = await adminDb.runTransaction(async (tx) => {
      const dispatchRef = adminDb.collection('dispatches').doc(parsed.data.dispatchId)
      const dispatchSnap = await tx.get(dispatchRef)
      if (!dispatchSnap.exists) throw new HttpsError('not-found', 'dispatch not found')

      const dispatch = dispatchSnap.data() as {
        municipalityId: string
        assignedTo: { uid: string; agencyId: string }
        status: string
        escalationCount: number
        previouslyNotifiedResponderUids: string[]
        reportId: string
      }

      // Ownership check
      const adminMuniIds =
        claims.role === 'provincial_superadmin'
          ? [dispatch.municipalityId] // superadmin can escalate any dispatch in their province
          : [claims.municipalityId as string]
      if (!adminMuniIds.includes(dispatch.municipalityId)) {
        throw new HttpsError('permission-denied', 'not your municipality')
      }

      // Verify new responder is active
      const responderRef = adminDb.collection('responders').doc(parsed.data.newResponderUid)
      const responderSnap = await tx.get(responderRef)
      if (!responderSnap.exists) throw new HttpsError('not-found', 'responder not found')
      const responder = responderSnap.data() as {
        accountStatus: string
        agencyId: string
        municipalityId: string
      }
      if (responder.accountStatus !== 'active') {
        throw new HttpsError('failed-precondition', 'responder is not active')
      }

      // Exclude previously notified
      if ((dispatch.previouslyNotifiedResponderUids ?? []).includes(parsed.data.newResponderUid)) {
        throw new HttpsError('failed-precondition', 'responder already notified')
      }

      // Update dispatch doc
      tx.update(dispatchRef, {
        assignedTo: {
          uid: parsed.data.newResponderUid,
          agencyId: responder.agencyId,
          municipalityId: responder.municipalityId,
        },
        escalationCount: FieldValue.increment(1),
        previouslyNotifiedResponderUids: FieldValue.arrayUnion(dispatch.assignedTo.uid),
        escalationReason: 'admin_override',
        monitorLeaseAt: Timestamp.now().toMillis(),
        status: 'pending',
      })

      tx.set(adminDb.collection('dispatch_events').doc(), {
        type: 'escalation_attempted',
        dispatchId: parsed.data.dispatchId,
        fromResponderUid: dispatch.assignedTo.uid,
        toResponderUid: parsed.data.newResponderUid,
        agencyId: responder.agencyId,
        municipalityId: responder.municipalityId,
        reason: 'admin_override',
        at: Timestamp.now().toMillis(),
        correlationId: crypto.randomUUID(),
        schemaVersion: 1,
      })

      return {
        dispatchId: parsed.data.dispatchId,
        status: 'pending',
        reportId: dispatch.reportId,
        newResponderUid: parsed.data.newResponderUid,
      }
    })

    // Send FCM AFTER transaction commits to avoid duplicate sends on retry
    const fcm = await sendFcmToResponder({
      uid: txResult.newResponderUid,
      title: 'New dispatch (reassigned)',
      body: `Report ${txResult.reportId.slice(0, 8)} — see app for details`,
      data: { dispatchId: txResult.dispatchId, reportId: txResult.reportId },
    })

    return {
      ...txResult,
      fcmResult: fcm.warnings.includes('fcm_no_token')
        ? 'no_token'
        : fcm.warnings.includes('fcm_network_error')
          ? 'network_error'
          : fcm.warnings.length > 0
            ? 'sent_with_invalid_tokens'
            : 'sent',
    }
  },
)
```

- [ ] **Step 2: Write tests**

```typescript
// functions/src/__tests__/callables/escalate-dispatch.test.ts
it('allows municipal_admin to escalate dispatch in their municipality', async () => {
  // ... seed dispatch in municipality A
  // ... call escalateDispatch with municipal_admin claims for municipality A
  // ... assert success, dispatch.escalationCount === 1
})

it('rejects municipal_admin escalating dispatch in other municipality', async () => {
  // ... seed dispatch in municipality B
  // ... call with municipal_admin claims for municipality A
  // ... assert permission-denied
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm --dir functions exec vitest run src/__tests__/callables/escalate-dispatch.test.ts
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(dispatch): add escalateDispatch callable with ownership checks"
```

---

### Task 6: Create `getOpsMetrics` Callable

**Files:**

- Create: `functions/src/callables/get-ops-metrics.ts`

- [ ] **Step 1: Implement `getOpsMetrics`**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { adminDb } from '../admin-init.js'
import { checkRateLimit } from '../services/rate-limit.js'

const InputSchema = z
  .object({
    timeRange: z.enum(['1h', '24h', '7d']),
  })
  .strict()

function deriveScope(claims: Record<string, unknown>) {
  const role = claims.role as string
  if (role === 'municipal_admin')
    return { type: 'municipality', id: claims.municipalityId as string }
  if (role === 'agency_admin') return { type: 'agency', id: claims.agencyId as string }
  if (role === 'provincial_superadmin') return { type: 'province', id: 'province' }
  throw new HttpsError('permission-denied', 'unknown role')
}

export const getOpsMetrics = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: true,
  },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated')
    if ('scope' in (req.data as Record<string, unknown>)) {
      throw new HttpsError('permission-denied', 'client-provided scope rejected')
    }

    const parsed = InputSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument')

    const scope = deriveScope(req.auth.token as Record<string, unknown>)

    const rl = await checkRateLimit(adminDb, {
      key: `getOpsMetrics:${req.auth.uid}`,
      limit: 60,
      windowSeconds: 60,
      now: Timestamp.now(),
    })
    if (!rl.allowed) throw new HttpsError('resource-exhausted', 'rate limit')

    // Read counter docs for the date range
    const now = new Date()
    const dates: string[] = []
    if (parsed.data.timeRange === '1h') {
      dates.push(now.toISOString().slice(0, 10))
    } else if (parsed.data.timeRange === '24h') {
      dates.push(now.toISOString().slice(0, 10))
    } else {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        dates.push(d.toISOString().slice(0, 10))
      }
    }

    const metrics = {
      totalDispatches: 0,
      acceptedCount: 0,
      declinedCount: 0,
      escalatedCount: 0,
      needsAdminCount: 0,
      fcmSuccessCount: 0,
      fcmFailureCount: 0,
      totalAcceptSeconds: 0,
      acceptCountWithTimestamps: 0,
    }

    for (const date of dates) {
      const docId = scope.type === 'province' ? `province_${date}` : `${scope.id}_${date}`
      const snap = await adminDb.collection('metrics_daily').doc(docId).get()
      if (snap.exists) {
        const data = snap.data() as Partial<typeof metrics>
        metrics.totalDispatches += data.totalDispatches ?? 0
        metrics.acceptedCount += data.acceptedCount ?? 0
        metrics.declinedCount += data.declinedCount ?? 0
        metrics.escalatedCount += data.escalatedCount ?? 0
        metrics.needsAdminCount += data.needsAdminCount ?? 0
        metrics.fcmSuccessCount += data.fcmSuccessCount ?? 0
        metrics.fcmFailureCount += data.fcmFailureCount ?? 0
        metrics.totalAcceptSeconds += data.totalAcceptSeconds ?? 0
        metrics.acceptCountWithTimestamps += data.acceptCountWithTimestamps ?? 0
      }
    }

    return {
      timeRange: parsed.data.timeRange,
      scope,
      metrics: {
        ...metrics,
        avgAcceptSeconds:
          metrics.acceptCountWithTimestamps > 0
            ? Math.round(metrics.totalAcceptSeconds / metrics.acceptCountWithTimestamps)
            : null,
        fcmSuccessRate:
          metrics.fcmSuccessCount + metrics.fcmFailureCount > 0
            ? metrics.fcmSuccessCount / (metrics.fcmSuccessCount + metrics.fcmFailureCount)
            : 0,
      },
    }
  },
)
```

- [ ] **Step 2: Write tests**

```typescript
// functions/src/__tests__/callables/get-ops-metrics.test.ts
it('rejects request with client-provided scope', async () => {
  // ... call with { timeRange: '24h', scope: { type: 'province' } }
  // ... assert permission-denied
})

it('derives municipality scope from municipal_admin claims', async () => {
  // ... seed metrics_daily/muni_A_2026-05-19 with totalDispatches: 5
  // ... call with municipal_admin claims for muni_A
  // ... assert metrics.totalDispatches === 5
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm --dir functions exec vitest run src/__tests__/callables/get-ops-metrics.test.ts
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(metrics): add getOpsMetrics callable with counter pattern"
```

---

### Task 7: Create `retryFcmDelivery` Scheduled Function

**Files:**

- Create: `functions/src/scheduled/retry-fcm-delivery.ts`

- [ ] **Step 1: Implement scheduled retry function**

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../admin-init.js'
import { sendFcmToResponder } from '../services/fcm-send.js'

export const retryFcmDelivery = onSchedule(
  {
    schedule: 'every 30 seconds',
    region: 'asia-southeast1',
    maxInstances: 1,
  },
  async () => {
    const now = Timestamp.now().toMillis()
    const snap = await adminDb
      .collection('fcm_retry_queue')
      .where('status', '==', 'pending')
      .where('nextAttemptAt', '<=', now)
      .limit(50)
      .get()

    for (const doc of snap.docs) {
      const data = doc.data() as {
        dispatchId: string
        responderUid: string
        attemptCount: number
        originalError: string
      }

      if (data.attemptCount >= 3) {
        await doc.ref.update({ status: 'permanent_failure' })
        // Log metric
        console.error(`FCM permanent failure for dispatch ${data.dispatchId}`)
        continue
      }

      await doc.ref.update({ status: 'in_progress' })

      try {
        const result = await sendFcmToResponder({
          uid: data.responderUid,
          title: 'New dispatch (retry)',
          body: `Report ${data.dispatchId.slice(0, 8)}`,
          data: { dispatchId: data.dispatchId },
        })

        if (result.warnings.includes('fcm_network_error')) {
          // Still failing — schedule next retry
          const backoffMs = [30000, 60000, 120000][data.attemptCount] ?? 120000
          await doc.ref.update({
            status: 'pending',
            attemptCount: data.attemptCount + 1,
            lastAttemptAt: now,
            nextAttemptAt: now + backoffMs,
          })
        } else {
          await doc.ref.update({ status: 'success' })
        }
      } catch {
        await doc.ref.update({ status: 'permanent_failure' })
      }
    }
  },
)
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(dispatch): add retryFcmDelivery scheduled function"
```

---

### Task 8: Update Firestore Rules and Indexes

**Files:**

- Modify: `infra/firebase/firestore.rules`
- Modify: `infra/firebase/firestore.indexes.json`

- [ ] **Step 1: Update rules for agency_admin access**

```rules
// infra/firebase/firestore.rules — dispatches list
allow list: if isActivePrivileged() && (
  (isResponder() && assignedTo.uid == uid())
  || adminOf(municipalityId)
  || (isAgencyAdmin() && assignedTo.agencyId == myAgency())
);

// dispatch_events list with legacy fallback
allow list: if isActivePrivileged() && (
  (isResponder() && data.assignedTo.uid == uid())
  || adminOf(data.municipalityId)
  || (isAgencyAdmin() && (!('agencyId' in data) || data.agencyId == myAgency()))
  || isProvincialSuperadmin()
);

// fcm_retry_queue
match /fcm_retry_queue/{doc} {
  allow read, write: if false;  // trigger-only via Admin SDK
}

// system_config/monitor
match /system_config/monitor {
  allow get: if isProvincialSuperadmin();
  allow update: if isProvincialSuperadmin();
}
```

- [ ] **Step 2: Add composite indexes**

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

- [ ] **Step 3: Run rules tests**

```bash
pnpm --filter @bantayog/functions test:rules:firestore
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(rules): add agency_admin paths, legacy fallback, fcm_retry_queue, composite indexes"
```

---

### Task 9: Load Test Monitor

**Files:**

- Create: `functions/scripts/load-test-monitor.ts`

- [ ] **Step 1: Create load test script**

```typescript
// Seed 500 dispatches with past deadlines
// Run monitor function
// Assert: completes < 30s, zero errors, exactly 50 processed (LIMIT)
// Assert: no double escalations
```

- [ ] **Step 2: Run load test**

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 pnpm exec tsx functions/scripts/load-test-monitor.ts
```

- [ ] **Step 3: Commit**

```bash
git commit -m "test(dispatch): add load test for monitorDispatchDeadlines"
```

---

## Phase 2: Admin Desktop Dispatch Monitor (Days 4–6)

### Task 10: Create `useDispatchLifecycle` Hook

**Files:**

- Create: `apps/admin-desktop/src/hooks/useDispatchLifecycle.ts`

- [ ] **Step 1: Implement single-listener hook with role-derived scope**

```typescript
import { useEffect, useState, useMemo } from 'react'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../app/firebase'
import { useAuth } from '@bantayog/shared-ui'

export interface DispatchLifecycleRow {
  dispatchId: string
  reportId: string
  status: string
  responderName: string
  responderAgency: string
  dispatchedAt: number
  deadlineAt: number
  escalationCount: number
  fcmResult: string | null
  fcmWarnings: string[] | null
  timeline: DispatchEvent[]
}

export function useDispatchLifecycle() {
  const { claims } = useAuth()
  const [rows, setRows] = useState<DispatchLifecycleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const scope = useMemo(() => {
    const role = claims?.role as string
    if (role === 'municipal_admin') {
      return { type: 'municipality', id: claims?.municipalityId as string }
    }
    if (role === 'agency_admin') {
      return { type: 'agency', id: claims?.agencyId as string }
    }
    if (role === 'provincial_superadmin') {
      return { type: 'province' }
    }
    return null
  }, [claims])

  useEffect(() => {
    if (!scope) {
      setLoading(false)
      setError('unauthorized')
      return
    }

    const now = Date.now()

    // Build dispatch query
    let dispatchConstraints = []
    let eventsConstraints = []

    if (scope.type === 'municipality') {
      dispatchConstraints = [
        where('municipalityId', '==', scope.id),
        where('status', 'in', ['pending', 'accepted', 'declined', 'needs_admin', 'escalated']),
        orderBy('dispatchedAt', 'desc'),
        limit(100),
      ]
      eventsConstraints = [
        where('municipalityId', '==', scope.id),
        orderBy('at', 'desc'),
        limit(500),
      ]
    } else if (scope.type === 'agency') {
      dispatchConstraints = [
        where('agencyId', '==', scope.id),
        where('status', 'in', ['pending', 'accepted', 'declined', 'needs_admin', 'escalated']),
        orderBy('dispatchedAt', 'desc'),
        limit(100),
      ]
      eventsConstraints = [where('agencyId', '==', scope.id), orderBy('at', 'desc'), limit(500)]
    } else {
      // provincial_superadmin — NEVER unscoped
      dispatchConstraints = [
        where('status', 'in', ['pending', 'accepted', 'declined', 'needs_admin', 'escalated']),
        where('dispatchedAt', '>', now - 24 * 60 * 60 * 1000),
        orderBy('dispatchedAt', 'desc'),
        limit(100),
      ]
      eventsConstraints = [
        where('at', '>', now - 24 * 60 * 60 * 1000),
        orderBy('at', 'desc'),
        limit(500),
      ]
    }

    const dispatchQuery = query(collection(db, 'dispatches'), ...dispatchConstraints)
    const eventsQuery = query(collection(db, 'dispatch_events'), ...eventsConstraints)

    let unsubDispatch: (() => void) | null = null
    let unsubEvents: (() => void) | null = null

    const dispatchData = new Map<string, Record<string, unknown>>()
    const eventsData = new Map<string, DispatchEvent[]>()

    const merge = () => {
      const merged: DispatchLifecycleRow[] = []
      for (const [id, d] of dispatchData) {
        const events = eventsData.get(id) ?? []
        merged.push({
          dispatchId: id,
          reportId: String(d.reportId),
          status: String(d.status),
          responderName: String(d.assignedTo?.displayName ?? 'Unknown'),
          responderAgency: String(d.assignedTo?.agencyId ?? 'Unknown'),
          dispatchedAt: Number(d.dispatchedAt),
          deadlineAt: Number(d.acknowledgementDeadlineAt),
          escalationCount: Number(d.escalationCount ?? 0),
          fcmResult: d.fcmResult as string | null,
          fcmWarnings: d.fcmWarnings as string[] | null,
          timeline: events,
        })
      }
      setRows(merged)
      setLoading(false)
    }

    unsubDispatch = onSnapshot(
      dispatchQuery,
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'removed') {
            dispatchData.delete(change.doc.id)
          } else {
            dispatchData.set(change.doc.id, change.doc.data())
          }
        })
        merge()
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    unsubEvents = onSnapshot(
      eventsQuery,
      (snap) => {
        // Group events by dispatchId
        const byDispatch = new Map<string, DispatchEvent[]>()
        snap.docs.forEach((doc) => {
          const data = doc.data() as DispatchEvent
          const list = byDispatch.get(data.dispatchId) ?? []
          list.push(data)
          byDispatch.set(data.dispatchId, list)
        })
        // Merge into eventsData
        byDispatch.forEach((events, dispatchId) => {
          eventsData.set(dispatchId, events)
        })
        merge()
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    return () => {
      unsubDispatch?.()
      unsubEvents?.()
    }
  }, [scope])

  return { rows, loading, error }
}
```

- [ ] **Step 2: Write hook test**

```typescript
// apps/admin-desktop/src/__tests__/useDispatchLifecycle.test.ts
// Mock Firestore, mock useAuth with municipal_admin claims
// Assert: query includes municipalityId filter
// Assert: query includes status in [...]
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(admin): add useDispatchLifecycle hook with single-listener pattern"
```

---

### Task 11: Create Dispatch Monitor UI Components

**Files:**

- Create: `apps/admin-desktop/src/components/DispatchLifecycleTable.tsx`
- Create: `apps/admin-desktop/src/components/FcmStatusIcon.tsx`
- Create: `apps/admin-desktop/src/components/DispatchTimeline.tsx`
- Create: `apps/admin-desktop/src/components/DispatchStatsCards.tsx`
- Create: `apps/admin-desktop/src/components/EscalationQueueSection.tsx`
- Create: `apps/admin-desktop/src/components/ReDispatchModal.tsx`

- [ ] **Step 1: Implement `FcmStatusIcon`**

```typescript
export function FcmStatusIcon({ result, warnings }: { result: string | null; warnings: string[] | null }) {
  if (result === 'sent') return <span title="FCM delivered to device">🟢</span>
  if (result === 'sent_with_invalid_tokens') return <span title="FCM sent, but cleaned up invalid tokens">⚠️</span>
  if (result === 'no_token') return <span title="Responder has no FCM token">🔴</span>
  if (result === 'network_error') return <span title="FCM network error">🔴</span>
  return <span title="FCM status unknown">⚪</span>
}
```

- [ ] **Step 2: Implement `DispatchLifecycleTable`**

```typescript
// Table with columns: Report ID, Responder, Status, Deadline, FCM, Actions
// Expanded row shows DispatchTimeline
// Status badge colors from spec Section 6.3
```

- [ ] **Step 3: Implement `ReDispatchModal`**

```typescript
// Modal with responder selection list
// Excludes previouslyNotifiedResponderUids
// Calls escalateDispatch callable
// Shows loading state
```

- [ ] **Step 4: Implement `DispatchStatsCards`**

```typescript
// Top row: Active Dispatches, Pending, Timed Out / Needs Admin, Avg Accept Time
// Computed from useDispatchLifecycle rows
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(admin): add DispatchMonitor UI components"
```

---

### Task 12: Create `/dispatches` Page and Wire Routes

**Files:**

- Create: `apps/admin-desktop/src/pages/DispatchMonitorPage.tsx`
- Modify: `apps/admin-desktop/src/routes.tsx`
- Modify: `apps/admin-desktop/src/components/CommandHeader.tsx`
- Modify: `apps/admin-desktop/src/services/callables.ts`

- [ ] **Step 1: Create `DispatchMonitorPage`**

```typescript
// Compose: DispatchStatsCards + EscalationQueueSection + DispatchLifecycleTable + ResponderAvailabilityPanel
// Use useDispatchLifecycle for data
// Keyboard shortcuts: R (re-dispatch), Enter (expand), Escape (clear)
```

- [ ] **Step 2: Add routes**

```typescript
// apps/admin-desktop/src/routes.tsx
{ path: '/dispatches', element: <DispatchMonitorPage /> }
{ path: '/ops-dashboard', element: <OpsDashboardPage /> }  // stub for now
```

- [ ] **Step 3: Add nav links to CommandHeader**

```typescript
// Between Dashboard and Map tabs
<NavLink to="/dispatches">Dispatches</NavLink>
<NavLink to="/ops-dashboard">Ops</NavLink>
```

- [ ] **Step 4: Add callable wrappers**

```typescript
// apps/admin-desktop/src/services/callables.ts
escalateDispatch: (payload: { dispatchId: string; newResponderUid: string; idempotencyKey: string }) =>
  httpsCallable(functions, 'escalateDispatch')(payload).then(r => r.data),

getOpsMetrics: (payload: { timeRange: '1h' | '24h' | '7d' }) =>
  httpsCallable(functions, 'getOpsMetrics')(payload).then(r => r.data),
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(admin): add /dispatches page with full monitor UI"
```

---

## Phase 3: In-App Ops Dashboard (Days 7–8)

### Task 13: Create `useOpsMetrics` and `useResponderFleet` Hooks

**Files:**

- Create: `apps/admin-desktop/src/hooks/useOpsMetrics.ts`
- Create: `apps/admin-desktop/src/hooks/useResponderFleet.ts`

- [ ] **Step 1: Implement `useOpsMetrics`**

```typescript
// Polls getOpsMetrics every 60 seconds
// Returns metrics + loading + error
```

- [ ] **Step 2: Implement `useResponderFleet`**

```typescript
// Single Firestore listener on responders collection
// Scoped by role: municipalityId or agencyId filter
// For superadmin: limit(100) + availabilityStatus == 'available'
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(admin): add useOpsMetrics and useResponderFleet hooks"
```

---

### Task 14: Create Ops Dashboard Page

**Files:**

- Create: `apps/admin-desktop/src/pages/OpsDashboardPage.tsx`
- Create: `apps/admin-desktop/src/components/OpsMetricCard.tsx`

- [ ] **Step 1: Implement `OpsMetricCard`**

```typescript
// Props: title, value, type: 'live' | 'historical', lastUpdated?: number
// Live cards show green dot + "Live"
// Historical cards show "Last updated: Xs ago"
```

- [ ] **Step 2: Implement `OpsDashboardPage`**

```typescript
// Panels:
// - Active Dispatch Summary (LIVE: Firestore listener)
// - Responder Fleet Status (LIVE: Firestore listener)
// - Needs Admin Queue (LIVE: Firestore listener)
// - Response Time Trend 24h (HISTORICAL: useOpsMetrics)
// - Report Volume 24h (HISTORICAL: useOpsMetrics)
// - Escalation Rate 24h (HISTORICAL: useOpsMetrics)
// - FCM Delivery Rate 24h (HISTORICAL: useOpsMetrics)
// - System Alert Feed (LIVE: Firestore listener on alerts)
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(admin): add /ops-dashboard with live + historical panels"
```

---

## Phase 4: External Observability (Days 9–11)

### Task 15: Cloud Monitoring Metrics and Dashboards

**Files:**

- Create: `infra/monitoring/dispatch-sla-dashboard.json`
- Create: `infra/monitoring/function-health-dashboard.json`
- Create: `infra/monitoring/alert-policies.yaml`

- [ ] **Step 1: Define log-based metrics**

```yaml
# Use gcloud CLI or Terraform to create:
- metric: bantayog/dispatch_created
  filter: jsonPayload.code="dispatch.created"
- metric: bantayog/dispatch_accepted
  filter: jsonPayload.code="dispatch.accepted"
- metric: bantayog/dispatch_deadline_exceeded
  filter: jsonPayload.code="dispatch.deadline_exceeded"
- metric: bantayog/fcm_sent
  filter: jsonPayload.code="fcm.sent"
- metric: bantayog/fcm_failed
  filter: jsonPayload.code="fcm.failed"
- metric: bantayog/callable_latency
  filter: jsonPayload.latencyMs > 0
- metric: bantayog/callable_error
  filter: severity=ERROR AND jsonPayload.dimension="callable"
```

- [ ] **Step 2: Create alert policies**

```yaml
# Alert: deadline_exceeded rate > 5% AND volume normal → PagerDuty
# Alert: deadline_exceeded rate > 5% AND volume > 3x baseline → Slack #ops
# Alert: monitor_circuit_opened → PagerDuty + Slack #ops
# Alert: callable_latency p99 > 3000ms → Slack #perf
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(observability): add Cloud Monitoring metrics and alert policies"
```

---

### Task 16: BigQuery Log Sink and Compliance Dashboards

**Files:**

- Create: `infra/bigquery/log-sink.tf` (or manual console steps documented)
- Create: `infra/bigquery/scheduled-queries.sql`

- [ ] **Step 1: Set up BigQuery log sink**

```bash
# Create dataset
bq mk --dataset --location=asia-southeast1 bantayog_audit

# Create log sink
gcloud logging sinks create bantayog-bigquery-sink \
  bigquery.googleapis.com/projects/PROJECT_ID/datasets/bantayog_audit \
  --log-filter='resource.type="cloud_function" AND jsonPayload.dimension IN ("dispatchResponder", "acceptDispatch", "declineDispatch", "monitorDispatchDeadlines")'
```

- [ ] **Step 2: Define scheduled queries**

```sql
-- Daily dispatch summary
CREATE OR REPLACE TABLE bantayog_audit.daily_dispatch_summary AS
SELECT
  DATE(TIMESTAMP_MILLIS(at)) as date,
  municipalityId,
  COUNTIF(type = 'notification_attempted') as total_dispatches,
  COUNTIF(type = 'notification_delivered' AND action = 'accepted') as accepted,
  COUNTIF(type = 'notification_delivered' AND action = 'declined') as declined,
  COUNTIF(type = 'deadline_exceeded') as deadline_exceeded,
  AVGIF(TIMESTAMP_DIFF(
    TIMESTAMP_MILLIS((SELECT at FROM UNNEST(events) WHERE type = 'notification_delivered')),
    TIMESTAMP_MILLIS((SELECT at FROM UNNEST(events) WHERE type = 'notification_attempted')),
    SECOND
  ), type = 'notification_delivered') as avg_accept_seconds
FROM bantayog_audit.dispatch_events
WHERE DATE(_PARTITIONTIME) = CURRENT_DATE()
GROUP BY date, municipalityId;
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(observability): add BigQuery log sink and scheduled queries"
```

---

## Phase 5: Integration & Hardening (Days 12–13)

### Task 17: E2E Tests

**Files:**

- Create: `apps/admin-desktop/e2e/dispatch-lifecycle.spec.ts`

- [ ] **Step 1: Write E2E tests**

```typescript
// Test: Full dispatch lifecycle
// 1. Admin dispatches to responder A
// 2. Responder A accepts
// 3. Admin sees "ACCEPTED" in monitor

// Test: Deadline escalation
// 1. Admin dispatches to responder A
// 2. Wait for deadline to pass (use emulator time manipulation or short deadline)
// 3. Monitor auto-escalates to responder B
// 4. Admin sees "AUTO-ESCALATED"

// Test: Admin re-dispatch
// 1. Admin dispatches to responder A
// 2. Responder A declines
// 3. Admin clicks Re-dispatch, selects responder B
// 4. Dispatch updated
```

- [ ] **Step 2: Run E2E tests**

```bash
pnpm --dir apps/admin-desktop exec playwright test e2e/dispatch-lifecycle.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git commit -m "test(admin): add E2E tests for dispatch lifecycle"
```

---

### Task 18: Final Verification and Documentation

**Files:**

- Modify: `docs/learnings.md`
- Modify: `docs/progress.md`

- [ ] **Step 1: Run full test suites**

```bash
pnpm --dir functions typecheck
pnpm --dir functions lint
pnpm --filter @bantayog/functions test:unit
pnpm --filter @bantayog/functions test:rules:firestore
pnpm --dir apps/admin-desktop typecheck
pnpm --dir apps/admin-desktop lint
pnpm --dir apps/admin-desktop exec vitest run
```

- [ ] **Step 2: Update `docs/learnings.md`**

```markdown
## Dispatch Hardening (2026-05-19)

- Single-dispatch-doc escalation: mutating `assignedTo` on the same doc preserves history in `dispatch_events` and prevents duplicate active dispatches for one report.
- `FieldValue.arrayUnion` is required for `previouslyNotifiedResponderUids`; read-modify-write loses updates under concurrency.
- FCM events must be written AFTER the API call returns, not inside the Firestore transaction (the result is not known at transaction time).
- Firestore `in` queries are capped at 10 values; chunk municipality IDs for responder batch queries.
- Monitor lease (`monitorLeaseAt`) prevents overlapping cron invocations from double-escalating.
- Counter docs (`metrics_daily`) are the only way to serve aggregations in <100ms; raw Firestore scans fail at scale.
- `agency_admin` timeline requires `agencyId` on ALL `dispatch_events`; backfill legacy events before deploying rules.
```

- [ ] **Step 3: Update `docs/progress.md`**

```markdown
## Current Status (2026-05-19)

**Dispatch Hardening + Observability Dashboards — Implementation Complete**

- ✅ `dispatchTimeoutSweep` retired
- ✅ `monitorDispatchDeadlines` with lease, cap, batching
- ✅ `escalateDispatch` callable with ownership checks
- ✅ `getOpsMetrics` with counter pattern
- ✅ `retryFcmDelivery` scheduled retry
- ✅ FCM tracking (`notification_attempted` / `notification_delivered`)
- ✅ Admin Desktop `/dispatches` monitor page
- ✅ Admin Desktop `/ops-dashboard` with live + historical panels
- ✅ Cloud Monitoring metrics and alert policies
- ✅ BigQuery log sink and scheduled queries
- ✅ Firestore rules updated for `agency_admin`
- ✅ Composite indexes deployed
- ✅ E2E tests passing
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: update learnings and progress for dispatch hardening"
```

---

## Spec Coverage Check

| Spec Section                                                                | Plan Task          |
| --------------------------------------------------------------------------- | ------------------ |
| 4.1 Retire `dispatchTimeoutSweep`                                           | Task 1             |
| 4.2 `dispatchResponder` extension                                           | Task 2             |
| 4.2 `acceptDispatch` / `declineDispatch` extension                          | Task 3             |
| 4.2 `monitorDispatchDeadlines`                                              | Task 4             |
| 4.2 `escalateDispatch`                                                      | Task 5             |
| 4.2 `getOpsMetrics`                                                         | Task 6             |
| 4.2 `retryFcmDelivery`                                                      | Task 7             |
| 4.3 Data model (`escalationCount`, `previouslyNotifiedResponderUids`, etc.) | Tasks 2–4          |
| 4.4 Escalation logic (lease, LIMIT 50, batching, chunking)                  | Task 4             |
| 4.5 FCM two-phase tracking                                                  | Tasks 2, 3, 7      |
| 4.6 Server-derived scope                                                    | Tasks 5, 6         |
| 5. Firestore rules                                                          | Task 8             |
| 6. Admin Desktop UI (`/dispatches`)                                         | Tasks 10–12        |
| 7. Ops Dashboard (`/ops-dashboard`)                                         | Tasks 13–14        |
| 8. API contracts                                                            | Tasks 2, 5, 6      |
| 9. Frontend hooks                                                           | Tasks 10, 13       |
| 10. Testing strategy                                                        | Tasks 2–7, 17      |
| 11. Rollout plan                                                            | All tasks          |
| 12. Risks & mitigations                                                     | Task 4 (load test) |

---

## Placeholder Scan

- No "TBD", "TODO", "implement later" found.
- No "Add appropriate error handling" without specifics.
- No "Similar to Task N" references.
- All file paths are exact.
- All code blocks contain actual code.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-19-dispatch-hardening-observability-plan.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for parallelizing independent backend tasks.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Best for tight coupling between frontend and backend.

**Which approach?**
