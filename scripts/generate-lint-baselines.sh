#!/usr/bin/env bash
declare -A PACKAGES=(
 ["@bantayog/functions"]="functions"
 ["@bantayog/shared-validators"]="packages/shared-validators"
 ["@bantayog/shared-ui"]="packages/shared-ui"
 ["@bantayog/shared-types"]="packages/shared-types"
 ["@bantayog/shared-sms-parser"]="packages/shared-sms-parser"
 ["@bantayog/shared-data"]="packages/shared-data"
 ["@bantayog/citizen-pwa"]="apps/citizen-pwa"
 ["@bantayog/admin-desktop"]="apps/admin-desktop"
 ["@bantayog/responder-app"]="apps/responder-app"
 ["@bantayog/e2e-tests"]="e2e-tests"
)
echo "{"
first=true
for pkg in "${!PACKAGES[@]}"; do
 dir="${PACKAGES[$pkg]}"
 if [[ ! -f "$dir/package.json" ]]; then
  continue
 fi
 # Run lint and count lines that look like warnings. 
 # Use (grep -c ... || true) to safely handle zero matches.
 count=$(pnpm --filter "$pkg" lint -- --format unix 2>&1 | (grep -c ": warning" || true))
 count=$(echo "$count" | tr -d '[:space:]')
 if [[ "$first" == "true" ]]; then
  first=false
 else
  printf ",\n"
 fi
 printf '  "%s": %s' "$pkg" "$count"
done
printf "\n}\n"
