# Progress

## Current

### Phase 4a Git Recovery (2026-04-21)

- Status: complete
- Verification:
  `git ls-remote --heads origin recovery/phase-4a-outbound-sms` → `b7dc97121ebaa4ca53f39ce1232e5cb271c99c95`
- Notes:
  Restored the orphaned Phase 4a branch tip to `origin/recovery/phase-4a-outbound-sms`.
  Confirmed `main` already contains the bulk Phase 4a code via squash commit `e05a25c`; the recovery branch preserves original commit history rather than replaying the entire stack.

### Phase 4a Acceptance Fixes (2026-04-21)

- Status: PASS locally via emulator acceptance gate

### Phase 4a TypeScript Errors Fix (2026-04-21)

- Status: COMPLETE
- Fixes applied to `functions/src/__tests__/acceptance/phase-4a-acceptance.ts`:
  - Replaced scheduled/onRequest wrappers (`reconcileSmsDeliveryStatus`, `evaluateSmsProviderHealth`, `smsDeliveryReport`) with their `*Core` variants
  - Fixed Admin/Client SDK mixing by using `adminDb` (from `getFirestore()`) directly for all `setDoc` calls
  - Removed `resolveProvider` from `processInboxItemCore` call (not in interface)
  - Removed `severity` and `notes` from `dispatchResponderCore` call (not in `DispatchResponderCoreDeps`)
  - Fixed `staffClaims` return type for `exactOptionalPropertyTypes` compliance
  - Fixed `smsConsent: false` type error by omitting `reporterContact` in seed (interface requires `smsConsent: true`)
  - Added `resolveProvider` import back (required by `dispatchSmsOutboxCore`)
- Verification: `pnpm run typecheck` → 0 errors for `phase-4a-acceptance.ts`
- Note: `.test.ts` sibling file still has `assert` import errors — separate issue

### Phase 4a Acceptance Fixes (2026-04-21)

- Status: PASS locally via emulator acceptance gate; typecheck now passing for `.ts` file
- Verification: `firebase emulators:exec --only firestore,database,auth "pnpm exec tsx scripts/phase-4a/acceptance.ts"` → `13/13 passing`
- Notes:
  Repaired the phase 4a acceptance harness to run each case against clean Firestore + RTDB emulator state.
  Fixed `verifyReport`, `closeReport`, and `dispatchResponder` so transactional reads happen before writes.
  Corrected SMS fallback `publicRef` generation when `report_lookup` is absent.
  Fixed ~17 TypeScript errors: Admin/Client SDK mixing, wrong function imports, interface mismatches.

### Phase 1 Identity Spine

- Status: in progress; verification still incomplete
- Verification snapshot:
  `pnpm test` FAIL — `apps/citizen-pwa/src/App.test.tsx` still imports Jest DOM via the Jest path instead of `@testing-library/jest-dom/vitest`.
  `pnpm --filter @bantayog/functions test:unit` PASS
  `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test:rules"` SKIP locally
  `pnpm lint && pnpm typecheck && pnpm build` PASS
- Built:
  Identity spine documents and auth claim issuance/revocation Cloud Functions.
  Phase 1 auth and Firestore rules coverage.
  Phase 1 bootstrap script.

## Completed

### Phase 3b Admin Triage + Dispatch

- Status: complete in code; manual staging UI verification still blocked by hosting/cert issues
- Key verification:
  `pnpm lint && pnpm typecheck` PASS
  `pnpm test` PASS (`127 tests`)
  Backend staging callable verification PASS (`5/5`)
- Remaining blockers:
  `staging.bantayog.web.app` certificate mismatch
  IAM Credentials API disabled for acceptance flow
  No valid staging hosting deploy

### Phase 0 Foundation

- Status: complete
- Key verification:
  install, lint, format, typecheck, test, build, emulator, and Terraform validate all passed
- Notable fixes:
  corrected root Vitest workspace setup
  reformatted docs/rules files
  removed broken package-level workspace assumptions
