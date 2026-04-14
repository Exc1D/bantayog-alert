# CI And Test Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the GitHub test workflow run the intended suites and clear the failures documented in `TEST_FINDINGS_2026-04-13.md`.

**Architecture:** Recover the pipeline in dependency order. First, fix the CI command surface so jobs invoke the right tools. Second, split unit and emulator-backed integration execution and make Firebase initialization test-safe. Third, clear the remaining TypeScript and ESLint debt by shared infrastructure first, then by feature area, so later tasks are working against stable contracts instead of shifting types.

**Tech Stack:** GitHub Actions, Vite, Vitest, Playwright, React 18, TypeScript 6, Firebase Web SDK 12, Firebase Emulator Suite, Firebase Admin SDK, `idb`, ESLint 9

---

## Scope Note

This findings file touches multiple subsystems, but they are coupled by one outcome: green CI. Keep this as one implementation plan so the worker can recover the harness first and then burn down the real code issues behind it without duplicating setup work.

## File Map

- `.github/workflows/test.yml`
  Owns CI job commands. This is where the invalid `firebase emulators:start --background` usage currently breaks `integration-tests` and `e2e-tests`.
- `package.json`
  Must become the single source of truth for unit, integration, rules, and CI-safe E2E commands.
- `vitest.config.ts`
  Should be narrowed to true unit/browser tests only.
- `vitest.integration.config.ts`
  New config for emulator-backed tests that should never be collected by the unit job.
- `src/app/firebase/config.ts`
  Must stop initializing analytics during tests and must connect the web SDK to emulators when the test scripts opt in.
- `tests/helpers/firebase-admin.ts`
  New Node-only helper for cleanup/seeding against the Auth and Firestore emulators using `firebase-admin`.
- `src/test/setup.ts`
  Shared browser test setup. This is the right place for deterministic `localStorage`, `matchMedia`, and IndexedDB cleanup.
- `src/test/hello-world.test.tsx`
  Current smoke test is stale and still asserts Phase 0 placeholder content instead of the real app shell.
- `src/shared/components/AgeGate.tsx`
  Reads `localStorage` eagerly on mount and currently crashes in JSDOM.
- `src/shared/hooks/usePWAInstall.ts`
  Same browser-storage problem as `AgeGate`, and it also depends on `matchMedia`.
- `tsconfig.json`
  Current ES2020 lib/target are incompatible with the repo’s use of `Error.cause`.
- `src/shared/services/firestore.service.ts`
  Generic Firestore helpers currently have invalid typing around `Query` and collection references.
- `src/shared/services/functions.service.ts`
  Needs cleanup once the compiler target is corrected.
- `src/domains/citizen/services/firestore.service.ts`
  Creates `report_private` and `report_ops` documents with shapes that do not match `ReportPrivate`/`ReportOps`.
- `tests/integration/test-helpers.ts`
  Current helpers use the client Auth SDK as if it were the Admin SDK and also build invalid report fixtures.
- `tests/integration/cross-municipality-assignment.test.ts`
- `tests/integration/municipality-validation.test.ts`
- `tests/integration/phone-uniqueness.test.ts`
  These need emulator-safe cleanup and canonical fixture shapes.
- `src/features/alerts/services/alert.service.ts`
  Query constraints are typed incorrectly, which fans out into multiple errors.
- `src/features/feed/hooks/useFeedReports.ts`
  Its return type does not match how `FeedList` consumes the data.
- `src/features/feed/components/FeedList.tsx`
  Assumes paginated data that the hook does not return and leaves unused values behind.
- `src/features/report/services/reportQueue.service.ts`
  Uses `openDB` but types the database as raw `IDBDatabase`, which is the wrong API surface.
- `src/shared/components/Button.tsx`
  Call sites already rely on `outline` and `sm`, so the component contract must catch up or the callers must be rewritten.
- `src/features/profile/components/LinkReportsByPhone.tsx`
- `src/features/profile/components/MyReportsList.tsx`
  Currently disagree with the shared button/status contracts.
- `src/features/feed/components/FeedCard.tsx`
- `src/features/feed/components/ReportDetailScreen.tsx`
- `src/features/feed/types/index.ts`
  Need one consistent report view model for feed/detail UI instead of reaching into fields that are not on `Report`.
- `src/features/map/hooks/useLocationSearch.ts`
- `src/features/map/components/LocationSearch.tsx`
  `RecentSearch` is defined but not exported/imported correctly.
- `tests/README.md`
- `tests/integration/README.md`
- `scripts/verify-tests.sh`
  Documentation and verification helpers still teach the invalid background-emulator workflow and will reintroduce drift if not fixed.

### Task 1: Fix CI Emulator Lifecycle And Canonical Test Scripts

**Files:**
- Modify: `.github/workflows/test.yml`
- Modify: `package.json`
- Modify: `scripts/verify-tests.sh`
- Modify: `tests/README.md`
- Modify: `tests/integration/README.md`

- [ ] **Step 1: Reproduce the current workflow breakage**

Run:

```bash
firebase emulators:start --background
```

Expected: FAIL with `unknown option '--background'`

- [ ] **Step 2: Make `package.json` the single source of truth for test entry points**

Update the scripts block to this exact shape:

```json
{
  "scripts": {
    "test": "vitest --config vitest.config.ts",
    "test:run": "vitest run --config vitest.config.ts",
    "test:coverage": "vitest run --config vitest.config.ts --coverage",
    "test:integration": "VITE_USE_FIREBASE_EMULATORS=true firebase emulators:exec \"vitest run --config vitest.integration.config.ts\"",
    "test:integration:watch": "VITE_USE_FIREBASE_EMULATORS=true firebase emulators:exec \"vitest --config vitest.integration.config.ts --watch\"",
    "test:rules": "VITE_USE_FIREBASE_EMULATORS=true firebase emulators:exec --only firestore \"vitest run --config vitest.integration.config.ts tests/firestore/firestore.rules.test.ts\"",
    "test:e2e": "playwright test",
    "test:e2e:ci": "VITE_USE_FIREBASE_EMULATORS=true firebase emulators:exec \"playwright test\""
  }
}
```

- [ ] **Step 3: Replace manual emulator background management in GitHub Actions**

Rewrite the failing job steps to call the package scripts directly:

```yaml
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Install Firebase CLI
        run: npm install -g firebase-tools
      - name: Run integration tests
        run: npm run test:integration

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      - name: Install Firebase CLI
        run: npm install -g firebase-tools
      - name: Run E2E tests
        run: npm run test:e2e:ci

  firestore-rules-test:
    name: Firestore Security Rules Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies
        run: npm ci
      - name: Install Firebase CLI
        run: npm install -g firebase-tools
      - name: Run Firestore rules tests
        run: npm run test:rules
```

- [ ] **Step 4: Update local verification docs so they stop teaching the broken command**

Replace the “next steps” and README examples with `emulators:exec`-based commands:

```bash
echo "  1. Run unit tests: npm run test:run"
echo "  2. Run integration tests: npm run test:integration"
echo "  3. Run E2E tests: npm run test:e2e:ci"
echo "  4. Run Firestore rules tests: npm run test:rules"
echo "  5. Run coverage: npm run test:coverage"
```

And in the markdown docs, replace examples such as:

```bash
firebase emulators:start --background && npm run test:integration
```

with:

```bash
npm run test:integration
```

- [ ] **Step 5: Verify the workflow no longer fails at CLI argument parsing**

Run:

```bash
npm run test:integration
```

Expected: the emulator starts and Vitest begins executing tests; no `unknown option '--background'` output appears. Remaining failures are allowed at this point because later tasks will fix them.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/test.yml package.json scripts/verify-tests.sh tests/README.md tests/integration/README.md
git commit -m "test(ci): remove invalid emulator background startup"
```

### Task 2: Split Unit Discovery From Emulator-Backed Integration Discovery

**Files:**
- Modify: `vitest.config.ts`
- Create: `vitest.integration.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Reproduce the discovery bug from the unit runner**

Run:

```bash
npm run test:run
```

Expected: FAIL with unrelated collection such as Playwright specs, accessibility tests, performance tests, `functions/src`, or `node_modules`

- [ ] **Step 2: Narrow `vitest.config.ts` to real unit/browser tests only**

Replace the current open-ended collection behavior with explicit include/exclude lists:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'src/test/**/*.test.{ts,tsx}',
      'tests/unit/**/*.test.ts',
    ],
    exclude: [
      '.worktrees/**',
      'node_modules/**',
      'functions/**',
      'tests/e2e/**',
      'tests/a11y/**',
      'tests/performance/**',
      'tests/integration/**',
      'tests/firestore/**',
      'src/shared/services/auth.service.test.ts',
      'src/shared/services/firestore.service.test.ts',
      'src/domains/citizen/services/auth.service.test.ts',
      'src/domains/provincial-superadmin/services/auth.service.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        'src/main.tsx',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
        perFile: true,
      },
    },
    typecheck: {
      tsconfig: './tsconfig.json',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/domains': path.resolve(__dirname, './src/domains'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/app': path.resolve(__dirname, './src/app'),
    },
  },
})
```

- [ ] **Step 3: Create a dedicated integration config for emulator-backed tests**

Create `vitest.integration.config.ts`:

```ts
import { defineConfig, mergeConfig } from 'vitest/config'
import unitConfig from './vitest.config'

export default mergeConfig(
  unitConfig,
  defineConfig({
    test: {
      include: [
        'tests/integration/**/*.test.ts',
        'tests/firestore/**/*.test.ts',
        'src/shared/services/auth.service.test.ts',
        'src/shared/services/firestore.service.test.ts',
        'src/domains/citizen/services/auth.service.test.ts',
        'src/domains/provincial-superadmin/services/auth.service.test.ts',
      ],
      exclude: [
        '.worktrees/**',
        'node_modules/**',
        'tests/e2e/**',
        'tests/a11y/**',
        'tests/performance/**',
      ],
    },
  })
)
```

- [ ] **Step 4: Verify the unit lane is scoped correctly**

Run:

```bash
npm run test:run
```

Expected: Playwright/Vitest mismatch errors disappear. If there are still failures, they come from actual unit/browser tests only.

- [ ] **Step 5: Verify the integration lane sees the intended files**

Run:

```bash
firebase emulators:exec "vitest run --config vitest.integration.config.ts --reporter=dot"
```

Expected: Vitest collects integration and emulator-backed service tests, not `tests/e2e`, `tests/a11y`, `tests/performance`, `functions`, or `node_modules`.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts vitest.integration.config.ts package.json
git commit -m "test(vitest): separate unit and integration discovery"
```

### Task 3: Make Firebase Test Initialization Emulator-Aware And Fix Invalid Auth Cleanup

**Files:**
- Modify: `src/app/firebase/config.ts`
- Create: `tests/helpers/firebase-admin.ts`
- Modify: `src/shared/services/auth.service.test.ts`
- Modify: `src/shared/services/firestore.service.test.ts`
- Modify: `src/domains/citizen/services/auth.service.test.ts`
- Modify: `src/domains/provincial-superadmin/services/auth.service.test.ts`
- Modify: `tests/integration/test-helpers.ts`
- Modify: `tests/integration/cross-municipality-assignment.test.ts`
- Modify: `tests/integration/municipality-validation.test.ts`
- Modify: `tests/integration/phone-uniqueness.test.ts`

- [ ] **Step 1: Reproduce the live-network Firebase failure**

Run:

```bash
npx vitest run src/shared/services/auth.service.test.ts
```

Expected: FAIL with `auth/network-request-failed` and Firestore `UNAVAILABLE`/offline errors

- [ ] **Step 2: Make the web SDK test-safe and emulator-aware**

Update `src/app/firebase/config.ts` so tests can opt into emulators and so analytics never initializes in Vitest:

```ts
import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
const isTest = import.meta.env.MODE === 'test'

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const functions = getFunctions(app)

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}

export const analytics =
  !isTest && typeof window !== 'undefined'
    ? getAnalytics(app)
    : null
```

- [ ] **Step 3: Add a Node-only admin helper for test cleanup**

Create `tests/helpers/firebase-admin.ts`:

```ts
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const adminApp =
  getApps()[0] ??
  initializeApp({
    projectId: process.env.GCLOUD_PROJECT ?? 'bantayog-alert',
  })

export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)

export async function deleteAuthUsers(uids: string[]): Promise<void> {
  await Promise.all(
    uids.map(async (uid) => {
      await adminAuth.deleteUser(uid).catch(() => undefined)
    })
  )
}
```

- [ ] **Step 4: Replace invalid `auth.getUser()` / `auth.deleteUser()` cleanup in tests**

Update the test cleanup blocks to use the helper instead of the client SDK. In `src/shared/services/auth.service.test.ts`, use this exact import and cleanup shape:

```ts
import { deleteAuthUsers } from '../../../tests/helpers/firebase-admin'

afterEach(async () => {
  for (const uid of testUsers) {
    await deleteDoc(doc(db, 'users', uid)).catch(() => undefined)
    await deleteDoc(doc(db, 'responders', uid)).catch(() => undefined)
  }

  await deleteAuthUsers(testUsers)
  testUsers.length = 0
})
```

For files already under `tests/integration/`, import the same helper as:

```ts
import { deleteAuthUsers } from '../helpers/firebase-admin'
```

Also update `tests/integration/test-helpers.ts` to use canonical `Report` data:

```ts
const reportData: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
  approximateLocation: {
    barangay: 'Test Barangay',
    municipality,
    approximateCoordinates: { latitude: 14.0, longitude: 122.9 },
  },
  incidentType: 'flood',
  severity: 'medium',
  description: 'Test report',
  isAnonymous: false,
  ...overrides,
}
```

- [ ] **Step 5: Verify emulator-backed service tests stop reaching production**

Run:

```bash
firebase emulators:exec "vitest run --config vitest.integration.config.ts src/shared/services/auth.service.test.ts"
```

Expected: tests execute against local emulators and no longer fail with `auth/network-request-failed` or `firestore.googleapis.com` DNS errors

- [ ] **Step 6: Commit**

```bash
git add src/app/firebase/config.ts tests/helpers/firebase-admin.ts src/shared/services/auth.service.test.ts src/shared/services/firestore.service.test.ts src/domains/citizen/services/auth.service.test.ts src/domains/provincial-superadmin/services/auth.service.test.ts tests/integration/test-helpers.ts tests/integration/cross-municipality-assignment.test.ts tests/integration/municipality-validation.test.ts tests/integration/phone-uniqueness.test.ts
git commit -m "test(firebase): route integration tests through emulators"
```

### Task 4: Stabilize Browser Globals And Replace The Stale Smoke Test

**Files:**
- Modify: `src/test/setup.ts`
- Modify: `src/shared/components/AgeGate.tsx`
- Modify: `src/shared/hooks/usePWAInstall.ts`
- Modify: `src/test/hello-world.test.tsx`
- Modify: `src/app/__tests__/App.test.tsx`
- Modify: `src/shared/components/__tests__/AgeGate.test.tsx`
- Modify: `src/shared/hooks/__tests__/usePWAInstall.test.ts`

- [ ] **Step 1: Reproduce the JSDOM storage crash**

Run:

```bash
npx vitest run src/test/hello-world.test.tsx
```

Expected: FAIL with `TypeError: localStorage.getItem is not a function`

- [ ] **Step 2: Make shared test setup provide deterministic browser globals**

Update `src/test/setup.ts` to own the default browser mocks instead of letting individual tests leak globals:

```ts
import { expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import 'fake-indexeddb/auto'

expect.extend(matchers)

const storage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  configurable: true,
  writable: true,
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

beforeEach(async () => {
  const databases = await indexedDB.databases()
  await Promise.all(
    databases
      .map((database) => database.name)
      .filter((name): name is string => Boolean(name))
      .map((name) => indexedDB.deleteDatabase(name))
  )
})
```

- [ ] **Step 3: Guard storage reads/writes in app code**

Use browser-safe accessors in `AgeGate` and `usePWAInstall`:

```ts
function safeGetStorageItem(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage?.getItem?.(key) ?? null : null
  } catch {
    return null
  }
}

function safeSetStorageItem(key: string, value: string): void {
  try {
    window.localStorage?.setItem?.(key, value)
  } catch {
    // Non-fatal in tests/private browsing
  }
}
```

Then replace the current direct calls:

```ts
const [isAlreadyVerified] = useState(() => safeGetStorageItem(STORAGE_KEY) === 'true')
```

and

```ts
const [wasDismissed, setWasDismissed] = useState(
  () => safeGetStorageItem(DISMISSED_KEY) === 'true'
)
```

- [ ] **Step 4: Replace the stale Phase 0 smoke assertions with the current app shell**

Rewrite `src/test/hello-world.test.tsx` to assert today’s behavior instead of deleted placeholder copy:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '../app/App'

describe('App smoke test', () => {
  it('renders the app shell without crashing', () => {
    render(<App />)
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument()
  })

  it('shows age verification on first load', () => {
    render(<App />)
    expect(screen.getByText('Age Verification Required')).toBeInTheDocument()
  })
})
```

Also remove per-file `localStorage` overrides from `App.test.tsx`, `AgeGate.test.tsx`, and `usePWAInstall.test.ts` when the shared setup now covers them.

- [ ] **Step 5: Verify the browser harness**

Run:

```bash
npx vitest run src/test/hello-world.test.tsx src/app/__tests__/App.test.tsx src/shared/components/__tests__/AgeGate.test.tsx src/shared/hooks/__tests__/usePWAInstall.test.ts
```

Expected: PASS with no `localStorage.getItem is not a function` crash

- [ ] **Step 6: Commit**

```bash
git add src/test/setup.ts src/shared/components/AgeGate.tsx src/shared/hooks/usePWAInstall.ts src/test/hello-world.test.tsx src/app/__tests__/App.test.tsx src/shared/components/__tests__/AgeGate.test.tsx src/shared/hooks/__tests__/usePWAInstall.test.ts
git commit -m "test(app): stabilize browser globals and smoke coverage"
```

### Task 5: Fix The Compiler Baseline And Shared Type Utilities

**Files:**
- Modify: `tsconfig.json`
- Modify: `src/shared/services/firestore.service.ts`
- Modify: `src/shared/services/functions.service.ts`
- Modify: `src/test/setup.d.ts`

- [ ] **Step 1: Reproduce the shared infrastructure type failures**

Run:

```bash
npm run typecheck
```

Expected: FAIL with `Expected 0-1 arguments, but got 2` on `new Error(..., { cause })`, missing `Query`, and other shared helper typing errors

- [ ] **Step 2: Raise the TypeScript target/lib to match the repo’s actual language features**

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

- [ ] **Step 3: Repair the shared Firestore helper typing**

Use the actual Firestore query types and keep the unsafe casts localized:

```ts
import {
  addDoc,
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  query,
  Query,
  QueryConstraint,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

export function buildQuery(
  collectionPath: string,
  constraints: QueryConstraint[]
): Query<DocumentData> {
  const collectionRef = collection(db, collectionPath) as CollectionReference<DocumentData>
  return query(collectionRef, ...constraints)
}
```

Keep `getCollection<T>()` returning `T[]`, but cast only once at the edge instead of mixing `CollectionReference<T>` with an unconstrained `query()` return type.

- [ ] **Step 4: Clean up matcher/function helper typing debt**

Update `src/shared/services/functions.service.ts` and `src/test/setup.d.ts` like this:

```ts
import { httpsCallable } from 'firebase/functions'
```

```ts
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

declare module 'vitest' {
  interface Assertion<T = unknown>
    extends TestingLibraryMatchers<T, void> {}
  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<unknown, void> {}
}
```

- [ ] **Step 5: Verify the shared baseline is repaired**

Run:

```bash
npm run typecheck
```

Expected: the broad `Error.cause` constructor failures disappear, leaving only real domain/UI mismatches for the next tasks

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json src/shared/services/firestore.service.ts src/shared/services/functions.service.ts src/test/setup.d.ts
git commit -m "build(ts): align compiler baseline with shared utilities"
```

### Task 6: Canonicalize Shared Report/Auth Data Contracts In Services And Integration Helpers

**Files:**
- Modify: `src/domains/citizen/services/firestore.service.ts`
- Modify: `tests/integration/test-helpers.ts`
- Modify: `tests/integration/cross-municipality-assignment.test.ts`
- Modify: `tests/integration/municipality-validation.test.ts`
- Modify: `tests/integration/phone-uniqueness.test.ts`
- Modify: `src/shared/services/auth.service.ts`
- Modify: `src/domains/municipal-admin/services/firestore.service.ts`
- Modify: `src/domains/responder/services/firestore.service.ts`
- Modify: `src/domains/provincial-superadmin/services/auth.service.ts`
- Modify: `src/domains/provincial-superadmin/services/firestore.service.ts`

- [ ] **Step 1: Reproduce the contract-level service/type errors**

Run:

```bash
npm run typecheck
```

Expected: FAIL in `src/domains/citizen/services/firestore.service.ts`, `src/shared/services/auth.service.ts`, `src/domains/municipal-admin/services/firestore.service.ts`, `src/domains/responder/services/firestore.service.ts`, and `src/domains/provincial-superadmin/services/*.ts`

- [ ] **Step 2: Stop creating `report_private` and `report_ops` with the wrong shape**

Update `submitReport()` to create deterministic IDs with `setDocument()` instead of `addDocument()` so the `id`/`reportId` contract is valid:

```ts
import {
  getDocument,
  addDocument,
  getCollection,
  setDocument,
} from '@/shared/services/firestore.service'

if (privateData) {
  await setDocument('report_private', reportId, {
    id: reportId,
    reportId,
    ...privateData,
  })
}

await setDocument('report_ops', reportId, {
  id: reportId,
  reportId,
  timeline: [
    {
      timestamp: now,
      action: 'report_created',
      performedBy: privateData?.reporterUserId || 'anonymous',
      notes: 'Initial report submitted',
    },
  ],
})
```

- [ ] **Step 3: Rewrite integration fixtures to use canonical `Report` fields**

Replace invalid objects like:

```ts
approximateLocation: {
  address: 'Downtown Daet',
  municipality: 'Daet',
  coordinates: { latitude: 14.1167, longitude: 122.95 },
},
reportedBy: 'citizen@example.com',
```

with:

```ts
approximateLocation: {
  barangay: 'Downtown',
  municipality: 'Daet',
  approximateCoordinates: { latitude: 14.1167, longitude: 122.95 },
},
isAnonymous: false,
```

Apply that same change to all integration helpers and fixtures so the tests stop compiling against a phantom report shape.

- [ ] **Step 4: Remove stale imports/parameters in shared and domain services**

Make the exact cleanup the compiler is already asking for:

```ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  User as FirebaseUser,
  UserCredential,
} from 'firebase/auth'
```

and rename intentionally unused parameters with `_` where the public signature must stay:

```ts
export async function enrollSMS(_phoneNumber: string): Promise<void> {
  throw new Error('SMS MFA enrollment is not implemented yet')
}
```

- [ ] **Step 5: Verify the shared/domain contract layer**

Run:

```bash
npm run typecheck
```

Expected: service-layer shape errors around `reportId`, invalid report fixtures, and unused domain imports/parameters are gone

- [ ] **Step 6: Commit**

```bash
git add src/domains/citizen/services/firestore.service.ts tests/integration/test-helpers.ts tests/integration/cross-municipality-assignment.test.ts tests/integration/municipality-validation.test.ts tests/integration/phone-uniqueness.test.ts src/shared/services/auth.service.ts src/domains/municipal-admin/services/firestore.service.ts src/domains/responder/services/firestore.service.ts src/domains/provincial-superadmin/services/auth.service.ts src/domains/provincial-superadmin/services/firestore.service.ts
git commit -m "fix(types): align shared report and auth service contracts"
```

### Task 7: Repair Feature-Level UI And Query Typing

**Files:**
- Modify: `src/features/alerts/services/alert.service.ts`
- Modify: `src/features/alerts/components/AlertCard.tsx`
- Modify: `src/features/alerts/components/AlertDetailModal.tsx`
- Modify: `src/features/feed/hooks/useFeedReports.ts`
- Modify: `src/features/feed/components/FeedList.tsx`
- Modify: `src/features/feed/components/FeedCard.tsx`
- Modify: `src/features/feed/components/ReportDetailScreen.tsx`
- Modify: `src/features/feed/components/BeforeAfterGallery.tsx`
- Modify: `src/features/feed/types/index.ts`
- Modify: `src/features/report/services/reportQueue.service.ts`
- Modify: `src/shared/components/Button.tsx`
- Modify: `src/features/profile/components/LinkReportsByPhone.tsx`
- Modify: `src/features/profile/components/MyReportsList.tsx`
- Modify: `src/features/map/hooks/useLocationSearch.ts`
- Modify: `src/features/map/components/LocationSearch.tsx`

- [ ] **Step 1: Reproduce the feature/UI typing failures**

Run:

```bash
npm run typecheck
```

Expected: FAIL in alerts/feed/profile/map/report feature files

- [ ] **Step 2: Fix alerts query typing and icon fallbacks**

Use real constraint arrays and fallback icons:

```ts
import type { QueryConstraint } from 'firebase/firestore'

const constraints: QueryConstraint[] = []
```

```tsx
const TypeIcon = TYPE_ICON[type] ?? Info
return <TypeIcon className="w-4 h-4 text-gray-500" aria-label={`type-${type}`} />
```

Apply the same fallback pattern in `AlertDetailModal.tsx` and delete unused constants such as `SEVERITY_LABEL`/`SEVERITY_ICON` if they are no longer read.

- [ ] **Step 3: Make the feed hook and feed list agree on one data contract**

Keep the hook flattened and make `FeedList` consume the flattened array:

```ts
export interface UseFeedReportsResult {
  data: FeedReport[] | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => Promise<unknown>
  hasNextPage: boolean
  fetchNextPage: () => Promise<unknown>
  isFetchingNextPage: boolean
}
```

```tsx
const {
  data: allReports = [],
  isLoading,
  isError,
  refetch,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
} = useFeedReports({ enabled })
```

Delete `isRefetching` if it remains unused.

- [ ] **Step 4: Fix the report queue service and shared UI contracts**

Type `idb` correctly and extend the button API to match current callers:

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

interface ReportQueueDB extends DBSchema {
  'report-queue': {
    key: string
    value: QueuedReport
    indexes: {
      status: QueuedReport['status']
      createdAt: number
    }
  }
}

let db: IDBPDatabase<ReportQueueDB> | null = null
```

```ts
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline'
  size?: 'md' | 'sm'
  children: React.ReactNode
}
```

Then update the styles map so `outline` and `sm` render intentionally instead of being type errors.

- [ ] **Step 5: Align feed/profile/map components with their real types**

Apply these focused repairs:

```ts
export interface FeedReport extends Report {
  timeAgo: string
  locationDisplay: string
  typeDisplay: string
  isVerified: boolean
  photoUrls?: string[]
}
```

```tsx
if (currentIndex > 0) {
  const previousPhoto = allPhotos[currentIndex - 1]
  if (previousPhoto) {
    setSelectedPhoto(previousPhoto.url)
  }
}
```

```ts
export interface RecentSearch {
  displayName: string
  lat: number
  lng: number
  timestamp: number
}
```

```ts
import {
  useLocationSearch,
  type LocationSearchResult,
  type RecentSearch,
} from '../hooks/useLocationSearch'
```

And in `MyReportsList.tsx`, delete the obsolete `rejected` entries so the UI only uses statuses defined by `ReportStatus`.

- [ ] **Step 6: Verify the feature layer**

Run:

```bash
npm run typecheck
```

Expected: alerts/feed/profile/map/report feature typing errors are cleared

- [ ] **Step 7: Commit**

```bash
git add src/features/alerts/services/alert.service.ts src/features/alerts/components/AlertCard.tsx src/features/alerts/components/AlertDetailModal.tsx src/features/feed/hooks/useFeedReports.ts src/features/feed/components/FeedList.tsx src/features/feed/components/FeedCard.tsx src/features/feed/components/ReportDetailScreen.tsx src/features/feed/components/BeforeAfterGallery.tsx src/features/feed/types/index.ts src/features/report/services/reportQueue.service.ts src/shared/components/Button.tsx src/features/profile/components/LinkReportsByPhone.tsx src/features/profile/components/MyReportsList.tsx src/features/map/hooks/useLocationSearch.ts src/features/map/components/LocationSearch.tsx
git commit -m "fix(ui): align feature components with shared types"
```

### Task 8: Burn Down The Remaining ESLint And Low-Risk Type Debt

**Files:**
- Modify: `functions/src/index.ts`
- Modify: `src/app/components/PrivacyPolicy.tsx`
- Modify: `src/features/auth/components/SignUpFlow.tsx`
- Modify: `src/features/feed/components/FeedSort.tsx`
- Modify: `src/features/feed/components/ReportDetailScreen.tsx`
- Modify: `src/features/report/components/QueueIndicator.tsx`
- Modify: `src/features/report/components/ReportForm.tsx`
- Modify: `src/features/profile/components/RegisteredProfile.tsx`
- Modify: `src/shared/services/functions.service.ts`
- Modify: `src/shared/hooks/UserContext.tsx`
- Modify: test files flagged by `npm run lint`

- [ ] **Step 1: Reproduce the remaining lint backlog**

Run:

```bash
npm run lint
```

Expected: FAIL with unused imports/vars/params, a few `outline`/typing leftovers if earlier tasks are incomplete, and smaller rule-specific warnings

- [ ] **Step 2: Remove stale imports and rename intentional unused parameters**

Make the exact low-risk edits ESLint is already asking for:

```ts
import { useState } from 'react'
```

instead of:

```ts
import React, { useState } from 'react'
```

and convert intentional placeholders to `_name`:

```ts
export async function someHandler(_context: unknown): Promise<void> {
  // ...
}
```

- [ ] **Step 3: Fix test-only lint patterns instead of suppressing them**

Apply these patterns to the flagged tests:

```ts
// Remove unused imports entirely
import { describe, it, expect } from 'vitest'
```

```ts
// Replace require() with ESM import
import { something } from '@/path/to/module'
```

```ts
// Prefer const for arrays never reassigned
const testUsers: string[] = []
const testReports: string[] = []
```

Only use `_error` or `_id` when the value must stay in the signature for readability.

- [ ] **Step 4: Re-run both gates until they are clean**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: both commands PASS

- [ ] **Step 5: Run the critical suites in final verification order**

Run:

```bash
npm run test:run
npm run test:integration
npm run test:rules
npm run test:e2e:ci
```

Expected: PASS. If `test:e2e:ci` is too slow for local iteration, at minimum run `npm run test:e2e -- --project=chromium` before relying on CI for the full matrix.

- [ ] **Step 6: Commit**

```bash
git add functions/src/index.ts src/app/components/PrivacyPolicy.tsx src/features/auth/components/SignUpFlow.tsx src/features/feed/components/FeedSort.tsx src/features/feed/components/ReportDetailScreen.tsx src/features/report/components/QueueIndicator.tsx src/features/report/components/ReportForm.tsx src/features/profile/components/RegisteredProfile.tsx src/shared/services/functions.service.ts src/shared/hooks/UserContext.tsx
git add src tests functions
git commit -m "chore(ci): clear remaining typecheck and lint debt"
```

## Self-Review

### Spec Coverage

- Finding 1, invalid emulator startup command: covered by Task 1.
- Finding 2, unit test discovery too broad: covered by Task 2.
- Finding 3, real `typecheck` issues: covered by Tasks 5, 6, and 7.
- Finding 4, real `lint` issues: covered by Task 8.
- Finding 5, Firebase-backed tests not isolated: covered by Task 3 and the fixture cleanup in Task 6.
- Finding 6, app smoke test crashes in JSDOM: covered by Task 4.
- Finding 7, affected cross-municipality flow: covered by Tasks 3 and 6 through the integration helper and fixture corrections.

### Placeholder Scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task lists exact files.
- Every code-changing step includes concrete code or command content.

### Type Consistency

- The plan standardizes on one split: `vitest.config.ts` for unit tests and `vitest.integration.config.ts` for emulator-backed tests.
- The plan standardizes on canonical report fields from `src/shared/types/firestore.types.ts`: `barangay`, `municipality`, `approximateCoordinates`, and `isAnonymous`.
- The plan standardizes cleanup through `tests/helpers/firebase-admin.ts` instead of mixing client Auth and admin-only methods.

Plan complete and saved to `docs/superpowers/plans/2026-04-13-test-findings-remediation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
