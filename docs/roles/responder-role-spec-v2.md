# Responder Role — Complete Specification

**Bantayog Alert — Disaster Reporting Platform**
**Province of Camarines Norte, Philippines**
**Version:** 2.0
**Supersedes:** Responder Role Spec v1.1 (2026-04-10)
**Aligned to:** Architecture Spec v6.0 (2026-04-16)
**Surface:** Responder Capacitor App (React 18 + Capacitor, iOS + Android)

---

## Change Summary (v1.1 → v2.0)

| # | What Changed | Why |
|---|---|---|
| 1 | Dispatch timeout is data-driven, not hardcoded | Arch §2.5: `acknowledgementDeadlineAt` set per-dispatch based on severity. High: 3 min, Medium: 5 min, Low: 10 min. Agency can override defaults. |
| 2 | GPS retention changed from 24h to 90 days | Arch §2.4 / §7.2: post-incident review requires 90 days. Privacy notice must state this explicitly. |
| 3 | GPS cadence is motion-driven, not flat 30s | Arch §2.4 / §8.2: hardware motion-activity driven. 10s moving, 30s walking, geofence+5min ping when still. Flat 30s burns battery in 3–4 hours. |
| 4 | Dispatch state machine updated | Arch §7.2: `pending → acknowledged → en_route → on_scene → resolved`. Aligned to actual Firestore state labels. |
| 5 | No Facebook Messenger integration | Arch §2.10 / §7.2: rejected — RA 10173 data residency, no SLA, no audit, unreliable in degraded networks. |
| 6 | Verified Responder Report added | Arch §2.9: `submitResponderWitnessedReport` callable. Accelerated intake (skips `draft_inbox`), not a verification bypass. Rate-limited 10/24h. |
| 7 | Location opt-out behavior clarified | Arch §7.2: opting out during active dispatch moves responder to `unavailable`. Admin must have telemetry on live dispatches. |
| 8 | Re-auth interval is 12h, handled at app layer | Arch §2.10 / §7.2: session timeout means prompt-for-OTP, not hard token expiry. |
| 9 | No responder-to-responder direct messaging | Arch §7.2: all comms through admin or command channel. Explicit architectural choice. |
| 10 | Dispatch accept is server-authoritative | Arch §7.2: `acceptDispatch` callable resolves simultaneous-accept races server-side. |
| 11 | Unable-to-complete workflow added | Arch §7.2: `markDispatchUnableToComplete` callable — no penalty, triggers reassignment, admin-reviewable. |
| 12 | Shift handoff added | Arch §7.6: `initiateResponderHandoff` callable with active incident snapshot. |

---

## Table of Contents

1. [Role Overview](#1-role-overview)
2. [Permissions & Access](#2-permissions--access)
3. [Interface Design](#3-interface-design)
4. [Core Features](#4-core-features)
5. [Dispatch Workflow](#5-dispatch-workflow)
6. [On-Duty Management](#6-on-duty-management)
7. [Communication Tools](#7-communication-tools)
8. [Verified Responder Report](#8-verified-responder-report)
9. [Shift Handoff](#9-shift-handoff)
10. [Performance & History](#10-performance--history)
11. [Technical Specifications](#11-technical-specifications)

---

## 1. Role Overview

### Who Are Responders?

Responders are the "boots on the ground" — emergency personnel who receive dispatches from admins and respond to incidents in the field. They execute rather than decide.

They are **managed staff accounts**, created and managed by Agency Admins. They cannot self-register.

### Responder Types (Specializations)

| Type | Code | Role | Examples |
|------|------|------|----------|
| Police | POL | Law enforcement, crowd control | MDRRMO police unit, PNP |
| Fire | FIR | Fire suppression, rescue | Local fire station, BFP |
| Medical | MED | First aid, ambulance | Rural health unit, ambulance |
| Engineering | ENG | Road clearance, structural damage | Municipal engineering, DPWH |
| Search & Rescue | SAR | Missing persons, evacuation | Coast Guard, volunteer SAR |
| Social Welfare | SW | Evacuation centers, relief | DSWD field team, MSWDO |
| General | GEN | Multi-purpose response | MDRRMO general response team |

Individual responders may have additional specialization tags (e.g., "Swift Water Rescue", "Hazmat Certified") set by their Agency Admin in the roster.

### Primary Responsibilities

- Receive and respond to dispatches (opt-in acceptance)
- Navigate to incident location safely
- Assess situation upon arrival
- Update incident status through the workflow
- Document field observations with notes and photos
- Request backup or resources when needed
- Mark dispatches as resolved when work is complete
- Report field-witnessed incidents when on patrol

### What Responders Do NOT Do

- ❌ Verify reports (LGU admin triage function — Arch §2.1)
- ❌ Classify incident type or severity (admin decision)
- ❌ Dispatch themselves or others (admin coordination)
- ❌ See citizen contact info (privacy)
- ❌ See reports not assigned to them (privacy + focus)
- ❌ Access analytics (admin/superadmin tool)
- ❌ Promote users (admin-only)
- ❌ Delete or edit reports (data integrity)
- ❌ Use Facebook Messenger for incident comms (Arch §7.2)

---

## 2. Permissions & Access

### 2.1 What Responders CAN Do

| Action | Details |
|--------|---------|
| Receive dispatch notifications | FCM high-priority |
| Accept dispatches | Via `acceptDispatch` callable (server-authoritative, race-safe) |
| Decline dispatches | Direct write with mandatory reason |
| View incident details | Full details of assigned incidents only |
| Navigate to incident | Map + [Navigate] button (opens native maps app) |
| Update dispatch status | `acknowledged → en_route → on_scene → resolved` (direct writes) |
| Quick status toggles | One-tap updates; same transitions, faster UX |
| Add field notes | Direct write to `reports/{id}/field_notes/{noteId}`, rule validates assignment |
| Upload field photos | Signed URL via `requestUploadUrl` callable |
| Message admin | Via `reports/{id}/messages` subcollection |
| Call admin | One-tap `tel:` intent (opens phone dialer; no in-app calling) |
| Activate SOS | `triggerSOS` callable — FCM + SMS to all admins in municipality/agency |
| Request backup | `requestBackup` callable → routes to assigned municipal admin |
| Request provincial escalation | `requestProvincialEscalation` callable → routes to superadmin |
| Mark unable to complete | `markDispatchUnableToComplete` callable — no penalty, triggers reassignment |
| Set availability | `available / unavailable / off_duty` — direct write with required reason |
| View own performance metrics | Via TanStack Query callable |
| Shift handoff | `initiateResponderHandoff` callable |
| File Verified Responder Report | `submitResponderWitnessedReport` callable (§8) |
| View other responders on same incident | Name and status only (not location) |

### 2.2 What Responders CANNOT Do

| Action | Why |
|--------|-----|
| Verify reports | Admin triage function (Arch §2.1) |
| Classify incidents | Admin decision |
| Dispatch responders | Admin coordination role |
| See unassigned reports | Privacy + focus |
| View reports in other municipalities | Jurisdiction boundary |
| Access analytics | Admin/superadmin tool |
| View citizen contact info | RA 10173 privacy |
| Message other responders directly | No responder-to-responder messaging (Arch §7.2); comms through admin |
| Use Facebook Messenger for incident comms | Rejected (Arch §7.2) |

### 2.3 Data Visibility Matrix

| Data Type | Visibility |
|-----------|------------|
| Own active dispatch details | ✅ Full |
| Unassigned reports | ❌ Hidden |
| Reports in other municipalities | ❌ Hidden (except active mutual aid) |
| Citizen contact info | ❌ Hidden |
| Admin messages (own dispatch) | ✅ Visible |
| Admin identity | ✅ Name + role (responders need to know who to call back — Arch §2.7) |
| Other responders on same incident | ✅ Name and status only |
| Other responders' own dispatches | ❌ Hidden |
| Own performance metrics | ✅ Visible |
| Analytics (municipal, agency) | ❌ Hidden |

---

## 3. Interface Design

### 3.1 Mobile-First Layout (4 Tabs)

```
┌─────────────────────────────────────────┐
│  Bantayog Alert  🆘  🔔  📍  👤        │  ← SOS always visible top-right
├─────────────────────────────────────────┤
│                                         │
│           [CONTENT AREA]                │
│                                         │
├─────────────────────────────────────────┤
│  📋 Dispatches │ 🗺️ Map │ 💬 Messages  │
│  👤 Profile                             │
└─────────────────────────────────────────┘
```

**SOS button:** Red, prominent, always visible in top bar. Requires 3-second hold to prevent accidental activation. Cancellable within 30 seconds.

### 3.2 Tab 1: Dispatches (Default Home Screen)

```
┌─────────────────────────────────────────┐
│  Your Dispatches                        │
│  🔴 New (2)  🟡 Active (1)  🟢 Done    │
├─────────────────────────────────────────┤
│  🚨 NEW DISPATCH                        │
│     Flood — High Severity               │
│     Barangay San Jose, Daet             │
│     Accept by: 14:38 (3 min remaining) │  ← Data-driven deadline
│     From: Admin Santos, Daet MDRRMO    │
│                                         │
│     [Accept] [Decline]                  │
├─────────────────────────────────────────┤
│  🟡 ACTIVE DISPATCH                     │
│     Fire — High Severity               │
│     Poblacion, Vinzons                 │
│     Status: On Scene                   │
│     [View Details]                     │
└─────────────────────────────────────────┘
```

**Acceptance deadline display:** The remaining acceptance window is shown as a countdown (`Accept by: 14:38 — 3 min remaining`). The deadline is set by severity: High = 3 min, Medium = 5 min, Low = 10 min, per `system_config/dispatch_timeouts/{severity}`. Agency-configured overrides apply.

**Reminder notification:** Fires at 60% of the deadline window (e.g., at 1m 48s remaining for a 3-minute High severity window).

**Quick Status Toggles (active dispatches):**
```
┌─────────────────────────────────────────┐
│  Quick Updates:                         │
│  [📍 En Route] [🔧 On Scene] [✅ Done]  │
│  [🆘 Request Backup] [📞 Call Admin]   │
└─────────────────────────────────────────┘
```

**Empty State:**
```
✓ All Clear!
No active dispatches.
Stay ready — new dispatches will appear here.
[View Past Dispatches] [Set Status: Available]
```

### 3.3 Tab 2: Map

**Purpose:** Navigate to incident; see own assigned dispatches.

```
┌─────────────────────────────────────────┐
│  🗺️ Operational Map                    │
│  • Blue dot — Your location             │
│  • Red pins — Your assigned incidents   │
│  [Navigate] → opens native maps app     │
│                                         │
│  ☑ Show route to incident               │
│  ☐ Show traffic                         │
└─────────────────────────────────────────┘
```

Own location is shared only during active dispatch (`acknowledged → en_route → on_scene`). No tracking outside those states.

### 3.4 Tab 3: Messages

**Purpose:** Two-way communication with assigned admin. Per-incident threads.

```
┌─────────────────────────────────────────┐
│  Incident #0471 — Flood · Daet          │
│                                         │
│  Admin Santos (Daet MDRRMO) · 14:30    │
│  "Do you need boat team? Water rising." │
│                                         │
│  You · 14:32                            │
│  "Yes, boat team needed. Waist-deep."   │
│                                         │
│  Admin Santos · 14:35                   │
│  "Boat team dispatched. ETA 15 min."    │
│                                         │
│  [Type a message...]  [📷] [📞 Call]    │
└─────────────────────────────────────────┘
```

Messages are per-incident (not per-contact). They become part of the permanent incident audit record.

**No direct responder-to-responder messaging.** If backup arrives on the same incident, coordination happens through the admin or face-to-face at scene.

### 3.5 Tab 4: Profile

**4a. Your Info:**
```
👤 Officer Juan Dela Cruz
🚒 Type: Fire Responder · Hazmat Certified
📍 Station: Daet Fire Station
📱 0917 123 4567
[Edit Profile]
```

**4b. Availability Status:**
```
🟢 Status: AVAILABLE for dispatch
[Set Unavailable] [Go Off-Duty]
```
Status changes require a reason. Setting `unavailable` or `off_duty` while on an active dispatch is blocked.

**4c. Your Statistics:** See §10.

**4d. Settings:**
```
🔔 Notifications
  ☑ Push notifications
  ☑ Sound for new dispatches
  ☑ Vibration for urgent

📍 Location
  ☑ Share location (active dispatch only)
  [Opt-out moves you to Unavailable]

📶 Data & Storage
  ☑ Offline mode
  Storage used: 45 MB · [Clear cache]

🚪 Log Out
```

**Location opt-out disclosure:** "Turning off location sharing will set your status to Unavailable. You will not receive new dispatches until you re-enable it."

---

## 4. Core Features

### 4.1 SOS Emergency Button

**Activation:** Hold for 3 seconds (prevents accidental trigger).

**On activation:** `triggerSOS` callable fires:
- FCM to all admins in responder's municipality and agency
- SMS to same admins
- Entry written to `breakglass_events`-equivalent audit log
- Never silently fails (retries if network absent; logs retry state)

**SOS screen:**
```
┌─────────────────────────────────────────┐
│  🆘 SOS ACTIVATED                       │
│                                         │
│  Emergency signal sent to all admins.  │
│  Location: Barangay San Jose, Daet      │
│  Incident: #0471 (Flood)               │
│                                         │
│  Stay safe. Help is coming.             │
│                                         │
│  [Cancel SOS] ← Available 30 sec only  │
└─────────────────────────────────────────┘
```

**Admin receives:** Urgent push + map highlight + one-tap call + one-tap dispatch backup.

**Use cases:** Responder injured or trapped, equipment failure, scene too dangerous, immediate backup needed.

### 4.2 Opt-In Dispatch Acceptance

Responders are not forced into dispatches. Every dispatch requires acceptance.

**Dispatch notification contains:**
- Incident type and severity
- Location and approximate distance
- Admin notes
- Acceptance deadline (data-driven per §3.2)

**Accepting:** Calls `acceptDispatch` callable (server-authoritative). If two responders attempt to accept simultaneously, the server resolves the race — one succeeds, one receives "Dispatch already accepted."

**Declining:** Direct write with mandatory reason:
```
Decline Reason:
○ Already on another assignment
○ Unable to respond — not available
○ Too far away
○ Not my specialization
○ Vehicle / equipment issue
○ Safety concern (hazardous conditions)
○ Other (specify)
[Confirm Decline]
```

Declining has no penalty. Chronic patterns (admin-configurable threshold) are flagged for Agency Admin review.

**Timeout:** If the acceptance deadline passes without response, `dispatchTimeoutSweep` CF sets dispatch to `timed_out`. Admin is notified for redispatch.

---

## 5. Dispatch Workflow

### 5.1 Status State Machine

```
[Admin creates dispatch]
         ↓
       pending
         ↓  (responder accepts — acceptDispatch callable)
    acknowledged
         ↓  (responder departs — direct write)
      en_route
         ↓  (responder arrives — direct write)
      on_scene
         ↓  (responder completes — direct write)
      resolved
```

Alternative paths:
- `pending → timed_out` (deadline elapsed — CF sweep)
- `pending → cancelled` (admin cancels — cancelDispatch callable)
- Any active state → `unable_to_complete` (responder — markDispatchUnableToComplete callable)

### 5.2 Acknowledged (Departing)

```
Status: Acknowledged — En Route
Estimated arrival: [15 min] (editable)
Notes (optional): "Leaving station now..."
[Add Photo] [Update Status → En Route]
```

GPS location sharing begins when status is `acknowledged`.

### 5.3 En Route

Status is updated automatically as responder moves. Admins see live location on map. No required form — responder is focused on driving.

### 5.4 On Scene

```
Situation update (required):
"On scene. Water is waist-deep. 3 houses affected..."
[Attach Photo — recommended]
[Request Backup] [Update to On Scene]
```

### 5.5 Resolved

```
Resolution summary (required):
"2 people evacuated. Water receding. Road is passable."
What was done? [Free text or checklist]
[Attach Final Photo — recommended]
[Mark Resolved]
```

After resolution, admin closes the report (`closeReport` callable). Responder's dispatch is now `resolved`.

### 5.6 Unable to Complete

```
Reason (required):
○ Safety — scene conditions changed
○ Medical — responder health issue
○ Equipment failure
○ Jurisdiction conflict
○ Other (specify)
[Submit — No Penalty]
```

`markDispatchUnableToComplete` callable logs the reason, notifies admin for reassignment. No disciplinary flag is created automatically.

### 5.7 Requesting Backup

```
Resource needed:
Type: [Police / Fire / Medical / Engineering / SAR / Other ▼]
Number of units: [  ]
Notes: "Need boat team at bridge crossing..."
[Send Request to Admin]
```

`requestBackup` callable routes to the assigned municipal admin. Admin decides on dispatch or agency assistance request.

---

## 6. On-Duty Management

### 6.1 Availability Status

| Status | Color | Meaning | Required Reason |
|--------|-------|---------|----------------|
| Available | 🟢 | Ready for dispatch | — |
| Unavailable | 🟡 | Temporarily unable | Yes |
| Off-Duty | 🔴 | Not working this shift | Yes |

**Unavailable reasons:** On break, In meeting, On another call, Other.

**Off-duty reasons:** Shift ended, Sick leave, Training, Day off, Other.

**Blocking rule:** Cannot set `off_duty` or `unavailable` while a dispatch is `en_route` or `on_scene`. Must complete or mark unable-to-complete first.

### 6.2 GPS Location Sharing

GPS is **only active during assigned dispatch** (`acknowledged → en_route → on_scene`). It stops when dispatch is `resolved`, `cancelled`, or `unable_to_complete`.

**Motion-driven sampling cadence (Arch §8.2):**

| Hardware activity | GPS polling |
|-------------------|-------------|
| Running / In vehicle | Every 10s ± 2s |
| Walking | Every 30s ± 5s |
| Still + on active dispatch | Geofence-only + 5 min ping |
| Still + low battery (< 20%) | Geofence-only + 10 min ping |
| No active dispatch | No tracking |

**Why motion-driven?** A flat 30s cadence drains battery in 3–4 hours on a 12-hour shift. Hardware motion detection preserves battery while keeping location responsive when needed.

**Retention:** 90 days (required for post-incident review). This is stated in the privacy notice.

**Freshness indicators visible to admin:**

| Status | Definition |
|--------|------------|
| Live | Within 2× expected interval |
| Degraded | Within 4× expected interval |
| Stale | Beyond 4× expected interval |
| Offline | No update for 5+ min on active dispatch |

### 6.3 Pre-Arrival Information

When a dispatch is accepted, the responder sees a pre-arrival summary:
- Incident type, severity, and admin notes
- Citizen's initial description and photos (if any)
- Recommended equipment checklist (based on incident type)
- Distance and navigation option

---

## 7. Communication Tools

### 7.1 Admin Messaging

Per-incident two-way messaging via `reports/{id}/messages` subcollection. Messages are grouped by incident, timestamped, and part of the permanent record.

Can attach photos to messages. Offline queue: messages send when reconnected.

### 7.2 One-Tap Call Admin

Opens native phone dialer with admin's number. Auto-logs: "Called admin at [time]" in the incident thread. Works on any signal (voice call, not data).

**This is the primary urgent communication path for field responders.** In-app messaging is for documentation; calling is for urgency.

### 7.3 No Facebook Messenger Integration

Facebook Messenger integration is **permanently excluded** (Arch §7.2) due to:
- RA 10173 data residency concerns (data leaves PH infrastructure)
- No SLA during emergencies
- No audit hook for incident records
- Unreliable in degraded network conditions that affect emergency periods

Responders use in-app messages + PSTN calls. If a responder references "I'll message you on Messenger," admin should redirect to in-app channel.

---

## 8. Verified Responder Report

When a responder witnesses an incident while on patrol (before it has been reported), they can create a field report via `submitResponderWitnessedReport`.

**This is accelerated intake, not a verification bypass.** The report goes directly to `new` state (skipping `draft_inbox`) with elevated triage priority, but still requires Municipal Admin verification (`awaiting_verify → verified`). The responder does not have verification authority.

### 8.1 Entry Point

"Report What I'm Seeing" button — available in dispatches tab when no active dispatch, or in profile menu.

### 8.2 Form

```
┌─────────────────────────────────────────┐
│  🚨 Report What I'm Seeing              │
│                                         │
│  Incident type: [Select ▼]              │
│  Suggested severity: [Select ▼]         │
│  Location: [Auto-captured — required]  │
│  Photo: [Take Photo — required]         │
│  Description: [                       ] │
│                                         │
│  [Submit Field Report]                  │
└─────────────────────────────────────────┘
```

**GPS and photo are both required** for a Verified Responder Report (this guarantees `hasPhotoAndGPS: true`, enabling fast admin verification).

### 8.3 What Happens After Submission

1. `submitResponderWitnessedReport` callable writes `reports/{id}` directly at state `new` with:
   - `source: 'responder_witness'`
   - `witnessPriorityFlag: true` (appears at top of municipal admin queue)
2. FCM fires to: the municipal admin of the geo-resolved municipality AND the responder's own agency admin.
3. Municipal admin sees a "Responder-Witnessed" badge on the report. Still must execute verification — but the presence of required GPS and photo makes this fast.
4. Full audit log records the bypass of `draft_inbox` and the responder's identity.

**Responder is notified:** "Your field report was submitted. Reference: [ref]. The local MDRRMO admin has been notified and will verify shortly."

**Rate limit:** Max 10 witness reports per responder per 24 hours. If limit is reached: "You've submitted the maximum field reports for today. If this is an emergency, call your admin directly."

---

## 9. Shift Handoff

Responders use `initiateResponderHandoff` callable to pass context to the incoming shift.

### 9.1 Handoff Form

```
Handoff to: [Select incoming responder ▼]
Active dispatches: [auto-populated]
Urgent notes: "Patient at Brgy. San Jose still needs follow-up..."
General notes: "Truck fuel topped up. Radio channel 5 is static."
[Submit Handoff]
```

Incoming responder receives FCM + in-app notification. Must accept via `acceptShiftHandoff`. If unaccepted in 30 minutes, agency admin is notified.

### 9.2 Handoff Record

Immutable after acceptance. Retained for 2 years as operational record.

---

## 10. Performance & History

### 10.1 Statistics (Profile Tab)

```
📊 Your Performance (This Month)
Dispatches received:     23
Dispatches accepted:     21
Dispatches declined:     2
Incidents resolved:      19
Unable to complete:      2

Average response time:   18 minutes
Average resolution time: 2.3 hours
Completion rate:         90%
```

Available via TanStack Query callable. Read-only — no editing. Shared with Agency Admin.

### 10.2 Dispatch History

Full list of past dispatches (all states). Tap any → full incident timeline, field notes, photos submitted, messages with admin.

---

## 11. Technical Specifications

### 11.1 Platform

**Surface:** Capacitor wrapper over React PWA — native iOS and Android apps.

**Why Capacitor:**
- Background location via native Capacitor plugin (not available in PWA)
- Foreground service for persistent dispatch notifications
- Hardware motion activity detection (for GPS cadence)
- Native push notifications (FCM high-priority)

### 11.2 State Ownership (Arch §9.3)

| Data Category | Authority |
|---|---|
| Server documents (dispatches, reports, messages) | Firestore SDK |
| UI state | Zustand |
| Non-Firestore callables | TanStack Query |
| Foreground service status | Capacitor Preferences |
| Last known motion activity | Capacitor Preferences + in-memory |
| GPS telemetry | Write-only to RTDB; no local persistence |

**No offline write outbox.** Responder writes are single-actor sequential transitions on dispatches the responder owns. Firestore SDK handles reconnection correctly for this pattern.

### 11.3 Auth (Arch §7.2)

- Phone OTP + TOTP (mandatory MFA for staff)
- 12-hour re-auth interval (prompt-for-OTP at app layer; Firebase ID token 1h is separate)
- Cannot self-register — Agency Admin creates responder accounts

### 11.4 GPS Write Path

Location written to RTDB: `responder_locations/{uid}` only while on active dispatch.

Record: `{ capturedAt, receivedAt (server), lat, lng, accuracy, batteryPct, motionState, appVersion, telemetryStatus }`

Retained 90 days. Off-duty: zero telemetry written.

### 11.5 Offline Behavior

Firestore SDK cache supports offline reads. No outbox layer — responder writes (dispatch state transitions) are sequential and single-actor, SDK reconnect handles replay correctly.

Background location continues via Capacitor foreground service even when app is not in foreground. Battery optimization settings on the device can interfere; setup guide provided during onboarding.

### 11.6 Accessibility

- Touch targets ≥ 44×44px
- High contrast mode supported
- Voice-over / TalkBack compatible for profile and history tabs
- Dispatch acceptance flow is optimized for single-hand operation (all primary actions reachable from thumb zone)

---

## Document Version

**Version:** 2.0
**Date:** 2026-04-16
**Status:** Aligned to Architecture Spec v6.0
**Next Review:** After Phase 4 (Responder Capacitor App) implementation
