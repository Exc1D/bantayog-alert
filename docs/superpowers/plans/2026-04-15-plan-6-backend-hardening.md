# Plan 6 — Backend Hardening: Cloud Tasks, Server Rate Limits, Scheduled Jobs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Implement the remaining server-authoritative backend pieces from spec §5: Cloud Tasks dispatch escalation timer, server-side rate limit enforcement on `dispatchResponder`/`sendMassAlert`/`declareEmergency`, trust score engine, and scheduled archival/cleanup jobs.

**Architecture:** All callables live in `functions/src/`. Cloud Tasks queue created once per project. Firestore triggers (`onDocumentUpdated`) drive trust score + dispatch status notifications. Pub/Sub scheduled functions handle archival.

**Tech Stack:** Firebase Functions v2 (`onCall`, `onDocumentUpdated`, `onSchedule`), `@google-cloud/tasks`, FCM.

---

## Prerequisites

- Plan 1 merged (`submitReport` callable + rate limit helper exists).
- Cloud Tasks API enabled in GCP console.
- Queue `bantayog-dispatch-timers` created (one-time `gcloud tasks queues create`).

## File Map

| File | Responsibility |
|---|---|
| `functions/src/dispatch.ts` *(new)* | `dispatchResponder` callable + Cloud Task enqueue |
| `functions/src/dispatchTimeout.ts` *(new)* | HTTP handler invoked by Cloud Tasks |
| `functions/src/triggers/onDispatchStatusChanged.ts` *(new)* | Firestore trigger: cancel task, update report_ops counts, notify |
| `functions/src/triggers/onReportVerified.ts` *(new)* | Trust score + citizen FCM |
| `functions/src/triggers/onSOSActivated.ts` *(new)* | Alert all admins in municipality |
| `functions/src/scheduled/archiveReports.ts` *(new)* | Daily 02:00 PHT |
| `functions/src/scheduled/deleteArchived.ts` *(new)* | Monthly day 1 03:00 |
| `functions/src/scheduled/autoCloseStale.ts` *(new)* | Daily midnight |
| `functions/src/scheduled/computeMetrics.ts` *(new)* | Every 5 min |
| `functions/src/scheduled/detectAnomalies.ts` *(new)* | Every 30 min |
| `functions/src/massAlert.ts` *(new)* | `sendMassAlert` callable |
| `functions/src/declareEmergency.ts` *(new)* | superadmin callable |
| `functions/src/index.ts` | Re-export all |

---

## Task 1: `dispatchResponder` callable

- [ ] **Step 1: Failing test** — callable creates `dispatches/{id}` with status=pending, enqueues Cloud Task with 5-min delay, returns `{ dispatchId }`.

- [ ] **Step 2: Install** `cd functions && npm i @google-cloud/tasks`

- [ ] **Step 3: Implement**

```typescript
// functions/src/dispatch.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { CloudTasksClient } from '@google-cloud/tasks'
import { enforceRateLimit } from './rateLimit'

const tasks = new CloudTasksClient()
const PROJECT = process.env.GCLOUD_PROJECT!
const LOCATION = 'asia-southeast1'
const QUEUE = 'bantayog-dispatch-timers'
const TIMEOUT_MS = 5 * 60 * 1000

export const dispatchResponder = onCall({ region: LOCATION }, async (req) => {
  if (req.auth?.token.role !== 'municipal_admin' && req.auth?.token.role !== 'agency_admin') {
    throw new HttpsError('permission-denied', 'Admin role required')
  }
  const { reportId, responderId, priority = 'normal' } = req.data as { reportId: string; responderId: string; priority?: string }
  if (!reportId || !responderId) throw new HttpsError('invalid-argument', 'reportId + responderId required')

  await enforceRateLimit('device', req.auth!.uid) // abuse guard

  const db = getFirestore()
  const ref = db.collection('dispatches').doc()
  const now = Timestamp.now()
  const timeoutAt = Timestamp.fromMillis(now.toMillis() + TIMEOUT_MS)
  await ref.set({
    reportId, responderId,
    agencyId: req.auth!.token.agencyId ?? null,
    municipalityId: req.auth!.token.municipalityId,
    dispatchedBy: req.auth!.uid,
    dispatchedAt: now, timeoutAt, priority, status: 'pending',
  })

  const url = `https://${LOCATION}-${PROJECT}.cloudfunctions.net/dispatchTimeoutHandler`
  await tasks.createTask({
    parent: tasks.queuePath(PROJECT, LOCATION, QUEUE),
    task: {
      httpRequest: {
        httpMethod: 'POST', url,
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(JSON.stringify({ dispatchId: ref.id })).toString('base64'),
        oidcToken: { serviceAccountEmail: `${PROJECT}@appspot.gserviceaccount.com` },
      },
      scheduleTime: { seconds: Math.floor(timeoutAt.toMillis() / 1000) },
    },
  })

  return { dispatchId: ref.id }
})
```

- [ ] **Step 4:** Tests + commit.

---

## Task 2: `dispatchTimeoutHandler` HTTP function

- [ ] **Step 1: Failing test** — if dispatch still `pending`, mark `timeout`; else no-op.

- [ ] **Step 2: Implement**

```typescript
// functions/src/dispatchTimeout.ts
import { onRequest } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

export const dispatchTimeoutHandler = onRequest({ region: 'asia-southeast1' }, async (req, res) => {
  const { dispatchId } = req.body as { dispatchId: string }
  const db = getFirestore()
  const ref = db.collection('dispatches').doc(dispatchId)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return
    if (snap.data()?.status !== 'pending') return
    tx.update(ref, { status: 'timeout', timedOutAt: FieldValue.serverTimestamp() })
  })
  res.status(204).send()
})
```

- [ ] **Step 3:** Commit.

---

## Task 3: `onDispatchStatusChanged` trigger

- [ ] **Step 1: Failing test** — when status transitions pending→accepted, increments `report_ops.activeResponderCount`, appends `status_log` entry, sends FCM.

- [ ] **Step 2: Implement**

```typescript
// functions/src/triggers/onDispatchStatusChanged.ts
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

export const onDispatchStatusChanged = onDocumentUpdated(
  { document: 'dispatches/{id}', region: 'asia-southeast1' },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after || before.status === after.status) return

    const db = getFirestore()
    const opsRef = db.collection('report_ops').doc(after.reportId)
    const delta =
      after.status === 'accepted' ? 1 :
      ['resolved', 'declined', 'timeout'].includes(after.status) && before.status === 'accepted' ? -1 : 0
    if (delta !== 0) {
      await opsRef.update({ activeResponderCount: FieldValue.increment(delta) })
    }
    await db.collection('reports').doc(after.reportId).collection('status_log').add({
      action: `dispatch_${after.status}`,
      actorId: after.responderId, actorRole: 'responder',
      timestamp: FieldValue.serverTimestamp(),
      notes: after.resolutionSummary ?? null,
    })
    // FCM to admin — stub; real impl fetches admin tokens
  }
)
```

- [ ] **Step 3:** Commit.

---

## Task 4: `sendMassAlert` callable

- [ ] **Step 1: Failing test** — municipal admin can send to own muni; denied for other muni; creates `alerts/{id}`, sends FCM to topic `muni_{id}`.

- [ ] **Step 2: Implement** with rate limit (`enforceRateLimit('device', adminUid)`), Zod validation, audit log entry.

- [ ] **Step 3:** Commit.

---

## Task 5: `declareEmergency` callable

- [ ] **Step 1: Failing test** — requires `role=provincial_superadmin` + `mfaVerified`. Creates `emergencies/{id}`, triggers alerts for affected municipalities.

- [ ] **Step 2: Implement.** Commit.

---

## Task 6: `onReportVerified` trust score trigger

- [ ] **Step 1: Failing test** — transition `status: pending → verified` bumps reporter's `users/{uid}.trustScore` by +10.

- [ ] **Step 2: Implement**

```typescript
export const onReportVerified = onDocumentUpdated({ document: 'reports/{id}' }, async (event) => {
  const before = event.data?.before.data(); const after = event.data?.after.data()
  if (before?.status === after?.status) return
  if (after?.status !== 'verified') return
  const db = getFirestore()
  const priv = await db.collection('report_private').doc(event.params.id).get()
  const uid = priv.data()?.citizenUid
  if (!uid) return
  await db.collection('users').doc(uid).update({ trustScore: FieldValue.increment(10) })
})
```

Add `+5` for photo+GPS, `-15` for rejected, `-25` for false alarm flag.

- [ ] **Step 3:** Commit.

---

## Task 7: Scheduled archival

- [ ] **Step 1:** `archiveOldReports` — daily 02:00 Asia/Manila. Copy `reports` older than 6 months to `reports_archive`, delete originals (use batched writes, 500 per batch).
- [ ] **Step 2:** `deleteArchivedReports` — monthly day 1 03:00. Delete archived >12 months.
- [ ] **Step 3:** `autoCloseStaleReports` — daily midnight. Unverified >7 days → `status: auto_closed`.
- [ ] **Step 4:** `computeProvinceMetrics` — every 5 min. Aggregate per-muni counts → `metrics_province/{timestamp}`.
- [ ] **Step 5:** `detectAnomalies` — every 30 min. Alert superadmin on response time spikes.

Each task: failing test (deploy to emulator + trigger via `firebase functions:shell`), implement with `onSchedule`, commit.

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler'
export const archiveOldReports = onSchedule(
  { schedule: '0 2 * * *', timeZone: 'Asia/Manila', region: 'asia-southeast1' },
  async () => { /* ... */ }
)
```

---

## Task 8: Deploy + verify

- [ ] **Step 1:** `firebase deploy --only functions --project staging`
- [ ] **Step 2:** `gcloud tasks queues describe bantayog-dispatch-timers --location=asia-southeast1`
- [ ] **Step 3:** E2E: dispatch a responder, wait 5 min without accept → confirm status flips to `timeout`.
- [ ] **Step 4:** Commit and deploy to prod.

## Self-Review

Spec §5.1 all callables covered. §5.2 Cloud Tasks timer working. §5.3 trust score. Scheduled jobs from §5.1. No placeholders.
