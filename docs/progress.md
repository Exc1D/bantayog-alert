# Progress

## Current

### Phase 4b SMS Inbound Pipeline (2026-04-22)

- Status: Complete — All tasks done (Tasks 1-10)
- Branches:
  - `feature/phase-4b-sms-inbound` — worktree at `dae2848`
  - `main` — all commits merged here
- Key commits:
  - `f2cdaa5` fix(sms-parser): address TypeScript strict-mode errors
  - `f1eb24e` feat(validators): add SMS-originated report_inbox Zod schema
  - `47c5da8` feat(process-inbox): return publicRef from processInboxItemCore
  - `896f8ea` feat(sms-inbound): add thin webhook for Globe Labs SMS ingress
  - `9a96e82` feat(sms-inbound): encrypt MSISDN in sms_inbox for Phase 4b auto-reply
  - `7479d28` feat(sms-inbound): add smsInboundProcessor trigger with auto-reply
  - `10d9b5b` fix(sms-inbound): add async wrapper to db.runTransaction
  - `082b8c4` feat(sms-inbound): add integration tests for Phase 4b SMS inbound pipeline
  - `6007e05` feat(phase-4b): add acceptance harness for SMS inbound pipeline
- Files created/modified:
  - `packages/shared-sms-parser/src/inbound.ts` — BANTAYOG parser with fuzzy barangay matching
  - `packages/shared-sms-parser/src/index.ts` — re-exports parser
  - `packages/shared-sms-parser/src/__tests__/inbound.test.ts` — 13 unit tests (all passing)
  - `packages/shared-sms-parser/vitest.config.ts` — vitest configuration
  - `packages/shared-sms-parser/package.json` — added test script and zod dependency
  - `packages/shared-validators/src/sms.ts` — added `smsReportInboxFieldsSchema` + `senderMsisdnEnc` field
  - `packages/shared-validators/src/index.ts` — re-exports new schema
  - `functions/src/http/sms-inbound.ts` — thin webhook for Globe Labs SMS ingress (refactored to extract smsInboundWebhookCore)
  - `functions/src/firestore/sms-inbound-processor.ts` — onCreate trigger, parses SMS, writes report_inbox, queues auto-reply
  - `functions/src/triggers/process-inbox-item.ts` — added `publicRef` to ProcessInboxItemCoreResult
  - `functions/src/index.ts` — exports new webhook and trigger
  - `functions/src/__tests__/sms-inbound.test.ts` — 13 integration tests (all passing)
  - `functions/src/__tests__/acceptance/phase-4b-acceptance.test.ts` — 3 acceptance tests (all passing)
  - `scripts/phase-4b/acceptance.ts` — standalone acceptance harness reference
  - `functions/package.json` — added `@bantayog/shared-sms-parser` dependency
  - `docs/superpowers/plans/2026-04-22-phase-4b-sms-inbound.md` — implementation plan
  - `docs/superpowers/specs/2026-04-22-phase-4b-sms-inbound-design.md` — design spec
- Notes:
  - MSISDN encryption: AES-256-GCM with `SMS_MSISDN_ENCRYPTION_KEY` env var
  - Pre-commits resolved via `// eslint-disable-next-line @typescript-eslint/require-await` on the one fire-and-forget transaction call
  - The `autoReplyText` from the parser is currently unused (trigger sends `receipt_ack` purpose SMS via enqueueSms)
  - Integration tests use `env.unauthenticatedContext().firestore()` for seeding and `env.withSecurityRulesDisabled()` for test body
  - Parser test expectations corrected: CALASGAN→low (dist=2), LANIT→none (not in gazetteer), details case preserved lowercase

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
