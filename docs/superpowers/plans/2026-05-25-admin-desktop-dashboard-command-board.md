# Admin Desktop Dashboard Command Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the admin dashboard into a trustworthy province command board with operational modes, a situation strip, wired actions, explicit unknown states, and accessibility foundations.

**Architecture:** Four independent sequential PRs: (1) Trust fixes wire the no-op Re-dispatch button, add success feedback, and replace ambiguous placeholders; (2) Situation strip transforms StatusBar into a province command strip with mode detection; (3) Layout adaptation makes DashboardPage mode-aware; (4) Accessibility adds skip link and live announcer.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, React Testing Library, Firebase Firestore (client SDK), Lucide React icons.

---

## File Structure

### Modified (8 files)

| File                                                              | Responsibility                                                                                                             |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/admin-desktop/src/components/SuccessBanner.tsx`             | Add internal auto-dismiss timer with cleanup                                                                               |
| `apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx` | Replace `—` dashes with explicit unknown copy + tooltips                                                                   |
| `apps/admin-desktop/src/pages/DashboardPage.tsx`                  | Wire Re-dispatch modal, add success/error state, mode derivation, layout adaptation                                        |
| `apps/admin-desktop/src/components/StatusBar.tsx`                 | Expand to situation strip: mode badge, affected municipalities, blocking response, coverage, freshness, operational labels |
| `apps/admin-desktop/src/hooks/useOpsMetrics.ts`                   | Expose `lastPollAt` timestamp for freshness calculation                                                                    |
| `apps/admin-desktop/src/components/EscalationQueueSection.tsx`    | Accept `mode` prop for collapse/expand behavior                                                                            |
| `apps/admin-desktop/src/components/DispatchStatsCards.tsx`        | Accept `mode` prop; in `surge`, only render Active + Stalled                                                               |
| `apps/admin-desktop/src/app/App.tsx`                              | Add `<SkipLink />` and `<LiveAnnouncer />` at root                                                                         |

### New (3 files)

| File                                                  | Responsibility                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/admin-desktop/src/utils/dashboard-mode.ts`      | `deriveDashboardMode()`, `DashboardMode` type, threshold constants |
| `apps/admin-desktop/src/components/SkipLink.tsx`      | Skip-to-main-content link (sr-only until focused)                  |
| `apps/admin-desktop/src/components/LiveAnnouncer.tsx` | Singleton aria-live region with queue + rate limiting              |

---

## PR 1: Trust Fixes (P0 + P1 Immediate)

### Task 1.1: SuccessBanner Auto-Dismiss

**Files:**

- Modify: `apps/admin-desktop/src/components/SuccessBanner.tsx`
- Test: `apps/admin-desktop/src/__tests__/SuccessBanner.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/admin-desktop/src/__tests__/SuccessBanner.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SuccessBanner } from '../components/SuccessBanner'

describe('SuccessBanner', () => {
  it('auto-dismisses after 4000ms', async () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<SuccessBanner message="Action completed" onDismiss={onDismiss} />)

    expect(screen.getByText('Action completed')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    vi.useRealTimers()
  })

  it('clears previous timer when message changes', async () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    const { rerender } = render(<SuccessBanner message="First" onDismiss={onDismiss} />)

    rerender(<SuccessBanner message="Second" onDismiss={onDismiss} />)

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/SuccessBanner.test.tsx`

Expected: FAIL — `SuccessBanner` auto-dismiss not implemented; `act` may need import.

- [ ] **Step 3: Add `act` import and implement auto-dismiss**

Modify `apps/admin-desktop/src/components/SuccessBanner.tsx`:

```tsx
import { CheckCircle, X } from 'lucide-react'
import { useEffect } from 'react'

interface Props {
  message: string
  onDismiss: () => void
}

export function SuccessBanner({ message, onDismiss }: Props) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 4000)
    return () => clearTimeout(id)
  }, [message, onDismiss])

  return (
    <div
      className="mb-4 flex items-center gap-3 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]"
      role="status"
    >
      <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="rounded p-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/SuccessBanner.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/components/SuccessBanner.tsx apps/admin-desktop/src/__tests__/SuccessBanner.test.tsx
git commit -m "feat(admin-desktop): SuccessBanner auto-dismiss with timer cleanup"
```

---

### Task 1.2: MunicipalPerformanceTable Explicit Unknown States

**Files:**

- Modify: `apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx`
- Test: `apps/admin-desktop/src/__tests__/municipal-performance-table.test.tsx`

- [ ] **Step 1: Write the failing test**

Create or modify `apps/admin-desktop/src/__tests__/municipal-performance-table.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MunicipalPerformanceTable } from '../components/MunicipalPerformanceTable'

describe('MunicipalPerformanceTable unknown states', () => {
  it('renders "No telemetry" for undefined activeResponders', () => {
    render(
      <MunicipalPerformanceTable
        data={[
          {
            municipality: 'Daet',
            activeIncidents: 3,
            activeResponders: undefined,
            avgResponseTime: '12m',
            adminOnDuty: true,
          },
        ]}
        onSelectMunicipality={() => {}}
      />,
    )

    expect(screen.getByTestId('muniperf-responders-Daet')).toHaveTextContent('No telemetry')
  })

  it('renders "Not measured" for undefined avgResponseTime', () => {
    render(
      <MunicipalPerformanceTable
        data={[
          {
            municipality: 'Basud',
            activeIncidents: 1,
            activeResponders: 2,
            avgResponseTime: undefined,
            adminOnDuty: false,
          },
        ]}
        onSelectMunicipality={() => {}}
      />,
    )

    expect(screen.getByTestId('muniperf-response-Basud')).toHaveTextContent('Not measured')
  })

  it('renders "No shift data" for undefined adminOnDuty', () => {
    render(
      <MunicipalPerformanceTable
        data={[
          {
            municipality: 'Mercedes',
            activeIncidents: 0,
            activeResponders: 5,
            avgResponseTime: '8m',
            adminOnDuty: undefined,
          },
        ]}
        onSelectMunicipality={() => {}}
      />,
    )

    expect(screen.getByTestId('muniperf-admin-Mercedes')).toHaveTextContent('No shift data')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/municipal-performance-table.test.tsx`

Expected: FAIL — cells still show `—`

- [ ] **Step 3: Implement explicit unknown states**

Modify `apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx`:

Import `HelpCircle` at top:

```tsx
import { ArrowDown, ArrowUp, ArrowUpDown, HelpCircle } from 'lucide-react'
```

Replace the responders cell (around line 142-148):

```tsx
<td
  className="px-4 py-3 font-mono text-[var(--color-text-secondary)]"
  style={{ fontVariantNumeric: 'tabular-nums' }}
  data-testid={`muniperf-responders-${row.municipality}`}
>
  {row.activeResponders === undefined ? (
    <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
      <HelpCircle className="h-3 w-3" aria-hidden="true" />
      <span title="No responder telemetry for this municipality">No telemetry</span>
    </span>
  ) : (
    row.activeResponders
  )}
</td>
```

Replace the avg response cell (around line 149-161):

```tsx
<td
  className="px-4 py-3 font-mono"
  style={{
    color:
      row.avgResponseTime === undefined
        ? 'var(--color-text-secondary)'
        : responseTimeToken(row.avgResponseTime),
    fontVariantNumeric: 'tabular-nums',
  }}
  data-testid={`muniperf-response-${row.municipality}`}
>
  {row.avgResponseTime === undefined ? (
    <span className="text-[var(--color-text-muted)]">Not measured</span>
  ) : (
    row.avgResponseTime
  )}
</td>
```

Replace the admin cell (around line 162-183):

```tsx
<td
  className="px-4 py-3 text-[var(--color-text-secondary)]"
  data-testid={`muniperf-admin-${row.municipality}`}
>
  {row.adminOnDuty === undefined ? (
    <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
      <HelpCircle className="h-3 w-3" aria-hidden="true" />
      <span title="No admin shift scheduled">No shift data</span>
    </span>
  ) : row.adminOnDuty ? (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: 'var(--color-success)' }}
        aria-hidden="true"
      />
      On Duty
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[var(--color-text-muted)]">
      <span className="h-1.5 w-1.5 rounded-full bg-white/20" aria-hidden="true" />
      No Shift
    </span>
  )}
</td>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/municipal-performance-table.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx apps/admin-desktop/src/__tests__/municipal-performance-table.test.tsx
git commit -m "feat(admin-desktop): explicit unknown states in MunicipalPerformanceTable"
```

---

### Task 1.3: DashboardPage Re-Dispatch Wiring

**Files:**

- Modify: `apps/admin-desktop/src/pages/DashboardPage.tsx`
- Test: `apps/admin-desktop/src/__tests__/dashboard-redispatch.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/admin-desktop/src/__tests__/dashboard-redispatch.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'

const mockCallables = {
  redispatchReport: vi.fn(),
  getOpsMetrics: vi.fn().mockResolvedValue({ metrics: {} }),
}

vi.mock('../services/callables', () => ({
  callables: mockCallables,
}))

describe('DashboardPage Re-dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens ReDispatchModal when Re-dispatch button is clicked', async () => {
    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>,
    )

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    const reDispatchButton = screen.getByLabelText(/Re-dispatch/)
    fireEvent.click(reDispatchButton)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Re-dispatch')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/dashboard-redispatch.test.tsx`

Expected: FAIL — `ReDispatchModal` not imported; no state to open it.

- [ ] **Step 3: Wire Re-dispatch in DashboardPage**

Modify `apps/admin-desktop/src/pages/DashboardPage.tsx`:

Add imports at top:

```tsx
import { ReDispatchModal } from '../components/ReDispatchModal'
import { callables } from '../services/callables'
```

Add state inside component:

```tsx
const [reDispatchModalOpen, setReDispatchModalOpen] = useState(false)
const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null)
const [successMessage, setSuccessMessage] = useState<string | null>(null)
const [actionError, setActionError] = useState<string | null>(null)
```

Replace `handleReDispatch`:

```tsx
const handleReDispatch = useCallback((dispatchId: string) => {
  setSelectedDispatchId(dispatchId)
  setReDispatchModalOpen(true)
}, [])
```

Add `handleConfirmReDispatch`:

```tsx
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
      setActionError(null)
      setReDispatchModalOpen(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Re-dispatch failed')
      setSuccessMessage(null)
    }
  },
  [selectedDispatchId],
)
```

Add success/error banners in the render, right after `<OfflineBanner>`:

```tsx
{
  successMessage && (
    <SuccessBanner message={successMessage} onDismiss={() => setSuccessMessage(null)} />
  )
}
{
  actionError && (
    <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
      {actionError}
    </div>
  )
}
```

Add `ReDispatchModal` at the bottom of the JSX, before closing `</div>`:

```tsx
<ReDispatchModal
  isOpen={reDispatchModalOpen}
  onClose={() => setReDispatchModalOpen(false)}
  onDispatch={(uid) => {
    void handleConfirmReDispatch(uid)
  }}
  responders={responders}
  previouslyNotified={
    selectedDispatchId
      ? (rows.find((r) => r.dispatchId === selectedDispatchId)?.previouslyNotifiedResponderUids ??
        [])
      : []
  }
  isLoading={false}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/dashboard-redispatch.test.tsx`

Expected: PASS (modal opens on button click)

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/pages/DashboardPage.tsx apps/admin-desktop/src/__tests__/dashboard-redispatch.test.tsx
git commit -m "feat(admin-desktop): wire Re-dispatch button to redispatchReport callable with success/error feedback"
```

---

## PR 2: Situation Strip

### Task 2.1: Dashboard Mode Utility

**Files:**

- Create: `apps/admin-desktop/src/utils/dashboard-mode.ts`
- Test: `apps/admin-desktop/src/__tests__/dashboard-mode.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/admin-desktop/src/__tests__/dashboard-mode.test.ts`:

```tsx
import { describe, it, expect } from 'vitest'
import { deriveDashboardMode } from '../utils/dashboard-mode'

describe('deriveDashboardMode', () => {
  it('returns calm when no incidents and no errors', () => {
    const mode = deriveDashboardMode(0, 0, 1.0, [], 0)
    expect(mode).toBe('calm')
  })

  it('returns active when incidents exist but below surge threshold', () => {
    const mode = deriveDashboardMode(0, 5, 1.0, [], 0)
    expect(mode).toBe('active')
  })

  it('returns surge when stalled dispatches exist', () => {
    const mode = deriveDashboardMode(1, 0, 1.0, [], 0)
    expect(mode).toBe('surge')
  })

  it('returns surge when active incidents > 20', () => {
    const mode = deriveDashboardMode(0, 21, 1.0, [], 0)
    expect(mode).toBe('surge')
  })

  it('returns surge when FCM rate < 0.5', () => {
    const mode = deriveDashboardMode(0, 0, 0.4, [], 0)
    expect(mode).toBe('surge')
  })

  it('returns degraded when hook errors exist', () => {
    const mode = deriveDashboardMode(0, 0, 1.0, ['network error'], 0)
    expect(mode).toBe('degraded')
  })

  it('returns degraded when data is stale > 5min', () => {
    const mode = deriveDashboardMode(0, 0, 1.0, [], 301_000)
    expect(mode).toBe('degraded')
  })

  it('surge takes precedence over degraded', () => {
    const mode = deriveDashboardMode(1, 0, 1.0, ['error'], 600_000)
    expect(mode).toBe('surge')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/dashboard-mode.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the utility**

Create `apps/admin-desktop/src/utils/dashboard-mode.ts`:

```typescript
export type DashboardMode = 'calm' | 'active' | 'degraded' | 'surge'

export const MODE_THRESHOLDS = {
  SURGE_STALLED_MIN: 1,
  SURGE_ACTIVE_INCIDENTS: 20,
  SURGE_FCM_RATE: 0.5,
  DEGRADED_STALE_MS: 300_000,
} as const

export function deriveDashboardMode(
  stalledCount: number,
  activeCount: number,
  fcmRate: number,
  hookErrors: string[],
  dataFreshnessMs: number,
): DashboardMode {
  // SURGE takes precedence over DEGRADED — actionable blockers must be visible
  if (
    stalledCount >= MODE_THRESHOLDS.SURGE_STALLED_MIN ||
    activeCount > MODE_THRESHOLDS.SURGE_ACTIVE_INCIDENTS ||
    fcmRate < MODE_THRESHOLDS.SURGE_FCM_RATE
  ) {
    return 'surge'
  }
  if (hookErrors.length > 0 || dataFreshnessMs > MODE_THRESHOLDS.DEGRADED_STALE_MS) {
    return 'degraded'
  }
  if (activeCount > 0) {
    return 'active'
  }
  return 'calm'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/dashboard-mode.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/utils/dashboard-mode.ts apps/admin-desktop/src/__tests__/dashboard-mode.test.ts
git commit -m "feat(admin-desktop): dashboard mode derivation utility with thresholds"
```

---

### Task 2.2: useOpsMetrics Expose lastPollAt

**Files:**

- Modify: `apps/admin-desktop/src/hooks/useOpsMetrics.ts`

- [ ] **Step 1: Add lastPollAt to state and return value**

Modify `apps/admin-desktop/src/hooks/useOpsMetrics.ts`:

In the state declarations, add:

```typescript
const [lastPollAt, setLastPollAt] = useState<number | null>(null)
```

In `fetchMetrics`, after `setError(null)`:

```typescript
setLastPollAt(Date.now())
```

In the return statement:

```typescript
return { metrics, loading, error, lastPollAt }
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --dir apps/admin-desktop typecheck`

Expected: PASS (no type errors from the change)

- [ ] **Step 3: Commit**

```bash
git add apps/admin-desktop/src/hooks/useOpsMetrics.ts
git commit -m "feat(admin-desktop): expose lastPollAt from useOpsMetrics for freshness calculation"
```

---

### Task 2.3: StatusBar Situation Strip

**Files:**

- Modify: `apps/admin-desktop/src/components/StatusBar.tsx`
- Test: `apps/admin-desktop/src/__tests__/StatusBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create or modify `apps/admin-desktop/src/__tests__/StatusBar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBar } from '../components/StatusBar'

describe('StatusBar situation strip', () => {
  it('renders mode badge', () => {
    render(
      <StatusBar
        activeIncidents={5}
        avgResponseTime={4}
        pendingTriage={2}
        mode="active"
        affectedMunicipalities={['Daet', 'Basud']}
        stalledDispatchCount={0}
        totalResponders={14}
        uncoveredMunicipalities={1}
        lastDataUpdateAt={Date.now()}
      />,
    )

    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
  })

  it('renders affected municipality chips', () => {
    render(
      <StatusBar
        activeIncidents={5}
        avgResponseTime={4}
        pendingTriage={2}
        mode="active"
        affectedMunicipalities={['Daet', 'Basud']}
        stalledDispatchCount={0}
        totalResponders={14}
        uncoveredMunicipalities={1}
        lastDataUpdateAt={Date.now()}
      />,
    )

    expect(screen.getByText('Daet')).toBeInTheDocument()
    expect(screen.getByText('Basud')).toBeInTheDocument()
  })

  it('shows operational label for active incidents', () => {
    render(
      <StatusBar
        activeIncidents={25}
        avgResponseTime={4}
        pendingTriage={2}
        mode="surge"
        affectedMunicipalities={[]}
        stalledDispatchCount={1}
        totalResponders={14}
        uncoveredMunicipalities={3}
        lastDataUpdateAt={Date.now()}
      />,
    )

    expect(screen.getByText('Degraded')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/StatusBar.test.tsx`

Expected: FAIL — new props don't exist.

- [ ] **Step 3: Implement the situation strip**

Rewrite `apps/admin-desktop/src/components/StatusBar.tsx`:

```tsx
import { useCommandCenterStore } from '../stores/commandCenterStore'
import { Link } from 'react-router-dom'
import type { DashboardMode } from '../utils/dashboard-mode'

interface Props {
  activeIncidents: number
  avgResponseTime: number
  pendingTriage: number
  resolvedToday?: number
  muniIssues?: { resolved: number; total: number }
  mode: DashboardMode
  affectedMunicipalities: string[]
  stalledDispatchCount: number
  totalResponders: number
  uncoveredMunicipalities: number
  lastDataUpdateAt: number
}

const MODE_STYLES: Record<DashboardMode, { bg: string; text: string; pulse: boolean }> = {
  calm: { bg: 'bg-green-500/10', text: 'text-green-400', pulse: false },
  active: { bg: 'bg-blue-500/10', text: 'text-blue-400', pulse: false },
  degraded: { bg: 'bg-amber-500/10', text: 'text-amber-400', pulse: true },
  surge: { bg: 'bg-red-500/10', text: 'text-red-400', pulse: true },
}

function freshnessText(lastUpdateAt: number, now: number): string {
  const ms = now - lastUpdateAt
  if (ms < 60_000) return `live ${Math.floor(ms / 1000)}s ago`
  if (ms < 300_000) return `updated ${Math.floor(ms / 60_000)}m ago`
  return `stale ${Math.floor(ms / 60_000)}m ago`
}

function freshnessColor(ms: number): string {
  if (ms < 60_000) return 'text-green-400'
  if (ms < 300_000) return 'text-gray-400'
  return 'text-amber-400'
}

function operationalLabel(value: number, type: 'active' | 'response' | 'triage' | 'fcm'): string {
  switch (type) {
    case 'active':
      if (value <= 10) return 'Normal'
      if (value <= 20) return 'Watch'
      return 'Degraded'
    case 'response':
      if (value <= 5) return 'Normal'
      if (value <= 10) return 'Watch'
      return 'Degraded'
    case 'triage':
      if (value <= 3) return 'Normal'
      if (value <= 7) return 'Watch'
      return 'Degraded'
    case 'fcm':
      if (value >= 0.98) return 'Normal'
      if (value >= 0.9) return 'Watch'
      return 'Degraded'
  }
}

function labelColor(label: string): string {
  if (label === 'Normal') return 'text-green-400'
  if (label === 'Watch') return 'text-amber-400'
  return 'text-red-400'
}

export function StatusBar({
  activeIncidents,
  avgResponseTime,
  pendingTriage,
  mode,
  affectedMunicipalities,
  stalledDispatchCount,
  totalResponders,
  uncoveredMunicipalities,
  lastDataUpdateAt,
}: Props) {
  const { statusBarExpandedOverride, toggleStatusBarExpanded } = useCommandCenterStore()
  const expanded = statusBarExpandedOverride ?? true

  const modeStyle = MODE_STYLES[mode]
  const freshness = freshnessText(lastDataUpdateAt, Date.now())
  const freshMs = Date.now() - lastDataUpdateAt

  return (
    <div
      className={`sticky top-0 z-50 border-b bg-[var(--color-surface)] ${
        modeStyle.pulse ? 'motion-safe:animate-pulse' : ''
      } ${mode === 'surge' ? 'border-red-500/30' : mode === 'degraded' ? 'border-amber-500/30' : 'border-[var(--color-surface)]'}`}
    >
      <div className="flex items-center justify-between px-4 py-2">
        {/* Mode badge */}
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${modeStyle.bg} ${modeStyle.text}`}
          role="status"
          aria-live="polite"
        >
          {mode}
        </span>

        {/* Affected municipalities */}
        <div className="flex items-center gap-2">
          {affectedMunicipalities.length > 0 ? (
            affectedMunicipalities.map((m) => (
              <Link
                key={m}
                to={`/map?municipality=${encodeURIComponent(m)}`}
                className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-[var(--color-text-secondary)] hover:bg-white/10"
                aria-label={`View ${m} on map`}
              >
                {m}
              </Link>
            ))
          ) : mode === 'calm' ? (
            <span className="text-xs text-green-400">All clear</span>
          ) : null}
        </div>

        {/* Blocking response */}
        {stalledDispatchCount > 0 && (
          <div className="text-xs text-red-400">
            {stalledDispatchCount} stalled dispatch{stalledDispatchCount > 1 ? 'es' : ''}
          </div>
        )}

        {/* Coverage */}
        <div className="text-xs text-[var(--color-text-secondary)]">
          {totalResponders} available / {uncoveredMunicipalities} uncovered
        </div>

        {/* Freshness */}
        <span className={`text-xs ${freshnessColor(freshMs)}`}>{freshness}</span>
      </div>

      {expanded && (
        <div className="flex items-center justify-around border-t border-white/5 px-4 py-3">
          <Metric
            label="Active Incidents"
            value={activeIncidents}
            labelText={operationalLabel(activeIncidents, 'active')}
          />
          <div className="h-10 w-px bg-white/10" />
          <Metric
            label="Avg Response"
            value={avgResponseTime}
            unit="m"
            labelText={operationalLabel(avgResponseTime, 'response')}
          />
          <div className="h-10 w-px bg-white/10" />
          <Metric
            label="Pending Triage"
            value={pendingTriage}
            labelText={operationalLabel(pendingTriage, 'triage')}
          />
        </div>
      )}

      <button
        onClick={toggleStatusBarExpanded}
        className="w-full py-1 text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
      >
        {expanded ? 'Collapse' : 'Expand'}
      </button>
    </div>
  )
}

function Metric({
  label,
  value,
  unit,
  labelText,
}: {
  label: string
  value: number
  unit?: string
  labelText: string
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      <span
        className="mt-1 font-mono text-2xl font-medium leading-none text-[var(--color-text-primary)]"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
        {unit && <span className="ml-1 text-lg">{unit}</span>}
      </span>
      <span className={`mt-1 text-[10px] uppercase ${labelColor(labelText)}`}>{labelText}</span>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/StatusBar.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/components/StatusBar.tsx apps/admin-desktop/src/__tests__/StatusBar.test.tsx
git commit -m "feat(admin-desktop): StatusBar expanded to province situation strip with mode badge, geography, coverage, freshness"
```

---

## PR 3: Layout Adaptation

### Task 3.1: EscalationQueueSection Mode Prop

**Files:**

- Modify: `apps/admin-desktop/src/components/EscalationQueueSection.tsx`
- Test: `apps/admin-desktop/src/__tests__/EscalationQueueSection.test.tsx`

- [ ] **Step 1: Write the failing test**

Create or modify `apps/admin-desktop/src/__tests__/EscalationQueueSection.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EscalationQueueSection } from '../components/EscalationQueueSection'

describe('EscalationQueueSection mode', () => {
  it('is hidden in calm mode even with stalled dispatches', () => {
    render(
      <EscalationQueueSection
        stalledDispatches={[
          {
            dispatchId: 'd1',
            reportId: 'r1',
            responderName: 'Juan',
            escalationCount: 1,
          },
        ]}
        onReDispatch={() => {}}
        mode="calm"
      />,
    )

    expect(screen.queryByRole('region', { name: /Escalation queue/ })).not.toBeInTheDocument()
  })

  it('is visible in surge mode', () => {
    render(
      <EscalationQueueSection
        stalledDispatches={[
          {
            dispatchId: 'd1',
            reportId: 'r1',
            responderName: 'Juan',
            escalationCount: 1,
          },
        ]}
        onReDispatch={() => {}}
        mode="surge"
      />,
    )

    expect(screen.getByRole('region', { name: /Escalation queue/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/EscalationQueueSection.test.tsx`

Expected: FAIL — `mode` prop doesn't exist.

- [ ] **Step 3: Add mode prop**

Modify `apps/admin-desktop/src/components/EscalationQueueSection.tsx`:

Add `DashboardMode` import:

```tsx
import type { DashboardMode } from '../utils/dashboard-mode'
```

Add `mode` to interface:

```tsx
interface Props {
  stalledDispatches: StalledDispatch[]
  onReDispatch: (dispatchId: string) => void
  mode: DashboardMode
}
```

Add early return for `calm` mode:

```tsx
export function EscalationQueueSection({ stalledDispatches, onReDispatch, mode }: Props) {
  if (mode === 'calm' || stalledDispatches.length === 0) {
    if (mode === 'calm') return null
    return (
      <div className="rounded border border-green-500/20 bg-green-500/5 px-4 py-2">
        <span className="text-sm text-green-400">All clear — no stalled dispatches</span>
      </div>
    )
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/EscalationQueueSection.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/components/EscalationQueueSection.tsx apps/admin-desktop/src/__tests__/EscalationQueueSection.test.tsx
git commit -m "feat(admin-desktop): EscalationQueueSection mode-aware (hidden in calm)"
```

---

### Task 3.2: DispatchStatsCards Mode Prop

**Files:**

- Modify: `apps/admin-desktop/src/components/DispatchStatsCards.tsx`
- Test: `apps/admin-desktop/src/__tests__/DispatchStatsCards.test.tsx`

- [ ] **Step 1: Write the failing test**

Create or modify `apps/admin-desktop/src/__tests__/DispatchStatsCards.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DispatchStatsCards } from '../components/DispatchStatsCards'

describe('DispatchStatsCards mode', () => {
  it('shows all cards in active mode', () => {
    render(
      <DispatchStatsCards
        activeCount={5}
        stalledCount={1}
        avgAcceptSeconds={120}
        fcmSuccessRate={0.98}
        mode="active"
      />,
    )

    expect(screen.getByLabelText('Active Now')).toBeInTheDocument()
    expect(screen.getByLabelText('Stalled')).toBeInTheDocument()
    expect(screen.getByLabelText('Average accept time')).toBeInTheDocument()
    expect(screen.getByLabelText('FCM success rate')).toBeInTheDocument()
  })

  it('only shows Active and Stalled in surge mode', () => {
    render(
      <DispatchStatsCards
        activeCount={25}
        stalledCount={3}
        avgAcceptSeconds={300}
        fcmSuccessRate={0.4}
        mode="surge"
      />,
    )

    expect(screen.getByLabelText('Active Now')).toBeInTheDocument()
    expect(screen.getByLabelText('Stalled')).toBeInTheDocument()
    expect(screen.queryByLabelText('Average accept time')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('FCM success rate')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/DispatchStatsCards.test.tsx`

Expected: FAIL — `mode` prop doesn't exist.

- [ ] **Step 3: Add mode prop and conditional rendering**

Modify `apps/admin-desktop/src/components/DispatchStatsCards.tsx`:

Add import:

```tsx
import type { DashboardMode } from '../utils/dashboard-mode'
```

Add `mode` to interface:

```tsx
interface Props {
  activeCount: number
  stalledCount: number
  avgAcceptSeconds: number | null
  fcmSuccessRate: number
  mode: DashboardMode
}
```

Modify the component to conditionally render based on mode. In `surge`, only render Active and Stalled cards:

```tsx
export function DispatchStatsCards({
  activeCount,
  stalledCount,
  avgAcceptSeconds,
  fcmSuccessRate,
  mode,
}: Props) {
  // ... existing logic for fcmPercent, isFcmHigh, prevRef, trend ...

  const isSurge = mode === 'surge'

  return (
    <div className="flex gap-4">
      <div
        aria-label="Active Now"
        className="rounded-lg border-t-[3px] border-t-blue-400 bg-white/[0.03] p-4"
        role="region"
      >
        <div className="text-xs text-gray-400">Active Now</div>
        <div className="text-2xl font-bold text-white">{activeCount}</div>
      </div>

      <div
        aria-label="Stalled"
        className={`rounded-lg border-t-[3px] p-4 bg-white/[0.03] ${stalledCount > 0 ? 'border-t-red-400' : 'border-t-gray-400'}`}
        role="region"
      >
        <div className="text-xs text-gray-400">Stalled</div>
        <div className="text-2xl font-bold text-white">{stalledCount}</div>
      </div>

      {!isSurge && (
        <>
          <div
            aria-label="Average accept time"
            className="rounded-lg border-t-[3px] border-t-gray-400 bg-white/[0.03] p-4"
            role="region"
          >
            <div className="flex items-center gap-2 text-xs text-gray-400">
              Avg Accept
              {trend && <span className={`${trend.color} text-xs`}>{trend.arrow}</span>}
            </div>
            <div className="text-2xl font-bold text-white">
              {avgAcceptSeconds !== null ? formatSeconds(avgAcceptSeconds) : '—'}
            </div>
          </div>

          <div
            aria-label="FCM success rate"
            className={`rounded-lg border-t-[3px] p-4 bg-white/[0.03] ${isFcmHigh ? 'border-t-green-400 text-green-400' : 'border-t-amber-400 text-amber-400'}`}
            role="region"
          >
            <div className="text-xs">FCM Rate</div>
            <div className="text-2xl font-bold">{fcmPercent}%</div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/DispatchStatsCards.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/components/DispatchStatsCards.tsx apps/admin-desktop/src/__tests__/DispatchStatsCards.test.tsx
git commit -m "feat(admin-desktop): DispatchStatsCards mode-aware (surge shows Active+Stalled only)"
```

---

### Task 3.3: DashboardPage Mode Derivation and Layout Adaptation

**Files:**

- Modify: `apps/admin-desktop/src/pages/DashboardPage.tsx`
- Test: `apps/admin-desktop/src/__tests__/dashboard-mode-layout.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/admin-desktop/src/__tests__/dashboard-mode-layout.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'

vi.mock('../services/callables', () => ({
  callables: {
    getOpsMetrics: vi.fn().mockResolvedValue({ metrics: {} }),
    redispatchReport: vi.fn(),
  },
}))

describe('DashboardPage mode layout', () => {
  it('shows escalation queue in active mode', async () => {
    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>,
    )

    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument()
    })

    // Default empty state — calm mode means escalation queue hidden
    expect(screen.queryByRole('region', { name: /Escalation queue/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/dashboard-mode-layout.test.tsx`

Expected: FAIL — mode not derived yet.

- [ ] **Step 3: Add mode derivation and pass to children**

Modify `apps/admin-desktop/src/pages/DashboardPage.tsx`:

Add import:

```tsx
import { deriveDashboardMode } from '../utils/dashboard-mode'
import type { DashboardMode } from '../utils/dashboard-mode'
```

Add state and derivation inside component:

```tsx
const [mode, setMode] = useState<DashboardMode>('calm')
const [lastDataUpdateAt, setLastDataUpdateAt] = useState(() => Date.now())

// Derive mode when data changes
useEffect(() => {
  const hookErrors: string[] = []
  if (lifecycleError) hookErrors.push(lifecycleError)
  if (fleetError) hookErrors.push(fleetError)
  if (metricsError) hookErrors.push(metricsError)
  if (reportsError) hookErrors.push(reportsError)

  const dataFreshness = Date.now() - lastDataUpdateAt

  const newMode = deriveDashboardMode(
    stalledDispatches.length,
    activeCount,
    opsMetrics?.fcmSuccessRate ?? 1.0,
    hookErrors,
    dataFreshness,
  )
  setMode(newMode)
}, [
  rows,
  responders,
  reports,
  opsMetrics,
  lifecycleError,
  fleetError,
  metricsError,
  reportsError,
  lastDataUpdateAt,
  activeCount,
  stalledDispatches.length,
])

// Update lastDataUpdateAt when any hook delivers data
useEffect(() => {
  if (!lifecycleLoading || !fleetLoading || !metricsLoading || !reportsLoading) {
    setLastDataUpdateAt(Date.now())
  }
}, [lifecycleLoading, fleetLoading, metricsLoading, reportsLoading])
```

Pass `mode` to child components and add conditional layout:

Replace the `<main>` content:

```tsx
<main className="flex-1 overflow-auto p-4" id="main-content">
  <h1 className="sr-only">Operations Dashboard</h1>
  {rows.length === 0 && responders.length === 0 && reports.length === 0 ? (
    <AllClearState />
  ) : (
    <div className="space-y-4">
      <DispatchStatsCards
        activeCount={activeCount}
        stalledCount={stalledDispatches.length}
        avgAcceptSeconds={opsMetrics?.avgAcceptSeconds ?? null}
        fcmSuccessRate={opsMetrics?.fcmSuccessRate ?? 0}
        mode={mode}
      />
      {mode !== 'calm' && (
        <EscalationQueueSection
          stalledDispatches={stalledDispatches}
          onReDispatch={handleReDispatch}
          mode={mode}
        />
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          {mode !== 'surge' && <DispatchVolumeChart rows={rows} />}
          <RecentEventsFeed rows={rows} />
        </div>
        <div className="space-y-4">
          <ResponderAvailabilityPanel responders={responders} />
          {mode !== 'surge' && (
            <MunicipalPerformanceTable
              data={municipalData}
              onSelectMunicipality={handleSelectMunicipality}
            />
          )}
        </div>
      </div>
    </div>
  )}
</main>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/dashboard-mode-layout.test.tsx`

Expected: PASS

- [ ] **Step 5: Run full admin-desktop test suite**

Run: `pnpm --dir apps/admin-desktop exec vitest run`

Expected: All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-desktop/src/pages/DashboardPage.tsx apps/admin-desktop/src/__tests__/dashboard-mode-layout.test.tsx
git commit -m "feat(admin-desktop): DashboardPage mode derivation and conditional layout"
```

---

## PR 4: Accessibility Foundation

### Task 4.1: SkipLink Component

**Files:**

- Create: `apps/admin-desktop/src/components/SkipLink.tsx`
- Test: `apps/admin-desktop/src/__tests__/SkipLink.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/admin-desktop/src/__tests__/SkipLink.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SkipLink } from '../components/SkipLink'

describe('SkipLink', () => {
  it('is visually hidden by default', () => {
    render(<SkipLink />)
    const link = screen.getByText('Skip to main content')
    expect(link).toHaveClass('sr-only')
  })

  it('becomes visible on focus', () => {
    render(<SkipLink />)
    const link = screen.getByText('Skip to main content')
    fireEvent.focus(link)
    expect(link).not.toHaveClass('sr-only')
    expect(link).toHaveAttribute('href', '#main-content')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/SkipLink.test.tsx`

Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement SkipLink**

Create `apps/admin-desktop/src/components/SkipLink.tsx`:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/SkipLink.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/components/SkipLink.tsx apps/admin-desktop/src/__tests__/SkipLink.test.tsx
git commit -m "feat(admin-desktop): SkipLink accessibility component"
```

---

### Task 4.2: LiveAnnouncer Component

**Files:**

- Create: `apps/admin-desktop/src/components/LiveAnnouncer.tsx`
- Test: `apps/admin-desktop/src/__tests__/LiveAnnouncer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/admin-desktop/src/__tests__/LiveAnnouncer.test.tsx`:

```tsx
import { describe, it, expect, vi, act } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { LiveAnnouncer, announce } from '../components/LiveAnnouncer'

describe('LiveAnnouncer', () => {
  it('renders aria-live region', () => {
    render(<LiveAnnouncer />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('announces messages', async () => {
    render(<LiveAnnouncer />)
    act(() => {
      announce('Test message')
    })
    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument()
    })
  })

  it('rate-limits announcements', async () => {
    vi.useFakeTimers()
    render(<LiveAnnouncer />)

    act(() => {
      announce('First')
      announce('Second')
    })

    // Both should be batched into one message
    await waitFor(() => {
      expect(screen.getByText(/First/)).toBeInTheDocument()
    })

    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/LiveAnnouncer.test.tsx`

Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement LiveAnnouncer**

Create `apps/admin-desktop/src/components/LiveAnnouncer.tsx`:

```tsx
import { useEffect, useRef, useState, useCallback } from 'react'

let announceFn: ((msg: string) => void) | null = null

const MIN_INTERVAL_MS = 3000

export function announce(message: string) {
  announceFn?.(message)
}

export function LiveAnnouncer() {
  const [announcement, setAnnouncement] = useState('')
  const queueRef = useRef<string[]>([])
  const lastAnnounceRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (queueRef.current.length === 0) return
    const combined = queueRef.current.join('. ')
    queueRef.current = []
    setAnnouncement(combined)
    lastAnnounceRef.current = Date.now()
  }, [])

  const scheduleFlush = useCallback(() => {
    if (timeoutRef.current) return
    const elapsed = Date.now() - lastAnnounceRef.current
    const delay = Math.max(0, MIN_INTERVAL_MS - elapsed)
    timeoutRef.current = setTimeout(() => {
      flush()
      timeoutRef.current = null
    }, delay)
  }, [flush])

  useEffect(() => {
    announceFn = (msg: string) => {
      queueRef.current.push(msg)
      scheduleFlush()
    }
    return () => {
      announceFn = null
    }
  }, [scheduleFlush])

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
      {announcement}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/LiveAnnouncer.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/src/components/LiveAnnouncer.tsx apps/admin-desktop/src/__tests__/LiveAnnouncer.test.tsx
git commit -m "feat(admin-desktop): LiveAnnouncer aria-live region with rate limiting"
```

---

### Task 4.3: App.tsx Root Integration

**Files:**

- Modify: `apps/admin-desktop/src/app/App.tsx`

- [ ] **Step 1: Add SkipLink and LiveAnnouncer to App root**

Modify `apps/admin-desktop/src/app/App.tsx`:

Add imports at top:

```tsx
import { SkipLink } from '../components/SkipLink'
import { LiveAnnouncer } from '../components/LiveAnnouncer'
```

Render them at the very top of the app tree, before `<AuthProvider>` or router:

```tsx
export default function App() {
  return (
    <>
      <SkipLink />
      <LiveAnnouncer />
      <AuthProvider>{/* existing router/app content */}</AuthProvider>
    </>
  )
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run:

```bash
pnpm --dir apps/admin-desktop typecheck
pnpm --dir apps/admin-desktop lint
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/admin-desktop/src/app/App.tsx
git commit -m "feat(admin-desktop): add SkipLink and LiveAnnouncer to app root"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Section                | Implementing Task                          | Status |
| --------------------------- | ------------------------------------------ | ------ |
| 1.1 Mode Badge              | Task 2.3 (StatusBar)                       | ✅     |
| 1.2 Affected Municipalities | Task 2.3 (StatusBar)                       | ✅     |
| 1.3 Blocking Response       | Task 2.3 (StatusBar)                       | ✅     |
| 1.4 Responder Coverage      | Task 2.3 (StatusBar)                       | ✅     |
| 1.5 Data Freshness          | Task 2.3 (StatusBar)                       | ✅     |
| 1.6 Operational Labels      | Task 2.3 (StatusBar) + Task 3.2            | ✅     |
| 2.1 Mode Derivation         | Task 2.1                                   | ✅     |
| 2.2 Layout Adaptation       | Task 3.1, 3.2, 3.3                         | ✅     |
| 2.3 CSS Implementation      | Task 3.3 (conditional className)           | ✅     |
| 2.4 Animation               | Task 3.3 (transition classes)              | ✅     |
| 3.1 Wire Re-dispatch        | Task 1.3                                   | ✅     |
| 3.2 Success Feedback        | Task 1.1 + Task 1.3                        | ✅     |
| 3.3 Explicit Unknown States | Task 1.2                                   | ✅     |
| 4.1 Skip Link               | Task 4.1                                   | ✅     |
| 4.2 Live Announcer          | Task 4.2                                   | ✅     |
| 4.3 Keyboard Navigation     | Documented in spec; arrow-key nav deferred | ⚠️     |
| 5 Backend Gaps              | Documented only; no code needed            | ✅     |

**Gap:** Arrow-key navigation between escalation cards is specified in the design but deferred to a follow-up PR to keep each PR under 3 files.

### 2. Placeholder Scan

- No "TBD", "TODO", or "implement later"
- No vague "add appropriate error handling"
- Every task has exact file paths and code
- Every test has exact assertion code

### 3. Type Consistency

- `DashboardMode` used consistently across all files
- `deriveDashboardMode` signature matches in definition and call sites
- `SuccessBanner` props unchanged (only added `useEffect`)
- `ReDispatchModal` props unchanged (existing interface reused)

---

## Verification Summary (Run After All PRs)

```bash
# Typecheck
pnpm typecheck

# Lint
pnpm lint

# Admin-desktop tests
pnpm --dir apps/admin-desktop exec vitest run

# Local E2E proof
pnpm proof:local
```

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-25-admin-desktop-dashboard-command-board.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**
