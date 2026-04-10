# Integration Tests

This directory contains integration tests for Bantayog Alert's critical data validations and business logic.

## Overview

Integration tests validate that the system works correctly end-to-end using the Firebase Emulator. These tests are slower than unit tests but catch issues that unit tests cannot.

### Test Suites

1. **Phone Uniqueness Validation** (`phone-uniqueness.test.ts`)
   - Verifies that phone numbers are unique across responder accounts
   - Tests duplicate phone number rejection
   - Validates phone number storage and profile creation

2. **Municipality Validation** (`municipality-validation.test.ts`)
   - Ensures municipality assignments are valid
   - Tests rejection of non-existent municipalities
   - Validates municipality data integrity

3. **Cross-Municipality Assignment Prevention** (`cross-municipality-assignment.test.ts`)
   - Enforces geographic boundaries for responder assignments
   - Tests that responders cannot be assigned outside their municipality
   - Validates clear error messaging for invalid assignments

## Prerequisites

### 1. Firebase Emulator

Install and start the Firebase Emulator:

```bash
# From project root
firebase emulators:start
```

Or use the background option:

```bash
firebase emulators:start --background
```

### 2. Dependencies

Ensure all dependencies are installed:

```bash
npm install
```

## Running Tests

### Run All Integration Tests

```bash
firebase emulators:exec "vitest run tests/integration/"
```

### Run Specific Test Suite

```bash
# Phone uniqueness tests
firebase emulators:exec "vitest run tests/integration/phone-uniqueness.test.ts"

# Municipality validation tests
firebase emulators:exec "vitest run tests/integration/municipality-validation.test.ts"

# Cross-municipality assignment tests
firebase emulators:exec "vitest run tests/integration/cross-municipality-assignment.test.ts"
```

### Run Tests in Watch Mode

```bash
firebase emulators:exec "vitest tests/integration/" --watch
```

### Run Tests with Coverage

```bash
firebase emulators:exec "vitest run tests/integration/" --coverage
```

## Test Structure

Each test file follows this structure:

```typescript
describe('Feature Name', () => {
  // Cleanup test data
  afterEach(async () => {
    // Delete test users, municipalities, reports, etc.
  })

  describe('functionName', () => {
    it('should do expected behavior', async () => {
      // Arrange: Set up test data
      // Act: Call function being tested
      // Assert: Verify expected outcome
    })
  })
})
```

## Test Data Management

### Cleanup Strategy

Each test suite cleans up its own data in `afterEach()` blocks:

1. Delete test user profiles from `users` collection
2. Delete test responder profiles from `responders` collection
3. Delete Firebase Auth users
4. Delete test municipalities from `municipalities` collection
5. Delete test reports from `reports`, `report_private`, `report_ops` collections

### Test User Creation

Tests create users with this pattern:

```typescript
const credentials = {
  email: 'test@example.com',
  password: 'SecurePass123!',
  displayName: 'Test User',
}

const result = await registerBase(credentials, 'citizen')
testUsers.push(result.user.uid) // Track for cleanup
```

## Common Test Patterns

### Testing Success Cases

```typescript
it('should successfully perform operation', async () => {
  // Arrange
  const testData = await createTestData()

  // Act
  const result = await functionBeingTested(testData.id)

  // Assert
  expect(result).toBeDefined()
  expect(result.property).toBe(expectedValue)
})
```

### Testing Error Cases

```typescript
it('should reject invalid input', async () => {
  // Arrange
  const invalidInput = { /* invalid data */ }

  // Act & Assert
  await expect(functionBeingTested(invalidInput)).rejects.toThrow('expected error message')

  // Or check error code
  try {
    await functionBeingTested(invalidInput)
    expect(true).toBe(false) // Force test failure if no error thrown
  } catch (error) {
    expect((error as { cause?: { code?: string } }).cause?.code).toBe('EXPECTED_ERROR_CODE')
  }
})
```

### Testing Data Integrity

```typescript
it('should store data correctly in Firestore', async () => {
  // Arrange & Act
  const result = await functionBeingTested(input)

  // Assert
  const doc = await getDoc(doc(db, 'collection', result.id))
  const data = doc.data()

  expect(data?.field).toBe(expectedValue)
  expect(data?.otherField).toBeDefined()
})
```

## Firebase Emulator Considerations

### Data Persistence

The Firebase Emulator persists data between test runs by default. This is why we have explicit cleanup in `afterEach()` blocks.

### Authentication

The emulator handles Firebase Auth separately from Firestore. Tests must:
1. Create users in Firebase Auth
2. Create user profiles in Firestore
3. Delete both during cleanup

### No Network Latency

The emulator has no network latency, so tests run fast. This is good for CI/CD but means tests won't catch performance issues that only appear with real Firebase.

## Continuous Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start Firebase Emulator
        run: firebase emulators:start --background
      
      - name: Wait for emulators
        run: npx wait-on http://localhost:4000
      
      - name: Run integration tests
        run: firebase emulators:exec "vitest run tests/integration/"
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/integration/*.json
```

### GitLab CI Example

```yaml
integration_tests:
  stage: test
  image: node:18
  
  before_script:
    - npm ci
  
  script:
    - firebase emulators:start --background
    - sleep 10  # Wait for emulators to start
    - firebase emulators:exec "vitest run tests/integration/"
  
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
```

## Troubleshooting

### "Port already in use" Error

**Issue:** Firebase Emulator is already running.

**Solution:** Stop the existing emulator or use a different port:

```bash
# Find and kill existing process
lsof -ti:4000 | xargs kill -9

# Or use different ports in firebase.json
```

### Tests Timeout

**Issue:** Tests take too long and timeout.

**Solution:** Increase timeout in vitest.config.ts:

```typescript
export default defineConfig({
  testTimeout: 30000, // 30 seconds
})
```

### "User not found" Error

**Issue:** Test tries to delete non-existent user.

**Solution:** Wrap cleanup in try-catch:

```typescript
try {
  await auth.deleteUser(uid)
} catch (error) {
  // User might not exist, ignore
}
```

### Data Leaking Between Tests

**Issue:** Tests interfere with each other's data.

**Solution:** Ensure each test uses unique identifiers:

```typescript
const uniqueId = `test-${Date.now()}-${Math.random()}`
const email = `test-${uniqueId}@example.com`
```

## Best Practices

1. **Test Isolation** — Each test should be independent and clean up after itself
2. **Descriptive Names** — Use `it('should do X when Y')` format for test names
3. **Arrange-Act-Assert** — Structure tests clearly for readability
4. **Realistic Data** — Use realistic test data, not just "test" values
5. **Error Messages** — Test that error messages are clear and actionable
6. **Edge Cases** — Test boundary conditions and unusual inputs
7. **Data Integrity** — Verify data is stored correctly in Firestore
8. **Cleanup** — Always clean up test data to prevent pollution
9. **Speed** — Keep tests fast by minimizing setup/teardown
10. **Clarity** — Comment complex test logic for maintainability

## Adding New Tests

When adding new integration tests:

1. Create test file in `tests/integration/` directory
2. Import necessary dependencies
3. Add cleanup in `afterEach()` block
4. Write tests following the patterns above
5. Run tests locally before committing
6. Update this README if adding new test suites

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Firebase Testing Guide](https://firebase.google.com/docs/unit-test)
- [Testing Best Practices](https://testingjavascript.com/)

## License

MIT
