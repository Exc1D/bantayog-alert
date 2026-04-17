# Phase 1 Infrastructure and Identity Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 identity spine so the citizen PWA can boot with a pseudonymous Firebase session and read a hello-world feed, while staff claims, active-account revocation, and baseline config are enforced through rules, functions, and seeded documents.

**Architecture:** Use a dual-lane rollout. Track B produces repository code that is fully testable in unit tests and emulators: shared identity contracts, Firebase web bootstrap, Cloud Functions claim/revocation helpers, Firestore rules, and the citizen shell UI. Track A is the gated staging rollout: Terraform/app wiring, Auth/App Check enablement, function deployment, seed execution, and staged verification. Rules treat `active_accounts/{uid}` as the privileged authorization source of truth, while `claim_revocations/{uid}` remains a client refresh signal.

**Tech Stack:** TypeScript, React 19, Vite 8, Firebase Auth, Firebase App Check, Cloud Firestore, Cloud Functions for Firebase v2, Firebase Admin SDK, Firestore Security Rules, Vitest, Testing Library, Zod, pnpm, Turbo, Terraform

---

## File Structure

- Modify: `package.json`
- Modify: `vitest.workspace.ts`
- Modify: `README.md`
- Modify: `docs/progress.md`
- Modify: `packages/shared-types/src/enums.ts`
- Modify: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/src/auth.ts`
- Create: `packages/shared-types/src/config.ts`
- Modify: `packages/shared-validators/package.json`
- Modify: `packages/shared-validators/src/index.ts`
- Create: `packages/shared-validators/src/auth.ts`
- Create: `packages/shared-validators/src/config.ts`
- Create: `packages/shared-validators/src/alerts.ts`
- Create: `packages/shared-validators/src/phase1-auth.test.ts`
- Modify: `packages/shared-firebase/package.json`
- Modify: `packages/shared-firebase/src/index.ts`
- Create: `packages/shared-firebase/src/env.ts`
- Create: `packages/shared-firebase/src/app.ts`
- Create: `packages/shared-firebase/src/auth.ts`
- Create: `packages/shared-firebase/src/firestore.ts`
- Create: `packages/shared-firebase/src/env.test.ts`
- Create: `packages/shared-firebase/vitest.config.ts`
- Modify: `functions/package.json`
- Modify: `functions/src/index.ts`
- Create: `functions/src/firebase-admin.ts`
- Create: `functions/src/auth/custom-claims.ts`
- Create: `functions/src/auth/account-lifecycle.ts`
- Create: `functions/src/bootstrap/phase1-seed.ts`
- Create: `functions/src/__tests__/phase1-auth.test.ts`
- Create: `functions/src/__tests__/firestore.rules.test.ts`
- Create: `functions/vitest.config.ts`
- Create: `functions/scripts/bootstrap-phase1.ts`
- Modify: `infra/firebase/firestore.rules`
- Modify: `apps/citizen-pwa/package.json`
- Modify: `apps/citizen-pwa/src/App.tsx`
- Modify: `apps/citizen-pwa/src/App.module.css`
- Create: `apps/citizen-pwa/src/useCitizenShell.ts`
- Create: `apps/citizen-pwa/src/App.test.tsx`
- Create: `apps/citizen-pwa/vitest.config.ts`

## Track B: Repository Implementation

### Task 1: Identity Contracts and Schemas

**Files:**

- Modify: `packages/shared-types/src/enums.ts`
- Modify: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/src/auth.ts`
- Create: `packages/shared-types/src/config.ts`
- Modify: `packages/shared-validators/package.json`
- Modify: `packages/shared-validators/src/index.ts`
- Create: `packages/shared-validators/src/auth.ts`
- Create: `packages/shared-validators/src/config.ts`
- Create: `packages/shared-validators/src/alerts.ts`
- Test: `packages/shared-validators/src/phase1-auth.test.ts`

- [ ] **Step 1: Add the runtime-schema dependency and write the failing validator tests**

```bash
pnpm add --filter @bantayog/shared-validators zod
```

```ts
// packages/shared-validators/src/phase1-auth.test.ts
import { describe, expect, it } from 'vitest'
import {
  activeAccountSchema,
  alertSchema,
  claimRevocationSchema,
  minAppVersionSchema,
  setStaffClaimsInputSchema,
  suspendStaffAccountInputSchema,
} from './index.js'

describe('activeAccountSchema', () => {
  it('accepts an active municipal admin record', () => {
    expect(
      activeAccountSchema.parse({
        uid: 'admin-1',
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
        permittedMunicipalityIds: ['daet'],
        lastClaimIssuedAt: 1713350400000,
        updatedAt: 1713350400000,
      }),
    ).toMatchObject({ uid: 'admin-1', municipalityId: 'daet' })
  })

  it('rejects unsupported account statuses', () => {
    expect(() =>
      activeAccountSchema.parse({
        uid: 'admin-1',
        role: 'municipal_admin',
        accountStatus: 'revoked',
        municipalityId: 'daet',
        permittedMunicipalityIds: ['daet'],
        lastClaimIssuedAt: 1713350400000,
        updatedAt: 1713350400000,
      }),
    ).toThrow(/Invalid enum value/)
  })
})

describe('claimRevocationSchema', () => {
  it('requires a revocation timestamp and reason', () => {
    expect(
      claimRevocationSchema.parse({
        uid: 'admin-1',
        revokedAt: 1713350400000,
        reason: 'suspended',
      }),
    ).toMatchObject({ reason: 'suspended' })
  })
})

describe('setStaffClaimsInputSchema', () => {
  it('requires municipality scope for municipal admins', () => {
    expect(() =>
      setStaffClaimsInputSchema.parse({
        uid: 'admin-1',
        role: 'municipal_admin',
      }),
    ).toThrow(/municipalityId/)
  })
})

describe('suspendStaffAccountInputSchema', () => {
  it('accepts a suspension payload', () => {
    expect(
      suspendStaffAccountInputSchema.parse({
        uid: 'admin-1',
        reason: 'manual suspension',
      }),
    ).toMatchObject({ uid: 'admin-1' })
  })
})

describe('minAppVersionSchema', () => {
  it('parses the phase 1 config document', () => {
    expect(
      minAppVersionSchema.parse({
        citizen: '0.1.0',
        admin: '0.1.0',
        responder: '0.1.0',
        updatedAt: 1713350400000,
      }),
    ).toMatchObject({ citizen: '0.1.0' })
  })
})

describe('alertSchema', () => {
  it('parses a benign hello-world feed item', () => {
    expect(
      alertSchema.parse({
        title: 'System online',
        body: 'Citizen shell wired for Phase 1.',
        severity: 'info',
        publishedAt: 1713350400000,
        publishedBy: 'phase-1-bootstrap',
      }),
    ).toMatchObject({ severity: 'info' })
  })
})
```

- [ ] **Step 2: Run the shared validator tests to verify they fail**

Run: `pnpm --filter @bantayog/shared-validators test`

Expected: FAIL with module export errors for `activeAccountSchema`, `claimRevocationSchema`, `minAppVersionSchema`, `alertSchema`, or the input schemas.

- [ ] **Step 3: Implement the Phase 1 contracts and Zod schemas**

```ts
// packages/shared-types/src/auth.ts
import type { AgencyId, MunicipalityId, UserUid } from './branded.js'
import type { AccountStatus, UserRole } from './enums.js'

export interface CustomClaims {
  role: UserRole
  municipalityId?: MunicipalityId
  agencyId?: AgencyId
  permittedMunicipalityIds?: MunicipalityId[]
  accountStatus: AccountStatus
  mfaEnrolled: boolean
  lastClaimIssuedAt: number
  breakGlassSession?: boolean
}

export interface ActiveAccountDoc {
  uid: UserUid
  role: UserRole
  accountStatus: AccountStatus
  municipalityId?: MunicipalityId
  agencyId?: AgencyId
  permittedMunicipalityIds: MunicipalityId[]
  mfaEnrolled: boolean
  lastClaimIssuedAt: number
  updatedAt: number
}

export interface ClaimRevocationDoc {
  uid: UserUid
  revokedAt: number
  reason: 'suspended' | 'claims_updated' | 'manual_refresh'
}
```

```ts
// packages/shared-types/src/config.ts
export type AppSurface = 'citizen' | 'admin' | 'responder'

export interface MinAppVersionDoc {
  citizen: string
  admin: string
  responder: string
  updatedAt: number
}

export interface AlertDoc {
  title: string
  body: string
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  publishedAt: number
  publishedBy: string
}
```

```ts
// packages/shared-types/src/enums.ts
export type UserRole =
  | 'citizen'
  | 'responder'
  | 'municipal_admin'
  | 'agency_admin'
  | 'provincial_superadmin'

export type AccountStatus = 'active' | 'suspended' | 'disabled'
```

```ts
// packages/shared-validators/src/auth.ts
import { z } from 'zod'

const userRoleSchema = z.enum([
  'citizen',
  'responder',
  'municipal_admin',
  'agency_admin',
  'provincial_superadmin',
])

const accountStatusSchema = z.enum(['active', 'suspended', 'disabled'])

export const setStaffClaimsInputSchema = z
  .object({
    uid: z.string().min(1),
    role: userRoleSchema.exclude(['citizen']),
    municipalityId: z.string().min(1).optional(),
    agencyId: z.string().min(1).optional(),
    permittedMunicipalityIds: z.array(z.string().min(1)).default([]),
    mfaEnrolled: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.role === 'municipal_admin' && !value.municipalityId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'municipalityId is required' })
    }
    if ((value.role === 'agency_admin' || value.role === 'responder') && !value.agencyId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'agencyId is required' })
    }
  })

export const suspendStaffAccountInputSchema = z.object({
  uid: z.string().min(1),
  reason: z.string().min(1),
})

export const activeAccountSchema = z.object({
  uid: z.string().min(1),
  role: userRoleSchema,
  accountStatus: accountStatusSchema,
  municipalityId: z.string().min(1).optional(),
  agencyId: z.string().min(1).optional(),
  permittedMunicipalityIds: z.array(z.string().min(1)).default([]),
  mfaEnrolled: z.boolean().default(false),
  lastClaimIssuedAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export const claimRevocationSchema = z.object({
  uid: z.string().min(1),
  revokedAt: z.number().int().nonnegative(),
  reason: z.enum(['suspended', 'claims_updated', 'manual_refresh']),
})
```

```ts
// packages/shared-validators/src/config.ts
import { z } from 'zod'

export const minAppVersionSchema = z.object({
  citizen: z.string().min(1),
  admin: z.string().min(1),
  responder: z.string().min(1),
  updatedAt: z.number().int().nonnegative(),
})
```

```ts
// packages/shared-validators/src/alerts.ts
import { z } from 'zod'

export const alertSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
  publishedAt: z.number().int().nonnegative(),
  publishedBy: z.string().min(1),
})
```

```ts
// packages/shared-validators/src/index.ts
export { canonicalPayloadHash } from './idempotency.js'
export {
  activeAccountSchema,
  claimRevocationSchema,
  setStaffClaimsInputSchema,
  suspendStaffAccountInputSchema,
} from './auth.js'
export { minAppVersionSchema } from './config.js'
export { alertSchema } from './alerts.js'
```

```ts
// packages/shared-types/src/index.ts
export * from './auth.js'
export * from './branded.js'
export * from './config.js'
export * from './enums.js'
export * from './geo.js'
```

- [ ] **Step 4: Run the shared validator test and typecheck commands to verify they pass**

Run: `pnpm --filter @bantayog/shared-validators test`
Expected: PASS with `phase1-auth.test.ts` plus the existing `idempotency.test.ts`.

Run: `pnpm --filter @bantayog/shared-types typecheck && pnpm --filter @bantayog/shared-validators typecheck`
Expected: PASS with zero TypeScript errors.

- [ ] **Step 5: Commit the identity contract work**

```bash
git add packages/shared-types packages/shared-validators
git commit -m "feat(phase-1): add identity contracts and validators"
```

### Task 2: Firebase Web Bootstrap Package

**Files:**

- Modify: `package.json`
- Modify: `vitest.workspace.ts`
- Modify: `packages/shared-firebase/package.json`
- Modify: `packages/shared-firebase/src/index.ts`
- Create: `packages/shared-firebase/src/env.ts`
- Create: `packages/shared-firebase/src/app.ts`
- Create: `packages/shared-firebase/src/auth.ts`
- Create: `packages/shared-firebase/src/firestore.ts`
- Create: `packages/shared-firebase/src/env.test.ts`
- Create: `packages/shared-firebase/vitest.config.ts`

- [ ] **Step 1: Add Firebase web runtime support and a failing unit test for env parsing**

```bash
pnpm add --filter @bantayog/shared-firebase firebase
```

```ts
// packages/shared-firebase/src/env.test.ts
import { describe, expect, it } from 'vitest'
import { getSessionTimeoutMs, parseFirebaseWebEnv } from './index.js'

describe('parseFirebaseWebEnv', () => {
  it('reads the required Vite env values', () => {
    expect(
      parseFirebaseWebEnv({
        VITE_FIREBASE_API_KEY: 'api-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
        VITE_FIREBASE_PROJECT_ID: 'demo-project',
        VITE_FIREBASE_APP_ID: '1:123:web:abc',
        VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
        VITE_FIREBASE_STORAGE_BUCKET: 'demo-project.appspot.com',
        VITE_FIREBASE_APP_CHECK_SITE_KEY: 'site-key',
      }),
    ).toMatchObject({ projectId: 'demo-project' })
  })
})

describe('getSessionTimeoutMs', () => {
  it('uses the architecture-spec timeout ladder', () => {
    expect(getSessionTimeoutMs('provincial_superadmin')).toBe(4 * 60 * 60 * 1000)
    expect(getSessionTimeoutMs('municipal_admin')).toBe(8 * 60 * 60 * 1000)
    expect(getSessionTimeoutMs('responder')).toBe(12 * 60 * 60 * 1000)
    expect(getSessionTimeoutMs('citizen')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the shared Firebase unit tests to verify they fail**

Run: `pnpm exec vitest run packages/shared-firebase/src/env.test.ts`

Expected: FAIL because `parseFirebaseWebEnv` and `getSessionTimeoutMs` are not exported yet.

- [ ] **Step 3: Implement the Firebase web bootstrap and add the package to the Vitest workspace**

```ts
// packages/shared-firebase/src/env.ts
import type { UserRole } from '@bantayog/shared-types'

export interface FirebaseWebEnv {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  messagingSenderId: string
  storageBucket: string
  appCheckSiteKey: string
}

export function parseFirebaseWebEnv(source: Record<string, string | undefined>): FirebaseWebEnv {
  const required = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_APP_CHECK_SITE_KEY',
  ] as const

  for (const key of required) {
    if (!source[key]) {
      throw new Error(`Missing required Firebase env var: ${key}`)
    }
  }

  return {
    apiKey: source.VITE_FIREBASE_API_KEY!,
    authDomain: source.VITE_FIREBASE_AUTH_DOMAIN!,
    projectId: source.VITE_FIREBASE_PROJECT_ID!,
    appId: source.VITE_FIREBASE_APP_ID!,
    messagingSenderId: source.VITE_FIREBASE_MESSAGING_SENDER_ID!,
    storageBucket: source.VITE_FIREBASE_STORAGE_BUCKET!,
    appCheckSiteKey: source.VITE_FIREBASE_APP_CHECK_SITE_KEY!,
  }
}

export function getSessionTimeoutMs(role: UserRole): number | null {
  if (role === 'provincial_superadmin') return 4 * 60 * 60 * 1000
  if (role === 'municipal_admin' || role === 'agency_admin') return 8 * 60 * 60 * 1000
  if (role === 'responder') return 12 * 60 * 60 * 1000
  return null
}
```

```ts
// packages/shared-firebase/src/app.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check'
import type { FirebaseWebEnv } from './env.js'

export function createFirebaseWebApp(env: FirebaseWebEnv): FirebaseApp {
  if (getApps().length > 0) {
    return getApp()
  }

  return initializeApp({
    apiKey: env.apiKey,
    authDomain: env.authDomain,
    projectId: env.projectId,
    appId: env.appId,
    messagingSenderId: env.messagingSenderId,
    storageBucket: env.storageBucket,
  })
}

export function createAppCheck(app: FirebaseApp, env: FirebaseWebEnv): AppCheck {
  return initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(env.appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
}
```

```ts
// packages/shared-firebase/src/auth.ts
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth, type User } from 'firebase/auth'
import type { FirebaseApp } from 'firebase/app'

export async function ensurePseudonymousSignIn(auth: Auth): Promise<User> {
  if (auth.currentUser) return auth.currentUser
  const credential = await signInAnonymously(auth)
  return credential.user
}

export function getFirebaseAuth(app: FirebaseApp): Auth {
  return getAuth(app)
}

export function subscribeAuth(auth: Auth, callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}
```

```ts
// packages/shared-firebase/src/firestore.ts
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  orderBy,
  limit,
  type Firestore,
} from 'firebase/firestore'
import type { FirebaseApp } from 'firebase/app'
import type { AlertDoc, MinAppVersionDoc } from '@bantayog/shared-types'

export function getFirebaseDb(app: FirebaseApp): Firestore {
  return getFirestore(app)
}

export function subscribeMinAppVersion(
  db: Firestore,
  callback: (value: MinAppVersionDoc | null) => void,
): () => void {
  return onSnapshot(doc(db, 'system_config', 'min_app_version'), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.data() as MinAppVersionDoc) : null)
  })
}

export function subscribeAlerts(db: Firestore, callback: (value: AlertDoc[]) => void): () => void {
  return onSnapshot(
    query(collection(db, 'alerts'), orderBy('publishedAt', 'desc'), limit(5)),
    (snapshot) => {
      callback(snapshot.docs.map((item) => item.data() as AlertDoc))
    },
  )
}
```

```ts
// packages/shared-firebase/src/index.ts
export { createFirebaseWebApp, createAppCheck } from './app.js'
export { ensurePseudonymousSignIn, getFirebaseAuth, subscribeAuth } from './auth.js'
export { getFirebaseDb, subscribeAlerts, subscribeMinAppVersion } from './firestore.js'
export { getSessionTimeoutMs, parseFirebaseWebEnv, type FirebaseWebEnv } from './env.js'
```

```ts
// packages/shared-firebase/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

```ts
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace(['packages/shared-validators', 'packages/shared-firebase'])
```

```json
// package.json
{
  "scripts": {
    "test": "vitest run",
    "test:phase1:rules": "firebase emulators:exec --only firestore \"pnpm --filter @bantayog/functions test:rules\"",
    "test:phase1:local": "pnpm test && pnpm --filter @bantayog/functions test:unit && pnpm test:phase1:rules"
  }
}
```

- [ ] **Step 4: Run the shared Firebase tests and package typecheck**

Run: `pnpm test`
Expected: PASS for `packages/shared-validators` and `packages/shared-firebase`.

Run: `pnpm --filter @bantayog/shared-firebase typecheck`
Expected: PASS with zero TypeScript errors.

- [ ] **Step 5: Commit the Firebase bootstrap package**

```bash
git add package.json vitest.workspace.ts packages/shared-firebase
git commit -m "feat(phase-1): add firebase web bootstrap helpers"
```

### Task 3: Phase 1 Firestore Rules and Rules Tests

**Files:**

- Modify: `functions/package.json`
- Create: `functions/src/__tests__/firestore.rules.test.ts`
- Create: `functions/vitest.config.ts`
- Modify: `infra/firebase/firestore.rules`

- [ ] **Step 1: Add the rules-test dependency and write the failing rules test**

```bash
pnpm add --filter @bantayog/functions -D @firebase/rules-unit-testing
```

```ts
// functions/src/__tests__/firestore.rules.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-phase-1',
    firestore: {
      rules: readFileSync(resolve(process.cwd(), '../infra/firebase/firestore.rules'), 'utf8'),
    },
  })

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    await db.collection('alerts').doc('hello').set({
      title: 'System online',
      body: 'Citizen shell wired for Phase 1.',
      severity: 'info',
      publishedAt: 1713350400000,
      publishedBy: 'phase-1-bootstrap',
    })

    await db.collection('system_config').doc('min_app_version').set({
      citizen: '0.1.0',
      admin: '0.1.0',
      responder: '0.1.0',
      updatedAt: 1713350400000,
    })

    await db
      .collection('active_accounts')
      .doc('super-1')
      .set({
        uid: 'super-1',
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
        mfaEnrolled: true,
        lastClaimIssuedAt: 1713350400000,
        updatedAt: 1713350400000,
      })

    await db
      .collection('active_accounts')
      .doc('suspended-1')
      .set({
        uid: 'suspended-1',
        role: 'municipal_admin',
        accountStatus: 'suspended',
        municipalityId: 'daet',
        permittedMunicipalityIds: ['daet'],
        mfaEnrolled: false,
        lastClaimIssuedAt: 1713350400000,
        updatedAt: 1713350400000,
      })

    await db.collection('claim_revocations').doc('super-1').set({
      uid: 'super-1',
      revokedAt: 1713350400000,
      reason: 'claims_updated',
    })
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('phase 1 firestore rules', () => {
  it('allows authenticated users to read alerts', async () => {
    const db = testEnv
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .firestore()

    await assertSucceeds(db.collection('alerts').doc('hello').get())
  })

  it('blocks unauthenticated users from reading alerts', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('alerts').doc('hello').get())
  })

  it('allows self-read on active_accounts and blocks cross-user reads', async () => {
    const ownDb = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    const otherDb = testEnv
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .firestore()

    await assertSucceeds(ownDb.collection('active_accounts').doc('super-1').get())
    await assertFails(otherDb.collection('active_accounts').doc('super-1').get())
  })

  it('blocks suspended privileged writes through isActivePrivileged', async () => {
    const db = testEnv
      .authenticatedContext('suspended-1', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertFails(
      db.collection('system_config').doc('min_app_version').set({
        citizen: '0.1.1',
        admin: '0.1.1',
        responder: '0.1.1',
        updatedAt: 1713350401000,
      }),
    )
  })

  it('allows active superadmin writes to system_config', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertSucceeds(
      db.collection('system_config').doc('min_app_version').set({
        citizen: '0.1.1',
        admin: '0.1.1',
        responder: '0.1.1',
        updatedAt: 1713350401000,
      }),
    )
  })
})
```

- [ ] **Step 2: Run the rules test to verify it fails against the Phase 0 deny-all rules**

Run: `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions exec vitest run src/__tests__/firestore.rules.test.ts"`

Expected: FAIL because `alerts`, `system_config`, `active_accounts`, and `claim_revocations` are still fully denied.

- [ ] **Step 3: Implement the Phase 1 rule surface and rules test scripts**

```json
// functions/package.json
{
  "scripts": {
    "test": "vitest run --passWithNoTests",
    "test:unit": "vitest run src/__tests__/phase1-auth.test.ts",
    "test:rules": "vitest run src/__tests__/firestore.rules.test.ts"
  }
}
```

```ts
// functions/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
})
```

```text
// infra/firebase/firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthed() {
      return request.auth != null;
    }

    function uid() {
      return request.auth.uid;
    }

    function role() {
      return request.auth.token.role;
    }

    function permittedMunis() {
      return request.auth.token.permittedMunicipalityIds != null
        ? request.auth.token.permittedMunicipalityIds
        : [];
    }

    function isSuperadmin() {
      return isAuthed() && role() == 'provincial_superadmin';
    }

    function isActivePrivileged() {
      return exists(/databases/$(database)/documents/active_accounts/$(uid()))
        && get(/databases/$(database)/documents/active_accounts/$(uid())).data.accountStatus == 'active';
    }

    match /alerts/{alertId} {
      allow read: if isAuthed();
      allow write: if false;
    }

    match /system_config/{configId} {
      allow read: if isAuthed();
      allow write: if isSuperadmin() && isActivePrivileged();
    }

    match /active_accounts/{accountUid} {
      allow read: if isAuthed() && uid() == accountUid;
      allow write: if false;
    }

    match /claim_revocations/{accountUid} {
      allow read: if isAuthed() && uid() == accountUid;
      allow write: if false;
    }

    match /rate_limits/{rateKey} {
      allow read, write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 4: Re-run the rules test and verify the Phase 1 rule surface passes**

Run: `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test:rules"`

Expected: PASS with authenticated alert reads, self-only reads on support collections, active privileged config writes, and suspended privileged writes denied.

- [ ] **Step 5: Commit the Firestore rules work**

```bash
git add functions/package.json functions/vitest.config.ts functions/src/__tests__/firestore.rules.test.ts infra/firebase/firestore.rules
git commit -m "feat(phase-1): add firestore rule surface for identity spine"
```

### Task 4: Claims, Revocation, and Seed Logic in Functions

**Files:**

- Modify: `functions/src/index.ts`
- Create: `functions/src/firebase-admin.ts`
- Create: `functions/src/auth/custom-claims.ts`
- Create: `functions/src/auth/account-lifecycle.ts`
- Create: `functions/src/bootstrap/phase1-seed.ts`
- Create: `functions/src/__tests__/phase1-auth.test.ts`
- Create: `functions/scripts/bootstrap-phase1.ts`

- [ ] **Step 1: Write the failing unit tests for claim issuance, suspension, and seed assembly**

```bash
pnpm add --filter @bantayog/functions -D tsx
```

```ts
// functions/src/__tests__/phase1-auth.test.ts
import { describe, expect, it } from 'vitest'
import {
  buildActiveAccountDoc,
  buildClaimRevocationDoc,
  buildStaffClaims,
} from '../auth/custom-claims.js'
import { buildPhase1SeedDocs } from '../bootstrap/phase1-seed.js'

describe('buildStaffClaims', () => {
  it('builds municipal admin claims with scoped municipality access', () => {
    expect(
      buildStaffClaims({
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
        permittedMunicipalityIds: ['daet'],
        mfaEnrolled: false,
      }),
    ).toMatchObject({
      role: 'municipal_admin',
      municipalityId: 'daet',
      permittedMunicipalityIds: ['daet'],
      accountStatus: 'active',
    })
  })
})

describe('buildActiveAccountDoc', () => {
  it('keeps the active-account document aligned with the claims payload', () => {
    const claims = buildStaffClaims({
      uid: 'responder-1',
      role: 'responder',
      agencyId: 'bfp-daet',
      permittedMunicipalityIds: ['daet'],
      mfaEnrolled: false,
    })

    expect(buildActiveAccountDoc('responder-1', claims, 1713350400000)).toMatchObject({
      uid: 'responder-1',
      agencyId: 'bfp-daet',
      accountStatus: 'active',
    })
  })
})

describe('buildClaimRevocationDoc', () => {
  it('creates a revocation payload for suspended accounts', () => {
    expect(buildClaimRevocationDoc('admin-1', 1713350400000, 'suspended')).toEqual({
      uid: 'admin-1',
      revokedAt: 1713350400000,
      reason: 'suspended',
    })
  })
})

describe('buildPhase1SeedDocs', () => {
  it('returns min app version config and one hello-world alert', () => {
    const seed = buildPhase1SeedDocs(1713350400000)

    expect(seed.systemConfig.min_app_version).toMatchObject({
      citizen: '0.1.0',
      admin: '0.1.0',
      responder: '0.1.0',
    })
    expect(seed.alerts).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the functions unit tests to verify they fail**

Run: `pnpm --filter @bantayog/functions test:unit`

Expected: FAIL with missing module or export errors for the claim and seed helpers.

- [ ] **Step 3: Implement the pure helpers, callable wrappers, admin bootstrap, and staging seed script**

```ts
// functions/src/firebase-admin.ts
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const app = getApps().length > 0 ? getApps()[0]! : initializeApp()

export const adminAuth = getAuth(app)
export const adminDb = getFirestore(app)
```

```ts
// functions/src/auth/custom-claims.ts
import type { CustomClaims } from '@bantayog/shared-types'
import { setStaffClaimsInputSchema } from '@bantayog/shared-validators'

export function buildStaffClaims(input: unknown): CustomClaims {
  const parsed = setStaffClaimsInputSchema.parse(input)
  const issuedAt = Date.now()

  return {
    role: parsed.role,
    municipalityId: parsed.municipalityId,
    agencyId: parsed.agencyId,
    permittedMunicipalityIds: parsed.permittedMunicipalityIds,
    accountStatus: 'active',
    mfaEnrolled: parsed.mfaEnrolled,
    lastClaimIssuedAt: issuedAt,
  }
}

export function buildActiveAccountDoc(uid: string, claims: CustomClaims, updatedAt: number) {
  return {
    uid,
    role: claims.role,
    accountStatus: claims.accountStatus,
    municipalityId: claims.municipalityId,
    agencyId: claims.agencyId,
    permittedMunicipalityIds: claims.permittedMunicipalityIds ?? [],
    mfaEnrolled: claims.mfaEnrolled,
    lastClaimIssuedAt: claims.lastClaimIssuedAt,
    updatedAt,
  }
}

export function buildClaimRevocationDoc(
  uid: string,
  revokedAt: number,
  reason: 'suspended' | 'claims_updated' | 'manual_refresh',
) {
  return { uid, revokedAt, reason }
}
```

```ts
// functions/src/auth/account-lifecycle.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { suspendStaffAccountInputSchema } from '@bantayog/shared-validators'
import { adminAuth, adminDb } from '../firebase-admin.js'
import {
  buildActiveAccountDoc,
  buildClaimRevocationDoc,
  buildStaffClaims,
} from './custom-claims.js'

export const setStaffClaims = onCall(async (request) => {
  if (!request.auth || request.auth.token.role !== 'provincial_superadmin') {
    throw new HttpsError('permission-denied', 'Only superadmins can set staff claims.')
  }

  const claims = buildStaffClaims(request.data)
  const updatedAt = Date.now()
  const uid = request.data.uid as string

  await adminAuth.setCustomUserClaims(uid, claims)
  await adminDb
    .collection('active_accounts')
    .doc(uid)
    .set(buildActiveAccountDoc(uid, claims, updatedAt))
  await adminDb
    .collection('claim_revocations')
    .doc(uid)
    .set(buildClaimRevocationDoc(uid, updatedAt, 'claims_updated'))

  return { uid, claims }
})

export const suspendStaffAccount = onCall(async (request) => {
  if (!request.auth || request.auth.token.role !== 'provincial_superadmin') {
    throw new HttpsError('permission-denied', 'Only superadmins can suspend accounts.')
  }

  const input = suspendStaffAccountInputSchema.parse(request.data)
  const snapshot = await adminDb.collection('active_accounts').doc(input.uid).get()

  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'Active account record not found.')
  }

  const current = snapshot.data()!
  const revokedAt = Date.now()

  await adminDb
    .collection('active_accounts')
    .doc(input.uid)
    .set({ ...current, accountStatus: 'suspended', updatedAt: revokedAt }, { merge: true })
  await adminDb
    .collection('claim_revocations')
    .doc(input.uid)
    .set(buildClaimRevocationDoc(input.uid, revokedAt, 'suspended'))

  return { uid: input.uid, status: 'suspended' }
})
```

```ts
// functions/src/bootstrap/phase1-seed.ts
export function buildPhase1SeedDocs(updatedAt: number) {
  return {
    systemConfig: {
      min_app_version: {
        citizen: '0.1.0',
        admin: '0.1.0',
        responder: '0.1.0',
        updatedAt,
      },
    },
    alerts: [
      {
        id: 'phase1-hello',
        title: 'System online',
        body: 'Citizen shell wired for Phase 1.',
        severity: 'info',
        publishedAt: updatedAt,
        publishedBy: 'phase-1-bootstrap',
      },
    ],
  }
}
```

```ts
// functions/scripts/bootstrap-phase1.ts
import { adminDb } from '../src/firebase-admin.js'
import { buildPhase1SeedDocs } from '../src/bootstrap/phase1-seed.js'

async function main() {
  const updatedAt = Date.now()
  const seed = buildPhase1SeedDocs(updatedAt)

  await adminDb
    .collection('system_config')
    .doc('min_app_version')
    .set(seed.systemConfig.min_app_version)

  for (const alert of seed.alerts) {
    await adminDb.collection('alerts').doc(alert.id).set(alert)
  }
}

void main()
```

```ts
// functions/src/index.ts
export { setStaffClaims, suspendStaffAccount } from './auth/account-lifecycle.js'
```

```json
// functions/package.json
{
  "scripts": {
    "test": "vitest run --passWithNoTests",
    "test:unit": "vitest run src/__tests__/phase1-auth.test.ts",
    "test:rules": "vitest run src/__tests__/firestore.rules.test.ts",
    "bootstrap:phase1": "tsx scripts/bootstrap-phase1.ts"
  }
}
```

- [ ] **Step 4: Re-run the functions unit test and typecheck commands**

Run: `pnpm --filter @bantayog/functions test:unit`
Expected: PASS with all helper tests green.

Run: `pnpm --filter @bantayog/functions typecheck`
Expected: PASS with callable exports and script imports compiling cleanly.

- [ ] **Step 5: Commit the functions logic**

```bash
git add functions/src functions/scripts functions/package.json
git commit -m "feat(phase-1): add claim and revocation functions"
```

### Task 5: Citizen PWA Pseudonymous Hello-World Shell

**Files:**

- Modify: `package.json`
- Modify: `vitest.workspace.ts`
- Modify: `apps/citizen-pwa/package.json`
- Modify: `apps/citizen-pwa/src/App.tsx`
- Modify: `apps/citizen-pwa/src/App.module.css`
- Create: `apps/citizen-pwa/src/useCitizenShell.ts`
- Create: `apps/citizen-pwa/src/App.test.tsx`
- Create: `apps/citizen-pwa/vitest.config.ts`

- [ ] **Step 1: Add the citizen app test/runtime dependency and write the failing app test**

```bash
pnpm add --filter @bantayog/citizen-pwa @bantayog/shared-firebase
pnpm add --filter @bantayog/citizen-pwa -D @testing-library/react @testing-library/jest-dom
```

```ts
// apps/citizen-pwa/src/App.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { App } from './App.js'

vi.mock('./useCitizenShell.js', () => ({
  useCitizenShell: () => ({
    status: 'ready',
    authState: 'signed-in',
    appCheckState: 'active',
    user: { uid: 'anon-123' },
    minAppVersion: { citizen: '0.1.0', admin: '0.1.0', responder: '0.1.0' },
    alerts: [
      {
        title: 'System online',
        body: 'Citizen shell wired for Phase 1.',
        severity: 'info',
        publishedAt: 1713350400000,
        publishedBy: 'phase-1-bootstrap',
      },
    ],
    error: null,
  }),
}))

describe('App', () => {
  it('renders auth status, app version, and the hello-world alert feed', () => {
    render(<App />)

    expect(screen.getByText(/anon-123/)).toBeInTheDocument()
    expect(screen.getByText(/System online/)).toBeInTheDocument()
    expect(screen.getByText(/0.1.0/)).toBeInTheDocument()
    expect(screen.getByText(/signed-in/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the citizen app test to verify it fails**

Run: `pnpm exec vitest run apps/citizen-pwa/src/App.test.tsx`

Expected: FAIL because `useCitizenShell` does not exist and the app still renders the Phase 0 placeholder.

- [ ] **Step 3: Implement the citizen shell hook, app UI, and Vitest wiring**

```ts
// apps/citizen-pwa/src/useCitizenShell.ts
import { useEffect, useState } from 'react'
import {
  createAppCheck,
  createFirebaseWebApp,
  ensurePseudonymousSignIn,
  getFirebaseAuth,
  getFirebaseDb,
  parseFirebaseWebEnv,
  subscribeAlerts,
  subscribeMinAppVersion,
} from '@bantayog/shared-firebase'
import type { AlertDoc, MinAppVersionDoc } from '@bantayog/shared-types'

type ShellState = {
  status: 'booting' | 'ready' | 'error'
  authState: 'signed-out' | 'signed-in'
  appCheckState: 'pending' | 'active' | 'failed'
  user: { uid: string } | null
  minAppVersion: MinAppVersionDoc | null
  alerts: AlertDoc[]
  error: string | null
}

const initialState: ShellState = {
  status: 'booting',
  authState: 'signed-out',
  appCheckState: 'pending',
  user: null,
  minAppVersion: null,
  alerts: [],
  error: null,
}

export function useCitizenShell(): ShellState {
  const [state, setState] = useState<ShellState>(initialState)

  useEffect(() => {
    const env = parseFirebaseWebEnv(import.meta.env)
    const app = createFirebaseWebApp(env)
    const db = getFirebaseDb(app)
    const auth = getFirebaseAuth(app)

    try {
      createAppCheck(app, env)
      setState((current) => ({ ...current, appCheckState: 'active' }))
    } catch (error) {
      setState((current) => ({
        ...current,
        appCheckState: 'failed',
        error: error instanceof Error ? error.message : 'App Check initialization failed',
      }))
    }

    let stopAlerts = () => {}
    let stopVersion = () => {}

    void ensurePseudonymousSignIn(auth)
      .then((user) => {
        stopVersion = subscribeMinAppVersion(db, (minAppVersion) => {
          setState((current) => ({
            ...current,
            status: 'ready',
            authState: 'signed-in',
            user: { uid: user.uid },
            minAppVersion,
          }))
        })

        stopAlerts = subscribeAlerts(db, (alerts) => {
          setState((current) => ({
            ...current,
            status: 'ready',
            authState: 'signed-in',
            user: { uid: user.uid },
            alerts,
          }))
        })
      })
      .catch((error) => {
        setState({
          ...initialState,
          status: 'error',
          appCheckState: 'failed',
          error: error instanceof Error ? error.message : 'Pseudonymous sign-in failed',
        })
      })

    return () => {
      stopAlerts()
      stopVersion()
    }
  }, [])

  return state
}
```

```tsx
// apps/citizen-pwa/src/App.tsx
import styles from './App.module.css'
import { useCitizenShell } from './useCitizenShell.js'

export function App() {
  const state = useCitizenShell()

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>Bantayog Alert</p>
        <h1 className={styles.title}>Citizen Phase 1 shell</h1>
        <p className={styles.summary}>
          Pseudonymous sign-in, app health, and a hello-world alert feed.
        </p>

        <dl className={styles.meta}>
          <div>
            <dt>Status</dt>
            <dd>{state.status}</dd>
          </div>
          <div>
            <dt>Auth</dt>
            <dd>{state.authState}</dd>
          </div>
          <div>
            <dt>App Check</dt>
            <dd>{state.appCheckState}</dd>
          </div>
          <div>
            <dt>User UID</dt>
            <dd>{state.user?.uid ?? 'unavailable'}</dd>
          </div>
          <div>
            <dt>Minimum citizen version</dt>
            <dd>{state.minAppVersion?.citizen ?? 'unavailable'}</dd>
          </div>
        </dl>

        {state.error ? <p className={styles.error}>{state.error}</p> : null}

        <div className={styles.feed}>
          {state.alerts.map((alert) => (
            <article key={`${alert.title}-${alert.publishedAt}`} className={styles.alert}>
              <h2>{alert.title}</h2>
              <p>{alert.body}</p>
              <span>{alert.severity}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
```

```css
/* apps/citizen-pwa/src/App.module.css */
@import '@bantayog/shared-ui/theme.css';

.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: var(--space-8);
  background:
    radial-gradient(circle at top left, rgb(20 184 166 / 0.16), transparent 28rem),
    linear-gradient(180deg, #031521 0%, #0a2230 100%);
}

.panel {
  width: min(48rem, 100%);
  padding: var(--space-8);
  border-radius: 1.5rem;
  background: rgb(255 255 255 / 0.92);
  color: #092033;
  box-shadow: 0 24px 80px rgb(0 0 0 / 0.18);
}

.eyebrow {
  margin: 0 0 var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.75rem;
  color: #0f766e;
}

.title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3rem);
}

.summary {
  margin: var(--space-3) 0 var(--space-6);
  color: #345064;
}

.meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--space-4);
}

.feed {
  margin-top: var(--space-6);
  display: grid;
  gap: var(--space-4);
}

.alert {
  padding: var(--space-4);
  border-radius: 1rem;
  background: #ecfeff;
}

.error {
  color: #b91c1c;
}
```

```ts
// apps/citizen-pwa/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.tsx'],
    setupFiles: [],
  },
})
```

```json
// apps/citizen-pwa/package.json
{
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@bantayog/shared-firebase": "workspace:*"
  }
}
```

```ts
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/shared-validators',
  'packages/shared-firebase',
  'apps/citizen-pwa',
])
```

- [ ] **Step 4: Run the citizen app test, typecheck, and build commands**

Run: `pnpm exec vitest run apps/citizen-pwa/src/App.test.tsx`
Expected: PASS with the mocked shell state.

Run: `pnpm --filter @bantayog/citizen-pwa typecheck && pnpm --filter @bantayog/citizen-pwa build`
Expected: PASS with the new shell component bundled successfully.

- [ ] **Step 5: Commit the citizen shell UI**

```bash
git add vitest.workspace.ts apps/citizen-pwa package.json
git commit -m "feat(phase-1): add citizen pseudonymous hello-world shell"
```

### Task 6: Final Repository Verification and Phase Progress Capture

**Files:**

- Modify: `README.md`
- Modify: `docs/progress.md`

- [ ] **Step 1: Update repo docs for the new Phase 1 env vars, test commands, and progress entry**

```md
<!-- README.md -->

## Citizen PWA env vars

Set these in `apps/citizen-pwa/.env.local` for local development:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_APP_CHECK_SITE_KEY`

## Phase 1 verification

- `pnpm test`
- `pnpm --filter @bantayog/functions test:unit`
- `pnpm test:phase1:rules`
- `pnpm build`
```

```md
<!-- docs/progress.md -->

## Phase 1 Infrastructure and Identity Spine (In Progress)

### Verification checklist

| Step | Check                                                                                     | Result |
| ---- | ----------------------------------------------------------------------------------------- | ------ |
| 1    | `pnpm test`                                                                               | PASS   |
| 2    | `pnpm --filter @bantayog/functions test:unit`                                             | PASS   |
| 3    | `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test:rules"` | PASS   |
| 4    | `pnpm build`                                                                              | PASS   |
```

- [ ] **Step 2: Run the full local verification sweep**

Run: `pnpm test`
Expected: PASS for shared validators, shared Firebase, and citizen app tests.

Run: `pnpm --filter @bantayog/functions test:unit`
Expected: PASS for helper-level functions coverage.

Run: `pnpm test:phase1:rules`
Expected: PASS for the Phase 1 Firestore rule surface.

Run: `pnpm lint && pnpm typecheck && pnpm build`
Expected: PASS across the repository.

- [ ] **Step 3: Commit the documentation and verification result updates**

```bash
git add README.md docs/progress.md
git commit -m "docs(phase-1): record identity spine verification"
```

## Track A: Gated Environment Rollout

### Task 7: Staging Infrastructure and Firebase Wiring

**Files:**

- Modify: `infra/terraform/envs/staging/terraform.tfvars` if project IDs or service account emails changed during setup
- Use: `firebase.json`
- Use: `functions/scripts/bootstrap-phase1.ts`

- [ ] **Step 1: Initialize Terraform for staging and verify the configuration before apply**

Run: `terraform -chdir=infra/terraform init -backend-config=envs/staging/backend.hcl`
Expected: PASS with the staging backend configured.

Run: `terraform -chdir=infra/terraform validate`
Expected: PASS.

Run: `terraform -chdir=infra/terraform plan -var-file=envs/staging/terraform.tfvars`
Expected: PLAN shows Firebase project, IAM bindings, secrets, and service accounts without destructive drift.

- [ ] **Step 2: Apply Terraform in staging**

Run: `terraform -chdir=infra/terraform apply -var-file=envs/staging/terraform.tfvars`

Expected: APPLY complete with the Firebase project resources, IAM bindings, buckets, and service accounts created or updated.

- [ ] **Step 3: Enable the Firebase providers required for the Phase 1 milestone**

In the Firebase console for staging:

```text
Authentication:
- Enable Anonymous provider

App Check:
- Register the citizen web app
- Configure the web site key used by `VITE_FIREBASE_APP_CHECK_SITE_KEY`

Firestore:
- Confirm Native mode is enabled

Functions:
- Confirm the default service account can deploy Node.js 20 functions
```

Expected: Anonymous Auth and web App Check are both visible as enabled in staging.

- [ ] **Step 4: Populate the citizen PWA env vars and deploy the functions**

Create or update `apps/citizen-pwa/.env.local` with the staging project's real Firebase values. The file must contain these exact keys:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_APP_CHECK_SITE_KEY`

Run: `pnpm --filter @bantayog/functions build`
Expected: PASS.

Run: `firebase deploy --only functions:setStaffClaims,functions:suspendStaffAccount --project <staging-project-id>`
Expected: DEPLOY COMPLETE.

- [ ] **Step 5: Seed staging with Phase 1 config and hello-world alert data**

Run: `pnpm --filter @bantayog/functions bootstrap:phase1`

Expected: `system_config/min_app_version` exists in staging and `alerts/phase1-hello` is visible in Firestore.

### Task 8: Staging Milestone Verification

**Files:**

- Use: `apps/citizen-pwa/.env.local`
- Use: `functions/scripts/bootstrap-phase1.ts`
- Update if needed: `docs/progress.md`

- [ ] **Step 1: Verify citizen shell boot in a clean browser session**

Run: `pnpm --filter @bantayog/citizen-pwa dev`

Expected in the browser:

```text
Status: ready
Auth: signed-in
App Check: active
User UID: <anonymous uid>
Minimum citizen version: 0.1.0
Alert feed shows "System online"
```

- [ ] **Step 2: Verify staff claim issuance on a staging user**

Invoke `setStaffClaims` with a staging superadmin identity and this payload:

```json
{
  "uid": "staging-muni-admin-1",
  "role": "municipal_admin",
  "municipalityId": "daet",
  "permittedMunicipalityIds": ["daet"],
  "mfaEnrolled": false
}
```

Expected: the target user receives custom claims with `role`, `municipalityId`, `permittedMunicipalityIds`, `accountStatus: "active"`, and a fresh `lastClaimIssuedAt`. Firestore also contains `active_accounts/staging-muni-admin-1`.

- [ ] **Step 3: Verify suspension and revocation behavior**

Invoke `suspendStaffAccount` with:

```json
{
  "uid": "staging-muni-admin-1",
  "reason": "phase-1 suspension test"
}
```

Expected:

```text
active_accounts/staging-muni-admin-1.accountStatus == "suspended"
claim_revocations/staging-muni-admin-1 exists
the next privileged read or write from that user is denied by Firestore rules
```

- [ ] **Step 4: Mark the phase complete only after both Track A and Track B are green**

Use this completion checklist:

```text
[ ] Shared contracts and validators merged
[ ] Firebase web bootstrap merged
[ ] Firestore rule surface merged
[ ] Claim/revocation functions merged
[ ] Citizen shell merged
[ ] Local tests and build green
[ ] Terraform apply successful in staging
[ ] Anonymous Auth and App Check enabled in staging
[ ] Seed data present in staging
[ ] Citizen boot verified in clean browser
[ ] Staff claim issuance verified
[ ] Suspension and revocation verified
```
