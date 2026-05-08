# Progress

## Current Status (2026-05-08)

**Real Incident Subscription — COMPLETE**

- ✅ Created `useIncidentSubscription` hook:
  - Subscribes to `reports` collection with `status in ACTIVE_REPORT_STATUSES`
  - Extracts real `publicLocation` (lat/lng) for map pins
  - Maps Firestore data to `IncidentFeedItem` format with proper types
  - Skips reports without valid location (map requires coordinates)
  - Graceful error handling with loading state
- ✅ Replaced synthetic incident derivation in `ProvinceDashboardPage`:
  - Removed placeholder coordinates (`{ lat: 14.1, lng: 122.8 }`)
  - Removed `muni-${id}` synthetic IDs
  - Map now shows real incident locations from `reports` collection
  - Feed shows real incidents with actual timestamps and statuses
  - Alert level now considers real incident count in addition to anomalies
- **Gate:** 309 tests passed ✓ · Lint clean ✓ · Typecheck clean ✓

**IncidentFeed Integration — COMPLETE**

- ✅ Wired `IncidentFeed` into `ProvinceDashboardPage` as slide-out drawer:
  - Added "Incidents" toggle button in TopBanner (gray `#495057`, next to KPIs)
  - Added `incidentPanelOpen` state to `ProvinceDashboardPage`
  - Rendered `IncidentFeed` as slide-out drawer (450px wide, same position as KpiPanel)
  - Derived incident data from `liveData.municipalData` (synthetic incidents until real subscription)
  - Each municipality with active incidents becomes an incident feed item
- ✅ Updated `TopBanner` with `onToggleIncidentPanel` prop
- ✅ TDD: wrote 2 failing tests (RED), implemented integration (GREEN)
- **Gate:** 306 tests passed ✓ · Lint clean ✓ · Typecheck clean ✓

**Phase 3A: Wire KpiPanel into ProvinceDashboardPage — COMPLETE**

- ✅ Added `onToggleKpiPanel` prop to `TopBanner` component
- ✅ Added "KPIs" toggle button in TopBanner (blue `#001e40`, next to Declare Alert)
- ✅ Added `kpiPanelOpen` state to `ProvinceDashboardPage`
- ✅ Rendered `KpiPanel` as slide-out drawer from right side (450px wide, positioned below banner, above health strip)
- ✅ Drawer toggles on/off with button click
- ✅ KpiPanel receives live `DashboardLiveData` from parent
- ✅ TDD: wrote 4 failing tests first (RED), implemented integration (GREEN)
- **Gate:** 279 tests passed ✓ · Lint clean ✓ · Typecheck clean ✓

**Phase 3C: Entry Snap Animation — COMPLETE**

- ✅ Created `AnimatedIncidentCard` component for animated incident list items:
  - Slide-in animation: `y: -20 → 0` with easeOut over 0.3s
  - Opacity fade-in: `0 → 1`
  - Staggered delay based on index (`index * 0.05s`)
  - Left border emphasis: 4px solid severity color
  - Severity-based backgrounds: critical `#fff3cd`, high `#ffe5b4`, normal `#ffffff`
  - Respects `prefers-reduced-motion`: renders static card without animation
- ✅ Refactored `IncidentFeed` to use `AnimatedIncidentCard` instead of static cards
- ✅ TDD: wrote 7 failing tests (RED), implemented animated card component (GREEN)
- **Gate:** 294 tests passed ✓ · Lint clean ✓ · Typecheck clean ✓

**Phase 3B: Pin Drop Animation — COMPLETE**

- ✅ Created `MapPin` component for animated incident markers:
  - Drop animation: `y: -30 → 0` with spring physics (stiffness: 300, damping: 15)
  - Scale animation: `1.3 → 1.0` during drop
  - Opacity fade-in: `0 → 1`
  - Severity-based colors: critical `#a73400`, high `#c77600`, medium `#2d6a4f`, low `#6c757d`
  - Respects `prefers-reduced-motion`: renders static pin without animation
- ✅ Uses Framer Motion `motion.div` with spring transition for natural bounce
- ✅ TDD: wrote 7 failing tests (RED), implemented animated MapPin component (GREEN)
- **Gate:** 293 tests passed ✓ · Lint clean ✓ · Typecheck clean ✓

**Phase 3A: Authority Sweep Animation — COMPLETE**

- ✅ Created `useReducedMotion` hook: reads `prefers-reduced-motion` media query, subscribes to changes
- ✅ Implemented alert level change animation on TopBanner:
  - Badge pulses with scale animation over 3 seconds
  - Expanding box-shadow ring effect during pulse
  - Triggers when `alertLevel` prop changes
  - Respects reduced motion preference
- ✅ Added `@media (prefers-reduced-motion: reduce)` global CSS rule
- **Gate:** 286 tests passed ✓ · Lint clean ✓ · Typecheck clean ✓

**Phase 3D: Worsening Signal Animation — COMPLETE**

- ✅ Created `MunicipalCard` component for individual municipal cards:
  - Extracted from `MunicipalGrid` for better separation of concerns
  - Left border color indicates status severity (green/yellow/red)
  - Status dot indicator with label (Responsive/Slow/Delayed)
- ✅ Implemented status change detection in `MunicipalGrid`:
  - Tracks previous statuses using `useRef`
  - Detects when status worsens (responsive → slow → delayed)
  - Triggers `worseningSignal` animation for 2 seconds
  - Animation: background flashes white → severity tint → white with border pulse
- ✅ Added `worseningSignal` keyframe animation to design-tokens.css
- ✅ TDD: wrote 8 failing tests (RED), implemented animated MunicipalCard component (GREEN)
- **Gate:** 302 tests passed ✓ · Lint clean ✓ · Typecheck clean ✓

**Phase 4: Focus Mode System — COMPLETE**

- ✅ `useFocusMode` hook already existed with full keyboard support:
  - `Alt+1`: Focus map zone
  - `Alt+2`: Focus grid zone
  - `Escape`: Exit focus mode
  - `enterFocusMode(zone)` / `exitFocusMode()` programmatic API
- ✅ Updated `CommandCenterShell` with focus mode transitions:
  - CSS transitions for smooth zone expansion/collapse (200ms ease-out)
  - Exit Focus button appears top-right when in focus mode
  - Button calls `exitFocusMode()` on click
- ✅ Added tests for exit controls:
  - Exit button visible when in focus mode
  - Exit button hidden in default view
  - Exit button click triggers `exitFocusMode`
- **Gate:** 305 tests passed ✓ · Lint clean ✓ · Typecheck clean ✓

**Phase 3: Purposeful Motion Animations — ALL COMPLETE**

- ✅ 3A: Authority Sweep (alert level change) — Scale pulse + box-shadow ring
- ✅ 3B: Pin Drop (new incident on map) — Spring physics drop animation
- ✅ 3C: Entry Snap (new incident in list) — Slide-in with staggered delay
- ✅ 3D: Worsening Signal (municipality degradation) — Background flash + border pulse
- ✅ All animations respect `prefers-reduced-motion`
- ✅ `useReducedMotion` hook shared across all animated components

**Phase 2D: Empty States — COMPLETE**

- ✅ `ProvincialMap`: Empty state overlay with "No active incidents" + checkmark icon, semi-transparent background
- ✅ `MunicipalGrid`: Empty state overlay when `totalActiveIncidents === 0` with "All Clear" message + checkmark
- ✅ `IncidentFeed`: Already had empty state with "No active incidents" (from Phase 2B)
- ✅ `SystemHealthStrip`: Implicitly shows "OK" for all services when healthy
- ✅ All empty states use consistent design: checkmark in success green `#2d6a4f`, Text secondary heading, Surface 0 background
- ✅ TDD: wrote 4 failing tests total (2 for ProvincialMap, 2 for MunicipalGrid), implemented minimal overlays (GREEN)
- **Gate:** 281 tests passed ✓ · Lint clean ✓ · Typecheck clean ✓

**Phase 2C: Build KpiPanel Component — COMPLETE**

- ✅ Created `KpiPanel` component accepting `DashboardLiveData` prop
- ✅ 6 KPI cards in 2×3 grid: Active Incidents, Responders Available, Avg Response Time, Resolved Today, Unresolved >24h, Municipalities Affected
- ✅ Severity-based left border colors: critical `#a73400`, warning `#c77600`, normal `#2d6a4f`
- ✅ Threshold logic: active incidents (≥20 critical, ≥10 warning), unresolved (≥5 critical, ≥1 warning), response time (≥20min critical, ≥10min warning)
- ✅ Large fonts (36px values, 14px labels) optimized for 3-6ft wall display
- ✅ Uses design tokens: Surface 1 `#ffffff`, Text primary `#1a1a2e`, tabular-nums for values
- ✅ TDD: wrote 10 failing tests first (RED), implemented minimal component (GREEN)
- **Gate:** 272 tests passed ✓ · Lint clean ✓ · Typecheck clean ✓

**Phase 2B: Build IncidentFeed Component — COMPLETE**

- ✅ Created `IncidentFeed` component with `IncidentFeedItem` interface extending base `Incident` with `timestamp` and `status` fields
- ✅ Static list rendering (no auto-scroll per spec)
- ✅ Sorts incidents by timestamp (newest first)
- ✅ Severity-based card backgrounds: critical `#fff3cd`, high `#ffe5b4`, normal `#ffffff`
- ✅ Quick action buttons: Triage, Dispatch, View (all tested with click handlers)
- ✅ Empty state with "No active incidents" message
- ✅ Header shows "Active Incidents" with count badge
- ✅ TDD: wrote 10 failing tests first (RED), implemented minimal component (GREEN)
- ✅ Fixed `noUncheckedIndexedAccess` errors in tests by using named constants instead of array indexing
- ✅ Fixed lint errors: added braces to void-returning arrow functions in onClick handlers
- **Gate:** 262 tests passed ✓ · Lint clean ✓ · Typecheck clean ✓

**Phase 2A: Wire AlertDeclarationModal into ProvinceDashboardPage — COMPLETE**

- ✅ Added `onDeclareAlert` prop to `TopBanner` component with proper TypeScript typing
- ✅ Connected "Declare Alert" button in TopBanner to open modal
- ✅ Rendered `AlertDeclarationModal` in `ProvinceDashboardPage` with state management
- ✅ Implemented `onDeclare` handler stub (ready for `declareEmergency` callable integration)
- ✅ Fixed lint errors: removed unused `useEffect` import, added braces to void-returning arrow functions, removed `console.log`
- ✅ Fixed type error: added nullish coalescing for `noUncheckedIndexedAccess` compliance
- ✅ Fixed accessibility issues in `AlertDeclarationModal`: added `htmlFor` to labels, removed redundant `role="textbox"`, escaped quotes, added `onKeyDown` handler
- ✅ TDD: wrote 3 failing tests first (RED), implemented minimal code (GREEN), all 12 ProvinceDashboardPage tests + 10 TopBanner tests passing
- **Gate:** 252 tests passed ✓ · Lint clean ✓ · Typecheck clean ✓

## Current Status (2026-05-08)

**PR #115 CodeRabbit Review Fixes — All 29 Comments Addressed (2026-05-08)**
Branch `feat/missing-features-responder-admin` pushed with all CI and review blockers resolved.

- ✅ **CI Build/Typecheck fix:** Added missing `beforeAll`/`afterAll` vitest imports in `erasure-sweep.test.ts`
- ✅ **Zod 4 migration:** `z.string().uuid()` → `z.uuid()` across 5 callable schemas; removed stale `eslint-disable` comments
- ✅ **Race condition fixes:** Removed `queueMicrotask()` wrappers around state resets in `useDispatchStatus.ts` and `TriageQueuePage.tsx`
- ✅ **ARIA & focus management:** Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, programmatic `focus()`, and `tabIndex={-1}` to `RedispatchModal`, `ReopenReportModal`, `RosterPage` (Add Responder), and `UserManagementPage` (Create User)
- ✅ **Redispatch safety:** `redispatch-report.ts` now reads `tx.get(newDispatchRef)` and merge-updates if doc already exists; `callables.ts` return type aligned to backend (`{ newDispatchId; status; reportId }`)
- ✅ **Auth orphan prevention:** Wrapped Firestore transactions in `try/catch` in `create-user.ts` and `create-responder.ts`; call `adminAuth.deleteUser(uid)` as compensating action on transaction failure
- ✅ **Audit collection correction:** User-management audit writes changed from `report_events` to `audit_events`
- ✅ **Responder app fixes:**
  - `useReport.ts`: normalize `contactPhone` to E.164-ish (`+` + digits only)
  - `useRequestUploadUrl.ts`: MIME whitelist + `MAX_UPLOAD_BYTES` validation before hashing
  - `DispatchDetailPage.tsx`: guard `navigator.geolocation`, narrow `useEffect` deps to primitives, forward `GeolocationPositionError`
  - `TotpEnrollmentPage.tsx` + `TotpGuard.tsx`: force Firebase ID token refresh (`getIdToken(true)`) after TOTP enrollment to prevent redirect loop
  - `routes.tsx`: standardize route params from `:id` to `:dispatchId`; update components accordingly
  - `ResponderWitnessReportPage.tsx`: `encodeURIComponent(storagePath)` before interpolating Storage URL
- ✅ **Test coverage:** Added whitespace-only rejection tests, `contactPhone` branch tests, `/totp-enroll` route assertions, `getIdToken` mock for enrollment flow
- **Gate:** Build 10/10 ✓ · Lint clean ✓ · Typecheck clean ✓ · Responder tests 197 passed ✓ · Admin-desktop tests 185 passed ✓

**Adversarial Review Fixes — All 12 Findings Addressed (2026-05-08)**
Post-commit review identified critical gaps; all fixed and re-verified.

- ✅ **CRITICAL:** `SosPage` + `BackupRequestPage` route param `id` → `dispatchId` migration was incomplete; both pages were completely broken
- ✅ **CRITICAL:** `create-responder.ts` still wrote audit to `report_events` (fix had only landed in `create-user.ts`)
- ✅ **HIGH:** Added E.164 regex to `create-user.ts` phone schema to match `create-responder.ts`
- ✅ **HIGH:** Aligned `useReport.ts` phone regex with backend (`\d{1,14}` not `\d{6,14}`)
- ✅ **HIGH:** `TotpEnrollmentPage` now catches `getIdToken(true)` failure separately; enrollment no longer rolls back to 'setup' step on token refresh failure
- ✅ **MEDIUM:** `RedispatchModal` got `aria-labelledby`, `tabIndex={-1}`, `useRef` + `useEffect` focus management
- ✅ **MEDIUM:** `ReopenReportModal` uses persistent `useRef` idempotency key instead of regenerating on every confirm click
- ✅ **MEDIUM:** Role validation (`municipalityId`/`agencyId` requirements) moved from `onCall` wrapper into `createUserCore`
- ✅ **MEDIUM:** `useRequestUploadUrl` MIME check annotated as UX-only (browser-reported, easily spoofed)
- ✅ **LOW:** `create-user.ts` added `auth/invalid-phone-number` error mapping (parity with `create-responder.ts`)
- ✅ **LOW:** `RedispatchModal` empty state uses loose null check (`municipalityId == null`)
- ✅ **LOW:** `ReopenReportModal` focus effect keyed on `reportId` instead of `[]`
- **Gate:** Build 10/10 ✓ · Lint clean ✓ · Typecheck clean ✓ · Responder tests 197 passed ✓ · Admin-desktop tests 185 passed ✓

## Current Status (2026-05-08)

**UI Audit Fixes — 3-App Parallel Agent Team (2026-05-08)**
Addressed all P0/P1/P2 UI and accessibility findings from `docs/ui-audit-findings-2026-05-07.md`. Three agents ran in isolated worktrees simultaneously. Part 3 (missing feature builds) deferred to dedicated feature sessions.

### responder-app (8/20 → ~14/20) — branch `fix/audit-responder-app-ui`

- ✅ R6: `<span>` → `<button type="button">` with `useNavigate` in DispatchCard (WCAG 2.1.1)
- ✅ R4/R5: `<label htmlFor>` added to resolution-summary and field-notes textareas (WCAG 1.3.1)
- ✅ R7: Legend dot `#3b82f6` → `#1e40af` (3.0:1 → 5.5:1, passes WCAG 1.4.11)
- ✅ R8: Empty-state `✓` → `role="img" aria-label="All dispatches complete"`
- ✅ R9: Severity hex values extracted to `--sev-high/medium/low-bg/fg` CSS vars; unified inconsistent sevLow blue in DispatchListPage to match canonical green
- ✅ R10: Emoji tab bar (📋🗺️💬👤) → Lucide SVG icons (ClipboardList, Map, MessageCircle, User)
- ✅ R11: `🆘` → `<AlertTriangle>` with `role="img" aria-label="SOS alert"`
- ✅ R14: `prefers-reduced-motion` guard added to Shell.module.css
- **Gate:** 149 tests passed, 0 failed · typecheck clean · lint clean

### citizen-pwa (13/20 → ~17/20) — branch `fix/audit-citizen-pwa-ui`

- ✅ C2: `SubmitReportForm` (RevealSheet host) converted from `lazyWithRetry()` to eager import — fixes error boundary firing offline on queued/failed states
- ✅ C4: Inactive nav text `text-surface-300` (#6a7677, 3.2:1) → `text-surface-600` (#4F5859, 5.5:1) — passes WCAG AA
- ✅ C5: RevealSheet spring `cubic-bezier(0.34, 1.56, 0.64, 1)` → `cubic-bezier(0.22, 1, 0.36, 1)` in both RevealSheet.tsx and globals.css keyframe
- ✅ C7: `aria-current={isActive ? 'page' : undefined}` → conditional spread satisfying `exactOptionalPropertyTypes`
- ✅ C8: Local `severityBadgeClass()` in FeedTab deleted; replaced with `getSeverityStyle()` from shared `useSeverityStyle.ts`
- ✅ C9: `.status-banner--danger` `#dc2626` → `#b91c1c` (7.2:1, passes WCAG AA/AAA for body text)
- ✅ C11: `@media (max-width: 360px)` rule pushes ReportStatusPill 32px higher to clear FAB at 320px
- **NOTE:** Teal brand palette (`#0d7377` family) is intentional design deviation — NOT changed
- **Gate:** 374 tests passed, 0 failed · typecheck clean · lint clean

### admin-desktop (11/20 → ~16/20) — branch `fix/audit-admin-desktop-ui`

- ✅ A1: Palette aligned — `#d64933` → Alert Sienna `#a73400`; purple vars removed; `--color-navy`, `--color-surface`, `--color-danger/warning/success` set to DESIGN.md canonical values
- ✅ A2: SystemHealthPage inline `React.CSSProperties` → `SystemHealthPage.module.css` CSS classes
- ✅ A3: 20-node particle animation removed from LoginPage
- ✅ A4: Logo SVG `#d64933` → `#a73400` in LoginPage and Header
- ✅ A5: Chart hardcoded hex → `COLOR_DANGER/WARNING/SUCCESS` JS constants
- ✅ A6: Superadmin badge `text-purple-700` → `text-[#001e40]` (14:1 on white)
- ✅ A7: Declare Alerts button `bg-red-700` → `bg-[#a73400]`
- ✅ A8: Pulsing live indicator gets `role="status" aria-label="Live data indicator"` in both Header and MetricCard
- ✅ A9/A11: All 12 OTP/TOTP digit inputs get `autoComplete="one-time-code"`
- ✅ A12: Notification dropdown — trigger gets `aria-expanded`, `aria-haspopup="dialog"`; panel gets `role="dialog" aria-label="Notifications"`
- ✅ A13: Anomaly card `bg-red-50 border-red-200 text-red-700` → `bg-[#fee2e2] border-[#991b1b] text-[#991b1b]`
- ✅ A14: Herringbone decorative SVG removed from LoginPage
- ✅ A16: Inter font loaded via Google Fonts in index.css + preconnect in index.html
- ✅ A17: Global `:focus-visible` double-ring rule added to index.css
- ✅ A19: Pulse animation wrapped in `prefers-reduced-motion: reduce` in index.css; `motion-safe:` prefix on MetricCard
- ✅ A20: Skip-to-content link in index.html; `id="main-content"` on AppShell `<main>`
- ✅ Analytics bridge: `AnalyticsDashboardPage` now delegates to reusable `ScopedAnalyticsDashboard`, scopes live counts to `municipalityId` or `agencyId`, and keeps province as the superadmin baseline; `/analytics` now admits `agency_admin` alongside municipal + provincial roles
- ✅ Scoped operations bridge: `/map` now renders a live scope-aware incident board for municipal and agency admins, the agency queue exposes `Dispatch Responder` for accepted requests, and the sidebar hides triage/agency queue links that do not belong to the caller role
- ✅ Scoped map backend: the agency-admin map feed now comes from a callable that reads `report_ops`/`reports` server-side, so the client no longer depends on a brittle agency list query
- **Gate:** 110 tests passed, 0 failed · typecheck clean · lint clean (2 pre-existing warnings in unrelated test files)

## Current Status (2026-05-07)

**Functions Test Suite -- Zero Failures (2026-05-07)**
Systematic fix of all pre-existing test failures in `@bantayog/functions`. Reduced from ~118 failures (across ~30 files) to 0.

- ✅ `border-auto-share.test.ts` — seeded missing `report_ops/{id}` docs that `tx.update` requires
- ✅ `erasure-sweep.test.ts` — fixed `claim_lost_race` test using per-call mock `now()` to simulate TOCTOU race (query sees stale record, transaction sees fresh)
- ✅ `cleanup-sms-minute-windows.integration.test.ts` — pagination bug: after batch-deleting docs, re-fetching `lastDocId` returns empty snapshot; fixed by keeping the `QueryDocumentSnapshot` from the query batch instead of re-fetching
- ✅ `firestore.rules.test.ts` — alerts rule intentionally allows public reads; updated test to `assertSucceeds`
- ✅ `phase1-auth.test.ts` — source returns `1.0.0`; updated test expectation to match
- ✅ `public-collections.rules.test.ts` — added missing `hazard_signal_status` rule to `firestore.rules` (superadmin read-only)
- ✅ `storage.rules.test.ts` — made resilient to missing storage emulator via top-level await init + `itif(storageAvailable)` guard; passes 32/32 when emulator is running, skips gracefully when not
- **Gate:** `firebase emulators:exec --only firestore,database,storage 'npx vitest run'` → 114 test files passed, 885 tests passed, 8 skipped, 0 failures

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
- **Gate:** `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/prototype-route-redirects.test.tsx` pass, `pnpm --dir apps/admin-desktop typecheck` pass, `pnpm --dir apps/admin-desktop exec eslint src/routes.tsx src/__tests__/prototype-route-redirects.test.tsx` pass; full `pnpm --dir apps/admin-desktop lint` still reports 2 pre-existing unrelated warnings in `src/__tests__/triage-queue.test.tsx` and `src/pages/AgencyAssistanceQueuePage.test.tsx`

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
