# Progress

## 2026-05-29 — Admin Control for Citizen PWA Visibility

Wired missing admin moderation for what citizens see on the Citizen PWA. Existing report publication remains the control path for Citizen Map/report visibility. Added backend-enforced visibility for citizen situation feed posts and official alerts, including admin callable moderation, scoped admin listeners, public-only Citizen alert queries, `situation_updates.municipalityId`, Firestore rules/index updates, and Feed page controls to hide/restore citizen posts and alerts. Focused tests, lint, typecheck, builds, and emulator rules tests pass.

## 2026-05-28 — Citizen PWA Feed Retention UX

Researched disaster-app retention, civic-tech engagement, gamification risk, and Facebook-style feed patterns. Feed tab now uses a Facebook-inspired community situation feed without a highlights/story strip: inline composer, municipality filter chips, citizen post cards, `Community Pulse` area/needs-help counts, report-for-moderation action, and a separate `situation_updates` Firestore path. Emergency report flow remains unchanged.

## 2026-05-28 — Citizen PWA Ethical Gamification UX Polish

Applied the UX-video takeaways without changing the visual system: Profile now reframes milestones as an `Impact Path`, adds a compact `x/4 signals` completion cue, and gives next-step guidance based on real report lifecycle states. Badge/pitch copy now emphasizes verified impact and reporting skill instead of raw badge chasing. Added ProfileTab coverage for the impact path. Focused test, lint, typecheck, and local render check pass.

## 2026-05-28 — Responder App Dispatches Tab Design Review

**critique findings (score 25/40):** adaptive density missing, auto-navigate removes agency, ring dominates low-value info, PROGRESS % is meaningless, em dash in empty state violates PRODUCT.md anti-references.

**Implemented fix ($impeccable layout + $impeccable harden + $impeccable clarify):**

- Added `DispatchRow` compact component with severity chips and inline Accept/View button.
- `DispatchListPage` now switches to compact row mode when >3 dispatches per section (`COMPACT_THRESHOLD`). Falls back to ring cards for ≤3.
- Removed auto-navigate (previously `replace: true` on single active dispatch). Now keeps list visible for user agency.
- Empty state updated to "STANDBY / System live. Awaiting dispatches." (on-brand, no em dashes).
- All 262 tests pass, zero type errors.

  **Option C (harden):** Added data freshness heartbeat. `useOwnDispatches` now tracks `lastUpdatedAt` from Firestore snapshots. `DispatchListPage` shows "Live" green dot when <60s, "Updated Xs ago" when stale, "Connecting…" during initial load. Aligns with PRODUCT.md Principle #4 (data freshness heartbeat). 264 tests pass, zero type errors.

  **Post-review cleanup:** Fixed `DispatchRow` to use `useNavigate` instead of `window.location.href` (full page reload). Removed dead `.cardMeta` CSS and deduplicated `.activeStatusBlock` rule in `DispatchListPage.module.css`. 264 tests pass, zero type errors.

  **Option B (distill + clarify):** Removed meaningless "PROGRESS 60%" ring from active dispatch cards. Replaced with status block: status label + location + large "Mark On Scene" primary button. Pending cards keep the countdown ring (genuinely useful). 263 tests pass, zero type errors.

**Option A (harden):** Removed auto-navigate completely. Now shows a sticky amber "1 active dispatch — Resume" banner instead. Responder keeps full list visibility and chooses when to resume. Added test for banner. 263 tests pass, zero type errors.

**Profile UX:** Added loading states, error banners, sign-out confirm dialog, success feedback on availability, `aria-live="polite"` announcements. 10 tests.

## 2026-05-28 — Responder App Alerts Tab Design Review

**critique findings (score 26/40):** monochrome icon badge and hazard chips (zero differentiation by threat type), em dash in offline banner violates PRODUCT.md, missing data freshness indicator, no `timeAgo` upper bound.

**Implemented fix ($impeccable clarify + $impeccable colorize):**

- **P0:** Replaced em dash in offline banner (`You&rsquo;re offline &mdash; showing cached alerts`) with period (`You&rsquo;re offline. Showing cached alerts.`). Aligns with PRODUCT.md Anti-References.
- **P1:** Added hazard-specific color-coding to alert cards. Icon badge and hazard chip now color-coded by `hazardType`:
  - `typhoon` → blue (#60a5fa)
  - `flood` / `storm_surge` → cyan (#22d3ee)
  - `fire` → orange (#fb923c)
  - `earthquake` → red (#ef4444)
  - `landslide` → amber/brown (#d97706)
  - Unknown types fallback to amber (existing behavior).
- Added `hazardClassSuffix()` helper mapping `hazardType` to CSS class suffix.
- 264 tests pass, zero type errors.

**Post-critique P2 fixes ($impeccable harden):**

- **P2:** Added data freshness indicator to alerts tab. `useOfficialAlerts` now returns `lastUpdatedAt`. `AlertsPage` shows "Live" dot, "Updated Xs ago", or "Connecting…" status above the alert list. Same pattern as dispatches tab. 265 tests pass, zero type errors.
- **P2:** Capped `timeAgo` at `over 30 days ago` so stale data never shows meaningless `400d ago`. Added test.
- **P3:** Replaced literal `#000` in `.filterChipActive` with `var(--bg-black)` for consistency. Also removed dead `.page` CSS rule. 265 tests pass, zero type errors.

## 2026-05-28 — Responder App Profile Tab Design Review

**critique findings (score 25/40):** identical gradient+shadow on all cards flattens visual hierarchy, 3-click status toggle during shift changes, dead "Longest availability streak" data erodes trust, em dash in `formatDuration` violates PRODUCT.md, "Specialization Mastery" jargon unexplained.

**Implemented fix ($impeccable layout + $impeccable harden + $impeccable distill + $impeccable clarify):**

- **P0:** Flattened secondary cards. `sectionCard` and `linkList` now use flat `var(--surface-elevated)` background with subtle border. Removed heavy `box-shadow: 0 14px 40px` and `linear-gradient` from all but `profileCard` and `availabilityPanel`. Reduced shadow to `0 4px 12px` for less visual weight.
- **P1:** Replaced `<select>` status dropdown with segmented control: `[Available] [Unavailable] [Off Duty]` buttons. Clicking "Available" immediately calls `setAvailability('available')`. Non-available states show reason `<select>` + "Apply Status" button. Single-tap for the most common action.
- **P1:** Removed dead "Longest availability streak" row from Personal Bests. Only live metrics remain.
- **P2:** Fixed `formatDuration` em dash (`—`) → `N/A`. Also updated all stat fallbacks from `—` → `N/A` for consistency.
- **P2:** Renamed "Specialization Mastery" → "Resolved by Type". Updated note from "fills relative to the strongest bucket" → "Breakdown of incident types you have resolved."
- 266 tests pass, zero type errors.

**Shift Handoff Removal:** Deleted responder-to-responder handoff (frontend + functions + validators). Preserved municipality-level handoff used by admin sweep. 261 tests pass, zero type errors.

## 2026-05-26 — Responder App Dispatch Tab UX Hardening

Added retry to `useOwnDispatches`, offline indicator in shell, character limits + counters on textareas, `prefers-reduced-motion` for SOS button. 244 tests pass.

## 2026-05-25 — Dashboard Redesign Adversarial Review

14 issues fixed: mode/state precedence (actionable > data-quality states), Tailwind JIT class purging, decomposing into reviewable PRs, asymmetric debounce, timer cleanup, affected geography from reports+dispatches.

## 2026-05-24 — RTDB + Emulator Hardening

RTDB parent `.read` fix, zombie emulator detection, anonymous auth lifecycle, runtime dependency checks.

## 2026-05-22 — Admin Surfacing + Report Flow E2E

Citizen PWA → emulator `report_inbox` → materialization → admin Triage Queue verified. 5 root causes fixed (protobuf bug, schema mismatches, missing centroids, `.env.local` overrides). Feed moderation, unpublish, inbox reconciliation. 223 tests.

## 2026-05-14-21 — Staging Deploy + Security Audit

- Responder staging deployed with production-build guard. Shell cleanup, municipality rules, PWA icons.
- Bootstrap script for all seeded test accounts (citizen, admin, responder, superadmin).
- 36 security findings from audit: accountStatus checks, idempotency atomicity, MFA bypass rules, signed URL TTL, App Check enforcement, FCM rate limits, anonymous submission rules fix.
- Functions 885 tests zero failures. Admin Desktop superadmin route gating.
- Responder PWA rebuild (12 tasks): shell, login, dispatch list/detail, messages, map, profile.

## 2026-05-10-12 — Admin Desktop Reset + Design Critique

Greenfield reset. Consolidated severity/brand tokens, role-scoped Firestore reads, municipal performance truth-gate, hold-to-dispatch keyboard parity, sticky bulk-action bar, WindowSync dedup, offline banner ordering. 147 tests.

## 2026-05-08 — PR #115 Review + 3-App UI Audit

PR #115: Zod 4 migration, race condition fixes, ARIA/focus on 4 modals, redispatch safety, auth orphan prevention. Adversarial review: 12 findings fixed.

3-app parallel UI audit: responder (button semantics, contrast, Lucide icons), citizen (eager import, RevealSheet, severity colors), admin (palette canonization, animation removal, skip-to-content).

## 2026-05-02-07 — Auth, Wizard, QA, Hardening

Auth + wizard resumability, QA sweep (45 items, 7 P0), hardening (PWA install, offline, backoff, image compression, background sync), cancel report flow, live sync, 10 UX fixes.

## Older Completed Phases

| Phase                                       | Status | Notes                                                         |
| ------------------------------------------- | ------ | ------------------------------------------------------------- |
| Phase 9: Citizen PWA Redesign               | DONE   | Feed/Profile/Alerts tabs, RevealSheet, auth, registration     |
| Phase 8C: Erasure (RA 10173)                | DONE   | Callables, sweeps, rules, delete-account flow                 |
| Phase 7: Security Callables + Superadmin UI | DONE   | 7 callables, analytics dashboard, emergency declaration, TOTP |
| Phase 6: Responder App                      | DONE   | Native, push, telemetry, location, field UX                   |
| Phase 5: Analytics                          | DONE   | Cluster C + PRE-C                                             |
| Phase 3b: Admin Triage + Dispatch           | DONE   | Code complete                                                 |
| Phase 0: Foundation                         | DONE   | All tooling passing                                           |

> Features removed in `9f520d99` (2026-05-11): SMS inbound pipeline, NDRRMC escalation, PAGASA hazard signals, Break Glass, mass alert broadcast.

## Open

1. Firebase Console: Phone Auth disabled; App Check 400 errors on staging
2. Staging redeploy to verify accumulated fixes
3. Phase 7.C: Staff TOTP enrollment audit
4. Deferred: 4 observability dashboards (Phase 11)
