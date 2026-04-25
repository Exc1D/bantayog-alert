#!/usr/bin/env bash
# Usage: scripts/agent-gate-stage1.sh <slug> <worktree-path>
# Exit 0 = PASS
# Exit 1 = FAIL (hard fail — retry or escalate)
# Exit 2 = FAIL-OPEN (discovered_required_files populated — Claude Code decides)
set -uo pipefail
SLUG="${1:?Usage: agent-gate-stage1.sh <slug> <worktree-path>}"
WORKTREE="${2:?Usage: agent-gate-stage1.sh <slug> <worktree-path>}"
PLANS_DIR="$WORKTREE/.claude/plans"
TASKS_DIR="docs/agent-tasks"
fail()      { echo "STAGE1 FAIL: $*" >&2; exit 1; }
fail_open() { echo "STAGE1 FAIL-OPEN: $*" >&2; exit 2; }
pass()      { echo "STAGE1 PASS: $SLUG"; exit 0; }
# 1. Companion JSON
COMPANION_JSON=$(find "$TASKS_DIR" -name "*-${SLUG}.json" 2>/dev/null 2>&1 | head -1)
# Workaround: find command was slightly off in the plan.
COMPANION_JSON=$(ls $TASKS_DIR/*-$SLUG.json 2>/dev/null | head -1)
[[ -z "$COMPANION_JSON" ]] && fail "companion JSON not found for slug: $SLUG"
jq empty "$COMPANION_JSON" 2>/dev/null || fail "companion JSON is invalid"
# 2. Result JSON
RESULT_JSON="$PLANS_DIR/exxeed-${SLUG}-result.json"
[[ ! -f "$RESULT_JSON" ]] && fail "result JSON not found: $RESULT_JSON"
jq empty "$RESULT_JSON" 2>/dev/null || fail "result JSON is invalid"
# 3. Re-run verification command
VERIFICATION_CMD=$(jq -r '.verification_command' "$COMPANION_JSON")
BASE_COMMIT=$(jq -r '.base_commit' "$COMPANION_JSON")
[[ -z "$BASE_COMMIT" || "$BASE_COMMIT" == "null" ]] && \
 fail "base_commit not set in companion JSON"
echo "Stage 1: Re-running verification: $VERIFICATION_CMD"
if ! (cd "$WORKTREE" && eval "$VERIFICATION_CMD" 2>&1); then
 CLAIMED=$(jq -r '.verification_exit_code' "$RESULT_JSON")
 fail "verification command failed (agent claimed exit_code=$CLAIMED)"
fi
# 4. File allowlist check against pinned base_commit
ALLOWED=$(jq -r \
 '(.allowed_files.create // [])[], (.allowed_files.modify // [])[], (.allowed_files.delete // [])[]' \
 "$COMPANION_JSON" 2>/dev/null | sort -u)
ACTUAL=$(git -C "$WORKTREE" diff --name-only "$BASE_COMMIT" 2>/dev/null | sort)
DISALLOWED=$(comm -23 <(echo "$ACTUAL") <(echo "$ALLOWED") | grep -v '^$' || true)
if [[ -n "$DISALLOWED" ]]; then
 fail "files changed outside allowed_files:
$DISALLOWED"
fi
# 5. discovered_required_files — fail-open
DISCOVERED=$(jq '.discovered_required_files | length' "$RESULT_JSON" 2>/dev/null || echo "0")
if [[ "$DISCOVERED" -gt 0 ]]; then
 FILES=$(jq -r '.discovered_required_files[]' "$RESULT_JSON")
 fail_open "agent found required files outside allowed list — update companion JSON and respawn:
$FILES"
fi
# 6. No unresolved open items
FAILED_ITEMS=$(jq -r '.open_items[] | select(contains("❌"))' "$RESULT_JSON" 2>/dev/null || true)
[[ -n "$FAILED_ITEMS" ]] && fail "open_items contains unresolved ❌ items:
$FAILED_ITEMS"
# 7. modifies_lockfile consistency with dag.json
DAG_JSON="$TASKS_DIR/$(ls $TASKS_DIR | grep 'dag.json' | head -1)"
if [[ -f "$DAG_JSON" ]]; then
 COMPANION_LF=$(jq -r '.modifies_lockfile' "$COMPANION_JSON")
 DAG_LF=$(jq -r --arg s "$SLUG" '.[$s].modifies_lockfile // "null"' "$DAG_JSON")
 [[ "$COMPANION_LF" != "$DAG_LF" ]] && \
  fail "modifies_lockfile mismatch: companion=$COMPANION_LF dag=$DAG_LF"
fi
# 8. blocks/blocked_by symmetry
while IFS= read -r blocked_slug; do
 [[ -z "$blocked_slug" ]] && continue
 BLOCKED_JSON=$(ls $TASKS_DIR/*-$blocked_slug.json 2>/dev/null | head -1)
 [[ -z "$BLOCKED_JSON" ]] && continue
 if ! jq -e --arg s "$SLUG" '.blocked_by[] | select(. == $s)' "$BLOCKED_JSON" &>/dev/null; then
  fail "asymmetric edge: $SLUG.blocks has $blocked_slug, but $blocked_slug.blocked_by missing $SLUG"
 fi
done < <(jq -r '.blocks[]? // empty' "$COMPANION_JSON" 2>/dev/null)
pass
