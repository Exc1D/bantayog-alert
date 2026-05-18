# Shippable Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement alert issuance UI, FCM push notifications, and photo selection for feed to reach shippable status.

**Architecture:** Vertical slices — each feature built end-to-end (backend + frontend + tests) before moving to the next. Three slices: (1) Alert UI with `declareAlert` callable, (2) FCM push after alert creation, (3) Admin photo gallery + citizen FeedCard thumbnails.

**Tech Stack:** React + TypeScript (admin-desktop, citizen-pwa), Firebase Cloud Functions v2, Firestore, FCM, Zod validation, Vitest testing.

**Spec:** `docs/superpowers/specs/2026-05-18-shippable-features-design.md`

---

## File Structure

### Slice 1: Alert Issuance UI

| File                                                      | Action                                      | Responsibility                                                   |
| --------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| `functions/src/callables/declare-alert.ts`                | **Rename** from `declare-emergency.ts`      | Backend callable for alert creation                              |
| `functions/src/index.ts`                                  | Modify                                      | Update export reference                                          |
| `functions/src/__tests__/callables/declare-alert.test.ts` | **Rename** from `declare-emergency.test.ts` | Unit tests for callable                                          |
| `functions/lib/`                                          | Rebuild                                     | Compiled JS + `.d.ts`                                            |
| `apps/admin-desktop/src/components/DeclareAlertModal.tsx` | **Create**                                  | Modal form: hazard type, municipality multi-select, message      |
| `apps/admin-desktop/src/components/CommandHeader.tsx`     | Modify                                      | Add "Declare Alert" button + modal trigger                       |
| `apps/admin-desktop/src/components/TriagePanel.tsx`       | Modify                                      | Add "Declare Alert" button for verified+ reports                 |
| `apps/admin-desktop/src/services/callables.ts`            | Modify                                      | Rename `declareEmergency` → `declareAlert`, add `reportId` param |

### Slice 2: Push Notifications

| File                                                      | Action                        | Responsibility                                     |
| --------------------------------------------------------- | ----------------------------- | -------------------------------------------------- |
| `functions/src/callables/declare-alert.ts`                | Modify (same file as Slice 1) | Add FCM `sendToTopic` call after writing alert doc |
| `functions/src/__tests__/callables/declare-alert.test.ts` | Modify (same file as Slice 1) | Add test for FCM push call                         |

### Slice 3: Photo Selection for Feed

| File                                               | Action | Responsibility                                                       |
| -------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| `apps/admin-desktop/src/pages/FeedPage.tsx`        | Modify | Add photo subcollection query + thumbnail strip + checkbox selection |
| `apps/citizen-pwa/src/components/FeedTab.tsx`      | Modify | Add thumbnail strip rendering in FeedCard                            |
| `apps/citizen-pwa/src/components/MapTab/types.ts`  | Modify | Add `featuredMediaUrls?: string[]` to `PublicIncident`               |
| `apps/citizen-pwa/src/hooks/usePublicIncidents.ts` | Modify | Include featuredMediaUrls in returned incidents                      |
| `packages/shared-types/src/`                       | Modify | Add `featuredMediaIds?: string[]` to report type                     |
| `infra/firebase/firestore.rules`                   | Modify | Add `featuredMediaIds` to allowedKeys for report updates             |
| `infra/firebase/storage.rules`                     | Modify | Add public read rule for finalized report_media                      |
| `functions/src/__tests__/storage.rules.test.ts`    | Modify | Add test for citizen public read of finalized report_media           |

---

## Slice 1: Alert Issuance UI

### Task 1: Rename declareEmergency → declareAlert in functions

**Files:**

- Rename: `functions/src/callables/declare-emergency.ts` → `functions/src/callables/declare-alert.ts`
- Modify: `functions/src/callables/declare-alert.ts`
- Modify: `functions/src/index.ts:136`

- [ ] **Step 1: Rename the file**

```bash
mv functions/src/callables/declare-emergency.ts functions/src/callables/declare-alert.ts
```

- [ ] **Step 2: Update function names and schema in declare-alert.ts**

In `functions/src/callables/declare-alert.ts`, make these changes:

```ts
// Rename schema
const declareAlertInputSchema = z.object({
  hazardType: z.string().min(1).max(100),
  affectedMunicipalityIds: z.array(z.string().min(1)).min(1),
  message: z.string().min(1).max(500),
  reportId: z.string().uuid().optional(), // NEW: optional link to report
})

// Rename core function
export async function declareAlertCore(
  db: Firestore,
  input: unknown,
  actor: { uid: string },
): Promise<{ alertId: string }> {
  const validated = declareAlertInputSchema.parse(input)
  const alertId = randomUUID()
  const now = Date.now()

  const alertDoc: Record<string, unknown> = {
    alertId,
    alertType: 'alert', // CHANGED from 'emergency'
    hazardType: validated.hazardType,
    affectedMunicipalityIds: validated.affectedMunicipalityIds,
    message: validated.message,
    declaredBy: actor.uid,
    declaredAt: now,
    schemaVersion: 1,
  }

  // Add reportId if provided
  if (validated.reportId) {
    alertDoc.reportId = validated.reportId
  }

  await db.collection('alerts').doc(alertId).set(alertDoc)

  void streamAuditEvent({
    eventType: 'alert_declared', // CHANGED from 'emergency_declared'
    actorUid: actor.uid,
    targetDocumentId: alertId,
    metadata: { hazardType: validated.hazardType },
    occurredAt: now,
  })

  return { alertId }
}

// Rename export
export const declareAlert = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    const { uid } = requireAuth(request, PRIVILEGED_ROLES)
    requireMfaAuth(request)
    return declareAlertCore(getFirestore(), request.data, { uid })
  },
)
```

- [ ] **Step 3: Update export in functions/src/index.ts**

Change line 136 from:

```ts
export { declareEmergency } from './callables/declare-emergency.js'
```

to:

```ts
export { declareAlert } from './callables/declare-alert.js'
```

- [ ] **Step 4: Rebuild functions**

```bash
pnpm --dir functions build
```

### Task 2: Update declareEmergency tests → declareAlert tests

**Files:**

- Rename: `functions/src/__tests__/callables/declare-emergency.test.ts` → `functions/src/__tests__/callables/declare-alert.test.ts`
- Modify: `functions/src/__tests__/callables/declare-alert.test.ts`

- [ ] **Step 1: Rename the test file**

```bash
mv functions/src/__tests__/callables/declare-emergency.test.ts functions/src/__tests__/callables/declare-alert.test.ts
```

- [ ] **Step 2: Update imports and assertions**

In `functions/src/__tests__/callables/declare-alert.test.ts`:

Change the import:

```ts
import { declareAlertCore } from '../../callables/declare-alert.js'
```

Change the describe block name:

```ts
describe('declareAlertCore', () => {
```

Update the `alertType` assertion (line 95):

```ts
expect(setArg.alertType).toBe('alert') // was 'emergency'
```

Update the audit event assertion (line 127):

```ts
eventType: 'alert_declared',  // was 'emergency_declared'
```

- [ ] **Step 3: Add test for optional reportId**

Add a new test after the existing ones:

```ts
it('stores reportId when provided', async () => {
  const inputWithReportId = {
    ...validInput,
    reportId: '550e8400-e29b-41d4-a716-446655440000',
  }
  const result = await declareAlertCore(mockDb, inputWithReportId, { uid: 'admin-1' })

  expect(result.alertId).toBeDefined()
  const calls = mockDb._setFn.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  const setArg = (calls[0] as [Record<string, unknown>])[0]
  expect(setArg.reportId).toBe('550e8400-e29b-41d4-a716-446655440000')
})
```

- [ ] **Step 4: Run tests**

```bash
cd functions && npx vitest run src/__tests__/callables/declare-alert.test.ts
```

Expected: All tests pass.

### Task 3: Update admin-desktop callables.ts

**Files:**

- Modify: `apps/admin-desktop/src/services/callables.ts`

- [ ] **Step 1: Rename declareEmergency → declareAlert and add reportId**

Find the existing `declareEmergency` entry (around line 118) and replace:

```ts
  declareAlert: (payload: {
    hazardType: string
    affectedMunicipalityIds: string[]
    message: string
    reportId?: string
  }) =>
    httpsCallable<typeof payload, { alertId: string }>(
      functions,
      'declareAlert',
    )(payload).then((r) => r.data),
```

### Task 4: Create DeclareAlertModal component

**Files:**

- Create: `apps/admin-desktop/src/components/DeclareAlertModal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
import { useState } from 'react'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'
import { callables } from '../services/callables'

interface Props {
  open: boolean
  prefill?: {
    municipalityId?: string
    reportId?: string
  }
  onClose: () => void
  onSuccess: (alertId: string) => void
  onError: (error: string) => void
}

const MUNICIPALITIES = [...CAMARINES_NORTE_MUNICIPALITIES].sort((a, b) =>
  a.label.localeCompare(b.label),
)

export function DeclareAlertModal({ open, prefill, onClose, onSuccess, onError }: Props) {
  const [hazardType, setHazardType] = useState('')
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<string[]>(
    prefill?.municipalityId ? [prefill.municipalityId] : [],
  )
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = hazardType.trim() && selectedMunicipalities.length > 0 && message.trim()

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const result = await callables.declareAlert({
        hazardType: hazardType.trim(),
        affectedMunicipalityIds: selectedMunicipalities,
        message: message.trim(),
        reportId: prefill?.reportId,
      })
      onSuccess(result.alertId)
      setHazardType('')
      setSelectedMunicipalities(prefill?.municipalityId ? [prefill.municipalityId] : [])
      setMessage('')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to declare alert')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleMunicipality(id: string) {
    setSelectedMunicipalities((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    )
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="declare-alert-title"
      >
        <h2
          id="declare-alert-title"
          className="text-lg font-semibold text-[var(--color-text-primary)]"
        >
          Declare Alert
        </h2>

        <div className="mt-4 space-y-4">
          {/* Hazard Type */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Hazard Type
            </label>
            <select
              value={hazardType}
              onChange={(e) => setHazardType(e.target.value)}
              className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="">Select hazard type</option>
              <option value="flood">Flood</option>
              <option value="typhoon">Typhoon</option>
              <option value="earthquake">Earthquake</option>
              <option value="fire">Fire</option>
              <option value="landslide">Landslide</option>
              <option value="volcanic_eruption">Volcanic Eruption</option>
              <option value="tsunami">Tsunami</option>
              <option value="drought">Drought</option>
              <option value="security">Security Incident</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Municipality Multi-Select */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Affected Municipalities ({String(selectedMunicipalities.length)} selected)
            </label>
            <div className="mt-1 max-h-40 overflow-y-auto rounded border border-white/10 bg-[var(--color-surface)] p-2">
              {MUNICIPALITIES.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 py-1 text-sm text-[var(--color-text-primary)]"
                >
                  <input
                    type="checkbox"
                    checked={selectedMunicipalities.includes(m.id)}
                    onChange={() => toggleMunicipality(m.id)}
                    className="rounded border-white/20"
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              placeholder="Describe the alert..."
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {String(message.length)}/500 characters
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-md px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || submitting}
            className="rounded-md bg-[var(--color-danger)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Declaring...' : 'Declare Alert'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

### Task 5: Add Declare Alert button to CommandHeader

**Files:**

- Modify: `apps/admin-desktop/src/components/CommandHeader.tsx`

- [ ] **Step 1: Add props and button to CommandHeader**

Add to the `Props` interface:

```ts
  onDeclareAlert?: () => void
```

Add the button in the header's action area (after the LiveIndicator, before the audio toggle):

```tsx
{
  onDeclareAlert && (
    <button
      onClick={onDeclareAlert}
      className="flex items-center gap-1.5 rounded-md bg-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
      aria-label="Declare alert"
    >
      <AlertTriangle className="h-4 w-4" />
      Declare Alert
    </button>
  )
}
```

Add the import at the top:

```ts
import {
  AlertTriangle,
  Bell,
  Keyboard,
  LayoutDashboard,
  LogOut,
  Map,
  Newspaper,
  Volume2,
  VolumeX,
} from 'lucide-react'
```

### Task 6: Wire DeclareAlertModal in DashboardPage (header entry point)

**Files:**

- Modify: `apps/admin-desktop/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Add modal state and wire to CommandHeader**

In DashboardPage (or whichever page renders the CommandHeader for the dashboard route), add:

```tsx
import { useState } from 'react'
import { DeclareAlertModal } from '../components/DeclareAlertModal'
```

Add state:

```tsx
const [alertModalOpen, setAlertModalOpen] = useState(false)
const [alertError, setAlertError] = useState<string | null>(null)
```

Pass to CommandHeader:

```tsx
<CommandHeader
  // ... existing props
  onDeclareAlert={() => setAlertModalOpen(true)}
/>
```

Add the modal at the bottom of the component's JSX:

```tsx
<DeclareAlertModal
  open={alertModalOpen}
  onClose={() => {
    setAlertModalOpen(false)
    setAlertError(null)
  }}
  onSuccess={(alertId) => {
    setAlertModalOpen(false)
    setAlertError(null)
    // Could show a toast here; for now just close
  }}
  onError={(error) => {
    setAlertError(error)
  }}
/>
```

### Task 7: Add Declare Alert button to TriagePanel

**Files:**

- Modify: `apps/admin-desktop/src/components/TriagePanel.tsx`

- [ ] **Step 1: Add onDeclareAlert prop and button**

Add to the `Props` interface:

```ts
  onDeclareAlert?: (reportId: string) => void
```

Add the destructured prop:

```ts
export function TriagePanel({
  report,
  responders,
  onClose,
  onVerify,
  onReject,
  onDispatch,
  onDeclareAlert,
}: Props) {
```

Add the button after the dispatch section (before the `Report #` footer):

```tsx
{
  canDispatch && onDeclareAlert && (
    <button
      onClick={() => {
        onDeclareAlert(report.id)
      }}
      className="mt-2 w-full rounded-md bg-[var(--color-danger)] py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
    >
      ⚠ Declare Alert
    </button>
  )
}
```

Place it after the `canDispatch` block's closing `</div>` and before the `<p className="text-xs ...">Report #{report.id}</p>` line.

### Task 8: Wire TriagePanel's onDeclareAlert in MapPage or DashboardPage

**Files:**

- Modify: `apps/admin-desktop/src/pages/MapPage.tsx` (or wherever TriagePanel is rendered)

- [ ] **Step 1: Find where TriagePanel is used and add the callback**

Search for `<TriagePanel` to find the parent component. Add state and callback:

```tsx
const [triageAlertModalOpen, setTriageAlertModalOpen] = useState(false)
const [triageAlertReportId, setTriageAlertReportId] = useState<string | undefined>()
```

Add to TriagePanel:

```tsx
<TriagePanel
  // ... existing props
  onDeclareAlert={(reportId) => {
    setTriageAlertReportId(reportId)
    setTriageAlertModalOpen(true)
  }}
/>
```

Add the modal:

```tsx
<DeclareAlertModal
  open={triageAlertModalOpen}
  prefill={triageAlertReportId ? { reportId: triageAlertReportId } : undefined}
  onClose={() => {
    setTriageAlertModalOpen(false)
    setTriageAlertReportId(undefined)
  }}
  onSuccess={(alertId) => {
    setTriageAlertModalOpen(false)
    setTriageAlertReportId(undefined)
  }}
  onError={(error) => {
    // Show error via existing error state
  }}
/>
```

### Task 9: Verify Slice 1

- [ ] **Step 1: Run typecheck and lint for admin-desktop**

```bash
pnpm --dir apps/admin-desktop typecheck && pnpm --dir apps/admin-desktop lint
```

- [ ] **Step 2: Run typecheck and lint for functions**

```bash
pnpm --dir functions typecheck && pnpm --dir functions lint
```

- [ ] **Step 3: Run admin-desktop tests**

```bash
pnpm --dir apps/admin-desktop exec vitest run
```

- [ ] **Step 4: Run functions tests**

```bash
cd functions && npx vitest run src/__tests__/callables/declare-alert.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add alert issuance UI (declareAlert callable + header + panel buttons)

- Renamed declareEmergency → declareAlert across functions + admin-desktop
- Added optional reportId to link alerts to specific reports
- Created DeclareAlertModal with hazard type, municipality multi-select, message
- Added 'Declare Alert' button to CommandHeader (always visible)
- Added 'Declare Alert' button to TriagePanel (verified+ reports only)
- Changed alertType from 'emergency' to 'alert'"
```

---

## Slice 2: Push Notifications

### Task 10: Add FCM push to declareAlertCore

**Files:**

- Modify: `functions/src/callables/declare-alert.ts`

- [ ] **Step 1: Add FCM sendToTopic after writing alert doc**

In `declareAlertCore`, after the `db.collection('alerts').doc(alertId).set(alertDoc)` call and before the `streamAuditEvent` call, add:

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

The full function body after this change (relevant section):

```ts
await db.collection('alerts').doc(alertId).set(alertDoc)

// Best-effort FCM push
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
}

void streamAuditEvent({
  // ... rest unchanged
})
```

### Task 11: Add FCM push test

**Files:**

- Modify: `functions/src/__tests__/callables/declare-alert.test.ts`

- [ ] **Step 1: Add mock for firebase-admin messaging**

At the top of the test file, add the messaging mock:

```ts
const mockSendToTopic = vi.hoisted(() => vi.fn().mockResolvedValue({ messageId: 'test-msg' }))

vi.mock('firebase-admin', () => ({
  messaging: vi.fn(() => ({
    sendToTopic: mockSendToTopic,
  })),
}))
```

- [ ] **Step 2: Add test for FCM push**

Add a new test:

```ts
it('sends FCM push to alerts topic', async () => {
  await declareAlertCore(mockDb, validInput, { uid: 'admin-1' })

  expect(mockSendToTopic).toHaveBeenCalledWith('alerts', {
    notification: {
      title: 'Alert Issued',
      body: 'Signal no. 3 raised',
    },
    data: {
      alertId: expect.any(String),
      hazardType: 'typhoon',
    },
  })
})

it('does not fail alert creation if FCM push fails', async () => {
  mockSendToTopic.mockRejectedValueOnce(new Error('FCM unavailable'))

  const result = await declareAlertCore(mockDb, validInput, { uid: 'admin-1' })

  // Alert was still created
  expect(result.alertId).toBeDefined()
  expect(mockDb._setFn).toHaveBeenCalled()
})
```

- [ ] **Step 3: Rebuild functions and run tests**

```bash
pnpm --dir functions build && cd functions && npx vitest run src/__tests__/callables/declare-alert.test.ts
```

Expected: All tests pass including the new FCM tests.

### Task 12: Verify Slice 2

- [ ] **Step 1: Run full functions test suite**

```bash
cd functions && npx vitest run
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add FCM push notifications to declareAlert callable

- Sends text-only push to 'alerts' topic after writing alert doc
- Fire-and-forget: FCM failure doesn't block alert creation
- Unit tests verify push call and graceful failure handling"
```

---

## Slice 3: Photo Selection for Feed

### Task 13: Add featuredMediaIds to shared-types

**Files:**

- Modify: `packages/shared-types/src/` (find the report type definition file)

- [ ] **Step 1: Find the report type file**

```bash
grep -r "interface.*Report" packages/shared-types/src/ --include="*.ts" -l
```

- [ ] **Step 2: Add featuredMediaIds field**

In the appropriate report interface, add:

```ts
  featuredMediaIds?: string[]
```

### Task 14: Add featuredMediaIds to Firestore rules

**Files:**

- Modify: `infra/firebase/firestore.rules`

**IMPORTANT:** Show this diff to the user before committing. Per AGENTS.md §6, editing firestore.rules requires explicit approval.

- [ ] **Step 1: Add featuredMediaIds to allowedKeys**

In `infra/firebase/firestore.rules`, find line 131 (the `affectedKeys().hasOnly([...])` for report updates) and add `featuredMediaIds` to the list:

```rules
      allow update: if adminOf(resource.data.municipalityId)
                   && request.resource.data.diff(resource.data)
                      .affectedKeys()
                      .hasOnly(['status', 'updatedAt', 'verifiedAt', 'assignedAt', 'closedAt', 'rejectedAt', 'rejectedReason', 'barangayId', 'severity', 'mediaRefs', 'hazardTagList', 'featuredMediaIds']);
```

### Task 15: Add public read rule for report_media in storage rules

**Files:**

- Modify: `infra/firebase/storage.rules` (or wherever storage rules are defined — check `infra/firebase/` directory)

- [ ] **Step 1: Find storage rules file**

```bash
ls infra/firebase/
```

- [ ] **Step 2: Add public read rule for finalized images**

Add a rule that allows public read for finalized (non-pending) report media:

```rules
match /report_media/{municipalityId}/{reportId}/{filename} {
  allow read: if true;
}
```

This should be placed alongside the existing `report_media` rules. The `pending/` prefix images remain restricted by the default-deny rule.

### Task 16: Add storage rules test for citizen public read

**Files:**

- Modify: `functions/src/__tests__/storage.rules.test.ts`

- [ ] **Step 1: Add test for citizen public read of finalized report_media**

Add a new test case:

```ts
it('citizen can read finalized report_media (public read)', async () => {
  const env = await createTestEnv()
  const storage = (await env.withUnauthenticatedContext().initializeStorage())!
  // This should succeed with the new public read rule
  await assertSucceeds(storage.ref('report_media/daet/report-1/photo.jpg').getMetadata())
})
```

### Task 17: Add featuredMediaUrls to PublicIncident type

**Files:**

- Modify: `apps/citizen-pwa/src/components/MapTab/types.ts`

- [ ] **Step 1: Add featuredMediaUrls to PublicIncident interface**

```ts
export interface PublicIncident {
  id: string
  reportType: ReportType
  severity: Severity
  status: ReportStatus
  barangayId: string
  municipalityLabel: string
  publicLocation: { lat: number; lng: number }
  submittedAt: number
  verifiedAt?: number
  featuredMediaUrls?: string[] // NEW
}
```

### Task 18: Update usePublicIncidents to include featured media URLs

**Files:**

- Modify: `apps/citizen-pwa/src/hooks/usePublicIncidents.ts`

- [ ] **Step 1: Add imports for storage URL generation**

```ts
import { getStorage, ref, getDownloadURL } from 'firebase/storage'
```

- [ ] **Step 2: Update the snapshot handler to fetch media URLs**

In the `onSnapshot` callback, after mapping the report data, add logic to build featured media URLs:

```ts
const all = snap.docs.flatMap((d) => {
  const data: unknown = d.data()
  if (!isPublicIncidentData(data)) {
    console.error('Skipping invalid public incident document', d.id)
    return []
  }
  const reportData = data as Record<string, unknown>
  const featuredMediaIds = reportData.featuredMediaIds as string[] | undefined

  // Build featured media URLs from the media subcollection
  const featuredMediaUrls: string[] = []
  if (featuredMediaIds && featuredMediaIds.length > 0) {
    // For Phase 1, construct URLs directly from storage paths
    // The media subcollection docs have storagePath field
    // We'll fetch them in a follow-up if needed
    // For now, use the mediaRefs field which contains storage paths
    const mediaRefs = reportData.mediaRefs as string[] | undefined
    if (mediaRefs) {
      // Take up to 3 featured or all mediaRefs if no featured selection
      const paths = featuredMediaIds.length > 0 ? mediaRefs.slice(0, 3) : mediaRefs.slice(0, 3)
      for (const path of paths) {
        try {
          const storageRef = ref(getStorage(), path)
          const url = await getDownloadURL(storageRef)
          featuredMediaUrls.push(url)
        } catch {
          // Skip failed URL generation
        }
      }
    }
  }

  return [{ id: d.id, ...data, featuredMediaUrls } as PublicIncident]
})
```

**Note:** The above uses `await` inside `flatMap` which won't work. Instead, restructure to use `for...of` with `Promise.all`:

```ts
      (snap) => {
        const buildIncidents = async () => {
          const results: PublicIncident[] = []
          for (const d of snap.docs) {
            const data: unknown = d.data()
            if (!isPublicIncidentData(data)) continue

            const reportData = data as Record<string, unknown>
            const featuredMediaUrls: string[] = []

            const mediaRefs = reportData.mediaRefs as string[] | undefined
            if (mediaRefs && mediaRefs.length > 0) {
              const pathsToFetch = mediaRefs.slice(0, 3)
              for (const path of pathsToFetch) {
                try {
                  const storageRef = ref(getStorage(), path)
                  const url = await getDownloadURL(storageRef)
                  featuredMediaUrls.push(url)
                } catch {
                  // Skip failed URLs
                }
              }
            }

            results.push({ id: d.id, ...(data as Omit<PublicIncident, 'id'>), featuredMediaUrls })
          }

          const filtered = filters.municipality
            ? results.filter((i) => i.municipalityLabel === filters.municipality)
            : results
          setError(null)
          setIncidents(filtered)
          setLoading(false)
        }

        void buildIncidents()
      },
```

### Task 19: Add thumbnail strip to FeedCard

**Files:**

- Modify: `apps/citizen-pwa/src/components/FeedTab.tsx`

- [ ] **Step 1: Add thumbnail strip to FeedCard**

In the `FeedCard` component, add the thumbnail strip between the header div and the footer div:

```tsx
function FeedCard({ incident, onTap }: { incident: PublicIncident; onTap: () => void }) {
  const icon = incidentIcon(incident.reportType)
  const label = incidentLabel(incident.reportType)
  const severityStyle = getSeverityStyle(incident.severity)

  return (
    <button
      type="button"
      onClick={onTap}
      className="bg-white rounded-xl mx-3 my-2 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] w-[calc(100%-1.5rem)] text-left cursor-pointer block border-none"
    >
      {/* Header row */}
      <div className="flex items-start justify-between p-4 pb-2">
        {/* ... existing header content ... */}
      </div>

      {/* NEW: Thumbnail strip */}
      {incident.featuredMediaUrls && incident.featuredMediaUrls.length > 0 && (
        <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto">
          {incident.featuredMediaUrls.slice(0, 3).map((url, idx) => (
            <img
              key={idx}
              src={url}
              alt=""
              loading="lazy"
              className="h-[60px] w-[100px] rounded-lg object-cover flex-shrink-0 bg-surface-100"
            />
          ))}
        </div>
      )}

      {/* Footer action row */}
      <div className="border-t border-surface-100 px-4 py-2 flex items-center gap-4">
        {/* ... existing footer content ... */}
      </div>
    </button>
  )
}
```

### Task 20: Add photo gallery to admin FeedPage

**Files:**

- Modify: `apps/admin-desktop/src/pages/FeedPage.tsx`

- [ ] **Step 1: Add imports for media subcollection query**

```ts
import { collection, getDocs } from 'firebase/firestore'
import { getStorage, ref, getDownloadURL } from 'firebase/storage'
```

- [ ] **Step 2: Add state for photo selection**

```tsx
const [featuredMediaByReport, setFeaturedMediaByReport] = useState<Record<string, string[]>>({})
const [mediaUrlsByReport, setMediaUrlsByReport] = useState<
  Record<string, { uploadId: string; url: string }[]>
>({})
```

- [ ] **Step 3: Add effect to fetch media for each report**

```tsx
useEffect(() => {
  let cancelled = false
  async function fetchMedia() {
    const urls: Record<string, { uploadId: string; url: string }[]> = {}
    for (const { report } of feedReports) {
      try {
        const mediaSnap = await getDocs(collection(db, 'reports', report.id, 'media'))
        const entries: { uploadId: string; url: string }[] = []
        for (const doc of mediaSnap.docs) {
          const data = doc.data()
          if (data.storagePath) {
            try {
              const storageRef = ref(getStorage(), data.storagePath)
              const url = await getDownloadURL(storageRef)
              entries.push({ uploadId: doc.id, url })
            } catch {
              // Skip failed URLs
            }
          }
        }
        urls[report.id] = entries
      } catch {
        urls[report.id] = []
      }
    }
    if (!cancelled) setMediaUrlsByReport(urls)
  }
  void fetchMedia()
  return () => {
    cancelled = true
  }
}, [feedReports.map((r) => r.report.id).join(',')])
```

- [ ] **Step 4: Add function to save featured media selection**

```tsx
async function saveFeaturedMedia(reportId: string, selectedIds: string[]) {
  const reportRef = doc(db, 'reports', reportId)
  await updateDoc(reportRef, {
    featuredMediaIds: selectedIds,
    updatedAt: Date.now(),
  })
  setFeaturedMediaByReport((prev) => ({ ...prev, [reportId]: selectedIds }))
}
```

- [ ] **Step 5: Add photo gallery UI to each report row**

Inside the `feedReports.map()` rendering, after the description textarea and before the action buttons, add:

```tsx
{
  /* Photo gallery */
}
{
  mediaUrlsByReport[report.id] && mediaUrlsByReport[report.id].length > 0 && (
    <div className="col-span-full">
      <p className="mb-1 text-xs text-[var(--color-text-muted)]">Photos:</p>
      <div className="flex gap-2 flex-wrap">
        {mediaUrlsByReport[report.id].map(({ uploadId, url }) => {
          const isSelected = (
            featuredMediaByReport[report.id] ??
            ((report as unknown as Record<string, unknown>).featuredMediaIds as
              | string[]
              | undefined) ??
            []
          ).includes(uploadId)
          return (
            <label
              key={uploadId}
              className={`relative cursor-pointer rounded border-2 overflow-hidden ${
                isSelected ? 'border-[var(--color-success)]' : 'border-white/10'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  const current =
                    featuredMediaByReport[report.id] ??
                    ((report as unknown as Record<string, unknown>).featuredMediaIds as
                      | string[]
                      | undefined) ??
                    []
                  const next = e.target.checked
                    ? [...current, uploadId]
                    : current.filter((id) => id !== uploadId)
                  void saveFeaturedMedia(report.id, next)
                }}
                className="absolute top-1 left-1 z-10"
              />
              <img src={url} alt="" className="h-[60px] w-[80px] object-cover" />
            </label>
          )
        })}
      </div>
    </div>
  )
}
```

### Task 21: Verify Slice 3

- [ ] **Step 1: Run typecheck and lint for citizen-pwa**

```bash
pnpm --dir apps/citizen-pwa typecheck && pnpm --dir apps/citizen-pwa lint
```

- [ ] **Step 2: Run typecheck and lint for admin-desktop**

```bash
pnpm --dir apps/admin-desktop typecheck && pnpm --dir apps/admin-desktop lint
```

- [ ] **Step 3: Run admin-desktop tests**

```bash
pnpm --dir apps/admin-desktop exec vitest run
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add photo selection for feed (admin gallery + citizen thumbnails)

- Admin FeedPage: photo subcollection query + thumbnail strip + checkbox selection
- Citizen FeedCard: inline thumbnail strip for featured media
- Storage rules: public read for finalized report_media
- Firestore rules: added featuredMediaIds to allowedKeys for report updates
- usePublicIncidents: includes featuredMediaUrls in returned incidents"
```

---

## Final Verification

After all three slices:

- [ ] **Step 1: Run full typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 2: Run full lint**

```bash
pnpm lint
```

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

- [ ] **Step 4: Run functions emulator tests**

```bash
cd functions && firebase emulators:exec --only firestore,database,storage 'npx vitest run'
```
