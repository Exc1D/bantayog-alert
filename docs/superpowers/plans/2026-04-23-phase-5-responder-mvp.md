# Phase 5 Responder MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the responder MVP dispatch loop: queue, detail, accept, decline, state progression, terminal race-loss/cancelled handling, offline mutation blocking, and notification-driven direct entry.

**Architecture:** Keep the existing two-route responder app (`/` and `/dispatches/:dispatchId`) and tighten it instead of inventing a larger shell. Add one backend callable for responder decline, push UI status collapsing into small pure helpers, and let the pages stay thin wrappers around Firestore listeners plus callable hooks.

**Tech Stack:** Firebase Functions v2, Firestore SDK v12, React 19, React Router 7, TypeScript, Vitest, Playwright.

---

## File Map

| File                                                         | Action | Responsibility                                                            |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------- |
| `functions/src/callables/decline-dispatch.ts`                | create | responder decline callable with reason validation and idempotency         |
| `functions/src/index.ts`                                     | modify | export decline callable                                                   |
| `functions/src/__tests__/callables/decline-dispatch.test.ts` | create | emulator-backed callable tests for decline behavior                       |
| `apps/responder-app/src/hooks/useDeclineDispatch.ts`         | create | client hook for decline callable                                          |
| `apps/responder-app/src/lib/dispatch-presentation.ts`        | create | pure UI-state mapping, grouping, auto-entry, terminal-screen decisions    |
| `apps/responder-app/src/lib/dispatch-presentation.test.ts`   | create | unit tests for responder UI mapping                                       |
| `apps/responder-app/src/hooks/useOwnDispatches.ts`           | modify | expose presentation-friendly fields for queue cards                       |
| `apps/responder-app/src/hooks/useDispatch.ts`                | modify | expose normalized detail doc fields used by terminal routing              |
| `apps/responder-app/src/pages/DispatchListPage.tsx`          | modify | pending/active sections, accept/decline buttons, single-active auto-entry |
| `apps/responder-app/src/pages/DispatchDetailPage.tsx`        | modify | collapsed UI states, offline mutation gating, terminal routing            |
| `apps/responder-app/src/pages/CancelledScreen.tsx`           | modify | institutional-only cancellation screen with return-to-queue CTA           |
| `apps/responder-app/src/pages/RaceLossScreen.tsx`            | create | dedicated “no longer active” screen                                       |
| `apps/responder-app/src/routes.tsx`                          | modify | optional terminal route or in-detail rendering wiring                     |
| `e2e-tests/specs/responder.spec.ts`                          | modify | unskip Phase 5 responder happy-path coverage                              |
| `e2e-tests/specs/race-loss.spec.ts`                          | modify | unskip race-loss/cancelled terminal coverage                              |
| `docs/progress.md`                                           | modify | record Phase 5 responder MVP status after implementation                  |
| `docs/learnings.md`                                          | modify | capture any new responder-flow/testing lessons after implementation       |

---

### Task 1: Add backend decline callable first (TDD)

**Files:**

- Create: `functions/src/callables/decline-dispatch.ts`
- Modify: `functions/src/index.ts`
- Create: `functions/src/__tests__/callables/decline-dispatch.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/__tests__/callables/decline-dispatch.test.ts` with:

```ts
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { declineDispatchCore } from '../../callables/decline-dispatch.js'
import { seedActiveAccount, seedDispatch, seedReportAtStatus } from '../helpers/seed-factories.js'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'decline-dispatch-test',
    firestore: { host: 'localhost', port: 8080 },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('declineDispatchCore', () => {
  it('declines a pending dispatch with a required reason', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'pending',
    })
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    const result = await declineDispatchCore(db, {
      dispatchId,
      declineReason: 'Already handling another incident',
      idempotencyKey: crypto.randomUUID(),
      actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('declined')

    const dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
    expect(dispatch.status).toBe('declined')
    expect(dispatch.declineReason).toBe('Already handling another incident')
  })

  it('rejects when declineReason is blank', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'pending',
    })
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await expect(
      declineDispatchCore(db, {
        dispatchId,
        declineReason: '   ',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it('rejects when dispatch is not pending', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'accepted',
    })
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await expect(
      declineDispatchCore(db, {
        dispatchId,
        declineReason: 'Too far away',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })
  })
})
```

- [ ] **Step 2: Run the failing test**

Run from repo root:

```bash
pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/decline-dispatch.test.ts
```

Expected: FAIL with module-not-found for `decline-dispatch.js`.

- [ ] **Step 3: Implement the callable**

Create `functions/src/callables/decline-dispatch.ts` using the same structure as `accept-dispatch.ts` and `advance-dispatch.ts`:

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminDb } from '../admin-init.js'
import {
  BantayogError,
  BantayogErrorCode,
  type DispatchDoc,
  invalidTransitionError,
} from '@bantayog/shared-validators'
import { withIdempotency } from '../idempotency/guard.js'
import { bantayogErrorToHttps, requireAuth } from './https-error.js'

export const declineDispatchRequestSchema = z.object({
  dispatchId: z.string().min(1),
  declineReason: z.string().trim().min(1),
  idempotencyKey: z.uuid(),
})

export async function declineDispatchCore(
  db: FirebaseFirestore.Firestore,
  req: z.infer<typeof declineDispatchRequestSchema> & {
    actor: { uid: string; claims: { role: string; municipalityId?: string } }
    now: Timestamp
  },
) {
  const { dispatchId, declineReason, idempotencyKey, actor, now } = req
  const { now: _now, ...idempotentPayload } = req

  const { result } = await withIdempotency(
    db,
    {
      key: `declineDispatch:${actor.uid}:${idempotencyKey}`,
      payload: idempotentPayload,
      now: () => now.toMillis(),
    },
    async () =>
      db.runTransaction(async (transaction) => {
        const dispatchRef = db.collection('dispatches').doc(dispatchId)
        const dispatchSnap = await transaction.get(dispatchRef)

        if (!dispatchSnap.exists) {
          throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found')
        }

        const dispatch = dispatchSnap.data() as DispatchDoc

        if (actor.claims.role !== 'responder' || dispatch.assignedTo.uid !== actor.uid) {
          throw new BantayogError(
            BantayogErrorCode.FORBIDDEN,
            'Only assigned responder can decline',
          )
        }

        if (dispatch.status !== 'pending') {
          throw invalidTransitionError(dispatch.status, 'declined', {
            code: BantayogErrorCode.INVALID_STATUS_TRANSITION,
          })
        }

        transaction.update(dispatchRef, {
          status: 'declined',
          declineReason,
          statusUpdatedAt: now.toMillis(),
          lastStatusAt: now,
        })

        transaction.set(db.collection('dispatch_events').doc(), {
          dispatchId,
          from: dispatch.status,
          to: 'declined',
          actorUid: actor.uid,
          actorRole: actor.claims.role,
          createdAt: now.toMillis(),
        })

        return { status: 'declined' as const }
      }),
  )

  return result
}

export const declineDispatch = onCall(
  { enforceAppCheck: true, consumeAppCheckToken: false },
  async (request) => {
    const actor = requireAuth(request, ['responder'])

    try {
      const data = declineDispatchRequestSchema.parse(request.data)
      return await declineDispatchCore(adminDb, {
        ...data,
        actor: {
          uid: actor.uid,
          claims: actor.claims as { role: string; municipalityId?: string },
        },
        now: Timestamp.now(),
      })
    } catch (error) {
      if (error instanceof BantayogError) throw bantayogErrorToHttps(error)
      if (error instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', error.issues[0]?.message ?? 'Invalid argument')
      }
      throw error
    }
  },
)
```

- [ ] **Step 4: Export the callable**

Add to `functions/src/index.ts`:

```ts
export { declineDispatch } from './callables/decline-dispatch.js'
```

- [ ] **Step 5: Run callable verification**

```bash
pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/decline-dispatch.test.ts
pnpm --filter @bantayog/functions typecheck
pnpm --filter @bantayog/functions lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add functions/src/callables/decline-dispatch.ts functions/src/index.ts functions/src/__tests__/callables/decline-dispatch.test.ts
git commit -m "feat(functions): add responder decline dispatch callable"
```

---

### Task 2: Add pure responder presentation helpers before touching pages (TDD)

**Files:**

- Create: `apps/responder-app/src/lib/dispatch-presentation.ts`
- Create: `apps/responder-app/src/lib/dispatch-presentation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/responder-app/src/lib/dispatch-presentation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  getResponderUiState,
  groupDispatchRows,
  getSingleActiveDispatchId,
  getTerminalSurface,
} from './dispatch-presentation.js'

describe('dispatch-presentation', () => {
  it('collapses accepted, acknowledged, and en_route into heading_to_scene', () => {
    expect(getResponderUiState('accepted')).toBe('heading_to_scene')
    expect(getResponderUiState('acknowledged')).toBe('heading_to_scene')
    expect(getResponderUiState('en_route')).toBe('heading_to_scene')
  })

  it('maps on_scene to on_scene', () => {
    expect(getResponderUiState('on_scene')).toBe('on_scene')
  })

  it('groups pending and active rows separately', () => {
    const grouped = groupDispatchRows([
      { dispatchId: 'd1', reportId: 'r1', status: 'pending', dispatchedAt: 3 },
      { dispatchId: 'd2', reportId: 'r2', status: 'acknowledged', dispatchedAt: 2 },
      { dispatchId: 'd3', reportId: 'r3', status: 'on_scene', dispatchedAt: 1 },
    ])

    expect(grouped.pending.map((row) => row.dispatchId)).toEqual(['d1'])
    expect(grouped.active.map((row) => row.dispatchId)).toEqual(['d2', 'd3'])
  })

  it('returns the single active dispatch id only when exactly one active exists', () => {
    expect(getSingleActiveDispatchId([{ dispatchId: 'd1', status: 'en_route' }])).toBe('d1')
    expect(
      getSingleActiveDispatchId([
        { dispatchId: 'd1', status: 'en_route' },
        { dispatchId: 'd2', status: 'on_scene' },
      ]),
    ).toBeNull()
  })

  it('maps cancelled and timed_out to cancelled terminal surface', () => {
    expect(getTerminalSurface('cancelled')).toBe('cancelled')
    expect(getTerminalSurface('timed_out')).toBe('cancelled')
  })

  it('maps already-exists accept failures to race-loss terminal surface', () => {
    expect(getTerminalSurface('already-exists')).toBe('race_loss')
  })
})
```

- [ ] **Step 2: Run the failing test**

```bash
pnpm exec vitest run apps/responder-app/src/lib/dispatch-presentation.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the helpers**

Create `apps/responder-app/src/lib/dispatch-presentation.ts`:

```ts
import type { DispatchStatus } from '@bantayog/shared-types'

export type ResponderUiState = 'pending' | 'heading_to_scene' | 'on_scene' | 'resolved' | 'terminal'
export type TerminalSurface = 'cancelled' | 'race_loss' | null

export interface QueueDispatchRow {
  dispatchId: string
  reportId: string
  status: DispatchStatus
  dispatchedAt: number
}

export function getResponderUiState(status: DispatchStatus): ResponderUiState {
  if (status === 'pending') return 'pending'
  if (status === 'accepted' || status === 'acknowledged' || status === 'en_route') {
    return 'heading_to_scene'
  }
  if (status === 'on_scene') return 'on_scene'
  if (status === 'resolved') return 'resolved'
  return 'terminal'
}

export function groupDispatchRows(rows: QueueDispatchRow[]) {
  return {
    pending: rows.filter((row) => row.status === 'pending'),
    active: rows.filter((row) =>
      ['accepted', 'acknowledged', 'en_route', 'on_scene'].includes(row.status),
    ),
  }
}

export function getSingleActiveDispatchId(
  rows: Array<{ dispatchId: string; status: DispatchStatus }>,
) {
  const active = rows.filter((row) =>
    ['accepted', 'acknowledged', 'en_route', 'on_scene'].includes(row.status),
  )
  return active.length === 1 ? active[0].dispatchId : null
}

export function getTerminalSurface(statusOrCode: string): TerminalSurface {
  if (statusOrCode === 'cancelled' || statusOrCode === 'timed_out') return 'cancelled'
  if (statusOrCode === 'already-exists') return 'race_loss'
  return null
}
```

- [ ] **Step 4: Run the helper test**

```bash
pnpm exec vitest run apps/responder-app/src/lib/dispatch-presentation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/src/lib/dispatch-presentation.ts apps/responder-app/src/lib/dispatch-presentation.test.ts
git commit -m "test(responder-app): add responder dispatch presentation helpers"
```

---

### Task 3: Add client decline hook and normalize existing hooks

**Files:**

- Create: `apps/responder-app/src/hooks/useDeclineDispatch.ts`
- Modify: `apps/responder-app/src/hooks/useOwnDispatches.ts`
- Modify: `apps/responder-app/src/hooks/useDispatch.ts`

- [ ] **Step 1: Write the failing hook-adjacent test**

Extend `apps/responder-app/src/lib/dispatch-presentation.test.ts` with a shape check that depends on normalized status types:

```ts
it('treats pending rows as pending and on_scene rows as active', () => {
  const grouped = groupDispatchRows([
    { dispatchId: 'd1', reportId: 'r1', status: 'pending', dispatchedAt: 2 },
    { dispatchId: 'd2', reportId: 'r2', status: 'on_scene', dispatchedAt: 1 },
  ])

  expect(grouped.pending).toHaveLength(1)
  expect(grouped.active).toHaveLength(1)
})
```

Run:

```bash
pnpm exec vitest run apps/responder-app/src/lib/dispatch-presentation.test.ts
```

Expected: PASS. This keeps the pure helper green before wiring page code.

- [ ] **Step 2: Implement decline hook**

Create `apps/responder-app/src/hooks/useDeclineDispatch.ts`:

```ts
import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'

export function useDeclineDispatch(dispatchId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)

  async function decline(declineReason: string) {
    setLoading(true)
    setError(undefined)
    try {
      const fn = httpsCallable<
        { dispatchId: string; declineReason: string; idempotencyKey: string },
        { status: string }
      >(functions, 'declineDispatch')

      await fn({
        dispatchId,
        declineReason,
        idempotencyKey: crypto.randomUUID(),
      })
    } catch (err: unknown) {
      if (err instanceof Error) setError(err)
      else setError(new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }

  return { decline, loading, error }
}
```

- [ ] **Step 3: Normalize queue and detail hook types**

In `apps/responder-app/src/hooks/useOwnDispatches.ts`:

```ts
import type { DispatchStatus } from '@bantayog/shared-types'

export interface OwnDispatchRow {
  dispatchId: string
  reportId: string
  status: DispatchStatus
  dispatchedAt: number
  acknowledgementDeadlineAt?: number
  cancelReason?: string
}
```

Map Firestore data to numbers consistently:

```ts
status: String(data.status) as DispatchStatus,
dispatchedAt: Number(data.dispatchedAt),
```

In `apps/responder-app/src/hooks/useDispatch.ts`, normalize:

```ts
status: snap.data().status as DispatchStatus,
cancelReason: typeof snap.data().cancelReason === 'string' ? snap.data().cancelReason : undefined,
cancelledBy: typeof snap.data().cancelledBy === 'string' ? snap.data().cancelledBy : undefined,
```

- [ ] **Step 4: Run verification**

```bash
pnpm exec vitest run apps/responder-app/src/lib/dispatch-presentation.test.ts
pnpm --filter @bantayog/responder-app typecheck
pnpm --filter @bantayog/responder-app lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/src/hooks/useDeclineDispatch.ts apps/responder-app/src/hooks/useOwnDispatches.ts apps/responder-app/src/hooks/useDispatch.ts apps/responder-app/src/lib/dispatch-presentation.test.ts
git commit -m "feat(responder-app): add decline hook and normalize dispatch hooks"
```

---

### Task 4: Rebuild the queue page around pending/active behavior

**Files:**

- Modify: `apps/responder-app/src/pages/DispatchListPage.tsx`
- Modify: `apps/responder-app/src/routes.tsx`

- [ ] **Step 1: Add the failing presentation test for auto-entry**

Extend `apps/responder-app/src/lib/dispatch-presentation.test.ts`:

```ts
it('does not auto-open when there are pending-only rows', () => {
  expect(getSingleActiveDispatchId([{ dispatchId: 'd1', status: 'pending' }])).toBeNull()
})
```

Run:

```bash
pnpm exec vitest run apps/responder-app/src/lib/dispatch-presentation.test.ts
```

Expected: PASS.

- [ ] **Step 2: Rewrite the queue page with grouped sections**

In `apps/responder-app/src/pages/DispatchListPage.tsx`, replace the flat list with:

```tsx
const grouped = groupDispatchRows(rows)
const singleActiveDispatchId = getSingleActiveDispatchId(rows)

useEffect(() => {
  if (singleActiveDispatchId) {
    navigate(`/dispatches/${singleActiveDispatchId}`, { replace: true })
  }
}, [navigate, singleActiveDispatchId])
```

For pending cards:

```tsx
<button onClick={() => void accept()} disabled={accepting || mutationBlocked}>
  {accepting ? 'Accepting…' : 'Accept'}
</button>
<button onClick={() => setDeclineTarget(row.dispatchId)} disabled={mutationBlocked}>
  Decline
</button>
```

For active cards:

```tsx
<Link to={`/dispatches/${row.dispatchId}`}>
  <strong>
    {getResponderUiState(row.status) === 'on_scene' ? 'On scene' : 'Heading to scene'}
  </strong>
</Link>
```

Render sections in this order:

```tsx
<section>
  <h2>Pending</h2>
  ...
</section>
<section>
  <h2>Active</h2>
  ...
</section>
```

- [ ] **Step 3: Add a minimal decline dialog inline**

Use local component state instead of a new file:

```tsx
const [declineReason, setDeclineReason] = useState('')
const [declineTarget, setDeclineTarget] = useState<string | null>(null)
```

Render:

```tsx
{
  declineTarget && (
    <div>
      <label>
        Reason
        <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
      </label>
      <button
        onClick={() => {
          if (!declineReason.trim()) return
          void decline(declineReason)
        }}
      >
        Confirm decline
      </button>
      <button onClick={() => setDeclineTarget(null)}>Cancel</button>
    </div>
  )
}
```

- [ ] **Step 4: Add offline mutation gating**

Inside `DispatchListPage`:

```tsx
const mutationBlocked = typeof navigator !== 'undefined' && !navigator.onLine
```

When blocked, render:

```tsx
<p style={{ color: 'orange' }}>Reconnect to accept or decline dispatches.</p>
```

- [ ] **Step 5: Run verification**

```bash
pnpm exec vitest run apps/responder-app/src/lib/dispatch-presentation.test.ts
pnpm --filter @bantayog/responder-app typecheck
pnpm --filter @bantayog/responder-app lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/responder-app/src/pages/DispatchListPage.tsx apps/responder-app/src/routes.tsx apps/responder-app/src/lib/dispatch-presentation.test.ts
git commit -m "feat(responder-app): rebuild dispatch queue for pending and active flows"
```

---

### Task 5: Rebuild the detail page and terminal screens

**Files:**

- Modify: `apps/responder-app/src/pages/DispatchDetailPage.tsx`
- Modify: `apps/responder-app/src/pages/CancelledScreen.tsx`
- Create: `apps/responder-app/src/pages/RaceLossScreen.tsx`

- [ ] **Step 1: Write the failing helper test for terminal routing**

Extend `apps/responder-app/src/lib/dispatch-presentation.test.ts`:

```ts
it('returns null terminal surface for active statuses', () => {
  expect(getTerminalSurface('on_scene')).toBeNull()
  expect(getTerminalSurface('en_route')).toBeNull()
})
```

Run:

```bash
pnpm exec vitest run apps/responder-app/src/lib/dispatch-presentation.test.ts
```

Expected: PASS.

- [ ] **Step 2: Remove the auto-advance from accepted to acknowledged**

Delete this behavior from `DispatchDetailPage.tsx`:

```tsx
useEffect(() => {
  if (dispatch?.status === 'accepted' && !advanceAttemptedRef.current) {
    advanceAttemptedRef.current = true
    void advance('acknowledged')
  }
}, [dispatch?.status, advance])
```

Phase 5 UI collapses `accepted` and `acknowledged`; the screen should not hide a mutation behind mount side effects.

- [ ] **Step 3: Render the collapsed action model**

Inside `DispatchDetailPage.tsx`:

```tsx
const uiState = getResponderUiState(dispatch.status)
const mutationBlocked = typeof navigator !== 'undefined' && !navigator.onLine
```

Pending actions:

```tsx
{
  dispatch.status === 'pending' && (
    <>
      <button onClick={() => void accept()} disabled={accepting || mutationBlocked}>
        {accepting ? 'Accepting…' : 'Accept'}
      </button>
      <button onClick={() => setDeclineOpen(true)} disabled={mutationBlocked}>
        Decline
      </button>
    </>
  )
}
```

Heading-to-scene action:

```tsx
{
  uiState === 'heading_to_scene' && (
    <button onClick={() => void advance('on_scene')} disabled={advanceLoading || mutationBlocked}>
      On scene
    </button>
  )
}
```

On-scene action:

```tsx
{
  uiState === 'on_scene' && (
    <ResolveForm
      onSubmit={(summary) => {
        void advance('resolved', { resolutionSummary: summary })
      }}
    />
  )
}
```

- [ ] **Step 4: Route race-loss and cancelled states to dedicated screens**

Add `RaceLossScreen.tsx`:

```tsx
import { Link } from 'react-router-dom'

export function RaceLossScreen() {
  return (
    <main>
      <h1>This dispatch is no longer active</h1>
      <p>Another update reached the server before your action completed.</p>
      <p>
        <Link to="/">Return to queue</Link>
      </p>
    </main>
  )
}
```

Tighten `CancelledScreen.tsx`:

```tsx
<h1>This dispatch was cancelled</h1>
<p>The assignment is no longer active.</p>
{reason && <p>Reason: {reason}</p>}
```

In `DispatchDetailPage.tsx`:

```tsx
if (dispatch.status === 'cancelled' || dispatch.status === 'timed_out') {
  return <CancelledScreen dispatch={dispatch} />
}

if (acceptError?.message.includes('already-exists')) {
  return <RaceLossScreen />
}
```

- [ ] **Step 5: Run verification**

```bash
pnpm exec vitest run apps/responder-app/src/lib/dispatch-presentation.test.ts
pnpm --filter @bantayog/responder-app typecheck
pnpm --filter @bantayog/responder-app lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/responder-app/src/pages/DispatchDetailPage.tsx apps/responder-app/src/pages/CancelledScreen.tsx apps/responder-app/src/pages/RaceLossScreen.tsx apps/responder-app/src/lib/dispatch-presentation.test.ts
git commit -m "feat(responder-app): add responder detail terminal state handling"
```

---

### Task 6: Unskip E2E coverage for the agreed Phase 5 slice

**Files:**

- Modify: `e2e-tests/specs/responder.spec.ts`
- Modify: `e2e-tests/specs/race-loss.spec.ts`

- [ ] **Step 1: Replace the responder spec stubs with real test names and assumptions**

In `e2e-tests/specs/responder.spec.ts`, replace the skipped dispatch tests with:

```ts
test('shows empty state when no dispatches', async () => {
  // Seed responder with no active dispatches
})

test('accepts a pending dispatch and lands in heading-to-scene flow', async () => {
  // Seed pending dispatch, log in, accept, verify detail page action is "On scene"
})

test('declines a pending dispatch with a reason', async () => {
  // Seed pending dispatch, decline with reason, verify it disappears from queue
})

test('resolves an on-scene dispatch with a required summary', async () => {
  // Seed on_scene dispatch, require summary, resolve, verify no longer active
})
```

- [ ] **Step 2: Replace the race-loss stubs with terminal-state expectations**

In `e2e-tests/specs/race-loss.spec.ts`:

```ts
test('responder sees cancelled screen when admin cancels after accept', async () => {
  // Verify dedicated cancelled screen, not inline error text
})

test('accept race-loss shows no-longer-active screen', async () => {
  // Verify dedicated race-loss screen, not generic error banner
})
```

- [ ] **Step 3: Run targeted E2E**

Run from repo root after local emulator setup is working:

```bash
pnpm --filter @bantayog/e2e-tests exec playwright test specs/responder.spec.ts specs/race-loss.spec.ts
```

Expected: PASS locally against the emulator-backed setup.

- [ ] **Step 4: Commit**

```bash
git add e2e-tests/specs/responder.spec.ts e2e-tests/specs/race-loss.spec.ts
git commit -m "test(e2e): cover responder phase 5 dispatch loop"
```

---

### Task 7: Record outcome and close the loop

**Files:**

- Modify: `docs/progress.md`
- Modify: `docs/learnings.md`

- [ ] **Step 1: Update progress**

Add a new entry near the top of `docs/progress.md`:

```md
### Phase 5 Responder MVP — dispatch loop (2026-04-23)

- Status: DONE locally / IN PROGRESS / BLOCKED
- Scope:
  - responder queue split into pending + active
  - accept + decline with required reason
  - collapsed detail state model
  - cancelled and race-loss terminal screens
  - offline mutation blocking
- Verification:
  - `pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/decline-dispatch.test.ts`
  - `pnpm --filter @bantayog/functions typecheck`
  - `pnpm --filter @bantayog/functions lint`
  - `pnpm --filter @bantayog/responder-app typecheck`
  - `pnpm --filter @bantayog/responder-app lint`
  - `pnpm --filter @bantayog/e2e-tests exec playwright test specs/responder.spec.ts specs/race-loss.spec.ts`
```

- [ ] **Step 2: Update learnings**

Append only if a real lesson was discovered during implementation. Example format:

```md
- Responder dispatch UI should not auto-advance status on mount; hidden mutations make race handling and incident review harder to reason about.
```

- [ ] **Step 3: Commit**

```bash
git add docs/progress.md docs/learnings.md
git commit -m "docs(state): record phase 5 responder mvp progress"
```

---

## Verification Checklist

Run the full Phase 5 slice before claiming completion:

```bash
pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/decline-dispatch.test.ts src/__tests__/callables/accept-dispatch.test.ts src/__tests__/callables/advance-dispatch.test.ts
pnpm --filter @bantayog/functions typecheck
pnpm --filter @bantayog/functions lint
pnpm exec vitest run apps/responder-app/src/lib/dispatch-presentation.test.ts
pnpm --filter @bantayog/responder-app typecheck
pnpm --filter @bantayog/responder-app lint
pnpm --filter @bantayog/e2e-tests exec playwright test specs/responder.spec.ts specs/race-loss.spec.ts
```

Expected final state:

- decline callable passes emulator-backed tests
- responder app typechecks and lints cleanly
- pure UI mapping tests pass
- race-loss and cancelled flows are dedicated terminal screens
- pending and active queue sections behave as agreed

## Spec Coverage Review

- Covered:
  - accept + decline
  - collapsed responder UI state model
  - pending/active queue split
  - dedicated terminal screens
  - offline mutation blocking
  - single-active auto-entry
- Explicitly deferred:
  - telemetry/location sharing
  - witnessed responder reports
  - SOS
  - backup/escalation requests
  - field notes/photos
  - handoff
  - metrics
  - auth hardening
- Open mismatch to settle during implementation if copy is touched:
  - architecture spec prefers institutional attribution on cancellation/race-loss surfaces
  - role spec mentions named admin visibility in some responder contexts

Plan complete and saved to `docs/superpowers/plans/2026-04-23-phase-5-responder-mvp.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
