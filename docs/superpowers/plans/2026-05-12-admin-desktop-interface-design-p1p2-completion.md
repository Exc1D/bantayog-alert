# Admin Desktop — Interface-Design P1/P2 Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining P1/P2 findings from `docs/ui-audit-findings-2026-05-07.md` (Tasks #9 GREEN, #10, #11, #12, #13) so the admin-desktop interface-design remediation set is fully shipped.

**Architecture:** All work is inside `apps/admin-desktop`. The dominant pattern is the **truth gate**: producers (Dashboard, Map) emit only the fields they can derive from the live Firestore stream, and renderers display `—` for anything they cannot resolve. Cross-tab sync gets idempotent message dedup. Loading branches stop hiding the offline banner. Keyboard parity is added to one pointer-only control.

**Tech Stack:** React 19 + TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`); Vitest + React Testing Library + `@testing-library/user-event`; Vite + Tailwind + CSS custom properties (`--color-norm`, `--color-warn`, `--color-crit`, `--color-text-secondary`, `--color-text-muted`, `--color-surface-elevated`).

**Branch context:** Work continues on the current working branch (uncommitted Task #9 RED test already on disk). One commit per task; no PRs requested in this plan.

**Convention reminders (CLAUDE.md):**

- Re-read after edits — disk is truth.
- Verify gates after each task: `pnpm --dir apps/admin-desktop exec vitest run <file>` + `pnpm --dir apps/admin-desktop typecheck` + `pnpm --dir apps/admin-desktop lint`.
- `exactOptionalPropertyTypes` — never assign `undefined` to an optional prop; omit the key.
- `@typescript-eslint/restrict-template-expressions` — wrap numeric template substitutions in `String(...)`.
- `@typescript-eslint/no-confusing-void-expression` — do not use `.then()` shorthand in arrow tests; use `async/await`.

---

## Task 9: P1.8 — MunicipalPerformanceTable truth gate (GREEN + commit)

**Why:** Both producers (`DashboardPage.tsx`, `MapPage.tsx`) emit fabricated zeros (`activeResponders: 0`, `avgResponseTime: '0m'`, `unresolvedOver24h: 0`, `adminOnDuty: false`) because the report stream does not contain those facts. The table renders those zeros as if they were real, painting "No Shift" badges and an implicit "healthy 0 min" response. Truth gate: producers omit, renderer shows `—`, sort treats undefined as last.

**Files:**

- Modify: `apps/admin-desktop/src/types/index.ts:206-215`
- Modify: `apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx`
- Modify: `apps/admin-desktop/src/components/MunicipalDrillDown.tsx`
- Modify: `apps/admin-desktop/src/pages/DashboardPage.tsx:335-350`
- Modify: `apps/admin-desktop/src/pages/MapPage.tsx:124-135`
- Test: `apps/admin-desktop/src/__tests__/MunicipalPerformanceTable.test.tsx` (RED already landed; sort test must be refactored to async/await during GREEN)

**Status check before starting:**

```bash
git status --short apps/admin-desktop/src/__tests__/MunicipalPerformanceTable.test.tsx
```

Expected: `M apps/admin-desktop/src/__tests__/MunicipalPerformanceTable.test.tsx` (RED test from previous segment is on disk).

---

- [ ] **Step 1: Confirm RED test fails today**

Run:

```bash
pnpm --dir apps/admin-desktop exec vitest run src/__tests__/MunicipalPerformanceTable.test.tsx
```

Expected: 2 failing tests — `renders em-dash placeholders when synthesized fields are undefined` (TypeScript compile error on `{ municipality, activeIncidents }` literal — missing required fields), `sorts undefined avg response time to the end when ascending` (same compile error; `avgResponseTime` is currently required).

If TypeScript compilation fails the whole file, that is the RED gate. Proceed.

- [ ] **Step 2: Loosen `MunicipalPerformance` type so unwired rows are legal**

File: `apps/admin-desktop/src/types/index.ts`

Find:

```ts
export interface MunicipalPerformance {
  municipality: string
  activeIncidents: number
  activeResponders: number
  totalResponders?: number
  avgResponseTime: string
  unresolvedOver24h: number
  adminOnDuty: boolean
  adminName?: string
}
```

Replace with:

```ts
export interface MunicipalPerformance {
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

- [ ] **Step 3: Verify the type loosening compiles**

Run:

```bash
pnpm --dir apps/admin-desktop typecheck
```

Expected: typecheck still fails — producers `DashboardPage.tsx` and `MapPage.tsx` are still emitting the now-optional fields, which is fine, but `MunicipalPerformanceTable.tsx` reads them without the `undefined` branch. Note the errors; they are resolved in Steps 4–7.

- [ ] **Step 4: Refactor sort comparator to push undefined avg-response-time to the end**

File: `apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx`

Find the existing sort block (the comparator that uses `parseMinutes(a.avgResponseTime) - parseMinutes(b.avgResponseTime)`). Replace its `else` branch so undefined sorts as `Infinity`:

```tsx
const sorted =
  sortKey === null
    ? data
    : [...data].sort((a, b) => {
        let diff = 0
        if (sortKey === 'activeIncidents') {
          diff = a.activeIncidents - b.activeIncidents
        } else if (sortKey === 'municipality') {
          diff = a.municipality.localeCompare(b.municipality)
        } else {
          const aMin = a.avgResponseTime === undefined ? Infinity : parseMinutes(a.avgResponseTime)
          const bMin = b.avgResponseTime === undefined ? Infinity : parseMinutes(b.avgResponseTime)
          diff = aMin - bMin
        }
        return sortAsc ? diff : -diff
      })
```

- [ ] **Step 5: Add em-dash gating + data-testid attributes to MunicipalPerformanceTable cells**

File: `apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx`

In the row map (the `sorted.map((row) => (...))` body), replace the three cells (Active Responders, Avg Response Time, Admin On Duty) with truth-gated versions. The exact replacement (copy verbatim):

```tsx
<td
  className="px-4 py-3 font-mono text-[var(--color-text-secondary)]"
  style={{ fontVariantNumeric: 'tabular-nums' }}
  data-testid={`muniperf-responders-${row.municipality}`}
>
  {row.activeResponders === undefined ? '—' : row.activeResponders}
</td>
<td
  className="px-4 py-3 font-mono"
  style={{
    color: row.avgResponseTime === undefined
      ? 'var(--color-text-secondary)'
      : responseTimeToken(row.avgResponseTime),
    fontVariantNumeric: 'tabular-nums',
  }}
  data-testid={`muniperf-response-${row.municipality}`}
>
  {row.avgResponseTime ?? '—'}
</td>
<td
  className="px-4 py-3 text-[var(--color-text-secondary)]"
  data-testid={`muniperf-admin-${row.municipality}`}
>
  {row.adminOnDuty === undefined ? (
    '—'
  ) : row.adminOnDuty ? (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: 'var(--color-norm)' }}
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

- [ ] **Step 6: Mirror the em-dash treatment in MunicipalDrillDown**

File: `apps/admin-desktop/src/components/MunicipalDrillDown.tsx`

Find the "Available Responders" + "Avg Response" + on-duty rows (the JSX containing `data.activeResponders` and `data.avgResponseTime`). Replace those three blocks with:

```tsx
<div className="flex items-center gap-2">
  <span className="text-sm font-medium text-[var(--color-text-primary)]">
    {data.activeResponders === undefined
      ? '—'
      : data.totalResponders !== undefined
        ? `${String(data.activeResponders)}/${String(data.totalResponders)}`
        : String(data.activeResponders)}
  </span>
  <span className="text-xs text-[var(--color-text-secondary)]">Available Responders</span>
</div>
<div className="flex items-center gap-2">
  <span className="text-sm font-medium text-[var(--color-text-primary)]">
    {data.avgResponseTime ?? '—'}
  </span>
  <span className="text-xs text-[var(--color-text-secondary)]">Avg Response</span>
</div>
{data.adminOnDuty && data.adminName !== undefined && (
  <div className="flex items-center gap-2">
    <span className="text-xs text-[var(--color-text-secondary)]">
      {data.adminName} (On Duty)
    </span>
  </div>
)}
```

- [ ] **Step 7: Drop fabricated zeros from DashboardPage producer**

File: `apps/admin-desktop/src/pages/DashboardPage.tsx`

Find the `municipalData` `useMemo` (the `Array.from(byMuni.entries()).map(...)` returning a `MunicipalPerformance` literal). Replace its mapper return value with the activeIncidents-only emission:

```tsx
const municipalData: MunicipalPerformance[] = useMemo(() => {
  const byMuni = new Map<string, Report[]>()
  reports.forEach((r) => {
    const list = byMuni.get(r.municipality) ?? []
    list.push(mapReportDocToReport(r))
    byMuni.set(r.municipality, list)
  })
  return Array.from(byMuni.entries()).map(([municipality, muniReports]) => ({
    municipality,
    activeIncidents: muniReports.filter((r) => r.status === 'ACTIVE').length,
  }))
}, [reports])
```

Rationale: every other field requires data we do not yet have on the dashboard stream (responder rosters, shift schedule, response-time analytics). Omit them so the renderer renders `—`.

- [ ] **Step 8: Drop fabricated zeros from MapPage producer**

File: `apps/admin-desktop/src/pages/MapPage.tsx`

Find the `municipalityData` `useMemo` returning the `MunicipalPerformance | null` literal. Replace it with:

```tsx
const municipalityData: MunicipalPerformance | null = useMemo(() => {
  if (!selectedMunicipalityId) return null
  const muniReports = reports.filter((r) => r.municipality === selectedMunicipalityId)
  return {
    municipality: selectedMunicipalityId,
    activeIncidents: muniReports.filter((r) => r.status === 'ACTIVE').length,
  }
}, [selectedMunicipalityId, reports])
```

- [ ] **Step 9: Refactor the sort RED test to async/await**

File: `apps/admin-desktop/src/__tests__/MunicipalPerformanceTable.test.tsx`

Find the test `sorts undefined avg response time to the end when ascending` and replace its body so it no longer returns a `.then()` chain (which trips `@typescript-eslint/no-confusing-void-expression`):

```tsx
it('sorts undefined avg response time to the end when ascending', async () => {
  // Unwired rows should sort last when ascending so triage focus stays on real data.
  const mixed: MunicipalPerformance[] = [
    { municipality: 'Daet', activeIncidents: 1, avgResponseTime: '8 min' },
    { municipality: 'Labo', activeIncidents: 2 },
    { municipality: 'Capalonga', activeIncidents: 3, avgResponseTime: '18 min' },
  ]
  const user = userEvent.setup()
  render(<MunicipalPerformanceTable data={mixed} onSelectMunicipality={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: /avg response/i }))
  const rows = screen.getAllByRole('row')
  // header + Daet(8) + Capalonga(18) + Labo(undefined → Infinity, last)
  expect(rows[1]).toHaveTextContent('Daet')
  expect(rows[2]).toHaveTextContent('Capalonga')
  expect(rows[3]).toHaveTextContent('Labo')
})
```

- [ ] **Step 10: Run the focused vitest suite to confirm GREEN**

Run:

```bash
pnpm --dir apps/admin-desktop exec vitest run src/__tests__/MunicipalPerformanceTable.test.tsx
```

Expected: all 11 tests pass (9 originals + 2 new). If `applies color to response time cells` regresses, check that the wired `responseTimeToken(...)` branch is unchanged — only the undefined branch should be neutral.

- [ ] **Step 11: Run typecheck + lint**

Run:

```bash
pnpm --dir apps/admin-desktop typecheck && pnpm --dir apps/admin-desktop lint
```

Expected: typecheck clean; lint clean apart from the two pre-existing warnings in `src/__tests__/triage-queue.test.tsx` and `src/pages/AgencyAssistanceQueuePage.test.tsx` documented in `docs/progress.md` (2026-05-07).

- [ ] **Step 12: Run full vitest to catch unrelated regressions**

Run:

```bash
pnpm --dir apps/admin-desktop exec vitest run
```

Expected: pre-existing 5 failing tests in `TrendAnalysisPanel.test.tsx` (label drift, deferred per §8.3); everything else green.

- [ ] **Step 13: Commit Task 9**

Run:

```bash
git add apps/admin-desktop/src/types/index.ts \
        apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx \
        apps/admin-desktop/src/components/MunicipalDrillDown.tsx \
        apps/admin-desktop/src/pages/DashboardPage.tsx \
        apps/admin-desktop/src/pages/MapPage.tsx \
        apps/admin-desktop/src/__tests__/MunicipalPerformanceTable.test.tsx
git commit -m "$(cat <<'EOF'
fix(admin-desktop): truth-gate MunicipalPerformanceTable unwired fields

Producers in DashboardPage and MapPage could not derive activeResponders,
avgResponseTime, unresolvedOver24h, or adminOnDuty from the report stream.
They were emitting fabricated zeros + false flags, and the table rendered
them as if real (green response-time, "No Shift" badge, etc.).

- Loosen MunicipalPerformance: those 4 fields are now optional.
- Renderer surfaces "—" for undefined and keeps response-time color neutral.
- Sort treats undefined avgResponseTime as Infinity so unwired rows sort last.
- DashboardPage + MapPage producers emit only municipality + activeIncidents.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: P2.9 — Hold-to-Dispatch keyboard parity

**Why:** `TriagePanel.tsx` lines 189–209 ship a custom "Hold to Dispatch" button that only responds to pointer events (`onMouseDown`, `onTouchStart`). Keyboard-only operators cannot dispatch a responder. Mirror the proven `SosHoldButton` pattern from the responder-app (Space/Enter `keydown`/`keyup` with key-repeat guard).

**Files:**

- Modify: `apps/admin-desktop/src/components/TriagePanel.tsx:189-209`
- Test: `apps/admin-desktop/src/__tests__/TriagePanel.test.tsx`

---

- [ ] **Step 1: Write the failing test**

File: `apps/admin-desktop/src/__tests__/TriagePanel.test.tsx`

Append inside the existing `describe('TriagePanel', ...)` block (after the final closing `})` of the last `it`, before the outer `})`):

```tsx
it('triggers dispatch via keyboard Space hold for 1000ms', async () => {
  vi.useFakeTimers()
  const onDispatch = vi.fn()
  render(
    <TriagePanel
      report={mockReport}
      responders={mockResponders}
      onClose={vi.fn()}
      onVerify={vi.fn()}
      onReject={vi.fn()}
      onDispatch={onDispatch}
    />,
  )

  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.click(screen.getByRole('button', { name: /dispatch responder/i }))
  await user.selectOptions(screen.getByLabelText(/agency/i), 'BFP')
  await user.selectOptions(screen.getByLabelText(/responder/i), 'resp-1')

  const holdButton = screen.getByRole('button', { name: /hold to dispatch/i })
  holdButton.focus()
  fireEvent.keyDown(holdButton, { key: ' ' })
  act(() => {
    vi.advanceTimersByTime(1100)
  })
  fireEvent.keyUp(holdButton, { key: ' ' })

  expect(onDispatch).toHaveBeenCalledWith(mockReport.id, 'BFP', 'resp-1')
  vi.useRealTimers()
})

it('does not re-trigger dispatch when keydown repeats', async () => {
  vi.useFakeTimers()
  const onDispatch = vi.fn()
  render(
    <TriagePanel
      report={mockReport}
      responders={mockResponders}
      onClose={vi.fn()}
      onVerify={vi.fn()}
      onReject={vi.fn()}
      onDispatch={onDispatch}
    />,
  )
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.click(screen.getByRole('button', { name: /dispatch responder/i }))
  await user.selectOptions(screen.getByLabelText(/agency/i), 'BFP')
  await user.selectOptions(screen.getByLabelText(/responder/i), 'resp-1')

  const holdButton = screen.getByRole('button', { name: /hold to dispatch/i })
  holdButton.focus()
  fireEvent.keyDown(holdButton, { key: ' ' })
  fireEvent.keyDown(holdButton, { key: ' ', repeat: true })
  fireEvent.keyDown(holdButton, { key: ' ', repeat: true })
  act(() => {
    vi.advanceTimersByTime(1100)
  })
  fireEvent.keyUp(holdButton, { key: ' ' })

  expect(onDispatch).toHaveBeenCalledTimes(1)
  vi.useRealTimers()
})
```

Ensure these imports are present at the top of the file (add the missing ones):

```tsx
import { fireEvent, render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
```

If `mockReport` / `mockResponders` fixtures are not already declared in this file, copy them from the first existing test in the suite (the file already constructs them).

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir apps/admin-desktop exec vitest run src/__tests__/TriagePanel.test.tsx -t "Hold"
```

Expected: both new tests fail because the Hold button does not yet handle `keydown`/`keyup`. `onDispatch` is never called.

- [ ] **Step 3: Add keyboard parity to the Hold button**

File: `apps/admin-desktop/src/components/TriagePanel.tsx`

Find the Hold button (the `<button ... onMouseDown={startHold} ...>` near line 189). Replace the entire `<button>` element with:

```tsx
<button
  type="button"
  disabled={!agency || !responder}
  aria-disabled={!agency || !responder}
  aria-label="Hold to Dispatch responder (press and hold Space or Enter)"
  onMouseDown={startHold}
  onMouseUp={endHold}
  onMouseLeave={endHold}
  onTouchStart={startHold}
  onTouchEnd={endHold}
  onKeyDown={(e) => {
    if (e.repeat) return
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    startHold()
  }}
  onKeyUp={(e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    endHold()
  }}
  onBlur={endHold}
  className="relative w-full overflow-hidden rounded-md bg-[var(--color-info)] py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
>
  <span className="relative z-10">Hold to Dispatch</span>
  {holdProgress > 0 && (
    <div
      className="pointer-events-none absolute inset-0 origin-left rounded-md bg-white/20"
      style={{
        transform: `scaleX(${String(holdProgress / 100)})`,
        transition: 'transform 100ms linear',
      }}
      aria-hidden="true"
    />
  )}
</button>
```

- [ ] **Step 4: Ensure unmount cleans up the hold timer**

File: `apps/admin-desktop/src/components/TriagePanel.tsx`

Confirm the existing `useEffect` cleanup clears `holdTimerRef.current`. If absent, add (place near the existing refs, after the `holdTimerRef` declaration):

```tsx
useEffect(() => {
  return () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }
}, [])
```

(If a cleanup already exists, leave it alone — do not double-register.)

- [ ] **Step 5: Run the focused vitest to confirm GREEN**

Run:

```bash
pnpm --dir apps/admin-desktop exec vitest run src/__tests__/TriagePanel.test.tsx
```

Expected: every test in the file passes, including the two new keyboard tests.

- [ ] **Step 6: Run typecheck + lint**

Run:

```bash
pnpm --dir apps/admin-desktop typecheck && pnpm --dir apps/admin-desktop lint
```

Expected: clean (minus the pre-existing 2 warnings).

- [ ] **Step 7: Commit Task 10**

Run:

```bash
git add apps/admin-desktop/src/components/TriagePanel.tsx \
        apps/admin-desktop/src/__tests__/TriagePanel.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin-desktop): keyboard parity for Hold-to-Dispatch button

Mirrors the responder-app SosHoldButton pattern: Space or Enter starts
the hold; releasing or blurring cancels. Guards against key-repeat so a
held key does not spawn multiple dispatches. Cleans up the hold timer
on unmount.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: P2.10 — Sticky bulk-action bar in TriageQueueTable

**Why:** When operators select reports and the page scrolls, the bulk-action bar (Verify Selected / Reject Selected) scrolls out of the viewport. The sticky thead at `top-0 z-10` already pins; the bulk bar needs to pin above it (`top-0 z-20`) so it remains in reach.

**Files:**

- Modify: `apps/admin-desktop/src/components/TriageQueueTable.tsx`
- Test: `apps/admin-desktop/src/__tests__/TriageQueueTable.test.tsx`

---

- [ ] **Step 1: Write the failing test**

File: `apps/admin-desktop/src/__tests__/TriageQueueTable.test.tsx`

Append inside the existing `describe('TriageQueueTable', ...)`:

```tsx
it('renders the bulk-action bar sticky above the sticky thead', () => {
  const { container } = renderTable({ selectedIds: new Set(['r1']) })
  const bulkBar = container.querySelector('[data-testid="bulk-action-bar"]')
  expect(bulkBar).not.toBeNull()
  expect(bulkBar?.className).toContain('sticky')
  expect(bulkBar?.className).toContain('top-0')
  // z-20 so it pins ABOVE the z-10 thead.
  expect(bulkBar?.className).toContain('z-20')
  expect(bulkBar?.className).toContain('bg-[var(--color-surface-elevated)]')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir apps/admin-desktop exec vitest run src/__tests__/TriageQueueTable.test.tsx -t "sticky"
```

Expected: the new test fails — the bulk bar today has no `data-testid` and no sticky classes.

- [ ] **Step 3: Make the bulk-action bar sticky and identifiable**

File: `apps/admin-desktop/src/components/TriageQueueTable.tsx`

Find the conditional bulk-bar block (the `{selectedIds.size > 0 && (...)}` around line 54). Replace its outer `<div>` open tag with:

```tsx
<div
  data-testid="bulk-action-bar"
  className="sticky top-0 z-20 mb-2 flex items-center gap-2 border-b border-white/10 bg-[var(--color-surface-elevated)] px-4 py-2"
>
```

Close the div as before. The interior buttons (Verify Selected / Reject Selected) stay unchanged.

- [ ] **Step 4: Run focused vitest GREEN**

Run:

```bash
pnpm --dir apps/admin-desktop exec vitest run src/__tests__/TriageQueueTable.test.tsx
```

Expected: all tests pass — the new sticky test plus the existing sticky-thead test (which still asserts the `<thead>` has `bg-[var(--color-surface-elevated)]`).

- [ ] **Step 5: Run typecheck + lint**

Run:

```bash
pnpm --dir apps/admin-desktop typecheck && pnpm --dir apps/admin-desktop lint
```

Expected: clean.

- [ ] **Step 6: Commit Task 11**

Run:

```bash
git add apps/admin-desktop/src/components/TriageQueueTable.tsx \
        apps/admin-desktop/src/__tests__/TriageQueueTable.test.tsx
git commit -m "$(cat <<'EOF'
fix(admin-desktop): pin TriageQueueTable bulk-action bar above sticky thead

The bulk-action bar previously scrolled out of view while the thead stayed
pinned. Adding sticky top-0 z-20 keeps it reachable for the operator during
long scrolls. z-20 sits above the existing z-10 thead so the bar overlays
the column headers when both are pinned.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: P2.11 — WindowSyncProvider message de-dup

**Why:** `WindowSyncProvider` falls back to `localStorage` when `BroadcastChannel` is unavailable. In dual-tab + fallback paths the same message can be delivered twice (BC + storage event), causing duplicate selection broadcasts. Add a UUID + in-memory seen-set with a 5 s TTL that matches the existing `MESSAGE_TTL_MS`.

**Files:**

- Modify: `apps/admin-desktop/src/stores/commandCenterStore.ts` (extend `SyncMessage`)
- Modify: `apps/admin-desktop/src/providers/WindowSyncProvider.tsx`
- Test: `apps/admin-desktop/src/__tests__/WindowSyncProvider.dedup.test.tsx` (create)

---

- [ ] **Step 1: Confirm where `SyncMessage` is declared**

Run:

```bash
grep -n "SyncMessage" apps/admin-desktop/src/stores/commandCenterStore.ts apps/admin-desktop/src/providers/WindowSyncProvider.tsx
```

Expected: `SyncMessage` is exported from `commandCenterStore.ts` and re-imported by `WindowSyncProvider.tsx`. (If the codebase has moved this type, adapt the next step to the file that owns it.)

- [ ] **Step 2: Add optional `id` to `SyncMessage`**

File: `apps/admin-desktop/src/stores/commandCenterStore.ts`

Find the `SyncMessage` type (a tagged union of `{ type: 'select:report' | 'select:municipality' | ..., source: 'dashboard' | 'map', ... }`). Add an `id?: string` to each member. If the union is written as:

```ts
export type SyncMessage =
  | { type: 'select:report'; reportId: string | null; source: 'dashboard' | 'map' }
  | { type: 'select:municipality'; municipalityId: string | null; source: 'dashboard' | 'map' }
```

Replace with:

```ts
export type SyncMessage =
  | { type: 'select:report'; reportId: string | null; source: 'dashboard' | 'map'; id?: string }
  | {
      type: 'select:municipality'
      municipalityId: string | null
      source: 'dashboard' | 'map'
      id?: string
    }
```

(If additional members exist, add `id?: string` to each.)

- [ ] **Step 3: Write the failing dedup test**

File: `apps/admin-desktop/src/__tests__/WindowSyncProvider.dedup.test.tsx` (new)

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect } from 'react'
import { WindowSyncProvider, useWindowSyncContext } from '../providers/WindowSyncProvider'
import type { SyncMessage } from '../stores/commandCenterStore'

function Consumer({ onMsg }: { onMsg: (m: SyncMessage) => void }) {
  const { subscribe } = useWindowSyncContext()
  useEffect(() => subscribe(onMsg), [subscribe, onMsg])
  return null
}

describe('WindowSyncProvider dedup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('delivers the same message id only once', () => {
    const seen = vi.fn()
    const { rerender } = render(
      <WindowSyncProvider>
        <Consumer onMsg={seen} />
      </WindowSyncProvider>,
    )
    rerender(
      <WindowSyncProvider>
        <Consumer onMsg={seen} />
      </WindowSyncProvider>,
    )

    // Simulate both BroadcastChannel and storage delivering the same message.
    const msg: SyncMessage = {
      type: 'select:report',
      reportId: 'r1',
      source: 'dashboard',
      id: 'dedup-1',
    }
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'bantayog.window-sync',
          newValue: JSON.stringify({ data: msg, timestamp: Date.now() }),
        }),
      )
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'bantayog.window-sync',
          newValue: JSON.stringify({ data: msg, timestamp: Date.now() }),
        }),
      )
    })

    expect(seen).toHaveBeenCalledTimes(1)
  })
})
```

Note on the storage-event approach: jsdom/happy-dom does not natively replay `BroadcastChannel`; the storage path is the second delivery channel that already exists in the provider and is fully observable from tests. The test verifies the seen-set dedups both channels.

- [ ] **Step 4: Run test to verify it fails**

Run:

```bash
pnpm --dir apps/admin-desktop exec vitest run src/__tests__/WindowSyncProvider.dedup.test.tsx
```

Expected: fails — current provider delivers twice (or throws a TypeScript error if the storage handler does not yet exist; in that case the second `act` call simply does not fire and the count is `0`, still failing the `times(1)` assertion). Either failure is the RED gate.

- [ ] **Step 5: Add dedup to WindowSyncProvider**

File: `apps/admin-desktop/src/providers/WindowSyncProvider.tsx`

Inside the provider component, add the seen-set ref next to the existing `bcRef`/`listenersRef`:

```tsx
const seenIdsRef = useRef<Map<string, number>>(new Map())

const isDuplicate = useCallback((msg: SyncMessage): boolean => {
  if (msg.id === undefined) return false
  const now = Date.now()
  // Prune expired entries first so the map cannot grow unbounded.
  for (const [seenId, ts] of seenIdsRef.current) {
    if (now - ts > MESSAGE_TTL_MS) {
      seenIdsRef.current.delete(seenId)
    }
  }
  if (seenIdsRef.current.has(msg.id)) return true
  seenIdsRef.current.set(msg.id, now)
  return false
}, [])
```

In the BroadcastChannel `onmessage` handler, gate by `isDuplicate`:

```tsx
bc.onmessage = (ev: MessageEvent<SyncMessage>) => {
  if (isDuplicate(ev.data)) return
  listenersRef.current.forEach((fn) => {
    fn(ev.data)
  })
}
```

If there is a `storage` event listener (or add one if missing), gate identically:

```tsx
useEffect(() => {
  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== STORAGE_KEY || ev.newValue === null) return
    try {
      const parsed = JSON.parse(ev.newValue) as { data: SyncMessage; timestamp: number }
      if (Date.now() - parsed.timestamp > MESSAGE_TTL_MS) return
      if (isDuplicate(parsed.data)) return
      listenersRef.current.forEach((fn) => {
        fn(parsed.data)
      })
    } catch {
      /* malformed payload — ignore */
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener('storage', onStorage)
  }
}, [isDuplicate])
```

In `sendSync`, auto-assign an `id` when the caller did not supply one, so every outbound message participates in dedup:

```tsx
const sendSync = useCallback(
  (msg: SyncMessage) => {
    const withId: SyncMessage = msg.id !== undefined ? msg : { ...msg, id: crypto.randomUUID() }
    // Record locally so an echo back from BC/storage is ignored.
    isDuplicate(withId)
    if (bcRef.current) {
      bcRef.current.postMessage(withId)
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: withId, timestamp: Date.now() }))
    } catch {
      /* storage quota — ignore */
    }
  },
  [isDuplicate],
)
```

Imports to confirm at the top of the file:

```tsx
import { useCallback, useEffect, useRef } from 'react'
import type { SyncMessage } from '../stores/commandCenterStore'
```

`crypto.randomUUID()` is available in all admin-desktop target browsers (Electron / modern Chrome). No polyfill needed.

- [ ] **Step 6: Run the new test GREEN**

Run:

```bash
pnpm --dir apps/admin-desktop exec vitest run src/__tests__/WindowSyncProvider.dedup.test.tsx
```

Expected: 1/1 passes.

- [ ] **Step 7: Run typecheck + lint + full vitest**

Run:

```bash
pnpm --dir apps/admin-desktop typecheck && pnpm --dir apps/admin-desktop lint && pnpm --dir apps/admin-desktop exec vitest run
```

Expected: typecheck clean; lint clean; full suite green minus the pre-existing TrendAnalysisPanel failures.

- [ ] **Step 8: Commit Task 12**

Run:

```bash
git add apps/admin-desktop/src/stores/commandCenterStore.ts \
        apps/admin-desktop/src/providers/WindowSyncProvider.tsx \
        apps/admin-desktop/src/__tests__/WindowSyncProvider.dedup.test.tsx
git commit -m "$(cat <<'EOF'
fix(admin-desktop): dedup WindowSync messages by id with TTL

BroadcastChannel + localStorage fallback could deliver the same sync
message twice. Added an optional `id` (auto-filled via crypto.randomUUID
when missing) and an in-memory seen-set with a 5s TTL that mirrors
MESSAGE_TTL_MS. Both the BC handler and the storage-event handler now
short-circuit on duplicates.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: P2.12 — Render OfflineBanner above loading branch

**Why:** Both `DashboardPage.tsx:361-369` and `MapPage.tsx:206-214` return a loading-only spinner before mounting `<OfflineBanner>`. When the listener errors on a cold load (network down, rules denial), the operator sees a permanent spinner with no explanation. The banner must be visible during loading too.

**Files:**

- Modify: `apps/admin-desktop/src/pages/DashboardPage.tsx`
- Modify: `apps/admin-desktop/src/pages/MapPage.tsx`
- Test: `apps/admin-desktop/src/__tests__/DashboardPage.loading-offline.test.tsx` (create)
- Test: `apps/admin-desktop/src/__tests__/MapPage.loading-offline.test.tsx` (create)

---

- [ ] **Step 1: Write the failing Dashboard test**

File: `apps/admin-desktop/src/__tests__/DashboardPage.loading-offline.test.tsx` (new)

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'
import { WindowSyncProvider } from '../providers/WindowSyncProvider'

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
    loading: true,
    error: 'offline',
    reports: [],
    alerts: [],
    responders: [],
  }),
}))
vi.mock('../hooks/useAudioAlerts', () => ({
  useAudioAlerts: () => ({
    enabled: false,
    toggle: vi.fn(),
    play: vi.fn(),
    playError: vi.fn(),
  }),
}))
vi.mock('../app/firebase', () => ({ db: {}, rtdb: {} }))

describe('DashboardPage loading + offline', () => {
  it('renders the OfflineBanner above the loading spinner when error is set', () => {
    render(
      <MemoryRouter>
        <WindowSyncProvider>
          <DashboardPage />
        </WindowSyncProvider>
      </MemoryRouter>,
    )
    // OfflineBanner exposes role="alert" (or role="status" depending on
    // variant). Assert at least one of these is present so the banner is
    // not hidden behind the loading return.
    const banner = screen.queryByRole('alert') ?? screen.queryByRole('status')
    expect(banner).not.toBeNull()
  })
})
```

Run:

```bash
pnpm --dir apps/admin-desktop exec vitest run src/__tests__/DashboardPage.loading-offline.test.tsx
```

Expected: fails — the loading branch returns the spinner before mounting OfflineBanner.

- [ ] **Step 2: Render OfflineBanner inside the Dashboard loading branch**

File: `apps/admin-desktop/src/pages/DashboardPage.tsx`

Find:

```tsx
if (loading) {
  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    </div>
  )
}
```

Replace with:

```tsx
if (loading) {
  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <OfflineBanner error={error} />
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    </div>
  )
}
```

`OfflineBanner` returns `null` when neither offline nor error, so the existing happy-path loading UX (network up) is unchanged.

- [ ] **Step 3: Run Dashboard test GREEN**

Run:

```bash
pnpm --dir apps/admin-desktop exec vitest run src/__tests__/DashboardPage.loading-offline.test.tsx
```

Expected: 1/1 passes.

- [ ] **Step 4: Write the failing Map test**

File: `apps/admin-desktop/src/__tests__/MapPage.loading-offline.test.tsx` (new)

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MapPage from '../pages/MapPage'
import { WindowSyncProvider } from '../providers/WindowSyncProvider'

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
    loading: true,
    error: 'offline',
    reports: [],
    alerts: [],
    responders: [],
  }),
}))
vi.mock('../app/firebase', () => ({ db: {}, rtdb: {} }))

describe('MapPage loading + offline', () => {
  it('renders the OfflineBanner above the loading spinner when error is set', () => {
    render(
      <MemoryRouter>
        <WindowSyncProvider>
          <MapPage />
        </WindowSyncProvider>
      </MemoryRouter>,
    )
    const banner = screen.queryByRole('alert') ?? screen.queryByRole('status')
    expect(banner).not.toBeNull()
  })
})
```

Run:

```bash
pnpm --dir apps/admin-desktop exec vitest run src/__tests__/MapPage.loading-offline.test.tsx
```

Expected: fails for the same reason.

- [ ] **Step 5: Render OfflineBanner inside the Map loading branch**

File: `apps/admin-desktop/src/pages/MapPage.tsx`

Find:

```tsx
if (loading) {
  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    </div>
  )
}
```

Replace with:

```tsx
if (loading) {
  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <OfflineBanner error={error} />
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Run Map test GREEN**

Run:

```bash
pnpm --dir apps/admin-desktop exec vitest run src/__tests__/MapPage.loading-offline.test.tsx
```

Expected: 1/1 passes.

- [ ] **Step 7: Run typecheck + lint + full vitest**

Run:

```bash
pnpm --dir apps/admin-desktop typecheck && pnpm --dir apps/admin-desktop lint && pnpm --dir apps/admin-desktop exec vitest run
```

Expected: typecheck clean; lint clean; full suite green minus the pre-existing TrendAnalysisPanel failures.

- [ ] **Step 8: Commit Task 13**

Run:

```bash
git add apps/admin-desktop/src/pages/DashboardPage.tsx \
        apps/admin-desktop/src/pages/MapPage.tsx \
        apps/admin-desktop/src/__tests__/DashboardPage.loading-offline.test.tsx \
        apps/admin-desktop/src/__tests__/MapPage.loading-offline.test.tsx
git commit -m "$(cat <<'EOF'
fix(admin-desktop): show OfflineBanner during loading branch

DashboardPage and MapPage previously returned a spinner-only loading
view that hid the OfflineBanner. On a cold offline boot the operator
would stare at an indefinite spinner with no explanation. The banner
renders null when nothing is wrong, so the happy-path loading UX is
unchanged.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

After all 5 tasks are committed:

```bash
pnpm --dir apps/admin-desktop typecheck
pnpm --dir apps/admin-desktop lint
pnpm --dir apps/admin-desktop exec vitest run
```

Expected: typecheck clean; lint clean (2 pre-existing warnings only); vitest green minus the deferred TrendAnalysisPanel label-drift failures (5 tests in 1 file). Then update `docs/progress.md` Current Status block to mark P1.8 / P2.9 / P2.10 / P2.11 / P2.12 as completed, and append any new entries to `docs/learnings.md` if a step surfaced a non-obvious gotcha.

---

## Risks and rollback

- **Task 9 risk:** producer-side type loosening removes the four fields entirely from the Dashboard/Map emissions. If a downstream consumer (analytics page, drill-down) was implicitly relying on the fabricated zeros, it now sees `undefined`. Both known consumers (`MunicipalPerformanceTable`, `MunicipalDrillDown`) are updated in this task; `grep -rn "MunicipalPerformance" apps/admin-desktop/src` should not surface any other reader.
- **Task 10 risk:** screen readers may announce the `aria-label` on every focus. Acceptable trade-off for keyboard discoverability; the announcement carries the exact action.
- **Task 11 risk:** sticky bulk bar now overlaps the first table row when many items are selected. Acceptable — the bar height is small (~32px) and the affordance is more valuable than the lost row.
- **Task 12 risk:** if any caller already supplies its own `id` field and reuses it across messages, dedup will silently drop legitimate repeats. Search for `sendSync({` invocations and confirm none pre-set `id` (current grep: zero matches; auto-assignment is the only path).
- **Task 13 risk:** the loading branch now renders two elements. The spinner is still centered because `flex-1` consumes the remaining space below the banner.

Rollback is per-task: each commit is independent. `git revert <hash>` restores the prior behavior for any task individually.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-12-admin-desktop-interface-design-p1p2-completion.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
