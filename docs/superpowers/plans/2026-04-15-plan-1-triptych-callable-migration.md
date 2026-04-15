# Plan 1 — Triptych → `submitReport` Callable Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.
> **This is the highest-risk plan in the migration.** Flipping rules prematurely breaks every client. Follow the PR boundaries strictly.

**Goal:** Move citizen report creation from client-side 3-collection writes to a single transactional `submitReport` Cloud Function, while keeping the app functional at every commit.

**Architecture:** Phased rollout across **3 PRs**:
1. Build callable CF + feature-flagged dual-write client.
2. Switch flag on; monitor; keep client write path as fallback.
3. Flip security rules to `allow create: if false`; remove client write path.

**Tech Stack:** Firebase Functions v2 (callable), Firestore transactions, IndexedDB offline queue, feature flag via `import.meta.env.VITE_USE_SUBMIT_REPORT_CALLABLE`.

---

## Prerequisites

- Plan 0 merged (muni filter + photo validation + GPS validation).
- Firebase Admin SDK available in `functions/`.
- `bantayog-alert-staging` project exists (or Plan 7 done).

## File Map

| File | Responsibility |
|---|---|
| `functions/src/submitReport.ts` *(new)* | Callable CF: validate, rate-limit, dedup, transactional triptych write |
| `functions/src/validation/reportSchema.ts` *(new)* | Zod schema for `SubmitReportPayload` |
| `functions/src/rateLimit.ts` *(new)* | Rate-limit helper using `rate_limits` collection |
| `functions/src/duplicateDetection.ts` *(new)* | Geo-proximity + time-window dedup |
| `functions/src/__tests__/submitReport.test.ts` *(new)* | Emulator integration tests |
| `functions/src/index.ts` | Export new callable |
| `src/features/report/services/reportSubmission.service.ts` | Add callable path behind feature flag |
| `src/features/report/services/reportQueue.service.ts` | Queue *callable invocations*, not Firestore writes |
| `firestore.rules` | Add `allow create: if false` on `reports`, `report_private`, `report_ops` (PR 3 only) |
| `firestore.rules.test.ts` | Update rule tests |

---

# PR 1 — Build the callable (no behavior change for users)

## Task 1.1: Zod payload schema

**Files:** Create `functions/src/validation/reportSchema.ts`

- [ ] **Step 1:** Install zod in functions: `cd functions && npm i zod`

- [ ] **Step 2: Write failing test** at `functions/src/validation/__tests__/reportSchema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { SubmitReportSchema } from '../reportSchema'

describe('SubmitReportSchema', () => {
  const valid = {
    type: 'flood', severity: 'moderate',
    location: { lat: 14.11, lng: 122.95, barangay: 'Alawihao', municipality: 'Daet' },
    description: 'Water rising', reporter: { isAnonymous: true },
  }
  it('accepts valid payload', () => expect(SubmitReportSchema.safeParse(valid).success).toBe(true))
  it('rejects (0,0)', () => {
    const bad = { ...valid, location: { ...valid.location, lat: 0, lng: 0 } }
    expect(SubmitReportSchema.safeParse(bad).success).toBe(false)
  })
  it('rejects missing municipality', () => {
    const { municipality, ...loc } = valid.location
    expect(SubmitReportSchema.safeParse({ ...valid, location: loc }).success).toBe(false)
  })
  it('trims description > 2000 chars', () => {
    const long = { ...valid, description: 'x'.repeat(2001) }
    expect(SubmitReportSchema.safeParse(long).success).toBe(false)
  })
})
```

- [ ] **Step 3: Implement**

```typescript
// functions/src/validation/reportSchema.ts
import { z } from 'zod'

export const SubmitReportSchema = z.object({
  type: z.enum(['flood', 'fire', 'landslide', 'earthquake', 'accident', 'medical', 'other']),
  severity: z.enum(['low', 'moderate', 'high', 'critical']),
  location: z.object({
    lat: z.number().refine(n => n >= 4.5 && n <= 21.5 && n !== 0),
    lng: z.number().refine(n => n >= 116.0 && n <= 127.0 && n !== 0),
    barangay: z.string().min(1).max(100),
    municipality: z.string().min(1).max(100),
  }),
  description: z.string().min(1).max(2000),
  photoUrls: z.array(z.string().url()).max(5).optional(),
  reporter: z.object({
    isAnonymous: z.boolean(),
    name: z.string().max(100).optional(),
    phone: z.string().regex(/^(\+?63|0)?[0-9]{10}$/).optional(),
    email: z.string().email().optional(),
    citizenUid: z.string().optional(),
  }),
  deviceFingerprint: z.string().min(8).max(128).optional(),
})

export type SubmitReportPayload = z.infer<typeof SubmitReportSchema>
```

- [ ] **Step 4: Test + commit**

```bash
git add functions/ && git commit -m "feat(functions): add SubmitReportSchema"
```

---

## Task 1.2: Rate limit helper

**Files:** Create `functions/src/rateLimit.ts`

- [ ] **Step 1: Failing test** — 2 submissions from same fingerprint within 1h → second rejects with `RATE_LIMIT_EXCEEDED`.

- [ ] **Step 2: Implement** (uses Admin SDK transaction on `rate_limits/{key}`)

```typescript
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

export class RateLimitError extends Error {
  constructor(public key: string, public retryAfterMs: number) {
    super('RATE_LIMIT_EXCEEDED'); this.name = 'RateLimitError'
  }
}

interface Limit { windowMs: number; max: number }
const LIMITS: Record<string, Limit> = {
  device: { windowMs: 60 * 60 * 1000, max: 1 },      // 1/hr per device
  device_day: { windowMs: 24 * 60 * 60 * 1000, max: 3 },
  phone: { windowMs: 60 * 60 * 1000, max: 1 },
  ip: { windowMs: 24 * 60 * 60 * 1000, max: 5 },
}

export async function enforceRateLimit(kind: keyof typeof LIMITS, key: string): Promise<void> {
  const db = getFirestore()
  const ref = db.collection('rate_limits').doc(`${kind}:${key}`)
  const limit = LIMITS[kind]
  const now = Date.now()

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.data() as { count: number; windowStart: Timestamp } | undefined
    if (!data || now - data.windowStart.toMillis() > limit.windowMs) {
      tx.set(ref, { count: 1, windowStart: Timestamp.now(), type: kind })
      return
    }
    if (data.count >= limit.max) {
      const retryAfterMs = limit.windowMs - (now - data.windowStart.toMillis())
      throw new RateLimitError(`${kind}:${key}`, retryAfterMs)
    }
    tx.update(ref, { count: FieldValue.increment(1) })
  })
}
```

- [ ] **Step 3: Tests + commit**

---

## Task 1.3: Duplicate detection

**Files:** Create `functions/src/duplicateDetection.ts`

- [ ] **Step 1: Failing test** — two reports within 500m and 30min → second returns `isDuplicate: true`.

- [ ] **Step 2: Implement (naive geo box, refine later)**

```typescript
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const METERS_PER_DEG_LAT = 111_320
const DEDUP_RADIUS_M = 500
const DEDUP_WINDOW_MS = 30 * 60 * 1000

export async function findDuplicate(
  type: string, lat: number, lng: number, municipality: string
): Promise<string | null> {
  const db = getFirestore()
  const since = Timestamp.fromMillis(Date.now() - DEDUP_WINDOW_MS)
  const degLat = DEDUP_RADIUS_M / METERS_PER_DEG_LAT
  const degLng = DEDUP_RADIUS_M / (METERS_PER_DEG_LAT * Math.cos(lat * Math.PI / 180))

  const snap = await db.collection('reports')
    .where('location.municipality', '==', municipality)
    .where('type', '==', type)
    .where('createdAt', '>=', since)
    .limit(20).get()

  for (const doc of snap.docs) {
    const d = doc.data()
    const dLat = Math.abs(d.location?.lat - lat)
    const dLng = Math.abs(d.location?.lng - lng)
    if (dLat < degLat && dLng < degLng) return doc.id
  }
  return null
}
```

- [ ] **Step 3: Commit**

---

## Task 1.4: `submitReport` callable with transactional triptych

**Files:** Create `functions/src/submitReport.ts`; update `functions/src/index.ts`

- [ ] **Step 1: Failing integration test** against emulator:

```typescript
// functions/src/__tests__/submitReport.test.ts
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
// Test: callable creates all 3 docs atomically, returns { reportId, humanId }
// Test: invalid payload rejects
// Test: rate limit enforced
// Test: duplicate returns { isDuplicate: true, existingReportId }
```

- [ ] **Step 2: Implement**

```typescript
// functions/src/submitReport.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, Timestamp, GeoPoint } from 'firebase-admin/firestore'
import { SubmitReportSchema } from './validation/reportSchema'
import { enforceRateLimit, RateLimitError } from './rateLimit'
import { findDuplicate } from './duplicateDetection'

export const submitReport = onCall({ region: 'asia-southeast1', minInstances: 1 }, async (req) => {
  const parsed = SubmitReportSchema.safeParse(req.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.message)
  const p = parsed.data

  const deviceKey = p.deviceFingerprint ?? req.rawRequest?.ip ?? 'unknown'
  try {
    await enforceRateLimit('device', deviceKey)
    await enforceRateLimit('device_day', deviceKey)
    if (p.reporter.phone) await enforceRateLimit('phone', p.reporter.phone)
  } catch (e) {
    if (e instanceof RateLimitError) throw new HttpsError('resource-exhausted', e.message, { retryAfterMs: e.retryAfterMs })
    throw e
  }

  const dup = await findDuplicate(p.type, p.location.lat, p.location.lng, p.location.municipality)
  if (dup && !p.reporter.citizenUid) return { isDuplicate: true, existingReportId: dup }

  const db = getFirestore()
  const reportRef = db.collection('reports').doc()
  const humanId = await allocateHumanId(db, p.location.municipality)
  const now = Timestamp.now()

  await db.runTransaction(async (tx) => {
    tx.set(reportRef, {
      humanId, type: p.type, severity: p.severity,
      location: { barangay: p.location.barangay, municipality: p.location.municipality },
      status: 'pending', municipalityId: p.location.municipality,
      photoUrls: p.photoUrls ?? [], description: p.description,
      createdAt: now,
    })
    tx.set(db.collection('report_private').doc(reportRef.id), {
      reporterName: p.reporter.isAnonymous ? null : p.reporter.name ?? null,
      phone: p.reporter.phone ?? null,
      email: p.reporter.isAnonymous ? null : p.reporter.email ?? null,
      exactLocation: new GeoPoint(p.location.lat, p.location.lng),
      deviceFingerprint: p.deviceFingerprint ?? null,
      isAnonymous: p.reporter.isAnonymous,
      citizenUid: p.reporter.citizenUid ?? null,
      municipality: p.location.municipality,
      createdAt: now,
    })
    tx.set(db.collection('report_ops').doc(reportRef.id), {
      verifiedBy: null, classifiedBy: null, adminNotes: null,
      duplicateOf: null, agencyRequests: [], activeResponderCount: 0,
      municipality: p.location.municipality,
      visibility: { scope: 'municipality' },
      createdAt: now,
    })
  })

  return { reportId: reportRef.id, humanId, status: 'submitted' }
})

async function allocateHumanId(db: FirebaseFirestore.Firestore, muni: string): Promise<string> {
  const year = new Date().getFullYear()
  const counterRef = db.collection('system_counters').doc(`reports-${year}-${muni}`)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef)
    const next = ((snap.data()?.n as number) ?? 0) + 1
    tx.set(counterRef, { n: next }, { merge: true })
    return `${year}-${muni.toUpperCase()}-${String(next).padStart(4, '0')}`
  })
}
```

- [ ] **Step 3: Export in `functions/src/index.ts`**

```typescript
export { submitReport } from './submitReport'
```

- [ ] **Step 4: Run emulator tests — PASS**

```bash
cd functions && npm run build && npm test
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(functions): add submitReport callable with transactional triptych"
```

---

## Task 1.5: Client service — callable path behind feature flag

**Files:** Modify `src/features/report/services/reportSubmission.service.ts`

- [ ] **Step 1: Failing test** — when `VITE_USE_SUBMIT_REPORT_CALLABLE=true`, service calls `httpsCallable('submitReport')` and does NOT write directly.

- [ ] **Step 2: Add branch**

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions'

const useCallable = import.meta.env.VITE_USE_SUBMIT_REPORT_CALLABLE === 'true'

export async function submitReport(input: ReportInput): Promise<{ reportId: string; humanId: string }> {
  if (useCallable) return submitViaCallable(input)
  return submitViaDirectWrites(input)  // existing path, renamed
}

async function submitViaCallable(input: ReportInput) {
  const fn = httpsCallable<SubmitReportPayload, { reportId: string; humanId: string; status: string }>(
    getFunctions(undefined, 'asia-southeast1'), 'submitReport'
  )
  const { data } = await fn(toPayload(input))
  return { reportId: data.reportId, humanId: data.humanId }
}
```

- [ ] **Step 3: Commit — flag defaults OFF**

```bash
git commit -m "feat(report): add callable submission path behind feature flag (OFF)"
```

**End of PR 1.** Merge. Flag OFF in all envs.

---

# PR 2 — Flip flag, monitor, rewrite offline queue

## Task 2.1: Offline queue stores callable invocations

**Files:** Modify `src/features/report/services/reportQueue.service.ts`

- [ ] **Step 1: Failing test** — enqueued record contains `{ functionName: 'submitReport', payload, retryCount }` not Firestore docs.

- [ ] **Step 2: Refactor queue record type**

```typescript
export interface QueuedCallable {
  id: string
  functionName: 'submitReport'
  payload: SubmitReportPayload
  createdAt: Date
  retryCount: number
  maxRetries: 5
  status: 'pending' | 'syncing' | 'failed' | 'succeeded'
  lastError?: string
}
```

- [ ] **Step 3: Replace `syncItem` to invoke callable:**

```typescript
async function syncItem(item: QueuedCallable) {
  const fn = httpsCallable(getFunctions(undefined, 'asia-southeast1'), item.functionName)
  const { data } = await fn(item.payload)
  return data
}
```

- [ ] **Step 4: Migration for existing queued items** — on mount, detect old shape and drop with console warning.

- [ ] **Step 5: Tests + commit**

```bash
git commit -m "refactor(queue): store callable invocations instead of Firestore writes"
```

## Task 2.2: Flip flag on in staging

- [ ] **Step 1:** Set `VITE_USE_SUBMIT_REPORT_CALLABLE=true` in staging env.
- [ ] **Step 2:** Deploy callable: `firebase deploy --only functions:submitReport --project staging`
- [ ] **Step 3:** Run E2E: offline submit, online submit, duplicate, rate-limit.
- [ ] **Step 4:** Monitor CF logs for 24h.

## Task 2.3: Flip flag on in production

- [ ] **Step 1:** Set `VITE_USE_SUBMIT_REPORT_CALLABLE=true` in prod env.
- [ ] **Step 2:** Deploy callable to prod.
- [ ] **Step 3:** Monitor 72h. If >0.5% error rate, set flag back to false (fallback remains).

**End of PR 2.**

---

# PR 3 — Lock down rules, delete client write path

## Task 3.1: Update Firestore rules

**Files:** Modify `firestore.rules`

- [ ] **Step 1: Update rule tests** — `allow create: if false` for `reports`, `report_private`, `report_ops` from client (even authenticated).

- [ ] **Step 2: Change rules**

```
match /reports/{reportId} {
  allow read: if isAuthenticated();
  allow create: if false;   // ← NEW
  allow update: if isMunicipalAdminOf(resource.data.municipalityId) || isSuperadmin();
  allow delete: if false;
}
match /report_private/{reportId} {
  allow read: if isMunicipalAdminOf(resource.data.municipality) || isSuperadmin();
  allow write: if false;   // ← NEW
}
match /report_ops/{reportId} {
  // existing read rules
  allow create, update, delete: if false;   // ← NEW
}
```

- [ ] **Step 3: Deploy to staging, run full E2E, observe 48h.**

- [ ] **Step 4: Deploy to production.**

## Task 3.2: Delete client direct-write path

- [ ] **Step 1:** Remove `submitViaDirectWrites` from `reportSubmission.service.ts`.
- [ ] **Step 2:** Remove `VITE_USE_SUBMIT_REPORT_CALLABLE` flag (now the only path).
- [ ] **Step 3:** Delete legacy triptych writer in `src/domains/citizen/services/firestore.service.ts`.
- [ ] **Step 4:** Commit.

```bash
git commit -m "feat(report): remove client direct-write path — callable is sole entry (Finding #2)"
```

**End of PR 3.** Migration complete.

---

## Rollback Plan

- PR 1: no-op, flag off.
- PR 2: set flag false in env; callable stays deployed but unused.
- PR 3: revert rules commit; redeploy rules; re-enable flag false. Re-introduce direct-write path from git history.

## Self-Review

- Spec §3.1 (triptych atomicity) — Task 1.4.
- Spec §3.3 (rule flip) — Task 3.1.
- Spec §4.3 (offline callable queue) — Task 2.1.
- Spec §6.3 (rate limit) — Task 1.2.
- Duplicate detection — Task 1.3.
- No placeholders. PRs separable.
