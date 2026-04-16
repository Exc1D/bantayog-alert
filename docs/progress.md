# Progress - 2026-04-15

## P0 Security Fixes (Complete)

**Branch:**
**Plan:**
**Status:**

### Fixed Issues

| ID              | Issue                                                | Fix                                                                   |
| --------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| CRITICAL-AUTH-2 | `getMunicipalityReports` ignores municipality filter | Added `where('approximateLocation.municipality', '==', municipality)` |

### Firestore Indexes Deployed

**Project:** `bantayog-alert-staging`
**Deployed:** 2026-04-15

| Collection | Index                                                  | Purpose                     |
| ---------- | ------------------------------------------------------ | --------------------------- |
| `reports`  | `approximateLocation.municipality ASC, createdAt DESC` | Municipal admin report list |

|

### Test Summary

- **Test summary:** 1063/1068 tests passing (5 pre-existing MapView.test.tsx failures unrelated to P0 work)
- **TypeScript:** Clean (`npm run typecheck` passes)

### Previous Work (Condensed)

**2026-04-14:** QA Edge Case Scan — 5 parallel agents scanned codebase, identified 12 critical issues across security,

See `docs/learnings.md` for detailed technical decisions and lessons learned.

---

## Phase 0 Foundation - Task 4 (Complete)

**2026-04-16:** Task 4 - shared-validators package (TDD)

- Created @bantayog/shared-validators package with Zod schemas
- Report inbox validation: GPS/barangay-only payloads, responder_witness blocking, idempotencyKey enforcement
- Dispatch validation: State machine transitions (4 allowed, 7 disallowed)
- TDD discipline: All 17 tests written first (verified RED), then implemented (verified GREEN)
- Test coverage: 6 report-inbox + 11 dispatch tests = 100% passing
- Build: TypeScript compilation clean, declaration files emitted

---

## Phase 0 Foundation - Tasks 11-13 (Complete, 2 files with known issues)

**2026-04-16:** Tasks 11-13 - Firestore security rules test harness + tests

- Created `tests/firestore/` with 7 files: `package.json`, `setup.ts`, `helpers.ts`, `report-inbox.test.ts`, `auth-support.test.ts`, `public-collections.test.ts`, `negative-security.test.ts`
- Uses `@firebase/rules-unit-testing` + Vitest for TDD approach
- **PASS (23/33):** `report-inbox.test.ts` (7/7), `auth-support.test.ts` (6/6), `negative-security.test.ts` (10/11)

**Known issues:**

1. `public-collections.test.ts` — all 9 tests fail with "Firestore has already been started" because `@firebase/rules-unit-testing`'s `initializeTestEnvironment` is a singleton per project ID; vitest runs all test files in the same process, causing emulator port/state conflicts when the 3rd test file initializes
2. `Daet admin CAN read own report_private` in `negative-security.test.ts` — fails because `isActivePrivileged()` requires `active_accounts/admin_daet` to exist; the seed data is set in `beforeEach`'s `withSecurityRulesDisabled()` but the read operation runs before the seed is visible to rules

**Commit:** `a556c36`
