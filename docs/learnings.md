# Learnings — Durable Rules

## Citizen PWA / React Hooks

- `loadReports` must filter invalid entries individually (`raw.filter(isStoredReport)`) rather than discarding the whole array if any entry fails validation. The nuclear option (`!raw.every(isStoredReport) → return []`) silently wipes ALL stored reports when a single stale entry from an old schema exists — causing empty map pins, zero profile stats, and no TrackingScreen data. Fix: filter + warn, never discard all.
- TrackingScreen should seed from localForage when `report_lookup` hasn't been created yet (CF still processing). The `useReport` hook's live `onSnapshot` subscription upgrades to real Firestore data automatically once it materialises — no polling needed. The `isPending` spinner covers the ~1-5ms localForage read, so there's no visible flash.
- `saveReport` should include `municipalityLabel` so "Areas Helped" in ProfileTab can populate immediately without waiting for a Firestore subscription. The field is optional in `StoredReport`; `isStoredReport` ignores it so backwards-compatible.
- Citizen PWA incident-type aliases must be normalized at the draft boundary. UI-only values like `public_disturbance` are rejected by shared report schemas and can make a report look "submitted" while disappearing from local active-report views.
- Citizen tracking pages cannot assume `reports/{id}` contains `id`, `timeline`, `location`, or `createdAt`. The live citizen-readable doc currently exposes `publicLocation` + `submittedAt`; synthesize the citizen timeline view from those fields instead of treating it like an ops projection.
- Secret-code lookup should normalize to uppercase alphanumeric before hashing/comparing, and same-device lookup should check locally saved reports before surfacing a server `not-found` while backend lookup docs are still catching up.
- `react-hooks/set-state-in-effect` fires on synchronous `setState` inside `useEffect` early-return branches. Add `// eslint-disable-next-line react-hooks/set-state-in-effect` only where needed — `eslint --fix` (run by lint-staged) will remove unused disable directives automatically after running.
- `vi.mock` at module top level does NOT cover newly routed components — add mocks for every new route's component in `App.routes.test.tsx` when replacing stub routes.
- Passing navigation callbacks as props (e.g., `onReportSimilar={() => void navigate(...)}`) avoids `useNavigate` being called in components tested without a Router context — the pattern is cleaner than wrapping every test with a MemoryRouter.
- `subscribeAlerts` from `@bantayog/shared-firebase` takes a raw `Firestore` instance; the citizen-pwa's `db()` helper satisfies this directly.
- RevealSheet: spring-eased slide-up (`cubic-bezier(0.34, 1.56, 0.64, 1)`) + `max-height: 90svh` scroll guard are the minimum polish required on any bottom-sheet component.
- `role="status"` implicitly carries `aria-live="polite"` + `aria-atomic="true"` per WAI-ARIA spec; adding explicit `aria-live` is redundant noise.
- Async state gates in React (e.g. `hasLoadedSnapshot`) must always resolve — both `.then()` and `.catch()` paths must flip the gate flag, or the component freezes on rejection.
- `cache.addAll()` rejects the entire install if any URL fails; use `Promise.allSettled(cache.add(url).catch(...))` for resilient SW precaching.
- When two files share the same `sessionStorage` key + try/catch + default pattern, extract a shared helper before the pattern drifts.
- TTL tests that write directly to mock stores bypass the code under test. Use `vi.useFakeTimers()` + the public `save()` API + `vi.setSystemTime()` to actually exercise the TTL branch.
- Citizen "my reports" view (map MyReportLayer, Profile list, ReportStatusPill) MUST subscribe to Firestore live (`onSnapshot` on `report_lookup/{publicRef}` → `reports/{reportId}`). One-shot `requestLookup` callable polling looks fine on submission but never picks up admin-driven status flips, so the pill stays "queued" forever and the map pin never adopts the verified pulse. Keep the callable as a fallback for permission-denied (UID mismatch after anonymous→phone link).
- Tracking timeline synthesis must read every per-step timestamp written by callables (`verifiedAt`, `assignedAt`, `acknowledgedAt`, `enRouteAt`, `onSceneAt`, `resolvedAt`, `closedAt`, `rejectedAt`, `cancelledAt`, `reopenedAt`) — synthesizing only `new` + current `status` produces a 1- or 2-row timeline that feels broken to citizens. Sort the events by timestamp and dedupe by event name.
- Subscription effects keyed on the array reference re-run on every refresh even when contents are stable. Derive a stable string key (sorted publicRefs joined) and depend on that instead, so localforage updates that don't change membership don't tear down all listeners.

## Process

- Re-read files after edits/subagents/compaction. Disk is truth.
- Red test before behavior changes. Don’t bundle unrelated fixes.
- Admin Desktop has two route surfaces. If provincial-superadmin login or legacy links still land on prototype URLs like `/dashboard`, `/map`, `/users`, `/reports`, or `/health`, the user falls back into `mockData` pages even when live Firestore/callable pages already exist under `/province/*` and `/analytics`. Fix the route entrypoints before chasing individual mock widgets.
- Extend that route gate to every provincial-superadmin legacy URL that still renders prototype or demo-only UI, including pages backed by local state like `/settings` and pages backed by `useDataStore` like `/emergency`, `/ndrrmc`, `/audit`, `/handoff`, and `/erasure`. If there is no live one-for-one replacement yet, retire the route to a safe live landing page instead of exposing fake functionality.
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
- Auth user creation + Firestore transaction is a two-phase commit with no native rollback. Always wrap the transaction in `try/catch` and call `adminAuth.deleteUser(uid)` as a compensating action before re-throwing, or you leave orphaned auth accounts.
- `queueMicrotask()` around state resets inside `useEffect` is a race-condition smell. If the component unmounts before the microtask fires, the state update fires on an unmounted component (React warns) or a stale one. Reset state synchronously inside the effect body with an explicit `eslint-disable react-hooks/set-state-in-effect` where the project convention allows it.
- Programmatic focus management in modals: attach `useRef` to the modal container (not the backdrop), set `tabIndex={-1}`, and call `.focus()` in a `useEffect` keyed on the open boolean. Pair with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the title element.
- After TOTP/MFA enrollment, Firebase's ID token does NOT automatically refresh. Call `getIdToken(true)` immediately after `multiFactor().enroll()` so downstream `onIdTokenChanged` listeners and custom claims (`mfaEnrolled`) are visible on the next route guard check. Without this, `TotpGuard` redirects back to enrollment in a loop.
- Route param names should be consistent across parent and child routes (e.g., `:dispatchId` everywhere, not `:id` in some places). Inconsistent param names cause `useParams()` to return `undefined` in child components and break deep links.
- `encodeURIComponent()` is required when interpolating user-controlled strings (like `storagePath`) into Google Storage direct-download URLs. Underscores, spaces, and Unicode in paths produce 404s otherwise.
- Normalizing phone numbers at the data-boundary (hook level) rather than at every consumer prevents inconsistency. Strip non-digit/non-plus chars, ensure a leading `+`, and validate with the shared MSISDN validator before surfacing.
- Upload URL requests should validate MIME type and file size _before_ computing the content hash. Rejecting early avoids wasted CPU on `crypto.subtle.digest()` for files that will be rejected by the storage backend anyway.
- `navigator.geolocation` may be undefined in some environments (old browsers, restricted iframes, certain WebViews). Always guard with `if (navigator.geolocation)` before calling `.getCurrentPosition()`; never assume the API is present.
- Adversarial review before merge catches bugs that code review and CI miss. In this session it found: (1) incomplete route param migration (`:id` → `:dispatchId`) that broke two entire pages, (2) audit collection fix applied to only one of two callables, (3) phone regex inconsistency between frontend and backend, (4) TOTP enrollment loop if token refresh fails, (5) non-idempotent idempotency keys, (6) missing modal accessibility parity. Run the review yourself before asking for human review — it takes 10 minutes and saves hours of revert work.
- `useEffect` dependency arrays should contain primitives, not object references. `[dispatch?.status, report?.publicLocation?.latitude, report?.publicLocation?.longitude]` is safer than `[dispatch, report]` because object identity changes on every parent re-render even when values are stable.
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
- Staff MFA audits must inspect `multiFactor.enrolledFactors` directly; `CustomClaims.mfaEnrolled` (or any custom claim) can record intent but is not the source of truth — only `enrolledFactors` reflects whether TOTP is actually enrolled and the factor type.

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
- Emulator tests using `tx.update(docRef)` require the doc to exist; seed it or use `tx.set(docRef, data, { merge: true })`.
- `startAfter(docSnapshot)` for pagination requires the snapshot to contain the `orderBy` field. If the doc was just deleted in the previous batch, re-fetching by ID returns an empty snapshot and `startAfter` throws "Field X is missing". Fix: keep the `QueryDocumentSnapshot` from the query batch instead of re-fetching by ID.
- Testing a TOCTOU race condition in a Firestore transaction requires controlling `now()` so the query-time predicate differs from the transaction-time predicate. A single mock function that returns different values per call simulates the race without concurrency.
- `@firebase/rules-unit-testing` `initializeTestEnvironment` for storage must happen at module load time (top-level await) if tests are conditionally registered with `it.skip` / `itif`. `beforeAll` runs AFTER test registration, so conditions set there are invisible to test registration-time decisions.
- When a test file's `beforeAll` can fail due to missing emulator, use top-level await with try/catch and a boolean flag, then `itif(flag)` for conditional test execution. This lets the file gracefully skip when the emulator is unavailable instead of crashing the suite.

## React

- Render-body ref assignment can trigger loops; sync refs in `useEffect`.
- `useRef(initial)` does not track later state; sync explicitly if current value needed.
- Critical external data should be fetched internally or required as a prop.
- Shared dashboards need an explicit role-to-scope resolver inside the page or wrapper component. If a scoped admin is missing its claim-backed scope ID, do not silently fall back to province data; return a safe access-denied state instead of widening visibility.
- Live Firestore join pages need to wait for the secondary doc fetch before asserting rendered rows or markers. A query can return the right `report_ops` rows while the join to `reports/{id}` is still settling, so tests should wait for the joined record rather than only checking the filter call.
- `react-hooks/refs` flags `ref.current` reads during render; pass render-time values through state.
- CodeQL `js/xss-through-dom` on blob previews: render via `createImageBitmap` + `canvas` instead of blob URL in JSX.
- React Router v7 `useNavigate` returns `Promise<void>`; wrap with `void` or `await`.
- Citizen report tracking maps live Firestore docs, not sanitized fixtures. Normalize timestamp-like values with `toMillis()` and treat `lastStatusAt` as the fallback status timestamp, or the timeline silently drops verified/resolved steps.

## TypeScript

- `catch (err: unknown)` and narrow explicitly. Avoid `any`.
- With `exactOptionalPropertyTypes`, omit optional keys entirely instead of assigning `undefined`.
- `_`-prefixed catch variables may still trigger `no-unused-vars`. Prefer `catch { /* reason */ }` with a comment.

## Auth / Async

- In `onAuthStateChanged`, guard `.then`/`.catch` with an `active` flag + uid check to prevent stale promises overwriting state.
- `awaitFreshAuthToken` must start `getIdToken(true)` inside the Promise constructor so rejection can unsubscribe and reject.
- Null-check `awaitFreshAuthToken` before invoking `httpsCallable`; missing user = opaque failure.
- `linkWithPhoneNumber` requires a non-null `currentUser`. If a `/register` route uses it without an upstream `signInAnonymously()` or prior `signInWithPhoneNumber()`, fresh users get "Not signed in" with no recovery path. Either guard the route, sign in anonymously on mount, or use `signInWithPhoneNumber` and link later.
- For surviving phone numbers across adjacent auth flows (login → register), prefer `sessionStorage["bantayog.last-phone"]` over React Router navigation state. State is dropped on reload; sessionStorage isn't, and survives the full-page reCAPTCHA round-trips that phone auth needs.
- `useState(() => sessionStorage.getItem(...))` lazy initializer is safer than `useEffect` + `setState` for storage seeds — no flash of default value, no `react-hooks/set-state-in-effect` warning, and any throw inside the initializer is caught by React (just guard with try/catch for private-mode/security errors).

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

## Phase 8C — RA 10173 Erasure

- Write Firestore doc before disabling Firebase Auth in erasure callables — if Auth disable fails, doc deletion is the rollback, not Auth re-enable. Simpler invariant with no side effects on write failure.
- `erasure_active/{uid}` sentinel pattern makes the concurrent double-submission race atomic via Firestore transaction. Status checks alone are not sufficient (TOCTOU).
- `erasureSweep` must be sequential (claim one, process, then claim next). Bulk-claiming multiple records lets timeouts strand unclaimed records in `executing` state permanently until the 30-min staleness window.
- Auth hard-delete must be the last step in erasure execution — it is the only non-reversible step and must not precede any Firestore/Storage operation that could fail.
- `retentionSweep` must exclude reports belonging to citizens with active erasure requests via an in-memory UID set. Firestore does not support cross-collection NOT IN filters.
- `retentionHardDeleteEligibleAt` as a queryable field (set at anonymization time + 30 days) avoids the "find a deleted document" problem for the 1-month threshold query.
- `sms_inbox` join is via `senderMsisdnHash` field directly — not via a session ID foreign key. Verify field names against actual schema before implementing SMS nulling steps.

## Misc

- `navigator.clipboard` in happy-dom often needs to be defined as an own property before spying.
- `navigator.storage` is undefined in happy-dom; mock with `Object.defineProperty(navigator, 'storage', { value: { estimate: () => Promise.resolve(...) } })` in tests.
- `@typescript-eslint/no-confusing-void-expression` rejects `void clearInterval(id)` and `void navigate(...)` in arrow shorthand — add braces or use `.then()`/`.catch()` chains.
- `@typescript-eslint/no-unnecessary-condition` flags `navigator.storage?.estimate` when the type says `storage` always exists — use runtime `.catch()` instead of optional chain for happy-dom safety.
- `react-hooks/set-state-in-effect` rejects synchronous `setState` in `useEffect` body, even inside `catch` — move to `.catch()` callback on the Promise instead.
- Risky backend changes need emulator verification first; never prod-deploy in the same session.
- Post-impl-review catch: IndexedDB database names must match exactly between SW and app. localforage wraps IndexedDB with its own internal schema, so raw IDB access from SW to a localforage-managed DB is fragile and may require a dedicated sync-metadata store.
- Storage rules default-deny means any new path needs an explicit allow rule before SDK access works. Signed URLs bypass rules, but defense-in-depth requires the explicit rule anyway.
- `@typescript-eslint/no-confusing-void-expression` rejects `renderHook(() => useHook())` when the hook returns void — wrap in braces: `renderHook(() => { useHook() })`.
- Merge conflicts in long-unresolved worktrees (`pagasa-signal-poll.test.ts` was `UU` for multiple sessions) must be resolved before any new commit can be created. `git add <file>` accepts current-state resolution; `git commit` will block until all `UU` files are resolved.
- Template literal expressions with `number` types in ESLint `@typescript-eslint/restrict-template-expressions` require explicit `String()` cast: `` `${String(dragOffset.x)}px` `` instead of `` `${dragOffset.x}px` ``.

## Phase 4 -- System Health Controls

- Dead-letter replay callable should iterate sequentially, not `Promise.all`, so partial failures don't lose track of which items succeeded. Return `{ replayed: number }` and let the admin re-trigger for remaining items.
- `streamAuditEvent` is fire-and-forget and never throws; the dead-letter write inside its catch block must also be fire-and-forget (nested try/catch) so a Firestore outage doesn't cascade into the caller.
- Prewarm via HTTP GET to callable endpoints returns 405 Method Not Allowed, but the Cloud Functions instance still starts. Count any response object as success; only network errors (timeout, ECONNREFUSED) count as failure.
- `fetch` in Node 20 is global; no `node-fetch` dependency needed. Use `AbortSignal.timeout(ms)` for request timeouts.
- Reusing the existing `dead_letters` collection with a `category` field (`audit_stream`) is cleaner than creating a separate `audit_events` collection. The signal dead-letter replay pattern (filter by category, resolve in memory, update status) ports directly.

## PWA / Service Worker

- Background Sync API is Chromium-only; iOS Safari falls back to in-app retry machine — no feature detection needed at call site since `register('sync')` is a no-op on unsupported browsers.
- Service Worker cannot use Firebase JS SDK (requires bundling); use Firestore REST API (`firestore.googleapis.com/v1/projects/...`) for SW background sync writes.
- Idempotency key on the SW write ensures dedup if both SW and in-app machine both succeed for the same draft.
- Image compression in the browser: canvas `toBlob('image/jpeg', quality)` is the reliable cross-browser path (avoids `createImageBitmap` + `OffscreenCanvas` compatibility issues).
- Opportunistic dynamic caching alone is not enough for an offline-first PWA — a cold offline boot has nothing to fall back to. Precache the app shell (`/`, `/index.html`, manifest, key icons) on `install` and serve cached `/index.html` for any navigation request that fails the network. SPA shell + React Router then handle per-route offline UI.
- When bumping a SW cache version, the existing `activate` cleanup must already filter for the cache prefix (`bantayog_shell_*` here); otherwise the old cache lingers and precache never re-runs.

## UX / A11y

- Conditional rendering of primary action buttons (`{state !== null && <Button…/>}`) reads as "silent failure" — users see no button and no instruction. Prefer always-rendering the action region with one of two states: a `role="status"` hint when the precondition is unmet, or the action button when it is. Pattern matches the offline-banner pattern in `CitizenShell`.
- For WCAG-AA contrast, prefer Tailwind theme tokens (`text-surface-600`, `text-surface-500`) over arbitrary `text-[#hex]` so contrast becomes part of the design-system contract instead of a per-page coincidence. The `surface-400` / `surface-300` tokens (3.1:1 / 4.0:1) are decorative-only — never use them for body text on light backgrounds.
- Routes that bypass the shell (`/settings`, `/register`, `/login`, full-page wizards) need their own `<main id="main-content">` element; the skip link inside `CitizenShell` already targets `#main-content`, so reusing the same ID keeps that link consistent across shell and non-shell pages.
- Severity colors MUST be consistent across ALL views (IncidentLayer, MyReportLayer, PeekSheet, DetailSheet, ProfileCard, incident-meta). Currently MEDIUM has 3 different values: `#7c3500` (IncidentLayer), `#a73400` (MyReportLayer), `#d97706` (incident-meta). LOW has 2 values: `#414849` (IncidentLayer/MyReportLayer), `#334155` (incident-meta). Fix: centralize severity colors in one constant and import everywhere.
- `React.lazy()` components FAIL when offline because they require fetching JS chunks. The RevealSheet uses lazy loading but is shown for `queued` state when offline, causing error boundary instead of proper queued UI. Fix: either eager import for states shown while offline, or inline fallback UI that doesn't require the lazy chunk.

## Wizard / Multi-step Forms

- "In-progress wizard state" and "finalized draft awaiting submission" are different concerns — keep them in separate stores. `draft-store` requires `publicRef`, `secretHash`, `correlationId`, `idempotencyKey` (all populated at submit); shoehorning partial wizard state into it forces placeholder values that pollute the queued-draft list. A small dedicated `wizard-snapshot` store (localforage instance, 24h TTL, single-record `wizard-in-progress` key) is cleaner.
- Default a required selector to `''`, not a "first" value. A seeded default like `useState('flood')` looks harmless but it lets bypass paths (a "Skip" button calling the same `handleNext`) silently submit the seeded value. Combine with handleNext-level validation + inline `role="alert"` error.
- Do not persist `File`/`Blob` in IDB at per-keystroke cadence. Snapshot writes happen on every step transition; a 5 MB photo encoded into the snapshot bloats every write. Persist scalar form data only; let the user re-attach photos on resume (acceptable since photos are usually optional).
- Mid-form persistence requires accepting initial-value props on each step component. Without `initialReportType` etc., a back-navigation from Step 2 to Step 1 (or a refresh that resumes mid-wizard) re-mounts the step with fresh defaults and silently loses the user's input.
- Snapshot save effect must be gated on a `hasLoadedSnapshot` boolean, otherwise the initial empty `formData` clobbers the just-loaded snapshot before the resume effect commits. Two-effect pattern: load on mount, then enable saves.

## Responder PWA / Frontend Build

- CSS Modules + `noUncheckedIndexedAccess: true` makes `styles.foo` return `string | undefined`, which trips React component props that demand strict `string` (e.g. react-leaflet's `MapContainer.className`). Two fixes: coalesce at use-site (`styles.foo ?? ''`) for the prop case, or use `[a, cond && b].filter(Boolean).join(' ')` for combining classes. Avoid `composes:` because it pulls a Vite CSS-modules edge case.
- `aria-current={isActive ? 'page' : undefined}` violates `exactOptionalPropertyTypes`. Use a conditional spread instead: `{...(isActive ? { 'aria-current': 'page' as const } : {})}`. Same trick works for any optional prop union that doesn't include `undefined` directly.
- React 19's `@types/react` deprecates `FormEvent`; lint `@typescript-eslint/no-deprecated` flags it. Use `SyntheticEvent` for generic form/submit handlers, or `SubmitEvent` only when you genuinely need the form-submission-specific type.
- happy-dom returns `navigator.geolocation === null` even though browser DOM types declare it always present. ESLint `@typescript-eslint/no-unnecessary-condition` flags the defensive `if (!navigator.geolocation) return` as "always falsy" — keep the guard with an `eslint-disable-next-line` comment, otherwise vitest tests crash with "Cannot read properties of null (reading 'watchPosition')".
- Vitest `act(async () => { vi.advanceTimersByTime(...) })` triggers `@typescript-eslint/require-await` because the inner body is sync. Drop `async` and use sync `act(() => { ... })`; the React state updates that follow `vi.advanceTimersByTime` are also sync, so `act` flushes them.
- React Router v7's `createBrowserRouter` + `RouterProvider` ignores any wrapping `MemoryRouter` because the router has its own context. Test routes by mutating `window.history.pushState()` + `vi.resetModules()` + dynamic re-import (matches the citizen-pwa `App.routes.test.tsx` pattern).
- Vitest module mocks (`vi.mock('./SosHoldButton', ...)`) don't prevent Vite's static analysis from resolving the real module path; the file must exist on disk. Either create a stub component first (replace it later) or mock the module before the test imports the parent.
- Per-test mock state across multiple `it()` blocks can leak. `vi.fn()` declared at file scope keeps `mock.calls` between tests — add `mockClear()` (or `vi.clearAllMocks()`) in `beforeEach` whenever you assert "not toHaveBeenCalled" later.
- `@typescript-eslint/restrict-template-expressions` rejects `${pendingCount}` for `number` types. Wrap with `String()` (`${String(pendingCount)}`) or coalesce explicitly. Same rule fires inside aria-label, href URL strings, and JSX text expressions.
- Plan-driven trivial existence test (`expect(existsSync(filePath)).toBe(true)`) needs `node:fs` + `node:url` + `path.dirname(fileURLToPath(import.meta.url))` because the responder-app's tsconfig doesn't include `@types/node` globally — add `/// <reference types="node" />` at the top of the test file.
- Plan said `REPORT_TYPE_LABEL[row.reportId]` for dispatch list cards but `row.reportId` is the dispatch's report **id** (e.g. `rep_abc123`), not the report **type** (e.g. `flood`). The lookup always misses; either fetch the report (extra subscription per row) or just show a generic label. We chose the latter for the MVP list view.
- `useDispatchHistory` queries `dispatches` for `assignedTo.uid == uid` AND `status in [resolved, declined, timed_out, cancelled, unable_to_complete]`. The `where('status', 'in', […])` array is capped at 30 by Firestore, but our terminal-status set is well under that.
- Removing functionality from one tab (DispatchListPage's availability/handoff/sign-out) without immediately re-adding it elsewhere temporarily breaks the responder UX (no way to sign out). Keep tasks in commit order so the gap is at most one task long. Per-task atomic commits make this safe.
- When a Firestore list query depends on nested agency membership, do not force the client path to fit the rules engine. Use a callable to read the scope server-side and return a narrow payload; it is less brittle than fighting query-evaluation edge cases.

## Responder PWA — Post-Review Hardening (2026-05-06)

- **Firestore client writes must match the rule's field-name expectations.** A mocked `addDoc` test passes regardless. Always pair client message/note hooks with a corresponding rules test in `functions/src/__tests__/rules/` that uses the real emulator and asserts the actual write succeeds/fails.
- **`L.divIcon` is the offline-friendly Leaflet marker pattern.** External CDN URLs (unpkg, cdnjs) work in dev but fail offline. The citizen-pwa's `IncidentLayer` is the canonical reference.
- **`watchPosition` without `document.visibilityState` handling drains battery in field PWAs.** Always pause on hidden, set a `timeout`, and consider lower accuracy when stationary.
- **Map auto-recenter on every GPS tick is a UX trap** — fly once on first lock and expose an explicit "recenter" button.
- **`auth.currentUser.displayName` is the de facto identity field for Bantayog responders.** Firestore `responders/{uid}.displayName` is unpopulated by current bootstrap paths; fall through both before defaulting to the role label.
- **Auto-redirect on a single-active dispatch hides any pending dispatches.** Document the trade-off; revisit after operational data is available.
- **Centralizing incident labels in one `incident-labels.ts` module prevents label drift** across MapPage popups, DispatchDetailPage cards, and ProfilePage role display.
- **`useOwnDispatches.error` is typed `string | null`, not `Error`.** Rendering `{error}` directly in JSX throws "Objects are not valid as a React child" if an `Error` object leaks in from a mock. Match the hook's contract exactly in tests.
- **Happy-dom default scroll metrics are not realistic.** Tests that assert on `scrollIntoView` behavior must set explicit `scrollHeight`/`scrollTop`/`clientHeight` or the initial mount may spuriously trigger scroll.
