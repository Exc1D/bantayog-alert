# Phase 5 Responder MVP — Code Review

**Date:** 2026-04-23
**Commits reviewed:** `a56ca68` (feat: complete dispatch lifecycle and E2E test harness), `42544f1` (feat: add responder decline callable)
**Agents:** code-reviewer, silent-failure-hunter, pr-test-analyzer, type-design-analyzer

---

## Recommended Action Order

```text
STOP-SHIP (before any user-facing deploy):
  #1  auth-provider: getIdTokenResult rejection swallowed → app stuck in loading
  #2  decline callable: IdempotencyMismatchError → opaque functions/internal to client
  #5  useDispatch: onSnapshot listener dies silently with no log and no retry
  #8  DispatchDetailPage: auto-advance stuck state — unrecoverable without hard reload

BEFORE NEXT ITERATION:
  #3  DispatchDetailPage: RaceLossScreen dead code — checks .message instead of .code
  #4  decline callable: missing rate limiting (every sibling callable has it)
  #6  E2E: 4 empty test stubs register as passing — convert to test.skip
  #7  E2E: no test for the decline flow (primary new feature)
  #10 All callable hooks: zero console.error on failure — invisible to observability
  #11 DispatchDetailPage: raw Firebase error codes shown to responder
  #14 Mirror trigger: no integration test for declined dispatch path
  #15 decline-dispatch.test.ts: no test for unauthenticated/wrong-role path

BACKLOG:
  #16 All other callables: accountStatus latent auth bypass
  #17 Unify local DispatchDoc with shared-validators type
  #19-#25 Type narrowing, seed alignment, port mismatch, misc
```

---

## Critical — Fix Before Next Milestone

### 1. `getIdTokenResult` rejection swallowed — app permanently stuck in loading

**File:** `apps/responder-app/src/app/auth-provider.tsx:23-26`
**Agent:** silent-failure-hunter

```ts
void u.getIdTokenResult(true).then(...)  // no .catch()
```

Any network hiccup or token revocation at startup → `setLoading(false)` is never called → permanent spinner with no error message and no retry path. In a disaster scenario this silently kills the responder's app.

**Fix:**

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
  .finally(() => setLoading(false))
```

---

### 2. `IdempotencyMismatchError` leaks as opaque `functions/internal` to client

**File:** `functions/src/callables/decline-dispatch.ts:126-131`
**Agent:** silent-failure-hunter, code-reviewer

The catch block only handles `BantayogError`. `IdempotencyMismatchError` (thrown by `withIdempotency` when same key is replayed with a different payload) falls through as an unhandled throw. Firebase surfaces it as `functions/internal` with no detail. The responder cannot tell whether the decline went through.

**Fix:**

```ts
} catch (error) {
  if (error instanceof BantayogError) {
    throw bantayogErrorToHttps(error)
  }
  if (error instanceof IdempotencyMismatchError) {
    throw new HttpsError('already-exists', 'duplicate request with different payload')
  }
  throw error
}
```

---

### 3. `RaceLossScreen` never renders from accept errors — checks wrong field

**File:** `apps/responder-app/src/pages/DispatchDetailPage.tsx:106`
**Agent:** code-reviewer, type-design-analyzer

```ts
acceptError?.message.includes('already-exists') // always false
```

Firebase callable errors put the code in `.code`, not `.message`. The race-loss UX branch triggered by the accept callable returning a conflict is dead code.

**Fix:**

```ts
;(acceptError as { code?: string } | undefined)?.code === 'functions/already-exists'
```

---

### 4. Decline callable has no rate limiting

**File:** `functions/src/callables/decline-dispatch.ts:30-105`
**Agent:** code-reviewer

Every sibling callable (`accept-dispatch`, `cancel-dispatch`, `close-report`, `dispatch-responder`, `reject-report`) calls `checkRateLimit`. Decline does not. A compromised responder token can flood the audit log and Firestore transaction queue.

**Fix:** Add `checkRateLimit(db, { key: 'decline::${actor.uid}', limit: 30, windowSeconds: 60, now })` inside the callable, matching the pattern in `accept-dispatch.ts:43`.

---

### 5. `useDispatch` `onSnapshot` listener dies silently — no logging, no retry

**File:** `apps/responder-app/src/hooks/useDispatch.ts:72-75`
**Agent:** silent-failure-hunter, code-reviewer

```ts
(err) => {
  setError(err as Error)
  setLoading(false)
},
```

Firestore does not auto-retry a dead snapshot listener. After this callback fires, `dispatch` is frozen at its last value, nothing is logged, and the page shows no reconnecting state. For a responder watching for a status change during an incident, the UI silently lies.

**Fix:** Log the `FirestoreError.code`. For transient codes (`unavailable`, `resource-exhausted`), re-subscribe after backoff. For terminal codes (`permission-denied`, `not-found`), show an actionable error. At minimum:

```ts
(err: FirestoreError) => {
  console.error('[useDispatch] listener error:', err.code, err.message)
  setError(err)
  setLoading(false)
},
```

---

### 6. Four E2E test stubs always pass — full dispatch lifecycle has zero E2E coverage

**File:** `e2e-tests/specs/responder.spec.ts` (dispatch detail describe block)
**Agent:** pr-test-analyzer, code-reviewer

The following tests have empty bodies and register as green in CI:

- `'accepts a pending dispatch'`
- `'advances from acknowledged to en_route'`
- `'advances from en_route to on_scene'`
- `'resolves a dispatch from on_scene'`

The entire accept → acknowledge → en_route → on_scene → resolve lifecycle has zero E2E coverage. Per `docs/learnings.md`: "A passing test is not enough; confirm it actually exercises the changed path."

**Fix:** Convert to `test.skip('accepts a pending dispatch', ...)` so CI surfaces them as pending rather than green, until they are implemented.

---

### 7. No E2E test for the decline flow

**File:** `e2e-tests/specs/responder.spec.ts`
**Agent:** pr-test-analyzer

The PR's primary new user-facing feature — the `DeclineForm` in `DispatchDetailPage` — has no integration or E2E test. The backend callable is tested. The hook wiring, the disabled-state logic on empty reason, and post-decline page state are not.

**Needed:** A test that seeds a pending dispatch, navigates to detail, submits a decline reason, and asserts the page reflects the declined state.

---

## Important — Fix Soon

### 8. Auto-advance stuck state — ref set before `await`, no retry path

**File:** `apps/responder-app/src/pages/DispatchDetailPage.tsx:87-100`
**Agent:** code-reviewer, silent-failure-hunter

```ts
const advanceAttemptedRef = useRef(false)
useEffect(() => {
  if (dispatch?.status === 'accepted' && !advanceAttemptedRef.current) {
    advanceAttemptedRef.current = true // set before await
    void advance('acknowledged')
  }
}, [dispatch?.status, advance])
```

If `advance('acknowledged')` fails, `advanceAttemptedRef.current` is already `true` and the effect will not retry (status hasn't changed, so the effect deps don't re-fire). The responder sees an error banner but has no button to retry. The acknowledgement deadline clock keeps ticking. This is a safety-critical stuck state.

**Fix:** Either only set the ref after a successful await, or remove the ref entirely and rely on the callable's idempotency key to prevent duplicate writes (the server already handles this):

```ts
useEffect(() => {
  if (dispatch?.status === 'accepted') {
    void advance('acknowledged')
  }
}, [dispatch?.status])
```

---

### 9. `dispatch.assignedTo` accessed without null guard in decline callable

**File:** `functions/src/callables/decline-dispatch.ts:65`
**Agent:** code-reviewer

```ts
// decline-dispatch.ts (unsafe)
if (actor.claims.role !== 'responder' || dispatch.assignedTo.uid !== actor.uid)

// accept-dispatch.ts (safe pattern)
if (!d.assignedTo?.uid || d.assignedTo.uid !== ...)
```

A malformed dispatch document (missing `assignedTo`) throws `TypeError: Cannot read properties of undefined` inside the transaction, surfacing as a generic `internal` error rather than `permission-denied` or `failed-precondition`.

---

### 10. All callable hooks catch errors with zero logging

**Files:** `apps/responder-app/src/hooks/useDeclineDispatch.ts`, `useAcceptDispatch.ts`, `useAdvanceDispatch.ts` — all catch blocks
**Agent:** silent-failure-hunter

All three hooks catch callable errors, store them in React state, and render them to screen. None emit `console.error`. Callable failures in production are invisible to Cloud Logging — debugging requires correlating Firestore write timestamps with anonymous user sessions.

**Fix:** Add `console.error('[useDeclineDispatch] decline failed:', err)` (and equivalents) in each catch block.

---

### 11. Raw Firebase error codes shown to responders

**File:** `apps/responder-app/src/pages/DispatchDetailPage.tsx:134`
**Agent:** silent-failure-hunter

```ts
{declineError && <p style={{ color: 'red' }}>Error: {declineError.message}</p>}
```

This renders `"Firebase: Error (functions/failed-precondition)."` to a responder in the field. The `advanceError` handler at lines 162–167 already maps `permission-denied` to a human sentence — `declineError` and `acceptError` need the same treatment.

---

### 12. `useDispatch` snapshot success-path: unmapped exception silently crashes listener

**File:** `apps/responder-app/src/hooks/useDispatch.ts:56-70`
**Agent:** silent-failure-hunter

An exception thrown inside the `onSnapshot` success callback (e.g., `snap.data()` returning `undefined` during a race with document deletion, or `getResponderUiState` throwing on an unknown status) is not routed to the error callback by Firebase — it is an unhandled exception that silently kills the listener. The page freezes on stale data.

**Fix:** Wrap the success-path body in try-catch and guard `snap.data()`:

```ts
(snap) => {
  try {
    if (!snap.exists()) { setDispatch(undefined); return }
    const data = snap.data()
    if (!data) {
      console.error('[useDispatch] snap.exists() true but snap.data() undefined', snap.id)
      setDispatch(undefined)
      return
    }
    // ... mapping
  } catch (mappingErr) {
    console.error('[useDispatch] snapshot mapping failed:', mappingErr)
    setError(mappingErr instanceof Error ? mappingErr : new Error(String(mappingErr)))
  } finally {
    setLoading(false)
  }
},
```

---

### 13. `signOut` rejection silently swallowed

**File:** `apps/responder-app/src/pages/DispatchListPage.tsx:23`
**Agent:** silent-failure-hunter

```ts
<button onClick={() => void signOut()}>Sign out</button>
```

`fbSignOut(auth)` can reject on network error or auth service outage. Responder believes they signed out; their session remains active.

---

### 14. Mirror trigger integration test has no coverage for `declined` dispatch path

**File:** `functions/src/__tests__/triggers/dispatch-mirror-to-report.test.ts`
**Agent:** pr-test-analyzer

`dispatch-mirror-to-report.ts` lines 118–141 handle `declined` and `timed_out` statuses by reverting the parent report to `verified` and clearing `currentDispatchId`. This state-restoration path is exercised by no integration test. A broken revert leaves reports permanently stuck in `assigned` after a responder declines, blocking re-dispatch.

---

### 15. No test for unauthenticated or wrong-role path in decline callable

**File:** `functions/src/__tests__/callables/decline-dispatch.test.ts`
**Agent:** pr-test-analyzer

The callable handler layer test only exercises the happy path (valid responder, valid data). `requireAuth(request, ['responder'])` is untested at the handler level — neither the unauthenticated path nor the wrong-role path is covered.

---

### 16. `accountStatus` auth bypass in all callables except decline (latent, not introduced here)

**Files:** `functions/src/callables/accept-dispatch.ts:107`, `cancel-dispatch.ts:170`, `close-report.ts:199`, `dispatch-responder.ts:261`, `reject-report.ts:129`, `verify-report.ts:202`
**Agent:** code-reviewer

All other callables check `claims.active !== true`, which is structurally always `true` because no such claim exists — the correct field is `accountStatus === 'active'`. Decline is the only callable checking the right field. This means the "account is not active" guard is bypassed on every other callable. Not introduced by this PR but surfaced by it. Recommend a shared `requireActiveAccount(claims)` helper to prevent drift.

---

## Medium — Backlog

### 17. Local `DispatchDoc` duplicates `shared-validators` with weaker constraints

**File:** `apps/responder-app/src/hooks/useDispatch.ts`
**Agent:** type-design-analyzer

The local `DispatchDoc` interface is a divergent copy of the one in `@bantayog/shared-validators/dispatches.ts`. The local version makes required fields optional, uses `string` where the schema uses `z.enum`, and omits `idempotencyPayloadHash` and `statusUpdatedAt`. This is the root cause of issues #12, #20, and many of the optional-field invariant concerns.

**Fix:** Import `DispatchDoc` from `@bantayog/shared-validators` and extend it:

```ts
import type { DispatchDoc as BaseDispatchDoc } from '@bantayog/shared-validators'
export type DispatchDoc = BaseDispatchDoc & {
  dispatchId: string
  uiStatus: ResponderUiState
  terminalSurface: TerminalSurface
}
```

---

### 18. `OwnDispatchRow.status` wider than the Firestore query

**File:** `apps/responder-app/src/hooks/useOwnDispatches.ts`
**Agent:** type-design-analyzer

The query uses `where('status', 'in', ['pending', 'accepted', 'acknowledged', 'en_route', 'on_scene'])` but `OwnDispatchRow.status` is typed as `DispatchStatus` (all 10 values). Consumers must defend against statuses that can never appear.

**Fix:**

```ts
export type ActiveDispatchStatus = Extract<
  DispatchStatus,
  'pending' | 'accepted' | 'acknowledged' | 'en_route' | 'on_scene'
>
```

---

### 19. `useOwnDispatches` error handler clears rows — "No active dispatches" on transient error

**File:** `apps/responder-app/src/hooks/useOwnDispatches.ts:60-64`
**Agent:** silent-failure-hunter

On Firestore error, `setRows([])` makes the list appear empty. A responder with active dispatches sees "No active dispatches." below an unfriendly raw error string. Keep the last-known rows on error and show a reconnecting banner instead.

---

### 20. E2E seed document is missing required schema fields

**File:** `e2e-tests/fixtures/responder-seed.ts`
**Agent:** type-design-analyzer, pr-test-analyzer

The seed dispatch is missing `dispatchedBy`, `dispatchedByRole`, `idempotencyKey`, `idempotencyPayloadHash`, and `statusUpdatedAt` — all required by `dispatchDocSchema`. The E2E tests pass only because the callable casts with `as DispatchDoc` rather than parsing. If validation is ever added to `declineDispatchCore`, the E2E harness will fail with cryptic errors.

**Fix:** Build the seed from `z.input<typeof dispatchDocSchema>` with required fields populated, and call `dispatchDocSchema.parse(seedDoc)` at startup to fail fast on schema drift.

---

### 21. Emulator port mismatch: tests hardcode `8080`, `firebase.json` uses `8081`

**File:** `functions/src/__tests__/callables/decline-dispatch.test.ts:43`
**Agent:** pr-test-analyzer

`firebase.json` configures the Firestore emulator at port `8081` (updated per E2E harness fixes in `docs/progress.md`). The callable test still hardcodes `8080`. The function tests and E2E tests may be targeting different emulator instances.

---

### 22. `decline('')` silently returns instead of throwing

**File:** `apps/responder-app/src/hooks/useDeclineDispatch.ts`
**Agent:** type-design-analyzer

The empty-reason guard sets error state and returns without throwing. Return type is `Promise<void>` so the caller cannot distinguish success from soft-failure without reading state. In a system where every declined dispatch requires a documented reason for audit, a guard that silently returns is weaker than it appears.

---

### 23. `getUserByEmail` `.catch(() => null)` swallows all errors, not just "not found"

**File:** `e2e-tests/fixtures/responder-seed.ts:18, 48`
**Agent:** silent-failure-hunter

Auth emulator misconfiguration or network failure is swallowed as "user not found", causing `createUser` to fail with a less-descriptive error that looks like a test bug rather than a seed bug.

**Fix:**

```ts
const user = await auth.getUserByEmail(email).catch((err: unknown) => {
  if (err instanceof Error && err.message.includes('not-found')) return null
  throw err
})
```

---

### 24. No test for dispatch `NOT_FOUND` or idempotency key payload mismatch

**File:** `functions/src/__tests__/callables/decline-dispatch.test.ts`
**Agent:** pr-test-analyzer

Two callable paths have no test coverage:

- `throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found')` — real user-facing scenario for stale dispatch IDs
- `IdempotencyMismatchError` — same key replayed with different `declineReason`; the mismatch error mapping (`already-exists`) is untested

---

### 25. Emulator connections are fire-and-forget with no error handling

**File:** `apps/responder-app/src/app/firebase.ts:26-37`
**Agent:** silent-failure-hunter

All four `connectXxxEmulator` calls are wrapped in `void import(...).then(...)` with no `.catch()`. Emulator misconfiguration during E2E test setup produces no diagnostic output — the developer sees `PERMISSION_DENIED` from production Firebase instead of "emulator connection failed."

---

## Positive Observations

- Migration from in-memory mocks to real Firebase emulator in `decline-dispatch.test.ts` (HEAD vs HEAD~1) is a significant quality improvement. The new tests are far more trustworthy.
- The idempotency replay test correctly asserts both return value equality **and** event count — testing the contract, not just the return value.
- Transaction-level authorization in `declineDispatchCore` (reading the dispatch document inside the transaction before writing) correctly prevents TOCTOU races where a dispatch might be reassigned between auth check and write.
- Audit event and status update are co-transactional — the event and the state change are atomic, which is exactly right for a safety-critical audit trail.
- `dispatch-presentation.test.ts` coverage is clean and behavioral: meaningful input partitions for `getTerminalSurface`, `groupDispatchRows`, and `getSingleActiveDispatchId`.
- `seedAuthUsers`/`seedResponderDispatch` fixture separation is well-structured — each E2E test can seed independently rather than relying on shared global state.
- `queueMicrotask` guard on missing `uid` in `useOwnDispatches` prevents a synchronous state flush that would cause a flash of stale data.
- Firestore rules tests for the `dispatches` collection provide good boundary enforcement: wrong-municipality admin denial, wrong-responder denial, field allowlist enforcement.
