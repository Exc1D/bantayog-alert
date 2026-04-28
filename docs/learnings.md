# Learnings — Durable Rules

## Process

- Re-read files after edits/subagents/compaction. Disk is truth.
- Red test before behavior changes. Don’t bundle unrelated fixes.
- After squash merge, preserve branch ancestry if history matters.
- Firestore emulator seeded writes fail fast if rules don’t compile; fix rules harness first.
- Workspace packages exported as TS source can break Functions emulator; give it a real JS entrypoint.
- Idempotency hashing in callable code must be async and Web Crypto-safe; `node:crypto` fallback fails under ESM/browser bundling.
- Verify functions region before chasing auth/App Check issues; region mismatch produces misleading unauthenticated errors.
- **Stale `functions/lib/` binary is the #1 cause of `FirebaseError: internal` in E2E.** Rebuild after source changes.
- `createTestEnv()` requires Firestore, Database, and Storage emulators all running.
- Strict Zod schemas: strip transitional fields before validation rather than widening the schema.
- Ops-facing schemas should use ops-specific enums, not broader public enums.
- Don’t trust `tsc --outDir lib` to refresh declarations; verify emitted `.d.ts`.
- Use `z.uuid()` instead of `z.string().uuid()` (deprecated lint rule).
- Collection query rules differ from per-document rules; use `getDoc` if `getDocs` fails on `resource.data` checks.
- Seed documents via `env.withSecurityRulesDisabled()`, not unauthenticated context, when `create` is `false`.
- Rules transition tests must match the actual transition table in `firestore.rules`.

## Firestore

- All reads before first write in transactions.
- Fetch optional data up front; don’t read later in the transaction.
- Prefer stable error codes over message matching.

## Security

- Fail explicitly on missing auth/scope; no permissive fallbacks.
- Normalize fields on both read and write paths.
- Verify Firestore Rules function signatures match call sites.
- Staff MFA audits must inspect `multiFactor.enrolledFactors` directly; `CustomClaims.mfaEnrolled` can record intent, but custom claims are not the source of truth for current TOTP enrollment or factor type.
- Staff MFA audits must inspect `multiFactor.enrolledFactors` directly; custom claims only describe role and access, not whether TOTP is actually enrolled.

## Testing

- `vi.hoisted()` mocks must be created inside the hoisted callback.
- `requestAnimationFrame` in Vitest: capture callback explicitly, don’t assume timers.
- A passing test is not enough; confirm it exercises the changed path.
- BigQuery summary jobs should keep the core dependency-injected; mocking `query()` directly is simpler than testing the scheduler wrapper.
- Never mix Admin SDK and Client SDK Firestore calls in the same context.
- Callable error handling: use runtime client code (`not-found`), not internal enum names.
- Wrap `waitFor(() => expect(...))` assertion body in braces to avoid `no-confusing-void-expression`.
- Local dev should not hard-crash on missing Vite env vars; gate Firebase consumers and show inline messages.
- In React, auth-dependent setup must render inside `AuthProvider` or startup effects crash the app before router mounts.

## React

- Render-body ref assignment can trigger loops; sync refs in `useEffect`.
- `useRef(initial)` does not track later state; sync explicitly if current value needed.
- Critical external data should be fetched internally or required as a prop.
- `react-hooks/refs` flags `ref.current` reads during render; pass render-time values through state.
- CodeQL `js/xss-through-dom` on blob previews: render via `createImageBitmap` + `canvas` instead of blob URL in JSX.
- React Router v7 `useNavigate` returns `Promise<void>`; wrap with `void` or `await`.

## TypeScript

- `catch (err: unknown)` and narrow explicitly. Avoid `any`.
- With `exactOptionalPropertyTypes`, omit optional keys entirely instead of assigning `undefined`.
- `_`-prefixed catch variables may still trigger `no-unused-vars`. Prefer `catch { /* reason */ }` with a comment.

## Auth / Async

- In `onAuthStateChanged`, guard `.then`/`.catch` with an `active` flag + uid check to prevent stale promises overwriting state.
- `awaitFreshAuthToken` must start `getIdToken(true)` inside the Promise constructor so rejection can unsubscribe and reject.
- Null-check `awaitFreshAuthToken` before invoking `httpsCallable`; missing user = opaque failure.

## Phase 6 Responder App

- `@firebase/rules-unit-testing` must use the project emulator port (8081 per `firebase.json`). Hardcoded ports cause `ECONNREFUSED`.
- Admin `Timestamp` objects are rejected by the JS SDK Firestore used in `rules-unit-testing`. Write `.toMillis()` (number) instead.
- Firestore transactions strictly enforce reads-before-writes; violation throws even in emulator.
- Capacitor native plugins cannot be exercised in Playwright or Node.js unit tests; document skips explicitly.

## Refactoring / Monorepo

- When renaming files, remove stale build artifacts (`lib/*.js`, `.d.ts`, `.map`) manually.
- Shared packages consumed by apps need the app’s runtime deps (e.g., `firebase`, `react-router-dom`) as `peerDependencies`.
- Shared `AuthProvider` using `Record<string, unknown>` for claims pushes type-narrowing burden to consumers; validate with `typeof` checks.
- `useCallback` is required for functions exposed through context to prevent infinite re-render loops.
- Mock `onAuthStateChanged` must return an unsubscribe function; it’s a module-level function, not an `Auth` method.

## Testing Patterns

- `vi.mock` factory references must use `vi.hoisted(() => ({ mockFn: vi.fn() }))`, not plain `const`.
- Mock `getFirestore` in `firebase/firestore` mocks if the module calls it at module scope.
- Mock paths are relative to the test file, not the repo root.
- `firebase-admin` v12+ `.where` overload changes; use `vi.spyOn(collRef, 'where' as any)` to bypass TS overload resolution.
- `pnpm --filter` from a worktree resolves to the main repo’s `package.json`, not the worktree’s. Use `npx vitest` directly inside the package directory instead.
- `getDoc` finds seeded docs immediately; `getDocs` may fail with "Property X is undefined" due to emulator indexing. Use `getDoc` for rules validation when affected.

## CodeRabbit / Static Analysis

- Closure-mutated booleans (`let cancelled = false` reassigned in cleanup) trigger `no-unnecessary-condition` and CodeQL "Useless conditional". These are false positives; use `eslint-disable`.
- `react-hooks/set-state-in-effect` rejects synchronous `setState` in `useEffect`. Use `eslint-disable` for derived state that must be set synchronously.
- Zod `.trim().min(1)` already rejects whitespace-only strings; extra `.refine(v => v.trim().length > 0)` is redundant.
- Shared package schemas must be re-exported from `src/index.ts` or downstream packages get `TS2724`.
- Capacitor void-return callbacks need braces: `return () => { clearInterval(id) }`.
- When refactoring from `refCount` to `Set<subscribers>`, remove ALL stale `refCount` references.

## Phase 7 — Provincial Superadmin

- `@google-cloud/bigquery` `.table.query()` doesn't exist; use `bq.query()` directly for SQL queries.
- BigQuery query results are untyped; extract into typed helpers with `as unknown as RowType[]` to satisfy strict ESLint rules (`no-unsafe-member-access`, `no-unsafe-argument`).
- `@typescript-eslint/no-unnecessary-condition` flags `?.` on non-optional fields in function parameter types — use `.` when the type declares the field as required.
- Firestore path template literals (`db.doc(\`...\`)`) trigger `no-restricted-syntax`lint; use chained`.collection().doc()` instead.
- `@typescript-eslint/no-misused-promises` flags async onClick handlers; wrap with `() => void asyncFn()`.
- `bcryptjs` preferred over `bcrypt` in this repo — pure JS, no native compilation.
- `@google-cloud/logging` must be added as explicit dependency when using Cloud Logging API in triggers.

## Misc

- `navigator.clipboard` in happy-dom often needs to be defined as an own property before spying.
- Risky backend changes need emulator verification first; never prod-deploy in the same session.
