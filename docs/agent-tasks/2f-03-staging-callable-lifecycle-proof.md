# 2F-03 — Staging Callable Lifecycle Proof

**Goal:** Prove the full MVP loop through **deployed** HTTPS callables on
`bantayog-alert-staging`: submit → verify → dispatch → accept → advance
(acknowledged → en_route → on_scene) → resolve.

**Blocked by:** 2F-01 (App Check debug token + staging env vars), 2F-02
(callable client helpers).

## Files

- `scripts/staging-callable-proof.ts` (new) — composes `firebase-admin`
  (custom token minting, final-state assertions) with the 2F-02 client.
- `package.json` — add `staging:callable-proof` script.
- `docs/runbooks/pilot-demo.md` — document the command and required env.

## Design constraints

- Actors: mint custom tokens with claims — citizen (`role: citizen`,
  `accountStatus: active`, fresh uid per run), admin `daet-admin-test-01`,
  responder `bfp-responder-test-01` (already seeded with claims by
  `staging:seed`).
- Env contract (fail loudly if missing): `STAGING_FIREBASE_API_KEY`,
  `STAGING_FIREBASE_APP_ID`, `STAGING_APP_CHECK_DEBUG_TOKEN`, plus ADC for
  admin SDK.
- Reuse the exact safety guards from `scripts/staging-seed.ts` (no emulator,
  never production, ADC required).
- Assert final state via Admin SDK like `functions/src/__tests__/proof-mvp-loop.test.ts`
  does on emulator: report status, dispatch status, `report_ops`, event
  records, and `report_lookup` PII separation.
- Track every created doc ID and delete them in a cleanup step (mirror the
  fixed-path deletion discipline from `scripts/staging-reset.ts`).

## Out of scope

- Hosting deploys (2F-04), browser tests (2F-05), rules/index changes.

## Verification

- `pnpm staging:callable-proof` green against real staging.
- Compare observed callable behavior against `proof-mvp-loop` emulator
  behavior; record any drift in `docs/learnings.md`.

## Done evidence

- Proof output pasted into `docs/progress.md` entry; staging left clean
  (cleanup verified by re-running `pnpm staging:smoke-proof`).
