# Progress - 2026-04-11

## Citizen Features Gap Fix Implementation

**Plan:** `docs/superpowers/plans/2026-04-11-citizen-features-gap-fix.md`

### Completed Tasks

| # | Task | Status | Tests Added |
|---|------|--------|-------------|
| 1 | Map Center Coordinates Fix | ✅ Done | Fixed |
| 2 | FeedCard Photo Display | ✅ Done | 3 tests |
| 3 | ReportForm Offline Queue Tests | ✅ Done | 3 tests |
| 4 | AnonymousProfile Navigation | ✅ Done | 2 tests |
| 5 | AlertCard Truncation Tests | ✅ Done | 5 tests |
| 6 | ReportSuccess Notification Tests | ✅ Done | 4 tests |
| 7 | E2E Report Tracking | ✅ Done | 3 tests |
| 8 | E2E Photo Upload | ✅ Done | 3 tests |
| 9 | Offline Queue E2E Verification | ✅ Done | - |
| 10 | Final Verification | ✅ Done | - |
| 11 | NonEmergencyRedirect | ✅ Done | 4 tests |
| 12 | Duplicate Detection | ✅ Done | 6 tests |
| 13 | LinkReportsByPhone | ✅ Done | 4 tests |
| 14 | Age Verification Gate | ✅ Done | 4 tests |
| 15 | Rate Limiting UI | ✅ Done | 5 tests |
| 16 | ReportDetailScreen + Timeline | ✅ Done | 15 tests |
| 17 | BeforeAfterGallery | ✅ Done | 5 tests |

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

| # | Task | Status | Type |
|---|------|--------|------|
| 1 | Photo Required Validation Test | ✅ Done | Test |
| 2 | Manual Location Submission Test | ✅ Done | Test |
| 3 | Complete Happy Path Submission Test | ✅ Done | Test |
| 4 | Incident Type and Valid Phone Tests | ✅ Done | Test |
| 5 | Duplicate Warning Display Test | ✅ Done | Test |
| 6 | handleFileChange Error Handling | ✅ Done | Code fix |
| 7 | onSubmit try/catch + Offline Callback | ✅ Done | Code fix |
| 8 | Manual Location Validation | ✅ Done | Code fix |
| 9 | useReportQueue IndexedDB Error Logging | ✅ Done | Code fix |
| 10 | Queue Sync Failure Documentation | ✅ Done | Docs |
| 11 | useDuplicateCheck ErrorId Logging | ✅ Done | Code fix |
| 12 | uploadReportPhotos Per-File Error Tracking | ✅ Done | Code fix |

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

