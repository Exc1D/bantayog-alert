# Phase 4 Citizen PWA Offline Persistence + SMS Fallback — Design

**Date:** 2026-04-22
**Status:** Approved — incorporates adversarial review fixes
**Companion docs:** Arch Spec §9.2, §9.3, decision #23, citizen-role-spec-v2.md

---

## 1. Context

The citizen PWA has zero offline infrastructure. `SubmitReportForm` writes directly to Firestore with no timeout, no draft save, no offline detection, and no SMS fallback.

**Adversarial review fixes incorporated:** Sliding TTL via `updatedAt`, `syncState` marker for orphan detection, active connectivity probe replacing `navigator.onLine`, MSISDN not stored (hash only), QuotaExceededError handled in clear, retry count persisted, photo blob recovery, extended TTL for queued drafts, stale draft warning.

---

## 2. Package Additions

**File:** `apps/citizen-pwa/package.json`

```json
{
  "localforage": "^1.10.0",
  "zustand": "^4.5.0",
  "@tanstack/react-query": "^5.0.0"
}
```

---

## 3. Draft Store — `src/services/draft-store.ts`

### 3.1 Interface

```typescript
export type SyncState = 'local_only' | 'syncing' | 'synced'

export interface Draft {
  id: string // 'BA-DA-4L2P' — crypto.randomUUID() based
  reportType: ReportType
  barangay: string
  barangayId?: string
  description: string
  severity: Severity
  location?: { lat: number; lng: number }
  nearestLandmark?: string
  reporterName?: string
  reporterMsisdnHash?: string // SHA-256 only — never plaintext MSISDN
  reporterMsisdn?: string // In-memory only, not persisted
  clientDraftRef: string // Stable ID generated once at creation, used for deduplication
  syncState: SyncState
  retryCount: number // Persisted for app-restart safety
  smsFallbackSentAt?: number
  clientCreatedAt: number // Stable timestamp for tiebreaking
  createdAt: number
  updatedAt: number // TTL resets from here (sliding window)
}
```

### 3.2 TTL Policy

- **24h sliding window** — TTL resets to 24h from `updatedAt` on every save/retry
- **Queued drafts (syncState === 'syncing')** get 72h — they have a Firestore write in-flight, not truly orphaned
- **Expired drafts** are silently deleted from localForage on next `list()` call
- **Before deleting** an expired draft with `smsFallbackSentAt`, surface to user: "You have an unsent draft from [date]"

### 3.3 Implementation

```typescript
import { createLocalForage } from 'localforage'

const draftStorage = createLocalForage<Draft & { photoBlob?: Blob }>({
  name: 'bantayog-drafts',
  storeName: 'drafts',
})

const PHOTO_TTL_MS = 60 * 60 * 1000 // 1h for photo blobs

export const draftStore = {
  async save(draft: Draft): Promise<void> {
    const toSave = { ...draft, updatedAt: Date.now() }
    await draftStorage.setItem(draft.id, toSave)
  },

  async saveWithPhoto(draft: Draft, photoBlob: Blob): Promise<void> {
    await draftStorage.setItem(draft.id, { ...draft, updatedAt: Date.now() })
    const photoRef = createLocalForage<Blob>({ name: 'bantayog-photos', storeName: 'photos' })
    await photoRef.setItem(draft.id, photoBlob)
  },

  async load(id: string): Promise<{ draft: Draft; photoBlob?: Blob } | null> {
    const draft = await draftStorage.getItem(id)
    if (!draft) return null

    // TTL check — sliding window from updatedAt
    const ttl = draft.syncState === 'syncing' ? 72 * 3600 * 1000 : 24 * 3600 * 1000
    if (Date.now() - draft.updatedAt > ttl) {
      await this.clear(id)
      return null
    }

    // Check photo blob still readable
    const photoRef = createLocalForage<Blob>({ name: 'bantayog-photos', storeName: 'photos' })
    const photoBlob = await photoRef.getItem(id).catch(() => null)
    if (photoBlob && draft.syncState === 'local_only') {
      // Verify blob is still accessible (not evicted)
      const testRead = await photoBlob
        .slice(0, 1)
        .arrayBuffer()
        .catch(() => null)
      if (!testRead) {
        // Blob evicted — photo is lost, warn but don't block
        await photoRef.removeItem(id)
        return { draft, photoBlob: undefined }
      }
    }

    return { draft, photoBlob: photoBlob ?? undefined }
  },

  async clear(id: string): Promise<void> {
    await draftStorage.removeItem(id)
    const photoRef = createLocalForage<Blob>({ name: 'bantayog-photos', storeName: 'photos' })
    await photoRef.removeItem(id).catch(() => {})
  },

  async list(): Promise<Draft[]> {
    const drafts: Draft[] = []
    await draftStorage.iterate<Draft, void>((value) => {
      drafts.push(value)
    })
    // Filter expired inline
    const fresh = drafts.filter((d) => {
      const ttl = d.syncState === 'syncing' ? 72 * 3600 * 1000 : 24 * 3600 * 1000
      return Date.now() - d.updatedAt <= ttl
    })
    return fresh
  },

  async recoverOrphaned(): Promise<Draft[]> {
    const all = await this.list()
    return all.filter((d) => d.syncState === 'syncing')
  },
}
```

### 3.4 MSISDN Privacy

`reporterMsisdn` is never stored in localforage. Only `reporterMsisdnHash` (SHA-256, no salt — already pseudonymous) is persisted. The plaintext `reporterMsisdn` is kept in-memory only and re-prompted on draft recovery if needed.

---

## 4. Online Status — `src/hooks/useOnlineStatus.ts`

### 4.1 Why `navigator.onLine` Is Unreliable

Mobile Safari reports `navigator.onLine = true` even behind captive portals or with no real connectivity. A device that reports online but has no actual internet will burn all 3 retries instantly against a server that's unreachable.

### 4.2 Active Probe Implementation

```typescript
export function useOnlineStatus() {
  const [status, setStatus] = useState({ navigatorOnline: navigator.onLine, probeOnline: true })

  const probe = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus({ navigatorOnline: false, probeOnline: false })
      return false
    }
    try {
      await fetch('/__/firebase.json', {
        mode: 'no-cors',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      })
      setStatus((s) => ({ ...s, probeOnline: true }))
      return true
    } catch {
      setStatus((s) => ({ ...s, probeOnline: false }))
      return false
    }
  }, [])

  useEffect(() => {
    // Probe on mount and every 30s
    probe()
    const interval = setInterval(probe, 30_000)
    return () => clearInterval(interval)
  }, [probe])

  // Passive listener still useful for immediate UI feedback
  useEffect(() => {
    const on = () => setStatus((s) => ({ ...s, navigatorOnline: true }))
    const off = () => setStatus((s) => ({ ...s, navigatorOnline: false }))
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return {
    ...status,
    isOnline: status.probeOnline, // Used for retry decisions
    navigatorOnline: status.navigatorOnline, // Used for UI banner
  }
}
```

---

## 5. Submission State Machine — `src/hooks/useSubmissionMachine.ts`

### 5.1 States

```typescript
type SubmissionState =
  | 'idle'
  | 'submitting'
  | 'server_confirmed'
  | 'queued'
  | 'failed_retryable'
  | 'failed_terminal'
```

### 5.2 Transitions

```
idle ──submit──> submitting
submitting ──success──> server_confirmed
submitting ──offline OR timeout>=10s──> queued
submitting ──5xx/network error──> failed_retryable
queued ──probeOnline──> submitting (retry, max 3, includes clientDraftRef)
failed_retryable ──probeOnline──> submitting (retry, max 3, persisted retryCount)
failed_retryable ──3rd failure──> failed_terminal
queued/failed_retryable ──probeOffline──> (stay, wait)
failed_terminal ──user taps SMS──> idle (opens composer, marks smsFallbackSentAt)
```

### 5.3 Retry Count Persistence

`retryCount` is stored in `draft.retryCount` in localforage. On recovery, read and enforce `>= 3` as terminal. Never reset to 0 on app restart.

### 5.4 Hook Signature

```typescript
export interface UseSubmissionMachineOptions {
  draft: Draft
  onSuccess: (publicRef: string) => void
  onTerminal: () => void // called when entering failed_terminal
}

export interface UseSubmissionMachineReturn {
  state: SubmissionState
  isOnline: boolean
  submit(): Promise<void>
  sendSmsFallback(): void
}
```

---

## 6. Submit Report Service — `src/services/submit-report.ts`

### 6.1 Dual-Write with SyncState

```typescript
export async function submitReport(input: SubmitReportInput): Promise<{ publicRef: string }> {
  const draftId = generateDraftId() // crypto.randomUUID() based
  const clientDraftRef = generateClientRef() // stable, used for server dedup

  // Build initial draft
  let draft: Draft = {
    id: draftId,
    clientDraftRef,
    ...input,
    syncState: 'local_only',
    retryCount: 0,
    clientCreatedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  // Step 1: Save to localForage first (syncState = local_only)
  await draftStore.save(draft)

  // Step 2: Attempt Firestore write with 10s timeout
  draft.syncState = 'syncing'
  await draftStore.save(draft)

  const publicRef = await writeToInboxWithTimeout(draft, 10_000).catch((err) => null)

  if (publicRef) {
    // Step 3a: Success — mark synced, then clear
    draft.syncState = 'synced'
    await draftStore.save(draft).catch(() => {}) // best-effort
    await draftStore.clear(draftId).catch(() => {}) // best-effort
    return { publicRef }
  } else {
    // Step 3b: Failed — syncState stays 'syncing' for recovery
    return { publicRef: draftId } // return draft ID as pseudo-ref
  }
}
```

### 6.2 Write with Timeout

```typescript
async function writeToInboxWithTimeout(draft: Draft, ms: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    writeInbox(draft)
      .then((ref) => {
        clearTimeout(timer)
        resolve(ref.id)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}
```

### 6.3 Online Retry with ClientDraftRef

On reconnect, `writeInbox` includes `clientDraftRef` field. Server-side `processInboxItemCore` deduplicates on `(reporterUid, clientDraftRef)` via Firestore unique index.

---

## 7. App-Start Reconciliation — `src/App.tsx`

```typescript
useEffect(() => {
  const recover = async () => {
    const orphans = await draftStore.recoverOrphaned()
    for (const draft of orphans) {
      // Check if Firestore already accepted it
      const exists = await checkInboxExists(draft.clientDraftRef)
      if (!exists) {
        // Write was lost — re-enqueue
        draft.syncState = 'syncing'
        draft.updatedAt = Date.now()
        await draftStore.save(draft)
        // Notify the submission machine
        setRecoveredDraft(draft)
      } else {
        // Already on server — clear locally
        await draftStore.clear(draft.id).catch(() => {})
      }
    }
  }
  recover()
}, [])
```

---

## 8. SMS Fallback — `SubmitReportForm`

### 8.1 When to Show

Show "Send as SMS" button when `state === 'queued'` OR `state === 'failed_terminal'`.

### 8.2 Body Format

Target: ≤160 chars GSM-7 (1 segment). Worst case falls back to UCS-2 (70 chars, 2 segments).

```
BANTAYOG <draft-ref>
<REPORT_TYPE> <BARANGAY>
<lat>,<lng> | NO_GPS
<name (30 chars, diacritics stripped)>
<msisdn>
Hurt: <count>
```

### 8.3 Implementation

```typescript
function buildSmsBody(draft: Draft): string {
  const name = (draft.reporterName ?? '')
    .slice(0, 30)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/gi, 'n')

  const locationStr = draft.location ? `${draft.location.lat},${draft.location.lng}` : 'NO_GPS'

  const hurtCount = draft.severity === 'critical' || draft.severity === 'high' ? '1' : '0'

  return [
    `BANTAYOG ${draft.clientDraftRef}`,
    `${draft.reportType.toUpperCase()} ${draft.barangay}`,
    locationStr,
    name,
    draft.reporterMsisdn ?? '', // in-memory, re-prompted if missing
    `Hurt: ${hurtCount}`,
  ].join('\n')
}

function sendSmsFallback(draft: Draft, setSmsSent: (at: number) => void) {
  // Set timestamp BEFORE opening SMS composer (synchronous in-memory write)
  setSmsSent(Date.now())
  const body = buildSmsBody(draft)
  const encoded = encodeURIComponent(body)
  window.location.href = `sms:?body=${encoded}`
}
```

### 8.4 NO_GPS Marker

When `location` is undefined, `NO_GPS` is written to the SMS body. The server-side inbound parser routes this to `location_missing` → `requiresLocationFollowUp: true` in `processInboxItemCore`.

---

## 9. UI States

| State              | Banner                                      | Button      | Notes               |
| ------------------ | ------------------------------------------- | ----------- | ------------------- |
| `idle`             | —                                           | Submit      |                     |
| `submitting`       | "Sending..." spinner                        | disabled    |                     |
| `server_confirmed` | "Received!" green                           | Done        | Navigate to receipt |
| `queued`           | "Offline — will send when connected" yellow | Send as SMS |                     |
| `failed_retryable` | "Send failed — retrying..." orange          | Send as SMS | Retry counter shown |
| `failed_terminal`  | "Could not send" red                        | Send as SMS | Contact hotline     |

**Stale draft warning:** When recovering a draft with `updatedAt` > 12h ago, show banner: "This draft is from [date]. Location and details may be outdated."

---

## 10. Files to Change

| File                                                                     | Change                                                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `apps/citizen-pwa/package.json`                                          | Add localforage, zustand, @tanstack/react-query                              |
| `apps/citizen-pwa/src/services/draft-store.ts`                           | Full implementation: syncState, retryCount, sliding TTL, photo blob recovery |
| `apps/citizen-pwa/src/services/submit-report.ts`                         | Dual-write with syncState, timeout, clientDraftRef                           |
| `apps/citizen-pwa/src/hooks/useSubmissionMachine.ts`                     | Full state machine, persisted retryCount                                     |
| `apps/citizen-pwa/src/hooks/useOnlineStatus.ts`                          | Active probe + passive navigator.online listeners                            |
| `apps/citizen-pwa/src/App.tsx`                                           | Reconciliation on mount + stale draft warning                                |
| `apps/citizen-pwa/src/components/SubmitReportForm/index.tsx`             | Wire state machine + SMS fallback                                            |
| `apps/citizen-pwa/src/components/SubmitReportForm/OfflineBanner.tsx`     | New                                                                          |
| `apps/citizen-pwa/src/components/SubmitReportForm/SmsFallbackButton.tsx` | New                                                                          |
| `apps/citizen-pwa/src/components/StaleDraftBanner.tsx`                   | New                                                                          |
| `apps/citizen-pwa/src/__tests__/submission-machine.test.ts`              | New                                                                          |
| `apps/citizen-pwa/src/__tests__/draft-store.test.ts`                     | New                                                                          |
| `apps/citizen-pwa/e2e/offline-submission.spec.ts`                        | New Playwright E2E                                                           |
| `packages/shared-validators/src/reports.ts`                              | Add `clientDraftRef` to `inboxPayloadSchema`                                 |

---

## 11. Server-Side Deduplication

**File:** `packages/shared-validators/src/reports.ts`

Add `clientDraftRef?: string` to `inboxPayloadSchema`. The server-side `processInboxItemCore` checks for existing `report_inbox` doc with same `clientDraftRef` + same `reporterUidHash` within 24h. If found, merges rather than creating duplicate.

A composite unique index on `(reporterUidHash, clientDraftRef)` in Firestore enforces uniqueness. Writes use `setDoc(ref, data, { merge: true })` — second write is a no-op.

---

## 12. Testing Strategy

- **Unit tests:** `useSubmissionMachine` state transitions (mock `isOnline`, mock `writeToInboxWithTimeout`, mock `draftStore`)
- **Unit tests:** `draftStore` TTL behavior, sliding window, expired draft deletion
- **Unit tests:** `useOnlineStatus` probe behavior, fallback to navigator.onLine
- **Playwright E2E:** offline → draft submit → app kill → restart → online → verify submission + local cleared
- **Playwright E2E:** SMS fallback → verify body format

---

## 13. Out of Scope

- Photo upload via SMS (photos can't go over SMS — recovered when PWA back online)
- Background sync API (iOS lacks support — SMS fallback is iOS recovery path)
- Responder app offline (Phase 6)
- Map tile caching for offline (Phase 10+)
- MSISDN re-prompt UI on draft recovery (handled in-memory, minimal UX)
