#!/usr/bin/env bash
set -euo pipefail

echo "Validating Firebase config contract..."

test -f firebase.json || { echo "FAIL: firebase.json not found"; exit 1; }
test -f firestore.rules || { echo "FAIL: firestore.rules not found"; exit 1; }
test -f storage.rules || { echo "FAIL: storage.rules not found"; exit 1; }

# If firebase.json references auth.rules, the file must exist
if grep -q '"rules".*"auth\.rules"' firebase.json; then
  test -f auth.rules || { echo "FAIL: firebase.json references auth.rules but the file does not exist"; exit 1; }
fi

echo "OK: Firebase config contract is valid"
