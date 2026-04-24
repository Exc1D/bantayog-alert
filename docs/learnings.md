# Learnings

Durable rules worth keeping across sessions.

## Process

- Re-read files after edits, subagent work, or context compaction. The file on disk is the source of truth.
- For behavior changes, get a real red test before implementation.
- Don’t bundle unrelated fixes in the same branch or conversation.
- After a squash merge, preserve or recreate a remote branch/ref before deleting it if the original commit history still matters; the content may be in `main` while the branch ancestry is gone.
- Firestore emulator seeded writes will fail fast if the current rules file cannot compile; Playwright fixtures that depend on Firestore writes need the rules harness fixed first, not just a better seed helper.
- A workspace package exported as TypeScript source can still break Firebase Functions emulator analysis even if Vitest can import it; give the emulator a real JS entrypoint.
- Idempotency hashing that runs in callable code must be async and Web Crypto-safe; a `require('node:crypto')` fallback can fail under ESM/browser bundling even when the code works in unit tests.
- When a callable looks like an auth or App Check problem, verify the initialized functions region before chasing browser state; a region mismatch can produce misleading unauthenticated failures.
- **Stale compiled functions binary is the first thing to check when `FirebaseError: internal` appears in E2E but unit tests pass.** The emulator runs `functions/lib/`, not `functions/src/`. If source was changed (e.g. `enforceAppCheck`) but `pnpm --filter @bantayog/functions build` was not re-run, the emulator silently enforces the old setting. Fix: rebuild before running `firebase emulators:exec`.
- `createTestEnv()` in this repo expects Firestore, Database, and Storage emulators. If you only boot Firestore, rules tests that initialize the shared harness fail before they reach assertions.
- When a payload schema is `strict()` and a field is truly transitional, strip that field before validation instead of widening the schema and accidentally allowing unrelated junk.
- If a transitional field is part of the contract, model it explicitly in the schema instead of stripping it in the trigger. Stripping is only the fallback when the field is truly out-of-band.
- Ops-facing document schemas should use ops-specific enums, not the broader public report enum, or the rules/tests will drift silently.
- `z.string().uuid()` trips `@typescript-eslint/no-deprecated` under the current lint config. Use `z.uuid()` in shared validators.
- Collection query tests can fail on a rule that is really written for per-document access. If the rule uses `resource.data` in a way that doesn’t support `list`, switch the test to `getDoc` or rewrite the rule intentionally.

## Firestore

- In admin transactions, all reads must happen before the first write.
- When optional data controls writes, fetch it up front instead of reading later in the transaction.
- Prefer stable Firestore error codes over matching error messages.

## Security

- If missing auth or scope should deny access, fail explicitly; don’t use permissive fallbacks.
- When normalizing fields, update both read and write paths.
- In Firestore Rules, verify function signatures match call sites; unused parameters are a smell.

## Testing

- `vi.hoisted()` mocks must be created inside the hoisted callback.
- `requestAnimationFrame` in Vitest is safer with an explicit captured callback than with timer assumptions.
- Firebase integration tests often need module-level mocks for Firestore/Auth setup.
- A passing test is not enough; confirm it actually exercises the changed path.
- Firebase Admin SDK (`firebase-admin/firestore`) and Client SDK (`firebase/firestore`) are type-incompatible — never mix `setDoc(doc(adminDb, ...), data)` patterns. Use Admin SDK exclusively for admin contexts, or Client SDK exclusively for test contexts.
- Callable error handling should use the runtime client code (`not-found`) rather than the internal enum name; normalize the error code the client actually receives.
- `waitFor(() => expect(...))` triggers `no-confusing-void-expression`; wrap the assertion body in braces.
- Local dev should not hard-crash on missing Vite env vars if the screen can degrade gracefully; gate Firebase consumers and surface a clear inline message instead.
- Functions emulator source analysis still follows workspace package entrypoints; exporting TypeScript sources from a package without a runtime JS build can break emulator startup before any test runs.
- In a React shell, auth-dependent setup must render inside the `AuthProvider`; otherwise startup effects can crash the entire app before the router mounts.

## React

- Render-body ref assignment can trigger loops; move ref syncing into `useEffect` when needed.
- `useRef(initial)` does not track later state changes; sync refs explicitly if they must stay current.
- Critical external data should be fetched internally or required as a prop, not left optional.
- `react-hooks/refs` will flag `ref.current` reads during render; pass render-time values through state instead of reading mutable refs in JSX.
- If CodeQL flags a React blob-preview path as `js/xss-through-dom`, annotation-only suppressions are brittle; render the file into a `canvas` via `createImageBitmap` instead of piping a blob URL string into JSX.

## TypeScript

- Use `catch (err: unknown)` and narrow explicitly.
- Avoid `any`; prefer real types or `unknown`.
- With `exactOptionalPropertyTypes`, omit optional keys entirely instead of assigning `undefined`.
- **`catch (_err: unknown) { void _err }` does not satisfy `@typescript-eslint/no-unused-vars` in all configs.** If the linter rejects `_`-prefixed catch variables, prefer `catch { /* reason */ }` with an explicit comment over a disabled lint rule. Only capture the error when you actually log or transform it.

## Auth / Async

- In Firebase Auth `onAuthStateChanged`, the promise started by `getIdTokenResult(true)` can resolve after a later auth change. Guard all `.then`/`.catch`/`.finally` handlers with an `active` flag (closed over from `useEffect`) and a `uid` check (`auth.currentUser?.uid !== capturedUid`) before calling `setClaims`/`setLoading`.
- `awaitFreshAuthToken` built on `onIdTokenChanged` must start `getIdToken(true)` **inside** the Promise constructor (not after it) so a rejection can call `unsubscribe()` and `reject()` rather than leaving the promise hanging forever.
- Always check the `null` return of `awaitFreshAuthToken` before invoking an `httpsCallable`; a missing `currentUser` means no auth header and the callable will fail with an opaque error.

## Misc

- `navigator.clipboard` in happy-dom often needs to be defined as an own property before spying.
- Risky backend changes need emulator verification first and should not go to prod in the same session.

## Refactoring / Monorepo Hygiene

- When extracting a module and renaming the original file (e.g., `inbound.ts` → `parser.ts`), stale build artifacts (`lib/inbound.js`, `.d.ts`, `.map`) must be manually removed or they will confuse future readers and tooling.
- Consolidating duplicated React components across apps into a shared package requires adding the consuming app's runtime dependencies (e.g., `firebase`, `react-router-dom`) as `peerDependencies` in the shared package; otherwise typecheck passes locally but breaks in isolation.
- A shared `AuthProvider` that uses `Record<string, unknown>` for claims pushes type-narrowing burden to every consumer. This is acceptable for a shared boundary, but consumers should validate with `typeof` checks rather than casting.
- `useCallback` is required for functions exposed through context (like `refreshClaims` and `signOut`) to prevent infinite re-render loops in consumers that include them in `useEffect` dependency arrays.
- When mocking Firebase Auth's `onAuthStateChanged` with `vi.mock('firebase/auth', ...)`, the mock must return an unsubscribe function; the real `onAuthStateChanged` is a module-level function, not a method on the `Auth` instance.
