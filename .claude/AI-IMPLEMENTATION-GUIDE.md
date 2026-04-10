# AI Implementation Guide — Building Bantayog Alert from Scratch

**How to use these specification documents with AI coding agents**

**Date:** 2026-04-10
**Status:** Ready for implementation
**Starting Point:** Blank repository

---

## Table of Contents

1. [Preparation](#preparation)
2. [Phase Order & Dependencies](#phase-order--dependencies)
3. [How to Use This Guide](#how-to-use-this-guide)
4. [Implementation Strategy](#implementation-strategy)
5. [Prompting AI Agents](#prompting-ai-agents)
6. [Tracking Progress](#tracking-progress)
7. [Common Pitfalls](#common-pitfalls)

---

## Preparation

### Step 1: Organize Your Specification Documents

Make sure all spec documents are in your project:

```bash
cd /path/to/your/project
mkdir -p docs
```

**Required documents:**
- `docs/SPECS.md` - Master overview (if you have it)
- `docs/DESIGN.md` - Architecture decisions (if you have it)
- `docs/citizen-role-spec.md` - Citizen role specification
- `docs/responder-role-spec.md` - Responder role specification (v1.1)
- `docs/municipal-admin-role-spec.md` - Municipal Admin specification
- `docs/provincial-superadmin-role-spec.md` - Provincial Superadmin specification
- `docs/communication-architecture.md` - Communication rules (NO chat)
- `docs/CLAUDE.md` - Your project instructions (from .claude folder)
- `docs/.claude/rules/` - Coding standards, testing, security rules

### Step 2: Initialize Project Structure

Create a basic README to give AI agents context:

```markdown
# Bantayog Alert

Disaster reporting and alerting platform for Camarines Norte, Philippines.

## Quick Start for AI Agents

**Read these files FIRST before writing any code:**

1. `docs/citizen-role-spec.md` - Citizen features
2. `docs/responder-role-spec.md` - Responder features
3. `docs/municipal-admin-role-spec.md` - Municipal Admin features
4. `docs/provincial-superadmin-role-spec.md` - Provincial Superadmin features
5. `docs/communication-architecture.md` - **CRITICAL: No chat features**

## Tech Stack

- **Frontend:** React 18.3.1 + Vite 8.0.3 + TypeScript 6.0.2
- **Styling:** Tailwind CSS v3.4.17
- **Backend:** Firebase (Firestore, Functions, Auth, Storage, Hosting)
- **Maps:** Leaflet + react-leaflet v4.2.1
- **State:** TanStack Query 5.96.2 + Zustand 5.0.12
- **Routing:** React Router 6.5.0
- **Testing:** Vitest + Playwright + Firebase Emulator

## Critical Constraints

- **NO chat features** - All two-way communication via Facebook Messenger or phone
- **MFA MANDATORY** for Provincial Superadmins
- **6-month data retention** - Auto-archive, then delete
- **Map-centric** for Municipal Admins (desktop)
- **Mobile-first** for Citizens and Responders

## Implementation Order

Follow the Master Plan: `docs/AI-IMPLEMENTATION-GUIDE.md`

**DO NOT skip ahead.** Build in phases to avoid rework.
```

---

## Phase Order & Dependencies

### The Master Build Plan

```
Phase 0: Project Setup & Tooling (1 week)
  ↓
Phase 1: Authentication & Data Model (2 weeks)
  ↓
Phase 2: Citizen Features (4-6 weeks)
  ↓
Phase 3: Responder Features (3-6 weeks)
  ↓
Phase 4: Municipal Admin Features (6-8 weeks)
  ↓
Phase 5: Provincial Superadmin Features (5-7 weeks)
  ↓
Phase 6: Integration & Testing (2-3 weeks)
  ↓
Phase 7: Hardening & Deployment (2-3 weeks)
```

**Total:** 25-36 weeks with 2 developers (6-9 months)

### Why This Order?

Each phase builds on the previous:

1. **Phase 0** - Must exist before anything (project scaffolding)
2. **Phase 1** - Must exist before users can log in (auth + database)
3. **Phase 2** - First users (citizens) start using the app
4. **Phase 3** - Responders receive citizen reports
5. **Phase 4** - Municipal admins manage everything
6. **Phase 5** - Provincial superadmins oversee all
7. **Phase 6** - Everything works together
8. **Phase 7** - Production-ready

**DO NOT build Phase 4 before Phase 2.** You'll have to rewrite everything.

---

## How to Use This Guide

### For Each Phase:

1. **Read the spec** for that phase's role
2. **Use the provided prompt** (copy-paste it)
3. **Review the AI's work** against the spec
4. **Test** before moving to next phase
5. **Iterate** if tests fail

### Prompt Template Pattern

```
You are implementing [PHASE NAME] for Bantayog Alert.

**Context:**
- This is a disaster reporting platform for Camarines Norte, Philippines
- We are building [PHASE NAME] after completing [PREVIOUS PHASES]
- Read the full spec: docs/[ROLE-NAME]-role-spec.md

**Your Task:**
1. Read the specification document carefully
2. Identify all features for this phase
3. Create implementation plan
4. Build the features according to the spec
5. Test each feature
6. Report when done

**Critical Constraints:**
- Read docs/communication-architecture.md (NO chat features)
- Follow coding standards in docs/.claude/rules/
- Use Test-Driven Development (write tests first)
- Follow React/TypeScript best practices

**Questions?**
Ask me BEFORE you start coding if anything is unclear.
```

---

## Implementation Strategy

### Phase 0: Project Setup & Tooling (1 week)

**Goal:** Blank repo → Working development environment

**Prompt:**
```
Initialize Bantayog Alert project with the following:

**Tech Stack:**
- React 18.3.1 + Vite 8.0.3 + TypeScript 6.0.2
- Tailwind CSS v3.4.17
- Firebase SDK v12.11.0
- React Router 6.5.0
- TanStack Query 5.96.2
- Zustand 5.0.12
- Leaflet + react-leaflet 4.2.1

**Requirements:**
1. Create Vite + React + TypeScript project
2. Install all dependencies
3. Configure Tailwind CSS
4. Set up Firebase (emulators for local dev)
5. Create folder structure: src/domains/[role]/{components,hooks,services,types}
6. Set up Vitest for testing
7. Set up ESLint + Prettier
8. Create .env.example file
9. Configure Firebase emulators (Firestore, Auth, Functions, Storage)
10. Verify everything works with "Hello World" test

**DO NOT:**
- Build any features yet
- Create any UI components
- Write any business logic

Just set up the project structure and tooling.
```

**Success Criteria:**
- ✅ `npm run dev` works
- ✅ `npm run test` works
- ✅ Firebase emulators start (`firebase emulators:start`)
- ✅ TypeScript compiles without errors
- ✅ Folder structure matches domains architecture

---

### Phase 1: Authentication & Data Model (2 weeks)

**Goal:** Users can log in, database schema exists

**Part A: Firebase Authentication Setup**

**Prompt:**
```
Implement Firebase Authentication for Bantayog Alert.

**Read First:**
- docs/citizen-role-spec.md (citizen auth)
- docs/responder-role-spec.md (responder auth)
- docs/municipal-admin-role-spec.md (admin auth)
- docs/provincial-superadmin-role-spec.md (superadmin auth)

**Requirements:**
1. Email/password authentication
2. Phone authentication (for responders)
3. Custom claims for roles: citizen, responder, municipal_admin, provincial_superadmin
4. Municipal assignment for admins (which municipality they belong to)
5. MFA enforcement for provincial superadmins (TOTP)
6. Account recovery flow
7. Session management (active sessions, force logout)

**Data Model:**
Create Firestore collections:
- `users/{userId}` - User profiles
- `user_secrets/{userId}` - Private data (phone, MFA secrets)

**Security Rules:**
- Users can only read/write their own profile
- Admins can read users in their municipality
- Provincial superadmins can read all users

**Tests:**
- Citizen can register with email/password
- Responder can register with phone number
- Municipal admin can log in
- Provincial superadmin must complete MFA setup
- Custom claims are set correctly
- Security rules enforce access control

**DO NOT:**
- Build any UI yet (authentication forms come later)
- Implement any role-specific features
- Create any incident/report related code

Just authentication and user data model.
```

**Part B: Core Data Model**

**Prompt:**
```
Implement the core Firestore data model for Bantayog Alert.

**Read First:**
- All role specs to understand data needs
- Focus on "Three-tier report split" mentioned in citizen spec

**Collections to Create:**

1. `reports/{reportId}` - Public reports (approximate location, anonymous)
2. `report_private/{reportId}` - Verified reports (full details)
3. `report_ops/{reportId}` - Operational data (dispatch, status)

4. `incidents/{incidentId}` - Verified incidents (from reports)
5. `incident_ops/{incidentId}` - Operational incident data

6. `responders/{responderId}` - Responder profiles
7. `responder_status/{responderId}` - Real-time status

8. `municipalities/{municipalityCode}` - Municipal boundaries, config
9. `alerts/{alertId}` - Emergency alerts
10. `audit_logs/{logId}` - System audit trail

**Schema:**
Follow the three-tier split described in the specs:
- Public data: Anonymized, approximate locations
- Private data: Full details (admin/responder only)
- Operational data: Dispatch, status, coordination

**Indexes:**
Create Firestore indexes for:
- Reports by municipality, status, created date
- Incidents by municipality, severity, status
- Responders by type, availability, municipality
- Alerts by municipality, created date

**Security Rules:**
- Citizens can only create reports, read public feed
- Responders can read their assigned incidents
- Municipal admins can read all data in their municipality
- Provincial superadmins can read all data

**Tests:**
- Create test report (verify three-tier split works)
- Create test incident (verify data flows correctly)
- Create test responder profile
- Verify security rules enforce access control
- Test indexes with queries

**DO NOT:**
- Build any UI
- Implement any business logic (just data model)
- Create any forms or workflows

Just the database schema and security rules.
```

**Success Criteria:**
- ✅ Citizens can register and log in
- ✅ Custom claims are set correctly
- ✅ Firestore collections exist with correct schema
- ✅ Security rules enforce role-based access
- ✅ Indexes support required queries
- ✅ Emulator tests pass

---

### Phase 2: Citizen Features (4-6 weeks)

**Goal:** Citizens can submit reports, receive alerts

**Prompt:**
```
Implement Citizen features for Bantayog Alert.

**Read First:**
- docs/citizen-role-spec.md (COMPLETE citizen specification)
- docs/communication-architecture.md (NO chat features)

**Features to Build:**

1. **Mobile Navigation (5-tab bottom bar)**
   - Map, Feed, Report, Alerts, Profile tabs

2. **Report Submission (3-step flow)**
   - Step 1: Evidence (photos, location)
   - Step 2: Location (map pin)
   - Step 3: Description & Review

3. **Anonymous Reporting**
   - Can submit without account
   - Option to create account after submission

4. **Feed View**
   - Public feed of verified reports
   - Approximate locations only (privacy)
   - Filter by municipality, incident type

5. **Alerts Tab**
   - Receive push notifications
   - View alert history
   - Filter by severity

6. **Profile Management**
   - View own reports
   - Edit profile
   - Log out

**UI Requirements:**
- Mobile-first design (375px - 428px width)
- 5-tab bottom navigation (Map, Feed, Report, Alerts, Profile)
- Touch-friendly buttons (min 44px height)
- Offline support (queue reports when offline)
- PWA manifest (installable on home screen)

**Communication:**
- NO in-app chat
- Show admin phone number for follow-up
- Link to Facebook Messenger for conversations

**Tests:**
- Citizen can submit report (with photos, location, description)
- Anonymous report works
- Feed shows public reports
- Alerts are received via push notification
- Profile shows user's reports
- Offline mode queues reports

**Success Criteria:**
- ✅ Citizens can submit reports
- ✅ Reports appear in feed (verified)
- ✅ Alerts are received
- ✅ Profile management works
- ✅ PWA is installable
```

---

### Phase 3: Responder Features (3-6 weeks)

**Prompt:**
```
Implement Responder features for Bantayog Alert.

**Read First:**
- docs/responder-role-spec.md (COMPLETE responder specification v1.1)
- docs/communication-architecture.md (NO voice messages, use phone calls)

**Features to Build:**

1. **Opt-In Dispatch Acceptance**
   - Receive push notification: "Dispatched to Incident #0471"
   - View incident details
   - Accept or decline (5-minute window)
   - See assigned incident in My Incidents tab

2. **Incident Status Updates**
   - Acknowledged → In Progress → Resolved
   - Quick status toggles (one-tap)
   - Add field notes (timestamped)
   - Upload photos

3. **One-Tap Call Admin**
   - [📞 Call Admin] button
   - Opens phone dialer (NOT in-app calling)
   - Auto-logs: "Called Admin at 14:32"

4. **SOS Emergency Button**
   - Hold for 3 seconds to activate
   - Sends distress signal to all admins
   - Includes last known location
   - Admin can one-tap call back

5. **View Incident Timeline**
   - See what happened before arrival
   - Admin notes
   - Why this responder was chosen

6. **See Team on Incident**
   - Other responders assigned (visibility only)
   - NO team chat (already excluded)

7. **Equipment Checklist**
   - Recommended gear for incident type
   - Acknowledge before accepting dispatch

8. **Pre-Arrival Information**
   - People affected, injuries reported
   - Citizen report (verbatim)
   - Environment conditions

9. **Request Backup**
   - One-tap request for additional resources
   - Admin receives notification

10. **On-Duty Management**
    - Set status: Available / Unavailable / Off-duty
    - View history of past responses
    - Performance metrics

**UI Requirements:**
- Mobile-first (responders work in field)
- Large buttons (hands-full, safety gear)
- One-tap actions wherever possible
- Offline support (status updates queue when offline)

**Communication:**
- NO voice messages (removed from spec)
- NO in-app calling (opens phone dialer instead)
- One-tap Call Admin (phone dialer)
- Facebook Messenger for conversations

**Tests:**
- Responder receives dispatch notification
- Can accept/decline dispatch
- Status updates work (acknowledged → in_progress → resolved)
- One-tap Call Admin opens dialer
- SOS button sends distress signal
- Can view incident timeline
- Can see team on incident
- Can request backup
- On-duty status updates work
- Performance metrics display correctly

**Success Criteria:**
- ✅ Responders receive and accept dispatches
- ✅ Status updates work correctly
- ✅ One-tap Call Admin works (opens dialer)
- ✅ SOS button works
- ✅ Incident timeline visible
- ✅ Backup requests work
- ✅ On-duty management works
```

---

### Phase 4: Municipal Admin Features (6-8 weeks)

**Prompt:**
```
Implement Municipal Admin features for Bantayog Alert.

**Read First:**
- docs/municipal-admin-role-spec.md (COMPLETE municipal admin specification)
- docs/communication-architecture.md (mass alerts, no chat)

**Features to Build:**

1. **Map-Centric Desktop Interface**
   - Full-screen map (ALWAYS visible)
   - Slide-in panels from right (map never covered)
   - Quick actions bar at top edge
   - Multi-monitor support

2. **Queue Triage Mode**
   - Handle surge volume (50+ reports/hour)
   - Priority sorting (severity, time waiting)
   - Quick-scan view (list instead of cards)
   - One-tap actions (verify, reject, request info)

3. **Report Verification**
   - Simplified: Location + Photo = Verified
   - Auto-verify trusted citizens (trust score ≥80)
   - Classify incident type and severity
   - Reject invalid reports (with reason)

4. **Duplicate Detection**
   - Auto-merge duplicate reports
   - Show: "3 reports for same incident"
   - Merge with attribution (who verified first)

5. **Responder Dispatch**
   - Select responder type(s)
   - Choose specific responders (availability, location)
   - Opt-in acceptance model
   - Monitor responder acceptance

6. **Responder Status Dashboard**
   - Real-time: Available / Dispatched / On Scene / Working
   - Last update times
   - Color-coded freshness (green < 5 min, yellow < 15 min, red > 15 min)

7. **Mass Alerts (Type A: Citizens)**
   - Send evacuation warnings to municipality
   - Target: Entire municipality or specific areas
   - Priority: Emergency / Warning / Advisory

8. **Mass Alerts (Type B: Responders)**
   - Send mobilization alerts to responders
   - Option A approved (admin can send directly)
   - Target: By type, by availability, or all

9. **Shift Handoff Tools**
   - Incoming admin sees: "3 active incidents from previous shift"
   - Handoff checklist
   - Acknowledge receipt

10. **Map Filtering & Clustering**
    - Filter by: Status, severity, incident type
    - Cluster pins by proximity
    - Zoom-dependent display

11. **Incident Type Templates**
    - Quick dispatch buttons for common types
    - Pre-configured responder teams
    - Pre-filled severity

12. **Stale Report Auto-Close**
    - Unverified reports auto-close after 7 days
    - Notification before closing

13. **Citizen Communication**
    - Follow up on reports
    - Request clarification
    - Provide updates
    - NO admin identity shown (anonymous)

**UI Requirements:**
- Desktop-first (1920x1080 recommended)
- Map ALWAYS visible (permanent background)
- Panels slide in from right (map stays visible)
- NO full-screen modals that cover map
- Keyboard shortcuts (V, D, R, A, S, H)
- Multi-monitor support

**Communication:**
- Mass alerts via push/SMS (one-way)
- Follow-up via Facebook Messenger or phone
- NO admin identity visible to citizens

**Tests:**
- Queue triage handles surge volume
- Report verification works (location+photo=verified)
- Duplicate detection and merging works
- Responder dispatch works
- Responder status dashboard is real-time
- Mass alerts sent to citizens
- Mass alerts sent to responders
- Shift handoff works
- Map filtering and clustering works
- Auto-close works for stale reports
- Map is always visible (never covered)

**Success Criteria:**
- ✅ Map-centric interface works correctly
- ✅ Queue triage handles surge volume
- ✅ Report verification works
- ✅ Duplicate detection works
- ✅ Responder dispatch works
- ✅ Responder status dashboard is real-time
- ✅ Mass alerts work (citizens + responders)
- ✅ Shift handoff works
- ✅ Map is always visible
```

---

### Phase 5: Provincial Superadmin Features (5-7 weeks)

**Prompt:**
```
Implement Provincial Superadmin features for Bantayog Alert.

**Read First:**
- docs/provincial-superadmin-role-spec.md (COMPLETE specification)
- docs/communication-architecture.md (no direct messaging, no broadcast)

**Features to Build:**

1. **MFA (MANDATORY)**
   - Enroll during account setup
   - TOTP authenticator app (Google Authenticator)
   - SMS backup method
   - Hardware security key (optional)
   - Recovery process (if MFA lost)

2. **Real-Time Analytics Dashboard**
   - Province-wide metrics (real-time)
   - Municipal performance comparison
   - Trend analysis (last 7 days)
   - Drill-down: Province → Municipality → Incident
   - Anomaly detection (auto-alerts)

3. **User Management**
   - Promote/demote Municipal Admins
   - Assign to municipalities
   - Bulk user import (CSV)
   - User activity monitoring
   - Account recovery
   - Deactivation reason tracking
   - Notification on role changes

4. **Multi-Municipality Coordination**
   - Unified view of cross-border incidents
   - Mutual aid request tracking
   - Province-wide alert targeting
   - Escalation notification
   - Resource sharing dashboard
   - Coordination focus (NOT command)

5. **Emergency Declaration**
   - Sole superadmin authority
   - Provincial emergency declaration
   - EOC activation checklist
   - Crisis communication templates

6. **Provincial Resource Management**
   - Centralized inventory (helicopters, heavy equipment)
   - Direct deployment authority (no approval needed)
   - Real-time tracking (GPS)
   - Resource scheduling calendar

7. **Data Privacy (6-Month Retention)**
   - Automated archival after 6 months
   - PII export/download logging (NOT view logging)
   - Data deletion workflow (GDPR)
   - Data anonymization for reports

8. **System Health Monitoring**
   - Real-time dashboard (always-on)
   - Performance degradation alerts (standard thresholds)
   - Disaster recovery procedures

9. **Configuration & Settings**
   - Incident type configuration
   - Severity threshold configuration
   - Alert template management
   - Escalation rule configuration
   - Configuration change audit

10. **Export & Reporting**
    - Automated situation reports
    - Export to PDF/Excel
    - Historical data access
    - Compliance scorecards

**UI Requirements:**
- Desktop-first (dual-monitor support)
- Analytics dashboard (primary view)
- Provincial map (secondary view, optional)
- Drill-down capability
- Real-time updates (5-second refresh)

**Communication:**
- NO direct messaging to Municipal Admins (skipped)
- NO broadcast announcement tools (skipped)
- Use Facebook Messenger or phone calls

**Tests:**
- MFA enrollment and enforcement works
- Analytics dashboard is real-time
- User management works (promote/demote)
- Multi-municipality coordination works
- Emergency declaration works
- Provincial resource deployment works
- Data retention works (6-month archive)
- System health monitoring works
- Configuration and settings work
- Export and reporting works

**Success Criteria:**
- ✅ MFA is mandatory and enforced
- ✅ Analytics dashboard is real-time
- ✅ User management works
- ✅ Multi-municipality coordination works
- ✅ Emergency declaration works
- ✅ Provincial resources managed
- ✅ Data privacy enforced (6-month)
- ✅ System health monitored
```

---

### Phase 6: Integration & Testing (2-3 weeks)

**Prompt:**
```
Integrate all phases and test end-to-end workflows.

**Read First:**
- All role specs to understand cross-role workflows
- docs/communication-architecture.md

**Integration Workflows to Test:**

1. **Citizen Report → Municipal Admin → Responder**
   - Citizen submits report
   - Municipal admin verifies
   - Municipal admin dispatches responder
   - Responder accepts dispatch
   - Responder updates status
   - Responder resolves incident

2. **Multi-Municipality Incident**
   - Incident affects 2+ municipalities
   - Both Municipal admins see incident
   - Municipal admins coordinate (via phone/Messenger)
   - Provincial superadmin monitors
   - Provincial superadmin deploys resources if needed

3. **Emergency Escalation**
   - Municipal admin escalates to provincial
   - Provincial superadmin receives notification
   - Provincial superadmin declares emergency
   - Provincial superadmin activates EOC
   - All municipalities receive alert

4. **Mass Alert Flow**
   - Municipal admin sends evacuation warning
   - Citizens in municipality receive alert
   - Municipal admin mobilizes responders
   - Responders receive mobilization alert

5. **Shift Handoff**
   - Municipal admin A ends shift
   - Municipal admin B starts shift
   - Handoff of active incidents
   - Incident B acknowledges receipt

6. **Data Retention**
   - Report created
   - 6 months pass
   - Report auto-archived
   - Municipal admins can't see archived
   - Provincial superadmin can see archived
   - 12 months pass
   - Report permanently deleted

**End-to-End Tests:**
- Playwright tests for critical workflows
- Firebase emulator tests for security rules
- Integration tests for all role interactions
- Performance tests (surge volume, concurrent users)

**Success Criteria:**
- ✅ All workflows work end-to-end
- ✅ Security rules enforce access control
- ✅ Performance is acceptable (surge volume)
- ✅ Data retention works (6-month archive)
- ✅ All tests pass
```

---

### Phase 7: Hardening & Deployment (2-3 weeks)

**Prompt:**
```
Harden the app and prepare for production deployment.

**Read First:**
- docs/.claude/rules/security.md
- docs/.claude/rules/testing.md
- docs/.claude/rules/git-workflow.md

**Hardening Tasks:**

1. **Security Review**
   - Audit all Firestore rules
   - Test for common vulnerabilities (XSS, injection)
   - Verify MFA enforcement
   - Test PII protection
   - Verify data retention works

2. **Performance Optimization**
   - Lazy loading for routes
   - Code splitting by route
   - Image optimization
   - Bundle size analysis
   - Database query optimization

3. **Accessibility**
   - Keyboard navigation
   - Screen reader support
   - Color contrast (WCAG AA)
   - Focus management
   - ARIA labels

4. **SEO & Metadata**
   - Meta tags for PWA
   - Open Graph tags
   - Apple touch icons
   - manifest.webmanifest

5. **PWA Configuration**
   - Service worker (offline support)
   - Offline fallback pages
   - Update notifications
   - Install prompts

6. **Error Handling**
   - Global error boundary
   - Error logging (Firebase Crashlytics)
   - User-friendly error messages
   - Recovery options

7. **Monitoring**
   - Firebase Analytics
   - Performance monitoring
   - Crash reporting
   - Uptime monitoring

8. **Documentation**
   - API documentation
   - Deployment guide
   - Troubleshooting guide
   - User manuals (per role)

**Deployment:**
- Firebase Hosting (production)
- Firebase Functions (production)
- Firestore (production database)
- Firebase Auth (production)
- Environment variables (production config)

**Tests:**
- Security audit passes
- Performance targets met
- Accessibility audit passes
- PWA installs correctly
- All tests pass (unit, integration, e2e)
- Documentation is complete

**Success Criteria:**
- ✅ Security audit passes
- ✅ Performance targets met
- ✅ Accessibility audit passes
- ✅ PWA works offline
- ✅ Deployed to production
- ✅ Monitoring is active
- ✅ Documentation is complete
```

---

## Prompting AI Agents

### General Prompting Strategy

**DO:**
- ✅ Give context first ("Read the spec")
- ✅ Be specific about what to build
- ✅ Reference the exact spec document
- ✅ Ask for a plan BEFORE coding
- ✅ Require tests (TDD)
- ✅ Review the code against the spec

**DON'T:**
- ❌ Skip the spec ("just build a disaster reporting app")
- ❌ Assume the AI knows the context
- ❌ Accept code that doesn't match the spec
- ❌ Let the AI skip testing
- ❌ Move to next phase without testing

### Example Prompts

**Good Prompt:**
```
Implement the Report Submission feature for citizens in Bantayog Alert.

**Context:**
- Read: docs/citizen-role-spec.md section "Report Submission"
- This is a 3-step flow: Evidence → Location → Description
- Must support anonymous reporting (no login required)
- Must support offline mode (queue reports when offline)

**Your Task:**
1. Create React component: ReportFormStep[1/2/3].tsx
2. Implement geolocation (Leaflet map)
3. Implement photo upload (Firebase Storage)
4. Implement form validation
5. Write tests first (TDD)
6. Test offline mode

**Critical Constraints:**
- NO chat features (read docs/communication-architecture.md)
- Follow React best practices (component structure, hooks)
- Use TypeScript strict mode
- Test with Vitest + Playwright
- Follow coding style in docs/.claude/rules/coding-style.md

**Questions:**
Ask me BEFORE you start if anything is unclear about the spec.
```

**Bad Prompt:**
```
Build a disaster reporting app where citizens can submit reports.
```

(Too vague, no context, will miss requirements)

---

## Tracking Progress

### Use the Master Plan

Create a checklist file:

```markdown
# Bantayog Alert - Implementation Checklist

## Phase 0: Project Setup
- [ ] Initialize Vite + React + TypeScript
- [ ] Install dependencies
- [ ] Configure Tailwind CSS
- [ ] Set up Firebase emulators
- [ ] Create folder structure
- [ ] Set up testing (Vitest, Playwright)
- [ ] Verify everything works

## Phase 1: Authentication
- [ ] Firebase Auth setup
- [ ] Custom claims for roles
- [ ] MFA for superadmins
- [ ] Security rules
- [ ] Tests pass

## Phase 2: Citizen Features
- [ ] Mobile navigation (5-tab)
- [ ] Report submission (3-step)
- [ ] Anonymous reporting
- [ ] Feed view
- [ ] Alerts tab
- [ ] Profile management
- [ ] Tests pass

... and so on
```

### Version Control Strategy

```bash
# Create branches for each phase
git checkout -b phase-0-setup
git checkout -b phase-1-auth
git checkout -b phase-2-citizen
git checkout -b phase-3-responder
git checkout -b phase-4-municipal-admin
git checkout -b phase-5-provincial-superadmin
git checkout -b phase-6-integration
git checkout -b phase-7-hardening

# Merge to main when complete
git checkout main
git merge phase-0-setup
```

---

## Common Pitfalls

### Pitfall #1: Skipping the Spec

**Problem:** AI agent builds feature without reading the spec

**Solution:**
```
ALWAYS start your prompt with:
"Read docs/[ROLE-NAME]-role-spec.md first"
```

### Pitfall #2: Building Chat Features

**Problem:** AI agent adds chat/messaging because it's "standard"

**Solution:**
```
ALWAYS include in your prompt:
"Read docs/communication-architecture.md (NO chat features)"
"Do NOT build any chat, messaging, or in-app calling"
```

### Pitfall #3: Skipping Tests

**Problem:** AI agent writes code without tests

**Solution:**
```
ALWAYS include in your prompt:
"Use Test-Driven Development (write tests FIRST)"
"Create tests for each feature before implementation"
```

### Pitfall #4: Wrong Phase Order

**Problem:** Building Phase 4 before Phase 2

**Solution:**
```
Follow the phase order strictly.
DO NOT skip ahead.
Each phase depends on the previous.
```

### Pitfall #5: Not Reviewing Code

**Problem:** Accepting AI code without checking against spec

**Solution:**
```
After AI agent completes a feature:
1. Read the spec yourself
2. Compare the code to the spec
3. Test the feature manually
4. Ask for revisions if it doesn't match
```

---

## Quick Reference: Spec Documents

| Document | Purpose | When to Use |
|----------|---------|-------------|
| `citizen-role-spec.md` | Citizen features | Building Phase 2 |
| `responder-role-spec.md` | Responder features | Building Phase 3 |
| `municipal-admin-role-spec.md` | Municipal admin features | Building Phase 4 |
| `provincial-superadmin-role-spec.md` | Provincial superadmin features | Building Phase 5 |
| `communication-architecture.md` | Communication rules | ALWAYS (prevents chat features) |
| `.claude/rules/coding-style.md` | Coding standards | Writing code |
| `.claude/rules/testing.md` | Testing guidelines | Writing tests |
| `.claude/rules/security.md` | Security rules | Security review |

---

## Next Steps

1. **Initialize your blank repo** (Phase 0)
2. **Start with Phase 1** (Authentication + Data Model)
3. **Follow the phase order** strictly
4. **Reference the specs** for each phase
5. **Test everything** before moving on
6. **Review against specs** before accepting

**Remember:** The specs are your source of truth. If the AI agent's code doesn't match the spec, ask for revisions.

---

**Version:** 1.0
**Date:** 2026-04-10
**Status:** Ready for implementation
