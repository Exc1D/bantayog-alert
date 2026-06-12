# RF-01 — Disposition the 20 Orphaned Admin Callable Wrappers

**Priority:** P1 (dead command surface = standing security/audit liability and
the largest single block of unowned code)

**Goal:** Every wrapper in `apps/admin-desktop/src/services/callables.ts`
either has a UI caller, a documented backend-only operational use, or is
fully retired — no silent leftovers.

**Gate:** The user approves/edits the matrix below first. Executing agents
then run one bucket-batch per branch.

## Recon facts (2026-06-12 — re-verify before editing)

All 20 wrappers below have zero non-test references in
`apps/admin-desktop/src` outside `services/callables.ts` (verified by grep;
fallow cannot see this — entry-point inflation disables unused-export
detection in apps). `origin/refactor/remove-deprecated-callables` is already
merged; these survived that sweep. Re-verify each with:
`grep -rn "<name>" apps/admin-desktop/src --include='*.ts*' | grep -v -E 'services/callables|test'`

## Proposed disposition matrix (user edits, then it is binding)

**Bucket A — retire (mutual-aid / coordination cluster, not in pilot scope):**
`shareReport`, `requestAgencyAssistance`, `acceptAgencyAssistance`,
`declineAgencyAssistance`, `toggleMutualAidVisibility`,
`listScopedOperationsMap`.

**Bucket B — keep, document backend-only (compliance & governance; UI not
needed for pilot but the capability is):** `setRetentionExempt`,
`setErasureLegalHold`, `approveErasureRequest` (RA 10173 erasure flow),
`suspendUser`, `revokeUser`, `resetUserTotp`, `createUser`,
`suspendResponder`, `revokeResponder`, `bulkAvailabilityOverride`.

**Bucket C — user decides wire-vs-retire (plausible pilot operator needs):**
`cancelDispatch` (cancel a mis-dispatch), `closeReport`, `reopenReport`,
`mergeDuplicates` (note: rf-05 decomposes its core — only if kept).

## Execution protocol (per approved bucket, one branch each)

- **Retire batch (≤5 wrappers/branch):** remove the full surface together
  per learnings.md — Functions export, domain module, wrapper, validator
  contracts, direct tests, runbook/monitoring references. Firestore rules or
  index entries that become orphaned require the §8.4 diff-approval step —
  show the user the rules diff before touching those files. Note: report
  sharing/agency assistance create command-channel records; check whether
  command-channel rules remain needed by other live flows before proposing
  rules removal.
- **Keep-backend-only batch:** no code change. Add the wrapper to a short
  "backend-only operations" section in `docs/runbooks/pilot-demo.md` (how to
  invoke, who may), and add a one-line comment above the wrapper pointing at
  the runbook.
- **Wire-UI batch:** out of scope for this slice — becomes a feature slice
  with its own doc.

## Red-first test

For each retired wrapper: delete its direct test first, run the functions
suite, confirm the only failures are the deleted surface (proves the test
actually exercised it), then remove the implementation and re-run green.

## Out of scope

- Wiring new UI; rules/index edits without §8.4 approval; touching
  `createResponder` (live) or any wrapper with a discovered caller.

## Verification (per batch)

- `grep -rn "<wrapper>" apps/ functions/ packages/ --include='*.ts*' | grep -v node_modules` → empty for retired names
- `firebase emulators:exec --only firestore,database,storage 'npx vitest run'` (from `functions/`) → green
- `pnpm --dir apps/admin-desktop exec vitest run && pnpm --dir apps/admin-desktop exec tsc --noEmit`
- `pnpm typecheck && pnpm lint` at root; fallow audit gate passes
