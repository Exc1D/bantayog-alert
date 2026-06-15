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
    release: import.meta.env.npm_package_version,
    tracesSampleRate: 0, // errors only, no performance tracing
    replaysSessionSampleRate: 0, // no session replay
    initialScope: { tags: { app: '<surface-name>' } },
    beforeSend(event) {
      return stripPii(event)
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) stripPiiFromObject(breadcrumb.data)
      if (breadcrumb.message) breadcrumb.message = redactPiiFromString(breadcrumb.message)
      return breadcrumb
    },
  })
}
```

**No `browserTracingIntegration()`:** Adding it patches `fetch`/`XHR` for distributed tracing headers on every request. With `tracesSampleRate: 0` this is pure overhead (~8 KB bundle + runtime cost) with zero benefit.

App root render uses React 19's `createRoot` error hooks alongside `ErrorBoundary`. `ErrorBoundary` alone misses `onUncaughtError` (errors thrown outside the component tree) and `onRecoverableError` (Suspense/hydration failures React auto-recovers from):

```tsx
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
```

### `sentry-utils.ts` — one copy per app in `src/sentry-utils.ts`

Three exports used by the init hooks:

- **`stripPii(event)`** — walks `event.extra`, `event.contexts`, and `event.request?.data`, deletes known PII keys
- **`stripPiiFromObject(obj)`** — same key deletion on an arbitrary object (used by `beforeBreadcrumb`)
- **`redactPiiFromString(msg)`** — regex-replaces known PII patterns in freeform strings (e.g., UIDs, email-like tokens)

PII keys to delete across all three:

```
reporterUid, fcmToken, email, phone, contactInfo, reporterName
```

**Why `beforeBreadcrumb` is required for RA 10173:** Sentry's JS SDK auto-captures `console.log` output and HTTP request breadcrumbs. Console logs in the callable path reference `reporterUid`; Firestore/FCM HTTP breadcrumbs include request URLs containing tracking refs. These breadcrumbs are attached to every error event and would bypass a `beforeSend`-only scrub.

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
    skipOpenTelemetrySetup: true,
    initialScope: { tags: { app: 'functions' } },
  })
}
```

**`skipOpenTelemetrySetup: true`** is required: `@sentry/node` v8+ bootstraps an OpenTelemetry SDK unconditionally at `Sentry.init()`, regardless of `tracesSampleRate`. Firebase Functions v2 (Cloud Run) has its own Cloud Trace OTel integration — two OTel SDKs initializing simultaneously cause span context conflicts and add ~50–100 ms to cold start time. Setting this flag keeps global `unhandledRejection`/`uncaughtException` capture working while skipping the OTel layer entirely.

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
            org: 'bantayog-alert', // verify from sentry.io/organizations/<slug>/
            project: 'bantayog-alert', // verify from sentry.io/organizations/<org>/projects/<slug>/
            release: {
              name: process.env.npm_package_version,
            },
            sourcemaps: {
              filesToDeleteAfterUpload: '**/*.map',
            },
          }),
        ]
      : []),
  ],
  // build.sourcemap is already true in all 3 apps — no change needed
})
```

**`release.name` must match `Sentry.init({ release })`** — Sentry uses the release identifier to join uploaded sourcemaps to incoming error events. If they differ, sourcemaps are uploaded but never applied. Both use `npm_package_version` (already exposed via `define: { __APP_VERSION__ }` in each Vite config).

**Behaviour by environment:**

- `pnpm dev` (local): plugin never loads, no token needed
- `pnpm build` locally without token: maps generated but not uploaded (acceptable)
- CI build with `SENTRY_AUTH_TOKEN`: maps uploaded then deleted from `dist/` — production hosting never serves `.map` files

**Vite 8 / Rolldown build slowdown risk:** There is an [open issue (#20100)](https://github.com/getsentry/sentry-javascript/issues/20100) where the Sentry Vite plugin causes ~5× build slowdown with Vite 8 (Rolldown). This project is on `vite: ^8.0.16`. The root cause: Rolldown compiles extremely fast, so the sourcemap network upload dominates total build time. This is a CI time concern only — output correctness is unaffected. If the slowdown is unacceptable, fall back to a separate `sentry-cli` post-build upload step outside the plugin, keeping `build.sourcemap: true` but removing the Vite plugin.

---

## What Is and Is Not Captured

| Event type                          | Captured? | Why                                   |
| ----------------------------------- | --------- | ------------------------------------- |
| Unhandled JS exceptions             | Yes       | Global handler                        |
| Unhandled promise rejections        | Yes       | Global handler                        |
| React render errors                 | Yes       | ErrorBoundary                         |
| React `onUncaughtError`             | Yes       | `reactErrorHandler` in `createRoot`   |
| React `onRecoverableError`          | Yes       | `reactErrorHandler` in `createRoot`   |
| Intentional `HttpsError` throws     | No        | Expected control flow, not bugs       |
| Functions unhandled rejections      | Yes       | Node SDK global handler               |
| Performance / Web Vitals            | No        | `tracesSampleRate: 0`                 |
| OTel spans (functions)              | No        | `skipOpenTelemetrySetup: true`        |
| Session replays                     | No        | `replaysSessionSampleRate: 0`         |
| PII in event payload                | No        | Stripped by `beforeSend` → `stripPii` |
| PII in breadcrumbs (console / HTTP) | No        | Stripped by `beforeBreadcrumb`        |

---

## Files Changed

| File                                      | Change                                                        |
| ----------------------------------------- | ------------------------------------------------------------- |
| `apps/citizen-pwa/package.json`           | add `@sentry/react`, `@sentry/vite-plugin`                    |
| `apps/citizen-pwa/vite.config.ts`         | add Sentry plugin (`sourcemap: true` already set)             |
| `apps/citizen-pwa/src/main.tsx`           | Sentry.init + `createRoot` error hooks + ErrorBoundary        |
| `apps/citizen-pwa/src/sentry-utils.ts`    | new — `stripPii`, `stripPiiFromObject`, `redactPiiFromString` |
| `apps/citizen-pwa/.env.staging.example`   | add Sentry keys                                               |
| `apps/admin-desktop/package.json`         | add `@sentry/vite-plugin` (`@sentry/react` already installed) |
| `apps/admin-desktop/vite.config.ts`       | add Sentry plugin (`sourcemap: true` already set)             |
| `apps/admin-desktop/src/main.tsx`         | Sentry.init + `createRoot` error hooks + ErrorBoundary        |
| `apps/admin-desktop/src/sentry-utils.ts`  | new — `stripPii`, `stripPiiFromObject`, `redactPiiFromString` |
| `apps/admin-desktop/.env.staging.example` | add Sentry keys                                               |
| `apps/responder-app/package.json`         | add `@sentry/react`, `@sentry/vite-plugin`                    |
| `apps/responder-app/vite.config.ts`       | add Sentry plugin (`sourcemap: true` already set)             |
| `apps/responder-app/src/main.tsx`         | Sentry.init + `createRoot` error hooks + ErrorBoundary        |
| `apps/responder-app/src/sentry-utils.ts`  | new — `stripPii`, `stripPiiFromObject`, `redactPiiFromString` |
| `apps/responder-app/.env.staging.example` | add Sentry keys                                               |
| `functions/package.json`                  | add `@sentry/node`                                            |
| `functions/src/index.ts`                  | Sentry.init at top (`skipOpenTelemetrySetup: true`)           |
| `functions/.env.staging.example`          | new — add Sentry keys                                         |

---

## Out of Scope

- Performance tracing / transaction monitoring
- Session replay
- Sentry alerting rules / notification routing (configured in Sentry dashboard, not code)
- Capturing intentional `HttpsError` throws from callables
- Adding `Sentry.captureException` to individual callable catch blocks
- Second Sentry project or per-app Sentry projects
