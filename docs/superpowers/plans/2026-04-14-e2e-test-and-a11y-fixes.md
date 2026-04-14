# E2E Test Fixes & Accessibility Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all failing e2e and a11y tests by addressing AgeGate bypass, color contrast violations, and test selector mismatches.

**Architecture:** Two parallel tracks:

1. **Test Infrastructure:** Add `age_verified` localStorage bypass to all e2e tests via Playwright `addInitScript`
2. **Accessibility:** Fix `text-gray-400` contrast violations in AgeGate and ReportForm

**Tech Stack:** Playwright, Vitest, axe-core

---

## Issue Summary

| #   | Issue                                   | Root Cause                                                      | Impact                                     |
| --- | --------------------------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| 1   | AgeGate blocks all e2e tests            | Tests don't pre-set `localStorage.age_verified`                 | 30+ tests fail - can't interact with pages |
| 2   | WCAG color contrast failure             | `text-gray-400` (#9ca3af) on white (#fff) = 2.53:1, needs 4.5:1 | 3 a11y tests fail                          |
| 3   | `data-testid="feed-card"` not found     | Selector mismatch or component not rendering                    | 1 a11y test fails                          |
| 4   | `data-testid^="alert-card"` not loading | AgeGate blocking + Firebase Emulator not running                | 15+ e2e tests timeout                      |
| 5   | `ul[aria-label*="benefit" i]` not found | Profile page structure changed                                  | 1 a11y test fails                          |
| 6   | `type="button"` missing                 | Button component doesn't set default type                       | 1 a11y test fails                          |
| 7   | Map filter test timeout                 | AgeGate overlay intercepts click                                | 1 a11y test times out                      |

---

## Task 1: Add AgeGate Bypass to All E2E Tests

**Files:**

- Modify: `tests/e2e/alert-viewing.spec.ts:10-16`
- Modify: `tests/e2e/auth-flows.spec.ts`
- Modify: `tests/e2e/citizen-journey.spec.ts`
- Modify: `tests/e2e/map.spec.ts`
- Modify: `tests/e2e/offline-queue.spec.ts`
- Modify: `tests/e2e/photo-upload.spec.ts`
- Modify: `tests/e2e/rate-limiting.spec.ts`
- Modify: `tests/e2e/report-submission.spec.ts`
- Modify: `tests/e2e/report-tracking.spec.ts`

- [ ] **Step 1: Create shared test fixture for AgeGate bypass**

Create file: `tests/e2e/fixtures/age-gate.fixture.ts`

```typescript
import { test as base } from '@playwright/test'

export const ageGateTest = base.extend({
  storageState: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await context.close()
    await use({})
  },
})
```

- [ ] **Step 2: Add global setup with AgeGate bypass**

Modify: `playwright.config.ts` - add `beforeEach` or use `addInitScript` in webServer config

Actually, the simpler approach is to add to each test file. Let's check the existing pattern first:

```typescript
// Add to each test file beforeEach:
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('age_verified', 'true')
  })
  await page.goto('/route')
})
```

- [ ] **Step 3: Fix alert-viewing.spec.ts**

Modify: `tests/e2e/alert-viewing.spec.ts`

```typescript
test.beforeEach(async ({ page }) => {
  // Bypass age gate
  await page.addInitScript(() => {
    localStorage.setItem('age_verified', 'true')
  })
  await page.goto('/alerts')
})
```

- [ ] **Step 4: Fix auth-flows.spec.ts**

- [ ] **Step 5: Fix citizen-journey.spec.ts**

- [ ] **Step 6: Fix map.spec.ts**

- [ ] **Step 7: Fix offline-queue.spec.ts**

- [ ] **Step 8: Fix photo-upload.spec.ts**

- [ ] **Step 9: Fix rate-limiting.spec.ts**

- [ ] **Step 10: Fix report-submission.spec.ts**

- [ ] **Step 11: Fix report-tracking.spec.ts**

---

## Task 2: Fix WCAG Color Contrast Violations

**Files:**

- Modify: `src/shared/components/AgeGate.tsx:109`
- Modify: `src/features/report/components/ReportForm.tsx` (find gray-400 text)

- [ ] **Step 1: Fix AgeGate contrast violation**

The text "If you are under 13..." uses `text-gray-400` which fails contrast.

Modify: `src/shared/components/AgeGate.tsx:109`

Change:

```tsx
<p className="text-xs text-gray-400 mt-6">
```

To:

```tsx
<p className="text-xs text-gray-500 mt-6">
```

Wait — gray-500 (#6b7280) on white = 4.63:1, which passes. Let me verify...

Actually, let me check what the actual contrast would be:

- gray-400 = #9ca3af → contrast 2.53:1 on white (FAIL)
- gray-500 = #6b7280 → contrast 4.63:1 on white (PASS WCAG AA)

So changing to `text-gray-500` fixes it.

- [ ] **Step 2: Fix ReportForm contrast violations**

Find: `(May nasaktan ba?)` and `(Lumalala ba ang sitwasyon?)` text with `text-gray-400`

These appear to be helper text in a Filipino localization context. Change `text-gray-400` to `text-gray-500` in the ReportForm component.

- [ ] **Step 3: Run a11y tests to verify fixes**

Run: `npm run test:e2e -- tests/a11y/feed-a11y.test.ts tests/a11y/report-a11y.test.ts tests/a11y/profile-a11y.test.ts`

Expected: Color contrast violations should be resolved

---

## Task 3: Fix Feed A11y Test - Missing feed-card

**Files:**

- Modify: `tests/a11y/feed-a11y.test.ts`
- Investigate: `src/features/feed/components/FeedList.tsx` or `FeedCard.tsx`

- [ ] **Step 1: Check FeedCard component for data-testid**

Read: `src/features/feed/components/FeedCard.tsx` to see if `data-testid="feed-card"` exists

- [ ] **Step 2: Fix feed-a11y test selector**

If `data-testid="feed-card"` doesn't exist, the test should use a different selector like `article` or `getByRole('article')`.

Modify: `tests/a11y/feed-a11y.test.ts:13-15`

```typescript
test('should have accessible feed cards', async ({ page }) => {
  // Use role selector instead of data-testid
  const firstCard = page.locator('article').first()
  await expect(firstCard).toBeVisible()

  const heading = firstCard.locator('h2, h3').first()
  await expect(heading).toBeVisible()
})
```

---

## Task 4: Fix Profile A11y Tests

**Files:**

- Modify: `tests/a11y/profile-a11y.test.ts`

- [ ] **Step 1: Fix benefits list selector**

The test looks for `ul[aria-label*="benefit" i]` but the component may use a different structure.

Read: `src/features/profile/components/` to find the benefits list implementation

- [ ] **Step 2: Fix create account button type attribute**

The test expects `type="button"` but the Button component may not set it. Either:

1. Fix the Button component to default to `type="button"`
2. Or update the test to check for the attribute differently

Modify: `src/shared/components/Button.tsx`

Add `type="button"` as default:

```typescript
<button
  type={type || 'button'}  // Ensure button defaults to type="button"
  ...
>
```

Actually, looking at the test error, the button IS found but the `type` attribute is `null` not `"button"`. We need to add `type="button"` to the Button component's button element.

---

## Task 5: Verify All Tests Pass

- [ ] **Step 1: Run full e2e test suite**

Run: `npm run test:e2e 2>&1 | tail -50`

Expected: All tests should pass or have only pre-existing infrastructure failures (Firebase Emulator not running)

- [ ] **Step 2: Run a11y tests**

Run: `npm run test:e2e -- tests/a11y/`

Expected: 0 violations

---

## Files Summary

| File                                            | Change                            |
| ----------------------------------------------- | --------------------------------- |
| `tests/e2e/alert-viewing.spec.ts`               | Add age gate bypass               |
| `tests/e2e/auth-flows.spec.ts`                  | Add age gate bypass               |
| `tests/e2e/citizen-journey.spec.ts`             | Add age gate bypass               |
| `tests/e2e/map.spec.ts`                         | Add age gate bypass               |
| `tests/e2e/offline-queue.spec.ts`               | Add age gate bypass               |
| `tests/e2e/photo-upload.spec.ts`                | Add age gate bypass               |
| `tests/e2e/rate-limiting.spec.ts`               | Add age gate bypass               |
| `tests/e2e/report-submission.spec.ts`           | Add age gate bypass               |
| `tests/e2e/report-tracking.spec.ts`             | Add age gate bypass               |
| `src/shared/components/AgeGate.tsx:109`         | `text-gray-400` → `text-gray-500` |
| `src/shared/components/Button.tsx`              | Add `type="button"` default       |
| `src/features/report/components/ReportForm.tsx` | Fix gray-400 helper text          |
| `tests/a11y/feed-a11y.test.ts`                  | Fix selector to `article`         |
| `tests/a11y/profile-a11y.test.ts`               | Fix selectors                     |

---

## Verification Commands

```bash
# Run a11y tests only
npm run test:e2e -- tests/a11y/

# Run e2e tests only
npm run test:e2e -- tests/e2e/

# Expected output after fixes:
# - All a11y tests: 0 violations
# - All e2e tests: pass (except Firebase Emulator-dependent tests)
```

---

## Risks

1. **Firebase Emulator dependency:** Some e2e tests require Firebase Emulators running (`firebase emulators:start`). Without it, alert viewing tests will timeout. This is an infrastructure requirement, not a code bug.
2. **FeedCard data-testid:** If the FeedCard component truly doesn't have `data-testid="feed-card"`, we need to either add it or update the test selector.
3. **Button type attribute:** Adding `type="button"` as default might change existing button behavior in forms (e.g., if any button relies on `type="submit"` default).

**Plan complete.** Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
