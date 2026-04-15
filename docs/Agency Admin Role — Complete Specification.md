# Agency Admin Role — Complete Specification

**Bantayog Alert — Disaster Reporting Platform**

**Province of Camarines Norte, Philippines**

------

## Table of Contents

1. [Role Overview](https://www.google.com/search?q=%23role-overview)
2. [Permissions & Access](https://www.google.com/search?q=%23permissions--access)
3. [Interface Design](https://www.google.com/search?q=%23interface-design)
4. [Core Features](https://www.google.com/search?q=%23core-features)
5. [Workflows](https://www.google.com/search?q=%23workflows)
6. [Analytics & Reporting](https://www.google.com/search?q=%23analytics--reporting)
7. [Edge Cases & Solutions](https://www.google.com/search?q=%23edge-cases--solutions)
8. [Technical Specifications](https://www.google.com/search?q=%23technical-specifications)

------

## Role Overview

### Who Are Agency Admins?

Agency Admins are dispatchers and operational managers for specific specialized response organizations operating within the province or a municipality (e.g., Bureau of Fire Protection (BFP), Philippine National Police (PNP), Red Cross, DPWH, or localized volunteer rescue groups).

### Key Differences from Municipal Admins

While Municipal Admins have horizontal command over a geographic area, **Agency Admins have vertical command over their specific organizational resources.** - **The Core Similarity:** They use the same map-centric interface, can verify citizen reports, and can dispatch responders.

- **The Core Difference:** They **CANNOT** send mass announcements/alerts to citizens. Additionally, their dispatch and roster management capabilities are strictly limited to responders registered under their specific agency.

### Work Environment

Office or station-based (e.g., Daet Fire Station dispatch desk) — desktop primary interface with dual-monitor support recommended.

------

## Permissions & Access

### What Agency Admins CAN Do

| **Action**                      | **Scope**                            | **Notes**                                                    |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| **View reports**                | Their operational jurisdiction       | All pending and verified reports                             |
| **Verify reports**              | Their operational jurisdiction       | Mark as verified, rejected, or need info                     |
| **Manage Responder Roster**     | **Their agency only**                | Add, edit, remove, and manage shifts for their personnel     |
| **Dispatch responders**         | **Their agency only**                | Select and deploy their own specialized teams                |
| **View responder status**       | Their agency (Full) / Others (Basic) | Real-time tracking of their own fleet; basic location/status of other agencies for coordination |
| **Communicate with citizens**   | Their jurisdiction                   | Request clarification on reports                             |
| **Communicate with responders** | Their agency only                    | Two-way messaging during incidents                           |
| **View incident history**       | Their jurisdiction                   | For post-incident analysis                                   |
| **Close incidents**             | Assigned incidents                   | Mark incidents handled by their agency as resolved           |

### What Agency Admins CANNOT Do

| **Action**                       | **Why**                                                      |
| -------------------------------- | ------------------------------------------------------------ |
| **Send mass alerts (citizens)**  | Municipal/Provincial Admin exclusive right to prevent panic and conflicting official info |
| **Dispatch other agencies**      | Chain of command (e.g., BFP cannot dispatch PNP)             |
| **Manage other agency rosters**  | Security and organizational boundaries                       |
| **Access system-wide analytics** | Privacy + jurisdiction (can only see their agency's performance) |
| **Delete verified reports**      | Data integrity (public record)                               |

### Data Visibility Matrix

| **Data Type**               | **Visibility**                                               |
| --------------------------- | ------------------------------------------------------------ |
| **Incident Reports**        | ✅ Full details                                               |
| **Own Agency Responders**   | ✅ Full details (Real-time location, contact, status, workload) |
| **Other Agency Responders** | ⚠️ Limited (Type, basic status, and location on active incidents only) |
| **Citizen Identity**        | ✅ Visible (for follow-up only)                               |
| **Agency Analytics**        | ✅ Full access to their own data                              |

------

## Interface Design

### Primary Layout (Map-Centric Desktop)

Plaintext

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Bantayog Alert - AGENCY ADMIN (BFP - DAET STATION)             🔔 3  👤 Profile│
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────────────┐ │
│ │ [OPERATIONAL MAP - FULL SCREEN]                                      │ │
│ │                                                                      │ │
│ │  ┌──────────────────────────────────────────────────────────────────────┐  │ │
│ │  │  📍 Jurisdiction Boundary                                          │  │ │
│ │  │  ┌─────────────────────────────────────────────────────────────┐   │  │ │
│ │  │  │  🔴 High Severity Incidents (2)                               │   │  │ │
│ │  │  │  🟡 Medium Severity Incidents (4)                             │   │  │ │
│ │  │  └─────────────────────────────────────────────────────────────┘   │  │ │
│ │  │  🚒 YOUR Responders (Red dots - Full control)                   │   │  │ │
│ │  │  🚓 OTHER Responders (Ghosted dots - View only)                 │   │  │ │
│ │  │  📍 Active incidents (clickable pins)                            │   │  │ │
│ │  └──────────────────────────────────────────────────────────────────────┘  │ │
│ │                                                                      │ │
│ │ [QUICK ACTIONS - Top Edge Bar]                                      │ │
│ │ 📋 Pending: 5  |  🚒 Available Teams: 3  |  👥 Manage Roster        │ │
│ │                                                                      │ │
│ └────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Context Panels (Slide In From Right)

#### Panel A: Roster Management (Unique to Agency)

Plaintext

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 👥 Manage Agency Roster (BFP - Daet)                      [Close] [Map]    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ [+ Add New Responder]  [Bulk Import CSV]                                     │
│                                                                              │
│ ACTIVE SHIFT (12 Personnel):                                                 │
│ ├─ 🚒 Team Alpha (Fire Truck 1) - STATUS: Available                          │
│ │    Lead: FO3 Santos    [Edit] [Set Off-Duty]                              │
│ ├─ 🚒 Team Bravo (Rescue 1) - STATUS: Dispatched (Incident #0471)            │
│ │    Lead: FO1 Reyes     [Edit] [Message]                                   │
│                                                                              │
│ OFF-DUTY PERSONNEL (34 Personnel):                                           │
│ ├─ Officer Maria Cruz        [Set Available] [Edit Details]                  │
│ ├─ Officer Juan Perez        [Set Available] [Edit Details]                  │
│                                                                              │
│ [View Equipment Inventory] [Shift Schedule]                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

------

## Core Features

### 1. Agency-Specific Triage & Verification

**Purpose:** Filter the noise. A fire department dispatcher needs to quickly find fire-related reports amidst flood and medical reports.

- **Custom Filters:** "Show me only Fire, Structural Collapse, and Hazmat reports."
- **Verification Power:** When an Agency Admin verifies a report, it marks the report as "Verified by [Agency Name]" across the entire platform, saving the Municipal Admin time.

### 2. Autonomous Roster Management

**Purpose:** Agencies need full control over who is active in the field.

- **Onboarding:** Agency Admins can create responder accounts directly, generating temporary passwords and assigning them to specific vehicles or teams.
- **Shift Toggling:** Ability to bulk-set teams to "On-Duty" or "Off-Duty" at 0800H and 2000H.
- **Specialization Tagging:** Tag individual responders with skills (e.g., "Swift Water Rescue", "Hazmat Certified") to help with smart dispatching.

### 3. Siloed Dispatching & Inter-Agency Visibility

**Purpose:** Deploy resources without stepping on other agencies' toes.

- When opening an incident (e.g., #0471 - Vehicle Collision), the Agency Admin sees:
  - *"PNP Daet has already dispatched 1 unit (ETA 5 mins)."*
  - *"MDRRMO has dispatched 1 ambulance."*
- The Agency Admin can then dispatch their Fire Rescue truck, knowing exactly who else will be on the scene, facilitating inter-agency cooperation.

### 4. Direct Responder Communications

**Purpose:** Tactical coordination.

- Built-in messaging panel to chat directly with their deployed units.
- Ability to push route changes or updated citizen photos directly to their responder's mobile app.

------

## Workflows

### Workflow 1: The Self-Dispatch (Agency First)

Plaintext

```
┌─ → Citizen submits report of a Fire in Barangay San Jose
│
└─ → BFP Agency Admin sees it in the Pending Queue
     │
     ├─ → Agency Admin Verifies the report ✅
     │
     ├─ → Agency Admin dispatches BFP Team Alpha
     │
     └─ → Municipal Admin sees the incident pop up as:
          "Verified by BFP Daet - BFP Team Alpha en route" 
          (Municipal Admin is kept in the loop without having to act)
```

### Workflow 2: Municipal Request to Agency

Plaintext

```
┌─ → Municipal Admin verifies a major Flood report
│
└─ → Municipal Admin realizes they need specialized Swift Water Rescue
     │
     ├─ → Municipal Admin tags the incident: "Requesting Coast Guard/PCG"
     │
     └─ → Agency Admin (PCG) receives high-priority notification
          │
          ├─ → Agency Admin reviews incident details
          │
          └─ → Agency Admin dispatches their specialized team
```

------

## Analytics & Reporting

### Agency Performance Dashboard

Plaintext

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📊 AGENCY ANALYTICS - BFP DAET                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ YOUR TEAM'S PERFORMANCE (Last 30 Days)                                 │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ Total Dispatches: 42                                                     │ │
│ │ Average Response Time: 7m 30s ✅ (Target: < 10m)                         │ │
│ │ Average Time on Scene: 45m                                               │ │
│ │                                                                          │ │
│ │ Incidents Handled by Type:                                             │ │
│ │ ├─ Structural Fire: 12                                                   │ │
│ │ ├─ Grass/Wildland Fire: 18                                               │ │
│ │ ├─ Vehicle Extrication: 5                                                │ │
│ │ └─ Assist to other agencies: 7                                           │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ [Export Monthly Agency Report (PDF/Excel)]                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

*Note: Exports contain data structured specifically for the agency's internal bureaucratic reporting requirements.*

------

## Edge Cases & Solutions

### 1. Conflicting Verification/Classification

**Problem:** A citizen reports a "Fire", but BFP Agency Admin arrives on scene and realizes it's just "Smoke from controlled burning" (Not an emergency).

**Solution:** Agency Admin has the power to re-classify the incident type and downgrade the severity. They can mark it "Resolved - False Alarm." This updates the system globally.

### 2. Rogue Responders / Lost Devices

**Problem:** An agency responder loses their phone, risking unauthorized access to the platform.

**Solution:** The Agency Admin has a "Revoke Access" button in the Roster Management panel, immediately killing the session for that specific responder and wiping cached offline data on the next ping.

### 3. Multi-Agency Command Conflicts

**Problem:** Both the Municipal Admin and the Agency Admin try to manage the status of the same incident simultaneously.

**Solution:** The platform uses an "Incident Commander" tag. By default, the first admin to verify/dispatch owns the "Commander" tag, but it can be handed off. Only the Commander can "Close" the incident, though any participating agency can mark their *own* responders as "Done".

------

## Technical Specifications

### Data Partitioning (Security Rules)

To ensure Agencies only manage their own personnel, Firestore/Database security rules must enforce strict tenant-like boundaries on the `users` and `responders` collections.

JavaScript

```
// Example Firebase Security Rule Logic
match /responders/{responderId} {
  // Agency Admins can only read/write responders where agencyId matches their own
  allow read, write: if request.auth.token.role == 'agency_admin' 
                     && resource.data.agencyId == request.auth.token.agencyId;
}
```

### Audit Logging

Because multiple admins (Municipal and Agency) can interact with a single incident, every state change in an incident document must strictly append to an `incident_logs` subcollection, logging:

- `timestamp`
- `action` (e.g., "Verified", "Dispatched Team A")
- `actorId`
- `actorRole` (e.g., "Agency Admin - PNP")

### Map Layering Performance

Since Agency Admins need to see ghosted dots of other agencies' responders, the frontend must handle potentially hundreds of real-time geospatial data points.

- **Optimization:** Own agency responders update at 5-second intervals. "Ghosted" other-agency responders update at 30-second intervals to reduce websocket/document read costs, as real-time precision is only required for their own fleet.



UPDATED Changes:

### 1. Permissions & Access Updates

**What Agency Admins CAN Do (Updated)**

- **View verified reports:** Can only see incidents that have been officially verified by a Municipal or Provincial Admin.
- **Receive agency requests:** Receive targeted dispatch requests from Municipal Admins (e.g., "MDRRMO requests BFP assistance").
- **Communicate with Admins:** Two-way direct messaging with Municipal/Provincial Admins for coordination.
- *(Retained)* Manage own roster, dispatch own responders, view own responder status.

**What Agency Admins CANNOT Do (Updated)**

- **Verify citizen reports:** Strict separation of duties. Triage is handled by the LGU (Local Government Unit).
- **View pending/unverified reports:** To reduce noise, they do not see the raw influx of citizen reports—only actionable, verified incidents.
- *(Retained)* Send mass alerts to citizens, dispatch other agencies.

------

### 2. Interface Design Adjustments

Because they no longer triage raw reports, their **Quick Actions Bar** and **Dashboard** need to reflect their reality: waiting for verified incidents or direct requests.

**Updated Quick Actions (Top Edge Bar):**

Plaintext

```
│ 🚨 Verified Incidents: 8  |  ⚠️ Requests from MDRRMO: 2  |  🚒 Available Teams: 3 │
```

**Context Panel Update (Incident Details):** Instead of a "Verify" button, the Agency Admin sees the verification attribution and a call to action:

Plaintext

```
┌────────────────────────────────────────────────────────────────────────┐
│ Incident #0471 - Structural Fire - High Severity                       │
│ ✓ VERIFIED BY: Admin Juan (Daet MDRRMO)                                │
│                                                                        │
│ ✉️ MESSAGE FROM MDRRMO:                                                │
│ "Fire spreading to adjacent commercial building. Need 2 fire trucks."  │
│                                                                        │
│ [Dispatch My Teams]  [Message MDRRMO Admin]  [Decline Request]         │
└────────────────────────────────────────────────────────────────────────┘
```

------

### 3. Workflow Redesign: The "Requested Dispatch"

We need to replace the "Self-Dispatch" workflow with a "Hub-and-Spoke" model, where the Municipal Admin is the hub.

**New Core Workflow:**

1. **Citizen** submits a report.
2. **Municipal Admin** sees the pending report, verifies it, and classifies it as a "Fire - High Severity."
3. **Municipal Admin** clicks `[Request Agency Assistance]` and selects **BFP Daet**.
4. **Agency Admin (BFP)** receives an urgent high-priority notification: *"MDRRMO Daet is requesting assistance for Incident #0471."*
5. **Agency Admin** reviews the verified details and clicks `[Dispatch]`, deploying their own Fire Team Alpha.
6. **Municipal Admin** dashboard automatically updates to show: *"BFP Daet has dispatched Team Alpha (ETA 8 mins)."*

------

### 4. Inter-Admin Communication Channel

Since Admins can contact other agencies, we need a dedicated "Command Channel" overlay.

**Command Channel Features:**

- **Direct Messaging:** Municipal Admins and Agency Admins can chat in real-time, tied to a specific Incident ID.
- **Resource Negotiation:** "We only have 1 truck available, can you request the volunteer brigade for backup?"
- **Audit Trail:** All inter-agency communications are logged and visible to the Provincial Superadmin for post-incident review.

## The Verification-to-Dispatch Workflow

This workflow ensures a clean chain of command:

1. **Reporting:** A citizen submits a report of a warehouse fire.
2. **Verification (LGU):** The **Municipal Admin** verifies the photo/location and classifies it as a "Fire - Emergency."
3. **Request:** The **Municipal Admin** clicks `[Request BFP]` within the incident panel.
4. **Tactical Dispatch:** The **Agency Admin (BFP)** receives the alert. They review the verified incident and click `[Dispatch Unit 01]`.
5. **Execution:** The **Responder** receives the turn-by-turn navigation on their mobile app.
6. **Updates:** The Agency Admin monitors the Responder's progress. Once the fire is out, the Agency Admin marks their agency as "Cleared."

------

## Analytics & Reporting

### Agency Impact Dashboard

Focused on operational efficiency rather than community trends.

- **Response Time (Kip):** Average time from "Request Received" to "Unit Dispatched."
- **Personnel Hours:** Total man-hours spent on-duty and on-scene.
- **Incident Heatmap:** Visualization of where the agency's resources are most frequently utilized.
- **Monthly Accomplishment Report:** One-click PDF export formatted for internal agency bureaucracy.

------

## Edge Cases & Solutions

| **Scenario**             | **Solution**                                                 |
| ------------------------ | ------------------------------------------------------------ |
| **Zero Availability**    | If an Agency Admin is requested but has no units, they click `[Decline - No Resources]`. The system alerts the Municipal Admin to request a different agency or volunteer group. |
| **Direct Discovery**     | If an Agency Responder sees an incident while on patrol (before it's on the map), they report it as a "Verified Responder Report," which bypasses the Pending Queue and notifies both the Municipal Admin and their own Agency Admin. |
| **Cross-Border Support** | If a Daet Agency helps in Talisay, the Provincial Superadmin must authorize the "Mutual Aid" visibility toggle so the Agency can see the Talisay incident map. |

------

## Technical Specifications

- **Data Partitioning:** Agency-level multi-tenancy. Admins can only `CRUD` responder documents where `agencyID == user.agencyID`.
- **Latency Requirements:** Responder GPS pings must reflect on the Agency Admin's map with < 5s latency for active dispatches.
- **Device Support:** Optimized for Chrome/Edge on Desktop. Tablet-responsive for "Mobile Command Post" scenarios.