# Exxeed Implementation Report — task13-rtdb-rules

Date: 2026-04-17

## What was built

Replaced the placeholder `database.rules.json` (deny-all) with the §5.8 production rule set covering responder telemetry writes (capturedAt bounds, role/accountStatus guards, field validation), granular read access by role and responder_index cross-references, client-deny on `responder_index`, and shared_projection read/write controls. Created `rtdb.rules.test.ts` with 17 test cases exercising every positive and negative path.

## Requirements coverage

| ID  | Requirement                                         | Status | Notes                   |
| --- | --------------------------------------------------- | ------ | ----------------------- |
| R01 | Responder writes own location with valid capturedAt | ✅     | Test passes             |
| R02 | capturedAt > now + 60000 fails                      | ✅     | +70 000 ms case         |
| R03 | capturedAt < now - 600000 fails                     | ✅     | -700 000 ms case        |
| R04 | Non-responder role write fails                      | ✅     | citizen role tested     |
| R05 | Responder writes to another uid fails               | ✅     | Cross-uid guard         |
| R06 | Suspended responder write fails                     | ✅     | accountStatus=suspended |
| R07 | Responder reads own location                        | ✅     | Self-read               |
| R08 | Superadmin reads any responder                      | ✅     | provincial_superadmin   |
| R09 | Muni admin matching municipalityId reads            | ✅     | responder_index seeded  |
| R10 | Muni admin mismatch fails                           | ✅     | san-vicente vs daet     |
| R11 | Agency admin matching agencyId reads                | ✅     | pdrrmo match            |
| R12 | Agency admin mismatch fails                         | ✅     | bfp vs pdrrmo           |
| R13 | responder_index client read always fails            | ✅     | Even superadmin         |
| R14 | responder_index client write always fails           | ✅     | Even superadmin         |
| R15 | shared_projection matching muni admin reads         | ✅     | daet match              |
| R16 | Mismatched muni admin fails on shared_projection    | ✅     | san-vicente vs daet     |
| R17 | Any client write to shared_projection fails         | ✅     | superadmin denied       |

## Files changed

| File                                       | Change type | Reason                                 |
| ------------------------------------------ | ----------- | -------------------------------------- |
| infra/firebase/database.rules.json         | modified    | Replace placeholder with §5.8 rule set |
| functions/src/**tests**/rtdb.rules.test.ts | created     | 17 RTDB rules test cases               |

## Baseline vs final test state

- Baseline: No rtdb.rules.test.ts → vitest exits with code 1 (no files found)
- Final: 17/17 tests passing
- Delta: +17 new passing tests, zero regressions

## Open items

- None

## Divergences encountered

- **Storage emulator not running (port 9199):** The shared `createTestEnv` helper requires all three emulators (firestore, database, storage). Storage returned ECONNREFUSED. Resolution: initialized test environment directly in the test file with only firestore + database emulators, which are all that RTDB rule testing requires.

## Notes on test design

- `validPayload(capturedAt)` helper ensures all 7 `.validate` fields are present in every write test, so the only variable is `capturedAt`.
- `responder_index/$uid` is seeded via `withSecurityRulesDisabled` so the muni/agency admin read path tests exercise the actual database cross-reference in the rule.
- `FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000` must be set in the environment when running these tests.
