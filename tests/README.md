# Testing Guide

Complete guide for running and writing tests for Bantayog Alert.

## Table of Contents

1. [Test Overview](#test-overview)
2. [Quick Start](#quick-start)
3. [Test Types](#test-types)
4. [Running Tests](#running-tests)
5. [Writing Tests](#writing-tests)
6. [CI/CD Integration](#cicd-integration)
7. [Troubleshooting](#troubleshooting)

---

## Test Overview

Bantayog Alert uses a multi-tier testing strategy:

```
Unit Tests (Fast)
├── Test individual functions in isolation
├── Mock external dependencies (Firebase, Firestore)
└── Run in milliseconds without emulators

Integration Tests (Medium)
├── Test complete features with real Firebase Emulator
├── Validate database operations and security rules
└── Run in seconds with emulators

E2E Tests (Slow)
├── Test complete user flows in browser
├── Validate UI interactions and accessibility
└── Run in minutes with Playwright
```

**Test Statistics:**
- **Unit Tests:** ~150 lines, fast execution
- **Integration Tests:** ~1,200 lines, validates data integrity
- **E2E Tests:** ~300 lines, validates user experience
- **Total Coverage:** 100% of critical validation paths

---

## Quick Start

### Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Run the emulator-backed test entry points:
```bash
npm run test:integration
npm run test:e2e:ci
```

### Verify Test Setup

```bash
npm run test:verify
```

This checks:
- ✓ Test files exist and have no syntax errors
- ✓ Test configurations are correct
- ✓ Dependencies are properly installed

### Run Tests by Type

```bash
# Unit tests only (fastest)
npm run test:run

# Integration tests (requires emulator)
npm run test:integration

# E2E tests (requires emulator)
npm run test:e2e:ci

# All tests with coverage
npm run test:coverage
```

---

## Test Types

### 1. Unit Tests

**Purpose:** Test individual functions and components in isolation

**Location:** `tests/unit/`

**Speed:** ⚡ Very fast (milliseconds)

**Dependencies:** Mocked (no Firebase required)

**Example:**
```typescript
describe('Phone Uniqueness Validation', () => {
  it('should reject duplicate phone numbers', async () => {
    // Arrange
    const mockGetCollection = vi.mocked(getCollection)
    mockGetCollection.mockResolvedValue([{ uid: 'existing' }])

    // Act & Assert
    await expect(
      registerResponder({ phoneNumber: '+639123456789' })
    ).rejects.toThrow('already registered')
  })
})
```

**When to Use:**
- Testing business logic
- Testing validation functions
- Testing pure functions
- Fast feedback during development

### 2. Integration Tests

**Purpose:** Test complete features with real Firebase services

**Location:** `tests/integration/`

**Speed:** 🐢 Medium (seconds)

**Dependencies:** Firebase Emulator required

**Example:**
```typescript
describe('Phone Uniqueness', () => {
  it('should prevent duplicate phone registration', async () => {
    // Create first responder
    await registerResponder({
      phoneNumber: '+639123456789',
      email: 'responder1@test.com',
      password: 'Pass123!',
      displayName: 'Responder 1',
    })

    // Try to register second responder with same phone
    await expect(
      registerResponder({
        phoneNumber: '+639123456789', // DUPLICATE!
        email: 'responder2@test.com',
        password: 'Pass123!',
        displayName: 'Responder 2',
      })
    ).rejects.toThrow('already registered')
  })
})
```

**When to Use:**
- Testing database operations
- Testing Firebase Auth flows
- Testing security rules
- Validating data integrity

### 3. E2E Tests

**Purpose:** Test complete user flows in a browser

**Location:** `tests/e2e/`

**Speed:** 🐢 Slow (minutes)

**Dependencies:** Firebase Emulator + Playwright

**Example:**
```typescript
test('should successfully register a citizen', async ({ page }) => {
  await page.goto('/register')
  await page.selectOption('select[name="role"]', 'citizen')
  await page.fill('input[name="email"]', 'citizen@example.com')
  await page.fill('input[name="password"]', 'SecurePass123!')
  await page.click('button[type="submit"]')

  await expect(page.locator('text=Registration successful')).toBeVisible()
})
```

**When to Use:**
- Testing UI workflows
- Testing accessibility
- Testing user experience
- Validating complete flows before release

---

## Running Tests

### Development Workflow

```bash
# 1. Make code changes
vim src/domains/responder/services/auth.service.ts

# 2. Run unit tests (fast feedback)
npm run test:run tests/unit/validation.test.ts

# 3. Run integration tests (verify with real Firebase)
npm run test:integration

# 4. Run all tests before committing
npm run test:coverage
```

### Running Specific Test Suites

```bash
# Only phone uniqueness tests
npm run test:integration -- tests/integration/phone-uniqueness.test.ts

# Only municipality validation tests
npm run test:integration -- tests/integration/municipality-validation.test.ts

# Only cross-municipality assignment tests
npm run test:integration -- tests/integration/cross-municipality-assignment.test.ts

# Only validation unit tests
npm run test:run tests/unit/validation.test.ts
```

### Interactive Test Mode

```bash
# Watch mode for unit tests (re-runs on file changes)
npm test -- tests/unit/

# UI mode for better visualization
npm run test:ui

# Playwright UI mode (for E2E tests)
npm run test:e2e:ui
```

### With Coverage Reports

```bash
# Generate coverage for all tests
npm run test:coverage

# Coverage will be available in:
# - coverage/index.html (HTML report)
# - coverage/unit/ (unit test coverage)
# - coverage/integration/ (integration test coverage)
```

---

## Writing Tests

### Unit Test Template

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('Feature Name', () => {
  // Setup mocks
  const mockFunction = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('functionName', () => {
    it('should do expected behavior', async () => {
      // Arrange: Set up test data
      const input = { /* test data */ }

      // Act: Call function being tested
      const result = await functionUnderTest(input)

      // Assert: Verify outcome
      expect(result).toBe(expectedValue)
    })

    it('should throw error for invalid input', async () => {
      // Arrange
      const invalidInput = { /* invalid data */ }

      // Act & Assert
      await expect(
        functionUnderTest(invalidInput)
      ).rejects.toThrow('Expected error message')
    })
  })
})
```

### Integration Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { auth, db } from '@/app/firebase/config'
import { doc, deleteDoc } from 'firebase/firestore'

describe('Feature Integration Tests', () => {
  const testUsers: string[] = []

  // Cleanup test data
  afterEach(async () => {
    for (const uid of testUsers) {
      await deleteDoc(doc(db, 'users', uid))
      const user = await auth.getUser(uid)
      await auth.deleteUser(user.uid)
    }
    testUsers.length = 0
  })

  it('should perform complete operation', async () => {
    // Arrange: Create test data
    const testData = await createTestData()

    // Act: Perform operation
    const result = await functionBeingTested(testData.id)

    // Assert: Verify result
    expect(result).toBeDefined()
    expect(result.property).toBe(expectedValue)

    // Cleanup: Track for cleanup
    testUsers.push(result.uid)
  })
})
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test'

test.describe('User Flow', () => {
  test('should complete full workflow', async ({ page }) => {
    // Navigate to page
    await page.goto('/page')

    // Interact with UI
    await page.click('button')
    await page.fill('input', 'value')

    // Verify outcome
    await expect(page.locator('.result')).toBeVisible()
    await expect(page).toHaveURL(/success/)
  })
})
```

### Using Test Fixtures

```typescript
import { userFixtures, reportFixtures, generateTestId } from '@/tests/fixtures'

describe('Feature Tests', () => {
  it('should create user with fixture data', async () => {
    const user = userFixtures.citizen({
      email: 'test@example.com',
      displayName: 'Test Citizen',
    })

    expect(user.email).toBe('test@example.com')
    expect(user.role).toBe('citizen')
  })

  it('should generate unique test IDs', () => {
    const id1 = generateTestId.user()
    const id2 = generateTestId.user()

    expect(id1).not.toBe(id2)
  })
})
```

---

## CI/CD Integration

### GitHub Actions Workflow

The project includes a comprehensive GitHub Actions workflow (`.github/workflows/test.yml`) that runs:

**Jobs (run in parallel):**
1. **Unit Tests** — Fast validation of business logic
2. **Type Check** — Catch type errors early
3. **Lint** — Enforce code style
4. **Integration Tests** — Validate with Firebase Emulator
5. **E2E Tests** — Validate user flows in browser
6. **Security Audit** — Check for vulnerabilities
7. **Build Test** — Verify production build works
8. **Firestore Rules Test** — Validate security rules

**Test Summary:** Aggregates all results and fails if any job fails

### Triggering CI

**Automatic:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

**Manual:**
- GitHub Actions UI → Run workflow

### Local Testing Before Push

```bash
# Verify tests are ready
npm run test:verify

# Run full test suite locally
npm run test:coverage

# If all pass, then commit and push
git add .
git commit -m "Add feature with tests"
git push
```

---

## Troubleshooting

### Common Issues

#### 1. "Firebase Emulator not running"

**Error:** `Cannot connect to Firebase emulator`

**Solution:**
```bash
# Run the emulator-backed test entry points
npm run test:integration
npm run test:e2e:ci
```

#### 2. "Port already in use"

**Error:** `Port 4000 is already in use`

**Solution:**
```bash
# Find and kill process using port
lsof -ti:4000 | xargs kill -9

# Or stop emulator gracefully
firebase emulators:stop
```

#### 3. "Test timeout"

**Error:** Tests taking too long and timing out

**Solution:**
```bash
# Increase timeout in vitest.config.ts
# testTimeout: 30000
```

#### 4. "Playwright not installed"

**Error:** `playwright command not found`

**Solution:**
```bash
npx playwright install
```

#### 5. "Tests failing randomly (flaky)"

**Solution:**
- Add retry logic: `test.retry(3)`
- Increase timeout: `test.setTimeout(10000)`
- Fix race conditions with proper waits

### Debugging Failed Tests

#### 1. Run Single Test

```bash
# Unit test
npm run test:run -- tests/unit/validation.test.ts -t "should reject duplicate phone"

# Integration test
npm run test:integration -- tests/integration/phone-uniqueness.test.ts -t should reject

# E2E test
npm run test:e2e:ci -- tests/e2e/auth-flows.spec.ts -g "should successfully register"
```

#### 2. Run Tests in Debug Mode

```bash
# Unit tests with --inspect flag
node --inspect-brk node_modules/.bin/vitest run tests/unit/validation.test.ts

# E2E tests with Playwright Inspector
npx playwright test --debug --headed
```

#### 3. Add Console Logging

```typescript
it('should perform operation', async () => {
  console.log('Test data:', testData)
  const result = await functionUnderTest(testData)
  console.log('Result:', result)
  expect(result).toBeDefined()
})
```

### Performance Issues

#### Slow Test Suite

**Symptoms:** Tests take >5 minutes to run

**Solutions:**
- Run integration tests in parallel
- Use test fixtures to reduce setup overhead
- Mock slow operations (like email sending)
- Run fewer tests in watch mode

#### Memory Issues

**Symptoms:** Emulator crashes during tests

**Solutions:**
- Clean up test data after each test (use `afterEach`)
- Run tests in smaller batches
- Increase emulator memory limits

---

## Best Practices

### 1. Test Isolation

Each test should be independent:

```typescript
it('should work independently', async () => {
  // Don't depend on other tests
  // Create your own data
  // Clean up your own data
})
```

### 2. Descriptive Test Names

Use clear, descriptive names:

```typescript
// ❌ Bad
it('test1', () => { })

// ✅ Good
it('should reject registration when phone number already exists', () => { })
```

### 3. Arrange-Act-Assert Pattern

Structure tests clearly:

```typescript
it('should validate input', async () => {
  // Arrange: Set up test data
  const input = createTestData()

  // Act: Perform operation
  const result = await validate(input)

  // Assert: Verify outcome
  expect(result.isValid).toBe(true)
})
```

### 4. Use Test Fixtures

Reduce boilerplate with fixtures:

```typescript
import { userFixtures, reportFixtures } from '@/tests/fixtures'

it('should handle standard report', () => {
  const report = reportFixtures.flood('Daet')
  // ... test logic
})
```

### 5. Test Edge Cases

Don't forget to test edge cases:

```typescript
it('should handle empty phone number', async () => {
  await expect(
    registerResponder({ phoneNumber: '' })
  ).rejects.toThrow('Phone number is required')
})

it('should handle special characters in phone number', async () => {
  await expect(
    registerResponder({ phoneNumber: '+63 (912) 345-6789' })
  ).resolves.toBeDefined()
})
```

### 6. Mock External Dependencies

Mock external services for unit tests:

```typescript
vi.mock('@/shared/services/firestore.service')
vi.mock('firebase/auth')
```

Use real services for integration tests.

### 7. Clean Up Test Data

Always clean up in `afterEach()`:

```typescript
afterEach(async () => {
  await cleanupTestUsers(testUsers)
  await cleanupTestReports(testReports)
})
```

---

## Test Coverage Goals

**Current Coverage Targets:**

| Layer | Target | Current |
|------|--------|---------|
| Critical Validations | 100% | ✅ 100% |
| Business Logic | 90% | ✅ 95% |
| UI Components | 80% | 🚧 0% (Phase 2) |
| Security Rules | 100% | ✅ 100% |

**Uncovered Areas (Future):**
- React components (not built yet in Phase 1)
- User interface flows
- Real-time features (future)

---

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Testing Library](https://testing-library.com/)
- [Testing Best Practices](https://testingjavascript.com/)

---

## Quick Reference

### Run Tests

```bash
# All tests
npm run test:run

# Unit tests only
npm run test:run tests/unit/

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e:ci

# With coverage
npm run test:coverage

# Verify setup
npm run test:verify
```

### Firebase Emulator

```bash
# Run the emulator-backed test scripts
npm run test:integration
npm run test:e2e:ci
npm run test:rules
```

### Playwright

```bash
# Install browsers
npx playwright install

# Run tests
npm run test:e2e:ci

# UI mode
npm run test:e2e:ui

# Debug mode
npx playwright test --debug

# Run specific test
npm run test:e2e:ci -- tests/e2e/auth-flows.spec.ts
```

---

**Need Help?**

- Check troubleshooting section above
- Review test files for examples
- Consult framework documentation
- Check CI/CD logs for detailed error messages
