# Learnings - Durable Rules

## UX / Metrics Display

- Widening a stat-card prop `number`→`number | null`: guard derived bool flags (e.g. `isFcmHigh`) with strict `!== null` — a falsy `!fcmPercent` treats genuine `0` as unknown. Use `String(value) + '%'` not a template literal under `@typescript-eslint/restrict-template-expressions`.
- Test assertions over `getAllByRole('status')`: use `el.textContent.includes(...)` (direct, no optional chain, no `??`) — ESLint treats `HTMLElement.textContent` as non-nullable in test code.

## UX / Dashboard Design

- Un-polled metrics display `—` (em dash), not `0`/`0%`; a `?? 0` default reads as a real zero/outage on first paint. Use `?? null` for the display path and guard the render with a null check.
- FCM success-rate has two defaults that must NOT be unified: `getStatusFcmSuccessRate ?? null` (display = "not yet known") vs `getModeFcmSuccessRate ?? 1.0` (mode input — a missing metric must not false-trip degraded mode).
- Surface metrics-poll errors in the always-visible StatusBar row, not the collapsible section; a silent failure is as harmful as a fabricated value.
- Every KPI needs target/threshold + temporal comparison + trend + a status chip. A bare number ("Active Now: 1") is the "so what?" failure; without those it is an unlabeled number.
- A wall display without a map is not a Common Operating Picture; embed a map or a compact municipality heat strip that deep-links to the full map.
- Pre-attentively encode health at the top (pulsing mode badge + threshold color dots in `StatusCenter`) for dim 6-10 ft command rooms. The pulse looks 1990s but is the cheapest peripheral "not calm anymore" signal.
- Mode-driven layout (calm/active/degraded/surge) hiding charts/tables under surge is correct: an operator under load wants less clutter, not a less-urgent chart.
- Confirmation modals for destructive actions (unpublish/reject/re-dispatch/declare) are non-negotiable; "show count + reason + note before fire" is best-in-class for bulk reject.
- `isRetryableActionError` (retryable network vs non-retryable permission/validation) is the right abstraction; don't let "click again" become a habit on errors that won't self-fix.
- Hard mobile blocks are wrong for C2 products; replace `MobileGate` with a read-only degraded mobile surface before pilot.
- Data-freshness heartbeat: use a stable "vs 1h ago" delta or sparkline, not a per-render trend arrow (it flickers and never persists).
- Cross-window `WindowSyncProvider` is right for multi-monitor command centers (shared situational awareness); don't collapse to a single SPA.
- "Command authority" = what the admin can do in 1 click, not what the backend supports. 17/26 unwired callables = a moderation tool, not a command tool. Audit `callables.ts` invocations vs definitions.
- Dead components (built, tested, never mounted) are the most expensive decoration; wire them in or delete them.
- The Responder panel must show jurisdiction context (`agencyId`, `municipalityId`, current dispatch/location, TOTP), not just name + online dot.
- "1-click inspection" means a drawer/peek/overlay, not page navigation (which breaks flow and adds 2-3 s reload).

## Reliability / Demo Spine

- `pnpm dev` must start the canonical local stack (emulators, Firebase web env defaults, seeded demo accounts). `pnpm dev:apps` is for deliberate frontend-only work.
- Proof fixtures must match the normal dev seed: Daet submissions need `municipalities/daet`; demo responders need `agencyId: bfp-daet`, `accountStatus`, `lastSeenAt`, and RTDB roster/location metadata. Account-only seeding still needs responder roster data in Firestore + RTDB for manual dispatch.
- Rebuild Functions before trusting emulator output — the emulator loads `functions/lib/`, not `src/`; stale builds are the fastest path to fake `FirebaseError: internal`.
- `firestore.rules` and `firestore.rules.template` must stay in sync; template-only edits do not deploy.
- `pnpm dev:all` must fail loudly until Auth, Firestore, and RTDB accept real connections; a listening port is not enough.
- Keep one Firebase project ID through emulator startup, Vite env, Functions registration, proof, and seed scripts — drift makes healthy data look missing.
- Local untracked `.env` files can hide missing `VITE_FIREBASE_*` keys; dev-all should provide emulator-safe defaults for CI/demos.
- Full-loop proof: warm Vite routes, open explicit login routes before auth, dismiss admin onboarding at the protected click point, use longer first-load timeouts on clean CI runners.
- Responder GPS denial during dispatch detail is recoverable: `console.warn`, show fallback copy, and cover mobile reduced-motion/offline/overflow in demo proof.
- Zombie emulator Java processes block ports — clear them when binding gets weird. Functions deps must match `engines.node` before accepting bumps.
- App Check emulator mismatch: when `VITE_USE_EMULATOR=true`, `createAppCheck` MUST use `CustomProvider` with a dummy token. `ReCaptchaV3Provider` against an emulator project = 400 cascade (AppCheck/auth/Functions all fail). citizen-pwa uses `@bantayog/shared-firebase`, which was missing this branch.
- React Strict Mode double-invokes mount effects; hooks with mount side-effects (e.g. `useGpsLocation(autoAttemptOnMount)`) need a `useRef` guard or users get duplicate GPS prompts.
- App Check error codes use the `appCheck/` prefix, not `auth/`; retry logic that only checks `auth/` burns retries on unrecoverable App Check throttling.
- Citizen own-report tracking must be a citizen-safe derived view of `MyReport` status until a projection exists; terminal states (rejected/cancelled/merged) need explicit outcomes so the UI never implies a responder is still pending.
- Phase 1 first dispatch belongs on `/dispatches` as an assignment queue (reuse scoped report reads, responder fleet, `dispatchResponder`), not only in the map detail panel.
- Firestore rules subset verification: prefer `firebase emulators:exec --only firestore 'npx vitest run src/__tests__/rules'`; a quoted `**/*.rules.test.ts` glob is treated as a Vitest filter and finds no files.
- Demo reset scripts delete only fixed known seed paths, guarded by `FIRESTORE_EMULATOR_HOST`; never a broad collection wipe or remote reset.
- Triage filters apply before table selection and must clear hidden selections on change, so bulk actions can't hit rows the operator no longer sees.
- Phase 1 triage rejection reuses the existing backend reason enum (default `insufficient_detail`); let operators pick before single/bulk rejection rather than adding free text.
- Basic incident export = visible-row CSV from the workbench, omitting reporter/contact/private fields; compliance-grade audit export is a separate backend/BigQuery concern.
- Stale/offline messaging: keep listener errors in `OfflineBanner`; show stale-but-visible queue age separately so operators know they may be looking at cached data.

## Firestore / Rules / Data Access

- In transactions, do all reads before the first write; fetch optional data up front.
- Prefer stable error codes over message matching.
- RTDB rules cannot reference Firestore, and parent `.read` overrides child `$uid` scoping — avoid parent-level wildcard reads.
- Seed fixtures through `env.withSecurityRulesDisabled()`, not unauthenticated contexts, when `create` is `false`.
- `report_inbox` / `situation_updates` create paths are anonymous-friendly but must still require `request.auth != null` and `accountStatus == 'active'` — `isAuthed()` is too strict.
- `secret_lookup` reads must verify `report_private/{reportId}.reporterUid == request.auth.uid`. `system_config` must never be world-readable.
- `canReadReportDoc` cannot read `data.reportId`; pass the path variable explicitly.
- `reports` queries by `municipalityId`; `reports` has singular `agencyId`, `report_ops` has `agencyIds`.
- Hidden/multi-municipality alerts need query-provable projections (`municipalityScope.<id> == true`); `array-contains` alone can't prove rules access. Rules fixtures for production-projected docs must preserve intentionally omitted optional fields (e.g. multi-municipality alerts without scalar `municipalityId`).
- Admin SDK Timestamps are rejected by JS SDK rules-unit-testing writes — use millis.
- Chronological public feeds need server ordering + approved indexes: `where('visibility')` + `orderBy('createdAt','desc')` + `limit()`.
- Firestore `in` queries cap at 10 values — chunk municipality IDs.

## Security / Privacy / Abuse

- Don't promote `scripts/check-secrets.sh` into CI until it excludes generated `dist`/mobile artifacts and nested worktrees and uses `grep -e` for `-`-leading patterns; the current scan trips on built bundles and the private-key pattern itself.
- GitHub Dependency Review requires the repo Dependency Graph setting; with it disabled, `actions/dependency-review-action@v4` fails. Keep the local `pnpm audit --audit-level high --prod` gate until enabled deliberately.
- Shared callable schemas normalize/validate at the boundary: `.trim()` labels/hotlines, require a real digit count after regex (punctuation like `(((((((` passes broad phone regexes), store the parsed value. Admin UI reuses `mdrrmoLabelSchema.maxLength` and shows the digit-count failure as `Enter a valid phone number, for example (054) 721-1216`.
- Auth guards must check active accounts, not just roles: `requireAuth` enforces `accountStatus === 'active'`; handlers without it do the same manually.
- Fail explicitly on missing auth/scope — no permissive fallbacks, no raw `err.message` in public/anonymous callable responses.
- Use `shouldEnforceAppCheck()`, not `NODE_ENV === 'production'`.
- Verify FCM token ownership before topic subscribe/unsubscribe. Idempotency result persistence must be atomic. SMS delivery webhooks need HMAC verification.
- MFA bypass requires explicit config (`ALLOW_MFA_BYPASS=true`); staff MFA audits inspect `multiFactor.enrolledFactors`, not only custom claims.
- PII belongs in `sessionStorage`/server storage, not long-lived `localStorage`.
- Signed upload URLs: short TTL, `pending/{uid}/{uploadId}` path, MIME + size validation before hashing.
- CORS origins must be environment-aware; localhost only when `FUNCTIONS_EMULATOR=true`.
- `suspendStaffAccount` (and responder suspend/revoke) must update Firebase Auth custom claims — ID tokens live ~1 hr. Keep `role`, set `accountStatus` to `suspended`/`revoked` immediately after the Firestore change, preserving agency/municipality scope and `lastClaimIssuedAt`.
- `declareAlert` needs rate limiting + enum validation; `declareDataIncident.affectedCollections` needs an allowlist.
- Accepted risks: `report_lookup` world-readable only while it holds anonymous tracking refs and no PII; rate-limit contention and municipality-boundary iteration are bounded; no VPC-SC mitigated by Rules/IAM/App Check/webhook HMAC.

## Citizen PWA / Offline

- Citizen-visible data needs backend-enforced visibility: alerts and situation posts carry `visibility`; citizen queries read only public docs; moderation goes through audited callables.
- Citizen-facing delete copy means audit-preserving withdrawal, not hard delete: keep report/private/contact/lookup records, move the public lifecycle to internal/cancelled with a withdrawal reason.
- Situation updates ≠ emergency reports: separate, short, pseudonymous, public-read, no update/delete, moderatable, need `municipalityId` (labels are display-only).
- Ethical retention uses situational awareness and lifecycle competence — no streaks, leaderboards, popularity, or pressure to submit.
- Track from localForage before `report_lookup` materializes; snapshots upgrade automatically. Filter invalid stored reports individually — don't discard the whole array for one stale item.
- Keep in-progress wizard state separate from finalized drafts awaiting submission. Don't persist `File`/`Blob` per-keystroke; gate snapshot saves on `hasLoadedSnapshot`. Normalize incident-type aliases at the draft boundary.
- Phase 1 triage fields must stay aligned across wizard snapshot, local draft, callable payload, shared validator schema, and `report_ops`; changing only the visible form recreates blind admin intake.
- Background Sync is Chromium-only; iOS needs an in-app retry path. Service workers can't use the Firebase JS SDK — use Firestore REST with an ID token from IndexedDB auth state.
- Cold offline boot needs a precached app shell and cached `index.html` for failed navigations. `React.lazy()` fails offline — eager-import offline states. Canvas `toBlob('image/jpeg', quality)` is the reliable cross-browser compression path.
- Citizen report history has four visible states: loading, genuinely empty, stale-but-visible, failed. If Firestore + callable lookup both fail, surface the failure with retry and keep cached rows — don't fall through to "No reports yet."
- Truth-gate citizen map interpretive copy: hide situational headlines while alert/incident/own-report/offline/error states are unresolved so "calm" never means "still loading" or "failed to refresh."
- Public incident validation must be single-source across list and detail reads (shared guard) so bad public docs are filtered consistently.

## Dispatch / Responder / Monitor

- Single-dispatch escalation mutates `assignedTo`, increments `escalationCount`, appends the old responder to `previouslyNotifiedResponderUids`.
- Dispatch docs must satisfy schema + rules: `dispatchedByRole`, `statusUpdatedAt`, `idempotencyKey`, `municipalityId`, and omitted optional fields (not `undefined`/`null`). Seeded proof reports need matching `report_ops` and `dispatches` docs.
- Responder accept must support both claim eras via `isAccountActive()`.
- Admin responder presence uses the freshest activity timestamp (`lastSeenAt`, `lastTelemetryAt`, or availability `updatedAt`); availability can be newer than telemetry, so `lastSeenAt`-only makes a just-available responder look Away.
- Admin map triage controls must mirror backend transitions — visible no-op command-center actions are P0 defects. Dashboard widgets must end in an operator action (next valid transition or deep-link to the owning Map/Feed surface).
- Dashboard report commands stay narrow: advance `new`→review, verify `awaiting_verify`, deep-link verified to Map dispatch; leave rejection/scrubbed publication to Feed. Row-level review belongs on its own `/triage` workbench.
- Admin new-report awareness rides existing scoped report listener snapshots — don't add a shell-level Firestore subscription for badges/title/audio.
- Don't subscribe Admin Map to RTDB `responder_locations` parent reads (rules deny it); use scoped Firestore roster data unless a scoped child GPS listener is explicitly built.
- Dispatch candidates ≠ roster: a roster workbench includes unavailable/off-duty/suspended/revoked responders; filter to active/available only at the dispatch-selection boundary.
- Mode/state precedence: actionable states (surge) win over data-quality states (degraded).
- Lease monitors with `monitorLeaseAt` + expiry; circuit-break oversized query results.
- Admin dispatch lifecycle reads must include field-progress statuses (`acknowledged`, `en_route`, `on_scene`) or operators miss live movement. SLA displays use the canonical `acknowledgementDeadlineAt`, not a `deadlineAt` alias dispatch Functions don't write.
- Deployed `dispatchResponder` requires the responder on shift in RTDB (`/responder_index/{municipalityId}/{uid}.isOnShift === true`); `responders/{uid}.isActive` alone is not enough, and `staging:seed` doesn't seed shift state. This is the main drift from the emulator `proof:mvp-loop`.
- Responder push permission failures must be visible in-app: treat `Notification.permission === 'denied'` as browser-settings-only recovery; show a retry only for `default` after token registration failed/was skipped.

## Testing

- Red test before behavior changes; prove it exercises the changed path.
- Emulator availability gates must settle before Vitest registers tests — use top-level await/static env, not `beforeAll`, for `itif(available)`. Collection-time `itif(available)` with `beforeAll` registers real tests as skipped; register `it(...)` normally and call test-context `skip(...)` in the body. A focused run can report success while executing zero tests if a legacy file does this.
- `createTestEnv()` needs Firestore + Database + Storage emulators when the config includes all three. Never mix Admin SDK and Client SDK Firestore calls in one rules-test context.
- Keep Citizen PWA Playwright specs under `e2e-tests/specs/` unless `testDir` changes. Playwright labels are fuzzy — use `{ exact: true }` for overlapping ones (e.g. `Municipality`). Reduced-motion evidence: `page.emulateMedia({ reducedMotion: 'reduce' })` + assert `matchMedia`. Pre-auth readiness hits explicit login routes; protected roots linger on auth spinners. E2E fresh checkouts must build workspace `lib` before Vite (`needs: build` doesn't carry artifacts).
- For offline evidence without emulators, assert visible queued/recovery state; backend replay needs a separate emulator test.
- Callable tests assert runtime client codes (`not-found`), not internal enum names.
- Passing tests with noisy stderr aren't clean: wrap async hook tails, fake-timer advancement, and synthetic event delivery in `act(...)`; wiring tests mock unrelated polling hooks. App-level Citizen smoke tests must stub `fetch` (`useOnlineStatus()` probes `/__/firebase.json`).
- Test-harness gotchas: `vi.hoisted()` for hoisted mocks; brace `waitFor(() => expect(...))` bodies; render auth-dependent setup inside `AuthProvider`; `startAfter(docSnapshot)` needs the order field; fake timers pair with `fireEvent` not `userEvent`; avoid `waitFor` under fake timers unless advancing them; mock dashboard data must avoid empty-state short-circuiting; define+restore `window.confirm`; prefer `const noop = (): void => { return }`.
- React hooks must keep call order: an early return before a `useState`/`useEffect` causes "Rendered fewer hooks than expected" in React 19. Move guards after the hook block.
- `apps/admin-desktop/src/app/firebase.ts` runs `getAuth(firebaseApp)` eagerly, so it throws `auth/invalid-api-key` in tests. Any admin-desktop test importing `../app/firebase` (directly or via `CommandHeader`→`EditHotlineModal`→`db`) must `vi.mock('../app/firebase', () => ({ db: {} }))`. The six full-suite files that fail this way (`MapPage`, `MapPage.ux-completeness`, `dashboard-firestore-wiring`, `dashboard-redispatch`, `map-firestore-wiring`, `services/callables`) are pre-existing — prove it with a stash baseline before chasing.
- Retry affordances for commands launched inside focus-trapped dialogs stay inside that trap, not in an external banner while the dialog is open. Bulk error banners must clear prior single-command retry state, else a stale button replays an unrelated command.
- Treat permission-denied listener errors as one user-facing state across spelling variants (`unauthorized`, `permission-denied`, `permission_denied`, `denied`).
- Use narrow `// fallow-ignore-next-line complexity` only as a last resort for inherited page-scale complexity after targeted extraction.

## React / TypeScript

- Admin triage rejection notes belong on `rejectReport.notes` — don't create a separate notes write path; trim, omit blank optional keys, respect the 500-char backend limit. Runtime-enforce that limit (don't rely on the textarea).
- Per-municipality hotline edits go through an Admin SDK callable (`updateMunicipalityContact`), not rules: the SDK bypasses rules, so the `municipal_admin` (own-municipality) / `provincial_superadmin` (any) gate lives in the callable — zero `firestore.rules` changes. Last-write-wins, so no `idempotencyKey`. Audit via `streamAuditEvent({ eventType: 'municipality_contact_updated' })`, not `moderation_incidents`.
- For a modal prefilling from a one-shot `getDoc` keyed on a selection, put the fetch in a keyed child (`<Editor key={selectedId} />`) whose single effect writes state only inside `.then`/`.catch` — satisfies `react-hooks/set-state-in-effect` (which flags synchronous effect-body `setState`) and resets cleanly on selection change. Prefer this keyed-child pattern over a parent `useEffect` resetting several `useState`s.
- Narrow role claims with `typeof` before subscribing; on unauthorized, set an error and return early. Async auth/state gates need active flags + uid checks in both success and failure paths.
- Avoid object/array refs in effect deps — derive stable primitive keys. Render-body ref assignment can loop; sync refs in effects. Live Firestore join pages must wait for secondary doc fetches before asserting rendered rows.
- React Router v7 `useNavigate` returns `Promise<void>` — `void` or `await`.
- `position: sticky` breaks when `overflow-x: auto` forces `overflow-y: auto`.
- With `exactOptionalPropertyTypes`, omit optional keys instead of assigning `undefined`. `noUncheckedIndexedAccess` makes indexed access `T | undefined` — guard or assert. Use `catch (err: unknown)` and narrow; avoid `any`, `@ts-ignore`, `_`-prefixed unused catch vars. Type assertions are expected at callable boundaries where `req.auth.token` enters typed interfaces.
- Schema union changes (e.g. `dispatchStatusSchema`) require downstream rebuilds.
- For oversized modal refactors, extract pure policy first (defaults, validation, payload builders) and prove it with focused tests before moving JSX/callers. When extracting nested alertdialogs, preserve role/name, disabled/loading states, and backdrop behavior; shared modal reuse is only safe when those contracts match.
- React effect lint treats direct registration helpers that can set state as effect-body writes — schedule app-shell registration through async callbacks and derive initial permission warnings outside the effect.
- Re-verify review comments after resolving base conflicts (PR #228 inherited a comment on a TriagePanel reject modal the mainline merge had already removed — fix the surviving boundary risk, don't resurrect stale UI).
- Citizen FCM token tests live at `apps/citizen-pwa/src/hooks/__tests__/useFcmToken.test.tsx` (older slice text says `.test.ts`). Citizen MapTab has no URL-driven report selection yet — preserve `reportId` in URL/payload for tap-through but don't assume MapTab focuses it until a later slice consumes it.

## UX / A11y

- Don't conditionally remove action regions — reads as silent failure. Truth-gate derived live fields: make uncertain data optional with a clear fallback.
- Centralize severity + hazard colors; distinguish hazard types on both icon badges and chips. Enforce adaptive density (cards for small lists, compact rows for high-volume).
- Modal forms use real `<form>` submit semantics and focus the dialog container on open. `useFocusTrap` must check visibility, not only disabled state.
- Reduced-motion CSS targets the animated element, not universal selectors. Skip links need offscreen absolute positioning + a visible high-z focus state. Skeletons need `aria-hidden="true"` plus a visible loading heading. `backdrop-blur` is banned by PRODUCT.md.
- Use a resize-aware hook for viewport state; module-level `window.innerWidth` goes stale.
- `WindowSyncProvider` drops self-echoes via UUID dedup (`sendSync` records the id before posting) and `BroadcastChannel` never delivers to the same window, so a `suppressNextBroadcast` flag is dead scaffolding (set but never readable; a stale `true` would wrongly suppress a real broadcast). Remove set-but-never-read sync flags (YAGNI). For excess-property store fields, `tsc --noEmit` is the authoritative gate — Vitest strips types via esbuild, so a removed Zustand field only fails under `tsc` (which also forces the matching `setState` test-literal edits).

## Cross-window Sync / Validation

- `WindowSyncProvider` must validate the full `WindowSyncMessage` shape at every ingress (`id`, `reportId`/`municipalityId`, `source`, action value), not a type-only `type` guard. Storage-fallback payloads parse `data` and `timestamp` as `unknown`, validate both before dedupe, then forward. Red-first coverage includes malformed BroadcastChannel and storage payloads asserting subscribers aren't called.
- `vi.mock` factories are hoisted and can't reference imports at the top level; use an async factory with dynamic `await import(...)` inside (`vi.mock('../providers/WindowSyncProvider', async () => { const { createWindowSyncProviderModuleMock } = await import('../test-utils'); return createWindowSyncProviderModuleMock() })`) to avoid `Cannot access '__vi_import_X__' before initialization`. To assert on mock methods, use `vi.hoisted(() => ({ sendSync: vi.fn(), subscribe: vi.fn() }))` inline in the test file.

## Build / Monorepo / Infra

- Architecture-alignment passes before Phase 0/1 document the MVP loop, deferred modules, and future boundaries before moving files or changing runtime; keep ADRs practical, don't mix doc alignment with folder migration/rules/Functions rewrites. Check requested filenames first to avoid duplicate ADR numbers/checklists.
- New Postgres/PostGIS migration work needs its own Stage 1 plan before SQL exists; don't create `infra/postgres/migrations/*` until the full schema/RLS diff is approved. Postgres public reads need projection tables (`bantayog_public_read` on `public_*` only, explicit grants), not operational tables with polite column names. Nullable `incident_id` is not safe for general operational state — keep lifecycle rows incident-scoped, put availability on `responder_locations.status`.
- Greenfield boundary contracts precede risky migration: define incident lifecycle links, grouped command route params, Ops app surfaces, PostGIS store refs, and public projection events before touching live Functions exports, migrations, RLS, or app merges. Keep operational/verification/publication status as separate axes; project citizen map/feed through a strict public read model that rejects reporter identity fields.
- Retiring a feature removes the full surface together (Function export, frontend wrapper, validator/type, rules/indexes, tests, runbooks, monitoring) — leaving one layer behind risks accidental revival. But don't remove command-channel Firestore rules just because the manual message callable is retired: report sharing and agency assistance still create command-channel records.
- Vite 8/Rolldown expects `manualChunks` as a function. Shared packages need app runtime deps as `peerDependencies`. Remove stale `lib/*.js`/`.d.ts`/maps after renames. Organize by business domain over technical layer (`git mv`, update `index.ts` incrementally, don't mix package extraction with directory reorg).
- `pnpm --filter` from a worktree can resolve against the main repo — prefer direct commands inside the package/worktree. Worktrees can carry a stale `node_modules` without `.bin/` (`pnpm exec` fails `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`) — run `pnpm install --frozen-lockfile` first. Fresh worktrees can install deps but lack package `lib/*.map` — build the package Vitest imports before treating source-map warnings as noise.
- CLI tools invoked by CI scripts (e.g. `esbuild`) must be root devDependencies, not transitive. Markdown progress entries need a blank line between top-level sections or `pnpm format:check` fails. Firebase emulator lists in CI must include every emulator the rules tests need (incl. Storage). Terraform BigQuery `default_table_expiration_ms` ≥ `3600000`. Node 20 has global `fetch` — use `AbortSignal.timeout(ms)`, don't add `node-fetch`. Dependabot lockfile conflicts often need a consolidated regeneration after one PR lands.
- Keep Fallow on source-of-truth files: ignore generated `functions/lib` and declaration-only `lib` when entry points use `src`, but fix live source/test imports and delete retired scripts instead of suppressing. For near-identical Playwright audit specs, keep the auth/setup-hardened variant and delete the weaker duplicate. Prefer extracting named render sections/hooks over suppressions; re-run `fallow audit --base main --gate new-only` until `introducedComplexity`/`introducedDuplication` are zero.
- Fallow in CI is a changed-code regression gate (`audit --gate new-only` on PRs), never full-repo `--fail-on-issues` (inherited debt would fail every PR); `fallow-rs/fallow@v2` needs `fetch-depth: 0`. Fallow treats ~930 files here as plugin-derived entry points, so unused-export detection inside app `src/` is effectively disabled — don't read `dead-code: 0` as proof of no unused exports.
- Canonical province geography belongs with `@bantayog/shared-validators` municipality constants — don't recreate app-local barangay arrays or revive `shared-sms-parser` for non-SMS data. When removing a workspace package, remove live imports, manifest/lockfile entries, lint-baseline rows, source, tests, and `lib` output together, then rebuild any package whose `exports` point at `lib`.

## Ops / Compliance

- Auth user + Firestore doc creation is two-phase — use compensating `adminAuth.deleteUser(uid)` on failure.
- Erasure: write Firestore state before disabling Auth; guard concurrency with `erasure_active/{uid}`; hard-delete Auth last; sweeps exclude active erasures and are checkpoint-resumable.
- Dead-letter replay is sequential, not `Promise.all`. Prewarm success = any HTTP response (even 405) because the instance started. Smoke checks need explicit bucket config + per-check timeouts.
- Use `bq.query()` directly. Add `@google-cloud/logging` explicitly when triggers use Cloud Logging, and lazy-load it in scheduled handlers to avoid emulator protobuf crashes.
- `@firebase/rules-unit-testing` 5.x peer-depends on `firebase` 12.x, but compat RTDB `.database()`/`.clearDatabase()` silently need `@firebase/database-compat` installed, else RTDB tests throw `TypeError: this.getApp(...).database is not a function` at setup. Add `-D @firebase/database-compat` in `functions/` whenever using `@firebase/rules-unit-testing` with the RTDB emulator.
- Count `dispatch_events` by `type` (not total) when a command writes multiple event records, else stale assumptions hide once tests run for real. Dispatch notification side effects belong inside the `withIdempotency` operation result — running them after a cached result returns double-sends pushes and duplicates `notification_attempted`. Phase 3 exit proof asserts notification evidence by event `type` and proves the browser loop through live routes, not by collection size or unit copy checks.
- Tests seeding reports without explicit severity get `severityDerived: medium` (15-min deadline) — use explicit `high`/`critical` when asserting the 5-min SLA.
- Domain cores exercised through `@firebase/rules-unit-testing` use a client Firestore object even when cast to Admin types — prefer concrete transaction updates over Admin `FieldValue` transforms when the value is already in the snapshot.
- Function tests import `@bantayog/shared-validators` via package exports (`lib/index.js`), not live `src` — rebuild the package after adding exports or the new schema is `undefined` at runtime.
- Callable retry wrappers must generate idempotency keys before entering `withRetry`; generating inside the closure gives each attempt a fresh key and defeats idempotency.

## Citizen PWA Status Vocabulary

- The CPWA task text names `AlertsTab` as the hazard-category source, but that surface has severity filters only. Build the shared hazard registry from the union of `incident-meta.tsx` `INCIDENT_TYPES` and `situation-updates.ts` `SITUATION_HAZARD_TYPES`; do not silently drop categories unique to either public surface.

## Citizen PWA Route Migration

- Once `/` becomes Home, audit navigation intent instead of globally replacing paths. Home-return callers stay on `/`; Map-intent callers (`ReportStatusPill`, lookup result state, Profile report cards, and Map state cleanup) move only in their owning CPWA slices.
- A generic import insertion patch on the new `HomeTab` matched the file tail and placed imports after the component. The required post-edit reread caught it before typecheck; anchor new imports against the first declaration, not an empty hunk.

## Citizen PWA Home Data

- CPWA Home slices should consume alert/report snapshots through the shell-owned `HomeDataProvider`; calling `useAlerts` or `useMyActiveReports` again inside Home modules adds duplicate live subscriptions.
- React Compiler purity flags `Date.now()` in render defaults. Capture a stable timestamp through a lazy state initializer or pass it as an explicit prop; keep presentational components deterministic.
- App route wiring tests that mount `CitizenShell` must mock shell-owned live hooks (`useAlerts`, `useMyActiveReports`, offline queue/read-state hooks) and `wizardSnapshot`; mocked splash completion should call back from `useEffect`, not a free microtask, or React 19 emits `act(...)` noise and route assertions can turn order-sensitive.
- CPWA Nearby distance bands should use only an already-known citizen/report coordinate plus public incident coordinates. If Home has no known coordinate, render an empty state; do not prompt geolocation or fabricate distance in the secondary stack.
- CPWA Weather currently has no Citizen PWA backing source. Keep the Home slot truth-gated as unavailable until a real weather endpoint/client lands.
