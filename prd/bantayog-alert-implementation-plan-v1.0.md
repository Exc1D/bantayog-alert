# Bantayog Alert — Implementation Plan

**Version:** 1.0
**Date:** 2026-04-17
**Status:** Pre-implementation; Phase 0 ready to start
**Scope:** Full platform, zero-to-pilot, 12 phases
**Companion documents:**

- Architecture Spec v8.0 — technical authority
- PRD v1.0 — product authority
- Role specs v2.x — per-role capability detail

---

## 0. How to Read This Plan

This plan sequences the construction of Bantayog Alert from absolute zero to production-cutover-ready. No code has been written yet. No infrastructure provisioned. No MOUs signed.

**Each phase has:**

- **Goal** — the demonstrable thing this phase produces
- **Scope** — capabilities and components in-phase
- **Deliverables** — concrete artifacts and features
- **Exit criteria** — what must be true to start the next phase
- **Dependencies** — what must be done before this phase starts
- **Key risks** — phase-specific risks and their mitigations
- **Duration estimate** — order-of-magnitude, not a commitment

**Principles governing the plan:**

1. **Ship a thin slice end-to-end before any slice goes wide.** Phase 3 delivers the citizen → admin → responder loop for one synthetic scenario. Everything after widens that slice.
2. **Each phase ends at a demonstrable milestone.** If a phase can't be demoed to the PDRRMO Director, the phase definition is wrong.
3. **Pilot readiness gates earlier than production readiness.** Phase 9 is pilot-deployable. Phases 10-12 add the hardening and proof needed for production expansion beyond pilot.
4. **Decision #32 stands: stay on Firebase.** The plan does not hedge against a Postgres migration; if Arch Spec §19 triggers fire, that is a separate plan cycle.
5. **Surge testing is a Phase 8 gate, not a Phase 12 afterthought.** Load-test surge behavior before pilot, not after.
6. **Audit and rules are built with the feature, not bolted on later.** Every phase that introduces a new data class writes the rule + negative tests in the same phase.

**What this plan is not:**

- Not a Gantt chart. Phase order is firm; in-phase task order is flexible.
- Not a staffing plan. Assumes solo developer (Exxeed) with periodic consultation from Anthropic's Claude for review and pair-programming.
- Not a go-to-market plan. Stakeholder engagement, agency onboarding, and citizen outreach run in parallel tracks documented separately.
- Not frozen. Phase exit criteria are the commitment; within-phase sequencing adapts.

---

## Phase Summary

| #   | Phase                                                        | Demonstrable Milestone                                                                                       | Duration est. |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------- |
| 0   | Project Foundation & Stakeholder Anchoring                   | Signed MOU with Province; dev environment operational; monorepo scaffolded                                   | 2-3 weeks     |
| 1   | Infrastructure & Identity Spine                              | Firebase project stack provisioned via Terraform; pseudonymous auth working end-to-end                       | 2-3 weeks     |
| 2   | Data Model & Security Rules Foundation                       | Full schema deployed; 100% negative-test coverage on rules; emulator-validated                               | 3-4 weeks     |
| 3   | End-to-End Thin Slice: Citizen → Admin → Responder           | One citizen report completes the full lifecycle in staging                                                   | 4-5 weeks     |
| 4   | SMS Layer (Inbound + Outbound)                               | Feature-phone citizen submits report via SMS; receives status updates                                        | 3-4 weeks     |
| 5   | Admin Desktop: Triage, Dispatch, Agency Coordination         | Daet MDRRMO drills the verify → dispatch → resolve loop at scale                                             | 4-5 weeks     |
| 6   | Responder App: Capacitor Wrap, Telemetry, Race-Loss Recovery | BFP responder drills a full shift on device                                                                  | 4-5 weeks     |
| 7   | Provincial Superadmin + NDRRMC Escalation + Break-Glass      | PDRRMO exercises the full escalation workflow in tabletop drill                                              | 3-4 weeks     |
| 8   | Surge Readiness: Load, Cost, Pre-Warm                        | k6 500-concurrent surge test passes all SLOs                                                                 | 3-4 weeks     |
| 9   | Pilot-Deployable Milestone (Core Platform Freeze)            | Daet pilot launches with citizen + muni admin + BFP responder onboarded                                      | 2-3 weeks     |
| 10  | Hazard & Geoanalytics                                        | Reference layers uploaded; custom zones operational; polygon mass alerts deliver                             | 4-5 weeks     |
| 11  | Incident Response, Audit Hardening, Training                 | 72-hour breach drill passes; 5+ trained operators; quarterly break-glass drill executed                      | 3-4 weeks     |
| 12  | Production Cutover Readiness                                 | Third-party security review signed off; 30 continuous days of pilot operation; provincial government signoff | 2-3 weeks     |

**Total order-of-magnitude:** 9-12 months elapsed from Phase 0 kickoff to production-cutover-ready. Real schedule depends on PDRRMO engagement pace, typhoon-season impact on stakeholder availability, and agency MOU turnaround.

---

## Phase 0 — Project Foundation & Stakeholder Anchoring

**Goal:** Everything needed to start writing code and have it mean something is in place.

### Scope

- Stakeholder agreements formalized
- Legal framework established
- Development environment operational
- Monorepo scaffolded with the three surface targets
- CI/CD pipeline skeleton running

### Deliverables

1. **Signed MOU with the Province of Camarines Norte** covering scope, data custody, timelines, exit terms. Counterparties: Provincial Governor's Office, PDRRMO Director, solo developer (Exxeed).
2. **NPC DPIA registration filed.** Data Privacy Act compliance documentation covering data classes, retention, actors, lawful basis. Acknowledgment received from National Privacy Commission before any citizen data is collected.
3. **Firebase project trio created:** `bantayog-dev`, `bantayog-staging`, `bantayog-prod`. Billing account linked, quotas configured, service accounts segmented per Arch Spec §13.1.
4. **Terraform + Firebase CLI IaC skeleton.** Arch Spec decision #30: Terraform for Firebase project / IAM / Secret Manager / GCP APIs; Firebase CLI for rules / indexes / functions / hosting. GCS state bucket with object versioning.
5. **Monorepo scaffold** per Arch Spec §2.3:
   - `apps/citizen-pwa/` (Vite + React)
   - `apps/responder-app/` (Capacitor + React)
   - `apps/admin-desktop/` (Vite + React, dual-monitor layout ready)
   - `functions/` (TypeScript Firebase Functions)
   - `packages/shared-validators/` (Zod schemas — source of truth per Arch Spec §0)
   - `packages/shared-types/`
   - `packages/shared-ui/`
   - `infra/firebase/` (rules, indexes source)
   - `infra/terraform/` (project config)
6. **CI/CD pipeline skeleton.** GitHub Actions or equivalent: lint + type-check + unit-test + emulator-test on PR; deploy to dev on main merge; deploy to staging on tag.
7. **Break-glass envelope ceremony.** Two sealed envelopes prepared and handed to Governor's Office and PDRRMO Director per Arch Spec §13.6. Contents generated but unused. Quarterly drill schedule committed.
8. **Agency outreach kickoff.** First meetings with BFP, PNP, Red Cross, DPWH, PCG provincial leadership. MOU drafts circulated. Not-signed-yet is acceptable; dialog-open is the exit criterion.
9. **PDRRMO Director named as NDRRMC escalation endpoint.** Named human + named backup + contact details documented.
10. **Barangay boundary dataset sourced.** LGU survey-grade if available, otherwise OpenStreetMap-derived with manual reconciliation. Dataset versioned in `packages/shared-data/`.

### Exit Criteria

- MOU signed
- NPC DPIA acknowledged
- Three Firebase projects accessible, billing healthy
- Monorepo builds clean from a fresh clone
- CI runs on PR and fails loudly on broken tests
- At least 2 agency preliminary-interest letters received
- Break-glass envelopes physically in custody

### Dependencies

- PDRRMO Director availability for MOU signature
- Legal counsel for DPIA filing
- Provincial government legal office for MOU review

### Key Risks

- **PDRRMO MOU delay.** Mitigation: Phase 0 can stretch without blocking technical prep — monorepo, CI, and IaC skeleton proceed.
- **NPC DPIA turnaround unpredictable.** Mitigation: file early; Phase 1-2 technical work can proceed in parallel; no citizen data collected until acknowledgment received.
- **Barangay dataset quality.** Mitigation: even coarse data is usable for Phase 1-5; refinement pushed to Phase 10 before hazard feature ships.

---

## Phase 1 — Infrastructure & Identity Spine

**Goal:** A citizen can sign in pseudonymously on the web PWA and see a Hello, World feed.

### Scope

- Firebase infrastructure fully provisioned via Terraform
- Pseudonymous Auth + registered Auth working
- Custom claims provisioning pipeline
- App Check enforced (soft gate on inbox — Arch Spec decision #13)
- `system_config` and `rate_limits` foundational collections
- Active-account + claim-revocation infrastructure

### Deliverables

1. **Terraform apply** provisions: Firebase project resources, Firestore database (native mode), Realtime Database, Cloud Storage buckets, Secret Manager, IAM service accounts, Cloud Functions deployment permissions.
2. **Anonymous Auth + Email Auth enabled.** Pseudonymous UID per Arch Spec §4.1 matrix; registered accounts link via `linkWithCredential()`.
3. **Custom claims service.** Cloud Function `setStaffClaims` issues role + `municipalityId` / `agencyId` / `permittedMunicipalityIds` + `accountStatus` claims per Arch Spec §4.2.
4. **`active_accounts/{uid}` collection.** CF-maintained. Per Arch Spec §4.3, the authoritative revocation source; staleness window ≤ 60s.
5. **`claim_revocations/{uid}` collection.** Force-refresh hook writes here; token refresh checks on next request.
6. **Session timeout implemented.** 4h superadmin / 8h muni admin / 12h responder re-auth prompt per Arch Spec §4.4. TOTP scaffolded (full MFA in Phase 7).
7. **App Check enabled** on all three surfaces. Arch Spec decision #5: not a trust boundary, but raises cost-of-abuse floor. Inbox path treats App Check failure as elevated-moderation signal, not rejection.
8. **System config bootstrap.** `system_config/min_app_version` / `system_config/rate_limits_defaults` / `system_config/sms_provider_config` seeded.
9. **Rate-limit framework.** `rate_limits/{key}` collection + shared helper in `packages/shared-validators`.
10. **"Hello, world" citizen PWA.** Pseudonymous sign-in; reads an empty `alerts/{alertId}` collection; shows app-version and auth-status.
11. **Identity + auth emulator tests.** Positive and negative cases for custom claims; force-refresh behavior; session-timeout prompt.

### Exit Criteria

- Terraform apply is reproducible from scratch on a throwaway project in < 30 min
- Anonymous sign-in succeeds on fresh browser within 3s in dev
- Staff account provisioned via admin tool carries correct custom claims verified in Firebase Auth Explorer
- Suspending an account via `accountStatus: 'suspended'` in `active_accounts` takes effect within 60s on a live session
- App Check token fetched and validated on every request to a protected endpoint

### Dependencies

- Phase 0 complete

### Key Risks

- **Custom claims size approaches 1KB limit for superadmins with `permittedMunicipalityIds: [all 12]`.** Mitigation: measure actual size; if concerning, move `permittedMunicipalityIds` to a separate `users/{uid}` doc checked on privileged paths.
- **App Check device attestation fails on older Android devices.** Mitigation: soft-gate per decision #13; monitor rejection rate in staging.

---

## Phase 2 — Data Model & Security Rules Foundation

**Goal:** Every Firestore collection defined in Arch Spec §5.5 exists, has a Zod schema, and has rules with 100% positive + negative test coverage.

### Scope

- Full schema definitions in `packages/shared-validators`
- Firestore rules for every collection
- Composite index plan deployed
- RTDB rules
- Storage rules
- Idempotency framework

### Deliverables

1. **Zod schemas** in `packages/shared-validators` for every document type in Arch Spec §5.1-§5.6 including the report triptych (`reports`, `report_private`, `report_ops`), `report_sharing`, dispatches, users, responders, agencies, alerts, emergencies, audit logs, rate limits, idempotency keys, dead letters, SMS layer collections, coordination collections (agency assistance, mass alert requests, command channel, shift handoffs), hazard signals, hazard zones, incident response events.
2. **Firestore rules** — full rule set per Arch Spec §5.7. Every rule carries explicit positive + negative emulator tests. **CI fails if any rule lacks negative tests** (enforced via rule-test coverage tool).
3. **RTDB rules** per Arch Spec §5.8: responder_locations, responder_index, shared_projection.
4. **Storage rules.** Admin SDK only for privileged paths (media, hazard reference layers).
5. **Composite indexes deployed.** Arch Spec §5.9 + hazard indexes. Verify via `firebase firestore:indexes`.
6. **Idempotency framework** per Arch Spec §6.2: `idempotency_keys/{key}` collection + canonical payload hash helper in shared-validators + dedup-table-first pattern.
7. **Rule test harness.** Vitest + Firebase Emulator. CI target: 100% of rules have negative tests. Coverage report uploaded per PR.
8. **Negative test catalog.** Explicit tests for: cross-municipality leakage; agency writing to another agency's responder; responder writing to another responder's dispatch; citizen reading `report_private`; unauthenticated writes to any privileged path; rate-limit bypass attempts.
9. **Schema migration protocol documented.** Arch Spec §13.12. Template for future migrations.

### Exit Criteria

- Every collection in Arch Spec §5.5 is writable via Admin SDK in the emulator, readable per rules, writable by client SDKs only where rules explicitly allow
- CI rule-test run: 100% positive, 100% negative coverage, zero flaky tests across 20 consecutive runs
- Composite index deployment reproducible from `firestore.indexes.json`
- Idempotency tested: same key + different payload fails with `ALREADY_EXISTS_DIFFERENT_PAYLOAD`; same key + same payload returns cached result

### Dependencies

- Phase 1 complete

### Key Risks

- **Rule complexity grows beyond emulator test tractability.** Mitigation: modularize rules per collection; helpers (`isAuthed()`, `adminOf()`, etc.) tested independently first.
- **Cost modeling for `isActivePrivileged()` underestimates real load.** Mitigation: Arch Spec §5.7 has a 3-layer mitigation plan documented; measure in Phase 8 load test.

---

## Phase 3 — End-to-End Thin Slice: Citizen → Admin → Responder

**Goal:** One simulated citizen submits a report on the web PWA in Daet. One Daet muni admin verifies it and dispatches. One BFP responder accepts and marks resolved. The full triptych lifecycle completes. Observed in staging.

This is the highest-risk phase because it's the first time the whole stack stands up end-to-end. Everything after widens this slice.

### Scope

- Citizen web PWA submission flow (network-present only; offline in Phase 4)
- `processInboxItem` trigger materializes the triptych
- Admin Desktop minimum triage view (list + detail, verify + reject)
- `verifyReport`, `rejectReport`, `dispatchResponder`, `cancelDispatch` callables
- Responder app minimum: receive FCM, accept, resolve
- Report lifecycle state machine (all 13 states per Arch Spec §5.3)
- Dispatch state machine (per Arch Spec §5.4)
- FCM push delivery
- Minimum event streams: `report_events`, `dispatch_events`

### Deliverables

1. **Citizen PWA submission screen.** Form: type, severity (auto/low/medium/high), description, optional photo, GPS auto-capture with precision banner. Submits directly to `report_inbox` per Arch Spec decision #13.
2. **Media upload via signed URL** per Arch Spec §10.6. `requestUploadUrl` callable issues URL with MIME + size restrictions. `onFinalize` trigger handles EXIF strip, MIME magic-byte verify, registration to `reports/{id}/media`.
3. **`processInboxItem` trigger.** Validates inbox payload via Zod; materializes the triptych inside a Firestore transaction; writes `report_events` entries; dedup-guards via idempotency key.
4. **`minInstances: 3` + `inboxReconciliationSweep`** per Arch Spec §10.3. Not yet surge-tested (that's Phase 8) but infrastructure in place.
5. **Admin Desktop triage queue.** List of `awaiting_verify` reports scoped to admin's municipality. Detail view with triptych data per role. Verify / reject / merge actions.
6. **`verifyReport` / `rejectReport` / `mergeReports` callables.** Server-authoritative, transactional across `reports` + `report_ops` + `report_events`.
7. **`dispatchResponder` callable.** Creates `dispatches/{id}` in `pending` state; sends FCM to responder.
8. **Responder app minimum viable.** Capacitor wrap scaffolded (full native features in Phase 6); FCM receiver; accept / decline button; navigates through `acknowledged → in_progress → resolved` via direct writes with rule-bounded scope (decision #14: `pending → accepted` is callable; subsequent transitions are responder-direct).
9. **Report lifecycle state machine** implemented in rules + server per Arch Spec decision #10. All 13 states supported; invalid transitions rejected.
10. **E2E test:** Playwright scenario: citizen submits → admin verifies → admin dispatches → responder accepts → responder resolves → admin closes. Runs against staging on every release candidate.
11. **Observability minimum.** Cloud Logging structured logs with correlation IDs per Arch Spec §12.3. Basic dashboard showing inbox backlog, dispatch counts, function errors.

### Exit Criteria

- The E2E scenario completes in < 30s wall-clock in staging
- All 13 report lifecycle states reachable and correctly gated
- FCM push delivered to responder device within 10s p95 in staging
- Dedup verified: same submission replayed twice creates exactly one report
- `processInboxItem` cold-start verified: kill warm instances, submit, report still materializes within reconciliation-sweep window

### Dependencies

- Phase 2 complete
- At least one real device for FCM testing (iOS + Android)
- BFP preliminary MOU allowing a test responder account (real MOU not required for staging)

### Key Risks

- **FCM token lifecycle issues on iOS.** Mitigation: token refresh hook; manual re-subscribe on app foreground; fallback to periodic poll for dispatch state.
- **Dispatch race conditions.** Mitigation: `acceptDispatch` is server-authoritative and transactional per Arch Spec decision #14; responder race-loss recovery UX is Phase 6 scope.
- **Admin Desktop complexity balloons.** Mitigation: Phase 3 deliberately ships the minimum viable triage view. Full dashboard is Phase 5.

---

## Phase 4 — SMS Layer (Inbound + Outbound)

**Goal:** A feature-phone citizen can submit a report by SMS and receive status updates via SMS.

### Scope

- Semaphore integration (outbound primary)
- Globe Labs integration (outbound failover + inbound)
- `sms_inbox` → `report_inbox` parsing pipeline
- `sms_outbox` with idempotency per recipient/purpose
- Circuit-breaker between providers
- Citizen PWA offline persistence (localForage dual-write)
- GSM-7 / UCS-2 handling with `ñ` support

### Deliverables

1. **Semaphore client wrapped as `sendSMS` internal service.** Per Arch Spec §3. Handles GSM-7 vs UCS-2 detection; surfaces segment count to admin UI; never silently strips `ñ` or emoji (decision #48).
2. **Globe Labs client as failover.** Same `sendSMS` interface; circuit-breaker (`sms_provider_health/{providerId}`) flips between them on 5% error rate or downtime.
3. **`POST /smsInbound` webhook** — Globe Labs keyword routing per Arch Spec §3 / decision #22. Keywords: `BANTAYOG`, `TULONG`, report-type keywords. Writes to `sms_inbox/{msgId}`.
4. **SMS inbound parser.** Handles Tagalog + English + regional spelling variants. Confidence score; low-confidence routes to `moderation_incidents` instead of `report_inbox`. Barangay-only precision (Arch Spec §11.1: no GPS from SMS).
5. **`sms_sessions/{msisdnHash}`** — rate-limit state + tracking-PIN vault. Per Arch Spec §3, msisdn is SHA-256-hashed; never stored raw.
6. **Outbound SMS idempotency.** Per Arch Spec §6.2: key = `(reportId, purpose, recipientMsisdn)`. A retry of "your report was received" cannot text twice.
7. **SMS delivery reports.** `POST /smsDeliveryReport` webhook updates `sms_outbox` entries. `reconcileSmsDeliveryStatus` scheduled job every 10 min handles late callbacks.
8. **Citizen PWA offline persistence.** localForage dual-write per Arch Spec decision #23. IndexedDB-eviction recovery tested on iOS.
9. **UI failure states.** Per Arch Spec §9.3: distinguish `draft`, `queued`, `submitting`, `server_confirmed`, `failed_retryable`, `failed_terminal`.
10. **Tracking reference + secret.** Per Arch Spec decision #18: human-readable reference displayed to citizen; secret needed for status lookup. `report_lookup/{publicRef}` callable-only (no client reads).
11. **Sender ID approval.** Semaphore sender ID "BANTAYOG" or equivalent requested (lead time varies). Interim default sender used during wait; UI labels this per Arch Spec §16 risk.

### Exit Criteria

- Pilot-blocker scenario #8 passes: feature-phone user texts `BANTAYOG BAHA CALASGASAN` → report materializes with barangay-only precision; auto-reply sent.
- Pilot-blocker scenario #9 passes: Semaphore returns 500 for 30s → circuit-breaker flips to Globe Labs → no messages dropped.
- Pilot-blocker scenario #12 passes: IndexedDB eviction during offline draft → localForage recovers → report submits.
- Pilot-blocker scenario #30 passes: `ñ` delivers intact through UCS-2 path with correct segment count shown to admin.
- SMS delivery attempt success > 90% priority / 80% normal over 24h staging soak.

### Dependencies

- Phase 3 complete
- Semaphore account provisioned + sender ID request filed
- Globe Labs access obtained (keyword, webhook URL registered)

### Key Risks

- **Sender ID approval latency.** Mitigation: interim default sender; UI labeling; escalation path with Semaphore support per Arch Spec §16.
- **Parser accuracy below 95% on real-world Tagalog variants.** Mitigation: low-confidence routes to moderation rather than silent failure; pilot-blocker gate is "parse accuracy ≥95% on validated ground-truth sample" not "100% on all input."
- **Inbound SMS abuse / spam.** Mitigation: per-msisdn rate limits + elevated moderation default + duplicate-cluster detection per Arch Spec §16.

---

## Phase 5 — Admin Desktop: Triage, Dispatch, Agency Coordination

**Goal:** A Daet muni admin can handle a realistic surge load of synthetic reports with the full set of triage capabilities. Agency assistance workflow operates end-to-end.

### Scope

- Admin Desktop full triage UI (surge mode, bulk operations, duplicate clustering)
- Agency assistance request workflow
- Border-incident sharing (`report_sharing`)
- Command Channel threads
- Mass alert with Reach Plan preview (single-muni direct path only; NDRRMC escalation is Phase 7)
- Shift handoff
- Field mode (narrow offline scope)
- Admin-side analytics minimum

### Deliverables

1. **Surge triage mode** per Arch Spec §7.3.1. Client-side filter/sort; scannable list view; single-key shortcuts (V/R/M/S); 100-report render cap with pagination.
2. **Duplicate clustering.** `duplicateClusterId` set by trigger on proximity + time window; cluster view groups them; merge callable resolves.
3. **Agency assistance request workflow.** `requestAgencyAssistance` callable; `agency_assistance_requests/{id}` with 30-min auto-escalate to superadmin if unresponded. Agency Admin UI minimum viable (expanded in Phase 6).
4. **`report_sharing` and border-incident auto-share.** Arch Spec §7.3.2 + decision #46. CF trigger on geo-intersection with muni boundary buffer (500m) auto-shares to adjacent muni.
5. **Command Channel threads** per Arch Spec §7.3.3. `command_channel_threads/{threadId}` + `command_channel_messages/{messageId}`. Auto-created on share / agency-request / escalation.
6. **Mass alert Reach Plan preview.** `massAlertReachPlanPreview` callable: estimates recipients per channel (FCM + SMS); routing decision (≤5k + single-muni → direct; else → escalation). Direct-path `sendMassAlert` fans out FCM + Semaphore priority queue. NDRRMC escalation is Phase 7.
7. **Shift handoff** per Arch Spec §7.6. `initiateShiftHandoff` / `acceptShiftHandoff` callables; active-incident snapshot; 30-min unaccepted alert.
8. **Field mode** per Arch Spec §2.1 / decision #37. `enterFieldMode` / `exitFieldMode` callables with streaming audit; narrow offline scope (notes + messages only); replay on reconnect.
9. **Admin analytics minimum.** Municipality-scoped counts: reports by status, by severity, by barangay, by time-of-day. BigQuery-backed; real-time from Firestore for "active incidents."
10. **Admin Desktop blocks offline writes** per decision #37, except field-mode scope. Clear UI signal.
11. **Dispatch timeouts.** `dispatchTimeoutSweep` every 30s applies `pending → timed_out` per Arch Spec §10.1.

### Exit Criteria

- Daet muni admin staff drill: 3 admins handle 300 synthetic reports in 60 min with p95 dispatch creation < 10s
- Agency assistance drill: muni requests → agency accepts → dispatches → resolves; latency measured end-to-end per Arch Spec §20 item 21
- Border-incident auto-share drill: report at Daet-Mercedes boundary auto-shares; both admins see shared badge
- Shift handoff drill: 30-min unaccepted handoff triggers superadmin notification

### Dependencies

- Phase 4 complete
- Daet MDRRMO staff available for drills
- At least 1 Agency Admin onboarded (likely BFP per Phase 0 outreach)

### Key Risks

- **Surge mode UX complexity.** Mitigation: iterate with Daet staff; ship minimum surge mode Phase 5, refine Phase 8 before load test.
- **Reach Plan estimate accuracy.** Mitigation: pilot validates ±10% accuracy per Arch Spec §20 item 22; adjust after real data.
- **Auto-share edge cases on odd municipality boundaries.** Mitigation: the 500m buffer is tunable in `system_config`; pilot observation informs value.

---

## Phase 6 — Responder App: Capacitor Wrap, Telemetry, Race-Loss Recovery

**Goal:** A BFP responder runs a full 12-hour drill shift with battery drop < 15% and handles race-loss cleanly.

### Scope

- Full Capacitor wrap (iOS + Android) with background handling
- Motion Activity API + geofence-at-staging per Arch Spec decision #25
- Responder RTDB telemetry per Arch Spec §8
- Responder-witnessed report (accelerated intake per decision #36)
- SOS / Backup / Unable-to-complete flows
- Responder race-loss recovery UX (decision #49)
- Responder-to-responder shift handoff
- Cross-agency projection (decision #39)

### Deliverables

1. **Capacitor iOS build.** TestFlight distribution for internal testing. Apple Developer Account provisioned per Arch Spec §2.1.
2. **Capacitor Android build.** APK distribution; Google Play internal track for wider test.
3. **Background location with Motion Activity** per Arch Spec §8.2. Sampling adapts to motion state; 10-min GPS at low battery.
4. **Geofence-at-staging.** Staging-area geofence triggers high-fidelity telemetry; outside geofence reverts to low-fidelity.
5. **`responder_locations/{uid}` RTDB writes** per Arch Spec §8.1 + §5.8 rules. Timestamp validation enforced at rule layer.
6. **`responder_index/{uid}`** CF-maintained projection for rule evaluation. Arch Spec §5.8.
7. **Cross-agency `shared_projection/{municipalityId}/{uid}`** per Arch Spec §8.5. 30s cadence, 100m grid, 90s TTL. `projectResponderLocationsForMunicipalities` scheduled function.
8. **Responder-witnessed report flow** per Arch Spec §7.2 + decision #36. `submitResponderWitnessedReport` callable writes directly to `new` with `source: 'responder_witness'` + `witnessPriorityFlag: true`. Routes through muni admin verification (not bypass).
9. **SOS / Backup / Unable-to-complete callables.** `triggerSOS`, `requestBackup`, `markDispatchUnableToComplete`. SOS fans FCM to all admins + agency admin + superadmin.
10. **Race-loss recovery UX** per Arch Spec §9.4 + decision #49. Concurrent admin-cancel during responder's `in_progress → resolved` write results in rejection; UI rebuilds screen from server state with institutional-label cancellation screen. Pilot-blocker scenario #25.
11. **Responder-to-responder shift handoff.** `initiateResponderHandoff` callable + `responder_shift_handoffs/{id}`. In-app acceptance by incoming responder.
12. **Agency Admin Desktop extensions.** Roster management (`createResponder`, `suspendResponder`, `revokeResponderAccess`), shift toggles (`bulkSetResponderAvailability`), specialization tags, accept/decline assistance requests.

### Exit Criteria

- Pilot-blocker scenario #13 passes: responder stationary 4h at staging → battery drop < 15%.
- Pilot-blocker scenario #17 passes: responder-witness flow drill p95 verification < 5 min.
- Pilot-blocker scenario #24 passes: Unable-to-complete → report returns to admin queue → reassigned → audit continuous.
- Pilot-blocker scenario #25 passes: admin-cancel during responder resolve race → institutional-label cancellation screen shown.
- Cross-agency projection staleness < 90s during live multi-agency drill.

### Dependencies

- Phase 5 complete
- Apple Developer Account active
- BFP MOU signed (minimum) — other agencies parallel-track
- Real iOS + Android devices for shift drill

### Key Risks

- **iOS background location reliability.** Mitigation: pilot-blocker drill catches regressions; silent-device detection per Arch Spec §16 surfaces issues to operators.
- **Apple review rejects dispatch-style usage.** Mitigation: dispatch app positioning (not consumer location tracking); clear privacy disclosure; App Store optimization.
- **Battery performance varies by device model.** Mitigation: pilot-blocker uses reference devices; variance documented as known residual.

---

## Phase 7 — Provincial Superadmin + NDRRMC Escalation + Break-Glass

**Goal:** PDRRMO Director exercises the full escalation workflow in tabletop drill. Break-glass procedure completes dry run. MFA is live for all staff.

### Scope

- Provincial Superadmin Admin Desktop (dual-monitor layout)
- NDRRMC escalation workflow end-to-end
- `declareEmergency` callable
- Break-glass sealed-credential procedure
- Full MFA + TOTP for all staff roles
- Streaming audit pipeline (BigQuery Storage Write API)
- Batch audit pipeline (5-min to BigQuery)
- Provincial resources management
- Incident-response events infrastructure (Arch Spec §14 foundation)

### Deliverables

1. **Provincial Superadmin Admin Desktop.** Dual-monitor layout: analytics primary, provincial map secondary. Province-wide queue visibility; all muni-admin capabilities unrestricted.
2. **NDRRMC escalation workflow** per Arch Spec §7.5.1. `requestMassAlertEscalation` → `mass_alert_requests/{id}` → PDRRMO FCM + priority SMS → `forwardMassAlertToNDRRMC` → NDRRMC receipt timestamp. UI distinguishes "submitted to NDRRMC" from "sent via SMS layer" (decision #33).
3. **`declareEmergency` callable.** Fans out FCM + SMS to all active staff + authorized citizen subset. Rate-limited and audit-streamed.
4. **Break-glass `initiateBreakGlass` callable** per Arch Spec §13.6. Dual-control unseal; 4h auto-expiring `breakGlassSession: true` claim; every action streams to `breakglass_events/{id}` + streaming audit path.
5. **Full MFA + TOTP** per Arch Spec §4.5 + decision #20. All admin+ roles. Phone OTP for all staff.
6. **Streaming audit pipeline.** BigQuery Storage Write API per Arch Spec §12.2. 60s gap alert. Security-critical events classified per Arch Spec §12.2 list.
7. **Batch audit pipeline.** 5-min Cloud Logging → BigQuery export. 15-min gap alert.
8. **Third-party security review scheduled.** External consultancy engaged per Arch Spec §13.11. Kickoff in Phase 7; findings expected Phase 10-11.
9. **Provincial resources management.** `provincial_resources/{id}` CRUD callables. Mutual-aid visibility toggle.
10. **Retention exemption workflow.** `setRetentionExempt` callable with streaming audit.
11. **Incident-response event infrastructure.** `incident_response_events/{id}` collection + write path via `recordIncidentResponseEvent` callable. Full runbook execution is Phase 11.
12. **Privileged-read streaming audit.** Superadmin reads of `report_private` / `report_contacts` stream per Arch Spec §12.2.

### Exit Criteria

- Pilot-blocker scenario #12 passes: break-glass drill — dual-control → 4h session → auto-deactivation → audit trail complete.
- Pilot-blocker scenario #23 passes: NDRRMC escalation tabletop drill with PDRRMO Director; baseline latency measured.
- Streaming audit gap < 60s over 24h staging soak (Arch Spec §13.2 SLO).
- Batch audit gap < 15min over 24h staging soak.
- 100% MFA adoption verified for all staff test accounts.

### Dependencies

- Phase 6 complete
- PDRRMO Director available for tabletop drill
- NDRRMC coordination sufficient to simulate the forward-to-NDRRMC step (real NDRRMC integration may happen in parallel; pilot uses simulated receipt)
- Governor's Office + PDRRMO Director available for break-glass custody drill

### Key Risks

- **Break-glass drill exposes custody-chain gaps.** Mitigation: the drill's purpose is to catch exactly this. Quarterly ongoing.
- **NDRRMC coordination unavailable.** Mitigation: escalation workflow is self-contained internally; NDRRMC receipt timestamp can be simulated for pilot; real handoff informed by pilot data.
- **Streaming audit cost higher than modeled.** Mitigation: Arch Spec §5.7 cost-alert at 5× baseline; classification can tighten if needed.

---

## Phase 8 — Surge Readiness: Load, Cost, Pre-Warm

**Goal:** The full stack passes a k6 surge simulation: 500 concurrent citizen submits, 100 admin dashboards, 60 GPS streams, duplicate submissions, notification bursts, websocket reconnection storms. All SLOs hold.

### Scope

- k6 load test harness
- Surge pre-warm mechanism (Arch Spec §10.3)
- PAGASA signal ingest three-tier (Arch Spec §10.2)
- Cost dashboard + anomaly alerting
- Transaction contention validation
- RTDB reconnect-storm mitigation

### Deliverables

1. **k6 load test harness.** Scenarios per Arch Spec §15 table: 500 concurrent `acceptDispatch` on same report; 500 citizen submits in 60s; 100 admin dashboards polling; websocket reconnection storms. Runs against staging.
2. **Transaction contention validation.** Pilot-blocker scenario #26: 500 concurrent `acceptDispatch` → exactly one wins, p99 < 5s. Fallback: sharded counter for `activeResponderCount` if measured.
3. **Surge pre-warm** per Arch Spec §10.3 + §10.2. `hazard_signals` write with `signalLevel >= 2` → `applySurgePreWarm` raises `minInstances` for hot-path functions from 3 to 20. Auto-reverts 6h after signal drops below 2.
4. **PAGASA signal ingest — three tiers.** Webhook (if available), scraper (`pagasaSignalPoll` every 15min), manual toggle (superadmin `Declare Hazard Signal` action). Pilot-blocker scenario #14 + #28.
5. **Cost dashboard.** Daily spend by service; 7-day rolling baseline; anomaly detection; alerts at 150% baseline + 5× baseline.
6. **RTDB reconnect-storm handling** per Arch Spec decision #6 + §16 risk. Jitter + backoff on client; 5× cost alert.
7. **Dispatch contention stress test.** Pilot-blocker scenario #23: two muni admins simultaneously merge overlapping duplicate clusters → one wins, other retries.
8. **Cold-start simulation.** Pilot-blocker scenario #10: `processInboxItem` fails for specific item → reconciliation sweep retries within 5 min, no dead-letter escapes.
9. **Dashboard: `/system_health`** per Arch Spec §13.8. Polls every 30s; all key queue depths and service indicators.
10. **Observability dashboards** per Arch Spec §13.9: Ops, Backend, Compliance, Cost. Four separate views per audience.

### Exit Criteria

- All pilot-blocker scenarios that stress load (k6 surge scenarios) pass.
- Cost under real surge-simulated workload ≤ 2× baseline per Arch Spec §20 item 16.
- Streaming audit gap, batch audit gap, inbox reconciliation backlog all hold within SLO during surge.
- PAGASA scraper handles a real signal change during staging (or manual toggle drill validates the fallback path).

### Dependencies

- Phase 7 complete
- k6 or equivalent load-test tool provisioned
- Staging environment scaled to realistic surge pilot size

### Key Risks

- **Surge reveals architecture regression not caught in unit/integration tests.** Mitigation: this phase exists exactly to catch this. Regressions block pilot deployment.
- **Cost explodes beyond 2× during test.** Mitigation: circuit breakers on hot paths; throttle mechanisms; cost-dashboard alerts before pilot goes live.
- **RTDB cost spike during reconnect storm exceeds 5× baseline.** Mitigation: jitter + backoff; RTDB cost dashboard; fallback to polling if unfixable.

---

## Phase 9 — Pilot-Deployable Milestone (Core Platform Freeze)

**Goal:** Daet pilot launches. Citizens submit real reports. MDRRMO triages in production. BFP responders dispatch real calls. 30-day continuous-operation clock starts.

This is the **production readiness gate** for the core platform. Phases 10-12 add hazard, harden audit, and graduate out of pilot — but the platform operates in pilot starting here.

### Scope

- Production Firebase project hardened
- Pilot-muni rollout (Daet primary)
- Citizen onboarding + outreach
- Staff training for pilot muni + pilot agency
- Degraded-mode runbook written and drilled
- Daily operational monitoring routines
- Core platform frozen for 30-day measurement window

### Deliverables

1. **Production cutover to `bantayog-prod`.** Terraform-applied; rules + indexes + functions deployed from tagged release.
2. **Citizen PWA public URL.** Hosted via Firebase Hosting with SSL + custom domain (pending provincial government approval).
3. **SMS keyword active on Globe Labs.** Citizens can text `BANTAYOG` from any Globe/TM number in Camarines Norte.
4. **Daet MDRRMO onboarded.** All 3-5 muni admin accounts provisioned; TOTP enrolled; surge triage drilled; shift handoff tested.
5. **BFP Daet responders onboarded.** Minimum 10 responders with accounts + responder app installed on their devices.
6. **Citizen public awareness campaign.** Coordinated with PDRRMO: barangay-level outreach, flyers with tracking-reference paper-fallback, SMS keyword instructions.
7. **Degraded-mode runbook** per Arch Spec §13.10. SMS-only fallback workflow, paper forms, communications plan. Drilled in staging before production.
8. **Quarterly full-stack restore drill** per Arch Spec §13.3. First drill executed before pilot launch.
9. **`system_config/min_app_version`** enforced per surface. Force-upgrade path tested.
10. **Daily operational monitoring routine.** On-call rotation; dashboards checked daily; alerts triaged per runbook.
11. **Pilot signoff: PDRRMO Director approves go-live.**
12. **30-day continuous-operation clock starts.**

### Exit Criteria

- First citizen submission from Daet reaches `resolved` state in production.
- Core SLOs per Arch Spec §13.2 hold during first 7 days.
- Daily monitoring routine executed; no unhandled alerts.
- Pilot muni admin daily-active rate ≥ 80% over first 14 days.
- PDRRMO Director signs pilot-launch statement.

### Dependencies

- Phase 8 complete — all surge and audit gates cleared
- Daet MDRRMO + BFP Daet MOUs signed
- Citizen outreach materials approved by PDRRMO
- NPC DPIA acknowledgment on file (from Phase 0)

### Key Risks

- **Real typhoon hits during Phase 9.** Mitigation: the degraded-mode runbook exists precisely for this; the platform's readiness for worst-case is the pilot goal. A hit during Phase 9 is the most important validation possible, even if disruptive.
- **Production issue outside staging coverage.** Mitigation: daily monitoring + rollback capability (Arch Spec §13.4) + dead-letter replay.
- **Low citizen submission volume.** Mitigation: adoption metrics reviewed weekly; outreach iteration; SMS-fallback reach is easier than web adoption.

---

## Phase 10 — Hazard & Geoanalytics

**Goal:** Reference hazard layers (PAGASA flood, MGB landslide, PAGASA storm surge) are uploaded and visible to admins. Custom zones can be drawn. Polygon mass alerts deliver with Reach Plan accuracy.

This is the full hazard feature per Arch Spec §22. Ships into the already-live pilot.

### Scope

- Hazard zones data model (`hazard_zones` + history)
- Hybrid spatial storage (Cloud Storage + Firestore + BigQuery GIS)
- Reference layer upload + supersede workflow
- Custom zone draw + edit + delete + expiration
- Auto-tag at ingest (in `processInboxItem`)
- Zone sweep on custom-zone edit
- Polygon-targeted mass alerts
- Hazard analytics dashboard
- Barangay boundary dataset finalized and deployed

### Deliverables

1. **Hazard zones schema + Firestore rules + indexes** per Arch Spec §22.2, §5.7 hazard block, §5.9 hazard indexes.
2. **Cloud Storage bucket `bantayog-hazards-{env}`** per Arch Spec §22.3. IAM restricted to service account.
3. **BigQuery hazard tables** `hazards.zones` and `hazards.report_tags` per Arch Spec §22.3. Mirror pipeline runs every 5 min.
4. **`requestHazardUploadUrl` + `uploadHazardReferenceLayer` callables.** Superadmin-only. Douglas-Peucker simplification via `@turf/simplify`; vertex cap (500 default); bbox + 6-char geohash prefix computed.
5. **`supersedeHazardReferenceLayer` callable.** Marks prior version `supersededBy` + `supersededAt`. History preserved.
6. **`createCustomHazardZone` / `updateCustomHazardZone` / `deleteCustomHazardZone` callables.** Muni admin scoped to own muni (any authorship); Superadmin unrestricted. Firestore transactions for create + history/v1 atomicity.
7. **Hazard auto-tag in `processInboxItem`.** Runs AFTER triptych transaction commits (decision #60). Geohash-prefix query + neighbor lookup + Turf.js point-in-polygon → `hazardZoneIds[]` + `hazardZoneIdList[]` on `report_ops`.
8. **`hazardZoneSweep` trigger** — onWrite `hazard_zones/{zoneId}` where `zoneType === 'custom'`. Bbox-union candidate query + delta computation.
9. **`hazardTagBackfillSweep` scheduled** every 5 min. Primary recovery for ingest auto-tag failures.
10. **`hazardZoneExpirationSweep` scheduled** hourly. Sets `expiredAt`; preserves tags (decision #58).
11. **`hazardReferenceBigQueryMirror`** every 5 min. Exports zone + tag deltas.
12. **Polygon-targeted mass alerts.** Extended `massAlertReachPlanPreview` / `sendMassAlert` / `requestMassAlertEscalation` accept `targetType: 'polygon'` + `targetGeometry`. De minimis boundary handling per Arch Spec §22.8.
13. **Barangay boundary dataset finalized.** Source reconciled (LGU survey + OSM); versioned in `packages/shared-data/`; reverse-geocoding callable cached in CF memory.
14. **Hazard analytics callables.** `hazardAnalyticsZoneTagCounts`, `hazardAnalyticsMunicipalityRiskDensity`, `hazardAnalyticsReportsInZone`. Jurisdiction-scoped server-side.
15. **Admin Desktop Hazard Layers tab.** Map layer panel (3 reference toggles); custom zone list; draw affordance (Leaflet-Draw); zone editor. Per Arch Spec §22.14.
16. **Superadmin Reference Layer Management panel.** Upload, inspect, supersede. Version history view.
17. **Rate limits** per Arch Spec §22.11 + emergency multiplier per `declareEmergency`.

### Exit Criteria

- Pilot-blocker scenarios #31-#46 all pass.
- Real PAGASA 2024 flood map uploaded, simplified, visible on Daet admin map within 30s.
- Pilot acceptance criteria #32-#39 (hazard-specific) hold during first 7 days of hazard feature operation.
- Polygon mass alert drill: Reach Plan estimate within ±10% of actual delivery count.
- No hazard auto-tag failures escape `hazardTagBackfillSweep` within 1h at p95.

### Dependencies

- Phase 9 complete — pilot running stably
- PAGASA + MGB hazard maps obtained via official channels (licensing + attribution captured)
- Barangay boundary dataset finalized
- BigQuery GIS confirmed enabled in `bantayog-prod`

### Key Risks

- **PAGASA polygon complexity exceeds 500-vertex cap.** Mitigation: Arch Spec §22.16 open risk; `maxVertices` in `system_config` is adjustable without redeploy; bump to 1000 if pilot data warrants.
- **Barangay boundary dataset accuracy in rural munis.** Mitigation: pilot observation informs refinement; reverse-geocode miss rate monitored per Arch Spec §22.16.
- **Leaflet-Draw UX on tablets fails at field-admin use.** Mitigation: Phase 10 includes field-drill with tablet; iteration before freeze.

---

## Phase 11 — Incident Response, Audit Hardening, Training

**Goal:** 72-hour breach drill passes end-to-end. Five-plus trained operators across pilot muni + pilot agency. Quarterly break-glass drill completed. Third-party security review findings resolved.

### Scope

- Arch Spec §14 incident response runbook executed in drill
- Audit pipeline hardened against gap scenarios
- Capability contract tests expanded to 100% UI coverage
- Operator training curriculum delivered
- Runbook library published
- Third-party security review findings closed
- Post-pilot review prep

### Deliverables

1. **Full 72-hour incident response runbook** per Arch Spec §14. Drill executes: declaration → containment → notification → forensic reconstruction → closure. Pilot-blocker scenario #29.
2. **Audit gap drill.** Simulated BigQuery export pause 30 min → alert fires → backfill completes → zero data loss verified. Pilot-blocker scenario #5.
3. **Capability contract tests expanded** per Arch Spec §20 item 18. Every UI action across all three surfaces traced to a rule check; CI enforces 100%.
4. **Operator training curriculum.** Muni admin curriculum (verify/dispatch/mass-alert/hazard zones); agency admin curriculum (roster + assistance); responder curriculum (app + telemetry + SOS + handoff); superadmin curriculum (escalation + break-glass review + incident response). Delivered to pilot cohort.
5. **Minimum training milestones.** 5 trained muni admins across pilot munis; 10 trained responders per pilot agency. Training completion logged + verified.
6. **Runbook library** in `docs/runbooks/`: degraded-mode, break-glass, restore drill, incident response, dead-letter replay, PAGASA manual toggle, SMS provider circuit-breaker, surge pre-warm manual trigger.
7. **Quarterly break-glass drill** executed (second drill after Phase 7 initial). Custody chain validated; post-event review procedure tested.
8. **Third-party security review findings resolved.** Consultant's satisfaction per Arch Spec §13.11. Scheduled mid-Phase 10, resolved mid-Phase 11.
9. **Compliance dashboard validated.** Arch Spec §13.9 Compliance Dashboard: audit export gap, privileged reads, cross-muni access, erasure requests, retention exemptions, break-glass activations, open incident response events — all populated with real pilot data.
10. **Post-pilot review template prepared.** Findings rubric; pilot-acceptance-criteria score card; v2 backlog populated with pilot lessons learned.

### Exit Criteria

- Pilot-blocker scenario #29 passes: 72-hour breach drill end-to-end.
- Pilot-blocker scenario #5 passes: audit gap drill.
- 100% of capability contract tests pass in CI across all three surfaces.
- Third-party security review findings all resolved.
- Training completion logged for target operator counts.
- Quarterly break-glass drill completed successfully.

### Dependencies

- Phase 10 complete
- Third-party security consultant engaged and reviewing through Phase 10
- Pilot staff availability for training
- Fake incident scenario prepared for 72-hour drill

### Key Risks

- **Security review uncovers structural issue.** Mitigation: this phase exists to find these. Structural issues escalate to the Decision Log and may require architecture amendment; non-pilot-blocking issues scheduled for v2.
- **Training cohort dropout.** Mitigation: training is staffing-critical for pilot signoff; provincial government owns staffing continuity.
- **Incident-response drill reveals inadequate legal/counsel capacity.** Mitigation: drill includes legal counsel; gaps found are pre-production gaps, fixed before Phase 12 signoff.

---

## Phase 12 — Production Cutover Readiness

**Goal:** 30 continuous days of pilot operation completed without SLO-breaking incident. Provincial government signs production-expansion approval. Platform ready to scale beyond pilot muni.

### Scope

- 30-day continuous-operation measurement window
- All 39 pilot acceptance criteria validated
- Post-pilot review executed
- v1.1 / v2 backlog populated
- Production expansion plan drafted
- Handoff documentation complete

### Deliverables

1. **30-day continuous-operation window complete** per Arch Spec §13.11. Log of any incidents, resolutions, SLO measurements.
2. **Arch Spec §20 all 39 pilot acceptance criteria validated.** Score card showing status of each; all green before signoff.
3. **Post-pilot review session.** PDRRMO Director + pilot muni admins + participating agencies + solo developer. Findings captured.
4. **v1.1 backlog populated.** Short-term items (3-month horizon): Bikol translation, admin mobile companion, hazard analytics expansion.
5. **v2 roadmap drafted.** Province-wide rollout plan, seismic hazard evaluation, risk-scoring formulas if pilot data warrants, Postgres migration triggers check.
6. **Production expansion plan drafted.** Sequencing for 11 remaining munis; per-muni onboarding timeline; MOU status across agencies.
7. **Complete runbook library handoff.** All operational procedures documented; generalist-engineer-executable per Arch Spec §16.
8. **Operational dependence risk documented** per Arch Spec §16. Provincial government acknowledges solo-developer residual risk and owns continuity plan.
9. **Production-expansion signoff.** Governor's Office + PDRRMO Director + provincial council formal approval. This is the graduation-from-pilot gate.

### Exit Criteria

- 30 days of production operation logged, all core SLOs held per Arch Spec §13.2.
- All 39 pilot acceptance criteria verified green.
- Signed production-expansion approval.
- Post-pilot review documented; v1.1 and v2 backlogs published.
- Third-party security review signoff on file.

### Dependencies

- Phase 11 complete
- Provincial government decision-maker availability for signoff
- Statistical significance of 30-day window (i.e., real usage, not just calendar time)

### Key Risks

- **30-day window disrupted by major incident.** Mitigation: clock resets if SLO-breaking incident occurs; root cause addressed; window re-runs. This is the correct behavior.
- **Signoff blocked by political shift.** Mitigation: outside technical team's control; stakeholder-management track owns; pilot remains operational while signoff iterates.
- **Handoff incomplete because solo developer transitions.** Mitigation: runbooks written continuously through all phases; handoff is not a final-phase task.

---

## Appendix A — Cross-Phase Continuous Practices

These don't live in a specific phase but apply throughout.

### A.1 Continuous Integration & Test Coverage

From Phase 1 onward:

- Vitest unit tests on all domain logic, validators, state-machine transitions
- Firebase Emulator rule tests with 100% positive + negative coverage
- Playwright E2E tests on critical workflows
- CI fails on any rule without negative tests
- CI fails on broken type-check or lint

### A.2 Security & Compliance Continuous

From Phase 2 onward:

- Secrets rotation quarterly via Secret Manager
- Access reviews quarterly (who has superadmin? agency admin? dev environment access?)
- DPIA review quarterly with legal counsel
- Vulnerability scanning (Dependabot, npm audit) on all PRs

### A.3 Stakeholder Communication Continuous

Throughout all phases:

- Monthly steering committee with PDRRMO Director + provincial government representative + solo developer
- Weekly dev update posted to a stakeholder-visible channel
- Phase-transition demos scheduled with stakeholders before exit-criteria signoff

### A.4 Documentation Continuous

Every phase updates:

- Runbooks where operational procedures change
- Role specs where capabilities change
- Architecture spec decision log if a decision is reopened
- PRD if scope or goals shift materially

### A.5 Risk Register Review

Monthly review of Arch Spec §16 risks + plan-level risks. New risks added. Mitigations validated.

---

## Appendix B — Phase-to-Arch-Spec Cross-Reference

Quick-lookup table of where in the Architecture Spec each phase's deliverables are specified.

| Phase | Primary Arch Spec Sections                                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | §0 (reading order), §2.3 (monorepo), §13.1 (environments), §13.6 (break-glass ceremony)                                                 |
| 1     | §4 (identity), §5.7 helpers, §6.2 (idempotency), §13 (ops)                                                                              |
| 2     | §5 (data model), §5.7 (rules), §5.8 (RTDB rules), §5.9 (indexes), §13.12 (schema migration)                                             |
| 3     | §5.1 (triptych), §5.3 (report state), §5.4 (dispatch state), §6.1 (write authority), §7.1-7.2 (citizen + responder), §10.3 (cold-start) |
| 4     | §3 (SMS architecture), §6.1 (inbound webhook), §9.2 (offline)                                                                           |
| 5     | §5.6 (agency assistance), §7.3 (muni admin), §7.3.2-7.3.3 (border incidents + command channel), §7.6 (shift handoff)                    |
| 6     | §2.1 (deployment surfaces), §7.2 (responder), §8 (responder location), §9.4 (race-loss)                                                 |
| 7     | §7.5 (superadmin), §7.5.1 (NDRRMC escalation), §12 (audit), §13.5-13.6 (security ops + break-glass)                                     |
| 8     | §10.2-10.3 (PAGASA ingest + surge pre-warm), §10.4 (contention), §13.7 (monitoring)                                                     |
| 9     | §13.4 (rollout/rollback), §13.10 (disaster strategy), §20 (pilot acceptance)                                                            |
| 10    | §22 (entire section)                                                                                                                    |
| 11    | §13.11 (pre-prod checklist), §14 (incident response), §15 (testing)                                                                     |
| 12    | §20 (pilot acceptance), §13.11, §21 (what this spec is not)                                                                             |

---

**End of Implementation Plan v1.0**
