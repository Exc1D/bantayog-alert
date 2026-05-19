# Design Spec: OpsDashboard (DashboardPage Redesign)

**Date:** 2026-05-19
**Status:** Draft
**Owner:** Senior Pragmatic Engineer (AI)
**Depends on:** `2026-05-19-dispatch-monitor-design.md` (Phase 3, Tasks 10–12 complete)

---

## 1. Overview

Redesign `DashboardPage` from a triage-centric view into an **operations-centric command center** — the first screen an admin sees after login. The goal is **situation awareness at a glance**: a tired operator must understand system health, pending actions, and resource availability in under 5 seconds without scrolling or clicking.

### Goals

- **Level 1 SA (Perception):** KPI cards + escalation queue = instant status read.
- **Level 2 SA (Comprehension):** Trend chart + event feed explain _why_ numbers are what they are.
- **Level 3 SA (Projection):** Fleet status + municipal load show where the next problem will emerge.
- **Actionability:** Every stalled dispatch has a one-click re-dispatch path.

### Non-Goals

- No new backend callables or Firestore indexes. Reuses existing `getOpsMetrics`, `useDispatchLifecycle`, `useResponderFleet`.
- No time-series backend aggregation. Volume chart derives from existing `useDispatchLifecycle` rows.
- Anomaly alert feature is removed (per user decision), not migrated.

---

## 2. Architecture

### 2.1 Page: `DashboardPage.tsx`

**What changes:**

- **Removes:** `TriageQueueTable`, verify/reject modals, bulk actions, `AllClearState`, `TrendAnalysisPanel`, keyboard shortcuts for verify/reject, `selectedIds` state.
- **Keeps:** `CommandHeader`, `OfflineBanner`, `StatusBar`, `useFirestoreListeners` (for reports data to compute municipal performance), `useAudioAlerts` (for new-dispatch ping).
- **Adds:** `DispatchStatsCards`, `EscalationQueueSection`, `DispatchVolumeChart`, `RecentEventsFeed`, `ResponderAvailabilityPanel`, `MunicipalPerformanceTable` (enhanced).

**Data sources:**

| Widget           | Data Source               | Hook                                                |
| ---------------- | ------------------------- | --------------------------------------------------- |
| KPI Cards        | Aggregated metrics        | `useOpsMetrics('24h')`                              |
| Escalation Queue | Stalled dispatches        | `useDispatchLifecycle`                              |
| Volume Chart     | Active dispatches by hour | Derived from `useDispatchLifecycle.rows`            |
| Recent Events    | Flattened dispatch events | Derived from `useDispatchLifecycle.rows[].timeline` |
| Responder Fleet  | Online responders         | `useResponderFleet`                                 |
| Municipal Table  | Reports by municipality   | `useFirestoreListeners` reports                     |

### 2.2 Component Inventory

#### Reused (minor changes)

| Component                    | File                                            | Changes                                                                                                                                   |
| ---------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `DispatchStatsCards`         | `src/components/DispatchStatsCards.tsx`         | Add trend arrow ("↑ 30s from yesterday") when `avgAcceptSeconds` changes. No prop changes — trend computed internally from previous poll. |
| `EscalationQueueSection`     | `src/components/EscalationQueueSection.tsx`     | Already implemented. Imported directly.                                                                                                   |
| `ResponderAvailabilityPanel` | `src/components/ResponderAvailabilityPanel.tsx` | Already implemented. Imported directly.                                                                                                   |

#### New

| Component             | File                                     | Responsibility                                                                                                                                                                |
| --------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DispatchVolumeChart` | `src/components/DispatchVolumeChart.tsx` | Simple bar chart: 24 hourly buckets of active dispatch creation count. Derived from `useDispatchLifecycle.rows[].dispatchedAt`. No external charting library — pure CSS bars. |
| `RecentEventsFeed`    | `src/components/RecentEventsFeed.tsx`    | Last 20 dispatch events across all dispatches, sorted by `at` desc. Derived from flattening `rows[].timeline`. Maps event types to human labels.                              |

#### Enhanced

| Component                   | File                                           | Changes                                                                                                                                     |
| --------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `MunicipalPerformanceTable` | `src/components/MunicipalPerformanceTable.tsx` | Add `avgResponseTimeMinutes` column. Computed from `reports` data (same formula as current DashboardPage global avg, but per municipality). |

---

## 3. Layout

```
┌─────────────────────────────────────────────────────────────┐
│  CommandHeader                                              │
├─────────────────────────────────────────────────────────────┤
│  StatusBar (active incidents, avg response, pending)       │
├─────────────────────────────────────────────────────────────┤
│  [Active 5] [Stalled 2] [Avg Accept 2m 0s ↑] [FCM 95%]    │  ← KPI cards (full width)
├─────────────────────────────────────────────────────────────┤
│  ⚠ Needs Admin Attention (2)                                │  ← Escalation queue
│  ┌─────────┐ ┌─────────┐                                    │     (only if stalled > 0)
│  │ Report  │ │ Report  │                                    │
│  │ Re-dispatch │ Re-dispatch │                              │
│  └─────────┘ └─────────┘                                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐ ┌───────────────────────┐  │
│  │  Dispatch Volume — 24h      │ │  Responder Fleet      │  │
│  │  ▁▃▄▆█▃▁                    │ │  ● Juan  BFP Avail    │  │
│  │                             │ │  ● Maria MDR On Scene │  │
│  │  Recent Events              │ │  ● Pedro BFP Away 8m  │  │
│  │  ● FCM Sent — Juan   2m ago │ │                       │  │
│  │  ● Notified — Maria  5m ago │ │  Municipal Performance│  │
│  │  ● Deadline — rpt1  12m ago │ │  Daet        3  4m    │  │
│  │                             │ │  Mercedes    1  2m    │  │
│  └─────────────────────────────┘ └───────────────────────┘  │
│          Left column (~60%)          Right column (~40%)    │
└─────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **≥1024px:** Two-column grid as shown.
- **768–1023px:** Single column, full-width widgets.
- **<768px:** Not supported (admin desktop is desktop-only; `MobileGate` handles this).

---

## 4. Component Details

### 4.1 `DispatchVolumeChart`

**Props:**

```typescript
interface Props {
  rows: DispatchLifecycleRow[]
}
```

**Logic:**

1. For each row, bucket `dispatchedAt` into hour-of-day (0–23) using the user's local timezone.
2. Count dispatches per bucket.
3. Render 24 vertical bars. Max bar height = tallest bucket count.
4. Bars are `div` elements with inline `height` percentage. No charting library.
5. Label x-axis: "00:00", "06:00", "12:00", "18:00", "Now".
6. If no dispatches in 24h, show "No dispatches in last 24h" instead of empty bars.

**Performance:** Derivation wrapped in `useMemo` keyed on `rows`.

### 4.2 `RecentEventsFeed`

**Props:**

```typescript
interface Props {
  rows: DispatchLifecycleRow[]
  maxEvents?: number // default 20
}
```

**Logic:**

1. Flatten all `row.timeline` events into a single array.
2. Sort by `at` descending.
3. Take `maxEvents`.
4. Map event types to labels using `EVENT_LABELS` (shared with `DispatchTimeline`).
5. Render as a vertical list: dot (color by type) + label + relative time.

**Event type colors:**

- `notification_attempted` → blue dot
- `notification_delivered` → green dot
- `escalation_attempted` → amber dot
- `deadline_exceeded` → red dot
- Unknown → gray dot

### 4.3 `MunicipalPerformanceTable` Enhancement

**Type change:**

```typescript
interface MunicipalPerformance {
  municipality: string
  activeIncidents: number
  avgResponseTimeMinutes?: number // NEW
}
```

**Rendering:**

- `avgResponseTimeMinutes` → displayed as "{N}m" or "—" if undefined.
- Column header: "Avg Response".
- Sortable by clicking headers (activeIncidents desc default, then avgResponseTime desc).

**Computation in DashboardPage:**

Same formula as current global `avgResponseTime`, but grouped by `municipality`:

```typescript
const municipalData: MunicipalPerformance[] = useMemo(() => {
  // group reports by municipality
  // for each group, compute avg (updatedAt - createdAt) for verified/resolved reports
  // emit { municipality, activeIncidents, avgResponseTimeMinutes }
}, [reports])
```

### 4.4 `DispatchStatsCards` Enhancement

**Internal trend tracking:**

The component tracks the previous `avgAcceptSeconds` value in a ref. On prop change, it computes:

- `diff = current - previous`
- If `diff > 5` seconds → show "↑ {diff}s from last poll" in amber
- If `diff < -5` seconds → show "↓ {Math.abs(diff)}s from last poll" in green
- Otherwise no arrow

This is purely visual — no new props needed.

---

## 5. Data Flow

### 5.1 DashboardPage Composition

```tsx
export default function DashboardPage() {
  const db = getFirestoreInstance() // or existing db import
  const { rows } = useDispatchLifecycle(db)
  const { responders } = useResponderFleet(db)
  const { metrics: opsMetrics } = useOpsMetrics('24h')
  const { reports, loading, error } = useFirestoreListeners({ windowType: 'dashboard', db })

  const stalledDispatches = rows.filter((r) => r.status === 'needs_admin')
  const activeCount = rows.filter((r) => r.status !== 'needs_admin').length

  // ... municipalData computation ...

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <CommandHeader ... />
      <StatusBar ... />
      <main className="flex-1 overflow-auto p-4">
        <DispatchStatsCards ... />
        <EscalationQueueSection stalledDispatches={...} onReDispatch={...} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-4">
            <DispatchVolumeChart rows={rows} />
            <RecentEventsFeed rows={rows} />
          </div>
          <div className="space-y-4">
            <ResponderAvailabilityPanel responders={responders} />
            <MunicipalPerformanceTable data={municipalData} />
          </div>
        </div>
      </main>
    </div>
  )
}
```

### 5.2 Triage Migration

Triage functionality (verify/reject/bulk actions) is **removed from DashboardPage** and **moved to FeedPage**:

- FeedPage already shows `awaiting_verify` reports.
- Add verify/reject buttons to each feed item.
- Add bulk select + bulk verify/reject actions to FeedPage.
- This is a **separate implementation task** tracked as "FeedPage Triage Migration" and is out of scope for this spec.

---

## 6. Testing Strategy

### 6.1 New Component Tests

**`DispatchVolumeChart.test.tsx`:**

- Renders 24 bars when rows span multiple hours.
- Empty state when no rows.
- Bar heights are proportional to max bucket.
- Correct hour labels rendered.

**`RecentEventsFeed.test.tsx`:**

- Renders events sorted by time descending.
- Limits to `maxEvents` (default 20).
- Maps known event types to labels.
- Renders unknown types as raw string.
- Empty state when no events.

### 6.2 Enhanced Component Tests

**`MunicipalPerformanceTable.test.tsx`:**

- Renders avg response time column when data includes it.
- Shows "—" when avg response time is undefined.
- Sorting by avg response time works.

**`DispatchStatsCards.test.tsx`:**

- Trend arrow appears when avgAcceptSeconds changes between renders.
- No arrow when change is < 5 seconds.

### 6.3 DashboardPage Integration Tests

- Renders all widgets without crashing.
- Escalation queue only renders when stalled > 0.
- `useDispatchLifecycle` + `useResponderFleet` + `useOpsMetrics` all wired correctly.
- Triage-specific elements are NOT rendered.

---

## 7. Accessibility

- All KPI cards have `aria-label` describing the metric.
- Escalation queue cards are keyboard-focusable.
- Volume chart bars have `role="img"` + `aria-label` showing count.
- Event feed items use semantic `<ul>` / `<li>`.
- Color is not the only indicator: stalled count uses red border + text, event dots use shape + color.

---

## 8. Risks & Mitigations

| Risk                                                                                              | Impact | Mitigation                                                                                                              |
| ------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `useDispatchLifecycle` limit(100) undercounts volume chart                                        | Medium | Label chart clearly: "Active dispatches by hour (last 24h)". Document that this is a sample, not a census.              |
| Multiple Firestore listeners (reports + dispatches + events + responders) = 4 listeners per admin | Low    | Already accepted in Phase 3 design. Estimated ~$15/mo at 50 admins.                                                     |
| Removing triage from DashboardPage breaks existing admin workflow                                 | High   | FeedPage must be enhanced with triage BEFORE this ships. Sequence: (1) FeedPage triage, (2) DashboardPage ops redesign. |
| `MunicipalPerformanceTable` sort causes re-render loop                                            | Low    | Sort state in `useState`, not derived during render. Memoize sorted data.                                               |

---

## 9. Implementation Order

1. **FeedPage Triage Migration** (prerequisite — out of scope for this spec)
2. `DispatchVolumeChart` component + tests
3. `RecentEventsFeed` component + tests
4. `MunicipalPerformanceTable` enhancement + tests
5. `DispatchStatsCards` trend arrow enhancement + tests
6. `DashboardPage` redesign — remove triage, compose ops widgets
7. DashboardPage integration tests
8. Update routes if needed (remove `/dashboard` triage redirects)
9. Full suite: `pnpm --dir apps/admin-desktop exec vitest run`
10. Typecheck + lint

---

## 10. Files Changed

### Modified

- `apps/admin-desktop/src/pages/DashboardPage.tsx` — full redesign
- `apps/admin-desktop/src/components/DispatchStatsCards.tsx` — trend arrow
- `apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx` — avg response column

### New

- `apps/admin-desktop/src/components/DispatchVolumeChart.tsx`
- `apps/admin-desktop/src/components/DispatchVolumeChart.test.tsx`
- `apps/admin-desktop/src/components/RecentEventsFeed.tsx`
- `apps/admin-desktop/src/components/RecentEventsFeed.test.tsx`
- `apps/admin-desktop/src/__tests__/DashboardPage.ops.test.tsx` (integration)

---

## 11. Spec Self-Review

- [x] No "TBD" or placeholders
- [x] Internal consistency: layout matches component inventory
- [x] Scope: focused on DashboardPage redesign only; FeedPage triage migration called out as prerequisite
- [x] Ambiguity: volume chart explicitly labeled as derived from active dispatch sample
- [x] Dependencies: reuses existing hooks, no backend changes
