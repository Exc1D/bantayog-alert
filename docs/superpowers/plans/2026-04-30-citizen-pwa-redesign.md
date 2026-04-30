# Citizen PWA Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for executing independent tasks in parallel. Use `superpowers:test-driven-development` for each task that touches logic or components. Use `superpowers:verification-before-completion` before marking any task done.

**Goal:** Bring the Citizen PWA into full compliance with the design spec at `docs/superpowers/specs/2026-04-30-citizen-pwa-redesign-design.md`. Sub-spec 1 fixes visual polish defects (wordmark, icons, chip/badge sizing). Sub-spec 2 adds missing features from role-spec-v2 (ceremony animations, auth-aware Profile, /register OTP flow, /settings, offline banner).

**Architecture:** React 18 + Vite, inline styles (no CSS Modules or Tailwind), Firebase v12 Auth/Firestore/Functions, React Router v7 `createBrowserRouter`, Lucide React icons, `localForage` draft store.

**Tech Stack:** Vitest v4.1.5, `@testing-library/react`, `vi.hoisted()` mock pattern, `navigator.vibrate()` (guarded), `navigator.clipboard.writeText()`, `prefers-reduced-motion` media query.

**Gate between sub-specs:** After Task 5, run `pnpm --filter citizen-pwa lint && pnpm --filter citizen-pwa typecheck && pnpm --filter citizen-pwa test run`. All must be green before Sub-spec 2 begins.

---

## Sub-spec 1 — DESIGN.md Compliance (Tasks 1–5)

---

### Task 1 — Create `incident-meta.tsx` shared utility

**File:** `apps/citizen-pwa/src/utils/incident-meta.tsx` (NEW)

**Why first:** Tasks 2, 3, and 4 all replace their local `INCIDENT_ICONS`/`INCIDENT_LABELS` maps with imports from this file. Create it first so the other tasks can import it immediately.

**What to build:**

```tsx
import { Flame, Droplets, Wind, AlertTriangle, Zap, Mountain, HelpCircle } from 'lucide-react'
import type { ReactNode } from 'react'

export const INCIDENT_TYPES = [
  'fire', 'flood', 'typhoon', 'landslide', 'accident',
  'medical', 'power_outage', 'other'
] as const
export type IncidentType = typeof INCIDENT_TYPES[number]

// Returns a Lucide icon element (16px default)
export function incidentIcon(type: IncidentType, size = 16): ReactNode { ... }

// Returns the display label (English)
export function incidentLabel(type: IncidentType): string { ... }
```

Icon mapping: fire→Flame, flood→Droplets, typhoon→Wind, landslide→Mountain, accident→AlertTriangle, medical→Zap (cross alt), power_outage→Zap, other→HelpCircle.

**Tests:** `apps/citizen-pwa/src/utils/incident-meta.test.tsx` — verify `incidentIcon` returns non-null for all types, `incidentLabel` returns non-empty string for all types.

**Verification:** `pnpm --filter citizen-pwa test run incident-meta`

---

### Task 2 — Fix wordmark in `CitizenShell.tsx`

**Files:**

- `apps/citizen-pwa/src/components/CitizenShell.tsx`
- `apps/citizen-pwa/src/components/CitizenShell.test.tsx`
- `apps/citizen-pwa/src/App.routes.test.tsx`

**What to change:**

- `CitizenShell.tsx` line ~34: change `"VIGILANT"` → `"BANTAYOG ALERT"` (the wordmark string)
- `CitizenShell.test.tsx`: update `toHaveTextContent('VIGILANT')` → `toHaveTextContent('BANTAYOG ALERT')`
- `App.routes.test.tsx`: update `toHaveTextContent('VIGILANT')` → `toHaveTextContent('BANTAYOG ALERT')`

**Verification:** `pnpm --filter citizen-pwa test run CitizenShell` + `pnpm --filter citizen-pwa test run App.routes`

---

### Task 3 — Polish `FeedTab.tsx`

**File:** `apps/citizen-pwa/src/components/FeedTab.tsx`

**What to change:**

1. Remove local `INCIDENT_ICONS` and `INCIDENT_LABELS` maps; import `incidentIcon`/`incidentLabel` from `../utils/incident-meta`
2. Update `chipStyle()`: remove `border`, set `background: '#f2f4f6'` (Stone Alt), padding `'8px 12px'`
3. Update severity/status badge `fontSize`: `'0.625rem'` → `'0.75rem'`
4. Replace any emoji strings in JSX with `incidentIcon(type)` calls

**Tests:** Update `FeedTab.test.tsx` (if exists) — confirm chips render without border, badge font size is `0.75rem`. If no test file exists, create `FeedTab.test.tsx` with a smoke test that renders the component without crashing.

**Verification:** `pnpm --filter citizen-pwa test run FeedTab`

---

### Task 4 — Polish `ProfileTab.tsx`

**File:** `apps/citizen-pwa/src/components/ProfileTab.tsx`

**What to change:**

1. Remove duplicate `INCIDENT_ICONS`/`INCIDENT_LABELS` maps; import from `../utils/incident-meta`
2. Update `ReportCard` badge `fontSize`: `'0.625rem'` → `'0.75rem'`
3. Replace emoji strings with `incidentIcon(type)` calls

**Note:** Do NOT add auth-aware views here — that is Sub-spec 2, Task 12. This task is polish only.

**Tests:** Update or create `ProfileTab.test.tsx` — verify badge font size and no local icon map.

**Verification:** `pnpm --filter citizen-pwa test run ProfileTab`

---

### Task 5 — Polish `AlertsTab.tsx`

**File:** `apps/citizen-pwa/src/components/AlertsTab.tsx`

**What to change:**

1. Remove `severityIcon()` returning emoji strings; import `Siren` and `Bell` from `lucide-react`
2. Replace `severityIcon()` calls: `critical`/`high` → `<Siren size={16} />`, `medium`/`low` → `<Bell size={16} />`
3. Update `AlertCard` badge `fontSize`: `'0.625rem'` → `'0.75rem'`

**Note:** Do NOT add `issuedBy` attribution row here — that is Sub-spec 2, Task 13.

**Tests:** Update or create `AlertsTab.test.tsx` — verify no emoji strings, badge font size.

**Verification:** `pnpm --filter citizen-pwa test run AlertsTab`

---

### SUB-SPEC 1 GATE

Run: `pnpm --filter citizen-pwa lint && pnpm --filter citizen-pwa typecheck && pnpm --filter citizen-pwa test run`

All must be green. Do not proceed to Sub-spec 2 until this passes.

---

## Sub-spec 2 — Role-Spec v2 Feature Gaps (Tasks 6–18)

---

### Task 6 — `useReducedMotion()` hook

**File:** `apps/citizen-pwa/src/hooks/useReducedMotion.ts` (NEW)

**What to build:**

```ts
export function useReducedMotion(): boolean {
  // useState initialized from matchMedia('(prefers-reduced-motion: reduce)').matches
  // useEffect subscribes to change event and updates state
  // Returns true when user prefers reduced motion
}
```

**Tests:** `useReducedMotion.test.ts` — mock `window.matchMedia`, assert returns `true` when media matches.

---

### Task 7 — `Toggle` component

**File:** `apps/citizen-pwa/src/components/Toggle.tsx` (NEW)

**What to build:** Accessible toggle switch using inline styles.

```tsx
interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}
```

- `role="switch"`, `aria-checked`, keyboard-accessible (`Space`/`Enter` toggles)
- Colors: checked → Signal Orange `#f26522`, unchecked → `#ccc`
- Thumb is white circle, 40px × 24px pill track
- Respects `useReducedMotion()` — no transition if reduced motion

**Tests:** `Toggle.test.tsx` — renders, toggles on click, toggles on Space key, aria-checked reflects state.

---

### Task 8 — `Toast` component + `useToast()` hook

**Files:**

- `apps/citizen-pwa/src/components/Toast.tsx` (NEW)
- `apps/citizen-pwa/src/hooks/useToast.ts` (NEW)

**What to build:**

- `useToast()` returns `{ show, message, type }` state + `toast(message, type)` trigger function
- `Toast` renders as fixed bottom banner (above nav), fades out after 3s
- Types: `'info' | 'success' | 'error'`
- Inline styles: success = `#1b5e20` bg, error = `#b71c1c` bg, info = Authority Navy
- Slide-up enter animation (respects `useReducedMotion`)

**Tests:** `Toast.test.tsx` — verify message renders, auto-hides after 3s (fake timers), does not render when `show` is false.

---

### Task 9 — `useOfflineQueueCount()` hook

**File:** `apps/citizen-pwa/src/hooks/useOfflineQueueCount.ts` (NEW)

**What to build:**

```ts
export function useOfflineQueueCount(): number {
  // Polls draft-store.list() every 5s
  // Counts drafts where syncState === 'local_only' || syncState === 'syncing'
  // Returns count (0 when online and synced)
}
```

**Critical:** The spec says `'queued'|'syncing'|'failed_retryable'` but the actual `SyncState` type in `draft-store.ts` is `'local_only' | 'syncing' | 'synced'`. Use `'local_only'` and `'syncing'` as the pending states.

**Tests:** `useOfflineQueueCount.test.ts` — mock `draft-store.list()`, assert count matches number of `local_only` + `syncing` drafts.

---

### Task 10 — Offline banner in `CitizenShell.tsx`

**File:** `apps/citizen-pwa/src/components/CitizenShell.tsx`

**What to change:**

- Import `useOnlineStatus` (returns `{ isOnline, navigatorOnline }`)
- Import `useOfflineQueueCount`
- Render a banner between header and `<main>` when `navigatorOnline === false`
- Banner: full-width, `background: '#f26522'` (Signal Orange), text: `"Offline — N report(s) queued"` where N is from `useOfflineQueueCount()`
- Banner position: sticky under the fixed 64px header (`top: 64px`)
- `<main>` padding-top should account for banner presence (add 36px when banner visible)

**Tests:** Update `CitizenShell.test.tsx` — mock `useOnlineStatus` to return `navigatorOnline: false`, assert banner renders with queue count.

---

### Task 11 — `RevealSheet.tsx` ceremony

**File:** `apps/citizen-pwa/src/components/RevealSheet.tsx`

**What to change:**

1. Add `secretCode?: string` and `reportCount?: number` to `RevealSheetProps`
2. Typewriter animation on `referenceCode`: 60ms/char delay, starts after 400ms settle delay (skip if `useReducedMotion()`)
3. Haptic feedback: `navigator.vibrate?.(200)` when typewriter completes
4. Afterglow footer: `"Sent at [time] · Daet MDRRMO is on it"` (use `new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })`)
5. Session upgrade prompt: if `secretCode` is provided, show "Save your secret code to track this report" card with copy-to-clipboard button (`navigator.clipboard.writeText(secretCode)`)
6. All animations must be skipped when `useReducedMotion()` returns `true`

**Tests:** `RevealSheet.test.tsx` — render with `secretCode` prop, assert upgrade prompt visible; render without, assert it's absent. Mock `navigator.vibrate` and assert called on typewriter complete. Mock `useReducedMotion` returning `true`, assert no animation classes/timeouts applied.

---

### Task 12 — Auth-aware `ProfileTab.tsx`

**File:** `apps/citizen-pwa/src/components/ProfileTab.tsx`

**What to change:**

1. Import `onAuthStateChanged` from `firebase/auth`
2. Three view states based on auth:
   - **Pseudonymous** (anonymous user, `isAnonymous === true`): show "You're using Bantayog anonymously" + "Register to track your reports" CTA → `navigate('/register')`
   - **Registered** (non-anonymous, `displayName` set): show name, report list (existing), settings link `⚙` → `navigate('/settings')`
   - **Loading**: show skeleton
3. Add Edit/Cancel/Request Correction buttons on `ReportCard` (Edit = navigate to `/report?edit=<id>`, Request Correction = placeholder `toast('Coming soon')`)
4. Settings link: icon button top-right, navigates to `/settings`

**Tests:** `ProfileTab.test.tsx` — mock `onAuthStateChanged` returning anonymous user, assert register CTA visible; mock returning registered user, assert report list visible.

---

### Task 13 — `issuedBy` attribution in `AlertsTab.tsx`

**File:** `apps/citizen-pwa/src/components/AlertsTab.tsx`

**What to change:**

- Add `issuedBy?: string` to `AlertCard` props/data type (read from Firestore `alerts.issuedBy` field if present)
- Render `issuedBy` as a secondary row below the alert title: `"Issued by: ${issuedBy}"` in `color: '#6b7280'`, `fontSize: '0.75rem'`
- Gracefully omit the row if `issuedBy` is undefined

**Tests:** Assert row renders when `issuedBy` is present, and does not render when absent.

---

### Task 14 — `LookupScreen.tsx` redesign

**File:** `apps/citizen-pwa/src/components/LookupScreen.tsx`

**What to build** (full replacement of stub):

- Navy header bar: `background: '#001e40'`, `color: white`, `"Check Report Status"` title
- Material-underline reference code input: no box border, only bottom border `2px solid #001e40`, focus → Signal Orange `#f26522`
- "Look Up" button: filled Signal Orange pill, full-width
- On submit: call existing `useIncident(code)` hook (or fetch); show ceremony reveal (loading spinner → `stroke-dashoffset` SVG checkmark animation when found)
- Fallback: "No report found for this code" in `color: '#b71c1c'`
- Respect `useReducedMotion()` — skip checkmark animation

**Tests:** `LookupScreen.test.tsx` — renders input and button; shows error on not-found; shows result on success (mock `useIncident`).

---

### Task 15 — `RegisterPage.tsx`

**File:** `apps/citizen-pwa/src/pages/RegisterPage.tsx` (NEW)

**What to build:**

- Step 1: Phone number input (E.164 PH format `+63XXXXXXXXXX`), "Send OTP" button
  - Uses Firebase `linkWithPhoneNumber(auth.currentUser, phone, recaptchaVerifier)`
  - Invisible reCAPTCHA — create `RecaptchaVerifier` with `size: 'invisible'`; destroy on unmount (`verifier.clear()`)
- Step 2: 6-digit OTP input (individual digit boxes with `maxLength=1`, auto-focus advance)
  - OTP digit micro-ceremony: each digit box gets a subtle scale pulse on entry (skip if `useReducedMotion()`)
  - `stroke-dashoffset` SVG checkmark animation on successful verify
  - `confirmationResult.confirm(otp)` → links phone to anonymous account
- Step 3: Display name input → `updateProfile(user, { displayName })`
- Error handling: `toast(error.message, 'error')` for all Firebase errors
- Back navigation: `navigate(-1)` or `navigate('/')`

**Tests:** `RegisterPage.test.tsx` — render Step 1; mock `linkWithPhoneNumber`, assert Step 2 appears on success; mock `confirmationResult.confirm`, assert Step 3 appears; mock `updateProfile`, assert navigate called.

---

### Task 16 — `SettingsPage.tsx`

**File:** `apps/citizen-pwa/src/pages/SettingsPage.tsx` (NEW)

**What to build:**

- Navy header with back button (`ChevronLeft` Lucide icon → `navigate(-1)`)
- Sections (inline styles, no cards needed — just labeled rows):
  1. **Notifications** — `Toggle` for push notifications (`getToken`/`deleteToken` FCM)
  2. **Offline Mode** — `Toggle` for offline-first cache (`localStorage.bantayog_offline_mode`)
  3. **Storage** — read `navigator.storage.estimate()`, display `"Using X MB of Y MB"`
  4. **Account** — "Request Data Export" button → calls `requestDataExport` Firebase callable (existing — verify in `functions/src/index.ts`)
  5. **Danger Zone** — "Delete Account" → existing `DeleteAccountFlow` component (already in `ProfileTab`)
- `signOut` button at bottom

**Tests:** `SettingsPage.test.tsx` — renders all sections, toggle changes state, storage estimate displays (mock `navigator.storage.estimate`), sign out calls `signOut`.

---

### Task 17 — Add `/register` and `/settings` routes

**File:** `apps/citizen-pwa/src/routes.tsx`

**What to change:**

- Import `RegisterPage` from `./pages/RegisterPage`
- Import `SettingsPage` from `./pages/SettingsPage`
- Add routes:
  ```ts
  { path: '/register', element: <RegisterPage /> },
  { path: '/settings', element: <SettingsPage /> },
  ```

**Tests:** Update `App.routes.test.tsx`:

- Add `vi.mock('./pages/RegisterPage', ...)` and `vi.mock('./pages/SettingsPage', ...)` with stub divs
- Assert `/register` renders `RegisterPage` stub
- Assert `/settings` renders `SettingsPage` stub

**Verification:** `pnpm --filter citizen-pwa test run App.routes`

---

### Task 18 — `requestDataExport` callable wrapper

**File:** `apps/citizen-pwa/src/services/callables.ts` (or wherever Firebase callable wrappers live — verify path first)

**What to add:**

- `requestDataExport()` → calls `httpsCallable(functions, 'requestDataExport')` with no args
- Returns `Promise<void>` (fire-and-forget from the client's perspective)
- Used by `SettingsPage` Task 16

**Pre-check:** `grep -r 'requestDataExport' apps/citizen-pwa/src` and `grep -r 'requestDataExport' functions/src` to verify the callable exists on the functions side before wiring the client wrapper.

**Tests:** Mock `httpsCallable`, assert it is called with function name `'requestDataExport'`.

---

## Final Verification

After all 18 tasks:

```bash
pnpm --filter citizen-pwa lint
pnpm --filter citizen-pwa typecheck
pnpm --filter citizen-pwa test run
pnpm --filter citizen-pwa build
```

All must pass with zero warnings promoted to errors.

Update `docs/progress.md`: mark Phase 9 Citizen PWA Redesign as COMPLETE.

---

## Execution Options

**Option A — Subagent-Driven (Recommended):** Use `superpowers:subagent-driven-development`. Tasks 1–5 (Sub-spec 1) can run in parallel across agents. After the Sub-spec 1 gate passes, Tasks 6–10 (new hooks/primitives) can also run in parallel. Tasks 11–18 must run after their dependencies (Task 7 before anything using Toggle, Task 6 before anything using animations, Task 9 before Task 10, Tasks 15–16 before Task 17).

**Option B — Inline Sequential:** Work through Tasks 1–18 one at a time in this conversation. Slower but simpler to track.
