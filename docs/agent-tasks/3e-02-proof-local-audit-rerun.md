# 3E-02 — Proof: Notification UI States + Audit Re-Run (Phase 3 Exit)

**Priority:** Exit (run after all P0/P1 slices land)

**Goal:** Extend the `proof:local` browser proof to cover the
notification-visible UI states added in Phase 3, re-run the
`evaluate-ux-completeness` audit per app, and confirm the exit criterion:
**zero remaining P0/P1 gaps** in the core loop.

## Files (≤3)

- the `proof:local` Playwright spec(s) (recon in-slice: extend the existing
  full-loop checkpoints, keep specs under `e2e-tests/specs/`)
- `docs/mvp-readiness.md` (record the audit re-run result)

## Design constraints

- Browser-provable additions: responder permission-denied banner (3D-01),
  admin new-report count/title badge (3C-01), SLA countdown render (3C-02),
  resolved closure section (3C-03), lookup success landing (3B-01), citizen
  permission-ask prompt (3B-03), resolved feedback prompt (3B-05).
- **Real push delivery to a device is not browser-provable here** — record it
  as a staging checklist item in `docs/runbooks/pilot-demo.md` (tap-through on
  a physical device), per the plan's stated risk.
- Audit re-run: walk the `evaluate-ux-completeness` checklist per app against
  the core loop; any finding is either P2-logged (new slice file) or
  exit-blocking (P0/P1 → fix before closing Phase 3).
- Proof discipline per learnings.md: explicit login routes, onboarding
  dismissal at the protected click point, longer first-load timeouts.

## Red-first test

Each new proof checkpoint must fail when its feature flag/element is absent
(verify by running against a pre-Phase-3 build or by asserting a unique
element only the new UI renders).

## Out of scope

- Staging deploys (human-only per 2F-04 convention), device push testing,
  new feature work discovered by the audit (gets its own slice files).

## Verification

- `pnpm proof:local` green end-to-end with new checkpoints visible in output.
- Audit results recorded in `docs/mvp-readiness.md`; exit requires zero
  P0/P1 remaining.
