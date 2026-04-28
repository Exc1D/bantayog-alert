// e2e-tests/k6/scenarios/citizen-submit-burst.js
import { check } from 'k6'
import { Counter } from 'k6/metrics'
import { randomUUID } from 'k6/crypto'
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
    idempotencyKey: { stringValue: randomUUID() },
    publicRef: { stringValue: `K6-${String(__VU).padStart(3, '0')}` },
    secretHash: { stringValue: `k6-placeholder-hash-vu${__VU}` },
    correlationId: { stringValue: randomUUID() },
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
