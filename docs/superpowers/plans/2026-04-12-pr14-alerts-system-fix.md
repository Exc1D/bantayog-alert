# Alerts System PR Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix CI failures on `feat/alerts-system-implementation-2026-04-12` (PR #14) so the alerts feature can merge cleanly into `main`.

**Architecture:** Two independent fix areas — (1) lint fix on `main` branch so merge-check passes, (2) ReportForm test updates on the alerts branch to account for new DPA consent step. Both must land for the PR to be mergeable.

**Tech Stack:** TypeScript, ESLint v9 flat config, Vitest, Firebase

---

## Problem Summary

| CI Job | Failure | Root Cause |
|--------|---------|------------|
| Lint | `Cannot find package 'typescript-eslint'` | `eslint.config.js` imports `typescript-eslint` but only `@typescript-eslint/*` packages exist |
| Unit Tests | 14 ReportForm tests fail | Branch added DPA consent flow (`PrivacyPolicyModal`) to submit path — existing tests don't account for it |
| Build | TypeScript errors in `useReportQueue.ts` | Pre-existing on `main` (not caused by this branch) |
| Typecheck | Same pre-existing errors | Pre-existing on `main` |

---

## Task 1: Fix Lint — Add `typescript-eslint` package to `main`

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto-generated)

- [ ] **Step 1: Add `typescript-eslint` package to `package.json`**

The `eslint.config.js` imports `tseslint from 'typescript-eslint'`, which requires the top-level `typescript-eslint` package (not just the scoped `@typescript-eslint/*` plugins).

Edit `package.json` devDependencies — add `"typescript-eslint": "^8.18.2"` alongside existing `@typescript-eslint/*` entries (version should match).

```json
"typescript-eslint": "^8.18.2",
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint 2>&1`
Expected: No errors (or only pre-existing non-breaking warnings)

- [ ] **Step 3: Commit**

```bash
cd /home/exxeed/dev/projects/bantayog-alert
git add package.json package-lock.json
git commit -m "fix(deps): add typescript-eslint package for eslint config

ESLint v9 flat config imports 'typescript-eslint' directly, but only
the scoped @typescript-eslint/* packages were installed. Adding the
top-level package resolves the ERR_MODULE_NOT_FOUND error in CI.
"
```

---

## Task 2: Fix ReportForm Tests — Add DPA Consent Flow Tests

**Files:**
- Modify: `src/features/report/components/__tests__/ReportForm.test.tsx`
- Test: `src/features/report/components/__tests__/ReportForm.test.tsx`

**Context:** `src/features/report/components/ReportForm.tsx` now shows a `PrivacyPolicyModal` (DPA consent) as part of the submit flow. The `handleSubmit` function:

1. Validates the form (incidentType, phone, photos)
2. If all valid, shows the Privacy Policy modal
3. User must agree to privacy policy to proceed
4. On agree → submit the report

The existing tests do not include this new step. Tests that call `handleSubmit` and expect `ReportSuccess` need to also handle the modal consent flow.

- [ ] **Step 1: Read the ReportForm test file to understand existing test patterns**

Run: `wc -l src/features/report/components/__tests__/ReportForm.test.tsx`
Run: `grep -n "handleSubmit\|ReportSuccess\|fireEvent.click\|userEvent.click" src/features/report/components/__tests__/ReportForm.test.tsx | head -40`

- [ ] **Step 2: Read ReportForm.tsx to understand the consent flow**

Focus on: `handleSubmit`, `showPrivacyPolicy`, `isAgreed`, and how `onSubmit` is called relative to the modal.

- [ ] **Step 3: Write a failing test — verify DPA consent modal appears**

```typescript
it('should show privacy policy modal when submitting valid form', async () => {
  const user = userEvent.setup()
  render(<ReportForm />)

  // Fill required fields
  await selectIncidentType('flood')
  await enterPhone('09171234567')
  // ... (photo selection mocked)

  // Submit
  const submitBtn = screen.getByRole('button', { name: /submit report/i })
  await user.click(submitBtn)

  // Privacy policy modal should appear
  expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument()
  expect(screen.getByText(/consent.*processing.*personal data/i)).toBeInTheDocument()
})
```

Run: `npm run test -- --run src/features/report/components/__tests__/ReportForm.test.tsx --grep "privacy policy modal"`
Expected: FAIL — function not yet written

- [ ] **Step 4: Write the DPA consent test and fix existing failing tests**

Update the 14 failing tests to include the DPA consent step before `ReportSuccess` appears. Pattern:

```typescript
// After submitting valid form
await user.click(screen.getByRole('button', { name: /submit report/i }))
// DPA consent modal appears
await waitFor(() => {
  expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument()
})
// Agree to policy
await user.click(screen.getByLabelText(/I have read and agree/i))
await user.click(screen.getByRole('button', { name: /submit/i }))
// Now ReportSuccess appears
await waitFor(() => {
  expect(screen.getByTestId('report-id')).toBeInTheDocument()
})
```

Each test that submits a valid form and expects `ReportSuccess` needs this consent step inserted between the submit click and the success assertion.

- [ ] **Step 5: Run full ReportForm test suite**

Run: `npm run test -- --run src/features/report/components/__tests__/ReportForm.test.tsx`
Expected: All 28 tests pass

- [ ] **Step 6: Commit**

```bash
cd /home/exxeed/dev/projects/bantayog-alert/.worktrees/alerts-system
git add src/features/report/components/__tests__/ReportForm.test.tsx
git commit -m "test(ReportForm): add DPA consent flow to submit tests

ReportForm now shows PrivacyPolicyModal as part of the DPA compliance
submit flow. Existing tests expected ReportSuccess immediately after
submit click but need to account for the consent modal step.

Added DPA consent test covering the modal appearance and agreement
flow. Updated all happy-path and valid-form submission tests to
click agree before expecting ReportSuccess.
"
```

---

## Task 3: Verify Full Test Suite

- [ ] **Step 1: Run alerts tests**

Run: `npm run test -- --run src/features/alerts/`
Expected: 110+ tests pass

- [ ] **Step 2: Run ReportForm tests**

Run: `npm run test -- --run src/features/report/components/__tests__/ReportForm.test.tsx`
Expected: 28 tests pass

- [ ] **Step 3: Run typecheck (ignore pre-existing errors in useReportQueue.ts)**

Run: `npm run typecheck 2>&1 | grep -v "useReportQueue.ts"`
Expected: Only pre-existing errors in `useReportQueue.ts` remain

- [ ] **Step 4: Run lint**

Run: `npm run lint 2>&1`
Expected: No errors

---

## Verification Commands

```bash
# On main branch:
git checkout main
git pull
# Fix lint by adding typescript-eslint package
# Then:
git push origin main

# On alerts branch (worktree):
cd /home/exxeed/dev/projects/bantayog-alert/.worktrees/alerts-system
git pull --rebase origin main  # bring in lint fix
git push origin feat/alerts-system-implementation-2026-04-12
# Verify PR #14 CI passes
```

---

## NOT Doing

- **NOT fixing pre-existing TypeScript errors in `useReportQueue.ts`** — these exist on `main` and are outside scope of this PR
- **NOT changing ReportForm component logic** — only updating tests to match existing behavior
- **NOT modifying DPA consent flow** — feature is already correctly implemented, tests just need to catch up

---

## Risks

1. **Merge conflict with main:** If `ReportForm.tsx` changed on main during the work, tests may need further adjustment — verify after rebasing.
2. **Other ReportForm tests may also need DPA consent step:** Only 14 tests are failing, but there may be passing tests that will break if they don't account for the modal — run full suite to verify.
3. **`typescript-eslint` version mismatch:** Use `^8.18.2` to match the existing `@typescript-eslint/*` versions already in package.json.