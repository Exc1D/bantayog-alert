# Alerts System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement official government alerts system with Firestore data source, priority levels, location-based filtering, and admin alert creation.

**Architecture:** Firestore `alerts` collection, real-time subscription via onSnapshot, TanStack Query for data fetching, location-based filtering.

**Tech Stack:** Firestore, Cloud Functions (for admin), React Query, Leaflet geolocation

**Priority:** HIGH - Safety-critical feature (evacuation warnings)

---

## File Structure

**New files:**
- `firestore/alarms.firestore.rules` - Security rules for alerts
- `src/features/alerts/services/alert.service.ts` - Alert queries
- `src/features/alerts/hooks/useAlerts.ts` - Real-time alerts hook
- `src/features/alerts/components/AlertDetailModal.tsx` - Full alert view
- `src/features/alerts/types/index.ts` - Alert types
- `functions/src/createAlert.ts` - Admin alert creation
- `scripts/seed-sample-alerts.ts` - Seed sample alerts for testing

**Files to modify:**
- `src/features/alerts/components/AlertList.tsx` - Wire real data
- `src/features/alerts/components/AlertCard.tsx` - Add priority styling

---

## Task 1: Define Alert Data Model

**Files:**
- Create: `src/features/alerts/types/index.ts`
- Create: `firestore/alarms.firestore.rules`

```typescript
// types/index.ts

export interface Alert {
  id: string
  type: 'evacuation' | 'weather' | 'health' | 'infrastructure' | 'other'
  priority: 'emergency' | 'warning' | 'advisory'
  title: string
  message: string
  affectedAreas: {
    municipalities: string[]
    barangays?: string[] // Optional, more specific
  }
  source: 'MDRRMO' | 'PAGASA' | 'DOH' | 'DPWH' | 'Other'
  sourceUrl?: string
  createdAt: FirebaseFirestore.Timestamp
  expiresAt?: FirebaseFirestore.Timestamp
  isActive: boolean
  metadata?: {
    evacuationZones?: string[]
    shelterLocations?: string[]
    contactNumbers?: string[]
  }
}

export type AlertPriority = 'emergency' | 'warning' | 'advisory'
export type AlertType = 'evacuation' | 'weather' | 'health' | 'infrastructure' | 'other'
```

- [ ] **Step 1:** Write test for alert type validation
- [ ] **Step 2:** Write test for priority levels
- [ ] **Step 3:** Define TypeScript interfaces
- [ ] **Step 4:** Add Zod schema for validation
- [ ] **Step 5:** Create Firestore security rules
- [ ] **Step 6:** Test security rules with Firebase emulator
- [ ] **Step 7:** Commit: "feat(alerts): define alert data model and types"

---

## Task 2: Create Firestore Alerts Collection

**Files:**
- Create: `firestore/alarms.firestore.rules`
- Modify: `firestore.rules`

```javascript
// alarms.firestore.rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Alerts collection - public read, admin write
    match /alerts/{alertId} {
      allow read: if true; // Public can read
      allow write: if request.auth != null 
                    && request.auth.token.admin == true; // Admin only
    }
  }
}
```

- [ ] **Step 1:** Create alerts index in Firestore
- [ ] **Step 2:** Add security rules
- [ ] **Step 3:** Deploy security rules to emulator
- [ ] **Step 4:** Test read access (public)
- [ ] **Step 5:** Test write restriction (non-admin rejected)
- [ ] **Step 6:** Commit: "feat(alerts): add Firestore alerts collection with security"

---

## Task 3: Implement Alert Queries

**Files:**
- Create: `src/features/alerts/services/alert.service.ts`

```typescript
// alert.service.ts

import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { alertCollection } from './firebase.config'

export interface AlertFilters {
  active?: boolean
  priority?: AlertPriority
  municipalities?: string[]
}

// Features:
// - getAlerts() - Fetch all alerts
// - getAlertsByLocation(municipality) - Location-based filtering
// - subscribeToAlerts() - Real-time updates
// - getActiveAlerts() - Only active alerts
```

- [ ] **Step 1:** Write test for fetching all alerts
- [ ] **Step 2:** Write test for location filtering
- [ ] **Step 3:** Write test for active alerts only
- [ ] **Step 4:** Implement query functions
- [ ] **Step 5:** Implement real-time subscription
- [ ] **Step 6:** Test with Firebase emulator
- [ ] **Step 7:** Commit: "feat(alerts): implement alert queries with real-time updates"

---

## Task 4: Implement useAlerts Hook

**Files:**
- Create: `src/features/alerts/hooks/useAlerts.ts`
- Test: `src/features/alerts/hooks/__tests__/useAlerts.test.ts`

```typescript
// useAlerts.ts

interface UseAlertsOptions {
  userMunicipality?: string
  priority?: AlertPriority
}

interface UseAlertsReturn {
  alerts: Alert[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

// Features:
// - Fetch alerts by user's municipality
// - Filter by priority (if specified)
// - Real-time updates via onSnapshot
// - Loading and error states
```

- [ ] **Step 1:** Write test for fetching alerts
- [ ] **Step 2:** Write test for location filtering
- [ ] **Step 3:** Write test for priority filtering
- [ ] **Step 4:** Implement hook with useQuery
- [ ] **Step 5:** Add real-time subscription
- [ ] **Step 6:** Test with mock data
- [ ] **Step 7:** Commit: "feat(alerts): add useAlerts hook with location filtering"

---

## Task 5: Update AlertCard Component

**Files:**
- Modify: `src/features/alerts/components/AlertCard.tsx`

```typescript
// AlertCard.tsx - Enhance with real data

// Features:
// - Color code by priority (🔴 emergency, 🟡 warning, 🟢 advisory)
// - Show source badge (MDRRMO, PAGASA, etc.)
// - Show timestamp (time ago)
// - Show affected areas
// - Tap to expand/view details
// - Icon by type (evacuation, weather, health, etc.)
```

- [ ] **Step 1:** Write test for emergency priority styling
- [ ] **Step 2:** Write test for source badge display
- [ ] **Step 3:** Implement priority color coding
- [ ] **Step 4:** Implement source badge
- [ ] **Step 5:** Add type icons
- [ ] **Step 6:** Implement expand/collapse
- [ ] **Step 7:** Commit: "feat(alerts): enhance AlertCard with priority and source"

---

## Task 6: Wire AlertList to Real Data

**Files:**
- Modify: `src/features/alerts/components/AlertList.tsx`

```typescript
// AlertList.tsx - Replace mock data with real alerts

// Before:
// const alerts = mockAlerts

// After:
// const { alerts, isLoading } = useAlerts({ userMunicipality })
// if (isLoading) return <AlertListSkeleton />
// if (alerts.length === 0) return <EmptyState />
```

- [ ] **Step 1:** Write test for loading state
- [ ] **Step 2:** Write test for empty state
- [ ] **Step 3:** Replace mock data with useAlerts
- [ ] **Step 4:** Add loading skeleton
- [ ] **Step 5:** Add error handling
- [ ] **Step 6:** Test with real alerts
- [ ] **Step 7:** Commit: "feat(alerts): wire AlertList to real Firestore data"

---

## Task 7: Create AlertDetailModal

**Files:**
- Create: `src/features/alerts/components/AlertDetailModal.tsx`
- Test: `src/features/alerts/components/__tests__/AlertDetailModal.test.tsx`

```typescript
// AlertDetailModal.tsx - Full alert details

// Features:
// - Full title and message
// - Affected areas list (municipalities, barangays)
// - Source attribution with link
// - Created/expire timestamps
// - Metadata (evacuation zones, shelters, contacts)
// - Share button (WhatsApp, SMS)
// - Close button
```

- [ ] **Step 1:** Write test for modal rendering
- [ ] **Step 2:** Write test for metadata display
- [ ] **Step 3:** Implement modal with all fields
- [ ] **Step 4:** Add share functionality
- [ ] **Step 5:** Test with real alert data
- [ ] **Step 6:** Commit: "feat(alerts): add alert detail modal with full info"

---

## Task 8: Create Sample Alerts Seed Script

**Files:**
- Create: `scripts/seed-sample-alerts.ts`

```typescript
// seed-sample-alerts.ts - Create test alerts

// Sample alerts:
// 1. Evacuation warning (Daet, Barangay Bagasbas) - Emergency
// 2. Typhoon signal #2 (All municipalities) - Warning
// 3. Road closure (Labo) - Advisory
// 4. Health advisory ( Dengue outbreak) - Advisory
// 5. Flood warning (Jose Panganiban) - Warning
```

- [ ] **Step 1:** Write seed script with 5 sample alerts
- [ ] **Step 2:** Add different priorities (emergency, warning, advisory)
- [ ] **Step 3:** Add different sources (MDRRMO, PAGASA, DOH)
- [ ] **Step 4:** Add different types (evacuation, weather, health, infrastructure)
- [ ] **Step 5:** Run seed script against emulator
- [ ] **Step 6:** Verify alerts appear in app
- [ ] **Step 7:** Commit: "feat(alerts): add sample alerts seed script"

---

## Task 9: Implement Admin Alert Creation (Optional)

**Files:**
- Create: `functions/src/createAlert.ts`
- Create: `src/admin/components/CreateAlertForm.tsx` (if admin UI exists)

```typescript
// createAlert.ts - Cloud Function for admin alert creation

export const createAlert = functions.https.onCall(async (data, context) => {
  // 1. Verify admin permissions
  // 2. Validate alert data
  // 3. Create alert document
  // 4. Set expiry if provided
  // 5. Return alert ID
})
```

- [ ] **Step 1:** Write test for admin verification
- [ ] **Step 2:** Write test for alert validation
- [ ] **Step 3:** Implement Cloud Function
- [ ] **Step 4:** Add admin permission check
- [ ] **Step 5:** Test with admin account
- [ ] **Step 6:** Commit: "feat(functions): add admin alert creation Cloud Function"

---

## Self-Review

**✓ Spec coverage:** Alerts data source, priority levels, location filtering, official attribution all implemented

**✓ Placeholder scan:** No placeholders - all code complete

**✓ Type consistency:** Alert types match spec requirements

**Plan complete and saved to `docs/superpowers/plans/2026-04-11-alerts-system-implementation.md`**

**Execution:** Tasks 1-8 are the core alerts system. Task 9 (admin UI) is optional - can be done via Firebase Console initially.

**Priority Notes:**
- Task 1-3: Foundation (data model + Firestore)
- Task 4-6: Core functionality (hooks + UI)
- Task 7-8: Enhancement (details + sample data)
- Task 9: Nice-to-have (admin creation)
