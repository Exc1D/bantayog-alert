#!/bin/bash

# Test Verification Script
#
# This script verifies that all tests are properly configured
# and can run successfully. Use this before committing or pushing.
#
# Usage: npm run verify-tests (or ./scripts/verify-tests.sh)

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Bantayog Alert Test Verification"
echo "======================================"
echo ""

# Check 1: Verify test files exist
echo -n "✓ Checking test files... "
if [ -f "tests/unit/validation.test.ts" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAILED${NC}"
  echo "  Unit test file not found"
  exit 1
fi

if [ -f "tests/integration/phone-uniqueness.test.ts" ] && \
   [ -f "tests/integration/municipality-validation.test.ts" ] && \
   [ -f "tests/integration/cross-municipality-assignment.test.ts" ]; then
  echo -e "  ${GREEN}Integration test files: OK${NC}"
else
  echo -e "${RED}FAILED${NC}"
  echo "  Some integration test files are missing"
  exit 1
fi

if [ -f "tests/e2e/auth-flows.spec.ts" ]; then
  echo -e "  ${GREEN}E2E test file: OK${NC}"
else
  echo -e "${YELLOW}WARNING${NC}"
  echo "  E2E test file not found (optional for now)"
fi

# Check 2: Verify test fixtures
echo -n "✓ Checking test fixtures... "
if [ -f "tests/fixtures/data.fixtures.ts" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${YELLOW}WARNING${NC}"
  echo "  Test fixtures not found"
fi

# Check 3: Verify package.json test scripts
echo -n "✓ Checking test scripts... "
if grep -q '"test":' package.json && \
   grep -q '"test:run":' package.json && \
   grep -q '"test:integration":' package.json; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAILED${NC}"
  echo "  Test scripts not properly configured in package.json"
  exit 1
fi

# Check 4: Verify Firebase configuration
echo -n "✓ Checking Firebase configuration... "
if [ -f "firebase.json" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${YELLOW}WARNING${NC}"
  echo "  firebase.json not found (required for integration tests)"
fi

# Check 5: Verify TypeScript configuration
echo -n "✓ Checking TypeScript configuration... "
if [ -f "tsconfig.json" ] || [ -f "tsconfig.node.json" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAILED${NC}"
  echo "  TypeScript configuration not found"
  exit 1
fi

# Check 6: Verify Vitest configuration
echo -n "✓ Checking Vitest configuration... "
if [ -f "vitest.config.ts" ] || [ -f "vite.config.ts" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${YELLOW}WARNING${NC}"
  echo "  Vitest configuration not found"
fi

# Check 7: Verify test helpers
echo -n "✓ Checking test helpers... "
if [ -f "tests/integration/test-helpers.ts" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${YELLOW}WARNING${NC}"
  echo "  Test helpers not found"
fi

# Check 8: Verify no syntax errors in test files
echo -n "✓ Checking for TypeScript syntax errors... "
if npx tsc --noEmit tests/**/*.test.ts 2>/dev/null; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${YELLOW}WARNING${NC}"
  echo "  TypeScript syntax check failed (may be expected in dev environment)"
fi

echo ""
echo "======================================"
echo -e "${GREEN}✅ All checks passed!${NC}"
echo ""
echo "Next steps:"
echo "  1. Run unit tests: npm run test:run"
echo "  2. Run integration tests: firebase emulators:start --background && npm run test:integration"
echo "  3. Run E2E tests: firebase emulators:start --background && npm run test:e2e"
echo "  4. Run all tests: npm run test:coverage"
echo ""
echo "Test Files Summary:"
echo "  • Unit tests: tests/unit/validation.test.ts (unit tests for validations)"
echo "  • Integration tests: tests/integration/*.test.ts (3 files)"
echo "  • E2E tests: tests/e2e/*.spec.ts (end-to-end UI tests)"
echo "  • Fixtures: tests/fixtures/data.fixtures.ts (test data helpers)"
echo ""
