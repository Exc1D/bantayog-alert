# Phase 7 Design — Provincial Superadmin + NDRRMC Escalation + Break-Glass

**Date:** 2026-04-27  
**Status:** Approved  
**Branch:** main (spec only — implementation branch TBD)

---

## Overview

Phase 7 is the security and oversight layer of Bantayog Alert. It adds:

- A streaming + batch audit pipeline to BigQuery for all privileged actions
- TOTP/MFA enforcement on all superadmin-class callables
- The Provincial Superadmin feature set: analytics dashboard, provincial map, user management, data erasure queue, provincial resources CRUD, system health monitoring
- NDRRMC escalation review UI (right-side drawer on the dashboard)
- Emergency declaration with mandatory TOTP re-verify
- Break-glass emergency access with dual-control codes and 4-hour auto-expiry
- Incident response infrastructure (`data_incidents` parent collection + event timeline)
- Retention exemption for legal holds

Phase 7 is the final pilot-blocker phase. It must ship before the Camarines Norte PDRRMO pilot.

---

## Clusters

### PRE-7 — Audit & Auth Foundation

Must complete and pass a 24-hour staging soak before any 7.A work begins.

**Deliverables:**

1. **`functions/src/services/audit-stream.ts`** — singleton BigQuery Storage Write API client. Exports `streamAuditEvent(event: AuditStreamEvent): Promise<void>`. Never throws — wraps all errors internally and logs a warning. `AuditStreamEvent` TypeScript type is defined in this file only (not exported to shared-validators, as only functions write audit events). Pattern mirrors `fcm-send.ts` (fire-and-forget with internal error swallowing).

2. **`functions/src/triggers/audit-export-batch.ts`** — scheduled Cloud Function every 5 minutes. Reads Cloud Logging entries from the last window and appends to the BigQuery batch dataset. This covers general activity that does not require the < 60s streaming SLA.

3. **`functions/src/triggers/audit-export-health-check.ts`** — scheduled Cloud Function every 10 minutes. Compares the timestamp of the last successful streaming write and last successful batch export against SLO thresholds. Overwrites a single `system_health/latest` document with current gap metrics. Alerts (via admin notification) if streaming gap > 60 seconds or batch gap > 15 minutes.

4. **TOTP enrollment page (client-side flow)** — TOTP enrollment is driven entirely by the Firebase **client** SDK. The Admin SDK has no user-level TOTP enrollment API. The bare-minimum `/totp-enroll` page in admin-desktop implements:
   1. `multiFactor(auth.currentUser).getSession()` → get enrollment session
   2. `TotpMultiFactorGenerator.generateSecret(session)` → returns `TotpSecret` with `secretKey` and `generateQrCodeUrl()`
   3. Display QR code rendered from `otpauth://` URI + raw secret key
   4. User enters code to verify → `TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, code)`
   5. `multiFactor(auth.currentUser).enroll(assertion, 'Authenticator')`
      No callable needed for enrollment — there is no server role in this flow.

5. **`requireMfaAuth()` backend enforcement** — added to `functions/src/callables/https-error.ts`. Checks `request.auth.token.firebase.sign_in_second_factor` — NOT a custom claim. Implementation:

   ```typescript
   export function requireMfaAuth(request: {
     auth?: { uid: string; token: Record<string, unknown> } | null
   }): void {
     const firebase = request.auth?.token?.firebase as Record<string, unknown> | undefined
     if (typeof firebase?.sign_in_second_factor !== 'string') {
       throw new HttpsError('unauthenticated', 'mfa_required')
     }
   }
   ```

   Applied to all privileged callables: `initiateBreakGlass`, `declareEmergency`, `setRetentionExempt`, `declareDataIncident`, `approveErasureRequest`.

   **Implementation note:** The `request.auth.token.firebase.sign_in_second_factor` field path must be verified with a decoded TOTP-auth JWT before shipping. Add a test in 7.C that calls `requireMfaAuth` with a token captured from a TOTP-authenticated emulator session and confirms it passes; call it with a password-only token and confirm it throws `mfa_required`.

6. **Bare-minimum TOTP enrollment page** — functional but unstyled `/totp-enroll` route in admin-desktop. Shows TOTP secret as plaintext URI, code verification input, success redirect. Polished version ships in 7.B.

7. **Privileged-read streaming audit** — `report_private` and `report_contacts` reads during break-glass sessions emit `streamAuditEvent()` calls. This is the only collection where reads are audited (writes are already covered by Firestore triggers).

8. **Schema additions:**

   a. `dataIncidentDocSchema` added to `packages/shared-validators/src/incident-response.ts` (alongside the existing `incidentResponseEventSchema` which already has `incidentId` FK).

   b. `breakglassEventDocSchema` in `coordination.ts` extended with `expiresAt: z.number().int()` and `sessionStartedAt: z.number().int()` fields (needed by the expiry sweep to determine active sessions without reading custom claims).

   c. `agencyDocSchema` in `agencies.ts` extended with `mutualAidVisible: z.boolean().optional()` (needed by `toggleMutualAidVisibility` callable — schema is `.strict()` so any undocumented write would be rejected by validators).

   d. `analyticsSnapshotWriter` extended to compute and write `avgResponseTimeMinutes` and `resolvedToday` to province-level summary docs (needed by Province Dashboard live metrics that cannot be derived from existing snapshot fields).

   **Required dependencies:** Add `@google-cloud/bigquery-storage` to `functions/package.json` for the BigQuery Storage Write API. BigQuery dataset: `bantayog_audit`. Tables: `streaming_events` (streaming pipeline), `batch_events` (batch pipeline). Table schemas must be created in infra before PRE-7 functions are deployed.

   `dataIncidentDocSchema` shape:

   ```
   incidentType: enum ['unauthorized_access','data_loss','data_corruption','system_breach','accidental_disclosure']
   severity: enum ['critical','high','medium','low']
   affectedCollections: string[]
   affectedDataClasses: string[]
   estimatedAffectedSubjects: number (int, optional)
   summary: string (max 2000)
   status: enum ['declared','contained','preserved','assessed','notified_npc',
                  'notified_subjects','post_report','closed']
   declaredAt: number (int, unix ms)
   declaredBy: string (uid)
   closedAt: number (int, optional)
   retentionExempt: boolean
   schemaVersion: number (int, positive)
   ```

**Exit criteria:** Streaming gap < 60s over 24h staging soak. Batch gap < 15min. TOTP enrollment works for a test staff account. `requireMfaAuth()` rejects unenrolled users with `unauthenticated: mfa_required`.

---

### 7.A — Security Callables

Depend on PRE-7 exit criteria passing.

**Deliverables:**

1. **`initiateBreakGlass`** — callable at `functions/src/callables/break-glass.ts`.
   - Requires `requireAuth` + `requireMfaAuth` + role check (`superadmin`)
   - Input: `{ codeA: string, codeB: string, reason: string }`
   - Validates both codes against `system_config/break_glass_config.hashedCodes[]` (bcrypt compare — codes belong to different controllers, order-independent)
   - Sets custom claim `breakGlassSession: true` + `breakGlassSessionId: uuid` + `breakGlassExpiresAt: now + 4h` via Admin SDK `setCustomUserClaims`
   - Writes `breakglass_events/{sessionId}` doc with `expiresAt: now + 4h`, `sessionStartedAt: now`, `action: 'initiated'`
   - Calls `streamAuditEvent()` — never blocks
   - **No Cloud Tasks.** Auto-expiry is handled by a scheduled sweep (see Deliverable 2).
   - **Client must call `auth.currentUser.getIdToken(true)` after this callable returns** before transitioning the UI to session-active state — custom claims do not take effect until the token is force-refreshed.

2. **`deactivateBreakGlass`** — `onCall` callable for manual deactivation.
   - Clears `breakGlassSession`, `breakGlassSessionId`, `breakGlassExpiresAt` custom claims
   - Updates `breakglass_events/{sessionId}` with `action: 'deactivated'`, `deactivatedAt: now`
   - Calls `streamAuditEvent()`

3. **`sweepExpiredBreakGlassSessions`** — scheduled Cloud Function, every 5 minutes.
   - Queries `breakglass_events` where `action == 'initiated'` and `expiresAt < now`
   - For each expired session: calls Admin SDK `setCustomUserClaims` to clear break-glass claims, updates event doc with `action: 'auto_expired'`, calls `streamAuditEvent()`
   - This replaces Cloud Tasks for auto-expiry. No new dependencies required.
   - Added to the new-files list in the "Files to Create" section.

4. **`declareEmergency`** — callable at `functions/src/callables/declare-emergency.ts`.
   - Requires `requireAuth` + `requireMfaAuth` + `superadmin` role
   - Input: `{ hazardType: string, affectedMunicipalityIds: string[], message: string }`
   - Reuses `sendMassAlertFcm` (from Phase 5) for FCM batch fan-out to all active staff
   - Reuses `enqueueBroadcastSms` (from Phase 5) for SMS fan-out to subscribed citizens in affected municipalities
   - Writes `alerts/{id}` with `alertType: 'emergency'`
   - Calls `streamAuditEvent()`

5. **`setRetentionExempt`** — callable at `functions/src/callables/set-retention-exempt.ts`.
   - Requires `requireAuth` + `requireMfaAuth` + `superadmin` role
   - Input: `{ collection: string, documentId: string, exempt: boolean, reason: string }`
   - Collection allowlist: `['reports', 'report_private', 'report_ops', 'sms_inbox']`
   - Writes `retentionExempt: true/false` + `retentionExemptReason` to the target document
   - Calls `streamAuditEvent()`

6. **`declareDataIncident`** — callable at `functions/src/callables/declare-data-incident.ts`.
   - Requires `requireAuth` + `requireMfaAuth` + `superadmin` role
   - Firestore transaction: atomically writes `data_incidents/{incidentId}` doc + first `incident_response_events/{eventId}` with `phase: 'declared'`
   - `incidentId` is server-generated UUID
   - Calls `streamAuditEvent()`

7. **`recordIncidentResponseEvent`** — callable at `functions/src/callables/record-incident-response-event.ts`.
   - Requires `requireAuth` + `superadmin` or `pdrrmo` role
   - Validates forward-only phase transitions (declared → contained → preserved → assessed → … → closed)
   - Transaction: appends new event, updates parent `data_incidents/{id}.status`
   - Calls `streamAuditEvent()`

8. **Provincial resources CRUD** — three callables in `functions/src/callables/provincial-resources.ts`:
   - `upsertProvincialResource({ id?: string, name, type, quantity, unit, location, available })`
   - `archiveProvincialResource({ id })`
   - `listProvincialResources` (optional — UI may read directly)
   - Collection: `provincial_resources/{id}`

9. **`toggleMutualAidVisibility`** — callable. Sets `mutualAidVisible: boolean` on an agency document. Controls whether the agency's responders appear in cross-municipality dispatch pools.

10. **`approveErasureRequest`** — callable. RA 10173 (Data Privacy Act) compliance. Input: `{ requestId: string, approved: boolean, reason: string }`. Writes decision to `erasure_requests/{id}` with `status: 'approved_pending_anonymization'` (approved) or `status: 'denied'` (rejected). **Phase 7 ships the request/approval workflow only** — the anonymization pipeline that actually removes/pseudonymizes PII is Phase 8. The `approved_pending_anonymization` status makes the gap explicit and prevents false compliance confidence. Calls `streamAuditEvent()`.

**Exit criteria:** All callables callable from emulator. Every action writes to streaming audit. Break-glass 4h auto-expiry tested (sweep fires, claims cleared). `requireMfaAuth()` gate verified on all privileged callables. Token-refresh step confirmed before session-active state displays.

---

### 7.B — Superadmin UI

Depends on 7.A exit criteria.

**Pages and components in `apps/admin-desktop`:**

1. **Province Analytics Dashboard** — landing page for superadmin, route `/province/dashboard`.
   - 6-column province-wide metrics row with explicit data sources:
     - **Active Reports** — live `onSnapshot` on `reports` where `status in ['submitted','verified','assigned']`, province-wide
     - **Responders Available** — live `onSnapshot` on `responders` where `availabilityStatus == 'available'`
     - **Avg Response Time** — `analytics_snapshots/{today}/province/summary.avgResponseTimeMinutes` (extended field, see PRE-7 schema additions 8d)
     - **Resolved Today** — `analytics_snapshots/{today}/province/summary.resolvedToday` (extended field, see PRE-7 schema additions 8d)
     - **Muni Issues (n/12)** — computed client-side: count of municipalities with `avgResponseTimeMinutes > 15` or `adminStatus == 'no_shift'` from the municipal performance table query
     - **System Health** — `system_health/latest` doc (written by `auditExportHealthCheck`)
   - Anomaly detection alert card: auto-surfaces municipalities with response time > 15 min threshold or no active admin shift
   - Municipal performance table (sortable, clickable rows → drill-down panel): columns — Municipality, Active, Resp. Time, Resolved%, Resources, Admin Status. Data source: `analytics_snapshots/{today}/{municipalityId}/summary` per municipality.
   - NDRRMC queue widget (compact): shows pending count + oldest 2 items, "Open drawer" button
   - Quick actions column: Declare Data Incident, Manage Resources, System Health, Dead-Letter Replay
   - Trend analysis charts (2 — 7-day historical only): incident volume and response time — `analytics_snapshots/{date}/province/summary` for last 7 dates. These are daily snapshots, not live data.
   - No inline map — map is Screen 2

2. **NDRRMC escalation drawer** — right-side drawer on Province Dashboard (no navigation away).
   - Forward flow: opens after "Open drawer" click; shows pending `massAlertRequests` in `pending_ndrrmc_review` status
   - Per-item: hazard type, linked reports count, evidence text, barangay targets
   - Forward method selector uses the existing `forwardMassAlertToNDRRMC` callable's enum `['email', 'sms', 'portal']` — not "Phone/Formal Letter." Display labels: "Email", "SMS/Text", "Portal Submission." Changing the enum is out of scope for Phase 7.
   - After forwarding: receipt/reference# acknowledgment input field
   - Reject: requires reason
   - Bottom disclaimer: "Escalation submitted to NDRRMC" ≠ "ECBS alert sent"
   - Calls existing `forwardMassAlertToNDRRMC` callable (Phase 5)

3. **Emergency Declaration modal** — triggered by "⚡ Declare Emergency" button in top nav.
   - Step 1: hazard type selector, affected municipalities multi-select, broadcast message textarea
   - Step 2: TOTP re-verify (always required regardless of session state — not bypassable)
   - Final: FCM + SMS fan-out triggered via `declareEmergency` callable
   - Impact note: "Broadcasts FCM to all active staff · SMS to subscribed citizens in affected areas"

4. **Break-Glass Activation page** — dedicated route `/province/break-glass` (not a modal, not buried in dashboard).
   - Warning banner: "All actions audit-streamed · Dual-control required · 4h auto-expiry"
   - Controller A code input (initiating superadmin)
   - Controller B code input (second authorized person)
   - Reason field (required)
   - TOTP verification input
   - Activate button
   - Session-active state: red banner showing session ID, time remaining, Deactivate button
   - Linked from sidebar under PROVINCE section (red, separated by divider)

5. **Provincial Map page** — route `/province/map`. Full-screen Leaflet. Responder markers from `shared_projection`. Incident pins from `reports` collection. Sidebar filter panel (hazard type, time window, municipality). Read-only.

6. **User Management page** — route `/province/users`. Province-wide user table: name, role, municipality, MFA status, last login. Actions: Suspend, Revoke, Reset TOTP. Role assignment for new superadmins. Data erasure queue as a right-side drawer: lists pending `erasure_requests`, Approve/Deny with logged reason, calls `approveErasureRequest` callable.

7. **Provincial Resources page** — route `/province/resources`. CRUD table for `provincial_resources`. Add/Edit/Archive via `upsertProvincialResource` and `archiveProvincialResource` callables.

8. **System Health panel** — route `/province/system-health`. Reads `system_health` doc, auto-refreshes every 30s. Shows: streaming audit gap, batch audit gap, Functions error rate, Firestore read latency. Dead-letter replay button.

9. **Polished TOTP enrollment page** — replaces the bare-bones PRE-7 page at `/totp-enroll`. Adds: QR code generated from `otpauth://` URI, raw secret key display, 8 one-time recovery codes with download button, 3-step guided flow (scan → verify → confirm recovery codes), branding.

10. **Superadmin nav extension** — PROVINCE section in sidebar (purple accent): Dashboard, Province Map, NDRRMC, Users, Resources, Incidents, System Health. Break-Glass separated at bottom with divider (red text). Existing OPERATIONS section unchanged.

**Exit criteria:** Province Analytics Dashboard loads live province-wide data. NDRRMC drawer shows pending requests and forward flow works. Break-glass activation UI drives callable and claim is set. Emergency declaration requires TOTP re-verify.

---

### 7.C — Drill & Verification

**Pilot-blocker scenarios (all must pass in staging):**

1. **Break-glass drill** — two controllers enter dual codes → `initiateBreakGlass` callable returns → client calls `getIdToken(true)` → session-active state appears with correct session ID → privileged reads during session audited in BigQuery → 5-minute sweep (`sweepExpiredBreakGlassSessions`) fires and clears claims (simulated by setting `expiresAt` to past) → audit trail shows initiation + auto-expiry events. Manual `deactivateBreakGlass` path also verified.

2. **NDRRMC escalation tabletop** — seed test `massAlertRequest` in `pending_ndrrmc_review` → superadmin opens drawer → selects forward method (`email`/`sms`/`portal`) → `forwardMassAlertToNDRRMC` called → status transitions to `forwarded_to_ndrrmc` → receipt logged → audit event written.

3. **`declareEmergency` fan-out test** — callable invoked against test account set → FCM batch delivery confirmed for all active-staff tokens → SMS enqueued for subscribed citizens in affected municipalities → `alerts/{id}` doc written with `alertType: 'emergency'`.

4. **Streaming audit gap test** — BigQuery write endpoint paused → `auditExportHealthCheck` fires → `system_health` doc shows `streamingGapSeconds > 60` → alert visible on System Health page → endpoint restored → gap resets < 60s within one check cycle.

5. **MFA adoption** — 100% of staff test accounts enrolled in TOTP. `requireMfaAuth()` rejects unenrolled users with `unauthenticated: mfa_required` on all privileged callables.

**Lint/typecheck gate:** `npx turbo run lint typecheck` passes on all packages.

**Exit criteria:**

- All 5 pilot-blocker scenarios pass in staging
- Streaming gap < 60s sustained over 24h staging soak
- Batch gap < 15min sustained over 24h staging soak
- 100% TOTP enrollment on staff test accounts

---

## Key Architectural Decisions

### Audit pipeline split

Streaming (< 60s SLA) covers: break-glass initiation/deactivation, emergency declarations, retention exemptions, data incident declarations, erasure approvals, and privileged reads of `report_private`/`report_contacts` during break-glass sessions. Everything else goes through the 5-min batch pipeline (Cloud Logging → BigQuery). This avoids paying streaming costs for routine activity while maintaining real-time visibility on high-risk actions.

### `streamAuditEvent()` never blocks

Same pattern as `fcm-send.ts` and `rate-limit.ts`. Wraps BigQuery write in try/catch, logs a warning on failure, returns immediately. Security events are best-effort at the write layer — the batch pipeline provides the backstop. A broken streaming pipe must not take down operational callables.

### MFA via `sign_in_second_factor`, not custom claims

Firebase MFA status is in `request.auth.token.firebase.sign_in_second_factor` (a string like `"totp"` when enrolled and used). It is NOT a custom claim and cannot be spoofed by the client. Using custom claims for MFA status would be a security regression.

### Break-glass dual-control

Both codes are validated server-side against `system_config/break_glass_config.hashedCodes[]`. Codes belong to different physical people (Controller A = initiating superadmin, Controller B = second authorized person). The system cannot verify physical separation — this is a procedural control enforced by policy, not code. The audit trail provides accountability.

### `data_incidents` parent collection + `incident_response_events` flat collection

`incident_response_events` is a **top-level flat collection** (not a sub-collection of `data_incidents`). The existing `incidentResponseEventSchema` already has `incidentId: z.string().min(1)` as the FK — this is intentional. The existing Firestore rule at the top-level `incident_response_events` path already grants read to `isSuperadmin() && isActivePrivileged()`. Only the write path needs to be added (Admin SDK callables bypass client rules, but a rule document is cleaner than an implicit bypass). The "parent doc + sub-collection" framing in earlier brainstorming was a mistake — the flat shape is already committed.

### Break-glass auto-expiry via scheduled sweep, not Cloud Tasks

Cloud Tasks `onTaskDispatched` and `onCall` are incompatible function types — they cannot share a single export. Rather than add `@google-cloud/tasks` as a dependency and manage queue configuration, the 4h session expiry uses a scheduled sweep (`sweepExpiredBreakGlassSessions`) that runs every 5 minutes. This is simpler, has no new infra dependencies, and the 5-minute sweep resolution is acceptable for a 4h session.

### TOTP enrollment is client-side only

The Firebase Admin SDK has no user-level TOTP enrollment API. TOTP enrollment uses only the Firebase client SDK (`TotpMultiFactorGenerator`). The server's role is only `requireMfaAuth()` enforcement — checking `sign_in_second_factor` in the decoded JWT.

### Token refresh after break-glass activation

`setCustomUserClaims` updates take effect only after a token refresh. The break-glass UI must call `auth.currentUser.getIdToken(true)` after `initiateBreakGlass` returns before showing the session-active state. Same pattern as the existing `awaitFreshAuthToken` in the responder app.

### Data erasure: Phase 7 = approval workflow, Phase 8 = anonymization

`approveErasureRequest` in Phase 7 records the human approval decision with status `approved_pending_anonymization`. This is explicit about the gap — operators know the data has not yet been removed. Actual PII anonymization is Phase 8 scope. RA 10173 compliance for Phase 7 means having an audited approval trail, not automated deletion.

### `system_config/break_glass_config` bootstrap required

The hashed codes document must be seeded before any break-glass drill. A one-time admin script (`scripts/seed-break-glass-config.ts`) must be added in PRE-7. It generates two random codes, bcrypt-hashes them (cost factor 12), writes to `system_config/break_glass_config.hashedCodes[]`, and prints the plaintext codes for secure distribution to Controller A and Controller B. The script must be idempotent (no-op if codes already exist).

### NDRRMC forward does not mean ECBS alert

The `forwardMassAlertToNDRRMC` callable (Phase 5) submits the escalation to NDRRMC's review process. It does not trigger the ECBS (Emergency Cell Broadcast System). The drawer must always display the disclaimer to prevent operational confusion.

### Emergency declaration always re-verifies TOTP

The `declareEmergency` callable calls `requireMfaAuth()`. Additionally, the UI prompts a TOTP code re-entry at step 2 of the modal — even if the user is within an active MFA session. The extra UI check prevents accidental declarations from fat-finger clicks on the nav button. The callable enforcement is the security gate; the UI re-verify is the UX friction guard.

### Province Analytics Dashboard is analytics-first

Per role spec §2.2: the superadmin landing page is not a command dashboard — it is a data-driven analytics view. The 6-column metrics row, municipal performance table, and anomaly detection alerts are the primary content. The Leaflet map is Screen 2 (a dedicated `/province/map` route reachable from the sidebar), not an inline widget. This matches how PDRRMO operators actually review provincial status.

---

## Files to Create / Modify

### New files (functions)

- `functions/src/services/audit-stream.ts`
- `functions/src/triggers/audit-export-batch.ts`
- `functions/src/triggers/audit-export-health-check.ts`
- `functions/src/triggers/sweep-expired-break-glass-sessions.ts`
- `functions/src/callables/break-glass.ts`
- `functions/src/callables/declare-emergency.ts`
- `functions/src/callables/declare-data-incident.ts`
- `functions/src/callables/record-incident-response-event.ts`
- `functions/src/callables/set-retention-exempt.ts`
- `functions/src/callables/provincial-resources.ts`
- `functions/src/callables/toggle-mutual-aid-visibility.ts`
- `functions/src/callables/approve-erasure-request.ts`

### Modified files (functions)

- `functions/src/callables/https-error.ts` — add `requireMfaAuth()`
- `functions/src/index.ts` — export all new callables + scheduled functions

### New/modified files (shared-validators)

- `packages/shared-validators/src/incident-response.ts` — add `dataIncidentDocSchema`
- `packages/shared-validators/src/index.ts` — re-export new schema

### New files (admin-desktop)

- `apps/admin-desktop/src/pages/ProvinceDashboardPage.tsx`
- `apps/admin-desktop/src/pages/ProvinceMapPage.tsx`
- `apps/admin-desktop/src/pages/UserManagementPage.tsx`
- `apps/admin-desktop/src/pages/ProvincialResourcesPage.tsx`
- `apps/admin-desktop/src/pages/SystemHealthPage.tsx`
- `apps/admin-desktop/src/pages/BreakGlassPage.tsx`
- `apps/admin-desktop/src/pages/TotpEnrollmentPage.tsx` (PRE-7 bare-bones, polished in 7.B)
- `apps/admin-desktop/src/components/NdrrrmcDrawer.tsx`
- `apps/admin-desktop/src/components/EmergencyDeclarationModal.tsx`
- `apps/admin-desktop/src/components/MunicipalPerformanceTable.tsx`
- `apps/admin-desktop/src/hooks/useProvinceMetrics.ts`
- `apps/admin-desktop/src/hooks/useMunicipalPerformance.ts`
- `apps/admin-desktop/src/hooks/useBreakGlass.ts`
- `apps/admin-desktop/src/hooks/useSystemHealth.ts`

### Modified files (admin-desktop)

- `apps/admin-desktop/src/routes.tsx` — add all new `/province/*` routes
- `apps/admin-desktop/src/components/Sidebar.tsx` — add PROVINCE nav section
- `apps/admin-desktop/src/services/callables.ts` — add callable wrappers

### Infrastructure

- `infra/firebase/firestore.rules` (via template) — add rules for `data_incidents`, `incident_response_events`, `provincial_resources`, `erasure_requests`, `system_health`

---

### New files (scripts)

- `scripts/seed-break-glass-config.ts` — one-time bootstrap for `system_config/break_glass_config.hashedCodes[]`

---

## Implementation Plan Gate

**The writing-plans output must treat PRE-7 as a separate branch with a staging deployment gate.** 7.A tasks must not start until the PRE-7 branch is merged, deployed to staging, and has completed the 24-hour soak. The plan must make this an explicit dependency node — a flat task list with PRE-7 and 7.A tasks intermixed would silently violate the exit criteria.

---

## Out of Scope for Phase 7

- ECBS (Emergency Cell Broadcast System) integration — requires separate government API agreement
- Automated NPC notification for data incidents — manual process per RA 10173 workflow
- Province-to-province mutual aid (beyond `toggleMutualAidVisibility` flag)
- NDRRMC formal letter PDF generation — letter content is human-authored
- BigQuery dashboard / Looker Studio setup — ops team tooling, not part of this system
