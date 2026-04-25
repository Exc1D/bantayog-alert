#!/usr/bin/env bash
# Usage: scripts/agent-gate-stage2.sh <pnpm-filter> <worktree-path>
# Stage 2 Run A — per-task quality gate.
# Emulator tests only run for @bantayog/functions tasks.
set -uo pipefail
FILTER="${1:?Usage: agent-gate-stage2.sh <pnpm-filter> <worktree-path>}"
WORKTREE="${2:?Usage: agent-gate-stage2.sh <pnpm-filter> <worktree-path>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BASELINES="$REPO_ROOT/.lint-baselines.json"
fail() { echo "STAGE2 FAIL (Run A): $*" >&2; exit 1; }
[[ ! -f "$BASELINES" ]] && fail ".lint-baselines.json not found — run scripts/generate-lint-baselines.sh"
MAX_WARNINGS=$(jq -r --arg f "$FILTER" '.[$f] // 0' "$BASELINES" 2>/dev/null || echo "0")
echo "Stage 2 Run A: filter=$FILTER worktree=$WORKTREE max_warnings=$MAX_WARNINGS"
cd "$WORKTREE"
# Lint
echo "→ lint"
pnpm --filter "$FILTER" lint -- --max-warnings="$MAX_WARNINGS" || fail "lint"
# Typecheck
echo "→ typecheck"
pnpm --filter "$FILTER" typecheck || fail "typecheck"
# Unit tests with coverage
echo "→ test"
pnpm --filter "$FILTER" test -- --coverage || fail "test"
# Rules tests — only for functions (serialized by caller to avoid emulator port collisions)
if [[ "$FILTER" == *"functions"* ]]; then
 echo "→ test:rules:firestore (emulator)"
 firebase emulators:exec --only firestore,database,storage \
  "pnpm --filter $FILTER run test:rules:firestore" || fail "test:rules:firestore"
fi
# Check scripts
echo "→ check-no-any"
"$SCRIPT_DIR/check-no-any.sh" "$FILTER" "$WORKTREE" || fail "check-no-any"
echo "→ check-no-empty-catch"
"$SCRIPT_DIR/check-no-empty-catch.sh" "$FILTER" "$WORKTREE" || fail "check-no-empty-catch"
echo "→ check-secrets"
"$SCRIPT_DIR/check-secrets.sh" "$FILTER" "$WORKTREE" || fail "check-secrets"
echo "→ check-lockfile-integrity"
"$SCRIPT_DIR/check-lockfile-integrity.sh" "$WORKTREE" || fail "check-lockfile-integrity"
echo "STAGE2 PASS (Run A): $FILTER"
