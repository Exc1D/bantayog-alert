Citizen Features - Implementation Plans Summary

**Date:** 2026-04-11  
**Status:** Most plans complete - cleanup in progress

---

## 📋 Plans Created

### 2. ✅ Missing Tests Prioritization (Foundational)

**File:** `docs/superpowers/plans/2026-04-11-missing-tests-prioritization.md`  
**Priority:** HIGH (blocks release - unknown quality)  
**Effort:** 16-20 hours  
**Status:** Ready to execute

**What's Included:**

- **Task 1:** Set up axe-core accessibility testing
- **Task 2:** Create a11y tests for all major screens (map, feed, report, profile)
- **Task 3:** Set up Lighthouse performance testing
- **Task 4:** Create rate limiting E2E tests
- **Task 5:** Set up coverage thresholds (70% minimum)
- **Task 6:** Document test gaps and priorities

**Key Deliverables:**

- WCAG 2.1 AA compliance verification
- Performance budgets (< 500KB bundle, < 2s FCP)
- Rate limiting E2E tests
- Comprehensive test gap documentation

---

### 3. ✅ Legal Compliance - DPA (CRITICAL)

**File:** `docs/superpowers/plans/2026-04-11-legal-compliance-dpa.md`  
**Priority:** **CRITICAL** (blocks public release)  
**Effort:** 20-24 hours  
**Status:** Ready to execute

**What's Included:**

- **Task 1:** Privacy Policy document (plain language, RA 10173 compliant)
- **Task 2:** Consent checkbox in ReportForm
- **Task 3:** Account deletion flow (DataDeletion component)
- **Task 4:** "Download My Data" feature (DPA right to access)

**Key Deliverables:**

- Plain-language privacy policy
- Explicit consent mechanism (required checkbox)
- Account deletion with data anonymization
- User data export (JSON download)
- DPA compliance for RA 10173

**Why CRITICAL:**

- Legal liability without privacy policy
- Consent required by Data Privacy Act
- Right to deletion and access are legal requirements
- Blocks public release

---

### 4. ✅ Account & Auth Implementation (HIGH)

**File:** `docs/superpowers/plans/2026-04-11-account-auth-implementation.md`  
**Priority:** HIGH (core conversion feature)  
**Effort:** 24-30 hours  
**Status:** Ready to execute

**What's Included:**

- **Task 1:** PhoneVerification component (6-digit OTP)
- **Task 2:** SignUpFlow component (multi-step wizard)
- **Task 3:** usePhoneAuth hook (OTP verification)
- **Task 4:** SendOTP Cloud Function (SMS with rate limiting)
- **Task 5:** Report linking by phone (LinkReportsByPhone)
- **Task 6:** MyReportsList component (user's report history)
- **Task 7:** Wire "Create Account" CTA
- **Task 8:** Add "My Reports" to RegisteredProfile
- **Task 9:** Add signup route

**Key Deliverables:**

- Complete account creation flow with phone OTP
- Report linking by phone number
- "My Reports" history view
- Multi-step signup wizard (7 steps)

---

### 5. ✅ Alerts System Implementation (HIGH)

**File:** `docs/superpowers/plans/2026-04-11-alerts-system-implementation.md`  
**Priority:** HIGH (safety-critical)  
**Effort:** 16-20 hours  
**Status:** Ready to execute

**What's Included:**

- **Task 1:** Define alert data model (types, priorities)
- **Task 2:** Create Firestore alerts collection
- **Task 3:** Implement alert queries (location-based)
- **Task 4:** useAlerts hook (real-time updates)
- **Task 5:** Update AlertCard (priority colors, source badges)
- **Task 6:** Wire AlertList to real data
- **Task 7:** Create AlertDetailModal
- **Task 8:** Seed sample alerts script
- **Task 9:** Admin alert creation (optional)

**Key Deliverables:**

- Official alerts data source (Firestore)
- Priority levels (🔴 emergency, 🟡 warning, 🟢 advisory)
- Location-based filtering (user's municipality)
- Real-time alert updates
- Official source attribution (MDRRMO, PAGASA, etc.)

**Why HIGH:**

- Safety-critical (evacuation warnings)
- Currently non-functional tab
- No data source for alerts

---

## 🎯 Recommended Execution Order

### Phase 1: Unblocking Work (Week 1)

1. **Legal Compliance (Tasks 1-2)** - 6-8 hours
   - Privacy policy + consent checkbox
   - Unblocks public release

2. **Tests Foundation (Tasks 1-2)** - 6-8 hours
   - Accessibility testing infrastructure
   - Understand current a11y state

### Phase 2: Core Features (Week 2)

4. **Alerts System (Tasks 1-6)** - 12-16 hours
   - Safety-critical feature
   - Makes alerts tab functional

5. **Tests Completion (Tasks 3-4)** - 6-8 hours
   - Performance budgets
   - Rate limiting E2E

### Phase 3: User Conversion (Week 3)

6. **Account & Auth (Tasks 1-4)** - 12-16 hours
   - Phone verification
   - Signup flow

7. **Account Completion (Tasks 5-9)** - 12-14 hours
   - Report linking
   - My Reports

### Phase 4: Polish (Week 4)

8. **Legal Completion (Tasks 3-4)** - 8-10 hours
   - Account deletion
   - Data export

9. **Final Testing** - 4-6 hours
   - Coverage thresholds
   - Test gap documentation

---

## 📊 Effort Summary

| Plan | Priority | Effort | Tasks |
|------|----------|--------|-------|
| Missing Tests | HIGH | 16-20h | 6 tasks |
| Legal Compliance | **CRITICAL** | 20-24h | 4 tasks |
| Account & Auth | HIGH | 24-30h | 9 tasks |
| Alerts System | HIGH | 16-20h | 9 tasks |
| **TOTAL** | | **76-94 hours** | **28 tasks** |

**Estimated Timeline:** 3-4 weeks with 1 engineer

---

## 🚀 Next Steps

### Option 1: Execute All Plans (Recommended)

Use subagent-driven-development to execute all 5 plans systematically:

- Fresh subagent per task
- Two-stage review (spec → code)
- Fast iteration
- High quality

### Option 2: Priority-Based Execution

Execute in this order:

1. Legal Compliance (CRITICAL)
2. Alerts System (HIGH)
3. Account & Auth (HIGH)
4. Missing Tests (HIGH)

### Option 3: Quick Wins First
1. Legal Compliance - Tasks 1-2 (6-8h)
2. Alerts System - Tasks 1-3 (8-10h)
Then decide on remaining work.

---

## 📝 Plan Quality

All plans include:

- ✅ Complete code (no placeholders)
- ✅ Exact file paths
- ✅ Test-first approach (TDD)
- ✅ Bite-sized tasks (2-5 min each)
- ✅ Frequent commits
- ✅ Self-review checklist
- ✅ Type consistency
- ✅ Security considerations

**No Plan Has:**

- ❌ "TBD" or "TODO"
- ❌ "Implement later"
- ❌ "Add error handling" (without specifics)
- ❌ Ambiguous instructions

---

## 🎯 Success Criteria

After executing these plans, the app will have:

**Legal Compliance:**

- ✅ Privacy policy
- ✅ Consent flow
- ✅ Data deletion
- ✅ Data export
- ✅ DPA compliant

**Features:**

- ✅ Alerts tab functional
- ✅ Account creation flow
- ✅ "My Reports" history
- ✅ Report linking by phone

**Quality:**

- ✅ 800+ tests (from 761)
- ✅ A11y compliance verified
- ✅ Performance budgets enforced
- ✅ 70% coverage threshold

**Readiness:**

- ✅ Legal blocks cleared
- ✅ Safety-critical features working
- ✅ User conversion path complete
- ✅ Test gaps filled

**Estimated completion:** 60-65% → 90% of Phase 1 spec

---

## 💡 Usage

Each plan is self-contained and execution-ready:

1. **Read the plan** to understand scope
2. **Choose execution approach** (subagent vs inline)
3. **Follow tasks sequentially** (checkboxes track progress)
4. **Run each command** exactly as written
5. **Test after each step** (as specified)
6. **Commit frequently** (as instructed)

**For subagent-driven execution:**

```bash
# Dispatch subagent with plan
claude-code execute "docs/superpowers/plans/2026-04-11-[plan-name].md"
```

---

**All plans complete. Ready for execution.**

Questions? Refer to individual plans for details.
