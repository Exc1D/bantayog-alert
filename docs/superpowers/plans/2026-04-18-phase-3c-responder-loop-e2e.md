# Phase 3c Implementation Plan: Responder Loop + E2E

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the third and final sub-phase of Phase 3 — the responder receives an FCM push on a new dispatch, accepts it race-safely, progresses through `acknowledged → en_route → on_scene → resolved`, the mirror trigger advances the linked `reports.status` in lockstep, the admin closes the report, and the full loop passes Playwright in staging on three consecutive runs. Race-loss recovery (admin cancels mid-progress, responder's next write is rejected, UI renders a "cancelled by Daet MDRRMO" screen) is wired and tested end-to-end.

**Architecture:** Three new callables (`acceptDispatch`, `closeReport`, plus widening `cancelDispatch` to cover mid-lifecycle states); one new Firestore trigger (`dispatchMirrorToReport`) that is the single writer for `reports.status` changes driven by responder actions; rule-gated direct writes on `dispatches/{id}` for the four responder status transitions after `accepted`; FCM web-push pipeline with a service worker + VAPID keypair from Secret Manager; Admin Desktop gets a Close-Report modal and a widened Cancel-Dispatch modal; Responder PWA gets Accept/progression UI and a CancelledScreen. A fresh `apps/e2e-tests/` workspace package runs Playwright 1.47+ against the emulator on every PR and against staging on release-candidate tags.

**Tech Stack:** TypeScript strict, Zod, Firebase Functions v2 (Node 20), Firebase Admin SDK, Firebase Cloud Messaging (Web), service-worker-based background push, React + Vite, `@firebase/rules-unit-testing`, Vitest, Playwright 1.47+, Terraform for monitoring extensions.

**Phase 3 design spec:** `docs/superpowers/specs/2026-04-18-phase-3-design.md`

**Exit milestone:** `scripts/phase-3c/acceptance.ts` passes in staging on three consecutive runs; Playwright full-loop passes in staging on three consecutive runs; race-loss recovery demonstrated under Playwright; every item in Phase 3 exit checklist (spec §10) is green. Phase 3 closes; `main` is tagged `phase-3-complete`.

---

## Preconditions

- Phase 3b complete — `scripts/phase-3b/acceptance.ts` green in staging; admin can verify + dispatch; cross-muni negatives enforced; responder sees dispatch via `onSnapshot` (no FCM yet); `cancelDispatch` wired for `pending` only; `dispatches/{id}` is already rule-gated for admin read + callable-only write.
- The staging test accounts from 3b are still valid: `citizen-test-01`, `daet-admin-test-01`, `bfp-responder-test-01`. Responder has `responders/{uid}` with `isActive: true` and `fcmTokens: []` (empty until this phase registers the token).
- `system_config/features/dispatch_mirror_enabled: true` is pre-seeded in staging (it is read by the new mirror trigger as a safety valve; defaults true but lets us flip off if a regression escapes).
- A staging VAPID keypair is provisioned in Secret Manager (`projects/bantayog-alert-staging/secrets/fcm-vapid-public-key` and `...-private-key`). If missing, Task 21 Step 1 provisions it before any FCM code ships.
- Branch `feature/phase-3c-responder-loop-e2e` cut from `main` after the 3b merge. All 3c commits land on this branch.

---

## File Structure (3c)

### New files

```
packages/shared-validators/src/state-machines/
  dispatch-to-report.ts           # Pure helper: dispatchToReportState(DispatchStatus) → ReportStatus | null
  __tests__/
    dispatch-to-report.test.ts    # Exhaustive 9-state matrix

functions/src/
  callables/
    accept-dispatch.ts            # acceptDispatch callable (race-safe via from-state guard)
    close-report.ts               # closeReport callable (resolved → closed)
  triggers/
    dispatch-mirror-to-report.ts  # onWrite(dispatches/{id}) — single writer of reports.status from responder actions
  services/
    fcm-send.ts                   # Shared FCM helper: send with retry, token cleanup, warning surfacing
  __tests__/
    callables/
      accept-dispatch.test.ts
      close-report.test.ts
    triggers/
      dispatch-mirror-to-report.test.ts
    services/
      fcm-send.test.ts
    rules/
      responder-direct-writes.rules.test.ts   # Rule-gated dispatch status transitions by responder
      dispatch-mirror.rules.test.ts           # System-only reports.status updates admitted; direct responder writes denied

apps/responder-app/src/
  pages/
    DispatchDetailPage.tsx        # Accept + progress + CancelledScreen
    CancelledScreen.tsx           # Rendered when dispatch.status == cancelled
  hooks/
    useDispatch.ts                # onSnapshot single dispatch (reactive)
    useAcceptDispatch.ts          # Wrapper over acceptDispatch callable
    useAdvanceDispatch.ts         # Rule-gated direct update wrapper for acknowledged/en_route/on_scene/resolved
    useRegisterFcmToken.ts        # Browser-perm prompt, getToken, save onto responders/{uid}.fcmTokens
  services/
    fcm-client.ts                 # Firebase Messaging client init + getToken + onMessage foreground
  sw/
    firebase-messaging-sw.ts      # Service worker source: onBackgroundMessage → notification + click routing
    firebase-messaging-sw-register.ts  # Page-side SW registration + update handling

apps/admin-desktop/src/
  pages/
    CloseReportModal.tsx          # Confirm + closeReport callable
    CancelDispatchModal.tsx       # Widened — includes reason + from-state awareness

apps/e2e-tests/
  package.json
  playwright.config.ts
  specs/
    citizen.spec.ts
    admin.spec.ts
    responder.spec.ts
    full-loop.spec.ts
    race-loss.spec.ts
  fixtures/
    test-accounts.ts              # Pre-provisioned account helpers
    emulator-setup.ts             # One-time emulator reset + seed per run
    fcm-mock.ts                   # Service-worker injection for emulator runs (no real VAPID)

scripts/
  phase-3c/
    acceptance.ts                 # Phase-exit gate covering accept → resolved → close + race-loss
    provision-vapid.md            # Runbook (docs-only) for rotating VAPID keypair; see Task 21

infra/terraform/modules/monitoring/phase-3/
  fcm-metrics.tf                  # fcm.sent, fcm.failed, fcm.no_token log metrics + dashboard panel
  mirror-metrics.tf               # dispatch_mirror.drift alerts

docs/runbooks/
  phase-3c-responder-loop.md      # Operator runbook: what to check when a dispatch doesn't progress
  fcm-vapid-rotation.md           # Rotation procedure for the VAPID keypair
```

### Modified files

```
packages/shared-validators/src/
  dispatches.ts                   # Extend dispatchStatusSchema with en_route + on_scene
  state-machines/dispatch-states.ts  # Extend DISPATCH_TRANSITIONS accordingly
  state-machines/index.ts         # Export dispatchToReportState

functions/src/
  index.ts                        # Register acceptDispatch, closeReport, dispatchMirrorToReport
  callables/cancel-dispatch.ts    # Widen from-state allowlist to include accepted/acknowledged/en_route/on_scene

infra/firebase/
  firestore.rules.template        # Responder direct-write rules for dispatches/{id}; deny non-system writes to reports.status for responder role

scripts/
  check-rule-coverage.ts          # Explicit entries for responder direct-write paths

apps/responder-app/src/
  App.tsx                         # Route: /dispatches/:id → DispatchDetailPage
  pages/DispatchListPage.tsx      # Linkify rows to detail page (3b shipped read-only; 3c makes them navigable)

apps/admin-desktop/src/
  pages/TriageQueuePage.tsx       # Close button visible when reports.status == resolved
  pages/DispatchModal.tsx         # Surface FCM warnings array as a non-blocking banner (spec §6.5)

docs/progress.md                  # Phase 3c + Phase 3 exit section
docs/learnings.md                 # Append new patterns (expected: FCM SW pitfalls, race-loss test pattern)
```

### Deleted files

None.

---

## Group A — Dispatch State Extension and Report Translation (Tasks 1–3)

The spec (§5.8) describes responder UX states `en_route` and `on_scene`, but the current `dispatchStatusSchema` in `packages/shared-validators/src/dispatches.ts` only has 9 states without them. 3c's first commits extend the state machine so dispatch and report states align 1:1, which collapses the mirror trigger into an identity-map function. This is the safest refactor because it keeps a single source of truth (the transition table) honest instead of coding around a mismatch.

---

### Task 1: Extend `dispatchStatusSchema` with `en_route` + `on_scene`

**Files:**

- Modify: `packages/shared-validators/src/dispatches.ts`

- [ ] **Step 1: Write the failing test first**

Add a test case to the existing `packages/shared-validators/src/__tests__/dispatches.test.ts`:

```typescript
it('admits en_route and on_scene as valid dispatch statuses', () => {
  expect(dispatchStatusSchema.parse('en_route')).toBe('en_route')
  expect(dispatchStatusSchema.parse('on_scene')).toBe('on_scene')
})
```

Run `pnpm --filter @bantayog/shared-validators test` — expect a red: `Invalid enum value` on both.

- [ ] **Step 2: Extend the enum**

In `packages/shared-validators/src/dispatches.ts`, widen the Zod enum:

```typescript
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
])
export type DispatchStatus = z.infer<typeof dispatchStatusSchema>
```

Re-run: expect green.

- [ ] **Step 3: Commit**

```bash
git add packages/shared-validators/src/dispatches.ts \
        packages/shared-validators/src/__tests__/dispatches.test.ts
git commit -m "feat(shared-validators): extend DispatchStatus with en_route and on_scene"
```

---

### Task 2: Extend `DISPATCH_TRANSITIONS` to the full 11-state graph

**Files:**

- Modify: `packages/shared-validators/src/state-machines/dispatch-states.ts`
- Modify: `packages/shared-validators/src/state-machines/__tests__/dispatch-states.test.ts`

- [ ] **Step 1: Add the failing transition tests**

```typescript
describe('DISPATCH_TRANSITIONS — 3c additions', () => {
  it('allows acknowledged → en_route', () => {
    expect(isValidDispatchTransition('acknowledged', 'en_route')).toBe(true)
  })
  it('allows en_route → on_scene', () => {
    expect(isValidDispatchTransition('en_route', 'on_scene')).toBe(true)
  })
  it('allows on_scene → resolved', () => {
    expect(isValidDispatchTransition('on_scene', 'resolved')).toBe(true)
  })
  it('denies en_route → resolved (must pass through on_scene)', () => {
    expect(isValidDispatchTransition('en_route', 'resolved')).toBe(false)
  })
  it('admin can cancel from accepted/acknowledged/en_route/on_scene', () => {
    for (const from of ['accepted', 'acknowledged', 'en_route', 'on_scene'] as const) {
      expect(isValidDispatchTransition(from, 'cancelled')).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Extend the transition table**

```typescript
export const DISPATCH_TRANSITIONS: Readonly<Record<DispatchStatus, readonly DispatchStatus[]>> = {
  pending: ['accepted', 'declined', 'cancelled', 'timed_out', 'superseded'],
  accepted: ['acknowledged', 'cancelled', 'superseded'],
  acknowledged: ['en_route', 'cancelled', 'superseded'],
  en_route: ['on_scene', 'cancelled', 'superseded'],
  on_scene: ['resolved', 'cancelled', 'superseded'],
  resolved: [],
  declined: [],
  timed_out: [],
  cancelled: [],
  superseded: [],
}
```

Run tests: expect green.

- [ ] **Step 3: Regenerate rules and commit**

```bash
pnpm exec tsx scripts/build-rules.ts
git add packages/shared-validators/src/state-machines/dispatch-states.ts \
        packages/shared-validators/src/state-machines/__tests__/dispatch-states.test.ts \
        infra/firebase/firestore.rules
git commit -m "feat(state-machines): extend dispatch transitions for en_route/on_scene"
```

The rules-drift CI gate from 3a catches any forgotten regeneration on subsequent commits.

---

### Task 3: Add `dispatchToReportState` pure helper

**Rationale.** The mirror trigger must not embed translation logic inline; one place, one table. The helper returns `null` for dispatch states that should not touch `reports.status` (e.g., `pending`, `declined`, `timed_out`, `superseded`).

**Files:**

- Create: `packages/shared-validators/src/state-machines/dispatch-to-report.ts`
- Create: `packages/shared-validators/src/state-machines/__tests__/dispatch-to-report.test.ts`
- Modify: `packages/shared-validators/src/state-machines/index.ts`

- [ ] **Step 1: Write the failing test matrix first**

```typescript
import { describe, expect, it } from 'vitest'
import { dispatchToReportState } from '../dispatch-to-report.js'
import type { DispatchStatus } from '../../dispatches.js'

describe('dispatchToReportState', () => {
  const cases: Array<[DispatchStatus, ReturnType<typeof dispatchToReportState>]> = [
    ['pending', null],
    ['accepted', 'acknowledged'],
    ['acknowledged', 'acknowledged'],
    ['en_route', 'en_route'],
    ['on_scene', 'on_scene'],
    ['resolved', 'resolved'],
    ['declined', null],
    ['timed_out', null],
    ['cancelled', null],
    ['superseded', null],
  ]
  it.each(cases)('maps %s → %s', (from, expected) => {
    expect(dispatchToReportState(from)).toBe(expected)
  })
})
```

`cancelled` intentionally returns `null` — the `cancelDispatch` callable writes `reports.status` itself (transactionally, same as 3b for pending cancel), so the mirror trigger does not double-write on cancel.

- [ ] **Step 2: Implement**

```typescript
import type { DispatchStatus } from '../dispatches.js'
import type { ReportStatus } from '../reports.js'

export function dispatchToReportState(status: DispatchStatus): ReportStatus | null {
  switch (status) {
    case 'accepted':
    case 'acknowledged':
      return 'acknowledged'
    case 'en_route':
      return 'en_route'
    case 'on_scene':
      return 'on_scene'
    case 'resolved':
      return 'resolved'
    default:
      return null
  }
}
```

- [ ] **Step 3: Export + commit**

```typescript
// packages/shared-validators/src/state-machines/index.ts
export { dispatchToReportState } from './dispatch-to-report.js'
```

```bash
git add packages/shared-validators/src/state-machines/dispatch-to-report.ts \
        packages/shared-validators/src/state-machines/__tests__/dispatch-to-report.test.ts \
        packages/shared-validators/src/state-machines/index.ts
git commit -m "feat(state-machines): add dispatchToReportState translation helper"
```

---

## Group B — `acceptDispatch` Callable (Tasks 4–6)

Race-safety is non-negotiable here (spec §6.4). The callable must read `dispatches/{id}` fresh inside the transaction, verify `status == 'pending'` AND `assignedTo.uid == caller.uid`, and fail with `ALREADY_EXISTS` on mismatch. The mismatch case covers both "another responder won" (impossible today given single-responder dispatch, but admits Phase 5 duplicate handling) and "admin cancelled before I tapped accept" (real and frequent).

---

### Task 4: Zod request schema + unit tests (no Firebase)

**Files:**

- Create: `functions/src/callables/__tests__/accept-dispatch.unit.test.ts`
- Scaffold: `functions/src/callables/accept-dispatch.ts` with just the request schema + exported `AcceptDispatchRequest` type

- [ ] **Step 1: Write the failing schema test**

```typescript
import { describe, it, expect } from 'vitest'
import { acceptDispatchRequestSchema } from '../accept-dispatch.js'

describe('acceptDispatchRequestSchema', () => {
  it('accepts a well-formed request', () => {
    expect(
      acceptDispatchRequestSchema.parse({
        dispatchId: 'disp-abc-123',
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({
      dispatchId: 'disp-abc-123',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    })
  })
  it('rejects empty dispatchId', () => {
    expect(() =>
      acceptDispatchRequestSchema.parse({ dispatchId: '', idempotencyKey: crypto.randomUUID() }),
    ).toThrow()
  })
  it('rejects non-UUID idempotencyKey', () => {
    expect(() =>
      acceptDispatchRequestSchema.parse({ dispatchId: 'd', idempotencyKey: 'not-a-uuid' }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Implement the schema only**

```typescript
// functions/src/callables/accept-dispatch.ts
import { z } from 'zod'

export const acceptDispatchRequestSchema = z.object({
  dispatchId: z.string().min(1).max(128),
  idempotencyKey: z.string().uuid(),
})
export type AcceptDispatchRequest = z.infer<typeof acceptDispatchRequestSchema>
```

- [ ] **Step 3: Commit**

```bash
git add functions/src/callables/accept-dispatch.ts \
        functions/src/callables/__tests__/accept-dispatch.unit.test.ts
git commit -m "feat(functions): scaffold acceptDispatch request schema"
```

---

### Task 5: `acceptDispatch` callable implementation with race-safe transaction

**Files:**

- Modify: `functions/src/callables/accept-dispatch.ts`
- Create: `functions/src/callables/__tests__/accept-dispatch.test.ts` (integration: emulator-backed)

- [ ] **Step 1: Write the failing integration tests first**

Use the Phase 2 emulator harness pattern (`initializeTestEnvironment`, `seedActiveAccount`, `seedResponder`, `seedDispatch`).

```typescript
describe('acceptDispatch callable', () => {
  it('transitions a pending dispatch to accepted for the assigned responder', async () => {
    const { responderUid, dispatchId } = await seedPendingDispatchForResponder()
    const result = await callAcceptDispatch(responderUid, { dispatchId, idempotencyKey: uuid() })
    expect(result.data.status).toBe('accepted')
    const snap = await adminDb.collection('dispatches').doc(dispatchId).get()
    expect(snap.data()?.status).toBe('accepted')
    const events = await adminDb
      .collection('dispatch_events')
      .where('dispatchId', '==', dispatchId)
      .get()
    expect(events.docs.map((d) => d.data().to)).toContain('accepted')
  })

  it('denies when caller is not the assigned responder', async () => {
    const { dispatchId } = await seedPendingDispatchForResponder()
    const otherResponder = await seedActiveAccount({ role: 'responder' })
    await expect(
      callAcceptDispatch(otherResponder.uid, { dispatchId, idempotencyKey: uuid() }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('returns ALREADY_EXISTS when dispatch is no longer pending', async () => {
    const { responderUid, dispatchId } = await seedCancelledDispatch()
    await expect(
      callAcceptDispatch(responderUid, { dispatchId, idempotencyKey: uuid() }),
    ).rejects.toMatchObject({ code: 'already-exists' })
  })

  it('is idempotent on same key', async () => {
    const { responderUid, dispatchId } = await seedPendingDispatchForResponder()
    const key = uuid()
    const first = await callAcceptDispatch(responderUid, { dispatchId, idempotencyKey: key })
    const second = await callAcceptDispatch(responderUid, { dispatchId, idempotencyKey: key })
    expect(second.data.idempotencyCacheHit).toBe(true)
    expect(second.data.status).toBe(first.data.status)
  })
})
```

- [ ] **Step 2: Implement the callable**

```typescript
// functions/src/callables/accept-dispatch.ts (full body)
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import {
  acceptDispatchRequestSchema,
  type AcceptDispatchRequest,
} from './accept-dispatch-schema.js' // (if split)
import { withIdempotency } from '../idempotency/guard.js'
import { requireActiveResponder } from '../auth/guards.js'

export const acceptDispatch = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true, timeoutSeconds: 10, minInstances: 1 },
  async (request) => {
    const caller = requireActiveResponder(request.auth) // throws UNAUTHENTICATED / PERMISSION_DENIED
    const payload: AcceptDispatchRequest = acceptDispatchRequestSchema.parse(request.data)
    const correlationId = crypto.randomUUID()

    const semanticKey = `${payload.dispatchId}::accept`
    return withIdempotency(
      { callable: 'acceptDispatch', semanticKey, clientKey: payload.idempotencyKey },
      async () => {
        const db = getFirestore()
        const dispatchRef = db.collection('dispatches').doc(payload.dispatchId)
        const eventsRef = db.collection('dispatch_events').doc()

        const result = await db.runTransaction(async (tx) => {
          const snap = await tx.get(dispatchRef)
          if (!snap.exists) {
            throw new HttpsError('not-found', 'dispatch_not_found')
          }
          const d = snap.data() as { status: string; assignedTo: { uid: string } }
          if (d.assignedTo.uid !== caller.uid) {
            throw new HttpsError('permission-denied', 'not_assigned_responder')
          }
          if (d.status !== 'pending') {
            throw new HttpsError('already-exists', `dispatch_state_is_${d.status}`)
          }
          tx.update(dispatchRef, {
            status: 'accepted',
            acceptedAt: FieldValue.serverTimestamp(),
            lastStatusAt: FieldValue.serverTimestamp(),
          })
          tx.create(eventsRef, {
            dispatchId: payload.dispatchId,
            from: 'pending',
            to: 'accepted',
            actorUid: caller.uid,
            actorRole: 'responder',
            at: FieldValue.serverTimestamp(),
            correlationId,
          })
          return { status: 'accepted' as const }
        })

        logger.info({ event: 'dispatch.accepted', correlationId, dispatchId: payload.dispatchId })
        return { ...result, correlationId }
      },
    )
  },
)
```

- [ ] **Step 3: Register in `functions/src/index.ts`**

```typescript
export { acceptDispatch } from './callables/accept-dispatch.js'
```

- [ ] **Step 4: Run tests + commit**

```bash
firebase emulators:exec --only firestore,auth,functions \
  "pnpm --filter @bantayog/functions test -- accept-dispatch"
```

Expect all four tests green.

```bash
git add functions/src/callables/accept-dispatch.ts \
        functions/src/callables/__tests__/accept-dispatch.test.ts \
        functions/src/index.ts
git commit -m "feat(functions): add acceptDispatch callable with race-safe from-state guard"
```

---

### Task 6: Add `acceptDispatch` rate limit wiring

**Files:**

- Modify: `functions/src/callables/accept-dispatch.ts` (invoke Phase 3b `rate-limit` service)
- Modify: `functions/src/__tests__/callables/accept-dispatch.test.ts` (add rate-limit test)

- [ ] **Step 1: Failing test — 31 accepts in one minute → RESOURCE_EXHAUSTED**

Spec §7.2: 30 / minute per responder.

- [ ] **Step 2: Wire `enforceRateLimit({ key: `accept::${caller.uid}`, limit: 30, windowSec: 60 })` before the transaction**

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(functions): enforce acceptDispatch rate limit (30/min per responder)"
```

---

## Group C — Widen `cancelDispatch` (Tasks 7–8)

In 3b, `cancelDispatch` was pending-only. In 3c, admin needs to cancel a dispatch at any pre-terminal state (accepted/acknowledged/en_route/on_scene). The widening is a pure change to the from-state allowlist constant plus new negative tests. Forward-compat: the allowlist is a single source of truth that Phase 5 re-dispatch will extend.

---

### Task 7: Widen the allowlist + transaction branching

**Files:**

- Modify: `functions/src/callables/cancel-dispatch.ts`
- Modify: `functions/src/callables/__tests__/cancel-dispatch.test.ts`

- [ ] **Step 1: Failing tests**

Four new cases, one per newly-allowed from-state. Each asserts:

- `dispatches/{id}.status == 'cancelled'`
- `dispatch_events` appended with `{from, to: 'cancelled', actorUid, reason}`
- `reports/{reportId}.status == 'verified'` (admin cancel returns the report to pre-dispatch triage state so another responder can be dispatched — spec §4.2 table confirms: the only admin action from `assigned` is cancel; the spec does not describe a re-dispatch UI in Phase 3, but the state-machine transition `assigned → verified` is implied by the cancel allowlist and is required for coherent queue behavior)

Explicitly verify the state rewind: after cancelling an accepted dispatch, `reports/{reportId}.status` goes from `acknowledged` (set by the mirror trigger when accepted committed) back to `verified`. Without this, the admin queue cannot show the report for re-dispatch.

- [ ] **Step 2: Widen the allowlist**

```typescript
const CANCELLABLE_FROM: ReadonlyArray<DispatchStatus> = [
  'pending',
  'accepted',
  'acknowledged',
  'en_route',
  'on_scene',
]
```

In the transaction: on cancel, in addition to writing `dispatches.status = 'cancelled'`, mirror `reports.status` back to `'verified'` when `reportRef` is the current dispatch for that report (`reports.currentDispatchId == dispatchId`). Emit two events (`dispatch_events` and `report_events`).

- [ ] **Step 3: Remove the stale "pending-only" comment and commit**

```bash
git commit -am "feat(functions): widen cancelDispatch to cover accepted through on_scene"
```

---

### Task 8: Negative test — cannot cancel a resolved dispatch

**Files:**

- Modify: `functions/src/callables/__tests__/cancel-dispatch.test.ts`

- [ ] **Step 1: Failing test**

Admin calls `cancelDispatch` on a `resolved` dispatch → `FAILED_PRECONDITION` with code `dispatch_state_not_cancellable`. This is a trivial assertion on the allowlist, but Phase 5's re-dispatch workflow will add `superseded` and the test is the tripwire.

- [ ] **Step 2: Commit**

```bash
git commit -am "test(functions): cancelDispatch rejects cancel on terminal states"
```

---

## Group D — `closeReport` Callable (Tasks 9–10)

The simplest new callable: `resolved → closed` on the report. Admin-only. Transactional with `report_events`. Phase 3 does not implement reopen, so the rule additionally denies all `update` to `reports/{id}` after status `closed` (this rule is already in Phase 2; 3c just adds a negative test to pin it).

---

### Task 9: Schema + unit tests

**Files:**

- Create: `functions/src/callables/close-report.ts` (schema + stub)
- Create: `functions/src/callables/__tests__/close-report.unit.test.ts`

- [ ] **Step 1: Failing schema tests**

```typescript
export const closeReportRequestSchema = z.object({
  reportId: z.string().min(1).max(128),
  idempotencyKey: z.string().uuid(),
  closureSummary: z.string().min(1).max(2000).optional(),
})
```

Tests assert valid payload, missing reportId, too-long closureSummary (> 2000 chars).

- [ ] **Step 2: Commit**

```bash
git add functions/src/callables/close-report.ts \
        functions/src/callables/__tests__/close-report.unit.test.ts
git commit -m "feat(functions): scaffold closeReport request schema"
```

---

### Task 10: `closeReport` callable implementation

**Files:**

- Modify: `functions/src/callables/close-report.ts`
- Create: `functions/src/callables/__tests__/close-report.test.ts` (emulator-backed)
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Failing integration tests**

```typescript
describe('closeReport callable', () => {
  it('transitions a resolved report to closed', async () => {
    const { adminUid, reportId } = await seedResolvedReport({ municipalityId: 'daet' })
    const result = await callCloseReport(adminUid, { reportId, idempotencyKey: uuid() })
    expect(result.data.status).toBe('closed')
    const snap = await adminDb.collection('reports').doc(reportId).get()
    expect(snap.data()?.status).toBe('closed')
  })

  it('denies admin from another municipality', async () => {
    const { reportId } = await seedResolvedReport({ municipalityId: 'daet' })
    const wrongAdmin = await seedActiveAccount({
      role: 'municipal_admin',
      municipalityId: 'mercedes',
    })
    await expect(
      callCloseReport(wrongAdmin.uid, { reportId, idempotencyKey: uuid() }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('rejects close on a non-resolved report', async () => {
    const { adminUid, reportId } = await seedVerifiedReport({ municipalityId: 'daet' })
    await expect(
      callCloseReport(adminUid, { reportId, idempotencyKey: uuid() }),
    ).rejects.toMatchObject({ code: 'failed-precondition' })
  })

  it('appends a report_events entry from:resolved to:closed', async () => {
    const { adminUid, reportId } = await seedResolvedReport({ municipalityId: 'daet' })
    await callCloseReport(adminUid, { reportId, idempotencyKey: uuid() })
    const events = await adminDb.collection('report_events').where('reportId', '==', reportId).get()
    const last = events.docs.map((d) => d.data()).at(-1)
    expect(last).toMatchObject({ from: 'resolved', to: 'closed' })
  })
})
```

- [ ] **Step 2: Implement**

Pattern mirrors Task 5. Guards: `requireActiveMuniAdmin` + `assertReportInMuni(reportId, caller.municipalityId)` + `assertReportStatus(reportId, 'resolved')` in-transaction. `withIdempotency` wraps. Rate limit 60/min/admin per spec §7.2.

- [ ] **Step 3: Register in `functions/src/index.ts`**

```typescript
export { closeReport } from './callables/close-report.js'
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(functions): add closeReport callable (resolved → closed)"
```

---

## Group E — `dispatchMirrorToReport` Trigger (Tasks 11–12)

**Core invariant (spec §5.8).** The mirror trigger is the only path that updates `reports.status` from responder actions. It fires on every `onWrite(dispatches/{id})`, reads the before/after statuses, looks up the target report via `dispatches.reportId`, and:

- If `dispatchToReportState(after.status)` is non-null AND differs from `reports.status`, commit a transactional update + `report_events` append.
- Otherwise, no-op.

Cancel paths are handled by `cancelDispatch` itself (it writes `reports.status` back to `verified` in the same transaction), so the mirror explicitly skips `cancelled`.

---

### Task 11: Trigger skeleton + unit tests

**Files:**

- Create: `functions/src/triggers/dispatch-mirror-to-report.ts`
- Create: `functions/src/triggers/__tests__/dispatch-mirror-to-report.unit.test.ts`

- [ ] **Step 1: Failing unit tests on pure trigger body**

Extract the decision logic into a pure helper `computeMirrorAction(before, after, currentReportStatus)` that returns:

- `{ action: 'skip' }` if `before === after`
- `{ action: 'skip' }` if `after` is `cancelled` (cancel callable owns the report write)
- `{ action: 'update', to: ReportStatus }` if `dispatchToReportState(after)` is non-null and differs from `currentReportStatus`
- `{ action: 'skip' }` if map returns null

Tests cover all 10 × 10 = 100 transitions plus nine no-ops, plus the cancel-skip case.

- [ ] **Step 2: Implement the helper + skeleton trigger**

```typescript
// functions/src/triggers/dispatch-mirror-to-report.ts
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import {
  dispatchToReportState,
  type DispatchStatus,
  type ReportStatus,
} from '@bantayog/shared-validators'

export type MirrorAction =
  | { action: 'skip'; reason: string }
  | { action: 'update'; to: ReportStatus }

export function computeMirrorAction(
  before: DispatchStatus | undefined,
  after: DispatchStatus | undefined,
  currentReportStatus: ReportStatus,
): MirrorAction {
  if (!after) return { action: 'skip', reason: 'deleted' }
  if (after === 'cancelled') return { action: 'skip', reason: 'cancel_owned_by_callable' }
  if (before === after) return { action: 'skip', reason: 'noop_same_status' }
  const mapped = dispatchToReportState(after)
  if (!mapped) return { action: 'skip', reason: `no_mirror_for_${after}` }
  if (mapped === currentReportStatus) return { action: 'skip', reason: 'already_at_target' }
  return { action: 'update', to: mapped }
}

export const dispatchMirrorToReport = onDocumentWritten(
  { document: 'dispatches/{dispatchId}', region: 'asia-southeast1', timeoutSeconds: 10 },
  async (event) => {
    // Trigger body implemented in Task 12
  },
)
```

- [ ] **Step 3: Commit**

```bash
git add functions/src/triggers/dispatch-mirror-to-report.ts \
        functions/src/triggers/__tests__/dispatch-mirror-to-report.unit.test.ts
git commit -m "feat(functions): scaffold dispatchMirrorToReport with pure computeMirrorAction"
```

---

### Task 12: Trigger body — transactional mirror write

**Files:**

- Modify: `functions/src/triggers/dispatch-mirror-to-report.ts`
- Create: `functions/src/triggers/__tests__/dispatch-mirror-to-report.test.ts` (emulator-backed)
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Failing integration tests**

```typescript
describe('dispatchMirrorToReport', () => {
  it('mirrors accepted → reports.status=acknowledged', async () => {
    const { reportId, dispatchId } = await seedPendingDispatch()
    await adminDb.collection('dispatches').doc(dispatchId).update({ status: 'accepted' })
    await waitFor(async () => {
      const r = await adminDb.collection('reports').doc(reportId).get()
      return r.data()?.status === 'acknowledged'
    })
  })

  it('appends report_events on each mirrored change', async () => {
    const { reportId, dispatchId } = await seedAcceptedDispatch()
    await adminDb.collection('dispatches').doc(dispatchId).update({ status: 'acknowledged' })
    // reports.status should stay 'acknowledged' (dispatch stays on the same mirrored state);
    // no new report_events entry expected because of dedup.
    await adminDb.collection('dispatches').doc(dispatchId).update({ status: 'en_route' })
    await waitFor(async () => {
      const events = await adminDb
        .collection('report_events')
        .where('reportId', '==', reportId)
        .get()
      return events.docs.some((d) => d.data().to === 'en_route')
    })
  })

  it('no-ops when dispatch.status == cancelled', async () => {
    const { reportId, dispatchId } = await seedAcceptedDispatch()
    await adminDb.collection('dispatches').doc(dispatchId).update({ status: 'cancelled' })
    // cancelDispatch callable is not invoked in this test; verify mirror does NOT overwrite reports.status to any new value.
    const before = (await adminDb.collection('reports').doc(reportId).get()).data()?.status
    await new Promise((r) => setTimeout(r, 500))
    const after = (await adminDb.collection('reports').doc(reportId).get()).data()?.status
    expect(after).toBe(before)
  })

  it('skips if reports/{id} is missing (delete race)', async () => {
    const { dispatchId } = await seedPendingDispatch({ deleteReport: true })
    await expect(
      adminDb.collection('dispatches').doc(dispatchId).update({ status: 'accepted' }),
    ).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Implement the trigger body**

```typescript
export const dispatchMirrorToReport = onDocumentWritten(
  { document: 'dispatches/{dispatchId}', region: 'asia-southeast1', timeoutSeconds: 10 },
  async (event) => {
    const before = event.data?.before.data() as { status?: DispatchStatus } | undefined
    const after = event.data?.after.data() as
      | { status?: DispatchStatus; reportId?: string }
      | undefined
    const correlationId = event.data?.after.data()?.correlationId ?? crypto.randomUUID()

    if (!after?.reportId) {
      logger.info({ event: 'dispatch_mirror.skip', reason: 'no_reportId', correlationId })
      return
    }

    const db = getFirestore()
    const reportRef = db.collection('reports').doc(after.reportId)

    await db.runTransaction(async (tx) => {
      const reportSnap = await tx.get(reportRef)
      if (!reportSnap.exists) {
        logger.warn({ event: 'dispatch_mirror.skip', reason: 'report_missing', correlationId })
        return
      }
      const currentStatus = reportSnap.data()!.status as ReportStatus
      const decision = computeMirrorAction(before?.status, after.status, currentStatus)
      if (decision.action === 'skip') {
        logger.info({ event: 'dispatch_mirror.skip', reason: decision.reason, correlationId })
        return
      }
      tx.update(reportRef, {
        status: decision.to,
        lastStatusAt: FieldValue.serverTimestamp(),
      })
      tx.create(db.collection('report_events').doc(), {
        reportId: after.reportId,
        from: currentStatus,
        to: decision.to,
        actor: 'system:dispatchMirrorToReport',
        at: FieldValue.serverTimestamp(),
        correlationId,
      })
    })

    logger.info({
      event: 'dispatch_mirror.applied',
      correlationId,
      dispatchId: event.params.dispatchId,
      reportId: after.reportId,
    })
  },
)
```

- [ ] **Step 3: Register in `functions/src/index.ts`**

```typescript
export { dispatchMirrorToReport } from './triggers/dispatch-mirror-to-report.js'
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(functions): implement dispatchMirrorToReport trigger with transactional mirror"
```

---

## Group F — Responder Direct-Write Firestore Rules (Tasks 13–14)

The responder writes `dispatches/{id}.status` directly for `acknowledged → en_route → on_scene → resolved`. The rule must enforce:

1. Caller is the assigned responder (`resource.data.assignedTo.uid == request.auth.uid`)
2. Transition is valid per `isValidDispatchTransition(resource.data.status, request.resource.data.status)` (from the transition-table codegen)
3. Only the allowed field set changes: `['status','lastStatusAt','statusReason']` (plus `resolutionSummary` when transitioning to `resolved`)

`reports/{id}` remains callable-only for responders; the mirror trigger is the only non-admin writer of `reports.status`.

---

### Task 13: Extend `firestore.rules.template` for responder direct writes

**Files:**

- Modify: `infra/firebase/firestore.rules.template`
- Create: `functions/src/__tests__/rules/responder-direct-writes.rules.test.ts`

- [ ] **Step 1: Write the failing rule tests (positive + negative)**

```typescript
describe('responder direct-write on dispatches/{id}', () => {
  it('allows assigned responder to transition accepted → acknowledged', async () => {
    await setupEnv()
    const { dispatchId, responderUid } = await seedAcceptedDispatchWithAssignment()
    const db = testEnv
      .authenticatedContext(responderUid, { role: 'responder', active: true })
      .firestore()
    await assertSucceeds(
      db
        .collection('dispatches')
        .doc(dispatchId)
        .update({ status: 'acknowledged', lastStatusAt: FieldValue.serverTimestamp() }),
    )
  })

  it('denies acknowledged → resolved (skipping en_route/on_scene)', async () => {
    const { dispatchId, responderUid } = await seedAcknowledgedDispatchWithAssignment()
    const db = testEnv
      .authenticatedContext(responderUid, { role: 'responder', active: true })
      .firestore()
    await assertFails(db.collection('dispatches').doc(dispatchId).update({ status: 'resolved' }))
  })

  it('denies on_scene → resolved without resolutionSummary', async () => {
    const { dispatchId, responderUid } = await seedOnSceneDispatchWithAssignment()
    const db = testEnv
      .authenticatedContext(responderUid, { role: 'responder', active: true })
      .firestore()
    await assertFails(
      db
        .collection('dispatches')
        .doc(dispatchId)
        .update({ status: 'resolved', lastStatusAt: FieldValue.serverTimestamp() }),
    )
  })

  it('allows on_scene → resolved with resolutionSummary', async () => {
    const { dispatchId, responderUid } = await seedOnSceneDispatchWithAssignment()
    const db = testEnv
      .authenticatedContext(responderUid, { role: 'responder', active: true })
      .firestore()
    await assertSucceeds(
      db.collection('dispatches').doc(dispatchId).update({
        status: 'resolved',
        lastStatusAt: FieldValue.serverTimestamp(),
        resolutionSummary: 'Secured the area, no injuries reported.',
      }),
    )
  })

  it('denies writes by a different responder', async () => {
    const { dispatchId } = await seedAcceptedDispatchWithAssignment()
    const strangerUid = 'other-responder'
    const db = testEnv
      .authenticatedContext(strangerUid, { role: 'responder', active: true })
      .firestore()
    await assertFails(
      db.collection('dispatches').doc(dispatchId).update({ status: 'acknowledged' }),
    )
  })

  it('denies writes that touch fields outside the allowlist', async () => {
    const { dispatchId, responderUid } = await seedAcceptedDispatchWithAssignment()
    const db = testEnv
      .authenticatedContext(responderUid, { role: 'responder', active: true })
      .firestore()
    await assertFails(
      db
        .collection('dispatches')
        .doc(dispatchId)
        .update({ status: 'acknowledged', assignedTo: { uid: 'someone-else' } }),
    )
  })

  it('denies responder direct write of reports.status (mirror trigger only)', async () => {
    const { reportId, responderUid } = await seedAssignedReport()
    const db = testEnv
      .authenticatedContext(responderUid, { role: 'responder', active: true })
      .firestore()
    await assertFails(db.collection('reports').doc(reportId).update({ status: 'resolved' }))
  })
})
```

- [ ] **Step 2: Extend the rules template**

Inside `match /dispatches/{dispatchId}`:

```
function isAssignedResponder() {
  return isActiveResponder()
    && resource.data.assignedTo.uid == request.auth.uid;
}

function isAllowedDispatchFieldSet(newTo) {
  let base = ['status','lastStatusAt','statusReason'];
  let withSummary = base.concat(['resolutionSummary']);
  return newTo == 'resolved'
    ? request.resource.data.diff(resource.data).affectedKeys().hasOnly(withSummary)
       && request.resource.data.resolutionSummary is string
       && request.resource.data.resolutionSummary.size() >= 1
       && request.resource.data.resolutionSummary.size() <= 2000
    : request.resource.data.diff(resource.data).affectedKeys().hasOnly(base);
}

allow update: if isAssignedResponder()
  && isValidDispatchTransition(resource.data.status, request.resource.data.status)
  && isAllowedDispatchFieldSet(request.resource.data.status);
```

`isValidDispatchTransition` is inlined by the build-rules codegen; confirm it includes the 3c-extended transitions after running the script.

- [ ] **Step 3: Regenerate + run rules tests**

```bash
pnpm exec tsx scripts/build-rules.ts
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- responder-direct-writes.rules"
```

- [ ] **Step 4: Commit**

```bash
git add infra/firebase/firestore.rules.template \
        infra/firebase/firestore.rules \
        functions/src/__tests__/rules/responder-direct-writes.rules.test.ts
git commit -m "feat(firestore-rules): responder direct-write rules for dispatch status transitions"
```

---

### Task 14: Deny responder writes on reports.status (explicit rule + test)

**Files:**

- Modify: `infra/firebase/firestore.rules.template`
- Modify: `functions/src/__tests__/rules/dispatch-mirror.rules.test.ts`

This is mostly covered by Phase 2's default-deny, but an explicit assertion + a matching test makes the contract visible to future engineers grepping for `reports.status`.

- [ ] **Step 1: Failing test — responder direct update on `reports.status` must be denied even when they are an assigned responder on the report**

- [ ] **Step 2: Add an explicit deny clause and a comment pointing to `dispatchMirrorToReport`**

```
// reports.status is written by:
//  - system triggers: processInboxItem, dispatchMirrorToReport
//  - callables only: verifyReport, dispatchResponder, cancelDispatch, closeReport
// Responders never write reports.status directly.
```

- [ ] **Step 3: Commit**

```bash
git commit -am "test(firestore-rules): pin responder-cannot-write reports.status invariant"
```

---

## Group G — Responder PWA: Accept + Progression + CancelledScreen (Tasks 15–19)

The Responder PWA gains its first interactive flow in 3c. 3b shipped a read-only list; 3c makes each row navigate to a detail page that drives the full lifecycle. The rule and callable work in Groups B–F are the source of truth; the UI only consumes them.

---

### Task 15: `useDispatch` hook (onSnapshot) + `DispatchDetailPage` skeleton

**Files:**

- Create: `apps/responder-app/src/hooks/useDispatch.ts`
- Create: `apps/responder-app/src/pages/DispatchDetailPage.tsx`
- Modify: `apps/responder-app/src/App.tsx`

- [ ] **Step 1: Write the failing hook test**

```typescript
// apps/responder-app/src/hooks/__tests__/useDispatch.test.ts
import { renderHook, waitFor } from '@testing-library/react'
// ... firebase mocks from learnings.md pattern
describe('useDispatch', () => {
  it('returns the dispatch document reactively', async () => {
    const { result } = renderHook(() => useDispatch('disp-1'))
    await waitFor(() => expect(result.current.dispatch?.status).toBe('pending'))
  })
  it('returns undefined while loading and error on permission denied', async () => {
    // ...
  })
})
```

- [ ] **Step 2: Implement the hook**

```typescript
export function useDispatch(dispatchId: string | undefined) {
  const [dispatch, setDispatch] = useState<Dispatch | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>(undefined)
  useEffect(() => {
    if (!dispatchId) {
      setLoading(false)
      return
    }
    const unsub = onSnapshot(
      doc(db, 'dispatches', dispatchId),
      (snap) => {
        setDispatch(snap.exists() ? (snap.data() as Dispatch) : undefined)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsub
  }, [dispatchId])
  return { dispatch, loading, error }
}
```

- [ ] **Step 3: Add a skeleton page that renders dispatch status + Accept button**

```tsx
export function DispatchDetailPage() {
  const { dispatchId } = useParams<{ dispatchId: string }>()
  const { dispatch, loading, error } = useDispatch(dispatchId)
  if (loading) return <Skeleton />
  if (error || !dispatch) return <NotFound />
  if (dispatch.status === 'cancelled') return <CancelledScreen dispatch={dispatch} />
  return (
    <main>
      <h1>Dispatch {dispatch.dispatchId}</h1>
      <p>Status: {dispatch.status}</p>
      {/* Accept + progression buttons land in Task 16 */}
    </main>
  )
}
```

- [ ] **Step 4: Register route + commit**

```tsx
// App.tsx
<Route path="/dispatches/:dispatchId" element={<DispatchDetailPage />} />
```

```bash
git commit -am "feat(responder-app): add useDispatch hook and DispatchDetailPage skeleton"
```

---

### Task 16: `useAcceptDispatch` hook + Accept button

**Files:**

- Create: `apps/responder-app/src/hooks/useAcceptDispatch.ts`
- Modify: `apps/responder-app/src/pages/DispatchDetailPage.tsx`

- [ ] **Step 1: Failing hook test**

```typescript
describe('useAcceptDispatch', () => {
  it('calls the callable with a stable idempotency key per mounted instance', async () => {
    // mockCallable returns { status: 'accepted' }
    const { result } = renderHook(() => useAcceptDispatch('disp-1'))
    await act(() => result.current.accept())
    expect(mockCallable).toHaveBeenCalledWith({
      dispatchId: 'disp-1',
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    })
  })
  it('exposes loading + error states', async () => {
    // ...
  })
})
```

Idempotency key is generated once per hook mount (spec §6.6 — 30-second client memory; hook mount is the semantic equivalent of one action).

- [ ] **Step 2: Implement the hook**

```typescript
export function useAcceptDispatch(dispatchId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  const keyRef = useRef(crypto.randomUUID())
  async function accept() {
    setLoading(true)
    setError(undefined)
    try {
      const fn = httpsCallable<AcceptDispatchRequest, { status: string }>(
        functions,
        'acceptDispatch',
      )
      await fn({ dispatchId, idempotencyKey: keyRef.current })
    } catch (err: unknown) {
      if (err instanceof Error) setError(err)
      else setError(new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }
  return { accept, loading, error }
}
```

- [ ] **Step 3: Wire the button, handle `already-exists` by re-fetching via useDispatch**

```tsx
{
  dispatch.status === 'pending' && (
    <button onClick={accept} disabled={loading}>
      {loading ? 'Accepting…' : 'Accept dispatch'}
    </button>
  )
}
{
  error?.message.includes('already-exists') && <RaceLostBanner />
}
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(responder-app): accept-dispatch flow with idempotency"
```

---

### Task 17: `useAdvanceDispatch` hook + progression buttons

**Files:**

- Create: `apps/responder-app/src/hooks/useAdvanceDispatch.ts`
- Modify: `apps/responder-app/src/pages/DispatchDetailPage.tsx`

Direct Firestore update, rule-gated. On `permission-denied`, assume admin cancelled and rely on `useDispatch` to surface the latest state (which will trigger `CancelledScreen`).

- [ ] **Step 1: Failing hook test (emulator-backed)**

Seed an accepted dispatch. Call `advance('acknowledged')`. Assert `dispatches/{id}.status == 'acknowledged'`. Then try `advance('resolved')` — expect `permission-denied` (must pass through en_route, on_scene).

- [ ] **Step 2: Implement**

```typescript
export function useAdvanceDispatch(dispatchId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  async function advance(to: DispatchStatus, extras?: { resolutionSummary?: string }) {
    setLoading(true)
    setError(undefined)
    try {
      const ref = doc(db, 'dispatches', dispatchId)
      const patch: Record<string, unknown> = { status: to, lastStatusAt: serverTimestamp() }
      if (to === 'resolved') {
        if (!extras?.resolutionSummary) throw new Error('resolutionSummary_required')
        patch.resolutionSummary = extras.resolutionSummary
      }
      await updateDoc(ref, patch)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err)
      else setError(new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }
  return { advance, loading, error }
}
```

- [ ] **Step 3: Wire the buttons by status**

```tsx
{
  dispatch.status === 'acknowledged' && (
    <button onClick={() => advance('en_route')}>Heading there</button>
  )
}
{
  dispatch.status === 'en_route' && (
    <button onClick={() => advance('on_scene')}>Arrived on scene</button>
  )
}
{
  dispatch.status === 'on_scene' && (
    <ResolveForm onSubmit={(s) => advance('resolved', { resolutionSummary: s })} />
  )
}
```

Acknowledge auto-advance happens on detail-page mount when `status == 'accepted'` (spec §5.8: `accepted → acknowledged` auto-advances on accept screen render). A single `useEffect` guarded by `status === 'accepted' && !advanceAttempted` handles it; test that it calls `advance('acknowledged')` exactly once on mount.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(responder-app): progression buttons for acknowledged→en_route→on_scene→resolved"
```

---

### Task 18: `CancelledScreen` + permission-denied re-fetch plumbing

**Files:**

- Create: `apps/responder-app/src/pages/CancelledScreen.tsx`
- Modify: `apps/responder-app/src/pages/DispatchDetailPage.tsx`

- [ ] **Step 1: Failing component test**

`CancelledScreen` renders:

- H1 "This dispatch was cancelled"
- Institutional label of the cancelling admin (from `dispatches/{id}.cancelledBy.institutionalLabel`, e.g., "Daet MDRRMO")
- Reason if present
- A "Back to list" link

```tsx
it('renders the institutional label of the cancelling admin', () => {
  render(
    <CancelledScreen
      dispatch={{ status: 'cancelled', cancelledBy: { institutionalLabel: 'Daet MDRRMO' } }}
    />,
  )
  expect(screen.getByText(/Daet MDRRMO/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Implement**

Spec §6.4: "replaces with 'cancelled by [institutional label]' + reason". Plain, minimal, keyboard-navigable.

- [ ] **Step 3: Plumb the fallback path in `DispatchDetailPage`**

When `useAdvanceDispatch` surfaces `permission-denied`, `useDispatch` re-fetches via its active `onSnapshot` — it is already reactive. The detail page just needs a `useEffect` that clears the local `error` once `dispatch.status === 'cancelled'` (so we don't show a ghost banner under the CancelledScreen).

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(responder-app): CancelledScreen + race-loss re-fetch UX"
```

---

### Task 19: Wire list → detail navigation in 3b's `DispatchListPage`

**Files:**

- Modify: `apps/responder-app/src/pages/DispatchListPage.tsx`
- Modify: `apps/responder-app/src/pages/__tests__/DispatchListPage.test.tsx`

- [ ] **Step 1: Failing test — clicking a row navigates to `/dispatches/:id`**

- [ ] **Step 2: Wrap each row in `<Link to={`/dispatches/${dispatch.dispatchId}`}>`**

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(responder-app): linkify dispatch list rows to detail page"
```

---

## Group H — FCM Web Push Pipeline (Tasks 20–24)

FCM is a speed optimization (spec §6.5): dispatches are always visible via `onSnapshot`, push just gets there faster. The pipeline has four pieces:

1. VAPID keypair provisioning (one-time; manual)
2. Service worker registration + `onBackgroundMessage`
3. Token registration on login, saved to `responders/{uid}.fcmTokens`
4. `dispatchResponder` callable + `cancelDispatch` callable call `fcm-send` after the transaction commits; failures surface as `warnings: ['fcm_*']` on the callable response

---

### Task 20: VAPID keypair provisioning runbook (docs-only)

**Rationale.** VAPID provisioning is a one-time operator step (or every ~2 years on rotation). It must not be checked into code. A runbook captures the gcloud secret-write commands so the next rotation has a known path.

**Files:**

- Create: `docs/runbooks/fcm-vapid-rotation.md`

- [ ] **Step 1: Draft the runbook**

Content (markdown, shell commands shown as prose in fenced code blocks — these are not executed by any script in the repo):

````markdown
# FCM VAPID Keypair Rotation

## When to rotate

- Initial provisioning (Phase 3c pre-deploy) — required before any FCM code ships.
- Every 24 months as a hygiene rotation.
- Immediately if the private key is suspected to have leaked.

## Generate

Use the Firebase Console: Project Settings → Cloud Messaging → Web Push certificates → Generate key pair. Capture both the public key (VAPID public; used by the browser) and the private key (used by the sender).

## Store in Secret Manager

On the operator workstation, authenticated as the project owner:

```bash
gcloud secrets create fcm-vapid-public-key --replication-policy="automatic" \
  --project=bantayog-alert-staging
echo -n "BN...<public key>" | gcloud secrets versions add fcm-vapid-public-key \
  --data-file=- --project=bantayog-alert-staging
gcloud secrets create fcm-vapid-private-key --replication-policy="automatic" \
  --project=bantayog-alert-staging
echo -n "<private key>" | gcloud secrets versions add fcm-vapid-private-key \
  --data-file=- --project=bantayog-alert-staging
```

Same for `bantayog-alert-prod` on the production rotation pass.

## Grant access to the functions runtime service account

```bash
gcloud secrets add-iam-policy-binding fcm-vapid-private-key \
  --member="serviceAccount:functions-runtime@bantayog-alert-staging.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=bantayog-alert-staging
```

## Expose the public key to the Responder PWA

The public key is read at build time via `VITE_FCM_VAPID_PUBLIC_KEY`. It is public by design (the browser sends it to FCM) and can be committed to the CI env var config (not to the repo).

## Revocation

Delete the old version from Secret Manager and regenerate tokens for all active responders (`responders/{uid}.fcmTokens` purge + re-register on next login).
````

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/fcm-vapid-rotation.md
git commit -m "docs(runbooks): fcm vapid keypair rotation runbook"
```

---

### Task 21: Confirm VAPID secrets exist in staging + wire functions config

**Files:**

- Modify: `functions/src/services/fcm-send.ts` (reads secret via `defineSecret`)
- Modify: `infra/terraform/modules/monitoring/phase-3/main.tf` (document the secret dependency in a comment)

- [ ] **Step 1: Pre-flight check (operator step, not code)**

Run locally, authenticated against the staging project:

```bash
gcloud secrets versions list fcm-vapid-private-key --project=bantayog-alert-staging
gcloud secrets versions list fcm-vapid-public-key --project=bantayog-alert-staging
```

Both must show at least one `ENABLED` version. If missing, execute Task 20's runbook before proceeding.

- [ ] **Step 2: Declare the secret in the FCM send helper**

```typescript
// functions/src/services/fcm-send.ts
import { defineSecret } from 'firebase-functions/params'
export const FCM_VAPID_PRIVATE_KEY = defineSecret('FCM_VAPID_PRIVATE_KEY')
```

And, for any function that calls `fcm-send`, reference the secret in its options:

```typescript
export const dispatchResponder = onCall(
  { ..., secrets: [FCM_VAPID_PRIVATE_KEY] },
  async (request) => { /* ... */ },
)
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(functions): declare FCM_VAPID_PRIVATE_KEY secret binding"
```

---

### Task 22: `fcm-send` service with retry and token cleanup

**Files:**

- Create: `functions/src/services/fcm-send.ts`
- Create: `functions/src/services/__tests__/fcm-send.test.ts`

- [ ] **Step 1: Failing unit tests (with FCM admin SDK mocked)**

```typescript
describe('sendFcmToResponder', () => {
  it('sends to all tokens and returns ok when at least one succeeds', async () => {
    mockFcm.sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/invalid-registration-token' } },
      ],
    })
    const result = await sendFcmToResponder({ uid: 'r1', title: 'Dispatch', body: '…' })
    expect(result.warnings).toEqual(['fcm_one_token_invalid'])
  })

  it('cleans up invalid tokens from responders/{uid}.fcmTokens', async () => {
    // ...
    expect(adminDb.collection('responders').doc('r1').update).toHaveBeenCalledWith({
      fcmTokens: FieldValue.arrayRemove('bad-token'),
    })
  })

  it('returns fcm_no_token when responder has no tokens', async () => {
    // ...
    expect(result.warnings).toEqual(['fcm_no_token'])
  })

  it('returns fcm_network_error on transport failure after 1 retry', async () => {
    mockFcm.sendEachForMulticast.mockRejectedValueOnce(new Error('ECONNRESET'))
    mockFcm.sendEachForMulticast.mockRejectedValueOnce(new Error('ECONNRESET'))
    const result = await sendFcmToResponder({ uid: 'r1', title: '…', body: '…' })
    expect(result.warnings).toEqual(['fcm_network_error'])
  })
})
```

- [ ] **Step 2: Implement**

Key behaviors:

- Read `responders/{uid}.fcmTokens` once
- If empty → return `{ warnings: ['fcm_no_token'] }`
- Use `getMessaging().sendEachForMulticast(...)` with `collapseKey: dispatch-{dispatchId}`, `priority: 'high'`
- Retry once on transport error
- Walk the multicast response: for each `messaging/invalid-registration-token` or `messaging/registration-token-not-registered`, append that token to a remove-list; after the send, issue `arrayRemove` to clean them up
- Return `{ warnings: string[] }` — never throw

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(functions): fcm-send service with retry and invalid-token cleanup"
```

---

### Task 23: Hook FCM into `dispatchResponder` (post-transaction, best-effort)

**Files:**

- Modify: `functions/src/callables/dispatch-responder.ts`
- Modify: `functions/src/callables/__tests__/dispatch-responder.test.ts`

- [ ] **Step 1: Failing test**

```typescript
it('returns warnings: ["fcm_no_token"] when the responder has no FCM tokens', async () => {
  const { responderUid } = await seedResponderOnShift({ fcmTokens: [] })
  const result = await callDispatchResponder(adminUid, {
    reportId,
    responderUid,
    idempotencyKey: uuid(),
  })
  expect(result.data.warnings).toEqual(['fcm_no_token'])
})

it('does not fail the callable if FCM throws', async () => {
  mockFcmSend.mockRejectedValueOnce(new Error('fcm blew up'))
  const result = await callDispatchResponder(adminUid, {
    reportId,
    responderUid,
    idempotencyKey: uuid(),
  })
  expect(result.data.dispatchId).toBeDefined()
  expect(result.data.warnings).toEqual(['fcm_network_error'])
})
```

- [ ] **Step 2: Invoke `sendFcmToResponder` AFTER the transaction commits**

```typescript
// Inside dispatchResponder callable, after db.runTransaction(...) resolves:
const fcm = await sendFcmToResponder({
  uid: payload.responderUid,
  title: 'New dispatch',
  body: `${report.type} — severity ${report.severityDerived}`,
  data: {
    dispatchId: createdDispatchId,
    reportId: payload.reportId,
    correlationId,
  },
})

return { dispatchId: createdDispatchId, correlationId, warnings: fcm.warnings }
```

- [ ] **Step 3: Surface warnings in the Admin Desktop dispatch modal**

A one-line non-blocking banner: "Dispatch saved; responder notification failed (fcm_network_error)." (spec §6.5 — dispatch truth lives in Firestore).

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(functions): wire best-effort FCM into dispatchResponder with warnings passthrough"
```

---

### Task 24: Service worker + token registration in Responder PWA

**Files:**

- Create: `apps/responder-app/src/sw/firebase-messaging-sw.ts` (source for the service worker)
- Create: `apps/responder-app/src/hooks/useRegisterFcmToken.ts`
- Create: `apps/responder-app/src/services/fcm-client.ts`
- Modify: `apps/responder-app/vite.config.ts` (copy SW as a public asset)
- Modify: `apps/responder-app/src/App.tsx` (register SW + token on auth)

- [ ] **Step 1: Failing token-registration hook test**

```typescript
describe('useRegisterFcmToken', () => {
  it('requests notification permission and saves token to responders/{uid}.fcmTokens', async () => {
    mockNotification.requestPermission.mockResolvedValue('granted')
    mockGetToken.mockResolvedValue('fake-token-abc')
    renderHook(() => useRegisterFcmToken('r1'))
    await waitFor(() => {
      expect(adminDb.collection('responders').doc('r1').update).toHaveBeenCalledWith({
        fcmTokens: FieldValue.arrayUnion('fake-token-abc'),
      })
    })
  })
  it('no-ops if permission is denied', async () => {
    mockNotification.requestPermission.mockResolvedValue('denied')
    renderHook(() => useRegisterFcmToken('r1'))
    await waitFor(() => expect(mockGetToken).not.toHaveBeenCalled())
  })
  it('skips token refresh if same token is already present', async () => {
    // ...
  })
})
```

- [ ] **Step 2: Implement `fcm-client.ts` and the hook**

```typescript
// services/fcm-client.ts
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { app } from '../app/firebase.js'

export async function acquireFcmToken(): Promise<string | null> {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return null
  const messaging = getMessaging(app)
  return getToken(messaging, {
    vapidKey: import.meta.env.VITE_FCM_VAPID_PUBLIC_KEY,
    serviceWorkerRegistration: await navigator.serviceWorker.ready,
  })
}

export function subscribeForeground(onPayload: (p: unknown) => void) {
  return onMessage(getMessaging(app), onPayload)
}
```

Hook wraps `acquireFcmToken` + writes to `responders/{uid}.fcmTokens` via `arrayUnion`. Guard against duplicate writes by reading current tokens first.

- [ ] **Step 3: Service-worker source**

```typescript
// sw/firebase-messaging-sw.ts
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'

initializeApp({
  apiKey: '__INJECTED_AT_BUILD_TIME__',
  // ...
})
const messaging = getMessaging()

onBackgroundMessage(messaging, (payload) => {
  const title = payload.notification?.title ?? 'New dispatch'
  const body = payload.notification?.body ?? 'Open the app for details'
  self.registration.showNotification(title, {
    body,
    data: payload.data,
    icon: '/favicon.svg',
    tag: payload.data?.dispatchId ? `dispatch-${payload.data.dispatchId}` : undefined,
  })
})

self.addEventListener('notificationclick', (event) => {
  const target = event.notification.data?.dispatchId
    ? `/dispatches/${event.notification.data.dispatchId}`
    : '/'
  event.notification.close()
  event.waitUntil(clients.openWindow(target))
})
```

Vite config copies the compiled SW to `/firebase-messaging-sw.js` at the site root (browsers require the SW scope to be root).

- [ ] **Step 4: Register SW + token on login**

In `App.tsx`, once auth resolves to a responder:

```tsx
useEffect(() => {
  if (!responder?.uid) return
  navigator.serviceWorker
    .register('/firebase-messaging-sw.js')
    .then(() => acquireFcmToken())
    .then((token) => {
      if (token) saveToken(responder.uid, token)
    })
}, [responder?.uid])
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(responder-app): fcm service worker + token registration"
```

---

## Group I — Admin UI: Close + Widened Cancel (Tasks 25–26)

---

### Task 25: `CloseReportModal` + wire Close button on `TriageQueuePage`

**Files:**

- Create: `apps/admin-desktop/src/pages/CloseReportModal.tsx`
- Modify: `apps/admin-desktop/src/pages/TriageQueuePage.tsx`
- Create: `apps/admin-desktop/src/pages/__tests__/CloseReportModal.test.tsx`

- [ ] **Step 1: Failing component test**

- Modal renders when `status === 'resolved'` and Close button tapped
- Submit calls `closeReport` callable with `{ reportId, idempotencyKey, closureSummary }`
- On success, modal closes and banner "Report closed" appears
- On `failed-precondition` (admin lost a race to another admin's close), show the error and re-fetch via onSnapshot

- [ ] **Step 2: Implement**

Small modal: a textarea for `closureSummary` (optional, max 2000 chars), a Close button, a Cancel button. Wraps the existing `services/callables.ts` helper.

- [ ] **Step 3: Surface the Close button only when `reports.status === 'resolved'`**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(admin-desktop): CloseReportModal + Close button on triage queue"
```

---

### Task 26: Widen `CancelDispatchModal` to cover mid-lifecycle states

**Files:**

- Modify: `apps/admin-desktop/src/pages/CancelDispatchModal.tsx` (or `DispatchModal.tsx` if that's the shipped name from 3b)
- Modify: matching test file

- [ ] **Step 1: Failing test**

Cancel button is visible for `status in ['pending','accepted','acknowledged','en_route','on_scene']`; hidden for `resolved`, `cancelled`, `declined`, `timed_out`, `superseded`.

- [ ] **Step 2: Update the status-gating logic**

```typescript
const CANCELLABLE = new Set(['pending', 'accepted', 'acknowledged', 'en_route', 'on_scene'])
```

Reuse the same constant in a shared module (`apps/admin-desktop/src/domain/dispatch-policy.ts`) if convenient — the source-of-truth is still the `shared-validators` transition table; this constant is just a UI gate that must match.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(admin-desktop): widen cancel dispatch UI to mid-lifecycle states"
```

---

## Group J — Playwright E2E Suite (Tasks 27–31)

Fresh workspace package. Same test patterns across specs: reset emulator, seed, run the flow, assert Firestore state at each milestone. FCM is injected via a service-worker mock on the emulator path (a tiny page script calls `ServiceWorkerRegistration.showNotification` manually on a known event payload); against staging, real FCM delivers and the test waits for the notification event.

---

### Task 27: Scaffold `apps/e2e-tests/` workspace + Playwright config

**Files:**

- Create: `apps/e2e-tests/package.json`
- Create: `apps/e2e-tests/playwright.config.ts`
- Create: `apps/e2e-tests/fixtures/emulator-setup.ts`
- Create: `apps/e2e-tests/fixtures/test-accounts.ts`
- Modify: `pnpm-workspace.yaml` (confirm `apps/*` glob covers it)
- Modify: root `package.json` (add `test:e2e` script)

- [ ] **Step 1: Package config**

```json
{
  "name": "@bantayog/e2e-tests",
  "private": true,
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:staging": "playwright test --config=playwright.staging.config.ts",
    "test:e2e:ui": "playwright test --ui"
  },
  "devDependencies": {
    "@playwright/test": "^1.47.0"
  }
}
```

- [ ] **Step 2: Playwright config**

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: [
    { command: 'pnpm --filter @bantayog/citizen-pwa dev', port: 5173, reuseExistingServer: true },
    { command: 'pnpm --filter @bantayog/admin-desktop dev', port: 5174, reuseExistingServer: true },
    { command: 'pnpm --filter @bantayog/responder-app dev', port: 5175, reuseExistingServer: true },
  ],
  use: { baseURL: 'http://localhost:5173' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
```

A separate `playwright.staging.config.ts` points to the deployed staging URLs and has no `webServer` block.

- [ ] **Step 3: Emulator setup helper**

```typescript
export async function resetEmulator() {
  await fetch(
    'http://localhost:8080/emulator/v1/projects/bantayog-alert-test/databases/(default)/documents',
    {
      method: 'DELETE',
    },
  )
  await fetch('http://localhost:9099/emulator/v1/projects/bantayog-alert-test/accounts', {
    method: 'DELETE',
  })
}

export async function seedAccounts() {
  // Provisions citizen-test-01, daet-admin-test-01, bfp-responder-test-01
  // via admin SDK, using the shared seed factories.
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/e2e-tests package.json pnpm-workspace.yaml
git commit -m "feat(e2e-tests): scaffold Playwright workspace for Phase 3 full loop"
```

---

### Task 28: `citizen.spec.ts` — submit + lookup

**Files:**

- Create: `apps/e2e-tests/specs/citizen.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
test.describe('Citizen submission', () => {
  test.beforeEach(async () => {
    await resetEmulator()
    await seedAccounts()
  })

  test('submits a report and retrieves status via lookup', async ({ page }) => {
    await page.goto('http://localhost:5173')
    await signInAsCitizen(page, 'citizen-test-01')
    await page.getByRole('button', { name: /report an incident/i }).click()
    await page.getByLabel(/describe/i).fill('Fire at the market')
    await page.getByLabel(/severity/i).selectOption('high')
    await page.setInputFiles('input[type=file]', 'fixtures/test-photo.jpg')
    await page.getByRole('button', { name: /submit/i }).click()

    const publicRef = await page.getByTestId('public-ref').textContent()
    const secret = await page.getByTestId('secret').textContent()
    expect(publicRef).toMatch(/^[a-z0-9]{8}$/)

    // Wait for processInboxItem to materialize the triptych
    await expect
      .poll(
        async () => {
          const r = await fetch('http://localhost:5001/lookup', {
            method: 'POST',
            body: JSON.stringify({ publicRef, secret }),
          }).then((r) => r.json())
          return r.status
        },
        { timeout: 10_000 },
      )
      .toBe('new')
  })
})
```

- [ ] **Step 2: Run against emulator**

```bash
firebase emulators:exec --only firestore,auth,functions,storage,database \
  "pnpm --filter @bantayog/e2e-tests test:e2e -- citizen"
```

- [ ] **Step 3: Commit**

```bash
git commit -am "test(e2e): citizen submission + lookup spec"
```

---

### Task 29: `admin.spec.ts` — verify + dispatch

**Files:**

- Create: `apps/e2e-tests/specs/admin.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
test('admin verifies and dispatches a report', async ({ page, context }) => {
  await resetEmulator()
  await seedAccounts()
  const reportId = await seedNewReport({ municipalityId: 'daet' })

  await page.goto('http://localhost:5174')
  await signInAsAdmin(page, 'daet-admin-test-01')

  // Report appears in queue
  await expect(page.getByTestId(`report-row-${reportId}`)).toBeVisible()

  await page.getByTestId(`report-row-${reportId}`).click()
  await page.getByRole('button', { name: /^verify$/i }).click() // new → awaiting_verify
  await page.getByRole('button', { name: /^verify$/i }).click() // awaiting_verify → verified

  await expect(page.getByText(/status: verified/i)).toBeVisible()

  // Dispatch
  await page.getByRole('button', { name: /^dispatch$/i }).click()
  await page.getByTestId('responder-radio-bfp-responder-test-01').check()
  await page.getByRole('button', { name: /confirm dispatch/i }).click()

  await expect(page.getByText(/status: assigned/i)).toBeVisible()
})
```

- [ ] **Step 2: Commit**

```bash
git commit -am "test(e2e): admin verify + dispatch spec"
```

---

### Task 30: `responder.spec.ts` — accept + progress + resolve

**Files:**

- Create: `apps/e2e-tests/specs/responder.spec.ts`
- Create: `apps/e2e-tests/fixtures/fcm-mock.ts`

- [ ] **Step 1: FCM mock injector**

Against emulator, we cannot register a real push subscription. The mock runs in the responder-app page context:

```typescript
export async function injectFcmMock(page: Page, dispatchId: string) {
  await page.addInitScript((id) => {
    window.__pretendFcmArrived = async () => {
      window.postMessage({ __fcm: true, dispatchId: id }, '*')
    }
  }, dispatchId)
}
```

In the app, a debug listener (behind `import.meta.env.DEV`) reads `__fcm` messages and navigates. This is the only piece of app code that changes for the emulator path.

- [ ] **Step 2: Write the spec**

```typescript
test('responder accepts and progresses through to resolved', async ({ page, browser }) => {
  const { dispatchId } = await seedPendingDispatchForResponder('bfp-responder-test-01')

  await injectFcmMock(page, dispatchId)
  await page.goto('http://localhost:5175')
  await signInAsResponder(page, 'bfp-responder-test-01')

  await page.evaluate(() => window.__pretendFcmArrived())
  await page.waitForURL(`**/dispatches/${dispatchId}`)

  await page.getByRole('button', { name: /accept dispatch/i }).click()
  await expect(page.getByText(/status: acknowledged/i)).toBeVisible()

  await page.getByRole('button', { name: /heading there/i }).click()
  await expect(page.getByText(/status: en_route/i)).toBeVisible()

  await page.getByRole('button', { name: /arrived on scene/i }).click()
  await expect(page.getByText(/status: on_scene/i)).toBeVisible()

  await page.getByLabel(/resolution summary/i).fill('Fire contained; no injuries.')
  await page.getByRole('button', { name: /mark resolved/i }).click()
  await expect(page.getByText(/status: resolved/i)).toBeVisible()
})
```

- [ ] **Step 3: Commit**

```bash
git commit -am "test(e2e): responder accept + progression spec"
```

---

### Task 31: `full-loop.spec.ts` + `race-loss.spec.ts`

**Files:**

- Create: `apps/e2e-tests/specs/full-loop.spec.ts`
- Create: `apps/e2e-tests/specs/race-loss.spec.ts`

- [ ] **Step 1: `full-loop.spec.ts`**

Single test that runs the entire citizen → admin → responder → admin-close chain in one browser session per surface (three contexts). This is what gates Phase 3 exit at §10.

- [ ] **Step 2: `race-loss.spec.ts`**

```typescript
test('admin cancel mid-progress → responder sees CancelledScreen', async ({ page, browser }) => {
  const adminCtx = await browser.newContext()
  const respCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const respPage = await respCtx.newPage()

  const { reportId, dispatchId } = await seedInProgressDispatch({ municipalityId: 'daet' })

  await signInAsAdmin(adminPage, 'daet-admin-test-01')
  await signInAsResponder(respPage, 'bfp-responder-test-01')
  await respPage.goto(`/dispatches/${dispatchId}`)

  // Responder sees en_route status, about to tap "Arrived on scene".
  await expect(respPage.getByRole('button', { name: /arrived on scene/i })).toBeVisible()

  // Admin cancels first.
  await adminPage.goto(`/reports/${reportId}`)
  await adminPage.getByRole('button', { name: /cancel dispatch/i }).click()
  await adminPage.getByLabel(/reason/i).fill('Responder unavailable — re-dispatching.')
  await adminPage.getByRole('button', { name: /confirm cancel/i }).click()

  // Responder now taps Arrived — should hit permission-denied, then the onSnapshot
  // re-read surfaces status: cancelled, and CancelledScreen renders.
  await respPage.getByRole('button', { name: /arrived on scene/i }).click()
  await expect(respPage.getByText(/this dispatch was cancelled/i)).toBeVisible()
  await expect(respPage.getByText(/daet mdrrmo/i)).toBeVisible()
})
```

- [ ] **Step 3: Commit**

```bash
git commit -am "test(e2e): full-loop + race-loss scenarios"
```

---

## Group K — Phase 3c Acceptance Script (Task 32)

---

### Task 32: `scripts/phase-3c/acceptance.ts`

**Files:**

- Create: `scripts/phase-3c/acceptance.ts`

**What it covers (spec §8.3):**

1. Run 3a acceptance inline (callable into the function; fail-fast if 3a regresses)
2. Run 3b acceptance inline
3. Seed a verified report, admin dispatches
4. Responder `acceptDispatch` → assert `dispatches.status == accepted`
5. Responder direct-writes `acknowledged → en_route → on_scene → resolved` with waits between
6. Assert each `reports.status` mirror step
7. Admin `closeReport` → assert `reports.status == closed`
8. Race-loss: seed a separate dispatch, take it to `en_route`, admin calls `cancelDispatch`, then responder tries `advance('on_scene')` → expect `permission-denied`, then fetch and confirm `dispatches.status == cancelled`
9. Structured JSON output with pass/fail per check

- [ ] **Step 1: Draft the script**

Follows the same shape as `scripts/phase-3b/acceptance.ts`: uses `firebase-admin` for seeding and verification; uses a minted custom token + Firebase client SDK for callable calls; uses rule-gated direct updates via the authenticated client SDK for responder progression (proves the rules in production, not just the callables).

- [ ] **Step 2: Run against emulator**

```bash
firebase emulators:exec --only firestore,auth,functions,storage,database \
  "pnpm exec tsx scripts/phase-3b/bootstrap-test-responder.ts --emulator && \
   pnpm exec tsx scripts/phase-3c/acceptance.ts"
```

Expect exit 0 and all checks green.

- [ ] **Step 3: Commit**

```bash
git add scripts/phase-3c/acceptance.ts
git commit -m "feat(scripts): phase-3c acceptance gate covering full loop + race-loss"
```

---

## Group L — Monitoring, Docs, Exit Checklist (Tasks 33)

---

### Task 33: Monitoring extensions + rule coverage + runbooks + progress + exit

**Files:**

- Create: `infra/terraform/modules/monitoring/phase-3/fcm-metrics.tf`
- Create: `infra/terraform/modules/monitoring/phase-3/mirror-metrics.tf`
- Modify: `scripts/check-rule-coverage.ts`
- Create: `docs/runbooks/phase-3c-responder-loop.md`
- Modify: `docs/progress.md`
- Modify: `docs/learnings.md`

- [ ] **Step 1: FCM metrics + dashboard panel**

```hcl
# fcm-metrics.tf
resource "google_logging_metric" "fcm_sent" {
  name   = "fcm_sent"
  filter = "jsonPayload.event=\"fcm.sent\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_logging_metric" "fcm_failed" {
  name   = "fcm_failed"
  filter = "jsonPayload.event=\"fcm.failed\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_logging_metric" "fcm_no_token" {
  name   = "fcm_no_token"
  filter = "jsonPayload.event=\"fcm.no_token\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_monitoring_alert_policy" "fcm_failure_rate_warn" {
  display_name = "Phase 3 — FCM failure rate > 10%"
  combiner     = "OR"
  conditions {
    display_name = "fcm_failed / (fcm_sent + fcm_failed) > 0.10 sustained 10m"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/fcm_failed\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.10
      duration        = "600s"
    }
  }
  notification_channels = var.warn_channels
}

resource "google_monitoring_alert_policy" "fcm_failure_rate_page" {
  # Page at 25% per spec §9.3; analogous structure.
}
```

- [ ] **Step 2: Mirror drift alert**

```hcl
# mirror-metrics.tf
resource "google_logging_metric" "dispatch_mirror_skip_report_missing" {
  name   = "dispatch_mirror_skip_report_missing"
  filter = "jsonPayload.event=\"dispatch_mirror.skip\" AND jsonPayload.reason=\"report_missing\""
  metric_descriptor { metric_kind = "DELTA" value_type = "INT64" }
}

resource "google_monitoring_alert_policy" "dispatch_mirror_drift" {
  display_name = "Phase 3 — dispatch mirror found report missing"
  combiner     = "OR"
  conditions {
    display_name = "> 0 in 5m"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/dispatch_mirror_skip_report_missing\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "300s"
    }
  }
  notification_channels = var.warn_channels
}
```

- [ ] **Step 3: Extend rule coverage**

```typescript
// scripts/check-rule-coverage.ts — add a Phase 3c set
const PHASE_3C_COLLECTIONS = [
  'dispatches', // extended: responder direct-write positive + negative
  'reports', // mirror-only writes for status
] as const
```

Ensure positive + negative tests named in the existing `coverage-map.ts` point at the Task 13/14 test files.

- [ ] **Step 4: Responder-loop operator runbook**

`docs/runbooks/phase-3c-responder-loop.md` covering: "What to check when a dispatch does not progress" — FCM failure rate panel, responders/{uid}.fcmTokens presence, `dispatch_mirror.skip` log entries, `report_events` tail to find the last actor, how to manually advance a stuck dispatch via the `cancelDispatch` + re-dispatch loop.

- [ ] **Step 5: `docs/progress.md`**

Append:

```markdown
## Phase 3c Responder Loop + E2E (Complete)

**Branch:** `feature/phase-3c-responder-loop-e2e`
**Plan:** See `docs/superpowers/plans/2026-04-18-phase-3c-responder-loop-e2e.md`

### Verification

| Step | Check                                                                             | Result  |
| ---- | --------------------------------------------------------------------------------- | ------- |
| 1    | `pnpm lint && pnpm typecheck`                                                     | PASS    |
| 2    | `pnpm test` (incl. 3c callable + trigger + rules tests)                           | PASS    |
| 3    | `firebase emulators:exec "pnpm exec tsx scripts/phase-3c/acceptance.ts"`          | PASS    |
| 4    | Playwright full-loop (emulator)                                                   | PASS    |
| 5    | Playwright race-loss (emulator)                                                   | PASS    |
| 6    | Staging acceptance (3 consecutive runs)                                           | PENDING |
| 7    | Playwright full-loop (staging, 3 consecutive runs)                                | PENDING |
| 8    | 24h dashboard soak (inbox backlog, dispatch rate, function errors, FCM fail rate) | PENDING |

## Phase 3 Exit Checklist (spec §10)

- [ ] `scripts/phase-3a/acceptance.ts` passes in staging
- [ ] `scripts/phase-3b/acceptance.ts` passes in staging, including cross-muni negatives
- [ ] `scripts/phase-3c/acceptance.ts` passes in staging, including race-loss recovery
- [ ] Full Playwright loop passes in staging on 3 consecutive runs
- [ ] Minimum dashboard shows live data for 24 continuous hours in staging
- [ ] `inboxReconciliationSweep` has fired at least once during 24h staging soak
- [ ] Rule-coverage CI gate extended to Phase 3 collections; 100% positive + negative
- [ ] Pre-deploy rules-concat script confirmed firing; CI drift-check gate green
- [ ] `docs/progress.md` updated with Phase 3 verification results
- [ ] `docs/learnings.md` updated with any new patterns discovered during implementation
- [ ] Phase 3 PRs merged to `main`; staging tagged `phase-3-complete`
```

- [ ] **Step 6: `docs/learnings.md`**

Append any non-obvious patterns discovered during implementation. Likely candidates:

- Service-worker scope for FCM: must be at site root, cannot be under a subpath. Vite needs a custom copy step.
- `vapidKey` + `serviceWorkerRegistration` options on `getToken` — both required; undocumented order-of-operations is: register SW, then `ready` promise, then `getToken`.
- Playwright cross-context race-loss test: requires two browser contexts (one per role), not two tabs, to preserve separate auth state.

- [ ] **Step 7: Final commit**

```bash
git add infra/terraform/modules/monitoring/phase-3/fcm-metrics.tf \
        infra/terraform/modules/monitoring/phase-3/mirror-metrics.tf \
        scripts/check-rule-coverage.ts \
        docs/runbooks/phase-3c-responder-loop.md \
        docs/progress.md \
        docs/learnings.md
git commit -m "docs(phase-3c): monitoring, rule coverage, runbooks, progress, exit checklist"
```

---

## End-of-Phase Gate Checklist (run before merging 3c → main)

- [ ] All 33 tasks above committed
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green locally
- [ ] Rules-drift CI gate green (from 3a)
- [ ] Rule-coverage gate extended (Task 33) and green
- [ ] `scripts/phase-3c/acceptance.ts` green on emulator
- [ ] `apps/e2e-tests` runs green on emulator for all five specs
- [ ] `scripts/phase-3c/acceptance.ts` green on staging
- [ ] Playwright full-loop + race-loss green on staging on 3 consecutive runs
- [ ] Dashboard panels for `fcm_sent`, `fcm_failed`, `dispatch_mirror_skip_report_missing` visible in staging Cloud Monitoring; 24h soak observed
- [ ] `inboxReconciliationSweep` has fired at least once during the 24h soak (verified via structured log query)
- [ ] `docs/progress.md` Phase 3 Exit Checklist fully checked
- [ ] PR description includes Firebase rules rollback command: `firebase deploy --only firestore:rules --project bantayog-alert-staging -- <prev-sha>`
- [ ] PR description includes FCM rollback: disable `fcm-send` feature flag in `system_config/features/fcm_send_enabled` (ships `true` by default; flip `false` as the kill switch)
- [ ] Staging tagged `phase-3-complete` after 24h soak

---

## Appendix — Risks and Notes

**Risk: `dispatch.correlationId` propagation.** The mirror trigger attempts to read `event.data?.after.data()?.correlationId`. If the dispatch was created before the 3a `correlationId` denormalization, the field may be absent. The trigger defaults to `crypto.randomUUID()` — harmless but breaks the single-correlation-per-report story for legacy dispatches. Acceptable for Phase 3 (no production data exists yet); the backfill path is a separate ticket if any pre-3c dispatches leak into production.

**Risk: Admin cancel races a responder's in-flight callable.** The flow we test is admin cancel → responder direct write rejected by rule. We do NOT test admin cancel racing a responder `acceptDispatch` callable — in that scenario, one of the two transactions loses on Firestore's optimistic concurrency control, and the loser retries. The retry sees the new state and branches correctly (`accept` sees `cancelled` and returns `already-exists`; `cancel` sees `accepted` and proceeds). This is covered implicitly by Task 5's ALREADY_EXISTS test and by the widened-cancel tests in Task 7 — but document it explicitly in the runbook so an on-call engineer knows the expected log shape.

**Risk: Service-worker caching.** If the FCM SW is cached by the browser and the app ships a config change (different `messagingSenderId`), the old SW is loaded and foreground messaging silently breaks. Mitigation: the SW includes a version stamp comment; on registration, compare against the latest build hash and call `registration.update()`. Captured in Task 24 implementation.

**Risk: `resolutionSummary` leaks into the mirror trigger.** The rule in Task 13 Step 2 requires `resolutionSummary` on `on_scene → resolved` via the dispatch write. The mirror trigger in Task 12 copies `reports.status` only; `resolutionSummary` stays on `dispatches`. Admin UI reads it off `dispatches` in the ReportDetailPanel. No cross-field leakage.

**Risk: `cancelDispatch` and `dispatchMirrorToReport` both might touch `reports.status`.** The trigger explicitly skips `cancelled` (Task 11 Step 2 `computeMirrorAction`) and the cancel callable owns the rewind to `verified`. This single-writer invariant is the reason for the skip — violating it causes a write-write race on `reports.status`. Unit tests for `computeMirrorAction` pin this explicitly.

**Forward-compat hooks preserved:**

- Responder direct-write rule's `affectedKeys().hasOnly(...)` allowlist is a single constant; Phase 6 field-notes feature extends it with `fieldNotes`.
- `dispatchToReportState` returns `null` for `cancelled` — keeps the mirror trigger trivially correct when Phase 5 adds `superseded` and its analogous cancel-owned rewind.
- `sendFcmToResponder` return type `{ warnings: string[] }` is stable; Phase 6's iOS Capacitor push wraps the same callable without changing the response contract.
- FCM service-worker source is at `apps/responder-app/src/sw/firebase-messaging-sw.ts`. Phase 6 replaces the web SW with a Capacitor-native handler; the same `acquireFcmToken` + `saveToken` flow applies, just with `@capacitor/push-notifications` instead.
- `computeMirrorAction` is pure and exported; Phase 5 duplicate-cluster merging will reuse it when re-dispatching against a merged parent report.

**Note: Why Playwright against emulator gates `main` but not staging.** Emulator runs are deterministic and fast (single-digit seconds); they catch the bulk of regressions. Staging runs are slow (30s+ with real FCM) and flaky around notification timing; we limit them to release-candidate tags to keep merge feedback on `main` fast. The 3 consecutive green runs requirement at Phase 3 exit is the quality gate — not every commit.

**Note: Why the accept auto-advance is a separate effect, not bundled into the callable.** `acceptDispatch` transitions `pending → accepted`. The `accepted → acknowledged` auto-advance is a UI concern (spec §5.8: "auto-advances on accept screen render"). Keeping it out of the callable means that a responder who opens the detail page with `status: accepted` (e.g., they accepted, closed the tab, re-opened) still progresses to `acknowledged` without requiring a Cloud Functions round-trip. Small but real latency win; also keeps the callable pure.

---

**End of Phase 3c Implementation Plan**
