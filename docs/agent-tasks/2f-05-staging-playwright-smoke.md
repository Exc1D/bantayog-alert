# 2F-05 — Staging Playwright Smoke

**Goal:** One deterministic Playwright spec that runs the citizen → admin →
responder loop against the deployed staging URLs.

**Blocked by:** 2F-04 (staging URLs exist).

## Files

- `e2e-tests/specs/staging-smoke.spec.ts` (new) — keep under
  `e2e-tests/specs/` per `docs/learnings.md` testing rules.
- `package.json` — add a `staging:browser-smoke` script gated on a
  `STAGING_BASE_URL`-style env so CI never runs it accidentally.

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
