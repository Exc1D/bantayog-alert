# Report Status UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Secret-only report lookup, emotionally-resonant TrackingScreen with radar animation, persistent active-report pill in CitizenShell, and elevated secret-code presentation in ReceiptScreen.

**Architecture:** Extract `RadarRings` + `AnimatedCheck` as a shared UI component; extend `requestLookup` callable to accept `{ secret }` alone (server computes `sha256(secret)`, queries `secret_lookup/{hash}`, returns `publicRef`); add `secret_lookup/{tokenHash}` Firestore collection written by `process-inbox-item` for web submissions only; redesign LookupScreen to a single-field form that navigates directly to TrackingScreen; mount a persistent `ReportStatusPill` (framer-motion slide-up) above the nav bar in CitizenShell.

**Tech Stack:** React 18, framer-motion, lucide-react, Vitest + React Testing Library, Firebase Functions v2 (onCall), Zod unions, `@firebase/rules-unit-testing`, Node `crypto` (sha256), TypeScript strict, Tailwind CSS.

---

## File Map

| Role       | Path                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| **Create** | `apps/citizen-pwa/src/components/ui/RadarRings.tsx`                                                  |
| **Create** | `apps/citizen-pwa/src/components/ui/RadarRings.test.tsx`                                             |
| **Create** | `apps/citizen-pwa/src/components/ReportStatusPill.tsx`                                               |
| **Create** | `apps/citizen-pwa/src/components/ReportStatusPill.test.tsx`                                          |
| **Create** | `apps/citizen-pwa/src/components/TrackingScreen.test.tsx`                                            |
| **Modify** | `apps/citizen-pwa/src/components/ReceiptScreen.tsx`                                                  |
| **Modify** | `apps/citizen-pwa/src/components/LookupScreen.tsx`                                                   |
| **Modify** | `apps/citizen-pwa/src/components/LookupScreen.test.tsx`                                              |
| **Modify** | `apps/citizen-pwa/src/components/TrackingScreen.tsx`                                                 |
| **Modify** | `apps/citizen-pwa/src/components/CitizenShell.tsx`                                                   |
| **Modify** | `apps/citizen-pwa/src/components/CitizenShell.test.tsx`                                              |
| **Modify** | `apps/citizen-pwa/tailwind.config.cjs`                                                               |
| **Modify** | `functions/src/callables/request-lookup.ts`                                                          |
| **Modify** | `functions/src/__tests__/callables/request-lookup.test.ts`                                           |
| **Modify** | `functions/src/triggers/process-inbox-item.ts`                                                       |
| **Modify** | `functions/src/__tests__/triggers/process-inbox-item.test.ts`                                        |
| **Modify** | `infra/firebase/firestore.rules` (**⚠ SHOW DIFF TO USER — await explicit "proceed" before editing**) |

---

## Task 1: Extract RadarRings UI component

**Files:**

- Create: `apps/citizen-pwa/src/components/ui/RadarRings.tsx`
- Create: `apps/citizen-pwa/src/components/ui/RadarRings.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/citizen-pwa/src/components/ui/RadarRings.test.tsx
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { RadarRings } from './RadarRings.js'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      style,
      className,
      ...rest
    }: React.HTMLAttributes<HTMLDivElement> & { animate?: unknown; transition?: unknown }) => (
      <div className={className} style={style} data-testid="radar-ring">
        {children}
      </div>
    ),
  },
}))

describe('RadarRings', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders three rings with the given border color', () => {
    render(<RadarRings color="#0f9488" />)
    const rings = screen.getAllByTestId('radar-ring')
    expect(rings).toHaveLength(3)
    rings.forEach((ring) => {
      expect(ring).toHaveStyle({ borderColor: '#0f9488' })
    })
  })

  it('hides rings after autoHideMs', async () => {
    const { container } = render(<RadarRings color="#0f9488" autoHideMs={6000} />)
    const wrapper = container.firstChild as HTMLDivElement
    expect(wrapper).toBeVisible()

    act(() => {
      vi.advanceTimersByTime(6000)
    })
    expect(wrapper.style.display).toBe('none')
  })

  it('does not auto-hide when autoHideMs is omitted', () => {
    const { container } = render(<RadarRings color="#0f9488" />)
    const wrapper = container.firstChild as HTMLDivElement
    act(() => {
      vi.advanceTimersByTime(60000)
    })
    expect(wrapper.style.display).not.toBe('none')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/citizen-pwa && pnpm vitest run --reporter=verbose src/components/ui/RadarRings.test.tsx
```

Expected: FAIL — `Cannot find module './RadarRings.js'`

- [ ] **Step 3: Create RadarRings.tsx**

```tsx
// apps/citizen-pwa/src/components/ui/RadarRings.tsx
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const SHEET_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]

export function AnimatedCheck() {
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

interface RadarRingsProps {
  color: string
  autoHideMs?: number
  animate?: boolean
}

export function RadarRings({ color, autoHideMs, animate = true }: RadarRingsProps) {
  const ringsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!autoHideMs) return
    const timer = setTimeout(() => {
      if (ringsRef.current) ringsRef.current.style.display = 'none'
    }, autoHideMs)
    return () => {
      clearTimeout(timer)
    }
  }, [autoHideMs])

  return (
    <div ref={ringsRef} className="absolute inset-0 flex items-center justify-center">
      {([0, 0.5, 1.0] as const).map((delay, i) => (
        <motion.div
          key={i}
          className="absolute w-20 h-20 rounded-full border-2"
          style={{ borderColor: color, ...(animate ? {} : { opacity: 0.2 }) }}
          {...(animate
            ? {
                animate: { scale: [1, 2.5], opacity: [0.7, 0] },
                transition: { duration: 2, repeat: Infinity, delay, ease: 'easeOut' },
              }
            : {})}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/citizen-pwa && pnpm vitest run --reporter=verbose src/components/ui/RadarRings.test.tsx
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add apps/citizen-pwa/src/components/ui/RadarRings.tsx apps/citizen-pwa/src/components/ui/RadarRings.test.tsx
git commit -m "feat(citizen-pwa): extract RadarRings + AnimatedCheck to ui/ component"
```

---

## Task 2: Update ReceiptScreen

Replace local `RadarRings`/`AnimatedCheck` with the shared component, elevate secret code box, add copy button, change "Track My Report" to navigate directly to `/reports/:publicRef`.

**Files:**

- Modify: `apps/citizen-pwa/src/components/ReceiptScreen.tsx`

_No test file exists for ReceiptScreen. Changes are: 2 import replacements, 3 styling tweaks, 1 navigation target change, 1 new copy button. All are low-risk visual/wiring changes. Covered by manual smoke-test and existing integration test suite._

- [ ] **Step 1: Update ReceiptScreen.tsx**

Replace the file content:

```tsx
// apps/citizen-pwa/src/components/ReceiptScreen.tsx
import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { KeyRound } from 'lucide-react'
import { useSlotMachine } from '../hooks/useSlotMachine.js'
import { RadarRings, AnimatedCheck } from './ui/RadarRings.js'

const SHEET_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]
const CONTENT_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]

export function ReceiptScreen() {
  const { state } = useLocation() as {
    state: { publicRef: string; secret: string } | null
  }
  const navigate = useNavigate()
  const { display } = useSlotMachine(state?.publicRef ?? '', 600, 400)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!state) return
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100])
  }, [state])

  function handleCopy() {
    if (!state) return
    navigator.clipboard
      .writeText(state.secret)
      .then(() => {
        setCopied(true)
        setTimeout(() => {
          setCopied(false)
        }, 1500)
      })
      .catch(() => {
        /* unsupported — ignore */
      })
  }

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
        className="relative z-10 bg-surface-50 rounded-t-3xl shadow-2xl overflow-hidden max-h-[85vh]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: SHEET_EASE }}
      >
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
            <RadarRings color="rgb(5,150,105)" autoHideMs={6000} />
            <div className="relative z-10 w-20 h-20 rounded-full bg-success-500 flex items-center justify-center shadow-glow-success">
              <AnimatedCheck />
            </div>
          </div>

          <h2 className="text-3xl font-extrabold text-surface-900 mb-2">Report Received</h2>
          <p className="text-sm text-surface-500 mb-8 max-w-xs">
            Emergency responders have been notified. Your report is now in the system.
          </p>

          {/* Tracking reference */}
          <div className="bg-surface-100 rounded-xl border border-surface-200 px-6 py-4 mb-4 w-full">
            <p className="text-xs text-surface-400 uppercase tracking-wider mb-1">
              Tracking Reference
            </p>
            <p className="text-3xl font-bold tracking-widest text-surface-900 font-mono">
              {display}
            </p>
          </div>

          {/* Secret code — elevated */}
          <div className="bg-brand-50 rounded-xl border border-brand-400 px-6 py-4 mb-8 w-full">
            <div className="flex items-center gap-1 mb-1">
              <KeyRound size={14} className="text-brand-500 flex-shrink-0" />
              <p className="text-xs font-bold text-brand-600 uppercase tracking-wider">
                Your Secret Code
              </p>
            </div>
            <p className="text-2xl font-bold tracking-widest text-surface-900 font-mono">
              {state.secret}
            </p>
            <p className="text-sm text-surface-600 mt-1">
              This is the only code you need to track your report. Save it somewhere safe.
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-3 text-xs font-semibold text-brand-600 underline"
            >
              {copied ? 'Copied!' : 'Copy secret code'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => void navigate(`/reports/${state.publicRef}`)}
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

- [ ] **Step 2: Run full citizen-pwa test suite**

```bash
cd apps/citizen-pwa && pnpm vitest run --reporter=verbose
```

Expected: all previously-passing tests still pass

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/src/components/ReceiptScreen.tsx
git commit -m "feat(citizen-pwa): elevate secret code in ReceiptScreen, use shared RadarRings"
```

---

## Task 3: Extend requestLookup callable

Add secret-only path, add `publicRef` to return type, add `auth` to input.

**Files:**

- Modify: `functions/src/callables/request-lookup.ts`
- Modify: `functions/src/__tests__/callables/request-lookup.test.ts`

- [ ] **Step 1: Write failing tests**

Replace the test file content:

```typescript
// functions/src/__tests__/callables/request-lookup.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { requestLookupImpl } from '../../callables/request-lookup.js'

const mockGet = vi.fn()

function db() {
  return {
    collection: () => ({ doc: () => ({ get: mockGet }) }),
  }
}

beforeEach(() => mockGet.mockReset())

describe('requestLookupImpl — both-codes path', () => {
  const secret = 'abc'
  const tokenHash = createHash('sha256').update(secret).digest('hex')

  it('returns NOT_FOUND when the public ref does not exist', async () => {
    mockGet.mockResolvedValue({ exists: false })
    await expect(
      requestLookupImpl({ db: db() as never, data: { publicRef: 'a1b2c3d4', secret } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns FORBIDDEN on secret mismatch', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ reportId: 'r1', tokenHash: 'x'.repeat(64), expiresAt: Date.now() + 1e6 }),
    })
    await expect(
      requestLookupImpl({ db: db() as never, data: { publicRef: 'a1b2c3d4', secret: 'wrong' } }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('returns NOT_FOUND when expired', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ reportId: 'r1', tokenHash, expiresAt: Date.now() - 1 }),
    })
    await expect(
      requestLookupImpl({ db: db() as never, data: { publicRef: 'a1b2c3d4', secret } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns status + publicRef on success', async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ reportId: 'r1', tokenHash, expiresAt: Date.now() + 1e6 }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: 'verified',
          municipalityLabel: 'Daet',
          submittedAt: 1713350400000,
          updatedAt: 1713350401000,
        }),
      })
    const result = await requestLookupImpl({
      db: db() as never,
      data: { publicRef: 'a1b2c3d4', secret },
    })
    expect(result).toEqual({
      publicRef: 'a1b2c3d4',
      status: 'verified',
      lastStatusAt: 1713350401000,
      municipalityLabel: 'Daet',
    })
  })
})

describe('requestLookupImpl — secret-only path', () => {
  const secret = 'abc'
  const secretHash = createHash('sha256').update(secret).digest('hex')

  it('returns UNAUTHORIZED when auth is absent', async () => {
    await expect(
      requestLookupImpl({ db: db() as never, data: { secret }, auth: null }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('returns NOT_FOUND when secret_lookup doc does not exist', async () => {
    mockGet.mockResolvedValue({ exists: false })
    await expect(
      requestLookupImpl({ db: db() as never, data: { secret }, auth: { uid: 'u1' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns NOT_FOUND when secret_lookup entry is expired', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ publicRef: 'a1b2c3d4', reportId: 'r1', expiresAt: Date.now() - 1 }),
    })
    await expect(
      requestLookupImpl({ db: db() as never, data: { secret }, auth: { uid: 'u1' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns status + publicRef on success', async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ publicRef: 'a1b2c3d4', reportId: 'r1', expiresAt: Date.now() + 1e6 }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: 'awaiting_verify',
          municipalityLabel: 'Daet',
          submittedAt: 1713350400000,
          updatedAt: 1713350401000,
        }),
      })
    const result = await requestLookupImpl({
      db: db() as never,
      data: { secret },
      auth: { uid: 'u1' },
    })
    expect(result).toEqual({
      publicRef: 'a1b2c3d4',
      status: 'awaiting_verify',
      lastStatusAt: 1713350401000,
      municipalityLabel: 'Daet',
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd functions && pnpm vitest run --reporter=verbose src/__tests__/callables/request-lookup.test.ts
```

Expected: FAIL — 4 new tests fail (UNAUTHORIZED, NOT_FOUND secret, expired, success secret-only); existing `returns status` test fails because result lacks `publicRef`

- [ ] **Step 3: Update request-lookup.ts**

```typescript
// functions/src/callables/request-lookup.ts
import { createHash } from 'node:crypto'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'
import { bantayogErrorToHttps } from './https-error.js'

const payloadSchema = z.union([
  z
    .object({
      publicRef: z.string().regex(/^[a-z0-9]{8}$/),
      secret: z.string().min(1).max(64),
    })
    .strict(),
  z
    .object({
      secret: z.string().min(1).max(64),
    })
    .strict(),
])

export interface RequestLookupInput {
  db: Firestore
  data: unknown
  auth?: { uid: string } | null
}

export interface RequestLookupResult {
  publicRef: string
  status: string
  lastStatusAt: number
  municipalityLabel: string
}

export async function requestLookupImpl(input: RequestLookupInput): Promise<RequestLookupResult> {
  const parsed = payloadSchema.safeParse(input.data)
  if (!parsed.success) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Invalid lookup request payload.')
  }

  const data = parsed.data
  const secretOnlyPath = !('publicRef' in data)
  const secretHash = createHash('sha256').update(data.secret).digest('hex')

  let resolvedPublicRef: string
  let reportId: string

  if (secretOnlyPath) {
    if (!input.auth) {
      throw new BantayogError(
        BantayogErrorCode.UNAUTHORIZED,
        'Authentication required for secret-only lookup.',
      )
    }

    const secretSnap = await input.db.collection('secret_lookup').doc(secretHash).get()
    if (!secretSnap.exists) {
      throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Unknown secret.')
    }

    const secretDoc = secretSnap.data() as {
      publicRef: string
      reportId: string
      expiresAt: number
    }
    if (secretDoc.expiresAt < Date.now()) {
      throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Secret expired.')
    }

    resolvedPublicRef = secretDoc.publicRef
    reportId = secretDoc.reportId
  } else {
    const { publicRef } = data as { publicRef: string; secret: string }
    resolvedPublicRef = publicRef

    const lookupSnap = await input.db.collection('report_lookup').doc(publicRef).get()
    if (!lookupSnap.exists) {
      throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Unknown reference.')
    }

    const lookup = lookupSnap.data() as {
      reportId: string
      tokenHash: string
      expiresAt: number
    }
    if (lookup.expiresAt < Date.now()) {
      throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Reference expired.')
    }
    if (secretHash !== lookup.tokenHash) {
      throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Secret mismatch.')
    }

    reportId = lookup.reportId
  }

  const reportSnap = await input.db.collection('reports').doc(reportId).get()
  if (!reportSnap.exists) {
    throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found.')
  }

  const report = reportSnap.data() as {
    status?: string
    municipalityLabel?: string
    submittedAt?: number
    updatedAt?: number
  }

  return {
    publicRef: resolvedPublicRef,
    status: report.status ?? 'unknown',
    lastStatusAt: report.updatedAt ?? report.submittedAt ?? 0,
    municipalityLabel: report.municipalityLabel ?? 'Unknown',
  }
}

export const requestLookup = onCall(async (request) => {
  try {
    return await requestLookupImpl({
      db: getFirestore(),
      data: request.data,
      auth: request.auth ?? null,
    })
  } catch (err: unknown) {
    if (err instanceof BantayogError) {
      throw bantayogErrorToHttps(err)
    }
    throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error')
  }
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd functions && pnpm vitest run --reporter=verbose src/__tests__/callables/request-lookup.test.ts
```

Expected: PASS — 8 tests

- [ ] **Step 5: Type-check**

```bash
cd functions && pnpm typecheck
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add functions/src/callables/request-lookup.ts functions/src/__tests__/callables/request-lookup.test.ts
git commit -m "feat(functions): extend requestLookup with secret-only path + return publicRef"
```

---

## Task 4: Add secret_lookup write in process-inbox-item

Write `secret_lookup/{tokenHash}` inside the Firestore transaction, after the `report_lookup` write, for `source: 'web'` submissions only.

**Files:**

- Modify: `functions/src/triggers/process-inbox-item.ts`
- Modify: `functions/src/__tests__/triggers/process-inbox-item.test.ts`

⚠️ **Requires Firestore emulator running:**

```bash
firebase emulators:start --only firestore
```

- [ ] **Step 1: Write failing test**

In `process-inbox-item.test.ts`, add to the cleanup `collections` array and add a new test:

Find the `beforeEach` block that lists `collections` and add `'secret_lookup'`:

```typescript
// In the collections array inside beforeEach:
const collections = [
  'report_inbox',
  'reports',
  'report_private',
  'report_ops',
  'report_events',
  'report_lookup',
  'secret_lookup', // ← add this line
  'moderation_incidents',
  'idempotency_keys',
  'pending_media',
  'sms_outbox',
]
```

Then add these two tests to the `describe('processInboxItemCore', () => {` block (after the existing test):

```typescript
it('writes secret_lookup doc for web submissions', async () => {
  await env!.withSecurityRulesDisabled(async (ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = ctx.firestore() as any
    await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-web'), {
      reporterUid: 'citizen-1',
      clientCreatedAt: 1713350400000,
      idempotencyKey: 'idem-web',
      publicRef: 'b2c3d4e5',
      secretHash: 'a'.repeat(64),
      correlationId: '22222222-2222-4222-8222-222222222222',
      payload: {
        reportType: 'fire',
        description: 'building fire',
        severity: 'high',
        source: 'web',
        publicLocation: { lat: 14.11, lng: 122.95 },
      },
    })

    await processInboxItemCore({ db, inboxId: 'ibx-web', municipalityId: 'daet' })

    const secretSnap = await getDoc(doc(ctx.firestore(), 'secret_lookup', 'a'.repeat(64)))
    expect(secretSnap.exists()).toBe(true)
    const data = secretSnap.data()!
    expect(data.publicRef).toBe('b2c3d4e5')
    expect(typeof data.reportId).toBe('string')
    expect(data.expiresAt).toBeGreaterThan(Date.now())
  })
})

it('does NOT write secret_lookup for sms submissions', async () => {
  await env!.withSecurityRulesDisabled(async (ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = ctx.firestore() as any
    await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-sms'), {
      reporterUid: 'citizen-sms',
      clientCreatedAt: 1713350400000,
      idempotencyKey: 'idem-sms',
      publicRef: 'c3d4e5f6',
      secretHash: 'b'.repeat(64),
      correlationId: '33333333-3333-4333-8333-333333333333',
      payload: {
        reportType: 'flood',
        description: 'flooding',
        severity: 'medium',
        source: 'sms',
        publicLocation: { lat: 14.11, lng: 122.95 },
        contact: {
          phone: '+639171234567',
          smsConsent: true,
        },
      },
    })

    await processInboxItemCore({ db, inboxId: 'ibx-sms', municipalityId: 'daet' })

    const secretSnap = await getDoc(doc(ctx.firestore(), 'secret_lookup', 'b'.repeat(64)))
    expect(secretSnap.exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd functions && pnpm vitest run --reporter=verbose src/__tests__/triggers/process-inbox-item.test.ts
```

Expected: first new test FAIL (secret_lookup doc doesn't exist yet), second new test PASS (no write is correct current behaviour), cleanup test for `secret_lookup` docs runs silently

- [ ] **Step 3: Add secret_lookup write in process-inbox-item.ts**

In the `db.runTransaction` block, immediately after the `report_lookup` write (after line 210, the `tx.set(db.collection('report_lookup')...)`), add:

```typescript
// Write secret_lookup only for web submissions — SMS uses a random tokenHash
// the user never sees, so a secret-only lookup makes no sense for those.
if (payload.source === 'web') {
  tx.set(db.collection('secret_lookup').doc(inbox.secretHash), {
    publicRef: inbox.publicRef,
    reportId,
    expiresAt: createdAt + 90 * 24 * 60 * 60 * 1000,
  })
}
```

Exact insertion point — after this existing block:

```typescript
tx.set(db.collection('report_lookup').doc(inbox.publicRef), {
  reportId,
  tokenHash: inbox.secretHash,
  expiresAt: createdAt + 90 * 24 * 60 * 60 * 1000,
  createdAt,
  schemaVersion: 1,
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd functions && pnpm vitest run --reporter=verbose src/__tests__/triggers/process-inbox-item.test.ts
```

Expected: PASS — all tests including the 2 new ones

- [ ] **Step 5: Type-check + lint**

```bash
cd functions && pnpm typecheck && pnpm lint
```

Expected: 0 errors, 0 warnings

- [ ] **Step 6: Commit**

```bash
git add functions/src/triggers/process-inbox-item.ts functions/src/__tests__/triggers/process-inbox-item.test.ts
git commit -m "feat(functions): write secret_lookup on web report submission"
```

---

## Task 5: Firestore security rules

⚠️ **SHOW THE FOLLOWING DIFF TO THE USER AND AWAIT EXPLICIT "proceed" BEFORE EDITING.**

**Diff to show:**

```diff
--- a/infra/firebase/firestore.rules
+++ b/infra/firebase/firestore.rules
@@ -214,6 +214,11 @@
     match /report_lookup/{publicRef} {
       allow read: if true;
       allow write: if false;
     }

+    match /secret_lookup/{tokenHash} {
+      allow read: if request.auth != null;
+      allow write: if false;
+    }
+
     // ================================================================
```

After user confirms "proceed":

- [ ] **Step 1: Apply the rule**

Edit `infra/firebase/firestore.rules`, inserting the new block immediately after line 217 (after the closing `}` of `report_lookup`):

```
    match /secret_lookup/{tokenHash} {
      allow read: if request.auth != null;
      allow write: if false;
    }
```

- [ ] **Step 2: Commit**

```bash
git add infra/firebase/firestore.rules
git commit -m "security(firestore): add secret_lookup read rule — requires auth"
```

---

## Task 6: Redesign LookupScreen

Single secret-field form; teal header; navigate to `/reports/:publicRef` on success.

**Files:**

- Modify: `apps/citizen-pwa/src/components/LookupScreen.tsx`
- Modify: `apps/citizen-pwa/src/components/LookupScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

Replace the test file content:

```tsx
// apps/citizen-pwa/src/components/LookupScreen.test.tsx
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../services/firebase.js', () => ({
  fns: () => ({}),
  hasFirebaseConfig: () => false,
  ensureSignedIn: () => Promise.resolve(),
  FIREBASE_ENV_ERROR_MESSAGE: 'Firebase not configured',
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: () => () =>
    Promise.resolve({
      data: {
        publicRef: 'a1b2c3d4',
        status: 'new',
        lastStatusAt: Date.now(),
        municipalityLabel: 'Daet',
      },
    }),
}))

import { LookupScreen } from './LookupScreen'

function renderScreen() {
  return render(
    <MemoryRouter>
      <LookupScreen />
    </MemoryRouter>,
  )
}

beforeEach(() => mockNavigate.mockReset())

describe('LookupScreen', () => {
  it('renders a single secret code input', () => {
    renderScreen()
    expect(screen.getByPlaceholderText('Your secret code')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('BA-2026-XXXXX')).not.toBeInTheDocument()
  })

  it('renders the Find My Report submit button', () => {
    renderScreen()
    expect(screen.getByRole('button', { name: /find my report/i })).toBeInTheDocument()
  })

  it('shows teal header with Track your Report heading', () => {
    renderScreen()
    expect(screen.getByText('Track your Report')).toBeInTheDocument()
  })

  it('shows validation error when submitted empty', async () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /find my report/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('navigates to /reports/:publicRef on successful lookup', async () => {
    renderScreen()
    fireEvent.change(screen.getByPlaceholderText('Your secret code'), {
      target: { value: 'mysecretcode' },
    })
    fireEvent.click(screen.getByRole('button', { name: /find my report/i }))
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/reports/a1b2c3d4')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/citizen-pwa && pnpm vitest run --reporter=verbose src/components/LookupScreen.test.tsx
```

Expected: FAIL — tests assert for secret-only form, teal header, navigation to `/reports/a1b2c3d4`

- [ ] **Step 3: Rewrite LookupScreen.tsx**

```tsx
// apps/citizen-pwa/src/components/LookupScreen.tsx
import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  fns,
  hasFirebaseConfig,
  ensureSignedIn,
  FIREBASE_ENV_ERROR_MESSAGE,
} from '../services/firebase.js'

interface LookupResult {
  publicRef: string
  status: string
  lastStatusAt: number
  municipalityLabel: string
}

const FRIENDLY_ERROR =
  "We couldn't find a report with that secret code. It may have expired (reports are tracked for 90 days)."

function friendlyLookupError(err: unknown): string {
  if (!hasFirebaseConfig()) return FIREBASE_ENV_ERROR_MESSAGE
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
  if (code === 'functions/not-found' || code === 'not-found') return FRIENDLY_ERROR
  if (code === 'functions/permission-denied' || code === 'permission-denied') return FRIENDLY_ERROR
  if (code === 'functions/unauthenticated' || code === 'unauthenticated') {
    return 'Please refresh and try again.'
  }
  if (code === 'functions/resource-exhausted' || code === 'resource-exhausted') {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  return 'Something went wrong. Please try again or call the hotline.'
}

export function LookupScreen() {
  const navigate = useNavigate()
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    const trimmedSecret = secret.trim()
    if (!trimmedSecret) {
      setError('Please enter your secret code.')
      return
    }
    setLoading(true)
    try {
      if (!hasFirebaseConfig()) {
        throw new Error(FIREBASE_ENV_ERROR_MESSAGE)
      }
      await ensureSignedIn()
      const res = await httpsCallable(fns(), 'requestLookup')({ secret: trimmedSecret })
      const result = res.data as LookupResult
      void navigate(`/reports/${result.publicRef}`)
    } catch (e: unknown) {
      console.error('[LookupScreen] requestLookup failed:', e)
      setError(friendlyLookupError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#f0f4f4]">
      <div className="flex items-center gap-3 px-4 pt-12 pb-6 bg-brand-500 text-white">
        <button
          type="button"
          onClick={() => {
            window.history.back()
          }}
          className="border-0 bg-transparent cursor-pointer p-0"
          aria-label="Go back"
        >
          <ArrowLeft size={20} color="#fff" />
        </button>
        <h1 className="m-0 font-bold text-xl">Track your Report</h1>
      </div>

      <div className="flex-1 px-4 pt-6">
        <h2 className="mb-1 text-xl font-extrabold text-[#001e40]">Find your report</h2>
        <p className="mb-1 text-[0.8125rem] text-[#52606d]">
          Enter your secret code to check your report status.
        </p>
        <p className="mb-6 text-[0.6875rem] text-[#7b8794] italic">
          Ang iyong secret code ang susi sa iyong ulat.
        </p>

        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <label className="block mb-6">
            <span className="flex items-center gap-1 text-xs font-semibold mb-2 text-brand-600">
              <KeyRound size={14} />
              Secret Code
            </span>
            <input
              type="password"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={secret}
              onChange={(e) => {
                setSecret(e.target.value)
              }}
              required
              className="font-mono tracking-widest w-full h-12 rounded-xl px-4 text-base bg-white border border-[#d5dedd] outline-none focus:border-[#0f9488] motion-safe:transition-colors motion-safe:duration-200"
              placeholder="Your secret code"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className={`w-full h-14 rounded-xl text-white font-semibold text-base border-0 bg-gradient-to-br from-[#0f9488] to-[#0d7377] ${loading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {loading ? 'Searching…' : 'Find My Report'}
          </button>
        </form>

        {error && (
          <div role="alert" className="mt-4">
            <p className="text-[#b71c1c] text-sm font-semibold">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/citizen-pwa && pnpm vitest run --reporter=verbose src/components/LookupScreen.test.tsx
```

Expected: PASS — 5 tests

- [ ] **Step 5: Run full citizen-pwa test suite**

```bash
cd apps/citizen-pwa && pnpm vitest run --reporter=verbose
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/citizen-pwa/src/components/LookupScreen.tsx apps/citizen-pwa/src/components/LookupScreen.test.tsx
git commit -m "feat(citizen-pwa): LookupScreen — secret-only form, navigate to TrackingScreen"
```

---

## Task 7: Redesign TrackingScreen

Add `warning-600` color token, status-aware hero banner with `RadarRings`, humanized timeline labels, pending "Awaiting resolution" event.

**Files:**

- Modify: `apps/citizen-pwa/tailwind.config.cjs`
- Modify: `apps/citizen-pwa/src/components/TrackingScreen.tsx`
- Create: `apps/citizen-pwa/src/components/TrackingScreen.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/citizen-pwa/src/components/TrackingScreen.test.tsx
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../hooks/useReport.js', () => ({
  useReport: vi.fn(),
}))
vi.mock('./ui/RadarRings.js', () => ({
  RadarRings: ({ color }: { color: string }) => (
    <div data-testid="radar-rings" data-color={color} />
  ),
}))
vi.mock('../services/firebase.js', () => ({
  db: () => ({}),
  hasFirebaseConfig: () => false,
}))

import { TrackingScreen } from './TrackingScreen'
import { useReport } from '../hooks/useReport.js'

const mockUseReport = vi.mocked(useReport)

function renderScreen(ref = 'a1b2c3d4') {
  return render(
    <MemoryRouter initialEntries={[`/reports/${ref}`]}>
      <Routes>
        <Route path="/reports/:reference" element={<TrackingScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

function mockReport(overrides: Partial<{ status: string; timeline: unknown[] }> = {}) {
  mockUseReport.mockReturnValue({
    data: {
      id: 'r1',
      status: overrides.status ?? 'awaiting_verify',
      timeline: (overrides.timeline ?? []) as never,
      reportType: 'flood',
      createdAt: 1713350400000,
      reporterName: 'Juan',
      reporterPhone: '09171234567',
      location: { lat: 14.11, lng: 122.95, address: 'Test St' },
    } as never,
    isPending: false,
    error: null,
  } as never)
}

describe('TrackingScreen', () => {
  it('shows brand-500 hero for awaiting_verify', () => {
    mockReport({ status: 'awaiting_verify' })
    renderScreen()
    expect(screen.getByText("Your report is in the queue. We've got it.")).toBeInTheDocument()
    expect(screen.getByTestId('radar-rings')).toBeInTheDocument()
  })

  it('shows success hero for resolved', () => {
    mockReport({ status: 'resolved' })
    renderScreen()
    expect(screen.getByText('Situation resolved. Thank you.')).toBeInTheDocument()
    expect(screen.queryByTestId('radar-rings')).not.toBeInTheDocument()
  })

  it('shows warning hero for en_route', () => {
    mockReport({ status: 'en_route' })
    renderScreen()
    expect(screen.getByText('Help is on the way.')).toBeInTheDocument()
    expect(screen.getByTestId('radar-rings')).toBeInTheDocument()
  })

  it('shows surface hero for rejected', () => {
    mockReport({ status: 'rejected' })
    renderScreen()
    expect(screen.getByText('This report was not accepted for review.')).toBeInTheDocument()
    expect(screen.queryByTestId('radar-rings')).not.toBeInTheDocument()
  })

  it('humanizes timeline event labels', () => {
    mockReport({
      status: 'awaiting_verify',
      timeline: [
        { event: 'new', timestamp: 1713350400000, actor: 'system' },
        { event: 'awaiting_verify', timestamp: 1713350401000, actor: 'system' },
      ],
    })
    renderScreen()
    expect(screen.getByText('Report received')).toBeInTheDocument()
    expect(screen.getByText('Under review by MDRRMO')).toBeInTheDocument()
  })

  it('shows Awaiting resolution pending event for non-terminal status', () => {
    mockReport({ status: 'awaiting_verify', timeline: [] })
    renderScreen()
    expect(screen.getByText('Awaiting resolution')).toBeInTheDocument()
  })

  it('does not show Awaiting resolution for resolved status', () => {
    mockReport({ status: 'resolved', timeline: [] })
    renderScreen()
    expect(screen.queryByText('Awaiting resolution')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/citizen-pwa && pnpm vitest run --reporter=verbose src/components/TrackingScreen.test.tsx
```

Expected: FAIL — hero text assertions fail (StatusBanner still shows old text)

- [ ] **Step 3: Add warning-600 token to tailwind.config.cjs**

In `apps/citizen-pwa/tailwind.config.cjs`, change:

```js
warning: { 500: '#D97706', 400: '#F59E0B' },
```

to:

```js
warning: { 600: '#B45309', 500: '#D97706', 400: '#F59E0B' },
```

- [ ] **Step 4: Rewrite TrackingScreen.tsx**

```tsx
// apps/citizen-pwa/src/components/TrackingScreen.tsx
import { useParams, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Zap,
  RefreshCw,
  PhoneCall,
  ArrowLeft,
  Home,
} from 'lucide-react'
import { useReport } from '../hooks/useReport.js'
import { StatusBanner } from './ui/StatusBanner.js'
import { Button } from './ui/Button.js'
import { Timeline } from './ui/Timeline.js'
import { RadarRings } from './ui/RadarRings.js'

const RESPONDER_PHONE_NUMBER = '0547211216'

const TERMINAL_STATUSES = new Set([
  'resolved',
  'closed',
  'rejected',
  'cancelled',
  'cancelled_false_report',
  'merged_as_duplicate',
])

function heroConfig(status: string): {
  bg: string
  color: string
  text: string
  icon: React.ReactNode
} {
  switch (status) {
    case 'new':
    case 'awaiting_verify':
      return {
        bg: 'bg-brand-500',
        color: '#0F9488',
        text: "Your report is in the queue. We've got it.",
        icon: <Eye size={24} className="text-white" />,
      }
    case 'verified':
    case 'assigned':
    case 'acknowledged':
      return {
        bg: 'bg-warning-500',
        color: '#D97706',
        text: 'Responders have been notified.',
        icon: <Zap size={24} className="text-white" />,
      }
    case 'en_route':
    case 'on_scene':
      return {
        bg: 'bg-warning-600',
        color: '#B45309',
        text: 'Help is on the way.',
        icon: <Zap size={24} className="text-white" />,
      }
    case 'reopened':
      return {
        bg: 'bg-warning-500',
        color: '#D97706',
        text: 'Report re-opened. Responders will be re-assigned.',
        icon: <Zap size={24} className="text-white" />,
      }
    case 'resolved':
    case 'closed':
      return {
        bg: 'bg-success-500',
        color: '#059669',
        text: 'Situation resolved. Thank you.',
        icon: <CheckCircle size={24} className="text-white" />,
      }
    case 'cancelled_false_report':
      return {
        bg: 'bg-surface-600',
        color: '#4F5859',
        text: 'This report was closed after review.',
        icon: <XCircle size={24} className="text-white" />,
      }
    default:
      return {
        bg: 'bg-surface-600',
        color: '#4F5859',
        text: 'This report was not accepted for review.',
        icon: <XCircle size={24} className="text-white" />,
      }
  }
}

const TIMELINE_LABELS: Record<string, string> = {
  new: 'Report received',
  awaiting_verify: 'Under review by MDRRMO',
  verified: 'Verified — responders notified',
  assigned: 'Responder assigned',
  acknowledged: 'Responder acknowledged',
  en_route: 'Responder en route',
  on_scene: 'Responder on scene',
  resolved: 'Situation resolved',
  closed: 'Report closed',
  rejected: 'Report rejected',
  cancelled: 'Report cancelled',
  cancelled_false_report: 'Report cancelled',
  merged_as_duplicate: 'Merged as duplicate',
}

export function TrackingScreen() {
  const navigate = useNavigate()
  const { reference } = useParams<{ reference: string }>()
  const { data: report, isPending, error } = useReport(reference ?? '')

  const header = (
    <div className="sticky top-0 z-nav bg-surface-100/90 backdrop-blur-md border-b border-surface-200 px-4 py-3 flex items-center gap-3">
      <button
        type="button"
        onClick={() => void navigate(-1)}
        aria-label="Go back"
        className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-200 transition-colors"
      >
        <ArrowLeft size={24} className="text-surface-700" />
      </button>
      <h1 className="text-lg font-semibold text-surface-900 flex-1">Report Status</h1>
      <button
        type="button"
        onClick={() => void navigate('/')}
        aria-label="Go to home"
        className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-200 transition-colors"
      >
        <Home size={20} className="text-surface-700" />
      </button>
    </div>
  )

  if (!reference) {
    return (
      <div className="min-h-[100dvh] bg-surface-100 flex flex-col">
        {header}
        <div className="page-container">
          <StatusBanner variant="failed" icon={<AlertTriangle size={16} />}>
            Invalid tracking link
          </StatusBanner>
        </div>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="min-h-[100dvh] bg-surface-100 flex flex-col">
        {header}
        <div className="page-container flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-[100dvh] bg-surface-100 flex flex-col">
        {header}
        <div className="page-container">
          <StatusBanner variant="queued" icon={<RefreshCw size={16} className="animate-spin" />}>
            Your report is being processed — this page updates automatically.
          </StatusBanner>
        </div>
      </div>
    )
  }

  const hero = heroConfig(report.status)
  const isTerminal = TERMINAL_STATUSES.has(report.status)

  const timelineEvents = [
    ...report.timeline.map((e) => ({
      label: TIMELINE_LABELS[e.event] ?? e.event,
      meta: `${e.actor ?? 'system'} · ${new Date(e.timestamp).toLocaleString()}`,
      state: 'complete' as const,
    })),
    ...(!isTerminal ? [{ label: 'Awaiting resolution', meta: '', state: 'pending' as const }] : []),
  ]

  return (
    <div className="min-h-[100dvh] bg-surface-100 flex flex-col">
      {header}

      {/* Status hero banner */}
      <div
        className={`relative flex flex-col items-center justify-center py-8 px-4 text-center ${hero.bg}`}
      >
        <div className="relative flex items-center justify-center mb-3">
          {!isTerminal && <RadarRings color={hero.color} />}
          <div className="relative z-10 w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            {hero.icon}
          </div>
        </div>
        <p className="text-white font-bold text-lg leading-snug max-w-xs">{hero.text}</p>
      </div>

      <div className="page-container">
        <h2 className="tracking-header tracking-ref">{reference.toUpperCase()}</h2>
        <p className="tracking-meta">
          Reported {report.createdAt ? new Date(report.createdAt).toLocaleString() : 'Loading...'} ·{' '}
          {report.reportType}
        </p>

        <div className="card tracking-section">
          <h3 className="card-header">Location</h3>
          <div className="card-row">
            <span className="card-label">Address</span>
            <span className="card-value">{report.location?.address ?? 'N/A'}</span>
          </div>
          <div className="card-row">
            <span className="card-label">Coords</span>
            <span className="card-value">
              {report.location?.lat?.toFixed(5)}, {report.location?.lng?.toFixed(5)}
            </span>
          </div>
        </div>

        <div className="card tracking-section">
          <h3 className="card-header">Your contact</h3>
          <div className="card-row">
            <span className="card-label">Name</span>
            <span className="card-value">{report.reporterName}</span>
          </div>
          <div className="card-row">
            <span className="card-label">Phone</span>
            <span className="card-value">
              {report.reporterPhone && report.reporterPhone.length >= 4
                ? `****-***-${report.reporterPhone.slice(-4)}`
                : 'N/A'}
            </span>
          </div>
        </div>

        {report.resolutionNote ? (
          <div className="card tracking-section">
            <h3 className="card-header">Resolution</h3>
            <div className="card-label mb-1">{report.resolutionNote}</div>
            <div className="card-row">
              <span className="card-label">Closed by</span>
              <span className="card-value">{report.closedBy}</span>
            </div>
          </div>
        ) : null}

        {timelineEvents.length === 0 ? (
          <div className="tracking-empty">No updates yet</div>
        ) : (
          <Timeline events={timelineEvents} />
        )}

        <div className="tracking-actions">
          <Button variant="secondary" fullWidth>
            <RefreshCw size={14} style={{ marginRight: '4px' }} />
            Update report
          </Button>
          <a
            href={`tel:${RESPONDER_PHONE_NUMBER}`}
            className="btn btn--primary btn--full"
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PhoneCall size={14} style={{ marginRight: '4px' }} />
            Call responders
          </a>
        </div>

        {report.status === 'resolved' ? (
          <Button variant="secondary" fullWidth className="mt-2">
            Re-open if situation changed
          </Button>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/citizen-pwa && pnpm vitest run --reporter=verbose src/components/TrackingScreen.test.tsx
```

Expected: PASS — 7 tests

- [ ] **Step 6: Run full suite + typecheck**

```bash
cd apps/citizen-pwa && pnpm vitest run --reporter=verbose && pnpm typecheck
```

Expected: all tests pass, 0 type errors

- [ ] **Step 7: Commit**

```bash
git add apps/citizen-pwa/tailwind.config.cjs apps/citizen-pwa/src/components/TrackingScreen.tsx apps/citizen-pwa/src/components/TrackingScreen.test.tsx
git commit -m "feat(citizen-pwa): TrackingScreen — hero banner, radar animation, humanized timeline"
```

---

## Task 8: Create ReportStatusPill component

Persistent pill chip above the nav bar, shown when any active report exists.

**Files:**

- Create: `apps/citizen-pwa/src/components/ReportStatusPill.tsx`
- Create: `apps/citizen-pwa/src/components/ReportStatusPill.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// apps/citizen-pwa/src/components/ReportStatusPill.test.tsx
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockUseMyActiveReports = vi.fn()
vi.mock('../hooks/useMyActiveReports.js', () => ({
  useMyActiveReports: () => mockUseMyActiveReports(),
}))

vi.mock('../hooks/useReducedMotion.js', () => ({
  useReducedMotion: () => false,
}))

vi.mock('framer-motion', () => ({
  motion: {
    button: ({
      children,
      onClick,
      className,
      style,
      'aria-label': ariaLabel,
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      'aria-label'?: string
      initial?: unknown
      animate?: unknown
      transition?: unknown
    }) => (
      <button onClick={onClick} className={className} style={style} aria-label={ariaLabel}>
        {children}
      </button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { ReportStatusPill } from './ReportStatusPill'

function renderPill() {
  return render(
    <MemoryRouter>
      <ReportStatusPill />
    </MemoryRouter>,
  )
}

beforeEach(() => mockNavigate.mockReset())

const baseReport = {
  publicRef: 'a1b2c3d4',
  reportType: 'flood',
  severity: 'high',
  lat: 14.11,
  lng: 122.95,
  submittedAt: 1713350400000,
  status: 'awaiting_verify',
  municipalityLabel: 'Daet',
}

describe('ReportStatusPill', () => {
  it('renders pill when there is an active report', () => {
    mockUseMyActiveReports.mockReturnValue({ reports: [baseReport], loading: false })
    renderPill()
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText('Flood')).toBeInTheDocument()
    expect(screen.getByText('Daet', { exact: false })).toBeInTheDocument()
  })

  it('renders nothing when all reports are terminal', () => {
    mockUseMyActiveReports.mockReturnValue({
      reports: [{ ...baseReport, status: 'resolved' }],
      loading: false,
    })
    renderPill()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('treats queued as non-terminal', () => {
    mockUseMyActiveReports.mockReturnValue({
      reports: [{ ...baseReport, status: 'queued' }],
      loading: false,
    })
    renderPill()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('treats reopened as non-terminal', () => {
    mockUseMyActiveReports.mockReturnValue({
      reports: [{ ...baseReport, status: 'reopened' }],
      loading: false,
    })
    renderPill()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows +N badge when multiple active reports', () => {
    mockUseMyActiveReports.mockReturnValue({
      reports: [
        { ...baseReport, submittedAt: 1713350400000 },
        { ...baseReport, publicRef: 'b2c3d4e5', submittedAt: 1713350500000 },
        { ...baseReport, publicRef: 'c3d4e5f6', submittedAt: 1713350300000 },
      ],
      loading: false,
    })
    renderPill()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('navigates to TrackingScreen on tap', () => {
    mockUseMyActiveReports.mockReturnValue({ reports: [baseReport], loading: false })
    renderPill()
    fireEvent.click(screen.getByRole('button'))
    expect(mockNavigate).toHaveBeenCalledWith('/reports/a1b2c3d4')
  })

  it('renders nothing when reports list is empty', () => {
    mockUseMyActiveReports.mockReturnValue({ reports: [], loading: false })
    renderPill()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/citizen-pwa && pnpm vitest run --reporter=verbose src/components/ReportStatusPill.test.tsx
```

Expected: FAIL — `Cannot find module './ReportStatusPill'`

- [ ] **Step 3: Create ReportStatusPill.tsx**

```tsx
// apps/citizen-pwa/src/components/ReportStatusPill.tsx
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types'
import { useMyActiveReports } from '../hooks/useMyActiveReports.js'
import { incidentLabel, statusMeta, severityDotColor } from '../utils/incident-meta.js'
import { useReducedMotion } from '../hooks/useReducedMotion.js'

const NON_TERMINAL: ReadonlySet<string> = new Set([...ACTIVE_REPORT_STATUSES, 'reopened'])

function isNonTerminal(status: string): boolean {
  return status === 'queued' || NON_TERMINAL.has(status)
}

export function ReportStatusPill() {
  const navigate = useNavigate()
  const { reports } = useMyActiveReports()
  const prefersReducedMotion = useReducedMotion()

  const activeReports = reports.filter((r) => isNonTerminal(r.status))

  return (
    <AnimatePresence>
      {activeReports.length > 0 &&
        (() => {
          const sorted = [...activeReports].sort((a, b) => b.submittedAt - a.submittedAt)
          const primary = sorted[0]
          const extraCount = sorted.length - 1
          const meta = statusMeta(primary.status)

          return (
            <motion.button
              key="report-status-pill"
              type="button"
              initial={prefersReducedMotion ? false : { y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
              }
              onClick={() => {
                void navigate(`/reports/${primary.publicRef}`)
              }}
              className="fixed left-1/2 -translate-x-1/2 z-toast flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface-900/90 backdrop-blur-sm shadow-lg active:scale-95 transition-transform"
              style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
              aria-label={`View your active report: ${incidentLabel(primary.reportType)}`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: severityDotColor(primary.severity) }}
              />
              <span className="text-white text-sm font-medium">
                {incidentLabel(primary.reportType)}
                {primary.municipalityLabel ? ` · ${primary.municipalityLabel}` : ''}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}
              >
                {meta.label}
              </span>
              {extraCount > 0 && (
                <span className="text-xs font-bold text-surface-300">+{String(extraCount)}</span>
              )}
              <ChevronRight size={14} className="text-surface-300 flex-shrink-0" />
            </motion.button>
          )
        })()}
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/citizen-pwa && pnpm vitest run --reporter=verbose src/components/ReportStatusPill.test.tsx
```

Expected: PASS — 7 tests

- [ ] **Step 5: Typecheck**

```bash
cd apps/citizen-pwa && pnpm typecheck
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add apps/citizen-pwa/src/components/ReportStatusPill.tsx apps/citizen-pwa/src/components/ReportStatusPill.test.tsx
git commit -m "feat(citizen-pwa): add ReportStatusPill — persistent active-report chip"
```

---

## Task 9: Mount ReportStatusPill in CitizenShell

**Files:**

- Modify: `apps/citizen-pwa/src/components/CitizenShell.tsx`
- Modify: `apps/citizen-pwa/src/components/CitizenShell.test.tsx`

- [ ] **Step 1: Write failing test**

Add to `CitizenShell.test.tsx`:

```typescript
// Add at the top of the file, with the other vi.mock calls:
const mockUseMyActiveReports = vi.fn()
vi.mock('../hooks/useMyActiveReports.js', () => ({
  useMyActiveReports: () => mockUseMyActiveReports(),
}))
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

// In renderShell(), add this before the router setup:
mockUseMyActiveReports.mockReturnValue({ reports: [], loading: false })
```

Add these two tests to the `describe('CitizenShell', () => {` block:

```typescript
it('renders the report status pill when there is an active report', () => {
  mockUseMyActiveReports.mockReturnValue({
    reports: [
      {
        publicRef: 'a1b2c3d4',
        reportType: 'flood',
        severity: 'high',
        lat: 14.11,
        lng: 122.95,
        submittedAt: 1713350400000,
        status: 'awaiting_verify',
        municipalityLabel: 'Daet',
      },
    ],
    loading: false,
  })
  renderShell('/')
  expect(screen.getByRole('button', { name: /view your active report/i })).toBeInTheDocument()
})

it('does not render the status pill when no active reports', () => {
  mockUseMyActiveReports.mockReturnValue({ reports: [], loading: false })
  renderShell('/')
  expect(screen.queryByRole('button', { name: /view your active report/i })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/citizen-pwa && pnpm vitest run --reporter=verbose src/components/CitizenShell.test.tsx
```

Expected: FAIL — `useMyActiveReports` not mocked in module scope causes error OR pill not found

- [ ] **Step 3: Update CitizenShell.tsx**

Import `ReportStatusPill` and add it between `<main>` and `<nav>`:

At the top of `CitizenShell.tsx`, add the import:

```typescript
import { ReportStatusPill } from './ReportStatusPill.js'
```

In the JSX, between the closing `</main>` and the opening `<nav`:

```tsx
<ReportStatusPill />
```

The exact insertion point — after line 117 (`</main>`) and before line 120 (`<nav`).

- [ ] **Step 4: Update CitizenShell.test.tsx — add mock for useMyActiveReports**

The full updated test file (apply the changes from Step 1 to the existing test):

```tsx
/* eslint-disable @typescript-eslint/no-unsafe-return */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { CitizenShell } from './CitizenShell.js'

const mockUseOfflineQueueCount = vi.fn()
const mockUseUIStore = vi.fn()
const mockUseMyActiveReports = vi.fn()

vi.mock('../hooks/useOfflineQueueCount.js', () => ({
  useOfflineQueueCount: () => mockUseOfflineQueueCount(),
}))

vi.mock('../lib/store.js', () => ({
  useUIStore: (
    selector: (s: {
      navDirection: 'forward'
      setNavDirection: (_d: 'forward' | 'backward') => void
    }) => unknown,
  ) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    selector(mockUseUIStore()),
}))

vi.mock('../hooks/useMyActiveReports.js', () => ({
  useMyActiveReports: () => mockUseMyActiveReports(),
}))

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      ...(actual as { motion: unknown }).motion,
      button: ({
        children,
        onClick,
        className,
        style,
        'aria-label': ariaLabel,
      }: React.ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label'?: string }) => (
        <button onClick={onClick} className={className} style={style} aria-label={ariaLabel}>
          {children}
        </button>
      ),
    },
  }
})

function renderShell(pathname = '/', opts?: { offline?: boolean; queueCount?: number }) {
  mockUseOfflineQueueCount.mockReturnValue({
    isOnline: opts?.offline ? false : true,
    queueCount: opts?.queueCount ?? 0,
  })
  mockUseUIStore.mockReturnValue({
    navDirection: 'forward' as const,
    setNavDirection: vi.fn(),
  })
  mockUseMyActiveReports.mockReturnValue({ reports: [], loading: false })

  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <CitizenShell>
            <Outlet />
          </CitizenShell>
        ),
        children: [
          { index: true, element: <div>Map content</div> },
          { path: 'report', element: <div>Report content</div> },
          { path: 'feed', element: <div>Feed content</div> },
        ],
      },
    ],
    { initialEntries: [pathname] },
  )

  return render(<RouterProvider router={router} />)
}

describe('CitizenShell', () => {
  it('renders the fixed chrome and active tab', () => {
    renderShell('/')
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /map/i })).toHaveAttribute('aria-current', 'page')
  })

  it('navigates to report and feed tabs', async () => {
    renderShell('/')
    fireEvent.click(screen.getByRole('button', { name: /report/i }))
    await waitFor(() => {
      expect(screen.getByText('Report content')).toBeInTheDocument()
    })
    expect(screen.getByText('Report content')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /feed/i }))
    await waitFor(() => {
      expect(screen.getByText('Feed content')).toBeInTheDocument()
    })
  })

  it('shows offline banner when navigatorOnline is false', () => {
    renderShell('/', { offline: true, queueCount: 3 })
    expect(screen.getByText('Offline — 3 reports queued')).toBeInTheDocument()
  })

  it('hides offline banner when online', () => {
    renderShell('/')
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()
  })

  it('renders the report status pill when there is an active report', () => {
    mockUseMyActiveReports.mockReturnValue({
      reports: [
        {
          publicRef: 'a1b2c3d4',
          reportType: 'flood',
          severity: 'high',
          lat: 14.11,
          lng: 122.95,
          submittedAt: 1713350400000,
          status: 'awaiting_verify',
          municipalityLabel: 'Daet',
        },
      ],
      loading: false,
    })
    renderShell('/')
    expect(screen.getByRole('button', { name: /view your active report/i })).toBeInTheDocument()
  })

  it('does not render the status pill when no active reports', () => {
    mockUseMyActiveReports.mockReturnValue({ reports: [], loading: false })
    renderShell('/')
    expect(
      screen.queryByRole('button', { name: /view your active report/i }),
    ).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/citizen-pwa && pnpm vitest run --reporter=verbose src/components/CitizenShell.test.tsx
```

Expected: PASS — 6 tests

- [ ] **Step 6: Run full suite**

```bash
cd apps/citizen-pwa && pnpm vitest run --reporter=verbose && pnpm lint && pnpm typecheck
```

Expected: all tests pass, 0 lint errors, 0 type errors

Also run functions suite to confirm no regressions:

```bash
cd functions && pnpm vitest run --reporter=verbose && pnpm lint && pnpm typecheck
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add apps/citizen-pwa/src/components/CitizenShell.tsx apps/citizen-pwa/src/components/CitizenShell.test.tsx
git commit -m "feat(citizen-pwa): mount ReportStatusPill in CitizenShell"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement                                    | Covered by |
| --------------------------------------------------- | ---------- |
| Secret-only requestLookup path                      | Task 3     |
| `publicRef` echoed in callable response             | Task 3     |
| `secret_lookup` write for web submissions           | Task 4     |
| Firestore `secret_lookup` security rule             | Task 5     |
| LookupScreen — single secret field                  | Task 6     |
| LookupScreen — teal header                          | Task 6     |
| LookupScreen — navigate to /reports/:publicRef      | Task 6     |
| LookupScreen — updated not-found error copy         | Task 6     |
| TrackingScreen — status-aware hero                  | Task 7     |
| TrackingScreen — RadarRings persistent              | Task 7     |
| TrackingScreen — hidden RadarRings when terminal    | Task 7     |
| TrackingScreen — humanized timeline labels          | Task 7     |
| TrackingScreen — pending "Awaiting resolution"      | Task 7     |
| RadarRings shared component                         | Task 1     |
| ReceiptScreen — RadarRings extraction               | Task 2     |
| ReceiptScreen — secret code box styling             | Task 2     |
| ReceiptScreen — copy button                         | Task 2     |
| ReceiptScreen — navigate directly to TrackingScreen | Task 2     |
| ReportStatusPill — visibility predicate             | Task 8     |
| ReportStatusPill — `queued` non-terminal            | Task 8     |
| ReportStatusPill — `reopened` non-terminal          | Task 8     |
| ReportStatusPill — +N badge                         | Task 8     |
| ReportStatusPill — iOS notch-safe positioning       | Task 8     |
| CitizenShell — mounts pill                          | Task 9     |

**Placeholder scan:** No TBDs, no incomplete code blocks.

**Type consistency:** `RequestLookupResult.publicRef: string` used in Task 3 is echoed back in both code paths, consumed in Task 6 (`result.publicRef`). `RadarRings` props (`color: string`, `autoHideMs?: number`, `animate?: boolean`) consistent across Task 1 (definition), Task 2 (ReceiptScreen usage), and Task 7 (TrackingScreen usage).
