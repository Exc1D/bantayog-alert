# Design Spec: Remaining Features for Shippable Status

**Date:** 2026-05-18
**Status:** Draft — pending review
**Branch:** feat/admin-feed-moderation

## Overview

Three feature gaps prevent Bantayog Alert from reaching shippable status:

1. **Alert Issuance UI** — admin-desktop has no UI to trigger `declareAlert` callable
2. **Push Notifications** — `declareAlert` writes Firestore but never sends FCM push
3. **Photo Selection for Feed** — media infrastructure exists but FeedCard is text-only

Implementation follows vertical slices: complete each feature end-to-end before starting the next.

## Decisions

| Decision                  | Choice                                  | Rationale                                                     |
| ------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| Alert UI placement        | Both header button + report panel       | Covers standalone emergencies and report-linked escalations   |
| Push notification content | Text-only (Phase 1)                     | Simple, reliable, no image URL complexity                     |
| Photo display in FeedCard | Inline thumbnails                       | Scannable feed, visual context at a glance                    |
| Callable naming           | `declareAlert` (not `declareEmergency`) | "Emergency" has legal/operational weight beyond Phase 1 scope |

## Section 1: Alert Issuance UI

### Architecture

Two entry points, one shared modal component:

1. **CommandHeader** — red "Declare Alert" button visible on all admin pages
2. **TriagePanel** — "Declare Alert" button at bottom, only for verified+ reports

Both open `DeclareAlertModal` with the same form:

- Hazard type selector (dropdown)
- Municipality multi-select (checkboxes)
- Message textarea (max 500 chars)
- Submit → calls `callables.declareAlert()`

When opened from TriagePanel, the modal pre-fills:

- `affectedMunicipalityIds` with the report's municipality
- `reportId` to link the alert to the incident

### Backend Changes

**File:** `functions/src/callables/declare-emergency.ts` → rename to `declare-alert.ts`

Rename scope (17 references across 6+ files):

- `functions/src/callables/declare-emergency.ts` → rename file, rename `declareEmergencyCore` → `declareAlertCore`, `declareEmergency` → `declareAlert`
- `functions/src/index.ts` — update export
- `functions/lib/` — rebuild compiled JS + `.d.ts` declarations
- `functions/src/__tests__/callables/declare-emergency.test.ts` → rename file, update imports and describe blocks
- `apps/admin-desktop/src/services/callables.ts` — rename `declareEmergency` → `declareAlert`, update callable name string
- `functions/src/__tests__/callables/` — update any imports of the renamed function

Schema changes:

- Add optional `reportId: z.string().uuid().optional()` to input schema
- Store `reportId` in alert doc if provided
- Change `alertType: 'emergency'` → `alertType: 'alert'`
- Update audit event type: `emergency_declared` → `alert_declared`

No rate limiting added — MFA + role-gating (`PRIVILEGED_ROLES`) is considered sufficient for Phase 1. Admins declaring alerts are trusted operators; abuse would be caught by audit trail.

### Frontend Changes (admin-desktop)

**New file:** `apps/admin-desktop/src/components/DeclareAlertModal.tsx`

- Modal with hazard type dropdown, municipality multi-select, message textarea
- Submit calls `callables.declareAlert()`
- Loading state, error display, success confirmation

**Modified:** `apps/admin-desktop/src/components/CommandHeader.tsx`

- Add "Declare Alert" button (red, always visible)
- Button opens `DeclareAlertModal` (managed by parent or local state)

**Modified:** `apps/admin-desktop/src/components/TriagePanel.tsx`

- Add "Declare Alert" button below dispatch controls
- Only visible for `verified`, `assigned`, `acknowledged`, `en_route`, `on_scene`, `reopened` statuses
- Opens `DeclareAlertModal` with pre-filled context

**Modified:** `apps/admin-desktop/src/services/callables.ts`

- Rename `declareEmergency` → `declareAlert`
- Add optional `reportId?: string` to payload type

### Data Flow

```
Admin clicks "Declare Alert" → fills form → submit
  → declareAlert callable (MFA required, privileged roles only)
    → validates input
    → writes alerts/{alertId} doc
    → streams audit event (alert_declared)
    → returns { alertId }
  → modal closes, shows success
```

## Section 2: Push Notifications

### Architecture

After writing the alert doc in `declareAlertCore`, send FCM push to topic `alerts`.

### Implementation

**File:** `functions/src/callables/declare-alert.ts` (same file as Section 1)

Add after the `db.collection('alerts').doc(alertId).set(...)` call:

```ts
// Best-effort FCM push — don't fail alert creation if push fails
try {
  const { messaging } = await import('firebase-admin')
  await messaging().sendToTopic('alerts', {
    notification: {
      title: 'Alert Issued',
      body: validated.message,
    },
    data: {
      alertId,
      hazardType: validated.hazardType,
    },
  })
} catch (err: unknown) {
  console.error('FCM push failed:', err)
  // Alert doc is source of truth; push is best-effort
}
```

### Why This Works

- `subscribeToAlerts` callable already subscribes citizen FCM tokens to topic `alerts`
- `subscribeAlerts` client hook in citizen-pwa already works
- No new FCM infrastructure needed — just add `sendToTopic` call

### Testing

- Unit test: mock `messaging().sendToTopic` and verify it's called with correct payload
- E2E: can't test actual push delivery in emulator (needs real FCM credentials)
- Verify code path executes without errors via emulator test with mocked messaging

## Section 3: Photo Selection for Feed

### Media Architecture (corrected)

Media is stored as a **subcollection** `reports/{id}/media/{uploadId}`, not an array field.
Each media doc has: `uploadId`, `storagePath`, `mimeType`, `strippedAt`, `addedAt`.

The `reports/{id}` doc already has a `mediaRefs: string[]` field (storage paths), populated by
`processInboxItem` during materialization. This field is already allowed in the Firestore update rules
(`affectedKeys().hasOnly([...mediaRefs...])`).

**Approach:** Use `mediaRefs` (existing field) for the admin gallery. Add a new field
`featuredMediaIds: string[]` on the report doc to track which photos are selected for the public feed.
This requires adding `featuredMediaIds` to the Firestore rules `affectedKeys()` allowlist.

### Section 3A: Admin Photo Gallery (FeedPage)

**File:** `apps/admin-desktop/src/pages/FeedPage.tsx`

Add to each report row:

- Photo thumbnail strip showing images from `reports/{id}/media` subcollection
  - Query the subcollection via `collection(db, 'reports', reportId, 'media')`
  - Convert `storagePath` values (e.g. `report_media/daet/report-1/photo.jpg`) to download URLs
    using `getDownloadURL()` from `firebase/storage`
- Checkboxes on each thumbnail to select "featured" photos
- Featured selection saved as `reports/{id}.featuredMediaIds: string[]` (array of `uploadId`s)
- Grid layout: 3-4 thumbnails per row, ~80px each

**Firestore rules change required** (must show diff to user before editing):

Add `featuredMediaIds` to the allowed keys in `firestore.rules` line 131:

```
.hasOnly(['status', 'updatedAt', 'verifiedAt', 'assignedAt', 'closedAt',
          'rejectedAt', 'rejectedReason', 'barangayId', 'severity',
          'mediaRefs', 'hazardTagList', 'featuredMediaIds'])
```

### Section 3B: FeedCard Thumbnails (citizen-pwa)

**File:** `apps/citizen-pwa/src/components/FeedTab.tsx`

Modify `FeedCard` component:

- If `incident.featuredMediaUrls` has entries, render thumbnail strip between header and footer
- 1-3 thumbnails in horizontal row, ~60px tall, rounded corners
- Lazy-loaded images with placeholder
- Falls back to text-only card if no media

**Data flow changes:**

**File:** `apps/citizen-pwa/src/hooks/usePublicIncidents.ts`

- Current hook queries `reports` collection with `visibilityClass == 'public_alertable'`
- For each report, if `featuredMediaIds` is populated, also fetch the matching media subcollection docs
  to get `storagePath` values
- Convert storage paths to download URLs using `getDownloadURL()`
- Include `featuredMediaUrls: string[]` in returned `PublicIncident` objects
- **Performance note:** This adds N subcollection reads. To avoid N+1, batch-fetch media for all
  visible reports using `Promise.all` or a single collectionGroup query if indexes allow.

**File:** `packages/shared-types/src/`

- Add `featuredMediaIds?: string[]` to report type
- Add `featuredMediaUrls?: string[]` to `PublicIncident` type

### Storage Access

**Blocker:** `report_media/**` read is **explicitly denied for citizens** in storage rules
(`functions/src/__tests__/storage.rules.test.ts` line 235: `citizen read report_media fails`).

**Solution:** Add a storage rule allowing public read for finalized (non-pending) images:

```
match /report_media/{municipalityId}/{reportId}/{filename} {
  allow read: if true;  // Public read for finalized citizen-visible images
}
```

This is safe because:

- Only images that passed `onMediaFinalize` (EXIF-stripped, MIME-validated) reach this path
- Images in `pending/` are not affected — they remain restricted
- The citizen feed only shows `public_alertable` reports, so leaked images are already public-facing

Alternatively, use `getDownloadURL()` from the Firebase Storage SDK which generates time-limited
signed URLs. This avoids changing storage rules but requires the SDK to be initialized with proper
auth. Since citizens may be anonymous, the public read rule is simpler and more reliable.

### Files Changed

| File                                            | Change                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `FeedPage.tsx`                                  | Add photo subcollection query + thumbnail strip + checkbox selection                   |
| `FeedTab.tsx`                                   | Add thumbnail strip rendering in FeedCard                                              |
| `usePublicIncidents.ts`                         | Include featuredMediaUrls in returned incidents (subcollection fetch + URL conversion) |
| `packages/shared-types/src/`                    | Add featuredMediaIds + featuredMediaUrls to types                                      |
| `infra/firebase/firestore.rules`                | Add `featuredMediaIds` to allowedKeys for report updates                               |
| `infra/firebase/storage.rules`                  | Add public read rule for `report_media/{muni}/{reportId}/{filename}`                   |
| `functions/src/__tests__/storage.rules.test.ts` | Add test for citizen public read of finalized report_media                             |

## Risks and Mitigations

| Risk                                            | Mitigation                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| FCM push can't be tested in emulator            | Unit test with mocked messaging; smoke test on staging                                             |
| Storage rules block citizen photo access        | Add public read rule for finalized `report_media/{muni}/{reportId}/{filename}`; test with emulator |
| Firestore rules change for `featuredMediaIds`   | Must show diff to user before editing `firestore.rules` (AGENTS.md §6 requirement)                 |
| Image bandwidth on mobile                       | Lazy loading, small thumbnails, max 3 per card                                                     |
| `declareAlert` rename scope (17 refs, 6+ files) | Systematic search + rebuild `functions/lib/`; update all test files                                |
| N+1 subcollection reads in FeedPage             | Batch-fetch media for all visible reports via `Promise.all` or collectionGroup query               |
| Storage paths are not URLs                      | Use `getDownloadURL()` from `firebase/storage` SDK to convert `storagePath` → usable URL           |
| No rate limiting on `declareAlert`              | MFA + role-gating + audit trail considered sufficient for Phase 1; revisit if abuse detected       |

## Verification Plan

After each slice:

**Slice 1 (Alert UI):**

```
pnpm --dir apps/admin-desktop typecheck && pnpm --dir apps/admin-desktop lint
pnpm --dir apps/admin-desktop exec vitest run
pnpm --dir functions typecheck && pnpm --dir functions lint
```

**Slice 2 (Push):**

```
pnpm --dir functions typecheck && pnpm --dir functions lint
firebase emulators:exec --only firestore,database,storage 'npx vitest run'  # from functions/
```

**Slice 3 (Photos):**

```
pnpm --dir apps/citizen-pwa typecheck && pnpm --dir apps/citizen-pwa lint
pnpm --dir apps/admin-desktop typecheck && pnpm --dir apps/admin-desktop lint
pnpm --dir apps/admin-desktop exec vitest run
```

## Deferred to Phase 2

- Three-app dispatch coordination (admin → callable → responder subscription)
- NDRRMC escalation, mass alert broadcast, SMS pipeline, PAGASA signals
- Observability dashboards
