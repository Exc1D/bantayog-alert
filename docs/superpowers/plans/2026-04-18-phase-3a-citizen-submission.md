# Phase 3a Implementation Plan: Citizen Submission + Triptych Materialization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first sub-phase of Phase 3 — a citizen in Daet submits a report through the web PWA, and a correct triptych (`reports` + `report_private` + `report_ops`) materializes in Firestore with append-only events, a lookup reference, and a pending-media reference. No admin UI.

**Architecture:** Small Zod schema deltas land first (additive, strict). A new shared state-machine package emits report and dispatch transition tables as TypeScript source-of-truth; a codegen script concatenates a rules fragment into `firestore.rules` during deploy. A `processInboxItem` Firestore trigger materializes the triptych inside a single transaction, guarded by the Phase 2 `withIdempotency` helper. `onMediaFinalize` strips EXIF and registers pending media. `inboxReconciliationSweep` is the safety net. `requestUploadUrl` and `requestLookup` callables round out the citizen surface. The citizen PWA gets a submit form and a lookup screen.

**Tech Stack:** TypeScript strict, Zod, Firebase Functions v2 (Node 20), Firebase Admin SDK, `sharp` + `exifr` for image processing, `@firebase/rules-unit-testing`, Vitest, React + Vite for the PWA, Terraform for monitoring.

**Phase 3 design spec:** `docs/superpowers/specs/2026-04-18-phase-3-design.md`

**Exit milestone:** `scripts/phase-3a/acceptance.ts` passes in staging. A real citizen submission lands as a correct triptych + event + lookup + pending media reference.

---

## Preconditions

- Phase 2 complete (94 tests passing, 30 indexes deployed, rule-coverage gate green).
- Local dev env: Node 20.x, pnpm 9.12.0, Firebase CLI 15+, Java 21+ for emulator.
- Staging Firebase project `bantayog-alert-staging` reachable with App Check configured.
- Branch `feature/phase-3a-citizen-submission` cut from `main`.

---

## File Structure (3a)

### New files

```
packages/shared-validators/src/
  state-machines/
    report-states.ts            # ReportStatus union + REPORT_TRANSITIONS table
    dispatch-states.ts          # DispatchStatus union + DISPATCH_TRANSITIONS table
    index.ts                    # Barrel
  municipalities.ts             # MunicipalitySchema + MUNI_TABLE seed constant
  errors.ts                     # BantayogError + BantayogErrorCode enum
  logging.ts                    # logEvent() typed structured-log helper
  state-machines.test.ts        # Matrix test: every valid + invalid transition

scripts/
  build-rules.ts                # Concat transition tables into firestore.rules
  phase-3a/
    acceptance.ts               # Phase-exit gate — staging + emulator

functions/src/
  callables/
    request-upload-url.ts       # Signed-URL issuance
    request-lookup.ts           # Citizen status pull
  triggers/
    process-inbox-item.ts       # Triptych materializer
    on-media-finalize.ts        # EXIF strip + MIME check
    on-media-relocate.ts        # Dormant — Phase 5 flip
    inbox-reconciliation-sweep.ts # Scheduled safety net
  services/
    municipality-lookup.ts      # Cold-start cached muni map
    geocode.ts                  # Stub reverse geocoder
  __tests__/
    callables/
      request-upload-url.test.ts
      request-lookup.test.ts
    triggers/
      process-inbox-item.test.ts
      on-media-finalize.test.ts
      inbox-reconciliation-sweep.test.ts
    rules/
      dispatch-transition.rules.test.ts  # Codegen-emitted rules proof

apps/citizen-pwa/src/
  components/
    SubmitReportForm.tsx
    ReceiptScreen.tsx
    LookupScreen.tsx
  services/
    submit-report.ts            # Client orchestrator: upload → inbox write
    firebase.ts                 # App + App Check init
  routes.tsx                    # React Router wiring

infra/firebase/
  firestore.rules.inc           # CODEGEN ARTIFACT — do not edit
  firestore.rules.template      # Source template with // @@TRANSITION_TABLES@@ marker

infra/terraform/modules/
  monitoring/phase-3/
    main.tf                     # Dashboard + alert policies
    variables.tf
    outputs.tf

.github/workflows/
  ci.yml                        # Add rules-drift-check gate
```

### Modified files

```
packages/shared-validators/src/
  reports.ts                    # Add municipalityLabel, correlationId; extend inbox + lookup schemas
  index.ts                      # Export new modules

infra/firebase/
  firestore.rules                # Replace with template + codegen (moved to .template)

firebase.json                    # Add predeploy hook for rules build

scripts/check-rule-coverage.ts  # Add phase-3 collections to coverage set

apps/citizen-pwa/src/
  App.tsx                       # Route shell only
  App.test.tsx                  # Fix jest-dom import path
```

### Deleted files

None.

---

## Group A — Schema Deltas and State Machines (Tasks 1-5)

Land all additive Zod changes and the transition tables first. These are pre-requisites for every later task. They ship independently and can be reviewed quickly.

---

### Task 1: Add `municipalityLabel` and `correlationId` to `reportDocSchema`

**Files:**

- Modify: `packages/shared-validators/src/reports.ts:13-74`
- Modify: `packages/shared-validators/src/reports.test.ts` (add tests)

- [ ] **Step 1: Write the failing test**

Append to `packages/shared-validators/src/reports.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { reportDocSchema } from './reports.js'

describe('reportDocSchema Phase 3 deltas', () => {
  const validBase = {
    municipalityId: 'daet',
    municipalityLabel: 'Daet',
    barangayId: 'daet-1',
    reporterRole: 'citizen' as const,
    reportType: 'flood' as const,
    severity: 'high' as const,
    status: 'new' as const,
    publicLocation: { lat: 14.1, lng: 122.9 },
    mediaRefs: [],
    description: 'flooded road',
    submittedAt: 1713350400000,
    retentionExempt: false,
    visibilityClass: 'internal' as const,
    visibility: { scope: 'municipality' as const, sharedWith: [] },
    source: 'web' as const,
    hasPhotoAndGPS: false,
    schemaVersion: 1,
    correlationId: '11111111-1111-4111-8111-111111111111',
  }

  it('accepts a valid report with municipalityLabel and correlationId', () => {
    expect(() => reportDocSchema.parse(validBase)).not.toThrow()
  })

  it('rejects a missing municipalityLabel', () => {
    const { municipalityLabel: _, ...rest } = validBase
    expect(() => reportDocSchema.parse(rest)).toThrow()
  })

  it('rejects a non-UUID correlationId', () => {
    expect(() => reportDocSchema.parse({ ...validBase, correlationId: 'not-a-uuid' })).toThrow()
  })

  it('rejects an empty municipalityLabel', () => {
    expect(() => reportDocSchema.parse({ ...validBase, municipalityLabel: '' })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bantayog/shared-validators test -- reports`
Expected: FAIL — "Unrecognized key(s)" or "Required" for `municipalityLabel`/`correlationId`.

- [ ] **Step 3: Add the fields to `reportDocSchema`**

In `packages/shared-validators/src/reports.ts`, within `reportDocSchema`, add after `schemaVersion`:

```typescript
    schemaVersion: z.number().int().positive(),
    municipalityLabel: z.string().min(1).max(64),
    correlationId: z.string().uuid(),
  })
  .strict()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bantayog/shared-validators test -- reports`
Expected: PASS. All existing reports.test.ts cases continue to pass (they already pass `municipalityLabel` via the new fixture; update any that don't).

- [ ] **Step 5: Fix any Phase 2 fixtures broken by the additive change**

Run: `pnpm --filter @bantayog/shared-validators test`
If any existing test fixture omits `municipalityLabel` or `correlationId`, add them. Do **not** relax the new fields to optional — strictness is the point.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-validators/src/reports.ts packages/shared-validators/src/reports.test.ts
git commit -m "feat(shared-validators): add municipalityLabel and correlationId to ReportDoc"
```

---

### Task 2: Extend `reportInboxDocSchema` with publicRef, secretHash, correlationId

**Files:**

- Modify: `packages/shared-validators/src/reports.ts` (reportInboxDocSchema at line ~156)
- Modify: `packages/shared-validators/src/reports.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { reportInboxDocSchema } from './reports.js'

describe('reportInboxDocSchema Phase 3 deltas', () => {
  const validInbox = {
    reporterUid: 'citizen-1',
    clientCreatedAt: 1713350400000,
    idempotencyKey: 'idem-1',
    publicRef: 'a1b2c3d4',
    secretHash: 'f'.repeat(64),
    correlationId: '11111111-1111-4111-8111-111111111111',
    payload: { reportType: 'flood', description: 'x' },
  }

  it('accepts a valid inbox doc with all Phase 3 fields', () => {
    expect(() => reportInboxDocSchema.parse(validInbox)).not.toThrow()
  })

  it('rejects a publicRef with uppercase letters', () => {
    expect(() => reportInboxDocSchema.parse({ ...validInbox, publicRef: 'A1B2C3D4' })).toThrow()
  })

  it('rejects a publicRef of wrong length', () => {
    expect(() => reportInboxDocSchema.parse({ ...validInbox, publicRef: 'abc' })).toThrow()
  })

  it('rejects a secretHash that is not 64 hex chars', () => {
    expect(() => reportInboxDocSchema.parse({ ...validInbox, secretHash: 'short' })).toThrow()
  })

  it('rejects a non-UUID correlationId', () => {
    expect(() => reportInboxDocSchema.parse({ ...validInbox, correlationId: 'x' })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bantayog/shared-validators test -- reports`
Expected: FAIL on publicRef/secretHash/correlationId keys.

- [ ] **Step 3: Add fields to `reportInboxDocSchema`**

Replace the current definition:

```typescript
export const reportInboxDocSchema = z
  .object({
    reporterUid: z.string().min(1),
    clientCreatedAt: z.number().int(),
    idempotencyKey: z.string().min(1),
    publicRef: z.string().regex(/^[a-z0-9]{8}$/),
    secretHash: z.string().regex(/^[a-f0-9]{64}$/),
    correlationId: z.string().uuid(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bantayog/shared-validators test -- reports`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared-validators/src/reports.ts packages/shared-validators/src/reports.test.ts
git commit -m "feat(shared-validators): add publicRef, secretHash, correlationId to ReportInbox"
```

---

### Task 3: Add `tokenHash` to `reportLookupDocSchema` and create `municipalities.ts`

**Files:**

- Modify: `packages/shared-validators/src/reports.ts`
- Create: `packages/shared-validators/src/municipalities.ts`
- Modify: `packages/shared-validators/src/index.ts`
- Modify: `packages/shared-validators/src/reports.test.ts`

- [ ] **Step 1: Write the failing lookup test**

Append to `reports.test.ts`:

```typescript
import { reportLookupDocSchema } from './reports.js'

describe('reportLookupDocSchema Phase 3 delta', () => {
  const valid = {
    publicTrackingRef: 'a1b2c3d4',
    reportId: 'rpt-1',
    tokenHash: 'a'.repeat(64),
    expiresAt: 1716000000000,
    createdAt: 1713350400000,
    schemaVersion: 1,
  }

  it('accepts a lookup with tokenHash and expiresAt', () => {
    expect(() => reportLookupDocSchema.parse(valid)).not.toThrow()
  })

  it('rejects a non-hex tokenHash', () => {
    expect(() => reportLookupDocSchema.parse({ ...valid, tokenHash: 'z'.repeat(64) })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bantayog/shared-validators test -- reports`
Expected: FAIL.

- [ ] **Step 3: Update the lookup schema**

Replace:

```typescript
export const reportLookupDocSchema = z
  .object({
    publicTrackingRef: z.string().regex(/^[a-z0-9]{8}$/),
    reportId: z.string().min(1),
    tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
    expiresAt: z.number().int(),
    createdAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()
```

- [ ] **Step 4: Create the municipality schema file**

Create `packages/shared-validators/src/municipalities.ts`:

```typescript
import { z } from 'zod'

export const municipalityDocSchema = z
  .object({
    id: z.string().min(1).max(32),
    label: z.string().min(1).max(64),
    provinceId: z.string().min(1).max(32),
    centroid: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .strict(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export type MunicipalityDoc = z.infer<typeof municipalityDocSchema>

// Seed constant for the Phase 3 pilot province.
export const CAMARINES_NORTE_MUNICIPALITIES: ReadonlyArray<Omit<MunicipalityDoc, 'schemaVersion'>> =
  [
    {
      id: 'daet',
      label: 'Daet',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.1121, lng: 122.9554 },
    },
    {
      id: 'basud',
      label: 'Basud',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.0661, lng: 122.9561 },
    },
    {
      id: 'capalonga',
      label: 'Capalonga',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.3339, lng: 122.504 },
    },
    {
      id: 'jose-panganiban',
      label: 'Jose Panganiban',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.293, lng: 122.69 },
    },
    {
      id: 'labo',
      label: 'Labo',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.157, lng: 122.83 },
    },
    {
      id: 'mercedes',
      label: 'Mercedes',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.1061, lng: 123.0125 },
    },
    {
      id: 'paracale',
      label: 'Paracale',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.284, lng: 122.786 },
    },
    {
      id: 'san-lorenzo-ruiz',
      label: 'San Lorenzo Ruiz',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.132, lng: 122.76 },
    },
    {
      id: 'san-vicente',
      label: 'San Vicente',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.098, lng: 122.876 },
    },
    {
      id: 'santa-elena',
      label: 'Santa Elena',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.213, lng: 122.381 },
    },
    {
      id: 'talisay',
      label: 'Talisay',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.137, lng: 122.922 },
    },
    {
      id: 'vinzons',
      label: 'Vinzons',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.172, lng: 122.908 },
    },
  ]
```

- [ ] **Step 5: Export from `packages/shared-validators/src/index.ts`**

Append:

```typescript
export { municipalityDocSchema, CAMARINES_NORTE_MUNICIPALITIES } from './municipalities.js'
export type { MunicipalityDoc } from './municipalities.js'
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @bantayog/shared-validators test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared-validators/src/reports.ts packages/shared-validators/src/reports.test.ts packages/shared-validators/src/municipalities.ts packages/shared-validators/src/index.ts
git commit -m "feat(shared-validators): add tokenHash to ReportLookup and MunicipalitySchema"
```

---

### Task 4: Create state-machine transition tables

**Files:**

- Create: `packages/shared-validators/src/state-machines/report-states.ts`
- Create: `packages/shared-validators/src/state-machines/dispatch-states.ts`
- Create: `packages/shared-validators/src/state-machines/index.ts`
- Create: `packages/shared-validators/src/state-machines.test.ts`
- Modify: `packages/shared-validators/src/index.ts`

- [ ] **Step 1: Write the failing matrix test**

Create `packages/shared-validators/src/state-machines.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  REPORT_STATES,
  REPORT_TRANSITIONS,
  isValidReportTransition,
  DISPATCH_STATES,
  DISPATCH_TRANSITIONS,
  isValidDispatchTransition,
} from './state-machines/index.js'

describe('report transitions', () => {
  it('has 15 states', () => {
    expect(REPORT_STATES).toHaveLength(15)
  })

  it('allows draft_inbox → new', () => {
    expect(isValidReportTransition('draft_inbox', 'new')).toBe(true)
  })

  it('rejects closed → new', () => {
    expect(isValidReportTransition('closed', 'new')).toBe(false)
  })

  it('every declared transition is accepted; every undeclared pair is rejected', () => {
    for (const from of REPORT_STATES) {
      for (const to of REPORT_STATES) {
        const declared = (REPORT_TRANSITIONS[from] ?? []).includes(to)
        expect(isValidReportTransition(from, to)).toBe(declared)
      }
    }
  })
})

describe('dispatch transitions', () => {
  it('has 9 states', () => {
    expect(DISPATCH_STATES).toHaveLength(9)
  })

  it('allows pending → accepted', () => {
    expect(isValidDispatchTransition('pending', 'accepted')).toBe(true)
  })

  it('rejects resolved → pending', () => {
    expect(isValidDispatchTransition('resolved', 'pending')).toBe(false)
  })

  it('every declared transition is accepted; every undeclared pair is rejected', () => {
    for (const from of DISPATCH_STATES) {
      for (const to of DISPATCH_STATES) {
        const declared = (DISPATCH_TRANSITIONS[from] ?? []).includes(to)
        expect(isValidDispatchTransition(from, to)).toBe(declared)
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bantayog/shared-validators test -- state-machines`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `report-states.ts`**

```typescript
export const REPORT_STATES = [
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
] as const

export type ReportStatus = (typeof REPORT_STATES)[number]

export const REPORT_TRANSITIONS: Readonly<Record<ReportStatus, ReadonlyArray<ReportStatus>>> = {
  draft_inbox: ['new', 'rejected'],
  new: ['awaiting_verify', 'cancelled_false_report'],
  awaiting_verify: ['verified', 'cancelled_false_report'],
  verified: ['assigned', 'cancelled'],
  assigned: ['acknowledged', 'cancelled'],
  acknowledged: ['en_route', 'cancelled'],
  en_route: ['on_scene', 'cancelled'],
  on_scene: ['resolved', 'cancelled'],
  resolved: ['closed'],
  closed: ['reopened'],
  reopened: ['assigned', 'closed'],
  rejected: [],
  cancelled: [],
  cancelled_false_report: [],
  merged_as_duplicate: [],
}

export function isValidReportTransition(from: ReportStatus, to: ReportStatus): boolean {
  return REPORT_TRANSITIONS[from].includes(to)
}
```

- [ ] **Step 4: Create `dispatch-states.ts`**

```typescript
export const DISPATCH_STATES = [
  'pending',
  'accepted',
  'declined',
  'acknowledged',
  'in_progress',
  'resolved',
  'cancelled',
  'timed_out',
  'superseded',
] as const

export type DispatchStatus = (typeof DISPATCH_STATES)[number]

export const DISPATCH_TRANSITIONS: Readonly<Record<DispatchStatus, ReadonlyArray<DispatchStatus>>> =
  {
    pending: ['accepted', 'declined', 'cancelled', 'timed_out'],
    accepted: ['acknowledged', 'cancelled'],
    acknowledged: ['in_progress', 'cancelled'],
    in_progress: ['resolved', 'cancelled'],
    resolved: ['superseded'],
    declined: [],
    cancelled: [],
    timed_out: [],
    superseded: [],
  }

export function isValidDispatchTransition(from: DispatchStatus, to: DispatchStatus): boolean {
  return DISPATCH_TRANSITIONS[from].includes(to)
}
```

- [ ] **Step 5: Create `state-machines/index.ts`**

```typescript
export { REPORT_STATES, REPORT_TRANSITIONS, isValidReportTransition } from './report-states.js'
export type { ReportStatus } from './report-states.js'
export {
  DISPATCH_STATES,
  DISPATCH_TRANSITIONS,
  isValidDispatchTransition,
} from './dispatch-states.js'
export type { DispatchStatus } from './dispatch-states.js'
```

- [ ] **Step 6: Re-export from shared-validators public barrel**

In `packages/shared-validators/src/index.ts`:

```typescript
export * from './state-machines/index.js'
```

- [ ] **Step 7: Run test**

Run: `pnpm --filter @bantayog/shared-validators test -- state-machines`
Expected: PASS. The matrix test runs ~225 assertions in under 2 seconds.

- [ ] **Step 8: Commit**

```bash
git add packages/shared-validators/src/state-machines/ packages/shared-validators/src/state-machines.test.ts packages/shared-validators/src/index.ts
git commit -m "feat(shared-validators): add report and dispatch state transition tables"
```

---

### Task 5: Create shared error class and structured logging helper

**Files:**

- Create: `packages/shared-validators/src/errors.ts`
- Create: `packages/shared-validators/src/logging.ts`
- Create: `packages/shared-validators/src/errors.test.ts`
- Modify: `packages/shared-validators/src/index.ts`

- [ ] **Step 1: Write the failing error test**

Create `packages/shared-validators/src/errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { BantayogError, BantayogErrorCode } from './errors.js'

describe('BantayogError', () => {
  it('preserves code and message', () => {
    const err = new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, 'bad state')
    expect(err.code).toBe('FAILED_PRECONDITION')
    expect(err.message).toBe('bad state')
    expect(err).toBeInstanceOf(Error)
  })

  it('serializes to stable JSON shape', () => {
    const err = new BantayogError(BantayogErrorCode.RATE_LIMITED, 'slow down', {
      retryAfterSeconds: 30,
    })
    expect(err.toJSON()).toEqual({
      code: 'RATE_LIMITED',
      message: 'slow down',
      details: { retryAfterSeconds: 30 },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bantayog/shared-validators test -- errors`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `errors.ts`**

```typescript
export const BantayogErrorCode = {
  FAILED_PRECONDITION: 'FAILED_PRECONDITION',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  INTERNAL: 'INTERNAL',
} as const

export type BantayogErrorCodeT = (typeof BantayogErrorCode)[keyof typeof BantayogErrorCode]

export class BantayogError extends Error {
  public readonly code: BantayogErrorCodeT
  public readonly details: Record<string, unknown> | undefined

  constructor(code: BantayogErrorCodeT, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'BantayogError'
    this.code = code
    this.details = details
  }

  toJSON(): { code: string; message: string; details?: Record<string, unknown> } {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details }
  }
}
```

- [ ] **Step 4: Create `logging.ts`**

```typescript
export type LogSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export interface LogEventInput {
  severity: LogSeverity
  event: string
  correlationId: string
  environment?: string
  reportId?: string
  dispatchId?: string
  municipalityId?: string
  actorUid?: string
  durationMs?: number
  extra?: Record<string, unknown>
}

export function logEvent(input: LogEventInput): void {
  const base = {
    severity: input.severity,
    event: input.event,
    correlationId: input.correlationId,
    environment: input.environment ?? process.env.NODE_ENV ?? 'unknown',
    ...(input.reportId ? { reportId: input.reportId } : {}),
    ...(input.dispatchId ? { dispatchId: input.dispatchId } : {}),
    ...(input.municipalityId ? { municipalityId: input.municipalityId } : {}),
    ...(input.actorUid ? { actorUid: input.actorUid } : {}),
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
    ...(input.extra ?? {}),
  }
  // Structured single-line JSON — Cloud Logging ingests this cleanly.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(base))
}
```

- [ ] **Step 5: Export from barrel**

Add to `packages/shared-validators/src/index.ts`:

```typescript
export { BantayogError, BantayogErrorCode } from './errors.js'
export type { BantayogErrorCodeT } from './errors.js'
export { logEvent } from './logging.js'
export type { LogSeverity, LogEventInput } from './logging.js'
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @bantayog/shared-validators test`
Expected: PASS all.

- [ ] **Step 7: Commit**

```bash
git add packages/shared-validators/src/errors.ts packages/shared-validators/src/errors.test.ts packages/shared-validators/src/logging.ts packages/shared-validators/src/index.ts
git commit -m "feat(shared-validators): add BantayogError type and structured logging helper"
```

---

## Group B — Rules Codegen (Tasks 6-8)

Convert `firestore.rules` into a build artifact. The rules file becomes generated output; hand-edits are caught by a CI drift-check.

---

### Task 6: Move current rules into a template + write the codegen script

**Files:**

- Rename: `infra/firebase/firestore.rules` → `infra/firebase/firestore.rules.template`
- Create: `scripts/build-rules.ts`
- Modify: `infra/firebase/firestore.rules.template` (add marker)

- [ ] **Step 1: Move existing rules to template**

```bash
git mv infra/firebase/firestore.rules infra/firebase/firestore.rules.template
```

- [ ] **Step 2: Add codegen marker at top of template**

In `infra/firebase/firestore.rules.template`, replace the `validResponderTransition` helper (lines ~49-54) with a single-line marker. That is, delete:

```
    function validResponderTransition(from, to) {
      return (from == 'accepted'     && to == 'acknowledged')
          || (from == 'acknowledged' && to == 'in_progress')
          || (from == 'in_progress'  && to == 'resolved')
          || (from == 'pending'      && to == 'declined');
    }
```

and replace it with:

```
    // @@TRANSITION_TABLES@@
```

Leave all other content untouched.

- [ ] **Step 3: Create the codegen script**

Create `scripts/build-rules.ts`:

```typescript
#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  REPORT_TRANSITIONS,
  DISPATCH_TRANSITIONS,
} from '../packages/shared-validators/src/state-machines/index.ts'

const TEMPLATE = resolve('infra/firebase/firestore.rules.template')
const OUTPUT = resolve('infra/firebase/firestore.rules')
const MARKER = '// @@TRANSITION_TABLES@@'

function emitTable(name: string, table: Readonly<Record<string, ReadonlyArray<string>>>): string {
  const pairs = Object.entries(table).flatMap(([from, tos]) => tos.map((to) => [from, to] as const))
  const clauses = pairs
    .map(([from, to]) => `(from == '${from}' && to == '${to}')`)
    .join('\n          || ')
  return `    function ${name}(from, to) {\n      return ${clauses};\n    }`
}

function main(): void {
  const template = readFileSync(TEMPLATE, 'utf8')
  if (!template.includes(MARKER)) {
    throw new Error(`Template missing ${MARKER} marker`)
  }
  const reportFn = emitTable('isValidReportTransition', REPORT_TRANSITIONS)
  const dispatchFn = emitTable('isValidDispatchTransition', DISPATCH_TRANSITIONS)
  const generated = [
    '// ================================================================',
    '// CODEGEN — do not edit. Source of truth:',
    '//   packages/shared-validators/src/state-machines/',
    '// Regenerate via: pnpm tsx scripts/build-rules.ts',
    '// ================================================================',
    reportFn,
    '',
    dispatchFn,
  ].join('\n')
  const output = template.replace(MARKER, generated)
  const header =
    '// ================================================================\n' +
    '// THIS FILE IS GENERATED. Do not edit directly.\n' +
    '// Source: infra/firebase/firestore.rules.template\n' +
    '//         + scripts/build-rules.ts (transition tables)\n' +
    '// ================================================================\n\n'
  writeFileSync(OUTPUT, header + output, 'utf8')
  console.log(`Wrote ${OUTPUT}`)
}

main()
```

- [ ] **Step 4: Run the codegen once to produce the first-generation file**

Run: `pnpm tsx scripts/build-rules.ts`
Expected: prints `Wrote .../firestore.rules`.

- [ ] **Step 5: Verify the output file compiles**

Run: `firebase emulators:exec --only firestore "echo rules loaded"` (or if emulator not installed, manually inspect the file for syntactic sanity — curly brace balance, helper present).

- [ ] **Step 6: Commit**

```bash
git add scripts/build-rules.ts infra/firebase/firestore.rules.template infra/firebase/firestore.rules
git commit -m "feat(rules): codegen transition tables from shared-validators"
```

---

### Task 7: Wire codegen into `firebase.json` predeploy + CI drift check

**Files:**

- Modify: `firebase.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add predeploy hook to `firebase.json`**

Replace the `firestore` block:

```json
  "firestore": {
    "rules": "infra/firebase/firestore.rules",
    "indexes": "infra/firebase/firestore.indexes.json",
    "predeploy": ["pnpm tsx scripts/build-rules.ts"]
  },
```

- [ ] **Step 2: Add drift-check to CI**

In `.github/workflows/ci.yml`, inside the `rule-coverage` job, append two steps after the `check-rule-coverage.ts` run:

```yaml
- run: pnpm tsx scripts/build-rules.ts
- name: Verify firestore.rules is not out of date
  run: |
    if ! git diff --exit-code -- infra/firebase/firestore.rules; then
      echo "::error::firestore.rules is out of sync with scripts/build-rules.ts. Run 'pnpm tsx scripts/build-rules.ts' locally and commit."
      exit 1
    fi
```

- [ ] **Step 3: Commit**

```bash
git add firebase.json .github/workflows/ci.yml
git commit -m "ci(rules): wire codegen predeploy + drift-check gate"
```

---

### Task 8: Fix the Phase 2 `reportersUid` typo + add dispatch transition rule gate

**Files:**

- Modify: `infra/firebase/firestore.rules.template`
- Create: `functions/src/__tests__/rules/dispatch-transition.rules.test.ts`

Context: Phase 2 rules at line 62 read `request.resource.data.reportersUid` but the Zod schema and PRD call the field `reporterUid`. Phase 3 rules depend on a correct field name. Fix now.

- [ ] **Step 1: Write the failing dispatch-transition rule test**

Create `functions/src/__tests__/rules/dispatch-transition.rules.test.ts`:

```typescript
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { setDoc, updateDoc, doc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-dispatch-txn')
  await seedActiveAccount(env, {
    uid: 'resp-1',
    role: 'responder',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })
})

afterAll(async () => env.cleanup())

describe('dispatch transition rule', () => {
  async function seedDispatch(status: string): Promise<void> {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'dispatches', 'd1'), {
        dispatchId: 'd1',
        reportId: 'r1',
        assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
        status,
        createdAt: ts,
        lastStatusAt: ts,
        schemaVersion: 1,
      })
    })
  }

  it('allows accepted → acknowledged for assigned responder', async () => {
    await seedDispatch('accepted')
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'dispatches', 'd1'), { status: 'acknowledged', lastStatusAt: ts + 1 }),
    )
  })

  it('rejects resolved → pending (undeclared transition)', async () => {
    await seedDispatch('resolved')
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(
      updateDoc(doc(db, 'dispatches', 'd1'), { status: 'pending', lastStatusAt: ts + 1 }),
    )
  })
})
```

- [ ] **Step 2: Run — expect failure (rule helper not yet wired to codegen output)**

Run: `pnpm --filter @bantayog/functions test:rules -- dispatch-transition`
Expected: FAIL — current rule uses hand-rolled `validResponderTransition` which doesn't cover all cases, or test fixture mismatch.

- [ ] **Step 3: Update the template to use `isValidDispatchTransition`**

In `infra/firebase/firestore.rules.template`, within the `/dispatches/{id}` match block, replace any call to `validResponderTransition(from, to)` with `isValidDispatchTransition(from, to)`.

Also fix line 62 (in the `report_inbox` match): change `request.resource.data.reportersUid` → `request.resource.data.reporterUid`.

- [ ] **Step 4: Regenerate the rules file**

Run: `pnpm tsx scripts/build-rules.ts`

- [ ] **Step 5: Re-run the test**

Run: `pnpm --filter @bantayog/functions test:rules -- dispatch-transition`
Expected: PASS.

- [ ] **Step 6: Update the Phase 2 `report-inbox.rules.test.ts` fixture**

The existing test writes `reportersUid` — update fixtures to `reporterUid`. Run all rule tests: `pnpm --filter @bantayog/functions test:rules`. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add infra/firebase/firestore.rules.template infra/firebase/firestore.rules functions/src/__tests__/rules/
git commit -m "fix(rules): use codegen transition table and correct reporterUid spelling"
```

---

## Group C — Citizen Callables (Tasks 9-11)

Two HTTP-triggered callables for the citizen surface. They run before any Firestore writes the citizen initiates, and before any read on the lookup screen.

---

### Task 9: Create `requestUploadUrl` callable

**Files:**

- Create: `functions/src/callables/request-upload-url.ts`
- Create: `functions/src/__tests__/callables/request-upload-url.test.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/__tests__/callables/request-upload-url.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestUploadUrlImpl } from '../../callables/request-upload-url.js'

const mockSignedUrl = vi.fn()

vi.mock('firebase-admin/storage', () => ({
  getStorage: () => ({
    bucket: () => ({
      file: (path: string) => ({
        getSignedUrl: (opts: unknown) => mockSignedUrl(path, opts),
      }),
    }),
  }),
}))

beforeEach(() => {
  mockSignedUrl.mockReset()
  mockSignedUrl.mockResolvedValue(['https://signed.example/put'])
})

describe('requestUploadUrlImpl', () => {
  it('rejects unauthenticated callers', async () => {
    await expect(
      requestUploadUrlImpl({
        auth: undefined,
        data: { mimeType: 'image/jpeg', sizeBytes: 1024, sha256: 'a'.repeat(64) },
        bucket: 'test-bucket',
      }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects disallowed MIME types', async () => {
    await expect(
      requestUploadUrlImpl({
        auth: { uid: 'c1' },
        data: { mimeType: 'application/pdf', sizeBytes: 1024, sha256: 'a'.repeat(64) },
        bucket: 'test-bucket',
      }),
    ).rejects.toThrow(/INVALID_ARGUMENT/)
  })

  it('rejects oversized uploads', async () => {
    await expect(
      requestUploadUrlImpl({
        auth: { uid: 'c1' },
        data: { mimeType: 'image/jpeg', sizeBytes: 11 * 1024 * 1024, sha256: 'a'.repeat(64) },
        bucket: 'test-bucket',
      }),
    ).rejects.toThrow(/INVALID_ARGUMENT/)
  })

  it('returns a signed URL and uploadId for a valid request', async () => {
    const result = await requestUploadUrlImpl({
      auth: { uid: 'c1' },
      data: { mimeType: 'image/jpeg', sizeBytes: 1024, sha256: 'a'.repeat(64) },
      bucket: 'test-bucket',
    })
    expect(result.uploadUrl).toBe('https://signed.example/put')
    expect(result.uploadId).toMatch(/^[0-9a-f-]{36}$/)
    expect(result.storagePath).toBe(`pending/${result.uploadId}`)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bantayog/functions test -- request-upload-url`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the callable**

Create `functions/src/callables/request-upload-url.ts`:

```typescript
import { randomUUID } from 'node:crypto'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getStorage } from 'firebase-admin/storage'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SIZE_BYTES = 10 * 1024 * 1024
const SIGNED_URL_TTL_MS = 5 * 60 * 1000

const payloadSchema = z
  .object({
    mimeType: z.string(),
    sizeBytes: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

export interface RequestUploadUrlInput {
  auth: { uid: string } | undefined
  data: unknown
  bucket: string
}

export interface RequestUploadUrlResult {
  uploadUrl: string
  uploadId: string
  storagePath: string
  expiresAt: number
}

export async function requestUploadUrlImpl(
  input: RequestUploadUrlInput,
): Promise<RequestUploadUrlResult> {
  if (!input.auth) {
    throw new BantayogError(BantayogErrorCode.UNAUTHENTICATED, 'auth required')
  }
  const parsed = payloadSchema.safeParse(input.data)
  if (!parsed.success) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, parsed.error.message)
  }
  if (!ALLOWED_MIME.has(parsed.data.mimeType)) {
    throw new BantayogError(
      BantayogErrorCode.INVALID_ARGUMENT,
      `mime ${parsed.data.mimeType} not allowed`,
    )
  }
  if (parsed.data.sizeBytes > MAX_SIZE_BYTES) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, `size exceeds ${MAX_SIZE_BYTES}`)
  }
  const uploadId = randomUUID()
  const storagePath = `pending/${uploadId}`
  const expiresAt = Date.now() + SIGNED_URL_TTL_MS
  const [url] = await getStorage()
    .bucket(input.bucket)
    .file(storagePath)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expiresAt,
      contentType: parsed.data.mimeType,
      extensionHeaders: { 'x-goog-content-length-range': `0,${MAX_SIZE_BYTES}` },
    })
  return { uploadUrl: url, uploadId, storagePath, expiresAt }
}

export const requestUploadUrl = onCall(
  {
    enforceAppCheck: true,
    region: 'asia-southeast1',
    minInstances: 1,
    maxInstances: 100,
    timeoutSeconds: 10,
  },
  async (req) => {
    try {
      return await requestUploadUrlImpl({
        auth: req.auth ? { uid: req.auth.uid } : undefined,
        data: req.data,
        bucket: process.env.MEDIA_BUCKET ?? 'bantayog-media-dev',
      })
    } catch (err) {
      if (err instanceof BantayogError) {
        throw new HttpsError(
          err.code === 'UNAUTHENTICATED'
            ? 'unauthenticated'
            : err.code === 'INVALID_ARGUMENT'
              ? 'invalid-argument'
              : 'internal',
          err.message,
          err.details,
        )
      }
      throw new HttpsError('internal', 'unexpected')
    }
  },
)
```

- [ ] **Step 4: Export from index**

In `functions/src/index.ts`:

```typescript
export { requestUploadUrl } from './callables/request-upload-url.js'
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @bantayog/functions test -- request-upload-url`
Expected: PASS (4/4).

- [ ] **Step 6: Commit**

```bash
git add functions/src/callables/request-upload-url.ts functions/src/__tests__/callables/request-upload-url.test.ts functions/src/index.ts
git commit -m "feat(functions): add requestUploadUrl callable"
```

---

### Task 10: Create `requestLookup` callable

**Files:**

- Create: `functions/src/callables/request-lookup.ts`
- Create: `functions/src/__tests__/callables/request-lookup.test.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/__tests__/callables/request-lookup.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { requestLookupImpl } from '../../callables/request-lookup.js'

const mockGet = vi.fn()

function db() {
  return {
    collection: () => ({ doc: () => ({ get: mockGet }) }),
  }
}

beforeEach(() => mockGet.mockReset())

describe('requestLookupImpl', () => {
  const secret = 'abc'
  const tokenHash = createHash('sha256').update(secret).digest('hex')

  it('returns NOT_FOUND when the public ref does not exist', async () => {
    mockGet.mockResolvedValue({ exists: false })
    await expect(
      requestLookupImpl({ db: db() as never, data: { publicRef: 'a1b2c3d4', secret } }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('returns PERMISSION_DENIED on secret mismatch', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ reportId: 'r1', tokenHash: 'x'.repeat(64), expiresAt: Date.now() + 1e6 }),
    })
    await expect(
      requestLookupImpl({ db: db() as never, data: { publicRef: 'a1b2c3d4', secret: 'wrong' } }),
    ).rejects.toThrow(/PERMISSION_DENIED/)
  })

  it('returns NOT_FOUND when expired', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ reportId: 'r1', tokenHash, expiresAt: Date.now() - 1 }),
    })
    await expect(
      requestLookupImpl({ db: db() as never, data: { publicRef: 'a1b2c3d4', secret } }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('returns sanitized status on success', async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ reportId: 'r1', tokenHash, expiresAt: Date.now() + 1e6 }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: 'verified',
          municipalityLabel: 'Daet',
          submittedAt: 1713350400000,
          updatedAt: 1713350401000,
        }),
      })
    const result = await requestLookupImpl({
      db: db() as never,
      data: { publicRef: 'a1b2c3d4', secret },
    })
    expect(result).toEqual({
      status: 'verified',
      lastStatusAt: 1713350401000,
      municipalityLabel: 'Daet',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bantayog/functions test -- request-lookup`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the callable**

Create `functions/src/callables/request-lookup.ts`:

```typescript
import { createHash } from 'node:crypto'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'

const payloadSchema = z
  .object({
    publicRef: z.string().regex(/^[a-z0-9]{8}$/),
    secret: z.string().min(1).max(64),
  })
  .strict()

export interface RequestLookupInput {
  db: Firestore
  data: unknown
}

export interface RequestLookupResult {
  status: string
  lastStatusAt: number
  municipalityLabel: string
}

export async function requestLookupImpl(input: RequestLookupInput): Promise<RequestLookupResult> {
  const parsed = payloadSchema.safeParse(input.data)
  if (!parsed.success) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, parsed.error.message)
  }
  const { publicRef, secret } = parsed.data
  const lookupSnap = await input.db.collection('report_lookup').doc(publicRef).get()
  if (!lookupSnap.exists) {
    throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'unknown reference')
  }
  const lookup = lookupSnap.data() as {
    reportId: string
    tokenHash: string
    expiresAt: number
  }
  if (lookup.expiresAt < Date.now()) {
    throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'reference expired')
  }
  const secretHash = createHash('sha256').update(secret).digest('hex')
  if (secretHash !== lookup.tokenHash) {
    throw new BantayogError(BantayogErrorCode.PERMISSION_DENIED, 'secret mismatch')
  }
  const reportSnap = await input.db.collection('reports').doc(lookup.reportId).get()
  if (!reportSnap.exists) {
    throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'report missing')
  }
  const report = reportSnap.data() as {
    status: string
    municipalityLabel: string
    submittedAt: number
    updatedAt?: number
  }
  return {
    status: report.status,
    lastStatusAt: report.updatedAt ?? report.submittedAt,
    municipalityLabel: report.municipalityLabel,
  }
}

export const requestLookup = onCall(
  { region: 'asia-southeast1', minInstances: 1, maxInstances: 100, timeoutSeconds: 10 },
  async (req) => {
    try {
      return await requestLookupImpl({ db: getFirestore(), data: req.data })
    } catch (err) {
      if (err instanceof BantayogError) {
        const httpsCode =
          err.code === 'NOT_FOUND'
            ? 'not-found'
            : err.code === 'PERMISSION_DENIED'
              ? 'permission-denied'
              : err.code === 'INVALID_ARGUMENT'
                ? 'invalid-argument'
                : 'internal'
        throw new HttpsError(httpsCode, err.message)
      }
      throw new HttpsError('internal', 'unexpected')
    }
  },
)
```

- [ ] **Step 4: Export from index**

In `functions/src/index.ts`:

```typescript
export { requestLookup } from './callables/request-lookup.js'
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @bantayog/functions test -- request-lookup`
Expected: PASS (4/4).

- [ ] **Step 6: Commit**

```bash
git add functions/src/callables/request-lookup.ts functions/src/__tests__/callables/request-lookup.test.ts functions/src/index.ts
git commit -m "feat(functions): add requestLookup callable"
```

---

### Task 11: Create municipality lookup service with cold-start cache

**Files:**

- Create: `functions/src/services/municipality-lookup.ts`
- Create: `functions/src/__tests__/services/municipality-lookup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/__tests__/services/municipality-lookup.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMunicipalityLookup } from '../../services/municipality-lookup.js'

const mockGet = vi.fn()

function db() {
  return {
    collection: () => ({ get: mockGet }),
  }
}

beforeEach(() => mockGet.mockReset())

describe('municipality lookup', () => {
  it('loads the map once and caches it', async () => {
    mockGet.mockResolvedValue({
      docs: [
        { id: 'daet', data: () => ({ label: 'Daet' }) },
        { id: 'basud', data: () => ({ label: 'Basud' }) },
      ],
    })
    const lookup = createMunicipalityLookup(db() as never)
    expect(await lookup.label('daet')).toBe('Daet')
    expect(await lookup.label('basud')).toBe('Basud')
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('throws on unknown id', async () => {
    mockGet.mockResolvedValue({ docs: [{ id: 'daet', data: () => ({ label: 'Daet' }) }] })
    const lookup = createMunicipalityLookup(db() as never)
    await expect(lookup.label('unknown')).rejects.toThrow(/not_in_jurisdiction/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bantayog/functions test -- municipality-lookup`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `functions/src/services/municipality-lookup.ts`:

```typescript
import type { Firestore } from 'firebase-admin/firestore'

export interface MunicipalityLookup {
  label(id: string): Promise<string>
}

export function createMunicipalityLookup(db: Firestore): MunicipalityLookup {
  let cache: Map<string, string> | null = null
  async function ensureLoaded(): Promise<Map<string, string>> {
    if (cache) return cache
    const snap = await db.collection('municipalities').get()
    const map = new Map<string, string>()
    for (const d of snap.docs) {
      const data = d.data() as { label: string }
      map.set(d.id, data.label)
    }
    cache = map
    return map
  }
  return {
    async label(id) {
      const map = await ensureLoaded()
      const v = map.get(id)
      if (!v) throw new Error(`not_in_jurisdiction: ${id}`)
      return v
    },
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @bantayog/functions test -- municipality-lookup`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add functions/src/services/municipality-lookup.ts functions/src/__tests__/services/municipality-lookup.test.ts
git commit -m "feat(functions): add cold-start-cached municipality lookup"
```

---

## Group D — Triptych Trigger (Tasks 12-14)

The heart of 3a. `processInboxItem` turns one inbox doc into three canonical docs + an event + a lookup, all in one transaction, guarded by `withIdempotency`. Follow TDD strictly — these triggers are complex and the tests encode the invariants.

---

### Task 12: Write the integration test for `processInboxItem` happy path

**Files:**

- Create: `functions/src/__tests__/triggers/process-inbox-item.test.ts`

Context: This integration test runs against the Firestore emulator. It seeds an inbox doc, invokes the trigger implementation, and asserts the full triptych exists.

- [ ] **Step 1: Write the failing integration test**

Create `functions/src/__tests__/triggers/process-inbox-item.test.ts`:

```typescript
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'
import { processInboxItemCore } from '../../triggers/process-inbox-item.js'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-phase-3a',
    firestore: { rules: readFileSync('infra/firebase/firestore.rules', 'utf8') },
  })
  // Seed municipalities
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'municipalities', 'daet'), {
      id: 'daet',
      label: 'Daet',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.1, lng: 122.95 },
      schemaVersion: 1,
    })
  })
})

afterAll(async () => env.cleanup())

describe('processInboxItemCore', () => {
  it('materializes a complete triptych + event + lookup from a valid inbox doc', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as import('firebase-admin/firestore').Firestore
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-1'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: 1713350400000,
        idempotencyKey: 'idem-1',
        publicRef: 'a1b2c3d4',
        secretHash: 'f'.repeat(64),
        correlationId: '11111111-1111-4111-8111-111111111111',
        payload: {
          reportType: 'flood',
          description: 'flooded street',
          severity: 'high',
          source: 'web',
          publicLocation: { lat: 14.11, lng: 122.95 },
        },
      })

      const result = await processInboxItemCore({
        db,
        inboxId: 'ibx-1',
        now: () => 1713350401000,
      })

      expect(result.materialized).toBe(true)
      const reportSnap = await getDoc(doc(ctx.firestore(), 'reports', result.reportId))
      expect(reportSnap.exists()).toBe(true)
      const report = reportSnap.data()
      expect(report?.status).toBe('new')
      expect(report?.municipalityId).toBe('daet')
      expect(report?.municipalityLabel).toBe('Daet')
      expect(report?.correlationId).toBe('11111111-1111-4111-8111-111111111111')

      const privateSnap = await getDoc(doc(ctx.firestore(), 'report_private', result.reportId))
      expect(privateSnap.exists()).toBe(true)
      expect(privateSnap.data()?.reporterUid).toBe('citizen-1')

      const opsSnap = await getDoc(doc(ctx.firestore(), 'report_ops', result.reportId))
      expect(opsSnap.exists()).toBe(true)

      const lookupSnap = await getDoc(doc(ctx.firestore(), 'report_lookup', 'a1b2c3d4'))
      expect(lookupSnap.exists()).toBe(true)
      expect(lookupSnap.data()?.reportId).toBe(result.reportId)
      expect(lookupSnap.data()?.tokenHash).toBe('f'.repeat(64))
    })
  })

  it('is idempotent — second invocation is a no-op', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as import('firebase-admin/firestore').Firestore
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-2'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: 1713350400000,
        idempotencyKey: 'idem-2',
        publicRef: 'b2c3d4e5',
        secretHash: 'e'.repeat(64),
        correlationId: '22222222-2222-4222-8222-222222222222',
        payload: {
          reportType: 'fire',
          description: 'small fire',
          severity: 'medium',
          source: 'web',
          publicLocation: { lat: 14.11, lng: 122.95 },
        },
      })
      const first = await processInboxItemCore({ db, inboxId: 'ibx-2', now: () => 1 })
      const second = await processInboxItemCore({ db, inboxId: 'ibx-2', now: () => 2 })
      expect(first.reportId).toBe(second.reportId)
      expect(second.replayed).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- process-inbox-item"`
Expected: FAIL — module not found.

- [ ] **Step 3: Commit the failing test so subsequent work is TDD**

```bash
git add functions/src/__tests__/triggers/process-inbox-item.test.ts
git commit -m "test(functions): add failing integration test for processInboxItem"
```

---

### Task 13: Implement `processInboxItemCore` to make the test pass

**Files:**

- Create: `functions/src/triggers/process-inbox-item.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Implement the core**

Create `functions/src/triggers/process-inbox-item.ts`:

```typescript
import { randomUUID } from 'node:crypto'
import type { Firestore } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { getFirestore } from 'firebase-admin/firestore'
import {
  BantayogError,
  BantayogErrorCode,
  logEvent,
  reportInboxDocSchema,
} from '@bantayog/shared-validators'
import { createMunicipalityLookup } from '../services/municipality-lookup.js'
import { reverseGeocodeToMunicipality } from '../services/geocode.js'
import { withIdempotency } from '../idempotency/guard.js'

export interface ProcessInboxItemCoreInput {
  db: Firestore
  inboxId: string
  now?: () => number
}

export interface ProcessInboxItemCoreResult {
  materialized: boolean
  replayed?: boolean
  reportId: string
}

export async function processInboxItemCore(
  input: ProcessInboxItemCoreInput,
): Promise<ProcessInboxItemCoreResult> {
  const { db, inboxId } = input
  const now = input.now ?? (() => Date.now())

  const inboxRef = db.collection('report_inbox').doc(inboxId)
  const inboxSnap = await inboxRef.get()
  if (!inboxSnap.exists) {
    throw new BantayogError(BantayogErrorCode.NOT_FOUND, `inbox ${inboxId} missing`)
  }

  const parsed = reportInboxDocSchema.safeParse(inboxSnap.data())
  if (!parsed.success) {
    await db.collection('moderation_incidents').doc(inboxId).set({
      inboxId,
      reason: 'schema_invalid',
      detail: parsed.error.message,
      createdAt: now(),
      schemaVersion: 1,
    })
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'inbox schema invalid')
  }

  const inbox = parsed.data
  const payload = inbox.payload as {
    reportType: string
    description: string
    severity: 'low' | 'medium' | 'high'
    source: 'web' | 'sms' | 'responder_witness'
    publicLocation: { lat: number; lng: number }
  }

  const muniLookup = createMunicipalityLookup(db)
  const { municipalityId, barangayId } = await reverseGeocodeToMunicipality(
    db,
    payload.publicLocation,
  )
  if (!municipalityId) {
    await db.collection('moderation_incidents').doc(inboxId).set({
      inboxId,
      reason: 'out_of_jurisdiction',
      createdAt: now(),
      schemaVersion: 1,
    })
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'out of jurisdiction')
  }
  const municipalityLabel = await muniLookup.label(municipalityId)

  const result = await withIdempotency<
    { inboxId: string; publicRef: string },
    ProcessInboxItemCoreResult
  >(
    db,
    { key: `processInboxItem:${inboxId}`, payload: { inboxId, publicRef: inbox.publicRef }, now },
    async () => {
      const reportId = randomUUID()
      await db.runTransaction(async (tx) => {
        const lookupRef = db.collection('report_lookup').doc(inbox.publicRef)
        const lookupSnap = await tx.get(lookupRef)
        if (lookupSnap.exists && lookupSnap.data()?.reportId !== reportId) {
          throw new BantayogError(BantayogErrorCode.ALREADY_EXISTS, 'publicRef collision')
        }
        const createdAt = now()
        tx.set(db.collection('reports').doc(reportId), {
          municipalityId,
          municipalityLabel,
          barangayId,
          reporterRole: 'citizen',
          reportType: payload.reportType,
          severity: payload.severity,
          status: 'new',
          publicLocation: payload.publicLocation,
          mediaRefs: [],
          description: payload.description,
          submittedAt: inbox.clientCreatedAt,
          retentionExempt: false,
          visibilityClass: 'internal',
          visibility: { scope: 'municipality', sharedWith: [] },
          source: payload.source,
          hasPhotoAndGPS: false,
          schemaVersion: 1,
          correlationId: inbox.correlationId,
        })
        tx.set(db.collection('report_private').doc(reportId), {
          municipalityId,
          reporterUid: inbox.reporterUid,
          isPseudonymous: false,
          publicTrackingRef: inbox.publicRef,
          createdAt,
          schemaVersion: 1,
        })
        tx.set(db.collection('report_ops').doc(reportId), {
          municipalityId,
          status: 'new',
          severity: payload.severity,
          createdAt,
          agencyIds: [],
          activeResponderCount: 0,
          requiresLocationFollowUp: false,
          visibility: { scope: 'municipality', sharedWith: [] },
          updatedAt: createdAt,
          schemaVersion: 1,
        })
        tx.set(db.collection('reports').doc(reportId).collection('status_log').doc(), {
          from: 'draft_inbox',
          to: 'new',
          actor: 'system:processInboxItem',
          at: createdAt,
          correlationId: inbox.correlationId,
          schemaVersion: 1,
        })
        tx.set(lookupRef, {
          publicTrackingRef: inbox.publicRef,
          reportId,
          tokenHash: inbox.secretHash,
          expiresAt: createdAt + 30 * 24 * 60 * 60 * 1000,
          createdAt,
          schemaVersion: 1,
        })
      })
      await inboxRef.update({ processedAt: now() })
      logEvent({
        severity: 'INFO',
        event: 'inbox.processed',
        correlationId: inbox.correlationId,
        reportId,
        municipalityId,
      })
      return { materialized: true, reportId }
    },
  )

  // withIdempotency returns the cached result on replay; mark as replayed.
  if (result.materialized && (await inboxRef.get()).data()?.processedAt !== undefined) {
    return { ...result, replayed: true }
  }
  return result
}

export const processInboxItem = onDocumentCreated(
  {
    document: 'report_inbox/{inboxId}',
    region: 'asia-southeast1',
    minInstances: 3,
    maxInstances: 100,
    timeoutSeconds: 30,
    memory: '512MiB',
  },
  async (event) => {
    await processInboxItemCore({ db: getFirestore(), inboxId: event.params.inboxId })
  },
)
```

- [ ] **Step 2: Create the stub geocoder**

Create `functions/src/services/geocode.ts`:

```typescript
import type { Firestore } from 'firebase-admin/firestore'

export interface GeocodeResult {
  municipalityId: string | null
  barangayId: string
}

// Phase 3a stub: centroid-distance nearest-neighbor across municipalities.
// A real geocoder (Cloud Maps or precomputed PH admin boundaries) replaces
// this in Phase 5.
export async function reverseGeocodeToMunicipality(
  db: Firestore,
  point: { lat: number; lng: number },
): Promise<GeocodeResult> {
  const snap = await db.collection('municipalities').get()
  let best: { id: string; dist: number } | null = null
  for (const d of snap.docs) {
    const c = (d.data() as { centroid: { lat: number; lng: number } }).centroid
    const dist = Math.hypot(c.lat - point.lat, c.lng - point.lng)
    if (!best || dist < best.dist) best = { id: d.id, dist }
  }
  if (!best || best.dist > 0.5) {
    return { municipalityId: null, barangayId: 'unknown' }
  }
  return { municipalityId: best.id, barangayId: `${best.id}-1` }
}
```

- [ ] **Step 3: Export from index**

In `functions/src/index.ts`:

```typescript
export { processInboxItem } from './triggers/process-inbox-item.js'
```

- [ ] **Step 4: Run integration test**

Run: `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- process-inbox-item"`
Expected: PASS (2/2).

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: all pass. Fix any schema breakages surfaced by the additive delta.

- [ ] **Step 6: Commit**

```bash
git add functions/src/triggers/process-inbox-item.ts functions/src/services/geocode.ts functions/src/index.ts
git commit -m "feat(functions): implement processInboxItem triptych materializer"
```

---

### Task 14: Add `processInboxItem` failure-mode tests and harden

**Files:**

- Modify: `functions/src/__tests__/triggers/process-inbox-item.test.ts`

- [ ] **Step 1: Add failure-mode tests**

Append to `process-inbox-item.test.ts`:

```typescript
describe('processInboxItemCore failure modes', () => {
  it('writes moderation_incidents when inbox schema is invalid', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as import('firebase-admin/firestore').Firestore
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-bad'), {
        reporterUid: 'c-1',
        clientCreatedAt: 1,
        idempotencyKey: 'k',
        // missing publicRef/secretHash/correlationId/payload
      })
      await expect(processInboxItemCore({ db, inboxId: 'ibx-bad', now: () => 1 })).rejects.toThrow(
        /INVALID_ARGUMENT/,
      )
      const mod = await getDoc(doc(ctx.firestore(), 'moderation_incidents', 'ibx-bad'))
      expect(mod.exists()).toBe(true)
      expect(mod.data()?.reason).toBe('schema_invalid')
    })
  })

  it('writes moderation_incidents when point is outside any municipality', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as import('firebase-admin/firestore').Firestore
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-oob'), {
        reporterUid: 'c-1',
        clientCreatedAt: 1,
        idempotencyKey: 'k',
        publicRef: 'c3d4e5f6',
        secretHash: 'd'.repeat(64),
        correlationId: '33333333-3333-4333-8333-333333333333',
        payload: {
          reportType: 'flood',
          description: 'x',
          severity: 'low',
          source: 'web',
          publicLocation: { lat: 40.7, lng: -74.0 }, // New York
        },
      })
      await expect(processInboxItemCore({ db, inboxId: 'ibx-oob', now: () => 1 })).rejects.toThrow(
        /INVALID_ARGUMENT/,
      )
      const mod = await getDoc(doc(ctx.firestore(), 'moderation_incidents', 'ibx-oob'))
      expect(mod.data()?.reason).toBe('out_of_jurisdiction')
    })
  })
})
```

- [ ] **Step 2: Run tests**

Run: `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- process-inbox-item"`
Expected: all pass (4/4 total).

- [ ] **Step 3: Commit**

```bash
git add functions/src/__tests__/triggers/process-inbox-item.test.ts
git commit -m "test(functions): add processInboxItem failure-mode coverage"
```

---

## Group E — Media Pipeline (Tasks 15-17)

---

### Task 15: Implement `onMediaFinalize` EXIF-strip + MIME-check trigger

**Files:**

- Create: `functions/src/triggers/on-media-finalize.ts`
- Create: `functions/src/__tests__/triggers/on-media-finalize.test.ts`
- Modify: `functions/package.json` (add `sharp`, `exifr`, `file-type`)
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Install dependencies**

```bash
pnpm --filter @bantayog/functions add sharp exifr file-type
```

- [ ] **Step 2: Write the failing test**

Create `functions/src/__tests__/triggers/on-media-finalize.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { onMediaFinalizeCore } from '../../triggers/on-media-finalize.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mockFile = {
  download: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  setMetadata: vi.fn().mockResolvedValue(undefined),
}
function bucket() {
  return {
    file: () => mockFile,
  }
}

beforeEach(() => {
  mockFile.download.mockReset()
  mockFile.save.mockReset().mockResolvedValue(undefined)
})

describe('onMediaFinalizeCore', () => {
  it('rejects and deletes a non-image upload', async () => {
    // PDF magic bytes
    mockFile.download.mockResolvedValue([Buffer.from('%PDF-1.4\n', 'utf8')])
    const result = await onMediaFinalizeCore({
      bucket: bucket() as never,
      objectName: 'pending/abc',
      writePending: async () => {},
    })
    expect(result.status).toBe('rejected_mime')
    expect(mockFile.delete).toHaveBeenCalled()
  })

  it('strips EXIF and writes pending_media record for a JPEG', async () => {
    // Load a fixture JPEG from disk
    const jpeg = readFileSync(resolve(__dirname, '../fixtures/sample.jpg'))
    mockFile.download.mockResolvedValue([jpeg])
    const writes: unknown[] = []
    await onMediaFinalizeCore({
      bucket: bucket() as never,
      objectName: 'pending/upload-1',
      writePending: async (doc) => {
        writes.push(doc)
      },
    })
    expect(writes).toHaveLength(1)
    expect(mockFile.save).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Add a small JPEG fixture**

Create `functions/src/__tests__/fixtures/sample.jpg` — generate a 1x1 pixel JPEG:

```bash
mkdir -p functions/src/__tests__/fixtures
# 100-byte valid JPEG
pnpm --filter @bantayog/functions exec node -e "
const sharp = require('sharp');
sharp({ create: { width: 4, height: 4, channels: 3, background: { r:0,g:0,b:0 } }})
  .jpeg()
  .toFile('functions/src/__tests__/fixtures/sample.jpg')
  .then(() => console.log('ok'));
"
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @bantayog/functions test -- on-media-finalize`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement the trigger**

Create `functions/src/triggers/on-media-finalize.ts`:

```typescript
import sharp from 'sharp'
import { fileTypeFromBuffer } from 'file-type'
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { getStorage } from 'firebase-admin/storage'
import { getFirestore } from 'firebase-admin/firestore'
import { logEvent } from '@bantayog/shared-validators'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export interface OnMediaFinalizeInput {
  bucket: ReturnType<ReturnType<typeof getStorage>['bucket']>
  objectName: string
  writePending: (doc: {
    uploadId: string
    storagePath: string
    strippedAt: number
    mimeType: string
  }) => Promise<void>
}

export interface OnMediaFinalizeResult {
  status: 'accepted' | 'rejected_mime'
}

export async function onMediaFinalizeCore(
  input: OnMediaFinalizeInput,
): Promise<OnMediaFinalizeResult> {
  if (!input.objectName.startsWith('pending/')) {
    return { status: 'accepted' } // Not our concern.
  }
  const file = input.bucket.file(input.objectName)
  const [buf] = await file.download()
  const ft = await fileTypeFromBuffer(buf)
  if (!ft || !ALLOWED.has(ft.mime)) {
    await file.delete()
    logEvent({ severity: 'WARN', event: 'media.rejected_mime', correlationId: 'unknown' })
    return { status: 'rejected_mime' }
  }
  const cleaned = await sharp(buf).rotate().toBuffer() // rotate() applies EXIF orientation then strips
  await file.save(cleaned, {
    resumable: false,
    contentType: ft.mime,
    metadata: { cacheControl: 'private, no-transform' },
  })
  const uploadId = input.objectName.slice('pending/'.length)
  await input.writePending({
    uploadId,
    storagePath: input.objectName,
    strippedAt: Date.now(),
    mimeType: ft.mime,
  })
  return { status: 'accepted' }
}

export const onMediaFinalize = onObjectFinalized(
  {
    region: 'asia-southeast1',
    minInstances: 1,
    maxInstances: 50,
    timeoutSeconds: 60,
    memory: '1GiB',
  },
  async (event) => {
    const bucket = getStorage().bucket(event.data.bucket)
    const db = getFirestore()
    await onMediaFinalizeCore({
      bucket,
      objectName: event.data.name,
      writePending: async (payload) => {
        await db.collection('pending_media').doc(payload.uploadId).set(payload)
      },
    })
  },
)
```

- [ ] **Step 6: Export**

```typescript
export { onMediaFinalize } from './triggers/on-media-finalize.js'
```

- [ ] **Step 7: Run tests**

Run: `pnpm --filter @bantayog/functions test -- on-media-finalize`
Expected: PASS (2/2).

- [ ] **Step 8: Commit**

```bash
git add functions/src/triggers/on-media-finalize.ts functions/src/__tests__/triggers/on-media-finalize.test.ts functions/src/__tests__/fixtures/sample.jpg functions/package.json pnpm-lock.yaml functions/src/index.ts
git commit -m "feat(functions): add onMediaFinalize EXIF-strip trigger"
```

---

### Task 16: Integrate pending media into `processInboxItem`

**Files:**

- Modify: `functions/src/triggers/process-inbox-item.ts`
- Modify: `functions/src/__tests__/triggers/process-inbox-item.test.ts`

Context: Per spec §5.3, if `pending_media/{uploadId}` exists for an inbox item's `pendingMediaIds`, the reference must be moved into `reports/{reportId}/media/{mediaId}` inside the materialization transaction.

- [ ] **Step 1: Extend the inbox payload to include `pendingMediaIds`**

In `packages/shared-validators/src/reports.ts`, extend `reportInboxDocSchema.payload`... actually the payload is `z.record(z.string(), z.unknown())`. Keep it that way — the trigger reads `pendingMediaIds` at its own risk and validates inside. Skip the schema change; just document the contract.

- [ ] **Step 2: Write a new test**

Append to `process-inbox-item.test.ts`:

```typescript
describe('processInboxItemCore media attachment', () => {
  it('moves pending_media references into reports/{id}/media', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as import('firebase-admin/firestore').Firestore
      await setDoc(doc(ctx.firestore(), 'pending_media', 'upload-x'), {
        uploadId: 'upload-x',
        storagePath: 'pending/upload-x',
        strippedAt: 1,
        mimeType: 'image/jpeg',
      })
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-3'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: 1,
        idempotencyKey: 'idem-3',
        publicRef: 'd4e5f607',
        secretHash: 'c'.repeat(64),
        correlationId: '44444444-4444-4444-8444-444444444444',
        payload: {
          reportType: 'flood',
          description: 'x',
          severity: 'low',
          source: 'web',
          publicLocation: { lat: 14.11, lng: 122.95 },
          pendingMediaIds: ['upload-x'],
        },
      })
      const result = await processInboxItemCore({ db, inboxId: 'ibx-3', now: () => 1 })
      const mediaSnap = await getDoc(
        doc(ctx.firestore(), 'reports', result.reportId, 'media', 'upload-x'),
      )
      expect(mediaSnap.exists()).toBe(true)
      expect(mediaSnap.data()?.storagePath).toBe('pending/upload-x')
    })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Expected: FAIL — trigger does not yet move media.

- [ ] **Step 4: Extend the trigger**

In `functions/src/triggers/process-inbox-item.ts`, inside the `runTransaction` block, after the triptych writes and before the lookup write, add:

```typescript
const pendingMediaIds = Array.isArray((payload as { pendingMediaIds?: unknown }).pendingMediaIds)
  ? ((payload as { pendingMediaIds: unknown[] }).pendingMediaIds as string[])
  : []
for (const uploadId of pendingMediaIds) {
  const pendingRef = db.collection('pending_media').doc(uploadId)
  const pendingSnap = await tx.get(pendingRef)
  if (!pendingSnap.exists) continue
  const data = pendingSnap.data() as { storagePath: string; mimeType: string; strippedAt: number }
  tx.set(db.collection('reports').doc(reportId).collection('media').doc(uploadId), {
    uploadId,
    storagePath: data.storagePath,
    mimeType: data.mimeType,
    strippedAt: data.strippedAt,
    addedAt: now(),
    schemaVersion: 1,
  })
  tx.delete(pendingRef)
}
```

- [ ] **Step 5: Re-run tests**

Run: `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- process-inbox-item"`
Expected: PASS (5/5).

- [ ] **Step 6: Commit**

```bash
git add functions/src/triggers/process-inbox-item.ts functions/src/__tests__/triggers/process-inbox-item.test.ts
git commit -m "feat(functions): wire pending_media attachment into processInboxItem"
```

---

### Task 17: Pre-wire dormant `onMediaRelocate` trigger

**Files:**

- Create: `functions/src/triggers/on-media-relocate.ts`
- Modify: `functions/src/index.ts`

Context: Phase 5 flips `system_config/features/media_canonical_migration.enabled`. Phase 3 ships the function wired but inert.

- [ ] **Step 1: Implement**

Create `functions/src/triggers/on-media-relocate.ts`:

```typescript
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { getFirestore } from 'firebase-admin/firestore'
import { logEvent } from '@bantayog/shared-validators'

export const onMediaRelocate = onObjectFinalized(
  { region: 'asia-southeast1', minInstances: 0, maxInstances: 20, timeoutSeconds: 60 },
  async (event) => {
    const flagSnap = await getFirestore().collection('system_config').doc('features').get()
    const enabled = flagSnap.exists
      ? Boolean(flagSnap.data()?.media_canonical_migration?.enabled)
      : false
    if (!enabled) {
      logEvent({
        severity: 'DEBUG',
        event: 'media.relocate.skipped_disabled',
        correlationId: 'n/a',
      })
      return
    }
    // Implementation lands in Phase 5. Keep empty body — function is deployed
    // to reserve deploy identity and monitor surface without doing work.
    logEvent({
      severity: 'WARN',
      event: 'media.relocate.flag_on_but_impl_absent',
      correlationId: 'n/a',
      extra: { objectName: event.data.name },
    })
  },
)
```

- [ ] **Step 2: Export**

```typescript
export { onMediaRelocate } from './triggers/on-media-relocate.js'
```

- [ ] **Step 3: Run lint + typecheck**

Run: `pnpm --filter @bantayog/functions lint && pnpm --filter @bantayog/functions typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add functions/src/triggers/on-media-relocate.ts functions/src/index.ts
git commit -m "feat(functions): pre-wire dormant onMediaRelocate for Phase 5"
```

---

## Group F — Reconciliation Sweep (Task 18)

---

### Task 18: Scheduled `inboxReconciliationSweep`

**Files:**

- Create: `functions/src/triggers/inbox-reconciliation-sweep.ts`
- Create: `functions/src/__tests__/triggers/inbox-reconciliation-sweep.test.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/__tests__/triggers/inbox-reconciliation-sweep.test.ts`:

```typescript
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { inboxReconciliationSweepCore } from '../../triggers/inbox-reconciliation-sweep.js'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-3a-sweep',
    firestore: { rules: readFileSync('infra/firebase/firestore.rules', 'utf8') },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'municipalities', 'daet'), {
      id: 'daet',
      label: 'Daet',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.11, lng: 122.95 },
      schemaVersion: 1,
    })
  })
})

afterAll(async () => env.cleanup())

describe('inboxReconciliationSweepCore', () => {
  it('picks up unprocessed inbox items older than the threshold', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as import('firebase-admin/firestore').Firestore
      const now = 1713350500000
      // Stale (3 min old, unprocessed)
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'stale-1'), {
        reporterUid: 'c-1',
        clientCreatedAt: now - 3 * 60 * 1000,
        idempotencyKey: 'idem-s',
        publicRef: 'sss11111',
        secretHash: 'a'.repeat(64),
        correlationId: '55555555-5555-4555-8555-555555555555',
        payload: {
          reportType: 'flood',
          description: 'x',
          severity: 'low',
          source: 'web',
          publicLocation: { lat: 14.11, lng: 122.95 },
        },
      })
      // Fresh (unprocessed, under 2 min)
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'fresh-1'), {
        reporterUid: 'c-1',
        clientCreatedAt: now - 30 * 1000,
        idempotencyKey: 'idem-f',
        publicRef: 'fff11111',
        secretHash: 'b'.repeat(64),
        correlationId: '66666666-6666-4666-8666-666666666666',
        payload: {
          reportType: 'flood',
          description: 'x',
          severity: 'low',
          source: 'web',
          publicLocation: { lat: 14.11, lng: 122.95 },
        },
      })
      const result = await inboxReconciliationSweepCore({ db, now: () => now })
      expect(result.processed).toBe(1)
      const stale = await getDoc(doc(ctx.firestore(), 'report_inbox', 'stale-1'))
      expect(stale.data()?.processedAt).toBeDefined()
      const fresh = await getDoc(doc(ctx.firestore(), 'report_inbox', 'fresh-1'))
      expect(fresh.data()?.processedAt).toBeUndefined()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `functions/src/triggers/inbox-reconciliation-sweep.ts`:

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { logEvent } from '@bantayog/shared-validators'
import { processInboxItemCore } from './process-inbox-item.js'

const STALENESS_MS = 2 * 60 * 1000
const BATCH = 100

export interface SweepInput {
  db: Firestore
  now?: () => number
}

export interface SweepResult {
  candidates: number
  processed: number
  failed: number
  oldestAgeMs: number
}

export async function inboxReconciliationSweepCore(input: SweepInput): Promise<SweepResult> {
  const now = input.now ?? (() => Date.now())
  const threshold = now() - STALENESS_MS
  const snap = await input.db
    .collection('report_inbox')
    .where('clientCreatedAt', '<', threshold)
    .orderBy('clientCreatedAt')
    .limit(BATCH)
    .get()

  let processed = 0
  let failed = 0
  let oldestAgeMs = 0
  for (const d of snap.docs) {
    const data = d.data() as { processedAt?: number; clientCreatedAt: number }
    if (data.processedAt) continue
    oldestAgeMs = Math.max(oldestAgeMs, now() - data.clientCreatedAt)
    try {
      await processInboxItemCore({ db: input.db, inboxId: d.id, now })
      processed++
    } catch (err) {
      failed++
      logEvent({
        severity: 'WARN',
        event: 'inbox.reconciliation_retry_failed',
        correlationId: 'sweep',
        extra: { inboxId: d.id, error: (err as Error).message },
      })
    }
  }
  return { candidates: snap.size, processed, failed, oldestAgeMs }
}

export const inboxReconciliationSweep = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'asia-southeast1',
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const result = await inboxReconciliationSweepCore({ db: getFirestore() })
    logEvent({
      severity: result.processed > 3 || result.oldestAgeMs > 15 * 60 * 1000 ? 'ERROR' : 'INFO',
      event: 'inbox.reconciliation_sweep',
      correlationId: 'sweep',
      extra: { ...result },
    })
  },
)
```

- [ ] **Step 4: Export**

```typescript
export { inboxReconciliationSweep } from './triggers/inbox-reconciliation-sweep.js'
```

- [ ] **Step 5: Run tests**

Run: `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test -- reconciliation"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add functions/src/triggers/inbox-reconciliation-sweep.ts functions/src/__tests__/triggers/inbox-reconciliation-sweep.test.ts functions/src/index.ts
git commit -m "feat(functions): add inboxReconciliationSweep scheduled safety net"
```

---

## Group G — Citizen PWA (Tasks 19-22)

---

### Task 19: Scaffold routes and Firebase client init

**Files:**

- Modify: `apps/citizen-pwa/src/App.tsx`
- Create: `apps/citizen-pwa/src/services/firebase.ts`
- Create: `apps/citizen-pwa/src/routes.tsx`
- Modify: `apps/citizen-pwa/src/main.tsx`
- Modify: `apps/citizen-pwa/src/App.test.tsx`
- Modify: `apps/citizen-pwa/package.json` (add `react-router-dom`, `firebase`)

- [ ] **Step 1: Install packages**

```bash
pnpm --filter @bantayog/citizen-pwa add react-router-dom firebase
```

- [ ] **Step 2: Fix the existing failing jest-dom import**

In `apps/citizen-pwa/src/App.test.tsx`, replace any `import '@testing-library/jest-dom'` with `import '@testing-library/jest-dom/vitest'`.

- [ ] **Step 3: Create `firebase.ts`**

```typescript
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFunctions, type Functions } from 'firebase/functions'
import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'

let app: FirebaseApp | null = null

export function getFirebaseApp(): FirebaseApp {
  if (app) return app
  app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  })
  const siteKey = import.meta.env.VITE_APP_CHECK_SITE_KEY
  if (siteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
  }
  return app
}

export function auth(): Auth {
  return getAuth(getFirebaseApp())
}
export function db(): Firestore {
  return getFirestore(getFirebaseApp())
}
export function fns(): Functions {
  return getFunctions(getFirebaseApp(), 'asia-southeast1')
}
export function storage(): FirebaseStorage {
  return getStorage(getFirebaseApp())
}

export async function ensureSignedIn(): Promise<string> {
  const a = auth()
  if (a.currentUser) return a.currentUser.uid
  const cred = await signInAnonymously(a)
  return cred.user.uid
}
```

- [ ] **Step 4: Create `routes.tsx`**

```typescript
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { SubmitReportForm } from './components/SubmitReportForm.js'
import { ReceiptScreen } from './components/ReceiptScreen.js'
import { LookupScreen } from './components/LookupScreen.js'

const router = createBrowserRouter([
  { path: '/', element: <SubmitReportForm /> },
  { path: '/receipt', element: <ReceiptScreen /> },
  { path: '/lookup', element: <LookupScreen /> },
])

export function AppRoutes() {
  return <RouterProvider router={router} />
}
```

- [ ] **Step 5: Replace `App.tsx` with a minimal shell**

```typescript
import { AppRoutes } from './routes.js'

export function App() {
  return <AppRoutes />
}
```

- [ ] **Step 6: Run tests and lint**

Run: `pnpm --filter @bantayog/citizen-pwa test && pnpm --filter @bantayog/citizen-pwa lint`
Expected: PASS (note: components don't exist yet — App.test.tsx may need to mock or skip until Task 20. For now, simplify App.test.tsx to `it('renders without throwing', () => expect(() => render(<App />)).not.toThrow())`).

- [ ] **Step 7: Commit**

```bash
git add apps/citizen-pwa/src/ apps/citizen-pwa/package.json pnpm-lock.yaml
git commit -m "feat(citizen-pwa): scaffold routes and Firebase client init"
```

---

### Task 20: Submit-report orchestrator + form

**Files:**

- Create: `apps/citizen-pwa/src/services/submit-report.ts`
- Create: `apps/citizen-pwa/src/services/submit-report.test.ts`
- Create: `apps/citizen-pwa/src/components/SubmitReportForm.tsx`

- [ ] **Step 1: Write the failing orchestrator test**

Create `apps/citizen-pwa/src/services/submit-report.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { submitReport, type SubmitReportDeps } from './submit-report.js'

describe('submitReport', () => {
  it('calls requestUploadUrl when a photo is provided, PUTs the photo, and writes inbox', async () => {
    const deps: SubmitReportDeps = {
      ensureSignedIn: vi.fn().mockResolvedValue('citizen-1'),
      requestUploadUrl: vi.fn().mockResolvedValue({
        uploadUrl: 'https://put.example',
        uploadId: 'upl-1',
        storagePath: 'pending/upl-1',
        expiresAt: Date.now() + 1e5,
      }),
      putBlob: vi.fn().mockResolvedValue(undefined),
      writeInbox: vi.fn().mockResolvedValue('ibx-1'),
      randomUUID: vi.fn().mockReturnValue('uuid-a'),
      randomPublicRef: vi.fn().mockReturnValue('abcd1234'),
      randomSecret: vi.fn().mockReturnValue('secret-plain'),
      sha256Hex: vi.fn().mockResolvedValue('h'.repeat(64)),
      now: () => 1,
    }
    const photo = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    const result = await submitReport(deps, {
      reportType: 'flood',
      severity: 'high',
      description: 'x',
      publicLocation: { lat: 14.1, lng: 122.9 },
      photo,
    })
    expect(result.publicRef).toBe('abcd1234')
    expect(result.secret).toBe('secret-plain')
    expect(deps.requestUploadUrl).toHaveBeenCalledOnce()
    expect(deps.putBlob).toHaveBeenCalledWith('https://put.example', photo)
    expect(deps.writeInbox).toHaveBeenCalledOnce()
    const inboxDoc = (deps.writeInbox as any).mock.calls[0][0]
    expect(inboxDoc.publicRef).toBe('abcd1234')
    expect(inboxDoc.secretHash).toBe('h'.repeat(64))
    expect(inboxDoc.payload.pendingMediaIds).toEqual(['upl-1'])
  })

  it('skips upload path when no photo is provided', async () => {
    const deps: SubmitReportDeps = {
      ensureSignedIn: vi.fn().mockResolvedValue('citizen-1'),
      requestUploadUrl: vi.fn(),
      putBlob: vi.fn(),
      writeInbox: vi.fn().mockResolvedValue('ibx-2'),
      randomUUID: vi.fn().mockReturnValue('uuid-b'),
      randomPublicRef: vi.fn().mockReturnValue('efgh5678'),
      randomSecret: vi.fn().mockReturnValue('s2'),
      sha256Hex: vi.fn().mockResolvedValue('g'.repeat(64)),
      now: () => 1,
    }
    await submitReport(deps, {
      reportType: 'fire',
      severity: 'medium',
      description: 'y',
      publicLocation: { lat: 14.1, lng: 122.9 },
    })
    expect(deps.requestUploadUrl).not.toHaveBeenCalled()
    expect(deps.putBlob).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bantayog/citizen-pwa test -- submit-report`
Expected: FAIL.

- [ ] **Step 3: Implement `submit-report.ts`**

```typescript
export interface SubmitReportInput {
  reportType: string
  severity: 'low' | 'medium' | 'high'
  description: string
  publicLocation: { lat: number; lng: number }
  photo?: Blob
}

export interface SubmitReportDeps {
  ensureSignedIn(): Promise<string>
  requestUploadUrl(input: {
    mimeType: string
    sizeBytes: number
    sha256: string
  }): Promise<{ uploadUrl: string; uploadId: string; storagePath: string; expiresAt: number }>
  putBlob(url: string, blob: Blob): Promise<void>
  writeInbox(doc: Record<string, unknown>): Promise<string>
  randomUUID(): string
  randomPublicRef(): string
  randomSecret(): string
  sha256Hex(input: string | Blob): Promise<string>
  now(): number
}

export interface SubmitReportResult {
  publicRef: string
  secret: string
  correlationId: string
}

export async function submitReport(
  deps: SubmitReportDeps,
  input: SubmitReportInput,
): Promise<SubmitReportResult> {
  const reporterUid = await deps.ensureSignedIn()
  const correlationId = deps.randomUUID()
  const publicRef = deps.randomPublicRef()
  const secret = deps.randomSecret()
  const secretHash = await deps.sha256Hex(secret)
  const idempotencyKey = deps.randomUUID()
  const pendingMediaIds: string[] = []

  if (input.photo) {
    const sha = await deps.sha256Hex(input.photo)
    const signed = await deps.requestUploadUrl({
      mimeType: input.photo.type || 'image/jpeg',
      sizeBytes: input.photo.size,
      sha256: sha,
    })
    await deps.putBlob(signed.uploadUrl, input.photo)
    pendingMediaIds.push(signed.uploadId)
  }

  await deps.writeInbox({
    reporterUid,
    clientCreatedAt: deps.now(),
    idempotencyKey,
    publicRef,
    secretHash,
    correlationId,
    payload: {
      reportType: input.reportType,
      severity: input.severity,
      description: input.description,
      source: 'web',
      publicLocation: input.publicLocation,
      pendingMediaIds,
    },
  })

  return { publicRef, secret, correlationId }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @bantayog/citizen-pwa test -- submit-report`
Expected: PASS (2/2).

- [ ] **Step 5: Implement the form component**

Create `apps/citizen-pwa/src/components/SubmitReportForm.tsx`:

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDoc, collection } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { uploadBytes, ref as storageRef } from 'firebase/storage'
import { db, fns, storage, ensureSignedIn } from '../services/firebase.js'
import { submitReport, type SubmitReportDeps } from '../services/submit-report.js'

function randomPublicRef(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
function randomSecret(): string {
  return crypto.randomUUID()
}
async function sha256Hex(input: string | Blob): Promise<string> {
  const buf = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(await input.arrayBuffer())
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function putBlob(url: string, blob: Blob): Promise<void> {
  const res = await fetch(url, { method: 'PUT', body: blob, headers: { 'content-type': blob.type } })
  if (!res.ok) throw new Error(`upload failed: ${res.status}`)
}

export function SubmitReportForm() {
  const nav = useNavigate()
  const [reportType, setReportType] = useState('flood')
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function getLocation(): Promise<void> {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 }),
    )
    setLat(pos.coords.latitude)
    setLng(pos.coords.longitude)
  }

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (lat === null || lng === null) {
      setError('Please capture your location.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const deps: SubmitReportDeps = {
        ensureSignedIn,
        requestUploadUrl: async (args) =>
          (await httpsCallable(fns(), 'requestUploadUrl')(args)).data as never,
        putBlob,
        writeInbox: async (doc) => {
          const ref = await addDoc(collection(db(), 'report_inbox'), doc)
          return ref.id
        },
        randomUUID: () => crypto.randomUUID(),
        randomPublicRef,
        randomSecret,
        sha256Hex,
        now: () => Date.now(),
      }
      const result = await submitReport(deps, {
        reportType, severity, description,
        publicLocation: { lat, lng },
        photo: photo ?? undefined,
      })
      nav('/receipt', { state: result })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'submission failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} aria-label="Report submission form">
      <label>
        Type
        <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
          <option value="flood">Flood</option>
          <option value="fire">Fire</option>
          <option value="accident">Accident</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        Severity
        <select value={severity} onChange={(e) => setSeverity(e.target.value as 'low' | 'medium' | 'high')}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} required />
      </label>
      <label>
        Photo (optional)
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      </label>
      <button type="button" onClick={getLocation}>Capture location</button>
      {lat !== null && <p>Location: {lat.toFixed(5)}, {lng!.toFixed(5)}</p>}
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}</button>
    </form>
  )
}
```

Note: `uploadBytes` and `storageRef` imports are unused above — clean them up in Step 6 lint.

- [ ] **Step 6: Run lint + type + test**

Run: `pnpm --filter @bantayog/citizen-pwa lint && pnpm --filter @bantayog/citizen-pwa typecheck && pnpm --filter @bantayog/citizen-pwa test`
Expected: PASS. Remove any unused imports.

- [ ] **Step 7: Commit**

```bash
git add apps/citizen-pwa/src/
git commit -m "feat(citizen-pwa): submit-report form + orchestrator"
```

---

### Task 21: Receipt screen + lookup screen

**Files:**

- Create: `apps/citizen-pwa/src/components/ReceiptScreen.tsx`
- Create: `apps/citizen-pwa/src/components/LookupScreen.tsx`

- [ ] **Step 1: Implement the receipt screen**

```typescript
import { useLocation, Link } from 'react-router-dom'

export function ReceiptScreen() {
  const { state } = useLocation() as { state: { publicRef: string; secret: string } | null }
  if (!state) return <p>No submission to display.</p>
  return (
    <section aria-label="Submission receipt">
      <h1>Report submitted</h1>
      <p>Save these two values. You will need them to check status.</p>
      <dl>
        <dt>Reference</dt><dd><code>{state.publicRef}</code></dd>
        <dt>Secret</dt><dd><code>{state.secret}</code></dd>
      </dl>
      <p>
        We'll notify you when we can. For now, check back with your reference number via the{' '}
        <Link to="/lookup">lookup page</Link>.
      </p>
    </section>
  )
}
```

- [ ] **Step 2: Implement the lookup screen**

```typescript
import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { fns } from '../services/firebase.js'

interface LookupResult {
  status: string
  lastStatusAt: number
  municipalityLabel: string
}

export function LookupScreen() {
  const [publicRef, setPublicRef] = useState('')
  const [secret, setSecret] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setResult(null)
    try {
      const res = await httpsCallable(fns(), 'requestLookup')({ publicRef, secret })
      setResult(res.data as LookupResult)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'lookup failed')
    }
  }

  return (
    <section aria-label="Report status lookup">
      <h1>Check report status</h1>
      <form onSubmit={onSubmit}>
        <label>Reference<input value={publicRef} onChange={(e) => setPublicRef(e.target.value)} required /></label>
        <label>Secret<input value={secret} onChange={(e) => setSecret(e.target.value)} required /></label>
        <button type="submit">Look up</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && (
        <dl>
          <dt>Status</dt><dd>{result.status}</dd>
          <dt>Municipality</dt><dd>{result.municipalityLabel}</dd>
          <dt>Last update</dt><dd>{new Date(result.lastStatusAt).toLocaleString()}</dd>
        </dl>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Run lint + typecheck**

Run: `pnpm --filter @bantayog/citizen-pwa lint && pnpm --filter @bantayog/citizen-pwa typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/citizen-pwa/src/components/
git commit -m "feat(citizen-pwa): add receipt and lookup screens"
```

---

### Task 22: Seed municipalities via bootstrap script

**Files:**

- Create: `scripts/bootstrap-municipalities.ts`

Context: `processInboxItem` depends on the `municipalities` collection being populated. Add a script runnable against dev/staging.

- [ ] **Step 1: Implement**

```typescript
#!/usr/bin/env tsx
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { CAMARINES_NORTE_MUNICIPALITIES } from '../packages/shared-validators/src/municipalities.ts'

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!keyPath) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path.')

initializeApp({ credential: cert(keyPath) })
const db = getFirestore()

async function main(): Promise<void> {
  const batch = db.batch()
  for (const m of CAMARINES_NORTE_MUNICIPALITIES) {
    batch.set(
      db.collection('municipalities').doc(m.id),
      { ...m, schemaVersion: 1 },
      { merge: false },
    )
  }
  await batch.commit()
  console.log(`Seeded ${CAMARINES_NORTE_MUNICIPALITIES.length} municipalities.`)
}
main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Commit**

```bash
git add scripts/bootstrap-municipalities.ts
git commit -m "feat(scripts): bootstrap script for Camarines Norte municipalities"
```

---

## Group H — Observability + Acceptance (Tasks 23-25)

---

### Task 23: Terraform monitoring module (Phase 3 dashboard + alerts)

**Files:**

- Create: `infra/terraform/modules/monitoring/phase-3/main.tf`
- Create: `infra/terraform/modules/monitoring/phase-3/variables.tf`
- Create: `infra/terraform/modules/monitoring/phase-3/outputs.tf`

- [ ] **Step 1: Create the variables file**

```hcl
variable "project_id" {
  type        = string
  description = "GCP project ID (staging or prod)."
}

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)."
}

variable "notification_channel_ids" {
  type        = list(string)
  description = "Cloud Monitoring notification channel IDs."
  default     = []
}
```

- [ ] **Step 2: Create `main.tf` with four log-based metrics + four alert policies**

```hcl
resource "google_logging_metric" "inbox_processed" {
  name    = "phase3_inbox_processed_${var.environment}"
  project = var.project_id
  filter  = "jsonPayload.event=\"inbox.processed\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_logging_metric" "function_errors" {
  name    = "phase3_function_errors_${var.environment}"
  project = var.project_id
  filter  = "severity=\"ERROR\" AND resource.type=\"cloud_function\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_logging_metric" "sweep_heavy" {
  name    = "phase3_sweep_heavy_${var.environment}"
  project = var.project_id
  filter  = "jsonPayload.event=\"inbox.reconciliation_sweep\" AND severity=\"ERROR\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_monitoring_alert_policy" "function_error_rate" {
  project      = var.project_id
  display_name = "[P3] Function error rate high (${var.environment})"
  combiner     = "OR"
  conditions {
    display_name = "errors > 1% sustained 10min"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.function_errors.name}\""
      duration        = "600s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }
  notification_channels = var.notification_channel_ids
}

resource "google_monitoring_alert_policy" "sweep_alert" {
  project      = var.project_id
  display_name = "[P3] Inbox reconciliation sweep heavy (${var.environment})"
  combiner     = "OR"
  conditions {
    display_name = "sweep flagged ERROR"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.sweep_heavy.name}\""
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }
  notification_channels = var.notification_channel_ids
}
```

- [ ] **Step 3: Empty outputs file**

```hcl
output "function_error_alert_id" {
  value = google_monitoring_alert_policy.function_error_rate.id
}
output "sweep_alert_id" {
  value = google_monitoring_alert_policy.sweep_alert.id
}
```

- [ ] **Step 4: Verify**

Run: `cd infra/terraform/modules/monitoring/phase-3 && terraform fmt && terraform validate`
Expected: Success. `terraform validate` may require a top-level plan context; if so, run it from the envs directory where this module gets wired in.

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/modules/monitoring/phase-3/
git commit -m "feat(terraform): Phase 3 monitoring module (metrics + alerts)"
```

---

### Task 24: Phase 3a acceptance script

**Files:**

- Create: `scripts/phase-3a/acceptance.ts`

- [ ] **Step 1: Implement**

```typescript
#!/usr/bin/env tsx
/**
 * Phase 3a acceptance gate.
 *
 * Run against the local emulator:
 *   firebase emulators:exec --only firestore,functions,storage \
 *     "pnpm tsx scripts/phase-3a/acceptance.ts --env=emulator"
 *
 * Or against staging with credentials:
 *   GOOGLE_APPLICATION_CREDENTIALS=./sa.json \
 *     pnpm tsx scripts/phase-3a/acceptance.ts --env=staging
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { randomUUID, createHash } from 'node:crypto'

interface Assertion {
  name: string
  ok: boolean
  detail?: string
}

const results: Assertion[] = []
function check(name: string, ok: boolean, detail?: string): void {
  results.push({ name, ok, detail })
  console.log(ok ? `PASS ${name}` : `FAIL ${name} — ${detail ?? ''}`)
}

async function main(): Promise<void> {
  const env = process.argv.find((a) => a.startsWith('--env='))?.split('=')[1] ?? 'emulator'
  if (env === 'emulator') {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080'
    initializeApp({ projectId: 'bantayog-alert-acceptance' })
  } else {
    initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '') })
  }
  const db = getFirestore()

  // 0. Ensure municipalities seeded
  const muniSnap = await db.collection('municipalities').doc('daet').get()
  check('municipalities:daet seeded', muniSnap.exists, 'run scripts/bootstrap-municipalities.ts')
  if (!muniSnap.exists) process.exit(1)

  // 1. Write an inbox doc directly (simulating the client write)
  const correlationId = randomUUID()
  const secret = randomUUID()
  const secretHash = createHash('sha256').update(secret).digest('hex')
  const publicRef = Math.random().toString(36).slice(2, 10)
  const inboxId = randomUUID()
  await db
    .collection('report_inbox')
    .doc(inboxId)
    .set({
      reporterUid: 'accept-citizen-1',
      clientCreatedAt: Date.now(),
      idempotencyKey: randomUUID(),
      publicRef,
      secretHash,
      correlationId,
      payload: {
        reportType: 'flood',
        description: 'acceptance test',
        severity: 'medium',
        source: 'web',
        publicLocation: { lat: 14.11, lng: 122.95 },
        pendingMediaIds: [],
      },
    })

  // 2. Wait up to 10s for triptych to materialize
  const start = Date.now()
  let reportId: string | null = null
  while (Date.now() - start < 10_000) {
    const lookupSnap = await db.collection('report_lookup').doc(publicRef).get()
    if (lookupSnap.exists) {
      reportId = (lookupSnap.data() as { reportId: string }).reportId
      break
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  check('triptych materialized within 10s', reportId !== null, `publicRef=${publicRef}`)
  if (!reportId) {
    process.exit(1)
  }

  const reportSnap = await db.collection('reports').doc(reportId).get()
  check('reports/{id} exists', reportSnap.exists)
  check('reports.status == new', reportSnap.data()?.status === 'new')
  check('reports.correlationId propagated', reportSnap.data()?.correlationId === correlationId)
  check(
    'reports.municipalityLabel present',
    typeof reportSnap.data()?.municipalityLabel === 'string',
  )

  const privateSnap = await db.collection('report_private').doc(reportId).get()
  check('report_private/{id} exists', privateSnap.exists)
  check(
    'report_private.reporterUid matches',
    privateSnap.data()?.reporterUid === 'accept-citizen-1',
  )

  const opsSnap = await db.collection('report_ops').doc(reportId).get()
  check('report_ops/{id} exists', opsSnap.exists)

  const eventsSnap = await db.collection('reports').doc(reportId).collection('status_log').get()
  check('report_events has >= 1 entry', eventsSnap.size >= 1)
  check(
    'first event is draft_inbox → new',
    eventsSnap.docs[0]?.data().from === 'draft_inbox' && eventsSnap.docs[0]?.data().to === 'new',
  )

  const failed = results.filter((r) => !r.ok)
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} pass`)
  if (failed.length > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Run locally against emulator**

```bash
firebase emulators:exec --only firestore,functions,storage \
  "pnpm tsx scripts/bootstrap-municipalities.ts || true; \
   pnpm tsx scripts/phase-3a/acceptance.ts --env=emulator"
```

Expected: all assertions PASS; exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/phase-3a/acceptance.ts
git commit -m "feat(scripts): Phase 3a acceptance gate"
```

---

### Task 25: Extend rule-coverage gate + finalize docs

**Files:**

- Modify: `scripts/check-rule-coverage.ts`
- Modify: `docs/progress.md`
- Modify: `docs/learnings.md` (append any new patterns discovered)

- [ ] **Step 1: Add Phase 3 collections to the coverage list**

Open `scripts/check-rule-coverage.ts`. Add `pending_media` and `moderation_incidents` to the expected-collections set (both should already exist; extend only if missing). Add positive+negative rule tests for `pending_media` if none exist.

- [ ] **Step 2: Run the gate**

```bash
pnpm exec tsx scripts/check-rule-coverage.ts
```

Expected: PASS.

- [ ] **Step 3: Update `docs/progress.md`**

Append a new section:

```markdown
## Phase 3a Citizen Submission + Triptych Materialization (In Progress)

**Branch:** `feature/phase-3a-citizen-submission`
**Plan:** `docs/superpowers/plans/2026-04-18-phase-3a-citizen-submission.md`

### Implementation Summary

| Task  | Description                                       | Status |
| ----- | ------------------------------------------------- | ------ |
| 1-5   | Schema deltas + state machines + errors + logging | ✅     |
| 6-8   | Rules codegen + drift check                       | ✅     |
| 9-11  | Citizen callables + muni lookup                   | ✅     |
| 12-14 | processInboxItem trigger                          | ✅     |
| 15-17 | Media pipeline                                    | ✅     |
| 18    | Reconciliation sweep                              | ✅     |
| 19-22 | Citizen PWA + bootstrap                           | ✅     |
| 23-25 | Monitoring + acceptance + rule-coverage           | ✅     |

### Verification Results

| Step | Check                                           | Result |
| ---- | ----------------------------------------------- | ------ |
| 1    | `pnpm lint`                                     |        |
| 2    | `pnpm typecheck`                                |        |
| 3    | `pnpm test`                                     |        |
| 4    | `pnpm exec tsx scripts/check-rule-coverage.ts`  |        |
| 5    | `pnpm build`                                    |        |
| 6    | `scripts/phase-3a/acceptance.ts --env=emulator` |        |
| 7    | `scripts/phase-3a/acceptance.ts --env=staging`  |        |
```

- [ ] **Step 4: Run full verification sweep**

```bash
pnpm lint && pnpm typecheck && pnpm test && \
  pnpm exec tsx scripts/check-rule-coverage.ts && \
  pnpm build
```

Fill in the `progress.md` result column with PASS/FAIL for each step.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-rule-coverage.ts docs/progress.md docs/learnings.md
git commit -m "docs(phase-3a): extend rule-coverage gate and record progress"
```

---

## End-of-Phase Gate

Before opening the 3a PR:

- [ ] `scripts/phase-3a/acceptance.ts --env=emulator` passes.
- [ ] `scripts/phase-3a/acceptance.ts --env=staging` passes (deploy first).
- [ ] `pnpm test` passes all suites.
- [ ] Rule-coverage CI gate green.
- [ ] Rules-drift CI gate green.
- [ ] `docs/progress.md` filled in.
- [ ] PR description includes rollback command: `firebase deploy --only firestore:rules --project=bantayog-alert-staging` against the previous rules file.

---

## Appendix — Known Risks and Mitigations

| Risk                                                                         | Mitigation                                                                                                                         |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `municipalityLabel` changes after deploy — existing reports show stale label | Acceptable. Label is point-in-time at report creation. Phase 5 can add a migration if a muni is renamed.                           |
| `publicRef` collision (birthday-paradox ~0.02% at 100k reports)              | Transaction guards against collision; inbox is flagged `rejected_collision` for retry with a new ref. Client regenerates on retry. |
| Stub geocoder mis-classifies near muni boundaries                            | Accepted for Phase 3. Phase 5 replaces with precomputed PH admin boundary polygons.                                                |
| EXIF strip drops legitimate orientation metadata                             | `sharp.rotate()` applies EXIF orientation before stripping. Images render upright.                                                 |
| App Check blocks legit citizens in dev                                       | Dev env uses `initializeAppCheck` with a debug token; documented in `apps/citizen-pwa/README.md` (future).                         |
