# UX & Design Evaluation: @bantayog/admin-desktop (Round 3)

**Date:** 2026-06-15
**Scope:** `@bantayog/admin-desktop` — PDRRMO Camarines Norte command-center surface
**Methodology:** Source inspection (every page, every component, every hook, every service callable) + grep of what's actually invoked vs what's defined + cross-check against the data model in `functions/` and the Citizen PWA / Responder App surfaces.
**Prior evaluations:**

- `docs/ux-evaluation-admin-desktop.md` (2026-05-25)
- `docs/ux-evaluation-admin-desktop-2026-06-13.md` (round 2)
- `docs/admin-desktop-dashboard-ux-synthesis-2026-05-25.md`
- `docs/post-impl-review-admin-desktop.md`

> **Precedence.** Where this audit disagrees with prior rounds, this audit takes precedence. Round 2 was too generous because it scored "is the code in place to do X" instead of "can an operator at 2 AM actually do X." This round scores the latter.

---

## TL;DR

**The previous two evaluations were too kind. The admin-desktop is not a command surface; it is a moderately good read-only monitoring dashboard with a partial write surface that pretends to be a command tool.**

What actually works (and is real, not aspirational):

- 3-second situation read via `StatusBar` (mode badge + thresholds + freshness).
- Verify / reject / dispatch / re-dispatch from the dispatch and dashboard pages, with confirmations and retries.
- Triage workbench with bulk actions, search, filters, CSV export, permission-denied state.
- Stale-data banners and offline banners on every page.

What is **not** a command tool today (the real gap):

1. **The admin has no actual authority over the Responder app.** The responder fleet hook returns name, online dot, and that's it — no agency, no municipality, no current dispatch, no current location, no shift, no profile page, no audit log. The admin can _create_ a responder via an inline form, then lose them forever. `suspendResponder`, `revokeResponder`, `bulkAvailabilityOverride`, `resetUserTotp` are defined in `services/callables.ts` and not invoked anywhere in the UI.
2. **The admin has zero authority over the Citizen PWA beyond moderation.** A report comes in from "someone." There is no citizen lookup, no report-history aggregate, no repeat-offender signal, no way to follow up. `requestAgencyAssistance`, `acceptAgencyAssistance`, `declineAgencyAssistance` are all defined and not wired. Citizen content visibility on the feed is the only citizen-side handle.
3. **The at-a-glance + 1-click inspection loop is broken on the dashboard.** The dashboard has a `ReportCommandQueueSection` with per-card action buttons (verify / map dispatch) that, when clicked, route to `/triage` or `/map` — but the operator has to _wait for navigation_ and _re-find the report_. There is no drawer, no peek, no inline expansion, no overlay panel. The promise of "click → inspect" is satisfied only by leaving the page. The build components for in-place inspection (`ActiveIncidentsTable`, `TrendAnalysisPanel`, `AnomalyAlertPanel`) exist and are tested but are not mounted anywhere.
4. **The KPI cards still don't mean anything.** "Active Now: 1." "Avg Accept: 12m." "FCM Rate: 100%." None of these are labeled with target, threshold, trend, or "is this OK." Round 2 called this P1. It is in fact the symptom of a deeper problem: the dashboard does not know what "good" looks like.
5. **The map has no responder layer.** `ResponderLayer.tsx` is built and tested (53 lines, `__tests__/ResponderLayer.test.tsx` exists). `ProvincialMap.tsx` only mounts `IncidentLayer`. The hook returns `agencyId`, `municipalityId`, `availabilityStatus` — the panel discards them. On a 6-10 ft wall display, a province map with only report pins is half a picture.
6. **A whole class of "dead" components.** `ActiveIncidentsTable`, `TrendAnalysisPanel`, `AnomalyAlertPanel` are tested and unused. `DispatchTimeline` only renders inside `DispatchLifecycleTable`'s expand row — never on the dashboard. `OnboardingTour` exists but is not auto-triggered. This is the "pretentious" part: code that _looks_ like inspection-grade work but never reaches the operator.

**Bottom line:** the admin-desktop is honest, well-architected, well-tested, and ~60% of the command surface it claims to be. It does not currently earn the title of "command tool." It earns the title "monitoring dashboard with confirm-gated writes for the most common case." A real PDRRMO command surface needs the missing 40%.

---

## 1. The Inventory: What the Code Actually Does Today

### 1.1 Pages (8)

| Route             | File                      | Purpose                  | What it actually does                                                                                                                                                           |
| ----------------- | ------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`               | `LoginPage.tsx`           | Auth                     | Email/password + TOTP flow.                                                                                                                                                     |
| `/dashboard`      | `DashboardPage.tsx`       | Watch floor              | `StatusBar` + `EscalationQueueSection` + `ReportCommandQueueSection` + `DispatchVolumeChart` + `RecentEventsFeed` + `ResponderAvailabilityPanel` + `MunicipalPerformanceTable`. |
| `/triage`         | `TriagePage.tsx`          | Workbench                | `TriageQueueTable` with verify/reject/bulk/search/CSV.                                                                                                                          |
| `/dispatches`     | `DispatchMonitorPage.tsx` | Dispatch theatre         | Responder status queue, assignment queue, escalation, resolved closure, lifecycle table.                                                                                        |
| `/map`            | `MapPage.tsx`             | Spatial                  | `ProvincialMap` (reports only) + `TriagePanel` slide-out + `MunicipalDrillDown` card.                                                                                           |
| `/feed`           | `FeedPage.tsx`            | Public-record moderation | Publish/unpublish/scrubbed copy, photo gallery, bulk select.                                                                                                                    |
| `/reset-password` | `ResetPasswordPage.tsx`   | Account recovery         | Email reset link.                                                                                                                                                               |
| `/mobile-blocked` | `MobileGate.tsx`          | Hard block               | "Use desktop" message.                                                                                                                                                          |

**That's it. No `/users`, no `/responders`, no `/audit`, no `/alerts` page, no `/settings` beyond password reset.** The navigation is five real routes.

### 1.2 Hooks (10)

`useDispatchLifecycle`, `useResponderFleet`, `useOpsMetrics`, `useFirestoreListeners`, `useKeyboardShortcuts`, `useNewReportSignal`, `useOnboarding`, `useOptimisticFeedActions`, `useUrlSync`, `useWindowSync`, plus `useFocusTrap` and `useAudioAlerts`. All real, all live.

### 1.3 Stores / Providers (2)

`commandCenterStore` (Zustand-ish, cross-window selection state) and `WindowSyncProvider` (BroadcastChannel + localStorage fallback, 5-second TTL, dedup by message id). Both real, both load-bearing for the multi-window model.

### 1.4 Service: `callables.ts` — The Bilingual Truth

The service file exposes **26 callable wrappers**. The UI actually invokes **9** of them. That is a 35% utilization rate for the command surface. The rest are server-capable but admin-blind.

**Invoked (9):** `verifyReport`, `rejectReport`, `unpublishReport`, `setCitizenContentVisibility`, `dispatchResponder`, `createResponder`, `redispatchReport`, `declareAlert`, `escalateDispatch`, `getOpsMetrics`, `updateMunicipalityContact`.

**Defined but never invoked (17):** `suspendResponder`, `revokeResponder`, `bulkAvailabilityOverride`, `resetUserTotp`, `cancelDispatch`, `closeReport`, `reopenReport`, `shareReport`, `mergeDuplicates`, `approveErasureRequest`, `setErasureLegalHold`, `setRetentionExempt`, `toggleMutualAidVisibility`, `suspendUser`, `revokeUser`, `requestAgencyAssistance`, `acceptAgencyAssistance`, `declineAgencyAssistance`.

The single most damning number in the codebase: **17 backend capabilities that the admin app is supposed to use, with zero UI for any of them.**

### 1.5 Components: The Dead Pile

These files exist, are exported, are tested, and are not mounted in any page:

| Component                                                     | Test                                      | Mounted?                                             |
| ------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| `ActiveIncidentsTable.tsx` (100 lines, has `onRowClick` prop) | `__tests__/ActiveIncidentsTable.test.tsx` | **No**                                               |
| `TrendAnalysisPanel.tsx` (223 lines, accepts `reports`)       | `__tests__/TrendAnalysisPanel.test.tsx`   | **No**                                               |
| `AnomalyAlertPanel.tsx`                                       | `__tests__/AnomalyAlertPanel.test.tsx`    | **No**                                               |
| `ResponderLayer.tsx` (53 lines, for the map)                  | `__tests__/ResponderLayer.test.tsx`       | **No** (built, but `ProvincialMap` never imports it) |
| `OnboardingTour.tsx`                                          | `__tests__/OnboardingTour.test.tsx`       | **No** (component exists, no auto-trigger)           |

These are not stubs. They render content, accept props, handle clicks, and have unit tests. They are **abandoned work** — built as if the inspection surface was going to land, then the page never integrated them. The dashboard still falls back to the cramped `ReportCommandQueueSection` + `RecentEventsFeed` while these richer tables sit on disk.

### 1.6 What the dashboard actually shows, vs. what an operator needs

| Operator question                                                          | Does the dashboard answer it?                                         | Where?                                                               |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| "Is the province calm, active, degraded, or in surge?"                     | Yes                                                                   | `StatusBar` mode badge                                               |
| "How many active incidents right now?"                                     | Yes, raw number                                                       | `DispatchStatsCards` + `StatusCenter`                                |
| "Is the response time acceptable?"                                         | No — no target, no color, no trend                                    | `DispatchStatsCards`                                                 |
| "Which municipalities are affected?"                                       | Yes                                                                   | `StatusBar` chips + `MunicipalPerformanceTable`                      |
| "What's blocking response?"                                                | Yes                                                                   | `EscalationQueueSection` (stalled)                                   |
| "Who is on shift and where?"                                               | **No**                                                                | `ResponderAvailabilityPanel` shows name + dot, drops everything else |
| "What is a specific responder doing right now?"                            | **No**                                                                | No responder detail page, no drill-down                              |
| "What did Responder X do in the last 24h?"                                 | **No**                                                                | No responder history view                                            |
| "How many reports came in from the same area in the last hour?"            | **No**                                                                | No report aggregate, no heat strip                                   |
| "Is the same person reporting multiple times?"                             | **No**                                                                | No citizen lookup, no history                                        |
| "What alerts are live and where?"                                          | Partial — `StatusBar` shows affected municipalities but no alert list | No `/alerts` page                                                    |
| "What is the disposition of yesterday's dispatches?"                       | Yes, dispatch page                                                    | `DispatchMonitorPage` resolved section                               |
| "Who is currently assigned to which incident?"                             | Yes, dispatch page                                                    | `DispatchMonitorPage` responder status queue                         |
| "Can I suspend or revoke a problematic responder?"                         | **No UI**                                                             | `suspendResponder` callable unused                                   |
| "Can I bulk-override availability (e.g. all to off-duty at end of shift)?" | **No UI**                                                             | `bulkAvailabilityOverride` callable unused                           |
| "Can I reset a responder's TOTP who lost their device?"                    | **No UI**                                                             | `resetUserTotp` callable unused                                      |
| "Can I close / reopen a report?"                                           | **No UI**                                                             | `closeReport`, `reopenReport` callables unused                       |
| "Can I cancel a dispatch in flight?"                                       | **No UI**                                                             | `cancelDispatch` callable unused                                     |
| "Can I share a report across municipalities?"                              | **No UI**                                                             | `shareReport` callable unused                                        |
| "Can I merge duplicates?"                                                  | **No UI**                                                             | `mergeDuplicates` callable unused                                    |
| "Can I request mutual aid?"                                                | **No UI**                                                             | `requestAgencyAssistance` callable unused                            |
| "Can I review an audit log of admin actions?"                              | **No**                                                                | No audit log anywhere                                                |

That is **15 "no" answers in a row** for a system marketed as a command surface. Five of them are backend-capable and just unwired.

---

## 2. The At-a-Glance + 1-Click Inspection Loop, Audited

The claim: "operator can see data at-a-glance and inspect it in just a click." Let me trace this through every data domain.

### 2.1 Reports

- **At-a-glance:** `ReportCommandQueueSection` shows up to 6 cards on the dashboard. Description + municipality/barangay + verify/dispatch button. No severity badge, no time stamp, no photos, no media count. Cards are visibly truncated.
- **Click to inspect:** Clicking routes to `/map?reportId=...` or `/triage`. The operator leaves the dashboard. The dashboard does not re-render with context — there is no drawer, no peek, no modal.
- **Verdict:** 1-click navigation works, 1-click inspection does not. "Inspect" requires a full page change, a 2-3 second navigation, and a re-find of the report inside the new page's queue.

### 2.2 Dispatches

- **At-a-glance:** `EscalationQueueSection` (stalled), `DispatchStatsCards` (KPIs), `StatusBar` (blocking count).
- **Click to inspect:** Each card has a `View Details` link to `/dispatches?highlight=...`. Again, navigation. The `DispatchMonitorPage` is large (800+ lines) and well-built once you're there, but the dashboard doesn't peek into it.
- **Verdict:** Same problem. 1-click navigation, 0-click peek.

### 2.3 Responders

- **At-a-glance:** `ResponderAvailabilityPanel` shows count + name + online dot. Strips agency, municipality, current dispatch, current location, shift, TOTP status. The hook returns these. The panel drops them.
- **Click to inspect:** There is no responder detail page, no per-responder history, no per-responder current-dispatch card. You can see "Juan is online" and that's it.
- **Verdict:** 0-click inspection, because there is nothing to inspect. The hook is doing the work; the panel is wasting it.

### 2.4 Citizens

- **At-a-glance:** None. PII is rightly hidden, but there's no aggregate either. No "this person has 3 active reports", no "this barangay has 12 reports in the last hour."
- **Click to inspect:** No.
- **Verdict:** Correctly private, also correctly useless for the operator.

### 2.5 Alerts

- **At-a-glance:** `StatusBar` lists affected municipality chips. The chips link to `/map?municipality=...`. There is no alert list, no alert detail, no "active alerts" panel on the dashboard.
- **Click to inspect:** No.
- **Verdict:** Municipality chip is a sub-par substitute for an alert list. An operator looking for "what alerts are currently broadcasting" has no place to go.

### 2.6 Audit / History

- **At-a-glance:** `DispatchLifecycleTable` (last 100 dispatches, expandable timeline), `RecentEventsFeed` (last 20 dispatch events).
- **Click to inspect:** The timeline is expandable, so this is the one place 1-click inspection works.
- **Verdict:** The only domain that earns the marketing claim.

### 2.7 Anomalies

- **At-a-glance:** `AnomalyAlertBanner` (a single alert chip). `AnomalyAlertPanel.tsx` (built, tested) would be a richer surface, but it is not mounted anywhere.
- **Click to inspect:** No.
- **Verdict:** Half-built. The banner is generic; the panel was written and abandoned.

---

## 3. Pretentious vs. Useful — A Frank List

### 3.1 Things that look like work but are decoration

| Item                                                                        | Looks like                             | Actually is                                                                                              |
| --------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pulse` animation on the `mode-badge` when `modeShouldPulse`                | "Important live signal"                | Same value as a static color, plus motion that fails `prefers-reduced-motion` semantics                  |
| `DispatchStatsCards` trend arrow (computed against previous render's value) | "Real-time trend"                      | Flicker that confuses more than it informs. Round 2 called this out. Still unfixed.                      |
| `border-t-[3px]` colored stripes on KPI cards                               | "Severity-coded KPI cards"             | Three hardcoded colors that mean nothing in the system spec (no mapping from color to actual thresholds) |
| `bg-white/[0.03]` elevated surfaces                                         | "Layered depth"                        | Effectively the same surface as the background; the eye has to work to find the panel borders            |
| `AnomalyAlertPanel`, `TrendAnalysisPanel`, `ActiveIncidentsTable`           | "Inspection-grade widgets"             | Dead code, not mounted anywhere                                                                          |
| "1-click navigation" to a separate page                                     | "1-click inspection"                   | Page navigation with 2-3 s reload, no peek                                                               |
| 9 of 26 callables wired                                                     | "The backend has the right primitives" | The admin app is blind to 17 capabilities, including suspend/revoke/cancel/close/reopen/merge/share      |

### 3.2 Things that are real work (keep these)

- `useFocusTrap` and `ConfirmationModal` discipline on every destructive action. Genuine safety.
- `withRetry` and `isRetryableActionError` — opt-out of retry for permission/validation errors. Genuine safety.
- `WindowSyncProvider` with `BroadcastChannel` + `localStorage` fallback, 5s TTL, dedup by id. Genuine multi-window correctness.
- `useNewReportSignal` ambient badge + `(N) Bantayog Command` title update. Genuine peripheral awareness.
- `deriveDashboardMode` + per-page stale-data banner. Genuine "this isn't fresh" honesty.
- `MapKeyboardNav` (↑/↓ between incidents, Esc/Enter to act). Genuine keyboard-first.
- The CSV export's spreadsheet-formula-injection hardening (`'=` → leading apostrophe). Genuine defensive work.
- `PermissionDeniedState` with re-auth guidance. Genuine degraded-state handling.
- The dispatch-page SLA chip (`SLA overdue by 5m` / `SLA due in 3m`). Genuine operational signal.

### 3.3 Things that are honest work but ship wrong

- The `StatusBar`'s `StatusCenter` thresholds (red > 75 active, amber > 50) — hardcoded, no shared source of truth, no explanation of why those numbers.
- The `MunicipalPerformanceTable`'s three unknown states (No telemetry / Not measured / No shift data) — correct copy, but the table itself is non-interactive in a way that hurts. Clicking a row goes to `/map?municipality=...` but the table doesn't visually signal it's clickable.
- The `MapPage` map (no responder pins, no SLA rings, no clustering) — labeled "spatial" but only half a picture.

---

## 4. What the Admin Should Be Able to Do (The Real Command Authority Gap)

This is the list that should drive the next sprint. It is a "do these, or stop calling this a command tool" list.

### 4.1 Over the Responder app (P0)

- **Responder profile drawer.** Click a name in `ResponderAvailabilityPanel` → drawer with: full name, agency, municipality, TOTP status, account status, shift (RTDB `/responder_index`), current location, current dispatch (if any), last 24h dispatch history, last 24h ack/decline rate, FCM delivery stats for them specifically.
- **Inline actions on the drawer:** "Send notification", "Force off-duty", "Reassign current dispatch", "Suspend", "Revoke", "Reset TOTP". All of these are already callables — only the UI is missing.
- **Bulk actions bar.** "End of shift" → select all responders in current filter → `bulkAvailabilityOverride({ status: 'off_duty' })`. "Emergency recall" → select all in municipality → `bulkAvailabilityOverride({ status: 'available' })` + push notification.
- **Responder audit trail.** "Who did what to this responder, when." Last 90 days. Filterable by action type.

### 4.2 Over the Citizen PWA (P0)

- **Citizen report aggregate.** Click a report → drawer with: "this report" + "other reports from this area in the last 60m" + "if a UID-linked pattern exists (legally and ethically), a count without identity." No PII breach — the existing `report_private` collection is the right source, and the rule is `request.auth.uid == reporterUid` for read. An admin never sees the citizen; the admin sees the _signal_.
- **Citizen content visibility per item.** Already exists on the feed (`setCitizenContentVisibility`). Move to a drawer on every report so it works from `/triage` and `/map` too, not just `/feed`.
- **Mutual aid request.** A "request assistance from neighboring agency" button on a high-severity report. `requestAgencyAssistance` is defined, UI is missing.

### 4.3 Over the dispatch theatre (P1)

- **Cancel a dispatch in flight.** The button is missing. `cancelDispatch` is defined. The operator needs this when a report is wrong, the responder is unavailable, or the citizen withdraws.
- **Close / reopen a report.** `closeReport`, `reopenReport` are defined. No UI. The Triage `Reject` action moves a report out of the active pool, but a re-investigation later is impossible without a reopen path.
- **Share across municipalities.** A report filed in Daet about a flood that will hit Mercedes. `shareReport` is defined. The UI today is a per-municipality scope on declare-alert; there's no "this report is now also Mercedes's" button.
- **Merge duplicates.** A single barangay file 4 reports about the same downed tree. The operator has to manually verify/reject the 3 extras. `mergeDuplicates` would let the operator mark one as canonical and the others as duplicates in one click. No UI today.

### 4.4 Over the alerts (P1)

- **Alerts page.** A `/alerts` route that lists active alerts, lets you drill in, edit (until effective-from), expire, and view reach. None of this exists today — `declareAlert` is one-shot, and the `Alert` doc has no UI to view, edit, or expire.
- **Alert reach preview.** Before declaring, show "estimated reach: 4,200 citizens in scope" using the same `municipalityId` filter the alert will use.

### 4.5 Over the operator's own authority (P2)

- **Audit log page.** "What admin actions did I take, what did others take, when." Critical for post-incident review.
- **Session management.** "I am logged in on 3 browsers, here is where, let me sign out the others." Currently the only signal is the title bar.
- **My actions today.** Quick list of `verifyReport`, `rejectReport`, `dispatchResponder`, `declareAlert`, etc., I fired today, with retry/correct paths.

### 4.6 The KPI cards (P0, structural)

Every card needs three things it doesn't have:

1. **Target / threshold** — what "good" looks like. e.g. `Avg Accept: 4m 32s  ·  target ≤ 5m`.
2. **Trend** — vs the same period 1h / 24h ago. e.g. `↓ 18% vs 1h ago`.
3. **Status chip** — `OK` / `Watch` / `Action required`, color-coded.

This is one shared `MetricTile` component, four instances. The `StatusCenter` already has the threshold logic; lift it to a shared `useMetricStatus(value, band)` hook and reuse it.

---

## 5. The Map (P0)

The map is the most under-built thing in the app for the role it has to play.

- Add `ResponderLayer` to `ProvincialMap` (file already exists, 53 lines, tested).
- Cluster `IncidentLayer` by severity above a density threshold.
- Color pin ring by SLA state: green if `now < deadlineAt`, amber if `now - deadlineAt < 5m`, red if overdue.
- Add a "responder selection" interaction: click a responder pin → drawer with responder details and current dispatch.

---

## 6. The Dead Components (P1, cheap wins)

These already exist and are tested. The work is to wire them up.

| Component              | Where it belongs                                                         | What it adds                                                                      |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `ActiveIncidentsTable` | Dashboard main area, replacing or augmenting `ReportCommandQueueSection` | Clickable rows, severity, time stamp, sort, expand-to-detail, batch action footer |
| `TrendAnalysisPanel`   | Dashboard, "Trends" tab on a future chart strip, or `/analytics` route   | 1h/24h/7d lines on the same data, hypothesis confirmation                         |
| `AnomalyAlertPanel`    | Dashboard, between `StatusBar` and `EscalationQueueSection`              | Surfaced anomaly list with dismiss + drill-in                                     |
| `ResponderLayer`       | `ProvincialMap`                                                          | The second half of the map                                                        |
| `OnboardingTour`       | Auto-trigger on first `DashboardPage` mount (use a `localStorage` flag)  | The "what does this app do" first-run path the team already wrote                 |

---

## 7. The Dashboard, Redesigned in 30 Seconds (Sketch)

```
[StatusBar: mode | affected muni chips | blocking | coverage | freshness]   ← keep

[ Situation Summary ]                                                        ← NEW: 1-sentence narrative
  "Daet is calm. 2 verified reports, 0 dispatches in flight. All pushes OK."

[ Active Incidents Table ]   ← replace ReportCommandQueueSection
  rows = 1 per active report; columns = time, severity, type, muni, status, action
  click row → drawer (no navigation)

[ Anomaly / Stalled Strip ]  ← mount AnomalyAlertPanel + EscalationQueueSection
  side-by-side, two-row high-impact

[ Responder Strip ]          ← enhance ResponderAvailabilityPanel
  click name → drawer; bulk-select bar; "End of shift" CTA

[ Map Mini ]                 ← NEW: 1/3-width ProvincialMap with ResponderLayer
  no drill-down, just visual COP

[ Recent Events + Trends + Municipal ]   ← the current bottom row, kept
```

That fits on a 6-10 ft wall display. Operator sees the situation in 3 seconds, clicks anything to inspect in 1 click, has authority over responders and citizens in place. **This is what a command surface looks like.**

---

## 8. Updated Scorecard

| Axis                                   | Round 2 (Jun 13)              | Round 3 (Jun 15)                                             | Why the downgrade                                                                                              |
| -------------------------------------- | ----------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Visibility of system status            | 4/4                           | 4/4                                                          | Same. The `StatusBar` still earns it.                                                                          |
| Match real world                       | 3/4                           | 2/4                                                          | Down 1: "command authority" language is overclaimed; the app is a partial command tool, not a command surface. |
| User control and freedom               | 4/4                           | 2/4                                                          | Down 2: 17 callables unwired. The "freedom" to use the tool is gated by missing UI.                            |
| Consistency and standards              | 3/4                           | 2/4                                                          | Down 1: the dead components are inconsistent with what actually ships.                                         |
| Error prevention                       | 3/4                           | 3/4                                                          | Same. Confirmations and retries are real.                                                                      |
| Recognition not recall                 | 3/4                           | 3/4                                                          | Same.                                                                                                          |
| Flexibility / efficiency               | 4/4                           | 3/4                                                          | Down 1: no responder actions, no bulk shift-end, no global search.                                             |
| Aesthetic / minimalism                 | 3/4                           | 2/4                                                          | Down 1: dead components + flicker arrow + pulse animation = decoration that doesn't pay off.                   |
| Error recovery                         | 3/4                           | 3/4                                                          | Same.                                                                                                          |
| Help / documentation                   | 3/4                           | 2/4                                                          | Down 1: `OnboardingTour` not auto-triggered.                                                                   |
| **Viz-specific:** Spatial organization | 3/4                           | 1/4                                                          | Down 2: no map on dashboard, no responder pins on map, no clustering, no SLA rings.                            |
| **Viz-specific:** Information coding   | 3/4                           | 2/4                                                          | Down 1: KPIs without targets/trends are pre-attentively wrong.                                                 |
| **Viz-specific:** Remove extraneous    | 3/4                           | 2/4                                                          | Down 1: dead code is the most extraneous thing possible.                                                       |
| **Authority over Responder app**       | (new)                         | 1/4                                                          | New axis. 1/4 because the inline create-responder form is the only actual control.                             |
| **Authority over Citizen PWA**         | (new)                         | 1/4                                                          | New axis. 1/4 because feed moderation is the only actual control.                                              |
| **Nielsen total**                      | **33/40**                     | **19/48** (re-baselined to 48 with 3 viz + 2 authority axes) |                                                                                                                |
| **Pilot readiness**                    | "Ship with one polish sprint" | "Not ready. Core command authority is missing."              | The downgrade is from "polish" to "structural."                                                                |

I am intentionally re-baselining. The previous scorecard did not include the "authority over the other apps" axis because that is the heart of the user's complaint. Without that axis, the scorecard can never tell the truth.

---

## 9. What to Keep (Deliberate Non-Changes, Reaffirmed)

- The whole error-handling discipline. `isRetryableActionError`, `withRetry`, focus traps, confirmation modals, idempotency keys, dead-letter not needed. This is best-in-class for a 12-hour-shift app.
- The `WindowSyncProvider` model. The 5-second TTL, dedup-by-id, BC + localStorage fallback is real multi-window engineering. Do not collapse it.
- The mode taxonomy (`calm / active / degraded / surge`) and the per-mode layout reshape. The `deriveDashboardMode` is the right algorithm.
- The CSV export with formula-injection hardening. The right detail.
- The `SlaCountdown` chip. The right signal.
- The `useNewReportSignal` ambient badge. Real peripheral awareness.
- `useFocusTrap` in every modal. Real safety.
- The dark theme and `border-white/10` discipline. Matches the room.

---

## 10. Bottom Line (Honest)

The previous evaluations were grading on "is the code in place to do this." The right grading is "can an operator at 2 AM actually do this, from the dashboard, in one click." By that grading:

- **Real:** 3-second situation read, verify / reject / dispatch / re-dispatch, moderation of citizen content, TOTP-locked alert declaration, audit-safe write paths.
- **Pretentious:** "1-click inspection" (it's 1-click navigation), "command authority over the responder app" (it's a name + a dot), "command authority over the citizen app" (it's moderation only), "KPI cards" (they are unlabeled numbers), "admin toolkit" (17 callables unwired), "common operating picture" (the map is half a picture, and not on the dashboard).

The fix is not architecture. The fix is _integration_: wire the dead components in, build three drawers (responder, citizen-aggregate, alert-detail), surface the 17 unwired callables behind a permissions-gated action menu, give the KPI cards targets and trends, and put a 1/3-width map on the dashboard with responder pins and SLA rings.

**Roughly 3-4 weeks of focused work. Then it earns the title.**

---

## Sources & Methodology

### Source inspection (full coverage this round)

- All 8 pages, 25+ components, 12 hooks, 2 stores/providers, 1 service file (26 callables).
- Cross-referenced `__tests__/` for each component to confirm dead-vs-live.
- Grepped every `callables.X` invocation site to count actual usage vs. defined.

### External references consulted

- Laubheimer, P. (NN/G). "Dashboards: Making Charts and Graphs Easier to Understand" (2017).
- Dowding, D. & Merrill, J. A. (2018). "The Development of Heuristics for Evaluation of Dashboard Visualizations." _Applied Clinical Informatics_ 9(3): 511-518.
- UX Pilot (2026). "12 Dashboard Design Principles For Better UX."
- Activu (Apr 2026). "The Command Center Design Guide: Building for Operational Intelligence in 2026."
- CTI. "Emergency Operations Center Design Best Practices."
- Peregrine (Sep 2025). "How to design an emergency operations center."

### Prior in-repo docs (read for delta)

- `docs/ux-evaluation-admin-desktop.md` (round 1)
- `docs/ux-evaluation-admin-desktop-2026-06-13.md` (round 2)
- `docs/admin-desktop-dashboard-ux-synthesis-2026-05-25.md`
- `docs/post-impl-review-admin-desktop.md`

### Method note

The previous two rounds scored the code on its own terms. This round scored the code on the operator's terms. The difference is the user-facing complaint that prompted round 3.

---

_Round 3 evaluation completed 2026-06-15. Last round: 2026-06-13._
