# Citizen Role — Complete Specification

**Bantayog Alert — Disaster Reporting Platform**
**Province of Camarines Norte, Philippines**

---

## Table of Contents
1. [Role Overview](#role-overview)
2. [Permissions & Access](#permissions--access)
3. [Interface Design](#interface-design)
4. [Core Features](#core-features)
5. [Report Submission Flow](#report-submission-flow)
6. [Security & Anti-Abuse](#security--anti-abuse)
7. [Edge Cases & Solutions](#edge-cases--solutions)
8. [Privacy & Data Protection](#privacy--data-protection)
9. [Technical Specifications](#technical-specifications)

---

## Role Overview

### Who Are Citizens?

Citizens are the primary users of Bantayog Alert — residents of Camarines Norte province who report disasters and emergencies in their community.

### Primary Responsibilities
- Report incidents quickly and accurately
- Provide photos and location data
- Respond to follow-up questions from admins
- Track status of their submitted reports
- Receive official alerts and warnings

### Key Characteristics
- **Time-pressured:** Often reporting during emergencies
- **Variable tech literacy:** Some are tech-savvy, others are not
- **Mobile-first:** Primarily use smartphones, not desktops
- **Connectivity challenges:** May have poor signal or no data
- **Anonymous-first:** Many will report without creating accounts

---

## Permissions & Access

### What Citizens CAN Do

| Action | Anonymous | Registered |
|--------|-----------|------------|
| Submit reports | ✅ | ✅ |
| Upload photos/videos | ✅ | ✅ |
| Provide location | ✅ | ✅ |
| View public map | ✅ | ✅ |
| View public feed | ✅ | ✅ |
| Receive alerts | ✅ | ✅ |
| Track their own reports | ⚠️ Limited | ✅ Full |
| Edit unverified reports | ⚠️ Contact admin | ✅ Yes |
| Cancel pending reports | ❌ No | ✅ Yes |
| Update existing reports | ❌ No | ✅ Yes |
| Create account | N/A | ✅ Yes |

### What Citizens CANNOT DO

| Action | Why |
|--------|-----|
| Verify reports | Admin-only triage function |
| Classify incidents | Admin decision based on broader context |
| See private reports | Privacy protection |
| Access analytics | Admin/superadmin tool |
| Dispatch responders | Admin coordination function |
| Promote users | Admin-only |
| Delete verified reports | Data integrity (public record) |
| See reports outside their area | Privacy & relevance |

### Data Visibility Matrix

| Data Type | Anonymous | Registered (Own) | Public Feed |
|-----------|-----------|------------------|-------------|
| Report content | ✅ | ✅ | Location only |
| Photos | ✅ | ✅ | After verification |
| Exact location | ✅ | ✅ | Approximate only |
| Contact info | ✅ (provided) | ✅ | ❌ Hidden |
| Report status | ❌ (no tracking) | ✅ | Status only |
| Personal identity | ❌ Hidden | ✅ Own reports | ❌ Hidden |

---

## Interface Design

### Mobile-First Bottom Navigation (5 Tabs)

```
┌─────────────────────────────────────────┐
│  ← Bantayog Alert          🔔  👤      │ ← Top bar
├─────────────────────────────────────────┤
│                                         │
│           [CONTENT AREA]                │
│                                         │
├─────────────────────────────────────────┤
│  📍 Map  │  📋 Feed  │  🚨 Report  │   │ ← Bottom nav
│  ⚠️ Alerts │  👤 Profile             │
└─────────────────────────────────────────┘
```

### Tab 1: Map (Default Home Screen)

**Purpose:** Visual spatial awareness of incidents

**Features:**
- Auto-locate user's position
- Pins showing verified incidents
- Color-coded severity:
  - 🟢 Green = Low
  - 🟡 Yellow = Medium
  - 🔴 Red = High
- Filter controls:
  - Severity: `🟢 🟡 🔴 All`
  - Time: `Last 24h` | `Last 7 days` | `Last 30 days`
- Tap pin → summary popup

**Popup Contents:**
```
┌─────────────────────────────────┐
│ 🚨 Flood - High Severity        │
│ 📍 Barangay San Jose, Daet      │
│ 🕒 Reported 2 hours ago         │
│                                 │
│ [View Details]                  │
└─────────────────────────────────┘
```

**Details View:**
- Incident type & severity
- General location (no exact address)
- Time reported
- Current status (pending → verified → dispatched → resolved)
- NO personal info about reporter

### Tab 2: Feed (List View)

**Purpose:** Chronological browsing of incidents

**Layout:**
```
┌─────────────────────────────────────────┐
│  ☰ Filters: Last 24h ▼                 │
├─────────────────────────────────────────┤
│  🚨 Flood - High                       │
│     Barangay San Jose, Daet             │
│     2 hours ago                         │
│     Status: Dispatched                  │
├─────────────────────────────────────────┤
│  🚨 Landslide - Medium                 │
│     Barangay Malag, Labo                │
│     5 hours ago                         │
│     Status: Verified                    │
└─────────────────────────────────────────┘
```

**Features:**
- Pull to refresh
- Infinite scroll
- Tap incident → full details
- Search: by municipality or barangay
- Sort options: `Recent first` | `Severity` | `Status`

### Tab 3: Report (🚨 Prominent Center Button)

**Purpose:** Submit new disaster reports

**Entry Screen:**
```
┌─────────────────────────────────────────┐
│  Report an Incident                    │
│                                        │
│  What's happening?                     │
│  [Select incident type]                │
│                                        │
│  [Start Report] ← Big, obvious button  │
└─────────────────────────────────────────┘
```

**Incident Types:**
- 🌊 Flood
- ⛰️ Landslide
- 🔥 Fire
- 🏠 Building Collapse
- 🌪️ Storm Damage
- 🚗 Road Accident/Blockage
- 🤒 Sick/Injured Person
- ⚠️ Other (I'll describe below)

### Tab 4: Alerts (Official Warnings)

**Purpose:** Receive official government alerts

**Alert Display:**
```
┌─────────────────────────────────────────┐
│  🔔 Active Alerts                      │
├─────────────────────────────────────────┤
│  ⚠️ EVACUATION WARNING                 │
│     Flash flood in Daet                 │
│     Residents near rivers: EVACUATE     │
│     20 minutes ago                      │
│     [Read More]                         │
├─────────────────────────────────────────┤
│  📢 WEATHER ALERT                      │
│     Typhoon Signal #2 raised            │
│     Classes suspended in all levels     │
│     2 hours ago                         │
└─────────────────────────────────────────┘
```

**Features:**
- Location-based (only relevant to user's area)
- Priority levels:
  - 🔴 Emergency (evacuate now)
  - 🟡 Warning (prepare)
  - 🟢 Advisory (informational)
- Push notifications for critical alerts
- Official source badge (MDRRMO, PAGASA, etc.)

### Tab 5: Profile (Account & Settings)

**5a. Your Info**
```
┌─────────────────────────────────────────┐
│  👤 Juan Dela Cruz                     │
│  📧 juan@email.com                     │
│  📍 Daet, Camarines Norte             │
│                                        │
│  [Edit Profile]                        │
└─────────────────────────────────────────┘
```

**5b. Your Reports (My Activity)**
```
┌─────────────────────────────────────────┐
│  Your Reports (3)                      │
├─────────────────────────────────────────┤
│  🚨 Flood - Pending Verification       │
│     Barangay San Jose, Daet             │
│     Reported today at 2:30 PM           │
│     [View] [Update] [Cancel]            │
├─────────────────────────────────────────┤
│  🚨 Fallen Tree - Resolved             │
│     Poblacion, Daet                     │
│     Reported 3 days ago                 │
│     [View]                              │
└─────────────────────────────────────────┘
```

**5c. Settings**
```
┌─────────────────────────────────────────┐
│  ⚙️ Settings                           │
├─────────────────────────────────────────┤
│  🔔 Notifications                       │
│     ☑ Push notifications               │
│     ☑ Email alerts                     │
│                                        │
│  📍 Location                           │
│     ☑ Auto-detect location             │
│     ☑ Allow location access            │
│                                        │
│  📶 Data & Storage                     │
│     ☑ Use offline mode                  │
│     Storage used: 12 MB                 │
│                                        │
│  🚪 Log Out                            │
└─────────────────────────────────────────┘
```

---

## Core Features

### 1. Anonymous Reporting (Primary Flow)

**Purpose:** Fastest path to report without barriers

**Flow:**
1. Tap "Report" button
2. Provide incident details
3. Enter contact info (phone or email)
4. Submit
5. Receive Report ID

**No account required**

**Post-Submission Options:**
- "Create account to track this report"
- "Save your Report ID: #2024-DAET-0471"

### 2. Account Creation (Deferred)

**Trigger:** After using app features

**When to prompt:**
- After first report submitted
- After viewing 3+ incidents
- After tapping "Profile" tab

**Registration Flow:**
1. Enter name
2. Enter phone number **[OTP VERIFICATION REQUIRED]**
3. Enter email (optional)
4. Enter municipality & barangay
5. Set password
6. Agree to Terms & Privacy Policy

**Account Linking:**
```
"Have a report ID? Link it now"
→ Enter phone number used in anonymous report
→ System matches and links all past reports
→ Unified report history
```

### 3. Offline Mode

**Purpose:** Works when connectivity is poor or absent

**Behavior When Offline:**
- Reports save locally on device
- "Saved locally — will send when you're online" notification
- Queue indicator: "3 reports waiting to send"
- Auto-sync when connection restored

**What Works Offline:**
- Draft reports (auto-save)
- Submitted but queued reports
- Viewing cached map/feed (last known state)
- Profile viewing

**What Requires Online:**
- Submitting reports
- Refreshing map/feed
- Receiving push notifications
- Real-time status updates

### 4. Report Status Tracking

**Timeline Display:**
```
🚨 Flood - Barangay San Jose, Daet
Reported: Today, 2:30 PM

Status Timeline:
├─ 2:30 PM — 📝 Report submitted
├─ 2:45 PM — ✓ Verified by admin
├─ 3:00 PM — 🚒 Responders dispatched
├─ 3:15 PM — 📍 Responders acknowledged
└─ 4:30 PM — ✅ Resolved
```

**Push Notifications:**
- "Your report was verified"
- "Responders have been dispatched"
- "Your report has been resolved"
- "Admin has a question about your report"

### 5. Report Management

**Edit Unverified Reports:**
- Change photos, location, description
- Only works until admin verifies
- After verification: use "Request correction" instead

**Cancel Pending Reports:**
- Only if status is "pending"
- Confirmation dialog
- Permanent deletion

**Update Existing Reports:**
- Add new information to same report
- Timestamped additions
- "UPDATE at 5 PM: Water is now 6 feet deep"
- Notifies admin of update

**Request Correction (After Verification):**
- For critical corrections only
- Example: "Wrong location — it's Market Street, not Main Street"
- Sends urgent notification to admin
- Admin approves edit → updates report
- Audit trail preserved

### 6. Safety Check-Ins (Phase 2)

**Purpose:** Let loved ones know you're safe during disasters

**Flow:**
1. During major disaster, app prompts: "Are you safe?"
2. Tap "I'm safe" button
3. Shares location + safe status
4. Designated contacts can check

**Privacy:**
- Only shared people can see
- Can opt-out per check-in
- Location approximate (not exact)

### 7. Share Incident

**Purpose:** Warn neighbors about incidents

**Flow:**
1. After report submission
2. Tap [Share this alert]
3. Select app (WhatsApp, Messenger, SMS)
4. Generates message: "🚨 FLOOD in Barangay San Jose - Report to Bantayog Alert if you're in danger"

**After Verification:**
- Shareable includes official badge: "✓ VERIFIED by MDRRMO"
- Shares incident type + location only (no personal info)
- Option: "Share anonymously" (hides reporter name)

---

## Report Submission Flow

### Step 1 of 3: Evidence (Photos)

```
┌─────────────────────────────────────────┐
│  Report an Incident      Step 1 of 3   │
│  ●●○                                   │
├─────────────────────────────────────────┤
│                                        │
│  📸 Add photos or videos               │
│                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  [+]    │ │ [Photo] │ │ [Photo] │  │
│  │  Take  │ │  2.3MB  │ │  1.8MB  │  │
│  │  photo  │ │  [X]    │ │  [X]    │  │
│  └─────────┘ └─────────┘ └─────────┘  │
│                                        │
│  💡 Tip: Clear photos help us         │
│     respond faster                    │
│                                        │
│  ☐ Skip this step (no photos)         │
│                                        │
│  [← Back]  [Next: Location →]         │
└─────────────────────────────────────────┘
```

**Capabilities:**
- Take photo with camera
- Select from gallery
- Up to 5 photos
- Videos up to 30 seconds
- Preview thumbnails with file size
- Remove with [X] button
- Skip option allowed

**Data Saver Mode:**
```
Before upload:
→ "⚠️ 5 photos = ~15 MB data"
→ [Compress photos] [Upload as-is]
```

### Step 2 of 3: Location (Map)

```
┌─────────────────────────────────────────┐
│  Report an Incident      Step 2 of 3   │
│  ○●●                                   │
├─────────────────────────────────────────┤
│                                        │
│  📍 Where is this happening?           │
│                                        │
│  ┌─────────────────────────────────┐   │
│  │      [MAP DISPLAY]              │   │
│  │   (your location + pin)         │   │
│  └─────────────────────────────────┘   │
│                                        │
│  📍 Use my current location            │
│     ☑ Auto-detect (GPS)               │
│                                        │
│  Or drag pin to exact location         │
│                                        │
│  Address/landmark (optional):          │
│  ┌─────────────────────────────────┐   │
│  │ Near the bridge...              │   │
│  └─────────────────────────────────┘   │
│                                        │
│  [← Back]  [Next: Description →]      │
└─────────────────────────────────────────┘
```

**Capabilities:**
- Auto-locate via GPS
- Drag pin to adjust
- Zoom in/out
- Toggle: Satellite view / Street map
- Optional landmark reference
- **Fallback:** Dropdowns for municipality & barangay (if no GPS)

### Step 3 of 3: Description & Review

```
┌─────────────────────────────────────────┐
│  Report an Incident      Step 3 of 3   │
│  ○○●                                   │
├─────────────────────────────────────────┤
│  Describe what's happening             │
│  ┌─────────────────────────────────┐   │
│  │ Water is rising fast near the   │   │
│  │ bridge. About 3 feet deep and   │   │
│  │ still rising. People are        │   │
│  │ trapped in houses nearby.       │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                        │
│  47 / 500 characters                   │
│                                        │
│  Quick questions:                      │
│                                        │
│  1. Is anyone injured or in danger?    │
│     ○ No (1)                           │
│     ○ Yes - life-threatening (2)       │
│     ○ Yes - not life-threatening (3)  │
│     ○ I don't know (0)                 │
│                                        │
│  2. Is the situation getting worse?    │
│     ○ No, it's stable (1)              │
│     ○ Yes, getting worse (3)           │
│     ○ I don't know (2)                 │
│                                        │
│  Your contact information              │
│  📱 Phone number: *Required             │
│  ┌─────────────────────────────────┐   │
│  │ 0912 345 6789                   │   │
│  └─────────────────────────────────┘   │
│                                        │
│  📧 Email (optional):                  │
│  ┌─────────────────────────────────┐   │
│  │ juan@email.com                  │   │
│  └─────────────────────────────────┘   │
│                                        │
│  ☑ I agree to be contacted if needed  │
│  ☐ I want to report anonymously       │
│                                        │
│  ───────────────────────────────────── │
│  📋 Review your report:               │
│                                        │
│  📸 2 photos attached                  │
│  📍 Barangay San Jose, Daet            │
│  🚨 Type: Flood                       │
│  ⚠️ Severity: Admin will assess        │
│                                        │
│  ───────────────────────────────────── │
│                                        │
│  [← Back]  [Submit Report 🚨]         │
└─────────────────────────────────────────┘
```

**Validation:**
- Description: 10-500 characters
- Phone: Valid PH mobile format (09XX XXX XXXX)
- Email: Valid format (if provided)
- At least one question answered

**Anonymity Option:**
- Checkbox: "Report anonymously"
- Hides name from:
  - Public map
  - Responders
  - Municipal admins
- **Even provincial superadmins cannot see identity** (absolute anonymity)
- Only used for legal compliance (court order)

### After Submission

```
┌─────────────────────────────────────────┐
│  ✓ Report Submitted!                   │
│                                        │
│  Thank you for reporting.              │
│  Your report helps keep our            │
│  community safe.                       │
│                                        │
│  What happens next:                    │
│  • Your report will be verified        │
│    (usually within 30 minutes)         │
│  • Responders will be dispatched       │
│  • You'll get updates on status        │
│                                        │
│  📋 Report ID: #2024-DAET-0471         │
│  🕒 Submitted: 2:30 PM today           │
│                                        │
│  ⚠️ Save this Report ID if you        │
│     want to track without an account   │
│                                        │
│  [Share this alert]                    │
│  [Create account to track]             │
│  [Report another incident]             │
└─────────────────────────────────────────┘
```

**Also sends:**
- Push notification confirmation
- Email confirmation (if email provided)
- No SMS (not in scope for Phase 1)

---

## Security & Anti-Abuse

### Rate Limiting

**Per Device:**
- 1 report per hour
- 3 reports per day

**Per Phone Number:**
- 1 report per hour
- 3 reports per day

**Per IP Address:**
- 5 reports per day (prevents bulk spam from same network)

**Implementation:**
- Device fingerprinting (beyond just cookies)
- If limit reached: "You've reached the reporting limit. Please call [MDRRMO hotline] for urgent reports."

### Verification Tiers

**Priority System:**
```
Tier 1: Registered users
→ Highest priority for verification
→ Can track status
→ Can edit/cancel reports

Tier 2: Unverified with contact info
→ Medium priority
→ Phone number not OTP-verified
→ Flag: "⚠️ Phone not verified — may be unreachable"

Tier 3: Anonymous
→ Lowest priority
→ No status tracking
→ Cannot edit after submission
```

### Abuse Detection

**Flagging Triggers:**
- Chronic false reports (3+ rejected reports)
- Suspicious patterns (same location every Friday)
- Offensive content in descriptions
- Obvious pranks (e.g., "alien invasion")

**Consequences:**
- Soft ban: Require CAPTCHA for next report
- Hard ban: Block device ID (can be appealed)
- Flag for admin review

### Duplicate Detection

**Before Submission:**
```
"Someone already reported a flood in your area"
→ Report from 15 minutes ago
→ Similar location (within 500m)
→ [Add your photos to that report] [Submit as new anyway]
```

**After Submission:**
- System flags possible duplicates
- Admins see: "3 similar reports in same area"
- One-click merge tool

---

## Edge Cases & Solutions

### 1. Citizen Goes Offline Immediately After Submission

**Problem:**
- Submitted report
- Lost signal
- Can't receive notification

**Solution:**
- Submission MUST show confirmation before allowing exit
- "✓ Report submitted successfully"
- Auto-save to local: "My Reports" (offline cache)
- When back online: syncs and shows notifications

### 2. Multiple Citizens Report Same Incident

**Problem:**
- 10 reports for same flood
- Wastes verification time

**Solution:**
- Duplicate detection (above)
- Merge tool for admins
- Shows: "Merged from 3 reports"

### 3. Citizen Wants to Delete Verified Report

**Problem:**
- Realized report was mistake (e.g., controlled burn)
- Can't delete (already verified)

**Solution:**
- [Request removal] button
- Citizen types reason
- Admin approves/denies
- If approved: mark as "cancelled" not deleted (audit trail)
- Not shown on public map

### 4. Contact Info Required but No Validation

**Problem:**
- Fake phone numbers
- Can't follow up

**Solution:**
- Phone validation: Must be valid PH format
- No OTP for reports (time-critical)
- Flag: "⚠️ Phone not verified"
- Admins see flag when prioritizing

### 5. Child or Minor Using App

**Problem:**
- Minors submitting fake reports
- Legal concerns

**Solution:**
- Age verification (soft):
  - "You must be 13 or older to use this app"
  - Checkbox: "I am 13+ years old"
- No ID verification (too invasive)
- If detected underage: flag for admin review

### 6. Report Quality Issues

**Problem:**
- Blurry photos
- Vague descriptions
- Wrong location

**Solution:**
- Photo quality warning: "⚠️ This photo is quite blurry. Are you sure?"
- Description: "⚠️ Please add more details (minimum 10 characters)"
- Location: "⚠️ No GPS detected — please select from dropdowns"

### 7. Non-Emergency Reports

**Problem:**
- Reporting potholes, broken street lights
- Wastes admin time

**Solution:**
- Before submission:
  - "This app is for disasters and emergencies only"
  - [Examples of what to report] [Examples of what NOT to report]
- For non-emergencies:
  - Button: "This isn't an emergency"
  - Redirects to: municipal contact info for maintenance

### 8. Report "Not An Emergency" Path

**Redirects to:**
```
┌─────────────────────────────────────────┐
│  This isn't an emergency?               │
│                                        │
│  For non-emergency issues, contact:     │
│                                        │
│  🏢 Municipal Hall                      │
│     [Phone number set by admin]         │
│                                        │
│  🚦 MDRRMO Office                       │
│     [Phone number set by admin]         │
│                                        │
│  👮 Barangay Captain                    │
│     [Phone number set by admin]         │
│                                        │
│  [Cancel] [I understand - go back]     │
└─────────────────────────────────────────┘
```

---

## Privacy & Data Protection

### Data Privacy Act (DPA) Compliance

**Republic Act No. 10173 Requirements:**

#### 1. Privacy Policy
- Plain language (English, simple terms)
- Explains what data is collected
- Explains how data is used
- Explains who can see data
- Accessible from: Settings → Privacy Policy

#### 2. Consent for Data Collection
- Explicit opt-in checkbox: "I agree to the Terms & Privacy Policy"
- Link to full policy
- Cannot proceed without agreement
- Can withdraw consent later (deletes account, keeps reports)

#### 3. Right to Access Data
- Profile → [Download my data] button
- Generates JSON with all reports, account info
- Email within 24 hours
- Shows all data associated with account

#### 4. Right to Deletion
- Account deletion available
- Deletes: name, email, phone
- Keeps: verified reports (public record)
- Keeps: unverified reports for 6 months (analytics)
- Anonymizes: replaces name with "Citizen"

#### 5. Data Retention Policy
| Data Type | Retention Period |
|-----------|------------------|
| Anonymous reports | 1 year (analytics) |
| Registered user data | Until account deletion |
| Verified reports | Forever (public record) |
| Unverified reports | 6 months, then auto-deleted |
| Photos | Same as report |
| Location data | Same as report |
| Contact logs | 1 year |

#### 6. Breach Notification Protocol
- If breach detected:
  - Notify affected users within 72 hours
  - Email notification
  - Push notification
  - What to include: what data, what happened, what we're doing

### Anonymous Reporting Privacy

**What's Hidden:**
- Name (even from superadmins)
- Email
- Phone number (stored but hidden)
- Device ID
- IP address after 24 hours

**What's Visible:**
- Report content
- Photos
- Location (approximate on public feed)
- Timestamp

**Exception:**
- Court order can reveal identity
- Superadmins still cannot see (legal separation)

### Contact Info Visibility

**To Admins:**
- Always visible (for follow-up)

**To Responders:**
- Never visible (privacy)

**To Public:**
- Never visible

**On Public Feed:**
- Location only (no contact info)

---

## Technical Specifications

### PWA (Progressive Web App)

**Why PWA:**
- No app store approval needed
- Works on all devices (iOS, Android, desktop)
- Offline capability (service workers)
- Push notifications
- Auto-updates (no version management needed)

**Manifest:**
- Name: Bantayog Alert
- Short name: Bantayog
- Description: Disaster reporting for Camarines Norte
- Theme color: #DC2626 (red - emergency)
- Background color: #FFFFFF
- Display: standalone (looks like native app)
- Orientation: portrait-primary
- Start URL: /
- Icons: various sizes (72, 96, 128, 144, 152, 192, 384, 512)

### Service Workers

**Cache Strategy:**
```
Network first for:
→ Report submission (must go through)
→ Status updates (real-time data)

Cache first for:
→ App shell (HTML, CSS, JS)
→ Map tiles (offline viewing)
→ Public feed (last known state)
```

**Offline Handling:**
- Queue reports in IndexedDB
- Sync when connection restored
- Show queue indicator: "3 reports waiting to send"

### IndexedDB Schema

**Stores:**

1. **drafts** - Auto-saved report drafts
   - Key: timestamp
   - Fields: photos, location, description, contact
   - Expires: 24 hours

2. **queue** - Queued reports (offline)
   - Key: report ID
   - Fields: full report payload
   - Synced when online

3. **cache** - Cached map/feed data
   - Key: endpoint + params
   - Expires: 1 hour

4. **settings** - User preferences
   - Key: setting name
   - Fields: notifications, data saver, etc.

### Responsive Breakpoints

```css
/* Mobile (default) */
max-width: 767px

/* Tablet */
768px - 1023px
→ Two-column feed
→ Larger map

/* Desktop */
1024px+
→ Three-column layout
→ Sidebar navigation
→ Persistent map
```

### Performance Budgets

| Metric | Target | Why |
|--------|--------|-----|
| First Contentful Paint | < 2s | Perceived speed |
| Time to Interactive | < 5s | Usable quickly |
| Bundle size | < 500KB | Fast download on mobile data |
| Photo upload | < 30s | Reasonable wait time |
| Report submission | < 10s | Don't lose users |

### Accessibility (WCAG 2.1 AA)

**Requirements:**
- Screen reader support (VoiceOver, TalkBack)
- Keyboard navigation (all features)
- Color contrast ratio ≥ 4.5:1
- Touch targets ≥ 44x44px
- Form labels and error messages
- Focus management

**Implementation:**
- ARIA labels on all buttons
- Alt text on all images
- Skip to main content link
- Form validation with clear error messages
- High contrast mode support

### Browser Support

**Minimum:**
- Chrome 90+ (Android)
- Safari 14+ (iOS)
- Firefox 88+
- Edge 90+

**Why:**
- Service worker support
- IndexedDB support
- Push notification support
- Modern JavaScript (ES2020)

### Analytics

**Firebase Analytics:**
- Anonymous usage data only
- No personal identifiers
- Events tracked:
  - report_submitted
  - report_viewed
  - alert_received
  - app_opened
  - feature_used

**Opt-out:**
- Settings → Disable analytics
- Complies with DPA

---

## Future Enhancements (Out of Scope for Phase 1)

### Phase 2 (First Quarter)
- Safety check-ins
- Share incident feature
- Voice-first mode (dictation)
- After-action summaries
- Training mode

### Phase 3 (Future)
- Multilingual support (Filipino, Bikol)
- Audio descriptions (text-to-speech)
- Offline maps download
- Integration with emergency services (911)
- Wearable support (smartwatch)
- Community features (neighborhood watch)

---

## Metrics & Success Indicators

**User Engagement:**
- Reports submitted per day
- Time to submit first report (onboarding effectiveness)
- Report verification rate (quality of reports)
- Anonymous to registered conversion rate

**Technical Performance:**
- App load time
- Report submission success rate
- Offline queue sync success rate
- Push notification delivery rate

**User Satisfaction:**
- Report accuracy (fewer false reports)
- Time from submission to verification
- User retention (returning users)
- Feature usage (which features are most used)

---

## Support & Help

**In-App Help:**
- FAQ section
- How-to guides
- Contact support (email, not phone)
- Bug report form

**External Support:**
- MDRRMO office (walk-in)
- Municipal hotlines
- Barangay captains
- Community training sessions

---

## Document Version

**Version:** 1.0
**Last Updated:** 2026-04-10
**Status:** Approved for implementation
**Next Review:** After Phase 1 user testing

---

**End of Citizen Role Specification**
