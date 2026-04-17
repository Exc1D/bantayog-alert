# Agency Admin Role — Complete Specification

**Bantayog Alert — Disaster Reporting Platform**
**Province of Camarines Norte, Philippines**
**Version:** 2.0
**Supersedes:** Agency Admin Role Spec (original + UPDATED Changes amendment, 2026-04-10)
**Aligned to:** Architecture Spec v6.0 (2026-04-16)
**Surface:** Admin Desktop PWA (desktop-first, Chrome/Edge)

---

## Change Summary (v1.0 + Amendment → v2.0)

This spec absorbs both the original Agency Admin spec and its "UPDATED Changes" amendment. The amendment's direction — stripping verification authority from agencies, instituting the hub-and-spoke model — is the canonical v6 behavior. The original spec's "Self-Dispatch" and "Verify" features are removed.

| #   | What Changed                                              | Why                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Agency Admins do NOT verify reports                       | Arch §2.1: verification belongs solely to Municipal Admins and Provincial Superadmin. Single-actor verification keeps the state machine clean and matches PH LGU doctrine.                                                                        |
| 2   | Agency Admins do NOT see pending/unverified reports       | Arch §7.4: only verified incidents are visible to agencies. Reduces noise; agencies see actionable items only.                                                                                                                                    |
| 3   | "Self-Dispatch (Agency First)" workflow removed           | Arch §7.4.1: rejected because it required agency verification (§2.1). Replaced by Hub-and-Spoke model.                                                                                                                                            |
| 4   | "Incident Commander" tag removed                          | Arch §2.8: removed platform-wide. No agency admin has special override authority. Conflicts via Command Channel.                                                                                                                                  |
| 5   | Agency assistance is a first-class document               | Arch §6.6: `agency_assistance_requests/{id}` with full lifecycle (pending → accepted → fulfilled / declined / expired).                                                                                                                           |
| 6   | GPS cadence corrected                                     | Arch §2.4: own-agency responders read from RTDB at full fidelity. Other-agency responders rendered from 30s-sampled 100m-grid projection (Arch §8.5), not 5s. "5s own / 30s other" display is the map refresh rate, not the device emission rate. |
| 7   | Location data GPS precision clarified                     | Arch §8.5: other-agency responder locations are precision-reduced to 100m grid for privacy. Own agency: full precision.                                                                                                                           |
| 8   | Dispatch timeout is data-driven                           | Arch §2.5: `acknowledgementDeadlineAt` per-dispatch (High: 3 min, Medium: 5 min, Low: 10 min). Agency can configure their own defaults via `agencies/{agencyId}.dispatchDefaults`.                                                                |
| 9   | No mass alerts to citizens                                | Arch §7.4: agency admins have no mass alert capability. Operational messages to own responders only, via `reports/{id}/messages`.                                                                                                                 |
| 10  | "Reclassify incident" removed                             | Arch §7.4: agencies see verified incidents. Reclassification is a municipal admin / superadmin function.                                                                                                                                          |
| 11  | Cross-border mutual aid requires superadmin authorization | Arch §7.5: Provincial Superadmin must authorize the mutual-aid visibility toggle for cross-municipality agency response.                                                                                                                          |
| 12  | Command Channel added                                     | Arch §7.3.4 / §7.4: per-incident messaging with Municipal Admins. Created automatically when assistance is requested.                                                                                                                             |
| 13  | Shift handoff added                                       | Arch §7.6: `initiateShiftHandoff` / `acceptShiftHandoff` callables. Same mechanic as municipal admins.                                                                                                                                            |
| 14  | Re-auth is 8h at app layer                                | Arch §7.4: same as municipal admin. Firebase ID token is 1h regardless.                                                                                                                                                                           |
| 15  | Offline mutations blocked                                 | Arch §9.4: no outbox on Admin Desktop. Mutations require connectivity.                                                                                                                                                                            |

---

## Table of Contents

1. [Role Overview](#1-role-overview)
2. [Permissions & Access](#2-permissions--access)
3. [Interface Design](#3-interface-design)
4. [Core Features](#4-core-features)
5. [Workflows](#5-workflows)
6. [Analytics & Reporting](#6-analytics--reporting)
7. [Edge Cases & Solutions](#7-edge-cases--solutions)
8. [Technical Specifications](#8-technical-specifications)

---

## 1. Role Overview

### Who Are Agency Admins?

Agency Admins are dispatchers and operational managers for specific specialized response organizations — Bureau of Fire Protection (BFP), Philippine National Police (PNP), Philippine Coast Guard (PCG), Red Cross, DPWH, or local volunteer rescue groups.

**The key distinction from Municipal Admins:**

- Municipal Admins have **horizontal authority** over a geographic area (all incidents in a municipality).
- Agency Admins have **vertical authority** over their specific agency's resources (all responders in their agency, across municipalities if applicable).

**Work environment:** Office or station-based (e.g., Daet Fire Station dispatch desk). Desktop primary, dual-monitor recommended.

### What Agency Admins Are NOT

- They are **not** report verifiers. Verification is an LGU function.
- They are **not** commanders of other agencies.
- They are **not** mass alert senders.

Their job is: receive verified incidents via municipal request or direct notification, deploy their own people, track their own fleet, and coordinate with LGU admins via Command Channel.

---

## 2. Permissions & Access

### 2.1 What Agency Admins CAN Do

| Action                                | Scope                             | Callable / Write                                                   |
| ------------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| View verified incidents               | Agency's operational jurisdiction | Firestore listener (verified only)                                 |
| View agency assistance requests       | Own agency                        | Firestore listener on `agency_assistance_requests`                 |
| Accept agency assistance requests     | Own agency                        | `acceptAgencyAssistance` callable                                  |
| Decline agency assistance requests    | Own agency                        | `declineAgencyAssistance` callable                                 |
| Dispatch own agency's responders      | Own agency only                   | `dispatchResponder` callable with `agencyId` constraint            |
| View own responder status (full)      | Own agency                        | RTDB direct read from `responder_locations/{uid}`                  |
| View other-agency responders          | Active incidents, ghosted         | `agency_responder_projection` (30s sample, 100m precision)         |
| Manage agency roster                  | Own agency                        | `createResponder`, `updateResponder`, `suspendResponder` callables |
| Set shifts (bulk)                     | Own agency                        | `bulkSetResponderAvailability` callable                            |
| Tag responder specializations         | Own agency                        | Direct field update on `responders/{uid}.specializations[]`        |
| Revoke responder access (lost device) | Own agency                        | `revokeResponderAccess` callable                                   |
| Communicate with own responders       | Own agency, per incident          | `reports/{id}/messages` subcollection                              |
| Command Channel with Municipal Admins | Shared incidents                  | `postCommandChannelMessage` callable                               |
| View agency analytics                 | Own agency                        | TanStack Query callable                                            |
| Export monthly accomplishment report  | Own agency                        | Agency-specific PDF export                                         |
| Shift handoff                         | Own agency admin role             | `initiateShiftHandoff` callable                                    |

### 2.2 What Agency Admins CANNOT Do

| Action                                                      | Why                                                                     |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Verify reports                                              | Arch §2.1: LGU-only function. No verify button exists.                  |
| See pending / unverified reports                            | Arch §7.4: agencies only see actionable (verified) incidents            |
| Dispatch other agencies                                     | Chain of command — BFP cannot dispatch PNP                              |
| Manage other agencies' rosters                              | Organizational and security boundaries                                  |
| Send mass alerts to citizens                                | Municipal/Provincial exclusive (Arch §7.4)                              |
| Send operational messages to other agencies' responders     | Own agency only                                                         |
| Close incidents                                             | Close is municipal admin function; agency marks own dispatches resolved |
| Access system-wide analytics                                | Agency-scoped only                                                      |
| Delete verified reports                                     | Data integrity                                                          |
| Override dispatch ownership of another agency's responder   | Own agency responders only                                              |
| Cross-municipal operations without superadmin authorization | Mutual-aid visibility requires Provincial Superadmin toggle             |

### 2.3 Data Visibility Matrix

| Data Type                                   | Visibility                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| Pending / unverified reports                | ❌ Hidden (agencies see only verified incidents)                        |
| Verified incidents in own jurisdiction      | ✅ Full incident details                                                |
| Agency assistance requests for own agency   | ✅ Full (includes municipal admin's message)                            |
| Own agency responders                       | ✅ Full detail (real-time location, contact, status, workload, battery) |
| Other-agency responders on shared incidents | ✅ Ghosted — type + status + ~100m location only                        |
| Citizen contact info                        | ✅ Visible (for follow-up on assigned incidents only)                   |
| Citizen identity                            | ✅ `reporterType` label (registered / pseudonymous / sms); no score     |
| Admin identity of municipal admin           | ✅ Name + role in Command Channel                                       |
| Agency analytics                            | ✅ Own agency only                                                      |
| System-wide analytics                       | ❌ Hidden                                                               |
| Other agencies' analytics                   | ❌ Hidden                                                               |

---

## 3. Interface Design

### 3.1 Critical Design Principles

1. **Map is always visible.** Same principle as Municipal Admin — panels slide in, map stays.
2. **The Agency Admin's world is filtered.** Only verified incidents appear on their map and queue.
3. **The assistance inbox is the primary triage surface.** Not a raw report queue.
4. **No verify button anywhere.** It does not exist in this role's UI.
5. **Offline mutations blocked.** Connectivity required for dispatch, roster changes, accept/decline. (Arch §9.4)

### 3.2 Primary Layout (1920×1080 Desktop)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Bantayog Alert — BFP DAET STATION                    🔔 3  👤 Admin Cruz    │
├──────────────────────────────────────────────────────────────────────────────┤
│ [TOP EDGE BAR]                                                                │
│ 🚨 Verified Incidents: 8  |  ⚠️ MDRRMO Requests: 2  |  🚒 Available: 3     │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │  [OPERATIONAL MAP — ALWAYS VISIBLE]                                      │ │
│ │                                                                          │ │
│ │  📍 Jurisdiction Boundary                                                │ │
│ │  🔴 High Severity Incidents (verified only) (2)                          │ │
│ │  🟡 Medium Severity Incidents (verified only) (4)                        │ │
│ │  🚒 YOUR Responders (solid dots — full control)                          │ │
│ │  👻 OTHER Responders (ghosted dots — view only, ~100m precision)         │ │
│ │  📍 Active incidents (clickable)                                         │ │
│ │                                                                          │ │
│ │  [MAP OVERLAYS — Top Left]                                               │ │
│ │  ☑ Own responders only  ☑ Other agencies (ghosted)                      │ │
│ │  ☑ Active incidents only  ☑ Jurisdiction boundary                       │ │
│ │                                                                          │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Assistance Request Panel (Primary Inbox)

This is the most important panel for the Agency Admin — the hub of their triage.

```
┌────────────────────────────────────────┐
│ ⚠️ MDRRMO REQUEST — HIGH PRIORITY     │
│ Incident #0471 — Structural Fire       │
│ ✅ Verified by: Daet MDRRMO, 14:02     │
│                                        │
│ From: Admin Santos, Daet MDRRMO        │
│                                        │
│ Message:                               │
│ "Fire spreading to adjacent building.  │
│  Need 2 fire trucks urgently."         │
│                                        │
│ Expires in: 18 min                     │
│                                        │
│ [📷 View Incident Photos (2)]          │
│ [💬 Command Channel]                   │
│                                        │
│ [✅ Accept & Dispatch]  [❌ Decline]    │
└────────────────────────────────────────┘
```

There is no "Verify" button. The verification attribution is shown as context ("Verified by Daet MDRRMO"), not an action the agency can take.

### 3.4 Dispatch Panel

After accepting an assistance request:

```
┌────────────────────────────────────────┐
│ Dispatch — Incident #0471 (Fire)       │
│ Requested by: Daet MDRRMO              │
│                                        │
│ Your Available Teams:                  │
│ ☑ Team Alpha — Fire Truck 1 (Available)│
│ ☑ Team Bravo — Rescue 1 (Available)   │
│ ○ Officer Cruz — Off duty             │
│                                        │
│ Acceptance deadline:                   │
│ [High: 3 min] (agency default: 4 min) │
│                                        │
│ Notes for responder:                   │
│ [                                    ] │
│                                        │
│ [Dispatch Selected Teams]              │
└────────────────────────────────────────┘
```

Dispatches created after accepting an assistance request carry `requestedByMunicipalAdmin: true` and link to the `requestId` for full attribution.

### 3.5 Roster Management Panel

```
┌────────────────────────────────────────┐
│ 👥 Roster — BFP Daet Station          │
│ [+ Add Responder] [Bulk CSV Import]   │
│ [🔄 Bulk Set On-Duty] [Bulk Off-Duty] │
├────────────────────────────────────────┤
│ ON DUTY — 12 personnel                 │
│ ├─ 🚒 Team Alpha (Truck 1) · Available │
│ │    Lead: FO3 Santos                  │
│ │    [Edit] [Message] [Set Off-Duty]  │
│ ├─ 🚒 Team Bravo (Rescue 1) · Active  │
│ │    Lead: FO1 Reyes · Incident #0471 │
│ │    [View Dispatch] [Message]         │
├────────────────────────────────────────┤
│ OFF DUTY — 34 personnel                │
│ ├─ Officer Maria Cruz                  │
│ │    [Set Available] [Edit Details]    │
│ │    [Revoke Access]                   │
└────────────────────────────────────────┘
```

**Specialization tags** (e.g., "Swift Water Rescue", "Hazmat Certified") are displayed per responder and used as dispatch filters.

**Shift bulk toggle:** `[Bulk Set On-Duty]` and `[Bulk Off-Duty]` are one-click operations for shift changes (e.g., 0800H and 2000H). Uses `bulkSetResponderAvailability` callable.

**Lost device / Rogue access:** `[Revoke Access]` button immediately kills the session for that responder and flags cached offline data for wipe on next ping. Uses `revokeResponderAccess` callable.

### 3.6 Incident Detail View

```
┌────────────────────────────────────────┐
│ Incident #0471 — Structural Fire       │
│ ✅ VERIFIED BY: Daet MDRRMO, 14:02    │
│                                        │
│ Location: Poblacion, Daet              │
│ Severity: High (set by Municipal Admin)│
│                                        │
│ On Scene (Other Agencies):            │
│ • PNP Daet — 1 unit (ETA 5 min)      │  ← ghosted view
│ • MDRRMO Ambulance — En Route         │  ← ghosted view
│                                        │
│ Your Dispatched Units:                 │
│ • Team Alpha — On Scene               │
│                                        │
│ [💬 Command Channel with MDRRMO]      │
│ [📋 My Dispatches for this Incident]  │
└────────────────────────────────────────┘
```

The inter-agency visibility section ("On Scene — Other Agencies") shows other agencies' basic presence from the `agency_responder_projection` (Arch §8.5). Status is `en_route` or `on_scene` only; exact location is ~100m precision.

---

## 4. Core Features

### 4.1 Assistance Request Inbox

The primary workflow trigger for an Agency Admin is an assistance request from a Municipal Admin. These appear as high-priority notifications (FCM + top-edge bar counter).

**Request lifecycle:**

```
Municipal Admin sends request
      ↓ [agency_assistance_requests/{id} created, status: pending]
Agency Admin receives FCM + inbox notification
      ↓
Agency Admin reviews: incident details, message from muni admin
      ↓
[Accept] → acceptAgencyAssistance → status: accepted
[Decline] → declineAgencyAssistance → status: declined → muni admin notified
[Ignore beyond 30 min] → status: expired → muni admin notified
```

After accepting, the Agency Admin dispatches their own teams via the Dispatch Panel (§3.4). Dispatches are linked to the assistance request for attribution.

### 4.2 Roster Management

**Adding a responder:**

1. Agency Admin fills form: name, phone, specialization tags, team assignment
2. `createResponder` callable creates the account with a temporary password
3. Responder receives SMS with login instructions
4. Responder completes OTP verification and sets up TOTP

**Editing a responder:** `updateResponder` callable. Agency Admin can update specializations, team assignment, contact info.

**Suspending a responder:** `suspendResponder` callable. Sets `accountStatus: 'suspended'`. Responder cannot log in or receive dispatches.

**Revoking access (lost device):** `revokeResponderAccess` callable. Immediately invalidates the responder's Firebase session. Cached offline data flagged for wipe.

**Specialization tagging:** Individual tags (e.g., "Swift Water Rescue", "Hazmat Certified") stored in `responders/{uid}.specializations[]`. These appear as dispatch filters — when dispatching for a flood incident, Agency Admin can filter for responders with "Swift Water Rescue" tag.

### 4.3 Dispatch Management

Agency Admin can only dispatch own agency responders (`agencyId` constraint enforced at rule level).

**Direct dispatch flow** (for verified incidents without a formal assistance request, e.g., when Agency Admin sees a verified incident in their jurisdiction proactively):

1. Agency Admin clicks verified incident
2. Dispatch panel appears
3. Selects own responders, sets notes
4. `dispatchResponder` callable creates dispatch

**After-assistance-request dispatch flow:** Same panel, but the dispatch carries `requestedByMunicipalAdmin: true` and `requestId` linking back to the assistance request.

### 4.4 Command Channel

Per-incident inter-admin messaging. Created automatically when an assistance request is made.

Used for: resource negotiation, real-time status updates, coordination without phone calls, post-incident debrief notes.

All messages are audit-streamed.

### 4.5 Shift Handoff

Same mechanic as Municipal Admin (Arch §7.6):

1. `initiateShiftHandoff` callable — creates handoff doc with active dispatch snapshot, urgent items, general notes
2. Incoming Agency Admin receives FCM notification
3. Must accept within 30 minutes; superadmin notified on timeout

---

## 5. Workflows

### 5.1 Standard Hub-and-Spoke Workflow (Primary)

```
Citizen submits report → report_inbox
        ↓
Municipal Admin verifies → verified (Daet MDRRMO)
        ↓
Municipal Admin clicks [Request Agency Assistance]
  Selects: BFP Daet, type: Fire, priority: Urgent
  Message: "Fire spreading. Need 2 trucks."
        ↓ [agency_assistance_requests/{id} created]
Agency Admin (BFP) receives FCM notification
        ↓
Agency Admin opens assistance request:
  Sees: verified incident, muni admin's message, incident photos
  Clicks: [Accept & Dispatch]
  Selects: Team Alpha, Team Bravo
  `dispatchResponder` callable × 2
        ↓
Municipal Admin dashboard: "BFP Daet dispatched Team Alpha & Bravo (ETA 8 min)"
        ↓
Responders acknowledge → en_route → on_scene → resolved
Agency Admin monitors fleet on map
        ↓
Agency marks dispatches resolved
Municipal Admin closes incident
```

### 5.2 Decline Workflow

```
Agency Admin reviews assistance request
Agency has no available units
Clicks [Decline — No Resources]
  declineAgencyAssistance callable
  Decline reason: "No units available"
        ↓
Municipal Admin notified immediately:
  "BFP Daet declined — No units available"
  [Request Different Agency] button shown
```

### 5.3 Verified Responder Report Discovery

When an agency responder witnesses an incident on patrol (Arch §2.9):

1. Responder uses `submitResponderWitnessedReport` callable in their app
2. FCM fires to **both** the municipal admin AND the agency admin of that responder
3. Agency Admin sees: "Officer Cruz filed a field report — Incident #0480 (Fire, Poblacion)"
4. Agency Admin does NOT verify. Municipal Admin verifies. Agency Admin can prepare units for likely dispatch.

### 5.4 Cross-Municipality Mutual Aid

If an agency from Daet needs to support an incident in Talisay:

1. Provincial Superadmin must authorize the "Mutual Aid" visibility toggle (Arch §7.5)
2. After authorization: Agency Admin can see the Talisay incident map for the specific incident
3. Municipal Admin of Talisay creates the assistance request targeting the cross-municipality agency
4. Standard hub-and-spoke flow proceeds

---

## 6. Analytics & Reporting

Agency analytics are scoped to own agency only. No system-wide or cross-agency comparison.

### 6.1 Agency Performance Dashboard

```
┌────────────────────────────────────────┐
│ 📊 BFP DAET — Last 30 Days           │
├────────────────────────────────────────┤
│ Total Dispatches: 42                   │
│ Avg Response Time: 7m 30s ✅           │
│  (Target: < 10 min)                   │
│ Avg Time on Scene: 45 min             │
│ Personnel Hours: 1,260 hrs            │
│                                        │
│ By Incident Type:                      │
│ Structural Fire:   12                  │
│ Grass / Wildland Fire: 18             │
│ Vehicle Extrication: 5                 │
│ Assist to Other Agencies: 7           │
│                                        │
│ Assistance Requests:                   │
│   Received: 15  Accepted: 13          │
│   Declined: 2  (No units available)   │
│                                        │
│ [Export Monthly Report (PDF)]          │
└────────────────────────────────────────┘
```

**Available metrics:**

- Response time: average from "Assistance Request Received" to "Unit Dispatched"
- Personnel hours: total on-duty and on-scene
- Incident heatmap: where agency resources are most frequently deployed
- Dispatch acceptance rate and decline reasons
- Monthly accomplishment report (one-click PDF, formatted for internal agency bureaucratic requirements)

---

## 7. Edge Cases & Solutions

| Scenario                                                                     | Solution                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agency Admin receives request but has zero available units                   | Click [Decline — No Resources]. Municipal Admin is notified immediately and can request a different agency.                                                                                                  |
| Multiple Municipal Admins request the same agency simultaneously             | Both assistance requests appear in the inbox. Agency Admin accepts whichever they can serve and declines the other with reason.                                                                              |
| Assistance request expires before Agency Admin responds (30 min)             | Status auto-set to `expired`. Municipal Admin notified. Agency Admin sees expired request in history for awareness.                                                                                          |
| Own responder is in another municipality on mutual aid                       | The responder appears in the roster. Their location shows on the agency map. The cross-municipality incident is visible only if superadmin has authorized mutual-aid visibility for that specific situation. |
| Agency responder loses phone                                                 | [Revoke Access] in roster panel. Immediately kills session. Responder must contact Agency Admin to restore access via new account or session.                                                                |
| Responder files a Verified Responder Report on patrol                        | Agency Admin receives FCM notification. Does NOT verify (that's Municipal Admin's role). Can prepare units in anticipation.                                                                                  |
| Conflicting status between Municipal Admin and Agency Admin on same incident | Municipal Admin owns incident lifecycle (verify, classify, close). Agency Admin owns their dispatch resources. Conflicts resolved via Command Channel. No "Incident Commander" tag.                          |

---

## 8. Technical Specifications

### 8.1 Platform

**Surface:** Admin Desktop PWA (React 18 + Vite)

- Desktop-first: 1920×1080 primary; dual-monitor for large agencies
- Chrome 90+ / Edge 90+ (desktop)
- Tablet-responsive for mobile command post scenarios
- No Capacitor — browser-only

### 8.2 State Ownership (Arch §9.4)

| Data Category                                              | Authority               |
| ---------------------------------------------------------- | ----------------------- |
| Server documents (incidents, dispatches, roster, requests) | Firestore SDK           |
| UI state (map viewport, selected entity, panel, filters)   | Zustand                 |
| Callables and analytics                                    | TanStack Query          |
| **Offline mutations**                                      | **Blocked** — no outbox |

### 8.3 Auth

- Managed staff account (created by Provincial Superadmin or self-onboarding with superadmin approval)
- Phone OTP + TOTP (mandatory MFA)
- 8-hour re-auth interval (app-layer prompt)

### 8.4 Map & GPS

**Own agency responders:** Read from `responder_locations/{uid}` via RTDB at full fidelity.

**Other agency responders:** Read from `rtdb/agency_responder_projection/{agencyId}/{uid}` — a Cloud Function-maintained projection refreshed every 30 seconds, precision reduced to 100m grid. Payload: `{lat, lng, agencyId, status}` only (no battery, accuracy, or motion state — those are own-agency-only data).

**Freshness indicators for own responders (Arch §8.3):**

| Status   | Definition                          |
| -------- | ----------------------------------- |
| Live     | Within 2× expected GPS interval     |
| Degraded | Within 4× expected interval         |
| Stale    | Beyond 4× expected interval         |
| Offline  | No update 5+ min on active dispatch |

### 8.5 Security Rules (Key Agency Constraints)

```javascript
// Agency Admins can only read/write responders where agencyId matches
match /responders/{responderId} {
  allow read, write: if request.auth.token.role == 'agency_admin'
                     && resource.data.agencyId == request.auth.token.agencyId;
}

// Agency assistance requests — target agency only
match /agency_assistance_requests/{requestId} {
  allow read: if isAgencyAdmin()
              && resource.data.targetAgencyId == myAgency();
  allow write: if false; // Callable only
}

// Agency cannot read unverified reports
// reports/{id}: read allowed only if status != 'new' && status != 'awaiting_verify'
// (enforced by existing rule + agency role check)
```

### 8.6 Audit Logging

Every state change on incidents, dispatches, assistance requests, and roster items carries:

- `timestamp`
- `action` (e.g., "AcceptedAssistanceRequest", "DispatchedUnit", "UpdatedRoster")
- `actorId`
- `actorRole` (e.g., "agency_admin")
- `actorAgencyId`

All audit data is append-only to `audit_logs` and streamed to BigQuery for the Provincial Superadmin compliance view.

---

## Document Version

**Version:** 2.0
**Date:** 2026-04-16
**Status:** Aligned to Architecture Spec v6.0
**Next Review:** After Phase 6 (Agency Admin Desktop) implementation
