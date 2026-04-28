# Phase 8A — Surge Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a k6 load test harness with 3 staging scenarios (dispatch contention, citizen burst, inbox sweep), a surge pre-warm operator runbook, and a runbook link in Admin Desktop.

**Architecture:** Three k6 scenario scripts share auth/callable/Firestore-REST helpers. A separate Node.js seed script handles Admin SDK fixture creation/teardown. All k6 scenarios run against staging via env vars; no CI integration. Terraform gets a `surge_min_instances` variable for manual pre-warm. Admin Desktop gets one static link in the existing Signal Controls card.

**Tech Stack:** k6 (load testing), Firebase REST APIs (identitytoolkit auth + Firestore REST writes/reads), firebase-admin (seed script), tsx (seed script runner), TypeScript/Node.js, Terraform HCL, React/TypeScript.

---

## File Map

| File                                                | Action | Responsibility                                                        |
| --------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `e2e-tests/k6/lib/firebase-auth.js`                 | Create | REST identitytoolkit sign-in (named + anonymous); token age assertion |
| `e2e-tests/k6/lib/callable.js`                      | Create | Firebase callable HTTPS POST wrapper + response helpers               |
| `e2e-tests/k6/lib/firestore-rest.js`                | Create | Firestore REST document GET + typed-value extractor                   |
| `e2e-tests/k6/seed.ts`                              | Create | Node.js seed/teardown via firebase-admin (dispatch + inbox items)     |
| `e2e-tests/k6/scenarios/accept-dispatch-race.js`    | Create | Scenario 1: dispatch contention                                       |
| `e2e-tests/k6/scenarios/citizen-submit-burst.js`    | Create | Scenario 2: anonymous Firestore write burst                           |
| `e2e-tests/k6/scenarios/cold-start-inbox.js`        | Create | Scenario 3: reconciliation sweep polling                              |
| `e2e-tests/k6/README.md`                            | Create | Run guide, env vars, pass/fail thresholds, cleanup                    |
| `infra/runbooks/surge-prewarm.md`                   | Create | Pre-warm operator runbook (new directory)                             |
| `infra/terraform/variables.tf`                      | Modify | Add `surge_min_instances` variable                                    |
| `apps/admin-desktop/src/pages/SystemHealthPage.tsx` | Modify | Static runbook link in Signal Controls card                           |
| Root `package.json`                                 | Modify | Add `load-test` script                                                |

---

## Task 1: k6 lib helpers

**Files:**

- Create: `e2e-tests/k6/lib/firebase-auth.js`
- Create: `e2e-tests/k6/lib/callable.js`
- Create: `e2e-tests/k6/lib/firestore-rest.js`

- [ ] **Step 1: Create the k6 directory structure**

```bash
mkdir -p e2e-tests/k6/lib e2e-tests/k6/scenarios
```

- [ ] **Step 2: Write `e2e-tests/k6/lib/firebase-auth.js`**

```javascript
// e2e-tests/k6/lib/firebase-auth.js
import http from 'k6/http'

const TOKEN_MAX_AGE_MS = 50 * 60 * 1000 // 50-min safety margin; tokens last 1 hour

/**
 * Signs in with email/password via REST identitytoolkit API.
 * Returns { token: string, uid: string, fetchedAt: number }
 */
export function getIdToken(apiKey, email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`
  const res = http.post(url, JSON.stringify({ email, password, returnSecureToken: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
  if (res.status !== 200) {
    throw new Error(`Firebase auth failed (${res.status}): ${res.body}`)
  }
  const body = JSON.parse(res.body)
  return { token: body.idToken, uid: body.localId, fetchedAt: Date.now() }
}

/**
 * Signs in anonymously via REST identitytoolkit API.
 * Returns { token: string, uid: string, fetchedAt: number }
 */
export function getAnonymousToken(apiKey) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`
  const res = http.post(url, JSON.stringify({ returnSecureToken: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
  if (res.status !== 200) {
    throw new Error(`Anonymous auth failed (${res.status}): ${res.body}`)
  }
  const body = JSON.parse(res.body)
  return { token: body.idToken, uid: body.localId, fetchedAt: Date.now() }
}

/**
 * Throws a descriptive error if the token was fetched more than 50 minutes ago.
 * Do not chain scenarios back-to-back for longer than 50 minutes without re-fetching tokens.
 */
export function assertTokenFresh(tokenData) {
  if (Date.now() - tokenData.fetchedAt > TOKEN_MAX_AGE_MS) {
    throw new Error(
      'ID token is stale — re-run the scenario. ' +
        'Do not chain scenarios for more than 50 min after initial token fetch.',
    )
  }
}
```

- [ ] **Step 3: Write `e2e-tests/k6/lib/callable.js`**

Firebase callable v2 functions are HTTPS endpoints. Success response body: `{ "result": {...} }`. Error response body: `{ "error": { "message": "...", "status": "ALREADY_EXISTS" | "NOT_FOUND" | ... } }`.

HTTP status code mapping used in this codebase:

- `CONFLICT` (BantayogErrorCode) → `already-exists` (HttpsError) → HTTP 409
- `FORBIDDEN` → `permission-denied` → HTTP 403
- `NOT_FOUND` → `not-found` → HTTP 404
- `RATE_LIMITED` → `resource-exhausted` → HTTP 429

```javascript
// e2e-tests/k6/lib/callable.js
import http from 'k6/http'
import { assertTokenFresh } from './firebase-auth.js'

/**
 * POST to a Firebase callable function.
 * URL: https://{region}-{projectId}.cloudfunctions.net/{functionName}
 * Returns the raw k6 response object.
 */
export function callFirebase(projectId, region, functionName, tokenData, data) {
  assertTokenFresh(tokenData)
  const url = `https://${region}-${projectId}.cloudfunctions.net/${functionName}`
  return http.post(url, JSON.stringify({ data }), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenData.token}`,
    },
  })
}

/** Returns true if the callable response is a 200 success */
export function isOk(res) {
  return res.status === 200
}

/**
 * Returns true if the callable response is CONFLICT (dispatch no longer pending).
 * HTTP 409 + error.status === 'ALREADY_EXISTS'
 */
export function isConflict(res) {
  if (res.status !== 409) return false
  try {
    return JSON.parse(res.body).error?.status === 'ALREADY_EXISTS'
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Write `e2e-tests/k6/lib/firestore-rest.js`**

Used by the cold-start scenario to poll a document's `processedAt` field.

Firestore REST wraps all values in typed objects:

- Numbers: `{ "integerValue": "123" }` or `{ "doubleValue": 1.5 }`
- Strings: `{ "stringValue": "abc" }`
- Booleans: `{ "booleanValue": true }`
- Timestamps: `{ "timestampValue": "2026-04-29T..." }`

```javascript
// e2e-tests/k6/lib/firestore-rest.js
import http from 'k6/http'
import { assertTokenFresh } from './firebase-auth.js'

/**
 * Reads a Firestore document via REST API.
 * Returns null if document does not exist.
 * Returns the raw `fields` object if found.
 */
export function readDocument(projectId, collection, docId, tokenData) {
  assertTokenFresh(tokenData)
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    `/databases/(default)/documents/${collection}/${docId}`
  const res = http.get(url, { headers: { Authorization: `Bearer ${tokenData.token}` } })
  if (res.status === 404) return null
  if (res.status !== 200) throw new Error(`Firestore read failed (${res.status}): ${res.body}`)
  return JSON.parse(res.body).fields ?? null
}

/**
 * Writes a new document to a Firestore collection via REST API (POST = auto-generated ID).
 * `fields` must use Firestore REST typed-value format.
 * Returns the created document resource name (includes the generated ID).
 */
export function createDocument(projectId, collection, fields, tokenData) {
  assertTokenFresh(tokenData)
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    `/databases/(default)/documents/${collection}`
  const res = http.post(url, JSON.stringify({ fields }), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenData.token}`,
    },
  })
  if (res.status !== 200) throw new Error(`Firestore write failed (${res.status}): ${res.body}`)
  return JSON.parse(res.body).name // e.g. "projects/.../documents/report_inbox/abc123"
}

/** Unwraps a single Firestore REST typed-value field */
export function extractValue(field) {
  if (!field) return undefined
  return (
    field.integerValue ??
    field.doubleValue ??
    field.stringValue ??
    field.booleanValue ??
    field.timestampValue ??
    null
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add e2e-tests/k6/lib/
git commit -m "feat(k6): add firebase-auth, callable, and firestore-rest helpers"
```

---

## Task 2: Seed/teardown script

**Files:**

- Create: `e2e-tests/k6/seed.ts`

This is a Node.js script — not a k6 script. It uses `firebase-admin` to create and delete staging fixtures. Run it before/after each k6 scenario via the shell commands shown in each task's run step.

- [ ] **Step 1: Verify `tsx` is available**

```bash
npx tsx --version
```

If missing: `pnpm add -D tsx -w`

- [ ] **Step 2: Write `e2e-tests/k6/seed.ts`**

The dispatch document shape is taken directly from `seedDispatch` in `functions/src/__tests__/helpers/seed-factories.ts`.

The inbox item shape is taken from `submitReport` in `apps/citizen-pwa/src/services/submit-report.ts` — it writes `{ reporterUid, clientCreatedAt, idempotencyKey, publicRef, secretHash, correlationId, payload }`.

```typescript
#!/usr/bin/env tsx
// e2e-tests/k6/seed.ts
//
// Usage:
//   tsx e2e-tests/k6/seed.ts seed dispatch <responderUid>
//   tsx e2e-tests/k6/seed.ts seed inbox
//   tsx e2e-tests/k6/seed.ts teardown dispatch <id1,id2,id3>
//   tsx e2e-tests/k6/seed.ts teardown inbox <id>
//
// Required env vars:
//   K6_FIREBASE_PROJECT_ID  — e.g. "bantayog-staging"
//   K6_SERVICE_ACCOUNT_JSON — path to staging service account JSON file
//
// NEVER point K6_SERVICE_ACCOUNT_JSON at a prod service account.

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const projectId = process.env.K6_FIREBASE_PROJECT_ID
if (!projectId) throw new Error('K6_FIREBASE_PROJECT_ID is required')

const saPath = process.env.K6_SERVICE_ACCOUNT_JSON
if (!saPath) throw new Error('K6_SERVICE_ACCOUNT_JSON (file path) is required')

const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8')) as ServiceAccount
initializeApp({ credential: cert(serviceAccount), projectId })
const db = getFirestore()

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedDispatch(responderUid: string): Promise<string> {
  // Shape matches seedDispatch() in functions/src/__tests__/helpers/seed-factories.ts
  // reportId uses a placeholder — acceptDispatch only reads status + assignedTo, not the report
  const ref = db.collection('dispatches').doc()
  const now = Timestamp.now()
  await ref.set({
    dispatchId: ref.id,
    reportId: `k6-placeholder-report-${ref.id}`,
    status: 'pending',
    assignedTo: {
      uid: responderUid,
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
    },
    dispatchedAt: now,
    lastStatusAt: now,
    acknowledgementDeadlineAt: Timestamp.fromMillis(now.toMillis() + 15 * 60 * 1000),
    correlationId: crypto.randomUUID(),
    schemaVersion: 1,
  })
  return ref.id
}

async function seedInboxItem(): Promise<string> {
  // Shape matches writeInbox() call in apps/citizen-pwa/src/services/submit-report.ts
  // clientCreatedAt is 10 min in the past so the reconciliation sweep picks it up immediately.
  // The sweep queries: clientCreatedAt < (now - 2min) AND processedAt == null
  const ref = db.collection('report_inbox').doc()
  await ref.set({
    reporterUid: 'k6-test-citizen',
    clientCreatedAt: Date.now() - 10 * 60 * 1000,
    idempotencyKey: crypto.randomUUID(),
    publicRef: `K6-${ref.id.slice(0, 6).toUpperCase()}`,
    secretHash: `k6-placeholder-hash-${ref.id}`,
    correlationId: crypto.randomUUID(),
    payload: {
      reportType: 'flood',
      severity: 'medium',
      description: 'k6 sweep test item — please disregard',
      source: 'web',
      publicLocation: { lat: 14.1114, lng: 122.9551 },
      pendingMediaIds: [],
      municipalityId: 'daet',
      barangayId: 'lag-on',
    },
  })
  return ref.id
}

async function teardownDispatch(ids: string[]): Promise<void> {
  const batch = db.batch()
  for (const id of ids) batch.delete(db.collection('dispatches').doc(id))
  await batch.commit()
}

async function teardownInboxItem(id: string): Promise<void> {
  await db.collection('report_inbox').doc(id).delete()
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

const [, , command, subCommand, ...rest] = process.argv

async function main() {
  if (command === 'seed') {
    if (subCommand === 'dispatch') {
      const responderUid = rest[0]
      if (!responderUid) throw new Error('Usage: seed dispatch <responderUid>')
      const id = await seedDispatch(responderUid)
      console.log(JSON.stringify({ id }))
    } else if (subCommand === 'inbox') {
      const id = await seedInboxItem()
      console.log(JSON.stringify({ id }))
    } else {
      throw new Error(`Unknown seed subcommand: ${subCommand ?? '(none)'}`)
    }
  } else if (command === 'teardown') {
    if (subCommand === 'dispatch') {
      const ids = rest[0]?.split(',').filter(Boolean) ?? []
      if (!ids.length) throw new Error('Usage: teardown dispatch <id1,id2,...>')
      await teardownDispatch(ids)
      console.log(JSON.stringify({ deleted: ids }))
    } else if (subCommand === 'inbox') {
      const id = rest[0]
      if (!id) throw new Error('Usage: teardown inbox <id>')
      await teardownInboxItem(id)
      console.log(JSON.stringify({ deleted: id }))
    } else {
      throw new Error(`Unknown teardown subcommand: ${subCommand ?? '(none)'}`)
    }
  } else {
    throw new Error(`Unknown command: ${command ?? '(none)'}. Use: seed | teardown`)
  }
}

main().catch((err) => {
  console.error(String(err))
  process.exit(1)
})
```

- [ ] **Step 3: Smoke-test `seed dispatch`**

Set staging env vars first:

```bash
export K6_FIREBASE_PROJECT_ID=bantayog-staging
export K6_SERVICE_ACCOUNT_JSON=/path/to/bantayog-staging-service-account.json
export K6_TEST_RESPONDER_UID=<a real responder UID from staging Firebase Auth>
```

Run:

```bash
npx tsx e2e-tests/k6/seed.ts seed dispatch $K6_TEST_RESPONDER_UID
```

Expected output: `{"id":"abc123xyz"}` — verify in Firestore console that `dispatches/abc123xyz` exists with `status: "pending"` and `assignedTo.uid` matching your responder UID.

Teardown:

```bash
npx tsx e2e-tests/k6/seed.ts teardown dispatch abc123xyz
```

Expected: `{"deleted":["abc123xyz"]}` — document gone from Firestore.

- [ ] **Step 4: Smoke-test `seed inbox`**

```bash
npx tsx e2e-tests/k6/seed.ts seed inbox
```

Expected: `{"id":"def456"}` — verify in Firestore console that `report_inbox/def456` exists with `clientCreatedAt` approximately 10 minutes in the past and no `processedAt` field.

If the write is rejected by Firestore rules, check `firestore.rules` for the `report_inbox` write rule. The rule likely requires `request.auth.uid == request.resource.data.reporterUid`. Since this seed uses Admin SDK (bypasses rules), it should always succeed.

Teardown:

```bash
npx tsx e2e-tests/k6/seed.ts teardown inbox def456
```

- [ ] **Step 5: Commit**

```bash
git add e2e-tests/k6/seed.ts
git commit -m "feat(k6): add seed/teardown script for staging fixtures"
```

---

## Task 3: Scenario 1 — `accept-dispatch-race`

**Files:**

- Create: `e2e-tests/k6/scenarios/accept-dispatch-race.js`

**Context:** `acceptDispatch` (verified in `functions/src/callables/accept-dispatch.ts`) reads `status` and `assignedTo.uid` from the dispatch document. It gates on `assignedTo.uid === actor.uid` and `status === 'pending'`. The Firestore transaction ensures only the first commit wins; remaining concurrent callers see `status !== 'pending'` and receive HTTP 409 / `ALREADY_EXISTS`.

**Design:** 3 separate dispatch documents (one per race). k6 runs 3 scenarios in sequence with 20s gaps. All 50 VUs share one responder account. Each VU generates a unique `idempotencyKey` to bypass the dedup cache and independently hit the Firestore transaction.

**Pass:** `race_wins === 3`, `race_server_errors === 0`, `race_forbidden === 0`, p99 < 2s.

- [ ] **Step 1: Write the scenario**

```javascript
// e2e-tests/k6/scenarios/accept-dispatch-race.js
import { check } from 'k6'
import { Counter } from 'k6/metrics'
import { getIdToken } from '../lib/firebase-auth.js'
import { callFirebase, isOk, isConflict } from '../lib/callable.js'

// Required env vars (set before running — see README):
// K6_FIREBASE_PROJECT_ID, K6_FIREBASE_REGION, K6_API_KEY
// K6_TEST_RESPONDER_EMAIL, K6_TEST_RESPONDER_PASSWORD
// DISPATCH_IDS — comma-separated list of 3 dispatch document IDs pre-seeded via seed.ts

const PROJECT_ID = __ENV.K6_FIREBASE_PROJECT_ID
const REGION = __ENV.K6_FIREBASE_REGION
const API_KEY = __ENV.K6_API_KEY

const wins = new Counter('race_wins')
const conflicts = new Counter('race_conflicts')
const serverErrors = new Counter('race_server_errors')
const forbidden = new Counter('race_forbidden')

// Three scenarios in sequence; each race uses its own pre-seeded dispatch document.
// per-vu-iterations + iterations:1 means each VU fires exactly once per scenario.
// All 50 VUs start simultaneously (k6 schedules them together), giving approximately
// barrier-synchronized concurrent requests.
export const options = {
  scenarios: {
    race0: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '15s',
      startTime: '0s',
      env: { RACE_IDX: '0' },
    },
    race1: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '15s',
      startTime: '20s',
      env: { RACE_IDX: '1' },
    },
    race2: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '15s',
      startTime: '40s',
      env: { RACE_IDX: '2' },
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<2000'],
    race_server_errors: ['count==0'],
    race_forbidden: ['count==0'],
  },
}

export function setup() {
  const dispatchIds = __ENV.DISPATCH_IDS.split(',').map((s) => s.trim())
  if (dispatchIds.length < 3) {
    throw new Error('DISPATCH_IDS must contain exactly 3 comma-separated dispatch IDs')
  }
  const token = getIdToken(API_KEY, __ENV.K6_TEST_RESPONDER_EMAIL, __ENV.K6_TEST_RESPONDER_PASSWORD)
  return { dispatchIds, token }
}

export default function (data) {
  const raceIdx = Number(__ENV.RACE_IDX)
  const dispatchId = data.dispatchIds[raceIdx]
  // Unique idempotencyKey per VU call — bypasses withIdempotency dedup cache
  // so all 50 VUs independently enter the Firestore transaction
  const idempotencyKey = crypto.randomUUID()

  const res = callFirebase(PROJECT_ID, REGION, 'acceptDispatch', data.token, {
    dispatchId,
    idempotencyKey,
  })

  if (isOk(res)) wins.add(1)
  else if (isConflict(res)) conflicts.add(1)
  else if (res.status === 403) forbidden.add(1)
  else if (res.status >= 500) serverErrors.add(1)

  check(res, {
    'no server error': (r) => r.status < 500,
    'no forbidden (wrong responder UID or inactive account)': (r) => r.status !== 403,
    'winner or expected conflict': (r) => r.status === 200 || r.status === 409,
  })
}

export function handleSummary(data) {
  const totalWins = data.metrics.race_wins?.values?.count ?? 0
  const totalConflicts = data.metrics.race_conflicts?.values?.count ?? 0
  const totalErrors = data.metrics.race_server_errors?.values?.count ?? 0
  const totalForbidden = data.metrics.race_forbidden?.values?.count ?? 0
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] ?? 0

  const passed = totalWins === 3 && totalErrors === 0 && totalForbidden === 0 && p99 < 2000

  const summary = {
    passed,
    races: 3,
    wins: totalWins, // must equal 3
    conflicts: totalConflicts, // must equal 147 (49 per race)
    serverErrors: totalErrors, // must equal 0
    forbidden: totalForbidden, // must equal 0
    p99Ms: Math.round(p99),
    verdict: passed
      ? `PASS — wins=${totalWins}/3, errors=0, forbidden=0, p99=${Math.round(p99)}ms`
      : `FAIL — wins=${totalWins}/3, errors=${totalErrors}, forbidden=${totalForbidden}, p99=${Math.round(p99)}ms`,
  }

  console.log(JSON.stringify(summary, null, 2))
  return { stdout: JSON.stringify(summary, null, 2) }
}
```

- [ ] **Step 2: Seed 3 dispatches and run**

```bash
# Set env vars (do this once per session)
export K6_FIREBASE_PROJECT_ID=bantayog-staging
export K6_FIREBASE_REGION=asia-southeast1
export K6_API_KEY=<staging-web-api-key>
export K6_TEST_RESPONDER_EMAIL=<responder-test-account@staging>
export K6_TEST_RESPONDER_PASSWORD=<password>
export K6_TEST_RESPONDER_UID=<uid-matching-that-email>
export K6_SERVICE_ACCOUNT_JSON=/path/to/staging-service-account.json

# Seed 3 dispatches
ID1=$(npx tsx e2e-tests/k6/seed.ts seed dispatch $K6_TEST_RESPONDER_UID | jq -r '.id')
ID2=$(npx tsx e2e-tests/k6/seed.ts seed dispatch $K6_TEST_RESPONDER_UID | jq -r '.id')
ID3=$(npx tsx e2e-tests/k6/seed.ts seed dispatch $K6_TEST_RESPONDER_UID | jq -r '.id')
export DISPATCH_IDS="$ID1,$ID2,$ID3"

k6 run e2e-tests/k6/scenarios/accept-dispatch-race.js
```

Expected: `"passed": true`, `"wins": 3`, `"serverErrors": 0`, `"forbidden": 0`.

If you see `"forbidden": N > 0`: the test responder account's UID in `assignedTo.uid` does not match the token's UID. Verify `K6_TEST_RESPONDER_UID` matches the UID for `K6_TEST_RESPONDER_EMAIL` in Firebase Auth.

If you see `"wins": N > 3`: the Firestore transaction is not gating on status correctly. Check `accept-dispatch.ts` lines 55-65 and the `withIdempotency` cache TTL — if the dedup cache returns a cached "accepted" result instead of a fresh transaction, wins can exceed 3.

- [ ] **Step 3: Teardown**

```bash
npx tsx e2e-tests/k6/seed.ts teardown dispatch "$ID1,$ID2,$ID3"
```

- [ ] **Step 4: Commit**

```bash
git add e2e-tests/k6/scenarios/accept-dispatch-race.js
git commit -m "feat(k6): add accept-dispatch-race contention scenario"
```

---

## Task 4: Scenario 2 — `citizen-submit-burst`

**Files:**

- Create: `e2e-tests/k6/scenarios/citizen-submit-burst.js`

**Context:** Citizens write directly to `report_inbox` via the Firestore client SDK (verified in `apps/citizen-pwa/src/services/submit-report.ts` — no callable involved). k6 replicates this using the Firestore REST API with anonymous tokens. The document shape is taken directly from `submitReport` in the same file.

**Pass:** p99 < 10s, error rate < 1% (rate-limit 429s are acceptable, not counted as errors), 0 dead-letter growth.

- [ ] **Step 1: Record baseline dead-letter count before running**

Check `system_health/latest.deadLetterCount` in the staging Firestore console. Record this number as `BASELINE`.

- [ ] **Step 2: Write the scenario**

The Firestore REST API creates a document with a POST to `https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/{collection}`. Fields must use Firestore typed-value format (e.g., `{ "integerValue": "123" }` for numbers).

```javascript
// e2e-tests/k6/scenarios/citizen-submit-burst.js
import { check } from 'k6'
import { Counter } from 'k6/metrics'
import { getAnonymousToken } from '../lib/firebase-auth.js'
import { createDocument } from '../lib/firestore-rest.js'

// Required env vars: K6_FIREBASE_PROJECT_ID, K6_API_KEY

const PROJECT_ID = __ENV.K6_FIREBASE_PROJECT_ID
const API_KEY = __ENV.K6_API_KEY

const submitted = new Counter('citizen_submitted')
const rateLimited = new Counter('citizen_rate_limited')
const serverErrors = new Counter('citizen_server_errors')

export const options = {
  scenarios: {
    burst: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    // p99 of Firestore REST write must be under 10s
    http_req_duration: ['p(99)<10000'],
    // Server errors must be 0; rate limits (429) are excluded via the check below
    citizen_server_errors: ['count==0'],
  },
}

export function setup() {
  // Pre-fetch 100 anonymous tokens before the load clock starts.
  // Tokens last 1 hour; all 100 will be valid for the full 2-min run.
  const tokens = []
  for (let i = 0; i < 100; i++) {
    tokens.push(getAnonymousToken(API_KEY))
  }
  return { tokens }
}

export default function (data) {
  const token = data.tokens[__VU - 1]

  // Document shape mirrors writeInbox() in apps/citizen-pwa/src/services/submit-report.ts
  // Firestore REST requires all values wrapped in typed-value objects.
  const fields = {
    reporterUid: { stringValue: token.uid },
    // integerValue must be a string in JSON per Firestore REST spec
    clientCreatedAt: { integerValue: String(Date.now()) },
    idempotencyKey: { stringValue: crypto.randomUUID() },
    publicRef: { stringValue: `K6-${String(__VU).padStart(3, '0')}` },
    secretHash: { stringValue: `k6-placeholder-hash-vu${__VU}` },
    correlationId: { stringValue: crypto.randomUUID() },
    payload: {
      mapValue: {
        fields: {
          reportType: { stringValue: 'flood' },
          severity: { stringValue: 'medium' },
          description: {
            stringValue: `k6 load test VU${__VU} — please disregard`,
          },
          source: { stringValue: 'web' },
          publicLocation: {
            mapValue: {
              fields: {
                lat: { doubleValue: 14.1114 },
                lng: { doubleValue: 122.9551 },
              },
            },
          },
          pendingMediaIds: { arrayValue: { values: [] } },
          municipalityId: { stringValue: 'daet' },
          barangayId: { stringValue: 'lag-on' },
        },
      },
    },
  }

  // createDocument POSTs to Firestore REST — returns the resource name on success
  let res
  try {
    const name = createDocument(PROJECT_ID, 'report_inbox', fields, token)
    submitted.add(1)
    check({ name }, { 'document created': (v) => typeof v.name === 'string' })
  } catch (err) {
    // createDocument throws on non-200; inspect the error to classify
    const msg = String(err)
    if (msg.includes('429')) {
      rateLimited.add(1)
      // 429 is acceptable — rate limiting is correct behavior, not an error
    } else if (msg.includes('5')) {
      serverErrors.add(1)
    }
  }
}

export function handleSummary(data) {
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] ?? 0
  const errors = data.metrics.citizen_server_errors?.values?.count ?? 0
  const passed = p99 < 10000 && errors === 0

  const summary = {
    passed,
    p99Ms: Math.round(p99),
    serverErrors: errors,
    verdict: passed
      ? `PASS — p99=${Math.round(p99)}ms (<10000ms), serverErrors=0`
      : `FAIL — p99=${Math.round(p99)}ms, serverErrors=${errors}`,
    note: 'Check system_health/latest.deadLetterCount in Firestore console vs BASELINE after this run.',
  }

  console.log(JSON.stringify(summary, null, 2))
  return { stdout: JSON.stringify(summary, null, 2) }
}
```

- [ ] **Step 3: Run the scenario**

```bash
k6 run e2e-tests/k6/scenarios/citizen-submit-burst.js
```

Expected: `"passed": true`, `p99Ms < 10000`, `serverErrors: 0`.

- [ ] **Step 4: Check dead-letter growth**

Check `system_health/latest.deadLetterCount` in Firestore console again. Compare with BASELINE from Step 1. Pass = count unchanged.

If dead-letter count grew: check Cloud Functions logs for `processInboxItem` — look for errors processing the seeded documents and classify as environment-constrained or real regression per the spec.

- [ ] **Step 5: Commit**

```bash
git add e2e-tests/k6/scenarios/citizen-submit-burst.js
git commit -m "feat(k6): add citizen-submit-burst Firestore write scenario"
```

---

## Task 5: Scenario 3 — `cold-start-inbox`

**Files:**

- Create: `e2e-tests/k6/scenarios/cold-start-inbox.js`

**Context:** `inboxReconciliationSweep` (verified in `functions/src/triggers/inbox-reconciliation-sweep.ts`) runs every 5 minutes. It queries `report_inbox` where `clientCreatedAt < (now - 2min)` AND `processedAt` is not set. It atomically sets `processedAt` before calling `processInboxItemCore`. Once `processedAt` is set, the item is "accounted for."

The seed script creates an item with `clientCreatedAt` 10 minutes in the past — within scope on the very next sweep cycle.

**Pass per trial:** `processedAt` is set on the item within 5 min. Run 3 consecutive trials (seed → run → teardown × 3).

**Read access note:** The polling loop reads `report_inbox/{itemId}` using the admin account's ID token. If admin does not have read access to `report_inbox` per `firestore.rules`, polling will return 403. Check `functions/src/__tests__/rules/report-inbox.rules.test.ts` first. If admin can't read inbox, use the seed script's teardown to check `processedAt` from Node.js instead of from k6.

- [ ] **Step 1: Write the scenario**

```javascript
// e2e-tests/k6/scenarios/cold-start-inbox.js
// Runs ONE trial. Run this 3 times (seed → run → teardown).
// Pass: report_inbox/{INBOX_ITEM_ID}.processedAt is set within 5 min.
// Fail: 6-minute timeout with processedAt still unset.
//
// Required env vars: K6_FIREBASE_PROJECT_ID, K6_API_KEY,
//                    K6_TEST_ADMIN_EMAIL, K6_TEST_ADMIN_PASSWORD,
//                    INBOX_ITEM_ID (from seed script output)

import { check } from 'k6'
import { sleep } from 'k6'
import { Counter } from 'k6/metrics'
import exec from 'k6/execution'
import { getIdToken } from '../lib/firebase-auth.js'
import { readDocument, extractValue } from '../lib/firestore-rest.js'

const PROJECT_ID = __ENV.K6_FIREBASE_PROJECT_ID
const API_KEY = __ENV.K6_API_KEY
const ITEM_ID = __ENV.INBOX_ITEM_ID

const sweepFound = new Counter('sweep_found')

export const options = {
  scenarios: {
    poll: {
      executor: 'constant-vus',
      vus: 1,
      duration: '6m',
    },
  },
  thresholds: {
    // Must increment at least once (processedAt found) within the 6-min window
    sweep_found: ['count>=1'],
  },
}

export function setup() {
  if (!ITEM_ID) throw new Error('INBOX_ITEM_ID env var is required — run seed.ts first')
  const token = getIdToken(API_KEY, __ENV.K6_TEST_ADMIN_EMAIL, __ENV.K6_TEST_ADMIN_PASSWORD)
  return { token }
}

export default function (data) {
  const fields = readDocument(PROJECT_ID, 'report_inbox', ITEM_ID, data.token)

  if (fields === null) {
    console.error(`report_inbox/${ITEM_ID} not found — was it deleted prematurely?`)
    exec.test.abort('inbox item not found')
    return
  }

  const processedAt = extractValue(fields.processedAt)

  check(
    { processedAt },
    {
      'processedAt set (sweep claimed item)': (v) => v.processedAt != null,
    },
  )

  if (processedAt != null) {
    sweepFound.add(1)
    exec.test.abort() // stop polling immediately — no need to wait out the full 6 min
  }

  sleep(30) // poll every 30 seconds
}

export function handleSummary(data) {
  const found = data.metrics.sweep_found?.values?.count ?? 0
  const passed = found >= 1

  const summary = {
    passed,
    itemId: ITEM_ID,
    verdict: passed
      ? `PASS — processedAt set on report_inbox/${ITEM_ID} within polling window`
      : `FAIL — processedAt not set after 6 min. The reconciliation sweep did not claim ${ITEM_ID}.`,
  }

  console.log(JSON.stringify(summary, null, 2))
  return { stdout: JSON.stringify(summary, null, 2) }
}
```

- [ ] **Step 2: Run trial 1**

```bash
INBOX_ID=$(npx tsx e2e-tests/k6/seed.ts seed inbox | jq -r '.id')
export INBOX_ITEM_ID=$INBOX_ID

k6 run e2e-tests/k6/scenarios/cold-start-inbox.js

# Teardown regardless of pass/fail
npx tsx e2e-tests/k6/seed.ts teardown inbox $INBOX_ID
```

Expected: test exits before 6 min with `"passed": true`. The sweep runs every 5 min, so expect the test to exit around the 5-min mark on first pass.

If the admin token gets 403 when reading `report_inbox`: check `firestore.rules` for the `report_inbox` read rule. If admin role lacks read access, you have two options:

1. Add a narrow read rule for `municipal_admin` and `provincial_superadmin` on `report_inbox` (1-file change in `firestore.rules` + test — within the 3-file cap)
2. Use Node.js Admin SDK to check `processedAt` after the run (modify `seed.ts` to add a `check-processed <id>` command)

- [ ] **Step 3: Run trials 2 and 3**

Repeat Step 2 twice more. All 3 trials must pass before this task is complete.

- [ ] **Step 4: Commit**

```bash
git add e2e-tests/k6/scenarios/cold-start-inbox.js
git commit -m "feat(k6): add cold-start-inbox reconciliation sweep scenario"
```

---

## Task 6: k6 README + `package.json` script

**Files:**

- Create: `e2e-tests/k6/README.md`
- Modify: root `package.json`

- [ ] **Step 1: Write `e2e-tests/k6/README.md`**

````markdown
# k6 Load Test Scenarios — Phase 8A

Runs against **staging only**. Never point these at dev or prod.

## Prerequisites

- k6 installed: https://grafana.com/docs/k6/latest/set-up/install-k6/
- `jq` installed: `brew install jq`
- `tsx` available: `npx tsx --version` (or `pnpm add -D tsx -w`)
- Staging env vars set (see below)

## Required env vars

| Variable                     | Description                                                    |
| ---------------------------- | -------------------------------------------------------------- |
| `K6_FIREBASE_PROJECT_ID`     | Staging project ID, e.g. `bantayog-staging`                    |
| `K6_FIREBASE_REGION`         | Functions region, e.g. `asia-southeast1`                       |
| `K6_API_KEY`                 | Firebase Web API key (from staging project settings)           |
| `K6_TEST_ADMIN_EMAIL`        | Staging admin test account email                               |
| `K6_TEST_ADMIN_PASSWORD`     | Staging admin test account password                            |
| `K6_TEST_RESPONDER_EMAIL`    | Staging responder test account email                           |
| `K6_TEST_RESPONDER_PASSWORD` | Staging responder test account password                        |
| `K6_TEST_RESPONDER_UID`      | UID of the responder test account (from Firebase Auth)         |
| `K6_SERVICE_ACCOUNT_JSON`    | **File path** to staging service account JSON. NEVER use prod. |

## Scenarios

### Scenario 1: Dispatch contention (`accept-dispatch-race`)

**Pass:** exactly 3 wins (one per race), 0 server errors, 0 forbidden, p99 < 2s

```bash
# Seed
ID1=$(npx tsx e2e-tests/k6/seed.ts seed dispatch $K6_TEST_RESPONDER_UID | jq -r '.id')
ID2=$(npx tsx e2e-tests/k6/seed.ts seed dispatch $K6_TEST_RESPONDER_UID | jq -r '.id')
ID3=$(npx tsx e2e-tests/k6/seed.ts seed dispatch $K6_TEST_RESPONDER_UID | jq -r '.id')
export DISPATCH_IDS="$ID1,$ID2,$ID3"

# Run
k6 run e2e-tests/k6/scenarios/accept-dispatch-race.js

# Teardown
npx tsx e2e-tests/k6/seed.ts teardown dispatch "$ID1,$ID2,$ID3"
```
````

### Scenario 2: Citizen submission burst (`citizen-submit-burst`)

**Pass:** p99 < 10s, 0 server errors, dead-letter count unchanged from baseline

```bash
# Record baseline: check system_health/latest.deadLetterCount in Firestore console

# Run
k6 run e2e-tests/k6/scenarios/citizen-submit-burst.js

# Check dead-letter count in Firestore console — must match baseline
```

### Scenario 3: Inbox reconciliation sweep (`cold-start-inbox`)

**Pass:** processedAt set within 5 min (3 consecutive clean trials)

```bash
# Run 3 times (each is one trial):
for i in 1 2 3; do
  INBOX_ID=$(npx tsx e2e-tests/k6/seed.ts seed inbox | jq -r '.id')
  export INBOX_ITEM_ID=$INBOX_ID
  k6 run e2e-tests/k6/scenarios/cold-start-inbox.js
  npx tsx e2e-tests/k6/seed.ts teardown inbox $INBOX_ID
done
```

## Run order

Run in this order to avoid Firestore artifact interference:

1. Scenario 3 (cold-start)
2. Scenario 1 (contention)
3. Scenario 2 (burst)
4. Pre-warm drill (last — modifies infrastructure config)

## Failure classification

If a scenario fails:

1. Classify as **environment-constrained** (staging quota, rule difference vs prod) or **real regression** (logic bug)
2. Document in `docs/progress.md` with estimated prod impact
3. Real regressions: fix if ≤3 files, otherwise track as named issue
4. 8A exits regardless once all findings are classified

````

- [ ] **Step 2: Add `load-test` script to root `package.json`**

Read the root `package.json` first to find the `scripts` section, then add:

```json
"load-test": "k6 run e2e-tests/k6/scenarios/$SCENARIO.js"
````

Usage: `SCENARIO=accept-dispatch-race npm run load-test`

- [ ] **Step 3: Commit**

```bash
git add e2e-tests/k6/README.md package.json
git commit -m "feat(k6): add README and load-test package.json script"
```

---

## Task 7: Pre-warm runbook + Terraform variable

**Files:**

- Create: `infra/runbooks/surge-prewarm.md` (new directory)
- Modify: `infra/terraform/variables.tf`

- [ ] **Step 1: Read `infra/terraform/variables.tf`** to understand existing variable format before adding.

- [ ] **Step 2: Add `surge_min_instances` to `infra/terraform/variables.tf`**

Add this block at the end of the file (match indentation and style of existing variables):

```hcl
variable "surge_min_instances" {
  description = "minInstances for hot-path Cloud Functions during TCWS surge. Default: 3. Set to 20 during TCWS signal level >= 2 per the pre-warm runbook at infra/runbooks/surge-prewarm.md."
  type        = number
  default     = 3
}
```

- [ ] **Step 3: Find where Cloud Functions minInstances is configured**

Check `infra/terraform/main.tf` and `infra/terraform/modules/` for Cloud Functions resource definitions. Search for `processInboxItem`, `acceptDispatch`, `dispatchResponder`, `projectResponderLocations`. The `surge_min_instances` variable should be wired to those resources' `min_instances` argument.

If Cloud Functions are not yet configured in Terraform (Functions may be deployed via Firebase CLI instead), note this in the runbook and skip wiring the variable — the runbook will reference the Firebase Console manual approach instead.

- [ ] **Step 4: Create `infra/runbooks/` directory and write the runbook**

```bash
mkdir -p infra/runbooks
```

````markdown
# Surge Pre-warm Runbook

**Trigger:** TCWS signal level 2 or higher is declared in the System Health page.

**Purpose:** Raise `minInstances` on 4 hot-path Cloud Functions from 3 → 20 to eliminate cold-start latency during surge. Without pre-warm, the first 17 concurrent requests to each function after a cold period take 3-8 seconds for container startup.

**Target functions:**

- `processInboxItem`
- `acceptDispatch`
- `dispatchResponder`
- `projectResponderLocations`

---

## Option A: Terraform (preferred — IaC-tracked)

Only available if these functions are configured in Terraform. Check `infra/terraform/main.tf`.

1. Open `infra/terraform/variables.tf` and confirm `surge_min_instances` exists.
2. Run:
   ```bash
   cd infra/terraform
   terraform apply -var="surge_min_instances=20"
   ```
````

3. Verify in Firebase Console → Functions → each target function shows `Min instances: 20`.
4. Estimated apply time: ~3 min.

## Option B: Firebase Console (manual fallback)

Use this if functions are not managed by Terraform.

1. Go to Firebase Console → Functions.
2. For each of the 4 target functions:
   - Click the function name → Edit → Scroll to "Min instances" → Set to `20` → Save.
3. Estimated time: ~5 min per function.

---

## Revert

**When to revert:** When signal drops below level 2, **or** if signal stays elevated, revert after 6 hours — whichever comes first.

**Option A — Terraform:**

```bash
cd infra/terraform
terraform apply -var="surge_min_instances=3"
```

**Option B — Firebase Console:** Set Min instances back to `3` on each of the 4 target functions.

---

## Automation gap

This runbook is human-executed. There is no automated trigger. If the team adopts PagerDuty or OpsGenie before Phase 9 exit, migrate this runbook there before the pilot launches (tracked in `docs/progress.md`).

---

## Drill procedure (required before Phase 8A exit)

1. Declare a test TCWS signal on System Health page.
2. Execute apply (Option A or B above) — verify `minInstances: 20` in Firebase Console.
3. Execute revert — verify `minInstances: 3` in Firebase Console.
4. Record drill date in `docs/progress.md`.

````

- [ ] **Step 5: Commit**

```bash
git add infra/runbooks/surge-prewarm.md infra/terraform/variables.tf
git commit -m "feat: add surge pre-warm runbook and Terraform surge_min_instances variable"
````

---

## Task 8: Admin Desktop runbook link

**Files:**

- Modify: `apps/admin-desktop/src/pages/SystemHealthPage.tsx`

**Context:** Phase 8B implemented the System Health page with a Signal Controls card. Find the Signal Controls section and add a static link to the runbook. A runbook not findable during an incident is worthless.

- [ ] **Step 1: Read `apps/admin-desktop/src/pages/SystemHealthPage.tsx`**

Identify the Signal Controls card/section. Look for the "Declare Signal" and "Clear Active Signal" buttons. The runbook link goes near those controls.

- [ ] **Step 2: Add the runbook link**

Find the Signal Controls JSX block and add a link element. The exact location depends on the page structure. Add it as a small helper text below the signal action buttons:

```tsx
<p className="text-xs text-muted-foreground mt-2">
  TCWS signal ≥ 2 active?{' '}
  <a
    href="https://github.com/<org>/bantayog-alert/blob/main/infra/runbooks/surge-prewarm.md"
    target="_blank"
    rel="noreferrer"
    className="underline"
  >
    Surge Runbook
  </a>
</p>
```

Replace `<org>` with the actual GitHub organization or username for this repo.

To find the correct org/repo path:

```bash
git remote get-url origin
```

- [ ] **Step 3: Verify it renders**

Start the admin desktop dev server and navigate to the System Health page. Confirm the link is visible near the signal controls and opens the correct GitHub URL.

```bash
cd apps/admin-desktop && pnpm dev
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin-desktop/src/pages/SystemHealthPage.tsx
git commit -m "feat(admin): add surge runbook link to System Health Signal Controls card"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement                                                                   | Covered by task                     |
| ---------------------------------------------------------------------------------- | ----------------------------------- |
| k6 harness in `e2e-tests/k6/`                                                      | Tasks 1–5                           |
| `npm run load-test` wrapper                                                        | Task 6                              |
| Scenario 1: accept-dispatch-race, exactly 1 winner, p99 < 2s, 3 clean runs         | Task 3                              |
| Scenario 2: citizen-submit-burst, p99 < 10s, error rate < 1%, 0 dead-letter growth | Task 4                              |
| Scenario 3: cold-start-inbox, processedAt set within 5 min, 3 trials               | Task 5                              |
| Token age assertion (< 50 min)                                                     | Task 1                              |
| Admin SDK seed (no test flags in production code)                                  | Task 2                              |
| Scenario cleanup between runs                                                      | Documented in each task's run steps |
| RTDB reconnect: manual staging soak observation (no k6 script)                     | README in Task 6                    |
| Pre-warm runbook at `infra/runbooks/surge-prewarm.md`                              | Task 7                              |
| `surge_min_instances` Terraform variable                                           | Task 7                              |
| Runbook linked from Admin Desktop System Health page                               | Task 8                              |
| Deferred: CI integration, 4 observability dashboards, dynamic minInstances         | Excluded per spec                   |

**Placeholder scan:** No TBD, TODO, or vague steps found.

**Type consistency:** `extractValue`, `readDocument`, `createDocument` in `firestore-rest.js` are used consistently in Scenarios 2 and 3. `getIdToken`, `getAnonymousToken`, `assertTokenFresh` in `firebase-auth.js` are used consistently in all scenarios. `callFirebase`, `isOk`, `isConflict` in `callable.js` are used consistently in Scenario 1.
