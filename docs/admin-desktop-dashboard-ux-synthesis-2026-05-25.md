# Admin Desktop Dashboard UX Synthesis

**Date:** 2026-05-25
**Scope:** `@bantayog/admin-desktop`
**Surface:** PDRRMO Camarines Norte command-center dashboard
**Inputs incorporated:**

- `docs/ux-evaluation-admin-desktop-2026-05-25.md`
- `docs/research-dashboard-layout-2026-05-25.md`
- Source inspection of `DashboardPage`, `CommandHeader`, `DispatchStatsCards`, `EscalationQueueSection`, `MunicipalPerformanceTable`, `DispatchVolumeChart`, and related tests
- Existing screenshot evidence from `e2e-admin-desktop-proof.png`
- Current dashboard UX research reviewed during this audit

## Precedence Rule

Where the source docs and this audit disagree, this audit takes precedence. The older research doc is directionally right about operational dashboard theory, but it overstates some current implementation strengths. The older UX completeness doc correctly identifies many product gaps, but it under-ranks the most dangerous issue: a visible `Re-dispatch` action currently exists on the dashboard while its handler is a no-op.

## Executive Verdict

The admin dashboard is a useful operational foundation, but it is not yet a complete command-center UX for disaster response.

The current UI has the right bones: persistent command header, live indicator, route orientation, keyboard shortcuts, empty/error states, escalation queue, dispatch metrics, responder visibility, and municipal breakdowns. It looks restrained and serious enough for a dim command room, and the automated `impeccable` scan found no obvious generic-design anti-patterns in the inspected dashboard files.

The problem is not aesthetics. The problem is operational trust.

A great Bantayog dashboard must answer four questions in seconds:

1. Is the province calm, degraded, surging, or in emergency?
2. Which municipalities are affected?
3. What is blocked or aging out?
4. What should command staff do next?

The current dashboard partially answers 1, weakly answers 2, partly answers 3, and has a critical failure on 4 because at least one visible action is not wired.

**Overall design health:** 26/40
**Product readiness:** Needs work before high-stakes pilot use
**Primary fix theme:** Turn the dashboard from a data summary into a trustworthy command surface.

## What Great Means for This Dashboard

Bantayog admin-desktop is an operational dashboard, not an analytical or executive dashboard. It should optimize for attention allocation and action, not exploration.

Research-backed principles that matter here:

- Design for a specific dashboard type and audience; a generic all-purpose dashboard gets abandoned.
- Keep the top view scannable within 3-5 seconds.
- Put urgent, actionable status in the first scan path.
- Show context for raw metrics: thresholds, normal ranges, degraded states, and action meaning.
- Use progressive disclosure: overview first, investigation second, raw tables last.
- Make data freshness visible because stale operational data creates false confidence.
- Use color semantically, but never as the only signal.
- Provide direct paths from warning signals to the next action.
- Support team situational awareness across multiple screens and roles.

For this product, the practical standard is:

```text
3 seconds: know whether the province is okay.
30 seconds: know where the problem is and what is blocking response.
300 seconds: decide, dispatch, escalate, or declare.
```

## Reconciled Findings

### What Is Working

1. **Command-center frame is solid.**
   `CommandHeader` provides persistent location, route tabs, live indicator, alert declaration, shortcuts, and sign-out. The `windowRole` chip and route accent help multi-window orientation.

2. **The layout is directionally right for operations.**
   `DashboardPage` places dispatch stats and escalation before charts and municipal context. This follows the inverted-pyramid model from the research doc.

3. **The UI avoids most obvious dashboard slop.**
   The design is not a decorative SaaS dashboard. It is dark, dense, restrained, and operational. The automated detector returned no findings for the inspected dashboard files.

4. **Keyboard and accessibility foundations exist.**
   Shortcuts, focus-visible rings, `aria-current`, labeled icon buttons, modal close paths, and sortable table headers are present.

5. **Empty and offline states are taken seriously.**
   `AllClearState`, `OfflineBanner`, and page-level loading states prevent several common blank-screen and ambiguity failures.

6. **Cross-window sync is strategically correct.**
   The research doc's Team SA and Common Operating Picture points are valid. `WindowSyncProvider` directly supports command-center multi-monitor use.

### Where Earlier Docs Were Too Generous

1. **"One-click actions are excellent" is not currently true.**
   The dashboard `Re-dispatch` button is visible, but `handleReDispatch` only discards the `dispatchId`. That is a critical trust issue, not a minor follow-up.

2. **"Escalation queue at top is excellent" is only true if actions work.**
   The placement is correct. The action loop is incomplete.

3. **"KPI cards with trends" is overstated.**
   `DispatchStatsCards` only tracks local change in average accept time after the component has previous data. The cards do not explain thresholds, normal ranges, surge meaning, or whether a value requires action.

4. **"Map integration is non-negotiable" is correct, but the dashboard does not surface it enough.**
   Geography lives mostly in the map route and municipal table. The dashboard still lacks a glanceable province situation strip.

5. **"Current ordering is correct" is mostly true, but the hierarchy is too flat.**
   In calm, surge, degraded, and emergency states, the same panel structure remains. The dashboard does not yet reshape priority based on operational mode.

## Priority Issues

### P0: Visible `Re-dispatch` Action Is a No-op

**Evidence:** `DashboardPage` defines `handleReDispatch` as a callback that only evaluates `void dispatchId`; `EscalationQueueSection` renders a live `Re-dispatch` button for stalled dispatches.

**Why it matters:** In incident response software, operators must be able to trust that visible command actions work. A dead action during escalation will waste time and damage confidence in the system.

**Fix:** Either wire the real responder-selection/re-dispatch flow or disable/remove the dashboard button until it is implemented. If disabled, explain why and link to the dispatch monitor detail path.

### P1: No Geography-first Situation Summary

**Evidence:** `DashboardPage` derives municipal data and renders `MunicipalPerformanceTable`, but the first screen is metrics and panels, not a province-level status picture. The actual map is a separate route.

**Why it matters:** Disasters are spatial. Command staff need to know which municipalities are affected before they interpret charts.

**Fix:** Add a compact province situation strip near the top: affected municipalities, highest severity, active responders, stale feed indicator, and quick jump to map. This can be simpler than the full `MapPage`.

### P1: Metrics Lack Operational Meaning

**Evidence:** `DispatchStatsCards` shows `Active Now`, `Stalled`, `Avg Accept`, and `FCM Rate`, but does not show targets, thresholds, expected ranges, or action labels.

**Why it matters:** Raw numbers force operators to remember policy and historical norms. Good operational dashboards allocate attention; they do not make users infer whether `95% FCM` is okay during an incident.

**Fix:** Add status labels and thresholds: `Normal`, `Watch`, `Degraded`, `Action required`. Pair them with concise reasons such as `FCM below 98% target` or `Accept time above 5m target`.

### P1: Ambiguous Unknown Data States

**Evidence:** `MunicipalPerformanceTable` renders `-`/dash placeholders for missing responder, response-time, and admin-duty data.

**Why it matters:** Unknown is not the same as zero or calm. In command software, missing telemetry should be visible as a data-quality state.

**Fix:** Replace generic dashes with explicit states: `No telemetry`, `No shift data`, `No responder feed`, or `Not measured`. Style unknown as degraded-neutral, not success-neutral.

### P1: Missing Success Feedback Across Action Flows

**Evidence:** The prior UX completeness report found `SuccessBanner` exists but is not wired to publish, dispatch, verify, or declare flows.

**Why it matters:** Operators need confirmation that high-stakes actions landed. Without success feedback, they may repeat actions or lose trust.

**Fix:** Wire success feedback for declaration, verification, dispatch, feed publish/unpublish, and re-dispatch. Keep it terse and timestamped.

### P2: Dashboard Does Not Adapt to Operational Mode

**Evidence:** The same layout is used for calm, active, degraded, and surge states except for individual component states.

**Why it matters:** During surge, lower-priority charts should recede and actionable blockers should dominate. During calm, readiness and freshness matter more than empty panels.

**Fix:** Define dashboard modes:

- `calm`: all-clear, readiness, last activity, feed freshness
- `active`: affected municipalities, active incidents, pending actions
- `degraded`: offline/stale feeds, manual fallback guidance
- `surge`: escalation queue, responder capacity, municipality load

### P2: Skip Link and Dynamic Announcements Are Missing

**Evidence:** The UX completeness report found no skip link and no `aria-live` announcements for incoming reports or status changes.

**Why it matters:** Accessibility defects become operational defects when staff rely on keyboard navigation, screen magnification, or assistive tech.

**Fix:** Add a shared skip link and a polite/assertive live-region strategy for new reports, dispatch state changes, and offline/degraded transitions.

### P2: Mobile/Tablet Is Hard-blocked

**Evidence:** `MobileGate` blocks access below the desktop breakpoint, per the UX completeness report.

**Why it matters:** The main command center can remain desktop-first, but admins may need read-only status on tablets or phones during field coordination.

**Fix:** Replace the hard block with a read-only mobile status surface: situation summary, affected municipalities, active blockers, live/degraded status, and emergency contacts/actions appropriate for mobile.

### P3: Onboarding, Search, and Rate-limit Feedback Are Incomplete

**Evidence:** The UX completeness report found no first-run onboarding, no search, generic login validation, and missing rate-limit handling.

**Why it matters:** These are not as urgent as command trust and crisis visibility, but they affect adoption and daily use.

**Fix:** Add contextual help after core command flows are reliable. Start with search for report ID, municipality, responder, and dispatch ID.

## Reordered Implementation Backlog

### This Sprint

1. Fix or remove dashboard `Re-dispatch`.
2. Add success feedback for high-stakes actions.
3. Replace ambiguous dash placeholders with explicit unknown/degraded copy.
4. Add skip link.

### Next Sprint

5. Add province situation strip to the dashboard.
6. Add thresholds and operational labels to KPI cards.
7. Add dashboard mode rules for calm, active, degraded, and surge.
8. Add `aria-live` announcements for incoming reports and dispatch changes.

### Following Sprint

9. Replace hard mobile block with read-only mobile status.
10. Add global/local search.
11. Improve login validation and account recovery guidance.
12. Add rate-limit feedback and long-operation progress states.

## Nielsen Heuristic Score

| #         | Heuristic                       |     Score | Key issue                                                                |
| --------- | ------------------------------- | --------: | ------------------------------------------------------------------------ |
| 1         | Visibility of system status     |       3/4 | Live/offline exists; stale/degraded widget-level freshness is weak       |
| 2         | Match system and real world     |       3/4 | DRRMO language is good; geography-first crisis view is missing           |
| 3         | User control and freedom        |       2/4 | Dashboard re-dispatch action is not wired                                |
| 4         | Consistency and standards       |       3/4 | Header/tokens are consistent; unknown states are inconsistent            |
| 5         | Error prevention                |       2/4 | Dead high-stakes action and missing confirmations/feedback in some flows |
| 6         | Recognition rather than recall  |       3/4 | Labels are clear; users must remember thresholds                         |
| 7         | Flexibility and efficiency      |       3/4 | Keyboard shortcuts and multi-window patterns exist                       |
| 8         | Aesthetic and minimalist design |       3/4 | Restrained UI; panel hierarchy still too flat                            |
| 9         | Error recovery                  |       2/4 | Error banners exist; success/recovery guidance incomplete                |
| 10        | Help and documentation          |       2/4 | Shortcut help exists; onboarding/contextual guidance missing             |
| **Total** |                                 | **26/40** | Needs work before high-stakes pilot use                                  |

## Evidence Map

| Claim                                                                                     | Evidence                                                                          |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Dashboard route is primary command surface                                                | `apps/admin-desktop/src/routes.tsx` maps `/dashboard` to `DashboardPage`          |
| Command header provides persistent orientation                                            | `apps/admin-desktop/src/components/CommandHeader.tsx`                             |
| Main dashboard layout is stats, escalation, charts, events, responders, municipal table   | `apps/admin-desktop/src/pages/DashboardPage.tsx`                                  |
| Re-dispatch is visible but not wired                                                      | `DashboardPage.handleReDispatch`; `EscalationQueueSection` button                 |
| KPI cards lack threshold context                                                          | `apps/admin-desktop/src/components/DispatchStatsCards.tsx`                        |
| Municipal unknowns use generic placeholders                                               | `apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx`                 |
| Existing UX gaps include success feedback, skip link, mobile block, onboarding, search    | `docs/ux-evaluation-admin-desktop-2026-05-25.md`                                  |
| Operational dashboard principles require speed, action, context, geography, and freshness | `docs/research-dashboard-layout-2026-05-25.md` plus current dashboard UX research |
| Automated design anti-pattern scan found no inspected-file findings                       | `npx impeccable --json --fast ...` returned `[]` during this audit                |

## Final Product Direction

The dashboard should become a province command board, not a collection of operational widgets.

The strongest next design move is a top-level situation layer:

```text
[Province status: CALM | ACTIVE | DEGRADED | SURGE]
[Affected municipalities: Daet, Basud, Mercedes]
[Blocking response: 2 stalled dispatches]
[Responder coverage: 14 available / 3 municipalities uncovered]
[Data freshness: live 12s ago | responder feed stale 3m]
```

That layer should drive the rest of the dashboard. Charts, tables, and feed entries are supporting evidence. The first screen must make the room smarter in seconds.
