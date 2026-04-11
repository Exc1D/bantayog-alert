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
4. **Map z-index stacking context:** Added `style={{ isolation: 'isolate' }}` to MapView container to prevent Leaflet from creating a stacking context that hid navigation/other components when map tab was active
4. **Map z-index stacking context:** Added `style={{ isolation: 'isolate' }}` to MapView container to prevent Leaflet from creating a stacking context that hid navigation/other components when map tab was active

### Notes

- E2E tests require Firebase Emulators running (`firebase emulators:start`)
- Offline queue E2E has known infrastructure limitation (Playwright setOffline vs navigator.onLine)
- All Tasks 13-17 code review findings were addressed before commit
- Map visibility issue (components vanishing when map active) fixed by isolating Leaflet's stacking context

---

## Previous Sessions

- 2026-04-10: Citizen features implementation (see git history)
