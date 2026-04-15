# Progress - 2026-04-15

## Task 9 — SOSButton Component

**Branch:** `feat-responder-dispatch-workflow-task8`

### What Changed

**`SOSButton.tsx`** (282 lines) — Self-contained component calling `useSOS()` internally:
- **Hold-to-activate**: 3-second press-and-hold using `requestAnimationFrame` loop. SVG progress ring fills over 3 seconds via `stroke-dashoffset` animation.
- **Activating state**: Button shows `bg-red-700` while held; aria-label updates to "Hold to activate SOS — in progress"
- **Active state**: Confirmation panel with location coordinates, GPS sharing status, cancel window status, and Cancel SOS button (shown only when `canCancel = true`)
- **Cancelled state**: Brief panel showing cancellation reason; SOS button hidden
- **Error state**: Red-bordered alert panel showing error code and message from `useSOS().error`
- **Cancel confirmation**: Uses `window.confirm()` for intentional emergency guard

**`SOSButton.test.tsx`** (427 lines) — 23 tests covering:
- Idle state (button renders, no panels)
- Hold-to-activate (3s triggers, early release cancels, touch events, disabled when active)
- Active state (panel, coordinates, cancel button visibility, cancel confirmation flow)
- Cancelled state (reason display, button hidden)
- Error state (GPS_TIMEOUT, SOS_OFFLINE)
- className forwarding
- Location unavailable fallback

### Design Decisions

- **RAF loop vs setInterval**: Used `requestAnimationFrame` for smoother progress animation (smoother than 60fps setInterval)
- **Circular SVG progress ring**: Visual feedback matches common mobile patterns (circular countdown)
- **Inline panel vs Modal**: Small confirmation panel avoids Modal dependency complexity; positioned in top-right by consumer
- **window.confirm()**: Simple, synchronous, blocks the thread — unambiguous for emergency cancellation confirmation
- **No props**: Component self-contained (calls `useSOS()` internally, matches `QuickStatusButtons`/`DispatchList` pattern)

### Test Summary

- **SOSButton tests:** 23/23 passing
- **All responder domain tests:** 103/103 passing
- **TypeScript:** Clean (no new errors)
- **Pre-existing failures:** MapView.test.tsx and other unrelated tests (infrastructure/firebase mock gaps)

### Files Changed

| File | Change |
|------|--------|
| `src/domains/responder/components/SOSButton.tsx` | New — SOS button with hold-to-activate and cancellation UI |
| `src/domains/responder/components/__tests__/SOSButton.test.tsx` | New — 23 tests |

---

# Progress - 2026-04-14

## QA Edge Case Scan

**Branch:** N/A (research session)

### What Happened

Dispatched 5 parallel qa-edge-hunter agents to scan the entire codebase for potential issues. Each agent focused on a different area of concern.

### Findings Summary

**Report saved to:** `docs/qa-findings/edge-case-report-2026-04-14.md`

| Area             | Agents | Critical | High   | Medium | Low   |
| ---------------- | ------ | -------- | ------ | ------ | ----- |
| Security         | 1      | 3        | 3      | 4      | 1     |
| Input Validation | 1      | 2        | 4      | 5      | 1     |
| Concurrency      | 1      | 2        | 2      | 2      | 0     |
| Error Handling   | 1      | 3        | 1      | 4      | 1     |
| Performance      | 1      | 2        | 2      | 4      | 0     |
| **Total**        | **5**  | **12**   | **12** | **19** | **3** |

### Top 5 Most Critical Issues

1. **MFA dead feature** — Provincial admins locked out (all MFA methods throw "not implemented")
2. **Municipality filter ignored** — Municipal admins see ALL reports province-wide
3. **Non-atomic 3-tier writes** — Report submission can partially succeed
4. **Photo upload failure silent** — Returns success when photo fails
5. **GPS coordinates (0,0) accepted** — False locations stored

### Files Affected by Findings

| File                                                        | Issues                                             |
| ----------------------------------------------------------- | -------------------------------------------------- |
| `functions/src/index.ts`                                    | MFA dead code, no rate limiting on Cloud Functions |
| `src/domains/municipal-admin/services/firestore.service.ts` | Municipality filter ignored                        |
| `src/domains/citizen/services/firestore.service.ts`         | Non-atomic 3-tier writes                           |
| `src/features/report/services/reportSubmission.service.ts`  | Silent photo failure                               |
| `src/features/report/services/reportStorage.service.ts`     | No file size validation                            |
| `src/features/report/hooks/useReportQueue.ts`               | Silent auto-sync failure                           |
| `src/domains/responder/services/firestore.service.ts`       | Timeline read-modify-write race                    |
| `src/features/report/services/reportQueue.service.ts`       | IndexedDB init race                                |
| `src/features/feed/hooks/useFeedReports.ts`                 | Pagination uses page numbers not cursors           |
| `src/features/map/components/MapView.tsx`                   | All markers rendered at once                       |

### Recommendations (Priority Order)

**P0 (Must fix before production):**

1. Fix `getMunicipalityReports` to filter by municipality parameter (2 lines)
2. Implement MFA or remove the requirement from `loginProvincialSuperadmin`
3. Add Firestore batch writes for atomic 3-tier submission
4. Photo upload failure must return error, not success
5. Add GPS coordinate bounds validation

**P1 (Should fix soon):**

1. Add photo size validation (recommend 5MB)
2. Add IndexedDB auto-pruning with TTL + max size
3. Implement server-side rate limiting in Firestore rules
4. Replace timeline read-modify-write with `arrayUnion()`

**P2 (Technical debt):**

1. Standardize phone regex across all inputs
2. Use Firestore document cursors in feed pagination
3. Implement marker clustering for map view
4. Add batch deletes in `deleteUserData`

---

## Bug Fix: ReportForm Submit Not Working (Missing Geolocation)

**Branch:** `main`

### Problem

Report form's submit button did nothing. Form was stuck at "Detecting location…" because `routes.tsx` rendered `<ReportForm>` without geolocation data, and the component didn't fetch it internally.

### Root Cause

`ReportForm` accepted `userLocation`/`gpsError` as optional props but never called `useGeolocation()`. When geolocation permission was blocked, the form had no fallback to manual location selection.

### Fix

1. Added `useGeolocation()` call inside `ReportForm` — props override hook values for backward compatibility
2. Added `useGeolocation` mock to both test files (`ReportForm.test.tsx`, `ReportForm.consent.test.tsx`)

### Files Changed

| File                                                                   | Change                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| `src/features/report/components/ReportForm.tsx`                        | Added `useGeolocation()` call, resolved props from hook |
| `src/features/report/components/__tests__/ReportForm.test.tsx`         | Added `useGeolocation` mock                             |
| `src/features/report/components/__tests__/ReportForm.consent.test.tsx` | Added `useGeolocation` mock                             |

### Test Summary

- **ReportForm tests:** 31/31 passing
- **ReportForm consent tests:** 6/6 passing
- **TypeScript:** Clean (no new errors)
- **Build:** Passes

---

## Critical Audit Remediation — Plan 2: Profile Routing & Account Flows

**Branch:** `main`

### Completed Tasks

| #   | Task                                                                   | Status | Type         |
| --- | ---------------------------------------------------------------------- | ------ | ------------ |
| 1   | Create `ProfileRoute` auth-aware wrapper                               | Done   | Feature      |
| 2   | Wire `/profile` route to `ProfileRoute`                                | Done   | Fix          |
| 3   | Fix `navigate('/login')` → `navigate('/profile')` in RegisteredProfile | Done   | Fix          |
| 4   | Verify zero `/login` navigation references remain                      | Done   | Verification |

### Test Summary

- **ProfileRoute tests:** 3/3 passing
- **RegisteredProfile tests:** 18/18 passing
- **RegisteredProfile.errorHandling tests:** 10/10 passing
- **routes.test.tsx:** 4/9 passing (5 pre-existing failures unrelated to this work — MapView/FeedList/ReportForm lack QueryClientProvider/Firebase mocks)

### Commits

```
5de49ea feat(auth): introduce ProfileRoute auth-aware profile wrapper
124fd17 fix(routes): replace hardcoded AnonymousProfile with auth-aware ProfileRoute
af75ea2 fix(profile): navigate to /profile after logout and account deletion
```

---

# Progress - 2026-04-13

## PR #15: Spec Review Fixes

**Branch:** `pr15`

### Fixed Tasks

| #   | Task                                  | Status  | Type |
| --- | ------------------------------------- | ------- | ---- |
| 1   | Auto-sync error handling test gap fix | ✅ Done | Test |

### Test Summary

- **useReportQueue tests:** 13 passing
- **Fixed test:** `should log [AUTO_SYNC_ERROR] when syncQueue promise rejects`

### Key Changes

1. **useReportQueue.ts:** Added defensive check for service unavailability
2. **useReportQueue.test.ts:** Updated test to trigger auto-sync useEffect and verify `.catch()` handler logs error with `[AUTO_SYNC_ERROR]` tag

### Commits

```
9cf198d test(useReportQueue): fix auto-sync error handling test to verify .catch() behavior
```

---

# Progress - 2026-04-11

## Citizen Features Gap Fix Implementation

**Plan:** `docs/superpowers/plans/2026-04-11-citizen-features-gap-fix.md`

### Completed Tasks

| #   | Task                             | Status  | Tests Added |
| --- | -------------------------------- | ------- | ----------- |
| 1   | Map Center Coordinates Fix       | ✅ Done | Fixed       |
| 2   | FeedCard Photo Display           | ✅ Done | 3 tests     |
| 3   | ReportForm Offline Queue Tests   | ✅ Done | 3 tests     |
| 4   | AnonymousProfile Navigation      | ✅ Done | 2 tests     |
| 5   | AlertCard Truncation Tests       | ✅ Done | 5 tests     |
| 6   | ReportSuccess Notification Tests | ✅ Done | 4 tests     |
| 7   | E2E Report Tracking              | ✅ Done | 3 tests     |
| 8   | E2E Photo Upload                 | ✅ Done | 3 tests     |
| 9   | Offline Queue E2E Verification   | ✅ Done | -           |
| 10  | Final Verification               | ✅ Done | -           |
| 11  | NonEmergencyRedirect             | ✅ Done | 4 tests     |
| 12  | Duplicate Detection              | ✅ Done | 6 tests     |
| 13  | LinkReportsByPhone               | ✅ Done | 4 tests     |
| 14  | Age Verification Gate            | ✅ Done | 4 tests     |
| 15  | Rate Limiting UI                 | ✅ Done | 5 tests     |
| 16  | ReportDetailScreen + Timeline    | ✅ Done | 15 tests    |
| 17  | BeforeAfterGallery               | ✅ Done | 5 tests     |

**Total:** 17/17 tasks completed

### Test Summary

- **Unit tests added (Tasks 11-17):** 33 tests
- **Unit tests passing (overall):** 761
- **E2E tests added (Tasks 7-8):** 6 tests (require Firebase Emulators)

### Key Fixes

1. **Map center bug:** Changed `DEFAULT_CENTER` from Manila [14.5995, 120.9842] to Camarines Norte [14.2972, 122.7417]
2. **FeedCard photos:** Uncommented photo display code
3. **LinkReportsByPhone:** Fixed SPA routing with `useNavigate()` and `catch (err: unknown)`

### Notes

- E2E tests require Firebase Emulators running (`firebase emulators:start`)
- Offline queue E2E has known infrastructure limitation (Playwright setOffline vs navigator.onLine)
- All Tasks 13-17 code review findings were addressed before commit

---

## Previous Sessions

- 2026-04-10: Citizen features implementation (see git history)

---

## 2026-04-12: PR #10 Test & Error Handling Fixes

**Plan:** `docs/superpowers/plans/2026-04-12-pr10-test-error-fixes.md`
**Branch:** `fix/pr10-test-error-fixes-2026-04-12`

### Completed Tasks

| #   | Task                                       | Status  | Type     |
| --- | ------------------------------------------ | ------- | -------- |
| 1   | Photo Required Validation Test             | ✅ Done | Test     |
| 2   | Manual Location Submission Test            | ✅ Done | Test     |
| 3   | Complete Happy Path Submission Test        | ✅ Done | Test     |
| 4   | Incident Type and Valid Phone Tests        | ✅ Done | Test     |
| 5   | Duplicate Warning Display Test             | ✅ Done | Test     |
| 6   | handleFileChange Error Handling            | ✅ Done | Code fix |
| 7   | onSubmit try/catch + Offline Callback      | ✅ Done | Code fix |
| 8   | Manual Location Validation                 | ✅ Done | Code fix |
| 9   | useReportQueue IndexedDB Error Logging     | ✅ Done | Code fix |
| 10  | Queue Sync Failure Documentation           | ✅ Done | Docs     |
| 11  | useDuplicateCheck ErrorId Logging          | ✅ Done | Code fix |
| 12  | uploadReportPhotos Per-File Error Tracking | ✅ Done | Code fix |

**Total:** 12/12 tasks completed

### Test Summary

- **Tests added:** 6 (ReportForm)
- **ReportForm tests passing:** 24 (was 18)
- **All relevant tests passing:** 30 (ReportForm + useDuplicateCheck)

### Key Fixes

1. **handleFileChange:** Wrapped in try/catch to handle file access errors (SecurityError, NotAllowedError)
2. **handleSubmit:** `onSubmit` now called on offline queue; wrapped in try/catch for online path
3. **Manual location:** Added `locationError` state and validation when GPS unavailable
4. **uploadReportPhotos:** Changed from `Promise.all` to `Promise.allSettled` for partial success tracking

### Notes

- `useReportQueue.test.ts` and `QueueIndicator.test.tsx` have pre-existing firebase mock gap (fail in worktree without `.env.local`)
- TypeScript errors in `ReportForm.tsx` and `useReportQueue.ts` are pre-existing (unrelated to these fixes)

---

## 2026-04-12: PR #11 Error Handling & Test Fixes

**Plan:** `docs/superpowers/plans/2026-04-12-pr11-error-handling-and-test-fixes.md`
**Branch:** `fix/pr10-test-error-fixes-2026-04-12` (via worktree)
**Session:** Subagent-driven development with 8 tasks

### Completed Tasks

| #   | Task                                               | Status  | Notes                                                                                         |
| --- | -------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Fix bare `catch` in `onSubmit` path                | ✅ Done | `ReportForm.handleSubmit` now has `try/catch (err: unknown)` on both online and offline paths |
| 2   | Surface IndexedDB load error via `loadError` state | ✅ Done | `useReportQueue.ts` now has `loadError: string                                                | null`state, populated via`catch (err: unknown)` in mount useEffect |
| 3   | Fix `uploadReportPhoto` error chaining             | ✅ Done | Changed `catch (error)` → `catch (error: unknown)` + message preservation                     |
| 4   | Photo required validation test                     | ✅ Done | 24 ReportForm tests passing                                                                   |
| 5   | Manual location flow test                          | ✅ Done |                                                                                               |
| 6   | Duplicate warning display test                     | ✅ Done |                                                                                               |
| 7   | Complete happy path test                           | ✅ Done |                                                                                               |
| 8   | Phone validation edge cases test                   | ✅ Done | 3 valid + 5 invalid formats                                                                   |

### Known Limitations

**useReportQueue test infrastructure:** The test file (`useReportQueue.test.ts`) has pre-existing broken mocks — wrong relative path (`../..` instead of `../../..`) and `vi.fn()` inside `vi.mock` without `vi.hoisted()`. Tests fail without `.env.local` firebase credentials. `QueueIndicator.test.tsx` also fails for the same reason.

### Test Summary

- **ReportForm tests:** 24/24 passing
- **useReportQueue tests:** 2/8 passing (pre-existing infrastructure issue)
- **All report feature tests:** 82 passed, 1 failed (QueueIndicator pre-existing)

### Commits on This Branch

```
6c22fac fix(ReportForm): use catch (err: unknown) with proper error message extraction
c38c308 fix(reportStorage): preserve original error in uploadReportPhoto catch block
3f66bc1 fix(useReportQueue): surface IndexedDB load error via loadError state
21bf18d docs: update progress and learnings for PR #11 session
cd783af test(ReportForm): add happy path submission test
6823791 test(ReportForm): add duplicate warning display test
4a8df7b test(ReportForm): add manual location flow test
b1b0ec7 test(ReportForm): add photo required validation test
```

### Verification Commands

```bash
npm run test -- --run src/features/report/components/__tests__/ReportForm.test.tsx  # 24/24
npm run typecheck  # Pre-existing errors in useReportQueue.ts (TS1127), others
```

---

## 2026-04-12: PR #12 Error Handling Fixes (RegisteredProfile)

**Plan:** `docs/superpowers/plans/2026-04-12-pr12-registeredprofile-error-handling.md`
**Branch:** `fix/pr12-registeredprofile-error-handling` (worktree)

### Completed Tasks

| #   | Task                                          | Status  | Type     |
| --- | --------------------------------------------- | ------- | -------- |
| 1   | Add syncError state and fix handleSyncNow     | ✅ Done | Code fix |
| 2   | Add logoutError state and UI display          | ✅ Done | Code fix |
| 3   | Add downloadError state and UI display        | ✅ Done | Code fix |
| 4   | Add firebase mocks to RegisteredProfile tests | ✅ Done | Test fix |
| 5   | Write error handling tests                    | ✅ Done | Tests    |

### Test Summary

- **RegisteredProfile tests:** 18 passing (was 0 due to firebase mock gap)
- **Error handling tests:** 9 passing
- **Total RegisteredProfile tests:** 27 passing

### Key Fixes

1. **handleSyncNow:** Now sets `syncError` on failure, clears `syncResult` before retry (prevents stale success message)
2. **handleLogout:** Now sets `logoutError` with user-facing message near logout button
3. **handleDownloadData:** Now sets `downloadError` with `instanceof Error` check

### Gap Analysis Findings (Plan Review)

During plan review, these gaps were identified and addressed:

- `syncResult` was never cleared on error → Added `setSyncResult(null)` before sync
- `logoutError` display is outside SettingsTab → Error display added near logout button
- `logoutError` not passed to SettingsTabProps → Correctly kept in main component
- Missing logout error test → Added to test plan

### Commits on This Branch

```
9b5b266 test(RegisteredProfile): add error handling and DPA flow tests
0c1859c test(RegisteredProfile): add firebase mocks to fix test infrastructure
53bb746 fix(RegisteredProfile): add downloadError state and display in Data Management
db15a15 fix(RegisteredProfile): add logoutError state and display near logout button
ef4315d fix(RegisteredProfile): add syncError state and clear syncResult on failure
```

### Verification Commands

```bash
npm run test -- --run src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx  # 9/9
npm run test -- --run src/features/profile/components/__tests__/RegisteredProfile.test.tsx  # 18/18
npm run typecheck  # Pre-existing errors in useReportQueue.ts (unrelated)
```

---

## 2026-04-12: Alerts System — useAlerts onSnapshot Rewrite

**Plan:** `docs/superpowers/plans/2026-04-11-alerts-system-implementation.md`
**Branch:** `feat/alerts-system-implementation-2026-04-12`

### Completed Tasks

| #   | Task                                        | Status | Type           |
| --- | ------------------------------------------- | ------ | -------------- |
| 1   | Rewrite useAlerts to use onSnapshot         | Done   | Refactor       |
| 2   | Add onSnapshot subscription tests (6 tests) | Done   | Test           |
| 3   | Add dual-query merge tests (2 tests)        | Done   | Test           |
| 4   | IndexedDB cache fallback on Firestore error | Done   | Feature + Test |

### Test Summary

- **New tests added:** 10 (6 onSnapshot + 2 merge + 1 legacy compat + 1 cache fallback)
- **useAlerts tests passing:** 13/13

### What Changed

- `useAlerts.ts`: Removed all TanStack Query (`useQuery`, `QueryClientProvider`, `refetchInterval`). Replaced with `useState` + `useEffect` + `onSnapshot` subscriptions via `alert.service.ts`.
- New return shape: `alerts` (not `data`), `error: Error | null`
- Dual-subscription: when `municipality` AND `role` are both provided, runs two parallel `onSnapshot` listeners and merges+dedupes results.
- `refetch()` is a no-op since onSnapshot pushes automatically.
- `alertsCache.ts`: new IndexedDB cache module (`cacheAlerts` + `loadCachedAlerts`) with dedicated `bantayog-alerts-cache` database.
- Cache fallback: when `onSnapshot` fires an error, `handleError` persists the current alert set and loads cached data so the UI stays populated instead of going blank.

### Commits on This Branch

```
2b01ce2 feat(useAlerts): add IndexedDB cache fallback on Firestore error
320eb47 refactor(alerts): rewrite useAlerts hook to use onSnapshot real-time subscriptions
12d81c2 fix(alert.service): recalculate now inside onSnapshot callback to avoid stale expiration check
6ca2faa feat(alerts): add alert service with real-time subscriptions
```

### Verification Commands

```bash
npm run test -- --run src/features/alerts/hooks/__tests__/useAlerts.test.ts  # 12/12
npm run typecheck  # useAlerts.ts clean (pre-existing errors in useReportQueue.ts)
```

---

## 2026-04-12: Task 5 — Wire AlertList to Real Data

**Files changed:** `src/features/alerts/components/AlertList.tsx`, `src/features/alerts/components/__tests__/AlertList.test.tsx`, `src/shared/hooks/UserContext.tsx` (new)

### What Changed

1. **Created `UserContext.tsx`:** A new context that provides `municipality` and `role` from Firestore `users/{uid}` for authenticated users. Falls back to `undefined` for anonymous users.

2. **`AlertList.tsx`:** Fixed pre-existing mismatch — changed `data` → `alerts` (the hook's actual return key). Now calls `useUserContext()` and passes `{ municipality, role }` to `useAlerts({ municipality, role })`.

3. **`AlertList.test.tsx`:** Fixed all existing mock returns (`data` → `alerts`). Added Firebase mocks (`firebase/firestore`, `firebase/auth`, `@/app/firebase/config`). Added 2 integration tests verifying `useAlerts` is called with correct `municipality` and `role` from UserContext.

### Test Summary

- **AlertList tests:** 16/16 passing (was 14, added 2 integration tests)
- **All alerts tests:** 92/92 passing
- **Breaking changes:** None — existing 14 tests pass unchanged

### Key Decisions

- **No existing user context found:** The codebase has `useAuth` (Firebase User only) but no `municipality`/`role`. Created a minimal `UserContext` following the Firestore profile fetch pattern.
- **`data` → `alerts` mismatch:** `AlertList` was destructuring `data` but `useAlerts` returns `alerts`. Fixed as part of wiring.
- **`vi.spyOn` extra args:** When using `vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue(...)`, Vitest may inject extra internal args. Integration test assertions use `spy.mock.calls[0]?.[0]` to verify the first argument specifically.

### Verification Commands

```bash
npm run test -- --run src/features/alerts/components/__tests__/AlertList.test.tsx  # 16/16
npm run test -- --run src/features/alerts/                                       # 92/92
```

---

## 2026-04-12: Task 7 — Create AlertDetailModal

**Files created:** `src/features/alerts/components/AlertDetailModal.tsx`, `src/features/alerts/components/__tests__/AlertDetailModal.test.tsx`

### What Changed

1. **`AlertDetailModal.tsx`:** Modal component that displays full government alert details:
   - Severity badge (info/warning/emergency) + type badge with icon
   - Full message display
   - Affected areas (municipalities + barangays)
   - Source attribution with sourceUrl link
   - Read More link (linkUrl)
   - Share button (navigator.share with clipboard fallback)
   - Close button

2. **`AlertDetailModal.test.tsx`:** 18 tests covering all render cases and share behavior.

### Test Summary

- **New tests:** 18 (AlertDetailModal)
- **AlertDetailModal tests passing:** 18/18
- **All alerts tests passing:** 110/110

### Key Decisions

- **Uses existing `Modal` component:** Leverages `src/shared/components/Modal.tsx` for backdrop, close, portal, accessibility.
- **Props:** `alert`, `isOpen`, `onClose`, optional `title` override.
- **Share pattern:** Matches `FeedCard.tsx` — navigator.share with AbortError handling, clipboard fallback with try/catch.
- **Metadata:** Alert interface has no dedicated `metadata` field. `linkUrl` rendered as "Read More" link.

### Verification Commands

```bash
npm run test -- --run src/features/alerts/components/__tests__/AlertDetailModal.test.tsx  # 18/18
npm run test -- --run src/features/alerts/                                               # 110/110
```
