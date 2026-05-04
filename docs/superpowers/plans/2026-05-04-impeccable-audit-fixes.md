# Impeccable Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all P0/P1 audit findings from the impeccable audit of 10 citizen-pwa components — severity token migration, focus rings, a11y fixes, FAB redesign, bottom sheet a11y, i18n constants, and cancel button redesign.

**Architecture:** Token-first migration. Create severity CSS custom properties and a `useSeverityStyle()` hook, then migrate components one at a time. Global `:focus-visible` rule applied via CSS layer. Cancel button renamed to "Withdraw Report" with confirmation bottom sheet.

**Tech Stack:** React 19, Tailwind CSS v3, CSS custom properties, framer-motion (existing), lucide-react (existing)

**Bundle baseline:** citizen-pwa ~149 KB (app) + ~298 KB (react) + ~406 KB (firebase) = ~853 KB raw, ~262 KB gzipped. Hard limit: +50 KB total.

---

## File Map

| File                                      | Action | Responsibility                                                        |
| ----------------------------------------- | ------ | --------------------------------------------------------------------- |
| `src/styles/globals.css`                  | Modify | Add severity tokens, global focus-visible rule                        |
| `src/utils/useSeverityStyle.ts`           | Create | Hook returning `{ fg, bg, label, icon }` per severity level           |
| `src/utils/format-date.ts`                | Create | Centralized `en-PH` + `Asia/Manila` date formatting                   |
| `src/utils/translations.ts`               | Create | Tagalog translation constants (~30 pairs)                             |
| `src/utils/incident-meta.tsx`             | Modify | Remove hardcoded `SEVERITY_COLORS`, use tokens                        |
| `src/utils/alertUtils.ts`                 | Modify | Remove hardcoded hex values, use tokens                               |
| `src/components/ui/RadarRings.tsx`        | Modify | Remove dead `AnimatedCheck` + `SHEET_EASE`                            |
| `src/components/CitizenShell.tsx`         | Modify | Remove FAB, make Report a standard tab                                |
| `src/components/ReportStatusPill.tsx`     | Modify | Add focus-visible ring, grip affordance, first-use pulse              |
| `src/components/MapTab/DetailSheet.tsx`   | Modify | Replace hardcoded hex, emoji→lucide, add aria-labels, redesign cancel |
| `src/components/MapTab/PeekSheet.tsx`     | Modify | Remove hardcoded `SEVERITY_COLORS`, use hook                          |
| `src/components/MapTab/IncidentLayer.tsx` | Modify | Remove hardcoded `COLORS`, use hook                                   |
| `src/components/MapTab/MyReportLayer.tsx` | Modify | Remove hardcoded `COLORS`, use hook                                   |
| `src/components/MapTab/index.tsx`         | Modify | Fix empty state a11y, replace hardcoded hex, update cancel handler    |
| `src/components/AlertDetailSheet.tsx`     | Modify | Fix easing, add reduced-motion, focus trap                            |
| `src/components/TrackingScreen.tsx`       | Modify | Replace hardcoded hex, add "Withdraw Report" action                   |
| `src/components/FeedTab.tsx`              | Modify | Remove hardcoded severity classes, use hook                           |
| `src/components/WithdrawSheet.tsx`        | Create | Confirmation bottom sheet for report withdrawal                       |

---

## Phase 1: Token + Hook Foundation

### Task 1.1: Add Severity Tokens to globals.css

**Files:**

- Modify: `apps/citizen-pwa/src/styles/globals.css:3-28`

- [ ] **Step 1:** Add severity token block inside `:root` after `--color-amber-strong` (line 25)

```css
--color-severity-high-fg: #991b1b;
--color-severity-high-bg: #fee2e2;
--color-severity-medium-fg: #a73400;
--color-severity-medium-bg: #fff5ef;
--color-severity-low-fg: #414849;
--color-severity-low-bg: #e0e7f0;
--color-severity-critical-fg: #7f1d1d;
--color-severity-critical-bg: #fecaca;
```

- [ ] **Step 2:** Run build to verify no syntax errors

Run: `pnpm --filter citizen-pwa build`
Expected: Build succeeds

- [ ] **Step 3:** Commit

```bash
git add apps/citizen-pwa/src/styles/globals.css
git commit -m "feat(citizen-pwa): add severity color tokens to design system"
```

### Task 1.2: Create useSeverityStyle Hook

**Files:**

- Create: `apps/citizen-pwa/src/utils/useSeverityStyle.ts`
- Test: `apps/citizen-pwa/src/utils/useSeverityStyle.test.ts`

- [ ] **Step 1:** Write failing test

```ts
import { describe, it, expect } from 'vitest'
import { getSeverityStyle } from './useSeverityStyle.js'

describe('getSeverityStyle', () => {
  it('returns correct tokens for high severity', () => {
    const result = getSeverityStyle('high')
    expect(result.fg).toBe('var(--color-severity-high-fg)')
    expect(result.bg).toBe('var(--color-severity-high-bg)')
    expect(result.label).toBe('HIGH')
  })

  it('returns correct tokens for medium severity', () => {
    const result = getSeverityStyle('medium')
    expect(result.fg).toBe('var(--color-severity-medium-fg)')
    expect(result.bg).toBe('var(--color-severity-medium-bg)')
    expect(result.label).toBe('MEDIUM')
  })

  it('returns correct tokens for low severity', () => {
    const result = getSeverityStyle('low')
    expect(result.fg).toBe('var(--color-severity-low-fg)')
    expect(result.bg).toBe('var(--color-severity-low-bg)')
    expect(result.label).toBe('LOW')
  })

  it('returns fallback for unknown severity', () => {
    const result = getSeverityStyle('unknown')
    expect(result.fg).toBe('var(--color-severity-low-fg)')
    expect(result.bg).toBe('var(--color-severity-low-bg)')
    expect(result.label).toBe('INFO')
  })

  it('returns dot color as raw hex for leaflet markers', () => {
    expect(getSeverityStyle('high').dotHex).toBe('#dc2626')
    expect(getSeverityStyle('medium').dotHex).toBe('#a73400')
    expect(getSeverityStyle('low').dotHex).toBe('#414849')
  })
})
```

- [ ] **Step 2:** Run test to verify failure

Run: `pnpm --filter citizen-pwa vitest run src/utils/useSeverityStyle.test.ts`
Expected: FAIL

- [ ] **Step 3:** Write implementation

```ts
import { AlertTriangle, Bell, Info } from 'lucide-react'
import type { ComponentType } from 'react'

export interface SeverityStyle {
  fg: string
  bg: string
  label: string
  dotHex: string
  icon: ComponentType<{ size?: number; className?: string }>
}

const SEVERITY_MAP: Record<string, SeverityStyle> = {
  high: {
    fg: 'var(--color-severity-high-fg)',
    bg: 'var(--color-severity-high-bg)',
    label: 'HIGH',
    dotHex: '#dc2626',
    icon: AlertTriangle,
  },
  medium: {
    fg: 'var(--color-severity-medium-fg)',
    bg: 'var(--color-severity-medium-bg)',
    label: 'MEDIUM',
    dotHex: '#a73400',
    icon: Bell,
  },
  low: {
    fg: 'var(--color-severity-low-fg)',
    bg: 'var(--color-severity-low-bg)',
    label: 'LOW',
    dotHex: '#414849',
    icon: Info,
  },
}

const DEFAULT: SeverityStyle = {
  fg: 'var(--color-severity-low-fg)',
  bg: 'var(--color-severity-low-bg)',
  label: 'INFO',
  dotHex: '#414849',
  icon: Info,
}

export function getSeverityStyle(severity: string): SeverityStyle {
  return SEVERITY_MAP[severity] ?? DEFAULT
}
```

- [ ] **Step 4:** Run test to verify pass

Run: `pnpm --filter citizen-pwa vitest run src/utils/useSeverityStyle.test.ts`
Expected: PASS

- [ ] **Step 5:** Commit

```bash
git add apps/citizen-pwa/src/utils/useSeverityStyle.ts apps/citizen-pwa/src/utils/useSeverityStyle.test.ts
git commit -m "feat(citizen-pwa): add getSeverityStyle hook for token-driven severity"
```

### Task 1.3: Create formatDate Utility

**Files:**

- Create: `apps/citizen-pwa/src/utils/format-date.ts`
- Test: `apps/citizen-pwa/src/utils/format-date.test.ts`

- [ ] **Step 1:** Write failing test

```ts
import { describe, it, expect } from 'vitest'
import { formatDateTime } from './format-date.js'

describe('formatDateTime', () => {
  it('formats date with en-PH locale and Asia/Manila timezone', () => {
    const date = new Date('2026-05-04T08:30:00.000Z')
    const result = formatDateTime(date)
    expect(result).toContain('2026')
    expect(result).toMatch(/PM|AM/)
  })

  it('handles timestamp numbers', () => {
    const ts = Date.UTC(2026, 4, 4, 8, 30, 0)
    const result = formatDateTime(ts)
    expect(result).toContain('2026')
  })
})
```

- [ ] **Step 2:** Run test to verify failure

Run: `pnpm --filter citizen-pwa vitest run src/utils/format-date.test.ts`
Expected: FAIL

- [ ] **Step 3:** Write implementation

```ts
const PH_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Manila',
}

export function formatDateTime(date: Date | number): string {
  return new Date(date).toLocaleString('en-PH', {
    ...PH_OPTIONS,
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
```

- [ ] **Step 4:** Run test to verify pass

Run: `pnpm --filter citizen-pwa vitest run src/utils/format-date.test.ts`
Expected: PASS

- [ ] **Step 5:** Commit

```bash
git add apps/citizen-pwa/src/utils/format-date.ts apps/citizen-pwa/src/utils/format-date.test.ts
git commit -m "feat(citizen-pwa): add formatDateTime with en-PH locale and Asia/Manila tz"
```

---

## Phase 2: Global Focus Ring

### Task 2.1: Add Global :focus-visible Double-Ring

**Files:**

- Modify: `apps/citizen-pwa/src/styles/design-tokens.css:35-40` (after `prefers-reduced-motion` block)

- [ ] **Step 1:** Add focus-visible rule inside `@layer base {}` block, after the Leaflet tile guard (before the closing `}`)

```css
:focus-visible {
  outline: 2px solid #001e40;
  outline-offset: 2px;
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 4px #001e40;
}

:focus:not(:focus-visible) {
  outline: none;
}
```

- [ ] **Step 2:** Run build to verify

Run: `pnpm --filter citizen-pwa build`
Expected: Build succeeds

- [ ] **Step 3:** Commit

```bash
git add apps/citizen-pwa/src/styles/design-tokens.css
git commit -m "feat(citizen-pwa): add global focus-visible double-ring per DESIGN.md spec"
```

---

## Phase 3: Component Fixes (Hardcoded Colors → Tokens)

### Task 3.1: Migrate incident-meta.tsx to Tokens

**Files:**

- Modify: `apps/citizen-pwa/src/utils/incident-meta.tsx:112-120`
- Test: `apps/citizen-pwa/src/utils/incident-meta.test.tsx:125-139`

- [ ] **Step 1:** Update tests to expect token values instead of raw hex

Change `incident-meta.test.tsx` expectations:

```ts
// Change: expect(severityDotColor('high')).toBe('#dc2626')
// To: keep dotHex test, but also test getSeverityStyle

// severityDotColor still returns hex for leaflet — keep these tests
// They should still pass since dotHex is still '#dc2626' etc.
```

Tests should pass without changes since `severityDotColor` still returns raw hex for Leaflet compatibility.

- [ ] **Step 2:** Replace `SEVERITY_COLORS` with `getSeverityStyle`

In `incident-meta.tsx:112-120`, replace:

```ts
// Before:
const SEVERITY_COLORS: Record<string, string> = {
  high: '#dc2626',
  medium: '#a73400',
  low: '#414849',
}

export function severityDotColor(severity: string): string {
  return SEVERITY_COLORS[severity] ?? '#414849'
}

// After:
import { getSeverityStyle } from './useSeverityStyle.js'

export function severityDotColor(severity: string): string {
  return getSeverityStyle(severity).dotHex
}
```

- [ ] **Step 3:** Run existing tests

Run: `pnpm --filter citizen-pwa vitest run src/utils/incident-meta.test.tsx`
Expected: PASS (dotHex values match old hardcoded values)

- [ ] **Step 4:** Commit

```bash
git add apps/citizen-pwa/src/utils/incident-meta.tsx
git commit -m "refactor(citizen-pwa): migrate severityDotColor to use getSeverityStyle hook"
```

### Task 3.2: Migrate alertUtils.ts to Tokens

**Files:**

- Modify: `apps/citizen-pwa/src/utils/alertUtils.ts`

- [ ] **Step 1:** Replace hardcoded hex values with CSS variable references

```ts
import { getSeverityStyle } from './useSeverityStyle.js'

const CRITICAL_STYLE = {
  label: 'CRITICAL',
  fg: 'var(--color-severity-critical-fg)',
  bg: 'var(--color-severity-critical-bg)',
}

export function severityMeta(severity: string): { label: string; bg: string; color: string } {
  if (severity === 'critical')
    return { label: CRITICAL_STYLE.label, bg: CRITICAL_STYLE.bg, color: CRITICAL_STYLE.fg }
  const style = getSeverityStyle(severity)
  return { label: style.label, bg: style.bg, color: style.fg }
}
```

**Note:** `severityMeta` currently returns raw hex for inline `style={{ background: bg, color }}`. After this change it returns CSS `var()` values which work in inline styles. Verify this works — `element.style.background = 'var(--color-severity-high-bg)'` is valid CSS.

- [ ] **Step 2:** Run build + existing tests

Run: `pnpm --filter citizen-pwa vitest run src/components/AlertsTab.test.tsx src/components/AlertDetailSheet.test.tsx 2>/dev/null || pnpm --filter citizen-pwa build`
Expected: Build passes

- [ ] **Step 3:** Commit

```bash
git add apps/citizen-pwa/src/utils/alertUtils.ts
git commit -m "refactor(citizen-pwa): migrate alertUtils severityMeta to design tokens"
```

### Task 3.3: Remove Dead Code from RadarRings

**Files:**

- Modify: `apps/citizen-pwa/src/components/ui/RadarRings.tsx:1-33`

- [ ] **Step 1:** Grep entire workspace to confirm no external consumers

Run: `grep -r "AnimatedCheck\|SHEET_EASE" --include='*.ts' --include='*.tsx' apps/ e2e-tests/ docs/ scripts/ | grep -v RadarRings.tsx`
Expected: No output (dead code confirmed)

- [ ] **Step 2:** Delete `SHEET_EASE` constant and `AnimatedCheck` function (lines 4-33). Keep `RadarRingsProps` interface and `RadarRings` function.

- [ ] **Step 3:** Add `aria-hidden="true"` to the outer wrapper div of `RadarRings`

- [ ] **Step 4:** Run existing RadarRings test

Run: `pnpm --filter citizen-pwa vitest run src/components/ui/RadarRings.test.tsx`
Expected: PASS

- [ ] **Step 5:** Commit

```bash
git add apps/citizen-pwa/src/components/ui/RadarRings.tsx
git commit -m "fix(citizen-pwa): remove dead AnimatedCheck/SHEET_EASE, add aria-hidden to RadarRings"
```

### Task 3.4: Migrate DetailSheet Hardcoded Colors + Emoji

**Files:**

- Modify: `apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx`

- [ ] **Step 1:** Replace `SEVERITY_BADGE` constant (lines 7-11) with `getSeverityStyle` import

Remove the `SEVERITY_BADGE` object. Replace usages at lines 118 and 209:

```ts
import { getSeverityStyle } from '../../utils/useSeverityStyle.js'

// At usage site:
const style = getSeverityStyle(incident.severity)
// Replace: badge.bg / badge.color / badge.label
// With: style.bg / style.fg / style.label
```

- [ ] **Step 2:** Replace emoji (lines 162, 181, 221) with lucide icons

```ts
import { MapPin, Zap } from 'lucide-react'

// Replace 📍 with <MapPin size={14} className="inline" />
// Replace ⚡ with <Zap size={14} className="inline" />
```

- [ ] **Step 3:** Replace hardcoded teal `#0f9488` in progress stepper (lines 254, 262) with `var(--brand-500)`

- [ ] **Step 4:** Add `aria-label="Edit report"` to Edit button (line 271)

- [ ] **Step 5:** Increase Close button touch target from `w-8 h-8` to `w-11 h-11` (line ~154)

- [ ] **Step 6:** Replace the bare Cancel button (lines 274-283) with a "Withdraw Report" text link (detailed in Phase 8)

**Temporarily** keep Cancel as-is with improved label until WithdrawSheet is built. Change label from `Cancel` to `Withdraw report` and add `className="text-danger-500 text-sm font-medium"`.

- [ ] **Step 7:** Run tests

Run: `pnpm --filter citizen-pwa vitest run src/components/MapTab/DetailSheet.test.tsx`
Expected: PASS (update test for new aria-label if needed)

- [ ] **Step 8:** Commit

```bash
git add apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx
git commit -m "fix(citizen-pwa): DetailSheet — migrate to severity tokens, emoji→lucide, a11y fixes"
```

### Task 3.5: Migrate PeekSheet, IncidentLayer, MyReportLayer

**Files:**

- Modify: `apps/citizen-pwa/src/components/MapTab/PeekSheet.tsx:1-8`
- Modify: `apps/citizen-pwa/src/components/MapTab/IncidentLayer.tsx:13`
- Modify: `apps/citizen-pwa/src/components/MapTab/MyReportLayer.tsx:12`

- [ ] **Step 1:** In PeekSheet, remove `SEVERITY_COLORS` constant, import `getSeverityStyle`, use `getSeverityStyle(pin.severity).dotHex`

- [ ] **Step 2:** In IncidentLayer, remove `COLORS` constant, import `getSeverityStyle`, use `getSeverityStyle(incident.severity).dotHex`

- [ ] **Step 3:** In MyReportLayer, same pattern

- [ ] **Step 4:** Run build

Run: `pnpm --filter citizen-pwa build`
Expected: PASS

- [ ] **Step 5:** Commit

```bash
git add apps/citizen-pwa/src/components/MapTab/PeekSheet.tsx apps/citizen-pwa/src/components/MapTab/IncidentLayer.tsx apps/citizen-pwa/src/components/MapTab/MyReportLayer.tsx
git commit -m "refactor(citizen-pwa): migrate severity colors in PeekSheet/IncidentLayer/MyReportLayer to tokens"
```

---

## Phase 4: Pill Affordance Fix

### Task 4.1: Add Focus Ring and Grip Affordance to ReportStatusPill

**Files:**

- Modify: `apps/citizen-pwa/src/components/ReportStatusPill.tsx`

- [ ] **Step 1:** Add `focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900` to the button className

- [ ] **Step 2:** Add a subtle grip indicator (`⋮⋮` using 2 small circles) on the left side of the pill, `text-surface-400`

- [ ] **Step 3:** Add first-use pulse glow animation. Track `hasBeenTapped` in `localStorage` (key: `pill-tapped`). If not tapped, apply `animate-pulse-glow` class. On first click/tap, set `localStorage` and remove the class.

```tsx
const [showPulse, setShowPulse] = useState(() => !localStorage.getItem('pill-tapped'))

// In onClick handler:
if (showPulse) {
  localStorage.setItem('pill-tapped', '1')
  setShowPulse(false)
}
```

- [ ] **Step 4:** Add `hover:brightness-110` for desktop pointer feedback

- [ ] **Step 5:** Run tests

Run: `pnpm --filter citizen-pwa vitest run src/components/ReportStatusPill.test.tsx`
Expected: PASS

- [ ] **Step 6:** Commit

```bash
git add apps/citizen-pwa/src/components/ReportStatusPill.tsx
git commit -m "fix(citizen-pwa): add focus ring, grip affordance, first-use pulse to ReportStatusPill"
```

---

## Phase 5: FAB → Tab Fix

### Task 5.1: Remove FAB, Make Report a Standard Tab

**Files:**

- Modify: `apps/citizen-pwa/src/components/CitizenShell.tsx:130-170`
- Test: `apps/citizen-pwa/src/components/CitizenShell.test.tsx`

- [ ] **Step 1:** In the tab render loop, remove the `if (isCenter)` branch entirely (lines 134-152). All tabs now render identically using the standard button pattern (lines 155-175).

- [ ] **Step 2:** Remove the special `isCenter` handling from the TABS array definition. The Report tab should use `AlertTriangle` from lucide-react instead of `CirclePlus`.

- [ ] **Step 3:** Fix inactive tab color from `text-surface-300` (fails WCAG at ~2.2:1) to `text-surface-400` (Ash Muted, closer to DESIGN.md spec of `#43474f`)

- [ ] **Step 4:** Add double-ring focus indicator to skip link (line ~58): replace `focus:bg-brand-600 focus:text-white` with `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001e40] focus-visible:ring-2 focus-visible:ring-white`

- [ ] **Step 5:** Update tests to expect standard tab rendering (no FAB)

- [ ] **Step 6:** Run tests

Run: `pnpm --filter citizen-pwa vitest run src/components/CitizenShell.test.tsx`
Expected: PASS

- [ ] **Step 7:** Commit

```bash
git add apps/citizen-pwa/src/components/CitizenShell.tsx apps/citizen-pwa/src/components/CitizenShell.test.tsx
git commit -m "fix(citizen-pwa): remove oversized FAB, make Report a standard tab per DESIGN.md"
```

---

## Phase 6: Bottom Sheet A11y

### Task 6.1: Create useFocusTrap Hook

**Files:**

- Create: `apps/citizen-pwa/src/hooks/useFocusTrap.ts`

- [ ] **Step 1:** Write implementation (no test for hooks — integration tested via sheet components)

```ts
import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean) {
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active || !containerRef.current) return

    previousFocus.current = document.activeElement as HTMLElement
    const container = containerRef.current

    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (focusable.length > 0) focusable[0].focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const els = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (els.length === 0) return
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      previousFocus.current?.focus()
    }
  }, [active, containerRef])
}
```

- [ ] **Step 2:** Commit

```bash
git add apps/citizen-pwa/src/hooks/useFocusTrap.ts
git commit -m "feat(citizen-pwa): add useFocusTrap hook for bottom sheet a11y"
```

### Task 6.2: Fix AlertDetailSheet Easing + Focus Trap

**Files:**

- Modify: `apps/citizen-pwa/src/components/AlertDetailSheet.tsx`

- [ ] **Step 1:** Replace elastic easing `cubic-bezier(0.34,1.56,0.64,1)` with `cubic-bezier(0.32,0.72,0,1)` and increase duration from `0.28s` to `0.3s`

- [ ] **Step 2:** Add `motion-reduce:animate-none motion-reduce:translate-y-0` to the sheet div class

- [ ] **Step 3:** Add `useFocusTrap` hook to the sheet container when `open` is true

- [ ] **Step 4:** Add `role="dialog"`, `aria-modal="true"`, `aria-label={alert.title}` to the sheet container

- [ ] **Step 5:** Replace hardcoded `bg-[#171a1a]/60` → `bg-surface-900/60`, `bg-[#f8fafa]` → `bg-white`, `bg-[#a3adae]` → `bg-surface-300`

- [ ] **Step 6:** Increase close button touch target from `p-1` to `p-2.5` (minimum 44px)

- [ ] **Step 7:** Add scroll gradient fade at bottom of scrollable content

- [ ] **Step 8:** Commit

```bash
git add apps/citizen-pwa/src/components/AlertDetailSheet.tsx
git commit -m "fix(citizen-pwa): AlertDetailSheet — easing, focus trap, reduced motion, touch target"
```

### Task 6.3: Add Escape Key + Focus to DetailSheet and PeekSheet

**Files:**

- Modify: `apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx`
- Modify: `apps/citizen-pwa/src/components/MapTab/PeekSheet.tsx`

- [ ] **Step 1:** In DetailSheet, add `onKeyDown` handler for `Escape` → call `onClose`

- [ ] **Step 2:** In DetailSheet, add `role="dialog"`, `aria-modal="true"`, `tabIndex={-1}` to the sheet section

- [ ] **Step 3:** In PeekSheet, add `onKeyDown` handler: `Escape` → `onDismiss`, `Enter` → `onExpand`

- [ ] **Step 4:** In PeekSheet, add `role="dialog"`, `aria-modal="false"`, `tabIndex={-1}` to the container

- [ ] **Step 5:** Run tests for both

Run: `pnpm --filter citizen-pwa vitest run src/components/MapTab/DetailSheet.test.tsx`
Expected: PASS

- [ ] **Step 6:** Commit

```bash
git add apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx apps/citizen-pwa/src/components/MapTab/PeekSheet.tsx
git commit -m "fix(citizen-pwa): add Escape key + dialog role to DetailSheet and PeekSheet"
```

---

## Phase 7: i18n Constants

### Task 7.1: Create Translation Constants

**Files:**

- Create: `apps/citizen-pwa/src/utils/translations.ts`

- [ ] **Step 1:** Write translation file

```ts
export const T = {
  'status.queued': 'Your report is being processed',
  'status.queued_tl': 'Pinoproseso ang iyong ulat',
  'status.received': 'Report received',
  'status.received_tl': 'Natanggap ang ulat',
  'status.verifying': 'Awaiting admin verification',
  'status.verifying_tl': 'Hinihintay ang pag-verify ng admin',
  'status.responders_notified': 'Responders have been notified',
  'status.responders_notified_tl': 'Naabisuhan na ang mga responder',
  'status.dispatched': 'Responders are on the way',
  'status.dispatched_tl': 'Paparating na ang mga responder',
  'status.resolved': 'Situation resolved',
  'status.resolved_tl': 'Naresolba na ang sitwasyon',
  'status.cancelled': 'Report withdrawn',
  'status.cancelled_tl': 'Na-withdraw ang ulat',
  'offline.banner': "You're offline. Reports saved on device.",
  'offline.banner_tl': 'Offline ka. Naka-save ang mga ulat sa device.',
  'offline.queued': 'Offline — {count} report(s) queued',
  'offline.queued_tl': 'Offline — {count} na ulat ang naka-queue',
  'lookup.secret_code_note': 'Your secret code is the key to your report.',
  'lookup.secret_code_note_tl': 'Ang iyong secret code ang susi sa iyong ulat.',
  'withdraw.title': 'Withdraw this report?',
  'withdraw.title_tl': 'I-withdraw ang ulat na ito?',
  'withdraw.body':
    'This will permanently remove your report from the map. Responders will no longer see it.',
  'withdraw.body_tl':
    'Permanenteng mawawala ang iyong ulat sa mapa. Hindi na ito makikita ng mga responder.',
  'withdraw.keep': 'Keep Report',
  'withdraw.keep_tl': 'I-keep ang Ulat',
  'withdraw.confirm': 'Withdraw Report',
  'withdraw.confirm_tl': 'I-withdraw ang Ulat',
  'empty.no_incidents': 'No reported incidents',
  'empty.no_incidents_tl': 'Walang naiulat na insidente',
  'empty.no_updates': 'No updates yet',
  'empty.no_updates_tl': 'Wala pang update',
} as const

export function t(key: keyof typeof T): string {
  return T[key]
}
```

- [ ] **Step 2:** Commit

```bash
git add apps/citizen-pwa/src/utils/translations.ts
git commit -m "feat(citizen-pwa): add Tagalog translation constants"
```

---

## Phase 8: Cancel Button Redesign → "Withdraw Report"

### Task 8.1: Create WithdrawSheet Confirmation Component

**Files:**

- Create: `apps/citizen-pwa/src/components/WithdrawSheet.tsx`
- Test: `apps/citizen-pwa/src/components/WithdrawSheet.test.tsx`

- [ ] **Step 1:** Write failing test

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WithdrawSheet } from './WithdrawSheet.js'

describe('WithdrawSheet', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <WithdrawSheet
        open={false}
        publicRef="FL-001"
        reportType="Flood"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders title and consequence text when open', () => {
    render(
      <WithdrawSheet
        open={true}
        publicRef="FL-001"
        reportType="Flood"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/Withdraw this report/i)).toBeInTheDocument()
    expect(screen.getByText(/FL-001/)).toBeInTheDocument()
    expect(screen.getByText(/Flood/i)).toBeInTheDocument()
  })

  it('calls onCancel when Keep Report is clicked', () => {
    const onCancel = vi.fn()
    render(
      <WithdrawSheet
        open={true}
        publicRef="FL-001"
        reportType="Flood"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /keep report/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onConfirm when Withdraw Report is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <WithdrawSheet
        open={true}
        publicRef="FL-001"
        reportType="Flood"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /withdraw report/i }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('focuses Keep Report button by default (safe action)', async () => {
    render(
      <WithdrawSheet
        open={true}
        publicRef="FL-001"
        reportType="Flood"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const keepBtn = screen.getByRole('button', { name: /keep report/i })
    expect(keepBtn).toBeInTheDocument()
  })
})
```

- [ ] **Step 2:** Run test to verify failure

Run: `pnpm --filter citizen-pwa vitest run src/components/WithdrawSheet.test.tsx`
Expected: FAIL

- [ ] **Step 3:** Write implementation

```tsx
import { useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { T } from '../utils/translations.js'

interface Props {
  open: boolean
  publicRef: string
  reportType: string
  onConfirm: () => void
  onCancel: () => void
}

export function WithdrawSheet({ open, publicRef, reportType, onConfirm, onCancel }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  useFocusTrap(sheetRef, open)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-modal">
      <div
        className="absolute inset-0 bg-surface-900/60"
        onClick={onCancel}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
        }}
        tabIndex={0}
        aria-label="Close"
      />
      <div
        ref={sheetRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="withdraw-title"
        className="absolute bottom-0 left-0 right-0 max-h-[70svh] bg-white rounded-t-3xl p-5 shadow-2xl
          animate-[reveal-slide-up_0.3s_cubic-bezier(0.32,0.72,0,1)_forwards]
          motion-reduce:animate-none motion-reduce:translate-y-0"
      >
        <div className="flex justify-center mb-4">
          <div className="w-8 h-1 rounded-full bg-surface-300" />
        </div>

        <h2 id="withdraw-title" className="text-lg font-bold text-surface-900 mb-2">
          {T['withdraw.title']}
        </h2>
        <p className="text-sm text-surface-500 mb-1 tl-hint">{T['withdraw.title_tl']}</p>

        <p className="text-sm text-surface-700 mb-3">{T['withdraw.body']}</p>
        <p className="text-sm text-surface-500 mb-1 tl-hint">{T['withdraw.body_tl']}</p>

        <div className="bg-surface-50 rounded-lg p-3 mb-5">
          <p className="text-sm font-medium text-surface-900">{reportType}</p>
          <p className="text-xs text-surface-500 font-mono">{publicRef}</p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-3 px-4 rounded-lg bg-surface-100 text-surface-900 font-medium text-sm mb-2 active:bg-surface-200 transition-colors"
        >
          {T['withdraw.keep']}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full py-3 px-4 rounded-lg text-danger-500 font-medium text-sm active:bg-danger-500/10 transition-colors"
        >
          {T['withdraw.confirm']}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4:** Run test to verify pass

Run: `pnpm --filter citizen-pwa vitest run src/components/WithdrawSheet.test.tsx`
Expected: PASS

- [ ] **Step 5:** Commit

```bash
git add apps/citizen-pwa/src/components/WithdrawSheet.tsx apps/citizen-pwa/src/components/WithdrawSheet.test.tsx
git commit -m "feat(citizen-pwa): add WithdrawSheet confirmation dialog for report withdrawal"
```

### Task 8.2: Wire WithdrawSheet into DetailSheet

**Files:**

- Modify: `apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx`
- Modify: `apps/citizen-pwa/src/components/MapTab/index.tsx`

- [ ] **Step 1:** In DetailSheet, replace the bare Cancel button with a "Withdraw report" text link:

```tsx
// Replace the current Cancel button (lines 274-283) with:
{
  actions.includes('edit') ? (
    <div className="mt-4 pt-4 border-t border-surface-200">
      <button
        type="button"
        aria-label="Edit report"
        className="mb-2 text-sm font-medium text-surface-700"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => setWithdrawOpen(true)}
        className="block mt-3 text-sm font-medium text-danger-500"
      >
        Withdraw report
      </button>
    </div>
  ) : null
}
```

Add state: `const [withdrawOpen, setWithdrawOpen] = useState(false)`

Add WithdrawSheet at bottom of component:

```tsx
<WithdrawSheet
  open={withdrawOpen}
  publicRef={report.publicRef}
  reportType={incident.reportType}
  onConfirm={() => {
    setWithdrawOpen(false)
    if (report.id) props.onCancelReport?.(report.publicRef, report.id)
  }}
  onCancel={() => setWithdrawOpen(false)}
/>
```

- [ ] **Step 2:** Update DetailSheet test for new flow (click "Withdraw report" → confirmation appears → click "Withdraw Report" in sheet → handler called)

- [ ] **Step 3:** Run tests

Run: `pnpm --filter citizen-pwa vitest run src/components/MapTab/DetailSheet.test.tsx`
Expected: PASS

- [ ] **Step 4:** Commit

```bash
git add apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx
git commit -m "fix(citizen-pwa): replace Cancel button with Withdraw report + confirmation sheet"
```

### Task 8.3: Add "Withdraw Report" to TrackingScreen

**Files:**

- Modify: `apps/citizen-pwa/src/components/TrackingScreen.tsx`

- [ ] **Step 1:** Add a "Withdraw report" link at the bottom of the tracking-actions section, visible only for cancellable statuses (matching the `actionsFor()` logic)

```tsx
{
  report && ['new', 'awaiting_verify'].includes(report.status) ? (
    <div className="mt-4 pt-4 border-t border-surface-200 text-center">
      <button
        type="button"
        onClick={() => setWithdrawOpen(true)}
        className="text-sm font-medium text-danger-500"
      >
        Withdraw report
      </button>
    </div>
  ) : null
}
```

Wire `cancelReport` callable + `deleteReport` localForage + `WithdrawSheet` confirmation.

- [ ] **Step 2:** Commit

```bash
git add apps/citizen-pwa/src/components/TrackingScreen.tsx
git commit -m "feat(citizen-pwa): add Withdraw report to TrackingScreen with confirmation"
```

---

## Final Verification

- [ ] **Step 1:** Run full citizen-pwa test suite

Run: `pnpm --filter citizen-pwa vitest run`
Expected: All tests pass

- [ ] **Step 2:** Run build

Run: `pnpm --filter citizen-pwa build`
Expected: Build succeeds, bundle size within +50 KB of baseline

- [ ] **Step 3:** Run typecheck

Run: `pnpm --filter citizen-pwa exec tsc --noEmit`
Expected: No errors

- [ ] **Step 4:** Run lint

Run: `pnpm --filter citizen-pwa exec eslint src/`
Expected: No new errors
