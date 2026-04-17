# Phase 1 Design: Infrastructure and Identity Spine

**Date:** 2026-04-17  
**Status:** Proposed, validated in-session  
**Depends on:** Phase 0 foundation complete  
**Source documents:** `prd/bantayog-alert-prd-v1.0.md`, `prd/bantayog-alert-implementation-plan-v1.0.md`, `prd/bantayog-alert-architecture-spec-v8.md`

---

## 1. Goal

Deliver the first real operational spine of Bantayog Alert:

- a citizen can open the web PWA, receive a pseudonymous Firebase identity automatically, and read a minimal hello-world feed
- staff identity can be provisioned with custom claims that match the architecture spec
- privileged access can be revoked through `active_accounts/{uid}` and `claim_revocations/{uid}`
- baseline runtime config can be seeded from code instead of living as console-only state

This phase proves identity, revocation, and config before reports, dashboards, dispatch, or field workflows arrive.

---

## 2. Scope Boundary

Phase 1 is one milestone with two execution lanes.

### 2.1 Track A: Gated Environment Work

This lane contains steps that require cloud credentials, Firebase project access, or console/provider setup:

- apply Terraform for target environment(s)
- enable Firebase Auth providers needed for pilot flows
- enroll App Check providers for web surfaces
- validate Cloud Functions deployment permissions
- run bootstrap/seeding against a real staging project
- verify the deployed stack in staging

These actions must not define behavior manually in the console beyond what the code expects. The console is wiring, not business logic.

### 2.2 Track B: Repository Implementation

This lane contains the code we can build and verify locally:

- identity types and validators
- Firebase client bootstrap for apps
- Cloud Functions for claims, revocation, and bootstrap paths
- Firestore rules for the minimum Phase 1 surface
- citizen PWA pseudonymous sign-in and hello-world feed shell
- emulator-backed tests for identity and revocation

### 2.3 Out of Scope

The following do not belong in Phase 1:

- citizen report submission
- report inbox or triptych materialization
- admin dashboard workflows
- responder dispatch flows
- hazard zones and geoanalytics
- full TOTP enrollment UX
- registered citizen upgrade UX beyond preserving the future seam

If implementation starts pulling these in, the phase boundary has been lost.

---

## 3. Recommended Approach

Three planning shapes were considered:

1. Monolithic linear phase plan
2. Dual-lane phase plan
3. Three-stage milestone plan

### Recommendation

Use the **dual-lane phase plan**.

Why:

- it matches the actual delivery risk in Phase 1, where some work is blocked on credentials and provider setup while other work is pure repository implementation
- it avoids a misleading flat checklist that mixes local code with cloud-console work
- it gives a clean execution contract: Track B produces deployable, emulator-verified code; Track A wires real infrastructure to that code

The three-stage variant adds more ceremony than this phase needs, while the monolithic variant hides the real blockers.

---

## 4. Architecture and File Ownership

Phase 1 should extend the existing repository boundaries instead of introducing a new auth monolith.

### 4.1 `packages/shared-types`

Owns type-only contracts for the identity spine:

- custom claims shape
- role literals
- account-status literals
- config document shapes needed by clients in Phase 1

This package remains free of SDK code and runtime validation logic.

### 4.2 `packages/shared-validators`

Owns runtime schemas and helper validation for:

- `active_accounts/{uid}`
- `claim_revocations/{uid}`
- `system_config/*` documents used in Phase 1
- `alerts/{alertId}` documents needed by the citizen shell
- rate-limit key helpers if the Phase 1 framework starts here

This package remains the runtime contract layer shared by functions and clients.

### 4.3 `packages/shared-firebase`

Becomes the common Firebase SDK bootstrap layer:

- app initialization
- Auth setup
- App Check setup
- lightweight readers and helpers shared by app surfaces

This package must not become a UI state container. It owns SDK wiring, not screen behavior.

### 4.4 `functions/src`

Should be split into focused Phase 1 modules:

- claim issuance and provisioning
- account activation / suspension sync
- revocation signaling
- bootstrap / seeding utilities if the seed path is codified here

`functions/src/index.ts` should stay a thin export surface.

### 4.5 `infra/firebase/firestore.rules`

Expands from deny-all to a minimal Phase 1 rule surface:

- `alerts/*`: readable by authenticated users
- `system_config/*`: readable by authenticated users, writable only by privileged superadmin paths
- `active_accounts/{uid}`: self-read only
- `claim_revocations/{uid}`: self-read only
- `rate_limits/*`: server-only
- `isActivePrivileged()`: real helper backed by `active_accounts/{uid}`

This phase does not attempt the full collection surface from Phase 2.

### 4.6 `apps/citizen-pwa`

Remains intentionally small in Phase 1:

- auto pseudonymous sign-in on launch
- read-only hello-world feed from `alerts`
- visible auth, app version, and session state
- future seam preserved for later `linkWithCredential()` upgrade work

This app proves the identity spine without becoming an early report workflow.

### 4.7 Other App Surfaces

`apps/admin-desktop` and `apps/responder-app` should not gain half-finished role workflows in Phase 1. They may reuse shared Firebase bootstrap later, but they are not delivery surfaces for this milestone.

---

## 5. Data Flow

Phase 1 proves one citizen flow and one privileged-control flow.

### 5.1 Citizen Boot Flow

On launch, the citizen PWA:

1. initializes Firebase and App Check
2. initializes Firebase Auth
3. signs in pseudonymously if no existing user is present
4. reads `system_config/min_app_version`
5. reads the `alerts` hello-world feed
6. shows auth, version, and availability state in the UI

This flow is read-only and should remain read-only for the entire phase.

### 5.2 Staff Provisioning Flow

A privileged server path provisions staff identity by:

1. validating the requested role and scope
2. issuing custom claims matching the architecture spec
3. writing or updating `active_accounts/{uid}`
4. stamping `lastClaimIssuedAt`

Custom claims remain a cache for authorization context. They are not the revocation source of truth.

### 5.3 Suspension and Revocation Flow

Suspending a staff user updates both revocation layers:

1. write `active_accounts/{uid}.accountStatus = 'suspended'`
2. write `claim_revocations/{uid}`
3. privileged rule checks fail on the next operation through `isActivePrivileged()`
4. the client-side revocation listener forces refresh/re-auth behavior

This mirrors architecture spec section 4.3 and keeps revocation effective even while claims are stale.

### 5.4 Bootstrap and Seed Flow

Phase 1 baseline documents should come from code, not ad hoc console edits. Seeded data should include:

- `system_config/min_app_version`
- any auth/session-related config required by the citizen shell
- one or more benign `alerts` records for the feed

The source of truth for seeded values must live in the repository even if execution in staging is gated.

### 5.5 Deliberate Boundaries

- App Check is wired in Phase 1, but inbox moderation logic does not exist yet because report intake is out of scope.
- Session timeout is scaffolded in Phase 1 as session-age tracking plus re-auth-required state, not full MFA rollout.
- Registered-account upgrade remains a future seam only.

---

## 6. Rules and Authorization Model

Phase 1 adopts the architecture spec's identity model without widening to the full product data surface.

### 6.1 Claims Contract

The claims shape should match the architecture spec:

```ts
interface CustomClaims {
  role: 'citizen' | 'responder' | 'municipal_admin' | 'agency_admin' | 'provincial_superadmin'
  municipalityId?: string
  agencyId?: string
  permittedMunicipalityIds?: string[]
  accountStatus: 'active' | 'suspended' | 'disabled'
  mfaEnrolled: boolean
  lastClaimIssuedAt: number
  breakGlassSession?: boolean
}
```

Phase 1 does not introduce additional role names or convenience aliases.

### 6.2 `isActivePrivileged()`

The current Phase 0 stub must be replaced with the architecture-spec-backed helper:

- check existence of `active_accounts/{uid}`
- require `accountStatus == 'active'`

This helper is what makes staff suspension bite immediately on the next privileged operation rather than waiting for ID token expiry.

### 6.3 Minimal Rule Surface

Rules added in Phase 1 should be limited to the collections needed by the milestone:

- `alerts`
- `system_config`
- `active_accounts`
- `claim_revocations`
- `rate_limits`

All other collections remain denied until Phase 2.

---

## 7. Error Handling

Phase 1 should fail visibly and conservatively.

### 7.1 Citizen Shell

- If App Check initialization fails, show the state and continue where the phase allows.
- If pseudonymous sign-in fails, present a retryable blocking state.
- If `system_config` or `alerts` reads fail, preserve visible auth state and show those data sources as unavailable.
- Never silently collapse a config/feed read failure into "logged out."

### 7.2 Privileged Surfaces

- A suspended staff user must fail closed on the next privileged read or write.
- Revocation listener behavior should push the user toward refresh/re-auth instead of leaving them in a partially working session.
- Missing or malformed authoritative inputs for claim issuance must reject server-side rather than minting partial claims.

---

## 8. Testing Strategy

Phase 1 should be considered valid only if the identity spine works in emulators before any staging wiring happens.

### 8.1 Unit Tests

Add shared tests for:

- identity schemas
- config schemas
- any Phase 1 rate-limit or helper utilities

### 8.2 Rules Tests

Add emulator-backed positive and negative tests for:

- `alerts` authenticated reads
- `system_config` auth reads and privileged writes
- `active_accounts` self-read only
- `claim_revocations` self-read only
- suspended privileged access denied through `isActivePrivileged()`

### 8.3 Integration Tests

Add emulator integration coverage for:

- staff claims issuance
- `active_accounts` sync
- revocation document write
- privileged access blocked after suspension

### 8.4 Manual Verification

The phase demo should prove:

1. fresh browser launch creates a pseudonymous user
2. citizen shell reads seeded config and alert feed
3. staff account receives correct claims
4. suspending `active_accounts/{uid}` blocks the next privileged action
5. revocation signaling reaches the client in the expected window

---

## 9. Exit Criteria

Track B is complete when:

- local emulator tests for auth, rules, and revocation are green
- citizen PWA demonstrates pseudonymous boot and hello-world feed
- server-side claims and revocation logic match the architecture spec

Track A is complete when:

- Terraform apply is reproducible on the target environment
- Firebase/Auth/App Check/provider wiring is complete
- baseline config and alerts are seeded in staging
- the deployed milestone can be demonstrated in staging

**Phase 1 is complete only when both tracks are complete.**

---

## 10. Risks and Mitigations

### 10.1 Manual Drift Risk

If Track A seeds behavior manually in the console, the staging environment will drift from the repository.

**Mitigation:** keep seeded values in code and treat console actions as infrastructure wiring only.

### 10.2 Scope Creep Risk

Identity phases often attract unrelated UI work, especially admin surfaces.

**Mitigation:** keep the only user-facing delivery surface in Phase 1 to the citizen shell.

### 10.3 Revocation Semantics Risk

Implementers may incorrectly treat claims as the revocation source of truth.

**Mitigation:** enforce the `active_accounts` helper in rules and document `claim_revocations` as a refresh signal, not an authorization source.

### 10.4 App Check Misuse Risk

App Check can be misapplied as a trust boundary.

**Mitigation:** keep Phase 1 usage limited to client integrity signaling and wiring; do not encode trust assumptions that contradict the architecture spec.

---

## 11. Implementation Handoff Notes

The implementation plan should:

- use a dual-lane structure
- keep Track B executable locally without cloud credentials
- mark Track A items clearly as human-gated or credential-gated
- define exact files for shared contracts, rules, functions, and citizen PWA wiring
- include emulator-first verification before any staging validation

The plan should not assume that admin or responder surfaces are active delivery targets in this phase.
