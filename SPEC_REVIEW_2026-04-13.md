# Spec Review: CI and Test Stabilization Plan Execution
**Date:** 2026-04-13  
**Plan:** `docs/superpowers/plans/2026-04-13-test-findings-remediation.md`  
**Status:** ⚠️ Incomplete — 3 of 8 tasks committed

---

## Executive Summary

Implementation stopped after Task 7 (UI typing fixes). Critical infrastructure tasks remain:
- **Blocked:** Integration tests cannot run (no emulator wiring in `firebase/config.ts`)
- **Blocked:** Unit tests cannot start (JSDOM crashes on `localStorage` init)
- **Failing:** `npm run typecheck` — 38+ errors including `Error.cause` in ES2020
- **Failing:** `npm run lint` — 125 errors, mostly fixable

**Recommendation:** Resume at Task 5 (compiler baseline), then Tasks 3→4→6→8 in sequence.

---

## Task Completion Matrix

| Task | Name | Status | Committed | Issues |
|------|------|--------|-----------|--------|
| 1 | Fix CI Emulator Lifecycle | ✅ Complete | `269c008` | — |
| 2 | Split Unit/Integration Discovery | ⚠️ Partial | `269c008` | `vitest.config.ts` narrowing unverified in diff |
| 3 | Firebase Emulator Init + Admin | ❌ Not Done | — | No `firebase-admin.ts`; config lacks emulator wiring |
| 4 | Browser Globals + Smoke Test | ❌ Not Done | — | `hello-world.test.tsx` still asserts Phase 0 copy |
| 5 | Compiler Baseline | ❌ Not Done | — | `tsconfig.json` at ES2020 (should be ES2022) |
| 6 | Report/Auth Contract Canonicalization | ❌ Not Done | — | Depends on Task 5; `auth.service.ts` has 8× `Error.cause` errors |
| 7 | Feature UI/Query Typing | ✅ Complete | `bacce08` | Did not touch FeedCard, ReportDetailScreen, BeforeAfterGallery, LinkReportsByPhone |
| 8 | ESLint Debt Burndown | ❌ Not Done | — | 125 errors, 155 warnings; depends on Tasks 3–6 |

---

## Detailed Findings

### Task 1: Fix CI Emulator Lifecycle ✅
**Status:** Complete  
**Commit:** `269c008 test(ci): remove invalid emulator background startup`

Changes applied:
- ✅ `.github/workflows/test.yml` — rewritten to call package scripts
- ✅ `package.json` — added `test:integration`, `test:integration:watch`, `test:rules`, `test:e2e:ci` with `firebase emulators:exec`
- ✅ `scripts/verify-tests.sh` — updated commands
- ✅ `tests/README.md` — removed `--background` anti-pattern
- ✅ `tests/integration/README.md` — updated

No outstanding issues. Verification command `npm run test:integration` should now parse correctly (no `--background` error).

---

### Task 2: Split Unit From Integration Discovery ⚠️ PARTIAL
**Status:** Partially Complete  
**Committed:** `vitest.integration.config.ts` created  
**Missing Verification:** `vitest.config.ts` narrowing

The commit shows `vitest.integration.config.ts` was created, but the diff for `vitest.config.ts` is not in the commit. According to the plan:

**Required (Plan Step 2):** `vitest.config.ts` should have explicit `include`/`exclude` lists:
```ts
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
```

**Action:** Before Task 3, verify `vitest.config.ts` has the narrowed `include`/`exclude` or apply them.

---

### Task 3: Firebase Emulator Init + Admin Cleanup ❌ NOT DONE
**Files Required:**
- `tests/helpers/firebase-admin.ts` — **does not exist**
- `src/app/firebase/config.ts` — **not updated** (no `VITE_USE_FIREBASE_EMULATORS`, no `connectAuthEmulator`)

**Impact:** Integration tests still fail with `auth/network-request-failed` when run locally. The workflow jobs will not execute assertions.

**Verification Check:**
```bash
npx vitest run src/shared/services/auth.service.test.ts
```
Expected: FAIL with network errors (confirms Task 3 is missing).

**Next Steps:**
1. Create `tests/helpers/firebase-admin.ts` per plan Step 2–3
2. Update `src/app/firebase/config.ts` with emulator detection per plan Step 2
3. Migrate integration test cleanup to use the admin helper per plan Step 4
4. Rewrite integration fixtures to canonical `barangay`/`approximateCoordinates`/`isAnonymous` shape per plan Step 3

---

### Task 4: Stabilize Browser Globals + Smoke Test ❌ NOT DONE
**Files Required:**
- `src/test/setup.ts` — rewritten with deterministic `localStorage`/`matchMedia` mocks
- `src/shared/components/AgeGate.tsx` — guarded storage reads
- `src/shared/hooks/usePWAInstall.ts` — guarded storage reads
- `src/test/hello-world.test.tsx` — rewritten to assert current app shell

**Current State:**
```bash
npx vitest run src/test/hello-world.test.tsx
# Result: FAIL with "TypeError: localStorage.getItem is not a function"
```

**Evidence of Missing Work:**
- `src/test/setup.ts` line 18 has a TS error: `string | undefined` argument where `string` expected
- The safe-storage helper functions are not in `AgeGate.tsx` or `usePWAInstall.ts`
- The smoke test still references Phase 0 placeholder copy (per findings)

**Impact:** Unit tests crash immediately. Cannot run `npm run test:run`.

---

### Task 5: Compiler Baseline + Shared Utilities ❌ NOT DONE
**Current State:**
```bash
grep '"target"' tsconfig.json
# Output: "target": "ES2020",  ← WRONG
```

**TypeScript Errors from Missing Task 5:**
```
src/shared/services/functions.service.ts(63,16): error TS2550: Property 'cause' does not exist on type 'Error'.
  Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
```

**Count:** ~15 `Error.cause` TS2554 errors that will vanish when target is raised to ES2022.

**Quick Win:** Apply Task 5 Step 2 immediately:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

This unblocks Tasks 6 and 8 type cleanup.

---

### Task 6: Report/Auth Contract Canonicalization ❌ NOT DONE
**Blocked by:** Task 5 (compiler baseline)  
**Current Errors in `src/shared/services/auth.service.ts`:**
- Line 22: unused `serverTimestamp` import
- Lines 67, 101, 145, 186, 201, 214, 237, 275: `Error.cause` TS2554 (8× errors)
- Line 144: unused `errorCode` variable

**Blocked by:** Task 3 (emulator init)  
**Current Errors in integration helpers:**
- `tests/integration/test-helpers.ts`: report fixtures use wrong shape (`address`, `reportedBy` instead of `barangay`, `isAnonymous`)

**Action:** After Task 5, apply exact cleanups per plan Step 4 (remove stale imports, rename unused params to `_name`), then Task 6 Step 3 (rewrite fixtures to canonical shape).

---

### Task 7: Feature UI/Query Typing ✅ COMPLETE
**Commit:** `bacce08 fix(ui): align feature components with shared types`

**Changes Applied:**
- ✅ `alert.service.ts` — use `QueryConstraint[]` instead of Parameters type
- ✅ `AlertCard.tsx`, `AlertDetailModal.tsx` — add `?? Info` fallback for TYPE_ICON
- ✅ `useFeedReports.ts` — align `UseFeedReportsResult`, remove `isRefetching`
- ✅ `FeedList.tsx` — fix flattened data access
- ✅ `reportQueue.service.ts` — type `idb` with `DBSchema` interface
- ✅ `Button.tsx` — add `outline` variant and `sm` size
- ✅ `FeedReport` type — add `photoUrls`
- ✅ `MyReportsList.tsx` — remove `rejected` status
- ✅ `LocationSearch.tsx` — export `RecentSearch`

**Not Touched (Plan Lists These):**
- `FeedCard.tsx` — not modified
- `ReportDetailScreen.tsx` — not modified (assumed already clean or not in scope)
- `BeforeAfterGallery.tsx` — not modified
- `LinkReportsByPhone.tsx` — not modified

**Status:** Ready to merge for Task 7 only. Other files may have pre-existing type issues.

---

### Task 8: ESLint Debt Burndown ❌ NOT DONE
**Current State:**
```bash
npm run lint
# 125 errors (2 fixable), 155 warnings
```

**Sample Errors:**
- `tests/integration/test-helpers.ts:236` — unused `error` variable
- `tests/unit/validation.test.ts:15,276,321,342,371,406,479` — unused vars/params (should be `_name`)

**Blocked by:** Tasks 3, 4, 5, 6 (TS cleanups must be done first)

**Action:** After Tasks 3–6 land, run `npm run lint` again and apply remaining fixes per plan Step 2–3 (remove stale imports, use `_prefix` for intentional unused params).

---

## Current Test Suite Status

### Unit Tests
```bash
npm run test:run
# Result: CRASHES at App init — "localStorage.getItem is not a function" (Task 4 missing)
```

### Integration Tests
```bash
npm run test:integration
# Result: FAILS — auth tests try to reach real Firebase (Task 3 missing)
```

### Firestore Rules Tests
```bash
npm run test:rules
# Result: FAILS — integration test issues carry over
```

### E2E Tests
```bash
npm run test:e2e:ci
# Status: Unknown (not tested in this review); depends on emulator wiring (Task 3)
```

---

## Recommended Execution Order for Remaining Tasks

| Priority | Task | Rationale |
|----------|------|-----------|
| 1 | **Task 5** (Compiler Baseline) | Quick 2-line fix eliminates ~15 TS errors; unblocks Tasks 6, 8 |
| 2 | **Task 3** (Firebase Emulator Init) | Required for integration tests to run; unblocks Task 6 |
| 3 | **Task 4** (Browser Globals + Smoke) | Required for unit tests to run; unblocks full `test:run` execution |
| 4 | **Task 6** (Report/Auth Contracts) | Depends on Tasks 3 and 5; clears service-layer type debt |
| 5 | **Task 2 Verification** | Verify `vitest.config.ts` narrowing is correct; run `npm run test:run` to confirm unit discovery |
| 6 | **Task 8** (ESLint Burndown) | Final cleanup; depends on Tasks 3–6 |

---

## Blocking Issues Summary

| Issue | Task | Severity | Blocker For |
|-------|------|----------|------------|
| No `firebase-admin.ts` helper | 3 | 🔴 Critical | Integration tests, Task 6 |
| `firebase/config.ts` not emulator-aware | 3 | 🔴 Critical | Integration tests, emulator wiring |
| `tsconfig.json` at ES2020 | 5 | 🔴 Critical | `Error.cause` support, Tasks 6–8 |
| `localStorage` crashes in JSDOM | 4 | 🔴 Critical | Unit test execution |
| Stale smoke test assertions | 4 | 🟠 High | App shell smoke coverage |
| 125 ESLint errors | 8 | 🟠 High | CI lint gate |
| 38+ TS errors | 5, 6, 7 | 🟠 High | `npm run typecheck` gate |

---

## Files Needing Changes

### Immediate (Task 5 — Quick Win)
- `tsconfig.json` — 2 lines

### High Priority (Tasks 3, 4)
- `tests/helpers/firebase-admin.ts` — create
- `src/app/firebase/config.ts` — rewrite
- `src/test/setup.ts` — rewrite with mocks
- `src/shared/components/AgeGate.tsx` — add safe-storage helpers
- `src/shared/hooks/usePWAInstall.ts` — add safe-storage helpers
- `src/test/hello-world.test.tsx` — rewrite assertions

### Medium Priority (Tasks 6, 8)
- `src/shared/services/auth.service.ts` — cleanup
- `src/shared/services/firestore.service.ts` — cleanup
- `tests/integration/test-helpers.ts` — rewrite fixtures
- All integration test files — fix cleanup + fixtures
- `functions/src/index.ts` — remove stale imports
- Various feature files — rename unused params to `_name`

---

## Verification Checklist

After each task completion, run:

```bash
# Task 5 complete:
npm run typecheck  # Should show ~20 errors instead of ~38

# Task 3 complete:
firebase emulators:exec "vitest run --config vitest.integration.config.ts src/shared/services/auth.service.test.ts"
# Expected: PASS (no network errors)

# Task 4 complete:
npm run test:run  # Expected: PASS unit tests (no JSDOM crash)

# Task 6 complete:
npm run typecheck  # Should show <5 errors (only real domain mismatches)

# Task 2 verification:
npm run test:run  # Should collect only unit/browser tests, not E2E/a11y/functions

# All tasks complete:
npm run typecheck
npm run lint
npm run test:run
npm run test:integration
npm run test:rules
```

---

## Conclusion

The plan is **well-designed** and **well-sequenced**, but execution **halted mid-implementation**. Only foundational tasks (1, 2-partial, 7) are in place. The critical harness fixes (Tasks 3–6, 8) are untouched, leaving:
- ❌ Unit tests crashing (Task 4 missing)
- ❌ Integration tests unable to reach emulators (Task 3 missing)
- ❌ TypeScript not supporting `Error.cause` (Task 5 missing)
- ❌ CI lint/typecheck gates still failing (Tasks 6, 8 missing)

**Status: NOT MERGEABLE** — Resume execution at Task 5 (2-min fix), then Tasks 3→4→6→8 in sequence.
