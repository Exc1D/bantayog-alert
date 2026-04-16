# Progress - 2026-04-15

## P0 Security Fixes (Complete)

**Branch:** `fix/p0-security-task1`
**Plan:** `docs/superpowers/plans/2026-04-15-plan-0-p0-security-fixes.md`
**Status:** ✅ All 7 tasks complete | Indexes deployed to staging

### Fixed Issues

| ID | Issue | Fix |
|----|-------|-----|
| CRITICAL-AUTH-2 | `getMunicipalityReports` ignores municipality filter | Added `where('approximateLocation.municipality', '==', municipality)` |
| CRITICAL-AUTH-3 | `getAssignedIncidents` ignores municipality | Added municipality filter with strict guard |
| CRITICAL-DATA-1 | Silent photo upload failure | Changed from `Promise.allSettled` silent success to throw on failure |
| CRITICAL-INPUT-1 | GPS `(0,0)` and out-of-range coords accepted | Created `geoValidation.ts` with PH/Camarines Norte bounds checks |
| CRITICAL-INPUT-2 | Photo size not validated | Added 5MB cap + MIME type validation (JPEG/PNG/WebP only) |
| HIGH-ERROR-1 | Auto-sync failure silent | Added `syncError` state surfaced in `QueueIndicator` |
| HIGH-ERROR-2 | Queue service failure silent | Already handled via existing `loadError` state |

### Files Changed

| File | Change |
|------|--------|
| `src/domains/municipal-admin/services/firestore.service.ts` | Municipality filter added |
| `src/domains/responder/hooks/useDispatches.ts` | Municipality filter with AUTH_EXPIRED guard |
| `src/domains/responder/hooks/__tests__/useDispatches.test.ts` | Tests added |
| `src/features/report/services/reportSubmission.service.ts` | Photo failures now throw |
| `src/features/report/services/reportStorage.service.ts` | Size (5MB) + MIME validation |
| `src/shared/utils/geoValidation.ts` | **New** — GPS bounds validator |
| `src/features/report/components/ReportForm.tsx` | Calls `geoValidation` before submit |
| `src/features/report/hooks/useReportQueue.ts` | `syncError` state added |
| `src/features/report/components/QueueIndicator.tsx` | Displays `syncError` |
| `firestore.indexes.json` | Two composite indexes added |
| `.firebaserc` | Added `staging: "bantayog-alert-staging"` |

### Firestore Indexes Deployed

**Project:** `bantayog-alert-staging`
**Deployed:** 2026-04-15

| Collection | Index | Purpose |
|------------|-------|---------|
| `reports` | `approximateLocation.municipality ASC, createdAt DESC` | Municipal admin report list |
| `report_ops` | `assignedTo ASC, municipality ASC, assignedAt DESC` | Responder dispatches with muni filter |

### Test Summary

- **Test summary:** 1063/1068 tests passing (5 pre-existing MapView.test.tsx failures unrelated to P0 work)
- **TypeScript:** Clean (`npm run typecheck` passes)

### Previous Work (Condensed)

**2026-04-14:** QA Edge Case Scan — 5 parallel agents scanned codebase, identified 12 critical issues across security, input validation, concurrency, error handling, and performance. Report saved to `docs/qa-findings/edge-case-report-2026-04-14.md`.

**2026-04-11:** Citizen Features Gap Fix — 17 tasks completed including Map center fix, FeedCard photos, offline queue tests, anonymous navigation, alert truncation tests, phone-based report linking, age verification gate, rate limiting UI, report detail timeline, and before/after gallery.

**Earlier 2026-04:** Multiple PR review fixes including error handling (PR #10-12), alerts system rewrite with `onSnapshot`, and SOSButton component with hold-to-activate UI.

See `docs/learnings.md` for detailed technical decisions and lessons learned.
