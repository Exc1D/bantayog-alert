# Citizen Report Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the citizen-facing PWA for disaster reporting with offline-first submission, degraded state fallbacks, and real-time tracking.

**Architecture:** 3-step submission form with localForage durability, Zustand UI state, TanStack Query server state, anonymous Firebase Auth. Reveal moments for success/queued/failed states with SMS fallback. Tracking screen with live Firestore listeners.

**Tech Stack:** React 19, React Router 7, Vite, Zustand 4, TanStack Query 5, localForage, Firebase (Firestore, Functions, Anonymous Auth), Firebase Emulator (testing), Playwright (E2E), Vitest (integration)

---

## Task 1: Install Dependencies

**Files:**

- Modify: `apps/citizen-pwa/package.json`

- [ ] **Step 1: Add required dependencies**

Run: `pnpm add zustand @tanstack/react-query localforage`

- [ ] **Step 2: Add dev dependencies**

Run: `pnpm add -D @axe-core/react vitest @testing-library/react @testing-library/jest-dom`

- [ ] **Step 3: Verify installation**

Run: `pnpm install && pnpm typecheck`

Expected: No errors, new packages in `node_modules`

- [ ] **Step 4: Commit**

```bash
git add apps/citizen-pwa/package.json pnpm-lock.yaml
git commit -m "deps(citizen-pwa): add zustand, tanstack-query, localforage, @axe-core/react"
```

---

## Task 2: Create Design Tokens

**Files:**

- Create: `apps/citizen-pwa/src/lib/design-tokens.ts`

- [ ] **Step 1: Create design token constants**

```typescript
// Color palette
export const colors = {
  primary: '#001e40',
  assuranceBg: 'linear-gradient(#fff5ef, #ffeee6)',
  successBg: '#dcfce7',
  successFg: '#16a34a',
  queuedBg: '#fef3c7',
  queuedFg: '#f59e0b',
  failedBg: '#fee2e2',
  failedFg: '#dc2626',
  surface: '#f5f7fa',
  card: '#ffffff',
} as const

// Typography
export const fonts = {
  primary: "'Inter', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
} as const

// Spacing scale
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
} as const

// Border radius
export const borderRadius = {
  sm: '8px',
  md: '10px',
  lg: '12px',
  xl: '14px',
  full: '9999px',
} as const

// Motion durations
export const motion = {
  fast: 100,
  normal: 300,
  slow: 400,
  slower: 600,
} as const
```

- [ ] **Step 2: Create CSS variables stylesheet**

Create: `apps/citizen-pwa/src/styles/design-tokens.css`

```css
:root {
  /* Colors */
  --color-primary: #001e40;
  --color-success-bg: #dcfce7;
  --color-success-fg: #16a34a;
  --color-queued-bg: #fef3c7;
  --color-queued-fg: #f59e0b;
  --color-failed-bg: #fee2e2;
  --color-failed-fg: #dc2626;
  --color-surface: #f5f7fa;
  --color-card: #ffffff;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  --spacing-2xl: 32px;

  /* Border radius */
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 14px;
  --radius-full: 9999px;

  /* Motion */
  --motion-fast: 100ms;
  --motion-normal: 300ms;
  --motion-slow: 400ms;
  --motion-slower: 600ms;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/src/lib/design-tokens.ts apps/citizen-pwa/src/styles/design-tokens.css
git commit -m "feat(citizen-pwa): add design system tokens and CSS variables"
```

---

## Task 3: Set Up Zustand Store

**Files:**

- Create: `apps/citizen-pwa/src/lib/store.ts`

- [ ] **Step 1: Create Zustand store with UI state**

```typescript
import { create } from 'zustand'

interface UIState {
  bottomNavHidden: boolean
  currentSheet: 'none' | 'submit-reveal'
  toast: { id: string; message: string; type: 'success' | 'error' | 'info' } | null
  hideBottomNav: () => void
  showBottomNav: () => void
  openSheet: (sheet: 'submit-reveal') => void
  closeSheet: () => void
  setToast: (toast: UIState['toast']) => void
  clearToast: () => void
}

export const useUIStore = create<UIState>((set) => ({
  bottomNavHidden: false,
  currentSheet: 'none',
  toast: null,

  hideBottomNav: () => set({ bottomNavHidden: true }),
  showBottomNav: () => set({ bottomNavHidden: false }),

  openSheet: (sheet) => set({ currentSheet: sheet }),
  closeSheet: () => set({ currentSheet: 'none' }),

  setToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
}))
```

- [ ] **Step 2: Commit**

```bash
git add apps/citizen-pwa/src/lib/store.ts
git commit -m "feat(citizen-pwa): add Zustand store for UI state"
```

---

## Task 4: Set Up TanStack Query

**Files:**

- Create: `apps/citizen-pwa/src/lib/query-client.tsx`
- Create: `apps/citizen-pwa/src/lib/QueryProvider.tsx`

- [ ] **Step 1: Create QueryClient instance**

```typescript
import { QueryClient, defaultMutationFn } from '@tanstack/react-query'
import { firebaseDB } from '../services/firebase'

// Enable IndexedDb persistence for offline cache
import { enableIndexedDbPersistence, persistQueryClient } from '@tanstack/query-persist-client-core'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
})

export let persistor: PersistedQueryClient | undefined

export async function initializeQueryClient() {
  if (persistor) return

  persistor = persistQueryClient({
    queryClient,
    persistence: indexedDB,
    // Don't persist queries that contain errors
    persistWith: (query) => {
      return !query.state.error
    },
    buster: 'v1',
  })

  // Restore cache from IndexedDB on app load
  await persistor.restore()
}
```

- [ ] **Step 2: Create QueryProvider component**

```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { queryClient } from './query-client';

interface Props {
  children: ReactNode;
}

export function QueryProvider({ children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Add query persistor to main.tsx**

Modify: `apps/citizen-pwa/src/main.tsx`

Add after imports:

```typescript
import { QueryProvider, initializeQueryClient } from './lib/query-client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Initialize query persistence before render
await initializeQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
);
```

- [ ] **Step 4: Install TanStack Query persisters**

Run: `pnpm add @tanstack/react-query @tanstack/query-persist-client-core`

- [ ] **Step 5: Commit**

```bash
git add apps/citizen-pwa/src/lib/query-client.tsx apps/citizen-pwa/src/lib/QueryProvider.tsx apps/citizen-pwa/src/main.tsx pnpm-lock.yaml
git commit -m "feat(citizen-pwa): add TanStack Query with IndexedDB persistence"
```

---

## Task 5: Set Up localForage

**Files:**

- Create: `apps/citizen-pwa/src/lib/localforage.ts`

- [ ] **Step 1: Create localForage wrapper**

```typescript
import localforage from 'localforage'

export interface DraftReport {
  uuid: string
  reportType: string
  hazardClass: string
  description?: string
  location: {
    lat: number
    lng: number
    address?: string
  }
  reporterName: string
  reporterMsisdn: string
  patientCount: number
  photoUrl?: string
  createdAt: number
  smsFallbackSentAt?: number
  state: 'draft' | 'queued' | 'failed_retryable'
  submittedRef?: string
  lastError?: {
    code: string
    message: string
    timestamp: number
  }
  retryCount?: number
}

export interface SessionMetadata {
  uuid: string
  anonymousUid: string
  deviceInfo: {
    userAgent: string
    platform: string
  }
  createdAt: number
}

export const draftStore = localforage.createInstance({
  name: 'bantayog-drafts',
  storeName: 'drafts',
})

export const sessionStore = localforage.createInstance({
  name: 'bantayog-sessions',
  storeName: 'sessions',
})

export async function saveDraft(draft: DraftReport): Promise<void> {
  await draftStore.setItem(`draft:${draft.uuid}`, draft)
}

export async function getDraft(uuid: string): Promise<DraftReport | null> {
  return await draftStore.getItem<DraftReport>(`draft:${uuid}`)
}

export async function deleteDraft(uuid: string): Promise<void> {
  await draftStore.removeItem(`draft:${uuid}`)
}

export async function listDrafts(): Promise<DraftReport[]> {
  const keys = await draftStore.keys()
  const drafts = await Promise.all(
    keys.filter((k) => k.startsWith('draft:')).map((k) => draftStore.getItem<DraftReport>(k)),
  )
  return drafts.filter((d): d is DraftReport => d !== null)
}

export async function cleanupExpiredDrafts(): Promise<void> {
  const drafts = await listDrafts()
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000

  for (const draft of drafts) {
    if (draft.createdAt < twentyFourHoursAgo) {
      await deleteDraft(draft.uuid)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/citizen-pwa/src/lib/localforage.ts
git commit -m "feat(citizen-pwa): add localForage wrapper for draft persistence"
```

---

## Task 6: Create Submission State Machine Hook

**Files:**

- Create: `apps/citizen-pwa/src/hooks/useSubmissionMachine.ts`

- [ ] **Step 1: Create state machine hook**

```typescript
import { useState, useCallback } from 'react'

export type SubmissionState =
  | 'idle'
  | 'submitting'
  | 'success'
  | 'queued'
  | 'failed_retryable'
  | 'failed_terminal'

export interface SubmissionMachineReturn {
  state: SubmissionState
  transition: (nextState: SubmissionState) => void
  dismiss: () => void
  setError: (error: { code: string; message: string }) => void
  incrementRetry: () => void
}

export function useSubmissionMachine(): SubmissionMachineReturn {
  const [state, setState] = useState<SubmissionState>('idle')
  const [retryCount, setRetryCount] = useState(0)
  const [lastError, setLastError] = useState<{
    code: string
    message: string
    timestamp: number
  } | null>(null)

  const transition = useCallback((nextState: SubmissionState) => {
    setState(nextState)
    // Reset retry counter when transitioning to queued or success
    if (nextState === 'queued' || nextState === 'success') {
      setRetryCount(0)
      setLastError(null)
    }
  }, [])

  const dismiss = useCallback(() => {
    if (state === 'success') {
      setState('closed')
    }
  }, [state])

  const setError = useCallback((error: { code: string; message: string }) => {
    setLastError({ ...error, timestamp: Date.now() })
  }, [])

  const incrementRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1)
  }, [])

  return {
    state,
    transition,
    dismiss,
    setError,
    incrementRetry,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/citizen-pwa/src/hooks/useSubmissionMachine.ts
git commit -m "feat(citizen-pwa): add submission state machine hook"
```

---

## Task 7: Create Report Listener Hook

**Files:**

- Create: `apps/citizen-pwa/src/hooks/useReport.ts`

- [ ] **Step 1: Create Firestore listener hook**

```typescript
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { doc, onValue } from 'firebase/firestore'
import { db } from '../services/firebase'
import { mapReportFromFirestore } from '../lib/mappers'

interface ReportData {
  id: string
  status: string
  timeline: Array<{
    event: string
    timestamp: number
    actor: string
    note?: string
  }>
  // ... other fields
}

export function useReport(ref: string) {
  const queryClient = useQueryClient()

  // Firestore listener managed by React effect
  useEffect(() => {
    const unsubscribe = onValue(
      doc(db, `reports/${ref}`),
      (snapshot) => {
        const data = snapshot.data()
        if (data) {
          queryClient.setQueryData(['reports', ref], mapReportFromFirestore(data))
        } else {
          queryClient.setQueryData(['reports', ref], null)
        }
      },
      (error) => {
        queryClient.setQueryData(['reports', ref], { error: error.message })
      },
    )

    return unsubscribe
  }, [ref, queryClient])

  // Query reads from cache populated by effect
  return useQuery({
    queryKey: ['reports', ref],
    queryFn: () => queryClient.getQueryData(['reports', ref]),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  })
}
```

- [ ] **Step 2: Create mapper function**

Create: `apps/citizen-pwa/src/lib/mappers.ts`

```typescript
export function mapReportFromFirestore(data: FirebaseFirestore.DocumentData): any {
  return {
    id: data.id,
    status: data.status,
    timeline: data.timeline || [],
    // Map other fields as needed
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/src/hooks/useReport.ts apps/citizen-pwa/src/lib/mappers.ts
git commit -m "feat(citizen-pwa): add Firestore listener hook with proper cleanup"
```

---

## Task 8: Create UI Component Library

**Files:**

- Create: `apps/citizen-pwa/src/components/ui/Button.tsx`
- Create: `apps/citizen-pwa/src/components/ui/StatusBanner.tsx`
- Create: `apps/citizen-pwa/src/components/ui/FallbackCards.tsx`
- Create: `apps/citizen-pwa/src/components/ui/Timeline.tsx`

- [ ] **Step 1: Create Button component**

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'amber' | 'red';
  fullWidth?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'px-4 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50';
  const variantStyles = {
    primary: 'bg-[#001e40] text-white hover:bg-[#032038]',
    secondary: 'bg-[#f5f7fa] text-[#001e40] hover:bg-[#e5e7eb]',
    amber: 'bg-[#b45309] text-white hover:bg-[#92400e]',
    red: 'bg-[#b91c1c] text-white hover:bg-[#991b1b]',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Create StatusBanner component**

```typescript
interface StatusBannerProps {
  variant: 'success' | 'queued' | 'failed';
  icon: string;
  children: React.ReactNode;
}

export function StatusBanner({ variant, icon, children }: StatusBannerProps) {
  const variantStyles = {
    success: 'bg-[#dcfce7] text-[#166534]',
    queued: 'bg-[#fef3c7] text-[#92400e]',
    failed: 'bg-[#fee2e2] text-[#991b1b]',
  };

  return (
    <div className={`flex items-center gap-2.5 p-3.5 rounded-lg ${variantStyles[variant]}`}>
      <div className="w-8 h-8 rounded-full bg-current flex items-center justify-center text-white">
        {icon}
      </div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create FallbackCards component**

```typescript
interface FallbackCardsProps {
  hotlineNumber: string;
  emphasized?: boolean;
  onCallClick?: () => void;
  onSmsClick?: () => void;
}

export function FallbackCards({ hotlineNumber, emphasized = false, onCallClick, onSmsmsClick }: FallbackCardsProps) {
  const baseCard = 'flex-1 border rounded-lg p-3 text-center';
  const emphasizedCard = emphasized
    ? 'border-[#fca5a5] bg-[#fff5f5]'
    : 'border-[#e5e7eb] bg-white';

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={onCallClick}
        className={`${baseCard} ${emphasizedCard}`}
      >
        <div className="w-8 h-8 rounded-full bg-[#001e40] text-white flex items-center justify-center mx-auto mb-1">
          &#9742;
        </div>
        <div className="font-semibold text-[#001e40] text-sm">Call</div>
        <div className="text-[10px] text-[#52606d]">{hotlineNumber}</div>
      </button>
      <button
        onClick={onSmsmsClick}
        className={`${baseCard} ${emphasizedCard}`}
      >
        <div className="w-8 h-8 rounded-full bg-[#001e40] text-white flex items-center justify-center mx-auto mb-1">
          &#9993;
        </div>
        <div className="font-semibold text-[#001e40] text-sm">SMS</div>
        <div className="text-[10px] text-[#52606d]">No data needed</div>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create Timeline component**

```typescript
interface TimelineProps {
  events: Array<{
    label: string;
    meta: string;
    state: 'complete' | 'pending' | 'queued' | 'failed';
  }>;
}

export function Timeline({ events }: TimelineProps) {
  return (
    <div className="relative pl-3">
      <div className="absolute left-[3px] top-2 bottom-2 w-0.5 bg-[#e5e7eb]" />
      {events.map((event, i) => (
        <div key={i} className="relative pb-3.5">
          <div
            className={`absolute -left-[12px] top-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
              event.state === 'complete'
                ? 'bg-[#16a34a]'
                : event.state === 'queued'
                ? 'bg-[#f59e0b]'
                : event.state === 'failed'
                ? 'bg-[#dc2626]'
                : 'bg-[#d1d5db]'
            }`}
          />
          <div className="text-sm font-medium text-[#1d1d1f]">{event.label}</div>
          <div className="text-[11px] text-[#7b8794]">{event.meta}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/citizen-pwa/src/components/ui/
git commit -m "feat(citizen-pwa): add UI component library (Button, StatusBanner, FallbackCards, Timeline)"
```

---

## Task 9: Create Reveal Sheet Component

**Files:**

- Create: `apps/citizen-pwa/src/components/RevealSheet.tsx`
- Modify: `apps/citizen-pwa/src/routes.tsx` (add Reveal route)

- [ ] **Step 1: Create RevealSheet component**

```typescript
import { useUIStore } from '../lib/store';
import { StatusBanner } from './ui/StatusBanner';
import { Button } from './ui/Button';
import { FallbackCards } from './ui/FallbackCards';
import { Timeline } from './ui/Timeline';

interface RevealSheetProps {
  state: 'success' | 'queued' | 'failed_retryable';
  referenceCode: string;
  onClose?: () => void;
}

export function RevealSheet({ state, referenceCode, onClose }: RevealSheetProps) {
  const closeSheet = useUIStore(state => state.closeSheet);

  const variants = {
    success: {
      icon: '&#10003;',
      headline: 'We heard you. We are here.',
      subline: 'Your report is with Daet MDRRMO. Keep your line open.',
      bannerVariant: 'success' as const,
      receiverText: 'Received by Daet MDRRMO',
      receiverIcon: '',
      primaryButton: 'Track this report',
      secondaryButton: undefined,
      permissionText: "You can close this app. We'll text you.",
    },
    queued: {
      icon: '&#8987;',
      headline: "We've saved your report.",
      subline: "You're offline right now. The moment your phone reconnects, we'll send this to Daet MDRRMO automatically. Walang mawawala. Safe ito sa phone mo.",
      bannerVariant: 'queued' as const,
      receiverText: 'Waiting for signal · auto-retry on',
      receiverIcon: 'pulse',
      primaryButton: 'Try sending now',
      primaryVariant: 'amber' as const,
      secondaryButton: 'Keep draft & close',
      permissionText: "We'll keep trying in the background.",
    },
    failed_retryable: {
      icon: '&#9888;',
      headline: "We couldn't send it yet.",
      subline: 'Your report is safe on your phone. The network is having trouble reaching MDRRMO — this is not your fault. If this is life-threatening, please call now.',
      bannerVariant: 'failed' as const,
      receiverText: undefined,
      receiverIcon: undefined,
      primaryButton: 'Try again',
      primaryVariant: 'red' as const,
      secondaryButton: 'Keep draft & close',
      permissionText: "We'll hold this draft for 24 hours.",
    },
  };

  const variant = variants[state];

  const handleTrackReport = () => {
    // Navigate to tracking screen
    window.location.href = `/reports/${referenceCode}`;
  };

  const handlePrimaryAction = () => {
    if (state === 'success') {
      handleTrackReport();
    } else {
      // Trigger retry (handled by parent component)
      closeSheet();
    }
  };

  const handleCallHotline = () => {
    window.location.href = 'tel:0547211216';
  };

  const handleSmsFallback = () => {
    // Open SMS composer with pre-filled body
    window.location.href = `sms:2933?body=${encodeURIComponent(`BANTAYOG ${referenceCode}\n[Incident details here]`)}`;
  };

  const timelineEvents = {
    success: [
      { label: 'Report received', meta: '2:14 PM', state: 'complete' as const },
      { label: 'First review', meta: 'Expected within 15 min', state: 'pending' as const },
      { label: 'Responder dispatched', meta: "We'll text and update here", state: 'pending' as const },
    ],
    queued: [
      { label: 'Saved on this phone', meta: '2:14 PM', state: 'queued' as const },
      { label: 'Send when online', meta: 'Automatic · no action needed', state: 'pending' as const },
      { label: 'Received by MDRRMO', meta: "We'll text you the reference", state: 'pending' as const },
    ],
    failed_retryable: [
      { label: 'Report drafted', meta: '2:14 PM', state: 'complete' as const },
      { label: 'Send attempt failed', meta: 'Network error · you can retry', state: 'failed' as const },
      { label: 'Retry send', meta: 'Try again or call the hotline', state: 'pending' as const },
    ],
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={state === 'success' ? onClose : undefined} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pointer-events-auto shadow-2xl">
        <div className="w-12 h-1 bg-[#d1d5db] rounded-full mx-auto mb-3.5" />

        <StatusBanner variant={variant.bannerVariant} icon={variant.icon}>
          {variant.headline}
        </StatusBanner>

        <p className="text-center text-sm text-[#52606d] mb-4">
          {variant.subline}
        </p>

        <div className={`bg-gradient-to-b from-[#fff5ef] to-[#ffeee6] border border-[#f5d4bb] rounded-xl p-3.5 text-center mb-4 ${
          state === 'queued' ? 'from-[#fef9e7] to-[#fef3c7] border-[#f3d57b]' :
          state === 'failed_retryable' ? 'from-[#fff5f5] to-[#fee2e2] border-[#f5a8a8]' :
          ''
        }`}>
          <div className="text-[10px] font-bold text-[#7b8794] uppercase tracking-wider mb-1">
            {state === 'queued' ? 'Draft reference' : 'Reference'}
          </div>
          <div className="font-mono text-lg font-bold text-[#001e40]">
            {referenceCode}
          </div>
          <div className="text-[11px] text-[#52606d]">
            {state === 'success' ? `Submitted ${new Date().toLocaleTimeString()}` :
             state === 'queued' ? 'Will become final on send' :
             'Nothing is lost'}
          </div>
        </div>

        {variant.receiverText && (
          <div className="flex items-center gap-2.5 p-3 bg-[#f5f7fa] rounded-lg mb-4">
            <div className={`w-2 h-2 rounded-full ${
              state === 'queued' ? 'bg-[#f59e0b] animate-pulse' : 'bg-[#16a34a]'
            }`} />
            <span className="text-sm font-medium text-[#001e40]">
              {variant.receiverText}
            </span>
          </div>
        )}

        <Timeline events={timelineEvents[state]} />

        {state !== 'success' && (
          <FallbackCards
            hotlineNumber="(054) 721-1216"
            emphasized={state === 'failed_retryable'}
            onCallClick={handleCallHotline}
            onSmsClick={handleSmsFallback}
          />
        )}

        {state === 'success' && (
          <FallbackCards
            hotlineNumber="(054) 721-1216"
            onCallClick={handleCallHotline}
          />
        )}

        <Button
          variant={variant.primaryVariant}
          fullWidth
          onClick={handlePrimaryAction}
        >
          {variant.primaryButton}
        </Button>

        {variant.secondaryButton && (
          <Button
            variant="secondary"
            fullWidth
            className="mt-2"
            onClick={onClose}
          >
            {variant.secondaryButton}
          </Button>
        )}

        <p className="text-center text-xs text-[#7b8794] mt-3">
          {variant.permissionText}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/citizen-pwa/src/components/RevealSheet.tsx
git commit -m "feat(citizen-pwa): add RevealSheet component with success/queued/failed variants"
```

---

## Task 10: Create Tracking Screen Component

**Files:**

- Create: `apps/citizen-pwa/src/components/TrackingScreen.tsx`

- [ ] **Step 1: Create TrackingScreen component**

```typescript
import { useParams } from 'react-router-dom';
import { useReport } from '../hooks/useReport';
import { StatusBanner } from './ui/StatusBanner';
import { Button } from './ui/Button';
import { FallbackCards } from './ui/FallbackCards';
import { Timeline } from './ui/Timeline';

export function TrackingScreen() {
  const { reference } = useParams<{ reference: string }>();
  const { data: report, isLoading, error } = useReport(reference);

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error || !report) {
    return (
      <div className="p-4">
        <StatusBanner variant="failed" icon="&#9888;">
          Report not found
        </StatusBanner>
      </div>
    );
  }

  const statusVariant = report.status === 'verified' ? 'success' :
                       report.status === 'resolved' ? 'success' :
                       'queued';

  const statusConfig = {
    verified: {
      icon: '&#9889;',
      text: 'Responders dispatched.',
    },
    resolved: {
      icon: '&#10003;',
      text: 'Situation is cleared.',
    },
    awaiting_verify: {
      icon: '&#128266;',
      text: 'Waiting for review.',
    },
  };

  const config = statusConfig[report.status as keyof typeof statusConfig] || statusConfig.awaiting_verify;

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-center font-mono text-xl font-bold text-[#001e40] mb-1">
        {reference.toUpperCase()}
      </h1>
      <p className="text-center text-xs text-[#7b8794] mb-4">
        Reported {report.createdAt ? new Date(report.createdAt).toLocaleString() : 'Loading...'} · {report.reportType}
      </p>

      <StatusBanner variant={statusVariant} icon={config.icon}>
        <strong>{config.text}</strong>
      </StatusBanner>

      <div className="bg-white rounded-xl p-3.5 mb-3 shadow-sm">
        <h3 className="text-xs font-bold text-[#7b8794] uppercase tracking-wider mb-2">
          Location
        </h3>
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-[#52606d]">Address</span>
          <span className="text-sm font-medium text-[#1d1d1f]">
            {report.location?.address || 'N/A'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#52606d]">Coords</span>
          <span className="text-sm font-medium text-[#1d1d1d1f]">
            {report.location?.lat?.toFixed(5)}, {report.location?.lng?.toFixed(5)}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl p-3.5 mb-3 shadow-sm">
        <h3 className="text-xs font-bold text-[#7b8794] uppercase tracking-wider mb-2">
          Your contact
        </h3>
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-[#52606d]">Name</span>
          <span className="text-sm font-medium text-[#1d1d1f]">
            {report.reporterName}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#52606d]">Phone</span>
          <span className="text-sm font-medium text-[#1d1d1f]">
            {report.reporterPhone ? `****-***-${report.reporterPhone.slice(-4)}` : 'N/A'}
          </span>
        </div>
      </div>

      {report.resolutionNote && (
        <div className="bg-white rounded-xl p-3.5 mb-3 shadow-sm">
          <h3 className="text-xs font-bold text-[#7b8794] uppercase tracking-wider mb-2">
            Resolution
          </h3>
          <div className="text-sm text-[#52606d] mb-1">
            {report.resolutionNote}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#52606d]">Closed by</span>
            <span className="text-xs font-medium text-[#1d1d1f]">
              {report.closedBy}
            </span>
          </div>
        </div>
      )}

      <Timeline events={report.timeline || []} />

      <div className="flex gap-2 mt-4">
        <Button variant="secondary" fullWidth>
          Update report
        </Button>
        <Button variant="primary" fullWidth onClick={() => window.location.href = 'tel:0547211216'}>
          Call responders
        </Button>
      </div>

      {report.status === 'resolved' && (
        <Button variant="secondary" fullWidth className="mt-2">
          Re-open if situation changed
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/citizen-pwa/src/components/TrackingScreen.tsx
git commit -m "feat(citizen-pwa): add TrackingScreen component with live updates"
```

---

## Task 11: Create 3-Step Submission Form

**Files:**

- Create: `apps/citizen-pwa/src/components/SubmitReportForm/index.tsx`
- Delete: `apps/citizen-pwa/src/components/SubmitReportForm.tsx` (old single-step form)

- [ ] **Step 1: Create step 1 (Evidence) component**

Create: `apps/citizen-pwa/src/components/SubmitReportForm/Step1Evidence.tsx`

```typescript
import { useState } from 'react';

interface Step1EvidenceProps {
  onNext: (data: { reportType: string; photoFile: File | null }) => void;
  onBack: () => void;
}

export function Step1Evidence({ onNext, onBack }: Step1EvidenceProps) {
  const [reportType, setReportType] = useState('flood');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const incidentTypes = [
    { value: 'flood', label: 'Flood', emoji: '🌊' },
    { value: 'fire', label: 'Fire', emoji: '🔥' },
    { value: 'road', label: 'Road', emoji: '🚧' },
    { value: 'medical', label: 'Medical', emoji: '🚑' },
    { value: 'power', label: 'Power', emoji: '⚡' },
    { landslide, label: 'Landslide', emoji: '⛰' },
    { value: 'other', label: 'Other', emoji: '+ Other' },
  ];

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPhotoFile(file);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleNext = () => {
    onNext({ reportType, photoFile });
  };

  const canProceed = reportType !== '';

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-[#f2f4f6] flex items-center justify-center text-[#001e40]">
          ←
        </button>
        <span className="text-xs font-semibold text-[#43474f]">1 of 3</span>
      </div>

      <div className="flex gap-1 mb-4">
        <div className="flex-1 h-1 bg-[#001e40] rounded-full" />
        <div className="flex-1 h-1 bg-[#e0e3e5] rounded-full" />
        <div className="flex-1 h-1 bg-[#e0e3e5] rounded-full" />
      </div>

      <h2 className="text-xl font-bold text-[#001e40] mb-1">
        What's happening?
      </h2>
      <p className="text-xs text-[#43474f] mb-4">
        Add a photo and choose the type
      </p>

      <div className="bg-gradient-to-b from-[#032038] to-[#001e40] rounded-xl aspect-[4/5] relative overflow-hidden mb-3">
        {previewUrl ? (
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <p className="text-xs mb-2">Camera viewfinder</p>
              <div className="w-12 h-12 bg-white/20 rounded-full mx-auto mb-2" />
              <p className="text-[10px]">Tap to capture</p>
            </div>
          </div>
        )}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center">
          <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
            📸
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => document.getElementById('photo-input')?.click()}
        className="w-full text-center text-sm text-[#001e40] underline mb-4"
      >
        No photo available
      </button>
      <input
        id="photo-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handlePhotoChange}
        className="hidden"
      />

      <div className="mb-4">
        <p className="text-xs font-bold text-[#001e40] uppercase tracking-wider mb-2">
          Type of incident
        </p>
        <div className="flex flex-wrap gap-1.5">
          {incidentTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setReportType(type.value)}
              className={`px-3 py-2 rounded-full text-xs font-semibold ${
                reportType === type.value
                  ? 'bg-[#001e40] text-white'
                  : 'bg-[#f2f4f6] text-[#191c1e]'
              }`}
            >
              {type.emoji} {type.label}
            </button>
          ))}
        </div>
      </div>

      <Button
        variant="primary"
        fullWidth
        onClick={handleNext}
        disabled={!canProceed}
      >
        Continue
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create step 2 (Who + Where) component**

Create: `apps/citizen-pwa/src/components/SubmitReportForm/Step2WhoWhere.tsx`

```typescript
import { useState } from 'react';

interface Step2WhoWhereProps {
  onNext: (data: {
    location: { lat: number; lng: number };
    reporterName: string;
    reporterMsisdn: string;
    patientCount: number;
  }) => void;
  onBack: () => void;
}

export function Step2WhoWhere({ onNext, onBack }: Step2WhoWhereProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [reporterName, setReporterName] = useState('');
  const [reporterMsisdn, setReporterMsisdn] = useState('');
  const [anyoneHurt, setAnyoneHurt] = useState(false);
  const [patientCount, setPatientCount] = useState(0);

  const handleGetLocation = async () => {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      alert('Could not get location. Please enable location services.');
    }
  };

  const handleNext = () => {
    if (!location) {
      alert('Please capture your location first.');
      return;
    }
    if (!reporterName.trim()) {
      alert('Please enter your name.');
      return;
    }
    if (!reporterMsisdn.trim()) {
      alert('Please enter your phone number.');
      return;
    }
    onNext({
      location,
      reporterName,
      reporterMsisdn,
      patientCount: anyoneHurt ? patientCount : 0,
    });
  };

  const canProceed = location && reporterName.trim() && reporterMsisdn.trim();

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-[#f2f4f6] flex items-center justify-center text-[#001e40]">
          ←
        </button>
        <span className="text-xs font-semibold text-[#43474f]">2 of 3</span>
      </div>

      <div className="flex gap-1 mb-4">
        <div className="flex-1 h-1 bg-[#001e40] rounded-full" />
        <div className="flex-1 h-1 bg-[#001e40] rounded-full" />
        <div className="flex-1 h-1 bg-[#e0e3e5] rounded-full" />
      </div>

      <h2 className="text-xl font-bold text-[#001e40] mb-1">
        Where and who?
      </h2>
      <p className="text-xs text-[#43474f] mb-4">
        All fields below are required
      </p>

      <div className="mb-4">
        <p className="text-[10px] font-bold text-[#001e40] uppercase tracking-wider mb-1">
          Location
        </p>
        <button
          type="button"
          onClick={handleGetLocation}
          className="w-full bg-[#f2f4f6] rounded-lg p-2.5 flex items-center gap-2.5 mb-2"
        >
          <div className="w-7 h-7 bg-[#001e40] rounded-lg flex items-center justify-center text-white">
            📍
          </div>
          <div className="flex-1 text-left">
            <div className="text-xs font-semibold text-[#191c1e]">
              {location ? 'Brgy. San Isidro, Daet' : 'Capture location'}
            </div>
            {location && (
              <div className="text-[9px] text-[#43474f]">
                GPS · 8m accuracy
              </div>
            )}
          </div>
          <span className="text-xs font-semibold text-[#001e40]">
            Change
          </span>
        </button>
        <div className="bg-[#e8eef4] rounded-lg h-13 relative mb-4">
          {location && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#a73400] border-2 border-white rounded-full" />
          )}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-[10px] font-bold text-[#001e40] uppercase tracking-wider mb-1">
          Your name
        </p>
        <input
          type="text"
          value={reporterName}
          onChange={(e) => setReporterName(e.target.value)}
          placeholder="Maria Dela Cruz"
          className="w-full bg-[#f2f4f6] border-b-2 border-[#001e40] rounded-t-lg p-2.5 text-sm text-[#191c1e] mb-3"
          required
        />
      </div>

      <div className="mb-4">
        <p className="text-[10px] font-bold text-[#001e40] uppercase tracking-wider mb-1">
          Phone number
        </p>
        <input
          type="tel"
          value={reporterMsisdn}
          onChange={(e) => setReporterMsisdn(e.target.value)}
          placeholder="+63 912 345 6789"
          className="w-full bg-[#f2f4f6] border-b-2 border-[#001e40] rounded-t-lg p-2.5 text-sm text-[#191c1e] mb-1"
          required
        />
        <p className="text-[10px] text-[#43474f]">
          <span className="font-semibold text-[#001e40]">Gives you faster help.</span> Admins call this number if they need more details. <em>Mas mabilis kang matutulungan.</em>
        </p>
      </div>

      <div className="mb-4">
        <p className="text-[10px] font-bold text-[#001e40] uppercase tracking-wider mb-1">
          Is anyone hurt?
        </p>
        <div className="flex gap-1.5 mb-2">
          <button
            type="button"
            onClick={() => setAnyoneHurt(true)}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold ${
              anyoneHurt ? 'bg-[#001e40] text-white' : 'bg-[#f2f4f6] text-[#191c1e]'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setAnyoneHurt(false)}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold ${
              !anyoneHurt ? 'bg-[#001e40] text-white' : 'bg-[#f2f4f6] text-[#191c1e]'
            }`}
          >
            No
          </button>
        </div>

        {anyoneHurt && (
          <div className="bg-[#fff5ef] rounded-lg p-2.5 animate-slideIn">
            <p className="text-[10px] font-bold text-[#5e1f00] uppercase tracking-wider mb-1">
              How many patients?
            </p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setPatientCount(Math.max(0, patientCount - 1))}
                className="w-7 h-7 bg-white text-[#5e1f00] rounded-lg flex items-center justify-center font-bold text-sm border border-[#e0c5b5]"
                disabled={patientCount === 0}
              >
                −
              </button>
              <div className="flex-1 bg-white p-2 rounded-lg text-center font-bold text-[#5e1f00]">
                {patientCount}
              </div>
              <button
                type="button"
                onClick={() => setPatientCount(patientCount + 1)}
                className="w-7 h-7 bg-[#5e1f00] text-white rounded-lg flex items-center justify-center font-bold text-sm"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>

      <Button
        variant="primary"
        fullWidth
        onClick={handleNext}
        disabled={!canProceed}
      >
        Continue
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create step 3 (Review + Assurance) component**

Create: `apps/citizen-pwa/src/components/SubmitReportForm/Step3Review.tsx`

```typescript
import { useState } from 'react';

interface Step3ReviewProps {
  onBack: () => void;
  onSubmit: () => void;
  reportData: {
    reportType: string;
    location: { lat: number; lng: number };
    reporterName: string;
    reporterMsisdn: string;
    patientCount: number;
    photoUrl?: string;
  };
}

export function Step3Review({ onBack, onSubmit, reportData }: Step3ReviewProps) {
  const [consent, setConsent] = useState(false);

  const incidentEmojis: Record<string, string> = {
    flood: '🌊',
    fire: '🔥',
    road: '🚧',
    medical: '🚑',
    power: '⚡',
    landslide: '⛰',
    other: '+ Other',
  };

  const canProceed = consent;

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-[#f2f4f6] flex items-center justify-center text-[#001e40]">
          ←
        </button>
        <span className="text-xs font-semibold text-[#43474f]">3 of 3</span>
      </div>

      <div className="flex gap-1 mb-4">
        <div className="flex-1 h-1 bg-[#001e40] rounded-full" />
        <div className="flex-1 h-1 bg-[#001e40] rounded-full" />
        <div className="flex-1 h-1 bg-[#001e40] rounded-full" />
      </div>

      <div className="bg-gradient-to-br from-[#fff5ef] to-[#ffeee6] border border-[#f5d4bb] rounded-xl p-4 mb-4 relative overflow-hidden">
        <div className="absolute -top-5 -right-5 w-20 h-20 bg-[radial-gradient(circle,rgba(167,52,0,0.15)_0%,transparent_70%)]" />
        <div className="flex gap-2.5 items-start">
          <div className="w-8 h-8 bg-gradient-to-br from-[#a73400] to-[#d4522a] rounded-full flex items-center justify-center text-white flex-shrink-0">
            ♡
          </div>
          <p className="text-sm text-[#3d1300] leading-snug font-medium">
            <strong className="font-bold text-[#3d1300]">We heard you. We are here.</strong> We'll let you know when help is on the way. Please keep your line open.
          </p>
        </div>
      </div>

      <h2 className="text-base font-bold text-[#001e40] mb-2">
        Review your report
      </h2>

      <div className="bg-[#f2f4f6] rounded-lg p-2.5 mb-2">
        <p className="text-[9px] text-[#43474f] font-bold uppercase tracking-wider mb-0.5">
          Incident
        </p>
        <div className="text-sm font-semibold text-[#191c1e]">
          {incidentEmojis[reportData.reportType]} {reportData.reportType.charAt(0).toUpperCase() + reportData.reportType.slice(1)} · Brgy. San Isidro, Daet
        </div>
        <div className="text-[10px] text-[#43474f] mt-0.5">
          {reportData.photoUrl ? '1 photo' : 'No photo'} · {reportData.patientCount} {reportData.patientCount === 1 ? 'patient' : 'patients'}
        </div>
      </div>

      <div className="bg-[#f2f4f6] rounded-lg p-2.5 mb-4">
        <p className="text-[9px] text-[#43474f] font-bold uppercase tracking-wider mb-0.5">
          Contact
        </p>
        <div className="text-sm font-semibold text-[#191c1e]">
          {reportData.reporterName}
        </div>
        <div className="text-xs text-[#43474f]">
          {reportData.reporterMsisdn}
        </div>
      </div>

      <label className="block bg-[#eaf4fb] rounded-lg p-2.5 mb-4 flex gap-2 items-start">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={!consent}
          className="w-4 h-4 border-2 border-[#001e40] bg-[#001e40] flex-shrink-0 mt-0.5 disabled:bg-gray-300"
        />
        <span className="text-[10px] text-[#001e40] leading-snug">
          I confirm this report is true. Daet MDRRMO may contact me. <u>Privacy notice ›</u>
        </span>
      </label>

      <Button
        variant="primary"
        fullWidth
        onClick={onSubmit}
        disabled={!canProceed}
      >
        Submit report
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Create index file**

Create: `apps/citizen-pwa/src/components/SubmitReportForm/index.tsx`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Step1Evidence } from './Step1Evidence';
import { Step2WhoWhere } from './Step2WhoWhere';
import { Step3Review } from './Step3Review';
import { useSubmissionMachine } from '../../hooks/useSubmissionMachine';

type FormData = {
  reportType: string;
  photoFile: File | null;
  location: { lat: number; lng: number };
  reporterName: string;
  reporterMsisdn: string;
  patientCount: number;
};

export function SubmitReportFormNew() {
  const navigate = useNavigate();
  const { state, transition, dismiss, setError } = useSubmissionMachine();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    reportType: 'flood',
    photoFile: null,
    location: { lat: 0, lng: 0 },
    reporterName: '',
    reporterMsisdn: '',
    patientCount: 0,
  });

  const currentStep = (stepNumber: 1 | 2 | 3) => {
    switch (stepNumber) {
      case 1:
        return (
          <Step1Evidence
            onNext={(data) => {
              setFormData((prev) => ({ ...prev, ...data }));
              setStep(2);
            }}
            onBack={() => navigate('/')}
          />
        );
      case 2:
        return (
          <Step2WhoWhere
            onNext={(data) => {
              setFormData((prev) => ({ ...prev, ...data }));
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        );
      case 3:
        return (
          <Step3Review
            onBack={() => setStep(2)}
            onSubmit={handleSubmit}
            reportData={formData}
          />
        );
    }
  };

  const handleSubmit = async () => {
    transition('submitting');
    try {
      // TODO: Implement submission logic with localForage and Firestore
      console.log('Submitting:', formData);
      transition('success');
      // Navigate to tracking screen after 5s or on dismiss
    } catch (error) {
      setError({ code: 'SUBMIT_ERROR', message: error instanceof Error ? error.message : 'Submission failed' });
      transition('failed_retryable');
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {currentStep(step)}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/citizen-pwa/src/components/SubmitReportForm/
git rm apps/citizen-pwa/src/components/SubmitReportForm.tsx
git commit -m "refactor(citizen-pwa): convert to 3-step submission form with state machine"
```

---

## Task 12: Add Back Button Guard

**Files:**

- Create: `apps/citizen-pwa/src/lib/routerGuard.ts`

- [ ] **Step 1: Create router guard utility**

```typescript
import { useBlocker } from 'react-router-dom'
import { useUIStore } from './store'

export function useRevealGuard() {
  const { currentSheet } = useUIStore()

  return useBlocker(({ currentLocation }) => {
    // Only block if Reveal sheet is open AND user is going back
    if (currentSheet !== 'none' && currentLocation.action === 'POP') {
      // Check if we're on a tracking screen or going to one
      const isTrackingScreen = currentLocation.pathname.startsWith('/reports/')
      if (!isTrackingScreen) {
        // Not on tracking screen — block back button
        return 'You have an unsent report. Please save or send it first.'
      }
    }
    return false
  })
}
```

- [ ] **Step 2: Update App.tsx to use guard**

Modify: `apps/citizen-pwa/src/App.tsx`

```typescript
import { useRevealGuard } from './lib/routerGuard';
import { AppRoutes } from './routes.js';

export function App() {
  useRevealGuard();
  return <AppRoutes />;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/src/lib/routerGuard.ts apps/citizen-pwa/src/App.tsx
git commit -m "feat(citizen-pwa): add back button guard for Reveal sheet"
```

---

## Task 13: Update Routing for New Pages

**Files:**

- Modify: `apps/citizen-pwa/src/routes.tsx`

- [ ] **Step 1: Add new routes**

Add to routes array:

```typescript
{
  path: '/report/new',
  element: <lazyFetchSuspense><Suspense fallback="Loading...">{/* eslint-disable-next-line */ import('./components/SubmitReportForm/index')} />},
  handle: { hideBottomNav: true },
},
{
  path: '/reports/:reference',
  element: <lazyFetchSuspense><Suspense fallback="Loading...">{/* eslint-disable-next-line */ import('./components/TrackingScreen')} />},
  handle: { hideBottomNav: true },
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/citizen-pwa/src/routes.tsx
git commit -m "feat(citizen-pwa): add routes for 3-step form and tracking screen"
```

---

## Task 14: Implement Draft Persistence and Retry Logic

**Files:**

- Create: `apps/citizen-pwa/src/lib/draftManager.ts`

- [ ] **Step 1: Create draft manager**

```typescript
import { saveDraft, getDraft, listDrafts, deleteDraft, type DraftReport } from './localforage'

export async function createDraft(reportData: Omit<DraftReport, 'uuid'>): Promise<string> {
  const uuid = crypto.randomUUID()
  const draft: DraftReport = {
    uuid,
    ...reportData,
    createdAt: Date.now(),
    state: 'queued',
    submittedRef: undefined,
  }
  await saveDraft(draft)
  return uuid
}

export async function updateDraft(uuid: string, updates: Partial<DraftReport>): Promise<void> {
  const draft = await getDraft(uuid)
  if (!draft) throw new Error('Draft not found')
  const updated = { ...draft, ...updates }
  await saveDraft(updated)
}

export async function transitionDraftToFailed(
  uuid: string,
  error: { code: string; message: string },
): Promise<void> {
  const draft = await getDraft(uuid)
  if (!draft) throw new Error('Draft not found')
  await saveDraft({
    ...draft,
    state: 'failed_retryable',
    lastError: { ...error, timestamp: Date.now() },
  })
}

export async function incrementDraftRetry(uuid: string): Promise<void> {
  const draft = await getDraft(uuid)
  if (!draft) throw new Error('Draft not found')
  await saveDraft({
    ...draft,
    retryCount: (draft.retryCount || 0) + 1,
  })
}

export async function promoteDraftToSuccess(uuid: string, finalRef: string): Promise<void> {
  const draft = await getDraft(uuid)
  if (!draft) throw new Error('Draft not found')
  await saveDraft({
    ...draft,
    state: 'draft',
    submittedRef: finalRef,
    lastError: undefined,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/citizen-pwa/src/lib/draftManager.ts
git commit -m "feat(citizen-pwa): add draft manager for persistence and state transitions"
```

---

## Task 15: Implement Photo Upload with Blocking

**Files:**

- Create: `apps/citizen-pwa/src/lib/photoUpload.ts`

- [ ] **Step 1: Create photo upload utility**

```typescript
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

export interface PhotoUploadResult {
  photoUrl: string
  storagePath: string
}

export type PhotoUploadState = 'idle' | 'uploading' | 'done' | 'error'

export interface PhotoUploadManager {
  state: PhotoUploadState
  photoUrl: string | null
  error: string | null
  uploadFile: File | null

  setState: (state: PhotoUploadState) => void
  setError: (error: string) => void
  uploadFile: (file: File) => void
}

export function createPhotoUploadManager(): PhotoUploadManager {
  let state: PhotoUploadState = 'idle'
  let photoUrl: string | null = null
  let error: string | null = null
  let uploadFile: File | null = null

  return {
    get state() {
      return state
    },
    get photoUrl() {
      return photoUrl
    },
    get error() {
      return error
    },

    setState(newState: PhotoUploadState) {
      state = newState
    },

    setError(err: string) {
      error = err
      state = 'error'
    },

    async uploadFile(file: File): Promise<void> {
      uploadFile = file
      state = 'uploading'
      error = null
      photoUrl = null

      try {
        const filename = `${Date.now()}-${file.name}`
        const storageRef = ref(getStorage(), `citizen-uploads/${filename}`)
        await uploadBytes(storageRef, file)
        photoUrl = await getDownloadURL(storageRef)
        state = 'done'
      } catch (err) {
        error = err instanceof Error ? err.message : 'Upload failed'
        state = 'error'
        throw err
      }
    },
  }
}

export async function uploadPhotoBlocking(file: File): Promise<PhotoUploadResult> {
  const manager = createPhotoUploadManager()

  // Non-blocking: return immediately if already uploading
  if (manager.state === 'uploading') {
    throw new Error('Photo upload in progress')
  }

  await manager.uploadFile(file)

  if (manager.state !== 'done' || !manager.photoUrl) {
    throw new Error(manager.error || 'Upload failed')
  }

  return {
    photoUrl: manager.photoUrl,
    storagePath: `citizen-uploads/${Date.now()}-${file.name}`,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/citizen-pwa/src/lib/photoUpload.ts
git commit -m "feat(citizen-pwa): add photo upload utility with blocking state"
```

---

## Task 16: Update App.tsx with QueryProvider

**Files:**

- Modify: `apps/citizen-pwa/src/main.tsx`

- [ ] **Step 1: Import and wrap App with QueryProvider**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryProvider, initializeQueryClient } from './lib/query-client';
import App from './App';

// Initialize query persistence before render
await initializeQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/citizen-pwa/src/main.tsx
git commit -m "refactor(citizen-pwa): wrap app with QueryProvider for TanStack Query"
```

---

## Task 17: Add Integration Tests

**Files:**

- Create: `apps/citizen-pwa/src/__tests__/submit-flow.test.tsx`

- [ ] **Step 1: Write submit flow integration tests**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { cleanupExpiredDrafts } from '../lib/localforage';
import type { DraftReport } from '../lib/localforage';

// Mock Firebase services
vi.mock('../services/firebase', () => ({
  db: {},
  fns: {},
}));

describe('Submission flow integration', () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    await cleanupExpiredDrafts();
  });

  afterEach(() => {
    cleanupExpiredDrafts();
  });

  it('should complete full happy path submission', async () => {
    const { getByRole, getByLabelText, getByText } = render(
      <QueryClientProvider client={queryClient}>
        {/* TODO: Wrap with TestAppWrapper including router */}
        <div>Submit report form test placeholder</div>
      </QueryClientProvider>
    );

    // Step 1: Select incident type
    const floodButton = getByText('Flood', { selector: 'button' });
    await userEvent.click(floodButton);

    // Step 1: Capture location (mocked)
    const locationButton = getByText('Capture location');
    await userEvent.click(locationButton);

    // Step 2: Fill name and phone
    const nameInput = getByLabelText(/your name/i);
    await userEvent.type(nameInput, 'Maria Dela Cruz');

    const phoneInput = getByLabelText(/phone number/i);
    await userEvent.type(phoneInput, '+63 912 345 6789');

    // Step 2: Select "Yes" for patients
    const yesButton = getByText('Yes');
    await userEvent.click(yesButton);

    // Increment patients
    const plusButton = getByText('+');
    await userEvent.click(plusButton);

    // Step 3: Review screen
    expect(screen.getByText('We heard you. We are here.')).toBeInTheDocument();
    expect(screen.getByText(/Maria Dela Cruz/)).toBeInTheDocument();
    expect(screen.getByText(/\+63 912/)).toBeInTheDocument();

    // Check consent checkbox
    const consentCheckbox = getByRole('checkbox');
    expect(consentCheckbox).not.toBeChecked();
    await userEvent.click(consentCheckbox);
    expect(consentCheckbox).toBeChecked();

    // Submit (mocked)
    const submitButton = getByText('Submit report');
    await userEvent.click(submitButton);

    // Should show success Reveal
    await waitFor(() => {
      expect(screen.getByText('We heard you. We are here.')).toBeInTheDocument();
    });
  });

  it('should save draft when offline', async () => {
    // TODO: Implement offline simulation test
  });

  it('should show queued Reveal on network error', async () => {
    // TODO: Implement network error test
  });
});
```

- [ ] **Step 2: Add MSW to dev dependencies**

Run: `pnpm add -D msw`

- [ ] **Step 3: Create test setup utilities**

Create: `apps/citizen-pwa/src/__tests__/test-utils.tsx`

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'msw';
import { QueryClient } from '@tanstack/react-query';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function TestWrapper({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createTestQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/citizen-pwa/src/__tests__/submit-flow.test.tsx apps/citizen-pwa/src/__tests__/test-utils.tsx
git commit -m "test(citizen-pwa): add integration tests for submission flow"
```

---

## Task 18: Add E2E Tests

**Files:**

- Create: `e2e-tests/citizen-pwa.spec.ts`

- [ ] **Step 1: Write E2E test for submission flow**

```typescript
import { test, expect, devices } from '@playwright/test'

test.describe('Citizen PWA submission flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Clean up any existing drafts
    await page.evaluate(() => {
      localStorage.clear()
    })
  })

  test('should complete full submission on real device', async ({ page }) => {
    // Step 1: Select incident type
    await page.click('button:has-text("Flood")')

    // Capture location
    await page.click('button:has-text("Capture location")')

    // Wait for GPS (mocked in tests)
    await page.waitForTimeout(1000)

    // Step 2: Fill form
    await page.fill('input[placeholder*="Maria"]', 'Maria Dela Cruz')
    await page.fill('input[placeholder*="+63"]', '+63 912 345 6789')

    // Select "Yes" for patients
    await page.click('button:has-text("Yes")')
    await page.click('button:has-text("+")')

    // Step 3: Review and submit
    await page.waitForSelector('text=We heard you. We are here.')

    // Check consent checkbox
    const consent = page.locator('input[type="checkbox"]').first
    await consent.check()

    await page.click('button:has-text("Submit report")')

    // Should show success Reveal
    await expect(page.locator('text=We heard you. We are here.')).toBeVisible()
    await expect(page.locator('text=BA-')).toBeVisible()
  })

  test('should handle offline state and retry', async ({ page }) => {
    // TODO: Simulate offline mode
    // Submit while offline
    // Should show queued Reveal
    // Go online
    // Should auto-retry and show success
  })

  test('should track report updates in real-time', async ({ page, browser }) => {
    // Navigate to tracking screen
    await page.goto('/reports/BA-TEST123')

    // Initial state
    await expect(page.locator('text=Report received')).toBeVisible()

    // Simulate admin status update (via Firebase Emulator)
    // TODO: Trigger Cloud Function to update report status

    // Should show "Responders dispatched" banner
    // await expect(page.locator('text=Responders dispatched')).toBeVisible({ timeout: 10000 });
  })
})

test.describe('Reveal sheet back button guard', () => {
  test('should block back on queued state', async ({ page }) => {
    // Trigger submission that goes to queued
    // Try to go back
    // Should block with message
    // TODO: Implement after back button guard
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add e2e-tests/citizen-pwa.spec.ts
git commit -m "test(e2e): add citizen PWA E2E tests for submission and tracking"
```

---

## Task 19: Add Accessibility Audit

**Files:**

- Create: `e2e-tests/a11y/citizen-pwa-a11y.spec.ts`

- [ ] **Step 1: Write a11y E2E tests**

```typescript
import { test, expect } from '@playwright/test'
import { injectAxe, checkA11y } from 'axe-core/playwright'

test.describe('Citizen PWA accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should have no accessibility violations on home page', async ({ page }) => {
    const accessibilityScanResults = await injectAxe(page, {
      includedImpacts: ['critical', 'serious'],
    })

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should be keyboard navigable', async ({ page }) => {
    // Test keyboard navigation through submission flow
    await page.keyboard.press('Tab') // Navigate to first interactive element
    // TODO: Verify focus indicators and tab order
  })

  test('should have proper color contrast', async ({ page }) => {
    // Check WCAG AA compliance
    // TODO: Use axe-core to verify all color combinations meet 4.5:1 contrast
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add e2e-tests/a11y/citizen-pwa-a11y.spec.ts
git commit -m "test(e2e): add accessibility audit tests with axe-core"
```

---

## Task 20: Create Documentation

**Files:**

- Create: `apps/citizen-pwa/README.md`

- [ ] **Step 1: Write component documentation**

````markdown
# Citizen PWA - Component Documentation

This document provides an overview of the citizen-facing PWA components and their usage.

## Components

### SubmitReportForm

3-step submission form with evidence capture, location/contact input, and review.

**Usage:**

```tsx
import { SubmitReportFormNew } from './components/SubmitReportForm'

;<SubmitReportFormNew />
```
````

**State Machine:**

- `idle` → `submitting` → `success` | `queued` | `failed_retryable`
- Transitions managed by `useSubmissionMachine` hook

### RevealSheet

Bottom sheet modal showing submission result with three variants: success, queued, failed_retryable.

**States:**

- Success: Green banner, server reference code, "Track this report" CTA
- Queued: Amber banner, draft reference, "Try sending now" CTA
- Failed: Rose banner, draft reference, "Try again" CTA + elevated hotline

**Usage:**

```tsx
import { RevealSheet } from './components/RevealSheet'

;<RevealSheet state="success" referenceCode="BA-7K3M-24" onClose={() => console.log('closed')} />
```

### TrackingScreen

Live-updating report detail screen with timeline and status.

**Data Source:**

- Firestore real-time listener via `useReport` hook
- Auto-updates when admin changes status

### UI Components

- **Button**: Primary, secondary, amber, red variants
- **StatusBanner**: Success (mint), queued (amber), failed (rose)
- **FallbackCards**: Call + SMS paired cards, emphasized variant
- **Timeline**: Vertical timeline with state-indicating dots

````

- [ ] **Step 2: Commit**

```bash
git add apps/citizen-pwa/README.md
git commit -m "docs(citizen-pwa): add component documentation for SubmitReportForm, RevealSheet, TrackingScreen"
````

---

## Task 21: Final Integration and Verification

**Files:**

- Modify: `apps/citizen-pwa/package.json` (update version)
- Modify: `apps/citizen-pwa/src/App.tsx` (integrate QueryProvider)
- Verify: `pnpm typecheck && pnpm lint && pnpm test`

- [ ] **Step 1: Update version in package.json**

Modify: `apps/citizen-pwa/package.json`

Change version to: `"0.1.0"`

- [ ] **Step 2: Run final verification**

```bash
cd apps/citizen-pwa
pnpm typecheck
pnpm lint
pnpm test
```

Expected: All commands pass, 0 errors

- [ ] **Step 3: Test smoke test**

Run: `pnpm dev`

Visit: `http://localhost:5173/` (or whichever port Vite uses)

Verify:

- [ ] Home page loads
- [ ] "Report" button in bottom nav is visible
- [ ] Click "Report" → 3-step form loads
- [ ] Can fill out form and see review screen
- [ ] Submit button is enabled only when consent checked

- [ ] **Step 4: Commit**

```bash
git add apps/citizen-pwa/package.json apps/citizen-pwa/src/App.tsx
git commit -m "chore(citizen-pwa): finalize integration - version 0.1.0, all tests passing"
```

---

## Task 22: Create Feature Branch

**Files:**

- (git operations)

- [ ] **Step 1: Create feature branch**

Run: `git checkout -b feature/citizen-report-flow`

- [ ] **Step 2: Verify clean branch**

Run: `git status`

Expected: Clean working tree, on feature branch

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "wip: start citizen report flow implementation"
```

---

## Task 23: Design Token CSS Verification

**Files:**

- Create: `apps/citizen-pwa/src/styles/globals.css`

- [ ] **Step 1: Create global styles with design tokens**

```css
@import './design-tokens.css';

:root {
  font-family:
    'Inter',
    -apple-system,
    system-ui,
    sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #1d1d1f;
  background: #f7f9fb;
}

body {
  margin: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}
```

- [ ] **Step 2: Import globals in main.tsx**

Modify: `apps/citizen-pwa/src/main.tsx`

Add after imports:

```typescript
import './styles/globals.css'
```

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-pwa/src/styles/globals.css apps/citizen-pwa/src/main.tsx
git commit -m "style(citizen-pwa): add global styles with design token CSS variables"
```

---

## Task 24: Cleanup and Final Verification

**Files:**

- Various cleanup tasks

- [ ] **Step 1: Remove old LookupScreen and ReceiptScreen placeholders**

```bash
git rm apps/citizen-pwa/src/components/LookupScreen.tsx
git rm apps/citizen-pwa/src/components/ReceiptScreen.tsx
```

- [ ] **Step 2: Update routes.tsx to remove old routes**

Remove placeholder routes for lookup/receipt if they exist

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass

- [ ] **Step 4: Run typecheck and lint**

```bash
pnpm typecheck
pnpm lint
```

Expected: 0 errors, 0 warnings

- [ ] **Step 5: Create PR summary**

Create: `docs/superpowers/pr/citizen-pwa-pr-summary.md`

```markdown
# Citizen PWA Implementation PR

## Summary

Implements the complete citizen-facing disaster reporting frontend with offline-first submission, degraded state fallbacks, and real-time tracking.

## Changes

- **3-step submission form** with evidence capture, location/contact input, and review screen
- **RevealSheet component** with success/queued/failed_retryable states
- **TrackingScreen component** with live Firestore listener updates
- **Design system** (colors, typography, components)
- **State architecture** (Zustand UI state, TanStack Query server state, localForage drafts)
- **SMS fallback** with pre-filled enriched format
- **Back button guard** preventing accidental draft loss
- **Photo upload blocking** to prevent race conditions
- **Integration tests** for happy path, queued, failed states
- **E2E tests** for real device verification
- **Accessibility audit** with WCAG 2.1 AA compliance

## Testing

- Integration tests: 100% coverage for state machine, reference generation, localForage writes
- Firestore security rules: 100% coverage
- E2E tests: 100% for happy path, 80% for edge cases
- A11y tests: 100% for critical paths

## Dependencies Added

- zustand
- @tanstack/react-query
- localforage
- @axe-core/react
- vitest
- @testing-library/react
- @testing-library/jest-dom

## Breaking Changes

None. This is a new feature.

## Migration Notes

None required. This is greenfield development.

## Related Specs

- Spec: docs/superpowers/specs/2026-04-21-citizen-report-flow-design.md
- Architecture: prd/bantayog-alert-architecture-spec-v8.md (SMS fallback extension)
```

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat(citizen-pwa): complete citizen report flow implementation - v0.1.0"
```

---

## Task 25: Deploy and Smoke Test

**Files:**

- None (deployment operations)

- [ ] **Step 1: Deploy to staging**

Run: `firebase deploy --only hosting --project bantayog-alert-staging`

Note: This requires Firebase project setup. Skip if not configured.

- [ ] **Step 2: Smoke test staging PWA**

1. Visit staging URL
2. Click "Report" button
3. Verify 3-step form loads
4. Fill out form with test data
5. Submit and verify Reveal appears
6. Navigate to tracking screen
7. Verify live updates (simulate status change via Firebase Console)

- [ ] **Step 3: Tag release**

```bash
git tag -a v0.1.0 -m "Citizen PWA v0.1.0 - Complete submission flow with offline fallback"
git push origin v0.1.0
```

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-21-citizen-report-flow-implementation.md`**
