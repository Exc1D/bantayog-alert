# Critical Privacy Retention And Deletion Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make user deletion and retention behavior match the legal/privacy promises by fixing the broken client deletion query, aligning retention archive collection names, and choosing a single canonical deletion path.

**Architecture:** Treat `deleteUserData` in Cloud Functions as the system-of-record deletion path for destructive account cleanup, then make the client call that function instead of trying to delete distributed records from the browser. Align scheduled retention and rules on one archive collection name.

**Tech Stack:** Firebase Cloud Functions, Firestore, TypeScript, Vitest

---

## Recon Summary

- `src/features/profile/services/profile.service.ts:201-203` queries `report_ops.timeline` with `array-contains` on `{ performedBy: userId }`, which cannot match the stored full objects.
- `functions/src/index.ts:291-355` already exposes a server-side `deleteUserData` callable, but the client does not use it.
- `functions/src/index.ts:386` writes archives to `reports_archive`.
- `firestore.rules:297` exposes `archived_reports` instead.
- `functions/README.md:149-154` also documents `reports_archive`, so docs and function agree while rules disagree.

## File Structure

**Modify:**
- `src/features/profile/services/profile.service.ts`
- `src/shared/services/functions.service.ts`
- `src/features/profile/components/RegisteredProfile.tsx`
- `functions/src/index.ts`
- `firestore.rules`
- `functions/src/createAlert.test.ts` or add a new functions test file if needed
- `src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx`

**Create:**
- `src/features/profile/services/profile.service.test.ts`
- `functions/src/index.deleteUserData.test.ts`

---

### Task 1: Replace Client-Side Distributed Deletion With The Callable Function

**Files:**
- Modify: `src/features/profile/services/profile.service.ts`
- Test: `src/features/profile/services/profile.service.test.ts`

- [ ] **Step 1: Write a failing test proving the client delegates to the callable**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { deleteUserAccount } from './profile.service'

vi.mock('@/shared/services/functions.service', () => ({
  callFunction: vi.fn().mockResolvedValue({ success: true }),
}))

it('calls deleteUserData for account deletion', async () => {
  await deleteUserAccount('user-123')
  expect(callFunction).toHaveBeenCalledWith('deleteUserData', { targetUserUid: 'user-123' })
})
```

- [ ] **Step 2: Run the test**

Run: `npm run test -- --run src/features/profile/services/profile.service.test.ts`

Expected: FAIL because `deleteUserAccount()` still issues direct Firestore deletes.

- [ ] **Step 3: Replace browser-side deletes with a callable invocation**

```typescript
import { callFunction } from '@/shared/services/functions.service'

export async function deleteUserAccount(userId: string): Promise<void> {
  try {
    await callFunction('deleteUserData', { targetUserUid: userId })
  } catch (error) {
    throw new Error('Failed to delete account', { cause: error })
  }
}
```

- [ ] **Step 4: Run the profile-service test again**

Run: `npm run test -- --run src/features/profile/services/profile.service.test.ts`

Expected: PASS

---

### Task 2: Harden The Server-Side Delete Path

**Files:**
- Modify: `functions/src/index.ts`
- Test: `functions/src/index.deleteUserData.test.ts`

- [ ] **Step 1: Add a failing functions test for complete cleanup intent**

```typescript
it('deletes user profile records and writes an audit log for admin-initiated deletion', async () => {
  // mock admin auth/db calls
  // invoke deleteUserData
  // assert profile delete + audit log writes
})
```

- [ ] **Step 2: Run the functions test**

Run: `cd functions && npm test -- --run src/index.deleteUserData.test.ts`

Expected: FAIL because there is no focused test and cleanup coverage is thin.

- [ ] **Step 3: Tighten `deleteUserData` around the current schema**

```typescript
const privateReports = await db.collection('report_private').where('reporterUserId', '==', targetUserUid).get()
for (const privateDoc of privateReports.docs) {
  await db.collection('report_private').doc(privateDoc.id).delete()
  await db.collection('report_ops').doc(privateDoc.id).delete()
}

await db.collection('users').doc(targetUserUid).delete()
await auth.deleteUser(targetUserUid)
```

- [ ] **Step 4: Re-run the functions test**

Run: `cd functions && npm test -- --run src/index.deleteUserData.test.ts`

Expected: PASS

---

### Task 3: Align Archive Collection Naming Across Code And Rules

**Files:**
- Modify: `functions/src/index.ts`
- Modify: `firestore.rules`

- [ ] **Step 1: Pick one canonical name**

Use `reports_archive` because:

```text
- Cloud Function already writes `reports_archive`
- functions/README already documents `reports_archive`
- changing rules is smaller and lower-risk than changing both code and docs
```

- [ ] **Step 2: Update Firestore rules to match the function**

```text
match /reports_archive/{archiveId} {
  allow read: if hasRole('provincial_superadmin');
  allow create: if false;
  allow update: if false;
  allow delete: if hasRole('provincial_superadmin');
}
```

- [ ] **Step 3: Grep for the old name**

Run: `rg -n "archived_reports|reports_archive" firestore.rules functions/src functions/README.md docs`

Expected: Only `reports_archive` remains in runtime code/rules unless historical docs are intentionally left untouched.

---

### Task 4: Revalidate The RegisteredProfile Deletion UX

**Files:**
- Modify: `src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx`
- Review: `src/features/profile/components/RegisteredProfile.tsx`

- [ ] **Step 1: Update the deletion test to reflect the callable-backed service**

```typescript
await user.click(screen.getByTestId('delete-account'))
await user.click(screen.getByRole('button', { name: /delete/i }))
await waitFor(() => {
  expect(deleteUserAccount).toHaveBeenCalledWith('user-123')
})
```

- [ ] **Step 2: Run the profile error-handling tests**

Run: `npm run test -- --run src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx src/features/profile/services/profile.service.test.ts`

Expected: PASS

