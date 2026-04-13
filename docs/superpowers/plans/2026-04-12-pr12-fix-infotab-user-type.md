# PR #12 Fix InfoTab user:any Type

**Branch:** `fix/pr12-registeredprofile-error-handling` (worktree)
**Goal:** Replace `user: any` with proper Firebase User type in InfoTab

**Issue:** Line 253 in RegisteredProfile.tsx uses `user: any` instead of proper Firebase User type.

---

## Task 1: Find the Firebase User Type

Check existing user types in the codebase:

```bash
grep -r "interface.*User" src/ --include="*.ts" | grep -i firebase | head -5
grep -r "export.*User" src/shared/types/ --include="*.ts" | head -10
```

Alternatively, check firebase authenticated user type from auth:
```typescript
import { User as FirebaseUser } from 'firebase/auth'
```

Or use the type from `@/shared/hooks/useAuth`:
```bash
grep -n "interface.*User" src/shared/hooks/useAuth.ts
```

---

## Task 2: Replace `any` with Proper Type

**Files:**
- Modify: `src/features/profile/components/RegisteredProfile.tsx` (from `feature/legal-compliance-dpa` branch)

**Fix:**
```typescript
// Add import at top of file:
import { User as FirebaseUser } from 'firebase/auth'

// Update InfoTabProps:
// FROM:
interface InfoTabProps {
  user: any // Firebase User
}

// TO:
interface InfoTabProps {
  user: FirebaseUser
}
```

**Alternative if Firebase User type isn't available:**
```typescript
interface InfoTabProps {
  user: {
    displayName: string | null
    email: string | null
    emailVerified: boolean
    metadata: {
      creationTime?: string
    }
  }
}
```

---

## Task 3: Run TypeScript Check

```bash
npm run typecheck -- src/features/profile/components/RegisteredProfile.tsx
```

---

## Commit

```bash
git add src/features/profile/components/RegisteredProfile.tsx
git commit -m "fix(types): replace user:any with FirebaseUser type in InfoTab

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
