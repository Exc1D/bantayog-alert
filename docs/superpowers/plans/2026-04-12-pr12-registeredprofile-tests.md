# Plan: RegisteredProfile Test Coverage for DPA Flows

**Task:** Add tests for DPA deletion, download, and modal flows in `RegisteredProfile`

**Branch:** `fix/pr12-registeredprofile-tests`

## Recon Findings

- **File:** `src/features/profile/components/__tests__/RegisteredProfile.test.tsx`
- **Existing mocks:** Uses `vi.hoisted` pattern, mocks `useAuth`, `useReportQueue`, `profileService`
- **Existing DPA tests:** `RegisteredProfile.privacyLink.test.tsx` NOT FOUND (may be in PR #12 worktree but not committed)
- **Missing coverage:**
  1. `handleDeleteAccount` success flow (navigates to /login)
  2. `handleDeleteAccount` error flow (displays `deleteError`)
  3. `handleDownloadData` flow
  4. `handleSyncNow` error flow
  5. `handleLogout` error flow
  6. Delete confirmation modal show/cancel/hide
  7. `syncResult` cleared on sync error

## Files to Change

1. `src/features/profile/components/__tests__/RegisteredProfile.dpaFlows.test.tsx` - New test file

## Approach

Follow existing test patterns from `RegisteredProfile.test.tsx`:
- Use `userEvent.setup()` for async user interactions
- Use `waitFor` for async assertions
- Mock `profileService` methods with `vi.hoisted()`
- Test actual user-visible behavior, not implementation

## NOT Doing

- Not testing Firestore rules (tested separately via emulator tests)
- Not testing `InfoTabProps` user type (pre-existing issue)
- Not testing notification toggle (low priority, tested elsewhere)

## Test Cases

### 1. Delete Account Flow

```typescript
describe('Delete Account Flow', () => {
  it('should show delete confirmation modal when delete account clicked', async () => {
    // Click delete account button
    // Verify modal appears with data-testid="delete-confirm-modal"
  })

  it('should hide modal when cancel clicked', async () => {
    // Open modal, click cancel
    // Verify modal disappears
  })

  it('should call deleteUserAccount and navigate to login on confirm', async () => {
    // Click delete, confirm
    // Verify deleteUserAccount called with user.uid
    // Verify navigate('/login') called
  })

  it('should display error message when deletion fails', async () => {
    // Mock deleteUserAccount to reject
    // Click delete, confirm
    // Verify error displayed via role="alert"
  })
})
```

### 2. Download Data Flow

```typescript
describe('Download Data Flow', () => {
  it('should call exportUserData when download clicked', async () => {
    // Mock URL.createObjectURL and anchor click
    // Click download
    // Verify exportUserData called with correct args
  })

  it('should trigger file download', async () => {
    // Mock URL.createObjectURL
    // Click download
    // Verify anchor element created and clicked
    // Verify URL.revokeObjectURL called
  })

  it('should display error when download fails', async () => {
    // Mock exportUserData to reject
    // Click download
    // Verify error displayed
  })
})
```

### 3. Sync Error Flow

```typescript
describe('Sync Flow', () => {
  it('should display error when sync fails', async () => {
    // Mock syncQueue to reject
    // Navigate to settings tab
    // Click sync now
    // Verify error displayed
  })

  it('should clear previous syncResult when sync fails', async () => {
    // Set syncResult to a previous success value
    // Mock syncQueue to reject
    // Click sync now
    // Verify syncResult is cleared (error takes priority)
  })
})
```

### 4. Logout Error Flow

```typescript
describe('Logout Flow', () => {
  it('should display error when logout fails', async () => {
    // Mock signOut to reject
    // Click logout button
    // Verify error displayed near logout button
    // Verify navigate('/login') NOT called
  })
})
```

## Mock Setup

```typescript
// vi.hoisted pattern from learnings
const mockExportUserData = vi.hoisted(() => vi.fn())
const mockDeleteUserAccount = vi.hoisted(() => vi.fn())
const mockSyncQueue = vi.hoisted(() => vi.fn())

vi.mock('../../services/profile.service', () => ({
  getUserReportsWithDetails: vi.fn().mockResolvedValue([]),
  exportUserData: mockExportUserData,
  deleteUserAccount: mockDeleteUserAccount,
}))

vi.mock('@/features/report/hooks/useReportQueue', () => ({
  useReportQueue: vi.fn().mockReturnValue({
    // ... existing mock ...
    syncQueue: mockSyncQueue,
  }),
}))
```

## Verification

```bash
npm run test -- --run src/features/profile/components/__tests__/RegisteredProfile.dpaFlows.test.tsx
npm run test -- --run src/features/profile/components/__tests__/RegisteredProfile.test.tsx  # Ensure no regressions
```
