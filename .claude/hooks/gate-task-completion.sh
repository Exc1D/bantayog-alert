#!/usr/bin/env bash
# Quality gate fired on every TaskCompleted (agent-team or solo).
# Blocks completion (exit 2) if typecheck fails on any changed package.
# Bypass: export BANTAYOG_SKIP_TASK_GATE=1 (use sparingly — docs-only tasks).

set -uo pipefail

[ "${BANTAYOG_SKIP_TASK_GATE:-0}" = "1" ] && exit 0
command -v pnpm >/dev/null 2>&1 || exit 0
[ -n "${CLAUDE_PROJECT_DIR:-}" ] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# Drain Claude Code's JSON payload from stdin (we don't currently use it)
[ -t 0 ] || cat >/dev/null

CHANGED=$(git status --porcelain | awk '{sub(/^.../,""); print}')
[ -z "$CHANGED" ] && exit 0

# Skip if every change is docs / markdown / .claude config
NON_DOC=$(printf '%s\n' "$CHANGED" \
  | grep -v -E '^(docs/|\.claude/|AGENTS\.md$|CLAUDE\.md$|.*\.md$)' \
  | head -1)
[ -z "$NON_DOC" ] && exit 0

# Map changed paths -> packages (deduped). Shared packages bubble up to all consumers.
PKGS=$(printf '%s\n' "$CHANGED" | while IFS= read -r f; do
  case "$f" in
    (apps/citizen-pwa/*)            echo apps/citizen-pwa ;;
    (apps/admin-desktop/*)          echo apps/admin-desktop ;;
    (apps/responder-app/*)          echo apps/responder-app ;;
    (functions/*|infra/firebase/*)  echo functions ;;
    (packages/*)
      echo apps/citizen-pwa
      echo apps/admin-desktop
      echo apps/responder-app
      echo functions
      ;;
  esac
done | sort -u)

[ -z "$PKGS" ] && exit 0

FAIL=0
FAIL_LOG=""
for pkg in $PKGS; do
  if ! out=$(pnpm --dir "$pkg" exec tsc --noEmit 2>&1); then
    FAIL=1
    FAIL_LOG="$FAIL_LOG
--- typecheck FAIL: $pkg ---
$out
"
  fi
done

if [ "$FAIL" -ne 0 ]; then
  {
    echo "TaskCompleted blocked: typecheck failed."
    printf '%s\n' "$FAIL_LOG"
    echo "Fix the errors and retry. Bypass with BANTAYOG_SKIP_TASK_GATE=1 if docs-only."
  } >&2
  exit 2
fi

exit 0
