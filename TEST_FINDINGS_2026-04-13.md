# Test Findings

Date: 2026-04-13

## Scope

This report captures the latest failing GitHub test run from `/home/exxeed/Downloads/logs_64359741317` and the follow-up local verification performed in this repository.

## Summary

- `type-check` fails with a broad set of TypeScript errors in app code, services, and tests.
- `lint` fails with many unused-variable and typing issues across source and test files.
- `integration-tests` and `e2e-tests` fail immediately because the workflow uses an invalid Firebase CLI flag.
- `unit-tests` is contaminated by incorrect test scoping: Vitest is collecting Playwright specs, performance tests, and third-party package tests.
- Some test failures are real product regressions, including Firebase-backed tests that rely on live network access and a JSDOM crash in the app smoke test.

## Verified Failures

### 1. Integration and E2E jobs fail before running the suite

The GitHub workflow starts Firebase emulators with:

`firebase emulators:start --background`

The installed Firebase CLI in the logs rejects `--background` with `unknown option '--background'`, so both jobs stop before executing any assertions.

Relevant workflow:

- [`.github/workflows/test.yml`](./.github/workflows/test.yml)

Relevant logs:

- [`/home/exxeed/Downloads/logs_64359741317/Integration Tests/6_Start Firebase Emulator.txt`](./Integration%20Tests/6_Start%20Firebase%20Emulator.txt)
- [`/home/exxeed/Downloads/logs_64359741317/E2E Tests/7_Start Firebase Emulator.txt`](./E2E%20Tests/7_Start%20Firebase%20Emulator.txt)

### 2. Unit test discovery is too broad

Root Vitest config only excludes `.worktrees/**`, so `npm run test:run` is picking up:

- Playwright E2E specs under `tests/e2e/`
- accessibility tests under `tests/a11y/`
- performance tests under `tests/performance/`
- Cloud Functions tests under `functions/src/`
- package tests in `node_modules`

This is why the GitHub unit job reports unrelated failures such as:

- `Playwright Test did not expect test.describe() to be called here`
- `dist/assets must exist. Run "npm run build" before running tests.`
- `jest is not defined`
- `self is not defined`

Relevant config:

- [`vitest.config.ts`](./vitest.config.ts)

Relevant log:

- [`/home/exxeed/Downloads/logs_64359741317/Unit Tests/5_Run unit tests.txt`](./Unit%20Tests/5_Run%20unit%20tests.txt)

Local reproduction:

- `npx vitest run tests/e2e/alert-viewing.spec.ts` fails with the Playwright/Vitest mismatch.
- `npx vitest run tests/unit/manifest.test.ts` passes, which confirms the test runner itself is functional when scoped correctly.

### 3. `typecheck` is failing with real code issues

`npm run typecheck` reproduces the GitHub failure locally and shows a wide set of TypeScript errors. The most important buckets are:

- stale React imports in files that no longer need them
- incorrect Firestore and auth typings
- mismatched report types and missing fields
- unused variables and parameters
- invalid use of `Error.cause` under the current TypeScript target

Representative files:

- [`src/shared/services/auth.service.ts`](./src/shared/services/auth.service.ts)
- [`src/shared/services/firestore.service.ts`](./src/shared/services/firestore.service.ts)
- [`src/features/alerts/services/alert.service.ts`](./src/features/alerts/services/alert.service.ts)
- [`src/features/feed/components/FeedList.tsx`](./src/features/feed/components/FeedList.tsx)
- [`src/features/report/services/reportQueue.service.ts`](./src/features/report/services/reportQueue.service.ts)

Local reproduction:

- `npm run typecheck`

### 4. `lint` is failing with real code issues

`npm run lint` reproduces the GitHub failure locally. The dominant issues are:

- unused imports, variables, and function parameters
- a few `no-non-null-assertion` warnings
- a small number of `no-explicit-any` warnings
- a bad test import pattern in some test files

Representative files:

- [`functions/src/index.ts`](./functions/src/index.ts)
- [`src/features/feed/components/FeedList.tsx`](./src/features/feed/components/FeedList.tsx)
- [`src/shared/services/auth.service.ts`](./src/shared/services/auth.service.ts)
- [`tests/integration/cross-municipality-assignment.test.ts`](./tests/integration/cross-municipality-assignment.test.ts)

Local reproduction:

- `npm run lint`

### 5. Firebase-backed tests are not isolated

Several tests import the live app Firebase config directly. In this repo, that means they try to reach real Firebase services unless an emulator or mock layer is injected.

This is visible in the dependency graph from:

- [`src/app/firebase/config.ts`](./src/app/firebase/config.ts)

Imported by:

- [`src/shared/services/auth.service.test.ts`](./src/shared/services/auth.service.test.ts)
- [`tests/integration/cross-municipality-assignment.test.ts`](./tests/integration/cross-municipality-assignment.test.ts)
- [`tests/integration/municipality-validation.test.ts`](./tests/integration/municipality-validation.test.ts)
- [`tests/integration/phone-uniqueness.test.ts`](./tests/integration/phone-uniqueness.test.ts)
- [`tests/firestore/firestore.rules.test.ts`](./tests/firestore/firestore.rules.test.ts)

Local reproduction:

- `npx vitest run src/shared/services/auth.service.test.ts`

Observed result:

- most tests fail with `auth/network-request-failed`
- Firestore calls fail because the environment cannot reach Google APIs

### 6. App smoke test crashes in JSDOM

The phase 0 smoke test fails because `localStorage` is not behaving like a real Storage object in the test environment.

Crash sites:

- [`src/shared/components/AgeGate.tsx`](./src/shared/components/AgeGate.tsx)
- [`src/shared/hooks/usePWAInstall.ts`](./src/shared/hooks/usePWAInstall.ts)

The test itself:

- [`src/test/hello-world.test.tsx`](./src/test/hello-world.test.tsx)

Local reproduction:

- `npx vitest run src/test/hello-world.test.tsx`

Observed result:

- `TypeError: localStorage.getItem is not a function`

### 7. Affected integration test area

`codex-review-graph` identifies the cross-municipality assignment flow as the most directly impacted integration path.

Relevant test:

- [`tests/integration/cross-municipality-assignment.test.ts`](./tests/integration/cross-municipality-assignment.test.ts)

This is not the first failing point in CI because the workflow breaks earlier at Firebase emulator startup, but it is still a meaningful affected flow to review once the harness is fixed.

## Notes

- `mempalace` is not exposed as an MCP server in this session, so I used the local repo files `mempalace.yaml` and `entities.json` as the memory fallback.
- The GitHub log labels every top-level job as failing, but the actual root causes are fewer: workflow misuse, test discovery misconfiguration, Firebase isolation issues, TypeScript errors, ESLint errors, and a JSDOM setup problem.

## Recommended Fix Order

1. Fix the workflow emulator startup command.
2. Narrow Vitest discovery so unit tests do not collect E2E, a11y, performance, or `node_modules` suites.
3. Separate or mock Firebase-backed tests so they do not require live network access.
4. Fix the JSDOM `localStorage` stub for the app smoke test.
5. Work through the remaining TypeScript and ESLint errors.
