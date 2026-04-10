# Responder Role — Complete Specification

**Bantayog Alert — Disaster Reporting Platform**
**Province of Camarines Norte, Philippines**

---

## Table of Contents
1. [Role Overview](#role-overview)
2. [Permissions & Access](#permissions--access)
3. [Interface Design](#interface-design)
4. [Core Features](#core-features)
5. [Dispatch Workflow](#dispatch-workflow)
6. [On-Duty Management](#on-duty-management)
7. [Communication Tools](#communication-tools)
8. [Shift Handoff](#shift-handoff)
9. [Performance & History](#performance--history)
10. [Edge Cases & Solutions](#edge-cases--solutions)
11. [Technical Specifications](#technical-specifications)

---

## Role Overview

### Who Are Responders?

Responders are the "boots on the ground" — emergency personnel who receive dispatches from admins and respond to incidents in the field. They execute rather than decide.

### Responder Types (Specializations)

| Type | Code | Role | Examples |
|------|------|------|----------|
| **Police** | POL | Law enforcement, crowd control | MDRRMO police unit, PNP |
| **Fire** | FIR | Fire suppression, rescue | Local fire station, BFP |
| **Medical** | MED | First aid, ambulance | Rural health unit, ambulance |
| **Engineering** | ENG | Road clearance, structural damage | Municipal engineering, DPWH |
| **Search & Rescue** | SAR | Missing persons, evacuation | Coast Guard, volunteer SAR |
| **Social Welfare** | SW | Evacuation centers, relief | DSWD field team, MSWDO |
| **General** | GEN | Multi-purpose response | MDRRMO general response team |

### Primary Responsibilities

- **Receive and respond to dispatches** (opt-in acceptance)
- **Navigate to incident location** safely and quickly
- **Assess situation** upon arrival
- **Update incident status** through the workflow
- **Document field observations** with notes and photos
- **Request backup/resources** when needed
- **Complete assigned tasks** (rescue, evacuation, etc.)
- **Mark incidents as resolved** when work is complete

### What Responders DON'T Do

- ❌ Verify reports (admin triage function)
- ❌ Classify incident type or severity (admin decision)
- ❌ Dispatch themselves or others (admin coordination)
- ❌ See reports outside their municipality (jurisdiction boundary)
- ❌ Access analytics (admin/superadmin tool)
- ❌ Promote users (admin-only)
- ❌ Delete or edit reports (data integrity)

### Key Characteristics

- **Time-critical work:** Every second counts during response
- **High-stress environment:** Decisions made under pressure
- **Variable connectivity:** May respond in areas with poor signal
- **Safety-focused:** Their own safety is paramount
- **Team-oriented:** Often work in crews, not alone
- **Mobile-first:** Rarely have access to desktop computers
- **Hands may be full:** Wearing gear, carrying equipment

---

## Permissions & Access

### What Responders CAN Do

| Action | Details |
|--------|---------|
| **View dispatched reports** | Only those assigned to them |
| **Opt-in to dispatches** | Accept or decline assignments |
| **View incident details** | Full details of assigned incidents |
| **See location on map** | Navigation to incident |
| **Update incident status** | Through workflow (acknowledged → in_progress → resolved) |
| **Quick status updates** | One-tap toggles for fast updates |
| **Add field notes** | Timestamped observations |
| **Upload field photos** | Document progress and conditions |
| **Call admin directly** | One-tap phone call (opens phone dialer) |
| **Activate SOS** | Emergency distress signal |
| **View incident timeline** | See what happened before arrival |
| **See equipment checklist** | Recommended gear for incident type |
| **View pre-arrival info** | Situation details before arriving |
| **See team on incident** | Other responders assigned (visibility only) |
| **Request backup** | Structured requests for additional resources |
| **Request escalation** | Escalate to provincial level if needed |
| **Cancel dispatch** | If genuinely unable to respond (with reason) |
| **Set availability status** | Available / Unavailable / Off-duty |
| **View their history** | All past assignments and responses |
| **See their performance metrics** | Response times, completion rates |

### What Responders CANNOT Do

| Action | Why |
|--------|-----|
| Verify reports | Admin triage function |
| Classify incidents | Admin decision based on broader context |
| Dispatch responders | Admin coordination role |
| See reports NOT assigned to them | Privacy + focus |
| View reports in other municipalities | Jurisdiction boundary |
| Access analytics | Admin/superadmin tool |
| Edit incident type/severity | Admin-set, responder documents |
| Delete reports or photos | Data integrity |
 Promote other users | Admin-only |
| View citizen contact info | Privacy protection |
| See other responders' unassigned work | Privacy |

### Data Visibility Matrix

| Data Type | Visibility |
|-----------|------------|
| **Assigned reports** | ✅ Full details |
| **Unassigned reports** | ❌ Hidden |
| **Reports in other municipalities** | ❌ Hidden |
| **Citizen contact info** | ❌ Hidden (privacy) |
| **Admin notes** | ✅ Visible |
| **Other responders on same incident** | ✅ Name and status only |
| **Other responders' work** | ❌ Hidden |
| **Analytics** | ❌ Hidden |
| **Own performance metrics** | ✅ Visible |

### Access by Responder Type

| Feature | Police | Fire | Medical | Engineering | SAR | Social Welfare | General |
|---------|--------|------|---------|--------------|-----|----------------|---------|
| View all dispatched reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Type-filtered dispatches | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Request same-type backup | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Request other-type backup | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cross-municipality response | ❌ | ❌ | ❌ | ❌ | ✅* | ❌ | ❌ |

*Exception: SAR teams can cross municipal lines for search operations

---

## Interface Design

### Mobile-First Bottom Navigation (4 Tabs)

```
┌─────────────────────────────────────────┐
│  ← Bantayog Alert  🆘  🔔  📍  👤     │ ← Top bar (SOS always visible)
├─────────────────────────────────────────┤
│                                         │
│           [CONTENT AREA]                │
│                                         │
├─────────────────────────────────────────┤
│  📋 Dispatches │ 🗺️ Map │ 💬 Messages │
│  👤 Profile                                    │
└─────────────────────────────────────────┘
```

**🆘 SOS Button (Top Right - Always Visible)**
- Red, prominent emergency button
- Hold for 3 seconds to activate (prevent accidents)
- Sends immediate distress signal to ALL admins
- Includes: last known location, active incident
- Push notification to admins: "🆘 RESponder X SOS - Incident #0471"
- Admin sees: "EMERGENCY: Responder X activated SOS"
- One-tap to call responder, one-tap to dispatch backup

### Tab 1: Dispatches (Default Home Screen)

**Purpose:** See assigned dispatches and manage responses

**Layout:**
```
┌─────────────────────────────────────────┐
│  Your Dispatches                       │
│                                        │
│  🔴 New (2)  🟡 Active (1)  🟢 Done    │
├─────────────────────────────────────────┤
│  🚨 NEW DISPATCH                      │
│     Flood - High Severity              │
│     Barangay San Jose, Daet             │
│     Dispatched 5 min ago               │
│     From: Admin Maria Santos            │
│                                        │
│     [Accept Dispatch] [Decline]        │
├─────────────────────────────────────────┤
│  🚨 NEW DISPATCH                      │
│     Landslide - Medium Severity         │
│     Barangay Malag, Labo                │
│     Dispatched 12 min ago              │
│     From: Admin Juan Dela Cruz          │
│                                        │
│     [Accept Dispatch] [Decline]        │
├─────────────────────────────────────────┤
│  🟡 ACTIVE DISPATCH                   │
│     Fire - High Severity               │
│     Poblacion, Vinzons                 │
│     Status: On Scene (In Progress)     │
│     Dispatched 45 min ago              │
│     [View Details]                     │
└─────────────────────────────────────────┘
```

**Features:**
- Pull to refresh
- Filter by status: `New` | `Active` | `Done` | `All`
- Filter by severity: `🔴 High` | `🟡 Medium` | `🟢 Low`
- Sort by: `Newest` | `Severity` | `Distance`
- Tap dispatch → full details

**Empty State (No Dispatches):**
```
┌─────────────────────────────────────────┐
│  ✓ All Caught Up!                      │
│                                        │
│  You have no active dispatches.        │
│  Stay ready — new dispatches will      │
│  appear here.                          │
│                                        │
│  [View Past Dispatches]                │
│  [Set Availability: Available]         │
└─────────────────────────────────────────┘
```

**Quick Status Toggles (For Active Dispatches)**
```
┌─────────────────────────────────────────┐
│  🚨 Flood - Active                     │
│  Status: In Progress                   │
│                                        │
│  Quick Updates:                        │
│  [📍 On Scene] [🔄 Working] [✅ Done] │
│  [🆘 Need Backup] [📞 Call Admin]     │
│                                        │
│  One tap → immediate status update      │
└─────────────────────────────────────────┘
```

**Features:**
- Pull to refresh
- Filter by status: `New` | `Active` | `Done` | `All`
- Filter by severity: `🔴 High` | `🟡 Medium` | `🟢 Low`
- Sort by: `Newest` | `Severity` | `Distance`
- Tap dispatch → full details
- **Quick toggles for fast status updates** (one-tap instead of multi-step)

### Tab 2: Map

**Purpose:** Navigate to incident locations and see operational area

**Layout:**
```
┌─────────────────────────────────────────┐
│  🗺️ Operational Map                   │
│                                        │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │      [MAP DISPLAY]              │   │
│  │   ┌─────────────────────────┐   │   │
│  │   │  🔴 YOUR LOCATION       │   │   │
│  │   │    (blue dot)           │   │   │
│  │   │                         │   │   │
│  │   │  📍 INCIDENT #0471      │   │   │
│  │   │    (3.2 km away)        │   │   │
│  │   │                         │   │   │
│  │   │  📍 INCIDENT #0472      │   │   │
│  │   │    (assigned to you)    │   │   │
│  │   └─────────────────────────┘   │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                        │
│  ☑ Show only my assignments            │
│  ☑ Show route to incident              │
│  ☐ Traffic view                        │
└─────────────────────────────────────────┘
```

**Features:**
- Blue dot: Your current location
- Red pins: Your assigned incidents
- Tap pin → show incident summary + [Navigate] button
- [Navigate] → opens maps app (Google Maps, Waze, etc.)
- Toggle: Show all incidents / Only mine
- Toggle: Traffic view (for route planning)
- Offline map caching (for areas with poor signal)

### Tab 3: Messages (Admin Communication)

**Purpose:** Two-way communication with admins

**Layout:**
```
┌─────────────────────────────────────────┐
│  💬 Messages                           │
├─────────────────────────────────────────┤
│  🚨 Incident #0471 - Flood            │
│  Barangay San Jose, Daet                │
│                                        │
│  Admin Maria Santos 14:30              │
│  Please confirm: Do you need boat      │
│  team? Water is rising faster than     │
│  reported.                             │
│                                        │
│  You 14:32                             │
│  Yes, please send boat team. We're     │
│  at the bridge now. Water is waist-    │
│  deep.                                 │
│                                        │
│  Admin Maria Santos 14:35              │
│  Boat team dispatched. ETA 15 min.     │
│  Captain: Jose Reyes                   │
│                                        │
│  [Type a message...]                   │
└─────────────────────────────────────────┘
```

**Features:**
- Grouped by incident (not contact)
- Shows admin name and time
- Push notifications for new messages
- Messages are part of permanent incident record
- Can attach photos to messages
- Offline queue: sends when connection restored

**Message Types:**
```
┌─────────────────────────────────────────┐
│  [📝 Message] [📷 Photo]                │
│  [📞 Call Admin] [🆘 Request Backup]   │
└─────────────────────────────────────────┘
```

**One-Tap Call Admin (PHASE 1):**
- Direct phone call to admin's registered number
- Opens phone dialer (not in-app calling)
- Auto-logs: "Called admin at 14:32"
- Faster than typing for urgent communication
- Works even when data connection is poor
- Critical for urgent communication

### Tab 4: Profile

**4a. Your Info**
```
┌─────────────────────────────────────────┐
│  👤 Officer Juan Dela Cruz             │
│  🚒 Type: Fire Responder               │
│  📍 Station: Daet Fire Station         │
│  📧 juan@fire.gov.ph                   │
│  📱 0917 123 4567                      │
│                                        │
│  [Edit Profile]                        │
└─────────────────────────────────────────┘
```

**4b. Availability Status**
```
┌─────────────────────────────────────────┐
│  🟢 Current Status                     │
│                                        │
│  You are AVAILABLE for dispatch        │
│                                        │
│  [Set Unavailable] [Go Off-Duty]       │
└─────────────────────────────────────────┘
```

**Status Options:**
- 🟢 **Available** — Ready to accept dispatches
- 🟡 **Unavailable** — Temporarily unable (in meeting, on break, etc.)
  - Requires reason: `On break` | `In meeting` | `On another call` | `Other`
  - Optional: "Until [time]"
- 🔴 **Off-Duty** — Not working (end of shift, day off, sick leave)
  - Requires reason: `Shift ended` | `Sick leave` | `Training` | `Other`
  - Optional: "Until [date/time]"

**4c. Your Statistics**
```
┌─────────────────────────────────────────┐
│  📊 Your Performance (This Month)      │
├─────────────────────────────────────────┤
│  Dispatches received:     23           │
│  Dispatches accepted:     21           │
│  Dispatches declined:     2            │
│  Incidents resolved:      19           │
│  Unable to complete:      2            │
│                                        │
│  Average response time:    18 minutes  │
│  Average resolution time: 2.3 hours    │
│  Completion rate:         90%          │
└─────────────────────────────────────────┘
```

**4d. Settings**
```
┌─────────────────────────────────────────┐
│  ⚙️ Settings                           │
├─────────────────────────────────────────┤
│  🔔 Notifications                       │
│     ☑ Push notifications               │
│     ☑ Sound for new dispatches         │
│     ☑ Vibration for urgent             │
│                                        │
│  📍 Location                           │
│     ☑ Share location with admin        │
│       (while on active dispatch)       │
│     ☐ Background location (battery)    │
│                                        │
│  📶 Data & Storage                     │
│     ☑ Offline mode                     │
│     Storage used: 45 MB                 │
│     [Clear cache]                       │
│                                        │
│  🚪 Log Out                            │
└─────────────────────────────────────────┘
```

---

## Core Features

### 0. SOS Emergency Button (PHASE 1 - CRITICAL SAFETY)

**Purpose:** Immediate distress signal when responder is in trouble

**Activation:**
```
Top-right corner: 🆘 SOS button (always visible)
→ Hold for 3 seconds to activate
→ Prevents accidental activation
```

**When Activated:**
```
┌─────────────────────────────────────────┐
│  🆘 SOS ACTIVATED                      │
│                                        │
│  Emergency signal sent to all admins.  │
│                                        │
│  Your location: Barangay San Jose, Daet │
│  Active incident: #0471 (Flood)         │
│                                        │
│  Stay where safe. Help is coming.       │
│                                        │
│  [Cancel SOS] (if accidental)           │
└─────────────────────────────────────────┘
```

**What Admins Receive:**
- Urgent push notification: "🆘 RESponder X SOS - Incident #0471"
- Admin dashboard highlights SOS in red
- One-tap to call responder immediately
- One-tap to dispatch backup
- Location highlighted on map

**Use Cases:**
- Responder injured or trapped
- Equipment failure
- Scene becomes too dangerous
- Responder in distress
- Need immediate backup

**Canceling SOS:**
```
If activated accidentally:
→ [Cancel SOS] button available for 30 seconds
→ Requires confirmation: "Are you sure? This is an emergency."
→ After 30 seconds: cannot cancel (admins must respond)
```

### 1. Opt-In Dispatch Acceptance

**Purpose:** Responders choose which dispatches to accept

**Flow:**
```
1. Receive new dispatch notification
2. Open app → See in "Dispatches" tab
3. Review incident details:
   - Type and severity
   - Location and distance
   - Admin notes
   - Estimated response time
4. Choose: [Accept Dispatch] or [Decline]
```

**Accept Decision Time:**
- **5 minutes** to accept or decline
- After 5 min: Auto-escalated to next available responder
- Notification: "Dispatch expired — reassigned to Responder X"

**Declining a Dispatch:**
```
┌─────────────────────────────────────────┐
│  Decline this dispatch?                │
│                                        │
│  Please select a reason:               │
│  ○ Unable to respond (not available)   │
│  ○ Already on another assignment       │
│  ○ Too far away (distance issue)       │
│  ○ Not my specialization type          │
│  ○ Vehicle/equipment issue              │
│  ○ Safety concern (hazardous conditions)│
│  ○ Other (please specify)              │
│                                        │
│  [Cancel Decline]  [Confirm Decline]   │
└─────────────────────────────────────────┘
```

**Decline Consequences:**
- Admin sees decline reason
- Incident reassigned to next responder
- No penalty for legitimate declines
- Chronic pattern: flagged for admin review

**Accepting a Dispatch:**
```
┌─────────────────────────────────────────┐
│  ✓ Dispatch Accepted!                  │
│                                        │
│  Incident: Flood - High                │
│  Location: Barangay San Jose, Daet      │
│  Distance: 3.2 km                      │
│                                        │
│  [Navigate to Location]                │
│  [View Full Details]                   │
│  [Message Admin]                       │
└─────────────────────────────────────────┘
```

### 2. Incident Status Updates

**Purpose:** Track progress through response lifecycle

**Status Workflow:**
```
pending → acknowledged → in_progress → resolved
```

**Status Options:**

#### A. Acknowledged (On My Way)
```
┌─────────────────────────────────────────┐
│  Update Status: Acknowledged           │
│                                        │
│  You are en route to the incident.     │
│                                        │
│  Estimated arrival:                    │
│  ⏱️ [15 minutes] (editable)            │
│                                        │
│  Notes (optional):                     │
│  ┌─────────────────────────────────┐   │
│  │ Leaving station now. Traffic is │   │
│  │ light on Daet - Vinzons road.   │   │
│  └─────────────────────────────────┘   │
│                                        │
│  [Add Photo] [Update Status]           │
└─────────────────────────────────────────┘
```

**When to use:** Immediately after accepting dispatch

**Admin sees:** "Responder X acknowledged — ETA 15 min"

#### B. In Progress (On Scene / Working)
```
┌─────────────────────────────────────────┐
│  Update Status: In Progress            │
│                                        │
│  You are now working on the incident.  │
│                                        │
│  Situation update:                     │
│  ┌─────────────────────────────────┐   │
│  │ On scene. Water is waist-deep.  │   │
│  │ 3 houses affected. 2 people     │   │
│  │ trapped on roof. Need boat.     │   │
│  └─────────────────────────────────┘   │
│                                        │
│  ☑ Attach photo (recommended)          │
│                                        │
│  [Request Backup] [Update Status]      │
└─────────────────────────────────────────┘
```

**When to use:** Upon arrival at incident

**Admin sees:** "Responder X on scene — requesting boat team"

#### C. Resolved (Complete)
```
┌─────────────────────────────────────────┐
│  Update Status: Resolved               │
│                                        │
│  Incident has been resolved.           │
│                                        │
│  Resolution summary:                   │
│  ┌─────────────────────────────────┐   │
│  │ All 3 people rescued. Water     │   │
│  │ receding. No injuries. Road     │   │
│  │ cleared. Houses damaged but     │   │
│  │ habitable after cleanup.        │   │
│  └─────────────────────────────────┘   │
│                                        │
│  📸 Attach photo of resolved scene     │
│     (required for proof of work)       │
│                                        │
│  ⏱️ Time on scene: 2 hours 15 min     │
│  📍 Location verified: ☑               │
│                                        │
│  [Submit Resolution]                   │
└─────────────────────────────────────────┘
```

**When to use:** When work is complete and scene is safe

**Proof of Work Requirements:**
- ✅ Photo of resolved scene (required)
- ✅ Geolocation verified (must be at incident location)
- ✅ Timestamp auto-recorded
- ✅ Resolution summary (required)

**Admin sees:** "Responder X resolved incident — 3 rescued, 0 injured"

### 3. Unable to Complete (Alternative Path)

**Purpose:** Handle situations where responder cannot complete the assignment

```
┌─────────────────────────────────────────┐
│  Unable to Complete This Dispatch      │
│                                        │
│  Please select a reason:               │
│  ○ Cannot access location              │
│     (flooded road, landslide, etc.)    │
│  ○ Scene too dangerous (risk to life)  │
│  ○ Requires different specialization   │
│     (need structural engineer, etc.)   │
│  ○ Incident escalated (provincial)     │
│  ○ Lack of equipment/resources         │
│  ○ Duplicate/false alarm               │
│  ○ Other (please specify)              │
│                                        │
│  Details:                              │
│  ┌─────────────────────────────────┐   │
│  │ Road blocked by fallen tree.    │   │
│  │ Need chainsaw team before we    │   │
│  │ can proceed.                    │   │
│  └─────────────────────────────────┘   │
│                                        │
│  📸 Attach photo (recommended)          │
│                                        │
│  ☑ Request reassignment                │
│  ☑ Request additional resources        │
│                                        │
│  [Submit] [Cancel]                     │
└─────────────────────────────────────────┘
```

**What Happens:**
- Incident goes back to admin for reassignment
- Admin sees full context (reason + photo)
- Responders can request specific resources
- No penalty — legitimate operational reality

### 4. Request Backup / Resources

**Purpose:** Signal need for additional help

```
┌─────────────────────────────────────────┐
│  Request Backup / Resources            │
│                                        │
│  What do you need?                     │
│                                        │
│  ☑ Additional responders              │
│     Count: [2] (specific number)       │
│                                        │
│  ☑ Specialized teams                  │
│     ☐ Boat team                       │
│     ☐ Medical team                    │
│     ☐ Search & rescue                 │
│     ☐ Engineering (heavy equipment)    │
│     ☐ Social welfare (evacuation)     │
│     ☐ Other: _____________             │
│                                        │
│  ☑ Equipment / supplies               │
│     ┌─────────────────────────────────┐│
│     │ Need: chainsaw, first aid kits,││
│     │ flashlight, sandbags            ││
│     └─────────────────────────────────┘│
│                                        │
│  Priority:                             │
│  ○ Urgent (life-threatening)           │
│  ○ Soon (within 30 min)                │
│  ○ When available (not urgent)         │
│                                        │
│  Notes:                                │
│  ┌─────────────────────────────────┐   │
│  │ Water rising fast. People trap- │   │
│  │ ped on roofs. Need boat ASAP.   │   │
│  └─────────────────────────────────┘   │
│                                        │
│  [Send Request] [Cancel]               │
└─────────────────────────────────────────┘
```

**Admin receives:**
- Urgent push notification
- Request details + incident context
- One-tap approval to dispatch additional resources

### 5. Request Escalation (Provincial Level)

**Purpose:** Escalate beyond municipal capacity

```
┌─────────────────────────────────────────┐
│  Request Provincial Escalation         │
│                                        │
│  This incident requires provincial     │
│  resources beyond municipal capacity.  │
│                                        │
│  Reason for escalation:                │
│  ○ Multiple casualties (>5 people)     │
│  ○ Large-scale evacuation needed       │
│     (>50 people)                       │
│  ○ Specialist team required            │
│     (diving, canine, aerial, etc.)     │
│  ○ Inter-municipal coordination        │
│  ○ Infrastructure damage (bridge, etc.) │
│  ○ Other: _____________                │
│                                        │
│  Details:                              │
│  ┌─────────────────────────────────┐   │
│  │ Bridge collapsed. 100+ people   │   │
│  │ stranded. Need provincial       │   │
│  │ engineering and aerial rescue.  │   │
│  └─────────────────────────────────┘   │
│                                        │
│  📸 Attach photo (required)            │
│                                        │
│  [Request Escalation] [Cancel]         │
└─────────────────────────────────────────┘
```

**What Happens:**
- Notifies provincial superadmin
- May deploy provincial resources
- Incident flagged for coordination

### 6. Quick Status Updates (PHASE 1)

**Purpose:** Fast, one-tap status updates for frequent changes

**Available On:**
- Home screen (active dispatches)
- Incident detail view
- Quick actions menu

**Quick Actions:**
```
┌─────────────────────────────────────────┐
│  Quick Status Updates                   │
│                                        │
│  [📍 On Scene] — Update to "In Progress"│
│  [🔄 Working] — Add progress note       │
│  [✅ Done] — Mark as resolved           │
│  [🆘 Need Backup] — Request backup      │
│  [📞 Call Admin] — Call admin directly  │
└─────────────────────────────────────────┘
```

**How It Works:**
- One tap → immediate status update
- Timestamps automatically
- Optional: add note after update
- Reduces 10+ taps to 1 tap
- Encourages frequent updates

**Behind the Scenes:**
- [📍 On Scene] → Changes status to "in_progress", adds note "On scene"
- [🔄 Working] → Opens "Add note" modal for progress update
- [✅ Done] → Opens resolution summary modal
- [🆘 Need Backup] → Opens backup request modal
- [📞 Call Admin] → Initiates phone call to admin

### 7. Team Coordination (PHASE 1 - Basic)

**Purpose:** See other responders on same incident (visibility only, NO chat)

**Incident Detail View → Team Tab:**
```
┌─────────────────────────────────────────┐
│  👥 Team on Incident #0471             │
├─────────────────────────────────────────┤
│  🚒 You (Fire Responder)               │
│     Status: On Scene (In Progress)      │
│     Location: Barangay San Jose          │
│     Last update: 2 min ago               │
│                                        │
├─────────────────────────────────────────┤
│  👮 Responder A (Police)               │
│     Status: On Scene (In Progress)      │
│     Location: Barangay San Jose          │
│     Last update: 5 min ago               │
│     Assigned: Zone A evacuation          │
│     [View on Map]                       │
│                                        │
├─────────────────────────────────────────┤
│  🚒 Responder B (Fire)                  │
│     Status: En Route (Acknowledged)     │
│     ETA: 8 minutes                      │
│     Assigned: Zone B evacuation          │
│     [View on Map]                       │
│                                        │
├─────────────────────────────────────────┤
│  💡 Admin Note:                        │
│  "Coordinate zones - avoid duplication" │
└─────────────────────────────────────────┘
```

**What's Included:**
- See all responders on same incident
- See each responder's status and location
- See last update time
- See assignments (if set by admin)
- View on map
- NO direct messaging (go through admin)

**What's NOT Included (Phase 2):**
- ❌ Team chat (deferred to Phase 2)
- ❌ Direct responder-to-responder messaging
- ❌ Assigning tasks to other responders

### 8. Incident History & Timeline (PHASE 1)

**Purpose:** Context on what happened before responder arrived

**Incident Detail View → Timeline Tab:**
```
┌─────────────────────────────────────────┐
│  📋 Incident Timeline                  │
├─────────────────────────────────────────┤
│  12:00 — Citizen submitted report       │
│          "Flood rising fast, need help" │
│  12:15 — ✓ Verified by Admin Maria     │
│          Severity upgraded to HIGH       │
│  12:30 — Dispatched to Responder X     │
│          Status: Declined (out of area) │
│  13:00 — Dispatched to Responder Y     │
│          Status: Declined (vehicle broke)│
│  13:30 — Dispatched to Responder Z     │
│          Status: No response (timeout)  │
│  14:00 — Dispatched to YOU              │
│          Reason: You were closest       │
│  14:05 — ✓ You acknowledged             │
│          ETA: 10 minutes                 │
├─────────────────────────────────────────┤
│  📝 Admin Notes:                       │
│  "Situation worsening. Water level      │
│   rising faster than initial report.    │
│   Please prioritize evacuation.         │
│   Citizens reported trapped on roofs."  │
└─────────────────────────────────────────┘
```

**Why This Matters:**
- Responder understands urgency
- Knows why they were dispatched
- Sees previous attempts (doesn't feel like "why me?")
- Has admin context for field decisions
- Can anticipate challenges

### 9. Equipment Checklist (PHASE 1)

**Purpose:** Ensure responders bring appropriate gear

**Shown When Accepting Dispatch:**
```
┌─────────────────────────────────────────┐
│  🎒 Recommended Equipment               │
├─────────────────────────────────────────┤
│  For Flood - High Severity:             │
│                                        │
│  Standard Gear:                         │
│  ☑ Waterproof boots                    │
│  ☑ Life vests (if available)           │
│  ☑ First aid kit                       │
│  ☑ Rescue rope (20+ meters)             │
│  ☑ Flashlight + spare batteries         │
│  ☑ Radio/communication device           │
│                                        │
│  📋 Special Equipment Needed:           │
│  🚤 Boat team (admin dispatched)        │
│  ⚠️ Water depth: Waist-deep (report)   │
│                                        │
│  [I have this equipment]                │
│  [Need different gear]                  │
└─────────────────────────────────────────┘
```

**Responder acknowledges:**
- [I have this equipment] → Proceeds to incident
- [Need different gear] → Notifies admin, can decline or request equipment

**Admin sees:**
- Which equipment responder confirmed
- Whether responder needs additional resources
- Can adjust dispatch if needed

### 10. Pre-Arrival Information (PHASE 1)

**Purpose:** Prepare responders for what to expect on scene

**Incident Detail View → Situation Tab:**
```
┌─────────────────────────────────────────┐
│  📋 Reported Situation                 │
├─────────────────────────────────────────┤
│  People Affected:                      │
│  ○ Unknown (2+ hours ago)              │
│  ○ 1-5 people                          │
│  ○ 6-20 people                         │
│  ○ 20+ people                          │
│                                        │
│  Injuries Reported:                    │
│  ☑ Yes - Life-threatening              │
│  ☐ Yes - Not life-threatening          │
│  ☐ No injuries reported                │
│  ☐ Unknown                            │
│                                        │
│  Citizen Report (verbatim):            │
│  "Flood waters rising fast. One person  │
│   not breathing. Two others injured but │
│   conscious. People trapped on roofs.   │
│   Need boats and medical help ASAP!"    │
│                                        │
│  Environment:                          │
│  • Water depth: Waist-deep (estimated)  │
│  • Current speed: Fast (dangerous)      │
│  • Time of day: Night (poor visibility) │
│  • Weather: Raining (getting worse)     │
└─────────────────────────────────────────┘
```

**How This Helps:**
- Responder knows severity before arriving
- Can prepare appropriate equipment
- Can request additional resources if needed
- Adjusts expectations and tactics

### 11. Communication Channels (PHASE 1)

**Purpose:** Clear communication between responders and admins

**Communication Architecture:**

```
Responder → Admin:
┌─────────────────────────────────────────┐
│  Communication Options                 │
│                                        │
│  1. [📞 Call Admin] One-tap call       │
│     • Opens phone dialer               │
│     • Calls admin's registered number  │
│     • Auto-logs: "Called admin at 14:32"│
│     • Works even without data          │
│                                        │
│  2. [📝 Message] Text message          │
│     • In-app text message              │
│     • Admin receives notification      │
│     • For non-urgent communication     │
│                                        │
│  3. External: Facebook Messenger       │
│     • Admin's Messenger link           │
│     • For two-way conversation         │
│     • Opens Messenger app              │
└─────────────────────────────────────────┘
```

**Admin → Responder:**
- Phone call (to responder's registered number)
- Push notification (dispatch alerts, status updates)
- In-app notification (message in app)

**Important Notes:**
- ❌ NO voice messages in app (removed - not building chat)
- ❌ NO in-app calling (opens phone dialer instead)
- ✅ Phone numbers REQUIRED for all responders and admins
- ✅ Facebook Messenger used for two-way conversations
- ✅ Phone calls used for urgent communication

### 12. Field Notes & Photo Documentation

**Purpose:** Document observations and progress

**Add Field Note:**
```
┌─────────────────────────────────────────┐
│  Add Field Note                        │
│                                        │
│  Incident #0471 - Flood                │
│                                        │
│  Your note:                            │
│  ┌─────────────────────────────────┐   │
│  │ 1430H: Water level rising.      │   │
│  │ Currently at 4 feet. Rate: ~6    │   │
│  │ inches per hour.                 │   │
│  │                                  │   │
│  │ 1500H: Evacuation started for    │   │
│  │ Zone A households. 15 families   │   │
│  │ moved to barangay hall.          │   │
│  └─────────────────────────────────┘   │
│                                        │
│  📷 Attach photos (up to 5)             │
│                                        │
│  Note type:                            │
│  ○ General observation                 │
│  ○ Situation update                    │
│  ○ Safety concern                      │
│  ○ Resource need                       │
│                                        │
│  [Save Note] [Cancel]                  │
└─────────────────────────────────────────┘
```

**Note Features:**
- Timestamped automatically
- Geotagged (if location enabled)
- Visible to admins
- Part of permanent incident record
- Cannot be edited (append-only)

**Upload Photo:**
```
┌─────────────────────────────────────────┐
│  Add Photo                             │
│                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  [+]    │ │ [Photo] │ │ [Photo] │  │
│  │  Take   │ │  2.1MB  │ │  1.9MB  │  │
│  │  photo  │ │  [X]    │ │  [X]    │  │
│  └─────────┘ └─────────┘ └─────────┘  │
│                                        │
│  Caption (optional):                   │
│  ┌─────────────────────────────────┐   │
│  │ Water level at 1500H            │   │
│  └─────────────────────────────────┘   │
│                                        │
│  [Upload] [Cancel]                     │
└─────────────────────────────────────────┘
```

---

## Dispatch Workflow

### Complete Lifecycle

```
┌──────────────────┐
│   Admin creates │
│   dispatch      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Responder       │
│ receives        │
│ notification    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 5 min timer      │
│ starts          │
└──────┬───────────┘
       │
       ├─────────────┬─────────────┐
       │             │             │
       ▼             ▼             ▼
   [Accept]    [Decline]   [No response]
       │             │             │
       │             ▼             ▼
       │        Admin sees      Auto-escalate
       │        reason         (5 min elapsed)
       │             │             │
       ▼             │             │
┌──────────────┐    │        ┌────┴─────┐
│ Responder    │    │        │ Notify   │
│ acknowledged │    │        │ next     │
│ ETA: 15 min  │    │        │ responder│
└──────┬───────┘    │        └──────────┘
       │           │
       ▼           │
┌──────────────┐   │
│ En route     │   │
│ (optional:  │   │
│  update ETA)│   │
└──────┬───────┘   │
       │           │
       ▼           │
┌──────────────┐   │
│ On scene     │   │
│ Update:      │   │
│ in_progress  │   │
└──────┬───────┘   │
       │           │
       ▼           │
┌──────────────┐   │
│ Working      │   │
│ Add notes,  │   │
│ photos       │   │
└──────┬───────┘   │
       │           │
       ├───────────┤
       ▼           ▼
   [Resolved] [Unable]
       │           │
       │           ▼
       │      ┌─────────┐
       │      │ Admin   │
       │      │ reassign│
       │      └─────────┘
       ▼
┌──────────────┐
│ Complete    │
│ Admin closes │
│ incident    │
└──────────────┘
```

### Timeout & Escalation

**Responder Not Responding:**
```
0 min  — Dispatch sent
5 min  — Reminder notification: "Respond to dispatch #0471?"
10 min — Auto-escalate to next available responder
       — Notify admin: "Responder X not responding"
       — Log: "Dispatched to X at 14:00, reassigned to Y at 14:10"
```

**Responder Takes Too Long:**
```
If not acknowledged within 15 min:
→ Incident marked as "delayed response"
→ Admin notified
→ Can dispatch additional responder
```

---

## On-Duty Management

### Availability States

```
┌─────────────────────────────────────────┐
│  Set Your Status                       │
│                                        │
│  Current: 🟢 Available                  │
│                                        │
│  Change to:                            │
│  🟢 Available                          │
│     Ready to accept dispatches          │
│                                        │
│  🟡 Unavailable                        │
│     Temporarily unable to respond       │
│     Reason: [On break] ▼                │
│     Until: [optional time]              │
│                                        │
│  🔴 Off-Duty                           │
│     Not working today                   │
│     Reason: [Shift ended] ▼             │
│     Until: [08:00 tomorrow]             │
│                                        │
│  [Save] [Cancel]                       │
└─────────────────────────────────────────┘
```

**Unavailable Reasons:**
- On break
- In meeting
- On another call
- Training
- Vehicle maintenance
- Equipment issue
- Other (specify)

**Off-Duty Reasons:**
- Shift ended
- Day off
- Sick leave
- Vacation
- Training course
- Other (specify)

### Schedule Management (Future Enhancement)

**Not in Phase 1** — planned for future:
- Shift scheduling
- Calendar view
- Swap shifts with other responders
- Overtime tracking

---

## Communication Tools

### Admin-Responder Messaging

**Message Types:**

1. **General Message**
   - Free-form text
   - For questions, clarifications, updates

2. **Urgent Message**
   - Marked as urgent (push notification + sound)
   - For time-critical info

3. **Photo Message**
   - Admin sends photo (map, diagram, reference)
   - Responder can send photo (scene, damage)

**Message Flow:**
```
Admin → "Is the road passable?"
You → "No, bridge is out. Need alternate route."
Admin → "Take the Daet - Labo road instead. Adding 10 min."
You → "Copy that. Rerouting now."
```

### Broadcast Messages (Admin to All Responders)

**Not in Phase 1** — planned for future:
- Weather warnings
- System notifications
- All-responder announcements

---

## Shift Handoff

### When Shift Changes

**Scenario:** Responder A has been working on incident for 6 hours. Shift change. Responder B takes over.

**Handoff Flow:**

**Responder A (Outgoing):**
```
┌─────────────────────────────────────────┐
│  Shift Change — Handoff Required        │
│                                        │
│  Incident #0471 - Flood                │
│                                        │
│  Handoff note:                         │
│  ┌─────────────────────────────────┐   │
│  │ Work completed:                 │   │
│  │ - Evacuated 15 families         │   │
│  │ - Set up command post           │   │
│  │                                 │   │
│  │ In progress:                    │   │
│  │ - Still searching for 2 missing │   │
│  │ - Water level stable at 4ft     │   │
│  │                                 │   │
│  │ Next steps:                     │   │
│  │ - Continue search in Zone B     │   │
│  │ - Monitor water level hourly    │   │
│  │ - Coordinate with barangay capt │   │
│  └─────────────────────────────────┘   │
│                                        │
│  📸 Attach current photos (required)    │
│                                        │
│  Handoff to: Responder B               │
│  ☑ Notify Responder B                  │
│                                        │
│  [Complete Handoff]                    │
└─────────────────────────────────────────┘
```

**Responder B (Incoming):**
```
┌─────────────────────────────────────────┐
│  🚨 Incident Handed Over to You         │
│                                        │
│  Incident #0471 - Flood                │
│  From: Responder A                     │
│                                        │
│  Handoff note:                         │
│  [Read full note...]                   │
│                                        │
│  Photos attached: 3                     │
│  [View photos]                         │
│                                        │
│  Your status: In Progress              │
│  You are now the assigned responder.    │
│                                        │
│  ⏰ You must acknowledge within 15 min  │
│                                        │
│  [Accept Handoff] [View Full Incident]  │
└─────────────────────────────────────────┘
```

**PHASE 1: Push Notification for Handoff**
```
Responder B receives immediate push notification:
→ "🚨 Incident #0471 handed to you by Responder A"
→ Taps → Opens handoff details
→ Must explicitly accept: "Incident accepted"

If Responder B doesn't accept within 15 min:
→ Notify admin: "Handoff not accepted — Responder B not responding"
→ Admin can reassign to different responder
→ Prevents coverage gaps during shift changes
```

**Handoff Record in Timeline:**
```
├─ 14:00 — Responder A acknowledged
├─ 14:15 — Responder A on scene
├─ 20:00 — Responder A: Shift handoff to Responder B
└─ 20:05 — Responder B took over
```

---

## Performance & History

### Dispatch History

```
┌─────────────────────────────────────────┐
│  Your Dispatch History                  │
│                                        │
│  Filter: [This Month] ▼                │
├─────────────────────────────────────────┤
│  🚨 Flood - Resolved                  │
│     Barangay San Jose, Daet             │
│     Apr 10, 2026                       │
│     Response time: 12 min               │
│     Resolution time: 2h 15m             │
│     [View Details]                      │
├─────────────────────────────────────────┤
│  🚨 Fire - Resolved                   │
│     Poblacion, Vinzons                 │
│     Apr 8, 2026                        │
│     Response time: 8 min                │
│     Resolution time: 45m                │
│     [View Details]                      │
├─────────────────────────────────────────┤
│  🚨 Landslide - Unable to Complete     │
│     Barangay Malag, Labo                │
│     Apr 5, 2026                        │
│     Reason: Could not access location   │
│     Reassigned to Engineering team      │
│     [View Details]                      │
└─────────────────────────────────────────┘
```

### Performance Metrics (PHASE 1)

```
┌─────────────────────────────────────────┐
│  📊 Your Performance                    │
│                                        │
│  Time Range: [This Month] ▼            │
│                                        │
│  Response                              │
│  ├─ Average response time: 18 min      │
│  ├─ Fastest: 5 min                     │
│  └─ Slowest: 45 min                    │
│                                        │
│  Completion                            │
│  ├─ Total dispatches: 23               │
│  ├─ Accepted: 21 (91%)                 │
│  ├─ Resolved: 19 (83%)                 │
│  ├─ Unable to complete: 2 (9%)         │
│  └─ Declined: 2                        │
│                                        │
│  Quality                               │
│  ├─ Avg resolution time: 2.3h          │
│  ├─ Notes added: 45                    │
│  ├─ Photos uploaded: 67                │
│  └─ Backup requested: 3                │
└─────────────────────────────────────────┘
```

**Why Phase 1:** Performance metrics are critical for accountability and continuous improvement. Responders need feedback on their response times, and admin needs data to identify training needs and operational gaps.

---

## Edge Cases & Solutions

### 1. Dispatch While on Another Assignment

**Problem:** Responder already on incident, receives new dispatch

**Solution:**
```
Before accepting new dispatch:
→ "You are currently working on Incident #0471"
→ "Do you want to:"
→   [Complete current first] [Accept new anyway]

If accept new:
→ Admin sees: "Responder X has 2 active assignments"
→ Can reassign if needed
```

### 2. Responder Needs to Communicate Hands-Free (PHASE 1)

**Problem:** Responder in emergency situation (hands full, wearing gear, driving)
- Can't type messages
- Needs urgent communication
- Text-only is too slow

**Solution (PHASE 1):**
```
One-Tap Call Admin:
→ [📞 Call Admin] button
→ Opens phone dialer (calls admin's registered number)
→ Auto-logs: "Called admin at 14:32"
→ Fallback when data connection poor
→ Works even without internet connection

External communication:
→ Facebook Messenger link (for two-way conversation)
→ Phone numbers visible (for direct calls)
```

### 3. Vehicle/Equipment Failure

**Problem:** Responder vehicle breaks down en route

**Solution:**
```
[Unable to Complete] → Select: "Vehicle/equipment issue"
→ Admin notified immediately
→ Can request: "Need replacement vehicle"
→ Incident reassigned to available responder
→ Responder can switch to "Unavailable" status
```

### 4. Safety Concern at Scene

**Problem:** Scene is too dangerous (active landslide, gunfire, etc.)

**Solution:**
```
[Unable to Complete] → Select: "Scene too dangerous"
→ Require photo + explanation
→ Admin escalates to specialized team
→ Responder NOT penalized — safety first
```

### 5. Wrong Incident Type / Mismatch

**Problem:** Fire responder dispatched to medical incident

**Solution:**
```
[Decline] → Select: "Not my specialization"
→ Admin sees mismatch
→ Can dispatch correct type
→ Responder availability restored
→ No penalty
```

### 6. Duplicate Dispatches

**Problem:** Same incident dispatched twice

**Solution:**
```
Before accepting:
→ "This may be a duplicate of Incident #0471"
→ [View suspected duplicate]
→ [This is different] [Yes, it's duplicate]

If confirmed duplicate:
→ Admin notified of error
→ Extra dispatch cancelled
→ No penalty for decline
```

### 7. Responder Doesn't Accept Within 5 Minutes

**Problem:** Responder misses notification (asleep, phone silent, etc.)

**Solution:**
```
5 min  — Reminder notification: "New dispatch: Flood - Daet"
10 min — Auto-escalate to next responder
       — Admin notified: "Responder X not responding"
       — Responder sees: "You missed dispatch #0471"
```

### 8. Connection Lost During Response

**Problem:** Responder in dead zone, can't update status

**Solution:**
```
Offline mode:
→ All updates saved locally
→ Queue indicator: "3 updates waiting to send"
→ Auto-sync when connection restored
→ Admin sees: "Last sync: 14:30 (15 min ago)"
```

### 9. Admin Cancels Dispatch

**Problem:** Incident resolved before responder arrives, or duplicate

**Solution:**
```
Responder receives: "⚠️ DISPATCH CANCELLED"
→ Reason: "Duplicate report — incident already resolved"
→ Incident removed from active dispatches
→ Responder returns to available status
→ No penalty — operational reality
```

### 10. Responder Requests Backup But None Available

**Problem:** All other responders busy

**Solution:**
```
Admin receives backup request
→ If no one available:
→ "No responders available in your municipality"
→ Options: [Request provincial] [Wait for available]
→ Admin updates responder with expected wait time
```

### 11. Responder Arrives Unprepared (PHASE 1)

**Problem:** Responder dispatched without knowing what to expect
- Doesn't know severity, number of people, injuries
- Arrives without appropriate equipment
- Wasted trip back to station

**Solution (PHASE 1):**
```
Pre-Arrival Information shown before accepting dispatch:

┌─────────────────────────────────────────┐
│  📋 What to Expect                     │
├─────────────────────────────────────────┤
│  People affected: 6-20                  │
│  Injuries: Yes, life-threatening        │
│  Water depth: Waist-deep                │
│                                        │
│  Citizen report:                       │
│  "People trapped on roofs. One not     │
│   breathing. Need boats and medical."   │
│                                        │
│  Recommended equipment:                 │
│  • Life vests                           │
│  • First aid kit                        │
│  • Rescue rope                           │
└─────────────────────────────────────────┘

Responder can prepare or decline before arriving
```

### 11. GPS Location Verification Fails (PHASE 1)

**Problem:** Responder at scene but GPS inaccurate (indoors, urban canyon, dense forest)
- App blocks status update: "You must be at incident location"
- Responder IS at location, but GPS shows 50 meters away
- Can't update status, creates confusion

**Solution:**
```
When GPS verification fails:
→ App shows: "⚠️ GPS location inaccurate (50m away)"
→ Options:
→ [Request Admin Verification] — Responder uploads photo, admin visually confirms
→ [Update Anyway with Note] — Adds note: "GPS inaccurate, responder confirms on scene"
→ [Retry GPS] — Try verification again

Admin sees: "Location verification failed — Responder requesting manual override"
→ Admin can approve: "Confirmed on scene" or "Incorrect location"

Admin Override:
→ Admin sees responder's approximate location
→ Can approve location: "Manual approval: Responder confirmed on scene via photo"
→ Responder can then update status normally
→ Prevents operational blocking
```

### 12. Responder Sees Something Not in Original Report

**Problem:** Arrive on scene, situation is different/worse than reported

**Solution:**
```
Update status → Add note: "Situation worse than reported"
→ Or: [Request Escalation]
→ Describe new situation
→ Attach photo
→ Admin sees context
→ Can dispatch additional resources
```

---

## Technical Specifications

### PWA (Progressive Web App)

Same architecture as citizen app — see citizen-role-spec.md for PWA details

### Push Notifications

**Notification Types:**

1. **New Dispatch** (High Priority)
   - Sound + Vibration
   - "🚨 NEW DISPATCH: Flood - Barangay San Jose"
   - Taps → Opens dispatch details
   - Cannot be dismissed (must accept or decline)

2. **Reminder** (Medium Priority)
   - Sound only
   - "⏰ Respond to dispatch #0471?"
   - 5 minutes after initial dispatch

3. **Message** (Normal Priority)
   - Vibration only
   - "💬 New message from Admin Maria"
   - Taps → Opens message

4. **Cancel** (High Priority)
   - Sound + Vibration
   - "⚠️ DISPATCH CANCELLED: #0471"
   - Shows reason

5. **Backup Request** (High Priority)
   - Sound + Vibration
   - "🆘 BACKUP REQUESTED: Incident #0471"
   - Shows incident details

### Offline Mode

**When Offline:**
- View assigned dispatches (cached)
- Update status (queued)
- Add notes/photos (queued)
- View map (cached tiles)
- Cannot accept NEW dispatches (requires real-time)

**Queue Indicator:**
```
📴 You're offline
→ 3 status updates waiting to send
→ Will sync when connection restored
```

### Location Services

**Purpose:** Allow admin to track responder location during active dispatch

**When Active:**
- Location shared every 30 seconds
- Only while on active dispatch
- Stops when dispatch resolved
- Admin sees: "Responder X en route — 3.2 km away"

**Privacy:**
- Responder controls: "Share location with admin (while on dispatch)"
- Can opt-out (but admin cannot track ETA)
- Not tracked when off-duty or unavailable
- Location history deleted after 24 hours

### Data Saver Mode

**For responders in areas with poor/expensive data:**
```
Settings → Data Saver Mode ON
→ Compress images (< 500KB each)
→ Low-res map tiles
→ No background sync
→ Text-only messages (no auto-image loading)
```

### Security

**Authentication:**
- Required to access responder features
- **Phone number + OTP verification REQUIRED** (admins contact responders via phone)
- Email required for account management
- Admin-verified accounts (cannot self-register as responder)
- Session timeout: 8 hours (shift length)

**Data Protection:**
- All communications encrypted (HTTPS)
- Location data encrypted in transit
- Notes and photos stored securely
- Admin-only access to responder data

---

## Metrics & Success Indicators

**Responder Engagement:**
- Dispatch acceptance rate
- Average response time
- Average resolution time
- "Unable to complete" rate
- Backup request frequency

**System Performance:**
- Time from dispatch to acceptance
- Time from acceptance to acknowledgment
- Communication frequency (messages exchanged)
- Offline usage rate
- App crashes during emergencies

**User Satisfaction:**
- Responder feedback surveys (quarterly)
- Feature usage (most-used features)
- Pain points reported
- Training completion rates

---

## Future Enhancements (Out of Scope for Phase 1)

### Phase 2 (First Quarter)
- Shift scheduling
- Broadcast messaging
- Team chat features (direct responder-to-responder messaging)
- After-action reports
- Training mode
- Offline navigation directions

### Phase 3 (Future)
- Voice commands (hands-free operation)
- Smartwatch integration
- Vehicle telemetry integration
- Live video streaming
- AR overlays for navigation
- Integration with CAD systems

---

## Support & Help

**In-App Help:**
- How-to guides for each feature
- Emergency contact numbers
- Tech support (email)
- Bug report form

**External Support:**
- MDRRMO office (walk-in)
- Station commander (in-person)
- Peer training (on-the-job)
- Regular drills and exercises

---

## Document Version

**Version:** 1.1
**Last Updated:** 2026-04-10
**Status:** Approved for implementation
**Changes from v1.0:**
- Added SOS emergency button (critical safety)
- Added quick status toggles (one-tap updates)
- Added team coordination basic (see other responders, no chat)
- Added incident timeline/history
- Added equipment checklist
- Added pre-arrival information
- Added one-tap call admin (phone calls, not in-app calling)
- Added GPS verification alternative (admin override)
- Enhanced shift handoff with notifications
- **REMOVED: Voice messages** (using phone calls + Facebook Messenger instead)
- **CLARIFIED: All two-way communication via Facebook Messenger or phone calls**
**Next Review:** After Phase 1 user testing with responders

---

**End of Responder Role Specification**
