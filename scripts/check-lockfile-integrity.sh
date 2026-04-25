#!/usr/bin/env bash
# Usage: check-lockfile-integrity.sh [worktree-path]
# Fails if pnpm-lock.yaml is not in sync with package.json files.
set -uo pipefail
WORKTREE="${1:-.}"
cd "$WORKTREE"
if ! pnpm install --frozen-lockfile --lockfile-only 2>/dev/null; then
 echo "FAIL: pnpm-lock.yaml is out of sync with package.json"
 exit 1
fi
echo "PASS: pnpm-lock.yaml integrity check"
