# Plan: RegisteredProfile Error Handling Fix

**Task:** Fix silent failures in `RegisteredProfile.tsx` for `handleSyncNow`, `handleLogout`, and `handleDownloadData`

**Branch:** `fix/pr12-registeredprofile-error-handling`

## Recon Findings

- **File:** `src/features/profile/components/RegisteredProfile.tsx`
- **Issues found:**
  1. `handleSyncNow` (lines 46-53) - logs error but user gets no feedback
  2. `handleLogout` (lines 55-62) - logs error but user doesn't know if logout succeeded
  3. `handleDownloadData` (lines 64-89) - logs error but user thinks feature works
- **Existing pattern:** `handleDeleteAccount` (line 91-101) already has proper error handling with `setDeleteError`
- **Test file:** `src/features/profile/components/__tests__/RegisteredProfile.test.tsx`

## Files to Change

1. `src/features/profile/components/RegisteredProfile.tsx` - Add error states and UI feedback
2. `src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx` - New test file

## Approach

Add `syncError`, `logoutError`, and `downloadError` states following the existing pattern used by `handleDeleteAccount`:

**Conflict Resolution:**
- `syncError` and `syncResult` are mutually exclusive in UI — error takes priority
- `downloadError` displays alongside `deleteError` in Data Management section (same section, separate error states)

```typescript
// Pattern from handleDeleteAccount (line 98-99):
setDeleteError(error instanceof Error ? error.message : 'Failed to delete account')

// Apply same pattern to:
const [syncError, setSyncError] = useState<string | null>(null)
const [logoutError, setLogoutError] = useState<string | null>(null)
const [downloadError, setDownloadError] = useState<string | null>(null)
```

Display errors in SettingsTab via existing `SettingsTabProps` and new error props.

## NOT Doing

- Not fixing pre-existing `InfoTabProps` `user: any` type
- Not changing Firestore rules
- Not modifying consent checkbox (already correct)

## Implementation Steps

### 1. Add Error States to RegisteredProfile (lines 34-52)

```typescript
const [syncError, setSyncError] = useState<string | null>(null)
const [logoutError, setLogoutError] = useState<string | null>(null)
const [downloadError, setDownloadError] = useState<string | null>(null)
```

### 2. Fix handleSyncNow (lines 46-53)

```typescript
const handleSyncNow = async () => {
  try {
    setSyncError(null) // Clear previous error
    setSyncResult(null) // Clear previous success message so error doesn't conflict
    const result = await syncQueue()
    setSyncResult(result)
  } catch (error) {
    setSyncError(error instanceof Error ? error.message : 'Failed to sync. Please try again.')
    console.error('[SYNC_ERROR]', error)
  }
}
```

**GAP FIX:** Clear `syncResult` on error so old "Last sync: X synced" doesn't show alongside error.

### 3. Fix handleLogout (lines 55-62)

```typescript
const handleLogout = async () => {
  try {
    setLogoutError(null)
    await signOut()
    navigate('/login')
  } catch (error) {
    const message = 'Failed to log out. Please try again or close the browser.'
    setLogoutError(message)
    console.error('[LOGOUT_ERROR]', error)
  }
}
```

### 4. Fix handleDownloadData (lines 64-89)

```typescript
const handleDownloadData = async () => {
  if (!user) return
  try {
    setDownloadError(null)
    // ... existing code ...
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to download data. Please try again.'
    setDownloadError(message)
    console.error('[DOWNLOAD_ERROR]', error)
  }
}
```

### 5. Update SettingsTabProps (lines 394-405)

Add new optional error props:
```typescript
syncError?: string | null
logoutError?: string | null
downloadError?: string | null
```

### 6. Pass Error Props to SettingsTab (lines 154-167)

```typescript
<SettingsTab
  // ... existing props ...
  syncError={syncError}
  downloadError={downloadError}
/>
```

**NOTE:** `logoutError` is NOT passed to SettingsTab — logout is outside SettingsTab.

### 7. Display Errors in SettingsTab

Add error display sections in `SettingsTab` component:
- Sync error: Show in Pending Reports section
- Download error: Show in Data Management section

### 8. Display Logout Error (UI Change Required)

The logout button is at the bottom of `RegisteredProfile` (lines 204-214), NOT in SettingsTab. Need to add an error display area:

```typescript
<div className="px-4 pb-4">
  {logoutError && (
    <p className="text-sm text-red-600 mb-2" role="alert">
      {logoutError}
    </p>
  )}
  <Button
    variant="secondary"
    onClick={handleLogout}
    // ...
  >
    Logout
  </Button>
</div>
```

**GAP FIX:** Logout button is outside SettingsTab, so error display must be in main component.

## Verification

```bash
npm run test -- --run src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx
npm run typecheck
```

## Risks

- Low risk: Adding state and UI, no logic changes
- Error messages may need localization in future
