# Critical Profile Routing And Account Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authenticated users reach the registered profile experience, remove navigation to a non-existent `/login` route, and align route tests with the intended account flow.

**Architecture:** Keep `/profile` as the single public entry point, but make it conditional on auth state. Reuse `useAuth()` as the route gate, route anonymous users to `AnonymousProfile`, and render `RegisteredProfile` for authenticated users without inventing a second profile route.

**Tech Stack:** React Router, React, TypeScript, Vitest

---

## Recon Summary

- `src/app/routes.tsx:24-25` hardcodes `AnonymousProfile`.
- `src/app/Signup.tsx:18-25` always navigates to `/profile` after signup/cancel.
- `src/features/profile/components/RegisteredProfile.tsx:65` and `:111` navigate to `/login`, but no `/login` route exists.
- Tests currently codify the broken behavior:
  - `src/app/__tests__/routes.test.tsx:77-83`
  - `src/features/profile/components/__tests__/RegisteredProfile.test.tsx:388-397`
  - `src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx:168-184`

## File Structure

**Modify:**
- `src/app/routes.tsx`
- `src/app/Signup.tsx`
- `src/features/profile/components/RegisteredProfile.tsx`
- `src/app/__tests__/routes.test.tsx`
- `src/features/profile/components/__tests__/RegisteredProfile.test.tsx`
- `src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx`

**Create:**
- `src/app/components/ProfileRoute.tsx`
- `src/app/components/__tests__/ProfileRoute.test.tsx`

---

### Task 1: Introduce An Auth-Aware Profile Route Component

**Files:**
- Create: `src/app/components/ProfileRoute.tsx`
- Test: `src/app/components/__tests__/ProfileRoute.test.tsx`

- [ ] **Step 1: Write failing tests for anonymous vs authenticated rendering**

```typescript
import { render, screen } from '@testing-library/react'
import { ProfileRoute } from '../ProfileRoute'

vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

it('renders AnonymousProfile when there is no authenticated user', () => {})
it('renders RegisteredProfile when a user is authenticated', () => {})
```

- [ ] **Step 2: Run the test**

Run: `npm run test -- --run src/app/components/__tests__/ProfileRoute.test.tsx`

Expected: FAIL because `ProfileRoute` does not exist.

- [ ] **Step 3: Implement the auth-aware wrapper**

```typescript
import { AnonymousProfile } from '@/features/profile/components/AnonymousProfile'
import { RegisteredProfile } from '@/features/profile/components/RegisteredProfile'
import { useAuth } from '@/shared/hooks/useAuth'

export function ProfileRoute() {
  const { user, loading } = useAuth()

  if (loading) return null
  return user ? <RegisteredProfile /> : <AnonymousProfile />
}
```

- [ ] **Step 4: Run the wrapper test**

Run: `npm run test -- --run src/app/components/__tests__/ProfileRoute.test.tsx`

Expected: PASS

---

### Task 2: Replace The Broken `/profile` Route Wiring

**Files:**
- Modify: `src/app/routes.tsx`
- Modify: `src/app/__tests__/routes.test.tsx`

- [ ] **Step 1: Update the route tests first**

```typescript
it('renders the profile route shell at /profile', () => {
  renderWithRouter('/profile')
  expect(screen.getByTestId('navigation')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run route tests**

Run: `npm run test -- --run src/app/__tests__/routes.test.tsx`

Expected: FAIL once the old hardcoded anonymous expectation is removed.

- [ ] **Step 3: Swap in `ProfileRoute`**

```typescript
import { ProfileRoute } from './components/ProfileRoute'

{
  path: 'profile',
  element: <ProfileRoute />,
}
```

- [ ] **Step 4: Run route tests again**

Run: `npm run test -- --run src/app/__tests__/routes.test.tsx`

Expected: PASS

---

### Task 3: Remove Navigation To The Non-Existent `/login` Route

**Files:**
- Modify: `src/features/profile/components/RegisteredProfile.tsx`
- Modify: `src/features/profile/components/__tests__/RegisteredProfile.test.tsx`
- Modify: `src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx`

- [ ] **Step 1: Change the tests to the intended destination**

```typescript
expect(mockNavigate).toHaveBeenCalledWith('/profile')
```

- [ ] **Step 2: Run the RegisteredProfile tests**

Run: `npm run test -- --run src/features/profile/components/__tests__/RegisteredProfile.test.tsx src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx`

Expected: FAIL because the component still navigates to `/login`.

- [ ] **Step 3: Fix the navigation targets**

```typescript
await signOut()
navigate('/profile')
```

and

```typescript
await deleteUserAccount(user.uid)
navigate('/profile')
```

- [ ] **Step 4: Run the RegisteredProfile tests again**

Run: `npm run test -- --run src/features/profile/components/__tests__/RegisteredProfile.test.tsx src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx`

Expected: PASS

---

### Task 4: Keep Signup Redirects Compatible With The Fixed Profile Flow

**Files:**
- Review: `src/app/Signup.tsx`
- Review: `src/features/auth/components/SignUpFlow.tsx`

- [ ] **Step 1: Validate that signup completion still targets `/profile`**

```typescript
const handleComplete = (_userId: string) => {
  navigate('/profile')
}
```

- [ ] **Step 2: Confirm there is no remaining `/login` dependency in the app code**

Run: `rg -n "navigate\\('/login'\\)|to=\"/login\"|path: 'login'" src`

Expected: No remaining matches.

- [ ] **Step 3: Run the combined profile-route test slice**

Run: `npm run test -- --run src/app/components/__tests__/ProfileRoute.test.tsx src/app/__tests__/routes.test.tsx src/features/profile/components/__tests__/RegisteredProfile.test.tsx src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx`

Expected: PASS

