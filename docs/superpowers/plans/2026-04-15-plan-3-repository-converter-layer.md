# Plan 3 — Repository + Converter Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Introduce `FirestoreDataConverter<T>` for every core type and `IReportRepository`-style testing seams. Current services (`shared/services/firestore.service.ts`) call Firestore SDK directly — replace with repository classes that accept injected converters.

**Architecture:** Per spec §3.4 and §7.1, repositories exist for **testability**, not portability. Each domain type gets a converter. Each collection gets a repository class with `IRepository` interface for mocking.

**Tech Stack:** Firebase v9 modular SDK, no new deps.

---

## File Map

| File | Responsibility |
|---|---|
| `src/infrastructure/firebase/converters/reportConverter.ts` *(new)* | `FirestoreDataConverter<Report>` |
| `src/infrastructure/firebase/converters/reportPrivateConverter.ts` *(new)* | |
| `src/infrastructure/firebase/converters/reportOpsConverter.ts` *(new)* | |
| `src/infrastructure/firebase/converters/dispatchConverter.ts` *(new)* | |
| `src/infrastructure/firebase/converters/userConverter.ts` *(new)* | |
| `src/infrastructure/firebase/converters/alertConverter.ts` *(new)* | |
| `src/infrastructure/firebase/repositories/IReportRepository.ts` *(new)* | Interface |
| `src/infrastructure/firebase/repositories/FirestoreReportRepository.ts` *(new)* | Impl |
| `src/infrastructure/firebase/repositories/FirestoreDispatchRepository.ts` *(new)* | |
| `src/infrastructure/firebase/repositories/FirestoreUserRepository.ts` *(new)* | |
| `src/infrastructure/firebase/repositories/FirestoreAlertRepository.ts` *(new)* | |
| `src/infrastructure/firebase/repositories/index.ts` | Barrel |

Then replace direct `getCollection`/`getDocument` calls in services with repository method calls.

---

## Task 1: Report converter

- [ ] **Step 1: Failing test** at `__tests__/reportConverter.test.ts`:

```typescript
import { reportConverter } from '../reportConverter'
import { Timestamp } from 'firebase/firestore'

describe('reportConverter', () => {
  it('toFirestore converts Date → Timestamp', () => {
    const now = new Date('2026-04-15T00:00:00Z')
    const out = reportConverter.toFirestore({
      id: 'x', humanId: '2026-DAET-0001', type: 'flood', severity: 'high',
      location: { barangay: 'A', municipality: 'Daet' },
      status: 'pending', municipalityId: 'Daet', createdAt: now,
    })
    expect(out.createdAt).toBeInstanceOf(Timestamp)
    expect('id' in out).toBe(false)
  })

  it('fromFirestore reconstructs Date + id', () => {
    const snap = { id: 'r1', data: () => ({
      humanId: '2026-DAET-0001', type: 'flood', severity: 'high',
      location: { barangay: 'A', municipality: 'Daet' },
      status: 'pending', municipalityId: 'Daet',
      createdAt: Timestamp.fromDate(new Date('2026-04-15T00:00:00Z')),
    })} as any
    const r = reportConverter.fromFirestore(snap)
    expect(r.id).toBe('r1')
    expect(r.createdAt).toBeInstanceOf(Date)
  })
})
```

- [ ] **Step 2: Implement** (matches spec §3.4 verbatim):

```typescript
// src/infrastructure/firebase/converters/reportConverter.ts
import type { FirestoreDataConverter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import type { Report } from '@/shared/types/firestore.types'

export const reportConverter: FirestoreDataConverter<Report> = {
  toFirestore(report: Report): DocumentData {
    const { id, ...data } = report
    return {
      ...data,
      createdAt: Timestamp.fromDate(data.createdAt),
      verifiedAt: data.verifiedAt ? Timestamp.fromDate(data.verifiedAt) : null,
    }
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): Report {
    const d = snapshot.data()
    return {
      id: snapshot.id,
      humanId: d.humanId,
      type: d.type,
      severity: d.severity,
      location: d.location,
      status: d.status,
      municipalityId: d.municipalityId,
      createdAt: (d.createdAt as Timestamp).toDate(),
      verifiedAt: d.verifiedAt ? (d.verifiedAt as Timestamp).toDate() : undefined,
    } as Report
  },
}
```

- [ ] **Step 3:** Test + commit.

---

## Task 2: Report repository interface + impl

- [ ] **Step 1: Define interface**

```typescript
// src/infrastructure/firebase/repositories/IReportRepository.ts
import type { Report } from '@/shared/types/firestore.types'

export type Unsubscribe = () => void

export interface IReportRepository {
  getById(id: string): Promise<Report | null>
  getByMunicipality(municipality: string, opts?: { status?: string; limit?: number }): Promise<Report[]>
  subscribeToMunicipality(
    municipality: string,
    cb: (reports: Report[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe
}
```

- [ ] **Step 2: Failing test** — mock Firestore module, verify `getByMunicipality` uses `where('location.municipality', '==', muni)` and converter.

- [ ] **Step 3: Implement**

```typescript
// src/infrastructure/firebase/repositories/FirestoreReportRepository.ts
import { collection, doc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit as fbLimit } from 'firebase/firestore'
import { db } from '@/app/firebase/config'
import { reportConverter } from '../converters/reportConverter'
import type { IReportRepository, Unsubscribe } from './IReportRepository'
import type { Report } from '@/shared/types/firestore.types'

export class FirestoreReportRepository implements IReportRepository {
  private col() { return collection(db, 'reports').withConverter(reportConverter) }

  async getById(id: string): Promise<Report | null> {
    const snap = await getDoc(doc(this.col(), id))
    return snap.exists() ? snap.data() : null
  }

  async getByMunicipality(municipality: string, opts: { status?: string; limit?: number } = {}): Promise<Report[]> {
    const parts = [where('location.municipality', '==', municipality)]
    if (opts.status) parts.push(where('status', '==', opts.status))
    const q = query(this.col(), ...parts, orderBy('createdAt', 'desc'), fbLimit(opts.limit ?? 100))
    const snap = await getDocs(q)
    return snap.docs.map(d => d.data())
  }

  subscribeToMunicipality(municipality: string, cb: (r: Report[]) => void, onError?: (e: Error) => void): Unsubscribe {
    const q = query(this.col(),
      where('location.municipality', '==', municipality),
      orderBy('createdAt', 'desc'), fbLimit(100))
    return onSnapshot(q, s => cb(s.docs.map(d => d.data())), onError)
  }
}

export const reportRepository: IReportRepository = new FirestoreReportRepository()
```

- [ ] **Step 4:** Tests + commit.

---

## Task 3: Dispatch converter + repository

**Files:** `dispatchConverter.ts`, `FirestoreDispatchRepository.ts`

- [ ] **Step 1: Converter test** — `dispatchedAt`, `acknowledgedAt`, `resolvedAt`, `timeoutAt` all round-trip as Date ↔ Timestamp.

- [ ] **Step 2: Implement converter** mirroring spec §3.2 `dispatches` shape.

- [ ] **Step 3: Repository interface:**

```typescript
export interface IDispatchRepository {
  getByReport(reportId: string): Promise<Dispatch[]>
  subscribeForResponder(uid: string, cb: (d: Dispatch[]) => void): Unsubscribe
  subscribeForAgency(agencyId: string, cb: (d: Dispatch[]) => void): Unsubscribe
  updateStatus(id: string, patch: Pick<Dispatch, 'status'> & Partial<Pick<Dispatch, 'acknowledgedAt' | 'resolvedAt' | 'resolutionSummary' | 'proofPhotoUrl'>>): Promise<void>
}
```

- [ ] **Step 4:** Impl + tests + commit.

---

## Task 4: User, Alert repositories

Repeat the pattern for users (`IUserRepository`) and alerts (`IAlertRepository`). Each with:
- Converter test (Date↔Timestamp round-trip)
- Repository interface
- Firestore impl
- Unit tests (mock Firestore module)

- [ ] Commit each as its own step: `feat(repo): add FirestoreUserRepository`, etc.

---

## Task 5: Migrate callers

For each existing service that reads Firestore directly:

- [ ] **5a:** `src/domains/citizen/services/firestore.service.ts` — replace `getCollection`/`getDocument` with `reportRepository.*`.
- [ ] **5b:** `src/domains/municipal-admin/services/firestore.service.ts` — same.
- [ ] **5c:** `src/domains/responder/services/firestore.service.ts` — use dispatch repo.
- [ ] **5d:** `src/domains/provincial-superadmin/services/firestore.service.ts` — same.
- [ ] **5e:** `src/features/alerts/services/alert.service.ts` — use alert repo.
- [ ] **5f:** `src/features/feed/hooks/useFeedReports.ts` — use report repo.

Commit each migration separately with test pass.

---

## Task 6: Delete legacy `getCollection`/`getDocument` helpers

- [ ] **Step 1:** Grep: `grep -rn "from.*shared/services/firestore.service" src/` — confirm zero callers.
- [ ] **Step 2:** Delete `src/shared/services/firestore.service.ts` + test file.
- [ ] **Step 3:** Commit: `chore(repo): remove legacy firestore helpers — repositories own all access`.

---

## Self-Review

Every spec-mentioned collection has a converter + repository. Every converter test checks round-trip. No direct `getDoc`/`getDocs` outside repositories after Task 6.
