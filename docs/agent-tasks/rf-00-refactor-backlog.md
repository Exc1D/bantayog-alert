# RF-00 — Ranked Refactor Backlog (Index)

**Status:** Backlog index. Each `rf-NN` file is one executable slice for one
agent on one branch. Recon facts below were verified 2026-06-12; every slice
re-verifies its own facts before editing.

## Evidence base (fallow 2.91.0, 2026-06-12)

- Health score 68/C. Average cyclomatic 1.6, p90 3, maintainability avg 92 —
  the codebase is healthy on average; debt is concentrated, not uniform.
- 21 critical / 59 high complexity findings; 169 of 10,366 functions over
  threshold. Worst function: `buildIncidents` (cognitive 48).
- Duplication 20.7%, concentrated in test scaffolding and `functions/src`.
- Dead code 0 — but ~930 files are treated as plugin entry points, so
  unused-export detection inside app `src/` is effectively disabled. Orphan
  claims below come from manual grep, not fallow.
- The CI fallow audit gate (`new-only`) now blocks newly introduced
  complexity/duplication, so this backlog is a ratchet: debt only goes down.

## Ranked slices

| Rank | Slice | Concern                                                | Gate                                 |
| ---- | ----- | ------------------------------------------------------ | ------------------------------------ |
| 1    | rf-01 | Retire/disposition 20 orphaned admin callable wrappers | **User decision matrix**             |
| 2    | rf-09 | Delete leftover `shared-sms-parser` package            | None — execute now                   |
| 3    | rf-02 | Dedupe `isPublicIncidentData` guard (citizen-pwa)      | None — execute now                   |
| 4    | rf-03 | Decompose `buildIncidents` (worst function, cog 48)    | After rf-02                          |
| 5    | rf-04 | Decompose `redispatch-report.ts` core                  | None — execute now                   |
| 6    | rf-05 | Decompose `merge-duplicates.ts` core                   | **After rf-01 keeps it**             |
| 7    | rf-06 | Decompose SubmitReportForm `WizardContainer`           | None — execute now                   |
| 8    | rf-07 | Extract `Step2WhoWhere.handleNext` policy              | None — execute now                   |
| 9    | rf-08 | Dedupe functions test scaffolding (batched)            | None — execute now                   |
| 10   | rf-10 | Keep-or-remove speculative `incident-core` layer       | **User decision**                    |
| 11   | rf-11 | Package consolidation assessment (7 → fewer)           | **User approval; after rf-09/rf-10** |

## Execution rules (binding for every slice)

1. One slice = one branch = one PR. Branch name `refactor/rf-NN-<slug>`.
   Never bundle slices.
2. Before editing: re-run the slice's recon commands. If a fact has drifted
   (a wrapper gained a caller, a file moved), stop and report instead of
   proceeding.
3. Red-first. Run the named tests and watch them pass before touching code;
   decomposition slices are behavior-neutral, so the same tests must pass
   after with the same test counts. New pure modules get their own focused
   tests that fail before the module exists.
4. After editing: `fallow audit --format json --quiet --base main --gate new-only 2>/dev/null || true`
   must report verdict `pass` (CI enforces the same gate).
5. Never edit `firestore.rules`, `firestore.rules.template`,
   `database.rules.json`, or `firestore.indexes.json` without showing the
   full diff and getting explicit user approval first (CLAUDE.md §8.4).
   rf-01 bucket A is the only slice expected to reach rules territory.
6. Worktree hygiene: `git branch -vv` + clean `git status` before edits;
   `pnpm install --frozen-lockfile` in fresh worktrees; build any workspace
   package `lib` output the tests import before trusting vitest.
7. Finish each slice by appending to `docs/progress.md` (and
   `docs/learnings.md` if a durable rule emerged), then two-stage review
   (spec compliance → code quality) before merge.

## Decision gates (for the user, before agents start the gated slices)

- **rf-01:** approve/edit the per-wrapper disposition matrix (retire /
  keep backend-only / wire UI later).
- **rf-10:** keep `incident-core` as inert 2027 contracts, or remove it
  (recoverable from git; `codex/incident-core-contracts` branch preserved).
- **rf-11:** review the consolidation proposal the slice produces before any
  package is moved.

## Explicitly rejected

- A whole-codebase rewrite. The metrics above do not support one: average
  complexity is fine, debt is localized, and the pilot deadline (roadmap:
  live LGU pilot by 2026-12-31) makes a rewrite the riskiest possible move.
- Suppressing fallow findings instead of fixing them (learnings.md).
- Mixing any slice with feature work.
