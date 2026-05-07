# Progress

## Current Status (2026-05-07)

**Admin Desktop -- Superadmin Route Gating (2026-05-07)**
Provincial superadmins no longer land on the mock-backed prototype analytics/report shell during normal navigation.

- ✅ Added a provincial-superadmin route gate in `apps/admin-desktop/src/routes.tsx`
- ✅ Legacy prototype URLs now redirect to live pages for this role: `/dashboard` → `/province/dashboard`, `/map` → `/province/map`, `/users` → `/province/users`, `/health` → `/province/system-health`, `/reports` → `/analytics`
- ✅ Retired the remaining prototype-only superadmin entrypoints out of the visible path: `/emergency`, `/ndrrmc`, `/audit`, `/handoff`, and `/settings` now fall back to `/province/dashboard`; `/erasure` now redirects to `/province/users`
- ✅ Removed the non-live TCWS signal placeholder section from `SystemHealthPage`; the page now exposes only real audit/replay controls plus prewarm actions
- ✅ Non-superadmin fallback behavior remains unchanged on those routes
- ✅ Added focused Vitest coverage for all retired/redirected legacy routes and the non-superadmin fallback
- ✅ No fake report-generation backend was introduced; unsupported mock report UI remains out of the normal superadmin path instead of pretending to be real
- **Gate:** `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/prototype-route-redirects.test.tsx` pass, `pnpm --dir apps/admin-desktop typecheck` pass, `pnpm --dir apps/admin-desktop exec eslint src/routes.tsx src/pages/SystemHealthPage.tsx src/__tests__/prototype-route-redirects.test.tsx` pass; full `pnpm --dir apps/admin-desktop lint` still reports 2 pre-existing unrelated warnings in `src/__tests__/triage-queue.test.tsx` and `src/pages/AgencyAssistanceQueuePage.test.tsx`

## Current Status (2026-05-06)

**Responder PWA -- Frontend Rebuild (2026-05-06)**
Full UI layer for the responder PWA on top of the existing dispatch backend. 12 commits on `feature/responder-pwa-frontend`.

- ✅ **Task 1:** Global styles (`src/styles/globals.css`) imports shared-ui theme + responder-app CSS custom properties (navy/surface/tab-bar tokens). PWA manifest at `/manifest.json`; viewport theme-color flipped to `#001e40`; Inter loaded from Google Fonts.
- ✅ **Task 2:** `Shell` wraps tab pages with persistent navy header + bottom 4-tab nav (Dispatches/Map/Messages/Profile); pending-dispatch badge on the Dispatches tab. `SosHoldButton` requires a 3-second pointer hold before navigating to `/dispatches/{id}/sos`; releasing early cancels.
- ✅ **Task 3:** Routes restructured. Tab routes (`/`, `/map`, `/messages`, `/messages/:reportId`, `/profile`) wrapped in Shell; detail/secondary routes (`/dispatches/:id`, `/handoff`, `/history`, etc.) sit outside Shell as full-screen pages. Stub pages added for the new routes.
- ✅ **Task 4:** LoginPage redesigned with branded card layout (BANTAYOG ALERT title, "Responder Portal · Camarines Norte" subtitle).
- ✅ **Task 5:** `useReport` hook subscribes to `reports/{id}` and surfaces a typed `ReportSummary`.
- ✅ **Task 6:** DispatchListPage redesigned. Pending dispatches render as amber cards with `AcceptanceCountdown`; active dispatches as green cards with status pills. Availability/handoff/sign-out controls moved to ProfilePage (Task 11) and ShiftHandoffPage (Task 12).
- ✅ **Task 7:** DispatchDetailPage redesigned. Report summary card with severity badge + municipality + barangay + description. State-machine UI (Pending Accept/Decline → acknowledged → en_route → on_scene → resolved) with reason selects for decline and unable-to-complete. Action stack: Backup, Message Admin, Witness Report. New `useAddFieldNote` hook writes to `reports/{id}/field_notes`.
- ✅ **Task 8:** `useMessages` (live subscription) and `useSendMessage` (write with auth + serverTimestamp) hooks.
- ✅ **Task 9:** MessagesPage lists active dispatches as message threads. MessageThreadPage shows bubble UI with mine/theirs split, Enter-to-send, restore-on-failure.
- ✅ **Task 10:** MapPage with `react-leaflet` + OSM tiles. Watches `navigator.geolocation`; shows responder marker + incident pins from `useReport`. Default center is Daet, Camarines Norte. Added `leaflet`, `react-leaflet`, `@types/leaflet` to responder-app deps.
- ✅ **Task 11:** ProfilePage with navy hero card (avatar + name + role + station). `useResponderProfile` and `useDispatchHistory` hooks. Availability section (status dot + label + select + reason guard). Stats grid (Total / Resolved / Completion %). Quick links to History and Handoff. Sign-out button uses `useAuth().signOut`.
- ✅ **Task 12:** ShiftHandoffPage form (target UID + reason, idempotency-key callable). DispatchHistoryPage list. SosPage red full-screen confirm/cancel. CancelledScreen + RaceLossScreen share `TerminalScreen.module.css`. (BackupRequestPage left unchanged — plan's self-review explicitly scoped its restyling out.)
- ✅ **Post-review hardening (2026-05-06):** addressed 2 must-fix Firestore-rule field-name mismatches (`senderUid`→`authorUid`, field_notes responder-create rule), 15 UX/perf concerns (offline Leaflet `L.divIcon` markers, GPS battery pause via `visibilitychange`, one-shot map fly + recenter button, near-bottom scroll guard in message thread, `auth.currentUser.displayName` fallback, severity allowlist, SOS hold keyboard support + timer cleanup), centralized `incident-labels.ts`, richer dispatch list cards with severity/type/location, auto-advance feedback pill, and added 8 new test files covering DispatchDetailPage state machine, MessageThreadPage send/restore, and terminal screens. Restyled BackupRequestPage + ResponderWitnessReportPage for shell parity. Added Vite `manualChunks` for Leaflet/Firebase + shared `vitest.setup.ts`.
- **Gate (Task 13):** vitest 102/102 pass, `pnpm typecheck`, `pnpm lint` clean, `pnpm build` succeeds (chunk-size warnings eliminated by manualChunks).

## Current Status (2026-05-05)

**Admin Desktop -- SMS Audit Page (2026-05-05)**
Final gap from the original 5-point admin-desktop plan — `SmsPage.tsx` now has real content for all three tabs.

- ✅ **Outbox tab:** Table with recipient hash (truncated), purpose, color-coded status badge, segment count, created-at timestamp
- ✅ **Inbox tab:** Table with sender hash (truncated), body preview, color-coded parse-status badge, confidence score, parsed-into report ID
- ✅ **Provider Health tab:** Cards per provider showing circuit-state badge (closed=green, open=red, half_open=amber), error rate %, last transition reason, last probe timestamp
- ✅ Status badge colors follow plan: queued=amber, sending=blue, sent/delivered=green, failed=red, abandoned=gray, parsed=green, low_confidence=amber, unparseable=red
- ✅ `useSmsAudit` hook already existed — no changes needed
- **Gate:** 9/9 sms-page tests pass, 90/90 admin-desktop tests pass, lint clean, typecheck clean

**Admin Desktop -- Phase 4: System Health Controls (2026-05-05)**
Dead-letter replay and prewarm surge callables implemented with full TDD coverage.

- ✅ `replayAuditDeadLetter` callable -- queries `dead_letters` where `category: 'audit_stream'` and `status: 'failed_to_stream'`, replays via `streamAuditEvent()`, marks `streamed` on success, returns count. Superadmin-only.
- ✅ `prewarmSurge` callable -- HTTP GET pings to function endpoints (`verifyReport`, `dispatchResponder`, `closeReport`, etc.) with `light` (3) and `heavy` (10) levels. Counts any response as success (405/404 still warms instance). Superadmin-only, Zod-validated input.
- ✅ `audit-stream.ts` now writes dead letters to Firestore on BigQuery failure -- fire-and-forget, survives dead-letter write failure without throwing
- ✅ `SystemHealthPage.tsx` wired -- dead-letter replay button + light/heavy pre-warm buttons with loading states and result display
- ✅ `callables.ts` frontend wrappers for `replayDeadLetter` and `prewarmSurge`
- **Gate:** functions 17/17 new tests pass, lint clean, typecheck clean; admin-desktop 88/88 tests pass, lint clean, typecheck clean

## Current Status (2026-05-04)

**Citizen PWA -- Cancel Own Report + Draggable Status Pill (2026-05-04)**
Citizens can now cancel their own early-stage reports (`new`, `awaiting_verify`). The `ReportStatusPill` at the bottom of the screen is now a draggable floating widget.

- ✅ `cancelReportByCitizen` callable in functions (hard-deletes report + associated docs, writes `report_events` audit trail, rate-limited)
- ✅ `cancelReport(reportId)` client wrapper in `callables.ts`
- ✅ `deleteReport(publicRef)` in `localForageReports.ts` to clear local cache on cancel
- ✅ Cancel button in `DetailSheet` wired to callable via `onCancelReport` prop chain
- ✅ `ReportStatusPill` now draggable via pointer events (session-only position, clamped to viewport)
- ✅ All 243 vitest tests pass, citizen-pwa typecheck clean

**Citizen PWA -- Report Tracking + Profile Stats Fixes (2026-05-04)**
Three root-cause bugs fixed:

- ✅ TrackingScreen now shows RadarRings + Timeline + reference header while CF is still processing (seeds from localForage instead of bare text banner)
- ✅ `loadReports` nuclear option removed — invalid legacy entries are now filtered individually; one bad entry no longer wipes all stored reports (fixes map pins and profile stats disappearing)
- ✅ `municipalityLabel` now saved to localForage on successful submission (enables "Areas Helped" stat to populate from local data)
- **Gate:** vitest 364/364 pass, `pnpm typecheck`, `pnpm lint` clean
- **Still open:** `useMyActiveReports.baseFromStored` doesn't read `municipalityLabel` from localForage yet — "Areas Helped" still populates only after Firestore subscription resolves

**Citizen PWA -- Report Flow QA Complete (2026-05-04)**
10 QA subagents tested staging PWA. Key findings:

- ✅ MilestoneTracker correctly increments "Report sent" count (1→2 after submissions)
- ✅ Anonymous users see Guardian pitch in ProfileTab (by design)
- ✅ Offline detection works (banner + status message)
- ✅ Milestone counts update correctly per submission
- ✅ MyReportLayer ★ pin appears immediately after submission
- ⚠️ **BUG: Consent checkbox in Step 3 doesn't enable Submit via Chrome DevTools click** -- React onChange may need `dispatchEvent` or checkbox state isn't being set correctly
- ⚠️ **BUG: Medium severity has 3 different colors** across IncidentLayer (#7c3500), MyReportLayer (#a73400), and incident-meta (#d97706)
- ⚠️ **BUG: LOW severity has 2 different colors** -- #414849 vs #334155
- ⚠️ **BUG: Offline submission blocked** -- wizard requires auth which fails when offline
- ❌ RevealSheet lazy loading fails when offline (error boundary instead of queued UI)
- ❌ Detail sheet for myReport mode missing: severity badge, municipality/location
- ❌ Detail sheet for public mode missing: reference code, status

**Phase 7 -- Provincial Superadmin + NDRRMC**
7.A (Security Callables) DONE | 7.B (Superadmin UI) DONE | 7.C (Drill & Verification) IN PROGRESS (TOTP enrollment audit in progress)

**Phase 8C -- RA 10173 Erasure & Anonymization DONE**
All 8 tasks complete. **Production blocker:** Pre-registration SMS data lacks erasure path (needs UID linkage at registration).

**Phase 6 -- Responder App DONE**
All 10 tasks complete. Residual risks: E2E dispatch progression, native push token registration, background geolocation (need physical devices).

---

## Recent Merged Work

### Citizen PWA -- Live Status Sync + Richer Timeline (2026-05-04)

- `useMyActiveReports` now uses live Firestore subscriptions per stored report (`onSnapshot` on `report_lookup/{publicRef}` → `reports/{reportId}`), so the map MyReportLayer pin, Profile tab list, and ReportStatusPill update in real time as the admin advances status (verified, assigned, resolved, rejected, closed). The pill now correctly disappears the moment the report enters a terminal state.
- Permission-denied fallback (covers anonymous→phone-link UID change) keeps the existing `requestLookup` callable wired so a registered user still sees their pre-registration reports.
- `mapReportFromFirestore` synthesizes a multi-step timeline from the per-step timestamp fields callables already write (`verifiedAt`, `assignedAt`, `acknowledgedAt`, `enRouteAt`, `onSceneAt`, `resolvedAt`, `closedAt`, `rejectedAt`, `cancelledAt`, `reopenedAt`), giving the TrackingScreen a real progression instead of just "Report received → current status".
- **Gate:** citizen-pwa vitest 363/363 pass (added 6 new tests across `useMyActiveReports.test.ts` and `mappers.test.ts`), `pnpm lint`, `pnpm typecheck` clean.

### Citizen PWA -- Public Verification Wiring + Live Timeline (2026-05-04)

- Verified reports now flip from `visibilityClass: internal` to `public_alertable` during admin verification, so creators still see fresh submissions immediately while the public Map/Feed sees them only after verification
- Citizen tracking now normalizes Firestore timestamp objects and uses `lastStatusAt` to synthesize the live timeline page/radar status state from real `reports/{id}` docs
- **Gate:** citizen-pwa focused vitest 49/49 pass, `pnpm lint`, `pnpm typecheck`; functions `pnpm typecheck` pass; functions verify-report emulator suite still blocked by pre-existing rules-unit-testing seed issues (Admin `Timestamp` writes / permission-denied harness path), functions lint still has 17 pre-existing warnings

### Citizen PWA — Active Report + Tracking Fixes (2026-05-04)

- Fixed 4 citizen-facing correctness bugs in the report-status flow
- Normalized legacy `public_disturbance` submissions to the supported `security` report type so new reports persist and appear in Map/Profile/pill again
- Tracking page now accepts the real live report doc shape (`publicLocation`, `submittedAt`, no inline `timeline`) and synthesizes a usable citizen timeline view instead of collapsing to the generic processing banner
- Find My Report now normalizes secret-code input and resolves same-device freshly submitted reports from local storage before backend lookup docs exist
- Gate: citizen-pwa focused vitest 43/43 pass, `pnpm lint`, `pnpm typecheck`

### UX Bug Fixes — 10 Issues (2026-05-03)

- **10 issues fixed:** TrackingScreen nav header (back + home), RevealSheet SMS iOS fix, button text → "Create Account", mt-4 spacing, FilterBar z-[800] above Leaflet, municipality chips filter (replaces severity/window), saveReport() wiring so reports appear on map + Profile, bantayog:report-saved event for live refresh, ProfileTab "Check report status" CTA
- **FeedTab** also updated to municipality filter for consistency
- **Gate:** `lint typecheck` clean, vitest 330/330 pass

### QA Findings Sweep (2026-05-03)

- **45 findings addressed:** 7 P0, 8 P1, 10 P2/P3
- Key fixes: RevealSheet nav, CORS/auth on lookup, SW retry backoff, iOS PWA meta tags, push toggle state, GPS auto-start fallback, sign-out button, FilterBar wiring, marker cursors, delete account modal rewrite, contrast fixes, motion-safe guards, Tagalog labels
- **Skipped:** Firestore data population, visual design work, structural refactors, reverse geocoding, nav stack behavior, off-palette token migration
- **Gate:** `lint` 0 errors

### PR #91 Review Follow-ups (2026-05-03)

- Sourcery: SW individual precache failure handling, `aria-hidden` -> spinner + `role="status"`, extracted `phone-session-storage.ts`
- CodeRabbit: Added `.catch()` on wizard load, removed redundant `aria-live`, fixed TTL test false-positive
- **Gate:** `lint typecheck` clean, vitest 243/243 pass

### Auth + Wizard Resumability (2026-05-02)

- RegisterPage a11y (`id`/`name`/`autocomplete`)
- Phone number preserved across login/register via `sessionStorage`
- Step 1 validates report type before advancing
- New `wizard-snapshot` service (localforage, 24h TTL) -- persists step/formData, clears on success
- **Gate:** `lint typecheck` clean, vitest 327/327 pass, build +1 KB

### QA Follow-ups Round 1 (2026-05-02)

- Offline mode: precache root + manifest, cache version bumped
- Settings contrast: `#768081` -> `text-surface-600`, `#a3adae` -> `text-surface-500`
- Settings `<main>` landmark
- Wizard Step 2: hint visible before location method selected
- **Gate:** `lint typecheck` clean, vitest 319/319 pass, build emits 5 precache URLs

### Hardening Sweep (2026-05-02)

All 7 clusters complete:

1. Correctness fixes (PWA install, toggles, RevealSheet, photo validation)
2. Reliability (backoff, error sanitization, FCM rollback)
3. Per-jurisdiction config (municipality schema ext, contact hook)
4. Performance (lazy RevealSheet, dead code deletion)
5. Background sync + image compression
6. Data export backend (GCS signed URLs)

- **New files:** `useMunicipalityContact.ts`, `RevealSheet.lazy.tsx`, `imageCompress.ts` + tests
- **Deleted:** `lib/photoUpload.ts`, `lib/draftManager.ts`, `lib/localforage.ts`
- **Gate:** `lint typecheck vitest` all green (318 tests)

---

## Older Completed Phases

| Phase                             | Status | Notes                                                                                                                                                            |
| --------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 9: Citizen PWA Redesign     | DONE   | 18 tasks -- Feed/Profile/Alerts tabs, RevealSheet, Toggle, Toast, offline banner, auth-aware ProfileTab, RegisterPage, SettingsPage, routes, data export wrapper |
| Phase 8C: RA 10173 Erasure        | DONE   | 8 tasks -- callables, sweeps, rules, delete-account flow                                                                                                         |
| Phase 7.A: Security Callables     | DONE   | 7 callables + Firestore rules                                                                                                                                    |
| Phase 7.B: Superadmin UI          | DONE   | Analytics dashboard, NDRRMC drawer, emergency declaration, break-glass, TOTP enrollment                                                                          |
| Phase 6: Responder App            | DONE   | Native foundation, push, telemetry, location projection, field UX, handoffs                                                                                      |
| Phase 5: Cluster C + PRE-C        | DONE   | Mass alerts, NDRRMC escalation, analytics                                                                                                                        |
| Phase 4b: SMS Inbound Pipeline    | DONE   | Globe Labs webhook, parser, fuzzy barangay matching                                                                                                              |
| Phase 3b: Admin Triage + Dispatch | DONE   | Code complete (staging UI blocked by cert issues)                                                                                                                |
| Phase 0: Foundation               | DONE   | All tooling passing                                                                                                                                              |

---

## Open Blockers & Deferred Items

1. **Production blocker (Phase 8C):** Pre-registration SMS data erasure gap -- needs UID-linkage mechanism
2. **Firebase Console:** Phone Auth disabled; App Check 400 errors on staging
3. **Deploy needed:** Staging redeploy required to verify many code fixes
4. **Phase 7.C:** Staff TOTP enrollment audit in progress
5. **Deferred to Phase 11:** 4 observability dashboards (Ops, Backend, Compliance, Cost)
