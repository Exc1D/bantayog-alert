# Agent Team Design — Claude Code Orchestrator + OpenCode Kimi Workers

**Date:** 2026-04-24
**Version:** 2.0
**Status:** Approved
**Scope:** Multi-agent development workflow for Bantayog Alert (Phases 6–12)

---

## 0. Prerequisites

The following must be true before the workflow runs:

| Prerequisite                                                  | Check                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `opencode` CLI installed and authenticated                    | `opencode providers list` shows Kimi credentials                 |
| `gh` CLI installed and authenticated                          | `gh auth status` succeeds                                        |
| `git worktree` available                                      | `git --version` ≥ 2.5                                            |
| `.gitignore` covers `.env*`, `*.key`, `service-account*.json` | Verify before first phase                                        |
| `turbo.json` `--affected` graph is accurate                   | Run `npx turbo run lint --dry-run` and confirm affected packages |
| All tests on `main` are currently deterministic               | Run full suite twice; both runs must produce the same result     |

If any prerequisite fails, stop and fix it before spawning agents.

---

## 1. Overview

Claude Code (Claude Sonnet 4.6) acts as orchestrator. OpenCode Exxeed agents running Kimi models act as implementation workers. The PRD and architecture spec are the authoritative source of truth for all task decomposition.

**What this system is:**

- A structured way to parallelize implementation work across PRD phases
- A quality-gated pipeline with machine-verifiable checks at every stage
- A human-in-the-loop escalation path for failures that exceed agent capability

**What this system is not:**

- A replacement for human judgment on architecture decisions
- A fully autonomous deployment pipeline (no agent may deploy to any environment)
- A way to skip the two-stage review gate

---

## 2. Roles

### Claude Code (Orchestrator)

Responsible for: reading the PRD and `docs/progress.md`, decomposing phases into tasks, writing task artifacts, creating worktrees, managing the spawn semaphore, running all gate scripts, merging branches in dependency order, writing telemetry (including its own actions), and escalating on terminal failure.

Claude Code writes a telemetry entry for every action it takes, not just agent outcomes. See Section 12.

### OpenCode Exxeed Workers

Invoked via `opencode run`. Each worker:

- Receives the full task brief markdown as the run message
- Follows the Exxeed 4-phase workflow: Spec Ingestion → Implementation Plan → Implementation → Verification
- Writes a prose handoff to `.claude/plans/exxeed-[slug]-report.md`
- Writes a machine-readable result to `.claude/plans/exxeed-[slug]-result.json`
- Exits — does not merge, deploy, commit to the staging branch, or open PRs

### Git Worktrees

One worktree per task, at `../bantayog-wt-[slug]`, on branch `agent/[slug]`. Workers cannot see or affect sibling worktrees.

---

## 3. Models

All tasks use `kimi-for-coding/k2p6`. Model is specified in the companion JSON and passed to `opencode run --model`.

---

## 4. Task Artifacts (Two Files Per Task)

Each task produces two files with the same basename:

### 4a. Human-Readable Brief — `docs/agent-tasks/YYYY-MM-DD-[slug].md`

```markdown
# Agent Task: [slug]

## Objective

[One sentence — what this task produces]

## Spec references

- docs/superpowers/specs/[relevant-design.md]
- prd/bantayog-alert-prd-v1.0.md §[section]

## Requirements

R01: [functional requirement]
R02: [functional requirement]
R03: [constraint — e.g., "do not touch firestore.rules directly, use scripts/build-rules.ts"]

## Files NOT to touch

- [explicitly list adjacent files that are out of scope]
- [Stage 1 enforces this list against the companion JSON's allowed_files]
```

The brief is for the agent to read. All machine-parsed fields live in the companion JSON.

### 4b. Companion JSON — `docs/agent-tasks/YYYY-MM-DD-[slug].json`

```json
{
  "slug": "p6-t3-functions-telemetry",
  "phase": 6,
  "model": "kimi-for-coding/k2p6",
  "pnpm_filter": "@bantayog/functions",
  "timeout_minutes": 30,
  "modifies_lockfile": true,
  "base_commit": "",
  "allowed_files": {
    "create": ["functions/src/callables/telemetry.ts"],
    "modify": ["functions/src/index.ts"],
    "delete": []
  },
  "verification_command": "pnpm --filter @bantayog/functions test && pnpm --filter @bantayog/functions typecheck",
  "blocks": ["p6-t5"],
  "blocked_by": ["p6-t1"]
}
```

`base_commit` is empty when written by Claude Code and filled in at worktree creation time. `blocked_by` is the explicit inverse of `blocks` — both fields are written together so there is no ambiguity. `dag.json` is generated from the companion JSONs, not maintained separately.

**Single source of truth rule:** If `modifies_lockfile` in a companion JSON ever differs from the derived value in `dag.json`, Stage 1 fails immediately.

---

## 5. Machine-Readable Result Format

Workers write `.claude/plans/exxeed-[slug]-result.json`:

```json
{
  "task": "p6-t3-functions-telemetry",
  "verification_exit_code": 0,
  "verification_command": "pnpm --filter @bantayog/functions test && pnpm --filter @bantayog/functions typecheck",
  "files_changed": ["functions/src/callables/telemetry.ts"],
  "files_deleted": [],
  "requirements_satisfied": ["R01", "R02", "R03"],
  "open_items": [],
  "baseline": "47 passing, 0 failing",
  "final": "49 passing, 0 failing",
  "discovered_required_files": []
}
```

`discovered_required_files`: populated if the agent found a file outside `allowed_files` that is genuinely required (not a scope violation). Stage 1 fails-open on a non-empty list — Claude Code reviews and may update `allowed_files` in the companion JSON and respawn, rather than treating it as a hard failure.

---

## 6. Dependency Graph

Claude Code generates `docs/agent-tasks/dag.json` from companion JSONs at phase start:

```json
{
  "p6-t1": { "blocks": ["p6-t2", "p6-t3", "p6-t4"], "blocked_by": [], "modifies_lockfile": false },
  "p6-t2": { "blocks": ["p6-t6"], "blocked_by": ["p6-t1"], "modifies_lockfile": false },
  "p6-t3": { "blocks": ["p6-t5"], "blocked_by": ["p6-t1"], "modifies_lockfile": true },
  "p6-t4": { "blocks": ["p6-t5"], "blocked_by": ["p6-t1"], "modifies_lockfile": true },
  "p6-t5": { "blocks": ["p6-t6"], "blocked_by": ["p6-t3", "p6-t4"], "modifies_lockfile": false },
  "p6-t6": { "blocks": [], "blocked_by": ["p6-t2", "p6-t5"], "modifies_lockfile": false }
}
```

**Spawn rules:**

- A task spawns when all tasks in its `blocked_by` set have merged to the phase staging branch.
- Two tasks with `modifies_lockfile: true` may never run in parallel. The second waits for the first to merge.
- Lockfile reconciliation (`pnpm install`) runs **immediately** after each `modifies_lockfile` task merges to staging — not at phase end. This ensures downstream tasks start from a valid lockfile state.

**Layer ordering (general guidance — task-level edges override):**

```
L0 — shared-validators schemas and types
L1 — Firestore rules, functions/callables
L2 — apps (admin-desktop, citizen-pwa, responder-app)
L3 — E2E tests, acceptance harness
```

---

## 7. Invocation

### Pre-spawn checks

Before spawning any agent, Claude Code:

1. Verifies `opencode` is reachable: `opencode --version`
2. Confirms the worktree path is inside the project root — not above `$HOME` or in any path containing `.ssh`, `.gnupg`, `.config`, or system directories
3. Confirms no existing worktree at `../bantayog-wt-[slug]` matching the active name pattern. Worktrees matching `../bantayog-wt-[slug]-TERMINAL-*` are forensic archives from prior terminal failures and are not a blocking condition — they are skipped.
4. Records the base commit: `BASE_SHA=$(git rev-parse main)` and writes it to `base_commit` in the companion JSON

### Spawn command

```bash
BASE_SHA=$(git rev-parse main)
# write BASE_SHA to companion JSON base_commit field
git worktree add ../bantayog-wt-[slug] -b agent/[slug]

opencode run "$(cat docs/agent-tasks/YYYY-MM-DD-[slug].md)" \
  --agent exxeed \
  --model kimi-for-coding/k2p6 \
  --dir ../bantayog-wt-[slug] \
  --dangerously-skip-permissions
```

`--dangerously-skip-permissions` bypasses OpenCode's interactive permission prompts. It is acceptable here because: (1) each agent runs in an isolated git worktree outside `main`'s branch, (2) the pre-spawn check confirms the worktree is within the project tree, and (3) Claude Code reviews the full diff before any merge. The flag must not be used if the pre-spawn check fails.

Workers run via `Bash run_in_background: true`. Claude Code does not block waiting for them.

### Concurrency limit

`MAX_PARALLEL_AGENTS = 3` (constant). Claude Code maintains a semaphore queue. When a slot opens (agent exits or times out), the next ready task spawns. This prevents disk exhaustion (8 worktrees × node_modules) and API rate-limit saturation.

### Timeout enforcement

Each task brief specifies `timeout_minutes`. If an agent is still running after that duration, Claude Code kills the background process and treats the run as a Stage 1 failure (missing or incomplete result.json). The telemetry entry records `"exit_reason": "timeout"`.

---

## 8. Merge Strategy — Phase Staging Branch

All agent branches merge to a phase staging branch, never directly to `main`:

```
main
  └── phase/6-responder-telemetry
        ├── agent/p6-t2 (merged)
        ├── agent/p6-t3 (merged)
        └── agent/p6-t5 (pending)
```

### Merge conflict strategy

- **Lockfiles (`pnpm-lock.yaml`, `package-lock.json`):** Use `git merge -X theirs`. The lockfile-reconcile step that follows is the authoritative version.
- **Code conflicts:** Abort the merge (`git merge --abort`), log it as a Stage 2 Run B failure, and escalate to human resolution before proceeding.
- **Preventing conflicts:** Agents whose tasks are sequentially ordered (due to `modifies_lockfile: true`) cannot cause code conflicts with each other by design. The primary conflict risk is in shared import files — caught by Stage 2 Run B.

When **all** phase tasks pass both gates, the staging branch merges to `main` as a single squash PR. If any task reaches terminal failure, the entire staging branch is deleted — no partial state lands on `main`.

---

## 9. Quality Gates

### Stage 1 — Artifact Verification (per task)

Runs immediately after a worker exits or times out.

**Script:** `scripts/agent-gate-stage1.sh <slug> <worktree-path>`

Steps (all must pass; any failure exits 1):

1. `exxeed-[slug]-result.json` exists and is valid JSON.
2. Stage 1 **re-runs** `verification_command` from the companion JSON inside the worktree. Compares actual exit code to `verification_exit_code` in result.json. Mismatch = immediate fail. Agents cannot claim success without running tests.
3. `git -C <worktree> diff --name-only <base_commit>` (pinned SHA from companion JSON, not floating `main`) contains only files listed in `allowed_files.create`, `allowed_files.modify`, and `allowed_files.delete`. Extra files = fail.
4. If `discovered_required_files` is non-empty: **fail-open**. Claude Code is notified and may update `allowed_files` in the companion JSON and respawn. Not an automatic hard fail.
5. `open_items` array in result.json contains no entries with status `❌`.
6. Companion JSON `modifies_lockfile` matches the derived value in `dag.json`. Mismatch = immediate fail.
7. For every task slug X listed in this task's `blocks`, X's companion JSON must list this slug in its `blocked_by`. Asymmetric edges = immediate fail — this prevents silent execution misordering.

### Stage 2 — Code Quality (per task, then combined)

#### Run A — per-task (before merging to staging branch)

```bash
# scripts/agent-gate-stage2.sh <pnpm-filter>
BASELINE=$(jq -r --arg pkg "$1" '.[$pkg] // 0' .lint-baselines.json)

pnpm --filter "$1" lint -- --max-warnings="$BASELINE" &&
pnpm --filter "$1" typecheck &&
pnpm --filter "$1" test -- --coverage &&
if [[ "$1" == *"@bantayog/functions"* ]]; then
  firebase emulators:exec --only firestore,database,storage \
    "pnpm --filter $1 test:rules"
fi &&
scripts/check-no-any.sh "$1" &&
scripts/check-no-empty-catch.sh "$1" &&
scripts/check-secrets.sh "$1" &&
scripts/check-lockfile-integrity.sh
```

**Emulator port collisions:** Stage 2 Run A steps that invoke `firebase emulators:exec` are serialized — only one emulator session runs at a time, even if multiple agents have completed Stage 1 simultaneously. Non-emulator steps run in parallel.

#### Run B — combined staging branch (before PR to `main`)

```bash
# scripts/agent-gate-stage2-combined.sh <staging-branch>
git checkout "$1"
npx turbo run lint typecheck test --affected &&
firebase emulators:exec --only firestore,database,storage \
  "pnpm --filter @bantayog/functions run test:rules" &&
scripts/check-secrets.sh all &&
scripts/check-lockfile-integrity.sh
```

Run B catches cross-task issues: duplicate imports, type errors that only appear when both T2 and T5 are combined, and shared-file conflicts that individual task gates cannot see.

### Lint Baselines

`.lint-baselines.json` (checked in, generated once from `main`):

```json
{
  "@bantayog/functions": 5,
  "@bantayog/shared-validators": 0,
  "@bantayog/citizen-pwa": 12,
  "@bantayog/admin-desktop": 8,
  "@bantayog/responder-app": 3
}
```

Stage 2 Run A looks up the relevant package count. A task fails only on _new_ warnings for its package, not pre-existing ones in other packages. Run B checks the combined count across all affected packages.

Regenerate with:

```bash
scripts/generate-lint-baselines.sh > .lint-baselines.json
git add .lint-baselines.json && git commit -m "chore: update lint baselines"
```

### Secrets Scan

`scripts/check-secrets.sh <filter>` uses `git-secrets` (or equivalent) to scan staged changes for:

- Hardcoded API keys and tokens
- `.env` values committed to tracked files
- Firebase project IDs or service account JSON content
- Private key headers (`-----BEGIN`)

Runs in both Stage 2 Run A and Run B.

---

## 10. Circuit Breaker & Retry

```
Attempt 1 → Stage 1 or Stage 2 Run A fails
  └── Claude Code writes targeted correction brief
      (specific violations only — not a re-statement of the original brief)
  └── Fresh worktree: ../bantayog-wt-[slug]-retry-1
      (not --continue; clean context prevents compounding prior hallucinated state)
  └── Agent respawned with correction brief as the run message

Attempt 2 → Still fails
  └── Claude Code attempts direct fix in ../bantayog-wt-[slug]-retry-1

Claude Code direct fix → Stage 2 still fails
  └── TERMINAL_FAILURE (see Section 11)
```

On direct fix, Claude Code operates in `../bantayog-wt-[slug]-retry-1` (the most recent worktree). The original `../bantayog-wt-[slug]` is preserved for forensic comparison alongside retry-1.

---

## 11. Terminal Failure

### Scope

A terminal failure is **task-scoped**, not phase-scoped:

- All pending tasks in the **current phase** are cancelled.
- Running background agents are killed.
- The phase staging branch is deleted — tasks already merged to staging are discarded.
- **Other phases are unaffected** (they have their own staging branches).
- All worktrees for this phase (original + retries) are **renamed** before preservation: `../bantayog-wt-[slug]-TERMINAL-$(date +%s)` and `../bantayog-wt-[slug]-retry-1-TERMINAL-$(date +%s)`. The `*-TERMINAL-*` suffix prevents future pre-spawn checks from blocking on them while keeping the state intact for forensic inspection.
- The telemetry log records total tokens and duration spent on the failed phase.

### Escalation artifacts

Claude Code writes `.claude/escalations/YYYY-MM-DD-[slug]-terminal.md` containing:

- All telemetry entries for every attempt (`telemetry.jsonl` entries for this slug)
- `git diff <base_commit>` from the last failed worktree
- The original task brief
- All correction briefs written during retry
- A one-paragraph diagnosis: what the agent failed to do, and why Claude Code's direct fix also failed

Claude Code attempts to open a GitHub issue:

- Title: `[terminal-failure] Phase N — [slug]`
- Label: `terminal-failure`
- Body: link to escalation file + one-paragraph summary

If `gh issue create` exits non-zero (network failure, auth expired, rate limit):

1. Appends `{"actor":"claude-code","action":"escalation_failed","task":"[slug]","reason":"gh_issue_create_failed"}` to `telemetry.jsonl`
2. Writes the full issue body to `.claude/escalations/YYYY-MM-DD-[slug]-issue-fallback.md`
3. Prints to the session: `TERMINAL FAILURE — gh issue create failed — manual intervention required: .claude/escalations/YYYY-MM-DD-[slug]-terminal.md`

Claude Code then **stops** — no retry, no workaround, no partial merge.

The human receives: escalation file path, GitHub issue link (or fallback file path), worktree paths for forensic inspection.

---

## 12. Human-in-the-Loop Gate

Computed by Claude Code before merging staging → `main`:

| Signal                                                     | Score                |
| ---------------------------------------------------------- | -------------------- |
| Total files changed > 5                                    | +2                   |
| Total lines changed > 100                                  | +1                   |
| Any file outside `allowed_files` detected at Stage 1       | +5 (immediate block) |
| Firestore rules or `firestore.indexes.json` touched        | +5 (immediate block) |
| Any task passed on attempt 2+ (Stage 2 failure, not flaky) | +2                   |
| Any `discovered_required_files` entries accepted           | +1                   |

**Score ≥ 3:** Claude Code posts a summary (files changed, gate results, suspicion score, diff stat) and waits for explicit `proceed` before merging.

**Score < 3:** Claude Code merges automatically.

Firestore rules changes always score ≥ 5, always block for human approval.

### Flake Detection

Before scoring a retry as +2, Claude Code runs `scripts/detect-flakes.sh <verification_command> <worktree>`, which re-executes the verification command 3 times. If it passes ≥ 2 of 3 runs, the failure is classified as a flaky test, not a real quality regression:

- Telemetry records `"flaky": true` on that task's entry
- The +2 suspicion score is **not** applied
- A `"actor": "claude-code", "action": "flake_detected"` event is written to telemetry

If the failure is genuine (passes 0 or 1 of 3 runs), the +2 score is applied and the retry proceeds normally.

---

## 13. Observability

All events append to `docs/agent-tasks/telemetry.jsonl`. Claude Code commits this file **after every task completion** (not at phase end) to prevent loss on crash.

**Agent run events (written by Claude Code after each gate):**

```jsonl
{
  "ts": "2026-04-24T10:00:00Z",
  "actor": "agent",
  "phase": 6,
  "task": "p6-t3",
  "model": "kimi-for-coding/k2p6",
  "attempt": 1,
  "stage1": "PASS",
  "stage2_run_a": "FAIL",
  "duration_sec": 420,
  "files_changed": 3,
  "lines_changed": 87,
  "exit_reason": "completed"
}
```

**Claude Code orchestrator events:**

```jsonl
{"ts":"2026-04-24T10:00:00Z","actor":"claude-code","action":"spawn","phase":6,"task":"p6-t3","model":"kimi-for-coding/k2p6"}
{"ts":"2026-04-24T10:07:00Z","actor":"claude-code","action":"stage1_result","phase":6,"task":"p6-t3","result":"PASS"}
{"ts":"2026-04-24T10:07:05Z","actor":"claude-code","action":"merge","phase":6,"task":"p6-t3","target":"phase/6-responder-telemetry"}
```

`exit_reason` values: `completed`, `timeout`, `terminal_failure`.

Telemetry file is committed after each task and at phase end. It is never deleted — it is the permanent record of all agent work on this project.

---

## 14. Phase State Persistence (Crash Recovery)

Claude Code writes `docs/agent-tasks/phase-state.json` atomically after every state transition (spawn, gate result, merge, cancel):

```json
{
  "phase": 6,
  "staging_branch": "phase/6-responder-telemetry",
  "base_commit": "abc1234",
  "tasks": {
    "p6-t1": { "status": "merged", "worktree": null, "pid": null },
    "p6-t2": { "status": "in_progress", "worktree": "../bantayog-wt-p6-t2", "pid": 12345 },
    "p6-t3": { "status": "pending", "worktree": null, "pid": null }
  }
}
```

`status` values (per-task): `pending`, `in_progress`, `stage1_pass`, `stage2_pass`, `merged`, `failed`, `cancelled`, `terminal`.

Phase-level status (top-level field in `phase-state.json`): `active`, `staging_complete`, `run_b_pass`, `pr_opened`, `done`, `terminal`.

- `staging_complete`: all tasks merged to the staging branch; Run B has not yet run. This status is written **before** Run B starts. On restart, if phase status is `staging_complete`, Claude Code re-runs Run B — it does not assume Run B passed.
- `run_b_pass`: Run B completed successfully; PR not yet opened.
- `pr_opened`: PR to `main` has been opened; awaiting merge or human `proceed`.

On Claude Code restart, it reads `phase-state.json` before taking any action:

- Phase status `staging_complete` → re-run Stage 2 Run B before proceeding.
- Phase status `run_b_pass` or `pr_opened` → resume from that point (do not re-run gates).
- Per-task `in_progress`: check if the PID is still running. If yes, continue monitoring. If no, treat as a Stage 1 fail and begin retry.
- Per-task `merged`: do not respawn.
- Per-task `pending`: evaluate whether `blocked_by` set is satisfied before spawning.

`phase-state.json` is committed alongside each `telemetry.jsonl` update.

---

## 15. Phase Workflow Summary

```
 1. Claude Code reads PRD phase + progress.md
 2. Claude Code writes task briefs (.md) + companion JSONs (.json) for all tasks in the phase
 3. Claude Code generates dag.json from companion JSONs
 4. Claude Code creates staging branch: git checkout -b phase/N-description
 5. Claude Code initializes phase-state.json
 6. For each task whose blocked_by set is fully merged (respecting MAX_PARALLEL_AGENTS = 3):
      a. Pre-spawn checks (path safety, no stale worktree, write base_commit to companion JSON)
      b. git worktree add ../bantayog-wt-[slug] -b agent/[slug]
      c. opencode run (background) → worker runs Exxeed 4-phase workflow
      d. Write telemetry: {actor: "claude-code", action: "spawn", ...}
      e. Update phase-state.json
      f. On agent exit (or timeout kill):
           - Stage 1 gate runs (reruns verification_command, checks file allowlist, etc.)
           - Stage 1 pass → Stage 2 Run A (serialized if emulator required)
           - Both pass → merge agent/[slug] into staging branch
           - If task's `modifies_lockfile` is true: run lockfile-reconcile (pnpm install) immediately before unblocking downstream tasks
           - Write telemetry, update phase-state.json
           - Newly unblocked tasks → repeat from step 6
      g. Stage 1 or 2 fail → circuit breaker (Section 10)
      h. Terminal failure → Section 11 escalation, cancel all pending tasks, delete staging branch
 7. All tasks merged to staging branch
 8. Write phase status → `staging_complete` in phase-state.json (crash-safe checkpoint)
 9. Stage 2 Run B (combined) runs on staging branch
10. Write phase status → `run_b_pass` in phase-state.json
11. Suspicion score computed (Section 12)
12. Score < 3 → Claude Code merges staging → main (single squash PR); write phase status → `pr_opened`
    Score ≥ 3 → post summary, wait for explicit "proceed"; then merge and write `pr_opened`
13. Worktrees deleted (except `*-TERMINAL-*` forensic archives)
14. telemetry.jsonl committed, phase-state.json archived, progress.md updated; write phase status → `done`
```

---

## 16. Example: Phase 6 — Responder App Telemetry

**Companion JSON DAG:**

```
p6-t1 (schemas, k2-thinking, lockfile: false)
  → p6-t2 (rules, k2-thinking, lockfile: false)      ─────────────────────────> p6-t6 (e2e)
  → p6-t3 (functions, k2p6, lockfile: true) ─┐                                       ↑
  → p6-t4 (capacitor, k2p6, lockfile: true)  ─┤──> p6-t5 (hooks + race-loss UI) ─────┘
                                              (p6-t5 blocked_by: [p6-t3, p6-t4])
```

**Execution with semaphore (MAX_PARALLEL_AGENTS = 3):**

```
Spawn: p6-t1 (slot 1 of 3)
p6-t1 merges →
  Spawn: p6-t2 (slot 1), p6-t3 (slot 2) [parallel; both ready, neither modifies lockfile conflict yet]
  p6-t3 completes → lockfile-reconcile immediately → p6-t4 queued (p6-t3 has lockfile: true)
  p6-t2 completes (no lockfile conflict with p6-t4)
  p6-t4 spawns (slot 2) → completes → lockfile-reconcile
  Now p6-t5 unblocked (both p6-t3 and p6-t4 merged)
  Spawn: p6-t5 (slot 1)
  p6-t5 merges → p6-t6 unblocked
  Spawn: p6-t6 (slot 1)
  p6-t6 merges → Stage 2 Run B → suspicion score → PR to main
```
