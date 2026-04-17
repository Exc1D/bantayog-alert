# Citizen Role — Complete Specification

**Bantayog Alert — Disaster Reporting Platform**
**Province of Camarines Norte, Philippines**
**Version:** 2.0
**Supersedes:** Citizen Role Spec v1.0 (2026-04-10)
**Aligned to:** Architecture Spec v6.0 (2026-04-16)
**Surface:** Citizen PWA (React 18 + Vite, iOS Safari / Android Chrome)

---

## Change Summary (v1.0 → v2.0)

| #   | What Changed                                        | Why                                                                                                                                                     |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | "Anonymous" replaced with "pseudonymous" throughout | Arch §2.3: absolute anonymity is unenforceable. Court orders, App Check, and Firebase logs retain signals. Citizens are pseudonymous, not anonymous.    |
| 2   | `trustScore` and "Auto-Verify" removed              | Arch §2.2: RA 10173 profiling exposure. Replaced with factual indicators.                                                                               |
| 3   | Offline storage model rewritten                     | Arch §9.2: dual-write to localForage + Firestore SDK queue; IndexedDB alone is vulnerable to iOS eviction.                                              |
| 4   | Tracking reference model updated                    | Arch §7.1: client-side UUID until server confirmation, then human-readable reference swapped in.                                                        |
| 5   | Report submission write path clarified              | Arch §7.1: citizen writes to `report_inbox/{id}` (rate-limited, App Check required). CF materializes the rest.                                          |
| 6   | Edit/cancel permissions clarified                   | Arch §7.1: pseudonymous users can edit/cancel only before verification. Correction requests post-verification require admin approval.                   |
| 7   | Privacy notice rewritten for accuracy               | Arch §2.3: must state plainly what is retained (pseudonymous UID, optional contact, GPS, photos with EXIF stripped, IP short-term, msisdn hash if SMS). |
| 8   | Rate limits defined                                 | Arch §7.1: 3 reports/hour, 10/day per UID; soft limit → moderation queue, hard limit → error.                                                           |
| 9   | Session upgrade flow clarified                      | Arch §7.1: pseudonymous session can be linked to registered account, preserving UID and report history.                                                 |
| 10  | Permissions table updated                           | Pseudonymous users get edit/cancel parity with registered users before verification.                                                                    |

---

## Table of Contents

1. [Role Overview](#1-role-overview)
2. [Permissions & Access](#2-permissions--access)
3. [Interface Design](#3-interface-design)
4. [Core Features](#4-core-features)
5. [Report Submission Flow](#5-report-submission-flow)
6. [Offline Behavior](#6-offline-behavior)
7. [Security & Anti-Abuse](#7-security--anti-abuse)
8. [Privacy & Data Protection](#8-privacy--data-protection)
9. [Technical Specifications](#9-technical-specifications)

---

## 1. Role Overview

### Who Are Citizens?

Citizens are the primary users of Bantayog Alert — residents of Camarines Norte province who report disasters and emergencies in their community. Feature-phone users reach the platform via the SMS ingest path (keyword-based; see Architecture §7.1 SMS fallback).

### Primary Responsibilities

- Report incidents quickly and accurately via app or SMS
- Provide photos and location data
- Respond to follow-up questions from admins
- Track the status of their submitted reports
- Receive official alerts and warnings

### Key Characteristics

- **Time-pressured:** Often reporting during active emergencies
- **Variable tech literacy:** From tech-savvy to first-time smartphone users
- **Mobile-first:** Primarily iOS Safari and Android Chrome
- **Connectivity challenges:** May have poor signal or no data during emergencies
- **Pseudonymous-first:** Many will report without creating an account. This is supported and respected.

---

## 2. Permissions & Access

### 2.1 What Citizens CAN Do

| Action                                 | Pseudonymous              | Registered | Notes                                                                              |
| -------------------------------------- | ------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| Submit reports                         | ✅                        | ✅         | Rate-limited: 3/hour, 10/day                                                       |
| Upload photos                          | ✅                        | ✅         | EXIF stripped server-side                                                          |
| Provide GPS location                   | ✅                        | ✅         | Auto-detected; municipality/barangay fallback                                      |
| View public map                        | ✅                        | ✅         | Verified incidents, location blurred on public feed                                |
| View public feed                       | ✅                        | ✅         | Incident type, general area, status only                                           |
| Receive alerts                         | ✅                        | ✅         | FCM push (registered) + SMS (if phone provided)                                    |
| Track own report                       | ✅ Via reference + secret | ✅ Full    | Tracking ref generated client-side, swapped to readable ref on server confirmation |
| Edit unverified reports                | ✅                        | ✅         | Before municipal admin verification only                                           |
| Cancel pending reports                 | ✅                        | ✅         | Before verification only                                                           |
| Request correction on verified reports | ✅                        | ✅         | Admin approval required                                                            |
| Upgrade session to registered account  | ✅                        | N/A        | Preserves UID and report history                                                   |

### 2.2 What Citizens CANNOT Do

| Action                                | Why                                                                |
| ------------------------------------- | ------------------------------------------------------------------ |
| Verify reports                        | LGU triage function only (Arch §2.1)                               |
| Classify incident type or severity    | Admin decision based on broader context                            |
| See other citizens' contact info      | RA 10173 data privacy                                              |
| Access analytics                      | Admin/superadmin tool                                              |
| Dispatch responders                   | Admin coordination function                                        |
| Promote users                         | Superadmin only                                                    |
| Delete verified reports               | Data integrity — public record                                     |
| See admin identity (individual names) | Institutional attribution only, enforced at data layer (Arch §2.7) |

### 2.3 Data Visibility Matrix

| Data Type             | Pseudonymous (own)  | Registered (own)    | Public Feed                                   |
| --------------------- | ------------------- | ------------------- | --------------------------------------------- |
| Report content        | ✅                  | ✅                  | General area + type only                      |
| Photos                | ✅                  | ✅                  | After verification, no EXIF                   |
| Exact location        | ✅                  | ✅                  | Approximate only on public feed               |
| Contact info provided | ✅                  | ✅                  | ❌ Never public                               |
| Report status         | ✅ Via tracking ref | ✅                  | Status label only                             |
| Personal identity     | ❌                  | ✅ Own reports only | ❌ Never                                      |
| Admin identity        | ❌                  | ❌                  | ❌ — Institutional label only ("Daet MDRRMO") |

---

## 3. Interface Design

### 3.1 Mobile-First Bottom Navigation (5 Tabs)

```
┌─────────────────────────────────────────┐
│  Bantayog Alert               🔔  👤   │  ← Top bar
├─────────────────────────────────────────┤
│                                         │
│           [CONTENT AREA]                │
│                                         │
├─────────────────────────────────────────┤
│  📍 Map  │  📋 Feed  │  🚨 Report       │  ← Bottom nav
│  ⚠️ Alerts │  👤 Profile               │
└─────────────────────────────────────────┘
```

### 3.2 Tab 1: Map (Default Home Screen)

**Purpose:** Visual spatial awareness of verified incidents.

**Features:**

- Auto-locate user's position (with permission)
- Pins showing verified incidents (minimum: verified state)
- Color-coded severity:
  - 🟢 Green = Low
  - 🟡 Yellow = Medium
  - 🔴 Red = High
- Filter controls: Severity (`All / High / Medium / Low`), Time (`Last 24h / 7 days / 30 days`)
- Map cap: 100 pins rendered client-side; clustering above that threshold
- Tap pin → summary popup

**Popup Contents:**

```
┌─────────────────────────────────┐
│ 🚨 Flood — High Severity        │
│ 📍 Barangay San Jose, Daet      │
│ 🕒 Reported 2 hours ago          │
│ Status: Dispatched               │
│ [View Details]                  │
└─────────────────────────────────┘
```

**Incident Details View (Public):**

- Incident type and severity
- General location (no exact address on public-facing view)
- Time reported
- Current status: `Pending → Verified → Dispatched → Resolved`
- Verification attribution: "Verified by Daet MDRRMO" (institution only; no admin name)
- NO personal info about the reporter

### 3.3 Tab 2: Feed (List View)

**Purpose:** Chronological browsing of verified public incidents.

**Layout:**

```
┌─────────────────────────────────────────┐
│  ☰ Filters: Last 24h ▼                 │
├─────────────────────────────────────────┤
│  🚨 Flood — High                        │
│     Barangay San Jose, Daet             │
│     2 hours ago · Status: Dispatched    │
├─────────────────────────────────────────┤
│  ⛰️ Landslide — Medium                  │
│     Barangay Malag, Labo               │
│     5 hours ago · Status: Verified      │
└─────────────────────────────────────────┘
```

**Features:** Pull to refresh, infinite scroll, search by municipality or barangay, sort by `Recent / Severity / Status`.

### 3.4 Tab 3: Report (🚨 — Prominent Center Button)

**Purpose:** Submit new disaster reports — the fastest path to help.

See §5 (Report Submission Flow) for full UX.

### 3.5 Tab 4: Alerts (Official Warnings)

**Purpose:** Receive official government alerts.

```
┌─────────────────────────────────────────┐
│  🔔 Active Alerts                       │
├─────────────────────────────────────────┤
│  ⚠️ EVACUATION WARNING                  │
│     Flash flood in Daet                  │
│     Residents near rivers: EVACUATE     │
│     Sent by: Daet MDRRMO · 20 min ago   │
│     [Read More]                         │
├─────────────────────────────────────────┤
│  📢 WEATHER ALERT                       │
│     Typhoon Signal #2 raised            │
│     Sent by: Camarines Norte PDRRMO     │
│     2 hours ago                         │
└─────────────────────────────────────────┘
```

**Priority levels:**

- 🔴 Emergency (Evacuate now) — push notification + persistent banner
- 🟡 Warning (Prepare) — push notification
- 🟢 Advisory (Informational) — in-app only unless push enabled

**Source attribution:** Always institutional ("MDRRMO Daet", "PAGASA", "PDRRMO Camarines Norte"). Never individual admin names.

**Design note:** Provincial mass alerts routed through NDRRMC ECBS appear as received alerts; Bantayog displays them but does not originate them (Arch §1.2, §7.5.1).

### 3.6 Tab 5: Profile (Account & Settings)

**5a. Pseudonymous State (no account)**

```
┌─────────────────────────────────────────┐
│  👤 Reporting without an account        │
│                                         │
│  Your reports are tracked by reference. │
│                                         │
│  [Create Account] — Save your history   │
└─────────────────────────────────────────┘
```

**5b. Registered State**

```
┌─────────────────────────────────────────┐
│  👤 Juan Dela Cruz                      │
│  📱 0917 123 4567 (verified)            │
│  📍 Daet, Camarines Norte               │
│  [Edit Profile]                         │
└─────────────────────────────────────────┘
```

**5c. My Reports (My Activity)**

```
┌─────────────────────────────────────────┐
│  Your Reports (3)                       │
├─────────────────────────────────────────┤
│  🚨 Flood — Awaiting Verification       │
│     Barangay San Jose, Daet             │
│     Reported today at 2:30 PM           │
│     [View] [Edit] [Cancel]              │
├─────────────────────────────────────────┤
│  🌳 Fallen Tree — Resolved              │
│     Poblacion, Daet · 3 days ago        │
│     [View]                              │
└─────────────────────────────────────────┘
```

**Note:** "Edit" and "Cancel" are available only while report status is `new` or `awaiting_verify`. After verification, these are replaced by [Request Correction] which routes to admin for approval.

**5d. Settings**

```
┌─────────────────────────────────────────┐
│  ⚙️ Settings                            │
├─────────────────────────────────────────┤
│  🔔 Notifications                        │
│     ☑ Push notifications               │
│     ☑ Alert sounds                     │
│                                         │
│  📍 Location                            │
│     ☑ Auto-detect location             │
│                                         │
│  📶 Data & Storage                      │
│     ☑ Offline mode                     │
│     Storage used: 12 MB                 │
│                                         │
│  🔒 Privacy Policy                      │
│  📥 Download My Data                    │
│  🗑️ Delete Account                      │
│  🚪 Log Out                             │
└─────────────────────────────────────────┘
```

---

## 4. Core Features

### 4.1 Pseudonymous Reporting (Primary Flow)

Citizens may submit reports without creating an account. This is the fastest path and is fully supported.

**What "pseudonymous" means (must be stated in privacy notice):**

- A pseudonymous UID is created automatically by Firebase Auth.
- This UID can be linked to a registered account later, preserving all report history.
- The system retains: pseudonymous UID, optional voluntary contact (stored in `report_contacts`, shown only to admins), GPS, photos (EXIF stripped), IP address (short-term, retained per Firebase logs), and msisdn hash if submitted via SMS.
- The platform does **not** guarantee non-disclosure from court orders.
- This is clearly stated in the privacy notice. See §8.

**Post-Submission Screen:**

```
┌─────────────────────────────────────────┐
│  ✅ Report Submitted                    │
│                                         │
│  Your tracking reference:              │
│  DAET-2026-0471                         │
│  Secret code: [shown once, copy prompt] │
│                                         │
│  Save this to track your report.        │
│  [Copy Reference] [Create Account]      │
└─────────────────────────────────────────┘
```

**Tracking Reference Model:**

1. On submit: client generates a UUID as temporary reference (shown instantly, even offline).
2. On server confirmation: human-readable reference (e.g., `DAET-2026-0471`) is swapped in.
3. Secret code is required to view own report details when not logged in.
4. Tracking reference + secret are stored in localForage for recovery if user returns.

### 4.2 Account Creation (Deferred)

Prompted — never forced — after the citizen has acted. Accounts convert the pseudonymous session without losing report history.

**When to prompt (one-time, dismissible):**

- After first report is confirmed by server
- After tapping "My Reports" for the first time

**Registration Flow:**

1. Enter phone number → OTP verification (required)
2. Enter name (optional, used for profile display only)
3. Enter email (optional, for recovery only)
4. Confirm consent and privacy notice

**Session Upgrade:** The pseudonymous UID is retained and linked to the phone-verified account. All prior reports remain accessible.

### 4.3 Report Tracking

Citizens track their reports via:

- **Registered account:** All reports visible in Profile → My Reports with live status.
- **Pseudonymous:** Tracking reference + secret → status-tracking view. This view shows status, institutional attribution for any admin actions (e.g., "Verified by Daet MDRRMO at 3:05 PM"), and admin-initiated messages. It never exposes individual admin names.

**Status progression visible to citizen:**

```
Received → Under Review → Verified → Response Dispatched → Resolved
```

Admin-internal states (`new`, `awaiting_verify`, `verified`, `dispatched`, etc.) are translated to citizen-friendly labels.

### 4.4 Receiving Alerts

Citizens receive official alerts via:

- **FCM push** (registered users with push enabled)
- **SMS** (if phone number provided and alerts opted in)

Citizens do not receive alerts from agency admins directly. All mass alerts originate from Municipal Admins or Provincial Superadmin (via NDRRMC escalation for large-scale events). The source is always institutional.

---

## 5. Report Submission Flow

### 5.1 Submission Entry

```
┌─────────────────────────────────────────┐
│  🚨 Report an Incident                  │
│                                         │
│  What's happening?                      │
│  ┌─────────────────────────────────┐    │
│  │  [Select incident type ▼]       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Start Report] ← Big, obvious button  │
└─────────────────────────────────────────┘
```

**Incident Types:**

- 🌊 Flood
- ⛰️ Landslide
- 🔥 Fire
- 🏠 Building Collapse
- 🌪️ Storm Damage
- 🚗 Road Accident / Blockage
- 🤒 Sick / Injured Person
- ⚠️ Other

### 5.2 Submission Steps

**Step 1 — Location (Required)**

```
📍 Detecting your location...
[Use GPS Location] ✅ (auto-filled if permission granted)
— OR —
[Select Municipality ▼] → [Select Barangay ▼]
```

If GPS is unavailable or denied, municipality/barangay selection is the fallback. GPS is strongly encouraged — it significantly speeds up admin triage.

**Step 2 — Description (Required)**

- What happened? (text field, 500 char max)
- How severe does it seem? (optional self-assessment; admin will set official severity)

**Step 3 — Photo/Video (Optional but important)**

```
[📷 Take Photo] [🖼️ Upload Photo]
Up to 3 photos / 1 video
Max size: 10MB per photo
Photos will have location data (EXIF) removed for privacy.
```

**Step 4 — Contact (Optional)**

```
Would you like to be reachable for follow-up?
(Admins may need to ask clarifying questions.)

Phone: [_____________] (optional)
Email: [_____________] (optional)

Contact info is visible to MDRRMO staff only.
Never shown publicly.
```

**Step 5 — Review & Submit**

```
┌─────────────────────────────────────────┐
│  Review Your Report                     │
│                                         │
│  Type: Flood                            │
│  Location: Barangay San Jose, Daet      │
│  Description: "Water rising fast..."    │
│  Photo: ✅ 2 attached                   │
│  Contact: 0917 123 4567                 │
│                                         │
│  [Edit] [Submit Report]                 │
└─────────────────────────────────────────┘
```

### 5.3 Submission State Machine (User-Visible)

| State              | Label Shown                    | What It Means                |
| ------------------ | ------------------------------ | ---------------------------- |
| `draft`            | Saving draft...                | Auto-saved locally every 30s |
| `queued`           | Queued — will send when online | Written to offline queue     |
| `submitting`       | Sending...                     | Network write in progress    |
| `server_confirmed` | ✅ Received                    | Server acknowledged          |
| `failed_retryable` | ⚠️ Sending failed — will retry | Queued for replay            |
| `failed_terminal`  | ❌ Could not send              | Contact via SMS or barangay  |

The UI must never silently drop a failed submission. Each state is visually distinct.

### 5.4 Draft Auto-Save

- Draft auto-saves to localForage every 30 seconds during composition.
- On app reopen: "You have a draft from earlier — [Continue] [Discard]"
- Draft expires after 24 hours to avoid stale submissions.

---

## 6. Offline Behavior

### 6.1 Dual-Write Model (Arch §9.2)

On submit while offline:

1. Firestore SDK queues the write via IndexedDB persistence.
2. localForage outbox also records the submission payload.

On reconnect:

- Firestore SDK replays the queued write.
- localForage outbox detects successful write and clears.
- If Firestore write failed (e.g., IndexedDB evicted by iOS), localForage replay handler retries.

**Why both?** iOS Safari aggressively evicts IndexedDB under memory pressure. LocalForage is a more resilient fallback.

### 6.2 User-Visible Queue

```
┌─────────────────────────────────────────┐
│  📶 You're offline                      │
│  1 report is waiting to be sent.        │
│  It will send automatically when        │
│  you reconnect.                         │
└─────────────────────────────────────────┘
```

- Queue count always visible in a persistent banner when offline.
- On reconnect: "✅ Your report has been sent."

### 6.3 Map Tile Caching

- Map tiles cached for 24 hours (browser cache).
- Last-known public feed state cached for offline viewing.
- Citizens can see previously loaded incident data while offline, clearly marked "Last updated X minutes ago."

---

## 7. Security & Anti-Abuse

### 7.1 Rate Limits

| Scope                  | Limit                      |
| ---------------------- | -------------------------- |
| Per pseudonymous UID   | 3 reports / hour, 10 / day |
| Per msisdn hash (SMS)  | 3 reports / hour, 10 / day |
| Per IP (fallback gate) | 20 reports / day           |

**Soft limit:** Report routed to moderation queue elevation. Citizen is not notified (prevents gaming).

**Hard limit:** Submission returns error: "You've submitted several reports recently. If this is urgent, please call your Barangay Hotline: [number set by admin]."

### 7.2 App Check

All submissions require Firebase App Check (device attestation). This is enforced at the `report_inbox` write rule; no App Check token = write rejected.

### 7.3 EXIF Stripping

All uploaded photos have EXIF data (location, device, timestamp metadata) stripped server-side during Cloud Function processing. This protects reporter privacy.

### 7.4 False Report Prevention

- Citizens cannot submit more than 3 reports per hour per UID.
- A "are you sure?" confirmation is shown before submission.
- Rejected reports (`cancelled_false_report`) are logged as moderation incidents. Citizens are informed their report was not accepted but are not shown the admin's reason unless the admin chooses to send a message.

---

## 8. Privacy & Data Protection

### 8.1 What "Reporting Without an Account" Actually Means

**This language must appear in the app, in plain Filipino and English:**

> "When you report without an account, your report is linked to a temporary ID (not your name). We also keep a record of your approximate IP address for a short time, and your phone number if you provided one (stored securely and visible only to MDRRMO staff). If ordered by a court, we may be required to disclose information. We cannot guarantee complete anonymity."

This replaces the v1.0 "absolute anonymity" claim, which was inaccurate and potentially misleading under RA 10173.

### 8.2 What Is Retained for a Pseudonymous Report

| Data                           | What Happens                                        |
| ------------------------------ | --------------------------------------------------- |
| Pseudonymous UID               | Retained — links reports to session                 |
| Optional contact (phone/email) | Stored in `report_contacts`, visible to admins only |
| GPS coordinates                | Retained with report                                |
| Photos                         | Stored with EXIF stripped                           |
| IP address                     | Short-term Firebase log retention                   |
| Msisdn hash (SMS path)         | Retained per SMS session                            |

### 8.3 RA 10173 (Data Privacy Act) Compliance

**Consent:**

- Explicit checkbox on first use: "I have read and agree to the Terms of Use and Privacy Notice." Cannot proceed without.
- Link to full plain-language privacy notice.

**Right to Access:**

- Profile → [Download My Data] generates a JSON export of all reports and account info.
- Delivered within 24 hours to provided email.

**Right to Deletion:**

- Account deletion available in Settings.
- Deletes: name, email, phone from account record.
- Retains: verified reports (public record, anonymized to "Citizen").
- Retains: unverified reports for 6 months (anonymized, analytics), then auto-deleted.

**Breach Notification:**

- If a breach is detected: affected users notified within 72 hours via email and push notification.
- Notification includes: what data was affected, what happened, and remediation steps.

### 8.4 Data Retention Policy

| Data Type                         | Retention                     |
| --------------------------------- | ----------------------------- |
| Pseudonymous reports              | 1 year                        |
| Registered user account data      | Until deletion request        |
| Verified reports                  | Indefinite (public record)    |
| Unverified reports                | 6 months, then auto-deleted   |
| Photos                            | Same as parent report         |
| Contact info in `report_contacts` | Same as parent report         |
| IP address logs                   | Short-term (Firebase default) |
| Responder GPS telemetry           | Not applicable to citizens    |

### 8.5 Contact Info Visibility

| Viewer                    | Can See Contact?       |
| ------------------------- | ---------------------- |
| Municipal / Agency Admins | ✅ Yes (for follow-up) |
| Responders                | ❌ No (privacy)        |
| Other citizens            | ❌ No                  |
| Public feed               | ❌ No                  |

---

## 9. Technical Specifications

### 9.1 Platform

**Surface:** Progressive Web App (PWA)

- iOS Safari 14+ (primary mobile target)
- Android Chrome 90+
- Firefox 88+, Edge 90+

**Why PWA:**

- No app store approval needed
- Works on all devices
- Offline capability via service workers
- Push notifications
- Auto-updates

### 9.2 PWA Manifest

```json
{
  "name": "Bantayog Alert",
  "short_name": "Bantayog",
  "description": "Disaster reporting for Camarines Norte",
  "theme_color": "#DC2626",
  "background_color": "#FFFFFF",
  "display": "standalone",
  "orientation": "portrait-primary",
  "start_url": "/"
}
```

### 9.3 Offline Storage Model (Arch §9.2)

| Data Category                      | Storage Authority                              |
| ---------------------------------- | ---------------------------------------------- |
| Server documents (reports, alerts) | Firestore SDK (IndexedDB persistence)          |
| Drafts + queued submissions        | localForage + Firestore SDK queue (dual-write) |
| Tracking secrets                   | localForage (survives app restart)             |
| UI state (modal, form field, tab)  | Zustand (in-memory only)                       |
| Cached feed / map tiles            | Service worker cache (24h)                     |

### 9.4 State Management

- **Firestore SDK:** Single source of truth for all server documents
- **Zustand:** UI-only state (never touches server cache)
- **TanStack Query:** Wraps callables and non-Firestore HTTP (tracking lookup, callables)
- **localForage:** Drafts, tracking secrets, offline outbox

### 9.5 Write Path (Report Submission)

```
Citizen → report_inbox/{id} (direct write, App Check required, rate-limited)
        → CF processInboxItem materializes:
           reports/{id}          (public record)
           report_private/{id}   (contact, raw GPS)
           report_ops/{id}       (admin triage metadata)
           report_contacts/{id}  (voluntary contact — if provided)
           report_lookup/{ref}   (citizen-facing status tracking, no actorId)
```

Reconciliation sweep runs every 5 minutes for any unprocessed inbox items.

### 9.6 Map Rendering

- Leaflet + OSM tiles
- Client-rendered, 100-pin cap with clustering above
- 24h browser tile cache

### 9.7 Performance Targets

| Metric                     | Target  |
| -------------------------- | ------- |
| First Contentful Paint     | < 2s    |
| Time to Interactive        | < 5s    |
| Bundle size                | < 500KB |
| Photo upload               | < 30s   |
| Report submission (online) | < 10s   |

### 9.8 Accessibility (WCAG 2.1 AA)

- Screen reader support (VoiceOver, TalkBack)
- All touch targets ≥ 44×44px
- Color contrast ratio ≥ 4.5:1
- ARIA labels on all interactive elements
- Form validation with clear, localized error messages
- Focus management for modal flows

### 9.9 Analytics

Firebase Analytics: anonymous usage events only (`report_submitted`, `alert_received`, `app_opened`, `feature_used`). No personal identifiers. Opt-out in Settings.

---

## Future Enhancements (Out of Scope for Pilot)

- Safety check-ins
- Voice-first mode (dictation)
- After-action summaries
- Multilingual support (Filipino, Bikol)
- Audio descriptions (text-to-speech)
- Offline map download
- Community features

---

## Document Version

**Version:** 2.0
**Date:** 2026-04-16
**Status:** Aligned to Architecture Spec v6.0
**Next Review:** After Phase 3 (Citizen PWA) implementation
