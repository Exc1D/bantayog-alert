# RF-11 — Package Consolidation Assessment (7 → Fewer)

**Priority:** P3 (structural simplification; valuable but lowest urgency —
nothing is broken, the cost is per-package ceremony: build/lint/typecheck
config, lockfile entries, `lib` output drift, worktree rebuild gotchas)

**Gate:** Two-phase. Phase 1 (this slice) produces an evidence-based
proposal — NO code movement. Phase 2 executes only after the user approves
the proposal, one merge per branch.

**Ordering:** After rf-09 (sms-parser deleted) and rf-10 (incident-core
decided) — both change the inventory this assessment ranks.

## Recon facts (2026-06-12 — re-verify)

- Current `packages/`: shared-data, shared-firebase, shared-sms-parser
  (leftover, rf-09 deletes), shared-state-machines, shared-types, shared-ui,
  shared-validators — 7 packages serving 3 apps + functions.
- Consolidation was already deferred once as "a standalone refactor"
  (2026-06-02 audit). This slice IS that standalone refactor's planning
  phase.
- Known friction to weigh (learnings.md): shared packages need app runtime
  deps as `peerDependencies`; package removal demands full-surface cleanup;
  fresh worktrees fail until package `lib` outputs are built; `pnpm
--filter` resolves wrong from worktrees.

## Phase 1 deliverable (one markdown file)

`docs/architecture/package-consolidation-proposal.md` containing, per
package: export inventory (`fallow list --entry-points` + manual grep),
which workspaces import it, LOC, and a merge/keep/delete recommendation
with a one-line reason. Likely candidates to evaluate — verify, don't
assume: tiny single-consumer packages folding into their consumer;
shared-types vs shared-validators overlap (Zod-inferred types may make
hand-written ones redundant); shared-data vs shared-firebase boundary.

## Design constraints

- Evidence over taste: every recommendation cites the import graph, not
  "feels like too many packages".
- Respect frozen decisions: rf-10's outcome binds incident-core; canonical
  geography stays in shared-validators; `@bantayog/*` import specifiers
  that survive must not change for consumers in phase 2.
- Phase 2 (post-approval, separate branches): one package merge per branch,
  `git mv` to preserve history, update `exports`/deps/lockfile/CI filters
  together, full root verification per merge. No directory reorg mixed with
  package extraction (learnings.md).

## Red-first test

Not applicable for phase 1 (docs only) — justification: the deliverable is
a proposal. Phase 2 branches inherit the standard rule: root build/
typecheck/test must be green before and after each merge, with no test-count
loss.

## Out of scope

- Executing any merge in phase 1; touching `functions/` (not a shared
  package); app merges (Admin/Responder app consolidation is a product
  question, not a package question).

## Verification (phase 1)

- Proposal file exists; every claim has a reproducible command next to it
- `git diff --stat` shows only the new docs file
- User approves/edits the proposal → phase 2 slices get filed as
  `rf-11a`, `rf-11b`, … one per approved merge
