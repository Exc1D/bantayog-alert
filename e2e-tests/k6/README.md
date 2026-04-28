# k6 Load Test Scenarios — Phase 8A

Runs against **staging only**. Never point these at dev or prod.

## Prerequisites

- k6 installed: https://grafana.com/docs/k6/latest/set-up/install-k6/
- `jq` installed: `brew install jq`
- `tsx` available: `npx tsx --version` (or `pnpm add -D tsx -w`)
- Staging env vars set (see below)

## Quick start

```bash
# Run a scenario via the package.json wrapper
SCENARIO=accept-dispatch-race npm run load-test

# Or invoke k6 directly
k6 run e2e-tests/k6/scenarios/accept-dispatch-race.js
```

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

If the admin token gets 403 when reading `report_inbox` (Firestore rules may block it),
use the seed script's Admin SDK fallback to verify processing instead:

```bash
npx tsx e2e-tests/k6/seed.ts seed check-processed $INBOX_ID
# Expected: {"id":"...","processed":true}
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
