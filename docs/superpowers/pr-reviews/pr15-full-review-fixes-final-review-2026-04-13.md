# PR #15 Full Review — Final Review (Round 2)

**Date:** 2026-04-13
**Branch:** `fix/pr15-full-review-fixes` (8 commits ahead of main)
**Agents run:** Silent Failures, Type Design, Code Review, Test Coverage

---

## Executive Summary

| Severity | Silent Failures | Type Design | Code Review | Test Coverage |
|----------|----------------|-------------|-------------|--------------|
| Critical | 1 | 0 | 0 | 0 |
| Important | 2 | 1 | 2 | 4 |
| Suggestions | 3 | 4 | 3 | 3 |

**Overall Assessment:** **APPROVED with 1 critical fix required before merge.**

---

## Critical — Must Fix Before Merge

### 1. Auto-Sync Effect Missing Error Handling
**Agent:** Silent Failures
**File:** `src/features/report/hooks/useReportQueue.ts:82-86`
**Confidence:** 95%

**Issue:** The auto-sync useEffect calls `syncQueue()` without error handling. If auto-sync fails (network issues, server errors, corrupted data), the error is swallowed. The user has no indication that their queued reports failed to sync.

```typescript
// Current (problematic):
useEffect(() => {
  if (isOnline && queue.length > 0 && !isSyncing) {
    syncQueue()  // ❌ No try/catch, no error handling
  }
}, [isOnline])
```

**Risk:** Queued reports may fail to sync silently, leaving users with false confidence that their reports were submitted.

**Fix:**
```typescript
useEffect(() => {
  if (isOnline && queue.length > 0 && !isSyncing) {
    syncQueue().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Auto-sync failed'
      console.error('[AUTO_SYNC_ERROR]', message)
    })
  }
}, [isOnline, queue.length, isSyncing, syncQueue])
```

**Alternative:** Move error handling into `syncQueue` itself and ensure it never throws.

---

## Important — Should Fix Before Merge

### 2. Missing Error State Reset on Step Navigation
**Agent:** Silent Failures
**File:** `src/features/auth/components/SignUpFlow.tsx:126-129, 131-144`
**Confidence:** 90%

**Issue:** `updateField` clears `error` but not `submitError`. When user navigates between steps, the submit error from a failed registration persists on the review step.

```typescript
const updateField = useCallback(<K extends keyof SignUpFormData>(key: K, value: SignUpFormData[K]) => {
  setForm((prev) => ({ ...prev, [key]: value }))
  setError(null)  // ✅ Clears validation error
  // ❌ Missing: setSubmitError(null)
}, [])
```

**Impact:** User sees stale error message from previous failed submission attempt when they return to the review step.

**Fix:**
```typescript
const updateField = useCallback(<K extends keyof SignUpFormData>(key: K, value: SignUpFormData[K]) => {
  setForm((prev) => ({ ...prev, [key]: value }))
  setError(null)
  setSubmitError(null)  // Add this line
}, [])
```

### 3. No Partial Error State for Partial Query Failures
**Agent:** Silent Failures
**File:** `src/features/profile/components/MyReportsList.tsx:136-140`
**Confidence:** 85%

**Issue:** If `registeredQuery` succeeds but `linkedQuery` fails (or vice versa), user sees their successful reports with no indication that other reports failed to load.

```typescript
if (totalAttempted > 0 && attemptedQueries === totalAttempted) {
  setError('Failed to load reports. Please try again.')
} else {
  setReports(allReports)  // ❌ Sets reports even if one query errored
}
```

**Fix:**
```typescript
const [partialError, setPartialError] = useState<string | null>(null)

// After setting reports:
if (registeredQueryErrored !== linkedQueryErrored) {
  setPartialError('Some reports could not be loaded. Refresh to try again.')
}

// In render, show warning:
{partialError && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm mb-4">
    ⚠️ {partialError}
  </div>
)}
```

### 4. Unsafe Type Assertion in handleDeleteAccount
**Agent:** Type Design
**File:** `src/features/profile/components/RegisteredProfile.tsx:115`
**Confidence:** 85%

**Issue:** Using type assertion `(error as { code?: string })?.code` without proper validation.

```typescript
const code = (error as { code?: string })?.code
```

**Fix:** Use a proper type guard:
```typescript
function isFirebaseAuthError(err: unknown): err is { code: string; message: string } {
  return typeof err === 'object' && err !== null && 'code' in err
}

// Usage:
if (isFirebaseAuthError(error) && error.code === 'auth/requires-recent-login') {
  setDeleteError('For security, please log out and log back in before deleting your account.')
}
```

### 5. Missing Null Check for Firestore Document Data
**Agent:** Type Design
**File:** `src/features/profile/components/MyReportsList.tsx:84-94`
**Confidence:** 90%

**Issue:** Accessing `docSnap.data()` without null check. If Firestore returns partial documents, this could cause runtime errors.

```typescript
const data = docSnap.data()
if (!seenIds.has(data.reportId)) {  // ❌ data could be undefined
  // ...
}
```

**Fix:**
```typescript
const data = docSnap.data()
if (!data) continue

const reportId = data.reportId
if (!reportId || !reportIdId) continue
```

### 6. Firestore Index Requirements Undocumented
**Agent:** Code Review
**File:** `src/features/profile/components/MyReportsList.tsx:75-79, 105-109`
**Confidence:** 95%

**Issue:** The component uses composite queries with `where()` + `orderBy()` which require Firestore composite indexes. Without these indexes, queries fail at runtime with: *"The query requires an index. You can create it here: [URL]"*

**Fix:** Add documentation comment:
```typescript
// NOTE: Requires Firestore composite indexes:
// 1. reporterUserId + createdAt (descending)
// 2. reporterPhone + createdAt (descending)
// Create these in Firebase Console > Firestore > Indexes
```

Alternatively, create `firestore.indexes.json` for deployment automation.

### 7. Partial Error Recovery Not Tested
**Agent:** Test Coverage
**File:** `src/features/profile/components/__tests__/MyReportsList.test.tsx`
**Confidence:** 95%

**Issue:** The component shows reports if at least one query succeeds, but this partial recovery logic is not explicitly tested.

**Missing Tests:**
- Registered query fails but linked query succeeds → should show linked reports (no error)
- Linked query fails but registered query succeeds → should show registered reports (no error)

### 8. Missing Status Value Tests
**Agent:** Test Coverage
**File:** `src/features/profile/components/__tests__/MyReportsList.test.tsx`
**Confidence:** 90%

**Issue:** Tests cover pending, verified, resolved, false_alarm but are missing `assigned` and `responding` status badges.

**Suggested Test:**
```typescript
it('should display assigned and responding status badges', async () => {
  const reports = [
    createReport({ reportId: 'r1', status: 'assigned' }),
    createReport({ reportId: 'r2', status: 'responding' }),
  ]
  // ... assertions
})
```

### 9. isSubmitting Reset Not Explicitly Tested
**Agent:** Test Coverage
**File:** `src/features/auth/components/__tests__/SignUpFlow.test.tsx`
**Confidence:** 85%

**Issue:** The fix added `setIsSubmitting(false)` before `onComplete`, but there's no test verifying the button re-enables before navigation.

### 10. handleDeleteAccount Error Path Not Tested
**Agent:** Test Coverage
**File:** `src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx`
**Confidence:** 80%

**Issue:** The specific `auth/requires-recent-login` error handling is not tested.

---

## Suggestions — Nice to Have

### 11. ReportSummary.incidentType Should Use Domain Type
**Agent:** Type Design
**File:** `src/features/profile/components/MyReportsList.tsx:23`
**Confidence:** 95%

**Issue:** Using `string` instead of `IncidentType` from domain model.

```typescript
interface ReportSummary {
  incidentType: string  // Should be IncidentType
}
```

**Fix:**
```typescript
import { IncidentType } from '@/shared/types/firestore.types'

interface ReportSummary {
  incidentType: IncidentType
}
```

### 12. SignUpFormData.municipality Type Too Permissive
**Agent:** Type Design
**File:** `src/features/auth/components/SignUpFlow.tsx:35`
**Confidence:** 75%

**Issue:** `municipality: string` allows any string. Could use a more specific type.

### 13. Console Error Without User Recovery Path
**Agent:** Silent Failures
**File:** `src/features/profile/components/MyReportsList.tsx:96-99, 126-129`
**Confidence:** 75%

**Issue:** Errors are logged but no retry mechanism for users.

**Suggestion:** Add a retry button in the error UI.

### 14. Step Type Could Use Enum for Clarity
**Agent:** Type Design
**File:** `src/features/auth/components/SignUpFlow.tsx:39`
**Confidence:** 60%

**Issue:** Union type `1 | 2 | 3 | 4 | 5 | 6 | 7` is less readable than enum.

### 15. Duplicate Status Filtering Logic
**Agent:** Code Review
**File:** `src/features/profile/components/MyReportsList.tsx:210-226`
**Confidence:** 90%

**Issue:** Six separate filter blocks are repetitive. Could be refactored to use `STATUS_ORDER.map()`.

### 16. Inconsistent Error Message Capitalization
**Agent:** Code Review
**File:** `src/features/profile/components/MyReportsList.tsx:140`
**Confidence:** 85%

**Issue:** Error message uses sentence case while other parts of codebase may use title case.

### 17. Password Strength Logic Could Use Constants
**Agent:** Code Review
**File:** `src/features/auth/components/SignUpFlow.tsx:87-99`
**Confidence:** 75%

**Issue:** Magic numbers in password strength calculation not extracted as constants.

---

## What's Good

Across all 4 reviews, these strengths were consistently noted:

- ✅ **Proper `unknown` type usage in catch blocks** — Follows TypeScript strict mode
- ✅ **Excellent error handling patterns** — Consistent use of `catch (err: unknown)`
- ✅ **Strong test coverage** — All modified files have comprehensive test suites
- ✅ **Accessibility complete** — Proper ARIA labels, semantic HTML
- ✅ **Security conscious** — Input validation, no sensitive data in logs
- ✅ **Firestore independent try/catch** — Prevents cascading failures
- ✅ **User-friendly error messages** — Especially the `auth/requires-recent-login` mapping
- ✅ **Exhaustive status coverage** — All 6 ReportStatus values covered
- ✅ **Mock quality** — Proper `vi.hoisted()` patterns
- ✅ **Code organization** — Clear separation of concerns

---

## Recommended Action Plan

**Blocking — fix before any merge:**
1. Fix auto-sync error handling in `useReportQueue.ts` useEffect

**Should fix before merge:**
2. Add `setSubmitError(null)` to `updateField` in `SignUpFlow`
3. Add partial error state to `MyReportsList` (or document as known limitation)
4. Add null check for `docSnap.data()` in `MyReportsList`
5. Document Firestore index requirements
6. Add tests for partial error recovery, assigned/responding statuses, isSubmitting reset, and handleDeleteAccount error path
7. Use type guard for Firebase error code extraction (optional but recommended)

**Nice to have (defer to follow-up PRs):**
- Suggestions 11-17 above

---

*Generated by Claude Code PR Review Toolkit — 4 agents: Silent Failures, Type Design, Code Review, Test Coverage*
