#!/usr/bin/env bash
# Usage: detect-flakes.sh <verification-command> <worktree-path>
# Runs the verification command 3 times.
# Exits 0 with "flaky" if it passes >= 2/3 runs.
# Exits 1 with "genuine_failure" if it passes <= 1/3 runs.
set -uo pipefail
CMD="${1:?Usage: detect-flakes.sh <verification-command> <worktree-path>}"
WORKTREE="${2:?Usage: detect-flakes.sh <verification-command> <worktree-path>}"
PASSES=0
for i in 1 2 3; do
 echo "Flake detection: run $i/3"
 if (cd "$WORKTREE" && eval "$CMD" &>/dev/null); then
  PASSES=$((PASSES + 1))
  echo "  run $i: PASS"
 else
  echo "  run $i: FAIL"
 fi
done
echo "Result: $PASSES/3 passed"
if [[ "$PASSES" -ge 2 ]]; then
 echo "flaky"
 exit 0
else
 echo "genuine_failure"
 exit 1
fi
