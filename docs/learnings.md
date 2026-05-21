# Learnings — Durable Rules

## Citizen PWA / React Hooks

- `loadReports` must filter invalid entries individually (`raw.filter(isStoredReport)`); discarding the whole array wipes all stored reports on one stale entry.
- TrackingScreen seeds from localForage when `report_lookup` hasn't materialised yet; `useReport`'s `onSnapshot` upgrades to Firestore data automatically.
- `saveReport` should include `municipalityLabel` so "Areas Helped" populates immediately.
- Normalise incident-type aliases at the draft boundary (e.g. `public_disturbance` → `security`).
- Citizen tracking docs expose `publicLocation` + `submittedAt`; synthesise timeline from per-step timestamps (`verifiedAt`, `assignedAt`, etc.).
- Secret-code lookup: normalise to uppercase alphanumeric before hashing; check local storage before surfacing server `not-found`.
- `vi.mock` at module top level does NOT cover newly routed components — add mocks for every new route in `App.routes.test.tsx`.
- Pass navigation callbacks as props instead of calling `useNavigate` in tests without Router context.
- RevealSheet polish: spring-eased slide-up (`cubic-bezier(0.34, 1.56, 0.64, 1)`) + `max-height: 90svh` scroll guard.
- `role="status"` implicitly carries `aria-live="polite"` + `aria-atomic="true"`; explicit `aria-live` is redundant.
- Async state gates must always resolve — both `.then()` and `.catch()` must flip the gate flag.
- SW precaching: `cache.addAll()` rejects on any URL failure; use `Promise.allSettled(cache.add(url).catch(...))`.
- Extract shared `sessionStorage` helpers before the same pattern drifts across files.
- TTL tests must exercise the public API with `vi.useFakeTimers()` + `vi.setSystemTime()`; writing directly to mock stores bypasses the code under test.
- Citizen "my reports" MUST subscribe live (`onSnapshot` on `report_lookup/{publicRef}`); keep `requestLookup` callable as fallback for permission-denied.
- Subscription effects keyed on array references re-run on every refresh. Derive a stable string key (sorted `publicRefs` joined) and depend on that.

## Process

- Re-read files after edits/subagents/compaction. Disk is truth.
- Red test before behaviour changes. Don't bundle unrelated fixes.
- Admin Desktop has two route surfaces: provincial-superadmin legacy URLs (`/dashboard`, `/map`, etc.) can fall back to `mockData` pages. Gate every legacy URL.
- Firestore emulator seeded writes fail fast if rules don't compile; fix rules harness first.
- Workspace packages exported as TS source can break Functions emulator; give it a real JS entrypoint.
- Idempotency hashing in callable code must be async and Web Crypto-safe; `node:crypto` fails under ESM/browser bundling.
- Verify functions region (`asia-southeast1`) before chasing auth/App Check issues.
- **Stale `functions/lib/` is the #1 cause of `FirebaseError: internal` in E2E.** Rebuild after source changes.
- **Stale `functions-dist/` causes CORS errors in emulator.** Run `pnpm exec tsx scripts/prepare-functions-deploy.ts` before `pnpm dev:all`.
- `createTestEnv()` requires Firestore, Database, and Storage emulators all running.
- Strict Zod schemas: strip transitional fields before validation rather than widening the schema.
- Auth user creation + Firestore transaction is a two-phase commit with no native rollback. Wrap in `try/catch` and call `adminAuth.deleteUser(uid)` as compensating action before re-throwing.
- `queueMicrotask()` around state resets in `useEffect` is a race-condition smell. Reset synchronously inside the effect body.
- Modal focus pattern: `useRef` on container (not backdrop), `tabIndex={-1}`, `.focus()` in `useEffect` keyed on open boolean. Pair with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- After TOTP/MFA enrollment, Firebase's ID token does NOT auto-refresh. Call `getIdToken(true)` immediately.
- **Admin-desktop emulator mode must call `initializeAppCheck()` with a `CustomProvider`.** Setting `FIREBASE_APPCHECK_DEBUG_TOKEN` alone is insufficient.
- Route param names must be consistent across parent and child routes.
- `encodeURIComponent()` required when interpolating user-controlled strings into Storage direct-download URLs.
- Normalise phone numbers at the data-boundary (hook level), not at each consumer.
- Upload URL requests should validate MIME type and file size _before_ computing content hash.
- `navigator.geolocation` may be undefined; always guard before calling `.getCurrentPosition()`.
- Admin map triage controls must mirror backend report transitions (`new` → review, `awaiting_verify` → verify/reject); showing every action for every status creates guaranteed callable failures.
- Admin feed moderation: use `verifyReport.scrubbedDescription` for pre-publication; post-public takedown goes through backend `unpublishReport`.
- `report_inbox` reconciliation claims must not use `processedAt` until materialisation succeeds; keep transient failures retryable.
- Adversarial review before merge catches bugs that CI misses. Run it yourself before asking for human review.
- `useEffect` dependency arrays should contain primitives, not object references.
- Collection query rules differ from per-document rules; use `getDoc` if `getDocs` fails on `resource.data` checks.
- Seed documents via `env.withSecurityRulesDisabled()`, not unauthenticated context, when `create` is `false`.
- Rules transition tests must match the actual transition table in `firestore.rules`.
- Cross-app proof harnesses need a staging preflight (env vars, Auth users, account docs, role scope, no emulator leakage).
- Cleanup for proof runs must discover related IDs from durable anchors and attempt every delete with `Promise.allSettled`.
- Callable parity must be checked from both directions with an AST check.

## Firestore

- All reads before first write in transactions.
- Fetch optional data up front; don't read later in the transaction.
- Prefer stable error codes over message matching.

## Security

- Fail explicitly on missing auth/scope; no permissive fallbacks.
- Normalise fields on both read and write paths.
- Verify Firestore Rules function signatures match call sites.
- Staff MFA audits must inspect `multiFactor.enrolledFactors` directly — `CustomClaims.mfaEnrolled` records intent, but only `enrolledFactors` reflects actual TOTP enrollment.

## Testing

- `vi.hoisted()` mocks must be created inside the hoisted callback.
- `requestAnimationFrame` in Vitest: capture callback explicitly.
- A passing test is not enough; confirm it exercises the changed path.
- Never mix Admin SDK and Client SDK Firestore calls in the same context.
- Callable error handling: use runtime client code (`not-found`), not internal enum names.
- Wrap `waitFor(() => expect(...))` assertion body in braces.
- Auth-dependent setup must render inside `AuthProvider`.
- Emulator tests using `tx.update(docRef)` require the doc to exist; seed it or use `tx.set(docRef, data, { merge: true })`.
- `startAfter(docSnapshot)` pagination requires the snapshot to contain the `orderBy` field. Keep the `QueryDocumentSnapshot` from the query batch.
- Testing TOCTOU race conditions: control `now()` so query-time and transaction-time predicates differ.
- `@firebase/rules-unit-testing` `initializeTestEnvironment` for storage must happen at module load time (top-level await) if tests use `it.skip`/`itif`; `beforeAll` runs AFTER test registration.
- When `beforeAll` can fail due to missing emulator, use top-level await with try/catch + boolean flag + `itif(flag)`.
- `userEvent.setup({ advanceTimers })` under `vi.useFakeTimers()` can deadlock on `click`/`selectOptions`. Use `fireEvent.click` / `fireEvent.change` under fake timers; reserve `userEvent` for real-timer flows.
- Test mocks must provide non-empty data when testing a dashboard with empty-state short-circuit.
- `noop` pattern for empty callback props: `const noop = (): void => { return }` instead of inline `() => {}`.
- Nullish coalescing (`??`) is safer than `||` for combining `error` values from hooks.
- `Date.now()` in test mocks is fine — mocks are not subject to `react-hooks/purity`.
- `itif(available)` when `available` is assigned in `beforeAll` makes the suite permanently skipped. Gate on static env.
- Local proof must not call external sinks (FCM, BigQuery).

## React

- Role-scoped client listeners must narrow `claims: Record<string, unknown>` via `typeof` checks. Gate scoped roles synchronously with `setError('unauthorized')` + early `return` BEFORE wiring `onSnapshot`.
- `report_ops` stores scoping field as array `agencyIds`; `reports` uses singular `agencyId`. Always cross-check schema before writing `where` clauses.
- Per-listener retry-timer fan-out makes expected effect-run counts unreliable. Assert bounded property (retries terminate within a known ceiling), not exact count.
- Render-body ref assignment can trigger loops; sync refs in `useEffect`.
- `useRef(initial)` does not track later state; sync explicitly if current value needed.
- Critical external data should be fetched internally or required as a prop.
- Shared dashboards need explicit role-to-scope resolver. If scoped admin lacks claim-backed scope ID, return access-denied.
- Live Firestore join pages must wait for secondary doc fetch before asserting rendered rows.
- `ref.current` reads during render trigger `react-hooks/refs`; pass render-time values through state.
- CodeQL `js/xss-through-dom` on blob previews: render via `createImageBitmap` + `canvas` instead of blob URL in JSX.
- React Router v7 `useNavigate` returns `Promise<void>`; wrap with `void` or `await`.
- `position: sticky` resolves to nearest scrolling ancestor. `overflow-x: auto` coerces `overflow-y: visible` to `auto`, breaking sticky thead.
- `React.lazy()` components FAIL when offline. Eager import for states shown offline, or provide inline fallback UI.

## TypeScript

- `catch (err: unknown)` and narrow explicitly. Avoid `any`.
- With `exactOptionalPropertyTypes`, omit optional keys entirely instead of assigning `undefined`.
- `_`-prefixed catch variables may still trigger `no-unused-vars`. Prefer `catch { /* reason */ }` with a comment.
- `restrict-template-expressions`: cannot interpolate `number` into template literals. Use `String(count)`.
- `prefer-optional-chain`: if `a && a.b` is intentional, extract the optional value first.
- `candidates[0]` after `.length === 0` check still reports TS18048. Use a local const with explicit non-null check.
- Type assertions (`as string`) are REQUIRED at callable boundaries where `req.auth.token` values enter typed interfaces.
- `dispatchStatusSchema` union changes require downstream rebuilds to pick up new literal types.

## Auth / Async

- In `onAuthStateChanged`, guard `.then`/`.catch` with an `active` flag + uid check.
- `awaitFreshAuthToken` must start `getIdToken(true)` inside the Promise constructor.
- Null-check `awaitFreshAuthToken` before invoking `httpsCallable`.
- `linkWithPhoneNumber` requires non-null `currentUser`.
- Prefer `sessionStorage["bantayog.last-phone"]` over React Router navigation state.
- `useState(() => sessionStorage.getItem(...))` lazy initializer is safer than `useEffect` + `setState`.

## Emulator Gotchas

- **Firebase Auth Emulator UI auto-enables MFA when creating a user with a phone number.** Recreate test users without a phone number in the emulator UI, or use Admin SDK `createUser()` with no `phoneNumber`.
- **`firebase-functions` v7.x + `firebase-tools` v15.x emulator crashes `onDocumentCreated` triggers with protobuf decode errors.** Confirmed upstream bug; production impact is zero. Workaround: run `functions/scripts/process-inbox-manual.ts` after Citizen PWA submissions.
- `Admin SDK Timestamp` objects are rejected by JS SDK Firestore in rules-unit-testing. Write `.toMillis()` (number) instead.
- `@firebase/rules-unit-testing` must use project emulator port (8081). Hardcoded ports cause `ECONNREFUSED`.
- `navigator.geolocation === null` in happy-dom; keep the guard with `eslint-disable-nextline`.
- `navigator.clipboard` in happy-dom needs to be defined as own property before spying.
- `navigator.storage` is undefined in happy-dom; mock with `Object.defineProperty`.

## Refactoring / Monorepo

- When renaming files, remove stale build artifacts (`lib/*.js`, `.d.ts`, `.map`) manually.
- Shared packages consumed by apps need the app's runtime deps as `peerDependencies`.
- `useCallback` required for functions exposed through context.
- Mock `onAuthStateChanged` must return an unsubscribe function.
- `pnpm --filter` from a worktree resolves to main repo's `package.json`. Use `npx vitest` directly inside the package instead.
- Domain over layer: organise `functions/src/` by business domain, not technical layer.
- Incremental migration is the only sane path. Move 5 files → verify → move 12 → verify.
- `git mv` preserves history. Update `index.ts` incrementally. Cross-domain imports use relative paths.
- Don't mix package extraction with directory reorg. Finish one, let it bake, then the other.

## CodeRabbit / Static Analysis

- Closure-mutated booleans trigger `no-unnecessary-condition` false positives; use `eslint-disable`.
- `react-hooks/set-state-in-effect` rejects synchronous `setState` in `useEffect`. Use `eslint-disable` for derived state that must be set synchronously.
- Zod `.trim().min(1)` already rejects whitespace-only strings.
- Shared package schemas must be re-exported from `src/index.ts` or downstream gets `TS2724`.
- Capacitor void-return callbacks need braces: `return () => { clearInterval(id) }`.
- When refactoring from `refCount` to `Set<subscribers>`, remove ALL stale references.
- `vi.mock()` at module top level with template literals triggers `esbuild` parse error when nested inside `vi.hoisted()`. Move `vi.mock` outside, or use `vi.doMock()`.

## Dispatch / Monitor

- Firestore `in` array queries are capped at 10 values. Chunk municipality IDs into groups of ≤10.
- Lease pattern (`monitorLeaseAt` + 120s expiry) prevents overlapping cron runs.
- Circuit breaker: if query returns more records than threshold, skip processing and log warning.
- Single-dispatch-doc escalation: mutate `assignedTo` on same doc, increment `escalationCount`, push old UID to `previouslyNotifiedResponderUids`.
- Dispatch docs must satisfy both responder schema and Firestore rules (`dispatchedByRole`, `statusUpdatedAt`, `idempotencyKey`, `idempotencyPayloadHash`, `municipalityId`).
- Responder accept supports two active-claim eras (`accountStatus: 'active'` vs `active: true`). Use `isAccountActive()` for callable guards.
- Callable optional fields must be omitted, not sent as `undefined`/`null`.

## Erasure (RA 10173)

- Write Firestore doc before disabling Firebase Auth in erasure callables.
- `erasure_active/{uid}` sentinel pattern makes concurrent double-submission atomic via Firestore transaction.
- `erasureSweep` must be sequential (claim one, process, claim next).
- Auth hard-delete must be the last step — it is the only non-reversible step.
- `retentionSweep` must exclude active erasure citizens via in-memory UID set.
- `retentionHardDeleteEligibleAt` as a queryable field avoids the "find deleted document" problem.
- `sms_inbox` join is via `senderMsisdnHash` field, not session ID foreign key.

## PWA / Service Worker

- Background Sync API is Chromium-only; iOS Safari falls back to in-app retry machine.
- SW cannot use Firebase JS SDK; use Firestore REST API for SW background sync writes.
- Idempotency key on SW write ensures dedup if both SW and in-app machine succeed.
- Image compression: canvas `toBlob('image/jpeg', quality)` is the reliable cross-browser path.
- Cold offline boot needs precached app shell on `install`. Serve cached `/index.html` for any failed navigation request.
- When bumping SW cache version, `activate` cleanup must filter for the cache prefix or old cache lingers.

## UX / A11y

- Conditional rendering of primary action buttons reads as "silent failure." Always render the action region with either `role="status"` or the action button.
- For WCAG-AA contrast, prefer Tailwind theme tokens over arbitrary `text-[#hex]`.
- Routes bypassing the shell need their own `<main id="main-content">`.
- Severity colors MUST be consistent across ALL views. Centralize in one constant.
- Ops map pins: Admin Desktop and Responder App use offline-safe `L.divIcon` circular incident pins; Citizen PWA keeps its distinct dot/ring language.
- Truth-gate pattern for derived data: when a field cannot be derived from the live stream, make it optional and omit from emission. Render `—` with neutral color. Never fabricate zeros.
- Sticky z-index layering: sticky bulk-action bar (`z-20`) above sticky thead (`z-10`).
- Window-sync dedup via `crypto.randomUUID()` + in-memory `Map` with TTL.

## Wizard / Multi-step Forms

- "In-progress wizard state" and "finalized draft awaiting submission" are different concerns — keep in separate stores.
- Default required selectors to `''`, not a "first" value.
- Do not persist `File`/`Blob` in IDB at per-keystroke cadence.
- Mid-form persistence requires accepting initial-value props on each step component.
- Snapshot save effect must be gated on `hasLoadedSnapshot`, or initial empty `formData` clobbers the just-loaded snapshot.

## Responder PWA / Build

- Firebase multisite deploy needs both `firebase.json` hosting entry with `target` AND `.firebaserc` target mapping.
- Don't build staging from `.env.local` with `VITE_USE_EMULATOR=true`. Guard production builds in `vite.config.ts`: fail closed.
- PWA manifest icons must exist in `public/` before deploy.
- CSS Modules + `noUncheckedIndexedAccess` makes `styles.foo` return `string | undefined`. Coalesce at use-site.
- `aria-current` conditional spread: `{...(isActive ? { 'aria-current': 'page' as const } : {})}`.
- React 19's `@types/react` deprecates `FormEvent`. Use `SyntheticEvent` or `SubmitEvent`.
- Vitest sync `act`: `act(() => { vi.advanceTimersByTime(...) })`.
- RRv7 `createBrowserRouter` ignores wrapping `MemoryRouter`. Test routes by mutating `window.history.pushState()` + `vi.resetModules()` + dynamic re-import.
- `vi.mock(...)` doesn't prevent Vite from resolving the real module path; file must exist on disk.
- Per-test mock state leaks between `it()` blocks — add `mockClear()` in `beforeEach`.
- Use `String()` for number template expressions.
- Centralize incident labels in one `incident-labels.ts`.
- `auth.currentUser.displayName` is the de facto identity field. Firestore `responders/{uid}.displayName` is unpopulated; fall through both before defaulting.
- Map auto-recenter on every GPS tick is a UX trap — fly once on first lock, expose explicit "recenter" button.
- `watchPosition` without `document.visibilityState` handling drains battery.

## System Health Controls

- Dead-letter replay should iterate sequentially, not `Promise.all`.
- `streamAuditEvent` is fire-and-forget; the dead-letter write inside its catch must also be fire-and-forget.
- Prewarm via HTTP GET to callable endpoints returns 405, but the CF instance still starts. Count any response as success.
- Node 20 `fetch` is global; no `node-fetch` needed. Use `AbortSignal.timeout(ms)`.
- Reuse existing `dead_letters` collection with `category` field.

## BigQuery / Cloud Logging

- `@google-cloud/bigquery` `.table.query()` doesn't exist; use `bq.query()` directly.
- BigQuery results are untyped; cast with `as unknown as RowType[]`.
- `@google-cloud/logging` must be explicit dependency when using Cloud Logging API in triggers.
