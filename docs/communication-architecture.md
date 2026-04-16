# Communication Architecture — Clarification

**Bantayog Alert — Disaster Reporting Platform**
**Province of Camarines Norte, Philippines**
**Date:** 2026-04-10
**Status:** ✅ Approved - Not building chat features

---

## Core Principle

**The app does NOT replace Facebook Messenger.** All two-way communication happens via Facebook Messenger or phone calls. The app provides one-way system notifications only.

---

## Communication Channels

### ✅ What the App Provides (One-Way System Notifications)

| Channel | Purpose | Direction | Use Case |
|---------|---------|-----------|----------|
| **Push notifications** | System alerts | System → User | "You've been dispatched to Incident #0471" |
| **In-app notifications** | Status updates | System → User | "Incident #0471 status changed to In Progress" |
| **SMS alerts** | Emergency warnings | System → User | "Evacuation order for your area" |
| **Email notifications** | Reports & summaries | System → User | "Daily situation report attached" |

**These are NOT chat features** - they're one-way alerts from the system to users.

---

### ❌ What the App Does NOT Provide (Two-Way Chat)

| Feature | Why It's Removed | Replacement |
|---------|-----------------|-------------|
| Voice messages | Two-way chat | Phone calls (one-tap dialer) |
| In-app messaging | Replaced by Messenger | Facebook Messenger |
| Team chat | Unnecessary overhead | Facebook Messenger groups |
| Direct messaging | Replaced by Messenger | Facebook Messenger or phone |
| In-app calling | Unnecessary complexity | Phone dialer (one-tap) |

---

### ✅ External Communication (Two-Way)

**Facebook Messenger** - Primary channel for all two-way communication:

```
Citizen ↔ Municipal Admin
    • Citizen sends message via Messenger
    • Admin responds via Messenger
    • No in-app chat needed

Responder ↔ Municipal Admin
    • Responder calls admin (one-tap in app)
    • Admin calls responder (phone)
    • Or: Messenger for non-urgent communication

Municipal Admin ↔ Provincial Superadmin
    • Phone calls (urgent)
    • Messenger (non-urgent)
    • No in-app chat needed
```

**Phone Calls** - For urgent communication:

```
One-Tap Call Button (in app)
    ↓
Opens phone dialer
    ↓
Calls registered phone number
    ↓
Conversation happens over phone call
    ↓
App auto-logs: "Called [Name] at [Time]"
```

---

## Communication Flow by Role

### Citizens

**Receive (from app):**
- ✅ Push notifications: "Your report #0471 has been verified"
- ✅ SMS alerts: "Evacuation warning for your area"
- ✅ Email: "Daily situation report"

**Send (to admins):**
- ✅ Facebook Messenger: Two-way conversation with admin
- ✅ Phone calls: Admin's number visible in app

**What citizens DON'T do:**
- ❌ No in-app chat/messaging
- ❌ No voice messages in app
- ❌ No in-app calling

---

### Responders

**Receive (from app):**
- ✅ Push notifications: "You've been dispatched to Incident #0471"
- ✅ In-app notifications: Admin messages, status updates
- ✅ Phone calls: Admin calls responder's number

**Send (to admins):**
- ✅ One-tap "Call Admin" button (opens phone dialer)
- ✅ Text messages in app (non-urgent updates)
- ✅ Field notes and photos (documentation)
- ✅ Facebook Messenger: For conversations

**What responders DON'T do:**
- ❌ No voice messages in app (removed)
- ❌ No in-app calling (opens phone dialer instead)
- ❌ No team chat in app

---

### Municipal Admins

**Receive (from app):**
- ✅ Push notifications: Citizen reports, escalations
- ✅ In-app notifications: Responder updates, system alerts
- ✅ Phone calls: From responders, superadmins, citizens

**Send (to citizens):**
- ✅ Mass alerts (push/SMS): "Evacuation order for Daet"
- ✅ Facebook Messenger: Individual follow-up conversations
- ✅ Phone calls: Urgent citizen communication

**Send (to responders):**
- ✅ Dispatch alerts (push/in-app): "Assigned to Incident #0471"
- ✅ Phone calls: Direct communication
- ✅ Facebook Messenger: Non-urgent coordination

**Send (to superadmins):**
- ✅ Escalation requests: "Need provincial resources"
- ✅ Facebook Messenger: Coordination
- ✅ Phone calls: Urgent escalations

**What municipal admins DON'T do:**
- ❌ No in-app chat with citizens
- ❌ No in-app chat with responders
- ❌ No team chat in app

---

### Provincial Superadmins

**Receive (from app):**
- ✅ Push notifications: Escalations, system alerts
- ✅ In-app notifications: Anomaly detection, performance alerts
- ✅ Phone calls: From municipal admins, emergency contacts

**Send (to municipal admins):**
- ✅ Province-wide alerts (push/SMS): "Typhoon warning for all municipalities"
- ✅ Phone calls: Urgent coordination
- ✅ Facebook Messenger: Non-urgent communication

**What provincial superadmins DON'T do:**
- ❌ No direct messaging to municipal admins in app (already skipped)
- ❌ No broadcast announcements in app (already skipped)
- ❌ No in-app chat features

---

## One-Tap Call Button (Critical Feature)

**How it works:**

```
[📞 Call Admin] button in responder app
    ↓
Taps once
    ↓
Opens phone dialer with admin's number pre-filled
    ↓
Responder presses call
    ↓
Phone call starts (outside the app)
    ↓
Conversation happens over phone network
    ↓
After call ends, app auto-logs: "Called Admin Maria at 14:32"
```

**Why this approach:**

1. **Simplicity** - No need to build in-app calling
2. **Reliability** - Works even without internet connection
3. **Urgency** - Phone calls are fastest for emergencies
4. **Clarity** - Clear separation between app and phone
5. **Privacy** - Conversation happens outside the app (no recording/storage)

**Phone numbers are REQUIRED:**

| Role | Phone Number Required | Reason |
|------|----------------------|--------|
| Responders | ✅ Yes | Admins call responders, responders call admins |
| Municipal Admins | ✅ Yes | Citizens call admins, responders call admins |
| Provincial Superadmins | ✅ Yes | Municipal admins call for escalation |
| Citizens | ❌ Optional | Can receive alerts without phone number |

---

## Facebook Messenger Integration

**How it works:**

```
App shows: [💬 Message on Messenger]
    ↓
Tap button
    ↓
Opens Facebook Messenger app
    ↓
Opens chat with admin/responder
    ↓
Conversation happens in Messenger
    ↓
No data stored in Bantayog Alert app
```

**Why this approach:**

1. **Familiarity** - Everyone in Philippines already uses Messenger
2. **No build cost** - Don't need to build chat infrastructure
3. **Rich features** - Messenger already has voice, video, photos, group chat
4. **Offline support** - Messenger works without internet (via SMS fallback)
5. **Separation** - Keeps Bantayog Alert focused on disaster response, not social networking

**Admin contact info visible in app:**

```
Municipal Admin: Maria Santos
📞 0917 123 4567
💬 messenger.com/maria.santos.daet
📧 maria@daet.gov.ph
```

---

## Examples of Communication Flows

### Example 1: Citizen Reports Incident

```
1. Citizen submits report in app (flood in their area)
2. App sends push notification to Municipal Admin
3. Admin verifies report and dispatches responders
4. App sends push notification to citizen: "Your report has been verified"
5. Admin calls citizen (phone) for clarification
6. OR: Admin messages citizen on Facebook Messenger
7. Citizen responds via Messenger or phone call
```

**No in-app chat needed.**

---

### Example 2: Responder Needs Backup

```
1. Responder arrives at incident, realizes need backup
2. Responder taps [🆘 Request Backup] in app
3. App sends push notification to Municipal Admin
4. Admin receives notification, sees request
5. Admin calls responder (phone) for details
6. Admin dispatches additional responders
7. App sends push notification to responder: "Backup dispatched"
```

**Minimal in-app communication, mostly phone calls.**

---

### Example 3: Multi-Municipality Disaster

```
1. Typhoon approaches province
2. Provincial Superadmin sends province-wide alert (push/SMS)
3. All citizens in affected municipalities receive alert
4. Municipal Admins coordinate via Facebook Messenger group
5. OR: Municipal Admins call each other (phone)
6. Provincial Superadmin deploys provincial resources (helicopter)
7. Updates happen via push notifications (not chat)
```

**Messenger for coordination, app for alerts/data.**

---

## Technical Implications

### What We DON'T Need to Build

- ❌ No chat server infrastructure
- ❌ No message queuing system
- ❌ No real-time messaging (WebSockets for chat)
- ❌ No voice recording/playback
- ❌ No in-app calling (WebRTC)
- ❌ No message storage for conversations
- ❌ No read receipts for messages
- ❌ No typing indicators
- ❌ No online/offline status for chat

### What We DO Need to Build

- ✅ Push notification system (Firebase Cloud Messaging)
- ✅ SMS gateway (for emergency alerts)
- ✅ Email notification system
- ✅ In-app notification display
- ✅ One-tap phone dialer integration (`tel:` links)
- ✅ Facebook Messenger deep links (`fb-messenger://`)
- ✅ Phone number storage (Firestore)
- ✅ Notification logging (audit trail)

---

## Summary

**The app is NOT a social networking or chat platform.**

The app focuses on:
1. **Incident reporting** (citizens submit reports)
2. **Dispatch coordination** (admins dispatch responders)
3. **Status tracking** (real-time incident updates)
4. **Alert broadcasting** (emergency warnings)
5. **Data visualization** (maps, analytics, dashboards)

Communication happens via:
- **App:** One-way system notifications (push, in-app, SMS, email)
- **Facebook Messenger:** Two-way conversations
- **Phone calls:** Urgent communication

This keeps the app focused, simple, and reliable.

---

**Version:** 1.0
**Date:** 2026-04-10
**Status:** ✅ Approved - No chat features will be built
