# MVP Readiness

## Current Readiness Level

**Local emulator MVP demo-ready. Not production pilot-ready yet.**

The system can be run locally, seeded with deterministic data, and the full incident lifecycle can be demonstrated from report submission through resolution. It is suitable for developer evaluation, stakeholder demos, and LGU walkthroughs in a controlled local environment.

It is **not** suitable for production deployment, real citizen-facing emergency services, or unguarded staging use without additional hardening.

## What Works

- **Citizen reporting** — PWA form with type, severity, location, description, and optional media.
- **Admin triage** — Dedicated `/triage` workbench with report review, verify, and reject actions.
- **Rejection reason** — Operator can choose from `insufficient_detail`, `duplicate`, `obviously_false`, or `test_submission`.
- **Admin notes** — Optional 500-character notes attached to rejections.
- **Basic incident export** — CSV download of visible triage rows (non-PII fields only).
- **Stale/offline messaging** — Triage queue shows degraded-data warnings when listeners are stale.
- **Triage filters** — Status, severity, type, and free-text search with safe bulk-action guards.
- **Dispatch assignment** — Admin can assign a verified report to an available responder with hold-to-dispatch safety.
- **Responder status update** — Responder can accept and advance through `acknowledged`, `en_route`, `on_scene`, and `resolved`.
- **Citizen tracking timeline** — Citizen-facing view shows lifecycle progression without exposing responder/admin operational data.
- **Demo seed/reset scripts** — Deterministic `demo:seed`, `demo:reset`, `demo:reseed` with Camarines Norte data.
- **Firebase rules tests** — Firestore, RTDB, and Storage rules covered with emulator-backed tests.
- **MVP loop proof** — Backend-only deterministic test (`pnpm proof:mvp-loop`) that exercises full lifecycle.
- **Full browser proof** — Playwright E2E (`pnpm proof:local`) that runs citizen → admin → responder loop across all three apps.

## What Is Not Included (Intentionally Deferred)

The following are **not** part of the Phase 1 / Phase 2A MVP and are **not** claimed as ready:

- **SMS outbound updates** — No SMS delivery to citizens or responders.
- **CAP-compatible alert model** — Alerts are Firestore documents, not CAP XML/RSS.
- **Hazard overlays** — No hazard zone map layers or geo-fencing.
- **Duplicate clustering** — No automatic detection or merging of related reports.
- **Agency coordination** — No multi-agency dispatch or shared situational awareness.
- **Mutual aid** — No cross-municipality responder assignment or aid request flow.
- **BigQuery/audit export** — No backend audit pipeline or compliance-grade export.
- **Production observability** — No Cloud Monitoring dashboards, alerting, or SLO tracking.
- **Real staging/prod deployment proof** — Emulators only; no staging environment exists yet.
- **PostGIS runtime migration** — Geospatial queries use `locationGeohash`, not PostGIS.
- **Background responder GPS** — Location updates require active app usage.
- **Offline responder queue** — Status updates require active connection.
- **Advanced analytics** — Dashboards are operational summaries, not BI platform.
- **Erasure/retention automation** — Manual privacy workflows only.

## What Must Be True Before a Real Pilot

Before the system can be offered as a real LGU pilot, **all** of the following must be true:

1. **Full emulator test suite passes** — `pnpm test`, `pnpm test:rules`, `pnpm proof:mvp-loop`, and `pnpm proof:local` all pass with zero skipped critical tests.
2. **Staging environment exists** — A non-production Firebase project with scoped data and safe seed/reset.
3. **Staging seed/reset is safe and scoped** — Reset only touches known seed documents; no broad collection wipe.
4. **No broad admin bypass** — All admin actions go through authenticated, authorized, rate-limited callables.
5. **Security rules tested** — Firestore, RTDB, and Storage rules have passing tests against the emulator.
6. **Test accounts documented** — Demo accounts, credentials, and roles are documented and isolated from production.
7. **Incident lifecycle can be replayed** — A developer can run `pnpm proof:mvp-loop` and see deterministic success.
8. **[Manual rollback plan exists](runbooks/rollback.md)** — Documented steps to revert a bad deploy or data mutation.
9. **[Known incident response procedure exists](runbooks/incident-response.md)** — Who to call, what to check, and how to escalate if the system fails during a demo or pilot.
10. **[Data privacy limitations documented](runbooks/data-privacy.md)** — What data is collected, how long it is retained, and what PII exists where.

## Operational Risks

| Risk                                                | Severity | Mitigation                                                                                                             |
| --------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| Firebase emulator tests can falsely pass if skipped | High     | Always run with emulators running. Never trust a green result that says "tests will skip."                             |
| Stale compiled functions output                     | High     | Rebuild `functions/lib/` before every emulator test run. `pnpm build` or `pnpm --dir functions exec tsc`.              |
| Region drift                                        | Medium   | All functions deploy to `asia-southeast1`. Verify client callable region matches.                                      |
| Rules/index mismatch                                | Medium   | Run `pnpm test:rules` regularly. Rules changes require index changes; index-only changes must be tested.               |
| Demo data accidentally mistaken as production       | Medium   | Demo seed uses fixed IDs prefixed with `seed-` or `mvp-`. Never seed production.                                       |
| No SMS fallback                                     | Medium   | Document clearly that citizens must check the PWA; no SMS confirmation exists.                                         |
| No guaranteed emergency response semantics          | High     | This is a coordination tool, not a guaranteed life-saving system. Document this limitation in all citizen-facing copy. |

## Recommended Next Phase After Phase 2D

**Phase 2E: Staging End-to-End Proof**

Focus on:

- Running `pnpm staging:seed` against the real staging project (`bantayog-alert-staging`).
- Exercising the full incident lifecycle through deployed HTTPS callables (not emulator-local core functions).
- Verifying all three apps load and authenticate against staging.
- Proving that the deployed backend matches emulator behavior.

**Do not start P2 feature expansion** (SMS, CAP, hazard overlays, duplicate clustering, agency coordination, mutual aid, BigQuery) until the MVP loop is proven end-to-end in a staging environment.
