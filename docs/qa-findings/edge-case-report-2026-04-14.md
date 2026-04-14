# Bantayog Alert App — QA Edge Case Report

**Date:** 2026-04-14
**Scope:** Comprehensive security, input validation, concurrency, error handling, performance, and API contract analysis
**Stack:** React 18 + TypeScript + Vite + Firebase (Firestore/Auth/Storage/Functions) + IndexedDB + TanStack Query + Leaflet

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Data Integrity & Atomicity](#2-data-integrity--atomicity)
3. [Input Validation](#3-input-validation)
4. [Error Handling](#4-error-handling)
5. [Concurrency & Race Conditions](#5-concurrency--race-conditions)
6. [Performance & Resource Management](#6-performance--resource-management)
7. [Security](#7-security)
8. [API Contracts](#8-api-contracts)
9. [Offline/Queue Integrity](#9-offlinequeue-integrity)
10. [Test Coverage Gaps](#10-test-coverage-gaps)

---

## 1. Authentication & Authorization

### CRITICAL-AUTH-1: MFA for Provincial Superadmins Is Dead Code

**Severity:** Critical
**File:** `functions/src/index.ts` (lines 58-82, 91-103, 113-126, 138-146)

All MFA enrollment methods throw "Not yet implemented":

```typescript
// enrollTOTP() throws: 'TOTP enrollment requires Firebase Cloud Functions. Not yet implemented.'
// enrollSMS() throws: 'SMS MFA enrollment requires reCAPTCHA setup. Not yet implemented.'
// verifyMFA() throws: 'MFA verification requires Firebase Cloud Functions. Not yet implemented.'
```

**Impact:**

- Provincial superadmins cannot enroll in MFA
- `loginProvincialSuperadmin()` requires MFA but has no remediation path
- Provincial admins are permanently locked out of their own system

**Root Cause:** MFA was designed but never implemented. The `mfaSettings.enabled = false` check causes `MFA_ENROLLMENTMENT_REQUIRED` error with no way to complete enrollment.

---

### CRITICAL-AUTH-2: Municipal Admin Can Access Reports From ALL Municipalities

**Severity:** Critical
**File:** `src/domains/municipal-admin/services/firestore.service.ts` (lines 32-56)

```typescript
export async function getMunicipalityReports(_municipality: string) {
  const constraints = [orderBy('createdAt', 'desc'), limit(100)]
  const reports = await getCollection<Report>('reports', constraints)
  // _municipality parameter is IGNORED — no where clause!
}
```

**Impact:** A municipal admin from "Daet" can view ALL reports province-wide (Basud, Labo, Jose Panganiban, Capalonga). Private data (phone numbers, exact locations) exposed for all municipalities.

**Root Cause:** The `_municipality` parameter uses underscore prefix (indicating intentionally unused) but the code was never completed.

---

### CRITICAL-AUTH-3: Responder Can Access Reports From Other Municipalities

**Severity:** Critical
**File:** `src/domains/responder/services/firestore.service.ts` (lines 20-41)

```typescript
export async function getAssignedIncidents(responderUid: string) {
  const constraints = [where('assignedTo', '==', responderUid), orderBy('assignedAt', 'desc')]
  const opsReports = await getCollection<ReportOps>('report_ops', constraints)
  // NO municipality filter — responder sees ALL assigned reports province-wide
}
```

**Impact:** A responder assigned to a report in "Daet" can potentially see report details including private data from other municipalities if cross-municipality assignments exist.

---

### HIGH-AUTH-1: No Rate Limiting on Sensitive Cloud Functions

**Severity:** High
**File:** `functions/src/index.ts`

The functions `updateCustomClaims`, `forceTokenRefresh`, and `deleteUserData` have no rate limiting despite being high-privilege operations. An authenticated municipal_admin could spam-delete all user accounts.

---

### HIGH-AUTH-2: LinkReportsByPhone Has No Phone Ownership Verification

**Severity:** High
**File:** `src/features/profile/components/LinkReportsByPhone.tsx`

Phone-to-account linking requires no OTP verification or ownership confirmation. An attacker with access to someone's phone number could link all their anonymous reports to a fake account.

---

### HIGH-AUTH-3: All Authenticated Users Can Read ALL Public Reports

**Severity:** High
**File:** `firestore.rules` (line 91)

```rules
match /reports/{reportId} {
  allow read: if isAuthenticated();  // ANY authenticated user can read ANY report
}
```

Sequential ID guessing could enumerate all reports province-wide.

---

### MED-AUTH-1: MFA Settings Stored in Firestore (Client-Accessible)

**File:** `src/domains/provincial-superadmin/services/auth.service.ts` (lines 30-37)

No server-side enforcement that MFA was actually completed before allowing privileged actions. The `mfaSettings` object is readable by the user themselves.

---

### MED-AUTH-2: Auth Error Code Discarded

**File:** `src/shared/services/auth.service.ts` (lines 142-144)

```typescript
} catch (error) {
  getAuthErrorCode(error)  // ← Return value DISCARDED!
  throw new Error(`Registration failed: ${(error as Error).message}`, { cause: error })
}
```

Application-specific error codes (`EMAIL_ALREADY_IN_USE`, `WEAK_PASSWORD`) are never extracted.

---

## 2. Data Integrity & Atomicity

### CRITICAL-DATA-1: Non-Atomic Three-Tier Report Submission

**Severity:** Critical
**File:** `src/domains/citizen/services/firestore.service.ts` (lines 23-65)

```typescript
const reportId = await addDocument('reports', {...})     // Tier 1: SUCCESS
if (privateData) {
  await setDocument('report_private', reportId, {...})  // Tier 2: Could FAIL
}
await setDocument('report_ops', reportId, {...})        // Tier 3: Could FAIL
```

If Tier 2 or 3 fails after Tier 1 commits:

- Report appears in public feed WITHOUT private details
- Operational tracking is missing
- No rollback mechanism

Same pattern in `verifyReport`, `markAsFalseAlarm`, `assignToResponder`.

---

### CRITICAL-DATA-2: Timeline Read-Modify-Write Race

**Severity:** Critical
**File:** `src/domains/responder/services/firestore.service.ts` (lines 123-152)

```typescript
const ops = await getDocument<ReportOps>('report_ops', reportId)
await updateDocument('report_ops', reportId, {
  timeline: [...ops.timeline, newEntry], // 💥 One update LOST if concurrent
})
```

Same pattern in `verifyReport`, `markAsFalseAlarm`, `assignToResponder`.

---

### HIGH-DATA-1: TOCTOU Duplicate Submission Bypass

**Severity:** High
**Files:** `src/features/report/hooks/useDuplicateCheck.ts`, `src/features/report/services/reportSubmission.service.ts`

The duplicate check is purely advisory — `submitCitizenReport` never checks the result:

```typescript
const { duplicates } = useDuplicateCheck(...)
// User clicks submit anyway — no server enforcement
await submitCitizenReport(reportData)
```

No Firestore security rule enforces deduplication by location+type+time window.

---

### HIGH-DATA-2: Offline Queue Duplicate on Sync

**File:** `src/features/report/hooks/useReportQueue.ts` (lines 148-171)

Queue ID (`queued-${Date.now()}-${Math.random()}`) is only IndexedDB-scoped. When synced, it gets a fresh Firestore auto-ID with no deduplication check.

---

### MED-DATA-1: Queue Sync Status Not Rolled Back on Failure

**File:** `src/features/report/hooks/useReportQueue.ts` (lines 126-139)

```typescript
try {
  await submitCitizenReport(...) // ✅ Firestore write succeeds
  await reportQueueService.delete(report.id) // ❌ IndexedDB fails here
} catch {
  const failedReport = { ...report, status: 'failed', ... }
  await reportQueueService.update(failedReport) // This can also fail
}
```

Report exists in Firestore BUT is still in queue with 'syncing' status. Next sync will retry and likely create duplicate.

---

### MED-DATA-2: No Audit Log for Citizen Report Submissions

**File:** `src/domains/citizen/services/firestore.service.ts` (lines 23-64)

The `submitReport` function creates three tiers of data but doesn't write to `audit_logs`. Only Cloud Functions write audit logs. Anonymous report submissions have no traceability.

---

## 3. Input Validation

### CRITICAL-VAL-1: GPS Coordinates (0, 0) Accepted

**Severity:** Critical
**File:** `src/features/report/services/reportSubmission.service.ts`

Default `latitude ?? 0` fallback stores `0, 0` coordinates (Gulf of Guinea — middle of the ocean). Invalid coordinates are stored directly in Firestore.

---

### CRITICAL-VAL-2: Out-of-Range GPS Coordinates Accepted

**Severity:** Critical
**File:** `useGeolocation.ts` + `reportSubmission.service.ts`

Latitude = 91, Longitude = 181 (out of range ±90/±180) are accepted and stored directly.

---

### HIGH-VAL-1: Phone Format Too Loose

**Severity:** High
**File:** Multiple files (`ReportForm.tsx`, `SignUpFlow.tsx`, `LinkReportsByPhone.tsx`)

Phone regex accepts `+63 000 000 0000` and `+63 999 999 9999` — invalid PH numbers pass validation. Regex alone is insufficient for phone validation.

---

### HIGH-VAL-2: Photo File Size Not Validated

**Severity:** High
**File:** `src/features/report/services/reportStorage.service.ts`

No file size limit check. Zero-byte files accepted; multi-GB files could be uploaded causing storage DoS.

---

### HIGH-VAL-3: XSS Risk in Name Field

**Severity:** High
**File:** `src/features/auth/components/SignUpFlow.tsx` (lines 47-51)

```typescript
function validateName(name: string): string | null {
  if (!name.trim()) return 'Name is required'
  if (name.trim().length < 2) return 'Name must be at least 2 characters'
  return null // No XSS sanitization!
}
```

Name like `<script>alert(1)</script>` is accepted and stored without sanitization. Downstream rendering could execute it.

---

### HIGH-VAL-4: Inconsistent Phone Validation Across App

**Severity:** High

- `ReportForm.tsx` uses `PH_PHONE_REGEX = /^\+63\s?\d{3}\s?\d{3}\s?\d{4}$/` (requires `+63`)
- `SignUpFlow.tsx` uses `PH_MOBILE_REGEX = /^(\+?63|0)?[0-9]{10}$/` (allows leading zero)
- `LinkReportsByPhone.tsx` uses `/^(\+?63|0)?[0-9]{10}$/`

Same app, different validation rules for the same input type.

---

### MED-VAL-1: Alert `expiresAt` Has No Range Validation

**File:** `functions/src/createAlert.ts`

No validation for past timestamps or absurdly far-future timestamps. Expired alerts are filtered client-side only.

---

### MED-VAL-2: Alert `affectedAreas` Element Validation Missing

**File:** `functions/src/createAlert.ts`

No element-level validation for municipality/barangay arrays. Empty strings `[""]` are stored.

---

### MED-VAL-3: Alert `targetMunicipality` Existence Not Checked

**File:** `functions/src/createAlert.ts`

No validation that `targetMunicipality` actually exists in the municipality list.

---

### MED-VAL-4: Unicode Edge Cases in Name Field

**File:** `src/features/auth/components/SignUpFlow.tsx`

Name with 500 zero-width spaces is accepted and stored. Emoji names are accepted.

---

### MED-VAL-5: Weak Password Policy

**File:** `src/features/auth/components/SignUpFlow.tsx` (lines 59-63)

```typescript
function validatePassword(password: string): string | null {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  return null // No complexity requirements!
}
```

Allows "password" or "12345678" for critical disaster response accounts.

---

### LOW-VAL-1: Anonymous Report ReporterName Hardcoded

**File:** `src/features/report/services/reportSubmission.service.ts` (lines 73, 58)

```typescript
reporterContact: {
  name: reportData.isAnonymous ? 'Anonymous' : 'Citizen Reporter',  // Hardcoded!
}
```

Anonymous reports use "Anonymous" as name, making them trivially distinguishable.

---

## 4. Error Handling

### CRITICAL-ERR-1: Photo Upload Failure Is Silent

**Severity:** Critical
**File:** `src/features/report/services/reportSubmission.service.ts` (lines 79-85)

```typescript
if (reportData.photo !== null) {
  try {
    photoUrls = [await uploadReportPhoto(reportData.photo, reportId)]
  } catch (photoError) {
    console.error('[REPORT_SUBMISSION_PHOTO_ERROR]', photoError)
    // SILENTLY CONTINUES - photoUrls stays []
  }
}
return { reportId, photoUrls } // Success returned despite photo failure!
```

**Impact:** Report saves to Firestore, user sees success screen, but photo is missing. No retry mechanism.

---

### CRITICAL-ERR-2: Auto-Sync Failure Is Invisible to User

**Severity:** Critical
**File:** `src/features/report/hooks/useReportQueue.ts` (lines 176-182)

```typescript
useEffect(() => {
  if (isOnline && queueRef.current.length > 0 && !isSyncing) {
    syncQueue().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Auto-sync failed'
      console.error('[AUTO_SYNC_ERROR]', message)
      // NO USER NOTIFICATION — only console.log
    })
  }
}, [isOnline, isSyncing, syncQueue])
```

**Impact:** When network fluctuates during sync, report could be silently lost with no user notification.

---

### CRITICAL-ERR-3: Queue Service Failure Silently Breaks Offline Mode

**Severity:** Critical
**File:** `src/features/report/hooks/useReportQueue.ts` (lines 91-93)

```typescript
if (!reportQueueService || typeof reportQueueService.update !== 'function') {
  throw new Error('Queue service unavailable')
}
```

This error is caught by the auto-sync `.catch()` which only logs to console. Users cannot queue reports when IDB is corrupted and are never told.

---

### HIGH-ERR-1: loadError Tracked But Never Surfaced to UI

**Severity:** High
**File:** `src/features/report/hooks/useReportQueue.ts` (lines 64)

```typescript
const [loadError, setLoadError] = useState<string | null>(null)
```

This error state is set but the hook's return type includes `loadError` without any guarantee the UI will display it or prompt retry.

---

### MED-ERR-1: Fire-and-Forget Promise Swallows Errors

**File:** `src/features/alerts/hooks/useAlerts.ts` (line 54)

```typescript
cacheAlerts(latestAlertsRef.current).catch(() => {
  /* fire-and-forget */
})
```

Cache failures are swallowed during error recovery. If cache also fails during Firestore outage, user sees nothing.

---

### MED-ERR-2: No Circuit Breaker / Retry Backoff

**File:** `src/shared/services/functions.service.ts` (lines 130-154)

```typescript
export async function callFunctionWithRetry<T, D>(...) {
  // Exponential backoff but NO circuit breaker
  // If Firebase Function is down, every client hammers it
}
```

After enough failures, the function remains overwhelmed with no circuit breaker to stop requests.

---

### MED-ERR-3: Empty Catch Block Silences Parent Errors

**File:** `src/features/report/components/ReportForm.tsx` (lines 247-251)

```typescript
try {
  onSubmit?.(reportData)
} catch {
  // Parent error must not block offline queue flow
}
```

If `onSubmit` throws (e.g., rate limit), the error is silently swallowed.

---

### MED-ERR-4: Sensitive Data in Console Error Messages

**File:** `src/features/report/services/reportSubmission.service.ts` (line 83)

```typescript
console.error('[REPORT_SUBMISSION_PHOTO_ERROR]', photoError)
```

Error messages containing file paths and system details leak in production.

---

### LOW-ERR-1: Empty Catch Block in RegisteredProfile

**File:** `src/features/profile/components/RegisteredProfile.tsx`

Fire-and-forget patterns in logout/data deletion paths swallow errors silently.

---

## 5. Concurrency & Race Conditions

### CRITICAL-CONC-1: Non-Atomic Three-Document Report Submission

**Severity:** Critical
**File:** `src/domains/citizen/services/firestore.service.ts`

See [CRITICAL-DATA-1](#critical-data-1-non-atomic-three-tier-report-submission)

---

### CRITICAL-CONC-2: Timeline Read-Modify-Write Race

**Severity:** Critical
**File:** `src/domains/responder/services/firestore.service.ts`

See [CRITICAL-DATA-2](#critical-data-2-timeline-read-modify-write-race)

---

### HIGH-CONC-1: TOCTOU Duplicate Submission Bypass

**Severity:** High
**File:** `src/features/report/hooks/useDuplicateCheck.ts`

See [HIGH-DATA-1](#high-data-1-toctou-duplicate-submission-bypass)

---

### HIGH-CONC-2: IndexedDB Singleton DB Initialization Race

**Severity:** High
**File:** `src/features/report/services/reportQueue.service.ts` (lines 26-41)

```typescript
let db: IDBPDatabase | null = null  // 💥 No atomicity
async function getDB() {
  if (!db) {
    db = await openDB(...)  // Two callers could race to init
  }
  return db
}
```

Two calls during upgrade event could race to initialize.

---

### MED-CONC-1: Queue Sync Status Not Rolled Back on Failure

**File:** `src/features/report/hooks/useReportQueue.ts`

See [MED-DATA-1](#med-data-1-queue-sync-status-not-rolled-back-on-failure)

---

### MED-CONC-2: File Upload Filename Collision

**File:** `src/features/report/services/reportStorage.service.ts` (lines 18-39)

```typescript
const filename = `${reportId}_${timestamp}.${extension}` // 💥 1s resolution
```

Same photo uploaded twice within same millisecond could collide.

---

## 6. Performance & Resource Management

### CRITICAL-PERF-1: Unbounded IndexedDB Growth

**Severity:** Critical
**File:** `src/shared/services/indexedDB.ts` + `src/features/report/services/reportQueue.service.ts`

The offline report queue stores all pending/failed reports indefinitely. No TTL, no max queue size.

**Impact:** Device offline for weeks → IndexedDB could grow to hundreds of MBs. During disaster, mass incidents + prolonged offline = queue explosion.

---

### CRITICAL-PERF-2: No Photo File Size Limit

**Severity:** Critical
**File:** `src/features/report/services/reportStorage.service.ts`

Any size file can be uploaded. A malicious user could upload multi-GB files causing Firebase Storage costs and bandwidth exhaustion.

---

### HIGH-PERF-1: Feed Loads All Pages Into Memory

**Severity:** High
**File:** `src/features/feed/hooks/useFeedReports.ts`

```typescript
const reports = query.data?.pages.flatMap((page) => page.reports)
```

TanStack's infinite query accumulates all pages. 50 pages × 10 items = 500 report objects in memory. Memory grows unbounded with heavy feed usage.

---

### HIGH-PERF-2: N+1 Delete Operations in deleteUserData

**Severity:** High
**File:** `functions/src/index.ts` (lines 336-342)

```typescript
for (const privateDoc of privateReports.docs) {
  await db.collection('report_private').doc(privateDoc.id).delete()
  await db.collection('report_ops').doc(privateDoc.id).delete()
}
```

If a user has 1,000 reports, this creates 2,000 Firestore operations sequentially.

---

### MED-PERF-1: Client-Side Expiration Filtering Waste

**File:** `src/features/alerts/services/alert.service.ts`

```typescript
return alerts.filter((a) => !a.expiresAt || a.expiresAt > now)
```

Fetches ALL active alerts, then filters expired ones client-side. If 100 alerts exist but 90 are expired, client downloads 100 to show 10.

---

### MED-PERF-2: useFeedReports Ignores Real Cursor Pagination

**File:** `src/features/feed/hooks/useFeedReports.ts`

`getNextPageParam` returns page number, not a Firestore document cursor. `fetchFeedReports` doesn't use cursors.

---

### MED-PERF-3: Map Markers All Rendered Simultaneously

**File:** `src/features/map/components/MapView.tsx`

`filteredReports.forEach((report) => { L.marker(...) })` renders ALL markers at once. 1,000 reports = 1,000 DOM markers. Leaflet will lag.

---

### MED-PERF-4: Sequential Batch Processing in Data Retention

**File:** `functions/src/index.ts` (lines 390-420)

500-document batch limit means large datasets require multiple batch commits. If scheduled function times out mid-run, data is left in inconsistent state.

---

## 7. Security

### CRITICAL-SEC-1: MFA Dead Feature (Lockout)

**Severity:** Critical
**File:** `functions/src/index.ts`

See [CRITICAL-AUTH-1](#critical-auth-1-mfa-for-provincial-superadmins-is-dead-code)

---

### CRITICAL-SEC-2: Cross-Municipality Data Leakage

**Severity:** Critical
**File:** `src/domains/municipal-admin/services/firestore.service.ts`

See [CRITICAL-AUTH-2](#critical-auth-2-municipal-admin-can-access-reports-from-all-municipalities)

---

### CRITICAL-SEC-3: No Rate Limiting on Cloud Functions

**Severity:** Critical
**File:** `functions/src/index.ts`

See [HIGH-AUTH-1](#high-auth-1-no-rate-limiting-on-sensitive-cloud-functions)

---

### HIGH-SEC-1: Path Traversal Risk in Photo Filename

**Severity:** High
**File:** `src/features/report/services/reportStorage.service.ts` (lines 18-39)

```typescript
const extension = file.name.split('.').pop() || 'jpg' // UNSANITIZED!
```

Extension extraction from `file.name` could allow path manipulation. Firebase Storage rules only check MIME type, not actual content.

---

### HIGH-SEC-2: Weak Password Minimum Requirements

**Severity:** High
**File:** `src/features/auth/components/SignUpFlow.tsx`

See [MED-VAL-5](#med-val-5-weak-password-policy)

---

### HIGH-SEC-3: Anonymous Reports Are Distinguishable

**Severity:** High
**File:** `src/features/report/services/reportSubmission.service.ts`

Hardcoded "Anonymous" name makes anonymous reports trivially identifiable in the public feed.

---

### MED-SEC-1: Client-Side Rate Limiting Only

**File:** `tests/e2e/rate-limiting.spec.ts`

Rate limiting is in localStorage only. Sophisticated attacker bypasses by clearing localStorage, using different sessions, or different IPs.

---

### MED-SEC-2: No Server-Side Image Content Validation

**File:** `src/features/report/services/reportStorage.service.ts`

Storage rules only check `contentType.matches('image/.*')`. A polyglot file (valid image with embedded executable) could be uploaded.

---

### MED-SEC-3: Geolocation Data Stored Without Encryption

**File:** `src/features/report/hooks/useReportQueue.ts` (lines 143-149)

GPS coordinates stored in IndexedDB for offline queue could be accessed if device is compromised.

---

### MED-SEC-4: Public Report Enumeration via Sequential IDs

**File:** `firestore.rules`

Any authenticated user can read any report. Sequential ID guessing could enumerate all reports province-wide.

---

### LOW-SEC-1: Console Errors Leak System Info

**File:** `src/features/report/services/reportSubmission.service.ts`

See [MED-ERR-4](#med-err-4-sensitive-data-in-console-error-messages)

---

## 8. API Contracts

### CRITICAL-API-1: Municipality Filter Not Applied

**Severity:** Critical
**File:** `src/domains/municipal-admin/services/firestore.service.ts`

See [CRITICAL-AUTH-2](#critical-auth-2-municipal-admin-can-access-reports-from-all-municipalities)

---

### HIGH-API-1: getAvailableResponders Always Returns Empty

**File:** `src/domains/municipal-admin/services/firestore.service.ts` (line 205)

```typescript
const responders: Responder[] = [] // Always empty — returns before any assignment
```

Function always returns empty array regardless of inputs.

---

### MED-API-1: Alert `title`/`message` Has No Max Length

**File:** `functions/src/createAlert.ts`

No max length validation. Could cause display issues.

---

### MED-API-2: Auth Error Code Extraction Unused

**File:** `src/shared/services/auth.service.ts`

See [MED-AUTH-2](#med-auth-2-auth-error-code-discarded)

---

## 9. Offline/Queue Integrity

### CRITICAL-OFFLINE-1: Queue Sync Failure Is Silent

**Severity:** Critical
**File:** `src/features/report/hooks/useReportQueue.ts`

See [CRITICAL-ERR-2](#critical-err-2-auto-sync-failure-is-invisible-to-user)

---

### CRITICAL-OFFLINE-2: Queue Service Failure Is Silent

**Severity:** Critical
**File:** `src/features/report/hooks/useReportQueue.ts`

See [CRITICAL-ERR-3](#critical-err-3-queue-service-failure-silently-breaks-offline-mode)

---

### CRITICAL-OFFLINE-3: Non-Atomic Queue Sync

**Severity:** Critical
**File:** `src/features/report/hooks/useReportQueue.ts`

See [CRITICAL-DATA-1](#critical-data-1-non-atomic-three-tier-report-submission)

---

### HIGH-OFFLINE-1: Offline Queue Duplicate on Sync

**Severity:** High
**File:** `src/features/report/hooks/useReportQueue.ts`

See [HIGH-DATA-2](#high-data-2-offline-queue-duplicate-on-sync)

---

### HIGH-OFFLINE-2: Unbounded IndexedDB Growth

**Severity:** High
**File:** `src/features/report/services/reportQueue.service.ts`

See [CRITICAL-PERF-1](#critical-perf-1-unbounded-indexeddb-growth)

---

### MED-OFFLINE-1: Queue Sync Status Not Rolled Back on Failure

**File:** `src/features/report/hooks/useReportQueue.ts`

See [MED-DATA-1](#med-data-1-queue-sync-status-not-rolled-back-on-failure)

---

## 10. Test Coverage Gaps

### Pre-Existing Test Failures

**File:** `tests/unit/validation.test.ts`

4 tests failing due to mock reference error (`collection is not defined`):

```
should include both municipality names in error message — reference error
should reject assignment when municipalities do not match — same mock bug
should reject assignment when responder has no municipality — same mock bug
should return CROSS_MUNICIPALITY_ASSIGNMENT_NOT_ALLOWED error code — cause.code is undefined
```

Mock uses `collection` variable declared as parameter `_collection` in a function that shadows the outer scope.

---

### Missing Test Coverage By Area

| Area                 | Missing Tests                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Input Validation** | GPS coordinate bounds (-90/90, -180/180); zero coordinates (0,0); photo size limits (0 bytes, >10MB); phone number reachability; alert expiresAt range |
| **Concurrency**      | Timeline concurrent updates; 3-tier write atomicity; duplicate submission race; queue sync interleaving                                                |
| **Error Handling**   | Photo upload failure notification; auto-sync failure notification; queue service unavailable notification; partial write rollback                      |
| **Auth/AuthZ**       | getMunicipalityReports municipality filter; MFA enrollment flow; rate limiting enforcement                                                             |
| **Performance**      | N+1 delete with 1000 reports; feed pagination 50 pages memory; map 5000 markers render; offline queue 1000 items                                       |
| **Offline**          | IndexedDB max size exhaustion; sync failure with network flapping; queue dedup on re-submission                                                        |

---

## Summary Counts

| Category                          | Critical | High   | Medium | Low   |
| --------------------------------- | -------- | ------ | ------ | ----- |
| Authentication & Authorization    | 3        | 3      | 2      | 0     |
| Data Integrity & Atomicity        | 2        | 2      | 2      | 0     |
| Input Validation                  | 2        | 4      | 5      | 1     |
| Error Handling                    | 3        | 1      | 4      | 1     |
| Concurrency & Race Conditions     | 2        | 2      | 2      | 0     |
| Performance & Resource Management | 2        | 2      | 4      | 0     |
| Security                          | 3        | 3      | 4      | 1     |
| API Contracts                     | 1        | 1      | 2      | 0     |
| Offline/Queue Integrity           | 3        | 2      | 1      | 0     |
| **Total**                         | **21**   | **20** | **30** | **3** |

---

## Edge Cases Requiring Immediate Test Suite Addition

### Phone Validation (Boundary)

```
+63 912 345 6789  → valid
+639123456789      → valid (SignUpFlow), INVALID (ReportForm)
+63 912 345 678   → invalid (too short)
+63 9123 456 789  → invalid (too many digits)
+63 000 000 0000  → should be invalid (fake number)
+63 999 999 9999  → should be invalid (fake number)
```

### GPS Coordinate Boundaries

```
Latitude 0, Longitude 0     → Gulf of Guinea default — MUST REJECT
Latitude 91, Longitude 0   → out of range — MUST REJECT
Latitude 0, Longitude 181  → out of range — MUST REJECT
Latitude -91, Longitude 0  → out of range — MUST REJECT
```

### Photo Validation

```
Size = 0 bytes      → MUST REJECT
Size = 10MB + 1    → MUST REJECT
Size = exactly 5MB → accept (if 5MB limit chosen)
Non-image with .jpg extension → MUST REJECT
```

### Concurrency

```
2 responders update timeline simultaneously  → both entries MUST appear
3-tier write, tier 2 fails → all MUST rollback (no partial state)
Duplicate submit within 1 second → second MUST be deduplicated or flagged
```

### Error Handling

```
Photo upload fails  → user MUST see error, not success screen
Auto-sync fails     → user MUST see notification
Network flaps during sync → final state MUST be consistent
```
