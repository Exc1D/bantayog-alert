# 3A-01 — `sendFcmToCitizen` Helper

**Priority:** P0 (notifications backbone — 3A-03/04/05 and 3B-03 depend on it)

**Goal:** A never-throwing FCM send helper for citizen devices, parallel to
`sendFcmToResponder`, so command callables can notify the reporter on
lifecycle transitions.

## Files (≤3)

- `functions/src/domains/ops/fcm-send.ts` (add `sendFcmToCitizen`)
- `functions/src/domains/ops/__tests__/fcm-send-citizen.unit.test.ts` (new)

## Design constraints

- Input: `{ reportId, title, body, data?, collapseKey? }`. Resolve the target
  by reading `report_private/{reportId}.reporterUid`, then
  `users/{uid}.fcmToken` (single string field, unlike the responder
  `fcmTokens` array).
- Return `{ warnings: string[] }` with stable codes: `fcm_no_token` (missing
  private doc, missing/anonymous reporterUid, or no token),
  `fcm_network_error` (after one retry), `fcm_one_token_invalid` (cleared).
- On `messaging/invalid-registration-token` or
  `messaging/registration-token-not-registered`, clear
  `users/{uid}.fcmToken` to null best-effort.
- Never throws — push failure must never fail the calling command.
- No new deployed function, no Firestore trigger, no rules edits.

## Red-first test

Unit test mocking `getMessaging` and Firestore (same pure-mock pattern as
`redispatch-report.unit.test.ts`): assert `fcm_no_token` paths, successful
send payload shape, retry-then-`fcm_network_error`, invalid-token cleanup.
Run before implementing — must fail on the missing export.

## Out of scope

- Hooking into any callable (3A-03/04/05).
- Anonymous-reporter delivery (gate doc 3A-06).
- Client SW work (3A-02).

## Verification

- `pnpm --dir functions exec vitest run src/domains/ops/__tests__/fcm-send-citizen.unit.test.ts`
- `pnpm --dir functions exec tsc --noEmit && pnpm --dir functions exec eslint src`
