# Responder App Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the responder PWA visual system and field workflow UI around warm-black operational clarity, dispatch progress rings, offline-safe transitions, responder competence feedback, and smartphone-first touch ergonomics.

**Architecture:** Keep all changes client-side inside `apps/responder-app`. Add small focused presentation/state modules instead of widening page components: ring math, offline transition queue, field-note drafts, profile metrics, onboarding state, and mission-summary derivation. Reuse existing Firebase hooks and dispatch callables; do not change backend schemas, Firebase rules, or Cloud Functions.

**Tech Stack:** React 19, React Router 7, Vite 8, TypeScript strict mode, CSS Modules, Vitest + Testing Library, Firebase JS SDK, React Leaflet, Lucide React, `localforage` for offline client state.

---

## Recon Summary

Read during plan creation:

- `package.json`
- `apps/responder-app/package.json`
- `.claude/worktrees/feature-responder-app-redesign/docs/superpowers/specs/2026-05-13-responder-app-redesign.md`
- `apps/responder-app/src/routes.tsx`
- `apps/responder-app/src/App.tsx`
- `apps/responder-app/src/components/Shell.tsx`
- `apps/responder-app/src/pages/DispatchListPage.tsx`
- `apps/responder-app/src/pages/DispatchDetailPage.tsx`
- `apps/responder-app/src/components/Shell.test.tsx`
- `apps/responder-app/src/pages/DispatchListPage.test.tsx`
- `docs/learnings.md`
- `docs/progress.md`

Findings:

- Current responder app still has 4 tab routes: Dispatches, Map, Messages, Profile. The spec requires 3 tabs and excludes Messages from the main shell.
- Existing page components use CSS Modules and page-local module files; keep that convention.
- Existing `DispatchListPage` already auto-navigates when exactly one active dispatch exists; preserve that behavior.
- Existing `DispatchDetailPage` owns action flows, auto-acknowledgement, geolocation distance, field notes, terminal surfaces, and several emoji labels that must be replaced with Lucide icons.
- `MapPage` already uses `L.divIcon`, GPS pause/resume on `visibilitychange`, and OpenStreetMap tiles; switch tiles and styling, do not rewrite the GPS lifecycle.
- `localforage` exists elsewhere in the monorepo and is in the lockfile, but `apps/responder-app/package.json` does not currently declare it. Add it explicitly before using it in responder code.
- `LEAN-CTX.md` referenced by `AGENTS.md` was not present at repo root during recon.
- localForage official docs confirm the async Promise API, `createInstance`, and configuration-before-use requirement. Source: https://github.com/localForage/localForage

Verification baseline before starting implementation:

```bash
pnpm --dir apps/responder-app exec vitest run
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
```

Expected: current baseline passes before feature work begins. If it fails, stop and fix or document pre-existing failures before editing.

---

## File Structure

Create:

- `apps/responder-app/src/styles/design-tokens.css` — responder palette, elevation, motion, and touch-token custom properties.
- `apps/responder-app/src/components/DispatchRing.tsx` — reusable SVG ring for countdown and progress states.
- `apps/responder-app/src/components/DispatchRing.module.css` — ring layout and reduced-motion static rendering.
- `apps/responder-app/src/components/DispatchRing.test.tsx` — ring math and ARIA coverage.
- `apps/responder-app/src/components/OnboardingOverlay.tsx` — one-card first-run explanation.
- `apps/responder-app/src/components/OnboardingOverlay.module.css` — overlay styling.
- `apps/responder-app/src/components/OnboardingOverlay.test.tsx` — sessionStorage one-time behavior.
- `apps/responder-app/src/components/FloatingSosFab.tsx` — bottom-right SOS shortcut for active dispatch detail.
- `apps/responder-app/src/components/FloatingSosFab.module.css` — 48px thumb-zone FAB styles.
- `apps/responder-app/src/lib/dispatch-progress.ts` — status-to-progress, step labels, next-action labels, and ring helper functions.
- `apps/responder-app/src/lib/dispatch-progress.test.ts` — pure progress mapping tests.
- `apps/responder-app/src/lib/profile-metrics.ts` — resolution rate, response-time averages, specialization bars, and personal bests.
- `apps/responder-app/src/lib/profile-metrics.test.ts` — derived metric tests.
- `apps/responder-app/src/lib/mission-summary.ts` — post-resolution time breakdown and personal-record comparison.
- `apps/responder-app/src/lib/mission-summary.test.ts` — mission summary tests.
- `apps/responder-app/src/lib/offline-transitions.ts` — localForage-backed queue persistence and retry bookkeeping.
- `apps/responder-app/src/lib/offline-transitions.test.ts` — queue persistence, ordering, retry cap, conflict removal tests.
- `apps/responder-app/src/hooks/useOfflineTransitions.ts` — online/foreground queue drain orchestration.
- `apps/responder-app/src/hooks/useOfflineTransitions.test.tsx` — hook-level drain tests.
- `apps/responder-app/src/hooks/useFieldNoteDraft.ts` — localForage-backed debounced field-note draft.
- `apps/responder-app/src/hooks/useFieldNoteDraft.test.tsx` — draft restore, debounce save, clear tests.
- `apps/responder-app/src/pages/MissionCompletePage.tsx` — post-dispatch summary surface.
- `apps/responder-app/src/pages/MissionCompletePage.module.css` — summary styling.
- `apps/responder-app/src/pages/MissionCompletePage.test.tsx` — route/page behavior.

Modify:

- `apps/responder-app/package.json` — add `localforage` dependency.
- `apps/responder-app/src/main.tsx` or app CSS import site — ensure design tokens load before globals if current entrypoint imports only `globals.css`.
- `apps/responder-app/src/styles/globals.css` — warm-black base, focus, reduced-motion, no navy palette.
- `apps/responder-app/src/routes.tsx` — remove Messages from tab routes if product confirms spec authority; add mission summary route.
- `apps/responder-app/src/routes.test.tsx` — reflect 3-tab shell and mission summary route.
- `apps/responder-app/src/App.tsx` — mount offline transition provider if queue drain is global.
- `apps/responder-app/src/components/Shell.tsx`
- `apps/responder-app/src/components/Shell.module.css`
- `apps/responder-app/src/components/Shell.test.tsx`
- `apps/responder-app/src/components/SosHoldButton.tsx`
- `apps/responder-app/src/components/SosHoldButton.module.css`
- `apps/responder-app/src/components/SosHoldButton.test.tsx`
- `apps/responder-app/src/components/AcceptanceCountdown.tsx`
- `apps/responder-app/src/components/AcceptanceCountdown.test.tsx`
- `apps/responder-app/src/pages/DispatchListPage.tsx`
- `apps/responder-app/src/pages/DispatchListPage.module.css`
- `apps/responder-app/src/pages/DispatchListPage.test.tsx`
- `apps/responder-app/src/pages/DispatchDetailPage.tsx`
- `apps/responder-app/src/pages/DispatchDetailPage.module.css`
- `apps/responder-app/src/pages/DispatchDetailPage.test.tsx`
- `apps/responder-app/src/pages/MapPage.tsx`
- `apps/responder-app/src/pages/MapPage.module.css`
- `apps/responder-app/src/pages/MapPage.test.tsx`
- `apps/responder-app/src/pages/ProfilePage.tsx`
- `apps/responder-app/src/pages/ProfilePage.module.css`
- `apps/responder-app/src/pages/ProfilePage.test.tsx`
- `apps/responder-app/src/pages/ProfilePage.specializations.test.tsx`
- `apps/responder-app/src/pages/SosPage.tsx`
- `apps/responder-app/src/pages/SosPage.module.css`
- `apps/responder-app/src/pages/SosPage.test.tsx`
- `apps/responder-app/src/pages/BackupRequestPage.tsx`
- `apps/responder-app/src/pages/BackupRequestPage.module.css`
- `apps/responder-app/src/pages/BackupRequestPage.test.tsx`
- `apps/responder-app/src/pages/DispatchHistoryPage.tsx`
- `apps/responder-app/src/pages/DispatchHistoryPage.module.css`
- `apps/responder-app/src/pages/DispatchHistoryPage.test.tsx`
- `apps/responder-app/src/pages/ShiftHandoffPage.tsx`
- `apps/responder-app/src/pages/ShiftHandoffPage.module.css`
- `apps/responder-app/src/pages/ShiftHandoffPage.test.tsx`
- `apps/responder-app/src/pages/ResponderWitnessReportPage.tsx`
- `apps/responder-app/src/pages/ResponderWitnessReportPage.test.tsx`
- `apps/responder-app/src/pages/LoginPage.tsx`
- `apps/responder-app/src/pages/LoginPage.module.css`
- `apps/responder-app/src/pages/LoginPage.test.tsx`
- `apps/responder-app/src/pages/TotpEnrollmentPage.tsx`
- `apps/responder-app/src/pages/TotpEnrollmentPage.module.css`
- `apps/responder-app/src/pages/TotpEnrollmentPage.test.tsx`
- `apps/responder-app/src/pages/TotpGuard.module.css`
- `apps/responder-app/src/pages/CancelledScreen.tsx`
- `apps/responder-app/src/pages/RaceLossScreen.tsx`
- `apps/responder-app/src/pages/TerminalScreen.module.css`
- `docs/learnings.md`
- `docs/progress.md`

Do not modify:

- `infra/firebase/firestore.rules`
- `infra/firebase/database.rules.json`
- `infra/firebase/storage.rules`
- `infra/firebase/firestore.indexes.json`
- `functions/src/**`
- `packages/shared-validators/src/**`

---

## Implementation Tasks

### Task 1: Add Design Tokens And Warm-Black Base

**Files:**

- Create: `apps/responder-app/src/styles/design-tokens.css`
- Modify: `apps/responder-app/src/styles/globals.css`
- Modify: `apps/responder-app/src/main.tsx`
- Test: `apps/responder-app/src/App.test.tsx`

- [ ] **Step 1: Write the failing token smoke test**

Add this test to `apps/responder-app/src/App.test.tsx`:

```tsx
it('loads responder design token stylesheet before app render', async () => {
  const mainSource = await import('./main.tsx?raw')
  expect(mainSource.default).toContain('./styles/design-tokens.css')
  expect(mainSource.default.indexOf('./styles/design-tokens.css')).toBeLessThan(
    mainSource.default.indexOf('./styles/globals.css'),
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/App.test.tsx -t "loads responder design token stylesheet"
```

Expected: FAIL because `design-tokens.css` does not exist or is not imported before `globals.css`.

- [ ] **Step 3: Create design tokens**

Create `apps/responder-app/src/styles/design-tokens.css`:

```css
:root {
  --bg-black: #0d0c08;
  --surface-elevated: #161610;
  --surface-raised: #1c1c16;
  --border-default: #292920;
  --amber-accent: #f59e0b;
  --red-urgent: #dc2626;
  --green-success: #22c55e;
  --blue-responder: #3b82f6;
  --text-primary: #f5f5f5;
  --text-secondary: #a3a3a3;
  --text-tertiary: #525252;
  --motion-standard: cubic-bezier(0, 0, 0.2, 1);
  --touch-target-min: 44px;
}
```

- [ ] **Step 4: Import tokens before globals**

Modify `apps/responder-app/src/main.tsx` so stylesheet imports are ordered:

```tsx
import './styles/design-tokens.css'
import './styles/globals.css'
```

- [ ] **Step 5: Update global base styles**

In `apps/responder-app/src/styles/globals.css`, ensure these rules exist and remove conflicting navy body/app backgrounds:

```css
html,
body,
#root {
  min-height: 100%;
  margin: 0;
}

body {
  background: var(--bg-black);
  color: var(--text-primary);
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}

button,
input,
select,
textarea {
  font: inherit;
}

:focus-visible {
  outline: 2px solid var(--amber-accent);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 1ms !important;
  }
}
```

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/App.test.tsx -t "loads responder design token stylesheet"
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
```

Expected: PASS, typecheck clean, lint clean.

- [ ] **Step 7: Commit**

```bash
git add apps/responder-app/src/styles/design-tokens.css apps/responder-app/src/styles/globals.css apps/responder-app/src/main.tsx apps/responder-app/src/App.test.tsx
git commit -m "style(responder): add warm-black design tokens"
```

### Task 2: Convert Shell To Three-Tab Operational Navigation

**Files:**

- Modify: `apps/responder-app/src/components/Shell.tsx`
- Modify: `apps/responder-app/src/components/Shell.module.css`
- Modify: `apps/responder-app/src/components/Shell.test.tsx`
- Modify: `apps/responder-app/src/routes.tsx`
- Modify: `apps/responder-app/src/routes.test.tsx`

- [ ] **Step 1: Write failing Shell tests**

Replace the tab-count test in `apps/responder-app/src/components/Shell.test.tsx` with:

```tsx
it('renders 3 operational tabs with labels and no messages tab', () => {
  render(
    <MemoryRouter>
      <Shell>
        <div>content</div>
      </Shell>
    </MemoryRouter>,
  )

  expect(screen.getByRole('link', { name: /dispatches/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /^map$/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /messages/i })).not.toBeInTheDocument()
})

it('renders uppercase brand, online status, and disabled SOS state', () => {
  render(
    <MemoryRouter>
      <Shell>
        <div>content</div>
      </Shell>
    </MemoryRouter>,
  )

  expect(screen.getByText('BANTAYOG ALERT')).toBeInTheDocument()
  expect(screen.getByText(/online/i)).toBeInTheDocument()
  expect(screen.getByTestId('sos-btn')).toBeDisabled()
})
```

- [ ] **Step 2: Update route test expectations**

In `apps/responder-app/src/routes.test.tsx`, remove assertions that `/messages` and `/messages/:reportId` are wrapped tab routes. Add:

```tsx
it('does not expose messages as a main tab route', async () => {
  window.history.pushState({}, '', '/messages')
  render(<AppRouter />)
  expect(await screen.findByTestId('dispatch-list')).toBeInTheDocument()
})
```

Use the existing mocks in that file. If the current router fallback differs, assert the actual safe route after implementing the route redirect.

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/components/Shell.test.tsx src/routes.test.tsx
```

Expected: FAIL because Shell still renders Messages and routes still include messages.

- [ ] **Step 4: Modify Shell tabs**

In `apps/responder-app/src/components/Shell.tsx`, remove `MessageCircle` and the Messages tab. Keep this tab structure:

```tsx
const tabs = [
  {
    to: '/',
    label: 'Dispatches',
    icon: <ClipboardList size={20} aria-hidden="true" />,
    exact: true,
  },
  { to: '/map', label: 'Map', icon: <Map size={20} aria-hidden="true" />, exact: false },
  { to: '/profile', label: 'Profile', icon: <User size={20} aria-hidden="true" />, exact: false },
]
```

Change header title:

```tsx
<span className={styles.headerTitle}>BANTAYOG ALERT</span>
<span className={styles.onlineStatus}>
  <span className={styles.onlineDot} aria-hidden="true" />
  Online
</span>
```

- [ ] **Step 5: Modify routes**

In `apps/responder-app/src/routes.tsx`, remove imports and routes for `MessagesPage` and `MessageThreadPage`. Add safe redirects:

```tsx
{ path: '/messages', element: <Navigate to="/" replace /> },
{ path: '/messages/:reportId', element: <Navigate to="/" replace /> },
```

Keep the redirect inside the protected/TOTP route group so unauthenticated users are not exposed to tab content.

- [ ] **Step 6: Restyle Shell**

Update `apps/responder-app/src/components/Shell.module.css` to use these selectors:

```css
.app {
  min-height: 100svh;
  background: var(--bg-black);
  color: var(--text-primary);
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.header {
  min-height: 56px;
  padding: 0 16px;
  background: var(--bg-black);
  border-bottom: 1px solid var(--border-default);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.headerTitle {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.headerRight {
  display: flex;
  align-items: center;
  gap: 10px;
}

.onlineStatus {
  min-height: 24px;
  color: var(--text-secondary);
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.onlineDot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--green-success);
}

.content {
  min-width: 0;
  overflow-y: auto;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--bg-black);
}

.tabBar {
  min-height: calc(64px + env(safe-area-inset-bottom));
  padding: 0 8px env(safe-area-inset-bottom);
  background: var(--bg-black);
  border-top: 1px solid var(--border-default);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.tabItem {
  position: relative;
  min-width: 0;
}

.tab {
  min-height: 64px;
  color: var(--text-secondary);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 10px;
}

.tabActive {
  color: var(--amber-accent);
  border-bottom-color: var(--amber-accent);
}

.tabIcon {
  line-height: 0;
}

.badge {
  position: absolute;
  top: 8px;
  right: calc(50% - 28px);
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--red-urgent);
  color: white;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/components/Shell.test.tsx src/routes.test.tsx
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
```

Expected: PASS, typecheck clean, lint clean.

- [ ] **Step 8: Commit**

```bash
git add apps/responder-app/src/components/Shell.tsx apps/responder-app/src/components/Shell.module.css apps/responder-app/src/components/Shell.test.tsx apps/responder-app/src/routes.tsx apps/responder-app/src/routes.test.tsx
git commit -m "feat(responder): simplify shell navigation"
```

### Task 3: Add Dispatch Progress And Ring Primitives

**Files:**

- Create: `apps/responder-app/src/lib/dispatch-progress.ts`
- Create: `apps/responder-app/src/lib/dispatch-progress.test.ts`
- Create: `apps/responder-app/src/components/DispatchRing.tsx`
- Create: `apps/responder-app/src/components/DispatchRing.module.css`
- Create: `apps/responder-app/src/components/DispatchRing.test.tsx`

- [ ] **Step 1: Write progress mapping tests**

Create `apps/responder-app/src/lib/dispatch-progress.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  getDispatchProgress,
  getNextActionLabel,
  getStepValue,
  formatCountdownLabel,
} from './dispatch-progress'

describe('dispatch-progress', () => {
  it.each([
    ['accepted', 20],
    ['acknowledged', 40],
    ['en_route', 60],
    ['on_scene', 80],
    ['resolved', 100],
  ] as const)('maps %s to %i percent', (status, expected) => {
    expect(getDispatchProgress(status)).toBe(expected)
  })

  it.each([
    ['acknowledged', 'Mark En Route'],
    ['en_route', 'Mark On Scene'],
    ['on_scene', 'Mark Resolved'],
  ] as const)('maps %s to next action label', (status, expected) => {
    expect(getNextActionLabel(status)).toBe(expected)
  })

  it('maps current step to progressbar value', () => {
    expect(getStepValue('accepted')).toEqual({ value: 0, text: 'Accepted' })
    expect(getStepValue('on_scene')).toEqual({ value: 3, text: 'On Scene' })
  })

  it('formats urgent countdown labels', () => {
    expect(formatCountdownLabel(59_000)).toBe('Accept in 0 minutes 59 seconds urgent')
    expect(formatCountdownLabel(272_000)).toBe('Accept in 4 minutes 32 seconds')
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/lib/dispatch-progress.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement progress helper**

Create `apps/responder-app/src/lib/dispatch-progress.ts`:

```ts
export type DispatchProgressStatus =
  | 'pending'
  | 'accepted'
  | 'acknowledged'
  | 'en_route'
  | 'on_scene'
  | 'resolved'

const PROGRESS_BY_STATUS: Record<DispatchProgressStatus, number> = {
  pending: 0,
  accepted: 20,
  acknowledged: 40,
  en_route: 60,
  on_scene: 80,
  resolved: 100,
}

const STEP_LABELS = ['Accepted', 'Acknowledged', 'En Route', 'On Scene', 'Resolved'] as const

export function getDispatchProgress(status: string): number {
  return PROGRESS_BY_STATUS[status as DispatchProgressStatus] ?? 0
}

export function getNextActionLabel(status: string): string {
  if (status === 'acknowledged') return 'Mark En Route'
  if (status === 'en_route') return 'Mark On Scene'
  if (status === 'on_scene') return 'Mark Resolved'
  if (status === 'resolved') return 'View Summary'
  return 'View Dispatch'
}

export function getStepValue(status: string): { value: number; text: string } {
  const value = Math.max(0, Math.min(4, Math.round(getDispatchProgress(status) / 20) - 1))
  return { value, text: STEP_LABELS[value] ?? 'Accepted' }
}

export function getRingStrokeOffset(percent: number, radius: number): number {
  const circumference = 2 * Math.PI * radius
  return circumference - (Math.max(0, Math.min(100, percent)) / 100) * circumference
}

export function formatCountdownLabel(msRemaining: number): string {
  const safeMs = Math.max(0, msRemaining)
  const totalSeconds = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const base = `Accept in ${String(minutes)} minutes ${String(seconds)} seconds`
  return safeMs < 60_000 ? `${base} urgent` : base
}
```

- [ ] **Step 4: Write ring rendering tests**

Create `apps/responder-app/src/components/DispatchRing.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { DispatchRing } from './DispatchRing'

describe('DispatchRing', () => {
  it('renders progress ring with accessible percentage', () => {
    render(
      <DispatchRing mode="progress" percent={60} tone="success" ariaLabel="Progress 60 percent">
        <span>60%</span>
      </DispatchRing>,
    )

    expect(screen.getByRole('img', { name: /progress 60 percent/i })).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
  })

  it('marks urgent countdown ring as alert', () => {
    render(
      <DispatchRing
        mode="countdown"
        percent={15}
        tone="urgent"
        ariaLabel="Accept in 0 minutes 59 seconds urgent"
        urgent
      >
        <span>0:59</span>
      </DispatchRing>,
    )

    expect(screen.getByRole('alert', { name: /urgent/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Implement DispatchRing**

Create `apps/responder-app/src/components/DispatchRing.tsx`:

```tsx
import type { ReactNode } from 'react'
import { getRingStrokeOffset } from '../lib/dispatch-progress'
import styles from './DispatchRing.module.css'

interface Props {
  mode: 'countdown' | 'progress'
  percent: number
  tone: 'accent' | 'urgent' | 'success'
  ariaLabel: string
  urgent?: boolean
  children: ReactNode
}

export function DispatchRing({ mode, percent, tone, ariaLabel, urgent = false, children }: Props) {
  const radius = 118
  const circumference = 2 * Math.PI * radius
  const dashOffset =
    mode === 'countdown'
      ? circumference - getRingStrokeOffset(percent, radius)
      : getRingStrokeOffset(percent, radius)

  return (
    <div
      className={[styles.ring, styles[tone]].filter(Boolean).join(' ')}
      role={urgent ? 'alert' : 'img'}
      aria-label={ariaLabel}
    >
      <svg className={styles.svg} viewBox="0 0 280 280" aria-hidden="true">
        <circle className={styles.track} cx="140" cy="140" r={radius} />
        <circle
          className={styles.fill}
          cx="140"
          cy="140"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className={styles.content}>{children}</div>
    </div>
  )
}
```

Create `apps/responder-app/src/components/DispatchRing.module.css`:

```css
.ring {
  position: relative;
  width: clamp(240px, 85vw, 280px);
  aspect-ratio: 1;
  margin: 0 auto;
  display: grid;
  place-items: center;
}

.svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.track,
.fill {
  fill: none;
  stroke-width: 12;
}

.track {
  stroke: var(--surface-raised);
}

.fill {
  stroke-linecap: round;
  transition:
    stroke-dashoffset 1s linear,
    stroke 200ms var(--motion-standard);
}

.accent .fill {
  stroke: var(--amber-accent);
}

.urgent .fill {
  stroke: var(--red-urgent);
}

.success .fill {
  stroke: var(--green-success);
}

.content {
  position: relative;
  z-index: 1;
  width: 68%;
  text-align: center;
}
```

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/lib/dispatch-progress.test.ts src/components/DispatchRing.test.tsx
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
```

Expected: PASS, typecheck clean, lint clean.

- [ ] **Step 7: Commit**

```bash
git add apps/responder-app/src/lib/dispatch-progress.ts apps/responder-app/src/lib/dispatch-progress.test.ts apps/responder-app/src/components/DispatchRing.tsx apps/responder-app/src/components/DispatchRing.module.css apps/responder-app/src/components/DispatchRing.test.tsx
git commit -m "feat(responder): add dispatch ring primitives"
```

### Task 4: Redesign Dispatch List With Ring Cards

**Files:**

- Modify: `apps/responder-app/src/pages/DispatchListPage.tsx`
- Modify: `apps/responder-app/src/pages/DispatchListPage.module.css`
- Modify: `apps/responder-app/src/pages/DispatchListPage.test.tsx`
- Modify: `apps/responder-app/src/components/AcceptanceCountdown.tsx`
- Modify: `apps/responder-app/src/components/AcceptanceCountdown.test.tsx`

- [ ] **Step 1: Add failing dispatch list tests**

Add these tests to `apps/responder-app/src/pages/DispatchListPage.test.tsx`:

```tsx
it('renders pending dispatch inside an urgent countdown ring', () => {
  const now = Date.now()
  dispatchListState.rows = [
    {
      dispatchId: 'd-1',
      reportId: 'report-1',
      status: 'pending',
      uiStatus: 'pending',
      acknowledgementDeadlineAt: { toMillis: () => now + 59_000 },
    },
  ]
  dispatchListState.groups.pending = dispatchListState.rows

  render(
    <MemoryRouter>
      <DispatchListPage />
    </MemoryRouter>,
  )

  expect(screen.getByRole('alert', { name: /accept in/i })).toHaveAccessibleName(/urgent/i)
  expect(screen.getByRole('button', { name: /view & accept/i })).toBeInTheDocument()
})

it('renders active dispatch progress ring and next action label', () => {
  dispatchListState.rows = [
    {
      dispatchId: 'd-2',
      reportId: 'report-2',
      status: 'en_route',
      uiStatus: 'en_route',
      acknowledgementDeadlineAt: { toMillis: () => Date.now() + 60_000 },
    },
  ]
  dispatchListState.groups.active = dispatchListState.rows

  render(
    <MemoryRouter>
      <DispatchListPage />
    </MemoryRouter>,
  )

  expect(screen.getByRole('img', { name: /progress 60 percent/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /mark on scene/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/pages/DispatchListPage.test.tsx
```

Expected: FAIL because the page still renders card rows instead of ring cards.

- [ ] **Step 3: Replace card internals with `DispatchRing`**

In `DispatchListPage.tsx`, import:

```tsx
import { DispatchRing } from '../components/DispatchRing'
import {
  formatCountdownLabel,
  getDispatchProgress,
  getNextActionLabel,
} from '../lib/dispatch-progress'
```

Inside pending card rendering, compute:

```tsx
const deadlineMs = row.acknowledgementDeadlineAt?.toMillis?.() ?? Date.now()
const remainingMs = Math.max(0, deadlineMs - Date.now())
const totalWindowMs = 5 * 60 * 1000
const remainingPercent = Math.max(0, Math.min(100, (remainingMs / totalWindowMs) * 100))
const urgent = remainingMs < 60_000
```

Render pending center content:

```tsx
<DispatchRing
  mode="countdown"
  percent={remainingPercent}
  tone={urgent ? 'urgent' : 'accent'}
  ariaLabel={formatCountdownLabel(remainingMs)}
  urgent={urgent}
>
  <span className={styles.ringLabel}>ACCEPT IN</span>
  <AcceptanceCountdown deadlineMs={deadlineMs} className={styles.ringNumber} />
  <h3 className={styles.ringTitle}>
    {report ? getReportTypeLabel(report.reportType) : `Incident ${row.reportId.slice(0, 8)}`}
  </h3>
  <button type="button" className={styles.btnPrimary} onClick={() => void navigate(destination)}>
    View &amp; Accept
  </button>
</DispatchRing>
```

Render active center content:

```tsx
const progress = getDispatchProgress(row.status)

<DispatchRing
  mode="progress"
  percent={progress}
  tone="success"
  ariaLabel={`Progress ${String(progress)} percent`}
>
  <span className={styles.ringLabel}>PROGRESS</span>
  <strong className={styles.ringNumber}>{String(progress)}%</strong>
  <h3 className={styles.ringTitle}>
    {report ? getReportTypeLabel(report.reportType) : `Incident ${row.reportId.slice(0, 8)}`}
  </h3>
  <button type="button" className={styles.btnSuccess} onClick={() => void navigate(destination)}>
    {getNextActionLabel(row.status)}
  </button>
</DispatchRing>
```

- [ ] **Step 4: Update AcceptanceCountdown API**

Modify `apps/responder-app/src/components/AcceptanceCountdown.tsx` to accept optional `className`:

```tsx
interface Props {
  deadlineMs: number | { toMillis: () => number }
  className?: string
}
```

Apply it to the visible timer node:

```tsx
<span className={[styles.countdown, className].filter(Boolean).join(' ')}>
  {formatRemaining(remainingMs)}
</span>
```

- [ ] **Step 5: Style list ring cards**

In `DispatchListPage.module.css`, add:

```css
.page {
  min-height: 100%;
  padding: 16px;
  background: var(--bg-black);
}

.section {
  display: grid;
  gap: 16px;
}

.card {
  padding: 18px 12px;
  border: 1px solid var(--border-default);
  border-radius: 24px;
  background: var(--surface-elevated);
}

.ringLabel {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.ringNumber {
  display: block;
  margin-top: 4px;
  color: var(--amber-accent);
  font-size: 36px;
  font-weight: 700;
}

.btnPrimary,
.btnSuccess {
  min-height: 48px;
  width: 100%;
  border: 0;
  border-radius: 999px;
  font-weight: 700;
}

.btnPrimary {
  background: var(--amber-accent);
  color: var(--bg-black);
}

.btnSuccess {
  background: var(--green-success);
  color: var(--bg-black);
}
```

Preserve existing severity chip selectors and error/empty selectors unless replaced by equivalent dark-theme selectors.

- [ ] **Step 6: Remove emoji empty-state icon**

Replace `✓` with Lucide `CheckCircle`:

```tsx
import { CheckCircle } from 'lucide-react'

;<CheckCircle className={styles.emptyIcon} aria-label="All dispatches complete" role="img" />
```

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/pages/DispatchListPage.test.tsx src/components/AcceptanceCountdown.test.tsx
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
```

Expected: PASS, typecheck clean, lint clean.

- [ ] **Step 8: Commit**

```bash
git add apps/responder-app/src/pages/DispatchListPage.tsx apps/responder-app/src/pages/DispatchListPage.module.css apps/responder-app/src/pages/DispatchListPage.test.tsx apps/responder-app/src/components/AcceptanceCountdown.tsx apps/responder-app/src/components/AcceptanceCountdown.test.tsx
git commit -m "feat(responder): redesign dispatch list rings"
```

### Task 5: Add Offline Transition Queue

**Files:**

- Modify: `apps/responder-app/package.json`
- Create: `apps/responder-app/src/lib/offline-transitions.ts`
- Create: `apps/responder-app/src/lib/offline-transitions.test.ts`
- Create: `apps/responder-app/src/hooks/useOfflineTransitions.ts`
- Create: `apps/responder-app/src/hooks/useOfflineTransitions.test.tsx`
- Modify: `apps/responder-app/src/App.tsx`

- [ ] **Step 1: Add localforage dependency**

Modify `apps/responder-app/package.json` dependencies:

```json
"localforage": "^1.10.0"
```

Run:

```bash
pnpm install
```

Expected: lockfile remains consistent or updates only for responder dependency metadata. If install needs network and fails, request approval before retrying.

- [ ] **Step 2: Write offline queue tests**

Create `apps/responder-app/src/lib/offline-transitions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  value: null as unknown,
  getItem: vi.fn(async () => store.value),
  setItem: vi.fn(async (_key: string, value: unknown) => {
    store.value = value
  }),
  removeItem: vi.fn(async () => {
    store.value = null
  }),
}))

vi.mock('localforage', () => ({
  default: {
    createInstance: vi.fn(() => store),
  },
}))

import {
  enqueueOfflineTransition,
  getOfflineTransitionQueue,
  markOfflineTransitionFailed,
  removeOfflineTransition,
} from './offline-transitions'

describe('offline-transitions', () => {
  beforeEach(() => {
    store.value = null
    store.getItem.mockClear()
    store.setItem.mockClear()
    store.removeItem.mockClear()
  })

  it('queues transitions oldest first', async () => {
    await enqueueOfflineTransition({ dispatchId: 'd-1', transition: 'en_route', payload: {} }, 100)
    await enqueueOfflineTransition({ dispatchId: 'd-2', transition: 'on_scene', payload: {} }, 200)

    expect(await getOfflineTransitionQueue()).toEqual([
      {
        id: 'd-1:en_route:100',
        dispatchId: 'd-1',
        transition: 'en_route',
        payload: {},
        timestamp: 100,
        retryCount: 0,
      },
      {
        id: 'd-2:on_scene:200',
        dispatchId: 'd-2',
        transition: 'on_scene',
        payload: {},
        timestamp: 200,
        retryCount: 0,
      },
    ])
  })

  it('increments retry count up to terminal state', async () => {
    await enqueueOfflineTransition({ dispatchId: 'd-1', transition: 'en_route', payload: {} }, 100)
    await markOfflineTransitionFailed('d-1:en_route:100')

    expect(await getOfflineTransitionQueue()).toMatchObject([{ retryCount: 1 }])
  })

  it('removes server-conflicted transitions', async () => {
    await enqueueOfflineTransition({ dispatchId: 'd-1', transition: 'en_route', payload: {} }, 100)
    await removeOfflineTransition('d-1:en_route:100')

    expect(await getOfflineTransitionQueue()).toEqual([])
  })
})
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/lib/offline-transitions.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement queue storage**

Create `apps/responder-app/src/lib/offline-transitions.ts`:

```ts
import localforage from 'localforage'

export type OfflineTransitionName = 'acknowledged' | 'en_route' | 'on_scene' | 'resolved' | 'unable'

export interface OfflineTransitionEntry {
  id: string
  dispatchId: string
  transition: OfflineTransitionName
  payload: Record<string, unknown>
  timestamp: number
  retryCount: number
}

const QUEUE_KEY = 'offline-transitions'

const storage = localforage.createInstance({
  name: 'bantayog-responder',
  storeName: 'offline_transitions',
})

function isEntry(value: unknown): value is OfflineTransitionEntry {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<OfflineTransitionEntry>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.dispatchId === 'string' &&
    typeof candidate.transition === 'string' &&
    typeof candidate.timestamp === 'number' &&
    typeof candidate.retryCount === 'number' &&
    typeof candidate.payload === 'object' &&
    candidate.payload !== null
  )
}

export async function getOfflineTransitionQueue(): Promise<OfflineTransitionEntry[]> {
  const raw = await storage.getItem<unknown>(QUEUE_KEY)
  return Array.isArray(raw) ? raw.filter(isEntry).sort((a, b) => a.timestamp - b.timestamp) : []
}

export async function enqueueOfflineTransition(
  input: Omit<OfflineTransitionEntry, 'id' | 'timestamp' | 'retryCount'>,
  now = Date.now(),
): Promise<OfflineTransitionEntry> {
  const entry: OfflineTransitionEntry = {
    ...input,
    id: `${input.dispatchId}:${input.transition}:${String(now)}`,
    timestamp: now,
    retryCount: 0,
  }
  const queue = await getOfflineTransitionQueue()
  await storage.setItem(QUEUE_KEY, [...queue, entry])
  return entry
}

export async function removeOfflineTransition(id: string): Promise<void> {
  const queue = await getOfflineTransitionQueue()
  await storage.setItem(
    QUEUE_KEY,
    queue.filter((entry) => entry.id !== id),
  )
}

export async function markOfflineTransitionFailed(id: string): Promise<void> {
  const queue = await getOfflineTransitionQueue()
  await storage.setItem(
    QUEUE_KEY,
    queue.map((entry) =>
      entry.id === id ? { ...entry, retryCount: Math.min(5, entry.retryCount + 1) } : entry,
    ),
  )
}

export function getRetryDelayMs(retryCount: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, retryCount))
}
```

- [ ] **Step 5: Add hook tests for online drain**

Create `apps/responder-app/src/hooks/useOfflineTransitions.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const queueState = vi.hoisted(() => ({
  queue: [
    {
      id: 'q-1',
      dispatchId: 'd-1',
      transition: 'en_route',
      payload: {},
      timestamp: 1,
      retryCount: 0,
    },
  ],
  drain: vi.fn(async () => undefined),
}))

vi.mock('../lib/offline-transitions', () => ({
  getOfflineTransitionQueue: vi.fn(async () => queueState.queue),
  removeOfflineTransition: vi.fn(async () => undefined),
  markOfflineTransitionFailed: vi.fn(async () => undefined),
  getRetryDelayMs: vi.fn(() => 1),
}))

import { useOfflineTransitions } from './useOfflineTransitions'

describe('useOfflineTransitions', () => {
  it('drains queue on online event', async () => {
    renderHook(() => useOfflineTransitions(queueState.drain))

    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })

    expect(queueState.drain).toHaveBeenCalledWith(queueState.queue[0])
  })
})
```

- [ ] **Step 6: Implement hook**

Create `apps/responder-app/src/hooks/useOfflineTransitions.ts`:

```ts
import { useEffect } from 'react'
import {
  getOfflineTransitionQueue,
  markOfflineTransitionFailed,
  removeOfflineTransition,
  getRetryDelayMs,
  type OfflineTransitionEntry,
} from '../lib/offline-transitions'

export function useOfflineTransitions(
  runTransition: (entry: OfflineTransitionEntry) => Promise<void>,
) {
  useEffect(() => {
    let cancelled = false

    const drain = async () => {
      const queue = await getOfflineTransitionQueue()
      for (const entry of queue) {
        if (cancelled) return
        try {
          await new Promise((resolve) => setTimeout(resolve, getRetryDelayMs(entry.retryCount)))
          await runTransition(entry)
          await removeOfflineTransition(entry.id)
        } catch (err: unknown) {
          if (err instanceof Error && err.message === 'server_conflict') {
            await removeOfflineTransition(entry.id)
          } else {
            await markOfflineTransitionFailed(entry.id)
          }
        }
      }
    }

    const onOnline = () => {
      void drain()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void drain()
    }

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [runTransition])
}
```

- [ ] **Step 7: Mount queue drain provider**

In `apps/responder-app/src/App.tsx`, add a small provider that wires queued entries to the existing callable hooks only if those hooks can be safely invoked without a component dispatch ID. If existing hooks require a fixed dispatch ID, create a direct callable client wrapper in a later task instead of forcing hooks out of shape.

Use this provider shape:

```tsx
function OfflineTransitionsProvider() {
  const runTransition = async (entry: OfflineTransitionEntry) => {
    // Call the same callable path used by useAdvanceDispatch / unable-to-complete.
    // Keep this function dependency-injected in tests.
  }
  useOfflineTransitions(runTransition)
  return null
}
```

If this cannot be implemented without duplicating callable logic, stop and split a follow-up task to extract shared callable clients from the existing hooks.

- [ ] **Step 8: Run verification**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/lib/offline-transitions.test.ts src/hooks/useOfflineTransitions.test.tsx
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
```

Expected: PASS, typecheck clean, lint clean.

- [ ] **Step 9: Commit**

```bash
git add apps/responder-app/package.json pnpm-lock.yaml apps/responder-app/src/lib/offline-transitions.ts apps/responder-app/src/lib/offline-transitions.test.ts apps/responder-app/src/hooks/useOfflineTransitions.ts apps/responder-app/src/hooks/useOfflineTransitions.test.tsx apps/responder-app/src/App.tsx
git commit -m "feat(responder): add offline transition queue"
```

### Task 6: Wire Offline Feedback Into Dispatch Actions

**Files:**

- Modify: `apps/responder-app/src/pages/DispatchDetailPage.tsx`
- Modify: `apps/responder-app/src/pages/DispatchDetailPage.test.tsx`
- Modify: `apps/responder-app/src/pages/DispatchListPage.tsx`
- Modify: `apps/responder-app/src/pages/DispatchListPage.test.tsx`
- Modify: `apps/responder-app/src/components/Shell.tsx`
- Modify: `apps/responder-app/src/components/Shell.test.tsx`

- [ ] **Step 1: Add failing queue feedback tests**

In `DispatchDetailPage.test.tsx`, add:

```tsx
it('queues transition when advance fails offline', async () => {
  advanceMock.mockRejectedValueOnce(new Error('unavailable'))
  enqueueOfflineTransitionMock.mockResolvedValueOnce({
    id: 'd-1:en_route:1',
    dispatchId: 'd-1',
    transition: 'en_route',
    payload: {},
    timestamp: 1,
    retryCount: 0,
  })

  renderDispatchDetail({ status: 'acknowledged' })

  await userEvent.click(screen.getByRole('button', { name: /mark en route/i }))

  expect(enqueueOfflineTransitionMock).toHaveBeenCalledWith(
    { dispatchId: 'd-1', transition: 'en_route', payload: {} },
    expect.any(Number),
  )
  expect(screen.getByText(/queued/i)).toBeInTheDocument()
})
```

Use existing test mocks and add:

```tsx
const enqueueOfflineTransitionMock = vi.hoisted(() => vi.fn())
vi.mock('../lib/offline-transitions', () => ({
  enqueueOfflineTransition: enqueueOfflineTransitionMock,
}))
```

- [ ] **Step 2: Run failing test**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/pages/DispatchDetailPage.test.tsx -t "queues transition"
```

Expected: FAIL because actions do not enqueue offline transitions.

- [ ] **Step 3: Wrap advance handlers**

In `DispatchDetailPage.tsx`, import:

```tsx
import { enqueueOfflineTransition, type OfflineTransitionName } from '../lib/offline-transitions'
```

Create a helper inside the component:

```tsx
const [queuedTransition, setQueuedTransition] = useState<OfflineTransitionName | null>(null)

const runAdvance = async (
  transition: OfflineTransitionName,
  payload: Record<string, unknown> = {},
) => {
  try {
    await advance(transition)
    setQueuedTransition(null)
  } catch (err: unknown) {
    await enqueueOfflineTransition({ dispatchId: dispatch.dispatchId, transition, payload })
    setQueuedTransition(transition)
  }
}
```

Use `runAdvance('en_route')`, `runAdvance('on_scene')`, and `runAdvance('resolved', { resolutionSummary })` for state transition buttons. Keep decline and unable-to-complete explicit unless the queue entry type has been expanded for those flows.

- [ ] **Step 4: Render queued feedback**

Add near action buttons:

```tsx
{
  queuedTransition !== null && (
    <p className={styles.queuedPill} role="status">
      Queued — will retry.
    </p>
  )
}
```

- [ ] **Step 5: Add Shell queued badge test**

In `Shell.test.tsx`, mock queued count and assert:

```tsx
it('shows queued update badge on Dispatches tab', () => {
  useOfflineQueueCountMock.mockReturnValue(2)

  render(
    <MemoryRouter>
      <Shell>
        <div>content</div>
      </Shell>
    </MemoryRouter>,
  )

  expect(screen.getByLabelText('2 queued updates')).toBeInTheDocument()
})
```

Implement `useOfflineQueueCount` only if needed; otherwise read queue count from a provider created in Task 5.

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/pages/DispatchDetailPage.test.tsx src/pages/DispatchListPage.test.tsx src/components/Shell.test.tsx
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
```

Expected: PASS, typecheck clean, lint clean.

- [ ] **Step 7: Commit**

```bash
git add apps/responder-app/src/pages/DispatchDetailPage.tsx apps/responder-app/src/pages/DispatchDetailPage.test.tsx apps/responder-app/src/pages/DispatchListPage.tsx apps/responder-app/src/pages/DispatchListPage.test.tsx apps/responder-app/src/components/Shell.tsx apps/responder-app/src/components/Shell.test.tsx
git commit -m "feat(responder): show queued dispatch updates"
```

### Task 7: Redesign Dispatch Detail Timeline And Field Notes Drafts

**Files:**

- Create: `apps/responder-app/src/hooks/useFieldNoteDraft.ts`
- Create: `apps/responder-app/src/hooks/useFieldNoteDraft.test.tsx`
- Modify: `apps/responder-app/src/pages/DispatchDetailPage.tsx`
- Modify: `apps/responder-app/src/pages/DispatchDetailPage.module.css`
- Modify: `apps/responder-app/src/pages/DispatchDetailPage.test.tsx`

- [ ] **Step 1: Write field draft tests**

Create `apps/responder-app/src/hooks/useFieldNoteDraft.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => ({
  value: null as string | null,
  getItem: vi.fn(async () => storage.value),
  setItem: vi.fn(async (_key: string, value: string) => {
    storage.value = value
  }),
  removeItem: vi.fn(async () => {
    storage.value = null
  }),
}))

vi.mock('localforage', () => ({
  default: { createInstance: vi.fn(() => storage) },
}))

import { useFieldNoteDraft } from './useFieldNoteDraft'

describe('useFieldNoteDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    storage.value = 'saved draft'
    storage.getItem.mockClear()
    storage.setItem.mockClear()
    storage.removeItem.mockClear()
  })

  it('restores draft on mount and debounces saves', async () => {
    const { result } = renderHook(() => useFieldNoteDraft('dispatch-1'))

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.value).toBe('saved draft')

    act(() => {
      result.current.setValue('new draft')
      vi.advanceTimersByTime(500)
    })

    expect(storage.setItem).toHaveBeenCalledWith('field-notes/dispatch-1', 'new draft')
  })

  it('clears draft after submit', async () => {
    const { result } = renderHook(() => useFieldNoteDraft('dispatch-1'))

    await act(async () => {
      await result.current.clear()
    })

    expect(storage.removeItem).toHaveBeenCalledWith('field-notes/dispatch-1')
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/hooks/useFieldNoteDraft.test.tsx
```

Expected: FAIL because hook does not exist.

- [ ] **Step 3: Implement draft hook**

Create `apps/responder-app/src/hooks/useFieldNoteDraft.ts`:

```ts
import { useEffect, useState } from 'react'
import localforage from 'localforage'

const storage = localforage.createInstance({
  name: 'bantayog-responder',
  storeName: 'field_note_drafts',
})

export function useFieldNoteDraft(dispatchId: string | undefined) {
  const key = dispatchId ? `field-notes/${dispatchId}` : null
  const [value, setValue] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (key === null) return
    let active = true
    storage
      .getItem<string>(key)
      .then((saved) => {
        if (!active) return
        setValue(saved ?? '')
        setLoaded(true)
      })
      .catch(() => {
        if (!active) return
        setLoaded(true)
      })
    return () => {
      active = false
    }
  }, [key])

  useEffect(() => {
    if (key === null || !loaded) return
    const timeoutId = setTimeout(() => {
      storage.setItem(key, value).catch(() => undefined)
    }, 500)
    return () => {
      clearTimeout(timeoutId)
    }
  }, [key, loaded, value])

  const clear = async () => {
    if (key === null) return
    await storage.removeItem(key)
    setValue('')
  }

  return { value, setValue, clear, loaded }
}
```

- [ ] **Step 4: Add timeline ARIA test**

In `DispatchDetailPage.test.tsx`, add:

```tsx
it('renders accessible state machine timeline', () => {
  renderDispatchDetail({ status: 'en_route' })

  const timeline = screen.getByRole('progressbar', { name: /dispatch progress/i })
  expect(timeline).toHaveAttribute('aria-valuenow', '2')
  expect(timeline).toHaveAttribute('aria-valuetext', 'En Route')
  expect(screen.getByText('En Route')).toHaveAttribute('aria-current', 'step')
})
```

- [ ] **Step 5: Implement timeline and draft integration**

In `DispatchDetailPage.tsx`, import:

```tsx
import { Check, Siren } from 'lucide-react'
import { getStepValue } from '../lib/dispatch-progress'
import { useFieldNoteDraft } from '../hooks/useFieldNoteDraft'
import { FloatingSosFab } from '../components/FloatingSosFab'
```

Replace local `fieldNote` state with:

```tsx
const fieldNoteDraft = useFieldNoteDraft(dispatchId)
```

On successful note submit:

```tsx
await addNote(fieldNoteDraft.value)
await fieldNoteDraft.clear()
```

Render timeline:

```tsx
const step = getStepValue(dispatch.status)

<div
  className={styles.timeline}
  role="progressbar"
  aria-label="Dispatch progress"
  aria-valuemin={0}
  aria-valuemax={4}
  aria-valuenow={step.value}
  aria-valuetext={step.text}
>
  {['Accepted', 'Acknowledged', 'En Route', 'On Scene', 'Resolved'].map((label, index) => (
    <span
      key={label}
      className={[
        styles.timelineStep,
        index < step.value && styles.timelineDone,
        index === step.value && styles.timelineCurrent,
      ]
        .filter(Boolean)
        .join(' ')}
      {...(index === step.value ? { 'aria-current': 'step' as const } : {})}
    >
      {index < step.value && <Check size={14} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  ))}
</div>
```

Add `FloatingSosFab` when `isActive && dispatchId !== undefined`.

- [ ] **Step 6: Style timeline and dark detail cards**

Add to `DispatchDetailPage.module.css`:

```css
.timeline {
  padding: 16px 8px;
  border: 1px solid var(--border-default);
  border-radius: 20px;
  background: var(--surface-elevated);
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.timelineStep {
  min-width: 0;
  color: var(--text-tertiary);
  font-size: 10px;
  text-align: center;
  display: grid;
  justify-items: center;
  gap: 6px;
}

.timelineStep::before {
  content: '';
  width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-radius: 999px;
}

.timelineDone {
  color: var(--green-success);
}

.timelineCurrent {
  color: var(--amber-accent);
  font-weight: 700;
}
```

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/hooks/useFieldNoteDraft.test.tsx src/pages/DispatchDetailPage.test.tsx
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
```

Expected: PASS, typecheck clean, lint clean.

- [ ] **Step 8: Commit**

```bash
git add apps/responder-app/src/hooks/useFieldNoteDraft.ts apps/responder-app/src/hooks/useFieldNoteDraft.test.tsx apps/responder-app/src/pages/DispatchDetailPage.tsx apps/responder-app/src/pages/DispatchDetailPage.module.css apps/responder-app/src/pages/DispatchDetailPage.test.tsx
git commit -m "feat(responder): add timeline and note drafts"
```

### Task 8: Add Floating SOS FAB And Restyle SOS Flow

**Files:**

- Create: `apps/responder-app/src/components/FloatingSosFab.tsx`
- Create: `apps/responder-app/src/components/FloatingSosFab.module.css`
- Modify: `apps/responder-app/src/pages/SosPage.tsx`
- Modify: `apps/responder-app/src/pages/SosPage.module.css`
- Modify: `apps/responder-app/src/pages/SosPage.test.tsx`

- [ ] **Step 1: Write FAB and SOS tests**

Add to `SosPage.test.tsx`:

```tsx
it('renders hold-to-send SOS control in thumb zone without emoji', () => {
  render(<SosPage />)

  expect(screen.getByRole('button', { name: /hold to send sos/i })).toBeInTheDocument()
  expect(screen.queryByText(/🆘/)).not.toBeInTheDocument()
})
```

Create `FloatingSosFab` coverage in `DispatchDetailPage.test.tsx`:

```tsx
it('renders floating SOS FAB for active dispatches', () => {
  renderDispatchDetail({ status: 'en_route' })

  expect(screen.getByRole('link', { name: /send sos for this dispatch/i })).toHaveAttribute(
    'href',
    '/dispatches/d-1/sos',
  )
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/pages/SosPage.test.tsx src/pages/DispatchDetailPage.test.tsx -t "SOS"
```

Expected: FAIL until FAB and SOS restyle land.

- [ ] **Step 3: Implement FloatingSosFab**

Create `apps/responder-app/src/components/FloatingSosFab.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { Siren } from 'lucide-react'
import styles from './FloatingSosFab.module.css'

interface Props {
  dispatchId: string
}

export function FloatingSosFab({ dispatchId }: Props) {
  return (
    <Link
      to={`/dispatches/${dispatchId}/sos`}
      className={styles.fab}
      aria-label="Send SOS for this dispatch"
    >
      <Siren size={22} aria-hidden="true" />
    </Link>
  )
}
```

Create `apps/responder-app/src/components/FloatingSosFab.module.css`:

```css
.fab {
  position: fixed;
  right: 18px;
  bottom: calc(88px + env(safe-area-inset-bottom));
  z-index: 20;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: var(--amber-accent);
  color: var(--bg-black);
  box-shadow: 0 0 24px rgb(245 158 11 / 32%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 4: Restyle SOS page**

In `SosPage.tsx`, replace emoji/icon text with Lucide `Siren` and button label text:

```tsx
<button type="button" className={styles.holdButton} aria-label="Hold to send SOS">
  <Siren size={34} aria-hidden="true" />
  <span>HOLD TO SEND SOS</span>
</button>
```

Keep existing hold-to-confirm behavior and timer cleanup.

- [ ] **Step 5: Add red page CSS**

In `SosPage.module.css`, ensure:

```css
.page {
  min-height: 100svh;
  padding: 24px;
  background: var(--red-urgent);
  color: white;
  display: grid;
  align-content: end;
  gap: 18px;
}

.holdButton {
  min-height: 180px;
  width: 100%;
  border: 2px solid rgb(255 255 255 / 70%);
  border-radius: 28px;
  background: rgb(255 255 255 / 14%);
  color: white;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.06em;
  display: grid;
  place-items: center;
  gap: 10px;
}

@media (prefers-reduced-motion: no-preference) {
  .holdButton {
    animation: sos-pulse 400ms var(--motion-standard) 1;
  }
}
```

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/pages/SosPage.test.tsx src/pages/DispatchDetailPage.test.tsx
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
```

Expected: PASS, typecheck clean, lint clean.

- [ ] **Step 7: Commit**

```bash
git add apps/responder-app/src/components/FloatingSosFab.tsx apps/responder-app/src/components/FloatingSosFab.module.css apps/responder-app/src/pages/SosPage.tsx apps/responder-app/src/pages/SosPage.module.css apps/responder-app/src/pages/SosPage.test.tsx apps/responder-app/src/pages/DispatchDetailPage.tsx apps/responder-app/src/pages/DispatchDetailPage.test.tsx
git commit -m "feat(responder): add thumb-zone sos access"
```

### Task 9: Redesign Map Page Dark Theme

**Files:**

- Modify: `apps/responder-app/src/pages/MapPage.tsx`
- Modify: `apps/responder-app/src/pages/MapPage.module.css`
- Modify: `apps/responder-app/src/pages/MapPage.test.tsx`

- [ ] **Step 1: Add failing map tile test**

In `MapPage.test.tsx`, add:

```tsx
it('uses CartoDB dark matter tiles', () => {
  render(<MapPage />)

  expect(tileLayerMock).toHaveBeenCalledWith(
    expect.objectContaining({
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    }),
    undefined,
  )
})
```

Use the existing `TileLayer` mock in the file. If it does not currently capture props, update the mock to:

```tsx
const tileLayerMock = vi.hoisted(() => vi.fn())
TileLayer: (props: unknown) => {
  tileLayerMock(props, undefined)
  return null
}
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/pages/MapPage.test.tsx -t "CartoDB"
```

Expected: FAIL because OSM light tiles are still used.

- [ ] **Step 3: Change tile layer**

In `MapPage.tsx`, replace TileLayer props:

```tsx
<TileLayer
  attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
/>
```

- [ ] **Step 4: Ensure legend and recenter controls are styled**

In `MapPage.module.css`, add or update:

```css
.legend {
  position: absolute;
  left: 12px;
  bottom: 18px;
  z-index: 500;
  padding: 10px 12px;
  border: 1px solid var(--border-default);
  border-radius: 14px;
  background: rgb(13 12 8 / 82%);
  color: var(--text-primary);
  backdrop-filter: blur(10px);
}

.recenterButton {
  position: absolute;
  right: 12px;
  bottom: 18px;
  z-index: 500;
  min-width: 48px;
  min-height: 48px;
  border: 1px solid var(--border-default);
  border-radius: 999px;
  background: var(--surface-elevated);
  color: var(--text-primary);
}

.recenterButton:disabled {
  color: var(--text-tertiary);
  opacity: 0.65;
}
```

- [ ] **Step 5: Keep GPS lifecycle intact**

Re-run existing tests that cover `visibilitychange`. Do not remove `watchPosition`, pause/resume, one-shot fly-to, or `L.divIcon` markers.

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/pages/MapPage.test.tsx
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
```

Expected: PASS, typecheck clean, lint clean.

- [ ] **Step 7: Commit**

```bash
git add apps/responder-app/src/pages/MapPage.tsx apps/responder-app/src/pages/MapPage.module.css apps/responder-app/src/pages/MapPage.test.tsx
git commit -m "style(responder): switch map to dark operations theme"
```

### Task 10: Build Profile Competence Metrics

**Files:**

- Create: `apps/responder-app/src/lib/profile-metrics.ts`
- Create: `apps/responder-app/src/lib/profile-metrics.test.ts`
- Modify: `apps/responder-app/src/pages/ProfilePage.tsx`
- Modify: `apps/responder-app/src/pages/ProfilePage.module.css`
- Modify: `apps/responder-app/src/pages/ProfilePage.test.tsx`
- Modify: `apps/responder-app/src/pages/ProfilePage.specializations.test.tsx`

- [ ] **Step 1: Write metric tests**

Create `apps/responder-app/src/lib/profile-metrics.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildProfileMetrics } from './profile-metrics'

describe('profile-metrics', () => {
  it('computes resolution rate and average response time', () => {
    const metrics = buildProfileMetrics([
      { status: 'resolved', reportType: 'flood', acceptedAt: 0, resolvedAt: 600_000 },
      { status: 'declined', reportType: 'fire', acceptedAt: 0, resolvedAt: null },
      { status: 'resolved', reportType: 'flood', acceptedAt: 0, resolvedAt: 300_000 },
    ])

    expect(metrics.totalDispatches).toBe(3)
    expect(metrics.resolutionRate).toBe(67)
    expect(metrics.averageResponseMinutes).toBe(8)
  })

  it('tiers specialization mastery relative to most resolved type', () => {
    const metrics = buildProfileMetrics([
      { status: 'resolved', reportType: 'flood', acceptedAt: 0, resolvedAt: 1 },
      { status: 'resolved', reportType: 'flood', acceptedAt: 0, resolvedAt: 1 },
      { status: 'resolved', reportType: 'medical', acceptedAt: 0, resolvedAt: 1 },
    ])

    expect(metrics.mastery).toEqual([
      { reportType: 'flood', resolvedCount: 2, percent: 100, tone: 'green' },
      { reportType: 'medical', resolvedCount: 1, percent: 50, tone: 'amber' },
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/lib/profile-metrics.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement profile metrics**

Create `apps/responder-app/src/lib/profile-metrics.ts`:

```ts
export interface HistoryMetricRow {
  status: string
  reportType: string
  acceptedAt: number | null
  resolvedAt: number | null
}

export interface MasteryMetric {
  reportType: string
  resolvedCount: number
  percent: number
  tone: 'green' | 'amber' | 'muted'
}

export function buildProfileMetrics(rows: HistoryMetricRow[]) {
  const resolved = rows.filter((row) => row.status === 'resolved')
  const durations = resolved
    .map((row) =>
      row.acceptedAt !== null && row.resolvedAt !== null ? row.resolvedAt - row.acceptedAt : null,
    )
    .filter((value): value is number => value !== null && value >= 0)

  const counts = new Map<string, number>()
  for (const row of resolved) {
    counts.set(row.reportType, (counts.get(row.reportType) ?? 0) + 1)
  }
  const maxCount = Math.max(1, ...counts.values())
  const mastery: MasteryMetric[] = Array.from(counts.entries())
    .map(([reportType, resolvedCount]) => {
      const percent = Math.round((resolvedCount / maxCount) * 100)
      return {
        reportType,
        resolvedCount,
        percent,
        tone: percent >= 80 ? 'green' : percent >= 50 ? 'amber' : 'muted',
      } satisfies MasteryMetric
    })
    .sort((a, b) => b.resolvedCount - a.resolvedCount)

  return {
    totalDispatches: rows.length,
    resolutionRate: rows.length === 0 ? 0 : Math.round((resolved.length / rows.length) * 100),
    averageResponseMinutes:
      durations.length === 0
        ? 0
        : Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length / 60_000),
    fastestResponseMinutes:
      durations.length === 0 ? 0 : Math.round(Math.min(...durations) / 60_000),
    mastery,
  }
}
```

- [ ] **Step 4: Update ProfilePage tests**

Add to `ProfilePage.test.tsx`:

```tsx
it('renders competence dashboard metrics without leaderboard language', async () => {
  render(<ProfilePage />)

  expect(await screen.findByText(/total dispatches/i)).toBeInTheDocument()
  expect(screen.getByText(/resolution rate/i)).toBeInTheDocument()
  expect(screen.getByText(/avg response time/i)).toBeInTheDocument()
  expect(screen.queryByText(/leaderboard/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/points/i)).not.toBeInTheDocument()
})
```

Add to `ProfilePage.specializations.test.tsx`:

```tsx
it('renders mastery bars with green amber and muted tiers', async () => {
  render(<ProfilePage />)

  expect(await screen.findByText(/specialization mastery/i)).toBeInTheDocument()
  expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0)
})
```

- [ ] **Step 5: Implement ProfilePage UI**

In `ProfilePage.tsx`, import and call `buildProfileMetrics()` using rows from `useDispatchHistory`. Map the existing history row shape into `HistoryMetricRow` by normalizing timestamp fields through the existing `toMillis` helper if available.

Render:

```tsx
<section className={styles.identityCard}>
  <div className={styles.avatar} aria-hidden="true">
    <User size={28} />
  </div>
  <div>
    <h1>{profile.displayName}</h1>
    <p>{profile.stationLabel}</p>
  </div>
  <div className={styles.statRow}>
    <span><strong>{metrics.totalDispatches}</strong><small>Total Dispatches</small></span>
    <span><strong>{metrics.resolutionRate}%</strong><small>Resolution Rate</small></span>
    <span><strong>{metrics.averageResponseMinutes}m</strong><small>Avg Response Time</small></span>
  </div>
</section>

<section className={styles.card}>
  <h2>Specialization Mastery</h2>
  {metrics.mastery.map((item) => (
    <div key={item.reportType} className={styles.masteryRow}>
      <span>{item.reportType}</span>
      <span>{String(item.resolvedCount)} resolved</span>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={item.percent}
        className={styles.masteryTrack}
      >
        <span className={styles[item.tone]} style={{ width: `${String(item.percent)}%` }} />
      </div>
    </div>
  ))}
</section>
```

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/lib/profile-metrics.test.ts src/pages/ProfilePage.test.tsx src/pages/ProfilePage.specializations.test.tsx
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
```

Expected: PASS, typecheck clean, lint clean.

- [ ] **Step 7: Commit**

```bash
git add apps/responder-app/src/lib/profile-metrics.ts apps/responder-app/src/lib/profile-metrics.test.ts apps/responder-app/src/pages/ProfilePage.tsx apps/responder-app/src/pages/ProfilePage.module.css apps/responder-app/src/pages/ProfilePage.test.tsx apps/responder-app/src/pages/ProfilePage.specializations.test.tsx
git commit -m "feat(responder): add competence profile metrics"
```

### Task 11: Add First-Run Onboarding Overlay

**Files:**

- Create: `apps/responder-app/src/components/OnboardingOverlay.tsx`
- Create: `apps/responder-app/src/components/OnboardingOverlay.module.css`
- Create: `apps/responder-app/src/components/OnboardingOverlay.test.tsx`
- Modify: `apps/responder-app/src/App.tsx`

- [ ] **Step 1: Write onboarding tests**

Create `apps/responder-app/src/components/OnboardingOverlay.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingOverlay } from './OnboardingOverlay'

describe('OnboardingOverlay', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('shows once and stores dismissal in sessionStorage', async () => {
    render(<OnboardingOverlay />)

    expect(screen.getByText(/your dispatch ring fills/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /got it/i }))

    expect(sessionStorage.getItem('bantayog.onboarded')).toBe('true')
    expect(screen.queryByText(/your dispatch ring fills/i)).not.toBeInTheDocument()
  })

  it('does not show after dismissal', () => {
    sessionStorage.setItem('bantayog.onboarded', 'true')
    render(<OnboardingOverlay />)

    expect(screen.queryByText(/your dispatch ring fills/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/components/OnboardingOverlay.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement overlay**

Create `apps/responder-app/src/components/OnboardingOverlay.tsx`:

```tsx
import { useState } from 'react'
import styles from './OnboardingOverlay.module.css'

const STORAGE_KEY = 'bantayog.onboarded'

function hasSeenOnboarding(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function OnboardingOverlay() {
  const [visible, setVisible] = useState(() => !hasSeenOnboarding())

  if (!visible) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // Non-fatal: private mode may block storage.
    }
    setVisible(false)
  }

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <section className={styles.card}>
        <div className={styles.ringDemo} aria-hidden="true" />
        <h2 id="onboarding-title">Your dispatch ring fills as you progress — aim for the close</h2>
        <p>Check Profile to track your response times and personal records.</p>
        <button type="button" onClick={dismiss}>
          Got it
        </button>
      </section>
    </div>
  )
}
```

Create `apps/responder-app/src/components/OnboardingOverlay.module.css` with a fixed warm-black translucent backdrop, elevated card, decorative ring, and 48px amber button.

- [ ] **Step 4: Mount overlay**

In `App.tsx`, import and render inside authenticated area after privacy gate:

```tsx
<OnboardingOverlay />
```

Only render it when `user` exists, using a small wrapper if needed.

- [ ] **Step 5: Run verification**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/components/OnboardingOverlay.test.tsx src/App.test.tsx
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
```

Expected: PASS, typecheck clean, lint clean.

- [ ] **Step 6: Commit**

```bash
git add apps/responder-app/src/components/OnboardingOverlay.tsx apps/responder-app/src/components/OnboardingOverlay.module.css apps/responder-app/src/components/OnboardingOverlay.test.tsx apps/responder-app/src/App.tsx
git commit -m "feat(responder): add first-run ring onboarding"
```

### Task 12: Add Mission Complete Summary

**Files:**

- Create: `apps/responder-app/src/lib/mission-summary.ts`
- Create: `apps/responder-app/src/lib/mission-summary.test.ts`
- Create: `apps/responder-app/src/pages/MissionCompletePage.tsx`
- Create: `apps/responder-app/src/pages/MissionCompletePage.module.css`
- Create: `apps/responder-app/src/pages/MissionCompletePage.test.tsx`
- Modify: `apps/responder-app/src/routes.tsx`
- Modify: `apps/responder-app/src/routes.test.tsx`
- Modify: `apps/responder-app/src/pages/DispatchDetailPage.tsx`
- Modify: `apps/responder-app/src/pages/DispatchListPage.tsx`

- [ ] **Step 1: Write mission-summary tests**

Create `apps/responder-app/src/lib/mission-summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildMissionSummary } from './mission-summary'

describe('mission-summary', () => {
  it('computes transition and total time breakdown', () => {
    const summary = buildMissionSummary({
      acceptedAt: 0,
      enRouteAt: 120_000,
      onSceneAt: 300_000,
      resolvedAt: 900_000,
      previousFastestMs: 1_200_000,
    })

    expect(summary.rows).toEqual([
      { label: 'Accepted → En Route', minutes: 2 },
      { label: 'En Route → On Scene', minutes: 3 },
      { label: 'On Scene → Resolved', minutes: 10 },
    ])
    expect(summary.totalMinutes).toBe(15)
    expect(summary.personalRecord).toBe('Fastest response this month')
  })

  it('omits personal record when total is not a best', () => {
    const summary = buildMissionSummary({
      acceptedAt: 0,
      enRouteAt: 60_000,
      onSceneAt: 120_000,
      resolvedAt: 240_000,
      previousFastestMs: 120_000,
    })

    expect(summary.personalRecord).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/lib/mission-summary.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement summary helper**

Create `apps/responder-app/src/lib/mission-summary.ts`:

```ts
interface Input {
  acceptedAt: number | null
  enRouteAt: number | null
  onSceneAt: number | null
  resolvedAt: number | null
  previousFastestMs: number | null
}

function minutesBetween(start: number | null, end: number | null): number {
  if (start === null || end === null || end < start) return 0
  return Math.round((end - start) / 60_000)
}

export function buildMissionSummary(input: Input) {
  const totalMs =
    input.acceptedAt !== null && input.resolvedAt !== null && input.resolvedAt >= input.acceptedAt
      ? input.resolvedAt - input.acceptedAt
      : 0

  return {
    rows: [
      { label: 'Accepted → En Route', minutes: minutesBetween(input.acceptedAt, input.enRouteAt) },
      { label: 'En Route → On Scene', minutes: minutesBetween(input.enRouteAt, input.onSceneAt) },
      { label: 'On Scene → Resolved', minutes: minutesBetween(input.onSceneAt, input.resolvedAt) },
    ],
    totalMinutes: Math.round(totalMs / 60_000),
    personalRecord:
      input.previousFastestMs !== null && totalMs > 0 && totalMs < input.previousFastestMs
        ? 'Fastest response this month'
        : null,
  }
}
```

- [ ] **Step 4: Add page tests**

Create `apps/responder-app/src/pages/MissionCompletePage.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MissionCompletePage } from './MissionCompletePage'

vi.mock('../hooks/useDispatch', () => ({
  useDispatch: () => ({
    dispatch: {
      dispatchId: 'd-1',
      reportId: 'r-1',
      acceptedAt: 0,
      enRouteAt: 120_000,
      onSceneAt: 300_000,
      resolvedAt: 900_000,
    },
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useReport', () => ({
  useReport: () => ({
    report: { reportType: 'flood', municipalityLabel: 'Daet', municipalityId: 'daet' },
  }),
}))

describe('MissionCompletePage', () => {
  it('renders mission complete summary and actions', () => {
    render(
      <MemoryRouter>
        <MissionCompletePage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/mission complete/i)).toBeInTheDocument()
    expect(screen.getByText(/time breakdown/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to dispatches/i })).toHaveAttribute('href', '/')
  })
})
```

- [ ] **Step 5: Implement page and route**

Create `MissionCompletePage.tsx` using `useParams`, `useDispatch`, `useReport`, `buildMissionSummary`, and Lucide `CheckCircle`. Add route:

```tsx
{ path: '/dispatches/:dispatchId/summary', element: <MissionCompletePage /> },
```

After successful resolve in `DispatchDetailPage`, navigate:

```tsx
void navigate(`/dispatches/${dispatchId}/summary`)
```

Resolved ring card in `DispatchListPage` should link to the same summary route with label `View Summary`.

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/lib/mission-summary.test.ts src/pages/MissionCompletePage.test.tsx src/routes.test.tsx src/pages/DispatchDetailPage.test.tsx src/pages/DispatchListPage.test.tsx
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
```

Expected: PASS, typecheck clean, lint clean.

- [ ] **Step 7: Commit**

```bash
git add apps/responder-app/src/lib/mission-summary.ts apps/responder-app/src/lib/mission-summary.test.ts apps/responder-app/src/pages/MissionCompletePage.tsx apps/responder-app/src/pages/MissionCompletePage.module.css apps/responder-app/src/pages/MissionCompletePage.test.tsx apps/responder-app/src/routes.tsx apps/responder-app/src/routes.test.tsx apps/responder-app/src/pages/DispatchDetailPage.tsx apps/responder-app/src/pages/DispatchListPage.tsx
git commit -m "feat(responder): add mission complete summary"
```

### Task 13: Restyle Remaining Pages And Remove Emoji UI

**Files:**

- Modify: `apps/responder-app/src/pages/BackupRequestPage.tsx`
- Modify: `apps/responder-app/src/pages/BackupRequestPage.module.css`
- Modify: `apps/responder-app/src/pages/DispatchHistoryPage.tsx`
- Modify: `apps/responder-app/src/pages/DispatchHistoryPage.module.css`
- Modify: `apps/responder-app/src/pages/ShiftHandoffPage.tsx`
- Modify: `apps/responder-app/src/pages/ShiftHandoffPage.module.css`
- Modify: `apps/responder-app/src/pages/ResponderWitnessReportPage.tsx`
- Modify: `apps/responder-app/src/pages/LoginPage.tsx`
- Modify: `apps/responder-app/src/pages/LoginPage.module.css`
- Modify: `apps/responder-app/src/pages/TotpEnrollmentPage.tsx`
- Modify: `apps/responder-app/src/pages/TotpEnrollmentPage.module.css`
- Modify: `apps/responder-app/src/pages/TotpGuard.module.css`
- Modify: `apps/responder-app/src/pages/CancelledScreen.tsx`
- Modify: `apps/responder-app/src/pages/RaceLossScreen.tsx`
- Modify: `apps/responder-app/src/pages/TerminalScreen.module.css`
- Test: existing page test files beside each page.

- [ ] **Step 1: Add emoji regression test**

Add this test to `apps/responder-app/src/routes.test.tsx` or a new `src/no-emoji-ui.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const files = [
  'src/pages/DispatchDetailPage.tsx',
  'src/pages/DispatchListPage.tsx',
  'src/pages/MessagesPage.tsx',
  'src/pages/ProfilePage.tsx',
  'src/pages/SosPage.tsx',
]

describe('responder UI emoji policy', () => {
  it('does not render emoji glyphs in operational pages', () => {
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      expect(source).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
      expect(source).not.toContain('✓')
    }
  })
})
```

If `MessagesPage.tsx` is deleted or route-retired, remove it from the list and document that in `docs/progress.md`.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/no-emoji-ui.test.ts
```

Expected: FAIL because several pages still contain emoji or checkmark glyphs.

- [ ] **Step 3: Replace emoji with Lucide icons**

Use Lucide icons:

- `CheckCircle` for all-clear or terminal success.
- `MessageCircle` for contact/admin message.
- `ClipboardList` for witness report.
- `User` for avatar.
- `Siren` for SOS.
- `ArrowRight` for text links only if the visible `→` is treated as a glyph policy violation.

Each icon-only button or link must have an `aria-label`.

- [ ] **Step 4: Apply dark form styling**

For each remaining page CSS module, use the same base:

```css
.page {
  min-height: 100svh;
  padding: 20px 16px;
  background: var(--bg-black);
  color: var(--text-primary);
}

.card,
.formCard {
  border: 1px solid var(--border-default);
  border-radius: 22px;
  background: var(--surface-elevated);
}

.primaryButton {
  min-height: 48px;
  border: 0;
  border-radius: 999px;
  background: var(--amber-accent);
  color: var(--bg-black);
  font-weight: 700;
}
```

Do not rename existing CSS classes unless tests require it; prefer updating class bodies.

- [ ] **Step 5: Run page tests**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run src/pages/BackupRequestPage.test.tsx src/pages/DispatchHistoryPage.test.tsx src/pages/ShiftHandoffPage.test.tsx src/pages/ResponderWitnessReportPage.test.tsx src/pages/LoginPage.test.tsx src/pages/TotpEnrollmentPage.test.tsx src/pages/CancelledScreen.test.tsx src/pages/RaceLossScreen.test.tsx src/no-emoji-ui.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
```

Expected: typecheck clean, lint clean.

- [ ] **Step 7: Commit**

```bash
git add apps/responder-app/src/pages apps/responder-app/src/no-emoji-ui.test.ts
git commit -m "style(responder): dark-theme remaining flows"
```

### Task 14: Full App Verification And Documentation

**Files:**

- Modify: `docs/learnings.md`
- Modify: `docs/progress.md`

- [ ] **Step 1: Run full responder tests**

Run:

```bash
pnpm --dir apps/responder-app exec vitest run
```

Expected: all responder app tests pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm --dir apps/responder-app typecheck
```

Expected: clean output.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm --dir apps/responder-app lint
```

Expected: clean output.

- [ ] **Step 4: Run build**

Run:

```bash
pnpm --dir apps/responder-app build
```

Expected: TypeScript and Vite build succeed. If Vite reports non-fatal chunk warnings, inspect whether new dependencies caused avoidable bundle bloat before accepting.

- [ ] **Step 5: Update learnings**

Append to `docs/learnings.md` under `## Responder PWA / Frontend Build`:

```md
- Responder offline transition state must use an app-owned localForage instance (`bantayog-responder`) and app-level retry orchestration; do not hide queued state inside individual action buttons or users lose sync visibility across routes.
- Responder redesign uses three operational tabs only. Message/admin communication remains a secondary action from dispatch detail unless product explicitly restores a Messages tab.
```

- [ ] **Step 6: Update progress**

Append to the top of `docs/progress.md`:

```md
## Current Status (2026-05-13)

**Responder App Redesign — Warm-Black Operations UI**

- ✅ Applied warm-black responder design tokens and smartphone-first shell.
- ✅ Replaced main navigation with Dispatches, Map, and Profile.
- ✅ Added dispatch countdown/progress rings, accessible timeline, field-note draft autosave, offline transition queue, first-run overlay, mission-complete summary, dark map tiles, and competence profile metrics.
- ✅ Removed emoji UI from operational responder pages in favor of Lucide icons.
- **Gate:** `pnpm --dir apps/responder-app exec vitest run` pass · `pnpm --dir apps/responder-app typecheck` pass · `pnpm --dir apps/responder-app lint` pass · `pnpm --dir apps/responder-app build` pass.
```

Only write the `✅` gate line after commands actually pass. If any command fails, record the blocker instead.

- [ ] **Step 7: Show diff**

Run:

```bash
git diff --stat
git diff -- apps/responder-app docs/learnings.md docs/progress.md
```

Expected: diff only contains responder redesign and doc updates.

- [ ] **Step 8: Commit**

```bash
git add docs/learnings.md docs/progress.md
git commit -m "docs(responder): record redesign completion"
```

---

## Final Verification Gate

Run from repo root:

```bash
pnpm --dir apps/responder-app exec vitest run
pnpm --dir apps/responder-app typecheck
pnpm --dir apps/responder-app lint
pnpm --dir apps/responder-app build
git diff --check
```

Expected:

- Vitest: all responder tests pass.
- TypeScript: no errors.
- ESLint: no warnings or errors.
- Build: succeeds.
- `git diff --check`: no whitespace errors.

If root-level confidence is required before PR:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: monorepo gates pass or failures are verified as pre-existing and unrelated.

---

## Self-Review

Spec coverage:

- Palette, typography, elevation, motion, touch targets: Task 1 and page CSS tasks.
- Shell header/tab redesign: Task 2.
- Dispatch list ring cards, empty state, error banner, auto-redirect preservation: Tasks 3 and 4.
- Offline transition resilience: Tasks 5 and 6.
- Dispatch detail header, timeline, incident card, state actions, pre-arrival info, field-note drafts, terminal surfaces: Tasks 7 and 13.
- Map dark tiles, markers, legend, recenter, GPS lifecycle preservation: Task 9.
- Profile competence dashboard, mastery bars, personal best data foundation: Task 10.
- First-run overlay: Task 11.
- Mission complete summary: Task 12.
- SOS, backup, history, handoff, witness, login, TOTP, terminal restyles and emoji removal: Tasks 8 and 13.
- Docs and full verification: Task 14.

Known scope boundaries:

- No backend schema, callable, Firebase rules, or index changes.
- No deployment.
- Messages route is retired from the shell per approved spec. If product wants to preserve messages as a secondary deep link, implement it as an explicit follow-up rather than keeping the old tab.
- The offline queue plan assumes transition callables can be reached through a shared client wrapper. If existing hooks do not expose callable clients cleanly, extract those wrappers before wiring global queue drain.

Placeholder scan:

- The plan avoids unresolved placeholder markers and includes explicit stop conditions where implementation may branch.
- Steps with possible branching include exact commands and expected outcomes.
