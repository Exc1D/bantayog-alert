# Phase 0 — Project Foundation & Stakeholder Anchoring

**Date:** 2026-04-17
**Status:** Design approved — awaiting implementation plan
**Driver documents:**

- `prd/bantayog-alert-architecture-spec-v8.md` (spec v8.0)
- `prd/bantayog-alert-implementation-plan-v1.0.md` (13-phase plan)

---

## 0. Scope Decision

Phase 0 in the implementation plan contains three tracks:

| Track                                                                                             | Type             | In scope for this task?                                                  |
| ------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| A — Stakeholder / legal (MOU, NPC DPIA, break-glass envelopes)                                    | Human work       | ❌ Out of scope — cannot be implemented by code                          |
| B — Cloud provisioning (GCP project creation, Firebase enablement, Terraform applies)             | Gated human work | ❌ Out of scope — requires explicit human approval + break-glass custody |
| C — Code scaffolding + cloud-config-as-code (monorepo, apps, packages, rules, CI, Terraform code) | Code work        | ✅ In scope                                                              |

**This design covers Track C only.** Tracks A and B land outside this conversation via human workflow and are prerequisites to later phases, not to Phase 0 code landing.

**Exit criteria for this implementation task:**

- Monorepo builds clean from a fresh `pnpm install` on Node 20
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass
- `firebase emulators:start` boots cleanly with default-deny rules
- `terraform init` + `terraform validate` pass for all three envs (no applies)
- GitHub Actions CI green on PR
- Zero production cloud resources created

---

## 1. Monorepo Layout

**Tooling**: pnpm workspaces + Turborepo.

```
bantayog-alert/
├── apps/
│   ├── citizen-pwa/                 # Vite + React PWA
│   ├── responder-app/               # Vite + React + Capacitor config
│   └── admin-desktop/               # Vite + React desktop PWA
├── functions/                       # Firebase Cloud Functions v2 (Node 20)
├── packages/
│   ├── shared-types/                # Pure TypeScript types (branded)
│   ├── shared-validators/           # Zod schemas + canonical hashing
│   ├── shared-firebase/             # Firestore converters
│   ├── shared-ui/                   # Primitive React components (CSS Modules)
│   ├── shared-sms-parser/           # SMS parser
│   └── shared-data/                 # Barangay/municipality geodata (schema + README; no geometry)
├── infra/
│   ├── firebase/                    # rules, indexes, storage rules
│   └── terraform/                   # GCP modules (no applies in Phase 0)
├── .github/
│   ├── workflows/                   # GitHub Actions CI
│   ├── dependabot.yml
│   └── CODEOWNERS
├── docs/                            # Existing
├── prd/                             # Existing
├── .husky/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── eslint.config.js
├── .prettierrc
├── .prettierignore
├── .editorconfig
├── .gitattributes
├── .gitignore
├── .nvmrc                           # Node 20
├── firebase.json
└── .firebaserc
```

**Rationale:**

- `apps/` for end-user-facing surfaces; `packages/` for shared libraries; `functions/` separate because Firebase CLI needs it at root level; `infra/` for non-code infrastructure.
- Three separate apps (not a single app with role-gating) because: different build targets (web vs native), different accessibility requirements, different offline models.
- `shared-sms-parser` separate from `shared-validators` because SMS parsing runs in Cloud Functions (Node) only — isolating it prevents bloating browser bundles.

---

## 2. Shared Packages

### 2.1 `shared-types`

**Granular file split** (approved over monolithic `types.ts`):

| File              | Types                                                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `branded.ts`      | Branded string types: `ReportId`, `DispatchId`, `UserUid`, `AgencyId`, `MunicipalityId`, `BarangayId`, `AlertId`                                                              |
| `enums.ts`        | `UserRole`, `AccountStatus`, `ReportStatus`, `DispatchStatus`, `Severity`, `ReportType`, `IncidentSource`, `VisibilityClass`, `HazardType`, `TelemetryStatus`, `ReporterRole` |
| `geo.ts`          | `GeoPoint`, `BoundingBox`, `Geohash`                                                                                                                                          |
| `report.ts`       | `Report`, `ReportPrivate`, `ReportOps`, `ReportSharing`, `ReportContact`, `ReportLookup`, `HazardTag`, `VisibilityScope`                                                      |
| `dispatch.ts`     | `Dispatch`, `DispatchEvent`                                                                                                                                                   |
| `user.ts`         | `User`, `Responder`, `Agency`, `CustomClaims`                                                                                                                                 |
| `alert.ts`        | `Alert`, `Emergency`, `HazardSignal`, `HazardZone`                                                                                                                            |
| `audit.ts`        | `AuditLog`, `ReportEvent`, `IncidentResponseEvent` (NOT `DispatchEvent` — that lives in `dispatch.ts`)                                                                        |
| `coordination.ts` | `AgencyAssistanceRequest`, `MassAlertRequest`, `CommandChannelThread`, `CommandChannelMessage`, `ShiftHandoff`, `ResponderShiftHandoff`                                       |
| `sms.ts`          | `SmsInboxMessage`, `SmsOutboxMessage`, `SmsSession`, `SmsProviderHealth`                                                                                                      |
| `system.ts`       | `SystemConfig`, `RateLimit`, `IdempotencyKey`, `DeadLetter`, `ActiveAccount`, `ClaimRevocation`, `DeviceRegistration`, `BreakglassEvent`, `SyncFailure`, `ModerationIncident` |

**Branded types pattern:**

```typescript
export type ReportId = string & { readonly __brand: 'ReportId' }
export type UserUid = string & { readonly __brand: 'UserUid' }
```

**Rationale:** Prevents mixing `ReportId` with `DispatchId` in function args — the compiler enforces it. Cost: runtime cast at validator boundary; benefit: entire class of bugs eliminated.

### 2.2 `shared-validators`

**Pre-implemented in Phase 0:**

- `canonicalPayloadHash(payload: unknown): string` — per spec §6.2
  - Recursively sorts object keys (all levels)
  - `JSON.stringify` with no whitespace
  - SHA-256 hash of result
  - Tests assert determinism (same input → same hash) and key-order invariance
- Barrel export `index.ts`

**Not in Phase 0:** Zod schemas for `Report`, `Dispatch`, etc. Those land in phases that use them (Phase 2 for reports, Phase 4 for dispatch). Phase 0 only lands the idempotency primitive because it's referenced by every subsequent write path.

### 2.3 Other packages — Phase 0 state

| Package             | Phase 0 content                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `shared-firebase`   | Empty scaffolding + `package.json` + `tsconfig.json` + placeholder barrel                  |
| `shared-ui`         | Empty scaffolding + `theme.css` (CSS custom properties) + `package.json`                   |
| `shared-sms-parser` | Empty scaffolding                                                                          |
| `shared-data`       | `README.md` describing data sources (PSA, PhilGIS) + `package.json` + empty `data/` folder |

All packages compile clean; none have substantive code beyond scaffolding + barrel exports.

---

## 3. Apps Scaffolding

### 3.1 App identifiers (Capacitor + manifest)

| App             | Capacitor appId                      | Manifest start_url |
| --------------- | ------------------------------------ | ------------------ |
| `citizen-pwa`   | `ph.gov.camnorte.bantayog.citizen`   | `/`                |
| `responder-app` | `ph.gov.camnorte.bantayog.responder` | `/`                |
| `admin-desktop` | `ph.gov.camnorte.bantayog.admin`     | `/`                |

**Note:** `camnorte` (Camarines Norte province), NOT `daet` (which is one of 12 municipalities). Bundle identifiers are permanent once published — province-level naming prevents forced migration when other municipalities onboard.

### 3.2 Capacitor depth — "Level II"

- ✅ `capacitor.config.ts` + package.json deps (`@capacitor/core`, `@capacitor/cli`, etc.)
- ✅ Build scripts wired (`pnpm cap sync`)
- ❌ NO `ios/` or `android/` native project directories (those land in Phase 11)

Rationale: Native project scaffolds drift quickly and require native SDKs on dev machines. Deferring until Phase 11 avoids onboarding friction for web-only developers.

### 3.3 Styling — CSS Modules

- Each component `Foo.tsx` has a co-located `Foo.module.css`.
- Theme tokens in `packages/shared-ui/src/theme.css` via CSS custom properties.
- No Tailwind, no CSS-in-JS.

### 3.4 Routing

**Zero routing in Phase 0.** Each app renders a single "Hello [app-name]" screen proving build wiring works. Routing lands in Phase 2+ when there are screens to route between.

### 3.5 Per-app Phase 0 file shape

```
apps/citizen-pwa/
├── src/
│   ├── main.tsx                    # Entry — mounts <App />
│   ├── App.tsx                     # Renders "Bantayog Citizen"
│   ├── App.module.css
│   └── vite-env.d.ts
├── public/
│   ├── manifest.webmanifest
│   └── icons/                      # Placeholder icons
├── index.html
├── vite.config.ts                  # React + PWA plugin + path aliases
├── package.json
└── tsconfig.json                   # Extends tsconfig.base.json
```

Same shape for `responder-app` and `admin-desktop`, differing in:

- `responder-app`: adds `capacitor.config.ts`, no PWA manifest at same level
- `admin-desktop`: PWA manifest targets desktop (larger icon set, different display mode)

---

## 4. Firebase Config + Rules Skeleton

### 4.1 `firebase.json`

- Hosting targets: `citizen`, `admin` (responder is Capacitor-only, not Firebase Hosting)
- Firestore rules: `infra/firebase/firestore.rules`
- Firestore indexes: `infra/firebase/firestore.indexes.json`
- Database rules: `infra/firebase/database.rules.json`
- Storage rules: `infra/firebase/storage.rules`
- Functions: `functions/` (codebase `default`, Node 20)
- Emulators: Firebase defaults (`firestore:8080`, `auth:9099`, `database:9000`, `storage:9199`, `functions:5001`, `hosting:5000`, `pubsub:8085`, `ui:4000`)
- `singleProjectMode: true`

### 4.2 `.firebaserc` — project aliases

```json
{
  "projects": {
    "default": "bantayog-alert-dev",
    "dev": "bantayog-alert-dev",
    "staging": "bantayog-alert-staging",
    "prod": "bantayog-alert"
  }
}
```

Target mappings (hosting sites) populated only for `dev` in Phase 0; staging/prod filled during actual provisioning.

### 4.3 `firestore.rules` — default-deny skeleton

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions — names and role literals match spec §5.7 exactly
    function isAuthed()  { return request.auth != null; }
    function role()      { return request.auth.token.role; }
    function isActivePrivileged() { return false; }  // stub — Phase 1 fills body

    function isCitizen()     { return isAuthed() && role() == 'citizen'; }
    function isResponder()   { return isAuthed() && role() == 'responder'; }
    function isMuniAdmin()   { return isAuthed() && role() == 'municipal_admin'; }
    function isAgencyAdmin() { return isAuthed() && role() == 'agency_admin'; }
    function isSuperadmin()  { return isAuthed() && role() == 'provincial_superadmin'; }

    // Default deny
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Role set rationale:** Exact 5-role model from spec §5.7 (lines 609-622). No `dispatcher`, no `provincial_admin`, no platform-level `super_admin` — the spec intentionally unifies provincial+platform authority into `provincial_superadmin`. Municipal admins handle dispatch; there is no separate dispatcher role.

**Why stubs returning `false` for `isActivePrivileged`:** Phase 0 has no `active_accounts/` collection. Returning `false` is _correct_ behavior — nobody is active-privileged yet. Later phases fill the body; signature stays stable.

**Per spec §5.7 warning:** Firestore Rules silently discards unused function parameters — helper names that don't match real spec roles are a security code smell. This design commits to the exact spec names to prevent that drift.

### 4.4 Other rules files

- `firestore.indexes.json`: `{ "indexes": [], "fieldOverrides": [] }`
- `database.rules.json`: `{ "rules": { ".read": false, ".write": false } }`
- `storage.rules`: default deny for all paths

### 4.5 Out of scope for Phase 0

- ❌ Collection-specific match blocks (reports → Phase 2, dispatch → Phase 4, etc.)
- ❌ Composite indexes (each phase adds its own)
- ❌ Storage path rules for media (Phase 3)
- ❌ Cloud Function triggers (Phase 2+)
- ❌ RTDB `/presence` rules (Phase 6)

---

## 5. Terraform Skeleton

### 5.1 Scope

**No `terraform apply` in Phase 0.** Code lands, `terraform init` + `terraform validate` pass for all three envs. Applies gated on separate human-approved task.

### 5.2 Structure

```
infra/terraform/
├── README.md                        # Bootstrap instructions
├── backend.tf                       # GCS remote state (partial config)
├── versions.tf                      # Terraform + provider pins
├── variables.tf                     # Shared inputs
├── providers.tf                     # google + google-beta
├── main.tf                          # Wires child modules
├── outputs.tf
├── envs/
│   ├── dev/     (terraform.tfvars, backend.hcl)
│   ├── staging/ (terraform.tfvars, backend.hcl)
│   └── prod/    (terraform.tfvars, backend.hcl)
└── modules/
    ├── firebase-project/            # Enables Firebase APIs
    ├── iam/                         # Service accounts + role bindings
    ├── secret-manager/              # Secret shells (no values)
    └── pubsub/                      # Dead-letter topics
```

**Deferred modules** (not created in Phase 0):

- `bigquery/` — deferred to Phase 7 when hazard ingestion starts. Phase 0's principle "every file has a Phase 0 justification" rules out creating datasets that no Phase 0 test or build exercises.

### 5.3 Provider pins

```hcl
terraform {
  required_version = ">= 1.8.0"
  required_providers {
    google      = { source = "hashicorp/google",      version = "~> 6.0" }
    google-beta = { source = "hashicorp/google-beta", version = "~> 6.0" }
  }
}
```

### 5.4 Default region

`asia-southeast1` (Singapore) — ~40ms RTT from Philippines vs ~180ms for us-central1.

### 5.5 State bucket bootstrap

Manually created via documented `gcloud storage buckets create gs://bantayog-tf-state-{env}` command in `infra/terraform/README.md`. Not a Terraform resource (chicken-and-egg). Clean and honest approach over cyclic-resource tricks.

### 5.6 `backend.tf` + per-env `backend.hcl`

```hcl
# backend.tf
terraform {
  backend "gcs" {}
}
```

```hcl
# envs/dev/backend.hcl
bucket = "bantayog-tf-state-dev"
prefix = "terraform/state"
```

Init pattern: `terraform init -backend-config=envs/dev/backend.hcl`.

### 5.7 Module content — Phase 0

| Module             | Phase 0 resources                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firebase-project` | Enable APIs: `firebase.googleapis.com`, `firestore.googleapis.com`, `appcheck.googleapis.com`, `fcm.googleapis.com`, `cloudfunctions.googleapis.com`, `cloudbuild.googleapis.com` |
| `iam`              | Service accounts: `bantayog-functions@`, `bantayog-ci-deploy@`. Minimal role bindings per spec §10                                                                                |
| `secret-manager`   | Empty secret shells: `SEMAPHORE_API_KEY`, `GLOBE_LABS_SECRET`, `SENTRY_DSN`, `FCM_SERVER_KEY` (no values)                                                                         |
| `pubsub`           | Dead-letter topics: `reports-dead-letter`, `sms-inbound-dead-letter` (30-day retention)                                                                                           |

_(BigQuery module deferred to Phase 7 — see 5.2.)_

### 5.8 Out of scope for Phase 0

- ❌ `terraform apply` (any env)
- ❌ Cloud Run / Cloud Scheduler / Cloud Tasks (Phase 2+)
- ❌ App Check enforcement config (Phase 1)
- ❌ Firestore database creation via Terraform (Firebase CLI handles at enablement)
- ❌ Monitoring/alerting resources (Phase 10)

---

## 6. CI Pipeline (GitHub Actions)

### 6.1 Files

```
.github/
├── workflows/
│   ├── ci.yml                       # Main PR + push workflow
│   └── codeql.yml                   # Security scan (weekly + PR)
├── dependabot.yml
└── CODEOWNERS
```

### 6.2 `ci.yml` jobs

| Job                  | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| `setup`              | `pnpm install --frozen-lockfile` with pnpm-store cache       |
| `lint`               | `turbo run lint`                                             |
| `typecheck`          | `turbo run typecheck`                                        |
| `test`               | `turbo run test`                                             |
| `build`              | `turbo run build`                                            |
| `rules-check`        | `firebase emulators:exec --only firestore "pnpm test:rules"` |
| `terraform-validate` | `terraform fmt -check` + `terraform validate` per env        |

**Triggers:** PR-to-main + push-to-main.
**Concurrency:** `group: ci-${{ github.ref }}`, `cancel-in-progress: true`.
**Node version:** from `.nvmrc` via `actions/setup-node@v4`.
**pnpm version:** from `package.json` `packageManager` field.

### 6.3 Cache layers

1. **pnpm store** — keyed on `pnpm-lock.yaml` hash
2. **Turborepo cache** — keyed on source hashes (GitHub Actions cache backend; no Vercel dependency)

### 6.4 Secrets

**Phase 0 requires zero CI secrets.** No deployments happen; no external APIs contacted. A CI that doesn't need secrets can't leak them. Phase 11 will add `FIREBASE_SERVICE_ACCOUNT_*` for deploy workflows.

### 6.5 CodeQL — weekly + PR

GitHub's default JavaScript/TypeScript query pack. Catches hardcoded credentials, injection patterns, prototype pollution, unsafe deserialization.

### 6.6 Dependabot — grouped updates

```yaml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule: { interval: 'weekly' }
    groups:
      typescript-eslint: { patterns: ['@typescript-eslint/*', 'typescript-eslint'] }
      vitest: { patterns: ['vitest', '@vitest/*'] }
      firebase: { patterns: ['firebase', 'firebase-admin', 'firebase-functions'] }
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule: { interval: 'weekly' }
  - package-ecosystem: 'terraform'
    directory: '/infra/terraform'
    schedule: { interval: 'weekly' }
```

### 6.7 CODEOWNERS

```
*                                @davidaviado
/infra/firebase/firestore.rules  @davidaviado
/infra/firebase/database.rules.json @davidaviado
/infra/firebase/storage.rules    @davidaviado
/infra/terraform/                @davidaviado
/functions/                      @davidaviado
/packages/shared-validators/     @davidaviado
/packages/shared-firebase/       @davidaviado
```

### 6.8 Branch protection (documented in README, not automated)

Required settings for `main`:

- 1 PR approval (2 for security surfaces)
- Required CI checks: `lint`, `typecheck`, `test`, `build`, `rules-check`, `terraform-validate`
- No force-push
- No direct push
- Linear history (squash-merge only)

### 6.9 Out of scope for Phase 0

- ❌ Deploy jobs (Phase 11)
- ❌ E2E tests (Phase 11)
- ❌ Lighthouse CI / bundle budgets (Phase 10)
- ❌ Coverage gating (Phase 2+)
- ❌ Release automation (Phase 11)

---

## 7. Testing + Tooling Config

### 7.1 `tsconfig.base.json` — strict floor

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true,

    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Each package has its own `tsconfig.json` extending this base.

### 7.2 `eslint.config.js` — flat config (ESLint 9)

Rule stack (in order):

1. `@eslint/js` recommended
2. `typescript-eslint` strict-type-checked
3. `typescript-eslint` stylistic-type-checked
4. `eslint-plugin-react` + `react-hooks` (apps + `shared-ui` only)
5. `eslint-plugin-jsx-a11y` (apps only)
6. Project overrides

**Project overrides:**

```js
{
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',

    // Disabled for Phase 0 — no substantive code to protect yet, and
    // strict-type-checked's default would noisy-block scaffolding PRs
    // at every Firestore boundary before validator wrappers exist.
    // MUST BE RE-ENABLED IN PHASE 2 when reports collection lands.
    '@typescript-eslint/no-unsafe-assignment': 'off',

    '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
    'no-console': ['error', { allow: ['error', 'warn'] }],
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.property.name='doc'] TemplateLiteral",
        message: "Don't build Firestore paths with template literals. Use doc() with validated IDs.",
      },
    ],
  },
}
```

**Phase-2 re-enablement tracking:** A `TODO(phase-2)` comment on the `no-unsafe-assignment: 'off'` line + a checklist item in Phase 2's exit criteria (when writing-plans produces the Phase 2 plan).

**Per-package scoping:**

- `functions/` — Node-only, no React, no jsx-a11y
- `packages/shared-*` — isomorphic, no browser/Node globals
- `apps/*` — full browser + React + a11y

### 7.3 `.prettierrc`

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

Enforced via CI (`prettier --check`). ESLint does NOT lint formatting.

### 7.4 `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "inputs": ["src/**", "tsconfig.json", "package.json"]
    },
    "lint": { "dependsOn": ["^build"], "outputs": [] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "test:rules": {
      "dependsOn": [],
      "outputs": [],
      "env": ["FIRESTORE_EMULATOR_HOST"]
    },
    "dev": { "cache": false, "persistent": true }
  }
}
```

### 7.5 Vitest — workspace root

```ts
// vitest.config.ts
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace(['packages/*', 'apps/*', 'functions'])
```

Per-package `vitest.config.ts` sets:

- `environment: 'happy-dom'` (apps + shared-ui) or `'node'` (functions, shared-validators, shared-sms-parser)
- `globals: true`
- `coverage.provider: 'v8'`
- `setupFiles: ['./test/setup.ts']`

### 7.6 Git hooks

**Husky pre-commit:**

```bash
pnpm lint-staged
```

**`.lintstagedrc.json`:**

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml,css}": ["prettier --write"],
  "*.tf": ["terraform fmt"]
}
```

No pre-push, no commitlint. Keep friction low for solo Phase 0; add when team grows.

### 7.7 `.editorconfig`

```ini
root = true

[*]
end_of_line = lf
insert_final_newline = true
charset = utf-8
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

### 7.8 `.gitignore` — key entries

- `node_modules/`, `.pnpm-store/`
- `dist/`, `build/`, `.turbo/`, `*.tsbuildinfo`
- `.env`, `.env.*` (with `!.env.example` allow-rules)
- Firebase: `.firebase/`, `firebase-debug.*.log`, etc.
- Terraform: `*.tfstate*`, `.terraform/` — **but NOT `.terraform.lock.hcl`**. Lock file is committed (see 7.8.1).
- `coverage/`, `.vitest-cache/`
- `.DS_Store`, `.vscode/` (with `!.vscode/extensions.json` allow-rule)

### 7.8.1 `.terraform.lock.hcl` — committed from Phase 0

Phase 0 includes running `terraform init -backend=false` (does NOT require cloud credentials, does NOT touch remote state) to generate `.terraform.lock.hcl`. The lock file is committed to the repo.

**Why committed:**

- HashiCorp's stated best practice is to commit the lock file for provider version reproducibility across developer machines and CI runners.
- Without it, CI's `terraform validate` may pull different provider patch versions than the developer ran locally, producing confusing "works on my machine" failures.
- `terraform init -backend=false` is safe in Phase 0 because the backend GCS bucket doesn't exist yet — skipping backend init is the correct workflow.

**Phase 0 flow:**

1. Developer runs `cd infra/terraform && terraform init -backend=false` once.
2. The generated `.terraform.lock.hcl` is committed.
3. CI's `terraform-validate` job uses the committed lock file for deterministic provider versions.
4. Future `terraform init` (with real backend, post-Phase-0) uses the same lock file.

### 7.9 `.vscode/extensions.json` — recommended

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-azuretools.vscode-docker",
    "hashicorp.terraform",
    "toba.vsfire",
    "editorconfig.editorconfig",
    "csstools.postcss"
  ]
}
```

(Tailwind extension removed — we use CSS Modules.)

### 7.10 Out of scope for Phase 0

- ❌ Storybook (Phase 3)
- ❌ Bundle analyzer (Phase 10)
- ❌ Sentry SDK config (Phase 10)
- ❌ i18n framework (Phase 3)
- ❌ Playwright install (Phase 11)
- ❌ Pre-push hooks

---

## 8. Cross-cutting Non-Negotiables

These apply across all 7 sections:

1. **Zero production cloud resources.** Terraform code lands, no applies. Firebase config lands, no deploys.
2. **Default-deny everywhere.** Every rule file denies all access unless explicitly granted (Phase 0 grants nothing).
3. **No secrets in the repo.** Secret Manager shells only. `.env.example` committed; `.env` gitignored.
4. **Compile-clean from fresh clone.** A reviewer doing `git clone && pnpm install && pnpm build` must succeed on Node 20 without other setup.
5. **Every file has a Phase 0 justification.** No speculative files for future phases. If a file isn't exercised by Phase 0 tests/build, it doesn't land in Phase 0.

---

## 9. Deliverables Checklist

Landing Phase 0 means all of these exist and pass:

### Code

- [ ] Root: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.editorconfig`, `.gitattributes`, `.gitignore`, `.nvmrc`, `firebase.json`, `.firebaserc`
- [ ] 3 apps scaffolded under `apps/` — each builds to `dist/` with Vite
- [ ] 6 packages scaffolded under `packages/` — each compiles to declarations
- [ ] `functions/` scaffolded with `package.json` + `tsconfig.json`
- [ ] `shared-validators` has working `canonicalPayloadHash` + passing tests
- [ ] All `shared-types` files exist with branded types + enums

### Infrastructure code

- [ ] `infra/firebase/` — 4 rule files (firestore, database, storage, indexes)
- [ ] `infra/terraform/` — 5 modules + 3 env configs + README

### CI + hygiene

- [ ] `.github/workflows/ci.yml` — all 7 jobs green
- [ ] `.github/workflows/codeql.yml`
- [ ] `.github/dependabot.yml`
- [ ] `.github/CODEOWNERS`
- [ ] `.husky/pre-commit` + `.lintstagedrc.json`

### Verification

- [ ] `pnpm install --frozen-lockfile` succeeds on fresh clone
- [ ] `pnpm lint` green
- [ ] `pnpm typecheck` green
- [ ] `pnpm test` green (including `canonicalPayloadHash` tests)
- [ ] `pnpm build` green (all apps + packages)
- [ ] `firebase emulators:start` boots cleanly
- [ ] `terraform validate` green for all three envs
- [ ] GitHub Actions CI passes on PR

### Documentation

- [ ] `README.md` at root — setup instructions, required Node version, emulator startup, branch protection checklist
- [ ] `infra/terraform/README.md` — bootstrap instructions, per-env init commands
- [ ] `docs/progress.md` updated with Phase 0 completion

---

## 10. Explicitly Out of Scope (Consolidated)

| Area                                          | Lands in              |
| --------------------------------------------- | --------------------- |
| Stakeholder MOU, NPC DPIA                     | Track A (human)       |
| Actual cloud provisioning (`terraform apply`) | Track B (gated human) |
| `active_accounts/` + claim revocation logic   | Phase 1               |
| `reports/` rules + converters + UI            | Phase 2               |
| Dispatch collection + workflow                | Phase 4               |
| Media upload rules + Cloud Storage paths      | Phase 3               |
| RTDB presence/heartbeats                      | Phase 6               |
| Cloud Function triggers                       | Phase 2+              |
| BigQuery table schemas + ETL                  | Phase 7               |
| FCM push notification config                  | Phase 5               |
| SMS Semaphore/Globe Labs integration          | Phase 6               |
| App Check enforcement                         | Phase 1               |
| E2E tests (Playwright)                        | Phase 11              |
| Native iOS/Android project directories        | Phase 11              |
| Routing within apps                           | Phase 2+              |
| UI screens beyond "Hello"                     | Phase 2+              |
| Storybook / design system build-out           | Phase 3               |
| Monitoring / alerting / Sentry                | Phase 10              |
| Deploy workflows (CI)                         | Phase 11              |

---

## 11. Deviations from Plan & Sequencing Risks

Surfaced during design review. Both items need human decision before the implementation plan finalizes.

### 11.1 Deviation — Barangay dataset not in Phase 0

**Plan §0 Deliverable #10** specifies: _"Barangay boundary dataset sourced and versioned in `packages/shared-data/`."_

**This design delivers:** Package structure (types, enums, README describing data source) — NOT the dataset itself.

**Why deferred:**

- Dataset sourcing requires licensing decisions for PSA (Philippine Statistics Authority) and PhilGIS data — human legal work, not code work.
- A GeoJSON with all 625 barangays in Camarines Norte (12 municipalities × ~52 barangays) is likely 5-15 MB compressed. Committing binary-ish geometry blobs to git is a long-term maintenance anti-pattern. The dataset belongs in Cloud Storage with signed-download endpoints via Cloud Functions.
- No Phase 0 test or build exercises barangay geometry. It's first needed in Phase 2 (report municipality/barangay classification) and heavily used in Phase 10 (hazard geoanalytics).

**Resolution (decided 2026-04-17):** **Option B — Move dataset delivery to Phase 2 prerequisite.**

- Phase 0 delivers: `packages/shared-data/` scaffolding (types, enums for `MunicipalityId` / `BarangayId`, README documenting data sources, empty `data/` folder with `.gitkeep`).
- Phase 2 gains a new prerequisite gate: before Phase 2 code starts, the barangay dataset must be sourced (licensing cleared), uploaded to Cloud Storage with version manifest, and a thin `shared-data` loader added that fetches + caches it. Dataset itself never commits to git.
- Plan §0 Deliverable #10 is formally revised: exit criterion for Phase 0 becomes "barangay data package structure ready; dataset sourcing deferred to Phase 2 prerequisite."

**Why Option B (not Option A "Phase 0.5"):** A separate data-bootstrap mini-phase adds sequencing overhead. Folding the dataset delivery into Phase 2's prerequisite checklist keeps it close to first-use (Phase 2 is where reports first need municipality/barangay classification), which minimizes the risk of the dataset drifting from the code that consumes it.

### 11.2 Sequencing risk — Capacitor native scaffolding concentrated in Phase 11

**The risk:** This design commits to Capacitor "Level II" (config only, no native project directories) for the responder app in Phase 0, consistent with the plan. However, Phase 11 (the plan's designated Capacitor phase) is the last phase before production. Delaying all native scaffolding + background-location plugin integration + Android foreground services until Phase 11 concentrates unknown-unknowns at the worst possible moment.

**Concrete concerns per Arch Spec §2.1:**

- iOS background-location behavior differs by iOS major version; discovering a blocker at Phase 11 could delay production by weeks.
- Android foreground services require `notification channels` + runtime permission flows that can fail on device-specific OEM skins (Xiaomi, Huawei).
- Capacitor plugin version-lock drift between responder feature development (Phase 6) and native integration (Phase 11) may produce runtime crashes invisible to web-only testing.

**Resolution (decided 2026-04-17):** **Split accepted.**

- **End of Phase 6** gains: `ios/` + `android/` scaffolding via `npx cap add ios` / `cap add android`, a "smoke build" step (app installs on physical device, renders blank screen, talks to Firestore emulator), and plugin dependency lock-in (`@capacitor/geolocation`, `@capacitor/push-notifications`, `@capacitor/background-runner`).
- **Phase 11 retains**: Production signing (iOS provisioning profiles + Android keystore management), MDM distribution config for responder devices, App Store / Play Store submission workflow.

**This design does NOT change Phase 0 scope** (still Level II — config + deps, no native dirs). The split applies to Phase 6 and Phase 11 definitions, which the writing-plans skill will reflect in the Phase 0 plan's "Downstream impacts on later phases" note.

---

## 12. Next Steps

1. ✅ Design doc written at `docs/superpowers/specs/2026-04-17-phase-0-design.md`
2. ✅ Self-review pass by Claude — 5 findings surfaced + 4 additional role errors caught during verification
3. ✅ Human review by davidaviado — all decisions closed:
   - ESLint `no-unsafe-assignment` → disabled for Phase 0, re-enabled Phase 2
   - Barangay data → Option B (Phase 2 prerequisite)
   - Capacitor split → accepted (Phase 6 native scaffolding + smoke build; Phase 11 distribution)
4. Commit this design doc to `main`
5. **Invoke `writing-plans` skill** to produce the implementation plan document (2–5 minute atomic tasks, following the skill's protocol)
6. Implementation happens in a separate conversation driven by the plan doc — not in this conversation per brainstorming skill's HARD GATE
