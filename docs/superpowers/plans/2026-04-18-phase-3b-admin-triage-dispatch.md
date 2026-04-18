# Phase 3b Implementation Plan: Admin Triage + Dispatch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the second sub-phase of Phase 3 — a municipal admin signs in to the Admin Desktop, sees a muni-scoped list of reports materialized by 3a, advances them through `verify → dispatch`, and a responder can see the resulting dispatch through `onSnapshot` in the Responder PWA (no FCM yet).

**Architecture:** Four callables (`verifyReport`, `rejectReport`, `dispatchResponder`, `cancelDispatch`) built on the Phase 2 `withIdempotency` helper and the 3a transition-table codegen. Eligibility resolution for `dispatchResponder` reads the `responders` collection filtered by municipality and shift flag from RTDB. The Admin Desktop ships as a minimal React + Vite app wired to Firestore `onSnapshot` for the muni-scoped queue; all state-changing actions go through callables, never direct writes. The Responder PWA gains a bare own-dispatches list page — no Accept button wiring yet (that lands in 3c), just read-only visibility to prove the onSnapshot path.

**Tech Stack:** TypeScript strict, Zod, Firebase Functions v2 (Node 20), Firebase Admin SDK, React + Vite, `@firebase/rules-unit-testing`, Vitest, Terraform for monitoring alerts.

**Phase 3 design spec:** `docs/superpowers/specs/2026-04-18-phase-3-design.md`

**Exit milestone:** `scripts/phase-3b/acceptance.ts` passes in staging. Admin can verify and dispatch a real report; dispatch is persisted correctly; cross-muni negative paths are rejected with `PERMISSION_DENIED`; responder sees the dispatch via `onSnapshot`.

---

## Preconditions

- Phase 3a complete — `scripts/phase-3a/acceptance.ts` green in staging; triptych materialization exercised end-to-end; transition-table codegen and rules-drift CI gate active.
- A fresh responder exists in staging: `responders/{uid}` with `agencyId: 'bfp-daet'`, `municipalityId: 'daet'`, `isActive: true`, `fcmTokens: []`, plus custom claim `{ role: 'responder', municipalityId: 'daet', agencyId: 'bfp-daet' }`. Shift flag `/responder_index/daet/{uid}: { isOnShift: true }` set in RTDB. (One-time manual seed, captured in the 3b bootstrap script in Task 21.)
- Test muni admin exists: `users/{uid}` with role `municipal_admin`, municipality `daet`, active status true. Custom claims set via the Phase 1 `grantMunicipalAdminClaim` callable.
- Branch `feature/phase-3b-admin-triage-dispatch` cut from `main` after 3a merge.

---

## File Structure (3b)

### New files

```
functions/src/
  callables/
    verify-report.ts              # verifyReport callable (two-step branch)
    reject-report.ts              # rejectReport callable
    dispatch-responder.ts         # dispatchResponder callable + eligibility query
    cancel-dispatch.ts            # cancelDispatch callable (pending-only in 3b)
  services/
    responder-eligibility.ts      # Query responders + RTDB shift flag
    rate-limit.ts                 # Shared rate-limit helper reading rate_limits/{key}
  __tests__/
    callables/
      verify-report.test.ts
      reject-report.test.ts
      dispatch-responder.test.ts
      cancel-dispatch.test.ts
    services/
      responder-eligibility.test.ts
      rate-limit.test.ts
    rules/
      admin-onsnapshot.rules.test.ts  # Admin read gates for 3b queue

apps/admin-desktop/src/
  app/
    firebase.ts                   # Firebase client init + App Check
    auth-provider.tsx             # Custom-claim-aware auth context
    protected-route.tsx           # Role + active + municipality gate
  pages/
    LoginPage.tsx
    TriageQueuePage.tsx           # onSnapshot queue + side panel container
    ReportDetailPanel.tsx         # Triptych-scoped detail view
    DispatchModal.tsx             # Responder picker + confirm
  hooks/
    useMuniReports.ts             # onSnapshot queue hook
    useReportDetail.ts            # One report's triptych reads (reports + report_ops)
    useEligibleResponders.ts      # onSnapshot responders-on-shift for muni
  services/
    callables.ts                  # Typed wrappers around httpsCallable
  routes.tsx

apps/responder-app/src/
  app/
    firebase.ts                   # Firebase client init + App Check
    auth-provider.tsx
  pages/
    LoginPage.tsx
    DispatchListPage.tsx          # Own-dispatches onSnapshot (read-only in 3b)
  hooks/
    useOwnDispatches.ts
  routes.tsx

scripts/
  phase-3b/
    acceptance.ts                 # Phase-exit gate
    bootstrap-test-responder.ts   # One-time staging seed for the 3b/3c test responder

docs/runbooks/
  phase-3b-verify-and-dispatch.md # Operator runbook for the two admin actions
```

### Modified files

```
packages/shared-validators/src/
  dispatches.ts                   # Extend DispatchDoc if eligible-responder projection differs
  errors.ts                       # Add domain codes (if any new ones are needed)

functions/src/
  index.ts                        # Register 4 new callables

infra/firebase/
  firestore.rules.template        # Tighten admin-onSnapshot reads if needed (expected none — Phase 2 covers)
  firestore.indexes.json          # Verify dispatches index exists; add if missing

infra/terraform/modules/monitoring/phase-3/
  main.tf                         # Add dispatch.created log metric + dashboard panel

apps/admin-desktop/src/App.tsx    # Route shell only
apps/responder-app/src/App.tsx    # Route shell only

scripts/check-rule-coverage.ts    # Add dispatch collection coverage explicitly

docs/progress.md                  # Phase 3b verification section
```

### Deleted files

None.

---

## Group A — Shared Services (Tasks 1-3)

Foundations that every callable depends on. Ship first; every other task in this plan imports from here.

---

### Task 1: Implement shared `rate-limit` helper reading `rate_limits/{key}`

**Files:**

- Create: `functions/src/services/rate-limit.ts`
- Create: `functions/src/__tests__/services/rate-limit.test.ts`

The Phase 1 `rate_limits/{key}` collection exists but Phase 2 did not ship a shared consumer. 3b needs one for every admin callable.

- [ ] **Step 1: Write the failing test**

```typescript
// functions/src/__tests__/services/rate-limit.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp } from 'firebase-admin/firestore'
import { checkRateLimit } from '../../services/rate-limit'

let testEnv: RulesTestEnvironment

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'rate-limit-test',
    firestore: { host: 'localhost', port: 8080 },
  })
  await testEnv.clearFirestore()
})

describe('checkRateLimit', () => {
  it('allows the first call under the limit', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    const result = await checkRateLimit(db as any, {
      key: 'verifyReport:uid-1',
      limit: 60,
      windowSeconds: 60,
      now: Timestamp.now(),
    })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(59)
  })

  it('denies calls past the limit and returns retryAfterSeconds', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    const now = Timestamp.now()
    for (let i = 0; i < 60; i++) {
      await checkRateLimit(db as any, {
        key: 'verifyReport:uid-1',
        limit: 60,
        windowSeconds: 60,
        now,
      })
    }
    const denied = await checkRateLimit(db as any, {
      key: 'verifyReport:uid-1',
      limit: 60,
      windowSeconds: 60,
      now,
    })
    expect(denied.allowed).toBe(false)
    expect(denied.retryAfterSeconds).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- services/rate-limit" 2>&1 | tee /tmp/rate-limit-fail.log
```

Expected: FAIL with "Cannot find module '../../services/rate-limit'".

- [ ] **Step 3: Implement the helper**

```typescript
// functions/src/services/rate-limit.ts
import type { Firestore, Timestamp } from 'firebase-admin/firestore'
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore'

export interface RateLimitCheck {
  key: string
  limit: number
  windowSeconds: number
  now: Timestamp
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export async function checkRateLimit(
  db: Firestore,
  { key, limit, windowSeconds, now }: RateLimitCheck,
): Promise<RateLimitResult> {
  const ref = db.collection('rate_limits').doc(key)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const windowStartMs = now.toMillis() - windowSeconds * 1000
    const bucket = snap.exists ? snap.data() : undefined
    const existingTimes: number[] = Array.isArray(bucket?.timestamps) ? bucket.timestamps : []
    const fresh = existingTimes.filter((ms) => ms >= windowStartMs)

    if (fresh.length >= limit) {
      const earliest = Math.min(...fresh)
      const retryAfterSeconds = Math.ceil((earliest + windowSeconds * 1000 - now.toMillis()) / 1000)
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(retryAfterSeconds, 1) }
    }

    fresh.push(now.toMillis())
    tx.set(ref, { timestamps: fresh, updatedAt: AdminTimestamp.now() }, { merge: true })
    return { allowed: true, remaining: limit - fresh.length, retryAfterSeconds: 0 }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- services/rate-limit"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/services/rate-limit.ts functions/src/__tests__/services/rate-limit.test.ts
git commit -m "feat(functions): add shared rate-limit helper reading rate_limits/{key}"
```

---

### Task 2: Implement responder-eligibility query

**Files:**

- Create: `functions/src/services/responder-eligibility.ts`
- Create: `functions/src/__tests__/services/responder-eligibility.test.ts`

`dispatchResponder` filters responders by municipality, `isActive: true`, matching agency, and RTDB `isOnShift: true`. Phase 3 fidelity (per spec §5.6 step 2) is name + agency only — no map pin, no distance.

- [ ] **Step 1: Write the failing test**

```typescript
// functions/src/__tests__/services/responder-eligibility.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { getEligibleResponders } from '../../services/responder-eligibility'
import { seedResponder, seedResponderShift } from '../helpers/seed-factories'

let testEnv: RulesTestEnvironment

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'eligibility-test',
    firestore: { host: 'localhost', port: 8080 },
    database: { host: 'localhost', port: 9000 },
  })
  await testEnv.clearFirestore()
  await testEnv.clearDatabase()
})

describe('getEligibleResponders', () => {
  it('returns only active responders in the target municipality who are on shift', async () => {
    const ctx = testEnv.unauthenticatedContext()
    const db = ctx.firestore() as any
    const rtdb = ctx.database() as any

    await seedResponder(db, {
      uid: 'r1',
      municipalityId: 'daet',
      agencyId: 'bfp-daet',
      isActive: true,
    })
    await seedResponder(db, {
      uid: 'r2',
      municipalityId: 'daet',
      agencyId: 'bfp-daet',
      isActive: true,
    })
    await seedResponder(db, {
      uid: 'r3',
      municipalityId: 'daet',
      agencyId: 'bfp-daet',
      isActive: false,
    })
    await seedResponder(db, {
      uid: 'r4',
      municipalityId: 'mercedes',
      agencyId: 'bfp-mercedes',
      isActive: true,
    })

    await seedResponderShift(rtdb, 'daet', 'r1', true)
    await seedResponderShift(rtdb, 'daet', 'r2', false)
    await seedResponderShift(rtdb, 'mercedes', 'r4', true)

    const result = await getEligibleResponders(db, rtdb, { municipalityId: 'daet' })
    expect(result.map((r) => r.uid).sort()).toEqual(['r1'])
  })

  it('filters by agency when provided', async () => {
    const ctx = testEnv.unauthenticatedContext()
    const db = ctx.firestore() as any
    const rtdb = ctx.database() as any
    await seedResponder(db, {
      uid: 'bfp1',
      municipalityId: 'daet',
      agencyId: 'bfp-daet',
      isActive: true,
    })
    await seedResponder(db, {
      uid: 'mdrrmo1',
      municipalityId: 'daet',
      agencyId: 'mdrrmo-daet',
      isActive: true,
    })
    await seedResponderShift(rtdb, 'daet', 'bfp1', true)
    await seedResponderShift(rtdb, 'daet', 'mdrrmo1', true)
    const result = await getEligibleResponders(db, rtdb, {
      municipalityId: 'daet',
      agencyId: 'bfp-daet',
    })
    expect(result.map((r) => r.uid)).toEqual(['bfp1'])
  })
})
```

Add the seeding factories used above. Append to `functions/src/__tests__/helpers/seed-factories.ts`:

```typescript
export async function seedResponder(
  db: FirebaseFirestore.Firestore,
  o: {
    uid: string
    municipalityId: string
    agencyId: string
    isActive: boolean
    displayName?: string
  },
) {
  await db
    .collection('responders')
    .doc(o.uid)
    .set({
      uid: o.uid,
      municipalityId: o.municipalityId,
      agencyId: o.agencyId,
      displayName: o.displayName ?? `Responder ${o.uid}`,
      isActive: o.isActive,
      fcmTokens: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      schemaVersion: 1,
    })
}

export async function seedResponderShift(
  rtdb: firebase.database.Database,
  municipalityId: string,
  uid: string,
  isOnShift: boolean,
) {
  await rtdb
    .ref(`/responder_index/${municipalityId}/${uid}`)
    .set({ isOnShift, updatedAt: Date.now() })
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
firebase emulators:exec --only firestore,database "pnpm --filter @bantayog/functions test -- services/responder-eligibility"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

```typescript
// functions/src/services/responder-eligibility.ts
import type { Firestore } from 'firebase-admin/firestore'
import type { Database } from 'firebase-admin/database'

export interface EligibleResponder {
  uid: string
  displayName: string
  agencyId: string
}

export async function getEligibleResponders(
  db: Firestore,
  rtdb: Database,
  filter: { municipalityId: string; agencyId?: string },
): Promise<EligibleResponder[]> {
  let q = db
    .collection('responders')
    .where('municipalityId', '==', filter.municipalityId)
    .where('isActive', '==', true)
  if (filter.agencyId) {
    q = q.where('agencyId', '==', filter.agencyId)
  }

  const [respondersSnap, shiftSnap] = await Promise.all([
    q.get(),
    rtdb.ref(`/responder_index/${filter.municipalityId}`).get(),
  ])

  const shift = (shiftSnap.val() ?? {}) as Record<string, { isOnShift?: boolean }>

  return respondersSnap.docs
    .filter((doc) => shift[doc.id]?.isOnShift === true)
    .map((doc) => {
      const data = doc.data()
      return {
        uid: doc.id,
        displayName: String(data.displayName ?? ''),
        agencyId: String(data.agencyId ?? ''),
      }
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
firebase emulators:exec --only firestore,database "pnpm --filter @bantayog/functions test -- services/responder-eligibility"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/services/responder-eligibility.ts \
        functions/src/__tests__/services/responder-eligibility.test.ts \
        functions/src/__tests__/helpers/seed-factories.ts
git commit -m "feat(functions): add responder-eligibility query for dispatchResponder"
```

---

### Task 3: Extend `seedReport` factory with helpers for 3b lifecycle states

**Files:**

- Modify: `functions/src/__tests__/helpers/seed-factories.ts`

Add helpers that skip the inbox and seed reports at mid-lifecycle states. Phase 3b tests need reports in `new`, `awaiting_verify`, and `verified` states without running `processInboxItem` each time.

- [ ] **Step 1: Append factories**

```typescript
import { ReportStatus } from '@bantayog/shared-validators'

export interface SeedVerifiedReportOptions {
  reportId?: string
  municipalityId?: string
  municipalityLabel?: string
  reporterUid?: string
  severity?: 'low' | 'medium' | 'high'
  status?: ReportStatus
}

export async function seedReportAtStatus(
  db: FirebaseFirestore.Firestore,
  status: ReportStatus,
  o: SeedVerifiedReportOptions = {},
): Promise<{ reportId: string }> {
  const reportId = o.reportId ?? db.collection('reports').doc().id
  const municipalityId = o.municipalityId ?? 'daet'
  const municipalityLabel = o.municipalityLabel ?? 'Daet'
  const now = Timestamp.now()
  const correlationId = crypto.randomUUID()

  await db
    .collection('reports')
    .doc(reportId)
    .set({
      reportId,
      status,
      municipalityId,
      municipalityLabel,
      source: 'citizen_pwa',
      severityDerived: o.severity ?? 'medium',
      correlationId,
      createdAt: now,
      lastStatusAt: now,
      lastStatusBy: 'system:seed',
      schemaVersion: 1,
    })

  await db
    .collection('report_private')
    .doc(reportId)
    .set({
      reportId,
      reporterUid: o.reporterUid ?? 'reporter-1',
      rawDescription: 'Seed description',
      coordinatesPrecise: { lat: 14.1134, lng: 122.9554 },
      schemaVersion: 1,
    })

  await db.collection('report_ops').doc(reportId).set({
    reportId,
    verifyQueuePriority: 0,
    assignedMunicipalityAdmins: [],
    schemaVersion: 1,
  })

  return { reportId }
}

export async function seedDispatch(
  db: FirebaseFirestore.Firestore,
  o: {
    dispatchId?: string
    reportId: string
    responderUid: string
    agencyId?: string
    municipalityId?: string
    status?: 'pending' | 'accepted' | 'acknowledged' | 'in_progress'
  },
): Promise<{ dispatchId: string }> {
  const dispatchId = o.dispatchId ?? db.collection('dispatches').doc().id
  const now = Timestamp.now()
  await db
    .collection('dispatches')
    .doc(dispatchId)
    .set({
      dispatchId,
      reportId: o.reportId,
      status: o.status ?? 'pending',
      assignedTo: {
        uid: o.responderUid,
        agencyId: o.agencyId ?? 'bfp-daet',
        municipalityId: o.municipalityId ?? 'daet',
      },
      dispatchedAt: now,
      lastStatusAt: now,
      acknowledgementDeadlineAt: Timestamp.fromMillis(now.toMillis() + 15 * 60 * 1000),
      correlationId: crypto.randomUUID(),
      schemaVersion: 1,
    })
  return { dispatchId }
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @bantayog/functions typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add functions/src/__tests__/helpers/seed-factories.ts
git commit -m "test(functions): add seedReportAtStatus and seedDispatch factories"
```

---

## Group B — `verifyReport` Callable (Tasks 4-6)

The first callable. Two-branch behavior inside one transaction: `new → awaiting_verify`, then `awaiting_verify → verified`. Single entry point so the Phase 5 surge-mode UI can split the button without callable changes.

---

### Task 4: Write `verifyReport` happy-path integration test

**Files:**

- Create: `functions/src/__tests__/callables/verify-report.test.ts`

- [ ] **Step 1: Write the failing test (happy path only — error paths land in Task 6)**

```typescript
// functions/src/__tests__/callables/verify-report.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { verifyReportCore } from '../../callables/verify-report'
import { seedReportAtStatus, seedActiveAccount, staffClaims } from '../helpers/seed-factories'
import { Timestamp } from 'firebase-admin/firestore'

let testEnv: RulesTestEnvironment

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'verify-report-test',
    firestore: { host: 'localhost', port: 8080 },
  })
  await testEnv.clearFirestore()
})

describe('verifyReportCore', () => {
  it('advances new → awaiting_verify and writes report_event', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })

    const result = await verifyReportCore(db, {
      reportId,
      idempotencyKey: crypto.randomUUID(),
      actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('awaiting_verify')
    const report = (await db.collection('reports').doc(reportId).get()).data()
    expect(report.status).toBe('awaiting_verify')

    const events = await db.collection('report_events').where('reportId', '==', reportId).get()
    expect(events.docs).toHaveLength(1)
    expect(events.docs[0].data()).toMatchObject({
      from: 'new',
      to: 'awaiting_verify',
      actor: 'admin-1',
    })
  })

  it('advances awaiting_verify → verified and stamps verifiedBy', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', { municipalityId: 'daet' })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })

    const result = await verifyReportCore(db, {
      reportId,
      idempotencyKey: crypto.randomUUID(),
      actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('verified')
    const report = (await db.collection('reports').doc(reportId).get()).data()
    expect(report.status).toBe('verified')
    expect(report.verifiedBy).toBe('admin-1')
    expect(report.verifiedAt).toBeDefined()
  })

  it('is idempotent: same idempotencyKey returns cached result', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })
    const key = crypto.randomUUID()

    const first = await verifyReportCore(db, {
      reportId,
      idempotencyKey: key,
      actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
      now: Timestamp.now(),
    })
    const second = await verifyReportCore(db, {
      reportId,
      idempotencyKey: key,
      actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
      now: Timestamp.now(),
    })

    expect(first.status).toBe('awaiting_verify')
    expect(second.status).toBe('awaiting_verify')
    const events = await db.collection('report_events').where('reportId', '==', reportId).get()
    expect(events.docs).toHaveLength(1) // no double event
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- callables/verify-report"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Commit the red test**

```bash
git add functions/src/__tests__/callables/verify-report.test.ts
git commit -m "test(functions): add failing verifyReport happy-path tests"
```

---

### Task 5: Implement `verifyReportCore`

**Files:**

- Create: `functions/src/callables/verify-report.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Implement the core**

```typescript
// functions/src/callables/verify-report.ts
import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  BantayogError,
  BantayogErrorCode,
  isValidReportTransition,
  logEvent,
  ReportStatus,
} from '@bantayog/shared-validators'
import { db as adminDb } from '../firebase-admin'
import { withIdempotency } from '../idempotency/guard'
import { checkRateLimit } from '../services/rate-limit'

const InputSchema = z
  .object({
    reportId: z.string().min(1).max(128),
    idempotencyKey: z.string().uuid(),
  })
  .strict()

export interface VerifyReportInput {
  reportId: string
  idempotencyKey: string
}

export interface VerifyReportResult {
  status: ReportStatus
  reportId: string
}

export interface VerifyReportActor {
  uid: string
  claims: {
    role?: string
    municipalityId?: string
    active?: boolean
  }
}

export interface VerifyReportCoreDeps {
  reportId: string
  idempotencyKey: string
  actor: VerifyReportActor
  now: Timestamp
}

export async function verifyReportCore(
  db: Firestore,
  deps: VerifyReportCoreDeps,
): Promise<VerifyReportResult> {
  const correlationId = crypto.randomUUID()

  return withIdempotency<VerifyReportCoreDeps, VerifyReportResult>(
    db,
    { key: `verifyReport:${deps.actor.uid}:${deps.idempotencyKey}`, payload: deps, now: deps.now },
    async () => {
      return db.runTransaction(async (tx) => {
        const reportRef = db.collection('reports').doc(deps.reportId)
        const reportSnap = await tx.get(reportRef)
        if (!reportSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found', {
            reportId: deps.reportId,
          })
        }
        const report = reportSnap.data()!
        if (report.municipalityId !== deps.actor.claims.municipalityId) {
          throw new BantayogError(
            BantayogErrorCode.PERMISSION_DENIED,
            'Report is not in your municipality',
          )
        }

        const from = report.status as ReportStatus
        let to: ReportStatus
        if (from === 'new') to = 'awaiting_verify'
        else if (from === 'awaiting_verify') to = 'verified'
        else {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `verifyReport cannot advance from status ${from}`,
            { reportId: deps.reportId, from },
          )
        }

        if (!isValidReportTransition(from, to)) {
          throw new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, 'invalid transition', {
            from,
            to,
          })
        }

        const updates: Record<string, unknown> = {
          status: to,
          lastStatusAt: deps.now,
          lastStatusBy: deps.actor.uid,
        }
        if (to === 'verified') {
          updates.verifiedBy = deps.actor.uid
          updates.verifiedAt = deps.now
        }
        tx.update(reportRef, updates)

        const eventRef = db.collection('report_events').doc()
        tx.set(eventRef, {
          eventId: eventRef.id,
          reportId: deps.reportId,
          from,
          to,
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          at: deps.now,
          correlationId,
          schemaVersion: 1,
        })

        logEvent({
          severity: 'INFO',
          event: 'report.verified',
          correlationId,
          reportId: deps.reportId,
          from,
          to,
          actorUid: deps.actor.uid,
        })

        return { status: to, reportId: deps.reportId }
      })
    },
  )
}

export const verifyReport = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true, maxInstances: 100 },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = (req.auth.token ?? {}) as Record<string, unknown>
    if (claims.role !== 'municipal_admin' && claims.role !== 'superadmin') {
      throw new HttpsError('permission-denied', 'municipal_admin or superadmin required')
    }
    if (claims.active !== true) {
      throw new HttpsError('permission-denied', 'account is not active')
    }

    const parsed = InputSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    const rl = await checkRateLimit(adminDb, {
      key: `verifyReport:${req.auth.uid}`,
      limit: 60,
      windowSeconds: 60,
      now: Timestamp.now(),
    })
    if (!rl.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit', {
        retryAfterSeconds: rl.retryAfterSeconds,
      })
    }

    try {
      return await verifyReportCore(adminDb, {
        reportId: parsed.data.reportId,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: {
          uid: req.auth.uid,
          claims: {
            role: claims.role as string | undefined,
            municipalityId: claims.municipalityId as string | undefined,
            active: claims.active as boolean | undefined,
          },
        },
        now: Timestamp.now(),
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError) {
        throw new HttpsError(err.toFunctionsCode(), err.message, err.details)
      }
      throw err
    }
  },
)
```

- [ ] **Step 2: Register the callable in `functions/src/index.ts`**

Append to the exports:

```typescript
export { verifyReport } from './callables/verify-report'
```

- [ ] **Step 3: Run the test**

```bash
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- callables/verify-report"
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add functions/src/callables/verify-report.ts functions/src/index.ts
git commit -m "feat(functions): implement verifyReport callable with two-branch transaction"
```

---

### Task 6: Add `verifyReport` error-path tests

**Files:**

- Modify: `functions/src/__tests__/callables/verify-report.test.ts`

- [ ] **Step 1: Append error tests**

```typescript
describe('verifyReportCore error paths', () => {
  it('returns PERMISSION_DENIED when admin is in a different municipality', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'mercedes' })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })
    await expect(
      verifyReportCore(db, {
        reportId,
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
  })

  it('returns FAILED_PRECONDITION on a report already verified', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })
    await expect(
      verifyReportCore(db, {
        reportId,
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
  })

  it('returns NOT_FOUND on missing report', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })
    await expect(
      verifyReportCore(db, {
        reportId: 'does-not-exist',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
```

- [ ] **Step 2: Run tests**

```bash
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- callables/verify-report"
```

Expected: all 6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add functions/src/__tests__/callables/verify-report.test.ts
git commit -m "test(functions): cover verifyReport error paths (wrong-muni, FAILED_PRECONDITION, NOT_FOUND)"
```

---

## Group C — `rejectReport` Callable (Tasks 7-8)

Admin clicks **Reject** when a report in `awaiting_verify` is clearly false. Transitions `awaiting_verify → cancelled_false_report` and writes a moderation incident.

---

### Task 7: Write `rejectReport` tests

**Files:**

- Create: `functions/src/__tests__/callables/reject-report.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// functions/src/__tests__/callables/reject-report.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { rejectReportCore } from '../../callables/reject-report'
import { seedReportAtStatus, seedActiveAccount, staffClaims } from '../helpers/seed-factories'
import { Timestamp } from 'firebase-admin/firestore'

let testEnv: RulesTestEnvironment
beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'reject-report-test',
    firestore: { host: 'localhost', port: 8080 },
  })
  await testEnv.clearFirestore()
})

describe('rejectReportCore', () => {
  it('transitions awaiting_verify → cancelled_false_report and writes moderation incident', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', { municipalityId: 'daet' })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })

    const result = await rejectReportCore(db, {
      reportId,
      reason: 'obviously_false',
      notes: 'duplicate from known troll',
      idempotencyKey: crypto.randomUUID(),
      actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('cancelled_false_report')
    const report = (await db.collection('reports').doc(reportId).get()).data()
    expect(report.status).toBe('cancelled_false_report')

    const incidents = await db
      .collection('moderation_incidents')
      .where('reportId', '==', reportId)
      .get()
    expect(incidents.docs).toHaveLength(1)
    expect(incidents.docs[0].data()).toMatchObject({
      reportId,
      reason: 'obviously_false',
      notes: 'duplicate from known troll',
      actor: 'admin-1',
    })

    const events = await db.collection('report_events').where('reportId', '==', reportId).get()
    expect(events.docs).toHaveLength(1)
    expect(events.docs[0].data()).toMatchObject({
      from: 'awaiting_verify',
      to: 'cancelled_false_report',
    })
  })

  it('rejects non-awaiting_verify states with FAILED_PRECONDITION', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })
    await expect(
      rejectReportCore(db, {
        reportId,
        reason: 'obviously_false',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
  })

  it('rejects cross-muni with PERMISSION_DENIED', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
      municipalityId: 'mercedes',
    })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })
    await expect(
      rejectReportCore(db, {
        reportId,
        reason: 'obviously_false',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
  })
})
```

- [ ] **Step 2: Run — confirm red**

```bash
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- callables/reject-report"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Commit**

```bash
git add functions/src/__tests__/callables/reject-report.test.ts
git commit -m "test(functions): add failing rejectReport tests"
```

---

### Task 8: Implement `rejectReportCore` + export

**Files:**

- Create: `functions/src/callables/reject-report.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Implement**

```typescript
// functions/src/callables/reject-report.ts
import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  BantayogError,
  BantayogErrorCode,
  isValidReportTransition,
  logEvent,
} from '@bantayog/shared-validators'
import { db as adminDb } from '../firebase-admin'
import { withIdempotency } from '../idempotency/guard'
import { checkRateLimit } from '../services/rate-limit'

const REJECT_REASONS = [
  'obviously_false',
  'duplicate',
  'test_submission',
  'insufficient_detail',
] as const
type RejectReason = (typeof REJECT_REASONS)[number]

const InputSchema = z
  .object({
    reportId: z.string().min(1).max(128),
    reason: z.enum(REJECT_REASONS),
    notes: z.string().max(500).optional(),
    idempotencyKey: z.string().uuid(),
  })
  .strict()

export interface RejectReportCoreDeps {
  reportId: string
  reason: RejectReason
  notes?: string
  idempotencyKey: string
  actor: { uid: string; claims: { role?: string; municipalityId?: string } }
  now: Timestamp
}

export async function rejectReportCore(db: Firestore, deps: RejectReportCoreDeps) {
  const correlationId = crypto.randomUUID()

  return withIdempotency(
    db,
    { key: `rejectReport:${deps.actor.uid}:${deps.idempotencyKey}`, payload: deps, now: deps.now },
    async () =>
      db.runTransaction(async (tx) => {
        const reportRef = db.collection('reports').doc(deps.reportId)
        const snap = await tx.get(reportRef)
        if (!snap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found')
        }
        const report = snap.data()!
        if (report.municipalityId !== deps.actor.claims.municipalityId) {
          throw new BantayogError(
            BantayogErrorCode.PERMISSION_DENIED,
            'Report not in your municipality',
          )
        }
        const from = report.status as 'awaiting_verify'
        const to = 'cancelled_false_report' as const
        if (from !== 'awaiting_verify' || !isValidReportTransition(from, to)) {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `Cannot reject report in status ${from}`,
          )
        }

        tx.update(reportRef, {
          status: to,
          lastStatusAt: deps.now,
          lastStatusBy: deps.actor.uid,
          rejectionReason: deps.reason,
        })

        const incRef = db.collection('moderation_incidents').doc()
        tx.set(incRef, {
          incidentId: incRef.id,
          reportId: deps.reportId,
          reason: deps.reason,
          notes: deps.notes ?? null,
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          at: deps.now,
          correlationId,
          schemaVersion: 1,
        })

        const evRef = db.collection('report_events').doc()
        tx.set(evRef, {
          eventId: evRef.id,
          reportId: deps.reportId,
          from,
          to,
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          at: deps.now,
          correlationId,
          schemaVersion: 1,
        })

        logEvent({
          severity: 'INFO',
          event: 'report.rejected',
          correlationId,
          reportId: deps.reportId,
          reason: deps.reason,
          actorUid: deps.actor.uid,
        })

        return { status: to, reportId: deps.reportId }
      }),
  )
}

export const rejectReport = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true, maxInstances: 100 },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = (req.auth.token ?? {}) as Record<string, unknown>
    if (claims.role !== 'municipal_admin' && claims.role !== 'superadmin') {
      throw new HttpsError('permission-denied', 'municipal_admin or superadmin required')
    }
    if (claims.active !== true) throw new HttpsError('permission-denied', 'account is not active')
    const parsed = InputSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')
    const rl = await checkRateLimit(adminDb, {
      key: `rejectReport:${req.auth.uid}`,
      limit: 60,
      windowSeconds: 60,
      now: Timestamp.now(),
    })
    if (!rl.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit', {
        retryAfterSeconds: rl.retryAfterSeconds,
      })
    }

    try {
      return await rejectReportCore(adminDb, {
        reportId: parsed.data.reportId,
        reason: parsed.data.reason,
        notes: parsed.data.notes,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: {
          uid: req.auth.uid,
          claims: {
            role: claims.role as string | undefined,
            municipalityId: claims.municipalityId as string | undefined,
          },
        },
        now: Timestamp.now(),
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError)
        throw new HttpsError(err.toFunctionsCode(), err.message, err.details)
      throw err
    }
  },
)
```

- [ ] **Step 2: Export in `functions/src/index.ts`**

```typescript
export { rejectReport } from './callables/reject-report'
```

- [ ] **Step 3: Run tests**

```bash
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- callables/reject-report"
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add functions/src/callables/reject-report.ts functions/src/index.ts
git commit -m "feat(functions): implement rejectReport callable"
```

---

## Group D — `dispatchResponder` Callable (Tasks 9-11)

The heart of 3b. Transactionally creates a dispatch + transitions the report `verified → assigned` + appends both event streams.

---

### Task 9: Write `dispatchResponder` happy-path test

**Files:**

- Create: `functions/src/__tests__/callables/dispatch-responder.test.ts`

- [ ] **Step 1: Write the failing happy-path test**

```typescript
// functions/src/__tests__/callables/dispatch-responder.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { dispatchResponderCore } from '../../callables/dispatch-responder'
import {
  seedReportAtStatus,
  seedActiveAccount,
  seedResponder,
  seedResponderShift,
  staffClaims,
} from '../helpers/seed-factories'
import { Timestamp } from 'firebase-admin/firestore'

let testEnv: RulesTestEnvironment

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'dispatch-responder-test',
    firestore: { host: 'localhost', port: 8080 },
    database: { host: 'localhost', port: 9000 },
  })
  await testEnv.clearFirestore()
  await testEnv.clearDatabase()
})

describe('dispatchResponderCore', () => {
  it('creates dispatch, transitions report → assigned, writes both event streams', async () => {
    const ctx = testEnv.unauthenticatedContext()
    const db = ctx.firestore() as any
    const rtdb = ctx.database() as any

    const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })
    await seedResponder(db, {
      uid: 'r1',
      municipalityId: 'daet',
      agencyId: 'bfp-daet',
      isActive: true,
    })
    await seedResponderShift(rtdb, 'daet', 'r1', true)

    const result = await dispatchResponderCore(db, rtdb, {
      reportId,
      responderUid: 'r1',
      idempotencyKey: crypto.randomUUID(),
      actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('pending')
    expect(result.dispatchId).toBeDefined()

    const dispatch = (await db.collection('dispatches').doc(result.dispatchId).get()).data()
    expect(dispatch).toMatchObject({
      reportId,
      status: 'pending',
      assignedTo: { uid: 'r1', agencyId: 'bfp-daet', municipalityId: 'daet' },
    })

    const report = (await db.collection('reports').doc(reportId).get()).data()
    expect(report.status).toBe('assigned')

    const reportEvents = await db
      .collection('report_events')
      .where('reportId', '==', reportId)
      .get()
    expect(reportEvents.docs).toHaveLength(1)
    const dispatchEvents = await db
      .collection('dispatch_events')
      .where('dispatchId', '==', result.dispatchId)
      .get()
    expect(dispatchEvents.docs).toHaveLength(1)
  })

  it('sets acknowledgementDeadlineAt according to severity', async () => {
    const ctx = testEnv.unauthenticatedContext()
    const db = ctx.firestore() as any
    const rtdb = ctx.database() as any
    const { reportId } = await seedReportAtStatus(db, 'verified', {
      municipalityId: 'daet',
      severity: 'high',
    })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })
    await seedResponder(db, {
      uid: 'r1',
      municipalityId: 'daet',
      agencyId: 'bfp-daet',
      isActive: true,
    })
    await seedResponderShift(rtdb, 'daet', 'r1', true)
    const now = Timestamp.now()
    const result = await dispatchResponderCore(db, rtdb, {
      reportId,
      responderUid: 'r1',
      idempotencyKey: crypto.randomUUID(),
      actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
      now,
    })
    const dispatch = (await db.collection('dispatches').doc(result.dispatchId).get()).data()
    // High severity = 5 min deadline
    expect(dispatch.acknowledgementDeadlineAt.toMillis() - now.toMillis()).toBeCloseTo(
      5 * 60 * 1000,
      -3,
    )
  })
})
```

- [ ] **Step 2: Run — confirm red**

```bash
firebase emulators:exec --only firestore,database "pnpm --filter @bantayog/functions test -- callables/dispatch-responder"
```

Expected: FAIL.

- [ ] **Step 3: Commit**

```bash
git add functions/src/__tests__/callables/dispatch-responder.test.ts
git commit -m "test(functions): add failing dispatchResponder happy-path tests"
```

---

### Task 10: Implement `dispatchResponderCore`

**Files:**

- Create: `functions/src/callables/dispatch-responder.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Implement**

```typescript
// functions/src/callables/dispatch-responder.ts
import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import type { Database } from 'firebase-admin/database'
import { z } from 'zod'
import {
  BantayogError,
  BantayogErrorCode,
  isValidReportTransition,
  isValidDispatchTransition,
  logEvent,
} from '@bantayog/shared-validators'
import { db as adminDb, rtdb as adminRtdb } from '../firebase-admin'
import { withIdempotency } from '../idempotency/guard'
import { checkRateLimit } from '../services/rate-limit'

const InputSchema = z
  .object({
    reportId: z.string().min(1).max(128),
    responderUid: z.string().min(1).max(128),
    idempotencyKey: z.string().uuid(),
  })
  .strict()

const DEADLINE_BY_SEVERITY: Record<'low' | 'medium' | 'high', number> = {
  low: 30 * 60 * 1000,
  medium: 15 * 60 * 1000,
  high: 5 * 60 * 1000,
}

export interface DispatchResponderCoreDeps {
  reportId: string
  responderUid: string
  idempotencyKey: string
  actor: { uid: string; claims: { role?: string; municipalityId?: string } }
  now: Timestamp
}

export async function dispatchResponderCore(
  db: Firestore,
  rtdb: Database,
  deps: DispatchResponderCoreDeps,
) {
  const correlationId = crypto.randomUUID()

  return withIdempotency(
    db,
    {
      key: `dispatchResponder:${deps.actor.uid}:${deps.idempotencyKey}`,
      payload: deps,
      now: deps.now,
    },
    async () => {
      // Pre-tx read of RTDB shift (RTDB is not in the Firestore transaction scope).
      const shiftSnap = await rtdb
        .ref(`/responder_index/${deps.actor.claims.municipalityId}/${deps.responderUid}`)
        .get()
      const isOnShift = (shiftSnap.val() ?? {}).isOnShift === true
      if (!isOnShift) {
        throw new BantayogError(
          BantayogErrorCode.FAILED_PRECONDITION,
          'Responder is not on shift',
          { responderUid: deps.responderUid },
        )
      }

      return db.runTransaction(async (tx) => {
        const reportRef = db.collection('reports').doc(deps.reportId)
        const responderRef = db.collection('responders').doc(deps.responderUid)

        const [reportSnap, responderSnap] = await Promise.all([
          tx.get(reportRef),
          tx.get(responderRef),
        ])
        if (!reportSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found')
        }
        if (!responderSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Responder not found')
        }
        const report = reportSnap.data()!
        const responder = responderSnap.data()!

        if (report.municipalityId !== deps.actor.claims.municipalityId) {
          throw new BantayogError(
            BantayogErrorCode.PERMISSION_DENIED,
            'Report not in your municipality',
          )
        }
        if (responder.municipalityId !== deps.actor.claims.municipalityId) {
          throw new BantayogError(
            BantayogErrorCode.PERMISSION_DENIED,
            'Responder not in your municipality',
          )
        }
        if (responder.isActive !== true) {
          throw new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, 'Responder is not active')
        }

        const from = report.status as 'verified'
        const to = 'assigned' as const
        if (from !== 'verified' || !isValidReportTransition(from, to)) {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `Cannot dispatch from status ${from}`,
          )
        }

        const severity = (report.severityDerived ?? 'medium') as keyof typeof DEADLINE_BY_SEVERITY
        const deadlineMs = DEADLINE_BY_SEVERITY[severity]

        const dispatchRef = db.collection('dispatches').doc()
        const dispatchId = dispatchRef.id

        if (!isValidDispatchTransition(null, 'pending')) {
          throw new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, 'Cannot create dispatch')
        }

        tx.set(dispatchRef, {
          dispatchId,
          reportId: deps.reportId,
          status: 'pending',
          assignedTo: {
            uid: deps.responderUid,
            agencyId: responder.agencyId,
            municipalityId: responder.municipalityId,
          },
          dispatchedAt: deps.now,
          dispatchedBy: deps.actor.uid,
          lastStatusAt: deps.now,
          acknowledgementDeadlineAt: Timestamp.fromMillis(deps.now.toMillis() + deadlineMs),
          correlationId,
          schemaVersion: 1,
        })

        tx.update(reportRef, {
          status: to,
          lastStatusAt: deps.now,
          lastStatusBy: deps.actor.uid,
          currentDispatchId: dispatchId,
        })

        const reportEvRef = db.collection('report_events').doc()
        tx.set(reportEvRef, {
          eventId: reportEvRef.id,
          reportId: deps.reportId,
          from,
          to,
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          at: deps.now,
          correlationId,
          schemaVersion: 1,
        })

        const dispatchEvRef = db.collection('dispatch_events').doc()
        tx.set(dispatchEvRef, {
          eventId: dispatchEvRef.id,
          dispatchId,
          reportId: deps.reportId,
          from: null,
          to: 'pending',
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          at: deps.now,
          correlationId,
          schemaVersion: 1,
        })

        logEvent({
          severity: 'INFO',
          event: 'dispatch.created',
          correlationId,
          reportId: deps.reportId,
          dispatchId,
          actorUid: deps.actor.uid,
          severity_report: severity,
        })

        return { dispatchId, status: 'pending' as const, reportId: deps.reportId }
      })
    },
  )
}

export const dispatchResponder = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true, maxInstances: 100 },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = (req.auth.token ?? {}) as Record<string, unknown>
    if (claims.role !== 'municipal_admin') {
      throw new HttpsError('permission-denied', 'municipal_admin required')
    }
    if (claims.active !== true) throw new HttpsError('permission-denied', 'account is not active')
    const parsed = InputSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')
    const rl = await checkRateLimit(adminDb, {
      key: `dispatchResponder:${req.auth.uid}`,
      limit: 30,
      windowSeconds: 60,
      now: Timestamp.now(),
    })
    if (!rl.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit', {
        retryAfterSeconds: rl.retryAfterSeconds,
      })
    }
    try {
      return await dispatchResponderCore(adminDb, adminRtdb, {
        reportId: parsed.data.reportId,
        responderUid: parsed.data.responderUid,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: {
          uid: req.auth.uid,
          claims: {
            role: claims.role as string,
            municipalityId: claims.municipalityId as string | undefined,
          },
        },
        now: Timestamp.now(),
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError)
        throw new HttpsError(err.toFunctionsCode(), err.message, err.details)
      throw err
    }
  },
)
```

Note: `rtdb` export must exist in `functions/src/firebase-admin.ts`. If not, add:

```typescript
// functions/src/firebase-admin.ts — append if missing
import { getDatabase } from 'firebase-admin/database'
export const rtdb = getDatabase()
```

- [ ] **Step 2: Register**

```typescript
// functions/src/index.ts — append
export { dispatchResponder } from './callables/dispatch-responder'
```

- [ ] **Step 3: Run tests**

```bash
firebase emulators:exec --only firestore,database "pnpm --filter @bantayog/functions test -- callables/dispatch-responder"
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add functions/src/callables/dispatch-responder.ts functions/src/index.ts functions/src/firebase-admin.ts
git commit -m "feat(functions): implement dispatchResponder callable with severity-based deadlines"
```

---

### Task 11: Add `dispatchResponder` error-path tests

**Files:**

- Modify: `functions/src/__tests__/callables/dispatch-responder.test.ts`

- [ ] **Step 1: Append error tests**

```typescript
describe('dispatchResponderCore error paths', () => {
  it('PERMISSION_DENIED when responder is in another municipality', async () => {
    const ctx = testEnv.unauthenticatedContext()
    const db = ctx.firestore() as any
    const rtdb = ctx.database() as any
    const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })
    await seedResponder(db, {
      uid: 'r-wrong-muni',
      municipalityId: 'mercedes',
      agencyId: 'bfp-mercedes',
      isActive: true,
    })
    await seedResponderShift(rtdb, 'mercedes', 'r-wrong-muni', true)
    await expect(
      dispatchResponderCore(db, rtdb, {
        reportId,
        responderUid: 'r-wrong-muni',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
  })

  it('FAILED_PRECONDITION when report is not verified', async () => {
    const ctx = testEnv.unauthenticatedContext()
    const db = ctx.firestore() as any
    const rtdb = ctx.database() as any
    const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })
    await seedResponder(db, {
      uid: 'r1',
      municipalityId: 'daet',
      agencyId: 'bfp-daet',
      isActive: true,
    })
    await seedResponderShift(rtdb, 'daet', 'r1', true)
    await expect(
      dispatchResponderCore(db, rtdb, {
        reportId,
        responderUid: 'r1',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
  })

  it('FAILED_PRECONDITION when responder is not on shift', async () => {
    const ctx = testEnv.unauthenticatedContext()
    const db = ctx.firestore() as any
    const rtdb = ctx.database() as any
    const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })
    await seedResponder(db, {
      uid: 'r1',
      municipalityId: 'daet',
      agencyId: 'bfp-daet',
      isActive: true,
    })
    await seedResponderShift(rtdb, 'daet', 'r1', false)
    await expect(
      dispatchResponderCore(db, rtdb, {
        reportId,
        responderUid: 'r1',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
  })
})
```

- [ ] **Step 2: Run tests**

```bash
firebase emulators:exec --only firestore,database "pnpm --filter @bantayog/functions test -- callables/dispatch-responder"
```

Expected: all PASS (5 tests).

- [ ] **Step 3: Commit**

```bash
git add functions/src/__tests__/callables/dispatch-responder.test.ts
git commit -m "test(functions): cover dispatchResponder cross-muni and off-shift error paths"
```

---

## Group E — `cancelDispatch` (Pending-Only in 3b) (Tasks 12-13)

3b ships cancel only for `pending`. The `accepted | acknowledged | in_progress → cancelled` branches land in 3c with the rest of the responder loop.

---

### Task 12: Write `cancelDispatch` (pending-only) tests

**Files:**

- Create: `functions/src/__tests__/callables/cancel-dispatch.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// functions/src/__tests__/callables/cancel-dispatch.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { cancelDispatchCore } from '../../callables/cancel-dispatch'
import {
  seedReportAtStatus,
  seedActiveAccount,
  seedDispatch,
  staffClaims,
} from '../helpers/seed-factories'
import { Timestamp } from 'firebase-admin/firestore'

let testEnv: RulesTestEnvironment
beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'cancel-dispatch-test',
    firestore: { host: 'localhost', port: 8080 },
  })
  await testEnv.clearFirestore()
})

describe('cancelDispatchCore (3b branches)', () => {
  it('cancels a pending dispatch and reverts report to verified', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'pending',
    })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })

    const result = await cancelDispatchCore(db, {
      dispatchId,
      reason: 'responder_unavailable',
      idempotencyKey: crypto.randomUUID(),
      actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('cancelled')

    const dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
    expect(dispatch.status).toBe('cancelled')
    expect(dispatch.cancelledBy).toBe('admin-1')

    const report = (await db.collection('reports').doc(reportId).get()).data()
    expect(report.status).toBe('verified') // revert
    expect(report.currentDispatchId).toBeNull()

    const evts = await db.collection('dispatch_events').where('dispatchId', '==', dispatchId).get()
    expect(evts.docs).toHaveLength(1)
    expect(evts.docs[0].data()).toMatchObject({ from: 'pending', to: 'cancelled' })
  })

  it('PERMISSION_DENIED when cancelling a dispatch for a different muni', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'mercedes' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r2',
      municipalityId: 'mercedes',
      status: 'pending',
    })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })
    await expect(
      cancelDispatchCore(db, {
        dispatchId,
        reason: 'responder_unavailable',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
  })

  it('FAILED_PRECONDITION when dispatch is not pending (3b scope)', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'accepted',
    })
    await seedActiveAccount(db, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })
    await expect(
      cancelDispatchCore(db, {
        dispatchId,
        reason: 'responder_unavailable',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
  })
})
```

- [ ] **Step 2: Confirm red**

```bash
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- callables/cancel-dispatch"
```

Expected: FAIL.

- [ ] **Step 3: Commit**

```bash
git add functions/src/__tests__/callables/cancel-dispatch.test.ts
git commit -m "test(functions): add failing cancelDispatch (pending-only) tests"
```

---

### Task 13: Implement `cancelDispatchCore` (pending-only)

**Files:**

- Create: `functions/src/callables/cancel-dispatch.ts`
- Modify: `functions/src/index.ts`

Implementation intentionally narrows the `from` states allowed to `['pending']`. 3c will widen to `['pending', 'accepted', 'acknowledged', 'in_progress']` by changing this single allowlist and adding more report-status revert logic.

- [ ] **Step 1: Implement**

```typescript
// functions/src/callables/cancel-dispatch.ts
import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  BantayogError,
  BantayogErrorCode,
  isValidDispatchTransition,
  logEvent,
} from '@bantayog/shared-validators'
import { db as adminDb } from '../firebase-admin'
import { withIdempotency } from '../idempotency/guard'
import { checkRateLimit } from '../services/rate-limit'

const CANCEL_REASONS = [
  'responder_unavailable',
  'duplicate_report',
  'admin_error',
  'citizen_withdrew',
] as const
export type CancelReason = (typeof CANCEL_REASONS)[number]

const InputSchema = z
  .object({
    dispatchId: z.string().min(1).max(128),
    reason: z.enum(CANCEL_REASONS),
    idempotencyKey: z.string().uuid(),
  })
  .strict()

// Only the 3b-allowed from-states. 3c extends this list.
const CANCELLABLE_FROM_STATES: readonly string[] = ['pending']

export interface CancelDispatchCoreDeps {
  dispatchId: string
  reason: CancelReason
  idempotencyKey: string
  actor: { uid: string; claims: { role?: string; municipalityId?: string } }
  now: Timestamp
}

export async function cancelDispatchCore(db: Firestore, deps: CancelDispatchCoreDeps) {
  const correlationId = crypto.randomUUID()

  return withIdempotency(
    db,
    {
      key: `cancelDispatch:${deps.actor.uid}:${deps.idempotencyKey}`,
      payload: deps,
      now: deps.now,
    },
    async () =>
      db.runTransaction(async (tx) => {
        const dispatchRef = db.collection('dispatches').doc(deps.dispatchId)
        const dispatchSnap = await tx.get(dispatchRef)
        if (!dispatchSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found')
        }
        const dispatch = dispatchSnap.data()!
        if (dispatch.assignedTo?.municipalityId !== deps.actor.claims.municipalityId) {
          throw new BantayogError(
            BantayogErrorCode.PERMISSION_DENIED,
            'Dispatch not in your municipality',
          )
        }

        const from = dispatch.status as string
        const to = 'cancelled' as const

        if (!CANCELLABLE_FROM_STATES.includes(from)) {
          throw new BantayogError(
            BantayogErrorCode.FAILED_PRECONDITION,
            `Cannot cancel dispatch in status ${from} (3b scope: pending-only)`,
          )
        }

        if (!isValidDispatchTransition(from as any, to)) {
          throw new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, 'invalid transition')
        }

        tx.update(dispatchRef, {
          status: to,
          lastStatusAt: deps.now,
          cancelledBy: deps.actor.uid,
          cancelReason: deps.reason,
        })

        // Revert the report to verified only if this was the current dispatch and state was pending.
        const reportRef = db.collection('reports').doc(dispatch.reportId)
        const reportSnap = await tx.get(reportRef)
        if (reportSnap.exists && reportSnap.data()!.currentDispatchId === deps.dispatchId) {
          tx.update(reportRef, {
            status: 'verified',
            currentDispatchId: null,
            lastStatusAt: deps.now,
            lastStatusBy: deps.actor.uid,
          })
          const revertEv = db.collection('report_events').doc()
          tx.set(revertEv, {
            eventId: revertEv.id,
            reportId: dispatch.reportId,
            from: 'assigned',
            to: 'verified',
            actor: deps.actor.uid,
            actorRole: deps.actor.claims.role ?? 'municipal_admin',
            at: deps.now,
            correlationId,
            schemaVersion: 1,
          })
        }

        const evRef = db.collection('dispatch_events').doc()
        tx.set(evRef, {
          eventId: evRef.id,
          dispatchId: deps.dispatchId,
          reportId: dispatch.reportId,
          from,
          to,
          actor: deps.actor.uid,
          actorRole: deps.actor.claims.role ?? 'municipal_admin',
          reason: deps.reason,
          at: deps.now,
          correlationId,
          schemaVersion: 1,
        })

        logEvent({
          severity: 'INFO',
          event: 'dispatch.cancelled',
          correlationId,
          dispatchId: deps.dispatchId,
          reportId: dispatch.reportId,
          reason: deps.reason,
          actorUid: deps.actor.uid,
          from,
        })

        return { status: to, dispatchId: deps.dispatchId }
      }),
  )
}

export const cancelDispatch = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true, maxInstances: 100 },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = (req.auth.token ?? {}) as Record<string, unknown>
    if (claims.role !== 'municipal_admin') {
      throw new HttpsError('permission-denied', 'municipal_admin required')
    }
    if (claims.active !== true) throw new HttpsError('permission-denied', 'account is not active')
    const parsed = InputSchema.safeParse(req.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')
    const rl = await checkRateLimit(adminDb, {
      key: `cancelDispatch:${req.auth.uid}`,
      limit: 30,
      windowSeconds: 60,
      now: Timestamp.now(),
    })
    if (!rl.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit', {
        retryAfterSeconds: rl.retryAfterSeconds,
      })
    }
    try {
      return await cancelDispatchCore(adminDb, {
        dispatchId: parsed.data.dispatchId,
        reason: parsed.data.reason,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: {
          uid: req.auth.uid,
          claims: {
            role: claims.role as string,
            municipalityId: claims.municipalityId as string | undefined,
          },
        },
        now: Timestamp.now(),
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError)
        throw new HttpsError(err.toFunctionsCode(), err.message, err.details)
      throw err
    }
  },
)
```

- [ ] **Step 2: Register**

```typescript
// functions/src/index.ts
export { cancelDispatch } from './callables/cancel-dispatch'
```

- [ ] **Step 3: Run tests**

```bash
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- callables/cancel-dispatch"
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add functions/src/callables/cancel-dispatch.ts functions/src/index.ts
git commit -m "feat(functions): implement cancelDispatch (pending-only in 3b)"
```

---

## Group F — Admin Read Rules Verification (Task 14)

The admin-desktop queue reads `reports` filtered by `municipalityId`. Phase 2 rules should already permit this, but we add a dedicated rules test to lock the contract.

---

### Task 14: Lock admin onSnapshot contract with rules tests

**Files:**

- Create: `functions/src/__tests__/rules/admin-onsnapshot.rules.test.ts`

- [ ] **Step 1: Write rules tests**

```typescript
// functions/src/__tests__/rules/admin-onsnapshot.rules.test.ts
import { describe, it, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { seedReportAtStatus } from '../helpers/seed-factories'

let testEnv: RulesTestEnvironment

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'admin-onsnapshot-rules-test',
    firestore: {
      rules: readFileSync('infra/firebase/firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  })
  await testEnv.clearFirestore()
})

describe('admin muni-scoped onSnapshot queue', () => {
  it('allows muni admin to read reports filtered by own municipalityId + queue statuses', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await seedReportAtStatus(db, 'new', { reportId: 'r1', municipalityId: 'daet' })
      await seedReportAtStatus(db, 'awaiting_verify', { reportId: 'r2', municipalityId: 'daet' })
      await db.collection('users').doc('admin-1').set({
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
        isActive: true,
        schemaVersion: 1,
      })
    })

    const adminDb = testEnv
      .authenticatedContext('admin-1', {
        role: 'municipal_admin',
        municipalityId: 'daet',
        active: true,
      })
      .firestore() as any

    await assertSucceeds(
      adminDb
        .collection('reports')
        .where('municipalityId', '==', 'daet')
        .where('status', 'in', ['new', 'awaiting_verify'])
        .get(),
    )
  })

  it('denies cross-muni reads', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await seedReportAtStatus(db, 'new', { reportId: 'rx', municipalityId: 'mercedes' })
      await db.collection('users').doc('admin-1').set({
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
        isActive: true,
        schemaVersion: 1,
      })
    })
    const adminDb = testEnv
      .authenticatedContext('admin-1', {
        role: 'municipal_admin',
        municipalityId: 'daet',
        active: true,
      })
      .firestore() as any

    await assertFails(adminDb.collection('reports').where('municipalityId', '==', 'mercedes').get())
  })

  it('denies unauthenticated reads', async () => {
    const anon = testEnv.unauthenticatedContext().firestore() as any
    await assertFails(anon.collection('reports').where('municipalityId', '==', 'daet').get())
  })

  it('denies citizen-role reads', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await db
        .collection('users')
        .doc('cit-1')
        .set({ uid: 'cit-1', role: 'citizen', isActive: true, schemaVersion: 1 })
    })
    const citDb = testEnv
      .authenticatedContext('cit-1', { role: 'citizen', active: true })
      .firestore() as any
    await assertFails(citDb.collection('reports').where('municipalityId', '==', 'daet').get())
  })
})
```

- [ ] **Step 2: Run**

```bash
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- rules/admin-onsnapshot"
```

Expected: PASS (4 tests). If any fail: do NOT modify rules here — surface the gap, treat it as a 3b rule tightening, and add the minimum `match` block. (The 3a rules template covers the common case; these tests just pin the behavior.)

- [ ] **Step 3: Commit**

```bash
git add functions/src/__tests__/rules/admin-onsnapshot.rules.test.ts
git commit -m "test(rules): lock admin muni-scoped onSnapshot contract with 4 positive + negative cases"
```

---

## Group G — Admin Desktop Shell (Tasks 15-18)

Minimal React + Vite app: auth, triage queue, detail panel, dispatch modal. All actions go through callables.

---

### Task 15: Scaffold admin-desktop Firebase init, auth provider, and protected route

**Files:**

- Create: `apps/admin-desktop/src/app/firebase.ts`
- Create: `apps/admin-desktop/src/app/auth-provider.tsx`
- Create: `apps/admin-desktop/src/app/protected-route.tsx`
- Modify: `apps/admin-desktop/src/App.tsx`
- Modify: `apps/admin-desktop/src/routes.tsx` (create if missing)

- [ ] **Step 1: Create `firebase.ts`**

```typescript
// apps/admin-desktop/src/app/firebase.ts
import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'

const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MSG_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseApp = initializeApp(firebaseConfig)

if (!useEmulator) {
  // App Check (prod) — ReCaptcha v3 provider with public site key
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
} else if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN ?? true
}

export const db = getFirestore(firebaseApp)
export const auth = getAuth(firebaseApp)
export const functions = getFunctions(firebaseApp, 'asia-southeast1')

if (useEmulator) {
  connectFirestoreEmulator(db, 'localhost', 8080)
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  connectFunctionsEmulator(functions, 'localhost', 5001)
}
```

- [ ] **Step 2: Create `auth-provider.tsx`**

```tsx
// apps/admin-desktop/src/app/auth-provider.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { onAuthStateChanged, User, signOut as fbSignOut } from 'firebase/auth'
import { auth } from './firebase'

export interface AdminClaims {
  role?: 'municipal_admin' | 'superadmin' | string
  municipalityId?: string
  active?: boolean
}

interface AuthState {
  user: User | null
  claims: AdminClaims | null
  loading: boolean
  signOut: () => Promise<void>
  refreshClaims: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [claims, setClaims] = useState<AdminClaims | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshClaims = async () => {
    if (!auth.currentUser) {
      setClaims(null)
      return
    }
    const tok = await auth.currentUser.getIdTokenResult(true)
    setClaims({
      role: tok.claims.role as string | undefined,
      municipalityId: tok.claims.municipalityId as string | undefined,
      active: tok.claims.active === true,
    })
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const tok = await u.getIdTokenResult()
        setClaims({
          role: tok.claims.role as string | undefined,
          municipalityId: tok.claims.municipalityId as string | undefined,
          active: tok.claims.active === true,
        })
      } else {
        setClaims(null)
      }
      setLoading(false)
    })
  }, [])

  return (
    <Ctx.Provider value={{ user, claims, loading, signOut: () => fbSignOut(auth), refreshClaims }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
```

- [ ] **Step 3: Create `protected-route.tsx`**

```tsx
// apps/admin-desktop/src/app/protected-route.tsx
import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth-provider'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, claims, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div>Loading…</div>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  if (claims?.role !== 'municipal_admin' && claims?.role !== 'superadmin') {
    return (
      <div role="alert">
        You don’t have admin access on this account. Contact your municipality’s superadmin.
      </div>
    )
  }
  if (claims?.active !== true) {
    return <div role="alert">Your account is not active. Please contact your superadmin.</div>
  }
  if (claims.role === 'municipal_admin' && !claims.municipalityId) {
    return (
      <div role="alert">
        Your admin account is missing a municipality assignment. Contact superadmin.
      </div>
    )
  }

  return <>{children}</>
}
```

- [ ] **Step 4: Wire routes + App**

```tsx
// apps/admin-desktop/src/routes.tsx
import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from './app/protected-route'
import { LoginPage } from './pages/LoginPage'
import { TriageQueuePage } from './pages/TriageQueuePage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <TriageQueuePage />
      </ProtectedRoute>
    ),
  },
])
```

```tsx
// apps/admin-desktop/src/App.tsx
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './app/auth-provider'
import { router } from './routes'

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
```

Stub `LoginPage` + `TriageQueuePage` for now; fleshed out in the next tasks.

```tsx
// apps/admin-desktop/src/pages/LoginPage.tsx
import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../app/firebase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    }
  }

  return (
    <main>
      <h1>Bantayog Admin</h1>
      <form onSubmit={onSubmit}>
        <label>
          Email{' '}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password{' '}
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit">Sign in</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  )
}
```

```tsx
// apps/admin-desktop/src/pages/TriageQueuePage.tsx — minimal placeholder
export function TriageQueuePage() {
  return (
    <main>
      <h1>Triage Queue</h1>
      <p>Coming online in Task 16.</p>
    </main>
  )
}
```

- [ ] **Step 5: Type-check + start dev server smoke**

```bash
pnpm --filter @bantayog/admin-desktop typecheck
VITE_USE_EMULATOR=true VITE_FIREBASE_PROJECT_ID=bantayog-alert-dev pnpm --filter @bantayog/admin-desktop dev &
# Open http://localhost:5174 and confirm login page renders; Ctrl-C the dev server
```

- [ ] **Step 6: Commit**

```bash
git add apps/admin-desktop/src/app \
        apps/admin-desktop/src/pages \
        apps/admin-desktop/src/routes.tsx \
        apps/admin-desktop/src/App.tsx
git commit -m "feat(admin-desktop): scaffold auth provider, protected route, login + queue stubs"
```

---

### Task 16: `useMuniReports` + `TriageQueuePage` with side panel

**Files:**

- Create: `apps/admin-desktop/src/hooks/useMuniReports.ts`
- Create: `apps/admin-desktop/src/hooks/useReportDetail.ts`
- Modify: `apps/admin-desktop/src/pages/TriageQueuePage.tsx`
- Create: `apps/admin-desktop/src/pages/ReportDetailPanel.tsx`

- [ ] **Step 1: Implement the hook**

```typescript
// apps/admin-desktop/src/hooks/useMuniReports.ts
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy, limit, Timestamp } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface MuniReportRow {
  reportId: string
  status: string
  severityDerived: string
  createdAt: Timestamp
  municipalityLabel: string
}

export function useMuniReports(municipalityId: string | undefined) {
  const [rows, setRows] = useState<MuniReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!municipalityId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'reports'),
      where('municipalityId', '==', municipalityId),
      where('status', 'in', ['new', 'awaiting_verify', 'verified', 'assigned']),
      orderBy('createdAt', 'desc'),
      limit(100),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              reportId: d.id,
              status: String(data.status),
              severityDerived: String(data.severityDerived ?? 'medium'),
              createdAt: data.createdAt as Timestamp,
              municipalityLabel: String(data.municipalityLabel ?? ''),
            }
          }),
        )
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsub
  }, [municipalityId])

  return { rows, loading, error }
}
```

- [ ] **Step 2: Detail hook**

```typescript
// apps/admin-desktop/src/hooks/useReportDetail.ts
import { useEffect, useState } from 'react'
import { doc, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface ReportDetail {
  reportId: string
  status: string
  municipalityLabel: string
  severityDerived: string
  createdAt: Timestamp
  verifiedBy?: string
  verifiedAt?: Timestamp
  currentDispatchId?: string
}
export interface ReportOps {
  verifyQueuePriority: number
  assignedMunicipalityAdmins: string[]
}

export function useReportDetail(reportId: string | undefined) {
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [ops, setOps] = useState<ReportOps | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!reportId) {
      setReport(null)
      setOps(null)
      return
    }
    const u1 = onSnapshot(
      doc(db, 'reports', reportId),
      (s) =>
        setReport(s.exists() ? ({ reportId: s.id, ...(s.data() as any) } as ReportDetail) : null),
      (err) => setError(err.message),
    )
    const u2 = onSnapshot(
      doc(db, 'report_ops', reportId),
      (s) => setOps(s.exists() ? (s.data() as ReportOps) : null),
      (err) => setError(err.message),
    )
    return () => {
      u1()
      u2()
    }
  }, [reportId])

  return { report, ops, error }
}
```

- [ ] **Step 3: `ReportDetailPanel`**

```tsx
// apps/admin-desktop/src/pages/ReportDetailPanel.tsx
import { useReportDetail } from '../hooks/useReportDetail'

export function ReportDetailPanel({
  reportId,
  onVerify,
  onReject,
  onDispatch,
}: {
  reportId: string
  onVerify: (reportId: string) => void
  onReject: (reportId: string) => void
  onDispatch: (reportId: string) => void
}) {
  const { report, ops, error } = useReportDetail(reportId)
  if (error) return <aside role="alert">Error loading report: {error}</aside>
  if (!report) return <aside>Loading…</aside>

  const canVerify = report.status === 'new' || report.status === 'awaiting_verify'
  const canReject = report.status === 'awaiting_verify'
  const canDispatch = report.status === 'verified'

  return (
    <aside>
      <h2>Report {reportId.slice(0, 8)}</h2>
      <dl>
        <dt>Status</dt>
        <dd>{report.status}</dd>
        <dt>Severity</dt>
        <dd>{report.severityDerived}</dd>
        <dt>Municipality</dt>
        <dd>{report.municipalityLabel}</dd>
        <dt>Created</dt>
        <dd>{report.createdAt?.toDate().toLocaleString()}</dd>
        {ops && (
          <>
            <dt>Queue priority</dt>
            <dd>{ops.verifyQueuePriority}</dd>
          </>
        )}
      </dl>
      <div>
        <button disabled={!canVerify} onClick={() => onVerify(reportId)}>
          {report.status === 'new' ? 'Open for verify' : 'Verify'}
        </button>
        <button disabled={!canReject} onClick={() => onReject(reportId)}>
          Reject
        </button>
        <button disabled={!canDispatch} onClick={() => onDispatch(reportId)}>
          Dispatch
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: `TriageQueuePage`**

```tsx
// apps/admin-desktop/src/pages/TriageQueuePage.tsx
import { useState } from 'react'
import { useAuth } from '../app/auth-provider'
import { useMuniReports } from '../hooks/useMuniReports'
import { ReportDetailPanel } from './ReportDetailPanel'
import { DispatchModal } from './DispatchModal'
import { callables } from '../services/callables'

export function TriageQueuePage() {
  const { claims, signOut } = useAuth()
  const { rows, loading, error } = useMuniReports(claims?.municipalityId)
  const [selected, setSelected] = useState<string | null>(null)
  const [dispatchForReportId, setDispatchForReportId] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  async function handleVerify(reportId: string) {
    try {
      await callables.verifyReport({ reportId, idempotencyKey: crypto.randomUUID() })
      setBanner(null)
    } catch (err: unknown) {
      setBanner(err instanceof Error ? err.message : 'Verify failed')
    }
  }

  async function handleReject(reportId: string) {
    const reason = prompt(
      'Reject reason (obviously_false, duplicate, test_submission, insufficient_detail)?',
    )
    if (!reason) return
    try {
      await callables.rejectReport({
        reportId,
        reason: reason as any,
        idempotencyKey: crypto.randomUUID(),
      })
    } catch (err: unknown) {
      setBanner(err instanceof Error ? err.message : 'Reject failed')
    }
  }

  return (
    <main>
      <header>
        <h1>Triage · {claims?.municipalityId ?? 'N/A'}</h1>
        <button onClick={() => void signOut()}>Sign out</button>
      </header>
      {banner && <div role="alert">{banner}</div>}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h2>Queue</h2>
          {loading ? (
            <p>Loading…</p>
          ) : error ? (
            <p role="alert">Error: {error}</p>
          ) : rows.length === 0 ? (
            <p>No active reports.</p>
          ) : (
            <ul>
              {rows.map((r) => (
                <li key={r.reportId}>
                  <button onClick={() => setSelected(r.reportId)}>
                    [{r.status}] {r.severityDerived} — {r.reportId.slice(0, 8)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selected && (
          <ReportDetailPanel
            reportId={selected}
            onVerify={handleVerify}
            onReject={handleReject}
            onDispatch={setDispatchForReportId}
          />
        )}
      </section>
      {dispatchForReportId && (
        <DispatchModal
          reportId={dispatchForReportId}
          onClose={() => setDispatchForReportId(null)}
          onError={(msg) => setBanner(msg)}
        />
      )}
    </main>
  )
}
```

- [ ] **Step 5: `callables.ts` typed wrappers**

```typescript
// apps/admin-desktop/src/services/callables.ts
import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'

type IdempotencyKey = string

export const callables = {
  verifyReport: (payload: { reportId: string; idempotencyKey: IdempotencyKey }) =>
    httpsCallable<typeof payload, { status: string; reportId: string }>(
      functions,
      'verifyReport',
    )(payload).then((r) => r.data),
  rejectReport: (payload: {
    reportId: string
    reason: 'obviously_false' | 'duplicate' | 'test_submission' | 'insufficient_detail'
    notes?: string
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { status: string; reportId: string }>(
      functions,
      'rejectReport',
    )(payload).then((r) => r.data),
  dispatchResponder: (payload: {
    reportId: string
    responderUid: string
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { dispatchId: string; status: string; reportId: string }>(
      functions,
      'dispatchResponder',
    )(payload).then((r) => r.data),
  cancelDispatch: (payload: {
    dispatchId: string
    reason: 'responder_unavailable' | 'duplicate_report' | 'admin_error' | 'citizen_withdrew'
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { status: string; dispatchId: string }>(
      functions,
      'cancelDispatch',
    )(payload).then((r) => r.data),
}
```

- [ ] **Step 6: Type-check**

```bash
pnpm --filter @bantayog/admin-desktop typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-desktop/src/hooks \
        apps/admin-desktop/src/pages/ReportDetailPanel.tsx \
        apps/admin-desktop/src/pages/TriageQueuePage.tsx \
        apps/admin-desktop/src/services/callables.ts
git commit -m "feat(admin-desktop): wire muni-scoped queue, detail panel, verify+reject actions"
```

---

### Task 17: `DispatchModal` + `useEligibleResponders`

**Files:**

- Create: `apps/admin-desktop/src/hooks/useEligibleResponders.ts`
- Create: `apps/admin-desktop/src/pages/DispatchModal.tsx`

Phase 3 fidelity per spec §5.6 step 2: **name + agency only**. No map pin, no distance.

- [ ] **Step 1: Hook**

```typescript
// apps/admin-desktop/src/hooks/useEligibleResponders.ts
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../app/firebase'
import { getDatabase, ref, onValue } from 'firebase/database'
import { firebaseApp } from '../app/firebase'

export interface EligibleResponder {
  uid: string
  displayName: string
  agencyId: string
}

export function useEligibleResponders(municipalityId: string | undefined) {
  const [responders, setResponders] = useState<Record<string, EligibleResponder>>({})
  const [shift, setShift] = useState<Record<string, { isOnShift: boolean }>>({})

  useEffect(() => {
    if (!municipalityId) return
    const q = query(
      collection(db, 'responders'),
      where('municipalityId', '==', municipalityId),
      where('isActive', '==', true),
    )
    return onSnapshot(q, (snap) => {
      const out: Record<string, EligibleResponder> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        out[d.id] = {
          uid: d.id,
          displayName: String(data.displayName ?? d.id),
          agencyId: String(data.agencyId ?? 'unknown'),
        }
      })
      setResponders(out)
    })
  }, [municipalityId])

  useEffect(() => {
    if (!municipalityId) return
    const rtdb = getDatabase(firebaseApp)
    const node = ref(rtdb, `/responder_index/${municipalityId}`)
    const unsub = onValue(node, (s) => {
      setShift((s.val() as Record<string, { isOnShift: boolean }>) ?? {})
    })
    return unsub
  }, [municipalityId])

  const eligible = Object.values(responders)
    .filter((r) => shift[r.uid]?.isOnShift === true)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
  return eligible
}
```

- [ ] **Step 2: Modal**

```tsx
// apps/admin-desktop/src/pages/DispatchModal.tsx
import { useState } from 'react'
import { useAuth } from '../app/auth-provider'
import { useEligibleResponders } from '../hooks/useEligibleResponders'
import { callables } from '../services/callables'

export function DispatchModal({
  reportId,
  onClose,
  onError,
}: {
  reportId: string
  onClose: () => void
  onError: (msg: string) => void
}) {
  const { claims } = useAuth()
  const eligible = useEligibleResponders(claims?.municipalityId)
  const [picked, setPicked] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function confirm() {
    if (!picked) return
    setSubmitting(true)
    try {
      await callables.dispatchResponder({
        reportId,
        responderUid: picked,
        idempotencyKey: crypto.randomUUID(),
      })
      onClose()
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Dispatch failed')
      setSubmitting(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true">
      <h2>Dispatch a responder</h2>
      {eligible.length === 0 ? (
        <p>No responders on shift in your municipality.</p>
      ) : (
        <ul>
          {eligible.map((r) => (
            <li key={r.uid}>
              <label>
                <input
                  type="radio"
                  name="responder"
                  value={r.uid}
                  checked={picked === r.uid}
                  onChange={() => setPicked(r.uid)}
                />
                {r.displayName} · {r.agencyId}
              </label>
            </li>
          ))}
        </ul>
      )}
      <button disabled={!picked || submitting} onClick={() => void confirm()}>
        {submitting ? 'Dispatching…' : 'Confirm'}
      </button>
      <button onClick={onClose}>Cancel</button>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + smoke**

```bash
pnpm --filter @bantayog/admin-desktop typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-desktop/src/hooks/useEligibleResponders.ts \
        apps/admin-desktop/src/pages/DispatchModal.tsx
git commit -m "feat(admin-desktop): dispatch modal with responder picker (name + agency only)"
```

---

### Task 18: Admin-desktop smoke test in browser via emulator

- [ ] **Step 1: Start emulator and seed**

```bash
firebase emulators:start --only firestore,auth,functions,database &
# Wait ~10s
pnpm --filter @bantayog/functions exec tsx scripts/bootstrap-phase1.ts --emulator
pnpm --filter @bantayog/functions exec tsx scripts/phase-3b/bootstrap-test-responder.ts --emulator  # created in Task 21
```

- [ ] **Step 2: Run admin-desktop against emulator**

```bash
VITE_USE_EMULATOR=true VITE_FIREBASE_PROJECT_ID=bantayog-alert-dev pnpm --filter @bantayog/admin-desktop dev
```

- [ ] **Step 3: Manual smoke test**

1. Sign in with the seeded Daet admin account.
2. Write a test inbox item using `scripts/phase-3a/acceptance.ts` (or submit from citizen PWA).
3. Wait ~2s for materialization.
4. Confirm the report appears in the queue with status `new`.
5. Click **Verify** → status becomes `awaiting_verify`, panel refreshes.
6. Click **Verify** again → status becomes `verified`.
7. Click **Dispatch** → modal opens with the seeded test responder.
8. Confirm → modal closes, queue row flips to `assigned`.

Document results in a `docs/runbooks/phase-3b-verify-and-dispatch.md` transcript section.

- [ ] **Step 4: Commit runbook**

```bash
git add docs/runbooks/phase-3b-verify-and-dispatch.md
git commit -m "docs(runbooks): capture 3b admin verify + dispatch walkthrough"
```

---

## Group H — Responder PWA Read-Only View (Task 19)

3b lands only the read-only view of dispatches for testing that the dispatch is visible to the responder via `onSnapshot`. Accept/decline action + service worker + FCM registration land in 3c.

---

### Task 19: Scaffold responder-app with own-dispatches list

**Files:**

- Create: `apps/responder-app/src/app/firebase.ts` (parallel to admin-desktop)
- Create: `apps/responder-app/src/app/auth-provider.tsx` (same pattern, `role: 'responder'`)
- Create: `apps/responder-app/src/app/protected-route.tsx` (responder-role gate)
- Create: `apps/responder-app/src/hooks/useOwnDispatches.ts`
- Create: `apps/responder-app/src/pages/LoginPage.tsx`
- Create: `apps/responder-app/src/pages/DispatchListPage.tsx`
- Modify: `apps/responder-app/src/App.tsx`, `apps/responder-app/src/routes.tsx`

- [ ] **Step 1: Copy pattern from admin-desktop, swap role gate to `responder`**

Same shape as Tasks 15-16 but:

- `ProtectedRoute` requires `claims?.role === 'responder'` (not `municipal_admin`).
- No municipality gate — responders are municipality-scoped already via the `assignedTo.municipalityId` on the dispatch.

- [ ] **Step 2: Hook**

```typescript
// apps/responder-app/src/hooks/useOwnDispatches.ts
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface OwnDispatchRow {
  dispatchId: string
  reportId: string
  status: string
  dispatchedAt: Timestamp
  acknowledgementDeadlineAt?: Timestamp
}

export function useOwnDispatches(uid: string | undefined) {
  const [rows, setRows] = useState<OwnDispatchRow[]>([])
  useEffect(() => {
    if (!uid) return
    const q = query(
      collection(db, 'dispatches'),
      where('assignedTo.uid', '==', uid),
      where('status', 'in', ['pending', 'accepted', 'acknowledged', 'in_progress']),
      orderBy('dispatchedAt', 'desc'),
    )
    return onSnapshot(q, (snap) =>
      setRows(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            dispatchId: d.id,
            reportId: String(data.reportId),
            status: String(data.status),
            dispatchedAt: data.dispatchedAt as Timestamp,
            acknowledgementDeadlineAt: data.acknowledgementDeadlineAt as Timestamp | undefined,
          }
        }),
      ),
    )
  }, [uid])
  return rows
}
```

- [ ] **Step 3: `DispatchListPage`**

```tsx
// apps/responder-app/src/pages/DispatchListPage.tsx
import { useAuth } from '../app/auth-provider'
import { useOwnDispatches } from '../hooks/useOwnDispatches'

export function DispatchListPage() {
  const { user } = useAuth()
  const rows = useOwnDispatches(user?.uid)
  return (
    <main>
      <h1>Your dispatches</h1>
      {rows.length === 0 ? (
        <p>No active dispatches.</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.dispatchId}>
              <strong>{r.status}</strong> — report {r.reportId.slice(0, 8)}
              {r.acknowledgementDeadlineAt && (
                <small> · ack by {r.acknowledgementDeadlineAt.toDate().toLocaleTimeString()}</small>
              )}
            </li>
          ))}
        </ul>
      )}
      <p>
        <em>Accept/Decline actions land in Phase 3c.</em>
      </p>
    </main>
  )
}
```

- [ ] **Step 4: Firestore index check**

The `dispatches` query above needs: `assignedTo.uid ASC, status ASC, dispatchedAt DESC`. Check `infra/firebase/firestore.indexes.json`; if missing, add:

```json
{
  "collectionGroup": "dispatches",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "assignedTo.uid", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "dispatchedAt", "order": "DESCENDING" }
  ]
}
```

- [ ] **Step 5: Typecheck + emulator smoke**

```bash
pnpm --filter @bantayog/responder-app typecheck
VITE_USE_EMULATOR=true VITE_FIREBASE_PROJECT_ID=bantayog-alert-dev pnpm --filter @bantayog/responder-app dev
# Sign in as test responder; confirm dispatch from Task 18 appears
```

- [ ] **Step 6: Commit**

```bash
git add apps/responder-app/src \
        infra/firebase/firestore.indexes.json
git commit -m "feat(responder-app): read-only own-dispatches list for 3b visibility test"
```

---

## Group I — Monitoring, Acceptance, Docs (Tasks 20-22)

---

### Task 20: Extend monitoring with dispatch panel + alert

**Files:**

- Modify: `infra/terraform/modules/monitoring/phase-3/main.tf`

- [ ] **Step 1: Add dispatch.created log metric + dashboard panel**

```hcl
# infra/terraform/modules/monitoring/phase-3/main.tf — append

resource "google_logging_metric" "dispatch_created" {
  name        = "${var.env}-bantayog-dispatch-created"
  description = "Count of dispatches created via dispatchResponder"
  filter      = "resource.type=\"cloud_function\" AND jsonPayload.event=\"dispatch.created\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    labels {
      key         = "municipality_id"
      value_type  = "STRING"
      description = "Municipality the dispatch was created in"
    }
  }
  label_extractors = {
    "municipality_id" = "EXTRACT(jsonPayload.municipalityId)"
  }
}

# Add to existing dashboard resource in the same file:
# gridLayout.widgets[] insertion — a single scorecard + time-series.
# If the dashboard JSON is already defined, insert a third tile:
# {
#   title = "Dispatch rate (5 min)"
#   xyChart = {
#     dataSets = [{
#       timeSeriesQuery = {
#         timeSeriesFilter = {
#           filter = "metric.type=\"logging.googleapis.com/user/${var.env}-bantayog-dispatch-created\""
#           aggregation = { alignmentPeriod = "300s", perSeriesAligner = "ALIGN_SUM" }
#         }
#       }
#     }]
#   }
# }
# (Keep the existing inbox-backlog, error-rate, fcm-failure tiles from Phase 3a.)
```

- [ ] **Step 2: Terraform validate**

```bash
cd infra/terraform
terraform -chdir=environments/staging validate
terraform -chdir=environments/staging fmt -check
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add infra/terraform/modules/monitoring/phase-3/main.tf
git commit -m "feat(monitoring): add dispatch.created log metric and dashboard panel"
```

---

### Task 21: Staging bootstrap script for test responder

**Files:**

- Create: `scripts/phase-3b/bootstrap-test-responder.ts`

Idempotent: safe to re-run. Used by both the smoke test in Task 18 and the acceptance script in Task 22.

- [ ] **Step 1: Write the script**

```typescript
// scripts/phase-3b/bootstrap-test-responder.ts
import { initializeApp, cert, getApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getDatabase } from 'firebase-admin/database'

const EMU = process.argv.includes('--emulator')
if (EMU) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = 'localhost:9000'
}

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'bantayog-alert-dev'

if (getApps().length === 0) {
  initializeApp({
    projectId: PROJECT_ID,
    databaseURL: EMU
      ? `http://localhost:9000?ns=${PROJECT_ID}`
      : `https://${PROJECT_ID}.asia-southeast1.firebasedatabase.app`,
  })
}

const TEST_RESPONDER = {
  uid: 'bfp-responder-test-01',
  email: 'bfp-responder-test-01@bantayog.test',
  password: 'Test1234!',
  displayName: 'BFP Test Responder 01',
  agencyId: 'bfp-daet',
  municipalityId: 'daet',
}

async function main() {
  const auth = getAuth(getApp())
  const db = getFirestore(getApp())
  const rtdb = getDatabase(getApp())

  try {
    await auth.createUser({
      uid: TEST_RESPONDER.uid,
      email: TEST_RESPONDER.email,
      password: TEST_RESPONDER.password,
      emailVerified: true,
      displayName: TEST_RESPONDER.displayName,
    })
    console.log('[bootstrap] created auth user')
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('already')) {
      console.log('[bootstrap] auth user already exists')
    } else {
      throw err
    }
  }

  await auth.setCustomUserClaims(TEST_RESPONDER.uid, {
    role: 'responder',
    municipalityId: TEST_RESPONDER.municipalityId,
    agencyId: TEST_RESPONDER.agencyId,
    active: true,
  })
  console.log('[bootstrap] claims set')

  await db.collection('responders').doc(TEST_RESPONDER.uid).set(
    {
      uid: TEST_RESPONDER.uid,
      displayName: TEST_RESPONDER.displayName,
      agencyId: TEST_RESPONDER.agencyId,
      municipalityId: TEST_RESPONDER.municipalityId,
      isActive: true,
      fcmTokens: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      schemaVersion: 1,
    },
    { merge: true },
  )

  await rtdb.ref(`/responder_index/${TEST_RESPONDER.municipalityId}/${TEST_RESPONDER.uid}`).set({
    isOnShift: true,
    updatedAt: Date.now(),
  })

  console.log(`[bootstrap] done — responder uid=${TEST_RESPONDER.uid}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Run against emulator**

```bash
firebase emulators:start --only firestore,auth,database &
sleep 10
pnpm exec tsx scripts/phase-3b/bootstrap-test-responder.ts --emulator
```

Expected: success log lines, responder visible in Firestore emulator UI.

- [ ] **Step 3: Commit**

```bash
git add scripts/phase-3b/bootstrap-test-responder.ts
git commit -m "chore(scripts): add idempotent bootstrap for phase-3b test responder"
```

---

### Task 22: Phase 3b acceptance script

**Files:**

- Create: `scripts/phase-3b/acceptance.ts`

Binary pass/fail. Emits structured JSON for CI parsing. Runs against emulator by default; `--env=staging` flag runs against staging with Secret Manager credentials.

- [ ] **Step 1: Write the script**

```typescript
// scripts/phase-3b/acceptance.ts
import { initializeApp, cert, getApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getFunctions } from 'firebase-admin/functions'
import {
  httpsCallable,
  getFunctions as webGetFunctions,
  connectFunctionsEmulator,
} from 'firebase/functions'
import { initializeApp as webInitApp } from 'firebase/app'
import { getAuth as webGetAuth, signInWithCustomToken, connectAuthEmulator } from 'firebase/auth'

type Report = { passed: boolean; assertions: Array<{ name: string; ok: boolean; detail?: string }> }

const EMU = !process.argv.includes('--env=staging')
if (EMU) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = 'localhost:9000'
}

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'bantayog-alert-dev'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}

const adminAuth = getAuth(getApp())
const adminDb = getFirestore(getApp())

const report: Report = { passed: true, assertions: [] }
function check(name: string, ok: boolean, detail?: string) {
  report.assertions.push({ name, ok, detail })
  if (!ok) report.passed = false
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const reportId = adminDb.collection('reports').doc().id
  const now = new Date()

  // Prereq: seed a verified report + bootstrap responder must have run first.
  await adminDb.collection('reports').doc(reportId).set({
    reportId,
    status: 'verified',
    municipalityId: 'daet',
    municipalityLabel: 'Daet',
    source: 'citizen_pwa',
    severityDerived: 'medium',
    correlationId: crypto.randomUUID(),
    createdAt: now,
    lastStatusAt: now,
    lastStatusBy: 'system:acceptance-seed',
    schemaVersion: 1,
  })
  await adminDb
    .collection('report_private')
    .doc(reportId)
    .set({
      reportId,
      reporterUid: 'cit-acceptance-01',
      rawDescription: 'seed',
      coordinatesPrecise: { lat: 14.1134, lng: 122.9554 },
      schemaVersion: 1,
    })
  await adminDb.collection('report_ops').doc(reportId).set({
    reportId,
    verifyQueuePriority: 0,
    assignedMunicipalityAdmins: [],
    schemaVersion: 1,
  })
  check('Seeded verified report', true, reportId)

  // Mint a custom token for the seeded admin.
  const adminUid = 'daet-admin-test-01'
  await adminAuth.setCustomUserClaims(adminUid, {
    role: 'municipal_admin',
    municipalityId: 'daet',
    active: true,
  })
  const customToken = await adminAuth.createCustomToken(adminUid)

  const webApp = webInitApp(
    {
      apiKey: 'emulator-or-staging',
      projectId: PROJECT_ID,
      authDomain: `${PROJECT_ID}.firebaseapp.com`,
    },
    'acceptance',
  )
  const webAuth = webGetAuth(webApp)
  if (EMU) connectAuthEmulator(webAuth, 'http://localhost:9099', { disableWarnings: true })
  const functions = webGetFunctions(webApp, 'asia-southeast1')
  if (EMU) connectFunctionsEmulator(functions, 'localhost', 5001)

  await signInWithCustomToken(webAuth, customToken)

  const verifyReport = httpsCallable(functions, 'verifyReport')
  const dispatchResponder = httpsCallable(functions, 'dispatchResponder')

  // Step 1: verifyReport twice on a `verified` seed — first call should FAILED_PRECONDITION.
  // That matches the branch table. We instead seed a fresh `new` report for the double-verify.
  const reportIdNew = adminDb.collection('reports').doc().id
  await adminDb.collection('reports').doc(reportIdNew).set({
    reportId: reportIdNew,
    status: 'new',
    municipalityId: 'daet',
    municipalityLabel: 'Daet',
    source: 'citizen_pwa',
    severityDerived: 'medium',
    correlationId: crypto.randomUUID(),
    createdAt: now,
    lastStatusAt: now,
    lastStatusBy: 'system:acceptance-seed',
    schemaVersion: 1,
  })
  await adminDb.collection('report_ops').doc(reportIdNew).set({
    reportId: reportIdNew,
    verifyQueuePriority: 0,
    assignedMunicipalityAdmins: [],
    schemaVersion: 1,
  })
  await adminDb
    .collection('report_private')
    .doc(reportIdNew)
    .set({
      reportId: reportIdNew,
      reporterUid: 'cit-acceptance-01',
      rawDescription: 'seed',
      coordinatesPrecise: { lat: 14.1134, lng: 122.9554 },
      schemaVersion: 1,
    })

  try {
    const r1 = await verifyReport({ reportId: reportIdNew, idempotencyKey: crypto.randomUUID() })
    check('verifyReport new → awaiting_verify', (r1.data as any).status === 'awaiting_verify')
    const r2 = await verifyReport({ reportId: reportIdNew, idempotencyKey: crypto.randomUUID() })
    check('verifyReport awaiting_verify → verified', (r2.data as any).status === 'verified')
  } catch (err: unknown) {
    check('verifyReport two-branch', false, err instanceof Error ? err.message : String(err))
  }

  // Step 2: dispatchResponder on the originally-seeded verified report.
  try {
    const d = await dispatchResponder({
      reportId,
      responderUid: 'bfp-responder-test-01',
      idempotencyKey: crypto.randomUUID(),
    })
    const dispatchId = (d.data as any).dispatchId
    check('dispatchResponder created pending', (d.data as any).status === 'pending')
    const dispatchSnap = await adminDb.collection('dispatches').doc(dispatchId).get()
    check('dispatches doc exists', dispatchSnap.exists, dispatchId)
    const reportSnap = await adminDb.collection('reports').doc(reportId).get()
    check('report.status == assigned', reportSnap.data()?.status === 'assigned')
  } catch (err: unknown) {
    check('dispatchResponder', false, err instanceof Error ? err.message : String(err))
  }

  // Step 3: cross-muni negatives — mint a Mercedes admin, try to verify a Daet report.
  const wrongAdminUid = 'mercedes-admin-test-01'
  await adminAuth.setCustomUserClaims(wrongAdminUid, {
    role: 'municipal_admin',
    municipalityId: 'mercedes',
    active: true,
  })
  const wrongToken = await adminAuth.createCustomToken(wrongAdminUid)
  await signInWithCustomToken(webAuth, wrongToken)
  try {
    await verifyReport({ reportId, idempotencyKey: crypto.randomUUID() })
    check('cross-muni verifyReport rejected', false, 'should have thrown')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    check('cross-muni verifyReport rejected', msg.includes('permission-denied'), msg)
  }

  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
```

- [ ] **Step 2: Run against emulator**

```bash
firebase emulators:exec --only firestore,auth,functions,database \
  "pnpm exec tsx scripts/phase-3b/bootstrap-test-responder.ts --emulator && \
   pnpm exec tsx scripts/phase-3b/acceptance.ts"
```

Expected: all checks green, exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/phase-3b/acceptance.ts
git commit -m "feat(scripts): phase-3b acceptance gate covering verify+dispatch+cross-muni"
```

---

## Group J — Docs and Exit (Task 23)

---

### Task 23: Update rule-coverage gate and progress docs

**Files:**

- Modify: `scripts/check-rule-coverage.ts`
- Modify: `docs/progress.md`
- Create/Modify: `docs/learnings.md` (only if new patterns emerged)

- [ ] **Step 1: Extend rule-coverage set**

Append `dispatches`, `dispatch_events`, `moderation_incidents` to the explicit check list. They were already covered in Phase 2 but the coverage script should name them as required for Phase 3b to prevent regressions.

```typescript
// scripts/check-rule-coverage.ts — add to REQUIRED_COLLECTIONS
const PHASE_3B_COLLECTIONS = ['dispatches', 'dispatch_events', 'moderation_incidents'] as const
```

Ensure positive + negative tests exist for each. Re-run the script:

```bash
pnpm exec tsx scripts/check-rule-coverage.ts
```

Expected: PASS.

- [ ] **Step 2: Progress doc**

Append a "Phase 3b — Admin Triage + Dispatch" section to `docs/progress.md` with the verification table:

```markdown
## Phase 3b Admin Triage + Dispatch (Complete)

**Branch:** `feature/phase-3b-admin-triage-dispatch`
**Plan:** See `docs/superpowers/plans/2026-04-18-phase-3b-admin-triage-dispatch.md`

### Verification

| Step | Check                                                                    | Result  |
| ---- | ------------------------------------------------------------------------ | ------- |
| 1    | `pnpm lint && pnpm typecheck`                                            | PASS    |
| 2    | `pnpm test` (incl. new 3b callable + rules tests)                        | PASS    |
| 3    | `firebase emulators:exec "pnpm exec tsx scripts/phase-3b/acceptance.ts"` | PASS    |
| 4    | Staging acceptance                                                       | PENDING |
| 5    | Manual smoke: admin verify + dispatch, responder sees onSnapshot         | PASS    |

### Known open items carrying into 3c

- `cancelDispatch` widened from pending-only → accepted/acknowledged/in_progress
- FCM push on dispatch.created (currently warning-only placeholder)
- Responder accept + status progression
```

- [ ] **Step 3: Commit**

```bash
git add scripts/check-rule-coverage.ts docs/progress.md
git commit -m "docs(phase-3b): update rule-coverage gate and progress tracker"
```

---

## End-of-Phase Gate Checklist (run before merging 3b → main)

- [ ] All 23 tasks above committed
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green locally
- [ ] Rules-drift CI gate green (from 3a)
- [ ] Rule-coverage gate extended and green
- [ ] `scripts/phase-3b/acceptance.ts` green on emulator
- [ ] `scripts/phase-3b/acceptance.ts` green on staging (after the overnight-soak pattern per `docs/learnings.md`)
- [ ] Dashboard panel for `dispatch.created` visible in staging Cloud Monitoring
- [ ] Admin desktop smoke-test runbook checked in
- [ ] `docs/progress.md` updated
- [ ] PR description includes Firebase rules rollback command (no changes expected, but: `firebase deploy --only firestore:rules --project bantayog-alert-staging -- <prev-sha>`)

---

## Appendix — Risks and Notes

**Risk: `currentDispatchId` drift.** The `dispatchResponder` callable sets `reports.currentDispatchId`, and `cancelDispatch` clears it. If a future callable creates a second dispatch without cleaning up the first, `currentDispatchId` points to a stale dispatch. Phase 3b ships single-dispatch-per-report only; Phase 5 duplicate-cluster + re-dispatch will need a `currentDispatchId`-aware revision.

**Risk: RTDB `/responder_index` shift data is not in the Firestore transaction.** The pre-tx read of shift state creates a TOCTOU window: responder goes off-shift between the read and the transaction commit. Acceptable for Phase 3 — the responder UI at dispatch time is municipality-scoped and the window is sub-second. Phase 6 considers whether shift state should move into Firestore for transactional consistency.

**Risk: `verifyReport` two-branch UX.** A tired admin at 2 AM clicks **Verify** once, sees `awaiting_verify`, thinks "nothing happened," clicks again. The second click advances to `verified`. The current UI label switches to "Verify" after the first click — the runbook in Task 18 must explicitly document this two-click pattern.

**Note: Idempotency keys in the admin UI.** The admin-desktop wrappers in `services/callables.ts` use `crypto.randomUUID()` per call. This is correct: a new click is a new intent. The 30-second client memory of keys described in the spec §6.6 is for rapid-fire retries within the same action, not for every click.

**Forward-compat hooks preserved:**

- `cancelDispatch` allowlist is a single constant that 3c extends.
- `useEligibleResponders` returns `{uid, displayName, agencyId}` — the Phase 6 enrichment adds `lastKnownLocation`, `distanceKm`, `etaSec` without changing the callable or Firestore contract.
- The dispatch-modal radio-group is trivially swappable for a map view when Phase 6 lands.

---

**End of Phase 3b Implementation Plan**
