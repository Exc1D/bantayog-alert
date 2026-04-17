# Phase 2 Data Model and Security Rules Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Firestore collection in Arch Spec §5.5 has a Zod schema in `@bantayog/shared-validators`, a Firestore rule block, and an emulator test asserting both the authorised read/write and its explicit deny. RTDB rules, Storage rules, composite indexes, the idempotency-key Cloud Function helper, the rule-coverage CI gate, and the schema-migration protocol doc all land in the same phase so nothing bolts on later.

**Architecture:** Schema-first. Define the document shape as a Zod schema (source of truth per Arch Spec §0), derive TypeScript types with `z.infer`, write the rule block using the exact field names the schema enforces, then write both positive and negative emulator tests before shipping. Rules use the `isActivePrivileged()` helper established in Phase 1 — privileged reads and writes require a live `active_accounts/{uid}` document with `accountStatus == 'active'`. Citizens write only to `report_inbox`; every other mutation is callable-only (`allow write: if false` at the rule layer). The idempotency framework is a Cloud Function helper that opens a Firestore transaction on `idempotency_keys/{key}`, compares the canonical payload hash from Phase 1 (`canonicalPayloadHash`), and either short-circuits with the cached result or proceeds with the callable-specific mutation.

**Tech Stack:** TypeScript 5.6, Zod 3, Firebase Cloud Functions v2 (Node 20), `@firebase/rules-unit-testing` 5, Firestore Security Rules v2, Vitest 3, Firebase Admin SDK 13, Firebase CLI 14, pnpm 9.12, Turbo 2.

---

## Scope Check

Phase 2 covers one subsystem: the data-model-and-rules foundation. It does not ship the citizen submission flow (Phase 3), the SMS ingest (Phase 4), the surge pre-warm (Phase 8), or any hazard authoring (Phase 10). It does define the schemas those phases will write into, because every later phase's rules assume the enum literals and field shapes locked in here.

If during execution a task reveals the need for a new collection not in Arch Spec §5.5, stop and escalate — adding a collection outside the spec is a spec amendment, not a plan step.

---

## File Structure

- Modify: `packages/shared-types/src/enums.ts`
- Modify: `packages/shared-types/src/branded.ts`
- Modify: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/src/states.ts`
- Modify: `packages/shared-validators/src/index.ts`
- Create: `packages/shared-validators/src/reports.ts`
- Create: `packages/shared-validators/src/reports.test.ts`
- Create: `packages/shared-validators/src/dispatches.ts`
- Create: `packages/shared-validators/src/dispatches.test.ts`
- Create: `packages/shared-validators/src/events.ts`
- Create: `packages/shared-validators/src/events.test.ts`
- Create: `packages/shared-validators/src/agencies.ts`
- Create: `packages/shared-validators/src/responders.ts`
- Create: `packages/shared-validators/src/users.ts`
- Create: `packages/shared-validators/src/alerts-emergencies.ts`
- Create: `packages/shared-validators/src/sms.ts`
- Create: `packages/shared-validators/src/coordination.ts`
- Create: `packages/shared-validators/src/hazard.ts`
- Create: `packages/shared-validators/src/incident-response.ts`
- Create: `packages/shared-validators/src/moderation.ts`
- Create: `packages/shared-validators/src/rate-limits.ts`
- Create: `packages/shared-validators/src/idempotency-keys.ts`
- Create: `packages/shared-validators/src/dead-letters.ts`
- Create: `packages/shared-validators/src/shared-schemas.test.ts`
- Modify: `infra/firebase/firestore.rules`
- Modify: `infra/firebase/firestore.indexes.json`
- Modify: `infra/firebase/database.rules.json`
- Modify: `infra/firebase/storage.rules`
- Modify: `functions/package.json`
- Create: `functions/src/idempotency/guard.ts`
- Create: `functions/src/idempotency/guard.test.ts`
- Create: `functions/src/__tests__/helpers/rules-harness.ts`
- Create: `functions/src/__tests__/helpers/seed-factories.ts`
- Create: `functions/src/__tests__/rules/report-inbox.rules.test.ts`
- Create: `functions/src/__tests__/rules/reports.rules.test.ts`
- Create: `functions/src/__tests__/rules/report-private.rules.test.ts`
- Create: `functions/src/__tests__/rules/report-ops.rules.test.ts`
- Create: `functions/src/__tests__/rules/report-sharing.rules.test.ts`
- Create: `functions/src/__tests__/rules/report-contacts.rules.test.ts`
- Create: `functions/src/__tests__/rules/report-lookup.rules.test.ts`
- Create: `functions/src/__tests__/rules/report-events.rules.test.ts`
- Create: `functions/src/__tests__/rules/dispatches.rules.test.ts`
- Create: `functions/src/__tests__/rules/users-responders.rules.test.ts`
- Create: `functions/src/__tests__/rules/public-collections.rules.test.ts`
- Create: `functions/src/__tests__/rules/sms.rules.test.ts`
- Create: `functions/src/__tests__/rules/coordination.rules.test.ts`
- Create: `functions/src/__tests__/rules/hazard-zones.rules.test.ts`
- Create: `functions/src/__tests__/rtdb.rules.test.ts`
- Create: `functions/src/__tests__/storage.rules.test.ts`
- Create: `scripts/check-rule-coverage.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `firebase.json`
- Create: `docs/runbooks/schema-migration.md`
- Modify: `docs/progress.md`
- Modify: `docs/learnings.md`
- Modify: `README.md`

---

## Task 1: Reconcile Enums and Branded IDs with Arch Spec §5

**Context:** The existing `ReportStatus` has 10 states; spec §5.3 defines 13. `VisibilityClass` uses `'public' | 'private' | 'restricted'`; spec uses `'internal' | 'public_alertable'`. `HazardType` uses `'_zone'` suffixes; spec uses bare `'flood' | 'landslide' | 'storm_surge'`. These drift bugs will make every Task 2+ schema mis-type. Fix first.

**Files:**

- Modify: `packages/shared-types/src/enums.ts`
- Modify: `packages/shared-types/src/branded.ts`
- Create: `packages/shared-types/src/states.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-validators/src/shared-schemas.test.ts` (created in later step)

- [ ] **Step 1: Replace the enum definitions in `packages/shared-types/src/enums.ts`**

Overwrite the whole file:

```ts
// Role literals MUST match spec §5.7 exactly. Do NOT add `dispatcher`,
// `provincial_admin`, or `super_admin` — those do not exist in the spec's role model.
export type UserRole =
  | 'citizen'
  | 'responder'
  | 'municipal_admin'
  | 'agency_admin'
  | 'provincial_superadmin'

export type AccountStatus = 'active' | 'suspended' | 'disabled'

// Report lifecycle — spec §5.3 (13 states + `draft_inbox` pre-materialisation).
export type ReportStatus =
  | 'draft_inbox'
  | 'new'
  | 'awaiting_verify'
  | 'verified'
  | 'assigned'
  | 'acknowledged'
  | 'en_route'
  | 'on_scene'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'rejected'
  | 'cancelled'
  | 'cancelled_false_report'
  | 'merged_as_duplicate'

// Dispatch lifecycle — spec §5.4.
export type DispatchStatus =
  | 'pending'
  | 'accepted'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'declined'
  | 'timed_out'
  | 'cancelled'
  | 'superseded'

export type Severity = 'low' | 'medium' | 'high'

export type ReportType =
  | 'flood'
  | 'fire'
  | 'earthquake'
  | 'typhoon'
  | 'landslide'
  | 'storm_surge'
  | 'medical'
  | 'accident'
  | 'structural'
  | 'security'
  | 'other'

export type IncidentSource = 'web' | 'sms' | 'responder_witness'

// Spec §5.1 — `visibilityClass` gates public readability on `reports/{id}`.
export type VisibilityClass = 'internal' | 'public_alertable'

// Spec §22.2 — hazard taxonomy. Bare literals, not `_zone` suffixed.
export type HazardType = 'flood' | 'landslide' | 'storm_surge'

export type HazardZoneType = 'reference' | 'custom'

export type HazardZoneScope = 'provincial' | 'municipality'

export type TelemetryStatus = 'online' | 'stale' | 'offline'

export type ReporterRole = 'citizen' | 'responder'

export type VisibilityScope = 'municipality' | 'shared' | 'provincial'

export type MediaKind = 'image' | 'video' | 'audio'

export type AssistanceRequestType = 'BFP' | 'PNP' | 'PCG' | 'RED_CROSS' | 'DPWH' | 'OTHER'

export type AssistanceRequestStatus = 'pending' | 'accepted' | 'declined' | 'fulfilled' | 'expired'

export type MassAlertStatus =
  | 'queued'
  | 'submitted_to_pdrrmo'
  | 'forwarded_to_ndrrmc'
  | 'acknowledged_by_ndrrmc'
  | 'cancelled'

export type SmsProviderId = 'semaphore' | 'globelabs'

export type SmsDirection = 'outbound' | 'inbound'

export type SmsOutboxStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'undelivered'
  | 'abandoned'

export type SmsPurpose =
  | 'receipt_ack'
  | 'status_update'
  | 'verification'
  | 'resolution'
  | 'mass_alert'
  | 'emergency_declaration'

export type LocationPrecision = 'gps' | 'barangay' | 'municipality'
```

- [ ] **Step 2: Add hazard- and zone-specific branded IDs to `packages/shared-types/src/branded.ts`**

Append to the existing file (keep everything currently there):

```ts
export type HazardZoneId = string & { readonly __brand: 'HazardZoneId' }
export type HazardZoneVersion = number & { readonly __brand: 'HazardZoneVersion' }
export type DispatchRequestId = string & { readonly __brand: 'DispatchRequestId' }
export type CommandThreadId = string & { readonly __brand: 'CommandThreadId' }
export type CommandMessageId = string & { readonly __brand: 'CommandMessageId' }
export type ShiftHandoffId = string & { readonly __brand: 'ShiftHandoffId' }
export type MassAlertRequestId = string & { readonly __brand: 'MassAlertRequestId' }
export type MediaRef = string & { readonly __brand: 'MediaRef' }
export type PublicTrackingRef = string & { readonly __brand: 'PublicTrackingRef' }
export type IdempotencyKey = string & { readonly __brand: 'IdempotencyKey' }

export const asHazardZoneId = (v: string): HazardZoneId => v as HazardZoneId
export const asDispatchRequestId = (v: string): DispatchRequestId => v as DispatchRequestId
export const asCommandThreadId = (v: string): CommandThreadId => v as CommandThreadId
export const asCommandMessageId = (v: string): CommandMessageId => v as CommandMessageId
export const asShiftHandoffId = (v: string): ShiftHandoffId => v as ShiftHandoffId
export const asMassAlertRequestId = (v: string): MassAlertRequestId => v as MassAlertRequestId
export const asMediaRef = (v: string): MediaRef => v as MediaRef
export const asPublicTrackingRef = (v: string): PublicTrackingRef => v as PublicTrackingRef
export const asIdempotencyKey = (v: string): IdempotencyKey => v as IdempotencyKey
```

- [ ] **Step 3: Create `packages/shared-types/src/states.ts` with the canonical transition tables**

```ts
import type { DispatchStatus, ReportStatus } from './enums.js'

// Spec §5.3 — every valid report transition. Any transition not in this set
// is a rule violation and must be rejected server-side.
export const REPORT_TRANSITIONS: readonly [ReportStatus, ReportStatus][] = [
  ['draft_inbox', 'new'],
  ['draft_inbox', 'rejected'],
  ['new', 'awaiting_verify'],
  ['new', 'merged_as_duplicate'],
  ['awaiting_verify', 'verified'],
  ['awaiting_verify', 'merged_as_duplicate'],
  ['awaiting_verify', 'cancelled_false_report'],
  ['verified', 'assigned'],
  ['assigned', 'acknowledged'],
  ['acknowledged', 'en_route'],
  ['en_route', 'on_scene'],
  ['on_scene', 'resolved'],
  ['resolved', 'closed'],
  ['closed', 'reopened'],
  ['reopened', 'assigned'],
  // Any active state → cancelled (admin with reason)
  ['new', 'cancelled'],
  ['awaiting_verify', 'cancelled'],
  ['verified', 'cancelled'],
  ['assigned', 'cancelled'],
  ['acknowledged', 'cancelled'],
  ['en_route', 'cancelled'],
  ['on_scene', 'cancelled'],
] as const

// Spec §5.4 — dispatch transitions. Only responder-direct transitions are
// candidates for rule-layer enforcement; server-authoritative transitions
// live in callables.
export const DISPATCH_RESPONDER_DIRECT_TRANSITIONS: readonly [DispatchStatus, DispatchStatus][] = [
  ['accepted', 'acknowledged'],
  ['acknowledged', 'in_progress'],
  ['in_progress', 'resolved'],
  ['pending', 'declined'],
] as const

export function isValidReportTransition(from: ReportStatus, to: ReportStatus): boolean {
  return REPORT_TRANSITIONS.some(([f, t]) => f === from && t === to)
}

export function isValidResponderDispatchTransition(
  from: DispatchStatus,
  to: DispatchStatus,
): boolean {
  return DISPATCH_RESPONDER_DIRECT_TRANSITIONS.some(([f, t]) => f === from && t === to)
}
```

- [ ] **Step 4: Export `states` from `packages/shared-types/src/index.ts`**

```ts
export * from './auth.js'
export * from './branded.js'
export * from './config.js'
export * from './enums.js'
export * from './geo.js'
export * from './states.js'
```

- [ ] **Step 5: Typecheck the shared-types package**

Run: `pnpm --filter @bantayog/shared-types typecheck`
Expected: PASS (0 errors).

- [ ] **Step 6: Audit consumers for stale enum usage and fix compile errors**

Run: `pnpm typecheck`
Expected: may show type errors in `packages/shared-validators`, `functions`, or app code referencing the removed literals (`'draft'`, `'duplicate'`, `'private'`, `'flood_zone'`, etc.). Fix each by replacing with the new canonical literal. If the current code uses `Severity = 'info' | 'low' | 'medium' | 'high' | 'critical'`, update to `'low' | 'medium' | 'high'` (spec uses 3 severity buckets; `info` was an in-code invention, `critical` is handled via `declareEmergency`).

- [ ] **Step 7: Run the full test suite to confirm Phase 1 tests still pass after enum tightening**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/shared-types apps packages/shared-validators functions
git commit -m "refactor(shared-types): reconcile enums + transition tables with arch spec §5"
```

---

## Task 2: Report Triptych Zod Schemas

**Context:** Spec §5.1 defines three documents per report with separate access tiers. Phase 2 ships the schemas so Phase 3's `processInboxItem` trigger has a canonical shape to validate against. The schemas must refuse unknown keys — Firestore rule checks rely on `diff(resource.data).affectedKeys().hasOnly([...])`, and any key drift lands in production as a permission denial.

**Files:**

- Create: `packages/shared-validators/src/reports.ts`
- Create: `packages/shared-validators/src/reports.test.ts`
- Modify: `packages/shared-validators/src/index.ts`

- [ ] **Step 1: Write the failing triptych schema tests**

```ts
// packages/shared-validators/src/reports.test.ts
import { describe, expect, it } from 'vitest'
import {
  reportDocSchema,
  reportPrivateDocSchema,
  reportOpsDocSchema,
  reportSharingDocSchema,
  reportContactsDocSchema,
  reportLookupDocSchema,
  reportInboxDocSchema,
  hazardTagSchema,
} from './reports.js'

const ts = 1713350400000

describe('reportDocSchema', () => {
  it('accepts a canonical verified report', () => {
    expect(
      reportDocSchema.parse({
        municipalityId: 'daet',
        barangayId: 'calasgasan',
        reporterRole: 'citizen',
        reportType: 'flood',
        severity: 'high',
        status: 'verified',
        publicLocation: { lat: 14.11, lng: 122.95 },
        mediaRefs: [],
        description: 'knee-deep water',
        submittedAt: ts,
        verifiedAt: ts,
        retentionExempt: false,
        visibilityClass: 'public_alertable',
        visibility: { scope: 'municipality', sharedWith: [] },
        source: 'web',
        hasPhotoAndGPS: false,
        schemaVersion: 1,
      }),
    ).toMatchObject({ status: 'verified' })
  })

  it('rejects an invalid status literal', () => {
    expect(() =>
      reportDocSchema.parse({
        municipalityId: 'daet',
        reporterRole: 'citizen',
        reportType: 'flood',
        severity: 'high',
        status: 'triaged', // not a valid ReportStatus
        mediaRefs: [],
        description: 'x',
        submittedAt: ts,
        retentionExempt: false,
        visibilityClass: 'internal',
        visibility: { scope: 'municipality', sharedWith: [] },
        source: 'web',
        hasPhotoAndGPS: false,
        schemaVersion: 1,
      }),
    ).toThrow()
  })

  it('rejects unknown top-level keys via strict mode', () => {
    expect(() =>
      reportDocSchema.parse({
        municipalityId: 'daet',
        reporterRole: 'citizen',
        reportType: 'flood',
        severity: 'high',
        status: 'new',
        mediaRefs: [],
        description: 'x',
        submittedAt: ts,
        retentionExempt: false,
        visibilityClass: 'internal',
        visibility: { scope: 'municipality', sharedWith: [] },
        source: 'web',
        hasPhotoAndGPS: false,
        schemaVersion: 1,
        // Unknown field — rule check .hasOnly([...]) will later reject the write.
        // The schema refusing it keeps callable code honest.
        internalNotes: 'leak',
      }),
    ).toThrow()
  })
})

describe('reportPrivateDocSchema', () => {
  it('requires reporterUid and publicTrackingRef', () => {
    expect(() =>
      reportPrivateDocSchema.parse({
        municipalityId: 'daet',
        isPseudonymous: true,
        createdAt: ts,
        schemaVersion: 1,
      }),
    ).toThrow()
  })
})

describe('reportOpsDocSchema', () => {
  it('accepts denormalised status and severity', () => {
    expect(
      reportOpsDocSchema.parse({
        municipalityId: 'daet',
        status: 'assigned',
        severity: 'high',
        createdAt: ts,
        agencyIds: ['bfp'],
        activeResponderCount: 1,
        requiresLocationFollowUp: false,
        visibility: { scope: 'municipality', sharedWith: [] },
        updatedAt: ts,
        schemaVersion: 1,
      }),
    ).toMatchObject({ status: 'assigned' })
  })
})

describe('hazardTagSchema', () => {
  it('rejects invalid hazardType literals', () => {
    expect(() =>
      hazardTagSchema.parse({
        zoneId: 'flood-1',
        zoneVersion: 1,
        hazardType: 'flood_zone', // old enum — must be rejected
        severity: 'high',
        taggedAt: ts,
        taggedBy: 'ingest',
      }),
    ).toThrow()
  })
})

describe('reportInboxDocSchema', () => {
  it('requires reporterUid, clientCreatedAt, idempotencyKey, payload', () => {
    expect(() =>
      reportInboxDocSchema.parse({
        reporterUid: 'c1',
        clientCreatedAt: ts,
        payload: { reportType: 'flood' },
      }),
    ).toThrow()
  })

  it('accepts a minimal valid inbox payload', () => {
    expect(
      reportInboxDocSchema.parse({
        reporterUid: 'c1',
        clientCreatedAt: ts,
        payload: { reportType: 'flood', description: 'x', source: 'web' },
        idempotencyKey: 'dedup-1',
      }),
    ).toMatchObject({ reporterUid: 'c1' })
  })
})

describe('reportSharingDocSchema', () => {
  it('requires ownerMunicipalityId and sharedWith', () => {
    expect(() =>
      reportSharingDocSchema.parse({ reportId: 'r1', scope: 'shared', updatedAt: ts }),
    ).toThrow()
  })
})

describe('reportContactsDocSchema', () => {
  it('makes contact fields optional when followUpConsent is false', () => {
    expect(
      reportContactsDocSchema.parse({
        municipalityId: 'daet',
        followUpConsent: false,
        createdAt: ts,
        schemaVersion: 1,
      }),
    ).toMatchObject({ followUpConsent: false })
  })
})

describe('reportLookupDocSchema', () => {
  it('requires tokenHash and expiresAt', () => {
    expect(() => reportLookupDocSchema.parse({ reportId: 'r1' })).toThrow()
  })
})
```

- [ ] **Step 2: Run the test; confirm it fails because `./reports.js` does not exist**

Run: `pnpm --filter @bantayog/shared-validators test reports.test.ts`
Expected: FAIL — "Cannot find module './reports.js'".

- [ ] **Step 3: Implement `packages/shared-validators/src/reports.ts`**

```ts
import { z } from 'zod'

const geoPoint = z.object({ lat: z.number(), lng: z.number() }).strict()

const reportStatusSchema = z.enum([
  'draft_inbox',
  'new',
  'awaiting_verify',
  'verified',
  'assigned',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'closed',
  'reopened',
  'rejected',
  'cancelled',
  'cancelled_false_report',
  'merged_as_duplicate',
])

const severitySchema = z.enum(['low', 'medium', 'high'])
const reportTypeSchema = z.enum([
  'flood',
  'fire',
  'earthquake',
  'typhoon',
  'landslide',
  'storm_surge',
  'medical',
  'accident',
  'structural',
  'security',
  'other',
])
const visibilityClassSchema = z.enum(['internal', 'public_alertable'])
const visibilityScopeSchema = z.enum(['municipality', 'shared', 'provincial'])
const sourceSchema = z.enum(['web', 'sms', 'responder_witness'])
const hazardTypeSchema = z.enum(['flood', 'landslide', 'storm_surge'])

export const hazardTagSchema = z
  .object({
    zoneId: z.string().min(1),
    zoneVersion: z.number().int().nonnegative(),
    hazardType: hazardTypeSchema,
    severity: severitySchema,
    taggedAt: z.number().int(),
    taggedBy: z.enum(['ingest', 'zone_sweep']),
  })
  .strict()

const visibilityBlock = z
  .object({
    scope: visibilityScopeSchema,
    sharedWith: z.array(z.string()).default([]),
  })
  .strict()

export const reportDocSchema = z
  .object({
    municipalityId: z.string().min(1),
    barangayId: z.string().min(1).optional(),
    reporterRole: z.enum(['citizen', 'responder']),
    reportType: reportTypeSchema,
    severity: severitySchema,
    status: reportStatusSchema,
    publicLocation: geoPoint.optional(),
    mediaRefs: z.array(z.string()),
    description: z.string().max(2000),
    submittedAt: z.number().int(),
    verifiedAt: z.number().int().optional(),
    resolvedAt: z.number().int().optional(),
    archivedAt: z.number().int().optional(),
    deletedAt: z.number().int().optional(),
    retentionExempt: z.boolean(),
    visibilityClass: visibilityClassSchema,
    visibility: visibilityBlock,
    source: sourceSchema,
    witnessPriorityFlag: z.boolean().optional(),
    hasPhotoAndGPS: z.boolean(),
    duplicateClusterId: z.string().optional(),
    mergedInto: z.string().optional(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const reportPrivateDocSchema = z
  .object({
    municipalityId: z.string().min(1),
    reporterUid: z.string().min(1),
    reporterMsisdnHash: z.string().length(64).optional(),
    isPseudonymous: z.boolean(),
    exactLocation: geoPoint.optional(),
    publicTrackingRef: z.string().min(8),
    contact: z
      .object({
        reporterName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        followUpConsent: z.boolean(),
      })
      .strict()
      .optional(),
    createdAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const reportOpsDocSchema = z
  .object({
    municipalityId: z.string().min(1),
    status: reportStatusSchema,
    severity: severitySchema,
    createdAt: z.number().int(),
    agencyIds: z.array(z.string()),
    classification: z.string().optional(),
    verifiedBy: z.string().optional(),
    classifiedBy: z.string().optional(),
    duplicateOf: z.string().optional(),
    escalatedTo: z.string().optional(),
    activeResponderCount: z.number().int().nonnegative(),
    notesSummary: z.string().optional(),
    requiresLocationFollowUp: z.boolean(),
    witnessPriorityFlag: z.boolean().optional(),
    visibility: visibilityBlock,
    locationGeohash: z.string().length(6).optional(),
    hazardZoneIds: z.array(hazardTagSchema).optional(),
    hazardZoneIdList: z.array(z.string()).optional(),
    updatedAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const reportSharingDocSchema = z
  .object({
    reportId: z.string().min(1),
    ownerMunicipalityId: z.string().min(1),
    scope: visibilityScopeSchema,
    sharedWith: z.array(z.string()),
    sharedReason: z.string().optional(),
    sharedAt: z.number().int().optional(),
    sharedBy: z.string().optional(),
    updatedAt: z.number().int(),
  })
  .strict()

export const reportContactsDocSchema = z
  .object({
    municipalityId: z.string().min(1),
    reporterName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    followUpConsent: z.boolean(),
    createdAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const reportLookupDocSchema = z
  .object({
    reportId: z.string().min(1),
    tokenHash: z.string().length(64),
    expiresAt: z.number().int(),
    createdAt: z.number().int(),
  })
  .strict()

export const reportInboxDocSchema = z
  .object({
    reporterUid: z.string().min(1),
    clientCreatedAt: z.number().int(),
    idempotencyKey: z.string().min(1),
    payload: z.record(z.unknown()),
    processingStatus: z.enum(['pending', 'processed', 'failed']).optional(),
    createdAt: z.number().int().optional(),
  })
  .strict()

export type ReportDoc = z.infer<typeof reportDocSchema>
export type ReportPrivateDoc = z.infer<typeof reportPrivateDocSchema>
export type ReportOpsDoc = z.infer<typeof reportOpsDocSchema>
export type ReportSharingDoc = z.infer<typeof reportSharingDocSchema>
export type ReportContactsDoc = z.infer<typeof reportContactsDocSchema>
export type ReportLookupDoc = z.infer<typeof reportLookupDocSchema>
export type ReportInboxDoc = z.infer<typeof reportInboxDocSchema>
export type HazardTag = z.infer<typeof hazardTagSchema>
```

- [ ] **Step 4: Re-export from the shared-validators barrel**

Append to `packages/shared-validators/src/index.ts`:

```ts
export {
  reportDocSchema,
  reportPrivateDocSchema,
  reportOpsDocSchema,
  reportSharingDocSchema,
  reportContactsDocSchema,
  reportLookupDocSchema,
  reportInboxDocSchema,
  hazardTagSchema,
} from './reports.js'
export type {
  ReportDoc,
  ReportPrivateDoc,
  ReportOpsDoc,
  ReportSharingDoc,
  ReportContactsDoc,
  ReportLookupDoc,
  ReportInboxDoc,
  HazardTag,
} from './reports.js'
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @bantayog/shared-validators test`
Expected: PASS (all tests in `reports.test.ts` + pre-existing Phase 1 tests green).

- [ ] **Step 6: Commit**

```bash
git add packages/shared-validators/src/reports.ts packages/shared-validators/src/reports.test.ts packages/shared-validators/src/index.ts
git commit -m "feat(shared-validators): add report triptych + inbox schemas"
```

---

## Task 3: Dispatch, Event-Stream, and Agency/User Schemas

**Files:**

- Create: `packages/shared-validators/src/dispatches.ts`
- Create: `packages/shared-validators/src/dispatches.test.ts`
- Create: `packages/shared-validators/src/events.ts`
- Create: `packages/shared-validators/src/events.test.ts`
- Create: `packages/shared-validators/src/agencies.ts`
- Create: `packages/shared-validators/src/responders.ts`
- Create: `packages/shared-validators/src/users.ts`
- Modify: `packages/shared-validators/src/index.ts`

- [ ] **Step 1: Write failing tests for dispatches and events**

```ts
// packages/shared-validators/src/dispatches.test.ts
import { describe, expect, it } from 'vitest'
import { dispatchDocSchema } from './dispatches.js'

const ts = 1713350400000

describe('dispatchDocSchema', () => {
  it('accepts a pending dispatch with required idempotency fields', () => {
    expect(
      dispatchDocSchema.parse({
        reportId: 'r1',
        responderId: 'u-resp-1',
        municipalityId: 'daet',
        agencyId: 'bfp',
        dispatchedBy: 'u-admin-1',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: ts,
        status: 'pending',
        statusUpdatedAt: ts,
        acknowledgementDeadlineAt: ts + 180000,
        idempotencyKey: 'k-1',
        idempotencyPayloadHash: 'a'.repeat(64),
        schemaVersion: 1,
      }),
    ).toMatchObject({ status: 'pending' })
  })

  it('rejects dispatchedByRole values outside the allowed union', () => {
    expect(() =>
      dispatchDocSchema.parse({
        reportId: 'r1',
        responderId: 'u',
        municipalityId: 'daet',
        agencyId: 'bfp',
        dispatchedBy: 'x',
        dispatchedByRole: 'citizen',
        dispatchedAt: ts,
        status: 'pending',
        statusUpdatedAt: ts,
        acknowledgementDeadlineAt: ts + 1,
        idempotencyKey: 'k',
        idempotencyPayloadHash: 'b'.repeat(64),
        schemaVersion: 1,
      }),
    ).toThrow()
  })
})
```

```ts
// packages/shared-validators/src/events.test.ts
import { describe, expect, it } from 'vitest'
import { reportEventSchema, dispatchEventSchema } from './events.js'

const ts = 1713350400000

describe('reportEventSchema', () => {
  it('accepts a verify transition event', () => {
    expect(
      reportEventSchema.parse({
        reportId: 'r1',
        municipalityId: 'daet',
        actor: 'admin-1',
        actorRole: 'municipal_admin',
        fromStatus: 'awaiting_verify',
        toStatus: 'verified',
        reason: 'visual confirmed',
        createdAt: ts,
        correlationId: 'corr-1',
        schemaVersion: 1,
      }),
    ).toMatchObject({ toStatus: 'verified' })
  })

  it('rejects event without correlationId (audit requires it)', () => {
    expect(() =>
      reportEventSchema.parse({
        reportId: 'r1',
        municipalityId: 'daet',
        actor: 'a',
        actorRole: 'municipal_admin',
        fromStatus: 'new',
        toStatus: 'awaiting_verify',
        createdAt: ts,
        schemaVersion: 1,
      }),
    ).toThrow()
  })
})

describe('dispatchEventSchema', () => {
  it('accepts an accepted-by-responder event', () => {
    expect(
      dispatchEventSchema.parse({
        dispatchId: 'd1',
        reportId: 'r1',
        actor: 'u-resp-1',
        actorRole: 'responder',
        fromStatus: 'pending',
        toStatus: 'accepted',
        createdAt: ts,
        correlationId: 'c-1',
        schemaVersion: 1,
      }),
    ).toMatchObject({ toStatus: 'accepted' })
  })
})
```

- [ ] **Step 2: Implement the dispatch schema**

```ts
// packages/shared-validators/src/dispatches.ts
import { z } from 'zod'

export const dispatchStatusSchema = z.enum([
  'pending',
  'accepted',
  'acknowledged',
  'in_progress',
  'resolved',
  'declined',
  'timed_out',
  'cancelled',
  'superseded',
])

export const dispatchDocSchema = z
  .object({
    reportId: z.string().min(1),
    responderId: z.string().min(1),
    municipalityId: z.string().min(1),
    agencyId: z.string().min(1),
    dispatchedBy: z.string().min(1),
    dispatchedByRole: z.enum(['municipal_admin', 'agency_admin']),
    dispatchedAt: z.number().int(),
    status: dispatchStatusSchema,
    statusUpdatedAt: z.number().int(),
    acknowledgementDeadlineAt: z.number().int(),
    acknowledgedAt: z.number().int().optional(),
    inProgressAt: z.number().int().optional(),
    resolvedAt: z.number().int().optional(),
    cancelledAt: z.number().int().optional(),
    cancelledBy: z.string().optional(),
    cancelReason: z.string().optional(),
    timeoutReason: z.string().optional(),
    declineReason: z.string().optional(),
    resolutionSummary: z.string().optional(),
    proofPhotoUrl: z.string().url().optional(),
    requestedByMunicipalAdmin: z.boolean().optional(),
    requestId: z.string().optional(),
    idempotencyKey: z.string().min(1),
    idempotencyPayloadHash: z.string().length(64),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export type DispatchDoc = z.infer<typeof dispatchDocSchema>
```

- [ ] **Step 3: Implement the event stream schemas**

```ts
// packages/shared-validators/src/events.ts
import { z } from 'zod'
import { dispatchStatusSchema } from './dispatches.js'

const reportStatusSchema = z.enum([
  'draft_inbox',
  'new',
  'awaiting_verify',
  'verified',
  'assigned',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'closed',
  'reopened',
  'rejected',
  'cancelled',
  'cancelled_false_report',
  'merged_as_duplicate',
])

export const reportEventSchema = z
  .object({
    reportId: z.string().min(1),
    municipalityId: z.string().min(1),
    agencyId: z.string().optional(),
    actor: z.string().min(1),
    actorRole: z.enum([
      'citizen',
      'responder',
      'municipal_admin',
      'agency_admin',
      'provincial_superadmin',
      'system',
    ]),
    fromStatus: reportStatusSchema,
    toStatus: reportStatusSchema,
    reason: z.string().optional(),
    createdAt: z.number().int(),
    correlationId: z.string().min(1),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const dispatchEventSchema = z
  .object({
    dispatchId: z.string().min(1),
    reportId: z.string().min(1),
    actor: z.string().min(1),
    actorRole: z.enum([
      'responder',
      'municipal_admin',
      'agency_admin',
      'provincial_superadmin',
      'system',
    ]),
    fromStatus: dispatchStatusSchema,
    toStatus: dispatchStatusSchema,
    reason: z.string().optional(),
    createdAt: z.number().int(),
    correlationId: z.string().min(1),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export type ReportEvent = z.infer<typeof reportEventSchema>
export type DispatchEvent = z.infer<typeof dispatchEventSchema>
```

- [ ] **Step 4: Implement `agencies`, `responders`, and `users` schemas**

```ts
// packages/shared-validators/src/agencies.ts
import { z } from 'zod'

export const agencyDocSchema = z
  .object({
    agencyId: z.string().min(1),
    displayName: z.string().min(1),
    shortCode: z.enum(['BFP', 'PNP', 'PCG', 'RED_CROSS', 'DPWH', 'OTHER']),
    jurisdiction: z.enum(['provincial', 'municipal', 'national']),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    dispatchDefaults: z
      .object({
        timeoutHighMs: z.number().int().positive(),
        timeoutMediumMs: z.number().int().positive(),
        timeoutLowMs: z.number().int().positive(),
      })
      .strict()
      .optional(),
    schemaVersion: z.number().int().positive(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .strict()

export type AgencyDoc = z.infer<typeof agencyDocSchema>
```

```ts
// packages/shared-validators/src/responders.ts
import { z } from 'zod'

export const responderDocSchema = z
  .object({
    uid: z.string().min(1),
    agencyId: z.string().min(1),
    municipalityId: z.string().min(1),
    displayCode: z.string().min(1),
    specialisations: z.array(z.string()).default([]),
    availabilityStatus: z.enum(['on_duty', 'off_duty', 'on_break', 'unavailable']),
    lastTelemetryAt: z.number().int().optional(),
    schemaVersion: z.number().int().positive(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .strict()

export type ResponderDoc = z.infer<typeof responderDocSchema>
```

```ts
// packages/shared-validators/src/users.ts
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

export type UserDoc = z.infer<typeof userDocSchema>
```

- [ ] **Step 5: Extend the barrel export**

Append to `packages/shared-validators/src/index.ts`:

```ts
export { dispatchDocSchema, dispatchStatusSchema } from './dispatches.js'
export type { DispatchDoc } from './dispatches.js'
export { reportEventSchema, dispatchEventSchema } from './events.js'
export type { ReportEvent, DispatchEvent } from './events.js'
export { agencyDocSchema } from './agencies.js'
export type { AgencyDoc } from './agencies.js'
export { responderDocSchema } from './responders.js'
export type { ResponderDoc } from './responders.js'
export { userDocSchema } from './users.js'
export type { UserDoc } from './users.js'
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @bantayog/shared-validators test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared-validators
git commit -m "feat(shared-validators): add dispatch, event, agency, responder, user schemas"
```

---

## Task 4: SMS, Coordination, and Hazard Schemas

**Files:**

- Create: `packages/shared-validators/src/sms.ts`
- Create: `packages/shared-validators/src/coordination.ts`
- Create: `packages/shared-validators/src/hazard.ts`
- Create: `packages/shared-validators/src/incident-response.ts`
- Create: `packages/shared-validators/src/moderation.ts`
- Create: `packages/shared-validators/src/rate-limits.ts`
- Create: `packages/shared-validators/src/idempotency-keys.ts`
- Create: `packages/shared-validators/src/dead-letters.ts`
- Create: `packages/shared-validators/src/alerts-emergencies.ts`
- Create: `packages/shared-validators/src/shared-schemas.test.ts`
- Modify: `packages/shared-validators/src/index.ts`

- [ ] **Step 1: Write a combined test covering one representative case per new schema**

```ts
// packages/shared-validators/src/shared-schemas.test.ts
import { describe, expect, it } from 'vitest'
import {
  smsInboxDocSchema,
  smsOutboxDocSchema,
  smsSessionDocSchema,
  smsProviderHealthDocSchema,
} from './sms.js'
import {
  agencyAssistanceRequestDocSchema,
  commandChannelThreadDocSchema,
  commandChannelMessageDocSchema,
  massAlertRequestDocSchema,
  shiftHandoffDocSchema,
  breakglassEventDocSchema,
} from './coordination.js'
import { hazardZoneDocSchema, hazardZoneHistoryDocSchema, hazardSignalDocSchema } from './hazard.js'
import { incidentResponseEventSchema } from './incident-response.js'
import { moderationIncidentDocSchema } from './moderation.js'
import { rateLimitDocSchema } from './rate-limits.js'
import { idempotencyKeyDocSchema } from './idempotency-keys.js'
import { deadLetterDocSchema } from './dead-letters.js'
import { alertDocSchema, emergencyDocSchema } from './alerts-emergencies.js'

const ts = 1713350400000

describe('sms schemas', () => {
  it('rejects sms outbox without providerId', () => {
    expect(() =>
      smsOutboxDocSchema.parse({
        purpose: 'status_update',
        recipientMsisdnHash: 'a'.repeat(64),
        status: 'queued',
        createdAt: ts,
        schemaVersion: 1,
      }),
    ).toThrow()
  })

  it('accepts canonical inbound sms record', () => {
    expect(
      smsInboxDocSchema.parse({
        providerId: 'globelabs',
        receivedAt: ts,
        senderMsisdnHash: 'a'.repeat(64),
        body: 'BANTAYOG BAHA CALASGASAN',
        parseStatus: 'pending',
        schemaVersion: 1,
      }),
    ).toMatchObject({ providerId: 'globelabs' })
  })

  it('validates provider health enum', () => {
    expect(() =>
      smsProviderHealthDocSchema.parse({
        providerId: 'semaphore',
        circuitState: 'unstable', // invalid
        errorRatePct: 2,
        updatedAt: ts,
      }),
    ).toThrow()
  })
})

describe('coordination schemas', () => {
  it('agency assistance expiresAt must be > createdAt', () => {
    expect(() =>
      agencyAssistanceRequestDocSchema.parse({
        reportId: 'r',
        requestedByMunicipalId: 'a',
        requestedByMunicipality: 'daet',
        targetAgencyId: 'bfp',
        requestType: 'BFP',
        message: 'help',
        priority: 'urgent',
        status: 'pending',
        fulfilledByDispatchIds: [],
        createdAt: ts + 1000,
        expiresAt: ts,
      }),
    ).toThrow()
  })
})

describe('hazard schemas', () => {
  it('hazard zone requires polygonRef and bbox', () => {
    expect(() =>
      hazardZoneDocSchema.parse({
        zoneType: 'reference',
        hazardType: 'flood',
        scope: 'provincial',
        version: 1,
        createdAt: ts,
        updatedAt: ts,
        schemaVersion: 1,
      }),
    ).toThrow()
  })
})

describe('rate limit schema', () => {
  it('accepts a window counter', () => {
    expect(
      rateLimitDocSchema.parse({
        key: 'citizen:submit:u-1',
        windowStartAt: ts,
        windowEndAt: ts + 60000,
        count: 3,
        limit: 10,
        updatedAt: ts,
      }),
    ).toMatchObject({ count: 3 })
  })
})

describe('idempotency key schema', () => {
  it('requires 64-char hex hash', () => {
    expect(() =>
      idempotencyKeyDocSchema.parse({
        key: 'k',
        payloadHash: 'short',
        firstSeenAt: ts,
      }),
    ).toThrow()
  })
})

describe('dead letter schema', () => {
  it('accepts a failed inbox item', () => {
    expect(
      deadLetterDocSchema.parse({
        source: 'processInboxItem',
        originalDocRef: 'report_inbox/abc',
        failureReason: 'validation_error',
        payload: { x: 1 },
        attempts: 3,
        firstSeenAt: ts,
        lastSeenAt: ts,
      }),
    ).toMatchObject({ attempts: 3 })
  })
})

describe('alerts/emergencies schemas', () => {
  it('alert requires targetMunicipalityIds array', () => {
    expect(() =>
      alertDocSchema.parse({
        title: 'x',
        body: 'y',
        severity: 'high',
        sentAt: ts,
        publishedBy: 'super-1',
      }),
    ).toThrow()
  })
})

describe('incident response schema', () => {
  it('accepts declaration event', () => {
    expect(
      incidentResponseEventSchema.parse({
        incidentId: 'i-1',
        phase: 'declared',
        actor: 'super-1',
        discoveredAt: ts,
        notes: 'privileged-read anomaly',
        createdAt: ts,
        correlationId: 'c-1',
      }),
    ).toMatchObject({ phase: 'declared' })
  })
})

describe('moderation schema', () => {
  it('rejects unknown source literal', () => {
    expect(() =>
      moderationIncidentDocSchema.parse({
        reason: 'duplicate_spam',
        source: 'email', // invalid
        createdAt: ts,
      }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Implement the SMS schemas**

```ts
// packages/shared-validators/src/sms.ts
import { z } from 'zod'

export const smsProviderIdSchema = z.enum(['semaphore', 'globelabs'])

export const smsInboxDocSchema = z
  .object({
    providerId: smsProviderIdSchema,
    receivedAt: z.number().int(),
    senderMsisdnHash: z.string().length(64),
    body: z.string().max(1600),
    parseStatus: z.enum(['pending', 'parsed', 'low_confidence', 'unparseable']),
    parsedIntoInboxId: z.string().optional(),
    confidenceScore: z.number().min(0).max(1).optional(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const smsOutboxDocSchema = z
  .object({
    providerId: smsProviderIdSchema,
    recipientMsisdnHash: z.string().length(64),
    purpose: z.enum([
      'receipt_ack',
      'status_update',
      'verification',
      'resolution',
      'mass_alert',
      'emergency_declaration',
    ]),
    encoding: z.enum(['GSM-7', 'UCS-2']),
    segmentCount: z.number().int().positive(),
    bodyPreviewHash: z.string().length(64),
    status: z.enum(['queued', 'sent', 'delivered', 'failed', 'undelivered', 'abandoned']),
    statusReason: z.string().optional(),
    providerMessageId: z.string().optional(),
    reportId: z.string().optional(),
    idempotencyKey: z.string().min(1),
    createdAt: z.number().int(),
    sentAt: z.number().int().optional(),
    deliveredAt: z.number().int().optional(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const smsSessionDocSchema = z
  .object({
    msisdnHash: z.string().length(64),
    lastReceivedAt: z.number().int(),
    rateLimitCount: z.number().int().nonnegative(),
    trackingPinHash: z.string().length(64).optional(),
    trackingPinExpiresAt: z.number().int().optional(),
    flaggedForModeration: z.boolean().default(false),
    updatedAt: z.number().int(),
  })
  .strict()

export const smsProviderHealthDocSchema = z
  .object({
    providerId: smsProviderIdSchema,
    circuitState: z.enum(['closed', 'open', 'half_open']),
    errorRatePct: z.number().min(0).max(100),
    lastErrorAt: z.number().int().optional(),
    updatedAt: z.number().int(),
  })
  .strict()

export type SmsInboxDoc = z.infer<typeof smsInboxDocSchema>
export type SmsOutboxDoc = z.infer<typeof smsOutboxDocSchema>
export type SmsSessionDoc = z.infer<typeof smsSessionDocSchema>
export type SmsProviderHealthDoc = z.infer<typeof smsProviderHealthDocSchema>
```

- [ ] **Step 3: Implement coordination schemas**

```ts
// packages/shared-validators/src/coordination.ts
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
    expiresAt: z.number().int(),
  })
  .strict()
  .refine((d) => d.expiresAt > d.createdAt, {
    message: 'expiresAt must be after createdAt',
  })

export const commandChannelThreadDocSchema = z
  .object({
    threadId: z.string().min(1),
    reportId: z.string().optional(),
    subject: z.string().max(200),
    participantUids: z.record(z.literal(true)),
    createdBy: z.string().min(1),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
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
      'submitted_to_pdrrmo',
      'forwarded_to_ndrrmc',
      'acknowledged_by_ndrrmc',
      'cancelled',
    ]),
    createdAt: z.number().int(),
    forwardedAt: z.number().int().optional(),
    acknowledgedAt: z.number().int().optional(),
    cancelledAt: z.number().int().optional(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const shiftHandoffDocSchema = z
  .object({
    fromUid: z.string().min(1),
    toUid: z.string().min(1),
    municipalityId: z.string().min(1),
    activeIncidentSnapshot: z.array(z.string()),
    notes: z.string().max(2000),
    status: z.enum(['pending', 'accepted', 'expired']),
    createdAt: z.number().int(),
    acceptedAt: z.number().int().optional(),
    expiresAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

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

export type AgencyAssistanceRequestDoc = z.infer<typeof agencyAssistanceRequestDocSchema>
export type CommandChannelThreadDoc = z.infer<typeof commandChannelThreadDocSchema>
export type CommandChannelMessageDoc = z.infer<typeof commandChannelMessageDocSchema>
export type MassAlertRequestDoc = z.infer<typeof massAlertRequestDocSchema>
export type ShiftHandoffDoc = z.infer<typeof shiftHandoffDocSchema>
export type BreakglassEventDoc = z.infer<typeof breakglassEventDocSchema>
```

- [ ] **Step 4: Implement hazard schemas**

```ts
// packages/shared-validators/src/hazard.ts
import { z } from 'zod'

const bbox = z
  .object({
    minLat: z.number(),
    minLng: z.number(),
    maxLat: z.number(),
    maxLng: z.number(),
  })
  .strict()

const hazardTypeSchema = z.enum(['flood', 'landslide', 'storm_surge'])

export const hazardZoneDocSchema = z
  .object({
    zoneType: z.enum(['reference', 'custom']),
    hazardType: hazardTypeSchema,
    hazardSeverity: z.enum(['low', 'medium', 'high']).optional(),
    scope: z.enum(['provincial', 'municipality']),
    municipalityId: z.string().optional(),
    displayName: z.string().max(200),
    polygonRef: z.string().min(1),
    bbox,
    geohashPrefix: z.string().length(6),
    vertexCount: z.number().int().positive(),
    version: z.number().int().positive(),
    supersededBy: z.string().optional(),
    supersededAt: z.number().int().optional(),
    expiresAt: z.number().int().optional(),
    expiredAt: z.number().int().optional(),
    deletedAt: z.number().int().optional(),
    createdBy: z.string().min(1),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const hazardZoneHistoryDocSchema = hazardZoneDocSchema.extend({
  historyVersion: z.number().int().positive(),
})

export const hazardSignalDocSchema = z
  .object({
    source: z.enum(['pagasa_webhook', 'pagasa_scraper', 'manual_superadmin']),
    signalLevel: z.number().int().min(0).max(5),
    affectedMunicipalityIds: z.array(z.string()),
    createdAt: z.number().int(),
    expiresAt: z.number().int().optional(),
    createdBy: z.string().optional(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export type HazardZoneDoc = z.infer<typeof hazardZoneDocSchema>
export type HazardZoneHistoryDoc = z.infer<typeof hazardZoneHistoryDocSchema>
export type HazardSignalDoc = z.infer<typeof hazardSignalDocSchema>
```

- [ ] **Step 5: Implement the small utility schemas (incident-response, moderation, rate-limits, idempotency-keys, dead-letters, alerts/emergencies)**

```ts
// packages/shared-validators/src/incident-response.ts
import { z } from 'zod'

export const incidentResponseEventSchema = z
  .object({
    incidentId: z.string().min(1),
    phase: z.enum([
      'declared',
      'contained',
      'preserved',
      'assessed',
      'notified_npc',
      'notified_subjects',
      'post_report',
      'closed',
    ]),
    actor: z.string().min(1),
    discoveredAt: z.number().int().optional(),
    notes: z.string().max(4000).optional(),
    createdAt: z.number().int(),
    correlationId: z.string().min(1),
  })
  .strict()

export type IncidentResponseEvent = z.infer<typeof incidentResponseEventSchema>
```

```ts
// packages/shared-validators/src/moderation.ts
import { z } from 'zod'

export const moderationIncidentDocSchema = z
  .object({
    reportInboxId: z.string().optional(),
    reason: z.enum([
      'invalid_payload',
      'duplicate_spam',
      'abuse_language',
      'rate_limit_exceeded',
      'low_confidence_sms',
      'app_check_failed',
    ]),
    source: z.enum(['web', 'sms', 'responder_witness']),
    flaggedBy: z.enum(['system', 'ingest_trigger', 'sms_parser']),
    details: z.record(z.unknown()).optional(),
    reviewedBy: z.string().optional(),
    reviewedAt: z.number().int().optional(),
    disposition: z.enum(['pending', 'dismissed', 'converted_to_report']).default('pending'),
    createdAt: z.number().int(),
  })
  .strict()

export type ModerationIncidentDoc = z.infer<typeof moderationIncidentDocSchema>
```

```ts
// packages/shared-validators/src/rate-limits.ts
import { z } from 'zod'

export const rateLimitDocSchema = z
  .object({
    key: z.string().min(1),
    windowStartAt: z.number().int(),
    windowEndAt: z.number().int(),
    count: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    updatedAt: z.number().int(),
  })
  .strict()

export type RateLimitDoc = z.infer<typeof rateLimitDocSchema>
```

```ts
// packages/shared-validators/src/idempotency-keys.ts
import { z } from 'zod'

export const idempotencyKeyDocSchema = z
  .object({
    key: z.string().min(1),
    payloadHash: z.string().length(64),
    firstSeenAt: z.number().int(),
    expiresAt: z.number().int().optional(),
    resultRef: z.string().optional(),
    resultPayload: z.record(z.unknown()).optional(),
  })
  .strict()

export type IdempotencyKeyDoc = z.infer<typeof idempotencyKeyDocSchema>
```

```ts
// packages/shared-validators/src/dead-letters.ts
import { z } from 'zod'

export const deadLetterDocSchema = z
  .object({
    source: z.string().min(1),
    originalDocRef: z.string().min(1),
    failureReason: z.string().min(1),
    failureStack: z.string().optional(),
    payload: z.record(z.unknown()),
    attempts: z.number().int().positive(),
    firstSeenAt: z.number().int(),
    lastSeenAt: z.number().int(),
    resolvedAt: z.number().int().optional(),
    resolvedBy: z.string().optional(),
  })
  .strict()

export type DeadLetterDoc = z.infer<typeof deadLetterDocSchema>
```

```ts
// packages/shared-validators/src/alerts-emergencies.ts
import { z } from 'zod'

export const alertDocSchema = z
  .object({
    title: z.string().min(1).max(200),
    body: z.string().max(2000),
    severity: z.enum(['low', 'medium', 'high']),
    publishedAt: z.number().int(),
    publishedBy: z.string().min(1),
    sentAt: z.number().int().optional(),
    targetMunicipalityIds: z.array(z.string()).min(1),
    visibility: z.enum(['public', 'internal']).default('public'),
    schemaVersion: z.number().int().positive().default(1),
  })
  .strict()

export const emergencyDocSchema = z
  .object({
    declaredBy: z.string().min(1),
    declaredAt: z.number().int(),
    title: z.string().min(1).max(200),
    body: z.string().max(2000),
    affectedMunicipalityIds: z.array(z.string()).min(1),
    clearsAt: z.number().int().optional(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export type AlertDoc = z.infer<typeof alertDocSchema>
export type EmergencyDoc = z.infer<typeof emergencyDocSchema>
```

- [ ] **Step 6: Append all new exports to the barrel**

Append to `packages/shared-validators/src/index.ts`:

```ts
export {
  smsInboxDocSchema,
  smsOutboxDocSchema,
  smsSessionDocSchema,
  smsProviderHealthDocSchema,
  smsProviderIdSchema,
} from './sms.js'
export type { SmsInboxDoc, SmsOutboxDoc, SmsSessionDoc, SmsProviderHealthDoc } from './sms.js'
export {
  agencyAssistanceRequestDocSchema,
  commandChannelThreadDocSchema,
  commandChannelMessageDocSchema,
  massAlertRequestDocSchema,
  shiftHandoffDocSchema,
  breakglassEventDocSchema,
} from './coordination.js'
export type {
  AgencyAssistanceRequestDoc,
  CommandChannelThreadDoc,
  CommandChannelMessageDoc,
  MassAlertRequestDoc,
  ShiftHandoffDoc,
  BreakglassEventDoc,
} from './coordination.js'
export { hazardZoneDocSchema, hazardZoneHistoryDocSchema, hazardSignalDocSchema } from './hazard.js'
export type { HazardZoneDoc, HazardZoneHistoryDoc, HazardSignalDoc } from './hazard.js'
export { incidentResponseEventSchema } from './incident-response.js'
export type { IncidentResponseEvent } from './incident-response.js'
export { moderationIncidentDocSchema } from './moderation.js'
export type { ModerationIncidentDoc } from './moderation.js'
export { rateLimitDocSchema } from './rate-limits.js'
export type { RateLimitDoc } from './rate-limits.js'
export { idempotencyKeyDocSchema } from './idempotency-keys.js'
export type { IdempotencyKeyDoc } from './idempotency-keys.js'
export { deadLetterDocSchema } from './dead-letters.js'
export type { DeadLetterDoc } from './dead-letters.js'
export { alertDocSchema, emergencyDocSchema } from './alerts-emergencies.js'
export type { AlertDoc, EmergencyDoc } from './alerts-emergencies.js'
```

- [ ] **Step 7: Run tests and typecheck**

Run: `pnpm --filter @bantayog/shared-validators test`
Expected: PASS.

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/shared-validators
git commit -m "feat(shared-validators): add sms, coordination, hazard, and utility schemas"
```

---

## Task 5: Rule-Test Harness and Seed Factories

**Context:** Phase 1 put a single rule-test file at `functions/src/__tests__/firestore.rules.test.ts` with inline seeding. Phase 2 will add 10+ rule test files; duplicating seed code is going to drift. Extract a typed harness and seed-factory module so every new rule test starts from the same pristine state.

**Files:**

- Create: `functions/src/__tests__/helpers/rules-harness.ts`
- Create: `functions/src/__tests__/helpers/seed-factories.ts`
- Modify: `functions/package.json`
- Modify: `firebase.json`

- [ ] **Step 1: Add the rules-harness module**

```ts
// functions/src/__tests__/helpers/rules-harness.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'

const FIRESTORE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/firestore.rules')
const RTDB_RULES_PATH = resolve(process.cwd(), '../infra/firebase/database.rules.json')
const STORAGE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/storage.rules')

export async function createTestEnv(projectId: string): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8'),
    },
    database: {
      rules: readFileSync(RTDB_RULES_PATH, 'utf8'),
    },
    storage: {
      rules: readFileSync(STORAGE_RULES_PATH, 'utf8'),
    },
  })
}

export function authed(env: RulesTestEnvironment, uid: string, claims: Record<string, unknown>) {
  return env.authenticatedContext(uid, claims).firestore()
}

export function unauthed(env: RulesTestEnvironment) {
  return env.unauthenticatedContext().firestore()
}
```

- [ ] **Step 2: Add the seed-factory module**

```ts
// functions/src/__tests__/helpers/seed-factories.ts
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'

export const ts = 1713350400000

export async function seedActiveAccount(
  env: RulesTestEnvironment,
  opts: {
    uid: string
    role: 'citizen' | 'responder' | 'municipal_admin' | 'agency_admin' | 'provincial_superadmin'
    municipalityId?: string
    agencyId?: string
    permittedMunicipalityIds?: string[]
    accountStatus?: 'active' | 'suspended' | 'disabled'
  },
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'active_accounts', opts.uid), {
      uid: opts.uid,
      role: opts.role,
      accountStatus: opts.accountStatus ?? 'active',
      municipalityId: opts.municipalityId ?? null,
      agencyId: opts.agencyId ?? null,
      permittedMunicipalityIds: opts.permittedMunicipalityIds ?? [],
      mfaEnrolled: true,
      lastClaimIssuedAt: ts,
      updatedAt: ts,
    })
  })
}

export function staffClaims(opts: {
  role: 'municipal_admin' | 'agency_admin' | 'provincial_superadmin' | 'responder' | 'citizen'
  municipalityId?: string
  agencyId?: string
  permittedMunicipalityIds?: string[]
  accountStatus?: 'active' | 'suspended'
}): Record<string, unknown> {
  return {
    role: opts.role,
    accountStatus: opts.accountStatus ?? 'active',
    municipalityId: opts.municipalityId ?? null,
    agencyId: opts.agencyId ?? null,
    permittedMunicipalityIds: opts.permittedMunicipalityIds ?? [],
  }
}

export async function seedReport(
  env: RulesTestEnvironment,
  reportId: string,
  overrides: Partial<Record<string, unknown>> = {},
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'reports', reportId), {
      municipalityId: 'daet',
      reporterRole: 'citizen',
      reportType: 'flood',
      severity: 'high',
      status: 'verified',
      mediaRefs: [],
      description: 'seeded',
      submittedAt: ts,
      retentionExempt: false,
      visibilityClass: 'internal',
      visibility: { scope: 'municipality', sharedWith: [] },
      source: 'web',
      hasPhotoAndGPS: false,
      schemaVersion: 1,
      ...overrides,
    })
    await setDoc(doc(db, 'report_ops', reportId), {
      municipalityId: 'daet',
      status: 'verified',
      severity: 'high',
      createdAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      updatedAt: ts,
      schemaVersion: 1,
      ...(overrides.opsOverrides as Record<string, unknown> | undefined),
    })
    await setDoc(doc(db, 'report_private', reportId), {
      municipalityId: 'daet',
      reporterUid: 'citizen-1',
      isPseudonymous: true,
      publicTrackingRef: 'ref-12345',
      createdAt: ts,
      schemaVersion: 1,
    })
  })
}
```

- [ ] **Step 3: Wire RTDB and Storage emulators into `firebase.json`**

Open `firebase.json`. If the `emulators` block lacks entries for `database` and `storage`, add them. Resulting block example:

```json
{
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "database": { "port": 9000 },
    "storage": { "port": 9199 },
    "functions": { "port": 5001 },
    "ui": { "enabled": true }
  }
}
```

- [ ] **Step 4: Update `functions/package.json` test scripts to split rules into per-domain targets**

Replace the `test:rules` script and add granular scripts:

```json
{
  "scripts": {
    "test:rules": "vitest run 'src/__tests__/rules/**/*.rules.test.ts' 'src/__tests__/rtdb.rules.test.ts' 'src/__tests__/storage.rules.test.ts'",
    "test:rules:firestore": "vitest run 'src/__tests__/rules/**/*.rules.test.ts'",
    "test:rules:rtdb": "vitest run 'src/__tests__/rtdb.rules.test.ts'",
    "test:rules:storage": "vitest run 'src/__tests__/storage.rules.test.ts'",
    "test:rules:coverage": "tsx ../scripts/check-rule-coverage.ts"
  }
}
```

Keep `test:unit` and `test` scripts intact.

- [ ] **Step 5: Commit**

```bash
git add functions/src/__tests__/helpers functions/package.json firebase.json
git commit -m "chore(functions): extract shared rule-test harness and seed factories"
```

---

## Task 6: Full Firestore Rules — Helper Block + Report Inbox + Triptych

**Context:** This task replaces the Phase 1 default-deny with the full §5.7 rule surface for the citizen inbox and the triptych (`report_inbox`, `reports`, `reports/{id}/status_log`, `.../media`, `.../messages`, `.../field_notes`, `report_private`, `report_ops`, `report_sharing`, `report_contacts`, `report_lookup`). Rules are copied verbatim from spec §5.7 with no modifications. Tests land in the same commit.

**Files:**

- Modify: `infra/firebase/firestore.rules`
- Create: `functions/src/__tests__/rules/report-inbox.rules.test.ts`
- Create: `functions/src/__tests__/rules/reports.rules.test.ts`
- Create: `functions/src/__tests__/rules/report-private.rules.test.ts`
- Create: `functions/src/__tests__/rules/report-ops.rules.test.ts`
- Create: `functions/src/__tests__/rules/report-sharing.rules.test.ts`
- Create: `functions/src/__tests__/rules/report-contacts.rules.test.ts`
- Create: `functions/src/__tests__/rules/report-lookup.rules.test.ts`

- [ ] **Step 1: Extend the helpers in `infra/firebase/firestore.rules`**

Replace the helper section (lines 14–39 from Phase 1) with the full §5.7 helper block. Add `isCitizen`, `isResponder`, `isMuniAdmin`, `isAgencyAdmin`, `myMunicipality`, `myAgency`, `adminOf`, `canReadReportDoc`, `validResponderTransition` per spec lines 612–656. Keep `isActivePrivileged` as-is (already matches spec).

Exact helper block to insert:

```javascript
    function isAuthed() {
      return request.auth != null
          && request.auth.token.accountStatus == 'active';
    }
    function role()           { return request.auth.token.role; }
    function uid()            { return request.auth.uid; }
    function myMunicipality() { return request.auth.token.municipalityId; }
    function myAgency()       { return request.auth.token.agencyId; }
    function permittedMunis() {
      return request.auth.token.permittedMunicipalityIds != null
        ? request.auth.token.permittedMunicipalityIds : [];
    }
    function isCitizen()    { return isAuthed() && role() == 'citizen'; }
    function isResponder()  { return isAuthed() && role() == 'responder'; }
    function isMuniAdmin()  { return isAuthed() && role() == 'municipal_admin'; }
    function isAgencyAdmin(){ return isAuthed() && role() == 'agency_admin'; }
    function isSuperadmin() { return isAuthed() && role() == 'provincial_superadmin'; }
    function isActivePrivileged() {
      return exists(/databases/$(database)/documents/active_accounts/$(uid()))
          && get(/databases/$(database)/documents/active_accounts/$(uid()))
             .data.accountStatus == 'active';
    }
    function adminOf(muniId) {
      return (isMuniAdmin() && myMunicipality() == muniId)
          || (isSuperadmin() && muniId in permittedMunis());
    }
    function canReadReportDoc(data) {
      return (data.visibilityClass == 'public_alertable' && isAuthed())
          || adminOf(data.municipalityId);
    }
    function validResponderTransition(from, to) {
      return (from == 'accepted'     && to == 'acknowledged')
          || (from == 'acknowledged' && to == 'in_progress')
          || (from == 'in_progress'  && to == 'resolved')
          || (from == 'pending'      && to == 'declined');
    }
```

Note on `canReadReportDoc`: spec §5.7 shows a cross-municipality sharing branch that references `data.__reportId`. Firestore rules do not expose a synthetic `__reportId` on `resource.data`, so we implement the sharing branch at each collection's `match` block via explicit `reportId` in the path, not via the helper. The helper stays narrow to avoid false positives.

- [ ] **Step 2: Insert the report-inbox and triptych match blocks**

Between the helpers and the default-deny `match /{document=**}` trailer, insert the rule blocks verbatim from spec §5.7 for:

- `match /report_inbox/{inboxId}` — spec lines 659–667
- `match /reports/{reportId}` — spec lines 670–706 (including nested `match /status_log/{e}`, `match /media/{m}`, `match /messages/{m}`, `match /field_notes/{n}`)
- `match /report_private/{r}` — lines 708–711
- `match /report_ops/{r}` — lines 713–719
- `match /report_sharing/{r}` — lines 721–728 (remove the `isMuniAdmin() && myMunicipality() in resource.data.sharedWith` branch from `canReadReportDoc`; it lives here instead)
- `match /report_contacts/{r}` — lines 730–733
- `match /report_lookup/{publicRef}` — lines 735–737

Copy-paste verbatim. The nested `get()` lookups in `messages` and `field_notes` match spec exactly.

- [ ] **Step 3: Write the `report_inbox` rule tests**

```ts
// functions/src/__tests__/rules/report-inbox.rules.test.ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { addDoc, collection, setDoc, doc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-2-inbox')
  await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' })
  await seedActiveAccount(env, {
    uid: 'resp-1',
    role: 'responder',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('report_inbox rules', () => {
  it('allows an authed citizen to create their own inbox entry', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertSucceeds(
      addDoc(collection(db, 'report_inbox'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: ts,
        idempotencyKey: 'k1',
        payload: { reportType: 'flood', description: 'x', source: 'web' },
      }),
    )
  })

  it('rejects inbox writes where reporterUid does not match the caller', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(
      addDoc(collection(db, 'report_inbox'), {
        reporterUid: 'citizen-2',
        clientCreatedAt: ts,
        idempotencyKey: 'k2',
        payload: { reportType: 'flood', description: 'x' },
      }),
    )
  })

  it('rejects inbox writes missing required keys', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(
      addDoc(collection(db, 'report_inbox'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: ts,
        payload: { reportType: 'flood' }, // missing idempotencyKey
      }),
    )
  })

  it('rejects responder-witness inbox submissions (callable-only path)', async () => {
    const db = authed(env, 'resp-1', staffClaims({ role: 'responder' }))
    await assertFails(
      addDoc(collection(db, 'report_inbox'), {
        reporterUid: 'resp-1',
        clientCreatedAt: ts,
        idempotencyKey: 'k3',
        payload: { reportType: 'flood', source: 'responder_witness', description: 'x' },
      }),
    )
  })

  it('rejects unauthenticated writes', async () => {
    const db = unauthed(env)
    await assertFails(
      addDoc(collection(db, 'report_inbox'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: ts,
        idempotencyKey: 'k4',
        payload: { reportType: 'flood', description: 'x' },
      }),
    )
  })

  it('rejects reads from any role including the creator', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'inbox-1'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: ts,
        idempotencyKey: 'k',
        payload: {},
      })
    })
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    const { getDoc, doc: firestoreDoc } = await import('firebase/firestore')
    await assertFails(getDoc(firestoreDoc(db, 'report_inbox/inbox-1')))
  })
})
```

- [ ] **Step 4: Write the `reports` rule tests**

```ts
// functions/src/__tests__/rules/reports.rules.test.ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, seedReport, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-2-reports')
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'mercedes-admin',
    role: 'municipal_admin',
    municipalityId: 'mercedes',
  })
  await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' })
  await seedReport(env, 'r-public', { visibilityClass: 'public_alertable' })
  await seedReport(env, 'r-internal', { visibilityClass: 'internal' })
})

afterAll(async () => {
  await env.cleanup()
})

describe('reports rules', () => {
  it('any authed user reads a public_alertable report', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertSucceeds(getDoc(doc(db, 'reports/r-public')))
  })

  it('non-municipality admin cannot read an internal report', async () => {
    const db = authed(
      env,
      'mercedes-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
    )
    await assertFails(getDoc(doc(db, 'reports/r-internal')))
  })

  it('municipality admin reads their own internal report', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'reports/r-internal')))
  })

  it('municipality admin may update mutable fields', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'reports/r-internal'), { status: 'assigned', updatedAt: ts }),
    )
  })

  it('municipality admin cannot mutate immutable fields like municipalityId', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(updateDoc(doc(db, 'reports/r-internal'), { municipalityId: 'mercedes' }))
  })

  it('client create/delete is always denied', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    const { setDoc, deleteDoc } = await import('firebase/firestore')
    await assertFails(setDoc(doc(db, 'reports/new-r'), { municipalityId: 'daet' }))
    await assertFails(deleteDoc(doc(db, 'reports/r-internal')))
  })
})
```

- [ ] **Step 5: Write the remaining triptych rule tests**

Create `report-private.rules.test.ts`, `report-ops.rules.test.ts`, `report-sharing.rules.test.ts`, `report-contacts.rules.test.ts`, `report-lookup.rules.test.ts` using the same harness pattern. Each file must cover the following cases (checklist — every item maps to a distinct `it(...)` call):

- **`report_private`:**
  - [x] daet-admin reads own-muni private doc (positive)
  - [x] mercedes-admin reading daet-muni private doc fails (cross-muni leak negative)
  - [x] citizen reading their own report_private fails (admin-only rule)
  - [x] suspended daet-admin fails (`active_accounts.accountStatus != 'active'`)
  - [x] any client write fails (callable-only)
  - [x] unauthed read fails

- **`report_ops`:**
  - [x] daet-admin reads own-muni ops (positive)
  - [x] agency admin whose `myAgency() in resource.data.agencyIds` reads ops (positive)
  - [x] agency admin not in `agencyIds` fails (negative)
  - [x] mercedes-admin fails (cross-muni negative)
  - [x] responder fails (no role path granted)
  - [x] any client write fails

- **`report_sharing`:**
  - [x] owner municipality admin reads (positive)
  - [x] recipient municipality admin whose `myMunicipality() in sharedWith` reads (positive)
  - [x] non-recipient admin fails (negative)
  - [x] superadmin reads (positive)
  - [x] any client write fails

- **`report_contacts`:**
  - [x] daet-admin reads own-muni (positive)
  - [x] mercedes-admin fails (negative)
  - [x] responder fails
  - [x] any client write fails

- **`report_lookup`:**
  - [x] any client read fails
  - [x] any client write fails
  - [x] unauthed read fails
  - [x] unauthed write fails

Use the exact `describe`/`it` structure from Step 4. Each test file should seed only what it needs via `env.withSecurityRulesDisabled`.

- [ ] **Step 6: Add tests for `reports/{reportId}/{subcollection}` (status_log, media, messages, field_notes)**

Append to `reports.rules.test.ts`:

```ts
describe('reports/{id}/messages rules', () => {
  it('admin-of-muni reads messages', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { setDoc, doc: d } = await import('firebase/firestore')
      await setDoc(d(ctx.firestore(), 'reports/r-internal/messages/m1'), {
        body: 'x',
        authorUid: 'daet-admin',
        createdAt: ts,
      })
    })
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'reports/r-internal/messages/m1')))
  })

  it('responder with an existing dispatch for the report reads messages', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { setDoc, doc: d } = await import('firebase/firestore')
      await setDoc(d(ctx.firestore(), 'dispatches/r-internal_resp-msg-1'), {
        reportId: 'r-internal',
        responderId: 'resp-msg-1',
        municipalityId: 'daet',
        agencyId: 'bfp',
        status: 'accepted',
      })
    })
    await seedActiveAccount(env, {
      uid: 'resp-msg-1',
      role: 'responder',
      agencyId: 'bfp',
      municipalityId: 'daet',
    })
    const db = authed(
      env,
      'resp-msg-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'reports/r-internal/messages/m1')))
  })

  it('responder without a dispatch for the report fails', async () => {
    await seedActiveAccount(env, {
      uid: 'resp-none-1',
      role: 'responder',
      agencyId: 'bfp',
      municipalityId: 'daet',
    })
    const db = authed(
      env,
      'resp-none-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(getDoc(doc(db, 'reports/r-internal/messages/m1')))
  })

  it('any client write fails (callable-only)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    const { setDoc, doc: d } = await import('firebase/firestore')
    await assertFails(
      setDoc(d(db, 'reports/r-internal/messages/new'), { body: 'x', createdAt: ts }),
    )
  })
})
```

Repeat the same pattern for `status_log`, `media`, and `field_notes`. `status_log` and `media` use `canReadReportDoc(get(...).data)`; `field_notes` uses the same multi-role check as `messages`.

- [ ] **Step 7: Run the rules test suite against the emulator**

Run: `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test:rules:firestore"`
Expected: PASS for every test in this task.

- [ ] **Step 8: Commit**

```bash
git add infra/firebase/firestore.rules functions/src/__tests__/rules
git commit -m "feat(rules): enforce inbox + triptych rules with positive/negative coverage"
```

---

## Task 7: Firestore Rules — Dispatches, Users, Responders

**Files:**

- Modify: `infra/firebase/firestore.rules`
- Create: `functions/src/__tests__/rules/dispatches.rules.test.ts`
- Create: `functions/src/__tests__/rules/users-responders.rules.test.ts`

- [ ] **Step 1: Append the `dispatches`, `responders`, and `users` match blocks**

Paste verbatim from spec §5.7 lines 740–781 into `firestore.rules`, immediately after the `report_lookup` block. These blocks contain the `validResponderTransition` rule enforcement.

- [ ] **Step 2: Write `dispatches.rules.test.ts`**

Required tests (one `it` per case):

- [x] responder who owns the dispatch reads it (positive)
- [x] responder from a different agency reading the dispatch fails
- [x] admin-of-muni reads the dispatch (positive)
- [x] agency admin whose `myAgency() == agencyId` reads (positive)
- [x] other agency admin fails
- [x] responder updates dispatch `pending → declined` (positive)
- [x] responder updates `pending → in_progress` (negative — not a valid responder direct transition)
- [x] responder updates `accepted → acknowledged` (positive)
- [x] responder mutating fields outside `affectedKeys().hasOnly(...)` fails (e.g., changing `responderId`)
- [x] responder writing on another responder's dispatch fails
- [x] suspended responder fails (`active_accounts` not active)
- [x] client create/delete always fails

Sample test:

```ts
// functions/src/__tests__/rules/dispatches.rules.test.ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-2-dispatches')
  await seedActiveAccount(env, {
    uid: 'resp-1',
    role: 'responder',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'resp-2',
    role: 'responder',
    agencyId: 'red-cross',
    municipalityId: 'daet',
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'dispatches/d-1'), {
      reportId: 'r-1',
      responderId: 'resp-1',
      municipalityId: 'daet',
      agencyId: 'bfp',
      dispatchedBy: 'admin-1',
      dispatchedByRole: 'municipal_admin',
      dispatchedAt: ts,
      status: 'pending',
      statusUpdatedAt: ts,
      acknowledgementDeadlineAt: ts + 180000,
      idempotencyKey: 'k',
      idempotencyPayloadHash: 'a'.repeat(64),
      schemaVersion: 1,
    })
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('dispatches rules', () => {
  it('responder declines their own pending dispatch', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'dispatches/d-1'), {
        status: 'declined',
        statusUpdatedAt: ts + 1,
        declineReason: 'unavailable',
      }),
    )
  })

  it('responder cannot pending → in_progress (skipping accepted)', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(
      updateDoc(doc(db, 'dispatches/d-1'), { status: 'in_progress', statusUpdatedAt: ts + 1 }),
    )
  })

  // Remaining cases from the checklist implemented identically.
})
```

- [ ] **Step 3: Write `users-responders.rules.test.ts`**

Required tests:

- [x] `responders/{uid}` self-read succeeds
- [x] agency admin reads own-agency responder
- [x] muni admin reads own-muni responder
- [x] other-agency admin read fails
- [x] responder updates own `availabilityStatus` (positive)
- [x] responder attempts to change `agencyId` (negative — not in `hasOnly`)
- [x] user self-read succeeds
- [x] muni admin reads own-muni user
- [x] user updates own `displayName` (positive)
- [x] user attempts to change own `role` (negative)
- [x] client create/delete always fails for both `responders` and `users`

- [ ] **Step 4: Run the rules test suite**

Run: `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test:rules:firestore"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add infra/firebase/firestore.rules functions/src/__tests__/rules/dispatches.rules.test.ts functions/src/__tests__/rules/users-responders.rules.test.ts
git commit -m "feat(rules): add dispatches + responders + users rules with coverage"
```

---

## Task 8: Firestore Rules — Public, Audit, and Event Collections

**Context:** These are the "narrow fixed-shape" rules: alerts, emergencies, agencies, system_config, audit_logs, rate_limits, dead_letters, hazard_signals, moderation_incidents, report_events, dispatch_events, breakglass_events, incident_response_events.

**Files:**

- Modify: `infra/firebase/firestore.rules`
- Create: `functions/src/__tests__/rules/public-collections.rules.test.ts`
- Create: `functions/src/__tests__/rules/report-events.rules.test.ts`

- [ ] **Step 1: Append the public-collection match blocks**

Paste verbatim from spec §5.7 lines 795–806, 824–828, 830–836, 881–885 (also add a `dispatch_events` block mirroring `report_events`, scoped by actor role the same way). Exact additions:

```javascript
    match /alerts/{a}        { allow read: if isAuthed(); allow write: if false; }
    match /emergencies/{e}   { allow read: if isAuthed(); allow write: if false; }
    match /agencies/{a}      { allow read: if isAuthed(); allow write: if isSuperadmin() && isActivePrivileged(); }
    match /system_config/{c} { allow read: if isAuthed(); allow write: if isSuperadmin() && isActivePrivileged(); }
    match /audit_logs/{l}    { allow read: if isSuperadmin() && isActivePrivileged(); allow write: if false; }
    match /rate_limits/{r}   { allow read, write: if false; }
    match /dead_letters/{d}  { allow read: if isSuperadmin() && isActivePrivileged(); allow write: if false; }
    match /hazard_signals/{s} { allow read: if isAuthed(); allow write: if false; }
    match /moderation_incidents/{m} {
      allow read: if isActivePrivileged() && (isMuniAdmin() || isSuperadmin());
      allow write: if false;
    }
    match /breakglass_events/{id} {
      allow read: if isSuperadmin() && isActivePrivileged();
      allow write: if false;
    }
    match /incident_response_events/{id} {
      allow read: if isSuperadmin() && isActivePrivileged();
      allow write: if false;
    }
    match /report_events/{eventId} {
      allow read: if isActivePrivileged()
                  && (isMuniAdmin() || isSuperadmin()
                      || (isAgencyAdmin() && resource.data.agencyId == myAgency()));
      allow write: if false;
    }
    match /dispatch_events/{eventId} {
      allow read: if isActivePrivileged()
                  && (isMuniAdmin() || isSuperadmin()
                      || (isAgencyAdmin() && resource.data.agencyId == myAgency()));
      allow write: if false;
    }
```

- [ ] **Step 2: Write `public-collections.rules.test.ts`**

Required cases (one `it` each):

- [x] authed citizen reads alerts (positive)
- [x] unauthed read alerts fails (negative)
- [x] any client write to alerts fails
- [x] authed citizen reads emergencies (positive)
- [x] non-superadmin writes to agencies fail (negative)
- [x] superadmin writes to agencies succeed (positive)
- [x] suspended superadmin write to agencies fails (negative — `isActivePrivileged()` check)
- [x] non-superadmin reads to `audit_logs` fail
- [x] superadmin reads to `audit_logs` succeed
- [x] any client read/write to `rate_limits` fails
- [x] any client write to `dead_letters` fails
- [x] non-superadmin read to `dead_letters` fails
- [x] authed citizen reads `hazard_signals` (positive)
- [x] any client write to `hazard_signals` fails
- [x] muni admin reads `moderation_incidents` (positive)
- [x] agency admin reads `moderation_incidents` fails (negative)
- [x] responder reads `breakglass_events` fails
- [x] superadmin reads `breakglass_events` succeeds
- [x] any client write to `incident_response_events` fails

- [ ] **Step 3: Write `report-events.rules.test.ts`**

Required cases:

- [x] muni admin reads `report_events` (positive)
- [x] superadmin reads `report_events` (positive)
- [x] agency admin reads `report_events` only when `resource.data.agencyId == myAgency()` (positive + negative)
- [x] responder reads `report_events` fails
- [x] citizen reads `report_events` fails
- [x] any client write fails

Same structure for `dispatch_events` — either append to the same file or create a sibling test file.

- [ ] **Step 4: Run the rules test suite**

Run: `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test:rules:firestore"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add infra/firebase/firestore.rules functions/src/__tests__/rules
git commit -m "feat(rules): add public + audit + event-stream rules with coverage"
```

---

## Task 9: Firestore Rules — SMS Layer

**Files:**

- Modify: `infra/firebase/firestore.rules`
- Create: `functions/src/__tests__/rules/sms.rules.test.ts`

- [ ] **Step 1: Append the SMS match blocks (verbatim from spec §5.7 lines 808–822)**

```javascript
    match /sms_inbox/{msgId} {
      allow read, write: if false;
    }
    match /sms_outbox/{msgId} {
      allow read: if isSuperadmin() && isActivePrivileged();
      allow write: if false;
    }
    match /sms_sessions/{msisdnHash} {
      allow read, write: if false;
    }
    match /sms_provider_health/{providerId} {
      allow read: if isSuperadmin();
      allow write: if false;
    }
```

- [ ] **Step 2: Write `sms.rules.test.ts`**

Required cases:

- [x] any client read/write to `sms_inbox` fails (admin SDK only)
- [x] superadmin reads `sms_outbox` (positive)
- [x] non-superadmin reads `sms_outbox` fails
- [x] suspended superadmin reads `sms_outbox` fails
- [x] any client write to `sms_outbox` fails
- [x] any client read/write to `sms_sessions` fails
- [x] superadmin reads `sms_provider_health` (positive)
- [x] non-superadmin reads `sms_provider_health` fails
- [x] any client write to `sms_provider_health` fails

- [ ] **Step 3: Run and commit**

Run: `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test:rules:firestore"`
Expected: PASS.

```bash
git add infra/firebase/firestore.rules functions/src/__tests__/rules/sms.rules.test.ts
git commit -m "feat(rules): add sms layer rules with coverage"
```

---

## Task 10: Firestore Rules — Coordination Collections

**Files:**

- Modify: `infra/firebase/firestore.rules`
- Create: `functions/src/__tests__/rules/coordination.rules.test.ts`

- [ ] **Step 1: Append the coordination match blocks (verbatim from spec §5.7 lines 838–879)**

Blocks to copy:

- `match /agency_assistance_requests/{requestId}` — 839–846
- `match /command_channel_threads/{threadId}` — 849–854
- `match /command_channel_messages/{messageId}` — 855–861
- `match /mass_alert_requests/{requestId}` — 864–870
- `match /shift_handoffs/{handoffId}` — 873–879

- [ ] **Step 2: Write `coordination.rules.test.ts` with required cases**

- [x] `agency_assistance_requests`: requesting muni admin reads (positive)
- [x] target agency admin reads (positive)
- [x] other agency admin fails
- [x] superadmin reads (positive)
- [x] any client write fails
- [x] `command_channel_threads`: participant reads (positive)
- [x] non-participant with muni admin role fails
- [x] responder role fails even if somehow in `participantUids` (rule explicitly checks role)
- [x] any client write fails
- [x] `command_channel_messages`: participant of the parent thread reads (positive)
- [x] non-participant fails
- [x] any client write fails
- [x] `mass_alert_requests`: superadmin reads (positive)
- [x] muni admin whose muni matches `requestedByMunicipality` reads (positive)
- [x] different muni admin fails
- [x] any client write fails
- [x] `shift_handoffs`: `fromUid` or `toUid` reads (positive both directions)
- [x] superadmin reads (positive)
- [x] unrelated user read fails
- [x] any client write fails

- [ ] **Step 3: Run and commit**

Run: `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test:rules:firestore"`
Expected: PASS.

```bash
git add infra/firebase/firestore.rules functions/src/__tests__/rules/coordination.rules.test.ts
git commit -m "feat(rules): add coordination collection rules with coverage"
```

---

## Task 11: Firestore Rules — Hazard Zones

**Files:**

- Modify: `infra/firebase/firestore.rules`
- Create: `functions/src/__tests__/rules/hazard-zones.rules.test.ts`

- [ ] **Step 1: Append the `hazard_zones` match block (verbatim from spec §5.7 lines 891–914)**

Note the nested `history` sub-block uses denormalised `zoneType` and `municipalityId` on each history doc — tests must seed them identically.

- [ ] **Step 2: Write `hazard-zones.rules.test.ts`**

Required cases:

- [x] superadmin reads a reference zone (positive)
- [x] superadmin reads a custom provincial zone (positive)
- [x] muni admin reads any reference zone (positive — province-wide visibility)
- [x] muni admin reads own-muni custom zone (positive)
- [x] muni admin reads other-muni custom zone fails (cross-muni negative)
- [x] muni admin reads provincial-scope custom zone fails (scope negative)
- [x] agency admin reads any zone fails
- [x] responder reads any zone fails
- [x] citizen reads any zone fails
- [x] any client write (create/update/delete) fails for all roles
- [x] `history/{version}` inherits the same read surface — positive + negative case per role
- [x] suspended admin fails

- [ ] **Step 3: Run and commit**

Run: `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test:rules:firestore"`
Expected: PASS.

```bash
git add infra/firebase/firestore.rules functions/src/__tests__/rules/hazard-zones.rules.test.ts
git commit -m "feat(rules): add hazard zones rules with coverage"
```

---

## Task 12: Final Rules File Cleanup and Default-Deny Audit

**Context:** After Tasks 6–11, the rules file has every `match` block the spec defines. The trailing `match /{document=**} { allow read, write: if false; }` must remain so any missed collection is deny-by-default. Verify it is still last, and remove any stray Phase 1 comments that are now out of date.

**Files:**

- Modify: `infra/firebase/firestore.rules`

- [ ] **Step 1: Open `infra/firebase/firestore.rules` and verify structure**

The file must end with:

```javascript
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Delete stale comments that reference "Phase 2+ will add specific match blocks".

- [ ] **Step 2: Run `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test:rules:firestore"` one more time**

Expected: full suite PASS.

- [ ] **Step 3: Confirm default-deny with a negative test for an unmapped collection**

Append to `functions/src/__tests__/rules/public-collections.rules.test.ts`:

```ts
it('any write to an unmapped collection fails default-deny', async () => {
  const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
  const { setDoc, doc: d } = await import('firebase/firestore')
  await assertFails(setDoc(d(db, 'not_a_collection/x'), { a: 1 }))
})
```

- [ ] **Step 4: Commit**

```bash
git add infra/firebase/firestore.rules functions/src/__tests__/rules/public-collections.rules.test.ts
git commit -m "chore(rules): strip stale phase-1 comments and add default-deny guardrail test"
```

---

## Task 13: Realtime Database Rules + Tests

**Files:**

- Modify: `infra/firebase/database.rules.json`
- Create: `functions/src/__tests__/rtdb.rules.test.ts`

- [ ] **Step 1: Replace `infra/firebase/database.rules.json` with the §5.8 rule set**

```json
{
  "rules": {
    "responder_locations": {
      "$uid": {
        ".write": "auth != null && auth.uid === $uid && auth.token.role === 'responder' && auth.token.accountStatus === 'active' && newData.child('capturedAt').isNumber() && newData.child('capturedAt').val() <= now + 60000 && newData.child('capturedAt').val() >= now - 600000",
        ".read": "auth != null && auth.token.accountStatus === 'active' && (auth.uid === $uid || auth.token.role === 'provincial_superadmin' || (auth.token.role === 'municipal_admin' && root.child('responder_index').child($uid).child('municipalityId').val() === auth.token.municipalityId) || (auth.token.role === 'agency_admin' && root.child('responder_index').child($uid).child('agencyId').val() === auth.token.agencyId))",
        ".validate": "newData.hasChildren(['capturedAt', 'lat', 'lng', 'accuracy', 'batteryPct', 'appVersion', 'telemetryStatus'])"
      }
    },
    "responder_index": {
      ".read": false,
      "$uid": { ".write": false }
    },
    "shared_projection": {
      "$municipalityId": {
        ".read": "auth != null && auth.token.accountStatus === 'active' && (auth.token.role === 'provincial_superadmin' || (auth.token.role === 'municipal_admin' && auth.token.municipalityId === $municipalityId) || auth.token.role === 'agency_admin')",
        "$uid": { ".write": false }
      }
    }
  }
}
```

- [ ] **Step 2: Write `functions/src/__tests__/rtdb.rules.test.ts`**

Required cases:

- [x] responder writes own location with valid capturedAt (positive)
- [x] responder writes with capturedAt in the far future fails (`> now + 60000`)
- [x] responder writes with capturedAt older than 10 min fails (`< now - 600000`)
- [x] non-responder role writes to `responder_locations/{uid}` fails
- [x] responder writes to another responder's node fails
- [x] suspended responder writes fails (`accountStatus !== 'active'`)
- [x] responder reads own location (positive)
- [x] superadmin reads any responder's location
- [x] muni admin reads responder whose `responder_index.municipalityId` matches — seed the index doc with Admin SDK
- [x] muni admin whose municipality differs fails
- [x] agency admin with matching `agencyId` reads
- [x] agency admin mismatch fails
- [x] `responder_index` client read always fails
- [x] `responder_index` client write always fails
- [x] `shared_projection/{municipalityId}` read succeeds for matching muni admin
- [x] mismatched muni admin fails
- [x] any client write to `shared_projection` fails

Use `@firebase/rules-unit-testing` database API:

```ts
import { createTestEnv } from './helpers/rules-harness.js'
// …
const db = env
  .authenticatedContext('resp-1', { role: 'responder', accountStatus: 'active' })
  .database()
await assertSucceeds(
  db.ref('responder_locations/resp-1').set({
    capturedAt: Date.now(),
    lat: 14.1,
    lng: 122.9,
    accuracy: 10,
    batteryPct: 80,
    appVersion: '0.1.0',
    telemetryStatus: 'online',
  }),
)
```

- [ ] **Step 3: Run the RTDB rules test**

Run: `firebase emulators:exec --only firestore,database "pnpm --filter @bantayog/functions test:rules:rtdb"`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add infra/firebase/database.rules.json functions/src/__tests__/rtdb.rules.test.ts
git commit -m "feat(rtdb): enforce responder telemetry + projection rules"
```

---

## Task 14: Storage Rules + Tests

**Context:** Media uploads are callable-gated via signed URLs (spec §10.6). Direct client writes must always fail. Reads are allowed for admins of the owning municipality via an Admin-SDK token stamp — Phase 2 ships only the deny-by-default rule plus a narrow read path that Phase 3 will actually use.

**Files:**

- Modify: `infra/firebase/storage.rules`
- Create: `functions/src/__tests__/storage.rules.test.ts`

- [ ] **Step 1: Replace `infra/firebase/storage.rules`**

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function isAuthed() {
      return request.auth != null
          && request.auth.token.accountStatus == 'active';
    }

    function role()          { return request.auth.token.role; }
    function myMunicipality(){ return request.auth.token.municipalityId; }
    function permittedMunis() {
      return request.auth.token.permittedMunicipalityIds != null
        ? request.auth.token.permittedMunicipalityIds : [];
    }
    function isMuniAdmin()   { return isAuthed() && role() == 'municipal_admin'; }
    function isSuperadmin()  { return isAuthed() && role() == 'provincial_superadmin'; }

    // Report media: path is report_media/{municipalityId}/{reportId}/{filename}
    // Admin SDK uploads; admin-of-muni reads.
    match /report_media/{municipalityId}/{reportId}/{filename} {
      allow read: if (isMuniAdmin() && myMunicipality() == municipalityId)
                  || (isSuperadmin() && municipalityId in permittedMunis());
      allow write: if false;
    }

    // Hazard reference layer payloads — superadmin-only read; Admin SDK writes.
    match /hazard_layers/{version}/{filename} {
      allow read: if isSuperadmin();
      allow write: if false;
    }

    // Default deny anything else.
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Write `functions/src/__tests__/storage.rules.test.ts`**

Required cases:

- [x] any client write to any path fails (citizen, responder, muni admin, agency admin, superadmin)
- [x] muni admin reads own-muni `report_media/{muni}/{reportId}/x.jpg` (positive)
- [x] muni admin reads other-muni path fails (cross-muni negative)
- [x] superadmin reads with municipality in `permittedMunicipalityIds` (positive)
- [x] superadmin reads with municipality NOT in `permittedMunicipalityIds` fails
- [x] citizen, responder, agency admin read `report_media` all fail
- [x] superadmin reads `hazard_layers/{version}/x.geojson` (positive)
- [x] non-superadmin read `hazard_layers` fails
- [x] unmatched paths deny-default

Seed a storage object via `env.withSecurityRulesDisabled` with `storage().ref().put(...)`.

- [ ] **Step 3: Run**

Run: `firebase emulators:exec --only firestore,storage "pnpm --filter @bantayog/functions test:rules:storage"`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add infra/firebase/storage.rules functions/src/__tests__/storage.rules.test.ts
git commit -m "feat(storage): lock storage rules to callable-only uploads with admin-read paths"
```

---

## Task 15: Composite Index Plan Deployed

**Files:**

- Modify: `infra/firebase/firestore.indexes.json`

- [ ] **Step 1: Replace `infra/firebase/firestore.indexes.json` with the full §5.9 index set**

```json
{
  "indexes": [
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "municipalityId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "municipalityId", "order": "ASCENDING" },
        { "fieldPath": "severity", "order": "DESCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "visibilityClass", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "report_ops",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "municipalityId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "severity", "order": "DESCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "report_ops",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "agencyIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "report_ops",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "duplicateClusterId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "report_ops",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "municipalityId", "order": "ASCENDING" },
        { "fieldPath": "hazardZoneIdList", "arrayConfig": "CONTAINS" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "report_ops",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "locationGeohash", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "report_sharing",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "sharedWith", "arrayConfig": "CONTAINS" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "report_sharing",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerMunicipalityId", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "responderId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dispatchedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "reportId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "agencyId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dispatchedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "municipalityId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dispatchedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "alerts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "targetMunicipalityIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "sentAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "report_inbox",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "processingStatus", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "deletedAt", "order": "ASCENDING" },
        { "fieldPath": "retentionExempt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "archivedAt", "order": "ASCENDING" },
        { "fieldPath": "retentionExempt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "sms_outbox",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "providerId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "sms_outbox",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "purpose", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "report_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "reportId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "report_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "actor", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatch_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "dispatchId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "agency_assistance_requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "targetAgencyId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "agency_assistance_requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "requestedByMunicipality", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "shift_handoffs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "toUid", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "hazard_zones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "zoneType", "order": "ASCENDING" },
        { "fieldPath": "hazardType", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "hazard_zones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "scope", "order": "ASCENDING" },
        { "fieldPath": "municipalityId", "order": "ASCENDING" },
        { "fieldPath": "zoneType", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "hazard_zones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "geohashPrefix", "order": "ASCENDING" },
        { "fieldPath": "deletedAt", "order": "ASCENDING" },
        { "fieldPath": "hazardType", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "hazard_zones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "expiresAt", "order": "ASCENDING" },
        { "fieldPath": "zoneType", "order": "ASCENDING" },
        { "fieldPath": "deletedAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 2: Validate with the Firebase CLI**

Run: `firebase firestore:indexes --project bantayog-alert-dev > /tmp/current-indexes.json`

(If no dev project is configured locally, skip this check — the indexes will validate against CI when Terraform applies them in the gated-rollout tasks.)

Run: `pnpm exec tsx -e "import('./infra/firebase/firestore.indexes.json', { assert: { type: 'json' } }).then((m) => { console.log('index count:', m.default.indexes.length) })"`
Expected: `index count: 29`

- [ ] **Step 3: Commit**

```bash
git add infra/firebase/firestore.indexes.json
git commit -m "feat(indexes): deploy full §5.9 composite index set"
```

---

## Task 16: Idempotency Guard Cloud Function Helper

**Context:** Phase 1 shipped `canonicalPayloadHash`. Phase 2 wraps that into a transactional `withIdempotency` helper every callable uses. The helper reads `idempotency_keys/{key}` inside a Firestore transaction, compares the incoming hash, and either short-circuits with the cached `resultRef` or proceeds.

**Files:**

- Create: `functions/src/idempotency/guard.ts`
- Create: `functions/src/idempotency/guard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// functions/src/idempotency/guard.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'
import { withIdempotency, IdempotencyMismatchError } from './guard.js'

function makeMockFirestore() {
  const store = new Map<string, Record<string, unknown>>()
  const ref = (path: string) => ({
    path,
    get: vi.fn(async () => {
      const data = store.get(path)
      return {
        exists: data != null,
        data: () => data,
      }
    }),
    set: vi.fn(async (value: Record<string, unknown>) => {
      store.set(path, value)
    }),
    update: vi.fn(async (value: Record<string, unknown>) => {
      const existing = store.get(path) ?? {}
      store.set(path, { ...existing, ...value })
    }),
  })
  return {
    runTransaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        get: async (r: { get: () => Promise<unknown> }) => r.get(),
        set: async (
          r: { set: (v: Record<string, unknown>) => Promise<void> },
          value: Record<string, unknown>,
        ) => r.set(value),
        update: async (
          r: { update: (v: Record<string, unknown>) => Promise<void> },
          value: Record<string, unknown>,
        ) => r.update(value),
      }
      return fn(tx)
    }),
    collection: vi.fn((name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) })),
    doc: vi.fn((path: string) => ref(path)),
    _store: store,
  } as unknown as Firestore & { _store: Map<string, Record<string, unknown>> }
}

describe('withIdempotency', () => {
  let db: ReturnType<typeof makeMockFirestore>
  beforeEach(() => {
    db = makeMockFirestore()
  })

  it('runs the operation and writes the key on first call', async () => {
    const op = vi.fn(async () => ({ resultId: 'x1' }))
    const result = await withIdempotency(
      db,
      {
        key: 'cb:verifyReport:u1',
        payload: { reportId: 'r1' },
        now: () => 1000,
      },
      op,
    )
    expect(result).toEqual({ resultId: 'x1' })
    expect(op).toHaveBeenCalledTimes(1)
    expect(db._store.has('idempotency_keys/cb:verifyReport:u1')).toBe(true)
  })

  it('returns cached result on replay with matching payload hash', async () => {
    const op = vi.fn(async () => ({ resultId: 'x1' }))
    await withIdempotency(
      db,
      {
        key: 'cb:verifyReport:u1',
        payload: { reportId: 'r1' },
        now: () => 1000,
      },
      op,
    )
    const replay = await withIdempotency(
      db,
      {
        key: 'cb:verifyReport:u1',
        payload: { reportId: 'r1' },
        now: () => 2000,
      },
      op,
    )
    expect(op).toHaveBeenCalledTimes(1)
    expect(replay).toEqual({ resultId: 'x1' })
  })

  it('throws IdempotencyMismatchError on same key with different payload', async () => {
    const op = vi.fn(async () => ({ resultId: 'x1' }))
    await withIdempotency(
      db,
      {
        key: 'cb:verifyReport:u1',
        payload: { reportId: 'r1' },
        now: () => 1000,
      },
      op,
    )
    await expect(
      withIdempotency(
        db,
        {
          key: 'cb:verifyReport:u1',
          payload: { reportId: 'r2' },
          now: () => 2000,
        },
        op,
      ),
    ).rejects.toBeInstanceOf(IdempotencyMismatchError)
    expect(op).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @bantayog/functions vitest run src/idempotency/guard.test.ts`
Expected: FAIL with "Cannot find module './guard.js'".

- [ ] **Step 3: Implement `functions/src/idempotency/guard.ts`**

```ts
import type { Firestore } from 'firebase-admin/firestore'
import { canonicalPayloadHash } from '@bantayog/shared-validators'

export class IdempotencyMismatchError extends Error {
  constructor(
    public readonly key: string,
    public readonly firstSeenAt: number,
  ) {
    super(
      `ALREADY_EXISTS_DIFFERENT_PAYLOAD: idempotency key "${key}" was first seen at ${firstSeenAt} with a different payload`,
    )
    this.name = 'IdempotencyMismatchError'
  }
}

interface WithIdempotencyOptions<TPayload> {
  key: string
  payload: TPayload
  now?: () => number
}

export async function withIdempotency<TPayload, TResult>(
  db: Firestore,
  opts: WithIdempotencyOptions<TPayload>,
  op: () => Promise<TResult>,
): Promise<TResult> {
  const now = opts.now ?? (() => Date.now())
  const hash = canonicalPayloadHash(opts.payload)
  const keyRef = db.collection('idempotency_keys').doc(opts.key)

  const cached = await db.runTransaction(async (tx) => {
    const snap = await tx.get(keyRef)
    if (!snap.exists) {
      await tx.set(keyRef, {
        key: opts.key,
        payloadHash: hash,
        firstSeenAt: now(),
      })
      return null
    }
    const data = snap.data() as {
      payloadHash: string
      firstSeenAt: number
      resultPayload?: TResult
    }
    if (data.payloadHash !== hash) {
      throw new IdempotencyMismatchError(opts.key, data.firstSeenAt)
    }
    return (data.resultPayload ?? null) as TResult | null
  })

  if (cached != null) {
    return cached
  }

  const result = await op()
  await keyRef.update({ resultPayload: result, completedAt: now() })
  return result
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @bantayog/functions vitest run src/idempotency/guard.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 5: Export from `functions/src/index.ts`**

Add:

```ts
export { withIdempotency, IdempotencyMismatchError } from './idempotency/guard.js'
```

- [ ] **Step 6: Commit**

```bash
git add functions/src/idempotency functions/src/index.ts
git commit -m "feat(functions): add transactional idempotency guard"
```

---

## Task 17: Rule-Coverage Enforcement Tool + CI Gate

**Context:** Spec §5.7 mandates "CI fails if any rule lacks negative tests." This task ships the grep-style checker that fulfils that requirement. It parses `firestore.rules` for every `match /path` block, then asserts the test suite has at least one `assertFails` and one `assertSucceeds` referencing that path.

**Files:**

- Create: `scripts/check-rule-coverage.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `functions/package.json`

- [ ] **Step 1: Implement the coverage checker**

```ts
// scripts/check-rule-coverage.ts
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

interface RulePath {
  collection: string
  line: number
}

function extractRulePaths(rulesSrc: string): RulePath[] {
  const paths: RulePath[] = []
  const lines = rulesSrc.split('\n')
  lines.forEach((line, idx) => {
    const m = line.match(/match\s+\/([a-zA-Z_][\w]*)/)
    if (m) {
      paths.push({ collection: m[1], line: idx + 1 })
    }
  })
  // Remove the catch-all `{document=**}` trailer and duplicates.
  return Array.from(
    new Set(paths.filter((p) => p.collection !== 'document').map((p) => p.collection)),
  ).map((c, i) => ({ collection: c, line: i }))
}

function readAllTestFiles(testRoot: string): string {
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (
        entry.name.endsWith('.rules.test.ts') ||
        entry.name === 'rtdb.rules.test.ts' ||
        entry.name === 'storage.rules.test.ts'
      ) {
        files.push(readFileSync(full, 'utf8'))
      }
    }
  }
  walk(testRoot)
  return files.join('\n')
}

function main(): void {
  const rulesPath = resolve(process.cwd(), 'infra/firebase/firestore.rules')
  const rulesSrc = readFileSync(rulesPath, 'utf8')
  const paths = extractRulePaths(rulesSrc)

  const testsRoot = resolve(process.cwd(), 'functions/src/__tests__')
  const testsSrc = readAllTestFiles(testsRoot)

  const missing: { collection: string; missing: string[] }[] = []
  for (const { collection } of paths) {
    const m: string[] = []
    // Check that the collection path appears in at least one assertSucceeds and one assertFails.
    const refRegex = new RegExp(`['"\`]${collection}[/'"\`]`)
    const matches = testsSrc.split(/\n\s*it\(/).filter((block) => refRegex.test(block))
    const hasPositive = matches.some((b) => /assertSucceeds/.test(b))
    const hasNegative = matches.some((b) => /assertFails/.test(b))
    if (!hasPositive) m.push('positive (assertSucceeds) missing')
    if (!hasNegative) m.push('negative (assertFails) missing')
    if (m.length > 0) missing.push({ collection, missing: m })
  }

  if (missing.length > 0) {
    console.error('✗ Rule coverage gaps detected:')
    for (const gap of missing) {
      console.error(`  - /${gap.collection}: ${gap.missing.join(', ')}`)
    }
    process.exit(1)
  }

  console.log(
    `✓ Rule coverage OK — ${paths.length} collections, positive + negative tests present for each.`,
  )
}

main()
```

- [ ] **Step 2: Wire the checker into CI**

In `.github/workflows/ci.yml`, add a job or step that runs after the rules tests pass:

```yaml
- name: Rule coverage gate
  run: pnpm exec tsx scripts/check-rule-coverage.ts
```

- [ ] **Step 3: Run the checker locally against the current rule set**

Run: `pnpm exec tsx scripts/check-rule-coverage.ts`
Expected: `✓ Rule coverage OK — N collections, positive + negative tests present for each.`

If gaps are reported, fix them by adding the missing `it(...)` case in the relevant test file and re-run.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-rule-coverage.ts .github/workflows/ci.yml functions/package.json
git commit -m "ci: enforce firestore rule positive/negative coverage gate"
```

---

## Task 18: Schema Migration Protocol Runbook

**Context:** Spec §13.12 requires a documented protocol, not ad-hoc migrations. Phase 2 ships the runbook template so the next schema change that lands in Phase 3+ has a place to plug into.

**Files:**

- Create: `docs/runbooks/schema-migration.md`

- [ ] **Step 1: Write the runbook**

```markdown
# Schema Migration Protocol

Source of truth: Arch Spec §13.12.

## When this runbook applies

Any breaking change to a Firestore document shape that already has production data:

- Adding a required field without a default
- Renaming a field
- Changing an enum value set (removing or renaming literals)
- Changing field types (e.g., `number` → `string`)
- Collapsing or splitting collections

Purely additive optional fields do NOT trigger this protocol — they follow the normal PR workflow.

## Stage 1 — Plan document

Before any code change, write a short migration plan covering:

1. **Old schema** (link to current Zod schema in `packages/shared-validators/src/<file>.ts`)
2. **New schema** (PR-drafted definition)
3. **Trigger compatibility matrix**: for each Cloud Function that reads or writes this collection, which branch handles old vs new
4. **Backfill strategy**: batched scheduled function, size limits, throttle
5. **Rollback plan**: exact `firebase deploy --only functions:<name>` command to revert
6. **Monitoring signals**: what dashboards confirm progress; what alert fires if progress stalls

The plan lives in `docs/runbooks/migrations/<YYYY-MM-DD>-<schema>.md`.

## Stage 2 — `schemaVersion` guard

Every document class carries `schemaVersion: number`. New writes must increment. Read paths must accept both old and new versions during the migration window.

## Stage 3 — Migration window

Default 30 days. Both versions accepted; triggers have branched code paths with explicit unit tests for each branch. The date is recorded in `system_config/migration_progress/<schemaKey>`.

## Stage 4 — Backfill

A scheduled function reads old-version documents in batches, rewrites them to the new shape inside a transaction, and updates `system_config/migration_progress/<schemaKey>.completed`. Runs during low-traffic hours (01:00–05:00 Asia/Manila). Respect Firestore write quotas — default 500 docs/sec.

## Stage 5 — Cutover

When backfill `completed == true` AND zero old-version writes for 7 consecutive days, remove the old-version branches in a follow-up PR. This PR must include:

- A counting query proving zero old-version documents remain
- A screenshot of the monitoring dashboard showing the steady-state
- The `system_config/migration_progress/<schemaKey>` document marked `closed: true`

## Stage 6 — Rollback

During the migration window, rollback is a function-only redeploy from the prior tag. Post-window rollback requires a reverse migration plan — treat it as a new migration.

## Definition of done

The migration is not complete until:

- [ ] Counting query confirms zero old-version documents
- [ ] Monitoring signal shows zero old-version writes for 7 consecutive days
- [ ] Old-version trigger branches removed
- [ ] Runbook entry closed in `docs/runbooks/migrations/`
- [ ] Post-migration review logged in `docs/learnings.md`
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/schema-migration.md
git commit -m "docs(runbooks): add schema migration protocol"
```

---

## Task 19: Phase Verification and Progress Capture

**Files:**

- Modify: `docs/progress.md`
- Modify: `docs/learnings.md`
- Modify: `README.md`

- [ ] **Step 1: Run the full verification sweep**

```bash
pnpm lint
pnpm typecheck
pnpm test
firebase emulators:exec --only firestore,database,storage "pnpm --filter @bantayog/functions test:rules"
pnpm exec tsx scripts/check-rule-coverage.ts
pnpm build
```

Every command must exit 0. If any fail, stop and fix before editing progress docs.

- [ ] **Step 2: Record the phase completion in `docs/progress.md`**

Append:

```markdown
## Phase 2 Data Model and Security Rules Foundation (Complete)

**Branch:** `feature/phase-2-data-model-rules`
**Plan:** See `docs/superpowers/plans/2026-04-17-phase-2-data-model-security-rules.md`
**Status:** All verification steps passed.

### Verification results

| Step | Check                                                                                                      | Result |
| ---- | ---------------------------------------------------------------------------------------------------------- | ------ |
| 1    | `pnpm lint`                                                                                                | PASS   |
| 2    | `pnpm typecheck`                                                                                           | PASS   |
| 3    | `pnpm test`                                                                                                | PASS   |
| 4    | `firebase emulators:exec --only firestore,database,storage "pnpm --filter @bantayog/functions test:rules"` | PASS   |
| 5    | `pnpm exec tsx scripts/check-rule-coverage.ts`                                                             | PASS   |
| 6    | `pnpm build`                                                                                               | PASS   |

### What was built

- Full Zod schema coverage for every collection in Arch Spec §5.5
- Reconciled enum literals (ReportStatus 15 states, VisibilityClass `internal`/`public_alertable`, HazardType bare literals)
- Firestore rules for inbox, triptych, dispatches, users, responders, public collections, SMS, coordination, hazards, events
- RTDB rules for responder_locations, responder_index, shared_projection
- Storage rules locked to callable-only uploads with admin-read paths
- 29 composite indexes in `firestore.indexes.json` per §5.9
- Idempotency guard Cloud Function helper (`withIdempotency`) with payload-hash deduplication
- CI rule-coverage gate (`scripts/check-rule-coverage.ts`)
- Schema migration protocol runbook
```

- [ ] **Step 3: Record learnings in `docs/learnings.md`**

Append only lessons that aren't derivable from the code. Candidates:

- "Firestore rules `resource.data.__reportId` does not exist — cross-document sharing checks must be implemented per-collection, not in a shared helper"
- "The coverage-checker regex must match `match /collection` at the start of the path segment to avoid false positives from nested subcollections"
- "Every `strict()` Zod object rejects unknown keys — critical for rule alignment because Firestore `diff().affectedKeys().hasOnly(...)` rejects the same unknown keys at the rule layer"

- [ ] **Step 4: Update README**

Append to the verification section:

```markdown
## Phase 2 verification

- `pnpm test`
- `firebase emulators:exec --only firestore,database,storage "pnpm --filter @bantayog/functions test:rules"`
- `pnpm exec tsx scripts/check-rule-coverage.ts`
- `pnpm build`
```

- [ ] **Step 5: Commit the documentation updates**

```bash
git add docs/progress.md docs/learnings.md README.md
git commit -m "docs(phase-2): record data-model + rules foundation verification"
```

---

## Self-Review Notes

- Spec coverage: every collection in §5.5 has a schema (Tasks 2–4), a rule block (Tasks 6–12), and a test (Tasks 6–14). RTDB rules §5.8 (Task 13). Storage rules (Task 14). Composite indexes §5.9 (Task 15). Idempotency §6.2 (Task 16). Rule-coverage CI gate §5.7 requirement (Task 17). Schema-migration runbook §13.12 (Task 18).
- Open item: Arch Spec §5.7 rule "messages" and "field*notes" paths reference `get(/databases/.../dispatches/$(reportId + '*' + uid()))`. Tests in Task 6 Step 6 must seed dispatches with exactly that composite ID format (`<reportId>\_<responderUid>`). Callable code in Phase 3 must honour this ID convention — flagged explicitly for the Phase 3 plan.
- No placeholder scan: every code step has runnable code; every test step has a full test body (or an explicit enumeration of required cases where the pattern repeats).
- Type consistency: `reportDocSchema`, `reportEventSchema`, and rule tests all use the 15-state `ReportStatus` from Task 1 Step 1. `DispatchStatus` includes `superseded` (added in Task 1 Step 1) — referenced in `dispatchDocSchema`, `dispatchEventSchema`, and never emitted client-side.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-17-phase-2-data-model-security-rules.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. Use `superpowers:subagent-driven-development`.
2. **Inline Execution** — execute tasks in this session with `superpowers:executing-plans`, batch checkpoints for review.

Which approach?
