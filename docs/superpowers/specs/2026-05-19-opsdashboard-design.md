# Design Spec: OpsDashboard (DashboardPage Redesign)

**Date:** 2026-05-19
**Status:** Draft v2 (Post-Adversarial Review)
**Owner:** Senior Pragmatic Engineer (AI)
**Depends on:** `2026-05-19-dispatch-monitor-design.md` (Phase 3, Tasks 10–12 complete)

---

## 1. Overview

Redesign `DashboardPage` from a triage-centric view into an **operations-centric command center** — the first screen an admin sees after login. The goal is **situation awareness at a glance**: a tired operator must understand system health, pending actions, and resource availability in under 5 seconds without scrolling or clicking.

This dashboard is specific to Bantayog Alert's dark-themed, emergency-operations context. It does not use generic SaaS analytics patterns (side-stripe borders, pastel gradients). Visual language follows the existing admin-desktop design system: navy surface (`#001e40`), severity-coded colors (`--color-danger` for critical, `--color-warning` for stalled), and high-contrast white text on dark backgrounds.

### Goals

- **Level 1 SA (Perception):** KPI cards + escalation queue = instant status read.
- **Level 2 SA (Comprehension):** Trend chart + event feed explain _why_ numbers are what they are.
- **Level 3 SA (Projection):** Fleet status + municipal load show where the next problem will emerge.
- **Actionability:** Every stalled dispatch has a one-click re-dispatch path.

### Non-Goals

- No new backend callables or Firestore indexes. Reuses existing `getOpsMetrics`, `useDispatchLifecycle`, `useResponderFleet`.
- No time-series backend aggregation. Volume chart derives from existing `useDispatchLifecycle` rows.
- Anomaly alert feature is removed (per user decision), not migrated.
- Triage functionality (verify/reject) moves to `/feed`; this spec does not cover that migration.

---

## 2. Architecture

### 2.1 Page: `DashboardPage.tsx`

**What changes:**

- **Removes:** `TriageQueueTable`, verify/reject modals, bulk actions, `AllClearState`, `TrendAnalysisPanel`, keyboard shortcuts for verify/reject, `selectedIds` state, `StatusBar` (see §2.3).
- **Keeps:** `CommandHeader`, `OfflineBanner`, `useFirestoreListeners` (for reports data to compute municipal performance), `useAudioAlerts` (for new-dispatch ping).
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

| Component                    | File                                            | Changes                                                                                                                   |
| ---------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `DispatchStatsCards`         | `src/components/DispatchStatsCards.tsx`         | Replace `border-l-4` with `border-top` accent + background tint. Add trend arrow when `avgAcceptSeconds` changes by >10%. |
| `EscalationQueueSection`     | `src/components/EscalationQueueSection.tsx`     | Already implemented. Imported directly.                                                                                   |
| `ResponderAvailabilityPanel` | `src/components/ResponderAvailabilityPanel.tsx` | Already implemented. Imported directly.                                                                                   |

#### New

| Component             | File                                     | Responsibility                                                                                                                                                                |
| --------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DispatchVolumeChart` | `src/components/DispatchVolumeChart.tsx` | Simple bar chart: 24 hourly buckets of active dispatch creation count. Derived from `useDispatchLifecycle.rows[].dispatchedAt`. No external charting library — pure CSS bars. |
| `RecentEventsFeed`    | `src/components/RecentEventsFeed.tsx`    | Last 20 dispatch events across all dispatches, sorted by `at` desc. Derived from flattening `rows[].timeline`. Maps event types to human labels.                              |

#### Enhanced

| Component                   | File                                           | Changes                                    |
| --------------------------- | ---------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `MunicipalPerformanceTable` | `src/components/MunicipalPerformanceTable.tsx` | Add `avgResponseTime` column (type `string | undefined`, matching existing `MunicipalPerformance`interface). Computed from`reports` data. Sortable. |

### 2.3 StatusBar Removal

The existing `StatusBar` component is **removed** from DashboardPage. It cannot coexist with the KPI cards without creating semantic confusion:

| Source    | Label              | Data                                           | Unit    |
| --------- | ------------------ | ---------------------------------------------- | ------- |
| StatusBar | "Active Incidents" | `reports` filtered by `ACTIVE_REPORT_STATUSES` | count   |
| KPI Cards | "Active Now"       | `dispatches` where `status !== 'needs_admin'`  | count   |
| StatusBar | "Avg Response"     | `(updatedAt - createdAt)` per report           | minutes |
| KPI Cards | "Avg Accept"       | `getOpsMetrics` callable                       | seconds |

These are all valid metrics but they measure different things. Having both on the same page creates operator confusion. The KPI cards are the primary metric surface; StatusBar is retired from this page.

**Note:** `StatusBar` remains available as a component for other pages that need it.

---

## 3. State Matrix

DashboardPage composes 4 independent data hooks. Each widget must handle loading, error, and empty states coherently.

### 3.1 Global Loading State

When **any** hook is loading, show a single page-level spinner (reusing existing pattern from current DashboardPage). Do not render individual widget spinners — a forest of spinners is worse than one blocking loader.

```tsx
const isLoading = lifecycleLoading || fleetLoading || metricsLoading || reportsLoading
```

### 3.2 Global Error State

When **any** hook returns an error, show `<OfflineBanner error={error} />` at the top and render the rest of the page with whatever data is available. Do not block the entire page on one failed listener.

### 3.3 Widget-Specific Empty States

| Widget               | Loading                           | Empty (genuine)                                                                             | Error                                                                              |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **KPI Cards**        | "—" for all values                | Same as loaded (zeros are valid)                                                            | Show last known values with a subtle "stale" indicator (reduced opacity + tooltip) |
| **Escalation Queue** | Hidden                            | Shows compact "All clear — no stalled dispatches" banner (not null, to prevent layout jump) | Shows error inline: "Unable to load escalation queue"                              |
| **Volume Chart**     | Skeleton bars (gray placeholders) | "No dispatches in last 24h"                                                                 | "Unable to load dispatch volume"                                                   |
| **Recent Events**    | Skeleton rows                     | "No events recorded"                                                                        | "Unable to load recent events"                                                     |
| **Responder Fleet**  | Skeleton rows                     | "No responders online"                                                                      | "Unable to load responder fleet"                                                   |
| **Municipal Table**  | Skeleton rows                     | "No municipal data"                                                                         | "Unable to load municipal performance"                                             |

**Key rule:** Genuine empty states and error states must be visually distinct. An operator at 2 AM must know whether the system is quiet or broken.

### 3.4 Coherent "All Clear" State

When all data sources return empty (no dispatches, no responders, no reports), render a single coherent message:

```
┌─────────────────────────────────────────┐
│  All clear                              │
│  No active dispatches. No responders    │
│  online. Last report: —                 │
│                                         │
│  [Refresh]                              │
└─────────────────────────────────────────┘
```

This replaces the old `AllClearState` component. It is shown **instead of** the widget grid, not inside it.

---

## 4. Layout

```
┌─────────────────────────────────────────────────────────────┐
│  CommandHeader                                              │
├─────────────────────────────────────────────────────────────┤
│  [OfflineBanner if error]                                   │
├─────────────────────────────────────────────────────────────┤
│  [Active 5] [Stalled 2] [Avg Accept 2m 0s ↑] [FCM 95%]    │  ← KPI cards (full width)
├─────────────────────────────────────────────────────────────┤
│  ⚠ Needs Admin Attention (2)                                │  ← Escalation queue
│  ┌─────────┐ ┌─────────┐                                    │     (or "All clear" banner)
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

## 5. Component Details

### 5.1 `DispatchStatsCards`

**Props:**

```typescript
interface Props {
  activeCount: number
  stalledCount: number
  avgAcceptSeconds: number | null
  fcmSuccessRate: number
}
```

**Visual treatment:**

- **No side-stripe borders.** Use `border-top: 3px solid {color}` + `background: rgba(255,255,255,0.03)` instead.
- **Colors:** Active = `var(--color-info)`, Stalled = `var(--color-danger)`, Avg Accept = `var(--color-text-muted)`, FCM = `var(--color-success)` if ≥90% else `var(--color-warning)`.

**Trend arrow:**

- Tracks previous `avgAcceptSeconds` in a ref.
- `diff = current - previous`
- `threshold = previous * 0.1` (10% change)
- If `diff > threshold` → "↑ {diff}s from last poll" in `var(--color-warning)`
- If `diff < -threshold` → "↓ {Math.abs(diff)}s from last poll" in `var(--color-success)`
- Otherwise no arrow

### 5.2 `EscalationQueueSection`

**Props (unchanged from existing implementation):**

```typescript
interface StalledDispatch {
  dispatchId: string
  reportId: string
  responderName: string
  escalationCount: number
}

interface Props {
  stalledDispatches: StalledDispatch[]
  onReDispatch: (dispatchId: string) => void
}
```

**DashboardPage mapping:**

```tsx
const stalledDispatches = rows
  .filter((r) => r.status === 'needs_admin')
  .map((r) => ({
    dispatchId: r.dispatchId,
    reportId: r.reportId,
    responderName: r.responderName,
    escalationCount: r.escalationCount,
  }))
```

**Empty state:** When `stalledDispatches.length === 0`, render a compact banner:

```tsx
<div className="rounded border border-green-500/20 bg-green-500/5 px-4 py-2">
  <span className="text-sm text-green-400">All clear — no stalled dispatches</span>
</div>
```

This prevents the layout jump when the queue goes from >0 to 0.

**Drill-down:** Each card includes a "View Details" link that navigates to `/dispatches?highlight={dispatchId}`.

### 5.3 `DispatchVolumeChart`

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

### 5.4 `RecentEventsFeed`

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

**Event type indicators:**

| Event Type               | Dot Color                 | Shape    | Label                |
| ------------------------ | ------------------------- | -------- | -------------------- |
| `notification_attempted` | `var(--color-info)`       | Circle   | "FCM Sent"           |
| `notification_delivered` | `var(--color-success)`    | Circle   | "Responder Notified" |
| `escalation_attempted`   | `var(--color-warning)`    | Triangle | "Re-assigned"        |
| `deadline_exceeded`      | `var(--color-danger)`     | Diamond  | "Deadline Passed"    |
| Unknown                  | `var(--color-text-muted)` | Circle   | raw type             |

**Accessibility:** Shape + color (not color alone). Triangle and diamond use CSS `clip-path`.

### 5.5 `MunicipalPerformanceTable` Enhancement

**Type (unchanged — aligns with existing `types/index.ts`):**

```typescript
interface MunicipalPerformance {
  municipality: string
  activeIncidents: number
  activeResponders?: number
  totalResponders?: number
  avgResponseTime?: string
  unresolvedOver24h?: number
  adminOnDuty?: boolean
  adminName?: string
}
```

**Changes:**

- **Add column:** `avgResponseTime` (displayed as "{N}m" or "—" if undefined).
- **Column header:** "Avg Response".
- **Sortable:** Click header to sort (activeIncidents desc default, then avgResponseTime desc).
- **Existing columns retained:** `activeResponders`, `totalResponders`, `unresolvedOver24h`, `adminOnDuty`, `adminName` continue to render as they do today. If data is undefined, show "—".

**Computation in DashboardPage:**

Same formula as current global `avgResponseTime`, but grouped by `municipality`:

```typescript
const municipalData: MunicipalPerformance[] = useMemo(() => {
  // group reports by municipality
  // for each group, compute avg (updatedAt - createdAt) for verified/resolved reports
  // emit { municipality, activeIncidents, avgResponseTime: "{N}m" }
}, [reports])
```

### 5.6 Heading Hierarchy

The page must have exactly one `<h1>`:

```tsx
<main className="flex-1 overflow-auto p-4">
  <h1 className="sr-only">Operations Dashboard</h1>
  {/* widgets */}
</main>
```

The `<h1>` is visually hidden (`sr-only`) because the `CommandHeader` already displays the page title visually. Screen readers still need the heading landmark.

---

## 6. Keyboard Shortcuts

Add shortcuts for the new ops-centric actions:

| Key   | Action                                               |
| ----- | ---------------------------------------------------- |
| `R`   | Focus first "Re-dispatch" button in escalation queue |
| `D`   | Navigate to `/dispatches` (full dispatch monitor)    |
| `F`   | Navigate to `/feed` (triage)                         |
| `?`   | Show keyboard shortcuts help                         |
| `Esc` | Clear any open modal / defocus                       |

The `CommandHeader` already renders a keyboard shortcut button. These shortcuts are displayed in the `HelpModal`.

---

## 7. Data Flow

### 7.1 DashboardPage Composition

```tsx
export default function DashboardPage() {
  const db = getFirestoreInstance()
  const { rows, loading: lifecycleLoading, error: lifecycleError } = useDispatchLifecycle(db)
  const { responders, loading: fleetLoading, error: fleetError } = useResponderFleet(db)
  const { metrics: opsMetrics, loading: metricsLoading, error: metricsError } = useOpsMetrics('24h')
  const { reports, loading: reportsLoading, error: reportsError } = useFirestoreListeners({ windowType: 'dashboard', db })

  const isLoading = lifecycleLoading || fleetLoading || metricsLoading || reportsLoading
  const error = lifecycleError || fleetError || metricsError || reportsError

  const stalledDispatches = rows
    .filter((r) => r.status === 'needs_admin')
    .map((r) => ({
      dispatchId: r.dispatchId,
      reportId: r.reportId,
      responderName: r.responderName,
      escalationCount: r.escalationCount,
    }))

  const activeCount = rows.filter((r) => r.status !== 'needs_admin').length
  const avgAcceptSeconds = opsMetrics?.avgAcceptSeconds ?? null
  const fcmSuccessRate = opsMetrics?.fcmSuccessRate ?? 0

  // ... municipalData computation ...

  if (isLoading && rows.length === 0 && reports.length === 0) {
    return <LoadingScreen />
  }

  const isAllClear = rows.length === 0 && responders.length === 0 && reports.length === 0

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <CommandHeader ... />
      {error && <OfflineBanner error={error} />}
      <main className="flex-1 overflow-auto p-4">
        <h1 className="sr-only">Operations Dashboard</h1>

        {isAllClear ? (
          <AllClearState lastReportAt={lastReportAt} />
        ) : (
          <>
            <DispatchStatsCards
              activeCount={activeCount}
              stalledCount={stalledDispatches.length}
              avgAcceptSeconds={avgAcceptSeconds}
              fcmSuccessRate={fcmSuccessRate}
            />

            <EscalationQueueSection
              stalledDispatches={stalledDispatches}
              onReDispatch={handleReDispatch}
            />

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
          </>
        )}
      </main>
    </div>
  )
}
```

### 7.2 Triage Migration

Triage functionality (verify/reject/bulk actions) is **removed from DashboardPage** and **moved to FeedPage**:

- FeedPage already shows `awaiting_verify` reports.
- Add verify/reject buttons to each feed item.
- Add bulk select + bulk verify/reject actions to FeedPage.
- This is a **separate implementation task** tracked as "FeedPage Triage Migration" and is out of scope for this spec.

---

## 8. Testing Strategy

### 8.1 New Component Tests

**`DispatchVolumeChart.test.tsx`:**

- Renders 24 bars when rows span multiple hours.
- Empty state when no rows.
- Bar heights are proportional to max bucket.
- Correct hour labels rendered.
- Skeleton bars shown when `isLoading` prop is true.

**`RecentEventsFeed.test.tsx`:**

- Renders events sorted by time descending.
- Limits to `maxEvents` (default 20).
- Maps known event types to labels.
- Renders unknown types as raw string.
- Empty state when no events.
- Shape + color indicators accessible to screen readers.

### 8.2 Enhanced Component Tests

**`MunicipalPerformanceTable.test.tsx`:**

- Renders avg response time column when data includes it.
- Shows "—" when avg response time is undefined.
- Sorting by avg response time works.
- Existing columns (activeResponders, totalResponders, etc.) still render.

**`DispatchStatsCards.test.tsx`:**

- Trend arrow appears when avgAcceptSeconds changes by >10%.
- No arrow when change is < 10%.
- No side-stripe borders (assert className does not include `border-l-`).

**`EscalationQueueSection.test.tsx`:**

- Renders "All clear" banner when empty (not null).
- "View Details" link navigates to `/dispatches`.

### 8.3 DashboardPage Integration Tests

- Renders all widgets without crashing.
- Shows single loader when all hooks loading.
- Shows `OfflineBanner` when any hook errors.
- Escalation queue renders "All clear" when empty.
- Triage-specific elements are NOT rendered.
- `<h1>` exists with `sr-only` class.
- Keyboard shortcuts register correctly.

---

## 9. Accessibility

- **Heading hierarchy:** Exactly one `<h1 className="sr-only">Operations Dashboard</h1>`.
- **KPI cards:** `aria-label` on each card describing the metric + current value.
- **Escalation queue:** Cards are keyboard-focusable. "Re-dispatch" button has `aria-label` including dispatch ID.
- **Volume chart:** Bars have `role="img"` + `aria-label` showing count.
- **Event feed:** Semantic `<ul>` / `<li>`. Each item has `aria-label` with event type + time.
- **Color + shape:** Event dots use both color and shape (circle/triangle/diamond) for colorblind accessibility.
- **Focus management:** "R" shortcut focuses the first re-dispatch button with visible focus ring.

---

## 10. Risks & Mitigations

| Risk                                                                                              | Impact | Mitigation                                                                                                              |
| ------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `useDispatchLifecycle` limit(100) undercounts volume chart                                        | Medium | Label chart clearly: "Active dispatches by hour (last 24h)". Document that this is a sample, not a census.              |
| Multiple Firestore listeners (reports + dispatches + events + responders) = 4 listeners per admin | Low    | Already accepted in Phase 3 design. Estimated ~$15/mo at 50 admins.                                                     |
| Removing triage from DashboardPage breaks existing admin workflow                                 | High   | FeedPage must be enhanced with triage BEFORE this ships. Sequence: (1) FeedPage triage, (2) DashboardPage ops redesign. |
| MunicipalPerformance type mismatch causes compile errors                                          | High   | Spec aligns exactly with `types/index.ts:204`. No field renames or type changes.                                        |
| "Active" label confusion between KPI and old StatusBar                                            | Medium | StatusBar removed from DashboardPage entirely. KPI cards use unambiguous labels.                                        |

---

## 11. Implementation Order

1. **FeedPage Triage Migration** (prerequisite — out of scope for this spec)
2. `DispatchVolumeChart` component + tests
3. `RecentEventsFeed` component + tests
4. `MunicipalPerformanceTable` enhancement + tests
5. `DispatchStatsCards` enhancements (border treatment + trend arrow) + tests
6. `EscalationQueueSection` enhancements (empty state + drill-down) + tests
7. `DashboardPage` redesign — remove triage, compose ops widgets
8. DashboardPage integration tests
9. Update routes if needed
10. Full suite: `pnpm --dir apps/admin-desktop exec vitest run`
11. Typecheck + lint

---

## 12. Files Changed

### Modified

- `apps/admin-desktop/src/pages/DashboardPage.tsx` — full redesign
- `apps/admin-desktop/src/components/DispatchStatsCards.tsx` — border treatment + trend arrow
- `apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx` — avg response column
- `apps/admin-desktop/src/components/EscalationQueueSection.tsx` — empty state + drill-down

### New

- `apps/admin-desktop/src/components/DispatchVolumeChart.tsx`
- `apps/admin-desktop/src/components/DispatchVolumeChart.test.tsx`
- `apps/admin-desktop/src/components/RecentEventsFeed.tsx`
- `apps/admin-desktop/src/components/RecentEventsFeed.test.tsx`
- `apps/admin-desktop/src/__tests__/DashboardPage.ops.test.tsx` (integration)

---

## 13. Spec Self-Review

- [x] No "TBD" or placeholders
- [x] Internal consistency: layout matches component inventory
- [x] Scope: focused on DashboardPage redesign only; FeedPage triage migration called out as prerequisite
- [x] Ambiguity: volume chart explicitly labeled as derived from active dispatch sample
- [x] Dependencies: reuses existing hooks, no backend changes
- [x] State matrix defined for all 4 hooks × 6 widgets
- [x] MunicipalPerformance type aligns with existing `types/index.ts`
- [x] No conflicting "Active" labels (StatusBar removed)
- [x] EscalationQueueSection prop mapping explicitly defined
- [x] Event dots use shape + color, not color alone
- [x] Heading hierarchy includes `<h1>`
- [x] Keyboard shortcuts defined
- [x] No side-stripe borders
