# Architecture Refactoring — Domain-Driven Reorganization

**Date:** 2026-05-20
**Status:** ✅ Implemented (all 4 phases + Phase 2 + Phase 3 complete)
**Author:** opencode

---

## 1. Problem Statement

The codebase was organized by **technical layer** (callables/, triggers/, services/) rather than **business domain**. This created three friction points:

1. **Navigation cost**: Adding or modifying a feature required finding files across `callables/`, `triggers/`, `scheduled/`, and `services/` — 53 callable files in one flat directory.
2. **Unclear ownership**: `shared-validators` was a catch-all with 39 source files mixing Zod schemas, state machines, runtime validators, error types, and logging utilities.
3. **Test coupling**: Domain logic was interleaved with Firebase SDK calls, making unit tests require heavy mocking.

---

## 2. Solution: Domain-Driven Reorganization

### Before (by technical layer)

```
functions/src/
  callables/  ← 53 files, flat
  triggers/   ← 13 files
  services/   ← 8 files
  scheduled/  ← 5 files
  auth/       ← 2 files
```

### After (by business domain)

```
functions/src/
  domains/
    media/      ← 3 source + 2 tests (upload, finalize, relocate)
    users/      ← 7 source (register, create, roster, auth, claims)
    alerts/     ← 4 source + 1 test (declare, subscribe, data incidents)
    agency/     ← 9 source + 6 tests (assistance, handoffs, SOS, field mode)
    ops/        ← 12 source + 10 tests (metrics, audit, analytics, FCM)
    reports/    ← 16 source + 17 tests (inbox, verify, reject, close, merge, etc.)
    dispatches/ ← 15 source + 11 tests (dispatch, accept, advance, escalate, monitor)
    erasure/    ← 7 source + 5 tests (erasure, retention, legal hold, export)
  callables/    ← 3 cross-cutting (https-error, callable-config, app-check-config)
  services/     ← 4 cross-cutting (geocode, municipality-lookup, rate-limit, responder-eligibility)
  idempotency/  ← 1 (guard)
  constants/    ← 2 (roles, retention)
  bootstrap/    ← Seed scripts
  http/         ← SMS webhooks
  firestore/    ← SMS processor
  __tests__/    ← Integration/adversarial tests
```

### Domain Module Pattern

Each domain groups related callables, triggers, scheduled functions, and tests:

- **Callables** — `onCall` entry points with error handling
- **Triggers** — Firestore/storage event handlers
- **Scheduled** — Cron functions
- **Tests** — Alongside source in `__tests__/`

Cross-domain imports use relative paths (e.g., `../ops/audit-stream.js`).
Cross-cutting utilities (`https-error`, `idempotency/guard`, `constants`) stay in place.

---

## 3. Migration Strategy

Executed in 4 incremental phases, each verified independently:

| Phase | Domains                           | Files | Verification                   |
| ----- | --------------------------------- | ----- | ------------------------------ |
| 1a    | media/                            | 5     | typecheck + lint + 7/7 tests   |
| 1b    | users/ + alerts/                  | 12    | typecheck + lint + 17/17 tests |
| 1c    | agency/ + ops/                    | 31    | typecheck + lint + 39/39 tests |
| 1d    | reports/ + dispatches/ + erasure/ | 73    | typecheck + lint + 98/98 tests |

Each phase: `git mv` → update imports → update `index.ts` → update tests → verify.

---

## 4. Verification Gates (per phase)

1. `pnpm --dir functions typecheck` — clean
2. `pnpm --dir functions lint` — clean
3. Domain tests pass
4. Full test suite: same pass/fail/skip counts as before (no regressions)

---

## 5. What This Enables

Adding a new feature (e.g., "incident command posts") now means:

1. Create `functions/src/domains/command-posts/` with source + tests
2. Add exports to `index.ts`
3. Done.

**Before**: Search through 53 callable files, 13 trigger files, 8 service files.
**After**: Open one domain directory. Everything is there.

---

## 6. Deferred: shared-state-machines Extraction

Per user feedback: do NOT mix package extraction with directory reorganization.
`shared-validators` (39 files) stays as-is. Extract state machines only if there's a concrete pain point (slow imports, broken tree-shaking). YAGNI otherwise.
