# Phase 5 Full Build — Design Specification

**Date:** 2026-04-24
**Status:** Approved — ready for implementation planning
**Scope:** All 9 remaining Phase 5 deliverables (Clusters B, A, C)
**TDD mandate:** Every callable, trigger, and UI component has failing tests written before implementation code. No exceptions.

---

## 0. How to Read This Document

Each feature section follows this order:

1. **Tests to write first** — behavioral descriptions + emulator commands to run
2. **Implementation contract** — what the code must do to make those tests pass
3. **Exit criteria** — what "done" looks like

The tests section is not optional documentation. It is the specification. If you cannot write a failing test for a behavior, the behavior is not well-defined enough to implement.

---

## 1. Build Sequence

```
PRE-B  Schema + rules foundation (6 items)
B.1 → B.2 → B.3 → B.4 → B.5   (Inter-agency coordination)
A.1 → A.2 → A.3                 (Admin UI hardening)
PRE-C  Schema foundation for Cluster C (3 items)
C.1 → C.2                       (Broadcast + intelligence)
```

`dispatchTimeoutSweep` is already implemented and exported. Not in scope.

**Phase 7 items pulled forward:** `requestMassAlertEscalation` and `forwardMassAlertToNDRRMC` are Phase 7 callables included in C.1. Rationale: without an escalation CTA, the mass alert modal hits a dead end when Reach Plan returns `route: 'ndrrmc_escalation'`. Both callables are small and additive. Noted here as the explicit deviation.

---

## 2. PRE-B — Schema + Rules Foundation

All 6 items must land and pass `npx turbo run lint typecheck` before any B.x implementation starts. No business logic written until this step is green.

### PRE-B.1 — `fieldModeSessionDocSchema` + rules

**File:** `packages/shared-validators/src/coordination.ts`

```typescript
export const fieldModeSessionDocSchema = z
  .object({
    uid: z.string().min(1),
    municipalityId: z.string().min(1),
    enteredAt: z.number().int(),
    expiresAt: z.number().int(),
    exitedAt: z.number().int().optional(),
    isActive: z.boolean(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()
  .refine((d) => d.expiresAt > d.enteredAt, {
    message: 'expiresAt must be after enteredAt',
  })
```

**Firestore rules:** `match /field_mode_sessions/{uid}` — owner read/write; superadmin read; all others deny.

**Tests to write first:**

```
src/__tests__/rules/field-mode-sessions.test.ts
  it('allows owner to read their own session')
  it('allows owner to write their own session')
  it('denies other users reading someone else session')
  it('denies unauthenticated reads')
  it('denies superadmin writes')
```

Run: `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rules/field-mode-sessions.test.ts"`

### PRE-B.2 — `reportOpsDocSchema` + `processInboxItem.ts`

**Add to `reportOpsDocSchema`:**

```typescript
reportType: reportTypeSchema,
locationGeohash: z.string().length(6).optional(),
duplicateClusterId: z.string().optional(),
hazardZoneIdList: z.array(z.string()).optional(),
```

**Update `processInboxItem.ts`:** During triptych materialization, write `reportType` from the parsed inbox item and `locationGeohash` as a 6-char Ngeohash of `report_private.exactLocation` (when present).

**Tests to write first:**

```
src/__tests__/triggers/process-inbox-item.test.ts (extend existing)
  it('writes reportType onto report_ops when materializing triptych')
  it('writes 6-char locationGeohash onto report_ops when exactLocation present')
  it('omits locationGeohash from report_ops when exactLocation absent (SMS reports)')
```

These tests must fail before the `processInboxItem.ts` changes are made. Confirm each failure reads "expected 'flood' but got undefined" (or similar), not a schema error.

### PRE-B.3 — `shiftHandoffDocSchema` — `toUid` optional

**Change:** `toUid: z.string().min(1)` → `toUid: z.string().min(1).optional()`

**Tests to write first:**

```
src/__tests__/rules/shift-handoffs.test.ts (new or extend)
  it('allows creating a handoff without toUid')
  it('rejects a handoff where toUid is null explicitly (exactOptionalPropertyTypes)')
```

### PRE-B.4 — `reportNoteDocSchema` + rules + messages rules fix

**New collection:** `report_notes/{n}` (top-level, separate from responder subcollection)

```typescript
// packages/shared-validators/src/reports.ts
export const reportNoteDocSchema = z
  .object({
    reportId: z.string().min(1),
    authorUid: z.string().min(1),
    body: z.string().max(2000),
    createdAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()
```

**Firestore rules:**

- `match /report_notes/{n}`: allow read to `isActivePrivileged()` + admin roles; allow write to same + `request.auth.uid === request.resource.data.authorUid`
- `match /reports/{id}/messages/{m}`: change `allow write: if false` → allow write to active admin roles (same author-match guard)

**Tests to write first:**

```
src/__tests__/rules/report-notes.test.ts
  it('allows muni admin to write a note with matching authorUid')
  it('denies muni admin writing a note with mismatched authorUid')
  it('denies citizen writing report notes')
  it('denies unauthenticated reads')

src/__tests__/rules/report-messages.test.ts (extend existing)
  it('allows muni admin to write a message to reports subcollection')
  it('still denies citizen writes to messages subcollection')
```

### PRE-B.5 — `commandChannelThreadDocSchema` — add `threadType`

**Add field:**

```typescript
threadType: z.enum(['agency_assistance', 'border_share']),
```

**Tests to write first:**

```
src/__tests__/rules/command-channel.test.ts (extend)
  it('rejects thread creation without threadType')
  it('rejects thread creation with unknown threadType')
```

### PRE-B.6 — `reportSharingDocSchema` — audit fields

**Add fields:**

```typescript
sharedBy: z.string().min(1),
sharedAt: z.number().int(),
sharedReason: z.string().max(500).optional(),
source: z.enum(['manual', 'auto']),
```

**Tests to write first:**

```
src/__tests__/rules/report-sharing.test.ts (extend)
  it('rejects report_sharing write without sharedBy')
  it('rejects report_sharing write without source')
  it('accepts manual share with reason')
  it('accepts auto share without reason')
```

---

## 3. Cluster B — Inter-Agency Coordination

### B.1 — Agency Assistance + `adminOperationsSweep`

#### Tests to write first

**Integration tests** (`src/__tests__/callables/agency-assistance.test.ts`):

```
requestAgencyAssistance
  it rejects a non-muni-admin caller
  it rejects a muni admin requesting assistance for a report in another municipality
  it rejects a request for a terminal-status report
  it creates an agency_assistance_requests doc with status pending
  it creates a command_channel_thread with threadType agency_assistance
  it adds requesting admin UID and active agency admin UIDs to participantUids
  it is idempotent — double-call returns success without duplicate docs

acceptAgencyAssistance
  it rejects a caller whose agencyId does not match the request
  it updates status to accepted
  it is idempotent — double-accept returns success

declineAgencyAssistance
  it rejects a caller whose agencyId does not match the request
  it requires a non-empty reason
  it updates status to declined with reason
  it closes the associated command_channel_thread

adminOperationsSweep (agency escalation path)
  it ignores requests pending for less than 30 minutes
  it updates status to escalated for requests pending over 30 minutes
  it does not re-escalate already-escalated requests
```

Run: `firebase emulators:exec --only firestore,auth "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/agency-assistance.test.ts"`

Each test must fail with a meaningful error before the callable is written. "expected 'accepted' but got undefined" is correct. "Cannot read property of undefined" is a test bug — fix before proceeding.

#### Implementation contract

**`requestAgencyAssistance({ reportId, agencyId, note? })`**

- Auth: `role === 'municipal_admin'`, `accountStatus === 'active'`
- Reads `report_ops/{reportId}` — validates `municipalityId` matches caller's claim, `status` not in terminal set
- Queries `active_accounts` for UIDs where `agencyId === input.agencyId` AND `accountStatus === 'active'` — these become `participantUids` alongside the caller UID
- Transaction: writes `agency_assistance_requests/{id}` + `command_channel_threads/{id}`
- Side effects: FCM to agency admin UIDs; SMS fallback via `send-sms.ts`
- Idempotency: SHA-256 of `(reportId + agencyId)` as `idempotencyKey`

**`acceptAgencyAssistance({ requestId })`**

- Auth: `role === 'agency_admin'`, `agencyId` matches `request.targetAgencyId`
- Updates: `status → 'accepted'`, `respondedAt`, `respondedBy`
- Idempotent on already-accepted

**`declineAgencyAssistance({ requestId, reason })`**

- Auth: same as accept
- Updates: `status → 'declined'`, `declineReason`, `respondedAt`, `respondedBy`
- Closes associated `command_channel_threads` doc (`status → 'resolved'`, `resolvedAt`)

**`adminOperationsSweep`** (scheduled, every 10 min)

- Queries `agency_assistance_requests` where `status === 'pending'` AND `requestedAt < now - 30min` → `status → 'escalated'`, FCM + priority SMS to superadmins
- Queries `shift_handoffs` where `status === 'pending'` AND `initiatedAt < now - 30min` → FCM + priority SMS to superadmins (A.3 will add this path; B.1 only implements the agency escalation path)

#### Agency Admin UI

New route `/agency` in `admin-desktop`, guarded by `role === 'agency_admin'`.

`AgencyAssistanceQueuePage`:

- Lists `agency_assistance_requests` where `targetAgencyId === user.agencyId` via `onSnapshot`
- Filter tabs: Pending / Active / All
- Each row: report link, requesting municipality, note, age, Accept / Decline actions
- Decline opens inline form requiring reason

**UI tests to write first** (`apps/admin-desktop/src/__tests__/agency-assistance-queue.test.tsx`):

```
  it renders pending requests for the agency admin role
  it shows Accept and Decline buttons on pending requests
  it calls acceptAgencyAssistance callable on Accept click
  it requires reason before allowing decline submit
  it does not render for municipal_admin role
```

---

### B.2 — Field Mode

#### Tests to write first

**Integration tests** (`src/__tests__/callables/field-mode.test.ts`):

```
enterFieldMode
  it rejects a muni admin whose auth_time is more than 4 hours ago
  it creates field_mode_sessions/{uid} with isActive true and 12h expiry
  it emits a streaming audit event
  it rejects citizens and responders

exitFieldMode
  it sets isActive false and records exitedAt
  it is idempotent — double-exit returns success
  it rejects callers with no active session
```

**Client tests** (`apps/admin-desktop/src/__tests__/field-mode-store.test.ts`):

```
  it shows ReconnectBanner for verifyReport when offline and not in field mode
  it does NOT show ReconnectBanner for addFieldNote when offline and in field mode
  it shows field mode indicator with time remaining when session is active
  it calls exitFieldMode when session expires
```

#### Implementation contract

**`enterFieldMode()`**

- Auth: `role` in `['municipal_admin', 'agency_admin', 'provincial_superadmin']`
- Validates: `auth.token.auth_time > Date.now() - (4 * 60 * 60 * 1000)` — if stale, return `unauthenticated` with message "Re-authentication required for field mode"
- Writes `field_mode_sessions/{uid}`: `enteredAt`, `expiresAt: enteredAt + 12h`, `isActive: true`, `municipalityId` from claims
- Streaming audit event

**`exitFieldMode()`**

- Updates `field_mode_sessions/{uid}`: `isActive: false`, `exitedAt: now`
- Idempotent
- Streaming audit event

**`useFieldModeStore`** (Zustand, admin-desktop):

- Subscribes to `onSnapshot` on `field_mode_sessions/{uid}` — syncs `isActive`, `expiresAt` to store
- `enter()` / `exit()` call the corresponding callables
- Checks `expiresAt` on a 60-second interval; calls `exit()` when expired
- Exposes `isActive` to mutation UI components

**`ReconnectBanner`** component:

- Shown inline in place of any mutation button when: caller is offline AND (`isActive === false` OR the mutation is not `addFieldNote`/`addMessage`)
- Copy: "Connect to [action]" where action is the blocked mutation label

**Offline write scope:** `addFieldNote` writes to `report_notes/{id}`; `addMessage` writes to `reports/{id}/messages/{id}`. Both use standard Firestore SDK `setDoc`/`addDoc` — the SDK queues them offline and replays on reconnect. No special client code needed beyond not showing the `ReconnectBanner` for these paths when in field mode.

---

### B.3 — OSM Boundary Extraction

#### Script contract

`scripts/extract-boundaries.ts`:

1. Fetches Camarines Norte admin boundary relations from Overpass API
   - Municipalities: `admin_level=8` within relation `Camarines Norte`
   - Barangays: `admin_level=10` within same
2. Maps OSM relation names → internal `municipalityId` / `barangayId` values (requires a name→ID lookup table committed alongside the script)
3. Runs `turf.simplify(feature, { tolerance: 0.001, highQuality: true })` on each polygon
4. Outputs:
   - `packages/shared-data/src/municipality-boundaries.geojson`
   - `packages/shared-data/src/barangay-boundaries.geojson`

**Risk:** OSM boundary quality at 500m precision is unverified for Camarines Norte. After extraction, cross-check 3–5 known boundary points against PhilAtlas or NAMRIA reference. If quality is insufficient, fallback: hardcoded `MUNICIPALITY_ADJACENCY` map (which pairs share borders) used as a coarser substitute in B.4.

**`BOUNDARY_GEOHASH_SET`** (`packages/shared-data/src/boundary-geohash-set.ts`):

- Pre-computed `Set<string>` of all 6-char geohash cells within ~2km of any inter-municipal boundary
- Generated by the extraction script alongside the GeoJSON
- Imported via dynamic `import()` in Cloud Functions at invocation time (not module scope) to avoid cold-start memory penalty

**GeoJSON lazy-loading in CFs:**

```typescript
// Load once per function instance, not per invocation
let municipalityBoundaries: FeatureCollection | null = null
async function getMunicipalityBoundaries() {
  if (!municipalityBoundaries) {
    const { default: data } = await import(
      '@bantayog/shared-data/municipality-boundaries.geojson',
      {
        assert: { type: 'json' },
      }
    )
    municipalityBoundaries = data
  }
  return municipalityBoundaries
}
```

**Tests to write first** (`scripts/__tests__/extract-boundaries.test.ts`):

```
  it produces 12 municipality features
  it maps all municipalityIds to known system IDs
  it produces features with valid GeoJSON Polygon geometry
  it produces at least 280 barangay features
  it generates a non-empty BOUNDARY_GEOHASH_SET
```

---

### B.4 — `report_sharing` + Border Auto-Share

#### Tests to write first

**Integration tests** (`src/__tests__/callables/share-report.test.ts`):

```
shareReport
  it rejects callers from a different municipality than the report
  it creates report_sharing with source manual and sharedBy set
  it creates a command_channel_thread with threadType border_share
  it adds both municipality admin UIDs to participantUids
  it updates report_ops.visibility
  it is idempotent — sharing to same muni twice does not duplicate

borderAutoShareTrigger
  it does not create report_sharing for a report far from any boundary
  it creates report_sharing when report GPS is within 500m of muni boundary
  it uses source auto (not manual)
  it does not re-trigger if report_sharing already exists for this report
  it skips reports with no locationGeohash (SMS barangay-only reports)
```

Run: `firebase emulators:exec --only firestore,auth "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/share-report.test.ts"`

For the trigger test: seed a `report_ops` doc with a `locationGeohash` known to be within 500m of the Daet–Mercedes boundary (pre-compute this geohash from a test coordinate); verify `report_sharing` doc created within 5 seconds.

#### Implementation contract

**`shareReport({ reportId, targetMunicipalityId, reason? })`**

- Auth: `role === 'municipal_admin'` (own muni) or `provincial_superadmin`
- Creates/updates `report_sharing/{reportId}`: adds `targetMunicipalityId` to `sharedWith[]`, sets `sharedBy`, `sharedAt`, `sharedReason`, `source: 'manual'`
- Creates `command_channel_threads/{id}` with both municipality admin UIDs as `participantUids`
- Updates `report_ops.visibility`

**`borderAutoShareTrigger`** (Firestore `onCreate` on `report_ops`):

1. Read `locationGeohash` from new doc — if absent, return early
2. Check `locationGeohash` against `BOUNDARY_GEOHASH_SET` (module-scope cache) — if not in set, return early
3. Load `report_private.exactLocation` (this is the only path that reads `report_private` in this trigger)
4. For each adjacent municipality pair: run `turf.booleanPointInPolygon` against 500m-buffered boundary polygon
5. If within buffer: create `report_sharing/{reportId}` with `source: 'auto'`, create `command_channel_threads/{id}`
6. Guard: check `report_sharing/{reportId}` does not already exist before writing (idempotent)

**Thread auto-close (owned by B.4):** When `report_sharing` is resolved (report reaches terminal status), a `report_ops` `onUpdate` trigger closes the associated `command_channel_threads` doc. This is a small addition to the existing `dispatch-mirror-to-report` trigger pattern.

---

### B.5 — Command Channel UI

#### Tests to write first

**Integration tests** (`src/__tests__/callables/command-channel.test.ts`):

```
addCommandChannelMessage
  it rejects a caller whose UID is not in thread.participantUids
  it rejects an empty body
  it rejects a body over 2000 chars
  it writes the message and updates thread.lastMessageAt
  it is idempotent on retry (same idempotencyKey)
```

**UI tests** (`apps/admin-desktop/src/__tests__/command-channel-panel.test.tsx`):

```
  it renders nothing when the report has no associated thread
  it renders the thread type badge for agency_assistance threads
  it renders the thread type badge for border_share threads
  it lists participant display names
  it shows messages in chronological order
  it submits a message and clears the input on success
  it shows an error state when addCommandChannelMessage callable rejects
```

#### Implementation contract

**`addCommandChannelMessage({ threadId, body })`**

- Auth: caller's UID must be in `thread.participantUids`
- Validates: `body.trim().length > 0`, `body.length <= 2000`
- Writes `command_channel_messages/{id}`
- Updates `command_channel_threads/{threadId}.lastMessageAt`
- Idempotency via `idempotencyKey`

**`CommandChannelPanel`** component (added to `ReportDetailPanel.tsx`):

- Subscribes to `onSnapshot` on `command_channel_threads` where `reportId === currentReportId`
- If thread exists: renders type badge, participant list, messages (via `onSnapshot` on `command_channel_messages` where `threadId`), message input
- Message input: `<textarea>` with character count, send button calls `addCommandChannelMessage`
- Real-time, no polling

**TriageQueuePage:** Report rows with `command_channel_threads.lastMessageAt` within 5 minutes get a "New message" badge.

---

## 4. Cluster A — Admin UI Hardening

### A.1 — Surge Triage Mode

No new callables. No new collections. Pure UI enhancement on `TriageQueuePage.tsx`.

#### Tests to write first

**UI tests** (`apps/admin-desktop/src/__tests__/triage-queue-surge.test.tsx`):

```
  it renders a compact row with severity badge, type, barangay, time-ago, status chip
  it filters reports by severity when severity filter is set
  it filters reports by barangay when barangay filter is set
  it sorts reports by severity descending when sort is Severity
  it sorts reports by oldest-first when sort is Time
  it shows V/R/M/S keyboard shortcut hints
  it calls verifyReport callable on V keypress when a report is selected
  it calls rejectReport callable on R keypress when a report is selected
  it opens MergeModal on M keypress
  it advances selection on S keypress
  it shows bulk action bar when 2+ reports are selected
  it calls verifyReport for each selected report on Verify All Selected
  it increments limit and re-fetches on Load More click
  it shows Showing X of Y count
```

#### Implementation contract

**`useMuniReports` enhancement:**

```typescript
// Replace fixed query with growing limit
const [limitCount, setLimitCount] = useState(100)
// onSnapshot query uses limit(limitCount)
// hook returns: { reports, hasMore, loadMore: () => setLimitCount(n => n + 100) }
```

`hasMore` is true when `reports.length === limitCount`.

**Client-side filter state** (local `useState` or lightweight Zustand slice — no Firestore re-query):

```typescript
{ severities: Severity[], statuses: ReportStatus[], barangayIds: string[], sortBy: 'severity' | 'time' | 'updated' }
```

Applied as an in-memory filter over the `reports` array returned by the hook.

**Keyboard shortcuts:** single `useEffect` + `keydown` listener registered on the page; `stopPropagation` when modal is open to prevent double-firing.

**`severity` standardization:** Remove `severityDerived` from all hooks, seed factories, and component props. Use `severity` enum field from `reportDocSchema` everywhere.

---

### A.2 — Duplicate Clustering

#### Tests to write first

**Integration tests** (`src/__tests__/triggers/duplicate-cluster.test.ts`):

```
duplicateClusterTrigger
  it does not set duplicateClusterId when no nearby reports exist
  it sets duplicateClusterId on both reports when same type + muni + within ~200m + within 2h
  it does not cluster reports of different types
  it does not cluster reports older than 2h
  it assigns the same existing clusterId when a third report joins a cluster
  it skips reports with no locationGeohash
  it is safe to run twice (idempotent cluster assignment)
```

**Integration tests** (`src/__tests__/callables/merge-duplicates.test.ts`):

```
mergeDuplicates
  it rejects a non-muni-admin caller
  it rejects report IDs from different municipalities
  it rejects report IDs that do not share a duplicateClusterId
  it sets status merged_as_duplicate on all non-primary reports
  it sets mergedInto on all non-primary reports
  it aggregates unique mediaRefs from duplicates onto the primary
  it sends SMS to duplicate reporters with followUpConsent true
  it is idempotent
```

#### Implementation contract

**`duplicateClusterTrigger`** (Firestore `onCreate` on `report_ops`):

1. If `locationGeohash` absent: return early
2. Query `report_ops` where `municipalityId` matches + `reportType` matches + `status` not terminal + `createdAt > now - 2h`
3. Pre-filter by 5-char geohash prefix (~5km); then for each candidate compute Turf.js `distance` from new doc's decoded geohash — keep only those within 200m
4. If matches found: assign all to a `duplicateClusterId` (new UUID if none exists, otherwise extend existing cluster)
5. Transaction: update all matched `report_ops` docs

**`mergeDuplicates({ primaryReportId, duplicateReportIds[] })`**

- Auth: `role === 'municipal_admin'`
- Validates: all reports share `duplicateClusterId`, same `municipalityId`
- Transaction:
  - Read all `reports` docs for dedup of `mediaRefs`
  - Update non-primary `reports`: `status → 'merged_as_duplicate'`, `mergedInto → primaryReportId`
  - Update non-primary `report_ops`: status mirror
  - Merge unique `mediaRefs` onto primary `reports` doc
- After transaction: SMS to `report_contacts` where `reportId` in `duplicateReportIds` AND `followUpConsent: true`
- Idempotency via `idempotencyKey`

---

### A.3 — Shift Handoff

#### Tests to write first

**Integration tests** (`src/__tests__/callables/shift-handoff.test.ts`):

```
initiateShiftHandoff
  it rejects citizens and responders
  it creates shift_handoffs doc with status pending and no toUid
  it builds activeIncidentSnapshot from live Firestore state
  it includes active dispatches in the snapshot
  it includes pending agency_assistance_requests in the snapshot
  it is idempotent

acceptShiftHandoff
  it rejects a caller from a different municipality
  it updates status to accepted and sets toUid
  it is idempotent — double-accept returns success

shiftHandoffExpirationSweep
  it ignores handoffs pending less than 30 minutes
  it FCMs superadmin for handoffs pending over 30 minutes
  it does not re-escalate already-escalated handoffs
```

#### Implementation contract

**`initiateShiftHandoff({ notes, activeIncidentIds[] })`**

- Auth: `role` in `['municipal_admin', 'agency_admin']`
- Snapshot query (server-side): `report_ops` where `municipalityId` matches + `status` in `['assigned', 'acknowledged', 'en_route']`; `dispatches` where `municipalityId` matches + `status === 'accepted'`; `agency_assistance_requests` where `requestingMunicipalityId` matches + `status === 'pending'`
- Creates `shift_handoffs/{id}`: `status: 'pending'`, `fromUid`, `initiatedAt`, `notes`, `activeIncidentSnapshot[]`
- FCM to all other active admins in same muni/agency
- Idempotency via `idempotencyKey`

**`acceptShiftHandoff({ handoffId })`**

- Auth: same roles, same municipality/agency as the handoff
- Updates: `status → 'accepted'`, `toUid: auth.uid`, `acceptedAt`
- FCM to `fromUid`
- Idempotent

**Extend `adminOperationsSweep`** (already built in B.1 — A.3 adds the shift handoff path):

- Add: query `shift_handoffs` where `status === 'pending'` AND `initiatedAt < now - 30min`
- FCM + priority SMS to provincial superadmins
- Sets `status → 'escalated'` on processed docs
- No new scheduled CF needed — `adminOperationsSweep` already runs every 10 min

**UI:**

- "Start Handoff" button in admin desktop header
- `ShiftHandoffModal`: notes textarea + pre-populated active incidents list (Firestore query on mount) + "Initiate" button
- Incoming handoff banner: `onSnapshot` on `shift_handoffs` where `municipalityId` matches + `status === 'pending'` → shows banner with "Accept" button for all other admins

---

## 5. PRE-C — Schema Foundation for Cluster C

All 3 items must land before C.1 starts.

### PRE-C.1 — `responderDocSchema` — `fcmToken` field

```typescript
fcmToken: z.string().optional(),
// Phase 6: migrate to push_subscriptions/{uid}/{deviceId} subcollection for multi-device
```

**Tests to write first:**

```
src/__tests__/rules/responders.test.ts (extend)
  it allows responder to write their own fcmToken
  it denies other responders reading another responder fcmToken
```

### PRE-C.2 — `reportContactsDocSchema` — consent + municipality

```typescript
municipalityId: z.string().min(1),
followUpConsent: z.boolean().default(false),
```

Update `processInboxItem.ts` (and citizen PWA `submitReport`) to write both fields.

**Tests to write first:**

```
src/__tests__/triggers/process-inbox-item.test.ts (extend)
  it writes municipalityId onto report_contacts when materializing
  it writes followUpConsent true when reporter gave consent
  it writes followUpConsent false when reporter gave no consent
```

### PRE-C.3 — `massAlertRequestDocSchema` — status enum expansion

```typescript
status: z.enum([
  'queued',
  'sent',
  'pending_ndrrmc_review',
  'submitted_to_pdrrmo',
  'forwarded_to_ndrrmc',
  'acknowledged_by_ndrrmc',
  'declined',
  'cancelled',
])
```

**Tests to write first:**

```
src/__tests__/rules/mass-alert-requests.test.ts (new)
  it allows muni admin to create a request with status queued
  it allows muni admin to create a request with status pending_ndrrmc_review
  it denies creation with status forwarded_to_ndrrmc (superadmin-only transition)
  it denies citizen writes
```

---

## 6. Cluster C — Broadcast + Intelligence

### C.1 — Mass Alert + Reach Plan

#### Tests to write first

**Integration tests** (`src/__tests__/callables/mass-alert.test.ts`):

```
massAlertReachPlanPreview
  it rejects citizens and responders
  it rejects a muni admin scoping to a different municipality
  it returns fcmCount as count of responders with fcmToken in scope municipality
  it returns smsCount as count of report_contacts with followUpConsent true in scope municipality
  it returns route direct when totalEstimate <= 5000 and scope is single muni
  it returns route ndrrmc_escalation when totalEstimate > 5000
  it returns route ndrrmc_escalation when scope spans multiple municipalities
  it returns unicodeWarning true when message contains UCS-2 characters
  it returns correct segmentCount for GSM-7 messages
  it returns correct segmentCount for UCS-2 messages

sendMassAlert
  it rejects when reachPlan.route is ndrrmc_escalation
  it creates mass_alert_requests doc with status sent
  it refuses to send to a different municipality than the caller's claim (muni admin)
  it is idempotent

requestMassAlertEscalation
  it creates mass_alert_requests doc with status pending_ndrrmc_review
  it FCMs provincial superadmins

forwardMassAlertToNDRRMC
  it rejects non-superadmin callers
  it updates status to forwarded_to_ndrrmc
  it records forwardMethod and ndrrrcRecipient
  it rejects forwarding a request that is not pending_ndrrmc_review
```

**UI tests** (`apps/admin-desktop/src/__tests__/mass-alert-modal.test.tsx`):

```
  it shows GSM-7 indicator and correct segment count for ASCII message
  it shows UCS-2 warning when message contains unicode characters
  it shows Preview Reach button
  it shows fcmCount and smsCount after preview loads
  it shows Direct Send badge when route is direct
  it shows NDRRMC Escalation badge when route is ndrrmc_escalation
  it disables Send button when route is ndrrmc_escalation
  it shows Request NDRRMC Escalation button when route is ndrrmc_escalation
  it calls sendMassAlert on Send click (direct path)
  it calls requestMassAlertEscalation on escalation CTA click
```

#### Implementation contract

**`massAlertReachPlanPreview({ targetScope, message })`**

- Auth: `role` in `['municipal_admin', 'agency_admin']` (own muni) or `provincial_superadmin`
- FCM count: `count()` on `responders` where `municipalityId` in `targetScope.municipalityIds` AND `fcmToken` is set (use `where('fcmToken', '!=', null)`)
- SMS count: `count()` on `report_contacts` where `municipalityId` in `targetScope.municipalityIds` AND `followUpConsent === true`
- Routing: `total <= 5000 AND targetScope.municipalityIds.length === 1` → `'direct'`; else → `'ndrrmc_escalation'`
- GSM-7 check: test message against `/[^ - £¥§¿À-ÖØ-öø-ÿ€]/` — if match, UCS-2; segment size 70 chars; else 160 chars

**`sendMassAlert({ reachPlan, message, targetScope })`**

- Validates `reachPlan.route === 'direct'` — hard `permission-denied` if escalation
- Creates `mass_alert_requests/{id}` status `'sent'`
- FCM batch: `fcm-send.ts` `sendEachForMulticast` (500 tokens/batch); query responder tokens from `responders` collection
- SMS: `send-sms.ts` priority queue — query `report_contacts` with consent, enqueue each to `sms_outbox`
- Streaming audit with `targetScope` geometry

**`requestMassAlertEscalation({ message, targetScope, evidencePack })`**

- Creates `mass_alert_requests/{id}` status `'pending_ndrrmc_review'`
- `evidencePack: { linkedReportIds: string[], pagasaSignalRef?: string, notes?: string }`
- FCM + priority SMS to provincial superadmins

**`forwardMassAlertToNDRRMC({ requestId, forwardMethod, ndrrrcRecipient })`**

- Auth: `provincial_superadmin` only
- Validates `request.status === 'pending_ndrrmc_review'`
- Updates: `status → 'forwarded_to_ndrrmc'`, `forwardedAt`, `forwardMethod`, `ndrrrcRecipient`
- Streaming audit

**UI copy invariant:** Every surface that references this flow must say "Escalation submitted to NDRRMC" — never "Alert sent via ECBS" or "Alert dispatched." The system does not claim to have issued an ECBS alert.

---

### C.2 — Admin Analytics

#### Tests to write first

**Integration tests** (`src/__tests__/triggers/analytics-snapshot-writer.test.ts`):

```
analyticsSnapshotWriter
  it writes a snapshot doc for each municipality
  it counts reports by status correctly
  it counts reports by severity correctly
  it includes top 20 barangays by report count
  it writes a province-wide aggregate for superadmin scope
  it is idempotent — re-running overwrites, not duplicates
  it handles a municipality with zero reports without erroring
```

**UI tests** (`apps/admin-desktop/src/__tests__/analytics-dashboard.test.tsx`):

```
  it renders the live active-incidents count from Firestore count() query
  it renders 7-day trend chart from analytics_snapshots
  it renders 30-day top barangays from analytics_snapshots
  it scopes data to the caller's municipalityId for muni admins
  it shows all municipalities for superadmin
  it shows a loading state while snapshot data is fetching
  it shows an empty state when no snapshots exist yet
```

#### Implementation contract

**`analyticsSnapshotWriter`** (scheduled CF, daily at 00:05 UTC):

Per municipality, writes `analytics_snapshots/{YYYY-MM-DD}/{municipalityId}`:

```typescript
{
  date: string,
  municipalityId: string,
  reportsByStatus: Record<ReportStatus, number>,     // Firestore count() per status value
  reportsBySeverity: Record<Severity, number>,       // Firestore count() per severity value
  reportsByBarangay: { barangayId: string, count: number }[],  // top 20, last 30 days
  reportsByHourOfDay: number[],     // 24 buckets, rolling 7-day average
  dispatchAcceptRateLast7Days: number,
  avgDispatchAcceptTimeMsLast7Days: number,
  agencyResponseTimeP95MsLast7Days: number,
  totalReportsLast30Days: number,
  totalReportsLast7Days: number,
  generatedAt: Timestamp,
  schemaVersion: number,
}
```

Uses Firestore `count()` aggregate queries — no full document reads for counts. Uses `getDocs` with `orderBy + limit` only for derived metrics requiring individual timestamps.

Also writes one province-wide aggregate doc at `analytics_snapshots/{YYYY-MM-DD}/province` for superadmin dashboard.

**`AnalyticsDashboardPage`** (route `/analytics`):

- **Live section:** Firestore `count()` queries for active `reports` by status + severity (real-time via React Query 30s interval refetch — not `onSnapshot`, counts don't need millisecond freshness)
- **Trend section:** reads last 7 `analytics_snapshots/{date}/{callerMunicipalityId}` docs via `getDocs`
- **Summary section:** reads last 30 `analytics_snapshots` docs for top barangays + operational metrics
- **Charts:** inline SVG only — no charting dependency. Add Recharts in Phase 10 if needed.
  - Status distribution: horizontal `<rect>` bars with proportional widths
  - Severity distribution: `<circle>` with `stroke-dasharray` arcs
  - Barangay counts: sorted `<rect>` bars, top 10
  - Hourly distribution: `<polyline>` on 24-point grid

---

## 7. Testing Infrastructure Notes

### Firebase emulator test commands (per cluster)

```bash
# Rules tests (PRE-B + PRE-C)
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rules/"

# Callable integration tests (B.1, B.2, B.4, B.5, A.2, A.3, C.1)
firebase emulators:exec --only firestore,auth "pnpm --filter @bantayog/functions exec vitest run src/__tests__/callables/[name].test.ts"

# Trigger tests (B.4, A.2, C.2)
firebase emulators:exec --only firestore,auth "pnpm --filter @bantayog/functions exec vitest run src/__tests__/triggers/[name].test.ts"

# Admin desktop UI tests
pnpm --filter @bantayog/admin-desktop exec vitest run

# Full turbo lint + typecheck gate
npx turbo run lint typecheck
```

### Mock discipline

Per `docs/learnings.md`: if a callable test needs more than ~20 lines of mock setup, it is testing mocks, not behavior. Use Firebase emulator integration tests for callables and triggers. Reserve unit tests with mocks for pure utility functions (GSM-7 check, geohash proximity math, reach plan routing logic).

`vi.hoisted()` required when a mock function needs per-test `mockImplementationOnce` / `mockRejectedValueOnce`.

### TDD cycle per feature

For every callable, trigger, and UI component:

1. Write the test file with all behavioral tests as `it.todo` stubs
2. Pick the first stub, implement it fully — watch it fail with a meaningful error
3. Write minimal implementation code — watch it pass
4. Move to next stub
5. After all stubs pass: refactor, lint, typecheck

**Red flag:** if a test passes immediately after being written (before any implementation), the test is not testing new behavior. Fix the test before proceeding.

---

## 8. Exit Criteria

### Cluster B complete when:

- All B.1–B.5 integration + UI tests pass
- Agency Admin can request, accept, decline assistance end-to-end in staging
- Border-auto-share fires correctly for a seeded report at a known boundary coordinate
- Command channel visible in ReportDetailPanel for both thread types

### Cluster A complete when:

- Surge triage drill: 300 synthetic reports render + are filterable + keyboard shortcuts work
- Duplicate cluster badge appears for seeded near-simultaneous reports
- Shift handoff initiates, shows incoming banner to other admin, accepts cleanly

### Cluster C complete when:

- Reach Plan preview returns correct route for a direct-path and an escalation-path scope
- Direct `sendMassAlert` fans out to all seeded responder FCM tokens in the municipality
- NDRRMC escalation request creates the doc + notifies superadmin
- Analytics dashboard shows live counts + 7-day trend for a seeded dataset

### Phase 5 complete when:

- `npx turbo run lint typecheck` — PASS
- All new test files pass against Firebase emulators
- Admin desktop E2E smoke (`pnpm --filter @bantayog/e2e-tests exec playwright test specs/admin.spec.ts`) — PASS
- `docs/progress.md` updated with verified exit criteria per cluster
