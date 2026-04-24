# Phase 5 PRE-B — Schema + Rules Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land all schema amendments and Firestore rules additions that Clusters B, A, and C depend on — before any business logic is written.

**Architecture:** All changes are backward-compatible additions to `packages/shared-validators/src/`. Rules changes go into `infra/firebase/firestore.rules.template`; regenerate with `pnpm exec tsx scripts/build-rules.ts`. Every schema change is guarded by a failing Vitest test first.

**Tech Stack:** Zod 4.x, Firebase Emulator (Firestore port 8081), @firebase/rules-unit-testing, Vitest

---

## File Map

| Action | File                                                              |
| ------ | ----------------------------------------------------------------- |
| Modify | `packages/shared-validators/src/coordination.ts`                  |
| Modify | `packages/shared-validators/src/responders.ts`                    |
| Modify | `packages/shared-validators/src/users.ts`                         |
| Modify | `packages/shared-validators/src/reports.ts`                       |
| Modify | `packages/shared-validators/src/index.ts`                         |
| Modify | `infra/firebase/firestore.rules.template`                         |
| Create | `functions/src/__tests__/rules/field-mode-sessions.rules.test.ts` |
| Create | `functions/src/__tests__/rules/report-notes.rules.test.ts`        |
| Create | `functions/src/__tests__/rules/report-messages.rules.test.ts`     |
| Extend | `functions/src/__tests__/rules/coordination.rules.test.ts`        |
| Extend | `functions/src/__tests__/triggers/process-inbox-item.test.ts`     |

---

### Task 1: Amend `coordination.ts` — 5 schema changes

**Files:**

- Modify: `packages/shared-validators/src/coordination.ts`
- Test: `packages/shared-validators/src/coordination.test.ts` (create if absent)

- [ ] **Step 1: Write failing tests**

Create `packages/shared-validators/src/coordination.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  agencyAssistanceRequestDocSchema,
  commandChannelThreadDocSchema,
  shiftHandoffDocSchema,
  massAlertRequestDocSchema,
  fieldModeSessionDocSchema,
} from './coordination.js'

const now = 1713350400000

describe('agencyAssistanceRequestDocSchema', () => {
  it('accepts respondedBy and escalatedAt fields', () => {
    const result = agencyAssistanceRequestDocSchema.safeParse({
      reportId: 'r1',
      requestedByMunicipalId: 'daet',
      requestedByMunicipality: 'Daet',
      targetAgencyId: 'bfp',
      requestType: 'BFP',
      message: 'need help',
      priority: 'urgent',
      status: 'accepted',
      declinedReason: undefined,
      fulfilledByDispatchIds: [],
      createdAt: now,
      respondedAt: now,
      respondedBy: 'uid-123',
      escalatedAt: now,
      expiresAt: now + 3600000,
    })
    expect(result.success).toBe(true)
  })
})

describe('commandChannelThreadDocSchema', () => {
  it('requires reportId', () => {
    const result = commandChannelThreadDocSchema.safeParse({
      threadId: 't1',
      subject: 'test',
      participantUids: { 'uid-1': true },
      createdBy: 'uid-1',
      createdAt: now,
      updatedAt: now,
      threadType: 'agency_assistance',
      schemaVersion: 1,
    })
    expect(result.success).toBe(false) // reportId missing
  })

  it('accepts threadType and assistanceRequestId', () => {
    const result = commandChannelThreadDocSchema.safeParse({
      threadId: 't1',
      reportId: 'r1',
      subject: 'test',
      participantUids: { 'uid-1': true },
      createdBy: 'uid-1',
      createdAt: now,
      updatedAt: now,
      threadType: 'border_share',
      assistanceRequestId: 'ar1',
      schemaVersion: 1,
    })
    expect(result.success).toBe(true)
  })
})

describe('shiftHandoffDocSchema', () => {
  it('accepts handoff without toUid', () => {
    const result = shiftHandoffDocSchema.safeParse({
      fromUid: 'uid-1',
      municipalityId: 'daet',
      activeIncidentSnapshot: [],
      notes: '',
      status: 'pending',
      createdAt: now,
      expiresAt: now + 3600000,
      schemaVersion: 1,
    })
    expect(result.success).toBe(true)
  })

  it('accepts escalatedAt field', () => {
    const result = shiftHandoffDocSchema.safeParse({
      fromUid: 'uid-1',
      municipalityId: 'daet',
      activeIncidentSnapshot: [],
      notes: '',
      status: 'pending',
      createdAt: now,
      expiresAt: now + 3600000,
      escalatedAt: now + 1800000,
      schemaVersion: 1,
    })
    expect(result.success).toBe(true)
  })
})

describe('massAlertRequestDocSchema', () => {
  it('accepts sent, pending_ndrrmc_review, declined status values', () => {
    for (const status of ['sent', 'pending_ndrrmc_review', 'declined'] as const) {
      const result = massAlertRequestDocSchema.safeParse({
        requestedByMunicipality: 'daet',
        requestedByUid: 'uid-1',
        severity: 'high',
        body: 'Evacuate now',
        targetType: 'municipality',
        estimatedReach: 100,
        status,
        createdAt: now,
        schemaVersion: 1,
      })
      expect(result.success, `status ${status} should be valid`).toBe(true)
    }
  })
})

describe('fieldModeSessionDocSchema', () => {
  it('parses a valid field mode session', () => {
    const result = fieldModeSessionDocSchema.safeParse({
      uid: 'uid-1',
      municipalityId: 'daet',
      enteredAt: now,
      expiresAt: now + 43200000,
      isActive: true,
      schemaVersion: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects session where expiresAt <= enteredAt', () => {
    const result = fieldModeSessionDocSchema.safeParse({
      uid: 'uid-1',
      municipalityId: 'daet',
      enteredAt: now,
      expiresAt: now - 1,
      isActive: true,
      schemaVersion: 1,
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm --filter @bantayog/shared-validators exec vitest run src/coordination.test.ts
```

Expected: FAIL — `fieldModeSessionDocSchema` not found, `respondedBy` field rejected, etc.

- [ ] **Step 3: Update `packages/shared-validators/src/coordination.ts`**

Replace the entire file with:

```typescript
import { z } from 'zod'

export const agencyAssistanceRequestDocSchema = z
  .object({
    reportId: z.string().min(1),
    requestedByMunicipalId: z.string().min(1),
    requestedByMunicipality: z.string().min(1),
    targetAgencyId: z.string().min(1),
    requestType: z.enum(['BFP', 'PNP', 'PCG', 'RED_CROSS', 'DPWH', 'OTHER']),
    message: z.string().max(1000),
    priority: z.enum(['urgent', 'normal']),
    status: z.enum(['pending', 'accepted', 'declined', 'fulfilled', 'expired']),
    declinedReason: z.string().optional(),
    fulfilledByDispatchIds: z.array(z.string()),
    createdAt: z.number().int(),
    respondedAt: z.number().int().optional(),
    respondedBy: z.string().optional(),
    escalatedAt: z.number().int().optional(),
    expiresAt: z.number().int(),
  })
  .strict()
  .refine((d) => d.expiresAt > d.createdAt, {
    message: 'expiresAt must be after createdAt',
  })

export const commandChannelThreadDocSchema = z
  .object({
    threadId: z.string().min(1),
    reportId: z.string().min(1),
    assistanceRequestId: z.string().min(1).optional(),
    threadType: z.enum(['agency_assistance', 'border_share']),
    subject: z.string().max(200),
    participantUids: z.record(z.string(), z.literal(true)),
    createdBy: z.string().min(1),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    lastMessageAt: z.number().int().optional(),
    closedAt: z.number().int().optional(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const commandChannelMessageDocSchema = z
  .object({
    threadId: z.string().min(1),
    authorUid: z.string().min(1),
    authorRole: z.enum(['municipal_admin', 'agency_admin', 'provincial_superadmin']),
    body: z.string().max(2000),
    idempotencyKey: z.string().uuid().optional(),
    createdAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const massAlertRequestDocSchema = z
  .object({
    requestedByMunicipality: z.string().min(1),
    requestedByUid: z.string().min(1),
    severity: z.enum(['low', 'medium', 'high']),
    body: z.string().max(480),
    targetType: z.enum(['municipality', 'polygon', 'province']),
    targetGeometryRef: z.string().optional(),
    estimatedReach: z.number().int().nonnegative(),
    status: z.enum([
      'queued',
      'sent',
      'pending_ndrrmc_review',
      'submitted_to_pdrrmo',
      'forwarded_to_ndrrmc',
      'acknowledged_by_ndrrmc',
      'declined',
      'cancelled',
    ]),
    createdAt: z.number().int(),
    forwardedAt: z.number().int().optional(),
    forwardMethod: z.string().optional(),
    ndrrrcRecipient: z.string().optional(),
    acknowledgedAt: z.number().int().optional(),
    cancelledAt: z.number().int().optional(),
    sentAt: z.number().int().optional(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const shiftHandoffDocSchema = z
  .object({
    fromUid: z.string().min(1),
    toUid: z.string().min(1).optional(),
    municipalityId: z.string().min(1),
    activeIncidentSnapshot: z.array(z.string()),
    notes: z.string().max(2000),
    status: z.enum(['pending', 'accepted', 'expired']),
    createdAt: z.number().int(),
    acceptedAt: z.number().int().optional(),
    escalatedAt: z.number().int().optional(),
    expiresAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()
  .refine((d) => d.expiresAt > d.createdAt, {
    message: 'expiresAt must be after createdAt',
  })

export const breakglassEventDocSchema = z
  .object({
    sessionId: z.string().min(1),
    actor: z.string().min(1),
    action: z.string().min(1),
    resourceRef: z.string().optional(),
    createdAt: z.number().int(),
    correlationId: z.string().min(1),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

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

export type AgencyAssistanceRequestDoc = z.infer<typeof agencyAssistanceRequestDocSchema>
export type CommandChannelThreadDoc = z.infer<typeof commandChannelThreadDocSchema>
export type CommandChannelMessageDoc = z.infer<typeof commandChannelMessageDocSchema>
export type MassAlertRequestDoc = z.infer<typeof massAlertRequestDocSchema>
export type ShiftHandoffDoc = z.infer<typeof shiftHandoffDocSchema>
export type BreakglassEventDoc = z.infer<typeof breakglassEventDocSchema>
export type FieldModeSessionDoc = z.infer<typeof fieldModeSessionDocSchema>
```

- [ ] **Step 4: Re-run tests to confirm pass**

```bash
pnpm --filter @bantayog/shared-validators exec vitest run src/coordination.test.ts
```

Expected: PASS (7 tests)

- [ ] **Step 5: Update index exports**

In `packages/shared-validators/src/index.ts`, add to the coordination exports block:

```typescript
export {
  fieldModeSessionDocSchema,
  type FieldModeSessionDoc,
  // existing exports...
} from './coordination.js'
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared-validators/src/coordination.ts \
        packages/shared-validators/src/coordination.test.ts \
        packages/shared-validators/src/index.ts
git commit -m "feat(schema): amend coordination schemas — respondedBy, escalatedAt, threadType, fieldModeSession"
```

---

### Task 2: Amend `responders.ts` — add `fcmTokens` + `hasFcmToken`

**Files:**

- Modify: `packages/shared-validators/src/responders.ts`
- Test: `packages/shared-validators/src/responders.test.ts` (create if absent)

- [ ] **Step 1: Write failing test**

Create `packages/shared-validators/src/responders.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { responderDocSchema } from './responders.js'

const now = 1713350400000

describe('responderDocSchema', () => {
  it('accepts hasFcmToken and fcmTokens fields', () => {
    const result = responderDocSchema.safeParse({
      uid: 'resp-1',
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
      displayCode: 'BFP-01',
      specialisations: [],
      availabilityStatus: 'on_duty',
      isActive: true,
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      fcmTokens: ['token-abc'],
      hasFcmToken: true,
    })
    expect(result.success).toBe(true)
  })

  it('defaults hasFcmToken to false when absent', () => {
    const result = responderDocSchema.safeParse({
      uid: 'resp-1',
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
      displayCode: 'BFP-01',
      specialisations: [],
      availabilityStatus: 'on_duty',
      isActive: true,
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.hasFcmToken).toBe(false)
      expect(result.data.fcmTokens).toEqual([])
    }
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm --filter @bantayog/shared-validators exec vitest run src/responders.test.ts
```

Expected: FAIL — `fcmTokens` unrecognized key (strict schema), `hasFcmToken` unrecognized.

- [ ] **Step 3: Update `packages/shared-validators/src/responders.ts`**

```typescript
import { z } from 'zod'

export const responderDocSchema = z
  .object({
    uid: z.string().min(1),
    agencyId: z.string().min(1),
    municipalityId: z.string().min(1),
    displayCode: z.string().min(1),
    specialisations: z.array(z.string()).default([]),
    availabilityStatus: z.enum(['on_duty', 'off_duty', 'on_break', 'unavailable']),
    isActive: z.boolean(),
    fcmTokens: z.array(z.string()).default([]),
    hasFcmToken: z.boolean().default(false),
    lastTelemetryAt: z.number().int().optional(),
    schemaVersion: z.number().int().positive(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .strict()

export type ResponderDoc = z.infer<typeof responderDocSchema>
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm --filter @bantayog/shared-validators exec vitest run src/responders.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/shared-validators/src/responders.ts \
        packages/shared-validators/src/responders.test.ts
git commit -m "feat(schema): add fcmTokens[] and hasFcmToken to responderDocSchema"
```

---

### Task 3: Add `reportSmsConsentDocSchema` to `users.ts`

**Files:**

- Modify: `packages/shared-validators/src/users.ts`
- Modify: `packages/shared-validators/src/index.ts`
- Test: `packages/shared-validators/src/users.test.ts` (create if absent)

- [ ] **Step 1: Write failing test**

Create `packages/shared-validators/src/users.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { reportSmsConsentDocSchema } from './users.js'

const now = 1713350400000

describe('reportSmsConsentDocSchema', () => {
  it('parses a full consent doc', () => {
    const result = reportSmsConsentDocSchema.safeParse({
      reportId: 'r1',
      phone: '+63 912 345 6789',
      locale: 'tl',
      smsConsent: true,
      municipalityId: 'daet',
      followUpConsent: true,
      createdAt: now,
      schemaVersion: 1,
    })
    expect(result.success).toBe(true)
  })

  it('defaults followUpConsent to false', () => {
    const result = reportSmsConsentDocSchema.safeParse({
      reportId: 'r1',
      phone: '+63 912 345 6789',
      locale: 'tl',
      smsConsent: true,
      municipalityId: 'daet',
      createdAt: now,
      schemaVersion: 1,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.followUpConsent).toBe(false)
    }
  })

  it('rejects when municipalityId is absent', () => {
    const result = reportSmsConsentDocSchema.safeParse({
      reportId: 'r1',
      phone: '+63 912 345 6789',
      locale: 'tl',
      smsConsent: true,
      createdAt: now,
      schemaVersion: 1,
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm --filter @bantayog/shared-validators exec vitest run src/users.test.ts
```

Expected: FAIL — `reportSmsConsentDocSchema` not exported from `users.js`.

- [ ] **Step 3: Add `reportSmsConsentDocSchema` to `packages/shared-validators/src/users.ts`**

```typescript
import { z } from 'zod'

export const userDocSchema = z
  .object({
    uid: z.string().min(1),
    role: z.enum([
      'citizen',
      'responder',
      'municipal_admin',
      'agency_admin',
      'provincial_superadmin',
    ]),
    displayName: z.string().optional(),
    phone: z.string().optional(),
    barangayId: z.string().optional(),
    municipalityId: z.string().optional(),
    agencyId: z.string().optional(),
    isPseudonymous: z.boolean(),
    followUpConsent: z.boolean().default(false),
    schemaVersion: z.number().int().positive(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .strict()

export const reportSmsConsentDocSchema = z
  .object({
    reportId: z.string().min(1),
    phone: z.string().min(1),
    locale: z.string().min(1),
    smsConsent: z.literal(true),
    municipalityId: z.string().min(1),
    followUpConsent: z.boolean().default(false),
    createdAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export type UserDoc = z.infer<typeof userDocSchema>
export type ReportSmsConsentDoc = z.infer<typeof reportSmsConsentDocSchema>
```

- [ ] **Step 4: Export from index**

In `packages/shared-validators/src/index.ts`, add:

```typescript
export { reportSmsConsentDocSchema, type ReportSmsConsentDoc } from './users.js'
```

- [ ] **Step 5: Run to confirm pass**

```bash
pnpm --filter @bantayog/shared-validators exec vitest run src/users.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/shared-validators/src/users.ts \
        packages/shared-validators/src/users.test.ts \
        packages/shared-validators/src/index.ts
git commit -m "feat(schema): add reportSmsConsentDocSchema with municipalityId and followUpConsent"
```

---

### Task 4: Amend `reports.ts` — `reportOpsDocSchema` additions + new schemas

**Files:**

- Modify: `packages/shared-validators/src/reports.ts`
- Modify: `packages/shared-validators/src/index.ts`
- Extend: `packages/shared-validators/src/reports.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/shared-validators/src/reports.test.ts`:

```typescript
import { reportNoteDocSchema, reportSharingEventDocSchema } from './reports.js'

const now = 1713350400000

describe('reportOpsDocSchema — new fields', () => {
  it('accepts reportType field', () => {
    const result = reportOpsDocSchema.safeParse({
      municipalityId: 'daet',
      status: 'verified',
      severity: 'medium',
      createdAt: now,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      updatedAt: now,
      schemaVersion: 1,
      reportType: 'flood',
      locationGeohash: 'w7hfm2',
      duplicateClusterId: 'cluster-uuid-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts reportOpsDocSchema without new optional fields', () => {
    const result = reportOpsDocSchema.safeParse({
      municipalityId: 'daet',
      status: 'verified',
      severity: 'medium',
      createdAt: now,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      updatedAt: now,
      schemaVersion: 1,
    })
    expect(result.success).toBe(true)
  })
})

describe('reportNoteDocSchema', () => {
  it('parses a valid report note', () => {
    const result = reportNoteDocSchema.safeParse({
      reportId: 'r1',
      authorUid: 'uid-1',
      body: 'Situation is stable now.',
      createdAt: now,
      schemaVersion: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects body over 2000 chars', () => {
    const result = reportNoteDocSchema.safeParse({
      reportId: 'r1',
      authorUid: 'uid-1',
      body: 'x'.repeat(2001),
      createdAt: now,
      schemaVersion: 1,
    })
    expect(result.success).toBe(false)
  })
})

describe('reportSharingEventDocSchema', () => {
  it('parses a manual share event', () => {
    const result = reportSharingEventDocSchema.safeParse({
      targetMunicipalityId: 'mercedes',
      sharedBy: 'uid-1',
      sharedAt: now,
      sharedReason: 'Border incident',
      source: 'manual',
      schemaVersion: 1,
    })
    expect(result.success).toBe(true)
  })

  it('parses an auto share event without reason', () => {
    const result = reportSharingEventDocSchema.safeParse({
      targetMunicipalityId: 'mercedes',
      sharedBy: 'system',
      sharedAt: now,
      source: 'auto',
      schemaVersion: 1,
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm --filter @bantayog/shared-validators exec vitest run src/reports.test.ts
```

Expected: FAIL — `reportNoteDocSchema` not found, `reportType` unrecognized in strict schema.

- [ ] **Step 3: Update `packages/shared-validators/src/reports.ts`**

Add `reportType`, `locationGeohash`, `duplicateClusterId`, `hazardZoneIdList` to `reportOpsDocSchema` (after `requiresLocationFollowUp`):

```typescript
// In reportOpsDocSchema .object({...}) — add after requiresLocationFollowUp:
reportType: z.enum(['flood', 'fire', 'earthquake', 'typhoon', 'landslide', 'storm_surge']).optional(),
locationGeohash: z.string().length(6).optional(),
duplicateClusterId: z.string().optional(),
hazardZoneIdList: z.array(z.string()).optional(),
```

Add new schemas after `reportSharingDocSchema`:

```typescript
export const reportNoteDocSchema = z
  .object({
    reportId: z.string().min(1),
    authorUid: z.string().min(1),
    body: z.string().max(2000),
    createdAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const reportSharingEventDocSchema = z
  .object({
    targetMunicipalityId: z.string().min(1),
    sharedBy: z.string().min(1),
    sharedAt: z.number().int(),
    sharedReason: z.string().max(500).optional(),
    source: z.enum(['manual', 'auto']),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export type ReportNoteDoc = z.infer<typeof reportNoteDocSchema>
export type ReportSharingEventDoc = z.infer<typeof reportSharingEventDocSchema>
```

- [ ] **Step 4: Export new types from index**

```typescript
// Add to packages/shared-validators/src/index.ts
export {
  reportNoteDocSchema,
  reportSharingEventDocSchema,
  type ReportNoteDoc,
  type ReportSharingEventDoc,
} from './reports.js'
```

- [ ] **Step 5: Run to confirm pass**

```bash
pnpm --filter @bantayog/shared-validators exec vitest run src/reports.test.ts
```

Expected: PASS (all existing + 6 new tests)

- [ ] **Step 6: Commit**

```bash
git add packages/shared-validators/src/reports.ts \
        packages/shared-validators/src/reports.test.ts \
        packages/shared-validators/src/index.ts
git commit -m "feat(schema): add reportType/locationGeohash to reportOpsDoc; add reportNoteDoc and reportSharingEventDoc schemas"
```

---

### Task 5: PRE-B.1 — `field_mode_sessions` rules + tests

**Files:**

- Modify: `infra/firebase/firestore.rules.template`
- Create: `functions/src/__tests__/rules/field-mode-sessions.rules.test.ts`

- [ ] **Step 1: Write failing rules test**

Create `functions/src/__tests__/rules/field-mode-sessions.rules.test.ts`:

```typescript
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

const sessionData = {
  uid: 'daet-admin',
  municipalityId: 'daet',
  enteredAt: ts,
  expiresAt: ts + 43200000,
  isActive: true,
  schemaVersion: 1,
}

beforeAll(async () => {
  env = await createTestEnv('field-mode-sessions-rules-test')
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'other-admin',
    role: 'municipal_admin',
    municipalityId: 'mercedes',
  })
  await seedActiveAccount(env, { uid: 'superadmin', role: 'provincial_superadmin' })
  // Pre-seed a session doc for read tests
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'field_mode_sessions', 'daet-admin'), sessionData)
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('field_mode_sessions rules', () => {
  it('allows owner to read their own session', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'field_mode_sessions', 'daet-admin')))
  })

  it('allows owner to write their own session', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(setDoc(doc(db, 'field_mode_sessions', 'daet-admin'), sessionData))
  })

  it('denies other user reading another user session', async () => {
    const db = authed(
      env,
      'other-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
    )
    await assertFails(getDoc(doc(db, 'field_mode_sessions', 'daet-admin')))
  })

  it('denies unauthenticated reads', async () => {
    const db = unauthed(env)
    await assertFails(getDoc(doc(db, 'field_mode_sessions', 'daet-admin')))
  })

  it('denies superadmin writes to field_mode_sessions', async () => {
    const db = authed(env, 'superadmin', staffClaims({ role: 'provincial_superadmin' }))
    await assertFails(setDoc(doc(db, 'field_mode_sessions', 'daet-admin'), sessionData))
  })

  it('allows superadmin reads', async () => {
    const db = authed(env, 'superadmin', staffClaims({ role: 'provincial_superadmin' }))
    await assertSucceeds(getDoc(doc(db, 'field_mode_sessions', 'daet-admin')))
  })
})
```

- [ ] **Step 2: Run to confirm failure (collection not in rules)**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rules/field-mode-sessions.rules.test.ts"
```

Expected: FAIL — all reads/writes denied (default deny rule catches unmatched collection).

- [ ] **Step 3: Add rules to template**

In `infra/firebase/firestore.rules.template`, add after the `report_contacts` block (around line 118):

```javascript
    match /field_mode_sessions/{uid} {
      allow read: if isAuthed()
                  && (request.auth.uid == uid || isSuperadmin());
      allow write: if isAuthed()
                   && request.auth.uid == uid
                   && isActivePrivileged()
                   && !isSuperadmin();
    }
```

- [ ] **Step 4: Regenerate rules**

```bash
pnpm exec tsx scripts/build-rules.ts
```

Expected: `✓ Rules codegen complete`

- [ ] **Step 5: Run rules test to confirm pass**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rules/field-mode-sessions.rules.test.ts"
```

Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add infra/firebase/firestore.rules.template \
        infra/firebase/firestore.rules \
        functions/src/__tests__/rules/field-mode-sessions.rules.test.ts
git commit -m "feat(rules): add field_mode_sessions — owner write, superadmin read, no superadmin write"
```

---

### Task 6: PRE-B.4 — `report_notes` rules + `report/messages` rules fix

**Files:**

- Modify: `infra/firebase/firestore.rules.template`
- Create: `functions/src/__tests__/rules/report-notes.rules.test.ts`
- Create: `functions/src/__tests__/rules/report-messages.rules.test.ts`

- [ ] **Step 1: Write failing rules tests**

Create `functions/src/__tests__/rules/report-notes.rules.test.ts`:

```typescript
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, seedReport, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('report-notes-rules-test')
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'other-admin',
    role: 'municipal_admin',
    municipalityId: 'mercedes',
  })
  await seedReport(env, 'report-daet', { municipalityId: 'daet' })
})

afterAll(async () => {
  await env.cleanup()
})

const validNote = {
  reportId: 'report-daet',
  authorUid: 'daet-admin',
  body: 'Situation is stable.',
  createdAt: ts,
  schemaVersion: 1,
}

describe('report_notes rules', () => {
  it('allows muni admin to write note with matching authorUid and municipality', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(addDoc(collection(db, 'report_notes'), validNote))
  })

  it('denies muni admin writing note with mismatched authorUid', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(
      addDoc(collection(db, 'report_notes'), { ...validNote, authorUid: 'other-admin' }),
    )
  })

  it('denies muni admin writing note for report in a different municipality', async () => {
    const db = authed(
      env,
      'other-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
    )
    await assertFails(
      addDoc(collection(db, 'report_notes'), { ...validNote, authorUid: 'other-admin' }),
    )
  })

  it('denies citizen writes', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(addDoc(collection(db, 'report_notes'), validNote))
  })

  it('denies unauthenticated reads', async () => {
    const db = unauthed(env)
    await assertFails(getDocs(collection(db, 'report_notes')))
  })

  it('allows muni admin to read notes for their municipality', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDocs(collection(db, 'report_notes')))
  })
})
```

Create `functions/src/__tests__/rules/report-messages.rules.test.ts`:

```typescript
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { addDoc, collection } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, seedReport, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('report-messages-rules-test')
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedReport(env, 'report-1', { municipalityId: 'daet' })
})

afterAll(async () => {
  await env.cleanup()
})

describe('reports/messages rules', () => {
  it('allows muni admin to write a message', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      addDoc(collection(db, 'reports', 'report-1', 'messages'), {
        authorUid: 'daet-admin',
        body: 'En route.',
        createdAt: ts,
        schemaVersion: 1,
      }),
    )
  })

  it('denies citizen writes to messages', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(
      addDoc(collection(db, 'reports', 'report-1', 'messages'), {
        authorUid: 'citizen-1',
        body: 'hi',
        createdAt: ts,
        schemaVersion: 1,
      }),
    )
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rules/report-notes.rules.test.ts src/__tests__/rules/report-messages.rules.test.ts"
```

Expected: FAIL — `report_notes` collection unmatched (default deny); `reports/{id}/messages` still has `allow write: if false`.

- [ ] **Step 3: Add rules to template**

In `infra/firebase/firestore.rules.template`, add after the `report_sharing` block:

```javascript
    match /report_notes/{n} {
      allow read: if isActivePrivileged()
                  && (isMuniAdmin() || isAgencyAdmin() || isSuperadmin());
      allow create: if isActivePrivileged()
                    && (isMuniAdmin() || isAgencyAdmin() || isSuperadmin())
                    && request.auth.uid == request.resource.data.authorUid
                    && get(/databases/$(database)/documents/report_ops/$(request.resource.data.reportId))
                         .data.municipalityId == myMunicipality();
      allow update, delete: if false;
    }
```

Update the existing `reports/{id}/messages` subcollection rule (find it in the reports section and change `allow write: if false` to):

```javascript
      match /messages/{m} {
        allow read: if isActivePrivileged()
                    && (adminOf(resource.data.municipalityId)
                        || (isAgencyAdmin() && myAgency() in resource.data.agencyIds));
        allow create: if isActivePrivileged()
                      && (isMuniAdmin() || isAgencyAdmin() || isSuperadmin())
                      && request.auth.uid == request.resource.data.authorUid;
        allow update, delete: if false;
      }
```

- [ ] **Step 4: Regenerate rules + run tests**

```bash
pnpm exec tsx scripts/build-rules.ts && \
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rules/report-notes.rules.test.ts src/__tests__/rules/report-messages.rules.test.ts"
```

Expected: PASS (6 + 2 = 8 tests)

- [ ] **Step 5: Commit**

```bash
git add infra/firebase/firestore.rules.template \
        infra/firebase/firestore.rules \
        functions/src/__tests__/rules/report-notes.rules.test.ts \
        functions/src/__tests__/rules/report-messages.rules.test.ts
git commit -m "feat(rules): add report_notes write rules; allow muni admin writes to reports/messages"
```

---

### Task 7: PRE-B.5 — Fix `command_channel_threads` rules (map key lookup) + new field validation tests

**Files:**

- Modify: `infra/firebase/firestore.rules.template`
- Extend: `functions/src/__tests__/rules/coordination.rules.test.ts`

- [ ] **Step 1: Write failing test for map key lookup**

Append to `functions/src/__tests__/rules/coordination.rules.test.ts`:

```typescript
import { doc, getDoc, setDoc } from 'firebase/firestore'

describe('command_channel_threads — map key lookup', () => {
  beforeAll(async () => {
    // Seed a thread where daet-admin is a participant
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'command_channel_threads', 'thread-1'), {
        threadId: 'thread-1',
        reportId: 'report-1',
        threadType: 'agency_assistance',
        subject: 'Need help',
        participantUids: { 'daet-admin': true },
        createdBy: 'daet-admin',
        createdAt: ts,
        updatedAt: ts,
        schemaVersion: 1,
      })
    })
  })

  it('allows participant to read thread (map key lookup)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'command_channel_threads', 'thread-1')))
  })

  it('denies non-participant from reading thread', async () => {
    const db = authed(
      env,
      'other-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
    )
    await assertFails(getDoc(doc(db, 'command_channel_threads', 'thread-1')))
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rules/coordination.rules.test.ts"
```

Expected: The "allows participant to read thread" test FAILS because `request.auth.uid in resource.data.participantUids` is `false` on a map.

- [ ] **Step 3: Fix the rules template**

In `infra/firebase/firestore.rules.template`, update the `command_channel_threads` block:

```javascript
    match /command_channel_threads/{threadId} {
      allow read: if isActivePrivileged()
                  && (isMuniAdmin() || isAgencyAdmin() || isSuperadmin())
                  && resource.data.participantUids[request.auth.uid] == true;
      allow write: if false;
    }

    match /command_channel_messages/{messageId} {
      allow read: if isActivePrivileged()
                  && (isMuniAdmin() || isAgencyAdmin() || isSuperadmin())
                  && get(/databases/$(database)/documents/command_channel_threads/$(resource.data.threadId))
                       .data.participantUids[request.auth.uid] == true;
      allow write: if false;
    }
```

- [ ] **Step 4: Regenerate + run tests**

```bash
pnpm exec tsx scripts/build-rules.ts && \
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rules/coordination.rules.test.ts"
```

Expected: PASS (all existing + 2 new tests)

- [ ] **Step 5: Commit**

```bash
git add infra/firebase/firestore.rules.template \
        infra/firebase/firestore.rules \
        functions/src/__tests__/rules/coordination.rules.test.ts
git commit -m "fix(rules): command_channel_threads participantUids — use map key lookup, not 'in' operator"
```

---

### Task 8: PRE-B.6 — `report_sharing/events` subcollection rules + tests

**Files:**

- Modify: `infra/firebase/firestore.rules.template`
- Create: `functions/src/__tests__/rules/report-sharing.rules.test.ts`

- [ ] **Step 1: Write failing tests**

Create `functions/src/__tests__/rules/report-sharing.rules.test.ts`:

```typescript
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('report-sharing-rules-test')
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  // Seed a report_sharing parent doc
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'report_sharing', 'r1'), {
      ownerMunicipalityId: 'daet',
      reportId: 'r1',
      sharedWith: ['mercedes'],
      createdAt: ts,
      updatedAt: ts,
      schemaVersion: 1,
    })
  })
})

afterAll(async () => {
  await env.cleanup()
})

const validEvent = {
  targetMunicipalityId: 'mercedes',
  sharedBy: 'daet-admin',
  sharedAt: ts,
  sharedReason: 'Border incident',
  source: 'manual',
  schemaVersion: 1,
}

describe('report_sharing/events rules', () => {
  it('allows muni admin to read sharing doc for own municipality', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'report_sharing', 'r1')))
  })

  it('allows muni admin to write event to subcollection', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(addDoc(collection(db, 'report_sharing', 'r1', 'events'), validEvent))
  })

  it('a second share appends a second event without overwriting first', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      addDoc(collection(db, 'report_sharing', 'r1', 'events'), {
        ...validEvent,
        targetMunicipalityId: 'labo',
      }),
    )
    const snap = await getDocs(
      collection(
        env.withSecurityRulesDisabled((ctx) => ctx.firestore()) as never,
        'report_sharing',
        'r1',
        'events',
      ),
    )
    expect(snap.size).toBeGreaterThanOrEqual(2)
  })

  it('denies citizen writes to events subcollection', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(addDoc(collection(db, 'report_sharing', 'r1', 'events'), validEvent))
  })

  it('denies unauthenticated reads', async () => {
    const db = unauthed(env)
    await assertFails(getDoc(doc(db, 'report_sharing', 'r1')))
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rules/report-sharing.rules.test.ts"
```

Expected: FAIL — events subcollection unmatched (default deny).

- [ ] **Step 3: Update `report_sharing` rules in template**

Replace the existing `match /report_sharing/{r}` block:

```javascript
    match /report_sharing/{r} {
      allow read: if adminOf(resource.data.ownerMunicipalityId)
                  || (isActivePrivileged() && resource.data.sharedWith.hasAny([myMunicipality()]));
      allow write: if false;

      match /events/{eventId} {
        allow read: if isActivePrivileged()
                    && (isMuniAdmin() || isAgencyAdmin() || isSuperadmin());
        allow create: if isActivePrivileged()
                      && (isMuniAdmin() || isSuperadmin());
        allow update, delete: if false;
      }
    }
```

- [ ] **Step 4: Regenerate + run tests**

```bash
pnpm exec tsx scripts/build-rules.ts && \
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rules/report-sharing.rules.test.ts"
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add infra/firebase/firestore.rules.template \
        infra/firebase/firestore.rules \
        functions/src/__tests__/rules/report-sharing.rules.test.ts
git commit -m "feat(rules): report_sharing/events subcollection — append-only writes for muni admins"
```

---

### Task 9: PRE-B.2 — `processInboxItem` writes `reportType` + `locationGeohash`

**Files:**

- Extend: `functions/src/__tests__/triggers/process-inbox-item.test.ts`
- Modify: `functions/src/triggers/process-inbox-item.ts`

- [ ] **Step 1: Add failing tests to existing test file**

Find the `process-inbox-item.test.ts` file and append these test cases to the existing describe block:

```typescript
it('writes reportType onto report_ops when materializing triptych', async () => {
  const inboxId = 'inbox-reporttype-test'
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'report_inbox', inboxId), {
      reporterUid: 'user-1',
      clientCreatedAt: ts,
      idempotencyKey: crypto.randomUUID(),
      publicRef: 'a1b2c3d4',
      secretHash: 'a'.repeat(64),
      correlationId: crypto.randomUUID(),
      payload: {
        reportType: 'flood',
        description: 'Flooding in barangay',
        municipalityId: 'daet',
        barangayId: 'DAET-01',
        severity: 'high',
        source: 'citizen_pwa',
      },
    })
  })

  await processInboxItemCore({ db: adminDb, inboxId })

  const opsSnap = await adminDb
    .collection('report_ops')
    .where('schemaVersion', '>=', 1)
    .limit(5)
    .get()
  const ops = opsSnap.docs.find((d) => d.data().municipalityId === 'daet')
  expect(ops?.data().reportType).toBe('flood')
})

it('writes 6-char locationGeohash onto report_ops when exactLocation present', async () => {
  const inboxId = 'inbox-geohash-test'
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'report_inbox', inboxId), {
      reporterUid: 'user-2',
      clientCreatedAt: ts,
      idempotencyKey: crypto.randomUUID(),
      publicRef: 'b2c3d4e5',
      secretHash: 'b'.repeat(64),
      correlationId: crypto.randomUUID(),
      payload: {
        reportType: 'fire',
        description: 'Structure fire',
        municipalityId: 'daet',
        barangayId: 'DAET-01',
        severity: 'high',
        source: 'citizen_pwa',
        exactLocation: { lat: 14.1667, lng: 122.9167 },
      },
    })
  })

  await processInboxItemCore({ db: adminDb, inboxId })

  const opsSnap = await adminDb
    .collection('report_ops')
    .where('schemaVersion', '>=', 1)
    .limit(10)
    .get()
  const ops = opsSnap.docs.find((d) => d.data().reportType === 'fire')
  expect(ops?.data().locationGeohash).toMatch(/^[a-z0-9]{6}$/)
})

it('omits locationGeohash from report_ops when exactLocation absent', async () => {
  const inboxId = 'inbox-noloc-test'
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'report_inbox', inboxId), {
      reporterUid: 'user-3',
      clientCreatedAt: ts,
      idempotencyKey: crypto.randomUUID(),
      publicRef: 'c3d4e5f6',
      secretHash: 'c'.repeat(64),
      correlationId: crypto.randomUUID(),
      payload: {
        reportType: 'flood',
        description: 'SMS flood report',
        municipalityId: 'daet',
        barangayId: 'DAET-01',
        severity: 'medium',
        source: 'sms',
      },
    })
  })

  await processInboxItemCore({ db: adminDb, inboxId })

  const opsSnap = await adminDb
    .collection('report_ops')
    .where('schemaVersion', '>=', 1)
    .limit(15)
    .get()
  const ops = opsSnap.docs.find(
    (d) => d.data().reportType === 'flood' && d.data().municipalityId === 'daet',
  )
  expect(ops?.data().locationGeohash).toBeUndefined()
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/triggers/process-inbox-item.test.ts"
```

Expected: FAIL — `reportType` is `undefined` on `report_ops`, `locationGeohash` is `undefined`.

- [ ] **Step 3: Add `ngeohash` dependency**

```bash
pnpm --filter @bantayog/functions add ngeohash
pnpm --filter @bantayog/functions add -D @types/ngeohash
```

- [ ] **Step 4: Update `processInboxItem.ts` to write `reportType` + `locationGeohash`**

In `functions/src/triggers/process-inbox-item.ts`, find where `report_ops` is written (the `tx.set(db.collection('report_ops')...)` call) and add the new fields:

```typescript
import ngeohash from 'ngeohash'

// In the report_ops write, add:
const exactLocation = payload.exactLocation as { lat: number; lng: number } | undefined
const locationGeohash = exactLocation
  ? ngeohash.encode(exactLocation.lat, exactLocation.lng, 6)
  : undefined

tx.set(db.collection('report_ops').doc(reportId), {
  // ...existing fields...
  reportType: payload.reportType as string | undefined,
  ...(locationGeohash ? { locationGeohash } : {}),
})
```

- [ ] **Step 5: Run to confirm pass**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/triggers/process-inbox-item.test.ts"
```

Expected: PASS (all existing + 3 new tests)

- [ ] **Step 6: Commit**

```bash
git add functions/src/triggers/process-inbox-item.ts \
        functions/src/__tests__/triggers/process-inbox-item.test.ts \
        functions/package.json pnpm-lock.yaml
git commit -m "feat(process-inbox): write reportType and locationGeohash onto report_ops"
```

---

### Task 10: Final gate — lint + typecheck + full rules suite

- [ ] **Step 1: Run full lint + typecheck**

```bash
npx turbo run lint typecheck
```

Expected: PASS (all packages)

- [ ] **Step 2: Run all rules tests together**

```bash
firebase emulators:exec --only firestore \
  "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rules/"
```

Expected: PASS (all rules test files)

- [ ] **Step 3: Run shared-validators full test suite**

```bash
pnpm --filter @bantayog/shared-validators exec vitest run
```

Expected: PASS (all tests including new schema tests)

- [ ] **Step 4: Final commit if any loose files**

```bash
git status
# If clean — no commit needed
# If dirty — check what's left and commit with appropriate message
```

---

## Prerequisites for Cluster B

Before starting `2026-04-24-phase5-cluster-b.md`:

- [ ] This plan is fully complete and all tests pass
- [ ] `npx turbo run lint typecheck` is green
- [ ] `pnpm exec tsx scripts/build-rules.ts` produces no errors
