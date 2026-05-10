# Superadmin Command Center — Phase 1 Design

**Bantayog Alert — Admin Desktop PWA**
**Date:** 2026-05-10
**Scope:** Core Dashboard + Provincial Map + Triage (Phase 1 of 4)
**Deferred:** NDRRMC Escalation, Break-Glass Access

---

## 1. Overview

The Provincial Superadmin Command Center is a dual-window desktop PWA designed for the PDRRMO operations center in Daet, Camarines Norte. Phase 1 delivers the daily-use surfaces: an analytics dashboard and a provincial map with integrated triage capabilities. Two browser windows run side-by-side on dual monitors — one for situational awareness, one for operational control.

### 1.1 Design Principles

1. **Analytics-first, map-operational.** The dashboard window shows province-wide KPIs and trends. The map window is where triage actions happen.
2. **Speed over polish.** Command center operators work under time pressure. Every action must be reachable in ≤2 clicks.
3. **Dual-window native.** Two browser windows that behave as one application. State syncs seamlessly via BroadcastChannel.
4. **Real-time honesty.** All data shows freshness indicators. Stale data is visually distinct from live data.
5. **No offline mutations.** Admin mutations require connectivity. Reconnect banner blocks mutation UI when offline.

### 1.2 Window Model

**Single React app** (Vite build), two primary routes:

| Window    | Route        | Purpose                  | Primary Content                                |
| --------- | ------------ | ------------------------ | ---------------------------------------------- |
| Dashboard | `/dashboard` | Analytics + Triage Queue | KPIs, municipal table, trends, triage queue    |
| Map       | `/map`       | Provincial Map + Triage  | Leaflet map, incident pins, triage split panel |

The dashboard opens the map window via:

```typescript
window.open('/map', 'bantayog-map', 'width=1200,height=900')
```

Named target `'bantayog-map'` prevents duplicate map windows.

### 1.3 Cross-Window Sync Protocol

**Primary:** `BroadcastChannel('bantayog-admin-sync')`
**Fallback:** `window.addEventListener('storage', ...)` on shared `localStorage` keys. Messages older than 5 seconds are ignored.

```typescript
type SyncMessage =
  | { type: 'select:report'; reportId: string; source: 'dashboard' | 'map' }
  | { type: 'select:municipality'; municipalityId: string; source: 'dashboard' | 'map' }
  | { type: 'triage:action'; reportId: string; action: 'verified' | 'rejected' | 'dispatched' }
```

**Behavior:**

- Dashboard selects municipality row → map receives `select:municipality`, zooms to municipal bounds
- Map clicks report pin → dashboard receives `select:report`, scrolls triage queue to that row
- Triage action on either window → other window receives `triage:action`, shows toast confirmation

---

## 2. Dashboard Window (`/dashboard`)

### 2.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏛️ PDRRMO Camarines Norte        [🟢 Live]  [🔔 3]  [🗺️ Open Map Window]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Active Incidents: 47   │   Avg Response: 12 min   │   Pending: 8    │   │
│  │                    [▼ more: Resolved 89 │ Muni Issues 0/12]         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌────────────────────────────────────┐  ┌─────────────────────────────┐   │
│  │ MUNICIPAL PERFORMANCE TABLE        │  │ ANOMALY ALERTS              │   │
│  │ ┌────────┬────────┬────────┬─────┐ │  │ ⚠️ Capalonga: Response time │   │
│  │ │Muni    │Active  │Avg Resp│Admin│ │  │    up 40% (18 min avg)      │   │
│  │ ├────────┼────────┼────────┼─────┤ │  │ [Investigate] [Dismiss]     │   │
│  │ │Daet    │  12    │ 8 min ✅│ 🟢 │ │  │                             │   │
│  │ │Labo    │   8    │15 min ⚠️│ 🟢 │ │  │ ⚠️ Capalonga: No admin shift│   │
│  │ │Capalong│   3    │18 min ❌│ ⚠️ │ │  │    handoff for 8h           │   │
│  │ │...     │  ...   │  ...   │ ...│ │  │ [Contact Admin] [Dismiss]   │   │
│  │ └────────┴────────┴────────┴─────┘ │  └─────────────────────────────┘   │
│  │ (click row → highlights on map)    │                                    │
│  └────────────────────────────────────┘                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TREND ANALYSIS — Last 7 Days                                        │   │
│  │ [Incident Volume] [Response Time] [Resource Util] [Muni Comparison] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TRIAGE QUEUE — Pending Verification                                 │   │
│  │ ┌────────┬────────┬────────┬────────┬────────┬──────────────────┐   │   │
│  │ │Time    │Type    │Severity│Muni    │Barangay│Actions           │   │   │
│  │ ├────────┼────────┼────────┼────────┼────────┼──────────────────┤   │   │
│  │ │2m ago  │Flood   │🔴 HIGH │Daet    │Camambug│[✓] [✕] [Dispatch]│   │   │
│  │ │8m ago  │Fire    │🟡 MED  │Labo    │San Roq │[✓] [✕] [Dispatch]│   │   │
│  │ │...     │...     │...     │...     │...     │...               │   │   │
│  │ └────────┴────────┴────────┴────────┴────────┴──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Sections

#### Header Bar

- **Left:** PDRRMO branding + "Camarines Norte" subtitle
- **Center:** Live indicator (pulsing green dot) + data freshness ("Updated 5s ago")
- **Right:** Notification bell with count, "Open Map Window" button, user avatar dropdown

#### Status Bar (3 always-visible metrics)

A single dense horizontal strip replacing the hero-metric card grid. Shows only what an operator needs at a glance during active response.

| Metric            | Value  | Alert Threshold    |
| ----------------- | ------ | ------------------ |
| Active Incidents  | 47     | >50 amber, >75 red |
| Avg Response Time | 12 min | >15 amber, >20 red |
| Pending Triage    | 8      | >5 amber, >10 red  |

**Expanded detail** (click/toggle to reveal): Resolved Today, Municipal Issues, System Health, Surge Status. Detail auto-collapses when Pending Triage > 0 to keep focus on action items.

#### Municipal Performance Table

- Sortable columns: Municipality, Active Incidents, Avg Response Time, Resolved Rate, Resource Utilization, Admin Status
- Click row → sends `select:municipality` sync message → map window zooms to municipality
- Admin Status: 🟢 On Duty, 🟡 No Shift, 🔴 Gap >30min
- Response time: ✓ <12min, ⚠ 12-20min, ✕ >20min
- **Collapsible:** When Pending Triage > 0, the table collapses to a single horizontal strip showing "12 municipalities monitored — 1 issue detected (Capalonga)". Click to expand the full table. This gives the triage queue vertical priority during active response.

#### Anomaly Alerts Panel

- Auto-surfaced cards for detected anomalies
- One-click dismiss with reason ("investigating", "false_positive", "resolved")
- Types: response time spike, resolution rate drop, resource over-utilization, zero activity, admin shift gap

#### Trend Analysis Charts

- Tabbed chart area: Incident Volume (line), Response Time (bar), Resource Utilization (heatmap), Municipal Comparison (bar)
- Time range: Last 7 days (default), 24h, 30d
- **Adaptive visibility:** When Pending Triage > 0, the chart panel collapses to a single horizontal bar showing only the current tab's title and mini-sparkline. Clicking the bar expands the full panel. This keeps the triage queue above the fold during active response without hiding the charts entirely.

#### Triage Queue Table

- Sortable, filterable table of pending verification reports
- Columns: [☑], Time, Type, Severity, Municipality, Barangay, Actions
- **Bulk actions:** Multi-select via row checkboxes → "Verify Selected" / "Reject Selected" buttons appear in table header
- Quick actions per row: Verify, Reject (dropdown with reason), Quick Dispatch
- Click row → sends `select:report` sync message → map window centers on report pin
- **Power-user pattern:** Arrow keys navigate rows. `V` = verify focused row. `Shift+V` = verify all selected. `R` = reject focused row. `Ctrl+D` = quick-dispatch with last-used agency.

### 2.3 Keyboard Shortcuts

| Key       | Action                                             |
| --------- | -------------------------------------------------- |
| `D`       | Focus dashboard window                             |
| `M`       | Focus or open map window                           |
| `V`       | Verify focused report                              |
| `Shift+V` | Verify all selected reports (bulk)                 |
| `R`       | Reject focused report                              |
| `Shift+R` | Reject all selected reports (bulk)                 |
| `Ctrl+D`  | Quick dispatch with last-used agency (hold 1s)     |
| `N`       | Jump to next new report (highest severity, newest) |
| `Escape`  | Clear selection, close modals                      |
| `?`       | Show shortcut help modal                           |

**Auto-open map:** On initial login, if the dashboard detects no existing map window, it auto-opens `/map` after a 2-second delay (prevents popup blockers). Operator can disable this in preferences.

---

## 3. Map Window (`/map`)

### 3.1 Layout

**Persistent split view.** Left = map (60-75% when panel open, 100% when closed). Right = triage panel (slides in when pin selected).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🗺️ Provincial Map — Camarines Norte    [🟢 Live]  [🔔 3]  [👤 Profile]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────┐  ┌─────────────────────┐ │
│  │                                              │  │ TRIAGE PANEL        │ │
│  │         🗺️ LEAFLET MAP                       │  │                     │ │
│  │                                              │  │ 📍 Daet, Camambugan │ │
│  │    🔴 12           🟡 5                      │  │ 🌊 Flood · 🔴 HIGH  │ │
│  │         🔴 3                                 │  │                     │ │
│  │              🟢 8                            │  │ "Water rising..."   │ │
│  │    🔴 8                                      │  │ 📸 2 photos         │ │
│  │         🟡 2    🟢 4                         │  │ 📞 0917xxx          │ │
│  │                                              │  │                     │ │
│  │                                              │  │ [✓ Verify]          │ │
│  │                                              │  │ [✕ Reject]          │ │
│  │                                              │  │                     │ │
│  │                                              │  │ ── DISPATCH ──      │ │
│  │                                              │  │ Agency: [BFP ▼]     │ │
│  │                                              │  │ Responder: [Santos▼]│ │
│  │                                              │  │ [🚑 Dispatch]       │ │
│  │                                              │  │                     │ │
│  │                                              │  │ ── TIMELINE ──      │ │
│  │                                              │  │ 14:02 Submitted     │ │
│  │                                              │  │ 14:05 In Queue      │ │
│  │                                              │  └─────────────────────┘ │
│  │                                              │                          │
│  └──────────────────────────────────────────────┘                          │
│                                                                             │
│  [Map Overlays]  ☑ All Incidents  ☑ Heatmap  ☑ Active Only                │
│                  ☑ Responder Locations  ☑ Provincial Resources             │
│                  ☑ Municipal Labels                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Map Configuration

- **Library:** Leaflet + OpenStreetMap tiles
- **Default view:** Province-wide, all 12 municipalities visible
- **Center:** ~14.1°N, 122.9°E (Camarines Norte centroid)
- **Zoom:** 10 (province view), 13 (municipality drill-down)

### 3.3 Incident Pins (Lucide React Icons)

Pins use **Lucide React icons rendered as `L.divIcon`** (offline-friendly, no CDN dependency):

| Type      | Icon            | Color            |
| --------- | --------------- | ---------------- |
| Flood     | `Waves`         | Severity-colored |
| Fire      | `Flame`         | Severity-colored |
| Landslide | `Mountain`      | Severity-colored |
| Accident  | `Car`           | Severity-colored |
| Medical   | `HeartPulse`    | Severity-colored |
| Other     | `AlertTriangle` | Severity-colored |

**Severity pulse colors** (aligned to project canonical palette):

- High: `#a73400` (alert-sienna)
- Medium: `#7c3500` (deep amber)
- Low: `#414849` (muted slate)

Each icon has a CSS pulse animation. Respects `prefers-reduced-motion: reduce`.

> **Why not green for Low?** Green signals "all clear / resolved" in this product's visual vocabulary. A muted slate indicates "lower urgency" without implying the incident is benign or complete.

**Responder dots:** Solid blue (`#2563eb`), 6px diameter, no pulse.

**Clustering:** Enabled at zoom < 12. Shows count badge. Color mixed from contained severities.

**Click behavior:**

- Click report pin → Triage Panel slides in from right
- Click map background → Triage Panel closes

### 3.4 Map Overlay Toggles (floating toolbar, top-right)

**Primary toggles** (always visible):
`☑ All Incidents` `☑ Active Only` `☑ Responder Locations`

**Secondary toggles** (collapsed under "More ▼"):
`☑ Heatmap` `☑ Provincial Resources` `☑ Municipal Labels`

**Mutual exclusivity:** "All Incidents" and "Active Only" are a segmented control — exactly one is active. All other toggles are additive layers.

_(Municipal boundaries removed per user feedback — operators know the geography.)_

### 3.5 Triage Panel (Right Side)

**Hidden when no pin selected.** The map occupies 100% width. When a pin is clicked, the panel animates in (CSS transition, 200ms). Map shrinks to 60-75%.

**Panel close:** X handle, `Escape` key, or clicking map background.

**Panel content (no Report ID displayed):**

- Municipality, Barangay
- Type + Severity badge
- Description (expandable)
- Photo thumbnails (click to expand)
- Reporter contact (with disclosure banner: "Private citizen data — this access is logged")
- Action buttons:
  - **[Verify]** — green, primary action
  - **[Reject]** — red, opens reason dropdown
  - **[Dispatch Responder]** — blue, expands dispatch form
- **Dispatch Form:**
  - Agency selector (dropdown)
  - Responder selector (filtered by agency + availability)
  - Dispatch button
- **Activity Timeline:** Chronological list of report events with timestamps

### 3.6 Municipal Drill-Down

**Trigger:** Click a municipality label on the map, or select a row in the dashboard's Municipal Performance Table.

**Behavior:** Map zooms to municipality bounds (zoom 13). A floating info card appears anchored to the municipality centroid:

```
┌────────────────────────────┐
│ Capalonga Municipality     │
│ Admin: Santos (On Duty)    │
│                            │
│ Active Incidents: 3        │
│ Available Responders: 9/15 │
│ Avg Response: 18 min ❌    │
│                            │
│ [View All] [Contact Admin] │
└────────────────────────────┘
```

---

## 4. Component Hierarchy

```
App
├── AuthProvider (from @bantayog/shared-ui)
├── WindowSyncProvider (BroadcastChannel/localStorage)
│
├── DashboardWindow (/dashboard)
│   ├── CommandHeader
│   ├── StatusBar (3 metrics + expandable detail)
│   ├── MunicipalPerformanceTable
│   ├── AnomalyAlertPanel
│   ├── TrendAnalysisPanel (tabbed charts)
│   └── TriageQueueTable
│
└── MapWindow (/map)
    ├── CommandHeader
    ├── ProvincialMap
    │   ├── LeafletMapContainer
    │   ├── IncidentLayer (Lucide icons + pulse)
    │   ├── ResponderLayer (blue dots)
    │   ├── ResourceLayer
    │   └── HeatmapLayer
    ├── MapOverlayControls
    └── TriagePanel (conditional render)
        ├── ReportDetailCard
        ├── ActionButtons
        ├── DispatchForm
        └── ActivityTimeline
```

### 4.1 Shared Components

| Component          | Location                            | Used By      |
| ------------------ | ----------------------------------- | ------------ |
| CommandHeader      | `components/CommandHeader.tsx`      | Both windows |
| LiveIndicator      | `components/LiveIndicator.tsx`      | Both windows |
| SeverityBadge      | `components/SeverityBadge.tsx`      | Both windows |
| ReportTypeIcon     | `components/ReportTypeIcon.tsx`     | Both windows |
| DataFreshnessLabel | `components/DataFreshnessLabel.tsx` | Both windows |
| ConfirmationModal  | `components/ConfirmationModal.tsx`  | Both windows |
| OfflineBanner      | `components/OfflineBanner.tsx`      | Both windows |

---

## 5. Data Flow

### 5.1 State Ownership

Per Architecture Spec §9.4 and §12.2:

| Data Category              | Authority        | Implementation                |
| -------------------------- | ---------------- | ----------------------------- |
| Server documents           | Firestore SDK    | `onSnapshot` listeners        |
| UI state (view, selection) | Zustand          | `useCommandCenterStore`       |
| Analytics aggregates       | TanStack Query   | Callable results with caching |
| Cross-window sync          | BroadcastChannel | `useWindowSync` hook          |
| **Offline mutations**      | **Blocked**      | Reconnect banner              |

### 5.2 Firestore Listeners

**Dashboard window:**

- `reports` — public metadata (real-time)
- `report_ops` — operational state (real-time, admin-only)
- `metrics_province` — pre-computed aggregates (periodic refresh)
- `alerts` — anomaly alerts (real-time)

**Map window:**

- `reports` — public metadata (real-time)
- `report_ops` — operational state (real-time)
- `responders` — responder roster (real-time)
- RTDB `responder_locations` — GPS positions (real-time)

### 5.3 Zustand Store Structure

```typescript
interface CommandCenterState {
  // Selection
  selectedMunicipalityId: string | null
  selectedReportId: string | null

  // Dashboard UI
  triageFilters: { severity?: Severity; municipality?: string; age?: 'new' | 'stale' }
  chartTimeRange: '24h' | '7d' | '30d'
  statusBarExpanded: boolean // toggles detail metrics visibility

  // Map UI
  mapBounds: LatLngBounds | null
  activeOverlays: Set<string>
  triagePanelOpen: boolean

  // Cross-window
  lastSyncMessage: SyncMessage | null

  // Actions
  selectMunicipality: (id: string | null) => void
  selectReport: (id: string | null) => void
  setTriageFilters: (filters: TriageFilters) => void
  toggleStatusBarExpanded: () => void
  toggleOverlay: (overlayId: string) => void
}
```

---

## 6. Error Handling

### 6.1 Offline State

When `navigator.onLine === false`:

- Show persistent reconnect banner at top of both windows
- Disable all mutation buttons (verify, reject, dispatch)
- Keep data visible (Firestore SDK cache)
- Show "Working offline — changes will not sync" warning
- Auto-hide banner when connection restores

### 6.2 Data Freshness

- Every Firestore listener updates a `lastUpdatedAt` timestamp in Zustand
- Status bar shows "Updated Xs ago" label
- If data is >60s stale, show amber indicator
- If data is >5m stale, show red indicator + "Data may be stale" warning

### 6.3 Error Boundaries

- App-level error boundary: "Something went wrong. Please refresh."
- Map-level error boundary: "Map failed to load. [Retry]"
- Panel-level error boundary: "Failed to load panel. [Retry]"

### 6.4 Permission Denied

If a Firestore listener returns permission-denied:

- Log to console (dev only)
- Show "Access restricted" inline message
- Do NOT redirect — the user may have partial access

### 6.5 Mutation Confirmation Gates

**Destructive or high-stakes actions require confirmation:**

| Action      | Gate Type           | Rationale                         |
| ----------- | ------------------- | --------------------------------- |
| Verify      | One-click + toast   | Reversible (can reject later)     |
| Reject      | Confirmation modal  | Permanent — drops citizen report  |
| Dispatch    | Hold-to-confirm     | Sends responder — human lives     |
| Bulk Verify | "Verify N reports?" | Batch operations need count guard |

**Undo affordance:** Verify shows a 3-second undo toast. Reject and Dispatch are not undoable by design (they trigger external notifications), so the confirmation gate is the safety net.

**Hold-to-Confirm interaction:** The Dispatch button (in both panel and quick-dispatch) shows a circular fill animation around the button border while held. Release before 1s = cancel. Hold for 1s = confirm and execute. Visual + haptic feedback on confirmation. Prevents accidental dispatches during rapid triage.

---

## 7. Accessibility

- **Keyboard navigation:** All tables support arrow keys + Enter to select + action keys
- **Focus management:** Triage panel gets focus when opened. Modal traps focus.
- **Screen readers:** `aria-live="polite"` regions for alert announcements. Table rows have `aria-selected`. Map incidents are mirrored in a parallel text list (`aria-label` on each pin + a sidebar list view toggled via keyboard).
- **Reduced motion:** Disable pulsing animations when `prefers-reduced-motion: reduce`
- **Color independence:** Severity indicators use both color AND icon shape (not color alone)
- **Contrast:** All text meets WCAG AA (4.5:1 minimum)
- **Audio alerts:** Distinct chime for new high-severity reports. Respects `prefers-reduced-motion` (treat as "no sound" when enabled, or provide visual pulse-only alternative).

---

## 8. Testing Strategy

### 8.1 Unit Tests

- Zustand store actions
- Sync message serialization/deserialization
- KPI calculation helpers
- Filter/sort logic for triage queue

### 8.2 Component Tests

- `TriagePanel` — hidden when no selection, renders when pin selected
- `MunicipalPerformanceTable` — sorting, selection, sync emission
- `CommandHeader` — notification bell, window open button
- `ProvincialMap` — pin rendering, clustering, overlay toggles
- `StatusBar` — alert threshold rendering

### 8.3 Integration Tests

- Dashboard → Map sync: select municipality on dashboard, verify map zooms
- Map → Dashboard sync: select report pin on map, verify dashboard highlights row
- Triage flow: select report → verify → confirm state updates in both windows
- Offline banner: disconnect, verify mutations blocked, reconnect, verify restored

### 8.4 E2E Tests (Playwright, Phase 2)

- Full dual-window flow: open dashboard, open map, perform triage, verify sync
- Keyboard shortcut validation
- Mobile viewport gate (show "please use desktop" message)

---

## 9. Performance Budget

| Metric                         | Target               |
| ------------------------------ | -------------------- |
| Dashboard initial load         | <3s on wired desktop |
| Map initial load               | <3s on wired desktop |
| Triage panel open → render     | <200ms               |
| Pin cluster render (100 pins)  | <100ms               |
| Cross-window sync latency      | <50ms                |
| Firestore listener → UI update | <100ms               |

---

## 10. Dependencies

**Already in project:**

- React 18, Vite, TypeScript
- Firebase SDK (Firestore, Auth, Functions, RTDB)
- React Router v7
- Zustand
- TanStack Query
- Leaflet + react-leaflet
- Lucide React

**To add:**

- `leaflet.markercluster` — pin clustering
- `recharts` — already in `apps/admin-desktop/package.json` (^3.8.1), use for all charts

---

## 11. Open Questions

1. ~~Should the dashboard triage queue support bulk actions?~~ **Resolved:** Yes — multi-select checkboxes + bulk Verify/Reject with count confirmation.
2. Should anomaly alerts auto-dismiss after a threshold, or require manual dismiss?
3. Should the map support drawing custom polygons for incident area annotation?
4. What's the source of municipal boundary GeoJSON — static file or external API?
5. Should the auto-open map behavior be opt-in or opt-out per operator preference?
6. Should the audio alert distinguish severity by pitch/tone, or use a single alert sound?

## 12. Onboarding & Contextual Help

### First-Run Experience

- **Shortcut cheat sheet:** Auto-shows on first login (can be dismissed permanently). Accessible anytime via `?`.
- **Guided tour (optional):** 3-step overlay — (1) "This is your status bar", (2) "Triage queue is your primary action surface", (3) "Open the map window for geographic context".

### Contextual Tooltips

- **Surge Status:** "System pre-warm status for scale events. 'Idle' = normal. 'Active' = functions pre-warmed for high load."
- **Municipal Issues:** "Count of municipalities with detected anomalies (response time spike, admin gap, etc.)."
- **Hold-to-Confirm:** On first Dispatch action, show a brief inline hint: "Hold for 1 second to confirm dispatch."

### Terminology Glossary (Inline)

| Term        | Plain Language                                               |
| ----------- | ------------------------------------------------------------ |
| Triage      | Review and decide: verify, reject, or dispatch               |
| Verify      | Confirm the report is real and actionable                    |
| Dispatch    | Send a responder team to the location                        |
| Surge       | Period of unusually high report volume                       |
| Break-Glass | Emergency override for locked accounts (deferred to Phase 4) |

---

## 13. Deferred to Future Phases

| Feature                     | Phase                               |
| --------------------------- | ----------------------------------- |
| NDRRMC Escalation Queue     | Phase 2                             |
| Emergency Declaration Modal | Phase 2                             |
| User Management Dashboard   | Phase 2                             |
| Audit Log Viewer            | Phase 3                             |
| Data Subject Erasure        | Phase 3                             |
| System Health Dashboard     | Phase 4                             |
| SMS Audit / Provider Health | Phase 4                             |
| Shift Handoff               | Phase 4                             |
| Break-Glass Access          | Phase 4 (deferred per user request) |
| Surge Pre-Warm Trigger      | Phase 4                             |
