# Reliability Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the core Citizen PWA -> backend -> Admin Desktop -> Citizen alerts -> Responder App loop deterministic locally and staging-ready, with explicit checkpoint failures instead of ambiguous "nothing showed up" debugging.

**Architecture:** Keep product behavior unchanged except for required contract fixes and stable test hooks. Use focused unit tests for blocking contracts, then one Playwright proof harness that drives user-visible app flows and verifies hidden Firestore checkpoints by exact run ids. Local mode runs the manual inbox processor visibly; staging mode relies on deployed functions and exact-id cleanup.

**Tech Stack:** TypeScript, React, Firebase Auth/Firestore/Functions, Firebase Admin SDK, Playwright, Vitest, pnpm workspaces, Cloud Functions region `asia-southeast1`.

---

## File Map

### Modified Files

| File                                                           | Responsibility                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `functions/src/callables/declare-alert.ts`                     | Add citizen-visible `publishedAt` timestamp while preserving existing `declaredAt`.       |
| `functions/src/__tests__/callables/declare-alert.test.ts`      | Lock the alert timestamp contract.                                                        |
| `packages/shared-firebase/src/firestore.test.ts`               | Lock the Citizen PWA alert query field and snapshot mapping.                              |
| `functions/scripts/process-inbox-manual.ts`                    | Return structured processor summaries and exit non-zero on processing failures.           |
| `functions/src/__tests__/triggers/process-inbox-item.test.ts`  | Tighten materialization and replay assertions required by C02/C09.                        |
| `functions/src/__tests__/callables/dispatch-responder.test.ts` | Assert responder-listener fields on created dispatch docs.                                |
| `apps/responder-app/src/hooks/useOwnDispatches.test.ts`        | Assert the responder listener uses `assignedTo.uid`, active statuses, and `dispatchedAt`. |
| `apps/admin-desktop/src/components/TriageQueueTable.tsx`       | Add stable `data-testid` hooks for exact report rows.                                     |
| `apps/admin-desktop/src/components/TriagePanel.tsx`            | Add stable `data-testid` hooks for exact report panel/actions.                            |
| `apps/citizen-pwa/src/components/AlertsTab.tsx`                | Add stable `data-testid` hooks for exact alert cards.                                     |
| `apps/responder-app/src/pages/DispatchListPage.tsx`            | Add stable `data-testid` hooks for exact dispatch cards.                                  |
| `apps/responder-app/src/pages/DispatchDetailPage.tsx`          | Add stable `data-testid` hooks for exact dispatch status/progression.                     |
| `scripts/dev-all.mjs`                                          | Align Admin Desktop and Responder App ports with Playwright/Vite defaults.                |
| `e2e-tests/package.json`                                       | Add the dependencies/scripts needed by the proof harness.                                 |
| `e2e-tests/specs/full-loop.spec.ts`                            | Replace skipped placeholder with executable Reliability Spine proof.                      |
| `docs/learnings.md`                                            | Record contract and harness decisions after implementation.                               |
| `docs/progress.md`                                             | Record completed Reliability Spine implementation status.                                 |

### New Files

| File                                             | Responsibility                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `functions/scripts/process-inbox-manual.test.ts` | Unit-test structured processor summary and failure exit behavior without depending on CLI output.                             |
| `scripts/dev-all.ports.test.ts`                  | Prevent port drift from returning.                                                                                            |
| `e2e-tests/fixtures/reliability-spine.ts`        | Shared proof ledger, Firebase Admin helpers, checkpoint JSON, cleanup, waiters, seed preflight, and manual processor wrapper. |

---

## Task Dependency Graph

```text
Task 1 ─┬─> Task 8 ─┬─> Task 9 ─> Task 10
Task 2 ─┤           │
Task 3 ─┤           │
Task 4 ─┤           │
Task 5 ─┤           │
Task 6 ─┤           │
Task 7 ─┘           │
Task 11 ────────────┘
```

Tasks 1-7 fix or lock contracts. Task 8 adds the reusable proof spine. Task 9 replaces the skipped smoke test. Task 10 adds staging mode and cleanup. Task 11 updates operator memory after the implementation is verified.

---

## Task 1: Fix Alert Timestamp Contract

**Files:**

- Modify: `functions/src/__tests__/callables/declare-alert.test.ts`
- Modify: `functions/src/callables/declare-alert.ts`

- [ ] **Step 1: Add the failing test**

Add this assertion to the successful declaration test after reading the written alert doc:

```typescript
expect(alertDoc.declaredAt).toBeDefined()
expect(alertDoc.publishedAt).toBe(alertDoc.declaredAt)
```

- [ ] **Step 2: Run red**

Run:

```bash
pnpm --dir functions exec vitest run src/__tests__/callables/declare-alert.test.ts
```

Expected: FAIL because `publishedAt` is missing on the written alert doc.

- [ ] **Step 3: Implement the smallest fix**

In `declareAlertCore`, keep `declaredAt` and add `publishedAt` from the same `now` value:

```typescript
const alertDoc = {
  ...parsed,
  alertId,
  declaredBy: actor.uid,
  declaredAt: now,
  publishedAt: now,
  status: 'active',
}
```

- [ ] **Step 4: Verify green**

Run:

```bash
pnpm --dir functions exec vitest run src/__tests__/callables/declare-alert.test.ts
pnpm --dir functions exec tsc --noEmit
```

Expected: PASS, with no TypeScript errors.

- [ ] **Step 5: Re-read and inspect diff**

Run:

```bash
git diff -- functions/src/callables/declare-alert.ts functions/src/__tests__/callables/declare-alert.test.ts
```

Expected: only the `publishedAt` contract and test changed.

- [ ] **Step 6: Commit**

```bash
git add functions/src/callables/declare-alert.ts functions/src/__tests__/callables/declare-alert.test.ts
git commit -m "fix(functions): publish alert timestamp for citizen listeners"
```

---

## Task 2: Lock Citizen Alert Listener Contract

**Files:**

- Create or modify: `packages/shared-firebase/src/firestore.test.ts`

- [ ] **Step 1: Write the failing contract test**

Create a test that mocks Firestore query builders and proves `subscribeAlerts` orders by `publishedAt`.

```typescript
import { describe, expect, it, vi } from 'vitest'

const orderByMock = vi.fn((field: string, direction: string) => ({ field, direction }))
const onSnapshotMock = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name: string) => ({ name })),
  limit: vi.fn((count: number) => ({ count })),
  onSnapshot: onSnapshotMock,
  orderBy: orderByMock,
  query: vi.fn((...parts: unknown[]) => ({ parts })),
}))

describe('subscribeAlerts', () => {
  it('orders by the citizen-visible publishedAt field', async () => {
    const { subscribeAlerts } = await import('./firestore')

    onSnapshotMock.mockReturnValue(() => undefined)
    subscribeAlerts({} as never, () => undefined)

    expect(orderByMock).toHaveBeenCalledWith('publishedAt', 'desc')
  })
})
```

- [ ] **Step 2: Run red or green-with-proof**

Run:

```bash
pnpm --dir packages/shared-firebase exec vitest run src/firestore.test.ts
```

Expected: PASS if current implementation already uses `publishedAt`. If the package lacks a local Vitest command, use:

```bash
pnpm exec vitest run packages/shared-firebase/src/firestore.test.ts
```

- [ ] **Step 3: Add snapshot mapping assertion**

Extend the test to invoke the `onSnapshot` success callback with a fake document:

```typescript
const unsubscribe = () => undefined
onSnapshotMock.mockImplementation((_query, onNext) => {
  onNext({
    docs: [
      {
        id: 'alert-proof-1',
        data: () => ({
          title: 'Flood',
          body: '[TEST:proof-1] water rising',
          severity: 'high',
          publishedAt: 1_765_641_600_000,
        }),
      },
    ],
  })
  return unsubscribe
})
```

Assert the callback receives `id`, `body`, and `publishedAt`.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm exec vitest run packages/shared-firebase/src/firestore.test.ts
pnpm typecheck
```

Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared-firebase/src/firestore.test.ts
git commit -m "test(shared-firebase): lock alert listener timestamp field"
```

---

## Task 3: Make Manual Inbox Processing Observable

**Files:**

- Create: `functions/scripts/process-inbox-manual.test.ts`
- Modify: `functions/scripts/process-inbox-manual.ts`

- [ ] **Step 1: Write the failing test**

Refactor target behavior before implementation:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { processUnprocessedInboxItems } from './process-inbox-manual'

describe('processUnprocessedInboxItems', () => {
  it('returns a structured summary for processed inbox docs', async () => {
    const processInboxItemCore = vi.fn().mockResolvedValue({ reportId: 'report-1' })
    const db = fakeDbWithInboxDocs([{ id: 'draft-1', data: { processedAt: undefined } }])

    const summary = await processUnprocessedInboxItems({ db, processInboxItemCore })

    expect(summary).toMatchObject({
      candidateCount: 1,
      processedCount: 1,
      failedCount: 0,
    })
    expect(summary.results).toContainEqual({
      clientDraftRef: 'draft-1',
      status: 'processed',
      reportId: 'report-1',
    })
  })
})
```

Use a small local fake for `db.collection('report_inbox').where(...).get()` rather than a Firebase emulator in this unit test.

- [ ] **Step 2: Run red**

Run:

```bash
pnpm --dir functions exec vitest run scripts/process-inbox-manual.test.ts
```

Expected: FAIL because `processUnprocessedInboxItems` is not exported.

- [ ] **Step 3: Refactor the script around an exported function**

Keep the CLI behavior, but make the logic testable:

```typescript
export interface ManualInboxProcessSummary {
  candidateCount: number
  processedCount: number
  skippedCount: number
  failedCount: number
  results: Array<
    | { clientDraftRef: string; status: 'processed'; reportId: string }
    | { clientDraftRef: string; status: 'failed'; error: string }
  >
}

export async function processUnprocessedInboxItems(deps: {
  db: Firestore
  processInboxItemCore: typeof processInboxItemCore
}): Promise<ManualInboxProcessSummary> {
  // scan unprocessed report_inbox docs, call core processor, collect results
}
```

The CLI `main()` must print one JSON summary line:

```typescript
console.log(JSON.stringify({ event: 'manual-inbox-processing-summary', ...summary }))
process.exitCode = summary.failedCount > 0 ? 1 : 0
```

- [ ] **Step 4: Verify failure visibility**

Add a second test where the injected processor rejects. Assert `failedCount: 1` and a result with `status: 'failed'`.

Run:

```bash
pnpm --dir functions exec vitest run scripts/process-inbox-manual.test.ts
pnpm --dir functions exec tsc --noEmit
```

Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add functions/scripts/process-inbox-manual.ts functions/scripts/process-inbox-manual.test.ts
git commit -m "fix(functions): report manual inbox processing summary"
```

---

## Task 4: Lock Materialization And Replay Contracts

**Files:**

- Modify: `functions/src/__tests__/triggers/process-inbox-item.test.ts`

- [ ] **Step 1: Add exact field assertions**

In the existing successful materialization test, assert all C02 fields:

```typescript
expect(reportDoc.exists).toBe(true)
expect(reportDoc.data()).toMatchObject({
  municipalityId: 'daet',
  status: 'new',
})

expect(reportOpsDoc.exists).toBe(true)
expect(reportOpsDoc.data()).toMatchObject({
  status: 'new',
  municipalityId: 'daet',
})

expect(reportLookupDoc.exists).toBe(true)
expect(reportLookupDoc.data()).toMatchObject({
  reportId,
  publicRef,
})
```

- [ ] **Step 2: Add C09 replay assertion**

If an idempotency test already exists, tighten it. It must prove:

```typescript
const first = await processInboxItemCore(input)
const second = await processInboxItemCore(input)

expect(second.reportId).toBe(first.reportId)
expect(await countReportsForPublicRef(publicRef)).toBe(1)
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm --dir functions exec vitest run src/__tests__/triggers/process-inbox-item.test.ts
pnpm --dir functions exec tsc --noEmit
```

Expected: PASS with one report after replay.

- [ ] **Step 4: Commit**

```bash
git add functions/src/__tests__/triggers/process-inbox-item.test.ts
git commit -m "test(functions): lock inbox materialization replay"
```

---

## Task 5: Lock Responder Dispatch Contracts

**Files:**

- Modify: `functions/src/__tests__/callables/dispatch-responder.test.ts`
- Modify: `apps/responder-app/src/hooks/useOwnDispatches.test.ts`

- [ ] **Step 1: Assert dispatch writer fields**

In the dispatch responder success test, assert C06:

```typescript
expect(dispatchDoc.exists).toBe(true)
expect(dispatchDoc.data()).toMatchObject({
  reportId: 'report-1',
  status: 'pending',
  assignedTo: {
    uid: 'bfp-responder-test-01',
    municipalityId: 'daet',
  },
})
expect(dispatchDoc.data()?.dispatchedAt).toBeDefined()
```

- [ ] **Step 2: Assert responder listener query**

In `useOwnDispatches.test.ts`, mock Firestore `where` and `orderBy` calls. Assert:

```typescript
expect(whereMock).toHaveBeenCalledWith('assignedTo.uid', '==', 'bfp-responder-test-01')
expect(whereMock).toHaveBeenCalledWith('status', 'in', [
  'pending',
  'accepted',
  'acknowledged',
  'en_route',
  'on_scene',
])
expect(orderByMock).toHaveBeenCalledWith('dispatchedAt', 'desc')
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm --dir functions exec vitest run src/__tests__/callables/dispatch-responder.test.ts
pnpm --dir apps/responder-app exec vitest run src/hooks/useOwnDispatches.test.ts
pnpm typecheck
```

Expected: PASS and no type errors.

- [ ] **Step 4: Commit**

```bash
git add functions/src/__tests__/callables/dispatch-responder.test.ts apps/responder-app/src/hooks/useOwnDispatches.test.ts
git commit -m "test(responder): lock dispatch listener contract"
```

---

## Task 6: Eliminate Dev Server Port Drift

**Files:**

- Create: `scripts/dev-all.ports.test.ts`
- Modify: `scripts/dev-all.mjs`

- [ ] **Step 1: Write the failing drift test**

```typescript
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('dev-all ports', () => {
  it('matches the Playwright app ports', () => {
    const script = readFileSync(new URL('./dev-all.mjs', import.meta.url), 'utf8')

    expect(script).toContain('localhost:5173')
    expect(script).toContain('localhost:5174')
    expect(script).toContain('localhost:5175')
    expect(script).not.toContain('localhost:4173')
    expect(script).not.toContain('localhost:3001')
  })
})
```

- [ ] **Step 2: Run red**

Run:

```bash
pnpm exec vitest run scripts/dev-all.ports.test.ts
```

Expected: FAIL because `dev-all.mjs` still contains drifted ports.

- [ ] **Step 3: Update `dev-all.mjs`**

Set:

```javascript
{ name: 'citizen-pwa', url: 'http://localhost:5173' }
{ name: 'responder-app', url: 'http://localhost:5174' }
{ name: 'admin-desktop', url: 'http://localhost:5175' }
```

Do not change emulator ports.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm exec vitest run scripts/dev-all.ports.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/dev-all.mjs scripts/dev-all.ports.test.ts
git commit -m "fix(scripts): align dev-all app ports"
```

---

## Task 7: Add Stable UI Proof Hooks

**Files:**

- Modify: `apps/admin-desktop/src/components/TriageQueueTable.tsx`
- Modify: `apps/admin-desktop/src/components/TriagePanel.tsx`
- Modify: `apps/citizen-pwa/src/components/AlertsTab.tsx`
- Modify: `apps/responder-app/src/pages/DispatchListPage.tsx`
- Modify: `apps/responder-app/src/pages/DispatchDetailPage.tsx`

- [ ] **Step 1: Add tests where local tests already cover the component**

For existing component tests, add assertions for the new selectors:

```typescript
expect(screen.getByTestId('alert-card-alert-proof-1')).toHaveTextContent('[TEST:proof-1]')
expect(screen.getByTestId('dispatch-card-dispatch-1')).toHaveTextContent(/pending/i)
```

Use existing tests when available. Do not create broad page tests just for selector presence.

- [ ] **Step 2: Add selectors without changing visuals**

Add these exact selectors:

```tsx
data-testid={`report-row-${report.id}`}
data-testid={`triage-panel-${report.id}`}
data-testid={`alert-card-${alert.id}`}
data-testid={`dispatch-card-${row.dispatchId}`}
data-testid={`dispatch-status-${dispatch.dispatchId}`}
```

If `dispatch.dispatchId` is not available in `DispatchDetailPage`, use the route param after checking it is defined:

```tsx
data-testid={`dispatch-status-${dispatchId}`}
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm --dir apps/admin-desktop exec vitest run src/components/TriagePanel.test.tsx src/components/TriageQueueTable.test.tsx
pnpm --dir apps/citizen-pwa exec vitest run src/components/AlertsTab.test.tsx
pnpm --dir apps/responder-app exec vitest run src/pages/DispatchListPage.test.tsx src/pages/DispatchDetailPage.test.tsx
pnpm typecheck
```

Expected: PASS. If a named test file does not exist, replace it with the closest existing test that renders the touched component and record the substitution in `docs/progress.md`.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-desktop/src/components/TriageQueueTable.tsx apps/admin-desktop/src/components/TriagePanel.tsx apps/citizen-pwa/src/components/AlertsTab.tsx apps/responder-app/src/pages/DispatchListPage.tsx apps/responder-app/src/pages/DispatchDetailPage.tsx
git commit -m "test(ui): add stable proof selectors"
```

---

## Task 8: Add Reliability Spine Harness Utilities

**Files:**

- Create: `e2e-tests/fixtures/reliability-spine.ts`
- Modify: `e2e-tests/package.json`

- [ ] **Step 1: Add harness dependencies**

Add to `e2e-tests/package.json`:

```json
{
  "devDependencies": {
    "firebase-admin": "^13.10.0"
  }
}
```

Add scripts:

```json
{
  "scripts": {
    "proof:local": "BANTAYOG_PROOF_TARGET=local playwright test specs/full-loop.spec.ts",
    "proof:staging": "BANTAYOG_PROOF_TARGET=staging playwright test --config=playwright.staging.config.ts specs/full-loop.spec.ts"
  }
}
```

- [ ] **Step 2: Create checkpoint types**

```typescript
export type ProofTarget = 'local' | 'staging'

export interface ProofLedger {
  testRunId: string
  target: ProofTarget
  municipalityId: 'daet'
  clientDraftRef?: string
  publicRef?: string
  reportId?: string
  alertId?: string
  dispatchId?: string
  adminUid?: string
  responderUid?: string
}

export interface CheckpointResult {
  testRunId: string
  checkpoint: string
  status: 'passed' | 'failed'
  target: ProofTarget
  expected: string
  observed: Record<string, unknown>
  nextHint?: string
}
```

- [ ] **Step 3: Add JSON checkpoint logger**

```typescript
export function logCheckpoint(result: CheckpointResult): void {
  console.log(JSON.stringify({ event: 'reliability-spine-checkpoint', ...result }))
}
```

Every failure path must call `logCheckpoint({ status: 'failed', ... })` before throwing.

- [ ] **Step 4: Add exact Firestore waiters**

```typescript
export async function waitForDoc<T>(
  ref: FirebaseFirestore.DocumentReference<T>,
  timeoutMs: number,
): Promise<FirebaseFirestore.DocumentSnapshot<T>> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const snap = await ref.get()
    if (snap.exists) return snap
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${ref.path}`)
}
```

Add a separate `waitForQueryExactlyOne` helper for `report_lookup/{publicRef}` and materialized report correlation.

- [ ] **Step 5: Add local manual processor wrapper**

Use `execa` only if it already exists in the repo. If not, use `node:child_process` `spawn` and parse stdout lines.

```typescript
export async function runManualInboxProcessor(): Promise<ManualInboxProcessSummary> {
  const result = await runProcess('pnpm', [
    '--dir',
    'functions',
    'tsx',
    'scripts/process-inbox-manual.ts',
  ])
  const summaryLine = result.stdout
    .split('\n')
    .find((line) => line.includes('"manual-inbox-processing-summary"'))
  if (!summaryLine) throw new Error('manual processor summary missing')
  return JSON.parse(summaryLine) as ManualInboxProcessSummary
}
```

- [ ] **Step 6: Add cleanup helper**

Cleanup exact ids in reverse dependency order:

```typescript
export async function cleanupProofRun(
  db: FirebaseFirestore.Firestore,
  ledger: ProofLedger,
): Promise<void> {
  const refs = [
    ledger.dispatchId ? db.collection('dispatches').doc(ledger.dispatchId) : null,
    ledger.alertId ? db.collection('alerts').doc(ledger.alertId) : null,
    ledger.reportId ? db.collection('report_ops').doc(ledger.reportId) : null,
    ledger.reportId ? db.collection('reports').doc(ledger.reportId) : null,
    ledger.publicRef ? db.collection('report_lookup').doc(ledger.publicRef) : null,
    ledger.clientDraftRef ? db.collection('report_inbox').doc(ledger.clientDraftRef) : null,
  ].filter((ref): ref is FirebaseFirestore.DocumentReference => ref !== null)

  for (const ref of refs) {
    await ref.delete()
  }
}
```

- [ ] **Step 7: Verify typecheck**

Run:

```bash
pnpm --dir e2e-tests exec tsc --noEmit
pnpm install --lockfile-only
```

Expected: no type errors; lockfile records `firebase-admin` under e2e tests.

- [ ] **Step 8: Commit**

```bash
git add e2e-tests/package.json pnpm-lock.yaml e2e-tests/fixtures/reliability-spine.ts
git commit -m "test(e2e): add reliability spine harness utilities"
```

---

## Task 9: Replace Skipped Full-Loop Placeholder

**Files:**

- Modify: `e2e-tests/specs/full-loop.spec.ts`

- [ ] **Step 1: Write the executable proof skeleton**

Remove `test.skip`. Use serial mode:

```typescript
import { expect, test } from '@playwright/test'
import {
  cleanupProofRun,
  createProofLedger,
  logCheckpoint,
  runManualInboxProcessor,
  waitForDoc,
} from '../fixtures/reliability-spine'

test.describe.configure({ mode: 'serial' })

test.describe('Reliability Spine', () => {
  test('citizen report reaches admin, alert reaches citizen, dispatch reaches responder', async ({
    browser,
  }) => {
    const ledger = createProofLedger()
    try {
      // C00-C08 implemented in this test with exact ledger ids.
    } finally {
      await cleanupProofRunForTarget(ledger)
    }
  })
})
```

- [ ] **Step 2: Implement C00 preflight**

Assert:

```typescript
expect(process.env.BANTAYOG_PROOF_TARGET ?? 'local').toMatch(/^(local|staging)$/)
await expect(citizenPage).toHaveURL(/5173|staging-citizen-host/)
await expect(adminPage).toHaveURL(/5175|staging-admin-host/)
await expect(responderPage).toHaveURL(/5174|staging-responder-host/)
```

Also collect console errors from each page. Fail preflight if an error contains `app-check`, `auth/`, `functions/internal`, or wrong region text.

- [ ] **Step 3: Implement C01 Citizen PWA report submission**

Drive the existing citizen wizard:

```typescript
await citizenPage.goto(`${citizenBaseUrl}/report`)
await citizenPage.getByRole('button', { name: 'Flood' }).click()
await citizenPage.getByRole('button', { name: 'Continue' }).click()
await citizenPage.getByRole('button', { name: /pick my municipality manually/i }).click()
await citizenPage.locator('#report-municipality').selectOption('daet')
await citizenPage.locator('#reporter-name').fill(`Proof ${ledger.testRunId}`)
await citizenPage.locator('#reporter-msisdn').fill('+639123456789')
await citizenPage.getByRole('button', { name: /review report/i }).click()
await citizenPage.locator('#consent-checkbox').check()
await citizenPage.getByRole('button', { name: /submit report/i }).click()
```

Capture `clientDraftRef` and `publicRef` from the receipt or backing inbox query. If the UI does not expose `clientDraftRef`, query `report_inbox` by reporter name containing `ledger.testRunId`.

- [ ] **Step 4: Implement C02 and C09 local materialization**

For local mode:

```typescript
const firstSummary = await runManualInboxProcessor()
expect(firstSummary.candidateCount).toBeGreaterThan(0)
expect(firstSummary.failedCount).toBe(0)

const secondSummary = await runManualInboxProcessor()
expect(secondSummary.failedCount).toBe(0)
```

Then assert exact docs:

```typescript
const lookup = await waitForDoc(db.collection('report_lookup').doc(ledger.publicRef), 30_000)
ledger.reportId = lookup.data()?.reportId
await waitForDoc(db.collection('reports').doc(ledger.reportId), 30_000)
await waitForDoc(db.collection('report_ops').doc(ledger.reportId), 30_000)
```

For staging mode, skip the manual processor and wait up to 120 seconds.

- [ ] **Step 5: Implement C03 Admin listener result**

Sign in inside the Admin Desktop browser context. Assert custom claims separately with Firebase Admin before UI assertion.

```typescript
await adminPage.goto(`${adminBaseUrl}/map`)
await expect(adminPage.getByTestId(`report-row-${ledger.reportId}`)).toBeVisible({
  timeout: 15_000,
})
await adminPage.getByTestId(`report-row-${ledger.reportId}`).click()
await expect(adminPage.getByTestId(`triage-panel-${ledger.reportId}`)).toBeVisible()
```

If the map page does not expose rows, use the map pin/panel selector added in Task 7 and document the final selector in `docs/progress.md`.

- [ ] **Step 6: Implement C04/C05 alert**

Declare alert through Admin Desktop:

```typescript
await adminPage.getByRole('button', { name: /declare alert/i }).click()
await adminPage.locator('#hazard-type').selectOption('flood')
await adminPage.getByLabel('Affected Municipalities').getByText(/daet/i).click()
await adminPage.locator('#alert-message').fill(`[TEST:${ledger.testRunId}] Flood proof alert`)
await adminPage.getByRole('button', { name: /^declare alert$/i }).click()
```

Query `alerts` by message containing `[TEST:${ledger.testRunId}]`, save `ledger.alertId`, and assert:

```typescript
expect(alertDoc.data()?.publishedAt).toBeDefined()
expect(alertDoc.data()?.affectedMunicipalityIds).toContain('daet')
```

Then verify Citizen PWA:

```typescript
await citizenPage.goto(`${citizenBaseUrl}/alerts`)
await expect(citizenPage.getByTestId(`alert-card-${ledger.alertId}`)).toContainText(
  `[TEST:${ledger.testRunId}]`,
  {
    timeout: 15_000,
  },
)
```

- [ ] **Step 7: Implement C06/C07 dispatch**

Use Admin Desktop UI if the report is verified and dispatchable. If UI verification needs two state transitions, drive the existing `Advance to review` then `Verify` buttons and assert backing `report_ops.status` after each click.

```typescript
await adminPage
  .getByTestId(`triage-panel-${ledger.reportId}`)
  .getByRole('button', { name: /dispatch responder/i })
  .click()
await adminPage.getByLabel('Select Agency').selectOption('BFP')
await adminPage.getByLabel('Select Responder').selectOption(ledger.responderUid)
await adminPage.getByRole('button', { name: /hold to dispatch/i }).press('Space')
```

If Playwright cannot model the hold interaction reliably, call `dispatchResponder` through the same Firebase callable client in the browser context and record that as the only allowed browser-level equivalent.

Assert `dispatches/{dispatchId}` C06 fields, then sign in to Responder App and assert:

```typescript
await expect(responderPage.getByTestId(`dispatch-card-${ledger.dispatchId}`)).toBeVisible({
  timeout: 15_000,
})
```

- [ ] **Step 8: Implement C08 progression**

```typescript
await responderPage
  .getByTestId(`dispatch-card-${ledger.dispatchId}`)
  .getByRole('button', { name: /view & accept/i })
  .click()
await responderPage.getByRole('button', { name: /accept/i }).click()
await expect(responderPage.getByTestId(`dispatch-status-${ledger.dispatchId}`)).toContainText(
  /acknowledged|accepted/i,
)
await responderPage.getByRole('button', { name: /en route/i }).click()
await expect(responderPage.getByTestId(`dispatch-status-${ledger.dispatchId}`)).toContainText(
  /en route/i,
)
await responderPage.getByRole('button', { name: /on scene/i }).click()
await expect(responderPage.getByTestId(`dispatch-status-${ledger.dispatchId}`)).toContainText(
  /on scene/i,
)
```

After every UI step, read `dispatches/{dispatchId}` and assert the backing `status`.

- [ ] **Step 9: Verify local proof**

Run emulators and proof:

```bash
pnpm emulators
pnpm --dir e2e-tests proof:local
```

Expected: PASS with checkpoint JSON lines C00-C09.

- [ ] **Step 10: Commit**

```bash
git add e2e-tests/specs/full-loop.spec.ts
git commit -m "test(e2e): prove local reliability spine"
```

---

## Task 10: Add Staging Mode Guardrails

**Files:**

- Modify: `e2e-tests/fixtures/reliability-spine.ts`
- Modify: `e2e-tests/specs/full-loop.spec.ts`

- [ ] **Step 1: Require explicit staging opt-in**

```typescript
export function getProofTarget(): ProofTarget {
  const target = process.env.BANTAYOG_PROOF_TARGET ?? 'local'
  if (target !== 'local' && target !== 'staging') throw new Error(`invalid proof target: ${target}`)
  return target
}

export function assertStagingGuard(projectId: string): void {
  if (projectId.includes('prod'))
    throw new Error(`refusing staging proof against production project ${projectId}`)
}
```

- [ ] **Step 2: Add staging preflight**

Before creating any data, assert:

```typescript
expect(process.env.STAGING_CITIZEN_URL).toBeTruthy()
expect(process.env.STAGING_ADMIN_URL).toBeTruthy()
expect(process.env.STAGING_RESPONDER_URL).toBeTruthy()
expect(process.env.VITE_FIREBASE_FUNCTIONS_REGION).toBe('asia-southeast1')
```

Fail if console errors include App Check/Auth setup failures.

- [ ] **Step 3: Cleanup exact ids on success**

Run `cleanupProofRun` on success. On failure, attempt cleanup for artifacts after the failed checkpoint only when doing so does not erase the primary evidence. Always print remaining ids:

```typescript
console.error(
  JSON.stringify({
    event: 'reliability-spine-cleanup-required',
    testRunId: ledger.testRunId,
    ids: ledger,
  }),
)
```

- [ ] **Step 4: Verify staging command refuses unsafe config**

Run without staging env:

```bash
BANTAYOG_PROOF_TARGET=staging pnpm --dir e2e-tests proof:staging
```

Expected: FAIL before creating data, with missing staging URL/config message.

Do not run against real staging until the user gives explicit fresh approval for that staging write.

- [ ] **Step 5: Commit**

```bash
git add e2e-tests/fixtures/reliability-spine.ts e2e-tests/specs/full-loop.spec.ts
git commit -m "test(e2e): guard staging reliability proof"
```

---

## Task 11: Update Operator Memory And Run Final Gates

**Files:**

- Modify: `docs/learnings.md`
- Modify: `docs/progress.md`

- [ ] **Step 1: Update learnings**

Append a short dated entry to `docs/learnings.md`:

```markdown
### 2026-05-20 — Reliability Spine proof contracts

- Citizen-visible alerts must include the same timestamp field used by the shared alert listener: `publishedAt`.
- Cross-app proof runs must assert exact Firestore docs and exact UI selectors by `testRunId`; "renders" is not enough.
- Local inbox materialization must print a structured manual-processor summary because emulator triggers can fail before user code runs.
- `scripts/dev-all.mjs` ports must stay aligned with Playwright app ports: Citizen `5173`, Responder `5174`, Admin `5175`.
```

- [ ] **Step 2: Update progress**

Append the implemented checkpoint status to `docs/progress.md`:

```markdown
### 2026-05-20 — Reliability Spine

- Implemented local Reliability Spine proof covering C00-C09.
- Added staging proof guardrails; staging writes require explicit approval before execution.
- Left SMS, media, offline retry, FCM delivery, Storage reads, and load testing as separate follow-up slices.
```

- [ ] **Step 3: Run final local verification**

Run:

```bash
pnpm --dir functions exec vitest run src/__tests__/callables/declare-alert.test.ts src/__tests__/callables/dispatch-responder.test.ts src/__tests__/triggers/process-inbox-item.test.ts scripts/process-inbox-manual.test.ts
pnpm --dir apps/citizen-pwa exec vitest run src/components/AlertsTab.test.tsx
pnpm --dir apps/admin-desktop exec vitest run src/components/TriagePanel.test.tsx
pnpm --dir apps/responder-app exec vitest run src/hooks/useOwnDispatches.test.ts src/pages/DispatchListPage.test.tsx src/pages/DispatchDetailPage.test.tsx
pnpm exec vitest run scripts/dev-all.ports.test.ts packages/shared-firebase/src/firestore.test.ts
pnpm typecheck
```

Expected: all commands PASS.

- [ ] **Step 4: Run proof verification**

Run local proof with emulators already started:

```bash
pnpm --dir e2e-tests proof:local
```

Expected: PASS with checkpoint JSON lines for C00 through C09.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git diff --stat
git diff -- functions/src/callables/declare-alert.ts functions/scripts/process-inbox-manual.ts scripts/dev-all.mjs e2e-tests/specs/full-loop.spec.ts e2e-tests/fixtures/reliability-spine.ts docs/learnings.md docs/progress.md
```

Expected: changes match this plan; no Firebase rules, indexes, schema, or deployment config files changed.

- [ ] **Step 6: Commit**

```bash
git add docs/learnings.md docs/progress.md
git commit -m "docs: record reliability spine proof"
```

---

## Acceptance Criteria

- `declareAlertCore` writes `publishedAt`, and the Citizen PWA alert listener is tested against that field.
- The manual inbox processor prints a structured summary and fails loudly on processing errors.
- Local materialization replay is explicitly idempotent.
- `scripts/dev-all.mjs` cannot drift away from Playwright ports unnoticed.
- Admin Desktop, Citizen PWA, and Responder App expose stable proof selectors without changing visuals.
- `e2e-tests/specs/full-loop.spec.ts` is no longer skipped.
- Local proof emits C00-C09 checkpoint JSON and passes once with emulators.
- Staging proof refuses to run without explicit staging target/config and production guard.
- Staging writes are not executed without fresh user approval.
- `docs/learnings.md` and `docs/progress.md` are updated after implementation.

## Out Of Scope For This Plan

- Firebase rules/index/schema edits.
- Production or staging deployment.
- SMS ingestion/delivery.
- Storage-backed media uploads/downloads.
- Offline retry proof.
- FCM push delivery proof.
- Heavy traffic/load proof.

These need separate plans after the deterministic core loop is green.
