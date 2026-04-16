# Phase 0: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the monorepo, shared packages, Firestore/RTDB security rules with full test coverage, identity model, and CI pipeline — everything that blocks Phase 1+ (Citizen PWA, Admin Desktop, Responder App, Cloud Functions).

**Architecture:** pnpm workspace monorepo with Turborepo orchestration. Three app shells (citizen/responder/admin) sharing five packages (shared-types, shared-validators, shared-firebase, shared-ui, shared-sms-parser). Firebase emulator-backed rule tests as the primary validation gate. TDD throughout — every rule, type, and validator has a failing test before the implementation.

**Tech Stack:** pnpm 9+, Turborepo, TypeScript 5.4+, Vite 5, React 18, Vitest, Firebase Emulators (Firestore + RTDB + Auth), Zod, ESLint, Prettier

**Source spec:** `docs/superpowers/specs/bantayog-alert-architecture-spec-v7.md` (§2.3 monorepo, §4 identity, §5.7 Firestore rules, §5.8 RTDB rules, §5.9 indexes)

---

## File Structure

```
bantayog-alert/
├── .github/
│   └── workflows/
│       └── ci.yml                          # Lint + typecheck + test pipeline
├── apps/
│   ├── citizen/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       └── main.tsx
│   ├── responder/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       └── main.tsx
│   └── admin/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           └── main.tsx
├── packages/
│   ├── shared-types/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── report.ts
│   │       ├── dispatch.ts
│   │       ├── user.ts
│   │       ├── alert.ts
│   │       ├── sms.ts
│   │       ├── agency.ts
│   │       ├── auth.ts
│   │       └── enums.ts
│   ├── shared-validators/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── report-inbox.ts
│   │       ├── dispatch.ts
│   │       └── __tests__/
│   │           ├── report-inbox.test.ts
│   │           └── dispatch.test.ts
│   ├── shared-firebase/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── converters.ts
│   │       ├── idempotency.ts
│   │       ├── auth-helpers.ts
│   │       └── __tests__/
│   │           ├── idempotency.test.ts
│   │           └── auth-helpers.test.ts
│   ├── shared-ui/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts
│   └── shared-sms-parser/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── parser.ts
│           └── __tests__/
│               └── parser.test.ts
├── functions/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       └── identity/
│           ├── set-custom-claims.ts
│           └── __tests__/
│               └── set-custom-claims.test.ts
├── infra/
│   ├── firebase/
│   │   ├── .firebaserc
│   │   ├── firebase.json
│   │   ├── firestore.rules
│   │   ├── firestore.indexes.json
│   │   └── database.rules.json
│   └── terraform/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── environments/
│           ├── dev.tfvars
│           ├── staging.tfvars
│           └── prod.tfvars
├── tests/
│   └── firestore/
│       ├── setup.ts
│       ├── helpers.ts
│       ├── report-inbox.test.ts
│       ├── report-triptych.test.ts
│       ├── dispatches.test.ts
│       ├── responders-users.test.ts
│       ├── auth-support.test.ts
│       ├── public-collections.test.ts
│       ├── sms-layer.test.ts
│       ├── admin-features.test.ts
│       └── negative-security.test.ts
│   └── rtdb/
│       ├── setup.ts
│       ├── responder-locations.test.ts
│       └── projections.test.ts
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .prettierrc
├── .eslintrc.cjs
├── .gitignore
├── vitest.config.ts
└── docs/                                   # Existing
```

---

### Task 1: Root monorepo scaffolding

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.prettierrc`, `.eslintrc.cjs`, `.gitignore`, `vitest.config.ts`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "bantayog-alert",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:rules": "vitest run --project rules",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "prettier": "^3.2.0",
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'functions'
  - 'tests/*'
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 5: Create `.prettierrc`**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 6: Create `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js', '*.cjs'],
}
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules/
dist/
.turbo/
*.local
.env
.env.*
!.env.example
firebase-debug.log
firestore-debug.log
database-debug.log
ui-debug.log
.firebase/
coverage/
```

- [ ] **Step 8: Create root `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'rules',
          include: ['tests/**/*.test.ts'],
          testTimeout: 30000,
        },
      },
    ],
  },
})
```

- [ ] **Step 9: Run `pnpm install` and verify**

Run: `pnpm install`
Expected: lockfile created, no errors

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: initialize monorepo with pnpm, turbo, typescript, lint, format"
```

---

### Task 2: App shell stubs (citizen, responder, admin)

**Files:**
- Create: `apps/citizen/{package.json,tsconfig.json,vite.config.ts,index.html,src/main.tsx}`
- Create: `apps/responder/{package.json,tsconfig.json,vite.config.ts,index.html,src/main.tsx}`
- Create: `apps/admin/{package.json,tsconfig.json,vite.config.ts,index.html,src/main.tsx}`

- [ ] **Step 1: Create `apps/citizen/package.json`**

```json
{
  "name": "@bantayog/citizen",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "preview": "vite preview",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `apps/citizen/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false,
    "declarationMap": false
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/citizen/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
})
```

- [ ] **Step 4: Create `apps/citizen/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bantayog Alert</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `apps/citizen/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return <div>Bantayog Alert — Citizen</div>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 6: Repeat for `apps/responder/` and `apps/admin/`**

Copy the same structure for `apps/responder/` and `apps/admin/`, changing:
- `apps/responder/package.json`: `"name": "@bantayog/responder"`
- `apps/responder/src/main.tsx`: text `Bantayog Alert — Responder`
- `apps/admin/package.json`: `"name": "@bantayog/admin"`
- `apps/admin/src/main.tsx`: text `Bantayog Alert — Admin`

All other files identical.

- [ ] **Step 7: Install and verify build**

Run: `pnpm install && pnpm build`
Expected: All three apps build successfully with `dist/` output

- [ ] **Step 8: Commit**

```bash
git add apps/
git commit -m "chore: add citizen, responder, admin app shells (React + Vite)"
```

---

### Task 3: shared-types package

**Files:**
- Create: `packages/shared-types/{package.json,tsconfig.json,src/index.ts,src/enums.ts,src/auth.ts,src/report.ts,src/dispatch.ts,src/user.ts,src/alert.ts,src/sms.ts,src/agency.ts}`

All types are derived from Architecture Spec §4.2, §5.1–5.6. This is a pure type-definition package — no runtime code, no tests needed (TypeScript compiler is the test).

- [ ] **Step 1: Create `packages/shared-types/package.json`**

```json
{
  "name": "@bantayog/shared-types",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `packages/shared-types/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/shared-types/src/enums.ts`**

Derived from §5.1 (ReportStatus — 13 states), §5.2 (DispatchStatus), §5.1 (IncidentType, Severity, Source).

```ts
/** §5.3 — 13-state report lifecycle */
export const REPORT_STATUSES = [
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
  'cancelled',
  'cancelled_false_report',
  'merged_as_duplicate',
  'rejected',
] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

/** §5.4 — Dispatch state machine */
export const DISPATCH_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'timed_out',
  'acknowledged',
  'in_progress',
  'resolved',
  'cancelled',
  'superseded',
] as const
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number]

/** §5.1 */
export const INCIDENT_TYPES = [
  'flood',
  'fire',
  'landslide',
  'earthquake',
  'typhoon',
  'storm_surge',
  'vehicular_accident',
  'medical_emergency',
  'structural_collapse',
  'other',
] as const
export type IncidentType = (typeof INCIDENT_TYPES)[number]

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const
export type Severity = (typeof SEVERITIES)[number]

export const REPORT_SOURCES = [
  'citizen_app',
  'citizen_sms',
  'responder_witness',
  'admin_entry',
] as const
export type ReportSource = (typeof REPORT_SOURCES)[number]

export const VISIBILITY_CLASSES = [
  'public_alertable',
  'internal_only',
  'restricted',
] as const
export type VisibilityClass = (typeof VISIBILITY_CLASSES)[number]

export const LOCATION_PRECISIONS = ['gps', 'barangay_only'] as const
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number]

export const VISIBILITY_SCOPES = ['municipality', 'shared', 'provincial'] as const
export type VisibilityScope = (typeof VISIBILITY_SCOPES)[number]

export const RESPONDER_TYPES = ['POL', 'FIR', 'MED', 'ENG', 'SAR', 'SW', 'GEN'] as const
export type ResponderType = (typeof RESPONDER_TYPES)[number]

export const ROLES = [
  'citizen',
  'responder',
  'municipal_admin',
  'agency_admin',
  'provincial_superadmin',
] as const
export type Role = (typeof ROLES)[number]

export const ACCOUNT_STATUSES = ['active', 'suspended', 'disabled'] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

export const AVAILABILITY_STATUSES = ['available', 'unavailable', 'off_duty'] as const
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number]

export const SUBMISSION_STATES = ['server_accepted', 'rejected', 'duplicate'] as const
export type SubmissionState = (typeof SUBMISSION_STATES)[number]

export const DISPATCH_ACTOR_ROLES = ['municipal_admin', 'agency_admin'] as const
export type DispatchActorRole = (typeof DISPATCH_ACTOR_ROLES)[number]

export const REPORTER_ROLES = ['citizen', 'responder', 'admin'] as const
export type ReporterRole = (typeof REPORTER_ROLES)[number]

export const AGENCY_REQUEST_TYPES = [
  'BFP',
  'PNP',
  'PCG',
  'RED_CROSS',
  'DPWH',
  'OTHER',
] as const
export type AgencyRequestType = (typeof AGENCY_REQUEST_TYPES)[number]

export const AGENCY_REQUEST_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'fulfilled',
  'expired',
] as const
export type AgencyRequestStatus = (typeof AGENCY_REQUEST_STATUSES)[number]
```

- [ ] **Step 4: Create `packages/shared-types/src/auth.ts`**

Derived from §4.2 (CustomClaims).

```ts
import type { AccountStatus, ResponderType, Role } from './enums'

/** §4.2 — Firebase Auth custom claims */
export interface CustomClaims {
  role: Role
  municipalityId?: string
  agencyId?: string
  permittedMunicipalityIds?: string[]
  mfaVerified: boolean
  claimsVersion: number
  accountStatus: AccountStatus
  responderType?: ResponderType
  breakGlassSession?: boolean
}

/** §4.3 — active_accounts/{uid} */
export interface ActiveAccount {
  accountStatus: AccountStatus
  lastUpdatedAt: FirestoreTimestamp
}

/** §4.3 — claim_revocations/{uid} */
export interface ClaimRevocation {
  revokedAt: FirestoreTimestamp
  reason: string
  revokedBy: string
}

/**
 * Placeholder for Firestore Timestamp — packages importing this
 * type from shared-types don't need the firebase SDK dependency.
 * The actual Firestore Timestamp is substituted at runtime via converters.
 */
export type FirestoreTimestamp = {
  seconds: number
  nanoseconds: number
}
```

- [ ] **Step 5: Create `packages/shared-types/src/report.ts`**

Derived from §5.1 (report triptych).

```ts
import type {
  IncidentType,
  LocationPrecision,
  ReportSource,
  ReportStatus,
  ReporterRole,
  Severity,
  SubmissionState,
  VisibilityClass,
  VisibilityScope,
} from './enums'
import type { FirestoreTimestamp } from './auth'

/** §5.1 — reports/{reportId} */
export interface Report {
  municipalityId: string
  barangayId: string
  status: ReportStatus
  type: IncidentType
  severity: Severity
  locationApprox: { barangay: string; municipality: string }
  locationPrecision: LocationPrecision
  visibilityClass: VisibilityClass
  submissionState: SubmissionState
  source: ReportSource
  witnessPriorityFlag?: boolean
  hasPhotoAndGPS: boolean
  reporterRole?: ReporterRole
  duplicateClusterId?: string
  mergedInto?: string
  visibility: ReportVisibility
  createdAt: FirestoreTimestamp
  serverAcceptedAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
  verifiedAt?: FirestoreTimestamp
  resolvedAt?: FirestoreTimestamp
  archivedAt?: FirestoreTimestamp
  deletedAt?: FirestoreTimestamp
  retentionExempt?: boolean
  schemaVersion: number
}

export interface ReportVisibility {
  scope: VisibilityScope
  sharedWith: string[]
  sharedReason?: string
  sharedAt?: FirestoreTimestamp
  sharedBy?: string
}

/** §5.1 — report_private/{reportId} */
export interface ReportPrivate {
  municipalityId: string
  reporterUid: string
  reporterMsisdnHash?: string
  isPseudonymous: boolean
  exactLocation?: { latitude: number; longitude: number }
  publicTrackingRef: string
  contact?: ReportContact
  createdAt: FirestoreTimestamp
  schemaVersion: number
}

export interface ReportContact {
  reporterName?: string
  phone?: string
  email?: string
  followUpConsent: boolean
}

/** §5.1 — report_ops/{reportId} */
export interface ReportOps {
  municipalityId: string
  status: ReportStatus
  severity: Severity
  createdAt: FirestoreTimestamp
  agencyIds: string[]
  classification?: string
  verifiedBy?: string
  classifiedBy?: string
  duplicateOf?: string
  escalatedTo?: string
  activeResponderCount: number
  notesSummary?: string
  requiresLocationFollowUp: boolean
  witnessPriorityFlag?: boolean
  visibility: ReportVisibility
  updatedAt: FirestoreTimestamp
  schemaVersion: number
}

/** report_inbox/{inboxId} — citizen direct write target */
export interface ReportInboxItem {
  reporterUid: string
  clientCreatedAt: FirestoreTimestamp
  payload: ReportInboxPayload
  idempotencyKey: string
}

export interface ReportInboxPayload {
  type: IncidentType
  description: string
  municipalityId: string
  barangayId: string
  locationPrecision: LocationPrecision
  exactLocation?: { latitude: number; longitude: number }
  mediaIds?: string[]
  source?: ReportSource
  severity?: Severity
}
```

- [ ] **Step 6: Create `packages/shared-types/src/dispatch.ts`**

Derived from §5.2.

```ts
import type { DispatchActorRole, DispatchStatus } from './enums'
import type { FirestoreTimestamp } from './auth'

/** §5.2 — dispatches/{dispatchId} */
export interface Dispatch {
  reportId: string
  responderId: string
  municipalityId: string
  agencyId: string
  dispatchedBy: string
  dispatchedByRole: DispatchActorRole
  dispatchedAt: FirestoreTimestamp
  status: DispatchStatus
  statusUpdatedAt: FirestoreTimestamp
  acknowledgementDeadlineAt: FirestoreTimestamp
  acknowledgedAt?: FirestoreTimestamp
  inProgressAt?: FirestoreTimestamp
  resolvedAt?: FirestoreTimestamp
  cancelledAt?: FirestoreTimestamp
  cancelledBy?: string
  cancelReason?: string
  timeoutReason?: string
  declineReason?: string
  resolutionSummary?: string
  proofPhotoUrl?: string
  requestedByMunicipalAdmin?: boolean
  requestId?: string
  idempotencyKey: string
  schemaVersion: number
}
```

- [ ] **Step 7: Create `packages/shared-types/src/user.ts`**

```ts
import type { AccountStatus, AvailabilityStatus, ResponderType } from './enums'
import type { FirestoreTimestamp } from './auth'

/** users/{uid} */
export interface User {
  displayName?: string
  phone?: string
  barangayId?: string
  municipalityId?: string
  createdAt: FirestoreTimestamp
}

/** responders/{uid} */
export interface Responder {
  agencyId: string
  municipalityId: string
  responderType: ResponderType
  specializations: string[]
  availabilityStatus: AvailabilityStatus
  accountStatus: AccountStatus
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
}
```

- [ ] **Step 8: Create `packages/shared-types/src/alert.ts`**

```ts
import type { FirestoreTimestamp } from './auth'

/** alerts/{alertId} — CF write only */
export interface Alert {
  title: string
  body: string
  targetMunicipalityIds: string[]
  targetBarangayIds?: string[]
  hazardType?: string
  severity: string
  sentBy: string
  sentByRole: string
  sentAt: FirestoreTimestamp
  channels: ('fcm' | 'sms')[]
  schemaVersion: number
}

/** emergencies/{emergencyId} — CF write only */
export interface Emergency {
  title: string
  description: string
  declaredBy: string
  declaredAt: FirestoreTimestamp
  affectedMunicipalityIds: string[]
  status: 'active' | 'resolved'
  resolvedAt?: FirestoreTimestamp
  schemaVersion: number
}
```

- [ ] **Step 9: Create `packages/shared-types/src/sms.ts`**

```ts
import type { FirestoreTimestamp } from './auth'

/** sms_outbox/{msgId} */
export interface SmsOutbox {
  to: string
  body: string
  purpose: 'status_update' | 'advisory' | 'dispatch_notification' | 'auto_reply' | 'mass_alert'
  priority: 'normal' | 'priority'
  providerId: 'semaphore' | 'globelabs'
  status: 'queued' | 'sent' | 'delivered' | 'failed'
  correlationId: string
  createdAt: FirestoreTimestamp
  sentAt?: FirestoreTimestamp
  deliveredAt?: FirestoreTimestamp
  failedAt?: FirestoreTimestamp
  failureReason?: string
}

/** sms_inbox/{msgId} */
export interface SmsInbox {
  msisdn: string
  body: string
  receivedAt: FirestoreTimestamp
  parsedSuccessfully: boolean
  parseResult?: {
    type: string
    barangay: string
    municipalityId?: string
  }
  inboxItemId?: string
}
```

- [ ] **Step 10: Create `packages/shared-types/src/agency.ts`**

```ts
import type { AgencyRequestStatus, AgencyRequestType } from './enums'
import type { FirestoreTimestamp } from './auth'

/** agencies/{agencyId} */
export interface Agency {
  name: string
  code: string
  municipalityId?: string
  dispatchDefaults?: {
    high: number
    medium: number
    low: number
  }
}

/** agency_assistance_requests/{requestId} — §5.6 */
export interface AgencyAssistanceRequest {
  reportId: string
  requestedByMunicipalId: string
  requestedByMunicipality: string
  targetAgencyId: string
  requestType: AgencyRequestType
  message: string
  priority: 'urgent' | 'normal'
  status: AgencyRequestStatus
  declinedReason?: string
  fulfilledByDispatchIds: string[]
  createdAt: FirestoreTimestamp
  respondedAt?: FirestoreTimestamp
  expiresAt: FirestoreTimestamp
}
```

- [ ] **Step 11: Create `packages/shared-types/src/index.ts`**

```ts
export * from './enums'
export * from './auth'
export * from './report'
export * from './dispatch'
export * from './user'
export * from './alert'
export * from './sms'
export * from './agency'
```

- [ ] **Step 12: Run typecheck**

Run: `cd packages/shared-types && pnpm typecheck`
Expected: 0 errors

- [ ] **Step 13: Commit**

```bash
git add packages/shared-types/
git commit -m "feat: add shared-types package with all domain types from arch spec v7"
```

---

### Task 4: shared-validators package (TDD)

**Files:**
- Create: `packages/shared-validators/{package.json,tsconfig.json,src/index.ts,src/report-inbox.ts,src/dispatch.ts,src/__tests__/report-inbox.test.ts,src/__tests__/dispatch.test.ts}`

- [ ] **Step 1: Create `packages/shared-validators/package.json`**

```json
{
  "name": "@bantayog/shared-validators",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@bantayog/shared-types": "workspace:*",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json + vitest setup**

`packages/shared-validators/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write failing test for report inbox validation**

`packages/shared-validators/src/__tests__/report-inbox.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { reportInboxPayloadSchema, reportInboxItemSchema } from '../report-inbox'

describe('reportInboxPayloadSchema', () => {
  it('should accept a valid GPS-based payload', () => {
    const valid = {
      type: 'flood',
      description: 'Water rising in barangay hall area',
      municipalityId: 'daet',
      barangayId: 'calasgasan',
      locationPrecision: 'gps',
      exactLocation: { latitude: 14.1123, longitude: 122.9556 },
    }
    expect(reportInboxPayloadSchema.parse(valid)).toEqual(valid)
  })

  it('should accept a barangay-only payload without exactLocation', () => {
    const valid = {
      type: 'landslide',
      description: 'Soil movement near highway',
      municipalityId: 'labo',
      barangayId: 'tulay_na_lupa',
      locationPrecision: 'barangay_only',
    }
    expect(reportInboxPayloadSchema.parse(valid)).toEqual(valid)
  })

  it('should reject payload with responder_witness source (blocked at inbox level)', () => {
    const invalid = {
      type: 'fire',
      description: 'Structure fire',
      municipalityId: 'daet',
      barangayId: 'lag-on',
      locationPrecision: 'gps',
      exactLocation: { latitude: 14.1, longitude: 122.9 },
      source: 'responder_witness',
    }
    expect(() => reportInboxPayloadSchema.parse(invalid)).toThrow()
  })

  it('should reject empty description', () => {
    const invalid = {
      type: 'flood',
      description: '',
      municipalityId: 'daet',
      barangayId: 'calasgasan',
      locationPrecision: 'gps',
    }
    expect(() => reportInboxPayloadSchema.parse(invalid)).toThrow()
  })
})

describe('reportInboxItemSchema', () => {
  it('should accept a valid inbox item', () => {
    const valid = {
      reporterUid: 'uid_abc123',
      clientCreatedAt: { seconds: 1713200000, nanoseconds: 0 },
      payload: {
        type: 'flood',
        description: 'Water rising fast',
        municipalityId: 'daet',
        barangayId: 'calasgasan',
        locationPrecision: 'gps',
        exactLocation: { latitude: 14.1123, longitude: 122.9556 },
      },
      idempotencyKey: 'idem_xyz789',
    }
    expect(reportInboxItemSchema.parse(valid)).toEqual(valid)
  })

  it('should reject missing idempotencyKey', () => {
    const invalid = {
      reporterUid: 'uid_abc123',
      clientCreatedAt: { seconds: 1713200000, nanoseconds: 0 },
      payload: {
        type: 'flood',
        description: 'Water rising',
        municipalityId: 'daet',
        barangayId: 'calasgasan',
        locationPrecision: 'gps',
      },
    }
    expect(() => reportInboxItemSchema.parse(invalid)).toThrow()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd packages/shared-validators && pnpm test`
Expected: FAIL — `report-inbox` module not found

- [ ] **Step 5: Implement `report-inbox.ts`**

`packages/shared-validators/src/report-inbox.ts`:

```ts
import { z } from 'zod'
import { INCIDENT_TYPES, LOCATION_PRECISIONS, REPORT_SOURCES, SEVERITIES } from '@bantayog/shared-types'

const firestoreTimestampSchema = z.object({
  seconds: z.number(),
  nanoseconds: z.number(),
})

const geoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

export const reportInboxPayloadSchema = z
  .object({
    type: z.enum(INCIDENT_TYPES),
    description: z.string().min(1).max(2000),
    municipalityId: z.string().min(1),
    barangayId: z.string().min(1),
    locationPrecision: z.enum(LOCATION_PRECISIONS),
    exactLocation: geoPointSchema.optional(),
    mediaIds: z.array(z.string()).optional(),
    source: z.enum(REPORT_SOURCES).optional(),
    severity: z.enum(SEVERITIES).optional(),
  })
  .refine((data) => data.source !== 'responder_witness', {
    message: 'responder_witness source is not allowed via report_inbox (use submitResponderWitnessedReport callable)',
  })

export const reportInboxItemSchema = z.object({
  reporterUid: z.string().min(1),
  clientCreatedAt: firestoreTimestampSchema,
  payload: reportInboxPayloadSchema,
  idempotencyKey: z.string().min(1),
})
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/shared-validators && pnpm test`
Expected: All 5 tests PASS

- [ ] **Step 7: Write failing test for dispatch validation**

`packages/shared-validators/src/__tests__/dispatch.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validResponderTransition } from '../dispatch'

describe('validResponderTransition', () => {
  const allowed: [string, string][] = [
    ['accepted', 'acknowledged'],
    ['acknowledged', 'in_progress'],
    ['in_progress', 'resolved'],
    ['pending', 'declined'],
  ]

  allowed.forEach(([from, to]) => {
    it(`should allow ${from} → ${to}`, () => {
      expect(validResponderTransition(from, to)).toBe(true)
    })
  })

  const disallowed: [string, string][] = [
    ['pending', 'acknowledged'],
    ['pending', 'resolved'],
    ['accepted', 'resolved'],
    ['acknowledged', 'resolved'],
    ['resolved', 'acknowledged'],
    ['in_progress', 'acknowledged'],
    ['declined', 'accepted'],
  ]

  disallowed.forEach(([from, to]) => {
    it(`should reject ${from} → ${to}`, () => {
      expect(validResponderTransition(from, to)).toBe(false)
    })
  })
})
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd packages/shared-validators && pnpm test`
Expected: FAIL — `dispatch` module not found

- [ ] **Step 9: Implement `dispatch.ts`**

`packages/shared-validators/src/dispatch.ts`:

```ts
/** §5.4 — Canonical responder-direct transitions (mirrored in Firestore rules) */
const VALID_RESPONDER_TRANSITIONS: ReadonlySet<string> = new Set([
  'accepted:acknowledged',
  'acknowledged:in_progress',
  'in_progress:resolved',
  'pending:declined',
])

export function validResponderTransition(from: string, to: string): boolean {
  return VALID_RESPONDER_TRANSITIONS.has(`${from}:${to}`)
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd packages/shared-validators && pnpm test`
Expected: All 16 tests PASS (5 inbox + 11 dispatch)

- [ ] **Step 11: Create `src/index.ts`**

```ts
export { reportInboxPayloadSchema, reportInboxItemSchema } from './report-inbox'
export { validResponderTransition } from './dispatch'
```

- [ ] **Step 12: Commit**

```bash
git add packages/shared-validators/
git commit -m "feat: add shared-validators with Zod schemas for report-inbox + dispatch transitions (TDD)"
```

---

### Task 5: shared-firebase package (TDD)

**Files:**
- Create: `packages/shared-firebase/{package.json,tsconfig.json,src/index.ts,src/idempotency.ts,src/auth-helpers.ts,src/converters.ts,src/__tests__/idempotency.test.ts,src/__tests__/auth-helpers.test.ts}`

- [ ] **Step 1: Create `packages/shared-firebase/package.json`**

```json
{
  "name": "@bantayog/shared-firebase",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@bantayog/shared-types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Write failing test for idempotency key generation**

`packages/shared-firebase/src/__tests__/idempotency.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateIdempotencyKey, parseIdempotencyKey } from '../idempotency'

describe('generateIdempotencyKey', () => {
  it('should produce a key from actor + commandType + logicalTarget', () => {
    const key = generateIdempotencyKey('uid_123', 'dispatchResponder', 'report_abc')
    expect(key).toBe('uid_123:dispatchResponder:report_abc')
  })

  it('should produce deterministic keys for same inputs', () => {
    const a = generateIdempotencyKey('uid_1', 'verifyReport', 'rpt_1')
    const b = generateIdempotencyKey('uid_1', 'verifyReport', 'rpt_1')
    expect(a).toBe(b)
  })

  it('should produce different keys for different inputs', () => {
    const a = generateIdempotencyKey('uid_1', 'verifyReport', 'rpt_1')
    const b = generateIdempotencyKey('uid_1', 'verifyReport', 'rpt_2')
    expect(a).not.toBe(b)
  })
})

describe('parseIdempotencyKey', () => {
  it('should round-trip from generate', () => {
    const key = generateIdempotencyKey('uid_1', 'acceptDispatch', 'dsp_99')
    const parsed = parseIdempotencyKey(key)
    expect(parsed).toEqual({
      actorId: 'uid_1',
      commandType: 'acceptDispatch',
      logicalTarget: 'dsp_99',
    })
  })

  it('should return null for malformed keys', () => {
    expect(parseIdempotencyKey('bad')).toBeNull()
    expect(parseIdempotencyKey('a:b')).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/shared-firebase && pnpm test`
Expected: FAIL — `idempotency` module not found

- [ ] **Step 4: Implement `idempotency.ts`**

```ts
/** §6.2 — Idempotency key: (actor, commandType, logicalTarget), 24h TTL */
export function generateIdempotencyKey(
  actorId: string,
  commandType: string,
  logicalTarget: string,
): string {
  return `${actorId}:${commandType}:${logicalTarget}`
}

export function parseIdempotencyKey(
  key: string,
): { actorId: string; commandType: string; logicalTarget: string } | null {
  const parts = key.split(':')
  if (parts.length !== 3) return null
  return { actorId: parts[0], commandType: parts[1], logicalTarget: parts[2] }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/shared-firebase && pnpm test`
Expected: All 5 tests PASS

- [ ] **Step 6: Write failing test for auth helpers**

`packages/shared-firebase/src/__tests__/auth-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isPrivilegedRole, sessionTimeoutMs } from '../auth-helpers'

describe('isPrivilegedRole', () => {
  it('should return true for admin roles', () => {
    expect(isPrivilegedRole('municipal_admin')).toBe(true)
    expect(isPrivilegedRole('agency_admin')).toBe(true)
    expect(isPrivilegedRole('provincial_superadmin')).toBe(true)
  })

  it('should return true for responder', () => {
    expect(isPrivilegedRole('responder')).toBe(true)
  })

  it('should return false for citizen', () => {
    expect(isPrivilegedRole('citizen')).toBe(false)
  })
})

describe('sessionTimeoutMs', () => {
  it('should return 12h for responder', () => {
    expect(sessionTimeoutMs('responder')).toBe(12 * 60 * 60 * 1000)
  })

  it('should return 8h for municipal_admin', () => {
    expect(sessionTimeoutMs('municipal_admin')).toBe(8 * 60 * 60 * 1000)
  })

  it('should return 8h for agency_admin', () => {
    expect(sessionTimeoutMs('agency_admin')).toBe(8 * 60 * 60 * 1000)
  })

  it('should return 4h for provincial_superadmin', () => {
    expect(sessionTimeoutMs('provincial_superadmin')).toBe(4 * 60 * 60 * 1000)
  })

  it('should return Infinity for citizen (no session timeout)', () => {
    expect(sessionTimeoutMs('citizen')).toBe(Infinity)
  })
})
```

- [ ] **Step 7: Run test, verify fail, implement, verify pass**

`packages/shared-firebase/src/auth-helpers.ts`:

```ts
import type { Role } from '@bantayog/shared-types'

const PRIVILEGED_ROLES: ReadonlySet<Role> = new Set([
  'responder',
  'municipal_admin',
  'agency_admin',
  'provincial_superadmin',
])

export function isPrivilegedRole(role: Role): boolean {
  return PRIVILEGED_ROLES.has(role)
}

/** §4.6 — Session re-auth intervals, in milliseconds */
const SESSION_TIMEOUTS: Record<Role, number> = {
  citizen: Infinity,
  responder: 12 * 60 * 60 * 1000,
  municipal_admin: 8 * 60 * 60 * 1000,
  agency_admin: 8 * 60 * 60 * 1000,
  provincial_superadmin: 4 * 60 * 60 * 1000,
}

export function sessionTimeoutMs(role: Role): number {
  return SESSION_TIMEOUTS[role]
}
```

Run: `cd packages/shared-firebase && pnpm test`
Expected: All 10 tests PASS

- [ ] **Step 8: Create stub `converters.ts` + `index.ts`**

`packages/shared-firebase/src/converters.ts`:

```ts
/**
 * Firestore data converters will be implemented in Phase 1
 * when the Firebase SDK is added to app packages.
 * Stub exported to establish the pattern.
 */
export const CONVERTER_SCHEMA_VERSION = 1
```

`packages/shared-firebase/src/index.ts`:

```ts
export { generateIdempotencyKey, parseIdempotencyKey } from './idempotency'
export { isPrivilegedRole, sessionTimeoutMs } from './auth-helpers'
export { CONVERTER_SCHEMA_VERSION } from './converters'
```

- [ ] **Step 9: Commit**

```bash
git add packages/shared-firebase/
git commit -m "feat: add shared-firebase with idempotency + auth helpers (TDD)"
```

---

### Task 6: shared-ui + shared-sms-parser stubs

**Files:**
- Create: `packages/shared-ui/{package.json,tsconfig.json,src/index.ts}`
- Create: `packages/shared-sms-parser/{package.json,tsconfig.json,src/index.ts,src/parser.ts,src/__tests__/parser.test.ts}`

- [ ] **Step 1: Create `packages/shared-ui/package.json`**

```json
{
  "name": "@bantayog/shared-ui",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "react": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "typescript": "^5.4.0"
  }
}
```

`packages/shared-ui/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/shared-ui/src/index.ts`:
```ts
/** Shared UI primitives — populated in Phase 1 */
export {}
```

- [ ] **Step 2: Write failing test for SMS parser**

`packages/shared-sms-parser/src/__tests__/parser.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseSmsReport } from '../parser'

describe('parseSmsReport', () => {
  it('should parse BANTAYOG FLOOD CALASGASAN', () => {
    const result = parseSmsReport('BANTAYOG FLOOD CALASGASAN')
    expect(result).toEqual({
      success: true,
      type: 'flood',
      barangay: 'calasgasan',
      originalType: 'FLOOD',
      originalBarangay: 'CALASGASAN',
    })
  })

  it('should parse Tagalog synonym BAHA', () => {
    const result = parseSmsReport('BANTAYOG BAHA CALASGASAN')
    expect(result).toEqual({
      success: true,
      type: 'flood',
      barangay: 'calasgasan',
      originalType: 'BAHA',
      originalBarangay: 'CALASGASAN',
    })
  })

  it('should parse SUNOG (fire)', () => {
    const result = parseSmsReport('BANTAYOG SUNOG LAG-ON')
    expect(result).toEqual({
      success: true,
      type: 'fire',
      barangay: 'lag-on',
      originalType: 'SUNOG',
      originalBarangay: 'LAG-ON',
    })
  })

  it('should be case-insensitive', () => {
    const result = parseSmsReport('bantayog flood calasgasan')
    expect(result?.success).toBe(true)
    expect(result?.type).toBe('flood')
  })

  it('should fail on missing keyword', () => {
    const result = parseSmsReport('FLOOD CALASGASAN')
    expect(result.success).toBe(false)
  })

  it('should fail on unknown type', () => {
    const result = parseSmsReport('BANTAYOG TORNADO CALASGASAN')
    expect(result.success).toBe(false)
  })

  it('should fail on missing barangay', () => {
    const result = parseSmsReport('BANTAYOG FLOOD')
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 3: Run test, verify fail**

Run: `cd packages/shared-sms-parser && pnpm test`
Expected: FAIL — `parser` module not found

- [ ] **Step 4: Implement SMS parser**

`packages/shared-sms-parser/src/parser.ts`:

```ts
/** §3 — SMS inbound type synonyms: English / Tagalog */
const TYPE_SYNONYMS: Record<string, string> = {
  FLOOD: 'flood',
  BAHA: 'flood',
  FIRE: 'fire',
  SUNOG: 'fire',
  LANDSLIDE: 'landslide',
  GUHO: 'landslide',
  ACCIDENT: 'accident',
  AKSIDENTE: 'accident',
  MEDICAL: 'medical',
  MEDIKAL: 'medical',
  OTHER: 'other',
  IBA: 'other',
}

export interface SmsParseSuccess {
  success: true
  type: string
  barangay: string
  originalType: string
  originalBarangay: string
}

export interface SmsParseFailure {
  success: false
  reason: 'missing_keyword' | 'unknown_type' | 'missing_barangay'
  raw: string
}

export type SmsParseResult = SmsParseSuccess | SmsParseFailure

export function parseSmsReport(body: string): SmsParseResult {
  const parts = body.trim().toUpperCase().split(/\s+/)

  if (parts[0] !== 'BANTAYOG') {
    return { success: false, reason: 'missing_keyword', raw: body }
  }

  if (parts.length < 3) {
    if (parts.length < 2) {
      return { success: false, reason: 'unknown_type', raw: body }
    }
    return { success: false, reason: 'missing_barangay', raw: body }
  }

  const typeToken = parts[1]
  const resolvedType = TYPE_SYNONYMS[typeToken]
  if (!resolvedType) {
    return { success: false, reason: 'unknown_type', raw: body }
  }

  const barangayTokens = parts.slice(2)
  const barangay = barangayTokens.join('-').toLowerCase()

  return {
    success: true,
    type: resolvedType,
    barangay,
    originalType: typeToken,
    originalBarangay: barangayTokens.join(' '),
  }
}
```

- [ ] **Step 5: Run test, verify pass**

Run: `cd packages/shared-sms-parser && pnpm test`
Expected: All 7 tests PASS

- [ ] **Step 6: Create package.json, tsconfig, index.ts**

`packages/shared-sms-parser/package.json`:
```json
{
  "name": "@bantayog/shared-sms-parser",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

`packages/shared-sms-parser/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/shared-sms-parser/src/index.ts`:
```ts
export { parseSmsReport } from './parser'
export type { SmsParseResult, SmsParseSuccess, SmsParseFailure } from './parser'
```

- [ ] **Step 7: Commit**

```bash
git add packages/shared-ui/ packages/shared-sms-parser/
git commit -m "feat: add shared-ui stub + shared-sms-parser with SMS keyword parser (TDD)"
```

---

### Task 7: Firebase CLI configuration

**Files:**
- Create: `infra/firebase/.firebaserc`, `infra/firebase/firebase.json`

- [ ] **Step 1: Create `infra/firebase/.firebaserc`**

```json
{
  "projects": {
    "dev": "bantayog-dev",
    "staging": "bantayog-staging",
    "prod": "bantayog-prod"
  }
}
```

- [ ] **Step 2: Create `infra/firebase/firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "database": {
    "rules": "database.rules.json"
  },
  "functions": [
    {
      "source": "../../functions",
      "codebase": "bantayog",
      "runtime": "nodejs20",
      "ignore": ["node_modules", ".git"]
    }
  ],
  "hosting": [
    {
      "target": "citizen",
      "public": "../../apps/citizen/dist",
      "ignore": ["firebase.json", "**/.*"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    },
    {
      "target": "admin",
      "public": "../../apps/admin/dist",
      "ignore": ["firebase.json", "**/.*"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    }
  ],
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "database": { "port": 9000 },
    "storage": { "port": 9199 },
    "functions": { "port": 5001 },
    "hosting": { "port": 5000 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add infra/firebase/
git commit -m "chore: add Firebase CLI config with emulator ports and hosting targets"
```

---

### Task 8: Firestore security rules

**Files:**
- Create: `infra/firebase/firestore.rules`

The complete rules are taken verbatim from Architecture Spec §5.7.

- [ ] **Step 1: Create `infra/firebase/firestore.rules`**

Write the complete Firestore rules from §5.7 (lines 561–825 of the architecture spec). The file is ~265 lines. Copy verbatim — these are the authoritative rules.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- Identity helpers ---
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
          || adminOf(data.municipalityId)
          || (isMuniAdmin() && myMunicipality() in data.get('visibility', {}).get('sharedWith', []));
    }

    function validResponderTransition(from, to) {
      return (from == 'accepted'     && to == 'acknowledged')
          || (from == 'acknowledged' && to == 'in_progress')
          || (from == 'in_progress'  && to == 'resolved')
          || (from == 'pending'      && to == 'declined');
    }

    // --- Citizen inbox ---
    match /report_inbox/{inboxId} {
      allow create: if isAuthed()
                    && request.resource.data.reporterUid == uid()
                    && request.resource.data.keys().hasAll(['reporterUid','clientCreatedAt','payload','idempotencyKey'])
                    && request.resource.data.payload is map
                    && !('source' in request.resource.data.payload
                         && request.resource.data.payload.source == 'responder_witness');
      allow read, update, delete: if false;
    }

    // --- Report triptych ---
    match /reports/{reportId} {
      allow read: if canReadReportDoc(resource.data);
      allow create, delete: if false;
      allow update: if adminOf(resource.data.municipalityId)
                    && isActivePrivileged()
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['status','severity','verifiedAt','resolvedAt',
                                 'archivedAt','deletedAt','retentionExempt',
                                 'visibilityClass','duplicateClusterId',
                                 'source','witnessPriorityFlag','hasPhotoAndGPS',
                                 'reporterRole','mergedInto','visibility','updatedAt']);

      match /status_log/{e} {
        allow read: if canReadReportDoc(get(/databases/$(database)/documents/reports/$(reportId)).data);
        allow write: if false;
      }
      match /media/{m} {
        allow read: if canReadReportDoc(get(/databases/$(database)/documents/reports/$(reportId)).data);
        allow write: if false;
      }
      match /messages/{m} {
        allow read: if isActivePrivileged() && (
          adminOf(get(/databases/$(database)/documents/reports/$(reportId)).data.municipalityId)
          || (isAgencyAdmin() && myAgency() in get(/databases/$(database)/documents/report_ops/$(reportId)).data.agencyIds)
          || (isResponder() && exists(/databases/$(database)/documents/dispatches/$(reportId + '_' + uid())))
        );
        allow write: if false;
      }
      match /field_notes/{n} {
        allow read: if isActivePrivileged() && (
          adminOf(get(/databases/$(database)/documents/reports/$(reportId)).data.municipalityId)
          || (isAgencyAdmin() && myAgency() in get(/databases/$(database)/documents/report_ops/$(reportId)).data.agencyIds)
          || (isResponder() && exists(/databases/$(database)/documents/dispatches/$(reportId + '_' + uid())))
        );
        allow write: if false;
      }
    }

    match /report_private/{r} {
      allow read: if isActivePrivileged() && adminOf(resource.data.municipalityId);
      allow write: if false;
    }

    match /report_ops/{r} {
      allow read: if isActivePrivileged() && (
        adminOf(resource.data.municipalityId)
        || (isAgencyAdmin() && myAgency() in resource.data.agencyIds)
        || (isMuniAdmin() && myMunicipality() in resource.data.visibility.sharedWith)
      );
      allow write: if false;
    }

    match /report_contacts/{r} {
      allow read: if isActivePrivileged() && adminOf(resource.data.municipalityId);
      allow write: if false;
    }

    match /report_lookup/{publicRef} {
      allow read, write: if false;
    }

    // --- Dispatches ---
    match /dispatches/{d} {
      allow read: if isActivePrivileged() && (
        (isResponder() && resource.data.responderId == uid())
        || adminOf(resource.data.municipalityId)
        || (isAgencyAdmin() && myAgency() == resource.data.agencyId)
      );
      allow update: if isResponder()
                    && isActivePrivileged()
                    && resource.data.responderId == uid()
                    && validResponderTransition(resource.data.status, request.resource.data.status)
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['status','statusUpdatedAt','acknowledgedAt',
                                 'inProgressAt','resolvedAt','declineReason',
                                 'resolutionSummary','proofPhotoUrl']);
      allow create, delete: if false;
    }

    // --- Responders and Users ---
    match /responders/{rUid} {
      allow read: if isAuthed() && (
        uid() == rUid
        || (isAgencyAdmin() && myAgency() == resource.data.agencyId)
        || (isMuniAdmin() && myMunicipality() == resource.data.municipalityId)
        || isSuperadmin()
      );
      allow update: if uid() == rUid
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['availabilityStatus']);
      allow create, delete: if false;
    }

    match /users/{uUid} {
      allow read: if isAuthed() && (
        uid() == uUid
        || (isMuniAdmin() && myMunicipality() == resource.data.municipalityId)
        || isSuperadmin()
      );
      allow update: if uid() == uUid
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['displayName','phone','barangayId']);
      allow create, delete: if false;
    }

    // --- Auth support ---
    match /claim_revocations/{cUid} {
      allow read: if uid() == cUid;
      allow write: if false;
    }

    match /active_accounts/{aUid} {
      allow read: if uid() == aUid;
      allow write: if false;
    }

    // --- Public collections ---
    match /alerts/{a}        { allow read: if isAuthed(); allow write: if false; }
    match /emergencies/{e}   { allow read: if isAuthed(); allow write: if false; }
    match /agencies/{a}      { allow read: if isAuthed(); allow write: if isSuperadmin() && isActivePrivileged(); }
    match /system_config/{c} { allow read: if isAuthed(); allow write: if isSuperadmin() && isActivePrivileged(); }
    match /audit_logs/{l}    { allow read: if isSuperadmin() && isActivePrivileged(); allow write: if false; }
    match /rate_limits/{r}   { allow read, write: if false; }
    match /dead_letters/{d}  { allow read: if isSuperadmin() && isActivePrivileged(); allow write: if false; }
    match /moderation_incidents/{m} {
      allow read: if isActivePrivileged() && (isMuniAdmin() || isSuperadmin());
      allow write: if false;
    }

    // --- SMS layer ---
    match /sms_inbox/{msgId}   { allow read, write: if false; }
    match /sms_outbox/{msgId}  { allow read: if isSuperadmin() && isActivePrivileged(); allow write: if false; }
    match /sms_sessions/{hash} { allow read, write: if false; }
    match /sms_provider_health/{id} { allow read: if isSuperadmin(); allow write: if false; }

    // --- Break-glass ---
    match /breakglass_events/{id} {
      allow read: if isSuperadmin() && isActivePrivileged();
      allow write: if false;
    }

    // --- Event streams ---
    match /report_events/{eventId} {
      allow read: if isActivePrivileged()
                  && (isMuniAdmin() || isSuperadmin()
                      || (isAgencyAdmin() && resource.data.agencyId == myAgency()));
      allow write: if false;
    }

    // --- Agency assistance requests ---
    match /agency_assistance_requests/{requestId} {
      allow read: if isActivePrivileged() && (
        (isMuniAdmin() && resource.data.requestedByMunicipality == myMunicipality())
        || (isAgencyAdmin() && resource.data.targetAgencyId == myAgency())
        || isSuperadmin()
      );
      allow write: if false;
    }

    // --- Command channel ---
    match /command_channel_threads/{threadId} {
      allow read: if isActivePrivileged()
                  && (isMuniAdmin() || isAgencyAdmin() || isSuperadmin())
                  && request.auth.uid in resource.data.participantUids;
      allow write: if false;
    }
    match /command_channel_messages/{messageId} {
      allow read: if isActivePrivileged()
                  && (isMuniAdmin() || isAgencyAdmin() || isSuperadmin())
                  && get(/databases/$(database)/documents/command_channel_threads/$(resource.data.threadId))
                       .data.participantUids[request.auth.uid] != null;
      allow write: if false;
    }

    // --- Mass alert requests ---
    match /mass_alert_requests/{requestId} {
      allow read: if isActivePrivileged() && (
        isSuperadmin()
        || (isMuniAdmin() && resource.data.requestedByMunicipality == myMunicipality())
      );
      allow write: if false;
    }

    // --- Shift handoffs ---
    match /shift_handoffs/{handoffId} {
      allow read: if isActivePrivileged()
                  && (request.auth.uid == resource.data.fromUid
                      || request.auth.uid == resource.data.toUid
                      || isSuperadmin());
      allow write: if false;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add infra/firebase/firestore.rules
git commit -m "feat: add complete Firestore security rules from arch spec §5.7"
```

---

### Task 9: Firestore composite indexes

**Files:**
- Create: `infra/firebase/firestore.indexes.json`

- [ ] **Step 1: Create `infra/firebase/firestore.indexes.json`**

Derived from §5.9. All indexes must be deployed before first app launch.

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
        { "fieldPath": "visibility.sharedWith", "arrayConfig": "CONTAINS" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
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
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 2: Commit**

```bash
git add infra/firebase/firestore.indexes.json
git commit -m "feat: add all Firestore composite indexes from arch spec §5.9"
```

---

### Task 10: RTDB security rules

**Files:**
- Create: `infra/firebase/database.rules.json`

- [ ] **Step 1: Create `infra/firebase/database.rules.json`**

Verbatim from §5.8.

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
      "$uid": {
        ".write": false
      }
    },
    "agency_responder_projection": {
      "$agencyId": {
        ".read": "auth != null && auth.token.accountStatus === 'active' && (auth.token.role === 'agency_admin' || auth.token.role === 'municipal_admin' || auth.token.role === 'provincial_superadmin')",
        "$uid": {
          ".write": false
        }
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add infra/firebase/database.rules.json
git commit -m "feat: add RTDB security rules from arch spec §5.8"
```

---

### Task 11: Firestore rules test harness + report inbox tests (TDD)

**Files:**
- Create: `tests/firestore/setup.ts`, `tests/firestore/helpers.ts`, `tests/firestore/report-inbox.test.ts`
- Create: `tests/firestore/package.json`

This is the most critical task. Every rule must have positive AND negative tests per §5.7.

- [ ] **Step 1: Create `tests/firestore/package.json`**

```json
{
  "name": "@bantayog/tests-firestore",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@firebase/rules-unit-testing": "^3.0.0",
    "firebase": "^10.12.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tests/firestore/setup.ts`**

```ts
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const RULES_PATH = resolve(__dirname, '../../infra/firebase/firestore.rules')

let testEnv: RulesTestEnvironment

export async function getTestEnv(): Promise<RulesTestEnvironment> {
  if (!testEnv) {
    testEnv = await initializeTestEnvironment({
      projectId: 'bantayog-test',
      firestore: {
        rules: readFileSync(RULES_PATH, 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    })
  }
  return testEnv
}

export async function cleanupTestEnv(): Promise<void> {
  if (testEnv) {
    await testEnv.cleanup()
  }
}
```

- [ ] **Step 3: Create `tests/firestore/helpers.ts`**

```ts
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import type { CustomClaims } from '@bantayog/shared-types'

/** Create an authenticated context with custom claims */
export function authAs(
  testEnv: RulesTestEnvironment,
  uid: string,
  claims: Partial<CustomClaims>,
) {
  return testEnv.authenticatedContext(uid, {
    accountStatus: 'active',
    ...claims,
  })
}

/** Create a citizen context */
export function citizenCtx(testEnv: RulesTestEnvironment, uid = 'citizen_1') {
  return authAs(testEnv, uid, { role: 'citizen' })
}

/** Create a responder context */
export function responderCtx(
  testEnv: RulesTestEnvironment,
  uid = 'responder_1',
  opts: { agencyId?: string; municipalityId?: string } = {},
) {
  return authAs(testEnv, uid, {
    role: 'responder',
    agencyId: opts.agencyId ?? 'agency_bfp',
    municipalityId: opts.municipalityId ?? 'daet',
    mfaVerified: true,
  })
}

/** Create a municipal admin context */
export function muniAdminCtx(
  testEnv: RulesTestEnvironment,
  uid = 'admin_daet',
  municipalityId = 'daet',
) {
  return authAs(testEnv, uid, {
    role: 'municipal_admin',
    municipalityId,
    mfaVerified: true,
  })
}

/** Create an agency admin context */
export function agencyAdminCtx(
  testEnv: RulesTestEnvironment,
  uid = 'agency_admin_bfp',
  agencyId = 'agency_bfp',
) {
  return authAs(testEnv, uid, {
    role: 'agency_admin',
    agencyId,
    mfaVerified: true,
  })
}

/** Create a superadmin context */
export function superadminCtx(
  testEnv: RulesTestEnvironment,
  uid = 'superadmin_1',
) {
  return authAs(testEnv, uid, {
    role: 'provincial_superadmin',
    permittedMunicipalityIds: [
      'basud', 'capalonga', 'daet', 'jose_panganiban', 'labo',
      'mercedes', 'paracale', 'san_lorenzo_ruiz', 'san_vicente',
      'santa_elena', 'talisay', 'vinzons',
    ],
    mfaVerified: true,
  })
}

/** Unauthenticated context */
export function unauthCtx(testEnv: RulesTestEnvironment) {
  return testEnv.unauthenticatedContext()
}
```

- [ ] **Step 4: Write failing report inbox tests**

`tests/firestore/report-inbox.test.ts`:

```ts
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, deleteDoc, collection, addDoc } from 'firebase/firestore'
import { getTestEnv, cleanupTestEnv } from './setup'
import { citizenCtx, unauthCtx, responderCtx } from './helpers'

describe('report_inbox rules', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => {
    testEnv = await getTestEnv()
  })

  afterAll(async () => {
    await cleanupTestEnv()
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
  })

  // --- Positive tests ---

  it('should allow citizen to create a valid inbox item', async () => {
    const ctx = citizenCtx(testEnv, 'citizen_1')
    const db = ctx.firestore()
    const ref = doc(collection(db, 'report_inbox'))

    await assertSucceeds(
      setDoc(ref, {
        reporterUid: 'citizen_1',
        clientCreatedAt: new Date(),
        payload: {
          type: 'flood',
          description: 'Water rising',
          municipalityId: 'daet',
          barangayId: 'calasgasan',
          locationPrecision: 'gps',
        },
        idempotencyKey: 'idem_1',
      }),
    )
  })

  // --- Negative tests ---

  it('should reject unauthenticated create', async () => {
    const ctx = unauthCtx(testEnv)
    const db = ctx.firestore()
    const ref = doc(collection(db, 'report_inbox'))

    await assertFails(
      setDoc(ref, {
        reporterUid: 'anon',
        clientCreatedAt: new Date(),
        payload: { type: 'flood', description: 'test', municipalityId: 'daet', barangayId: 'x', locationPrecision: 'gps' },
        idempotencyKey: 'idem_1',
      }),
    )
  })

  it('should reject create with mismatched reporterUid', async () => {
    const ctx = citizenCtx(testEnv, 'citizen_1')
    const db = ctx.firestore()
    const ref = doc(collection(db, 'report_inbox'))

    await assertFails(
      setDoc(ref, {
        reporterUid: 'citizen_OTHER',
        clientCreatedAt: new Date(),
        payload: { type: 'flood', description: 'test', municipalityId: 'daet', barangayId: 'x', locationPrecision: 'gps' },
        idempotencyKey: 'idem_1',
      }),
    )
  })

  it('should reject create missing required fields', async () => {
    const ctx = citizenCtx(testEnv, 'citizen_1')
    const db = ctx.firestore()
    const ref = doc(collection(db, 'report_inbox'))

    await assertFails(
      setDoc(ref, {
        reporterUid: 'citizen_1',
        payload: { type: 'flood' },
      }),
    )
  })

  it('should reject create with responder_witness source', async () => {
    const ctx = citizenCtx(testEnv, 'citizen_1')
    const db = ctx.firestore()
    const ref = doc(collection(db, 'report_inbox'))

    await assertFails(
      setDoc(ref, {
        reporterUid: 'citizen_1',
        clientCreatedAt: new Date(),
        payload: {
          type: 'flood',
          description: 'test',
          municipalityId: 'daet',
          barangayId: 'x',
          locationPrecision: 'gps',
          source: 'responder_witness',
        },
        idempotencyKey: 'idem_1',
      }),
    )
  })

  it('should reject read on report_inbox', async () => {
    const ctx = citizenCtx(testEnv, 'citizen_1')
    const db = ctx.firestore()

    await assertFails(getDoc(doc(db, 'report_inbox', 'any_id')))
  })

  it('should reject delete on report_inbox', async () => {
    const ctx = citizenCtx(testEnv, 'citizen_1')
    const db = ctx.firestore()

    await assertFails(deleteDoc(doc(db, 'report_inbox', 'any_id')))
  })
})
```

- [ ] **Step 5: Run test to verify it fails (modules not resolved yet)**

Run: `pnpm install && cd tests/firestore && pnpm test`
Expected: FAIL — need emulators running. This test requires:
1. Firebase emulators running: `cd infra/firebase && firebase emulators:start --only firestore`
2. Then in another terminal: `cd tests/firestore && pnpm test`

Document the two-terminal workflow in `tests/firestore/README.md`:

```markdown
# Firestore Rules Tests

## Prerequisites
- Firebase CLI installed: `npm i -g firebase-tools`
- Java Runtime (for emulators)

## Running tests
Terminal 1: `cd infra/firebase && firebase emulators:start --only firestore`
Terminal 2: `cd tests/firestore && pnpm test`

## CI
CI runs emulators in background via `firebase emulators:exec`.
```

- [ ] **Step 6: Start emulators and run tests**

Run:
```bash
cd infra/firebase && firebase emulators:exec --only firestore "cd ../../ && pnpm --filter @bantayog/tests-firestore test"
```
Expected: All 7 report_inbox tests PASS (1 positive, 6 negative)

- [ ] **Step 7: Commit**

```bash
git add tests/firestore/
git commit -m "test: add Firestore rules test harness + report_inbox positive/negative tests"
```

---

### Task 12: Firestore rules — auth support + public collections tests

**Files:**
- Create: `tests/firestore/auth-support.test.ts`, `tests/firestore/public-collections.test.ts`

- [ ] **Step 1: Write auth support tests**

`tests/firestore/auth-support.test.ts`:

```ts
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getTestEnv, cleanupTestEnv } from './setup'
import { citizenCtx, muniAdminCtx, unauthCtx, superadminCtx } from './helpers'

describe('claim_revocations rules', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => { testEnv = await getTestEnv() })
  afterAll(async () => { await cleanupTestEnv() })
  beforeEach(async () => { await testEnv.clearFirestore() })

  it('should allow user to read own claim_revocations', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'claim_revocations', 'user_1'), {
        revokedAt: new Date(),
        reason: 'test',
        revokedBy: 'admin',
      })
    })
    const ctx = citizenCtx(testEnv, 'user_1')
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'claim_revocations', 'user_1')))
  })

  it('should reject reading another users claim_revocations', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'claim_revocations', 'user_2'), {
        revokedAt: new Date(),
        reason: 'test',
        revokedBy: 'admin',
      })
    })
    const ctx = citizenCtx(testEnv, 'user_1')
    await assertFails(getDoc(doc(ctx.firestore(), 'claim_revocations', 'user_2')))
  })

  it('should reject write to claim_revocations', async () => {
    const ctx = citizenCtx(testEnv, 'user_1')
    await assertFails(
      setDoc(doc(ctx.firestore(), 'claim_revocations', 'user_1'), {
        revokedAt: new Date(),
        reason: 'self-revoke attempt',
        revokedBy: 'user_1',
      }),
    )
  })
})

describe('active_accounts rules', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => { testEnv = await getTestEnv() })
  afterAll(async () => { await cleanupTestEnv() })
  beforeEach(async () => { await testEnv.clearFirestore() })

  it('should allow user to read own active_accounts', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'active_accounts', 'user_1'), {
        accountStatus: 'active',
        lastUpdatedAt: new Date(),
      })
    })
    const ctx = citizenCtx(testEnv, 'user_1')
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'active_accounts', 'user_1')))
  })

  it('should reject reading another users active_accounts', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'active_accounts', 'user_2'), {
        accountStatus: 'active',
        lastUpdatedAt: new Date(),
      })
    })
    const ctx = citizenCtx(testEnv, 'user_1')
    await assertFails(getDoc(doc(ctx.firestore(), 'active_accounts', 'user_2')))
  })

  it('should reject write to active_accounts', async () => {
    const ctx = superadminCtx(testEnv)
    await assertFails(
      setDoc(doc(ctx.firestore(), 'active_accounts', 'superadmin_1'), {
        accountStatus: 'active',
        lastUpdatedAt: new Date(),
      }),
    )
  })
})
```

- [ ] **Step 2: Write public collections tests**

`tests/firestore/public-collections.test.ts`:

```ts
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getTestEnv, cleanupTestEnv } from './setup'
import { citizenCtx, unauthCtx, superadminCtx, muniAdminCtx } from './helpers'

describe('public collection rules', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => { testEnv = await getTestEnv() })
  afterAll(async () => { await cleanupTestEnv() })
  beforeEach(async () => {
    await testEnv.clearFirestore()
    // Seed data needed for isActivePrivileged() checks
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'active_accounts', 'superadmin_1'), {
        accountStatus: 'active', lastUpdatedAt: new Date(),
      })
      await setDoc(doc(ctx.firestore(), 'alerts', 'alert_1'), { title: 'test alert' })
      await setDoc(doc(ctx.firestore(), 'emergencies', 'em_1'), { title: 'test emergency' })
      await setDoc(doc(ctx.firestore(), 'agencies', 'bfp'), { name: 'BFP' })
      await setDoc(doc(ctx.firestore(), 'system_config', 'timeouts'), { high: 180 })
      await setDoc(doc(ctx.firestore(), 'audit_logs', 'log_1'), { event: 'test' })
    })
  })

  it('should allow any authed user to read alerts', async () => {
    const ctx = citizenCtx(testEnv)
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'alerts', 'alert_1')))
  })

  it('should reject unauthenticated read of alerts', async () => {
    const ctx = unauthCtx(testEnv)
    await assertFails(getDoc(doc(ctx.firestore(), 'alerts', 'alert_1')))
  })

  it('should allow any authed user to read emergencies', async () => {
    const ctx = citizenCtx(testEnv)
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'emergencies', 'em_1')))
  })

  it('should allow any authed user to read agencies', async () => {
    const ctx = citizenCtx(testEnv)
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'agencies', 'bfp')))
  })

  it('should allow superadmin to write agencies', async () => {
    const ctx = superadminCtx(testEnv)
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'agencies', 'pnp'), { name: 'PNP' }),
    )
  })

  it('should reject non-superadmin write to agencies', async () => {
    const ctx = muniAdminCtx(testEnv)
    await assertFails(
      setDoc(doc(ctx.firestore(), 'agencies', 'pnp'), { name: 'PNP' }),
    )
  })

  it('should allow superadmin to read audit_logs', async () => {
    const ctx = superadminCtx(testEnv)
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'audit_logs', 'log_1')))
  })

  it('should reject non-superadmin read of audit_logs', async () => {
    const ctx = muniAdminCtx(testEnv)
    await assertFails(getDoc(doc(ctx.firestore(), 'audit_logs', 'log_1')))
  })

  it('should reject all client access to rate_limits', async () => {
    const ctx = superadminCtx(testEnv)
    await assertFails(getDoc(doc(ctx.firestore(), 'rate_limits', 'any')))
  })
})
```

- [ ] **Step 3: Run tests**

Run: `cd infra/firebase && firebase emulators:exec --only firestore "cd ../../ && pnpm --filter @bantayog/tests-firestore test"`
Expected: All auth-support + public-collections tests PASS

- [ ] **Step 4: Commit**

```bash
git add tests/firestore/auth-support.test.ts tests/firestore/public-collections.test.ts
git commit -m "test: add auth-support + public-collections Firestore rule tests (positive + negative)"
```

---

### Task 13: Firestore rules — negative security tests (cross-muni, cross-agency)

**Files:**
- Create: `tests/firestore/negative-security.test.ts`

These are the critical "leakage" tests per §5.7: cross-municipality, agency-writing-to-another-agency, responder-accessing-another-responder's dispatch.

- [ ] **Step 1: Write negative security tests**

`tests/firestore/negative-security.test.ts`:

```ts
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { getTestEnv, cleanupTestEnv } from './setup'
import {
  citizenCtx, responderCtx, muniAdminCtx,
  agencyAdminCtx, superadminCtx, unauthCtx,
} from './helpers'

describe('cross-municipality leakage prevention', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => { testEnv = await getTestEnv() })
  afterAll(async () => { await cleanupTestEnv() })
  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      // Seed active_accounts for privileged checks
      await setDoc(doc(db, 'active_accounts', 'admin_daet'), { accountStatus: 'active', lastUpdatedAt: new Date() })
      await setDoc(doc(db, 'active_accounts', 'admin_labo'), { accountStatus: 'active', lastUpdatedAt: new Date() })

      // Seed a report in Daet
      await setDoc(doc(db, 'report_private', 'rpt_1'), { municipalityId: 'daet', reporterUid: 'c1' })
      await setDoc(doc(db, 'report_ops', 'rpt_1'), {
        municipalityId: 'daet', status: 'new', severity: 'high',
        agencyIds: ['agency_bfp'], visibility: { scope: 'municipality', sharedWith: [] },
        createdAt: new Date(), updatedAt: new Date(), activeResponderCount: 0,
        requiresLocationFollowUp: false,
      })
      await setDoc(doc(db, 'report_contacts', 'rpt_1'), { municipalityId: 'daet' })
    })
  })

  it('Labo admin CANNOT read Daet report_private', async () => {
    const ctx = muniAdminCtx(testEnv, 'admin_labo', 'labo')
    await assertFails(getDoc(doc(ctx.firestore(), 'report_private', 'rpt_1')))
  })

  it('Labo admin CANNOT read Daet report_ops', async () => {
    const ctx = muniAdminCtx(testEnv, 'admin_labo', 'labo')
    await assertFails(getDoc(doc(ctx.firestore(), 'report_ops', 'rpt_1')))
  })

  it('Labo admin CANNOT read Daet report_contacts', async () => {
    const ctx = muniAdminCtx(testEnv, 'admin_labo', 'labo')
    await assertFails(getDoc(doc(ctx.firestore(), 'report_contacts', 'rpt_1')))
  })

  it('Daet admin CAN read own report_private', async () => {
    const ctx = muniAdminCtx(testEnv, 'admin_daet', 'daet')
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'report_private', 'rpt_1')))
  })
})

describe('cross-agency dispatch leakage prevention', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => { testEnv = await getTestEnv() })
  afterAll(async () => { await cleanupTestEnv() })
  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'active_accounts', 'responder_bfp'), { accountStatus: 'active', lastUpdatedAt: new Date() })
      await setDoc(doc(db, 'active_accounts', 'responder_pnp'), { accountStatus: 'active', lastUpdatedAt: new Date() })

      // BFP dispatch
      await setDoc(doc(db, 'dispatches', 'dsp_1'), {
        responderId: 'responder_bfp', municipalityId: 'daet',
        agencyId: 'agency_bfp', status: 'accepted',
        reportId: 'rpt_1', dispatchedBy: 'admin_1',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: new Date(), statusUpdatedAt: new Date(),
        acknowledgementDeadlineAt: new Date(), idempotencyKey: 'k1',
        schemaVersion: 1,
      })
    })
  })

  it('PNP responder CANNOT read BFP dispatch', async () => {
    const ctx = responderCtx(testEnv, 'responder_pnp', { agencyId: 'agency_pnp' })
    await assertFails(getDoc(doc(ctx.firestore(), 'dispatches', 'dsp_1')))
  })

  it('BFP responder CAN read own dispatch', async () => {
    const ctx = responderCtx(testEnv, 'responder_bfp', { agencyId: 'agency_bfp' })
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'dispatches', 'dsp_1')))
  })

  it('citizen CANNOT read any dispatch', async () => {
    const ctx = citizenCtx(testEnv)
    await assertFails(getDoc(doc(ctx.firestore(), 'dispatches', 'dsp_1')))
  })
})

describe('responder dispatch transition validation', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => { testEnv = await getTestEnv() })
  afterAll(async () => { await cleanupTestEnv() })
  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'active_accounts', 'responder_1'), { accountStatus: 'active', lastUpdatedAt: new Date() })
      await setDoc(doc(db, 'dispatches', 'dsp_1'), {
        responderId: 'responder_1', municipalityId: 'daet',
        agencyId: 'agency_bfp', status: 'accepted',
        reportId: 'rpt_1', dispatchedBy: 'admin_1',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: new Date(), statusUpdatedAt: new Date(),
        acknowledgementDeadlineAt: new Date(), idempotencyKey: 'k1',
        schemaVersion: 1,
      })
    })
  })

  it('should allow accepted → acknowledged', async () => {
    const ctx = responderCtx(testEnv, 'responder_1')
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), 'dispatches', 'dsp_1'), {
        status: 'acknowledged',
        statusUpdatedAt: new Date(),
        acknowledgedAt: new Date(),
      }),
    )
  })

  it('should reject accepted → resolved (skipping steps)', async () => {
    const ctx = responderCtx(testEnv, 'responder_1')
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'dispatches', 'dsp_1'), {
        status: 'resolved',
        statusUpdatedAt: new Date(),
        resolvedAt: new Date(),
      }),
    )
  })

  it('should reject transition with forbidden fields', async () => {
    const ctx = responderCtx(testEnv, 'responder_1')
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'dispatches', 'dsp_1'), {
        status: 'acknowledged',
        statusUpdatedAt: new Date(),
        acknowledgedAt: new Date(),
        municipalityId: 'labo',  // forbidden field change
      }),
    )
  })
})

describe('suspended account enforcement', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => { testEnv = await getTestEnv() })
  afterAll(async () => { await cleanupTestEnv() })
  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      // active_accounts says suspended
      await setDoc(doc(db, 'active_accounts', 'suspended_admin'), {
        accountStatus: 'suspended', lastUpdatedAt: new Date(),
      })
      await setDoc(doc(db, 'report_private', 'rpt_1'), { municipalityId: 'daet', reporterUid: 'c1' })
    })
  })

  it('suspended admin CANNOT read report_private (isActivePrivileged fails)', async () => {
    const ctx = muniAdminCtx(testEnv, 'suspended_admin', 'daet')
    await assertFails(getDoc(doc(ctx.firestore(), 'report_private', 'rpt_1')))
  })
})
```

- [ ] **Step 2: Run all tests**

Run: `cd infra/firebase && firebase emulators:exec --only firestore "cd ../../ && pnpm --filter @bantayog/tests-firestore test"`
Expected: All negative security tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/firestore/negative-security.test.ts
git commit -m "test: add cross-muni, cross-agency, transition, suspended-account negative security tests"
```

---

### Task 14: Terraform stubs

**Files:**
- Create: `infra/terraform/{main.tf,variables.tf,outputs.tf,environments/dev.tfvars,environments/staging.tfvars,environments/prod.tfvars}`

- [ ] **Step 1: Create Terraform files**

`infra/terraform/main.tf`:

```hcl
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    # Configured per environment via -backend-config
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# BigQuery dataset for audit export
resource "google_bigquery_dataset" "audit" {
  dataset_id = "audit"
  location   = var.region

  default_table_expiration_ms = null

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

# BigQuery dataset for hazard analytics (Phase: Geoanalytics)
resource "google_bigquery_dataset" "hazards" {
  dataset_id = "hazards"
  location   = var.region

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}
```

`infra/terraform/variables.tf`:

```hcl
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-southeast1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}
```

`infra/terraform/outputs.tf`:

```hcl
output "audit_dataset_id" {
  value = google_bigquery_dataset.audit.dataset_id
}

output "hazards_dataset_id" {
  value = google_bigquery_dataset.hazards.dataset_id
}
```

`infra/terraform/environments/dev.tfvars`:
```hcl
project_id  = "bantayog-dev"
environment = "dev"
```

`infra/terraform/environments/staging.tfvars`:
```hcl
project_id  = "bantayog-staging"
environment = "staging"
```

`infra/terraform/environments/prod.tfvars`:
```hcl
project_id  = "bantayog-prod"
environment = "prod"
```

- [ ] **Step 2: Commit**

```bash
git add infra/terraform/
git commit -m "chore: add Terraform stubs for GCP/BigQuery (audit + hazards datasets)"
```

---

### Task 15: Cloud Functions package stub

**Files:**
- Create: `functions/{package.json,tsconfig.json,src/index.ts}`

- [ ] **Step 1: Create `functions/package.json`**

```json
{
  "name": "@bantayog/functions",
  "private": true,
  "version": "0.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "firebase deploy --only functions"
  },
  "engines": {
    "node": "20"
  },
  "dependencies": {
    "@bantayog/shared-types": "workspace:*",
    "@bantayog/shared-validators": "workspace:*",
    "@bantayog/shared-firebase": "workspace:*",
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `functions/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false,
    "declarationMap": false
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `functions/src/index.ts`**

```ts
/**
 * Bantayog Alert — Cloud Functions entry point.
 * Functions will be added in subsequent phases.
 *
 * Phase 1: processInboxItem, lookupReportByToken
 * Phase 2: verifyReport, dispatchResponder, cancelDispatch, etc.
 * Phase 3: acceptDispatch, triggerSOS, requestBackup
 */
export {}
```

- [ ] **Step 4: Verify build**

Run: `cd functions && pnpm install && pnpm build`
Expected: Compiles with no errors

- [ ] **Step 5: Commit**

```bash
git add functions/
git commit -m "chore: add Cloud Functions package stub (Node.js 20)"
```

---

### Task 16: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
name: CI

on:
  push:
    branches: [main, 'feature/**', 'fix/**']
  pull_request:
    branches: [main]

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm typecheck
      - run: pnpm lint

  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @bantayog/shared-validators test
      - run: pnpm --filter @bantayog/shared-firebase test
      - run: pnpm --filter @bantayog/shared-sms-parser test

  test-rules:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - run: npm install -g firebase-tools
      - run: pnpm install --frozen-lockfile
      - run: cd infra/firebase && firebase emulators:exec --only firestore,database "cd ../../ && pnpm --filter @bantayog/tests-firestore test"

  build:
    runs-on: ubuntu-latest
    needs: [lint-typecheck, test-unit, test-rules]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions pipeline (lint, typecheck, unit tests, rule tests, build)"
```

---

### Task 17: Full pipeline verification

- [ ] **Step 1: Run `pnpm install` from root**

Run: `pnpm install`
Expected: All packages resolve, lockfile up to date

- [ ] **Step 2: Run `pnpm typecheck`**

Run: `pnpm typecheck`
Expected: Zero errors across all packages

- [ ] **Step 3: Run unit tests**

Run: `pnpm --filter @bantayog/shared-validators test && pnpm --filter @bantayog/shared-firebase test && pnpm --filter @bantayog/shared-sms-parser test`
Expected: All tests pass

- [ ] **Step 4: Run Firestore rules tests**

Run: `cd infra/firebase && firebase emulators:exec --only firestore "cd ../../ && pnpm --filter @bantayog/tests-firestore test"`
Expected: All rule tests pass (positive + negative)

- [ ] **Step 5: Run `pnpm build`**

Run: `pnpm build`
Expected: All packages and apps build successfully

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: verify full Phase 0 pipeline — lint, typecheck, test, build all green"
```

---

## Summary

| Task | What | Tests |
|---|---|---|
| 1 | Root monorepo scaffolding | N/A (config) |
| 2 | App shell stubs | Build verification |
| 3 | shared-types | TypeScript compiler |
| 4 | shared-validators (TDD) | 16 tests (inbox + dispatch transitions) |
| 5 | shared-firebase (TDD) | 10 tests (idempotency + auth helpers) |
| 6 | shared-ui stub + shared-sms-parser (TDD) | 7 tests (SMS keyword parser) |
| 7 | Firebase CLI config | N/A (config) |
| 8 | Firestore security rules | Tested in Tasks 11–13 |
| 9 | Firestore composite indexes | Deployed before first app launch |
| 10 | RTDB security rules | Tested separately (future task) |
| 11 | Firestore rules test harness + inbox tests | 7 tests (1 positive, 6 negative) |
| 12 | Auth support + public collections tests | ~12 tests |
| 13 | Negative security tests | ~10 tests (cross-muni, cross-agency, transitions, suspended) |
| 14 | Terraform stubs | N/A (IaC) |
| 15 | Cloud Functions stub | Build verification |
| 16 | GitHub Actions CI | Pipeline runs all above |
| 17 | Full pipeline verification | Integration check |

**Total test count:** ~62 tests across 4 test suites
