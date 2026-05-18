# Learnings — Durable Rules

## Citizen PWA / React Hooks

- `loadReports` must filter invalid entries individually (`raw.filter(isStoredReport)`) rather than discarding the whole array — the nuclear option silently wipes ALL stored reports when a single stale entry exists, causing empty map pins, zero profile stats, and no TrackingScreen data.
- TrackingScreen should seed from localForage when `report_lookup` hasn't been created yet (CF still processing). `useReport`'s live `onSnapshot` subscription upgrades to real Firestore data automatically once it materialises — no polling needed.
- `saveReport` should include `municipalityLabel` so "Areas Helped" in ProfileTab populates immediately without waiting for a Firestore subscription. The field is optional; `isStoredReport` ignores it for backward compatibility.
- Citizen incident-type aliases must be normalized at the draft boundary. UI-only values like `public_disturbance` are rejected by shared schemas and make reports appear "submitted" while disappearing from local active-report views.
- Citizen tracking pages cannot assume `reports/{id}` contains `id`, `timeline`, `location`, or `createdAt`. The live citizen-readable doc exposes `publicLocation` + `submittedAt`; synthesize the timeline view from those fields instead of treating it like an ops projection.
- Secret-code lookup should normalize to uppercase alphanumeric before hashing/comparing. Same-device lookup should check locally saved reports before surfacing a server `not-found` while backend lookup docs are still catching up.
- Synchronous `setState` in `useEffect` early-return branches triggers `react-hooks/set-state-in-effect`. Add `// eslint-disable-next-line` where needed — `eslint --fix` removes unused disable directives automatically.
- `vi.mock` at module top level does NOT cover newly routed components — add mocks for every new route's component in `App.routes.test.tsx` when replacing stub routes.
- Passing navigation callbacks as props (`onReportSimilar={() => void navigate(...)}`) avoids `useNavigate` being called in tests without Router context — cleaner than wrapping every test with a MemoryRouter.
- `subscribeAlerts` from `@bantayog/shared-firebase` takes a raw `Firestore` instance; the citizen-pwa's `db()` helper satisfies this directly.
- RevealSheet: spring-eased slide-up (`cubic-bezier(0.34, 1.56, 0.64, 1)`) + `max-height: 90svh` scroll guard are the minimum polish on any bottom-sheet component.
- `role="status"` implicitly carries `aria-live="polite"` + `aria-atomic="true"` per WAI-ARIA spec; adding explicit `aria-live` is redundant noise.
- Async state gates in React must always resolve — both `.then()` and `.catch()` paths must flip the gate flag, or the component freezes on rejection.
- `cache.addAll()` rejects the entire install if any URL fails; use `Promise.allSettled(cache.add(url).catch(...))` for resilient SW precaching.
- When two files share the same `sessionStorage` key + try/catch + default pattern, extract a shared helper before the pattern drifts.
- TTL tests must exercise the public API with `vi.useFakeTimers()` + `vi.setSystemTime()` — writing directly to mock stores bypasses the code under test.
- Citizen "my reports" views MUST subscribe to Firestore live (`onSnapshot` on `report_lookup/{publicRef}`). One-shot `requestLookup` callable polling never picks up admin-driven status flips, so the pill stays "queued" forever. Keep the callable as a fallback for permission-denied (UID mismatch after anonymous→phone link).
- Tracking timeline synthesis must read every per-step timestamp (`verifiedAt`, `assignedAt`, etc.) — synthesizing only `new` + current `status` produces a 1–2 row timeline that feels broken. Sort by timestamp, dedupe by event name.
- Subscription effects keyed on array reference re-run on every refresh even when contents are stable. Derive a stable string key (sorted publicRefs joined) and depend on that instead.

## Process

- Re-read files after edits/subagents/compaction. Disk is truth.
- Red test before behavior changes. Don't bundle unrelated fixes.
- Admin Desktop has two route surfaces. Provincial-superadmin login or legacy links landing on prototype URLs (`/dashboard`, `/map`, etc.) fall back into `mockData` pages even when live pages exist under `/province/*`. Fix route entrypoints before chasing individual mock widgets.
- Route gate every provincial-superadmin legacy URL: `/settings`, `/emergency`, `/ndrrmc`, `/audit`, `/handoff`, `/erasure`. If no live replacement exists, retire to a safe live landing page instead of exposing fake functionality.
- After squash merge, preserve branch ancestry if history matters.
- Firestore emulator seeded writes fail fast if rules don't compile; fix rules harness first.
- Workspace packages exported as TS source can break Functions emulator; give it a real JS entrypoint.
- Idempotency hashing in callable code must be async and Web Crypto-safe; `node:crypto` fallback fails under ESM/browser bundling.
- Verify functions region before chasing auth/App Check issues; region mismatch produces misleading unauthenticated errors.
- **Stale `functions/lib/` binary is the #1 cause of `FirebaseError: internal` in E2E.** Rebuild after source changes.
- `createTestEnv()` requires Firestore, Database, and Storage emulators all running.
- Strict Zod schemas: strip transitional fields before validation rather than widening the schema.
- Ops-facing schemas should use ops-specific enums, not broader public enums.
- Don't trust `tsc --outDir lib` to refresh declarations; verify emitted `.d.ts`.
- Use `z.uuid()` instead of `z.string().uuid()` (deprecated lint rule).
- Auth user creation + Firestore transaction is a two-phase commit with no native rollback. Always wrap in `try/catch` and call `adminAuth.deleteUser(uid)` as compensating action before re-throwing.
- `queueMicrotask()` around state resets in `useEffect` is a race-condition smell. Reset state synchronously inside the effect body with explicit `eslint-disable`.
- Programmatic focus in modals: `useRef` on container (not backdrop), `tabIndex={-1}`, call `.focus()` in `useEffect` keyed on open boolean. Pair with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- After TOTP/MFA enrollment, Firebase's ID token does NOT auto-refresh. Call `getIdToken(true)` immediately after `multiFactor().enroll()` so downstream listeners and custom claims are visible on the next route guard check.
- Route param names must be consistent across parent and child routes. Inconsistent names cause `useParams()` to return `undefined` in child components.
- `encodeURIComponent()` required when interpolating user-controlled strings into Google Storage direct-download URLs.
- Normalize phone numbers at the data-boundary (hook level), not at each consumer. Strip non-digit/non-plus chars, ensure leading `+`, validate with shared MSISDN validator.
- Upload URL requests should validate MIME type and file size _before_ computing content hash.
- `navigator.geolocation` may be undefined in some environments. Always guard before calling `.getCurrentPosition()`.
- Admin map triage controls must mirror backend report transitions: `new` can only advance to review, `awaiting_verify` can verify or reject, and dispatch controls belong to verified/active reports. Showing every action for every status creates guaranteed callable failures.
- Admin feed moderation can use `verifyReport.scrubbedDescription` for pre-publication scrubbing. Post-public takedown must go through backend `unpublishReport`; Firestore rules intentionally block clients from flipping `visibilityClass`.
- `report_inbox` reconciliation claims must not use `processedAt` until materialization succeeds or a permanent moderation incident exists. Use a non-terminal processing claim so transient Cloud Functions failures remain retryable.
- Adversarial review before merge catches bugs that CI misses. Run it yourself before asking for human review — it takes 10 minutes and saves hours of revert work.
- `useEffect` dependency arrays should contain primitives, not object references. `[dispatch?.status, report?.publicLocation?.latitude]` is safer than `[dispatch, report]`.
- Collection query rules differ from per-document rules; use `getDoc` if `getDocs` fails on `resource.data` checks.
- Seed documents via `env.withSecurityRulesDisabled()`, not unauthenticated context, when `create` is `false`.
- Rules transition tests must match the actual transition table in `firestore.rules`.

## Firestore

- All reads before first write in transactions.
- Fetch optional data up front; don't read later in the transaction.
- Prefer stable error codes over message matching.

## Security

- Fail explicitly on missing auth/scope; no permissive fallbacks.
- Normalize fields on both read and write paths.
- Verify Firestore Rules function signatures match call sites.
- Staff MFA audits must inspect `multiFactor.enrolledFactors` directly — `CustomClaims.mfaEnrolled` can record intent but only `enrolledFactors` reflects actual TOTP enrollment.

## Testing

- `vi.hoisted()` mocks must be created inside the hoisted callback.
- `requestAnimationFrame` in Vitest: capture callback explicitly, don't assume timers.
- A passing test is not enough; confirm it exercises the changed path.
- BigQuery summary jobs should keep core dependency-injected; mocking `query()` directly is simpler than testing the scheduler wrapper.
- Never mix Admin SDK and Client SDK Firestore calls in the same context.
- Callable error handling: use runtime client code (`not-found`), not internal enum names.
- Wrap `waitFor(() => expect(...))` assertion body in braces to avoid `no-confusing-void-expression`.
- Local dev should not hard-crash on missing Vite env vars; gate Firebase consumers and show inline messages.
- Auth-dependent setup must render inside `AuthProvider` or startup effects crash before router mounts.
- Emulator tests using `tx.update(docRef)` require the doc to exist; seed it or use `tx.set(docRef, data, { merge: true })`.
- `startAfter(docSnapshot)` pagination requires the snapshot to contain the `orderBy` field. Keep the `QueryDocumentSnapshot` from the query batch instead of re-fetching by ID after deletion.
- Testing TOCTOU race conditions in Firestore transactions: control `now()` so query-time and transaction-time predicates differ. A single mock returning different values per call simulates the race.
- `@firebase/rules-unit-testing` `initializeTestEnvironment` for storage must happen at module load time (top-level await) if tests use `it.skip`/`itif`. `beforeAll` runs AFTER test registration.
- When `beforeAll` can fail due to missing emulator, use top-level await with try/catch + boolean flag + `itif(flag)` for graceful skip.

## React

- Role-scoped client listeners must narrow `claims: Record<string, unknown>` via `typeof` checks. Gate scoped roles synchronously with `setError('unauthorized')` + early `return` BEFORE wiring any `onSnapshot` — never widen visibility by falling back to province data.
- `report_ops` stores scoping field as array `agencyIds`; `reports` uses singular `agencyId`. Always cross-check schema before writing `where` clauses.
- Per-listener retry-timer fan-out makes expected effect-run counts unreliable. Assert bounded property (retries terminate within a known ceiling), not exact count.
- Render-body ref assignment can trigger loops; sync refs in `useEffect`.
- `useRef(initial)` does not track later state; sync explicitly if current value needed.
- Critical external data should be fetched internally or required as a prop.
- Shared dashboards need explicit role-to-scope resolver. If scoped admin lacks claim-backed scope ID, return access-denied instead of widening visibility.
- Live Firestore join pages must wait for secondary doc fetch before asserting rendered rows.
- `ref.current` reads during render trigger `react-hooks/refs`; pass render-time values through state.
- CodeQL `js/xss-through-dom` on blob previews: render via `createImageBitmap` + `canvas` instead of blob URL in JSX.
- React Router v7 `useNavigate` returns `Promise<void>`; wrap with `void` or `await`.
- Normalize timestamp-like values with `toMillis()` and treat `lastStatusAt` as fallback, or the timeline silently drops steps.
- `position: sticky` resolves to nearest scrolling ancestor. `overflow-x: auto` coerces `overflow-y: visible` to `auto` — creating unexpected scroll context that breaks sticky thead. Drop inner `overflow-x-auto` or give wrapper max-height.

## TypeScript

- `catch (err: unknown)` and narrow explicitly. Avoid `any`.
- With `exactOptionalPropertyTypes`, omit optional keys entirely instead of assigning `undefined`.
- `_`-prefixed catch variables may still trigger `no-unused-vars`. Prefer `catch { /* reason */ }` with a comment.

## Auth / Async

- In `onAuthStateChanged`, guard `.then`/`.catch` with an `active` flag + uid check to prevent stale promises overwriting state.
- `awaitFreshAuthToken` must start `getIdToken(true)` inside the Promise constructor so rejection can unsubscribe and reject.
- Null-check `awaitFreshAuthToken` before invoking `httpsCallable`; missing user = opaque failure.
- `linkWithPhoneNumber` requires non-null `currentUser`. Either guard the route, sign in anonymously on mount, or use `signInWithPhoneNumber` and link later.
- Prefer `sessionStorage["bantayog.last-phone"]` over React Router navigation state for surviving phone numbers across adjacent auth flows — state is dropped on reload.
- `useState(() => sessionStorage.getItem(...))` lazy initializer is safer than `useEffect` + `setState` for storage seeds — no flash of default value, no lint warning.

## Phase 6 — Responder App

- `@firebase/rules-unit-testing` must use project emulator port (8081). Hardcoded ports cause `ECONNREFUSED`.
- Admin `Timestamp` objects rejected by JS SDK Firestore in rules-unit-testing. Write `.toMillis()` (number) instead.
- Firestore transactions strictly enforce reads-before-writes; violation throws even in emulator.
- Capacitor native plugins cannot be exercised in Playwright or Node.js unit tests; document skips explicitly.

## Refactoring / Monorepo

- When renaming files, remove stale build artifacts (`lib/*.js`, `.d.ts`, `.map`) manually.
- Shared packages consumed by apps need the app's runtime deps as `peerDependencies`.
- Shared `AuthProvider` using `Record<string, unknown>` for claims pushes type-narrowing burden to consumers.
- `useCallback` required for functions exposed through context to prevent infinite re-render loops.
- Mock `onAuthStateChanged` must return an unsubscribe function.

## Testing Patterns

- `vi.mock` factory references must use `vi.hoisted(() => ({ mockFn: vi.fn() }))`, not plain `const`.
- Mock `getFirestore` in `firebase/firestore` mocks if called at module scope.
- Mock paths are relative to the test file, not the repo root.
- `firebase-admin` v12+ `.where` overload changes; use `vi.spyOn(collRef, 'where' as any)` to bypass TS overload resolution.
- `pnpm --filter` from a worktree resolves to main repo's `package.json`, not worktree's. Use `npx vitest` directly inside the package instead.
- Use `getDoc` for rules validation when affected — `getDocs` may fail with "Property X is undefined" due to emulator indexing.

## CodeRabbit / Static Analysis

- Closure-mutated booleans trigger `no-unnecessary-condition` and CodeQL "Useless conditional" — false positives, use `eslint-disable`.
- `react-hooks/set-state-in-effect` rejects synchronous `setState` in `useEffect`. Use `eslint-disable` for derived state that must be set synchronously.
- Zod `.trim().min(1)` already rejects whitespace-only strings; extra `.refine(v => v.trim().length > 0)` is redundant.
- Shared package schemas must be re-exported from `src/index.ts` or downstream gets `TS2724`.
- Capacitor void-return callbacks need braces: `return () => { clearInterval(id) }`.
- When refactoring from `refCount` to `Set<subscribers>`, remove ALL stale references.

## Phase 7 — Provincial Superadmin

- `@google-cloud/bigquery` `.table.query()` doesn't exist; use `bq.query()` directly.
- BigQuery results are untyped; cast with `as unknown as RowType[]` to satisfy strict ESLint rules.
- Don't use `?.` on non-optional fields in function parameter types — `no-unnecessary-condition` flags it.
- Use chained `.collection().doc()` instead of template literals (`db.doc(\`...\`)`) to avoid `no-restricted-syntax`.
- Async `onClick` handlers flagged by `no-misused-promises`; wrap with `() => void asyncFn()`.
- `bcryptjs` preferred over `bcrypt` — pure JS, no native compilation.
- `@google-cloud/logging` must be explicit dependency when using Cloud Logging API in triggers.

## Phase 8C — RA 10173 Erasure

- Write Firestore doc before disabling Firebase Auth in erasure callables — if Auth disable fails, doc deletion is rollback, not Auth re-enable.
- `erasure_active/{uid}` sentinel pattern makes concurrent double-submission atomic via Firestore transaction. Status checks alone are not sufficient (TOCTOU).
- `erasureSweep` must be sequential (claim one, process, then claim next). Bulk-claiming lets timeouts strand records in `executing` state permanently.
- Auth hard-delete must be the last step — it is the only non-reversible step.
- `retentionSweep` must exclude active erasure citizens via in-memory UID set. Firestore doesn't support cross-collection NOT IN.
- `retentionHardDeleteEligibleAt` as a queryable field (set at anonymization + 30 days) avoids the "find deleted document" problem.
- `sms_inbox` join is via `senderMsisdnHash` field, not session ID foreign key. Verify field names before implementing SMS nulling.

## Misc

- `navigator.clipboard` in happy-dom often needs to be defined as own property before spying.
- `navigator.storage` is undefined in happy-dom; mock with `Object.defineProperty`.
- Use `.catch()` or braces to avoid `no-confusing-void-expression` on `void clearInterval(id)` / `void navigate(...)`.
- `no-unnecessary-condition` flags `navigator.storage?.estimate` — use runtime `.catch()` instead of optional chain for happy-dom safety.
- `react-hooks/set-state-in-effect` inside `catch` blocks — move to `.catch()` callback on the Promise instead.
- Risky backend changes need emulator verification first; never prod-deploy in same session.
- IndexedDB database names must match exactly between SW and app. localforage wraps IDB with internal schema, so raw IDB access from SW is fragile.
- Storage rules default-deny means new paths need explicit allow rules before SDK access works.
- `no-confusing-void-expression` rejects `renderHook(() => useHook())` when hook returns void — wrap in braces.
- Merge conflicts in long-unresolved worktrees must be resolved before new commits. `git add <file>` accepts resolution; `git commit` blocks until all `UU` files resolved.
- Template literal expressions with `number` types need explicit `String()` cast: `` `${String(n)}px` ``.
- Shell status pills with `role="status"` need explicit `aria-label` — visible text alone is not reliable for `getByRole('status', { name: ... })` assertions.

## Phase 4 — System Health Controls

- Dead-letter replay should iterate sequentially, not `Promise.all`, so partial failures don't lose tracking. Return `{ replayed: number }` for re-trigger.
- `streamAuditEvent` is fire-and-forget; the dead-letter write inside its catch must also be fire-and-forget (nested try/catch).
- Prewarm via HTTP GET to callable endpoints returns 405, but the CF instance still starts. Count any response as success; only network errors count as failure.
- `fetch` in Node 20 is global; no `node-fetch` needed. Use `AbortSignal.timeout(ms)` for request timeouts.
- Reuse existing `dead_letters` collection with `category` field rather than creating separate collections. The signal dead-letter replay pattern ports directly.

## PWA / Service Worker

- Background Sync API is Chromium-only; iOS Safari falls back to in-app retry machine. `register('sync')` is no-op on unsupported browsers.
- SW cannot use Firebase JS SDK; use Firestore REST API for SW background sync writes.
- Idempotency key on SW write ensures dedup if both SW and in-app machine succeed for same draft.
- Image compression: canvas `toBlob('image/jpeg', quality)` is the reliable cross-browser path.
- Cold offline boot needs precached app shell on `install`. Serve cached `/index.html` for any failed navigation request.
- When bumping SW cache version, `activate` cleanup must filter for the cache prefix (`bantayog_shell_*`) or old cache lingers.

## UX / A11y

- Conditional rendering of primary action buttons (`{state !== null && <Button/>}`) reads as "silent failure." Always render the action region with either a `role="status"` hint or the action button.
- For WCAG-AA contrast, prefer Tailwind theme tokens (`text-surface-600`) over arbitrary `text-[#hex]`. `surface-400`/`surface-300` (3.1:1/4.0:1) are decorative-only — never use for body text.
- Routes bypassing the shell need their own `<main id="main-content">` so the skip-link stays consistent.
- Severity colors MUST be consistent across ALL views. Centralize in one constant and import everywhere.
- `React.lazy()` components FAIL when offline. Eager import for states shown offline, or provide inline fallback UI.

## Wizard / Multi-step Forms

- "In-progress wizard state" and "finalized draft awaiting submission" are different concerns — keep in separate stores. A dedicated `wizard-snapshot` store (localforage, 24h TTL, `wizard-in-progress` key) is cleaner.
- Default required selectors to `''`, not a "first" value. Seeded defaults let bypass paths silently submit the wrong value. Combine with handleNext-level validation + inline `role="alert"` error.
- Do not persist `File`/`Blob` in IDB at per-keystroke cadence. Persist scalar form data only; let user re-attach photos on resume.
- Mid-form persistence requires accepting initial-value props on each step component. Without them, back-navigation or refresh loses the user's input.
- Snapshot save effect must be gated on `hasLoadedSnapshot`, or the initial empty `formData` clobbers the just-loaded snapshot. Two-effect pattern: load on mount, then enable saves.

## Responder PWA / Frontend Build

- Firebase multisite deploy needs both: `firebase.json` hosting entry with `target: "responder"` AND `.firebaserc` target mapping. Create site first with `firebase hosting:sites:create`.
- Broad shared package peer ranges can bundle duplicate singletons. Keep peer ranges aligned with app versions and verify source maps contain one copy of each singleton.
- Don't build staging from `.env.local` with `VITE_USE_EMULATOR=true`. Override with `VITE_USE_EMULATOR=false` and smoke-test for failed `localhost` requests.
- Guard production builds in `vite.config.ts`: fail closed when `VITE_USE_EMULATOR=true`. Catch the broken-artifact case before `firebase deploy`.
- PWA manifest icons must exist in `public/` before deploy. Verify deployed icon URL returns `200 image/png`.
- CSS Modules + `noUncheckedIndexedAccess` makes `styles.foo` return `string | undefined`. Coalesce at use-site (`styles.foo ?? ''`) or use conditional join pattern.
- `aria-current={isActive ? 'page' : undefined}` violates `exactOptionalPropertyTypes`. Use conditional spread `{...(isActive ? { 'aria-current': 'page' as const } : {})}`.
- React 19's `@types/react` deprecates `FormEvent`. Use `SyntheticEvent` or `SubmitEvent` instead.
- happy-dom returns `navigator.geolocation === null`. Keep the guard with `eslint-disable-next-line` — vitest crashes without it.
- Vitest `act(async () => { vi.advanceTimersByTime(...) })` triggers `require-await`. Use sync `act(() => { ... })`.
- React Router v7's `createBrowserRouter` ignores wrapping `MemoryRouter`. Test routes by mutating `window.history.pushState()` + `vi.resetModules()` + dynamic re-import.
- `vi.mock(...)` doesn't prevent Vite from resolving the real module path; file must exist on disk. Create stub first or mock before import.
- Per-test mock state leaks between `it()` blocks — add `mockClear()` in `beforeEach` when asserting "not toHaveBeenCalled."
- Use `String()` for number template expressions to satisfy `restrict-template-expressions`.
- Plan-driven trivial tests need `/// <reference types="node" />` when tsconfig lacks `@types/node`.
- `REPORT_TYPE_LABEL[row.reportId]` was wrong — `row.reportId` is the dispatch's report **id**, not type. For MVP, show generic label instead.
- `useDispatchHistory` queries with `where('status', 'in', [...])` — array capped at 30 by Firestore, but terminal status set is well under that.
- Removing functionality from one tab without immediately re-adding elsewhere breaks UX. Keep tasks in commit order so gap is at most one task long.
- When Firestore list queries depend on nested agency membership, use a callable to read scope server-side instead of fighting query-evaluation edge cases.
- Citizen-facing municipality contact docs are public metadata. Keep `municipalities/{municipalityId}` readable by unauthenticated users, writable only by server paths.

## Responder PWA — Post-Review Hardening (2026-05-06)

- Firestore client writes must match rule's field-name expectations. Always pair client hooks with rules tests using real emulator.
- `L.divIcon` is the offline-friendly Leaflet marker pattern — citizen-pwa's `IncidentLayer` is canonical reference.
- `watchPosition` without `document.visibilityState` handling drains battery. Pause on hidden, set timeout, consider lower accuracy when stationary.
- Map auto-recenter on every GPS tick is a UX trap — fly once on first lock, expose explicit "recenter" button.
- `auth.currentUser.displayName` is the de facto identity field. Firestore `responders/{uid}.displayName` is unpopulated; fall through both before defaulting to role label.
- Auto-redirect on single-active dispatch hides pending dispatches. Document trade-off; revisit after operational data available.
- Centralize incident labels in one `incident-labels.ts` to prevent label drift across MapPage, DispatchDetailPage, and ProfilePage.
- `useOwnDispatches.error` is `string | null`, not `Error`. Match hook's contract exactly in tests.
- Happy-dom default scroll metrics are not realistic. Tests asserting `scrollIntoView` must set explicit `scrollHeight`/`scrollTop`/`clientHeight`.

## Admin Desktop — Interface Design Remediation (2026-05-12)

- `userEvent.setup({ advanceTimers })` under `vi.useFakeTimers()` can deadlock on `click`/`selectOptions`. Use `fireEvent.click` / `fireEvent.change` under fake timers; reserve `userEvent` for real-timer flows.
- Truth-gate pattern for derived data: when a field cannot be derived from the live stream, make it optional in the type and omit from emission. Render `—` (em-dash) with neutral color. Never fabricate zeros — they mislead operators (verified where fabricated `activeResponders: 0` painted "No Shift" badges incorrectly).
- Sticky z-index layering: sticky bulk-action bar above sticky thead needs `z-20` vs `z-10` so it overlays headers when pinned.
- Window-sync dedup via `crypto.randomUUID()` + in-memory `Map` with TTL. Both BroadcastChannel and localStorage can deliver the same message twice. Auto-assign `id` in `sendSync`, record locally before posting, prune seen-set by `MESSAGE_TTL_MS`.

## Emulator Gotchas — Auth MFA (2026-05-18)

- **Firebase Auth Emulator UI auto-enables MFA when creating a user with a phone number.** If you add a phone number field during "Add Account" in the Auth emulator UI, the emulator silently enrolls the user in MFA with SMS. The `signInWithEmailAndPassword()` SDK call then returns `mfaPendingCredential` instead of an ID token.
- **Symptom:** `400 Bad Request` from `:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` with no visible MFA UI. The page login spinner hangs or silently reloads.
- **Fix:** Recreate the test user _without_ supplying a phone number in the emulator UI, or use `createUser()` via the Admin SDK with no `phoneNumber` field.
- **Alternative:** Use `signInWithPhoneNumber()` flow, but the LoginPage must implement it.

## Emulator Gotchas — Functions v2 Firestore Trigger Protobuf Decoding (2026-05-18)

- **`firebase-functions` v7.x + `firebase-tools` v15.x emulator crashes all `onDocumentCreated` triggers with protobuf decode errors.** This is an **upstream emulator bug**, NOT a code or dependency problem in our codebase.
- **Symptom:** Every `onDocumentCreated` trigger crashes with `Error: Failed to decode protobuf and create a snapshot. TypeError: Cannot read properties of undefined (reading 'cloud')`. The report stays in `report_inbox` forever; no `reports` doc is materialized.
- **Root cause:** The emulator's `functionsEmulatorRuntime.js` loads functions in a way that causes `protobufjs/minimal.js` ESM to create stale/wrong namespace objects, even when the dependency tree is clean (we confirmed `functions-dist` has only `protobufjs@7.5.8`, rebuilt from scratch, and zero conflicting `protobufjs` copies).
- **Evidence:** Console.log inside `compiledFirestore.mjs` shows `roots["default"]` is `{}` at top-level but `{ google: {...} }` when the trigger fires, proving the module cache returns a different object instance.
- **Production impact:** ZERO. This bug only affects the local Firebase emulator. Cloud Functions on GCP process `report_inbox` correctly.
- **Workaround for local E2E:** After the Citizen PWA writes to `report_inbox`, run the manual fallback script:
  ```bash
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 pnpm exec tsx functions/scripts/process-inbox-manual.ts
  ```
- **Also check:** If reports still aren't materialized after manual processing, verify the client payload matches `inboxPayloadSchema` exactly — `reporterName` and `reporterMsisdnHash` are NOT in `inboxPayloadSchema` and will cause a separate schema validation failure.
- **Fix for deployment (`functions-dist`):** Add `overrides: { protobufjs: '^7.2.2' }` to the generated `package.json` in `prepare-functions-deploy.ts`.
- **Fix for local emulator:** Create a separate emulator-only `firebase.emulator.json` pointing functions `"source": "functions"` (the unbundled pnpm-resolved tree) instead of `"source": "functions-dist"`, and use it when starting emulators. The `dev:all` script should use this config.
- **Also check:** If reports still aren't materialized after fixing protobuf, verify the client payload matches `inboxPayloadSchema` exactly — `reporterName` and `reporterMsisdnHash` are NOT in `inboxPayloadSchema` and will cause a separate schema validation failure.

## Empty Description Backend Validation (2026-05-18)

- Citizen PWA wizard fills `description` with `"Patients: N"` only when `patientCount > 0`; otherwise `""`. Backend `inboxPayloadSchema` has `description: z.string().min(1).max(5000)`. Empty string triggers `INVALID_ARGUMENT: payload schema invalid: Too small`.
- Fix: use a non-empty fallback (`"Report submitted via Bantayog Alert."`) when no patient count is provided.
- Root cause insight: the wizard has no text-area description field at all. The only way descriptions become non-empty is via patient count auto-generation.

## Missing Emulator Municipality Centroids (2026-05-18)

- `reverseGeocodeToMunicipality` in Functions skips municipalities with no `centroid` field, then throws `"out of jurisdiction"` if none match within max distance.
- When reports have no explicit `municipalityId` in the payload, the backend falls back to geocoding. If emulator `municipalities` collection is seeded without centroids, all proximate-location reports fail materialization.
- Fix: ensure `bootstrap-municipalities.ts` seeds `centroid: { lat, lng }` for every municipality.
- Production impact: **zero** — production data has centroids.
- E2E symptom: PWA submits successfully, manual fallback script returns `"out of jurisdiction"`.

## Emulator Environment Variables Override by `.env.local` (2026-05-18)

- Both citizen-pwa and admin-desktop had `VITE_USE_EMULATOR=true` in their `.env` files, but `.env.local` (which is created during local dev and is gitignored) overrode them with `VITE_USE_EMULATOR=false`.
- Neither app was actually talking to the emulator. Citizen-PWA wrote reports to staging Firestore; admin-desktop (also pointed at staging) may or may not have shown them depending on deployed function latency.
- Fix: update `.env.local` to `VITE_USE_EMULATOR=true` in both apps. Dev servers must be restarted to pick up the change.
- **Lesson:** whenever emulators are empty but PWA claims success, verify env var propagation — `import.meta.env.VITE_USE_EMULATOR` on the client — rather than assuming the app is talking to localhost.

## TypeScript Strictness — Firestore Auth Token Casting (2026-05-17)

- `req.auth.token` from Firebase callable functions is typed broadly. When extracting typed claims (e.g., `municipalityId`) that are later used as `string` in downstream interfaces, a type assertion (`as string`) is REQUIRED at the boundary where the value enters a typed interface.
- The same field (`claims.municipalityId`) works without assertion in other callables because those callables use `VerifyReportActor` (which has `municipalityId?: string`) vs `UnpublishReportCoreDeps.actor.claims` (which expects `role?: string; municipalityId?: string`). But the callable site passes the claims object directly into the core function, and the type checker cannot infer the `unknown` → `string` coercion across the boundary.
- Symptom: `Type 'unknown' is not assignable to type 'string'` at the call site in `unpublish-report.ts:201`. Fix: add explicit `as string` cast, consistent with all other callable entry points that pass `municipalityId` into core functions.
