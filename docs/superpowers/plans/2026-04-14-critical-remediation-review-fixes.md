# Critical Audit Remediation — Review Fixes

> **Plan type:** Implementation
> **Created:** 2026-04-14

**Goal:** Fix 3 remaining issues from the critical audit remediation review:
1. TypeScript error in `reportSubmission.service.ts` (missing `IncidentType` cast)
2. `// TODO` comments in `storage.rules` (should be removed)
3. Missing `functions/src/index.deleteUserData.test.ts` (spec gap)

**Tech Stack:** TypeScript, Vitest, Firebase Cloud Functions

---

## Task 1: Fix TypeScript error in reportSubmission.service.ts

**Files:**
- `src/features/report/services/reportSubmission.service.ts`

**Step 1:** Add `IncidentType` to the import from `@/shared/types/firestore.types`

**Step 2:** Change lines 30-34 to cast the result as `IncidentType`:

```typescript
const incidentType = (VALID_INCIDENT_TYPES.includes(
  reportData.incidentType as typeof VALID_INCIDENT_TYPES[number]
)
  ? reportData.incidentType
  : 'other') as IncidentType
```

**Step 3:** Run `npm run typecheck` to verify no errors remain (MapView pre-existing error is out of scope)

---

## Task 2: Remove `// TODO` comments from storage.rules

**Files:**
- `storage.rules`

**Step 1:** Remove lines 9-10:

```diff
-      // TODO: Tighten read access once report ownership / admin viewing requirements are clarified.
-      // TODO: Add emulator-backed Storage rules tests when Storage emulator coverage is added.
```

**Step 2:** Verify the file looks clean

---

## Task 3: Add index.deleteUserData.test.ts

**Files:**
- Create: `functions/src/index.deleteUserData.test.ts`

**Background:** The `deleteUserData` callable at `functions/src/index.ts:291-364` handles:
- Auth account deletion
- `users/{uid}` deletion
- `roles/{uid}` deletion
- `report_private` + `report_ops` records for the target user
- Audit log entry (only when admin deletes another user)

**Test cases to implement:**

| # | Case | Expected |
|---|------|----------|
| 1 | Unauthenticated call | Throws `unauthenticated` error |
| 2 | User deletes own account | Deletes auth, users, roles, report_private, report_ops; no audit log |
| 3 | Superadmin deletes other user | Same as #2 + writes audit_log entry |
| 4 | Non-admin deletes other user | Throws `permission-denied` error |
| 5 | User with no report_private records | Succeeds gracefully (empty query) |

**Pattern:** Follow `createAlert.test.ts` using `firebase-functions-test` + `vi.hoisted()` for mocks.

**Step 1:** Create `functions/src/index.deleteUserData.test.ts` with all 5 test cases

**Step 2:** Run `cd functions && npm test -- --run src/index.deleteUserData.test.ts`

---

## Verification

After all tasks:

```bash
npm run typecheck
npm run test -- --run src/features/report/services/__tests__/reportSubmission.service.test.ts
cd functions && npm test -- --run src/index.deleteUserData.test.ts
cat storage.rules  # Verify no TODO lines
```

Expected:
- `npm run typecheck` → 0 new errors (pre-existing MapView error is unrelated)
- All tests → PASS
- `storage.rules` → clean (only rules, no TODO comments)

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/features/report/services/reportSubmission.service.ts` | Import `IncidentType`, add type cast |
| `storage.rules` | Remove `// TODO` lines |
| `functions/src/index.deleteUserData.test.ts` | New file — 5 tests for `deleteUserData` callable |
