# Learnings - 2026-04-11

## Development Process

### Subagent-Driven Development Notes

**What worked well:**
- Two-stage review (spec compliance → code quality) caught real issues:
  - Untyped `catch (err)` in LinkReportsByPhone
  - `window.location.href` SPA routing anti-pattern
  - Missing `aria-hidden` on decorative icons
- Fresh subagent per task kept context clean
- Implementer → spec reviewer → code reviewer flow ensured quality gates

**What to avoid:**
- Don't skip review loops when issues are found
- Don't move to next task while either review has open issues

### Code Quality Patterns

**TypeScript Strict Mode:**
- `catch (err)` without type annotation violates strict mode → use `catch (err: unknown)`
- React Router navigation: Use `useNavigate()` hook, not `window.location.href`
- Decorative icons need `aria-hidden="true"` for accessibility

**React Hooks:**
- Always mock `react-router-dom` when testing components that use `useNavigate`

**Firestore in Tests:**
- Firebase emulators needed for E2E tests - unit tests mock the SDK
- Offline queue tests have infrastructure incompatibility (Playwright's `setOffline()` doesn't trigger `navigator.onLine`)

### Architecture Decisions

**Anonymous Report Linking:**
- Phone-based linking queries `report_private` collection by `reporterPhone`
- Validation uses PH mobile regex: `/^(\+?63|0)?[0-9]{10}$/`

**COPPA Age Gate:**
- Uses localStorage key `age_verified` for persistence
- Renders null when already verified (checks on mount)

**Rate Limiting UI:**
- Hardcoded `mdrmoHotline` and `retryAfterMinutes` - consider making configurable

**ReportDetailScreen + Timeline:**
- Timeline built from report status history (submitted, verified, resolved)
- Share button uses native share API with clipboard fallback

**BeforeAfterGallery:**
- Uses URL as key for photo items - fragile for duplicate URLs
- Fullscreen viewer supports prev/next navigation

## Mistakes Made

1. **Task 13 (LinkReportsByPhone):** Initially used `window.location.href` which breaks SPA routing - fixed via code review
2. **Task 13:** Untyped catch parameter - fixed via code review
3. **Task 15 (RateLimitExceeded):** Decorative icons missing `aria-hidden` - fixed before amend
4. **E2E Tests:** Offline queue tests have infrastructure issue (navigator.onLine vs socket-level offline) - documented as known limitation

## Context for Future Sessions

- This session implemented Tasks 1-17 from `citizen-features-gap-fix.md` plan
- Tasks 1-10 were completed before context compaction
- Tasks 11-17 completed in this session with full two-stage review
- Pre-compaction state preserved in vault for context continuity
