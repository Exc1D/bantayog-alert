# Adversarial Review: PR #42 - Phase 2 Data Model and Security Rules

**Review Date:** 2026-04-17
**Reviewer:** Claude Code (Adversarial/Skeptical Mode)
**PR:** #42 - feat(phase-2): data model and Firestore security rules foundation
**Spec:** docs/superpowers/plans/2026-04-17-phase-2-data-model-security-rules.md

---

## Executive Summary

❌ **DO NOT MERGE** - This PR delivers schema and rule code, but not the security guarantees the spec requires.

Critical gaps in testing and verification make this unsafe to ship for a disaster response system.

---

## 🔴 CRITICAL GAPS (Must Fix Before Merge)

### 1. Missing Phase 2 Firestore Rule Tests

**Spec Required (Task 6, Steps 3-8; Tasks 7-12):**

The spec explicitly requires 14+ individual test files:

```bash
functions/src/__tests__/rules/report-inbox.rules.test.ts
functions/src/__tests__/rules/reports.rules.test.ts
functions/src/__tests__/rules/report-private.rules.test.ts
functions/src/__tests__/rules/report-ops.rules.test.ts
functions/src/__tests__/rules/report-sharing.rules.test.ts
functions/src/__tests__/rules/report-contacts.rules.test.ts
functions/src/__tests__/rules/report-lookup.rules.test.ts
functions/src/__tests__/rules/report-events.rules.test.ts
functions/src/__tests__/rules/dispatches.rules.test.ts
functions/src/__tests__/rules/users-responders.rules.test.ts
functions/src/__tests__/rules/public-collections.rules.test.ts
functions/src/__tests__/rules/sms.rules.test.ts
functions/src/__tests__/rules/coordination.rules.test.ts
functions/src/__tests__/rules/hazard-zones.rules.test.ts
```

**Actually Delivered:**

- `functions/src/__tests__/firestore.rules.test.ts` (153 lines)
  - Contains **only Phase 1 tests** (4 tests for alerts, active_accounts, system_config)
  - **Zero Phase 2 collection tests**

**Impact:**

- Complex Firestore security rules for ~30 collections deployed with **zero emulator-based verification**
- These rules block production traffic
- If rules are wrong, citizens cannot report emergencies
- First responders cannot receive dispatches
- SMS ingestion fails silently

**Risk Assessment:** CRITICAL - System outage potential

---

### 2. Verification Command Never Run

**Spec Task 19, Step 1 (Verification Gate):**

```bash
pnpm lint
pnpm typecheck
pnpm test
firebase emulators:exec --only firestore,database,storage "pnpm --filter @bantayog/functions test:rules"
pnpm exec tsx scripts/check-rule-coverage.ts
pnpm build
```

> "Every command must exit 0. If any fail, stop and fix before editing progress docs."

**Evidence of Non-Execution:**

From `docs/progress.md`:

```markdown
| 3 | firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test:rules" | SKIP (emulator not available locally) |
```

- Phase 1 verification was **SKIPPED** due to emulator unavailability locally
- No evidence Phase 2 verification was run
- CI pipeline does not include this command
- Progress.md was updated claiming "complete" **without running verification**

**Impact:**

- The entire security model is untested
- Rules have never been executed against the Firebase emulator
- No verification that `allow` blocks actually permit authorized operations
- No verification that `allow write: if false` blocks actually deny

**Risk Assessment:** CRITICAL - Untested security controls

---

### 3. Rule Coverage Checker Not in CI

**Spec Task 17 Title:** "Rule-Coverage Enforcement Tool + **CI Gate**"

**Required:**

- Create `scripts/check-rule-coverage.ts`
- Add to `.github/workflows/ci.yml` as enforcement gate

**Actually Delivered:**

- ✅ Script exists: `scripts/check-rule-coverage.ts`
- ❌ **NOT added to CI workflow**

**CI Evidence:**

```bash
$ grep -r "check-rule-coverage" .github/workflows/ci.yml
# No results - script not called from CI
```

**Impact:**

- No enforcement that every collection has both positive and negative tests
- Future PRs can remove tests without detection
- Spec §5.7 requirement unenforced
- Coverage can regress silently

**Risk Assessment:** HIGH - Regression potential

---

## ⚠️ SIGNIFICANT CONCERNS

### 4. Progress Documentation Misleading

**Claim in docs/progress.md:**

```markdown
## Phase 2 Data Model and Security Rules Foundation (Complete)

**Status:** All implementation tasks complete.
```

**Reality:**

- Task 19 is titled "**Phase Verification** and Progress Capture"
- Spec says: "If any fail, stop and fix before editing progress docs"
- Verification was **not performed** (emulator tests skipped)
- Documentation was updated **anyway**

**Issue:**

- Recording "complete" before actual verification violates the spec's verification gate
- Creates false confidence in security posture
- Violates the trust-but-verify principle

---

### 5. Missing Schema Validation Tests

**Spec Requirements:**

**Task 2, Step 1:** Write `packages/shared-validators/src/reports.test.ts`

- 6 test suites for reportDocSchema, reportPrivateDocSchema, reportOpsDocSchema, etc.
- Tests for invalid status literals
- Tests for unknown keys via strict mode
- Tests for hazardTagSchema rejecting invalid hazardType literals

**Task 3, Step 1:** Write tests for dispatches/events/agencies/responders/users schemas

**Task 4, Step 1:** Write tests for SMS/coordination/hazards schemas

**Actually Delivered:**

- `packages/shared-validators/src/shared-schemas.test.ts` exists
  - But doesn't test the domain schemas from Tasks 2-4
- Individual `reports.test.ts`, `dispatches.test.ts`, etc. are **missing**

**Impact:**

- Schema validation is the source of truth per Arch Spec §0
- Without tests, you don't know if Zod is catching invalid data
- Type safety claims are unverified
- Invalid data could reach Firestore if schemas have bugs

**Risk Assessment:** MEDIUM - Data integrity risk

---

### 6. Test Coverage Gaps

**Required Test Scope (from spec):**

For each of ~30 collections, the spec requires:

- **Positive test:** `assertSucceeds` for authorized read/write
- **Negative test:** `assertFails` for unauthorized access
- Cross-role denial tests
- Edge case coverage (suspended users, wrong municipality, etc.)

**Actually Delivered:**

- 4 Firestore rule tests (Phase 1 only)
- 24 Storage rule tests ✅
- RTDB rule tests ✅
- **Zero** Phase 2 Firestore collection tests

**Missing Test Coverage:**

- Report inbox (triage workflows)
- Report triptych (public, private, ops, sharing, contacts, lookup)
- Report events (status transitions)
- Dispatches (assignment, acceptance, responder workflows)
- Users/responders (role-based access)
- Public collections (agency directory, etc.)
- SMS layer (ingestion, delivery)
- Coordination (command threads, shift handoffs)
- Hazard zones (reference vs custom layers)

**Estimated Test Gap:** 100+ missing tests

---

## ✅ WHAT'S ACTUALLY GOOD

### Delivered Components

1. ✅ **Enum Reconciliation (Task 1)**
   - 15 ReportStatus states (correct)
   - VisibilityClass `internal` | `public_alertable` (correct)
   - HazardType bare literals (correct)
   - Branded IDs for hazards, dispatches, commands, etc.

2. ✅ **Zod Schemas (Tasks 2-4)**
   - All schemas exist and are exported
   - Report triptych schemas
   - Dispatch/event schemas
   - Agency/user/responder schemas
   - SMS/coordination/hazard schemas
   - Proper `strict()` mode for unknown key rejection

3. ✅ **Firestore Rules Structure (Tasks 6-12)**
   - Rules exist for all required collections
   - Syntax is valid (no lint errors)
   - Uses `isActivePrivileged()` helper from Phase 1
   - Default-deny guardrails present

4. ✅ **RTDB Rules + Tests (Task 13)**
   - Responder telemetry rules
   - Shared projection rules
   - Tests passing

5. ✅ **Storage Rules + Tests (Task 14)**
   - Callable-only upload enforcement
   - Admin read paths
   - 24 tests passing

6. ✅ **Composite Indexes (Task 15)**
   - 30 indexes in `firestore.indexes.json`

7. ✅ **Idempotency Guard (Task 16)**
   - `withIdempotency()` helper exists
   - Payload-hash deduplication logic
   - Unit tests passing

8. ✅ **Schema Migration Runbook (Task 18)**
   - Document exists at `docs/runbooks/schema-migration.md`

---

## 📊 COMPLIANCE MATRIX

| Task | Description                             | Required | Delivered | Status                   |
| ---- | --------------------------------------- | -------- | --------- | ------------------------ |
| 1    | Reconcile enums                         | ✅       | ✅        | Complete                 |
| 2    | Report triptych schemas                 | ✅       | ✅        | Complete                 |
| 3    | Dispatch/event/user schemas             | ✅       | ✅        | Complete                 |
| 4    | SMS/coordination/hazard schemas         | ✅       | ✅        | Complete                 |
| 5    | Rule-test harness                       | ✅       | ❌        | MISSING                  |
| 6    | Firestore rules (inbox + triptych)      | ✅       | ⚠️        | Rules exist, NO tests    |
| 7    | Firestore rules (dispatches, users)     | ✅       | ⚠️        | Rules exist, NO tests    |
| 8    | Firestore rules (public, audit, events) | ✅       | ⚠️        | Rules exist, NO tests    |
| 9    | Firestore rules (SMS layer)             | ✅       | ⚠️        | Rules exist, NO tests    |
| 10   | Firestore rules (coordination)          | ✅       | ⚠️        | Rules exist, NO tests    |
| 11   | Firestore rules (hazard zones)          | ✅       | ⚠️        | Rules exist, NO tests    |
| 12   | Final rules cleanup                     | ✅       | ✅        | Complete                 |
| 13   | RTDB rules + tests                      | ✅       | ✅        | Complete                 |
| 14   | Storage rules + tests                   | ✅       | ✅        | Complete                 |
| 15   | Composite indexes                       | ✅       | ✅        | Complete                 |
| 16   | Idempotency guard                       | ✅       | ✅        | Complete                 |
| 17   | Rule coverage CI gate                   | ✅       | ⚠️        | Script exists, NOT in CI |
| 18   | Schema migration runbook                | ✅       | ✅        | Complete                 |
| 19   | **Verification sweep**                  | ✅       | ❌        | **NOT EXECUTED**         |

**Legend:**

- ✅ Complete and verified
- ⚠️ Partially complete (code exists, tests missing)
- ❌ Missing entirely

---

## 🎯 VERDICT

### **DO NOT MERGE**

This PR fails the fundamental security test: **the security rules were never actually tested against the Firebase emulator.**

The spec is a **security contract**. It says:

> "Every command must exit 0. If any fail, stop and fix before editing progress docs."

The progress documentation was updated **without running the verification sweep**. This is a security violation for a disaster response system.

---

## 📋 REMEDIATION PLAN

### Before Merge (Must Do):

1. **Write the Missing 14+ Firestore Rule Test Files**

   ```bash
   # Create each test file with comprehensive coverage:
   functions/src/__tests__/rules/report-inbox.rules.test.ts
   functions/src/__tests__/rules/reports.rules.test.ts
   functions/src/__tests__/rules/report-private.rules.test.ts
   functions/src/__tests__/rules/report-ops.rules.test.ts
   functions/src/__tests__/rules/report-sharing.rules.test.ts
   functions/src/__tests__/rules/report-contacts.rules.test.ts
   functions/src/__tests__/rules/report-lookup.rules.test.ts
   functions/src/__tests__/rules/report-events.rules.test.ts
   functions/src/__tests__/rules/dispatches.rules.test.ts
   functions/src/__tests__/rules/users-responders.rules.test.ts
   functions/src/__tests__/rules/public-collections.rules.test.ts
   functions/src/__tests__/rules/sms.rules.test.ts
   functions/src/__tests__/rules/coordination.rules.test.ts
   functions/src/__tests__/rules/hazard-zones.rules.test.ts
   ```

   Each file must include:
   - `assertSucceeds` tests for authorized operations
   - `assertFails` tests for unauthorized access
   - Cross-role denial tests
   - Suspended user tests
   - Municipality boundary tests

2. **Run the Verification Sweep**

   ```bash
   # MUST PASS before updating progress.md
   firebase emulators:exec --only firestore,database,storage \
     "pnpm --filter @bantayog/functions test:rules"
   ```

   Expected result: All tests pass. If any fail, fix rules until they do.

3. **Add Rule Coverage to CI**

   Edit `.github/workflows/ci.yml`:

   ```yaml
   - name: Rule Coverage Check
     run: pnpm exec tsx scripts/check-rule-coverage.ts
   ```

4. **Write Schema Validation Tests**

   ```bash
   packages/shared-validators/src/reports.test.ts
   packages/shared-validators/src/dispatches.test.ts
   packages/shared-validators/src/events.test.ts
   packages/shared-validators/src/sms.test.ts
   packages/shared-validators/src/coordination.test.ts
   packages/shared-validators/src/hazard.test.ts
   ```

5. **Update Progress Documentation Honestly**

   Only after all verification commands pass:

   ```markdown
   ## Phase 2 Data Model and Security Rules Foundation (Complete)

   ### Verification Results

   | Step | Check                                        | Result |
   | ---- | -------------------------------------------- | ------ |
   | 1    | pnpm lint                                    | PASS   |
   | 2    | pnpm typecheck                               | PASS   |
   | 3    | pnpm test                                    | PASS   |
   | 4    | firebase emulators:exec ...                  | PASS   |
   | 5    | pnpm exec tsx scripts/check-rule-coverage.ts | PASS   |
   | 6    | pnpm build                                   | PASS   |
   ```

### Before Production Deployment (Additional Hardening):

6. **Add Emulator Tests to CI Pipeline**
   - Create dedicated CI job that spins up Firebase emulators
   - Run full rule test suite on every PR
   - Block merge if any rule test fails

7. **Manual Security Review**
   - Have a second engineer review all rule logic
   - Verify role boundaries are correct
   - Check municipality isolation
   - Validate suspended account handling

8. **Load Testing**
   - Test rules under realistic concurrent load
   - Verify no race conditions in idempotency logic
   - Confirm transaction isolation works

---

## 📚 LESSONS LEARNED

### Why This Matters

**Firestore rules are security-critical infrastructure:**

- They control every write operation in the system
- Bugs = denied emergency reports = failed disaster response
- There's no "fail open" — if rules are wrong, the system is down

**Emulator testing is non-negotiable:**

- The rules DSL has subtle semantics (resource.data vs request.resource.data)
- Function parameter defaults can hide bugs
- `allow` vs `allow read, allow write` behaves differently
- Only emulator tests catch these issues

**Verification gates exist for a reason:**

- The spec explicitly said "stop and fix before editing progress docs"
- Cutting corners on security testing is a culture smell
- "Complete" means "verified", not "code written"

### Process Improvements Needed

1. **CI Should Match Local Verification**
   - If spec says run `firebase emulators:exec`, CI must run it
   - Local and CI environments must be equivalent

2. **Test Files Are First-Class Deliverables**
   - They're not optional "nice to have"
   - They're part of the security contract
   - Missing tests = incomplete feature

3. **Progress Docs Must Be Honest**
   - Don't update progress.md until verification passes
   - "All implementation tasks complete" ≠ "All tasks complete"
   - Verification is a task, not a formality

---

## 🔗 REFERENCES

- **Spec:** docs/superpowers/plans/2026-04-17-phase-2-data-model-security-rules.md
- **PR:** https://github.com/Exc1D/bantayog-alert/pull/42
- **Progress:** docs/progress.md (lines 173-207)
- **CI Config:** .github/workflows/ci.yml

---

**Reviewed by:** Claude Code (Adversarial/Skeptical Mode)
**Date:** 2026-04-17
**Recommendation:** ❌ DO NOT MERGE - Complete verification tasks first
