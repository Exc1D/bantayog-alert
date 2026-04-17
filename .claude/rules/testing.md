# Testing Rules

Best practices for writing maintainable, effective tests.

## Testing Philosophy

### Core Principles

- Test behavior, not implementation
- Write tests that give confidence in the code
- Tests should be: Fast, Reliable, Isolated, Self-validating
- Follow the Testing Trophy: More integration tests than unit tests

### Test Priority

1. Critical user paths (happy path)
2. Edge cases and error handling
3. Boundary conditions
4. Integration with external services

## Test Structure

### File Organization

```
tests/
├── unit/              # Unit tests (Vitest/Jest)
│   ├── utils/
│   └── hooks/
├── integration/       # Integration tests
│   ├── components/
│   └── api/
├── e2e/              # Playwright E2E tests
│   └── *.spec.ts
└── firestore/         # Firestore rules tests
    └── *.test.ts
```

### Naming Convention

```
describe('ComponentName')
  describe('when condition')
    it('should do thing', ...)
```

### Example Structure

```typescript
describe('UserProfile', () => {
  describe('when user is logged in', () => {
    it('should display username', () => {})
    it('should display logout button', () => {})
  })

  describe('when user is logged out', () => {
    it('should prompt login', () => {})
  })
})
```

## Unit Tests

### Rules

- One assertion per test when practical
- Use `describe` blocks to group related tests
- Use `beforeEach` for setup, not `beforeAll`
- Mock external dependencies
- Test pure functions without mocking

### Example

```typescript
import { calculateTotal } from './cart'

describe('calculateTotal', () => {
  it('should return 0 for empty cart', () => {
    expect(calculateTotal([])).toBe(0)
  })

  it('should sum item prices', () => {
    const items = [
      { price: 10, quantity: 2 },
      { price: 5, quantity: 1 },
    ]
    expect(calculateTotal(items)).toBe(25)
  })
})
```

## Integration Tests

### Rules

- Test component interactions
- Use React Testing Library for DOM testing
- Prefer `userEvent` over `fireEvent`
- Test actual user flows
- Use `waitFor` for async operations
- Use `screen` for querying

### Example

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('should submit credentials', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={mockSubmit} />);

    await user.type(screen.getByLabelText(/email/), 'test@example.com');
    await user.type(screen.getByLabelText(/password/), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(mockSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });
});
```

### Testing Hooks

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useUserStatus } from './useUserStatus'

describe('useUserStatus', () => {
  it('should return online status', async () => {
    const { result } = renderHook(() => useUserStatus('user-123'))

    await waitFor(() => {
      expect(result.current.status).toBe('online')
    })
  })
})
```

## E2E Tests (Playwright)

### When to Use

- Critical user flows (login, checkout)
- Cross-browser compatibility
- Full system integration
- Performance regression

### Rules

- E2E tests should be deterministic
- Use `page.waitForURL` over `waitForTimeout`
- Use data-testid for stable selectors
- Clean up test data in `beforeEach` or `afterEach`
- Run against staging environment

### Example

```typescript
import { test, expect } from '@playwright/test'

test.describe('User Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should login successfully', async ({ page }) => {
    await page.getByRole('button', { name: 'Login' }).click()
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByText('Welcome')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByRole('button', { name: 'Login' }).click()
    await page.getByLabel('Email').fill('invalid@example.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByRole('alert')).toContainText('Invalid credentials')
  })
})
```

### Playwright Commands

```bash
npx playwright test                    # Run all E2E tests
npx playwright test --project=chromium  # Run specific browser
npx playwright test --ui               # Interactive UI mode
npx playwright test --debug            # Debug mode
npx playwright show-report             # View test report
```

## Firestore/Storage Tests

### Rules

- Use Firebase Emulators for integration tests
- Test security rules with `firebase emulators:exec`
- Use `setLogLevel` for debugging
- Clean up test data after tests
- Test both success and failure cases

### Example

```typescript
import { initializeTestApp, loadFirestoreRules } from '@firebase/testing'

describe('Firestore Security Rules', () => {
  let app: firebase.app.App

  beforeAll(async () => {
    await loadFirestoreRules({
      projectId: 'test-project',
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    })
  })

  beforeEach(async () => {
    app = initializeTestApp({ projectId: 'test-project', auth: { uid: 'user1' } })
    await app.firestore().clearData()
  })

  afterEach(async () => {
    await cleanup(app)
  })

  it('should allow read for authenticated users', async () => {
    const db = app.firestore()
    await assertSucceeds(db.collection('alerts').get())
  })

  it('should deny write for non-owner', async () => {
    const db = app.firestore()
    await assertFails(db.collection('alerts').add({ createdBy: 'other-user', text: 'test' }))
  })
})
```

## Test Data Factories

### Rules

- Use factories for test data creation
- Keep factories close to the code they test
- Override specific fields, use defaults for rest
- Never share mutable state between tests

### Example

```typescript
// factories/user.factory.ts
interface UserData {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
}

function createUser(overrides: Partial<UserData> = {}): UserData {
  const defaults: UserData = {
    id: `user-${Math.random().toString(36).slice(2)}`,
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
  }
  return { ...defaults, ...overrides }
}

// Usage in tests
const adminUser = createUser({ role: 'admin', email: 'admin@test.com' })
const regularUser = createUser()
```

## Mocking Guidelines

### When to Mock

- External APIs (Firebase, REST)
- Time-dependent code (use `jest.useFakeTimers`)
- Random values
- Complex computations (if slow)
- 3rd party services

### When NOT to Mock

- Pure functions
- Simple transformations
- Internal utility functions
- Things being tested directly

### Example Mocks

```typescript
// Mock Firebase Auth
jest.mock('./firebase', () => ({
  auth: () => ({
    signInWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
  }),
}))

// Mock timer
jest.useFakeTimers()
act(() => void result.current.startTimer())
jest.advanceTimersByTime(5000)
jest.useRealTimers()

// Mock random values
jest.spyOn(Math, 'random').mockReturnValue(0.5)
```

## Test Coverage

### Goals

- Minimum 70% coverage for new code
- 100% coverage for security-critical paths
- Cover happy path and error paths
- Cover boundary conditions

### Commands

```bash
npm test                    # Run in watch mode
npx vitest run              # Run all tests once
npm run test:ui             # Visual test runner
npx vitest run --coverage   # Run with coverage
```

## CI/CD Testing

### Requirements

- All tests must pass before merge
- E2E tests run on staging deployment
- Security rules tests required for rule changes
- Coverage must not decrease

### Pipeline

```yaml
# GitHub Actions example
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: npm ci
    - run: npm run lint
    - run: npm run typecheck
    - run: npm run test:unit
    - run: npm run build
    - run: npm run test:firestore

e2e:
  needs: test
  steps:
    - run: npm run emulators:start &
    - run: npm run test:e2e
```

## Best Practices

### DO

- Write tests before fixing bugs (regression tests)
- Keep tests independent
- Use meaningful assertions
- Test error cases
- Keep tests deterministic
- Use `async/await` with `waitFor`

### DON'T

- Test implementation details
- Leave skipped tests
- Write flaky tests
- Mock everything
- Over-mock (mocking too much)
- Use `waitForTimeout` (use `waitFor` instead)

## Debugging Tests

### Tips

- Use `console.log` sparingly (use `debug` instead)
- Use `toJSON()` to see full error diffs
- Run single test: `npx vitest run testName`
- Use `--watch` mode for development
- Check test isolation by running tests randomly
