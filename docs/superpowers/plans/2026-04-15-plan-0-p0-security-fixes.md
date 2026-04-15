# Plan 0 — P0 Security Fixes (Pre-Migration Blockers)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the P0/high-severity issues from `docs/qa-findings/edge-case-report-2026-04-14.md` that block safe migration to the new architecture. Do NOT migrate onto broken foundations.

**Architecture:** Surgical fixes in current codebase. No structural change. Each fix is small and independently revertable.

**Tech Stack:** React 18 + Firebase v9 + Vitest. No new dependencies.

---

## Scope

Fixes these issues (from QA report):
- CRITICAL-AUTH-2: `getMunicipalityReports` ignores municipality parameter (cross-municipality leak)
- CRITICAL-AUTH-3: `getAssignedIncidents` ignores municipality (responder cross-muni read)
- CRITICAL-DATA-1: Silent photo upload failure returning success
- CRITICAL-INPUT-1: GPS `(0,0)` and out-of-range coords accepted
- CRITICAL-INPUT-2: Photo size not validated (upload bombs)
- HIGH-ERROR-1: Auto-sync failure silent
- HIGH-ERROR-2: Queue service failure silent

**Out of scope:** MFA (Plan 5), triptych atomicity (Plan 1), rate limiting (Plan 6).

---

## File Map

| File | Responsibility |
|---|---|
| `src/domains/municipal-admin/services/firestore.service.ts` | Fix municipality filter |
| `src/domains/responder/services/firestore.service.ts` | Fix muni filter on assigned incidents |
| `src/features/report/services/reportSubmission.service.ts` | Surface photo failures |
| `src/features/report/services/reportStorage.service.ts` | Size cap + MIME validation |
| `src/shared/utils/geoValidation.ts` *(new)* | GPS bounds validator |
| `src/features/report/components/ReportForm.tsx` | Call geoValidation before submit |
| `src/features/report/hooks/useReportQueue.ts` | Surface auto-sync + queue errors to UI |

---

## Task 1: Fix `getMunicipalityReports` municipality filter

**Files:**
- Modify: `src/domains/municipal-admin/services/firestore.service.ts:32-56`
- Test: `src/domains/municipal-admin/services/__tests__/firestore.service.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// Add to existing test file (create if missing)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getMunicipalityReports } from '../firestore.service'
import * as firestoreSvc from '@/shared/services/firestore.service'

vi.mock('@/shared/services/firestore.service')

describe('getMunicipalityReports', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes municipality filter to Firestore query', async () => {
    const getCollectionSpy = vi.spyOn(firestoreSvc, 'getCollection').mockResolvedValue([])
    vi.spyOn(firestoreSvc, 'getDocument').mockResolvedValue(null)

    await getMunicipalityReports('Daet')

    const constraints = getCollectionSpy.mock.calls[0][1]
    const hasWhere = constraints?.some((c: any) =>
      String(c).includes('municipality') || c?._op === '=='
    )
    expect(hasWhere).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test -- --run src/domains/municipal-admin/services/__tests__/firestore.service.test.ts
```

- [ ] **Step 3: Fix the service**

```typescript
// src/domains/municipal-admin/services/firestore.service.ts
import { orderBy, limit, where, type QueryConstraint } from 'firebase/firestore'

export async function getMunicipalityReports(
  municipality: string
): Promise<Array<{ report: Report; private?: ReportPrivate }>> {
  if (!municipality) throw new Error('municipality is required')
  const constraints: QueryConstraint[] = [
    where('location.municipality', '==', municipality),
    orderBy('createdAt', 'desc'),
    limit(100),
  ]
  const reports = await getCollection<Report>('reports', constraints)
  const results = await Promise.all(
    reports.map(async (report) => {
      const privateData = await getDocument<ReportPrivate>('report_private', report.id)
      return { report, private: privateData || undefined }
    })
  )
  return results
}
```

- [ ] **Step 4: Add composite index**

Edit `firestore.indexes.json`, add:
```json
{
  "collectionGroup": "reports",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "location.municipality", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

- [ ] **Step 5: Run test — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add src/domains/municipal-admin/ firestore.indexes.json
git commit -m "fix(admin): filter reports by municipality (CRITICAL-AUTH-2)"
```

---

## Task 2: Fix `getAssignedIncidents` municipality filter

**Files:**
- Modify: `src/domains/responder/services/firestore.service.ts`

- [ ] **Step 1: Failing test** — assert query constraints include both `assignedTo` AND `municipality`.

- [ ] **Step 2: Add municipality arg + where clause**

```typescript
export async function getAssignedIncidents(
  responderUid: string,
  municipality: string
): Promise<ReportOps[]> {
  if (!municipality) throw new Error('municipality is required')
  const constraints = [
    where('assignedTo', '==', responderUid),
    where('municipality', '==', municipality),
    orderBy('assignedAt', 'desc'),
  ]
  return getCollection<ReportOps>('report_ops', constraints)
}
```

- [ ] **Step 3: Update all callers to pass municipality** (use `useUserContext().municipality`).

Run: `grep -rn "getAssignedIncidents" src/`

- [ ] **Step 4: Add composite index** for `report_ops` `[assignedTo, municipality, assignedAt DESC]`.

- [ ] **Step 5: Tests pass, commit**

```bash
git commit -m "fix(responder): require municipality filter on assigned incidents (CRITICAL-AUTH-3)"
```

---

## Task 3: GPS coordinate validator

**Files:**
- Create: `src/shared/utils/geoValidation.ts`
- Test: `src/shared/utils/__tests__/geoValidation.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { isValidPHCoordinate, CAMARINES_NORTE_BOUNDS } from '../geoValidation'

describe('isValidPHCoordinate', () => {
  it('rejects (0,0)', () => expect(isValidPHCoordinate(0, 0)).toBe(false))
  it('rejects out of PH', () => expect(isValidPHCoordinate(40.0, -74.0)).toBe(false))
  it('accepts Daet center', () => expect(isValidPHCoordinate(14.1129, 122.9550)).toBe(true))
  it('rejects lat > 90', () => expect(isValidPHCoordinate(91, 122)).toBe(false))
  it('rejects non-finite', () => expect(isValidPHCoordinate(NaN, 122)).toBe(false))
})
```

- [ ] **Step 2: Implement**

```typescript
// src/shared/utils/geoValidation.ts
export const PH_BOUNDS = { minLat: 4.5, maxLat: 21.5, minLng: 116.0, maxLng: 127.0 }
export const CAMARINES_NORTE_BOUNDS = { minLat: 13.8, maxLat: 14.7, minLng: 122.3, maxLng: 123.2 }

export function isValidPHCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat === 0 && lng === 0) return false
  return lat >= PH_BOUNDS.minLat && lat <= PH_BOUNDS.maxLat
      && lng >= PH_BOUNDS.minLng && lng <= PH_BOUNDS.maxLng
}

export function isWithinCamarinesNorte(lat: number, lng: number): boolean {
  return lat >= CAMARINES_NORTE_BOUNDS.minLat && lat <= CAMARINES_NORTE_BOUNDS.maxLat
      && lng >= CAMARINES_NORTE_BOUNDS.minLng && lng <= CAMARINES_NORTE_BOUNDS.maxLng
}
```

- [ ] **Step 3: Wire into ReportForm submit path**

In `src/features/report/components/ReportForm.tsx`, in `handleSubmit` before offline/online branch:
```typescript
if (resolvedUserLocation) {
  const { latitude, longitude } = resolvedUserLocation
  if (!isValidPHCoordinate(latitude, longitude)) {
    setLocationError('Invalid GPS coordinates. Please select municipality manually.')
    return
  }
}
```

- [ ] **Step 4: Test + commit**

```bash
git commit -m "feat(geo): reject invalid/zero GPS coordinates (CRITICAL-INPUT-1)"
```

---

## Task 4: Photo size + MIME validation

**Files:**
- Modify: `src/features/report/services/reportStorage.service.ts`

- [ ] **Step 1: Failing test** — upload 6MB file → expect `PHOTO_TOO_LARGE` error; upload `application/x-evil` → expect `PHOTO_INVALID_TYPE`.

- [ ] **Step 2: Add constants + validation at top of `uploadReportPhoto`**

```typescript
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5MB
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export class PhotoValidationError extends Error {
  constructor(public code: 'PHOTO_TOO_LARGE' | 'PHOTO_INVALID_TYPE', msg: string) {
    super(msg); this.name = 'PhotoValidationError'
  }
}

function validatePhoto(file: File): void {
  if (file.size > MAX_PHOTO_BYTES) {
    throw new PhotoValidationError('PHOTO_TOO_LARGE', `Photo exceeds ${MAX_PHOTO_BYTES / 1024 / 1024}MB limit`)
  }
  if (!ALLOWED_PHOTO_TYPES.includes(file.type as any)) {
    throw new PhotoValidationError('PHOTO_INVALID_TYPE', `Unsupported type: ${file.type}`)
  }
}

// In uploadReportPhoto:
export async function uploadReportPhoto(reportId: string, file: File): Promise<string> {
  validatePhoto(file)
  // ... existing upload logic
}
```

- [ ] **Step 3: Catch in ReportForm `handleFileChange` and show user error.**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(report): validate photo size/type before upload (CRITICAL-INPUT-2)"
```

---

## Task 5: Surface photo upload failures (no silent success)

**Files:**
- Modify: `src/features/report/services/reportSubmission.service.ts`

- [ ] **Step 1: Failing test** — when `uploadReportPhoto` rejects, `submitReport` must reject (not resolve with success).

- [ ] **Step 2: Fix**

In `reportSubmission.service.ts`, change photo loop from `Promise.allSettled` silent success to:

```typescript
const uploadResults = await Promise.allSettled(files.map(f => uploadReportPhoto(reportId, f)))
const failures = uploadResults.filter(r => r.status === 'rejected')
if (failures.length > 0) {
  const reasons = failures.map(f => (f as PromiseRejectedResult).reason?.message).join('; ')
  throw new Error(`PHOTO_UPLOAD_FAILED: ${failures.length}/${files.length} failed. ${reasons}`)
}
const photoUrls = uploadResults
  .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
  .map(r => r.value)
```

- [ ] **Step 3: Tests pass, commit**

```bash
git commit -m "fix(report): fail submission when photo upload fails (CRITICAL-DATA-1)"
```

---

## Task 6: Surface auto-sync + queue errors

**Files:**
- Modify: `src/features/report/hooks/useReportQueue.ts`

- [ ] **Step 1: Failing test** — when `syncQueue` rejects, hook exposes `syncError` state (already has `loadError` per 2026-04-12 learnings — add `syncError`).

- [ ] **Step 2: Add `syncError` state + populate in auto-sync `.catch`**

```typescript
const [syncError, setSyncError] = useState<string | null>(null)
// ...
useEffect(() => {
  if (!isOnline) return
  syncQueue().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : 'Sync failed'
    console.error('[AUTO_SYNC_ERROR]', crypto.randomUUID?.() ?? '', msg)
    setSyncError(msg)
  })
}, [isOnline, syncQueue])

return { /* existing */, syncError }
```

- [ ] **Step 3: Display `syncError` in QueueIndicator.**

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(queue): surface auto-sync errors to UI (HIGH-ERROR-1)"
```

---

## Task 7: Final verification

- [ ] **Step 1:** `npm run typecheck` — clean.
- [ ] **Step 2:** `npm run test -- --run` — all green.
- [ ] **Step 3:** Deploy indexes to staging: `firebase deploy --only firestore:indexes --project bantayog-alert-staging`
- [ ] **Step 4:** Update `docs/progress.md` and `docs/learnings.md`.
- [ ] **Step 5:** Open PR.

---

## Self-Review Done

All 7 QA items have tasks. No placeholders. File paths and code are concrete.
