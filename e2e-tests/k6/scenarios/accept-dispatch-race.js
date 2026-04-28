// e2e-tests/k6/scenarios/accept-dispatch-race.js
import { check } from 'k6'
import { Counter } from 'k6/metrics'
import { randomUUID } from 'k6/crypto'
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
  const idempotencyKey = randomUUID()

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
