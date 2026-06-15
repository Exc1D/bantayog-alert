# Sentry Error Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production-grade Sentry error monitoring to all 4 surfaces (citizen-pwa, admin-desktop, responder-app, Cloud Functions) with PII scrubbing, React 19 error hooks, and sourcemap upload.

**Architecture:** Each app initializes Sentry independently at its entry point, gated behind the existing emulator env flags. Frontend apps use `@sentry/react` with `reactErrorHandler` wired into `createRoot` plus `ErrorBoundary` for render errors; Cloud Functions use `@sentry/node` with `skipOpenTelemetrySetup: true` to avoid OTel conflicts with Cloud Run. All frontends ship a `sentry-utils.ts` per-app (not shared) with `stripPii`, `stripPiiFromObject`, and `redactPiiFromString` to scrub RA 10173-sensitive fields from both event payloads and breadcrumbs.

**Tech Stack:** `@sentry/react ^10`, `@sentry/vite-plugin`, `@sentry/node`, Vite 8, React 19, Firebase Cloud Functions v2, Vitest

---

## File Map

| File                                                    | Action | Notes                                                       |
| ------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| `apps/citizen-pwa/package.json`                         | Modify | Add `@sentry/react`, `@sentry/vite-plugin`                  |
| `apps/citizen-pwa/vite.config.ts`                       | Modify | Add Sentry plugin                                           |
| `apps/citizen-pwa/src/sentry-utils.ts`                  | Create | PII scrubbing helpers                                       |
| `apps/citizen-pwa/src/__tests__/sentry-utils.test.ts`   | Create | Unit tests                                                  |
| `apps/citizen-pwa/src/main.tsx`                         | Modify | Sentry.init + createRoot hooks + ErrorBoundary              |
| `apps/citizen-pwa/.env.staging.example`                 | Modify | Add Sentry env keys                                         |
| `apps/admin-desktop/package.json`                       | Modify | Add `@sentry/vite-plugin` (`@sentry/react` already present) |
| `apps/admin-desktop/vite.config.ts`                     | Modify | Add Sentry plugin                                           |
| `apps/admin-desktop/src/sentry-utils.ts`                | Create | PII scrubbing helpers (same logic, separate copy)           |
| `apps/admin-desktop/src/__tests__/sentry-utils.test.ts` | Create | Unit tests                                                  |
| `apps/admin-desktop/src/main.tsx`                       | Modify | Sentry.init + createRoot hooks + ErrorBoundary              |
| `apps/admin-desktop/.env.staging.example`               | Modify | Add Sentry env keys                                         |
| `apps/responder-app/package.json`                       | Modify | Add `@sentry/react`, `@sentry/vite-plugin`                  |
| `apps/responder-app/vite.config.ts`                     | Modify | Add Sentry plugin                                           |
| `apps/responder-app/src/sentry-utils.ts`                | Create | PII scrubbing helpers                                       |
| `apps/responder-app/src/sentry-utils.test.ts`           | Create | Unit tests (co-located, no `__tests__` dir in this app)     |
| `apps/responder-app/src/main.tsx`                       | Modify | Sentry.init + createRoot hooks + ErrorBoundary              |
| `apps/responder-app/src/main.test.ts`                   | Modify | Add Sentry mocks to existing stylesheet test                |
| `apps/responder-app/.env.staging.example`               | Modify | Add Sentry env keys                                         |
| `functions/package.json`                                | Modify | Add `@sentry/node`                                          |
| `functions/src/index.ts`                                | Modify | Sentry.init at top                                          |
| `functions/.env.staging.example`                        | Create | Sentry env keys for functions                               |

---

## Task 1: Install packages

**Files:**

- Modify: `apps/citizen-pwa/package.json`
- Modify: `apps/admin-desktop/package.json`
- Modify: `apps/responder-app/package.json`
- Modify: `functions/package.json`

- [ ] **Step 1.1: Add @sentry/react and @sentry/vite-plugin to citizen-pwa**

```bash
pnpm --dir apps/citizen-pwa add @sentry/react
pnpm --dir apps/citizen-pwa add -D @sentry/vite-plugin
```

Expected: packages added, lockfile updated.

- [ ] **Step 1.2: Add @sentry/vite-plugin to admin-desktop (@sentry/react already installed)**

```bash
pnpm --dir apps/admin-desktop add -D @sentry/vite-plugin
```

Expected: package added.

- [ ] **Step 1.3: Add @sentry/react and @sentry/vite-plugin to responder-app**

```bash
pnpm --dir apps/responder-app add @sentry/react
pnpm --dir apps/responder-app add -D @sentry/vite-plugin
```

Expected: packages added.

- [ ] **Step 1.4: Add @sentry/node to functions**

```bash
pnpm --dir functions add @sentry/node
```

Expected: package added.

- [ ] **Step 1.5: Commit**

```bash
git add apps/citizen-pwa/package.json apps/admin-desktop/package.json apps/responder-app/package.json functions/package.json pnpm-lock.yaml
git commit -m "chore: add sentry packages to all apps and functions"
```

---

## Task 2: citizen-pwa — sentry-utils (TDD)

**Files:**

- Create: `apps/citizen-pwa/src/__tests__/sentry-utils.test.ts`
- Create: `apps/citizen-pwa/src/sentry-utils.ts`

- [ ] **Step 2.1: Write the failing test**

Create `apps/citizen-pwa/src/__tests__/sentry-utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Event } from '@sentry/react'
import { stripPii, stripPiiFromObject, redactPiiFromString } from '../sentry-utils.js'

describe('stripPiiFromObject', () => {
  it('deletes known PII keys in-place', () => {
    const obj: Record<string, unknown> = {
      reporterUid: 'uid123',
      fcmToken: 'tok',
      email: 'x@y.com',
      phone: '09171234567',
      contactInfo: 'call me',
      reporterName: 'Juan',
      safe: 'keep',
    }
    stripPiiFromObject(obj)
    expect(obj).toEqual({ safe: 'keep' })
  })

  it('leaves objects with no PII keys unchanged', () => {
    const obj: Record<string, unknown> = { reportType: 'fire', severity: 'high' }
    stripPiiFromObject(obj)
    expect(obj).toEqual({ reportType: 'fire', severity: 'high' })
  })
})

describe('redactPiiFromString', () => {
  it('redacts 28-char alphanumeric Firebase UID tokens', () => {
    const uid = 'abcdefghijklmnopqrstuvwxyz12' // exactly 28 chars
    const result = redactPiiFromString(`uid is ${uid}`)
    expect(result).not.toContain(uid)
    expect(result).toContain('[redacted]')
  })

  it('returns strings without UID-shaped tokens unchanged', () => {
    expect(redactPiiFromString('report type: fire')).toBe('report type: fire')
  })
})

describe('stripPii', () => {
  it('strips PII keys from event.extra', () => {
    const event: Event = { extra: { reporterUid: 'uid123', safe: 'ok' } }
    stripPii(event)
    expect(event.extra).toEqual({ safe: 'ok' })
  })

  it('strips PII keys from event.request.data', () => {
    const event: Event = { request: { data: { email: 'x@y.com', reportType: 'fire' } } }
    stripPii(event)
    expect(event.request?.data as Record<string, unknown>).toEqual({ reportType: 'fire' })
  })

  it('strips PII keys from each context in event.contexts', () => {
    const event: Event = {
      contexts: { custom: { phone: '09171234567', id: 1 } },
    }
    stripPii(event)
    expect(event.contexts?.['custom']).toEqual({ id: 1 })
  })

  it('returns the same event object', () => {
    const event: Event = {}
    expect(stripPii(event)).toBe(event)
  })

  it('does not throw when event fields are absent', () => {
    expect(() => stripPii({})).not.toThrow()
  })
})
```

- [ ] **Step 2.2: Run test — confirm it fails**

```bash
pnpm --dir apps/citizen-pwa exec vitest run src/__tests__/sentry-utils.test.ts
```

Expected: FAIL — `Cannot find module '../sentry-utils.js'`

- [ ] **Step 2.3: Implement sentry-utils.ts**

Create `apps/citizen-pwa/src/sentry-utils.ts`:

```ts
import type { Event } from '@sentry/react'

const PII_KEYS = new Set([
  'reporterUid',
  'fcmToken',
  'email',
  'phone',
  'contactInfo',
  'reporterName',
])

// Matches Firebase UID shape: exactly 28 alphanumeric chars at a word boundary.
// Shallow scan only — does not recurse into nested objects.
const UID_PATTERN = /\b[A-Za-z0-9]{28}\b/g

export function stripPiiFromObject(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (PII_KEYS.has(key)) {
      delete obj[key]
    }
  }
}

export function redactPiiFromString(msg: string): string {
  return msg.replace(UID_PATTERN, '[redacted]')
}

export function stripPii(event: Event): Event {
  if (event.extra && typeof event.extra === 'object') {
    stripPiiFromObject(event.extra as Record<string, unknown>)
  }
  if (event.contexts && typeof event.contexts === 'object') {
    for (const ctx of Object.values(event.contexts)) {
      if (ctx && typeof ctx === 'object') {
        stripPiiFromObject(ctx as Record<string, unknown>)
      }
    }
  }
  if (event.request?.data && typeof event.request.data === 'object') {
    stripPiiFromObject(event.request.data as Record<string, unknown>)
  }
  return event
}
```

- [ ] **Step 2.4: Run test — confirm it passes**

```bash
pnpm --dir apps/citizen-pwa exec vitest run src/__tests__/sentry-utils.test.ts
```

Expected: PASS — 9 tests

- [ ] **Step 2.5: Typecheck and lint**

```bash
pnpm --dir apps/citizen-pwa exec tsc --noEmit
pnpm --dir apps/citizen-pwa exec eslint src/sentry-utils.ts src/__tests__/sentry-utils.test.ts
```

Expected: no errors.

- [ ] **Step 2.6: Commit**

```bash
git add apps/citizen-pwa/src/sentry-utils.ts apps/citizen-pwa/src/__tests__/sentry-utils.test.ts
git commit -m "feat(citizen-pwa): add sentry-utils PII scrubbing helpers"
```

---

## Task 3: citizen-pwa — wiring (main.tsx + vite.config.ts + env example)

**Files:**

- Modify: `apps/citizen-pwa/src/main.tsx`
- Modify: `apps/citizen-pwa/vite.config.ts`
- Modify: `apps/citizen-pwa/.env.staging.example`

- [ ] **Step 3.1: Replace apps/citizen-pwa/src/main.tsx**

The file currently calls `createRoot(rootEl).render(...)`. Replace it with the version below, which adds Sentry init (gated on the existing `VITE_USE_EMULATOR` flag), wires `reactErrorHandler` into `createRoot`, wraps the tree in `ErrorBoundary`, and keeps all existing SW registration and install-prompt code intact.

`__APP_VERSION__` is a global string already declared in `src/vite-env.d.ts` and defined in `vite.config.ts`. `VITE_SENTRY_DSN` and `VITE_SENTRY_ENVIRONMENT` are new Vite env vars added in Step 3.3.

```tsx
import 'leaflet/dist/leaflet.css'
import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import { QueryProvider } from './lib/QueryProvider.js'
import { initializeQueryClient } from './lib/query-client.js'
import { stripPii, stripPiiFromObject, redactPiiFromString } from './sentry-utils.js'
import './styles/globals.css'

const isEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'
if (!isEmulator && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? 'production',
    release: __APP_VERSION__,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    initialScope: { tags: { app: 'citizen-pwa' } },
    beforeSend(event) {
      return stripPii(event)
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) stripPiiFromObject(breadcrumb.data as Record<string, unknown>)
      if (breadcrumb.message) breadcrumb.message = redactPiiFromString(breadcrumb.message)
      return breadcrumb
    },
  })
}

await initializeQueryClient()

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element not found')

createRoot(rootEl, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppCrashFallback />}>
      <QueryProvider>
        <App />
      </QueryProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

function AppCrashFallback() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Something went wrong.</p>
      <button onClick={() => window.location.reload()}>Reload</button>
    </div>
  )
}

if ('serviceWorker' in navigator) {
  async function registerSW(attemptsLeft = 3): Promise<void> {
    try {
      await navigator.serviceWorker.register('/sw.js')
    } catch (err: unknown) {
      const attempt = 4 - attemptsLeft
      console.error(`SW registration failed (attempt ${String(attempt)}/3):`, err)
      if (attemptsLeft > 1) {
        await new Promise<void>((r) => {
          setTimeout(r, attempt * 1000)
        })
        return registerSW(attemptsLeft - 1)
      }
      window.dispatchEvent(new CustomEvent('sw-registration-failed'))
    }
  }
  window.addEventListener('load', () => {
    void registerSW()
  })
}

/* ── PWA install prompt ── */
window.deferredInstallPrompt = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.deferredInstallPrompt = e as BeforeInstallPromptEvent
})

window.addEventListener('appinstalled', () => {
  window.deferredInstallPrompt = null
})
```

- [ ] **Step 3.2: Update apps/citizen-pwa/vite.config.ts**

The only change is adding the `sentryVitePlugin` import and the conditional plugin entry. Everything else stays identical.

```ts
import { defineConfig, loadEnv } from 'vite'
import { assertNoEmulatorInProduction } from '../../scripts/assert-no-emulator.mjs'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const rawEmulator = process.env.VITE_USE_EMULATOR ?? env.VITE_USE_EMULATOR
  assertNoEmulatorInProduction(command, mode, rawEmulator, 'citizen')

  return {
    plugins: [
      react(),
      ...(process.env.SENTRY_AUTH_TOKEN
        ? [
            sentryVitePlugin({
              org: 'bantayog-alert',
              project: 'bantayog-alert',
              release: { name: process.env.npm_package_version ?? '0.0.0' },
              sourcemaps: { filesToDeleteAfterUpload: '**/*.map' },
            }),
          ]
        : []),
    ],
    server: { port: 5173 },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'firebase'
              if (id.includes('leaflet') || id.includes('react-leaflet')) return 'map'
              if (id.includes('framer-motion')) return 'animation'
              if (id.includes('lucide-react')) return 'icons'
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router'))
                return 'react-vendor'
              return 'vendor'
            }
          },
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
  }
})
```

- [ ] **Step 3.3: Add Sentry keys to apps/citizen-pwa/.env.staging.example**

Append the following two lines to the end of the existing file (after `VITE_USE_EMULATOR=false`):

```
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=staging
```

- [ ] **Step 3.4: Typecheck and run tests**

```bash
pnpm --dir apps/citizen-pwa exec tsc --noEmit
pnpm --dir apps/citizen-pwa exec vitest run
```

Expected: typecheck passes, all existing tests pass (515+ tests).

- [ ] **Step 3.5: Commit**

```bash
git add apps/citizen-pwa/src/main.tsx apps/citizen-pwa/vite.config.ts apps/citizen-pwa/.env.staging.example
git commit -m "feat(citizen-pwa): wire Sentry init, createRoot hooks, and ErrorBoundary"
```

---

## Task 4: admin-desktop — sentry-utils (TDD)

**Files:**

- Create: `apps/admin-desktop/src/__tests__/sentry-utils.test.ts`
- Create: `apps/admin-desktop/src/sentry-utils.ts`

- [ ] **Step 4.1: Write the failing test**

Create `apps/admin-desktop/src/__tests__/sentry-utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Event } from '@sentry/react'
import { stripPii, stripPiiFromObject, redactPiiFromString } from '../sentry-utils'

describe('stripPiiFromObject', () => {
  it('deletes known PII keys in-place', () => {
    const obj: Record<string, unknown> = {
      reporterUid: 'uid123',
      fcmToken: 'tok',
      email: 'x@y.com',
      phone: '09171234567',
      contactInfo: 'call me',
      reporterName: 'Juan',
      safe: 'keep',
    }
    stripPiiFromObject(obj)
    expect(obj).toEqual({ safe: 'keep' })
  })

  it('leaves objects with no PII keys unchanged', () => {
    const obj: Record<string, unknown> = { reportType: 'fire', severity: 'high' }
    stripPiiFromObject(obj)
    expect(obj).toEqual({ reportType: 'fire', severity: 'high' })
  })
})

describe('redactPiiFromString', () => {
  it('redacts 28-char alphanumeric Firebase UID tokens', () => {
    const uid = 'abcdefghijklmnopqrstuvwxyz12' // exactly 28 chars
    const result = redactPiiFromString(`uid is ${uid}`)
    expect(result).not.toContain(uid)
    expect(result).toContain('[redacted]')
  })

  it('returns strings without UID-shaped tokens unchanged', () => {
    expect(redactPiiFromString('report type: fire')).toBe('report type: fire')
  })
})

describe('stripPii', () => {
  it('strips PII keys from event.extra', () => {
    const event: Event = { extra: { reporterUid: 'uid123', safe: 'ok' } }
    stripPii(event)
    expect(event.extra).toEqual({ safe: 'ok' })
  })

  it('strips PII keys from event.request.data', () => {
    const event: Event = { request: { data: { email: 'x@y.com', reportType: 'fire' } } }
    stripPii(event)
    expect(event.request?.data as Record<string, unknown>).toEqual({ reportType: 'fire' })
  })

  it('strips PII keys from each context in event.contexts', () => {
    const event: Event = {
      contexts: { custom: { phone: '09171234567', id: 1 } },
    }
    stripPii(event)
    expect(event.contexts?.['custom']).toEqual({ id: 1 })
  })

  it('returns the same event object', () => {
    const event: Event = {}
    expect(stripPii(event)).toBe(event)
  })

  it('does not throw when event fields are absent', () => {
    expect(() => stripPii({})).not.toThrow()
  })
})
```

- [ ] **Step 4.2: Run test — confirm it fails**

```bash
pnpm --dir apps/admin-desktop exec vitest run src/__tests__/sentry-utils.test.ts
```

Expected: FAIL — `Cannot find module '../sentry-utils'`

- [ ] **Step 4.3: Implement sentry-utils.ts**

Create `apps/admin-desktop/src/sentry-utils.ts`:

```ts
import type { Event } from '@sentry/react'

const PII_KEYS = new Set([
  'reporterUid',
  'fcmToken',
  'email',
  'phone',
  'contactInfo',
  'reporterName',
])

// Matches Firebase UID shape: exactly 28 alphanumeric chars at a word boundary.
// Shallow scan only — does not recurse into nested objects.
const UID_PATTERN = /\b[A-Za-z0-9]{28}\b/g

export function stripPiiFromObject(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (PII_KEYS.has(key)) {
      delete obj[key]
    }
  }
}

export function redactPiiFromString(msg: string): string {
  return msg.replace(UID_PATTERN, '[redacted]')
}

export function stripPii(event: Event): Event {
  if (event.extra && typeof event.extra === 'object') {
    stripPiiFromObject(event.extra as Record<string, unknown>)
  }
  if (event.contexts && typeof event.contexts === 'object') {
    for (const ctx of Object.values(event.contexts)) {
      if (ctx && typeof ctx === 'object') {
        stripPiiFromObject(ctx as Record<string, unknown>)
      }
    }
  }
  if (event.request?.data && typeof event.request.data === 'object') {
    stripPiiFromObject(event.request.data as Record<string, unknown>)
  }
  return event
}
```

- [ ] **Step 4.4: Run test — confirm it passes**

```bash
pnpm --dir apps/admin-desktop exec vitest run src/__tests__/sentry-utils.test.ts
```

Expected: PASS — 9 tests

- [ ] **Step 4.5: Typecheck and lint**

```bash
pnpm --dir apps/admin-desktop exec tsc --noEmit
pnpm --dir apps/admin-desktop exec eslint src/sentry-utils.ts src/__tests__/sentry-utils.test.ts
```

Expected: no errors.

- [ ] **Step 4.6: Commit**

```bash
git add apps/admin-desktop/src/sentry-utils.ts apps/admin-desktop/src/__tests__/sentry-utils.test.ts
git commit -m "feat(admin-desktop): add sentry-utils PII scrubbing helpers"
```

---

## Task 5: admin-desktop — wiring (main.tsx + vite.config.ts + env example)

**Files:**

- Modify: `apps/admin-desktop/src/main.tsx`
- Modify: `apps/admin-desktop/vite.config.ts`
- Modify: `apps/admin-desktop/.env.staging.example`

- [ ] **Step 5.1: Replace apps/admin-desktop/src/main.tsx**

The existing file is 13 lines. Replace entirely:

```tsx
import './styles/design-tokens.css'
import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.js'
import { stripPii, stripPiiFromObject, redactPiiFromString } from './sentry-utils.js'

const isEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'
if (!isEmulator && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? 'production',
    release: __APP_VERSION__,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    initialScope: { tags: { app: 'admin-desktop' } },
    beforeSend(event) {
      return stripPii(event)
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) stripPiiFromObject(breadcrumb.data as Record<string, unknown>)
      if (breadcrumb.message) breadcrumb.message = redactPiiFromString(breadcrumb.message)
      return breadcrumb
    },
  })
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element not found')

createRoot(rootEl, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppCrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

function AppCrashFallback() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Something went wrong.</p>
      <button onClick={() => window.location.reload()}>Reload</button>
    </div>
  )
}
```

- [ ] **Step 5.2: Update apps/admin-desktop/vite.config.ts**

```ts
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import { assertNoEmulatorInProduction } from '../../scripts/assert-no-emulator.mjs'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const rawEmulator = process.env.VITE_USE_EMULATOR ?? env.VITE_USE_EMULATOR
  assertNoEmulatorInProduction(command, mode, rawEmulator, 'admin')

  return {
    plugins: [
      react(),
      ...(process.env.SENTRY_AUTH_TOKEN
        ? [
            sentryVitePlugin({
              org: 'bantayog-alert',
              project: 'bantayog-alert',
              release: { name: process.env.npm_package_version ?? '0.0.0' },
              sourcemaps: { filesToDeleteAfterUpload: '**/*.map' },
            }),
          ]
        : []),
    ],
    server: { port: 5175 },
    build: {
      outDir: 'dist',
      sourcemap: true,
      cssMinify: 'esbuild',
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-router')) {
              return 'vendor'
            }
            if (id.includes('node_modules/firebase')) {
              return 'firebase'
            }
          },
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
```

- [ ] **Step 5.3: Add Sentry keys to apps/admin-desktop/.env.staging.example**

Append after `VITE_USE_EMULATOR=false`:

```
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=staging
```

- [ ] **Step 5.4: Typecheck and run tests**

```bash
pnpm --dir apps/admin-desktop exec tsc --noEmit
pnpm --dir apps/admin-desktop exec vitest run
```

Expected: typecheck passes, all existing tests pass (562+).

- [ ] **Step 5.5: Commit**

```bash
git add apps/admin-desktop/src/main.tsx apps/admin-desktop/vite.config.ts apps/admin-desktop/.env.staging.example
git commit -m "feat(admin-desktop): wire Sentry init, createRoot hooks, and ErrorBoundary"
```

---

## Task 6: responder-app — sentry-utils (TDD)

**Files:**

- Create: `apps/responder-app/src/sentry-utils.test.ts` (co-located — this app keeps tests alongside source)
- Create: `apps/responder-app/src/sentry-utils.ts`

- [ ] **Step 6.1: Write the failing test**

Create `apps/responder-app/src/sentry-utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Event } from '@sentry/react'
import { stripPii, stripPiiFromObject, redactPiiFromString } from './sentry-utils'

describe('stripPiiFromObject', () => {
  it('deletes known PII keys in-place', () => {
    const obj: Record<string, unknown> = {
      reporterUid: 'uid123',
      fcmToken: 'tok',
      email: 'x@y.com',
      phone: '09171234567',
      contactInfo: 'call me',
      reporterName: 'Juan',
      safe: 'keep',
    }
    stripPiiFromObject(obj)
    expect(obj).toEqual({ safe: 'keep' })
  })

  it('leaves objects with no PII keys unchanged', () => {
    const obj: Record<string, unknown> = { reportType: 'fire', severity: 'high' }
    stripPiiFromObject(obj)
    expect(obj).toEqual({ reportType: 'fire', severity: 'high' })
  })
})

describe('redactPiiFromString', () => {
  it('redacts 28-char alphanumeric Firebase UID tokens', () => {
    const uid = 'abcdefghijklmnopqrstuvwxyz12' // exactly 28 chars
    const result = redactPiiFromString(`uid is ${uid}`)
    expect(result).not.toContain(uid)
    expect(result).toContain('[redacted]')
  })

  it('returns strings without UID-shaped tokens unchanged', () => {
    expect(redactPiiFromString('report type: fire')).toBe('report type: fire')
  })
})

describe('stripPii', () => {
  it('strips PII keys from event.extra', () => {
    const event: Event = { extra: { reporterUid: 'uid123', safe: 'ok' } }
    stripPii(event)
    expect(event.extra).toEqual({ safe: 'ok' })
  })

  it('strips PII keys from event.request.data', () => {
    const event: Event = { request: { data: { email: 'x@y.com', reportType: 'fire' } } }
    stripPii(event)
    expect(event.request?.data as Record<string, unknown>).toEqual({ reportType: 'fire' })
  })

  it('strips PII keys from each context in event.contexts', () => {
    const event: Event = {
      contexts: { custom: { phone: '09171234567', id: 1 } },
    }
    stripPii(event)
    expect(event.contexts?.['custom']).toEqual({ id: 1 })
  })

  it('returns the same event object', () => {
    const event: Event = {}
    expect(stripPii(event)).toBe(event)
  })

  it('does not throw when event fields are absent', () => {
    expect(() => stripPii({})).not.toThrow()
  })
})
```

- [ ] **Step 6.2: Run test — confirm it fails**

```bash
pnpm --dir apps/responder-app exec vitest run src/sentry-utils.test.ts
```

Expected: FAIL — `Cannot find module './sentry-utils'`

- [ ] **Step 6.3: Implement sentry-utils.ts**

Create `apps/responder-app/src/sentry-utils.ts`:

```ts
import type { Event } from '@sentry/react'

const PII_KEYS = new Set([
  'reporterUid',
  'fcmToken',
  'email',
  'phone',
  'contactInfo',
  'reporterName',
])

// Matches Firebase UID shape: exactly 28 alphanumeric chars at a word boundary.
// Shallow scan only — does not recurse into nested objects.
const UID_PATTERN = /\b[A-Za-z0-9]{28}\b/g

export function stripPiiFromObject(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (PII_KEYS.has(key)) {
      delete obj[key]
    }
  }
}

export function redactPiiFromString(msg: string): string {
  return msg.replace(UID_PATTERN, '[redacted]')
}

export function stripPii(event: Event): Event {
  if (event.extra && typeof event.extra === 'object') {
    stripPiiFromObject(event.extra as Record<string, unknown>)
  }
  if (event.contexts && typeof event.contexts === 'object') {
    for (const ctx of Object.values(event.contexts)) {
      if (ctx && typeof ctx === 'object') {
        stripPiiFromObject(ctx as Record<string, unknown>)
      }
    }
  }
  if (event.request?.data && typeof event.request.data === 'object') {
    stripPiiFromObject(event.request.data as Record<string, unknown>)
  }
  return event
}
```

- [ ] **Step 6.4: Run test — confirm it passes**

```bash
pnpm --dir apps/responder-app exec vitest run src/sentry-utils.test.ts
```

Expected: PASS — 9 tests

- [ ] **Step 6.5: Typecheck and lint**

```bash
pnpm --dir apps/responder-app exec tsc --noEmit
pnpm --dir apps/responder-app exec eslint src/sentry-utils.ts src/sentry-utils.test.ts
```

Expected: no errors.

- [ ] **Step 6.6: Commit**

```bash
git add apps/responder-app/src/sentry-utils.ts apps/responder-app/src/sentry-utils.test.ts
git commit -m "feat(responder-app): add sentry-utils PII scrubbing helpers"
```

---

## Task 7: responder-app — wiring (main.tsx + main.test.ts + vite.config.ts + env example)

**Files:**

- Modify: `apps/responder-app/src/main.test.ts`
- Modify: `apps/responder-app/src/main.tsx`
- Modify: `apps/responder-app/vite.config.ts`
- Modify: `apps/responder-app/.env.staging.example`

- [ ] **Step 7.1: Update apps/responder-app/src/main.test.ts**

The existing test uses `vi.doMock` and `vi.resetModules()` to intercept all imports. It must mock `@sentry/react` and `./sentry-utils.js` before the `await import('./main')` call, otherwise the new imports in main.tsx will fail to resolve. Replace the file entirely:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('main stylesheet imports', () => {
  beforeEach(() => {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
  })

  it('imports globals before design tokens', async () => {
    const importOrder: string[] = []
    const renderRoot = vi.fn()

    vi.resetModules()
    vi.doMock('@sentry/react', () => ({
      init: vi.fn(),
      reactErrorHandler: vi.fn(() => vi.fn()),
      ErrorBoundary: ({ children }: { children: unknown }) => children,
    }))
    vi.doMock('./sentry-utils.js', () => ({
      stripPii: vi.fn((e: unknown) => e),
      stripPiiFromObject: vi.fn(),
      redactPiiFromString: vi.fn((s: string) => s),
    }))
    vi.doMock('./styles/design-tokens.css', () => {
      importOrder.push('design-tokens.css')
      return {}
    })
    vi.doMock('./styles/globals.css', () => {
      importOrder.push('globals.css')
      return {}
    })
    vi.doMock('react-dom/client', () => ({
      createRoot: () => ({ render: renderRoot }),
    }))
    vi.doMock('./App.js', () => ({
      default: () => null,
    }))

    await import('./main')

    expect(importOrder).toEqual(['globals.css', 'design-tokens.css'])
    expect(renderRoot).toHaveBeenCalled()
  })
})
```

- [ ] **Step 7.2: Run main.test.ts — confirm it still passes before touching main.tsx**

```bash
pnpm --dir apps/responder-app exec vitest run src/main.test.ts
```

Expected: PASS — 1 test

- [ ] **Step 7.3: Replace apps/responder-app/src/main.tsx**

```tsx
import { StrictMode } from 'react'
import * as Sentry from '@sentry/react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import './styles/design-tokens.css'
import App from './App.js'
import { stripPii, stripPiiFromObject, redactPiiFromString } from './sentry-utils.js'

const isEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'
if (!isEmulator && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? 'production',
    release: __APP_VERSION__,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    initialScope: { tags: { app: 'responder-app' } },
    beforeSend(event) {
      return stripPii(event)
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) stripPiiFromObject(breadcrumb.data as Record<string, unknown>)
      if (breadcrumb.message) breadcrumb.message = redactPiiFromString(breadcrumb.message)
      return breadcrumb
    },
  })
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element not found')

createRoot(rootEl, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppCrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

function AppCrashFallback() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Something went wrong.</p>
      <button onClick={() => window.location.reload()}>Reload</button>
    </div>
  )
}
```

- [ ] **Step 7.4: Run main.test.ts again to confirm it still passes with updated main.tsx**

```bash
pnpm --dir apps/responder-app exec vitest run src/main.test.ts
```

Expected: PASS — 1 test

- [ ] **Step 7.5: Update apps/responder-app/vite.config.ts**

```ts
import { defineConfig, loadEnv } from 'vite'
import { assertNoEmulatorInProduction } from '../../scripts/assert-no-emulator.mjs'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const rawEmulator = process.env.VITE_USE_EMULATOR ?? env.VITE_USE_EMULATOR
  assertNoEmulatorInProduction(command, mode, rawEmulator, 'responder')

  return {
    plugins: [
      react(),
      ...(process.env.SENTRY_AUTH_TOKEN
        ? [
            sentryVitePlugin({
              org: 'bantayog-alert',
              project: 'bantayog-alert',
              release: { name: process.env.npm_package_version ?? '0.0.0' },
              sourcemaps: { filesToDeleteAfterUpload: '**/*.map' },
            }),
          ]
        : []),
    ],
    server: { port: 5174 },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) {
              return 'leaflet'
            }
            if (id.includes('node_modules/firebase')) {
              return 'firebase'
            }
          },
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
      // Expose firebase config env vars to the service worker scope.
      // The SW file reads import.meta.env.VITE_FIREBASE_* directly.
    },
    // Service worker is in /public — Vite copies it to /dist as-is.
  }
})
```

- [ ] **Step 7.6: Add Sentry keys to apps/responder-app/.env.staging.example**

Append after `VITE_USE_EMULATOR=false`:

```
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=staging
```

- [ ] **Step 7.7: Typecheck and run full suite**

```bash
pnpm --dir apps/responder-app exec tsc --noEmit
pnpm --dir apps/responder-app exec vitest run
```

Expected: typecheck passes, all existing tests pass.

- [ ] **Step 7.8: Commit**

```bash
git add apps/responder-app/src/main.tsx apps/responder-app/src/main.test.ts apps/responder-app/vite.config.ts apps/responder-app/.env.staging.example
git commit -m "feat(responder-app): wire Sentry init, createRoot hooks, and ErrorBoundary"
```

---

## Task 8: Cloud Functions — Sentry init

**Files:**

- Modify: `functions/src/index.ts`
- Create: `functions/.env.staging.example`

**Context:** `functions/src/index.ts` is a pure re-export barrel. In ESM, static `import` statements are hoisted and evaluated before module-level code. `Sentry.init()` therefore executes after all callable modules have been imported but before any HTTP request is handled — the cold start completes full initialization before Cloud Functions serves any request. `skipOpenTelemetrySetup: true` avoids conflict with Cloud Run's built-in Cloud Trace OTel integration.

- [ ] **Step 8.1: Add Sentry import and init block to functions/src/index.ts**

Open `functions/src/index.ts`. The file begins with:

```ts
// Cloud Functions v2 entry point.
export { setStaffClaims, suspendStaffAccount } from './domains/users/account-lifecycle.js'
```

Prepend the following block before that first line. Do not change anything else:

```ts
import * as Sentry from '@sentry/node'

if (!process.env.FUNCTIONS_EMULATOR && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? 'production',
    tracesSampleRate: 0,
    skipOpenTelemetrySetup: true,
    initialScope: { tags: { app: 'functions' } },
  })
}

// Cloud Functions v2 entry point.
export { setStaffClaims, suspendStaffAccount } from './domains/users/account-lifecycle.js'
// ... (rest of file unchanged)
```

- [ ] **Step 8.2: Create functions/.env.staging.example**

```
# Staging environment — Cloud Functions
# Copy to .env.staging and fill in values.
# DO NOT commit .env.staging (it is gitignored).

SENTRY_DSN=
SENTRY_ENVIRONMENT=staging
```

- [ ] **Step 8.3: Typecheck and lint**

```bash
pnpm --dir functions exec tsc --noEmit
pnpm --dir functions exec eslint src/index.ts
```

Expected: no errors. (The known `engines.node` Node 20/22 mismatch warning from `pnpm build` is unrelated and expected; it does not appear in `tsc --noEmit`.)

- [ ] **Step 8.4: Commit**

```bash
git add functions/src/index.ts functions/.env.staging.example
git commit -m "feat(functions): add Sentry init with skipOpenTelemetrySetup"
```

---

## Task 9: Verify Sentry org/project slugs (manual)

The Vite plugin uses `org: 'bantayog-alert'` and `project: 'bantayog-alert'` as likely defaults. Verify before the first CI build or sourcemaps will upload to the wrong project.

- [ ] **Step 9.1: Confirm org slug** — visit `https://sentry.io/organizations/` and read the URL slug. If different from `bantayog-alert`, update `org:` in all three `vite.config.ts` files.

- [ ] **Step 9.2: Confirm project slug** — visit your Sentry project page. If different from `bantayog-alert`, update `project:` in all three files.

- [ ] **Step 9.3: Commit slug corrections if needed**

```bash
git add apps/citizen-pwa/vite.config.ts apps/admin-desktop/vite.config.ts apps/responder-app/vite.config.ts
git commit -m "fix: correct Sentry org/project slugs in vite configs"
```

---

## Task 10: Smoke verification

- [ ] **Step 10.1: Confirm Sentry is silent in emulator mode**

```bash
pnpm dev
```

Open the browser Network tab on `http://localhost:5173`. Filter by `ingest.us.sentry.io`. Confirm zero requests. Expected: none — the `VITE_USE_EMULATOR=true` gate suppresses Sentry.init.

- [ ] **Step 10.2: Confirm vite build is not broken (no sourcemap upload without token)**

```bash
pnpm --dir apps/citizen-pwa exec vite build --mode staging
```

Expected: build succeeds, `dist/` contains `.map` files (plugin is skipped — no `SENTRY_AUTH_TOKEN` in local env). No upload occurs, so maps are not deleted.

- [ ] **Step 10.3: Confirm functions build**

```bash
pnpm --dir functions run build
```

Expected: exits 0.

- [ ] **Step 10.4: Full monorepo gate**

```bash
pnpm test && pnpm typecheck && pnpm lint
```

Expected: all pass.
