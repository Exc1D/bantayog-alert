# 2F-02 — Staging Callable Client Harness

**Goal:** A unit-tested Node module that can authenticate as a test user and
call deployed staging callables: custom-token → ID-token exchange, App Check
debug-token exchange, and callable invocation with stable error mapping.

## Files

- `scripts/staging-callable-client.ts` (new)
- `scripts/staging-callable-client.test.ts` (new)

## Design constraints

- Pure REST helpers with an injected `fetch` so tests need no network and the
  module needs no `firebase-admin` import (token minting stays in 2F-03).
- Callable URL: `https://asia-southeast1-bantayog-alert-staging.cloudfunctions.net/<name>`;
  request body `{ data: payload }`, headers `Authorization: Bearer <idToken>`
  and `X-Firebase-AppCheck: <appCheckToken>`.
- Mirror the safety guards from `scripts/staging-e2e-proof.ts`: refuse to run
  when `FIRESTORE_EMULATOR_HOST` is set; refuse production project
  `bantayog-alert`.
- Map callable error bodies (`{ error: { status, message } }`) to thrown
  errors carrying the stable `status` code; never swallow non-2xx responses.

## Out of scope

- Driving the actual lifecycle (2F-03).
- Live network calls in tests.

## Verification

- Red-first: `pnpm exec vitest run scripts/staging-callable-client.test.ts`
  fails before the module exists, passes after.
- `pnpm typecheck` (root) and prettier clean on both files.

## Done evidence

- Focused vitest run green; helpers exported for 2F-03 to compose.
