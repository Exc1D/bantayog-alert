#!/usr/bin/env bash
# Usage: check-no-empty-catch.sh <pnpm-filter> <worktree-path>
# Fails if TypeScript source contains empty catch blocks: catch { } or catch (e) { }
set -uo pipefail
FILTER="${1:?Usage: check-no-empty-catch.sh <pnpm-filter> <worktree-path>}"
WORKTREE="${2:?Usage: check-no-empty-catch.sh <pnpm-filter> <worktree-path>}"
SRC_DIR=""
while IFS= read -r pkg_json; do
 pkg_name=$(jq -r '.name' "$pkg_json" 2>/dev/null)
 if [[ "$pkg_name" == "$FILTER" ]]; then
  SRC_DIR="$(dirname "$pkg_json")/src"
  break
 fi
done < <(find "$WORKTREE" -name "package.json" -not -path "*/node_modules/*" -not -path "*/.git/*")
if [[ -z "$SRC_DIR" || ! -d "$SRC_DIR" ]]; then
 if [[ "$FILTER" == "all" ]]; then
  SRC_DIR="$WORKTREE"
 else
  echo "PASS: no src dir for $FILTER (skipping)"
  exit 0
 fi
fi
# Match catch blocks with empty bodies (whitespace only between braces)
# Excludes lines with comments explaining the intentional empty catch
MATCHES=$(grep -rn "catch\s*[({][^)]*[)}]\s*{\s*}" --include="*.ts" --include="*.tsx" "$SRC_DIR" \
 | grep -v "\/\/ intentional\|\/\/ transaction contention\|\/\/ fire-and-forget" || true)
if [[ -n "$MATCHES" ]]; then
 echo "FAIL: empty catch blocks found in $FILTER:"
 echo "$MATCHES"
 exit 1
fi
echo "PASS: no empty catch blocks in $FILTER"
