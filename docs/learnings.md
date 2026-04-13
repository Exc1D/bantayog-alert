# Learnings - 2026-04-11

## Development Process

### Subagent-Driven Development Notes

**What worked well:**
- Two-stage review (spec compliance → code quality) caught real issues:
  - Untyped `catch (err)` in LinkReportsByPhone
  - `window.location.href` SPA routing anti-pattern
  - Missing `aria-hidden` on decorative icons
- Fresh subagent per task kept context clean
- Implementer → spec reviewer → code reviewer flow ensured quality gates

**What to avoid:**
- Don't skip review loops when issues are found
- Don't move to next task while either review has open issues

### Code Quality Patterns

**TypeScript Strict Mode:**
- `catch (err)` without type annotation violates strict mode → use `catch (err: unknown)`
- React Router navigation: Use `useNavigate()` hook, not `window.location.href`
- Decorative icons need `aria-hidden="true"` for accessibility

**React Hooks:**
- Always mock `react-router-dom` when testing components that use `useNavigate`

**Firestore in Tests:**
- Firebase emulators needed for E2E tests - unit tests mock the SDK
- Offline queue tests have infrastructure incompatibility (Playwright's `setOffline()` doesn't trigger `navigator.onLine`)

### Architecture Decisions

**Anonymous Report Linking:**
- Phone-based linking queries `report_private` collection by `reporterPhone`
- Validation uses PH mobile regex: `/^(\+?63|0)?[0-9]{10}$/`

**COPPA Age Gate:**
- Uses localStorage key `age_verified` for persistence
- Renders null when already verified (checks on mount)

**Rate Limiting UI:**
- Hardcoded `mdrmoHotline` and `retryAfterMinutes` - consider making configurable

**ReportDetailScreen + Timeline:**
- Timeline built from report status history (submitted, verified, resolved)
- Share button uses native share API with clipboard fallback

**BeforeAfterGallery:**
- Uses URL as key for photo items - fragile for duplicate URLs
- Fullscreen viewer supports prev/next navigation

## Mistakes Made

1. **Task 13 (LinkReportsByPhone):** Initially used `window.location.href` which breaks SPA routing - fixed via code review
2. **Task 13:** Untyped catch parameter - fixed via code review
3. **Task 15 (RateLimitExceeded):** Decorative icons missing `aria-hidden` - fixed before amend
4. **E2E Tests:** Offline queue tests have infrastructure issue (navigator.onLine vs socket-level offline) - documented as known limitation

## Context for Future Sessions

- This session implemented Tasks 1-17 from `citizen-features-gap-fix.md` plan
- Tasks 1-10 were completed before context compaction
- Tasks 11-17 completed in this session with full two-stage review
- Pre-compaction state preserved in vault for context continuity

---

# Learnings - 2026-04-12

## Firebase Test Mocks Pattern

**Issue:** `ReportForm.test.tsx` failed with `FirebaseError: auth/invalid-api-key` because it imports `useDuplicateCheck` which transitively imports `firebase/firestore`, triggering firebase auth initialization before mocks are applied.

**Fix:** Added firebase mocks to `ReportForm.test.tsx`:
```typescript
vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  query: vi.fn().mockReturnValue({}),
  where: vi.fn().mockReturnValue({}),
  orderBy: vi.fn().mockReturnValue({}),
  limit: vi.fn().mockReturnValue({}),
  getDocs: vi.fn().mockResolvedValue({ docs: [], forEach: () => {} }),
  Timestamp: { fromDate: vi.fn((date: Date) => ({ toDate: () => date })) },
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => { callback(null); return vi.fn() }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/app/firebase/config', () => ({
  db: {},
  auth: { onAuthStateChanged: vi.fn((callback) => { callback(null); return vi.fn() }) },
}))
```

Also needed `vi.hoisted` mock state reset in `beforeEach`:
```typescript
duplicateCheckState.duplicates = []  // reset shared mock state
```

## Error Handling Patterns

1. **File access errors:** Wrap `e.target.files` access in try/catch — `SecurityError`, `NotAllowedError`, `AbortError` can occur on file selection
2. **Callback errors:** Wrap `onSubmit?.()` calls in try/catch — parent callbacks can throw without crashing the form
3. **Offline queue:** Call `onSubmit?.()` before `enqueueReport()` so parent is always notified
4. **`Promise.allSettled`:** Use for multi-file operations where partial success is meaningful

## Pre-existing Issues Found

- `useReportQueue.test.ts` and `QueueIndicator.test.tsx` lack firebase mocks — fail without `.env.local`
- `ReportForm.tsx` has pre-existing TS errors (unused `Button` import, type mismatch in `onSubmit` callback)
- `useReportQueue.ts` has pre-existing TS error at `submitReport` call (type mismatch)


---

## Learnings - 2026-04-12 (PR #11 Session)

### Subagent Branch Isolation Issue

**Problem:** Implementer subagent's commits for Task 2 (`loadError` surfacing) were made to branch `fix/ui-enhancements-and-pr6-restoration-2026-04-12` instead of `fix/pr10-test-error-fixes-2026-04-12`. Root cause: subagent ran on `main` branch (controller's main worktree) instead of the feature worktree.

**Prevention:** Before dispatching subagents, verify `git branch -vv` shows the correct worktree is being used. When using worktrees, either:
1. `cd` into the worktree directory before dispatching, OR
2. Have subagent use `git -C /path/to/worktree` commands

### Vitest Mock Path Issues in useReportQueue Tests

**Problem:** `vi.mock('../../services/reportQueue.service', ...)` used wrong path. Test file at `hooks/__tests__/` → service at `services/` requires `'../../services/reportQueue.service'`. With `vi.fn()` inside `vi.mock` factory without `vi.hoisted()`, per-test `mockImplementation()` calls have no effect because factory runs once at module init.

**Fix:** Use `vi.hoisted()` to create shared mock function references that are initialized before `vi.mock` runs:
```typescript
const getAllMock = vi.hoisted(() => vi.fn().mockResolvedValue([]))
vi.mock('../../services/reportQueue.service', () => ({
  reportQueueService: { getAll: getAllMock, ... }
}))
// Now per-test: getAllMock.mockRejectedValueOnce(...)
```

### Template Literal Escaping in Edit Tool

**Problem:** Using Edit tool with template literal backticks (`` ` ``) sometimes resulted in escaped backticks (`\``) in the file, breaking TypeScript.

**Lesson:** When editing template literals, ensure the new_string contains unescaped backticks. The Edit tool passes strings literally — any escaping in input ends up in the file.

### What Worked

- Two-stage review (spec compliance → code quality) continued to catch real issues
- Test-writing tasks (4-8) proceeded cleanly with no infrastructure issues
- Accepting limitations and documenting them was better than spending excessive time debugging

### Verification Gap — Always Re-Check Before Assuming

**Problem:** After context compaction, I assumed Task 1 (`catch (err: unknown)` in ReportForm) was done because a commit existed (`169bb57 fix(ReportForm): call onSubmit on offline queue and wrap in try/catch`). But the commit used bare `catch (err)` without `unknown` type — the actual TypeScript fix was never applied.

**Lesson:** Just because a commit with a similar message exists doesn't mean the actual fix was implemented. Always verify the actual code state rather than trusting commit messages or summaries.

**What to do:** When resuming after compaction, re-read the actual source files to verify task completion rather than relying on vault summaries or commit messages.

### Vitest Path Resolution in Worktrees

**Issue:** When running `npm run test` from the controller session, it runs tests against `main` branch (at `/home/exxeed/dev/projects/bantayog-alert`), not the worktree. Worktree tests must be run from within the worktree directory.

**Fix:** Always `cd` into the worktree before running tests, or use absolute paths that point into the worktree.

### Bare `catch (err)` Still Violates TypeScript Strict Mode

**Issue:** `catch (err)` without type annotation is technically valid JS but violates TypeScript's `noImplicitAny` in strict mode when the catch clause parameter has no type. Wait — actually `catch (err)` IS valid TypeScript. The `unknown` type is about *which* type to use, not *whether* to use a type.

The real issue is that `catch (error)` gives you `any` implicitly in non-strict mode, and the project uses strict mode. So `catch (err: unknown)` is the correct pattern for TypeScript strictness.



---

## Learnings - 2026-04-12 (PR #12 Error Handling Session)

### Silent Failure Pattern in RegisteredProfile

**Issue:** `handleSyncNow`, `handleLogout`, and `handleDownloadData` all used bare `console.error` in catch blocks without surfacing errors to users.

**Fix applied:** Added error states (`syncError`, `logoutError`, `downloadError`) with user-facing error messages.

### Gap Analysis During Plan Review

Before implementing, we reviewed the plan against actual code and found:
1. **syncResult conflict** - When sync fails, old "Last sync: X synced" message would persist alongside error. Fixed by clearing `syncResult` on error.
2. **logoutError UI location** - Logout button is in main `RegisteredProfile` component, not `SettingsTab`. Error display must be co-located with the button, not passed as prop.
3. **downloadError vs deleteError** - Both errors display in Data Management section (same area), handled by stacking them in a `space-y-2` container.

### Error State Placement Rules

| Error State | Display Location | Why |
|------------|-----------------|-----|
| `syncError` | SettingsTab (Pending Reports section) | Sync is a SettingsTab feature |
| `logoutError` | RegisteredProfile main (near logout button) | Logout is NOT in SettingsTab |
| `downloadError` | SettingsTab (Data Management section) | Download is a SettingsTab feature |
| `deleteError` | SettingsTab (Data Management section) | Delete is a SettingsTab feature |

### Error Message Patterns

```typescript
// For user-facing errors (surfaced in UI):
setError(error instanceof Error ? error.message : 'Fallback message')

// For internal errors (logged only):
console.error('[ERROR_TAG]', error)
```

### vi.hoisted() Pattern for Error Test Mocks

When testing error flows, use `vi.hoisted()` for mock functions so per-test `.mockRejectedValueOnce()` works:

```typescript
const mockSyncQueue = vi.hoisted(() => vi.fn().mockResolvedValue({ success: 0, failed: 0 }))

vi.mock('@/features/report/hooks/useReportQueue', () => ({
  useReportQueue: vi.fn().mockReturnValue({
    syncQueue: mockSyncQueue,
    // ...
  }),
}))

// In test:
mockSyncQueue.mockRejectedValueOnce(new Error('Network error'))
```

### Subagent-Driven Development: Plan Review Phase

Adding a "plan review" phase before dispatching implementers caught 3 real issues:
1. Missing `setSyncResult(null)` on error
2. Wrong component for logout error display
3. Missing logout error test case

**Lesson:** Don't skip gap analysis - read actual code against plan before implementing.

---

## Learnings - 2026-04-12 (Alerts System — onSnapshot Rewrite)

### vi.hoisted Cannot Reference External const

**Problem:** `vi.hoisted(() => ({ subscribeToAlerts: subscribeToAlertsMock }))` failed with `ReferenceError: Cannot access 'subscribeToAlertsMock' before initialization` because `vi.hoisted` runs before module-level `const` declarations are initialized.

**Fix:** Define all mock functions INSIDE the `vi.hoisted` callback:
```typescript
const { subscribeToAlertsMock, subscribeToAlertsByMunicipalityMock } = vi.hoisted(() => ({
  subscribeToAlertsMock: vi.fn(),
  subscribeToAlertsByMunicipalityMock: vi.fn(),
}))
vi.mock('../../services/alert.service', () => ({
  subscribeToAlerts: subscribeToAlertsMock,
  subscribeToAlertsByMunicipality: subscribeToAlertsByMunicipalityMock,
}))
```

### onSnapshot Tests Need Immediate Mock Setup

**Issue:** When tests call `renderHook` without an immediate `mockImplementation`, the hook's `useEffect` runs synchronously and the mock must be pre-set (via `mockReturnValue` in `beforeEach`) or the test would throw.

**Fix:** Always set `mockReturnValue(vi.fn())` in `beforeEach` for the subscription mocks, then override per-test with `mockImplementation`.

### Dual-snapshot Merge Logic

**Decision:** When both `municipality` AND `role` are provided, both `subscribeToAlerts` (with role filter) and `subscribeToAlertsByMunicipality` run in parallel. Each listener calls `setAlerts` by merging new results with existing state and deduplicating by id. A counter tracks when both have delivered their first snapshot before setting `isLoading = false`.

### useAlerts IndexedDB Cache Fallback

**Implementation:** Added `alertsCache.ts` (new file) with `cacheAlerts()` and `loadCachedAlerts()` using a dedicated `bantayog-alerts-cache` IndexedDB database. On `onSnapshot` error, `handleError` in `useAlerts` becomes `async`, persists the current alert set to cache, then loads the cache as fallback so the UI stays populated instead of going blank.

**Key decision:** Used a separate `useEffect` to sync `useRef` with state (`latestAlertsRef.current = alerts`), rather than passing `alerts` as a `useRef` initializer. This prevents the ref from capturing stale initial state while still avoiding the circular-state-update problem.

**Lesson on ref + state synchronization:** `const ref = useRef(initialState)` initializes the ref once; `ref.current` never updates when `initialState` changes. You need a separate effect that writes `ref.current = state` on every render to keep them in sync.


### UserContext Pattern — No Pre-existing Context Found

**Problem:** Task asked to wire `AlertList` to receive `municipality` and `role` from "user context", but no such context existed in the codebase. `useAuth` only returns Firebase `User` (no `municipality`/`role`).

**Solution:** Created `UserContext.tsx` in `src/shared/hooks/` using the existing Firestore `getDocument` pattern — `useAuth` provides the Firebase UID, Firestore `users/{uid}` provides `municipality` and `role`. Anonymous users get `undefined` for both (fine — `useAlerts` handles missing args gracefully).

### vi.spyOn + Extra Args in Integration Tests

**Problem:** `vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue(...)` worked but Vitest internals sometimes inject extra args into the mock call. `toHaveBeenCalledWith(expect.objectContaining({...}), expect.any(Object), expect.any(Function))` failed because the second and third args were not `Object` and `Function` (they were Vitest internals).

**Fix:** Access `spy.mock.calls[0]?.[0]` to verify only the first argument:
```typescript
expect(spy.mock.calls[0]?.[0]).toMatchObject({ municipality: 'Daet', role: 'citizen' })
```

### Firebase Test Mocks for Integration Tests

When a component uses a context that fetches from Firestore (like `UserContext`), the integration test needs firebase mocks at the module level. Required mocks:
- `vi.mock('@/app/firebase/config')` — bypasses `getAuth`/`getFirestore` app initialization
- `vi.mock('firebase/firestore')` — `getFirestore`, `collection`, `doc`, `getDoc`, `onSnapshot`
- `vi.mock('firebase/auth')` — `getAuth`, `onAuthStateChanged`
- `vi.mock('@/shared/services/firestore.service')` — `getDocument`

Use `vi.hoisted` for mock refs that need per-test reset via `beforeEach`.

### navigator.clipboard Mocking Limitation in Vitest + happy-dom

**Problem:** `navigator.clipboard` is an inherited getter from `Navigator.prototype` in happy-dom. `Object.getOwnPropertyDescriptor(navigator, 'clipboard')` returns `undefined` and `Object.keys(navigator)` returns `[]` (empty). This makes it impossible to spy on `navigator.clipboard.writeText` directly.

**Workaround:** Create a mock navigator in `beforeEach` using `Object.create(Object.getPrototypeOf(global.navigator))` to preserve prototype chain, then copy own enumerable properties and define `clipboard` as an own property. In individual tests, use direct assignment: `;(global.navigator as any).clipboard = { writeText: mockWriteText }`. Note: spying on `navigator.clipboard.writeText` in Vitest requires `clipboard` to be an own property of the navigator instance, not an inherited getter.

**For share API tests:** `navigator.share` IS an own property of the navigator object in happy-dom, so `vi.fn()` spy + direct assignment works reliably. Use `Object.create(Object.getPrototypeOf(navigator))` to make a mock that can have its own `share` property.
