# Progress

## Current

### Phase 4a Acceptance Fixes (2026-04-21)

- Status: PASS locally via emulator acceptance gate
- Verification: `firebase emulators:exec --only firestore,database,auth "pnpm exec tsx scripts/phase-4a/acceptance.ts"` → `13/13 passing`
- Notes:
  Repaired the phase 4a acceptance harness to run each case against clean Firestore + RTDB emulator state.
  Fixed `verifyReport`, `closeReport`, and `dispatchResponder` so transactional reads happen before writes.
  Corrected SMS fallback `publicRef` generation when `report_lookup` is absent.

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
