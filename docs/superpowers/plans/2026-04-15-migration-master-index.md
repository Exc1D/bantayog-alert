# Architecture Migration — Master Index

**Target spec:** `docs/architecture-spec.md` v2.0
**Created:** 2026-04-15

## Execution Order

Plans are numbered to reflect dependencies and risk sequencing. Execute serially unless noted parallelizable.

| # | Plan | Why this order | Risk | Parallel with |
|---|---|---|---|---|
| 0 | [P0 security fixes](./2026-04-15-plan-0-p0-security-fixes.md) | Foundation — don't migrate on broken code | Low | — |
| 1 | [Triptych → callable](./2026-04-15-plan-1-triptych-callable-migration.md) | Biggest architectural shift, unblocks rule-level security | **HIGH** — phased 3-PR rollout | — |
| 2 | [Responder GPS → RTDB](./2026-04-15-plan-2-responder-gps-rtdb.md) | Cost-critical, isolated | Low | Plans 3, 5, 6 |
| 3 | [Repository + converter layer](./2026-04-15-plan-3-repository-converter-layer.md) | Mechanical; enables Plan 4 | Low | Plans 2, 5, 6 |
| 4 | [Listener-fed cache](./2026-04-15-plan-4-listener-fed-cache.md) | Needs Plan 3's `subscribeTo*` methods | Low | Plans 5, 6 |
| 5 | [MFA for superadmin](./2026-04-15-plan-5-mfa-provincial-superadmin.md) | Unblocks locked-out admins | Medium | Plans 2, 3, 4, 6 |
| 6 | [Backend hardening](./2026-04-15-plan-6-backend-hardening.md) | Cloud Tasks, scheduled jobs, server rate limits | Medium | Plans 2, 3, 4, 5 |
| 7 | [Error boundaries + staging + SW](./2026-04-15-plan-7-error-boundaries-staging-sw.md) | Polish items | Low | Any |
| 8 | [Folder restructure](./2026-04-15-plan-8-folder-restructure.md) | LAST — pure churn, high diff noise | Medium (merge conflicts) | None — feature-freeze recommended |

## Critical Path

The shortest path to the spec's security posture is **0 → 1 → 7 (staging/SW) → 5**. Everything else can run parallel after Plan 1's PR 3 lands.

## Parallelization After Plan 1

Once Plan 1 is fully merged (rules flipped, client write path removed), Plans 2, 3, 5, 6, 7 are independent and can be picked up by different branches/engineers simultaneously. Plan 4 waits for Plan 3. Plan 8 waits for all others.

## Feature-Freeze Windows

- **During Plan 1 PR 2 → PR 3:** no new report-submission code paths; all changes route through the callable.
- **During Plan 8:** no new features — pure refactor window.

## Exit Criteria (spec fully satisfied)

- [ ] All reports created via `submitReport` callable (Plan 1 PR 3)
- [ ] No client writes to `reports`, `report_private`, `report_ops` (Plan 1 PR 3)
- [ ] Responder GPS in RTDB only (Plan 2)
- [ ] All Firestore access via repositories (Plan 3 Task 6)
- [ ] No `refetchInterval` in hooks (Plan 4 Task 4)
- [ ] Provincial superadmin requires TOTP (Plan 5)
- [ ] Cloud Tasks dispatch timer working (Plan 6)
- [ ] Scheduled archival/metrics running (Plan 6)
- [ ] Three envs: dev/staging/prod (Plan 7)
- [ ] Layered error boundaries (Plan 7)
- [ ] Folder structure matches spec §4.1 (Plan 8)
- [ ] Bundle budgets enforced in CI (Plan 8)

## Rollback Posture

- Each plan is independently revertable via `git revert` of its merge commit, with the following caveats:
  - Plan 1 PR 3 (rule flip) requires re-deploying rules to revert. Keep old rules in git history.
  - Plan 5 (MFA) cannot be rolled back mid-enrollment without locking superadmins out — coordinate via emergency "disable MFA" CF that clears enrolled factors.

## Post-Migration

Update `CLAUDE.md` to reflect new folder structure and remove references to `src/domains/` and `src/shared/services/firestore.service.ts`. Update `docs/progress.md` with migration completion entry.
