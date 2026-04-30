# Citizen PWA UI Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the production citizen PWA with the reference Tailwind/framer-motion design system — animated splash, 3-step onboarding, floating Report nav, radar-pulse ceremony, Google-Maps-style map chrome, Facebook-inspired feed — while keeping all 203 existing tests green and all Firebase/XState/offline logic untouched.

**Architecture:** Tailwind CSS replaces inline styles; framer-motion drives page transitions, splash, onboarding, navbar spring indicator, offline banner, toast, and the report ceremony. A new `RootLayout` route wrapper owns the SplashScreen overlay and navigates to onboarding on first run. All business logic files are read-only.

**Tech Stack:** React 19, framer-motion ^12, Tailwind CSS ^3.4, Zustand ^5, Lucide React, Vitest + happy-dom

**Spec:** `docs/superpowers/specs/2026-04-30-citizen-pwa-ui-restyle-design.md`

**Branch:** `fix/citizen-pwa-redesign-spec-gaps`

**Working directory for all commands:** `apps/citizen-pwa`

---

## File Map

| File                                    | Action         | Owns                                                                                 |
| --------------------------------------- | -------------- | ------------------------------------------------------------------------------------ |
| `package.json`                          | UPDATE         | framer-motion dep + tailwind devDeps                                                 |
| `tailwind.config.js`                    | CREATE         | Full token system (brand, surface, semantic, shadows, keyframes)                     |
| `postcss.config.js`                     | CREATE         | Tailwind + autoprefixer                                                              |
| `vitest.config.ts`                      | UPDATE         | Add framer-motion setup file                                                         |
| `src/__tests__/setup-framer-motion.ts`  | CREATE         | Global framer-motion mock for tests                                                  |
| `src/styles/design-tokens.css`          | REPLACE        | Tailwind directives + CSS custom properties                                          |
| `src/lib/design-tokens.ts`              | DELETE         | Superseded by Tailwind config                                                        |
| `src/lib/uiStore.ts`                    | CREATE         | navDirection + hasCompletedOnboarding (UI-only Zustand)                              |
| `src/hooks/useSlotMachine.ts`           | CREATE         | rAF-based slot machine text reveal                                                   |
| `public/watchtower.svg`                 | COPY           | Onboarding illustration                                                              |
| `src/pages/SplashScreen.tsx`            | CREATE         | 1.5s radar-ring animated entry screen                                                |
| `src/pages/Onboarding.tsx`              | CREATE         | 3-step swipeable first-run flow                                                      |
| `src/routes.tsx`                        | UPDATE         | RootLayout wrapper + /onboarding route                                               |
| `src/components/CitizenShell.tsx`       | RESTYLE        | New navbar (floating Report btn, spring indicator, page transitions, offline banner) |
| `src/components/ReceiptScreen.tsx`      | RESTYLE        | Radar-pulse ceremony (no confetti)                                                   |
| `src/components/FeedTab.tsx`            | RESTYLE        | Facebook-inspired card feed                                                          |
| `src/components/AlertsTab.tsx`          | RESTYLE        | Severity-left-border cards                                                           |
| `src/components/ProfileTab.tsx`         | RESTYLE        | Auth-aware stats + settings gear                                                     |
| `src/pages/SettingsPage.tsx`            | RESTYLE        | Grouped list sections                                                                |
| `src/pages/RegisterPage.tsx`            | RESTYLE        | Step dots + branded inputs                                                           |
| `src/components/LookupScreen.tsx`       | RESTYLE        | Mono code inputs + brand CTA                                                         |
| `src/components/RevealSheet.tsx`        | RESTYLE        | Sheet container + secret code display                                                |
| `src/components/Toast.tsx`              | RESTYLE        | framer-motion slide + semantic colors                                                |
| `src/components/Toggle.tsx`             | RESTYLE        | brand-500 active state                                                               |
| `src/components/MapTab/index.tsx`       | RESTYLE CHROME | Search pill + filter chips + location FAB                                            |
| `src/components/MapTab/PeekSheet.tsx`   | RESTYLE CHROME | Google Maps-style bottom card container                                              |
| `src/components/MapTab/DetailSheet.tsx` | RESTYLE CHROME | Full-detail sheet container                                                          |
| `src/App.routes.test.tsx`               | UPDATE         | Add SplashScreen/Onboarding mocks; remove banner check                               |

---

## Task 1: Install Dependencies and Build Toolchain

**Files:**

- Modify: `apps/citizen-pwa/package.json`
- Create: `apps/citizen-pwa/tailwind.config.js`
- Create: `apps/citizen-pwa/postcss.config.js`

- [ ] **Step 1: Add framer-motion to dependencies and Tailwind toolchain to devDependencies**

Edit `package.json` — add inside `"dependencies"`:

```json
"framer-motion": "^12.0.0"
```

Add inside `"devDependencies"`:

```json
"tailwindcss": "^3.4.19",
"autoprefixer": "^10.4.23",
"postcss": "^8.5.6",
"tailwindcss-animate": "^1.0.7"
```

- [ ] **Step 2: Create Tailwind config**

Create `apps/citizen-pwa/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          600: '#0D7377',
          500: '#0F9488',
          400: '#4DB6A8',
          300: '#8FD4CA',
          200: '#C4E8E2',
          100: '#E8F6F3',
          50: '#F3FAF9',
        },
        danger: { 600: '#C21F1F', 500: '#DC2626', 400: '#EF4444' },
        warning: { 500: '#D97706', 400: '#F59E0B' },
        success: { 500: '#059669', 400: '#10B981' },
        info: { 500: '#2563EB', 400: '#3B82F6' },
        surface: {
          950: '#171A1A',
          900: '#25292A',
          800: '#333A3B',
          700: '#414849',
          600: '#4F5859',
          500: '#5E6667',
          400: '#768081',
          300: '#A3ADAE',
          200: '#D5DEDD',
          100: '#F0F4F4',
          50: '#F8FAFA',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        md: '0 4px 12px rgba(0,0,0,0.08)',
        lg: '0 8px 24px rgba(0,0,0,0.12)',
        'glow-teal': '0 0 24px rgba(15,148,136,0.3)',
        'glow-red': '0 0 24px rgba(220,38,38,0.3)',
        'glow-success': '0 0 24px rgba(5,150,105,0.3)',
      },
      zIndex: {
        float: '20',
        nav: '30',
        modal: '40',
        toast: '50',
        splash: '60',
        emergency: '70',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(15,148,136,0.2)' },
          '50%': { boxShadow: '0 0 24px rgba(15,148,136,0.5)' },
        },
        'pulse-scale': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite linear',
        'pulse-glow': 'pulse-glow 1.5s ease-in-out 3',
        'pulse-scale': 'pulse-scale 1.5s ease-in-out 3',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
```

- [ ] **Step 3: Create PostCSS config**

Create `apps/citizen-pwa/postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 4: Install**

```bash
cd apps/citizen-pwa && pnpm install
```

Expected: no errors; `framer-motion` and `tailwindcss` appear in `node_modules`.

- [ ] **Step 5: Commit**

```bash
git add apps/citizen-pwa/package.json apps/citizen-pwa/tailwind.config.js apps/citizen-pwa/postcss.config.js apps/citizen-pwa/pnpm-lock.yaml
git commit -m "chore(citizen-pwa): add framer-motion + tailwind toolchain"
```

---

## Task 2: Replace CSS Design Tokens

**Files:**

- Replace: `apps/citizen-pwa/src/styles/design-tokens.css`
- Delete: `apps/citizen-pwa/src/lib/design-tokens.ts`

- [ ] **Step 1: Check for imports of design-tokens.ts**

```bash
grep -r "design-tokens" apps/citizen-pwa/src --include="*.ts" --include="*.tsx"
```

Expected: only `apps/citizen-pwa/src/components/CitizenShell.tsx` imports `'../styles/design-tokens.css'` (the CSS file, not the TS file). If the TS file is imported anywhere else, remove those import lines before proceeding.

- [ ] **Step 2: Replace design-tokens.css**

Overwrite `apps/citizen-pwa/src/styles/design-tokens.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --surface-950: #171a1a;
    --surface-900: #25292a;
    --surface-800: #333a3b;
    --surface-700: #414849;
    --surface-600: #4f5859;
    --surface-500: #5e6667;
    --surface-400: #768081;
    --surface-300: #a3adae;
    --surface-200: #d5dedd;
    --surface-100: #f0f4f4;
    --surface-50: #f8fafa;

    --brand-600: #0d7377;
    --brand-500: #0f9488;
    --brand-400: #4db6a8;
    --brand-300: #8fd4ca;
    --brand-200: #c4e8e2;
    --brand-100: #e8f6f3;
    --brand-50: #f3faf9;

    --danger-500: #dc2626;
    --warning-500: #d97706;
    --success-500: #059669;
    --info-500: #2563eb;

    /* Safe area insets */
    --sat: env(safe-area-inset-top, 0px);
    --sar: env(safe-area-inset-right, 0px);
    --sab: env(safe-area-inset-bottom, 0px);
    --sal: env(safe-area-inset-left, 0px);
  }

  * {
    -webkit-tap-highlight-color: transparent;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background-color: var(--surface-100);
    color: var(--surface-900);
    overscroll-behavior-y: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-size: 16px;
    line-height: 1.6;
  }

  h1,
  h2,
  h3,
  h4 {
    text-wrap: balance;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

- [ ] **Step 3: Delete design-tokens.ts**

```bash
rm apps/citizen-pwa/src/lib/design-tokens.ts
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/citizen-pwa && pnpm typecheck
```

Expected: 0 errors. If any file complains about missing `design-tokens` import, remove that import.

- [ ] **Step 5: Commit**

```bash
git add apps/citizen-pwa/src/styles/design-tokens.css
git rm apps/citizen-pwa/src/lib/design-tokens.ts
git commit -m "chore(citizen-pwa): replace CSS tokens with Tailwind design system"
```

---

## Task 3: Add framer-motion Test Mock

**Files:**

- Create: `apps/citizen-pwa/src/__tests__/setup-framer-motion.ts`
- Modify: `apps/citizen-pwa/vitest.config.ts`

framer-motion's animation engine uses browser APIs (`requestAnimationFrame`, `ResizeObserver`) that can cause spurious `act()` warnings in happy-dom. This mock stubs every `motion.*` element as a plain HTML tag, making tests fast and warning-free.

- [ ] **Step 1: Create the mock setup file**

Create `apps/citizen-pwa/src/__tests__/setup-framer-motion.ts`:

```ts
import { vi } from 'vitest'
import { createElement, forwardRef } from 'react'
import type { ReactNode } from 'react'

type MotionProps = {
  children?: ReactNode
  initial?: unknown
  animate?: unknown
  exit?: unknown
  transition?: unknown
  variants?: unknown
  whileTap?: unknown
  whileHover?: unknown
  layoutId?: unknown
  custom?: unknown
  drag?: unknown
  dragConstraints?: unknown
  dragElastic?: unknown
  onDragEnd?: unknown
  style?: Record<string, unknown>
  [key: string]: unknown
}

function createMotionComponent(tag: string) {
  return forwardRef<HTMLElement, MotionProps>(
    (
      {
        children,
        initial: _i,
        animate: _a,
        exit: _e,
        transition: _t,
        variants: _v,
        whileTap: _wt,
        whileHover: _wh,
        layoutId: _lid,
        custom: _c,
        drag: _d,
        dragConstraints: _dc,
        dragElastic: _de,
        onDragEnd: _ode,
        ...rest
      },
      ref,
    ) => createElement(tag, { ...rest, ref }, children),
  )
}

vi.mock('framer-motion', () => ({
  motion: new Proxy({} as Record<string, ReturnType<typeof createMotionComponent>>, {
    get: (_t, key: string) => createMotionComponent(key),
  }),
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  useMotionValue: () => ({ get: () => 0, set: () => {}, on: () => () => {} }),
  useAnimation: () => ({ start: () => Promise.resolve(), stop: () => {}, set: () => {} }),
  useTransform: () => ({ get: () => 0 }),
  useDragControls: () => ({}),
}))
```

- [ ] **Step 2: Register the setup file in vitest.config.ts**

Edit `apps/citizen-pwa/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['@testing-library/jest-dom/vitest', 'src/__tests__/setup-framer-motion.ts'],
  },
})
```

- [ ] **Step 3: Run tests — must still be 203 passing**

```bash
cd apps/citizen-pwa && npx vitest run
```

Expected: all existing tests pass. 0 framer-motion-related errors (framer-motion is not yet imported by any production file, so the mock just sits idle — this is fine).

- [ ] **Step 4: Commit**

```bash
git add apps/citizen-pwa/src/__tests__/setup-framer-motion.ts apps/citizen-pwa/vitest.config.ts
git commit -m "test(citizen-pwa): add framer-motion mock for vitest"
```

---

## Task 4: Create uiStore

**Files:**

- Create: `apps/citizen-pwa/src/lib/uiStore.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/citizen-pwa/src/__tests__/uiStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../lib/uiStore.js'

beforeEach(() => {
  useUIStore.setState({
    navDirection: 'forward',
    hasCompletedOnboarding: false,
  })
  localStorage.clear()
})

describe('useUIStore', () => {
  it('defaults navDirection to forward', () => {
    expect(useUIStore.getState().navDirection).toBe('forward')
  })

  it('setNavDirection updates navDirection', () => {
    useUIStore.getState().setNavDirection('backward')
    expect(useUIStore.getState().navDirection).toBe('backward')
  })

  it('defaults hasCompletedOnboarding to false when localStorage is empty', () => {
    expect(useUIStore.getState().hasCompletedOnboarding).toBe(false)
  })

  it('setHasCompletedOnboarding persists to localStorage', () => {
    useUIStore.getState().setHasCompletedOnboarding(true)
    expect(useUIStore.getState().hasCompletedOnboarding).toBe(true)
    expect(localStorage.getItem('bantayog_onboarding_complete')).toBe('true')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/citizen-pwa && npx vitest run src/__tests__/uiStore.test.ts
```

Expected: FAIL — `Cannot find module '../lib/uiStore.js'`

- [ ] **Step 3: Implement uiStore**

Create `apps/citizen-pwa/src/lib/uiStore.ts`:

```ts
import { create } from 'zustand'

interface UIState {
  navDirection: 'forward' | 'backward'
  setNavDirection: (d: 'forward' | 'backward') => void
  hasCompletedOnboarding: boolean
  setHasCompletedOnboarding: (v: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  navDirection: 'forward',
  setNavDirection: (navDirection) => set({ navDirection }),

  hasCompletedOnboarding:
    typeof window !== 'undefined' &&
    localStorage.getItem('bantayog_onboarding_complete') === 'true',

  setHasCompletedOnboarding: (v) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bantayog_onboarding_complete', v ? 'true' : 'false')
    }
    set({ hasCompletedOnboarding: v })
  },
}))
```

- [ ] **Step 4: Run test — must pass**

```bash
cd apps/citizen-pwa && npx vitest run src/__tests__/uiStore.test.ts
```

Expected: 4/4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/citizen-pwa/src/lib/uiStore.ts apps/citizen-pwa/src/__tests__/uiStore.test.ts
git commit -m "feat(citizen-pwa): add uiStore for nav direction and onboarding state"
```

---

## Task 5: Create useSlotMachine Hook

**Files:**

- Create: `apps/citizen-pwa/src/hooks/useSlotMachine.ts`

This hook drives the tracking-reference reveal in the receipt ceremony: characters scramble randomly then lock in left-to-right over `durationMs`.

- [ ] **Step 1: Write the failing test**

Create `apps/citizen-pwa/src/hooks/useSlotMachine.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSlotMachine } from './useSlotMachine.js'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useSlotMachine', () => {
  it('starts with empty display before startDelayMs', () => {
    const rafCbs: FrameRequestCallback[] = []
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCbs.push(cb)
      return rafCbs.length
    })

    const { result } = renderHook(() => useSlotMachine('ABC123', 600, 400))
    expect(result.current.display).toBe('')
    expect(result.current.done).toBe(false)
  })

  it('sets display to target and done=true after full duration', () => {
    let frame = 0
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      // simulate time past start + duration
      cb(10000)
      return ++frame
    })

    const { result } = renderHook(() => useSlotMachine('REF-001', 600, 0))
    expect(result.current.display).toBe('REF-001')
    expect(result.current.done).toBe(true)
  })

  it('cleans up requestAnimationFrame on unmount', () => {
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame')
    vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(99)

    const { unmount } = renderHook(() => useSlotMachine('X', 100, 0))
    unmount()
    expect(cancelSpy).toHaveBeenCalledWith(99)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/citizen-pwa && npx vitest run src/hooks/useSlotMachine.test.ts
```

Expected: FAIL — `Cannot find module './useSlotMachine.js'`

- [ ] **Step 3: Implement useSlotMachine**

Create `apps/citizen-pwa/src/hooks/useSlotMachine.ts`:

```ts
import { useState, useEffect } from 'react'

const SLOT_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function useSlotMachine(
  target: string,
  durationMs: number,
  startDelayMs: number,
): { display: string; done: boolean } {
  const [display, setDisplay] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let frame: number
    const startTime = performance.now() + startDelayMs
    const endTime = startTime + durationMs

    const tick = (now: number) => {
      if (now < startTime) {
        setDisplay('')
        frame = requestAnimationFrame(tick)
        return
      }
      if (now >= endTime) {
        setDisplay(target)
        setDone(true)
        return
      }
      const progress = (now - startTime) / durationMs
      const settled = Math.floor(progress * target.length)
      let result = ''
      for (let i = 0; i < target.length; i++) {
        result +=
          i < settled ? target[i] : SLOT_CHARS[Math.floor(Math.random() * SLOT_CHARS.length)]
      }
      setDisplay(result)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, startDelayMs])

  return { display, done }
}
```

- [ ] **Step 4: Run test — must pass**

```bash
cd apps/citizen-pwa && npx vitest run src/hooks/useSlotMachine.test.ts
```

Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/citizen-pwa/src/hooks/useSlotMachine.ts apps/citizen-pwa/src/hooks/useSlotMachine.test.ts
git commit -m "feat(citizen-pwa): add useSlotMachine hook for tracking-ref reveal"
```

---

## Task 6: Copy Watchtower SVG

**Files:**

- Create: `apps/citizen-pwa/public/watchtower.svg`

- [ ] **Step 1: Copy the SVG from the reference build**

```bash
cp /Users/superman/Downloads/Citizen_PWA/app/dist/watchtower.svg \
   apps/citizen-pwa/public/watchtower.svg
```

- [ ] **Step 2: Verify**

```bash
file apps/citizen-pwa/public/watchtower.svg
```

Expected: `SVG Scalable Vector Graphics image`

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/public/watchtower.svg
git commit -m "feat(citizen-pwa): add watchtower SVG illustration for onboarding"
```

---

## Task 7: Create SplashScreen

**Files:**

- Create: `apps/citizen-pwa/src/pages/SplashScreen.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/citizen-pwa/src/pages/SplashScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// navigate spy — must be hoisted
const navigateSpy = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateSpy }
})

vi.mock('../lib/uiStore.js', () => ({
  useUIStore: (sel: (s: { hasCompletedOnboarding: boolean }) => unknown) =>
    sel({ hasCompletedOnboarding: false }),
}))

beforeEach(() => {
  vi.useFakeTimers()
  navigateSpy.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('SplashScreen', () => {
  async function renderSplash() {
    const { SplashScreen } = await import('./SplashScreen.js')
    return render(
      <MemoryRouter>
        <SplashScreen onDone={navigateSpy} />
      </MemoryRouter>,
    )
  }

  it('shows BANTAYOG wordmark', async () => {
    await renderSplash()
    expect(screen.getByText('BANTAYOG')).toBeInTheDocument()
  })

  it('calls onDone after 1.6s', async () => {
    await renderSplash()
    expect(navigateSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1600)
    expect(navigateSpy).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/citizen-pwa && npx vitest run src/pages/SplashScreen.test.tsx
```

Expected: FAIL — `Cannot find module './SplashScreen.js'`

- [ ] **Step 3: Implement SplashScreen**

Create `apps/citizen-pwa/src/pages/SplashScreen.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield } from 'lucide-react'
import { useUIStore } from '../lib/uiStore.js'
import { useNavigate } from 'react-router-dom'

const STATUS_MESSAGES = [
  'Initializing emergency services...',
  'Connecting to watchtower...',
  'Loading Camarines Norte map data...',
]

const EASE_REVEAL: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface SplashScreenProps {
  onDone?: () => void
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const navigate = useNavigate()
  const hasCompletedOnboarding = useUIStore((s) => s.hasCompletedOnboarding)
  const [visible, setVisible] = useState(true)
  const [statusIndex, setStatusIndex] = useState(0)

  const finish = useCallback(() => {
    setVisible(false)
    if (onDone) {
      onDone()
      return
    }
    setTimeout(() => {
      void navigate(hasCompletedOnboarding ? '/' : '/onboarding', { replace: true })
    }, 100)
  }, [hasCompletedOnboarding, navigate, onDone])

  useEffect(() => {
    const timer = setTimeout(finish, 1600)
    return () => clearTimeout(timer)
  }, [finish])

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_MESSAGES.length)
    }, 800)
    return () => clearInterval(interval)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-splash flex flex-col items-center justify-center"
          style={{
            background: 'radial-gradient(circle at center, #0F172A 0%, #0F9488 100%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Radar rings + shield */}
          <div className="relative flex items-center justify-center w-[300px] h-[300px]">
            {[80, 160, 240].map((size, i) => (
              <motion.div
                key={size}
                className="absolute rounded-full border-2 border-white/30"
                style={{ width: size, height: size }}
                animate={{ scale: [0.5, 1.5], opacity: [0.6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: i * 0.4 }}
              />
            ))}
            <motion.div
              className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.1)',
                boxShadow: '0 0 20px rgba(13,148,136,0.5), 0 0 60px rgba(13,148,136,0.2)',
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2, ease: EASE_REVEAL }}
            >
              <Shield size={32} strokeWidth={1.5} className="text-white" />
            </motion.div>
          </div>

          {/* Wordmark */}
          <motion.div
            className="flex flex-col items-center mt-6"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4, ease: EASE_REVEAL }}
          >
            <h1 className="text-white text-[32px] font-extrabold tracking-[4px]">BANTAYOG</h1>
            <span className="text-white/70 text-[18px] font-normal tracking-[8px] mt-1">ALERT</span>
          </motion.div>

          {/* Cycling status */}
          <motion.div
            className="mt-4 h-6 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <AnimatePresence mode="wait">
              <motion.p
                key={statusIndex}
                className="text-white/50 text-sm text-center"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.3 }}
              >
                {STATUS_MESSAGES[statusIndex]}
              </motion.p>
            </AnimatePresence>
          </motion.div>

          {/* Progress bar — 1.5s */}
          <motion.div
            className="mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.4 }}
          >
            <div
              className="w-[200px] h-[3px] rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #0F9488, #14B8A6)',
                  boxShadow: '0 0 8px #14B8A6',
                }}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.5, ease: 'linear', delay: 0.2 }}
              />
            </div>
          </motion.div>

          <motion.p
            className="absolute bottom-8 text-white/30 text-[11px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
          >
            v1.0 · Camarines Norte
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: Run test — must pass**

```bash
cd apps/citizen-pwa && npx vitest run src/pages/SplashScreen.test.tsx
```

Expected: 2/2 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/citizen-pwa/src/pages/SplashScreen.tsx apps/citizen-pwa/src/pages/SplashScreen.test.tsx
git commit -m "feat(citizen-pwa): add animated SplashScreen (1.5s radar rings)"
```

---

## Task 8: Create Onboarding

**Files:**

- Create: `apps/citizen-pwa/src/pages/Onboarding.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/citizen-pwa/src/pages/Onboarding.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const navigateSpy = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateSpy }
})

const setDoneSpy = vi.hoisted(() => vi.fn())
vi.mock('../lib/uiStore.js', () => ({
  useUIStore: (
    sel: (s: {
      hasCompletedOnboarding: boolean
      setHasCompletedOnboarding: typeof setDoneSpy
    }) => unknown,
  ) => sel({ hasCompletedOnboarding: false, setHasCompletedOnboarding: setDoneSpy }),
}))

async function renderOnboarding() {
  const { Onboarding } = await import('./Onboarding.js')
  return render(
    <MemoryRouter>
      <Onboarding />
    </MemoryRouter>,
  )
}

describe('Onboarding', () => {
  it('renders step 0 — Welcome', async () => {
    await renderOnboarding()
    expect(screen.getByText(/welcome to bantayog/i)).toBeInTheDocument()
  })

  it('cannot advance from step 1 without consent', async () => {
    await renderOnboarding()
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    expect(screen.getByText(/your privacy matters/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    // still on step 1
    expect(screen.getByText(/your privacy matters/i)).toBeInTheDocument()
  })

  it('completes onboarding and navigates to /', async () => {
    await renderOnboarding()
    // Step 0 → 1
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    // Give consent
    fireEvent.click(screen.getByRole('checkbox', { name: /agree/i }))
    // Step 1 → 2
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/three steps/i)).toBeInTheDocument()
    // Step 2 → done
    fireEvent.click(screen.getByRole('button', { name: /start reporting/i }))
    expect(setDoneSpy).toHaveBeenCalledWith(true)
    expect(navigateSpy).toHaveBeenCalledWith('/', { replace: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/citizen-pwa && npx vitest run src/pages/Onboarding.test.tsx
```

Expected: FAIL — `Cannot find module './Onboarding.js'`

- [ ] **Step 3: Implement Onboarding**

Create `apps/citizen-pwa/src/pages/Onboarding.tsx`:

```tsx
import { useState, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue } from 'framer-motion'
import { EyeOff, Shield, Scale, AlertTriangle, Send, ShieldCheck, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../lib/uiStore.js'

const EASE_SMOOTH: [number, number, number, number] = [0.4, 0, 0.2, 1]
const EASE_ANTICIPATE: [number, number, number, number] = [0.34, 1.56, 0.64, 1]

/* ── Step 0: Welcome ── */
function StepWelcome() {
  return (
    <div className="flex flex-col items-center px-6 pt-8 pb-4">
      <motion.div
        className="w-full max-w-[280px] h-[200px] flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE_ANTICIPATE }}
      >
        <img
          src="/watchtower.svg"
          alt="Watchtower illustration"
          className="w-full h-full object-contain"
        />
      </motion.div>

      <motion.h2
        className="text-[28px] font-bold text-surface-900 text-center mt-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: EASE_SMOOTH }}
      >
        Welcome to Bantayog
      </motion.h2>
      <motion.p
        className="text-[18px] font-semibold text-surface-500 text-center mt-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: EASE_SMOOTH }}
      >
        Your community watchtower
      </motion.p>
      <motion.p
        className="text-base text-surface-700 text-center mt-6 max-w-[320px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: EASE_SMOOTH }}
      >
        Report emergencies in Camarines Norte quickly and safely. Your reports help responders reach
        those in need faster.
      </motion.p>
      <motion.div
        className="mt-8 px-4 py-2 rounded-full bg-brand-500/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25, ease: EASE_SMOOTH }}
      >
        <span className="text-xs font-medium text-brand-500">Bayanihan sa Panahon ng Sakuna</span>
      </motion.div>
    </div>
  )
}

/* ── Step 1: Privacy ── */
const PRIVACY_CARDS = [
  {
    Icon: EyeOff,
    title: 'Report without an account',
    body: 'No registration needed. Start reporting immediately with a temporary ID.',
    color: '#0F9488',
  },
  {
    Icon: Shield,
    title: 'Your data is protected',
    body: 'Photos have location data removed. Contact info is only visible to emergency staff.',
    color: '#059669',
  },
  {
    Icon: Scale,
    title: 'Transparency first',
    body: 'We cannot guarantee complete anonymity under court orders. This is stated honestly.',
    color: '#D97706',
  },
]

function StepPrivacy({
  onConsentChange,
  consentError,
}: {
  onConsentChange: (v: boolean) => void
  consentError: boolean
}) {
  const [checked, setChecked] = useState(false)

  const toggle = useCallback(() => {
    const next = !checked
    setChecked(next)
    onConsentChange(next)
  }, [checked, onConsentChange])

  return (
    <div className="flex flex-col px-6 pt-8 pb-4">
      <motion.h2
        className="text-[28px] font-bold text-surface-900 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_SMOOTH }}
      >
        Your privacy matters
      </motion.h2>

      <div className="mt-8 space-y-4">
        {PRIVACY_CARDS.map(({ Icon, title, body, color }, i) => (
          <motion.div
            key={title}
            className="bg-white rounded-lg p-4 shadow-md"
            style={{ borderLeft: `3px solid ${color}` }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1, ease: EASE_SMOOTH }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}15` }}
              >
                <Icon size={20} style={{ color }} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-surface-900">{title}</h3>
                <p className="text-xs text-surface-500 mt-1 leading-relaxed">{body}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4, ease: EASE_SMOOTH }}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            aria-label="I agree to the Terms of Use and Privacy Notice"
            checked={checked}
            onChange={toggle}
            className="sr-only"
          />
          <div
            className={`relative w-6 h-6 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors duration-200 ${
              checked
                ? 'bg-brand-500 border-brand-500'
                : consentError
                  ? 'border-danger-500'
                  : 'border-surface-200'
            }`}
          >
            <motion.svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <motion.path
                d="M2.5 7.5L5.5 10.5L11.5 3.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: checked ? 1 : 0 }}
                transition={{ duration: 0.2, ease: EASE_SMOOTH }}
              />
            </motion.svg>
          </div>
          <span className="text-base text-surface-900 leading-relaxed">
            I have read and agree to the{' '}
            <span className="text-brand-500 font-medium">Terms of Use</span> and{' '}
            <span className="text-brand-500 font-medium">Privacy Notice</span>
          </span>
        </label>
        {consentError && (
          <p className="text-xs text-danger-500 mt-2 ml-9">Please agree to continue</p>
        )}
      </motion.div>
    </div>
  )
}

/* ── Step 2: How It Works ── */
const HOW_STEPS = [
  {
    Icon: AlertTriangle,
    title: 'Report what you see',
    body: 'Choose the incident type, add a photo, and share your location.',
  },
  {
    Icon: Send,
    title: 'Send instantly',
    body: 'Your report goes directly to your municipal emergency office.',
  },
  {
    Icon: ShieldCheck,
    title: 'Help arrives',
    body: 'Track your report as responders are dispatched to the scene.',
  },
]

function StepHowItWorks() {
  return (
    <div className="flex flex-col px-6 pt-8 pb-4">
      <motion.h2
        className="text-[28px] font-bold text-surface-900 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_SMOOTH }}
      >
        Three steps to help your community
      </motion.h2>

      <div className="mt-10 relative">
        {HOW_STEPS.map(({ Icon, title, body }, i) => (
          <motion.div
            key={title}
            className="flex items-start gap-4 mb-8"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.15, ease: EASE_SMOOTH }}
          >
            <motion.div
              className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center flex-shrink-0 shadow-md"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4, delay: i * 0.15 + 0.1, ease: EASE_ANTICIPATE }}
            >
              <Icon size={22} className="text-white" />
            </motion.div>
            <div className="pt-1">
              <h3 className="text-base font-semibold text-surface-900">{title}</h3>
              <p className="text-xs text-surface-500 mt-1 leading-relaxed">{body}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ── Main ── */
const BUTTON_LABELS = ['Get Started', 'Continue', 'Start Reporting']

export function Onboarding() {
  const navigate = useNavigate()
  const setHasCompletedOnboarding = useUIStore((s) => s.setHasCompletedOnboarding)
  const [step, setStep] = useState(0)
  const [consent, setConsent] = useState(false)
  const [consentError, setConsentError] = useState(false)
  const [direction, setDirection] = useState(1)
  const dragX = useMotionValue(0)

  const goNext = useCallback(() => {
    if (step === 1 && !consent) {
      setConsentError(true)
      return
    }
    setConsentError(false)
    if (step < 2) {
      setDirection(1)
      setStep((s) => s + 1)
    } else {
      setHasCompletedOnboarding(true)
      void navigate('/', { replace: true })
    }
  }, [step, consent, setHasCompletedOnboarding, navigate])

  const goPrev = useCallback(() => {
    if (step > 0) {
      setDirection(-1)
      setStep((s) => s - 1)
    }
  }, [step])

  const skip = useCallback(() => {
    setHasCompletedOnboarding(true)
    void navigate('/', { replace: true })
  }, [setHasCompletedOnboarding, navigate])

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number } }) => {
      if (info.offset.x < -50 && step < 2) goNext()
      else if (info.offset.x > 50 && step > 0) goPrev()
    },
    [step, goNext, goPrev],
  )

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  return (
    <div className="min-h-[100dvh] bg-surface-100 flex flex-col relative overflow-hidden">
      {/* Skip (step 0 only) */}
      {step === 0 && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={skip}
            className="px-3 py-2 text-sm font-medium text-brand-500 rounded-lg"
          >
            Skip
          </button>
        </div>
      )}

      {/* Swipeable content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <motion.div
          className="flex-1 flex flex-col"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          style={{ x: dragX }}
        >
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: EASE_SMOOTH }}
              className="flex-1 flex flex-col"
            >
              {step === 0 && <StepWelcome />}
              {step === 1 && (
                <StepPrivacy
                  onConsentChange={(v) => {
                    setConsent(v)
                    if (v) setConsentError(false)
                  }}
                  consentError={consentError}
                />
              )}
              {step === 2 && <StepHowItWorks />}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Bottom: dots + button */}
      <div
        className="px-6 pb-8 pt-4 bg-gradient-to-t from-surface-100 via-surface-100 to-transparent relative z-10"
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Pagination dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="rounded-full"
              style={{ backgroundColor: i === step ? '#0F9488' : '#D5DEDD' }}
              animate={{ width: i === step ? 24 : 8, height: 8 }}
              transition={{ duration: 0.2 }}
            />
          ))}
        </div>

        <motion.button
          type="button"
          onClick={goNext}
          className="w-full rounded-xl font-semibold text-base text-white flex items-center justify-center gap-2 bg-gradient-to-br from-brand-500 to-brand-600 active:scale-[0.98] transition-transform"
          style={{ height: step === 2 ? 64 : 56 }}
          whileTap={{ scale: 0.98 }}
          aria-label={BUTTON_LABELS[step]}
        >
          {BUTTON_LABELS[step]}
          {step === 2 && <ArrowRight size={20} />}
        </motion.button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test — must pass**

```bash
cd apps/citizen-pwa && npx vitest run src/pages/Onboarding.test.tsx
```

Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/citizen-pwa/src/pages/Onboarding.tsx apps/citizen-pwa/src/pages/Onboarding.test.tsx
git commit -m "feat(citizen-pwa): add 3-step swipeable Onboarding flow"
```

---

## Task 9: Update Routing — RootLayout + /onboarding

**Files:**

- Modify: `apps/citizen-pwa/src/routes.tsx`

The existing flat route list gains a `RootLayout` parent that owns the splash overlay and onboarding redirect. All existing tabbed and standalone routes become children. The `AppRoutes` export is unchanged.

- [ ] **Step 1: Read the current routes.tsx**

```bash
cat apps/citizen-pwa/src/routes.tsx
```

Confirm the current structure before editing.

- [ ] **Step 2: Replace routes.tsx**

```tsx
import { createBrowserRouter, RouterProvider, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CitizenShell } from './components/CitizenShell.js'
import { MapTab } from './components/MapTab/index.js'
import { FeedTab } from './components/FeedTab.js'
import { IncidentDetailPage } from './components/IncidentDetailPage.js'
import { ProfileTab } from './components/ProfileTab.js'
import { AlertsTab } from './components/AlertsTab.js'
import { SubmitReportForm } from './components/SubmitReportForm/index.js'
import { ReceiptScreen } from './components/ReceiptScreen.js'
import { LookupScreen } from './components/LookupScreen.js'
import { TrackingScreen } from './components/TrackingScreen.js'
import { GoodbyeScreen } from './components/GoodbyeScreen.js'
import { RegisterPage } from './pages/RegisterPage.js'
import { SettingsPage } from './pages/SettingsPage.js'
import { SplashScreen } from './pages/SplashScreen.js'
import { Onboarding } from './pages/Onboarding.js'
import { useUIStore } from './lib/uiStore.js'

function RootLayout() {
  const [showSplash, setShowSplash] = useState(true)
  const navigate = useNavigate()
  const hasCompletedOnboarding = useUIStore((s) => s.hasCompletedOnboarding)

  const onSplashDone = useCallback(() => {
    setShowSplash(false)
    if (!hasCompletedOnboarding) {
      void navigate('/onboarding', { replace: true })
    }
  }, [hasCompletedOnboarding, navigate])

  return (
    <>
      <AnimatePresence>{showSplash && <SplashScreen onDone={onSplashDone} />}</AnimatePresence>
      <Outlet />
    </>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: (
          <CitizenShell>
            <MapTab />
          </CitizenShell>
        ),
      },
      { path: 'onboarding', element: <Onboarding /> },
      {
        path: 'report',
        element: <SubmitReportForm />,
        handle: { hideBottomNav: true },
      },
      {
        path: 'reports/:reference',
        element: <TrackingScreen />,
        handle: { hideBottomNav: true },
      },
      {
        path: 'feed',
        element: (
          <CitizenShell>
            <FeedTab />
          </CitizenShell>
        ),
      },
      {
        path: 'incidents/:id',
        element: <IncidentDetailPage />,
        handle: { hideBottomNav: true },
      },
      {
        path: 'alerts',
        element: (
          <CitizenShell>
            <AlertsTab />
          </CitizenShell>
        ),
      },
      {
        path: 'profile',
        element: (
          <CitizenShell>
            <ProfileTab />
          </CitizenShell>
        ),
      },
      { path: 'receipt', element: <ReceiptScreen /> },
      { path: 'lookup', element: <LookupScreen /> },
      { path: 'goodbye', element: <GoodbyeScreen />, handle: { hideBottomNav: true } },
      { path: 'register', element: <RegisterPage />, handle: { hideBottomNav: true } },
      { path: 'settings', element: <SettingsPage />, handle: { hideBottomNav: true } },
    ],
  },
])

export function AppRoutes() {
  return <RouterProvider router={router} />
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/citizen-pwa && pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/citizen-pwa/src/routes.tsx
git commit -m "feat(citizen-pwa): add RootLayout with splash overlay + /onboarding route"
```

---

## Task 10: Restyle CitizenShell

**Files:**

- Modify: `apps/citizen-pwa/src/components/CitizenShell.tsx`

Removes the `<header>` wordmark bar. Adds: animated page transitions via `AnimatePresence`, floating center Report button, spring `layoutId` navbar indicator, animated offline banner.

- [ ] **Step 1: Replace CitizenShell.tsx**

```tsx
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Map, Rss, AlertTriangle, Bell, User, WifiOff } from 'lucide-react'
import { useOfflineQueueCount } from '../hooks/useOfflineQueueCount.js'
import { useUIStore } from '../lib/uiStore.js'
import '../styles/design-tokens.css'

const TAB_PATHS = ['/', '/feed', '/alerts', '/profile'] as const
type TabPath = (typeof TAB_PATHS)[number]

const TABS = [
  { label: 'Map', path: '/', Icon: Map, isCenter: false },
  { label: 'Feed', path: '/feed', Icon: Rss, isCenter: false },
  { label: 'Report', path: '/report', Icon: AlertTriangle, isCenter: true },
  { label: 'Alerts', path: '/alerts', Icon: Bell, isCenter: false },
  { label: 'Profile', path: '/profile', Icon: User, isCenter: false },
] as const

const PAGE_VARIANTS = {
  initial: (dir: 'forward' | 'backward') => ({ x: dir === 'forward' ? '10%' : '-10%', opacity: 0 }),
  animate: { x: 0, opacity: 1 },
  exit: (dir: 'forward' | 'backward') => ({ x: dir === 'forward' ? '-10%' : '10%', opacity: 0 }),
}

export function CitizenShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isOnline, queueCount } = useOfflineQueueCount()
  const navDirection = useUIStore((s) => s.navDirection)
  const setNavDirection = useUIStore((s) => s.setNavDirection)
  const showOfflineBanner = !isOnline

  const handleNav = (path: string) => {
    const currentIndex = TAB_PATHS.indexOf(pathname as TabPath)
    const nextIndex = TAB_PATHS.indexOf(path as TabPath)
    setNavDirection(nextIndex >= currentIndex ? 'forward' : 'backward')
    void navigate(path)
  }

  return (
    <div className="min-h-[100dvh] bg-surface-100 relative">
      {/* Offline banner */}
      <AnimatePresence>
        {showOfflineBanner && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="sticky top-0 z-toast bg-warning-400/10 border-b border-warning-400/30 px-4 py-2 flex items-center justify-center gap-2"
          >
            <WifiOff size={16} className="text-warning-500" />
            <span className="text-sm font-medium text-warning-500">
              {queueCount > 0
                ? `Offline — ${queueCount} report${queueCount !== 1 ? 's' : ''} queued`
                : "You're offline. Reports saved on device."}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page content with directional transitions */}
      <main className="pb-20">
        <AnimatePresence mode="wait" custom={navDirection}>
          <motion.div
            key={pathname}
            custom={navDirection}
            variants={PAGE_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
            }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom nav */}
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 z-nav bg-surface-50/90 backdrop-blur-md border-t border-surface-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto relative">
          {TABS.map(({ path, label, Icon, isCenter }) => {
            const isActive = pathname === path

            if (isCenter) {
              return (
                <button
                  key={path}
                  type="button"
                  aria-label={label}
                  onClick={() => handleNav(path)}
                  className="-mt-6 flex items-center justify-center w-[72px] h-[72px] rounded-full bg-gradient-to-br from-brand-500 to-brand-600 shadow-glow-teal active:scale-95 transition-transform"
                >
                  <Icon size={28} strokeWidth={2.5} className="text-white" />
                </button>
              )
            }

            return (
              <button
                key={path}
                type="button"
                onClick={() => handleNav(path)}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex flex-col items-center justify-center w-16 h-16 gap-1 min-w-[44px] min-h-[44px] border-none bg-transparent cursor-pointer"
              >
                <motion.div
                  animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 1.5}
                    className={isActive ? 'text-brand-500' : 'text-surface-300'}
                  />
                </motion.div>
                <span
                  className={`text-[10px] font-medium leading-none ${isActive ? 'text-brand-500' : 'text-surface-300'}`}
                >
                  {label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute top-0 w-8 h-0.5 bg-brand-500 rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + run tests**

```bash
cd apps/citizen-pwa && pnpm typecheck && npx vitest run src/components/CitizenShell.test.tsx
```

Expected: typecheck clean; existing CitizenShell tests may need minor selector updates (no `role="banner"` anymore — update assertions to check for nav buttons instead). Fix any failing assertions.

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/src/components/CitizenShell.tsx
git commit -m "feat(citizen-pwa): restyle CitizenShell — floating Report btn, spring nav, page transitions"
```

---

## Task 11: Restyle ReceiptScreen — Radar Pulse Ceremony

**Files:**

- Modify: `apps/citizen-pwa/src/components/ReceiptScreen.tsx`

Replaces the bare `<section>` with a bottom-sheet overlay: animated SVG checkmark, calm radar rings (3 pulses then stops), slot-machine tracking ref reveal, haptic double-pulse, no confetti.

- [ ] **Step 1: Replace ReceiptScreen.tsx**

```tsx
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSlotMachine } from '../hooks/useSlotMachine.js'

const SHEET_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]
const CONTENT_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]

function AnimatedCheck() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-white">
      <motion.circle
        cx="24"
        cy="24"
        r="22"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: SHEET_EASE }}
      />
      <motion.path
        d="M14 24 L21 31 L34 17"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, delay: 0.3, ease: SHEET_EASE }}
      />
    </svg>
  )
}

function RadarRings() {
  const ringsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Stop rings after 3 pulses (2s × 3 = 6s)
    const timer = setTimeout(() => {
      if (ringsRef.current) ringsRef.current.style.display = 'none'
    }, 6000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div ref={ringsRef} className="absolute inset-0 flex items-center justify-center">
      {[0, 0.5, 1.0].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute w-20 h-20 rounded-full border-2"
          style={{ borderColor: `rgba(5,150,105,${0.6 - i * 0.2})` }}
          animate={{ scale: [1, 2.5], opacity: [0.7, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

export function ReceiptScreen() {
  const { state } = useLocation() as {
    state: { publicRef: string; secret: string } | null
  }
  const navigate = useNavigate()
  const { display } = useSlotMachine(state?.publicRef ?? '', 600, 400)

  useEffect(() => {
    if (!state) return
    // Haptic double-pulse: resolved, not celebratory
    navigator.vibrate?.([100, 50, 100])
  }, [state])

  if (!state) {
    return (
      <section className="flex items-center justify-center min-h-[100dvh]">
        <p className="text-surface-500 text-sm">No submission to display.</p>
      </section>
    )
  }

  return (
    <div className="fixed inset-0 z-emergency flex flex-col justify-end">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-surface-950/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => void navigate('/')}
      />

      {/* Sheet */}
      <motion.div
        className="relative z-10 bg-surface-50 rounded-t-3xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '85vh' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: SHEET_EASE }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-surface-300" />
        </div>

        <motion.div
          className="flex flex-col items-center text-center px-6 py-8 overflow-y-auto no-scrollbar"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: CONTENT_EASE }}
        >
          {/* Icon + radar rings */}
          <div className="relative flex items-center justify-center mb-6">
            <RadarRings />
            <div className="relative z-10 w-20 h-20 rounded-full bg-success-500 flex items-center justify-center shadow-glow-success">
              <AnimatedCheck />
            </div>
          </div>

          <h2 className="text-3xl font-extrabold text-surface-900 mb-2">Report Received</h2>
          <p className="text-sm text-surface-500 mb-8 max-w-xs">
            Emergency responders have been notified. Your report is now in the system.
          </p>

          {/* Tracking reference (slot machine) */}
          <div className="bg-surface-100 rounded-xl border border-surface-200 px-6 py-4 mb-4 w-full">
            <p className="text-xs text-surface-400 uppercase tracking-wider mb-1">
              Tracking Reference
            </p>
            <p className="text-3xl font-bold tracking-widest text-surface-900 font-mono">
              {display}
            </p>
          </div>

          {/* Secret code */}
          <div className="bg-surface-100 rounded-xl border border-surface-200 px-6 py-4 mb-8 w-full">
            <p className="text-xs text-surface-400 uppercase tracking-wider mb-1">Secret Code</p>
            <p className="text-2xl font-bold tracking-widest text-surface-900 font-mono">
              {state.secret}
            </p>
            <p className="text-xs text-surface-400 mt-1">
              Save this — you'll need it to check status
            </p>
          </div>

          <button
            type="button"
            onClick={() => void navigate('/lookup')}
            className="w-full min-h-[56px] rounded-xl bg-brand-500 text-white font-semibold text-base flex items-center justify-center mb-3 active:bg-brand-600 transition-colors"
          >
            Track My Report
          </button>
          <button
            type="button"
            onClick={() => void navigate('/')}
            className="w-full min-h-[56px] rounded-xl bg-transparent text-surface-500 font-medium text-base flex items-center justify-center"
          >
            Back to Map
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/citizen-pwa && pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/src/components/ReceiptScreen.tsx
git commit -m "feat(citizen-pwa): receipt ceremony — calm radar pulse, slot-machine ref reveal, no confetti"
```

---

## Task 12: Restyle FeedTab — Facebook-Inspired

**Files:**

- Modify: `apps/citizen-pwa/src/components/FeedTab.tsx`

- [ ] **Step 1: Read the current FeedTab.tsx to understand all hooks/data it uses**

```bash
cat apps/citizen-pwa/src/components/FeedTab.tsx
```

Identify all hook imports and data shapes before editing. Do NOT change hook calls or data fetching logic.

- [ ] **Step 2: Restyle FeedTab — preserve all hook/logic, replace only JSX and class names**

The new layout (apply over existing hooks — keep all `usePublicIncidents`, `useNavigate`, etc.):

Key structural changes:

- Sticky top bar: `sticky top-0 z-float bg-surface-50/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-surface-200`
- Title: `text-[20px] font-bold text-surface-900`
- Filter chips row: horizontal scroll `no-scrollbar`, pill chips, active = `bg-brand-500 text-white rounded-full px-3 py-1.5 text-xs font-medium`, inactive = `bg-surface-100 text-surface-600`
- Feed cards: `bg-white rounded-xl shadow-sm mx-3 my-2 overflow-hidden`
  - Header row: `flex items-start justify-between p-4 pb-2`
  - Icon circle (incident type): `w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0` colored by incident type
  - Title + location: `ml-3 flex-1`; title = `font-semibold text-surface-900 text-sm`; location = `text-xs text-surface-400`
  - Severity badge: `px-2 py-0.5 rounded-full text-[10px] font-semibold` colored by severity
  - Footer action row: `border-t border-surface-100 px-4 py-2 flex items-center gap-4`
  - "Track" button: `text-xs font-medium text-brand-500`; status chip: `text-xs text-surface-400`
- Skeleton: `bg-surface-200 rounded animate-shimmer` placeholder divs while loading
- Empty state: `flex flex-col items-center justify-center min-h-[50vh] text-surface-400`

Run: `pnpm typecheck && npx vitest run src/components/FeedTab.test.tsx`

Expected: clean typecheck + all FeedTab tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/src/components/FeedTab.tsx
git commit -m "feat(citizen-pwa): restyle FeedTab — Facebook-inspired card feed"
```

---

## Task 13: Restyle AlertsTab

**Files:**

- Modify: `apps/citizen-pwa/src/components/AlertsTab.tsx`

- [ ] **Step 1: Read AlertsTab.tsx before editing**

```bash
cat apps/citizen-pwa/src/components/AlertsTab.tsx
```

- [ ] **Step 2: Restyle — preserve all hook/data logic**

Key structural changes (preserve all `useAlerts`, state logic, etc.):

- Page header: `px-4 py-4 border-b border-surface-200`; title `text-[20px] font-bold text-surface-900`
- Active emergency strip (if any CRITICAL severity alert exists): `bg-danger-500/10 border-b border-danger-500/20 px-4 py-2 flex items-center gap-2`; red AlertTriangle icon + bold text
- Alert cards: `bg-white rounded-xl shadow-sm mx-3 my-2 overflow-hidden border-l-4` where border-left color = `border-danger-500` / `border-warning-500` / `border-info-500` / `border-success-500` based on severity
  - Card body: `p-4`
  - Title row: `flex items-start justify-between`; title = `font-semibold text-surface-900 text-sm flex-1`; severity icon (Lucide) = colored
  - `issuedBy` row: `text-xs text-surface-400 mt-1 flex items-center gap-1`; `Building2` icon
  - Timestamp: `text-xs text-surface-400 mt-2`
- Empty state: `flex flex-col items-center justify-center min-h-[50vh] text-surface-400`; Bell icon + "No alerts"

Run: `pnpm typecheck && npx vitest run src/components/AlertsTab.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/src/components/AlertsTab.tsx
git commit -m "feat(citizen-pwa): restyle AlertsTab — severity left-border cards"
```

---

## Task 14: Restyle ProfileTab

**Files:**

- Modify: `apps/citizen-pwa/src/components/ProfileTab.tsx`

- [ ] **Step 1: Read ProfileTab.tsx before editing**

```bash
cat apps/citizen-pwa/src/components/ProfileTab.tsx
```

- [ ] **Step 2: Restyle — preserve auth logic**

Key structural changes:

- Top section: `bg-brand-500 px-4 pt-12 pb-8` — avatar circle (initials or generic icon), display name / "Anonymous Reporter" label, report count badge
- Pseudonymous banner (when not registered): `bg-brand-50 border border-brand-200 rounded-xl mx-4 p-4 mt-4`; EyeOff icon + "You're reporting anonymously. Register to track reports across devices." + "Register" link → `/register`
- Stats row: `flex gap-3 mx-4 mt-4`; two `bg-white rounded-xl shadow-sm p-4 flex-1` cards — "Reports Submitted" count + "Verified" count
- Settings gear row: `flex items-center justify-between mx-4 mt-4 bg-white rounded-xl shadow-sm px-4 py-3`; "Settings" label + `Settings` Lucide icon; `onClick={() => void navigate('/settings')}`
- My Reports list (existing logic): cards styled like FeedTab cards

Run: `pnpm typecheck && npx vitest run src/components/ProfileTab.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/src/components/ProfileTab.tsx
git commit -m "feat(citizen-pwa): restyle ProfileTab — auth-aware stats + settings gear"
```

---

## Task 15: Restyle SettingsPage

**Files:**

- Modify: `apps/citizen-pwa/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Read SettingsPage.tsx before editing**

```bash
cat apps/citizen-pwa/src/pages/SettingsPage.tsx
```

- [ ] **Step 2: Restyle — preserve all toggle state and handlers**

Key structural changes:

- Back header: `flex items-center gap-3 px-4 py-4 border-b border-surface-200`; `ArrowLeft` icon button + "Settings" title `text-[18px] font-semibold`
- Section headers: `text-xs font-semibold text-surface-400 uppercase tracking-wider px-4 pt-6 pb-2`
- Setting rows: grouped `bg-white` list items with `divide-y divide-surface-100` separator
  - Row: `flex items-center justify-between px-4 py-4`
  - Label: `text-sm font-medium text-surface-900`
  - Sublabel: `text-xs text-surface-500`
  - Toggle rows use the existing `Toggle` component (right-aligned)
- Destructive row (Sign Out): `text-danger-500` label; separator before it
- Delete Account: `text-danger-500` with warning icon; only shown when authenticated

Run: `pnpm typecheck && npx vitest run src/pages/SettingsPage.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/src/pages/SettingsPage.tsx
git commit -m "feat(citizen-pwa): restyle SettingsPage — grouped sections, branded toggles"
```

---

## Task 16: Restyle RegisterPage

**Files:**

- Modify: `apps/citizen-pwa/src/pages/RegisterPage.tsx`

- [ ] **Step 1: Read RegisterPage.tsx before editing**

```bash
cat apps/citizen-pwa/src/pages/RegisterPage.tsx
```

- [ ] **Step 2: Restyle — preserve all Firebase phone-auth steps and OTP logic**

Key structural changes:

- Full-screen: `min-h-[100dvh] bg-white flex flex-col`
- Back button (top-left): `absolute top-4 left-4`; `ArrowLeft` icon → `navigate(-1)`
- Step indicator: pagination dots, same pattern as Onboarding (active dot = `w-6 h-2 bg-brand-500`, inactive = `w-2 h-2 bg-surface-200`)
- Inputs: `w-full h-14 rounded-xl border border-surface-200 px-4 text-base focus:border-brand-500 focus:outline-none`
- OTP input: `text-center font-mono text-2xl tracking-[0.5em] h-14 rounded-xl border border-surface-200`
- Primary CTA: `w-full h-14 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white font-semibold text-base`
- Error messages: `text-xs text-danger-500 mt-1`

Run: `pnpm typecheck && npx vitest run src/pages/RegisterPage.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/src/pages/RegisterPage.tsx
git commit -m "feat(citizen-pwa): restyle RegisterPage — branded inputs + step dots"
```

---

## Task 17: Restyle LookupScreen

**Files:**

- Modify: `apps/citizen-pwa/src/components/LookupScreen.tsx`

- [ ] **Step 1: Read LookupScreen.tsx before editing**

```bash
cat apps/citizen-pwa/src/components/LookupScreen.tsx
```

- [ ] **Step 2: Restyle — preserve requestLookup callable + RevealSheet logic**

Key structural changes:

- Dark navy header: `bg-surface-900 text-white px-4 pt-12 pb-6`; back button + "Lookup Report" title
- Main content: `bg-surface-100 flex-1 px-4 pt-6`
- Input labels: `text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2`
- Reference input: `font-mono tracking-widest` + existing input styling
- Secret input: same
- CTA button: `bg-gradient-to-br from-brand-500 to-brand-600 text-white` full-width `rounded-xl h-14`

Run: `pnpm typecheck && npx vitest run src/components/LookupScreen.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/src/components/LookupScreen.tsx
git commit -m "feat(citizen-pwa): restyle LookupScreen — navy header, mono code inputs"
```

---

## Task 18: Restyle RevealSheet

**Files:**

- Modify: `apps/citizen-pwa/src/components/RevealSheet.tsx`

- [ ] **Step 1: Read RevealSheet.tsx before editing**

```bash
cat apps/citizen-pwa/src/components/RevealSheet.tsx
```

- [ ] **Step 2: Restyle — preserve typewriter animation + vibrate logic**

Key structural changes:

- Sheet container: `bg-surface-50 rounded-t-3xl shadow-2xl` with drag handle pill `w-10 h-1 bg-surface-300 rounded-full mx-auto mt-3 mb-4`
- Backdrop: `fixed inset-0 bg-surface-950/60 backdrop-blur-sm`
- Secret code display: `text-4xl font-extrabold tracking-widest text-surface-900 font-mono text-center py-4`
- Copy button: `flex items-center gap-2 text-sm font-medium text-brand-500`; `Copy` Lucide icon
- Container uses framer-motion `y: '100%' → 0` spring (already present in this component per learnings.md)

Run: `pnpm typecheck && npx vitest run src/components/RevealSheet.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/src/components/RevealSheet.tsx
git commit -m "feat(citizen-pwa): restyle RevealSheet — sheet container + mono secret display"
```

---

## Task 19: Restyle Toast and Toggle

**Files:**

- Modify: `apps/citizen-pwa/src/components/Toast.tsx`
- Modify: `apps/citizen-pwa/src/components/Toggle.tsx`

- [ ] **Step 1: Read both files**

```bash
cat apps/citizen-pwa/src/components/Toast.tsx apps/citizen-pwa/src/components/Toggle.tsx
```

- [ ] **Step 2: Restyle Toast**

Replace the animation mechanism with framer-motion (preserve existing `useToast` hook interface):

Key changes to `Toast.tsx`:

- Wrapper: `fixed bottom-24 left-4 right-4 z-toast`
- framer-motion: `initial={{ y: 80, opacity: 0 }}` → `animate={{ y: 0, opacity: 1 }}` → `exit={{ y: 80, opacity: 0 }}`, transition `ease: [0.16, 1, 0.3, 1]` duration 0.3s
- Wrap in `<AnimatePresence>` keyed on toast presence
- Color variants: `bg-success-400` / `bg-danger-500` / `bg-warning-400` / `bg-info-500`
- Style: `rounded-lg shadow-lg text-white text-sm font-medium text-center px-4 py-3`

- [ ] **Step 3: Restyle Toggle**

Key changes to `Toggle.tsx` (preserve `checked`, `onChange`, `disabled` interface):

- Track: `w-12 h-7 rounded-full transition-colors duration-200`; checked = `bg-brand-500`, unchecked = `bg-surface-200`
- Thumb: `w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200`; checked = `translate-x-6`, unchecked = `translate-x-1`
- Disabled: `opacity-50 cursor-not-allowed`

Run: `pnpm typecheck && npx vitest run src/components/Toast.test.tsx src/components/Toggle.test.tsx`

- [ ] **Step 4: Commit**

```bash
git add apps/citizen-pwa/src/components/Toast.tsx apps/citizen-pwa/src/components/Toggle.tsx
git commit -m "feat(citizen-pwa): restyle Toast (framer-motion) + Toggle (brand-500 active)"
```

---

## Task 20: Restyle MapTab Chrome

**Files:**

- Modify: `apps/citizen-pwa/src/components/MapTab/index.tsx`

Restyle only the UI chrome floating over the Leaflet map. The map layer, incident layer, and all hooks/data fetching are untouched.

- [ ] **Step 1: Read MapTab/index.tsx before editing**

```bash
cat apps/citizen-pwa/src/components/MapTab/index.tsx
```

- [ ] **Step 2: Add Google Maps-style chrome overlays**

After reading, add these floating elements (positioned `absolute` inside the map container). Do NOT change the `<MapContainer>`, `<IncidentLayer>`, `<MyReportLayer>`, or any hook calls:

**Search pill** (top of map):

```tsx
{
  /* Floating search bar */
}
;<div className="absolute top-3 left-3 right-3 z-float pointer-events-none">
  <div className="bg-white/90 backdrop-blur-md rounded-full shadow-md h-12 px-4 flex items-center gap-3 pointer-events-auto">
    <Search size={18} className="text-surface-400 flex-shrink-0" />
    <span className="text-sm text-surface-400">Search Camarines Norte...</span>
  </div>
</div>
```

**Filter chips** (below search bar):

```tsx
{
  /* Filter chips */
}
;<div className="absolute top-[64px] left-3 right-3 z-float overflow-x-auto no-scrollbar">
  <div className="flex gap-2 pb-1">
    {INCIDENT_TYPES.map((type) => (
      <button
        key={type}
        type="button"
        onClick={() => setActiveFilter(type)}
        className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm whitespace-nowrap transition-colors ${
          activeFilter === type
            ? 'bg-brand-500 text-white'
            : 'bg-white/90 backdrop-blur-sm text-surface-600'
        }`}
      >
        {type}
      </button>
    ))}
  </div>
</div>
```

Where `INCIDENT_TYPES = ['All', 'Flood', 'Fire', 'Medical', 'Landslide', 'Wind', 'Other']` and `activeFilter` is local `useState('All')` (filter state is visual only for now — filtering the incident layer is a separate concern).

**My Location FAB**:

```tsx
{/* Location FAB */}
<button
  type="button"
  aria-label="My location"
  onClick={handleMyLocation}  {/* existing GPS handler */}
  className="absolute bottom-8 right-4 z-float w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95 transition-transform"
>
  <Crosshair size={20} className="text-surface-700" />
</button>
```

Required new imports: `Search`, `Crosshair` from `lucide-react`.

- [ ] **Step 3: Typecheck + run MapTab tests**

```bash
cd apps/citizen-pwa && pnpm typecheck && npx vitest run src/components/MapTab/
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/citizen-pwa/src/components/MapTab/index.tsx
git commit -m "feat(citizen-pwa): MapTab chrome — Google Maps-style search pill, filter chips, location FAB"
```

---

## Task 21: Restyle PeekSheet and DetailSheet

**Files:**

- Modify: `apps/citizen-pwa/src/components/MapTab/PeekSheet.tsx`
- Modify: `apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx`

- [ ] **Step 1: Read both files**

```bash
cat apps/citizen-pwa/src/components/MapTab/PeekSheet.tsx apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx
```

- [ ] **Step 2: Restyle PeekSheet — Google Maps card style**

Preserve all logic (data props, callbacks). Restyle container only:

- Sheet wrapper: `fixed bottom-20 left-3 right-3 z-float bg-white rounded-2xl shadow-lg overflow-hidden` (compact peek card, not full-screen)
- Drag handle: `w-8 h-1 rounded-full bg-surface-200 mx-auto mt-2 mb-1`
- Incident title: `text-base font-bold text-surface-900` (like Google Maps place name)
- Location row: `text-sm text-surface-500 flex items-center gap-1`; `MapPin` icon
- Action row: `flex gap-3 pt-3 border-t border-surface-100 mt-3`; "Track" = `text-brand-500 text-sm font-medium`; "Report Similar" = `text-surface-500 text-sm`

- [ ] **Step 3: Restyle DetailSheet — full-detail slide-up**

Preserve all logic. Restyle container:

- Full bottom sheet: `fixed inset-x-0 bottom-0 z-modal bg-white rounded-t-3xl shadow-2xl` max-height `85vh`, overflow-y scroll
- Drag handle pill at top
- Close button: `absolute top-4 right-4`; `X` icon
- Content padding: `px-4 pb-8 pt-2`

Run: `pnpm typecheck && npx vitest run src/components/MapTab/`

- [ ] **Step 4: Commit**

```bash
git add apps/citizen-pwa/src/components/MapTab/PeekSheet.tsx apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx
git commit -m "feat(citizen-pwa): restyle PeekSheet + DetailSheet — Google Maps card style"
```

---

## Task 22: Update App.routes.test.tsx

**Files:**

- Modify: `apps/citizen-pwa/src/App.routes.test.tsx`

Two changes needed: (1) add mocks for `SplashScreen` and `Onboarding` so the overlay and route don't interfere with route tests; (2) remove the `getByRole('banner')` assertion since the `<header>` element is gone.

- [ ] **Step 1: Read the full test file**

```bash
cat apps/citizen-pwa/src/App.routes.test.tsx
```

- [ ] **Step 2: Add mocks for new modules and fix banner assertion**

Add these two mocks at the top of the file (alongside existing `vi.mock` blocks):

```ts
vi.mock('./pages/SplashScreen.js', () => ({
  SplashScreen: ({ onDone }: { onDone?: () => void }) => {
    // Call onDone immediately so the splash doesn't block route tests
    onDone?.()
    return null
  },
}))

vi.mock('./pages/Onboarding.js', () => ({
  Onboarding: () => <div>Onboarding</div>,
}))
```

Also mock `./lib/uiStore.js` so `hasCompletedOnboarding` is always true in route tests (avoids redirect to onboarding):

```ts
vi.mock('./lib/uiStore.js', () => ({
  useUIStore: (
    sel: (s: {
      hasCompletedOnboarding: boolean
      navDirection: string
      setNavDirection: () => void
    }) => unknown,
  ) => sel({ hasCompletedOnboarding: true, navDirection: 'forward', setNavDirection: () => {} }),
}))
```

Find and update the assertion that checks for the removed `<header>` banner:

```ts
// BEFORE (remove this line):
expect(screen.getByRole('banner')).toHaveTextContent('BANTAYOG ALERT')

// AFTER (replace with):
expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
```

- [ ] **Step 3: Run the full test suite**

```bash
cd apps/citizen-pwa && npx vitest run
```

Expected: **203+ tests pass, 0 failures.** If any test fails, read the error and fix the selector/mock — do not skip tests.

- [ ] **Step 4: Commit**

```bash
git add apps/citizen-pwa/src/App.routes.test.tsx
git commit -m "test(citizen-pwa): update routes test — mock SplashScreen/Onboarding, fix banner assertion"
```

---

## Task 23: Final Verification

- [ ] **Step 1: Full typecheck**

```bash
cd apps/citizen-pwa && pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Full lint**

```bash
cd apps/citizen-pwa && pnpm lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Full test suite**

```bash
cd apps/citizen-pwa && npx vitest run
```

Expected: all tests pass. Count must be ≥ 203.

- [ ] **Step 4: Visual smoke test — start dev server**

```bash
cd apps/citizen-pwa && pnpm dev
```

Navigate to `http://localhost:5173` and verify:

1. Splash screen appears with radar rings + progress bar, auto-dismisses in ~1.6s
2. Onboarding shows on first run (clear `localStorage` to trigger): 3 steps, swipe works, privacy consent required
3. Main app: floating Report button in center nav, spring indicator moves between tabs, page transitions animate
4. Offline banner slides in when DevTools → Network → Offline
5. `/receipt` route (navigate manually, pass state): radar rings appear, slot machine ref reveal, haptic fires

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(citizen-pwa): complete UI restyle — Tailwind design system, framer-motion, splash, onboarding, ceremony"
```

---

## Self-Review Checklist

**Spec coverage:**

| Spec requirement                         | Task      |
| ---------------------------------------- | --------- |
| Tailwind config + design tokens          | Task 1, 2 |
| framer-motion installed                  | Task 1    |
| framer-motion test mock                  | Task 3    |
| uiStore (navDirection + onboarding)      | Task 4    |
| useSlotMachine hook                      | Task 5    |
| watchtower.svg                           | Task 6    |
| SplashScreen 1.5s radar rings            | Task 7    |
| Onboarding 3-step swipeable              | Task 8    |
| Routing RootLayout + /onboarding         | Task 9    |
| CitizenShell floating btn + transitions  | Task 10   |
| ReceiptScreen radar pulse (no confetti)  | Task 11   |
| FeedTab Facebook-inspired                | Task 12   |
| AlertsTab restyle                        | Task 13   |
| ProfileTab restyle                       | Task 14   |
| SettingsPage restyle                     | Task 15   |
| RegisterPage restyle                     | Task 16   |
| LookupScreen restyle                     | Task 17   |
| RevealSheet restyle                      | Task 18   |
| Toast framer-motion + Toggle brand color | Task 19   |
| MapTab chrome Google Maps-style          | Task 20   |
| PeekSheet + DetailSheet containers       | Task 21   |
| App.routes.test.tsx updated              | Task 22   |
| 203 tests green, typecheck + lint clean  | Task 23   |
