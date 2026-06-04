# Learnings - Durable Rules

## Reliability / Demo Spine

- `pnpm dev` must start the canonical local stack: emulators, Firebase web env defaults, and seeded demo accounts. Use `pnpm dev:apps` only for deliberate frontend-only work.
- Proof fixtures must match the normal dev seed. Manual Daet submissions require `municipalities/daet`; demo responders require `agencyId: bfp-daet`, `accountStatus`, `lastSeenAt`, and RTDB roster/location metadata.
- Rebuild Functions before trusting emulator output. The emulator loads `functions/lib/`, not `src/`; stale builds are the fastest path to fake `FirebaseError: internal`.
- `firestore.rules` and `firestore.rules.template` must stay in sync. Template-only edits do not deploy.
- `pnpm dev:all` must fail loudly until Auth, Firestore, and RTDB accept real connections; a listening port is not enough.
- Keep one Firebase project ID flowing through emulator startup, Vite env, Functions registration, proof, and seed scripts. Project-ID drift makes healthy data look missing.
- Local untracked `.env` files can hide missing `VITE_FIREBASE_*` keys. Dev-all should provide emulator-safe defaults for CI and demos.
- Account-only demo seeding still needs responder roster data in Firestore and RTDB so manual dispatch works without workflow automation.
- Full-loop proof should warm Vite routes, open explicit login routes before auth, dismiss admin onboarding at the protected click point, and use longer first-load timeouts on clean CI runners.
- Responder GPS denial during dispatch detail is recoverable. Log it as `console.warn`, show fallback copy, and include mobile reduced-motion/offline/overflow checks in demo proof.
- Zombie emulator Java processes block ports. Clear them before starting emulators when port binding gets weird.
- Functions dependencies must match the declared runtime. Check `engines.node` before accepting dependency bumps.
- App Check emulator mismatch: when `VITE_USE_EMULATOR=true`, `createAppCheck` MUST use `CustomProvider` with a dummy token. `ReCaptchaV3Provider` against emulator project = 400 cascade (AppCheck/auth/Functions all fail). Other apps (responder-app, admin-desktop) already do this inline; citizen-pwa uses `@bantayog/shared-firebase` which was missing the emulator branch.
- React Strict Mode double-invokes mount effects. Hooks that trigger side-effects on mount (e.g. `useGpsLocation(autoAttemptOnMount)`) need a `useRef` guard to prevent duplicate calls, otherwise users see multiple GPS prompts / repeated state transitions.
- App Check error codes use `appCheck/` prefix, not `auth/`. Retry logic that only checks `code.startsWith('auth/')` will burn retries on unrecoverable App Check throttling.

## Firestore / Rules / Data Access

- In transactions, do all reads before the first write. Fetch optional data up front.
- Prefer stable error codes over message matching.
- RTDB rules cannot reference Firestore, and parent `.read` rules override child `$uid` scoping. Avoid parent-level wildcard reads.
- Seed fixtures through `env.withSecurityRulesDisabled()`, not unauthenticated contexts, when `create` is `false`.
- `report_inbox` and `situation_updates` create paths are anonymous-friendly but must still require `request.auth != null` and `request.auth.token.accountStatus == 'active'`. `isAuthed()` is too strict for these paths.
- `secret_lookup` reads must verify `report_private/{reportId}.reporterUid == request.auth.uid`.
- `system_config` must never be world-readable.
- `canReadReportDoc` cannot read `data.reportId`; pass the path variable explicitly.
- `reports` query by `municipalityId`; `reports` has singular `agencyId`, while `report_ops` has `agencyIds`.
- Hidden/multi-municipality alerts need query-provable projections such as `municipalityScope.<id> == true`; `array-contains` alone cannot prove rules access.
- Rules fixtures for production-projected docs must preserve intentionally omitted optional fields, such as multi-municipality alerts without scalar `municipalityId`.
- Admin SDK Timestamps are rejected by JS SDK rules-unit-testing writes. Use millis.
- Chronological public feeds need server ordering and approved indexes: pair `where('visibility')` with `orderBy('createdAt', 'desc')`, then apply `limit()`.
- Firestore `in` queries cap at 10 values. Chunk municipality IDs.

## Security / Privacy / Abuse

- Auth guards must check active accounts, not just roles. `requireAuth` should enforce `accountStatus === 'active'`; handlers without it must do the same manually.
- Fail explicitly on missing auth/scope. No permissive fallbacks and no raw `err.message` in public/anonymous callable responses.
- Use `shouldEnforceAppCheck()`, not `NODE_ENV === 'production'`.
- Verify FCM token ownership before topic subscribe/unsubscribe.
- Idempotency result persistence must be atomic.
- SMS delivery webhooks need HMAC verification.
- MFA bypass must require explicit config such as `ALLOW_MFA_BYPASS=true`; staff MFA audits must inspect `multiFactor.enrolledFactors`, not only custom claims.
- PII belongs in `sessionStorage` or server storage, not long-lived `localStorage`.
- Signed upload URLs: short TTL, `pending/{uid}/{uploadId}` path, MIME and size validation before hashing.
- CORS origins must be environment-aware; localhost only when `FUNCTIONS_EMULATOR=true`.
- `suspendStaffAccount` must update Firebase Auth custom claims because existing ID tokens can live for an hour.
- `declareAlert` needs rate limiting and enum validation; `declareDataIncident.affectedCollections` needs an allowlist.
- Accepted risks: `report_lookup` is world-readable only while it contains anonymous tracking refs and no PII; rate-limit contention and municipality-boundary iteration are bounded; no VPC Service Controls is mitigated by Rules, IAM, App Check, and webhook HMAC.

## Citizen PWA / Offline

- Citizen-visible data needs backend-enforced visibility. Alerts and situation posts carry `visibility`; Citizen queries only read public docs; admin moderation goes through audited callables.
- Situation updates are not emergency reports. Keep them separate, short, pseudonymous, public-read, no update/delete, and moderatable.
- Situation updates need `municipalityId`; labels are display-only.
- Ethical retention uses situational awareness and lifecycle competence, not streaks, leaderboards, popularity, or pressure to submit.
- Track from localForage before `report_lookup` materializes; snapshots upgrade automatically.
- Filter invalid stored reports individually; do not discard the whole array because one stale item exists.
- Keep in-progress wizard state separate from finalized drafts awaiting submission.
- Do not persist `File`/`Blob` at per-keystroke cadence. Gate snapshot saves on `hasLoadedSnapshot`.
- Normalize incident-type aliases at the draft boundary.
- Background Sync is Chromium-only; iOS needs an in-app retry path. Service workers cannot use Firebase JS SDK; use Firestore REST with a valid ID token from IndexedDB auth state.
- Cold offline boot needs a precached app shell and cached `index.html` for failed navigations.
- Canvas `toBlob('image/jpeg', quality)` is the reliable cross-browser compression path.
- `React.lazy()` components fail offline. Eager-import offline states.

## Dispatch / Responder / Monitor

- Single-dispatch escalation mutates `assignedTo`, increments `escalationCount`, and appends the old responder to `previouslyNotifiedResponderUids`.
- Dispatch docs must satisfy schema and rules: `dispatchedByRole`, `statusUpdatedAt`, `idempotencyKey`, `municipalityId`, and omitted optional fields instead of `undefined`/`null`.
- Responder accept must support both claim eras via `isAccountActive()`.
- Seeded reports used in proof need matching `report_ops` and `dispatches` docs.
- Admin map triage controls must mirror backend report transitions; visible no-op command-center actions are P0 UX defects.
- Admin dashboard widgets must end in an operator action. Report lifecycle counts should expose the next valid backend transition or deep-link to the Map/Feed surface that owns it.
- Dispatch candidates and roster management are different datasets. A roster workbench must include unavailable, off-duty, suspended, and revoked responders; filter to active/available only at the dispatch-selection boundary.
- Admin Map must not subscribe to RTDB parent paths such as `responder_locations`; existing rules only allow scoped child reads, so parent listeners surface false permission-denied banners during dispatch.
- Mode/state precedence: actionable states such as surge win over data-quality states such as degraded.
- Lease monitors with `monitorLeaseAt` plus expiry, and add circuit breakers for oversized query results.

## Testing

- Red test before behavior changes. A passing test is not enough; prove it exercises the changed path.
- Emulator availability gates must be settled before Vitest registers tests. Use top-level await/static env, not `beforeAll`, for `itif(available)`.
- `createTestEnv()` requires Firestore, Database, and Storage emulators when the test config includes all three.
- Never mix Admin SDK and Client SDK Firestore calls in one rules-test context.
- Keep Citizen PWA Playwright specs under `e2e-tests/specs/` unless `testDir` changes.
- For offline evidence without emulators, assert visible queued/recovery state; backend replay needs a separate emulator-backed test.
- Playwright labels are fuzzy by default. Use `{ exact: true }` for overlapping labels such as `Municipality`.
- Explicit reduced-motion evidence should call `page.emulateMedia({ reducedMotion: 'reduce' })` and assert `matchMedia`.
- E2E jobs with fresh checkouts must build workspace package `lib` outputs before Vite starts; `needs: build` does not carry artifacts automatically.
- Pre-auth E2E readiness should hit explicit login routes; protected roots can linger on auth-loading spinners.
- Callable tests should assert runtime client codes such as `not-found`, not internal enum names.
- Test harness gotchas: `vi.hoisted()` creates hoisted mocks; wrap `waitFor(() => expect(...))` bodies in braces; render auth-dependent setup inside `AuthProvider`; `startAfter(docSnapshot)` requires the order field; fake timers pair better with `fireEvent` than `userEvent`; mock dashboard data must avoid empty-state short-circuiting; define and restore `window.confirm`; prefer `const noop = (): void => { return }`.

## React / TypeScript

- Narrow role claims with `typeof` before subscribing. On unauthorized state, set an error and return early.
- Async auth/state gates need active flags and uid checks in both success and failure paths.
- Avoid object/array references in effect dependencies. Derive stable primitive keys.
- Render-body ref assignment can loop; sync refs in effects.
- Live Firestore join pages must wait for secondary doc fetches before asserting rendered rows.
- React Router v7 `useNavigate` returns `Promise<void>`; use `void` or `await`.
- `position: sticky` breaks when `overflow-x: auto` forces `overflow-y: auto`.
- With `exactOptionalPropertyTypes`, omit optional keys instead of assigning `undefined`.
- `noUncheckedIndexedAccess` makes indexed access return `T | undefined`; guard or assert.
- Use `catch (err: unknown)` and narrow. Avoid `any`, `@ts-ignore`, and `_`-prefixed unused catch variables.
- Type assertions are expected at callable boundaries where `req.auth.token` values enter typed interfaces.
- Schema union changes, such as `dispatchStatusSchema`, require downstream rebuilds.

## UX / A11y

- Do not conditionally remove action regions; it reads as silent failure.
- Centralize severity and hazard colors. Distinguish hazard types on both icon badges and chips.
- Enforce adaptive density: card mode for small lists, compact rows for high-volume incident lists.
- Truth-gate derived live fields: make uncertain data optional and render a clear fallback.
- Modal forms should use real `<form>` submit semantics and focus the dialog container on open.
- `useFocusTrap` must check visibility, not only disabled state.
- Reduced-motion CSS should target the animated element, not universal selectors.
- Skip links need offscreen absolute positioning and a visible high-z-index focus state.
- Skeletons need `aria-hidden="true"` plus a visible loading heading for screen readers.
- `backdrop-blur` is banned by PRODUCT.md.
- Use a resize-aware hook for viewport state; module-level `window.innerWidth` goes stale.
- Window-sync dedup needs `crypto.randomUUID()` plus an in-memory TTL map.

## Build / Monorepo / Infra

- Vite 8/Rolldown expects `manualChunks` as a function.
- Shared packages need app runtime deps as `peerDependencies`.
- Remove stale `lib/*.js`, `.d.ts`, and maps after renames.
- `pnpm --filter` from a worktree can resolve against the main repo. Prefer direct commands inside the package/worktree.
- Organize by business domain over technical layer. Use `git mv`, update `index.ts` incrementally, and do not mix package extraction with directory reorg.
- CLI tools invoked by CI scripts, such as `esbuild`, must be root devDependencies, not transitive dependencies.
- Firebase emulator lists in CI must include every emulator required by the rules tests, including Storage when configured.
- Terraform BigQuery `default_table_expiration_ms` must be at least `3600000`.
- Dependabot lockfile conflicts often need a consolidated lockfile regeneration after one PR lands.
- Node 20 has global `fetch`; use `AbortSignal.timeout(ms)` instead of adding `node-fetch`.

## Ops / Compliance

- Auth user creation plus Firestore doc creation is two-phase. Use compensating `adminAuth.deleteUser(uid)` on failure.
- Erasure flow: write Firestore state before disabling Auth; guard concurrency with `erasure_active/{uid}`; hard-delete Auth last; sweeps must exclude active erasures and be checkpoint-resumable.
- Dead-letter replay should be sequential, not `Promise.all`.
- Prewarm success means any HTTP response, even 405, because the Cloud Function instance started.
- Use `bq.query()` directly. Add `@google-cloud/logging` as an explicit dependency when triggers use Cloud Logging, and lazy-load it in scheduled handlers to avoid emulator protobuf crashes.
- Smoke checks need explicit bucket config and per-check timeouts.
