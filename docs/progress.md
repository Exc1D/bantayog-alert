# Progress

## Current

### Map Tab — full implementation (2026-04-22)

- Status: DONE locally — full map tab slice implemented in `feature/map-tab`
- Scope:
  - `CitizenShell` top/bottom chrome + route updates
  - `MapTab` orchestrator with Leaflet map, public incident layer, own-report layer, peek/detail sheets, filters, offline banner, and empty state
  - `PeekSheet` / `DetailSheet` / `IncidentLayer` / `MyReportLayer`
  - `useMyActiveReports` exact-optional-property cleanup for `id`
- Verification:
  - `pnpm --filter @bantayog/citizen-pwa typecheck` — PASS
  - `pnpm --filter @bantayog/citizen-pwa lint` — PASS
  - `pnpm --filter @bantayog/citizen-pwa test` — PASS (38/38)

### Map Tab — Task 5: usePublicIncidents hook (TDD) (2026-04-22)

- Status: DONE — committed to `feature/map-tab`
- Files created:
  - `apps/citizen-pwa/src/components/MapTab/types.ts` — `PublicIncident`, `MyReport`, `Filters` interfaces
  - `apps/citizen-pwa/src/hooks/usePublicIncidents.ts` — Firestore `onSnapshot` hook with severity/window filters
  - `apps/citizen-pwa/src/hooks/usePublicIncidents.test.ts` — 4 tests (loading state, snapshot return, severity filter, error handling)
- Verification:
  - `pnpm --filter @bantayog/citizen-pwa test` — 22/22 PASS
  - `pnpm --filter @bantayog/citizen-pwa lint` — PASS
  - `pnpm --filter @bantayog/citizen-pwa typecheck` — PASS

### PR #56 Review Fixes — feat(citizen-pwa): manual location fallback (2026-04-22)

- Status: In progress — fixes applied to `feature/citizen-report-flow` worktree
- PR: https://github.com/Exc1D/bantayog-alert/pull/56
- Reviewers: CodeRabbit (Changes Requested), Sourcery (Commented)

**Issues fixed:**

1. `useReport.ts` — Guard empty `reportRef` to prevent invalid `doc(db(), 'reports/')` path (crash)
2. `useReport.ts` — Wrap `mapReportFromFirestore` in try-catch inside `onSnapshot` callback
3. `useReport.ts` — Async `queryFn` with `enabled: !!reportRef` + `placeholderData: keepPreviousData` to prevent "Report not found" flash
4. `TrackingScreen.tsx` — Switch `isLoading` → `isPending` for correct loading state
5. `RevealSheet.tsx` — `handlePrimaryAction` for `queued`/`failed_retryable` now calls `onClose?.()` instead of `closeSheet()` (fixes state desync)
6. `inboxPayloadSchema` — Add `municipalityId`, `barangayId`, `nearestLandmark` optional fields for location picker
7. `submit-report.ts` — Extend `SubmitReportInput` with location fields + forward to payload
8. `SubmitReportForm/index.tsx` — Replace inline submission logic with `submitReport(deps, input)` call (fixes secret discard + DRY)
9. `putBlob` error now includes HTTP response body
10. `Step1Evidence.tsx` — Fix `INCIDENT_TYPES` to match `reportDocSchema` values (`flood`, `fire`, `earthquake`, `typhoon`, `landslide`, `storm_surge`)
11. `Step1Evidence.tsx` — Add `useRef` + `useEffect` cleanup for blob URL `URL.revokeObjectURL`
12. `Step1Evidence.tsx` — "No photo" button now properly skips photo instead of re-opening picker
13. `Step3Review.tsx` — Fix `INCIDENT_TYPES` to match schema; third progress dot now active
14. `Step2WhoWhere.tsx` — `nearestLandmark` state initialized as `''` (not `undefined`) — fixes uncontrolled input
15. `Step2WhoWhere.tsx` — GPS `catch` block now logs error with `console.error` (not swallowed)
16. `submit-flow.test.tsx` — Replace placeholder tests with `it.todo` stubs (TICKET-56, TICKET-57)
17. `test-utils.tsx` — Add `MemoryRouter` + Firestore `RulesTestEnvironment` for emulator-backed tests

**Verification:**

- `pnpm --filter @bantayog/shared-validators typecheck` PASS
- `pnpm --filter @bantayog/shared-validators lint` PASS
- `pnpm --filter citizen-pwa typecheck` PASS
- `pnpm --filter citizen-pwa lint` PASS
- `pnpm --filter citizen-pwa test` PASS (5/5 tests)

**Note:** The two `add/add` design-token conflicts (`design-tokens.ts`, `design-tokens.css`) are identical on both sides — trivial resolution needed at merge.

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
  - **Bug fixed (2026-04-22):** `publicLocation: null` written to `report_inbox` caused `processInboxItemCore` to fail `inboxPayloadSchema` validation and throw `out_of_jurisdiction`, silently routing reports to `moderation_incidents` instead of materializing them. Fix: made `publicLocation` optional in `inboxPayloadSchema`, omitted it from SMS writes, added `location_missing` detection in `processInboxItemCore`.
- **Typecheck error fixed (2026-04-22):** `phase-4b-acceptance.test.ts:182` had `tx` implicit `any` in `db.runTransaction(async (tx) => {...})`. Fixed with `tx: unknown` on callback + `tx as any` at enqueueSms call — bridges `rules-unit-testing` compat SDK to admin SDK `Transaction` type.

### Phase 4b Bug Fixes — pending_review SMS auto-reply (2026-04-22)

- Status: Complete — 4 commits, shippable after adversarial review
- **Problem:** SMS reports missing `publicLocation` never got an auto-reply — `location_missing` and `out_of_jurisdiction` errors silently swallowed
- **Fix:** Detect location errors in `smsInboundProcessor` catch block, send `pending_review` SMS, update `parseStatus` to `pending_review`

**Files changed:**

- `packages/shared-validators/src/sms.ts` — `pending_review` added to `smsInboxDocSchema.parseStatus` and `smsOutboxDocSchema.purpose` enums
- `packages/shared-validators/src/sms-templates.ts` — `pending_review` added to `SmsPurpose` type and `TEMPLATES` record
- `functions/src/services/send-sms.ts` — `pending_review` added to `VALID_PURPOSES` set
- `functions/src/triggers/process-inbox-item.ts` — `moderation_incidents` doc enriched with `reportType`, `description`, `publicRef`
- `functions/src/firestore/sms-inbound-processor.ts` — catch block detects location errors, sends `pending_review` SMS; `parseStatus` written BEFORE enqueue attempt

**Design decisions:**

- `parseStatus: 'pending_review'` written BEFORE enqueue — wrong status prevented if transaction fails
- Inner try/catch around `decryptMsisdn` and `enqueueSms` — failures logged, not rethrown, do not affect parseStatus
- MSISDN decryption failure logged as WARNING — does not affect parseStatus
- Both `location_missing` and `out_of_jurisdiction` get `pending_review` reply — same moderator dependency

**Known acceptable limitations:**

- `schema_invalid`/`payload_schema_invalid` → no SMS reply (programmer error, not reporter-fixable)
- `decryptMsisdn` catch logs no diagnostic — insufficient for production encryption key debugging
- `correlationId: sms:${msgId}` violates `z.uuid()` schema — pre-existing, affects all SMS inboxes

**Verification:** `pnpm run typecheck --filter=@bantayog/functions` + `pnpm run lint --filter=@bantayog/functions` pass.

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
