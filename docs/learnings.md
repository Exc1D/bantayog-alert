# Learnings — Durable Rules

## MVP Reliability Spine

- **Stale `functions/lib/` causes ghost errors.** Functions emulator loads from `lib/`, not `src/`. Rebuild (`pnpm --dir functions build`) after source changes before trusting emulator output. This is the #1 cause of `FirebaseError: internal`.
- **`firestore.rules` and `firestore.rules.template` must stay in sync.** Template-only edits never deploy. Run `diff` before considering rules tasks done.
- **Emulator-based tests MUST use top-level await (not `beforeAll`) when gating on emulator availability.** `vitest` evaluates `itif(available)` at module registration time; `available` must be settled before test registration.
- **Anonymous Auth needs both reuse and cleanup.** Set persistence before `signInAnonymously()` so one browser profile reuses one UID. Backend cleanup must exclude linked/upgraded/claimed accounts.
- **RTDB parent-level `.read` overrides child `$uid` scoping.** Parent `.read` on wildcarded paths is almost always wrong — remove it.
- **Zombie emulator Java processes block ports.** `killall -9 java` before starting emulators.
- **Functions dependencies must match the declared runtime (Node 20).** Check `engines.node` before accepting dependency bumps.
- **Single-dispatch-doc escalation:** mutate `assignedTo`, increment `escalationCount`, push old UID to `previouslyNotifiedResponderUids`.

## Citizen PWA / React Hooks

- Filter invalid entries individually (`raw.filter(isStoredReport)`); discarding the whole array wipes all stored reports on one stale entry.
- Track from localForage before `report_lookup` materializes; `onSnapshot` upgrades automatically.
- Normalise incident-type aliases at the draft boundary (e.g. `public_disturbance` → `security`).
- `vi.mock` at module top level does NOT cover newly routed components — add mocks per new route.
- Async state gates must resolve in both `.then()` and `.catch()`.
- Pass navigation callbacks as props instead of calling `useNavigate` in tests without Router context.
- Subscription effects keyed on array references re-run every refresh. Derive a stable string key (sorted joined public refs).
- "In-progress wizard state" and "finalized draft awaiting submission" are different concerns — keep in separate stores.
- Do not persist `File`/`Blob` in IDB at per-keystroke cadence.
- Snapshot save effect must be gated on `hasLoadedSnapshot`, or initial empty formData clobbers the just-loaded snapshot.

## Process

- Re-read files after edits/subagents/compaction. Disk is truth.
- Red test before behaviour changes. Don't bundle unrelated fixes.
- Verify functions region (`asia-southeast1`) before chasing auth issues.
- `createTestEnv()` requires Firestore, Database, and Storage emulators all running.
- Auth user creation + Firestore doc is two-phase with no rollback. Wrap in try/catch with compensating `adminAuth.deleteUser(uid)`.
- `queueMicrotask()` in useEffect state resets is a race-condition smell. Reset synchronously.
- Modal focus: `useRef` on container, `tabIndex={-1}`, `.focus()` in useEffect on open. Pair with `role="dialog"`, `aria-modal="true"`.
- Route param names must be consistent across parent and child routes.
- `encodeURIComponent()` for user-controlled strings in Storage URLs.
- Upload URL requests should validate MIME type and file size before computing content hash.
- Admin map triage controls must mirror backend report transitions; showing every action for every status creates guaranteed callable failures.
- Adversarial review before merge catches bugs CI misses. Run it yourself.
- `useEffect` dependency arrays should contain primitives, not object references.
- Seed documents via `env.withSecurityRulesDisabled()`, not unauthenticated context, when `create` is `false`.
- Cleanup must discover related IDs and attempt every delete with `Promise.allSettled`.

## Firestore

- All reads before first write in transactions.
- Fetch optional data up front; don't read later in the transaction.
- Prefer stable error codes over message matching.

## Security

- Fail explicitly on missing auth/scope; no permissive fallbacks.
- Normalise fields on both read and write paths.
- Verify Firestore Rules function signatures match call sites.
- Staff MFA audits must inspect `multiFactor.enrolledFactors` directly — `CustomClaims.mfaEnrolled` records only intent.

## Testing

- `vi.hoisted()` mocks must be created inside the hoisted callback.
- A passing test is not enough; confirm it exercises the changed path.
- Never mix Admin SDK and Client SDK Firestore calls in the same context.
- Callable error handling: use runtime client codes (`not-found`), not internal enum names.
- Wrap `waitFor(() => expect(...))` assertion body in braces.
- Auth-dependent setup must render inside `AuthProvider`.
- `startAfter(docSnapshot)` pagination requires snapshot to contain the `orderBy` field.
- `userEvent.setup({ advanceTimers })` under `vi.useFakeTimers()` can deadlock on `click`. Use `fireEvent.click` under fake timers; reserve `userEvent` for real-timer flows.
- Test mocks must provide non-empty data when testing a dashboard with empty-state short-circuit.
- `noop` pattern: `const noop = (): void => { return }` instead of inline `() => {}`.
- `itif(available)` when `available` is assigned in `beforeAll` permanently skips suite. Gate on static env.
- `window.confirm` is undefined in vitest/jsdom. Assign before testing and restore after: `window.confirm = vi.fn()`.

## React

- Narrow role claims via `typeof` checks before wiring `onSnapshot`. Gate with `setError('unauthorized')` + early return.
- `report_ops` stores `agencyIds` (array); `reports` uses singular `agencyId`. Cross-check schema before `where` clauses.
- Render-body ref assignment can trigger loops; sync refs in `useEffect`.
- Live Firestore join pages must wait for secondary doc fetch before asserting rendered rows.
- React Router v7 `useNavigate` returns `Promise<void>`; wrap with `void` or `await`.
- `position: sticky` breaks when `overflow-x: auto` converts `overflow-y: visible` to `auto`.
- `React.lazy()` components FAIL when offline. Eager import for offline states.

## TypeScript

- `catch (err: unknown)` and narrow explicitly. Avoid `any`.
- With `exactOptionalPropertyTypes`, omit optional keys entirely instead of assigning `undefined`.
- `_`-prefixed catch variables may trigger `no-unused-vars`. Use `catch { /* reason */ }`.
- Type assertions (`as string`) required at callable boundaries where `req.auth.token` values enter typed interfaces.
- `dispatchStatusSchema` union changes require downstream rebuilds for new literal types.
- `noUncheckedIndexedAccess` makes array/object access return `T | undefined`. Guard or assert explicitly.

## Auth / Async

- `onAuthStateChanged`: guard `.then`/`.catch` with an `active` flag + uid check.
- `linkWithPhoneNumber` requires non-null `currentUser`.
- Prefer `sessionStorage` over React Router navigation state for cross-step data.
- `useState(() => sessionStorage.getItem(...))` lazy initializer is safer than `useEffect` + `setState`.

## Emulator Gotchas

- Firebase Auth Emulator auto-enables MFA for phone-number users. Create test users without phone.
- `firebase-functions` v7.x + `firebase-tools` v15.x crashes `onDocumentCreated` with protobuf decode errors (upstream bug, prod impact zero). Use `process-inbox-manual.ts` workaround.
- Admin SDK Timestamps are rejected by JS SDK Firestore in rules-unit-testing. Write `.toMillis()`.
- `navigator.geolocation === null` in happy-dom; `navigator.clipboard` must be defined as own property before spying.
- Auth Emulator isolates users by Project ID even in `singleProjectMode: true`. Ensure seed scripts match client config's project ID.

## Security / Functions

- Use `isAccountActive(request.auth.token)` for account status; never check `claims.active === true` directly.
- Use `shouldEnforceAppCheck()` from `app-check-config.js`; never `NODE_ENV === 'production'`.
- FCM token ownership must be verified against Firestore before subscribing/unsubscribing to topics.
- RTDB security rules cannot reference Firestore data.

## Vite / Build

- Vite 8+ (Rolldown) requires `manualChunks` as a function, not an object.

## Refactoring / Monorepo

- Remove stale build artifacts (`lib/*.js`, `.d.ts`, `.map`) after file renames.
- Shared packages need app runtime deps as `peerDependencies`.
- `pnpm --filter` from a worktree resolves to main repo's `package.json`. Use `npx vitest` directly inside the package.
- Domain over layer: organise by business domain, not technical layer.
- `git mv` preserves history; update `index.ts` incrementally.
- Don't mix package extraction with directory reorg. Finish one, let it bake.

## Dispatch / Monitor

- Firestore `in` array queries capped at 10 values — chunk municipality IDs into groups of ≤10.
- Lease pattern (`monitorLeaseAt` + 120s expiry) prevents overlapping cron runs.
- Circuit breaker: skip processing if query returns more records than threshold.
- Dispatch docs must satisfy schema + Firestore rules (dispatchedByRole, statusUpdatedAt, idempotencyKey, municipalityId).
- Callable optional fields must be omitted, not sent as `undefined`/`null`.
- Responder accept must support both claim eras: use `isAccountActive()` for callable guards.

## Erasure (RA 10173)

- Write Firestore doc before disabling Firebase Auth in erasure callables.
- `erasure_active/{uid}` sentinel pattern makes concurrent double-submission atomic via transaction.
- Auth hard-delete must be the last step — it is the only non-reversible step.
- `retentionSweep` must exclude active erasure citizens via in-memory UID set.
- Erasure sweep must be resumable with checkpoint tracking — crash mid-sweep leaves PII.

## PWA / Service Worker

- Background Sync is Chromium-only; iOS Safari falls back to in-app retry machine.
- SW cannot use Firebase JS SDK; use Firestore REST API.
- Image compression: canvas `toBlob('image/jpeg', quality)` is the reliable cross-browser path.
- Cold offline boot needs precached app shell on `install`. Serve cached index.html for failed navigation requests.
- SW background sync must include a valid Firebase ID token from IndexedDB auth store.

## UX / A11y

- Conditional rendering of action buttons reads as "silent failure." Always render the action region.
- Severity colors MUST be consistent across ALL views. Centralize in one constant.
- Truth-gate: when fields can't be derived from the live stream, make them optional and render `—`.
- Modal forms MUST use `<form>` with `<button type="submit">` for Enter-key submission.
- `useFocusTrap` must check `offsetParent !== null`, not just `disabled`.
- `prefers-reduced-motion` must target the specific animated element class, not universal selectors.
- Skip links: `position: absolute` + `top: -40px` → `top: 8px` on `:focus` with high `z-index`.
- Skeleton loaders need `aria-hidden="true"` paired with a visible "Loading…" heading for SR users.
- `backdrop-blur` classes are banned per PRODUCT.md. Audit all occurrences.
- Window-sync dedup via `crypto.randomUUID()` + in-memory `Map` with TTL.
- Module-level `window.innerWidth` checks are stale on resize. Use a `useIsMobile` hook.
- **Adaptive density:** PRODUCT.md Principle #3 (card mode ≤10 items, compact row mode >10 items) must be explicitly enforced in list views. Ring card for every item is a P0 violation during high-volume incidents.
- **Hazard color-coding:** When hazard types are visually indistinguishable (all same color), scanning speed drops. Assign distinct colors per hazard Type (typhoon=blue, flood=cyan, fire=orange, earthquake=red, landslide=amber). Fallback to default (amber) for unknown types. Centralize the mapping; don't hardcode in every consumer.
- Color-code both the icon badge (top-left of card) and the hazard chip (footer) for double-encoded scanning.

## System Health Controls

- Dead-letter replay should iterate sequentially, not `Promise.all`.
- Node 20 `fetch` is global; no `node-fetch` needed. Use `AbortSignal.timeout(ms)`.
- Prewarm: any HTTP response (even 405) counts as success (CF instance still starts).

## BigQuery / Cloud Logging

- Use `bq.query()` directly, not `@google-cloud/bigquery` `.table().query()`.
- `@google-cloud/logging` must be explicit dependency when using Cloud Logging API in triggers.

## Security Audit Patterns

- `requireAuth` MUST check `accountStatus === 'active'` in addition to role.
- Callable handlers without `requireAuth` must manually check both role AND `accountStatus`.
- Idempotency guard result persistence must be atomic (within a transaction).
- `system_config` must never be world-readable — minimum `isAuthed()`.
- SMS delivery webhooks need HMAC signature verification.
- MFA bypass must be explicit (`ALLOW_MFA_BYPASS=true`), not automatic for staging.
- PII should use `sessionStorage` (tab-scoped, auto-cleared), not `localStorage`.
- Signed URL TTL: 60s, path: `pending/{uid}/{uploadId}` to prevent cross-user access.
- CORS origins must be environment-aware — localhost only when `FUNCTIONS_EMULATOR=true`.
- `suspendStaffAccount` must call `adminAuth.setCustomUserClaims()` — existing ID tokens carry claims for 1 hour.
- `declareAlert` needs rate limiting (5 per 5 min); `hazardType` must be Zod enum.
- `declareDataIncident.affectedCollections` validated against known allowlist.
- `isAuthed()` requiring `accountStatus == 'active'` broke anonymous submissions. `report_inbox` create MUST use `request.auth != null` directly.
- `canReadReportDoc(data)` cannot use `data.reportId` — document data doesn't contain the ID. Pass path variable explicitly.
- Feed moderation must include `new` status so admins can call `verifyReport` (new → awaiting_verify).
- Query `reports` by `municipalityId`, not `agencyId` (field doesn't exist on `reports`).
- Citizen online submits should call `submitCitizenReport` callable (fast path), not just `report_inbox`.
- `publicRef + secretHash` is the citizen report replay key.
- Seeded reports need matching `report_ops` + `dispatches` docs for proof tests.
- Treat visible no-op command-center actions as P0 UX defects.
- Mode/state precedence: actionable states (surge) win over data-quality states (degraded).

## Acceptable Security Risks

- **L-1: `report_lookup` world-readable** — anonymous tracking refs only, no PII. Revisit if schema changes.
- **L-2: rate-limit contention** — single-doc transactions, ~10k writes/sec per doc. Monitor via Cloud Logging.
- **L-17: O(n) municipality boundary iteration** — bounded by config (~50 per report), not user input.
- **M-20: No VPC Service Controls** — mitigated by Security Rules, IAM least privilege, App Check, HMAC webhooks.
- Subscription callables need user-keyed (not token-keyed) rate limits.
- Public/anonymous callables must never return raw `err.message`. Log server-side, return fixed client message.
- Smoke checks need explicit bucket config and per-check timeouts.

## Profile UX + Cleanup (2026-05-28)

- Hooks exposing `{ loading, error }` are worthless if consumers ignore them. Audit destructuring after every hook integration.
- Deleting shared-package source exports requires removing stale `lib/` artifacts and rebuilding all downstream consumers.
- Removing a feature: distinguish older version from newer version. Grep for all collection/scenario names before deleting.

## Test Hardening (2026-05-26)

- Root `vitest.config.ts` must explicitly include every `shared-*` package in the `include` array.
- Even trivial constants need regression tests — a 3-line test is cheaper than a production incident.
- k6 load tests: nightly cron (not PR gate). Keep `workflow_dispatch` for ad-hoc runs.
- e2e full-loop proof belongs in CI, not just local dev.
