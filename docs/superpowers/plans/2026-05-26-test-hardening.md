# Test Hardening for Production — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
**Goal:** Close the 4 critical testing gaps identified by the QA assessment so the codebase can pass production readiness gates.
**Architecture:** Add CI-gated e2e proof, unit-test shared-data constants, schedule k6 load tests nightly, and fill responder-app critical flow coverage.
**Tech Stack:** GitHub Actions, Playwright, k6, Vitest, Firebase emulators

---

## Task 1: Add e2e CI Job (Playwright Full-Loop Against Emulators)

**Files:**
- Modify: `.github/workflows/ci.yml`

**Context:** The existing `ci.yml` already runs unit tests and emulator-based function tests, but it does NOT run the Playwright e2e suite. The `proof-local` script (`scripts/proof-local.mjs`) already orchestrates: build functions → start `pnpm dev:all` (emulators + 3 dev servers) → run `e2e-tests/specs/full-loop.spec.ts` → teardown. We can replicate this in CI.

**Requirements to add to CI:**
- Java 21 (already used by existing emulator jobs)
- Node.js (from `.nvmrc`)
- `corepack` + `pnpm`
- Install deps
- Build functions + apps
- Start Firebase emulators + dev servers
- Run `pnpm --dir e2e-tests exec playwright test specs/full-loop.spec.ts`
- Seed local proof accounts via `reliability-spine.ts` (handled by spec itself)

**Why not staging?** Staging proof requires live Firebase Hosting + real secrets. CI should test against emulators for speed, determinism, and zero secret exposure.

---

### Task 1 Steps

- [ ] **Step 1: Add CI job section to `.github/workflows/ci.yml` after the `build` job**

Add a new job named `e2e-full-loop` that:
1. `needs: [build, functions-emulator-test]` (we need successful build + function tests first)
2. `runs-on: ubuntu-latest`
3. Installs Node, Java 21, corepack, pnpm
4. Runs `pnpm install --frozen-lockfile`
5. Runs `pnpm build` for the apps + functions
6. Starts the local stack: `node scripts/proof-local.mjs`
   - BUT `proof-local.mjs` is designed for interactive dev; we can simply run the same sequence of commands inline in CI: build functions (`pnpm exec tsx scripts/prepare-functions-deploy.ts`), start emulators, seed accounts, run playwright.
7. Sets timeout appropriately (20 minutes)

**Reference snippet to insert after the `build` job:**

```yaml
  e2e-full-loop:
    name: E2E Full-Loop Proof
    needs: [build, functions-emulator-test]
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: '21'
      - run: corepack enable
      - run: corepack prepare pnpm@${PNPM_VERSION} --activate
      - run: pnpm install --frozen-lockfile
      - name: Build apps and functions for emulator hosting
        run: pnpm build
      - name: Run full-loop proof against local emulator stack
        run: BANTAYOG_PROOF_TARGET=local pnpm --dir e2e-tests proof:local
        env:
          BANTAYOG_FIREBASE_PROJECT_ID: demo-bantayog-alert
          CI: true
```

**Important caveats & risks:**
- `proof:local` starts ALL dev servers; in GitHub Actions this may be slow or flaky due to resource limits.
- `proof:local` also runs `pnpm dev:all` which is designed for local interactive use. It may spawn too many processes or timeout.
- We MUST confirm whether `proof:local` is deterministic enough for CI.

**Safer alternative CI approach (inline):**
Instead of `proof:local`, do the CI build + emulator + playwright directly:

```yaml
      - name: Start Firebase emulators
        run: |
          pnpm dlx firebase-tools emulators:start --only firestore,auth,database,storage,functions --project demo-bantayog-alert &
          echo $! > emulator.pid
          npx wait-on http://127.0.0.1:8081 --timeout 120000
      - name: Seed local proof accounts
        run: BANTAYOG_PROOF_TARGET=local pnpm exec tsx e2e-tests/fixtures/reliability-spine.ts seed
      - name: Run full-loop e2e
        run: BANTAYOG_PROOF_TARGET=local pnpm --dir e2e-tests exec playwright test specs/full-loop.spec.ts
```

Wait-on is not installed by default. We could use a simple Node script to poll ports.

**Decision:** Keep it simple. Use the existing `scripts/proof-local.mjs` because it is the canonical local proof entrypoint. If it fails in CI, we iterate. The CI timeout of 20 minutes gives it headroom.

---

## Task 2: Add Unit Tests to `@bantayog/shared-data`

**Files:**
- Create: `packages/shared-data/src/index.test.ts`
- Modify: `packages/shared-data/package.json` (if needed to add test script)
- Modify: root `vitest.config.ts` (monorepo workspace configuration — likely already handles it)

**Context:** `shared-data` currently exports only:
- `CAMARINES_NORTE_MUNICIPALITY_IDS` const array
- `CamarinesNorteMunicipalityId` type

These are critical constants used by analytics snapshot writers and mass-alert scope validation. Even a simple constant array should have a test that:
1. Asserts the array contains all 12 municipalities (regression guard against accidental deletion)
2. Asserts the type can be used as a union (type-level check)

---

### Task 2 Steps

- [ ] **Step 1: Write the failing test**

Create `packages/shared-data/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  CAMARINES_NORTE_MUNICIPALITY_IDS,
  type CamarinesNorteMunicipalityId,
} from './index.js'

describe('shared-data constants', () => {
  it('contains all 12 Camarines Norte municipalities', () => {
    expect(CAMARINES_NORTE_MUNICIPALITY_IDS).toHaveLength(12)
    const expected = new Set([
      'basud','capalonga','daet','san_lorenzo_ruiz',
      'jose_panganiban','labo','mercedes','paracale',
      'san_vicente','santa_elena','talisay','vinzons',
    ])
    const actual = new Set(CAMARINES_NORTE_MUNICIPALITY_IDS)
    expect(actual).toEqual(expected)
  })

  it('orders municipalities as expected', () => {
    expect(CAMARINES_NORTE_MUNICIPALITY_IDS[0]).toBe('basud')
    expect(CAMARINES_NORTE_MUNICIPALITY_IDS[11]).toBe('vinzons')
  })

  it('type can be narrowed to literal values', () => {
    const assertMunicipality = (id: CamarinesNorteMunicipalityId) => id
    // These three should compile; we exercise the type at runtime by
    // passing known-good strings through the typed guard.
    expect(assertMunicipality('daet')).toBe('daet')
    expect(assertMunicipality('labo')).toBe('labo')
    expect(assertMunicipality('vinzons')).toBe('vinzons')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --dir packages/shared-data exec vitest run src/index.test.ts
```

Expected: If `package.json` in `shared-data` does not have a `test` script, it might fail with "no test script defined." Otherwise, should pass because the code already exists.

**If package.json needs a test script:**
Add to `packages/shared-data/package.json` scripts:
```json
"test": "vitest run --pass-with-no-tests"
```

- [ ] **Step 3: Verify pass**

```bash
pnpm --dir packages/shared-data exec vitest run src/index.test.ts
```
Expected: PASS

---

## Task 3: Add k6 Load-Test CI Gate (Scheduled, Not Per-PR)

**Files:**
- Create: `.github/workflows/load-test.yml`

**Context:** `e2e-tests/k6/run.cjs` is a wrapper that runs `k6 run scenarios/${SCENARIO}.js`. The scenarios directory exists but we don't know the filenames yet. We will create a scheduled workflow that runs nightly against staging, NOT per-PR.

**Risks:**
- Requires k6 CLI in GitHub Actions (use `grafana/k6-action` or install via apt).
- Requires staging secrets (do NOT commit them).
- Load test target URL must be staging, never production.

**Decision:** Create a scheduled (cron) workflow that runs 1x/day. Do NOT run on PRs. Mark as `workflow_dispatch` too so it can be triggered manually.

---

### Task 3 Steps

- [ ] **Step 1: Create `.github/workflows/load-test.yml`**

```yaml
name: Load Test

on:
  schedule:
    - cron: '0 3 * * *'   # 03:00 UTC daily
  workflow_dispatch:

env:
  PNPM_VERSION: 9.12.0

jobs:
  load-test:
    name: k6 Load Test (Staging)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
      - run: corepack enable
      - run: corepack prepare pnpm@${PNPM_VERSION} --activate
      - run: pnpm install --frozen-lockfile
      - name: Install k6
        run: |
          sudo gpg -k && \
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D786D16274856A31D7E0 && \
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list > /dev/null && \
          sudo apt-get update && \
          sudo apt-get install -y k6
      - name: Run k6 load test
        run: |
          SCENARIO=${{ github.event.inputs.scenario || 'accept-dispatch-race' }} \
          BANTAYOG_ADMIN_EMAIL=${{ secrets.BANTAYOG_ADMIN_EMAIL }} \
          BANTAYOG_ADMIN_PASSWORD=${{ secrets.BANTAYOG_ADMIN_PASSWORD }} \
          pnpm run load-test
        timeout-minutes: 10
```

**Note:** The exact scenario(s) will need to be iterated. Default to `accept-dispatch-race` if that file exists in `e2e-tests/k6/scenarios/`.
s
- [ ] **Step 2: Verify scenario file exists**

Run:
```bash
ls e2e-tests/k6/scenarios/
```

If the default scenario `accept-dispatch-race.js` is missing, adjust the default in the workflow OR create a minimal smoke-load scenario.

---

## Task 4: Audit Responder-App Coverage and Add Critical Flow Tests

**Files:**
- Read: `apps/responder-app/src/main.tsx` (entrypoint)
- Read: `apps/responder-app/src/App.tsx` (routes)
- Glob: `apps/responder-app/src/**/__tests__/*.test.ts*` (existing tests)
- Create: `apps/responder-app/src/hooks/useResponderDispatch.test.ts` (or similar — depends on audit)
- Create: `apps/responder-app/src/pages/DispatchPage.test.tsx` (or similar)

**Context:** QA identified responder-app as having fewer tests (45 files) compared to citizen-pwa (68 files). The critical responder flows are: accept dispatch, on-scene status update, field note sync.

**Plan:**
1. Audit the existing responder-app tests to see if these critical flows are covered.
2. If missing, add focused unit/integration tests using vitest + happydom (same pattern as other apps).

---

### Task 4 Steps

- [ ] **Step 1: Audit responder-app `main.tsx` and `App.tsx`**
Run:
```bash
cat apps/responder-app/src/main.tsx
```
```bash
cat apps/responder-app/src/App.tsx
```

Identify the primary routes and components involved in dispatch acceptance, responder status updates, and field note submission.

- [ ] **Step 2: Glob existing responder tests and identify top gaps**
Run:
```bash
find apps/responder-app/src -name "*.test.*" | sort
```

Compare against the critical responder flows:
- Dispatch list / detail
- Accept / reject dispatch
- Update responder status (acknowledge → en_route → on_scene → resolved)
- Field notes / media upload during dispatch
- Offline queue sync
- GPS location reporting

- [ ] **Step 3: Write failing test(s) for the most glaring gap**

If `useResponderDispatch` or similar hook exists and has no test:
Create `apps/responder-app/src/hooks/useResponderDispatch.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
// ... actual imports depend on Step 2 audit

describe('useResponderDispatch', () => {
  it('returns expected initial state', () => {
    // write minimal test
  })
})
```

- [ ] **Step 4: Implement minimal code if needed (or verify existing tests already cover)**

If Step 2 shows existing tests ARE sufficient (e.g., 45 tests cover those flows via integration), document the finding in `docs/learnings.md` and skip adding new tests.

---

## Verification (All Tasks)

After implementing ALL tasks:

1. **Run root-level tests**:
```bash
pnpm test
```
Expected: All pass.

2. **Run load-test script locally (dry-run):**
```bash
SCENARIO=accept-dispatch-race pnpm run load-test
```
Expected: Runs without crashing (may fail on staging auth; that's expected in local dev without secrets).

3. **Run e2e proof locally** (to confirm CI approach will work):
```bash
BANTAYOG_PROOF_TARGET=local pnpm --dir e2e-tests proof:local
```
Expected: `full-loop.spec.ts` passes.

4. **Verify CI file syntax**:
```bash
pnpm exec actionlint .github/workflows/ci.yml .github/workflows/load-test.yml
```
If `actionlint` is not installed, use online action linter or run `act` locally.

5. **Update docs**:
- Append to `docs/learnings.md` about why CI needs e2e/scheduled load tests.
- Append to `docs/progress.md` tracking this hardening.

---

## Self-Review

- **Spec coverage:** Task 1 covers CI e2e gate. Task 2 covers shared-data unit tests. Task 3 covers scheduled k6. Task 4 covers responder-app audit.
- **Placeholder scan:** No TBD or unfinished code. Exact paths used where known. Responder-app Step 3 intentionally generic because audit in Step 2 determines the exact target file.
- **Type consistency:** All imports reference `.js` extensions (matches ESM). Type references match existing package names.

---

## Next Steps

1. Save this plan to `docs/superpowers/plans/2026-05-26-test-hardening.md`.
2. Execute tasks inline in this session (no subagent needed for small changes).
3. Verify after each task.
