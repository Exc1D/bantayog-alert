# Provincial Superadmin Role — Complete Specification

**Bantayog Alert — Disaster Reporting Platform**
**Province of Camarines Norte, Philippines**
**Version:** 1.0
**Status:** ✅ Approved — Ready for Implementation
**Date:** 2026-04-10

---

## Table of Contents

1. [Role Overview](#role-overview)
2. [Interface Design](#interface-design)
3. [Phase 1 Core Features](#phase-1-core-features)
4. [Permissions & Access](#permissions--access)
5. [Technical Specifications](#technical-specifications)
6. [Edge Cases & Solutions](#edge-cases--solutions)
7. [Implementation Timeline](#implementation-timeline)

---

## Role Overview

**Who They Are:** PDRRMO (Provincial Disaster Risk Reduction and Management Office) staff with province-wide authority over all 12 municipalities of Camarines Norte.

**Scope:** Entire province (12 municipalities: Basud, Capalonga, Daet, Jose Panganiban, Labo, Mercedes, Paracale, San Lorenzo Ruiz, San Vicente, Santa Elena, Talisay, Vinzons)

**Work Environment:** Office-based (PDRRMO operations center at Daet) — **desktop primary with dual-monitor support**

**Key Difference:** Unlike Municipal Admins (map-centric), Provincial Superadmins need an **analytics-first dashboard** with province-wide metrics, municipal comparisons, and trend analysis.

---

## Interface Design

### Desktop Layout (1920x1080 recommended, dual-monitor)

```
┌─────────────────────────────────────────────────────────────────┐
│                 [PROVINCIAL DASHBOARD]                        │
│               (Primary: Analytics, Secondary: Map)            │
│                                                                  │
│   TOP BAR:                                                      │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ 🏛️ PDRRMO Camarines Norte  │  [🔔 Alerts: 3]  [👤 Admin] │    │
│   └────────────────────────────────────────────────────────┘    │
│                                                                  │
│   SCREEN 1: ANALYTICS DASHBOARD (Primary View)                 │
│   ┌────────────────────────────────────────────────────────┐    │
│   │  [Province-wide Metrics - Real-time]                  │    │
│   │  ┌──────────┬──────────┬──────────┬──────────┬────────┐ │    │
│   │  │Active    │Responders│Avg       │Resolved  │Muni    │ │    │
│   │  │Incidents │Available │Response  │Today     │Issues  │ │    │
│   │  │: 47      │: 156/203 │: 12 min  │: 89      │: 0/12  │ │    │
│   │  └──────────┴──────────┴──────────┴──────────┴────────┘ │    │
│   │                                                           │    │
│   │  [Municipal Performance Comparison]                      │    │
│   │  ┌────────────┬──────────┬───────────┬─────────┬────────┐│    │
│   │  │Municipality│Incidents │Response   │Resolved │Resources││    │
│   │  │            │          │Time       │         │Utilized││    │
│   │  ├────────────┼──────────┼───────────┼─────────┼────────┤│    │
│   │  │Daet        │12        │8 min      │10       │85%     ││    │
│   │  │Labo        │8         │15 min     │6        │72%     ││    │
│   │  │Basud       │5         │10 min     │4        │68%     ││    │
│   │  │...         │...       │...        │...      │...     ││    │
│   │  └────────────┴──────────┴───────────┴─────────┴────────┘│    │
│   │  [CLICK any municipality for details →]                 │    │
│   │                                                           │    │
│   │  [Trend Analysis - Last 7 Days]                         │    │
│   │  • Incident volume chart (line graph)                   │    │
│   │  • Response time trend (bar chart)                      │    │
│   │  • Resource utilization heatmap                         │    │
│   │  • Municipal comparison radar chart                     │    │
│   │                                                           │    │
│   │  [Quick Actions]                                         │    │
│   │  [📊 Reports]  [👥 Users]  [⚙️ Settings]  [🚨 Declare Emergency] │    │
│   └────────────────────────────────────────────────────────┘    │
│                                                                  │
│   SCREEN 2: PROVINCIAL MAP (Optional - Second Monitor)         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │  [PROVINCIAL MAP - All 12 Municipalities]              │    │
│   │  • Incident locations (all municipalities)             │    │
│   │  • Municipal boundaries (clearly labeled)              │    │
│   │  • Responder team locations                            │    │
│   │  • Provincial resource locations                       │    │
│   │  • Heat map (incident density by municipality)         │    │
│   │  • Zoom to municipality (click for details)            │    │
│   │                                                           │    │
│   │  [Map Overlays - Toggle]                                │    │
│   │  ☑ Show all municipalities                              │    │
│   │  ☑ Show provincial resources                            │    │
│   │  ☑ Show incident heatmap                                │    │
│   │  ☑ Show municipal boundaries                            │    │
│   │  ☑ Show active incidents only                          │    │
│   │                                                           │    │
│   │  [Map Legend]                                           │    │
│   │  🔴 High severity  🟡 Medium  🟢 Low                     │    │
│   │  🚒 Police  🚒 Fire  🏥 Medical  🚜 Engineering         │    │
│   └────────────────────────────────────────────────────────┘    │
│                                                                  │
│   CONTEXT PANELS (Slide in from right):                         │
│   → Click municipality → Municipal details slide in            │
│   → Click incident → Full incident details slide in            │
│   → Click user → User management panel slides in               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Analytics-first interface** - Data and trends are primary view (not map)
2. **Dual-screen support** - Can expand analytics to monitor 1, map to monitor 2
3. **Drill-down capability** - From province-wide → municipal → individual incidents
4. **Real-time monitoring** - Live updates from all municipalities
5. **Alert-driven** - System notifies superadmin of escalations, anomalies, issues
6. **Keyboard shortcuts** - Power user efficiency

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `D` | Analytics dashboard (primary view) |
| `M` | Provincial map (secondary view) |
| `U` | User management |
| `A` | Declare emergency |
| `R` | Generate reports |
| `S` | System settings |
| `L` | View audit logs |
| `H` | System health monitoring |
| `Escape` | Close context panel |

---

## Phase 1 Core Features

### 0. Multi-Factor Authentication (MANDATORY) 🔴 CRITICAL

**Purpose:** Secure high-privilege accounts

**Implementation:**
```
Login Flow:
1. User enters email + password
2. System verifies credentials
3. [MANDATORY] Second factor required:
   Options:
   • Authenticator app (TOTP) - RECOMMENDED
   • SMS code
   • Hardware security key (YubiKey)
4. User enters 6-digit code from authenticator
5. Access granted to Provincial Superadmin dashboard
```

**Recovery:**
- If user loses access to MFA device:
  - Secure account recovery process (Gap #20)
  - Requires verification by another superadmin or system admin
  - Temporary recovery codes (printed and stored securely)

**Enforcement:**
- MFA is **MANDATORY** for all Provincial Superadmin accounts
- Cannot be disabled or bypassed
- Enforced at account creation time
- Reminder to set up MFA before account is activated

---

### 1. Real-Time Analytics Dashboard 🟡 HIGH

**Purpose:** Province-wide situational awareness

**Features:**

**Province-wide Metrics (Real-time):**
```
Top Bar Metrics (always visible):
┌────────────────────────────────────────────────────────┐
│ Active Incidents: 47  │  Responders Available: 156/203 │
│ Avg Response Time: 12min  │  Resolved Today: 89  │
│ Municipalities with Issues: 0/12  │  System Health: 🟢 OK │
└────────────────────────────────────────────────────────┘
```

**Municipal Performance Comparison:**
```
Side-by-side comparison table:
┌────────────┬──────────┬───────────┬─────────┬──────────┐
│Municipality│Incidents │Response   │Resolved │Resources │
│            │          │Time       │         │Utilized  │
├────────────┼──────────┼───────────┼─────────┼──────────┤
│Daet        │12        │8 min ✅   │10       │85%       │
│Labo        │8         │15 min ⚠️  │6        │72%       │
│Basud       │5         │10 min ✅  │4        │68%       │
│Capalonga   │3         │18 min ⚠️  │2        │55%       │
│...         │...       │...        │...      │...       │
└────────────┴──────────┴───────────┴─────────┴──────────┘
```

**Trend Analysis (Last 7 Days):**
- Incident volume chart (line graph showing daily counts)
- Response time trend (bar chart comparing municipalities)
- Resource utilization heatmap (visualize capacity)
- Municipal comparison radar chart (multi-dimensional comparison)

**Drill-Down Capability:**
```
Province-wide (47 incidents)
    ↓ [CLICK on "Daet: 12 incidents"]
Municipality view (Daet)
    ↓ [CLICK on "#0471: Flood - High"]
Incident details
    ↓ [CLICK on responder]
Responder profile
```

**Real-Time Updates:**
- All metrics update in real-time (WebSocket or Firestore listeners)
- Live indicators show data freshness (e.g., "Updated 5 seconds ago")
- Color-coded alerts for anomalies (red = critical, yellow = warning)

---

### 2. Municipal Performance Monitoring 🟡 HIGH

**Purpose:** Compare municipal performance, identify bottlenecks

**Metrics Tracked:**

**Response Time:**
```
Average response time per municipality
Target: < 15 minutes
┌────────────┬──────────┬──────────┬─────────┐
│Municipality│Avg Time │Target    │Status   │
├────────────┼──────────┼──────────┼─────────┤
│Daet        │8 min     │< 15 min  │✅ Good  │
│Labo        │15 min    │< 15 min  │⚠️ At Target│
│Capalonga   │18 min    │< 15 min  │❌ Poor  │
└────────────┴──────────┴──────────┴─────────┘
```

**Resolution Rate:**
```
Percentage of resolved incidents vs. active
┌────────────┬──────────┬──────────┬─────────┐
│Municipality│Resolved  │Active    │Rate     │
├────────────┼──────────┼──────────┼─────────┤
│Daet        │10        │2         │83% ✅   │
│Labo        │6         │2         │75% ✅   │
│Capalonga   │2         │1         │67% ⚠️  │
└────────────┴──────────┴──────────┴─────────┘
```

**Resource Utilization:**
```
Percentage of available responders deployed
┌────────────┬──────────┬──────────┬─────────┐
│Municipality│Deployed  │Available │Utilized │
├────────────┼──────────┼──────────┼─────────┤
│Daet        │17/20     │3         │85% ✅   │
│Labo        │13/18     │5         │72% ✅   │
│Capalonga   │6/15      │9         │40% ⚠️  │
└────────────┴──────────┴──────────┴─────────┘
```

**Compliance Monitoring:**
```
Compliance scorecards for each municipality
┌────────────┬──────────┬──────────┬─────────┐
│Municipality│Protocol  │Reporting │Overall  │
│            │Compliance│Timeliness│Score    │
├────────────┼──────────┼──────────┼─────────┤
│Daet        │95% ✅    │100% ✅   │98% ✅   │
│Labo        │88% ✅    │92% ✅    │90% ✅   │
│Capalonga   │72% ⚠️   │80% ✅    │76% ⚠️  │
└────────────┴──────────┴──────────┴─────────┘
```

**Anomaly Detection:**
```
Automated alerts when metrics deviate from norms:
• Response time spikes (> 20 min for 3+ incidents)
• Resolution rate drops (< 50% for active incidents)
• Resource over-utilization (> 90% for extended period)
• Zero activity (unusual for normally active municipality)

[Example Alert]
⚠️ ANOMALY DETECTED: Capalonga
• Response time increased 40% (18 min vs. 12 min avg)
• Last 3 incidents all > 20 min response time
• Possible issue: Responder shortage or surge in incidents
→ [Investigate] → [Contact Municipal Admin]
```

---

### 3. User Management Dashboard 🟡 HIGH

**Purpose:** Manage all user accounts across the province

**Features:**

**User List View:**
```
All users in province (filterable):
┌────────────────────────────────────────────────────────┐
│ [Filter: Municipal Admins ▼] [Search: name/email]      │
├────────────┬───────────┬──────────────┬─────────┬────┤
│Name        │Role       │Municipality  │Status   │Action│
├────────────┼───────────┼──────────────┼─────────┼────┤
│Juan Dela Cruz│Municipal│Daet          │Active   │[Edit]│
│Maria Santos │Admin     │Labo          │Active   │[Edit]│
│Jose Reyes  │Municipal │Capalonga     │Inactive │[Edit]│
│            │Admin     │              │         │     │
└────────────┴───────────┴──────────────┴─────────┴────┘
```

**Promote/Demote Municipal Admins:**
```
Promote User to Municipal Admin:
1. Search for user by email or name
2. Select target municipality (dropdown: 12 municipalities)
3. Confirm promotion:
   ┌─────────────────────────────────────┐
   │ Promote Juan Dela Cruz to          │
   │ Municipal Admin for:                │
   │ [Daet ▼]                            │
   │                                     │
   │ This user will have:                │
   │ ✅ View all reports in Daet         │
   │ ✅ Verify and triage reports        │
   │ ✅ Dispatch responders              │
   │ ✅ Manage incidents                 │
   │                                     │
   │ [Cancel]  [Confirm Promotion]       │
   └─────────────────────────────────────┘
```

**Audit Log for User Changes (Gap #14):**
```
Full audit trail of all role changes:
┌────────────────────────────────────────────────────────┐
│ Audit Log: User Management                            │
├────────────┬──────────┬──────────────┬────────────────┤
│Timestamp   │Action    │User          │Details        │
├────────────┼──────────┼──────────────┼────────────────┤
│2026-04-10  │Promote   │Juan Dela Cruz│To Municipal   │
│14:32:15    │          │              │Admin (Daet)   │
│            │          │              │By: Superadmin │
│            │          │              │A              │
│2026-04-10  │Deactivate│Maria Santos  │Reason: Staff  │
│12:15:33    │          │              │transfer       │
│            │          │              │By: Superadmin │
│            │          │              │A              │
└────────────┴──────────┴──────────────┴────────────────┘
```

**Bulk User Import (Gap #13):**
```
Import multiple Municipal Admins at once:
1. Download CSV template
2. Fill in: name, email, municipality, role
3. Upload CSV file
4. System validates and creates accounts
5. Send activation emails to all new users

CSV Template:
name,email,municipality,role
"Juan Dela Cruz",juan@daet.gov.ph,"Daet","Municipal Admin"
"Maria Santos",maria@labo.gov.ph,"Labo","Municipal Admin"
...
```

**User Activity Monitoring (Gap #15):**
```
Track user activity and performance:
┌────────────────────────────────────────────────────────┐
│ User: Juan Dela Cruz (Municipal Admin - Daet)        │
├────────────────────────────────────────────────────────┤
│ Last Login: 2026-04-10 14:32                          │
│ Account Created: 2025-06-15                           │
│ Status: Active ✅                                     │
│                                                        │
│ Performance Metrics (Last 30 days):                   │
│ • Reports verified: 45                               │
│ • Incidents dispatched: 38                           │
│ • Avg response time: 8 min                           │
│ • Resolution rate: 83%                               │
│                                                        │
│ Recent Activity:                                      │
│ • 14:32 - Verified report #0472                      │
│ • 14:15 - Dispatched Team A to incident #0471        │
│ • 13:58 - Rejected report #0470 (spam)               │
└────────────────────────────────────────────────────────┘
```

**Account Recovery (Gap #20):**
```
Secure account recovery for locked accounts:
When Municipal Admin forgets password or loses MFA:

1. Admin requests recovery from superadmin
2. Superadmin initiates recovery:
   ┌─────────────────────────────────────┐
   │ Account Recovery: Juan Dela Cruz   │
   │                                     │
   │ Verification required:              │
   │ [ ] Confirm identity (phone call)  │
   │ [ ] Verify with another admin      │
   │ [ ] Security questions             │
   │                                     │
   │ Recovery options:                   │
   │ ○ Send password reset link         │
   │ ○ Generate temporary MFA bypass     │
   │ ○ Reset MFA device                 │
   │                                     │
   │ [Cancel]  [Initiate Recovery]       │
   └─────────────────────────────────────┘
3. User receives recovery instructions
4. User resets credentials
5. System logs recovery action in audit trail
```

**Notification on Role Changes (Gap #18):**
```
When user is promoted/demoted/deactivated:
→ Email notification sent immediately
→ In-app notification on next login

Subject: Your role has been updated
Body:
  Your role in Bantayog Alert has been updated.
  
  New role: Municipal Admin
  Municipality: Daet
  Effective: 2026-04-10 14:32
  
  [Login to see your new permissions]
  
  If you did not request this change, contact:
  PDRRMO Office: [phone]
```

**Deactivation Reason Tracking (Gap #19):**
```
When deactivating an account:
┌─────────────────────────────────────┐
│ Deactivate User: Maria Santos       │
│                                     │
│ ⚠️ WARNING: User will lose access   │
│ to all features immediately.        │
│                                     │
│ Reason for deactivation (required): │
│ [ ] Staff transfer                  │
│ [ ] Contract ended                  │
│ [ ] Security concern                │
│ [ ] Inactivity                      │
│ [ ] Other: [___________]            │
│                                     │
│ Additional notes:                   │
│ [_________________________________] │
│                                     │
│ [Cancel]  [Confirm Deactivation]     │
└─────────────────────────────────────┘
```

---

### 4. Multi-Municipality Incident Coordination 🔴 CRITICAL

**Purpose:** Coordinate disasters affecting multiple municipalities

**Multi-Municipality Incident View (Gap #22):**
```
Filter to show incidents affecting multiple municipalities:
┌────────────────────────────────────────────────────────┐
│ [Filter: Cross-Municipality Incidents Only]           │
├──────────────┬──────────────┬──────────┬──────────────┤
│Incident ID   │Type          │Severity  │Municipalities│
├──────────────┼──────────────┼──────────┼──────────────┤
│#0471         │Flood         │High      │Daet, Labo    │
│#0472         │Landslide     │High      │Basud,        │
│              │              │          │Jose Panganiban│
└──────────────┴──────────────┴──────────┴──────────────┘

[CLICK on #0471 → Unified incident view]
```

**Unified Incident View (Gap #25):**
```
Superadmin coordinates (does NOT take command):
┌────────────────────────────────────────────────────────┐
│ Incident #0471: Flood - High Severity                 │
│ Affecting: Daet, Labo                                 │
│                                                        │
│ [Daet Municipal Admin Response]                       │
│ • Dispatched: 2 teams (Fire, Rescue)                  │
│ • Status: En route (ETA 10 min)                       │
│ • Resources: 1 boat, 1 rescue truck                   │
│                                                        │
│ [Labo Municipal Admin Response]                       │
│ • Dispatched: 1 team (Rescue)                         │
│ • Status: On scene, evacuating 5 families              │
│ • Resources: 1 rescue truck, 1 ambulance              │
│                                                        │
│ [Provincial Coordination]                             │
│ • Mutual aid requested: Labo → Daet                   │
│ • Status: ✅ Approved (1 additional team en route)     │
│ • Provincial resources: None deployed yet              │
│                                                        │
│ [Coordination Tools]                                   │
│ [Message both Municipal Admins]                        │
│ [Deploy provincial resources]                          │
│ [View on map]                                         │
└────────────────────────────────────────────────────────┘
```

**Coordination Focus (Not Command):**
- Superadmin can see both municipalities' responses
- Superadmin can facilitate mutual aid requests
- Superadmin can deploy provincial resources
- Superadmin CANNOT directly dispatch municipal responders
- Superadmin CANNOT override Municipal Admin decisions
- Superadmin provides coordination, not command

**Mutual Aid Request Tracking (Gap #21):**
```
When Municipality A requests help from Municipality B:
┌────────────────────────────────────────────────────────┐
│ Mutual Aid Request #MA-0471                           │
│                                                        │
│ From: Daet (Municipal Admin A)                        │
│ To: Labo (Municipal Admin B)                          │
│                                                        │
│ Request:                                              │
│ "Need 1 additional rescue team for flood response.    │
│  Our 2 teams are at capacity. Urgent."                │
│                                                        │
│ Status: ⏳ Awaiting Labo response                     │
│                                                        │
│ [Superadmin Actions]                                   │
│ ✅ Approve request (notify Labo)                       │
│ ❌ Deny request (provide reason)                       │
│ 📞 Contact both admins to discuss                     │
│                                                        │
│ [History]                                              │
│ 14:32 - Daet requested mutual aid                     │
│ 14:35 - Superadmin notified                           │
│ ⏳ Awaiting Labo response                             │
└────────────────────────────────────────────────────────┘
```

**Province-Wide Alert Targeting (Gap #26):**
```
Send alerts to specific municipalities or entire province:
┌────────────────────────────────────────────────────────┐
│ Send Provincial Alert                                 │
│                                                        │
│ Target audience:                                      │
│ ○ All municipalities (entire province)                │
│ ○ Specific municipalities:                            │
│   [☑] Daet  [☑] Labo  [☑] Basud  [☑] Capalonga       │
│   [☐] Jose Panganiban  [☐] Mercedes  [☐] Paracale     │
│   [☐] San Lorenzo Ruiz  [☐] San Vicente               │
│   [☐] Santa Elena  [☐] Talisay  [☐] Vinzons          │
│                                                        │
│ Alert type:                                           │
│ ○ Evacuation warning                                  │
│ ○ Severe weather alert                                │
│ ○ Flood warning                                       │
│ ○ Landslide alert                                     │
│ ○ Other: [___________]                                │
│                                                        │
│ Message:                                              │
│ [_____________________________________________]       │
│ [_____________________________________________]       │
│                                                        │
│ Priority:                                             │
│ ○ Emergency (immediate action required)               │
│ ○ Warning (prepare for possible impact)               │
│ ○ Advisory (informational)                            │
│                                                        │
│ [Preview]  [Send Alert]  [Cancel]                     │
└────────────────────────────────────────────────────────┘
```

**Escalation Notification (Gap #29):**
```
Auto-notify superadmin when Municipal Admin escalates:
┌────────────────────────────────────────────────────────┐
│ 🔔 ESCALATION REQUEST                                 │
│                                                        │
│ From: Daet Municipal Admin                            │
│ Time: 2026-04-10 14:32                                │
│                                                        │
│ Incident: #0471 - Flood (High severity)               │
│                                                        │
│ Reason for escalation:                                │
│ "Incident beyond municipal capacity. Need provincial  │
│  resources (helicopter evacuation). 5 families trapped│
│  by rising floodwaters."                              │
│                                                        │
│ [Superadmin Actions]                                   │
│ [View incident details]                               │
│ [Deploy provincial resources]                         │
│ [Contact Municipal Admin]                             │
│ [Approve escalation request]                          │
│ [Deny with reason]                                    │
└────────────────────────────────────────────────────────┘
```

**Resource Sharing Dashboard (Gap #23):**
```
Real-time view of shared resources between municipalities:
┌────────────────────────────────────────────────────────┐
│ Provincial Resource Sharing Status                    │
├──────────────┬──────────┬──────────┬──────────────────┤
│Resource      │From      │To        │Status           │
├──────────────┼──────────┼──────────┼──────────────────┤
│Rescue Team A │Labo      │Daet      │En route (10 min) │
│Ambulance 1   │Basud     │Daet      │On scene         │
│Boat 2        │Mercedes  │Daet      │Available        │
└──────────────┴──────────┴──────────┴──────────────────┘

[Map View: Show all shared resources moving between municipalities]
```

---

### 5. Provincial Resource Management 🔴 CRITICAL

**Purpose:** Inventory and deployment of provincial assets

**Provincial Resource Inventory (Gap #47):**
```
Centralized inventory of all provincial assets:
┌────────────────────────────────────────────────────────┐
│ Provincial Resources Inventory                        │
├──────────────┬──────────┬──────────┬─────────┬────────┤
│Resource      │Type      │Location  │Status   │Action  │
├──────────────┼──────────┼──────────┼─────────┼────────┤
│Helicopter 1  │Aviation  │Daet Air  │Available│[Deploy]│
│              │          │Port      │         │        │
│Helicopter 2  │Aviation  │Daet Air  │Deployed │[Recall]│
│              │          │Port      │to Labo  │        │
│Heavy Equipment│Equipment│Basud     │Maintenance│[Edit]│
│Truck 1       │          │Depot     │(2 days) │        │
│Mobile Team A │Personnel │PDRRMO    │Available│[Deploy]│
│              │          │HQ        │         │        │
│Mobile Team B │Personnel │PDRRMO    │Deployed │[Recall]│
│              │          │HQ        │to Daet  │        │
└──────────────┴──────────┴──────────┴─────────┴────────┘
```

**Direct Deployment Authority:**
- Superadmin can deploy provincial resources **without** Municipal Admin request
- Deployment does not require municipal approval
- Superadmin has full authority to allocate provincial assets

**Resource Deployment Tracking (Gap #48):**
```
Real-time tracking of deployed assets:
┌────────────────────────────────────────────────────────┐
│ Deployment: Helicopter 2                              │
│                                                        │
│ Deployed to: Labo (Incident #0471)                    │
│ Deployed by: Superadmin A                             │
│ Deployed at: 2026-04-10 14:32                        │
│                                                        │
│ Current Status:                                       │
│ • Location: En route to Labo                          │
│ • ETA: 15 minutes                                     │
│ • Mission: Evacuation of 5 families                   │
│ • Crew: Pilot, Co-pilot, 2 rescuers                   │
│                                                        │
│ Tracking:                                             │
│ [📍 Live GPS tracking on map]                         │
│ • Last update: 2 minutes ago                          │
│ • Altitude: 1,500 ft                                  │
│ • Speed: 120 knots                                    │
│                                                        │
│ Mission Log:                                          │
│ 14:32 - Deployed from Daet Air Port                   │
│ 14:35 - En route to Labo                              │
│ ⏳ ETA 14:47 - Expected arrival                       │
│                                                        │
│ [Recall]  [Update Mission]  [Contact Crew]            │
└────────────────────────────────────────────────────────┘
```

**Provincial Resource Scheduling (Gap #42):**
```
Calendar/schedule for provincial assets:
┌────────────────────────────────────────────────────────┐
│ Resource Schedule: Helicopter 1                       │
│                                                        │
│ [📅 Calendar View]                                    │
│                                                        │
│ 2026-04-10 (Today):                                   │
│ • 08:00-12:00: Training exercise (Daet)               │
│ • 14:00-16:00: Available                              │
│ • 16:00-18:00: Scheduled maintenance                  │
│                                                        │
│ 2026-04-11 (Tomorrow):                                │
│ • 08:00-12:00: Available                              │
│ • 12:00-14:00: Reserved for Basud emergency drill     │
│ • 14:00-18:00: Available                              │
│                                                        │
│ [Add Schedule]  [View All Resources]                  │
└────────────────────────────────────────────────────────┘
```

---

### 6. Emergency Declaration & EOC Activation 🔴 CRITICAL

**Purpose:** Declare provincial emergencies and activate Emergency Operations Center

**Emergency Declaration Workflow (Gap #38):**
```
Provincial emergency declaration (sole superadmin authority):
┌────────────────────────────────────────────────────────┐
│ Declare Provincial Emergency                          │
│                                                        │
⚠️ WARNING: This is a serious action with legal and   │
│ financial implications. Ensure all criteria are met.  │
│                                                        │
│ Emergency Type:                                       │
│ ○ Flood                                               │
│ ○ Typhoon                                             │
│ ○ Landslide                                           │
│ ○ Fire (urban/wildland)                              │
│ ○ Earthquake                                          │
│ ○ Public Health Emergency                             │
│ ○ Other: [___________]                                │
│                                                        │
│ Affected Municipalities (select all that apply):      │
│ [☐] All municipalities (entire province)              │
│ [☑] Daet  [☑] Labo  [☑] Basud  [☐] Capalonga        │
│ [☐] Jose Panganiban  [☐] Mercedes  [☐] Paracale     │
│ [☐] San Lorenzo Ruiz  [☐] San Vicente                │
│ [☐] Santa Elena  [☐] Talisay  [☐] Vinzons          │
│                                                        │
│ Severity Level:                                       │
│ ○ Level 1 (Preparedness - monitor situation)          │
│ ○ Level 2 (Alert - ready to respond)                  │
│ ○ Level 3 (Response - deploying resources)            │
│ ○ Level 4 (Crisis - full emergency response)          │
│                                                        │
│ Justification (required):                             │
│ [_____________________________________________]       │
│ [_____________________________________________]       │
│ [_____________________________________________]       │
│                                                        │
│ Duration:                                             │
│ [ ] Initial 24 hours  [ ] Extendable                 │
│ Expiry: 2026-04-11 14:32                              │
│                                                        │
│ Checklist before declaring:                           │
│ [ ] Verified all affected municipalities             │
│ [ ] Confirmed resource availability                   │
│ [ ] Notified governor's office                       │
│ [ ] Prepared public announcement                     │
│ [ ] Activated EOC (if Level 3 or 4)                  │
│                                                        │
│ [Cancel]  [Preview Declaration]  [Declare Emergency]  │
└────────────────────────────────────────────────────────┘
```

**After Declaration:**
```
Emergency declared successfully:
┌────────────────────────────────────────────────────────┐
│ ✅ Provincial Emergency Declared                      │
│                                                        │
│ Emergency ID: EMERG-2026-0410-001                     │
│ Type: Flood                                           │
│ Severity: Level 3 (Response)                          │
│ Affected: Daet, Labo, Basud                           │
│ Declared by: Superadmin A                              │
│ Declared at: 2026-04-10 14:32                         │
│ Expires: 2026-04-11 14:32 (24 hours)                  │
│                                                        │
│ Automatic actions taken:                               │
│ ✅ All Municipal Admins notified                      │
│ ✅ Public alert sent to affected municipalities       │
│ ✅ PDRRMO EOC activated (if Level 3+)                 │
│ ✅ Governor's office notified                         │
│ ✅ Incident log created                               │
│                                                        │
│ [View Details]  [Extend Emergency]  [Cancel Emergency] │
│ [Send Public Announcement]  [Deploy Resources]        │
└────────────────────────────────────────────────────────┘
```

**Provincial EOC Activation (Gap #40):**
```
Activate Emergency Operations Center:
┌────────────────────────────────────────────────────────┐
│ Activate PDRRMO Emergency Operations Center          │
│                                                        │
│ EOC Location: PDRRMO Office, Daet                     │
│                                                        │
│ Activation Level:                                     │
│ ○ Level 1 (Monitoring - core staff only)              │
│ ○ Level 2 (Partial activation - key personnel)        │
│ ○ Level 3 (Full activation - all staff)               │
│ ○ Level 4 (24/7 operations - continuous)              │
│                                                        │
│ Staff to Notify:                                      │
│ [☑] PDRRMO Head                                       │
│ [☑] Operations Chief                                  │
│ [☑] Planning Chief                                    │
│ [☑] Logistics Chief                                   │
│ [☑] Finance/Admin Chief                               │
│ [☐] Communications Officer                            │
│ [☐] Liaison Officers (per municipality)              │
│                                                        │
│ Activation Checklist:                                 │
│ [ ] EOC facility ready (power, water, comms)          │
│ [ ] Communication systems tested                      │
│ [ ] Display maps and dashboards set up                │
│ [ ] Incident tracking system initialized              │
│ [ ] All notified staff confirmed availability         │
│ [ ] Shift schedule posted (24/7 if Level 4)           │
│ [ ] Press briefing room prepared                      │
│                                                        │
│ [Activate EOC]  [Cancel]                              │
└────────────────────────────────────────────────────────┘
```

**After EOC Activation:**
```
EOC Status Dashboard:
┌────────────────────────────────────────────────────────┐
│ PDRRMO EOC - ACTIVE                                   │
│ Activated: 2026-04-10 14:32                          │
│ Level: 3 (Full activation)                            │
│ Incident: Flood - Daet, Labo, Basud                   │
│                                                        │
│ Active Staff:                                         │
│ ✅ PDRRMO Head (on-site)                              │
│ ✅ Operations Chief (on-site)                         │
│ ✅ Planning Chief (on-site)                           │
│ ✅ Logistics Chief (on-site)                          │
│ ⏳ Finance/Admin Chief (en route, ETA 10 min)         │
│ ❌ Communications Officer (notified, pending)         │
│                                                        │
│ EOC Systems:                                          │
│ ✅ Analytics dashboard active                         │
│ ✅ Provincial map active                              │
│ ✅ Communication channels open                        │
│ ✅ Incident tracking initialized                      │
│                                                        │
│ Current Operations:                                   │
│ • Monitoring 3 active incidents                       │
│ • Coordinating 2 mutual aid requests                  │
│ • Managing 5 provincial resource deployments         │
│                                                        │
│ [Deactivate EOC]  [View Full Status]  [Contact Staff]│
└────────────────────────────────────────────────────────┘
```

**Crisis Communication Tools (Gap #43):**
```
Template library for crisis communications:
┌────────────────────────────────────────────────────────┐
│ Crisis Communications                                 │
│                                                        │
│ [Select Template]                                     │
│ ○ Evacuation Order                                    │
│ ○ Flood Warning                                       │
│ ○ Typhoon Warning                                     │
│ ○ Landslide Alert                                     │
│ ○ Fire Warning                                        │
│ ○ Public Health Emergency                             │
│ ○ Custom Message                                      │
│                                                        │
│ [Template: Evacuation Order]                          │
│                                                        │
│ Target:                                               │
│ ○ All municipalities                                  │
│ ○ Specific: [☑] Daet  [☑] Labo  [☑] Basud           │
│                                                        │
│ Message (editable template):                          │
│ ⚠️ EVACUATION ORDER - IMMEDIATE                       │
│                                                        │
│ To: All residents in [Daet, Labo, Basud]              │
│                                                        │
│ Due to [severe flooding], you are ordered to evacuate │
│ immediately.                                           │
│                                                        │
│ Evacuation Centers:                                    │
│ • [Daet Central School]                               │
│ • [Labo Municipal Hall]                               │
│ • [Basud gymnasium]                                   │
│                                                        │
│ Bring:                                                 │
│ • Important documents (IDs, medicine)                 │
│ • Emergency kit (food, water, flashlight)             │
│ • Clothing for 3 days                                 │
│                                                        │
│ Do NOT bring:                                         │
│ • Large appliances                                    │
│ • Pets (unless service animal)                        │
│                                                        │
│ Depart immediately. Follow designated routes.         │
│                                                        │
│ Issued by: PDRRMO Camarines Norte                     │
│ Date/Time: 2026-04-10 14:32                           │
│                                                        │
│ [Preview]  [Send to All Channels]  [Save as Draft]    │
└────────────────────────────────────────────────────────┘
```

**After-Action Report Generation (Gap #44):**
```
Post-disaster report generator:
┌────────────────────────────────────────────────────────┐
│ After-Action Report Generator                          │
│                                                        │
│ Select Incident: [EMERG-2026-0410-001 ▼]             │
│                                                        │
│ Report Type:                                          │
│ ○ Full After-Action Report (all sections)             │
│ ○ Executive Summary (key findings only)               │
│ ○ Municipal Performance Comparison                     │
│ ○ Resource Utilization Report                         │
│ ○ Lessons Learned                                     │
│                                                        │
│ Date Range:                                           │
│ From: 2026-04-10 00:00                                │
│ To: 2026-04-10 23:59                                  │
│                                                        │
│ Include:                                              │
│ [☑] Incident timeline                                 │
│ [☑] Municipal responses (all 12 municipalities)       │
│ [☑] Resource deployments (provincial + mutual aid)    │
│ [☑] Performance metrics (response times, resolution)  │
│ [☑] Financial summary (costs incurred)               │
│ [☑] Citizen impact (affected population, evacuees)   │
│ [☑] Recommendations for improvement                  │
│                                                        │
│ [Generate Report]  [Schedule Recurring]  [Cancel]     │
└────────────────────────────────────────────────────────┘
```

---

### 7. Data Privacy & Retention (6-Month Policy) 🔴 CRITICAL

**Purpose:** GDPR compliance, data privacy, automated archival

**Data Retention Policy (Gap #53):**
```
Automated data archival after 6 months:
┌────────────────────────────────────────────────────────┐
│ Data Retention Policy                                  │
│                                                        │
│ Policy: All citizen reports are automatically archived │
│ after 6 months.                                       │
│                                                        │
│ Archive Process:                                      │
│ 1. Reports older than 6 months are moved from:        │
│    • reports → reports_archive                       │
│    • report_private → report_private_archive          │
│    • report_ops → report_ops_archive                  │
│                                                        │
│ 2. Archived data:                                     │
│    • Still accessible to superadmins (search)          │
│    • NOT accessible to Municipal Admins               │
│    • NOT accessible to citizens                        │
│    • Stored for compliance and audit purposes          │
│                                                        │
│ 3. Deletion Process:                                   │
│    • Archived reports permanently deleted after:       │
│      [ 12 months ]  (configurable)                    │
│    • Cannot be recovered after deletion                │
│    • Audit trail preserved (who deleted what, when)    │
│                                                        │
│ Compliance:                                           │
│ ✅ GDPR right to be forgotten (6-month retention)      │
│ ✅ Automated archival (no manual intervention)         │
│ ✅ Secure deletion (data wiped from all backups)       │
│ ✅ Audit trail preserved (who accessed what, when)     │
│                                                        │
│ Next scheduled archival: 2026-04-15 (23 reports)       │
│ Next scheduled deletion: 2026-10-10 (156 reports)      │
│                                                        │
│ [View Archive]  [Configure Policy]  [Export Audit Log] │
└────────────────────────────────────────────────────────┘
```

**PII Export/Download Logging (Gap #54):**
```
Audit log for all PII exports/downloads (user decision: export logging only):
┌────────────────────────────────────────────────────────┐
│ PII Access Audit Log (Exports Only)                   │
│                                                        │
│ Policy: Only log when superadmin EXPORTS or DOWNLOADS │
│ citizen data. Regular viewing is NOT logged.           │
│                                                        │
│ Recent Exports:                                       │
├────────────┬──────────┬──────────┬──────────────────┤
│Timestamp   │User      │Action    │Details          │
├────────────┼──────────┼──────────┼──────────────────┤
│2026-04-10  │Superadmin│Export    │Downloaded 45   │
│14:32:15    │A         │to Excel  │reports to CSV  │
│            │          │          │(PII included)  │
│2026-04-10  │Superadmin│Export    │Generated PDF   │
│12:15:33    │B         │to PDF    │situation report │
│            │          │          │(anonymized)     │
│2026-04-09  │Superadmin│Export    │Downloaded 12  │
│16:45:22    │A         │to Excel  │citizen profiles │
│            │          │          │(PII included)   │
└────────────┴──────────┴──────────┴──────────────────┘

[Export All Logs]  [Search by User]  [Filter by Date Range]
```

**Data Anonymization for Reports (Gap #55):**
```
Auto-anonymize public/shared reports:
┌────────────────────────────────────────────────────────┐
│ Data Anonymization Settings                           │
│                                                        │
│ Public Feed (citizens see):                           │
│ [☑] Hide citizen names (show "Anonymous")             │
│ [☑] Hide exact addresses (show barangay only)         │
│ [☑] Hide contact info (phone, email)                  │
│ [☑] Blur faces in photos (automatic)                  │
│ [☑] Remove geotag from photos                        │
│                                                        │
│ Shared Reports (Municipal Admins see):                │
│ [☑] Show citizen names (for verification)             │
│ [☑] Show contact info (for follow-up)                 │
│ [☑] Show exact location (for dispatch)                │
│ [☐] Blur faces in photos (optional)                   │
│                                                        │
│ Provincial Reports (superadmins see):                 │
│ [☑] Show all data (no anonymization)                  │
│ [☑] Show PII (names, contacts, addresses)             │
│ [☑] Show exact locations (coordinates)                │
│ [☑] Include audit trail (who accessed what)           │
│                                                        │
│ [Save Settings]  [Preview Public View]                │
└────────────────────────────────────────────────────────┘
```

**Data Deletion Workflow (Gap #57):**
```
GDPR right to be forgotten - secure deletion:
┌────────────────────────────────────────────────────────┐
│ Data Deletion Request                                 │
│                                                        │
│ Citizen requested deletion of their data.             │
│                                                        │
│ Request Details:                                      │
│ Citizen: Juan Dela Cruz                                │
│ Email: juan@example.com                                │
| UID: citizen-12345                                     │
│ Request Date: 2026-04-10                               │
│ Reason: GDPR right to be forgotten                     │
│                                                        │
│ Reports to Delete:                                     │
│ • Report #0471 (2026-03-15) - Flood                   │
│ • Report #0456 (2026-02-20) - Landslide               │
│ • Report #0432 (2026-01-10) - Fire                    │
│                                                        │
⚠️ WARNING: This action CANNOT be undone.               │
│ All reports will be permanently deleted from:         │
│ • reports                                             │
│ • report_private                                      │
│ • report_ops                                          │
│ • All backups                                         │
│                                                        │
│ Exception (if applicable):                             │
│ [ ] Keep if incident is active (legal hold)           │
│ [ ] Keep if report is evidence in investigation       │
│ [ ] Delete immediately (citizen right)                │
│                                                        │
│ [Approve Deletion]  [Deny with Reason]  [Put on Hold] │
│                                                        │
│ After deletion:                                        │
│ ✅ Audit log entry created (who deleted what, when)    │
│ ✅ Citizen notified of deletion confirmation          │
│ ✅ All data wiped from all systems                    │
└────────────────────────────────────────────────────────┘
```

---

### 8. System Health Monitoring (Real-Time) 🔴 CRITICAL

**Purpose:** Real-time dashboard showing system status

**System Health Dashboard (Gap #72):**
```
Real-time always-on dashboard (user decision):
┌────────────────────────────────────────────────────────┐
│ System Health Monitoring (Real-Time)                  │
│                                                        │
│ [Overall Status: 🟢 All Systems Operational]          │
│ Updated: 5 seconds ago                                │
│                                                        │
│ Firebase Services:                                    │
│ ┌────────────────┬──────────┬──────────┬─────────────┐ │
│ │Service         │Status    │Latency   │Last Check   │ │
│ ├────────────────┼──────────┼──────────┼─────────────┤ │
│ │Firestore       │🟢 OK     │45ms      │5 sec ago    │ │
│ │Authentication  │🟢 OK     │120ms     │5 sec ago    │ │
│ │Storage         │🟢 OK     │89ms      │5 sec ago    │ │
│ │Hosting         │🟢 OK     │32ms      │5 sec ago    │ │
│ │Cloud Functions │🟢 OK     │N/A      │5 sec ago    │ │
│ └────────────────┴──────────┴──────────┴─────────────┘ │
│                                                        │
│ Database Performance:                                  │
│ ┌────────────────┬──────────┬──────────┬─────────────┐ │
│ │Metric          │Value     │Threshold│Status       │ │
│ ├────────────────┼──────────┼──────────┼─────────────┤ │
│ │Read operations │1,245/min │< 5,000  │🟢 OK        │ │
│ │Write operations│89/min    │< 500    │🟢 OK        │ │
│ │Query latency   │45ms      │< 100ms  │🟢 OK        │ │
│ │Storage used    │12.3 GB   │< 50 GB  │🟢 OK        │ │
│ └────────────────┴──────────┴──────────┴─────────────┘ │
│                                                        │
│ Active Users:                                          │
│ • Citizens: 1,245 online                               │
│ • Responders: 156 online                               │
│ • Municipal Admins: 12 online                          │
│ • Provincial Superadmins: 2 online                     │
│                                                        │
│ Error Rate (Last 1 hour):                              │
│ • Errors: 0                                            │
│ • Total requests: 45,678                               │
│ • Error rate: 0.00% ✅                                 │
│                                                        │
│ Uptime (Last 30 days): 99.98% ✅                       │
│                                                        │
│ [View Detailed Metrics]  [Download Report]             │
└────────────────────────────────────────────────────────┘
```

**Performance Degradation Alerts (Gap #73):**
```
Automated alerts when system slows down (standard thresholds):
┌────────────────────────────────────────────────────────┐
│ ⚠️ PERFORMANCE ALERT                                  │
│                                                        │
│ Alert: Firestore query latency degraded                │
│ Time: 2026-04-10 14:32                                │
│                                                        │
│ Current Status:                                       │
│ • Query latency: 450ms (threshold: < 100ms) ❌         │
│ • Error rate: 2.3% (threshold: < 1%) ❌               │
│ • Duration: 5 minutes                                 │
│                                                        │
│ Possible Causes:                                      │
│ • Surge in user activity (2x normal)                  │
│ • Complex query running (full table scan)             │
│ • Network issue (Firebase <-> Philippines)             │
│                                                        │
│ [Superadmin Actions]                                   │
│ [View detailed metrics]                               │
│ [Check active queries]                                │
│ [Restart Cloud Functions]                             │
│ [Contact Firebase support]                            │
│ [Acknowledge alert]                                   │
└────────────────────────────────────────────────────────┘
```

**Disaster Recovery Procedures (Gap #68):**
```
Failover to backup system, data restoration:
┌────────────────────────────────────────────────────────┐
│ Disaster Recovery Procedures                          │
│                                                        │
│ System Status: 🔴 CRITICAL FAILURE                     │
│                                                        │
│ Failure Details:                                      │
│ • Service: Firestore                                  │
│ • Type: Regional outage (Asia-Pacific)                │
│ • Started: 2026-04-10 14:25                           │
│ • Duration: 7 minutes (ongoing)                       │
│                                                        │
│ Impact:                                               │
│ ❌ Citizens cannot submit reports                     │
│ ❌ Responders cannot update status                    │
| ❌ Municipal Admins cannot dispatch                   │
│ ⚠️  Superadmins READ-ONLY access to cached data       │
│                                                        │
│ Recovery Actions:                                     │
│ [ ] Activate backup system (failover to multi-region) │
│ [ ] Switch to read-only mode (preserve data integrity)│
│ [ ] Notify all users (system announcement)            │
│ [ ] Monitor Firebase status page                      │
│ [ ] Prepare for data restoration (when service returns)│
│ [ ] Test all systems after recovery                   │
│                                                        │
│ Current Status:                                       │
│ ⏳ Waiting for Firebase recovery...                  │
│ Estimated recovery: 15-30 minutes (per Firebase)      │
│                                                        │
│ [Execute Failover]  [Contact Support]  [View Status]  │
└────────────────────────────────────────────────────────┘
```

---

### 9. Configuration & System Settings 🟡 HIGH

**Purpose:** Configure system-wide settings and policies

**Incident Type Configuration (Gap #31):**
```
Admin panel to create/modify incident types:
┌────────────────────────────────────────────────────────┐
│ Incident Type Configuration                           │
│                                                        │
│ Existing Incident Types:                              │
│ ┌────────────────────────────────────────────────────┐│
│ │Flood                                               ││
│ │Severity levels: Low, Medium, High                  ││
│ │Default severity: Medium                            ││
│ │Responder types: Fire, Rescue, Engineering           ││
│ │[Edit]  [Delete]                                    ││
│ ├────────────────────────────────────────────────────┤│
│ │Fire                                                ││
│ │Severity levels: Low, Medium, High, Critical        ││
│ │Default severity: High                              ││
│ │Responder types: Fire, Police, Medical, Engineering  ││
│ │[Edit]  [Delete]                                    ││
│ ├────────────────────────────────────────────────────┤│
│ │Landslide                                           ││
│ │Severity levels: Low, Medium, High                  ││
│ │Default severity: High                              ││
│ │Responder types: Rescue, Engineering, Medical        ││
│ │[Edit]  [Delete]                                    ││
│ └────────────────────────────────────────────────────┘│
│                                                        │
│ [+ Add New Incident Type]                             │
│                                                        │
│ [Add New Incident Type]                               │
│ ┌────────────────────────────────────────────────────┐│
│ │Name: [___________]                                 ││
│ │Description: [_________________________]            ││
│ │                                                     ││
│ │Severity Levels:                                    ││
│ │[☑] Low  [☑] Medium  [☑] High  [☐] Critical        ││
│ │                                                     ││
│ │Default Severity: [Medium ▼]                        ││
│ │                                                     ││
│ │Required Responder Types:                           ││
│ │[☑] Fire  [☑] Police  [☐] Medical  [☑] Rescue     ││
│ │[☐] Engineering  [☐] Social Welfare  [☐] General   ││
│ │                                                     ││
│ │[Save]  [Cancel]                                    ││
│ └────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────┘
```

**Severity Threshold Configuration (Gap #32):**
```
Configurable severity rules (what makes an incident "High" severity):
┌────────────────────────────────────────────────────────┐
│ Severity Threshold Configuration                      │
│                                                        │
│ Define automatic severity assignment based on citizen │
│ answers during report submission:                     │
│                                                        │
│ Incident Type: [Flood ▼]                              │
│                                                        │
│ HIGH Severity Criteria:                               │
│ [☑] Water depth > 1 meter                            │
│ [☑] People affected > 10                              │
│ [☑] Injuries reported (any)                           │
│ [☑] Evacuation required                               │
│ [☐] Roads impassable                                  │
│ [☐] Structures damaged                                │
│                                                        │
│ MEDIUM Severity Criteria:                             │
│ [☑] Water depth > 0.5 meters                         │
│ [☑] People affected 1-10                              │
│ [☐] Injuries reported                                 │
│ [☐] Evacuation required                              │
│ [☐] Roads affected                                    │
│                                                        │
│ LOW Severity Criteria (Default):                      │
│ All other reports (citizen safety concern, minor)     │
│                                                        │
│ [Save Configuration]  [Reset to Defaults]             │
└────────────────────────────────────────────────────────┘
```

**Alert Template Management (Gap #33):**
```
Template library for common alerts:
┌────────────────────────────────────────────────────────┐
│ Alert Template Library                                │
│                                                        │
│ Existing Templates:                                   │
│ ┌────────────────────────────────────────────────────┐│
│ │🌀 Typhoon Warning                                  ││
│ │   Used for: Severe weather alerts                 ││
│ │   Target: Citizens in affected municipalities     ││
│ │   Last used: 2026-04-05                           ││
│ │   [Edit]  [Preview]  [Delete]                     ││
│ ├────────────────────────────────────────────────────┤│
│ │🌊 Flood Warning                                    ││
│ │   Used for: Flash flood warnings                  ││
│ │   Target: Citizens in affected areas              ││
│ │   Last used: 2026-03-28                           ││
│ │   [Edit]  [Preview]  [Delete]                     ││
│ ├────────────────────────────────────────────────────┤│
│ │🏔️ Landslide Alert                                 ││
│ │   Used for: Landslide risk warnings               ││
│ │   Target: Citizens in high-risk areas             ││
│ │   Last used: 2026-03-15                           ││
│ │   [Edit]  [Preview]  [Delete]                     ││
│ ├────────────────────────────────────────────────────┤│
│ │🔥 Fire Alert                                       ││
│ │   Used for: Fire warnings (urban/wildland)        ││
│ │   Target: Citizens in affected areas              ││
│ │   Last used: 2026-02-20                           ││
│ │   [Edit]  [Preview]  [Delete]                     ││
│ └────────────────────────────────────────────────────┘│
│                                                        │
│ [+ Create New Template]                               │
└────────────────────────────────────────────────────────┘
```

**Escalation Rule Configuration (Gap #35):**
```
Configurable auto-escalation rules:
┌────────────────────────────────────────────────────────┐
│ Escalation Rule Configuration                         │
│                                                        │
│ Automatically notify Provincial Superadmin when:       │
│                                                        │
│ [☑] Municipal Admin escalates incident               │
│ [☑] Incident severity is Critical                     │
│ [☑] Multiple municipalities affected (>1)             │
│ [☑] Response time exceeds 30 minutes                  │
│ [☑] Municipal resources exhausted (0 responders available)│
│ [☐] Citizen requests escalation (via app)             │
│ [☐] Incident unresolved after 2 hours                 │
│                                                        │
│ Notification Method:                                  │
│ [☑] In-app notification (immediate)                   │
│ [☑] SMS alert (immediate)                             │
│ [☐] Email summary (hourly digest)                     │
│                                                        │
│ [Save Configuration]  [Test Escalation]                │
└────────────────────────────────────────────────────────┘
```

**Configuration Change Audit (Gap #37):**
```
Audit log for all system changes:
┌────────────────────────────────────────────────────────┐
│ Configuration Audit Log                               │
│                                                        │
├────────────┬──────────┬──────────┬────────────────────┤
│Timestamp   │User      │Setting   │Change             │
├────────────┼──────────┼──────────┼────────────────────┤
│2026-04-10  │Superadmin│Severity  │Added "Injuries"   │
│14:32:15    │A         │threshold │as HIGH criterion │
│            │          │for Flood  │                  │
│2026-04-10  │Superadmin│Alert     │Created new       │
│12:15:33    │B         │templates │"Tsunami Warning" │
│            │          │          │template           │
│2026-04-09  │Superadmin│Incident  │Added "Chemical    │
│16:45:22    │A         │types     │Spill" type        │
│            │          │          │                  │
└────────────┴──────────┴──────────┴────────────────────┘

[Export All Logs]  [Search by User]  [Filter by Setting]
```

---

### 10. Export & Reporting Tools 🟡 HIGH

**Purpose:** Generate and export reports for officials

**Automated Situation Reports (Gap #3):**
```
One-click report generation:
┌────────────────────────────────────────────────────────┐
│ Generate Situation Report                             │
│                                                        │
│ Report Type:                                          │
│ ○ Daily Situation Report (DSR)                       │
│ ○ Weekly Summary                                      │
│ ○ Monthly Performance Report                         │
│ ○ Incident-Specific Report                           │
│ ○ Municipal Performance Comparison                   │
│ ○ Custom Report                                      │
│                                                        │
│ Date Range:                                           │
│ From: [2026-04-10 ▼]                                  │
│ To: [2026-04-10 ▼]                                    │
│                                                        │
│ Scope:                                                │
│ ○ Entire province                                     │
│ ○ Specific municipalities: [☑] Daet  [☑] Labo        │
│ ○ Specific incident: [Incident ID ▼]                  │
│                                                        │
│ Include:                                              │
│ [☑] Incident summary (count, types, severity)         │
│ [☑] Response metrics (avg time, resolution rate)      │
│ [☑] Municipal performance comparison                  │
│ [☑] Resource utilization (deployed, available)        │
│ [☑] Maps (incident locations, heat maps)              │
│ [☑] Photos (from verified reports)                    │
│ [☑] Recommendations (if applicable)                   │
│                                                        │
│ Output Format:                                         │
│ ○ PDF (formatted for printing)                       │
│ ○ Excel (for data analysis)                           │
│ ○ Word (editable document)                            │
│ ○ PowerPoint (presentation slides)                    │
│                                                        │
│ [Generate Report]  [Schedule Recurring]  [Cancel]     │
└────────────────────────────────────────────────────────┘
```

**Export to PDF/Excel (Gap #11):**
```
Export functionality for all reports:
┌────────────────────────────────────────────────────────┐
│ Export Options                                        │
│                                                        │
│ Current View: Municipal Performance Comparison        │
│                                                        │
│ Export Format:                                         │
│ ○ PDF (formatted, print-ready)                        │
│ ○ Excel (raw data, sortable)                          │
│ ○ CSV (for data analysis)                             │
│ ○ Image (PNG, for presentations)                      │
│                                                        │
│ Include:                                              │
│ [☑] All municipalities                               │
│ [☑] All metrics (response time, resolution, etc.)     │
│ [☑] Charts and graphs                                 │
│ [☑] Province-wide summary                             │
│ [☐] Raw data (for Excel/CSV only)                     │
│                                                        │
│ Filename: [Municipal_Performance_2026-04-10.pdf]     │
│                                                        │
│ [Export]  [Preview]  [Cancel]                         │
│                                                        │
│ [⚙️ Auto-export schedule:]                            │
│ • Daily DSR: 06:00 (email to Governor's office)       │
│ • Weekly summary: Every Monday 08:00                  │
│ • Monthly report: 1st of month 09:00                  │
└────────────────────────────────────────────────────────┘
```

**Historical Data Access (Gap #9):**
```
Date range filters for historical analysis:
┌────────────────────────────────────────────────────────┐
│ Historical Data Viewer                                │
│                                                        │
│ Date Range:                                           │
│ From: [2026-01-01 ▼]                                  │
│ To: [2026-04-10 ▼]                                     │
│                                                        │
│ Quick Select:                                         │
│ [Last 7 days]  [Last 30 days]  [Last 90 days]        │
│ [This quarter]  [This year]  [Custom range]           │
│                                                        │
│ Data Type:                                            │
│ ○ All incidents                                       │
│ ○ Verified reports only                               │
│ ○ Resolved incidents                                  │
│ ○ Active incidents                                    │
│ ○ Specific type: [Flood ▼]                           │
│                                                        │
│ Municipalities:                                       │
│ [☑] All  [☐] Daet  [☐] Labo  [☐] Basud ...           │
│                                                        │
│ View:                                                 │
│ ○ Timeline chart                                      │
│ ○ Municipal comparison table                         │
│ ○ Heat map                                            │
│ ○ Raw data table                                     │
│                                                        │
│ [Apply Filters]  [Export Data]  [Generate Report]     │
└────────────────────────────────────────────────────────┘
```

**Compliance Scorecards (Gap #7):**
```
Compliance monitoring for each municipality:
┌────────────────────────────────────────────────────────┐
│ Municipal Compliance Scorecard                        │
│                                                        │
│ Municipality: [Daet ▼]                                │
│ Period: Last 30 days                                  │
│                                                        │
│ Overall Score: 98% ✅ (Excellent)                     │
│                                                        │
│ Breakdown:                                            │
│ ┌──────────────────────┬──────────┬─────────┬─────────┐│
│ │Metric               │Score     │Target   │Status   ││
│ ├──────────────────────┼──────────┼─────────┼─────────┤│
│ │Protocol compliance   │95% ✅   │> 80%    │Pass     ││
│ │Reporting timeliness  │100% ✅  │> 90%    │Pass     ││
│ │Response time         │100% ✅  │< 15 min │Pass     ││
│ │Documentation         │98% ✅   │> 85%    │Pass     ││
│ │Resource utilization  │95% ✅   │60-85%   │Pass     ││
│ └──────────────────────┴──────────┴─────────┴─────────┘│
│                                                        │
│ Notes:                                                │
│ • Excellent performance across all metrics             │
│ • Best response time in province (8 min avg)           │
│ • 100% reporting timeliness (all reports on time)      │
│ • Minor protocol deviations (acceptable)               │
│                                                        │
│ [View Full Details]  [Export Scorecard]  [Compare All]│
└────────────────────────────────────────────────────────┘
```

---

### 11. Edge Cases & Special Scenarios 🟡 HIGH

**Purpose:** Handle unusual situations and edge cases

**Concurrent Login Handling (Gap #70):**
```
Prevent or detect multiple simultaneous logins:
┌────────────────────────────────────────────────────────┐
│ ⚠️ Concurrent Login Detected                          │
│                                                        │
│ Your account is already logged in on another device.  │
│                                                        │
│ Current Session:                                      │
│ • Device: Desktop (Chrome/Windows)                    │
│ • Location: Daet, Philippines                         │
│ • Login time: 2026-04-10 14:20                        │
│ • Last activity: 2 minutes ago                        │
│                                                        │
│ [Your Options]                                        │
│ • [Continue here] (log out other session)             │
│ • [Logout from this device]                           │
│ • [View all active sessions]                          │
│                                                        │
│ If you did not initiate this login, contact:          │
│ PDRRMO Office immediately (security concern)          │
└────────────────────────────────────────────────────────┘
```

**Bulk Operations (Gap #71):**
```
Bulk promote/demote, bulk deactivate:
┌────────────────────────────────────────────────────────┐
│ Bulk User Operations                                  │
│                                                        │
│ Operation: [Promote to Municipal Admin ▼]            │
│ Target Municipality: [Daet ▼]                         │
│                                                        │
│ Select Users:                                         │
│ [☑] juan@example.com (Juan Dela Cruz)                │
│ [☑] maria@example.com (Maria Santos)                  │
│ [☑] jose@example.com (Jose Reyes)                     │
│ [☐] ana@example.com (Ana Garcia)                      │
│                                                        │
│ Selected: 3 users                                     │
│                                                        │
│ [Select All 45]  [Clear Selection]                    │
│                                                        │
│ ⚠️ WARNING: This will promote ALL selected users to   │
│ Municipal Admin for Daet. Ensure you have selected   │
│ the correct users.                                    │
│                                                        │
│ [Preview Changes]  [Confirm Bulk Operation]  [Cancel] │
└────────────────────────────────────────────────────────┘
```

**Missed Escalation Alerts (Gap #62):**
```
Alerts when Municipal Admin doesn't respond to escalations:
┌────────────────────────────────────────────────────────┐
│ 🔴 URGENT: Escalation Unacknowledged                  │
│                                                        │
│ Escalation sent 30 minutes ago (SLA: 15 min)          │
│                                                        │
│ From: Superadmin A                                    │
│ To: Daet Municipal Admin                              │
│ Time: 2026-04-10 14:02                                │
│ Incident: #0471 - Flood (High severity)               │
│                                                        │
│ Status: ⏳ Awaiting acknowledgment                    │
│ Overdue by: 15 minutes                                │
│                                                        │
│ [Superadmin Actions]                                   │
│ [📞 Call Municipal Admin directly]                    │
│ [Send follow-up notification]                         │
│ [Escalate to Governor's office]                       │
│ [Dispatch provincial resources directly]              │
│ [Mark as urgent]                                      │
│                                                        │
│ [View Incident]  [Contact Admin]  [Dismiss Alert]     │
└────────────────────────────────────────────────────────┘
```

**Escalation SLA Tracking (Gap #61):**
```
Track time from request to response:
┌────────────────────────────────────────────────────────┐
│ Escalation SLA Tracking                               │
│                                                        │
│ Incident: #0471 - Flood (High severity)               │
│                                                        │
│ Timeline:                                             │
│ ┌──────────────┬──────────────┬─────────┬─────────────┐│
│ │Event        │Time          │SLA      │Status       ││
│ ├──────────────┼──────────────┼─────────┼─────────────┤│
│ │Incident     │2026-04-10    │N/A      │✅ On time   ││
│ │reported     │13:45         │         │             ││
│ │Municipal    │2026-04-10    │< 15 min │✅ Met (8min)││
│ │Admin        │13:53         │         │             ││
│ │acknowledged │              │         │             ││
│ │Escalation   │2026-04-10    │< 30 min │✅ Met (17min)│
│ │requested    │14:02         │         │             ││
│ │Superadmin   │2026-04-10    │< 15 min │⏳ Pending   ││
│ │response     │14:14         │         │(2 min)     ││
│ │Provincial   │2026-04-10    │< 60 min │⏳ Scheduled ││
│ │resource    │14:19         │         │(ETA 45min)  ││
│ │deployment   │              │         │             ││
│ └──────────────┴──────────────┴─────────┴─────────────┘│
│                                                        │
│ Overall SLA Compliance: 75% (3/4 met) ✅              │
│                                                        │
│ [View Full Timeline]  [Export Report]                 │
└────────────────────────────────────────────────────────┘
```

**Escalation Reminders (Gap #63):**
```
Auto-reminders if no response to escalations:
┌────────────────────────────────────────────────────────┐
│ Escalation Reminder System                            │
│                                                        │
│ Incident: #0471 - Flood                               │
│ Escalation sent to: Daet Municipal Admin              │
│ Time: 2026-04-10 14:02                                │
│                                                        │
│ Reminder Schedule:                                    │
│ • 1st reminder: 15 min overdue (14:17) ✅ Sent         │
│ • 2nd reminder: 30 min overdue (14:32) ⏳ Due now      │
│ • 3rd reminder: 45 min overdue (14:47) Scheduled       │
│ • Final alert: 60 min overdue (15:02) Scheduled        │
│                                                        │
│ Current Status:                                       │
│ ⏳ No response yet (30 minutes overdue)                │
│                                                        │
│ [Send Manual Reminder Now]                             │
│ [Call Municipal Admin]                                │
│ [Escalate to Governor's Office]                        │
│ [Take Direct Action]                                  │
└────────────────────────────────────────────────────────┘
```

**Role-Based UI Permissions (Gap #67):**
```
Hide/show features based on role:
┌────────────────────────────────────────────────────────┐
│ User Role Permissions                                 │
│                                                        │
│ User: Juan Dela Cruz                                  │
│ Current Role: Read-Only Superadmin                    │
│                                                        │
│ Permissions:                                          │
│                                                        │
│ [Analytics Dashboard]                                 │
│ ✅ View all metrics and charts                         │
│ ❌ Cannot edit configuration                           │
│ ❌ Cannot export data (requires approval)              │
│                                                        │
│ [User Management]                                     │
│ ✅ View all users                                      │
│ ❌ Cannot promote/demote users                        │
│ ❌ Cannot deactivate accounts                          │
│ ❌ Cannot bulk import                                  │
│                                                        │
│ [Emergency Declaration]                               │
│ ✅ View declared emergencies                           │
| ❌ Cannot declare new emergencies                      │
│ ❌ Cannot activate EOC                                 │
│                                                        │
│ [System Settings]                                     │
│ ✅ View all configuration                             │
│ ❌ Cannot modify settings                              │
│ ❌ Cannot change incident types                        │
│ ❌ Cannot update alert templates                       │
│                                                        │
│ [Export & Reports]                                    │
│ ✅ View reports                                       │
│ ⚠️  Export requires approval from Full Superadmin     │
│                                                        │
│ [Change Role]                                          │
│ Promote to: [Full Superadmin ▼]                       │
│ Requires: Approval from existing Full Superadmin       │
│                                                        │
│ [Request Permission Upgrade]  [Cancel]                 │
└────────────────────────────────────────────────────────┘
```

---

## Permissions & Access

### Provincial Superadmin Capabilities

**Full Access:**
| Action | Permission |
|--------|------------|
| View all reports | Entire province (all 12 municipalities) |
| View all incidents | Province-wide, all municipalities |
| View all responders | All responders in all municipalities |
| View all analytics | Province-wide + municipal comparisons |
| Generate reports | Situation, performance, compliance |
| Manage users | Promote/demote Municipal Admins, all user accounts |
| Assign Municipal Admins | Assign to specific municipalities |
| Configure system | System-wide settings, policies, templates |
| Deploy provincial resources | Helicopters, heavy equipment, mobile teams |
| Declare emergencies | Sole superadmin authority |
| Send provincial alerts | Warnings to all municipalities or entire province |
| Coordinate mutual aid | Resource sharing between municipalities |
| Access audit logs | Full system audit trail |
| Modify security rules | Update access control policies |
| Manage municipal boundaries | Configure map data and boundaries |
| Export data | All reports (PII logging on export only) |

**Restricted Access:**
| Action | Restriction |
|--------|-------------|
| Modify verified reports | ❌ Data integrity (public record) |
| Delete verified reports | ❌ Data integrity (public record) |
| Impersonate Municipal Admins | ❌ Audit trail preservation |
| Bypass municipal authority | ❌ Municipal admins have operational autonomy |
| Directly dispatch municipal responders | ❌ Operational control remains with Municipal Admins |
| Modify citizen reports | ❌ Preserve original report data |
| View private citizen data | ❌ Privacy protection (only necessary data for operations) |
| Access without authentication | ❌ Security (MFA mandatory) |

### Data Access Matrix

| Data Type | Citizens | Responders | Municipal Admins | Provincial Superadmins |
|-----------|----------|------------|------------------|----------------------|
| Public feed (approximate location) | ✅ | ❌ | ✅ | ✅ |
| Own reports (full details) | ✅ | N/A | N/A | N/A |
| Assigned incidents | N/A | ✅ (own only) | N/A | N/A |
| All reports in municipality | ❌ | ❌ | ✅ | ✅ |
| All reports in province | ❌ | ❌ | ❌ | ✅ |
| Responder status | ❌ | ✅ (self) | ✅ (municipality) | ✅ (province) |
| Analytics | ❌ | ❌ | ✅ (municipality) | ✅ (province) |
| User management | ❌ | ❌ | ❌ | ✅ |
| System configuration | ❌ | ❌ | ❌ | ✅ |
| Audit logs | ❌ | ❌ | ❌ | ✅ |
| Archived reports (> 6 months) | ❌ | ❌ | ❌ | ✅ |

---

## Technical Specifications

### MFA Implementation (Gap #64 - MANDATORY)

**Authentication Flow:**
```typescript
// Firebase Auth + Custom MFA
1. User enters email + password
2. Firebase Auth verifies credentials
3. Check if MFA enrolled:
   - If NO → Prompt to enroll (TOTP app, SMS, or hardware key)
   - If YES → Require second factor
4. User enters 6-digit TOTP code
5. Firebase Auth verifies TOTP
6. Custom claims set: { role: 'provincial_superadmin', mfa_verified: true }
7. Access granted to Provincial Superadmin dashboard
```

**Supported MFA Methods:**
- **TOTP Authenticator App** (Google Authenticator, Authy) - RECOMMENDED
- **SMS** (backup method)
- **Hardware Security Key** (YubiKey) - optional but supported

**MFA Enrollment:**
```
First-time setup:
┌────────────────────────────────────────────────────────┐
│ Set Up Multi-Factor Authentication                    │
│                                                        │
│ ⚠️ MFA is MANDATORY for all Provincial Superadmins    │
│                                                        │
│ Choose your preferred method:                         │
│                                                        │
│ ○ Authenticator App (RECOMMENDED)                     │
│   • Use Google Authenticator or Authy                 │
│   • Scan QR code with app                             │
│   • Enter 6-digit code to verify                      │
│   • Works offline, no phone signal required           │
│                                                        │
│ ○ SMS (Backup method)                                 │
│   • Receive codes via text message                    │
│   • Phone: [_______________]                          │
│   • Requires phone signal                             │
│                                                        │
│ ○ Hardware Security Key (Optional)                    │
│   • Use YubiKey or similar                            │
│   • Insert into USB port                              │
│   • Most secure method                                │
│                                                        │
│ [Continue]  [Cancel]                                   │
└────────────────────────────────────────────────────────┘
```

**MFA Recovery:**
```
If user loses access to MFA device:
┌────────────────────────────────────────────────────────┐
│ Account Recovery: MFA Lost                            │
│                                                        │
│ You've lost access to your MFA device. To recover     │
│ your account, contact:                                │
│                                                        │
│ PDRRMO Office:                                         │
│ • Phone: (054) 123-4567                               │
│ • Email: pdrmmo@camarinesnorte.gov.ph                  │
│ • In-person: PDRRMO Office, Daet                      │
│                                                        │
│ Recovery process:                                     │
│ 1. Verify your identity (phone call or in-person)      │
│ 2. Another superadmin confirms your identity           │
│ 3. Temporary recovery code issued (24 hours)          │
│ 4. Log in with recovery code                          │
│ 5. Re-enroll in MFA with new device                    │
│                                                        │
│ Recovery codes (print and store securely):             │
│ • Code 1: XXXX-XXXX-XXXX                               │
│ • Code 2: XXXX-XXXX-XXXX                               │
│ • Code 3: XXXX-XXXX-XXXX                               │
│ • Code 4: XXXX-XXXX-XXXX                               │
│ • Code 5: XXXX-XXXX-XXXX                               │
│                                                        │
│ [Print Recovery Codes]  [I Have Contacted Support]    │
└────────────────────────────────────────────────────────┘
```

### Session Management (Gap #65)

**Active Sessions Dashboard:**
```
View and manage all active sessions:
┌────────────────────────────────────────────────────────┐
│ Active Sessions: Superadmin A                         │
│                                                        │
│ Current Session:                                       │
│ • Device: Desktop (Chrome/Windows)                     │
│ • Location: Daet, Philippines                          │
│ • IP: 192.168.1.100                                   │
│ • Login time: 2026-04-10 14:32                         │
│ • Last activity: 30 seconds ago                        │
│ • Status: ✅ Active (this session)                     │
│                                                        │
│ Other Sessions:                                        │
│ ┌────────────────────────────────────────────────────┐│
│ │Device: Mobile (Safari/iPhone)                      ││
│ │Location: Daet, Philippines                         ││
│ │IP: 192.168.1.105                                   ││
│ │Login time: 2026-04-10 12:15                        ││
│ │Last activity: 2 hours ago                          ││
│ │Status: ⚠️ Idle (likely forgotten)                 ││
│ │[Revoke Session]                                    ││
│ └────────────────────────────────────────────────────┘│
│                                                        │
│ [Revoke All Other Sessions]  [Sign Out Everywhere]     │
└────────────────────────────────────────────────────────┘
```

**Session Security:**
- Maximum session duration: 8 hours
- Auto-logout after 30 minutes of inactivity
- Force logout on password change
- Force logout on MFA reset
- Detect and alert on suspicious activity (different IP, location)

### Real-Time Data Updates

**WebSocket/Firestore Listeners:**
```typescript
// Real-time updates for all dashboard metrics
const metricsRef = collection(db, 'metrics_province');
const q = query(metricsRef, orderBy('timestamp', 'desc'), limit(1));

onSnapshot(q, (snapshot) => {
  const metrics = snapshot.docs[0].data();
  updateDashboard(metrics);
}, (error) => {
  console.error('Real-time update failed:', error);
  showDegradedPerformanceAlert();
});
```

**Update Frequencies:**
- Province-wide metrics: Every 5 seconds
- Municipal performance: Every 10 seconds
- Incident status: Real-time (on change)
- Responder locations: Every 5 seconds (when dispatched)
- System health: Every 5 seconds
- Anomaly detection: Every 30 seconds

### Data Retention Implementation

**6-Month Archival (Gap #53):**
```typescript
// Cloud Function: Automatic archival
exports.archiveOldReports = functions.pubsub
  .schedule('0 2 * * *')  // Run daily at 2 AM
  .timeZone('Asia/Manila')
  .onRun(async (context) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const reportsRef = collection(db, 'reports');
    const oldReports = query(
      reportsRef,
      where('createdAt', '<', sixMonthsAgo)
    );
    
    const snapshot = await getDocs(oldReports);
    const batch = writeBatch(db);
    
    snapshot.docs.forEach((doc) => {
      const archiveRef = doc(db, 'reports_archive', doc.id);
      batch.set(archiveRef, doc.data());
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log(`Archived ${snapshot.size} reports older than 6 months`);
  });
```

**Permanent Deletion (After 12 Months):**
```typescript
// Cloud Function: Permanent deletion
exports.deleteArchivedReports = functions.pubsub
  .schedule('0 3 1 * *')  // Run 1st of month at 3 AM
  .timeZone('Asia/Manila')
  .onRun(async (context) => {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const archiveRef = collection(db, 'reports_archive');
    const oldReports = query(
      archiveRef,
      where('createdAt', '<', twelveMonthsAgo)
    );
    
    const snapshot = await getDocs(oldReports);
    const batch = writeBatch(db);
    
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    // Log deletion for audit trail
    const auditLogRef = doc(collection(db, 'audit_logs'));
    await setDoc(auditLogRef, {
      action: 'PERMANENT_DELETION',
      count: snapshot.size,
      timestamp: new Date(),
      automated: true
    });
    
    console.log(`Permanently deleted ${snapshot.size} archived reports`);
  });
```

### Export Logging (Gap #54)

**PII Export Audit Trail:**
```typescript
// Cloud Function: Log exports
exports.logDataExport = functions.https.onCall(async (data, context) => {
  const { exportType, recordCount, format } = data;
  const user = context.auth;
  
  if (!user) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }
  
  // Verify user is Provincial Superadmin
  const claims = await getUserClaims(user.uid);
  if (claims.role !== 'provincial_superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
  }
  
  // Log the export
  const auditLogRef = doc(collection(db, 'audit_exports'));
  await setDoc(auditLogRef, {
    userId: user.uid,
    userEmail: user.email,
    exportType,
    recordCount,
    format,
    timestamp: new Date(),
    includesPII: true
  });
  
  // Return export URL
  return { url: generateExportURL(exportType, format) };
});
```

---

## Edge Cases & Solutions

### Edge Case #1: Superadmin Account Compromise

**Scenario:** Superadmin's account is hacked, attacker has access to province-wide data and controls.

**Solution:**
```
Emergency account lockdown:
1. Detect suspicious activity (unusual IP, location, actions)
2. Auto-lock account (require re-authentication)
3. Notify all other superadmins
4. Force MFA re-enrollment
5. Audit all actions during compromise window
6. Revert unauthorized changes (if any)
7. Issue new credentials
8. Monitor for follow-up attacks

┌────────────────────────────────────────────────────────┐
│ ⚠️ Suspicious Activity Detected                       │
│                                                        │
│ Your account showed unusual activity:                  │
│ • Login from: Moscow, Russia (unusual location)        │
│ • Time: 2026-04-10 03:45 (unusual time - late night)   │
│ • Actions: Exported 45 reports (unusually high volume) │
│                                                        │
│ Account LOCKED for security.                           │
│                                                        │
│ To restore access:                                     │
│ 1. Verify identity (phone call to PDRRMO Office)        │
│ 2. Re-enroll in MFA (new device required)               │
│ 3. Change password                                     │
│ 4. Review recent activity log                          │
│                                                        │
│ If you did not initiate this activity, your account    │
│ may be compromised. Contact PDRRMO immediately:         │
│ (054) 123-4567                                         │
│                                                        │
│ [I Acknowledge This Compromise]  [Contact Support]     │
└────────────────────────────────────────────────────────┘
```

---

### Edge Case #2: Municipal Admin Unresponsive During Emergency

**Scenario:** Superadmin escalates critical incident to Municipal Admin, but admin doesn't respond (offline, ignoring, incapacitated).

**Solution (Missed Escalation Alerts - Gap #62):**
```
Automated escalation ladder:
1. 15 minutes overdue → First reminder (in-app + SMS)
2. 30 minutes overdue → Second reminder + call superadmin
3. 45 minutes overdue → Third reminder + call backup admin
4. 60 minutes overdue → Final alert + auto-escalate to Governor's office
5. Superadmin can deploy provincial resources directly (bypasses municipal)
```

---

### Edge Case #3: Multiple Municipalities Decline Mutual Aid

**Scenario:** Municipality A requests mutual aid, but Municipalities B, C, D all decline (no resources available).

**Solution:**
```
Superadmin has authority to:
1. See all mutual aid requests and responses
2. Review reasons for declining (legitimate vs. refusal)
3. Make decision:
   a) If legitimate (no resources): Deploy provincial resources
   b) If refusal (has resources but won't share): Escalate to Governor
4. Provincial resources deployed directly by superadmin (no approval needed)
```

---

### Edge Case #4: System Outage During Major Disaster

**Scenario:** Major disaster strikes, system goes down (Firebase outage, network failure, etc.). Superadmins can't access critical tools.

**Solution (Disaster Recovery - Gap #68):**
```
Failover procedures:
1. Switch to read-only mode (cached data)
2. Activate offline communication channels:
   • Phone trees (call each Municipal Admin)
   • Radio communication (VHF/HF radios)
   • Satellite phones (if network completely down)
3. Use paper-based incident tracking (Excel sheets)
4. Deploy provincial resources via phone/radio
5. When system restored:
   • Upload all offline data
   • Reconcile discrepancies
   • Audit all actions taken offline
```

**Offline Mode (Gap #69 - Phase 2):**
```
Cached view for network outages:
• Last known state saved locally (every 5 minutes)
• Read-only access to cached data
• No real-time updates
• Queue actions for when network restored
```

---

### Edge Case #5: Conflicting Emergency Declarations

**Scenario:** Two superadmins both declare emergencies for same incident, but with different severity levels or durations.

**Solution:**
```
First declaration wins (timestamp-based):
• Superadmin A declares Level 3 emergency at 14:32
• Superadmin B declares Level 4 emergency at 14:35
• System: Superadmin A's declaration is active
• System notifies Superadmin B: "Emergency already declared by A"
• Superadmin B can:
  a) Extend existing emergency (increase duration)
  b) Escalate severity (requires approval from A or Governor)
  c) Contact A directly to coordinate
```

---

### Edge Case #6: Citizen Requests Data Deletion During Active Investigation

**Scenario:** Citizen requests GDPR deletion (right to be forgotten), but their report is evidence in ongoing investigation.

**Solution (Gap #57):**
```
Legal hold process:
1. System checks if report is involved in:
   • Active incident (< 7 days old)
   • Ongoing investigation (flagged by admin)
   • Legal case (court order)
2. If yes: Put deletion on hold
   • Notify citizen: "Your report is part of active investigation"
   • Provide timeline: "Will be deleted after investigation closes"
   • Allow citizen to contest hold (legal review)
3. If no: Proceed with deletion immediately
```

---

### Edge Case #7: Provincial Resource Malfunction

**Scenario:** Superadmin deploys helicopter to incident, but helicopter has mechanical issue and can't fly.

**Solution (Gap #48):**
```
Real-time tracking detects issue:
1. GPS shows helicopter hasn't moved (30 minutes past ETA)
2. Crew reports mechanical issue via radio
3. System automatically:
   • Updates deployment status: "Delayed - mechanical issue"
   • Notifies superadmin
   • Suggests alternatives (backup helicopter, other resources)
4. Superadmin:
   • Recalls malfunctioning helicopter
   • Deploys backup resource
   • Updates Municipal Admin on delay
   • Logs incident for maintenance review
```

---

### Edge Case #8: Data Inconsistency After System Restoration

**Scenario:** System goes down during major disaster, multiple Municipal Admins track incidents offline. When system restored, data conflicts (different incident counts, statuses, etc.).

**Solution (Gap #68):**
```
Reconciliation process:
1. System detects conflicts during data upload
2. Superadmin reviews each conflict:
   ┌────────────────────────────────────────────────────────┐
   │ Data Conflict Detected                               │
   │                                                        │
   │ Incident #0471 - Flood                                │
   │                                                        │
   │ Offline data (Municipal Admin A):                     │
   │ • Status: In Progress                                 │
   │ • Responders: 2 teams (Fire, Rescue)                  │
   │ • Last update: 14:32 (offline)                        │
   │                                                        │
   │ Online data (system before outage):                   │
   │ • Status: Dispatched                                  │
   │ • Responders: 1 team (Fire)                           │
   │ • Last update: 14:20 (before outage)                  │
   │                                                        │
   │ Which version is correct?                             │
   │ ○ Use offline data (municipal admin's records)        │
   │ ○ Use online data (system records before outage)      │
   │ ○ Merge both (combine data from both sources)         │
   │ ○ Enter manually (override with new data)             │
   │                                                        │
   │ [Preview Merged Data]  [Resolve Conflict]             │
   └────────────────────────────────────────────────────────┘
3. After resolution, audit trail logs decision
4. Conflicts flagged for follow-up (why did they happen?)
```

---

## Implementation Timeline

### Phase 1 (Must-Have - Critical Gaps)
**Timeline:** 5-7 weeks with 2 developers

**Week 1-2: Security & Privacy (Critical)**
| Feature | Backend | Frontend | Testing | Total |
|---------|---------|----------|---------|-------|
| MFA (mandatory) | 3 days | 2 days | 2 days | 7 days |
| Session management | 2 days | 2 days | 1 day | 5 days |
| PII export logging | 1 day | 1 day | 1 day | 3 days |
| 6-month data retention | 2 days | 1 day | 2 days | 5 days |
| Data deletion workflow | 2 days | 1 day | 1 day | 4 days |
| **Subtotal** | **10 days** | **7 days** | **7 days** | **24 days** |

**Week 3-4: Analytics & Monitoring (Critical)**
| Feature | Backend | Frontend | Testing | Total |
|---------|---------|----------|---------|-------|
| Real-time analytics dashboard | 3 days | 4 days | 2 days | 9 days |
| System health monitoring (real-time) | 2 days | 3 days | 2 days | 7 days |
| Performance degradation alerts | 2 days | 2 days | 1 day | 5 days |
| Anomaly detection | 2 days | 2 days | 2 days | 6 days |
| Drill-down capability | 1 day | 2 days | 1 day | 4 days |
| **Subtotal** | **10 days** | **13 days** | **8 days** | **31 days** |

**Week 5-6: Coordination & Emergency (Critical)**
| Feature | Backend | Frontend | Testing | Total |
|---------|---------|----------|---------|-------|
| Multi-municipality incident coordination | 3 days | 3 days | 2 days | 8 days |
| Mutual aid request tracking | 2 days | 2 days | 1 day | 5 days |
| Province-wide alert targeting | 2 days | 2 days | 1 day | 5 days |
| Escalation notification | 2 days | 1 day | 1 day | 4 days |
| Emergency declaration workflow | 2 days | 2 days | 2 days | 6 days |
| Provincial EOC activation | 2 days | 2 days | 1 day | 5 days |
| Provincial resource inventory | 2 days | 2 days | 1 day | 5 days |
| **Subtotal** | **15 days** | **14 days** | **9 days** | **38 days** |

**Week 7: User Management & Configuration (High Priority)**
| Feature | Backend | Frontend | Testing | Total |
|---------|---------|----------|---------|-------|
| User management dashboard | 3 days | 3 days | 2 days | 8 days |
| Audit log for user changes | 2 days | 2 days | 1 day | 5 days |
| Bulk user import | 2 days | 1 day | 1 day | 4 days |
| User activity monitoring | 1 day | 2 days | 1 day | 4 days |
| Account recovery | 2 days | 1 day | 1 day | 4 days |
| Notification on role changes | 1 day | 1 day | 1 day | 3 days |
| Deactivation reason tracking | 1 day | 1 day | 1 day | 3 days |
| Incident type configuration | 2 days | 2 days | 1 day | 5 days |
| Severity threshold configuration | 1 day | 1 day | 1 day | 3 days |
| Alert template management | 1 day | 2 days | 1 day | 4 days |
| Escalation rule configuration | 1 day | 1 day | 1 day | 3 days |
| Configuration change audit | 1 day | 1 day | 1 day | 3 days |
| **Subtotal** | **18 days** | **20 days** | **13 days** | **51 days** |

**Total Phase 1 Estimate:** 53 days (backend) + 54 days (frontend) + 37 days (testing) = **144 days ÷ 2 developers = ~7 weeks**

**With 2 developers:** 5-7 weeks
**With 1 developer:** 10-14 weeks

---

## Summary

### Phase 1 Deliverables

**18 Critical Features:**
1. ✅ Multi-Factor Authentication (MANDATORY)
2. ✅ Real-time analytics dashboard
3. ✅ Municipal performance monitoring
4. ✅ User management dashboard
5. ✅ Multi-municipality incident coordination
6. ✅ Provincial resource management
7. ✅ Emergency declaration & EOC activation
8. ✅ Data privacy & retention (6-month policy)
9. ✅ System health monitoring (real-time)
10. ✅ Configuration & system settings
11. ✅ Export & reporting tools
12. ✅ Edge cases & special scenarios
13. ✅ Drill-down capability
14. ✅ PII export/download logging
15. ✅ Secure account recovery
16. ✅ Audit logs (user changes, configuration, exports)
17. ✅ Province-wide alert targeting
18. ✅ Automated situation reports

**Plus 24 High-Priority Features:**
- Trend analysis, municipal comparison, historical data access
- Compliance scorecards, anomaly detection
- Mutual aid, resource sharing, escalation tracking
- Crisis communication, after-action reports
- And 10+ more...

**Total:** 42 features in Phase 1

---

## Next Steps

**Specification is COMPLETE and APPROVED** ✅

Ready for implementation:

1. **Backend Development** - Cloud Functions, Firestore rules, data models
2. **Frontend Development** - React components, dashboard UI, real-time updates
3. **Testing** - Unit tests, integration tests, E2E tests with Playwright
4. **Security Review** - MFA, audit logs, PII protection
5. **Deployment** - Firebase deployment, monitoring, alerting

**Implementation can begin immediately.**

---

**Version:** 1.0
**Date:** 2026-04-10
**Status:** ✅ Approved — Ready for Implementation
**Total Features:** 42 (18 Critical + 24 High Priority)
**Estimated Timeline:** 5-7 weeks with 2 developers
