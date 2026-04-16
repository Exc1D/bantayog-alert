# Bantayog Alert — Software Architecture Specification

**Version:** 5.0 (Post Senior-Architect Review; SMS Fallback Integrated)
**Date:** 2026-04-16
**Status:** Pilot-Ready Architecture Draft — Production Hardening Required Before Emergency-Service Dependence
**Author:** Architecture Team
**Stack:** React 18 + Vite + Firebase + Leaflet + Zustand + TanStack Query + Capacitor + Semaphore/Globe Labs (SMS)

---

## 1. Context & Driving Forces

### 1.1 What This System Is

Bantayog Alert is a crowd-sourced disaster reporting and real-time coordination platform for the Province of Camarines Norte, Philippines (12 municipalities, ~600,000 population). Citizens report emergencies; municipal administrators triage and dispatch responders; specialized agencies coordinate tactical response; the provincial PDRRMO maintains province-wide situational awareness.

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
10. **State has exactly one authority per category.** The client must not have multiple sources of truth for the same data. Each data class is assigned to one store (§9.1.1).

---

## 2. System Overview

### 2.1 Deployment Architecture

| Component | Platform | Why |
|---|---|---|
| Citizen app | PWA (React) | No app store barriers; SDK offline queue survives app restarts on Android; iOS limitations accepted with SMS fallback |
| Citizen SMS interface | Inbound via Globe Labs keyword routing; outbound via Semaphore | Reaches feature phones and zero-data users; survives PWA storage eviction |
| Admin apps | PWA (React) | Desktop-first, no install needed |
| Responder app | Capacitor-wrapped web app with native plugins | Required for background-capable location updates, richer notification handling, device-level permissions; **does not guarantee uninterrupted background execution** |
| Backend | Firebase (Firestore, RTDB, Functions, Auth, Storage, FCM, App Check, Cloud Tasks) | Real-time, offline-first, security rules, durable async retry windows |
| SMS layer | Semaphore (primary) + Globe Labs (failover) | Domestic aggregators; better rates, telco compliance, last-mile reliability vs Twilio |

**Why PWA-only is acceptable for citizens (with SMS fallback):** The Firestore SDK's IndexedDB-backed offline persistence durably queues writes across app restarts on Android. iOS PWAs have known service-worker eviction risk under storage pressure. Rather than force Capacitor on every citizen, we accept PWA limitations and provide SMS as the universal fallback channel. Every outbound-critical alert fans out on both FCM and SMS.

**Why Capacitor for responders:** PWA is insufficient for responder workflows because iOS and Android both impose background execution and notification constraints. A Capacitor wrapper allows native background-location APIs, richer notification handling, foreground services on Android, and improved device observability. It reduces — but does not eliminate — mobile OS constraints.

### 2.2 Technology Stack

| Layer | Technology | Why |
|---|---|---|
| UI Framework | React 18 | Concurrent rendering for real-time updates |
| Build Tool | Vite | Fast builds, optimized code splitting |
| State (UI ephemeral) | Zustand | Lightweight; UI-only, no server data |
| State (server cache) | Firestore SDK local persistence | **Single authoritative server cache** |
| State (query orchestration) | TanStack Query | Non-Firestore HTTP calls, callables, derived views |
| State (outbound queue + drafts) | localForage | Dual-write with Firestore SDK for draft durability |
| Maps | Leaflet + OpenStreetMap | Open source, free, offline tile caching |
| Database (structured) | Firestore | Real-time listeners, offline persistence, security rules |
| Database (GPS) | Firebase Realtime Database | Bandwidth-priced for high-frequency location |
| Auth | Firebase Auth | Custom claims, anonymous (pseudonymous) auth, MFA |
| Client integrity | Firebase App Check | Reduces abuse from non-genuine clients |
| Storage | Cloud Storage for Firebase | Resumable photo/video uploads |
| Functions | Cloud Functions v2 (Node.js 20) | Server-authoritative writes, triggers, scheduled jobs |
| Long-window async | Cloud Tasks | Multi-day retry windows for downstream API calls during outages |
| Push | Firebase Cloud Messaging | Dispatch notifications, SOS, in-app mass alerts |
| **SMS outbound** | **Semaphore API (primary) + Globe Labs (failover)** | **Mass alerting, citizen status, responder fallback; 20x cheaper than Twilio for PH delivery** |
| **SMS inbound** | **Globe Labs keyword routing → Cloud Function webhook** | **Citizens on feature phones; zero-data emergency reports** |
| Responder native | Capacitor + `@capacitor-community/background-geolocation` + Motion Activity plugin | Background GPS, foreground services, hardware motion detection |
| Audit export | Cloud Logging → BigQuery (5-min batch + streaming for security events) | Durable, separately governed audit trail with low-latency security path |
| IaC | **Terraform for GCP/IAM/BigQuery; Firebase CLI for rules/functions/indexes** | Named, reproducible infrastructure recovery |

**Selection boundaries.** App Check is an abuse-reduction control, not a trust boundary. TanStack Query is a cache and orchestration layer for non-Firestore calls, not a consistency layer. Firestore SDK cache is the authoritative client-side view of server state — never TanStack Query or Zustand. Capacitor improves access to native capabilities but does not guarantee background execution. BigQuery audit export improves durability but does not remove the need for retention-policy control, privileged-access monitoring, and export health checks. Custom claims are a performance optimization for authorization; they are not a revocation channel. **SMS is a delivery attempt, not a delivery guarantee** — telcos may queue messages during congestion and drop after TTL.

### 2.3 SMS Architecture (New in v5)

SMS serves **four distinct purposes**, each with different reliability requirements and authority boundaries:

1. **Targeted citizen status updates** (outbound, one-to-one). *"Your report has been received, reference 2026-DAET-0471. Responders dispatched."* Low volume, ordinary queue. This is the highest-volume legitimate use.
2. **Barangay / municipality-scoped operational advisories** (outbound, bounded broadcast, typically < 5,000 recipients). *"Barangay Calasgasan residents: road flooding on Maharlika Hwy km 12; avoid route. Municipal response team dispatched."* Localized, operational, within provincial authority. These go via Semaphore priority queue.
3. **Province-wide mass alerts → ESCALATE to NDRRMC ECBS, do NOT send ourselves.** For anything requiring province-wide or multi-municipality reach ("Signal No. 3, evacuate immediately"), the system **requests escalation** to NDRRMC/PAGASA through an integration workflow (see below). We do not attempt to blast 600,000 SMS via a commercial aggregator — that is slower, more expensive, and legally awkward under RA 10639 which assigns this channel to NDRRMC + telcos operating ECBS.
4. **Inbound citizen reports** (inbound). A feature-phone user texts `BANTAYOG <TYPE> <BARANGAY>` to a shared keyword. Globe Labs routes the SMS to a Cloud Function webhook that writes to `report_inbox` — the same collection the web app writes to. Unified ingestion.

**NDRRMC escalation workflow** (for purpose #3). The `requestMassAlertEscalation` callable captures: draft message, target areas (municipality or province-wide), hazard class, evidence pack (linked reports, PAGASA reference if applicable). This creates a `mass_alert_requests/{id}` document and notifies the PDRRMO Director via priority SMS. PDRRMO escalates to NDRRMC Regional (Region V) through their existing channels. ECBS dispatch remains with NDRRMC. Bantayog records the escalation for audit and tracks NDRRMC's response timestamp to measure end-to-end. **Critically: the system must not claim to have issued an ECBS alert.** The UX distinguishes "escalation submitted to NDRRMC" from "sent via our SMS layer."

**Provider choice.** Semaphore primary, Globe Labs secondary, based on these grounded facts:

- Semaphore charges ~₱0.50 (~$0.009) per SMS, versus Twilio at $0.2001 per SMS — over 20x more expensive for Philippine delivery. For a 100,000-recipient province-wide alert, that's ~₱50,000 via Semaphore versus ~₱1,100,000 via Twilio.
- Semaphore's priority queue bypasses the default message queue for time-sensitive messages at 2 credits per 160 characters, routed on SMS paths dedicated to OTP traffic that arrive even when telcos are experiencing high volumes. Emergency alerts use the priority queue.
- Globe Telecom has blocked VRN and long codes for A2P SMS, requiring alphanumeric sender IDs only, and Smart is blocking messages containing URL shorteners like bit.ly due to smishing attacks. Domestic aggregators handle sender ID registration with the telcos; Twilio handles it abstractly. This matters for getting an approved `BANTAYOG` sender ID that actually delivers.
- Globe Labs provides both outbound sending **and** inbound keyword routing; Semaphore is outbound-only. Globe Labs is therefore required regardless, so using it as the outbound secondary adds no new vendor surface.

**The SMS abstraction layer.** A single Cloud Function callable/internal API `sendSMS(to, body, priority, purpose)` hides provider details from all callers. Circuit-breaker logic: if Semaphore returns errors or its p95 latency exceeds 30s over a 5-minute window, new sends route to Globe Labs; a health probe continues hitting Semaphore to decide when to return. Every attempt is logged to `sms_outbox/{id}` with delivery-report callbacks from both providers writing back status. This isolates the rest of the architecture from provider swaps.

Content rules enforced in the abstraction:
- Alphanumeric sender ID only (telco requirement, not a Twilio-style from-number)
- No URL shorteners (Smart blocks them) — only full destination URLs, or no URL at all
- Unicode unsupported by Semaphore; messages must be ASCII-only. Tagalog ASCII text is fine; emojis and special characters are stripped at the abstraction layer with a warning log.
- 160-character segments counted; long alerts split with `(1/3)` `(2/3)` `(3/3)` footers. A long alert at 480 characters is 3 priority credits × 6 centavos ≈ ₱0.18 per recipient at list price.

**Inbound format (feature-phone users).** Users text `BANTAYOG <TYPE> <BARANGAY>` to the keyword, e.g. `BANTAYOG FLOOD CALASGASAN`. Parser extracts type and barangay, creates a `report_inbox/{id}` with `{source: 'sms', fromMsisdn, rawBody, parsedType, parsedBarangay, clientCreatedAt}`. If parsing fails, the system auto-replies requesting the correct format. Location precision is at barangay granularity only; exact GPS isn't available from SMS, and admins triage these reports separately with a `requiresLocationFollowUp: true` flag.

**Why not Twilio despite the Firebase Extension:** The Twilio Firebase Extension is convenient (drop a Firestore document, extension sends SMS, extension records delivery status). We evaluated it and rejected it for this project on three grounds: (a) cost — 20x+ higher per SMS for PH delivery; (b) compliance — Twilio's sender ID handling for PH is less direct than domestic aggregators; (c) disaster reliability — international A2P hops are more likely to be throttled by local telcos under congestion than domestic aggregator routes. The extension pattern (document-triggered send) is still a good idea; we implement the same pattern with our own Cloud Function that calls Semaphore/Globe Labs instead of Twilio.

---

## 3. Identity & Authentication Model

### 3.1 Pseudonymous Session Identity Is Universal

Every client session receives a Firebase Auth identity on app launch. Unregistered citizens are issued an anonymous Firebase Auth account via `signInAnonymously()`. This creates a **pseudonymous** session identifier used for security rules, abuse controls, queue ownership, and traceability.

**Privacy-language commitment:** Anonymous Firebase Auth is **not** equivalent to guaranteed real-world anonymity. It provides a pseudonymous technical identity that may later be linked to a registered account via `linkWithCredential()` if the user chooses to upgrade. Privacy notices must reflect this honestly.

| Identity Level | Auth Method | UID | Can Submit | Can Track | Can Read Alerts |
|---|---|---|---|---|---|
| Pseudonymous citizen session | Firebase Anonymous Auth (auto) | Yes (temporary) | Yes (via inbox) | Via tracking secret | Yes (alerts only) |
| SMS-identified citizen (phone number) | Inbound SMS maps to `sms_sessions/{msisdn_hash}` | Implicit | Yes (via SMS) | Via SMS lookup keyword | Via SMS alerts |
| Registered citizen | Phone OTP (links existing pseudonymous UID) | Yes (persistent) | Yes | Full history | Yes |
| Responder | Managed staff account + MFA | Yes | No | N/A | Yes |
| Municipal Admin | Managed staff account + MFA | Yes | No | N/A | Yes |
| Agency Admin | Managed staff account + MFA | Yes | No | N/A | Yes |
| Superadmin | Managed staff account + MFA + TOTP | Yes | No | N/A | Yes |

### 3.2 Anonymous Report Tracking — Reference vs. Secret

Anonymous citizens receive **two values** at submission:

1. A **public tracking reference** like `2026-DAET-0471` — human-readable, shareable, not sufficient alone.
2. A **tracking secret** — ≥128-bit high-entropy string, delivered once, stored in client local storage, surfaced for the user to save.

Status lookup via `lookupReportByToken` callable requires both. Rate-limited per IP and per UID. App Check protected. Direct Firestore reads are not used for anonymous status lookup.

SMS-submitted reports receive the tracking reference back via auto-reply SMS; the tracking secret for SMS users is a shorter 6-digit PIN (lower entropy, bounded by per-msisdn rate limits on the lookup endpoint).

### 3.3 Custom Claims

```typescript
interface CustomClaims {
  role: 'citizen' | 'responder' | 'municipal_admin' | 'agency_admin' | 'provincial_superadmin';
  municipalityId?: string;
  agencyId?: string;
  permittedMunicipalityIds?: string[];
  mfaVerified: boolean;
  claimsVersion: number;
  accountStatus: 'active' | 'suspended' | 'disabled';
  responderType?: string;
  breakGlassSession?: boolean;  // NEW: flagged true for emergency-provisioned access
}
```

Claims refresh on sign-in, privileged role change, and explicit revocation events. Authorization decisions fail closed when claims are missing, stale, or inconsistent with server-side account status.

### 3.4 Bounding JWT Staleness

1. Firebase Auth ID tokens have a 1-hour TTL. A revoked role can therefore remain valid for up to 60 minutes — unacceptable for a system where a fired admin or stood-down responder needs to lose privileges immediately.

   **Mitigation, layered:**

   1. **Force-refresh signal.** On any privileged status change (`accountStatus → suspended`, role change), a server function writes to `claim_revocations/{uid}` with a server timestamp. The client app subscribes to its own revocation doc; on any change, it calls `getIdToken(true)` to refresh claims.
   2. **Active-account check on privileged operations.** For *write* operations and reads of `report_private`, `report_ops`, `report_contacts`, dispatches, and audit data, security rules check a lightweight `active_accounts/{uid}` document containing `{accountStatus, lastUpdatedAt}`. This adds 1 read per privileged operation but is bounded — it does not apply to broad public reads or alert listings.
   3. **Server-side check in callables.** All callable functions verify `accountStatus == 'active'` from the Admin SDK before executing.

   This is a deliberate three-layer defense. The 60-minute window is closed in seconds for users actively connected; the active-account rule check closes it for the slower paths even when the client misses the refresh signal.

### 3.5 App Check

`enforceAppCheck: true` on every callable. Web: reCAPTCHA Enterprise. Capacitor: Play Integrity (Android) / App Attest (iOS).

App Check is an abuse-reduction control only. It does not replace authorization, rate limiting, fraud controls, session revocation, moderation workflows, or server-side validation against malicious-but-valid clients.

**SMS inbound cannot carry App Check tokens.** The webhook validates that the inbound request came from the configured Globe Labs IP range + shared-secret header, treats all SMS-sourced reports as elevated-moderation by default, and applies per-msisdn rate limits (max 5 submissions per msisdn per hour, max 20 per day). A citizen genuinely caught in a disaster will not trip 5/hour.

---

## 4. Data Architecture

### 4.1 The Report Triptych

A report is three Firestore documents sharing the same ID, materialized atomically by the `processInboxItem` Cloud Function trigger.

**`reports/{reportId}` — Public/operationally shareable metadata**

```typescript
{
  municipalityId: string
  barangayId: string
  status: ReportStatus       // 13-state lifecycle — see §4.3.1
  type: IncidentType
  severity: Severity
  locationApprox: { barangay: string; municipality: string }
  locationPrecision: 'gps' | 'barangay_only'   // NEW: SMS reports may be barangay-only
  visibilityClass: 'public_alertable' | 'internal_only' | 'restricted'
  submissionState: 'server_accepted' | 'rejected' | 'duplicate'
  submissionSource: 'web' | 'sms' | 'admin_entered'   // NEW
  duplicateClusterId?: string
  mergedInto?: string          // NEW: if status = merged_as_duplicate
  createdAt: Timestamp
  serverAcceptedAt: Timestamp
  verifiedAt?: Timestamp
  resolvedAt?: Timestamp
  archivedAt?: Timestamp
  deletedAt?: Timestamp
  retentionExempt?: boolean
  schemaVersion: number
}
```

**`report_private/{reportId}` — Restricted personal and location data**

```typescript
{
  municipalityId: string
  reporterUid: string
  reporterMsisdnHash?: string   // NEW: SHA-256 of phone for SMS-sourced reports
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
  incidentCommanderId?: string
  activeResponderCount: number
  notesSummary?: string
  requiresLocationFollowUp: boolean  // NEW: SMS reports without GPS
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

**`trustScore` remains excluded from v5.** Reinstatement requires documented governance.

### 4.2 Dispatches as Source of Truth

```typescript
dispatches/{dispatchId}
  reportId: string
  responderId: string
  municipalityId: string                  // Denormalized for rules
  agencyId: string                        // Denormalized for rules
  dispatchedBy: string
  dispatchedAt: Timestamp
  status: DispatchStatus
  statusUpdatedAt: Timestamp
  acknowledgementDeadlineAt?: Timestamp
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
  idempotencyKey: string
  schemaVersion: number
```

### 4.3 Dispatch State Machine

Canonical transitions:

- `pending → accepted` — **server-authoritative callable** (`acceptDispatch`). Cannot be a direct write because two responders can race offline and both win locally; first server-side write wins, second receives a structured "too late" response.
- `pending → declined` — responder direct write
- `pending → timed_out` — server scheduled job
- `pending → cancelled` — server-authoritative admin action
- `accepted → acknowledged` — responder direct write (single actor, no contention)
- `acknowledged → in_progress` — responder direct write
- `in_progress → resolved` — responder direct write
- `accepted | acknowledged | in_progress → cancelled` — server-authoritative admin action
- `declined | timed_out | cancelled → superseded` — server-authoritative redispatch workflow only

All transitions record actor, timestamp, and reason where applicable, and emit an append-only entry to `dispatch_events/{eventId}`. Firestore rules validate responder-permitted direct-write transitions (`accepted→acknowledged`, etc.); server functions validate all privileged transitions and cross-document invariants.

**Why `pending→accepted` had to flip to server-authoritative:** Two offline responders viewing the same `pending` dispatch can both tap "Accept." Both queue local writes. On reconnect, both writes apply to Firestore via the SDK; last-write-wins overwrites the first acceptance. Responder A drives to the scene believing they're assigned; the system shows Responder B. This is a real failure mode and the v3 spec did not handle it.

### 4.3.1 Report Lifecycle State Machine (NEW)

v4 had a dispatch state machine but no formal report state machine. Filling that gap:

```
                                       ┌─────────────────────────┐
                                       │ cancelled_false_report  │
                                       └─────────────────────────┘
                                                   ▲
                                                   │ (admin)
                                                   │
  ┌──────────────┐   (trigger)   ┌──────────┐  (admin)   ┌─────────────────┐   (admin)   ┌───────────────┐
  │ draft_inbox  │──────────────▶│  new     │───────────▶│ awaiting_verify │────────────▶│   verified    │
  └──────────────┘               └──────────┘            └─────────────────┘             └───────────────┘
         │                           │   │                        │                              │
         │(trigger fails)            │   │(admin merges)          │(admin merges)                │ (admin dispatches)
         ▼                           │   ▼                        ▼                              ▼
  ┌──────────────┐                   │  ┌────────────────────────────────┐               ┌───────────────┐
  │  rejected    │                   │  │      merged_as_duplicate       │               │   assigned    │
  └──────────────┘                   │  └────────────────────────────────┘               └───────────────┘
                                     │                                                           │
                                     │                                                           │(responder accepts)
                                     │                                                           ▼
                                     │                                                    ┌───────────────┐
                                     │                                                    │ acknowledged  │
                                     │                                                    └───────────────┘
                                     │                                                           │
                                     │                                                           │(responder en route)
                                     │                                                           ▼
                                     │                                                    ┌───────────────┐
                                     │                                                    │   en_route    │
                                     │                                                    └───────────────┘
                                     │                                                           │
                                     │                                                           │(responder arrives)
                                     │                                                           ▼
                                     │                                                    ┌───────────────┐
                                     │                                                    │   on_scene    │
                                     │                                                    └───────────────┘
                                     │                                                           │
                                     │                                                           │(responder resolves)
                                     ▼                                                           ▼
                            ┌─────────────────┐                                         ┌───────────────┐
                            │    cancelled    │                                         │   resolved    │
                            └─────────────────┘                                         └───────────────┘
                                                                                                 │
                                                                                                 │(admin closes after review)
                                                                                                 ▼
                                                                                          ┌──────────────┐
                                                                                          │    closed    │
                                                                                          └──────────────┘
                                                                                                 │
                                                                                                 │(admin reopens if needed)
                                                                                                 ▼
                                                                                          ┌──────────────┐
                                                                                          │   reopened   │ ─┐
                                                                                          └──────────────┘  │
                                                                                                 ▲          │
                                                                                                 └──────────┘
                                                                                            (back to assigned)
```

**Transitions, actor, and write authority:**

| From | To | Actor | Write | Side effects |
|---|---|---|---|---|
| — | `draft_inbox` | Client | Direct (`report_inbox`) | None yet |
| `draft_inbox` | `new` | System (trigger) | Server | Triptych materialized |
| `draft_inbox` | `rejected` | System (trigger) | Server | `moderation_incidents` entry |
| `new` | `awaiting_verify` | Admin | Server callable | Audit event |
| `new` | `merged_as_duplicate` | Admin | Server callable | `mergedInto` set; duplicate cluster updated |
| `awaiting_verify` | `verified` | Admin | Server callable | `verifiedBy`, `verifiedAt`; FCM + SMS to reporter |
| `awaiting_verify` | `merged_as_duplicate` | Admin | Server callable | As above |
| `awaiting_verify` | `cancelled_false_report` | Admin | Server callable | Audit + moderation event |
| `verified` | `assigned` | Admin | Server callable | Dispatch created; responder FCM |
| `assigned` | `acknowledged` | Responder | Direct | Dispatch state linked |
| `acknowledged` | `en_route` | Responder | Direct | RTDB telemetry begins |
| `en_route` | `on_scene` | Responder | Direct | Geofence exit event logged |
| `on_scene` | `resolved` | Responder | Direct | Resolution summary required |
| `resolved` | `closed` | Admin | Server callable | Report locks; SMS closure to reporter if opted in |
| `closed` | `reopened` | Admin | Server callable | Returns to `assigned`; audit event |
| Any active | `cancelled` | Admin (with reason) | Server callable | All active dispatches cancelled |

All transitions emit append-only entries to `report_events/{eventId}`. All privileged transitions require `isActivePrivileged()` rule check.

### 4.4 Complete Collection Map

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
  report_lookup/{publicRef}
  report_notes/{noteId}
  report_events/{eventId}            # Append-only lifecycle event stream (NEW)
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
  # SMS layer (NEW)
  sms_outbox/{msgId}                 # Every outbound SMS attempt with provider + status
  sms_inbox/{msgId}                  # Every inbound SMS (pre-parse); parses into report_inbox
  sms_sessions/{msisdnHash}          # Rate-limit state, tracking-PIN vault for SMS citizens
  sms_provider_health/{providerId}   # Circuit-breaker state (semaphore, globelabs)
  # Break-glass
  breakglass_events/{id}             # Emergency credential uses — superadmin append-only audit

rtdb/
  responder_locations/{uid}
  responder_index/{uid}              # {municipalityId, agencyId} — CF-maintained
```

### 4.4.1 Realtime Database Security Rules

RTDB rules were absent in v3. Specified here:

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
    }
  }
}
```

`responder_index/{uid}` is maintained by Cloud Functions when responder municipality/agency assignments change. Timestamp validation rejects implausible past/future writes. RTDB rules must have negative tests in CI before any production deployment.

### 4.5 Firestore Security Rules

(Rules from v4 §4.5 stand with these additions:)

```javascript
// NEW: SMS inbox is webhook-only, not client-writable
match /sms_inbox/{msgId} {
  allow read, write: if false;  // Cloud Function via Admin SDK only
}

// NEW: SMS outbox visible to superadmin for delivery audit
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

// NEW: Break-glass events — append-only, superadmin + governor-designate readable
match /breakglass_events/{id} {
  allow read: if isSuperadmin() && isActivePrivileged();
  allow write: if false;
}

// NEW: Report event stream
match /report_events/{eventId} {
  allow read: if isActivePrivileged()
              && (isMuniAdmin() || isSuperadmin()
                  || (isAgencyAdmin() && resource.data.agencyId == myAgency()));
  allow write: if false;
}
```

### 4.6 Composite Index Plan

(v4 indexes plus:)

- `sms_outbox`: (providerId + status + createdAt desc), (purpose + createdAt desc)
- `report_events`: (reportId + createdAt desc), (actor + createdAt desc)
- `dispatch_events`: (dispatchId + createdAt desc)

---

## 5. Write Authority Model

### 5.1 The Honest Split

**Server-authoritative mutations** (Cloud Functions / triggers):
- Inbox processing (`onCreate report_inbox` → materializes triptych)
- **Inbound SMS webhook** (`POST /smsInbound` → parses → writes `report_inbox`) (NEW)
- **Outbound SMS sending** (`sendSMS` internal API → Semaphore/Globe Labs) (NEW)
- `acceptDispatch` — atomic with `report_ops.activeResponderCount` update
- `dispatchResponder`, `cancelDispatch`, `redispatch`
- `sendMassAlert`, `declareEmergency` — fans out on FCM + SMS
- `addMessage`, `addFieldNote`
- Media registration (signed URL issuance with size/MIME enforcement)
- User/role administration; account suspension
- All report lifecycle transitions except those marked responder-direct in §4.3.1
- Export workflows, `lookupReportByToken`, `requestErasure`

**Direct client writes with rule-bounded scope:**
- Citizen → `report_inbox` (web; SMS goes via webhook)
- Responder → `dispatches/{id}` for `accepted→acknowledged→in_progress→resolved` and `pending→declined`
- Responder → `responders/{self}.availabilityStatus`
- User → `users/{self}` field-restricted

**Client-side offline queuing does not equal server acceptance.** UI distinguishes `queued`, `submitting`, `server_confirmed`, `failed_retryable`, `failed_terminal`.

### 5.2 Idempotency

Every server-authoritative command accepts an `idempotencyKey` scoped to `(actor, commandType, logicalTarget)`. 24h TTL. Replays with same key + same hash return original result; same key + different hash fails with `ALREADY_EXISTS_DIFFERENT_PAYLOAD`. Triggered side effects use deduplication keys derived from `(eventId, sideEffectType)`.

**SMS outbound idempotency** uses `(reportId, purpose, recipientMsisdn)` as the key — a retry of a "your report was received" alert cannot result in the citizen getting two texts.

---

## 6. Privacy Architecture

### 6.1 Pseudonymous Reports and Direct Contact Data

When a citizen submits without registering, the system stores no direct contact PII unless voluntarily provided for follow-up. The session is a pseudonymous Firebase UID (web) or a SHA-256 hash of the phone number (SMS). Linkage to a registered account is possible via `linkWithCredential()`.

**SMS-sourced reports are pseudonymous only to the degree that the raw msisdn is not stored.** The `reporterMsisdnHash` allows the system to send an auto-reply and rate-limit the sender. The actual msisdn is visible transiently to the webhook function; it is **not** persisted in Firestore except as a hash. This must be documented in privacy notices.

Direct contact data (when provided) goes to `report_contacts/{reportId}` with restricted access and independent retention.

### 6.2 Data Retention and Deletion Semantics

Reports transition through lifecycle states; they are not moved between collections.
- 6 months non-exempt → `archivedAt`, excluded from default queries
- 12 months eligible → `deletedAt` (pending purge)
- Irreversible purge within **7-day deletion SLA**, logged to `audit_logs`, verifiable in BigQuery
- `retentionExempt: true` blocks archival and purge

**SMS-specific retention.** `sms_outbox` records retained 90 days for delivery audit, then purged. `sms_sessions` purged 30 days after last activity. Msisdn hashes on `report_private` follow the parent report's retention (up to 12 months).

### 6.3 Data Subject Rights (RA 10173)

- **Right to access:** Registered citizens can request a data export via `exportData` callable.
- **Right to erasure:** Citizens may request immediate erasure of their registered profile and pseudonymous-link history through a workflow that creates a `deletion_request` audited by superadmin. Erasure is subject to overriding legal obligations (active investigation, etc.) which trigger `retentionExempt`.
- **Right to be informed:** In-app and submission-time notices must describe what is collected, what is shared cross-jurisdiction, and what cannot be retracted (e.g., aggregated anonymized statistics).

### 6.4 DPIA Scope (NEW)

A formal Data Privacy Impact Assessment must be completed before production, covering:

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

**Cross-border transfer** to Singapore (Firebase `asia-southeast1`) is covered under NPC guidelines for legitimate cloud processing with standard contractual safeguards. DPIA must document this explicitly and obtain NPC concurrence if required.

**EXIF stripping** is mandatory on all uploaded media — the `requestUploadUrl` callable hands the client a pre-processed upload path, and a trigger on `storage.object.finalize` runs EXIF removal before the media is registered on `reports/{reportId}/media`.

---

## 7. Audit & Compliance

### 7.1 Audit Architecture

Application convenience logs may exist in `audit_logs/{logId}`; the primary audit stream is structured Cloud Logging exported to BigQuery. Application service account has no mutation permission on the audit dataset (separate IAM scope).

### 7.1.1 Streaming vs Batch Split (NEW)

The 5-minute batch-to-BigQuery export is acceptable for analytics and forensic reconstruction of general activity. It is **not acceptable** for security-critical events where a 5-minute gap can erase evidence during a live incident.

**Streaming-path events** (via BigQuery Storage Write API, sub-second to dataset):
- `accountStatus` changes (suspension, reactivation, disabling)
- `claim_revocations` writes
- `breakglass_events` — every use
- `cancelDispatch` when `cancelReason` is flagged sensitive
- `retentionExempt` toggles
- Cross-municipality data access events
- Superadmin reads of `report_private` and `report_contacts`

**Batch-path events** (5-minute schedule, cost-optimized):
- Routine dispatch lifecycle events
- Report status transitions
- Routine admin reads
- Client error telemetry
- Function invocation logs

Both paths are monitored for gap detection. Streaming path alerts at 60-second gap; batch path alerts at 15-minute gap.

### 7.2 Correlation and Forensic Reconstruction

Every privileged action, status transition, media registration, notification send, SMS attempt, and background job carries a correlation ID propagated through callable inputs, function logs, FCM messages, Cloud Tasks, and SMS provider API calls.

---

## 8. Responder Location Tracking

### 8.1 Responder Telemetry Model

Telemetry written to RTDB only while responder is on active assignment or explicitly enabled duty state. Record includes `capturedAt`, `receivedAt` (server timestamp), `lat`, `lng`, `accuracy`, `batteryPct`, `motionState`, `appVersion`, `telemetryStatus`.

### 8.2 Mobile Execution Model — Motion Activity Required (NEW)

v4 said "adaptive intervals by motion state" but did not specify **how** motion was detected. Using GPS speed to infer motion means the GPS radio stays on even during stationary periods, which kills responder batteries over a long shift. v5 requires hardware motion detection:

- **Android:** Use the Activity Recognition API (`@capacitor-community/background-geolocation` exposes this) — the OS hardware determines if the device is still, walking, or in a vehicle.
- **iOS:** CMMotionActivityManager via a Capacitor plugin provides the equivalent.

**Sampling policy:**

| Hardware-reported activity | GPS polling | Rationale |
|---|---|---|
| `running` / `in_vehicle` (high priority dispatch) | 10s ± 2s | Real-time tracking during active response |
| `walking` (normal priority) | 30s ± 5s | Moving but not urgent |
| `still` + on active dispatch | **Geofence-only** + 5-minute GPS ping | Stationary at staging; rely on geofence exit to resume |
| `still` + low battery (<20%) | **Geofence-only** + 10-minute GPS ping | Battery preservation |
| No active dispatch | No tracking | Zero-telemetry off-duty |

Geofence setup on `acknowledged` state: a 50m radius around the responder's current position. Exit triggers resumption of active GPS polling. This pattern — GPS off at staging, on at movement — is standard for fleet tracking and is what extends battery life from 3-4 hours to 12+ hours.

**Jitter** (± values above) prevents thundering-herd reconnection when a cell tower recovers and 50 responders transmit simultaneously.

### 8.3 Stale-State Semantics

| `telemetryStatus` | Definition                                            | Operator UX                                  |
| ----------------- | ----------------------------------------------------- | -------------------------------------------- |
| `live`            | `receivedAt` within 2× expected interval              | Normal display                               |
| `degraded`        | `receivedAt` within 4× expected interval              | Yellow tint, age label                       |
| `stale`           | `receivedAt` exceeds 4× expected interval             | Gray, "last seen X ago", warning banner      |
| `offline`         | No `receivedAt` for 5+ minutes during active dispatch | Red, dispatcher alert, manual contact prompt |

## 

### 8.4 Cost Behavior Under Degraded Networks

Cost estimates remain non-binding. Back-of-envelope at 30 responders × 24h × adaptive intervals × 120-byte payloads × 12 listeners produces ~$0.40/day in ideal conditions. **Under degraded networks, websocket reconnection storms can multiply this 10×–100×** as listeners re-sync state on each reconnect. Budget alerts fire at 5×, 10×, and 25× baseline. Connection backoff uses exponential jitter.

---

## 9. Frontend Architecture

### 9.1 State Management

Zustand for UI state. TanStack Query wraps Firestore `onSnapshot` listeners with a listener registry preventing duplicates. TanStack Query is **not** the consistency layer; Firestore's real-time listeners are.

### 9.1.1 State Ownership Matrix (NEW — Resolves Cache-Soup Risk)

The senior-architect review flagged that React + Firebase + Zustand + TanStack Query + outbox = five potential state authorities, each of which can believe it has the correct version of the same data. v5 makes ownership explicit:

| Data category | Authority | Everything else must | Rationale |
|---|---|---|---|
| Synchronized server documents (reports, dispatches, users) | **Firestore SDK local persistence** | Read via Firestore listeners, never cache separately | Single source of server truth; offline persistence is SDK-native |
| Ephemeral UI state (modal open, tab selected, form field focus) | **Zustand** | Never duplicate in server cache | UI-only; not persisted to server |
| Non-Firestore HTTP responses (callable results, derived aggregates) | **TanStack Query** | Never hand-cache in Zustand | Built for this; has invalidation + retry |
| Outbound mutation queue (drafts, queued submits) | **localForage** (keyed by client UUID) + Firestore SDK write queue | Always write to both | Firestore SDK queue alone is vulnerable to IndexedDB eviction; localForage survives more scenarios |
| Media upload state (resumable transfer progress) | **Storage SDK resumable reference** | TanStack Query wraps for UI observation only | Storage SDK owns transfer state |
| Session / auth state | **Firebase Auth SDK** | Everything reads via `onAuthStateChanged` | Auth SDK is authoritative |

**Rules the codebase enforces:**

1. **No component reads a report from Zustand.** Reports come from Firestore listeners (wrapped by TanStack Query for React-friendliness), not from Zustand.
2. **No component writes a server-synced field to Zustand.** If a form edits a report, the edit goes to the outbox (localForage + Firestore write queue), then the UI reflects the optimistic change via TanStack Query's `setQueryData`, not Zustand.
3. **TanStack Query does not own data — it caches views of data it fetched.** When a Firestore listener updates, the listener handler calls `queryClient.setQueryData` with the new document; TanStack Query is a reactive read cache on top of Firestore's reactive cache.
4. **Drafts in localForage use client-generated UUIDs.** When the draft is accepted into `report_inbox`, the inbox ID (also a client UUID) matches, so the draft can be correlated with the server record and cleaned up.

This eliminates the ghost-state, duplicate-fetch, stale-listener class of bugs.

### 9.2 Error Boundaries

Three levels: root, role-area, panel. Crashed panel retries without losing map context. All boundary catches log to a `client_errors` stream.

### 9.3 Offline and Reconciliation Model

Client states: `draft` → `queued` → `submitting` → `server_confirmed` | `failed_retryable` | `failed_terminal`.

### 9.3.1 Draft Durability Under IndexedDB Eviction (NEW)

The Firestore SDK uses IndexedDB for offline persistence. Mobile browsers — especially iOS Safari, and Android Chrome under storage pressure — can evict IndexedDB data when space is low. If a citizen drafts a report offline and the OS evicts before reconnection, the Firestore queue is gone silently.

**Mitigation:**

1. **Dual-write on draft save.** When the user completes the form and taps submit, the client writes the payload to **both** the Firestore SDK write queue AND a localForage entry keyed `draft:{clientUuid}`. localForage uses IndexedDB under the hood but with a separate database name that has different eviction characteristics and, on initialization failure, falls back to WebSQL and localStorage.
2. **On app start, reconcile.** If the Firestore queue is empty but localForage has `draft:{uuid}` entries, the client re-enqueues them into Firestore. If Firestore has queued writes the server accepted (verified by listener), the corresponding localForage entry is cleared.
3. **User-visible persistence confirmation.** After submit, the UI shows *"Your report is saved on this device. Reference: 2026-DAET-0471. Take a screenshot or save this code."* This converts the reference into a paper-form fallback: a user with a lost device can walk into the municipal hall and give staff the reference.
4. **iOS-specific fallback.** On iOS, if `localStorage`/`IndexedDB` both appear compromised (detected via write-then-read probe), the UI prompts the user to send the report via SMS instead, pre-filling a `sms:` link with the correct keyword format.
5. **Background Sync API** is used where available (Chromium browsers) to retry submission when the browser is closed. iOS does not implement Background Sync; iOS users rely on the app being reopened — which is why SMS fallback exists.

### 9.4 Failure-State UX

Critical screens display:
- Network state indicator (online / offline / degraded)
- Last successful sync timestamp
- Stale data warnings
- Pending outbound queue count (with drill-down to `draft:` items in localForage)
- Per-item submission state
- Permission state (location, notifications) with one-tap recovery
- **SMS fallback prompt** when Firestore queue has been stuck >10 minutes with network present

---

## 10. Backend Architecture

### 10.1 Cloud Functions

**Triggers:**
- `onCreate report_inbox/{id}` → `processInboxItem` (materializes triptych; `minInstances: 3`, `concurrency: 80`, idempotent on inbox ID)
- `onWrite dispatches/{id}` → `onDispatchStateChanged`
- `onCreate moderation_incidents/{id}` → escalation
- `onFinalize storage.objects` → EXIF stripping for `/reports/*/media/*`
- **`onCreate sms_inbox/{id}` → `parseInboundSMS` → writes to `report_inbox`** (NEW)
- **Delivery-report webhooks from Semaphore and Globe Labs → update `sms_outbox/{id}.status`** (NEW)

**Callables** (App Check enforced, idempotency keys accepted, server-side `accountStatus` check):
- All v4 callables
- `sendSMS(to, body, priority, purpose)` — internal; called by other callables/triggers only (NEW)
- `initiateBreakGlass(evidencePayload)` — superadmin-provisioning; dual-control required (NEW, see §11.6.1)

**Scheduled:**
- `archiveReports` daily
- `cleanupDeletedReports` weekly (with deletion-SLA verification)
- `computeMetrics` every 5 minutes
- `dispatchTimeoutSweep` every minute
- `cleanupOrphanedMedia` daily
- `auditExportHealthCheck` every 10 minutes
- **`inboxReconciliationSweep` every 5 minutes** (NEW — addresses cold-start trigger failures)
- **`smsOutboxCleanup` daily** (purges 90-day-old SMS records per retention policy) (NEW)
- **`smsProviderHealthProbe` every 2 minutes** (circuit-breaker state update) (NEW)

### 10.1.1 Cold-Start Mitigation for Inbox Trigger (NEW)

Review concern: a typhoon surge brings hundreds of citizens online simultaneously. Cloud Functions cold-starts could cause `processInboxItem` timeouts, leaving `report_inbox` items with no corresponding triptych.

Cloud Functions v2 runs on Cloud Run with per-instance concurrency up to 1000 (default 80), dramatically reducing cold starts during bursts of traffic. And minimum instances can be specified to keep container instances warm and ready to serve requests, trading ~$15-20/month per 512 MiB warm instance for eliminated cold-start latency.

**v5 configuration for `processInboxItem`:**
- `minInstances: 3` during normal operation (2 warm backing + 1 buffer)
- `maxInstances: 100`
- `concurrency: 80`
- `timeoutSeconds: 120`
- `memory: 512MiB`

**Cost at idle:** ~$45-60/month for the three warm instances. This is a line-item in the budget.

**`inboxReconciliationSweep` — the safety net:** Every 5 minutes, a scheduled function scans `report_inbox` for items where:
- `processedAt` is null, AND
- `createdAt` is more than 5 minutes ago

For each match, it retries `processInboxItem` with the inbox ID as idempotency key. If the retry succeeds, the triptych materializes. If it fails three reconciliation attempts, the item is written to `dead_letters` with the original payload and an alert fires to the backend on-call. **No citizen report is silently dropped by a trigger failure.**

**Surge capacity pre-warming.** The system watches external typhoon-forecast feeds (PAGASA). On a Signal-2+ warning for any barangay in the province, a scheduled function raises `minInstances` for `processInboxItem`, `acceptDispatch`, and `sendSMS` from 3 to 20, pre-warming capacity before the surge hits. `maxInstances` also raises. This is automatic, logged, and reverses 6 hours after the signal drops.

### 10.2 Concurrency & Cross-Document Invariants

Mutations spanning multiple documents execute inside Firestore transactions. The transaction boundary is the consistency boundary.

### 10.3 Failure Handling and Dead Letters

- **Transient infrastructure failures:** CF native retry, exponential backoff, max 5 attempts.
- **Downstream API calls with extended outage potential** (external agency dispatch APIs, government notification systems, **SMS providers during prolonged outage**): handed off to Cloud Tasks with retry windows up to 72 hours.
- **Permanent failures:** `dead_letters/{id}` with payload, correlation ID, failure category, retry history, operator action guidance.
- **Dead-letter replay** is explicit superadmin workflow with audit logging.

### 10.4 Signed URL Hardening (NEW)

v4 had signed URLs for media uploads but did not enforce size/MIME limits on the URL itself — a malicious actor could upload a 5GB file to exhaust Storage quota.

**v5 `requestUploadUrl` callable:**
- Enforces **`Content-Type` restriction** in the signed URL (only `image/jpeg`, `image/png`, `image/heic`, `image/webp`, `video/mp4`, `video/quicktime`)
- Enforces **`x-goog-content-length-range` of 0–20 MB** for images and 0–200 MB for videos — Cloud Storage rejects uploads outside this range at the signed URL layer, not in the client
- Signed URL expires in **10 minutes** (enough for upload, tight enough for replay protection)
- Per-UID rate limit: **max 5 active signed URLs, max 50 uploads per hour**
- Every issuance logged with correlation ID
- On upload success, the `onFinalize` trigger runs a MIME-type probe (magic bytes, not extension) and deletes the object if it doesn't match the declared type

---

## 11. Deployment & Operations

### 11.1 Environments

`bantayog-dev` (emulators), `bantayog-staging` (pre-production), `bantayog-prod` (production). Production credentials never shared.

### 11.2 Service Objectives

| Metric | Target | Window |
|---|---|---|
| Citizen report acceptance latency (network present) | p95 < 3s | rolling 5min |
| Dispatch creation latency (admin click → responder FCM delivery) | p95 < 10s | rolling 5min |
| Push delivery attempt success rate | > 95% | rolling 1h |
| **SMS delivery attempt success rate (priority queue)** | **> 90%** | **rolling 1h** |
| **SMS delivery attempt success rate (normal queue)** | **> 80%** | **rolling 1h** |
| Telemetry freshness (live status) | > 90% of dispatched responders | rolling 5min |
| RPO | ≤ 24 hours | per incident |
| RTO | ≤ 4 hours | per incident |
| Audit export gap (streaming path) | ≤ 60 seconds | continuous |
| Audit export gap (batch path) | ≤ 15 minutes | continuous |
| **Inbox reconciliation backlog** | **< 5 items older than 5 minutes** | **continuous** |

### 11.3 Backup and Recovery

- **Firestore:** daily managed exports to Cloud Storage with 30-day retention.
- **RTDB:** daily backups with 7-day retention.
- **Storage:** object versioning enabled; 12-month lifecycle on non-current versions.
- **Restore drills** quarterly. A drill is successful only when raw data, security rules, indexes, function deployments, storage references, and operational dashboards are all restored to a working state in staging within RTO.

- **Terraform state** versioned in GCS bucket with object versioning; state lock via GCS
- **Firebase CLI artifacts** (rules, indexes, functions source) versioned in git with tagged releases
- **Infrastructure restore command** documented: `terraform apply` + `firebase deploy --project bantayog-prod`
- **Restore drill** quarterly; successful only when full stack (data + rules + indexes + functions + storage + SMS provider config) restored to a staging clone within RTO

### 11.4 Rollout and Rollback

- **Hosting:** instant rollback via Firebase Hosting release channels.
- **Functions:** targeted rollback via `firebase deploy --only functions:<name>` with previous version pinned.
- **Rules:** redeploy from a known-good git commit; rules history is audited.
- **Schema changes:** must be backward-compatible across one rolling deployment window. Breaking changes use the `schemaVersion` field plus a migration window where both versions are accepted by triggers.
- **Forced client upgrade:** `system_config/min_app_version` is checked on app start; clients below the floor get a forced-upgrade screen for privileged operations. Citizen submission paths have a more lenient floor than admin paths to avoid blocking emergency reporting during a deploy issue.

### 11.5 Regional and Disaster Strategy

Primary: `asia-southeast1`. Multi-region Firestore out of scope. Degraded-mode runbook covers regional outage with SMS and paper fallback.

### 11.6 Security Operations

- MFA required for all staff accounts
- Secrets rotation via Secret Manager, quarterly
- Lost-device runbook
- App version enforcement via `system_config/min_app_version`
- Emergency access revocation < 30 seconds via force-refresh + `active_accounts` check

### 11.6.1 Break-Glass Emergency Access (NEW)

The senior-architect review asked: *"What happens if a superadmin is incapacitated during a typhoon?"* v5 answers:

**The problem.** All superadmin actions require MFA + TOTP. If the superadmin is unreachable (hospitalized, phone destroyed, power out at their location), and a province-wide emergency action is needed (cross-municipality escalation, mass alert authorization, retention exemption override), the system is locked out of provincial oversight.

**The mitigation: offline-provisioned break-glass credentials.**

1. **Physical escrow.** Two sealed envelopes are held by (a) the Office of the Governor, (b) the PDRRMO Director. Each contains: a pre-provisioned break-glass account email, a 20-character random password, and the TOTP seed (as QR printout).
2. **Dual-control unseal.** The break-glass account can only be activated by a dual-control procedure: two people from a named list (Governor, Vice-Governor, PDRRMO Director, Deputy Director) both call the Architecture Team on-call via a dedicated number and authorize activation. The on-call engineer runs `initiateBreakGlass` with both authorizers' callback verification codes.
3. **Activation effect.** `accountStatus` goes to `active` for that account; `breakGlassSession: true` claim is set. The break-glass account has superadmin privileges for **4 hours**, then auto-disables.
4. **Every action is streamed.** All operations under `breakGlassSession: true` write to the streaming audit path (§7.1.1), not batch. Every single one. A `breakglass_events/{id}` entry is written for the activation itself.
5. **Post-event review.** Within 72 hours of deactivation, an independent review of all break-glass actions is required. Findings documented.
6. **Drill quarterly.** The unseal procedure is drilled quarterly with fake envelopes in staging to ensure the physical chain of custody works.

This is boring on purpose. Emergency access is the highest-risk category of privilege; the procedure is heavy precisely because it should almost never be used.

### 11.7 Monitoring and Alerting

(v4 table plus:)

| Signal | Threshold | Owner |
|---|---|---|
| **SMS provider error rate (Semaphore)** | **> 5% over 5min** | **Backend on-call → circuit-break to Globe Labs** |
| **SMS delivery success (priority)** | **< 85% over 1h** | **Backend on-call** |
| **Inbox reconciliation backlog** | **> 5 items older than 5min** | **Backend on-call** |
| **Break-glass activation** | **Any** | **Superadmin + Governor's office notified** |
| **Streaming audit gap** | **> 60s** | **Compliance + Backend (immediate)** |

### 11.8 System Health Surface

`/system_health` admin page polls every 30s: backend region status, function error rate, push delivery rate, **SMS delivery rate per provider**, **SMS provider circuit-breaker state**, telemetry freshness, queue depths, **inbox reconciliation backlog**, audit export health (streaming + batch), **break-glass session active indicator**.

### 11.9 Observability Dashboards (NEW)

Four dashboards, named owners:

**Operations Dashboard (Ops on-call):**
- Queue depths: inbox unprocessed, dispatch pending, SMS outbox queued
- Stale telemetry rate by municipality
- Dispatch acceptance latency
- FCM + SMS delivery rates side-by-side

**Backend Dashboard (Backend on-call):**
- Function invocations, errors, p95 latency per function
- Dead-letter growth rate, type breakdown
- Firestore quota burn
- RTDB bandwidth
- Cloud Tasks queue depth and retry age

**Compliance Dashboard (Compliance officer):**
- Audit export gap (streaming + batch)
- Privileged reads of `report_private` / `report_contacts`
- Cross-municipality data access events
- Data subject erasure requests status
- Retention-exempt records count
- Break-glass activations (lifetime + rolling 90 days)

**Cost Dashboard (Ops + Finance):**
- Daily spend by service (Firestore, Functions, Storage, RTDB, SMS Semaphore, SMS Globe Labs)
- 7-day rolling baseline and anomaly detection
- Surge-pre-warm instance hours (attributable to typhoon signals)
- Per-municipality cost allocation

Each dashboard has a runbook for every alert. Alerts without runbooks are noise and must be downgraded or removed.

---

## 12. Testing

Testing prioritizes failure behavior over coverage percentages.

| Layer              | Tool                                 | Target                                                       |
| ------------------ | ------------------------------------ | ------------------------------------------------------------ |
| Unit               | Vitest                               | Domain logic, validation, state-machine transitions          |
| Security rules     | Firebase Emulator + Vitest           | Positive AND negative cases for every rule, including cross-municipality leakage attempts. CI fails if any rule lacks negative tests. |
| RTDB rules         | Firebase Emulator                    | Positive AND negative for every path; timestamp validation; cross-role scoping |
| Integration        | Emulator + staging services          | Callable commands, retries, dedup, event fan-out, restore compatibility |
| E2E                | Playwright + real-device smoke tests | Critical workflows under reconnect, permission revocation, stale claims, failed pushes, app restart during queue replay |
| Load               | k6 + synthetic replay                | Surge patterns beyond expected peak: 500 concurrent citizen submits, 100 concurrent admin dashboards, 60 GPS streams, duplicate submissions, notification bursts, websocket reconnection storms |
| Chaos / resilience | Scripted fault injection             | Network loss mid-submission, delayed retries, dead-letter growth, regional dependency drills, FCM degradation |

Success criteria are scenario-based and tied to §11.2 service objectives, not coverage percentages alone.

**Existing pilot-blocker scenarios (v4):**
1. Two responders accept same dispatch within 100ms while one is offline → exactly one wins.
2. Citizen on 2G submits, locks phone, reopens 2h later → report `server_confirmed` within 60s.
3. Suspended admin's token refresh within 60s of suspension.
4. Cross-municipality read attempt rejected at rule layer.
5. Audit export pause 30min → alert + backfill.
6. RTDB websocket reconnection storm → cost stays within 5×.

**New pilot-blocker scenarios (v5):**
7. **IndexedDB eviction during offline draft** → localForage recovers the draft on reopen; report submits successfully.
8. **Feature-phone user texts `BANTAYOG FLOOD CALASGASAN`** → parse succeeds, report materializes, auto-reply sent.
9. **Semaphore returns 500 for 30s** → circuit-breaker flips to Globe Labs, no alerts dropped, Semaphore re-enters rotation when healthy.
10. **`processInboxItem` fails for a specific inbox item** (simulated via injected error) → reconciliation sweep retries within 5 minutes and succeeds, no dead-letter.
11. **100,000-recipient mass alert** during staging load test → delivered via priority queue within 10 minutes with <5% per-provider failure.
12. **Break-glass drill**: two authorizers → superadmin activation → 4-hour session → auto-deactivation → audit trail complete and verifiable in streaming path.
13. **Responder stationary for 4 hours at staging** → battery drop <15% (vs 40%+ with naive GPS polling).
14. **Typhoon pre-warm triggers** on simulated Signal-2 → `minInstances` raised → verified warm → reverts 6h after signal drops.

Success criteria are scenario-based and tied to §11.2 service objectives.

---

## 13. Risks

| Risk | Residual Reality | Mitigation |
|---|---|---|
| Regional cloud outage | Real-time backend unavailable | Degraded-mode runbook, SMS-only fallback workflow, paper forms, communications plan |
| Mobile background execution degraded | Telemetry stale silently | Silent-device detection, stale-state UI, permission recovery, operator alerts |
| Cross-jurisdiction data leakage | RA 10173 failure | Scoped rules, negative tests in CI, access reviews, least-privilege defaults, moderation logging |
| Abuse / false reporting | App Check insufficient alone | Rate limits (per-UID, per-msisdn), moderation workflow, token hardening, anomaly detection, operator review |
| Deletion incompleteness | Soft-delete ≠ purge | 7-day SLA, completion logging, BigQuery verification |
| Duplicate side effects | Retries can multiply work | End-to-end dedup keys, event idempotency, replay-safe handlers |
| Backup restore mismatch | Raw data restore ≠ full system | Quarterly full-stack restore drills including Terraform/Firebase CLI |
| JWT staleness | Up to 60min window | Three-layer mitigation (§3.4) |
| Dispatch split-brain | Two responders both believe they accepted | `pending→accepted` is server-authoritative (§4.3) |
| Inbox abuse / DoS | Direct-write inbox more exposed | Per-UID rate limits + App Check + reconciliation sweep + surge pre-warm |
| RTDB reconnect cost explosion | Websocket churn under outage | Jitter, backoff, 5× cost alert |
| BigQuery audit gap | Pipeline failure = blind | Streaming path for critical events (60s gap alert), batch for analytics (15min alert) |
| Cyclone-driven extended outage | Multi-day cell coverage loss | Cloud Tasks 72h retry, paper fallback, post-restoration reconciliation |
| **IndexedDB eviction wipes draft** | **Silent loss on iOS** | **Dual-write to localForage + SMS fallback prompt + tracking reference as paper fallback** |
| **Inbox trigger cold-start timeout** | **Citizen report stuck in inbox** | **`minInstances: 3` + concurrency 80 + reconciliation sweep + surge pre-warm** |
| **GPS battery drain killing responders mid-shift** | **Responders become uncontactable** | **Motion Activity API + geofence-at-staging + 10-min GPS at low battery** |
| **Security event lost to 5-min audit gap** | **Forensic blind spot during incident** | **Streaming audit path for suspensions, revocations, break-glass** |
| **Signed URL abuse (5GB upload DoS)** | **Storage quota exhaustion** | **`x-goog-content-length-range` + MIME restriction on URL + per-UID rate limit + magic-byte verification** |
| **Superadmin incapacitated mid-emergency** | **No provincial oversight** | **Break-glass dual-control procedure with 4h time-limited session** |
| **SMS provider outage during mass alert** | **Life-safety channel silent** | **Semaphore + Globe Labs dual-provider circuit-breaker** |
| **Client state becomes inconsistent (cache soup)** | **Ghost states, duplicate fetches, stale listeners** | **State Ownership Matrix (§9.1.1) enforced in code review** |
| **SMS inbound abuse (spam reports from feature phones)** | **Moderation queue overwhelmed** | **Per-msisdn rate limit + elevated moderation default + keyword validation + duplicate-cluster detection** |

---

## 14. Open Risks That Pilot Must Validate

1. **iOS PWA storage eviction real-world rate** — localForage + SMS fallback are hypotheses until measured.
2. **External agency API readiness** — Cloud Tasks 72h retries assume eventual recovery; some agencies have no APIs.
3. **MFA adoption friction with field staff** — may need hardware token alternative.
4. **Tracking-secret loss rate** — pilot decides if in-person recovery workflow is needed.
5. **Cost under real surge** — estimates remain non-binding; $5k/month emergency ceiling pre-approved.
6. **SMS provider reliability during a real typhoon** — both Semaphore and Globe Labs may degrade simultaneously during cell tower loss.
7. **Feature-phone SMS parsing accuracy in Tagalog/regional spelling variants** — pilot measures parse failure rate and auto-reply helpfulness.
8. **Break-glass drill fidelity** — the quarterly drill must prove the physical procedure works, not just the technical callable.
9. **Battery-life validation on real responder devices** — the 12+ hour target is theoretical until measured with the specific phones issued to Camarines Norte responders.

---

## 15. Access Model Summary

System defines access by **data class**, not collection name:

- **Public-alertable:** authenticated (including pseudonymous)
- **Restricted operational:** municipal admins of the municipality, agency admins of assigned agencies, assigned responders, with `isActivePrivileged()`
- **Restricted personal:** data subject + minimum administrative roles
- **Responder telemetry:** roles with active operational need, municipality/agency-scoped
- **SMS audit (`sms_outbox`, `sms_inbox`):** superadmin only
- **Break-glass audit:** superadmin + designated Governor's office reviewer
- **Audit data:** superadmin; BigQuery dataset separate IAM

New collections must declare data class, permitted roles, sharing conditions, and rule block with negative tests before implementation.

---

## 16. Decision Log

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
| 16 | `trustScore` deferred to v6 | Governance required | Include with placeholder | Manual triage only |
| 17 | Cloud Tasks for downstream API calls | 72h retry windows | CF native retry | Additional infra |
| 18 | Tracking reference + secret separated | Human-readable ref not a credential | Single token | Users must store secret |
| 19 | Denormalize `status`/`severity`/`createdAt` onto `report_ops` | Cross-cutting admin queries possible | Client-side join | Mirrored fields require transactional updates |
| 20 | MFA required for all staff | Field accounts are targets too | Superadmin-only MFA | TOTP friction |
| 21 | **Semaphore primary + Globe Labs failover for SMS** | **Domestic aggregators, 20x cheaper than Twilio, better PH telco compliance** | **Twilio (Firebase Extension available)** | **Dual-provider ops; circuit-breaker required** |
| 22 | **Inbound SMS via Globe Labs keyword → `report_inbox`** | **Feature-phone + zero-data citizens reachable; unified ingestion** | **Separate inbound SMS pipeline** | **Per-msisdn rate limits; barangay-only precision** |
| 23 | **localForage dual-write for citizen drafts** | **Firestore SDK alone vulnerable to IndexedDB eviction** | **Firestore SDK only** | **Reconciliation logic; two storage layers to monitor** |
| 24 | **`minInstances: 3` for `processInboxItem` + reconciliation sweep** | **Cold-start surge failure would drop reports; reconciliation is safety net** | **Scale from zero** | **~$45-60/mo idle cost; typhoon pre-warm adds more** |
| 25 | **Motion Activity API + geofence-at-staging for responders** | **GPS-speed inference kills batteries over long shifts** | **GPS-speed motion detection** | **Plugin dependency; motion-API accuracy varies by device** |
| 26 | **Streaming audit for security events, batch for analytics** | **5-min gap unacceptable for suspensions/revocations during incident** | **All-batch** | **Higher BQ streaming cost on critical events; worth it** |
| 27 | **Break-glass sealed credentials with dual-control unseal** | **Superadmin incapacitation during typhoon cannot lock out province** | **Only named superadmin has access** | **Physical chain of custody; quarterly drill; post-event review** |
| 28 | **State Ownership Matrix enforced in code review** | **Cache soup across Firestore/TanStack Query/Zustand is a real failure mode** | **Implicit ownership** | **Requires review discipline; documented but team must hold the line** |
| 29 | **Report lifecycle state machine formalized (13 states)** | **Dispatch-only state machine left report transitions implicit and untested** | **Implicit report transitions** | **More state to test; rule updates for every transition** |
| 30 | **Terraform + Firebase CLI as named IaC stack** | **"Version-controlled" isn't a command** | **Firebase CLI alone** | **Terraform state management overhead; team must learn both** |
| 31 | **Signed URL size/MIME/content-range enforcement** | **5GB DoS upload risk without it** | **Client-side size check** | **More complex URL issuance logic** |
| 32 | **Stay on Firebase; no Postgres migration in v5** | **Single developer, pilot scope; migration is 3+ months of work with no pilot data to justify it yet** | **Hybrid with Postgres for dispatch core** | **Document-store ceiling acknowledged; migration triggers defined (§17)** |
| 33 | **Defer province-wide mass alerting to NDRRMC ECBS, don't duplicate** | **RA 10639 assigns this channel to NDRRMC + telcos; ECBS is cell broadcast (near-instant, point-to-multiple-point); commercial SMS aggregators are slower, pricier, legally awkward at that scale** | **Blast 100k+ SMS ourselves via Semaphore** | **Must build + maintain escalation workflow with PDRRMO → NDRRMC; end-to-end latency partly out of our control** |

---

## 17. The Postgres Question: When to Migrate, and Why Not Now

The senior-architect review suggested considering a hybrid architecture with Postgres/AlloyDB for the authoritative incident/dispatch core once the system becomes "primary emergency operations platform." This is a legitimate concern and deserves a direct answer rather than a hand-wave.

**The honest answer: stay on Firebase for v5. Document the migration triggers now so the decision isn't panic-driven later.**

### 17.1 Why not migrate now

- **Team capacity.** This is currently a single-developer project with provincial government interest, not a funded engineering team of five. Introducing Postgres means: migrations layer, connection pooling, read replicas, backup rotation, separate IaC, separate monitoring, separate on-call paging. That's a full-time ops person's worth of new work before it delivers any user value.
- **Pilot-data-free decision.** Migrating before the pilot runs means migrating on theory. The document-store ceiling — where Firestore's lack of joins and transactional guarantees actually hurts — hasn't been hit yet at 600k population. It will hit at some threshold. We want that threshold measured, not guessed.
- **Cost structure.** Firebase pricing scales with usage; a Postgres core on AlloyDB has a baseline cost floor that dominates at pilot scale (~$300/month minimum for a small HA configuration). That's meaningful at this stage.
- **Rollback risk.** If the migration goes wrong mid-deployment, the emergency system is the thing going wrong. Not an acceptable failure mode to introduce before pilot stability is proven.

### 17.2 Named migration triggers

The architecture moves toward a hybrid Firebase + Postgres core when **any two** of these are observed in production for 30+ consecutive days:

| Trigger | Threshold | Why it signals Postgres |
|---|---|---|
| Admin dashboard p95 load time | > 5 seconds | Firestore client-side join cost exceeded; need server-side relational queries |
| Concurrent active dispatches province-wide | > 500 sustained | Contention on dispatch collection; transaction throughput ceiling |
| Cross-collection reporting queries per day | > 1,000 | BigQuery batch is too slow for operational reporting; live Postgres read replica needed |
| Firestore document update amplification | > 10× write fan-out per business event | Denormalization cost exceeds relational cost |
| Cost of Firestore reads | > ₱50,000/month (>$900) | Relational DB cost model becomes more favorable |
| Dispatch state machine transitions needing multi-table FK enforcement | Any compliance-mandated case | Firestore cannot enforce FK; Postgres can |
| Regulatory requirement for SQL-based audit access | Any formal government audit request | Relational reporting tools assumed |

### 17.3 What a hybrid would look like

For planning — not implementation in v5:

- **Firestore stays authoritative** for real-time views, offline sync, mobile-first reads, citizen-facing data.
- **Postgres (AlloyDB) takes authoritative** dispatch state, incident lifecycle, reporting/analytics, relational audit queries.
- **CDC via Datastream** replicates Postgres writes to Firestore read models so mobile clients don't talk to Postgres directly.
- **Dispatch callables write to Postgres first**, then materialize to Firestore on success — Postgres becomes the consistency boundary.
- **Migration window**: 6-9 months with staged cutover per municipality.

This is a v6+ conversation. v5 documents it so the team stops evaluating "should we move to Postgres" every three months and instead monitors the specific triggers.

---

## 18. What Pilot Must Prove Before Production Hardening

(v4 list plus v5 additions, collated:)

1. Citizen offline submission survival rate on real iOS and Android devices in mountainous barangays
2. Dispatch acceptance latency under realistic responder concurrency
3. Active-account rule check cost impact on admin dashboards
4. RTDB cost behavior during real connectivity disruption
5. Audit export pipeline reliability over 30+ continuous days (both streaming and batch)
6. MFA adoption among field staff
7. Tracking-secret retention by anonymous citizens (loss rate)
8. Dead-letter accumulation patterns and operator response times
9. End-to-end latency from citizen submit to FCM + SMS alert delivery during a controlled drill
10. **SMS inbound parse accuracy across Tagalog and regional spelling variants**
11. **Semaphore + Globe Labs circuit-breaker behavior under simulated provider degradation**
12. **localForage draft recovery after forced IndexedDB eviction on iOS**
13. **Responder battery life at real staging durations (target: 12+ hours)**
14. **Inbox reconciliation sweep catching injected trigger failures within SLA**
15. **Break-glass drill fidelity (dual-control, 4h auto-expire, audit trail)**
16. **Cost under real surge with typhoon pre-warm engaged**
17. **State Ownership Matrix discipline holding across the codebase under code review**

Production hardening revisits this document only after pilot data exists.

---

**End of Architecture Specification v5.0**
