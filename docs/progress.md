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
