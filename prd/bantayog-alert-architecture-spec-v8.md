# Bantayog Alert — Software Architecture Specification

**Version:** 8.0
**Date:** 2026-04-17
**Status:** Pilot-Ready — Production Hardening Required Before Emergency-Service Dependence
**Stack:** React 18 + Vite + Firebase + Leaflet + Zustand + TanStack Query + Capacitor + Semaphore/Globe Labs (SMS) + Turf.js + BigQuery GIS

---

## 0. How to Read This Document

This is the authoritative architecture specification for Bantayog Alert. It defines capabilities, data-layer boundaries, write authority, failure modes, and acceptance criteria. It is not a UX spec, not a runbook, and not an API reference — those live alongside this document under `docs/`.

**Reading order for new contributors:** §1 (context) → §2 (surfaces + stack) → §5 (data model) → §6 (write authority) → §7 (role workflows) → §15 (risks). The rest is reference material for specific concerns.

**When this document and code disagree:** The Zod schemas in `packages/shared-validators` are source of truth for payload shapes. Firestore security rules in `infra/firebase/firestore.rules` are source of truth for access boundaries. This document is source of truth for _why_ — the rationale, the rejected alternatives, and the invariants that implementation must preserve.

**When to reopen a decision:** The §18 Decision Log is the correct place. Every architectural decision in this spec has a rationale, a rejected alternative, and a residual risk. If conditions change — pilot data contradicts an assumption, a threshold is crossed, a regulatory shift occurs — add a new entry below the last number with reasoning. Do not edit prior entries.

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
11. **Role capability is defined by data-class reach, not by UI.** If a role sees or writes a data class, that appears in the Access Model (§17) and a security rule enforces it. UI affordances that aren't backed by a rule don't exist.
12. **Three deployment surfaces, one backend.** Citizen PWA, Responder Capacitor app, and Admin Desktop PWA are distinct deployables with distinct state-ownership profiles. They share the same Firestore, rules, functions, and audit plane.
13. **Attribution over anonymity for staff actions.** Every privileged action carries `actorId`, `actorRole`, and where applicable `actorMunicipalityId` / `actorAgencyId`. Admin identity is hidden from citizens and the public feed at the presentation layer only, not at the audit layer.
14. **Cost is an availability property.** Firebase usage pricing means unbounded read/write fan-out is a denial-of-service vector against our own budget. Every hot path is modeled for cost, alerted on, and has a circuit breaker.

---

## 2. System Overview

### 2.1 Deployment Surfaces

There are three distinct deployables. Each has its own bundle, its own state-ownership profile, its own offline strategy, and its own auth friction level. They share one Firebase project per environment.

| Surface       | Audience                        | Platform                                               | Offline Strategy                                                                                    | Auth                                        |
| ------------- | ------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Citizen PWA   | Citizens                        | React PWA (iOS Safari, Android Chrome)                 | localForage + Firestore SDK dual-write; SMS fallback for submission                                 | Pseudonymous (auto) or phone-OTP registered |
| Responder App | Responders                      | Capacitor-wrapped React                                | Firestore SDK cache; Capacitor plugins for background location, foreground service, motion activity | Managed staff + MFA (TOTP mandatory)        |
| Admin Desktop | Municipal / Agency / Superadmin | React PWA (desktop-first, dual-monitor for superadmin) | Firestore SDK cache only — admins require connectivity for all mutations                            | Managed staff + MFA + TOTP                  |

**Why PWA-only is acceptable for citizens (with SMS fallback):** The Firestore SDK's IndexedDB-backed offline persistence durably queues writes across app restarts on Android. iOS PWAs have known service-worker eviction risk under storage pressure. Rather than force Capacitor on every citizen, we accept PWA limitations and provide SMS as the universal fallback channel. Every outbound-critical alert fans out on both FCM and SMS.

**Why Capacitor for responders:** PWA is insufficient for responder workflows because iOS and Android both impose background execution and notification constraints. A Capacitor wrapper allows native background-location APIs, richer notification handling, foreground services on Android, and improved device observability. It reduces — but does not eliminate — mobile OS constraints.

**Why Admin Desktop has no offline write queue:** Admin writes are high-stakes multi-document operations (dispatch, verify, mass-alert). An admin silently queuing a `sendMassAlert` for replay 2 hours later is a worse failure mode than forcing them to wait for connectivity. If connectivity is lost, all mutation UI is blocked with a "reconnect to continue" banner.

**Admin field mode — explicit offline write scope.** Municipal and Agency Admins operating from a tablet in the field may enable field mode, a deliberate opt-in UI state. In field mode, the following write classes are queued to Firestore SDK offline cache and replayed on reconnect:

- `addFieldNote` (writes to `report_notes/{id}`)
- `addMessage` (writes to `reports/{id}/messages/{id}`)
- `responders/{self}.availabilityStatus` is not applicable (admins are not responders)

All other mutations — verify, dispatch, cancel, close, reopen, mass-alert, assistance requests, break-glass actions, role changes — are blocked with the reconnect banner regardless of field mode. Entering field mode requires a 4-hour re-auth and is itself a streaming audit event. Field mode auto-exits after 12 hours or on reconnect, whichever comes first. This is the only carve-out from the "no admin offline writes" rule.

**Citizen PWA — surface detail:**

- URL: `bantayog.daet.gov.ph` (or equivalent provincial domain). No app store. Installable as PWA on iOS and Android; also accessible as a regular website.
- Target devices: Chrome 90+ (Android), Safari 14+ (iOS). Also usable on desktop browser for citizens at a computer.
- Performance budget: First Contentful Paint < 2s on 3G. Bundle < 500KB gzipped on initial route; map tiles and Leaflet lazy-loaded.

**Responder App — surface detail:**

- Distributed as a signed APK (Android sideload or managed MDM) and a TestFlight-then-App-Store iOS build. Loaded onto responder-issued devices by Agency Admins during onboarding.
- Target devices: Android 10+ (API 29+) for foreground service support; iOS 15+ for background location entitlement and CMMotionActivityManager.
- Performance budget: App cold start < 3s on mid-range Android (Cherry Mobile / Vivo entry tier common in PH). Background battery < 15% per 12-hour shift at typical motion mix (measured in pilot). Dispatch-received to notification-visible < 5s p95.
- iOS build calendar reality: Apple Developer Program enrollment, provisioning profile setup, TestFlight review, and App Store first-submission collectively require 3–6 weeks of wall time including rejection-and-resubmit cycles. This is on the critical path for Responder App ship and is tracked in §13.11.

**Admin Desktop — surface detail:**

- URL: `admin.bantayog.daet.gov.ph`. Optimized for 1920×1080 monitors; dual-monitor capable for superadmin workstations.
- Target devices: Desktop Chrome/Edge 100+. Tablet-responsive down to 1024px for mobile command post scenarios. Phone-sized viewport renders a "please use a desktop" gate with a link to the Citizen PWA for anyone who hits it by accident.
- Performance budget: Admin dashboard p95 load time < 5s under normal conditions (§19 migration trigger if this degrades). Queue triage mode: 47 pending reports must render and be interactable within 2s on first load. Map with 50 incident pins + 30 live responder markers must maintain 30fps pan/zoom.

### 2.2 Technology Stack

| Layer                           | Technology                                                                         | Why                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| UI Framework                    | React 18                                                                           | Concurrent rendering for real-time updates                                            |
| Build Tool                      | Vite                                                                               | Fast builds, optimized code splitting                                                 |
| State (UI ephemeral)            | Zustand                                                                            | Lightweight; UI-only, no server data                                                  |
| State (server cache)            | Firestore SDK local persistence                                                    | **Single authoritative server cache**                                                 |
| State (query orchestration)     | TanStack Query                                                                     | Non-Firestore HTTP calls, callables, derived views                                    |
| State (outbound queue + drafts) | localForage                                                                        | Dual-write with Firestore SDK for draft durability (Citizen PWA only)                 |
| Maps                            | Leaflet + OpenStreetMap                                                            | Open source, free, offline tile caching                                               |
| Database (structured)           | Firestore                                                                          | Real-time listeners, offline persistence, security rules                              |
| Database (GPS)                  | Firebase Realtime Database                                                         | Bandwidth-priced for high-frequency location                                          |
| Auth                            | Firebase Auth                                                                      | Custom claims, anonymous (pseudonymous) auth, MFA                                     |
| Client integrity                | Firebase App Check                                                                 | Reduces abuse from non-genuine clients                                                |
| Storage                         | Cloud Storage for Firebase                                                         | Resumable photo/video uploads                                                         |
| Functions                       | Cloud Functions v2 (Node.js 20)                                                    | Server-authoritative writes, triggers, scheduled jobs                                 |
| Long-window async               | Cloud Tasks                                                                        | Multi-day retry windows for downstream API calls during outages                       |
| Push                            | Firebase Cloud Messaging                                                           | Dispatch notifications, SOS, in-app mass alerts                                       |
| SMS outbound                    | Semaphore API (primary) + Globe Labs (failover)                                    | Domestic aggregators; better rates, telco compliance, last-mile reliability vs Twilio |
| SMS inbound                     | Globe Labs keyword routing → Cloud Function webhook                                | Citizens on feature phones; zero-data emergency reports                               |
| Responder native                | Capacitor + `@capacitor-community/background-geolocation` + Motion Activity plugin | Background GPS, foreground services, hardware motion detection                        |
| Audit export                    | Cloud Logging → BigQuery (5-min batch + streaming for security events)             | Durable, separately governed audit trail with low-latency security path               |
| IaC                             | Terraform for GCP/IAM/BigQuery; Firebase CLI for rules/functions/indexes           | Named, reproducible infrastructure recovery                                           |

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

1. **Targeted citizen status updates** (outbound, one-to-one). _"Your report has been received, reference 2026-DAET-0471. Responders dispatched."_ Ordinary Semaphore queue. Highest legitimate volume.
2. **Municipality-scoped operational advisories** (outbound, ≤5,000 recipients). _"Barangay Calasgasan residents: road flooding on Maharlika Hwy km 12; avoid route."_ Semaphore priority queue. Municipal Admin authority only (§7.3).
3. **Province-wide or multi-municipality mass alerts → ESCALATE to NDRRMC ECBS, do NOT send ourselves.** For anything requiring broad reach, the system **requests escalation** to NDRRMC/PAGASA (§7.5.1). We do not blast 600,000 SMS via a commercial aggregator — that is slower, more expensive, and legally awkward under RA 10639, which assigns this channel to NDRRMC operating ECBS.
4. **Inbound citizen reports** (inbound). Two ingress shapes, one webhook: (a) feature-phone users text `BANTAYOG <TYPE> <BARANGAY>` to a shared keyword; (b) PWA users in a degraded submission state (`queued` offline or `failed_retryable`) tap "Send as SMS," which opens their native SMS composer pre-filled with an enriched multi-line body that carries the client draft reference for server-side dedup (§9.2). Globe Labs routes both to the same Cloud Function webhook, which writes to `report_inbox` — the same collection the web app writes to. Unified ingestion; the parser in `packages/shared-sms-parser/` handles both formats.

**NDRRMC escalation workflow** (for purpose #3). The `requestMassAlertEscalation` callable captures: draft message, target areas, hazard class, evidence pack (linked reports, PAGASA reference if applicable). This creates a `mass_alert_requests/{id}` document and notifies the PDRRMO Director via priority SMS. The Superadmin reviews and forwards to NDRRMC via `forwardMassAlertToNDRRMC`. ECBS dispatch remains with NDRRMC. Bantayog records the escalation for audit and tracks NDRRMC's response timestamp to measure end-to-end. **The system must not claim to have issued an ECBS alert.** The UX distinguishes "escalation submitted to NDRRMC" from "sent via our SMS layer."

**Provider choice.** Semaphore primary, Globe Labs secondary:

- Semaphore charges ~₱0.50 (~$0.009) per SMS, versus Twilio at ~$0.20 per SMS — over 20× more expensive for Philippine delivery.
- Semaphore's priority queue bypasses the default message queue for time-sensitive messages, routed on SMS paths dedicated to OTP traffic that arrive even when telcos are experiencing high volumes. Emergency alerts use the priority queue.
- Globe Telecom has blocked VRN and long codes for A2P SMS, requiring alphanumeric sender IDs only, and Smart blocks messages containing URL shorteners due to smishing attacks. Domestic aggregators handle sender ID registration with the telcos directly. This matters for getting an approved `BANTAYOG` sender ID that actually delivers.
- Globe Labs provides both outbound sending **and** inbound keyword routing; Semaphore is outbound-only. Globe Labs is therefore required regardless, so using it as the outbound secondary adds no new vendor surface.

**Sender ID approval is on the critical path.** Semaphore sender ID approval for `BANTAYOG` typically takes 2–4 weeks and is subject to telco review that can extend further. Until `BANTAYOG` is approved by both Globe and Smart, the system operates with Semaphore's shared default sender (messages prefixed with "From: ...") and the UI explicitly tells admins that outbound messages will show a generic sender. This is tracked in §13.11 as a pre-prod checklist item. Pilot is not blocked by sender ID approval because the core reporting and dispatch workflows do not require it; only citizen status SMS and municipal advisories benefit from the branded sender.

**The SMS abstraction layer.** A single Cloud Function callable/internal API `sendSMS(to, body, priority, purpose)` hides provider details from all callers. Circuit-breaker logic: if Semaphore returns errors or its p95 latency exceeds 30s over a 5-minute window, new sends route to Globe Labs; a health probe continues hitting Semaphore to decide when to return. Re-entry after 5 minutes of healthy probes. Every attempt is logged to `sms_outbox/{id}` with delivery-report callbacks from both providers writing back status.

Content rules enforced in the abstraction:

- Alphanumeric sender ID only (telco requirement) — `BANTAYOG` once approved; Semaphore default sender until then
- No URL shorteners (Smart blocks them) — only full destination URLs, or no URL at all
- **GSM-7 vs UCS-2 detection is explicit.** If the message body contains characters outside GSM-7 (including `ñ`, `Ñ`, em-dashes, curly quotes, and emojis), the message is sent as UCS-2 with a per-segment limit of 70 characters instead of 160. The admin UI shows a live segment count and unicode warning before send. Emojis are not stripped automatically — a message like "Bgy. Calasgasan: Baha sa Maharlika Hwy km 12" should reach the citizen with correct Tagalog orthography, not mangled ASCII.
- 160-character segments counted for GSM-7; 70 for UCS-2; long alerts split with `(1/3)` `(2/3)` `(3/3)` footers

**Inbound format (feature-phone users).** Users text `BANTAYOG <TYPE> <BARANGAY>` to the keyword. Parser accepts type synonyms: `FLOOD` / `BAHA`, `FIRE` / `SUNOG`, `LANDSLIDE` / `GUHO`, `ACCIDENT` / `AKSIDENTE`, `MEDICAL` / `MEDIKAL`, `OTHER` / `IBA`. Barangay is fuzzy-matched against the 12-municipality barangay gazetteer with Levenshtein distance ≤ 2; on ambiguous match, auto-reply lists candidates. On parse failure, the system auto-replies requesting the correct format. Location precision is barangay-level only; reports are flagged `requiresLocationFollowUp: true` and admin triage handles them the same as GPS-lacking web submissions.

Per-msisdn rate limits: max 5 submissions per msisdn per hour, max 20 per day. The webhook validates that the inbound request came from the configured Globe Labs IP range + shared-secret header. SMS-sourced reports are elevated-moderation by default.

**Inbound format (PWA degraded-state).** When the PWA is in `queued` or `failed_retryable` submission state, tapping "Send as SMS" opens the native SMS composer via a `sms:` URL scheme pre-filled with a multi-line enriched body:

```
BANTAYOG <draft-ref>
<TYPE> <BARANGAY>
<lat>,<lng>
<name>
<msisdn>
Hurt: <count>
```

Example: `BANTAYOG BA-D-4L2P\nFLOOD Daet\n14.1131,122.9553\nJuan Dela Cruz\n09171234567\nHurt: 2`. Target budget: 1 GSM-7 segment (160 chars). The client truncates name to 30 chars and strips diacritics (`é`, `ñ`) on encode to stay in GSM-7 — UCS-2 would halve the budget. The leading `BANTAYOG <draft-ref>` token is the disambiguator: the parser treats presence of a `BA-[DQ]-[A-Z0-9]{4}` token as "enriched format," parses the remaining lines positionally, and sets `reporterMsisdnHash` from the webhook payload as usual.

**Dedup against online retry.** When the citizen taps "Send as SMS," the client sets `draft.smsFallbackSentAt = Date.now()` in localForage. On subsequent network recovery, the online retry submission carries the same draft reference in a new field `clientDraftRef` on the `report_inbox` write. A Cloud Function (`reconcileSmsFallback`) matches on draft reference; if an SMS-originated inbox item with the same ref exists within 24 hours, the online submission is merged into the existing item (augmenting with any fields the SMS version lacked — typically photos) rather than creating a duplicate. Rate limits (3/hr, 10/day) apply per msisdn hash across both ingress shapes — an SMS + online retry pair counts as one.

---

## 4. Identity & Authentication Model

### 4.1 Identity Matrix

| Identity Level         | Auth Method                      | UID                     | Surface         | MFA                                        | Notes                                     |
| ---------------------- | -------------------------------- | ----------------------- | --------------- | ------------------------------------------ | ----------------------------------------- |
| Pseudonymous citizen   | `signInAnonymously()`            | Temporary               | Citizen PWA     | No                                         | Auto on launch                            |
| SMS-identified citizen | `sms_sessions/{msisdnHash}`      | Implicit                | None (SMS only) | No                                         | Phone number = credential via rate limits |
| Registered citizen     | Phone OTP (`linkWithCredential`) | Persistent              | Citizen PWA     | Optional (phone-OTP repeat)                | Links pseudonymous history                |
| Responder              | Managed staff + phone OTP        | Persistent              | Responder App   | **Required (TOTP)**                        | Created by Agency Admin                   |
| Municipal Admin        | Managed staff + phone OTP        | Persistent              | Admin Desktop   | **Required (TOTP)**                        | Created by Superadmin                     |
| Agency Admin           | Managed staff + phone OTP        | Persistent              | Admin Desktop   | **Required (TOTP)**                        | Created by Superadmin                     |
| Provincial Superadmin  | Managed staff + phone OTP        | Persistent              | Admin Desktop   | **Required (TOTP) + isPrivileged session** | Quarterly re-verify                       |
| Break-glass            | Sealed escrow + dual-control     | Persistent but disabled | Admin Desktop   | **Required (TOTP)**                        | §11.6                                     |

**Privacy-language commitment:** Anonymous Firebase Auth is **not** equivalent to guaranteed real-world anonymity. It provides a pseudonymous technical identity that may later be linked to a registered account via `linkWithCredential()` if the user chooses to upgrade. A court order can compel linkage. App Check retains abuse signals. Firebase logs retain IP short-term. Citizen-facing copy must use language like "without registering" or "pseudonymous" — not "anonymous." Privacy notices must explicitly list what is retained for a pseudonymous report: pseudonymous UID, optional voluntary contact (goes to `report_contacts`), GPS, photos (EXIF-stripped), IP (short-term), msisdn hash if SMS.

### 4.2 Custom Claims

```typescript
interface CustomClaims {
  role: 'citizen' | 'responder' | 'municipal_admin' | 'agency_admin' | 'provincial_superadmin'
  municipalityId?: string // For municipal_admin; and for agency_admin scoped to one muni
  agencyId?: string // For agency_admin and responder
  permittedMunicipalityIds?: string[] // For superadmin: all 12; for scoped roles: typically [municipalityId]
  accountStatus: 'active' | 'suspended' | 'disabled'
  mfaEnrolled: boolean
  lastClaimIssuedAt: number // epoch ms; used for revocation detection
  breakGlassSession?: boolean // set only on break-glass activation
}
```

Custom claims are a performance optimization to avoid a Firestore read per authorization decision on every request. They are **not** a revocation channel; see §4.3 for the revocation architecture.

### 4.3 Revocation and JWT Staleness

Firebase ID tokens are valid for 1 hour regardless of backend state. A suspended admin could retain access for up to 60 minutes if relying only on cached claims. Three-layer mitigation:

1. **`active_accounts/{uid}` collection.** The `isActivePrivileged()` rule helper reads this document on every privileged operation. Suspension writes `accountStatus: 'suspended'` here, which causes rule rejection on the next privileged op regardless of cached claim. §5.7 addresses the read-cost concern.
2. **`claim_revocations/{uid}` collection.** The client listens to its own revocation doc. On write, the client forces a token refresh and redirects to re-auth. Emergency access revocation target: < 30 seconds from admin click.
3. **Token refresh cadence.** Clients refresh tokens every 30 minutes in the background during active use, bounding the stale-claim window when the revocation listener misses (e.g., client offline during revocation).

### 4.4 Session Timeout

"Session timeout" at the app layer means prompt-for-OTP-again, not hard-expire the Firebase token. Intervals:

- Responder: 12 hours
- Municipal / Agency Admin: 8 hours
- Superadmin: 4 hours; plus re-auth required to enter `isPrivileged` state for sensitive reads

### 4.5 MFA and TOTP

All staff accounts require TOTP enrollment. MFA adoption friction among field staff is a known risk (§16); pilot measures the drop-off rate and identifies whether hardware tokens (YubiKey or similar) are needed for responders who struggle with TOTP apps on duty phones.

---

## 5. Data Model and Storage

### 5.1 The Report Triptych

Each report is represented by three documents, each with distinct access boundaries:

- `reports/{reportId}` — **Public-classifiable metadata.** What the system is willing to show on public maps and feeds after classification: location (coarsened for public view), type, severity, status, timestamps, visibilityClass. Readable under `canReadReportDoc()` which permits public reads only when `visibilityClass == 'public_alertable'`.
- `report_private/{reportId}` — **Restricted personal data.** Reporter UID, raw GPS, msisdn hash, voluntary contact fields, submission IP. Admin-readable with streaming audit; never citizen-visible except for the reporter's own report.
- `report_ops/{reportId}` — **Restricted operational state.** Assigned agencies, classification notes, verification state machine fields, cross-municipality sharing. Admin-only.

**Why three documents instead of one with field masking.** Firestore security rules evaluate per-document, not per-field. A single-document model requires every reader to have access to every field, or requires client-side filtering as a trust boundary (Principle 2 prohibits this). The triptych makes the access boundary explicit at the document layer, which rules can enforce.

**Consistency across the triptych is maintained by server-side transactions,** never by client reconciliation. See §10.3.

**`reports/{reportId}` — Public-classifiable metadata**

```typescript
{
  municipalityId: string
  barangayId?: string
  reporterRole: 'citizen' | 'responder'
  reportType: ReportType
  severity: Severity
  status: ReportStatus
  publicLocation?: GeoPoint     // Coarsened to ~200m grid for public display
  mediaRefs: string[]           // Storage paths, not URLs
  description: string           // Sanitized; PII-scrubbed on verification
  submittedAt: Timestamp
  verifiedAt?: Timestamp
  resolvedAt?: Timestamp
  archivedAt?: Timestamp
  deletedAt?: Timestamp
  retentionExempt: boolean
  visibilityClass: 'internal' | 'public_alertable'
  visibility: {
    scope: 'municipality' | 'shared' | 'provincial'
    sharedWith: string[]
  }
  source: 'web' | 'sms' | 'responder_witness'
  witnessPriorityFlag?: boolean
  hasPhotoAndGPS: boolean
  duplicateClusterId?: string
  mergedInto?: string
  schemaVersion: number
}
```

**`report_private/{reportId}` — Restricted personal data**

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
  visibility: {
    scope: 'municipality' | 'shared' | 'provincial'
    sharedWith: string[]
    sharedReason?: string
    sharedAt?: Timestamp
    sharedBy?: string
  }
  // Hazard tagging (§22) — denormalized from report_private.exactLocation
  locationGeohash?: string          // 6-char geohash of GPS; set only when locationPrecision === 'gps'
  hazardZoneIds?: HazardTag[]       // Append-only audit-grade tag history
  hazardZoneIdList?: string[]       // Flat array — queryable via array-contains
  updatedAt: Timestamp
  schemaVersion: number
}

interface HazardTag {
  zoneId: string
  zoneVersion: number
  hazardType: 'flood' | 'landslide' | 'storm_surge'
  severity: 'high' | 'medium' | 'low'
  taggedAt: Timestamp
  taggedBy: 'ingest' | 'zone_sweep'
}
```

**Free-form admin notes containing PII are prohibited on this document.** Narrative notes go in `report_notes/{noteId}` with author, classification, and timestamp.

**Why `status`, `severity`, and `createdAt` are denormalized onto `report_ops`:** A common dispatcher query is "all high-severity unresolved reports currently assigned to the Red Cross." `severity` lives on `reports`; `agencyIds` lives on `report_ops`. Without denormalization, this requires two queries plus an N+1 fan-out — fatal under surge load with hundreds of active reports. Mirroring these three fields onto `report_ops` allows dispatchers to query a single collection with a composite index. The mirrored fields are maintained inside Firestore transactions by `processInboxItem` and status-transition callables. This is a deliberate write-amplification trade-off against read-heavy admin dashboards.

**Why `locationGeohash` and hazard tags are denormalized onto `report_ops` (§22):** The hazard zone sweeper (§22.5) must query reports by location when a custom zone is edited. Exact GPS lives on `report_private`, which is audit-streamed on every privileged read — a bulk sweep reading thousands of `report_private` docs would flood the streaming audit path. Denormalizing a 6-char geohash (~1.2km precision) onto `report_ops` solves this: the sweeper never touches `report_private`. `hazardZoneIds[]` carries audit-grade tag history (who tagged when, which zone version); `hazardZoneIdList[]` is the flat mirror required because Firestore's `array-contains` needs primitive equality. Both are maintained atomically in the same write. Same denormalization principle as `status`/`severity`/`createdAt`.

**Sharing state is a separate document, not a field on `report_ops`.** Border-incident sharing mutations (`sharedWith` array changes, `sharedReason`, etc.) live on `report_sharing/{reportId}`. Reason: every mutation to `sharedWith` invalidates listener cache views for every admin subscribed to that municipality's `report_ops` query. During a typhoon with many cross-border incidents auto-shared, this caused admin dashboard render-thrash in synthetic load tests. Isolating sharing mutations to a sibling document keeps `report_ops` listeners stable.

```typescript
report_sharing/{reportId}
  reportId: string
  ownerMunicipalityId: string
  scope: 'municipality' | 'shared' | 'provincial'
  sharedWith: string[]
  sharedReason?: string
  sharedAt?: Timestamp
  sharedBy?: string
  updatedAt: Timestamp
```

Admin queries that previously joined on `report_ops.visibility.sharedWith` now query `report_sharing` with `(sharedWith CONTAINS + updatedAt desc)`.

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
  requestedByMunicipalAdmin?: boolean
  requestId?: string                    // ref to agency_assistance_requests/{id}
  idempotencyKey: string
  idempotencyPayloadHash: string        // SHA-256 of canonical payload; see §6.2
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

| From              | To                       | Actor                           | Write                   | Side effects                                      |
| ----------------- | ------------------------ | ------------------------------- | ----------------------- | ------------------------------------------------- |
| —                 | `draft_inbox`            | Client                          | Direct (`report_inbox`) | None yet                                          |
| `draft_inbox`     | `new`                    | System (trigger)                | Server                  | Triptych materialized                             |
| `draft_inbox`     | `new`                    | System (callable)               | Server                  | Responder-witness path (§7.2)                     |
| `draft_inbox`     | `rejected`               | System (trigger)                | Server                  | `moderation_incidents` entry                      |
| `new`             | `awaiting_verify`        | Municipal Admin or Superadmin   | Server callable         | Audit event                                       |
| `new`             | `merged_as_duplicate`    | Municipal Admin or Superadmin   | Server callable         | `mergedInto` set; duplicate cluster updated       |
| `awaiting_verify` | `verified`               | Municipal Admin or Superadmin   | Server callable         | `verifiedBy`, `verifiedAt`; FCM + SMS to reporter |
| `awaiting_verify` | `merged_as_duplicate`    | Municipal Admin or Superadmin   | Server callable         | As above                                          |
| `awaiting_verify` | `cancelled_false_report` | Municipal Admin or Superadmin   | Server callable         | Audit + moderation event                          |
| `verified`        | `assigned`               | Municipal Admin or Agency Admin | Server callable         | Dispatch created; responder FCM                   |
| `assigned`        | `acknowledged`           | Responder                       | Direct                  | Dispatch state linked                             |
| `acknowledged`    | `en_route`               | Responder                       | Direct                  | RTDB telemetry begins                             |
| `en_route`        | `on_scene`               | Responder                       | Direct                  | Geofence exit event logged                        |
| `on_scene`        | `resolved`               | Responder                       | Direct                  | Resolution summary required                       |
| `resolved`        | `closed`                 | Municipal Admin                 | Server callable         | Report locks; SMS closure to reporter if opted in |
| `closed`          | `reopened`               | Municipal Admin                 | Server callable         | Returns to `assigned`; audit event                |
| Any active        | `cancelled`              | Admin (with reason)             | Server callable         | All active dispatches cancelled                   |

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

**Responder-vs-admin race recovery.** A responder can race an admin on dispatch transitions: responder taps `in_progress → resolved` at the same moment admin calls `cancelDispatch`. The admin callable always wins because it runs inside a server transaction reading fresh state. The responder's direct write will be rejected by the rule (from-state mismatch). The Responder App must handle this rejection as a non-fatal event:

1. On write rejection with `permission-denied` on a dispatch mutation, the app does NOT treat it as a generic error.
2. It re-fetches the dispatch document to get current server state.
3. If current state is `cancelled` or `superseded`, the app transitions the screen to a "This dispatch was cancelled by [institutional label]; close this screen" view with a reason shown if available.
4. If current state is something else (e.g., a previous transition the responder hasn't synced), it updates UI to match and the responder can retry.

This recovery UX is a pilot blocker — untested, it will produce angry field feedback on the first admin-initiated cancel that races a responder status change.

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
  report_sharing/{reportId}          # Border-incident sharing state; isolated from report_ops
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
  hazard_signals/{signalId}               # PAGASA / NDRRMC weather signals (§10.2)
  hazard_zones/{zoneId}                   # Geographic hazard polygons: reference layers + custom zones (§22)
    history/{version}                     # Immutable snapshot of prior zone state
  incident_response_events/{id}           # Data incident response timeline (§14)

rtdb/
  responder_locations/{uid}
  responder_index/{uid}                   # {municipalityId, agencyId} — CF-maintained
  shared_projection/{municipalityId}/{uid}  # 30s-sampled cross-agency map projection, read-per-muni (§8.5)
```

### 5.6 Agency Assistance Request Schema

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

**Cost of `isActivePrivileged()` is modeled, not hand-waved.** The helper issues one `get()` to `active_accounts/{uid}` per privileged read or write. In synthetic load modeling: 12 municipalities × 3 concurrent admins × 200 privileged reads per admin per hour during surge = 7,200 rule-layer `get()` reads per hour, plus another equivalent volume from writes. Daily cost at surge sustain: ~$0.30 in Firestore reads just for this helper. At steady state, far less. Annual modeling does not cross the §19 migration trigger threshold. Cost alert at 5× baseline fires before this would become a budget concern. Mitigations if pilot data exceeds model: (a) cache `accountStatus` in a custom claim with 15-minute TTL and a targeted revocation push; (b) scope `isActivePrivileged()` to write paths only and accept the wider revocation window on reads. No change made pre-pilot — the cost is acceptable and the simpler model is better.

We use `get()` lookups for `messages`, `field_notes`, and the `isActivePrivileged()` check. Each `get()` is a billable read. This is a deliberate trade against denormalization complexity — we accept the read cost on these moderate-traffic paths rather than duplicate mutable state on every write. High-traffic paths (`reports`, `report_ops`) use field denormalization instead.

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
          || (isMuniAdmin()
              && exists(/databases/$(database)/documents/report_sharing/$(data.__reportId))
              && myMunicipality() in get(/databases/$(database)/documents/report_sharing/$(data.__reportId)).data.sharedWith);
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
                                 'reporterRole','mergedInto','updatedAt']);

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
      );
      allow write: if false;
    }

    match /report_sharing/{r} {
      allow read: if isActivePrivileged() && (
        adminOf(resource.data.ownerMunicipalityId)
        || (isMuniAdmin() && myMunicipality() in resource.data.sharedWith)
        || isSuperadmin()
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
    match /hazard_signals/{s} { allow read: if isAuthed(); allow write: if false; }
    match /moderation_incidents/{m} {
      allow read: if isActivePrivileged() && (isMuniAdmin() || isSuperadmin());
      allow write: if false;
    }

    // --- SMS layer ---
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

    // --- Break-glass ---
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

    // --- Agency assistance requests ---
    match /agency_assistance_requests/{requestId} {
      allow read: if isActivePrivileged() && (
        (isMuniAdmin() && resource.data.requestedByMunicipality == myMunicipality())
        || (isAgencyAdmin() && resource.data.targetAgencyId == myAgency())
        || isSuperadmin()
      );
      allow write: if false;  // Callable only
    }

    // --- Command channel ---
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

    // --- Mass alert requests ---
    match /mass_alert_requests/{requestId} {
      allow read: if isActivePrivileged() && (
        isSuperadmin()
        || (isMuniAdmin() && resource.data.requestedByMunicipality == myMunicipality())
      );
      allow write: if false;
    }

    // --- Shift handoffs ---
    match /shift_handoffs/{handoffId} {
      allow read: if isActivePrivileged()
                  && (request.auth.uid == resource.data.fromUid
                      || request.auth.uid == resource.data.toUid
                      || isSuperadmin());
      allow write: if false;
    }

    // --- Incident response (§14) ---
    match /incident_response_events/{id} {
      allow read: if isSuperadmin() && isActivePrivileged();
      allow write: if false;
    }

    // --- Hazard zones (§22) ---
    // Muni admin reads: all reference layers (province-wide hazard data) + own-muni custom zones only.
    // Provincial-scope custom zones are invisible to muni admins; Superadmin coordinates cross-muni via Command Channel.
    // Agency admin / Responder / Citizen: default-deny (no read path, no write path).
    match /hazard_zones/{zoneId} {
      allow read: if isActivePrivileged() && (
        isSuperadmin()
        || (isMuniAdmin() && (
          resource.data.zoneType == 'reference'
          || resource.data.municipalityId == myMunicipality()
        ))
      );
      // All mutations callable-only (geometry simplification + audit streaming can't be expressed in rules)
      allow create, update, delete: if false;

      // History subcollection — denormalized zoneType + municipalityId on each doc means rules can
      // scope reads without a get() on parent zone. Avoids unbounded billable reads during bulk review.
      match /history/{version} {
        allow read: if isActivePrivileged() && (
          isSuperadmin()
          || (isMuniAdmin() && (
            resource.data.zoneType == 'reference'
            || resource.data.municipalityId == myMunicipality()
          ))
        );
        allow write: if false;
      }
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
    "shared_projection": {
      "$municipalityId": {
        ".read": "auth != null
                  && auth.token.accountStatus === 'active'
                  && (auth.token.role === 'provincial_superadmin'
                      || (auth.token.role === 'municipal_admin' && auth.token.municipalityId === $municipalityId)
                      || auth.token.role === 'agency_admin')",
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
- `report_ops`: (municipalityId + status + severity desc + createdAt desc), (agencyIds CONTAINS + status + createdAt desc), (duplicateClusterId + createdAt)
- `report_sharing`: (sharedWith CONTAINS + updatedAt desc), (ownerMunicipalityId + updatedAt desc)
- `dispatches`: (responderId + status + dispatchedAt desc), (reportId + status), (agencyId + status + dispatchedAt desc), (municipalityId + status + dispatchedAt desc)
- `alerts`: (targetMunicipalityIds CONTAINS + sentAt desc)
- `report_inbox`: (processingStatus + createdAt) — used by inbox backlog monitoring
- Lifecycle/cleanup: (deletedAt + retentionExempt), (archivedAt + retentionExempt)

**SMS layer:**

- `sms_outbox`: (providerId + status + createdAt desc), (purpose + createdAt desc)

**Event streams:**

- `report_events`: (reportId + createdAt desc), (actor + createdAt desc)
- `dispatch_events`: (dispatchId + createdAt desc)

**Coordination collections:**

- `agency_assistance_requests`: (targetAgencyId + status + createdAt desc), (requestedByMunicipality + status + createdAt desc)
- `shift_handoffs`: (toUid + status + createdAt desc)

**Hazard collections (§22):**

- `hazard_zones`: (zoneType + hazardType + createdAt desc) — admin list by type
- `hazard_zones`: (scope + municipalityId + zoneType + createdAt desc) — muni admin's zone list
- `hazard_zones`: (geohashPrefix + deletedAt + hazardType) — ingest auto-tag candidate lookup
- `hazard_zones`: (expiresAt + zoneType + deletedAt) — expiration sweeper
- `report_ops`: (municipalityId + hazardZoneIdList ARRAY + createdAt desc) — admin filter "reports in zone X"
- `report_ops`: (locationGeohash + createdAt desc) — zone sweep candidate lookup by geohash prefix

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
- `shareReportWithMunicipality`, `unshareReportFromMunicipality` — writes to `report_sharing`
- Media registration (signed URL issuance with size/MIME enforcement)
- User/role administration; account suspension; `revokeResponderAccess`
- `initiateShiftHandoff`, `acceptShiftHandoff`, `initiateResponderHandoff`
- `triggerSOS`, `requestBackup`, `requestProvincialEscalation`, `markDispatchUnableToComplete`
- `closeReport`, `reopenReport`
- All report lifecycle transitions except those marked responder-direct below
- Export workflows, `lookupReportByToken`, `requestErasure`
- `enterFieldMode`, `exitFieldMode` — admin field-mode transitions
- Hazard zone mutations (§22): `uploadHazardReferenceLayer`, `supersedeHazardReferenceLayer`, `createCustomHazardZone`, `updateCustomHazardZone`, `deleteCustomHazardZone`, `requestHazardUploadUrl`
- Hazard analytics: `hazardAnalyticsZoneTagCounts`, `hazardAnalyticsMunicipalityRiskDensity`, `hazardAnalyticsReportsInZone`

**Direct client writes with rule-bounded scope:**

- Citizen → `report_inbox` (web; SMS goes via webhook)
- Responder → `dispatches/{id}` for `accepted→acknowledged→in_progress→resolved` and `pending→declined`
- Responder → `responders/{self}.availabilityStatus`
- User → `users/{self}` field-restricted
- Admin (field mode only) → `report_notes/{id}` and `reports/{id}/messages/{id}` (replays on reconnect)

**Client-side offline queuing does not equal server acceptance.** UI distinguishes `queued`, `submitting`, `server_confirmed`, `failed_retryable`, `failed_terminal`.

**Why citizen submission is a direct inbox write, not a callable:** A callable requires a synchronous round-trip to Cloud Functions, which requires a fresh App Check token, which requires online attestation. On flaky 2G in mountainous barangays, that round-trip fails and the report drops. The Firestore SDK's offline persistence durably queues direct writes across app restarts — battle-tested across the Firebase ecosystem. We accept the inbox write into a quarantine collection, validate on the trigger side, and let `processInboxItem` materialize the real triptych. Failed validations land in `moderation_incidents` for human review rather than silently dropping a report.

**App Check on the inbox path is a soft gate, not a hard rejection.** App Check failure on an inbox write results in the item being flagged for elevated moderation. It does **not** cause rejection. Rejecting an offline-replayed legitimate report from a citizen in a disaster zone is worse than accepting it for human review. App Check failure is therefore treated as an elevated-risk signal, not a disqualifying one.

### 6.2 Idempotency

Every server-authoritative command accepts an `idempotencyKey` scoped to `(actor, commandType, logicalTarget)`. 24h TTL. Implementation:

1. **Canonical payload hash.** The payload is serialized by sorting keys alphabetically (recursive) and applying JSON.stringify with no whitespace. SHA-256 of that canonical form is `idempotencyPayloadHash`.
2. **Dedup check.** The callable opens a Firestore transaction. It reads `idempotency_keys/{key}`:
   - If missing → writes `{key, payloadHash, firstSeenAt, resultRef}` and proceeds with the mutation. On success, `resultRef` is updated with the document ref (or result payload) of the original result.
   - If present and `payloadHash` matches → returns the original result from `resultRef`. No mutation.
   - If present and `payloadHash` differs → throws `ALREADY_EXISTS_DIFFERENT_PAYLOAD` with original `firstSeenAt` for debugging.
3. **Document-side persistence.** Documents like `dispatches/{id}` persist both `idempotencyKey` and `idempotencyPayloadHash` for forensic audit. The authoritative check is always `idempotency_keys/{key}` — the document fields are for traceability.

**SMS outbound idempotency** uses `(reportId, purpose, recipientMsisdn)` as the key — a retry of a "your report was received" alert cannot result in the citizen getting two texts.

Triggered side effects use deduplication keys derived from `(eventId, sideEffectType)`.

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
- Admin identity (individual names) never surfaced; institutional labels only

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

**Verified Responder Report flow.** A responder witnessing an incident directly can create a pre-classified report that skips the `draft_inbox → new` step but does NOT skip `awaiting_verify → verified`. It is an accelerated intake, not a verification bypass.

1. Responder taps "Report What I'm Seeing."
2. Fills short form: type, severity (suggested), GPS (auto-captured, required), photo (required), short description.
3. Calls `submitResponderWitnessedReport` with idempotency key.
4. Server writes `reports/{reportId}` directly at state `new` with `source: 'responder_witness'`, `reporterId`, `reporterRole: 'responder'`, `witnessPriorityFlag: true`.
5. FCM fires to the municipal admin of the geo-resolved municipality AND to the responder's own agency admin.
6. Municipal admin sees a "Responder-Witnessed" badge; still must execute `awaiting_verify → verified` but `hasPhotoAndGPS` is guaranteed true so verification is fast.
7. Audit log records the bypass of `draft_inbox` and the identity of the responder.
8. If the responder is geo-resolved to a municipality outside their `permittedMunicipalityIds`, the report is still created but flagged `crossJurisdictionFlag: true` for superadmin attention.

**Race-loss recovery UX.** When a responder's direct dispatch-status write is rejected (admin cancelled/superseded the dispatch in parallel), the Responder App must:

- Not show a generic error modal.
- Re-fetch the dispatch document.
- Transition to a "This dispatch is no longer active" screen with the institutional label of the canceller (never the admin's personal name) and the cancellation reason if present.
- Offer "Return to queue" as the only action. This is tested in §14 pilot-blocker scenario 25.

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

**Scope:** One municipality. No cross-municipality authority except shared border incidents (§7.3.2).

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
- **Send municipality-scoped mass alerts** via `sendMassAlert` callable — routing enforced per §3: if estimated SMS recipients ≤ 5,000 AND target is single municipality → FCM + Semaphore priority queue; otherwise → NDRRMC Escalation Request. Before confirming, the admin sees a **Reach Plan** preview (computed by `massAlertReachPlanPreview` callable) showing estimated recipients by channel.
- **View own municipality's responders' real-time telemetry** (RTDB direct read, rule-scoped)
- **View other-agency responders on incidents in own municipality** (ghosted 100m-grid projection, §8.5)
- **Close resolved incidents:** `closeReport` callable
- **Reopen closed incidents:** `reopenReport` callable
- **View municipality analytics**
- **Hazard overlay & custom zones (§22):** view all reference layers (province-wide) + own-muni custom zones; author / edit / delete any custom zone in own municipality (regardless of authorship, per Principle #11 — authorization by data-class reach, not by authorship); view auto-tagged hazard zones on reports (`report_ops.hazardZoneIdList`); send polygon-targeted mass alerts within own muni via extended `massAlertReachPlanPreview` / `sendMassAlert` (≤5k direct, else escalate); view own-muni hazard analytics via `hazardAnalytics*` callables.
- **Shift handoff** (§7.6)
- **Field mode:** `enterFieldMode`, `exitFieldMode` — limited offline writes (§2.1)

**Constraints:**

- Cannot view or write to reports outside own municipality, except shared border incidents
- Cannot dispatch responders outside own municipality
- Cannot see other municipalities' analytics (anonymized comparisons OK)
- Cannot modify citizen report content (can only classify)
- Cannot bypass responder opt-in (dispatches go to `pending`)
- Cannot promote users or change roles (superadmin only)
- **Hazard constraints (§22):** cannot upload hazard reference layers (Superadmin-only for data provenance); cannot view other munis' custom zones; cannot view or edit provincial-scope custom zones (Superadmin-authored, out of jurisdiction); cannot author custom zones outside own municipality (rule-enforced bbox check)

#### 7.3.1 Surge Triage Mode

- Activated via UI toggle; client-side filter/sort optimization only, no server behavior change
- Queue renders in a scannable list instead of map overlays
- Single-key shortcuts: `V` verify, `R` reject, `M` merge-with-selected, `S` skip
- Bulk operations use the same per-report callables — no special "bulk verify" that short-circuits rule checks
- Loading bound: 100 reports rendered, older paginated

#### 7.3.2 Border Incidents (Shared Visibility)

- A report's `report_sharing/{reportId}` document is the authoritative sharing state
- Sharing is initiated by a CF trigger when geo-intersection of report location + municipal boundary buffer (500m) detects the report is near a border, or by explicit admin action via `shareReportWithMunicipality` callable
- All sharing actions write to `report_sharing` and to audit (`sharedBy`, `sharedReason`, `sharedAt`)
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
- **Field mode:** `enterFieldMode`, `exitFieldMode` — limited offline writes (§2.1)

**Constraints:**

- **No report verification authority.** Only Municipal Admins and Provincial Superadmins verify. The Verified Responder Report bypass (§7.2) still routes through a municipal admin for final verification — the agency admin is not in that path.
- **No mass alerts to citizens** — operational messaging to own responders only via the message subcollection.
- **No dispatching other agencies.**
- **No managing other agencies' rosters.**
- **No system-wide analytics** (agency-scoped only).
- **No "Incident Commander" tag.** The existing state machine answers every operational question: who can cancel a dispatch (dispatching admin + superadmin), who can close a report (municipal admin of that municipality + superadmin), who can redispatch (same). Inter-agency conflicts are resolved via Command Channel threads, not a tag.
- **No hazard-zone access whatsoever (§22).** Agency admins cannot read reference layers, custom zones, or zone history; cannot call any hazard callable; cannot send polygon-targeted mass alerts; cannot see hazard analytics. Matches their vertical scope (authority over own agency's roster, not LGU triage/mapping tools). Rule-enforced default-deny + UI-enforced (no Hazard Layers tab rendered).

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
- **Hazard reference + provincial zones (§22):** upload new hazard reference layers (flood, landslide, storm surge) via `uploadHazardReferenceLayer`; supersede prior versions via `supersedeHazardReferenceLayer`; author / edit / delete province-wide custom zones OR any muni's custom zones (any authorship); view all hazard zones province-wide; view province-wide hazard analytics (unrestricted scope via `hazardAnalytics*` callables); send polygon-targeted mass alerts at any scale with Reach Plan preview.
- **Incident response actions** (§14): declare data incident, mark breach notifications sent

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

| Hardware-reported activity                        | GPS polling                        | Rationale                                              |
| ------------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| `running` / `in_vehicle` (high priority dispatch) | 10s ± 2s                           | Real-time tracking during active response              |
| `walking` (normal priority)                       | 30s ± 5s                           | Moving but not urgent                                  |
| `still` + on active dispatch                      | Geofence-only + 5-minute GPS ping  | Stationary at staging; rely on geofence exit to resume |
| `still` + low battery (<20%)                      | Geofence-only + 10-minute GPS ping | Battery preservation                                   |
| No active dispatch                                | No tracking                        | Zero-telemetry off-duty                                |

- **Android:** Activity Recognition API via `@capacitor-community/background-geolocation`.
- **iOS:** CMMotionActivityManager via Capacitor plugin.

Geofence setup on `acknowledged` state: 50m radius around the responder's current position. Exit triggers resumption of active GPS polling.

Jitter (± values above) prevents thundering-herd reconnection when a cell tower recovers and many responders transmit simultaneously.

### 8.3 Stale-State Display

Admin display freshness bands are calibrated to the emission model:

| `telemetryStatus` | Definition                                                        | Operator UX                                  |
| ----------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| `live`            | `receivedAt` within 2× expected interval for current motion state | Normal display                               |
| `degraded`        | Within 4× expected interval                                       | Yellow tint, age label                       |
| `stale`           | Exceeds 4× expected interval                                      | Gray, "last seen X ago", warning banner      |
| `offline`         | No `receivedAt` for 5+ min during active dispatch                 | Red, dispatcher alert, manual contact prompt |

### 8.4 Cost Behavior Under Degraded Networks

Baseline ~$0.40/day at 30 responders × 24h × adaptive intervals × 120-byte payloads × 12 listeners. Under degraded networks, websocket reconnection storms can multiply this 10×–100× as listeners re-sync state on each reconnect. Budget alerts fire at 5×, 10×, and 25× baseline. Connection backoff uses exponential jitter.

### 8.5 Cross-Agency Visibility Projection

Letting 12 agencies each subscribe to every other agency's full RTDB tree is a cost and privacy problem. The projection design was revised in v8 to reduce write amplification and fan-out.

**Design:** A CF job `projectResponderLocationsForMunicipalities` runs every 30 seconds:

- Iterates active dispatches, grouped by municipality
- For each responder on active dispatch, writes to `rtdb/shared_projection/{municipalityId}/{responderUid}`:
  - `lat`, `lng` rounded to 100m grid (privacy-preserving)
  - `agencyId` of responder
  - `status` (`en_route` | `on_scene`)
  - `updatedAt` server timestamp
- Each entry has 90s TTL; if not refreshed, cleared
- **Reads:** All admin roles subscribe to the `shared_projection/{municipalityId}` node relevant to them — municipal admins subscribe to their own municipality only; agency admins subscribe to any municipality their agency is active in; superadmin subscribes to all.

**Why per-municipality instead of per-agency:** The previous design wrote 30 responders × 12 agencies = 360 writes per 30s with proportional listener fan-out to every agency's admin clients. The revised design writes 30 responders × (number of municipalities those responders are in, typically 1–3) = 30–90 writes per 30s. At the §19 migration trigger threshold of 500+ concurrent dispatches, this scales to 500–1500 writes per 30s rather than 6,000.

Own-agency responders are read directly from `responder_locations/{uid}` at full fidelity via the existing rule.

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

| Data category                                   | Authority                         | Everything else must                       | Rationale                                                        |
| ----------------------------------------------- | --------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| Server documents (reports, alerts)              | Firestore SDK local persistence   | Read via listeners, never cache separately | Single source of server truth; offline persistence is SDK-native |
| UI state (modal, form field, tab)               | Zustand                           | Never duplicate in server cache            | UI-only; not persisted to server                                 |
| Non-Firestore HTTP (callables, tracking lookup) | TanStack Query                    | Never hand-cache in Zustand                | Built-in invalidation + retry                                    |
| Drafts + queued submissions                     | localForage + Firestore SDK queue | Always write to both                       | SDK queue alone is vulnerable to IndexedDB eviction on iOS       |
| Tracking secrets                                | localForage                       | Never in Zustand                           | Survives app restart                                             |
| Session / auth state                            | Firebase Auth SDK                 | Everything reads via `onAuthStateChanged`  | Auth SDK is authoritative                                        |

**Responder App:**

| Data category                                    | Authority                                |
| ------------------------------------------------ | ---------------------------------------- |
| Server documents (dispatches, reports, messages) | Firestore SDK                            |
| UI state                                         | Zustand                                  |
| Non-Firestore HTTP (callables)                   | TanStack Query                           |
| Foreground-service status                        | Capacitor Preferences                    |
| Last known motion activity                       | Capacitor Preferences + in-memory        |
| GPS telemetry                                    | Write-only to RTDB; no local persistence |

No outbox layer. Responder writes are single-actor sequential transitions on dispatches the responder owns; SDK queue handles reconnection correctly.

**Admin Desktop:**

| Data category                                                 | Authority                                           |
| ------------------------------------------------------------- | --------------------------------------------------- |
| Server documents (reports, dispatches, responders, analytics) | Firestore SDK                                       |
| UI state (map viewport, selected entity, panel, filters)      | Zustand                                             |
| Non-Firestore HTTP (callables, analytics aggregates, exports) | TanStack Query                                      |
| Field-mode queue (notes, messages only)                       | Firestore SDK offline cache — replayed on reconnect |

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
3. **User-visible persistence confirmation.** After submit, the UI shows _"Your report is saved on this device. Reference: 2026-DAET-0471. Take a screenshot or save this code."_ This converts the reference into a paper-form fallback.
4. **SMS fallback for any PWA in a degraded submission state.** The Reveal UI offers "Send as SMS" as a parallel fallback to "Call hotline" in two cases: (a) `queued` — the device is offline at submission time; (b) `failed_retryable` — submission reached the network but the server rejected or timed out. On iOS, this path is also triggered if IndexedDB appears compromised (write-then-read probe fails), because iOS lacks Background Sync and cannot recover the queued submission on its own. The pre-filled `sms:` link uses the enriched format defined in §3. The client records `draft.smsFallbackSentAt` and includes `clientDraftRef` in any later online retry so the server can dedupe (see §3 "Dedup against online retry"). SMS fallback is hidden on platforms where `sms:` URL schemes are unsupported (desktop browsers, locked kiosks).
5. **Background Sync API** is used where available (Chromium browsers) to retry when the browser is closed. iOS does not implement Background Sync; iOS users rely on the app being reopened — which is why SMS fallback exists.

### 9.3 Failure-State UX

Critical screens display:

- Network state indicator (online / offline / degraded)
- Last successful sync timestamp
- Stale data warnings
- Pending write counter (and what's pending)
- "Reconnect and continue" prompt when blocked
- For admin surfaces: "Field mode available" hint when offline persists >60s

### 9.4 Responder Race-Loss Recovery (Cross-Reference)

See §5.4 and §7.2 for responder race-loss recovery UX. This is an enforced pattern, not ad-hoc error handling.

---

## 10. Backend — Cloud Functions Architecture

### 10.1 Function Types

**Event-driven triggers:**

- `onCreate report_inbox` → `processInboxItem` (materializes triptych, elevates for moderation on App Check fail)
- `onWrite dispatches/{id}` → `onDispatchStatusChange` (audit + downstream notifications)
- `onCreate dispatch_events/{id}` → `onDispatchEvent` (metrics rollup)
- Storage `onFinalize` → `mediaFinalize` (EXIF strip, MIME verify, register on report)
- `onWrite hazard_zones/{zoneId}` where `zoneType === 'custom'` → `hazardZoneSweep` (re-tag affected reports; §22.5)
- `onCreate hazard_zones/{zoneId}` where `scope === 'provincial'` → auto-attach Command Channel thread with every affected muni admin (§22.7)

**Callables (client-invoked, server-authoritative):** See §6.1 inventory.

**Webhooks:**

- `POST /smsInbound` — Globe Labs keyword-routed SMS inbound
- `POST /smsDeliveryReport` — Semaphore and Globe Labs delivery status callbacks
- `POST /pagasaWebhook` — PAGASA hazard signal ingest (§10.2); webhook if available, polling fallback otherwise

**Scheduled jobs:**

- `processRetentionLifecycle` daily
- `reconcileSmsDeliveryStatus` every 10 minutes
- `computeMetrics` every 5 minutes
- `dispatchTimeoutSweep` every 30s — applies `pending → timed_out` per timeout config
- `cleanupOrphanedMedia` daily
- `auditExportHealthCheck` every 10 minutes
- `inboxReconciliationSweep` every 5 minutes (addresses cold-start trigger failures)
- `smsOutboxCleanup` daily (purges 90-day-old SMS records)
- `smsProviderHealthProbe` every 2 minutes (circuit-breaker state update)
- `projectResponderLocationsForMunicipalities` every 30s (cross-agency RTDB projection, §8.5)
- `pagasaSignalPoll` every 15 minutes (fallback when webhook not configured, §10.2)
- `hazardTagBackfillSweep` every 5 minutes — tags reports where auto-tag failed (§22.4)
- `hazardZoneExpirationSweep` hourly — marks event-bounded custom zones past `expiresAt` (§22.10)
- `hazardReferenceBigQueryMirror` every 5 minutes — reuses audit batch pipeline, exports zone + tag deltas to `hazards.*` (§22.3)

### 10.2 PAGASA Hazard Signal Ingest

Surge pre-warm (§10.3) depends on structured hazard signals. PAGASA does not currently expose a documented public webhook API for provincial-level signal-change events. Ingest has three tiers, preferred order:

1. **Webhook (preferred, if available).** If PAGASA/NDRRMC provide a webhook endpoint, `POST /pagasaWebhook` receives signal changes, validates the source IP + shared-secret, and writes to `hazard_signals/{signalId}`.
2. **Scraper + validator (pragmatic fallback).** `pagasaSignalPoll` scheduled function pulls the PAGASA public bulletin every 15 minutes, parses the current Tropical Cyclone Warning Signal levels per province, and writes detected changes to `hazard_signals`. Schema changes on the PAGASA site break this; the scraper emits to `dead_letters` on parse failure and alerts on-call. This is explicitly marked as a fragile dependency in §15.
3. **Manual superadmin toggle (last resort).** The Admin Desktop exposes a `Declare Hazard Signal` action for the superadmin that writes directly to `hazard_signals`. This is always available and is the documented fallback in degraded-mode runbook.

**`hazard_signals` schema:**

```typescript
hazard_signals/{signalId}
  source: 'webhook' | 'scraper' | 'manual'
  hazardType: 'tropical_cyclone' | 'rainfall' | 'landslide' | 'storm_surge' | 'other'
  signalLevel?: 1 | 2 | 3 | 4 | 5   // For TCWS
  affectedAreas: string[]           // Province codes or municipality codes
  validFrom: Timestamp
  validUntil?: Timestamp
  rawSource: string                 // URL or webhook payload reference
  recordedBy?: string               // Superadmin UID if manual
  recordedAt: Timestamp
```

**Surge pre-warm trigger:** When a `hazard_signals` document is written with `signalLevel >= 2` affecting any Camarines Norte barangay, `applySurgePreWarm` runs. This is independent of signal source — webhook, scraper, or manual toggle all cause the same downstream behavior.

Pilot validates: (a) scraper accuracy over a full typhoon season, (b) manual toggle discipline (superadmin actually toggles before surge), (c) whether PAGASA/NDRRMC webhook coordination is worth pursuing. Pilot blocker: drill the manual toggle path quarterly even if webhook/scraper is working.

### 10.3 Cold-Start Mitigation for Inbox Trigger

A typhoon surge brings hundreds of citizens online simultaneously. Cloud Functions cold-starts could cause `processInboxItem` timeouts, leaving `report_inbox` items with no corresponding triptych.

**Configuration for `processInboxItem`:**

- `minInstances: 3` during normal operation
- `maxInstances: 100`
- `concurrency: 80`
- `timeoutSeconds: 120`
- `memory: 512MiB`

Cost at idle: ~$45-60/month for the three warm instances.

**`inboxReconciliationSweep` — the safety net.** Every 5 minutes, a scheduled function scans `report_inbox` for items where `processedAt` is null and `createdAt` is more than 5 minutes ago. For each match, it retries `processInboxItem` with the inbox ID as idempotency key. If the retry fails three reconciliation attempts, the item is written to `dead_letters` with the original payload and an alert fires to backend on-call. **No citizen report is silently dropped by a trigger failure.**

**Surge capacity pre-warming.** On a `hazard_signals` write with `signalLevel >= 2` for any Camarines Norte area, `applySurgePreWarm` raises `minInstances` for `processInboxItem`, `acceptDispatch`, and `sendSMS` from 3 to 20, pre-warming capacity before the surge hits. `maxInstances` also raises. This is automatic, logged, and reverts 6 hours after the signal drops below 2. Manual override by superadmin is available.

### 10.4 Concurrency & Cross-Document Invariants

Mutations spanning multiple documents execute inside Firestore transactions. Examples:

- `acceptDispatch`: transaction on `dispatches/{id}` + `report_ops/{reportId}` (activeResponderCount increment)
- `verifyReport`: transaction on `reports/{reportId}` + `report_ops/{reportId}` + append to `report_events/{eventId}`
- `submitResponderWitnessedReport`: transaction on `reports/{id}` + `report_private/{id}` + `report_ops/{id}` + `report_lookup/{ref}` + `report_events/{eventId}`

**Transaction contention budget.** Firestore transactions retry on contention and time out at 10 seconds. High-contention paths (`acceptDispatch` under surge, `verifyReport` during bulk triage) must be measured in load tests before pilot with k6 synthetic contention. Target: p95 < 2s, p99 < 5s under 500 concurrent operations on the same document. If exceeded, split hot documents (e.g., move `activeResponderCount` into a sharded counter).

### 10.5 Failure Handling and Dead Letters

- **Transient infrastructure failures:** CF native retry, exponential backoff, max 5 attempts.
- **Downstream API calls with extended outage potential** (external agency dispatch APIs, SMS providers during prolonged outage): handed off to Cloud Tasks with retry windows up to 72 hours.
- **Permanent failures:** `dead_letters/{id}` with payload, correlation ID, failure category, retry history, operator action guidance.
- **Dead-letter replay** is an explicit superadmin workflow with audit logging.

### 10.6 Signed URL Hardening

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

| Data class                   | Sensitivity | Source             | Retention            | Cross-border                    | DPIA gate                     |
| ---------------------------- | ----------- | ------------------ | -------------------- | ------------------------------- | ----------------------------- |
| Pseudonymous UID             | Low         | Firebase Auth      | 30d after inactivity | Singapore (Firebase)            | Declare in privacy notice     |
| Msisdn hash                  | Medium      | SMS inbound        | 12 months            | Singapore + PH (SMS aggregator) | **Required**                  |
| GPS exact location           | High        | Client geolocation | 12 months            | Singapore                       | **Required**                  |
| Voluntary contact info       | High        | User-provided      | 12 months            | Singapore                       | **Required**                  |
| Photos/videos                | High        | User-uploaded      | 12 months            | Singapore                       | **Required** + EXIF stripping |
| Admin notes                  | Medium      | Staff-entered      | 12 months            | Singapore                       | **Required**                  |
| Responder GPS trails         | High        | Capacitor plugin   | 90 days              | Singapore                       | **Required**                  |
| SMS message bodies (inbound) | Medium      | Globe Labs webhook | 90 days              | PH + Singapore                  | **Required**                  |

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
- Field mode entry/exit for any admin
- All `incident_response_events` (§14)
- Hazard zone mutations (§22): `uploadHazardReferenceLayer`, `supersedeHazardReferenceLayer`, `createCustomHazardZone`, `updateCustomHazardZone`, `deleteCustomHazardZone` — every mutation streamed; polygon-targeted mass alerts inherit existing mass-alert streaming classification

**Batch-path events** (5-minute schedule, cost-optimized):

- Routine dispatch lifecycle events
- Report status transitions
- Routine admin reads
- Client error telemetry
- Function invocation logs
- Command channel message writes
- Hazard auto-tag and sweep mutations on `report_ops` (§22) — high volume, derivable from streamed zone events
- `hazardZoneExpirationSweep` (automatic, time-based)
- Hazard BigQuery mirror exports (meta-pipeline)

Both paths are monitored for gap detection. Streaming path alerts at 60-second gap; batch path alerts at 15-minute gap.

### 12.3 Correlation and Forensic Reconstruction

Every privileged action, status transition, media registration, notification send, SMS attempt, and background job carries a correlation ID propagated through callable inputs, function logs, FCM messages, Cloud Tasks, and SMS provider API calls.

---

## 13. Deployment & Operations

### 13.1 Environments

`bantayog-dev` (emulators), `bantayog-staging` (pre-production), `bantayog-prod` (production). Production credentials never shared. Staff accounts separate per environment.

### 13.2 Service Level Objectives

| Metric                                                          | Target                         | Window       |
| --------------------------------------------------------------- | ------------------------------ | ------------ |
| Citizen report acceptance latency (network present)             | p95 < 3s                       | rolling 5min |
| Dispatch creation latency (admin click → responder FCM)         | p95 < 10s                      | rolling 5min |
| Push delivery attempt success                                   | > 95%                          | rolling 1h   |
| SMS delivery attempt success (priority)                         | > 90%                          | rolling 1h   |
| SMS delivery attempt success (normal)                           | > 80%                          | rolling 1h   |
| Telemetry freshness (live responders)                           | > 90% of dispatched responders | rolling 5min |
| RPO                                                             | ≤ 24h                          | per incident |
| RTO                                                             | ≤ 4h                           | per incident |
| Audit export gap (streaming path)                               | ≤ 60s                          | continuous   |
| Audit export gap (batch path)                                   | ≤ 15min                        | continuous   |
| Inbox reconciliation backlog                                    | < 5 items older than 5min      | continuous   |
| Admin dashboard load (p95)                                      | < 5s                           | rolling 1h   |
| Agency assistance request response time (p95)                   | < 3min accept/decline          | rolling 1h   |
| Responder-witnessed report → municipal admin verification (p95) | < 5min                         | rolling 1h   |
| Transaction contention p99 (hot paths)                          | < 5s                           | rolling 5min |
| Hazard auto-tag latency (in `processInboxItem`)                 | p95 < 30ms                     | rolling 5min |
| Hazard zone sweep completion                                    | p95 < 10s                      | rolling 1h   |
| Hazard BigQuery mirror lag                                      | < 5min                         | continuous   |
| Hazard analytics dashboard query                                | p95 < 3s                       | rolling 1h   |
| Polygon Reach Plan estimation                                   | p95 < 2s                       | rolling 1h   |
| Auto-tag failure rate                                           | < 0.1% of ingest events        | rolling 1h   |

The provincial government has agreed to these SLOs. They are commitments, not aspirations.

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
- **Functions:** targeted rollback via `firebase deploy --only functions:<name>` with previous version pinned.
- **Rules:** redeploy from a known-good git commit; rules history is audited.
- **Schema changes:** must be backward-compatible across one rolling deployment window. See §13.12 for the schema migration protocol.
- **Forced client upgrade:** `system_config/min_app_version` checked on app start; separate floors for citizen, responder, and admin to avoid blocking emergency reporting during a partial deploy issue.

### 13.5 Security Operations

- MFA required for all staff accounts. TOTP for staff above responder, plus phone OTP for all.
- Secrets rotation via Secret Manager, quarterly.
- Lost-device runbook.
- App version enforcement via `system_config/min_app_version`.
- Emergency access revocation < 30 seconds via force-refresh + `active_accounts` check.
- Third-party security review scheduled before production cutover (§13.11).

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

| Signal                                  | Threshold                            | Owner                                         |
| --------------------------------------- | ------------------------------------ | --------------------------------------------- |
| Function error rate                     | > 1% over 5min                       | Backend on-call                               |
| Quota burn                              | > 80% of any quota                   | Backend on-call                               |
| Dead-letter growth                      | > 10 items/hour                      | Backend on-call                               |
| Inbox processing backlog                | > 100 unprocessed items              | Backend on-call                               |
| Stale telemetry rate                    | > 20% of dispatched responders       | Ops on-call                                   |
| FCM delivery failure                    | > 5% over 1h                         | Backend on-call                               |
| Cost anomaly                            | > 150% of 7-day rolling baseline     | Ops + Finance                                 |
| RTDB connection storm                   | > 5× baseline reconnections          | Backend on-call                               |
| Batch audit gap                         | > 15min                              | Compliance team                               |
| SMS provider error rate (Semaphore)     | > 5% over 5min                       | Backend on-call → circuit-break to Globe Labs |
| SMS delivery success (priority)         | < 85% over 1h                        | Backend on-call                               |
| Inbox reconciliation backlog            | > 5 items older than 5min            | Backend on-call                               |
| Break-glass activation                  | Any                                  | Superadmin + Governor's office notified       |
| Streaming audit gap                     | > 60s                                | Compliance + Backend (immediate)              |
| RTDB cost spike                         | > 5× baseline                        | Ops + Finance                                 |
| Agency assistance request response time | p95 > 3min                           | Ops on-call                                   |
| Transaction contention p99              | > 5s                                 | Backend on-call                               |
| PAGASA scraper parse failure            | Any consecutive 2 cycles             | Backend on-call                               |
| Incident response event written         | Any                                  | Compliance + Superadmin (immediate)           |
| Hazard auto-tag failure rate            | > 0.1% over 1h                       | Backend on-call                               |
| Hazard tag backfill backlog             | > 5 untagged reports older than 5min | Backend on-call                               |
| Hazard zone sweep backlog               | > 10 pending                         | Backend on-call                               |
| Hazard BigQuery mirror lag              | > 5min                               | Backend → Compliance if persistent            |
| Hazard expiration sweep error rate      | > 0 errors / hour                    | Backend on-call                               |
| Hazard custom-zone authorship anomaly   | > 2× 7-day baseline                  | Ops                                           |

Alerts without runbooks are noise and must be downgraded or removed.

### 13.8 System Health Surface

`/system_health` admin page polls every 30s: backend region status, function error rate, push delivery rate, SMS delivery rate per provider, SMS provider circuit-breaker state, telemetry freshness, queue depths, inbox reconciliation backlog, audit export health (streaming + batch), break-glass session active indicator, PAGASA signal ingest status, active field-mode sessions.

### 13.9 Observability Dashboards

**Operations Dashboard (Ops on-call):**

- Queue depths: inbox unprocessed, dispatch pending, SMS outbox queued
- Stale telemetry rate by municipality
- Dispatch acceptance latency, agency assistance response time, responder-witness verification latency
- FCM + SMS delivery rates side-by-side
- Hazard sweep queue depth; auto-tag success rate by muni (§22)

**Backend Dashboard (Backend on-call):**

- Function invocations, errors, p95 latency per function
- Dead-letter growth rate, type breakdown
- Firestore quota burn, RTDB bandwidth, Cloud Tasks queue depth and retry age
- Transaction contention metrics per hot path
- Hazard callable invocations / errors / p95; auto-tag latency contribution to `processInboxItem` overall (§22)

**Compliance Dashboard (Compliance officer):**

- Audit export gap (streaming + batch)
- Privileged reads of `report_private` / `report_contacts`
- Cross-municipality data access events
- Data subject erasure requests status
- Retention-exempt records count
- Break-glass activations (lifetime + rolling 90 days)
- Open incident response events (§14)
- Hazard reference layer upload history; custom zone deletion log (§22)

**Cost Dashboard (Ops + Finance):**

- Daily spend by service (Firestore, Functions, Storage, RTDB, SMS Semaphore, SMS Globe Labs separately)
- 7-day rolling baseline and anomaly detection
- Surge pre-warm instance hours (attributable to hazard signals)
- Per-municipality cost allocation

### 13.10 Regional and Disaster Strategy

Primary: `asia-southeast1`. Multi-region Firestore out of scope. Degraded-mode runbook covers regional outage with SMS and paper fallback. Citizens can be directed to SMS submission even when the web app is unavailable.

### 13.11 Pre-Production Checklist

These items must be complete before production cutover. Target dates maintained in the project tracker; this section enumerates the checklist.

1. **Semaphore `BANTAYOG` sender ID approved** for both Globe and Smart. Pre-approval interim uses Semaphore default sender; UI explicitly labels this state for admins.
2. **DPIA completed and filed with NPC**, with concurrence received where required (§11.4).
3. **Third-party security review.** An external security consultancy (not the implementing engineer) conducts a code review of security rules, a penetration test of the webhook endpoints, and a configuration review of Firebase IAM. Findings triaged; high-severity items resolved before cutover. Scope documented separately.
4. **Full restore drill** completed end-to-end in staging, meeting RTO.
5. **Break-glass physical drill** with real sealed envelopes (not staging duplicates) completed with the Governor's office and PDRRMO Director.
6. **NDRRMC escalation tabletop** with PDRRMO Director exercising full submission → forward → receipt → audit flow.
7. **PAGASA signal ingest** validated across all three tiers (webhook if coordinated, scraper, manual toggle).
8. **Load test** at 2× projected peak with k6, measuring transaction contention and cost.
9. **Capacitor iOS build** approved and on TestFlight; Android APK signed and on managed MDM test channel.
10. **Incident response runbook** (§14) walked through with the compliance officer and PDRRMO legal counsel.
11. **Privacy notices** published on citizen PWA, responder onboarding, and the SMS auto-reply template, in Tagalog and English.

### 13.12 Schema Migration Protocol

Breaking schema changes follow a documented protocol, not ad-hoc "both versions accepted" hand-waving.

1. **Plan document.** Before deployment, a migration plan is written covering: old schema, new schema, trigger compatibility matrix, backfill strategy, rollback plan, and monitoring signals.
2. **`schemaVersion` field** exists on every document class. New writes use the new version; triggers read both.
3. **Migration window.** A defined period (default 30 days) during which both versions are accepted. During this window, triggers have branched code paths with explicit tests for each.
4. **Backfill job.** A scheduled function backfills old documents to the new schema in batches, respecting Firestore quotas. Runs during low-traffic hours. Progress tracked in `system_config/migration_progress/{schemaKey}`.
5. **Cutover.** When backfill is complete and old-version writes are zero for 7 consecutive days, the migration window closes. Old-version trigger branches are removed in a follow-up deployment.
6. **Rollback.** During the migration window, rollback is reverting function deploys. Post-window, rollback requires a reverse migration plan.

No schema migration is "done" until the backfill is verified complete with a counting query and the monitoring signal confirms zero old-version documents.

---

## 14. Incident Response — Data Breach and Security Events

RA 10173 (Data Privacy Act) requires notification to the National Privacy Commission within 72 hours of becoming aware of a personal data breach. The system must have a runbook-backed process, not a vague intention.

### 14.1 Scope

A data incident for this system is any event involving:

- Unauthorized access to `report_private`, `report_contacts`, or `audit_logs`
- Leak of responder GPS trails to an unauthorized party
- SMS provider compromise leading to msisdn hash exposure
- Firestore security rules bypass in production
- Compromise of superadmin or break-glass credentials
- Cross-jurisdiction data leak in violation of §1.2

This is distinct from an operational outage (which has its own degraded-mode runbook).

### 14.2 Declaration

The superadmin (or, during superadmin unavailability, a break-glass session) calls `declareDataIncident` with:

- `incidentType` from the scope list above
- `discoveredAt` timestamp
- `initialScope`: affected data classes, estimated record count, known-affected UIDs
- `detectionSource`: who/what surfaced the incident

This writes `incident_response_events/{id}` with `status: 'declared'`. All subsequent actions append events to the same incident ID. The declaration itself is a streaming audit event.

### 14.3 The 72-Hour Clock

From `discoveredAt`, the system tracks elapsed time against the NPC 72-hour notification requirement. The Compliance Dashboard surfaces the countdown prominently. The clock does not pause for weekends or holidays.

### 14.4 Required Steps (Runbook Summary)

The full runbook lives in `docs/runbooks/incident-response.md`. Summary steps:

1. **Contain.** Suspend any compromised credentials immediately via `suspendAccount`. Revoke claims. If security rules bypass is suspected, deploy a rule tightening from the lockdown branch (pre-written to deny-by-default on affected collections).
2. **Preserve.** Export relevant BigQuery audit logs to a separate bucket with legal-hold. Snapshot affected Firestore collections.
3. **Assess.** Determine record count, data classes, and affected data subjects. Record the assessment in `incident_response_events`.
4. **Notify NPC.** Within 72 hours. Notification includes nature of breach, categories and approximate number of data subjects, likely consequences, measures taken or proposed.
5. **Notify affected data subjects.** Via SMS (for msisdn-linked records) and in-app (for registered citizens), coordinated with NPC guidance.
6. **Notify PDRRMO Director and Governor's office.** Always. This is a political/operational stakeholder requirement beyond the regulatory one.
7. **Post-incident report.** Within 30 days, a written report documents root cause, remediation, and policy/code changes. Filed with NPC and the provincial government.

### 14.5 Drill

The incident response process is drilled annually with a simulated breach scenario involving the compliance officer and PDRRMO legal counsel. The drill specifically tests the 72-hour workflow, including after-hours coverage.

### 14.6 Do Not Make Assurances

Citizen-facing communication during an incident must not overstate confidentiality or outcomes. The system does not claim that data is or was encrypted beyond what is factually true. The system does not promise that no data was seen. Communication is factual, NPC-aligned, and reviewed by PDRRMO legal counsel before release.

---

## 15. Testing Strategy

Testing prioritizes failure behavior over coverage percentages.

| Layer              | Tool                                 | Target                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit               | Vitest                               | Domain logic, validation, state-machine transitions                                                                                                                                                                                 |
| Security rules     | Firebase Emulator + Vitest           | Positive AND negative cases per rule; cross-muni leakage attempts; agency write-to-other-agency-responder attempts must fail; responder write-to-another-responder's-dispatch must fail. CI fails if any rule lacks negative tests. |
| RTDB rules         | Firebase Emulator                    | Positive + negative for every path; timestamp validation; cross-role scoping; cross-municipality projection read permissions                                                                                                        |
| Integration        | Emulator + staging                   | Callable commands, retries, dedup, event fan-out, restore compatibility                                                                                                                                                             |
| E2E                | Playwright + real-device smoke tests | Critical workflows under reconnect, permission revocation, stale claims, failed push, app restart during queue replay                                                                                                               |
| Load               | k6 + synthetic replay                | Surge patterns beyond expected peak: 500 concurrent citizen submits, 100 admin dashboards, 60 GPS streams, duplicate submissions, notification bursts, websocket reconnection storms, transaction contention on hot paths           |
| Chaos / resilience | Scripted fault injection             | Network loss mid-submission, delayed retries, dead-letter growth, regional dependency drills, FCM degradation, PAGASA scraper parse failure                                                                                         |

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
14. `hazard_signals` write with `signalLevel: 2` → `minInstances` raised → verified warm → reverts 6h after signal drops.
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
25. Responder taps `in_progress → resolved` at the same moment admin calls `cancelDispatch` → responder write rejected → Responder App shows "dispatch cancelled by [institutional label]" screen, not generic error.
26. k6 load test: 500 concurrent `acceptDispatch` calls on same report → exactly one succeeds, others receive "dispatch already accepted" structured response; transaction contention p99 < 5s.
27. Admin in field mode writes a field note while offline → on reconnect, note is replayed; streaming audit entry written; no other mutation is replayed.
28. PAGASA scraper returns unparseable HTML → `pagasaSignalPoll` writes to `dead_letters`, alert fires, manual toggle path available and documented.
29. Simulated data breach drill: superadmin declares incident, 72-hour clock starts, notification workflow exercised end-to-end.
30. UCS-2 SMS path: admin composes message containing `ñ`, segment counter shows 70-char limit, message delivers with correct orthography.

**Hazard / Geoanalytics pilot-blocker scenarios (§22):**

31. Superadmin uploads PAGASA 2024 flood map (50 polygons) → simplified to ≤500 vertices each → visible on Daet muni admin map within 30s.
32. Flood v2024 superseded by v2025 → superseded zones retain tag attribution on existing reports → new reports tag against v2025 only.
33. Muni admin draws 12-vertex evac polygon → sweep tags 47 existing reports within 10s.
34. Muni admin edits zone (shrinks) → reports in old-but-not-new lose tag; reports in new-but-not-old gain tag; history preserved.
35. Muni admin deletes custom zone → tags removed; deletion streams to audit.
36. Event-bounded zone reaches `expiresAt` → sweep sets `expiredAt` → client stops rendering → tags on existing reports PRESERVED (deletion-vs-expiration asymmetry).
37. Muni admin attempts `createCustomHazardZone` with `municipalityId` ≠ own → `PERMISSION_DENIED`.
38. Agency admin attempts `hazard_zones` read → `PERMISSION_DENIED`.
39. Citizen attempts `hazard_zones` read → `PERMISSION_DENIED`.
40. Report ingested with GPS inside 2 overlapping zones → tagged with BOTH.
41. Report ingested `barangay_only` → auto-tag skipped; `requiresLocationFollowUp: true`; no dead-letter (not an error).
42. Polygon mass alert, 3,000 recipients single muni → direct-send path; streams with polygon geometry.
43. Polygon mass alert, 8,000 recipients single muni → escalates to NDRRMC; direct-send refused.
44. Polygon mass alert spanning 2 munis (non-de-minimis) → escalates regardless of count.
45. Analytics query "reports in flood zone last 30d" → p95 < 3s; correct count vs BigQuery ground truth.
46. Auto-tag failure (simulated) → report materialized untagged; `dead_letters/hazard_tag_failed` entry; `hazardTagBackfillSweep` re-tags within 1h.

---

## 16. Risks & Residual Reality

| Risk                                                   | Residual Reality                                                | Mitigation                                                                                                                                                                                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regional cloud outage                                  | Real-time backend unavailable                                   | Degraded-mode runbook, SMS-only fallback workflow, paper forms, communications plan                                                                                                                                                                       |
| Mobile background execution degraded                   | Telemetry stale silently                                        | Silent-device detection, stale-state UI, permission recovery, operator alerts                                                                                                                                                                             |
| Cross-jurisdiction data leakage                        | RA 10173 failure                                                | Scoped rules, negative tests in CI, access reviews, least-privilege defaults, moderation logging                                                                                                                                                          |
| Abuse / false reporting                                | App Check insufficient alone                                    | Rate limits (per-UID, per-msisdn), moderation workflow, token hardening, anomaly detection                                                                                                                                                                |
| Deletion incompleteness                                | Soft-delete ≠ purge                                             | 7-day SLA, completion logging, BigQuery verification                                                                                                                                                                                                      |
| Duplicate side effects                                 | Retries can multiply work                                       | End-to-end dedup keys, event idempotency, replay-safe handlers                                                                                                                                                                                            |
| Backup restore mismatch                                | Raw data restore ≠ full system                                  | Quarterly full-stack restore drills including Terraform/Firebase CLI                                                                                                                                                                                      |
| JWT staleness                                          | Up to 60min window                                              | Three-layer mitigation (§4.3)                                                                                                                                                                                                                             |
| Dispatch split-brain                                   | Two responders both believe they accepted                       | `pending→accepted` is server-authoritative (§5.4)                                                                                                                                                                                                         |
| Inbox abuse / DoS                                      | Direct-write inbox more exposed                                 | Per-UID rate limits + App Check + reconciliation sweep + surge pre-warm                                                                                                                                                                                   |
| RTDB reconnect cost explosion                          | Websocket churn under outage                                    | Jitter, backoff, 5× cost alert                                                                                                                                                                                                                            |
| BigQuery audit gap                                     | Pipeline failure = blind                                        | Streaming path for critical events (60s gap alert), batch for analytics (15min alert)                                                                                                                                                                     |
| Cyclone-driven extended outage                         | Multi-day cell coverage loss                                    | Cloud Tasks 72h retry, paper fallback, post-restoration reconciliation                                                                                                                                                                                    |
| IndexedDB eviction wipes draft                         | Silent loss on iOS                                              | Dual-write to localForage + SMS fallback prompt + tracking reference as paper fallback                                                                                                                                                                    |
| Inbox trigger cold-start timeout                       | Citizen report stuck in inbox                                   | `minInstances: 3` + concurrency 80 + reconciliation sweep + surge pre-warm                                                                                                                                                                                |
| GPS battery drain killing responders mid-shift         | Responders become uncontactable                                 | Motion Activity API + geofence-at-staging + 10-min GPS at low battery                                                                                                                                                                                     |
| Security event lost to 5-min audit gap                 | Forensic blind spot during incident                             | Streaming audit path for suspensions, revocations, break-glass, incident response                                                                                                                                                                         |
| Signed URL abuse (5GB upload DoS)                      | Storage quota exhaustion                                        | `x-goog-content-length-range` + MIME restriction + per-UID rate limit + magic-byte verification                                                                                                                                                           |
| Superadmin incapacitated mid-emergency                 | No provincial oversight                                         | Break-glass dual-control with 4h time-limited session                                                                                                                                                                                                     |
| SMS provider outage during mass alert                  | Life-safety channel silent                                      | Semaphore + Globe Labs dual-provider circuit-breaker                                                                                                                                                                                                      |
| Client state inconsistency (cache soup)                | Ghost states, duplicate fetches, stale listeners                | State Ownership Matrix (§9) enforced in code review                                                                                                                                                                                                       |
| SMS inbound abuse (spam from feature phones)           | Moderation queue overwhelmed                                    | Per-msisdn rate limit + elevated moderation default + keyword validation + duplicate-cluster detection                                                                                                                                                    |
| Role capability drift between UI and rules             | UI shows a button the rules reject → user confused, audit noisy | Capability contract tests: every UI action maps to a rule check; CI enforces                                                                                                                                                                              |
| Verified Responder Report abuse                        | Responders create fake reports                                  | 10/24h rate limit + GPS + photo required + audit trail + superadmin review of cross-jurisdiction flags                                                                                                                                                    |
| Agency assistance requests pile up during surge        | Municipal admin blocked waiting                                 | 30-min auto-escalate to superadmin; pending age shown prominently                                                                                                                                                                                         |
| Admin without connectivity tries to write              | Silent queuing creates stale mutations replayed out of order    | Admin Desktop explicitly blocks writes when offline; field mode is narrow, audited exception                                                                                                                                                              |
| Command channel messages leak between incidents        | PII or operational info crosses incident boundaries             | Thread ID tied to report; membership controlled by incident stake; rule tests for negative cases                                                                                                                                                          |
| Admin identity not enforced at data layer              | Citizen discovers admin UID through aggregation                 | `report_lookup` and citizen-facing listeners never include actor fields; CF-projected from `report_events` with stripping                                                                                                                                 |
| Cross-agency projection staleness                      | Agency Admin sees outdated other-agency responder position      | 90s TTL on projection entries; "last updated X ago" on ghosted markers                                                                                                                                                                                    |
| Shift handoff never accepted                           | Incoming admin doesn't see notification                         | 30-min escalation to superadmin; handoff doc persists even if unread                                                                                                                                                                                      |
| SMS content policy drift                               | Admin composes message with emoji/shortener; aggregator rejects | Server-side sanitization in `sendSMS` abstraction; UI preview shows exactly what will send                                                                                                                                                                |
| Responder-vs-admin dispatch race                       | Responder sees generic error during concurrent cancel           | Race-loss recovery UX rebuilds screen from server state with institutional label                                                                                                                                                                          |
| Transaction contention on hot paths                    | Surge write latency exceeds SLO                                 | k6 load test gate + sharded counter fallback if measured                                                                                                                                                                                                  |
| PAGASA signal ingest fragility                         | Surge pre-warm doesn't fire                                     | Three-tier ingest (webhook, scraper, manual); manual toggle always available                                                                                                                                                                              |
| Semaphore sender ID rejection                          | Branded sender unavailable                                      | Interim default sender + UI labeling; escalation path with Semaphore support                                                                                                                                                                              |
| Data breach regulatory exposure                        | RA 10173 72-hour NPC notification                               | Incident response runbook (§14); annual drill; legal-hold export capability                                                                                                                                                                               |
| Operational dependence on primary engineer             | Recovery and diagnosis bottleneck                               | Documented as a residual risk owned by the provincial government; runbooks written to be executed by a generalist engineer                                                                                                                                |
| Hazard auto-tag silently drops on ingest failure       | Untagged reports; admins miss correlation                       | Dead-letter entry; `hazardTagBackfillSweep` primary recovery (5-min cadence); manual ops replay; next zone edit sweeps it in (§22.4)                                                                                                                      |
| Custom zone edit at 2 AM creates bad geometry          | Wrong-jurisdiction / over-large / wrong-severity zones          | Server-side vertex cap + bbox-in-muni check; history subcollection for rollback                                                                                                                                                                           |
| Reference upload malformed GeoJSON DOSes CF            | Memory exhaustion, cold-start failure                           | Signed URL size cap; schema validation before simplification; per-feature timeout                                                                                                                                                                         |
| Polygon mass alert routes wrong audience               | Message delivered to wrong people                               | Server-side threshold check (defense in depth); polygon-to-barangay reverse-geocode validated against jurisdictions; streaming audit with polygon geometry                                                                                                |
| Superseded reference zone queried after supersede      | Auto-tag or sweep matches old version                           | Query filter `supersededBy == null && deletedAt == null`; composite index                                                                                                                                                                                 |
| BigQuery hazard mirror drift masks incorrect analytics | Stale / wrong dashboard numbers                                 | Mirror-lag SLO alert; freshness indicator on dashboard; version-status panel reads Firestore directly, not BigQuery                                                                                                                                       |
| Event-bounded zone never expires (sweep bug)           | Zone stays "active" forever                                     | Client-side fallback filter on `expiresAt < now()`; monitoring alert on sweep error rate                                                                                                                                                                  |
| Barangay boundary dataset goes stale                   | Wrong-barangay reverse-geocode for polygon mass alerts          | Dataset version pinned per CF deploy; yearly minimum update cadence                                                                                                                                                                                       |
| Two admins edit same custom zone simultaneously        | One edit overwrites the other; history loss                     | Optimistic version check inside Firestore transaction: atomically reads zone, verifies `version === expectedVersion`, writes zone update AND `history/{version}` in one commit. Second writer retries, reads new version, fails with structured CONFLICT. |
| Admin creates custom zone with past `expiresAt`        | Expires immediately, never visible                              | Server-side `expiresAt > now() + 5min`; max 30d out                                                                                                                                                                                                       |
| Large custom zone triggers runaway sweep               | CF memory/timeout during tag recomputation                      | Bbox area cap ~100km² enforced server-side                                                                                                                                                                                                                |

---

## 17. Access Model Summary

System defines access by **data class**, not collection name. New collections must declare data class, permitted roles, sharing conditions, and rule block with negative tests before implementation.

| Data Class                                                                       | Permitted Roles                                                                                       | Conditions                                                                                                          |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Public alertable (feed, alerts, public map)                                      | All authenticated (including pseudonymous)                                                            | Institutional attribution only                                                                                      |
| Restricted operational (reports, dispatches)                                     | Municipal admin of muni; agency admin of assigned agency; assigned responder                          | `isActivePrivileged()` required                                                                                     |
| Restricted personal (`report_private`, `report_contacts`)                        | Data subject; municipal admin of muni (with streaming audit); superadmin (with streaming audit)       |                                                                                                                     |
| Sharing state (`report_sharing`)                                                 | Owner muni admin; muni admins in `sharedWith`; superadmin                                             | Streaming audit on mutation                                                                                         |
| Responder telemetry — RTDB full fidelity                                         | Self; municipal admin of muni; agency admin of agency; superadmin                                     | Active status required                                                                                              |
| Responder telemetry — cross-municipality projection                              | Municipal admin of that muni; agency admins (any); superadmin                                         | 100m grid, 30s sampled                                                                                              |
| SMS audit (`sms_outbox`, `sms_inbox`, `sms_sessions`)                            | Superadmin only                                                                                       | Streaming audit on every read                                                                                       |
| Break-glass audit (`breakglass_events`)                                          | Superadmin + Governor's Office designated reviewer                                                    | Append-only                                                                                                         |
| Agency assistance requests                                                       | Requesting muni admin; target agency admin; superadmin                                                |                                                                                                                     |
| Command channel threads                                                          | Participating admins; superadmin                                                                      | Tied to incident                                                                                                    |
| Shift handoffs                                                                   | From/to admins; superadmin                                                                            |                                                                                                                     |
| Hazard signals (`hazard_signals`)                                                | All authenticated (read); CF write only                                                               | Scraper/webhook/manual                                                                                              |
| Hazard zones — reference layers (`hazard_zones` where `zoneType == 'reference'`) | Municipal admin (province-wide read); Superadmin (full read/write)                                    | `isActivePrivileged()` required; callable-only mutations (Superadmin-only); streaming audit on every mutation (§22) |
| Hazard zones — custom (own-muni)                                                 | Municipal admin of that muni (read/write any, regardless of authorship); Superadmin (full read/write) | `isActivePrivileged()` required; callable-only mutations; event-bounded `expiresAt` required; streaming audit (§22) |
| Hazard zones — custom (provincial scope)                                         | Superadmin only                                                                                       | Muni admins coordinated via Command Channel threads, not direct zone visibility (§22)                               |
| Hazard zone history (`hazard_zones/{id}/history`)                                | Same read scope as parent zone; write by CF Admin SDK only                                            | Denormalized `zoneType` + `municipalityId` on each history doc so rules don't need `get()`                          |
| Incident response events                                                         | Superadmin only                                                                                       | Streaming audit on every write                                                                                      |
| Audit data (BigQuery)                                                            | Separate IAM; superadmin read via documented request path                                             |                                                                                                                     |

---

## 18. Decision Log

| #   | Decision                                                                                                                 | Rationale                                                                                                                                                                                                                                                                                                                             | Rejected Alternative                                                | Residual Cost / Risk                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Report triptych                                                                                                          | Document-level security boundary                                                                                                                                                                                                                                                                                                      | Single doc + field masking                                          | Multi-doc transactions, eventual-consistency window                                                                                                                                                                                                                    |
| 2   | Pseudonymous Auth universal                                                                                              | UID for rules + App Check for all                                                                                                                                                                                                                                                                                                     | Unauthenticated reads                                               | Pseudonymity ≠ anonymity; must communicate honestly                                                                                                                                                                                                                    |
| 3   | Mixed-mode writes                                                                                                        | Server-authoritative for contended; direct for sequential                                                                                                                                                                                                                                                                             | All-CF                                                              | UX must distinguish queued vs server-confirmed                                                                                                                                                                                                                         |
| 4   | Capacitor for responders                                                                                                 | Better mobile capability than PWA-only                                                                                                                                                                                                                                                                                                | PWA-only                                                            | Native wrapper reduces but doesn't eliminate background issues; iOS ship calendar                                                                                                                                                                                      |
| 5   | App Check                                                                                                                | Reduces abuse from non-genuine clients                                                                                                                                                                                                                                                                                                | Device fingerprinting                                               | Not a trust boundary                                                                                                                                                                                                                                                   |
| 6   | RTDB for GPS                                                                                                             | Bandwidth-priced, native real-time                                                                                                                                                                                                                                                                                                    | Firestore-only                                                      | Reconnect storms; rules required                                                                                                                                                                                                                                       |
| 7   | Soft-delete retention                                                                                                    | Firestore cannot recursively move subcollections                                                                                                                                                                                                                                                                                      | Archive collection                                                  | Deletion completion lag; SLA + audit needed                                                                                                                                                                                                                            |
| 8   | BigQuery audit                                                                                                           | Better durability than Firestore-only                                                                                                                                                                                                                                                                                                 | Firestore-only audit                                                | Pipeline depends on export health                                                                                                                                                                                                                                      |
| 9   | Dispatches source of truth                                                                                               | No dual-representation sync bugs                                                                                                                                                                                                                                                                                                      | `dispatchedTo[]` array                                              | Read amplification; denormalization needed                                                                                                                                                                                                                             |
| 10  | State machine in rules + server                                                                                          | Rules prevent invalid transitions; server validates cross-doc                                                                                                                                                                                                                                                                         | Rules-only                                                          | Some logic duplication                                                                                                                                                                                                                                                 |
| 11  | Denormalize auth fields onto guarded docs                                                                                | Rules can reference `resource.data`                                                                                                                                                                                                                                                                                                   | `get()` lookups                                                     | Write amplification                                                                                                                                                                                                                                                    |
| 12  | No device fingerprinting                                                                                                 | RA 10173 risk; brittle                                                                                                                                                                                                                                                                                                                | Fingerprint hash                                                    | App Check less precise                                                                                                                                                                                                                                                 |
| 13  | Inbox + trigger for citizen submission                                                                                   | Firestore SDK offline persistence beats custom callable queue                                                                                                                                                                                                                                                                         | `submitReport` callable                                             | Inbox more exposed; rate limits + trigger validation required                                                                                                                                                                                                          |
| 14  | `pending→accepted` is callable                                                                                           | Prevents split-brain                                                                                                                                                                                                                                                                                                                  | Direct write with rules                                             | Acceptance requires online                                                                                                                                                                                                                                             |
| 15  | `active_accounts` on privileged paths only                                                                               | Bounds JWT staleness without amplifying cost on broad reads                                                                                                                                                                                                                                                                           | Check-on-every-read                                                 | 1 extra read per privileged op; modeled in §5.7                                                                                                                                                                                                                        |
| 16  | `trustScore` excluded until NPC-compliant governance is drafted                                                          | RA 10173 profiling exposure without governance                                                                                                                                                                                                                                                                                        | Keep as advisory field                                              | Manual triage only                                                                                                                                                                                                                                                     |
| 17  | Cloud Tasks for downstream API calls                                                                                     | 72h retry windows                                                                                                                                                                                                                                                                                                                     | CF native retry                                                     | Additional infra                                                                                                                                                                                                                                                       |
| 18  | Tracking reference + secret separated                                                                                    | Human-readable ref not a credential                                                                                                                                                                                                                                                                                                   | Single token                                                        | Users must store secret                                                                                                                                                                                                                                                |
| 19  | Denormalize `status`/`severity`/`createdAt` onto `report_ops`                                                            | Cross-cutting admin queries possible                                                                                                                                                                                                                                                                                                  | Client-side join                                                    | Mirrored fields require transactional updates                                                                                                                                                                                                                          |
| 20  | MFA required for all staff                                                                                               | Field accounts are targets too                                                                                                                                                                                                                                                                                                        | Superadmin-only MFA                                                 | TOTP friction                                                                                                                                                                                                                                                          |
| 21  | Semaphore primary + Globe Labs failover for SMS                                                                          | Domestic aggregators, 20× cheaper than Twilio, better PH telco compliance                                                                                                                                                                                                                                                             | Twilio (Firebase Extension available)                               | Dual-provider ops; circuit-breaker required; sender ID approval lead time                                                                                                                                                                                              |
| 22  | Inbound SMS via Globe Labs keyword → `report_inbox`                                                                      | Feature-phone + zero-data citizens reachable; unified ingestion                                                                                                                                                                                                                                                                       | Separate inbound SMS pipeline                                       | Per-msisdn rate limits; barangay-only precision                                                                                                                                                                                                                        |
| 23  | localForage dual-write for citizen drafts                                                                                | Firestore SDK alone vulnerable to IndexedDB eviction                                                                                                                                                                                                                                                                                  | Firestore SDK only                                                  | Reconciliation logic; two storage layers to monitor                                                                                                                                                                                                                    |
| 24  | `minInstances: 3` for `processInboxItem` + reconciliation sweep                                                          | Cold-start surge failure would drop reports; reconciliation is safety net                                                                                                                                                                                                                                                             | Scale from zero                                                     | ~$45-60/mo idle cost; surge pre-warm adds more                                                                                                                                                                                                                         |
| 25  | Motion Activity API + geofence-at-staging for responders                                                                 | GPS-speed inference kills batteries over long shifts                                                                                                                                                                                                                                                                                  | GPS-speed motion detection                                          | Plugin dependency; motion-API accuracy varies by device                                                                                                                                                                                                                |
| 26  | Streaming audit for security events, batch for analytics                                                                 | 5-min gap unacceptable for suspensions/revocations during incident                                                                                                                                                                                                                                                                    | All-batch                                                           | Higher BQ streaming cost on critical events; worth it                                                                                                                                                                                                                  |
| 27  | Break-glass sealed credentials with dual-control unseal                                                                  | Superadmin incapacitation during typhoon cannot lock out province                                                                                                                                                                                                                                                                     | Only named superadmin has access                                    | Physical chain of custody; quarterly drill; post-event review                                                                                                                                                                                                          |
| 28  | State Ownership Matrix enforced in code review                                                                           | Cache soup across Firestore/TanStack Query/Zustand is a real failure mode                                                                                                                                                                                                                                                             | Implicit ownership                                                  | Requires review discipline                                                                                                                                                                                                                                             |
| 29  | Report lifecycle state machine formalized (13 states)                                                                    | Dispatch-only state machine left report transitions implicit and untested                                                                                                                                                                                                                                                             | Implicit report transitions                                         | More state to test; rule updates for every transition                                                                                                                                                                                                                  |
| 30  | Terraform + Firebase CLI as named IaC stack                                                                              | "Version-controlled" isn't a command                                                                                                                                                                                                                                                                                                  | Firebase CLI alone                                                  | Terraform state management overhead                                                                                                                                                                                                                                    |
| 31  | Signed URL size/MIME/content-range enforcement                                                                           | 5GB DoS upload risk without it                                                                                                                                                                                                                                                                                                        | Client-side size check                                              | More complex URL issuance logic                                                                                                                                                                                                                                        |
| 32  | Stay on Firebase; no Postgres migration until triggers fire                                                              | Single developer, pilot scope; migration is 3+ months of work with no pilot data yet                                                                                                                                                                                                                                                  | Hybrid with Postgres for dispatch core                              | Document-store ceiling acknowledged; migration triggers defined (§19)                                                                                                                                                                                                  |
| 33  | Defer province-wide mass alerting to NDRRMC ECBS                                                                         | RA 10639 assigns this channel to NDRRMC; ECBS is cell broadcast; commercial SMS aggregators are slower, pricier, legally awkward at that scale                                                                                                                                                                                        | Blast 100k+ SMS via Semaphore                                       | Must build + maintain escalation workflow with PDRRMO → NDRRMC                                                                                                                                                                                                         |
| 34  | Three deployment surfaces, not one app                                                                                   | Citizen/Responder/Admin have incompatible offline, auth, and device profiles                                                                                                                                                                                                                                                          | Monolithic PWA                                                      | 3× build targets, shared packages discipline, iOS ship calendar                                                                                                                                                                                                        |
| 35  | Agency admins do NOT verify reports                                                                                      | Clean state machine; matches PH LGU doctrine; prevents verification races                                                                                                                                                                                                                                                             | Agencies verify in their jurisdiction                               | Muni admin is bottleneck during surge; pre-warm + reconciliation mitigate                                                                                                                                                                                              |
| 36  | Verified Responder Report = accelerated intake, not bypass                                                               | Legitimate field-witness case without compromising LGU verification                                                                                                                                                                                                                                                                   | Full bypass (skip `awaiting_verify`)                                | Still requires admin tap; trade speed for review                                                                                                                                                                                                                       |
| 37  | Admin Desktop blocks offline writes; field mode is narrow carve-out                                                      | High-stakes mutations silently replayed out of order is worse than blocking; field mode scope is notes + messages only                                                                                                                                                                                                                | localForage outbox for admins universally                           | Admins must be online for mutations; field mode entry is a streaming audit event                                                                                                                                                                                       |
| 38  | Citizen-facing projection strips `actorId`                                                                               | Admin identity hidden at data layer, not just UI                                                                                                                                                                                                                                                                                      | Rely on UI to hide                                                  | CF projection adds complexity; worth it for rule-level enforcement                                                                                                                                                                                                     |
| 39  | Cross-agency responder visibility via per-municipality RTDB projection                                                   | Privacy-preserving (100m grid) + cost-bounded + write amplification lower than per-agency projection                                                                                                                                                                                                                                  | Full RTDB cross-reads; per-agency projection                        | Projection staleness bounded by 30s cadence + 90s TTL                                                                                                                                                                                                                  |
| 40  | Municipal mass alerts route through Reach Plan                                                                           | Surfaces SMS-vs-ECBS decision to admin before send                                                                                                                                                                                                                                                                                    | Silent routing based on thresholds                                  | UI complexity; admin must understand channels                                                                                                                                                                                                                          |
| 41  | Agency assistance requests are first-class documents                                                                     | Audit trail for inter-agency coordination; timeout escalation                                                                                                                                                                                                                                                                         | Informal via command channel                                        | New collection + rules + callables                                                                                                                                                                                                                                     |
| 42  | No Facebook Messenger integration for any role                                                                           | RA 10173 data residency, no SLA, no audit hook, unreliable in degraded networks                                                                                                                                                                                                                                                       | Keep as fallback per responder spec                                 | Responders must use in-app messages + PSTN calls                                                                                                                                                                                                                       |
| 43  | Responder GPS retention: 90 days, not 24h                                                                                | Post-incident review needs it; 24h is insufficient                                                                                                                                                                                                                                                                                    | 24h                                                                 | Privacy notice must state clearly                                                                                                                                                                                                                                      |
| 44  | Session timeout is re-auth interval, not token TTL                                                                       | Firebase ID tokens are 1h regardless; "timeout" at app layer means prompt-for-OTP                                                                                                                                                                                                                                                     | Hard-expire sessions at 8h                                          | Requires explicit handling at app level                                                                                                                                                                                                                                |
| 45  | No "Incident Commander" tag                                                                                              | Existing state machine answers every operational ownership question; ambiguous tag with no transition rules adds vocabulary without clarity                                                                                                                                                                                           | Incident Commander role for inter-agency conflicts                  | Conflicts resolved via Command Channel threads                                                                                                                                                                                                                         |
| 46  | `report_sharing` is a separate document, not a field on `report_ops`                                                     | Isolating mutable sharing state prevents listener thrash on `report_ops` during border-incident auto-share storms                                                                                                                                                                                                                     | `visibility.sharedWith` field on `report_ops`                       | One additional collection; CONTAINS index on `sharedWith`; sharing mutations require the sibling doc                                                                                                                                                                   |
| 47  | Idempotency check is transactional dedup-table-first, with document-side fields for traceability                         | Same key + different payload must fail deterministically; document fields alone can't enforce this                                                                                                                                                                                                                                    | Document field + last-write-wins                                    | `idempotency_keys` collection + canonical-hash computation in shared validators package                                                                                                                                                                                |
| 48  | GSM-7 vs UCS-2 detection, no emoji/ñ stripping                                                                           | Tagalog orthography (`ñ`) is linguistically required; stripping produces wrong words; admins must see segment count explicitly                                                                                                                                                                                                        | Silent ASCII strip                                                  | UCS-2 halves segment capacity (70 vs 160); admin UI surfaces this                                                                                                                                                                                                      |
| 49  | Responder race-loss recovery is a specified UX, not ad-hoc error handling                                                | Generic error modals during admin-cancel races produce angry field feedback and undermine trust                                                                                                                                                                                                                                       | Generic error modal                                                 | Pilot-blocker test scenario; specific "dispatch cancelled by [institutional]" screen                                                                                                                                                                                   |
| 50  | Transaction contention budget explicit, measured in k6 load test                                                         | Hot-path p99 regressions show up only at surge; don't discover at incident time                                                                                                                                                                                                                                                       | Measure only at incident                                            | Pre-prod load test gate; fallback is sharded counters                                                                                                                                                                                                                  |
| 51  | PAGASA ingest has three tiers (webhook, scraper, manual)                                                                 | No single-point ingest is reliable; manual toggle is always available                                                                                                                                                                                                                                                                 | Scraper-only                                                        | Quarterly manual-toggle drill; scraper health alert                                                                                                                                                                                                                    |
| 52  | Incident response has a dedicated §14 and runbook                                                                        | RA 10173 72-hour clock is a hard regulatory requirement; vague intentions fail audits                                                                                                                                                                                                                                                 | Assume "we'll handle it"                                            | Annual drill with compliance officer + PDRRMO counsel                                                                                                                                                                                                                  |
| 53  | Schema migration has a documented protocol, not "both versions accepted for a window"                                    | Hand-waved migrations leave old-version orphans and surprise breakage months later                                                                                                                                                                                                                                                    | Implicit rolling window                                             | Migration plan doc per breaking change; backfill completion gate                                                                                                                                                                                                       |
| 54  | Third-party security review is a pre-prod checklist item                                                                 | Implementing engineer reviewing own rules misses failure modes; government customer will ask                                                                                                                                                                                                                                          | Rely on internal review                                             | External consultancy cost; scheduled in §13.11                                                                                                                                                                                                                         |
| 55  | Hazard zones are admin-only (muni + superadmin); citizens, responders, agency admins have no read path                   | Citizen exposure to hazard overlays leaks operational info (admin response posture, evacuation intent); matches Principle #11 — capability by data-class reach, not by UI. Agency admins operate vertically on their roster, not LGU triage/mapping.                                                                                  | Citizen-visible reference layers; agency-admin read access          | Citizens don't see known risk passively; reached only via mass alert. Agency admin sees hazard correlation only via report badges exposed on their assigned incidents.                                                                                                 |
| 56  | Hazard reference layers are immutable + versioned; custom zones are mutable + event-bounded with required `expiresAt`    | Reference = frozen risk profile (PAGASA/MGB authoritative data, historical audit integrity); custom = current operational reality (typhoon impact, evac, curfew) that must expire to prevent zone accumulation                                                                                                                        | Single mutable model for both                                       | More state classes; explicit version bumps in audit; sweep logic differs (reference never sweeps; custom sweeps on edit; expiration preserves tags; deletion removes tags)                                                                                             |
| 57  | Hybrid spatial storage: Cloud Storage for unsimplified source + Firestore for indexed zones + BigQuery GIS for analytics | Auto-tag at ingest cannot afford a Cloud Storage read (50–200ms breaks p95 <3s ingest SLO) or a BigQuery query (cost + latency) per inbox event. Analytics cannot afford client-side polygon scan. Each store answers a different question.                                                                                           | Single-store (pure Firestore, pure BigQuery, or pure Cloud Storage) | Three layers to keep coherent via 5-min batch mirror; version-status panel reads Firestore directly (not BigQuery) to reflect just-committed uploads                                                                                                                   |
| 58  | Auto-tag forward-only for reference layers; sweep for custom zones; tags survive expiration; tags purged on deletion     | Reference supersede must not retroactively re-tag history (audit integrity). Custom zone edits represent admin intent to correct geometry, so existing reports must be re-tagged. Expiration is a lifecycle state (the zone existed and tagged legitimately); deletion is a retraction (the zone should not have been in effect).     | Always-sweep or never-sweep for both                                | Asymmetry must be explicit in docs and CI tests; pilot-blocker scenarios #32 + #36 cover it                                                                                                                                                                            |
| 59  | Muni admin reads all reference layers + own-muni custom zones only; provincial-scope custom zones invisible              | Reference data is public-ish (agency-authoritative, province-covering); custom is operational. Superadmin uses Command Channel threads to loop affected munis on provincial-scope zones, preserving jurisdictional framing.                                                                                                           | Muni admin reads all provincial-scope custom zones                  | Superadmin must explicitly loop munis via Command Channel when provincial zones affect them; captured by auto-attach trigger on provincial-scope zone creation                                                                                                         |
| 60  | Hazard auto-tag runs AFTER the triptych materialization transaction, not inside it                                       | Adding a `hazard_zones` query to the triptych transaction expands its read set. Under surge + concurrent zone edit, this creates a retry storm on the life-safety-critical ingest path. Separating auto-tag as follow-up write keeps report materialization robust; tagging failure falls to dead-letter + backfill-sweep safety net. | Auto-tag inside triptych transaction                                | Report materializes without hazard tags if auto-tag step fails; primary recovery is `hazardTagBackfillSweep` (5-min cadence, same pattern as `inboxReconciliationSweep`); tagging is best-effort with SLA of p95 <30ms in-budget and 100% caught by backfill within 1h |

---

## 19. The Postgres Question: When to Migrate, and Why Not Now

The system stays on Firebase for the current pilot phase. Migrating before pilot data exists means migrating on theory. The document-store ceiling — where Firestore's lack of joins and transactional guarantees actually hurts — hasn't been hit yet at 600k population scope.

**Why not migrate now:**

- Team capacity. Introducing Postgres means migrations layer, connection pooling, read replicas, backup rotation, separate IaC, separate monitoring — a full-time ops person's worth of new work before any user value is delivered.
- Cost structure. Firebase pricing scales with usage; a Postgres core on AlloyDB has a baseline cost floor (~$300/month minimum for a small HA configuration) that dominates at pilot scale.
- Rollback risk. If the migration goes wrong mid-deployment, the emergency system is the thing going wrong. Not an acceptable failure mode before pilot stability is proven.

**Named migration triggers.** The architecture moves toward a hybrid Firebase + Postgres core when **any two** of these are observed in production for 30+ consecutive days:

| Trigger                                                   | Threshold                              | Why it signals Postgres                                           |
| --------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Admin dashboard p95 load time                             | > 5 seconds                            | Firestore client-side join cost exceeded                          |
| Concurrent active dispatches province-wide                | > 500 sustained                        | Contention on dispatch collection                                 |
| Cross-collection reporting queries per day                | > 1,000                                | BigQuery batch too slow for operational reporting                 |
| Firestore document update amplification                   | > 10× write fan-out per business event | Denormalization cost exceeds relational cost                      |
| Cost of Firestore reads                                   | > ₱50,000/month (~$900)                | Relational DB cost model becomes more favorable                   |
| Dispatch state machine needing multi-table FK enforcement | Any compliance-mandated case           | Firestore cannot enforce FK; Postgres can                         |
| Regulatory requirement for SQL-based audit access         | Any formal government audit request    | Relational reporting tools assumed                                |
| Cross-collection feature requests blocked by join cost    | ≥ 3 in a single quarter                | Developer-velocity signal; denormalization is paying a hidden tax |

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
16. Cost under real surge with hazard-signal pre-warm engaged
17. State Ownership Matrix discipline holding across the codebase under code review
18. Role capability contract tests pass 100% — every UI action maps to a rule-enforced callable or direct write, CI-verified
19. Three-surface build pipeline produces three distinct deployables reproducibly from a clean tag
20. Responder-witness report drill: responder submits → municipal admin verifies → dispatch → resolution, full audit trail, p95 verification < 5min
21. Agency assistance workflow drill: muni requests → agency accepts → dispatches → resolves, latency measured end-to-end
22. Mass alert reach plan preview accuracy: estimate within ±10% of actual recipient count post-send
23. NDRRMC escalation workflow: tabletop drill with PDRRMO Director exercising full submission → forward → receipt → audit flow, latency baseline established
24. Cross-municipality projection accuracy: during a live multi-agency incident, all admins see peer responders with <90s staleness and <100m positional uncertainty
25. Shift handoff discipline: 30-day measurement of admin handoff acceptance rate, < 10% unaccepted handoffs required for production
26. Responder race-loss recovery: in drill with concurrent admin-cancel, responder app shows institutional-label cancellation screen on every trial
27. Transaction contention under load: 500 concurrent `acceptDispatch` calls on same report show p99 < 5s in pre-prod load test
28. PAGASA signal ingest: scraper validated across ≥3 real signal changes during pilot season; manual toggle drilled quarterly
29. Incident response 72-hour drill: simulated breach exercises declaration, containment, notification workflow end-to-end
30. Third-party security review: findings resolved to consultant's satisfaction before production cutover
31. GSM-7/UCS-2 SMS behavior: admin-facing segment counter correct across Tagalog and English samples; `ñ` delivers intact
32. Hazard reference upload-simplify-persist round-trip on real PAGASA + MGB data; Douglas-Peucker simplification preserves ≥95% geometric fidelity (IoU) vs source
33. Custom zone sweep on typical-size edit (<100km² bbox) completes <10s and correctly re-tags ≥99% of candidate reports
34. Hazard auto-tag accuracy: manually-verified in/out for 100 sampled reports → 100% agreement with Turf.js point-in-polygon ground truth
35. Polygon mass alert Reach Plan estimate within ±10% of actual delivery count post-send
36. Hazard analytics dashboard usable by non-GIS muni admin with <10 min training
37. Expiration sweep correctness: zero custom zones stuck past `expiresAt` over 30-day measurement window
38. Hazard BigQuery mirror freshness: lag <5 min p95, <15 min p99, over 30-day measurement
39. Zero hazard auto-tag failures escape `hazardTagBackfillSweep` replay within 1h at p95

---

## 21. What This Spec Is Not

- **Not a UX spec.** Layouts, pixel-precise designs, exact copy, and icon choices remain in the role specs or in a forthcoming design system. This spec defines capabilities, boundaries, and data; the design team chooses how to express them.
- **Not an API reference.** Callable signatures are named here; their exact schemas live in `packages/shared-validators` (Zod) and are source-of-truth when implementation disagrees with prose.
- **Not a runbook.** Operational procedures (break-glass drill, restore drill, degraded-mode, incident response) have their own living documents under `docs/runbooks/`.
- **Not immutable.** The §18 Decision Log is the right place to reopen a decision. New decisions go below #60 with rationale. Version 9 will happen after pilot data exists.
- **Not a hazard modeling spec (§22).** Risk-scoring formulas beyond "count of tagged reports per zone" are deferred to v9 pending pilot data. Probabilistic risk surfaces, exposure indices, and actuarial-style modeling are out of scope.
- **Not a hazard integration spec (§22).** No automated ingestion pipelines with PAGASA, MGB, or PHIVOLCS APIs. All hazard reference data enters via Superadmin manual upload; licensing and attribution are captured in the upload manifest.
- **Not a hazard forecasting spec (§22).** Zones describe known risk (historical flood extents, mapped landslide-prone terrain, storm-surge inundation zones), not forecast events. Typhoon-track projections and live signal overlays remain PAGASA / NDRRMC's mandate.

---

## 22. Geoanalytics & Hazard Mapping

Municipal and Provincial admins get a hazard-zone overlay on the admin map, backed by a hybrid spatial store (Cloud Storage + Firestore + BigQuery GIS). Every citizen report is auto-tagged at ingest with the zones its GPS falls inside; custom zone edits trigger a bounded sweeper that re-tags affected reports; mass alerts can target a polygon. Feature ships with pilot Phase 3–4.

**Distinct from §10.2 `hazard_signals`.** Hazard signals are PAGASA weather-event signals (TCWS level 1–5) that drive backend surge pre-warm. Hazard zones are geographic polygons that tag reports and target alerts. They share the word "hazard" and nothing else.

**Source of truth for this section:** `docs/superpowers/specs/hazard-geoanalytics-design-v1.0.md`. When this section and that doc disagree, that doc is the authority for implementation detail; this section is authoritative for integration with the rest of the architecture.

### 22.1 Hazard Taxonomy & Data Sources

Three hazard types in-scope for pilot:

- **Flood** — PAGASA flood hazard maps (historical extents by return period)
- **Landslide** — MGB rainfall-induced landslide susceptibility polygons
- **Storm surge** — PAGASA storm-surge inundation zones

**Seismic hazards deferred.** PHIVOLCS fault-line and liquefaction maps exist but Camarines Norte's risk profile is typhoon-dominated; seismic added in v9 if pilot data warrants.

**Update cadence is yearly-to-decadal.** Source agencies publish updated hazard maps on irregular cycles (post-event revisions, national-level re-surveys). Manual Superadmin upload is the correct ingestion model; automated pipelines would add fragility for data that changes that rarely.

### 22.2 Data Model

**New collection:** `hazard_zones/{zoneId}`. Single collection holds both reference layers (agency-sourced, immutable, versioned) and custom zones (admin-drawn, event-bounded), discriminated by `zoneType`.

```typescript
interface HazardZone {
  // Identity
  zoneId: string // ULID
  zoneType: 'reference' | 'custom'
  hazardType: 'flood' | 'landslide' | 'storm_surge'

  // Geographic scope
  scope: 'provincial' | 'municipal'
  municipalityId?: string // required when scope === 'municipal'

  // Indexed geometry — simplified, bounded
  geohashPrefix: string // 6-char prefix for bbox lookup
  bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon // vertex cap from system_config/hazard_zone_limits.maxVertices (default 500), enforced server-side
  geometryStorageUrl?: string // Cloud Storage URL for unsimplified source (reference layers only)

  // Reference-layer specific
  sourceAgency?: 'PAGASA' | 'MGB' | 'OTHER'
  sourceVersion?: string // admin-supplied, e.g. "2024-08"
  supersededBy?: string // zoneId of newer version
  supersededAt?: Timestamp

  // Custom-zone specific
  expiresAt?: Timestamp // REQUIRED when zoneType === 'custom'; server enforces > now + 5min, ≤ now + 30d
  expiredAt?: Timestamp // set by hourly expiration sweep
  purpose?: 'typhoon_impact' | 'evacuation' | 'curfew' | 'other'
  purposeDescription?: string // ≤280 chars, server-sanitized

  // Risk metadata
  severity: 'high' | 'medium' | 'low' // authored

  // Attribution
  createdBy: string // uid
  createdByRole: 'municipal_admin' | 'provincial_superadmin'
  createdByMunicipalityId?: string // denormalized for rule evaluation
  createdAt: Timestamp
  updatedAt: Timestamp
  updatedBy?: string
  deletedAt?: Timestamp
  deletedBy?: string

  // Versioning
  version: number // monotonic per zoneId
  schemaVersion: number
}
```

**Subcollection:** `hazard_zones/{zoneId}/history/{version}`. Snapshot of prior zone state written before each edit. Read-only after write; CF Admin SDK is the only writer. Each history doc carries denormalized `zoneType` and `municipalityId` so rules can scope reads without a `get()` on the parent — critical for avoiding unbounded billable reads when superadmin bulk-reviews zone histories post-typhoon.

**`report_ops` touch points.** Covered in §5.1: `locationGeohash`, `hazardZoneIds[]` (audit-grade tag history), `hazardZoneIdList[]` (flat array for `array-contains` queries). Hazard tags live on `report_ops`, not `reports` — operational data stays behind `isActivePrivileged()`; citizens never see hazard-zone metadata.

**`mass_alert_requests` extension.** Polygon targeting adds `targetType: 'barangay' | 'municipality' | 'polygon'` discriminator and an optional `targetGeometry` object carrying `zoneId?`, `bbox`, and `geometry`. Existing §7.5.1 routing thresholds unchanged — polygon is new geometry, not a new channel.

### 22.3 Storage Architecture (Hybrid)

Three layers, each answering a different question.

**Cloud Storage:** unsimplified source GeoJSON for reference layers. Bucket `bantayog-hazards-{env}`, not public, Admin SDK-only access.

```
reference/{hazardType}/{sourceVersion}/{zoneId}.geojson     # original source
reference/{hazardType}/{sourceVersion}/manifest.json        # agency, upload date, uploader uid, licensing attribution
custom/{zoneId}/v{N}.geojson                                # snapshot per edit
```

Object versioning enabled; 24-month retention on non-current versions. No client-side writes; uploads go through `requestHazardUploadUrl` + `uploadHazardReferenceLayer` callables under Admin SDK.

**Firestore (`hazard_zones`):** simplified indexed geometry for operational queries (auto-tag at ingest, sweep on edit, admin UI listeners). Douglas-Peucker simplification via `@turf/simplify` capped at 500 vertices per feature.

**BigQuery GIS:** analytics mirror, updated every 5 minutes via the same batch pipeline that handles audit export (§12.2 batch path).

```sql
CREATE TABLE hazards.zones (
  zone_id STRING NOT NULL,
  zone_type STRING,                         -- 'reference' | 'custom'
  hazard_type STRING,
  scope STRING,
  municipality_id STRING,
  severity STRING,
  geometry GEOGRAPHY,                       -- native spatial type
  source_agency STRING,
  source_version STRING,
  expires_at TIMESTAMP,
  expired_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  superseded_at TIMESTAMP,
  deleted_at TIMESTAMP,
  version INT64
) PARTITION BY DATE(created_at) CLUSTER BY municipality_id, hazard_type;

CREATE TABLE hazards.report_tags (
  report_id STRING NOT NULL,
  zone_id STRING NOT NULL,
  zone_version INT64,
  hazard_type STRING,
  severity STRING,
  tagged_at TIMESTAMP,
  tagged_by STRING,                         -- 'ingest' | 'zone_sweep'
  municipality_id STRING,
  report_created_at TIMESTAMP,
  report_severity STRING,
  report_status STRING                      -- snapshot at export time
) PARTITION BY DATE(tagged_at) CLUSTER BY municipality_id, hazard_type;
```

Analytics queries use native `ST_Contains` / `ST_Area` / `ST_Within`. Denormalized `municipality_id`, `hazard_type`, `severity` on `report_tags` means the common admin query needs no join; clustering keeps it fast.

**BigQuery is for analytics — not operational truth.** Zone version status panels, active custom zone lists, and any admin UI that must reflect just-committed state read from Firestore directly. The up-to-5-min BigQuery lag is acceptable for trend dashboards and compliance queries but not for a superadmin validating an upload they just performed. Consistent with §9.1 state-ownership principle.

**Rationale for shape choices:**

- _Why Firestore-indexed zones (not pure Cloud Storage)?_ Auto-tag at ingest needs fast candidate lookup; Cloud Storage reads per inbox event add 50–200ms and break the p95 <3s ingest SLO under surge.
- _Why not pure BigQuery for zones?_ Auto-tag can't afford a BigQuery query per report (cost + latency). BigQuery is the analytics mirror.
- _Why dual `hazardZoneIds` + `hazardZoneIdList`?_ Firestore `array-contains` needs primitive equality. Map list carries audit history; flat list enables server-side "filter reports by zone X" queries without client-side scan.
- _Why geohash prefix 6 stored / 4 queried?_ Stored 6-char (~1.2km) is precise enough for zone indexing. Queried as 4-char prefix (~20km) over-reads candidates but eliminates boundary-miss errors; Turf.js is the authoritative filter.
- _Why version reference layers by creating new `zoneId`s (not in-place)?_ A report tagged with v2024 must stay attributed to v2024 after v2025 uploads. Immutable versioning is the clean model.

### 22.4 Functional Flow — Ingest Auto-Tag

Hot path. Runs on every inbox event. Covered by decision #60.

1. Inbox trigger fires on `report_inbox/{id}`.
2. Existing triptych materialization runs inside its transaction. During this transaction, `processInboxItem` also writes `locationGeohash` (6-char geohash of exact GPS) to `report_ops` — field addition to the existing write, not a new transaction.
3. **After the triptych transaction commits**, a follow-up auto-tag step runs:
   - If `locationPrecision === 'gps'`:
     - Compute the report's 4-char geohash prefix AND its 8 neighboring 4-char prefixes (via `ngeohash.neighbors()`) to handle boundary-straddling — a point on a cell edge may fall inside a zone indexed in the adjacent cell
     - Query `hazard_zones` where `geohashPrefix` starts with any of these 9 prefixes, `deletedAt == null`, `supersededBy == null`, `expiredAt == null` → candidates (typically 1–20; worst case ~50 with neighbors, still fast)
     - Turf.js `booleanPointInPolygon` on each candidate
     - Build `HazardTag[]` from matches
   - Update `report_ops` with `hazardZoneIds: HazardTag[]` + `hazardZoneIdList: string[]`
   - If `locationPrecision === 'barangay_only'`: skip auto-tag; `requiresLocationFollowUp: true`; no dead-letter (not an error).
4. Budget: 10–20ms p50, 30–50ms p99. Fits within p95 <3s ingest SLO.

**Why NOT inside the triptych transaction:** Decision #60 rationale — retry-storm avoidance on life-safety-critical path.

**Failure handling and recovery.** If the follow-up auto-tag step fails, the report exists untagged. `processInboxItem` appends a `dead_letters/{id}` entry with `category: 'hazard_tag_failed'`. No citizen report is degraded by an auto-tag failure. Recovery paths in priority order:

1. **`hazardTagBackfillSweep`** (primary, scheduled every 5 min). Queries `report_ops` where `locationGeohash IS NOT NULL` AND `hazardZoneIds` is empty/null AND `createdAt > now - 90d`. Runs same geohash-prefix → Turf.js pipeline and tags. Same pattern as `inboxReconciliationSweep` — periodic backfill as safety net.
2. **`hazardZoneSweep`** (secondary). Catches reports when a zone is later edited. Not the primary recovery for ingest failures.
3. **Manual ops replay callable.** Available for targeted recovery of specific reports.

### 22.5 Functional Flow — Custom Zone Sweep

Triggered by `onWrite hazard_zones/{zoneId}` where `zoneType === 'custom'`.

1. Read old and new zone state from change event.
2. Compute bbox union (old ∪ new).
3. Query `report_ops` where:
   - `createdAt >= now() - 90 days` (older archived per §11.2)
   - `locationGeohash` prefix intersects bbox union (uses the denormalized geohash from §5.1 — sweeper never reads `report_private`, avoiding streaming-audit flood)
4. For each candidate: point-in-polygon against NEW geometry (or empty if deleted). Delta:
   - In old but not new → remove tag (or keep, depending on trigger kind — see asymmetry below)
   - In new but not old → append tag with `taggedBy: 'zone_sweep'`
   - In both → no-op
5. Apply delta atomically per `report_ops`.
6. Idempotency: `hazard_sweep_{zoneId}_v{version}` in `idempotency_keys`.

**Deletion-vs-expiration asymmetry** (decision #58):

- `deleteCustomHazardZone` (soft delete): sweep REMOVES tags from active reports. Deletion means "this zone should not have been in effect."
- `hazardZoneExpirationSweep` (time-based): sets `expiredAt`, does NOT remove tags. Expiration is lifecycle; history preserved for analytics.

**Bound on sweep work.** Custom zone bbox capped ~100km²; at ~500 active reports/muni, scans dozens of candidates. Latency 2–5s, async, not on hot path.

**Concurrency safety for zone edits.** All custom zone mutations (create/update/delete) use Firestore transactions that atomically read current state, verify `version === expectedVersion`, and write both the zone update and `history/{version}` in one commit. Second writer retries, reads new version, fails with structured CONFLICT (surfaced in UI). Prevents the race where parallel callables both read version N and silently overwrite `history/v(N+1)`.

### 22.6 Functional Flow — Reference Layer Upload

1. Superadmin downloads hazard maps from source agency via their own channel, converts to GeoJSON locally, prepares manifest (source agency, version, date).
2. Admin Desktop → Hazard Layers → Upload. Selects `hazardType`, enters `sourceAgency`, `sourceVersion`, re-enters TOTP.
3. Client calls `requestHazardUploadUrl` → signed Cloud Storage URL (10-min expiry, Content-Type + size restricted).
4. Client uploads GeoJSON to temp path.
5. Client calls `uploadHazardReferenceLayer` with temp path + metadata. Callable server-side:
   - Loads GeoJSON, validates schema
   - For each feature: Douglas-Peucker simplification to `system_config/hazard_zone_limits.maxVertices` (default 500), computes bbox + 6-char geohash prefix, assigns new `zoneId`
   - Writes `hazard_zones` docs with `zoneType: 'reference'`, `scope: 'provincial'`
   - Writes source GeoJSON to permanent path `reference/{hazardType}/{sourceVersion}/{zoneId}.geojson`
   - Streams audit event per new zone
   - Returns summary: zones created, vertices before/after, rejected features with reasons
6. **Superseding is a separate step.** Superadmin calls `supersedeHazardReferenceLayer(oldVersion, newVersion)` after inspecting the upload; marks old zones `supersededBy` + `supersededAt`. Matches §7.5.1 NDRRMC-escalation pattern (stage then activate).

### 22.7 Functional Flow — Custom Zone Create

1. Admin draws polygon on map with Leaflet-Draw (or pastes GeoJSON).
2. Client-side validation: vertex count ≤500, closed polygon, bbox inside jurisdiction (for muni admin).
3. Admin fills: `hazardType`, `purpose`, `severity`, `expiresAt` (required, must be future, ≤30 days out).
4. Client calls `createCustomHazardZone`. Callable:
   - Validates `isActivePrivileged()`, jurisdiction match (muni admin cannot create `scope: 'provincial'` or `municipalityId` ≠ own)
   - Validates vertex cap, closure, bbox inside municipality boundary (for muni admin)
   - Douglas-Peucker normalization (canonical form)
   - Computes bbox + geohash prefix
   - Writes `hazard_zones/{newZoneId}` + `history/v1` atomically in one Firestore transaction
   - Streams audit event
5. `onWrite` trigger fires `hazardZoneSweep`.
6. If `scope === 'provincial'`, trigger auto-attaches a Command Channel thread with every affected muni admin (per decision #59 — cross-muni coordination via Command Channel, not direct visibility).

### 22.8 Functional Flow — Polygon-Targeted Mass Alert

Extends §7.5.1 NDRRMC-escalation workflow.

1. Admin opens Send Mass Alert → selects target type "Polygon" (alongside Municipality / Barangay).
2. Admin picks existing zone from own-jurisdiction list OR draws ad-hoc polygon.
3. Admin enters message; client calls extended `massAlertReachPlanPreview` with `targetType: 'polygon'` + geometry.
4. Callable:
   - Reverse-geocodes polygon to affected barangays (in-memory point-in-polygon over barangay boundary dataset, CF-cached)
   - Estimates recipients: registered users in affected barangays + opted-in msisdns + pseudonymous users with recent-known location inside
   - Computes routing per §7.5.1: ≤5k + single-muni → direct; else → escalation
   - Returns Reach Plan (breakdown, routing decision, preview)
5. Admin reviews Reach Plan → confirms.
6. Direct path: extended `sendMassAlert` server-side validates thresholds (defense in depth), writes `alerts/{id}` with polygon, fans out FCM + SMS, streams audit with polygon geometry.
7. Escalation path: extended `requestMassAlertEscalation` sets `mass_alert_requests/{id}.targetGeometry`; Superadmin forwards via existing `forwardMassAlertToNDRRMC`.

**Why reverse-geocode to barangay, not direct GPS match against users?** Citizen locations mostly stale (no continuous polling for privacy + battery); registered citizen addresses are at barangay granularity by design. Polygon precision becomes a filter refinement ON TOP of barangay routing: "send to registered users in affected barangays whose most recent known location is inside polygon," falling back to barangay-level when no recent location.

**De minimis boundary intersection handling.** Philippine LGU boundary data has known gaps and overlaps. A polygon that clips 50 meters into a neighboring municipality due to GIS data quality should not force NDRRMC escalation when the alert is operationally single-municipality. Routing rule:

- Compute polygon-municipality intersection area for each municipality touched.
- **Primary municipality** is the one with the largest intersection area.
- A secondary municipality is **de minimis** if BOTH: (a) intersection area < `system_config/polygon_alert_thresholds.deMinimisAreaPct` (default 5%) of total polygon area, AND (b) estimated recipients in clipped area < `system_config/polygon_alert_thresholds.deMinimisRecipientCount` (default 50).
- If ALL secondary munis are de minimis → treat as single-municipality (primary). Recipients in clipped areas still included.
- If ANY secondary muni exceeds de minimis → multi-municipality routing (escalation per §7.5.1).
- Reach Plan preview shows intersection breakdown so admin sees exactly which munis are involved.
- Both thresholds in `system_config`, adjustable without redeploy.

### 22.9 Functional Flow — Analytics

Analytics live in BigQuery. Callable wrappers:

| Callable                                 | Returns                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `hazardAnalyticsZoneTagCounts`           | Per-zone count of tagged reports in a time window, filterable by severity                                       |
| `hazardAnalyticsMunicipalityRiskDensity` | Per-barangay incident count / area, intersected with hazard zones, normalized by population (if dataset loaded) |
| `hazardAnalyticsReportsInZone`           | List of report IDs tagged with a given zone (no PII), for drill-down                                            |

Each is rate-limited and jurisdiction-scoped server-side:

- Muni admin: `WHERE municipality_id = <own>`
- Superadmin: unrestricted

Callables run BigQuery queries via function service account. Client never talks to BigQuery directly. Target p95 <3s over 30-day window at ~50k reports × 5k zones. Materialized views pre-aggregate if p95 drifts.

### 22.10 Expiration Handling

`hazardZoneExpirationSweep` runs hourly:

- Query `hazard_zones` where `zoneType === 'custom'`, `expiresAt <= now()`, `expiredAt == null`
- Set `expiredAt: now()`, append history entry `{action: 'expired'}`
- Does NOT trigger `hazardZoneSweep`. Tags preserved (decision #58).
- Streams audit (batch path — automatic action).

Admin map clients filter live overlay by `expiredAt == null`. Analytics dashboard shows expired zones for historical context.

### 22.11 Rate Limits

Per `rate_limits/{key}` framework (§5.5 / existing):

| Callable                     | Limit                 |
| ---------------------------- | --------------------- |
| `uploadHazardReferenceLayer` | 10/day per superadmin |
| `createCustomHazardZone`     | 50/day per admin      |
| `updateCustomHazardZone`     | 100/day per admin     |
| `deleteCustomHazardZone`     | 20/day per admin      |

Hard limit returns structured error; soft limit (80% of cap) logs moderation-elevation per existing rate-limit pattern.

**Emergency rate-limit elevation.** During a declared emergency (`declareEmergency`) or active surge pre-warm (§10.3), all hazard zone rate limits multiply by `system_config/hazard_zone_limits.emergencyMultiplier` (default 5×). Same mechanism as the `minInstances` pre-warm — automatic, logged, reverts when emergency ends. Prevents the 50/day custom-zone cap from pinching a muni admin drawing rapid-evolving evacuation zones during typhoon landfall.

### 22.12 MFA & Session

No new MFA surface. Hazard mutations inherit existing Admin Desktop privilege posture (§4.5):

- Superadmin: TOTP + 4h re-auth
- Muni admin: TOTP + 8h re-auth
- `isActivePrivileged()` check on every callable

### 22.13 Capability Deny Matrix

| Role                  | Read `hazard_zones`                  | Read history          | Call any hazard callable        | Polygon-target mass alert               |
| --------------------- | ------------------------------------ | --------------------- | ------------------------------- | --------------------------------------- |
| Citizen               | ❌                                   | ❌                    | ❌                              | ❌                                      |
| Responder             | ❌                                   | ❌                    | ❌                              | ❌                                      |
| Agency Admin          | ❌                                   | ❌                    | ❌                              | ❌                                      |
| Municipal Admin       | ✅ reference (all) + own-muni custom | ✅ for readable zones | ✅ own-muni custom (any author) | ✅ own muni (≤5k direct, else escalate) |
| Provincial Superadmin | ✅ all                               | ✅ all                | ✅ all                          | ✅ with Reach Plan                      |

All denials have explicit CI negative tests (pilot-blocker scenarios #37–#39). Capability contract tests enforce Principle #11: every UI affordance maps to a rule-enforced callable or Firestore read. CI test: no muni-admin UI bundle imports `uploadHazardReferenceLayer`; no citizen / responder / agency UI imports hazard-layer component bundle (build-time static check).

### 22.14 Admin Desktop Integration

- New nav tab: **Hazard Layers** (between Reports and Analytics; IA pass deferred to `frontend-design`)
- Global layer-toggle control on main map (persisted via `users/{uid}/preferences`)
- Status-bar indicator: if any active zone intersects viewport → count + hazard type summary
- Client-derived `canHazardAuthor: boolean` from role + jurisdiction, controls "Draw new zone" visibility
- **Agency Admin view unchanged** — no Hazard Layers tab, no layer-toggle, no analytics (rule-enforced + UI-enforced defense in depth)

**Dual-monitor Superadmin layout additions:**

- **Primary (Analytics Dashboard):** hazard analytics panel (BigQuery-backed for trends); reference layer version status (Firestore-direct — must reflect just-committed state); custom zone activity (Firestore-direct: active count, expiring-within-24h, recently-created)
- **Secondary (Provincial Map):** all 3 reference layer toggles; custom zone list (all munis, filterable); reference layer management panel (upload, inspect, supersede)

**Consistency with existing patterns:**

- Custom zone edit UI matches report-edit patterns (modal-over-map; §7.3 muni admin principle "Map is permanent background")
- Reference layer rendering uses existing Leaflet tile layer pattern
- Hazard mutation audit entries appear in existing audit viewer (Superadmin §7.5)
- Hazard badges on reports match existing badge system (`witnessPriorityFlag`, `Responder-Witnessed`)

### 22.15 Open Dependencies for Implementation Plan

Not design ambiguities — dependencies the implementation plan must address explicitly:

1. **Barangay boundary dataset.** Reverse-geocoding polygons to barangays (§22.8) requires a barangay boundary GeoJSON for the 12 Camarines Norte munis. Does not exist in current architecture. Plan must include sourcing + versioning this dataset.
2. **Leaflet-Draw dependency.** Adds ~40KB gzipped to the admin bundle. Confirm acceptable against admin bundle budget.
3. **BigQuery GIS availability.** `GEOGRAPHY` type + `ST_Contains` are standard BigQuery features; confirm enabled in `bantayog-prod`.
4. **Douglas-Peucker library.** `@turf/simplify` is the natural pick (Turf.js ecosystem already used for point-in-polygon).
5. **Geohash library.** `ngeohash` for 6-char geohash encoding in CF + client.
6. **PAGASA + MGB data licensing.** Superadmin obtains GeoJSON via official channels. Attribution requirements captured in upload manifest and displayed in audit.

### 22.16 Open Risks for Pilot to Validate

1. Real-world polygon complexity from PH government maps — ≤500-vertex cap edge cases? May need bump to 1000.
2. Custom zone authorship rate during active typhoon — does 50/day pinch muni admins in rapid-evolving evacs? (Emergency multiplier mitigates.)
3. Auto-tag latency under surge — 10–20ms budget when `processInboxItem` at `minInstances: 3`?
4. Barangay boundary accuracy in rural Camarines Norte (informal boundaries) — reverse-geocode miss rate?
5. Admin drawing UX on tablet in field — Leaflet-Draw on touch + small screen precision unproven.

---

**End of Architecture Specification v8.0**
