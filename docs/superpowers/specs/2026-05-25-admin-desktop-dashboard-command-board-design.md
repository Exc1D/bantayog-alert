# Admin Desktop Dashboard Command Board Design

**Date:** 2026-05-25
**Scope:** `@bantayog/admin-desktop` — PDRRMO Camarines Norte Command Center Dashboard
**Status:** Approved for implementation
**Precedent:** Overrides `docs/admin-desktop-dashboard-ux-synthesis-2026-05-25.md` where contradictory

## Goal

Transform the admin dashboard from a data-summary widget collection into a trustworthy **province command board** that answers four questions in seconds:

1. Is the province calm, degraded, active, or in surge?
2. Which municipalities are affected?
3. What is blocked or aging out?
4. What should command staff do next?

This design bundles the P0 critical fix (no-op Re-dispatch), all P1 UX gaps (success feedback, explicit unknown states, geography-first summary), and the long-term command-board vision (operational modes, layout adaptation) into one coherent redesign.

## Guiding Principles

- **Endsley's SA model:** Perception → Comprehension → Projection
- **3-30-300 rule:** 3s to perceive, 30s to comprehend, 300s to act
- **Trust over beauty:** A disabled action is safer than a clickable no-op
- **Frontend-first modes:** Heuristic mode detection from data already on the client
- **Backend gaps documented:** Future backend enhancement path defined but not blocking

---

## 1. Situation Strip (`StatusBar` Transformation)

The existing `StatusBar` expands into a true **province situation strip** — a sticky, always-visible layer that answers "What's happening?" in one scan.

### Visual Structure

```
┌─ StatusBar (sticky, z-50, full width) ─────────────────────────────────────┐
│ Row 1: [MODE BADGE] [Affected: Daet, Basud] [Blocked: 2] [Coverage: 14/17] │
│ Row 2: [Active 12] [Response 4m] [Triage 3] [FCM 98%] [Fresh: live 8s ago] │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Elements

#### 1.1 Mode Badge (leftmost, most prominent)

| Mode       | Visual     | Behavior                                             |
| ---------- | ---------- | ---------------------------------------------------- |
| `CALM`     | Green pill | Static, no pulse                                     |
| `ACTIVE`   | Blue pill  | Static                                               |
| `DEGRADED` | Amber pill | `motion-safe:animate-pulse`                          |
| `SURGE`    | Red pill   | `motion-safe:animate-pulse`, strongest visual weight |

- `role="status"` + `aria-live="polite"` — screen readers announce mode changes
- Clicking the badge expands/collapses the full StatusBar (existing behavior preserved)

#### 1.2 Affected Municipalities

- Derived from BOTH `municipalData` (reports) AND active dispatch rows (`rows.filter(r => r.status !== 'needs_admin')`)
- A municipality is "affected" if it has `activeIncidents > 0` OR any active dispatch assigned to it
- Rendered as horizontal chips: `Daet`, `Basud`, `Mercedes`
- Each chip is a `<button>` with `aria-label="View {muni} on map"`
- On click: `navigate(/map?municipality={encodeURIComponent(muni)})`
- In `calm` mode: hidden or shows "All clear"

#### 1.3 Blocking Response

- Format: `"{N} stalled dispatch{es}"` with link text `"View"`
- On click: focuses the first escalation card (existing `r` shortcut behavior)
- Hidden when `stalledCount === 0`

#### 1.4 Responder Coverage

- Format: `"{available} available / {uncovered} uncovered"`
- `uncovered` = municipalities where `activeResponders === 0 || activeResponders === undefined`
- Color logic:
  - `uncovered === 0` → green
  - `1 <= uncovered <= 2` → amber
  - `uncovered > 2` → red
- In `calm`: shows total count only (e.g., "17 responders on standby")

#### 1.5 Data Freshness

- Computed from the most recent update across all dashboard hooks:
  - `useDispatchLifecycle` last snapshot time
  - `useResponderFleet` last snapshot time
  - `useOpsMetrics` last poll time
  - `useFirestoreListeners` last snapshot time
- Format:
  - `< 60s`: `"live {N}s ago"` (green)
  - `60s - 5min`: `"updated {N}m ago"` (neutral)
  - `> 5min`: `"stale {N}m ago"` (amber/red)
- Implementation: Single `useEffect` + `setInterval(1000)` in `StatusBar` that increments a `tick` counter, forcing re-render without storing `Date.now()` in state. `lastDataUpdateAt` is passed as a prop from `DashboardPage` (derived from the most recent hook snapshot time). This avoids multiple timers and excessive state churn.

```typescript
// StatusBar.tsx
const [tick, setTick] = useState(0)
useEffect(() => {
  const id = setInterval(() => setTick((t) => t + 1), 1000)
  return () => clearInterval(id)
}, [])
const freshnessText = useMemo(
  () => computeFreshness(lastDataUpdateAt, Date.now()),
  [lastDataUpdateAt, tick],
)
```

#### 1.6 Existing Metrics (with operational labels)

Each metric now carries a small operational label below the value:

| Metric            | Normal | Watch  | Degraded |
| ----------------- | ------ | ------ | -------- |
| Active Incidents  | ≤ 10   | 11–20  | > 20     |
| Avg Response Time | ≤ 5m   | 5–10m  | > 10m    |
| Pending Triage    | ≤ 3    | 4–7    | > 7      |
| FCM Rate          | ≥ 98%  | 90–97% | < 90%    |

Labels use existing CSS vars: `color-success`, `color-warning`, `color-danger`.
Labels are `text-[10px] uppercase` below the metric value.

### Props Changes

```typescript
interface StatusBarProps {
  // Existing
  activeIncidents: number
  avgResponseTime: number // minutes
  pendingTriage: number
  resolvedToday?: number
  muniIssues?: { resolved: number; total: number }

  // NEW
  mode: DashboardMode
  affectedMunicipalities: string[]
  stalledDispatchCount: number
  totalResponders: number
  uncoveredMunicipalities: number
  lastDataUpdateAt: number
  // Municipality chips render as <Link> directly — no callback prop needed
}
```

### Accessibility

- Mode badge: `role="status"` + `aria-live="polite"` (announces mode changes)
- Municipality chips: `aria-label="View {muni} on map"`, keyboard navigable
- Freshness text: `aria-live="polite"` with 5-second debounce (don't announce every tick)
- Operational labels: `aria-hidden="true"` (redundant with the value itself; screen readers get the raw number)

---

## 2. Operational Mode System

### 2.1 Mode Derivation

Computed entirely on the frontend from data already held by `DashboardPage`:

```typescript
type DashboardMode = 'calm' | 'active' | 'degraded' | 'surge'

function deriveDashboardMode(
  stalledCount: number,
  activeCount: number,
  fcmRate: number,
  hookErrors: string[],
  dataFreshnessMs: number,
): DashboardMode {
  // SURGE takes precedence over DEGRADED — actionable blockers must be visible
  // even when data is stale. Staleness is shown as a sub-state watermark.
  if (stalledCount > 0 || activeCount > 20 || fcmRate < 0.5) return 'surge'
  if (hookErrors.length > 0 || dataFreshnessMs > 300_000) return 'degraded'
  if (activeCount > 0) return 'active'
  return 'calm'
}
```

**Threshold rationale:**

- `surge`: Any stalled dispatch is actionable. Active incidents > 20 means multi-municipality. FCM < 50% means the notification pipeline is failing — responders won't get dispatched.
- `degraded`: Any persistent hook error or data > 5min stale means operators can't trust the numbers. During an incident, stale data is worse than no data. Note: metric-level "Degraded" labels (e.g., "Active Incidents: Degraded") are independent of system mode — a single metric can be degraded while the overall system is in `active` mode.
- `active`: Default when incidents exist but aren't crisis-level.
- `calm`: No active incidents, no errors, data fresh.

**Surge-over-degraded rationale:** If the province is in a real crisis AND the network is overloaded, hiding the escalation queue behind a "degraded" screen would waste critical minutes. `surge` mode shows actionable blockers immediately; stale data is indicated by a `"STALE"` watermark overlay, not by suppressing the queue.

**Transition stability:** Asymmetric debounce to prevent flickering without delaying critical transitions:

- Enter `surge`: **immediate** (no debounce) — operators must see actionable blockers instantly
- Exit `surge` → `active`/`calm`: **5-second debounce** — prevents brief flicker when a report is resolved
- All other transitions: **immediate**

### 2.2 Mode-Driven Layout Adaptation

Each mode reshapes the panel grid on `DashboardPage`. The root `<main>` does NOT use dynamic CSS classes; mode is passed as a prop to child components for conditional JSX className composition:

```tsx
<main className="flex-1 overflow-auto p-4" id="main-content">
```

#### `calm`

```
[StatusBar: CALM green, readiness emphasis]
[DispatchStatsCards: all metrics, neutral/green]
[RecentEventsFeed: last 24h, no urgency]
[DispatchVolumeChart | ResponderAvailabilityPanel]
[MunicipalPerformanceTable]
```

- Escalation queue: **hidden** (empty state is implicit via StatusBar "All clear")
- All panels at normal visual weight

#### `active`

```
[StatusBar: ACTIVE blue, affected municipality chips]
[DispatchStatsCards: metrics, amber labels if elevated]
[EscalationQueueSection: visible only if stalled > 0]
[DispatchVolumeChart | ResponderAvailabilityPanel]
[RecentEventsFeed | MunicipalPerformanceTable]
```

- Same grid as current, but StatusBar shows geography context
- Escalation queue collapses to a compact summary row when empty

#### `degraded`

```
[StatusBar: DEGRADED amber pulse]
[OfflineBanner: sticky, does not scroll away]
[Last known good data: cached metrics with timestamp]
[EscalationQueueSection: if non-empty, with "last known" watermark]
```

- Charts and tables recede (`opacity-50`) or show cached data with `"STALE"` watermark overlay
- OfflineBanner becomes sticky (does not scroll away) with radio/phone backup guidance
- Municipal table shows cached data with clear "last updated" timestamp

#### `surge`

```
[StatusBar: SURGE red pulse]
[EscalationQueueSection: FULL WIDTH, expanded, largest text]
[DispatchStatsCards: only Active + Stalled visible, red labels]
[ResponderAvailabilityPanel: full width, coverage gaps highlighted]
[RecentEventsFeed: condensed, scrollable list — no charts]
```

- `DispatchVolumeChart` and `MunicipalPerformanceTable` **collapse to summary rows** (hidden by default, expandable via button)
- Escalation queue dominates the viewport
- Responder availability becomes full-width to show coverage gaps
- Events feed stays but is a compact scrolling list

### 2.3 CSS Implementation

Tailwind JIT scans source files for class names; it does NOT discover dynamically-generated strings like `` `mode-${mode}` ``. Therefore, mode-driven layout must use **conditional `className` composition in JSX**, not dynamic CSS selectors.

```tsx
// DASHBOARDPAGE.TSX — mode-driven layout (inline className composition)
<main className="flex-1 overflow-auto p-4" id="main-content">
  <div className="space-y-4">
    {/* EscalationQueue: hidden in calm, full-width in surge, normal otherwise */}
    <div className={mode === 'calm' ? 'hidden' : mode === 'surge' ? 'col-span-full' : ''}>
      <EscalationQueueSection ... />
    </div>

    {/* Stats cards: in surge, only show Active + Stalled */}
    <DispatchStatsCards
      mode={mode}
      showAll={mode !== 'surge'}
      ...
    />

    {/* Charts: hidden in surge, dimmed in degraded */}
    <div className={mode === 'surge' ? 'hidden' : mode === 'degraded' ? 'opacity-50' : ''}>
      <DispatchVolumeChart ... />
    </div>

    {/* Municipal table: hidden by default in surge, expandable */}
    {mode !== 'surge' && <MunicipalPerformanceTable ... />}
    {mode === 'surge' && (
      <button onClick={() => setShowMuniTable(true)}>Show municipal details</button>
    )}
  </div>
</main>
```

**Key rule:** No `.mode-*` CSS classes. Every mode-driven style is an explicit conditional in JSX className.

### 2.4 Animation

- Mode transitions: `transition-all duration-300 ease-in-out` on panel containers
- No height animations (layout thrashing risk) — use `display` and `grid-column` toggles
- `prefers-reduced-motion`: disable pulse and transitions, instant snap

---

## 3. Action Trust & Feedback System

### 3.1 Wire the `Re-dispatch` Button (P0 Fix)

**Current state:** `handleReDispatch` in `DashboardPage` is a no-op.

**New flow:**

1. `EscalationQueueSection` button click → `onReDispatch(dispatchId)`
2. `DashboardPage` stores `dispatchId` in state and opens `ReDispatchModal`
3. `ReDispatchModal` presents responder candidates from `useResponderFleet`
4. User selects responder
5. `DashboardPage` calls `callables.redispatchReport({ oldDispatchId, newResponderUid, reason: "Re-dispatched via dashboard", idempotencyKey: crypto.randomUUID() })`
6. On success: show `SuccessBanner` with `"Re-dispatched to {responderName}"`
7. On error: show `ActionErrorBanner` with specific error message
8. Modal closes on success or explicit cancel

```typescript
// DashboardPage.tsx — new state
const [reDispatchModalOpen, setReDispatchModalOpen] = useState(false)
const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null)
const [successMessage, setSuccessMessage] = useState<string | null>(null)
const [actionError, setActionError] = useState<string | null>(null)

const handleReDispatch = useCallback((dispatchId: string) => {
  setSelectedDispatchId(dispatchId)
  setReDispatchModalOpen(true)
}, [])

const handleConfirmReDispatch = useCallback(
  async (newResponderUid: string) => {
    if (!selectedDispatchId) return
    try {
      await callables.redispatchReport({
        oldDispatchId: selectedDispatchId,
        newResponderUid,
        reason: 'Re-dispatched via dashboard',
        idempotencyKey: crypto.randomUUID(),
      })
      setSuccessMessage('Re-dispatched successfully')
      setReDispatchModalOpen(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Re-dispatch failed')
    }
  },
  [selectedDispatchId],
)
```

**Callable contract:** `redispatchReport` is already implemented in `functions/src/domains/dispatches/redispatch-report.ts`. It requires:

- `oldDispatchId: string` (the stalled dispatch ID)
- `newResponderUid: string`
- `reason: string` (trimmed, 1-500 chars)
- `idempotencyKey: string` (UUID v4)

### 3.2 Success Feedback Wiring

**Current state:** `SuccessBanner` exists but is never rendered.

**New pattern:** Every page performing high-stakes actions maintains a transient success state:

```typescript
const [successMessage, setSuccessMessage] = useState<string | null>(null)

// After any successful action
setSuccessMessage('Alert declared for Daet, Basud')

// Render
{successMessage && (
  <SuccessBanner
    message={successMessage}
    onDismiss={() => setSuccessMessage(null)}
  />
)}
```

**Auto-dismiss:** `SuccessBanner` internally uses `useEffect` with `setTimeout(onDismiss, 4000)`. Cleanup function clears the timeout to prevent race conditions when a new message arrives before the old timer fires.

```typescript
// SuccessBanner.tsx
useEffect(() => {
  const id = setTimeout(onDismiss, 4000)
  return () => clearTimeout(id)
}, [message, onDismiss])
```

**Banner stacking:** If both `successMessage` and `actionError` are set simultaneously, render `ActionErrorBanner` **above** `SuccessBanner` (errors are more urgent). Setting one should clear the other:

```typescript
const setSuccess = (msg: string | null) => {
  setActionError(null)
  setSuccessMessage(msg)
}
```

**Actions triggering success feedback:**

| Action              | Success Message                         |
| ------------------- | --------------------------------------- |
| Declare alert       | `"Alert declared for {municipalities}"` |
| Verify report       | `"Report verified and published"`       |
| Re-dispatch         | `"Re-dispatched to {responderName}"`    |
| Publish feed item   | `"Feed item published"`                 |
| Unpublish feed item | `"Feed item unpublished"`               |
| Hold-to-dispatch    | `"Dispatched to {responderName}"`       |

**Error handling:** All actions already show `ActionErrorBanner`. The new pattern adds `SuccessBanner` for the happy path. Keep error handling as-is.

### 3.3 Explicit Unknown States

**Current state:** `MunicipalPerformanceTable` renders `—` for missing data.

**New copy and visual treatment:**

| Field                            | Current | New Copy          | Visual                                                                                       |
| -------------------------------- | ------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `activeResponders === undefined` | `—`     | `"No telemetry"`  | `text-muted` + `HelpCircle` icon with `title="No responder telemetry for this municipality"` |
| `avgResponseTime === undefined`  | `—`     | `"Not measured"`  | `text-muted`                                                                                 |
| `adminOnDuty === undefined`      | `—`     | `"No shift data"` | `text-muted` + `HelpCircle` icon with `title="No admin shift scheduled"`                     |

**Rationale:** Unknown is not zero. In command software, missing telemetry must be visible as a **data-quality state**, not silently treated as calm. The `HelpCircle` icon provides context without adding clutter.

---

## 4. Accessibility

### 4.1 Skip Link

**New component:** `SkipLink.tsx`

```tsx
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
    >
      Skip to main content
    </a>
  )
}
```

**Placement:** First child inside `<body>` (rendered in `App.tsx`). Every page's `<main>` MUST have `id="main-content"`.

### 4.2 Live Announcer

**New component:** `LiveAnnouncer.tsx` — singleton mounted at app root.

```tsx
// In App.tsx
<LiveAnnouncer />
```

**Pattern:** Module-level ref (no React context needed). A module-level variable holds the `setAnnouncement` function; `announce()` is a plain exported function callable from anywhere.

```typescript
// apps/admin-desktop/src/components/LiveAnnouncer.tsx
let announceFn: ((msg: string) => void) | null = null

export function announce(message: string) {
  announceFn?.(message)
}

export function LiveAnnouncer() {
  const [announcement, setAnnouncement] = useState('')
  // ... rate-limiting and queue logic ...
  useEffect(() => {
    announceFn = setAnnouncement
    return () => { announceFn = null }
  }, [setAnnouncement])
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  )
}
```

**Rate limiting:** Minimum 3 seconds between announcements. If multiple calls arrive within the window, they batch into a single message (e.g., "3 new reports and 2 dispatch updates").

**What gets announced:**

- New reports: `"3 new reports pending triage"`
- Dispatch state changes: `"Dispatch to Basud Fire accepted"`
- Mode transitions: `"Dashboard mode changed to SURGE"`
- Offline/online: `"Connection lost. Dashboard in degraded mode."` / `"Connection restored."`

### 4.3 Keyboard Navigation

- `EscalationQueueSection` cards: `tabIndex={0}` on each card, arrow-key navigation between cards
- Mode transitions: focus does NOT move automatically (avoids disorienting), but `aria-live` announces
- Success/Error banners: `role="alert"` for errors (assertive), `role="status"` for success (polite)
- Existing shortcuts preserved: `r` = focus first re-dispatch, `d` = dispatches, `f` = feed, `?` = help, `Esc` = close modals

---

## 5. Backend Gaps (Documented for Future Enhancement)

This design is **frontend-only**. The following backend capabilities would improve accuracy but are NOT blockers:

| Gap                                                    | Current Frontend Fallback                            | Future Backend Enhancement                                                 |
| ------------------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| Historical baselines for mode thresholds               | Hardcoded constants (active > 20, response > 10m)    | `getProvinceStatus` callable with 30-day rolling averages per municipality |
| Anomaly detection                                      | None — mode is purely threshold-based                | Backend anomaly scorer (e.g., incidents > 2σ above weekly average)         |
| Weather / PAGASA integration                           | None                                                 | `hazard_signals` collection with automated PAGASA ingest                   |
| True "degraded" detection (Firewalls, provider health) | Frontend hook errors only                            | `getSystemHealth` callable with provider circuit-breaker status            |
| Cross-municipality correlation                         | Frontend only sees data for connected municipalities | Backend pre-computed `affectedMunicipalities` with auto-border detection   |
| Predictive responder coverage gaps                     | Static `activeResponders === 0` check                | Backend model accounting for shift schedules, ETA, and en-route status     |

**Recommendation:** Implement the frontend mode system now. Add a `getProvinceStatus` callable in a follow-up sprint when the dashboard has proven the heuristic thresholds are useful.

---

## 6. Implementation Decomposition

The full design touches 11 files. Per the "smallest safe change" rule, this is decomposed into **4 independent PRs**, each reviewable and reversible:

---

### PR 1: Trust Fixes (P0 + P1 immediate)

**Goal:** Fix the no-op Re-dispatch, add success feedback, and replace ambiguous placeholders.

| File                                                              | Change                                                                           |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/admin-desktop/src/pages/DashboardPage.tsx`                  | Wire `ReDispatchModal` to `handleReDispatch`; add success/error state management |
| `apps/admin-desktop/src/components/SuccessBanner.tsx`             | Add internal auto-dismiss (`useEffect` + `setTimeout` 4000ms)                    |
| `apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx` | Replace `—` dashes with explicit unknown copy + `HelpCircle` tooltips            |

**New files:** None.

**Verification:** Re-dispatch E2E test; success banner auto-dismiss test; unknown state rendering test.

---

### PR 2: Situation Strip

**Goal:** Transform `StatusBar` into the province command strip.

| File                                              | Change                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/admin-desktop/src/components/StatusBar.tsx` | Expand to situation strip: mode badge, affected municipalities, blocking response, coverage, freshness, operational labels |
| `apps/admin-desktop/src/hooks/useOpsMetrics.ts`   | Expose `lastPollAt` timestamp for freshness calculation                                                                    |

**New files:**

| File                                             | Purpose                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `apps/admin-desktop/src/utils/dashboard-mode.ts` | `deriveDashboardMode()` + `DashboardMode` type + threshold constants |

**Verification:** StatusBar renders mode badge correctly; freshness text updates; operational labels show at thresholds.

---

### PR 3: Layout Adaptation

**Goal:** Make `DashboardPage` layout mode-aware.

| File                                                           | Change                                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `apps/admin-desktop/src/pages/DashboardPage.tsx`               | Add mode derivation, conditional layout (escalation visibility, chart hiding, stats filtering) |
| `apps/admin-desktop/src/components/EscalationQueueSection.tsx` | Add `mode` prop for collapse/expand behavior                                                   |
| `apps/admin-desktop/src/components/DispatchStatsCards.tsx`     | Add `mode` prop; in `surge`, only render Active + Stalled cards                                |

**New files:** None.

**Verification:** Mode transition `calm` → `active` → `surge` renders correct panels; `calm` hides escalation queue; `surge` hides charts.

---

### PR 4: Accessibility Foundation

**Goal:** Add skip link and live announcer.

| File                                 | Change                                             |
| ------------------------------------ | -------------------------------------------------- |
| `apps/admin-desktop/src/app/App.tsx` | Add `<SkipLink />` and `<LiveAnnouncer />` at root |

**New files:**

| File                                                  | Purpose                                               |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `apps/admin-desktop/src/components/SkipLink.tsx`      | Skip-to-main-content link                             |
| `apps/admin-desktop/src/components/LiveAnnouncer.tsx` | Singleton aria-live region with queue + rate limiting |

**Verification:** Skip link visible on focus; LiveAnnouncer queues and rate-limits announcements.

---

### Merge Order

1. PR 1 (Trust fixes) — fixes the most dangerous issue (no-op action)
2. PR 2 (Situation strip) — adds the command-board identity
3. PR 3 (Layout adaptation) — makes the strip drive the layout
4. PR 4 (Accessibility) — additive a11y improvements, can merge anytime after PR 1

Each PR must pass `pnpm typecheck`, `pnpm lint`, and `pnpm --dir apps/admin-desktop exec vitest run` independently.

---

## 7. Testing Strategy

### Unit Tests (existing patterns)

| Component                   | Test Focus                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `StatusBar`                 | Mode badge renders correctly per mode; municipality chips navigate; freshness updates; operational labels show correct color |
| `DashboardMode` util        | Threshold boundaries; debounce stability; transition logic                                                                   |
| `EscalationQueueSection`    | Collapses in `calm`; expands in `surge`; hidden when empty                                                                   |
| `DispatchStatsCards`        | Labels appear at threshold boundaries; colors match severity                                                                 |
| `MunicipalPerformanceTable` | Unknown states render correct text + icons; tooltips present                                                                 |
| `SuccessBanner`             | Auto-dismisses after 4000ms; dismiss button works                                                                            |
| `SkipLink`                  | Visible on focus; links to `#main-content`                                                                                   |
| `LiveAnnouncer`             | Queues announcements; rate-limits to 3s; batches within window                                                               |

### Integration Tests

| Flow                              | Verification                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| Mode transition `calm` → `active` | StatusBar updates; escalation queue appears; layout shifts                                  |
| Re-dispatch E2E                   | Click Re-dispatch → modal opens → select responder → success banner → dispatch list updates |
| Success feedback                  | Declare alert → banner appears → auto-dismisses                                             |
| Unknown states                    | Table with undefined responders shows "No telemetry"                                        |
| Keyboard                          | Skip link focusable; escalation cards arrow-navigable                                       |

---

## 8. Verification Commands

```bash
# Typecheck all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Admin-desktop unit tests
pnpm --dir apps/admin-desktop exec vitest run

# Local proof (cross-app E2E)
pnpm proof:local
```

---

## 9. Risks

| Risk                                      | Mitigation                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Layout jank during mode transitions       | Use CSS `display` / `grid-column` toggles, not height animations. `prefers-reduced-motion` respected. |
| Mode flicker between `active` and `surge` | 5-second debounce on mode transitions.                                                                |
| Freshness timer drift                     | Re-sync `lastDataUpdateAt` on every hook snapshot, not just derived from a single source.             |
| Re-dispatch callable failure              | Existing error handling in `ActionErrorBanner` is preserved. Success path is additive.                |
| Accessibility regressions                 | All new interactive elements have `aria-label`. Skip link + live announcer are new, additive only.    |
| Test coverage gap                         | Write failing tests for mode transitions and Re-dispatch flow before implementation (TDD).            |

---

_Design approved. Ready for implementation plan._
