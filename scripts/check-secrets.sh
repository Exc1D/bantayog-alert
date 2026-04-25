#!/usr/bin/env bash
# Usage: check-secrets.sh <pnpm-filter> <worktree-path>
# Scans for common secret patterns (API keys, private keys, etc.)
set -uo pipefail
FILTER="${1:?Usage: check-secrets.sh <pnpm-filter> <worktree-path>}"
WORKTREE="${2:?Usage: check-secrets.sh <pnpm-filter> <worktree-path>}"
PATTERNS=(
  "AIza[0-9A-Za-z\\-_]{35}" # Google API Key
  "-----BEGIN (RSA|EC|PRIVATE) KEY-----"
  "\"[a-zA-Z0-9]{32,}\"" # Generic long hex/base64 strings
  "xox[bp]-[0-9]{12}" # Slack tokens
  "sqp_[a-f0-9]{40}" # SonarQube tokens
)
SCAN_DIR=""
if [[ "$FILTER" == "all" ]]; then
 SCAN_DIR="$WORKTREE"
else
 while IFS= read -r pkg_json; do
  pkg_name=$(jq -r '.name' "$pkg_json" 2>/dev/null)
  if [[ "$pkg_name" == "$FILTER" ]]; then
   SCAN_DIR="$(dirname "$pkg_json")"
   break
  fi
 done < <(find "$WORKTREE" -name "package.json" -not -path "*/node_modules/*" -not -path "*/.git/*")
fi
if [[ -z "$SCAN_DIR" ]]; then
 echo "PASS: directory not found for $FILTER (skipping)"
 exit 0
fi
FOUND=0
for pattern in "${PATTERNS[@]}"; do
 MATCHES=$(grep -rnE "$pattern" --include="*.ts" --include="*.tsx" --include="*.js" \
  --include="*.json" --exclude-dir=node_modules --exclude-dir=.git "$SCAN_DIR" \
  | grep -v "\.env\.example\|test\|spec\|mock\|fixture\|// " || true)
 if [[ -n "$MATCHES" ]]; then
  echo "FAIL: potential secret found (pattern: $pattern):"
  echo "$MATCHES"
  FOUND=1
 fi
done
if [[ "$FOUND" -eq 1 ]]; then
 exit 1
fi
echo "PASS: no secrets patterns found in $FILTER"
