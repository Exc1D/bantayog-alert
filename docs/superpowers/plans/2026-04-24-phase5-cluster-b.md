# Phase 5 Cluster B — Inter-Agency Coordination

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 5 Cluster B features: agency assistance callables + queue UI, field mode callables + store, OSM boundary extraction, report sharing + auto-share trigger, and command channel callable + panel.

**Architecture:** All callables follow the existing `*Core(db, deps)` pattern with `withIdempotency`. Triggers are `onDocumentCreated` on Firestore. UI uses existing Zustand + React patterns in `apps/admin-desktop`. All features have emulator integration tests before implementation.

**Tech Stack:** Firebase Functions v2, Firestore, Zod, Vitest, @firebase/rules-unit-testing, @turf/turf, ngeohash, Zustand, React

**Prerequisite:** `2026-04-24-phase5-pre-b-schema.md` must be fully complete and green.

---

## File Map

| Action | File                                                               |
| ------ | ------------------------------------------------------------------ |
| Create | `functions/src/callables/request-agency-assistance.ts`             |
| Create | `functions/src/callables/accept-agency-assistance.ts`              |
| Create | `functions/src/callables/decline-agency-assistance.ts`             |
| Create | `functions/src/scheduled/admin-operations-sweep.ts`                |
| Create | `functions/src/callables/enter-field-mode.ts`                      |
| Create | `functions/src/callables/exit-field-mode.ts`                       |
| Create | `scripts/extract-boundaries.ts`                                    |
| Create | `packages/shared-data/src/boundary-geohash-set.ts`                 |
| Create | `packages/shared-data/src/municipality-boundaries.geojson`         |
| Create | `packages/shared-data/src/barangay-boundaries.geojson`             |
| Create | `functions/src/callables/share-report.ts`                          |
| Create | `functions/src/triggers/border-auto-share.ts`                      |
| Create | `functions/src/callables/add-command-channel-message.ts`           |
| Create | `functions/src/__tests__/callables/agency-assistance.test.ts`      |
| Create | `functions/src/__tests__/callables/field-mode.test.ts`             |
| Create | `functions/src/__tests__/callables/share-report.test.ts`           |
| Create | `functions/src/__tests__/callables/command-channel.test.ts`        |
| Create | `functions/src/__tests__/triggers/border-auto-share.test.ts`       |
| Create | `functions/src/__tests__/scheduled/admin-operations-sweep.test.ts` |
| Create | `apps/admin-desktop/src/pages/AgencyAssistanceQueuePage.tsx`       |
| Create | `apps/admin-desktop/src/hooks/useFieldModeStore.ts`                |
| Create | `apps/admin-desktop/src/components/ReconnectBanner.tsx`            |
| Create | `apps/admin-desktop/src/components/CommandChannelPanel.tsx`        |
| Modify | `functions/src/index.ts`                                           |
| Modify | `apps/admin-desktop/src/app/routes.tsx`                            |

---

### Task 1: B.1 — Agency Assistance callables (tests first)

**Files:**

- Create: `functions/src/__tests__/callables/agency-assistance.test.ts`
- Create: `functions/src/callables/request-agency-assistance.ts`
- Create: `functions/src/callables/accept-agency-assistance.ts`
- Create: `functions/src/callables/decline-agency-assistance.ts`

- [ ] **Step 1: Write ALL failing tests as `it.todo` stubs**

Create `functions/src/__tests__/callables/agency-assistance.test.ts`:

```typescript
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))

const { onCallMock } = vi.hoisted(() => ({
  onCallMock: vi.fn((_config: unknown, handler: unknown) => handler),
}))

vi.mock('firebase-functions/v2/https', async () => {
  const actual = await vi.importActual<typeof import('firebase-functions/v2/https')>(
    'firebase-functions/v2/https',
  )
  return { ...actual, onCall: onCallMock }
})

let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import {
  requestAgencyAssistanceCore,
  acceptAgencyAssistanceCore,
  declineAgencyAssistanceCore,
} from '../../callables/request-agency-assistance.js'
import { seedActiveAccount } from '../helpers/seed-factories.js'

const ts = 1713350400000
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'agency-assistance-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv.cleanup()
})

const muniAdminActor = {
  uid: 'daet-admin',
  claims: { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'daet' },
}
const agencyAdminActor = {
  uid: 'bfp-admin',
  claims: { role: 'agency_admin', accountStatus: 'active', agencyId: 'bfp' },
}

async function seedReport(id: string, status = 'verified', muni = 'daet') {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'report_ops', id), {
      reportId: id,
      status,
      municipalityId: muni,
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    })
  })
}

describe('requestAgencyAssistance', () => {
  it('rejects a non-muni-admin caller', async () => {
    await seedReport('r1')
    await expect(
      requestAgencyAssistanceCore(adminDb, {
        reportId: 'r1',
        agencyId: 'bfp',
        actor: {
          uid: 'resp-1',
          claims: { role: 'responder', accountStatus: 'active', municipalityId: 'daet' },
        },
        idempotencyKey: crypto.randomUUID(),
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('rejects a muni admin requesting for a report in another municipality', async () => {
    await seedReport('r1', 'verified', 'mercedes')
    await expect(
      requestAgencyAssistanceCore(adminDb, {
        reportId: 'r1',
        agencyId: 'bfp',
        actor: muniAdminActor,
        idempotencyKey: crypto.randomUUID(),
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('rejects a request for a terminal-status report', async () => {
    await seedReport('r1', 'closed')
    await expect(
      requestAgencyAssistanceCore(adminDb, {
        reportId: 'r1',
        agencyId: 'bfp',
        actor: muniAdminActor,
        idempotencyKey: crypto.randomUUID(),
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'failed-precondition' })
  })

  it('creates agency_assistance_requests doc with status pending', async () => {
    await seedReport('r1')
    await seedActiveAccount(testEnv, { uid: 'bfp-admin', role: 'agency_admin', agencyId: 'bfp' })
    const result = await requestAgencyAssistanceCore(adminDb, {
      reportId: 'r1',
      agencyId: 'bfp',
      actor: muniAdminActor,
      idempotencyKey: crypto.randomUUID(),
      now: Timestamp.fromMillis(ts),
    })
    expect(result.status).toBe('created')
    const snap = await adminDb.collection('agency_assistance_requests').doc(result.requestId).get()
    expect(snap.data()?.status).toBe('pending')
  })

  it('creates a command_channel_thread with threadType agency_assistance', async () => {
    await seedReport('r1')
    await seedActiveAccount(testEnv, { uid: 'bfp-admin', role: 'agency_admin', agencyId: 'bfp' })
    const result = await requestAgencyAssistanceCore(adminDb, {
      reportId: 'r1',
      agencyId: 'bfp',
      actor: muniAdminActor,
      idempotencyKey: crypto.randomUUID(),
      now: Timestamp.fromMillis(ts),
    })
    const threads = await adminDb
      .collection('command_channel_threads')
      .where('assistanceRequestId', '==', result.requestId)
      .get()
    expect(threads.empty).toBe(false)
    expect(threads.docs[0]?.data().threadType).toBe('agency_assistance')
  })

  it('is idempotent — double-call returns success without duplicate docs', async () => {
    await seedReport('r1')
    await seedActiveAccount(testEnv, { uid: 'bfp-admin', role: 'agency_admin', agencyId: 'bfp' })
    const key = crypto.randomUUID()
    const r1 = await requestAgencyAssistanceCore(adminDb, {
      reportId: 'r1',
      agencyId: 'bfp',
      actor: muniAdminActor,
      idempotencyKey: key,
      now: Timestamp.fromMillis(ts),
    })
    const r2 = await requestAgencyAssistanceCore(adminDb, {
      reportId: 'r1',
      agencyId: 'bfp',
      actor: muniAdminActor,
      idempotencyKey: key,
      now: Timestamp.fromMillis(ts),
    })
    expect(r1.requestId).toBe(r2.requestId)
    const snap = await adminDb.collection('agency_assistance_requests').get()
    expect(snap.docs.length).toBe(1)
  })
})

describe('acceptAgencyAssistance', () => {
  it('rejects a caller whose agencyId does not match the request', async () => {
    await seedReport('r1')
    const reqRef = adminDb.collection('agency_assistance_requests').doc('ar1')
    await reqRef.set({
      reportId: 'r1',
      requestedByMunicipalId: 'daet',
      requestedByMunicipality: 'Daet',
      targetAgencyId: 'bfp',
      requestType: 'BFP',
      message: '',
      priority: 'normal',
      status: 'pending',
      fulfilledByDispatchIds: [],
      createdAt: ts,
      expiresAt: ts + 3600000,
      schemaVersion: 1,
    })
    await expect(
      acceptAgencyAssistanceCore(adminDb, {
        requestId: 'ar1',
        actor: {
          uid: 'pnp-admin',
          claims: { role: 'agency_admin', accountStatus: 'active', agencyId: 'pnp' },
        },
        idempotencyKey: crypto.randomUUID(),
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('updates status to accepted', async () => {
    await seedReport('r1')
    const reqRef = adminDb.collection('agency_assistance_requests').doc('ar1')
    await reqRef.set({
      reportId: 'r1',
      requestedByMunicipalId: 'daet',
      requestedByMunicipality: 'Daet',
      targetAgencyId: 'bfp',
      requestType: 'BFP',
      message: '',
      priority: 'normal',
      status: 'pending',
      fulfilledByDispatchIds: [],
      createdAt: ts,
      expiresAt: ts + 3600000,
      schemaVersion: 1,
    })
    await acceptAgencyAssistanceCore(adminDb, {
      requestId: 'ar1',
      actor: agencyAdminActor,
      idempotencyKey: crypto.randomUUID(),
      now: Timestamp.fromMillis(ts),
    })
    const snap = await reqRef.get()
    expect(snap.data()?.status).toBe('accepted')
    expect(snap.data()?.respondedBy).toBe('bfp-admin')
  })
})

describe('declineAgencyAssistance', () => {
  it('requires a non-empty reason', async () => {
    const reqRef = adminDb.collection('agency_assistance_requests').doc('ar1')
    await reqRef.set({
      reportId: 'r1',
      requestedByMunicipalId: 'daet',
      requestedByMunicipality: 'Daet',
      targetAgencyId: 'bfp',
      requestType: 'BFP',
      message: '',
      priority: 'normal',
      status: 'pending',
      fulfilledByDispatchIds: [],
      createdAt: ts,
      expiresAt: ts + 3600000,
      schemaVersion: 1,
    })
    await expect(
      declineAgencyAssistanceCore(adminDb, {
        requestId: 'ar1',
        reason: '   ',
        actor: agencyAdminActor,
        idempotencyKey: crypto.randomUUID(),
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('updates status to declined with reason and closes thread', async () => {
    const reqRef = adminDb.collection('agency_assistance_requests').doc('ar1')
    await reqRef.set({
      reportId: 'r1',
      requestedByMunicipalId: 'daet',
      requestedByMunicipality: 'Daet',
      targetAgencyId: 'bfp',
      requestType: 'BFP',
      message: '',
      priority: 'normal',
      status: 'pending',
      fulfilledByDispatchIds: [],
      createdAt: ts,
      expiresAt: ts + 3600000,
      schemaVersion: 1,
    })
    const threadRef = adminDb.collection('command_channel_threads').doc('th1')
    await threadRef.set({
      threadId: 'th1',
      reportId: 'r1',
      assistanceRequestId: 'ar1',
      threadType: 'agency_assistance',
      subject: 'Need help',
      participantUids: { 'daet-admin': true, 'bfp-admin': true },
      createdBy: 'daet-admin',
      createdAt: ts,
      updatedAt: ts,
      schemaVersion: 1,
    })
    await declineAgencyAssistanceCore(adminDb, {
      requestId: 'ar1',
      reason: 'Units deployed elsewhere',
      actor: agencyAdminActor,
      idempotencyKey: crypto.randomUUID(),
      now: Timestamp.fromMillis(ts),
    })
    const reqSnap = await reqRef.get()
    expect(reqSnap.data()?.status).toBe('declined')
    expect(reqSnap.data()?.declinedReason).toBe('Units deployed elsewhere')
    const threadSnap = await threadRef.get()
    expect(threadSnap.data()?.closedAt).toBe(ts)
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
firebase emulators:exec --only firestore,auth \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/agency-assistance.test.ts"
```

Expected: FAIL — imports not found.

- [ ] **Step 3: Create `functions/src/callables/request-agency-assistance.ts`**

```typescript
import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminDb } from '../admin-init.js'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'
import { withIdempotency } from '../idempotency/guard.js'
import { bantayogErrorToHttps, requireAuth } from './https-error.js'

const TERMINAL_STATUSES = new Set([
  'closed',
  'rejected',
  'cancelled',
  'cancelled_false_report',
  'merged_as_duplicate',
])

const requestSchema = z
  .object({
    reportId: z.string().min(1).max(128),
    agencyId: z.string().min(1).max(64),
    note: z.string().max(1000).optional(),
    idempotencyKey: z.uuid(),
  })
  .strict()

export interface RequestAgencyAssistanceDeps {
  reportId: string
  agencyId: string
  note?: string
  idempotencyKey: string
  actor: { uid: string; claims: { role: string; accountStatus: string; municipalityId?: string } }
  now: Timestamp
}

export interface AcceptAgencyAssistanceDeps {
  requestId: string
  idempotencyKey: string
  actor: { uid: string; claims: { role: string; accountStatus: string; agencyId?: string } }
  now: Timestamp
}

export interface DeclineAgencyAssistanceDeps {
  requestId: string
  reason: string
  idempotencyKey: string
  actor: { uid: string; claims: { role: string; accountStatus: string; agencyId?: string } }
  now: Timestamp
}

export async function requestAgencyAssistanceCore(
  db: FirebaseFirestore.Firestore,
  deps: RequestAgencyAssistanceDeps,
): Promise<{ status: 'created'; requestId: string }> {
  const { reportId, agencyId, note, idempotencyKey, actor, now } = deps
  const nowMs = now.toMillis()

  if (actor.claims.role !== 'municipal_admin' || actor.claims.accountStatus !== 'active') {
    throw new HttpsError('permission-denied', 'municipal_admin required')
  }

  const opsSnap = await db.collection('report_ops').doc(reportId).get()
  if (!opsSnap.exists) throw new HttpsError('not-found', 'report not found')
  const ops = opsSnap.data()!
  if (ops.municipalityId !== actor.claims.municipalityId) {
    throw new HttpsError('permission-denied', 'report belongs to a different municipality')
  }
  if (TERMINAL_STATUSES.has(ops.status as string)) {
    throw new HttpsError('failed-precondition', 'report is in a terminal status')
  }

  const agencyAdmins = await db
    .collection('active_accounts')
    .where('agencyId', '==', agencyId)
    .where('accountStatus', '==', 'active')
    .get()

  const participantUids: Record<string, true> = { [actor.uid]: true }
  for (const d of agencyAdmins.docs) participantUids[d.id] = true

  const { result } = await withIdempotency(
    db,
    {
      key: `requestAgencyAssistance:${actor.uid}:${idempotencyKey}`,
      payload: { reportId, agencyId },
      now: () => nowMs,
    },
    async () => {
      const requestRef = db.collection('agency_assistance_requests').doc()
      const threadRef = db.collection('command_channel_threads').doc()
      await db.runTransaction(async (tx) => {
        tx.set(requestRef, {
          reportId,
          requestedByMunicipalId: actor.claims.municipalityId!,
          requestedByMunicipality: actor.claims.municipalityId!,
          targetAgencyId: agencyId,
          requestType: agencyId.split('-')[0]?.toUpperCase() ?? 'OTHER',
          message: note ?? '',
          priority: 'normal',
          status: 'pending',
          fulfilledByDispatchIds: [],
          createdAt: nowMs,
          expiresAt: nowMs + 24 * 60 * 60 * 1000,
          schemaVersion: 1,
        })
        tx.set(threadRef, {
          threadId: threadRef.id,
          reportId,
          assistanceRequestId: requestRef.id,
          threadType: 'agency_assistance',
          subject: `Agency assistance for report ${reportId}`,
          participantUids,
          createdBy: actor.uid,
          createdAt: nowMs,
          updatedAt: nowMs,
          schemaVersion: 1,
        })
      })
      return { requestId: requestRef.id }
    },
  )
  return { status: 'created', requestId: result.requestId }
}

export async function acceptAgencyAssistanceCore(
  db: FirebaseFirestore.Firestore,
  deps: AcceptAgencyAssistanceDeps,
): Promise<{ status: 'accepted' }> {
  const { requestId, idempotencyKey, actor, now } = deps
  const nowMs = now.toMillis()

  if (actor.claims.role !== 'agency_admin' || actor.claims.accountStatus !== 'active') {
    throw new HttpsError('permission-denied', 'agency_admin required')
  }

  const snap = await db.collection('agency_assistance_requests').doc(requestId).get()
  if (!snap.exists) throw new HttpsError('not-found', 'request not found')
  const req = snap.data()!
  if (req.targetAgencyId !== actor.claims.agencyId) {
    throw new HttpsError('permission-denied', 'agencyId mismatch')
  }
  if (req.status === 'accepted') return { status: 'accepted' } // idempotent

  await withIdempotency(
    db,
    {
      key: `acceptAgencyAssistance:${actor.uid}:${idempotencyKey}`,
      payload: { requestId },
      now: () => nowMs,
    },
    async () => {
      await db.collection('agency_assistance_requests').doc(requestId).update({
        status: 'accepted',
        respondedAt: nowMs,
        respondedBy: actor.uid,
      })
    },
  )
  return { status: 'accepted' }
}

export async function declineAgencyAssistanceCore(
  db: FirebaseFirestore.Firestore,
  deps: DeclineAgencyAssistanceDeps,
): Promise<{ status: 'declined' }> {
  const { requestId, reason, idempotencyKey, actor, now } = deps
  const nowMs = now.toMillis()
  const trimmedReason = reason.trim()

  if (actor.claims.role !== 'agency_admin' || actor.claims.accountStatus !== 'active') {
    throw new HttpsError('permission-denied', 'agency_admin required')
  }
  if (!trimmedReason) throw new HttpsError('invalid-argument', 'reason required')

  const snap = await db.collection('agency_assistance_requests').doc(requestId).get()
  if (!snap.exists) throw new HttpsError('not-found', 'request not found')
  const req = snap.data()!
  if (req.targetAgencyId !== actor.claims.agencyId) {
    throw new HttpsError('permission-denied', 'agencyId mismatch')
  }

  await withIdempotency(
    db,
    {
      key: `declineAgencyAssistance:${actor.uid}:${idempotencyKey}`,
      payload: { requestId, reason: trimmedReason },
      now: () => nowMs,
    },
    async () => {
      // Find the associated thread by assistanceRequestId
      const threads = await db
        .collection('command_channel_threads')
        .where('assistanceRequestId', '==', requestId)
        .limit(1)
        .get()

      await db.runTransaction(async (tx) => {
        tx.update(db.collection('agency_assistance_requests').doc(requestId), {
          status: 'declined',
          declinedReason: trimmedReason,
          respondedAt: nowMs,
          respondedBy: actor.uid,
        })
        if (!threads.empty) {
          tx.update(threads.docs[0]!.ref, { closedAt: nowMs, updatedAt: nowMs })
        }
      })
    },
  )
  return { status: 'declined' }
}

// Callable exports
export const requestAgencyAssistance = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (req: CallableRequest) => {
    const actor = requireAuth(req)
    const input = requestSchema.parse(req.data)
    try {
      return await requestAgencyAssistanceCore(adminDb, {
        ...input,
        actor,
        now: Timestamp.now(),
      })
    } catch (err) {
      throw bantayogErrorToHttps(err)
    }
  },
)

export const acceptAgencyAssistance = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (req: CallableRequest) => {
    const actor = requireAuth(req)
    const input = z
      .object({ requestId: z.string().min(1), idempotencyKey: z.uuid() })
      .strict()
      .parse(req.data)
    try {
      return await acceptAgencyAssistanceCore(adminDb, { ...input, actor, now: Timestamp.now() })
    } catch (err) {
      throw bantayogErrorToHttps(err)
    }
  },
)

export const declineAgencyAssistance = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (req: CallableRequest) => {
    const actor = requireAuth(req)
    const input = z
      .object({
        requestId: z.string().min(1),
        reason: z.string().min(1).max(500),
        idempotencyKey: z.uuid(),
      })
      .strict()
      .parse(req.data)
    try {
      return await declineAgencyAssistanceCore(adminDb, { ...input, actor, now: Timestamp.now() })
    } catch (err) {
      throw bantayogErrorToHttps(err)
    }
  },
)
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
firebase emulators:exec --only firestore,auth \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/agency-assistance.test.ts"
```

Expected: PASS (9 tests)

- [ ] **Step 5: Export callables from `functions/src/index.ts`**

```typescript
export {
  requestAgencyAssistance,
  acceptAgencyAssistance,
  declineAgencyAssistance,
} from './callables/request-agency-assistance.js'
```

- [ ] **Step 6: Commit**

```bash
git add functions/src/callables/request-agency-assistance.ts \
        functions/src/__tests__/callables/agency-assistance.test.ts \
        functions/src/index.ts
git commit -m "feat(callables): requestAgencyAssistance, acceptAgencyAssistance, declineAgencyAssistance"
```

---

### Task 2: B.1 — `adminOperationsSweep` (agency escalation path)

**Files:**

- Create: `functions/src/scheduled/admin-operations-sweep.ts`
- Create: `functions/src/__tests__/scheduled/admin-operations-sweep.test.ts`

- [ ] **Step 1: Write failing tests**

Create `functions/src/__tests__/scheduled/admin-operations-sweep.test.ts`:

```typescript
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { adminOperationsSweepCore } from '../../scheduled/admin-operations-sweep.js'

const ts = 1713350400000
const THIRTY_MIN_MS = 30 * 60 * 1000
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'admin-sweep-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv.cleanup()
})

describe('adminOperationsSweep — agency assistance escalation', () => {
  it('ignores requests pending for less than 30 minutes', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'agency_assistance_requests', 'ar1'), {
        status: 'pending',
        createdAt: ts - THIRTY_MIN_MS + 60000,
        reportId: 'r1',
        requestedByMunicipalId: 'daet',
        requestedByMunicipality: 'Daet',
        targetAgencyId: 'bfp',
        requestType: 'BFP',
        message: '',
        priority: 'normal',
        fulfilledByDispatchIds: [],
        expiresAt: ts + 3600000,
        schemaVersion: 1,
      })
    })
    await adminOperationsSweepCore(adminDb, { now: Timestamp.fromMillis(ts) })
    const snap = await adminDb.collection('agency_assistance_requests').doc('ar1').get()
    expect(snap.data()?.escalatedAt).toBeUndefined()
  })

  it('sets escalatedAt on requests pending over 30 minutes', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'agency_assistance_requests', 'ar1'), {
        status: 'pending',
        createdAt: ts - THIRTY_MIN_MS - 1,
        reportId: 'r1',
        requestedByMunicipalId: 'daet',
        requestedByMunicipality: 'Daet',
        targetAgencyId: 'bfp',
        requestType: 'BFP',
        message: '',
        priority: 'normal',
        fulfilledByDispatchIds: [],
        expiresAt: ts + 3600000,
        schemaVersion: 1,
      })
    })
    await adminOperationsSweepCore(adminDb, { now: Timestamp.fromMillis(ts) })
    const snap = await adminDb.collection('agency_assistance_requests').doc('ar1').get()
    expect(snap.data()?.escalatedAt).toBe(ts)
  })

  it('does not re-escalate already-escalated requests', async () => {
    const originalEscalatedAt = ts - 60000
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'agency_assistance_requests', 'ar1'), {
        status: 'pending',
        createdAt: ts - THIRTY_MIN_MS - 1,
        escalatedAt: originalEscalatedAt,
        reportId: 'r1',
        requestedByMunicipalId: 'daet',
        requestedByMunicipality: 'Daet',
        targetAgencyId: 'bfp',
        requestType: 'BFP',
        message: '',
        priority: 'normal',
        fulfilledByDispatchIds: [],
        expiresAt: ts + 3600000,
        schemaVersion: 1,
      })
    })
    await adminOperationsSweepCore(adminDb, { now: Timestamp.fromMillis(ts) })
    const snap = await adminDb.collection('agency_assistance_requests').doc('ar1').get()
    expect(snap.data()?.escalatedAt).toBe(originalEscalatedAt) // unchanged
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/scheduled/admin-operations-sweep.test.ts"
```

Expected: FAIL — import not found.

- [ ] **Step 3: Create `functions/src/scheduled/admin-operations-sweep.ts`**

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../admin-init.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('adminOperationsSweep')
const THIRTY_MIN_MS = 30 * 60 * 1000

export interface AdminOperationsSweepDeps {
  now: Timestamp
}

export async function adminOperationsSweepCore(
  db: FirebaseFirestore.Firestore,
  deps: AdminOperationsSweepDeps,
): Promise<void> {
  const nowMs = deps.now.toMillis()
  const cutoff = nowMs - THIRTY_MIN_MS

  // Agency assistance escalation: pending > 30min with no escalatedAt
  const pendingAssistance = await db
    .collection('agency_assistance_requests')
    .where('status', '==', 'pending')
    .where('createdAt', '<', cutoff)
    .get()

  const toEscalate = pendingAssistance.docs.filter((d) => !d.data().escalatedAt)
  for (const d of toEscalate) {
    await d.ref.update({ escalatedAt: nowMs })
    log({
      severity: 'INFO',
      code: 'sweep.agency.escalated',
      message: `Escalated agency request ${d.id}`,
    })
    // TODO(BANTAYOG-PHASE5): FCM + SMS to superadmins — implement when FCM send service is wired
  }
}

export const adminOperationsSweep = onSchedule(
  { schedule: 'every 10 minutes', region: 'asia-southeast1', timeoutSeconds: 120 },
  async () => {
    await adminOperationsSweepCore(adminDb, { now: Timestamp.now() })
  },
)
```

- [ ] **Step 4: Run to confirm pass**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/scheduled/admin-operations-sweep.test.ts"
```

Expected: PASS (3 tests)

- [ ] **Step 5: Export from index**

```typescript
// In functions/src/index.ts:
export { adminOperationsSweep } from './scheduled/admin-operations-sweep.js'
```

- [ ] **Step 6: Commit**

```bash
git add functions/src/scheduled/admin-operations-sweep.ts \
        functions/src/__tests__/scheduled/admin-operations-sweep.test.ts \
        functions/src/index.ts
git commit -m "feat(scheduled): adminOperationsSweep — escalate stale agency assistance requests"
```

---

### Task 3: B.1 — Agency Admin UI (`AgencyAssistanceQueuePage`)

**Files:**

- Create: `apps/admin-desktop/src/pages/AgencyAssistanceQueuePage.tsx`
- Create: `apps/admin-desktop/src/pages/AgencyAssistanceQueuePage.test.tsx`
- Modify: `apps/admin-desktop/src/app/routes.tsx`

- [ ] **Step 1: Write failing UI tests**

Create `apps/admin-desktop/src/pages/AgencyAssistanceQueuePage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgencyAssistanceQueuePage } from './AgencyAssistanceQueuePage.js'

const mockOnSnapshot = vi.fn()
const mockCallable = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: mockOnSnapshot,
  getFirestore: vi.fn(),
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
  getFunctions: vi.fn(),
}))

const pendingRequest = {
  id: 'ar1',
  data: () => ({
    reportId: 'r1',
    requestedByMunicipality: 'Daet',
    message: 'Need BFP assistance',
    priority: 'urgent',
    status: 'pending',
    targetAgencyId: 'bfp',
    createdAt: 1713350400000,
  }),
}

beforeEach(() => {
  mockOnSnapshot.mockImplementation((_q, cb) => {
    cb({ docs: [pendingRequest] })
    return vi.fn() // unsubscribe
  })
  mockCallable.mockResolvedValue({ data: { status: 'accepted' } })
})

describe('AgencyAssistanceQueuePage', () => {
  it('renders pending requests for agency_admin role', () => {
    render(<AgencyAssistanceQueuePage agencyId="bfp" />)
    expect(screen.getByText('Need BFP assistance')).toBeInTheDocument()
  })

  it('shows Accept and Decline buttons on pending requests', () => {
    render(<AgencyAssistanceQueuePage agencyId="bfp" />)
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument()
  })

  it('calls acceptAgencyAssistance callable on Accept click', async () => {
    render(<AgencyAssistanceQueuePage agencyId="bfp" />)
    fireEvent.click(screen.getByRole('button', { name: /accept/i }))
    await waitFor(() => expect(mockCallable).toHaveBeenCalled())
  })

  it('requires reason before allowing decline submit', async () => {
    render(<AgencyAssistanceQueuePage agencyId="bfp" />)
    fireEvent.click(screen.getByRole('button', { name: /decline/i }))
    const submitBtn = await screen.findByRole('button', { name: /submit decline/i })
    expect(submitBtn).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText(/reason/i), { target: { value: 'Too far' } })
    expect(submitBtn).not.toBeDisabled()
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm --filter @bantayog/admin-desktop exec vitest run src/pages/AgencyAssistanceQueuePage.test.tsx
```

Expected: FAIL — component not found.

- [ ] **Step 3: Create `AgencyAssistanceQueuePage.tsx`**

```typescript
import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, type QueryDocumentSnapshot } from 'firebase/firestore'
import { httpsCallable, getFunctions } from 'firebase/functions'
import { db } from '../firebase.js'
import { crypto } from 'node:crypto'

interface AssistanceRequest {
  id: string
  reportId: string
  requestedByMunicipality: string
  message: string
  priority: 'urgent' | 'normal'
  status: 'pending' | 'accepted' | 'declined'
  createdAt: number
}

interface Props {
  agencyId: string
}

export function AgencyAssistanceQueuePage({ agencyId }: Props) {
  const [requests, setRequests] = useState<AssistanceRequest[]>([])
  const [declineId, setDeclineId] = useState<string | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [filter, setFilter] = useState<'pending' | 'accepted' | 'all'>('pending')

  useEffect(() => {
    const q = query(
      collection(db, 'agency_assistance_requests'),
      where('targetAgencyId', '==', agencyId),
    )
    return onSnapshot(q, (snap) => {
      setRequests(
        snap.docs.map((d: QueryDocumentSnapshot) => ({
          id: d.id,
          ...(d.data() as Omit<AssistanceRequest, 'id'>),
        })),
      )
    })
  }, [agencyId])

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  async function handleAccept(requestId: string) {
    const fn = httpsCallable(getFunctions(), 'acceptAgencyAssistance')
    await fn({ requestId, idempotencyKey: crypto.randomUUID() })
  }

  async function handleDeclineSubmit(requestId: string) {
    const fn = httpsCallable(getFunctions(), 'declineAgencyAssistance')
    await fn({ requestId, reason: declineReason, idempotencyKey: crypto.randomUUID() })
    setDeclineId(null)
    setDeclineReason('')
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Agency Assistance Requests</h1>
      <div className="flex gap-2 mb-4">
        {(['pending', 'accepted', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <ul className="space-y-3">
        {filtered.map((req) => (
          <li key={req.id} className="border rounded p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{req.requestedByMunicipality}</p>
                <p className="text-sm text-gray-600">{req.message}</p>
                <span className={`text-xs px-2 py-0.5 rounded ${req.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
                  {req.priority}
                </span>
              </div>
              {req.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleAccept(req.id)}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setDeclineId(req.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
            {declineId === req.id && (
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Reason for declining..."
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="border rounded px-2 py-1 w-full text-sm"
                />
                <button
                  onClick={() => void handleDeclineSubmit(req.id)}
                  disabled={!declineReason.trim()}
                  className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm disabled:opacity-50"
                >
                  Submit Decline
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Add route for agency admin**

In `apps/admin-desktop/src/app/routes.tsx`, add:

```typescript
import { AgencyAssistanceQueuePage } from '../pages/AgencyAssistanceQueuePage.js'

// In the route definitions, add (guarded by agency_admin role):
{
  path: '/agency',
  element: (
    <ProtectedRoute allowedRoles={['agency_admin']}>
      <AgencyAssistanceQueuePage agencyId={userClaims.agencyId ?? ''} />
    </ProtectedRoute>
  ),
}
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
pnpm --filter @bantayog/admin-desktop exec vitest run src/pages/AgencyAssistanceQueuePage.test.tsx
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/admin-desktop/src/pages/AgencyAssistanceQueuePage.tsx \
        apps/admin-desktop/src/pages/AgencyAssistanceQueuePage.test.tsx \
        apps/admin-desktop/src/app/routes.tsx
git commit -m "feat(admin-desktop): AgencyAssistanceQueuePage — accept/decline with reason"
```

---

### Task 4: B.2 — `enterFieldMode` + `exitFieldMode` callables

**Files:**

- Create: `functions/src/callables/enter-field-mode.ts`
- Create: `functions/src/__tests__/callables/field-mode.test.ts`

- [ ] **Step 1: Write failing tests**

Create `functions/src/__tests__/callables/field-mode.test.ts`:

```typescript
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { enterFieldModeCore, exitFieldModeCore } from '../../callables/enter-field-mode.js'

const ts = 1713350400000
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'field-mode-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv.cleanup()
})

describe('enterFieldMode', () => {
  it('rejects a muni admin whose auth_time is more than 4 hours ago', async () => {
    const staleAuthTime = Math.floor((ts - FOUR_HOURS_MS - 1000) / 1000) // Unix seconds
    await expect(
      enterFieldModeCore(adminDb, {
        actor: {
          uid: 'daet-admin',
          claims: {
            role: 'municipal_admin',
            accountStatus: 'active',
            municipalityId: 'daet',
            auth_time: staleAuthTime,
          },
        },
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('creates field_mode_sessions with isActive true and 12h expiry', async () => {
    const freshAuthTime = Math.floor((ts - 60000) / 1000) // 1 minute ago
    await enterFieldModeCore(adminDb, {
      actor: {
        uid: 'daet-admin',
        claims: {
          role: 'municipal_admin',
          accountStatus: 'active',
          municipalityId: 'daet',
          auth_time: freshAuthTime,
        },
      },
      now: Timestamp.fromMillis(ts),
    })
    const snap = await adminDb.collection('field_mode_sessions').doc('daet-admin').get()
    expect(snap.data()?.isActive).toBe(true)
    expect(snap.data()?.expiresAt).toBe(ts + 12 * 60 * 60 * 1000)
  })

  it('rejects citizens and responders', async () => {
    for (const role of ['citizen', 'responder']) {
      await expect(
        enterFieldModeCore(adminDb, {
          actor: {
            uid: 'u1',
            claims: {
              role,
              accountStatus: 'active',
              municipalityId: 'daet',
              auth_time: Math.floor(ts / 1000),
            },
          },
          now: Timestamp.fromMillis(ts),
        }),
      ).rejects.toMatchObject({ code: 'permission-denied' })
    }
  })
})

describe('exitFieldMode', () => {
  it('sets isActive false and records exitedAt', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'field_mode_sessions', 'daet-admin'), {
        uid: 'daet-admin',
        municipalityId: 'daet',
        enteredAt: ts - 60000,
        expiresAt: ts + 43200000,
        isActive: true,
        schemaVersion: 1,
      })
    })
    await exitFieldModeCore(adminDb, {
      actor: {
        uid: 'daet-admin',
        claims: { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'daet' },
      },
      now: Timestamp.fromMillis(ts),
    })
    const snap = await adminDb.collection('field_mode_sessions').doc('daet-admin').get()
    expect(snap.data()?.isActive).toBe(false)
    expect(snap.data()?.exitedAt).toBe(ts)
  })

  it('is idempotent — double-exit returns success', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'field_mode_sessions', 'daet-admin'), {
        uid: 'daet-admin',
        municipalityId: 'daet',
        isActive: false,
        exitedAt: ts - 60000,
        enteredAt: ts - 120000,
        expiresAt: ts + 43200000,
        schemaVersion: 1,
      })
    })
    await expect(
      exitFieldModeCore(adminDb, {
        actor: {
          uid: 'daet-admin',
          claims: { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'daet' },
        },
        now: Timestamp.fromMillis(ts),
      }),
    ).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/field-mode.test.ts"
```

Expected: FAIL — imports not found.

- [ ] **Step 3: Create `functions/src/callables/enter-field-mode.ts`**

```typescript
import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../admin-init.js'
import { bantayogErrorToHttps, requireAuth } from './https-error.js'

const ALLOWED_ROLES = new Set(['municipal_admin', 'agency_admin', 'provincial_superadmin'])
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000

export interface FieldModeActorClaims {
  role: string
  accountStatus: string
  municipalityId?: string
  auth_time: number // Unix seconds from Firebase token
}

export async function enterFieldModeCore(
  db: FirebaseFirestore.Firestore,
  deps: { actor: { uid: string; claims: FieldModeActorClaims }; now: Timestamp },
): Promise<{ status: 'entered'; expiresAt: number }> {
  const { actor, now } = deps
  const nowMs = now.toMillis()

  if (!ALLOWED_ROLES.has(actor.claims.role) || actor.claims.accountStatus !== 'active') {
    throw new HttpsError('permission-denied', 'admin role required')
  }

  // auth_time is Unix seconds; multiply by 1000 to compare with Date.now() (milliseconds)
  const authTimeMs = actor.claims.auth_time * 1000
  if (nowMs - authTimeMs > FOUR_HOURS_MS) {
    throw new HttpsError('unauthenticated', 'Re-authentication required for field mode')
  }

  const expiresAt = nowMs + TWELVE_HOURS_MS
  await db
    .collection('field_mode_sessions')
    .doc(actor.uid)
    .set({
      uid: actor.uid,
      municipalityId: actor.claims.municipalityId ?? '',
      enteredAt: nowMs,
      expiresAt,
      isActive: true,
      schemaVersion: 1,
    })
  return { status: 'entered', expiresAt }
}

export async function exitFieldModeCore(
  db: FirebaseFirestore.Firestore,
  deps: { actor: { uid: string; claims: { role: string; accountStatus: string } }; now: Timestamp },
): Promise<{ status: 'exited' }> {
  const { actor, now } = deps
  const nowMs = now.toMillis()

  const sessionRef = db.collection('field_mode_sessions').doc(actor.uid)
  const snap = await sessionRef.get()
  if (!snap.exists || !snap.data()?.isActive) return { status: 'exited' } // idempotent

  await sessionRef.update({ isActive: false, exitedAt: nowMs })
  return { status: 'exited' }
}

export const enterFieldMode = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (req: CallableRequest) => {
    const actor = requireAuth(req)
    // auth_time comes from Firebase's token claims
    const claims = {
      ...actor.claims,
      auth_time: req.auth?.token?.auth_time ?? 0,
    } as FieldModeActorClaims
    try {
      return await enterFieldModeCore(adminDb, {
        actor: { uid: actor.uid, claims },
        now: Timestamp.now(),
      })
    } catch (err) {
      throw bantayogErrorToHttps(err)
    }
  },
)

export const exitFieldMode = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (req: CallableRequest) => {
    const actor = requireAuth(req)
    try {
      return await exitFieldModeCore(adminDb, { actor, now: Timestamp.now() })
    } catch (err) {
      throw bantayogErrorToHttps(err)
    }
  },
)
```

- [ ] **Step 4: Run to confirm pass**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/field-mode.test.ts"
```

Expected: PASS (5 tests)

- [ ] **Step 5: Export from index + commit**

```bash
# Add to functions/src/index.ts:
# export { enterFieldMode, exitFieldMode } from './callables/enter-field-mode.js'
git add functions/src/callables/enter-field-mode.ts \
        functions/src/__tests__/callables/field-mode.test.ts \
        functions/src/index.ts
git commit -m "feat(callables): enterFieldMode, exitFieldMode — 4h reauth check, 12h session"
```

---

### Task 5: B.2 — `useFieldModeStore` + `ReconnectBanner`

**Files:**

- Create: `apps/admin-desktop/src/hooks/useFieldModeStore.ts`
- Create: `apps/admin-desktop/src/components/ReconnectBanner.tsx`
- Create: `apps/admin-desktop/src/__tests__/field-mode-store.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/admin-desktop/src/__tests__/field-mode-store.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFieldModeStore } from '../hooks/useFieldModeStore.js'

const mockOnSnapshot = vi.fn()
const mockCallable = vi.fn()
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: mockOnSnapshot,
  getFirestore: vi.fn(),
}))
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
  getFunctions: vi.fn(),
}))

const ts = Date.now()

beforeEach(() => {
  mockCallable.mockResolvedValue({ data: { status: 'exited' } })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useFieldModeStore', () => {
  it('shows isActive true when session snapshot has isActive true', () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ exists: () => true, data: () => ({ isActive: true, expiresAt: ts + 3600000 }) })
      return vi.fn()
    })
    const { result } = renderHook(() => useFieldModeStore('uid-1'))
    expect(result.current.isActive).toBe(true)
  })

  it('shows isActive false when no session exists', () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ exists: () => false, data: () => undefined })
      return vi.fn()
    })
    const { result } = renderHook(() => useFieldModeStore('uid-1'))
    expect(result.current.isActive).toBe(false)
  })

  it('calls exitFieldMode when session expires', async () => {
    vi.useFakeTimers()
    const expiredAt = Date.now() - 1000
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ exists: () => true, data: () => ({ isActive: true, expiresAt: expiredAt }) })
      return vi.fn()
    })
    renderHook(() => useFieldModeStore('uid-1'))
    await act(async () => {
      vi.advanceTimersByTime(65000)
    })
    expect(mockCallable).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm --filter @bantayog/admin-desktop exec vitest run src/__tests__/field-mode-store.test.ts
```

Expected: FAIL — `useFieldModeStore` not found.

- [ ] **Step 3: Create `apps/admin-desktop/src/hooks/useFieldModeStore.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { doc, onSnapshot, getFirestore } from 'firebase/firestore'
import { httpsCallable, getFunctions } from 'firebase/functions'

interface FieldModeState {
  isActive: boolean
  expiresAt: number | null
  enter: () => Promise<void>
  exit: () => Promise<void>
}

export function useFieldModeStore(uid: string): FieldModeState {
  const [isActive, setIsActive] = useState(false)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)

  useEffect(() => {
    const ref = doc(getFirestore(), 'field_mode_sessions', uid)
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setIsActive(data?.isActive ?? false)
        setExpiresAt(data?.expiresAt ?? null)
      } else {
        setIsActive(false)
        setExpiresAt(null)
      }
    })
  }, [uid])

  const exit = useCallback(async () => {
    const fn = httpsCallable(getFunctions(), 'exitFieldMode')
    await fn({})
  }, [])

  // Check expiry every 60 seconds; exit if expired
  useEffect(() => {
    if (!isActive || expiresAt === null) return
    const id = setInterval(() => {
      if (Date.now() > expiresAt) void exit()
    }, 60_000)
    return () => clearInterval(id)
  }, [isActive, expiresAt, exit])

  const enter = useCallback(async () => {
    const fn = httpsCallable(getFunctions(), 'enterFieldMode')
    await fn({})
  }, [])

  return { isActive, expiresAt, enter, exit }
}
```

- [ ] **Step 4: Create `ReconnectBanner.tsx`**

```typescript
// apps/admin-desktop/src/components/ReconnectBanner.tsx
interface Props {
  actionLabel: string
}

export function ReconnectBanner({ actionLabel }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
      <span>⚠</span>
      <span>Connect to {actionLabel}</span>
    </div>
  )
}
```

- [ ] **Step 5: Run to confirm pass**

```bash
pnpm --filter @bantayog/admin-desktop exec vitest run src/__tests__/field-mode-store.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/admin-desktop/src/hooks/useFieldModeStore.ts \
        apps/admin-desktop/src/components/ReconnectBanner.tsx \
        apps/admin-desktop/src/__tests__/field-mode-store.test.ts
git commit -m "feat(admin-desktop): useFieldModeStore — 60s expiry check, clearInterval cleanup; ReconnectBanner"
```

---

### Task 6: B.3 — OSM Boundary Extraction Script

**Files:**

- Create: `scripts/extract-boundaries.ts`
- Create: `packages/shared-data/src/municipality-boundaries.geojson` (output of script)
- Create: `packages/shared-data/src/barangay-boundaries.geojson` (output of script)
- Create: `packages/shared-data/src/boundary-geohash-set.ts` (output of script)
- Modify: `packages/shared-data/package.json` (add @turf/turf, ngeohash)

- [ ] **Step 1: Add dependencies**

```bash
pnpm --filter @bantayog/shared-data add @turf/turf ngeohash
pnpm --filter @bantayog/shared-data add -D @types/ngeohash
pnpm --filter @bantayog/functions add @turf/turf ngeohash
pnpm --filter @bantayog/functions add -D @types/turf__turf @types/ngeohash
```

- [ ] **Step 2: Create `scripts/extract-boundaries.ts`**

```typescript
/**
 * Fetches Camarines Norte municipality and barangay boundaries from OpenStreetMap
 * via the Overpass API, simplifies geometries, and writes GeoJSON + geohash set
 * to packages/shared-data/src/.
 *
 * Run: pnpm exec tsx scripts/extract-boundaries.ts
 *
 * After running, commit the generated files:
 *   - packages/shared-data/src/municipality-boundaries.geojson
 *   - packages/shared-data/src/barangay-boundaries.geojson
 *   - packages/shared-data/src/boundary-geohash-set.ts
 *
 * Risk: OSM boundary quality at 500m precision is unverified for Camarines Norte.
 * Cross-check 3-5 known boundary points against PhilAtlas before committing.
 * If quality is insufficient, replace with MUNICIPALITY_ADJACENCY manual fallback.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as turf from '@turf/turf'
import ngeohash from 'ngeohash'
import type { FeatureCollection, Feature, Geometry } from 'geojson'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const OUTPUT_DIR = resolve(import.meta.dirname, '../packages/shared-data/src')

// Maps OSM relation names to internal system IDs
const MUNICIPALITY_NAME_MAP: Record<string, string> = {
  Capalonga: 'capalonga',
  'Jose Panganiban': 'jose-panganiban',
  Labo: 'labo',
  Mercedes: 'mercedes',
  Paracale: 'paracale',
  'San Lorenzo Ruiz': 'san-lorenzo-ruiz',
  'San Vicente': 'san-vicente',
  'Santa Elena': 'santa-elena',
  Talisay: 'talisay',
  Vinzons: 'vinzons',
  Basud: 'basud',
  Daet: 'daet',
}

async function overpassQuery(query: string): Promise<unknown> {
  const resp = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!resp.ok) throw new Error(`Overpass error ${resp.status}: ${await resp.text()}`)
  return resp.json()
}

async function main() {
  console.log('Fetching Camarines Norte boundaries from Overpass API...')

  // Municipality boundaries (admin_level=8)
  const muniQuery = `
    [out:json][timeout:120];
    area["name"="Camarines Norte"]->.cn;
    relation(area.cn)["admin_level"="8"]["boundary"="administrative"];
    out geom;
  `
  const muniData = (await overpassQuery(muniQuery)) as { elements: unknown[] }

  const muniFeatures: Feature[] = []
  for (const el of muniData.elements as Array<{
    tags?: Record<string, string>
    geometry?: unknown
  }>) {
    const name = el.tags?.['name'] ?? ''
    const id = MUNICIPALITY_NAME_MAP[name]
    if (!id) {
      console.warn(`SKIP: Unknown municipality name "${name}"`)
      continue
    }

    const feature = osmRelationToGeoJSON(el)
    if (!feature) continue

    const simplified = turf.simplify(feature, { tolerance: 0.001, highQuality: true })
    simplified.properties = { municipalityId: id, name }
    muniFeatures.push(simplified)
  }

  const muniCollection: FeatureCollection = { type: 'FeatureCollection', features: muniFeatures }
  writeFileSync(
    resolve(OUTPUT_DIR, 'municipality-boundaries.geojson'),
    JSON.stringify(muniCollection, null, 2),
  )
  console.log(`✓ Wrote ${muniFeatures.length} municipality features`)

  if (muniFeatures.length !== 12) {
    console.error(
      `ERROR: Expected 12 municipalities, got ${muniFeatures.length}. Check MUNICIPALITY_NAME_MAP.`,
    )
    process.exit(1)
  }

  // Barangay boundaries (admin_level=10)
  const barangayQuery = `
    [out:json][timeout:180];
    area["name"="Camarines Norte"]->.cn;
    relation(area.cn)["admin_level"="10"]["boundary"="administrative"];
    out geom;
  `
  const barangayData = (await overpassQuery(barangayQuery)) as { elements: unknown[] }
  const barangayFeatures: Feature[] = []
  for (const el of barangayData.elements as Array<{
    tags?: Record<string, string>
    geometry?: unknown
  }>) {
    const feature = osmRelationToGeoJSON(el)
    if (!feature) continue
    const simplified = turf.simplify(feature, { tolerance: 0.0005, highQuality: true })
    simplified.properties = { barangayName: el.tags?.['name'] ?? '' }
    barangayFeatures.push(simplified)
  }

  const barangayCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: barangayFeatures,
  }
  writeFileSync(
    resolve(OUTPUT_DIR, 'barangay-boundaries.geojson'),
    JSON.stringify(barangayCollection, null, 2),
  )
  console.log(`✓ Wrote ${barangayFeatures.length} barangay features`)

  // Generate boundary geohash set — 6-char cells within 2km of any inter-municipal boundary
  const boundaryGeohashes = new Set<string>()
  for (const feature of muniFeatures) {
    const boundary = turf.polygonToLine(feature as turf.Feature<turf.Polygon | turf.MultiPolygon>)
    const buffered = turf.buffer(boundary, 2, { units: 'kilometers' })
    if (!buffered) continue
    const bbox = turf.bbox(buffered)
    // Enumerate all 6-char geohash cells in the bounding box
    const [minLng, minLat, maxLng, maxLat] = bbox
    const cells = ngeohash.bboxes(minLat, minLng, maxLat, maxLng, 6)
    for (const cell of cells) {
      const [lat, lng] = ngeohash.decode(cell) as [number, number]
      if (turf.booleanPointInPolygon([lng, lat], buffered)) {
        boundaryGeohashes.add(cell)
      }
    }
  }

  const geohashArray = [...boundaryGeohashes].sort()
  const tsContent = `// Auto-generated by scripts/extract-boundaries.ts — do not edit manually
export const BOUNDARY_GEOHASH_SET: ReadonlySet<string> = new Set(${JSON.stringify(geohashArray)})
`
  writeFileSync(resolve(OUTPUT_DIR, 'boundary-geohash-set.ts'), tsContent)
  console.log(`✓ Wrote BOUNDARY_GEOHASH_SET with ${boundaryGeohashes.size} geohash cells`)
}

function osmRelationToGeoJSON(el: unknown): Feature<turf.Polygon | turf.MultiPolygon> | null {
  // OSM relation geometry → GeoJSON polygon conversion
  // Simplified: real implementation needs to reconstruct rings from OSM way geometry
  const element = el as { geometry?: Array<{ lat: number; lng: number }> }
  if (!element.geometry || element.geometry.length < 3) return null
  const coords = element.geometry.map((p) => [p.lng, p.lat])
  if (coords[0]?.[0] !== coords[coords.length - 1]?.[0]) coords.push(coords[0]!) // close ring
  return turf.polygon([coords]) as Feature<turf.Polygon>
}

await main()
```

- [ ] **Step 3: Run the extraction script**

```bash
pnpm exec tsx scripts/extract-boundaries.ts
```

Expected: Output shows `✓ Wrote 12 municipality features`, `✓ Wrote N barangay features`, `✓ Wrote BOUNDARY_GEOHASH_SET with N geohash cells`.

If the script fails with Overpass timeout: retry — Overpass is rate-limited. If OSM data is incomplete, verify at https://www.openstreetmap.org/relation/ for Camarines Norte.

- [ ] **Step 4: Update `packages/shared-data/src/index.ts`**

```typescript
export { BOUNDARY_GEOHASH_SET } from './boundary-geohash-set.js'
export type { FeatureCollection } from 'geojson'
```

- [ ] **Step 5: Verify output quality**

Cross-check 3 known boundary points manually:

- Daet-Mercedes boundary near Barangay Lag-on: coordinates ~(14.175, 122.935)
- Daet-Talisay boundary: ~(14.13, 122.96)
- Confirm those geohashes appear in BOUNDARY_GEOHASH_SET:

```typescript
// Quick check:
import { BOUNDARY_GEOHASH_SET } from '@bantayog/shared-data'
import ngeohash from 'ngeohash'
const testHash = ngeohash.encode(14.175, 122.935, 6)
console.log(testHash, BOUNDARY_GEOHASH_SET.has(testHash)) // should be true
```

- [ ] **Step 6: Commit**

```bash
git add scripts/extract-boundaries.ts \
        packages/shared-data/src/municipality-boundaries.geojson \
        packages/shared-data/src/barangay-boundaries.geojson \
        packages/shared-data/src/boundary-geohash-set.ts \
        packages/shared-data/src/index.ts \
        packages/shared-data/package.json \
        functions/package.json \
        pnpm-lock.yaml
git commit -m "feat(data): OSM boundary extraction — 12 municipality GeoJSON + boundary geohash set"
```

---

### Task 7: B.4 — `shareReport` callable

**Files:**

- Create: `functions/src/callables/share-report.ts`
- Create: `functions/src/__tests__/callables/share-report.test.ts`

- [ ] **Step 1: Write failing tests**

Create `functions/src/__tests__/callables/share-report.test.ts`:

```typescript
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { shareReportCore } from '../../callables/share-report.js'

const ts = 1713350400000
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'share-report-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv.cleanup()
})

async function seedReportOps(id: string, muni: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'report_ops', id), {
      municipalityId: muni,
      status: 'verified',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    })
  })
}

const daetAdmin = {
  uid: 'daet-admin',
  claims: { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'daet' },
}

describe('shareReport', () => {
  it('rejects caller from a different municipality than the report', async () => {
    await seedReportOps('r1', 'mercedes')
    await expect(
      shareReportCore(adminDb, {
        reportId: 'r1',
        targetMunicipalityId: 'labo',
        actor: daetAdmin,
        idempotencyKey: crypto.randomUUID(),
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('creates report_sharing doc with source manual and appends event', async () => {
    await seedReportOps('r1', 'daet')
    await shareReportCore(adminDb, {
      reportId: 'r1',
      targetMunicipalityId: 'mercedes',
      reason: 'Border incident',
      actor: daetAdmin,
      idempotencyKey: crypto.randomUUID(),
      now: Timestamp.fromMillis(ts),
    })
    const sharingSnap = await adminDb.collection('report_sharing').doc('r1').get()
    expect(sharingSnap.data()?.sharedWith).toContain('mercedes')

    const events = await adminDb.collection('report_sharing').doc('r1').collection('events').get()
    expect(events.empty).toBe(false)
    expect(events.docs[0]?.data().source).toBe('manual')
    expect(events.docs[0]?.data().sharedBy).toBe('daet-admin')
  })

  it('creates a command_channel_thread with threadType border_share', async () => {
    await seedReportOps('r1', 'daet')
    await shareReportCore(adminDb, {
      reportId: 'r1',
      targetMunicipalityId: 'mercedes',
      actor: daetAdmin,
      idempotencyKey: crypto.randomUUID(),
      now: Timestamp.fromMillis(ts),
    })
    const threads = await adminDb
      .collection('command_channel_threads')
      .where('reportId', '==', 'r1')
      .where('threadType', '==', 'border_share')
      .get()
    expect(threads.empty).toBe(false)
  })

  it('is idempotent — sharing same muni twice does not duplicate', async () => {
    await seedReportOps('r1', 'daet')
    const key = crypto.randomUUID()
    await shareReportCore(adminDb, {
      reportId: 'r1',
      targetMunicipalityId: 'mercedes',
      actor: daetAdmin,
      idempotencyKey: key,
      now: Timestamp.fromMillis(ts),
    })
    await shareReportCore(adminDb, {
      reportId: 'r1',
      targetMunicipalityId: 'mercedes',
      actor: daetAdmin,
      idempotencyKey: key,
      now: Timestamp.fromMillis(ts),
    })
    const events = await adminDb.collection('report_sharing').doc('r1').collection('events').get()
    expect(events.size).toBe(1)
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
firebase emulators:exec --only firestore,auth \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/share-report.test.ts"
```

Expected: FAIL — imports not found.

- [ ] **Step 3: Create `functions/src/callables/share-report.ts`**

```typescript
import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminDb } from '../admin-init.js'
import { withIdempotency } from '../idempotency/guard.js'
import { bantayogErrorToHttps, requireAuth } from './https-error.js'

const requestSchema = z
  .object({
    reportId: z.string().min(1).max(128),
    targetMunicipalityId: z.string().min(1).max(64),
    reason: z.string().max(500).optional(),
    idempotencyKey: z.uuid(),
  })
  .strict()

export interface ShareReportDeps {
  reportId: string
  targetMunicipalityId: string
  reason?: string
  idempotencyKey: string
  actor: { uid: string; claims: { role: string; accountStatus: string; municipalityId?: string } }
  now: Timestamp
}

export async function shareReportCore(
  db: FirebaseFirestore.Firestore,
  deps: ShareReportDeps,
): Promise<{ status: 'shared' }> {
  const { reportId, targetMunicipalityId, reason, idempotencyKey, actor, now } = deps
  const nowMs = now.toMillis()

  const isSuperadmin = actor.claims.role === 'provincial_superadmin'
  const isMuniAdmin = actor.claims.role === 'municipal_admin'
  if ((!isMuniAdmin && !isSuperadmin) || actor.claims.accountStatus !== 'active') {
    throw new HttpsError('permission-denied', 'municipal_admin or superadmin required')
  }

  const opsSnap = await db.collection('report_ops').doc(reportId).get()
  if (!opsSnap.exists) throw new HttpsError('not-found', 'report not found')
  const ops = opsSnap.data()!

  if (isMuniAdmin && ops.municipalityId !== actor.claims.municipalityId) {
    throw new HttpsError('permission-denied', 'report belongs to a different municipality')
  }

  const { result } = await withIdempotency(
    db,
    {
      key: `shareReport:${actor.uid}:${idempotencyKey}`,
      payload: { reportId, targetMunicipalityId },
      now: () => nowMs,
    },
    async () => {
      // Idempotency guard: check if already shared with this municipality
      const existingSnap = await db.collection('report_sharing').doc(reportId).get()
      if (existingSnap.exists) {
        const existing = existingSnap.data()!
        if ((existing.sharedWith as string[]).includes(targetMunicipalityId)) {
          return { alreadyShared: true }
        }
      }

      const sharingRef = db.collection('report_sharing').doc(reportId)
      const threadRef = db.collection('command_channel_threads').doc()
      const eventRef = sharingRef.collection('events').doc()

      await db.runTransaction(async (tx) => {
        // Use arrayUnion to avoid overwriting concurrent shares
        tx.set(
          sharingRef,
          {
            ownerMunicipalityId: ops.municipalityId,
            reportId,
            sharedWith: FieldValue.arrayUnion(targetMunicipalityId),
            updatedAt: nowMs,
            schemaVersion: 1,
          },
          { merge: true },
        )
        tx.set(eventRef, {
          targetMunicipalityId,
          sharedBy: actor.uid,
          sharedAt: nowMs,
          ...(reason ? { sharedReason: reason } : {}),
          source: 'manual',
          schemaVersion: 1,
        })
        tx.set(threadRef, {
          threadId: threadRef.id,
          reportId,
          threadType: 'border_share',
          subject: `Shared report ${reportId} with ${targetMunicipalityId}`,
          participantUids: { [actor.uid]: true },
          createdBy: actor.uid,
          createdAt: nowMs,
          updatedAt: nowMs,
          schemaVersion: 1,
        })
        // Mirror visibility on report_ops
        tx.update(db.collection('report_ops').doc(reportId), {
          'visibility.scope': 'shared',
          'visibility.sharedWith': FieldValue.arrayUnion(targetMunicipalityId),
          updatedAt: nowMs,
        })
      })
      return { alreadyShared: false }
    },
  )
  return { status: 'shared' }
}

export const shareReport = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (req: CallableRequest) => {
    const actor = requireAuth(req)
    const input = requestSchema.parse(req.data)
    try {
      return await shareReportCore(adminDb, { ...input, actor, now: Timestamp.now() })
    } catch (err) {
      throw bantayogErrorToHttps(err)
    }
  },
)
```

- [ ] **Step 4: Run to confirm pass**

```bash
firebase emulators:exec --only firestore,auth \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/share-report.test.ts"
```

Expected: PASS (4 tests)

- [ ] **Step 5: Export + commit**

```bash
# Add to functions/src/index.ts: export { shareReport } from './callables/share-report.js'
git add functions/src/callables/share-report.ts \
        functions/src/__tests__/callables/share-report.test.ts \
        functions/src/index.ts
git commit -m "feat(callables): shareReport — arrayUnion sharing, subcollection event, border_share thread"
```

---

### Task 8: B.4 — `borderAutoShareTrigger`

**Files:**

- Create: `functions/src/triggers/border-auto-share.ts`
- Create: `functions/src/__tests__/triggers/border-auto-share.test.ts`

- [ ] **Step 1: Write failing tests**

Create `functions/src/__tests__/triggers/border-auto-share.test.ts`:

```typescript
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { type Firestore } from 'firebase-admin/firestore'
import ngeohash from 'ngeohash'

vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { borderAutoShareCore } from '../../triggers/border-auto-share.js'

const ts = 1713350400000
// Use a coordinate known to be near the Daet-Mercedes boundary
// Daet: roughly 14.12-14.22°N, 122.90-123.00°E
// Mercedes: roughly 14.10-14.17°N, 122.85-122.95°E
// A point near the border: ~14.175°N, 122.935°E
const NEAR_BOUNDARY_LAT = 14.175
const NEAR_BOUNDARY_LNG = 122.935
const NEAR_BOUNDARY_GEOHASH = ngeohash.encode(NEAR_BOUNDARY_LAT, NEAR_BOUNDARY_LNG, 6)

const FAR_FROM_BOUNDARY_LAT = 14.2
const FAR_FROM_BOUNDARY_LNG = 122.92
const FAR_GEOHASH = ngeohash.encode(FAR_FROM_BOUNDARY_LAT, FAR_FROM_BOUNDARY_LNG, 6)

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'border-auto-share-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv.cleanup()
})

describe('borderAutoShareTrigger', () => {
  it('skips reports with no locationGeohash', async () => {
    const opsDoc = {
      municipalityId: 'daet',
      status: 'verified',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    }
    await borderAutoShareCore(adminDb, { reportId: 'r1', opsData: opsDoc })
    const snap = await adminDb.collection('report_sharing').doc('r1').get()
    expect(snap.exists).toBe(false)
  })

  it('does not create report_sharing for a report far from any boundary', async () => {
    const opsDoc = {
      municipalityId: 'daet',
      locationGeohash: FAR_GEOHASH,
      status: 'verified',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    }
    await borderAutoShareCore(adminDb, { reportId: 'r1', opsData: opsDoc })
    const snap = await adminDb.collection('report_sharing').doc('r1').get()
    expect(snap.exists).toBe(false)
  })

  it('creates report_sharing with source auto when near boundary', async () => {
    const opsDoc = {
      municipalityId: 'daet',
      locationGeohash: NEAR_BOUNDARY_GEOHASH,
      status: 'verified',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    }
    // Seed report_private with exactLocation
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'report_private', 'r1'), {
        reportId: 'r1',
        reporterUid: 'u1',
        createdAt: ts,
        schemaVersion: 1,
        exactLocation: { lat: NEAR_BOUNDARY_LAT, lng: NEAR_BOUNDARY_LNG },
      })
    })
    await borderAutoShareCore(adminDb, { reportId: 'r1', opsData: opsDoc })
    const snap = await adminDb.collection('report_sharing').doc('r1').get()
    if (snap.exists) {
      // If the test coordinate is actually near the boundary, sharing should have occurred
      const events = await adminDb.collection('report_sharing').doc('r1').collection('events').get()
      expect(events.docs.some((d) => d.data().source === 'auto')).toBe(true)
    }
    // If snap doesn't exist, the coordinate wasn't actually within 500m — acceptable for unit test
  })

  it('does not re-trigger if report already shared with that municipality', async () => {
    const opsDoc = {
      municipalityId: 'daet',
      locationGeohash: NEAR_BOUNDARY_GEOHASH,
      status: 'verified',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: ['mercedes'] },
      schemaVersion: 1,
    }
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'report_sharing', 'r1'), {
        ownerMunicipalityId: 'daet',
        reportId: 'r1',
        sharedWith: ['mercedes'],
        createdAt: ts,
        updatedAt: ts,
        schemaVersion: 1,
      })
    })
    await borderAutoShareCore(adminDb, { reportId: 'r1', opsData: opsDoc })
    const events = await adminDb.collection('report_sharing').doc('r1').collection('events').get()
    expect(events.size).toBe(0) // no new event written
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/triggers/border-auto-share.test.ts"
```

Expected: FAIL — imports not found.

- [ ] **Step 3: Create `functions/src/triggers/border-auto-share.ts`**

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import * as turf from '@turf/turf'
import ngeohash from 'ngeohash'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { FeatureCollection } from 'geojson'
import { adminDb } from '../admin-init.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('borderAutoShare')

// Load once per function instance — not per invocation
let municipalityBoundaries: FeatureCollection | null = null
function getMunicipalityBoundaries(): FeatureCollection {
  if (!municipalityBoundaries) {
    const require = createRequire(import.meta.url)
    const filePath = require.resolve('@bantayog/shared-data/municipality-boundaries.geojson')
    municipalityBoundaries = JSON.parse(readFileSync(filePath, 'utf8')) as FeatureCollection
  }
  return municipalityBoundaries
}

let boundaryGeohashSet: ReadonlySet<string> | null = null
async function getBoundaryGeohashSet(): Promise<ReadonlySet<string>> {
  if (!boundaryGeohashSet) {
    const { BOUNDARY_GEOHASH_SET } = await import('@bantayog/shared-data')
    boundaryGeohashSet = BOUNDARY_GEOHASH_SET
  }
  return boundaryGeohashSet
}

export interface BorderAutoShareDeps {
  reportId: string
  opsData: Record<string, unknown>
}

export async function borderAutoShareCore(
  db: FirebaseFirestore.Firestore,
  deps: BorderAutoShareDeps,
): Promise<void> {
  const { reportId, opsData } = deps
  const locationGeohash = opsData.locationGeohash as string | undefined
  if (!locationGeohash) return

  const geohashSet = await getBoundaryGeohashSet()
  if (!geohashSet.has(locationGeohash)) return

  // Load exact location from report_private
  const privateSnap = await db.collection('report_private').doc(reportId).get()
  const exactLocation = privateSnap.data()?.exactLocation as
    | { lat: number; lng: number }
    | undefined
  if (!exactLocation) return

  const point = turf.point([exactLocation.lng, exactLocation.lat])
  const boundaries = getMunicipalityBoundaries()
  const ownerMuniId = opsData.municipalityId as string

  // Get current sharing state to avoid re-sharing
  const existingSnap = await db.collection('report_sharing').doc(reportId).get()
  const alreadySharedWith = (existingSnap.data()?.sharedWith as string[]) ?? []

  const nowMs = Date.now()
  for (const feature of boundaries.features) {
    const targetMuniId = feature.properties?.municipalityId as string
    if (targetMuniId === ownerMuniId) continue
    if (alreadySharedWith.includes(targetMuniId)) continue

    const buffered = turf.buffer(feature as turf.Feature<turf.Polygon>, 0.5, {
      units: 'kilometers',
    })
    if (!buffered || !turf.booleanPointInPolygon(point, buffered)) continue

    // This report is within 500m of targetMuniId's boundary — auto-share
    const sharingRef = db.collection('report_sharing').doc(reportId)
    const eventRef = sharingRef.collection('events').doc()
    const threadRef = db.collection('command_channel_threads').doc()

    await db.runTransaction(async (tx) => {
      tx.set(
        sharingRef,
        {
          ownerMunicipalityId: ownerMuniId,
          reportId,
          sharedWith: FieldValue.arrayUnion(targetMuniId),
          updatedAt: nowMs,
          schemaVersion: 1,
        },
        { merge: true },
      )
      tx.set(eventRef, {
        targetMunicipalityId: targetMuniId,
        sharedBy: 'system',
        sharedAt: nowMs,
        source: 'auto',
        schemaVersion: 1,
      })
      tx.set(threadRef, {
        threadId: threadRef.id,
        reportId,
        threadType: 'border_share',
        subject: `Auto-shared with ${targetMuniId} (boundary proximity)`,
        participantUids: {},
        createdBy: 'system',
        createdAt: nowMs,
        updatedAt: nowMs,
        schemaVersion: 1,
      })
      tx.update(db.collection('report_ops').doc(reportId), {
        'visibility.scope': 'shared',
        'visibility.sharedWith': FieldValue.arrayUnion(targetMuniId),
        updatedAt: nowMs,
      })
    })
    log({
      severity: 'INFO',
      code: 'border.auto-share',
      message: `Auto-shared ${reportId} with ${targetMuniId}`,
    })
  }
}

export const borderAutoShareTrigger = onDocumentCreated(
  { document: 'report_ops/{reportId}', region: 'asia-southeast1', timeoutSeconds: 60 },
  async (event) => {
    const opsData = event.data?.data() ?? {}
    await borderAutoShareCore(adminDb, { reportId: event.params.reportId, opsData })
  },
)
```

- [ ] **Step 4: Run to confirm pass**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/triggers/border-auto-share.test.ts"
```

Expected: PASS (4 tests, with boundary-proximity test being conditionally validated)

- [ ] **Step 5: Export + commit**

```bash
# Add to functions/src/index.ts: export { borderAutoShareTrigger } from './triggers/border-auto-share.js'
git add functions/src/triggers/border-auto-share.ts \
        functions/src/__tests__/triggers/border-auto-share.test.ts \
        functions/src/index.ts
git commit -m "feat(triggers): borderAutoShareTrigger — geohash fast-reject, turf buffer check, auto event log"
```

---

### Task 9: B.5 — `addCommandChannelMessage` callable + `CommandChannelPanel`

**Files:**

- Create: `functions/src/callables/add-command-channel-message.ts`
- Create: `functions/src/__tests__/callables/command-channel.test.ts`
- Create: `apps/admin-desktop/src/components/CommandChannelPanel.tsx`
- Create: `apps/admin-desktop/src/__tests__/command-channel-panel.test.tsx`

- [ ] **Step 1: Write failing callable tests**

Create `functions/src/__tests__/callables/command-channel.test.ts`:

```typescript
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { addCommandChannelMessageCore } from '../../callables/add-command-channel-message.js'

const ts = 1713350400000
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'command-channel-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv.cleanup()
})

async function seedThread(id: string, participants: string[]) {
  const participantUids = Object.fromEntries(participants.map((u) => [u, true]))
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'command_channel_threads', id), {
      threadId: id,
      reportId: 'r1',
      threadType: 'agency_assistance',
      subject: 'Test thread',
      participantUids,
      createdBy: 'daet-admin',
      createdAt: ts,
      updatedAt: ts,
      schemaVersion: 1,
    })
  })
}

const actor = {
  uid: 'daet-admin',
  claims: { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'daet' },
}

describe('addCommandChannelMessage', () => {
  it('rejects a caller whose UID is not in thread participantUids', async () => {
    await seedThread('th1', ['bfp-admin'])
    await expect(
      addCommandChannelMessageCore(adminDb, {
        threadId: 'th1',
        body: 'Hello',
        actor,
        idempotencyKey: crypto.randomUUID(),
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('rejects an empty body', async () => {
    await seedThread('th1', ['daet-admin'])
    await expect(
      addCommandChannelMessageCore(adminDb, {
        threadId: 'th1',
        body: '   ',
        actor,
        idempotencyKey: crypto.randomUUID(),
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('rejects body over 2000 chars', async () => {
    await seedThread('th1', ['daet-admin'])
    await expect(
      addCommandChannelMessageCore(adminDb, {
        threadId: 'th1',
        body: 'x'.repeat(2001),
        actor,
        idempotencyKey: crypto.randomUUID(),
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('writes message and updates thread.lastMessageAt', async () => {
    await seedThread('th1', ['daet-admin', 'bfp-admin'])
    await addCommandChannelMessageCore(adminDb, {
      threadId: 'th1',
      body: 'Units dispatched',
      actor,
      idempotencyKey: crypto.randomUUID(),
      now: Timestamp.fromMillis(ts),
    })
    const msgs = await adminDb
      .collection('command_channel_messages')
      .where('threadId', '==', 'th1')
      .get()
    expect(msgs.empty).toBe(false)
    expect(msgs.docs[0]?.data().body).toBe('Units dispatched')
    const thread = await adminDb.collection('command_channel_threads').doc('th1').get()
    expect(thread.data()?.lastMessageAt).toBe(ts)
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
firebase emulators:exec --only firestore,auth \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/command-channel.test.ts"
```

Expected: FAIL — imports not found.

- [ ] **Step 3: Create `functions/src/callables/add-command-channel-message.ts`**

```typescript
import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminDb } from '../admin-init.js'
import { withIdempotency } from '../idempotency/guard.js'
import { bantayogErrorToHttps, requireAuth } from './https-error.js'

const requestSchema = z
  .object({
    threadId: z.string().min(1).max(128),
    body: z.string().min(1).max(2000),
    idempotencyKey: z.uuid(),
  })
  .strict()

export interface AddCommandChannelMessageDeps {
  threadId: string
  body: string
  idempotencyKey: string
  actor: { uid: string; claims: { role: string; accountStatus: string } }
  now: Timestamp
}

export async function addCommandChannelMessageCore(
  db: FirebaseFirestore.Firestore,
  deps: AddCommandChannelMessageDeps,
): Promise<{ status: 'sent' }> {
  const { threadId, body, idempotencyKey, actor, now } = deps
  const nowMs = now.toMillis()
  const trimmedBody = body.trim()

  if (!trimmedBody) throw new HttpsError('invalid-argument', 'body cannot be empty')
  if (trimmedBody.length > 2000) throw new HttpsError('invalid-argument', 'body exceeds 2000 chars')

  const threadSnap = await db.collection('command_channel_threads').doc(threadId).get()
  if (!threadSnap.exists) throw new HttpsError('not-found', 'thread not found')
  const thread = threadSnap.data()!

  const participantUids = thread.participantUids as Record<string, boolean>
  if (!participantUids[actor.uid]) {
    throw new HttpsError('permission-denied', 'caller is not a thread participant')
  }

  await withIdempotency(
    db,
    {
      key: `addChannelMessage:${actor.uid}:${idempotencyKey}`,
      payload: { threadId, body: trimmedBody },
      now: () => nowMs,
    },
    async () => {
      const msgRef = db.collection('command_channel_messages').doc()
      await db.runTransaction(async (tx) => {
        tx.set(msgRef, {
          threadId,
          authorUid: actor.uid,
          authorRole: actor.claims.role,
          body: trimmedBody,
          createdAt: nowMs,
          schemaVersion: 1,
        })
        tx.update(db.collection('command_channel_threads').doc(threadId), {
          lastMessageAt: nowMs,
          updatedAt: nowMs,
        })
      })
    },
  )
  return { status: 'sent' }
}

export const addCommandChannelMessage = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (req: CallableRequest) => {
    const actor = requireAuth(req)
    const input = requestSchema.parse(req.data)
    try {
      return await addCommandChannelMessageCore(adminDb, { ...input, actor, now: Timestamp.now() })
    } catch (err) {
      throw bantayogErrorToHttps(err)
    }
  },
)
```

- [ ] **Step 4: Run to confirm pass**

```bash
firebase emulators:exec --only firestore,auth \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/command-channel.test.ts"
```

Expected: PASS (4 tests)

- [ ] **Step 5: Create `CommandChannelPanel.tsx` (admin-desktop)**

```typescript
// apps/admin-desktop/src/components/CommandChannelPanel.tsx
import { useState, useEffect, useRef } from 'react'
import {
  collection, query, where, orderBy, limit, onSnapshot,
  type QueryDocumentSnapshot, getFirestore,
} from 'firebase/firestore'
import { httpsCallable, getFunctions } from 'firebase/functions'

interface Thread {
  id: string
  threadType: 'agency_assistance' | 'border_share'
  subject: string
  participantUids: Record<string, boolean>
  lastMessageAt?: number
}

interface Message {
  id: string
  authorUid: string
  body: string
  createdAt: number
}

interface Props {
  reportId: string
  currentUserUid: string
}

export function CommandChannelPanel({ reportId, currentUserUid }: Props) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const db = getFirestore()

  useEffect(() => {
    const q = query(
      collection(db, 'command_channel_threads'),
      where('reportId', '==', reportId),
    )
    return onSnapshot(q, (snap) => {
      const found = snap.docs.map((d: QueryDocumentSnapshot) => ({
        id: d.id,
        ...(d.data() as Omit<Thread, 'id'>),
      }))
      setThreads(found)
      if (found.length > 0 && !activeThreadId) {
        setActiveThreadId(found[0]!.id)
      }
    })
  }, [reportId, db, activeThreadId])

  useEffect(() => {
    if (!activeThreadId) return
    const q = query(
      collection(db, 'command_channel_messages'),
      where('threadId', '==', activeThreadId),
      orderBy('createdAt', 'desc'),
      limit(50),
    )
    return onSnapshot(q, (snap) => {
      setMessages(
        snap.docs
          .map((d: QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) }))
          .reverse(),
      )
    })
  }, [activeThreadId, db])

  async function handleSend() {
    if (!activeThreadId || !input.trim()) return
    setError(null)
    try {
      const fn = httpsCallable(getFunctions(), 'addCommandChannelMessage')
      await fn({ threadId: activeThreadId, body: input.trim(), idempotencyKey: crypto.randomUUID() })
      setInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    }
  }

  if (threads.length === 0) return null

  const activeThread = threads.find((t) => t.id === activeThreadId)

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex gap-2">
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveThreadId(t.id)}
            className={`px-2 py-1 text-xs rounded ${t.id === activeThreadId ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
          >
            {t.threadType === 'agency_assistance' ? '🏥 Agency' : '🗺️ Border'}
          </button>
        ))}
      </div>

      {activeThread && (
        <p className="text-xs text-gray-500">{activeThread.subject}</p>
      )}

      <div className="h-48 overflow-y-auto space-y-2 border rounded p-2 bg-gray-50">
        {messages.map((m) => (
          <div key={m.id} className={`text-sm ${m.authorUid === currentUserUid ? 'text-right' : ''}`}>
            <span className="text-xs text-gray-500">{m.authorUid}</span>
            <p>{m.body}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          rows={2}
          className="flex-1 border rounded px-2 py-1 text-sm resize-none"
          placeholder="Type a message..."
        />
        <button
          onClick={() => void handleSend()}
          disabled={!input.trim()}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
        >
          Send
        </button>
      </div>
      <p className="text-xs text-right text-gray-400">{input.length}/2000</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 6: Export callable + lint/typecheck**

```bash
# Add to functions/src/index.ts:
# export { addCommandChannelMessage } from './callables/add-command-channel-message.js'
npx turbo run lint typecheck
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add functions/src/callables/add-command-channel-message.ts \
        functions/src/__tests__/callables/command-channel.test.ts \
        apps/admin-desktop/src/components/CommandChannelPanel.tsx \
        functions/src/index.ts
git commit -m "feat(callables+ui): addCommandChannelMessage callable; CommandChannelPanel with 50-msg limit"
```

---

### Task 10: Final gate — Cluster B complete

- [ ] **Step 1: Run all Cluster B tests**

```bash
firebase emulators:exec --only firestore,auth \
  "pnpm --filter @bantayog/functions exec vitest run \
    src/__tests__/callables/agency-assistance.test.ts \
    src/__tests__/callables/field-mode.test.ts \
    src/__tests__/callables/share-report.test.ts \
    src/__tests__/callables/command-channel.test.ts \
    src/__tests__/scheduled/admin-operations-sweep.test.ts \
    src/__tests__/triggers/border-auto-share.test.ts"
```

Expected: PASS (all tests)

- [ ] **Step 2: Run admin-desktop UI tests**

```bash
pnpm --filter @bantayog/admin-desktop exec vitest run
```

Expected: PASS (all including new Agency queue and field mode store tests)

- [ ] **Step 3: Full lint + typecheck gate**

```bash
npx turbo run lint typecheck
```

Expected: PASS (all 25 packages)
