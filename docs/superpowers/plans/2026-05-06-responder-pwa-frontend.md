# Responder PWA Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full UI layer for the responder PWA — shell layout with 4-tab navigation, redesigned pages, messaging, map, and profile — on top of the existing backend hooks.

**Architecture:** CSS Modules + CSS custom properties (no Tailwind); Shell component wraps all tab pages with persistent SOS button; detail pages are full-screen outside the shell. New hooks (`useReport`, `useMessages`, `useSendMessage`, `useAddFieldNote`, `useResponderProfile`, `useDispatchHistory`) provide data for new pages.

**Tech Stack:** React 18, React Router v7, Leaflet + react-leaflet, Vitest + testing-library, CSS Modules, Firebase Firestore SDK

---

## File Map

**New files to create:**

- `src/styles/globals.css` — global reset + app CSS variables
- `public/manifest.json` — PWA manifest
- `src/components/Shell.tsx` + `Shell.module.css` — 4-tab layout + SOS button header
- `src/components/SosHoldButton.tsx` + `SosHoldButton.module.css` — 3-second hold button
- `src/components/AcceptanceCountdown.tsx` — countdown timer for dispatch deadline
- `src/hooks/useReport.ts` — subscribe to `reports/{reportId}` for incident detail
- `src/hooks/useMessages.ts` — real-time `reports/{id}/messages` subscription
- `src/hooks/useSendMessage.ts` — write message to `reports/{id}/messages`
- `src/hooks/useAddFieldNote.ts` — write field note to `reports/{id}/field_notes`
- `src/hooks/useResponderProfile.ts` — subscribe to `responders/{uid}` doc
- `src/hooks/useDispatchHistory.ts` — query completed/terminal dispatches
- `src/pages/MapPage.tsx` + `MapPage.module.css` — Leaflet map tab
- `src/pages/MessagesPage.tsx` + `MessagesPage.module.css` — message threads list tab
- `src/pages/MessageThreadPage.tsx` + `MessageThreadPage.module.css` — single thread view
- `src/pages/ProfilePage.tsx` + `ProfilePage.module.css` — profile + availability + settings tab
- `src/pages/ShiftHandoffPage.tsx` — shift handoff form (extracted from DispatchListPage)
- `src/pages/DispatchHistoryPage.tsx` — completed dispatches list

**Files to modify:**

- `src/main.tsx` — import `globals.css`
- `src/routes.tsx` — restructure; add Shell wrapper + new routes
- `index.html` — link manifest + add font imports
- `src/pages/LoginPage.tsx` — full UI redesign
- `src/pages/DispatchListPage.tsx` — full UI redesign (remove handoff, add cards + countdown)
- `src/pages/DispatchDetailPage.tsx` — full UI redesign (add report detail, field notes, quick toggles)
- `src/pages/SosPage.tsx` — redesign as hold-to-confirm with animated ring
- `src/pages/BackupRequestPage.tsx` — styled form
- `src/pages/ResponderWitnessReportPage.tsx` — styled form
- `src/pages/CancelledScreen.tsx` — styled terminal screen
- `src/pages/RaceLossScreen.tsx` — styled terminal screen

---

## Task 1: Global Styles + PWA Manifest

**Files:**

- Create: `apps/responder-app/src/styles/globals.css`
- Modify: `apps/responder-app/src/main.tsx`
- Modify: `apps/responder-app/index.html`
- Create: `apps/responder-app/public/manifest.json`

- [ ] **Step 1: Write failing test — confirm globals.css imports without error**

```typescript
// apps/responder-app/src/styles/globals.test.ts
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import path from 'path'

describe('globals.css', () => {
  it('exists at src/styles/globals.css', () => {
    const filePath = path.resolve(__dirname, 'globals.css')
    expect(existsSync(filePath)).toBe(false) // fails until file created
  })
})
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd apps/responder-app && pnpm test src/styles/globals.test.ts
```

Expected: FAIL — `false` does not equal `true`

- [ ] **Step 3: Create `src/styles/globals.css`**

```css
@import '@bantayog/shared-ui/theme.css';

/* Responder-app-specific overrides */
:root {
  --r-navy: #001e40;
  --r-navy-light: #0a2e54;
  --r-surface: #f5f7fa;
  --r-card: #ffffff;
  --r-border: #e2e8f0;
  --r-text: #0f1419;
  --r-text-muted: #556068;
  --r-tab-bar-height: 60px;
  --r-header-height: 56px;
  --r-safe-bottom: env(safe-area-inset-bottom, 0px);
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  padding: 0;
  min-height: 100%;
  height: 100%;
  font-family: var(--font-sans);
  background: var(--r-surface);
  color: var(--r-text);
  -webkit-font-smoothing: antialiased;
}

button {
  font-family: inherit;
  cursor: pointer;
}

a {
  color: inherit;
  text-decoration: none;
}

input,
textarea,
select {
  font-family: inherit;
}
```

- [ ] **Step 4: Update `src/main.tsx` to import globals.css**

Replace:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.js'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

With:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.js'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 5: Create `public/manifest.json`**

```json
{
  "name": "Bantayog Alert — Responder",
  "short_name": "Bantayog",
  "description": "Disaster response coordination for responders in Camarines Norte",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#001e40",
  "theme_color": "#001e40",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 6: Update `index.html` — link manifest + add Inter font**

Replace `<head>` contents with:

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#001e40" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta
    name="description"
    content="Bantayog Alert responder app for disaster response coordination in Camarines Norte."
  />
  <link rel="manifest" href="/manifest.json" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
    rel="stylesheet"
  />
  <title>Bantayog Alert — Responder</title>
</head>
```

- [ ] **Step 7: Fix test to now pass**

Update the test assertion:

```typescript
expect(existsSync(filePath)).toBe(true)
```

- [ ] **Step 8: Run test + typecheck**

```bash
cd apps/responder-app && pnpm test src/styles/globals.test.ts && pnpm typecheck
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/responder-app/src/styles/globals.css \
        apps/responder-app/src/main.tsx \
        apps/responder-app/index.html \
        apps/responder-app/public/manifest.json \
        apps/responder-app/src/styles/globals.test.ts
git commit -m "feat(responder-pwa): add global styles and PWA manifest"
```

---

## Task 2: Shell Layout + SOS Hold Button

**Files:**

- Create: `apps/responder-app/src/components/Shell.tsx`
- Create: `apps/responder-app/src/components/Shell.module.css`
- Create: `apps/responder-app/src/components/SosHoldButton.tsx`
- Create: `apps/responder-app/src/components/SosHoldButton.module.css`
- Create: `apps/responder-app/src/components/Shell.test.tsx`
- Create: `apps/responder-app/src/components/SosHoldButton.test.tsx`

- [ ] **Step 1: Write failing Shell test**

```typescript
// apps/responder-app/src/components/Shell.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({ user: { uid: 'uid-1' } }),
}))

vi.mock('../hooks/useOwnDispatches', () => ({
  useOwnDispatches: () => ({ groups: { active: [], pending: [] }, rows: [], error: null }),
}))

vi.mock('./SosHoldButton', () => ({
  SosHoldButton: ({ disabled }: { disabled: boolean }) => (
    <button data-testid="sos-btn" disabled={disabled}>SOS</button>
  ),
}))

import { Shell } from './Shell'

describe('Shell', () => {
  it('renders tab navigation with 4 tabs', () => {
    render(
      <MemoryRouter>
        <Shell><div>content</div></Shell>
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /dispatches/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /map/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /messages/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument()
  })

  it('renders SOS button in header', () => {
    render(
      <MemoryRouter>
        <Shell><div>content</div></Shell>
      </MemoryRouter>
    )
    expect(screen.getByTestId('sos-btn')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd apps/responder-app && pnpm test src/components/Shell.test.tsx
```

Expected: FAIL — Cannot find module `./Shell`

- [ ] **Step 3: Create `Shell.module.css`**

```css
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: var(--r-surface);
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--r-header-height);
  padding: 0 var(--space-4);
  background: var(--r-navy);
  color: #fff;
  flex-shrink: 0;
}

.headerTitle {
  font-size: var(--font-size-md);
  font-weight: 700;
  letter-spacing: 0.03em;
}

.headerRight {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: calc(var(--r-tab-bar-height) + var(--r-safe-bottom));
}

.tabBar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(var(--r-tab-bar-height) + var(--r-safe-bottom));
  padding-bottom: var(--r-safe-bottom);
  background: #fff;
  border-top: 1px solid var(--r-border);
  display: flex;
  z-index: 100;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--color-text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-decoration: none;
  padding: var(--space-1) 0;
  transition: color 0.15s;
}

.tab:hover {
  color: var(--r-navy);
}

.tabActive {
  color: var(--r-navy);
}

.tabIcon {
  font-size: 20px;
  line-height: 1;
}

.badge {
  position: absolute;
  top: 6px;
  right: 50%;
  transform: translateX(10px);
  background: var(--color-danger);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  border-radius: 999px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tabItem {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 4: Create `Shell.tsx`**

```typescript
// apps/responder-app/src/components/Shell.tsx
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import { SosHoldButton } from './SosHoldButton'
import styles from './Shell.module.css'

interface Props {
  children: ReactNode
}

export function Shell({ children }: Props) {
  const { user } = useAuth()
  const { groups } = useOwnDispatches(user?.uid)
  const location = useLocation()

  const pendingCount = groups.pending.length
  const activeDispatchId = groups.active[0]?.dispatchId ?? null

  const tabs = [
    { to: '/', label: 'Dispatches', icon: '📋', exact: true },
    { to: '/map', label: 'Map', icon: '🗺️', exact: false },
    { to: '/messages', label: 'Messages', icon: '💬', exact: false },
    { to: '/profile', label: 'Profile', icon: '👤', exact: false },
  ]

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>Bantayog Alert</span>
        <div className={styles.headerRight}>
          <SosHoldButton
            activeDispatchId={activeDispatchId}
            disabled={!activeDispatchId}
          />
        </div>
      </header>

      <main className={styles.content}>
        {children}
      </main>

      <nav className={styles.tabBar} aria-label="Main navigation">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? location.pathname === tab.to
            : location.pathname.startsWith(tab.to)
          return (
            <div key={tab.to} className={styles.tabItem}>
              <NavLink
                to={tab.to}
                className={isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={styles.tabIcon} aria-hidden="true">{tab.icon}</span>
                <span>{tab.label}</span>
              </NavLink>
              {tab.to === '/' && pendingCount > 0 && (
                <span className={styles.badge} aria-label={`${pendingCount} pending`}>
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </div>
          )
        })}
      </nav>
    </div>
  )
}
```

- [ ] **Step 5: Write SosHoldButton test**

```typescript
// apps/responder-app/src/components/SosHoldButton.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { SosHoldButton } from './SosHoldButton'

describe('SosHoldButton', () => {
  it('renders as disabled when no active dispatch', () => {
    render(
      <MemoryRouter>
        <SosHoldButton activeDispatchId={null} disabled />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /sos/i })).toBeDisabled()
  })

  it('navigates to sos page after 3-second hold', async () => {
    vi.useFakeTimers()
    render(
      <MemoryRouter>
        <SosHoldButton activeDispatchId="disp-1" disabled={false} />
      </MemoryRouter>
    )
    const btn = screen.getByRole('button', { name: /sos/i })
    fireEvent.pointerDown(btn)
    await act(async () => { vi.advanceTimersByTime(3100) })
    expect(mockNavigate).toHaveBeenCalledWith('/dispatches/disp-1/sos')
    vi.useRealTimers()
  })

  it('does not navigate if hold released early', async () => {
    vi.useFakeTimers()
    render(
      <MemoryRouter>
        <SosHoldButton activeDispatchId="disp-1" disabled={false} />
      </MemoryRouter>
    )
    const btn = screen.getByRole('button', { name: /sos/i })
    fireEvent.pointerDown(btn)
    await act(async () => { vi.advanceTimersByTime(1000) })
    fireEvent.pointerUp(btn)
    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(mockNavigate).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 6: Create `SosHoldButton.module.css`**

```css
.btn {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-danger);
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.4);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 0.1s,
    opacity 0.15s;
}

.btn:disabled {
  background: #6b7280;
  cursor: not-allowed;
  opacity: 0.6;
}

.btn:not(:disabled):active {
  transform: scale(0.94);
}

.ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 3px solid var(--color-danger);
  opacity: 0;
  transform: scale(0.8);
  transition: none;
}

.ringActive {
  animation: ringFill 3s linear forwards;
}

@keyframes ringFill {
  0% {
    opacity: 1;
    transform: scale(0.8);
    border-color: rgba(255, 100, 100, 0.6);
  }
  100% {
    opacity: 1;
    transform: scale(1.2);
    border-color: var(--color-danger);
  }
}
```

- [ ] **Step 7: Create `SosHoldButton.tsx`**

```typescript
// apps/responder-app/src/components/SosHoldButton.tsx
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './SosHoldButton.module.css'

interface Props {
  activeDispatchId: string | null
  disabled: boolean
}

const HOLD_MS = 3000

export function SosHoldButton({ activeDispatchId, disabled }: Props) {
  const navigate = useNavigate()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [holding, setHolding] = useState(false)

  function startHold() {
    if (disabled || !activeDispatchId) return
    setHolding(true)
    timerRef.current = setTimeout(() => {
      setHolding(false)
      void navigate(`/dispatches/${activeDispatchId}/sos`)
    }, HOLD_MS)
  }

  function cancelHold() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setHolding(false)
  }

  return (
    <button
      className={styles.btn}
      disabled={disabled}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      aria-label="SOS — hold 3 seconds to activate"
      title={disabled ? 'No active dispatch' : 'Hold 3 seconds to trigger SOS'}
    >
      <span className={holding ? `${styles.ring} ${styles.ringActive}` : styles.ring} aria-hidden="true" />
      SOS
    </button>
  )
}
```

- [ ] **Step 8: Run all new tests**

```bash
cd apps/responder-app && pnpm test src/components/Shell.test.tsx src/components/SosHoldButton.test.tsx
```

Expected: All PASS

- [ ] **Step 9: Typecheck**

```bash
cd apps/responder-app && pnpm typecheck
```

Expected: 0 errors

- [ ] **Step 10: Commit**

```bash
git add apps/responder-app/src/components/Shell.tsx \
        apps/responder-app/src/components/Shell.module.css \
        apps/responder-app/src/components/Shell.test.tsx \
        apps/responder-app/src/components/SosHoldButton.tsx \
        apps/responder-app/src/components/SosHoldButton.module.css \
        apps/responder-app/src/components/SosHoldButton.test.tsx
git commit -m "feat(responder-pwa): add Shell tab layout and SOS hold button"
```

---

## Task 3: Routes Restructure

**Files:**

- Modify: `apps/responder-app/src/routes.tsx`

- [ ] **Step 1: Write failing test for new routes**

```typescript
// apps/responder-app/src/routes.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({ user: { uid: 'uid-1' } }),
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('./hooks/useOwnDispatches', () => ({
  useOwnDispatches: () => ({ groups: { active: [], pending: [] }, rows: [], error: null }),
}))
vi.mock('./components/Shell', () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}))
vi.mock('./components/SosHoldButton', () => ({
  SosHoldButton: () => null,
}))
vi.mock('./pages/MapPage', () => ({
  MapPage: () => <div data-testid="map-page" />,
}))
vi.mock('./pages/MessagesPage', () => ({
  MessagesPage: () => <div data-testid="messages-page" />,
}))
vi.mock('./pages/ProfilePage', () => ({
  ProfilePage: () => <div data-testid="profile-page" />,
}))
vi.mock('./pages/DispatchListPage', () => ({
  DispatchListPage: () => <div data-testid="dispatch-list" />,
}))
vi.mock('./pages/DispatchDetailPage', () => ({
  DispatchDetailPage: () => <div data-testid="dispatch-detail" />,
}))
vi.mock('./pages/LoginPage', () => ({
  LoginPage: () => <div data-testid="login-page" />,
}))
vi.mock('./services/push-client', () => ({
  subscribeForegroundPush: () => () => undefined,
  subscribeNotificationTap: () => () => undefined,
}))

import { AppRouter } from './routes'

describe('AppRouter', () => {
  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AppRouter />
      </MemoryRouter>
    )
  }

  it('renders MapPage at /map wrapped in Shell', () => {
    renderAt('/map')
    expect(screen.getByTestId('shell')).toBeInTheDocument()
    expect(screen.getByTestId('map-page')).toBeInTheDocument()
  })

  it('renders MessagesPage at /messages wrapped in Shell', () => {
    renderAt('/messages')
    expect(screen.getByTestId('messages-page')).toBeInTheDocument()
  })

  it('renders ProfilePage at /profile wrapped in Shell', () => {
    renderAt('/profile')
    expect(screen.getByTestId('profile-page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd apps/responder-app && pnpm test src/routes.test.tsx
```

Expected: FAIL — cannot find modules MapPage, MessagesPage, ProfilePage

- [ ] **Step 3: Create stub pages (to be fully implemented later)**

Create `src/pages/MapPage.tsx`:

```typescript
export function MapPage() {
  return <main><h1>Map</h1><p>Coming in Task 10.</p></main>
}
```

Create `src/pages/MessagesPage.tsx`:

```typescript
export function MessagesPage() {
  return <main><h1>Messages</h1><p>Coming in Task 9.</p></main>
}
```

Create `src/pages/ProfilePage.tsx`:

```typescript
export function ProfilePage() {
  return <main><h1>Profile</h1><p>Coming in Task 11.</p></main>
}
```

Create `src/pages/ShiftHandoffPage.tsx`:

```typescript
export function ShiftHandoffPage() {
  return <main><h1>Shift Handoff</h1></main>
}
```

Create `src/pages/DispatchHistoryPage.tsx`:

```typescript
export function DispatchHistoryPage() {
  return <main><h1>Dispatch History</h1></main>
}
```

- [ ] **Step 4: Rewrite `src/routes.tsx`**

```typescript
import { useEffect } from 'react'
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useNavigate,
} from 'react-router-dom'
import { ProtectedRoute } from '@bantayog/shared-ui'
import { Shell } from './components/Shell'
import { LoginPage } from './pages/LoginPage'
import { DispatchListPage } from './pages/DispatchListPage'
import { DispatchDetailPage } from './pages/DispatchDetailPage'
import { MapPage } from './pages/MapPage'
import { MessagesPage } from './pages/MessagesPage'
import { MessageThreadPage } from './pages/MessageThreadPage'
import { ProfilePage } from './pages/ProfilePage'
import { ShiftHandoffPage } from './pages/ShiftHandoffPage'
import { DispatchHistoryPage } from './pages/DispatchHistoryPage'
import { ResponderWitnessReportPage } from './pages/ResponderWitnessReportPage'
import { SosPage } from './pages/SosPage'
import { BackupRequestPage } from './pages/BackupRequestPage'
import { subscribeForegroundPush, subscribeNotificationTap } from './services/push-client'

function NotificationRouter() {
  const navigate = useNavigate()

  useEffect(() => {
    const unsubscribeTap = subscribeNotificationTap((dispatchId) => {
      void navigate(`/dispatches/${dispatchId}`)
    })
    const unsubscribeForeground = subscribeForegroundPush((payload) => {
      if (import.meta.env.DEV) {
        const type = (payload as Record<string, unknown> | undefined)?.type
        console.warn('[push] foreground notification received', type)
      }
    })
    return () => {
      unsubscribeTap()
      unsubscribeForeground()
    }
  }, [navigate])

  return null
}

function TabLayout() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  )
}

function AppLayout() {
  return (
    <>
      <NotificationRouter />
      <Outlet />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: (
          <ProtectedRoute allowedRoles={['responder']}>
            <TabLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: '/', element: <DispatchListPage /> },
          { path: '/map', element: <MapPage /> },
          { path: '/messages', element: <MessagesPage /> },
          { path: '/messages/:reportId', element: <MessageThreadPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
      {
        element: (
          <ProtectedRoute allowedRoles={['responder']}>
            <Outlet />
          </ProtectedRoute>
        ),
        children: [
          { path: '/dispatches/:dispatchId', element: <DispatchDetailPage /> },
          { path: '/dispatches/:id/witness-report', element: <ResponderWitnessReportPage /> },
          { path: '/dispatches/:id/sos', element: <SosPage /> },
          { path: '/dispatches/:id/backup', element: <BackupRequestPage /> },
          { path: '/handoff', element: <ShiftHandoffPage /> },
          { path: '/history', element: <DispatchHistoryPage /> },
        ],
      },
      { path: '/dispatches', element: <Navigate to="/" replace /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
```

Create stub `src/pages/MessageThreadPage.tsx`:

```typescript
export function MessageThreadPage() {
  return <main><h1>Message Thread</h1></main>
}
```

- [ ] **Step 5: Run all tests**

```bash
cd apps/responder-app && pnpm test src/routes.test.tsx
```

Expected: PASS

- [ ] **Step 6: Typecheck**

```bash
cd apps/responder-app && pnpm typecheck
```

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add apps/responder-app/src/routes.tsx \
        apps/responder-app/src/pages/MapPage.tsx \
        apps/responder-app/src/pages/MessagesPage.tsx \
        apps/responder-app/src/pages/MessageThreadPage.tsx \
        apps/responder-app/src/pages/ProfilePage.tsx \
        apps/responder-app/src/pages/ShiftHandoffPage.tsx \
        apps/responder-app/src/pages/DispatchHistoryPage.tsx \
        apps/responder-app/src/routes.test.tsx
git commit -m "feat(responder-pwa): restructure routes with Shell tab layout"
```

---

## Task 4: Login Page Redesign

**Files:**

- Modify: `apps/responder-app/src/pages/LoginPage.tsx`
- Create: `apps/responder-app/src/pages/LoginPage.module.css`

- [ ] **Step 1: Write failing test**

```typescript
// apps/responder-app/src/pages/LoginPage.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './LoginPage'

vi.mock('../app/firebase', () => ({
  auth: {},
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

describe('LoginPage', () => {
  it('renders Bantayog branding and login form', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    expect(screen.getByText(/bantayog alert/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — confirm it passes (LoginPage already has these elements)**

```bash
cd apps/responder-app && pnpm test src/pages/LoginPage.test.tsx
```

Expected: PASS (basic structure exists)

- [ ] **Step 3: Create `LoginPage.module.css`**

```css
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--r-navy);
  padding: var(--space-6);
}

.card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: var(--radius-lg);
  padding: var(--space-8);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
}

.brand {
  text-align: center;
  margin-bottom: var(--space-8);
}

.brandIcon {
  font-size: 2.5rem;
  margin-bottom: var(--space-2);
}

.brandTitle {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--r-navy);
  letter-spacing: 0.05em;
  margin: 0 0 var(--space-1) 0;
}

.brandSubtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--r-text);
}

.input {
  padding: 12px var(--space-4);
  border: 1.5px solid var(--r-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  color: var(--r-text);
  background: #fff;
  transition: border-color 0.15s;
  outline: none;
}

.input:focus {
  border-color: var(--r-navy);
}

.error {
  padding: var(--space-3) var(--space-4);
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}

.submitBtn {
  padding: 14px;
  background: var(--r-navy);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
  margin-top: var(--space-2);
}

.submitBtn:hover:not(:disabled) {
  background: var(--r-navy-light);
}

.submitBtn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Rewrite `LoginPage.tsx`**

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../app/firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const tokenResult = await cred.user.getIdTokenResult(true)
      const role = (tokenResult.claims as Record<string, unknown> | undefined)?.role
      if (role !== 'responder') {
        const { signOut } = await import('firebase/auth')
        await signOut(auth)
        setError('This account is not registered as a responder.')
        return
      }
      void navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>🚨</div>
          <h1 className={styles.brandTitle}>BANTAYOG ALERT</h1>
          <p className={styles.brandSubtitle}>Responder Portal · Camarines Norte</p>
        </div>

        <form className={styles.form} onSubmit={(e) => void handleLogin(e)}>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => { setEmail(e.target.value) }}
              autoComplete="email"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => { setPassword(e.target.value) }}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p role="alert" className={styles.error}>{error}</p>
          )}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run test**

```bash
cd apps/responder-app && pnpm test src/pages/LoginPage.test.tsx
```

Expected: PASS

- [ ] **Step 6: Typecheck + commit**

```bash
cd apps/responder-app && pnpm typecheck && \
git add apps/responder-app/src/pages/LoginPage.tsx \
        apps/responder-app/src/pages/LoginPage.module.css \
        apps/responder-app/src/pages/LoginPage.test.tsx
git commit -m "feat(responder-pwa): styled login page with Bantayog branding"
```

---

## Task 5: useReport Hook

**Files:**

- Create: `apps/responder-app/src/hooks/useReport.ts`
- Create: `apps/responder-app/src/hooks/useReport.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/responder-app/src/hooks/useReport.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockOnSnapshot = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _col, id) => ({ id })),
  onSnapshot: mockOnSnapshot,
}))

import { useReport } from './useReport'

describe('useReport', () => {
  it('returns report data when snapshot exists', async () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => true,
        data: () => ({
          reportType: 'flood',
          severity: 'high',
          status: 'verified',
          description: 'Rising water near bridge',
          municipalityId: 'daet',
          municipalityLabel: 'Daet',
          source: 'web',
          visibilityClass: 'public_alertable',
          submittedAt: { toMillis: () => 1700000000000 },
        }),
      })
      return () => undefined
    })

    const { result } = renderHook(() => useReport('report-1'))

    await waitFor(() => {
      expect(result.current.report).not.toBeNull()
      expect(result.current.report?.reportType).toBe('flood')
      expect(result.current.report?.severity).toBe('high')
    })
  })

  it('returns null when reportId is undefined', async () => {
    const { result } = renderHook(() => useReport(undefined))
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.report).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
cd apps/responder-app && pnpm test src/hooks/useReport.test.ts
```

Expected: FAIL — cannot find module `./useReport`

- [ ] **Step 3: Create `src/hooks/useReport.ts`**

```typescript
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface ReportSummary {
  reportType: string
  severity: 'low' | 'medium' | 'high'
  status: string
  description: string
  municipalityId: string
  municipalityLabel?: string
  barangayId?: string
  publicLocation?: { latitude: number; longitude: number }
  source: string
  submittedAt: number
  verifiedAt?: number
}

function toMillis(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis()
  }
  return undefined
}

export function useReport(reportId: string | undefined) {
  const [report, setReport] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!reportId) {
      queueMicrotask(() => {
        setReport(null)
        setLoading(false)
        setError(null)
      })
      return
    }

    const ref = doc(db, 'reports', reportId)
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setReport(null)
          setLoading(false)
          return
        }
        const d = snap.data()
        const submittedAt = toMillis(d.submittedAt) ?? Date.now()
        const verifiedAt = toMillis(d.verifiedAt)
        const loc = d.publicLocation as { latitude?: number; longitude?: number } | undefined
        setReport({
          reportType: String(d.reportType ?? 'other'),
          severity: (d.severity as 'low' | 'medium' | 'high') ?? 'low',
          status: String(d.status ?? 'new'),
          description: String(d.description ?? ''),
          municipalityId: String(d.municipalityId ?? ''),
          municipalityLabel: d.municipalityLabel ? String(d.municipalityLabel) : undefined,
          barangayId: d.barangayId ? String(d.barangayId) : undefined,
          publicLocation:
            loc?.latitude != null && loc?.longitude != null
              ? { latitude: loc.latitude, longitude: loc.longitude }
              : undefined,
          source: String(d.source ?? 'web'),
          submittedAt,
          ...(verifiedAt != null ? { verifiedAt } : {}),
        })
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[useReport] listener error:', err)
        setError(err.message)
        setLoading(false)
      },
    )
  }, [reportId])

  return { report, loading, error }
}
```

- [ ] **Step 4: Run test**

```bash
cd apps/responder-app && pnpm test src/hooks/useReport.test.ts
```

Expected: PASS

- [ ] **Step 5: Typecheck + commit**

```bash
cd apps/responder-app && pnpm typecheck && \
git add apps/responder-app/src/hooks/useReport.ts \
        apps/responder-app/src/hooks/useReport.test.ts
git commit -m "feat(responder-pwa): add useReport hook for incident detail"
```

---

## Task 6: Dispatch List Page Redesign

**Files:**

- Modify: `apps/responder-app/src/pages/DispatchListPage.tsx`
- Create: `apps/responder-app/src/pages/DispatchListPage.module.css`
- Create: `apps/responder-app/src/components/AcceptanceCountdown.tsx`
- Create: `apps/responder-app/src/components/AcceptanceCountdown.test.tsx`

- [ ] **Step 1: Write AcceptanceCountdown test**

```typescript
// apps/responder-app/src/components/AcceptanceCountdown.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AcceptanceCountdown } from './AcceptanceCountdown'

describe('AcceptanceCountdown', () => {
  afterEach(() => { vi.useRealTimers() })

  it('shows remaining time', () => {
    vi.useFakeTimers()
    const deadline = Date.now() + 120_000 // 2 minutes from now
    render(<AcceptanceCountdown deadlineMs={deadline} />)
    expect(screen.getByText(/1:5\d/)).toBeInTheDocument()
  })

  it('shows "Expired" when deadline passed', () => {
    render(<AcceptanceCountdown deadlineMs={Date.now() - 1000} />)
    expect(screen.getByText(/expired/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
cd apps/responder-app && pnpm test src/components/AcceptanceCountdown.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Create `AcceptanceCountdown.tsx`**

```typescript
// apps/responder-app/src/components/AcceptanceCountdown.tsx
import { useEffect, useState } from 'react'

interface Props {
  deadlineMs: number
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired'
  const totalSecs = Math.ceil(ms / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${String(mins)}:${String(secs).padStart(2, '0')}`
}

export function AcceptanceCountdown({ deadlineMs }: Props) {
  const [remaining, setRemaining] = useState(() => deadlineMs - Date.now())

  useEffect(() => {
    if (remaining <= 0) return
    const id = setInterval(() => {
      setRemaining(deadlineMs - Date.now())
    }, 1000)
    return () => { clearInterval(id) }
  }, [deadlineMs, remaining])

  const isExpired = remaining <= 0
  const isUrgent = remaining > 0 && remaining < 60_000

  return (
    <span
      style={{
        color: isExpired ? '#6b7280' : isUrgent ? 'var(--color-danger)' : 'var(--color-warning)',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
      }}
      aria-live="polite"
      aria-label={isExpired ? 'Acceptance window expired' : `Accept by ${formatRemaining(remaining)}`}
    >
      {formatRemaining(remaining)}
    </span>
  )
}
```

- [ ] **Step 4: Run AcceptanceCountdown test**

```bash
cd apps/responder-app && pnpm test src/components/AcceptanceCountdown.test.tsx
```

Expected: PASS

- [ ] **Step 5: Create `DispatchListPage.module.css`**

```css
.page {
  padding: var(--space-4);
  max-width: 600px;
  margin: 0 auto;
}

.emptyState {
  text-align: center;
  padding: var(--space-8) var(--space-6);
  color: var(--color-text-muted);
}

.emptyIcon {
  font-size: 3rem;
  margin-bottom: var(--space-4);
}

.emptyTitle {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--r-text);
  margin: 0 0 var(--space-2) 0;
}

.emptyText {
  font-size: var(--font-size-sm);
  margin: 0 0 var(--space-6) 0;
}

.section {
  margin-bottom: var(--space-6);
}

.sectionTitle {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-2) 0;
  padding: 0 var(--space-1);
}

.card {
  background: var(--r-card);
  border-radius: var(--radius-lg);
  border: 1.5px solid var(--r-border);
  padding: var(--space-4);
  margin-bottom: var(--space-3);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition:
    box-shadow 0.15s,
    border-color 0.15s;
}

.cardPending {
  border-color: #fbbf24;
  background: #fffbeb;
}

.cardActive {
  border-color: #34d399;
  background: #f0fdf4;
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.cardHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.cardTitle {
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--r-text);
  margin: 0;
}

.statusPill {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.pillPending {
  background: #fef3c7;
  color: #92400e;
}

.pillActive {
  background: #d1fae5;
  color: #065f46;
}

.cardMeta {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.severityDot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.severityHigh {
  background: var(--color-danger);
}
.severityMedium {
  background: var(--color-warning);
}
.severityLow {
  background: var(--color-success);
}

.deadlineRow {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.deadlineLabel {
  color: var(--color-text-muted);
}

.cardActions {
  display: flex;
  gap: var(--space-2);
}

.btnPrimary {
  flex: 1;
  padding: 10px;
  background: var(--r-navy);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
}

.btnSecondary {
  flex: 1;
  padding: 10px;
  background: #fff;
  color: var(--r-text);
  border: 1.5px solid var(--r-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
}
```

- [ ] **Step 6: Rewrite `DispatchListPage.tsx`**

```typescript
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import { AcceptanceCountdown } from '../components/AcceptanceCountdown'
import styles from './DispatchListPage.module.css'

const SEVERITY_LABEL: Record<string, string> = {
  high: 'High', medium: 'Medium', low: 'Low',
}

const REPORT_TYPE_LABEL: Record<string, string> = {
  flood: 'Flood', fire: 'Fire', earthquake: 'Earthquake', typhoon: 'Typhoon',
  landslide: 'Landslide', storm_surge: 'Storm Surge', medical: 'Medical',
  accident: 'Accident', structural: 'Structural', security: 'Security', other: 'Other',
}

export function DispatchListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { rows, groups, error } = useOwnDispatches(user?.uid)

  const activeDispatchId =
    groups.active.length === 1 ? (groups.active[0]?.dispatchId ?? null) : null

  useEffect(() => {
    if (activeDispatchId) {
      void navigate(`/dispatches/${activeDispatchId}`, { replace: true })
    }
  }, [activeDispatchId, navigate])

  const totalActive = rows.length

  if (totalActive === 0 && !error) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>✓</div>
          <h2 className={styles.emptyTitle}>All Clear!</h2>
          <p className={styles.emptyText}>
            No active dispatches. Stay ready — new dispatches will appear here.
          </p>
          <Link to="/history" className={styles.btnSecondary} style={{ display: 'inline-block', padding: '10px 20px', borderRadius: '8px' }}>
            View Past Dispatches
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {error && (
        <p role="alert" style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-4)' }}>
          Failed to load dispatches: {error}
        </p>
      )}

      {groups.pending.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>New Dispatches ({groups.pending.length})</h2>
          {groups.pending.map((row) => (
            <Link
              key={row.dispatchId}
              to={`/dispatches/${row.dispatchId}`}
              className={`${styles.card} ${styles.cardPending}`}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  {REPORT_TYPE_LABEL[row.reportId] ?? 'Incident'} — New Dispatch
                </h3>
                <span className={`${styles.statusPill} ${styles.pillPending}`}>Pending</span>
              </div>
              <div className={styles.cardMeta}>
                <span>Report {row.reportId.slice(0, 8)}</span>
              </div>
              {row.acknowledgementDeadlineAt && (
                <div className={styles.deadlineRow}>
                  <span className={styles.deadlineLabel}>Accept by:</span>
                  <AcceptanceCountdown
                    deadlineMs={row.acknowledgementDeadlineAt.toMillis()}
                  />
                </div>
              )}
              <div className={styles.cardActions}>
                <span className={styles.btnPrimary} style={{ textAlign: 'center', padding: '10px' }}>
                  View &amp; Accept
                </span>
              </div>
            </Link>
          ))}
        </section>
      )}

      {groups.active.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Active ({groups.active.length})</h2>
          {groups.active.map((row) => (
            <Link
              key={row.dispatchId}
              to={`/dispatches/${row.dispatchId}`}
              className={`${styles.card} ${styles.cardActive}`}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Incident {row.reportId.slice(0, 8)}</h3>
                <span className={`${styles.statusPill} ${styles.pillActive}`}>
                  {row.uiStatus === 'heading_to_scene' ? 'En Route' :
                   row.uiStatus === 'on_scene' ? 'On Scene' : String(row.uiStatus ?? row.status)}
                </span>
              </div>
              <div className={styles.cardMeta}>
                <span>Tap to view details</span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Run tests + typecheck**

```bash
cd apps/responder-app && pnpm test && pnpm typecheck
```

Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add apps/responder-app/src/pages/DispatchListPage.tsx \
        apps/responder-app/src/pages/DispatchListPage.module.css \
        apps/responder-app/src/components/AcceptanceCountdown.tsx \
        apps/responder-app/src/components/AcceptanceCountdown.test.tsx
git commit -m "feat(responder-pwa): redesign dispatch list page with cards and countdown"
```

---

## Task 7: Dispatch Detail Page Redesign

**Files:**

- Modify: `apps/responder-app/src/pages/DispatchDetailPage.tsx`
- Create: `apps/responder-app/src/pages/DispatchDetailPage.module.css`
- Create: `apps/responder-app/src/hooks/useAddFieldNote.ts`
- Create: `apps/responder-app/src/hooks/useAddFieldNote.test.ts`

- [ ] **Step 1: Write useAddFieldNote test**

```typescript
// apps/responder-app/src/hooks/useAddFieldNote.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockAddDoc = vi.hoisted(() => vi.fn())
const mockCollection = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({ db: {}, auth: {} }))
vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  serverTimestamp: () => ({ _type: 'serverTimestamp' }),
}))
vi.mock('../app/await-auth-token', () => ({
  awaitFreshAuthToken: () => Promise.resolve({ uid: 'uid-1' }),
}))

import { useAddFieldNote } from './useAddFieldNote'

describe('useAddFieldNote', () => {
  it('calls addDoc with note content', async () => {
    mockCollection.mockReturnValue({ path: 'reports/r1/field_notes' })
    mockAddDoc.mockResolvedValue({ id: 'note-1' })

    const { result } = renderHook(() => useAddFieldNote('r1'))

    await act(async () => {
      await result.current.addNote('Water is rising fast')
    })

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ content: 'Water is rising fast' }),
    )
  })

  it('throws if content is empty', async () => {
    const { result } = renderHook(() => useAddFieldNote('r1'))
    await expect(
      act(async () => {
        await result.current.addNote('   ')
      }),
    ).rejects.toThrow('content_required')
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
cd apps/responder-app && pnpm test src/hooks/useAddFieldNote.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create `useAddFieldNote.ts`**

```typescript
// apps/responder-app/src/hooks/useAddFieldNote.ts
import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../app/firebase'
import { awaitFreshAuthToken } from '../app/await-auth-token'

export function useAddFieldNote(reportId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()

  async function addNote(content: string): Promise<void> {
    const trimmed = content.trim()
    if (!trimmed) throw new Error('content_required')

    setLoading(true)
    setError(undefined)
    try {
      const user = await awaitFreshAuthToken(auth)
      if (!user) throw new Error('auth_required')
      const col = collection(db, 'reports', reportId, 'field_notes')
      await addDoc(col, {
        content: trimmed,
        authorUid: user.uid,
        createdAt: serverTimestamp(),
      })
    } catch (err: unknown) {
      const normalized = err instanceof Error ? err : new Error(String(err))
      setError(normalized)
      throw normalized
    } finally {
      setLoading(false)
    }
  }

  return { addNote, loading, error }
}
```

- [ ] **Step 4: Run useAddFieldNote test**

```bash
cd apps/responder-app && pnpm test src/hooks/useAddFieldNote.test.ts
```

Expected: PASS

- [ ] **Step 5: Create `DispatchDetailPage.module.css`**

```css
.page {
  min-height: 100vh;
  background: var(--r-surface);
}

.pageHeader {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--r-navy);
  color: #fff;
}

.backBtn {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.25rem;
  cursor: pointer;
  padding: var(--space-1);
  display: flex;
  align-items: center;
}

.pageTitle {
  font-size: var(--font-size-md);
  font-weight: 700;
  margin: 0;
  flex: 1;
}

.body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 600px;
  margin: 0 auto;
}

.incidentCard {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  border: 1.5px solid var(--r-border);
  box-shadow: var(--shadow-sm);
}

.incidentTitle {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0 0 var(--space-3) 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.severityBadge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.sevHigh {
  background: #fee2e2;
  color: var(--color-danger);
}
.sevMedium {
  background: #fef3c7;
  color: #92400e;
}
.sevLow {
  background: #d1fae5;
  color: #065f46;
}

.incidentMeta {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.incidentDesc {
  font-size: var(--font-size-sm);
  color: var(--r-text);
  margin: var(--space-3) 0 0 0;
  line-height: 1.6;
}

.statusSection {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  border: 1.5px solid var(--r-border);
}

.statusTitle {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-3) 0;
}

.quickToggles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.toggleBtn {
  padding: 12px var(--space-3);
  border: 1.5px solid var(--r-border);
  border-radius: var(--radius-md);
  background: #fff;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  transition:
    background 0.12s,
    border-color 0.12s;
}

.toggleBtn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: var(--r-navy);
  color: var(--r-navy);
}

.toggleBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.togglePrimary {
  background: var(--r-navy);
  border-color: var(--r-navy);
  color: #fff;
}

.togglePrimary:hover:not(:disabled) {
  background: var(--r-navy-light);
  color: #fff;
}

.resolutionForm {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.textarea {
  width: 100%;
  padding: var(--space-3);
  border: 1.5px solid var(--r-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  outline: none;
}

.textarea:focus {
  border-color: var(--r-navy);
}

.dangerBtn {
  padding: 10px;
  background: #fff;
  border: 1.5px solid var(--color-danger);
  border-radius: var(--radius-md);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  width: 100%;
}

.navBtn {
  display: block;
  padding: 12px;
  background: #fff;
  border: 1.5px solid var(--r-border);
  border-radius: var(--radius-md);
  text-align: center;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--r-text);
  text-decoration: none;
  transition: background 0.12s;
  cursor: pointer;
  width: 100%;
}

.navBtn:hover {
  background: #f8fafc;
}

.fieldNoteForm {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.noteInput {
  padding: var(--space-3);
  border: 1.5px solid var(--r-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-family: inherit;
  resize: vertical;
  min-height: 64px;
  outline: none;
}

.noteInput:focus {
  border-color: var(--r-navy);
}

.noteSubmitBtn {
  padding: 10px;
  background: var(--r-navy);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  align-self: flex-end;
}

.errorMsg {
  padding: var(--space-3);
  background: #fee2e2;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}

.navigateSection {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  border: 1.5px solid var(--r-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.navigateBtn {
  display: block;
  padding: 14px;
  background: #177245;
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: 700;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
}
```

- [ ] **Step 6: Rewrite `DispatchDetailPage.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useDispatch } from '../hooks/useDispatch'
import { useReport } from '../hooks/useReport'
import { useAcceptDispatch } from '../hooks/useAcceptDispatch'
import { useAdvanceDispatch } from '../hooks/useAdvanceDispatch'
import { useDeclineDispatch } from '../hooks/useDeclineDispatch'
import { useMarkDispatchUnableToComplete } from '../hooks/useMarkDispatchUnableToComplete'
import { useAddFieldNote } from '../hooks/useAddFieldNote'
import { CancelledScreen } from './CancelledScreen'
import { RaceLossScreen } from './RaceLossScreen'
import styles from './DispatchDetailPage.module.css'

const REPORT_TYPE_LABEL: Record<string, string> = {
  flood: '🌊 Flood', fire: '🔥 Fire', earthquake: '🌍 Earthquake',
  typhoon: '🌀 Typhoon', landslide: '⛰️ Landslide', storm_surge: '🌊 Storm Surge',
  medical: '🏥 Medical', accident: '💥 Accident', structural: '🏚️ Structural',
  security: '🚔 Security', other: '⚠️ Other',
}

function getFirebaseErrorCode(error: Error | undefined): string {
  if (!error || !('code' in error)) return ''
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : ''
}

function getActionErrorMessage(error: Error | undefined): string | null {
  if (!error) return null
  const code = getFirebaseErrorCode(error)
  if (code === 'functions/permission-denied') return 'This dispatch is no longer available.'
  if (code === 'functions/already-exists') return 'Another responder already claimed this dispatch.'
  if (code === 'functions/failed-precondition') return 'This action is no longer allowed from the current state.'
  if (error.message === 'auth_required') return 'You must be signed in.'
  if (error.message === 'resolutionSummary_required') return 'A resolution summary is required.'
  if (error.message === 'reason_required') return 'A reason is required.'
  return 'Something went wrong. Please retry.'
}

const DECLINE_REASONS = [
  'Already on another assignment',
  'Unable to respond — not available',
  'Too far away',
  'Not my specialization',
  'Vehicle / equipment issue',
  'Safety concern (hazardous conditions)',
]

export function DispatchDetailPage() {
  const { dispatchId } = useParams<{ dispatchId: string }>()
  const navigate = useNavigate()
  const { dispatch, loading, error, refresh } = useDispatch(dispatchId)
  const { report } = useReport(dispatch?.reportId)

  const { accept, loading: accepting, error: acceptError } = useAcceptDispatch(dispatch?.dispatchId ?? '')
  const { decline, loading: declining, error: declineError } = useDeclineDispatch(dispatch?.dispatchId ?? '')
  const { advance, loading: advanceLoading, error: advanceError } = useAdvanceDispatch(dispatch?.dispatchId ?? '')
  const { markUnableToComplete, loading: markingUnable, error: unableError } = useMarkDispatchUnableToComplete(dispatch?.dispatchId ?? '')
  const { addNote, loading: addingNote } = useAddFieldNote(dispatch?.reportId ?? '')

  const [showDecline, setShowDecline] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [showUnable, setShowUnable] = useState(false)
  const [unableReason, setUnableReason] = useState('')
  const [resolutionSummary, setResolutionSummary] = useState('')
  const [fieldNote, setFieldNote] = useState('')

  useEffect(() => {
    if (dispatch?.status === 'accepted') {
      void advance('acknowledged')
    }
  }, [dispatch?.status, advance])

  useEffect(() => {
    if (acceptError || declineError || advanceError || unableError) {
      void refresh()
    }
  }, [acceptError, declineError, advanceError, unableError, refresh])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <button className={styles.backBtn} onClick={() => void navigate('/')} aria-label="Back">←</button>
          <h1 className={styles.pageTitle}>Loading…</h1>
        </div>
      </div>
    )
  }

  if (dispatch?.terminalSurface === 'cancelled') return <CancelledScreen dispatch={dispatch} />
  if (error) return <div className={styles.page}><div className={styles.body}><p className={styles.errorMsg}>{error.message}</p></div></div>
  if (!dispatch) return <div className={styles.page}><div className={styles.body}><p>Dispatch not found.</p></div></div>
  if (dispatch.terminalSurface === 'race_loss' || getFirebaseErrorCode(acceptError) === 'functions/already-exists') {
    return <RaceLossScreen />
  }

  const isActive = ['accepted', 'acknowledged', 'en_route', 'on_scene'].includes(dispatch.status)
  const sevClass = report?.severity === 'high' ? styles.sevHigh :
                   report?.severity === 'medium' ? styles.sevMedium : styles.sevLow

  const mapsUrl = report?.publicLocation
    ? `https://maps.google.com/?q=${report.publicLocation.latitude},${report.publicLocation.longitude}`
    : null

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <button className={styles.backBtn} onClick={() => void navigate('/')} aria-label="Back">←</button>
        <h1 className={styles.pageTitle}>
          {REPORT_TYPE_LABEL[report?.reportType ?? ''] ?? 'Dispatch'}
        </h1>
        {isActive && (
          <Link to={`/dispatches/${dispatchId ?? ''}/sos`} style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', background: 'var(--color-danger)', borderRadius: '999px' }}>
            SOS
          </Link>
        )}
      </div>

      <div className={styles.body}>
        {/* Incident summary */}
        {report && (
          <div className={styles.incidentCard}>
            <h2 className={styles.incidentTitle}>
              {REPORT_TYPE_LABEL[report.reportType] ?? report.reportType}
              <span className={`${styles.severityBadge} ${sevClass}`}>{report.severity}</span>
            </h2>
            <div className={styles.incidentMeta}>
              <span>{report.municipalityLabel ?? report.municipalityId}{report.barangayId ? ` · ${report.barangayId}` : ''}</span>
              <span>Report #{dispatch.reportId.slice(0, 8)}</span>
            </div>
            {report.description && (
              <p className={styles.incidentDesc}>{report.description}</p>
            )}
          </div>
        )}

        {/* Navigate button */}
        {isActive && mapsUrl && (
          <div className={styles.navigateSection}>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={styles.navigateBtn}>
              🗺️ Navigate to Scene
            </a>
          </div>
        )}

        {/* Pending: Accept / Decline */}
        {dispatch.status === 'pending' && (
          <div className={styles.statusSection}>
            <p className={styles.statusTitle}>Action Required</p>
            <div className={styles.quickToggles}>
              <button
                className={`${styles.toggleBtn} ${styles.togglePrimary}`}
                onClick={() => void accept()}
                disabled={accepting}
              >
                {accepting ? 'Accepting…' : '✓ Accept'}
              </button>
              <button
                className={styles.toggleBtn}
                onClick={() => { setShowDecline((v) => !v) }}
              >
                ✕ Decline
              </button>
            </div>
            {showDecline && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <select
                  value={declineReason}
                  onChange={(e) => { setDeclineReason(e.target.value) }}
                  className={styles.textarea}
                  style={{ minHeight: 'unset', resize: 'none' }}
                >
                  <option value="">Select reason…</option>
                  {DECLINE_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button
                  className={styles.dangerBtn}
                  style={{ marginTop: 'var(--space-2)' }}
                  onClick={() => {
                    if (!declineReason) return
                    void decline(declineReason).catch((err: unknown) => {
                      console.error('[DispatchDetailPage] decline failed:', err)
                    })
                  }}
                  disabled={!declineReason || declining}
                >
                  {declining ? 'Declining…' : 'Confirm Decline'}
                </button>
              </div>
            )}
            {acceptError && <p className={styles.errorMsg}>{getActionErrorMessage(acceptError)}</p>}
            {declineError && <p className={styles.errorMsg}>{getActionErrorMessage(declineError)}</p>}
          </div>
        )}

        {/* Active: Quick status toggles */}
        {isActive && dispatch.status !== 'pending' && (
          <div className={styles.statusSection}>
            <p className={styles.statusTitle}>Status: {dispatch.uiStatus === 'heading_to_scene' ? 'En Route' : dispatch.uiStatus === 'on_scene' ? 'On Scene' : String(dispatch.uiStatus)}</p>
            {dispatch.status === 'accepted' && advanceError && !advanceLoading && (
              <button className={`${styles.toggleBtn} ${styles.togglePrimary}`} onClick={() => void advance('acknowledged')}>
                Retry acknowledgement
              </button>
            )}
            {dispatch.status === 'acknowledged' && (
              <div className={styles.quickToggles}>
                <button
                  className={`${styles.toggleBtn} ${styles.togglePrimary}`}
                  onClick={() => void advance('en_route')}
                  disabled={advanceLoading}
                >
                  📍 En Route
                </button>
              </div>
            )}
            {dispatch.status === 'en_route' && (
              <div className={styles.quickToggles}>
                <button
                  className={`${styles.toggleBtn} ${styles.togglePrimary}`}
                  onClick={() => void advance('on_scene')}
                  disabled={advanceLoading}
                >
                  🔧 On Scene
                </button>
              </div>
            )}
            {dispatch.status === 'on_scene' && (
              <div className={styles.resolutionForm}>
                <textarea
                  className={styles.textarea}
                  value={resolutionSummary}
                  onChange={(e) => { setResolutionSummary(e.target.value) }}
                  placeholder="Resolution summary (required)"
                  rows={3}
                />
                <button
                  className={`${styles.toggleBtn} ${styles.togglePrimary}`}
                  onClick={() => {
                    void advance('resolved', { resolutionSummary }).catch((err: unknown) => {
                      console.error('[DispatchDetailPage] resolve failed:', err)
                    })
                  }}
                  disabled={!resolutionSummary.trim() || advanceLoading}
                >
                  ✅ Mark Resolved
                </button>
              </div>
            )}
            {advanceError && <p className={styles.errorMsg}>{getActionErrorMessage(advanceError)}</p>}
          </div>
        )}

        {/* Actions: Backup, Messages, Unable to Complete */}
        {isActive && (
          <div className={styles.statusSection}>
            <p className={styles.statusTitle}>Actions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Link
                to={`/dispatches/${dispatchId ?? ''}/backup`}
                className={styles.navBtn}
              >
                🆘 Request Backup
              </Link>
              <Link
                to={`/messages/${dispatch.reportId}`}
                className={styles.navBtn}
              >
                💬 Message Admin
              </Link>
              <Link
                to={`/dispatches/${dispatchId ?? ''}/witness-report`}
                className={styles.navBtn}
              >
                📋 File Witness Report
              </Link>
              {!showUnable ? (
                <button
                  className={styles.dangerBtn}
                  onClick={() => { setShowUnable(true) }}
                >
                  Unable to Complete
                </button>
              ) : (
                <div>
                  <select
                    value={unableReason}
                    onChange={(e) => { setUnableReason(e.target.value) }}
                    className={styles.textarea}
                    style={{ minHeight: 'unset', resize: 'none' }}
                  >
                    <option value="">Select reason…</option>
                    <option value="Safety — scene conditions changed">Safety — scene conditions changed</option>
                    <option value="Medical — responder health issue">Medical — responder health issue</option>
                    <option value="Equipment failure">Equipment failure</option>
                    <option value="Jurisdiction conflict">Jurisdiction conflict</option>
                  </select>
                  <button
                    className={styles.dangerBtn}
                    style={{ marginTop: 'var(--space-2)' }}
                    onClick={() => {
                      if (!unableReason) return
                      void markUnableToComplete(unableReason).catch((err: unknown) => {
                        console.error('[DispatchDetailPage] unable-to-complete failed:', err)
                      })
                    }}
                    disabled={!unableReason || markingUnable}
                  >
                    {markingUnable ? 'Submitting…' : 'Submit — No Penalty'}
                  </button>
                  {unableError && <p className={styles.errorMsg}>{getActionErrorMessage(unableError)}</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Field note */}
        {isActive && (
          <div className={styles.statusSection}>
            <p className={styles.statusTitle}>Add Field Note</p>
            <div className={styles.fieldNoteForm}>
              <textarea
                className={styles.noteInput}
                value={fieldNote}
                onChange={(e) => { setFieldNote(e.target.value) }}
                placeholder="On scene. Water is waist-deep…"
                rows={2}
              />
              <button
                className={styles.noteSubmitBtn}
                disabled={!fieldNote.trim() || addingNote}
                onClick={() => {
                  void addNote(fieldNote).then(() => { setFieldNote('') }).catch((err: unknown) => {
                    console.error('[DispatchDetailPage] addNote failed:', err)
                  })
                }}
              >
                {addingNote ? 'Saving…' : 'Add Note'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Run all tests**

```bash
cd apps/responder-app && pnpm test && pnpm typecheck
```

Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add apps/responder-app/src/pages/DispatchDetailPage.tsx \
        apps/responder-app/src/pages/DispatchDetailPage.module.css \
        apps/responder-app/src/hooks/useAddFieldNote.ts \
        apps/responder-app/src/hooks/useAddFieldNote.test.ts
git commit -m "feat(responder-pwa): redesign dispatch detail with report info, quick toggles, field notes"
```

---

## Task 8: Messages Hooks

**Files:**

- Create: `apps/responder-app/src/hooks/useMessages.ts`
- Create: `apps/responder-app/src/hooks/useMessages.test.ts`
- Create: `apps/responder-app/src/hooks/useSendMessage.ts`
- Create: `apps/responder-app/src/hooks/useSendMessage.test.ts`

- [ ] **Step 1: Write useMessages test**

```typescript
// apps/responder-app/src/hooks/useMessages.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockOnSnapshot = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...segs) => ({ path: segs.join('/') })),
  query: vi.fn((...args) => args[0]),
  orderBy: vi.fn(),
  onSnapshot: mockOnSnapshot,
}))

import { useMessages } from './useMessages'

describe('useMessages', () => {
  it('returns sorted messages from snapshot', async () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        docs: [
          {
            id: 'msg-1',
            data: () => ({
              content: 'Hello from admin',
              senderRole: 'municipal_admin',
              senderDisplayName: 'Admin Santos',
              sentAt: { toMillis: () => 1700000000000 },
            }),
          },
        ],
      })
      return () => undefined
    })

    const { result } = renderHook(() => useMessages('report-1'))

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0]!.content).toBe('Hello from admin')
    })
  })

  it('returns empty when reportId is undefined', async () => {
    const { result } = renderHook(() => useMessages(undefined))
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(0)
      expect(result.current.loading).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
cd apps/responder-app && pnpm test src/hooks/useMessages.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create `useMessages.ts`**

```typescript
// apps/responder-app/src/hooks/useMessages.ts
import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface IncidentMessage {
  id: string
  content: string
  senderRole: string
  senderDisplayName: string
  sentAt: number
  photoUrl?: string
}

export function useMessages(reportId: string | undefined) {
  const [messages, setMessages] = useState<IncidentMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!reportId) {
      queueMicrotask(() => {
        setMessages([])
        setLoading(false)
      })
      return
    }

    const q = query(collection(db, 'reports', reportId, 'messages'), orderBy('sentAt', 'asc'))

    return onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map((d) => {
            const data = d.data()
            const sentAt =
              data.sentAt && typeof data.sentAt === 'object' && 'toMillis' in data.sentAt
                ? (data.sentAt as { toMillis: () => number }).toMillis()
                : Date.now()
            const msg: IncidentMessage = {
              id: d.id,
              content: String(data.content ?? ''),
              senderRole: String(data.senderRole ?? ''),
              senderDisplayName: String(data.senderDisplayName ?? 'Admin'),
              sentAt,
            }
            if (data.photoUrl) msg.photoUrl = String(data.photoUrl)
            return msg
          }),
        )
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[useMessages] listener error:', err)
        setError(err.message)
        setLoading(false)
      },
    )
  }, [reportId])

  return { messages, loading, error }
}
```

- [ ] **Step 4: Write useSendMessage test**

```typescript
// apps/responder-app/src/hooks/useSendMessage.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockAddDoc = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({ db: {}, auth: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...segs) => ({ path: segs.join('/') })),
  addDoc: mockAddDoc,
  serverTimestamp: () => ({ _type: 'serverTimestamp' }),
}))
vi.mock('../app/await-auth-token', () => ({
  awaitFreshAuthToken: () => Promise.resolve({ uid: 'uid-1' }),
}))

import { useSendMessage } from './useSendMessage'

describe('useSendMessage', () => {
  it('calls addDoc with message content', async () => {
    mockAddDoc.mockResolvedValue({ id: 'msg-1' })
    const { result } = renderHook(() => useSendMessage('report-1'))

    await act(async () => {
      await result.current.send('Water rising fast')
    })

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ content: 'Water rising fast', senderRole: 'responder' }),
    )
  })

  it('throws if content is empty', async () => {
    const { result } = renderHook(() => useSendMessage('report-1'))
    await expect(
      act(async () => {
        await result.current.send('  ')
      }),
    ).rejects.toThrow('content_required')
  })
})
```

- [ ] **Step 5: Create `useSendMessage.ts`**

```typescript
// apps/responder-app/src/hooks/useSendMessage.ts
import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../app/firebase'
import { awaitFreshAuthToken } from '../app/await-auth-token'

export function useSendMessage(reportId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()

  async function send(content: string): Promise<void> {
    const trimmed = content.trim()
    if (!trimmed) throw new Error('content_required')

    setLoading(true)
    setError(undefined)
    try {
      const user = await awaitFreshAuthToken(auth)
      if (!user) throw new Error('auth_required')
      await addDoc(collection(db, 'reports', reportId, 'messages'), {
        content: trimmed,
        senderUid: user.uid,
        senderRole: 'responder',
        senderDisplayName: 'Responder',
        sentAt: serverTimestamp(),
      })
    } catch (err: unknown) {
      const normalized = err instanceof Error ? err : new Error(String(err))
      setError(normalized)
      throw normalized
    } finally {
      setLoading(false)
    }
  }

  return { send, loading, error }
}
```

- [ ] **Step 6: Run all message hook tests**

```bash
cd apps/responder-app && pnpm test src/hooks/useMessages.test.ts src/hooks/useSendMessage.test.ts
```

Expected: All PASS

- [ ] **Step 7: Typecheck + commit**

```bash
cd apps/responder-app && pnpm typecheck && \
git add apps/responder-app/src/hooks/useMessages.ts \
        apps/responder-app/src/hooks/useMessages.test.ts \
        apps/responder-app/src/hooks/useSendMessage.ts \
        apps/responder-app/src/hooks/useSendMessage.test.ts
git commit -m "feat(responder-pwa): add useMessages and useSendMessage hooks"
```

---

## Task 9: Messages Page + Thread View

**Files:**

- Modify: `apps/responder-app/src/pages/MessagesPage.tsx`
- Create: `apps/responder-app/src/pages/MessagesPage.module.css`
- Modify: `apps/responder-app/src/pages/MessageThreadPage.tsx`
- Create: `apps/responder-app/src/pages/MessageThreadPage.module.css`

- [ ] **Step 1: Write MessagesPage test**

```typescript
// apps/responder-app/src/pages/MessagesPage.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@bantayog/shared-ui', () => ({ useAuth: () => ({ user: { uid: 'uid-1' } }) }))
vi.mock('../hooks/useOwnDispatches', () => ({
  useOwnDispatches: () => ({
    rows: [],
    groups: { active: [], pending: [] },
    error: null,
  }),
}))

import { MessagesPage } from './MessagesPage'

describe('MessagesPage', () => {
  it('shows empty state when no active dispatches', () => {
    render(<MemoryRouter><MessagesPage /></MemoryRouter>)
    expect(screen.getByText(/no active dispatches/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
cd apps/responder-app && pnpm test src/pages/MessagesPage.test.tsx
```

Expected: FAIL — empty state text not present yet

- [ ] **Step 3: Create `MessagesPage.module.css`**

```css
.page {
  padding: var(--space-4);
  max-width: 600px;
  margin: 0 auto;
}

.pageHeading {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0 0 var(--space-4) 0;
  color: var(--r-text);
}

.emptyState {
  text-align: center;
  padding: var(--space-8) 0;
  color: var(--color-text-muted);
}

.threadCard {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: #fff;
  border-radius: var(--radius-lg);
  border: 1.5px solid var(--r-border);
  text-decoration: none;
  color: inherit;
  margin-bottom: var(--space-3);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.12s;
}

.threadCard:hover {
  box-shadow: var(--shadow-md);
}

.threadIcon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.threadInfo {
  flex: 1;
  min-width: 0;
}

.threadTitle {
  font-size: var(--font-size-md);
  font-weight: 700;
  margin: 0 0 2px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.threadSub {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.threadArrow {
  color: var(--color-text-muted);
  font-size: 1.125rem;
}
```

- [ ] **Step 4: Rewrite `MessagesPage.tsx`**

```typescript
import { Link } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import styles from './MessagesPage.module.css'

export function MessagesPage() {
  const { user } = useAuth()
  const { groups } = useOwnDispatches(user?.uid)
  const allActive = [...groups.pending, ...groups.active]

  return (
    <div className={styles.page}>
      <h1 className={styles.pageHeading}>Messages</h1>
      {allActive.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No active dispatches — messages will appear here.</p>
        </div>
      ) : (
        allActive.map((row) => (
          <Link
            key={row.dispatchId}
            to={`/messages/${row.reportId}`}
            className={styles.threadCard}
          >
            <span className={styles.threadIcon}>💬</span>
            <div className={styles.threadInfo}>
              <h2 className={styles.threadTitle}>Incident #{row.reportId.slice(0, 8)}</h2>
              <span className={styles.threadSub}>
                {row.uiStatus === 'heading_to_scene' ? 'En Route' :
                 row.uiStatus === 'on_scene' ? 'On Scene' :
                 row.uiStatus === 'pending' ? 'Pending acceptance' : String(row.uiStatus ?? '')}
              </span>
            </div>
            <span className={styles.threadArrow}>›</span>
          </Link>
        ))
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create `MessageThreadPage.module.css`**

```css
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--r-surface);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--r-navy);
  color: #fff;
  flex-shrink: 0;
}

.backBtn {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.25rem;
  cursor: pointer;
}

.headerTitle {
  font-size: var(--font-size-md);
  font-weight: 700;
  margin: 0;
}

.messageList {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.bubble {
  max-width: 80%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.bubbleMine {
  align-self: flex-end;
  background: var(--r-navy);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.bubbleTheirs {
  align-self: flex-start;
  background: #fff;
  border: 1.5px solid var(--r-border);
  color: var(--r-text);
  border-bottom-left-radius: 4px;
}

.bubbleSender {
  font-size: 10px;
  font-weight: 700;
  opacity: 0.7;
  margin-bottom: 2px;
}

.bubbleTime {
  font-size: 10px;
  opacity: 0.6;
  margin-top: 2px;
  text-align: right;
}

.inputBar {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  background: #fff;
  border-top: 1px solid var(--r-border);
  flex-shrink: 0;
}

.msgInput {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  border: 1.5px solid var(--r-border);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  font-family: inherit;
  outline: none;
  resize: none;
  min-height: 44px;
  max-height: 120px;
}

.msgInput:focus {
  border-color: var(--r-navy);
}

.sendBtn {
  padding: 0 var(--space-4);
  background: var(--r-navy);
  color: #fff;
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  min-width: 60px;
}

.sendBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 6: Rewrite `MessageThreadPage.tsx`**

```typescript
import { useRef, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useMessages } from '../hooks/useMessages'
import { useSendMessage } from '../hooks/useSendMessage'
import styles from './MessageThreadPage.module.css'

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

export function MessageThreadPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { messages, loading } = useMessages(reportId)
  const { send, loading: sending } = useSendMessage(reportId ?? '')
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend() {
    const text = draft.trim()
    if (!text || !reportId) return
    setDraft('')
    try {
      await send(text)
    } catch (err: unknown) {
      console.error('[MessageThreadPage] send failed:', err)
      setDraft(text)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => void navigate(-1)} aria-label="Back">←</button>
        <h1 className={styles.headerTitle}>
          Incident #{reportId?.slice(0, 8) ?? ''}
        </h1>
      </div>

      <div className={styles.messageList} role="log" aria-live="polite" aria-label="Messages">
        {loading && <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</p>}
        {messages.map((msg) => {
          const isMine = msg.senderRole === 'responder'
          return (
            <div
              key={msg.id}
              className={isMine ? `${styles.bubble} ${styles.bubbleMine}` : `${styles.bubble} ${styles.bubbleTheirs}`}
            >
              {!isMine && (
                <div className={styles.bubbleSender}>{msg.senderDisplayName}</div>
              )}
              {msg.content}
              <div className={styles.bubbleTime}>{formatTime(msg.sentAt)}</div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputBar}>
        <textarea
          className={styles.msgInput}
          value={draft}
          onChange={(e) => { setDraft(e.target.value) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          placeholder="Type a message…"
          aria-label="Message input"
          rows={1}
        />
        <button
          className={styles.sendBtn}
          onClick={() => void handleSend()}
          disabled={!draft.trim() || sending || !user}
          aria-label="Send message"
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Run tests**

```bash
cd apps/responder-app && pnpm test src/pages/MessagesPage.test.tsx && pnpm typecheck
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/responder-app/src/pages/MessagesPage.tsx \
        apps/responder-app/src/pages/MessagesPage.module.css \
        apps/responder-app/src/pages/MessagesPage.test.tsx \
        apps/responder-app/src/pages/MessageThreadPage.tsx \
        apps/responder-app/src/pages/MessageThreadPage.module.css
git commit -m "feat(responder-pwa): implement messages tab and thread view"
```

---

## Task 10: Map Page

**Files:**

- Modify: `apps/responder-app/src/pages/MapPage.tsx`
- Create: `apps/responder-app/src/pages/MapPage.module.css`

- [ ] **Step 1: Write test**

```typescript
// apps/responder-app/src/pages/MapPage.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@bantayog/shared-ui', () => ({ useAuth: () => ({ user: { uid: 'uid-1' } }) }))
vi.mock('../hooks/useOwnDispatches', () => ({
  useOwnDispatches: () => ({ groups: { active: [], pending: [] }, rows: [], error: null }),
}))
vi.mock('../hooks/useReport', () => ({ useReport: () => ({ report: null, loading: false }) }))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ setView: vi.fn() }),
}))
vi.mock('leaflet', () => ({
  default: { icon: vi.fn(() => ({})) },
  icon: vi.fn(() => ({})),
}))

import { MapPage } from './MapPage'

describe('MapPage', () => {
  it('renders map container', () => {
    render(<MemoryRouter><MapPage /></MemoryRouter>)
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })

  it('shows legend', () => {
    render(<MemoryRouter><MapPage /></MemoryRouter>)
    expect(screen.getByText(/your location/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
cd apps/responder-app && pnpm test src/pages/MapPage.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Create `MapPage.module.css`**

```css
.page {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.mapContainer {
  flex: 1;
  z-index: 0;
}

.legend {
  position: absolute;
  bottom: var(--space-4);
  left: var(--space-4);
  background: rgba(255, 255, 255, 0.95);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  box-shadow: var(--shadow-md);
  z-index: 500;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.legendItem {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dotBlue {
  background: #3b82f6;
}
.dotRed {
  background: var(--color-danger);
}

.noLocation {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  text-align: center;
  box-shadow: var(--shadow-md);
  z-index: 500;
}
```

- [ ] **Step 4: Rewrite `MapPage.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import { useReport } from '../hooks/useReport'
import styles from './MapPage.module.css'

// Fix Leaflet default icon broken in Vite/Webpack
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

const incidentIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: 'incident-marker',
})

// Daet, Camarines Norte default center
const DEFAULT_CENTER: [number, number] = [14.1131, 122.9553]

interface Coords { lat: number; lng: number }

function MapFlyTo({ coords }: { coords: Coords | null }) {
  const map = useMap()
  useEffect(() => {
    if (coords) {
      map.setView([coords.lat, coords.lng], 15)
    }
  }, [coords, map])
  return null
}

function ActiveDispatchMarker({ reportId }: { reportId: string }) {
  const { report } = useReport(reportId)
  if (!report?.publicLocation) return null
  const { latitude: lat, longitude: lng } = report.publicLocation
  return (
    <Marker position={[lat, lng]} icon={incidentIcon}>
      <Popup>
        <strong>{report.reportType}</strong><br />
        {report.severity} severity<br />
        {report.municipalityLabel}
        {report.publicLocation && (
          <><br /><a
            href={`https://maps.google.com/?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >Navigate here</a></>
        )}
      </Popup>
    </Marker>
  )
}

export function MapPage() {
  const { user } = useAuth()
  const { groups } = useOwnDispatches(user?.uid)
  const [ownLocation, setOwnLocation] = useState<Coords | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setOwnLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => { console.warn('[MapPage] geolocation error:', err) },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    )
    return () => { navigator.geolocation.clearWatch(id) }
  }, [])

  const allActive = [...groups.pending, ...groups.active]

  return (
    <div className={styles.page}>
      <MapContainer
        center={ownLocation ? [ownLocation.lat, ownLocation.lng] : DEFAULT_CENTER}
        zoom={ownLocation ? 15 : 12}
        style={{ height: '100%', width: '100%' }}
        className={styles.mapContainer}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapFlyTo coords={ownLocation} />
        {ownLocation && (
          <Marker position={[ownLocation.lat, ownLocation.lng]} icon={defaultIcon}>
            <Popup>Your location</Popup>
          </Marker>
        )}
        {allActive.map((row) => (
          <ActiveDispatchMarker key={row.dispatchId} reportId={row.reportId} />
        ))}
      </MapContainer>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotBlue}`} aria-hidden="true" />
          <span>Your location</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotRed}`} aria-hidden="true" />
          <span>Incident pin</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/responder-app && pnpm test src/pages/MapPage.test.tsx && pnpm typecheck
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/responder-app/src/pages/MapPage.tsx \
        apps/responder-app/src/pages/MapPage.module.css \
        apps/responder-app/src/pages/MapPage.test.tsx
git commit -m "feat(responder-pwa): implement map tab with Leaflet + own location + incident pins"
```

---

## Task 11: Profile Hooks + Profile Page

**Files:**

- Create: `apps/responder-app/src/hooks/useResponderProfile.ts`
- Create: `apps/responder-app/src/hooks/useResponderProfile.test.ts`
- Create: `apps/responder-app/src/hooks/useDispatchHistory.ts`
- Create: `apps/responder-app/src/hooks/useDispatchHistory.test.ts`
- Modify: `apps/responder-app/src/pages/ProfilePage.tsx`
- Create: `apps/responder-app/src/pages/ProfilePage.module.css`

- [ ] **Step 1: Write useResponderProfile test**

```typescript
// apps/responder-app/src/hooks/useResponderProfile.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockOnSnapshot = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _col, id) => ({ id })),
  onSnapshot: mockOnSnapshot,
}))

import { useResponderProfile } from './useResponderProfile'

describe('useResponderProfile', () => {
  it('returns profile data from snapshot', async () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => true,
        data: () => ({
          displayName: 'Officer Juan Dela Cruz',
          responderType: 'fire',
          agencyId: 'daet-bfp',
          availabilityStatus: 'available',
        }),
      })
      return () => undefined
    })

    const { result } = renderHook(() => useResponderProfile('uid-1'))

    await waitFor(() => {
      expect(result.current.profile?.displayName).toBe('Officer Juan Dela Cruz')
      expect(result.current.profile?.responderType).toBe('fire')
    })
  })

  it('returns null when uid is undefined', async () => {
    const { result } = renderHook(() => useResponderProfile(undefined))
    await waitFor(() => {
      expect(result.current.profile).toBeNull()
      expect(result.current.loading).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Create `useResponderProfile.ts`**

```typescript
// apps/responder-app/src/hooks/useResponderProfile.ts
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface ResponderProfile {
  displayName: string
  responderType: string
  agencyId: string
  stationLabel?: string
  phone?: string
  availabilityStatus: string
  specializations?: string[]
}

export function useResponderProfile(uid: string | undefined) {
  const [profile, setProfile] = useState<ResponderProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) {
      queueMicrotask(() => {
        setProfile(null)
        setLoading(false)
      })
      return
    }

    const ref = doc(db, 'responders', uid)
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setProfile(null)
          setLoading(false)
          return
        }
        const d = snap.data()
        setProfile({
          displayName: String(d.displayName ?? 'Responder'),
          responderType: String(d.responderType ?? 'general'),
          agencyId: String(d.agencyId ?? ''),
          stationLabel: d.stationLabel ? String(d.stationLabel) : undefined,
          phone: d.phone ? String(d.phone) : undefined,
          availabilityStatus: String(d.availabilityStatus ?? 'available'),
          specializations: Array.isArray(d.specializations)
            ? (d.specializations as unknown[]).map(String)
            : undefined,
        })
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[useResponderProfile] listener error:', err)
        setError(err.message)
        setLoading(false)
      },
    )
  }, [uid])

  return { profile, loading, error }
}
```

- [ ] **Step 3: Run useResponderProfile test**

```bash
cd apps/responder-app && pnpm test src/hooks/useResponderProfile.test.ts
```

Expected: PASS

- [ ] **Step 4: Write useDispatchHistory test**

```typescript
// apps/responder-app/src/hooks/useDispatchHistory.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockOnSnapshot = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn((...args) => args[0]),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: mockOnSnapshot,
}))

import { useDispatchHistory } from './useDispatchHistory'

describe('useDispatchHistory', () => {
  it('returns past dispatches', async () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        docs: [
          {
            id: 'disp-1',
            data: () => ({
              reportId: 'rep-1',
              status: 'resolved',
              dispatchedAt: { toMillis: () => 1700000000000 },
              resolvedAt: { toMillis: () => 1700003600000 },
            }),
          },
        ],
      })
      return () => undefined
    })

    const { result } = renderHook(() => useDispatchHistory('uid-1'))

    await waitFor(() => {
      expect(result.current.history).toHaveLength(1)
      expect(result.current.history[0]!.status).toBe('resolved')
    })
  })
})
```

- [ ] **Step 5: Create `useDispatchHistory.ts`**

```typescript
// apps/responder-app/src/hooks/useDispatchHistory.ts
import { useEffect, useState } from 'react'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../app/firebase'
import type { DispatchStatus } from '@bantayog/shared-types'

const TERMINAL_STATUSES: DispatchStatus[] = [
  'resolved',
  'declined',
  'timed_out',
  'cancelled',
  'unable_to_complete',
]

export interface DispatchHistoryRow {
  dispatchId: string
  reportId: string
  status: DispatchStatus
  dispatchedAt: number
  resolvedAt?: number
}

export function useDispatchHistory(uid: string | undefined, maxRows = 20) {
  const [history, setHistory] = useState<DispatchHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) {
      queueMicrotask(() => {
        setHistory([])
        setLoading(false)
      })
      return
    }

    const q = query(
      collection(db, 'dispatches'),
      where('assignedTo.uid', '==', uid),
      where('status', 'in', TERMINAL_STATUSES),
      orderBy('dispatchedAt', 'desc'),
      limit(maxRows),
    )

    return onSnapshot(
      q,
      (snap) => {
        setHistory(
          snap.docs.map((d) => {
            const data = d.data()
            const toMs = (v: unknown): number | undefined => {
              if (typeof v === 'number') return v
              if (v && typeof v === 'object' && 'toMillis' in v)
                return (v as { toMillis: () => number }).toMillis()
              return undefined
            }
            const row: DispatchHistoryRow = {
              dispatchId: d.id,
              reportId: String(data.reportId),
              status: data.status as DispatchStatus,
              dispatchedAt: toMs(data.dispatchedAt) ?? 0,
            }
            const resolved = toMs(data.resolvedAt)
            if (resolved != null) row.resolvedAt = resolved
            return row
          }),
        )
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[useDispatchHistory] listener error:', err)
        setError(err.message)
        setLoading(false)
      },
    )
  }, [uid, maxRows])

  return { history, loading, error }
}
```

- [ ] **Step 6: Run both history tests**

```bash
cd apps/responder-app && pnpm test src/hooks/useDispatchHistory.test.ts src/hooks/useResponderProfile.test.ts
```

Expected: All PASS

- [ ] **Step 7: Create `ProfilePage.module.css`**

```css
.page {
  padding: var(--space-4);
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.profileCard {
  background: var(--r-navy);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  color: #fff;
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  flex-shrink: 0;
}

.profileInfo {
  flex: 1;
  min-width: 0;
}

.profileName {
  font-size: var(--font-size-md);
  font-weight: 700;
  margin: 0 0 2px 0;
}

.profileRole {
  font-size: var(--font-size-sm);
  opacity: 0.8;
  margin: 0;
}

.section {
  background: #fff;
  border-radius: var(--radius-lg);
  border: 1.5px solid var(--r-border);
  overflow: hidden;
}

.sectionHeader {
  padding: var(--space-3) var(--space-4);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--r-border);
  background: #fafafa;
}

.sectionBody {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.availabilityRow {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.statusDot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dotGreen {
  background: var(--color-success);
}
.dotAmber {
  background: var(--color-warning);
}
.dotRed {
  background: var(--color-danger);
}
.dotGray {
  background: #9ca3af;
}

.statusLabel {
  font-weight: 700;
  font-size: var(--font-size-md);
  flex: 1;
}

.statusSelect {
  padding: var(--space-2) var(--space-3);
  border: 1.5px solid var(--r-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-family: inherit;
  background: #fff;
  cursor: pointer;
}

.reasonInput {
  padding: var(--space-3);
  border: 1.5px solid var(--r-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-family: inherit;
  width: 100%;
  outline: none;
}

.updateBtn {
  padding: 10px var(--space-4);
  background: var(--r-navy);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  align-self: flex-start;
}

.updateBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.errorMsg {
  padding: var(--space-3);
  background: #fee2e2;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}

.statsGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.statBox {
  background: #f8fafc;
  border-radius: var(--radius-md);
  padding: var(--space-3);
  text-align: center;
}

.statValue {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--r-navy);
  display: block;
}

.statLabel {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.actionLink {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  color: var(--r-text);
  text-decoration: none;
  font-size: var(--font-size-sm);
  font-weight: 600;
  border-bottom: 1px solid var(--r-border);
}

.actionLink:last-child {
  border-bottom: none;
}

.actionLink:hover {
  background: #f8fafc;
}

.signOutBtn {
  width: 100%;
  padding: 14px;
  background: #fff;
  border: 1.5px solid var(--color-danger);
  border-radius: var(--radius-md);
  color: var(--color-danger);
  font-size: var(--font-size-md);
  font-weight: 700;
  cursor: pointer;
}
```

- [ ] **Step 8: Rewrite `ProfilePage.tsx`**

```typescript
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useResponderProfile } from '../hooks/useResponderProfile'
import { useResponderAvailability } from '../hooks/useResponderAvailability'
import { useDispatchHistory } from '../hooks/useDispatchHistory'
import styles from './ProfilePage.module.css'

const RESPONDER_TYPE_LABEL: Record<string, string> = {
  police: 'Police', fire: 'Fire', medical: 'Medical',
  engineering: 'Engineering', sar: 'Search & Rescue',
  social_welfare: 'Social Welfare', general: 'General',
}

const UNAVAILABLE_REASONS = ['On break', 'In meeting', 'On another call', 'Other']
const OFF_DUTY_REASONS = ['Shift ended', 'Sick leave', 'Training', 'Day off', 'Other']

export function ProfilePage() {
  const { user, signOut } = useAuth()
  const { profile } = useResponderProfile(user?.uid)
  const { status: availStatus, setAvailability } = useResponderAvailability(user?.uid)
  const { history } = useDispatchHistory(user?.uid)

  const [selectedStatus, setSelectedStatus] = useState<'available' | 'unavailable' | 'off_duty'>('available')
  const [reason, setReason] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const resolvedCount = history.filter((h) => h.status === 'resolved').length
  const totalCount = history.length

  const dotClass =
    availStatus === 'available' ? styles.dotGreen :
    availStatus === 'unavailable' ? styles.dotAmber :
    availStatus === 'off_duty' ? styles.dotRed : styles.dotGray

  async function handleStatusUpdate() {
    setStatusError(null)
    if (selectedStatus !== 'available' && !reason.trim()) {
      setStatusError('Reason is required.')
      return
    }
    setStatusSaving(true)
    try {
      await setAvailability(selectedStatus, selectedStatus !== 'available' ? reason.trim() : undefined)
      setReason('')
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setStatusSaving(false)
    }
  }

  const reasonOptions = selectedStatus === 'unavailable' ? UNAVAILABLE_REASONS : OFF_DUTY_REASONS

  return (
    <div className={styles.page}>
      {/* Profile header */}
      <div className={styles.profileCard}>
        <div className={styles.avatar}>👤</div>
        <div className={styles.profileInfo}>
          <h1 className={styles.profileName}>{profile?.displayName ?? 'Responder'}</h1>
          <p className={styles.profileRole}>
            {RESPONDER_TYPE_LABEL[profile?.responderType ?? ''] ?? 'General'} Responder
            {profile?.stationLabel ? ` · ${profile.stationLabel}` : ''}
          </p>
        </div>
      </div>

      {/* Availability */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>Availability</div>
        <div className={styles.sectionBody}>
          <div className={styles.availabilityRow}>
            <span className={`${styles.statusDot} ${dotClass}`} aria-hidden="true" />
            <span className={styles.statusLabel}>
              {availStatus === 'available' ? 'Available for dispatch' :
               availStatus === 'unavailable' ? 'Unavailable' :
               availStatus === 'off_duty' ? 'Off Duty' : 'Unknown'}
            </span>
            <select
              className={styles.statusSelect}
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value as typeof selectedStatus) }}
              aria-label="Set availability status"
            >
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
              <option value="off_duty">Off Duty</option>
            </select>
          </div>
          {selectedStatus !== 'available' && (
            <select
              className={styles.reasonInput}
              value={reason}
              onChange={(e) => { setReason(e.target.value) }}
              aria-label="Reason"
            >
              <option value="">Select reason…</option>
              {reasonOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
          {statusError && <p className={styles.errorMsg}>{statusError}</p>}
          <button
            className={styles.updateBtn}
            onClick={() => void handleStatusUpdate()}
            disabled={statusSaving}
          >
            {statusSaving ? 'Saving…' : 'Update Status'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>Your Performance (Recent)</div>
        <div className={styles.sectionBody}>
          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <span className={styles.statValue}>{totalCount}</span>
              <span className={styles.statLabel}>Total Dispatches</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statValue}>{resolvedCount}</span>
              <span className={styles.statLabel}>Resolved</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statValue}>
                {totalCount > 0 ? `${Math.round((resolvedCount / totalCount) * 100)}%` : '—'}
              </span>
              <span className={styles.statLabel}>Completion Rate</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className={styles.section}>
        <Link to="/history" className={styles.actionLink}>
          View Dispatch History
          <span>›</span>
        </Link>
        <Link to="/handoff" className={styles.actionLink}>
          Start Shift Handoff
          <span>›</span>
        </Link>
      </div>

      {/* Sign out */}
      <button
        className={styles.signOutBtn}
        onClick={() => void signOut().catch((err: unknown) => {
          console.error('[ProfilePage] sign out failed:', err)
        })}
      >
        Sign Out
      </button>
    </div>
  )
}
```

- [ ] **Step 9: Run all tests + typecheck**

```bash
cd apps/responder-app && pnpm test && pnpm typecheck
```

Expected: All pass

- [ ] **Step 10: Commit**

```bash
git add apps/responder-app/src/hooks/useResponderProfile.ts \
        apps/responder-app/src/hooks/useResponderProfile.test.ts \
        apps/responder-app/src/hooks/useDispatchHistory.ts \
        apps/responder-app/src/hooks/useDispatchHistory.test.ts \
        apps/responder-app/src/pages/ProfilePage.tsx \
        apps/responder-app/src/pages/ProfilePage.module.css
git commit -m "feat(responder-pwa): implement profile tab with availability, stats, and history link"
```

---

## Task 12: Remaining Pages — Handoff, History, and Styled Secondary Pages

**Files:**

- Modify: `apps/responder-app/src/pages/ShiftHandoffPage.tsx`
- Modify: `apps/responder-app/src/pages/DispatchHistoryPage.tsx`
- Modify: `apps/responder-app/src/pages/SosPage.tsx`
- Modify: `apps/responder-app/src/pages/BackupRequestPage.tsx`
- Modify: `apps/responder-app/src/pages/CancelledScreen.tsx`
- Modify: `apps/responder-app/src/pages/RaceLossScreen.tsx`

- [ ] **Step 1: Write ShiftHandoffPage test**

```typescript
// apps/responder-app/src/pages/ShiftHandoffPage.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../app/firebase', () => ({ functions: {} }))
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => vi.fn()) }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

import { ShiftHandoffPage } from './ShiftHandoffPage'

describe('ShiftHandoffPage', () => {
  it('renders handoff form', () => {
    render(<MemoryRouter><ShiftHandoffPage /></MemoryRouter>)
    expect(screen.getByText(/shift handoff/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/target responder/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rewrite `ShiftHandoffPage.tsx`** (extract the handoff logic from DispatchListPage)

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'

export function ShiftHandoffPage() {
  const navigate = useNavigate()
  const [targetUid, setTargetUid] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!targetUid.trim() || !reason.trim()) {
      setError('Target responder UID and reason are required.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const fn = httpsCallable<
        { toUid: string; reason: string; idempotencyKey: string },
        { success: boolean }
      >(functions, 'initiateResponderHandoff')
      await fn({ toUid: targetUid.trim(), reason: reason.trim(), idempotencyKey: crypto.randomUUID() })
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Handoff failed.')
    } finally {
      setLoading(false)
    }
  }

  const pageStyle = {
    minHeight: '100vh',
    background: 'var(--r-surface)',
  }

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-4)',
    background: 'var(--r-navy)',
    color: '#fff',
  }

  const bodyStyle = {
    padding: 'var(--space-4)',
    maxWidth: '500px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-4)',
  }

  if (done) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <button style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.25rem', cursor: 'pointer' }} onClick={() => void navigate('/profile')} aria-label="Back">←</button>
          <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Shift Handoff</h1>
        </div>
        <div style={{ ...bodyStyle, textAlign: 'center', paddingTop: 'var(--space-8)' }}>
          <p style={{ fontSize: '2rem' }}>✅</p>
          <p style={{ fontWeight: 700 }}>Handoff submitted successfully.</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            The incoming responder will be notified.
          </p>
          <button style={{ padding: '12px 24px', background: 'var(--r-navy)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }} onClick={() => void navigate('/profile')}>
            Back to Profile
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <button style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.25rem', cursor: 'pointer' }} onClick={() => void navigate('/profile')} aria-label="Back">←</button>
        <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Shift Handoff</h1>
      </div>
      <form style={bodyStyle} onSubmit={(e) => void handleSubmit(e)}>
        <div style={{ background: '#fff', borderRadius: '12px', padding: 'var(--space-4)', border: '1.5px solid var(--r-border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <label htmlFor="handoff-target" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Target Responder UID</label>
            <input
              id="handoff-target"
              type="text"
              value={targetUid}
              onChange={(e) => { setTargetUid(e.target.value) }}
              placeholder="Incoming responder's UID"
              required
              style={{ padding: '12px', border: '1.5px solid var(--r-border)', borderRadius: '8px', fontSize: 'var(--font-size-sm)', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <label htmlFor="handoff-reason" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Handoff Notes</label>
            <textarea
              id="handoff-reason"
              value={reason}
              onChange={(e) => { setReason(e.target.value) }}
              placeholder="Patient at Brgy. San Jose needs follow-up. Truck is fueled."
              rows={4}
              required
              style={{ padding: '12px', border: '1.5px solid var(--r-border)', borderRadius: '8px', fontSize: 'var(--font-size-sm)', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>
          {error && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ padding: '12px', background: 'var(--r-navy)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
            {loading ? 'Submitting…' : 'Submit Handoff'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite `DispatchHistoryPage.tsx`**

```typescript
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useDispatchHistory } from '../hooks/useDispatchHistory'

export function DispatchHistoryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { history, loading } = useDispatchHistory(user?.uid)

  const statusLabel: Record<string, string> = {
    resolved: '✅ Resolved',
    declined: '✗ Declined',
    timed_out: '⏱ Timed Out',
    cancelled: '✗ Cancelled',
    unable_to_complete: '⚠ Unable to Complete',
  }

  const bodyStyle = {
    padding: 'var(--space-4)',
    maxWidth: '600px',
    margin: '0 auto',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--r-surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)', background: 'var(--r-navy)', color: '#fff' }}>
        <button style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.25rem', cursor: 'pointer' }} onClick={() => void navigate('/profile')} aria-label="Back">←</button>
        <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Dispatch History</h1>
      </div>
      <div style={bodyStyle}>
        {loading && <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: 'var(--space-8)' }}>Loading…</p>}
        {!loading && history.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: 'var(--space-8)' }}>No completed dispatches yet.</p>
        )}
        {history.map((row) => (
          <div key={row.dispatchId} style={{ background: '#fff', borderRadius: '12px', padding: 'var(--space-4)', border: '1.5px solid var(--r-border)', marginBottom: 'var(--space-3)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>
              {statusLabel[row.status] ?? row.status}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              Report #{row.reportId.slice(0, 8)} · {new Date(row.dispatchedAt).toLocaleDateString('en-PH')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Style `SosPage.tsx`**

Replace plain HTML with:

```typescript
import { useParams, useNavigate } from 'react-router-dom'
import { useTriggerSOS } from '../hooks/useTriggerSOS'

export function SosPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { trigger, loading, error } = useTriggerSOS(id ?? '')

  if (!id) return <div role="alert" style={{ padding: '2rem' }}>Invalid route: dispatch ID is missing.</div>

  async function handleConfirm() {
    try {
      await trigger()
      void navigate(`/dispatches/${id}`)
    } catch (err: unknown) {
      console.error('[SosPage] triggerSOS failed:', err)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#b31b1b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: '#fff', textAlign: 'center' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🆘</div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>SOS ACTIVATION</h1>
      <p style={{ maxWidth: '300px', opacity: 0.9, marginBottom: '2rem', lineHeight: 1.6 }}>
        This will send an emergency signal to all admins in your municipality and agency.
      </p>
      {error && (
        <p role="alert" aria-live="assertive" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.75rem 1.5rem', marginBottom: '1rem' }}>
          Unable to trigger SOS. Please try again.
        </p>
      )}
      <button
        onClick={() => void handleConfirm()}
        disabled={loading}
        style={{ padding: '16px 40px', background: '#fff', color: '#b31b1b', border: 'none', borderRadius: '999px', fontWeight: 800, fontSize: '1.125rem', cursor: 'pointer', marginBottom: '1rem', minWidth: '200px' }}
      >
        {loading ? 'Sending…' : 'Confirm SOS'}
      </button>
      <button
        onClick={() => void navigate(`/dispatches/${id}`)}
        disabled={loading}
        style={{ padding: '12px 32px', background: 'transparent', color: '#fff', border: '2px solid rgba(255,255,255,0.6)', borderRadius: '999px', fontWeight: 600, cursor: 'pointer' }}
      >
        Cancel
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Style `CancelledScreen.tsx`**

```typescript
import type { DispatchDoc } from '../hooks/useDispatch'
import { useNavigate } from 'react-router-dom'

interface Props { dispatch: DispatchDoc }

export function CancelledScreen({ dispatch: _dispatch }: Props) {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: 'var(--r-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✕</div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Dispatch Cancelled</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>This dispatch has been cancelled by the admin.</p>
      <button onClick={() => void navigate('/')} style={{ padding: '12px 32px', background: 'var(--r-navy)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
        Back to Dispatches
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Style `RaceLossScreen.tsx`**

```typescript
import { useNavigate } from 'react-router-dom'

export function RaceLossScreen() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: 'var(--r-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚡</div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Dispatch Already Claimed</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>Another responder accepted this dispatch first. Stand by for the next one.</p>
      <button onClick={() => void navigate('/')} style={{ padding: '12px 32px', background: 'var(--r-navy)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
        Back to Dispatches
      </button>
    </div>
  )
}
```

- [ ] **Step 7: Run ShiftHandoffPage test + full suite**

```bash
cd apps/responder-app && pnpm test src/pages/ShiftHandoffPage.test.tsx && pnpm test && pnpm typecheck
```

Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add apps/responder-app/src/pages/ShiftHandoffPage.tsx \
        apps/responder-app/src/pages/ShiftHandoffPage.test.tsx \
        apps/responder-app/src/pages/DispatchHistoryPage.tsx \
        apps/responder-app/src/pages/SosPage.tsx \
        apps/responder-app/src/pages/BackupRequestPage.tsx \
        apps/responder-app/src/pages/CancelledScreen.tsx \
        apps/responder-app/src/pages/RaceLossScreen.tsx
git commit -m "feat(responder-pwa): style secondary pages and implement shift handoff + dispatch history"
```

---

## Task 13: Final Lint + Typecheck Pass

- [ ] **Step 1: Run full test suite**

```bash
cd apps/responder-app && pnpm test
```

Expected: All tests pass, no failures.

- [ ] **Step 2: Run typecheck**

```bash
cd apps/responder-app && pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Run lint**

```bash
cd apps/responder-app && pnpm lint
```

Expected: 0 errors. Fix any reported issues before continuing.

- [ ] **Step 4: Verify build**

```bash
cd apps/responder-app && pnpm build
```

Expected: Build succeeds, emits `dist/` with no errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(responder-pwa): complete frontend implementation — shell, dispatch, messages, map, profile"
```

---

## Self-Review

**Spec Coverage Check:**

| Spec Section                      | Implemented In                     |
| --------------------------------- | ---------------------------------- |
| 4-tab layout (§3.1)               | Task 2 Shell                       |
| SOS hold button (§4.1)            | Task 2 SosHoldButton               |
| Dispatch countdown (§3.2)         | Task 6 AcceptanceCountdown         |
| Accept/Decline dispatch (§4.2)    | Task 7 DispatchDetailPage          |
| Dispatch state machine (§5.1–5.6) | Task 7 DispatchDetailPage          |
| Request Backup (§5.7)             | Task 7 (link to BackupRequestPage) |
| Unable to complete (§5.6)         | Task 7 DispatchDetailPage          |
| GPS map (§3.3)                    | Task 10 MapPage                    |
| Admin messaging (§7.1)            | Tasks 8–9                          |
| Shift handoff (§9.1)              | Task 12 ShiftHandoffPage           |
| Verified witness report (§8.2)    | Pre-existing (not redesigned here) |
| Availability status (§6.1)        | Task 11 ProfilePage                |
| Performance metrics (§10.1)       | Task 11 ProfilePage (from history) |
| PWA manifest                      | Task 1                             |

**Gaps identified:**

- Performance metrics via callable (§10.1) — ProfilePage shows local stats from dispatch history instead of server-calculated metrics. Acceptable for MVP; callable can be added in a follow-up.
- `Navigate` link in map opens Google Maps rather than an in-app route view — matches spec (§3.3 says "[Navigate] button opens native maps app").
- `BackupRequestPage` and `ResponderWitnessReportPage` keep existing functionality, restyling was scoped to Task 12 for BackupRequest but not WitnessReport — minimal: add inline styles to WitnessReportPage in Task 12 if time permits.

**Placeholder scan:** None found — all steps contain actual code.

**Type consistency:** All hooks return `{data, loading, error}` pattern consistently. `useReport` → `ReportSummary`, `useMessages` → `IncidentMessage[]`, `useResponderProfile` → `ResponderProfile`, `useDispatchHistory` → `DispatchHistoryRow[]`. No cross-task naming conflicts found.
