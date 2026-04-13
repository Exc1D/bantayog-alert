# PR #14 Review Findings
**Branch:** `feat/alerts-system-implementation-2026-04-12`
**Title:** Unified alert system with government geographic targeting
**Date:** 2026-04-12
**Review Agents:** code-reviewer, silent-failure-hunter, pr-test-analyzer, type-design-analyzer

---

## Critical Issues (2 found)

### 1. Firestore Rules Regression — `report_private` Delete Rule
- **Agent:** code-reviewer
- **Location:** `firestore.rules`
- **Issue:** The `report_private` delete rule was changed from `provincial_superadmin`-only to citizen-owner-uid, potentially allowing citizens to delete their own private reports.
- **Severity:** Critical — data integrity risk
- **Action:** Verify the intended scope of citizen delete permissions on `report_private`. If DPA compliance was the goal, ensure audit trail records are protected.

### 2. PR Scope Mismatch — TanStack Query vs onSnapshot
- **Agent:** test-analyzer
- **Location:** `useAlerts.ts`, `useAlerts.test.ts`
- **Issue:** PR description claims "rewrite useAlerts from TanStack Query to onSnapshot" but the code still uses TanStack Query. No tests exist for:
  - `onSnapshot` unsubscribe on unmount
  - IndexedDB cache fallback behavior
  - Dual-query merge (municipality/role filters)
  - Edge cases for undefined/null municipality/role
- **Severity:** Critical — implementation incomplete vs spec
- **Action:** Either complete the onSnapshot rewrite or update PR description to reflect actual scope.

---

## Important Issues (7 found)

### 3. Cache Write Silent Failure — No Sentry Tracking
- **Agent:** silent-failure-hunter
- **Location:** `alertsCache.ts:68`
- **Issue:** `cacheAlerts` uses `console.warn` (unmonitored in production) instead of `logError` with errorId for Sentry tracking.
- **Code:**
  ```typescript
  } catch (err: unknown) {
    console.warn('[alertsCache] Failed to persist alerts:', err instanceof Error ? err.message : err)
  }
  ```

### 4. Fire-and-Forget Cache Write — Empty Catch
- **Agent:** silent-failure-hunter
- **Location:** `useAlerts.ts:68`
- **Issue:** Cache persist is fire-and-forget with empty catch — no logging if it fails.
- **Code:**
  ```typescript
  cacheAlerts(latestAlertsRef.current).catch(() => {/* fire-and-forget */})
  ```

### 5. Cache Read Returns Empty on Error — Indistinguishable from "No Cache"
- **Agent:** silent-failure-hunter
- **Location:** `alertsCache.ts:99`
- **Issue:** `loadCachedAlerts` returns `[]` on error, giving callers no way to distinguish "genuinely empty cache" from "cache read failed."

### 6. IndexedDB oncomplete Resolves Even on Individual Put Failures
- **Agent:** silent-failure-hunter
- **Location:** `alertsCache.ts:61-64`
- **Issue:** Promise resolves on `tx.oncomplete`, but individual `store.put` failures only trigger `onerror` on that operation, not the transaction. If a `put` fails, `resolve()` is still called.
- **Code:**
  ```typescript
  tx.onerror = () => reject(new Error(...))
  tx.oncomplete = () => resolve()  // silently succeeds even if store.put() failed
  ```

### 7. UserContext Swallows All Firestore Errors
- **Agent:** code-reviewer, silent-failure-hunter
- **Location:** `UserContext.tsx:56-58`
- **Issue:** Catch treats ALL errors as "missing Firestore profile" — network failures, permission errors, and quota exhaustion all silently produce `municipality: undefined`.
- **Code:**
  ```typescript
  } catch {
    if (!cancelled) setProfile({})
  }
  ```
- **Action:** Distinguish "no profile" from "couldn't check profile" — at minimum log the error.

### 8. startAfter(undefined) Type Mismatch in getAlertsPage
- **Agent:** code-reviewer
- **Location:** `alert.service.ts:~258`
- **Issue:** When `lastDoc` is `undefined`, `startAfter(undefined)` is called. The result is cast with `as Parameters<typeof query>[1]` but the mock returns a string while production expects a `DocumentSnapshot`.
- **Code:**
  ```typescript
  constraints.push(startAfter(lastDoc) as Parameters<typeof query>[1])
  ```

### 9. Dual-Subscription Race Condition
- **Agent:** code-reviewer
- **Location:** `useAlerts.ts:73-88`
- **Issue:** When both `subscribeToAlerts` and `subscribeToAlertsByMunicipality` fire via `setTimeout(0)`, the second callback may receive `prev` state already merged by the first callback, causing potential duplicates since deduplication only runs within each `setAlerts` call.
- **Confidence:** 82%

---

## Suggestions (10 found)

### 10. Dead Code — mergeAlerts Callback Never Called
- **Agent:** code-reviewer
- **Location:** `useAlerts.ts:39`
- **Issue:** `mergeAlerts` callback defined via `useCallback` but never invoked. Inline merge logic duplicates its purpose.
- **Confidence:** 90%

### 11. isRefetching State Inconsistency
- **Agent:** code-reviewer
- **Location:** `useAlerts.ts`
- **Issue:** `isRefetching` semantics differ between single and dual subscription paths.
- **Confidence:** 75%

### 12. Non-Descriptive aria-label on Type Icon
- **Agent:** code-reviewer
- **Location:** `AlertCard.tsx:93`
- **Issue:** `aria-label="type-weather"` produces "type dash weather" for screen readers.
- **Suggestion:** `aria-label={type.charAt(0).toUpperCase() + type.slice(1)}` or `aria-hidden="true"` since type is redundant with other text.

### 13. createAlert Cloud Function — No targetAudience Enum Validation
- **Agent:** code-reviewer
- **Location:** `firestore.rules:~258`
- **Issue:** `createAlert` writes `targetAudience` directly to Firestore without validating it's `'all'`, `'municipality'`, or `'role'`. Invalid values would silently cause access failures.
- **Confidence:** 80%

### 14. Integrate alertsCache with Project logError Infrastructure
- **Agent:** silent-failure-hunter
- **Location:** `alertsCache.ts`
- **Suggestion:** Replace `console.warn` calls with `logError` using errorIds from `constants/errorIds.ts`.

### 15. Surface useAlerts Error State to UI
- **Agent:** silent-failure-hunter
- **Location:** `useAlerts.ts`
- **Suggestion:** Hook returns `error: Error | null` but no UI component consumes it. Add `AlertBanner` or inline error message.

### 16. Add Cache Fallback Test
- **Agent:** test-analyzer
- **Location:** `useAlerts.test.ts`
- **Suggestion:** Test where `getCollection` fails and hook should serve cached data.

### 17. Add onSnapshot Unsubscribe Test
- **Agent:** test-analyzer
- **Location:** `useAlerts.test.ts`
- **Suggestion:** Test that `onSnapshot` unsubscribe is called on unmount.

### 18. UserProfile Empty State Should Be Documented
- **Agent:** type-design-analyzer
- **Location:** `UserContext.tsx:13`
- **Issue:** `UserProfile` allows `{}` which is semantically meaningless for a real user.
- **Suggestion:** Document that `{}` is a valid anonymous-user sentinel value, or use a discriminated type.

### 19. isError / error Consistency
- **Agent:** type-design-analyzer
- **Location:** `useAlerts.ts:31`
- **Issue:** `isError: boolean` and `error: Error | null` are not enforced as a consistent pair. Nothing prevents `isError === false` with `error !== null`.
- **Suggestion:** Use discriminated union (`LoadingResult`, `ErrorResult`, `SuccessResult`) or rely on `isError` alone.

---

## Type Design Assessment (from type-design-analyzer)

| Category | Rating | Justification |
|----------|--------|---------------|
| **Encapsulation** | 9/10 | Excellent — `UserContextValue` exposes only what consumers need. Internal types not leaked. |
| **Invariant Expression** | 7/10 | `UserProfile` permits invalid empty state; `isError`/`error` relationship not encoded. |
| **Usefulness** | 8/10 | All invariants are practical — loading/error states, profile fields, serialized cache. |
| **Enforcement** | 8/10 | Correct `catch (err: unknown)` with instanceof checks. No bare `any`. Defensive JSON handling. |

**Overall:** Solid type design with minor issues. Most actionable: document `UserProfile {}` as valid anonymous sentinel.

---

## Strengths

- **`alertsCache.ts`**: Clean IndexedDB caching layer with defensive JSON parse handling
- **`alert.service.ts`**: Comprehensive service with real-time subscriptions and proper `Error` cause chains
- **`useAlerts.ts`**: Thoughtful error handling with cache fallback, proper cleanup via `unsubscribers`, React 18 StrictMode compliance
- **`firestore.rules`**: Well-designed alert rules with geographic matching
- **`AlertDetailModal`**: `navigator.share` + clipboard fallback, proper `AbortError` handling
- **Accessibility**: `aria-hidden` on decorative icons, descriptive refresh button label

---

## Recommended Action

1. **Verify Firestore rules** — the `report_private` delete regression is a data-integrity risk
2. **Clarify PR scope** — complete the onSnapshot rewrite or update description
3. **Add missing tests** — cache fallback, unsubscribe cleanup, dual-query merge
4. **Fix error surfacing** — `UserContext` errors and cache failures should be observable (logError, not console.warn)
5. **Clean up dead code** — remove unused `mergeAlerts` callback
6. **Address suggestions** before or after merge (track in follow-up tickets)
