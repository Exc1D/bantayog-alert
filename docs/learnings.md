# Learnings - Durable Rules

## UX / Dashboard Design

- For an operational EOC dashboard, every KPI needs three context layers: target/threshold, temporal comparison, and trend indicator. A bare number ("Active Now: 1") is technically correct and operationally useless. The most common dashboard failure mode in the literature is the "so what?" problem.
- A wall-mounted command display without a map is not a Common Operating Picture. Geography is non-negotiable for disaster response. Either embed a map on the dashboard or surface a compact municipality heat strip that deep-links to the full map.
- Operational dashboards (vs. analytical) should pre-attentively encode health at the top of the page. Pulsing mode badge + threshold-based color dots in `StatusCenter` are the right call for dim command rooms with 6-10 ft viewing distance.
- Mode-driven layout (calm / active / degraded / surge) that hides charts and municipal tables when in surge is correct. An operator under load does not want a less-urgent chart; they want a less-cluttered view.
- Confirmation modals for destructive actions are non-negotiable (unpublish, reject, re-dispatch, declare alert). The pattern of "show count + reason + note before fire" for bulk reject is best-in-class for an admin workbench.
- `isRetryableActionError` (separating retryable network errors from non-retryable permission/validation errors) is the right abstraction. Do not let "click again" become a habit on errors that won't fix themselves.
- Hard mobile blocks are wrong for command-and-control products. Field staff and off-site coordinators need a read-only status fallback. Replace `MobileGate` with a degraded mobile surface before pilot.
- For the data-freshness heartbeat, use a stable "vs 1h ago" delta or a sparkline, not a per-render trend arrow. The current `DispatchStatsCards` trend arrow flickers as data refreshes and never persists long enough to be useful.
- A pulsing mode badge looks like a 1990s alert. It is correct. In a dim room with a 6-10 ft viewing distance, peripheral-vision pulse on degraded/surge is the cheapest "this is not calm anymore" signal available.
- Cross-window `WindowSyncProvider` is the right pattern for multi-monitor command centers. Team SA (shared situational awareness across operators) is the documented design goal; do not collapse the multi-window model into a single SPA.
- "Command authority" over the other apps is measured by what the admin can do in 1 click from the watch floor, not by what the backend supports. If 17 of 26 callables are unwired, the admin app is not a command tool, it is a moderation tool. Audit `callables.ts` invocations vs definitions before claiming command surface.
- Dead components (built, tested, never mounted) are the most expensive form of decoration. They signal inspection-grade capability that does not exist, and they bloat the cognitive surface. Either wire them in or delete them.
- The Responder panel must show more than name + online dot. The hook already returns `agencyId`, `municipalityId`, current dispatch, current location, TOTP status; the panel discards all of it. A name with no jurisdiction context is not a roster.
- "1-click inspection" must mean a drawer / peek / overlay, not a page navigation. Page navigation breaks flow, loses the dashboard state, and adds 2-3 s of reload. If clicking requires leaving the page, the loop is broken.
- A 6-10 ft wall display without a map on the dashboard is a wall-mounted KPI sheet, not a Common Operating Picture. Either embed the map or surface a compact geography strip that anchors the room.
- KPI cards without target / trend / status chip are not KPIs. They are unlabeled numbers. Always pair a value with what good looks like (target), where it is going (trend), and whether to act (status chip).

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
- Citizen own-report tracking must be a citizen-safe derived view of `MyReport` status fields until a projection exists; terminal states such as rejected/cancelled/merged need explicit outcomes so the UI does not imply a responder is still pending.
- Phase 1 first dispatch belongs on `/dispatches` as an assignment queue, not only inside the map detail panel; reuse scoped report reads, responder fleet data, and `dispatchResponder` before adding a new assignment backend.
- For Firestore rules subset verification, prefer `firebase emulators:exec --only firestore 'npx vitest run src/__tests__/rules'`; the quoted `src/__tests__/rules/**/*.rules.test.ts` glob can be treated as a Vitest filter and find no files.
- Demo reset scripts must delete only fixed known seed document paths and must be guarded by `FIRESTORE_EMULATOR_HOST`; never implement a broad demo collection wipe or remote reset shortcut.
- Triage filters should apply before table selection and must clear hidden selections on change, so bulk verify/reject actions cannot affect rows the operator no longer sees.
- Phase 1 triage rejection can reuse the existing backend reason enum; keep `insufficient_detail` as the default, and let operators choose the enum before single or bulk rejection rather than adding free text prematurely.
- Basic incident export should be visible-row CSV from the operator workbench and must omit reporter/contact/private fields; compliance-grade audit export remains a separate backend/BigQuery concern.
- Stale/offline messaging should distinguish listener errors from stale-but-visible data; keep errors in `OfflineBanner`, and show stale queue age separately so operators know they may be looking at cached data.

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

- PR #212 hotline hardening: shared callable schemas should normalize and validate at the boundary. Use `.trim()` on labels/hotlines, require a real digit count for hotlines after regex validation, and store the parsed/normalized value. Punctuation-only strings such as `(((((((` and `+------` pass broad phone regexes unless digit-count refinement is added. The Admin UI should reuse `mdrrmoLabelSchema.maxLength` and show the exact digit-count failure as `Enter a valid phone number, for example (054) 721-1216`, not a raw max-length message.

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
- `suspendStaffAccount` must update Firebase Auth custom claims because existing ID tokens can live for an hour. Responder suspend/revoke has the same requirement: keep `role: 'responder'` and set `accountStatus` to `suspended` or `revoked` immediately after the Firestore status change, preserving agency/municipality scope and `lastClaimIssuedAt`.
- `declareAlert` needs rate limiting and enum validation; `declareDataIncident.affectedCollections` needs an allowlist.
- Accepted risks: `report_lookup` is world-readable only while it contains anonymous tracking refs and no PII; rate-limit contention and municipality-boundary iteration are bounded; no VPC Service Controls is mitigated by Rules, IAM, App Check, and webhook HMAC.

## Citizen PWA / Offline

- Citizen-visible data needs backend-enforced visibility. Alerts and situation posts carry `visibility`; Citizen queries only read public docs; admin moderation goes through audited callables.
- Citizen-facing delete copy for disaster reports must mean audit-preserving withdrawal, not hard delete. Keep report/private/contact/lookup records and move the public lifecycle to internal/cancelled with an explicit withdrawal reason.
- Situation updates are not emergency reports. Keep them separate, short, pseudonymous, public-read, no update/delete, and moderatable.
- Situation updates need `municipalityId`; labels are display-only.
- Ethical retention uses situational awareness and lifecycle competence, not streaks, leaderboards, popularity, or pressure to submit.
- Track from localForage before `report_lookup` materializes; snapshots upgrade automatically.
- Filter invalid stored reports individually; do not discard the whole array because one stale item exists.
- Keep in-progress wizard state separate from finalized drafts awaiting submission.
- Do not persist `File`/`Blob` at per-keystroke cadence. Gate snapshot saves on `hasLoadedSnapshot`.
- Normalize incident-type aliases at the draft boundary.
- Phase 1 Citizen report triage fields must stay aligned across wizard snapshot, local draft, callable payload, shared validator schema, and `report_ops`; changing only the visible form recreates blind admin intake.
- Background Sync is Chromium-only; iOS needs an in-app retry path. Service workers cannot use Firebase JS SDK; use Firestore REST with a valid ID token from IndexedDB auth state.
- Cold offline boot needs a precached app shell and cached `index.html` for failed navigations.
- Canvas `toBlob('image/jpeg', quality)` is the reliable cross-browser compression path.
- `React.lazy()` components fail offline. Eager-import offline states.
- Citizen report history has four visible states: loading, genuinely empty, stale-but-visible, and failed. If Firestore and callable lookup both fail, surface the failure with retry and keep cached rows visible instead of falling through to "No reports yet."
- Citizen map interpretive copy must be truth-gated. Hide situational headlines while alert, incident, own-report, offline, or error states are unresolved so "calm" never means "still loading" or "failed to refresh."

## Dispatch / Responder / Monitor

- Single-dispatch escalation mutates `assignedTo`, increments `escalationCount`, and appends the old responder to `previouslyNotifiedResponderUids`.
- Dispatch docs must satisfy schema and rules: `dispatchedByRole`, `statusUpdatedAt`, `idempotencyKey`, `municipalityId`, and omitted optional fields instead of `undefined`/`null`.
- Responder accept must support both claim eras via `isAccountActive()`.
- Seeded reports used in proof need matching `report_ops` and `dispatches` docs.
- Admin responder presence must use the freshest activity timestamp available (`lastSeenAt`, `lastTelemetryAt`, or availability `updatedAt`). Availability changes can be newer than telemetry, and using only `lastSeenAt` makes a just-available responder look Away.
- Admin map triage controls must mirror backend report transitions; visible no-op command-center actions are P0 UX defects.
- Admin dashboard widgets must end in an operator action. Report lifecycle counts should expose the next valid backend transition or deep-link to the Map/Feed surface that owns it.
- Dashboard report commands should stay narrow: advance `new` to review, verify `awaiting_verify`, deep-link verified reports to Map dispatch, and leave rejection or scrubbed publication to Feed.
- Phase 1 Admin triage belongs on its own `/triage` workbench. Dashboard can summarize, but row-level review needs report summaries, command callables, and Map routing for verified dispatch instead of hiding the flow inside metrics cards.
- Admin new-report awareness should ride the existing scoped report listener snapshots. Do not add a shell-level Firestore subscription just to drive badges, title updates, or audio.
- Do not subscribe Admin Map to RTDB `responder_locations` parent reads. Rules deny that path; use scoped Firestore responder roster data unless a scoped child GPS listener is explicitly implemented.
- Dispatch candidates and roster management are different datasets. A roster workbench must include unavailable, off-duty, suspended, and revoked responders; filter to active/available only at the dispatch-selection boundary.
- Mode/state precedence: actionable states such as surge win over data-quality states such as degraded.
- Lease monitors with `monitorLeaseAt` plus expiry, and add circuit breakers for oversized query results.
- The deployed `dispatchResponder` requires the responder to be on shift in RTDB (`/responder_index/{municipalityId}/{uid}.isOnShift === true`); the seeded `responders/{uid}.isActive` alone is not enough. `staging:seed` does not seed shift state, so any staging callable proof must set the shift in RTDB before dispatching, then clear it on cleanup. This is the main drift between the deployed loop and the emulator `proof:mvp-loop`.
- Responder push permission failures must be visible in-app. For web, treat `Notification.permission === 'denied'` as browser-settings-only recovery, and show a retry action only for `default` after token registration failed or was skipped.

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
- Passing tests with noisy stderr are not clean. Wrap async hook tails, fake timer advancement, and synthetic event/message delivery in `act(...)`; wiring tests should mock unrelated polling hooks so they do not probe offline emulators.
- App-level Citizen smoke tests must stub `fetch` because `useOnlineStatus()` probes `/__/firebase.json`; otherwise a passing render test can still print localhost `ECONNREFUSED` noise.
- Test harness gotchas: `vi.hoisted()` creates hoisted mocks; wrap `waitFor(() => expect(...))` bodies in braces; render auth-dependent setup inside `AuthProvider`; `startAfter(docSnapshot)` requires the order field; fake timers pair better with `fireEvent` than `userEvent`; avoid `waitFor` under fake timers unless the test advances timers; mock dashboard data must avoid empty-state short-circuiting; define and restore `window.confirm`; prefer `const noop = (): void => { return }`.
- React hooks must be called in the exact same order on every render. An early return before a `useState`/`useEffect` causes "Rendered fewer hooks than expected" in React 19. Move guards after all hooks; use derived `if` after the hook block.
- `apps/admin-desktop/src/app/firebase.ts` runs `export const auth = getAuth(firebaseApp)` eagerly at module load, so it throws `auth/invalid-api-key` in the test env (no `VITE_FIREBASE_API_KEY`). Any admin-desktop test that imports `../app/firebase` — directly or transitively, e.g. through `CommandHeader` → `EditHotlineModal` → `db` — crashes at import unless it `vi.mock('../app/firebase', () => ({ db: {} }))`. The six full-suite files that fail this way (`MapPage`, `MapPage.ux-completeness`, `dashboard-firestore-wiring`, `dashboard-redispatch`, `map-firestore-wiring`, `services/callables`) are pre-existing failures, not regressions; prove it with a stash-based baseline run before chasing it.
- Retry affordances for commands launched inside focus-trapped dialogs must remain inside that dialog's focus trap; do not put retry controls in an external banner while the dialog stays open.
- Bulk command error banners must clear prior single-command retry state before rendering, otherwise a stale retry button can replay an unrelated command.
- Treat permission-denied listener errors as the same user-facing state across spelling variants (`unauthorized`, `permission-denied`, `permission_denied`, `denied`) so operators do not see raw error text or retry controls.
- Use narrow `// fallow-ignore-next-line complexity` directives only as a last resort for inherited page-scale complexity after targeted extraction; keep the gate focused on new duplication/complexity.

## React / TypeScript

- Admin triage rejection notes already belong on `rejectReport.notes`; do not create a separate notes write path for the basic Phase 1 review note. Trim notes, omit blank optional keys, and respect the 500-character backend limit.
- Admin dispatch monitors must include responder field progress statuses (`acknowledged`, `en_route`, `on_scene`) in lifecycle reads; otherwise operators see pending/escalation state but miss live responder movement.
- Per-municipality hotline edits go through an Admin SDK callable (`updateMunicipalityContact`), not Firestore rules: the SDK bypasses rules, so the `municipal_admin` (own-municipality) / `provincial_superadmin` (any) gate lives in the callable and **zero `firestore.rules` changes** are needed. Config sets are last-write-wins, so no `idempotencyKey`. Audit via `streamAuditEvent({ eventType: 'municipality_contact_updated' })`, not `moderation_incidents` (that is content-moderation semantics).
- For a modal that prefills from a one-shot `getDoc` keyed on a selection, put the fetch in a **keyed child** (`<Editor key={selectedId} />`) whose single effect writes state only inside `.then`/`.catch`. This satisfies `react-hooks/set-state-in-effect` (which flags synchronous effect-body `setState`, not async-callback writes) and resets cleanly on selection change without a parent `useEffect` clearing several `useState`s.
- Admin dispatch SLA displays must use the backend's canonical `acknowledgementDeadlineAt`; mapping only `deadlineAt` drops live deadline visibility because dispatch Functions do not write that alias.
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
- For oversized modal refactors, extract pure policy first (defaults, validation, payload builders) and prove it with focused tests before moving JSX or caller workflows.
- When extracting nested alertdialogs, preserve role/name, disabled/loading states, and backdrop behavior; shared modal reuse is only safe when those contracts already match.
- React effect lint treats direct registration helpers that can set state as effect-body state writes. Schedule app-shell registration work through async callbacks, and derive initial permission warnings outside the effect body.
- For report-keyed prompt state, prefer a keyed child component over resetting several `useState` values from a parent `useEffect`; `react-hooks/set-state-in-effect` treats synchronous effect resets as cascading renders.
- Citizen FCM token tests live at `apps/citizen-pwa/src/hooks/__tests__/useFcmToken.test.tsx`; older slice text may mention `src/hooks/useFcmToken.test.ts`.
- Citizen MapTab has no URL-driven report selection contract yet. For notification tap-through, preserve `reportId` in the URL/query or payload, but do not assume MapTab will focus it until a later UI slice consumes that state.

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

- Architecture-alignment passes before Phase 0/1 should document the MVP core
  loop, deferred modules, and future boundaries before moving files or changing
  runtime behavior. Keep ADRs practical and do not mix documentation alignment
  with folder migration, rules rewrites, or Cloud Functions rewrites.
- Phase 0 documentation requests can overlap with existing alignment docs. Check
  requested filenames before adding new docs so the repo does not end up with
  duplicate ADR numbers or two competing checklists.
- New Postgres/PostGIS migration work needs its own Stage 1 plan before SQL files exist; do not create `infra/postgres/migrations/*` until the full schema/RLS diff is shown and approved.
- Postgres public reads need projection tables, not operational tables with polite column names. Keep `bantayog_public_read` on `public_*` tables only, and use explicit grants so privacy records are not exposed through broad `all tables` privileges.
- In the PostGIS incident core, nullable `incident_id` is not a safe way to model general operational state. Keep incident-lifecycle rows incident-scoped, and put general responder availability on `responder_locations.status`.
- Greenfield boundary contracts should precede risky migration work: define incident lifecycle links, grouped command route params, Ops app surfaces, PostGIS store references, and public projection events before touching live Functions exports, database migrations, RLS, or app merges.
- Greenfield Incident/PostGIS work starts at shared contracts: keep operational status, verification status, and publication status as separate axes, and project citizen map/feed data through a strict public read model that rejects reporter identity fields.
- Retiring a feature means removing the full surface together: Function export, frontend callable wrapper, validator/type contract, rules/indexes, direct tests, runbooks, and monitoring. Leaving one layer behind creates accidental-revival or incident-response risk.
- Do not remove command-channel Firestore rules just because the manual message callable is retired. Report sharing and agency assistance still create command-channel records, so the storage read rules remain part of live coordination.
- Vite 8/Rolldown expects `manualChunks` as a function.
- Shared packages need app runtime deps as `peerDependencies`.
- Remove stale `lib/*.js`, `.d.ts`, and maps after renames.
- `pnpm --filter` from a worktree can resolve against the main repo. Prefer direct commands inside the package/worktree.
- Worktrees can carry a stale `node_modules` without `.bin/`, so `pnpm exec <tool>` fails with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`. Run `pnpm install --frozen-lockfile` in the worktree before trusting verification commands.
- Organize by business domain over technical layer. Use `git mv`, update `index.ts` incrementally, and do not mix package extraction with directory reorg.
- CLI tools invoked by CI scripts, such as `esbuild`, must be root devDependencies, not transitive dependencies.
- Firebase emulator lists in CI must include every emulator required by the rules tests, including Storage when configured.
- Terraform BigQuery `default_table_expiration_ms` must be at least `3600000`.
- Dependabot lockfile conflicts often need a consolidated lockfile regeneration after one PR lands.
- Node 20 has global `fetch`; use `AbortSignal.timeout(ms)` instead of adding `node-fetch`.
- Keep Fallow focused on source-of-truth files: ignore generated `functions/lib` and declaration-only `lib` outputs when package entry points use `src`, but fix live source/test imports and delete retired scripts instead of suppressing them.
- When Fallow flags near-identical Playwright audit specs, keep the variant with authentication/setup hardening and delete the weaker duplicate instead of extracting a shared helper around stale coverage.
- For Fallow health cleanup, prefer extracting named render sections and hooks over adding suppressions; then use `fallow audit --base HEAD` to make sure touched files did not retain new complexity findings.
- PR #208 follow-up: when changed-code Fallow flags newly introduced render complexity, split the render tree into small same-file components and re-run `fallow audit --base main --gate new-only` until `introducedComplexity` and `introducedDuplication` are both zero.
- Fallow in CI must be a changed-code regression gate (`audit --gate new-only` on PRs), never a full-repo `--fail-on-issues` gate: inherited duplication/complexity debt would fail every PR for debt it did not add. The official `fallow-rs/fallow@v2` action needs `fetch-depth: 0` to diff against the PR base ref.
- Fallow treats ~930 files in this repo as plugin-derived entry points (962 total in audit vs 77 from `fallow list --entry-points`), so unused-export detection inside app `src/` is effectively disabled — probed exports trace as `is_entry_point: true`. Do not read `dead-code: 0` as proof of no unused exports; the audit gate still catches introduced complexity, duplication, dependency, and circular-dependency findings.
- Canonical province geography belongs with `@bantayog/shared-validators` municipality constants. Do not recreate app-local barangay arrays or revive `shared-sms-parser` for non-SMS data sharing.
- When removing a workspace package, remove live imports, manifest entries, lockfile references, lint-baseline rows, source, tests, and generated `lib` output together; then rebuild any package whose `exports` still point at `lib`.

## Ops / Compliance

- Auth user creation plus Firestore doc creation is two-phase. Use compensating `adminAuth.deleteUser(uid)` on failure.
- Erasure flow: write Firestore state before disabling Auth; guard concurrency with `erasure_active/{uid}`; hard-delete Auth last; sweeps must exclude active erasures and be checkpoint-resumable.
- Dead-letter replay should be sequential, not `Promise.all`.
- Prewarm success means any HTTP response, even 405, because the Cloud Function instance started.
- Use `bq.query()` directly. Add `@google-cloud/logging` as an explicit dependency when triggers use Cloud Logging, and lazy-load it in scheduled handlers to avoid emulator protobuf crashes.
- Smoke checks need explicit bucket config and per-check timeouts.
- `@firebase/rules-unit-testing` 5.x peer-depends on `firebase` 12.x, but the compat RTDB `.database()` / `.clearDatabase()` APIs silently require `@firebase/database-compat` to be installed. If it is missing, RTDB tests in both `rules-unit-testing` harnesses and unit-test helpers throw `TypeError: this.getApp(...).database is not a function` at test setup time. Add `-D @firebase/database-compat` in `functions/` whenever `@firebase/rules-unit-testing` is used with the RTDB emulator.
- Avoid collection-time `itif(available)` for emulator-guarded Vitest files when `available` is set in `beforeAll`; it registers real tests as skipped before the guard runs. Register `it(...)` normally and call the test-context `skip(...)` inside the body after checking the initialized env.
- Dispatch command idempotency tests should count `dispatch_events` by `type` when a command intentionally writes multiple event records. A total collection count can hide stale assumptions once emulator-guarded tests start executing for real.
- Dispatch notification side effects belong inside the `withIdempotency` operation result. If they run after a cached result returns, replayed commands can double-send push notifications and duplicate `notification_attempted` events.
- Phase 3 exit proof should assert notification evidence by event `type` and prove the browser-visible loop through live routes, not by total collection size or unit-only copy checks. That keeps the proof honest when new notification states land.
- Dispatch assignment tests that seed reports without explicit severity get `severityDerived: medium`, which maps to a 15-minute acknowledgement deadline. Use explicit `high` or `critical` severity when asserting the 5-minute SLA.
- Domain cores exercised through `@firebase/rules-unit-testing` use a client Firestore object even when cast to Admin types. Prefer concrete transaction updates over Admin `FieldValue` transforms in these cores when the value is already available from the transaction snapshot.
- Fresh worktrees can install dependencies but still lack package `lib/*.map` outputs. Build the workspace package that Vitest imports, such as `packages/shared-validators`, before treating source-map warnings as unrelated noise.
- Function tests import `@bantayog/shared-validators` through package exports (`lib/index.js`), not live `src`; after adding validator exports, rebuild the package before running emulator tests or the new schema can be `undefined` at runtime.
- A focused emulator run can still report success while executing zero tests if a legacy file uses collection-time `itif(available)`. Convert those files to runtime `skip(...)` before trusting red/green results.
- Callable retry wrappers must generate idempotency keys before entering `withRetry`; generating inside the retry closure gives each attempt a fresh key and can defeat idempotency.
