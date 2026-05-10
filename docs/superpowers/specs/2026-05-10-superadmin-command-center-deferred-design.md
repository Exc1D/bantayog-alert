# Superadmin Command Center — Phase 1 Deferred Features Design

> **Date:** 2026-05-10
> **Scope:** Wire all deferred components, Firestore data, cross-window sync, audio alerts, and callable integration into DashboardPage and MapPage.
> **Base Directory:** `apps/admin-desktop/`

---

## 1. Architecture Overview

**Two data planes:**

1. **Live operational plane** — Firestore `onSnapshot` subscriptions via `useFirestoreListeners`
   - `reports` collection (scoped to `status in ['PENDING', 'ACTIVE']`, `orderBy('createdAt', 'desc')`, `limit(500)`) → TriageQueueTable, IncidentLayer pins, TrendAnalysisPanel
   - `report_ops` collection (scoped to active reports, `limit(500)`) → MunicipalPerformanceTable, AnomalyAlertPanel, response-time joins
   - `alerts` collection (`limit(100)`) → AnomalyAlertPanel as additional context
   - RTDB `responder_locations` → ResponderLayer dots

2. **Historical analytics plane** — Client-side aggregation from the live subscription
   - Computed in `TrendAnalysisPanel` via `useMemo` over the `reports` array
   - No backend callable for Phase 1. Inflection point for Phase 2: when trend analysis needs history beyond what the live subscription scopes (e.g., 90 days vs. active-only).

**Cross-window sync:** `BroadcastChannel` via `WindowSyncProvider`. DashboardPage sends `select:report` / `select:municipality` on user action. MapPage subscribes and dispatches to `commandCenterStore`.

**Anti-loop guard (structural):** The store holds a `suppressNextBroadcast` boolean. Before calling `sendSync`, the sender sets it; the store's `useEffect` that normally calls `sendSync` on state change checks this flag and clears it before returning. This makes the guard structural — a refactor that accidentally triggers `sendSync` from a new code path will still be blocked because the flag lives in the store, not in the call site.

**Audio alerts:** `useAudioAlerts` triggers on new `PENDING` reports. One tone per Firestore batch, regardless of batch size. Default `enabled: false` (opt-in). Respects `prefers-reduced-motion` on init.

**Triage actions:** Dashboard and Map both call `verifyReport`, `rejectReport`, `dispatchResponder` from `callables.ts`. On success, Firestore subscription auto-updates the UI.

---

## 2. DashboardPage Wiring

**Layout — stacked vertically in the main content area:**

```
OfflineBanner
CommandHeader (title, live indicator, audio toggle, notifications, map-open button)
StatusBar (sticky, 3 metrics + surge glow + expand/collapse)
  TriageQueueTable (reports from useFirestoreListeners)
  MunicipalPerformanceTable (from reportOps subscription)
  AnomalyAlertPanel (from reportOps + alerts subscription)
  TrendAnalysisPanel (client-side agg from reports sub)
```

**Data flow:**

- `DashboardPage` calls `useFirestoreListeners({ windowType: 'dashboard', db, rtdb })` once at the top level
- `reports` array → `TriageQueueTable` (replacing mock data) and `TrendAnalysisPanel` (raw material for aggregation)
- `reportOps` array → `MunicipalPerformanceTable` and `AnomalyAlertPanel`
- `alerts` array → `AnomalyAlertPanel` as additional context
- `loading` state gates the initial render (skeleton/loading state for all child components)

**StatusBar surge glow:**

- **Trigger:** `pendingTriage >= 20` OR `activeIncidents >= 50` (both thresholds evaluated every report update).
- **Color:** The entire StatusBar border transitions to `border-[#c77600]` (warning amber), overriding the default `border-white/10`.
- **Animation:** CSS `animate-pulse` on the border only. Pulse persists while the condition is true, stops immediately when both thresholds drop below.
- **No sound:** Visual only. Audio alerts are a separate system (new PENDING reports).

**Triage actions:**

- `handleVerify` → `callables.verifyReport({ reportId, idempotencyKey: generateIdempotencyKey() })`
- `handleReject` → opens a reject modal with a **reason dropdown** (`obviously_false` | `duplicate` | `test_submission` | `insufficient_detail`) + optional notes textarea. On confirm: `callables.rejectReport({ reportId, idempotencyKey: generateIdempotencyKey(), reason, notes })`
- `handleDispatch` → opens map window (`window.open('/map', 'bantayog-map', ...)`). The dashboard does **not** call `dispatchResponder` directly.

**`generateIdempotencyKey()` fallback:**

```typescript
function generateIdempotencyKey(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
```

`crypto.randomUUID()` is unavailable on HTTP (localhost dev) and older browsers. The fallback covers both. **All callable invocations must use this function** — including `onDispatch` in TriagePanel (do not call `crypto.randomUUID()` directly).

**Keyboard shortcuts:** Already wired, stay as-is.

**Audio toggle:** Speaker icon (`Volume2`/`VolumeX`) in CommandHeader, between LiveIndicator and Bell. Calls `useAudioAlerts().toggle()`.

---

## 3. MapPage Wiring

**Layout — full-bleed map with floating overlays:**

```
OfflineBanner
CommandHeader (no map-open button)
  ProvincialMap (CartoDB dark tiles)
    MapOverlayControls (absolute, top-left)
    MunicipalDrillDown (absolute, floating)
    TriagePanel (slides in from right)
```

**Data flow:**

- `MapPage` calls `useFirestoreListeners({ windowType: 'map', db, rtdb })`
- `reports` → `ProvincialMap` → `IncidentLayer` (pins with severity color + pulse)
- `responders` → `ResponderLayer` (blue dots from RTDB)
- `selectedReportId` from Zustand store → `TriagePanel` slides in with report details
- `selectedMunicipalityId` from store → `MunicipalDrillDown` floating card

**Overlay controls (`MapOverlayControls`, absolute top-left):**

- Toggles: All Incidents, Heatmap, Responders, Municipal Boundaries
- Mutually exclusive where appropriate (heatmap vs. all-incidents pins)
- Updates `activeOverlays` in Zustand store

**Cross-window sync:**

```typescript
// DashboardPage side
const handleRowClick = (report: Report) => {
  selectReport(report.id)
  sendSync({ type: 'select:report', reportId: report.id, source: 'dashboard' })
}

useEffect(() => {
  return subscribe((msg) => {
    if (msg.source === 'map' && msg.type === 'select:report') {
      selectReport(msg.reportId)
    }
    if (msg.source === 'map' && msg.type === 'select:municipality') {
      selectMunicipality(msg.municipalityId)
    }
  })
}, [subscribe, selectReport, selectMunicipality])
```

```typescript
// MapPage side
const handlePinClick = (reportId: string) => {
  selectReport(reportId)
  sendSync({ type: 'select:report', reportId, source: 'map' })
}

useEffect(() => {
  return subscribe((msg) => {
    if (msg.source === 'dashboard' && msg.type === 'select:report') {
      selectReport(msg.reportId)
    }
    if (msg.source === 'dashboard' && msg.type === 'select:municipality') {
      selectMunicipality(msg.municipalityId)
    }
  })
}, [subscribe, selectReport, selectMunicipality])
```

Anti-loop: the receiving window updates the store directly. The store-change `useEffect` that calls `sendSync` only fires on **user-initiated** actions, not on store changes from BC.

**Dispatch flow (MapPage owns the callable):**

```typescript
<TriagePanel
  report={selectedReport}
  onClose={() => selectReport(null)}
  onVerify={handleVerify}        // calls verifyReport callable
  onReject={handleReject}        // calls rejectReport callable
  onDispatch={async (reportId, agency, responder) => {
    await dispatchResponder({
      reportId,
      responderUid: responder,
      idempotencyKey: generateIdempotencyKey(),
    })
  }}
/>
```

TriagePanel is presentational — it fires `onDispatch(reportId, agency, responder)` callback. MapPage owns the callable invocation, error handling, and loading state. The responder dropdown UI in TriagePanel must land in the same PR as the `onDispatch` handler so dispatch is end-to-end from day one.

**Agency dropdown data source:** Agencies are a static allowlist (`['BFP', 'PNP', 'MDRRMO', 'Coast Guard']`) hardcoded in the component. This is a Phase 1 simplification — no backend query needed. The responder dropdown below it is populated from the `responders` array returned by `useFirestoreListeners` (RTDB `responder_locations`), filtered by the selected agency. If no responders match the selected agency, the dropdown shows "No responders available" as a disabled option.

**Responder cascade flow:**

1. User selects agency from static list → responder dropdown enables.
2. Responder dropdown shows only responders whose `agency` field matches the selection.
3. User selects responder → dispatch button enables.
4. Clicking dispatch calls `onDispatch(report.id, selectedAgency, selectedResponderUid)`.

**Sequential pin clicks:** When the panel is already open and the user clicks a different pin, the panel swaps content immediately with no exit/re-enter animation. The panel stays open; only the inner report data changes. This avoids the jarring flash of a closing+reopening animation.

**Keyboard and focus management:**

- On open: focus moves to the panel container (`tabIndex={-1}`, `useRef` + `.focus()` in `useEffect` keyed on `report?.id`).
- On close: focus returns to the map canvas (the previously focused element before the panel opened, or the map container as fallback).
- `Escape` key closes the panel (already wired via global keyboard shortcuts).
- Screen reader: panel has `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the report-id heading. Focus trap is not required (panel is a non-modal sidebar, not a blocking dialog).

---

## 4. Trend Analysis Charts (Client-Side Aggregation)

**Data source:** `reports` array from `useFirestoreListeners` (already in memory). No backend callable.

**Aggregation layer:** Pure `useMemo` over the live reports stream. O(n) on data already held.

**ReportOps typing and validation:**

```typescript
type ReportOpsDoc = {
  id: string
  reportId: string
  acknowledgedAt?: string
  status?: string
}
```

Validation before use (defensive — `noUncheckedIndexedAccess` makes array access return `T | undefined`):

```typescript
function isReportOpsDoc(doc: unknown): doc is ReportOpsDoc {
  const d = doc as Record<string, unknown>
  return typeof d?.id === 'string' && typeof d?.reportId === 'string'
}

const ops = reportOps.filter(isReportOpsDoc)
```

This filters out malformed docs silently rather than crashing on `.acknowledgedAt` access.

**Per-tab aggregation:**

| Tab                 | Bucketing                                    | Data Function                                                                                                                                                                                                                                                                             | Default? |
| ------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **Incident Volume** | Time bucket (24h = by hour, 7d/30d = by day) | `reports.filter(createdAt in range).reduce(byBucket, count)`                                                                                                                                                                                                                              | **Yes**  |
| **Response Time**   | Time bucket                                  | Build `Map<reportId, ReportOpsDoc>` from `reportOps` in a first `useMemo` (O(n)). Then O(1) lookup per report. Diff `acknowledgedAt - createdAt`. Average per bucket. **Drop records where reportOps doc is missing** — documented bias: averages skew toward reports that have ops data. | No       |
| **Resource Util**   | Current snapshot                             | `responders.length` from RTDB. Active vs. idle count.                                                                                                                                                                                                                                     | No       |
| **Muni Comparison** | Municipality                                 | `reports.filter(createdAt in range).reduce(byMunicipality, count)`. Horizontal bar chart.                                                                                                                                                                                                 | No       |

**Resource Util empty state:** If `responders.length === 0` (no responders online or RTDB unreachable), show a centered message: "No responders currently online" with `role="status"`. Do not render a chart or show 0/0 counts that could be misread as data.

**Dark mode:** The command center UI is dark-mode only. All color tokens (`--color-surface`, `--color-navy`, `--color-text-primary`, etc.) are defined in dark-space values. No light-mode toggle. This is correct for a 24/7 ops room where bright screens cause eye fatigue.

**Date parsing:** `createdAt` on ReportDoc is a `string` (Firestore Timestamp.toISO() at read time). Use `new Date(r.createdAt)` before range comparison — standard JS Date math, not Firestore timestamp math.

**TrendAnalysisPanel props interface:**

```typescript
interface TrendAnalysisPanelProps {
  reports: ReportDoc[]
  reportOps: ReportOpsDoc[]
  responders: [string, unknown][]
}
```

The component receives data as props; `activeTab` and `timeRange` remain internal state. This decouples data fetching from presentation.

**Chart library:** Recharts. `<LineChart>` for volume/response-time, `<BarChart layout="vertical">` for muni comparison.

**Implementation split (two PRs):**

- **PR1:** Props interface + data wiring from parent (DashboardPage passes reports/reportOps/responders). Stub renders placeholder text per tab — no Recharts yet.
- **PR2:** Recharts integration + full aggregation logic across all 12 branches (4 tabs × 3 time ranges).

**Empty states:**

- No data in range → centered "No incidents in selected period" with `role="status"`
- Loading (initial Firestore connect) → skeleton pulse on chart area

---

## 5. Audio Alerts

**Trigger mechanism (DashboardPage only):**

```typescript
const prevIdsRef = useRef<Set<string>>(new Set())
const { play } = useAudioAlerts()

useEffect(() => {
  const currentPending = new Set(reports.filter((r) => r.status === 'PENDING').map((r) => r.id))
  const newArrivals = reports.filter((r) => r.status === 'PENDING' && !prevIdsRef.current.has(r.id))
  if (newArrivals.length > 0 && play) {
    play() // single tone, regardless of batch size
  }
  prevIdsRef.current = currentPending
}, [reports, play])
```

**`useAudioAlerts` init:**

```typescript
const [enabled, setEnabled] = useState(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'true'
  } catch {
    return false
  }
})
```

Default is `false` (opt-in). `AudioContext` is created **lazily inside `play()` on first user-invoked call**, not in `useEffect`. Gate with `resume()` if suspended:

```typescript
const play = useCallback(() => {
  if (!enabled) return
  if (document.visibilityState === 'hidden') return // Don't fire on background tab
  if (!ctxRef.current) {
    ctxRef.current = new AudioContext()
  }
  const ctx = ctxRef.current
  if (ctx.state === 'suspended') {
    void ctx.resume()
  }
  // ... oscillator setup
}, [enabled])
```

**UI toggle:** Speaker icon in CommandHeader, between LiveIndicator and Bell button.

```typescript
<button
  onClick={toggle}
  aria-label={enabled ? 'Mute audio alerts' : 'Enable audio alerts'}
  className="rounded-md p-2 hover:bg-white/10"
>
  {enabled ? (
    <Volume2 className="h-4 w-4 text-[var(--color-success)]" />
  ) : (
    <VolumeX className="h-4 w-4 text-white/50" />
  )}
</button>
```

MapPage has no audio. DashboardPage is the primary triage surface.

---

## 6. Error Handling & Loading States

**`useFirestoreListeners` error callback and re-subscription:**

Firestore `onSnapshot` does NOT auto-retry after error — the listener dies permanently. Implement explicit re-subscription:

```typescript
const [error, setError] = useState<string | null>(null)
const [retryCount, setRetryCount] = useState(0)
const MAX_RETRIES = 3

function subscribeReports() {
  return onSnapshot(
    reportsRef,
    (snapshot) => {
      setError(null)
      setRetryCount(0)
      // ... process snapshot
    },
    (err) => {
      setError(err.message)
      if (retryCount < MAX_RETRIES) {
        setRetryCount((c) => c + 1)
        // useEffect dependency on retryCount triggers re-subscription
      }
    },
  )
}
```

The `useEffect` dependency array includes `[retryCount, windowType, db, rtdb]`. A retry increments `retryCount`, which re-runs the effect and creates a fresh subscription. After `MAX_RETRIES` exceeded, the error persists and requires manual page refresh.

Return signature: `{ loading, error, reports, reportOps, alerts, responders }`

**RTDB cleanup verification:** The RTDB `onValue` unsubscribe is pushed to the same `unsubscribers` array as Firestore listeners. The cleanup function iterates the entire array. This is verified in the error-handling test suite.

**OfflineBanner extension (to implement):**

Add optional `error` prop. When `error` is provided, render in danger style instead of offline style:

```typescript
interface Props {
  error?: string | null
}
```

**Callable errors:** Inline banner above the affected component.

```typescript
{actionError && (
  <div className="bg-[var(--color-danger)]/20 border border-[var(--color-danger)] text-[var(--color-danger)] px-4 py-2 text-sm" role="alert">
    {actionError}
    <button onClick={() => setActionError(null)} className="ml-2 underline">Dismiss</button>
  </div>
)}
```

Error banners persist until explicitly dismissed. No auto-dismiss. Clicking the Dismiss button clears the error state. This matches command-center ops discipline: an operator must acknowledge an error, not have it vanish during a distraction.

**Audible error cue:** When a callable error occurs AND audio alerts are enabled, play a short low-tone burst (200ms, 200Hz) distinct from the new-report tone (400ms, 800Hz). This gives operators an auditory signal that something failed even if their eyes are on the map. The tone fires once per error, not repeatedly.

**Map tile failures:** Leaflet default behavior (blank tile on failure). No custom handling for Phase 1.

---

## 7. Testing Strategy

**New focused test files (existing stubs untouched):**

| Test File                             | Coverage                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard-firestore-wiring.test.tsx` | DashboardPage with mocked `useFirestoreListeners`; verify all sub-components receive correct props; verify callable invocations on verify/reject                                                                                                                                                                                                   |
| `map-firestore-wiring.test.tsx`       | MapPage with mocked `useFirestoreListeners`; verify `IncidentLayer`/`ResponderLayer` receive data; verify `TriagePanel` dispatch callback calls callable                                                                                                                                                                                           |
| `trend-aggregation.test.tsx`          | `TrendAnalysisPanel` with mocked `reports`/`reportOps`; verify every aggregation branch (24h/7d/30d × volume/response/muni). Response-time join branch with missing `reportOps` doc is the most important — silent data loss guard. Either export a pure `aggregateVolume(reports, range)` function or test via component with fully mocked props. |
| `cross-window-sync.test.tsx`          | Mock `BroadcastChannel` shared across two store instances; verify bidirectional `select:report` and `select:municipality`                                                                                                                                                                                                                          |
| `useFirestoreListeners.error.test.ts` | Verify error callback sets `error` state; verify cleanup unsubscribes all listeners                                                                                                                                                                                                                                                                |

**Coverage target:** 70% for new wiring code, 100% for aggregation logic.

**What NOT to test:** Leaflet tile rendering, actual Firestore queries, actual audio output.

---

## 8. NOT Doing

- New backend callable for analytics (deferred to Phase 2 — inflection point: 90-day history vs. active-only scope)
- Custom toast component (covered by persistent inline banners + audible error cue in Phase 1)
- Map tile fallback provider (Leaflet default)
- Refactoring existing stub tests (new files only)
- Real-time chart updates via WebSocket (30-second aggregation recompute from onSnapshot is sufficient)

---

## 9. Files to Change

| File                                                | Action          | Why                                                             |
| --------------------------------------------------- | --------------- | --------------------------------------------------------------- |
| `src/hooks/useFirestoreListeners.ts`                | Modify          | Add error callback, `ReportOpsDoc` type, `error` return         |
| `src/hooks/useAudioAlerts.ts`                       | Modify          | Add `prefers-reduced-motion` init guard                         |
| `src/components/OfflineBanner.tsx`                  | Modify          | Add optional `error` prop                                       |
| `src/components/CommandHeader.tsx`                  | Modify          | Add audio toggle button                                         |
| `src/components/TrendAnalysisPanel.tsx`             | Modify          | Replace placeholder with Recharts + aggregation logic           |
| `src/components/TriagePanel.tsx`                    | Modify          | Wire responder dropdown + pass to `onDispatch`                  |
| `src/pages/DashboardPage.tsx`                       | Modify          | Wire `useFirestoreListeners`, sub-components, audio, callables  |
| `src/pages/MapPage.tsx`                             | Modify          | Wire `useFirestoreListeners`, sub-components, dispatch callable |
| `src/stores/commandCenterStore.ts`                  | Possibly modify | Add `selectedMunicipalityId` if not present                     |
| `src/__tests__/dashboard-firestore-wiring.test.tsx` | Create          | Dashboard wiring tests                                          |
| `src/__tests__/map-firestore-wiring.test.tsx`       | Create          | Map wiring tests                                                |
| `src/__tests__/trend-aggregation.test.tsx`          | Create          | Chart aggregation tests                                         |
| `src/__tests__/cross-window-sync.test.tsx`          | Create          | BroadcastChannel sync tests                                     |
| `src/__tests__/useFirestoreListeners.error.test.ts` | Create          | Error handling tests                                            |
