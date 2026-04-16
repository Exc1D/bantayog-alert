# Provincial Superadmin Role — Complete Specification

**Bantayog Alert — Disaster Reporting Platform**
**Province of Camarines Norte, Philippines**
**Version:** 2.0
**Supersedes:** Provincial Superadmin Role Spec v1.0 (2026-04-10)
**Aligned to:** Architecture Spec v6.0 (2026-04-16)
**Surface:** Admin Desktop PWA (desktop-first, dual-monitor, Chrome/Edge)

---

## Change Summary (v1.0 → v2.0)

| # | What Changed | Why |
|---|---|---|
| 1 | `trustScore` removed province-wide | Arch §2.2: removed for all roles. No trust score anywhere in the system. |
| 2 | NDRRMC escalation workflow formalized | Arch §7.5.1: Superadmin reviews `mass_alert_requests/{id}`, records forward method and NDRRMC receipt acknowledgment. UI distinguishes "Escalation submitted" from "SMS sent." |
| 3 | Re-auth is TOTP-mandatory, 4h interval | Arch §7.5: Superadmin has shorter re-auth interval than municipal/agency admins (4h vs 8h) due to higher privilege scope. TOTP is required (not just OTP). |
| 4 | `report_private` / `report_contacts` reads are audit-streamed | Arch §7.5: every superadmin read of private citizen data triggers an audit-log entry. Cannot be bypassed. |
| 5 | Cannot change own role | Arch §7.5: self-demotion prohibited. Another superadmin must do it. |
| 6 | Cannot disable audit streaming | Arch §7.5: hard constraint. |
| 7 | Break-glass review requirement | Arch §7.5: any break-glass session actions get independent review within 72h. |
| 8 | Shift handoff added (province-wide scope) | Arch §7.6: same mechanism as other admins, applied to province-wide context. |
| 9 | Mutual-aid authorization added | Arch §7.5: Superadmin toggles cross-municipality agency visibility for mutual aid events. |
| 10 | SMS audit and provider health dashboards | Arch §7.5: superadmin views `sms_outbox`, provider health (Semaphore / Globe Labs), and system-health dashboards. |
| 11 | Offline mutations blocked | Arch §9.4: same as all Admin Desktop surfaces. No outbox for mutations. |
| 12 | Surge pre-warm manual trigger | Arch §7.5: superadmin can manually trigger the surge pre-warm (normally automatic on PAGASA Signal-2+). |
| 13 | Data subject erasure approvals | Arch §7.5: superadmin approves RA 10173 data erasure requests. |
| 14 | BigQuery audit access | Arch §7.5: streaming + batch BigQuery access via separate IAM for compliance officers (separate from in-app audit log viewer). |

---

## Table of Contents

1. [Role Overview](#1-role-overview)
2. [Interface Design](#2-interface-design)
3. [Permissions & Access](#3-permissions--access)
4. [Core Features](#4-core-features)
5. [NDRRMC Escalation Workflow](#5-ndrrmc-escalation-workflow)
6. [User Management](#6-user-management)
7. [Emergency Declaration](#7-emergency-declaration)
8. [Audit & Compliance](#8-audit--compliance)
9. [System Operations](#9-system-operations)
10. [Shift Handoff](#10-shift-handoff)
11. [Edge Cases & Solutions](#11-edge-cases--solutions)
12. [Technical Specifications](#12-technical-specifications)

---

## 1. Role Overview

**Who They Are:** PDRRMO (Provincial Disaster Risk Reduction and Management Office) staff with province-wide authority over all 12 municipalities of Camarines Norte: Basud, Capalonga, Daet, Jose Panganiban, Labo, Mercedes, Paracale, San Lorenzo Ruiz, San Vicente, Santa Elena, Talisay, Vinzons.

**Scope:** Entire province — all municipalities, all agencies, all incident types.

**Work environment:** Office-based at PDRRMO operations center, Daet. Desktop primary with dual-monitor support (analytics dashboard on primary; provincial map on secondary).

**Key difference from Municipal Admins:** The Superadmin's primary view is **analytics-first**, not map-first. Province-wide situational awareness, trend analysis, and oversight are the primary function. Operational map is available on a second screen.

**Highest privilege in the system.** Every action is audit-logged. Private citizen data access is additionally audit-streamed. TOTP is mandatory, not optional.

---

## 2. Interface Design

### 2.1 Dual-Monitor Layout

**Screen 1 (Primary): Analytics Dashboard**
**Screen 2 (Optional): Provincial Map**

Both are parts of the same Admin Desktop PWA — panels can be toggled between screens via window management.

### 2.2 Screen 1: Analytics Dashboard (Primary)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏛️ PDRRMO Camarines Norte             [🔔 Alerts: 3]  [🚨 Declare Emergency] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PROVINCE-WIDE METRICS (real-time)                                          │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────────┬────────────┐  │
│  │ Active   │Responders│ Avg      │ Resolved │ Muni Issues  │ System     │  │
│  │Incidents │Available │ Response │  Today   │  (Flagged)   │ Health     │  │
│  │  47      │ 156/203  │ 12 min   │   89     │   0/12       │   🟢 OK    │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────────┴────────────┘  │
│                                                                             │
│  MUNICIPAL PERFORMANCE TABLE                                                │
│  ┌────────────┬──────────┬───────────┬─────────┬──────────┬────────────┐   │
│  │Municipality│Incidents │ Resp.Time │Resolved │ Resource │  Admin     │   │
│  │            │(Active)  │  (Avg)    │  Rate   │  Util.   │  Status    │   │
│  ├────────────┼──────────┼───────────┼─────────┼──────────┼────────────┤   │
│  │ Daet       │  12      │ 8 min ✅  │  83%    │  85%     │ 🟢 On Duty │   │
│  │ Labo       │   8      │ 15 min ⚠️ │  75%    │  72%     │ 🟢 On Duty │   │
│  │ Capalonga  │   3      │ 18 min ❌ │  67%    │  40%     │ ⚠️ No Shift│   │
│  │ …          │  …       │  …        │  …      │  …       │  …         │   │
│  └────────────┴──────────┴───────────┴─────────┴──────────┴────────────┘   │
│  Click any row → municipal drill-down panel slides in                       │
│                                                                             │
│  TREND ANALYSIS — Last 7 Days                                               │
│  [Incident volume — line chart]  [Response time — bar chart]                │
│  [Resource utilization — heatmap]  [Municipal comparison — radar]           │
│                                                                             │
│  QUICK ACTIONS                                                              │
│  [📊 Reports] [👥 Users] [⚙️ Settings] [📋 NDRRMC Queue] [🔒 Audit Logs]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Screen 2: Provincial Map (Secondary / Optional)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROVINCIAL MAP — All 12 Municipalities                                     │
│                                                                             │
│  • All verified incidents (color-coded by severity)                         │
│  • Municipal boundaries (labeled)                                           │
│  • Responder locations (all municipalities)                                 │
│  • Provincial resource locations                                            │
│  • Incident density heatmap                                                 │
│  • Click municipality → drill-down panel                                    │
│                                                                             │
│  [Map Overlays]                                                             │
│  ☑ All municipalities  ☑ Provincial resources                              │
│  ☑ Incident heatmap   ☑ Active incidents only                              │
│  ☑ Municipal boundaries  ☑ Responder locations                             │
│                                                                             │
│  Legend: 🔴 High  🟡 Medium  🟢 Low                                         │
│          🚒 Fire  🚓 Police  🏥 Medical  🚜 Engineering                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Design Principles

1. **Analytics-first.** Province-wide metrics and comparisons are the primary view, not the map.
2. **Drill-down capability.** Province → municipality → incident → responder. Every row is clickable.
3. **Real-time.** All metrics update via Firestore listeners. Data freshness label shown ("Updated 5s ago").
4. **Alert-driven.** Anomalies surface automatically (§4.3). Superadmin should not have to hunt for problems.
5. **Context panels slide in.** Click a municipality, incident, or user → panel slides in from right. Dashboard remains visible behind.
6. **Offline mutations blocked.** High-stakes mutations require connectivity. (Arch §9.4)

### 2.5 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `D` | Analytics dashboard (primary view) |
| `M` | Provincial map |
| `U` | User management |
| `A` | Declare emergency |
| `N` | NDRRMC escalation queue |
| `R` | Generate reports |
| `S` | System settings |
| `L` | Audit logs |
| `H` | System health monitoring |
| `Escape` | Close context panel |

---

## 3. Permissions & Access

### 3.1 What Provincial Superadmins CAN Do

| Action | Scope | Callable / Write |
|--------|-------|-----------------|
| All Municipal Admin capabilities | Province-wide | Same callables, no municipal restriction |
| Create / suspend / promote user accounts | All roles | `createUser` callable with role parameter |
| Declare provincial emergency | Province-wide | `declareEmergency` callable |
| Approve and forward NDRRMC escalation requests | Province-wide | `forwardMassAlertToNDRRMC` workflow |
| Toggle mutual-aid visibility for cross-municipality agency response | Per-incident | `toggleMutualAidVisibility` callable |
| Manage provincial resources | Province-wide | `provincial_resources/{id}` CRUD via callables |
| View all audit logs | Province-wide | In-app + BigQuery (separate IAM) |
| Set retention exemptions | Any record | `setRetentionExempt` callable (streams audit) |
| Approve data subject erasure requests | Any citizen | RA 10173 compliance |
| Trigger surge pre-warm manually | Province-wide | Manual trigger via System Health panel |
| Break-glass: access any Firestore collection | Emergency only | Logged in `breakglass_events` |
| Read `report_private` and `report_contacts` | Any report | Streaming audit on every read |
| View SMS audit, provider health | Province-wide | `sms_outbox`, `sms_provider_health` |
| View system health dashboards | Province-wide | System Health panel |
| Shift handoff | Province-wide role | `initiateShiftHandoff` callable |

### 3.2 What Provincial Superadmins CANNOT Do

| Action | Why |
|--------|-----|
| Change own role | Self-demotion prohibited (Arch §7.5) |
| Disable audit streaming | Hard constraint — cannot be turned off |
| Read citizen private data without audit trail | Every `report_private` / `report_contacts` read streams an audit entry |
| Claim to issue an ECBS alert (NDRRMC province-wide) | RA 10639: NDRRMC owns cell broadcast. Bantayog escalates only. |
| Skip TOTP on login | TOTP is mandatory for this role, cannot be bypassed |

### 3.3 Data Visibility

The Superadmin has the broadest data access in the system, with all accesses to private citizen data subject to audit trail. There are no hidden fields at the data layer — but there are audit consequences for every access.

---

## 4. Core Features

### 4.1 Real-Time Analytics Dashboard

Province-wide situational awareness, always visible.

**Anomaly detection alerts (auto-surfaced):**
```
⚠️ ANOMALY: Capalonga
• Response time up 40% (18 min vs. 12 min avg)
• Last 3 incidents all > 20 min response
• Possible: Responder shortage or surge
[Investigate] [Contact Municipal Admin]
```

Anomaly thresholds:
- Response time spike: > 20 min for 3+ incidents in same municipality
- Resolution rate drop: < 50% of active incidents resolved
- Resource over-utilization: > 90% deployed for extended period
- Zero activity: unusual for normally active municipality (pattern-based flag)
- Admin shift gap: no admin accepted shift handoff within 30 minutes

**Municipal Admin Status column:** Shows whether the on-duty admin has accepted a shift handoff or if there's a coverage gap.

### 4.2 Municipal Drill-Down

Click any municipality row → municipal context panel:
```
┌────────────────────────────────────────┐
│ Capalonga Municipality                 │
│ Admin: Santos (On Duty since 08:00)    │
│                                        │
│ Active Incidents: 3                    │
│ Available Responders: 9/15             │
│ Response Time (avg 7d): 18 min ❌      │
│                                        │
│ Unresolved > 24h: 1 incident [View]   │
│                                        │
│ [View All Incidents] [Contact Admin]   │
│ [View Responders] [Audit Log]          │
└────────────────────────────────────────┘
```

Drill further: click incident → full incident detail (same as municipal admin view).

### 4.3 Province-Wide Operational Control

As a superset of Municipal Admin, the Superadmin can:
- Verify reports in any municipality
- Dispatch responders in any municipality
- Close / reopen incidents in any municipality
- Send mass alerts for any municipality (subject to the same Reach Plan routing rules — Arch §2.6)
- Cancel dispatches province-wide
- Share reports between municipalities

All province-wide admin actions carry `actorRole: 'provincial_superadmin'` in audit.

### 4.4 Mutual Aid Authorization

When an agency needs to provide mutual aid across municipal lines:
1. Municipal Admin or Agency Admin flags the need (via escalation request or direct superadmin contact)
2. Superadmin reviews in the provincial map view
3. `toggleMutualAidVisibility` callable enables the cross-municipality visibility for that specific incident
4. Action is audit-logged with rationale field

---

## 5. NDRRMC Escalation Workflow

The Superadmin is the gatekeeper for all province-level mass alert escalations.

### 5.1 How Escalations Arrive

Municipal Admins who need to send mass alerts beyond 5,000 SMS recipients or beyond their municipality submit `requestMassAlertEscalation` callables. These create `mass_alert_requests/{id}` documents.

The Superadmin sees these in the **NDRRMC Escalation Queue** (`N` keyboard shortcut):

```
┌────────────────────────────────────────┐
│ 📋 NDRRMC Escalation Queue            │
├────────────────────────────────────────┤
│ ⚠️ HIGH — Request #EA-0012            │
│ From: Daet MDRRMO Admin Santos         │
│ Hazard: Typhoon Flooding               │
│ Target: All 12 municipalities          │
│ Status: Pending PDRRMO Review          │
│ Submitted: 14 min ago                  │
│ [Review & Forward] [Decline]           │
├────────────────────────────────────────┤
│ ⚠️ MEDIUM — Request #EA-0011          │
│ From: Labo MDRRMO Admin Cruz           │
│ Hazard: Flash Flood Warning            │
│ Target: Labo + Capalonga              │
│ Submitted: 2 hours ago                │
│ [Review & Forward] [Decline]           │
└────────────────────────────────────────┘
```

### 5.2 Review & Forward Flow

```
┌────────────────────────────────────────┐
│ Review Escalation #EA-0012            │
│                                        │
│ Message Draft:                         │
│ "Evacuate all riverside barangays.    │
│  Flash flood imminent."               │
│                                        │
│ Evidence Pack:                         │
│ • Linked reports: #0471, #0469        │
│ • PAGASA reference: TCWS-2026-04-16   │
│                                        │
│ Estimated Recipients: ~180,000         │
│                                        │
│ Forward to NDRRMC via:                 │
│ ○ Phone call (hotline)                │
│ ○ Email (official channel)            │
│ ○ Formal letter (document)            │
│                                        │
│ NDRRMC receipt confirmation:           │
│ Acknowledged by: [__________]          │
│ Timestamp: [auto]                      │
│                                        │
│ [Forward to NDRRMC] [Edit Draft] [Decline]│
└────────────────────────────────────────┘
```

### 5.3 After Forwarding

1. `mass_alert_requests/{id}.status` → `forwarded_to_ndrrmc`
2. Forward method and NDRRMC receipt are logged
3. Requesting Municipal Admin notified: "Escalation forwarded to NDRRMC. Reference #EA-0012. Awaiting NDRRMC decision."
4. The UI everywhere says "Escalation submitted to NDRRMC" — never "Alert sent province-wide."
5. When NDRRMC issues the actual ECBS alert, that is their action. Bantayog records the outcome but does not claim to have issued it.
6. Audit captures end-to-end latency: submission → PDRRMO review → NDRRMC receipt → ECBS dispatch (if any).

---

## 6. User Management

### 6.1 User Management Dashboard

```
┌────────────────────────────────────────┐
│ 👥 User Management                    │
│                                        │
│ Filter: [All Roles ▼] [All Muni ▼]   │
│ [+ Add User]                           │
├────────────────────────────────────────┤
│ 👤 Admin Santos  · Municipal Admin    │
│    Daet · Active · Last login 2h ago  │
│    [Edit] [Suspend] [View Audit]       │
├────────────────────────────────────────┤
│ 👤 Admin Cruz · Agency Admin · BFP    │
│    Daet · Active · Last login 6h ago  │
│    [Edit] [Suspend] [View Audit]       │
├────────────────────────────────────────┤
│ 👤 Officer Reyes · Responder · BFP   │
│    Daet · Active · On Dispatch        │
│    [Edit] [Suspend] [View Audit]       │
└────────────────────────────────────────┘
```

### 6.2 Creating a User

`createUser` callable with role parameter. Supported roles: `municipal_admin`, `agency_admin`, `responder`, `provincial_superadmin`.

For each role, required fields:
- `municipal_admin`: municipality, phone, display name
- `agency_admin`: agencyId, phone, display name
- `responder`: agencyId, phone, display name, specializations
- `provincial_superadmin`: phone, display name (TOTP required before account activates)

System sends SMS with temporary credentials. User must set TOTP before first login (enforced at account activation).

### 6.3 Suspending a User

`suspendUser` callable. Sets `accountStatus: 'suspended'`. User cannot log in. All active sessions immediately invalidated via claim revocation.

Suspension reason is required and logged to audit.

### 6.4 Self-Demotion Prohibition

A Superadmin cannot change their own role. A second superadmin (or a system admin) must do so. This is enforced at the callable level.

---

## 7. Emergency Declaration

### 7.1 Declare Provincial Emergency

`declareEmergency` callable creates `emergencies/{id}` with:
- Emergency type and severity
- Affected municipalities
- Declaration text
- Authorizing superadmin UID

**On declaration:**
- FCM + SMS to all active staff (municipal admins, agency admins, responders)
- FCM push to citizens with push enabled
- Emergency banner appears on Citizen PWA (all municipalities in scope)
- Provincial map shows emergency status overlay

### 7.2 Confirm Before Declaring

Declaration requires a 2-step confirmation:

```
┌────────────────────────────────────────┐
│ ⚠️ DECLARE PROVINCIAL EMERGENCY       │
│                                        │
│ Emergency type: [Select ▼]             │
│ Severity: ○ Warning  ○ Emergency       │
│ Affected municipalities: [Select all / │
│   specific municipalities ▼]           │
│                                        │
│ Declaration text:                      │
│ [                                    ] │
│                                        │
│ This will immediately alert all staff  │
│ and citizens in affected areas.        │
│                                        │
│ [Cancel] [Confirm Declaration]         │
└────────────────────────────────────────┘
```

After confirming: TOTP re-verification required (even within re-auth window) for this specific action.

---

## 8. Audit & Compliance

### 8.1 Audit Log Viewer (In-App)

```
┌────────────────────────────────────────┐
│ 🔒 Audit Log                          │
│ Filter: [Role ▼] [Action ▼] [Date ▼] │
├────────────────────────────────────────┤
│ 14:02 · Admin Santos (Daet MDRRMO)    │
│ Action: verifyReport #0471             │
│ Result: ✅ Success                     │
├────────────────────────────────────────┤
│ 14:05 · Provincial Superadmin [YOU]   │
│ Action: read report_private #0471     │  ← private data read — always logged
│ Result: ✅ Access granted              │
├────────────────────────────────────────┤
│ 14:10 · Admin Cruz (BFP Daet)         │
│ Action: dispatchResponder #0471       │
│ Result: ✅ Success                     │
└────────────────────────────────────────┘
```

**Streaming:** All security events and admin actions stream to BigQuery via a separate Cloud Function audit streaming path. The in-app viewer is a convenience overlay; the BigQuery record is the authoritative compliance log.

**BigQuery access:** Via separate IAM (compliance officers have direct BigQuery query access without going through the app).

### 8.2 Private Data Access Audit

Every time the Superadmin reads `report_private/{id}` or `report_contacts/{id}`:
1. An audit entry is written to `audit_logs` with: `actorId`, `actorRole`, `docRef`, `timestamp`, `reason` (if applicable).
2. The entry is immediately streamed to BigQuery.
3. The Superadmin sees a disclosure banner: "You are accessing private citizen data. This access is logged."

### 8.3 Break-Glass Access

In a genuine emergency where normal access paths are insufficient:
1. Superadmin activates break-glass session (logs to `breakglass_events`).
2. All actions within the break-glass session are flagged separately in audit.
3. An independent review must be completed within 72 hours.
4. Review can be done by a second superadmin or PDRRMO Director.

### 8.4 Data Subject Erasure (RA 10173)

Citizens may request account deletion and data erasure. These requests are surfaced to the Superadmin for approval:
```
Data Erasure Request:
Citizen UID: [pseudonymous UID]
Request type: Full account deletion
Affects: 3 unverified reports
Verified reports: 2 (retained as anonymized public records — cannot be erased)
[Approve Erasure] [Decline with Reason]
```

### 8.5 Retention Exemptions

`setRetentionExempt` callable — marks a record exempt from standard auto-deletion schedules. Used when a record is subject to active investigation or legal hold. Action is audit-logged with rationale required.

---

## 9. System Operations

### 9.1 System Health Dashboard

```
┌────────────────────────────────────────┐
│ 🖥️ System Health                      │
├────────────────────────────────────────┤
│ Firestore: 🟢 OK · Reads: 1,240/min   │
│ RTDB: 🟢 OK · Active connections: 47  │
│ Cloud Functions: 🟢 OK · p95: 320ms   │
│ SMS (Semaphore): 🟢 OK · Queue: 0     │
│ SMS (Globe Labs): 🟡 Degraded         │  ← provider health
│ FCM: 🟢 OK                            │
│                                        │
│ Incident queue (unprocessed):  0       │
│ Sync failures (last 1h):       0       │
│ Dead-letter queue:             0       │
│                                        │
│ [Trigger Surge Pre-Warm]               │
│ [View SMS Audit] [View CF Logs]        │
└────────────────────────────────────────┘
```

### 9.2 Surge Pre-Warm

Normally triggered automatically when PAGASA raises Signal 2+. Bumps `minInstances` for `processInboxItem`, `acceptDispatch`, `sendSMS` from 3 → 20. Reverts 6 hours after signal drops.

Superadmin can manually trigger via [Trigger Surge Pre-Warm] button in the System Health panel. Action is logged.

### 9.3 SMS Provider Health

`smsProviderHealthProbe` CF runs every 2 minutes and writes to `sms_provider_health`. Superadmin sees provider status in real-time. If Semaphore degrades, Globe Labs is the fallback (and vice versa). Superadmin is notified of provider health changes via in-app alert.

### 9.4 Provincial Resources

Provincial resource inventory managed via callables:
- `provincial_resources/{id}` CRUD (equipment caches, staging areas, pre-positioned supplies)
- Displayed on provincial map as resource pins
- Available for municipal admins to request via escalation

---

## 10. Shift Handoff

### 10.1 Initiating a Province-Wide Handoff

```
┌────────────────────────────────────────┐
│ Superadmin Shift Handoff               │
│                                        │
│ Handoff to: [Select incoming admin ▼] │
│                                        │
│ Province-wide active incidents:        │
│ [auto-populated — all municipalities]  │
│                                        │
│ Pending NDRRMC escalations: 1          │
│ Municipal admin gaps: Capalonga (⚠️)   │
│ Open emergency declarations: 0         │
│                                        │
│ Urgent items:                          │
│ [                                    ] │
│ General notes:                         │
│ [                                    ] │
│                                        │
│ [Submit Handoff]                       │
└────────────────────────────────────────┘
```

The `activeIncidentSnapshot` for a superadmin handoff covers all 12 municipalities. Incoming superadmin receives FCM + in-app notification and must accept within 30 minutes.

### 10.2 Shift Coverage Monitoring

The analytics dashboard's **Admin Status** column shows per-municipality coverage gaps. If a municipality has no active admin (no handoff accepted, or gap between shifts), this is surfaced as an anomaly.

Superadmin is notified by automated alert: "Capalonga MDRRMO has no active admin. Last handoff was 8 hours ago."

---

## 11. Edge Cases & Solutions

| Scenario | Solution |
|---|---|
| NDRRMC escalation is urgent and PDRRMO Director is unavailable | Superadmin handles directly. The callable does not require a second approver; it requires the superadmin's TOTP-confirmed session. |
| A Municipal Admin reports that an Agency Admin is operating outside their jurisdiction | Superadmin reviews in audit log (actorAgencyId on all agency admin actions). Suspends account if confirmed via `suspendUser`. |
| Superadmin loses TOTP device | Secure recovery process: requires verification by a second superadmin or system admin. Temporary recovery codes (printed, stored securely offline) are issued at account creation. |
| System health shows unprocessed inbox items (> 5 min old) | `inboxReconciliationSweep` CF auto-retries up to 3 times. If dead-lettered, superadmin is alerted. Can manually trigger retry from System Health panel. |
| Globe Labs SMS provider degrades during a surge | System falls back to Semaphore (primary). Superadmin is notified. Provincial Superadmin may choose to escalate to NDRRMC for ECBS broadcast if SMS capacity is severely degraded. |
| A citizen submits a formal RA 10173 data access/erasure request | Request is surfaced to Superadmin via User Management. Superadmin reviews and approves erasure or generates the data export within required timeframes. |
| Two superadmins attempt conflicting province-wide actions simultaneously | Callables are server-authoritative. Server resolves the race; one succeeds. Audit log captures both attempts. |
| Break-glass session needed for a genuine emergency | Superadmin activates break-glass. All actions logged separately. Independent review completed within 72 hours. |

---

## 12. Technical Specifications

### 12.1 Platform

**Surface:** Admin Desktop PWA (React 18 + Vite)
- 1920×1080 primary; dual-monitor support (second window/screen for map)
- Chrome 90+ / Edge 90+ (desktop only)
- No Capacitor wrapper — browser-based only

### 12.2 State Ownership (Arch §9.4)

| Data Category | Authority |
|---|---|
| Server documents (all collections) | Firestore SDK |
| UI state (dashboard view, selected entity, panel) | Zustand |
| Analytics aggregates, callables | TanStack Query |
| **Offline mutations** | **Blocked** — no outbox |

### 12.3 Auth (Arch §7.5)

| Factor | Requirement |
|--------|-------------|
| Primary | Phone OTP (verified staff phone) |
| Second factor | **TOTP (mandatory)** — Authenticator app required. SMS-based 2FA not accepted for this role. |
| Re-auth interval | **4 hours** (shorter than municipal/agency admins due to higher privilege) |
| Emergency declaration | TOTP re-verify required even within re-auth window |
| Recovery | Temporary recovery codes (printed, stored securely) + second superadmin verification |

Firebase ID token is 1h regardless. "Re-auth interval" means the app prompts for TOTP at the app layer every 4 hours.

Cannot self-register — account is created by a system admin during system setup.

### 12.4 Map Rendering

- Leaflet + OSM tiles (same as all roles)
- Province-wide view: all municipalities, all incidents, all responder locations
- Clustering for high-density areas
- Responder locations from RTDB: province-wide read (rule allows superadmin to read any municipality's responder tree)
- Agency projection (ghosted dots): same `agency_responder_projection` as agency admins
- No tile caching assumed (always online)

### 12.5 BigQuery Access

Provincial Superadmin has in-app audit log viewer (Firestore-backed). Compliance officers may have direct BigQuery query access via separate IAM — this is a separate credential provisioned by the system admin, not managed within Bantayog itself.

### 12.6 Audit-Streamed Actions

All admin actions are audit-logged. The following additionally stream to BigQuery in near-real-time:
- Any read of `report_private/{id}` or `report_contacts/{id}`
- Any `breakglass_events` entry
- `declareEmergency`
- `setRetentionExempt`
- `forwardMassAlertToNDRRMC`
- `revokeResponderAccess` (any)
- `suspendUser` (any)
- Any use of `createUser` with `role: 'provincial_superadmin'`

---

## Metrics & Pilot Acceptance

Per Architecture Spec §18, the Superadmin surface is validated against:

- **#23:** NDRRMC escalation workflow tabletop drill with PDRRMO Director. Full submission → forward → receipt → audit. Latency baseline established.
- **#25:** 30-day measurement of admin shift handoff acceptance rate. < 10% unaccepted handoffs required for production.
- **#7–#17 (v5 baseline):** System health SLOs, audit integrity, break-glass drill, restore drill.

---

## Document Version

**Version:** 2.0
**Date:** 2026-04-16
**Status:** Aligned to Architecture Spec v6.0
**Next Review:** After Phase 7 (Provincial Superadmin Desktop) implementation
