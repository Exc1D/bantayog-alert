## Dead Routes / Unreachable Code Notes (high-signal subset)

The code graph flagged a large number of “dead code symbols”. Many are false positives for React components (called via JSX) or tests/helpers. This file captures only the subset that appears to reflect real product drift.

### High-signal dead/unreachable behavior

- `src/features/profile/components/RegisteredProfile.tsx:34` Defined but never routed; `/profile` always mounts `AnonymousProfile` (`src/app/routes.tsx:24-30`).
- `src/features/profile/services/profile.service.ts:52` `getUserReports()` exists but is not used by live routes; the reachable profile screen does not use it.
- `src/shared/hooks/UserContext.tsx:30` `UserProvider` exists but is not mounted; downstream features assume it.
- `functions/src/createAlert.ts:29` Callable `createAlert` exists but is not invoked from the client; client writes to `alerts` directly (`src/domains/municipal-admin/services/firestore.service.ts:253`).

### Notes on tooling output

- The dead-code tool also reported many local helper functions in UI components (event handlers) as “dead” even when they are wired via JSX props/handlers; treat those as tool noise unless verified by manual inspection.

