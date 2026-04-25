#!/usr/bin/env bash
# Stage 2 Run B — full combined staging branch quality gate.
# Checks out staging-branch, runs turbo affected, all rules tests, secrets, lockfile.
set -uo pipefail
STAGING_BRANCH="${1:?Usage: agent-gate-stage2-combined.sh <staging-branch> [repo-path]}"
REPO="${2:-.}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fail() { echo "STAGE2 FAIL (Run B): $*" >&2; exit 1; }
cd "$REPO"
git checkout "$STAGING_BRANCH" || fail "cannot checkout $STAGING_BRANCH"
echo "Stage 2 Run B: $STAGING_BRANCH"
# Turbo affected — covers all changed packages
echo "→ turbo lint typecheck test --affected"
npx turbo run lint typecheck test --affected || fail "turbo affected"
# All Firestore/RTDB/Storage rules in emulator
echo "→ test:rules:firestore (combined)"
firebase emulators:exec --only firestore,database,storage \
 "pnpm --filter @bantayog/functions run test:rules:firestore" || fail "test:rules:firestore"
# Secrets scan across entire staging branch diff
echo "→ check-secrets (all)"
"$SCRIPT_DIR/check-secrets.sh" all "$REPO" || fail "check-secrets"
# Lockfile integrity
echo "→ check-lockfile-integrity"
"$SCRIPT_DIR/check-lockfile-integrity.sh" "$REPO" || fail "check-lockfile-integrity"
echo "STAGE2 PASS (Run B): $STAGING_BRANCH"
