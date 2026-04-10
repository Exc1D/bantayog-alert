# Municipal Admin Role — Complete Specification

**Bantayog Alert — Disaster Reporting Platform**
**Province of Camarines Norte, Philippines**

---

## Table of Contents
1. [Role Overview](#role-overview)
2. [Permissions & Access](#permissions--access)
3. [Interface Design](#interface-design)
4. [Core Features](#core-features)
5. [Workflows](#workflows)
6. [Analytics & Reporting](#analytics--reporting)
7. [Edge Cases & Solutions](#edge-cases--solutions)
8. [Technical Specifications](#technical-specifications)

---

## Role Overview

**See:** [municipal-admin-role-definition.md](municipal-admin-role-definition.md) for complete role definition

**Key Points:**
- Municipal Admins manage ONE municipality each
- Desktop-based, map-centric interface
- Verify citizen reports, classify incidents, dispatch responders
- Can send mass alerts to citizens (evacuation warnings) and responders (mobilization)
- Operational commanders for their municipality

---

## Permissions & Access

### What Municipal Admins CAN Do

| Action | Scope | Notes |
|--------|-------|-------|
| **View reports** | Their municipality only | All reports (pending + verified) |
| **Verify reports** | Their municipality | Mark as verified, rejected, or need info |
| **Auto-verify** | Trusted citizens | Citizens with trust score ≥80 + photo + GPS |
| **Classify incidents** | Their municipality | Set type (flood, fire, etc.) and severity |
| **Dispatch responders** | Their municipality | Select responder types and specific responders |
| **Reassign responders** | Their municipality | After communicating first |
| **View responder status** | Their municipality | Real-time location, status, last update |
| **View citizen contact info** | Their municipality | For follow-up on reports |
| **Communicate with citizens** | Their municipality | Request clarification, provide updates |
| **Communicate with responders** | Their municipality | Two-way messaging during incidents |
| **Request backup** | Their municipality | Additional responders or resources |
| **Escalate to provincial** | Province-wide | When beyond municipal capacity |
| **View border incidents** | Adjacent municipalities | Shared visibility on borders |
| **Merge reports** | Their municipality + cross-municipality | With attribution marking |
| **Send mass alerts (citizens)** | Their municipality | Evacuation warnings, weather alerts |
| **Send mass alerts (responders)** | Their municipality | Emergency mobilization |
| **Close incidents** | Their municipality | Mark resolved incidents as closed |
| **View municipality analytics** | Their municipality | Response times, trends, anonymized comparisons |
| **Shift handoff** | Their municipality | Transfer context to next admin |
| **Manage alerts** | Their municipality | Create, schedule, send official warnings |

### What Municipal Admins CANNOT Do

| Action | Why |
|--------|-----|
| **View reports outside municipality** | Jurisdiction boundary |
| **Verify reports outside municipality** | Jurisdiction boundary |
| **Manage responders outside municipality** | Jurisdiction boundary |
| **Promote users** | Provincial Superadmin only |
| **Access other municipalities' analytics** | Privacy + jurisdiction |
| **Delete verified reports** | Data integrity (public record) |
| **Modify citizen reports** | Preserve original data |
| **Bypass responder opt-in** | Responders must accept dispatches |
| **View system-wide analytics** | Provincial Superadmin only |
| **Modify security rules** | Provincial Superadmin only |
| **Manage other admins** | Provincial Superadmin only |

### Data Visibility Matrix

| Data Type | Visibility |
|-----------|------------|
| **All reports in municipality** | ✅ Full details |
| **Reports outside municipality** | ❌ Hidden (except border incidents) |
| **Border incidents** | ✅ Shared with adjacent municipality (attribution marked) |
| **Citizen contact info** | ✅ Visible |
| **Citizen identity** | ✅ Visible (for follow-up) |
| **Admin identity** | ❌ Hidden from citizens (admin anonymity) |
| **Responder status** | ✅ All in municipality |
| **Responder location** | ✅ Real-time during active dispatch |
| **Analytics** | ✅ Municipality + anonymized provincial comparison |
| **Other municipalities' data** | ❌ Hidden (except shared border incidents) |

---

## Interface Design

### Critical Design Principle: Map-Centric Desktop Interface

**NON-NEGOTIABLE:** The map is ALWAYS visible. All actions happen ON the map or in overlay panels that don't block the map.

### Primary Layout (1920x1080 Desktop Monitor)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Bantayog Alert - MUNICIPAL ADMIN (DAET)              🔔 Alerts: 3  👤 Profile │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────────────┐ │
│ │ [MUNICIPAL MAP - FULL SCREEN]                                        │ │
│ │                                                                      │ │
│ │  ┌──────────────────────────────────────────────────────────────────────┐  │ │
│ │  │  📍 Municipal Boundary (DAET)                                      │  │ │
│ │  │  ┌─────────────────────────────────────────────────────────────┐   │  │ │
│ │  │  │  🔴 High Severity Incidents (3)                               │   │  │ │
│ │  │  │  🟡 Medium Severity Incidents (7)                             │   │  │ │
│ │  │  │  🟢 Low Severity Incidents (12)                               │   │  │ │
│ │  │  └─────────────────────────────────────────────────────────────┘   │  │ │
│ │  │  🔵 Responder Locations (real-time)                             │   │  │ │
│ │  │  🏠 Municipal Boundaries (all 12 municipalities shown)           │   │  │ │
│ │  │  🛣️ Roads, landmarks, geography                                 │   │  │ │
│ │  │  📍 Active incidents (clickable pins)                            │   │  │ │
│ │  └──────────────────────────────────────────────────────────────────────┘  │ │
│ │                                                                      │ │
│ │ [OVERLAYS - Top Left Toggle]                                          │ │
│ │ ☑ Active incidents only                                              │ │
│ │ ☑ Responders available                                               │ │
│ │ ☑ Border incidents (shared)                                          │ │
│ │ ☑ Heat map (last 24h)                                               │ │
│ │ ☑ Municipal boundaries                                              │ │
│ │                                                                      │ │
│ │ [QUICK ACTIONS - Top Edge Bar]                                      │ │
│ │ 📋 Pending: 8  |  🚒 Available: 5  |  ⚠️ Urgent: 2  |  🆘 Mass Alert  │ │
│ │                                                                      │ │
│ └────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Key Interface Principles

1. **Map is Permanent Background**
   - Never covered by modals
   - Never hidden behind navigation
   - Always interactive (pan, zoom, click)

2. **Panels Slide In/Out**
   - Don't pop up OVER the map
   - Slide in from right, left, top, or bottom
   - Map remains visible behind panel
   - Click outside panel → panel slides away

3. **Quick Actions Always Visible**
   - Top edge bar: pending reports, available responders, urgent items
   - One-click access to common actions
   - Don't obscure map center

4. **Keyboard Shortcuts**
   - Everything accessible without mouse
   - Power users can work faster
   - Critical during surges

5. **Multi-Screen Support**
   - Can expand to second monitor
   - Map on one screen, panels on other
   - Or map spanning both screens

---

## Screen Areas & Features

### Area 1: Top Bar (Always Visible)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Bantayog Alert - MUNICIPAL ADMIN (DAET)              🔔 Alerts: 3  👤 Profile │
│                                                                              │
│ Time: 14:32  |  Weather: ⛈️ Heavy Rain  |  Status: 🟢 NORMAL OPERATIONS         │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Municipality name (confirm which admin is logged in)
- Alert count (click to view active alerts)
- Profile (admin settings, logout)
- Current time
- Weather status (from PAGASA or manual)
- Operational status (normal, surge mode, emergency)

### Area 2: Map (Always Visible, Full Screen Background)

**Map Features:**
- Municipal boundary clearly marked (Daet in green, neighbors in gray)
- Incident pins (clickable, color-coded by severity)
- Responder dots (real-time location, labeled by type)
- Roads, landmarks, rivers, topography
- Zoom controls (+/-)
- Layer toggles (incidents, responders, boundaries, heat map)

**Clicking Incident Pin:**
```
Pin expands to show preview:
┌────────────────────────────────┐
│ 🚨 Flood - High                │
│ Barangay San Jose, Daet        │
│ Reported 12 min ago             │
│ Status: Pending verification   │
│                               │
│ [View Full Details]            │
└────────────────────────────────┘
```

**Clicking Responder Dot:**
```
Dot expands to show preview:
┌────────────────────────────────┐
│ 🚒 Responder A (Fire)          │
│ Status: En Route               │
│ To: Incident #0471             │
│ ETA: 5 min                     │
│                               │
│ [View Full Details]            │
│ [Message]                      │
└────────────────────────────────┘
```

### Area 3: Overlays (Top Left Toggle)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Map Layers ▼]                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

When clicked:
┌──────────────────────────────────────────────────────────────────────────────┐
│ ☑ Active incidents only                                          [Apply]     │
│ ☑ Responders available                                                          │
│ ☑ All incidents (pending + verified)                                           │
│ ☑ Border incidents (shared with adjacent municipalities)                       │
│ ☑ Heat map (last 24h)                                                           │
│ ☑ Municipal boundaries                                                        │
│ ☑ Road network                                                                   │
│ ☑ Barangay boundaries                                                           │
│ ☑ Incident clusters                                                              │
│                                                                              │
│ [Advanced Filters...]                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Area 4: Quick Actions Bar (Top Edge)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📋 Pending: 8  |  🚒 Available: 5  |  ⚠️ Urgent: 2  |  🆘 Mass Alert  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Clicking Each:**

**📋 Pending: 8**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Pending Reports (8) - Priority Sorted                                 [Close]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ 🔴 HIGH PRIORITY (3)                                                           │
│ ├─ 🚨 Flood - High - Barangay San Jose (12 min ago)                      │
│ │  [View] [Verify] [Reject]                                                   │
│ ├─ 🚨 Fire - High - Poblacion (8 min ago)                               │
│ │  [View] [Verify] [Reject]                                                   │
│ └─ 🚨 Landslide - High - Barangay Malag (5 min ago)                         │
│    [View] [Verify] [Reject]                                                   │
│                                                                              │
│ 🟡 MEDIUM PRIORITY (3)                                                         │
│ ├─ 🚨 Road blocked - Medium - Daet-Vinzons Road (25 min ago)              │
│ │  [View] [Verify] [Reject]                                                   │
│ ├─ 🚨 Fallen tree - Medium - San Vicente (32 min ago)                       │
│ │  [View] [Verify] [Reject]                                                   │
│ └─ 🚨 Flooding house - Medium - Labo (45 min ago)                            │
│    [View] [Verify] [Reject]                                                   │
│                                                                              │
│ 🟢 LOW PRIORITY (2)                                                            │
│ ├─ 🚨 Small leak - Low - Daet (1 hour ago)                                  │
│ │  [View] [Verify] [Reject]                                                   │
│ └─ 🚨 Debris - Low - Vinzons (1.5 hours ago)                                │
│    [View] [Verify] [Reject]                                                   │
│                                                                              │
│ [Sort by: Severity] [Sort by: Time] [Sort by: Location]                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

**🚒 Available: 5**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Available Responders (5)                                            [Close]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ 🚒 Fire (3)  |  👮 Police (1)  |  🚑 Medical (1)  |  🔧 Engineering (0)            │
│                                                                              │
│ Fire Responders:                                                             │
│ ├─ 🚒 Responder A    Available      Station: Daet Fire                   │
│ │   Last update: Just now                                              │
│ │   [Dispatch to Incident] [View Details]                               │
│ ├─ 🚒 Responder B    Available      Station: Daet Fire                   │
│ │   Last update: 5 min ago                                             │
│ │   [Dispatch to Incident] [View Details]                               │
│ └─ 🚒 Responder C    Available      Station: Daet Fire                   │
│    Last update: 12 min ago                                             │
│    [Dispatch to Incident] [View Details]                               │
│                                                                              │
│ Police Responders:                                                          │
│ └─ 👮 Responder D    Available      Station: Daet PNP                     │
│    Last update: 2 min ago                                              │
│    [Dispatch to Incident] [View Details]                               │
│                                                                              │
│ Medical Responders:                                                          │
│ └─ 🚑 Responder E    Available      Station: Rural Health Unit            │
│    Last update: 8 min ago                                              │
│    [Dispatch to Incident] [View Details]                               │
│                                                                              │
│ [Sort by: Type] [Sort by: Closest to Incident] [Sort by: Station]           │
└──────────────────────────────────────────────────────────────────────────────┘
```

**⚠️ Urgent: 2**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Urgent Attention Required                                             [Close]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ ⚠️ Incident #0471 - No responder acknowledgment for 20 min                 │
│    [View] [Reassign]                                                      │
│ ⚠️ Incident #0478 - Responder hasn't updated status in 45 min                  │
│    [View] [Ping responder]                                                 │
│                                                                              │
│ [View All Urgent Items]                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

**🆘 Mass Alert**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Mass Alert Tools                                                  [Close]    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TO CITIZENS:                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Send broadcast alert to all citizens in selected barangays          │   │
│  │                                                                       │   │
│  │ Alert Type:                                                            │   │
│  │ ○ Evacuation Order (Urgent - life-threatening)                          │   │
│  │ ○ Warning (Prepare for imminent threat)                                │   │
│  │ ○ Advisory (Informational)                                              │   │
│  │                                                                       │   │
│  │ Title:                                                                │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │ │ URGENT: Flash Flood Warning - Evacuate Now                     │   │   │
│  │ └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  │ Message:                                                              │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │ │ All residents in Barangay San Jose, Malag, and Canapon      │   │   │
│  │ │ must evacuate immediately due to rising floodwaters.     │   │   │
│  │ │ Proceed to designated evacuation centers.              │   │   │
│  │ └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  │ Affected Areas:                                                       │   │
│  │ ☑ Barangay San Jose  ☑ Barangay Malag  ☑ Barangay Canapon         │   │
│  │                                                                       │   │
│  │ [Send Alert]                                                           │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  TO RESPONDERS:                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Send mobilization alert to all available responders               │   │
│  │                                                                       │   │
│  │ Message:                                                              │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │ │ 🆘 EMERGENCY MOBILIZATION                                  │   │   │
│  │ │ Major flood incident. All available responders      │   │   │
│  │ │ report to MDRRMO office immediately for deployment. │   │   │
│  │ │ This is an ALL HANDS ON DECK callout.                  │   │   │
│  │ └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  │ [Send Mobilization Alert]                                              │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Area 5: Context Panels (Slide In From Right)

These panels slide in when you click something on the map. **The map remains visible behind the panel.**

#### Panel A: Incident Details

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Incident #0471 - Flood - High Severity                    [Close] [Map]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ STATUS: Pending Verification                                                │
│                                                                              │
│ Report Details:                                                              │
│ ├─ 📸 Photos: 2 attached (view)                                               │
│ ├─ 📍 Location: Barangay San Jose, Daet (view on map)                        │
│ ├─ 👤 Reporter: Citizen Juan Dela Cruz (verified citizen)                        │
│ ├─ 🕒 Reported: 12:15 today (15 minutes ago)                               │
│ └─ 📝 Description: "Water rising fast near the bridge. About 3 feet      │
│                 deep and still rising. People are trapped on        │
│                 roofs."                                                   │
│                                                                              │
│ Citizen Answers (Severity Questions):                                      │
│ ├─ "Is anyone injured or in danger?" → YES - Life-threatening                 │
│ └─ "Is the situation getting worse?" → YES - Getting worse                  │
│                                                                              │
│ 🔵 TRUST SCORE: 92/100 (Highly Reliable Citizen)                               │
│ → Auto-Verify? [Yes] [No]                                                    │
│                                                                              │
│ Verification Actions:                                                          │
│ ┌────────────────────────────────────────────────────────────────────────┐   │
│ │ ✓ Has Location + Photo → VERIFIED                              │   │
│ │ → Can dispatch immediately                                        │   │
│ │                                                                │   │
│ │ [Verify & Classify Incident]  [Request More Info]  [Reject Spam]    │   │
│ └────────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ If [Verify & Classify] clicked:                                              │
│ → Admin selects Incident Type: Flood                                      │
│ → Admin confirms Severity: HIGH                                          │
│ → Incident marked VERIFIED                                               │
│ → Moves to dispatch queue                                                 │
│                                                                              │
│ Duplicate Reports:                                                          │
│ ⚠️ 3 similar reports in queue. View: [Similar Reports]                      │
│                                                                              │
│ [Close Panel] [Go to Map]                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Panel B: Responder Details

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🚒 Responder A (Fire)                                   [Close] [Map]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ STATUS: Available (last update: 2 min ago)                                  │
│                                                                              │
│ Responder Info:                                                              │
│ ├─ Name: Jose Santos                                                         │
│ ├─ Type: Fire Responder                                                     │
│ ├─ Station: Daet Fire Station                                              │
│ ├─ Phone: 0917 123 4567                                                     │
│ └─ Email: jsantos@fire.daet.gov.ph                                       │
│                                                                              │
│ Current Location: (view on map)                                           │
│ Distance: 2.3 km from your location                                        │
│                                                                              │
│ Today's Performance:                                                         │
│ ├─ Dispatches received: 3                                                   │
│ ├─ Accepted: 2                                                              │
│ ├─ Declined: 0                                                             │
│ ├─ Resolved: 1                                                              │
│ └─ Average response time: 12 minutes                                         │
│                                                                              │
│ Active Incidents: None                                                      │
│                                                                              │
│ [Dispatch to Incident] [Message] [View History]                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Panel C: Active Incidents Dashboard

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Active Incidents (7)                                      [Close] [Map]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ 🔴 HIGH (2)  🟡 MEDIUM (3)  🟢 LOW (2)                                       │
│                                                                              │
│ Click to expand incident details                                               │
│                                                                              │
│ #0471 - Flood - High - Barangay San Jose                                  │
│ ├─ Status: In Progress                                                    │
│ ├─ Assigned: 🚒 Responder A (en route, 5 min away)                    │
│ ├─ Assigned: 👮 Responder D (on scene, working for 25 min)              │
│ └─ Assigned: 🚒 Responder C (requested backup)                         │
│    [View Details] [Add Responder]                                          │
│                                                                              │
│ #0475 - Fire - High - Poblacion                                              │
│ ├─ Status: Verified, awaiting dispatch                                    │
│ ├─ Suggested responders: 🚒 Fire + 🚑 Medical                             │
│ └─ [View Details] [Dispatch]                                                │
│                                                                              │
│ [View All 7 Incidents] [Sort by Severity] [Sort by Time]                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Features

### 1. Queue Triage & Surge Handling

**Purpose:** Process 50+ reports/hour during disasters without breaking

**Quick Triage Mode:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📋 Queue Triage Mode (47 pending reports)                    [Exit Mode]    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ FILTER: [🔴 High only] [🟡 High + Medium] [All]                               │
│                                                                              │
│ Quick-Scan View (One Report Per Row):                                       │
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ 📸 [Photo]  📍 Barangay San Jose  "People trapped"   12 min ago  │  │
│ │            Citizen: Juan D. (⭐ 92)                                  │  │
│ │            [View] [Verify] [Reject] [Skip]                         │  │
│ ├────────────────────────────────────────────────────────────────────────┤  │
│ │ 📸 [Photo]  📍 Poblacion          "Fire spreading"     8 min ago   │  │
│ │            Citizen: Maria L. (⭐ 78)                                 │  │
│ │            [View] [Verify] [Reject] [Skip]                         │  │
│ ├────────────────────────────────────────────────────────────────────────┤  │
│ │ 📸 [No Photo] 📍 Barangay Malag      "Road blocked"      25 min ago  │  │
│ │            Citizen: Pedro S. (⭐ 45)                                 │  │
│ │            [View] [Verify] [Request Photo] [Skip]                 │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ [Auto-Verify Trusted Citizens] [Bulk Reject Spammers] [Process All]     │
│                                                                              │
│ Legend:                                                                      │
│ ⭐ 90+ = Trusted citizen (auto-verify if photo + GPS)                          │
│ ⭐ 70-89 = Reliable citizen                                                   │
│ ⭐ 50-69 = New citizen                                                       │
│ ⭐ 30-49 = Needs verification                                                │
│ ⭐ <30 = Watch list (frequent false reports)                                │
│                                                                              │
│ ──────────────────────────────────────────────────────────────────────────── │
│ Processed: 12 / 47  |  Skipped: 5 / 47  |  Remaining: 30 / 47                │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Actions:**
- **[Verify]** → Verify immediately, move to dispatch queue
- **[Reject]** → Reject with reason (spam, prank, duplicate)
- **[Request Info]** → Ask citizen for photo/location
- **[Skip]** - Keep in queue, review later

**Auto-Verify Rules:**
```
IF Citizen trust score ≥ 80 AND
   Report has GPS location AND
   Report has photo
THEN → Auto-verify (mark as verified immediately)

Admin sees:
→ "Auto-verified: Citizen Juan D. (trust score: 92)"
→ Admin can override if needed
```

### 2. Duplicate Detection & Merging

**Purpose:** Combine duplicate reports, save responder resources

**When Viewing Report:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ DUPLICATE DETECTED                                                    │
│                                                                              │
│ This report may be a duplicate of 3 existing reports:                   │
│                                                                              │
│ #0471 - Flood - High - Barangay San Jose (12 min ago)                        │
│    Reporter: Juan D.   Status: Verified, responders dispatched              │
│    [View] [This is different] [Yes, it's duplicate]                       │
│                                                                              │
│ #0473 - Flood - High - Barangay San Jose (8 min ago)                         │
│    Reporter: Maria L.   Status: Pending verification                      │
│    [View] [This is different] [Yes, it's duplicate]                       │
│                                                                              │
│ #0474 - Flood - High - Barangay San Jose (5 min ago)                         │
│    Reporter: Pedro S.   Status: Pending verification                      │
│    [View] [This is different] [Yes, it's duplicate]                       │
│                                                                              │
│ [Mark all as duplicates of #0471] [Keep separate] [Let me decide]        │
└──────────────────────────────────────────────────────────────────────────────┘
```

**If Admin Merges:**
```
All 3 reports merged into #0471

Incident #0471 now has:
→ 3 citizen reports
→ 3 sets of photos
→ 3 descriptions
→ All information consolidated

Responders dispatched once (not 3 times)
→ Efficient resource use
```

**Cross-Municipality Merge:**
```
If duplicate is from adjacent municipality:
→ Marked with attribution: "Verified by Admin Maria (Daet)"
→ Shows which municipality dispatched first
→ Adjacent admin can view details, add notes
→ Maintains accountability
```

### 3. Simplified Verification (Location + Photo = Verified)

**Purpose:** Fast verification with clear rules

**Verification Rules:**
```
✅ VERIFIED (Can Dispatch Immediately):
→ Has GPS location ✓
→ Has photo ✓
→ (Description optional)

⚠️  NEED INFO (Cannot Dispatch Yet):
→ Has GPS only → "Need photo to verify"
→ Has photo only → "Need location to verify"
→ Neither → "Need photo AND location"

❌ REJECTED:
→ No GPS, no photo, vague description
→ Obviously spam/prank
→ Duplicate

AUTO-CLOSE AFTER 7 DAYS:
→ Unverified reports auto-close
→ Reason: "No response - unable to verify"
→ Citizen notified
→ Admin can manually re-open if needed
```

### 4. Responder Status Dashboard (Real-Time)

**Purpose:** Never operate blind - always know what responders are doing

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🚒 RESPONDER STATUS DASHBOARD                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Filter: [All Responders] [On Scene Only] [En Route Only]              │
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ 🚒 Responder A (Fire)                                                  │ │
│ │    Status: On Scene (In Progress)                                     │ │
│ │    Incident: #0471 - Flood - Barangay San Jose                       │ │
│ │    Location: Barangay San Jose (view on map)                          │ │
│ │    Last Update: 8 min ago ⚠️ (stale - should update soon)              │ │
│ │    [View on Map] [Message] [Request Update]                          │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ 👮 Responder B (Police)                                                 │ │
│ │    Status: En Route (Acknowledged)                                    │ │
│ │    Incident: #0475 - Fire - Poblacion                                 │ │
│ │    ETA: 5 minutes                                                     │ │
│ │    Last Update: 2 min ago ✅ (fresh)                                  │ │
│ │    [View on Map] [Message] [Track ETA]                               │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ 🚒 Responder C (Fire)                                                  │
│ │    Status: Available (no assignment)                                  │
│ │    Location: Daet Fire Station                                       │ │
│ │    Last Update: 15 min ago ✅                                         │
│ │    Workload today: 2 dispatches (4 hours active)                      │
│ │    [Dispatch to Incident] [View History]                              │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ REFRESH: Auto-refresh every 30 seconds  |  [Refresh Now]                    │
│                                                                              │
│ Legend:                                                                      │
│ ✅ Fresh (<10 min ago)  ⚠️ Stale (10-30 min)  ⚠️⚠️ Very Stale (>30 min) │
│                                                                              │
│ ──────────────────────────────────────────────────────────────────────────── │
│ STALE NOTIFICATIONS:                                                           │
│ ⚠️ Responder A hasn't updated Incident #0471 in 25 min                     │
│    [Ping Responder] [Mark as Non-Responsive]                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Stale Responder Handling:**
```
If no update for 30 min:
→ Admin notified: "Responder A hasn't updated Incident #0471 in 30 min"
→ System sends: "⏰ Status check: Please update Incident #0471 status"

If no update for 60 min:
→ Admin notified: "Responder A not responding to Incident #0471 for 60 min"
→ Can [Ping responder] or [Reassign to different incident]
→ Can mark as "Non-Responsive" (temporarily unavailable)
```

### 5. Mass Alert Tools

#### Type A: Mass Alerts TO CITIZENS

**Purpose:** Broadcast evacuation warnings, weather alerts to all citizens

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🆘 SEND MASS ALERT TO CITIZENS                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. SELECT ALERT TYPE:                                                         │
│    ◉ Evacuation Order (Urgent - life-threatening)                            │
│    ◉ Warning (Prepare for imminent threat)                                  │
│    ◉ Advisory (Informational)                                              │
│                                                                              │
│ 2. TARGET AREA:                                                                │
│    ☑ Barangay San Jose  ☑ Barangay Malag  ☑ Barangay Canapon               │
│    OR: Select entire municipality                                              │
│                                                                              │
│ 3. CONTENT:                                                                   │
│    Title: (required)                                                          │
│    ┌─────────────────────────────────────────────────────────────────────┐   │
│    │ URGENT: Flash Flood Warning - Evacuate Now                         │   │
│    └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│    Message: (required)                                                        │
│    ┌─────────────────────────────────────────────────────────────────────┐   │
│    │ All residents in Barangay San Jose, Malag, and Canapon              │   │
│    │ must evacuate immediately due to rising floodwaters.             │   │
│    │ Proceed to designated evacuation centers.                         │   │
│    │                                                           │   │
│    │ ⚠️ If you need assistance, call: 0917-123-4567          │   │
│    └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 4. SCHEDULE (Optional):                                                         │
│    ☑ Send immediately                                                       │
│    ☐ Schedule for: [Date] [Time]                                        │
│                                                                              │
│ 5. CHANNELS:                                                                   │
│    ☑ Push notification (all citizens with app)                               │
│    ☑ SMS blast (all citizens who provided phone)                               │
│    ☑ Email blast (all citizens with email)                                   │
│                                                                              │
│ 6. CONFIRMATION:                                                              │
│    This will send to approximately 15,000 citizens in your municipality.    │
│                                                                             │
│    [Send Alert] [Cancel]                                                     │
│                                                                              │
│ LOGGING:                                                                     │
│    Sent by: Admin Maria Santos (Daet MDRRMO)                              │
│    Timestamp: 2026-04-10 14:32:00                                         │
│    Recipients: 15,234 citizens                                                │
│    Logged to: Provincial Superadmin (for audit)                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Type B: Mass Alerts TO RESPONDERS

**Purpose:** Mobilize all available responders during major disasters

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🆘 SEND MASS ALERT TO RESPONDERS                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. ALERT TYPE:                                                                │
│    ◉ Emergency Mobilization (all available respond NOW)                     │
│    ◉ Urgent Request (respond if available)                                │
│    ◉ Informational (fyi: incident resolved)                                │
│                                                                              │
│ 2. CONTENT:                                                                   │
│    ┌─────────────────────────────────────────────────────────────────────┐   │
│    │ 🆘 EMERGENCY MOBILIZATION                                    │   │
│    │                                                           │   │
│    │ Major flood incident in Barangay San Jose. Multiple   │   │
│    │ people reported trapped. Water levels rising rapidly.    │   │
│    │                                                           │   │
│    │ This is an ALL HANDS ON DECK callout.                  │   │
│    │ All available responders report to MDRRMO office        │   │
│ │
│    │                                                           │   │
│    │ Check in within 10 minutes.                             │   │
│    │                                                           │   │
│    │ - Admin Maria Santos                                     │   │
│    │ - Daet MDRRMO                                          │   │
│    └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 3. TARGET:                                                                    │
│    ☑ All available responders                                              │
│    ☑ Fire team only                                                       │
│    ☑ Search & rescue only                                                 │
│    ☑ Custom selection...                                                   │
│                                                                              │
│ 4. REQUEST CONFIRMATION:                                                     │
│    This will mobilize approximately 8 responders.                          │
│    All responders will receive push notification immediately.          │
│                                                                             │
│    [Send Mobilization Alert] [Cancel]                                    │
│                                                                              │
│ LOGGING:                                                                     │
│    Sent by: Admin Maria Santos (Daet MDRRMO)                              │
│    Timestamp: 2026-04-10 14:32:00                                         │
│    Recipients: 8 responders                                               │
│    Logged to: Provincial Superadmin (for audit)                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6. Shift Handoff

**Purpose:** Transfer context between admins during shift changes

**Admin Ending Shift:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📋 SHIFT HANDOFF - End of Shift                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Handing over to: Admin B (Next Shift)                                    │
│ Time: 14:00:00                                                            │
│ Date: 2026-04-10                                                          │
│                                                                              │
│ ACTIVE INCIDENTS: (12)                                                       │
│ ├─ 🔴 HIGH: 2 incidents                                                    │
│ ├─ 🟡 MEDIUM: 5 incidents                                                 │
│ └─ 🟢 LOW: 5 incidents                                                  │
│                                                                              │
│ INCIDENTS REQUIRING ATTENTION:                                             │
│ ├─ ⚠️ #0471 - Flood - No responder acknowledgment for 25 min                 │
│ │    → Follow up: Responder A is on scene, waiting for backup             │
│ ├─ ⚠️ #0480 - Fire - Responder hasn't updated in 50 min                      │
│ │    → Follow up: Responder B might be done, request update             │
│ └─ ⚠️ #0485 - Requesting backhoe from DPWH                                      │
│    → Follow up: Expected at 15:00, follow up then                             │
│                                                                              │
│ PENDING REQUESTS:                                                          │
│ ├─ Backup requested for Incident #0471 (boat team)                         │
│ ├─ Verification needed for #0492 (citizen not responding)                 │
│ └─ Provincial escalation request for #0478 (multiple casualties)            │
│                                                                              │
│ GENERAL NOTES:                                                               │
│ ├─ Rain intensifying, expect more flood reports                              │
│ ├─ Road crew (DPWH) is the only one available (5 trucks on standby)       │
│ ├─ Three citizens have reported false alarms today (flagged for review)    │
│ └─ Police responder is sick today (reduced capacity)                         │
│                                                                              │
│ [Initiate Handoff] [Add Notes] [Cancel]                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Incoming Admin (Starting Shift):**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📋 SHIFT HANDOFF - Start of Shift                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Receiving from: Admin A (Previous Shift)                                  │
│ Time: 14:00:00                                                            │
│ Date: 2026-04-10                                                          │
│                                                                              │
│ SUMMARY:                                                                    │
│ • 12 active incidents (2 high, 5 medium, 5 low)                            │
│ • 3 incidents require immediate attention                                  │
│ • 2 pending requests (backup, escalation)                                  │
│                                                                              │
│ [Read Full Handoff Notes] [Accept Handoff]                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7. Map Filtering & Clustering

**Purpose:** Maintain map usability when many incidents are active

**Filter Controls:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🗂️ Map Filters                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ INCIDENTS:                                                                   │
│ ◉ All incidents (pending + verified)                                     │
│ ○ Active incidents only (en route, on scene, in progress)                 │
│ ○ Pending verification only                                               │
│ ○ Verified and dispatched only                                           │
│ ○ Border incidents (shared with adjacent municipalities)                   │
│                                                                              │
│ SEVERITY:                                                                    │
│ ○ 🔴 High only (8 incidents)                                                │
│ ○ 🟡 Medium only (12 incidents)                                             │
│ ○ 🟢 Low only (15 incidents)                                                │
│ ○ All incidents                                                           │
│                                                                              │
│ TIME:                                                                       │
│ ○ Last 1 hour                                                            │
│ ○ Last 6 hours                                                            │
│ ○ Last 24 hours                                                           │
│ ○ All time                                                               │
│                                                                              │
│ RESPONDERS:                                                                  │
│ ○ Show all responders                                                     │
│ ○ Show available only                                                     │
│ ○ Show busy only (en route, on scene)                                    │
│ ○ Hide responders                                                         │
│                                                                              │
│ CLUSTERING:                                                                  │
│ ○ No clustering (show all pins)                                             │
│ ○ Cluster nearby pins (50m radius)                                       │
│ ○ Cluster medium pins (100m radius)                                      │
│                                                                              │
│ [Apply Filters] [Reset Filters]                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**When Zooming:**
- Zoom out: Pins cluster, show number of incidents in cluster
- Zoom in: Clusters expand, show individual pins
- Always responsive to zoom level

### 8. Incident Type Templates (Quick Dispatch)

**Purpose:** Suggest appropriate responders based on incident type

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🚨 Dispatch Incident #0471                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Incident Type: FLOOD                                                          │
│                                                                              │
│ RECOMMENDED RESPONDERS:                                                     │
│ ☑ Search & Rescue (for trapped people)                                   │
│ ☑ Medical (for injuries)                                                   │
│ ☑ Engineering (for road clearance)                                       │
│ ☑ Social Welfare (for evacuation)                                         │
│                                                                              │
│ [Dispatch All Recommended] [Custom Selection]                             │
│                                                                              │
│ QUICK STATS FOR FLOOD:                                                     │
│ → Average response time: 18 min                                             │
│ → Available Search & Rescue: 2 teams                                       │
│ → Available Medical: 1 ambulance                                           │
│                                                                              │
│ [Dispatch All] [Customize] [Cancel]                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 9. Stale Report Handling

**Purpose:** Auto-close unverified reports after 7 days

**Stale Report Detection:**
```
Reports in queue for 7+ days are flagged:

┌──────────────────────────────────────────────────────────────────────────────┐
│ ⏰ STALE REPORT WARNING                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Report #0492 - "Small landslide on road"                                   │
│ Reported: 7 days ago (April 3, 2026)                                        │
│ Status: Pending verification                                               │
│ Citizen: Not responding to follow-up messages                              │
│                                                                              │
│ LIKELY RESOLVED:                                                           │
│ → Road crew likely cleared it                                              │
│ → Incident no longer active                                               │
│                                                                              │
│ OPTIONS:                                                                    │
│ [Close as Outdated] [Request Update from Citizen] [Keep Open]            │
│                                                                              │
│ If [Close as Outdated]:                                                     │
│ → Citizen notified: "Your report has been closed due to no response"    │
│ → Reason: "Unverified for 7 days"                                          │
│ → Incident marked: "Closed - Outdated"                                   │
│                                                                              │
│ Admin can manually re-open if citizen reports back: "Still a problem!"     │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Auto-Close Logic:**
- Runs automatically every night at midnight
- Closes all unverified reports older than 7 days
- Sends notification to citizen
- Logs action for audit

### 10. Citizen Communication Tools

**Purpose:** Request clarification, provide updates

**Messaging Panel:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 💬 Message Citizen - Report #0471                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Citizen: Juan Dela Cruz                                                     │
│ Report: "Flood at bridge"                                                   │
│ Status: Pending Verification                                               │
│ Phone: 0912 345 6789                                                      │
│                                                                              │
│ MESSAGE HISTORY:                                                           │
│ ├─ You (14:30): "Can you confirm: Is anyone trapped or injured?"          │
│ ├─ Citizen (14:35): "Yes, 3 people trapped on roof, water waist deep"     │
│ ├─ You (14:36): "Thank you. We're dispatching help now."                  │
│ └─ Citizen (14:37): "Hurry please, water still rising!"                     │
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ [Send Message...]                                              [Send]      │ │
│ │                                                                   │ │
│ │ QUICK TEMPLATES:                                                   │ │
│ │ [Request: "What's the exact location?"]]                           │ │
│ │ [Request: "How many people need help?"]]                             │ │ │
│ │ [Request: "Is anyone injured?"]]                                    │ │ │
│ │ [Update: "Help is on the way"]]                                  │ │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ [Close] [Call Citizen]                                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Workflows

### Workflow 1: Report Verification & Classification

```
┌─ → Citizen submits report
│
└─ → Appears in Pending Queue (sorted by priority)
     │
     └─ → Admin opens report (quick triage mode if surge)
          │
          └─ → Admin sees: Photos + Location + Description + Citizen Answers
               │
               ├─ → IF Location + Photo + Trusted Citizen (≥80) → AUTO-VERIFY ✅
               │
               ├─ → IF Location + Photo (any citizen) → Verify & Classify
               │     ├─ Select incident type (Flood, Fire, etc.)
               │     ├─ Confirm severity (based on citizen answers)
               │     └─ Incident VERIFIED
               │
               ├─ → IF Missing Location OR Photo → "Request More Info"
               │     ├─ Citizen responds
               │     └─ Verify once info complete
               │
               └─ → IF Spam/Prank/Duplicate → Reject
```

### Workflow 2: Responder Dispatch

```
┌─ → Incident verified, ready for dispatch
│
└─ → Incident appears in Active Incidents queue
     │
     └─ → Admin selects [Dispatch]
          │
          ├─ → System shows: Recommended Responders
          │     (based on incident type + availability)
          │
          └─ → Admin sees: Available Responders Matrix
               │
               └─ → Admin selects responders (one or multiple)
                    │
                    ├─ → System sends dispatch notifications
                    │
                    └─ → Responders receive notifications
                         │
                         ├─ → Responder A accepts (within 5 min)
                         ├─ → Responder B declines (with reason)
                         └─ → Responder C no response (after 10 min → auto-escalate)
                              │
                              └─ → Admin updates incident:
                                  ├─ "Responder A accepted"
                                  ├─ "Responder B declined - vehicle issue"
                                  └─ "Responder C didn't respond - reassigned to D"
```

### Workflow 3: Cross-Municipality Coordination

```
┌─ → Incident near municipal border
│
└─ → BOTH Municipal Admins see incident (shared visibility)
     │
     ├─ → Admin A (Daet) opens incident
     │      └─ → Sees: "Also visible to Admin B (Vinzons)"
     │
     └─ → Admin A can:
          ├─ Dispatch own responders first
          ├─ Message Admin B: "Can you handle the Vinzons side?"
          └─ Wait for Admin B's response
               │
               └─ → Admin B can:
                    ├─ Add their own responders
                    ├─ Mark: "Incident handled by Daet MDRRMO"
                    └─ Coordinate resources

Attribution Marking:
→ All actions logged with admin name
→ "Responder X dispatched by Admin A (Daet)"
→ "Additional resources added by Admin B (Vinzons)"
```

---

## Analytics & Reporting

### Dashboard Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📊 ANALYTICS DASHBOARD - DAET MUNICIPALITY                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ TIME RANGE: [Last 24 Hours ▼]  [Last 7 Days ▼]  [Last 30 Days ▼]         │
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ INCIDENT STATISTICS                                                  │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ Total Reports: 47                                                       │ │
│ │ Verified: 38 (81%)   Rejected: 9 (19%)                               │ │
│ │ Pending: 0         Auto-closed: 3 (6%)                             │ │
│ │                                                                          │ │
│ │ By Type:                                                               │ │
│ │ ├─ Flood: 18 (38%)                                                    │ │
│ │ ├─ Fire: 8 (17%)                                                      │ │ │
│ │ ├─ Landslide: 6 (13%)                                                 │ │ │
│ │ ├─ Road Accident: 5 (11%)                                             │ │ │
│ │ ├─ Fallen Tree: 4 (8%)                                                │ │ │
│ │ ├─ Medical: 3 (6%)                                                    │ │ │ │
│ │ └─ Other: 3 (6%)                                                      │ │ │ │
│ │                                                                          │ │
│ │ By Severity:                                                          │ │ │
│ ├─ 🔴 High: 12 (26%)                                                  │ │
│ ├─ 🟡 Medium: 23 (49%)                                                │ │
│ └─ 🟢 Low: 12 (25%)                                                   │ │ │
│ │                                                                          │ │
│ │ By Barangay:                                                          │ │ │
│ ├─ San Jose: 8 (17%)                                                   │ │
│ │ ├─ Poblacion: 7 (15%)                                                 │ │ │ │
│ │ ├─ Malag: 6 (13%)                                                    │ │ │ │
│ │ └─ (All barangays listed...)                                            │ │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ RESPONSE TIME                                                          │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ Report → Verification: Average 8 minutes                             │ │
│ │ Verification → Dispatch: Average 5 minutes                              │ │
│ │ Dispatch → Response: Average 18 minutes                                  │ │ │
│ │ Total: 31 minutes from report to responder on scene                    │ │
│ │                                                                          │ │ │
│ │ COMPARISON:                                                              │ │
│ │ Your municipality: 31 min                                             │ │
│ │ Provincial average: 28 min                                            │ │ │
│ │ Status: ✅ 3 minutes faster than average                             │ │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ RESPONDER UTILIZATION                                                 │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ Total Dispatches: 23                                                   │ │
│ │ Accepted: 21 (91%)                                                     │ │
│ │ Declined: 2 (9%)                                                        │ │
│ │ Average Response Time: 18 minutes                                     │ │
│ │ Average Workload: 4.2 hours/responder today                            │ │
│ │ Utilization Rate: 85% (good, not overworked)                          │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ [Download Full Report] [Export Data]                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Edge Cases & Solutions

### 1. Responder Doesn't Accept Within 5 Minutes

**Problem:** Responder dispatched, no acknowledgment (asleep, phone silent, etc.)

**Solution:**
```
Timeline:
0 min - Dispatch sent
5 min - Reminder notification to responder: "Respond to dispatch #0471"
10 min - Auto-escalate to next available responder
       - Notify admin: "Responder X didn't respond, reassigned to Y"
       - Log: "Dispatched to X at 14:00, reassigned to Y at 14:10"

Admin actions:
→ Can [Ping Responder X] to check why they didn't respond
→ Can [Manually Override] to give X more time
→ Can dispatch additional responders while waiting
```

### 2. Multiple Incidents, One Responder

**Problem:** Only 1 boat team, 3 flood incidents needing boat

**Solution:**
```
Admin sees:
→ Incident #0471: Flood, needs boat - HIGH (3 people trapped)
→ Incident #0472: Flood, needs boat - MEDIUM (precautionary)
→ Incident #0473: Flood, needs boat - LOW (street flooding)

Admin dispatches:
→ Boat team to Incident #0471 (highest priority)
→ Message to Incident #0472 & #0473:
   "Boat team assigned to higher priority incident. ETA for your area: 2 hours"

Citizens in #0472 and #0473:
→ Get update: "Your incident is queued. Responders assigned to higher priority incident"
→ Can still message if situation worsens: "Water rising fast, reassess priority"
```

### 3. GPS Verification Fails

**Problem:** Responder at scene but GPS shows 50 meters away

**Solution:**
```
When responder updates "On Scene":
→ System checks: GPS shows 50m away from incident location
→ App shows: "⚠️ GPS location inaccurate (50m away)"
→ Options:
→ [Request Photo Verification] - Responder uploads photo, admin confirms
→ [Update Anyway with Note] - Responder adds note: "GPS inaccurate, on scene confirmed"
→ [Retry GPS] - Try verification again

Admin can approve:
→ "Manual approval: Responder confirmed on scene via photo"
→ Prevents operational blocking
```

### 4. Citizen Reports After Verification

**Problem:** Incident verified, then citizen adds critical info

**Solution:**
```
Verified incident can be updated:
→ Citizen messages: "Actually 4 people trapped, not 3!"
→ Admin sees: "Update from reporter: '4 people trapped, not 3'"
→ Can update incident details
→ Can escalate severity (if now worse)
→ Can dispatch additional resources

Citizen notifications:
→ Citizen gets update: "Your report has been updated"
→ "Added: '4 people trapped, not 3'"
→ "Response increased to: 1 boat team + 2 medical teams"
```

### 5. Responder Requests Backup Too Late

**Problem:** Responder requests backup but admin has no one available

**Solution:**
```
Admin sees:
→ "Requested: 1 boat team, 1 medical team"
→ Available: 0 boat teams, 0 medical teams

Admin actions:
→ [Request Provincial Backup]
→ → System escalates to Provincial Superadmin
→ → "Daet needs: 1 boat team, 1 medical team for Incident #0471"
→ → Province-wide mobilization
→ OR: [Message Responder] "No backup available, do your best"
→ OR: [Request Adjacent Municipality] "Can Vinzons spare any teams?"

Admin tools for resource constraints:
→ See all nearby municipalities and their responder status
→ Send mutual aid requests
→ Track who owes whom (mutual aid logging)
```

---

## Technical Specifications

### Desktop Requirements

**Minimum:**
- 1920x1080 monitor
- 2+ GHz processor
- 8GB RAM
- Wired internet connection

**Recommended:**
- Dual monitor setup (map on both or map + panels on second)
- 2560x1440 monitor or larger
- 4+ CPU cores
- 16GB RAM
- Backup power (UPS)

### Browser Compatibility

- Chrome 90+ (primary)
- Firefox 88+ (secondary)
- Edge 90+

### Keyboard Shortcuts

**Map Navigation:**
- `↑` `↓` `←` `→` - Pan map
- `+` `-` - Zoom in/out
- `Home` - Reset to municipality view
- `O` - Toggle overlays panel
- `1-9` - Toggle incident filters (High/Medium/Low)
- `0` - Show all incidents
- `Esc` - Close current panel

**Actions:**
- `V` - Open pending reports queue
- `D` - Open active incidents
- `R` - Open responder dashboard
- `A - Open mass alert tools
- `S` - Open analytics
- `H` - Open handoff panel (shift ending)
- `Enter` - Open selected incident/responder
- `Space` - Quick action on selected item
- `Delete` - Reject report/remove assignment

**Multi-Select:**
- `Shift + Click` - Select multiple items (reports, responders)
- `Ctrl + A` - Select all in current queue
- Bulk actions: [Verify Selected] [Dispatch Selected] [Message Selected]

### Real-Time Updates

**Map:**
- Responder locations update every 30 seconds
- Incident status updates immediately
- New reports appear immediately
- Color-coding updates in real-time

**Dashboard:**
- Pending queue refreshes every 30 seconds
- Responder availability updates every 1 minute
- Urgent items refresh every 30 seconds

**Performance:**
- All updates incremental (not full page reloads)
- WebSocket connections for real-time data
- Optimized for desktop, not mobile

---

## Document Version

**Version:** 1.0
**Last Updated:** 2026-04-10
**Status:** Approved for implementation
**Changes:**
- Map-centric desktop interface
- All Phase 1 gaps addressed
- Auto-verification rules
- Simplified verification (location + photo)
- Mass alert tools (citizens + responders)
- Duplicate detection
- Stale report handling
- Responder status dashboard
- Shift handoff
- Map filtering and clustering

---

**End of Municipal Admin Role Specification**
