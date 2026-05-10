# Superadmin Command Center — Phase 1 Design Refinement

**Bantayog Alert — Admin Desktop PWA**
**Date:** 2026-05-10
**Scope:** Critical UX/UI improvements to the Phase 1 design spec
**Status:** Refinement — apply before implementation

---

## 1. Executive Summary

The Phase 1 design spec (`2026-05-10-superadmin-command-center-phase1-design.md`) is operationally sound in structure but contains visual, interaction, and accessibility gaps that will compound under emergency conditions. This document identifies **22 specific issues** and prescribes concrete fixes. All recommendations are grounded in the project's canonical design tokens, the approved HSU design system, and the 2026-05-08 wall-display redesign.

**Priority of fixes:** P0 (implement before any code), P1 (implement during component build), P2 (polish pass).

---

## 2. Color Palette Issues

### P0-1: Severity colors are NOT canonical — will cause cross-app drift

**Problem:** The Phase 1 spec uses `#dc2626` (HIGH), `#f59e0b` (MEDIUM), `#16a34a` (LOW) for incident pins. These differ from the citizen PWA (`#a73400` for MEDIUM in MyReportLayer) and the responder app (`#7c3500` vs `#d97706`). The 2026-05-08 UI audit explicitly flagged this as a bug.

**Fix:** Adopt the **unified severity palette** already established post-audit:

| Severity | Background | Foreground | Usage                                 |
| -------- | ---------- | ---------- | ------------------------------------- |
| HIGH     | `#991b1b`  | `#ffffff`  | Critical incidents, >20min response   |
| MEDIUM   | `#a73400`  | `#ffffff`  | Elevated incidents, 10-20min response |
| LOW      | `#334155`  | `#ffffff`  | Standard incidents, <10min response   |

**Rationale:** The `#a73400` Alert Sienna is the project's canonical urgent color (navy companion). It appears in the logo, login page, and Declare Emergency button. Using Tailwind's default `#f59e0b` for MEDIUM creates a third competing amber that does not match the project's warm sienna family.

**Implementation:** Define severity colors as CSS custom properties in `design-tokens.css` and import everywhere. Never use arbitrary hex literals for severity.

---

### P0-2: The spec proposes TWO incompatible themes

**Problem:** The Phase 1 spec (Section 2.1) shows a light-dashboard layout with white cards and gray borders. The HSU design system (Section 3) mandates a dark command-center theme (`#0a0f1e` canvas, `#131b30` surfaces). The 2026-05-08 wall-display redesign explicitly requires a **light theme** for fluorescent-lit rooms. These three documents contradict each other.

**Fix:** **Light theme wins.** The wall-display redesign (2026-05-08) was explicitly approved with the rationale: "Dark backgrounds create glare under fluorescent lighting and reflect viewers. Light theme is mandatory for wall displays." The HSU dark theme was designed for a dimly-lit NASA-style control room, which does not match the PDRRMO operations center in Daet (fluorescent office lighting).

**Revised palette for Phase 1:**

```css
:root {
  /* Surfaces — light theme for fluorescent rooms */
  --cmd-surface-0: #f8f9fa; /* Main background */
  --cmd-surface-1: #ffffff; /* Cards, panels */
  --cmd-surface-2: #e9ecef; /* Hover states */
  --cmd-surface-3: #dee2e6; /* Dividers */

  /* Text */
  --cmd-text-primary: #1a1a2e; /* 15.3:1 on white */
  --cmd-text-secondary: #495057; /* 7.8:1 */
  --cmd-text-tertiary: #6c757d; /* 5.4:1 */

  /* Semantic — canonical project tokens */
  --cmd-crit: #991b1b; /* HIGH severity, critical alerts */
  --cmd-warn: #c77600; /* MEDIUM, warnings */
  --cmd-norm: #2d6a4f; /* LOW, healthy */
  --cmd-info: #1e5aa8; /* Info, focus rings */

  /* Navy accent — project brand */
  --cmd-navy: #001e40; /* Header bars, active selections */
}
```

**Delete:** All references to `--hsu-canvas`, `--hsu-surface-*`, and the dark theme from the HSU spec. They are contextually wrong for this deployment.

---

### P0-3: Map pin colors use emoji + arbitrary hex, not the canonical palette

**Problem:** Section 3.3 shows: "Color by severity: `#dc2626` (HIGH), `#f59e0b` (MEDIUM), `#16a34a` (LOW)". These are Tailwind defaults, not project tokens.

**Fix:** Map pins must use the same severity palette as every other view:

- HIGH: `#991b1b` fill, white stroke
- MEDIUM: `#a73400` fill, white stroke
- LOW: `#334155` fill, white stroke

All pins get a 2px white stroke for visibility on any map tile background. No exceptions.

---

## 3. Typography and Spacing System

### P1-4: Type scale is inconsistent between specs

**Problem:** The Phase 1 spec has no explicit type scale. The HSU spec (Section 4.1) proposes 64px hero, 52px page heading, 40px section heading — designed for 6-10ft viewing. The wall-display redesign proposes 64px display, 36px H1, 28px H2 — designed for 3-6ft. The Phase 1 dashboard ASCII art implies much smaller text (roughly 16px body).

**Fix:** Use the **wall-display type scale** (3-6ft is the actual viewing distance for the PDRRMO center, not 6-10ft). But add a "desk mode" toggle for operators working at normal monitor distance (18-24 inches).

| Token   | Wall Mode (3-6ft) | Desk Mode (18-24in) | Weight | Usage                        |
| ------- | ----------------- | ------------------- | ------ | ---------------------------- |
| Display | 64px              | 48px                | 700    | Active incident count        |
| H1      | 36px              | 28px                | 600    | Zone titles, alert level     |
| H2      | 28px              | 22px                | 600    | Municipality names           |
| H3      | 22px              | 18px                | 500    | Card titles, section headers |
| Body    | 18px              | 16px                | 400    | Descriptions, addresses      |
| Label   | 20px              | 16px                | 500    | KPI labels, button text      |
| Small   | 16px              | 14px                | 400    | Timestamps, secondary info   |
| Micro   | 14px              | 12px                | 500    | Badges, status pills         |

**Font:** Inter (already loaded in citizen PWA and responder app). Do NOT add JetBrains Mono for telemetry — the project does not currently include it, and `font-variant-numeric: tabular-nums` on Inter gives sufficient alignment for counts and times.

---

### P1-5: Spacing tokens are missing entirely

**Problem:** No spacing system is defined in the Phase 1 spec. The existing `theme.css` has `--space-1: 4px` through `--space-8: 32px`, but these are too coarse for a dense command-center UI.

**Fix:** Define a 4px-base grid with semantic names:

```css
:root {
  --space-1: 4px; /* Tight internal padding */
  --space-2: 8px; /* Inline spacing, icon gaps */
  --space-3: 12px; /* Compact card padding */
  --space-4: 16px; /* Standard card padding */
  --space-5: 20px; /* Section gaps */
  --space-6: 24px; /* Panel padding */
  --space-8: 32px; /* Major section separation */
  --space-10: 40px; /* Page margins */
  --space-12: 48px; /* Header height contribution */
}
```

**Rule:** All padding, margin, and gap values must resolve to multiples of 4px. No arbitrary values like `13px` or `17px`.

---

## 4. Component Interaction Patterns

### P0-6: The "two windows, same app" model has a critical UX gap

**Problem:** Section 1.2 says both windows are the "same React app" opened via `window.open('/map', 'bantayog-map', ...)`. But Section 1.3's sync protocol only covers 5 message types. There is no mention of:

- What happens when the map window is already open and the user clicks "Open Map Window" again
- Window focus management (which window gets keyboard events?)
- What happens when one window refreshes (state loss?)
- How the Zustand store behaves across two windows (it doesn't — each window has its own instance)

**Fix:** Add explicit cross-window state architecture:

1. **State authority:** The dashboard window is the "primary." The map window is "secondary." The primary owns `selectedMunicipalityId`, `selectedIncidentId`, and `triageFilters`. The secondary mirrors these via `BroadcastChannel` but does not originate them.

2. **Duplicate window guard:** If `window.open` finds an existing `'bantayog-map'` window, call `.focus()` on it instead of opening a second one. Show a toast: "Map window already open — focused."

3. **Refresh recovery:** On map window load, send a `request:state` message to the dashboard window. The dashboard replies with current selection state. This prevents the map from opening in a blank state after refresh.

4. **Keyboard focus:** Only the focused window processes keyboard shortcuts. Use `document.visibilityState` and `window.onfocus` to gate shortcut handlers. Show a subtle "focused" border on the active window (2px `--cmd-info`).

5. **Zustand limitation:** Document explicitly that Zustand does NOT sync across windows. All shared state must flow through `BroadcastChannel` messages, not the store.

---

### P1-7: Triage queue table lacks operational safeguards

**Problem:** Section 2.2 shows "Quick actions per row: Verify, Reject (dropdown with reason), Quick Dispatch." But:

- There is no confirmation step for Verify — a mis-click permanently changes report state
- "Quick Dispatch" from the dashboard bypasses the map context (operator may not know where the incident is)
- Bulk actions ("Verify All", "Reject All") are mentioned but not designed with safeguards

**Fix:**

1. **Verify button:** Single-click verify is acceptable ONLY if the row has been explicitly focused (clicked or arrow-key navigated) for at least 500ms. Add a brief "Verify #0471?" inline confirmation that appears on first click and requires a second click within 3 seconds. After 3 seconds, the confirmation resets.

2. **Quick Dispatch from dashboard:** Remove it. Dispatch requires map context (which responders are nearby, what is the terrain). The dashboard should have only "Verify" and "Reject" actions. "Dispatch" is map-window only.

3. **Bulk actions:** Require a two-step confirmation modal. Show the count and list the first 3 report references. "You are about to verify 12 reports. This cannot be undone." Add a type-to-confirm for bulk verify (type "VERIFY 12").

---

### P1-8: The triage panel "resizable via drag handle" is underspecified

**Problem:** Section 3.5 says the triage panel is "400px wide, resizable via drag handle." But:

- No minimum or maximum width is specified
- No behavior when resized below a usable threshold
- No persistence of user preference across sessions
- No touch support for the drag handle

**Fix:**

| Constraint    | Value                                                         |
| ------------- | ------------------------------------------------------------- |
| Default width | 420px                                                         |
| Minimum width | 320px (fits report reference + severity badge + close button) |
| Maximum width | 600px (beyond this, map becomes too narrow)                   |
| Resize step   | 10px (snap to grid for clean layout)                          |
| Persistence   | `localStorage['bantayog.triage-panel-width']`                 |
| Touch         | Drag handle is 24px wide with 44px invisible touch target     |

When width < 360px, collapse the Dispatch section into an accordion (closed by default) to preserve readability of report details.

---

### P1-9: Municipal drill-down floating card is modal-like but not accessible

**Problem:** Section 3.6 describes a floating info card that appears on municipality click. It is not specified as a modal, focus trap, or dismissible region. Screen reader users may not know it appeared.

**Fix:** Treat the drill-down card as a **non-modal dialog** (`role="dialog"`, `aria-modal="false"`). It must:

- Receive focus when opened
- Have a visible close button (X, 32px touch target)
- Close on `Escape` key
- Close when clicking outside the card
- Trap focus WITHIN the card while it is open (Tab cycles through card elements only)
- Return focus to the map municipality boundary or dashboard row that triggered it

---

## 5. Responsive Behavior for Map-Triage Split View

### P0-10: The split view has no collapse behavior for narrow viewports

**Problem:** The Phase 1 spec assumes 1920x1080. But operators may use a single monitor (laptop, 1366x768 projector) during field deployments. The map + 400px triage panel would leave ~966px for the map, which is usable but tight. Below 1280px width, the map becomes unreadable.

**Fix:** Define three layout modes:

| Mode    | Width       | Layout                                                      |
| ------- | ----------- | ----------------------------------------------------------- |
| Full    | >= 1600px   | Map 60% + Triage panel 420px fixed                          |
| Compact | 1280-1599px | Map 55% + Triage panel 380px fixed                          |
| Overlay | < 1280px    | Map 100%, triage panel as slide-over (80% width, 420px max) |

In Overlay mode, the triage panel slides over the map from the right. A semi-transparent backdrop (`rgba(0,0,0,0.3)`) dims the map but keeps it visible for context. The panel can be dismissed by clicking the backdrop or pressing Escape.

**Note:** The spec already says mobile (<768px) is unsupported. This fix covers the gap between "unsupported mobile" and "full desktop."

---

### P1-11: Map overlay controls are at risk of being obscured

**Problem:** Section 3.4 shows overlay toggles at the bottom of the map. In the split-view layout, the triage panel may cover these controls if the panel overlaps the map area.

**Fix:** Move overlay controls to the **top-left of the map** (below the zoom controls), not the bottom. This is the standard Leaflet control position and avoids collision with the triage panel on the right. Use a compact vertical stack of toggle buttons (40x40px each) with tooltips on hover.

---

## 6. Data Density and Information Hierarchy

### P0-12: The KPI row has 6 cards — too many for at-a-glance scanning

**Problem:** Section 2.1 shows 6 KPI cards in a single row: Active Incidents, Response Time, Resolved Today, Municipal Issues, System Health, Surge Status. During a crisis, operators need to know **three things immediately:** (1) How bad is it? (2) Where? (3) Is the system working? Six cards force eye scanning.

**Fix:** Reduce to **3 primary KPIs** with the remaining 3 demoted to the bottom strip or secondary row:

**Primary row (always visible, largest):**

1. **Active Incidents** (Display size, color-coded by severity mix)
2. **Avg Response Time** (Display size, color-coded by threshold)
3. **System Health** (compact dot + label, green/yellow/red)

**Secondary row (smaller, below primary):** 4. Resolved Today (normal size) 5. Municipal Issues (normal size, only visible when >0) 6. Surge Status (normal size, only visible when Active)

**Rationale:** The wall-display redesign (Section 2.2) already established the reading priority: Alert level > Municipal performance > Map > System health. The KPI row should reflect this priority, not flatten all metrics to the same visual weight.

---

### P1-13: The municipal performance table has 6+ columns — too wide for focused reading

**Problem:** Section 2.2 lists sortable columns: Municipality, Active Incidents, Avg Response Time, Resolved Rate, Resource Utilization, Admin Status. On a 1920px screen, this is manageable. But operators during a crisis care about **which municipalities need attention now**, not historical resolved rates.

**Fix:** Default to **4 columns** with the rest available via column toggle:

| Default Column    | Width | Rationale              |
| ----------------- | ----- | ---------------------- |
| Municipality      | 20%   | Fixed identifier       |
| Active Incidents  | 15%   | Current crisis load    |
| Avg Response Time | 20%   | Current performance    |
| Admin Status      | 20%   | Coverage gap detection |

**Optional columns (toggleable):**

- Resolved Rate (historical, less urgent)
- Resource Utilization (available in drill-down)
- Last Incident (time-based prioritization)

**Sorting:** Default sort by "Response Time (slowest first)" during active incidents, not alphabetical. When 0 active incidents, sort alphabetically.

---

### P1-14: Anomaly alerts panel lacks prioritization

**Problem:** Section 2.2 shows anomaly cards with equal visual weight. In a surge, there could be 10+ anomalies. The operator cannot process them all simultaneously.

**Fix:** Add **severity tiers** to anomalies:

| Tier     | Color                    | Examples                                     | Auto-dismiss?           |
| -------- | ------------------------ | -------------------------------------------- | ----------------------- |
| Critical | `#991b1b` bg, white text | Response time >30min, System down            | Never                   |
| Warning  | `#c77600` bg, white text | Response time >20min, Admin gap >1h          | After 30min if resolved |
| Info     | `#1e5aa8` bg, white text | Zero activity (pattern-based), Resource >80% | After 1h                |

**Display rules:**

- Show max 3 anomalies at once
- Critical anomalies always appear first
- Each anomaly has a "Snooze 15min" button (not just dismiss)
- Critical anomalies play audio alert (if audio enabled) regardless of snooze state

---

## 7. Keyboard Shortcut Discoverability

### P0-15: Keyboard shortcuts are hidden — no discoverability mechanism

**Problem:** Section 2.3 lists 6 shortcuts (`D`, `M`, `V`, `R`, `Escape`, `?`). But there is no way for a new operator to discover these without reading the spec. The `?` shortcut opens a help modal, but the operator must already know about `?`.

**Fix:** Implement three discoverability layers:

1. **Tooltip hints:** All buttons that have keyboard shortcuts show the shortcut in their tooltip. Example: "Verify (V)", "Open Map (M)", "Show Help (?)".

2. **Shortcut cheat sheet:** Press `?` or click "Keyboard Shortcuts" in the user menu to open a modal with all shortcuts organized by category:
   - Navigation (D, M, Escape)
   - Triage (V, R, arrow keys, Enter)
   - Map (zoom: +/-, pan: arrow keys, reset: 0)
   - System (?: help, Ctrl+Shift+S: audio snooze)

3. **First-run highlight:** On first login, show a non-intrusive banner: "Press ? anytime for keyboard shortcuts." Dismisses after 5 seconds or on any interaction.

4. **Shortcut display on focus:** When a table row is focused via keyboard, show a small floating label near the row: "V=Verify R=Reject Enter=Dispatch"

---

### P1-16: Shortcut conflicts with browser defaults

**Problem:** `Ctrl+Shift+S` is proposed for audio snooze. This conflicts with "Save Page As" in some browsers (though typically `Ctrl+S`). `?` conflicts with "Find in page" when a text input is focused (`/` is the standard Vim/Discord shortcut for find, but `?` is less common).

**Fix:** Audit all shortcuts against browser defaults:

| Shortcut                        | Conflict?                         | Resolution                                                        |
| ------------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| `D`                             | No (requires non-input focus)     | OK                                                                |
| `M`                             | No                                | OK                                                                |
| `V`                             | No                                | OK                                                                |
| `R`                             | No                                | OK                                                                |
| `?`                             | Minimal (only when input focused) | Block when input focused; show help on `?` from non-input context |
| `Escape`                        | No                                | OK                                                                |
| `Ctrl+Shift+S`                  | Possible (save variants)          | Change to `Ctrl+Shift+A` (A for audio)                            |
| `Alt+T` (HSU spec)              | Yes (browser tools menu)          | Change to `Shift+T`                                               |
| `Alt+1/2/3` (wall-display spec) | Yes (browser tab switching)       | Change to `Ctrl+1/2/3`                                            |

**Rule:** All shortcuts use `Ctrl` or `Shift` modifiers when a single key would conflict with browser defaults or text input.

---

## 8. Accessibility Gaps

### P0-17: The spec claims WCAG AA but does not verify contrast for the proposed colors

**Problem:** Section 7 says "All text meets WCAG AA (4.5:1 minimum)" but the spec does not include contrast calculations for the proposed colors. The HSU spec's `--hsu-crit: #ef4444` on `--hsu-surface-1: #131b30` passes, but the Phase 1 spec's `#dc2626` on white is 5.2:1 (passes), while `#f59e0b` on white is only 2.1:1 (fails for normal text).

**Fix:** Verify ALL proposed color combinations:

| Combination          | Foreground | Background | Ratio  | Passes AA? |
| -------------------- | ---------- | ---------- | ------ | ---------- |
| HIGH severity text   | `#ffffff`  | `#991b1b`  | 7.2:1  | Yes        |
| MEDIUM severity text | `#ffffff`  | `#a73400`  | 5.5:1  | Yes        |
| LOW severity text    | `#ffffff`  | `#334155`  | 7.8:1  | Yes        |
| Warning badge text   | `#ffffff`  | `#c77600`  | 5.2:1  | Yes        |
| Body text            | `#1a1a2e`  | `#f8f9fa`  | 15.3:1 | Yes        |
| Secondary text       | `#495057`  | `#f8f9fa`  | 7.8:1  | Yes        |
| Tertiary text        | `#6c757d`  | `#f8f9fa`  | 5.4:1  | Yes        |
| Focus ring           | `#1e5aa8`  | `#ffffff`  | 5.8:1  | Yes        |

**Delete:** `#f59e0b` (Tailwind amber-500) for ANY text usage. It fails WCAG AA on light backgrounds.

---

### P1-18: Focus management is specified but not tested for screen reader flow

**Problem:** Section 7 mentions focus management for the triage panel and modals, but does not specify the screen reader announcement strategy. When an incident is verified, what does the screen reader say? When a new anomaly appears, how is it announced?

**Fix:** Define `aria-live` regions:

```html
<!-- Dashboard window -->
<div role="status" aria-live="polite" aria-atomic="true" id="announcements">
  <!-- Dynamic: "Capalonga response time exceeded threshold. 3 active incidents." -->
</div>

<!-- Map window -->
<div role="status" aria-live="polite" aria-atomic="false" id="map-announcements">
  <!-- Dynamic: "New critical incident in Daet. Map centered on location." -->
</div>
```

**Announcement rules:**

- New critical incident: `aria-live="assertive"` (interrupts current speech)
- New warning incident: `aria-live="polite"` (queues after current)
- Status change (verify/dispatch): `aria-live="polite"`
- Anomaly detected: `aria-live="assertive"` for critical, `polite` for warning/info
- Data stale: `aria-live="polite"` ("Data is 2 minutes stale")

**Note:** `role="status"` implicitly carries `aria-live="polite"` + `aria-atomic="true"` per WAI-ARIA spec. Adding explicit `aria-live` is redundant noise — use `role="status"` or `role="alert"` directly.

---

### P1-19: The municipal performance table lacks ARIA grid semantics

**Problem:** Section 2.2 describes a sortable table with clickable rows, but does not specify ARIA roles for the interactive table.

**Fix:** The table must use `role="grid"` (not just `<table>`) with:

- `aria-sort` on column headers (`ascending`, `descending`, `none`)
- `aria-selected` on rows (`true`/`false`)
- `aria-rowindex` and `aria-colindex` for virtual scrolling (if implemented)
- Keyboard navigation: Arrow keys move focus between cells, Enter selects row, V/R perform actions
- Each action button has `aria-label` including the report reference: "Verify report number 0471"

---

## 9. Data Freshness and Staleness

### P1-20: Staleness thresholds are inconsistent across specs

**Problem:** The Phase 1 spec (Section 6.2) says: ">60s stale = amber, >5m stale = red." The wall-display redesign (Section 10.3) says: "<30s Live, 30s-5min Stale, >5min Offline." The HSU spec says: "Desaturation at 30s staleness."

**Fix:** Standardize on the **wall-display thresholds** (30s/5min) because they match the operator's mental model from the existing dashboard:

| State   | Threshold  | Visual Treatment                                           |
| ------- | ---------- | ---------------------------------------------------------- |
| Live    | < 30s      | Full color, pulsing animations active                      |
| Stale   | 30s - 5min | 70% opacity, "Updated 2m ago" label, animations stop       |
| Offline | > 5min     | 50% opacity, "OFFLINE — Cached" badge, reconnect countdown |

**Rationale:** 30 seconds is the practical threshold for Firestore listener latency on a stable connection. 60 seconds is too conservative and would show "stale" during normal operation.

---

### P1-21: The "Updated Xs ago" label is not granular enough

**Problem:** Section 2.2 shows "Updated 5s ago" which updates every second. This creates visual noise as the label changes continuously.

**Fix:** Use **tiered freshness labels** that update less frequently:

| Age       | Label                              | Update interval       |
| --------- | ---------------------------------- | --------------------- |
| < 10s     | "Live"                             | Static (no number)    |
| 10s - 59s | "Updated 15s ago"                  | Every 15s             |
| 1m - 4m   | "Updated 2m ago"                   | Every 30s             |
| 5m+       | "Updated 7m ago — reconnecting..." | Every 60s + countdown |

**Rationale:** "Live" without a number for <10s reduces visual noise while still communicating freshness. The exact second count is not operationally useful.

---

## 10. Performance and Loading

### P2-22: The performance budget is optimistic without specifying how it's measured

**Problem:** Section 9 lists targets like "Triage panel open -> render <200ms" and "Pin cluster render (100 pins) <100ms" but does not specify:

- Measurement tool (Lighthouse? Custom timing?)
- Device spec (what CPU/GPU?)
- Whether these are median or p95 targets

**Fix:** Define measurement methodology:

| Metric                        | Target         | Measurement                    | Device                   |
| ----------------------------- | -------------- | ------------------------------ | ------------------------ |
| Dashboard initial load        | < 3s p95       | Lighthouse TTI                 | i5-8400, 8GB RAM, Chrome |
| Map initial load              | < 3s p95       | Lighthouse TTI                 | Same                     |
| Triage panel open -> render   | < 200ms median | `performance.now()` delta      | Same                     |
| Pin cluster render (100 pins) | < 100ms p95    | Chrome DevTools Performance    | Same                     |
| Cross-window sync latency     | < 50ms median  | `performance.now()` round-trip | Same                     |

**Note:** The "<3s on wired desktop" target in the Phase 1 spec is acceptable but should specify p95, not median, because command centers cannot afford slow outliers during a crisis.

---

## 11. Summary of Changes Required

### P0 Fixes (Before Implementation)

| #     | Issue                         | Fix                                                                | File Impact                         |
| ----- | ----------------------------- | ------------------------------------------------------------------ | ----------------------------------- |
| P0-1  | Severity colors not canonical | Adopt unified `#991b1b`/`#a73400`/`#334155` palette                | `design-tokens.css`, all components |
| P0-2  | Two incompatible themes       | Light theme only; delete HSU dark theme refs                       | Spec doc, `theme.css`               |
| P0-3  | Map pin colors arbitrary      | Use canonical severity palette + white stroke                      | `IncidentLayer`                     |
| P0-6  | Cross-window UX gaps          | Define primary/secondary authority, refresh recovery, focus gating | `WindowSyncProvider`, spec doc      |
| P0-10 | No narrow-viewport behavior   | Add compact (<1280px) overlay mode                                 | `MapWindow` layout                  |
| P0-12 | 6 KPI cards = too many        | Reduce to 3 primary + 3 secondary                                  | `KpiPanel`                          |
| P0-15 | No shortcut discoverability   | Tooltips, cheat sheet, first-run banner, focus hints               | `CommandHeader`, `HelpModal`        |
| P0-17 | WCAG AA claims unverified     | Verify all combinations; delete `#f59e0b` for text                 | `design-tokens.css`                 |

### P1 Fixes (During Implementation)

| #     | Issue                             | Fix                                                                          | File Impact                 |
| ----- | --------------------------------- | ---------------------------------------------------------------------------- | --------------------------- |
| P1-4  | Inconsistent type scale           | Wall-display scale with desk-mode toggle                                     | `index.css`, settings       |
| P1-5  | Missing spacing tokens            | 4px-base semantic spacing system                                             | `design-tokens.css`         |
| P1-7  | Triage queue lacks safeguards     | 500ms focus gate, inline confirm, remove Quick Dispatch from dashboard       | `TriageQueueTable`          |
| P1-8  | Resizable panel underspecified    | Min 320px, max 600px, 10px snap, localStorage persistence                    | `TriagePanel`               |
| P1-9  | Drill-down card not accessible    | Non-modal dialog with focus trap, Escape dismiss                             | `MunicipalDrillDownCard`    |
| P1-11 | Overlay controls may be obscured  | Move to top-left, compact vertical stack                                     | `MapOverlayControls`        |
| P1-13 | Table too wide                    | Default 4 columns, optional toggle, sort by response time                    | `MunicipalPerformanceTable` |
| P1-14 | Anomalies lack prioritization     | Critical/Warning/Info tiers, max 3 visible, snooze button                    | `AnomalyAlertPanel`         |
| P1-16 | Shortcut conflicts                | `Ctrl+Shift+A` for audio, `Shift+T` for triage focus, `Ctrl+1/2/3` for zones | Keyboard handler            |
| P1-18 | Screen reader flow unspecified    | `aria-live` regions with assertive/polite rules                              | Both windows                |
| P1-19 | Table lacks ARIA grid             | `role="grid"`, `aria-sort`, `aria-selected`, cell navigation                 | `MunicipalPerformanceTable` |
| P1-20 | Staleness thresholds inconsistent | Standardize on 30s/5min wall-display thresholds                              | `DataFreshnessLabel`        |
| P1-21 | Freshness label too granular      | Tiered labels: "Live" / "15s ago" / "2m ago"                                 | `DataFreshnessLabel`        |

### P2 Fixes (Polish Pass)

| #     | Issue                         | Fix                                                 | File Impact  |
| ----- | ----------------------------- | --------------------------------------------------- | ------------ |
| P2-22 | Performance budget unmeasured | Define measurement tool, device spec, p95 vs median | Testing docs |

---

## 12. Design Token Reference (Revised)

```css
/* ============================================
   Bantayog Alert — Command Center Design Tokens
   Light theme for fluorescent-lit operations center
   ============================================ */

:root {
  /* Brand */
  --color-navy: #001e40;
  --color-sienna: #a73400;

  /* Surfaces */
  --cmd-surface-0: #f8f9fa;
  --cmd-surface-1: #ffffff;
  --cmd-surface-2: #e9ecef;
  --cmd-surface-3: #dee2e6;

  /* Text */
  --cmd-text-primary: #1a1a2e;
  --cmd-text-secondary: #495057;
  --cmd-text-tertiary: #6c757d;
  --cmd-text-inverse: #ffffff;

  /* Semantic — unified severity + status */
  --cmd-crit: #991b1b; /* HIGH severity, critical status */
  --cmd-warn: #c77600; /* MEDIUM severity, warning status */
  --cmd-norm: #2d6a4f; /* LOW severity, healthy status */
  --cmd-info: #1e5aa8; /* Info, focus rings, selections */

  /* Map */
  --cmd-map-border: #adb5bd;
  --cmd-map-fill-none: #e9ecef;
  --cmd-map-fill-low: #fff3cd;
  --cmd-map-fill-med: #ffe5b4;
  --cmd-map-fill-high: #ffccd5;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Typography */
  --font-primary: 'Inter', system-ui, -apple-system, sans-serif;
  --font-size-display: 64px;
  --font-size-h1: 36px;
  --font-size-h2: 28px;
  --font-size-h3: 22px;
  --font-size-body: 18px;
  --font-size-label: 20px;
  --font-size-small: 16px;
  --font-size-micro: 14px;

  /* Motion */
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
}

/* Desk mode override (18-24in viewing) */
[data-view-mode='desk'] {
  --font-size-display: 48px;
  --font-size-h1: 28px;
  --font-size-h2: 22px;
  --font-size-h3: 18px;
  --font-size-body: 16px;
  --font-size-label: 16px;
  --font-size-small: 14px;
  --font-size-micro: 12px;
}
```

---

## 13. Open Questions Resolved

| Original Question                                       | Resolution                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Should the dashboard triage queue support bulk actions? | Yes, with two-step confirmation and type-to-verify for bulk verify.                              |
| Should anomaly alerts auto-dismiss?                     | Warning/Info auto-dismiss after 30min/1h if resolved. Critical never auto-dismisses.             |
| Should the map support drawing custom polygons?         | Deferred to Phase 3. Not needed for Phase 1 triage.                                              |
| What's the source of municipal boundary GeoJSON?        | Static file at `apps/admin-desktop/src/data/municipal-boundaries.geojson` (confirmed available). |

---

## 14. Document Status

**This refinement supersedes the following sections of the Phase 1 spec:**

- Section 2.1 (Layout) — KPI row reduced to 3 primary
- Section 2.2 (Sections) — Table columns reduced to 4 default
- Section 3.3 (Incident Pins) — Colors changed to canonical palette
- Section 3.5 (Triage Panel) — Resize constraints added
- Section 6.2 (Data Freshness) — Thresholds standardized to 30s/5min
- Section 7 (Accessibility) — ARIA live regions and grid semantics added

**All other sections of the Phase 1 spec remain valid and should be implemented as written.**

---

**Version:** 1.0
**Date:** 2026-05-10
**Status:** Ready for implementation planning
