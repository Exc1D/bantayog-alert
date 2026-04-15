# Plan 7 — Error Boundaries, Staging Env, Service Worker Update Strategy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Small polish items from spec §4.5, §10.2, §10.3. Layered error boundaries (root/role/panel), separate staging Firebase project with deploy pipeline, non-blocking service worker update banner with emergency force-update.

**Tech Stack:** React error boundaries, Firebase Hosting preview channels, Workbox.

---

## File Map

| File | Responsibility |
|---|---|
| `src/app/ErrorBoundary.tsx` *(new)* | Root boundary |
| `src/shared/components/RoleErrorBoundary.tsx` *(new)* | Per-role boundary |
| `src/shared/components/PanelErrorBoundary.tsx` *(new)* | Panel-level boundary |
| `src/app/App.tsx` | Wrap tree with root boundary |
| `src/domains/*/layouts/*.tsx` | Wrap each layout with RoleErrorBoundary |
| `.firebaserc` | Add staging project alias |
| `.github/workflows/deploy.yml` *(new or edit)* | Stage → prod pipeline |
| `public/sw.js` (or Workbox config) | Update flow |
| `src/shared/components/UpdateBanner.tsx` *(new)* | "Update available" toast |

---

## Task 1: Root `ErrorBoundary`

- [ ] **Step 1: Failing test** — throwing child renders fallback + "Reload" button that calls `location.reload`.

- [ ] **Step 2: Implement**

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { hasError: boolean; error?: Error }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[APP_ERROR_BOUNDARY]', crypto.randomUUID?.(), error, info.componentStack)
  }
  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div role="alert" className="p-6 max-w-md mx-auto">
        <h1>Something went wrong</h1>
        <p>{this.state.error?.message}</p>
        <button onClick={() => location.reload()}>Reload app</button>
      </div>
    )
  }
}
```

- [ ] **Step 3:** Wrap `<App />`. Commit.

---

## Task 2: `RoleErrorBoundary` + `PanelErrorBoundary`

Same pattern, props `{ roleName }` / `{ panelName }`, renders scoped fallback. Test: panel crash does not unmount sibling panels.

- [ ] Implement both. Wrap each role's layout with `RoleErrorBoundary`. Wrap each major admin panel with `PanelErrorBoundary`. Commit.

---

## Task 3: Staging Firebase project

- [ ] **Step 1:** Create project `bantayog-alert-staging` in Firebase console (user action).

- [ ] **Step 2: Update `.firebaserc`**

```json
{
  "projects": {
    "default": "bantayog-alert-dev",
    "dev": "bantayog-alert-dev",
    "staging": "bantayog-alert-staging",
    "prod": "bantayog-alert-prod"
  }
}
```

- [ ] **Step 3:** Copy Firestore rules + indexes + RTDB rules to staging:
```bash
firebase deploy --only firestore,database --project staging
```

- [ ] **Step 4:** Commit `.firebaserc`.

---

## Task 4: CI pipeline stage → prod

**Files:** `.github/workflows/deploy.yml`

- [ ] **Step 1:** Pipeline: on merge to `main`, build → deploy to staging → run E2E (Playwright against staging) → manual approval → deploy to prod.

```yaml
name: deploy
on: { push: { branches: [main] } }
jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run typecheck && npm test -- --run
      - run: npm run build
      - run: npx firebase-tools deploy --project staging --token ${{ secrets.FIREBASE_TOKEN }}
      - run: npm run test:e2e:staging
  deploy-prod:
    needs: deploy-staging
    environment: production   # GitHub manual approval
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - run: npx firebase-tools deploy --project prod --token ${{ secrets.FIREBASE_TOKEN }}
```

- [ ] **Step 2:** Add secret `FIREBASE_TOKEN` (CI-generated via `firebase login:ci`).
- [ ] **Step 3:** Commit.

---

## Task 5: SW update banner

**Files:** Modify SW registration (likely `src/main.tsx`); create `UpdateBanner.tsx`

- [ ] **Step 1: Failing component test** — when `newWorker.state === 'installed'` event fires, banner renders.

- [ ] **Step 2: Register SW with update listener**

```typescript
// src/main.tsx or app init
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing
      if (!nw) return
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent('sw-update-available', { detail: reg }))
        }
      })
    })
  })
}
```

- [ ] **Step 3: Banner component**

```tsx
export function UpdateBanner() {
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null)
  useEffect(() => {
    const h = (e: Event) => setReg((e as CustomEvent).detail)
    window.addEventListener('sw-update-available', h)
    return () => window.removeEventListener('sw-update-available', h)
  }, [])
  if (!reg) return null
  return (
    <div role="status" className="fixed bottom-4 inset-x-4 bg-blue-600 text-white p-3 rounded">
      Update available.
      <button className="ml-2 underline" onClick={() => {
        reg.waiting?.postMessage({ type: 'SKIP_WAITING' })
        location.reload()
      }}>Update now</button>
    </div>
  )
}
```

- [ ] **Step 4: SW `skipWaiting` on message**
```js
self.addEventListener('message', (e) => { if (e.data?.type === 'SKIP_WAITING') self.skipWaiting() })
```

- [ ] **Step 5: Force update during declared emergency** — on SW activate, fetch `/api/system-flags` or Firestore `system_config/emergency`; if active AND installed SW older than deployed, call `skipWaiting()` without user prompt.

- [ ] **Step 6:** Tests + commit.

## Self-Review

§4.5 error boundaries at 3 levels. §10.2 three envs. §10.3 SW update flow with emergency override. No placeholders.
