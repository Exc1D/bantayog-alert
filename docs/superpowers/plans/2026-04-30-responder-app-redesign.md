# Responder App Redesign — Sub-spec 1: Shell + Ceremony

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare-HTML responder app with the dark operational shell, ceremony hooks, and 5 ceremony moments defined in the design spec.

**Architecture:** Ceremony Hooks pattern — each workflow (accept, resolve, SOS) gets a dedicated hook that owns both data state and animation phase. Pages read `phase` and render accordingly. Primitive hooks (`useReducedMotion`, `useHaptic`, `useCountdown`) are shared across all ceremony hooks.

**Tech Stack:** React 19, React Router v7, Firebase v12, Lucide React, Vitest + @testing-library/react (new), happy-dom (root workspace)

---

### Task 1: Set Up Test Infrastructure

**Files:**

- Create: `apps/responder-app/vitest.config.ts`
- Modify: `apps/responder-app/package.json`

- [ ] **Step 1: Add test deps to package.json**

```json
"devDependencies": {
  "@capacitor/android": "^8.3.1",
  "@capacitor/cli": "^8.3.1",
  "@capacitor/ios": "^8.3.1",
  "@testing-library/jest-dom": "^6.6.3",
  "@testing-library/react": "^16.3.0",
  "@testing-library/user-event": "^14.6.1",
  "@types/react": "^19.2.14",
  "@types/react-dom": "^19.2.3",
  "@vitejs/plugin-react": "^6.0.1",
  "vite": "^8.0.10"
}
```

- [ ] **Step 2: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['@testing-library/jest-dom/vitest'],
  },
})
```

- [ ] **Step 3: Install deps**

Run: `pnpm install` from repo root.

- [ ] **Step 4: Verify existing tests still pass**

Run: `cd apps/responder-app && npx vitest run`
Expected: 2 test files pass (`useVersionGate.test.ts`, `dispatch-presentation.test.ts`)

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/vitest.config.ts apps/responder-app/package.json pnpm-lock.yaml
git commit -m "chore(responder-app): add vitest + testing-library test infrastructure"
```

---

### Task 2: Design Token Constants

**Files:**

- Create: `apps/responder-app/src/lib/responder-tokens.ts`
- Test: `apps/responder-app/src/lib/responder-tokens.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/responder-app/src/lib/responder-tokens.test.ts
import { describe, it, expect } from 'vitest'
import { TOKENS } from './responder-tokens'

describe('TOKENS', () => {
  it('exports shell-bg', () => {
    expect(TOKENS.shellBg).toBe('#0a1929')
  })
  it('exports ops-teal', () => {
    expect(TOKENS.opsTeal).toBe('#0e7490')
  })
  it('exports ops-teal-light', () => {
    expect(TOKENS.opsTealLight).toBe('#7dd3fc')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd apps/responder-app && npx vitest run src/lib/responder-tokens.test.ts`
Expected: FAIL — `Cannot find module './responder-tokens'`

- [ ] **Step 3: Implement**

```ts
// apps/responder-app/src/lib/responder-tokens.ts
export const TOKENS = {
  // Surfaces
  shellBg: '#0a1929',
  cardSurface: '#0e1f33',
  cardActive: '#0e2942',
  headerSurface: '#0f2d52',
  borderDark: '#1e3a5f',
  // Accent
  opsTeal: '#0e7490',
  opsTealDim: '#164e63',
  opsTealLight: '#7dd3fc',
  // Text
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted: '#475569',
  // Status
  statusGreen: '#22c55e',
  statusAmber: '#f59e0b',
  statusRed: '#ef4444',
} as const
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `cd apps/responder-app && npx vitest run src/lib/responder-tokens.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/src/lib/responder-tokens.ts apps/responder-app/src/lib/responder-tokens.test.ts
git commit -m "feat(responder-app): add dark operational design token constants"
```

---

### Task 3: useReducedMotion Primitive

**Files:**

- Create: `apps/responder-app/src/hooks/useReducedMotion.ts`
- Test: `apps/responder-app/src/hooks/useReducedMotion.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/responder-app/src/hooks/useReducedMotion.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useReducedMotion } from './useReducedMotion'

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(e: { matches: boolean }) => void> = []
  const mq = {
    matches,
    addEventListener: vi.fn((_: string, cb: (e: { matches: boolean }) => void) => {
      listeners.push(cb)
    }),
    removeEventListener: vi.fn(),
    _listeners: listeners,
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue(mq),
  })
  return mq
}

describe('useReducedMotion', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when prefers-reduced-motion is no-preference', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('returns true when prefers-reduced-motion is reduce', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd apps/responder-app && npx vitest run src/hooks/useReducedMotion.test.ts`
Expected: FAIL — `Cannot find module './useReducedMotion'`

- [ ] **Step 3: Implement**

```ts
// apps/responder-app/src/hooks/useReducedMotion.ts
import { useEffect, useState } from 'react'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `cd apps/responder-app && npx vitest run src/hooks/useReducedMotion.test.ts`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/src/hooks/useReducedMotion.ts apps/responder-app/src/hooks/useReducedMotion.test.ts
git commit -m "feat(responder-app): add useReducedMotion primitive hook"
```

---

### Task 4: useHaptic Primitive

**Files:**

- Create: `apps/responder-app/src/hooks/useHaptic.ts`
- Test: `apps/responder-app/src/hooks/useHaptic.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/responder-app/src/hooks/useHaptic.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHaptic } from './useHaptic'

describe('useHaptic', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      value: vi.fn().mockReturnValue(true),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls navigator.vibrate with a number pattern', () => {
    const { result } = renderHook(() => useHaptic())
    act(() => result.current.fire(200))
    expect(navigator.vibrate).toHaveBeenCalledWith(200)
  })

  it('calls navigator.vibrate with an array pattern', () => {
    const { result } = renderHook(() => useHaptic())
    act(() => result.current.fire([20, 60, 30]))
    expect(navigator.vibrate).toHaveBeenCalledWith([20, 60, 30])
  })

  it('is a no-op when navigator.vibrate is absent', () => {
    Object.defineProperty(navigator, 'vibrate', { writable: true, value: undefined })
    const { result } = renderHook(() => useHaptic())
    expect(() => act(() => result.current.fire(100))).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd apps/responder-app && npx vitest run src/hooks/useHaptic.test.ts`
Expected: FAIL — `Cannot find module './useHaptic'`

- [ ] **Step 3: Implement**

```ts
// apps/responder-app/src/hooks/useHaptic.ts
import { useCallback } from 'react'

export function useHaptic() {
  const fire = useCallback((pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  }, [])

  return { fire }
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `cd apps/responder-app && npx vitest run src/hooks/useHaptic.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/src/hooks/useHaptic.ts apps/responder-app/src/hooks/useHaptic.test.ts
git commit -m "feat(responder-app): add useHaptic primitive with navigator.vibrate guard"
```

---

### Task 5: useCountdown Hook

Used by `DispatchCard` to drive the acknowledgement deadline countdown.

**Files:**

- Create: `apps/responder-app/src/hooks/useCountdown.ts`
- Test: `apps/responder-app/src/hooks/useCountdown.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/responder-app/src/hooks/useCountdown.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Timestamp } from 'firebase/firestore'
import { useCountdown } from './useCountdown'

function makeTimestamp(secondsFromNow: number): Timestamp {
  const ms = Date.now() + secondsFromNow * 1000
  return { toMillis: () => ms } as unknown as Timestamp
}

describe('useCountdown', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns undefined when no deadline provided', () => {
    const { result } = renderHook(() => useCountdown(undefined))
    expect(result.current).toBeUndefined()
  })

  it('returns correct secondsLeft on mount', () => {
    const deadline = makeTimestamp(120)
    const { result } = renderHook(() => useCountdown(deadline))
    expect(result.current?.secondsLeft).toBeCloseTo(120, -1)
  })

  it('returns green colorClass when >60% time remains (120s of 120s)', () => {
    const deadline = makeTimestamp(120)
    const { result } = renderHook(() => useCountdown(deadline))
    expect(result.current?.colorClass).toBe('countdown-green')
  })

  it('decrements secondsLeft each second', () => {
    const deadline = makeTimestamp(90)
    const { result } = renderHook(() => useCountdown(deadline))
    act(() => vi.advanceTimersByTime(10000))
    expect(result.current!.secondsLeft).toBeLessThan(85)
  })

  it('returns amber colorClass when <60% time remains', () => {
    // deadline 120s from now, total ~120s → at 60s left = 50%
    const deadline = makeTimestamp(60)
    // Simulate total being 120 by starting at 120 and advancing 60s
    const longDeadline = makeTimestamp(60)
    const { result } = renderHook(() => useCountdown(longDeadline))
    // 60s left out of 60s total = 100%, still green. We need a case where
    // total is large and remaining is 50%. Just test the threshold directly.
    // secondsLeft = 50, total inferred as deadline - now
    // colorClass logic: <30% red, 30-60% amber, >60% green
    // With 60s remaining and total 120s: 50% → amber
    const deadline2 = { toMillis: () => Date.now() + 60000 } as unknown as Timestamp
    const { result: r2 } = renderHook(() => useCountdown(deadline2, 120))
    expect(r2.current?.colorClass).toBe('countdown-amber')
  })

  it('returns red colorClass when <30% time remains', () => {
    const deadline = { toMillis: () => Date.now() + 20000 } as unknown as Timestamp
    const { result } = renderHook(() => useCountdown(deadline, 120))
    expect(result.current?.colorClass).toBe('countdown-red')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd apps/responder-app && npx vitest run src/hooks/useCountdown.test.ts`
Expected: FAIL — `Cannot find module './useCountdown'`

- [ ] **Step 3: Implement**

```ts
// apps/responder-app/src/hooks/useCountdown.ts
import { useState, useEffect, useRef } from 'react'
import type { Timestamp } from 'firebase/firestore'

export interface CountdownResult {
  secondsLeft: number
  colorClass: 'countdown-green' | 'countdown-amber' | 'countdown-red'
}

export function useCountdown(
  deadline: Timestamp | undefined,
  totalSeconds?: number,
): CountdownResult | undefined {
  const totalRef = useRef(totalSeconds)

  const [secondsLeft, setSecondsLeft] = useState<number | undefined>(() => {
    if (!deadline) return undefined
    return Math.max(0, Math.round((deadline.toMillis() - Date.now()) / 1000))
  })

  useEffect(() => {
    if (!deadline) return
    const initial = Math.max(0, Math.round((deadline.toMillis() - Date.now()) / 1000))
    if (totalRef.current === undefined) totalRef.current = initial
    setSecondsLeft(initial)

    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadline.toMillis() - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) clearInterval(id)
    }, 1000)

    return () => clearInterval(id)
  }, [deadline])

  if (secondsLeft === undefined) return undefined

  const total = totalRef.current ?? secondsLeft
  const pct = total > 0 ? secondsLeft / total : 0
  const colorClass = pct < 0.3 ? 'countdown-red' : pct < 0.6 ? 'countdown-amber' : 'countdown-green'

  return { secondsLeft, colorClass }
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `cd apps/responder-app && npx vitest run src/hooks/useCountdown.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/src/hooks/useCountdown.ts apps/responder-app/src/hooks/useCountdown.test.ts
git commit -m "feat(responder-app): add useCountdown hook with color threshold classes"
```

---

### Task 6: useDispatchCeremony Hook

Owns the accept/decline workflow + animation phase transitions.

**Files:**

- Create: `apps/responder-app/src/hooks/useDispatchCeremony.ts`
- Test: `apps/responder-app/src/hooks/useDispatchCeremony.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/responder-app/src/hooks/useDispatchCeremony.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDispatchCeremony } from './useDispatchCeremony'

const mockAccept = vi.fn()
const mockDecline = vi.fn()
const mockFire = vi.fn()

vi.mock('./useHaptic', () => ({ useHaptic: () => ({ fire: mockFire }) }))
vi.mock('./useReducedMotion', () => ({ useReducedMotion: () => false }))

describe('useDispatchCeremony', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('starts in idle phase', () => {
    const { result } = renderHook(() => useDispatchCeremony('d1', mockAccept, mockDecline))
    expect(result.current.phase).toBe('idle')
  })

  it('transitions to accepting phase when handleAccept called', async () => {
    mockAccept.mockResolvedValue(undefined)
    const { result } = renderHook(() => useDispatchCeremony('d1', mockAccept, mockDecline))
    act(() => {
      void result.current.handleAccept()
    })
    expect(result.current.phase).toBe('accepting')
  })

  it('transitions to locked_in phase on accept success', async () => {
    mockAccept.mockResolvedValue(undefined)
    const { result } = renderHook(() => useDispatchCeremony('d1', mockAccept, mockDecline))
    await act(async () => {
      await result.current.handleAccept()
    })
    expect(result.current.phase).toBe('locked_in')
    expect(mockFire).toHaveBeenCalledWith([20, 60, 30])
  })

  it('transitions to race_loss phase when accept throws already-exists error', async () => {
    const err = new Error('already-exists')
    mockAccept.mockRejectedValue(err)
    const { result } = renderHook(() => useDispatchCeremony('d1', mockAccept, mockDecline))
    await act(async () => {
      await result.current.handleAccept()
    })
    expect(result.current.phase).toBe('race_loss')
  })

  it('transitions to idle with error on accept timeout (8s)', async () => {
    mockAccept.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 10000)))
    const { result } = renderHook(() => useDispatchCeremony('d1', mockAccept, mockDecline))
    act(() => {
      void result.current.handleAccept()
    })
    await act(async () => {
      vi.advanceTimersByTime(8001)
    })
    expect(result.current.phase).toBe('idle')
    expect(result.current.error).toBe('Could not confirm — try again.')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd apps/responder-app && npx vitest run src/hooks/useDispatchCeremony.test.ts`
Expected: FAIL — `Cannot find module './useDispatchCeremony'`

- [ ] **Step 3: Implement**

```ts
// apps/responder-app/src/hooks/useDispatchCeremony.ts
import { useState, useCallback, useRef } from 'react'
import { useHaptic } from './useHaptic'

export type DispatchCeremonyPhase = 'idle' | 'accepting' | 'race_loss' | 'locked_in' | 'active'

export function useDispatchCeremony(
  dispatchId: string,
  acceptFn: () => Promise<void>,
  declineFn: () => Promise<void>,
) {
  const [phase, setPhase] = useState<DispatchCeremonyPhase>('idle')
  const [error, setError] = useState<string | undefined>()
  const { fire } = useHaptic()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleAccept = useCallback(async () => {
    setPhase('accepting')
    setError(undefined)

    let timedOut = false
    timeoutRef.current = setTimeout(() => {
      timedOut = true
      setPhase('idle')
      setError('Could not confirm — try again.')
    }, 8000)

    try {
      await acceptFn()
      if (timedOut) return
      clearTimeout(timeoutRef.current)
      fire([20, 60, 30])
      setPhase('locked_in')
    } catch (err: unknown) {
      if (timedOut) return
      clearTimeout(timeoutRef.current)
      const code = err instanceof Error ? err.message : String(err)
      if (code === 'already-exists' || code.includes('already-exists')) {
        setPhase('race_loss')
      } else {
        setPhase('idle')
        setError('Could not confirm — try again.')
      }
    }
  }, [dispatchId, acceptFn, fire])

  const handleDecline = useCallback(async () => {
    try {
      await declineFn()
    } catch {
      // decline failure is non-critical; page handles navigation
    }
  }, [declineFn])

  const advance = useCallback(() => setPhase('active'), [])

  return { phase, error, handleAccept, handleDecline, advance }
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `cd apps/responder-app && npx vitest run src/hooks/useDispatchCeremony.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/src/hooks/useDispatchCeremony.ts apps/responder-app/src/hooks/useDispatchCeremony.test.ts
git commit -m "feat(responder-app): add useDispatchCeremony hook with 8s timeout + haptic"
```

---

### Task 7: useResolutionCeremony Hook

**Files:**

- Create: `apps/responder-app/src/hooks/useResolutionCeremony.ts`
- Test: `apps/responder-app/src/hooks/useResolutionCeremony.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/responder-app/src/hooks/useResolutionCeremony.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResolutionCeremony } from './useResolutionCeremony'

const mockResolve = vi.fn()
const mockFire = vi.fn()

vi.mock('./useHaptic', () => ({ useHaptic: () => ({ fire: mockFire }) }))

describe('useResolutionCeremony', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts in idle phase', () => {
    const { result } = renderHook(() => useResolutionCeremony(mockResolve))
    expect(result.current.phase).toBe('idle')
  })

  it('transitions to submitting then revealed on success', async () => {
    mockResolve.mockResolvedValue(undefined)
    const { result } = renderHook(() => useResolutionCeremony(mockResolve))
    act(() => {
      void result.current.handleResolve('summary')
    })
    expect(result.current.phase).toBe('submitting')
    await act(async () => {})
    expect(result.current.phase).toBe('revealed')
    expect(mockFire).toHaveBeenCalledWith([10, 40, 10, 40, 25])
  })

  it('returns to idle with error on failure', async () => {
    mockResolve.mockRejectedValue(new Error('not-found'))
    const { result } = renderHook(() => useResolutionCeremony(mockResolve))
    await act(async () => {
      await result.current.handleResolve('summary')
    })
    expect(result.current.phase).toBe('idle')
    expect(result.current.error).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd apps/responder-app && npx vitest run src/hooks/useResolutionCeremony.test.ts`
Expected: FAIL — `Cannot find module './useResolutionCeremony'`

- [ ] **Step 3: Implement**

```ts
// apps/responder-app/src/hooks/useResolutionCeremony.ts
import { useState, useCallback } from 'react'
import { useHaptic } from './useHaptic'

export type ResolutionCeremonyPhase = 'idle' | 'submitting' | 'revealed'

export function useResolutionCeremony(resolveFn: (summary: string) => Promise<void>) {
  const [phase, setPhase] = useState<ResolutionCeremonyPhase>('idle')
  const [error, setError] = useState<string | undefined>()
  const { fire } = useHaptic()

  const handleResolve = useCallback(
    async (summary: string) => {
      setPhase('submitting')
      setError(undefined)
      try {
        await resolveFn(summary)
        fire([10, 40, 10, 40, 25])
        setPhase('revealed')
      } catch (err: unknown) {
        setPhase('idle')
        setError(err instanceof Error ? err.message : 'Resolution failed')
      }
    },
    [resolveFn, fire],
  )

  const dismiss = useCallback(() => setPhase('idle'), [])

  return { phase, error, handleResolve, dismiss }
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `cd apps/responder-app && npx vitest run src/hooks/useResolutionCeremony.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/src/hooks/useResolutionCeremony.ts apps/responder-app/src/hooks/useResolutionCeremony.test.ts
git commit -m "feat(responder-app): add useResolutionCeremony hook with 5-pulse haptic"
```

---

### Task 8: useSosHold Hook

**Files:**

- Create: `apps/responder-app/src/hooks/useSosHold.ts`
- Test: `apps/responder-app/src/hooks/useSosHold.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/responder-app/src/hooks/useSosHold.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSosHold } from './useSosHold'

const mockOnActivate = vi.fn()
const mockFire = vi.fn()

vi.mock('./useHaptic', () => ({ useHaptic: () => ({ fire: mockFire }) }))

describe('useSosHold', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => vi.useRealTimers())

  it('starts in idle phase with 0 progress', () => {
    const { result } = renderHook(() => useSosHold(mockOnActivate))
    expect(result.current.phase).toBe('idle')
    expect(result.current.progress).toBe(0)
  })

  it('transitions to holding on pointerdown', () => {
    const { result } = renderHook(() => useSosHold(mockOnActivate))
    act(() => result.current.onPointerDown())
    expect(result.current.phase).toBe('holding')
  })

  it('cancels and returns to idle on early pointerup', () => {
    const { result } = renderHook(() => useSosHold(mockOnActivate))
    act(() => result.current.onPointerDown())
    act(() => {
      vi.advanceTimersByTime(1000)
      result.current.onPointerUp()
    })
    expect(result.current.phase).toBe('idle')
    expect(result.current.progress).toBe(0)
  })

  it('calls onActivate and transitions to activated after 3s hold', async () => {
    mockOnActivate.mockResolvedValue(undefined)
    const { result } = renderHook(() => useSosHold(mockOnActivate))
    act(() => result.current.onPointerDown())
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.phase).toBe('activated')
    expect(mockOnActivate).toHaveBeenCalled()
  })

  it('progress reaches 1 at 3s', () => {
    const { result } = renderHook(() => useSosHold(mockOnActivate))
    act(() => result.current.onPointerDown())
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.progress).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd apps/responder-app && npx vitest run src/hooks/useSosHold.test.ts`
Expected: FAIL — `Cannot find module './useSosHold'`

- [ ] **Step 3: Implement**

```ts
// apps/responder-app/src/hooks/useSosHold.ts
import { useState, useCallback, useRef } from 'react'
import { useHaptic } from './useHaptic'

export type SosHoldPhase = 'idle' | 'holding' | 'activated' | 'cancelled'

const HOLD_MS = 3000
const TICK_MS = 50

export function useSosHold(onActivate: () => void | Promise<void>) {
  const [phase, setPhase] = useState<SosHoldPhase>('idle')
  const [progress, setProgress] = useState(0)
  const { fire } = useHaptic()
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const startRef = useRef<number>(0)
  const cancelledRef = useRef(false)

  const onPointerDown = useCallback(() => {
    cancelledRef.current = false
    startRef.current = Date.now()
    setPhase('holding')
    setProgress(0)

    intervalRef.current = setInterval(() => {
      if (cancelledRef.current) return
      const elapsed = Date.now() - startRef.current
      const p = Math.min(elapsed / HOLD_MS, 1)
      setProgress(p)

      if (p >= 1) {
        clearInterval(intervalRef.current)
        setPhase('activated')
        fire([30, 50, 30, 50, 50])
        void onActivate()
      }
    }, TICK_MS)
  }, [onActivate, fire])

  const onPointerUp = useCallback(() => {
    const elapsed = Date.now() - startRef.current
    if (elapsed < HOLD_MS) {
      cancelledRef.current = true
      clearInterval(intervalRef.current)
      setPhase('idle')
      setProgress(0)
    }
  }, [])

  return { phase, progress, onPointerDown, onPointerUp }
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `cd apps/responder-app && npx vitest run src/hooks/useSosHold.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/src/hooks/useSosHold.ts apps/responder-app/src/hooks/useSosHold.test.ts
git commit -m "feat(responder-app): add useSosHold hook with 3s timer and progress tracking"
```

---

### Task 9: ProgressStepper Component

**Files:**

- Create: `apps/responder-app/src/components/ProgressStepper.tsx`
- Test: `apps/responder-app/src/components/ProgressStepper.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/responder-app/src/components/ProgressStepper.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressStepper } from './ProgressStepper'

describe('ProgressStepper', () => {
  it('renders 4 step nodes', () => {
    render(<ProgressStepper currentStep="en_route" />)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('marks acknowledged and en_route as done, on_scene as active', () => {
    render(<ProgressStepper currentStep="on_scene" />)
    expect(screen.getByLabelText('Step 3 of 4: On Scene')).toHaveAttribute('aria-current', 'step')
  })

  it('marks all steps done when resolved', () => {
    render(<ProgressStepper currentStep="resolved" />)
    const items = screen.getAllByRole('listitem')
    items.forEach((item) => expect(item.getAttribute('data-status')).toMatch(/done|active/))
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd apps/responder-app && npx vitest run src/components/ProgressStepper.test.tsx`
Expected: FAIL — `Cannot find module './ProgressStepper'`

- [ ] **Step 3: Implement**

```tsx
// apps/responder-app/src/components/ProgressStepper.tsx
import { CheckIcon } from 'lucide-react'
import { TOKENS } from '../lib/responder-tokens'
import { useReducedMotion } from '../hooks/useReducedMotion'

type DispatchStep = 'acknowledged' | 'en_route' | 'on_scene' | 'resolved'

const STEPS: { key: DispatchStep; label: string }[] = [
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'en_route', label: 'En Route' },
  { key: 'on_scene', label: 'On Scene' },
  { key: 'resolved', label: 'Resolved' },
]

const STEP_ORDER: DispatchStep[] = ['acknowledged', 'en_route', 'on_scene', 'resolved']

type StepStatus = 'done' | 'active' | 'pending'

function getStatus(stepKey: DispatchStep, current: DispatchStep): StepStatus {
  const stepIdx = STEP_ORDER.indexOf(stepKey)
  const currentIdx = STEP_ORDER.indexOf(current)
  if (stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'active'
  return 'pending'
}

interface Props {
  currentStep: DispatchStep
}

export function ProgressStepper({ currentStep }: Props) {
  const reduced = useReducedMotion()

  return (
    <ol
      role="list"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: 0,
        margin: 0,
        listStyle: 'none',
      }}
    >
      {STEPS.map((step, i) => {
        const status = getStatus(step.key, currentStep)
        const isLast = i === STEPS.length - 1
        const lineColor =
          getStatus(STEPS[i + 1]?.key ?? step.key, currentStep) !== 'pending'
            ? TOKENS.opsTeal
            : TOKENS.borderDark

        return (
          <li
            key={step.key}
            data-status={status}
            style={{ display: 'flex', alignItems: 'center', flex: isLast ? 'none' : 1 }}
          >
            <div
              role="listitem"
              aria-label={`Step ${i + 1} of 4: ${step.label}`}
              aria-current={status === 'active' ? 'step' : undefined}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: status === 'pending' ? TOKENS.cardSurface : TOKENS.opsTeal,
                border: status === 'pending' ? `1.5px solid ${TOKENS.borderDark}` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                animation:
                  status === 'active' && !reduced ? 'stepPulse 300ms ease forwards' : undefined,
              }}
            >
              {status === 'done' && <CheckIcon size={10} color="white" aria-hidden="true" />}
            </div>
            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: lineColor,
                  margin: '0 2px',
                }}
              />
            )}
          </li>
        )
      })}
      <style>{`
        @keyframes stepPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes stepPulse { 0%, 100% { transform: scale(1); } }
        }
      `}</style>
    </ol>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `cd apps/responder-app && npx vitest run src/components/ProgressStepper.test.tsx`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/src/components/ProgressStepper.tsx apps/responder-app/src/components/ProgressStepper.test.tsx
git commit -m "feat(responder-app): add ProgressStepper component with pulse animation"
```

---

### Task 10: SosButton Component

**Files:**

- Create: `apps/responder-app/src/components/SosButton.tsx`
- Test: `apps/responder-app/src/components/SosButton.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/responder-app/src/components/SosButton.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SosButton } from './SosButton'

vi.mock('../hooks/useSosHold', () => ({
  useSosHold: (onActivate: () => void) => ({
    phase: 'idle',
    progress: 0,
    onPointerDown: vi.fn(),
    onPointerUp: vi.fn(),
  }),
}))

describe('SosButton', () => {
  it('renders with correct aria-label at rest', () => {
    render(<SosButton onActivate={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Activate SOS/i })).toBeInTheDocument()
  })

  it('renders SOS text label', () => {
    render(<SosButton onActivate={vi.fn()} />)
    expect(screen.getByText('SOS')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd apps/responder-app && npx vitest run src/components/SosButton.test.tsx`
Expected: FAIL — `Cannot find module './SosButton'`

- [ ] **Step 3: Implement**

```tsx
// apps/responder-app/src/components/SosButton.tsx
import { ShieldAlertIcon } from 'lucide-react'
import { useSosHold } from '../hooks/useSosHold'
import { useReducedMotion } from '../hooks/useReducedMotion'

interface Props {
  onActivate: () => void | Promise<void>
}

const RING_R = 14
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R

export function SosButton({ onActivate }: Props) {
  const { phase, progress, onPointerDown, onPointerUp } = useSosHold(onActivate)
  const reduced = useReducedMotion()

  const pct = Math.round(progress * 100)
  const ariaLabel =
    phase === 'holding'
      ? `Hold for SOS — ${pct}% charged`
      : phase === 'activated'
        ? 'SOS activated'
        : 'Activate SOS emergency signal'

  const dashOffset = RING_CIRCUMFERENCE * (1 - progress)

  return (
    <button
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{
        position: 'relative',
        background: phase === 'activated' ? '#7f1d1d' : '#b91c1c',
        border: 'none',
        borderRadius: 6,
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        userSelect: 'none',
        touchAction: 'none',
        minWidth: 44,
        minHeight: 44,
      }}
    >
      {phase === 'holding' && !reduced && (
        <svg
          width={34}
          height={34}
          style={{ position: 'absolute', inset: 0, margin: 'auto', pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <circle
            cx={17}
            cy={17}
            r={RING_R}
            fill="none"
            stroke="#b91c1c"
            strokeWidth={3}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 17 17)"
            style={{ transition: 'stroke-dashoffset 50ms linear' }}
          />
        </svg>
      )}
      <ShieldAlertIcon size={10} color="white" aria-hidden="true" />
      <span
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: 'white',
          letterSpacing: '0.04em',
        }}
      >
        SOS
      </span>
    </button>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `cd apps/responder-app && npx vitest run src/components/SosButton.test.tsx`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/src/components/SosButton.tsx apps/responder-app/src/components/SosButton.test.tsx
git commit -m "feat(responder-app): add SosButton with 3s hold ring and aria-label updates"
```

---

### Task 11: DispatchCard Component

**Files:**

- Create: `apps/responder-app/src/components/DispatchCard.tsx`
- Test: `apps/responder-app/src/components/DispatchCard.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/responder-app/src/components/DispatchCard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DispatchCard } from './DispatchCard'
import type { QueueDispatchRow } from '../lib/dispatch-presentation'

vi.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => false }))
vi.mock('../hooks/useCountdown', () => ({
  useCountdown: () => ({ secondsLeft: 90, colorClass: 'countdown-green' }),
}))
vi.mock('../hooks/useDispatchCeremony', () => ({
  useDispatchCeremony: () => ({
    phase: 'idle',
    error: undefined,
    handleAccept: vi.fn(),
    handleDecline: vi.fn(),
    advance: vi.fn(),
  }),
}))

const baseRow: QueueDispatchRow = {
  dispatchId: 'd1',
  reportId: 'r1',
  status: 'pending',
  dispatchedAt: Date.now(),
}

describe('DispatchCard', () => {
  it('renders dispatch id in mono font', () => {
    render(<DispatchCard row={baseRow} onAccepted={vi.fn()} onRaceLoss={vi.fn()} />)
    expect(screen.getByText('#D1')).toBeInTheDocument()
  })

  it('shows Accept and Decline buttons for pending status', () => {
    render(<DispatchCard row={baseRow} onAccepted={vi.fn()} onRaceLoss={vi.fn()} />)
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument()
  })

  it('shows offline state when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    render(<DispatchCard row={baseRow} onAccepted={vi.fn()} onRaceLoss={vi.fn()} />)
    expect(screen.getByLabelText(/Offline/i)).toBeDisabled()
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd apps/responder-app && npx vitest run src/components/DispatchCard.test.tsx`
Expected: FAIL — `Cannot find module './DispatchCard'`

- [ ] **Step 3: Implement**

```tsx
// apps/responder-app/src/components/DispatchCard.tsx
import { useEffect } from 'react'
import { WifiOffIcon, Loader2Icon } from 'lucide-react'
import type { QueueDispatchRow } from '../lib/dispatch-presentation'
import { getResponderUiState } from '../lib/dispatch-presentation'
import { useDispatchCeremony } from '../hooks/useDispatchCeremony'
import { useCountdown } from '../hooks/useCountdown'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useAcceptDispatch } from '../hooks/useAcceptDispatch'
import { useDeclineDispatch } from '../hooks/useDeclineDispatch'
import { TOKENS } from '../lib/responder-tokens'

interface Props {
  row: QueueDispatchRow
  onAccepted: (dispatchId: string) => void
  onRaceLoss: () => void
}

const STATUS_BORDER: Record<string, string> = {
  pending: TOKENS.statusRed,
  heading_to_scene: TOKENS.statusAmber,
  on_scene: TOKENS.statusAmber,
  resolved: TOKENS.statusGreen,
  terminal: TOKENS.borderDark,
}

export function DispatchCard({ row, onAccepted, onRaceLoss }: Props) {
  const reduced = useReducedMotion()
  const { accept } = useAcceptDispatch(row.dispatchId)
  const { decline } = useDeclineDispatch(row.dispatchId)
  const { phase, error, handleAccept, handleDecline } = useDispatchCeremony(
    row.dispatchId,
    accept,
    decline,
  )
  const countdown = useCountdown(row.acknowledgementDeadlineAt)
  const uiState = getResponderUiState(row.status)
  const isOffline = !navigator.onLine
  const isPending = row.status === 'pending'
  const isAccepting = phase === 'accepting'

  useEffect(() => {
    if (phase === 'locked_in') onAccepted(row.dispatchId)
  }, [phase, row.dispatchId, onAccepted])

  useEffect(() => {
    if (phase === 'race_loss') onRaceLoss()
  }, [phase, onRaceLoss])

  const borderColor = STATUS_BORDER[uiState] ?? TOKENS.borderDark
  const bgColor = isPending ? TOKENS.cardActive : TOKENS.cardSurface

  return (
    <div
      style={{
        background: bgColor,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 8,
        animation: isPending && !reduced ? 'borderPulse 1.5s ease infinite' : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: TOKENS.opsTealLight,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {uiState.replace('_', ' ')}
        </span>
        <span
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11,
            fontWeight: 700,
            color: TOKENS.textMuted,
          }}
        >
          #{row.dispatchId.slice(0, 4).toUpperCase()}
        </span>
      </div>

      {countdown && (
        <div
          aria-live="polite"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
            fontWeight: 700,
            color:
              countdown.colorClass === 'countdown-green'
                ? TOKENS.statusGreen
                : countdown.colorClass === 'countdown-amber'
                  ? TOKENS.statusAmber
                  : TOKENS.statusRed,
            marginBottom: 8,
          }}
        >
          {Math.floor(countdown.secondsLeft / 60)}:
          {String(countdown.secondsLeft % 60).padStart(2, '0')}
        </div>
      )}

      {error && <p style={{ fontSize: 11, color: TOKENS.statusRed, margin: '4px 0' }}>{error}</p>}

      {isPending && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={() => void handleAccept()}
            disabled={isOffline || isAccepting}
            aria-label={isOffline ? 'Offline — cannot accept dispatch' : 'Accept dispatch'}
            style={{
              flex: 1,
              minHeight: 48,
              background: isOffline || isAccepting ? TOKENS.opsTealDim : TOKENS.opsTeal,
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 13,
              cursor: isOffline || isAccepting ? 'not-allowed' : 'pointer',
              opacity: isOffline ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            {isOffline && <WifiOffIcon size={10} aria-hidden="true" />}
            {isAccepting ? <Loader2Icon size={14} aria-hidden="true" /> : 'Accept'}
          </button>
          <button
            onClick={() => void handleDecline()}
            disabled={isAccepting}
            style={{
              flex: 1,
              minHeight: 48,
              background: 'transparent',
              color: TOKENS.textSecondary,
              border: `1px solid ${TOKENS.borderDark}`,
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Decline
          </button>
        </div>
      )}
      {isOffline && isPending && (
        <p style={{ fontSize: 10, color: TOKENS.textMuted, marginTop: 4 }}>Connect to accept.</p>
      )}

      <style>{`
        @keyframes borderPulse {
          0%, 100% { border-left-color: ${TOKENS.statusRed}; }
          50% { border-left-color: rgba(239,68,68,0.4); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes borderPulse { 0%, 100% { border-left-color: ${TOKENS.statusRed}; } }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 4: Add useDeclineDispatch stub** (if not present — check first with `ls apps/responder-app/src/hooks/useDeclineDispatch.ts`)

If absent, create:

```ts
// apps/responder-app/src/hooks/useDeclineDispatch.ts
import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../app/firebase'
import { awaitFreshAuthToken } from '../app/await-auth-token'

export function useDeclineDispatch(dispatchId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()

  async function decline() {
    setLoading(true)
    setError(undefined)
    try {
      const user = await awaitFreshAuthToken(auth)
      if (!user) throw new Error('auth_required')
      const fn = httpsCallable<{ dispatchId: string }, void>(functions, 'declineDispatch')
      await fn({ dispatchId })
    } catch (err: unknown) {
      if (err instanceof Error) setError(err)
      else setError(new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }

  return { decline, loading, error }
}
```

- [ ] **Step 5: Run test to confirm it passes**

Run: `cd apps/responder-app && npx vitest run src/components/DispatchCard.test.tsx`
Expected: PASS — 3 tests

- [ ] **Step 6: Commit**

```bash
git add apps/responder-app/src/components/DispatchCard.tsx apps/responder-app/src/components/DispatchCard.test.tsx apps/responder-app/src/hooks/useDeclineDispatch.ts
git commit -m "feat(responder-app): add ceremony-aware DispatchCard with offline state"
```

---

### Task 12: ResolutionCard Component

**Files:**

- Create: `apps/responder-app/src/components/ResolutionCard.tsx`
- Test: `apps/responder-app/src/components/ResolutionCard.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/responder-app/src/components/ResolutionCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResolutionCard } from './ResolutionCard'

vi.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }))

describe('ResolutionCard', () => {
  const props = {
    dispatchId: 'abc123',
    incidentType: 'Flood',
    municipality: 'Daet',
    acceptedAt: Date.now() - 47 * 60 * 1000,
    onDismiss: vi.fn(),
  }

  it('renders Incident Resolved heading', () => {
    render(<ResolutionCard {...props} />)
    expect(screen.getByText('Incident Resolved')).toBeInTheDocument()
  })

  it('shows dispatch id', () => {
    render(<ResolutionCard {...props} />)
    expect(screen.getByText(/abc123/i)).toBeInTheDocument()
  })

  it('shows time on assignment', () => {
    render(<ResolutionCard {...props} />)
    // reduced motion: shows number immediately. 47 minutes.
    expect(screen.getByText(/47/)).toBeInTheDocument()
  })

  it('calls onDismiss when Return button clicked', async () => {
    const user = userEvent.setup()
    render(<ResolutionCard {...props} />)
    await user.click(screen.getByRole('button', { name: /return to dispatches/i }))
    expect(props.onDismiss).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd apps/responder-app && npx vitest run src/components/ResolutionCard.test.tsx`
Expected: FAIL — `Cannot find module './ResolutionCard'`

- [ ] **Step 3: Implement**

```tsx
// apps/responder-app/src/components/ResolutionCard.tsx
import { useEffect, useState } from 'react'
import { CheckCircle2Icon } from 'lucide-react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { TOKENS } from '../lib/responder-tokens'

interface Props {
  dispatchId: string
  incidentType: string
  municipality: string
  acceptedAt: number
  onDismiss: () => void
}

function formatMinutes(ms: number) {
  return Math.floor(ms / 60000)
}

export function ResolutionCard({
  dispatchId,
  incidentType,
  municipality,
  acceptedAt,
  onDismiss,
}: Props) {
  const reduced = useReducedMotion()
  const totalMs = Date.now() - acceptedAt
  const totalMinutes = formatMinutes(totalMs)
  const [displayMinutes, setDisplayMinutes] = useState(reduced ? totalMinutes : 0)

  useEffect(() => {
    if (reduced) return
    const start = Date.now()
    const duration = 800
    const id = setInterval(() => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      setDisplayMinutes(Math.floor(progress * totalMinutes))
      if (progress >= 1) clearInterval(id)
    }, 16)
    return () => clearInterval(id)
  }, [reduced, totalMinutes])

  return (
    <div
      role="dialog"
      aria-label="Incident resolved"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(160deg, #0a1929 0%, #0e2942 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 50,
      }}
    >
      <CheckCircle2Icon size={32} color={TOKENS.opsTeal} aria-hidden="true" />

      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: TOKENS.textPrimary,
          marginTop: 16,
          marginBottom: 4,
        }}
      >
        Incident Resolved
      </h1>

      <p
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 9,
          fontWeight: 700,
          color: TOKENS.opsTealLight,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 24,
        }}
      >
        #{dispatchId.slice(0, 6).toUpperCase()} · {incidentType} · {municipality}
      </p>

      <div aria-live="polite" style={{ textAlign: 'center', marginBottom: 8 }}>
        <span
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 22,
            fontWeight: 800,
            color: TOKENS.opsTealLight,
          }}
        >
          {displayMinutes} min
        </span>
        <p style={{ fontSize: 12, color: TOKENS.textSecondary, marginTop: 4 }}>
          Time on assignment
        </p>
      </div>

      <p
        style={{
          fontSize: 13,
          color: TOKENS.opsTealLight,
          fontStyle: 'italic',
          marginBottom: 32,
        }}
      >
        Your community is safer.
      </p>

      <button
        onClick={onDismiss}
        style={{
          background: TOKENS.opsTeal,
          color: 'white',
          border: 'none',
          borderRadius: 8,
          padding: '14px 32px',
          fontSize: 15,
          fontWeight: 700,
          cursor: 'pointer',
          minWidth: 200,
          minHeight: 48,
        }}
      >
        Return to Dispatches
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `cd apps/responder-app && npx vitest run src/components/ResolutionCard.test.tsx`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/src/components/ResolutionCard.tsx apps/responder-app/src/components/ResolutionCard.test.tsx
git commit -m "feat(responder-app): add ResolutionCard with count-up animation"
```

---

### Task 13: ResponderShell Component

**Files:**

- Create: `apps/responder-app/src/components/ResponderShell.tsx`
- Test: `apps/responder-app/src/components/ResponderShell.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/responder-app/src/components/ResponderShell.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ResponderShell } from './ResponderShell'

vi.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => false }))
vi.mock('../hooks/useSosHold', () => ({
  useSosHold: () => ({ phase: 'idle', progress: 0, onPointerDown: vi.fn(), onPointerUp: vi.fn() }),
}))
vi.mock('../hooks/useHaptic', () => ({ useHaptic: () => ({ fire: vi.fn() }) }))
vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, signOut: vi.fn() }),
}))

describe('ResponderShell', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
  )

  it('renders BANTAYOG ALERT wordmark', () => {
    render(
      <ResponderShell>
        <div />
      </ResponderShell>,
      { wrapper },
    )
    expect(screen.getByText('BANTAYOG ALERT')).toBeInTheDocument()
  })

  it('renders RESPONDER role badge', () => {
    render(
      <ResponderShell>
        <div />
      </ResponderShell>,
      { wrapper },
    )
    expect(screen.getByText('RESPONDER')).toBeInTheDocument()
  })

  it('renders all 4 tab labels', () => {
    render(
      <ResponderShell>
        <div />
      </ResponderShell>,
      { wrapper },
    )
    expect(screen.getByText('Dispatches')).toBeInTheDocument()
    expect(screen.getByText('Map')).toBeInTheDocument()
    expect(screen.getByText('Messages')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
  })

  it('renders SOS button', () => {
    render(
      <ResponderShell>
        <div />
      </ResponderShell>,
      { wrapper },
    )
    expect(screen.getByLabelText(/Activate SOS/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd apps/responder-app && npx vitest run src/components/ResponderShell.test.tsx`
Expected: FAIL — `Cannot find module './ResponderShell'`

- [ ] **Step 3: Implement**

```tsx
// apps/responder-app/src/components/ResponderShell.tsx
import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ClipboardListIcon, NavigationIcon, MessageSquareIcon, UserIcon } from 'lucide-react'
import { SosButton } from './SosButton'
import { TOKENS } from '../lib/responder-tokens'

interface Props {
  children: ReactNode
}

const TABS = [
  { to: '/dispatches', label: 'Dispatches', Icon: ClipboardListIcon },
  { to: '/map', label: 'Map', Icon: NavigationIcon },
  { to: '/messages', label: 'Messages', Icon: MessageSquareIcon },
  { to: '/profile', label: 'Profile', Icon: UserIcon },
] as const

export function ResponderShell({ children }: Props) {
  const navigate = useNavigate()

  function handleSosActivate() {
    void navigate('/sos')
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: TOKENS.shellBg,
        color: TOKENS.textPrimary,
      }}
    >
      {/* Header */}
      <header
        style={{
          height: 52,
          background: TOKENS.headerSurface,
          borderBottom: `1px solid ${TOKENS.borderDark}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: '0.08em',
              color: 'white',
            }}
          >
            BANTAYOG ALERT
          </span>
          <span
            style={{
              background: TOKENS.opsTeal,
              color: 'white',
              fontSize: 9,
              fontWeight: 700,
              borderRadius: 10,
              padding: '2px 6px',
              letterSpacing: '0.03em',
            }}
          >
            RESPONDER
          </span>
        </div>
        <SosButton onActivate={handleSosActivate} />
      </header>

      {/* Content */}
      <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>

      {/* Bottom Tab Bar */}
      <nav
        style={{
          height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: TOKENS.headerSurface,
          borderTop: `1px solid ${TOKENS.borderDark}`,
          display: 'flex',
          flexShrink: 0,
        }}
      >
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              textDecoration: 'none',
              color: isActive ? TOKENS.opsTeal : TOKENS.textMuted,
              minHeight: 44,
            })}
          >
            <Icon size={18} aria-hidden="true" />
            <span
              style={{
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: '0.03em',
              }}
            >
              {label}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `cd apps/responder-app && npx vitest run src/components/ResponderShell.test.tsx`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add apps/responder-app/src/components/ResponderShell.tsx apps/responder-app/src/components/ResponderShell.test.tsx
git commit -m "feat(responder-app): add ResponderShell — dark 4-tab shell with SOS header"
```

---

### Task 14: Wire DispatchListPage

Replace bare HTML with `DispatchCard` and the dispatch grouping logic.

**Files:**

- Modify: `apps/responder-app/src/pages/DispatchListPage.tsx`

- [ ] **Step 1: Read current file**

Run: `cat apps/responder-app/src/pages/DispatchListPage.tsx`

- [ ] **Step 2: Rewrite DispatchListPage**

Replace the full file content with:

```tsx
// apps/responder-app/src/pages/DispatchListPage.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import { DispatchCard } from '../components/DispatchCard'
import { TOKENS } from '../lib/responder-tokens'

export function DispatchListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { groups, error } = useOwnDispatches(user?.uid)

  useEffect(() => {
    const activeId = groups.active.length === 1 ? (groups.active[0]?.dispatchId ?? null) : null
    if (activeId) void navigate(`/dispatches/${activeId}`, { replace: true })
  }, [groups.active, navigate])

  if (error) {
    return <div style={{ padding: 16, color: TOKENS.statusRed }}>Failed to load dispatches.</div>
  }

  return (
    <div style={{ padding: 16 }}>
      {groups.pending.length === 0 && groups.active.length === 0 && (
        <p style={{ color: TOKENS.textMuted, textAlign: 'center', marginTop: 40 }}>
          No dispatches at this time.
        </p>
      )}

      {groups.active.length > 0 && (
        <section>
          <h2
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: TOKENS.textMuted,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Active
          </h2>
          {groups.active.map((row) => (
            <DispatchCard
              key={row.dispatchId}
              row={row}
              onAccepted={(id) => void navigate(`/dispatches/${id}`)}
              onRaceLoss={() => void navigate('/dispatches')}
            />
          ))}
        </section>
      )}

      {groups.pending.length > 0 && (
        <section style={{ marginTop: groups.active.length > 0 ? 16 : 0 }}>
          <h2
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: TOKENS.textMuted,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Incoming
          </h2>
          {groups.pending.map((row) => (
            <DispatchCard
              key={row.dispatchId}
              row={row}
              onAccepted={(id) => void navigate(`/dispatches/${id}`)}
              onRaceLoss={() => void navigate('/dispatches')}
            />
          ))}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd apps/responder-app && npx tsc --noEmit`
Expected: No errors related to DispatchListPage.

- [ ] **Step 4: Commit**

```bash
git add apps/responder-app/src/pages/DispatchListPage.tsx
git commit -m "feat(responder-app): wire DispatchListPage to use DispatchCard"
```

---

### Task 15: Wire DispatchDetailPage

Add `ProgressStepper` and `useResolutionCeremony` to the existing detail page.

**Files:**

- Modify: `apps/responder-app/src/pages/DispatchDetailPage.tsx`

- [ ] **Step 1: Read current file**

Run: `cat apps/responder-app/src/pages/DispatchDetailPage.tsx`

- [ ] **Step 2: Add ProgressStepper and ResolutionCard**

At the top of the file, add imports:

```tsx
import { ProgressStepper } from '../components/ProgressStepper'
import { ResolutionCard } from '../components/ResolutionCard'
import { useResolutionCeremony } from '../hooks/useResolutionCeremony'
```

Inside `DispatchDetailPage`, after the existing `dispatch` data is loaded, add:

1. A `useResolutionCeremony` call wired to the existing `markResolved` callable.
2. Render `<ProgressStepper>` above the action buttons when `dispatch.status` is not `pending`.
3. Render `<ResolutionCard>` as a full-screen overlay when `phase === 'revealed'`.

Exact integration pattern — locate the `return (` in `DispatchDetailPage` and add before the main content div:

```tsx
{
  ceremony.phase === 'revealed' && dispatch && (
    <ResolutionCard
      dispatchId={dispatch.dispatchId}
      incidentType={dispatch.reportType ?? 'Incident'}
      municipality={dispatch.municipality ?? ''}
      acceptedAt={dispatch.acceptedAt?.toMillis() ?? Date.now()}
      onDismiss={() => void navigate('/dispatches')}
    />
  )
}
```

And add `<ProgressStepper currentStep={...} />` where the existing status label is shown. Map dispatch status to stepper step: `accepted/acknowledged → 'acknowledged'`, `en_route → 'en_route'`, `on_scene → 'on_scene'`, `resolved → 'resolved'`.

- [ ] **Step 3: Run typecheck**

Run: `cd apps/responder-app && npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/responder-app/src/pages/DispatchDetailPage.tsx
git commit -m "feat(responder-app): add ProgressStepper and ResolutionCard to DispatchDetailPage"
```

---

### Task 16: Update SosPage

Replace the confirm/cancel stub with the spec-compliant SOS page using `useSosHold` cancel ring.

**Files:**

- Modify: `apps/responder-app/src/pages/SosPage.tsx`

- [ ] **Step 1: Read current file**

Run: `cat apps/responder-app/src/pages/SosPage.tsx`

- [ ] **Step 2: Rewrite SosPage**

```tsx
// apps/responder-app/src/pages/SosPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapPinIcon } from 'lucide-react'
import { useHaptic } from '../hooks/useHaptic'
import { TOKENS } from '../lib/responder-tokens'

const CANCEL_SECONDS = 30
const RING_R = 28
const RING_C = 2 * Math.PI * RING_R

export function SosPage() {
  const navigate = useNavigate()
  const { fire } = useHaptic()
  const [secondsLeft, setSecondsLeft] = useState(CANCEL_SECONDS)

  useEffect(() => {
    fire([30, 50, 30, 50, 50])
  }, [fire])

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  function handleCancel() {
    fire([10])
    void navigate(-1)
  }

  const progress = 1 - secondsLeft / CANCEL_SECONDS
  const dashOffset = RING_C * (1 - progress)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        background: TOKENS.shellBg,
        padding: 24,
        gap: 16,
      }}
    >
      <span
        style={{
          background: '#b91c1c',
          color: 'white',
          fontWeight: 800,
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          borderRadius: 6,
          padding: '4px 12px',
        }}
      >
        SOS ACTIVATED
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: TOKENS.textSecondary }}>
        <MapPinIcon size={14} aria-hidden="true" />
        <span style={{ fontSize: 13 }}>Location transmitted</span>
      </div>

      <p style={{ fontSize: 15, color: 'white', textAlign: 'center', margin: 0 }}>
        Emergency signal sent to all admins.
      </p>
      <p style={{ fontSize: 13, color: TOKENS.textSecondary, textAlign: 'center', margin: 0 }}>
        Stay safe. Help is coming.
      </p>

      <button
        onClick={handleCancel}
        aria-label={`Cancel SOS — ${secondsLeft} seconds remaining`}
        style={{
          position: 'relative',
          width: 72,
          height: 72,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 16,
        }}
      >
        <svg width={72} height={72} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
          <circle
            cx={36}
            cy={36}
            r={RING_R}
            fill="none"
            stroke={TOKENS.borderDark}
            strokeWidth={3}
          />
          <circle
            cx={36}
            cy={36}
            r={RING_R}
            fill="none"
            stroke="#b91c1c"
            strokeWidth={3}
            strokeDasharray={RING_C}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 36 36)"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: TOKENS.textSecondary, zIndex: 1 }}>
          Cancel
        </span>
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd apps/responder-app && npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/responder-app/src/pages/SosPage.tsx
git commit -m "feat(responder-app): replace SosPage with spec-compliant activated view + cancel ring"
```

---

### Task 17: Update RaceLossScreen

Add the card shake animation entry.

**Files:**

- Modify: `apps/responder-app/src/pages/RaceLossScreen.tsx`

- [ ] **Step 1: Read current file**

Run: `cat apps/responder-app/src/pages/RaceLossScreen.tsx`

Current content:

```tsx
// 13 lines — minimal: <h1>This dispatch is no longer available</h1> + Link to home
```

- [ ] **Step 2: Rewrite RaceLossScreen**

```tsx
// apps/responder-app/src/pages/RaceLossScreen.tsx
import { Link } from 'react-router-dom'
import { CircleAlertIcon } from 'lucide-react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { TOKENS } from '../lib/responder-tokens'

export function RaceLossScreen() {
  const reduced = useReducedMotion()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        background: TOKENS.shellBg,
        padding: 24,
        gap: 12,
        animation: reduced ? undefined : 'cardShake 300ms ease forwards',
      }}
    >
      <CircleAlertIcon size={40} color={TOKENS.statusAmber} aria-hidden="true" />
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>Already Taken</h1>
      <p style={{ fontSize: 13, color: TOKENS.textSecondary, margin: 0, textAlign: 'center' }}>
        Another responder accepted first.
      </p>
      <Link
        to="/dispatches"
        style={{
          marginTop: 16,
          background: TOKENS.opsTeal,
          color: 'white',
          borderRadius: 8,
          padding: '14px 32px',
          fontWeight: 700,
          fontSize: 15,
          textDecoration: 'none',
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        Stay Available
      </Link>
      <style>{`
        @keyframes cardShake {
          0%   { transform: translateX(0); }
          20%  { transform: translateX(-4px); }
          40%  { transform: translateX(4px); }
          60%  { transform: translateX(-3px); }
          80%  { transform: translateX(3px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd apps/responder-app && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/responder-app/src/pages/RaceLossScreen.tsx
git commit -m "feat(responder-app): add shake animation to RaceLossScreen"
```

---

### Task 18: Update Routes and App.tsx

Add `ResponderShell` as layout for authenticated routes + stub routes for Map, Messages, Profile, and `/sos`.

**Files:**

- Modify: `apps/responder-app/src/routes.tsx`
- Modify: `apps/responder-app/src/App.tsx`

- [ ] **Step 1: Read both files**

Run: `cat apps/responder-app/src/routes.tsx && cat apps/responder-app/src/App.tsx`

- [ ] **Step 2: Add stub page files for new routes**

Create `apps/responder-app/src/pages/MapPage.tsx`:

```tsx
import { TOKENS } from '../lib/responder-tokens'
export function MapPage() {
  return <div style={{ padding: 16, color: TOKENS.textMuted }}>Map — coming soon</div>
}
```

Create `apps/responder-app/src/pages/MessagesPage.tsx`:

```tsx
import { TOKENS } from '../lib/responder-tokens'
export function MessagesPage() {
  return <div style={{ padding: 16, color: TOKENS.textMuted }}>Messages — coming soon</div>
}
```

Create `apps/responder-app/src/pages/ProfilePage.tsx`:

```tsx
import { TOKENS } from '../lib/responder-tokens'
export function ProfilePage() {
  return <div style={{ padding: 16, color: TOKENS.textMuted }}>Profile — coming soon</div>
}
```

- [ ] **Step 3: Update routes.tsx**

Add imports:

```tsx
import { ResponderShell } from './components/ResponderShell'
import { MapPage } from './pages/MapPage'
import { MessagesPage } from './pages/MessagesPage'
import { ProfilePage } from './pages/ProfilePage'
```

Wrap authenticated routes with `ResponderShell` as the layout element. The `AppLayout` currently handles FCM/telemetry setup — keep it as the outermost wrapper. Inside it, add `ResponderShell` wrapping the tab routes (Dispatches, Map, Messages, Profile). SOS route (`/sos`) gets `ResponderShell` wrapper too.

Replace the `AppLayout`'s outlet content with this structure:

```tsx
// Inside createBrowserRouter, under the authenticated layout route:
{
  element: <ProtectedRoute allowedRoles={['responder']}><ResponderShell><Outlet /></ResponderShell></ProtectedRoute>,
  children: [
    { path: '/dispatches', element: <DispatchListPage /> },
    { path: '/dispatches/:id', element: <DispatchDetailPage /> },
    { path: '/dispatches/:id/sos', element: <SosPage /> },
    { path: '/sos', element: <SosPage /> },
    { path: '/map', element: <MapPage /> },
    { path: '/messages', element: <MessagesPage /> },
    { path: '/profile', element: <ProfilePage /> },
  ],
}
```

Root path `/` should redirect to `/dispatches`.

- [ ] **Step 4: Run typecheck**

Run: `cd apps/responder-app && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Run all tests**

Run: `cd apps/responder-app && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/responder-app/src/routes.tsx apps/responder-app/src/pages/MapPage.tsx apps/responder-app/src/pages/MessagesPage.tsx apps/responder-app/src/pages/ProfilePage.tsx
git commit -m "feat(responder-app): wire ResponderShell layout + stub Map/Messages/Profile routes"
```

---

### Task 19: Final Gate — Lint, Typecheck, All Tests

- [ ] **Step 1: Run full lint**

Run: `cd apps/responder-app && pnpm lint`
Expected: 0 errors. Fix any lint issues before proceeding.

- [ ] **Step 2: Run typecheck**

Run: `cd apps/responder-app && pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Run all tests**

Run: `cd apps/responder-app && npx vitest run`
Expected: All test files pass.

- [ ] **Step 4: Run monorepo lint + typecheck gate**

Run: `pnpm --filter @bantayog/responder-app lint typecheck` from repo root.
Expected: Both pass cleanly.

- [ ] **Step 5: Commit gate results (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(responder-app): lint and typecheck gate fixes for Sub-spec 1"
```

---

## Self-Review

**Spec coverage check:**

| Spec section                            | Covered by task                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| §3 Design tokens                        | Task 2                                                                                                                          |
| §4.1 App Header                         | Task 13                                                                                                                         |
| §4.2 Bottom Tab Bar                     | Task 13                                                                                                                         |
| §4.3 Availability Pill                  | Deferred to Sub-spec 2 (§4.3 is a Profile/availability concern)                                                                 |
| §5 Dispatch Card + states + borders     | Task 11                                                                                                                         |
| §5.3 Countdown timer                    | Tasks 5, 11                                                                                                                     |
| §5.4 Offline state                      | Task 11                                                                                                                         |
| §6.1 Ceremony hooks architecture        | Tasks 6, 7, 8                                                                                                                   |
| §6.2 Dispatch acceptance ceremony       | Tasks 6, 11                                                                                                                     |
| §6.3 Race loss screen                   | Task 17                                                                                                                         |
| §6.4 On scene arrival + ProgressStepper | Tasks 9, 15                                                                                                                     |
| §6.5 Resolution ceremony                | Tasks 7, 12, 15                                                                                                                 |
| §6.6 SOS hold + SosButton               | Tasks 8, 10                                                                                                                     |
| §6.6 SosPage                            | Task 16                                                                                                                         |
| §7 12h re-auth modal                    | NOTE: Deferred — requires Firebase `onIdTokenChanged` + re-auth callable not in scope for Sub-spec 1. Add as Task 20 if needed. |
| §8 File list                            | All 11 new files + 6 modified covered                                                                                           |
| §10 Motion constraints (reduced motion) | Task 3 + all component tasks                                                                                                    |
| §11 Accessibility                       | Covered inline in each component task                                                                                           |

**12h re-auth gap:** §7 (12h re-auth modal) requires `onIdTokenChanged` to detect token expiry and show a non-dismissible OTP modal. This is a `ResponderShell` concern but requires the re-auth callable. Adding as optional Task 20 below.

---

### Task 20 (Optional): 12h Re-Auth Modal in ResponderShell

Only implement if the `reAuthWithOtp` callable exists in `functions/src/index.ts`. Check with:
`grep -r "reAuthWithOtp\|reauth" functions/src/ | head -5`

If it exists, add the non-dismissible modal overlay to `ResponderShell.tsx`:

- [ ] Detect expired session via `useEffect` on `onIdTokenChanged` + catch `auth/requires-recent-login`
- [ ] Render a `role="dialog" aria-modal="true"` overlay with 6 OTP digit inputs
- [ ] Each digit input: `scale(1.0 → 1.06 → 1.0, 150ms)` on fill + `vibrate(15)`
- [ ] On verify success: dismiss modal, no navigation
- [ ] On 3 failures: sign out and navigate to `/`
- [ ] Commit: `feat(responder-app): add 12h re-auth OTP modal to ResponderShell`
