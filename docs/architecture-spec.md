# Bantayog Alert — Software Architecture Specification

**Version:** 2.0 (Post-Opposition Review)  
**Date:** 2026-04-15  
**Status:** Revised — Incorporates 14 review findings  
**Author:** Architecture Team  
**Stack:** React 18 + Vite + Firebase + Leaflet + Zustand + TanStack Query

---

## Revision History

| Version | Date       | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.0     | 2026-04-15 | Initial architecture specification                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2.0     | 2026-04-15 | Opposition review: 3 critical fixes (triptych atomicity, anonymous write security, report_ops write rules), 4 high fixes (offline double-write, read cost optimization, location write frequency, index plan), 4 medium fixes (event sourcing rename, border incidents, repository framing, dispatch data normalization), 3 low fixes (error boundaries, SW updates, staging env). New sections: §3.5 Index Plan, §4.5 Error Boundaries, §5.4 Location Tracking Cost Model, §10.2 Staging Environment. |

---

## 1. Context & Driving Forces

### 1.1 What This System Is

Bantayog Alert is a **crowd-sourced disaster reporting and real-time coordination platform** for the Province of Camarines Norte, Philippines (12 municipalities, ~600,000 population). Citizens report emergencies from the field; municipal administrators triage and dispatch responders; specialized agencies coordinate tactical response; and the provincial PDRRMO maintains province-wide situational awareness.

### 1.2 Why Context Matters to Architecture

The architecture must serve five deeply different user profiles operating under radically different conditions — simultaneously. The farmer in Paracale with a low-end Android phone on 3G during a typhoon is as important as the PDRRMO operator on dual monitors with fiber internet. This isn't a typical CRUD app; it's an **operational command system** where latency can cost lives and offline capability isn't a feature — it's a requirement.

**Key constraints that shape every decision:**

- **Connectivity is unreliable.** Camarines Norte's cellular coverage is spotty in mountainous barangays. Reports must queue locally and sync when signal returns.
- **Time pressure is extreme.** During a typhoon surge, a municipal admin may need to process 50+ reports per hour. The UI and data model must support batch triage, not one-at-a-time review.
- **Jurisdiction boundaries are load-bearing.** A Daet admin must never see Labo's citizen PII. An agency admin must never dispatch another agency's responders. These aren't preferences — they're legal and operational requirements.
- **The user base spans the tech literacy spectrum.** Anonymous citizens who've never used an app before. Volunteer responders with basic smartphones. Government employees with formal IT training. The same codebase serves all of them.

### 1.3 Architectural Principles

1. **Design for the worst network, not the best.** Every write operation must work offline. Every read must degrade gracefully when stale.
2. **Enforce privacy at the data layer, not the UI layer.** Jurisdiction, role, and agency boundaries are Firestore security rules — not frontend conditional rendering.
3. **Test seams over portable abstractions.** Repository classes exist so unit tests can mock Firestore. They are not a backend-portability layer — Firestore's real-time listeners, offline persistence, and security rules are deeply specific and cannot be meaningfully re-implemented on a different database without rebuilding the entire data access pattern.
4. **Optimize for the surge, not the steady state.** The system will idle 90% of the time. It must handle 10x load spikes during active disasters without architectural changes.
5. **Server-authoritative writes.** All mutating operations route through Cloud Functions (callable or triggered). Client-side Firestore writes are denied by security rules except for narrowly scoped responder status updates. This ensures rate limiting, validation, audit logging, and the triptych atomicity guarantee.

---

## 2. System Overview

### 2.1 Deployment Architecture

The entire system is a **single Progressive Web App** deployed on Firebase Hosting, backed by Firestore, Cloud Functions, Cloud Storage, Firebase Auth, and Firebase Realtime Database (for high-frequency location tracking). There is no separate mobile app — the PWA installs to the home screen and functions as a near-native experience on both iOS and Android.

**Why a single PWA (not five apps or a native split):**

- One codebase, one deployment pipeline, one service worker.
- No app store approval delays — critical for emergency updates.
- Route-level code splitting means the citizen only downloads citizen code; the admin only downloads admin code. Bundle sizes stay within the 300KB-per-role budget.
- Service workers enable offline report submission, cached map tiles, and background sync — the three offline capabilities the specs require.

### 2.2 The Five Roles

| Role                      | Primary Device             | Primary View               | Key Capability                                  |
| ------------------------- | -------------------------- | -------------------------- | ----------------------------------------------- |
| **Citizen**               | Mobile (low-end Android)   | Bottom-nav, map-first      | Submit reports anonymously, track status        |
| **Responder**             | Mobile (field smartphone)  | Dispatch queue, navigation | Accept/decline dispatches, update status, SOS   |
| **Municipal Admin**       | Desktop (1920×1080+)       | Map-centric, panels slide  | Triage queue, dispatch, mass alerts             |
| **Agency Admin**          | Desktop (station dispatch) | Map-centric, roster panel  | Manage own agency roster, respond to requests   |
| **Provincial Superadmin** | Desktop (dual-monitor)     | Analytics-first dashboard  | Province-wide monitoring, emergency declaration |

### 2.3 Technology Stack

| Layer                   | Technology                               | Why                                                                                 |
| ----------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| **UI Framework**        | React 18                                 | Concurrent rendering for real-time updates during surges                            |
| **Build Tool**          | Vite                                     | Sub-second HMR, optimized production splits                                         |
| **State Management**    | Zustand                                  | Lightweight stores, no boilerplate, middleware for offline queue                    |
| **Server State**        | TanStack Query                           | Cache layer wrapping Firestore listeners (NOT polling — see §4.2)                   |
| **Maps**                | Leaflet + OpenStreetMap                  | Open source, free, offline tile caching, lightweight (~40KB)                        |
| **Database (primary)**  | Firestore                                | Real-time listeners, offline persistence, security rules                            |
| **Database (location)** | Firebase Realtime Database               | Bandwidth-priced, not per-operation — 10x cheaper for high-frequency GPS (see §5.4) |
| **Auth**                | Firebase Auth                            | Custom claims for roles, MFA for admin tiers                                        |
| **Storage**             | Cloud Storage for Firebase               | Photo/video uploads with resumable uploads for poor connections                     |
| **Functions**           | Cloud Functions (Node.js)                | Server-authoritative writes, dispatch timers, cron jobs, FCM triggers               |
| **Push**                | Firebase Cloud Messaging                 | Dispatch notifications, SOS alerts, mass alerts                                     |
| **Hosting**             | Firebase Hosting                         | CDN, SSL, single-command deploy                                                     |
| **Testing**             | Vitest + Playwright + Firebase Emulators | Unit, integration, and E2E with local Firebase                                      |
| **Styling**             | Tailwind CSS                             | Utility-first for rapid iteration, small production bundles                         |

---

## 3. Data Architecture

### 3.1 The Report Triptych (Core Design Decision)

Every citizen report is stored as **three separate Firestore documents** sharing the same document ID across three collections. This is the most important structural decision in the system.

**Collection 1: `reports`** — Public and citizen-visible data.
Contains: report type, severity, approximate location (barangay-level), current status, municipality ID, timestamps, human-readable report ID (format: `YYYY-MUNI-NNNN`).

**Collection 2: `report_private`** — Personally identifiable information.
Contains: reporter name, phone number, email, exact GPS coordinates (GeoPoint), device fingerprint hash, anonymity flag, trust score, citizen UID. This collection is the privacy boundary.

**Collection 3: `report_ops`** — Operational coordination state.
Contains: verifying admin UID, classifying admin UID, admin notes, duplicate linkage (`duplicateOf` reference), escalation status, agency request records, incident commander UID, active responder count (denormalized), visibility scope for border incidents.

**⚠️ CRITICAL: Triptych atomicity (Review Finding #1)**

All three documents are created in a single Firestore transaction inside a Cloud Function. Citizens NEVER write directly to any of these collections. The flow is:

```
Citizen client → calls `submitReport` Cloud Function (HTTPS callable)
  → Function validates payload (schema, required fields)
  → Function enforces rate limits (device, phone, IP — checks `rate_limits` collection)
  → Function runs duplicate detection (geo-proximity + time window)
  → Function creates all 3 documents in a single Firestore transaction
  → Function returns { reportId, status: 'submitted' }
  → If offline: client queues the callable invocation in IndexedDB
```

This guarantees: no orphan documents, no writes bypassing rate limits, no malformed data in Firestore.

**Why three documents instead of one:**
Firestore security rules operate at the document level, not the field level. A single document containing both "approximate location for the public feed" and "reporter's phone number" would require field-level masking that Firestore cannot enforce. The triptych makes each access boundary a simple document-level rule.

### 3.2 Complete Collection Map

```
firestore/
├── reports/                          # Public report data
│   └── {reportId}/
│       ├── status_log/              # Append-only status history (audit log, NOT event sourcing)
│       │   └── {entryId}            # { action, actorId, actorRole, timestamp, notes }
│       ├── media/                    # Photos and videos
│       │   └── {mediaId}            # { storageUrl, type, uploadedBy, caption, timestamp }
│       ├── messages/                 # Admin-citizen communication
│       │   └── {msgId}              # { senderId, senderRole, text, timestamp, isUrgent }
│       └── field_notes/             # Responder observations
│           └── {noteId}             # { responderId, text, noteType, geopoint, photos[], timestamp }
│
├── report_private/                   # PII (admin-only, Cloud Functions write only)
│   └── {reportId}                   # Same ID as reports/{reportId}
│       └── { reporterName, phone, email, exactLocation (GeoPoint),
│             deviceFingerprint, isAnonymous, trustScore, citizenUid }
│
├── report_ops/                       # Dispatch & coordination state
│   └── {reportId}                   # Same ID as reports/{reportId}
│       └── { verifiedBy, classifiedBy, adminNotes, duplicateOf,
│             escalatedTo, agencyRequests[], incidentCommanderId,
│             activeResponderCount (denormalized),
│             visibility: { scope: 'municipality' | 'shared' | 'provincial',
│                           sharedWith?: string[] } }
│
├── dispatches/                       # Dispatch records — SOURCE OF TRUTH for assignments
│   └── {dispatchId}
│       └── { reportId, responderId, agencyId, dispatchedBy, dispatchedAt,
│             status (pending/accepted/acknowledged/in_progress/resolved/declined/timeout),
│             acknowledgedAt?, declineReason?, timeoutAt, priority,
│             resolvedAt?, resolutionSummary?, proofPhotoUrl? }
│
├── users/                            # All user profiles
│   └── {uid}
│       └── { role, displayName, email, phone, municipalityId, barangayId,
│             agencyId?, trustScore, createdAt, lastLoginAt, status }
│
├── responders/                       # Extended responder data (Firestore — profile + availability)
│   └── {uid}
│       └── { type (POL/FIR/MED/ENG/SAR/SW/GEN), stationName, agencyId,
│             availabilityStatus, currentDispatchId?,
│             skills[], shiftSchedule }
│
├── agencies/                         # Agency registry
│   └── {agencyId}
│       └── { name, type, jurisdictionMunicipalityIds[], adminUids[], createdAt }
│
├── alerts/                           # Mass alerts (citizen-facing)
│   └── {alertId}
│       └── { type (evacuation/warning/advisory), title, message, priority,
│             targetMunicipalityIds[], targetBarangayIds[], sentBy, sentAt,
│             channels[], recipientCount, source (MDRRMO/PAGASA) }
│
├── emergencies/                      # Provincial emergency declarations
│   └── {emergencyId}
│       └── { type, severity (1-4), affectedMunicipalities[], justification,
│             declaredBy, declaredAt, expiresAt, eocActivationLevel, status }
│
├── provincial_resources/             # Provincial asset inventory
│   └── {resourceId}
│       └── { name, type, location, status, deployedTo?, schedule[] }
│
├── mutual_aid_requests/              # Cross-municipality resource sharing
│   └── {requestId}
│       └── { fromMunicipalityId, toMunicipalityId, reportId, requestType,
│             details, status, approvedBy?, respondedAt? }
│
├── audit_logs/                       # System-wide audit trail
│   └── {logId}
│       └── { action, actorId, actorRole, targetCollection, targetId,
│             details, timestamp, ipAddress? }
│
├── rate_limits/                      # Rate limit counters (checked by Cloud Functions)
│   └── {deviceFingerprint|phone|ip}
│       └── { count, windowStart, type }
│
├── system_config/                    # System-wide configuration (superadmin only)
│   ├── incident_types               # Configurable incident types + severity thresholds
│   ├── escalation_rules             # Auto-escalation trigger conditions
│   ├── alert_templates              # Reusable alert message templates
│   └── rate_limit_thresholds        # Configurable limits per device/phone/IP
│
├── reports_archive/                  # Archived reports (>6 months)
│   └── {reportId}
│
└── metrics_province/                 # Aggregated metrics (computed by Cloud Functions)
    └── {snapshotId}
        └── { timestamp, byMunicipality: { incidents, avgResponseTime, responderUtilization } }
```

**Realtime Database (separate from Firestore):**

```
rtdb/
└── responder_locations/
    └── {uid}/
        └── { lat, lng, heading, speed, accuracy, timestamp, dispatchId }
        # Writes every 30 seconds while on active dispatch
        # Reads by admin/agency dashboards via RTDB listeners
        # Bandwidth-priced, not per-operation (see §5.4)
```

### 3.3 Firestore Security Rules Architecture

Security rules enforce three orthogonal access dimensions simultaneously:

1. **Role** — What type of user is this?
2. **Jurisdiction** — Which municipality does this data belong to, and does the user's municipality match?
3. **Agency** — For agency admins and responders, does their agencyId match?

**⚠️ CRITICAL (Review Finding #2, #3): All report creation goes through Cloud Functions. Client writes to reports, report_private, and report_ops are DENIED.**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ═══════════════════════════════════════════════
    // Helper functions
    // ═══════════════════════════════════════════════
    function isAuthenticated() {
      return request.auth != null;
    }
    function hasRole(role) {
      return request.auth.token.role == role;
    }
    function isInMunicipality(municipalityId) {
      return request.auth.token.municipalityId == municipalityId;
    }
    function isMunicipalAdminOf(municipalityId) {
      return hasRole('municipal_admin') && isInMunicipality(municipalityId);
    }
    function isSuperadmin() {
      return hasRole('provincial_superadmin');
    }
    function isAgencyAdminOf(agencyId) {
      return hasRole('agency_admin') && request.auth.token.agencyId == agencyId;
    }

    // ═══════════════════════════════════════════════
    // Reports (public data)
    // ═══════════════════════════════════════════════
    match /reports/{reportId} {
      // Anyone authenticated can read (public feed, map)
      allow read: if isAuthenticated();

      // NO client writes — all creation via Cloud Functions (Finding #1, #2)
      allow create: if false;

      // Only municipal admin of the report's municipality can update (verify, classify)
      allow update: if isMunicipalAdminOf(resource.data.municipalityId)
                    || isSuperadmin();

      // No deletes — archive only (via Cloud Functions)
      allow delete: if false;

      // Subcollections
      match /status_log/{entryId} {
        allow read: if isAuthenticated();
        allow create: if false; // Cloud Functions only (audit integrity)
      }
      match /media/{mediaId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated(); // Citizens upload photos during report
      }
      match /messages/{msgId} {
        allow read: if isMunicipalAdminOf(
                        get(/databases/$(database)/documents/reports/$(reportId)).data.municipalityId)
                    || (hasRole('citizen') && request.auth.uid ==
                        get(/databases/$(database)/documents/report_private/$(reportId)).data.citizenUid);
        allow create: if isAuthenticated();
      }
      match /field_notes/{noteId} {
        allow read: if isAuthenticated();
        allow create: if hasRole('responder'); // Responders add field observations
      }
    }

    // ═══════════════════════════════════════════════
    // Report private (PII) — admin + superadmin only
    // ═══════════════════════════════════════════════
    match /report_private/{reportId} {
      allow read: if (isMunicipalAdminOf(resource.data.municipalityId)
                      // Anonymous reports: hide PII fields even from superadmin
                      // (enforced by Cloud Function — rules allow read, function masks fields)
                      || isSuperadmin());
      allow write: if false; // Cloud Functions only
    }

    // ═══════════════════════════════════════════════
    // Report ops (dispatch state) — Finding #3: explicit write rules
    // ═══════════════════════════════════════════════
    match /report_ops/{reportId} {
      allow read: if isMunicipalAdminOf(resource.data.municipalityId)
                  || isSuperadmin()
                  // Agency admin can read if their agency was requested
                  || (hasRole('agency_admin')
                      && request.auth.token.agencyId in resource.data.agencyRequests)
                  // Responder can read if they have an active dispatch for this report
                  // (checked via dispatches collection in Cloud Function — see note)
                  || hasRole('responder');
                  // Note: Responder read access is broad here but filtered client-side
                  // to only show assigned incidents. True enforcement is at dispatch query level.

      // Responders can update ONLY activeResponderCount-adjacent fields via specific Cloud Functions
      // Direct client writes denied — all updates through Cloud Functions for audit trail
      allow update: if false;
      allow create: if false;
      allow delete: if false;

      // Border incident visibility (Finding #9):
      // Admin can also read if their municipalityId is in visibility.sharedWith[]
      // This is handled by the read rule above + Cloud Function populating sharedWith
    }

    // ═══════════════════════════════════════════════
    // Dispatches — source of truth for responder assignments (Finding #11)
    // ═══════════════════════════════════════════════
    match /dispatches/{dispatchId} {
      allow read: if (hasRole('responder') && resource.data.responderId == request.auth.uid)
                  || isMunicipalAdminOf(resource.data.municipalityId)
                  || isSuperadmin()
                  || isAgencyAdminOf(resource.data.agencyId);

      // Responders can update their own dispatch status (accept, acknowledge, resolve)
      allow update: if hasRole('responder')
                    && resource.data.responderId == request.auth.uid
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['status', 'acknowledgedAt', 'resolvedAt',
                                 'resolutionSummary', 'proofPhotoUrl']);

      // Only Cloud Functions create dispatches (admin dispatches via callable)
      allow create: if false;
      allow delete: if false;
    }

    // ═══════════════════════════════════════════════
    // Responders — agency-scoped
    // ═══════════════════════════════════════════════
    match /responders/{uid} {
      allow read: if request.auth.uid == uid
                  || isAgencyAdminOf(resource.data.agencyId)
                  || hasRole('municipal_admin')
                  || isSuperadmin();

      // Responders can update their own availability
      allow update: if request.auth.uid == uid
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['availabilityStatus']);

      // Agency admin manages their own roster
      allow update: if isAgencyAdminOf(resource.data.agencyId);

      // Cloud Functions handle creation (admin-provisioned accounts)
      allow create: if false;
    }

    // ═══════════════════════════════════════════════
    // Rate limits — Cloud Functions read/write only
    // ═══════════════════════════════════════════════
    match /rate_limits/{limitId} {
      allow read, write: if false; // Admin SDK only
    }

    // ═══════════════════════════════════════════════
    // Audit logs — append only, read by superadmin
    // ═══════════════════════════════════════════════
    match /audit_logs/{logId} {
      allow read: if isSuperadmin();
      allow write: if false; // Cloud Functions only
    }

    // ═══════════════════════════════════════════════
    // System config — superadmin only
    // ═══════════════════════════════════════════════
    match /system_config/{configId} {
      allow read: if isAuthenticated();
      allow write: if isSuperadmin();
    }

    // ═══════════════════════════════════════════════
    // Users, agencies, alerts, emergencies, etc.
    // ═══════════════════════════════════════════════
    match /users/{uid} {
      allow read: if request.auth.uid == uid || hasRole('municipal_admin') || isSuperadmin();
      allow update: if request.auth.uid == uid
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['displayName', 'phone', 'barangayId']);
    }

    match /agencies/{agencyId} {
      allow read: if isAuthenticated();
      allow write: if isSuperadmin();
    }

    match /alerts/{alertId} {
      allow read: if isAuthenticated();
      allow create: if false; // Cloud Functions only (sendMassAlert callable)
    }

    match /emergencies/{emergencyId} {
      allow read: if isAuthenticated();
      allow write: if false; // Cloud Functions only (declareEmergency callable)
    }
  }
}
```

### 3.4 Firestore Converters

All Firestore documents pass through TypeScript converter classes that handle serialization/deserialization, timestamp conversion, and type safety. This is the **testing seam** between Firestore and the domain layer — repositories exist for mockability in unit tests, not for backend portability (Review Finding #10).

```typescript
// Domain model — no Firebase types
interface Report {
  id: string
  humanId: string // e.g., "2026-DAET-0471"
  type: IncidentType
  severity: Severity
  location: { barangay: string; municipality: string }
  status: ReportStatus
  municipalityId: string
  createdAt: Date
  verifiedAt?: Date
}

const reportConverter: FirestoreDataConverter<Report> = {
  toFirestore(report: Report): DocumentData {
    const { id, ...data } = report
    return {
      ...data,
      createdAt: Timestamp.fromDate(data.createdAt),
      verifiedAt: data.verifiedAt ? Timestamp.fromDate(data.verifiedAt) : null,
    }
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): Report {
    const data = snapshot.data()
    return {
      id: snapshot.id,
      humanId: data.humanId,
      type: data.type,
      severity: data.severity,
      location: data.location,
      status: data.status,
      municipalityId: data.municipalityId,
      createdAt: data.createdAt.toDate(),
      verifiedAt: data.verifiedAt?.toDate(),
    }
  },
}
```

### 3.5 Composite Index Plan (Review Finding #7)

Every Firestore query that filters on multiple fields or combines a filter with an `orderBy` requires a composite index. These must be defined in `firestore.indexes.json` and deployed before the app goes live.

```json
{
  "indexes": [
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "municipalityId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "municipalityId", "order": "ASCENDING" },
        { "fieldPath": "severity", "order": "DESCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "municipalityId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "severity", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "responderId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dispatchedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "reportId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "dispatches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "agencyId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dispatchedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "audit_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "actorId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "alerts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "targetMunicipalityIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "sentAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**Rule of thumb:** When adding a new query to the app, add the composite index here first. The Firebase Emulator will catch missing indexes during integration tests.

---

## 4. Frontend Architecture

### 4.1 Application Shell & Routing

The app shell loads instantly from the service worker cache. Route-level code splitting ensures each role only downloads its own UI code.

```
src/
├── app/
│   ├── App.tsx                       # Root: AuthProvider + RoleRouter + ErrorBoundary
│   ├── routes/
│   │   ├── citizen/                  # ~120KB chunk
│   │   ├── responder/                # ~100KB chunk
│   │   ├── admin/                    # ~180KB chunk
│   │   ├── agency/                   # ~140KB chunk
│   │   └── superadmin/              # ~200KB chunk
│   ├── layouts/
│   │   ├── CitizenLayout.tsx         # Bottom nav, mobile-first
│   │   ├── ResponderLayout.tsx       # Bottom nav + persistent SOS button
│   │   ├── AdminLayout.tsx           # Full-screen map + slide panels
│   │   └── SuperadminLayout.tsx      # Analytics dashboard + optional map
│   └── ErrorBoundary.tsx             # Catches render crashes, shows recovery UI
│
├── domain/                           # Pure business logic (no Firebase imports)
│   ├── models/
│   ├── services/
│   │   ├── SeverityCalculator.ts
│   │   ├── DuplicateDetector.ts      # Client-side pre-check (server is authoritative)
│   │   ├── TrustScoreEngine.ts       # Read-only — server computes, client displays
│   │   └── DispatchRecommender.ts
│   └── constants/
│       ├── incidentTypes.ts
│       ├── responderTypes.ts
│       └── municipalities.ts
│
├── infrastructure/
│   ├── firebase/
│   │   ├── config.ts
│   │   ├── converters/
│   │   ├── repositories/             # Testing seams, NOT portability abstractions (Finding #10)
│   │   │   ├── ReportRepository.ts
│   │   │   ├── DispatchRepository.ts  # Queries dispatches collection (Finding #11)
│   │   │   ├── UserRepository.ts
│   │   │   └── AlertRepository.ts
│   │   └── listeners/
│   │       ├── useReportListener.ts
│   │       ├── useDispatchListener.ts
│   │       └── useLocationListener.ts # RTDB listener, not Firestore (Finding #6)
│   ├── rtdb/
│   │   └── LocationTracker.ts        # RTDB writes for responder GPS (Finding #6)
│   ├── storage/
│   │   └── MediaUploader.ts
│   ├── messaging/
│   │   └── NotificationManager.ts
│   └── offline/
│       ├── OfflineQueue.ts           # IndexedDB queue for callable function invocations
│       └── ServiceWorkerRegistration.ts
│
├── stores/                           # Zustand stores (UI state only)
│   ├── authStore.ts
│   ├── uiStore.ts                   # Panel state, filters, keyboard shortcuts
│   ├── mapStore.ts                  # Viewport, layers
│   └── offlineStore.ts             # Queue status indicator
│
├── shared/
│   ├── components/
│   │   ├── Map/
│   │   ├── StatusBadge.tsx
│   │   ├── SeverityIndicator.tsx
│   │   ├── PhotoUploader.tsx
│   │   ├── OfflineIndicator.tsx
│   │   ├── LocationPicker.tsx
│   │   └── RoleErrorBoundary.tsx     # Per-role error boundary (Finding #12)
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useOfflineSync.ts
│   │   ├── useGeolocation.ts
│   │   └── useKeyboardShortcuts.ts
│   └── utils/
│
└── workers/
    └── sw.ts                         # Service worker (Workbox)
```

### 4.2 State Management Strategy (Revised — Finding #5)

**Zustand** handles client-side UI state (which panel is open, map filters, offline queue status). **TanStack Query** handles server state — but as a **cache wrapper around Firestore listeners**, NOT as a polling mechanism.

```typescript
// ⚠️ WRONG (v1.0 spec — causes double reads):
function usePendingReports(municipalityId: string) {
  return useQuery({
    queryKey: ['reports', 'pending', municipalityId],
    queryFn: () => reportRepository.getPending(municipalityId),
    refetchInterval: 30_000, // ← This polls ON TOP of onSnapshot listeners = 2x reads
  })
}

// ✅ CORRECT (v2.0 — listener feeds the cache):
function usePendingReports(municipalityId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const q = query(
      collection(db, 'reports').withConverter(reportConverter),
      where('municipalityId', '==', municipalityId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map((doc) => doc.data())
      // Push listener data into TanStack Query cache — no polling needed
      queryClient.setQueryData(['reports', 'pending', municipalityId], reports)
    })

    return unsubscribe
  }, [municipalityId, queryClient])

  return useQuery({
    queryKey: ['reports', 'pending', municipalityId],
    queryFn: () => reportRepository.getPending(municipalityId), // Fallback for initial load
    staleTime: Infinity, // Never stale — listener keeps it fresh
    // NO refetchInterval — listener handles freshness
  })
}
```

This gives you TanStack Query's cache management, loading states, and error handling — without the double-read cost of polling alongside listeners.

### 4.3 Offline Architecture (Revised — Finding #4)

Offline capability operates at three levels with **clear ownership boundaries** to prevent double-writes:

**Level 1: App Shell Caching (Workbox).** The HTML, CSS, JS bundles, and fonts are cache-first. The app always loads, even with no network. Map tiles for the user's municipality are pre-cached.

**Level 2: Read Caching (Firestore Offline Persistence).** Firestore's built-in offline persistence keeps a local copy of all listened documents. When the network drops, reads serve from the local cache transparently. **This handles reads only.**

**Level 3: Write Queue (IndexedDB — sole write mechanism when offline).** Since all report creation goes through callable Cloud Functions (which require network), the offline queue stores _callable function invocations_, not direct Firestore writes. When connectivity returns, the queue replays the callable invocations in order.

**Exception: Responder dispatch status updates** (accept, acknowledge, resolve) are direct Firestore writes to the `dispatches` collection. These use Firestore's built-in offline persistence to queue and sync. No IndexedDB involvement — Firestore handles it natively.

```typescript
// Offline queue — stores callable function invocations (NOT Firestore writes)
interface QueuedCallable {
  id: string
  functionName: 'submitReport' | 'sendFieldNote' | 'requestBackup'
  payload: unknown
  createdAt: Date
  retryCount: number
  maxRetries: 5
  status: 'pending' | 'syncing' | 'failed' | 'succeeded'
}
```

### 4.4 Real-Time Update Architecture

| Data              | Mechanism               | Write Frequency            | Read Mechanism                           | Why                                               |
| ----------------- | ----------------------- | -------------------------- | ---------------------------------------- | ------------------------------------------------- |
| Report status     | Cloud Function writes   | On state change            | Firestore `onSnapshot` → TanStack cache  | Citizens get instant "verified" notification      |
| Responder GPS     | **RTDB write**          | Every 30s while dispatched | **RTDB listener** (admin map)            | RTDB is bandwidth-priced, not per-op (Finding #6) |
| Pending queue     | Cloud Function creates  | On citizen submission      | Firestore `onSnapshot` → TanStack cache  | Instant triage queue refresh                      |
| Municipal metrics | Cloud Function computes | Every 5 min                | Firestore `onSnapshot`                   | Reduces read cost vs. aggregating live            |
| System health     | Cloud Function pings    | Every 30s                  | Firestore `onSnapshot` (superadmin only) | Single listener, not polling                      |
| Dispatch state    | Responder writes / CF   | On status change           | Firestore `onSnapshot`                   | Admin sees acceptance instantly                   |

### 4.5 Error Boundaries (Review Finding #12)

During a typhoon surge, a single component crash must not take down the entire admin interface. Error boundaries are layered:

```typescript
// Root boundary — catches catastrophic failures, shows "reload" page
<AppErrorBoundary>
  <AuthProvider>
    // Role boundary — catches per-role failures, preserves nav
    <RoleErrorBoundary roleName="Municipal Admin">
      <AdminLayout>
        // Panel boundary — catches panel failures, map stays interactive
        <PanelErrorBoundary panelName="Pending Queue">
          <PendingQueue />
        </PanelErrorBoundary>
        <PanelErrorBoundary panelName="Responder Dashboard">
          <ResponderDashboard />
        </PanelErrorBoundary>
      </AdminLayout>
    </RoleErrorBoundary>
  </AuthProvider>
</AppErrorBoundary>
```

If the pending queue component crashes during a surge, the map and responder dashboard continue operating. The admin sees "Pending Queue encountered an error — tap to retry" without losing map context.

---

## 5. Backend Architecture (Cloud Functions)

### 5.1 Function Categories

All mutating operations are server-authoritative. The Cloud Functions serve as the system's write authority.

**Callable Functions (HTTPS — client invokes directly):**

- `submitReport` — Validates payload, enforces rate limits, runs duplicate detection, creates triptych atomically, sends FCM to admin. **This is the ONLY way reports enter the system.**
- `dispatchResponder` — Admin selects responder → function creates dispatch record, sends FCM, starts Cloud Tasks timer.
- `sendMassAlert` — Validates admin permissions, targets correct municipalities/barangays, sends FCM.
- `declareEmergency` — Provincial superadmin only. Creates emergency record, triggers alerts.
- `requestEscalation` — Responder or admin escalates to provincial. Creates mutual aid request, notifies superadmin.
- `exportData` — Generates CSV/PDF exports. Logs to `audit_logs` with PII access flag.
- `bulkImportUsers` — Processes CSV for batch user creation.

**Triggered Functions (Firestore Triggers):**

- `onDispatchStatusChanged` — When responder updates dispatch status (accepted, resolved), updates `report_ops.activeResponderCount` (denormalized), appends to `status_log`, sends FCM to citizen/admin.
- `onReportVerified` — Sends push notification to citizen. Updates trust score on `users` doc.
- `onSOSActivated` — Sends urgent push to ALL admins in the municipality.

**Scheduled Functions (Pub/Sub Cron):**

- `archiveOldReports` — Daily at 2 AM Manila time. Moves reports older than 6 months to `reports_archive`.
- `deleteArchivedReports` — Monthly on the 1st at 3 AM. Permanently deletes archived reports older than 12 months.
- `autoCloseStaleReports` — Daily at midnight. Closes unverified reports older than 7 days.
- `computeProvinceMetrics` — Every 5 minutes. Aggregates municipal data into `metrics_province`.
- `detectAnomalies` — Every 30 minutes. Checks for response time spikes, zero-activity, over-utilization.

### 5.2 Dispatch Escalation Timer

The 5-minute dispatch acceptance window uses Cloud Tasks:

```
1. Admin calls `dispatchResponder` Cloud Function
2. Function creates dispatch record in Firestore (status: 'pending')
3. Function enqueues a Cloud Task with 5-minute delay
4. If responder updates dispatch status to 'accepted' within 5 min:
   a. Firestore trigger `onDispatchStatusChanged` fires
   b. Trigger cancels the Cloud Task (if still pending)
5. If 5 min elapses → Cloud Task fires → handler checks dispatch status:
   a. If still 'pending' → mark 'timeout', notify admin, log to status_log
   b. If already 'accepted' → no-op (race condition guard)
6. Admin can manually re-dispatch to next responder
```

### 5.3 Trust Score Engine

Citizens accumulate a trust score based on report quality:

- Base score for new users: 50
- Report verified by admin: +10
- Report rejected (false alarm): -15
- Report with photo + GPS: +5
- 3+ rejected reports: Flag for admin review, CAPTCHA required
- Score ≥ 80 + photo + GPS: Eligible for auto-verification

Trust scores are computed by Cloud Functions on verification events and stored on the `users` document.

### 5.4 Location Tracking Cost Model (Review Finding #6)

**Problem (v1.0):** Responder GPS writes every 5 seconds to Firestore. With 20 responders active during a 24-hour typhoon:

- Writes: 20 × (3600/5) × 24 = 345,600 writes/day = $0.62 in writes
- Reads: Each write triggers listeners for 12+ admins = 4.1M reads/day = $2.50 in reads
- Total: ~$3.12/day during surge. Acceptable for a single event, but unsustainable for daily operations.

**Solution (v2.0):** Use Firebase Realtime Database for location data. RTDB charges per bandwidth downloaded ($1/GB), not per operation.

- 20 responders × 86,400 writes/day × ~100 bytes = 172MB writes/day = $0.17
- 12 admins listening = 12 × 172MB reads = 2GB reads/day = $2.00
- Total: ~$2.17/day — but the critical difference is at 30-second intervals:
  - RTDB at 30s: 20 × 2880 × 100 bytes = 5.7MB writes, 69MB reads = $0.07/day
  - Firestore at 30s: 57,600 writes + 691K reads = $0.51/day

RTDB at 30-second intervals is **7x cheaper** than Firestore at the same frequency. At 5-second intervals, the savings are even larger.

**Implementation:** Responders write to `rtdb/responder_locations/{uid}` via the RTDB SDK. Admin map components subscribe to RTDB listeners. Firestore's `responders` collection stores profile data and availability — no GPS.

---

## 6. Security Architecture

### 6.1 Authentication Tiers

| Role                  | Auth Method                          | Session Duration             | MFA Required  |
| --------------------- | ------------------------------------ | ---------------------------- | ------------- |
| Citizen (anonymous)   | None — submits via callable function | N/A                          | No            |
| Citizen (registered)  | Phone OTP                            | 30 days                      | No            |
| Responder             | Email + password (admin-provisioned) | 8 hours                      | No            |
| Municipal Admin       | Email + password                     | 8 hours                      | Recommended   |
| Agency Admin          | Email + password                     | 8 hours                      | Recommended   |
| Provincial Superadmin | Email + password + MFA (TOTP)        | 8 hours, 30-min idle timeout | **Mandatory** |

### 6.2 Custom Claims

```typescript
interface CustomClaims {
  role: 'citizen' | 'responder' | 'municipal_admin' | 'agency_admin' | 'provincial_superadmin'
  municipalityId: string
  agencyId?: string
  mfaVerified?: boolean
  responderType?: string // POL, FIR, MED, ENG, SAR, SW, GEN
}
```

### 6.3 Anti-Abuse Measures

**Rate limiting** (enforced by the `submitReport` callable function, not by security rules):

- Per device fingerprint: 1 report/hour, 3 reports/day
- Per phone number: 1 report/hour, 3 reports/day
- Per IP: 5 reports/day
- Counters stored in `rate_limits` collection with TTL-based cleanup

**Device fingerprinting:** Combines screen resolution, WebGL renderer, timezone, and installed fonts to create a stable hash. Stored in `report_private.deviceFingerprint`.

**Duplicate detection:** The `submitReport` function checks for existing reports within 500m radius and 30 minutes. Returns `{ isDuplicate: true, existingReportId }` — citizen can choose to add evidence to existing report or submit as new.

### 6.4 Data Privacy (Republic Act 10173)

- **Anonymity is absolute.** The `submitReport` function checks `isAnonymous` and masks PII fields in `report_private` at write time (stores phone for contact but marks it hidden). Security rules alone cannot enforce field-level privacy, so the Cloud Function is the enforcement point.
- **Right to deletion.** Cloud Function `requestDeletion` anonymizes `report_private` records while preserving report content.
- **Retention policy.** Reports auto-archive at 6 months (cron job), permanently delete at 12 months.
- **PII export logging.** Every `exportData` invocation is logged to `audit_logs` with a PII flag.

---

## 7. Key Architectural Patterns

### 7.1 Repository Classes (Testing Seams — Revised Finding #10)

All Firestore access goes through repository classes. These exist for **testability** — unit tests mock the repository to avoid Firestore emulator overhead. They do NOT provide backend portability.

```typescript
// Repository interface — used by tests for mocking
interface IReportRepository {
  getById(id: string): Promise<Report | null>
  getPending(municipalityId: string): Promise<Report[]>
  subscribeToChanges(municipalityId: string, callback: (reports: Report[]) => void): Unsubscribe
}

// Firestore implementation — the only implementation we'll ever have
class FirestoreReportRepository implements IReportRepository {
  // Firestore-specific code. Not portable. Not pretending to be.
}
```

### 7.2 Command Pattern (Offline Queue)

All offline writes are callable function invocations queued as serializable commands in IndexedDB.

### 7.3 Status History (Audit Log — Revised Finding #8)

Every state change on a report appends to the `status_log` subcollection. This is an **append-only audit log**, not event sourcing. The current status lives directly on the `reports` document — the log is for history, accountability, and shift handoff context. The system does NOT support event replay or projection rebuilds.

### 7.4 Listener-Fed Cache (Revised Finding #5)

Firestore `onSnapshot` listeners feed TanStack Query's cache. No polling. No double-reads. The listener is the sole freshness mechanism; TanStack Query provides cache management, loading states, and error handling.

---

## 8. Performance Budget

| Metric                       | Target          | Enforcement                              |
| ---------------------------- | --------------- | ---------------------------------------- |
| First Contentful Paint       | < 2s on 3G      | Lighthouse CI in pipeline                |
| Time to Interactive          | < 5s on 3G      | Code splitting, lazy routes              |
| Total JS bundle (per role)   | < 300KB gzipped | Vite bundle analyzer gate                |
| Photo upload                 | < 30s on 3G     | Client-side compression to < 500KB       |
| Report submission (callable) | < 10s on 3G     | Optimistic UI + offline queue            |
| Map initial load             | < 3s            | Pre-cached tiles for user's municipality |
| Firestore cold start         | < 2s            | Persistence enabled, warm cache          |

---

## 9. Testing Strategy

### 9.1 Test Pyramid

| Layer       | Tool                            | What It Tests                                           | Coverage Target |
| ----------- | ------------------------------- | ------------------------------------------------------- | --------------- |
| Unit        | Vitest                          | Domain services, converters, utilities                  | 90%+            |
| Integration | Vitest + Firebase Emulators     | Security rules, Cloud Functions, repository ↔ Firestore | 80%+            |
| Component   | Vitest + React Testing Library  | UI components in isolation                              | Key flows       |
| E2E         | Playwright + Firebase Emulators | Full user journeys across roles                         | Critical paths  |

### 9.2 Security Rule Tests

Every access boundary has a corresponding test. Tests cover both positive (allowed access) and negative (denied access) cases.

### 9.3 Offline Tests

Playwright tests simulate network conditions:

- Submit report → kill network → verify IndexedDB queue → restore → verify callable retries → verify admin sees report
- Responder updates dispatch status offline → verify Firestore offline queue → restore → verify admin sees update

### 9.4 Surge Load Tests

Firebase Emulator-based load tests simulate typhoon conditions:

- 100 concurrent report submissions through `submitReport` callable
- 20 responders writing GPS to RTDB at 30-second intervals
- 12 admin listeners active simultaneously
- Verify: no dropped writes, no orphan triptych documents, rate limits enforced correctly

---

## 10. Deployment & Operations

### 10.1 Deployment Pipeline

```
main branch push
  → GitHub Actions
    → Lint + Type Check (tsc --noEmit)
    → Unit Tests (Vitest)
    → Integration Tests (Firebase Emulators — includes security rule tests)
    → Build (Vite production)
    → Bundle Size Check (fail if any role chunk > 300KB gzipped)
    → Deploy to Staging (bantayog-alert-staging)
    → E2E Smoke Tests (Playwright against staging)
    → Manual approval gate (for production)
    → Deploy to Production (bantayog-alert-prod)
```

### 10.2 Firebase Project Structure (Revised — Finding #14)

Three Firebase projects:

- `bantayog-alert-dev` — Local development, emulators
- `bantayog-alert-staging` — Pre-production validation, E2E tests run here
- `bantayog-alert-prod` — Production

Feature branches deploy to Firebase preview channels on the staging project.

### 10.3 Service Worker Update Strategy (Finding #13)

```typescript
// Service worker update flow:
// 1. New SW detected → show "Update available" banner (non-blocking)
// 2. User taps "Update now" → skipWaiting + reload
// 3. During declared emergencies: auto-update without prompt
//    (superadmin sets emergency flag → SW checks on activation)
// 4. Stale SW (>24h old) → force update on next app launch
```

### 10.4 Monitoring

- **Firebase Performance Monitoring** — client-side traces for report submission, map load, photo upload.
- **Cloud Function logs** — structured JSON logging, queryable in Cloud Logging.
- **Custom alerts** — function error rate > 1%, latency p95 > 5s, Firestore quota > 80%.
- **System Health Document** — updated every 30 seconds by Cloud Function, superadmin dashboard reads via listener.
- **Cost monitoring** — daily Firestore read/write/storage cost alerts at 80% of budget threshold.

---

## 11. Phase 1 Scope Boundaries

### What's In Phase 1

- All five roles with core workflows
- Report submission via callable function (anonymous + registered)
- Admin triage and verification (including quick triage mode)
- Responder dispatch with opt-in acceptance and Cloud Tasks timer
- Real-time map for all roles (Leaflet + OSM)
- Offline report submission (IndexedDB queue for callables)
- Push notifications for dispatches, verifications, SOS
- Mass alerts to citizens (push notification channel only)
- Responder SOS button
- Responder GPS via RTDB (30-second intervals while dispatched)
- Basic analytics (municipal admin dashboard)
- Provincial superadmin dashboard with MFA
- Agency admin with roster management and requested dispatches
- Data retention (6-month archival, 12-month deletion)
- Border incident shared visibility (Finding #9)
- Composite index deployment (Finding #7)
- Error boundaries at root, role, and panel levels (Finding #12)

### Deferred to Phase 2

- SMS blast channel for mass alerts
- Safety check-ins
- Voice-first mode / dictation
- Responder-to-responder team chat
- Shift scheduling calendar
- Offline map tile downloads
- After-action report generation
- Multilingual support (Filipino, Bikol)

### Deferred to Phase 3

- Integration with Philippine 911
- Wearable support
- Live video streaming
- AR navigation overlays
- Community features

---

## 12. Risks & Mitigations

| Risk                                       | Impact                             | Probability | Mitigation                                                                                                                                                 |
| ------------------------------------------ | ---------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firebase regional outage during disaster   | System offline when most needed    | Low         | Firestore multi-region, RTDB multi-region, offline mode for reads, callable queue for writes. Manual fallback procedures documented.                       |
| Surge overwhelms Firestore quotas          | Reports lost during peak           | Medium      | All writes through Cloud Functions with backpressure. Rate limiting per device/phone/IP. RTDB for high-frequency location data. Cost monitoring alerts.    |
| Low citizen adoption                       | Platform underused, reports sparse | High        | Anonymous-first design. Integration with existing MDRRMO workflows. Community training sessions.                                                           |
| Responder device loss/theft                | Unauthorized platform access       | Medium      | Agency admin "Revoke Access" kills session. 8-hour timeout. No cached PII on responder devices (PII is in `report_private`, which responders cannot read). |
| Data privacy breach                        | Legal liability under RA 10173     | Low         | Triptych model. PII export logging. MFA for admin tiers. Anonymous reports masked at write time by Cloud Function.                                         |
| Callable function cold starts during surge | Slow report submission             | Medium      | Minimum instances configured for `submitReport` function. Optimistic UI shows "submitted" before server confirms.                                          |
| Triptych partial write failure             | Orphan documents                   | Very Low    | Firestore transaction in Cloud Function ensures atomicity. Scheduled cleanup function detects and repairs orphans daily.                                   |

---

## 13. Decision Log

| #   | Decision                                                               | Rationale                                                                                         | Alternatives Considered                                                                                              |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Single PWA for all roles                                               | One codebase, no app store delays, universal access                                               | Native apps (rejected: dual maintenance), separate web apps per role (rejected: shared components)                   |
| 2   | Report triptych (3 collections)                                        | Firestore can't do field-level security rules                                                     | Single collection with field masking (rejected: not enforceable), sub-collections only (rejected: query limitations) |
| 3   | Server-authoritative writes via callable functions                     | Prevents DDoS, ensures atomicity, enables rate limiting at the gate                               | Client-side Firestore writes (rejected: security rules can't enforce rate limits or atomicity across 3 collections)  |
| 4   | Zustand + TanStack Query (listener-fed)                                | Clean UI/server state separation. Listeners feed cache — no polling double-reads.                 | Redux Toolkit (rejected: boilerplate), React Context (rejected: re-render storms)                                    |
| 5   | Leaflet over Google Maps                                               | Open source, free, offline tile support, lightweight                                              | Google Maps (rejected: cost at scale, offline limitations), Mapbox (rejected: pricing)                               |
| 6   | RTDB for responder location, Firestore for everything else             | RTDB is bandwidth-priced — 7x cheaper for high-frequency GPS writes                               | Firestore only (rejected: per-operation pricing explodes at 30s intervals × 20 responders × 12 admin listeners)      |
| 7   | Cloud Tasks for dispatch timers                                        | Reliable, exactly-once execution for time-critical escalation                                     | setTimeout in Functions (rejected: instance dies), Firestore TTL (rejected: no callback)                             |
| 8   | Firebase Auth custom claims                                            | Propagate role + jurisdiction to security rules without extra reads                               | Firestore user document check in rules (rejected: extra read per operation)                                          |
| 9   | `dispatches` collection as source of truth (not array on `report_ops`) | Single source of truth, avoids dual-update sync bugs, supports complex dispatch lifecycle queries | `dispatchedTo[]` array on `report_ops` (rejected: Finding #11 — dual representation causes sync bugs)                |
| 10  | Agency admin as separate role (not sub-type of municipal admin)        | Fundamentally different permission model (vertical vs. horizontal authority)                      | Agency as property of municipal admin (rejected: breaks dispatch isolation)                                          |

---

## Appendix A: Opposition Review Findings Cross-Reference

| Finding # | Severity | Section Fixed    | Summary                                                                     |
| --------- | -------- | ---------------- | --------------------------------------------------------------------------- |
| 1         | Critical | §3.1, §3.3, §5.1 | Triptych writes routed through transactional Cloud Function                 |
| 2         | Critical | §3.3             | `allow create: if false` on reports; callable function is sole entry point  |
| 3         | Critical | §3.3             | Explicit write rules for `report_ops` and `dispatches`                      |
| 4         | High     | §4.3             | Single offline mechanism per write type; no double-queuing                  |
| 5         | High     | §4.2, §7.4       | TanStack Query wraps listeners, no polling                                  |
| 6         | High     | §2.3, §4.4, §5.4 | RTDB for GPS, Firestore for profiles                                        |
| 7         | High     | §3.5             | Explicit composite index plan in `firestore.indexes.json`                   |
| 8         | Medium   | §7.3             | Renamed from "event sourcing" to "audit log"                                |
| 9         | Medium   | §3.2             | Added `visibility.sharedWith[]` to `report_ops`                             |
| 10        | Medium   | §3.4, §7.1       | Repositories framed as testing seams, not portability                       |
| 11        | Medium   | §3.2, §3.3       | `dispatches` is source of truth; `dispatchedTo[]` removed from `report_ops` |
| 12        | Low      | §4.5             | Layered error boundaries at root, role, and panel levels                    |
| 13        | Low      | §10.3            | Service worker update strategy defined                                      |
| 14        | Low      | §10.2            | Three environments: dev, staging, prod                                      |

---

**End of Architecture Specification v2.0**
