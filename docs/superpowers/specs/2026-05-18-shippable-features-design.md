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

- Rename `declareEmergencyCore` → `declareAlertCore`
- Rename `declareEmergency` → `declareAlert`
- Add optional `reportId: z.string().uuid().optional()` to input schema
- Store `reportId` in alert doc if provided
- Change `alertType: 'emergency'` → `alertType: 'alert'`
- Update audit event type: `emergency_declared` → `alert_declared`

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

### Section 3A: Admin Photo Gallery (FeedPage)

**File:** `apps/admin-desktop/src/pages/FeedPage.tsx`

Add to each report row:

- Photo thumbnail strip showing images from `reports/{id}/media`
- Checkboxes on each thumbnail to select "featured" photos
- Featured selection saved to `reports/{id}.featuredMediaIds: string[]`
- Grid layout: 3-4 thumbnails per row, ~80px each

**How media is accessed:**

- `onMediaFinalize` trigger already populates `reports/{id}/media` array with storage paths
- Generate download URLs via Storage SDK or construct public URLs
- Store selected featured IDs via Firestore update (no new callable needed — admin has write access)

### Section 3B: FeedCard Thumbnails (citizen-pwa)

**File:** `apps/citizen-pwa/src/components/FeedTab.tsx`

Modify `FeedCard` component:

- If `incident.mediaUrls` has entries, render thumbnail strip between header and footer
- 1-3 thumbnails in horizontal row, ~60px tall, rounded corners
- Lazy-loaded images with placeholder
- Falls back to text-only card if no media

**Data flow changes:**

**File:** `apps/citizen-pwa/src/hooks/usePublicIncidents.ts`

- Include `mediaUrls` in returned `PublicIncident` objects
- Map from `reports/{id}/media` or `featuredMediaIds`

**File:** `packages/shared-types/src/`

- Add `featuredMediaIds?: string[]` to report type
- Add `mediaUrls?: string[]` to `PublicIncident` type

### Storage Access

- `report_media/{municipalityId}/{reportId}/{filename}` paths already exist
- Citizens need public read access to finalize media files
- Verify/add Firestore Storage rule for `report_media/**` public read

### Files Changed

| File                           | Change                                                         |
| ------------------------------ | -------------------------------------------------------------- |
| `FeedPage.tsx`                 | Add photo thumbnail strip + checkbox selection                 |
| `callables.ts` (admin)         | No change needed — direct Firestore write for featuredMediaIds |
| `FeedTab.tsx`                  | Add thumbnail strip rendering in FeedCard                      |
| `usePublicIncidents.ts`        | Include mediaUrls in returned incidents                        |
| `packages/shared-types/src/`   | Add featuredMediaIds + mediaUrls to types                      |
| `infra/firebase/storage.rules` | Verify public read for report_media                            |

## Risks and Mitigations

| Risk                                             | Mitigation                                             |
| ------------------------------------------------ | ------------------------------------------------------ |
| FCM push can't be tested in emulator             | Unit test with mocked messaging; smoke test on staging |
| Storage URLs not publicly readable               | Add/verify storage rules for `report_media/**`         |
| Image bandwidth on mobile                        | Lazy loading, small thumbnails, max 3 per card         |
| `declareAlert` rename breaks existing references | Search all call sites; update tests                    |
| More files changed in Section 3 (~5)             | Implement incrementally, verify each step              |

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
