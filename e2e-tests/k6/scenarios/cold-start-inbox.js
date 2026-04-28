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
