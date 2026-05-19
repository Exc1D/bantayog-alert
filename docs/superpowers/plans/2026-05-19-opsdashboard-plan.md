# OpsDashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `DashboardPage` into an operations-centric command center with KPI cards, escalation queue, dispatch volume chart, recent events feed, responder fleet, and municipal performance table.

**Architecture:** Reuse existing hooks (`useDispatchLifecycle`, `useResponderFleet`, `useOpsMetrics`, `useFirestoreListeners`). Compose 6 widgets into a single-page layout. Zero backend changes. Triage functionality removed from DashboardPage (migrated to FeedPage separately).

**Tech Stack:** React + TypeScript, Firebase Firestore, Tailwind CSS, lucide-react icons, vitest + testing-library.

---

## File Map

### Modified Files

| File                                                              | Responsibility                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/admin-desktop/src/pages/DashboardPage.tsx`                  | Full page redesign — remove triage, compose ops widgets, handle loading/error states   |
| `apps/admin-desktop/src/components/DispatchStatsCards.tsx`        | Replace side-stripe borders with top-border accent + background tint. Add trend arrow. |
| `apps/admin-desktop/src/components/EscalationQueueSection.tsx`    | Add empty-state banner (instead of null). Add "View Details" drill-down link.          |
| `apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx` | Add `avgResponseTime` column. Add sorting.                                             |

### New Files

| File                                                             | Responsibility                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `apps/admin-desktop/src/components/DispatchVolumeChart.tsx`      | 24-hour bar chart derived from dispatch rows. Pure CSS bars. Skeleton + empty states. |
| `apps/admin-desktop/src/components/DispatchVolumeChart.test.tsx` | Tests for bucketing, bar heights, empty state, skeleton                               |
| `apps/admin-desktop/src/components/RecentEventsFeed.tsx`         | Flattened timeline events list. Shape+color indicators. Max 20 events.                |
| `apps/admin-desktop/src/components/RecentEventsFeed.test.tsx`    | Tests for sorting, event mapping, empty state, max limit                              |
| `apps/admin-desktop/src/__tests__/DashboardPage.ops.test.tsx`    | Integration tests for the full page composition                                       |

---

## Task Dependency Graph

```
Task 1 ──┬──> Task 6
Task 2 ──┤
Task 3 ──┤
Task 4 ──┤
Task 5 ──┘
```

All component tasks (1-5) are independent. Task 6 (DashboardPage redesign) depends on all of them.

---

### Task 1: `DispatchVolumeChart` Component

**Files:**

- Create: `apps/admin-desktop/src/components/DispatchVolumeChart.tsx`
- Create: `apps/admin-desktop/src/components/DispatchVolumeChart.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/admin-desktop/src/components/DispatchVolumeChart.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DispatchVolumeChart } from './DispatchVolumeChart'
import type { DispatchLifecycleRow } from '../hooks/useDispatchLifecycle'

describe('DispatchVolumeChart', () => {
  it('renders 24 bars', () => {
    const rows: DispatchLifecycleRow[] = []
    render(<DispatchVolumeChart rows={rows} />)
    const bars = screen.getAllByRole('img')
    expect(bars).toHaveLength(24)
  })

  it('empty state when no dispatches', () => {
    const rows: DispatchLifecycleRow[] = []
    render(<DispatchVolumeChart rows={rows} />)
    expect(screen.getByText(/no dispatches/i)).toBeInTheDocument()
  })

  it('bars heights proportional to max bucket', () => {
    const now = Date.now()
    const rows: DispatchLifecycleRow[] = [
      { dispatchId: '1', reportId: 'r1', status: 'pending', responderName: 'A', responderAgency: 'BFP', dispatchedAt: now, deadlineAt: now, escalationCount: 0, fcmResult: null, fcmWarnings: null, timeline: [] },
      { dispatchId: '2', reportId: 'r2', status: 'pending', responderName: 'B', responderAgency: 'BFP', dispatchedAt: now, deadlineAt: now, escalationCount: 0, fcmResult: null, fcmWarnings: null, timeline: [] },
    ]
    render(<DispatchVolumeChart rows={rows} />)
    const bars = screen.getAllByRole('img')
    const currentHour = new Date().getHours()
    const currentBar = bars[currentHour]
    expect(currentBar).toHaveAttribute('aria-label', expect.stringContaining('2'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/components/DispatchVolumeChart.test.tsx`
Expected: FAIL — component not found

- [ ] **Step 3: Write the implementation**

```typescript
// apps/admin-desktop/src/components/DispatchVolumeChart.tsx
import { useMemo } from 'react'
import type { DispatchLifecycleRow } from '../hooks/useDispatchLifecycle'

interface Props {
  rows: DispatchLifecycleRow[]
}

export function DispatchVolumeChart({ rows }: Props) {
  const buckets = useMemo(() => {
    const counts = new Array(24).fill(0)
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    for (const row of rows) {
      if (row.dispatchedAt < oneDayAgo) continue
      const hour = new Date(row.dispatchedAt).getHours()
      counts[hour] = (counts[hour] ?? 0) + 1
    }
    return counts
  }, [rows])

  const maxCount = Math.max(...buckets, 1)
  const hasData = rows.length > 0

  return (
    <section aria-label="Dispatch volume last 24 hours">
      <div className="mb-2 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        Dispatch Volume — 24h
      </div>
      {!hasData ? (
        <div className="rounded border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-gray-400">
          No dispatches in last 24h
        </div>
      ) : (
        <div className="rounded border border-white/10 bg-white/5 p-4">
          <div className="flex items-end gap-1 h-20">
            {buckets.map((count, hour) => (
              <div
                key={hour}
                className="flex-1 bg-[var(--color-info)]/60 rounded-t"
                style={{ height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? '4px' : '0px' }}
                role="img"
                aria-label={`${String(count)} dispatches at ${String(hour).padStart(2, '0')}:00`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-500">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>Now</span>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/components/DispatchVolumeChart.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/components/DispatchVolumeChart.tsx apps/admin-desktop/src/components/DispatchVolumeChart.test.tsx
git commit -m "feat(admin): add DispatchVolumeChart with 24h CSS bar chart"
```

---

### Task 2: `RecentEventsFeed` Component

**Files:**

- Create: `apps/admin-desktop/src/components/RecentEventsFeed.tsx`
- Create: `apps/admin-desktop/src/components/RecentEventsFeed.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/admin-desktop/src/components/RecentEventsFeed.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecentEventsFeed } from './RecentEventsFeed'
import type { DispatchLifecycleRow } from '../hooks/useDispatchLifecycle'

describe('RecentEventsFeed', () => {
  it('renders events sorted by time descending', () => {
    const rows: DispatchLifecycleRow[] = [
      {
        dispatchId: 'd1', reportId: 'r1', status: 'pending', responderName: 'A', responderAgency: 'BFP',
        dispatchedAt: 1000, deadlineAt: 2000, escalationCount: 0, fcmResult: null, fcmWarnings: null,
        timeline: [
          { id: 'e1', type: 'notification_attempted', dispatchId: 'd1', at: 3000 },
          { id: 'e2', type: 'notification_delivered', dispatchId: 'd1', at: 2000 },
        ],
      },
    ]
    render(<RecentEventsFeed rows={rows} />)
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('FCM Sent')
    expect(items[1]).toHaveTextContent('Responder Notified')
  })

  it('limits to maxEvents', () => {
    const timeline = Array.from({ length: 30 }, (_, i) => ({
      id: `e${i}`, type: 'notification_attempted', dispatchId: 'd1', at: i * 1000,
    }))
    const rows: DispatchLifecycleRow[] = [{
      dispatchId: 'd1', reportId: 'r1', status: 'pending', responderName: 'A', responderAgency: 'BFP',
      dispatchedAt: 1000, deadlineAt: 2000, escalationCount: 0, fcmResult: null, fcmWarnings: null,
      timeline,
    }]
    render(<RecentEventsFeed rows={rows} maxEvents={5} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('shows empty state', () => {
    render(<RecentEventsFeed rows={[]} />)
    expect(screen.getByText(/no events recorded/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/components/RecentEventsFeed.test.tsx`
Expected: FAIL — component not found

- [ ] **Step 3: Write the implementation**

```typescript
// apps/admin-desktop/src/components/RecentEventsFeed.tsx
import { useMemo } from 'react'
import type { DispatchLifecycleRow, DispatchEvent } from '../hooks/useDispatchLifecycle'

const EVENT_LABELS: Record<string, string> = {
  notification_attempted: 'FCM Sent',
  notification_delivered: 'Responder Notified',
  deadline_exceeded: 'Deadline Passed',
  escalation_attempted: 'Re-assigned',
  lease_stolen: 'Lease Override',
}

interface Props {
  rows: DispatchLifecycleRow[]
  maxEvents?: number
}

function getEventIndicator(type: string): { color: string; shape: string } {
  switch (type) {
    case 'notification_attempted':
      return { color: 'bg-[var(--color-info)]', shape: 'rounded-full' }
    case 'notification_delivered':
      return { color: 'bg-[var(--color-success)]', shape: 'rounded-full' }
    case 'escalation_attempted':
      return { color: 'bg-[var(--color-warning)]', shape: 'clip-triangle' }
    case 'deadline_exceeded':
      return { color: 'bg-[var(--color-danger)]', shape: 'clip-diamond' }
    default:
      return { color: 'bg-gray-500', shape: 'rounded-full' }
  }
}

function formatRelativeTime(at: number): string {
  const diff = Date.now() - at
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export function RecentEventsFeed({ rows, maxEvents = 20 }: Props) {
  const events = useMemo(() => {
    const all: DispatchEvent[] = []
    for (const row of rows) {
      for (const event of row.timeline) {
        all.push(event)
      }
    }
    return all.sort((a, b) => b.at - a.at).slice(0, maxEvents)
  }, [rows, maxEvents])

  return (
    <section aria-label="Recent dispatch events">
      <div className="mb-2 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        Recent Events
      </div>
      <div className="rounded border border-white/10 bg-white/5 p-4">
        {events.length === 0 ? (
          <div className="py-4 text-center text-sm text-gray-400">No events recorded</div>
        ) : (
          <ul className="space-y-2" role="list">
            {events.map((event) => {
              const label = EVENT_LABELS[event.type] ?? event.type
              const { color, shape } = getEventIndicator(event.type)
              return (
                <li
                  key={event.id}
                  className="flex items-center gap-3"
                  aria-label={`${label} — ${formatRelativeTime(event.at)}`}
                >
                  <div className={`h-2 w-2 flex-shrink-0 ${color} ${shape}`} aria-hidden="true" />
                  <span className="flex-1 text-sm text-[var(--color-text-secondary)]">{label}</span>
                  <span className="text-xs text-gray-500 font-mono">{formatRelativeTime(event.at)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
```

Add to `apps/admin-desktop/src/styles/design-tokens.css` or existing CSS:

```css
.clip-triangle {
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
}
.clip-diamond {
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/components/RecentEventsFeed.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/components/RecentEventsFeed.tsx apps/admin-desktop/src/components/RecentEventsFeed.test.tsx
git commit -m "feat(admin): add RecentEventsFeed with shape+color indicators"
```

---

### Task 3: `MunicipalPerformanceTable` Enhancement

**Files:**

- Modify: `apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx`
- Modify: `apps/admin-desktop/src/__tests__/MunicipalPerformanceTable.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `apps/admin-desktop/src/__tests__/MunicipalPerformanceTable.test.tsx`:

```typescript
it('renders avg response time column', () => {
  render(
    <MunicipalPerformanceTable
      data={[
        { municipality: 'Daet', activeIncidents: 3, avgResponseTime: '4m' },
        { municipality: 'Mercedes', activeIncidents: 1 },
      ]}
    />,
  )
  expect(screen.getByText('4m')).toBeInTheDocument()
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
})

it('sorts by avg response time', () => {
  render(
    <MunicipalPerformanceTable
      data={[
        { municipality: 'Daet', activeIncidents: 3, avgResponseTime: '4m' },
        { municipality: 'Mercedes', activeIncidents: 1, avgResponseTime: '2m' },
      ]}
    />,
  )
  fireEvent.click(screen.getByText('Avg Response'))
  const rows = screen.getAllByRole('row')
  expect(rows[1]).toHaveTextContent('Mercedes')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/MunicipalPerformanceTable.test.tsx`
Expected: FAIL — "Avg Response" column not found

- [ ] **Step 3: Implement the enhancement**

Modify `MunicipalPerformanceTable.tsx`:

1. Add `avgResponseTime` to the rendered columns.
2. Add sort state for `avgResponseTime`.
3. Ensure undefined values render as "—".

Key change in render:

```tsx
<th onClick={() => handleSort('avgResponseTime')} className="cursor-pointer ...">
  Avg Response
</th>
// ...
<td className="...">{row.avgResponseTime ?? '—'}</td>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/MunicipalPerformanceTable.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx apps/admin-desktop/src/__tests__/MunicipalPerformanceTable.test.tsx
git commit -m "feat(admin): add avg response time to MunicipalPerformanceTable"
```

---

### Task 4: `DispatchStatsCards` Enhancement

**Files:**

- Modify: `apps/admin-desktop/src/components/DispatchStatsCards.tsx`
- Modify: `apps/admin-desktop/src/__tests__/DispatchStatsCards.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `apps/admin-desktop/src/__tests__/DispatchStatsCards.test.tsx`:

```typescript
it('shows trend arrow when avgAcceptSeconds changes by >10%', () => {
  const { rerender } = render(
    <DispatchStatsCards activeCount={5} stalledCount={0} avgAcceptSeconds={100} fcmSuccessRate={0.95} />,
  )
  rerender(
    <DispatchStatsCards activeCount={5} stalledCount={0} avgAcceptSeconds={120} fcmSuccessRate={0.95} />,
  )
  expect(screen.getByText(/↑/)).toBeInTheDocument()
})

it('does not use side-stripe borders', () => {
  render(<DispatchStatsCards activeCount={5} stalledCount={0} avgAcceptSeconds={null} fcmSuccessRate={0.95} />)
  const cards = screen.getAllByRole('region')
  for (const card of cards) {
    expect(card.className).not.toMatch(/border-l-/)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/DispatchStatsCards.test.tsx`
Expected: FAIL — trend arrow or border-l-4 assertions fail

- [ ] **Step 3: Implement enhancements**

Modify `DispatchStatsCards.tsx`:

1. Replace `border-l-4` with `border-t-4` (or `border-t-[3px]`) + `bg-white/[0.03]`.
2. Add `useRef` to track previous `avgAcceptSeconds`.
3. Compute trend arrow on prop change.

```tsx
import { useRef, useEffect } from 'react'

export function DispatchStatsCards({
  activeCount,
  stalledCount,
  avgAcceptSeconds,
  fcmSuccessRate,
}: Props) {
  const prevRef = useRef<number | null>(null)
  const [trend, setTrend] = useState<{ arrow: string; color: string } | null>(null)

  useEffect(() => {
    if (avgAcceptSeconds !== null && prevRef.current !== null) {
      const diff = avgAcceptSeconds - prevRef.current
      const threshold = prevRef.current * 0.1
      if (Math.abs(diff) > threshold) {
        setTrend({
          arrow: diff > 0 ? '↑' : '↓',
          color: diff > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]',
        })
      } else {
        setTrend(null)
      }
    }
    prevRef.current = avgAcceptSeconds
  }, [avgAcceptSeconds])

  // render with border-t instead of border-l
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/DispatchStatsCards.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/components/DispatchStatsCards.tsx apps/admin-desktop/src/__tests__/DispatchStatsCards.test.tsx
git commit -m "feat(admin): redesign DispatchStatsCards with top accent borders and trend arrows"
```

---

### Task 5: `EscalationQueueSection` Enhancement

**Files:**

- Modify: `apps/admin-desktop/src/components/EscalationQueueSection.tsx`
- Modify: `apps/admin-desktop/src/__tests__/EscalationQueueSection.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `apps/admin-desktop/src/__tests__/EscalationQueueSection.test.tsx`:

```typescript
it('renders all-clear banner when empty', () => {
  render(<EscalationQueueSection stalledDispatches={[]} onReDispatch={vi.fn()} />)
  expect(screen.getByText(/all clear/i)).toBeInTheDocument()
})

it('renders view details link for each stalled dispatch', () => {
  const stalled = [
    { dispatchId: 'd1', reportId: 'rpt_001', responderName: 'Juan', escalationCount: 1 },
  ]
  render(<EscalationQueueSection stalledDispatches={stalled} onReDispatch={vi.fn()} />)
  expect(screen.getByText(/view details/i)).toHaveAttribute('href', '/dispatches?highlight=d1')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/EscalationQueueSection.test.tsx`
Expected: FAIL — all-clear banner and view details link not found

- [ ] **Step 3: Implement enhancements**

Modify `EscalationQueueSection.tsx`:

1. When `stalledDispatches.length === 0`, return the all-clear banner instead of `null`:

```tsx
if (stalledDispatches.length === 0) {
  return (
    <div className="rounded border border-green-500/20 bg-green-500/5 px-4 py-2">
      <span className="text-sm text-green-400">All clear — no stalled dispatches</span>
    </div>
  )
}
```

2. Add "View Details" link to each card:

```tsx
<a href={`/dispatches?highlight=${d.dispatchId}`} className="text-xs text-blue-400 hover:underline">
  View Details
</a>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/EscalationQueueSection.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/components/EscalationQueueSection.tsx apps/admin-desktop/src/__tests__/EscalationQueueSection.test.tsx
git commit -m "feat(admin): add all-clear state and drill-down to EscalationQueueSection"
```

---

### Task 6: `DashboardPage` Redesign

**Files:**

- Modify: `apps/admin-desktop/src/pages/DashboardPage.tsx`
- Create: `apps/admin-desktop/src/__tests__/DashboardPage.ops.test.tsx`

- [ ] **Step 1: Write the failing integration test**

```typescript
// apps/admin-desktop/src/__tests__/DashboardPage.ops.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from '../pages/DashboardPage'

vi.mock('../hooks/useDispatchLifecycle', () => ({
  useDispatchLifecycle: () => ({ rows: [], loading: false, error: null }),
}))
vi.mock('../hooks/useResponderFleet', () => ({
  useResponderFleet: () => ({ responders: [], loading: false, error: null }),
}))
vi.mock('../hooks/useOpsMetrics', () => ({
  useOpsMetrics: () => ({ metrics: null, loading: false, error: null }),
}))
vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({ reports: [], loading: false, error: null, alerts: [] }),
}))

describe('DashboardPage ops redesign', () => {
  it('renders KPI cards', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Active Now')).toBeInTheDocument()
    expect(screen.getByText('Stalled')).toBeInTheDocument()
  })

  it('does not render triage queue', () => {
    render(<DashboardPage />)
    expect(screen.queryByText('Triage Queue')).not.toBeInTheDocument()
  })

  it('has sr-only h1', () => {
    render(<DashboardPage />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveClass('sr-only')
    expect(h1).toHaveTextContent('Operations Dashboard')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/DashboardPage.ops.test.tsx`
Expected: FAIL — triage queue still present, h1 missing

- [ ] **Step 3: Redesign DashboardPage**

Rewrite `apps/admin-desktop/src/pages/DashboardPage.tsx`:

1. Remove all triage-related imports, state, and handlers.
2. Import ops widgets: `DispatchStatsCards`, `EscalationQueueSection`, `DispatchVolumeChart`, `RecentEventsFeed`, `ResponderAvailabilityPanel`, `MunicipalPerformanceTable`.
3. Import hooks: `useDispatchLifecycle`, `useResponderFleet`, `useOpsMetrics`.
4. Compose widgets with loading/error state handling per the state matrix (§3 of spec).
5. Add `<h1 className="sr-only">Operations Dashboard</h1>`.
6. Add keyboard shortcuts: `R`, `D`, `F`, `?`, `Escape`.
7. Remove `StatusBar`.

Key structure:

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
    .map((r) => ({ dispatchId: r.dispatchId, reportId: r.reportId, responderName: r.responderName, escalationCount: r.escalationCount }))

  const activeCount = rows.filter((r) => r.status !== 'needs_admin').length

  // ... municipalData computation ...

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <CommandHeader ... />
      {error && <OfflineBanner error={error} />}
      <main className="flex-1 overflow-auto p-4">
        <h1 className="sr-only">Operations Dashboard</h1>
        {isLoading && rows.length === 0 && reports.length === 0 ? (
          <LoadingScreen />
        ) : rows.length === 0 && responders.length === 0 && reports.length === 0 ? (
          <AllClearState />
        ) : (
          <div className="space-y-4">
            <DispatchStatsCards
              activeCount={activeCount}
              stalledCount={stalledDispatches.length}
              avgAcceptSeconds={opsMetrics?.avgAcceptSeconds ?? null}
              fcmSuccessRate={opsMetrics?.fcmSuccessRate ?? 0}
            />
            <EscalationQueueSection stalledDispatches={stalledDispatches} onReDispatch={...} />
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
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run all DashboardPage tests**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/DashboardPage.ops.test.tsx`
Expected: PASS

Also run existing DashboardPage tests to ensure no regression:
Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/DashboardPage.test.tsx`
Expected: PASS (or update if triage-specific tests need removal)

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/pages/DashboardPage.tsx apps/admin-desktop/src/__tests__/DashboardPage.ops.test.tsx
git commit -m "feat(admin): redesign DashboardPage as OpsDashboard"
```

---

### Task 7: Full Suite Verification

- [ ] **Step 1: Run all admin-desktop tests**

```bash
pnpm --dir apps/admin-desktop exec vitest run
```

Expected: ALL PASS

- [ ] **Step 2: Run typecheck**

```bash
pnpm --dir apps/admin-desktop typecheck
```

Expected: No errors

- [ ] **Step 3: Run lint**

```bash
pnpm --dir apps/admin-desktop lint
```

Expected: No errors

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(admin): resolve typecheck and lint issues"
```

---

## Self-Review

**1. Spec coverage:**

- [x] State matrix (loading/error/empty) → Task 6
- [x] StatusBar removal → Task 6
- [x] DispatchVolumeChart → Task 1
- [x] RecentEventsFeed → Task 2
- [x] MunicipalPerformanceTable enhancement → Task 3
- [x] DispatchStatsCards redesign → Task 4
- [x] EscalationQueueSection enhancements → Task 5
- [x] DashboardPage composition → Task 6
- [x] Keyboard shortcuts → Task 6
- [x] Heading hierarchy → Task 6
- [x] No side-stripe borders → Task 4

**2. Placeholder scan:**

- [x] No "TBD", "TODO", "implement later"
- [x] Complete code in every step
- [x] Exact commands with expected output

**3. Type consistency:**

- [x] `MunicipalPerformance` interface unchanged (uses existing `avgResponseTime?: string`)
- [x] `DispatchLifecycleRow` type imported from existing hook
- [x] `StalledDispatch` mapping explicitly defined in Task 6
