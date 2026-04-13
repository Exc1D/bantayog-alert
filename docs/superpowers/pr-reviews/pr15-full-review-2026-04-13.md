# PR #15 Full Review — `fix/pr15-review-fixes`

**Date:** 2026-04-13
**Branch:** `fix/pr15-review-fixes` (8 commits ahead of main)
**Agents run:** code-reviewer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer

---

## Summary

| Severity | Count |
|----------|-------|
| Critical (must fix before merge) | 3 |
| Important (should fix before merge) | 8 |
| Suggestions (nice to have) | 9 |

---

## Critical — Must Fix Before Merge

### 1. Build-breaking escaped backtick in `useReportQueue.ts`
**File:** `src/features/report/hooks/useReportQueue.ts:162`
**Source:** Code Review (confidence 98%)

Template literal has literal `\`` sequences instead of real backticks — the exact bug documented in `docs/learnings.md` under "Template Literal Escaping in Edit Tool". `tsc` fails with TS1127.

**Fix:** Replace escaped backtick with a real template literal:
```typescript
// Wrong (current):
description: \`Reported \${reportData.incidentType} incident\`,

// Correct:
description: `Reported ${reportData.incidentType} incident`,
```

---

### 2. `STATUS_LABELS`/`STATUS_COLORS` missing `ReportStatus` values — runtime rendering bug
**File:** `src/features/profile/components/MyReportsList.tsx:30-42`
**Source:** Type Design (P0 — confirmed runtime bug)

`STATUS_LABELS` and `STATUS_COLORS` are typed `Record<ReportStatus, string>` but only define 4 keys (`pending`, `verified`, `resolved`, `rejected`). `ReportStatus` from `firestore.types.ts` has **6** members: `pending`, `verified`, `assigned`, `responding`, `resolved`, `false_alarm`. The key `'rejected'` is not a valid `ReportStatus` member at all.

**Runtime impact:** Reports in `assigned` or `responding` state (valid workflow states) render `StatusBadge` with `undefined` label and `undefined` CSS class — blank invisible badge, no error thrown.

**TypeScript impact:** `Record<ReportStatus, string>` requires all 6 keys — this is a compile error.

**Fix:**
```typescript
const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Pending',
  verified: 'Verified',
  assigned: 'Assigned',
  responding: 'Responding',
  resolved: 'Resolved',
  false_alarm: 'False Alarm',
}

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-blue-100 text-blue-800',
  assigned: 'bg-purple-100 text-purple-800',
  responding: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
  false_alarm: 'bg-gray-100 text-gray-800',
}
```

---

### 3. `isSubmitting` never reset to `false` on success path
**File:** `src/features/auth/components/SignUpFlow.tsx:151-168`
**Source:** Silent Failures (92%) + Tests (Critical)

`setIsSubmitting(true)` is called on enter. The `catch` block correctly calls `setIsSubmitting(false)`. The **success path** calls `onComplete()` and exits — `isSubmitting` is **never reset to false**.

In the current `Signup.tsx` page, this is masked by `navigate('/profile')` unmounting the component. In any embedded/modal use (the component accepts `onCancel` suggesting modal embedding is anticipated), the "Create Account" button stays permanently disabled after a successful registration with no error message shown.

**Fix:**
```typescript
const handleSubmit = useCallback(async () => {
  setSubmitError(null)
  setIsSubmitting(true)
  try {
    const result = await registerCitizen({
      email: form.email,
      password: form.password,
      displayName: form.displayName,
      phoneNumber: form.phoneNumber.trim() || undefined,
    })
    setIsSubmitting(false)          // ← add this before onComplete
    onComplete(result.user.uid)
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Registration failed. Please try again.'
    setSubmitError(message)
    setIsSubmitting(false)
  }
}, [form, onComplete])
```

---

## Important — Should Fix Before Merge

### 4. First Firestore query failure silently aborts the phone query
**File:** `src/features/profile/components/MyReportsList.tsx:63-115`
**Source:** Silent Failures (88%)

Both Firestore queries in `fetchReports` share one `try` block. A Firestore index error, permission failure, or network error on the `reporterUserId` query prevents the phone-linked query from running. Users who have phone-linked reports but whose userId query fails see total failure ("Failed to load reports") instead of partial results.

**Fix:** Wrap each query in its own `try/catch`:
```typescript
if (userId) {
  try {
    const snap = await getDocs(registeredQuery)
    // ... process docs
  } catch (err: unknown) {
    console.error('[MY_REPORTS] registered query failed:', err)
  }
}
if (userPhone) {
  try {
    const snap = await getDocs(linkedQuery)
    // ... process docs
  } catch (err: unknown) {
    console.error('[MY_REPORTS] phone-linked query failed:', err)
  }
}
if (allReports.length === 0) {
  setError('Failed to load reports. Please try again.')
}
```

---

### 5. `handleDeleteAccount` has no `console.error` — the only catch block in the file with no logging
**File:** `src/features/profile/components/RegisteredProfile.tsx:112-114`
**Source:** Silent Failures (95%)

Every other error handler in this component logs to `console.error('[TAG]', error)`: `handleSyncNow` (line 57), `handleLogout` (line 71), `handleDownloadData` (line 101). `handleDeleteAccount` is the only one that swallows the error with zero logging. Account deletion failures leave no trace for debugging.

**Fix:** Add `console.error('[DELETE_ACCOUNT_ERROR]', error)` in the catch block.

---

### 6. `handleDeleteAccount` shows raw Firebase error codes to users
**File:** `src/features/profile/components/RegisteredProfile.tsx:112-114`
**Source:** Silent Failures (82%)

Firebase `auth/requires-recent-login` propagates verbatim to the UI: `"Firebase: This operation is sensitive and requires recent authentication. Log in again before retrying this request. (auth/requires-recent-login)."` — completely non-actionable for a citizen user.

**Fix:**
```typescript
} catch (error) {
  const code = (error as { code?: string })?.code
  const message = code === 'auth/requires-recent-login'
    ? 'For security, please log out and log back in before deleting your account.'
    : error instanceof Error
      ? error.message
      : 'Failed to delete account. Please try again.'
  setDeleteError(message)
  console.error('[DELETE_ACCOUNT_ERROR]', error)
}
```

---

### 7. `orderBy('reportId', 'desc')` sorts by ID string, not by date
**File:** `src/features/profile/components/MyReportsList.tsx:72, 95`
**Source:** Code Review (85%)

Both Firestore queries use `orderBy('reportId', 'desc')` which sorts lexicographically by report ID string — not chronologically. The client-side `.sort()` on line 118 re-sorts by `createdAt` correctly, but Firestore's ordering is misleading and will interact badly with any future `limit()` or cursor-based pagination.

**Fix:** Change both queries to `orderBy('createdAt', 'desc')`.

---

### 8. `interface FormData` shadows the browser's global `FormData` API
**File:** `src/features/auth/components/SignUpFlow.tsx:30`
**Source:** Type Design (P1)

The module-scoped `interface FormData` shadows the browser's built-in `FormData` constructor. Within this file, `new FormData()` resolves to this interface type, not the browser class. No current usage is broken, but any future `fetch` multipart upload added to this file will get a confusing compile error.

**Fix:** Rename to `SignUpFormData` or `RegistrationFields`.

---

### 9. Test: `mockUser` has no `phoneNumber` — userPhone wire-up is never exercised
**File:** `src/features/profile/components/__tests__/RegisteredProfile.test.tsx:132`
**Source:** Tests (Critical)

The PR's key fix — wiring `user.phoneNumber` to `<MyReportsList>` — has no test confirming the wire works end-to-end. Both `RegisteredProfile.test.tsx` and `errorHandling.test.tsx` use a `mockUser` without `phoneNumber`. `user.phoneNumber` evaluates to `undefined`, so `undefined ?? undefined` = `undefined` and the phone query branch in `MyReportsList` is never triggered from the profile level.

**Fix:** Add `phoneNumber: '09171234567'` to `mockUser` in one describe block and assert the phone-linked reports path is triggered.

---

### 10. Test: `Signup.tsx` has zero tests
**File:** `src/app/Signup.tsx`
**Source:** Tests (Important)

The `Signup` page does two things beyond rendering `SignUpFlow`:
1. Parses `?phone=` from `useSearchParams` and passes it as `initialPhone` — this is the integration point with `LinkReportsByPhone` and a rename of the param on either side breaks silently.
2. Navigates to `/profile` on both `onComplete` and `onCancel`.

Both behaviors are completely untested.

---

### 11. Test: Deduplication logic in `MyReportsList` is untested
**File:** `src/features/profile/components/__tests__/MyReportsList.test.tsx`
**Source:** Tests (Critical)

The `seenIds` Set that prevents double-display of a report appearing in both the userId and phone queries is non-trivial business logic with no test. The linked-reports test (line 201) uses a *different* `reportId` for the phone query — it does not exercise the dedup path.

**Fix:** Add a test that passes the same `reportId` in both mocked `getDocs` responses and asserts the report card renders exactly once.

---

## Suggestions — Nice to Have

### 12. `LinkReportsByPhone` phone query uses un-normalized input
**File:** `src/features/profile/components/LinkReportsByPhone.tsx:52`
**Source:** Silent Failures (78%)

`validatePhone` strips spaces before validating, but the Firestore query uses the raw `phone` state value (which may contain spaces). A user entering `"0917 123 4567"` passes validation but the query finds nothing — Firestore stores `"09171234567"`. Silent wrong-result failure.

**Fix:** `const normalizedPhone = phone.replace(/\s/g, '')` before the query.

---

### 13. `useReportQueue` auto-sync effect missing `syncQueue` in dependency array
**File:** `src/features/report/hooks/useReportQueue.ts:82-86`
**Source:** Silent Failures (75%)

The auto-sync `useEffect` only lists `[isOnline]` as a dependency. It holds a stale `syncQueue` reference from initial render when `queue` was empty. When the device reconnects after reports have been queued, the stale closure may see `queue.length === 0` and silently skip sync.

**Fix:** Add `syncQueue` to the dependency array.

---

### 14. `ReportDetailModal.tsx` uses bare `catch (err)` without `: unknown`
**File:** `src/features/map/components/ReportDetailModal.tsx:46`
**Source:** Silent Failures (82%)

Inconsistent with project standard (`catch (err: unknown)`) and no structured log tag. Modified on this branch.

**Fix:**
```typescript
} catch (err: unknown) {
  console.error('[REPORT_DETAIL_FETCH_ERROR]', err)
  setError('Failed to load report details. Please try again.')
}
```

---

### 15. `Strength` type includes `'empty'` — implementation sentinel leaking into domain type
**File:** `src/features/auth/components/SignUpFlow.tsx:85`
**Source:** Type Design (P3)

`'empty'` is not a strength level — it is a "no input yet" sentinel used to hide the indicator. Replace with `PasswordStrength | null` return:

```typescript
type PasswordStrength = 'weak' | 'fair' | 'strong'
function getPasswordStrength(password: string): PasswordStrength | null {
  if (!password) return null
  // ...
}
const strengthInfo = getPasswordStrength(form.password) // null = hide indicator
```

---

### 16. `Step` navigation uses `as Step` casts — boundary guard removal becomes invisible regression
**File:** `src/features/auth/components/SignUpFlow.tsx:143, 148`
**Source:** Type Design (P4)

`((s + 1) as Step)` casts silence the type checker at mutation sites. If the `s < 7` guard is removed in the future, TypeScript will not catch the regression. Consider a `STEP_ORDER` array approach or at minimum a `const MAX_STEP = 7 as const`.

---

### 17. `incidentType: string` should use `IncidentType` from `firestore.types.ts`
**File:** `src/features/profile/components/MyReportsList.tsx:23`
**Source:** Type Design (P2)

`IncidentType` is already defined in `firestore.types.ts`. Using `string` allows `'zombie_attack'` as a valid `incidentType` in `ReportSummary`.

---

### 18. `municipality` and `agreedToPrivacy` are collected but not passed to `registerCitizen`
**File:** `src/features/auth/components/SignUpFlow.tsx:155-160`
**Source:** Code Review (70%)

Step 5 (municipality) is required and collected, but `registerCitizen` is called without it. If the service stores municipality for emergency response coordination, this is a data loss bug. Verify `registerCitizen`'s signature handles municipality separately or add it to the call.

---

### 19. Two separate `import` statements from `react-router-dom` in `Signup.tsx`
**File:** `src/app/Signup.tsx:8-9`
**Source:** Code Review (nit)

```typescript
// Current (two imports):
import { useSearchParams } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'

// Fix (one import):
import { useSearchParams, useNavigate } from 'react-router-dom'
```

---

## What's Good

- `catch (err: unknown)` used consistently in all new code (except pre-existing `ReportDetailModal`)
- `vi.hoisted()` mock pattern applied correctly in all test files — follows project `learnings.md`
- `Tab = 'info' | 'reports' | 'settings'` in `RegisteredProfile` is the model type design — string union, unexported, no casts, self-documenting
- Accessibility complete: `htmlFor`/`id` pairs, `aria-hidden` on decorative asterisks, `aria-current="step"` on progress indicator, `role="alert"` on all error messages
- `encodeURIComponent` applied correctly on `?phone=` query string in `LinkReportsByPhone`
- `autoComplete="new-password"` on password field, `autoComplete="email"` on email field
- Privacy Policy link uses `rel="noopener noreferrer"` with `target="_blank"`
- Password validation (8+ chars) plus strength indicator with three levels
- PH mobile regex consistent with existing `LinkReportsByPhone` pattern

---

## Recommended Action Plan

**Blocking — fix before any merge:**
1. Fix escaped backtick in `useReportQueue.ts:162`
2. Fix `STATUS_LABELS`/`STATUS_COLORS` to cover all 6 `ReportStatus` values, remove `rejected`
3. Add `setIsSubmitting(false)` before `onComplete()` in `SignUpFlow.handleSubmit`

**Should fix before merge:**
4. Wrap each `getDocs` call in its own `try/catch` in `MyReportsList`
5. Add `console.error` to `handleDeleteAccount` catch block
6. Map `auth/requires-recent-login` to user-friendly message in `handleDeleteAccount`
7. Change `orderBy('reportId')` → `orderBy('createdAt')` in both `MyReportsList` queries
8. Rename `FormData` → `SignUpFormData`
9. Add `phoneNumber` to `mockUser`, add dedup test, add `Signup.tsx` tests

**Nice to have (can be follow-up PRs):**
- Suggestions 12-19 above

---

*Generated by Claude Code PR Review Toolkit — 4 agents: code-reviewer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer*
