# 2F-05 — Staging Playwright Smoke

**Goal:** One deterministic Playwright spec that runs the citizen → admin →
responder loop against the deployed staging URLs.

**Blocked by:** 2F-04 (staging URLs exist).

## Files

- `e2e-tests/specs/staging-smoke.spec.ts` (new) — keep under
  `e2e-tests/specs/` per `docs/learnings.md` testing rules.
- `e2e-tests/package.json` — add a `staging:browser-smoke` script gated on the
  `BANTAYOG_CITIZEN_URL` env variable so CI never runs it accidentally.
  The script should exit early (or skip loudly) when `BANTAYOG_CITIZEN_URL` is
  undefined. The spec itself should read `process.env.BANTAYOG_CITIZEN_URL` (or
  `process.env.BASE_URL` as a fallback), matching the variables already used by
  `e2e-tests/playwright.staging.config.ts` and `e2e-tests/fixtures/reliability-spine.ts`.
  Other per-app URLs are `BANTAYOG_ADMIN_URL` and `BANTAYOG_RESPONDER_URL`.

## Design constraints

- Reuse the hardened patterns from `proof:local`: explicit login routes,
  exact-match labels, longer first-load timeouts, onboarding dismissal at the
  protected click point.
- Use the seeded staging accounts; create citizen data with clearly marked
  test IDs and clean up after (same discipline as 2F-03).
- Skip loudly (not silently) when staging env vars are absent.

## Out of scope

- Mobile/device matrices, reduced-motion/a11y evidence (covered by local
  proofs), load testing.

## Verification

- Spec passes against staging twice in a row (flake check).

## Done evidence

- Run output recorded in `docs/progress.md`; spec wired into the pilot-demo
  runbook as the pre-demo health check.
