# Bantayog Alert — Software Architecture Specification

**Version:** 7.0  
**Date:** 2026-04-16  
**Status:** Pilot-Ready — Production Hardening Required Before Emergency-Service Dependence  
**Stack:** React 18 + Vite + Firebase + Leaflet + Zustand + TanStack Query + Capacitor + Semaphore/Globe Labs (SMS)

---

## 1. Context & Driving Forces

### 1.1 What This System Is

Bantayog Alert is a crowd-sourced disaster reporting and real-time coordination platform for the Province of Camarines Norte, Philippines (12 municipalities, ~600,000 population). Citizens report emergencies; municipal administrators triage and dispatch responders; specialized agencies coordinate tactical response with their own rosters; the provincial PDRRMO maintains province-wide situational awareness and holds the only escalation channel to NDRRMC.

### 1.2 Constraints That Shape Architecture

- **Connectivity is unreliable and often absent for extended periods.** Citizen report capture may begin offline, but server acceptance is not guaranteed until connectivity returns and backend ingestion completes. The UI must distinguish `draft`, `queued`, `submitting`, `server_confirmed`, `failed_retryable`, and `failed_terminal`.
- **Time pressure is extreme.** During typhoon surge conditions, municipal admins may process sustained high-volume queues. Workflows must support bulk triage, duplicate clustering, stale-item detection, and degraded-mode operation.
- **Jurisdiction boundaries are legal and operational.** Cross-municipality data access must be either explicitly shared (logged, reviewable) or refused at the data layer. Mandated by RA 10173 (Data Privacy Act).
- **Users operate under stress with uneven literacy.** UX must support partial completion, reconnect recovery, permission recovery, low-battery operation, and clear failure states.
- **Mobile OS behavior is a first-class architecture constraint.** Background location, notification delivery, battery policy, and app suspension on iOS and Android are unreliable and must be observable, not assumed.
- **A non-trivial portion of the population does not have smartphones.** Reporting and alerting must be reachable via feature phones over SMS. This is not a "nice-to-have" — it is the difference between reaching 80% and 100% of the province during an emergency.
- **National emergency alerting is NDRRMC's legal mandate, not ours.** Under RA 10639 (Free Mobile Disaster Alerts Act, 2014), NDRRMC operates the Emergency Cell Broadcast System (ECBS) that sends location-specific disaster alerts for free via cell broadcast (point-to-multiple-point, near-instant, bypasses congestion). Bantayog Alert is a **provincial operational coordination platform**, not a replacement for ECBS. Our SMS outbound layer handles targeted operational messaging (status updates to reporters, barangay-level advisories, responder coordination) — **not** province-wide mass evacuation alerts, which must be escalated to NDRRMC/PAGASA. Attempting to duplicate ECBS would be legally awkward, technically inferior (SMS point-to-point versus cell broadcast), and a turf conflict with a national agency whose buy-in the project benefits from.

### 1.3 Architectural Principles

1. **Design for the worst network, not the best.**
2. **Enforce authorization at the data layer.** Every security rule references fields that exist on the document it guards or uses bounded `get()` only where denormalization would be worse. No client-side filtering as a trust boundary.
3. **Honest write-authority model.** Mixed-mode writes. Server-authoritative for high-stakes mutations and any mutation involving multi-document invariants or contention. Scoped direct writes only for self-service, single-actor, sequential transitions.
4. **Optimize for the surge, not the steady state.**
5. **Test seams, not portable abstractions.** Repository classes exist for testability, not backend portability.
6. **Idempotency everywhere.** Every write path, every triggered side effect, every offline replay must be safe to execute twice.
7. **Be explicit about uncertainty.** The system must distinguish confirmed server state from local/offline/pending state in all critical workflows.
8. **Design for operational reversibility.** Deployments, sync flows, and administrative actions must support rollback, replay, and forensic reconstruction.
9. **No single channel is trusted for life-safety; know which channel is whose job.** Critical operational messages fan out across FCM, in-app display, and SMS. Province-wide mass alerts are NDRRMC's job via ECBS — the system escalates rather than duplicates.
10. **State has exactly one authority per category.** The client must not have multiple sources of truth for the same data. Each data class is assigned to one store (§9).
11. **Role capability is defined by data-class reach, not by UI.** If a role sees or writes a data class, that appears in the Access Model (§15) and a security rule enforces it. UI affordances that aren't backed by a rule don't exist.
12. **Three deployment surfaces, one backend.** Citizen PWA, Responder Capacitor app, and Admin Desktop PWA are distinct deployables with distinct state-ownership profiles. They share the same Firestore, rules, functions, and audit plane.
13. **Attribution over anonymity for staff actions.** Every privileged action carries `actorId`, `actorRole`, and where applicable `actorMunicipalityId` / `actorAgencyId`. Admin identity is hidden from citizens and the public feed at the presentation layer only, not at the audit layer.

---

## 2. System Overview

### 2.1 Deployment Surfaces

There are three distinct deployables. Each has its own bundle, its own state-ownership profile, its own offline strategy, and its own auth friction level. They share one Firebase project per environment.

| Surface | Audience | Platform | Offline Strategy | Auth |
|---|---|---|---|---|
| Citizen PWA | Citizens | React PWA (iOS Safari, Android Chrome) | localForage + Firestore SDK dual-write; SMS fallback for submission | Pseudonymous (auto) or phone-OTP registered |
| Responder App | Responders | Capacitor-wrapped React | Firestore SDK cache; Capacitor plugins for background location, foreground service, motion activity | Managed staff + MFA (TOTP mandatory) |
| Admin Desktop | Municipal / Agency / Superadmin | React PWA (desktop-first, dual-monitor for superadmin) | Firestore SDK cache only — admins require connectivity for all mutations | Managed staff + MFA + TOTP |

**Why PWA-only is acceptable for citizens (with SMS fallback):** The Firestore SDK's IndexedDB-backed offline persistence durably queues writes across app restarts on Android. iOS PWAs have known service-worker eviction risk under storage pressure. Rather than force Capacitor on every citizen, we accept PWA limitations and provide SMS as the universal fallback channel. Every outbound-critical alert fans out on both FCM and SMS.

**Why Capacitor for responders:** PWA is insufficient for responder workflows because iOS and Android both impose background execution and notification constraints. A Capacitor wrapper allows native background-location APIs, richer notification handling, foreground services on Android, and improved device observability. It reduces — but does not eliminate — mobile OS constraints.

**Why Admin Desktop has no offline write queue:** Admin writes are high-stakes multi-document operations (dispatch, verify, mass-alert). An admin silently queuing a `sendMassAlert` for replay 2 hours later is a worse failure mode than forcing them to wait for connectivity. If connectivity is lost, all mutation UI is blocked with a "reconnect to continue" banner. Exception: field notes and in-app messages use an explicit "field mode" opt-in when an admin is on a tablet in the field — this is a deliberate mode switch, not a silent fallback.

**Citizen PWA — surface detail:**
- URL: `bantayog.daet.gov.ph` (or equivalent provincial domain). No app store. Installable as PWA on iOS and Android; also accessible as a regular website.
- Target devices: Chrome 90+ (Android), Safari 14+ (iOS). Also usable on desktop browser for citizens at a computer.
- Performance budget: First Contentful Paint < 2s on 3G. Bundle < 500KB gzipped on initial route; map tiles and Leaflet lazy-loaded.

**Responder App — surface detail:**
- Distributed as a signed APK (Android sideload or managed MDM) and a TestFlight-then-App-Store iOS build. Loaded onto responder-issued devices by Agency Admins during onboarding.
- Target devices: Android 10+ (API 29+) for foreground service support; iOS 15+ for background location entitlement and CMMotionActivityManager.
- Performance budget: App cold start < 3s on mid-range Android (Cherry Mobile / Vivo entry tier common in PH). Background battery < 15% per 12-hour shift at typical motion mix (measured in pilot). Dispatch-received to notification-visible < 5s p95.

**Admin Desktop — surface detail:**
- URL: `admin.bantayog.daet.gov.ph`. Optimized for 1920×1080 monitors; dual-monitor capable for superadmin workstations.
- Target devices: Desktop Chrome/Edge 100+. Tablet-responsive down to 1024px for mobile command post scenarios. Phone-sized viewport renders a "please use a desktop" gate with a link to the Citizen PWA for anyone who hits it by accident.
- Performance budget: Admin dashboard p95 load time < 5s under normal conditions (§19 migration trigger if this degrades). Queue triage mode: 47 pending reports must render and be interactable within 2s on first load. Map with 50 incident pins + 30 live responder markers must maintain 30fps pan/zoom.

### 2.2 Technology Stack

| Layer | Technology | Why |
|---|---|---|
| UI Framework | React 18 | Concurrent rendering for real-time updates |
| Build Tool | Vite | Fast builds, optimized code splitting |
| State (UI ephemeral) | Zustand | Lightweight; UI-only, no server data |
| State (server cache) | Firestore SDK local persistence | **Single authoritative server cache** |
| State (query orchestration) | TanStack Query | Non-Firestore HTTP calls, callables, derived views |
| State (outbound queue + drafts) | localForage | Dual-write with Firestore SDK for draft durability (Citizen PWA only) |
| Maps | Leaflet + OpenStreetMap | Open source, free, offline tile caching |
| Database (structured) | Firestore | Real-time listeners, offline persistence, security rules |
| Database (GPS) | Firebase Realtime Database | Bandwidth-priced for high-frequency location |
| Auth | Firebase Auth | Custom claims, anonymous (pseudonymous) auth, MFA |
| Client integrity | Firebase App Check | Reduces abuse from non-genuine clients |
| Storage | Cloud Storage for Firebase | Resumable photo/video uploads |
| Functions | Cloud Functions v2 (Node.js 20) | Server-authoritative writes, triggers, scheduled jobs |
| Long-window async | Cloud Tasks | Multi-day retry windows for downstream API calls during outages |
| Push | Firebase Cloud Messaging | Dispatch notifications, SOS, in-app mass alerts |
| SMS outbound | Semaphore API (primary) + Globe Labs (failover) | Domestic aggregators; better rates, telco compliance, last-mile reliability vs Twilio |
| SMS inbound | Globe Labs keyword routing → Cloud Function webhook | Citizens on feature phones; zero-data emergency reports |
| Responder native | Capacitor + `@capacitor-community/background-geolocation` + Motion Activity plugin | Background GPS, foreground services, hardware motion detection |
| Audit export | Cloud Logging → BigQuery (5-min batch + streaming for security events) | Durable, separately governed audit trail with low-latency security path |
| IaC | Terraform for GCP/IAM/BigQuery; Firebase CLI for rules/functions/indexes | Named, reproducible infrastructure recovery |

**Selection boundaries.** App Check is an abuse-reduction control, not a trust boundary. TanStack Query is a cache and orchestration layer for non-Firestore calls, not a consistency layer. Firestore SDK cache is the authoritative client-side view of server state — never TanStack Query or Zustand. Capacitor improves access to native capabilities but does not guarantee background execution. BigQuery audit export improves durability but does not remove the need for retention-policy control, privileged-access monitoring, and export health checks. Custom claims are a performance optimization for authorization; they are not a revocation channel. **SMS is a delivery attempt, not a delivery guarantee** — telcos may queue messages during congestion and drop after TTL.

### 2.3 Monorepo Structure

```
bantayog-alert/
├── apps/
│   ├── citizen/          # PWA, anonymous-first
│   ├── responder/        # Capacitor wrapper
│   └── admin/            # Desktop PWA (all three admin roles)
├── packages/
│   ├── shared-types/     # TypeScript: Report, Dispatch, User, Alert, etc.
│   ├── shared-validators/# Zod schemas used client-side AND by Cloud Functions
│   ├── shared-ui/        # Primitive components (Button, Modal, MapPin)
│   ├── shared-firebase/  # Firestore converters, auth helpers, idempotency key generation
│   └── shared-sms-parser/# SMS inbound parser (shared between CF and test harness)
├── functions/            # Cloud Functions (Node.js 20)
├── infra/
│   ├── terraform/        # GCP/IAM/BigQuery
│   └── firebase/         # rules, indexes, CLI config
└── docs/                 # This spec and related design docs
```

One Firebase project per environment (`bantayog-dev`, `bantayog-staging`, `bantayog-prod`). All three apps deploy to the same project and share security rules, Firestore, RTDB, Storage, Auth, and FCM. Three Firebase Hosting sites per environment: citizen app, admin desktop, and the responder app ships as APK/IPA.

---

## 3. SMS Architecture

SMS serves **four distinct purposes**, each with different reliability requirements and authority boundaries:

1. **Targeted citizen status updates** (outbound, one-to-one). *"Your report has been received, reference 2026-DAET-0471. Responders dispatched."* Ordinary Semaphore queue. Highest legitimate volume.
2. **Municipality-scoped operational advisories** (outbound, ≤5,000 recipients). *"Barangay Calasgasan residents: road flooding on Maharlika Hwy km 12; avoid route."* Semaphore priority queue. Municipal Admin authority only (§7.3).
3. **Province-wide or multi-municipality mass alerts → ESCALATE to NDRRMC ECBS, do NOT send ourselves.** For anything requiring broad reach, the system **requests escalation** to NDRRMC/PAGASA (§7.5.1). We do not blast 600,000 SMS via a commercial aggregator — that is slower, more expensive, and legally awkward under RA 10639, which assigns this channel to NDRRMC operating ECBS.
4. **Inbound citizen reports** (inbound). A feature-phone user texts `BANTAYOG <TYPE> <BARANGAY>` to a shared keyword. Globe Labs routes the SMS to a Cloud Function webhook that writes to `report_inbox` — the same collection the web app writes to. Unified ingestion.

**NDRRMC escalation workflow** (for purpose #3). The `requestMassAlertEscalation` callable captures: draft message, target areas, hazard class, evidence pack (linked reports, PAGASA reference if applicable). This creates a `mass_alert_requests/{id}` document and notifies the PDRRMO Director via priority SMS. The Superadmin reviews and forwards to NDRRMC via `forwardMassAlertToNDRRMC`. ECBS dispatch remains with NDRRMC. Bantayog records the escalation for audit and tracks NDRRMC's response timestamp to measure end-to-end. **The system must not claim to have issued an ECBS alert.** The UX distinguishes "escalation submitted to NDRRMC" from "sent via our SMS layer."

**Provider choice.** Semaphore primary, Globe Labs secondary:

- Semaphore charges ~₱0.50 (~$0.009) per SMS, versus Twilio at ~$0.20 per SMS — over 20× more expensive for Philippine delivery.
- Semaphore's priority queue bypasses the default message queue for time-sensitive messages, routed on SMS paths dedicated to OTP traffic that arrive even when telcos are experiencing high volumes. Emergency alerts use the priority queue.
- Globe Telecom has blocked VRN and long codes for A2P SMS, requiring alphanumeric sender IDs only, and Smart blocks messages containing URL shorteners due to smishing attacks. Domestic aggregators handle sender ID registration with the telcos directly. This matters for getting an approved `BANTAYOG` sender ID that actually delivers.
- Globe Labs provides both outbound sending **and** inbound keyword routing; Semaphore is outbound-only. Globe Labs is therefore required regardless, so using it as the outbound secondary adds no new vendor surface.

**The SMS abstraction layer.** A single Cloud Function callable/internal API `sendSMS(to, body, priority, purpose)` hides provider details from all callers. Circuit-breaker logic: if Semaphore returns errors or its p95 latency exceeds 30s over a 5-minute window, new sends route to Globe Labs; a health probe continues hitting Semaphore to decide when to return. Re-entry after 5 minutes of healthy probes. Every attempt is logged to `sms_outbox/{id}` with delivery-report callbacks from both providers writing back status.

Content rules enforced in the abstraction:
- Alphanumeric sender ID only (telco requirement) — `BANTAYOG`
- No URL shorteners (Smart blocks them) — only full destination URLs, or no URL at all
- ASCII-only; Tagalog ASCII text is fine; emojis and special characters are stripped at the abstraction layer with a warning log
- 160-character segments counted; long alerts split with `(1/3)` `(2/3)` `(3/3)` footers

**Inbound format (feature-phone users).** Users text `BANTAYOG <TYPE> <BARANGAY>` to the keyword. Parser accepts type synonyms: `FLOOD` / `BAHA`, `FIRE` / `SUNOG`, `LANDSLIDE` / `GUHO`, `ACCIDENT` / `AKSIDENTE`, `MEDICAL` / `MEDIKAL`, `OTHER` / `IBA`. Barangay is fuzzy-matched against the 12-municipality barangay gazetteer with Levenshtein distance ≤ 2; on ambiguous match, auto-reply lists candidates. On parse failure, the system auto-replies requesting the correct format. Location precision is barangay-level only; reports are flagged `requiresLocationFollowUp: true` and admin triage handles them the same as GPS-lacking web submissions.

Per-msisdn rate limits: max 5 submissions per msisdn per hour, max 20 per day. The webhook validates that the inbound request came from the configured Globe Labs IP range + shared-secret header. SMS-sourced reports are elevated-moderation by default.

---

## 4. Identity & Authentication Model

### 4.1 Identity Matrix

| Identity Level | Auth Method | UID | Surface | MFA | Notes |
|---|---|---|---|---|---|
| Pseudonymous citizen | `signInAnonymously()` | Temporary | Citizen PWA | No | Auto on launch |
| SMS-identified citizen | `sms_sessions/{msisdnHash}` | Implicit | None (SMS only) | No | Phone number = credential via rate limits |
| Registered citizen | Phone OTP (`linkWithCredential`) | Persistent | Citizen PWA | Optional (phone-OTP repeat) | Links pseudonymous history |
| Responder | Managed staff + phone OTP | Persistent | Responder App | **Required (TOTP)** | Created by Agency Admin |
| Municipal Admin | Managed staff + phone OTP | Persistent | Admin Desktop | **Required (TOTP)** | Created by Superadmin |
| Agency Admin | Managed staff + phone OTP | Persistent | Admin Desktop | **Required (TOTP)** | Created by Superadmin |
| Provincial Superadmin | Managed staff + phone OTP | Persistent | Admin Desktop | **Required (TOTP) + isPrivileged session** | Quarterly re-verify |
| Break-glass | Sealed escrow + dual-control | Persistent but disabled | Admin Desktop | **Required (TOTP)** | §11.6 |

**Privacy-language commitment:** Anonymous Firebase Auth is **not** equivalent to guaranteed real-world anonymity. It provides a pseudonymous technical identity that may later be linked to a registered account via `linkWithCredential()` if the user chooses to upgrade. A court order can compel linkage. App Check retains abuse signals. Firebase logs retain IP short-term. Citizen-facing copy must use language like "without registering" or "pseudonymous" — not "anonymous." Privacy notices must explicitly list what is retained for a pseudonymous report: pseudonymous UID, optional voluntary contact (goes to `report_contacts`), GPS, photos (EXIF-stripped), IP (short-term), msisdn hash if SMS.

### 4.2 Custom Claims

```typescript
interface CustomClaims {
  role: 'citizen' | 'responder' | 'municipal_admin' | 'agency_admin' | 'provincial_superadmin';
  municipalityId?: string;              // For municipal_admin; and for agency_admin scoped to one muni
  agencyId?: string;                    // For agency_admin and responder
  permittedMunicipalityIds?: string[];  // For responders serving multiple munis; for SAR cross-muni
  mfaVerified: boolean;
  claimsVersion: number;
  accountStatus: 'active' | 'suspended' | 'disabled';
  responderType?: 'POL' | 'FIR' | 'MED' | 'ENG' | 'SAR' | 'SW' | 'GEN';
  breakGlassSession?: boolean;          // Flagged true for emergency-provisioned access
}
```

Claims refresh on sign-in, privileged role change, and explicit revocation events. Authorization decisions fail closed when claims are missing, stale, or inconsistent with server-side account status.

### 4.3 Bounding JWT Staleness

Firebase Auth ID tokens have a 1-hour TTL. A revoked role can therefore remain valid for up to 60 minutes — unacceptable for a system where a fired admin or stood-down responder needs to lose privileges immediately.

Three-layer mitigation:

1. **Force-refresh signal.** On any privileged status change (`accountStatus → suspended`, role change), a server function writes to `claim_revocations/{uid}` with a server timestamp. The client app subscribes to its own revocation doc; on any change, it calls `getIdToken(true)` to refresh claims.
2. **Active-account check on privileged operations.** For write operations and reads of `report_private`, `report_ops`, `report_contacts`, dispatches, and audit data, security rules check a lightweight `active_accounts/{uid}` document containing `{accountStatus, lastUpdatedAt}`. This adds 1 read per privileged operation but is bounded — it does not apply to broad public reads or alert listings.
3. **Server-side check in callables.** All callable functions verify `accountStatus == 'active'` from the Admin SDK before executing.

The 60-minute window is closed in seconds for users actively connected; the active-account rule check closes it for the slower paths even when the client misses the refresh signal.

### 4.4 App Check

`enforceAppCheck: true` on every callable. Web: reCAPTCHA Enterprise. Capacitor: Play Integrity (Android) / App Attest (iOS).

App Check is an abuse-reduction control only. It does not replace authorization, rate limiting, fraud controls, session revocation, moderation workflows, or server-side validation against malicious-but-valid clients.

**SMS inbound cannot carry App Check tokens.** The webhook validates that the inbound request came from the configured Globe Labs IP range + shared-secret header, treats all SMS-sourced reports as elevated-moderation by default, and applies per-msisdn rate limits.

### 4.5 Anonymous Report Tracking — Reference vs. Secret

Anonymous citizens receive **two values** at submission:

1. A **public tracking reference** like `2026-DAET-0471` — human-readable, shareable, not sufficient alone.
2. A **tracking secret** — ≥128-bit high-entropy string, delivered once, stored in client localForage, surfaced for the user to save.

Status lookup via `lookupReportByToken` callable requires both. Rate-limited per IP and per UID. App Check protected. Direct Firestore reads are not used for anonymous status lookup.

`report_lookup/{publicRef}` contains only `{reportId, tokenHash, expiresAt}`. The tracking reference is **not** stored on `reports/{reportId}` (which has broader read scope). The client never sees Firestore document IDs — the only externally-facing identifier is the human-readable reference, and that alone is insufficient to retrieve report contents without the secret.

SMS-submitted reports receive the tracking reference back via auto-reply SMS; the tracking secret for SMS users is a shorter 6-digit PIN (lower entropy, bounded by per-msisdn rate limits on the lookup endpoint).

### 4.6 Staff Account Lifecycle

**Creation path:**
- Responder: Agency Admin creates via `createResponder` callable → responder receives SMS invite with one-time link → completes phone OTP → sets TOTP → account activated.
- Municipal Admin: Superadmin creates via `createMunicipalAdmin` → invite → phone OTP → TOTP → activated.
- Agency Admin: Superadmin creates via `createAgencyAdmin` → invite → phone OTP → TOTP → activated.

**Revoke Access on lost device:** `revokeResponderAccess(responderUid)` callable (Agency Admin power) sets `accountStatus: 'suspended'`, writes `claim_revocations/{uid}`, forces token refresh, streams audit event. The Firebase SDK cannot remotely wipe IndexedDB on a device we don't control — what we do instead is refuse authorization on every authenticated call, which makes the cached data useless for any privileged operation.

**Session re-auth intervals** (Firebase ID tokens are 1h TTL with auto-refresh; "session timeout" at the app layer means prompt-for-OTP re-entry):
- Responder: **12 hours** (covers a full shift).
- Municipal / Agency Admin: **8 hours**.
- Provincial Superadmin: **4 hours**.
- Break-glass session: auto-disables at 4 hours regardless of activity.

---

## 5. Data Architecture

### 5.1 The Report Triptych

A report is three Firestore documents sharing the same ID, materialized atomically by the `processInboxItem` Cloud Function trigger. The split creates a document-level security boundary that allows Firestore rules to scope access by data sensitivity.

**`reports/{reportId}` — Public/operationally shareable metadata**

```typescript
{
  municipalityId: string
  barangayId: string
  status: ReportStatus          // 13-state lifecycle — see §5.3
  type: IncidentType
  severity: Severity
  locationApprox: { barangay: string; municipality: string }
  locationPrecision: 'gps' | 'barangay_only'
  visibilityClass: 'public_alertable' | 'internal_only' | 'restricted'
  submissionState: 'server_accepted' | 'rejected' | 'duplicate'
  source: 'citizen_app' | 'citizen_sms' | 'responder_witness' | 'admin_entry'
  witnessPriorityFlag?: boolean          // Set on responder-witness reports for triage surfacing
  hasPhotoAndGPS: boolean                // Factual signal displayed in triage; replaces the deferred trustScore concept
  reporterRole?: 'citizen' | 'responder' | 'admin'
  duplicateClusterId?: string
  mergedInto?: string
  visibility: {
    scope: 'municipality' | 'shared' | 'provincial'
    sharedWith: string[]
    sharedReason?: string
    sharedAt?: Timestamp
    sharedBy?: string
  }
  createdAt: Timestamp
  serverAcceptedAt: Timestamp
  updatedAt: Timestamp
  verifiedAt?: Timestamp
  resolvedAt?: Timestamp
  archivedAt?: Timestamp
  deletedAt?: Timestamp
  retentionExempt?: boolean
  schemaVersion: number
}
```

`trustScore` is permanently excluded. Assigning per-citizen reliability scores without a documented governance process creates RA 10173 profiling exposure and operational risk (a false high score could drop real emergencies). The triage panel instead surfaces `hasPhotoAndGPS`, `source`, and `reporterRole` — factual, not scored. Reinstatement requires NPC-compliant governance approved by PDRRMO and provincial legal counsel.

**`report_private/{reportId}` — Restricted personal and location data**

```typescript
{
  municipalityId: string
  reporterUid: string
  reporterMsisdnHash?: string   // SHA-256 of phone for SMS-sourced reports
  isPseudonymous: boolean
  exactLocation?: GeoPoint      // Absent for SMS-sourced barangay-only reports
  publicTrackingRef: string
  contact?: {
    reporterName?: string
    phone?: string
    email?: string
    followUpConsent: boolean
  }
  createdAt: Timestamp
  schemaVersion: number
}
```

**`report_ops/{reportId}` — Restricted operational state**

```typescript
{
  municipalityId: string
  status: ReportStatus              // Denormalized mirror of reports.status
  severity: Severity                // Denormalized mirror
  createdAt: Timestamp              // Denormalized mirror
  agencyIds: string[]
  classification?: string
  verifiedBy?: string
  classifiedBy?: string
  duplicateOf?: string
  escalatedTo?: string
  activeResponderCount: number
  notesSummary?: string
  requiresLocationFollowUp: boolean // SMS reports without GPS
  witnessPriorityFlag?: boolean     // Denormalized for admin queue ordering
  // incidentCommanderId is intentionally absent — removed in v6 (Decision #45).
  // Ownership questions are answered by the state machine and dispatchedBy fields.
  visibility: {
    scope: 'municipality' | 'shared' | 'provincial'
    sharedWith: string[]
    sharedReason?: string
    sharedAt?: Timestamp
    sharedBy?: string
  }
  updatedAt: Timestamp
  schemaVersion: number
}
```

**Free-form admin notes containing PII are prohibited on this document.** Narrative notes go in `report_notes/{noteId}` with author, classification, and timestamp.

**Why `status`, `severity`, and `createdAt` are denormalized onto `report_ops`:** A common dispatcher query is "all high-severity unresolved reports currently assigned to the Red Cross." `severity` lives on `reports`; `agencyIds` lives on `report_ops`. Without denormalization, this requires two queries plus an N+1 fan-out — fatal under surge load with hundreds of active reports. Mirroring these three fields onto `report_ops` allows dispatchers to query a single collection with a composite index. The mirrored fields are maintained inside Firestore transactions by `processInboxItem` and status-transition callables. This is a deliberate write-amplification trade-off against read-heavy admin dashboards.

### 5.2 Dispatches

```typescript
dispatches/{dispatchId}
  reportId: string
  responderId: string
  municipalityId: string
  agencyId: string
  dispatchedBy: string
  dispatchedByRole: 'municipal_admin' | 'agency_admin'
  dispatchedAt: Timestamp
  status: DispatchStatus
  statusUpdatedAt: Timestamp
  acknowledgementDeadlineAt: Timestamp  // Per-dispatch; set per §5.4
  acknowledgedAt?: Timestamp
  inProgressAt?: Timestamp
  resolvedAt?: Timestamp
  cancelledAt?: Timestamp
  cancelledBy?: string
  cancelReason?: string
  timeoutReason?: string
  declineReason?: string
  resolutionSummary?: string
  proofPhotoUrl?: string
  requestedByMunicipalAdmin?: boolean   // true when agency dispatched in response to muni request
  requestId?: string                    // ref to agency_assistance_requests/{id}
  idempotencyKey: string
  schemaVersion: number
```

### 5.3 Report Lifecycle State Machine

```
                                   ┌─────────────────────────┐
                                   │ cancelled_false_report  │
                                   └─────────────────────────┘
                                               ▲
                                               │ (admin)
  ┌──────────────┐  (trigger)  ┌──────────┐  (admin)  ┌─────────────────┐  (admin)  ┌───────────────┐
  │ draft_inbox  │────────────▶│   new    │──────────▶│ awaiting_verify │──────────▶│   verified    │
  └──────────────┘             └──────────┘           └─────────────────┘           └───────────────┘
         │                         │   │                      │                             │
         │(trigger fails)          │   │(admin merges)        │(admin merges)               │(admin dispatches)
         ▼                         │   ▼                      ▼                             ▼
  ┌────────────┐                   │  ┌────────────────────┐  ┌────────────────────┐  ┌───────────────┐
  │  rejected  │                   │  │ merged_as_duplicate│  │ merged_as_duplicate│  │   assigned    │
  └────────────┘                   │  └────────────────────┘  └────────────────────┘  └───────────────┘
                                   │                                                         │(responder acknowledges)
                                   │                                                         ▼
                                   │                                                  ┌───────────────┐
                                   │                                                  │ acknowledged  │
                                   │                                                  └───────────────┘
                                   │                                                         │(responder en route)
                                   │                                                         ▼
                                   │                                                  ┌───────────────┐
                                   │                                                  │   en_route    │
                                   │                                                  └───────────────┘
                                   │                                                         │(responder arrives)
                                   │                                                         ▼
                                   │                                                  ┌───────────────┐
                                   │                                                  │   on_scene    │
                                   │                                                  └───────────────┘
                                   │                                                         │(responder resolves)
                                   ▼                                                         ▼
                          ┌─────────────────┐                                        ┌───────────────┐
                          │    cancelled    │                                        │   resolved    │
                          └─────────────────┘                                        └───────────────┘
                                                                                             │(admin closes)
                                                                                             ▼
                                                                                      ┌──────────────┐
                                                                                      │    closed    │
                                                                                      └──────────────┘
                                                                                             │(admin reopens)
                                                                                             ▼
                                                                                      ┌──────────────┐
                                                                                      │   reopened   │──┐
                                                                                      └──────────────┘  │(back to assigned)
                                                                                             ▲──────────┘
```

**Transitions, actor, and write authority:**

| From | To | Actor | Write | Side effects |
|---|---|---|---|---|
| — | `draft_inbox` | Client | Direct (`report_inbox`) | None yet |
| `draft_inbox` | `new` | System (trigger) | Server | Triptych materialized |
| `draft_inbox` | `new` | System (callable) | Server | Responder-witness path (§7.2) |
| `draft_inbox` | `rejected` | System (trigger) | Server | `moderation_incidents` entry |
| `new` | `awaiting_verify` | Municipal Admin or Superadmin | Server callable | Audit event |
| `new` | `merged_as_duplicate` | Municipal Admin or Superadmin | Server callable | `mergedInto` set; duplicate cluster updated |
| `awaiting_verify` | `verified` | Municipal Admin or Superadmin | Server callable | `verifiedBy`, `verifiedAt`; FCM + SMS to reporter |
| `awaiting_verify` | `merged_as_duplicate` | Municipal Admin or Superadmin | Server callable | As above |
| `awaiting_verify` | `cancelled_false_report` | Municipal Admin or Superadmin | Server callable | Audit + moderation event |
| `verified` | `assigned` | Municipal Admin or Agency Admin | Server callable | Dispatch created; responder FCM |
| `assigned` | `acknowledged` | Responder | Direct | Dispatch state linked |
| `acknowledged` | `en_route` | Responder | Direct | RTDB telemetry begins |
| `en_route` | `on_scene` | Responder | Direct | Geofence exit event logged |
| `on_scene` | `resolved` | Responder | Direct | Resolution summary required |
| `resolved` | `closed` | Municipal Admin | Server callable | Report locks; SMS closure to reporter if opted in |
| `closed` | `reopened` | Municipal Admin | Server callable | Returns to `assigned`; audit event |
| Any active | `cancelled` | Admin (with reason) | Server callable | All active dispatches cancelled |

**Only Municipal Admins and Provincial Superadmins can execute the `awaiting_verify → verified` transition.** Agency Admins have no verification authority — this keeps the report state machine clean, the audit trail unambiguous, and matches PH emergency management doctrine where LGUs hold the triage function. It also prevents the race where two agency admins and one municipal admin all hit "Verify" simultaneously with different severity classifications.

All transitions emit append-only entries to `report_events/{eventId}`. All privileged transitions require `isActivePrivileged()` rule check.

### 5.4 Dispatch State Machine

Canonical transitions:

- `pending → accepted` — **server-authoritative callable** (`acceptDispatch`). Cannot be a direct write because two responders can race offline and both win locally; first server-side write wins, second receives a structured "too late" response.
- `pending → declined` — responder direct write
- `pending → timed_out` — server scheduled job (`dispatchTimeoutSweep`, runs every 30s)
- `pending → cancelled` — server-authoritative admin action
- `accepted → acknowledged` — responder direct write (single actor, no contention)
- `acknowledged → in_progress` — responder direct write
- `in_progress → resolved` — responder direct write
- `accepted | acknowledged | in_progress → cancelled` — server-authoritative admin action
- `declined | timed_out | cancelled → superseded` — server-authoritative redispatch workflow only

All transitions record actor, timestamp, and reason where applicable, and emit an append-only entry to `dispatch_events/{eventId}`.

**Dispatch timeouts are data-driven, not hardcoded.** `acknowledgementDeadlineAt` is set per dispatch based on severity and agency defaults. A flat timeout window is operationally insufficient — a fire call at peak day is different from a structural-engineer callout at 2am.

Default timeout configuration in `system_config/dispatch_timeouts/{severity}`:
- `high: 3min`
- `medium: 5min`
- `low: 10min`

Agencies can override their own defaults via `agencies/{agencyId}.dispatchDefaults`. A reminder notification fires at 60% of the deadline window.

### 5.5 Complete Collection Map

```
firestore/
  report_inbox/{inboxId}             # Direct citizen write target (web + SMS source)
  reports/{reportId}                 # Public-classifiable metadata
    status_log/{entryId}
    media/{mediaId}
    messages/{msgId}
    field_notes/{noteId}
  report_private/{reportId}
  report_ops/{reportId}
  report_contacts/{reportId}
  report_lookup/{publicRef}          # {reportId, tokenHash, expiresAt} — callable-only; no client reads
  report_notes/{noteId}
  report_events/{eventId}            # Append-only lifecycle event stream
  dispatches/{dispatchId}
  dispatch_events/{eventId}
  users/{uid}
  responders/{uid}
  agencies/{agencyId}
  alerts/{alertId}                   # CF write only
  emergencies/{emergencyId}          # CF write only
  provincial_resources/{resourceId}
  mutual_aid_requests/{requestId}
  audit_logs/{logId}
  rate_limits/{key}
  system_config/{configId}
  idempotency_keys/{key}
  dead_letters/{id}
  metrics_province/{snapshotId}
  active_accounts/{uid}
  claim_revocations/{uid}
  device_registrations/{deviceId}
  moderation_incidents/{id}
  sync_failures/{id}
  sms_outbox/{msgId}                 # Every outbound SMS attempt with provider + status
  sms_inbox/{msgId}                  # Every inbound SMS (pre-parse); parses into report_inbox
  sms_sessions/{msisdnHash}          # Rate-limit state, tracking-PIN vault for SMS citizens
  sms_provider_health/{providerId}   # Circuit-breaker state (semaphore, globelabs)
  breakglass_events/{id}             # Emergency credential uses — superadmin append-only audit
  agency_assistance_requests/{requestId}  # Municipal admin → agency dispatch requests
  mass_alert_requests/{requestId}         # NDRRMC escalation submissions
  command_channel_threads/{threadId}      # Inter-admin messaging, per-incident
  command_channel_messages/{messageId}    # Messages within threads
  shift_handoffs/{handoffId}              # Admin shift handoff notes
  responder_shift_handoffs/{handoffId}    # Responder → responder handoff

rtdb/
  responder_locations/{uid}
  responder_index/{uid}                   # {municipalityId, agencyId} — CF-maintained
  agency_responder_projection/{agencyId}/{uid}  # 30s-sampled cross-agency map projection
```

### 5.6 Agency Assistance Request Schema

When a Municipal Admin needs agency capability:

```typescript
agency_assistance_requests/{requestId}
  reportId: string
  requestedByMunicipalId: string
  requestedByMunicipality: string
  targetAgencyId: string
  requestType: 'BFP' | 'PNP' | 'PCG' | 'RED_CROSS' | 'DPWH' | 'OTHER'
  message: string
  priority: 'urgent' | 'normal'
  status: 'pending' | 'accepted' | 'declined' | 'fulfilled' | 'expired'
  declinedReason?: string
  fulfilledByDispatchIds: string[]
  createdAt: Timestamp
  respondedAt?: Timestamp
  expiresAt: Timestamp              // Auto-expire 30 min if no response; escalates to superadmin
```

### 5.7 Firestore Security Rules

The complete rule set. All rules must have positive **and** negative tests. CI fails if any rule's negative tests are missing. No rule lands without proving it rejects the unauthorized cases — including cross-municipality leakage and agency-writing-to-another-agency's-responder.

We use `get()` lookups for `messages`, `field_notes`, and the `isActivePrivileged()` check. Each `get()` is a billable read. This is a deliberate trade against denormalization complexity — we accept the read cost on these moderate-traffic paths rather than duplicate mutable state on every write. High-traffic paths (`reports`, `report_ops`) use field denormalization instead. The `isActivePrivileged()` check applies only to writes and reads of restricted data, not to broad public reads like `alerts` or public-classified `reports`.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- Identity helpers ---
    function isAuthed() {
      return request.auth != null
          && request.auth.token.accountStatus == 'active';
    }
    function role()           { return request.auth.token.role; }
    function uid()            { return request.auth.uid; }
    function myMunicipality() { return request.auth.token.municipalityId; }
    function myAgency()       { return request.auth.token.agencyId; }
    function permittedMunis() {
      return request.auth.token.permittedMunicipalityIds != null
        ? request.auth.token.permittedMunicipalityIds : [];
    }

    function isCitizen()    { return isAuthed() && role() == 'citizen'; }
    function isResponder()  { return isAuthed() && role() == 'responder'; }
    function isMuniAdmin()  { return isAuthed() && role() == 'municipal_admin'; }
    function isAgencyAdmin(){ return isAuthed() && role() == 'agency_admin'; }
    function isSuperadmin() { return isAuthed() && role() == 'provincial_superadmin'; }

    // Privileged-path active-account check — extra defense beyond cached claim
    function isActivePrivileged() {
      return exists(/databases/$(database)/documents/active_accounts/$(uid()))
          && get(/databases/$(database)/documents/active_accounts/$(uid()))
             .data.accountStatus == 'active';
    }

    function adminOf(muniId) {
      return (isMuniAdmin() && myMunicipality() == muniId)
          || (isSuperadmin() && muniId in permittedMunis());
    }

    function canReadReportDoc(data) {
      return (data.visibilityClass == 'public_alertable' && isAuthed())
          || adminOf(data.municipalityId)
          || (isMuniAdmin() && myMunicipality() in data.get('visibility', {}).get('sharedWith', []));
    }

    function validResponderTransition(from, to) {
      return (from == 'accepted'     && to == 'acknowledged')
          || (from == 'acknowledged' && to == 'in_progress')
          || (from == 'in_progress'  && to == 'resolved')
          || (from == 'pending'      && to == 'declined');
    }

    // --- Citizen inbox ---
    match /report_inbox/{inboxId} {
      allow create: if isAuthed()
                    && request.resource.data.reporterUid == uid()
                    && request.resource.data.keys().hasAll(['reporterUid','clientCreatedAt','payload','idempotencyKey'])
                    && request.resource.data.payload is map
                    && !('source' in request.resource.data.payload
                         && request.resource.data.payload.source == 'responder_witness');
      allow read, update, delete: if false;
    }

    // --- Report triptych ---
    match /reports/{reportId} {
      allow read: if canReadReportDoc(resource.data);
      allow create, delete: if false;
      allow update: if adminOf(resource.data.municipalityId)
                    && isActivePrivileged()
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['status','severity','verifiedAt','resolvedAt',
                                 'archivedAt','deletedAt','retentionExempt',
                                 'visibilityClass','duplicateClusterId',
                                 'source','witnessPriorityFlag','hasPhotoAndGPS',
                                 'reporterRole','mergedInto','visibility','updatedAt']);

      match /status_log/{e} {
        allow read: if canReadReportDoc(get(/databases/$(database)/documents/reports/$(reportId)).data);
        allow write: if false;
      }
      match /media/{m} {
        allow read: if canReadReportDoc(get(/databases/$(database)/documents/reports/$(reportId)).data);
        allow write: if false;
      }
      match /messages/{m} {
        allow read: if isActivePrivileged() && (
          adminOf(get(/databases/$(database)/documents/reports/$(reportId)).data.municipalityId)
          || (isAgencyAdmin() && myAgency() in get(/databases/$(database)/documents/report_ops/$(reportId)).data.agencyIds)
          || (isResponder() && exists(/databases/$(database)/documents/dispatches/$(reportId + '_' + uid())))
        );
        allow write: if false;
      }
      match /field_notes/{n} {
        allow read: if isActivePrivileged() && (
          adminOf(get(/databases/$(database)/documents/reports/$(reportId)).data.municipalityId)
          || (isAgencyAdmin() && myAgency() in get(/databases/$(database)/documents/report_ops/$(reportId)).data.agencyIds)
          || (isResponder() && exists(/databases/$(database)/documents/dispatches/$(reportId + '_' + uid())))
        );
        allow write: if false;
      }
    }

    match /report_private/{r} {
      allow read: if isActivePrivileged() && adminOf(resource.data.municipalityId);
      allow write: if false;
    }

    match /report_ops/{r} {
      allow read: if isActivePrivileged() && (
        adminOf(resource.data.municipalityId)
        || (isAgencyAdmin() && myAgency() in resource.data.agencyIds)
        || (isMuniAdmin() && myMunicipality() in resource.data.visibility.sharedWith)
      );
      allow write: if false;
    }

    match /report_contacts/{r} {
      allow read: if isActivePrivileged() && adminOf(resource.data.municipalityId);
      allow write: if false;
    }

    match /report_lookup/{publicRef} {
      allow read, write: if false;  // lookupReportByToken callable only
    }

    // --- Dispatches ---
    match /dispatches/{d} {
      allow read: if isActivePrivileged() && (
        (isResponder() && resource.data.responderId == uid())
        || adminOf(resource.data.municipalityId)
        || (isAgencyAdmin() && myAgency() == resource.data.agencyId)
      );
      allow update: if isResponder()
                    && isActivePrivileged()
                    && resource.data.responderId == uid()
                    && validResponderTransition(resource.data.status, request.resource.data.status)
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['status','statusUpdatedAt','acknowledgedAt',
                                 'inProgressAt','resolvedAt','declineReason',
                                 'resolutionSummary','proofPhotoUrl']);
      allow create, delete: if false;
    }

    // --- Responders and Users ---
    match /responders/{rUid} {
      allow read: if isAuthed() && (
        uid() == rUid
        || (isAgencyAdmin() && myAgency() == resource.data.agencyId)
        || (isMuniAdmin() && myMunicipality() == resource.data.municipalityId)
        || isSuperadmin()
      );
      allow update: if uid() == rUid
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['availabilityStatus']);
      allow create, delete: if false;
    }

    match /users/{uUid} {
      allow read: if isAuthed() && (
        uid() == uUid
        || (isMuniAdmin() && myMunicipality() == resource.data.municipalityId)
        || isSuperadmin()
      );
      allow update: if uid() == uUid
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['displayName','phone','barangayId']);
      allow create, delete: if false;
    }

    // --- Auth support ---
    match /claim_revocations/{cUid} {
      allow read: if uid() == cUid;
      allow write: if false;
    }

    match /active_accounts/{aUid} {
      allow read: if uid() == aUid;
      allow write: if false;
    }

    // --- Public collections ---
    match /alerts/{a}        { allow read: if isAuthed(); allow write: if false; }
    match /emergencies/{e}   { allow read: if isAuthed(); allow write: if false; }
    match /agencies/{a}      { allow read: if isAuthed(); allow write: if isSuperadmin() && isActivePrivileged(); }
    match /system_config/{c} { allow read: if isAuthed(); allow write: if isSuperadmin() && isActivePrivileged(); }
    match /audit_logs/{l}    { allow read: if isSuperadmin() && isActivePrivileged(); allow write: if false; }
    match /rate_limits/{r}   { allow read, write: if false; }
    match /dead_letters/{d}  { allow read: if isSuperadmin() && isActivePrivileged(); allow write: if false; }
    match /moderation_incidents/{m} {
      allow read: if isActivePrivileged() && (isMuniAdmin() || isSuperadmin());
      allow write: if false;
    }

    // --- SMS layer (v5+) ---
    match /sms_inbox/{msgId} {
      allow read, write: if false;  // Cloud Function via Admin SDK only
    }
    match /sms_outbox/{msgId} {
      allow read: if isSuperadmin() && isActivePrivileged();
      allow write: if false;
    }
    match /sms_sessions/{msisdnHash} {
      allow read, write: if false;  // CF-managed
    }
    match /sms_provider_health/{providerId} {
      allow read: if isSuperadmin();
      allow write: if false;  // CF-managed
    }

    // --- Break-glass (v5+) ---
    match /breakglass_events/{id} {
      allow read: if isSuperadmin() && isActivePrivileged();
      allow write: if false;
    }

    // --- Event streams ---
    match /report_events/{eventId} {
      allow read: if isActivePrivileged()
                  && (isMuniAdmin() || isSuperadmin()
                      || (isAgencyAdmin() && resource.data.agencyId == myAgency()));
      allow write: if false;
    }

    // --- Agency assistance requests (v6+) ---
    match /agency_assistance_requests/{requestId} {
      allow read: if isActivePrivileged() && (
        (isMuniAdmin() && resource.data.requestedByMunicipality == myMunicipality())
        || (isAgencyAdmin() && resource.data.targetAgencyId == myAgency())
        || isSuperadmin()
      );
      allow write: if false;  // Callable only
    }

    // --- Command channel (v6+) ---
    match /command_channel_threads/{threadId} {
      allow read: if isActivePrivileged()
                  && (isMuniAdmin() || isAgencyAdmin() || isSuperadmin())
                  && request.auth.uid in resource.data.participantUids;
      allow write: if false;
    }
    match /command_channel_messages/{messageId} {
      allow read: if isActivePrivileged()
                  && (isMuniAdmin() || isAgencyAdmin() || isSuperadmin())
                  && get(/databases/$(database)/documents/command_channel_threads/$(resource.data.threadId))
                       .data.participantUids[request.auth.uid] != null;
      allow write: if false;
    }

    // --- Mass alert requests (v6+) ---
    match /mass_alert_requests/{requestId} {
      allow read: if isActivePrivileged() && (
        isSuperadmin()
        || (isMuniAdmin() && resource.data.requestedByMunicipality == myMunicipality())
      );
      allow write: if false;
    }

    // --- Shift handoffs (v6+) ---
    match /shift_handoffs/{handoffId} {
      allow read: if isActivePrivileged()
                  && (request.auth.uid == resource.data.fromUid
                      || request.auth.uid == resource.data.toUid
                      || isSuperadmin());
      allow write: if false;
    }
  }
}
```

### 5.8 Realtime Database Security Rules

```json
{
  "rules": {
    "responder_locations": {
      "$uid": {
        ".write": "auth != null
                   && auth.uid === $uid
                   && auth.token.role === 'responder'
                   && auth.token.accountStatus === 'active'
                   && newData.child('capturedAt').isNumber()
                   && newData.child('capturedAt').val() <= now + 60000
                   && newData.child('capturedAt').val() >= now - 600000",
        ".read": "auth != null
                  && auth.token.accountStatus === 'active'
                  && (
                    auth.uid === $uid
                    || auth.token.role === 'provincial_superadmin'
                    || (auth.token.role === 'municipal_admin'
                        && root.child('responder_index').child($uid).child('municipalityId').val() === auth.token.municipalityId)
                    || (auth.token.role === 'agency_admin'
                        && root.child('responder_index').child($uid).child('agencyId').val() === auth.token.agencyId)
                  )",
        ".validate": "newData.hasChildren(['capturedAt', 'lat', 'lng', 'accuracy', 'batteryPct', 'appVersion', 'telemetryStatus'])"
      }
    },
    "responder_index": {
      ".read": false,
      "$uid": { ".write": false }
    },
    "agency_responder_projection": {
      "$agencyId": {
        ".read": "auth != null
                  && auth.token.accountStatus === 'active'
                  && (auth.token.role === 'agency_admin'
                      || auth.token.role === 'municipal_admin'
                      || auth.token.role === 'provincial_superadmin')",
        "$uid": { ".write": false }
      }
    }
  }
}
```

`responder_index/{uid}` is maintained by Cloud Functions when responder municipality/agency assignments change. Timestamp validation rejects implausible past/future writes. RTDB rules must have negative tests in CI before any production deployment.

### 5.9 Composite Index Plan

Defined in `firestore.indexes.json` and deployed before first app launch.

**Core collections:**
- `reports`: (municipalityId + status + createdAt desc), (municipalityId + severity desc + createdAt desc), (visibilityClass + createdAt desc)
- `report_ops`: (municipalityId + status + severity desc + createdAt desc), (agencyIds CONTAINS + status + createdAt desc), (duplicateClusterId + createdAt), (visibility.sharedWith CONTAINS + status + createdAt desc)
- `dispatches`: (responderId + status + dispatchedAt desc), (reportId + status), (agencyId + status + dispatchedAt desc), (municipalityId + status + dispatchedAt desc)
- `alerts`: (targetMunicipalityIds CONTAINS + sentAt desc)
- `report_inbox`: (processingStatus + createdAt) — used by inbox backlog monitoring
- Lifecycle/cleanup: (deletedAt + retentionExempt), (archivedAt + retentionExempt)

**SMS layer:**
- `sms_outbox`: (providerId + status + createdAt desc), (purpose + createdAt desc)

**Event streams:**
- `report_events`: (reportId + createdAt desc), (actor + createdAt desc)
- `dispatch_events`: (dispatchId + createdAt desc)

**v6 collections:**
- `agency_assistance_requests`: (targetAgencyId + status + createdAt desc), (requestedByMunicipality + status + createdAt desc)
- `shift_handoffs`: (toUid + status + createdAt desc)

---

## 6. Write Authority Model

### 6.1 The Honest Split

**Server-authoritative mutations** (Cloud Functions / triggers):
- Inbox processing (`onCreate report_inbox` → materializes triptych)
- Inbound SMS webhook (`POST /smsInbound` → parses → writes `report_inbox`)
- Outbound SMS sending (`sendSMS` internal API → Semaphore/Globe Labs)
- `acceptDispatch` — atomic with `report_ops.activeResponderCount` update
- `dispatchResponder`, `cancelDispatch`, `redispatch`
- `verifyReport`, `rejectReport`, `mergeReports`
- `sendMassAlert`, `declareEmergency` — fans out on FCM + SMS
- `requestMassAlertEscalation`, `forwardMassAlertToNDRRMC`
- `submitResponderWitnessedReport` — writes to `new` directly (§7.2)
- `requestAgencyAssistance`, `acceptAgencyAssistance`, `declineAgencyAssistance`
- `addMessage`, `addFieldNote`
- Media registration (signed URL issuance with size/MIME enforcement)
- User/role administration; account suspension; `revokeResponderAccess`
- `initiateShiftHandoff`, `acceptShiftHandoff`, `initiateResponderHandoff`
- `triggerSOS`, `requestBackup`, `requestProvincialEscalation`, `markDispatchUnableToComplete`
- `closeReport`, `reopenReport`
- All report lifecycle transitions except those marked responder-direct below
- Export workflows, `lookupReportByToken`, `requestErasure`

**Direct client writes with rule-bounded scope:**
- Citizen → `report_inbox` (web; SMS goes via webhook)
- Responder → `dispatches/{id}` for `accepted→acknowledged→in_progress→resolved` and `pending→declined`
- Responder → `responders/{self}.availabilityStatus`
- User → `users/{self}` field-restricted

**Client-side offline queuing does not equal server acceptance.** UI distinguishes `queued`, `submitting`, `server_confirmed`, `failed_retryable`, `failed_terminal`.

**Why citizen submission is a direct inbox write, not a callable:** A callable requires a synchronous round-trip to Cloud Functions, which requires a fresh App Check token, which requires online attestation. On flaky 2G in mountainous barangays, that round-trip fails and the report drops. The Firestore SDK's offline persistence durably queues direct writes across app restarts — battle-tested across the Firebase ecosystem. We accept the inbox write into a quarantine collection, validate on the trigger side, and let `processInboxItem` materialize the real triptych. Failed validations land in `moderation_incidents` for human review rather than silently dropping a report.

**App Check on the inbox path is a soft gate, not a hard rejection.** App Check failure on an inbox write results in the item being flagged for elevated moderation. It does **not** cause rejection. Rejecting an offline-replayed legitimate report from a citizen in a disaster zone is worse than accepting it for human review. App Check failure is therefore treated as an elevated-risk signal, not a disqualifying one.

### 6.2 Idempotency

Every server-authoritative command accepts an `idempotencyKey` scoped to `(actor, commandType, logicalTarget)`. 24h TTL. Replays with same key + same hash return original result; same key + different hash fails with `ALREADY_EXISTS_DIFFERENT_PAYLOAD`. Triggered side effects use deduplication keys derived from `(eventId, sideEffectType)`.

**SMS outbound idempotency** uses `(reportId, purpose, recipientMsisdn)` as the key — a retry of a "your report was received" alert cannot result in the citizen getting two texts.

---

## 7. Role Workflows — Canonical Definitions

Capability is defined by data-class reach. Every capability listed here has a corresponding security rule and, where mutations are involved, a server-authoritative callable. UI affordances not backed by a rule don't exist.

### 7.1 Citizen

**Primary surface:** Citizen PWA. Feature-phone users hit the SMS ingest path.

**Capabilities:**
- Submit reports via app form or SMS keyword
- Upload photos/videos (EXIF-stripped server-side)
- Provide GPS location (auto-detected) or select municipality/barangay as fallback
- View public map and feed (verified incidents, location-blurred for pseudonymous feed)
- Receive official alerts (FCM + SMS depending on registration)
- Track own report status via tracking reference + secret, or via registered account
- Edit unverified reports (before municipal admin verifies)
- Cancel pending reports (before verification)
- Request correction on verified reports (admin approval required)
- Upgrade pseudonymous session to registered account (preserves UID and report history)

**Constraints:**
- No verification authority
- No dispatch visibility beyond own report status
- No citizen contact info of others visible
- Admin identity (individual names) never surfaced; institutional labels only (§7.3 below)

**Submit flow:**
1. User completes report form. Photos are handled separately via resumable Storage upload (`uploadBytesResumable`) — independent from command submission so a failed photo doesn't block the report.
2. On submit, client writes to `report_inbox/{newId}` via Firestore SDK with `clientCreatedAt`, payload, and idempotency key.
3. Firestore SDK queues the write durably in IndexedDB and survives app close/restart on Android.
4. On reconnect, write commits. UI transitions to `submitting`, then `server_confirmed` once `report_inbox/{newId}` exists on the server.
5. `processInboxItem` trigger materializes the triptych. The client subscribes to its own `report_lookup/{publicRef}` to detect when the report becomes queryable; alternatively, the publicRef + tracking secret can be surfaced directly via the inbox doc mirror.
6. If trigger validation fails, a `moderation_incidents/{id}` entry is created. The citizen receives a structured failure response on next status lookup — the report is not silently dropped.

Orphaned Storage objects (media without a referencing report doc after 24h) are deleted by the `cleanupOrphanedMedia` scheduled function.

**Rate limits:**
- Per pseudonymous UID: 3 reports / hour, 10 / day
- Per msisdn hash (SMS): 3 reports / hour, 10 / day
- Per IP (fallback gate): 20 reports / day
- Soft limit triggers moderation queue elevation; hard limit returns error with suggested alternate contact (barangay hotline)

### 7.2 Responder

**Primary surface:** Responder Capacitor app.

**Capabilities:**
- Receive dispatch notifications (FCM high-priority)
- Accept via `acceptDispatch` callable (server-authoritative, resolves races) or decline (direct write with reason)
- Transition own dispatch through `acknowledged → en_route → on_scene → resolved` (direct writes, rule-validated)
- SOS emergency signal — `triggerSOS` callable fires FCM + SMS to all admins in responder's municipality/agency, logs audit entry, never silently fails
- Add field notes (direct write to `reports/{id}/field_notes/{noteId}`, rule validates responder is assigned)
- Upload field photos (signed URL via `requestUploadUrl`)
- Request backup via `requestBackup` callable — routes to assigned municipal admin
- Request provincial escalation via `requestProvincialEscalation` callable — routes to superadmin
- "Unable to complete" workflow via `markDispatchUnableToComplete` callable — admin-reviewable, triggers reassignment
- Set availability: `available` / `unavailable` / `off_duty` — direct write to `responders/{self}.availabilityStatus` with required reason
- View own performance metrics
- Shift handoff to another responder via `initiateResponderHandoff` callable
- **Verified Responder Report** — `submitResponderWitnessedReport` callable, rate-limited to 10 reports per responder per 24h

**Verified Responder Report flow.** A responder witnessing an incident directly can create a pre-classified report that skips the `draft_inbox → new` step but does NOT skip `awaiting_verify → verified`. It is an accelerated intake, not a verification bypass — making a responder route through the citizen SMS path is absurd, but allowing them to mark a report "verified" without LGU review breaks the state machine.

1. Responder taps "Report What I'm Seeing."
2. Fills short form: type, severity (suggested), GPS (auto-captured, required), photo (required), short description.
3. Calls `submitResponderWitnessedReport` with idempotency key.
4. Server writes `reports/{reportId}` directly at state `new` with `source: 'responder_witness'`, `reporterId`, `reporterRole: 'responder'`, `witnessPriorityFlag: true`.
5. FCM fires to the municipal admin of the geo-resolved municipality AND to the responder's own agency admin.
6. Municipal admin sees a "Responder-Witnessed" badge; still must execute `awaiting_verify → verified` but `hasPhotoAndGPS` is guaranteed true so verification is fast.
7. Audit log records the bypass of `draft_inbox` and the identity of the responder.
8. If the responder is geo-resolved to a municipality outside their `permittedMunicipalityIds`, the report is still created but flagged `crossJurisdictionFlag: true` for superadmin attention.

**Constraints:**
- Cannot verify, classify, or change severity of reports
- Cannot see reports outside active assignment (jurisdiction scope)
- Cannot see citizen contact info
- No direct responder-to-responder messaging (all comms through admin or command channel threads they're not in)
- No Facebook Messenger integration — external third-party, RA 10173 data residency, no SLA, no audit hook, unreliable in degraded networks

**Location sharing:**
- Active only during `acknowledged → en_route → on_scene` states (dispatch active)
- Motion-driven cadence per §8.2
- Retention: 90 days (post-incident review requires this duration)
- Opt-out exists in settings but moves responder to `unavailable` — admin must have telemetry on live dispatches

**Auth:**
- Phone OTP + TOTP mandatory
- 12-hour re-auth interval
- Cannot self-register (Agency Admin creates)

### 7.3 Municipal Admin

**Primary surface:** Admin Desktop PWA.

**Scope:** One municipality. No cross-municipality authority except shared border incidents (§7.3.3).

**Capabilities:**
- **Verify reports:** `verifyReport` callable, transitions `awaiting_verify → verified`, sets `reportType` and `severity`, triggers FCM + SMS to reporter with institutional attribution
- **Reject reports:** `rejectReport` callable, transitions `awaiting_verify → cancelled_false_report`, logs moderation incident
- **Merge duplicates:** `mergeReports` callable
- **Dispatch own municipality's responders directly:** `dispatchResponder` callable
- **Request agency assistance:** `requestAgencyAssistance` callable, creates `agency_assistance_requests/{id}`, notifies target agency
- **Cancel dispatches:** `cancelDispatch` callable
- **Redispatch after decline / timeout:** `redispatchReport` callable
- **Communicate with citizens:** `addMessage` callable writing to `reports/{id}/messages`
- **Command Channel threads** with agency admins and superadmins per incident
- **Send municipality-scoped mass alerts** via `sendMassAlert` callable — routing enforced per §3: if estimated SMS recipients ≤ 5,000 AND target is single municipality → FCM + Semaphore priority queue; otherwise → NDRRMC Escalation Request. Before confirming, the admin sees a **Reach Plan** preview (computed by `massAlertReachPlanPreview` callable) showing estimated recipients by channel. This prevents the admin from assuming a direct SMS blast is possible when the recipient count exceeds the threshold.
- **View own municipality's responders' real-time telemetry** (RTDB direct read, rule-scoped)
- **View other-agency responders on incidents in own municipality** (ghosted 100m-grid projection, §8.5)
- **Close resolved incidents:** `closeReport` callable
- **Reopen closed incidents:** `reopenReport` callable
- **View municipality analytics**
- **Shift handoff** (§7.6)

**Constraints:**
- Cannot view or write to reports outside own municipality, except shared border incidents
- Cannot dispatch responders outside own municipality
- Cannot see other municipalities' analytics (anonymized comparisons OK)
- Cannot modify citizen report content (can only classify)
- Cannot bypass responder opt-in (dispatches go to `pending`)
- Cannot promote users or change roles (superadmin only)

**Admin identity is hidden from citizens and the public feed, but not from responders or audit.** Citizens see institutional attribution ("Verified by Daet MDRRMO"). Responders see individual attribution ("Dispatched by Admin Santos") because they need to know who to call back. Audit gets full attribution. The `report_lookup/{publicRef}` document is CF-written from `report_events` with `actorId` fields stripped and `actorRole + actorMunicipalityId` rendered as institutional labels. Relying on the UI alone to hide this would leave admin UIDs readable via direct listener subscription.

#### 7.3.1 Surge Triage Mode

- Activated via UI toggle; client-side filter/sort optimization only, no server behavior change
- Queue renders in a scannable list instead of map overlays
- Single-key shortcuts: `V` verify, `R` reject, `M` merge-with-selected, `S` skip
- Bulk operations use the same per-report callables — no special "bulk verify" that short-circuits rule checks
- Loading bound: 100 reports rendered, older paginated

#### 7.3.2 Border Incidents (Shared Visibility)

- A report's `visibility.scope = 'shared'` sets `sharedWith` to a list of municipality IDs
- Sharing is initiated by a CF trigger when geo-intersection of report location + municipal boundary buffer (500m) detects the report is near a border, or by explicit admin action via `shareReportWithMunicipality` callable
- All sharing actions write to audit (`sharedBy`, `sharedReason`, `sharedAt`)
- Adjacent municipal admins see a "Shared Incident" badge; can dispatch their own responders; cannot modify verification status (originator municipality owns that)

#### 7.3.3 Command Channel Threads

Per-incident messaging between admins (municipal ↔ agency, municipal ↔ municipal on shared incidents, any ↔ superadmin).

- `command_channel_threads/{threadId}` created automatically when: report is shared, agency assistance is requested, or provincial escalation is requested
- Participants: all admins with operational stake in the incident
- Messages written via `postCommandChannelMessage` callable
- Retention: same as parent report
- All messages audit-streamed to BigQuery (batch path)

### 7.4 Agency Admin

**Primary surface:** Admin Desktop PWA.

**Scope:** One agency (BFP, PNP, Red Cross, DPWH, etc.). May operate across multiple municipalities if the agency does (e.g., PNP Provincial).

**Capabilities:**
- **Manage agency roster:** create/edit/suspend responders via `createResponder`, `updateResponder`, `suspendResponder` callables, all rule-gated to own `agencyId`
- **Set shifts:** bulk on-duty / off-duty toggles via `bulkSetResponderAvailability` callable
- **Tag responder specializations** (`Swift Water Rescue`, `Hazmat Certified`, etc.) — fields on `responders/{uid}.specializations[]`
- **View verified incidents** in agency's operational jurisdiction (no pending-queue visibility)
- **View and respond to agency assistance requests** from municipal admins; `acceptAgencyAssistance` or `declineAgencyAssistance` (with reason)
- **Dispatch own agency's responders** to any incident the agency has access to
- **View own agency responder status** at full telemetry fidelity
- **View other-agency responders** at 30s-sampled 100m-grid projection (§8.5)
- **Communicate with own responders** via `reports/{id}/messages` subcollection
- **Command Channel threads** with municipal admins on incidents the agency is engaged in
- **View agency-scoped analytics** and export monthly accomplishment report
- **Revoke responder access** (lost device) via `revokeResponderAccess` callable
- **Decline assistance requests** when no units available

**Constraints:**
- **No report verification authority.** Only Municipal Admins and Provincial Superadmins verify. The Verified Responder Report bypass (§7.2) still routes through a municipal admin for final verification — the agency admin is not in that path.
- **No mass alerts to citizens** — operational messaging to own responders only via the message subcollection.
- **No dispatching other agencies.**
- **No managing other agencies' rosters.**
- **No system-wide analytics** (agency-scoped only).
- **No "Incident Commander" tag.** The existing state machine answers every operational question: who can cancel a dispatch (dispatching admin + superadmin), who can close a report (municipal admin of that municipality + superadmin), who can redispatch (same). Inter-agency conflicts are resolved via Command Channel threads, not a tag.

**Hub-and-Spoke Flow (Primary):**
1. Citizen submits → `report_inbox`
2. Municipal Admin verifies → `verified`
3. Municipal Admin clicks "Request Agency Assistance" → `agency_assistance_requests/{id}`
4. Agency Admin receives FCM + command-channel notification
5. Agency Admin reviews verified report, dispatches → `dispatches/{id}` with `requestId` linked
6. Municipal Admin dashboard auto-updates
7. Responder acknowledges, proceeds, resolves
8. Agency Admin marks dispatches resolved; Municipal Admin closes the report

### 7.5 Provincial Superadmin

**Primary surface:** Admin Desktop PWA, dual-monitor.

**Scope:** Entire province (12 municipalities).

**Capabilities:**
- All Municipal Admin capabilities, province-wide
- **User management:** create/suspend/promote staff accounts for all roles; self-demotion prohibited
- **Declare provincial emergency:** `declareEmergency` callable, fans out FCM + SMS to all active staff + authorized citizen subset
- **Approve NDRRMC escalation requests:** reviews `mass_alert_requests/{id}` and forwards via `forwardMassAlertToNDRRMC` workflow
- **Toggle mutual-aid visibility** for cross-municipality agency response
- **Manage provincial resources**
- **View all audit logs** (streaming + batch BigQuery access via separate IAM)
- **Retention exemptions:** `setRetentionExempt` callable, streams audit
- **Approve data subject erasure requests**
- **Trigger surge pre-warm manually** (normally automatic on PAGASA signal)
- **Break-glass review:** independent review of all break-glass session actions within 72h
- **Read `report_private` and `report_contacts`** — streaming audit on every such read
- **View SMS audit** (`sms_outbox`), provider health, system-health dashboards

**Constraints:**
- Requires MFA + TOTP + 4h re-auth interval
- Cannot read citizen data without audit trail
- Cannot change own role
- Cannot disable audit streaming

#### 7.5.1 NDRRMC Escalation Workflow

1. Municipal admin (or superadmin) composes mass alert
2. UI Reach Plan preview shows estimated recipients per channel
3. If SMS recipients > 5,000 OR multi-municipality → UI routes as escalation; `sendMassAlert` callable refuses direct send
4. `requestMassAlertEscalation` callable creates `mass_alert_requests/{id}` with draft message, target areas, hazard class, evidence pack, `status: 'pending_pdrrmo_review'`
5. FCM + priority SMS to PDRRMO Director
6. Superadmin reviews, approves → `status: 'forwarded_to_ndrrmc'` + captures forward method + NDRRMC receipt acknowledgment timestamp
7. NDRRMC decides to dispatch via ECBS or not; their decision is recorded but not executed by Bantayog
8. Audit captures end-to-end latency (submission → NDRRMC receipt → ECBS dispatch if any)

The UI everywhere distinguishes "Escalation submitted to NDRRMC" from "Sent via our SMS layer." The system does not claim to have issued an ECBS alert.

### 7.6 Admin Shift Handoff (All Admin Roles)

`initiateShiftHandoff` callable creates `shift_handoffs/{id}` with:
- `fromUid`, `toUid`, `fromRole`, `toRole`
- `activeIncidentSnapshot`: active incident summaries (IDs, status, age, responders assigned)
- `urgentItems`: admin-flagged concerns
- `pendingRequests`: open agency requests / escalations
- `generalNotes`: free-form narrative
- `status: 'pending_acceptance'`

Incoming admin accepts via `acceptShiftHandoff` → `status: 'accepted'`. If no acceptance within 30 minutes, superadmin is notified. Handoff doc is immutable after acceptance; modifications are new handoff docs (append-only). Retention: 2 years.

---

## 8. Responder Location & Mobile Execution

### 8.1 Telemetry Model

Telemetry written to RTDB only while responder is on active assignment or explicitly enabled duty state. Record includes: `capturedAt`, `receivedAt` (server timestamp), `lat`, `lng`, `accuracy`, `batteryPct`, `motionState`, `appVersion`, `telemetryStatus`.

### 8.2 Motion-Driven Sampling

GPS-speed inference kills batteries in 3–4 hours at real staging durations. Hardware motion detection is the only viable path to 12+ hour shifts. The device emission cadence:

| Hardware-reported activity | GPS polling | Rationale |
|---|---|---|
| `running` / `in_vehicle` (high priority dispatch) | 10s ± 2s | Real-time tracking during active response |
| `walking` (normal priority) | 30s ± 5s | Moving but not urgent |
| `still` + on active dispatch | Geofence-only + 5-minute GPS ping | Stationary at staging; rely on geofence exit to resume |
| `still` + low battery (<20%) | Geofence-only + 10-minute GPS ping | Battery preservation |
| No active dispatch | No tracking | Zero-telemetry off-duty |

- **Android:** Activity Recognition API via `@capacitor-community/background-geolocation`.
- **iOS:** CMMotionActivityManager via Capacitor plugin.

Geofence setup on `acknowledged` state: 50m radius around the responder's current position. Exit triggers resumption of active GPS polling.

Jitter (± values above) prevents thundering-herd reconnection when a cell tower recovers and many responders transmit simultaneously.

### 8.3 Stale-State Display

Admin display freshness bands are calibrated to the emission model:

| `telemetryStatus` | Definition | Operator UX |
|---|---|---|
| `live` | `receivedAt` within 2× expected interval for current motion state | Normal display |
| `degraded` | Within 4× expected interval | Yellow tint, age label |
| `stale` | Exceeds 4× expected interval | Gray, "last seen X ago", warning banner |
| `offline` | No `receivedAt` for 5+ min during active dispatch | Red, dispatcher alert, manual contact prompt |

### 8.4 Cost Behavior Under Degraded Networks

Baseline ~$0.40/day at 30 responders × 24h × adaptive intervals × 120-byte payloads × 12 listeners. Under degraded networks, websocket reconnection storms can multiply this 10×–100× as listeners re-sync state on each reconnect. Budget alerts fire at 5×, 10×, and 25× baseline. Connection backoff uses exponential jitter.

### 8.5 Cross-Agency Visibility Projection

Letting 12 agencies each subscribe to every other agency's full RTDB tree is a cost and privacy problem. Instead, a CF projection `projectResponderLocationsForAgencies` runs every 30 seconds:

- Iterates active dispatches, grouped by municipality
- For each responder on active dispatch, writes to `rtdb/agency_responder_projection/{peerAgencyId}/{responderUid}`:
  - `lat`, `lng` rounded to 100m grid (privacy-preserving)
  - `agencyId` of responder
  - `status` (`en_route` | `on_scene`)
  - `updatedAt` server timestamp
- Each entry has 90s TTL; if not refreshed, cleared
- RTDB rules allow read to `agency_admin`, `municipal_admin`, `provincial_superadmin` regardless of peer agency ID

Own-agency responders are read directly from `responder_locations/{uid}` at full fidelity via the existing rule. Cost note: 30 responders × 12 projections each = 360 writes/30s on RTDB. At RTDB bandwidth pricing this is negligible; at Firestore write pricing it would be expensive — that's why this is on RTDB.

**Capacitor plugins required for Responder App:**
- `@capacitor-community/background-geolocation` — hardware motion + geofence-aware GPS polling
- `@capacitor/push-notifications` — FCM on Android, APNS on iOS
- `@capacitor/preferences` — persisted state (foreground service status, last-known motion activity)
- `@capacitor/network` — online/offline detection (more reliable than `navigator.onLine` on mobile WebView)
- `@capacitor/device` — device info for audit trail
- Custom plugin: `BantayogForegroundService` — Android foreground service with persistent notification (mandated by Play Store for background location)

---

## 9. Frontend Architecture

### 9.1 State Ownership by Surface

Per Principle #10, state has exactly one authority per category. Three surfaces have three distinct profiles.

**Citizen PWA:**

| Data category | Authority | Everything else must | Rationale |
|---|---|---|---|
| Server documents (reports, alerts) | Firestore SDK local persistence | Read via listeners, never cache separately | Single source of server truth; offline persistence is SDK-native |
| UI state (modal, form field, tab) | Zustand | Never duplicate in server cache | UI-only; not persisted to server |
| Non-Firestore HTTP (callables, tracking lookup) | TanStack Query | Never hand-cache in Zustand | Built-in invalidation + retry |
| Drafts + queued submissions | localForage + Firestore SDK queue | Always write to both | SDK queue alone is vulnerable to IndexedDB eviction on iOS |
| Tracking secrets | localForage | Never in Zustand | Survives app restart |
| Session / auth state | Firebase Auth SDK | Everything reads via `onAuthStateChanged` | Auth SDK is authoritative |

**Responder App:**

| Data category | Authority |
|---|---|
| Server documents (dispatches, reports, messages) | Firestore SDK |
| UI state | Zustand |
| Non-Firestore HTTP (callables) | TanStack Query |
| Foreground-service status | Capacitor Preferences |
| Last known motion activity | Capacitor Preferences + in-memory |
| GPS telemetry | Write-only to RTDB; no local persistence |

No outbox layer. Responder writes are single-actor sequential transitions on dispatches the responder owns; SDK queue handles reconnection correctly.

**Admin Desktop:**

| Data category | Authority |
|---|---|
| Server documents (reports, dispatches, responders, analytics) | Firestore SDK |
| UI state (map viewport, selected entity, panel, filters) | Zustand |
| Non-Firestore HTTP (callables, analytics aggregates, exports) | TanStack Query |
| No outbox, no offline writes | Blocked at UI when disconnected |

**Rules the codebase enforces:**
1. No component reads a report from Zustand. Reports come from Firestore listeners.
2. No component writes a server-synced field to Zustand. Edits go to the outbox (localForage + Firestore write queue), and the UI reflects the optimistic change via TanStack Query's `setQueryData`.
3. TanStack Query does not own data — it caches views of what Firestore's listeners return.
4. Drafts in localForage use client-generated UUIDs that match the inbox ID so they can be correlated with the server record on acceptance.

### 9.2 Offline and Reconciliation Model (Citizen PWA)

Client states: `draft` → `queued` → `submitting` → `server_confirmed` | `failed_retryable` | `failed_terminal`.

**Draft durability against IndexedDB eviction.** Mobile browsers — especially iOS Safari and Android Chrome under storage pressure — can evict IndexedDB data silently. If a citizen drafts offline and the OS evicts before reconnection, the Firestore queue is gone.

Mitigation:
1. **Dual-write on draft save.** The client writes to both the Firestore SDK write queue AND a localForage entry keyed `draft:{clientUuid}`. localForage uses IndexedDB under the hood but with a separate database name; on init failure it falls back to WebSQL and localStorage.
2. **On app start, reconcile.** If the Firestore queue is empty but localForage has `draft:{uuid}` entries, the client re-enqueues them. If Firestore already accepted (verified by listener), the localForage entry is cleared.
3. **User-visible persistence confirmation.** After submit, the UI shows *"Your report is saved on this device. Reference: 2026-DAET-0471. Take a screenshot or save this code."* This converts the reference into a paper-form fallback.
4. **iOS-specific fallback.** On iOS, if IndexedDB appears compromised (detected via write-then-read probe), the UI prompts the user to send via SMS instead, pre-filling a `sms:` link with the correct keyword format.
5. **Background Sync API** is used where available (Chromium browsers) to retry when the browser is closed. iOS does not implement Background Sync; iOS users rely on the app being reopened — which is why SMS fallback exists.

### 9.3 Failure-State UX

Critical screens display:
- Network state indicator (online / offline / degraded)
- Last successful sync timestamp
- Stale data warnings
- Pending outbound queue count (with drill-down to `draft:` items in localForage)
- Per-item submission state
- Permission state (location, notifications) with one-tap recovery
- SMS fallback prompt when Firestore queue has been stuck >10 minutes with network present

### 9.4 Error Boundaries

Three levels: root, role-area, panel. Crashed panel retries without losing map context. All boundary catches log to a `client_errors` stream.

### 9.5 Map Rendering

All three apps use Leaflet + OSM tiles.

- Citizen PWA: client-rendered pins with 100-pin cap, clustering above. Tile caching: 24h browser cache.
- Responder app: own dispatches + route overlay only.
- Admin Desktop: full-density map with clustering, per-role overlays, real-time responder markers. No tile caching assumed (always online).

---

## 10. Backend Architecture

### 10.1 Cloud Functions

**Triggers:**
- `onCreate report_inbox/{id}` → `processInboxItem` (materializes triptych; `minInstances: 3`, `concurrency: 80`, idempotent on inbox ID)
- `onWrite dispatches/{id}` → `onDispatchStateChanged`
- `onCreate moderation_incidents/{id}` → escalation
- `onFinalize storage.objects` → EXIF stripping for `/reports/*/media/*`
- `onCreate sms_inbox/{id}` → `parseInboundSMS` → writes to `report_inbox`
- Delivery-report webhooks from Semaphore and Globe Labs → update `sms_outbox/{id}.status`

**Callables** (App Check enforced, idempotency keys required, correlation ID propagated, server-side `accountStatus` check on all):

| Callable | Actor Role | Purpose |
|---|---|---|
| `acceptDispatch` | responder | Race-safe dispatch acceptance |
| `dispatchResponder` | municipal_admin, agency_admin | Create dispatch |
| `cancelDispatch` | admin roles | Cancel active dispatch |
| `redispatchReport` | admin roles | Supersede timed-out/declined dispatch |
| `verifyReport` | municipal_admin, provincial_superadmin | `awaiting_verify → verified` |
| `rejectReport` | municipal_admin, provincial_superadmin | `awaiting_verify → cancelled_false_report` |
| `mergeReports` | municipal_admin, provincial_superadmin | Duplicate cluster management |
| `closeReport` | municipal_admin, provincial_superadmin | `resolved → closed` |
| `reopenReport` | municipal_admin, provincial_superadmin | `closed → assigned` |
| `submitResponderWitnessedReport` | responder | Pre-classified report, elevated triage priority |
| `requestAgencyAssistance` | municipal_admin | Create assistance request to agency |
| `acceptAgencyAssistance` / `declineAgencyAssistance` | agency_admin | Respond to muni request |
| `createResponder` / `updateResponder` / `suspendResponder` | agency_admin | Roster management |
| `bulkSetResponderAvailability` | agency_admin | Shift toggle |
| `revokeResponderAccess` | agency_admin | Lost device |
| `triggerSOS` | responder | SOS broadcast |
| `requestBackup` | responder | Backup request routing |
| `requestProvincialEscalation` | responder | Provincial escalation |
| `markDispatchUnableToComplete` | responder | Unable-to-complete workflow |
| `shareReportWithMunicipality` | municipal_admin | Explicit cross-muni share |
| `sendMassAlert` | municipal_admin, provincial_superadmin | Direct send (≤5,000 SMS + FCM) |
| `requestMassAlertEscalation` | municipal_admin, provincial_superadmin | NDRRMC escalation submission |
| `forwardMassAlertToNDRRMC` | provincial_superadmin | Forward escalation with receipt |
| `massAlertReachPlanPreview` | municipal_admin, provincial_superadmin | Preview recipient estimates before send |
| `postCommandChannelMessage` | admin roles | Inter-admin messaging |
| `initiateShiftHandoff` / `acceptShiftHandoff` | municipal_admin, agency_admin, provincial_superadmin | Admin shift handoff |
| `initiateResponderHandoff` | responder | Responder shift handoff |
| `declareEmergency` | provincial_superadmin | Province-wide emergency declaration |
| `sendSMS` | Internal (called by other callables/triggers only) | SMS abstraction layer |
| `initiateBreakGlass` | Architecture Team on-call (dual-control) | Emergency superadmin provisioning |
| `lookupReportByToken` | All (rate-limited) | Anonymous report status lookup |
| `requestErasure`, `exportData` | All (rate-limited, self-scoped) | Data subject rights |
| `setRetentionExempt` | provincial_superadmin | Retention override with audit |

**Scheduled functions:**
- `archiveReports` daily
- `cleanupDeletedReports` weekly (with deletion-SLA verification)
- `computeMetrics` every 5 minutes
- `dispatchTimeoutSweep` every 30s — applies `pending → timed_out` per timeout config
- `cleanupOrphanedMedia` daily
- `auditExportHealthCheck` every 10 minutes
- `inboxReconciliationSweep` every 5 minutes (addresses cold-start trigger failures)
- `smsOutboxCleanup` daily (purges 90-day-old SMS records)
- `smsProviderHealthProbe` every 2 minutes (circuit-breaker state update)
- `projectResponderLocationsForAgencies` every 30s (cross-agency RTDB projection)

### 10.2 Cold-Start Mitigation for Inbox Trigger

A typhoon surge brings hundreds of citizens online simultaneously. Cloud Functions cold-starts could cause `processInboxItem` timeouts, leaving `report_inbox` items with no corresponding triptych.

**Configuration for `processInboxItem`:**
- `minInstances: 3` during normal operation
- `maxInstances: 100`
- `concurrency: 80`
- `timeoutSeconds: 120`
- `memory: 512MiB`

Cost at idle: ~$45-60/month for the three warm instances.

**`inboxReconciliationSweep` — the safety net.** Every 5 minutes, a scheduled function scans `report_inbox` for items where `processedAt` is null and `createdAt` is more than 5 minutes ago. For each match, it retries `processInboxItem` with the inbox ID as idempotency key. If the retry fails three reconciliation attempts, the item is written to `dead_letters` with the original payload and an alert fires to backend on-call. **No citizen report is silently dropped by a trigger failure.**

**Surge capacity pre-warming.** On a PAGASA Signal-2+ warning for any barangay in the province, a scheduled function raises `minInstances` for `processInboxItem`, `acceptDispatch`, and `sendSMS` from 3 to 20, pre-warming capacity before the surge hits. `maxInstances` also raises. This is automatic, logged, and reverts 6 hours after the signal drops.

### 10.3 Concurrency & Cross-Document Invariants

Mutations spanning multiple documents execute inside Firestore transactions. Examples:
- `acceptDispatch`: transaction on `dispatches/{id}` + `report_ops/{reportId}` (activeResponderCount increment)
- `verifyReport`: transaction on `reports/{reportId}` + `report_ops/{reportId}` + append to `report_events/{eventId}`
- `submitResponderWitnessedReport`: transaction on `reports/{id}` + `report_private/{id}` + `report_ops/{id}` + `report_lookup/{ref}` + `report_events/{eventId}`

### 10.4 Failure Handling and Dead Letters

- **Transient infrastructure failures:** CF native retry, exponential backoff, max 5 attempts.
- **Downstream API calls with extended outage potential** (external agency dispatch APIs, SMS providers during prolonged outage): handed off to Cloud Tasks with retry windows up to 72 hours.
- **Permanent failures:** `dead_letters/{id}` with payload, correlation ID, failure category, retry history, operator action guidance.
- **Dead-letter replay** is an explicit superadmin workflow with audit logging.

### 10.5 Signed URL Hardening

`requestUploadUrl` callable:
- Enforces `Content-Type` restriction in the signed URL (only `image/jpeg`, `image/png`, `image/heic`, `image/webp`, `video/mp4`, `video/quicktime`)
- Enforces `x-goog-content-length-range` of 0–20MB for images and 0–200MB for videos — Cloud Storage rejects out-of-range uploads at the URL layer
- Signed URL expires in 10 minutes
- Per-UID rate limit: max 5 active signed URLs, max 50 uploads per hour
- On upload success, `onFinalize` trigger runs a MIME-type probe (magic bytes, not extension) and deletes the object if it doesn't match the declared type
- EXIF stripping is mandatory on all uploaded media before registration on `reports/{reportId}/media`

**Media upload lifecycle:** Uploads are managed independently from report submission using `uploadBytesResumable`, which supports pause, resume, and cancellation. A Storage object is not registered on `reports/{reportId}/media` until the `onFinalize` trigger completes EXIF stripping and MIME verification. Orphaned Storage objects — those without a registered referencing report doc after 24 hours — are deleted by the `cleanupOrphanedMedia` daily scheduled function.

---

## 11. Privacy Architecture

### 11.1 Pseudonymous Reports and Direct Contact Data

When a citizen submits without registering, the system stores no direct contact PII unless voluntarily provided for follow-up. The session is a pseudonymous Firebase UID (web) or a SHA-256 hash of the phone number (SMS). Linkage to a registered account is possible via `linkWithCredential()`.

**SMS-sourced reports are pseudonymous only to the degree that the raw msisdn is not stored.** The `reporterMsisdnHash` allows auto-reply and rate-limiting. The actual msisdn is visible transiently to the webhook function; it is **not** persisted in Firestore except as a hash. This must be documented in privacy notices.

### 11.2 Data Retention and Deletion Semantics

Reports transition through lifecycle states; they are not moved between collections.
- 6 months non-exempt → `archivedAt`, excluded from default queries
- 12 months eligible → `deletedAt` (pending purge)
- Irreversible purge within **7-day deletion SLA**, logged to `audit_logs`, verifiable in BigQuery
- `retentionExempt: true` blocks archival and purge (requires superadmin action with streaming audit)

**SMS-specific retention:** `sms_outbox` records retained 90 days for delivery audit, then purged. `sms_sessions` purged 30 days after last activity. Msisdn hashes on `report_private` follow the parent report's retention (up to 12 months).

**Responder GPS trails retention: 90 days.** Post-incident review requires this duration; a 24-hour window is insufficient for operational forensics. This must be stated clearly in privacy notices provided to responders at onboarding.

### 11.3 Data Subject Rights (RA 10173)

- **Right to access:** Registered citizens can request a data export via `exportData` callable.
- **Right to erasure:** Citizens may request immediate erasure of their registered profile and pseudonymous-link history through a workflow that creates a `deletion_request` audited by superadmin. Erasure is subject to overriding legal obligations (active investigation, etc.) which trigger `retentionExempt`.
- **Right to be informed:** In-app and submission-time notices must describe what is collected, what is shared cross-jurisdiction, and what cannot be retracted (e.g., aggregated anonymized statistics).

### 11.4 DPIA Scope

A formal Data Privacy Impact Assessment must be completed before production:

| Data class | Sensitivity | Source | Retention | Cross-border | DPIA gate |
|---|---|---|---|---|---|
| Pseudonymous UID | Low | Firebase Auth | 30d after inactivity | Singapore (Firebase) | Declare in privacy notice |
| Msisdn hash | Medium | SMS inbound | 12 months | Singapore + PH (SMS aggregator) | **Required** |
| GPS exact location | High | Client geolocation | 12 months | Singapore | **Required** |
| Voluntary contact info | High | User-provided | 12 months | Singapore | **Required** |
| Photos/videos | High | User-uploaded | 12 months | Singapore | **Required** + EXIF stripping |
| Admin notes | Medium | Staff-entered | 12 months | Singapore | **Required** |
| Responder GPS trails | High | Capacitor plugin | 90 days | Singapore | **Required** |
| SMS message bodies (inbound) | Medium | Globe Labs webhook | 90 days | PH + Singapore | **Required** |

Cross-border transfer to Singapore (Firebase `asia-southeast1`) is covered under NPC guidelines for legitimate cloud processing with standard contractual safeguards. DPIA must document this explicitly and obtain NPC concurrence if required.

---

## 12. Audit & Compliance

### 12.1 Audit Architecture

Application convenience logs may exist in `audit_logs/{logId}`; the primary audit stream is structured Cloud Logging exported to BigQuery. Application service account has no mutation permission on the audit dataset (separate IAM scope).

### 12.2 Streaming vs. Batch Split

The 5-minute batch-to-BigQuery export is acceptable for analytics and forensic reconstruction of general activity. It is **not acceptable** for security-critical events where a 5-minute gap can erase evidence during a live incident.

**Streaming-path events** (via BigQuery Storage Write API, sub-second to dataset):
- `accountStatus` changes (suspension, reactivation, disabling)
- `claim_revocations` writes
- `breakglass_events` — every use
- `cancelDispatch` when `cancelReason` is flagged sensitive
- `retentionExempt` toggles
- Cross-municipality data access events
- Superadmin reads of `report_private` and `report_contacts`
- All operations under `breakGlassSession: true`
- Command channel message writes (batch path is acceptable for these)

**Batch-path events** (5-minute schedule, cost-optimized):
- Routine dispatch lifecycle events
- Report status transitions
- Routine admin reads
- Client error telemetry
- Function invocation logs

Both paths are monitored for gap detection. Streaming path alerts at 60-second gap; batch path alerts at 15-minute gap.

### 12.3 Correlation and Forensic Reconstruction

Every privileged action, status transition, media registration, notification send, SMS attempt, and background job carries a correlation ID propagated through callable inputs, function logs, FCM messages, Cloud Tasks, and SMS provider API calls.

---

## 13. Deployment & Operations

### 13.1 Environments

`bantayog-dev` (emulators), `bantayog-staging` (pre-production), `bantayog-prod` (production). Production credentials never shared. Staff accounts separate per environment.

### 13.2 Service Level Objectives

| Metric | Target | Window |
|---|---|---|
| Citizen report acceptance latency (network present) | p95 < 3s | rolling 5min |
| Dispatch creation latency (admin click → responder FCM) | p95 < 10s | rolling 5min |
| Push delivery attempt success | > 95% | rolling 1h |
| SMS delivery attempt success (priority) | > 90% | rolling 1h |
| SMS delivery attempt success (normal) | > 80% | rolling 1h |
| Telemetry freshness (live responders) | > 90% of dispatched responders | rolling 5min |
| RPO | ≤ 24h | per incident |
| RTO | ≤ 4h | per incident |
| Audit export gap (streaming path) | ≤ 60s | continuous |
| Audit export gap (batch path) | ≤ 15min | continuous |
| Inbox reconciliation backlog | < 5 items older than 5min | continuous |
| Admin dashboard load (p95) | < 5s | rolling 1h |
| Agency assistance request response time (p95) | < 3min accept/decline | rolling 1h |
| Responder-witnessed report → municipal admin verification (p95) | < 5min | rolling 1h |

### 13.3 Backup and Recovery

- **Firestore:** daily managed exports to Cloud Storage, 30-day retention.
- **RTDB:** daily backups, 7-day retention.
- **Storage:** object versioning enabled; 12-month lifecycle on non-current versions.
- **Terraform state** versioned in GCS bucket with object versioning; state lock via GCS.
- **Firebase CLI artifacts** (rules, indexes, functions source) versioned in git with tagged releases.
- **Restore command:** `terraform apply` + `firebase deploy --project bantayog-prod`.
- **Quarterly full-stack restore drills.** A drill is successful only when raw data, security rules, indexes, function deployments, storage references, SMS provider config, and operational dashboards are all restored to a working state in staging within RTO.

### 13.4 Rollout and Rollback

- **Hosting:** instant rollback via Firebase Hosting release channels.
- **Functions:** targeted rollback via `firebase deploy --only functions:<n>` with previous version pinned.
- **Rules:** redeploy from a known-good git commit; rules history is audited.
- **Schema changes:** must be backward-compatible across one rolling deployment window. Breaking changes use the `schemaVersion` field plus a migration window where both versions are accepted by triggers.
- **Forced client upgrade:** `system_config/min_app_version` checked on app start; separate floors for citizen, responder, and admin to avoid blocking emergency reporting during a partial deploy issue.

### 13.5 Security Operations

- MFA required for all staff accounts. TOTP for staff above responder, plus phone OTP for all.
- Secrets rotation via Secret Manager, quarterly.
- Lost-device runbook.
- App version enforcement via `system_config/min_app_version`.
- Emergency access revocation < 30 seconds via force-refresh + `active_accounts` check.

### 13.6 Break-Glass Emergency Access

The problem: if the superadmin is incapacitated during a typhoon (hospitalized, phone destroyed, power out), and a province-wide emergency action is needed, the system is locked out of provincial oversight.

**The mitigation: offline-provisioned break-glass credentials.**

1. **Physical escrow.** Two sealed envelopes held by (a) the Office of the Governor, (b) the PDRRMO Director. Each contains: a pre-provisioned break-glass account email, a 20-character random password, and the TOTP seed (as QR printout).
2. **Dual-control unseal.** Two people from a named list (Governor, Vice-Governor, PDRRMO Director, Deputy Director) both call the Architecture Team on-call and authorize activation. The on-call engineer runs `initiateBreakGlass` with both authorizers' callback verification codes.
3. **Activation effect.** `accountStatus` goes to `active` for that account; `breakGlassSession: true` claim is set. The break-glass account has superadmin privileges for **4 hours**, then auto-disables.
4. **Every action is streamed.** All operations under `breakGlassSession: true` write to the streaming audit path. Every single one. A `breakglass_events/{id}` entry is written for the activation itself.
5. **Post-event review.** Within 72 hours of deactivation, an independent review of all break-glass actions is required.
6. **Drill quarterly.** The unseal procedure is drilled quarterly with fake envelopes in staging to ensure the physical chain of custody works.

This is deliberately heavy. Emergency access is the highest-risk category of privilege; the procedure is heavy precisely because it should almost never be used.

### 13.7 Monitoring and Alerting

| Signal | Threshold | Owner |
|---|---|---|
| Function error rate | > 1% over 5min | Backend on-call |
| Quota burn | > 80% of any quota | Backend on-call |
| Dead-letter growth | > 10 items/hour | Backend on-call |
| Inbox processing backlog | > 100 unprocessed items | Backend on-call |
| Stale telemetry rate | > 20% of dispatched responders | Ops on-call |
| FCM delivery failure | > 5% over 1h | Backend on-call |
| Cost anomaly | > 150% of 7-day rolling baseline | Ops + Finance |
| RTDB connection storm | > 5× baseline reconnections | Backend on-call |
| Batch audit gap | > 15min | Compliance team |
| SMS provider error rate (Semaphore) | > 5% over 5min | Backend on-call → circuit-break to Globe Labs |
| SMS delivery success (priority) | < 85% over 1h | Backend on-call |
| Inbox reconciliation backlog | > 5 items older than 5min | Backend on-call |
| Break-glass activation | Any | Superadmin + Governor's office notified |
| Streaming audit gap | > 60s | Compliance + Backend (immediate) |
| RTDB cost spike | > 5× baseline | Ops + Finance |
| Agency assistance request response time | p95 > 3min | Ops on-call |

### 13.8 System Health Surface

`/system_health` admin page polls every 30s: backend region status, function error rate, push delivery rate, SMS delivery rate per provider, SMS provider circuit-breaker state, telemetry freshness, queue depths, inbox reconciliation backlog, audit export health (streaming + batch), break-glass session active indicator.

### 13.9 Observability Dashboards

**Operations Dashboard (Ops on-call):**
- Queue depths: inbox unprocessed, dispatch pending, SMS outbox queued
- Stale telemetry rate by municipality
- Dispatch acceptance latency, agency assistance response time, responder-witness verification latency
- FCM + SMS delivery rates side-by-side

**Backend Dashboard (Backend on-call):**
- Function invocations, errors, p95 latency per function
- Dead-letter growth rate, type breakdown
- Firestore quota burn, RTDB bandwidth, Cloud Tasks queue depth and retry age

**Compliance Dashboard (Compliance officer):**
- Audit export gap (streaming + batch)
- Privileged reads of `report_private` / `report_contacts`
- Cross-municipality data access events
- Data subject erasure requests status
- Retention-exempt records count
- Break-glass activations (lifetime + rolling 90 days)

**Cost Dashboard (Ops + Finance):**
- Daily spend by service (Firestore, Functions, Storage, RTDB, SMS Semaphore, SMS Globe Labs separately)
- 7-day rolling baseline and anomaly detection
- Surge pre-warm instance hours (attributable to typhoon signals)
- Per-municipality cost allocation

Alerts without runbooks are noise and must be downgraded or removed.

### 13.10 Regional and Disaster Strategy

Primary: `asia-southeast1`. Multi-region Firestore out of scope. Degraded-mode runbook covers regional outage with SMS and paper fallback. Citizens can be directed to SMS submission even when the web app is unavailable.

---

## 14. Testing Strategy

Testing prioritizes failure behavior over coverage percentages.

| Layer | Tool | Target |
|---|---|---|
| Unit | Vitest | Domain logic, validation, state-machine transitions |
| Security rules | Firebase Emulator + Vitest | Positive AND negative cases per rule; cross-muni leakage attempts; agency write-to-other-agency-responder attempts must fail; responder write-to-another-responder's-dispatch must fail. CI fails if any rule lacks negative tests. |
| RTDB rules | Firebase Emulator | Positive + negative for every path; timestamp validation; cross-role scoping; cross-agency projection read permissions |
| Integration | Emulator + staging | Callable commands, retries, dedup, event fan-out, restore compatibility |
| E2E | Playwright + real-device smoke tests | Critical workflows under reconnect, permission revocation, stale claims, failed push, app restart during queue replay |
| Load | k6 + synthetic replay | Surge patterns beyond expected peak: 500 concurrent citizen submits, 100 admin dashboards, 60 GPS streams, duplicate submissions, notification bursts, websocket reconnection storms |
| Chaos / resilience | Scripted fault injection | Network loss mid-submission, delayed retries, dead-letter growth, regional dependency drills, FCM degradation |

Success criteria are scenario-based and tied to §13.2 SLOs, not coverage percentages.

**Pilot-blocker scenarios:**

1. Two responders accept same dispatch within 100ms (one offline) → exactly one wins.
2. Citizen on 2G submits, locks phone, reopens 2h later → `server_confirmed` within 60s.
3. Suspended admin's token refresh within 60s of suspension.
4. Cross-municipality read attempt rejected at rule layer.
5. Audit export pause 30min → alert + backfill.
6. RTDB websocket reconnection storm → cost stays within 5×.
7. IndexedDB eviction during offline draft → localForage recovers the draft on reopen; report submits successfully.
8. Feature-phone user texts `BANTAYOG FLOOD CALASGASAN` → parse succeeds, report materializes, auto-reply sent.
9. Semaphore returns 500 for 30s → circuit-breaker flips to Globe Labs, no alerts dropped, Semaphore re-enters rotation when healthy.
10. `processInboxItem` fails for a specific inbox item (simulated) → reconciliation sweep retries within 5 minutes, no dead-letter.
11. 100,000-recipient mass alert → routes as NDRRMC escalation, not direct blast; `sendMassAlert` callable refuses direct send.
12. Break-glass drill: dual-control → 4h session → auto-deactivation → audit trail complete and verifiable in streaming path.
13. Responder stationary 4h at staging → battery drop <15% vs 40%+ with naive GPS polling.
14. Typhoon pre-warm on Signal-2 → `minInstances` raised → verified warm → reverts 6h after signal drops.
15. Agency admin attempts `verifyReport` callable → rejected with `PERMISSION_DENIED`; rule test confirms.
16. Responder submits witness report in municipality outside `permittedMunicipalityIds` → report created with `crossJurisdictionFlag: true`, superadmin notified.
17. Responder-witness report → municipal admin sees "Responder-Witnessed" badge → verifies → p95 verification < 5min in drill.
18. Municipal admin attempts mass alert with 15,000 estimated recipients → UI routes as NDRRMC escalation.
19. Agency admin revokes responder access → responder's next authenticated call fails; offline-cached data unreadable.
20. Citizen-facing UI never renders `actorId` on any report event, only institutional labels. Regression test across all report state transitions.
21. Shift handoff not accepted within 30min → superadmin alerted.
22. Agency assistance request not responded to within 30min → auto-escalates to superadmin.
23. Two municipal admins simultaneously attempt to merge overlapping duplicate clusters → one wins via transaction, other retries with refreshed state.
24. Responder "Unable to complete" → report returns to admin queue → admin reassigns → audit trail continuous across dispatch supersession.

---

## 15. Risks & Residual Reality

| Risk | Residual Reality | Mitigation |
|---|---|---|
| Regional cloud outage | Real-time backend unavailable | Degraded-mode runbook, SMS-only fallback workflow, paper forms, communications plan |
| Mobile background execution degraded | Telemetry stale silently | Silent-device detection, stale-state UI, permission recovery, operator alerts |
| Cross-jurisdiction data leakage | RA 10173 failure | Scoped rules, negative tests in CI, access reviews, least-privilege defaults, moderation logging |
| Abuse / false reporting | App Check insufficient alone | Rate limits (per-UID, per-msisdn), moderation workflow, token hardening, anomaly detection |
| Deletion incompleteness | Soft-delete ≠ purge | 7-day SLA, completion logging, BigQuery verification |
| Duplicate side effects | Retries can multiply work | End-to-end dedup keys, event idempotency, replay-safe handlers |
| Backup restore mismatch | Raw data restore ≠ full system | Quarterly full-stack restore drills including Terraform/Firebase CLI |
| JWT staleness | Up to 60min window | Three-layer mitigation (§4.3) |
| Dispatch split-brain | Two responders both believe they accepted | `pending→accepted` is server-authoritative (§5.4) |
| Inbox abuse / DoS | Direct-write inbox more exposed | Per-UID rate limits + App Check + reconciliation sweep + surge pre-warm |
| RTDB reconnect cost explosion | Websocket churn under outage | Jitter, backoff, 5× cost alert |
| BigQuery audit gap | Pipeline failure = blind | Streaming path for critical events (60s gap alert), batch for analytics (15min alert) |
| Cyclone-driven extended outage | Multi-day cell coverage loss | Cloud Tasks 72h retry, paper fallback, post-restoration reconciliation |
| IndexedDB eviction wipes draft | Silent loss on iOS | Dual-write to localForage + SMS fallback prompt + tracking reference as paper fallback |
| Inbox trigger cold-start timeout | Citizen report stuck in inbox | `minInstances: 3` + concurrency 80 + reconciliation sweep + surge pre-warm |
| GPS battery drain killing responders mid-shift | Responders become uncontactable | Motion Activity API + geofence-at-staging + 10-min GPS at low battery |
| Security event lost to 5-min audit gap | Forensic blind spot during incident | Streaming audit path for suspensions, revocations, break-glass |
| Signed URL abuse (5GB upload DoS) | Storage quota exhaustion | `x-goog-content-length-range` + MIME restriction + per-UID rate limit + magic-byte verification |
| Superadmin incapacitated mid-emergency | No provincial oversight | Break-glass dual-control with 4h time-limited session |
| SMS provider outage during mass alert | Life-safety channel silent | Semaphore + Globe Labs dual-provider circuit-breaker |
| Client state inconsistency (cache soup) | Ghost states, duplicate fetches, stale listeners | State Ownership Matrix (§9) enforced in code review |
| SMS inbound abuse (spam from feature phones) | Moderation queue overwhelmed | Per-msisdn rate limit + elevated moderation default + keyword validation + duplicate-cluster detection |
| Role capability drift between UI and rules | UI shows a button the rules reject → user confused, audit noisy | Capability contract tests: every UI action maps to a rule check; CI enforces |
| Verified Responder Report abuse | Responders create fake reports | 10/24h rate limit + GPS + photo required + audit trail + superadmin review of cross-jurisdiction flags |
| Agency assistance requests pile up during surge | Municipal admin blocked waiting | 30-min auto-escalate to superadmin; pending age shown prominently |
| Admin without connectivity tries to write | Silent queuing creates stale mutations replayed out of order | Admin Desktop explicitly blocks writes when offline |
| Command channel messages leak between incidents | PII or operational info crosses incident boundaries | Thread ID tied to report; membership controlled by incident stake; rule tests for negative cases |
| Admin identity not enforced at data layer | Citizen discovers admin UID through aggregation | `report_lookup` and citizen-facing listeners never include actor fields; CF-projected from `report_events` with stripping |
| Cross-agency projection staleness | Agency Admin sees outdated other-agency responder position | 90s TTL on projection entries; "last updated X ago" on ghosted markers |
| Shift handoff never accepted | Incoming admin doesn't see notification | 30-min escalation to superadmin; handoff doc persists even if unread |
| SMS content policy drift | Admin composes message with emoji/shortener; aggregator rejects | Server-side sanitization in `sendSMS` abstraction; UI preview shows exactly what will send |

---

## 16. Open Risks Pilot Must Validate

1. iOS PWA storage eviction real-world rate — localForage + SMS fallback are hypotheses until measured.
2. External agency API readiness — Cloud Tasks 72h retries assume eventual recovery; some agencies have no APIs.
3. MFA adoption friction with field staff — may need hardware token alternative.
4. Tracking-secret loss rate — pilot decides if in-person recovery workflow is needed.
5. Cost under real surge — estimates remain non-binding; $5k/month emergency ceiling pre-approved.
6. SMS provider reliability during a real typhoon — both Semaphore and Globe Labs may degrade simultaneously during cell tower loss.
7. Feature-phone SMS parsing accuracy in Tagalog/regional spelling variants — pilot measures parse failure rate and auto-reply helpfulness.
8. Break-glass drill fidelity — the quarterly drill must prove the physical procedure works, not just the technical callable.
9. Battery-life validation on real responder devices — the 12+ hour target is theoretical until measured with the specific phones issued to Camarines Norte responders.
10. Agency assistance response time — does the 30-min auto-escalate threshold match operational reality, or does it need to be per-agency configurable?
11. Verified Responder Report usage rate and accuracy — does the 10/24h rate limit match legitimate field use? Is the priority-flag actually speeding verification?
12. Command channel thread adoption — do admins actually use it, or do they default to phone calls bypassing audit?
13. Cross-agency projection cost and latency — does 30s sampling hold up at 203+ active responders province-wide?
14. Municipal mass alert routing friction — when does the 5,000 threshold surprise an admin who thought they could blast their municipality?
15. Responder-app Capacitor upgrade cycle — how painful is pushing a new APK/IPA to active responders during an operational period?

Production hardening revisits this document only after pilot data exists.

---

## 17. Access Model Summary

System defines access by **data class**, not collection name. New collections must declare data class, permitted roles, sharing conditions, and rule block with negative tests before implementation.

| Data Class | Permitted Roles | Conditions |
|---|---|---|
| Public alertable (feed, alerts, public map) | All authenticated (including pseudonymous) | Institutional attribution only |
| Restricted operational (reports, dispatches) | Municipal admin of muni; agency admin of assigned agency; assigned responder | `isActivePrivileged()` required |
| Restricted personal (`report_private`, `report_contacts`) | Data subject; municipal admin of muni (with streaming audit); superadmin (with streaming audit) | |
| Responder telemetry — RTDB full fidelity | Self; municipal admin of muni; agency admin of agency; superadmin | Active status required |
| Responder telemetry — cross-agency projection | All admin roles | 100m grid, 30s sampled |
| SMS audit (`sms_outbox`, `sms_inbox`, `sms_sessions`) | Superadmin only | Streaming audit on every read |
| Break-glass audit (`breakglass_events`) | Superadmin + Governor's Office designated reviewer | Append-only |
| Agency assistance requests | Requesting muni admin; target agency admin; superadmin | |
| Command channel threads | Participating admins; superadmin | Tied to incident |
| Shift handoffs | From/to admins; superadmin | |
| Audit data (BigQuery) | Separate IAM; superadmin read via documented request path | |

---

## 18. Decision Log

| # | Decision | Rationale | Rejected Alternative | Residual Cost / Risk |
|---|---|---|---|---|
| 1 | Report triptych | Document-level security boundary | Single doc + field masking | Multi-doc transactions, eventual-consistency window |
| 2 | Pseudonymous Auth universal | UID for rules + App Check for all | Unauthenticated reads | Pseudonymity ≠ anonymity; must communicate honestly |
| 3 | Mixed-mode writes | Server-authoritative for contended; direct for sequential | All-CF | UX must distinguish queued vs server-confirmed |
| 4 | Capacitor for responders | Better mobile capability than PWA-only | PWA-only | Native wrapper reduces but doesn't eliminate background issues |
| 5 | App Check | Reduces abuse from non-genuine clients | Device fingerprinting | Not a trust boundary |
| 6 | RTDB for GPS | Bandwidth-priced, native real-time | Firestore-only | Reconnect storms; rules required |
| 7 | Soft-delete retention | Firestore cannot recursively move subcollections | Archive collection | Deletion completion lag; SLA + audit needed |
| 8 | BigQuery audit | Better durability than Firestore-only | Firestore-only audit | Pipeline depends on export health |
| 9 | Dispatches source of truth | No dual-representation sync bugs | `dispatchedTo[]` array | Read amplification; denormalization needed |
| 10 | State machine in rules + server | Rules prevent invalid transitions; server validates cross-doc | Rules-only | Some logic duplication |
| 11 | Denormalize auth fields onto guarded docs | Rules can reference `resource.data` | `get()` lookups | Write amplification |
| 12 | No device fingerprinting | RA 10173 risk; brittle | Fingerprint hash | App Check less precise |
| 13 | Inbox + trigger for citizen submission | Firestore SDK offline persistence beats custom callable queue | `submitReport` callable | Inbox more exposed; rate limits + trigger validation required |
| 14 | `pending→accepted` is callable | Prevents split-brain | Direct write with rules | Acceptance requires online |
| 15 | `active_accounts` on privileged paths only | Bounds JWT staleness without amplifying cost on broad reads | Check-on-every-read | 1 extra read per privileged op |
| 16 | `trustScore` excluded until NPC-compliant governance is drafted | RA 10173 profiling exposure without governance | Keep as advisory field | Manual triage only |
| 17 | Cloud Tasks for downstream API calls | 72h retry windows | CF native retry | Additional infra |
| 18 | Tracking reference + secret separated | Human-readable ref not a credential | Single token | Users must store secret |
| 19 | Denormalize `status`/`severity`/`createdAt` onto `report_ops` | Cross-cutting admin queries possible | Client-side join | Mirrored fields require transactional updates |
| 20 | MFA required for all staff | Field accounts are targets too | Superadmin-only MFA | TOTP friction |
| 21 | Semaphore primary + Globe Labs failover for SMS | Domestic aggregators, 20× cheaper than Twilio, better PH telco compliance | Twilio (Firebase Extension available) | Dual-provider ops; circuit-breaker required |
| 22 | Inbound SMS via Globe Labs keyword → `report_inbox` | Feature-phone + zero-data citizens reachable; unified ingestion | Separate inbound SMS pipeline | Per-msisdn rate limits; barangay-only precision |
| 23 | localForage dual-write for citizen drafts | Firestore SDK alone vulnerable to IndexedDB eviction | Firestore SDK only | Reconciliation logic; two storage layers to monitor |
| 24 | `minInstances: 3` for `processInboxItem` + reconciliation sweep | Cold-start surge failure would drop reports; reconciliation is safety net | Scale from zero | ~$45-60/mo idle cost; typhoon pre-warm adds more |
| 25 | Motion Activity API + geofence-at-staging for responders | GPS-speed inference kills batteries over long shifts | GPS-speed motion detection | Plugin dependency; motion-API accuracy varies by device |
| 26 | Streaming audit for security events, batch for analytics | 5-min gap unacceptable for suspensions/revocations during incident | All-batch | Higher BQ streaming cost on critical events; worth it |
| 27 | Break-glass sealed credentials with dual-control unseal | Superadmin incapacitation during typhoon cannot lock out province | Only named superadmin has access | Physical chain of custody; quarterly drill; post-event review |
| 28 | State Ownership Matrix enforced in code review | Cache soup across Firestore/TanStack Query/Zustand is a real failure mode | Implicit ownership | Requires review discipline |
| 29 | Report lifecycle state machine formalized (13 states) | Dispatch-only state machine left report transitions implicit and untested | Implicit report transitions | More state to test; rule updates for every transition |
| 30 | Terraform + Firebase CLI as named IaC stack | "Version-controlled" isn't a command | Firebase CLI alone | Terraform state management overhead |
| 31 | Signed URL size/MIME/content-range enforcement | 5GB DoS upload risk without it | Client-side size check | More complex URL issuance logic |
| 32 | Stay on Firebase; no Postgres migration until triggers fire | Single developer, pilot scope; migration is 3+ months of work with no pilot data yet | Hybrid with Postgres for dispatch core | Document-store ceiling acknowledged; migration triggers defined (§19) |
| 33 | Defer province-wide mass alerting to NDRRMC ECBS | RA 10639 assigns this channel to NDRRMC; ECBS is cell broadcast (near-instant, point-to-multiple-point); commercial SMS aggregators are slower, pricier, legally awkward at that scale | Blast 100k+ SMS via Semaphore | Must build + maintain escalation workflow with PDRRMO → NDRRMC |
| 34 | Three deployment surfaces, not one app | Citizen/Responder/Admin have incompatible offline, auth, and device profiles | Monolithic PWA | 3× build targets, shared packages discipline required |
| 35 | Agency admins do NOT verify reports | Clean state machine; matches PH LGU doctrine; prevents verification races | Agencies verify in their jurisdiction | Muni admin is bottleneck during surge; pre-warm + reconciliation mitigate |
| 36 | Verified Responder Report = accelerated intake, not bypass | Legitimate field-witness case without compromising LGU verification | Full bypass (skip `awaiting_verify`) | Still requires admin tap; trade speed for review |
| 37 | Admin Desktop does NOT queue offline writes | High-stakes mutations silently replayed out of order is worse than blocking | localForage outbox for admins too | Admins must be online for mutations; field mode is explicit exception |
| 38 | Citizen-facing projection strips `actorId` | Admin identity hidden at data layer, not just UI | Rely on UI to hide | CF projection adds complexity; worth it for rule-level enforcement |
| 39 | Cross-agency responder visibility via RTDB projection | Privacy-preserving (100m grid) + cost-bounded + enables coordination | Full RTDB cross-reads | Projection staleness bounded by 30s cadence + 90s TTL |
| 40 | Municipal mass alerts route through Reach Plan | Surfaces SMS-vs-ECBS decision to admin before send | Silent routing based on thresholds | UI complexity; admin must understand channels |
| 41 | Agency assistance requests are first-class documents | Audit trail for inter-agency coordination; timeout escalation | Informal via command channel | New collection + rules + callables |
| 42 | No Facebook Messenger integration for any role | RA 10173 data residency, no SLA, no audit hook, unreliable in degraded networks | Keep as fallback per responder spec | Responders must use in-app messages + PSTN calls |
| 43 | Responder GPS retention: 90 days, not 24h | Post-incident review needs it; 24h is insufficient | 24h | Privacy notice must state clearly |
| 44 | Session timeout is re-auth interval, not token TTL | Firebase ID tokens are 1h regardless; "timeout" at app layer means prompt-for-OTP | Hard-expire sessions at 8h | Requires explicit handling at app level |
| 45 | No "Incident Commander" tag | Existing state machine answers every operational ownership question; ambiguous tag with no transition rules adds vocabulary without clarity | Incident Commander role for inter-agency conflicts | Conflicts resolved via Command Channel threads |

---

## 19. The Postgres Question: When to Migrate, and Why Not Now

The system stays on Firebase for the current pilot phase. Migrating before pilot data exists means migrating on theory. The document-store ceiling — where Firestore's lack of joins and transactional guarantees actually hurts — hasn't been hit yet at 600k population scope.

**Why not migrate now:**
- Team capacity. This is a single-developer project. Introducing Postgres means migrations layer, connection pooling, read replicas, backup rotation, separate IaC, separate monitoring — a full-time ops person's worth of new work before any user value is delivered.
- Cost structure. Firebase pricing scales with usage; a Postgres core on AlloyDB has a baseline cost floor (~$300/month minimum for a small HA configuration) that dominates at pilot scale.
- Rollback risk. If the migration goes wrong mid-deployment, the emergency system is the thing going wrong. Not an acceptable failure mode before pilot stability is proven.

**Named migration triggers.** The architecture moves toward a hybrid Firebase + Postgres core when **any two** of these are observed in production for 30+ consecutive days:

| Trigger | Threshold | Why it signals Postgres |
|---|---|---|
| Admin dashboard p95 load time | > 5 seconds | Firestore client-side join cost exceeded |
| Concurrent active dispatches province-wide | > 500 sustained | Contention on dispatch collection |
| Cross-collection reporting queries per day | > 1,000 | BigQuery batch too slow for operational reporting |
| Firestore document update amplification | > 10× write fan-out per business event | Denormalization cost exceeds relational cost |
| Cost of Firestore reads | > ₱50,000/month (~$900) | Relational DB cost model becomes more favorable |
| Dispatch state machine needing multi-table FK enforcement | Any compliance-mandated case | Firestore cannot enforce FK; Postgres can |
| Regulatory requirement for SQL-based audit access | Any formal government audit request | Relational reporting tools assumed |

**What a hybrid would look like (for planning, not current scope):**
- Firestore stays authoritative for real-time views, offline sync, mobile-first reads, citizen-facing data.
- Postgres (AlloyDB) takes authoritative dispatch state, incident lifecycle, reporting/analytics, relational audit queries.
- CDC via Datastream replicates Postgres writes to Firestore read models so mobile clients don't talk to Postgres directly.
- Dispatch callables write to Postgres first, then materialize to Firestore on success.
- Migration window: 6-9 months with staged cutover per municipality.

---

## 20. Pilot Acceptance Criteria

The following must be demonstrated before production expansion beyond the pilot municipality:

1. Citizen offline submission survival rate on real iOS and Android devices in mountainous barangays
2. Dispatch acceptance latency under realistic responder concurrency
3. Active-account rule check cost impact on admin dashboards
4. RTDB cost behavior during real connectivity disruption
5. Audit export pipeline reliability over 30+ continuous days (both streaming and batch)
6. MFA adoption among field staff
7. Tracking-secret retention by anonymous citizens (loss rate)
8. Dead-letter accumulation patterns and operator response times
9. End-to-end latency from citizen submit to FCM + SMS alert delivery during a controlled drill
10. SMS inbound parse accuracy across Tagalog and regional spelling variants
11. Semaphore + Globe Labs circuit-breaker behavior under simulated provider degradation
12. localForage draft recovery after forced IndexedDB eviction on iOS
13. Responder battery life at real staging durations (target: 12+ hours)
14. Inbox reconciliation sweep catching injected trigger failures within SLA
15. Break-glass drill fidelity (dual-control, 4h auto-expire, audit trail)
16. Cost under real surge with typhoon pre-warm engaged
17. State Ownership Matrix discipline holding across the codebase under code review
18. Role capability contract tests pass 100% — every UI action maps to a rule-enforced callable or direct write, CI-verified
19. Three-surface build pipeline produces three distinct deployables reproducibly from a clean tag
20. Responder-witness report drill: responder submits → municipal admin verifies → dispatch → resolution, full audit trail, p95 verification < 5min
21. Agency assistance workflow drill: muni requests → agency accepts → dispatches → resolves, latency measured end-to-end
22. Mass alert reach plan preview accuracy: estimate within ±10% of actual recipient count post-send
23. NDRRMC escalation workflow: tabletop drill with PDRRMO Director exercising full submission → forward → receipt → audit flow, latency baseline established
24. Cross-agency projection accuracy: during a live multi-agency incident, all agency admins see peer responders with <90s staleness and <100m positional uncertainty
25. Shift handoff discipline: 30-day measurement of admin handoff acceptance rate, < 10% unaccepted handoffs required for production

---

## 21. What This Spec Is Not

- **Not a UX spec.** Layouts, pixel-precise designs, exact copy, and icon choices remain in the role specs or in a forthcoming design system. This spec defines capabilities, boundaries, and data; the design team chooses how to express them.
- **Not an API reference.** Callable signatures are named here; their exact schemas live in `packages/shared-validators` (Zod) and are source-of-truth when implementation disagrees with prose.
- **Not a runbook.** Operational procedures (break-glass drill, restore drill, degraded-mode) have their own living documents under `docs/runbooks/`.
- **Not immutable.** The §18 Decision Log is the right place to reopen a decision. New decisions go below #45 with rationale. Version 8 will happen after pilot data exists.

---

**End of Architecture Specification v7.0**
