# Sentry Error Monitoring — Design Spec

**Date:** 2026-06-14  
**Status:** Approved  
**Scope:** All 4 surfaces — citizen-pwa, admin-desktop, responder-app, Cloud Functions

---

## Goal

Add production-grade error monitoring across the full Bantayog Alert incident lifecycle so silent failures in any surface are surfaced in Sentry rather than discovered during a real emergency.

---

## Architecture

Four independent Sentry callsites, one Sentry project, events tagged by app surface for dashboard filtering.

```
citizen-pwa/src/main.tsx       → @sentry/react   (gated: VITE_USE_EMULATOR !== 'true')
admin-desktop/src/main.tsx     → @sentry/react   (gated: VITE_USE_EMULATOR !== 'true')
responder-app/src/main.tsx     → @sentry/react   (gated: VITE_USE_EMULATOR !== 'true')
functions/src/index.ts         → @sentry/node    (gated: FUNCTIONS_EMULATOR !== 'true')
```

Each init tags events with `initialScope: { tags: { app: '<surface>' } }` for per-app filtering.

**No shared abstraction.** `@sentry/react` and `@sentry/node` are different packages; 4 init calls don't justify a shared wrapper. `stripPii` is duplicated per app intentionally to avoid cross-app coupling.

---

## Packages

| Package               | Target                     | Type              |
| --------------------- | -------------------------- | ----------------- |
| `@sentry/react`       | citizen-pwa, responder-app | dependency        |
| `@sentry/react`       | admin-desktop              | already installed |
| `@sentry/vite-plugin` | all 3 apps                 | devDependency     |
| `@sentry/node`        | functions                  | dependency        |

---

## Environment Variables

### Frontend apps (citizen-pwa, admin-desktop, responder-app)

Added to `.env.staging` and `.env.production` in each app:

```
VITE_SENTRY_DSN=<dsn>
VITE_SENTRY_ENVIRONMENT=staging   # or production
```

Added to each app's `.env.staging.example` and `.env.production.example` (no real values):

```
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=
```

### Cloud Functions

Added to `functions/.env.staging` and `functions/.env.production`:

```
SENTRY_DSN=<dsn>
SENTRY_ENVIRONMENT=staging   # or production
```

### CI (one new secret)

```
SENTRY_AUTH_TOKEN=<from Sentry > Settings > Auth Tokens>
```

Used by `@sentry/vite-plugin` at build time to upload sourcemaps. The Sentry DSN is public-safe (intentionally shipped to browsers). The auth token is the only sensitive value and stays CI-only.

---

## Initialization Pattern

### React apps (`main.tsx`)

```tsx
import * as Sentry from '@sentry/react'

const isEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'

if (!isEmulator && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? 'production',
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0, // errors only, no performance tracing
    replaysSessionSampleRate: 0, // no session replay
    initialScope: { tags: { app: '<surface-name>' } },
    beforeSend(event) {
      return stripPii(event)
    },
  })
}
```

App root render wraps `<App />` in an error boundary:

```tsx
root.render(
  <Sentry.ErrorBoundary fallback={<AppCrashFallback />}>
    <App />
  </Sentry.ErrorBoundary>,
)
```

### `stripPii(event)` — one copy per app in `src/sentry-utils.ts`

Walks `event.extra`, `event.contexts`, and `event.request?.data` and deletes the following keys before the event leaves the browser:

```
reporterUid, fcmToken, email, phone, contactInfo, reporterName
```

Required for RA 10173 compliance — these fields appear in callable payloads and Firestore documents that may surface in breadcrumbs or extras.

### `AppCrashFallback` — inline per app

Minimal: "Something went wrong. [Reload]" with a `window.location.reload()` button. No shared component.

### Cloud Functions (`src/index.ts`, top of file before any function registration)

```ts
import * as Sentry from '@sentry/node'

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true'

if (!isEmulator && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? 'production',
    tracesSampleRate: 0,
    initialScope: { tags: { app: 'functions' } },
  })
}
```

The Node SDK automatically captures unhandled promise rejections and uncaught exceptions — errors that escape `withIdempotency` and kill a function instance. Intentional `HttpsError` throws (expected control flow) are not captured.

---

## Vite Plugin (Sourcemaps)

Added to each app's `vite.config.ts`:

```ts
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: 'bantayog-alert', // Sentry org slug
            project: 'bantayog-alert', // Sentry project slug
            sourcemaps: {
              filesToDeleteAfterUpload: '**/*.map',
            },
          }),
        ]
      : []),
  ],
  build: {
    sourcemap: true, // generate maps for plugin to upload
  },
})
```

**Behaviour by environment:**

- `pnpm dev` (local): plugin never loads, no token needed
- `pnpm build` locally without token: maps generated but not uploaded (acceptable)
- CI build with `SENTRY_AUTH_TOKEN`: maps uploaded then deleted from `dist/` — production hosting never serves `.map` files

---

## What Is and Is Not Captured

| Event type                      | Captured? | Why                             |
| ------------------------------- | --------- | ------------------------------- |
| Unhandled JS exceptions         | Yes       | Global handler                  |
| Unhandled promise rejections    | Yes       | Global handler                  |
| React render errors             | Yes       | ErrorBoundary                   |
| Intentional `HttpsError` throws | No        | Expected control flow, not bugs |
| Functions unhandled rejections  | Yes       | Node SDK global handler         |
| Performance / Web Vitals        | No        | `tracesSampleRate: 0`           |
| Session replays                 | No        | `replaysSessionSampleRate: 0`   |
| PII fields                      | No        | Stripped by `beforeSend`        |

---

## Files Changed

| File                                      | Change                                          |
| ----------------------------------------- | ----------------------------------------------- |
| `apps/citizen-pwa/package.json`           | add `@sentry/react`, `@sentry/vite-plugin`      |
| `apps/citizen-pwa/vite.config.ts`         | add plugin, `build.sourcemap: true`             |
| `apps/citizen-pwa/src/main.tsx`           | Sentry.init + ErrorBoundary                     |
| `apps/citizen-pwa/src/sentry-utils.ts`    | new — `stripPii` helper                         |
| `apps/citizen-pwa/.env.staging.example`   | add Sentry keys                                 |
| `apps/admin-desktop/package.json`         | add `@sentry/vite-plugin` (react already there) |
| `apps/admin-desktop/vite.config.ts`       | add plugin, `build.sourcemap: true`             |
| `apps/admin-desktop/src/main.tsx`         | Sentry.init + ErrorBoundary                     |
| `apps/admin-desktop/src/sentry-utils.ts`  | new — `stripPii` helper                         |
| `apps/admin-desktop/.env.staging.example` | add Sentry keys                                 |
| `apps/responder-app/package.json`         | add `@sentry/react`, `@sentry/vite-plugin`      |
| `apps/responder-app/vite.config.ts`       | add plugin, `build.sourcemap: true`             |
| `apps/responder-app/src/main.tsx`         | Sentry.init + ErrorBoundary                     |
| `apps/responder-app/src/sentry-utils.ts`  | new — `stripPii` helper                         |
| `apps/responder-app/.env.staging.example` | add Sentry keys                                 |
| `functions/package.json`                  | add `@sentry/node`                              |
| `functions/src/index.ts`                  | Sentry.init at top                              |
| `functions/.env.staging.example`          | add Sentry keys (new file)                      |

---

## Out of Scope

- Performance tracing / transaction monitoring
- Session replay
- Sentry alerting rules / notification routing (configured in Sentry dashboard, not code)
- Capturing intentional `HttpsError` throws from callables
- Adding `Sentry.captureException` to individual callable catch blocks
- Second Sentry project or per-app Sentry projects
