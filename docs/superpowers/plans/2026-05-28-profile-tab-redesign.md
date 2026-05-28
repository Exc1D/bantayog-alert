# Profile Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure ProfilePage to a stats-first layout with inline status control. Remove Resolved by Type (mastery bars) and Personal Bests sections.

**Architecture:** Single page component. Remove ~80 lines of TSX (two sections + mastery computation) and ~120 lines of CSS (mastery/record classes + standalone availabilityPanel). Move the existing segmented control inside the profileCard, after specializations and before statsRow.

**Tech Stack:** React, CSS Modules, Vitest

---

### Task 1: Remove mastery computation + Resolved by Type section from TSX

**Files:**

- Modify: `apps/responder-app/src/pages/ProfilePage.tsx`

- [ ] **Remove unused imports**

Remove from the import at line 11:

```ts
import { getReportTypeLabel, getResponderTypeLabel } from '../lib/incident-labels'
```

Change to:

```ts
import { getResponderTypeLabel } from '../lib/incident-labels'
```

- [ ] **Remove `getToneClass` helper function**

Remove lines 56-60 entirely:

```ts
function getToneClass(ratio: number, stylesMap: typeof styles): string {
  if (ratio >= 0.8) return stylesMap.masteryGreen ?? ''
  if (ratio >= 0.5) return stylesMap.masteryAmber ?? ''
  return stylesMap.masteryMuted ?? ''
}
```

- [ ] **Remove reportTypes state and related state vars**

Remove lines 86-89:

```ts
const [reportTypesById, setReportTypesById] = useState<Record<string, string>>({})
const reportIdsKey = history.map((row) => row.reportId).join('|')
const [loadedReportIdsKey, setLoadedReportIdsKey] = useState('')
const reportTypesLoaded = loadedReportIdsKey === reportIdsKey
```

- [ ] **Remove the entire useEffect for loading report types**

Remove lines 91-137 (from `useEffect(() => {` through the `// eslint-disable-next-line` comment and the closing `}, [reportIdsKey])`)

- [ ] **Remove mastery-only computed variables**

Remove these lines (they follow `mostDispatchesInWeek =` at line 157):

```ts
const reportTypeLookup = reportTypesLoaded ? reportTypesById : {}
const resolvedTypeCounts = completedRows.reduce<Record<string, number>>((acc, row) => {
  const type = reportTypeLookup[row.reportId] ?? 'other'
  acc[type] = (acc[type] ?? 0) + 1
  return acc
}, {})
const masterySourceRows = Object.entries(resolvedTypeCounts).sort((a, b) => {
  if (b[1] !== a[1]) return b[1] - a[1]
  return getReportTypeLabel(a[0]).localeCompare(getReportTypeLabel(b[0]))
})
const maxMasteryCount = masterySourceRows[0]?.[1] ?? 0
const countByType = new Map(masterySourceRows.map(([type, count]) => [type, count]))
const masteryRows =
  profile?.specializations != null && profile.specializations.length > 0
    ? profile.specializations.map((label) => {
        const matchingType =
          masterySourceRows.find(([type]) => getReportTypeLabel(type) === label)?.[0] ?? null
        return {
          label,
          count: matchingType !== null ? (countByType.get(matchingType) ?? 0) : 0,
        }
      })
    : masterySourceRows.map(([type, count]) => ({
        label: getReportTypeLabel(type),
        count,
      }))
```

- [ ] **Remove Resolved by Type section JSX**

Remove lines 310-346 (from `<div className={styles.sectionCard}>` with "Resolved by Type" through its closing `</div>`)

- [ ] **Remove Personal Bests section JSX**

Remove lines 348-366 (from `<div className={styles.sectionCard}>` with "Personal Bests" through its closing `</div>`)

- [ ] **Move availability panel inside profileCard**

Find the standalone availability panel JSX (lines 368-434, from `<div className={styles.availabilityPanel}>` through its closing `</div>`). Move it inside the `profileCard` div, after the `specializationsBlock` closing element and before the `statsRow` opening element. The new order inside `profileCard` > `profileInfo` should be:

```
identityRow
profileRole
specializationsBlock
SEGMENTED CONTROL (moved here)
statsRow
```

### Task 2: Remove mastery/record CSS + decommission standalone availabilityPanel

**Files:**

- Modify: `apps/responder-app/src/pages/ProfilePage.module.css`

- [ ] **Remove `.sectionCard` grouping from the `.profileCard, .availabilityPanel` rule**

Change lines 11-17 from:

```css
.profileCard,
.availabilityPanel {
  background: linear-gradient(180deg, var(--surface-elevated) 0%, rgba(22, 22, 16, 0.92) 100%);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
}
```

to:

```css
.profileCard {
  background: linear-gradient(180deg, var(--surface-elevated) 0%, rgba(22, 22, 16, 0.92) 100%);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
}
```

- [ ] **Remove the shared `.sectionCard, .linkList` rule, add card properties to `.linkList` directly**

Remove lines 19-24 (the shared rule). Then update `.linkList` at line 410 to include the card background/border/radius inline:

Add to the existing `.linkList` rule at line 410-413:

```css
.linkList {
  background: var(--surface-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

- [ ] **Remove `.sectionCard` rule**

Remove lines 174-179:

```css
.sectionCard {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
```

- [ ] **Remove `.sectionBody` rule**

Remove lines 181-185:

```css
.sectionBody {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
```

- [ ] **Remove `.sectionNote` rule**

Remove lines 187-191:

```css
.sectionNote {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}
```

- [ ] **Remove mastery CSS rules**

Remove lines 193-259 (from `.masteryList, .recordList` through `.masteryMuted`)

- [ ] **Remove `.recordList`, `.recordRow`, `.recordLabel`, `.recordValue`** — these were removed as part of the mastery/record block above

- [ ] **Check `.sectionHeader` usage** — confirm it's used for "Specializations" heading. Keep it.

- [ ] **Remove `.availabilityPanel` rule**

Replace lines 261-266:

```css
.availabilityPanel {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
```

with nothing (delete these lines).

- [ ] **Add spacing for segmented control inside profileCard**

The segmented control now lives inside profileInfo without a separate panel. Add top margin so it's visually separated from specializations. After the removal of `.availabilityPanel`, add:

```css
.segmentedControlWrapper {
  margin-top: var(--space-2);
}

.availabilityRow {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.statusDot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dotGreen {
  background: var(--green-success);
}

.dotAmber {
  background: var(--amber-accent);
}

.dotRed {
  background: var(--red-urgent);
}

.dotGray {
  background: var(--text-tertiary);
}

.statusLabel {
  font-weight: 700;
  font-size: var(--font-size-md);
  flex: 1;
  min-width: 0;
}
```

Note: The `availabilityRow`, `statusDot`, `dot*`, `statusLabel` classes remain unchanged from their current definitions — they're just not wrapped in `availabilityPanel` anymore.

- [ ] **Clean up responsive breakpoint**

The `@media (max-width: 520px)` block only needs `.profileCard` and `.segmentedControl` rules now (the `.sectionCard` rules it had are gone — nothing to clean since those rules were already on `.sectionCard` which is being removed).

No change needed — `.sectionCard` is being removed, and `sectionCard` responsive rules don't exist separately.

### Task 3: Update tests

**Files:**

- Modify: `apps/responder-app/src/pages/ProfilePage.test.tsx`

- [ ] **Update "renders the competence dashboard metrics" test**

Current test (lines 231-295) checks for:

```
- "4" (total dispatches)
- "75%" (completion rate)
- "11m 20s" (avg response time)
- "resolved by type" (REMOVED)
- "Water Rescue" (STAYS as chip)
- "Structure Fire" (STAYS as chip)
- "0 resolved" (REMOVED)
- "fastest response" (REMOVED)
- "most dispatches in a week" (REMOVED)
- "longest availability streak" (already NOT present check)
```

Replace lines 287-295 with:

````ts
    expect(screen.getByText(/water rescue/i)).toBeInTheDocument()
    expect(screen.getByText(/structure fire/i)).toBeInTheDocument()
    expect(screen.queryByText(/resolved by type/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/personal bests/i)).not.toBeInTheDocument()
})

- [ ] **Verify all other tests still pass**

The remaining tests check:
- Name fallback (auth vs Firestore) — unchanged
- "Total Dispatches" label — unchanged
- Non-available status requires reason — unchanged (segmented control still renders)
- Available status immediate set — unchanged
- Sign out flow — unchanged
- Loading state — unchanged
- N/A for stats while loading — unchanged
- Completion rate — unchanged

### Task 4: Verify build

- [ ] **Run typecheck**
```bash
pnpm --filter @bantayog/responder-app typecheck
````

- [ ] **Run tests**

```bash
pnpm --dir apps/responder-app exec vitest run src/pages/ProfilePage.test.tsx src/pages/ProfilePage.specializations.test.tsx
```

- [ ] **Run full test suite**

```bash
pnpm --dir apps/responder-app exec vitest run
```

- [ ] **Fix any issues and re-run**
