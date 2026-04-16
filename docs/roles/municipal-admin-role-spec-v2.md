# Municipal Admin Role — Complete Specification

**Bantayog Alert — Disaster Reporting Platform**
**Province of Camarines Norte, Philippines**
**Version:** 2.0
**Supersedes:** Municipal Admin Role Spec (2026-04-10)
**Aligned to:** Architecture Spec v6.0 (2026-04-16)
**Surface:** Admin Desktop PWA (desktop-first, Chrome/Edge)

---

## Change Summary (v1.0 → v2.0)

| # | What Changed | Why |
|---|---|---|
| 1 | `trustScore` and "Auto-Verify" removed | Arch §2.2: RA 10173 profiling exposure. Replaced by factual indicators: `hasPhotoAndGPS`, `source`, `reporterType` (registered / pseudonymous / sms). |
| 2 | Admin identity model corrected | Arch §2.7: admin names are hidden from citizens and public feed at the **data layer** (CF projection strips `actorId`). Citizens see "Daet MDRRMO". Responders on the same incident see admin's display name + role. |
| 3 | Mass alert routing enforced | Arch §2.6 / §7.3: a **Reach Plan preview** is shown before send. If SMS recipients > 5,000 OR multi-municipality, the UI routes the request as an NDRRMC Escalation, not a direct send. |
| 4 | Agency assistance replaced old "agency request" flow | Arch §6.6 / §7.3: `requestAgencyAssistance` callable creates a first-class `agency_assistance_requests` document. Agencies accept/decline formally; all logged. |
| 5 | Dispatch timeout is data-driven | Arch §2.5: `acknowledgementDeadlineAt` per-dispatch (High: 3 min, Medium: 5 min, Low: 10 min). Admin-configurable agency overrides. |
| 6 | No "Incident Commander" tag | Arch §2.8: removed. Dispatch ownership is defined by the state machine. Conflicts resolved via Command Channel messaging. |
| 7 | Command Channel is a first-class feature | Arch §7.3.4: per-incident inter-admin messaging (`command_channel_threads/{threadId}`). Created automatically when: report is shared, agency assistance requested, provincial escalation requested. |
| 8 | Border incident sharing formalized | Arch §7.3.3: `shareReportWithMunicipality` callable. CF auto-shares when geo-intersection detects border proximity (500m). Attribution logged. |
| 9 | Shift handoff added | Arch §7.6: `initiateShiftHandoff` / `acceptShiftHandoff` callables. 30-min acceptance window; superadmin notified on timeout. |
| 10 | Responder-Witnessed badge added to triage queue | Arch §2.9: reports from `submitResponderWitnessedReport` appear with `witnessPriorityFlag: true` at top of queue, with "Responder-Witnessed" badge. |
| 11 | Cross-municipality constraint clarified | Arch §7.3: cannot view or write outside own municipality EXCEPT explicit border-share. |
| 12 | Re-auth is 8h at app layer | Arch §7.3 (implied from v5): 8-hour re-auth prompt. Firebase ID token is 1h regardless; "session timeout" means prompt-for-OTP at app level. |
| 13 | Offline mutations blocked | Arch §9.4: Admin Desktop has no outbox. All mutations require connectivity. UI blocks high-stakes writes when disconnected. |

---

## Table of Contents

1. [Role Overview](#1-role-overview)
2. [Permissions & Access](#2-permissions--access)
3. [Interface Design](#3-interface-design)
4. [Core Features](#4-core-features)
5. [Workflows](#5-workflows)
6. [Mass Alerts](#6-mass-alerts)
7. [Shift Handoff](#7-shift-handoff)
8. [Analytics & Reporting](#8-analytics--reporting)
9. [Edge Cases & Solutions](#9-edge-cases--solutions)
10. [Technical Specifications](#10-technical-specifications)

---

## 1. Role Overview

**Scope:** One municipality. The Municipal Admin is the operational commander for their municipality — they triage citizen reports, verify incidents, dispatch responders, and coordinate with agencies. They do not have authority outside their municipality except for explicitly shared border incidents.

**Work environment:** Desktop primary (Admin Desktop PWA, desktop-first). Dual-monitor support recommended.

**Key principle:** Map is the operational backbone. All actions happen on or alongside the map. No full-screen modals that block it.

---

## 2. Permissions & Access

### 2.1 What Municipal Admins CAN Do

| Action | Scope | Callable / Write |
|--------|-------|-----------------|
| View all reports | Own municipality | Firestore listener |
| Verify reports | Own municipality | `verifyReport` callable |
| Reject reports | Own municipality | `rejectReport` callable |
| Merge duplicate reports | Own municipality | `mergeReports` callable |
| Dispatch own municipality's responders | Own municipality | `dispatchResponder` callable |
| Request agency assistance | Any agency | `requestAgencyAssistance` callable |
| Cancel dispatches | Own dispatches + superadmin | `cancelDispatch` callable |
| Redispatch after decline/timeout | Own municipality | `redispatchReport` callable |
| Communicate with citizens | Own municipality | `addMessage` callable |
| Command Channel messaging | Shared incidents | `postCommandChannelMessage` callable |
| Send municipality-scoped mass alerts | Own municipality (≤5,000 SMS) | `sendMassAlert` callable |
| Escalate to NDRRMC | Multi-municipality or >5,000 | `requestMassAlertEscalation` callable |
| View responder real-time telemetry | Own municipality | RTDB direct read (rule-scoped) |
| View other-agency responders on incidents | Own municipality, ghosted | Agency projection (§8.5 arch) |
| Close resolved incidents | Own municipality | `closeReport` callable |
| Reopen closed incidents | Own municipality | `reopenReport` callable |
| Share border incidents | Adjacent municipalities | `shareReportWithMunicipality` callable |
| View municipality analytics | Own municipality | TanStack Query callable |
| Shift handoff | Own municipality | `initiateShiftHandoff` callable |
| Classify/reclassify incident type | Own municipality | `verifyReport` / callable |

### 2.2 What Municipal Admins CANNOT Do

| Action | Why |
|--------|-----|
| View / write outside own municipality | Jurisdiction boundary (except shared border incidents) |
| Dispatch outside own municipality | Responders have `permittedMunicipalityIds` |
| See other municipalities' analytics | Privacy + jurisdiction (anonymized comparison OK) |
| Promote users or change roles | Superadmin only |
| Delete verified reports | Data integrity |
| Modify original citizen report text | Preserve original data |
| Bypass responder opt-in | Responders must accept |
| Verify responder-witnessed reports without tap | Auto-verify is permanently removed (Arch §2.2) |

### 2.3 Data Visibility Matrix

| Data Type | Visibility |
|-----------|------------|
| All reports in own municipality | ✅ Full details |
| Reports outside own municipality | ❌ Hidden (except shared border incidents) |
| Border incidents (shared) | ✅ With "Shared Incident" badge; cannot change verification status |
| Citizen contact info (`report_contacts`) | ✅ Visible (for follow-up) |
| Citizen identity | ✅ `reporterType` label: registered / pseudonymous / sms. No score. |
| Admin identity (own view) | ✅ Own name |
| Admin identity (citizen-facing) | ❌ Data-layer stripped — citizens see institution only |
| Admin identity (responder-facing) | ✅ Name + role surfaced to responders on same incident |
| Responder status | ✅ Own municipality (full telemetry) |
| Responder location | ✅ Real-time during active dispatch |
| Other-agency responders on own incidents | ✅ Ghosted (30s sample, 100m precision) |
| Analytics | ✅ Own municipality + anonymized provincial comparison |

---

## 3. Interface Design

### 3.1 Critical Design Principles

1. **Map is permanent background.** Never fully obscured by modals.
2. **Panels slide in — they don't pop over the map.** Panel slides in from the right; map remains visible and interactive.
3. **Quick actions always visible** in the top edge bar.
4. **Connectivity is required.** When offline, mutations are blocked with a clear indicator. "You must be online to verify, reject, or dispatch." (Arch §9.4)
5. **No "Incident Commander" tag.** Dispatch ownership is clear from the state machine. Conflict resolution is via Command Channel.

### 3.2 Primary Layout (1920×1080 Desktop)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Bantayog Alert — MUNICIPAL ADMIN (DAET)          🔔 Alerts: 3  👤 Admin Santos│
├──────────────────────────────────────────────────────────────────────────────┤
│ [TOP EDGE BAR]                                                                │
│ 📋 Pending: 8  |  🚒 Available Responders: 5  |  ⚠️ Urgent: 2  |  🆘 Alert  │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │  [MUNICIPAL MAP — ALWAYS VISIBLE]                                        │ │
│ │                                                                          │ │
│ │  📍 Municipal Boundary: DAET                                             │ │
│ │  🔴 High Severity Incidents (3)                                          │ │
│ │  🟡 Medium Severity Incidents (7)                                        │ │
│ │  🟢 Low Severity Incidents (12)                                          │ │
│ │  🔵 Responder Locations (real-time)                                      │ │
│ │  ⚡ Responder-Witnessed reports (elevated)                               │ │
│ │                                                                          │ │
│ │  [MAP OVERLAYS — Top Left Toggle]                                        │ │
│ │  ☑ Active incidents only  ☑ Available responders                         │ │
│ │  ☑ Border incidents (shared)  ☑ Heatmap (24h)                           │ │
│ │                                                                          │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

Clicking any incident pin → triage panel slides in from the right. Map remains interactive behind it.

### 3.3 Triage Panel (Panel A — Report Triage)

```
┌────────────────────────────────────────┐
│ Report #0471 — Flood                   │
│ Barangay San Jose · 14 min ago         │
│                                        │
│ Reporter: Pseudonymous                 │  ← reporterType, not score
│ Has Photo + GPS: ✅                    │  ← hasPhotoAndGPS indicator
│ Source: Citizen App                    │  ← source field
│                                        │
│ ⚡ RESPONDER-WITNESSED                 │  ← witnessPriorityFlag badge
│ By: Officer Cruz, BFP Daet            │  ← visible; responder is credentialed
│                                        │
│ Description: "Water is rising fast..." │
│ [📷 View Photos (2)]                   │
│                                        │
│ Classify as:                           │
│ Type: [Flood ▼]   Severity: [High ▼]  │
│                                        │
│ [✅ Verify] [❌ Reject] [🔀 Merge]     │
│ [💬 Message Citizen] [📋 Add Note]    │
└────────────────────────────────────────┘
```

**Note on trust indicators:** There is no trust score. Admins see factual indicators only: `reporterType` (registered / pseudonymous / sms), `hasPhotoAndGPS` (boolean), and `source` (citizen_app / citizen_sms / responder_witness / admin_entry). The "Responder-Witnessed" badge is a triage priority signal — the admin still taps [Verify].

### 3.4 Dispatch Panel (Panel B)

```
┌────────────────────────────────────────┐
│ Dispatch for Incident #0471 — Flood    │
│ ✅ Verified by Admin Santos, 14:02     │
│                                        │
│ Available Responders (Own Municipality)│
│ ☑ Officer Cruz — Fire (Available)     │
│ ☑ Officer Reyes — SAR (Available)     │
│ ○ Officer Perez — Medical (On Scene)  │
│                                        │
│ Acceptance deadline:                   │
│ Severity-based [High: 3 min ▼]        │
│                                        │
│ Notes for responder:                   │
│ [                                    ] │
│                                        │
│ [Dispatch Selected]                    │
│                                        │
│ — OR —                                 │
│ [Request Agency Assistance]            │
└────────────────────────────────────────┘
```

**Acceptance deadline:** Set per-dispatch based on severity. Defaults from `system_config/dispatch_timeouts/{severity}` (High: 3 min, Medium: 5 min, Low: 10 min). Admin can see the agency's configured override if different.

### 3.5 Agency Assistance Panel

```
┌────────────────────────────────────────┐
│ Request Agency Assistance              │
│ Incident: #0471 — Flood (Verified)     │
│                                        │
│ Select Agency: [BFP Daet ▼]           │
│ Request Type: [Fire / Rescue ▼]       │
│ Priority: ○ Urgent  ○ Normal           │
│                                        │
│ Message to Agency:                     │
│ "Fire spreading to adjacent building. │
│  Need 2 trucks."                       │
│                                        │
│ Expires in: 30 min if no response      │
│                                        │
│ [Send Request]                         │
└────────────────────────────────────────┘
```

Creates `agency_assistance_requests/{id}`. Agency admin receives FCM + command-channel thread. If no response in 30 minutes, request auto-expires and municipal admin is notified.

### 3.6 Surge Triage Mode

Activated via toggle in the top bar. Switches the triage panel to a scannable list view instead of map-click-to-open.

```
┌────────────────────────────────────────┐
│ 🔥 SURGE MODE ON — Queue View         │
├────────────────────────────────────────┤
│ 🔴 #0473 · Flood · High · 2 min ago  │
│    ⚡ Responder-Witnessed · GPS + Photo│  ← elevated row
│    [V] [R] [M] [S]                    │  ← keyboard: V=Verify R=Reject M=Merge S=Skip
├────────────────────────────────────────┤
│ 🟡 #0471 · Flood · Med · 8 min ago   │
│    Pseudonymous · GPS + Photo          │
│    [V] [R] [M] [S]                    │
├────────────────────────────────────────┤
│ 🟢 #0469 · Fallen Tree · Low         │
│    Registered · No GPS                 │
│    [V] [R] [M] [S]                    │
└────────────────────────────────────────┘
```

**Keyboard shortcuts in Surge Mode:** `V` = Verify, `R` = Reject, `M` = Merge with selected, `S` = Skip.

**Capacity:** 100 reports rendered; older reports paginated. Bulk operations use per-report callables (no short-circuiting rule checks).

---

## 4. Core Features

### 4.1 Verify / Reject / Merge

**Verify:** `verifyReport` callable. Sets `reportType`, `severity`. Transitions `awaiting_verify → verified`. Fires FCM + SMS to reporter using institutional attribution ("Your report has been verified by Daet MDRRMO").

**Reject:** `rejectReport` callable. Transitions `awaiting_verify → cancelled_false_report`. Logs moderation incident. Optional message to citizen explaining rejection.

**Merge:** `mergeReports` callable. Sets `mergedInto` on duplicate. Updates duplicate cluster. Original report is preserved; duplicate is marked with attribution.

**No auto-verify.** All verification requires explicit admin action. The "TRUST SCORE" and "Auto-Verify?" controls from v1.0 are permanently removed (Arch §2.2).

### 4.2 Dispatch Management

- Create dispatch → `dispatchResponder` callable
- Cancel dispatch → `cancelDispatch` callable (with mandatory reason)
- Redispatch after timeout/decline → `redispatchReport` callable (creates new dispatch, marks old as `superseded`)
- Close incident → `closeReport` callable (transitions `resolved → closed`)
- Reopen incident → `reopenReport` callable (transitions `closed → assigned` with audit)

### 4.3 Command Channel

Per-incident inter-admin messaging. A thread is automatically created when:
- A report is shared with an adjacent municipality
- An agency assistance request is sent
- A provincial escalation is requested

Participants: all admins with operational stake. Accessible from the incident panel. All messages audit-streamed.

```
┌────────────────────────────────────────┐
│ 💬 Command Channel — Incident #0471   │
│                                        │
│ Admin Santos (Daet MDRRMO) · 14:10    │
│ "Requesting BFP support. 2 trucks."    │
│                                        │
│ Admin Cruz (BFP Daet) · 14:12         │
│ "Team Alpha en route. ETA 8 min."     │
│                                        │
│ [Type message...]         [Send]       │
└────────────────────────────────────────┘
```

### 4.4 Citizen Communication

`addMessage` callable writes to `reports/{id}/messages` subcollection. Message is visible to the citizen in their report tracking view.

Use cases: requesting clarification ("Can you confirm the street name?"), providing updates ("A responder has been dispatched to your location."), resolution notice.

### 4.5 Border Incident Sharing

Adjacent municipalities can see shared incidents with a "Shared Incident" badge. They can dispatch their own responders; they cannot change the originating municipality's verification status.

Sharing is triggered automatically when geo-intersection detects the report is within 500m of a municipal border (CF-managed), or manually via `shareReportWithMunicipality` callable.

---

## 5. Workflows

### 5.1 Standard Triage-to-Resolution

```
Citizen submits report
      ↓
[Admin sees in triage queue — awaiting_verify]
      ↓
Admin reviews: type, severity, hasPhotoAndGPS, source, reporterType
      ↓ [Verify]
[verified state] → FCM + SMS to citizen (institutional attribution)
      ↓
Admin dispatches own responder OR requests agency assistance
      ↓
Responder accepts → en_route → on_scene → resolved
      ↓
[Admin closes — closeReport callable]
[closed state]
```

### 5.2 Agency Assistance Workflow

```
[Admin verifies incident]
      ↓
Admin clicks [Request Agency Assistance]
  Selects: agency, type, priority, message
  Creates: agency_assistance_requests/{id}
      ↓
Agency Admin receives FCM + command-channel notification
  Reviews verified incident details
  Clicks [Dispatch Team Alpha] OR [Decline]
      ↓ (if accepted)
Municipal Admin dashboard: "BFP Daet dispatched Team Alpha (ETA 8 min)"
Admin can watch via ghosted agency responder dots on map
      ↓
Responder resolves → Agency marks resolved
Admin closes incident
```

### 5.3 Redispatch Workflow

```
Dispatch sent → responder declines (or timeout)
      ↓
Admin notified: "Officer Cruz declined — Vehicle issue"
      ↓
Admin clicks [Redispatch]
  Selects new responder or agency
  New dispatch created; old marked as superseded
```

---

## 6. Mass Alerts

### 6.1 Reach Plan Preview

Before every mass alert send, the admin sees a **Reach Plan** — a server-computed estimate of which channels the message will actually use and how many recipients it will reach.

```
┌────────────────────────────────────────┐
│ 📢 Mass Alert — Reach Plan Preview    │
│                                        │
│ Target: Daet Municipality              │
│                                        │
│ Estimated recipients:                  │
│ • In-app push (FCM): ~4,200            │
│ • SMS via Semaphore: ~1,800            │
│ Total estimated: ~6,000                │
│                                        │
│ ⚠️ SMS recipients exceed 5,000 limit.  │
│ This will be submitted as an           │
│ NDRRMC Escalation Request.             │
│                                        │
│ [Edit Alert] [Submit Escalation]       │
└────────────────────────────────────────┘
```

`massAlertReachPlanPreview` callable computes the estimate server-side before admin confirms.

### 6.2 Routing Rules

| Condition | Route |
|-----------|-------|
| Single municipality + SMS ≤ 5,000 | Direct send: FCM + Semaphore priority queue |
| SMS > 5,000 OR multi-municipality | NDRRMC Escalation Request → Provincial Superadmin review |

**The UI clearly labels which route will be used before the admin confirms.** There is no silent routing.

### 6.3 Alert Composer

```
┌────────────────────────────────────────┐
│ Create Mass Alert                      │
│                                        │
│ Alert type:                            │
│ ○ 🔴 Evacuation Warning               │
│ ○ 🟡 Weather Warning                  │
│ ○ 🟢 Advisory / Informational         │
│                                        │
│ Message:                               │
│ [                                    ] │
│ [160 chars max for SMS compatibility]  │
│                                        │
│ Target area:                           │
│ ○ All of Daet municipality            │
│ ○ Specific barangays [select]         │
│                                        │
│ [Preview Reach Plan] → then [Send]    │
└────────────────────────────────────────┘
```

### 6.4 NDRRMC Escalation Request

When routing requires NDRRMC:
1. `requestMassAlertEscalation` callable creates `mass_alert_requests/{id}` with draft message, target area, hazard class, and linked evidence (report IDs, PAGASA reference).
2. FCM + priority SMS to Provincial Superadmin.
3. Superadmin reviews and forwards to NDRRMC (Arch §7.5.1).
4. Municipal admin is notified: "Escalation submitted. Awaiting PDRRMO review."

**Important:** The UI always distinguishes "Escalation submitted to NDRRMC" from "Sent via our SMS layer." Bantayog does not claim to have issued an ECBS alert.

---

## 7. Shift Handoff

### 7.1 Initiating a Handoff

At end of shift, admin initiates via [Shift Handoff] in the top bar:

```
┌────────────────────────────────────────┐
│ Shift Handoff                          │
│                                        │
│ Handoff to: [Select incoming admin ▼] │
│                                        │
│ Active incidents (auto-populated):     │
│ • #0471 — Flood — Dispatched (45 min) │
│ • #0469 — Tree — Awaiting Verify      │
│                                        │
│ Urgent items:                          │
│ [BFP request pending for #0471       ] │
│                                        │
│ Pending requests:                      │
│ [Agency assistance request, expires   │
│  in 8 min]                            │
│                                        │
│ General notes:                         │
│ [BFP Team Alpha is on scene. PAGASA  ] │
│ [Signal 2 expected in 3 hours.       ] │
│                                        │
│ [Submit Handoff]                       │
└────────────────────────────────────────┘
```

### 7.2 Acceptance

Incoming admin receives FCM + in-app notification. Accepts via `acceptShiftHandoff`. Must accept within 30 minutes — if not, Provincial Superadmin is notified.

Handoff document is immutable after acceptance. Any modifications create a new handoff doc (append-only audit).

### 7.3 Record

Retained 2 years. Visible to both admins involved and Provincial Superadmin.

---

## 8. Analytics & Reporting

**Municipal Admin sees own municipality only.** Anonymized provincial comparisons are available ("Your response time vs. provincial average") without revealing other municipalities' raw data.

### 8.1 Available Metrics

- Total reports submitted, verified, rejected, merged (daily, weekly, monthly)
- Average time from `new` to `verified`
- Average time from `verified` to `dispatched`
- Average time from `dispatched` to `resolved`
- Responder acceptance rate, average response time, completion rate
- Incident breakdown by type and severity
- Unresolved incident aging (incidents open > 24h, > 48h)

### 8.2 Dashboard View

```
┌────────────────────────────────────────┐
│ 📊 Daet Municipality — Last 7 Days    │
│                                        │
│ Reports: 34  Verified: 28  Resolved: 25│
│ Avg verify time: 6 min                 │
│ Avg response time: 14 min              │
│                                        │
│ vs. Provincial Average:                │
│ Verify time: 6 min vs. ~9 min avg ✅   │
│ Response time: 14 min vs. ~12 min ⚠️  │
│                                        │
│ Open >24h: 3 incidents [View]          │
└────────────────────────────────────────┘
```

---

## 9. Edge Cases & Solutions

| Scenario | Solution |
|---|---|
| Two admins try to verify same report simultaneously | `verifyReport` is a callable; server-authoritative. One succeeds, one receives "Already verified." |
| Agency declines request — no units available | Agency sends `declineAgencyAssistance` with reason. Municipal admin is notified immediately. Admin can request a different agency or escalate to superadmin. |
| Dispatch timeout — no responder accepted | `dispatchTimeoutSweep` CF marks `timed_out`. Admin notified for redispatch. |
| Responder goes SOS during active dispatch | Admin receives urgent FCM + red map highlight. One-tap to call responder, one-tap to dispatch backup. |
| Connectivity lost on Admin Desktop | All mutations blocked. Yellow "Offline" banner shown. Read-only map and feed continue from Firestore cache. |
| Border incident — adjacent municipality also has a responder nearby | Admin of originating municipality can share incident. Both admins can dispatch their own responders. Only originating admin can verify/close. |
| Citizen requests correction on verified report | Citizen submits correction request from tracking view. Admin sees in triage queue with "Correction Requested" badge. Admin approves or rejects correction. |
| Mass alert estimate is wrong | `massAlertReachPlanPreview` is an estimate. Actual recipient count may differ by up to ±10% (§18 acceptance criteria). Admin is told this is an estimate. |

---

## 10. Technical Specifications

### 10.1 Platform

**Surface:** Admin Desktop PWA (React 18 + Vite)
- Desktop-first: 1920×1080 primary
- Chrome 90+ / Edge 90+ (desktop)
- No Capacitor wrapper — browser-based only

### 10.2 State Ownership (Arch §9.4)

| Data Category | Authority |
|---|---|
| Server documents (reports, dispatches, responders, analytics) | Firestore SDK |
| UI state (map viewport, selected entity, panel, filters) | Zustand |
| Callables and analytics aggregates | TanStack Query |
| **Offline mutations** | **Blocked** — no outbox, no queued writes |

**No outbox.** Admin mutations are high-stakes (verification, dispatch, cancellation). Silent replay of a queued mutation after reconnect is worse than blocking. The UI clearly shows when the admin is offline and prevents mutations until connectivity is restored.

### 10.3 Auth

- Managed staff account (created by Superadmin)
- Phone OTP + TOTP (MFA mandatory)
- 8-hour re-auth interval (app-layer OTP prompt; Firebase ID token 1h is separate)

### 10.4 Map Rendering

- Leaflet + OSM tiles
- Full-density map with clustering
- Per-role overlays: verified incidents, responder markers, border incidents, heatmap
- Real-time responder markers from RTDB (own municipality, full fidelity)
- Agency responders on own incidents: ghosted dots from 30s-sampled 100m-grid projection
- No tile caching assumed (always online)

### 10.5 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Verify selected report (Surge Mode) |
| `R` | Reject selected report (Surge Mode) |
| `M` | Merge with selected (Surge Mode) |
| `S` | Skip to next report (Surge Mode) |
| `Escape` | Close active panel |
| `D` | Dispatch panel for selected incident |
| `A` | Open alert composer |

---

## Document Version

**Version:** 2.0
**Date:** 2026-04-16
**Status:** Aligned to Architecture Spec v6.0
**Next Review:** After Phase 5 (Municipal Admin Desktop) implementation
