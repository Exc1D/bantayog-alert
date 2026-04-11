# Citizen Features Design Document

**Project:** Bantayog Alert - Phase 2: Citizen Features
**Date:** 2026-04-11
**Status:** Design Approved
**Author:** Superpowers Brainstorming Session

---

## Executive Summary

Bantayog Alert is a disaster reporting and alert platform for Camarines Norte, Philippines. Phase 2 implements the citizen-facing mobile app with a minimalist, anonymous-first design that prioritizes speed and clarity during emergencies.

**Core Design Philosophy:** "Clarity at a glance" — minimal buttons, minimal words, maximum clarity.

**Key Decisions:**
- 5-tab bottom navigation with prominent center Report tab
- Anonymous-first user flow with 5 natural conversion touchpoints
- Simplified 4-field report form (admins classify disaster types)
- PWA with offline queue and hybrid sync
- Calm blue (#1E40AF) + urgent red (#DC2626) color system
- NO in-app chat (use Facebook Messenger + phone)

---

## 1. Architecture Overview

### 1.1 Tech Stack

**Frontend:**
- React 18.3.1 + TypeScript 6.0.2
- Vite 5.4.11 (build tool)
- Tailwind CSS v3.4.17 (styling)
- React Router 6.5.0 (navigation)
- TanStack Query 5.96.2 (server state)
- Zustand 5.0.12 (client state)
- PWA: Vite PWA Plugin + workbox
- Leaflet 4.2.1 + react-leaflet (maps)
- Lucide React (icons — NO emojis)

**Backend (Firebase):**
- Firestore (data persistence)
- Functions (serverless logic)
- Auth (authentication)
- Storage (image uploads)
- Hosting (PWA deployment)
- Cloud Messaging (push notifications)

**Testing:**
- Vitest (unit + integration)
- Playwright (E2E)
- Firebase Emulator (Firestore rules + functions)

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         Citizen App                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Map Tab   │  │   Feed Tab  │  │    Report Tab       │ │
│  │  (Leaflet)  │  │  (Reports)  │  │   (Form + Camera)   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                    │             │
│         └────────────────┴────────────────────┘┘           │
│                          │                                 │
│                   ┌──────▼──────┐                          │
│                   │ TanStack    │                          │
│                   │ Query       │                          │
│                   └──────┬──────┘                          │
│                          │                                 │
│  ┌───────────────────────┼───────────────────────────┐    │
│  │                       │                           │    │
│  │  ┌────────────────────▼────────────────────┐     │    │
│  │  │         IndexedDB (Offline Queue)       │     │    │
│  │  │  - Queued reports                       │     │    │
│  │  │  - Draft reports                        │     │    │
│  │  │  - Offline data cache                   │     │    │
│  │  └────────────────────┬────────────────────┘     │    │
│  │                       │                           │    │
│  └───────────────────────┼───────────────────────────┘    │
│                          │                                 │
└──────────────────────────┼─────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Service     │
                    │ Worker      │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Firebase   │
                    │  Backend    │
                    └─────────────┘
```

### 1.3 Component Structure

```
src/
├── app/
│   ├── App.tsx                    # Root component
│   ├── navigation.tsx             # Bottom tab navigation
│   └── routes.tsx                 # Route definitions
├── features/
│   ├── map/
│   │   ├── components/
│   │   │   ├── MapView.tsx        # Leaflet map component
│   │   │   ├── ReportPin.tsx      # Custom map marker
│   │   │   └── MapFilters.tsx     # Filter controls
│   │   ├── hooks/
│   │   │   └── useReportMarkers.ts
│   │   └── services/
│   │       └── map.service.ts
│   ├── feed/
│   │   ├── components/
│   │   │   ├── FeedCard.tsx       # Report card in feed
│   │   │   ├── FeedFilters.tsx    # Filter by status/type
│   │   │   └──── EmptyState.tsx
│   │   ├── hooks/
│   │   │   └── useFeedReports.ts
│   │   └── services/
│   │       └── feed.service.ts
│   ├── report/
│   │   ├── components/
│   │   │   ├── ReportForm.tsx     # 4-field form
│   │   │   ├── PhotoCapture.tsx   # Camera/gallery
│   │   │   ├── LocationPicker.tsx # GPS + manual override
│   │   │   └── FormError.tsx      # Inline error display
│   │   ├── hooks/
│   │   │   ├── useReportSubmit.ts
│   │   │   └── useOfflineQueue.ts
│   │   └── services/
│   │       ├── report.service.ts
│   │       └── offline-queue.service.ts
│   ├── alerts/
│   │   ├── components/
│   │   │   ├── AlertCard.tsx      # In-app alert card
│   │   │   ├── AlertList.tsx      # Alerts tab content
│   │   │   └── EmptyState.tsx
│   │   ├── hooks/
│   │   │   ├── useAlerts.ts
│   │   │   └── usePushNotifications.ts
│   │   └── services/
│   │       └── alert.service.ts
│   └── profile/
│       ├── components/
│       │   ├── AnonymousProfile.tsx   # Conversion CTA
│       │   ├── RegisteredProfile.tsx  # User dashboard
│       │   ├── AccountLinkModal.tsx   # Link past reports
│       │   └── ConversionPrompt.tsx   # 5 touchpoint prompts
│       ├── hooks/
│       │   ├── useUserProfile.ts
│       │   └── useAccountConversion.ts
│       └── services/
│           └── profile.service.ts
├── shared/
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── StatusBadge.tsx
│   │   └── OfflineIndicator.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useGeolocation.ts
│   │   └── useNetworkStatus.ts
│   ├── services/
│   │   ├── firebase.service.ts
│   │   └── storage.service.ts
│   └── utils/
│       ├── validators.ts
│       └── formatters.ts
└── main.tsx
```

---

## 2. Navigation Structure

### 2.1 Bottom Tab Bar

**Design:** 5-tab fixed bottom navigation bar with prominent center tab.

**Tabs (left to right):**
1. **Map** - View reports on map
2. **Feed** - Scrollable list of public reports
3. **Report** - Submit new report (CENTER TAB, PROMINENT)
4. **Alerts** - Official emergency alerts
5. **Profile** - User profile and settings

**Center Report Tab Specifications:**
- 30% larger than other tabs
- Red gradient background (#DC2626 → #EF4444)
- White border (2px) creates elevation effect
- Elevated shadow (4px drop shadow)
- White report icon
- Draws immediate attention as primary action

**Active Tab State:**
- Active tab: Blue icon (#1E40AF), subtle bottom border (2px)
- Inactive tabs: Gray icons (#6B7280)

**Icons (Lucide React):**
- Map: `MapPin`
- Feed: `List`
- Report: `AlertCircle` (center, larger)
- Alerts: `Bell`
- Profile: `User`

### 2.2 Default Home

**Map is the default screen** when app opens.

**Rationale:** Maps provide immediate spatial context — users see where reports are clustered, identify patterns, and understand the scope of incidents in their area. Feeds are secondary for detailed reading.

---

## 3. Core Features

### 3.1 Map Tab

**Purpose:** View reports geographically, identify clusters, assess incident scope.

**Components:**
- **MapView**: Leaflet map centered on user's location
- **ReportPin**: Custom markers with color-coded severity
- **MapFilters**: Filter by status (verified, pending, resolved)

**Interactions:**
- Tap pin → Open report detail modal
- Filter buttons → Show/hide by status
- Zoom/pinch → Navigate map

**Pin Design:**
- Verified: Blue (#1E40AF)
- Pending: Yellow (#F59E0B)
- Resolved: Green (#10B981)
- Pin size scales with zoom level

**Location Permission:**
- **First request:** Clear permission dialog explaining need
- **If denied:** Fall back to manual location selection dropdown
- **If granted:** Center map on user GPS

**Report Modal (Medium Preview):**
Bottom sheet modal that slides up when pin is tapped.

```
┌─────────────────────────────────────┐
│  [Photo Thumbnail - 200x200px]      │
│                                     │
│  Flash Flood                    ●   │
│  Barangay San Jose, Daet           │
│  2 hours ago                       │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  View Full Details          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ╳ Close                            │
└─────────────────────────────────────┘
```

**Modal Content:**
- Photo thumbnail (200x200px, centered)
- Disaster type (bold, 18px, top-left)
- Status badge (top-right, colored dot)
- Full location (barangay + municipality, 14px)
- Time ago (relative, 14px, gray)
- "View Full Details" button (blue, large, 44px height)
- Close button (X icon, top-right corner)

**Modal Interactions:**
- Tap outside modal → Close
- Swipe down → Close
- "View Full Details" → Navigate to full report detail screen
- Back button → Close

### 3.2 Feed Tab

**Purpose:** Scrollable list of public reports for detailed reading.

**FeedCard Design:**
```
┌─────────────────────────────────────┐
│ [Thumbnail]  Flash Flood           │
│              Barangay San Jose      │
│              2 hours ago           │
│                                     │
│ Heavy flooding on main road...      │
│                                     │
│ Status: Pending                    │
└─────────────────────────────────────┘
```

**Card Content:**
- Photo thumbnail (left, 60x60px)
- Disaster type (bold, 14px)
- Location (municipality + barangay)
- Time ago (relative: "2 hours ago")
- Description preview (2 lines, ellipsis)
- Status badge (Verified/Pending/Resolved)

**Filtering:**
- Filter by status (all/verified/pending/resolved)
- Sort by newest or proximity

**Empty States:**
- No reports: "No reports in your area yet. Be the first to report!"
- Filtered empty: "No reports match your filters."

### 3.3 Report Tab (Primary Action)

**Design Philosophy:** Minimal fields, maximal speed. Citizens describe what they see; admins classify during triage.

**4-Field Form (Single Screen):**

1. **Photo** (required)
   - Large capture area (top 40% of screen)
   - Primary button: "Take Photo" (camera icon)
   - Secondary: "Choose from Gallery" (image icon)
   - Preview captured image
   - If camera denied → gallery-only mode
   - Max file size: 5MB
   - Auto-compression before upload

2. **Location** (auto-detected, required)
   - GPS auto-detection on mount
   - Display: "Barangay San Jose, Daet, Camarines Norte"
   - Edit button → Manual override dropdowns
   - Hierarchy: Municipality → Barangay
   - If GPS denied → Show dropdowns immediately
   - Validation: Must select municipality

3. **Description** (optional, 500 char max)
   - Textarea: "Describe what you see..."
   - Character counter: "0/500"
   - No disaster type dropdown (admins classify)

4. **Phone** (required for verification)
   - Format: +63 XXX XXX XXXX
   - Placeholder: "+63 912 345 6789"
   - Validation: PH mobile format regex
   - Purpose: Admin can call for details

**Submit Button:**
- Fixed at bottom: "Submit Report" (large, 48px height)
- Red background (#DC2626)
- Disabled until required fields valid
- Loading state: "Submitting..." with spinner
- Success: "Report submitted! View your report in Profile."

**Error Handling:**
- Inline validation errors below each field
- Network error: "Report queued. Will sync when online."
- Permission denied: Graceful fallbacks (see Smart Fallbacks below)

### 3.4 Alerts Tab

**Purpose:** Receive official emergency alerts from municipal/provincial admins.

**Alert Sources:**
- Municipal admins → Their municipality only
- Provincial superadmins → Entire province
- Citizens/responders → Cannot create alerts (reports only)

**AlertCard Design:**
```
┌─────────────────────────────────────┐
│ ⚠️  TYPHOON WARNING                 │
│    Camarines Norte                  │
│    30 min ago                       │
│                                     │
│ Typhoon approaching. Prepare...     │
│                                     │
│ [View Details]                      │
└─────────────────────────────────────┘
```

**Push Notifications:**
- FCM push for new alerts
- Notification payload: Alert ID, title, severity
- Tap notification → Open app to Alerts tab
- Location-based targeting: User's registered municipality

**In-App Behavior:**
- Newest alerts at top
- Auto-refresh on tab focus
- Dismissible cards
- Severity indicators (Low/Medium/High/Critical)

**Alert Scoping:**
- Registered users: Receive alerts for registered municipality
- Anonymous users: Receive alerts based on GPS location
- No alerts outside scope

### 3.5 Profile Tab

**Adaptive Profile:** Different content for anonymous vs registered users.

#### Anonymous User State

**Header:**
- Avatar icon (gray, 60px)
- "Not Signed In" (18px, bold)

**Value Proposition:**
**"Why create an account?"**
- ✓ Track your report status
- ✓ Edit or update your reports
- ✓ Receive verified alerts
- ✓ Link past reports by phone

**CTA Buttons:**
- Primary: "Create Account (30 sec)" (blue, large)
- Secondary: "Continue as Anonymous" (gray outline)

**Link Past Reports:**
**"Already submitted reports?"**
- Enter phone number to link past anonymous reports
- "We'll send a verification code"
- Input: Phone number field
- Button: "Link Reports"

**Admin Contact:**
- "Contact your admin"
- Phone number (tap to call)
- Facebook Messenger link (tap to open)

#### Registered User State

**Header:**
- User avatar with initials (colored circle, 60px)
- Full name (20px, bold)
- Email address (14px, gray)
- Municipality (14px, gray)

**Quick Stats:**
- Total reports: 3
- Verified: 2
- Pending: 0

**My Reports Section:**
- List of user's reports (last 3)
- Each shows: Photo thumb, type, location, status, date
- Tap → Report detail modal
- "View All Reports" link

**Quick Actions:**
- Edit Profile (name, phone, municipality)
- Notification Settings
- Privacy Settings (see details below)
- Help & Support
- Log Out (red, bottom)

**Privacy Settings (Minimal Set):**
Toggle controls for:
- **Show name on my reports** (default: ON) - Display name on public reports vs show as "Anonymous"
- **Auto-delete old resolved reports** (default: OFF) - Automatically delete resolved reports older than 1 year

---

## 4. Anonymous-First User Flow

### 4.1 Philosophy

Anonymous users can submit reports without sign-up. Account creation is offered naturally at 5 touchpoints, never forced.

### 4.2 Anonymous Capabilities

- ✓ Submit reports with photo, location, description, phone
- ✓ View map and feed
- ✓ Receive location-based alerts
- ✓ Track reports via phone number (in profile)
- ✗ Edit/delete reports (requires account)

### 4.3 Account Conversion Touchpoints

1. **After First Report**
   - Success screen shows: "Create account to track this report?"
   - Inline CTA: "Sign up (30 sec)"
   - Dismissible

2. **Profile Tab Access**
   - Anonymous profile shows conversion CTA
   - Value props clearly listed
   - "Continue as Anonymous" always available

3. **After 3+ Report Views**
   - In-app toast: "Enjoying the app? Create an account for more features"
   - Dismissible, doesn't block

4. **Attempting to Edit Report**
   - Anonymous users can't edit
   - Inline message: "Create an account to edit your reports"
   - CTA: "Sign up free"

5. **Report Status Change**
   - If report verified, push notification: "Your report was verified! Create an account to track future reports"
   - Deep link to sign-up flow

### 4.4 Sign-Up Flow

**3-Step Process (30 seconds):**

1. **Name & Email**
   - Full name (required)
   - Email (required)
   - Next button

2. **Municipality & Password**
   - Select municipality (dropdown)
   - Create password (min 8 chars)
   - Show password toggle
   - Next button

3. **Confirm Phone**
   - Enter phone number (pre-filled from report if available)
   - Send 6-digit code via SMS
   - Verify code input
   - Complete button

**Post-Sign-Up:**
- Redirect to Profile tab
- Show welcome animation
- Auto-link past reports by phone number

---

## 5. Offline Queue & Sync

### 5.1 Hybrid Sync Strategy

Auto-sync in background + manual "Sync Now" for impatient users.

### 5.2 Offline Behavior

**When Offline:**
- Show offline indicator (top banner, gray)
- Report form still accessible
- Submitted reports queued in IndexedDB
- Map/Feed show cached data with timestamp
- "Last updated: 5 min ago (offline)"

**Queue Management:**
- Queue count badge on Report tab icon
- "Sync Now" button in Profile tab
- Swipe to delete queued reports (opt-in)

### 5.3 Sync Behavior

**Auto-Sync:**
- Triggers when connection restored
- Runs in background (service worker)
- Processes queue sequentially
- Shows sync progress in notification

**Manual Sync:**
- "Sync Now" button in Profile
- Immediate foreground sync
- Progress bar: "Syncing 3 of 5 reports..."
- Success: "All reports synced!"

**Conflict Resolution:**
- If report already exists server-side → Skip duplicate
- If phone number conflicts → Admin reviews
- No data loss

### 5.4 IndexedDB Schema

```javascript
{
  stores: {
    queued_reports: {
      keyPath: 'id',
      indexes: {
        timestamp: 'createdAt',
        status: 'syncStatus'
      }
    },
    drafts: {
      keyPath: 'id',
      indexes: {
        timestamp: 'lastModified'
      }
    },
    cache: {
      keyPath: 'key',
      indexes: {
        expiry: 'expiresAt'
      }
    }
  }
}
```

---

## 6. Smart Fallbacks (Permission Denied)

### 6.1 GPS Permission Denied

**Fallback: Manual Location Dropdowns**

**Hierarchy:**
1. Select Municipality (12 municipalities of Camarines Norte)
2. Select Barangay (load barangays for selected municipality)
3. Auto-fill province (Camarines Norte, read-only)

**UX:**
- Show dropdowns immediately after denial
- No second prompt
- Save selection for future reports
- Allow GPS retry in Settings

### 6.2 Camera Permission Denied

**Fallback: Gallery Upload**

**Behavior:**
- Hide "Take Photo" button
- Show "Choose from Gallery" as primary
- File picker opens (image/* filter)
- Same validation (5MB, JPEG/PNG)

**UX:**
- Clear message: "Camera access denied. Choose a photo from your gallery."
- No second prompt
- Allow permission retry in Settings

### 6.3 Notification Permission Denied

**Graceful Degradation:**

- In-app alerts still work (no push)
- Check Alerts tab manually
- No prompts on every visit
- Settings: "Enable notifications" (one-time prompt)

---

## 7. Communication Architecture

### 7.1 NO In-App Chat

**Rationale:** Building real-time chat is expensive, complex, and redundant.

### 7.2 Official Communication Channels

**For Citizens:**
- **Admin Phone Number:** Displayed in Profile tab
  - Tap to call (tel: links)
  - Municipal admin direct line

- **Facebook Messenger Link:**
  - "Message admin on Messenger"
  - Opens Messenger app with admin account
  - Pre-filled message: "Hi, I have a question about my report #123"

**For Admins:**
- Call citizens for report verification
- Messenger for follow-up questions
- No in-app messaging infrastructure

---

## 8. Visual Design System

### 8.1 Colors

**Primary Palette:**
- Calm Blue: `#1E40AF` (trust, information, navigation)
- Urgent Red: `#DC2626` (emergencies, Report tab, alerts)
- Success Green: `#10B981` (verified status)
- Warning Yellow: `#F59E0B` (pending status)
- Neutral Gray: `#6B7280` (inactive states)

**Backgrounds:**
- Primary: `#FFFFFF` (white)
- Secondary: `#F9FAFB` (light gray)
- Surface: `#F3F4F6` (elevated cards)

**Text:**
- Primary: `#111827` (near black)
- Secondary: `#6B7280` (gray)
- On Dark: `#FFFFFF` (white)

### 8.2 Typography

**Font Family:** Inter (default Tailwind font)

**Sizes:**
- Heading 1: 24px (screen titles)
- Heading 2: 20px (section headers)
- Heading 3: 18px (card titles)
- Body: 16px (primary content)
- Small: 14px (metadata)
- X-Small: 12px (timestamps)

**Weights:**
- Bold: 700 (headings)
- Semibold: 600 (emphasis)
- Regular: 400 (body)
- Light: 300 (subtle text)

### 8.3 Spacing

**Base Unit:** 4px (Tailwind default)

**Scales:**
- XS: 4px
- SM: 8px
- MD: 16px
- LG: 24px
- XL: 32px

**Touch Targets:**
- Minimum 44px (buttons, tabs, tappable areas)
- Preferred 48px (primary actions)

### 8.4 Icons

**Icon Set:** Lucide React

**Usage:**
- Navigation: 24px
- Buttons: 20px
- Inline: 16px
- Always monochromatic (no emojis)

**Common Icons:**
- `MapPin` - Location
- `List` - Feed
- `AlertCircle` - Report tab
- `Bell` - Alerts
- `User` - Profile
- `Camera` - Photo capture
- `Image` - Gallery
- `Check` - Verified status
- `Clock` - Pending status
- `X` - Close/delete

---

## 9. Data Models

### 9.1 Report Schema (Firestore)

```typescript
interface Report {
  id: string;
  userId?: string;                    // undefined if anonymous
  phoneNumber: string;                // required, PH format
  status: 'pending' | 'verified' | 'resolved' | 'false_alarm';
  disasterType?: string;              // set by admin during triage
  description: string;                // optional, max 500 chars
  location: {
    municipality: string;             // required
    barangay: string;                 // required
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  imageUrl: string;                   // Firebase Storage URL
  thumbnails: {
    small: string;                    // 150x150
    medium: string;                   // 300x300
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  verifiedAt?: Timestamp;
  verifiedBy?: string;                // admin userId
  isPublic: boolean;                  // true once verified
  viewCount: number;
}
```

### 9.2 Alert Schema (Firestore)

```typescript
interface Alert {
  id: string;
  title: string;                      // e.g., "TYPHOON WARNING"
  message: string;                    // Full alert message
  severity: 'low' | 'medium' | 'high' | 'critical';
  targetMunicipalities: string[];     // [] = entire province
  createdBy: string;                  // admin userId
  createdByRole: 'municipal' | 'provincial';
  createdAt: Timestamp;
  expiresAt?: Timestamp;              // optional expiry
  isPublished: boolean;
  pushNotificationSent: boolean;
}
```

### 9.3 User Schema (Firestore)

```typescript
interface User {
  id: string;                         // Firebase Auth UID
  email: string;
  phoneNumber: string;
  name: string;
  municipality: string;               // registered municipality
  role: 'citizen' | 'municipal_admin' | 'provincial_superadmin' | 'responder';
  isAnonymous: boolean;               // false if account created
  createdAt: Timestamp;
  fcmTokens?: string[];               // push notification tokens
  linkedReports: string[];            // report IDs linked by phone
  settings: {
    notificationsEnabled: boolean;
    emailAlerts: boolean;
    pushAlerts: boolean;
  };
}
```

---

## 10. Security & Privacy

### 10.1 Firestore Security Rules

**Reports Collection:**
- Public read: Only verified reports (`isPublic == true`)
- Create: Any authenticated or anonymous user (validated by Cloud Function)
- Update: Only author (match `request.auth.uid == resource.data.userId`)
- Delete: Only author or admin

**Alerts Collection:**
- Read: All authenticated users
- Create: Municipal admins (municipality scope) or provincial superadmins (province-wide)
- Update/Delete: Only alert creator or superadmin

**Users Collection:**
- Read: Own user document only
- Create: Anyone (through Cloud Function with validation)
- Update: Own user document only
- Delete: Own user document only

### 10.2 Input Validation

**Client-Side (Zod schemas):**
```typescript
const ReportSchema = z.object({
  phoneNumber: z.string().regex(/^\+63\d{10}$/),
  description: z.string().max(500).optional(),
  location: z.object({
    municipality: z.string().min(1),
    barangay: z.string().min(1),
  }),
});
```

**Server-Side (Cloud Functions):**
- Validate all data before writing to Firestore
- Sanitize HTML in description (prevent XSS)
- Validate image file type and size
- Rate limit: 5 reports per hour per phone number

### 10.3 Privacy

**Anonymous Reports:**
- Phone number required for verification
- Phone number visible only to admins
- No personally identifiable information in public reports
- Location is approximate (barangay level, not exact coordinates)

**Registered Users:**
- Email and phone visible only to admins
- Name displayed on own reports only
- Location is approximate (municipality + barangay)

**Data Minimization:**
- Collect only required fields
- No unnecessary metadata
- Auto-delete old resolved reports (configurable retention)

---

## 11. Performance Requirements

### 11.1 Load Time Targets

- **Initial Paint:** < 1.5s
- **Time to Interactive:** < 3s
- **Report Submission:** < 2s (3G connection)
- **Map Render:** < 1s (with cached tiles)

### 11.2 Optimization Strategies

**Code Splitting:**
- Lazy load route components
- Separate vendor and app bundles
- Dynamic imports for heavy libraries (Leaflet)

**Image Optimization:**
- Compress photos before upload (client-side)
- Generate multiple thumbnail sizes
- Lazy load images in feed
- WebP format with JPEG fallback

**Caching:**
- Service worker for static assets
- IndexedDB for offline data
- Cache-first strategy for static content
- Network-first strategy for API calls

**Bundle Size:**
- Target: < 200KB gzipped (initial bundle)
- Tree-shaking for unused code
- Minimize dependencies

---

## 12. Testing Strategy

### 12.1 Unit Tests (Vitest)

**Coverage Goals:**
- Utility functions: 100%
- Custom hooks: 90%+
- Services: 80%+

**Key Tests:**
- `useOfflineQueue` hook: Queue management, sync logic
- `useGeolocation` hook: Permission handling, fallbacks
- Form validators: Phone regex, field validation
- Report service: API calls, error handling
- IndexedDB service: CRUD operations

### 12.2 Integration Tests (React Testing Library)

**User Flows:**
1. Submit anonymous report (photo, location, description, phone)
2. Link past reports by phone number
3. Create account flow
4. Edit report as registered user
5. View and filter alerts
6. Sync offline queue

**Components:**
- ReportForm: All 4 fields, validation, submission
- MapView: Pin rendering, filtering
- FeedCard: Display, filtering
- AlertCard: Push notification handling
- ProfileTab: Anonymous vs registered states

### 12.3 E2E Tests (Playwright)

**Critical Paths:**
1. Anonymous report submission
2. Account creation and report linking
3. Offline mode → queue → sync
4. GPS denied → manual location selection
5. Camera denied → gallery upload
6. Alert push notification → open app

**Browsers:**
- Chromium (primary)
- Firefox
- WebKit (Safari mobile equivalent)

### 12.4 Firestore Rules Tests

**Security Rules:**
- Anonymous user can create report
- Anonymous user cannot update report
- Citizen can read only public reports
- Citizen cannot create alerts
- Admin can create alert for their municipality
- Provincial admin can create province-wide alert

---

## 13. Accessibility (a11y)

### 13.1 Requirements

- **WCAG 2.1 Level AA** compliance
- Minimum color contrast: 4.5:1
- All interactive elements keyboard accessible
- Screen reader support (TalkBack, VoiceOver)

### 13.2 Implementation

**Semantic HTML:**
- Use `<button>` for actions, `<div>` only for layout
- Proper heading hierarchy (h1 → h2 → h3)
- ARIA labels for icon-only buttons
- Alt text for all images

**Keyboard Navigation:**
- Tab order matches visual flow
- Focus indicators visible (2px blue outline)
- Enter/Space activate buttons
- Escape closes modals

**Screen Reader:**
- `aria-label` on map pins
- `aria-live` for status updates
- `role="alert"` for error messages
- Skip to main content link

**Touch Targets:**
- Minimum 44px (Apple HIG)
- Preferred 48px
- Spacing between adjacent buttons

---

## 14. Progressive Web App (PWA)

### 14.1 PWA Features

**Installable:**
- Web app manifest
- Add to home screen prompt
- App icon (192x192, 512x512)
- Splash screen

**Offline-First:**
- Service worker for caching
- IndexedDB for data persistence
- Offline queue for reports
- Graceful degradation

**Native-Like:**
- Fixed bottom navigation
- Touch-optimized UI
- Smooth animations
- App-like transitions

### 14.2 Manifest Configuration

```json
{
  "name": "Bantayog Alert",
  "short_name": "Bantayog",
  "description": "Disaster reporting for Camarines Norte",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#1E40AF",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 14.3 Service Worker Strategy

**Cache First:**
- Static assets (CSS, JS, images)
- App shell (HTML skeleton)

**Network First:**
- API calls (reports, alerts, user data)
- Fall back to cache if offline

**Stale-While-Revalidate:**
- Report list cache
- Update in background

---

## 15. Error Handling

### 15.1 Network Errors

**Report Submission:**
- Show inline error: "Network error. Report queued."
- Auto-retry with exponential backoff
- Manual "Retry Now" button

**Data Fetching:**
- Show cached data with timestamp
- "Pull to refresh" indicator
- Offline banner at top

**Image Upload:**
- Retry failed uploads
- Compress and retry
- Fallback: Submit report without photo (rare)

### 15.2 Validation Errors

**Form Fields:**
- Inline error below field
- Red border on invalid field
- Clear error messages
- Disable submit until valid

**Examples:**
- Phone: "Invalid phone number. Use +63 XXX XXX XXXX format."
- Location: "Please select a municipality."
- Photo: "Photo required. Max 5MB."

### 15.3 Permission Errors

**GPS/Camera Denied:**
- Friendly explanation
- Fallback to manual input
- Link to app settings

**Notification Blocked:**
- One-time explanation
- No repeated prompts
- Settings link for re-enable

---

## 16. Internationalization (i18n)

**Future consideration:**
- Currently English-only
- Tagalog translations planned
- Support for local dialects (Bikol)
- Date/time formatting: Philippines timezone (Asia/Manila)

---

## 17. Launch Checklist

### 17.1 Pre-Launch

- [ ] All tests passing (unit, integration, E2E)
- [ ] Firestore security rules tested and deployed
- [ ] PWA manifest configured
- [ ] Service worker registered and tested
- [ ] Firebase Emulator tests passing
- [ ] Performance targets met (< 3s TTI)
- [ ] Accessibility audit passed
- [ ] Bundle size under 200KB gzipped
- [ ] Environment variables configured
- [ ] Error tracking (Sentry/Firebase Crashlytics)

### 17.2 Post-Launch Monitoring

- [ ] Error rate monitoring
- [ ] Report submission success rate
- [ ] Offline queue sync success rate
- [ ] Account conversion rate
- [ ] Average report submission time
- [ ] Push notification delivery rate
- [ ] App install rate (PWA)

---

## 18. Future Enhancements (Out of Scope for Phase 2)

- **Offline map tiles:** Download map areas for offline viewing
- **Report comments:** Allow citizens to comment on verified reports
- **Report sharing:** Share reports to social media
- **Dark mode:** System preference support
- **Multi-language:** Tagalog, Bikol translations
- **Advanced map filters:** Filter by disaster type, date range
- **Report voting:** Upvote important reports
- **Admin dashboard:** Municipal admin web interface
- **Analytics:** Report trends, hotspot visualization
- **SMS gateway:** Submit reports via SMS for non-smartphone users

---

## 19. Success Metrics

**User Engagement:**
- 100+ reports submitted in first month
- 30% account conversion rate (anonymous → registered)
- 60% return rate within 7 days

**Technical:**
- < 2s average report submission time
- > 95% offline queue sync success rate
- > 90% push notification delivery rate

**Community Impact:**
- 70% of reports verified within 24 hours
- Positive feedback from municipal admins
- Reduced response time to incidents

---

## Appendix A: Municipalities of Camarines Norte

1. Basud
2. Capalonga
3. Daet
4. Jose Panganiban
5. Labo
6. Mercedes
7. Paracale
8. San Lorenzo Ruiz
9. San Vicente
10. Santa Elena
11. Talisay
12. Vinzons

**Barangay Data:** Load barangays dynamically per municipality from Firestore.

---

## Appendix B: Phone Number Validation

**Format:** `+63 XXX XXX XXXX`

**Regex:** `/^\+63\s?\d{3}\s?\d{3}\s?\d{4}$/`

**Examples:**
- Valid: `+63 912 345 6789`, `+639123456789`
- Invalid: `0912 345 6789`, `+63 912 34 567`

**Normalization:**
- Strip spaces and formatting
- Store as `+639123456789`
- Display as `+63 912 345 6789`

---

## Appendix C: Disaster Types (Admin Triage)

**Citizens DO NOT select disaster types. Admins classify during triage:**

- Natural: Typhoon, Flood, Earthquake, Landslide, Volcanic Eruption
- Fire: Residential Fire, Forest Fire
- Accident: Road Accident, Maritime Accident
- Health: Disease Outbreak, Food Poisoning
- Infrastructure: Power Outage, Water Shortage, Bridge Collapse
- Security: Civil Unrest, Terrorism
- Other: Unclassified

---

**Document End**

*All design decisions have been locked in through the brainstorming session. Ready for implementation planning.*
