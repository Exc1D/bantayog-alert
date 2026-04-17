# Progress - 2026-04-17

## Phase 0 Foundation (Complete)

**Branch:** `feature/phase-0-foundation`
**Plan:** See `docs/superpowers/specs/2026-04-17-phase-0-design.md`
**Status:** All verification steps passed - ready for PR

### Verification Results (2026-04-17)

| Step | Check                                  | Result                                 |
| ---- | -------------------------------------- | -------------------------------------- |
| 1    | Clean pnpm install (--frozen-lockfile) | PASS                                   |
| 2    | pnpm lint                              | PASS (13 tasks)                        |
| 3    | pnpm format:check                      | PASS (after Prettier fix)              |
| 4    | pnpm typecheck                         | PASS (13 tasks)                        |
| 5    | pnpm test                              | PASS (9 tests in shared-validators)    |
| 6    | pnpm build                             | PASS (10 tasks, all artifacts present) |
| 7    | Firebase emulator (firestore)          | PASS                                   |
| 8    | Terraform validate + fmt               | PASS                                   |

### Build Artifacts Verified

- `apps/citizen-pwa/dist/index.html` present
- `apps/responder-app/dist/index.html` present
- `apps/admin-desktop/dist/index.html` present
- `functions/lib/index.js` present
- `packages/shared-types/lib/index.d.ts` present

### Test Summary

- **Tests:** 9 passing (shared-validators idempotency tests)
- **TypeScript:** Clean
- **ESLint:** Clean

### Bugs Fixed During Verification

| ID       | Issue                                                               | Fix                                                                                                                                              |
| -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| VERIFY-1 | Vitest workspace config included `functions` dir (no config there)  | Removed `'functions'` from `vitest.workspace.ts`                                                                                                 |
| VERIFY-2 | 14 docs/rules files not Prettier-formatted                          | Ran `pnpm prettier --write` on all 14 files                                                                                                      |
| VERIFY-3 | Root vitest workspace path resolution broken packages without tests | Renamed `vitest.config.ts` → `vitest.workspace.ts`, removed test scripts from non-test packages, changed root `pnpm test` to use vitest directly |

---

## P0 Security Fixes (2026-04-15 — Complete)

**Branch:** (P0 branch, merged)
**Status:** Complete

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

---

See `docs/learnings.md` for detailed technical decisions and lessons learned.
