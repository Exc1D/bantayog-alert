# Progress

## 2026-06-06 - Declare Alert Modal Policy Extraction

- Started the targeted refactor pass with the oversized Admin Desktop `DeclareAlertModal`: extracted pure form policy for default sectors, validation, and callable payload construction into `declare-alert-form.ts` without changing the modal UI or page callers.
- Verification: red-first helper test failed on the missing module, then the helper/modal focused tests, Admin Desktop typecheck, and Admin Desktop lint passed.

## 2026-06-05 - Simplicity Audit + Dashboard Command Queue Completion

- Ran the first no-code simplicity audit pass: package consolidation is still a standalone refactor candidate, but the highest-confidence simplification was the admin Dashboard workflow gap, not deleting packages.
- Completed the Dashboard report command queue against existing callables and surfaces: new reports can be sent to review, reviewed reports can be verified, verified reports deep-link to `/map?reportId=...`, rejection stays Feed-owned, and responder assignment stays Map-owned.
- Fixed the browser-discovered Admin Map permission banner by removing the denied RTDB `responder_locations` parent listener; Map dispatch now uses the scoped Firestore responder roster.
- Verification: red-first Dashboard ops and listener tests failed on the missing queue / denied RTDB parent listener, then passed with `dashboard-redispatch`; Admin Desktop lint/typecheck, root lint/typecheck/test, and live Citizen/Admin/Responder browser smoke pass.
- Cleaned up the Admin Desktop full-suite warning noise: async hook tests now settle updates inside `act(...)`, cross-window message delivery is wrapped in `act(...)`, and the dashboard Firestore wiring test no longer mounts real ops metrics against the Functions emulator.

## 2026-06-05 - Admin Responder Presence Correction

- Fixed the admin roster status mismatch where a responder who had just set themselves Available could still appear Away because Admin Desktop derived presence only from stale `lastSeenAt`.
- Admin roster mapping now uses the freshest known activity timestamp across `lastSeenAt`, `lastTelemetryAt`, and availability `updatedAt`, preserving the existing active/available query and role scoping.
- Verification: red-first `useResponderFleet` regression now covers stale telemetry plus fresh availability update, and the focused Admin Desktop hook test passes.

## 2026-06-04 - Emulator Report Submission Fix

- Diagnosed and fixed three interlocking issues breaking report submission in `pnpm dev:all` emulator mode:
  1. **App Check 400 cascade**: `packages/shared-firebase/src/app.ts` unconditionally used `ReCaptchaV3Provider`; against the emulator this always 400, throttling auth + function calls. Added `isEmulator` param and `CustomProvider` with dummy token when `VITE_USE_EMULATOR=true`.
  2. **GPS double-invocation**: `useGpsLocation(autoAttemptOnMount)` lacked a ref guard, so React Strict Mode invoked it twice, causing duplicate console errors and apparent "screen refreshed three times". Added `hasAutoAttemptedRef` guard + regression test with `StrictMode` wrapper.
  3. **appCheck/ not treated as non-retryable**: `isNonRetryableError` only checked `auth/` prefix, so App Check throttling consumed all 3 retries before giving up. Extended to also catch `appCheck/` errors.
- Verified: all 451 citizen-pwa tests pass, typecheck and lint pass across the monorepo.

## 2026-06-04 - Admin Desktop Report Flow Browser Proof

- Ran `pnpm dev:all` against a clean local emulator stack and walked the live report loop: Citizen PWA manual fire report -> Admin Feed moderation/publish -> Admin Map verified dispatch -> Dispatch Monitor active row -> Citizen active-report status.
- Fixed a live Admin Map blocker where `useFirestoreListeners` subscribed to the denied RTDB `responder_locations` parent path; map dispatch now relies on the scoped Firestore responder roster and no longer shows the false permission banner.
- Corrected Admin Feed wording from public feed preview to public map preview after browser proof showed Citizen Feed is the separate situation-update surface, while emergency reports publish to the citizen map/status flow.

## 2026-06-04 - Admin Desktop Feed / Dispatch Operational Pass

- Reframed the Feed tab as a Public Information Desk without changing the backend moderation path: raw reports, scrubbed publication, official alerts, citizen posts, and public preview now read as citizen-facing information work instead of generic feed cards.
- Turned the Dispatch responder list into a roster workbench: scoped responder reads now include unavailable/off-duty/suspended roster entries, agency admins can add responders through `createResponder`, and selected responders can be marked available/off-duty/unavailable through `bulkAvailabilityOverride`.
- Verification: red-first focused tests now cover full-scope roster reads, roster metadata, first-responder add from an empty roster, bulk availability override, agency-admin gating, and Feed public-information copy.

## 2026-06-04 - Admin Desktop Dashboard Command Queue

- Started the admin-desktop functionality refactor by turning the Dashboard from a read-only metrics wall into an operational report command surface.
- Added a Report command queue for `new` and `awaiting_verify` reports: new reports can be sent to review, awaiting reports can be verified for dispatch, and every queued report can open the Map with `reportId` selected for the existing dispatch flow.
- Verification: red-first focused Dashboard test now covers queue rendering, `verifyReport` calls for both lifecycle states, and Map navigation.

## 2026-06-04 - Local Demo Spine Repaired

- Fixed the real `pnpm dev` demo path, not just the proof fixture. Normal dev seed now creates `municipalities/daet` and active BFP responder roster fields (`agencyId: bfp-daet`, `accountStatus`, `lastSeenAt`) so Citizen manual-Daet reports materialize for Admin Map dispatch.
- Aligned `seedLocalProofAccounts()` with normal dev seed shape and added a dev-seed Playwright regression for Citizen submission -> Admin `/map` marker dispatch -> Responder accept without proof reseeding.
- Root `pnpm dev` now launches `scripts/dev-all.mjs`; frontend-only work remains available as `pnpm dev:apps`.
- Verification: dev-seed port/unit guard, focused map-dispatch Playwright, `pnpm proof:local`, lint, and typecheck pass.

## 2026-06-03 - Investor Demo / Proof Hardening

- Prepared the manual three-app investor flow for `pnpm dev:all`: seeded canonical citizen, municipal admin, superadmin, and BFP responder accounts; added responder roster metadata without workflow records; and removed emulator startup hangs from Functions registration, Cloud Logging protobuf init, and manual inbox processing.
- Hardened Declare Alert without changing the visual system: public-alert framing, municipality scope guidance, selected-municipality feedback, final `Declare public alert?` confirmation, loading/failure copy, and proof-helper updates.
- Reliability proof now selects the exact admin report row, dismisses onboarding at the protected click point, verifies citizen/responder alert visibility, responder dispatch progression, Feed hide/restore, idempotent replay, and report status mirroring.
- Responder dispatch demo UX proof now covers GPS-denial recovery, notification tap routing, mobile `390x844`, reduced motion, offline-after-load stability, no horizontal overflow, readable timeline hint, and pre-arrival fallback copy.
- Verification included focused modal regression, admin lint/typecheck, e2e TypeScript, live local alert persistence, and `pnpm proof:local` checkpoints C00-C10.

## 2026-06-03 - PR #168 / CI Proof Follow-Up

- Made `dev:all` inject emulator-safe Firebase web env defaults so CI does not depend on untracked app `.env` files.
- Aligned dev/proof project IDs, normalized seeded responder agency ID to `bfp-daet`, projected alert municipality scope with query-provable maps, deduped Declare Alert municipality input, hardened CLI cleanup, and added a regression guard in `scripts/dev-all.ports.test.ts`.
- `proof:local` now builds shared app packages in fresh checkouts, warms Vite routes before C00, opens explicit admin/responder login routes, and mirrors production multi-municipality alert fixtures by omitting scalar `municipalityId`.

## 2026-06-02 - CI Green Main + Dependency Batch

- Fixed main CI blockers: formatting/eslint drift, Terraform BigQuery `default_table_expiration_ms`, missing Storage emulator in Functions rules CI, missing root `esbuild`, `firebase` CLI resolution in dev-all, emulator list-query fragility, and empty custom claims in active-account rules tests.
- Merged dependabot PRs #160-#166; skipped #167 per instruction.
- Follow-up at the time: E2E Full-Loop Proof still needed verification for `pnpm dlx firebase-tools` in the prepare-functions-deploy -> dev-all chain.

## 2026-06-02 - Security / Governance Audit

- Fixed P0 secret logging in `request-lookup.ts`.
- Hardened rules for `report_inbox`, `situation_updates`, and `secret_lookup`; added reporter-only `secret_lookup` coverage and kept rules/template parity except the known transition-table template placeholder.
- Investigated TypeScript 6.0.3 alias/RC, shared micro-package consolidation, and shared-validator test volume; no immediate change except deferring package consolidation to a standalone refactor.
- Added Admin Desktop `StrictMode`.
- Verification: Admin Desktop lint/typecheck, Functions lint, and targeted rules/template diff review passed.

## 2026-06-02 to 2026-05-29 - Citizen PWA Public Content

- Hardened Situation Feed with freshness/retry, offline draft preservation, privacy/moderation copy, missing-field guidance, municipality-specific empty state, and server-ordered latest-100 public query backed by `situation_updates(visibility, createdAt desc)`.
- Replaced stale Citizen PWA Playwright coverage with deterministic report review, offline queue recovery, GPS denial fallback, empty lookup validation, reduced motion, skip navigation, touch target, and overflow evidence.
- Added backend-enforced visibility and admin moderation for citizen situation posts and official alerts, while preserving report publication as the Citizen Map/report visibility path.
- Verification: focused Feed/hook/service tests, Firestore rules emulator tests, full Citizen PWA suite, Citizen PWA lint/typecheck/build, e2e TypeScript, and focused Chromium evidence passed.

## 2026-05-28 - Citizen Engagement UX

- Feed became a separate community situation loop with composer, municipality filters, post cards, Community Pulse counts, moderation reporting, and `situation_updates`; emergency reporting stayed separate.
- Profile gamification was reframed around real lifecycle impact: `Impact Path`, compact completion cues, next-step guidance, and copy focused on reporting skill instead of badge chasing.

## 2026-05-28 to 2026-05-26 - Responder App UX

- Dispatches tab: added compact `DispatchRow`, adaptive list density, removed single-dispatch auto-navigation, added resume banner, removed meaningless active-progress ring, added live freshness heartbeat, and cleaned navigation/CSS issues.
- Alerts tab: added hazard-specific color coding, freshness indicator, capped stale time labels, and removed anti-reference punctuation.
- Profile tab: flattened secondary cards, converted availability to a segmented control, removed dead streak data, clarified metrics copy, and removed responder-to-responder handoff while preserving municipality-level handoff.
- Dispatch detail hardening added retry, offline indicator, textarea limits/counters, reduced-motion SOS behavior, and related tests.

## 2026-05-25 to 2026-05-22 - Dashboard / Emulator Reliability

- Dashboard redesign review fixed 14 issues, including mode/state precedence, Tailwind JIT class purging, PR decomposition, debounce asymmetry, timer cleanup, and affected-geography derivation.
- RTDB/emulator hardening fixed parent `.read`, zombie emulator detection, anonymous auth lifecycle, and runtime dependency checks.
- Admin surfacing/report flow E2E verified Citizen PWA -> emulator inbox -> materialization -> Admin Triage Queue, then fixed protobuf, schema, centroid, `.env.local`, feed moderation, unpublish, and inbox reconciliation issues.

## 2026-05-14 to 2026-05-21 - Staging / Security / Responder Core

- Deployed responder staging with production-build guard, shell cleanup, municipality rules, PWA icons, and seeded account bootstrap.
- Addressed 36 security findings: active-account checks, idempotency atomicity, MFA bypass controls, signed URL TTL, App Check enforcement, FCM rate limits, and anonymous submission rules.
- Functions reached 885 passing tests; Admin Desktop superadmin gating landed.
- Responder PWA rebuild delivered shell, login, dispatch list/detail, messages, map, and profile.

## 2026-05-02 to 2026-05-12 - Foundation Hardening

- Admin Desktop reset consolidated severity/brand tokens, role-scoped reads, municipal performance truth-gates, hold-to-dispatch keyboard parity, sticky bulk actions, window-sync dedup, and offline banner ordering.
- PR #115 review fixed Zod 4 migration issues, race conditions, modal ARIA/focus, redispatch safety, and auth orphan prevention; follow-up 3-app UI audit covered responder, citizen, and admin accessibility/design fixes.
- Citizen auth/wizard work added resumability, QA fixes, PWA install/offline/backoff/image compression/background sync, cancel report flow, live sync, and UX cleanup.

## Older Completed Phases

| Phase    | Status | Notes                                                                               |
| -------- | ------ | ----------------------------------------------------------------------------------- |
| Phase 9  | DONE   | Citizen PWA redesign: Feed/Profile/Alerts, RevealSheet, auth, registration          |
| Phase 8C | DONE   | Erasure (RA 10173): callables, sweeps, rules, delete-account flow                   |
| Phase 7  | DONE   | Security callables, superadmin UI, analytics dashboard, emergency declaration, TOTP |
| Phase 6  | DONE   | Responder app: native shell, push, telemetry, location, field UX                    |
| Phase 5  | DONE   | Analytics: Cluster C + PRE-C                                                        |
| Phase 3b | DONE   | Admin triage + dispatch code complete                                               |
| Phase 0  | DONE   | Foundation tooling passing                                                          |

Removed in `9f520d99` (2026-05-11): SMS inbound pipeline, NDRRMC escalation, PAGASA hazard signals, Break Glass, mass alert broadcast.

## Open

1. Firebase Console: Phone Auth disabled; App Check 400 errors on staging.
2. Staging redeploy to verify accumulated fixes.
3. Phase 7.C: Staff TOTP enrollment audit.
4. Deferred: four observability dashboards for Phase 11.
