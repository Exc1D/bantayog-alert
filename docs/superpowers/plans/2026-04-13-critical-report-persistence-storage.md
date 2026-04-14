# Critical Report Persistence And Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/report` flow persist reports online, keep the offline queue functional, and unblock photo upload by replacing the placeholder Storage configuration with real access rules.

**Architecture:** Move report submission responsibility into a single shared async path used by both the direct form submission and the offline queue. Keep `ReportForm` responsible for validation/UI state, keep `submitReport()` responsible for three-tier persistence, and align Storage rules with the actual upload path `reports/{reportId}/{filename}`.

**Tech Stack:** React, TypeScript, Firebase Firestore, Firebase Storage, Vitest

---

## Recon Summary

- `src/app/routes.tsx:21` mounts `<ReportForm />` without an `onSubmit` prop.
- `src/features/report/components/ReportForm.tsx:245-254` shows success even if no persistence happens.
- `src/features/report/hooks/useReportQueue.ts:119-170` already has a persistence path for queued reports, but it is not shared with the online form.
- `storage.rules:4-7` deny all Storage access while `src/features/report/services/reportStorage.service.ts:25` uploads to `reports/${reportId}/${filename}`.
- Existing tests to extend:
  - `src/features/report/components/__tests__/ReportForm.test.tsx`
  - `src/features/report/hooks/__tests__/useReportQueue.test.ts`
  - `src/features/report/services/__tests__/reportQueue.service.test.ts`

## File Structure

**Modify:**
- `src/features/report/components/ReportForm.tsx`
- `src/app/routes.tsx`
- `src/features/report/hooks/useReportQueue.ts`
- `src/features/report/services/reportStorage.service.ts`
- `storage.rules`
- `src/features/report/components/__tests__/ReportForm.test.tsx`
- `src/features/report/hooks/__tests__/useReportQueue.test.ts`

**Create:**
- `src/features/report/services/reportSubmission.service.ts`
- `src/features/report/services/__tests__/reportSubmission.service.test.ts`

---

### Task 1: Centralize Report Persistence

**Files:**
- Create: `src/features/report/services/reportSubmission.service.ts`
- Test: `src/features/report/services/__tests__/reportSubmission.service.test.ts`

- [ ] **Step 1: Write the failing service tests**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { submitCitizenReport } from '../reportSubmission.service'

vi.mock('@/domains/citizen/services/firestore.service', () => ({
  submitReport: vi.fn().mockResolvedValue('report-123'),
}))

vi.mock('../reportStorage.service', () => ({
  uploadReportPhoto: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
}))

describe('submitCitizenReport', () => {
  it('persists an online report and returns the real report id', async () => {
    const result = await submitCitizenReport({
      incidentType: 'flood',
      photo: new File(['x'], 'photo.jpg', { type: 'image/jpeg' }),
      location: { type: 'manual', municipality: 'Daet', barangay: 'Bagasbas' },
      phone: '+63 912 345 6789',
      isAnonymous: false,
    })

    expect(result.reportId).toBe('report-123')
    expect(result.photoUrls).toEqual(['https://example.com/photo.jpg'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/features/report/services/__tests__/reportSubmission.service.test.ts`

Expected: FAIL because `reportSubmission.service.ts` does not exist yet.

- [ ] **Step 3: Implement the shared submission service**

```typescript
import { submitReport } from '@/domains/citizen/services/firestore.service'
import { uploadReportPhoto } from './reportStorage.service'

export async function submitCitizenReport(reportData: {
  incidentType: string
  photo: File | null
  location: {
    type: 'gps' | 'manual'
    latitude?: number
    longitude?: number
    municipality?: string
    barangay?: string
  }
  phone: string
  isAnonymous: boolean
}) {
  const publicReportData = {
    incidentType: reportData.incidentType as
      | 'flood'
      | 'earthquake'
      | 'landslide'
      | 'fire'
      | 'typhoon'
      | 'medical_emergency'
      | 'accident'
      | 'infrastructure'
      | 'crime'
      | 'other',
    severity: 'medium' as const,
    approximateLocation: {
      barangay: reportData.location.type === 'manual' ? reportData.location.barangay ?? '' : 'Unknown',
      municipality: reportData.location.type === 'manual' ? reportData.location.municipality ?? '' : 'Unknown',
      approximateCoordinates: reportData.location.type === 'gps'
        ? {
            latitude: reportData.location.latitude ?? 0,
            longitude: reportData.location.longitude ?? 0,
          }
        : { latitude: 0, longitude: 0 },
    },
    description: `Reported ${reportData.incidentType} incident`,
    isAnonymous: reportData.isAnonymous,
  }

  const reportId = await submitReport(publicReportData, {
    exactLocation: {
      address: reportData.location.type === 'manual'
        ? `${reportData.location.barangay ?? ''}, ${reportData.location.municipality ?? ''}`
        : `${reportData.location.latitude ?? 0}, ${reportData.location.longitude ?? 0}`,
      coordinates: {
        latitude: reportData.location.latitude ?? 0,
        longitude: reportData.location.longitude ?? 0,
      },
    },
    reporterContact: {
      name: reportData.isAnonymous ? 'Anonymous' : 'Citizen Reporter',
      phone: reportData.phone,
    },
    photoUrls: [],
  })

  const photoUrls =
    reportData.photo !== null ? [await uploadReportPhoto(reportData.photo, reportId)] : []

  return { reportId, photoUrls }
}
```

- [ ] **Step 4: Run the service test again**

Run: `npm run test -- --run src/features/report/services/__tests__/reportSubmission.service.test.ts`

Expected: PASS

---

### Task 2: Wire The Online Form To Real Persistence

**Files:**
- Modify: `src/features/report/components/ReportForm.tsx`
- Modify: `src/app/routes.tsx`
- Test: `src/features/report/components/__tests__/ReportForm.test.tsx`

- [ ] **Step 1: Add a failing form test for real async submission**

```typescript
it('submits online reports through the real persistence path', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockResolvedValue('report-123')

  render(
    <ReportForm
      userLocation={{ latitude: 14.1, longitude: 122.9 }}
      onSubmit={onSubmit}
    />
  )

  await user.upload(screen.getByLabelText(/photo/i), new File(['x'], 'photo.jpg', { type: 'image/jpeg' }))
  await user.type(screen.getByLabelText(/phone/i), '+63 912 345 6789')
  await user.click(screen.getByRole('checkbox', { name: /privacy policy/i }))
  await user.click(screen.getByRole('button', { name: /submit report/i }))

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify the current behavior is wrong**

Run: `npm run test -- --run src/features/report/components/__tests__/ReportForm.test.tsx`

Expected: FAIL or requires adapting the test because `handleSubmit()` is synchronous and does not await persistence.

- [ ] **Step 3: Convert `handleSubmit` to an async persistence flow**

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  // existing validation...

  if (!isOnline) {
    await enqueueReport(reportData)
    setSubmittedReportId(`${generateReportId(location)}-queued`)
    return
  }

  try {
    const persistedReportId = await onSubmit?.(reportData)
    setSubmittedReportId(
      typeof persistedReportId === 'string' && persistedReportId.length > 0
        ? persistedReportId
        : generateReportId(location)
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit report'
    setPhotoError(message)
  }
}
```

- [ ] **Step 4: Pass a real submit handler from the route**

```typescript
import { submitCitizenReport } from '@/features/report/services/reportSubmission.service'

{ path: 'report', element: <ReportForm onSubmit={(data) => submitCitizenReport(data).then((result) => result.reportId)} /> }
```

- [ ] **Step 5: Run the form test again**

Run: `npm run test -- --run src/features/report/components/__tests__/ReportForm.test.tsx`

Expected: PASS

---

### Task 3: Reuse The Shared Service In Offline Sync

**Files:**
- Modify: `src/features/report/hooks/useReportQueue.ts`
- Test: `src/features/report/hooks/__tests__/useReportQueue.test.ts`

- [ ] **Step 1: Add a failing queue test that proves the hook delegates persistence**

```typescript
it('uses the shared submission service when syncing queued reports', async () => {
  // mock queue with one pending report
  // mock shared submission service
  // expect syncQueue() to call submitCitizenReport once
})
```

- [ ] **Step 2: Run the hook test**

Run: `npm run test -- --run src/features/report/hooks/__tests__/useReportQueue.test.ts`

Expected: FAIL because `useReportQueue` still builds Firestore payloads inline.

- [ ] **Step 3: Replace inline payload construction with the shared service**

```typescript
import { submitCitizenReport } from '../services/reportSubmission.service'

await submitCitizenReport(report.reportData)
```

- [ ] **Step 4: Run the queue hook tests**

Run: `npm run test -- --run src/features/report/hooks/__tests__/useReportQueue.test.ts`

Expected: PASS

---

### Task 4: Replace Placeholder Storage Rules

**Files:**
- Modify: `storage.rules`
- Review: `src/features/report/services/reportStorage.service.ts`
- Review: `firebase.json`

- [ ] **Step 1: Write the actual rule shape to match the upload path**

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /reports/{reportId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 10 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

- [ ] **Step 2: Sanity-check the upload path**

Run: `rg -n "reports/\\$\\{reportId\\}" src/features/report/services/reportStorage.service.ts`

Expected: Match on `reports/${reportId}/${filename}`.

- [ ] **Step 3: Add follow-up hardening notes in the plan implementation PR**

```text
- Tighten `read` access once report ownership / admin viewing requirements are clarified.
- Add emulator-backed Storage rules tests if the repo introduces Storage emulator coverage.
```

- [ ] **Step 4: Run the targeted test suite**

Run: `npm run test -- --run src/features/report/components/__tests__/ReportForm.test.tsx src/features/report/hooks/__tests__/useReportQueue.test.ts src/features/report/services/__tests__/reportSubmission.service.test.ts`

Expected: PASS

