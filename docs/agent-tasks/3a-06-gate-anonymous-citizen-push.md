# 3A-06 — GATE DOC: Anonymous-Citizen Push

**Priority:** P2 — **decision gate, do not execute without explicit user
approval.**

**The gap:** The 3A backbone delivers push only to **registered** citizens:
`useFcmToken` persists `users/{uid}.fcmToken` only when
`!user.isAnonymous`, so anonymous reporters — likely the majority in a
disaster — never receive "help is on the way" / resolution pushes. Their
fallback is in-app tracking via the lookup code.

## Why it is gated

Extending token persistence to anonymous uids requires verifying (and likely
editing) the `users/{uid}` Firestore rules write path for anonymous auth.
Rules edits are forbidden without showing the full diff and getting explicit
"proceed" (CLAUDE.md §6/§8.4, persistent-memory rule). There are also real
product questions to answer first:

1. **Token lifetime vs anonymous session lifetime** — anonymous uids churn on
   storage clear; dead tokens accumulate on dead uids.
2. **Privacy posture** — `users/{anonUid}` docs holding push tokens are new
   PII-adjacent records needing a retention answer (docs/runbooks/data-privacy.md).
3. **Worth-it check** — 3B-03's register nudge may convert enough reporters
   that anonymous push is unnecessary for the pilot. Measure first.

## Decision needed from the user

- Approve/deny anonymous push for the pilot scope.
- If approved: rules-diff review for `users/{uid}` anonymous writes, retention
  entry in data-privacy runbook, then an execution slice gets written.

## Until then

`sendFcmToCitizen` (3A-01) returns `fcm_no_token` for anonymous reporters —
a designed, observable outcome (visible in `notification_attempted` events),
not a silent drop.
