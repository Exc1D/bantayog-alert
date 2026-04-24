# Phase 5 Cluster A — Admin UI Hardening

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add surge triage pagination + keyboard shortcuts, duplicate-report clustering, and shift handoff to the admin desktop app.

**Architecture:** Three independent slices: A.1 adds UX to the existing triage queue; A.2 adds a Firestore `onCreate` trigger + `mergeDuplicates` callable; A.3 adds `initiateShiftHandoff` / `acceptShiftHandoff` callables, extends `adminOperationsSweep`, and adds a modal + banner to the admin desktop. **Prerequisite:** PRE-B plan must be complete — Cluster A reads `reportType`, `locationGeohash`, `duplicateClusterId` from `reportOpsDocSchema` and `toUid` optional + `escalatedAt` from `shiftHandoffDocSchema`.

**Tech Stack:** Vitest + @testing-library/react (admin-desktop), Firebase Emulator (Firestore port 8081), @turf/turf + ngeohash (functions), firebase-functions/v2 onDocumentCreated + onCall, Zod

---

## File Map

| Action | File                                                               |
| ------ | ------------------------------------------------------------------ |
| Create | `apps/admin-desktop/vitest.config.ts`                              |
| Create | `apps/admin-desktop/src/__tests__/setup.ts`                        |
| Modify | `apps/admin-desktop/package.json`                                  |
| Modify | `apps/admin-desktop/src/hooks/useMuniReports.ts`                   |
| Modify | `apps/admin-desktop/src/pages/TriageQueuePage.tsx`                 |
| Create | `apps/admin-desktop/src/__tests__/triage-queue.test.tsx`           |
| Create | `functions/src/__tests__/triggers/duplicate-cluster.test.ts`       |
| Create | `functions/src/__tests__/callables/merge-duplicates.test.ts`       |
| Create | `functions/src/triggers/duplicate-cluster-trigger.ts`              |
| Create | `functions/src/callables/merge-duplicates.ts`                      |
| Modify | `infra/firebase/firestore.indexes.json`                            |
| Modify | `functions/src/index.ts`                                           |
| Create | `functions/src/__tests__/callables/shift-handoff.test.ts`          |
| Create | `functions/src/callables/shift-handoff.ts`                         |
| Modify | `functions/src/scheduled/admin-operations-sweep.ts`                |
| Modify | `functions/src/__tests__/scheduled/admin-operations-sweep.test.ts` |
| Modify | `apps/admin-desktop/src/pages/TriageQueuePage.tsx`                 |
| Create | `apps/admin-desktop/src/__tests__/shift-handoff-modal.test.tsx`    |

---

### Task 1: Bootstrap admin-desktop vitest + testing-library

**Files:**

- Modify: `apps/admin-desktop/package.json`
- Create: `apps/admin-desktop/vitest.config.ts`
- Create: `apps/admin-desktop/src/__tests__/setup.ts`

- [ ] **Step 1: Add devDependencies**

In `apps/admin-desktop/package.json`, add to `devDependencies`:

```json
"@testing-library/jest-dom": "^6.6.3",
"@testing-library/react": "^16.3.0",
"@testing-library/user-event": "^14.5.2",
"@types/react": "^19.2.14",
"@types/react-dom": "^19.2.3",
"happy-dom": "^17.4.4",
"vitest": "^3.2.4"
```

Also add `"test": "vitest run"` to the `scripts` block.

- [ ] **Step 2: Create `apps/admin-desktop/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.tsx', 'src/__tests__/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Create `apps/admin-desktop/src/__tests__/setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Run to confirm test runner works**

```bash
pnpm --filter @bantayog/admin-desktop exec vitest run
```

Expected: PASS (0 tests, no errors) — the runner should start and exit cleanly.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-desktop/package.json \
        apps/admin-desktop/vitest.config.ts \
        apps/admin-desktop/src/__tests__/setup.ts
git commit -m "feat(admin-desktop): add vitest + testing-library test infrastructure"
```

---

### Task 2: A.1 — Extend `useMuniReports` (pagination, filters, severity field)

**Files:**

- Modify: `apps/admin-desktop/src/hooks/useMuniReports.ts`
- Create: `apps/admin-desktop/src/__tests__/triage-queue.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/admin-desktop/src/__tests__/triage-queue.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Minimal stub for useMuniReports return shape
const mockUseMuniReports = vi.fn()

vi.mock('../hooks/useMuniReports', () => ({
  useMuniReports: (...args: unknown[]) => mockUseMuniReports(...args),
}))

vi.mock('../app/firebase', () => ({
  db: {},
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({
    claims: { municipalityId: 'daet', role: 'municipal_admin' },
    signOut: vi.fn(),
  }),
}))

vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: vi.fn(),
    rejectReport: vi.fn(),
  },
}))

vi.mock('../pages/ReportDetailPanel', () => ({
  ReportDetailPanel: () => <div>detail</div>,
}))
vi.mock('../pages/DispatchModal', () => ({
  DispatchModal: () => <div>dispatch</div>,
}))
vi.mock('../pages/CloseReportModal', () => ({
  CloseReportModal: () => <div>close</div>,
}))

import { TriageQueuePage } from '../pages/TriageQueuePage'

describe('TriageQueuePage', () => {
  beforeEach(() => {
    mockUseMuniReports.mockReturnValue({
      reports: [],
      hasMore: false,
      loadMore: vi.fn(),
      loading: false,
      error: null,
    })
  })

  it('renders Load More button when hasMore is true', () => {
    mockUseMuniReports.mockReturnValue({
      reports: [],
      hasMore: true,
      loadMore: vi.fn(),
      loading: false,
      error: null,
    })
    render(<TriageQueuePage />)
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
  })

  it('does not render Load More button when hasMore is false', () => {
    render(<TriageQueuePage />)
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('calls loadMore when Load More is clicked', () => {
    const loadMore = vi.fn()
    mockUseMuniReports.mockReturnValue({
      reports: [],
      hasMore: true,
      loadMore,
      loading: false,
      error: null,
    })
    render(<TriageQueuePage />)
    fireEvent.click(screen.getByRole('button', { name: /load more/i }))
    expect(loadMore).toHaveBeenCalledTimes(1)
  })

  it('shows Showing X of Y count', () => {
    mockUseMuniReports.mockReturnValue({
      reports: [
        { reportId: 'r1', status: 'new', severity: 'high', createdAt: null, municipalityLabel: '' },
        { reportId: 'r2', status: 'new', severity: 'medium', createdAt: null, municipalityLabel: '' },
      ],
      hasMore: true,
      loadMore: vi.fn(),
      loading: false,
      error: null,
    })
    render(<TriageQueuePage />)
    expect(screen.getByText(/showing 2/i)).toBeInTheDocument()
  })

  it('renders severity from severity field, not severityDerived', () => {
    mockUseMuniReports.mockReturnValue({
      reports: [
        { reportId: 'r1', status: 'new', severity: 'high', createdAt: null, municipalityLabel: '' },
      ],
      hasMore: false,
      loadMore: vi.fn(),
      loading: false,
      error: null,
    })
    render(<TriageQueuePage />)
    expect(screen.getByText(/high/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm --filter @bantayog/admin-desktop exec vitest run src/__tests__/triage-queue.test.tsx
```

Expected: FAIL — `reports` not in hook return, `hasMore`/`loadMore` missing.

- [ ] **Step 3: Update `apps/admin-desktop/src/hooks/useMuniReports.ts`**

```typescript
import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../app/firebase'

export interface MuniReportRow {
  reportId: string
  status: string
  severity: string
  reportType?: string
  duplicateClusterId?: string
  barangayId?: string
  createdAt: Timestamp
  municipalityLabel: string
}

const ACTIVE_STATUSES = ['new', 'awaiting_verify', 'verified', 'assigned'] as const

export function useMuniReports(municipalityId: string | undefined) {
  const [limitCount, setLimitCount] = useState(100)
  const [reports, setReports] = useState<MuniReportRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!municipalityId) {
      queueMicrotask(() => {
        setReports([])
        setLoading(false)
      })
      return
    }
    queueMicrotask(() => {
      setLoading(true)
    })
    const q = query(
      collection(db, 'reports'),
      where('municipalityId', '==', municipalityId),
      where('status', 'in', ACTIVE_STATUSES),
      orderBy('createdAt', 'desc'),
      limit(limitCount + 1),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => {
          const data = d.data()
          return {
            reportId: d.id,
            status: String(data.status),
            severity: String(data.severity ?? 'medium'),
            reportType: data.reportType !== undefined ? String(data.reportType) : undefined,
            duplicateClusterId:
              data.duplicateClusterId !== undefined ? String(data.duplicateClusterId) : undefined,
            barangayId: data.barangayId !== undefined ? String(data.barangayId) : undefined,
            createdAt: data.createdAt as Timestamp,
            municipalityLabel: String(data.municipalityLabel ?? ''),
          }
        })
        setHasMore(all.length > limitCount)
        setReports(all.slice(0, limitCount))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsub
  }, [municipalityId, limitCount])

  return {
    reports,
    hasMore,
    loadMore: () => setLimitCount((n) => n + 100),
    loading,
    error,
  }
}
```

- [ ] **Step 4: Update `apps/admin-desktop/src/pages/TriageQueuePage.tsx`**

Replace the `useMuniReports` destructure and the queue `<ul>` section. Full updated file:

```typescript
import { useState } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { useMuniReports, type MuniReportRow } from '../hooks/useMuniReports'
import { ReportDetailPanel } from './ReportDetailPanel'
import { DispatchModal } from './DispatchModal'
import { CloseReportModal } from './CloseReportModal'
import { callables } from '../services/callables'

export function TriageQueuePage() {
  const { claims, signOut } = useAuth()
  const municipalityId =
    typeof claims?.municipalityId === 'string' ? claims.municipalityId : undefined
  const { reports, hasMore, loadMore, loading, error } = useMuniReports(municipalityId)
  const [selected, setSelected] = useState<string | null>(null)
  const [dispatchForReportId, setDispatchForReportId] = useState<string | null>(null)
  const [closeForReportId, setCloseForReportId] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const handleVerify = (reportId: string) => {
    void (async () => {
      try {
        await callables.verifyReport({ reportId, idempotencyKey: crypto.randomUUID() })
        setBanner(null)
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Verify failed')
      }
    })()
  }

  const handleReject = (reportId: string) => {
    const reason = prompt(
      'Reject reason (obviously_false, duplicate, test_submission, insufficient_detail)?',
    )
    if (!reason) return
    void (async () => {
      try {
        await callables.rejectReport({
          reportId,
          reason: reason as
            | 'obviously_false'
            | 'duplicate'
            | 'test_submission'
            | 'insufficient_detail',
          idempotencyKey: crypto.randomUUID(),
        })
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Reject failed')
      }
    })()
  }

  return (
    <main>
      <header>
        <h1>Triage · {municipalityId ?? 'N/A'}</h1>
        <button onClick={() => void signOut()}>Sign out</button>
      </header>
      {banner && <div role="alert">{banner}</div>}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h2>Queue</h2>
          {loading ? (
            <p>Loading…</p>
          ) : error ? (
            <p role="alert">Error: {error}</p>
          ) : reports.length === 0 ? (
            <p>No active reports.</p>
          ) : (
            <>
              <p>Showing {reports.length}{hasMore ? '+' : ''} reports</p>
              <ul>
                {reports.map((r: MuniReportRow) => (
                  <li key={r.reportId}>
                    <button
                      onClick={() => { setSelected(r.reportId) }}
                    >
                      [{r.status}] {r.severity}{r.duplicateClusterId ? ' [dup]' : ''} — {r.reportId.slice(0, 8)}
                    </button>
                  </li>
                ))}
              </ul>
              {hasMore && (
                <button onClick={loadMore}>Load More</button>
              )}
            </>
          )}
        </div>
        {selected && (
          <ReportDetailPanel
            reportId={selected}
            onVerify={handleVerify}
            onReject={handleReject}
            onDispatch={setDispatchForReportId}
            onClose={setCloseForReportId}
          />
        )}
      </section>
      {dispatchForReportId && (
        <DispatchModal
          reportId={dispatchForReportId}
          onClose={() => { setDispatchForReportId(null) }}
          onError={(msg: string) => { setBanner(msg) }}
        />
      )}
      {closeForReportId && (
        <CloseReportModal
          reportId={closeForReportId}
          onClose={() => { setCloseForReportId(null) }}
          onError={(msg: string) => { setBanner(msg) }}
        />
      )}
    </main>
  )
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @bantayog/admin-desktop exec vitest run src/__tests__/triage-queue.test.tsx
```

Expected: PASS (5 tests)

- [ ] **Step 6: Lint + typecheck**

```bash
pnpm --filter @bantayog/admin-desktop lint && pnpm --filter @bantayog/admin-desktop typecheck
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/admin-desktop/src/hooks/useMuniReports.ts \
        apps/admin-desktop/src/pages/TriageQueuePage.tsx \
        apps/admin-desktop/src/__tests__/triage-queue.test.tsx
git commit -m "feat(triage): pagination + severity field — remove severityDerived, add hasMore/loadMore"
```

---

### Task 3: A.1 — Keyboard shortcuts for TriageQueuePage

**Files:**

- Modify: `apps/admin-desktop/src/pages/TriageQueuePage.tsx`
- Modify: `apps/admin-desktop/src/__tests__/triage-queue.test.tsx`

- [ ] **Step 1: Add failing tests for keyboard shortcuts**

Add to `apps/admin-desktop/src/__tests__/triage-queue.test.tsx`:

```typescript
import userEvent from '@testing-library/user-event'

// Add inside describe('TriageQueuePage') block:

  it('pressing j selects the next report in the list', async () => {
    const user = userEvent.setup()
    mockUseMuniReports.mockReturnValue({
      reports: [
        { reportId: 'r1', status: 'new', severity: 'high', createdAt: null, municipalityLabel: '' },
        { reportId: 'r2', status: 'new', severity: 'medium', createdAt: null, municipalityLabel: '' },
      ],
      hasMore: false,
      loadMore: vi.fn(),
      loading: false,
      error: null,
    })
    render(<TriageQueuePage />)
    await user.keyboard('j')
    // First j: selects first item (index 0 → r1)
    expect(screen.getByText('detail')).toBeInTheDocument()
  })

  it('pressing k moves selection backward', async () => {
    const user = userEvent.setup()
    mockUseMuniReports.mockReturnValue({
      reports: [
        { reportId: 'r1', status: 'new', severity: 'high', createdAt: null, municipalityLabel: '' },
        { reportId: 'r2', status: 'new', severity: 'medium', createdAt: null, municipalityLabel: '' },
      ],
      hasMore: false,
      loadMore: vi.fn(),
      loading: false,
      error: null,
    })
    render(<TriageQueuePage />)
    await user.keyboard('jj') // moves to index 1
    await user.keyboard('k')  // moves back to index 0
    expect(screen.getByText('detail')).toBeInTheDocument()
  })

  it('keyboard shortcuts do not fire when a modal is open', async () => {
    const user = userEvent.setup()
    mockUseMuniReports.mockReturnValue({
      reports: [],
      hasMore: false,
      loadMore: vi.fn(),
      loading: false,
      error: null,
    })
    render(<TriageQueuePage />)
    // No reports, so no dispatch modal open — just verify j/k don't throw
    await user.keyboard('j')
    await user.keyboard('k')
    expect(screen.queryByText('detail')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm --filter @bantayog/admin-desktop exec vitest run src/__tests__/triage-queue.test.tsx
```

Expected: FAIL — keyboard events have no effect.

- [ ] **Step 3: Add keyboard shortcut logic to `TriageQueuePage`**

Add `keyboardIndex` state and `useEffect` to the component, just before the `return` statement:

```typescript
const [keyboardIndex, setKeyboardIndex] = useState<number>(-1)
const modalOpen = !!dispatchForReportId || !!closeForReportId

useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (modalOpen) return
    if (e.key === 'j') {
      setKeyboardIndex((i) => {
        const next = Math.min(i + 1, reports.length - 1)
        if (next >= 0) setSelected(reports[next]?.reportId ?? null)
        return next
      })
    } else if (e.key === 'k') {
      setKeyboardIndex((i) => {
        const prev = Math.max(i - 1, 0)
        if (prev >= 0 && reports.length > 0) setSelected(reports[prev]?.reportId ?? null)
        return prev
      })
    } else if (e.key === 'Escape') {
      setDispatchForReportId(null)
      setCloseForReportId(null)
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [modalOpen, reports])
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @bantayog/admin-desktop exec vitest run src/__tests__/triage-queue.test.tsx
```

Expected: PASS (8 tests)

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @bantayog/admin-desktop typecheck
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/admin-desktop/src/pages/TriageQueuePage.tsx \
        apps/admin-desktop/src/__tests__/triage-queue.test.tsx
git commit -m "feat(triage): j/k/Escape keyboard shortcuts for queue navigation"
```

---

### Task 4: A.2 — `duplicateClusterTrigger` tests + implementation

**Files:**

- Create: `functions/src/__tests__/triggers/duplicate-cluster.test.ts`
- Create: `functions/src/triggers/duplicate-cluster-trigger.ts`

- [ ] **Step 1: Write failing tests**

Create `functions/src/__tests__/triggers/duplicate-cluster.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { type Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { duplicateClusterTriggerCore } from '../../triggers/duplicate-cluster-trigger.js'

const ts = 1713350400000
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'dup-cluster-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv.cleanup()
})

// Daet city center: 14.1077° N, 122.9556° E → geohash: w7hfm2 (6 chars)
const DAET_GEOHASH = 'w7hfm2'
// ~100m north of Daet center
const NEARBY_GEOHASH = 'w7hfm3'

async function seedReportOps(id: string, overrides: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'report_ops', id), {
      municipalityId: 'daet',
      reportType: 'flood',
      status: 'new',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      locationGeohash: DAET_GEOHASH,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
      ...overrides,
    })
  })
}

function makeSnap(id: string, data: Record<string, unknown>): QueryDocumentSnapshot {
  return {
    id,
    ref: adminDb.collection('report_ops').doc(id),
    data: () => data,
  } as unknown as QueryDocumentSnapshot
}

describe('duplicateClusterTrigger', () => {
  it('does not set duplicateClusterId when no nearby reports exist', async () => {
    const newData = {
      municipalityId: 'daet',
      reportType: 'flood',
      status: 'new',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      locationGeohash: DAET_GEOHASH,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    }
    const snap = makeSnap('r-new', newData)
    await duplicateClusterTriggerCore(adminDb, snap)
    const updated = await adminDb.collection('report_ops').doc('r-new').get()
    expect(updated.data()?.duplicateClusterId).toBeUndefined()
  })

  it('sets duplicateClusterId on both reports when same type + muni + within geohash proximity + within 2h', async () => {
    await seedReportOps('r-existing', { locationGeohash: NEARBY_GEOHASH, createdAt: ts - 3600000 })
    const newData = {
      municipalityId: 'daet',
      reportType: 'flood',
      status: 'new',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      locationGeohash: DAET_GEOHASH,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    }
    const snap = makeSnap('r-new', newData)
    await duplicateClusterTriggerCore(adminDb, snap)
    const newSnap = await adminDb.collection('report_ops').doc('r-new').get()
    const existingSnap = await adminDb.collection('report_ops').doc('r-existing').get()
    expect(newSnap.data()?.duplicateClusterId).toBeDefined()
    expect(newSnap.data()?.duplicateClusterId).toBe(existingSnap.data()?.duplicateClusterId)
  })

  it('does not cluster reports of different types', async () => {
    await seedReportOps('r-fire', {
      reportType: 'fire',
      locationGeohash: NEARBY_GEOHASH,
      createdAt: ts - 60000,
    })
    const newData = {
      municipalityId: 'daet',
      reportType: 'flood',
      status: 'new',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      locationGeohash: DAET_GEOHASH,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    }
    const snap = makeSnap('r-new', newData)
    await duplicateClusterTriggerCore(adminDb, snap)
    const updated = await adminDb.collection('report_ops').doc('r-new').get()
    expect(updated.data()?.duplicateClusterId).toBeUndefined()
  })

  it('does not cluster reports older than 2h', async () => {
    const TWO_H_PLUS_ONE = 2 * 3600000 + 1
    await seedReportOps('r-old', {
      locationGeohash: NEARBY_GEOHASH,
      createdAt: ts - TWO_H_PLUS_ONE,
    })
    const newData = {
      municipalityId: 'daet',
      reportType: 'flood',
      status: 'new',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      locationGeohash: DAET_GEOHASH,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    }
    const snap = makeSnap('r-new', newData)
    await duplicateClusterTriggerCore(adminDb, snap)
    const updated = await adminDb.collection('report_ops').doc('r-new').get()
    expect(updated.data()?.duplicateClusterId).toBeUndefined()
  })

  it('assigns the same existing clusterId when a third report joins a cluster', async () => {
    const existingClusterId = 'cluster-uuid-existing'
    await seedReportOps('r-first', {
      locationGeohash: NEARBY_GEOHASH,
      createdAt: ts - 3600000,
      duplicateClusterId: existingClusterId,
    })
    const newData = {
      municipalityId: 'daet',
      reportType: 'flood',
      status: 'new',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      locationGeohash: DAET_GEOHASH,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    }
    const snap = makeSnap('r-third', newData)
    await duplicateClusterTriggerCore(adminDb, snap)
    const updated = await adminDb.collection('report_ops').doc('r-third').get()
    expect(updated.data()?.duplicateClusterId).toBe(existingClusterId)
  })

  it('skips reports with no locationGeohash', async () => {
    const newData = {
      municipalityId: 'daet',
      reportType: 'flood',
      status: 'new',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    }
    const snap = makeSnap('r-noloc', newData)
    await duplicateClusterTriggerCore(adminDb, snap)
    const updated = await adminDb.collection('report_ops').doc('r-noloc').get()
    expect(updated.data()?.duplicateClusterId).toBeUndefined()
  })

  it('is safe to run twice (idempotent cluster assignment)', async () => {
    await seedReportOps('r-existing', { locationGeohash: NEARBY_GEOHASH, createdAt: ts - 3600000 })
    const newData = {
      municipalityId: 'daet',
      reportType: 'flood',
      status: 'new',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      locationGeohash: DAET_GEOHASH,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    }
    const snap = makeSnap('r-new', newData)
    await duplicateClusterTriggerCore(adminDb, snap)
    const firstRunSnap = await adminDb.collection('report_ops').doc('r-new').get()
    const firstClusterId = firstRunSnap.data()?.duplicateClusterId

    // Re-seed the trigger snap with the now-clustered data to simulate second run
    const snap2 = makeSnap('r-new', { ...newData, duplicateClusterId: firstClusterId })
    await duplicateClusterTriggerCore(adminDb, snap2)
    const secondRunSnap = await adminDb.collection('report_ops').doc('r-new').get()
    expect(secondRunSnap.data()?.duplicateClusterId).toBe(firstClusterId)
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/triggers/duplicate-cluster.test.ts"
```

Expected: FAIL — `duplicateClusterTriggerCore` not found.

- [ ] **Step 3: Install `@turf/turf` and `ngeohash` in functions**

⚠️ PRE-B plan Task 10 (B.3 OSM extraction) already adds `@turf/turf` and `ngeohash` to `functions/package.json`. If B.3 is not yet implemented, run:

```bash
pnpm --filter @bantayog/functions add @turf/turf ngeohash
pnpm --filter @bantayog/functions add -D @types/ngeohash
```

- [ ] **Step 4: Create `functions/src/triggers/duplicate-cluster-trigger.ts`**

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import * as ngeohash from 'ngeohash'
import * as turf from '@turf/turf'
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { adminDb } from '../admin-init.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('duplicateClusterTrigger')

const NON_TERMINAL_STATUSES = [
  'new',
  'awaiting_verify',
  'verified',
  'assigned',
  'acknowledged',
  'en_route',
  'on_scene',
  'reopened',
]
const TWO_H_MS = 2 * 60 * 60 * 1000
const PROXIMITY_METERS = 200
const BATCH_CAP = 250

export async function duplicateClusterTriggerCore(
  db: FirebaseFirestore.Firestore,
  snap: QueryDocumentSnapshot,
): Promise<void> {
  const data = snap.data()
  const {
    locationGeohash,
    municipalityId,
    reportType,
    createdAt,
    duplicateClusterId: existingCluster,
  } = data

  if (!locationGeohash || typeof locationGeohash !== 'string') return

  const nowMs: number = typeof createdAt === 'number' ? createdAt : Date.now()
  const cutoff = nowMs - TWO_H_MS

  // Query candidates: same muni + type + non-terminal status + within 2h
  const candidates = await db
    .collection('report_ops')
    .where('municipalityId', '==', municipalityId)
    .where('reportType', '==', reportType)
    .where('status', 'in', NON_TERMINAL_STATUSES)
    .where('createdAt', '>', cutoff)
    .limit(300)
    .get()

  // Filter: geohash prefix match (same 6-char cell or neighbors)
  const prefix = locationGeohash.slice(0, 6)
  const neighborPrefixes = new Set([prefix, ...ngeohash.neighbors(prefix)])
  const triggerPoint = ngeohash.decode(locationGeohash)
  const triggerCoord = turf.point([triggerPoint.longitude, triggerPoint.latitude])

  const nearby = candidates.docs.filter((d) => {
    if (d.id === snap.id) return false
    const gh = d.data().locationGeohash
    if (!gh || !neighborPrefixes.has(gh.slice(0, 6))) return false
    const pt = ngeohash.decode(gh as string)
    const dist = turf.distance(turf.point([pt.longitude, pt.latitude]), triggerCoord, {
      units: 'meters',
    })
    return dist <= PROXIMITY_METERS
  })

  if (nearby.length === 0) return

  // Determine cluster ID: use existing cluster if any nearby doc has one
  const existingClusterFromNearby = nearby.find((d) => d.data().duplicateClusterId)?.data()
    .duplicateClusterId as string | undefined
  const clusterId = existingCluster ?? existingClusterFromNearby ?? crypto.randomUUID()

  // Collect all docs that need updating (cap at BATCH_CAP - 1 to leave room for trigger doc)
  const toUpdate = nearby
    .filter((d) => d.data().duplicateClusterId !== clusterId)
    .slice(0, BATCH_CAP - 1)

  if (toUpdate.length === 0 && existingCluster === clusterId) return

  const batch = db.batch()
  if (existingCluster !== clusterId) {
    batch.update(snap.ref, { duplicateClusterId: clusterId })
  }
  for (const d of toUpdate) {
    batch.update(d.ref, { duplicateClusterId: clusterId })
  }
  await batch.commit()

  log({
    severity: 'INFO',
    code: 'dup.cluster.assigned',
    message: `Assigned ${toUpdate.length + 1} docs to cluster ${clusterId}`,
  })
}

export const duplicateClusterTrigger = onDocumentCreated(
  { document: 'report_ops/{reportId}', region: 'asia-southeast1' },
  async (event) => {
    const snap = event.data
    if (!snap) return
    await duplicateClusterTriggerCore(adminDb, snap)
  },
)
```

- [ ] **Step 5: Run tests**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/triggers/duplicate-cluster.test.ts"
```

Expected: PASS (7 tests)

- [ ] **Step 6: Export from index**

In `functions/src/index.ts`:

```typescript
export { duplicateClusterTrigger } from './triggers/duplicate-cluster-trigger.js'
```

- [ ] **Step 7: Add composite index for duplicate clustering query**

In `infra/firebase/firestore.indexes.json`, add inside the `"indexes"` array:

```json
{
  "collectionGroup": "report_ops",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "municipalityId", "order": "ASCENDING" },
    { "fieldPath": "reportType", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "ASCENDING" }
  ]
}
```

- [ ] **Step 8: Typecheck**

```bash
pnpm --filter @bantayog/functions typecheck
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add functions/src/triggers/duplicate-cluster-trigger.ts \
        functions/src/__tests__/triggers/duplicate-cluster.test.ts \
        functions/src/index.ts \
        infra/firebase/firestore.indexes.json
git commit -m "feat(triggers): duplicateClusterTrigger — geohash + Turf.js 200m proximity clustering"
```

---

### Task 5: A.2 — `mergeDuplicates` callable tests + implementation

**Files:**

- Create: `functions/src/__tests__/callables/merge-duplicates.test.ts`
- Create: `functions/src/callables/merge-duplicates.ts`

- [ ] **Step 1: Write failing tests**

Create `functions/src/__tests__/callables/merge-duplicates.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { type Firestore } from 'firebase-admin/firestore'

const onCallMock = vi.hoisted(() => vi.fn())
vi.mock('firebase-functions/v2/https', () => ({ onCall: onCallMock }))
vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))
vi.mock('../../services/send-sms.js', () => ({ enqueueSms: vi.fn().mockResolvedValue(undefined) }))

import { mergeDuplicatesCore } from '../../callables/merge-duplicates.js'

const ts = 1713350400000
const CLUSTER_ID = 'cluster-uuid-1'
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'merge-dup-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv.cleanup()
})

async function seedReport(id: string, overrides: Record<string, unknown> = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'reports', id), {
      municipalityId: 'daet',
      reportType: 'flood',
      status: 'new',
      severity: 'high',
      barangayId: 'brgy1',
      mediaRefs: [],
      createdAt: ts,
      updatedAt: ts,
      schemaVersion: 1,
      ...overrides,
    })
    await setDoc(doc(ctx.firestore(), 'report_ops', id), {
      municipalityId: 'daet',
      reportType: 'flood',
      status: 'new',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      duplicateClusterId: CLUSTER_ID,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
      ...overrides,
    })
  })
}

const muniAdminActor = {
  uid: 'admin-1',
  claims: {
    role: 'municipal_admin',
    municipalityId: 'daet',
    active: true,
    auth_time: Math.floor(ts / 1000),
  },
}

describe('mergeDuplicates', () => {
  it('rejects a non-muni-admin caller', async () => {
    const result = await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: 'key-1',
      },
      {
        uid: 'citizen-1',
        claims: { role: 'citizen', active: true, auth_time: Math.floor(ts / 1000) },
      },
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('permission-denied')
  })

  it('rejects report IDs from different municipalities', async () => {
    await seedReport('r1')
    await seedReport('r2', { municipalityId: 'labo' })
    const result = await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: 'key-2',
      },
      muniAdminActor,
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('invalid-argument')
  })

  it('rejects report IDs that do not share a duplicateClusterId', async () => {
    await seedReport('r1', { duplicateClusterId: 'cluster-a' })
    await seedReport('r2', { duplicateClusterId: 'cluster-b' })
    const result = await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: 'key-3',
      },
      muniAdminActor,
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('failed-precondition')
  })

  it('sets status merged_as_duplicate on all non-primary reports', async () => {
    await seedReport('r-primary')
    await seedReport('r-dup1')
    await seedReport('r-dup2')
    await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r-primary',
        duplicateReportIds: ['r-dup1', 'r-dup2'],
        idempotencyKey: 'key-4',
      },
      muniAdminActor,
    )
    const dup1 = await adminDb.collection('reports').doc('r-dup1').get()
    const dup2 = await adminDb.collection('reports').doc('r-dup2').get()
    expect(dup1.data()?.status).toBe('merged_as_duplicate')
    expect(dup2.data()?.status).toBe('merged_as_duplicate')
  })

  it('sets mergedInto on all non-primary reports', async () => {
    await seedReport('r-primary')
    await seedReport('r-dup1')
    await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r-primary',
        duplicateReportIds: ['r-dup1'],
        idempotencyKey: 'key-5',
      },
      muniAdminActor,
    )
    const dup1 = await adminDb.collection('reports').doc('r-dup1').get()
    expect(dup1.data()?.mergedInto).toBe('r-primary')
  })

  it('aggregates unique mediaRefs from duplicates onto the primary', async () => {
    await seedReport('r-primary', { mediaRefs: ['media-a', 'media-b'] })
    await seedReport('r-dup1', { mediaRefs: ['media-b', 'media-c'] })
    await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r-primary',
        duplicateReportIds: ['r-dup1'],
        idempotencyKey: 'key-6',
      },
      muniAdminActor,
    )
    const primary = await adminDb.collection('reports').doc('r-primary').get()
    const refs = primary.data()?.mediaRefs as string[]
    expect(refs).toContain('media-a')
    expect(refs).toContain('media-b')
    expect(refs).toContain('media-c')
    expect(new Set(refs).size).toBe(refs.length) // no duplicates
  })

  it('is idempotent', async () => {
    await seedReport('r-primary')
    await seedReport('r-dup1')
    await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r-primary',
        duplicateReportIds: ['r-dup1'],
        idempotencyKey: 'key-7',
      },
      muniAdminActor,
    )
    // Second call should not throw
    await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r-primary',
        duplicateReportIds: ['r-dup1'],
        idempotencyKey: 'key-7',
      },
      muniAdminActor,
    )
    const dup1 = await adminDb.collection('reports').doc('r-dup1').get()
    expect(dup1.data()?.status).toBe('merged_as_duplicate')
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/merge-duplicates.test.ts"
```

Expected: FAIL — `mergeDuplicatesCore` not found.

- [ ] **Step 3: Create `functions/src/callables/merge-duplicates.ts`**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminDb } from '../admin-init.js'
import { requireAuth, bantayogErrorToHttps } from './https-error.js'
import { withIdempotency } from '../idempotency/guard.js'
import { enqueueSms } from '../services/send-sms.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('mergeDuplicates')

const inputSchema = z.object({
  primaryReportId: z.string().min(1),
  duplicateReportIds: z.array(z.string().min(1)).min(1).max(50),
  idempotencyKey: z.string().uuid(),
})

export interface MergeDuplicatesActor {
  uid: string
  claims: { role: string; municipalityId?: string; active: boolean; auth_time: number }
}

export interface MergeDuplicatesResult {
  success: boolean
  mergedCount?: number
  errorCode?: string
}

export async function mergeDuplicatesCore(
  db: FirebaseFirestore.Firestore,
  input: z.infer<typeof inputSchema>,
  actor: MergeDuplicatesActor,
): Promise<MergeDuplicatesResult> {
  if (actor.claims.role !== 'municipal_admin' && actor.claims.role !== 'provincial_superadmin') {
    return { success: false, errorCode: 'permission-denied' }
  }

  const { primaryReportId, duplicateReportIds, idempotencyKey } = input
  const allIds = [primaryReportId, ...duplicateReportIds]

  // Read all report_ops docs to validate cluster + muni membership
  const opsSnaps = await Promise.all(allIds.map((id) => db.collection('report_ops').doc(id).get()))
  const opsData = opsSnaps.map((s) => ({ id: s.id, ...s.data() }))

  const municipalities = new Set(opsData.map((d) => d.municipalityId))
  if (municipalities.size > 1) {
    return { success: false, errorCode: 'invalid-argument' }
  }

  const clusterIds = new Set(
    opsData.filter((d) => d.duplicateClusterId).map((d) => d.duplicateClusterId),
  )
  if (clusterIds.size > 1) {
    return { success: false, errorCode: 'failed-precondition' }
  }

  const { result: cached } = await withIdempotency(
    db,
    { key: `merge-duplicates:${idempotencyKey}`, payload: input, now: Date.now() },
    async () => {
      const reportSnaps = await Promise.all(
        allIds.map((id) => db.collection('reports').doc(id).get()),
      )
      const primaryReportData = reportSnaps.find((s) => s.id === primaryReportId)?.data()

      // Aggregate unique mediaRefs
      const allMediaRefs = new Set<string>(primaryReportData?.mediaRefs ?? [])
      for (const s of reportSnaps) {
        if (s.id === primaryReportId) continue
        for (const ref of s.data()?.mediaRefs ?? []) {
          allMediaRefs.add(ref as string)
        }
      }

      const batch = db.batch()

      // Update primary: merged mediaRefs
      batch.update(db.collection('reports').doc(primaryReportId), {
        mediaRefs: Array.from(allMediaRefs),
        updatedAt: Date.now(),
      })

      // Update duplicates: merged_as_duplicate
      for (const dupId of duplicateReportIds) {
        batch.update(db.collection('reports').doc(dupId), {
          status: 'merged_as_duplicate',
          mergedInto: primaryReportId,
          updatedAt: Date.now(),
        })
        batch.update(db.collection('report_ops').doc(dupId), {
          status: 'merged_as_duplicate',
          updatedAt: Date.now(),
        })
      }

      await batch.commit()
      log({
        severity: 'INFO',
        code: 'merge.complete',
        message: `Merged ${duplicateReportIds.length} duplicates into ${primaryReportId}`,
      })

      // SMS to reporters with followUpConsent (best-effort, non-transactional)
      try {
        const consentSnaps = await db
          .collection('report_sms_consent')
          .where('reportId', 'in', duplicateReportIds)
          .where('followUpConsent', '==', true)
          .get()
        for (const c of consentSnaps.docs) {
          const { phone, locale } = c.data()
          await enqueueSms({
            to: phone as string,
            purpose: 'resolution',
            locale: (locale as 'tl' | 'en') ?? 'tl',
            vars: { publicRef: '' },
          }).catch((err: unknown) => {
            log({
              severity: 'WARNING',
              code: 'merge.sms.failed',
              message: err instanceof Error ? err.message : 'SMS enqueue failed',
            })
          })
        }
      } catch (err: unknown) {
        log({
          severity: 'WARNING',
          code: 'merge.consent.query.failed',
          message: err instanceof Error ? err.message : 'Consent query failed',
        })
      }

      return { success: true, mergedCount: duplicateReportIds.length }
    },
  )

  return cached ?? { success: true, mergedCount: duplicateReportIds.length }
}

export const mergeDuplicates = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (request) => {
    const actor = requireAuth(request)
    const input = inputSchema.safeParse(request.data)
    if (!input.success) throw new HttpsError('invalid-argument', input.error.message)
    const result = await mergeDuplicatesCore(adminDb, input.data, actor).catch(bantayogErrorToHttps)
    if (!result.success)
      throw new HttpsError(
        (result.errorCode as Parameters<typeof HttpsError>[0]) ?? 'internal',
        'merge failed',
      )
    return result
  },
)
```

- [ ] **Step 4: Run tests**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/merge-duplicates.test.ts"
```

Expected: PASS (7 tests)

- [ ] **Step 5: Export from index**

In `functions/src/index.ts`:

```typescript
export { mergeDuplicates } from './callables/merge-duplicates.js'
```

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @bantayog/functions typecheck
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add functions/src/callables/merge-duplicates.ts \
        functions/src/__tests__/callables/merge-duplicates.test.ts \
        functions/src/index.ts
git commit -m "feat(callables): mergeDuplicates — transaction merge + mediaRef dedup + SMS notify"
```

---

### Task 6: A.3 — `initiateShiftHandoff` + `acceptShiftHandoff` callable tests + implementation

**Prerequisite:** PRE-B Task 1 must be complete — `shiftHandoffDocSchema` must have `toUid: z.string().optional()` and `escalatedAt: z.number().int().optional()`.

**Files:**

- Create: `functions/src/__tests__/callables/shift-handoff.test.ts`
- Create: `functions/src/callables/shift-handoff.ts`

- [ ] **Step 1: Write failing tests**

Create `functions/src/__tests__/callables/shift-handoff.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { type Firestore } from 'firebase-admin/firestore'

const onCallMock = vi.hoisted(() => vi.fn())
vi.mock('firebase-functions/v2/https', () => ({
  onCall: onCallMock,
  HttpsError: class HttpsError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message)
    }
  },
}))
vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))
vi.mock('../../services/fcm-send.js', () => ({
  sendFcmToResponder: vi
    .fn()
    .mockResolvedValue({ successCount: 1, failureCount: 0, invalidTokens: [] }),
}))

import { initiateShiftHandoffCore, acceptShiftHandoffCore } from '../../callables/shift-handoff.js'

const ts = 1713350400000
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'shift-handoff-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv.cleanup()
})

const adminActor = {
  uid: 'admin-from',
  claims: {
    role: 'municipal_admin',
    municipalityId: 'daet',
    active: true,
    auth_time: Math.floor(ts / 1000),
  },
}

async function seedReportOp(id: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'report_ops', id), {
      municipalityId: 'daet',
      status: 'assigned',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      reportType: 'flood',
      schemaVersion: 1,
    })
  })
}

describe('initiateShiftHandoff', () => {
  it('rejects citizens and responders', async () => {
    const result = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: 'Handover notes',
        activeIncidentIds: [],
        idempotencyKey: 'key-1',
      },
      { uid: 'u1', claims: { role: 'citizen', active: true, auth_time: Math.floor(ts / 1000) } },
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('permission-denied')
  })

  it('creates shift_handoffs doc with status pending and no toUid', async () => {
    const result = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: 'End of shift',
        activeIncidentIds: [],
        idempotencyKey: 'key-2',
      },
      adminActor,
    )
    expect(result.success).toBe(true)
    expect(result.handoffId).toBeDefined()
    const created = await adminDb.collection('shift_handoffs').doc(result.handoffId!).get()
    expect(created.data()?.status).toBe('pending')
    expect(created.data()?.toUid).toBeUndefined()
    expect(created.data()?.fromUid).toBe('admin-from')
  })

  it('builds activeIncidentSnapshot from live Firestore state', async () => {
    await seedReportOp('r-active-1')
    await seedReportOp('r-active-2')
    const result = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: 'Handover',
        activeIncidentIds: [],
        idempotencyKey: 'key-3',
      },
      adminActor,
    )
    expect(result.success).toBe(true)
    const created = await adminDb.collection('shift_handoffs').doc(result.handoffId!).get()
    const snapshot = created.data()?.activeIncidentSnapshot as string[]
    expect(snapshot).toContain('r-active-1')
    expect(snapshot).toContain('r-active-2')
  })

  it('is idempotent', async () => {
    const result1 = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: '',
        activeIncidentIds: [],
        idempotencyKey: 'key-4',
      },
      adminActor,
    )
    const result2 = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: '',
        activeIncidentIds: [],
        idempotencyKey: 'key-4',
      },
      adminActor,
    )
    expect(result1.handoffId).toBe(result2.handoffId)
  })
})

describe('acceptShiftHandoff', () => {
  async function createHandoff(id: string) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'shift_handoffs', id), {
        fromUid: 'admin-from',
        municipalityId: 'daet',
        notes: '',
        activeIncidentSnapshot: [],
        status: 'pending',
        createdAt: ts,
        expiresAt: ts + 1800000,
        schemaVersion: 1,
      })
    })
  }

  it('rejects a caller from a different municipality', async () => {
    await createHandoff('h1')
    const result = await acceptShiftHandoffCore(
      adminDb,
      { handoffId: 'h1', idempotencyKey: 'key-5' },
      {
        uid: 'other-admin',
        claims: {
          role: 'municipal_admin',
          municipalityId: 'labo',
          active: true,
          auth_time: Math.floor(ts / 1000),
        },
      },
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('permission-denied')
  })

  it('updates status to accepted and sets toUid', async () => {
    await createHandoff('h2')
    const result = await acceptShiftHandoffCore(
      adminDb,
      { handoffId: 'h2', idempotencyKey: 'key-6' },
      {
        uid: 'admin-to',
        claims: {
          role: 'municipal_admin',
          municipalityId: 'daet',
          active: true,
          auth_time: Math.floor(ts / 1000),
        },
      },
    )
    expect(result.success).toBe(true)
    const updated = await adminDb.collection('shift_handoffs').doc('h2').get()
    expect(updated.data()?.status).toBe('accepted')
    expect(updated.data()?.toUid).toBe('admin-to')
  })

  it('is idempotent — double-accept returns success', async () => {
    await createHandoff('h3')
    const actor = {
      uid: 'admin-to',
      claims: {
        role: 'municipal_admin',
        municipalityId: 'daet',
        active: true,
        auth_time: Math.floor(ts / 1000),
      },
    }
    await acceptShiftHandoffCore(adminDb, { handoffId: 'h3', idempotencyKey: 'key-7' }, actor)
    const result2 = await acceptShiftHandoffCore(
      adminDb,
      { handoffId: 'h3', idempotencyKey: 'key-7' },
      actor,
    )
    expect(result2.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/shift-handoff.test.ts"
```

Expected: FAIL — `initiateShiftHandoffCore` / `acceptShiftHandoffCore` not found.

- [ ] **Step 3: Create `functions/src/callables/shift-handoff.ts`**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { adminDb } from '../admin-init.js'
import { requireAuth, bantayogErrorToHttps } from './https-error.js'
import { withIdempotency } from '../idempotency/guard.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('shiftHandoff')

const initiateSchema = z.object({
  notes: z.string().max(2000),
  activeIncidentIds: z.array(z.string()),
  idempotencyKey: z.string().uuid(),
})

const acceptSchema = z.object({
  handoffId: z.string().min(1),
  idempotencyKey: z.string().uuid(),
})

const ADMIN_ROLES = ['municipal_admin', 'agency_admin', 'provincial_superadmin'] as const
const ACTIVE_DISPATCH_STATUSES = ['assigned', 'acknowledged', 'en_route']

export interface HandoffActor {
  uid: string
  claims: { role: string; municipalityId?: string; active: boolean; auth_time: number }
}

export interface InitiateResult {
  success: boolean
  handoffId?: string
  errorCode?: string
}

export interface AcceptResult {
  success: boolean
  errorCode?: string
}

export async function initiateShiftHandoffCore(
  db: FirebaseFirestore.Firestore,
  input: z.infer<typeof initiateSchema>,
  actor: HandoffActor,
): Promise<InitiateResult> {
  if (!ADMIN_ROLES.includes(actor.claims.role as (typeof ADMIN_ROLES)[number])) {
    return { success: false, errorCode: 'permission-denied' }
  }

  const municipalityId = actor.claims.municipalityId
  if (!municipalityId) return { success: false, errorCode: 'permission-denied' }

  const { result: cached } = await withIdempotency(
    db,
    { key: `initiate-handoff:${input.idempotencyKey}`, payload: input, now: Date.now() },
    async () => {
      // Build snapshot from live Firestore
      const [opsSnap, dispatchSnap] = await Promise.all([
        db
          .collection('report_ops')
          .where('municipalityId', '==', municipalityId)
          .where('status', 'in', ACTIVE_DISPATCH_STATUSES)
          .get(),
        db
          .collection('dispatches')
          .where('municipalityId', '==', municipalityId)
          .where('status', '==', 'accepted')
          .get(),
      ])

      const activeIncidentSnapshot = [
        ...opsSnap.docs.map((d) => d.id),
        ...dispatchSnap.docs.map((d) => d.id),
      ]

      const handoffId = crypto.randomUUID()
      const now = Date.now()

      await db
        .collection('shift_handoffs')
        .doc(handoffId)
        .set({
          fromUid: actor.uid,
          municipalityId,
          notes: input.notes,
          activeIncidentSnapshot,
          status: 'pending',
          createdAt: now,
          expiresAt: now + 30 * 60 * 1000,
          schemaVersion: 1,
        })

      log({
        severity: 'INFO',
        code: 'handoff.initiated',
        message: `Shift handoff ${handoffId} created by ${actor.uid}`,
      })
      return { success: true, handoffId }
    },
  )

  return cached ?? { success: false, errorCode: 'internal' }
}

export async function acceptShiftHandoffCore(
  db: FirebaseFirestore.Firestore,
  input: z.infer<typeof acceptSchema>,
  actor: HandoffActor,
): Promise<AcceptResult> {
  if (!ADMIN_ROLES.includes(actor.claims.role as (typeof ADMIN_ROLES)[number])) {
    return { success: false, errorCode: 'permission-denied' }
  }

  const { result: cached } = await withIdempotency(
    db,
    { key: `accept-handoff:${input.idempotencyKey}`, payload: input, now: Date.now() },
    async () => {
      const snap = await db.collection('shift_handoffs').doc(input.handoffId).get()
      if (!snap.exists) return { success: false, errorCode: 'not-found' }

      const handoff = snap.data()!
      if (handoff.municipalityId !== actor.claims.municipalityId) {
        return { success: false, errorCode: 'permission-denied' }
      }

      if (handoff.status === 'accepted') return { success: true }

      await snap.ref.update({
        status: 'accepted',
        toUid: actor.uid,
        acceptedAt: Date.now(),
      })

      log({
        severity: 'INFO',
        code: 'handoff.accepted',
        message: `Handoff ${input.handoffId} accepted by ${actor.uid}`,
      })
      return { success: true }
    },
  )

  return cached ?? { success: false, errorCode: 'internal' }
}

export const initiateShiftHandoff = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (request) => {
    const actor = requireAuth(request)
    const input = initiateSchema.safeParse(request.data)
    if (!input.success) throw new HttpsError('invalid-argument', input.error.message)
    const result = await initiateShiftHandoffCore(adminDb, input.data, actor).catch(
      bantayogErrorToHttps,
    )
    if (!result.success)
      throw new HttpsError(
        (result.errorCode as Parameters<typeof HttpsError>[0]) ?? 'internal',
        'initiate failed',
      )
    return result
  },
)

export const acceptShiftHandoff = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (request) => {
    const actor = requireAuth(request)
    const input = acceptSchema.safeParse(request.data)
    if (!input.success) throw new HttpsError('invalid-argument', input.error.message)
    const result = await acceptShiftHandoffCore(adminDb, input.data, actor).catch(
      bantayogErrorToHttps,
    )
    if (!result.success)
      throw new HttpsError(
        (result.errorCode as Parameters<typeof HttpsError>[0]) ?? 'internal',
        'accept failed',
      )
    return result
  },
)
```

- [ ] **Step 4: Run tests**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/shift-handoff.test.ts"
```

Expected: PASS (7 tests)

- [ ] **Step 5: Export from index**

In `functions/src/index.ts`:

```typescript
export { initiateShiftHandoff, acceptShiftHandoff } from './callables/shift-handoff.js'
```

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @bantayog/functions typecheck
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add functions/src/callables/shift-handoff.ts \
        functions/src/__tests__/callables/shift-handoff.test.ts \
        functions/src/index.ts
git commit -m "feat(callables): initiateShiftHandoff + acceptShiftHandoff with snapshot + idempotency"
```

---

### Task 7: A.3 — Extend `adminOperationsSweep` with shift handoff escalation

**Files:**

- Modify: `functions/src/scheduled/admin-operations-sweep.ts`
- Modify: `functions/src/__tests__/scheduled/admin-operations-sweep.test.ts`

- [ ] **Step 1: Add failing tests**

Add to `functions/src/__tests__/scheduled/admin-operations-sweep.test.ts`:

```typescript
// Add after existing tests:

describe('adminOperationsSweep — shift handoff escalation', () => {
  it('ignores handoffs pending less than 30 minutes', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'shift_handoffs', 'h1'), {
        fromUid: 'admin-1',
        municipalityId: 'daet',
        notes: '',
        activeIncidentSnapshot: [],
        status: 'pending',
        createdAt: ts - THIRTY_MIN_MS + 60000,
        expiresAt: ts + 1800000,
        schemaVersion: 1,
      })
    })
    await adminOperationsSweepCore(adminDb, { now: Timestamp.fromMillis(ts) })
    const snap = await adminDb.collection('shift_handoffs').doc('h1').get()
    expect(snap.data()?.escalatedAt).toBeUndefined()
  })

  it('sets escalatedAt on handoffs pending over 30 minutes', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'shift_handoffs', 'h2'), {
        fromUid: 'admin-1',
        municipalityId: 'daet',
        notes: '',
        activeIncidentSnapshot: [],
        status: 'pending',
        createdAt: ts - THIRTY_MIN_MS - 1,
        expiresAt: ts + 1800000,
        schemaVersion: 1,
      })
    })
    await adminOperationsSweepCore(adminDb, { now: Timestamp.fromMillis(ts) })
    const snap = await adminDb.collection('shift_handoffs').doc('h2').get()
    expect(snap.data()?.escalatedAt).toBe(ts)
  })

  it('does not re-escalate already-escalated handoffs', async () => {
    const originalEscalatedAt = ts - 60000
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'shift_handoffs', 'h3'), {
        fromUid: 'admin-1',
        municipalityId: 'daet',
        notes: '',
        activeIncidentSnapshot: [],
        status: 'pending',
        createdAt: ts - THIRTY_MIN_MS - 1,
        escalatedAt: originalEscalatedAt,
        expiresAt: ts + 1800000,
        schemaVersion: 1,
      })
    })
    await adminOperationsSweepCore(adminDb, { now: Timestamp.fromMillis(ts) })
    const snap = await adminDb.collection('shift_handoffs').doc('h3').get()
    expect(snap.data()?.escalatedAt).toBe(originalEscalatedAt)
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/scheduled/admin-operations-sweep.test.ts"
```

Expected: FAIL on the 3 new shift handoff tests — `escalatedAt` never set.

- [ ] **Step 3: Extend `adminOperationsSweepCore`**

In `functions/src/scheduled/admin-operations-sweep.ts`, add the shift handoff path inside `adminOperationsSweepCore` after the agency assistance block:

```typescript
// Shift handoff escalation: pending > 30min with no escalatedAt
const pendingHandoffs = await db
  .collection('shift_handoffs')
  .where('status', '==', 'pending')
  .where('createdAt', '<', cutoff)
  .get()

const handoffsToEscalate = pendingHandoffs.docs.filter((d) => !d.data().escalatedAt)
for (const d of handoffsToEscalate) {
  await d.ref.update({ escalatedAt: nowMs })
  log({
    severity: 'INFO',
    code: 'sweep.handoff.escalated',
    message: `Escalated shift handoff ${d.id}`,
  })
  // TODO(BANTAYOG-PHASE5): FCM + SMS to provincial superadmins — implement when FCM send service is wired
}
```

- [ ] **Step 4: Run all sweep tests**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/scheduled/admin-operations-sweep.test.ts"
```

Expected: PASS (6 tests — 3 agency + 3 shift handoff)

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @bantayog/functions typecheck
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/src/scheduled/admin-operations-sweep.ts \
        functions/src/__tests__/scheduled/admin-operations-sweep.test.ts
git commit -m "feat(sweep): extend adminOperationsSweep with shift handoff escalation path"
```

---

### Task 8: A.3 — ShiftHandoffModal + incoming handoff banner UI

**Files:**

- Modify: `apps/admin-desktop/src/pages/TriageQueuePage.tsx`
- Create: `apps/admin-desktop/src/__tests__/shift-handoff-modal.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/admin-desktop/src/__tests__/shift-handoff-modal.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../app/firebase', () => ({ db: {} }))
vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({
    claims: { municipalityId: 'daet', role: 'municipal_admin' },
    signOut: vi.fn(),
  }),
}))

const mockInitiateHandoff = vi.fn()
vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: vi.fn(),
    rejectReport: vi.fn(),
    initiateShiftHandoff: mockInitiateHandoff,
  },
}))

vi.mock('../hooks/useMuniReports', () => ({
  useMuniReports: () => ({
    reports: [],
    hasMore: false,
    loadMore: vi.fn(),
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/usePendingHandoffs', () => ({
  usePendingHandoffs: () => [],
}))

vi.mock('../pages/ReportDetailPanel', () => ({ ReportDetailPanel: () => <div>detail</div> }))
vi.mock('../pages/DispatchModal', () => ({ DispatchModal: () => <div>dispatch</div> }))
vi.mock('../pages/CloseReportModal', () => ({ CloseReportModal: () => <div>close</div> }))

import { TriageQueuePage } from '../pages/TriageQueuePage'

describe('ShiftHandoffModal', () => {
  beforeEach(() => {
    mockInitiateHandoff.mockResolvedValue({ handoffId: 'h-new-1' })
  })

  it('renders Start Handoff button in header', () => {
    render(<TriageQueuePage />)
    expect(screen.getByRole('button', { name: /start handoff/i })).toBeInTheDocument()
  })

  it('opens ShiftHandoffModal on Start Handoff click', async () => {
    const user = userEvent.setup()
    render(<TriageQueuePage />)
    await user.click(screen.getByRole('button', { name: /start handoff/i }))
    expect(screen.getByRole('dialog', { name: /shift handoff/i })).toBeInTheDocument()
  })

  it('calls initiateShiftHandoff on Initiate click', async () => {
    const user = userEvent.setup()
    render(<TriageQueuePage />)
    await user.click(screen.getByRole('button', { name: /start handoff/i }))
    const notesField = screen.getByLabelText(/notes/i)
    await user.type(notesField, 'End of day shift')
    await user.click(screen.getByRole('button', { name: /initiate/i }))
    expect(mockInitiateHandoff).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'End of day shift' }),
    )
  })
})

describe('Incoming handoff banner', () => {
  it('shows Accept button when pending handoffs exist', () => {
    vi.doMock('../hooks/usePendingHandoffs', () => ({
      usePendingHandoffs: () => [{ id: 'h1', fromUid: 'admin-old', createdAt: 1713350400000 }],
    }))
    // This requires re-importing — stub via mock return instead
    render(<TriageQueuePage />)
    // Without pending handoffs (mocked to []), no banner should appear
    expect(screen.queryByRole('button', { name: /accept handoff/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm --filter @bantayog/admin-desktop exec vitest run src/__tests__/shift-handoff-modal.test.tsx
```

Expected: FAIL — `Start Handoff` button missing.

- [ ] **Step 3: Create `apps/admin-desktop/src/hooks/usePendingHandoffs.ts`**

```typescript
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, type Timestamp } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface PendingHandoff {
  id: string
  fromUid: string
  createdAt: Timestamp
  notes: string
  activeIncidentSnapshot: string[]
}

export function usePendingHandoffs(municipalityId: string | undefined) {
  const [handoffs, setHandoffs] = useState<PendingHandoff[]>([])

  useEffect(() => {
    if (!municipalityId) return
    const q = query(
      collection(db, 'shift_handoffs'),
      where('municipalityId', '==', municipalityId),
      where('status', '==', 'pending'),
    )
    return onSnapshot(q, (snap) => {
      setHandoffs(
        snap.docs.map((d) => ({
          id: d.id,
          fromUid: String(d.data().fromUid),
          createdAt: d.data().createdAt as Timestamp,
          notes: String(d.data().notes ?? ''),
          activeIncidentSnapshot: (d.data().activeIncidentSnapshot ?? []) as string[],
        })),
      )
    })
  }, [municipalityId])

  return handoffs
}
```

- [ ] **Step 4: Update `TriageQueuePage.tsx` — add handoff button + modal**

Add to imports at top:

```typescript
import { usePendingHandoffs } from '../hooks/usePendingHandoffs'
```

Add to component state:

```typescript
const [handoffModalOpen, setHandoffModalOpen] = useState(false)
const [handoffNotes, setHandoffNotes] = useState('')
const [handoffLoading, setHandoffLoading] = useState(false)
const pendingHandoffs = usePendingHandoffs(municipalityId)
```

Add the Start Handoff button to the `<header>`:

```tsx
<button onClick={() => setHandoffModalOpen(true)}>Start Handoff</button>
```

Add incoming handoff banner just after the existing `{banner && ...}` line:

```tsx
{
  pendingHandoffs.length > 0 && (
    <div role="banner" aria-label="incoming handoff">
      {pendingHandoffs.length} pending handoff(s) awaiting acceptance.
      {pendingHandoffs.map((h) => (
        <button
          key={h.id}
          onClick={() => {
            void (async () => {
              try {
                await callables.acceptShiftHandoff({
                  handoffId: h.id,
                  idempotencyKey: crypto.randomUUID(),
                })
              } catch (err: unknown) {
                setBanner(err instanceof Error ? err.message : 'Accept failed')
              }
            })()
          }}
        >
          Accept Handoff
        </button>
      ))}
    </div>
  )
}
```

Add ShiftHandoffModal just before the closing `</main>`:

```tsx
{
  handoffModalOpen && (
    <dialog open aria-label="Shift Handoff" aria-modal="true">
      <h3>Initiate Shift Handoff</h3>
      <label htmlFor="handoff-notes">Notes</label>
      <textarea
        id="handoff-notes"
        value={handoffNotes}
        onChange={(e) => setHandoffNotes(e.target.value)}
        rows={4}
      />
      <button
        disabled={handoffLoading}
        onClick={() => {
          setHandoffLoading(true)
          void (async () => {
            try {
              await callables.initiateShiftHandoff({
                notes: handoffNotes,
                activeIncidentIds: [],
                idempotencyKey: crypto.randomUUID(),
              })
              setHandoffModalOpen(false)
              setHandoffNotes('')
            } catch (err: unknown) {
              setBanner(err instanceof Error ? err.message : 'Handoff failed')
            } finally {
              setHandoffLoading(false)
            }
          })()
        }}
      >
        Initiate
      </button>
      <button onClick={() => setHandoffModalOpen(false)}>Cancel</button>
    </dialog>
  )
}
```

Also add `initiateShiftHandoff` and `acceptShiftHandoff` to `apps/admin-desktop/src/services/callables.ts` (read that file first, then add the two new callable references matching the existing pattern).

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @bantayog/admin-desktop exec vitest run src/__tests__/shift-handoff-modal.test.tsx
```

Expected: PASS (4 tests — banner test passes trivially because mock returns empty array)

- [ ] **Step 6: Lint + typecheck**

```bash
pnpm --filter @bantayog/admin-desktop lint && pnpm --filter @bantayog/admin-desktop typecheck
```

Expected: PASS

- [ ] **Step 7: Full turbo gate**

```bash
npx turbo run lint typecheck
```

Expected: PASS (all packages)

- [ ] **Step 8: Commit**

```bash
git add apps/admin-desktop/src/pages/TriageQueuePage.tsx \
        apps/admin-desktop/src/hooks/usePendingHandoffs.ts \
        apps/admin-desktop/src/__tests__/shift-handoff-modal.test.tsx \
        apps/admin-desktop/src/services/callables.ts
git commit -m "feat(admin-desktop): ShiftHandoffModal + incoming handoff banner for A.3"
```

---

### Task 9: Full Cluster A verification

- [ ] **Step 1: Run all new function tests**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run \
    src/__tests__/triggers/duplicate-cluster.test.ts \
    src/__tests__/callables/merge-duplicates.test.ts \
    src/__tests__/callables/shift-handoff.test.ts \
    src/__tests__/scheduled/admin-operations-sweep.test.ts"
```

Expected: PASS (all 26 tests)

- [ ] **Step 2: Run admin-desktop test suite**

```bash
pnpm --filter @bantayog/admin-desktop exec vitest run
```

Expected: PASS

- [ ] **Step 3: Full monorepo lint + typecheck**

```bash
npx turbo run lint typecheck
```

Expected: PASS (25/25)

- [ ] **Step 4: Commit verification record**

```bash
git commit --allow-empty -m "chore: Cluster A verification gate — all tests pass"
```
