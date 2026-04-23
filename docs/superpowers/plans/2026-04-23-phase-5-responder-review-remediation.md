# Phase 5 Responder MVP Review Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the actionable findings in `docs/reviews/2026-04-23-phase5-responder-mvp-review.md` without widening scope beyond responder MVP stabilization.

**Architecture:** Fix safety-critical backend and startup failures first, then harden the responder client’s listener/error paths, then close the missing test and seed coverage that currently lets regressions hide behind green CI. Do not invent a new responder architecture during review cleanup; keep changes local to the callable, the current hooks/pages, and the existing Playwright/emulator harness.

**Tech Stack:** Firebase Functions v2, Firestore, React 19, React Router 7, Firebase Web SDK v12, TypeScript, Vitest, Playwright, Firebase emulators.

---

## Source Review

- Review file: `docs/reviews/2026-04-23-phase5-responder-mvp-review.md`
- Existing implementation plan: `docs/superpowers/plans/2026-04-23-phase-5-responder-mvp.md`
- Important repo context:
  - responder app has `lint` and `typecheck`, but no package-local unit test script today
  - decline callable already has emulator-backed tests, but only happy-path/idempotent replay coverage
  - `dispatch-mirror-to-report` already supports `declined` revert logic in code, but not in tests
  - `LEAN-CTX.md` was referenced by repo instructions but is not present in this worktree

## Execution Order

1. Stop-ship backend correctness
2. Stop-ship client startup and detail-page resilience
3. Test coverage honesty and seed/schema alignment
4. Observability and typing cleanup
5. Separate follow-up for cross-callable `accountStatus` drift

## File Map

| File                                                                 | Action       | Why                                                                               |
| -------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| `functions/src/callables/decline-dispatch.ts`                        | modify       | fix idempotency mismatch mapping, add rate limiting, guard malformed `assignedTo` |
| `functions/src/__tests__/callables/decline-dispatch.test.ts`         | modify       | add missing auth, not-found, mismatch, rate-limit, and emulator-port coverage     |
| `apps/responder-app/src/app/auth-provider.tsx`                       | modify       | prevent startup deadlock on token refresh failure                                 |
| `apps/responder-app/src/pages/DispatchListPage.tsx`                  | modify       | stop swallowing sign-out failures                                                 |
| `apps/responder-app/src/app/firebase.ts`                             | modify       | log emulator-connect failures instead of failing silently                         |
| `apps/responder-app/src/hooks/useDispatch.ts`                        | modify       | harden snapshot success/error paths and align type usage                          |
| `apps/responder-app/src/pages/DispatchDetailPage.tsx`                | modify       | fix race-loss detection, auto-advance retry behavior, and user-facing error copy  |
| `apps/responder-app/src/hooks/useDeclineDispatch.ts`                 | modify       | log callable failure and tighten empty-reason behavior                            |
| `apps/responder-app/src/hooks/useAcceptDispatch.ts`                  | modify       | log callable failure                                                              |
| `apps/responder-app/src/hooks/useAdvanceDispatch.ts`                 | modify       | log callable failure                                                              |
| `e2e-tests/specs/responder.spec.ts`                                  | modify       | convert fake-green tests to `test.skip` and add real decline-flow coverage        |
| `e2e-tests/fixtures/responder-seed.ts`                               | modify       | stop swallowing auth-seed errors and align dispatch seed with schema              |
| `functions/src/__tests__/triggers/dispatch-mirror-to-report.test.ts` | modify       | add declined/timed-out revert coverage                                            |
| `apps/responder-app/src/hooks/useOwnDispatches.ts`                   | modify later | follow-up for stale rows and narrower status typing                               |
| `functions/src/callables/accept-dispatch.ts` and sibling callables   | modify later | separate auth-guard cleanup for `accountStatus` bug                               |

## Scope Boundaries

- Do not add a brand-new responder-app unit-test harness in this review-fix pass. There is no existing local test runner in `apps/responder-app/package.json`, so app-side verification stays with `lint`, `typecheck`, and Playwright.
- Do not refactor unrelated responder pages or shared validators unless required to close a specific review finding.
- Do not bundle the latent `accountStatus` bug across all other callables into the same patch set as the stop-ship responder fixes.

---

### Task 1: Harden the decline callable and expand callable test coverage

**Files:**

- Modify: `functions/src/callables/decline-dispatch.ts`
- Modify: `functions/src/__tests__/callables/decline-dispatch.test.ts`

- [ ] **Step 1: Add failing tests for the missing callable paths**

Add cases for:

- unauthenticated request
- wrong-role request
- missing dispatch (`NOT_FOUND`)
- dispatch missing `assignedTo`
- idempotency key replay with different payload
- rate-limit denial

Key assertions to add:

```ts
await expect(callDeclineDispatch({ auth: null, data })).rejects.toMatchObject({
  code: 'unauthenticated',
})

await expect(
  declineDispatchCore(db, {
    ...baseDeps,
    dispatchId: 'missing-dispatch',
  }),
).rejects.toMatchObject({ code: 'NOT_FOUND' })

await expect(
  callDeclineDispatch({
    auth: { uid: 'r1', token: { role: 'responder', accountStatus: 'active' } },
    data: { ...payload, declineReason: 'Need fuel' },
  }),
).rejects.toMatchObject({ code: 'already-exists' })
```

- [ ] **Step 2: Run the callable test before implementation**

Run:

```bash
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/decline-dispatch.test.ts"
```

Expected:

- current suite fails on the new cases
- if emulator connection fails, update the test to use Firestore port `8081` instead of `8080`

- [ ] **Step 3: Implement the minimal callable fixes**

Patch `decline-dispatch.ts` to match the existing `accept-dispatch` pattern:

```ts
const rl = await checkRateLimit(db, {
  key: `decline::${actor.uid}`,
  limit: 30,
  windowSeconds: 60,
  now,
})
if (!rl.allowed) {
  throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
    retryAfterSeconds: rl.retryAfterSeconds,
  })
}

if (
  actor.claims.role !== 'responder' ||
  !dispatch.assignedTo?.uid ||
  dispatch.assignedTo.uid !== actor.uid
) {
  throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Only assigned responder can decline')
}
```

Also map `IdempotencyMismatchError` explicitly:

```ts
if (error instanceof IdempotencyMismatchError) {
  throw new HttpsError('already-exists', 'duplicate request with different payload')
}
```

- [ ] **Step 4: Re-run verification**

Run:

```bash
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/decline-dispatch.test.ts"
pnpm --filter @bantayog/functions lint
pnpm --filter @bantayog/functions typecheck
```

- [ ] **Step 5: Commit**

```bash
git add functions/src/callables/decline-dispatch.ts functions/src/__tests__/callables/decline-dispatch.test.ts
git commit -m "fix(responder): harden decline dispatch callable"
```

**Covers review items:** #2, #4, #9, #15, #21, #24

---

### Task 2: Fix responder startup deadlocks and silent auth/bootstrap failures

**Files:**

- Modify: `apps/responder-app/src/app/auth-provider.tsx`
- Modify: `apps/responder-app/src/pages/DispatchListPage.tsx`
- Modify: `apps/responder-app/src/app/firebase.ts`

- [ ] **Step 1: Implement startup/error-path changes**

Apply these exact guardrails:

```ts
void u
  .getIdTokenResult(true)
  .then((token) => {
    setClaims(token.claims as Record<string, unknown>)
  })
  .catch((err: unknown) => {
    console.error('[AuthProvider] token refresh failed:', err)
    setClaims(null)
  })
  .finally(() => {
    setLoading(false)
  })
```

```ts
async function handleSignOut() {
  try {
    await signOut()
  } catch (err) {
    console.error('[DispatchListPage] sign out failed:', err)
  }
}
```

```ts
void import('firebase/functions')
  .then(({ connectFunctionsEmulator }) => {
    connectFunctionsEmulator(functions, 'localhost', 5001)
  })
  .catch((err) => {
    console.error('[firebase] functions emulator connect failed:', err)
  })
```

- [ ] **Step 2: Run responder static verification**

Run:

```bash
pnpm --filter @bantayog/responder-app lint
pnpm --filter @bantayog/responder-app typecheck
```

- [ ] **Step 3: Re-run the responder smoke path**

Run:

```bash
firebase emulators:exec --project bantayog-alert-dev --only auth,firestore,pubsub "pnpm --filter @bantayog/e2e-tests exec playwright test specs/responder.spec.ts --grep 'renders the login page|shows active dispatches when available|cancelled dispatch shows cancelled screen'"
```

Expected:

- login still works
- list page still auto-enters correctly
- cancelled screen still renders

- [ ] **Step 4: Commit**

```bash
git add apps/responder-app/src/app/auth-provider.tsx apps/responder-app/src/pages/DispatchListPage.tsx apps/responder-app/src/app/firebase.ts
git commit -m "fix(responder): harden auth startup and bootstrap errors"
```

**Covers review items:** #1, #13, #25

---

### Task 3: Harden the dispatch listener instead of trusting best-case snapshots

**Files:**

- Modify: `apps/responder-app/src/hooks/useDispatch.ts`

- [ ] **Step 1: Replace the local duplicate type with the shared validator type**

Use `DispatchDoc` from `@bantayog/shared-validators` as the base contract, then add UI-only fields:

```ts
import type { DispatchDoc as BaseDispatchDoc } from '@bantayog/shared-validators'

export type DispatchDoc = BaseDispatchDoc & {
  dispatchId: string
  uiStatus: ResponderUiState
  terminalSurface: TerminalSurface
}
```

- [ ] **Step 2: Wrap both snapshot paths**

Guard the success callback and log the error callback:

```ts
;(snap) => {
  try {
    if (!snap.exists()) {
      setDispatch(undefined)
      return
    }
    const data = snap.data()
    if (!data) {
      console.error('[useDispatch] snap exists but data missing:', snap.id)
      setDispatch(undefined)
      return
    }
    const parsed = dispatchDocSchema.parse(data)
    setDispatch({
      ...parsed,
      dispatchId: snap.id,
      uiStatus: getResponderUiState(parsed.status),
      terminalSurface: getTerminalSurface(parsed.status),
    })
    setError(undefined)
  } catch (err) {
    console.error('[useDispatch] snapshot mapping failed:', err)
    setError(err instanceof Error ? err : new Error(String(err)))
  } finally {
    setLoading(false)
  }
}
```

```ts
;(err: FirestoreError) => {
  console.error('[useDispatch] listener error:', err.code, err.message)
  setError(err)
  setLoading(false)
}
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm --filter @bantayog/responder-app lint
pnpm --filter @bantayog/responder-app typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/responder-app/src/hooks/useDispatch.ts
git commit -m "fix(responder): harden dispatch snapshot handling"
```

**Covers review items:** #5, #12, #17

---

### Task 4: Fix detail-page race handling, auto-advance, and operator-facing errors

**Files:**

- Modify: `apps/responder-app/src/pages/DispatchDetailPage.tsx`

- [ ] **Step 1: Make race-loss detection check Firebase error codes, not string fragments**

Use the callable error code field:

```ts
const acceptErrorCode =
  acceptError && typeof acceptError === 'object' && 'code' in acceptError
    ? String((acceptError as { code?: unknown }).code ?? '')
    : ''

if (dispatch.terminalSurface === 'race_loss' || acceptErrorCode === 'functions/already-exists') {
  return <RaceLossScreen />
}
```

- [ ] **Step 2: Remove the stuck auto-advance behavior**

Prefer idempotent retry over a one-shot ref gate:

```ts
useEffect(() => {
  if (dispatch?.status === 'accepted') {
    void advance('acknowledged')
  }
}, [dispatch?.status, advance])
```

If duplicate calls prove noisy in practice, add an explicit retry button after the first safe version lands. Do not keep the current unrecoverable state.

- [ ] **Step 3: Normalize operator-facing error copy**

Add a small mapper near the page:

```ts
function getResponderErrorMessage(err: Error | undefined): string | null {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : ''
  if (code === 'functions/permission-denied') return 'This dispatch is no longer available.'
  if (code === 'functions/already-exists') return 'Another responder already claimed this dispatch.'
  if (code === 'functions/failed-precondition')
    return 'This action is no longer allowed from the current dispatch state.'
  return err ? 'Something went wrong. Please retry.' : null
}
```

- [ ] **Step 4: Verify with type/lint and existing responder flow**

Run:

```bash
pnpm --filter @bantayog/responder-app lint
pnpm --filter @bantayog/responder-app typecheck
firebase emulators:exec --project bantayog-alert-dev --only auth,firestore,pubsub "pnpm --filter @bantayog/e2e-tests exec playwright test specs/responder.spec.ts --grep 'shows active dispatches when available|cancelled dispatch shows cancelled screen'"
```

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/src/pages/DispatchDetailPage.tsx
git commit -m "fix(responder): harden detail page race and error states"
```

**Covers review items:** #3, #8, #11

---

### Task 5: Add callable-hook error logging and tighten decline-hook behavior

**Files:**

- Modify: `apps/responder-app/src/hooks/useDeclineDispatch.ts`
- Modify: `apps/responder-app/src/hooks/useAcceptDispatch.ts`
- Modify: `apps/responder-app/src/hooks/useAdvanceDispatch.ts`

- [ ] **Step 1: Log every callable failure**

Add explicit logging in all three hooks:

```ts
console.error('[useDeclineDispatch] decline failed:', err)
console.error('[useAcceptDispatch] accept failed:', err)
console.error('[useAdvanceDispatch] advance failed:', err)
```

- [ ] **Step 2: Make the empty-decline guard a real failure**

Do not silently return success on empty reason:

```ts
if (!trimmedReason) {
  const err = new Error('declineReason_required')
  setError(err)
  throw err
}
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm --filter @bantayog/responder-app lint
pnpm --filter @bantayog/responder-app typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/responder-app/src/hooks/useDeclineDispatch.ts apps/responder-app/src/hooks/useAcceptDispatch.ts apps/responder-app/src/hooks/useAdvanceDispatch.ts
git commit -m "fix(responder): log callable hook failures"
```

**Covers review items:** #10, #22

---

### Task 6: Make E2E status honest and add real decline-flow coverage

**Files:**

- Modify: `e2e-tests/specs/responder.spec.ts`
- Modify: `e2e-tests/fixtures/responder-seed.ts`

- [ ] **Step 1: Stop the fake-green tests**

Convert the empty lifecycle cases to `test.skip(...)` immediately:

```ts
test.skip('accepts a pending dispatch', async () => {})
test.skip('advances from acknowledged to en_route', async () => {})
test.skip('advances from en_route to on_scene', async () => {})
test.skip('resolves a dispatch from on_scene', async () => {})
```

- [ ] **Step 2: Add one real decline-flow E2E**

Use the current harness to prove the primary new feature:

```ts
test('declines a pending dispatch with a reason', async ({ page }) => {
  await page.goto(RESPONDER_BASE)
  await page.getByLabel(/email/i).fill('bfp-responder-test-01@test.local')
  await page.getByLabel(/password/i).fill('test123456')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.getByRole('link', { name: /pending/i }).click()
  await page.getByPlaceholder(/decline reason/i).fill('Already handling another incident')
  await page.getByRole('button', { name: /submit decline/i }).click()
  await expect(page.getByText(/dispatch not found|no longer available|declined/i)).toBeVisible()
})
```

Use the exact post-submit expectation that matches the UI after Task 4 lands; do not assert against a string that the page never renders.

- [ ] **Step 3: Align the seed with the dispatch schema and stop swallowing auth failures**

In `responder-seed.ts`:

- only convert `getUserByEmail` "not found" into `null`
- build the seed as a `dispatchDocSchema`-compatible input
- include `dispatchedBy`, `dispatchedByRole`, `idempotencyKey`, `idempotencyPayloadHash`, and `statusUpdatedAt`

Seed validation pattern:

```ts
const seedDoc = dispatchDocSchema.parse({
  dispatchId,
  reportId: 'report-1',
  status,
  assignedTo: { uid, agencyId: 'bfp-daet', municipalityId: 'daet' },
  dispatchedBy: 'admin-1',
  dispatchedByRole: 'municipal_admin',
  dispatchedAt: now,
  lastStatusAt: now,
  statusUpdatedAt: now,
  idempotencyKey: 'seed-idempotency-key',
  idempotencyPayloadHash: 'seed-payload-hash',
  schemaVersion: 1,
})
```

- [ ] **Step 4: Run the responder Playwright suite**

Run:

```bash
firebase emulators:exec --project bantayog-alert-dev --only auth,firestore,pubsub "pnpm --filter @bantayog/e2e-tests exec playwright test specs/responder.spec.ts"
```

Expected:

- real decline scenario passes
- four lifecycle placeholders show as skipped, not passed

- [ ] **Step 5: Commit**

```bash
git add e2e-tests/specs/responder.spec.ts e2e-tests/fixtures/responder-seed.ts
git commit -m "test(responder): add decline e2e and honest skipped coverage"
```

**Covers review items:** #6, #7, #20, #23

---

### Task 7: Add mirror-trigger coverage for responder decline recovery

**Files:**

- Modify: `functions/src/__tests__/triggers/dispatch-mirror-to-report.test.ts`

- [ ] **Step 1: Add the missing revert tests**

Cover both `declined` and `timed_out` because the trigger treats them the same:

```ts
it('reverts report to verified and clears currentDispatchId when dispatch is declined', async () => {
  const { reportId, dispatchId } = await seedAcceptedDispatch(testEnv)
  const db = testEnv.unauthenticatedContext().firestore() as any

  await db.collection('reports').doc(reportId).update({
    status: 'assigned',
    currentDispatchId: dispatchId,
  })

  await dispatchMirrorToReportCore({
    db,
    dispatchId,
    beforeData: { status: 'pending' },
    afterData: { status: 'declined', reportId, correlationId: crypto.randomUUID() },
  })

  const report = await db.collection('reports').doc(reportId).get()
  expect(report.data()?.status).toBe('verified')
  expect(report.data()?.currentDispatchId).toBeNull()
})
```

- [ ] **Step 2: Run targeted trigger tests**

Run:

```bash
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions exec vitest run src/__tests__/triggers/dispatch-mirror-to-report.test.ts"
```

- [ ] **Step 3: Commit**

```bash
git add functions/src/__tests__/triggers/dispatch-mirror-to-report.test.ts
git commit -m "test(dispatch): cover declined mirror recovery"
```

**Covers review items:** #14

---

### Task 8: Schedule the non-stop-ship cleanup as follow-up work, not drive-by scope creep

**Files:**

- Modify later: `functions/src/callables/accept-dispatch.ts`
- Modify later: `functions/src/callables/cancel-dispatch.ts`
- Modify later: `functions/src/callables/close-report.ts`
- Modify later: `functions/src/callables/dispatch-responder.ts`
- Modify later: `functions/src/callables/reject-report.ts`
- Modify later: `functions/src/callables/verify-report.ts`
- Modify later: `apps/responder-app/src/hooks/useOwnDispatches.ts`

- [ ] **Step 1: Open a dedicated follow-up branch/plan for cross-callable auth drift**

Do not fix this opportunistically while landing the responder review patch. The change spans multiple public callables and needs its own test pass.

- [ ] **Step 2: In that follow-up, replace `claims.active !== true` with the real `accountStatus === 'active'` contract**

Pattern to standardize:

```ts
if (claims.accountStatus !== 'active') {
  throw new HttpsError('permission-denied', 'account is not active')
}
```

- [ ] **Step 3: In that same follow-up, narrow `useOwnDispatches` status typing and preserve last-known rows on transient errors**

Target shape:

```ts
export type ActiveDispatchStatus = Extract<
  DispatchStatus,
  'pending' | 'accepted' | 'acknowledged' | 'en_route' | 'on_scene'
>
```

Error-path rule:

- keep `rows` unchanged on snapshot error
- show reconnecting/error UI instead of `No active dispatches.`

**Covers review items:** #16, #18, #19

---

## Final Verification Gate

Run the full phase slice only after Tasks 1-7 land:

```bash
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/decline-dispatch.test.ts src/__tests__/triggers/dispatch-mirror-to-report.test.ts"
pnpm --filter @bantayog/functions lint
pnpm --filter @bantayog/functions typecheck
pnpm --filter @bantayog/responder-app lint
pnpm --filter @bantayog/responder-app typecheck
firebase emulators:exec --project bantayog-alert-dev --only auth,firestore,pubsub "pnpm --filter @bantayog/e2e-tests exec playwright test specs/responder.spec.ts"
```

Expected:

- callable tests pass against the same Firestore emulator port used elsewhere (`8081`)
- responder app static checks pass
- Playwright shows a real decline-flow pass and explicit skipped placeholders for the unimplemented lifecycle cases

## Exit Criteria

- No responder startup path can hang forever on a swallowed async rejection
- Decline callable never leaks `functions/internal` for idempotency mismatch or malformed dispatch ownership state
- Dispatch detail page can recover from accept/advance race paths without trapping the responder in a dead state
- CI no longer reports empty E2E placeholders as green coverage
- Declined dispatches are covered end-to-end at the callable, trigger, and browser levels
