# Test Gaps and Priorities

## Critical Gaps (Blockers)

### 1. Push Notification Tests
**Status:** Blocked - FCM not implemented
**Priority:** HIGH
**Impact:** Can't verify critical safety feature
**Plan:** Add after FCM integration
- Test token registration
- Test notification receipt
- Test notification tap handling
- Test permission prompts

### 2. Account Creation Flow Tests
**Status:** Blocked - SignUpFlow not implemented
**Priority:** HIGH
**Impact:** Can't verify user conversion feature
**Plan:** Add after implementing account creation
- Test signup form validation
- Test phone OTP flow
- Test account linking by phone
- Test "My Reports" history

### 3. Data Deletion Flow Tests
**Status:** Blocked - Feature not implemented
**Priority:** MEDIUM (DPA requirement)
**Impact:** Legal compliance risk
**Plan:** Add after implementing deletion
- Test account deletion request
- Test data anonymization
- Test report retention policy

### 4. Offline Queue Sync E2E
**Status:** Known infrastructure limitation
**Priority:** MEDIUM
**Impact:** Offline sync not fully verified
**Plan:** Document limitation, add manual testing procedure

## Completed in This Plan

- Accessibility tests (Tasks 1-2)
- Performance budgets (Task 3)
- Rate limiting E2E (Task 4)
- Coverage thresholds (Task 5)

## Next Test Priorities

1. Security tests (XSS, injection)
2. Report editing/cancellation E2E
3. Alerts system E2E
4. Manual testing procedures

## Test Coverage Metrics

**Before:**
- 761 tests passing
- No accessibility testing
- No performance budgets
- No coverage thresholds

**After:**
- 800+ tests (estimated)
- Full a11y coverage
- Performance budgets enforced
- 70% coverage threshold enforced