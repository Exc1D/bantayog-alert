# Agent Team Design — Claude Code Orchestrator + OpenCode Kimi Workers

**Date:** 2026-04-24
**Status:** Approved
**Scope:** Multi-agent development workflow for Bantayog Alert (Phases 6–12)

---

## 1. Overview

This document specifies the multi-agent development workflow for Bantayog Alert. Claude Code (Claude Sonnet 4.6) acts as the orchestrator. OpenCode Exxeed agents running Kimi models act as implementation workers. The PRD and architecture spec are the authoritative source of truth for all task decomposition.

**What this system is:**

- A structured way to parallelize implementation work across PRD phases
- A quality-gated pipeline with machine-verifiable checks
- A human-in-the-loop escalation path for failures that exceed agent capability

**What this system is not:**

- A replacement for human judgment on architecture decisions
- A fully autonomous deployment pipeline (no agent may deploy to any environment)
- A way to skip the two-stage review gate

---

## 2. Roles

### Claude Code (Orchestrator)

Runs as the primary Claude Code session. Responsible for:

- Reading the PRD and current `docs/progress.md` at the start of each phase
- Decomposing phases into tasks scoped to package boundaries
- Writing task briefs to `docs/agent-tasks/YYYY-MM-DD-[task-slug].md`
- Maintaining the DAG at `docs/agent-tasks/dag.json`
- Creating git worktrees for each task
- Spawning OpenCode Exxeed workers via `Bash run_in_background`
- Running Stage 1 and Stage 2 gates (automated scripts)
- Applying suspicion scoring before merging to `main`
- Logging all agent runs to `docs/agent-tasks/telemetry.jsonl`
- Writing escalation artifacts on terminal failure

### OpenCode Exxeed Workers

Invoked via `opencode run` with the `--agent exxeed` flag. Each worker:

- Receives the full task brief as the run message
- Follows the Exxeed 4-phase workflow: Spec Ingestion → Implementation Plan → Implementation → Verification
- Writes a prose handoff to `.claude/plans/exxeed-[slug]-report.md`
- Writes a machine-readable result to `.claude/plans/exxeed-[slug]-result.json`
- Exits — does not merge, deploy, or open PRs

### Git Worktrees

One worktree per task, located at `../bantayog-wt-[task-slug]`, on branch `agent/[task-slug]`. Workers operate exclusively within their worktree. They cannot see or affect sibling worktrees.

---

## 3. Models

| Task type                                             | Model                              |
| ----------------------------------------------------- | ---------------------------------- |
| Standard implementation (callables, UI, hooks)        | `kimi-for-coding/k2p6`             |
| Schema design, Firestore rules, algorithm-heavy tasks | `kimi-for-coding/kimi-k2-thinking` |

The model is specified in the task brief and passed to `opencode run --model`.

---

## 4. Task Brief Format

Saved to `docs/agent-tasks/YYYY-MM-DD-[task-slug].md`:

```markdown
# Agent Task: [task-slug]

Date: YYYY-MM-DD
Phase: [PRD phase number]
Model: kimi-for-coding/k2p6
Worktree: ../bantayog-wt-[task-slug]
Branch: agent/[task-slug]
Modifies lockfile: false

## Objective

[One sentence — what this task produces]

## Spec references

- docs/superpowers/specs/[relevant-design.md]
- prd/bantayog-alert-prd-v1.0.md §[section]

## Requirements

R01: [functional requirement]
R02: [functional requirement]
R03: [constraint — e.g., "do not touch firestore.rules directly, use scripts/build-rules.ts"]

## Files to create

- packages/shared-validators/src/[file].ts — [purpose]

## Files to modify

- packages/shared-validators/src/index.ts — re-export new schema

## Files NOT to touch

- [everything outside this task's package boundary]
- [list explicitly — this is enforced by Stage 1]

## Verification command

pnpm --filter @bantayog/shared-validators test && pnpm --filter @bantayog/shared-validators typecheck

## Blocks (cannot start until this task merges)

- [task-slug-B]

## Blocked by (must merge before this task starts)

- [task-slug-A]
```

---

## 5. Machine-Readable Result Format

Workers write `.claude/plans/exxeed-[slug]-result.json` before exiting:

```json
{
  "task": "[task-slug]",
  "verification_exit_code": 0,
  "verification_command": "pnpm --filter @bantayog/functions test",
  "files_changed": ["functions/src/callables/telemetry.ts"],
  "requirements_satisfied": ["R01", "R02", "R03"],
  "open_items": [],
  "baseline": "47 passing, 0 failing",
  "final": "49 passing, 0 failing",
  "discovered_required_files": []
}
```

`discovered_required_files` is populated if the agent found a file outside the allowed list that is genuinely required (not a scope violation). Stage 1 fails on a non-empty list, but Claude Code may update the task brief and respawn rather than treating it as a hard failure.

---

## 6. Dependency Graph

Claude Code maintains `docs/agent-tasks/dag.json` for each phase:

```json
{
  "T1": { "blocks": ["T2", "T3", "T4"], "modifies_lockfile": false },
  "T2": { "blocks": ["T6"], "modifies_lockfile": false },
  "T3": { "blocks": ["T5"], "modifies_lockfile": true },
  "T4": { "blocks": ["T5"], "modifies_lockfile": true },
  "T5": { "blocks": ["T6"], "modifies_lockfile": false },
  "T6": { "blocks": [], "modifies_lockfile": false }
}
```

**Spawn rules:**

- `blocked_by` for any task is the inverse of `blocks` — computed at runtime by Claude Code, not stored in the file. T1 blocks T2 means T2 is blocked_by T1.
- A task spawns when all tasks in its `blocked_by` set have merged to the phase staging branch.
- Two tasks with `modifies_lockfile: true` may never run in parallel. The second waits for the first to merge.
- A `lockfile-reconcile` task (no code changes, runs `pnpm install`) is appended after any merge group that contained a `modifies_lockfile` task.

**Layer ordering (general rule):**

```
L0 — shared-validators schemas and types     (no deps)
L1 — Firestore rules, functions/callables    (needs L0)
L2 — apps (admin-desktop, citizen-pwa,       (needs L1 for the package it consumes)
           responder-app)
L3 — E2E tests, acceptance harness           (needs L2)
```

Task briefs override this with explicit edges when the actual dependency is finer-grained.

---

## 7. Invocation

Claude Code spawns a worker:

```bash
opencode run "$(cat docs/agent-tasks/YYYY-MM-DD-[task-slug].md)" \
  --agent exxeed \
  --model kimi-for-coding/k2p6 \
  --dir ../bantayog-wt-[task-slug] \
  --dangerously-skip-permissions
```

Workers run via `Bash run_in_background: true` so Claude Code can spawn multiple in parallel without blocking.

**Worktree setup (before spawning):**

```bash
git worktree add ../bantayog-wt-[task-slug] -b agent/[task-slug]
```

---

## 8. Merge Strategy — Phase Staging Branch

Parallel tasks never merge directly to `main`. All tasks in a phase merge to a phase staging branch first:

```
main
  └── phase/[N]-[description]
        ├── agent/T2
        ├── agent/T3
        └── agent/T4
```

When **all** tasks in a merge group pass both gates, the staging branch merges to `main` as a single PR. If any task fails terminally, the staging branch is deleted — no partial state lands on `main`.

---

## 9. Quality Gates

### Stage 1 — Artifact Verification (per task)

Runs immediately after a worker exits, before the branch is merged to the staging branch.

**Script:** `scripts/agent-gate-stage1.sh <task-slug> <worktree-path>`

Checks:

1. `exxeed-[slug]-result.json` exists and is valid JSON
2. `verification_exit_code` is `0`
3. `git diff --name-only main` output in the worktree contains only files listed in the task brief's `files_to_create` and `files_to_modify` fields
4. `discovered_required_files` is empty (if non-empty, fail-open: Claude Code reviews and may update brief + respawn)
5. `open_items` contains no entries marked `❌`

Exit 0 = pass. Exit 1 = fail. No prose parsing.

### Stage 2 — Code Quality (per task, then combined)

**Runs twice:**

**Run A — per-task** on the worktree before merging to the staging branch:

```bash
# scripts/agent-gate-stage2.sh <pnpm-filter>
pnpm --filter $1 lint -- --max-warnings=$(cat .lint-baseline) &&
pnpm --filter $1 typecheck &&
pnpm --filter $1 test -- --coverage &&
if [[ "$1" == *"@bantayog/functions"* ]]; then
  firebase emulators:exec --only firestore,database,storage \
    "pnpm --filter $1 test:rules"
fi &&
scripts/check-no-any.sh $1 &&
scripts/check-no-empty-catch.sh $1 &&
scripts/check-lockfile-integrity.sh
```

The `test:rules` step only runs when the filter includes `@bantayog/functions`. The `if` block exits non-zero on test failure — `|| true` is intentionally absent.

**Run B — combined staging branch** after all parallel tasks have merged to the staging branch, before opening the PR to `main`:

```bash
# scripts/agent-gate-stage2-combined.sh <staging-branch>
git checkout $1
npx turbo run lint typecheck test --affected &&
firebase emulators:exec --only firestore,database,storage \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rules" &&
scripts/check-lockfile-integrity.sh
```

This catches cross-task issues (duplicate imports, type errors that only appear when both T2 and T5 are present together).

### Lint Baseline

`.lint-baseline` is a checked-in file containing the current warning count from `main`:

```bash
# Generate once, commit to main:
pnpm lint 2>&1 | grep -c "warning" > .lint-baseline
```

Stage 2 uses `--max-warnings=$(cat .lint-baseline)` so tasks fail only on _new_ warnings, not pre-existing ones.

---

## 10. Circuit Breaker & Retry

```
Attempt 1 → Stage 1 or Stage 2 fails
  └── Claude Code writes targeted correction brief
      (specific violations only — not a full re-statement of the original brief)
  └── Fresh worktree created: ../bantayog-wt-[slug]-retry-1
      (not --continue; clean context prevents compounding hallucinated state)
  └── Agent respawned

Attempt 2 → Stage 1 or Stage 2 fails again
  └── Claude Code attempts direct fix on the worktree

Claude Code fix → Stage 2 still fails
  └── TERMINAL_FAILURE: escalate to human, no further auto-retry
```

---

## 11. Human-in-the-Loop Gate

Computed before merging the staging branch to `main`:

| Signal                                               | Score                |
| ---------------------------------------------------- | -------------------- |
| Total files changed > 5                              | +2                   |
| Total lines changed > 100                            | +1                   |
| Any file outside `allowed_files` detected at Stage 1 | +5 (immediate block) |
| Firestore rules or `firestore.indexes.json` touched  | +3                   |
| Any task passed on attempt 2+                        | +2                   |
| Any `discovered_required_files` entries accepted     | +1                   |

**Score ≥ 3:** Claude Code posts a summary (files changed, gate results, suspicion score, diff stat) and waits for an explicit `proceed` from the user before merging.

**Score < 3:** Claude Code merges automatically.

Firestore rules changes always score ≥ 3 by definition and always require human approval.

---

## 12. Observability

Every agent run appends one line to `docs/agent-tasks/telemetry.jsonl`:

```jsonl
{
  "ts": "2026-04-24T10:00:00Z",
  "phase": 6,
  "task": "T3",
  "model": "kimi-for-coding/k2p6",
  "agent": "exxeed",
  "attempt": 1,
  "stage1": "PASS",
  "stage2": "FAIL",
  "duration_sec": 420,
  "files_changed": 3,
  "lines_changed": 87
}
```

Claude Code writes this entry after each gate run, not at agent exit. The telemetry file is committed to `main` at the end of each phase.

---

## 13. Escalation — TERMINAL_FAILURE

When the circuit breaker reaches terminal state, Claude Code:

1. **Writes** `.claude/escalations/YYYY-MM-DD-[task-slug]-terminal.md` containing:
   - The telemetry entries for all attempts (from `telemetry.jsonl`)
   - The full `git diff` from the last failed worktree
   - The original task brief
   - All correction briefs written during retry
   - A one-paragraph diagnosis of what the agent failed to do and why Claude Code's direct fix also failed

2. **Opens a GitHub issue** with:
   - Title: `[terminal-failure] Phase N — [task-slug]`
   - Label: `terminal-failure`
   - Body: link to the escalation file + one-paragraph summary

3. **Stops** — does not retry, does not attempt a workaround, does not merge partial work.

The human receives: escalation file path, GitHub issue link, and the exact `git worktree` path where the failed state lives (not deleted until human resolves).

---

## 14. Phase Workflow Summary

```
1. Claude Code reads PRD phase + progress.md
2. Claude Code decomposes into tasks, writes task briefs, writes dag.json
3. Claude Code creates phase staging branch: git checkout -b phase/N-description
4. For each task whose blocked_by set is empty:
     a. git worktree add ../bantayog-wt-[slug] -b agent/[slug]
     b. opencode run (background) → worker runs Exxeed 4-phase workflow
     c. Worker exits → Stage 1 gate runs
     d. Stage 1 pass → Stage 2 Run A gate runs
     e. Both pass → merge agent/[slug] into staging branch
     f. Newly unblocked tasks → repeat from step 4
5. All tasks merged to staging branch
6. lockfile-reconcile task runs (pnpm install)
7. Stage 2 Run B (combined) runs on staging branch
8. Suspicion score computed
9. Score < 3 → merge staging → main (single PR)
   Score ≥ 3 → post summary, wait for human proceed
10. Worktrees deleted, telemetry.jsonl committed, progress.md updated
```

---

## 15. Example: Phase 6 — Responder App Telemetry

**Tasks and DAG:**

```
T1 (schemas, kimi-k2-thinking)
  → T2 (firestore rules, kimi-k2-thinking)  ──────────────────────> T6 (e2e)
  → T3 (functions/callables, kimi-k2p6, modifies_lockfile)            ↑
  → T4 (capacitor native setup, kimi-k2p6, modifies_lockfile) ──> T5 (hooks + race-loss UI) ──┘
                                                                   (needs T1, T3, T4)
```

T3 and T4 both modify lockfiles → serialized. T2 has no lockfile changes → runs parallel to whichever of T3/T4 is active.

**Execution sequence:**

```
Spawn: T1 (alone — no deps, sets baseline)
T1 merges → Spawn: T2, T3 in parallel
  T3 completes → lockfile-reconcile → T4 spawns
  T2 completes (no lockfile conflict with T4)
T4 merges → lockfile-reconcile → T5 spawns
  (T3 must also be merged before T5 starts)
T5 merges → T6 spawns
T6 merges → Stage 2 Run B → suspicion score → PR to main
```
