# Learnings

Generalized lessons applicable to all sessions. Session-specific incidents are stripped; the patterns remain.

---

## Process: Trust-But-Verify

**Never trust间接 evidence of work.** Commit messages lie. Subagent summaries describe intent, not result. Test passes don't prove the change was exercised.

- After any subagent dispatch or context compaction, re-read actual files before assuming progress
- For new behavior: write failing test, observe red, then implement
- Run tests and read ALL output — don't assume they passed correctly

---

## Security: Access Control Filters

**For filters where absence of value means "deny", never use a fallback that produces a permissive query.** Always guard with explicit error or early return.

```typescript
// WRONG — silent exposure
const municipality = user.municipality ?? 'none' // queries with impossible value

// CORRECT — explicit deny
if (!user.municipality) {
  setAuthError('AUTH_EXPIRED')
  return
}
```

---

## Security: Schema Normalization

**When normalizing a field, update BOTH read and write paths.** A query that reads `status` returns zero documents if `updateStatus` only writes `responderStatus`.

- Reads use normalized fields
- Writes are dual-field for migration compatibility

---

## Error Handling: Firestore Errors

**Firestore errors have stable `err.code` strings** (`permission-denied`, `deadline-exceeded`, `already-exists`). String-matching `err.message` breaks when messages change or localize. Always check `err.code` first.

**In disaster systems, silent failures are deadly.** Every failure mode must surface to user or log with structured error ID.

---

## React: useEffect Deps and Infinite Loops

**Render-body ref assignments can create infinite loops; useEffect assignments break the chain.**

- Putting `syncFnRef.current = syncQueue` in the render body fires synchronously before effects
- Moving it to `useEffect(() => { syncFnRef.current = syncQueue }, [syncQueue])` fires after render — guard (`syncInProgressRef`) is already set when the callback runs

**Rule:** When adding deps to a `useCallback` that is itself a dep of a `useEffect`, check if the render-body assignment pattern creates a loop. Move ref assignments to effects.

---

## React: Ref + State Synchronization

`useRef(initialState)` initializes once; `ref.current` never updates when initialState changes. To keep them in sync:

```typescript
// WRONG — stale ref
const latestAlertsRef = useRef(alerts) // captures initial state only

// CORRECT — separate effect syncs them
const latestAlertsRef = useRef(alerts)
useEffect(() => {
  latestAlertsRef.current = alerts
}, [alerts])
```

---

## React: Prop vs Internal State for Critical Data

**When a component depends on external data (geolocation, auth), either fetch it internally or make it a required prop.** Optional props for critical data = silent failure.

```typescript
// Fetch internally — resilient
const geo = useGeolocation()
const resolved = userLocation ?? geo.coordinates ?? undefined

// OR require it — explicit, caught at compile time
interface Props {
  userLocation: Coordinates
}
```

---

## Testing: vi.hoisted for Mock Factories

`vi.hoisted()` runs before module-level declarations. All mock functions must be defined INSIDE the callback:

```typescript
// WRONG — ReferenceError
const mock = vi.fn()
vi.hoisted(() => ({ mock })) // mock not yet declared

// CORRECT
const { mockFn } = vi.hoisted(() => ({
  mockFn: vi.fn().mockResolvedValue([]),
}))
vi.mock('../../service', () => ({ service: { fn: mockFn } }))
```

---

## Testing: requestAnimationFrame in Vitest

`vi.useFakeTimers()` does not reliably auto-spy RAF in jsdom. Capture the callback reference and invoke it directly:

```typescript
const savedRAF = vi.hoisted(() => ({
  current: null as ((cb: FrameRequestCallback) => number) | null,
}))
vi.stubGlobal('requestAnimationFrame', (cb) => {
  savedRAF.current = cb
  return ++id
})
// In test:
if (savedRAF.current) savedRAF.current(performance.now())
```

---

## Testing: Firebase Mocks for Integration Tests

When a component uses Firestore contexts, mocks are needed at module level:

```typescript
vi.mock('@/app/firebase/config', () => ({ db: {}, auth: {} }))
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
  getDocs: vi.fn(),
}))
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn((cb) => {
    cb(null)
    return vi.fn()
  }),
}))
```

---

## Firestore Rules: Function Arguments

**In Firestore Rules DSL, function parameters are silently discarded if unused.** `isResponderOwner(opsId)` compiles fine — `opsId` is ignored. This is a security code smell: always match call sites to actual function signatures.

---

## Code: Catch Parameters

Always use `catch (err: unknown)` in TypeScript strict mode. The `unknown` type forces you to narrow before using.

```typescript
// WRONG
catch (err) // implicitly any in non-strict, silent in strict

// CORRECT
catch (err: unknown) {
  if (err instanceof Error) console.error(err.message)
}
```

---

## Code: Navigator Clipboard in Vitest

`navigator.clipboard` is an inherited getter in happy-dom — not an own property. Spying requires defining it as an own property:

```typescript
// In beforeEach — create mock with own clipboard property
const mockNav = Object.create(Object.getPrototypeOf(navigator))
Object.assign(mockNav, navigator)
mockNav.clipboard = { writeText: vi.fn() }
global.navigator = mockNav

// In test — direct assignment also works
;(navigator as any).clipboard = { writeText: mockWriteText }
```

`navigator.share` IS an own property — direct `vi.fn()` spy works reliably.

---

## General: One Concern Per Branch

- One concern per conversation, one per branch, one per PR
- Feature freezes for structural changes (folder restructures, schema migrations, rule changes)
- Never bundle unrelated fixes "since we're here"

## General: Risky Changes Require Overnight Soak

Firestore rules, DB indexes, Cloud Function deploys, and auth flow changes have blast radius too large for same-session deploy. Minimum: dev emulator → staging overnight → explicit prod approval.

Always include rollback command in PR description before deploying.

---

## General: Short Answers for Simple Questions

No headers, sections, or insights blocks when a sentence suffices.

---

## Phase 0 Final Verification (2026-04-17)

### Vitest Workspace Path Resolution

## CI: Prefer Corepack When action-setup v6 Is Suspect

If GitHub Actions reports `ERR_PNPM_BROKEN_LOCKFILE` against a lockfile that is structurally clean locally and in git, do not keep iterating on `pnpm/action-setup` flags blindly.

- Compare the failing runner path against a local control case with the same Node and pnpm versions
- If `corepack prepare pnpm@<version> --activate` succeeds locally while `pnpm/action-setup@v6` fails in CI, treat the action path as the unstable variable
- Removing `cache: pnpm` from `actions/setup-node` is acceptable when pnpm is installed after `setup-node`; correctness beats cache optimization

**Problem:** Root `vitest.config.ts` used `defineWorkspace(['packages/*', 'apps/*'])`. When individual packages (e.g., `shared-data`) ran `vitest run --passWithNoTests` from their own directory, vitest walked up and found the root config. The workspace entries (`packages/shared-data`, etc.) were resolved relative to the CWD, not the config file's directory. Since `shared-data` has no `vitest.config.ts`, vitest tried to load `packages/shared-data/vitest.config.ts` (wrong path) and errored with "config must export or return an object."

**Fix:** Two-part:

1. Renamed `vitest.config.ts` → `vitest.workspace.ts` (vitest does not auto-discover `vitest.workspace.ts`)
2. Removed `test` scripts from all packages/apps that have no test files; kept only `packages/shared-validators` (the only package with tests) in the workspace
3. Changed root `pnpm test` to `vitest run` (auto-discovers `vitest.workspace.ts` from root) instead of `turbo run test`

**Rule:** When using vitest workspace configs, workspace entries must be resolvable from every CWD that might run vitest. Prefer explicit package paths over glob patterns, and remove test scripts from packages that don't have tests.

### Prettier: Do Not Copy Unformatted Files

**Problem:** `.claude/rules/*.md`, `docs/roles/*.md`, `prd/*.md`, and `docs/superpowers/specs/*.md` were copied from the original project into the new branch without running Prettier. When `format:check` was added to the CI pipeline (new in this branch), all 14 files failed.

**Fix:** Run `pnpm prettier --write` on all docs files before committing when adding a format-check pipeline to a project that previously did not enforce formatting.

**Rule:** When introducing `format:check` to a project, Prettier-format all existing docs files in the same commit so the new gate does not immediately fail on pre-existing content.

### Vitest: `vitest.workspace.ts` vs `vitest.config.ts`

Vitest auto-discovers `vitest.config.ts` but NOT `vitest.workspace.ts`. Use `vitest.workspace.ts` when you want to define a workspace at the root but do NOT want individual packages to auto-pick it up (unless explicitly targeted). This is the correct pattern for monorepos where most packages do not have tests.

### Terraform: `google_project_iam_member` vs `google_service_account_iam_member`

When a service account needs to impersonate another SA, always use `google_service_account_iam_member` scoped to the _specific_ target SA — not `google_project_iam_member` at project level. Project-level `roles/iam.serviceAccountUser` grants impersonation of _every_ SA in the project, violating least privilege. The `google_service_account_iam_member` resource requires `service_account_id = google_service_account.target.name` (not email) and grants impersonation rights on that specific SA only.

---

## Phase 3a: Citizen Submission (2026-04-18)

### Idempotency Guard: Distinguish Fresh vs Cached

`withIdempotency` must return a flag distinguishing fresh execution from cached replay. The outer-check pattern (set `processedAt` inside callback, then check it outside) fails because fresh materializations always have `processedAt` defined after the callback returns — it was just set. The correct approach:

```typescript
// WRONG — fresh materializations always have processedAt defined
const result = await withIdempotency(...)
if (result.materialized && (await inboxRef.get()).data()?.processedAt !== undefined) {
  return { ...result, replayed: true }
}

// CORRECT — guard returns metadata about cache hit
const { result, fromCache } = await withIdempotency(...)
return { materialized: result.materialized, replayed: fromCache, reportId: result.reportId }
```

### Firebase Functions v2: Cloud Run resource type

Functions v2 emit under `resource.type="cloud_run_revision"`, not `cloud_function`. Terraform logging metric filters must include both. Also add `jsonPayload.code:*` to filter to structured logs only.

### Error Code Exhaustiveness

`Record<string, FunctionsErrorCode>` with `?? 'internal'` silently maps unmapped codes. Use `Record<BantayogErrorCode, FunctionsErrorCode>` — TypeScript enforces coverage of all enum values at compile time.

### Storage Trigger Error Handling

Firebase Storage triggers only retry when handlers throw. Catching all errors and returning normally marks the event as complete — transient failures (network, sharp) will NOT retry. Only suppress explicitly terminal rejections (`MEDIA_REJECTED_MIME`, `MEDIA_REJECTED_CORRUPT`); rethrow operational failures.

### pnpm Workspace: Explicit Dependencies Don't Auto-Resolve

If a package imports a subpath of a workspace dep (`firebase/functions` from `firebase-admin`), the workspace `*` link does not automatically cover transitive subpaths. Always add explicit `firebase@^12.x.x` when importing subpackages directly.

---

## Phase 2: Data Model and Security Rules

### Firestore rules: `resource.data.__reportId` does not exist

Firestore rules do not expose a synthetic `__reportId` on `resource.data`. Cross-document sharing checks (e.g., `canReadReportDoc` helper used for report subcollections) must be implemented per-collection using the document ID from the path, not a hypothetical field on `resource.data`. The helper `canReadReportDoc(data)` was kept narrow; sharing logic lives at each collection's `match` block.

### Rule coverage checker regex must match at path segment boundaries

The regex `['"\`]<collection>[/'\`"]`must only match`match /<collection>/`at the start of a path segment. If the collection name appears as a substring inside another path (e.g.,`hazard_zones_history`containing`hazard_zones`), the checker produces false negatives. Use `match\s+/` prefix in the regex.

### Subagent commit reports are unreliable — always verify with git log

Subagent implementers sometimes report commits that don't exist in the actual git history (due to hook failures, revert operations, or self-review issues). Always run `git log --oneline -3` to confirm the actual commit state before proceeding to review. The file on disk is the only source of truth.

### Firebase RTDB `.validate` rules require all children at once

A `.validate` rule like `newData.hasChildren([...])` only checks that those keys exist — not their types or values. It does not cascade to nested validation. For required field validation, the rule checks presence only; type validation must be done in Cloud Functions or security rules with explicit field-by-field checks.

### RTDB and Storage emulators need explicit initialization in test harness

The `initializeTestEnvironment` from `@firebase/rules-unit-testing` accepts an options object with `firestore`, `database`, and `storage` entries. When testing only one emulator (e.g., RTDB), you can omit storage — but if `createTestEnv` is called with all three emulators configured and only one is running, tests hang. Use `initializeTestEnvironment` directly with only the emulators you need for the test file.

### Every `strict()` Zod object rejects unknown keys — critical for rule alignment

Firestore `diff(resource.data).affectedKeys().hasOnly([...])` at the rule layer rejects any unknown key the same way a strict Zod schema does. If the Zod schema allows extra keys but the rules don't, production writes will be denied. Always use `.strict()` on Zod schemas that map to Firestore documents.

### `allow write: if false` at collection level overrides subcollection rules

When a parent collection has `allow write: if false` and a nested subcollection is defined after it, the subcollection inherits the parent rule unless explicitly overridden. To give a subcollection write access while keeping the parent deny-all, define both explicitly. Note: this inheritance is per-Firestore-rule-file structure, not a general Firestore behavior.

### Rules codegen eliminates a whole class of drift bugs

Hand-rolled `validResponderTransition` helpers in Firestore rules drift from the TypeScript source of truth. The codegen pipeline (`scripts/build-rules.ts` + template with `@@TRANSITION_TABLES@@` marker) guarantees the rules file matches `shared-validators/src/state-machines/`. CI drift-check gate (`git diff --exit-code` after codegen) catches any local edit to the generated file. This pattern should extend to any future transition tables or validation helpers that exist in both TypeScript and rules layers.

### Dependency injection in client-side orchestrators enables clean unit testing

The `submitReport` orchestrator in `apps/citizen-pwa/src/services/submit-report.ts` accepts a `SubmitReportDeps` interface instead of importing Firebase directly. This allowed 2 focused unit tests with `vi.fn()` mocks — zero Firebase SDK involvement in the test. When the orchestrator needs to coordinate multiple async steps (get signed URL, PUT blob, write inbox), the DI pattern avoids the "20-line mock setup" smell entirely.

---

## QA Edge Hunter Session (2026-04-18)

### Subagent commits can land on wrong branch

A subagent reported committing to `fix/qa-edge-hunter-fixes-2026-04-18` but `git log` showed the commit was on `main`. Root cause: the worktree's HEAD was detached (the worktree creation didn't checkout the branch immediately, it was created with `-b` but the branch was not yet created when the subagent ran `git commit`). The subagent's `git commit` landed on `main` because that's what the worktree considered its HEAD.

**Fix:** After creating a worktree with `git worktree add .worktrees/X -b feature/X`, immediately checkout the new branch explicitly. Rebase the worktree onto `main` if the branch commits are elsewhere.

**Rule:** Always run `git log --oneline -3 && git status` after a subagent reports a commit to verify the commit landed on the correct branch.

### Pre-commit hook auto-revert on lint failure

When lint-staged runs eslint and finds errors, it:

1. Fails the pre-commit hook
2. Auto-reverts staged changes
3. Leaves working tree with the pre-lint (unlinted) state

To recover: fix the lint error, stage again, and commit.

### `git diff HEAD` vs `git diff main` matters

The worktree showed `git diff functions/src/triggers/on-media-finalize.ts` as clean (no changes) because the file on disk matched the latest commit on the worktree's branch. But `git diff main -- functions/src/triggers/on-media-finalize.ts` showed the fix. Always diff against the right baseline when verifying worktree state.

### Zod `.refine()` with `||` triggers `prefer-nullish-coalescing` lint

When a Zod `.refine()` uses `||` in its predicate (e.g., `(d.supersededBy && d.supersededAt) || (!d.supersededBy && !d.supersededAt)`), ESLint's `@typescript-eslint/prefer-nullish-coalescing` rule fires because `!!d.supersededBy` is truthy but not specifically nullish. The fix is to use explicit `!== undefined` comparisons to avoid the rule triggering on the logical-or expression.

### Worktree rebase can land commits out-of-order

Commit `6546a0e` ("fix validators: cap pendingMediaIds at 20") was made by a subagent and appeared in `git log` but wasn't in the worktree's HEAD. It was on `main`. After `git rebase main`, it appeared at the correct position in history. Always rebase worktrees onto main before starting implementation to avoid this confusion.

### `seedReportAtStatus` uses Firebase Admin Timestamp, incompatible with RulesTestContext

`seedReportAtStatus` (seed-factories.ts) uses `firebase-admin/firestore` `Timestamp.now()` which is incompatible with RulesTestEnvironment's `withSecurityRulesDisabled` context (uses JS SDK). Error: `FirebaseError: Function DocumentReference.set() called with invalid data. Unsupported field value: a custom Timestamp object`. Fix: write inline seeding with numeric `ts` timestamps (like other rules tests) instead of calling `seedReportAtStatus`.

### ESLint `no-explicit-any` requires combined disable comment for multiple rules on same line

When accessing `self` as `any` for Firebase App Check debug token (`self as any).FIREBASE_APPCHECK_DEBUG_TOKEN`), ESLint fires both `@typescript-eslint/no-explicit-any` AND `@typescript-eslint/no-unsafe-member-access`. Two separate `// eslint-disable-next-line` comments don't work — the second one is consumed by the same tool call. Solution: use a single combined comment: `// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access`.

### `no-floating-promises` requires `void` prefix on all Promise-returning functions passed as event handlers

ESLint's `no-floating-promises` (from `typescript-eslint/strict-type-checked`) treats any Promise-returning function passed to an event handler (like `onClick`, `onSubmit`) as a violation. The fix is to wrap the call: `void handleSignIn(email, password)` instead of just `handleSignIn(email, password)`.

### `no-confusing-void-expression` fires on arrow function shorthand with void-returning callback

When an event handler like `onClick` calls a void-returning function with arrow shorthand `() => setBanner(msg)`, ESLint's `no-confusing-void-expression` fires because the callback itself doesn't return void explicitly. The fix is to use block body: `onClick={() => { setBanner(msg) }}`.

### `React.FormEvent` deprecated — use inline `// eslint-disable-next-line @typescript-eslint/no-deprecated`

The `@typescript-eslint/no-deprecated` rule flags `React.FormEvent`. Since React's own type definition marks it deprecated, and there's no clean replacement that works across all React versions, the correct approach is to add an inline disable comment on the specific line: `// eslint-disable-next-line @typescript-eslint/no-deprecated`.

---

## Phase 3c: E2E SSL Debugging (2026-04-19)

### `staging.bantayog.web.app` is not a Firebase Hosting domain

Firebase Hosting sites get URLs in the format `<site-id>.web.app`. The project `bantayog-alert-staging` has one site: `bantayog-alert-staging.web.app`. The domain `staging.bantayog.web.app` resolves to the same Firebase CDN IP but the SSL certificate is for `CN=firebaseapp.com` — it does not include this hostname as a SAN, causing `ERR_CERT_COMMON_NAME_INVALID`.

**Rule:** Never assume a Firebase Hosting URL format. Always verify with `firebase hosting:sites:list` and `firebase hosting:channel:list`. Custom domains must be explicitly configured in Firebase Hosting.

### E2E test BASE_URL must match webServer config

When `playwright.config.ts` defines `webServer` entries for local dev servers (e.g., admin on port 5175), the corresponding spec files must default to the same localhost URL, not a staging URL. Otherwise tests fail with SSL errors when run locally even though the dev server is running.

**Rule:** Spec file `BASE_URL` defaults should match the `webServer` ports in `playwright.config.ts`. Override with `process.env.BASE_URL` only for staging/CI runs.
