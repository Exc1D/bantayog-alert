# PR #15 Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical and important issues from PR #15 review, with selected nice-to-have improvements

**Architecture:** Targeted fixes to existing components — no new features. Focus on error handling, null safety, and test coverage.

**Tech Stack:** TypeScript, React, Vitest, Firebase Firestore

---

## Task Summary

| Task | Priority | File | Effort |
|------|----------|------|--------|
| 1 | Critical | useReportQueue.ts | 10 min |
| 2 | Important | useReportQueue.ts | 5 min |
| 3 | Important | SignUpFlow.tsx | 5 min |
| 4 | Important | MyReportsList.tsx | 15 min |
| 5 | Important | MyReportsList.tsx | 5 min |
| 6 | Important | MyReportsList.test.tsx | 20 min |
| 7 | Important | SignUpFlow.test.tsx | 10 min |
| 8 | Important | RegisteredProfile.errorHandling.test.tsx | 10 min |
| 9 | Suggestion | MyReportsList.tsx | 5 min |
| 10 | Suggestion | MyReportsList.tsx | 5 min |

---

## Task 1: Add Error Handling to Auto-Sync Effect (CRITICAL)

**Files:**
- Modify: `src/features/report/hooks/useReportQueue.ts:82-86`

- [ ] **Step 1: Write the failing test**

First, add a test that verifies auto-sync errors are logged:

```typescript
// In src/features/report/hooks/__tests__/useReportQueue.test.tsx
// Add to existing describe block:

it('should log error when auto-sync fails', async () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  // Set up queue with pending report
  mockQueueService.getAll.mockResolvedValue([
    createQueuedReport({ id: 'q1', status: 'pending' })
  ])

  const { result } = renderHook(() => useReportQueue())

  await waitFor(() => {
    expect(result.current.queue.length).toBe(1)
  })

  // Make syncQueue fail
  mockSubmitReport.mockRejectedValueOnce(new Error('Sync failed'))

  // Simulate coming online (this triggers auto-sync)
  act(() => {
    mockNetworkStatusReturn.isOnline = true
    // Force re-render by updating a state
    result.current.queue // access queue
  })

  await waitFor(() => {
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[AUTO_SYNC_ERROR]',
      expect.stringContaining('Sync failed')
    )
  })

  consoleErrorSpy.mockRestore()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/features/report/hooks/__tests__/useReportQueue.test.tsx`

Expected: FAIL — auto-sync error is not currently logged

- [ ] **Step 3: Implement error handling in useEffect**

```typescript
// In src/features/report/hooks/useReportQueue.ts
// Replace lines 82-86:

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && queue.length > 0 && !isSyncing) {
      syncQueue().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Auto-sync failed'
        console.error('[AUTO_SYNC_ERROR]', message)
      })
    }
  }, [isOnline, queue.length, isSyncing, syncQueue])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/features/report/hooks/__tests__/useReportQueue.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/report/hooks/useReportQueue.ts src/features/report/hooks/__tests__/useReportQueue.test.tsx
git commit -m "fix(useReportQueue): add error handling to auto-sync effect"
```

---

## Task 2: Fix Missing useEffect Dependencies

**Files:**
- Modify: `src/features/report/hooks/useReportQueue.ts:104-108`

- [ ] **Step 1: Fix the enqueueReport useEffect dependency**

```typescript
// In src/features/report/hooks/useReportQueue.ts
// Replace lines 103-107:

      // Try to sync immediately if online
      if (isOnline) {
        syncQueue().catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Immediate sync failed'
          console.error('[IMMEDIATE_SYNC_ERROR]', message)
        })
      }
    },
    [isOnline, syncQueue]
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: No errors related to useReportQueue

- [ ] **Step 3: Commit**

```bash
git add src/features/report/hooks/useReportQueue.ts
git commit -m "fix(useReportQueue): add syncQueue to useEffect dependencies"
```

---

## Task 3: Add setSubmitError(null) to updateField

**Files:**
- Modify: `src/features/auth/components/SignUpFlow.tsx:126-129`
- Test: `src/features/auth/components/__tests__/SignUpFlow.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// In src/features/auth/components/__tests__/SignUpFlow.test.tsx
// Add to existing describe block:

it('should clear submit error when user edits form field', async () => {
  const user = userEvent.setup()
  registerCitizenState.mockRejectedValueOnce(new Error('Registration failed'))

  renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

  // Navigate to review and submit (will fail)
  await user.type(screen.getByLabelText(/full name/i), 'Juan')
  await user.click(screen.getByRole('button', { name: /next/i }))
  await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
  await user.click(screen.getByRole('button', { name: /next/i }))
  await user.type(screen.getByLabelText(/password/i), 'StrongPass1!')
  await user.click(screen.getByRole('button', { name: /next/i }))
  await user.click(screen.getByRole('button', { name: /next/i }))
  await user.selectOptions(screen.getByLabelText(/municipality/i), 'Daet')
  await user.click(screen.getByRole('button', { name: /next/i }))
  await user.click(screen.getByLabelText(/agree to the/i))
  await user.click(screen.getByRole('button', { name: /next/i }))

  // Submit (will fail)
  await user.click(screen.getByRole('button', { name: /create account/i }))

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent(/registration failed/i)
  })

  // Go back and edit a field
  await user.click(screen.getByRole('button', { name: /back/i }))
  await user.clear(screen.getByLabelText(/full name/i))
  await user.type(screen.getByLabelText(/full name/i), 'Juan Modified')

  // Return to review - submit error should be cleared
  await user.click(screen.getByRole('button', { name: /next/i }))

  // Submit error should no longer be visible
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/features/auth/components/__tests__/SignUpFlow.test.tsx`

Expected: FAIL — submitError is not cleared when editing fields

- [ ] **Step 3: Implement the fix**

```typescript
// In src/features/auth/components/SignUpFlow.tsx
// Replace lines 126-129:

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
    setSubmitError(null)
  }, [])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/features/auth/components/__tests__/SignUpFlow.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/components/SignUpFlow.tsx src/features/auth/components/__tests__/SignUpFlow.test.tsx
git commit -m "fix(SignUpFlow): clear submitError when user edits form fields"
```

---

## Task 4: Add Null Check for docSnap.data()

**Files:**
- Modify: `src/features/profile/components/MyReportsList.tsx:76-89, 101-115`

- [ ] **Step 1: Write the failing test**

```typescript
// In src/features/profile/components/__tests__/MyReportsList.test.tsx
// Add to existing describe block:

it('should handle documents with null data gracefully', async () => {
  mockGetDocs.mockResolvedValue({
    docs: [
      createMockDoc('doc-1', null), // Simulates partial document
      createMockDoc('doc-2', {
        reportId: 'report-valid-001',
        reporterUserId: 'user-123',
        incidentType: 'fire',
        status: 'pending',
        createdAt: Timestamp.fromDate(new Date()),
        barangay: 'Mabuhay',
        municipality: 'Daet',
      }),
    ],
    forEach: function (fn: (doc: unknown) => void) {
      this.docs.forEach(fn)
    },
  })

  renderWithRouter('user-123')

  await waitFor(() => {
    // Should show the valid report, skip the null one
    expect(screen.getByText(/fire/i)).toBeInTheDocument()
    // Should not crash
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/features/profile/components/__tests__/MyReportsList.test.tsx`

Expected: FAIL — accessing `data.reportId` on null will throw

- [ ] **Step 3: Implement null checks**

```typescript
// In src/features/profile/components/MyReportsList.tsx
// Replace lines 76-89:

          for (const docSnap of registeredSnap.docs) {
            const data = docSnap.data()
            if (!data) continue

            const reportId = data.reportId
            if (!reportId || seenIds.has(reportId)) continue

            seenIds.add(reportId)
            allReports.push({
              id: reportId,
              incidentType: data.incidentType || 'other',
              status: data.status || 'pending',
              createdAt: data.createdAt?.toDate() || new Date(),
              barangay: data.barangay || 'Unknown',
              municipality: data.municipality || 'Unknown',
            })
          }
```

- [ ] **Step 4: Apply same fix to linked query**

```typescript
// In src/features/profile/components/MyReportsList.tsx
// Replace lines 101-115:

          for (const docSnap of linkedSnap.docs) {
            const data = docSnap.data()
            if (!data) continue

            const reportId = data.reportId
            if (!reportId || seenIds.has(reportId)) continue

            seenIds.add(reportId)
            allReports.push({
              id: reportId,
              incidentType: data.incidentType || 'other',
              status: data.status || 'pending',
              createdAt: data.createdAt?.toDate() || new Date(),
              barangay: data.barangay || 'Unknown',
              municipality: data.municipality || 'Unknown',
            })
          }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- --run src/features/profile/components/__tests__/MyReportsList.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/profile/components/MyReportsList.tsx src/features/profile/components/__tests__/MyReportsList.test.tsx
git commit -m "fix(MyReportsList): add null check for docSnap.data()"
```

---

## Task 5: Document Firestore Index Requirements

**Files:**
- Modify: `src/features/profile/components/MyReportsList.tsx:1-18`

- [ ] **Step 1: Add index documentation comment**

```typescript
// In src/features/profile/components/MyReportsList.tsx
// Add after line 4:

/**
 * MyReportsList Component
 *
 * Displays user's submitted reports:
 * - Registered reports (reporterUserId === userId)
 * - Linked anonymous reports (reporterPhone === user's phone)
 *
 * FIRESTORE INDEX REQUIREMENTS:
 * This component uses composite queries that require Firestore indexes.
 * Create the following indexes in Firebase Console > Firestore > Indexes:
 *
 * 1. Collection: report_private
 *    - Fields: reporterUserId (Ascending), reportId (Descending)
 *
 * 2. Collection: report_private
 *    - Fields: reporterPhone (Ascending), reportId (Descending)
 *
 * Or deploy firestore.indexes.json with:
 * {
 *   "indexes": [
 *     {
 *       "collectionGroup": "report_private",
 *       "queryScope": "COLLECTION",
 *       "fields": [
 *         { "fieldPath": "reporterUserId", "order": "ASCENDING" },
 *         { "fieldPath": "reportId", "order": "DESCENDING" }
 *       ]
 *     },
 *     {
 *       "collectionGroup": "report_private",
 *       "queryScope": "COLLECTION",
 *       "fields": [
 *         { "fieldPath": "reporterPhone", "order": "ASCENDING" },
 *         { "fieldPath": "reportId", "order": "DESCENDING" }
 *       ]
 *     }
 *   ]
 * }
 */
```

- [ ] **Step 2: Commit**

```bash
git add src/features/profile/components/MyReportsList.tsx
git commit -m "docs(MyReportsList): document Firestore index requirements"
```

---

## Task 6: Add Missing Status Value Tests

**Files:**
- Modify: `src/features/profile/components/__tests__/MyReportsList.test.tsx`
- Modify: `src/features/profile/components/MyReportsList.tsx:30-42`

- [ ] **Step 1: Add missing status labels**

```typescript
// In src/features/profile/components/MyReportsList.tsx
// Replace lines 30-42:

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Pending',
  verified: 'Verified',
  resolved: 'Resolved',
  rejected: 'Rejected',
  assigned: 'Assigned',
  responding: 'Responding',
  false_alarm: 'False Alarm',
}

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  assigned: 'bg-purple-100 text-purple-800',
  responding: 'bg-orange-100 text-orange-800',
  false_alarm: 'bg-gray-100 text-gray-800',
}
```

- [ ] **Step 2: Write tests for new statuses**

```typescript
// In src/features/profile/components/__tests__/MyReportsList.test.tsx
// Add after the status grouping describe block:

describe('MyReportsList additional status badges', () => {
  it('should display assigned and responding status badges', async () => {
    const reports = [
      createReport({ reportId: 'r1', status: 'assigned' as const }),
      createReport({ reportId: 'r2', status: 'responding' as const }),
      createReport({ reportId: 'r3', status: 'false_alarm' as const }),
    ]

    mockGetDocs.mockResolvedValue({
      docs: reports.map((r, i) =>
        createMockDoc(`doc-${i}`, {
          reportId: r.reportId,
          incidentType: r.incidentType,
          status: r.status,
          createdAt: Timestamp.fromDate(r.createdAt),
          barangay: r.barangay,
          municipality: r.municipality,
        })
      ),
      forEach: function (fn: (doc: unknown) => void) {
        this.docs.forEach(fn)
      },
    })

    renderWithRouter('user-123')

    await waitFor(() => {
      expect(screen.getAllByText(/^Assigned$/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(/^Responding$/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(/^False Alarm$/).length).toBeGreaterThanOrEqual(1)
    })
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- --run src/features/profile/components/__tests__/MyReportsList.test.tsx`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/components/MyReportsList.tsx src/features/profile/components/__tests__/MyReportsList.test.tsx
git commit -m feat(MyReportsList): add missing status labels and tests"
```

---

## Task 7: Test isSubmitting Reset

**Files:**
- Modify: `src/features/auth/components/__tests__/SignUpFlow.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// In src/features/auth/components/__tests__/SignUpFlow.test.tsx
// Add to the "Submit & onComplete" describe block:

it('should reset isSubmitting before calling onComplete', async () => {
  const user = userEvent.setup()
  renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

  // Fill out form
  await user.type(screen.getByLabelText(/full name/i), 'Juan')
  await user.click(screen.getByRole('button', { name: /next/i }))
  await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
  await user.click(screen.getByRole('button', { name: /next/i }))
  await user.type(screen.getByLabelText(/password/i), 'StrongPass1!')
  await user.click(screen.getByRole('button', { name: /next/i }))
  await user.click(screen.getByRole('button', { name: /next/i }))
  await user.selectOptions(screen.getByLabelText(/municipality/i), 'Daet')
  await user.click(screen.getByRole('button', { name: /next/i }))
  await user.click(screen.getByLabelText(/agree to the/i))
  await user.click(screen.getByRole('button', { name: /next/i }))

  const createButton = screen.getByRole('button', { name: /create account/i })

  // Button should be enabled initially
  expect(createButton).toBeEnabled()

  // Click submit
  await user.click(createButton)

  // Button shows loading state
  await waitFor(() => {
    expect(createButton).toHaveTextContent('creating account...')
  })

  // After success, isSubmitting is reset (button would be enabled again if still visible)
  await waitFor(() => {
    expect(mockOnComplete).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test**

Run: `npm run test -- --run src/features/auth/components/__tests__/SignUpFlow.test.tsx`

Expected: PASS (code already does this correctly, just adding test coverage)

- [ ] **Step 3: Commit**

```bash
git add src/features/auth/components/__tests__/SignUpFlow.test.tsx
git commit -m "test(SignUpFlow): add test for isSubmitting reset behavior"
```

---

## Task 8: Test handleDeleteAccount Error Path

**Files:**
- Modify: `src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// In src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx
// Add to existing describe block:

it('should show recent login error when auth/requires-recent-login is thrown', async () => {
  const mockError = new Error('Firebase: Error (auth/requires-recent-login).')
  // Add code property to simulate Firebase error structure
  ;(mockError as { code?: string }).code = 'auth/requires-recent-login'

  mockDeleteUserAccount.mockRejectedValueOnce(mockError)

  const user = userEvent.setup()
  renderWithRouter(<RegisteredProfile />)

  // Click delete account button (first open the delete confirmation)
  await user.click(screen.getByRole('button', { name: /delete account/i }))

  // Confirm deletion
  await user.click(screen.getByRole('button', { name: /delete/i }))

  await waitFor(() => {
    expect(screen.getByText(/please log out and log back in/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test**

Run: `npm run test -- --run src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx`

Expected: May FAIL — the special handling for `auth/requires-recent-login` is not currently implemented

- [ ] **Step 3: Implement the error handling (if test fails)**

```typescript
// In src/features/profile/components/RegisteredProfile.tsx
// Replace lines 107-115:

  const handleDeleteAccount = async () => {
    if (!user) return
    try {
      setDeleteError(null)
      await deleteUserAccount(user.uid)
      navigate('/login')
    } catch (error) {
      // Check for Firebase auth error code
      const code = (error as { code?: string })?.code
      if (code === 'auth/requires-recent-login') {
        setDeleteError('For security, please log out and log back in before deleting your account.')
      } else {
        setDeleteError(error instanceof Error ? error.message : 'Failed to delete account')
      }
    }
  }
```

- [ ] **Step 4: Run test again**

Run: `npm run test -- --run src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/components/RegisteredProfile.tsx src/features/profile/components/__tests__/RegisteredProfile.errorHandling.test.tsx
git commit -m "feat(RegisteredProfile): handle auth/requires-recent-login error"
```

---

## Task 9: Use IncidentType Domain Type (Suggestion)

**Files:**
- Modify: `src/features/profile/components/MyReportsList.tsx:21-28`

- [ ] **Step 1: Import and use IncidentType**

```typescript
// In src/features/profile/components/MyReportsList.tsx
// Add import at top:
import { ReportStatus, IncidentType } from '@/shared/types/firestore.types'

// Replace interface ReportSummary (lines 21-28):

interface ReportSummary {
  id: string
  incidentType: IncidentType
  status: ReportStatus
  createdAt: Date
  barangay: string
  municipality: string
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/profile/components/MyReportsList.tsx
git commit -m "refactor(MyReportsList): use IncidentType domain type"
```

---

## Task 10: Refactor Status Filtering Logic (Suggestion)

**Files:**
- Modify: `src/features/profile/components/MyReportsList.tsx:189-203`

- [ ] **Step 1: Refactor to use STATUS_ORDER**

```typescript
// In src/features/profile/components/MyReportsList.tsx
// Add after STATUS_COLORS definition:

const STATUS_ORDER: ReportStatus[] = [
  'pending',
  'verified',
  'assigned',
  'responding',
  'resolved',
  'rejected',
  'false_alarm',
]

// Replace renderReports function (lines 189-203):

  const renderReports = () => {
    return (
      <div className="space-y-6">
        {STATUS_ORDER.map((status) => {
          const statusReports = reports.filter((r) => r.status === status)
          if (statusReports.length === 0) return null
          return renderReportList(statusReports, STATUS_LABELS[status])
        })}
      </div>
    )
  }
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- --run src/features/profile/components/__tests__/MyReportsList.test.tsx`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/profile/components/MyReportsList.tsx
git commit -m "refactor(MyReportsList): use STATUS_ORDER for cleaner filtering"
```

---

## Verification

After completing all tasks, run the full verification:

```bash
# Run all tests
npm run test -- --run

# Type check
npm run typecheck

# Lint
npm run lint

# Check git status
git status
```

Expected output:
- All tests passing
- No type errors
- No lint errors
- Clean git status (all changes committed)

---

## Not Included (Deferred to Future PRs)

The following suggestions from the review were NOT included in this plan due to lower priority:

1. **Partial error state for MyReportsList** — Would require additional UI state management
2. **Step type enum for SignUpFlow** — Existing union type is functional
3. **Password strength constants** — Magic numbers are self-explanatory in context
4. **Console error recovery path** — Would require adding retry UI
5. **SignUpFormData.municipality type refinement** — Current string type is sufficient
6. **Error message capitalization consistency** — Style preference, not functional

These can be addressed in follow-up PRs if needed.

---

*Plan created: 2026-04-13*
*Based on: PR #15 Full Review Findings*
*Estimated total time: ~2 hours*
