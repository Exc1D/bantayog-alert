# Municipal Admin System - Design Specification

**Date:** 2026-04-15
**Status:** Layer 1 Approved, Layer 2 Pending
**Version:** 1.0
**Author:** Claude (Superpowers Brainstorming)

---

## Executive Summary

This document specifies the design for a complete municipal admin command center interface for Bantayog Alert, a disaster mapping and reporting system serving Camarines Norte, Philippines. The system enables municipal administrators to verify citizen reports, coordinate responder dispatch, and manage disaster response within their assigned municipality.

### Scope

**Full spec implementation** across 3 layers over 16+ weeks:
- **Layer 1:** Infrastructure Foundation (auth, map, data services, routing)
- **Layer 2:** All 10 Subsystems (verification, dispatch, dashboards, alerts, analytics, etc.)
- **Layer 3:** Polish & Optimization (performance, edge cases, testing)

### Operational Context

- **Users:** 1-2 municipal admins per municipality
- **Beta:** 2 municipalities initially
- **Hardware:** Modern desktops and tablets
- **Connectivity:** Reliable internet in municipal main areas
- **Browser:** Chrome (government standard)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Layer 1: Infrastructure Foundation](#layer-1-infrastructure-foundation)
3. [Layer 2: All Subsystems](#layer-2-all-subsystems)
4. [Layer 3: Polish & Optimization](#layer-3-polish--optimization)
5. [Technical Decisions](#technical-decisions)
6. [Implementation Timeline](#implementation-timeline)
7. [Quality Assurance](#quality-assurance)

---

## Architecture Overview

### Layer-Cake Approach

We use a **layer-cake architecture**: build foundational layers first, then add features on top. This ensures clean code with minimal technical debt.

```
┌─────────────────────────────────────────────────┐
│ Layer 3: Polish & Optimization (Weeks 13-16+)    │
│ - Performance tuning                              │
│ - Edge case handling                              │
│ - Comprehensive testing                           │
└─────────────────────────────────────────────────┘
                    ↑
┌─────────────────────────────────────────────────┐
│ Layer 2: All Subsystems (Weeks 5-12)             │
│ - Report verification                             │
│ - Responder dispatch                              │
│ - Real-time dashboards                            │
│ - Mass alerts                                     │
│ - Analytics                                       │
│ - Shift handoff                                   │
│ - And 4 more subsystems...                       │
└─────────────────────────────────────────────────┘
                    ↑
┌─────────────────────────────────────────────────┐
│ Layer 1: Infrastructure Foundation (Weeks 1-4)    │
│ - Authentication & authorization                   │
│ - Map foundation (Leaflet + boundaries)           │
│ - Data services (TanStack Query + Firestore)      │
│ - Routing & layout (map-centric desktop)          │
└─────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Server-State Only** - All data comes from Firestore via TanStack Query. Minimal client-side state.
2. **Security-First** - Firestore rules enforce municipality boundaries at database level.
3. **Map-Centric** - Map is always visible. Panels slide in/out but never block the map.
4. **Real-Time Ready** - Mix of Firestore onSnapshot (critical events) and polling (30s refresh for non-critical).
5. **Clean Boundaries** - Each subsystem is self-contained with clear interfaces.

---

## Layer 1: Infrastructure Foundation

### Overview

Layer 1 establishes the foundational infrastructure that all subsequent features build upon. No features are delivered yet, but the platform is ready for rapid feature development.

**Timeline:** 4 weeks
**Deliverable:** Working municipal admin interface with map, authentication, and real-time data

---

### Section 1: Authentication & Authorization

#### Current State

Existing infrastructure:
- `UserRole` type includes `'municipal_admin'`
- `MunicipalAdminCredentials` with `municipality` field
- `registerMunicipalAdmin()` and `loginMunicipalAdmin()` functions
- Provincial superadmin can create municipal admin accounts

#### New Components

**1. Cloud Function: setMunicipalClaims**

```typescript
// functions/src/setMunicipalClaims.ts
export const setMunicipalClaims = functions.https.onCall(async (data, context) => {
  // CRITICAL: Must be callable by provincial superadmin during account creation
  if (!context.auth) {
    throw new https.HttpsError('unauthenticated', 'Must be logged in')
  }

  const { uid } = context.auth
  const user = await admin.auth().getUser(uid)

  // Get municipality from user profile
  const userProfile = await admin.firestore().collection('users').doc(uid).get()
  if (!userProfile.exists) {
    throw new https.HttpsError('not-found', 'User profile not found')
  }
  const { municipality, role } = userProfile.data()

  if (role !== 'municipal_admin' || !municipality) {
    throw new https.HttpsError('permission-denied', 'User is not a municipal admin with assigned municipality')
  }

  // Set custom claims
  const claims = {
    role: 'municipal_admin',
    municipality: municipality,
    emailVerified: user.emailVerified,
  }

  await admin.auth().setCustomUserClaims(uid, claims)

  return { success: true, claims }
})

// HELPER: Call this after creating a municipal admin account
export async function setupMunicipalAdminClaims(uid: string, municipality: string): Promise<void> {
  const claims = {
    role: 'municipal_admin',
    municipality: municipality,
  }
  await admin.auth().setCustomUserClaims(uid, claims)
}
```

**2. Firestore Rules Enforcement**

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // HELPER FUNCTIONS

    // Check if user has municipal admin custom claims
    function isMunicipalAdmin() {
      return request.auth != null &&
             request.auth.token.role == 'municipal_admin' &&
             request.auth.token.municipality != null;
    }

    // Get user's municipality from custom claims
    function getUserMunicipality() {
      return request.auth.token.municipality;
    }

    // Check if document belongs to user's municipality
    // CRITICAL: Uses approximateLocation.municipality (not top-level municipality field)
    function isInMyMunicipality() {
      return isMunicipalAdmin() &&
             resource.data.approximateLocation.municipality == getUserMunicipality();
    }

    // SECURITY FIX: Prevent cross-municipality data leakage
    // All queries must include municipality filter in client code AND be verified here

    // Reports collection
    match /reports/{reportId} {
      // Municipal admins can only read reports from their municipality
      allow read: if isMunicipalAdmin() &&
                    resource.data.approximateLocation.municipality == getUserMunicipality();

      // Municipal admins can only write reports to their municipality
      allow create: if isMunicipalAdmin() &&
                      request.resource.data.approximateLocation.municipality == getUserMunicipality();

      // Updates can only change status/verification, not municipality
      allow update: if isMunicipalAdmin() &&
                       resource.data.approximateLocation.municipality == getUserMunicipality() &&
                       request.resource.data.approximateLocation.municipality == resource.data.approximateLocation.municipality;

      // Deletes not allowed for municipal admins (only provincial superadmin)
      allow delete: if false;
    }

    // Report operations collection (sensitive data)
    match /report_ops/{opsId} {
      allow read, write: if isMunicipalAdmin() &&
                           resource.data.municipality == getUserMunicipality();
    }

    // Responders collection
    match /responders/{responderId} {
      allow read: if isMunicipalAdmin() &&
                    resource.data.municipality == getUserMunicipality();
      allow write: if isMunicipalAdmin() &&
                     request.resource.data.municipality == getUserMunicipality();
    }

    // Incidents collection (may not exist yet - see Data Model section)
    match /incidents/{incidentId} {
      allow read, write: if isMunicipalAdmin() &&
                           resource.data.municipality == getUserMunicipality();
    }

    // Shift handoffs
    match /shift_handoffs/{handoffId} {
      allow read: if isMunicipalAdmin() &&
                    resource.data.municipality == getUserMunicipality();
      allow create: if isMunicipalAdmin() &&
                      request.resource.data.municipality == getUserMunicipality();
    }

    // Cross-municipality messages (read: from adjacent, write: to adjacent)
    match /cross_municipality_messages/{msgId} {
      allow read: if isMunicipalAdmin() &&
                    (resource.data.toMunicipality == getUserMunicipality() ||
                     resource.data.fromMunicipality == getUserMunicipality());
      allow create: if isMunicipalAdmin() &&
                      request.resource.data.fromMunicipality == getUserMunicipality();
    }

    // Analytics (aggregated, read-only for municipal admins)
    match /analytics/{document=**} {
      allow read: if isMunicipalAdmin() &&
                    request.path[4] == getUserMunicipality();
      allow write: if false; // Written by Cloud Functions only
    }
  }
}
```

**3. Client-Side Route Guard**

```typescript
// src/domains/municipal-admin/components/MunicipalAdminRoute.tsx
export function MunicipalAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, error } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'municipal_admin')) {
      navigate('/login')
    }
  }, [user, isLoading, navigate])

  if (isLoading) return <LoadingScreen />
  if (error) return <ErrorScreen error={error} />
  if (!user || user.role !== 'municipal_admin') return null

  return <>{children}</>
}
```

**4. Auth Hook**

```typescript
// src/domains/municipal-admin/hooks/useMunicipalAdminAuth.ts
export function useMunicipalAdminAuth() {
  const { user, isLoading, error } = useAuth()
  const municipality = user?.municipality

  return {
    municipality,
    user,
    isLoading,
    error,
    isAuthorized: user?.role === 'municipal_admin' && !!municipality,
  }
}
```

#### Security Guarantees

- Municipal admins can ONLY access data where `document.municipality === token.municipality`
- Client-side filtering is UX optimization, not security
- Firestore rules are enforced server-side (cannot be bypassed)
- Audit trail shows which municipality accessed what data

---

### Section 2: Map Foundation

#### Current State

Existing MapView component:
- Leaflet-based with OpenStreetMap tiles
- Disaster report markers (color-coded by severity)
- User location marker with accuracy circle
- Map controls (zoom, locate, layer toggle)
- Filter system (severity, time range)

#### New Components

**1. Municipal Boundaries Layer**

```typescript
// src/domains/municipal-admin/components/MunicipalBoundariesLayer.tsx
interface Props {
  map: L.Map
  municipality: string // Admin's assigned municipality
}

export function MunicipalBoundariesLayer({ map, municipality }: Props) {
  const { data: boundaries } = useMunicipalBoundaries()

  useEffect(() => {
    if (!boundaries || !map) return

    // Clear existing layers
    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON) {
        map.removeLayer(layer)
      }
    })

    // Add boundary layers
    boundaries.forEach((boundary) => {
      const isMyMunicipality = boundary.name === municipality
      const geoJsonLayer = L.geoJSON(boundary.geojson, {
        style: {
          color: isMyMunicipality ? '#10b981' : '#9ca3af', // Green for mine, gray for others
          weight: isMyMunicipality ? 3 : 2,
          fillOpacity: 0.1,
        },
      })

      geoJsonLayer.addTo(map)
      
      // Add label on hover
      geoJsonLayer.bindTooltip(boundary.name)
    })
  }, [boundaries, map, municipality])

  return null // Layer is added directly to map
}
```

**2. Admin Map Controls**

```typescript
// src/domains/municipal-admin/components/AdminMapControls.tsx
export function AdminMapControls({ map }: { map: L.Map }) {
  const [layers, setLayers] = useState({
    incidents: true,
    responders: true,
    boundaries: true,
    heatMap: false,
  })

  const handleZoomIn = () => map.zoomIn()
  const handleZoomOut = () => map.zoomOut()
  const handleReset = () => map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)

  return (
    <div className="map-controls">
      <button onClick={handleZoomIn} aria-label="Zoom in">+</button>
      <button onClick={handleZoomOut} aria-label="Zoom out">−</button>
      <button onClick={handleReset} aria-label="Reset view">📍</button>
      
      <LayerToggles layers={layers} setLayers={setLayers} />
    </div>
  )
}
```

**3. Layer Management System**

```typescript
// src/domains/municipal-admin/hooks/useMapLayers.ts
interface MapLayer {
  id: string
  name: string
  type: 'base' | 'overlay'
  visible: boolean
  opacity: number
  zIndex: number
  component: React.Component
}

export function useMapLayers() {
  const [layers, setLayers] = useState<MapLayer[]>([
    {
      id: 'openstreetmap',
      name: 'OpenStreetMap',
      type: 'base',
      visible: true,
      opacity: 1,
      zIndex: 0,
      component: OpenStreetMapLayer,
    },
    {
      id: 'municipal-boundaries',
      name: 'Municipal Boundaries',
      type: 'overlay',
      visible: true,
      opacity: 1,
      zIndex: 100,
      component: MunicipalBoundariesLayer,
    },
    // Add more layers dynamically
  ])

  const toggleLayer = (id: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === id ? { ...layer, visible: !layer.visible } : layer
    ))
  }

  return { layers, toggleLayer }
}
```

**4. Performance Optimization**

```typescript
// Marker clustering for 50+ pins
import MarkerClusterGroup from 'leaflet-markercluster'

export function useOptimizedMarkers(reports: Report[]) {
  const mcg = useMemo(() => 
    reports.length > 50 
      ? new MarkerClusterGroup({
          spiderfyOnMaxZoom: 13,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true
        })
      : null,
    [reports.length]
  )

  return { mcg }
}
```

#### Data Requirements

- Municipal boundaries GeoJSON stored in `municipalities/{municipalityId}/boundary` collection
- Boundary resolution: balance detail vs performance (simplify if needed)
- Cache boundaries locally for instant load

---

### Section 3: Data Services Layer

#### Architecture

**Server-State Only:** All data managed by TanStack Query. Minimal client-side state.

**Real-Time Strategy:**
- **Critical events** (new incidents, status changes): Firestore `onSnapshot` → instant UI update
- **Non-critical data** (responder locations): Polling every 30 seconds via TanStack Query

#### New Components

**1. Municipal Admin Firestore Services**

**CRITICAL SECURITY FIX:** The existing `getMunicipalityReports` function IGNORES the municipality parameter, causing cross-municipality data leakage. This MUST be fixed first.

```typescript
// src/domains/municipal-admin/services/firestore.service.ts

// SECURITY FIX: Municipality filter is now enforced (was _municipality/unused before)
export async function getMunicipalityReports(municipality: string): Promise<Report[]> {
  // CRITICAL: Use approximateLocation.municipality (not top-level municipality field)
  const q = query(
    collection(db, 'reports'),
    where('approximateLocation.municipality', '==', municipality),
    orderBy('createdAt', 'desc'),
    limit(100) // Prevent unbounded queries
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function getPendingReports(municipality: string): Promise<Report[]> {
  // CRITICAL: Municipality filtering is enforced
  const q = query(
    collection(db, 'reports'),
    where('approximateLocation.municipality', '==', municipality),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
    limit(50)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  municipality: string
): Promise<void> {
  const reportRef = doc(db, 'reports', reportId)

  // CRITICAL: Verify municipality before update (defense-in-depth)
  const reportSnap = await getDoc(reportRef)
  if (!reportSnap.exists()) {
    throw new Error('Report not found')
  }
  const reportData = reportSnap.data()

  // Verify report belongs to admin's municipality
  if (reportData.approximateLocation.municipality !== municipality) {
    throw new Error('Report does not belong to your municipality')
  }

  await updateDoc(reportRef, {
    status,
    verifiedAt: Date.now(),
    verifiedBy: getCurrentUser().uid,
  })
}

// New: Get reports by status for dashboard counts
export async function getReportsByStatus(
  municipality: string,
  status: ReportStatus
): Promise<Report[]> {
  const q = query(
    collection(db, 'reports'),
    where('approximateLocation.municipality', '==', municipality),
    where('status', '==', status),
    orderBy('createdAt', 'desc'),
    limit(100)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}
```

**2. TanStack Query Hooks**

```typescript
// src/domains/municipal-admin/hooks/useMunicipalReports.ts
export function useMunicipalReports(municipality: string) {
  return useQuery({
    queryKey: ['reports', municipality],
    queryFn: () => getMunicipalityReports(municipality),
    refetchInterval: 30000, // 30-second auto-refresh
    staleTime: 15000, // Consider data fresh for 15s
  })
}

// src/domains/municipal-admin/hooks/usePendingReports.ts
export function usePendingReports(municipality: string) {
  return useQuery({
    queryKey: ['reports', municipality, 'pending'],
    queryFn: () => getPendingReports(municipality),
    refetchInterval: 10000, // 10-second refresh (urgent queue)
    staleTime: 5000,
  })
}
```

**3. Real-Time Subscriptions**

```typescript
// src/domains/municipal-admin/hooks/useRealtimeSubscriptions.ts
export function useRealtimeSubscriptions(municipality: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const reportsRef = collection(db, 'reports')
    const q = query(reportsRef, where('municipality', '==', municipality))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries(['reports', municipality])
    })

    return () => unsubscribe()
  }, [municipality, queryClient])
}
```

**4. Error Handling**

```typescript
// Automatic retry with exponential backoff (TanStack Query built-in)
// Graceful degradation on network failure
export function useMunicipalReports(municipality: string) {
  return useQuery({
    queryKey: ['reports', municipality],
    queryFn: () => getMunicipalityReports(municipality),
    retry: 3, // Retry 3 times on failure
    onError: (error) => {
      console.error('[MUNICIPAL_ADMIN] Failed to fetch reports:', error)
      // Show warning banner in UI
    },
  })
}
```

---

### Section 4: Routing & Layout

#### Design Principle

**NON-NEGOTIABLE:** The map is ALWAYS visible. No modals, no page navigation, nothing that covers the map completely.

#### Component Structure

```
MunicipalAdminDashboard (main route)
├── AdminTopBar (always visible)
│   ├── Municipality name
│   ├── Alert count
│   └── Profile dropdown
├── QuickActionsBar (always visible)
│   ├── Pending count
│   ├── Available responders
│   ├── Urgent items
│   └── Mass Alert button
├── MunicipalMapView (extends MapView, always visible)
│   ├── MunicipalBoundariesLayer
│   ├── AdminMapControls
│   └── LayerControls
└── Dynamic Panels (slide in/out)
    ├── IncidentDetailsPanel (right)
    ├── ResponderStatusPanel (right)
    ├── PendingQueuePanel (left)
    └── MassAlertPanel (overlay)
```

#### Layout Components

**1. Admin Top Bar**

```typescript
// src/domains/municipal-admin/components/AdminTopBar.tsx
export function AdminTopBar() {
  const { municipality } = useMunicipalAdminAuth()
  const { data: alertCount } = useAlertCount()

  return (
    <div className="admin-top-bar">
      <div className="municipality-name">
        Bantayog Alert - MUNICIPAL ADMIN ({municipality?.toUpperCase()})
      </div>
      <div className="top-bar-actions">
        <button onClick={openAlerts} aria-label="View alerts">
          🔔 Alerts: {alertCount}
        </button>
        <button onClick={openProfile} aria-label="Profile settings">
          👤 Profile
        </button>
      </div>
    </div>
  )
}
```

**2. Quick Actions Bar**

```typescript
// src/domains/municipal-admin/components/QuickActionsBar.tsx
export function QuickActionsBar() {
  const { data: pendingCount } = usePendingReports()
  const { data: availableCount } = useAvailableResponders()
  const { data: urgentCount } = useUrgentItems()

  return (
    <div className="quick-actions-bar">
      <button onClick={openPendingQueue}>
        📋 Pending: <strong>{pendingCount}</strong>
      </button>
      <button onClick={openResponderDashboard}>
        🚒 Available: <strong>{availableCount}</strong>
      </button>
      <button onClick={openUrgentItems}>
        ⚠️ Urgent: <strong>{urgentCount}</strong>
      </button>
      <button onClick={openMassAlertTools}>
        🆘 Mass Alert
      </button>
    </div>
  )
}
```

**3. Sliding Panel System**

```typescript
// src/shared/components/SlidingPanel.tsx
interface Props {
  isOpen: boolean
  position: 'left' | 'right' | 'top' | 'bottom'
  onClose: () => void
  children: React.ReactNode
}

export function SlidingPanel({ isOpen, position, onClose, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  const positionClass = `panel-${position}`

  return (
    <div
      ref={panelRef}
      className={`sliding-panel ${positionClass} ${isOpen ? 'open' : 'closed'}`}
    >
      {children}
      <button onClick={onClose} aria-label="Close panel">
        ✕
      </button>
    </div>
  )
}
```

#### Keyboard Shortcuts

```typescript
// src/domains/municipal-admin/hooks/useKeyboardShortcuts.ts
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Map navigation
      if (event.key === 'Escape') {
        closeAllPanels()
      }
      if (event.key === 'o' || event.key === 'O') {
        toggleOverlaysPanel()
      }

      // Quick actions
      if (event.key === 'v' || event.key === 'V') {
        openPendingQueue()
      }
      if (event.key === 'd' || event.key === 'D') {
        openActiveIncidents()
      }
      if (event.key === 'r' || event.key === 'R') {
        openResponderDashboard()
      }
      if (event.key === 'a' || event.key === 'A') {
        openMassAlertTools()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
```

---

### Layer 1 Quality Gates

#### Must Have (Definition of Done)

- [ ] Municipal admin can log in with email/password
- [ ] Custom claims with municipality are set on login
- [ ] Firestore rules enforce municipality filtering
- [ ] Map displays municipal boundaries (admin's highlighted)
- [ ] TanStack Query hooks return municipality-filtered data
- [ ] Real-time subscriptions work (onSnapshot → UI update)
- [ ] Sliding panels work smoothly (no blocking of map)
- [ ] Unit tests pass (>80% coverage)
- [ ] TypeScript compiles without errors
- [ ] E2E test for login → map flow passes

#### Nice to Have (Stretch Goals)

- [ ] Keyboard shortcuts working
- [ ] Multi-screen support (dual monitor)
- [ ] E2E tests for all critical paths
- [ ] Performance benchmarks (50+ markers render smoothly)
- [ ] Accessibility audit (WCAG 2.1 AA compliance)

---

## Layer 2: All Subsystems

### Overview

Layer 2 builds all 10 subsystems on the solid foundation from Layer 1. Each subsystem is self-contained with clear interfaces.

**Timeline:** 8 weeks (Weeks 5-12)
**Deliverable:** Complete municipal admin command center ready for beta testing

---

### Subsystem 1: Report Verification Workflow

#### Purpose

Enable municipal admins to triage, verify, and classify citizen-submitted disaster reports.

#### Components

**1. Pending Reports Queue**

```typescript
// src/domains/municipal-admin/components/PendingReportsQueue.tsx
export function PendingReportsQueue() {
  const { municipality } = useMunicipalAdminAuth()
  const { data: pendingReports, isLoading } = usePendingReports(municipality)
  const [triageMode, setTriageMode] = useState(false)

  if (isLoading) return <LoadingSpinner />

  return (
    <SlidingPanel isOpen={true} position="left" onClose={closeQueue}>
      <div className="pending-queue">
        <div className="queue-header">
          <h2>Pending Reports ({pendingReports.length})</h2>
          <button onClick={() => setTriageMode(!triageMode)}>
            {triageMode ? 'Exit Triage Mode' : 'Triage Mode'}
          </button>
        </div>

        {triageMode ? (
          <TriageMode reports={pendingReports} />
        ) : (
          <ReportList reports={pendingReports} />
        )}
      </div>
    </SlidingPanel>
  )
}
```

**2. Triage Mode (Surge Handling)**

```typescript
// src/domains/municipal-admin/components/TriageMode.tsx
export function TriageMode({ reports }: { reports: Report[] }) {
  const [filter, setFilter] = useState<'high' | 'high-medium' | 'all'>('high')

  const filteredReports = useMemo(() => {
    if (filter === 'high') return reports.filter(r => r.severity === 'high')
    if (filter === 'high-medium') return reports.filter(r => r.severity === 'high' || r.severity === 'medium')
    return reports
  }, [reports, filter])

  return (
    <div className="triage-mode">
      <div className="triage-filters">
        <button onClick={() => setFilter('high')} className={filter === 'high' ? 'active' : ''}>
          🔴 High Only
        </button>
        <button onClick={() => setFilter('high-medium')} className={filter === 'high-medium' ? 'active' : ''}>
          🔴🟡 High + Medium
        </button>
        <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>
          All
        </button>
      </div>

      <div className="quick-scan-list">
        {filteredReports.map(report => (
          <QuickScanReport
            key={report.id}
            report={report}
            onVerify={verifyReport}
            onReject={rejectReport}
            onSkip={skipReport}
          />
        ))}
      </div>

      <div className="triage-actions">
        <button onClick={autoVerifyTrustedCitizens}>
          Auto-Verify Trusted Citizens
        </button>
        <button onClick={bulkRejectSpammers}>
          Bulk Reject Spammers
        </button>
      </div>
    </div>
  )
}
```

**3. Report Verification Rules**

```typescript
// src/domains/municipal-admin/services/verification.service.ts
export function verifyReport(reportId: string, verificationData: VerificationData) {
  const reportRef = doc(db, 'reports', reportId)
  const report = await getDoc(reportRef)

  if (!report.exists()) {
    throw new Error('Report not found')
  }

  const reportData = report.data()

  // Check: Location + Photo = Verified
  const hasLocation = !!reportData.location
  const hasPhoto = reportData.photos && reportData.photos.length > 0

  if (hasLocation && hasPhoto) {
    // Can verify immediately
    await updateDoc(reportRef, {
      status: 'verified',
      verifiedAt: Date.now(),
      incidentType: verificationData.incidentType,
      severity: verificationData.severity,
      verifiedBy: getCurrentUser().uid,
    })
  } else {
    // Need more info
    throw new Error('Cannot verify: missing location or photo')
  }
}

export async function autoVerifyIfTrustedCitizen(reportId: string) {
  const reportRef = doc(db, 'reports', reportId)
  const report = await getDoc(reportRef)
  const reportData = report.data()

  // Get citizen's trust score
  const citizenRef = doc(db, 'users', reportData.reporterId)
  const citizen = await getDoc(citizenRef)
  const trustScore = citizen.data()?.trustScore || 0

  if (trustScore >= 80 && reportData.location && reportData.photos?.length > 0) {
    await updateDoc(reportRef, {
      status: 'verified',
      verifiedAt: Date.now(),
      autoVerified: true,
      verifiedBy: 'system',
    })

    return { autoVerified: true }
  }

  return { autoVerified: false }
}
```

#### Auto-Verification Rules

```
IF citizen.trustScore >= 80
   AND report.location exists
   AND report.photos.length > 0
THEN → Auto-verify (mark as verified immediately)

ELSE IF report.location exists AND report.photos.length > 0
THEN → Show "Verify & Classify" button

ELSE IF report.location exists OR report.photos.length > 0
THEN → Show "Request More Info" button

ELSE
THEN → Show "Reject" option (insufficient data)
```

---

### Subsystem 2: Responder Dispatch

#### Purpose

Assign available responders to verified incidents, track acknowledgments, and manage reassignment.

#### Components

**1. Dispatch Interface**

```typescript
// src/domains/municipal-admin/components/DispatchInterface.tsx
export function DispatchInterface({ incident }: { incident: Incident }) {
  const { municipality } = useMunicipalAdminAuth()
  const { data: availableResponders } = useAvailableResponders(municipality)
  const [selectedResponders, setSelectedResponders] = useState<string[]>([])

  const recommendedResponders = getRecommendedResponders(incident.incidentType)

  const handleDispatch = async () => {
    for (const responderId of selectedResponders) {
      await dispatchToIncident(responderId, incident.id)
    }

    setSelectedResponders([])
    closePanel()
  }

  return (
    <div className="dispatch-interface">
      <h3>Dispatch Incident #{incident.id}</h3>

      <IncidentDetails incident={incident} />

      <h4>Recommended Responders</h4>
      <RecommendedResponderList
        responders={recommendedResponders}
        onSelect={toggleResponder}
        selected={selectedResponders}
      />

      <h4>All Available Responders</h4>
      <ResponderList
        responders={availableResponders}
        onSelect={toggleResponder}
        selected={selectedResponders}
      />

      <button onClick={handleDispatch} disabled={selectedResponders.length === 0}>
        Dispatch {selectedResponders.length} Responders
      </button>
    </div>
  )
}
```

**2. Incident Type Templates**

```typescript
// src/domains/municipal-admin/config/dispatchTemplates.ts
const INCIDENT_TYPE_TEMPLATES: Record<IncidentType, ResponderType[]> = {
  flood: ['search_rescue', 'medical', 'engineering', 'social_welfare'],
  fire: ['fire', 'medical', 'engineering'],
  landslide: ['search_rescue', 'engineering', 'medical'],
  road_accident: ['police', 'medical', 'engineering'],
  fallen_tree: ['engineering'],
  medical: ['medical'],
  // ... other types
}

export function getRecommendedResponders(incidentType: IncidentType): ResponderType[] {
  return INCIDENT_TYPE_TEMPLATES[incidentType] || []
}
```

**3. Dispatch Acknowledgment Tracking**

```typescript
// src/domains/municipal-admin/hooks/useDispatchTracking.ts
export function useDispatchTracking(incidentId: string) {
  const { data: dispatches } = useQuery({
    queryKey: ['dispatches', incidentId],
    queryFn: () => getDispatchesForIncident(incidentId),
  })

  // Real-time subscription for status updates
  useEffect(() => {
    const incidentRef = doc(db, 'incidents', incidentId)
    const unsubscribe = onSnapshot(incidentRef, (snapshot) => {
      const incident = snapshot.data()
      // Invalidate dispatches query when incident status changes
      queryClient.invalidateQueries(['dispatches', incidentId])
    })

    return () => unsubscribe()
  }, [incidentId])

  const pendingAcknowledgments = dispatches?.filter(d => d.status === 'pending') || []
  const acknowledgedDispatches = dispatches?.filter(d => d.status === 'acknowledged') || []

  return {
    pendingAcknowledgments,
    acknowledgedDispatches,
    reassign: (dispatchId, newResponderId) => reassignDispatch(dispatchId, newResponderId),
  }
}
```

---

### Subsystem 3: Real-Time Responder Status Dashboard

#### Purpose

Track responder locations, status, and availability in real-time. Identify stale responders and missing acknowledgments.

#### Components

**1. Responder Status Dashboard**

```typescript
// src/domains/municipal-admin/components/ResponderStatusDashboard.tsx
export function ResponderStatusDashboard() {
  const { municipality } = useMunicipalAdminAuth()
  const { data: responders } = useResponders(municipality)

  const availableResponders = responders?.filter(r => r.status === 'available')
  const busyResponders = responders?.filter(r => r.status === 'busy')
  const staleResponders = responders?.filter(r => isStale(r))

  return (
    <SlidingPanel isOpen={true} position="left" onClose={closeDashboard}>
      <div className="responder-dashboard">
        <h2>Responder Status Dashboard</h2>

        <div className="dashboard-stats">
          <div className="stat">
            <strong>Available:</strong> {availableResponders.length}
          </div>
          <div className="stat">
            <strong>On Scene:</strong> {busyResponders.filter(r => r.status === 'on_scene').length}
          </div>
          <div className="stat">
            <strong>En Route:</strong> {busyResponders.filter(r => r.status === 'en_route').length}
          </div>
          <div className="stat warning">
            <strong>Stale:</strong> {staleResponders.length}
          </div>
        </div>

        <ResponderList responders={responders} showStatus={true} />
      </div>
    </SlidingPanel>
  )
}
```

**2. Stale Responder Detection**

```typescript
// src/domains/municipal-admin/utils/responderUtils.ts
const STALE_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes
const VERY_STALE_THRESHOLD_MS = 60 * 60 * 1000 // 60 minutes

export function isStale(responder: Responder): boolean {
  if (!responder.lastUpdateAt) return true
  const age = Date.now() - responder.lastUpdateAt
  return age > STALE_THRESHOLD_MS
}

export function isVeryStale(responder: Responder): boolean {
  if (!responder.lastUpdateAt) return true
  const age = Date.now() - responder.lastUpdateAt
  return age > VERY_STALE_THRESHOLD_MS
}

export function getStaleness(responder: Responder): 'fresh' | 'stale' | 'very_stale' {
  if (isVeryStale(responder)) return 'very_stale'
  if (isStale(responder)) return 'stale'
  return 'fresh'
}
```

---

### Subsystem 4: Mass Alert Tools

#### Purpose

Broadcast evacuation warnings and mobilization alerts to citizens and responders.

#### Components

**1. Mass Alert to Citizens**

```typescript
// src/domains/municipal-admin/components/MassAlertCitizens.tsx
export function MassAlertCitizens() {
  const { municipality } = useMunicipalAdminAuth()
  const [alertType, setAlertType] = useState<'evacuation' | 'warning' | 'advisory'>('evacuation')
  const [barangays, setBarangays] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')

  const handleSend = async () => {
    const alert: CitizenAlert = {
      type: alertType,
      municipality,
      barangays,
      title,
      message,
      sentBy: getCurrentUser().uid,
      sentAt: Date.now(),
    }

    await sendCitizenAlert(alert)
    resetForm()
    closePanel()
  }

  return (
    <div className="mass-alert-citizens">
      <h2>Send Mass Alert to Citizens</h2>

      <AlertTypeSelector value={alertType} onChange={setAlertType} />

      <BarangaySelector
        municipality={municipality}
        selected={barangays}
        onChange={setBarangays}
      />

      <TitleInput value={title} onChange={setTitle} />
      <MessageInput value={message} onChange={setMessage} />

      <button onClick={handleSend} disabled={!title || !message || barangays.length === 0}>
        Send Alert to ~{estimateRecipients(municipality, barangays)} citizens
      </button>
    </div>
  )
}

// Utility function to estimate recipients
async function estimateRecipients(municipality: string, barangays: string[]): number {
  // Query users collection to count citizens in target area
  const q = query(
    collection(db, 'users'),
    where('role', '==', 'citizen'),
    where('municipality', '==', municipality),
    where('barangay', 'in', barangays)
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.length
}
    </div>
  )
}
```

**2. Mass Mobilization to Responders**

```typescript
// src/domains/municipal-admin/components/MassAlertResponders.tsx
export function MassAlertResponders() {
  const { municipality } = useMunicipalAdminAuth()
  const [message, setMessage] = useState('')

  const handleSend = async () => {
    const alert: ResponderAlert = {
      type: 'mobilization',
      municipality,
      message,
      sentBy: getCurrentUser().uid,
      sentAt: Date.now(),
    }

    await sendResponderAlert(alert)
    resetForm()
    closePanel()
  }

  return (
    <div className="mass-alert-responders">
      <h2>Emergency Mobilization</h2>

      <TextArea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Enter mobilization message..."
        rows={6}
      />

      <button onClick={handleSend} disabled={!message.trim()}>
        Send to All Responders (~{estimateResponderCount(municipality)} responders)
      </button>
    </div>
  )
}

// Utility function to estimate responder count
async function estimateResponderCount(municipality: string): number {
  const q = query(
    collection(db, 'responders'),
    where('municipality', '==', municipality)
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.length
}
```

---

### Subsystem 5: Analytics Dashboard

#### Purpose

Display response times, incident trends, and anonymized comparisons across municipalities.

#### Components

**1. Analytics Dashboard**

```typescript
// src/domains/municipal-admin/components/AnalyticsDashboard.tsx
export function AnalyticsDashboard() {
  const { municipality } = useMunicipalAdminAuth()
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d')

  const { data: stats } = useMunicipalityAnalytics(municipality, timeRange)

  return (
    <SlidingPanel isOpen={true} position="right" onClose={closeDashboard}>
      <div className="analytics-dashboard">
        <h2>Analytics - {municipality}</h2>

        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

        <IncidentStatistics stats={stats?.incidents} />
        <ResponseTimeChart data={stats?.responseTimes} />
        <ResponderUtilization data={stats?.responders} />
      </div>
    </SlidingPanel>
  )
}
```

**2. Analytics Data Types**

```typescript
// src/domains/municipal-admin/types/analytics.types.ts

interface AnalyticsData {
  incidents: IncidentStats
  responseTimes: ResponseTimeStats
  responderUtilization: ResponderUtilizationData
}

interface IncidentStats {
  total: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
}

interface ResponseTimeStats {
  avg: number // milliseconds
  min: number
  max: number
  p95: number
}

interface ResponderUtilizationData {
  total: number
  available: number
  busy: number
  utilizationRate: number // 0-1
}
```

**3. Analytics Data Service**

```typescript
// src/domains/municipal-admin/services/analytics.service.ts
export async function getMunicipalityAnalytics(
  municipality: string,
  timeRange: string
): Promise<AnalyticsData> {
  // Client-side aggregation for Layer 1-2
  // Cloud Functions for pre-aggregation in Layer 3

  const now = Date.now()
  let startTime: number

  switch (timeRange) {
    case '24h':
      startTime = now - 24 * 60 * 60 * 1000
      break
    case '7d':
      startTime = now - 7 * 24 * 60 * 60 * 1000
      break
    case '30d':
      startTime = now - 30 * 24 * 60 * 60 * 1000
      break
    default:
      startTime = now - 7 * 24 * 60 * 60 * 1000
  }

  // Fetch reports within time range
  const reportsQuery = query(
    collection(db, 'reports'),
    where('municipality', '==', municipality),
    where('timestamp', '>=', startTime),
    where('timestamp', '<=', now)
  )

  const incidentsQuery = query(
    collection(db, 'incidents'),
    where('municipality', '==', municipality),
    where('createdAt', '>=', startTime),
    where('createdAt', '<=', now)
  )

  const [reportsSnapshot, incidentsSnapshot] = await Promise.all([
    getDocs(reportsQuery),
    getDocs(incidentsQuery),
  ])

  const reports = reportsSnapshot.docs.map(doc => doc.data())
  const incidents = incidentsSnapshot.docs.map(doc => doc.data())

  // Calculate metrics
  const incidentStats: IncidentStats = {
    total: incidents.length,
    byType: incidents.reduce((acc, i) => {
      acc[i.incidentType] = (acc[i.incidentType] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    bySeverity: incidents.reduce((acc, i) => {
      acc[i.severity] = (acc[i.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  }

  // Response time calculations
  const responseTimes = incidents
    .filter(i => i.verifiedAt && i.resolvedAt)
    .map(i => i.resolvedAt! - i.verifiedAt)

  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0

  return {
    incidents: incidentStats,
    responseTimes: {
      avg: avgResponseTime,
      min: Math.min(...responseTimes, 0),
      max: Math.max(...responseTimes, 0),
      p95: calculatePercentile(responseTimes, 95),
    },
    responderUtilization: await calculateResponderUtilization(municipality, startTime, now),
  }
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  const sorted = values.sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[index]
}

async function calculateResponderUtilization(
  municipality: string,
  startTime: number,
  endTime: number
): Promise<ResponderUtilizationData> {
  const respondersQuery = query(
    collection(db, 'responders'),
    where('municipality', '==', municipality)
  )

  const snapshot = await getDocs(respondersQuery)
  const responders = snapshot.docs.map(doc => doc.data())

  const total = responders.length
  const available = responders.filter(r => r.status === 'available').length
  const busy = responders.filter(r => r.status === 'busy' || r.status === 'on_scene').length

  return {
    total,
    available,
    busy,
    utilizationRate: total > 0 ? busy / total : 0,
  }
}
```

---

### Subsystem 6: Shift Handoff

#### Purpose

Transfer context between municipal admins during shift changes. Ensure continuity of awareness.

#### Components

**1. Shift Handoff Interface**

```typescript
// src/domains/municipal-admin/components/ShiftHandoff.tsx
export function ShiftHandoff({ mode }: { mode: 'start' | 'end' }) {
  const { municipality } = useMunicipalAdminAuth()

  if (mode === 'end') {
    return <ShiftEndHandoff municipality={municipality} />
  }

  return <ShiftStartHandoff municipality={municipality} />
}

function ShiftEndHandoff({ municipality }: { municipality: string }) {
  const { data: activeIncidents } = useActiveIncidents(municipality)
  const { data: urgentItems } = useUrgentItems(municipality)
  const [notes, setNotes] = useState('')

  const handleHandoff = async () => {
    const handoff: ShiftHandoff = {
      from: getCurrentUser().uid,
      to: null, // Will be filled by incoming admin
      municipality,
      timestamp: Date.now(),
      activeIncidents: activeIncidents.map(i => i.id),
      urgentItems: urgentItems,
      notes,
    }

    await createShiftHandoff(handoff)
    closePanel()
  }

  return (
    <div className="shift-handoff">
      <h2>Shift Handoff - End of Shift</h2>

      <ActiveIncidentsList incidents={activeIncidents} />
      <UrgentItemsList items={urgentItems} />

      <TextArea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes for next admin..."
        rows={4}
      />

      <button onClick={handleHandoff}>
        Initiate Handoff
      </button>
    </div>
  )
}
```

---

### Subsystem 7: Duplicate Detection & Merging

#### Purpose

Identify duplicate reports of the same incident and merge them to avoid resource waste.

#### Components

**1. Duplicate Detection Service**

```typescript
// src/domains/municipal-admin/services/duplicateDetection.service.ts
export async function findPotentialDuplicates(report: Report): Promise<Report[]> {
  // Find reports with similar location, time, and type
  const timeWindow = 60 * 60 * 1000 // 1 hour
  const locationThreshold = 100 // meters

  const q = query(
    collection(db, 'reports'),
    where('municipality', '==', report.municipality),
    where('timestamp', '>=', report.timestamp - timeWindow),
    where('timestamp', '<=', report.timestamp + timeWindow),
  )

  const snapshot = await getDocs(q)
  const allReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

  // Filter by location similarity
  const potentialDuplicates = allReports.filter(r => {
    if (r.id === report.id) return false
    const distance = calculateDistance(report.location, r.location)
    return distance < locationThreshold
  })

  return potentialDuplicates
}

// Utility function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(
  loc1: { latitude: number; longitude: number },
  loc2: { latitude: number; longitude: number }
): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (loc1.latitude * Math.PI) / 180
  const φ2 = (loc2.latitude * Math.PI) / 180
  const Δφ = ((loc2.latitude - loc1.latitude) * Math.PI) / 180
  const Δλ = ((loc2.longitude - loc1.longitude) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

export async function mergeReports(
  primaryReportId: string,
  duplicateReportIds: string[]
): Promise<void> {
  const batch = writeBatch(db)

  // Mark duplicates as merged
  duplicateReportIds.forEach(duplicateId => {
    const duplicateRef = doc(db, 'reports', duplicateId)
    batch.update(duplicateRef, {
      mergedInto: primaryReportId,
      mergedAt: Date.now(),
    })
  })

  // Update primary report with merged info
  const primaryRef = doc(db, 'reports', primaryReportId)
  batch.update(primaryRef, {
    mergedReports: arrayUnion(duplicateReportIds),
  })

  await batch.commit()
}
```

---

### Subsystem 8: Citizen Messaging

#### Purpose

Two-way communication with citizens for clarification and updates.

#### Components

**1. Citizen Messaging Panel**

```typescript
// src/domains/municipal-admin/components/CitizenMessagingPanel.tsx
export function CitizenMessagingPanel({ report }: { report: Report }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')

  const { data: citizen } = useCitizenProfile(report.reporterId)

  const handleSend = async () => {
    const message: AdminMessage = {
      from: getCurrentUser().uid,
      to: report.reporterId,
      reportId: report.id,
      text: newMessage,
      sentAt: Date.now(),
    }

    await sendAdminMessage(message)
    setMessages([...messages, message])
    setNewMessage('')
  }

  return (
    <div className="citizen-messaging">
      <h2>Messaging - Report #{report.id}</h2>

      <CitizenInfo citizen={citizen} />

      <MessageHistory messages={messages} />

      <QuickTemplates onSelect={setNewMessage} />

      <TextArea
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        placeholder="Type your message..."
        rows={3}
      />

      <button onClick={handleSend} disabled={!newMessage.trim()}>
        Send Message
      </button>

      <button onClick={() => callCitizen(citizen?.phoneNumber)}>
        📞 Call Citizen
      </button>
    </div>
  )
}
```

---

### Subsystem 9: Cross-Municipality Coordination

#### Purpose

Share visibility of incidents near municipal borders. Coordinate response across boundaries.

#### Components

**1. Border Incidents Display**

```typescript
// src/domains/municipal-admin/components/BorderIncidents.tsx
export function BorderIncidents() {
  const { municipality } = useMunicipalAdminAuth()
  const { data: borderIncidents } = useBorderIncidents(municipality)

  return (
    <div className="border-incidents">
      <h3>Border Incidents (Shared with Adjacent Municipalities)</h3>

      {borderIncidents.map(incident => (
        <BorderIncidentCard
          key={incident.id}
          incident={incident}
          isMine={incident.municipality === municipality}
        />
      ))}
    </div>
  )
}
```

**2. Cross-Municipality Messaging**

```typescript
// src/domains/municipal-admin/services/crossMuniMessaging.service.ts
export async function sendMessageToAdjacentMunicipality(
  incidentId: string,
  message: string,
  targetMunicipality: string
): Promise<void> {
  const msg: CrossMunicipalityMessage = {
    from: getCurrentUser().uid,
    fromMunicipality: getCurrentUser().municipality,
    toMunicipality: targetMunicipality,
    incidentId,
    message,
    sentAt: Date.now(),
  }

  await addDoc(collection(db, 'cross_municipality_messages'), msg)
}
```

---

### Subsystem 10: Advanced Features

#### Purpose

Heat maps, advanced filtering, clustering, and polish.

#### Components

**1. Heat Map Visualization**

```typescript
// src/domains/municipal-admin/components/HeatMapLayer.tsx
export function HeatMapLayer({ map, incidents }: { map: L.Map; incidents: Incident[] }) {
  useEffect(() => {
    if (!map || !incidents || incidents.length === 0) return

    const heatData = incidents.map(incident => [
      incident.location.latitude,
      incident.location.longitude,
      incident.severity === 'high' ? 1 : incident.severity === 'medium' ? 0.5 : 0.2,
    ])

    // @ts-ignore - leaflet.heat plugin
    const heatLayer = L.heatLayer(heatData, {
      radius: 25,
      blur: 15,
      maxZoom: 12,
    })

    heatLayer.addTo(map)

    return () => {
      map.removeLayer(heatLayer)
    }
  }, [map, incidents])

  return null
}
```

**2. Marker Clustering**

```typescript
// src/domains/municipal-admin/utils/markerClustering.ts
export function useClusteredMarkers(reports: Report[], map: L.Map) {
  const mcg = useMemo(() => {
    if (!map) return null

    const markers = reports.map(report => {
      const marker = L.marker([report.location.latitude, report.location.longitude])
      return marker
    })

    const group = new MarkerClusterGroup({
      spiderfyOnMaxZoom: 13,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyDistanceMultiplier: 2,
    })

    group.addLayers(markers)
    group.addTo(map)

    return group
  }, [reports, map])

  return mcg
}
```

---

### Layer 2 Quality Gates

#### Must Have (Definition of Done)

- [ ] All 10 subsystems implemented and functional
- [ ] Report verification workflow works (triage mode, auto-verify, classify)
- [ ] Responder dispatch works (assign, track, reassign)
- [ ] Real-time dashboards update correctly
- [ ] Mass alerts can be sent to citizens and responders
- [ ] Analytics dashboard displays accurate metrics
- [ ] Shift handoff transfers context successfully
- [ ] Duplicate detection merges reports correctly
- [ ] Citizen messaging works two-way
- [ ] Cross-municipality coordination shows border incidents
- [ ] Map displays all layers without performance issues (50+ markers)
- [ ] Unit tests for each subsystem (>70% coverage)
- [ ] Integration tests for critical workflows
- [ ] TypeScript compiles without errors
- [ ] E2E tests for main user flows

#### Nice to Have

- [ ] Heat map visualization
- [ ] Advanced clustering algorithms
- [ ] Multi-screen support
- [ ] Keyboard shortcuts for all actions
- [ ] Accessibility audit (WCAG 2.1 AA)

---

## Layer 3: Polish & Optimization

### Overview

Layer 3 hardens the system, optimizes performance, handles edge cases, and prepares for production deployment across all 12 municipalities.

**Timeline:** 4+ weeks (Weeks 13-16+)
**Deliverable:** Production-ready system ready for full deployment

---

### Performance Optimization

#### Map Rendering Optimization

```typescript
// src/domains/municipal-admin/utils/mapPerformance.ts
export function useOptimizedMapRendering(reports: Report[], map: L.Map) {
  // Virtual rendering: only render visible markers
  const visibleReports = useVisibleMarkers(reports, map)

  // Debounced updates: don't re-render on every change
  const debouncedUpdate = useDebouncedValue(
    () => updateMarkers(visibleReports),
    300
  )

  // Progressive loading: critical path first
  useEffect(() => {
    const highSeverityReports = visibleReports.filter(r => r.severity === 'high')
    const otherReports = visibleReports.filter(r => r.severity !== 'high')

    // Render high severity first
    updateMarkers(highSeverityReports)

    // Then render others after 100ms
    setTimeout(() => {
      updateMarkers(otherReports)
    }, 100)
  }, [visibleReports])
}
```

#### Query Optimization

```typescript
// Optimize TanStack Query caching
export function useOptimizedMunicipalReports(municipality: string) {
  return useQuery({
    queryKey: ['reports', municipality],
    queryFn: () => getMunicipalityReports(municipality),
    staleTime: 30000, // Consider fresh for 30s (longer than Layer 1)
    gcTime: 600000, // Keep in cache for 10 minutes
    refetchInterval: 30000,
    refetchOnWindowFocus: false, // Don't refetch on tab switch
    refetchOnReconnect: true, // Do refetch on reconnect
  })
}
```

---

### Edge Case Handling

#### Offline Handling

```typescript
// src/domains/municipal-admin/hooks/useOfflineDetection.ts
export function useOfflineDetection() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOffline }
}

// Display warning banner when offline
export function OfflineBanner() {
  const { isOffline } = useOfflineDetection()

  if (!isOffline) return null

  return (
    <div className="offline-banner">
      ⚠️ You are offline. Some features may be limited.
      <button onClick={retryNetworkOperation}>Retry</button>
    </div>
  )
}
```

#### Stale Responder Handling

```typescript
// Auto-escalate when responder doesn't acknowledge
export function useResponderEscalation(dispatchId: string) {
  useEffect(() => {
    const escalationTimeout = setTimeout(async () => {
      const dispatch = await getDispatch(dispatchId)

      if (dispatch.status === 'pending') {
        // Escalate to next available responder
        await escalateToNextResponder(dispatchId)
      }
    }, 10 * 60 * 1000) // 10 minutes

    return () => clearTimeout(escalationTimeout)
  }, [dispatchId])
}
```

#### Concurrent Dispatch Conflicts

```typescript
// Use Firestore transactions to prevent race conditions
export async function assignResponderWithLock(
  incidentId: string,
  responderId: string
): Promise<void> {
  const incidentRef = doc(db, 'incidents', incidentId)
  const responderRef = doc(db, 'responders', responderId)

  await runTransaction(db, async (transaction) => {
    const incidentDoc = await transaction.get(incidentRef)
    const responderDoc = await transaction.get(responderRef)

    if (!incidentDoc.exists() || !responderDoc.exists()) {
      throw new Error('Incident or responder not found')
    }

    const incident = incidentDoc.data()
    const responder = responderDoc.data()

    // Check if responder is available
    if (responder.status !== 'available') {
      throw new Error('Responder not available')
    }

    // Check if responder is already assigned to this incident
    if (incident.assignedResponders?.includes(responderId)) {
      return // Already assigned, skip
    }

    // Update incident
    transaction.update(incidentRef, {
      assignedResponders: arrayUnion(responderId),
      assignedAt: Date.now(),
    })

    // Update responder
    transaction.update(responderRef, {
      status: 'busy',
      currentIncident: incidentId,
      assignedAt: Date.now(),
    })
  })
}
```

---

### Comprehensive Testing

#### E2E Test Coverage

```typescript
// tests/e2e/municipal-admin-workflow.spec.ts
test('complete municipal admin workflow', async ({ page }) => {
  // Login as municipal admin
  await loginAsMunicipalAdmin(page, 'daet-admin@test.gov.ph')

  // View pending queue
  await page.click('[data-testid="pending-reports-button"]')
  await expect(page.locator('.pending-queue')).toBeVisible()

  // Verify first report
  const firstReport = page.locator('.report-card').first()
  await firstReport.click()

  // Classify incident
  await page.selectOption('.incident-type-select', 'flood')
  await page.selectOption('.severity-select', 'high')
  await page.click('[data-testid="verify-button"]')

  // Dispatch responders
  await page.click('[data-testid="dispatch-button"]')
  await page.click('.responder-checkbox[data-responder="responder-1"]')
  await page.click('[data-testid="confirm-dispatch"]')

  // Verify responder acknowledgment
  await expect(page.locator('[data-testid="dispatch-status"]')).toContainText('Acknowledged')

  // Send mass alert
  await page.click('[data-testid="mass-alert-button"]')
  await page.fill('[data-testid="alert-title"]', 'URGENT: Evacuation Notice')
  await page.fill('[data-testid="alert-message"]', 'Evacuate now due to flooding')
  await page.click('[data-testid="send-alert-button"]')

  // Verify alert sent
  await expect(page.locator('[data-testid="alert-sent"]')).toBeVisible()
})
```

#### Load Testing

```typescript
// tests/load/map-performance.spec.ts
test('map handles 100 markers smoothly', async () => {
  // Generate 100 test reports
  const reports = generateTestReports(100)

  const renderTime = measurePerformance(() => {
    render(<MunicipalMapView reports={reports} />)
  })

  expect(renderTime).toBeLessThan(1000) // Render in under 1 second
})
```

---

### Documentation & Training

#### Admin Training Docs

```markdown
# Municipal Admin Training Guide

## Quick Start (5 Minutes)

1. Log in with your municipal admin credentials
2. You'll see your municipality highlighted in green on the map
3. Pending reports appear in the Quick Actions bar (top)
4. Click to open, verify/classify, or reject

## Common Workflows

### Verifying a Report
1. Open Pending Queue (click "📋 Pending: X" or press V)
2. Click on a report to view details
3. If photo + location present: Click "Verify & Classify"
4. Select incident type (Flood, Fire, etc.) and severity (High/Medium/Low)
5. Report moves to Active Incidents

### Dispatching Responders
1. Open verified incident from Active Incidents (press D)
2. Click "Dispatch" button
3. System suggests appropriate responders based on incident type
4. Select responders (recommended + custom selection)
5. Click "Dispatch" to send notifications

### During Surge Events (50+ reports/hour)
1. Enable Triage Mode (button in Pending Queue)
2. Filter to "High Only" to focus on critical incidents
3. Use keyboard shortcuts (V for queue, Enter to select, Space to verify)
4. Batch operations: "Auto-Verify Trusted Citizens" to clear queue quickly

## Keyboard Shortcuts

- V - Open pending queue
- D - Open active incidents
- R - Open responder dashboard
- A - Open mass alerts
- ESC - Close all panels
- Enter - Open selected item
- Space - Quick action on selected item
```

---

### Layer 3 Quality Gates

#### Must Have (Production Ready)

- [ ] Performance: Map renders 100+ markers in <2 seconds
- [ ] Performance: Query response time <500ms (p95)
- [ ] All edge cases handled (offline, stale responders, conflicts)
- [ ] E2E tests for all critical workflows pass
- [ ] Load tests validate surge capacity (50+ reports/hour)
- [ ] Accessibility audit passes (WCAG 2.1 AA)
- [ ] Security audit passes (no cross-municipality data leaks)
- [ ] Admin training documentation complete
- [ ] Runbook for common incidents created
- [ ] TypeScript compiles without warnings
- [ ] Unit test coverage >80%
- [ ] Integration test coverage >70%

#### Nice to Have

- [ ] Multi-screen support (dual monitor)
- [ ] Advanced clustering algorithms
- [ ] Performance monitoring dashboard
- [ ] A/B testing framework for feature rollouts

---

## Technical Decisions

### Why This Architecture?

**1. Server-State Only (TanStack Query)**
- **Decision:** All data from Firestore via TanStack Query. Minimal client-side state.
- **Rationale:** Proven pattern in your codebase (`useReportQueue`, `useAlerts`). Excellent caching, automatic refetching. Simplifies debugging (state = database).
- **Trade-off:** More query boilerplate, but worth it for reliability.

**2. Firestore Rules for Security**
- **Decision:** Enforce municipality boundaries at database level with custom claims.
- **Rationale:** Mission-critical disaster response. Legal jurisdictional boundaries. Client-side filtering can be bypassed.
- **Trade-off:** Requires Cloud Function deployment, but necessary for security.

**3. Map-Centric Interface**
- **Decision:** Map is always visible. Panels slide in/out but never block map.
- **Rationale:** Situational awareness is critical during disasters. Map is the command center's radar screen.
- **Trade-off:** More complex layout logic, but essential for ops.

**4. Layer-Cake Architecture**
- **Decision:** Build foundation first, then features, then polish.
- **Rationale:** 16+ week timeline allows quality focus. Clean architecture prevents technical debt.
- **Trade-off:** Longer time to first feature (4 weeks), but faster overall development.

**5. Real-Time + Polling Mix**
- **Decision:** Use Firestore onSnapshot for critical events, 30s polling for non-critical.
- **Rationale:** Balances instant updates with cost/complexity. Don't need everything to be instant.
- **Trade-off:** More complex data flow, but optimal user experience.

---

## Implementation Timeline

### Phase 1: Infrastructure Foundation (Weeks 1-4)

| Week | Focus | Deliverables |
|------|-------|-------------|
| 1 | Auth + Firestore Rules | Custom claims, route guards, security rules |
| 2 | Map Extensions | Municipal boundaries, admin controls, layer system |
| 3 | Data Services | Firestore services, TanStack Query hooks, real-time subs |
| 4 | Layout + Routing | Dashboard layout, sliding panels, keyboard shortcuts |

**Gate:** All Layer 1 quality gates must pass before starting Layer 2.

---

### Phase 2: All Subsystems (Weeks 5-12)

| Week | Focus | Deliverables |
|------|-------|-------------|
| 5 | Report Verification | Pending queue, triage mode, auto-verify, classification |
| 6 | Responder Dispatch | Dispatch interface, incident templates, acknowledgment tracking |
| 7 | Real-Time Dashboards | Responder status, stale detection, location tracking |
| 8 | Mass Alerts | Citizen alerts, responder mobilization, alert templates |
| 9 | Analytics | Dashboard, metrics collection, data visualization |
| 10 | Shift Handoff | Handoff interface, context transfer, notes system |
| 11 | Duplicate Detection | Similarity algorithm, merge UI, attribution tracking |
| 12 | Citizen Messaging + Cross-Muni + Advanced | Two-way messaging, border incidents, heat maps, clustering |

**Gate:** All Layer 2 quality gates must pass before starting Layer 3.

---

### Phase 3: Polish & Optimization (Weeks 13-16+)

| Week | Focus | Deliverables |
|------|-------|-------------|
| 13 | Performance Optimization | Map rendering, query optimization, bundle size reduction |
| 14 | Edge Cases | Offline handling, stale responders, concurrent conflicts |
| 15 | Testing | E2E coverage, load tests, accessibility audit |
| 16 | Documentation | Training docs, runbook, deployment guides |

**Gate:** All Layer 3 quality gates must pass before production deployment.

---

## Quality Assurance

### Testing Strategy

**Unit Tests (Vitest)**
- All service methods (Firestore, verification, duplicate detection)
- All hooks (TanStack Query wrappers, real-time subscriptions)
- All components (panels, maps, forms)
- Target: >80% coverage

**Integration Tests**
- Firestore rules (test with Firebase emulator)
- Auth flows (login, custom claims, route guards)
- Data services (TanStack Query + Firestore integration)
- Real-time subscriptions (onSnapshot triggers)

**E2E Tests (Playwright)**
- Complete municipal admin workflows
- Critical paths: login → verify → dispatch
- Cross-municipality coordination
- Mass alert sending

**Performance Tests**
- Map rendering with 100+ markers
- Query response time under load
- Memory usage during surge events

**Security Tests**
- Firestore rules enforcement (try cross-municipality access)
- Custom claims validation
- Input validation and sanitization

**Accessibility Tests**
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader compatibility
- Color contrast ratios

---

### Definition of Done

#### Layer 1 Complete (Week 4)
- [ ] Municipal admin login works
- [ ] Firestore rules enforce municipality filtering
- [ ] Map shows municipal boundaries (admin's highlighted)
- [ ] TanStack Query hooks return data
- [ ] Sliding panels work smoothly
- [ ] Unit tests pass (>80% coverage)
- [ ] TypeScript compiles without errors
- [ ] E2E test for login → map flow passes

#### Layer 2 Complete (Week 12)
- [ ] All 10 subsystems functional
- [ ] Report verification workflow works end-to-end
- [ ] Responder dispatch works end-to-end
- [ ] Real-time dashboards update correctly
- [ ] Mass alerts can be sent
- [ ] Analytics dashboard displays metrics
- [ ] Shift handoff works
- [ ] Duplicate detection merges reports
- [ ] Citizen messaging works
- [ ] Cross-municipality shows border incidents
- [ ] Map handles 50+ markers smoothly
- [ ] Unit tests pass (>70% coverage)
- [ ] Integration tests pass
- [ ] E2E tests for main workflows pass
- [ ] TypeScript compiles without errors

#### Layer 3 Complete (Week 16+)
- [ ] Performance benchmarks met (100+ markers in <2s)
- [ ] Query p95 <500ms
- [ ] All edge cases handled
- [ ] E2E tests pass for all critical flows
- [ ] Load tests validate surge capacity
- [ ] Accessibility audit passes (WCAG 2.1 AA)
- [ ] Security audit passes
- [ ] Admin training docs complete
- [ ] Runbook created
- [ ] Ready for production deployment

---

## Appendix: Data Models

### Current Codebase Data Model (3-Tier)

The existing codebase uses a 3-tier report model for privacy separation:

**Tier 1: `reports/{reportId}`** (Public - visible to citizens)
```typescript
interface Report {
  id: string
  reporterId: string
  status: 'pending' | 'verified' | 'rejected' | 'closed'
  incidentType?: string
  severity?: 'high' | 'medium' | 'low'
  description: string
  photos: string[]
  approximateLocation: {
    municipality: string  // CRITICAL: Municipality is nested here, not top-level
    barangay: string
    // May not have exact coordinates for privacy
  }
  createdAt: number
  // No verifiedAt, verifiedBy here (those are in report_ops)
}
```

**Tier 2: `report_private/{reportId}`** (Private - admin access only)
```typescript
interface ReportPrivate {
  reportId: string
  exactLocation: {
    latitude: number
    longitude: number
    accuracy: number
  }
  reporterContact: {
    phone: string
    email?: string
  }
  additionalDetails: string
}
```

**Tier 3: `report_ops/{reportId}`** (Operational - responder/dispatch tracking)
```typescript
interface ReportOps {
  reportId: string
  municipality: string  // Top-level for efficient queries
  status: 'pending' | 'verified' | 'rejected' | 'closed'
  incidentId?: string  // Links to incident if verified
  verifiedAt?: number
  verifiedBy?: string  // UID of admin who verified
  dispatchedAt?: number
  assignedResponders?: string[]  // Responder IDs
  resolutionDetails?: string
  createdAt: number
  updatedAt: number
}
```

### Incident Model (To Be Created)

The spec introduces a new `incidents` collection for verified, actionable incidents:

**`incidents/{incidentId}`**
```typescript
interface Incident {
  id: string
  municipality: string
  reportIds: string[]  // Can merge multiple reports into one incident
  incidentType: string
  severity: 'high' | 'medium' | 'low'
  status: 'verified' | 'dispatched' | 'in_progress' | 'resolved'
  assignedResponders: string[]
  location: {
    latitude: number
    longitude: number
    accuracy: number
  }
  createdAt: number
  verifiedAt: number
  resolvedAt?: number
  // Audit trail
  verifiedBy: string
  dispatchedBy?: string
  resolvedBy?: string
}
```

### Migration Strategy

**Phase 1:** Keep existing 3-tier model unchanged
**Phase 2:** Add `incidents` collection alongside (not replacing reports)
**Phase 3:** Gradually create incident records when reports are verified
**Phase 4:** Maintain backward compatibility - reports remain source of truth for citizens

---

## Appendix: Required Firestore Indexes

All composite indexes required for the spec's queries:

```json
{
  "indexes": [
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "approximateLocation.municipality",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "approximateLocation.municipality",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "incidentType",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "approximateLocation.municipality",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "report_ops",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "municipality",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "responders",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "municipality",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "incidents",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "municipality",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Deploy with: `firebase deploy --only firestore:indexes`

---

## Appendix: Security & Audit Requirements

### Audit Trail

Every municipal admin action must be logged for post-incident analysis:

**`audit_logs/{logId}`**
```typescript
interface AuditLog {
  id: string
  municipality: string
  adminUid: string
  adminEmail: string
  action: 'verify_report' | 'reject_report' | 'dispatch_responder' | 'send_alert' | 'merge_reports'
  targetId: string  // Report ID, incident ID, etc.
  targetType: 'report' | 'incident' | 'responder' | 'alert'
  timestamp: number
  details: {
    // Action-specific data
    previousStatus?: string
    newStatus?: string
    assignedResponders?: string[]
    alertRecipients?: number
    mergedReports?: string[]
  }
  // IMMUTABLE: Once written, never updated or deleted
}
```

### Rate Limiting

**Mass Alert Rate Limiting:**
- Maximum: 1 mass alert per municipality per 5 minutes
- Per-admin daily limit: 10 mass alerts
- Implement in Cloud Function with Firestore counter

```typescript
// functions/src/rateLimit.ts
export async function checkMassAlertRateLimit(municipality: string, adminUid: string): Promise<{ allowed: boolean; reason?: string }> {
  const now = Date.now()
  const fiveMinutesAgo = now - 5 * 60 * 1000
  const oneDayAgo = now - 24 * 60 * 60 * 1000

  // Check municipality-level limit (1 per 5 minutes)
  const muniRef = doc(db, 'rate_limits', `mass_alert_${municipality}`)
  const muniSnap = await getDoc(muniRef)

  if (muniSnap.exists()) {
    const lastAlertTime = muniSnap.data()?.lastAlertTime || 0
    if (lastAlertTime > fiveMinutesAgo) {
      return { allowed: false, reason: 'Municipality rate limit: 1 alert per 5 minutes' }
    }
  }

  // Check per-admin daily limit (10 per day)
  const adminRef = doc(db, 'rate_limits', `mass_alert_admin_${adminUid}`)
  const adminSnap = await getDoc(adminRef)

  if (adminSnap.exists()) {
    const dailyCount = adminSnap.data()?.dailyCount || 0
    const lastReset = adminSnap.data()?.lastReset || 0

    if (lastReset < oneDayAgo) {
      // Reset counter
      await setDoc(adminRef, { dailyCount: 1, lastReset: now }, { merge: true })
    } else if (dailyCount >= 10) {
      return { allowed: false, reason: 'Daily limit: 10 mass alerts per admin' }
    } else {
      await updateDoc(adminRef, { dailyCount: dailyCount + 1 })
    }
  } else {
    await setDoc(adminRef, { dailyCount: 1, lastReset: now })
  }

  // Update municipality last alert time
  await setDoc(muniRef, { lastAlertTime: now }, { merge: true })

  return { allowed: true }
}
```

### Multi-Admin Conflict Handling

With 1-2 admins per municipality, concurrent operations can cause conflicts:

**Optimistic Locking for Report Verification:**
```typescript
export async function verifyReportWithLock(
  reportId: string,
  verificationData: VerificationData,
  expectedVersion: number
): Promise<void> {
  const reportOpsRef = doc(db, 'report_ops', reportId)

  await runTransaction(db, async (transaction) => {
    const doc = await transaction.get(reportOpsRef)
    if (!doc.exists()) {
      throw new Error('Report not found')
    }

    const data = doc.data()

    // Check version for optimistic locking
    if (data.version !== expectedVersion) {
      throw new Error('Report was modified by another admin. Please refresh and try again.')
    }

    // Update with new version
    transaction.update(reportOpsRef, {
      status: 'verified',
      verifiedAt: Date.now(),
      verifiedBy: getCurrentUser().uid,
      version: expectedVersion + 1,
    })
  })
}
```

---

## Appendix: Error Recovery Procedures

### Network Partition During Operations

**Retriable Operations (with idempotency):**
- Report verification: Use idempotency key
- Responder dispatch: Check existing assignments before creating new ones
- Mass alerts: Use deduplication ID to prevent duplicate sends

**Non-Retriable Operations:**
- Report rejection: Show error, require manual retry
- Shift handoff: Prevent if network unstable

### Transaction Failure Recovery

```typescript
export async function safeDispatchWithRetry(
  incidentId: string,
  responderId: string,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await assignResponderWithLock(incidentId, responderId)
      return { success: true }
    } catch (error) {
      if (error.message.includes('not available')) {
        // Responder was assigned by someone else - not retryable
        return { success: false, error: 'Responder no longer available' }
      }

      if (attempt === maxRetries) {
        return { success: false, error: `Failed after ${maxRetries} attempts: ${error.message}` }
      }

      // Exponential backoff before retry
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100))
    }
  }

  return { success: false, error: 'Unknown error' }
}
```

---

## Appendix: Data Models

### Key Collections

#### `users/{uid}`

```typescript
interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: 'citizen' | 'responder' | 'municipal_admin' | 'provincial_superadmin'
  municipality?: string // For municipal admins
  phoneNumber?: string // For responders
  trustScore?: number // For citizens (0-100)
  isActive: boolean
  createdAt: number
  lastLoginAt: number
}
```

#### `reports/{reportId}`

```typescript
interface Report {
  id: string
  reporterId: string
  // CRITICAL: Municipality is nested in approximateLocation
  approximateLocation: {
    municipality: string
    barangay: string
  }
  photos: string[]
  incidentType?: string
  severity?: 'high' | 'medium' | 'low'
  status: 'pending' | 'verified' | 'rejected' | 'closed'
  description: string
  createdAt: number
}
```

#### `report_ops/{reportId}` (Operational Tier)

```typescript
interface ReportOps {
  reportId: string
  municipality: string  // Top-level for efficient queries
  status: 'pending' | 'verified' | 'rejected' | 'closed'
  incidentId?: string  // Links to incident if verified
  verifiedAt?: number
  verifiedBy?: string  // UID of admin who verified
  dispatchedAt?: number
  assignedResponders?: string[]  // Responder IDs
  resolutionDetails?: string
  createdAt: number
  updatedAt: number
  version: number  // For optimistic locking
}
```

#### `responders/{responderId}`

```typescript
interface Responder {
  id: string
  municipality: string // Bound to admin's municipality
  name: string
  type: 'fire' | 'police' | 'medical' | 'engineering' | 'search_rescue' | 'social_welfare'
  status: 'available' | 'busy' | 'on_scene' | 'en_route'
  currentIncident?: string
  location?: {
    latitude: number
    longitude: number
    timestamp: number
  }
  lastUpdateAt: number
  phoneNumber: string
}
```

#### `incidents/{incidentId}`

```typescript
interface Incident {
  id: string
  municipality: string
  reportIds: string[] // Can merge multiple reports
  incidentType: string
  severity: 'high' | 'medium' | 'low'
  status: 'verified' | 'dispatched' | 'in_progress' | 'resolved'
  assignedResponders: string[]
  location: {
    latitude: number
    longitude: number
  }
  createdAt: number
  verifiedAt: number
  resolvedAt?: number
}
```

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2026-04-15 | **CRITICAL FIXES**: Fixed data model field paths (approximateLocation.municipality), addressed getMunicipalityReports security vulnerability, added custom claims implementation, clarified 3-tier report model, added required Firestore indexes, added rate limiting strategy, added audit trail requirements, added multi-admin conflict handling, added error recovery procedures |
| 1.0 | 2026-04-15 | Initial design specification - Layer 1 complete, Layer 2 overview |

---

## Appendix: Implementation Priorities by Phase

### Before Implementation Starts (Pre-Layer 1)

**Critical Security Fixes (Must Do First):**
1. ✅ Fix `getMunicipalityReports` to enforce municipality filtering
2. ✅ Deploy `setMunicipalClaims` Cloud Function
3. ✅ Update Firestore rules with correct field paths
4. ✅ Create required Firestore composite indexes
5. ✅ Add `version` field to `report_ops` for optimistic locking

### Layer 1 Tasks (Weeks 1-4)

**Week 1: Auth + Security**
- Implement `setMunicipalClaims` Cloud Function
- Add custom claims setup to municipal admin registration flow
- Update all Firestore rules with municipality checks
- Write security tests for cross-municipality blocking
- Add error boundary for Firestore unavailability

**Week 2: Map Foundation**
- Extend MapView with municipal boundaries
- Add municipality GeoJSON loading
- Implement layer management system
- Add marker clustering for performance

**Week 3: Data Services**
- Fix all service methods to use correct field paths
- Add TanStack Query hooks with proper error handling
- Implement real-time subscriptions
- Add retry logic with exponential backoff

**Week 4: Layout + Routing**
- Build MunicipalAdminDashboard with map-centric layout
- Implement sliding panel system
- Add keyboard shortcuts
- Add optimistic locking for concurrent operations

### Layer 2 Tasks (Weeks 5-12)

**Week 5-6: Verification + Dispatch**
- Implement report verification with audit logging
- Add duplicate detection with UX for review
- Build dispatch interface with acknowledgment tracking
- Add escalation rules for stale responders

**Week 7-8: Dashboards + Alerts**
- Create real-time responder status dashboard
- Implement stale responder detection
- Build mass alert tools with rate limiting
- Add citizen messaging interface

**Week 9-10: Analytics + Handoff**
- Implement analytics aggregation
- Create analytics dashboard
- Build shift handoff interface
- Add validation to prevent lost incidents

**Week 11-12: Advanced Features**
- Complete cross-municipality coordination
- Add heat map visualization
- Implement advanced marker clustering
- Add comprehensive audit trail

### Layer 3 Tasks (Weeks 13-16+)

**Week 13: Performance**
- Optimize map rendering (canvas, virtual scrolling)
- Add progressive loading
- Implement query optimization
- Add bundle size reduction

**Week 14: Edge Cases**
- Implement offline detection and handling
- Add comprehensive error recovery
- Implement concurrent conflict resolution
- Add chaos testing for network partitions

**Week 15: Testing + Security**
- Complete E2E test coverage
- Add security audit tests
- Implement accessibility improvements
- Add performance monitoring

**Week 16: Documentation + Deployment**
- Complete admin training documentation
- Create runbook for common incidents
- Add disaster recovery procedures
- Prepare production deployment

---

## Appendix: Known Issues and Mitigations

### Existing Issues from QA Scan (2026-04-14)

The following issues were identified in prior QA scans and must be addressed:

| Issue | Severity | Mitigation in Spec |
|-------|----------|-------------------|
| `getMunicipalityReports` ignores municipality parameter | 🔴 Critical | ✅ Fixed - enforced filtering with correct field path |
| No rate limiting on Cloud Functions | 🔴 Critical | ✅ Added - mass alert rate limiting |
| MFA dead feature (municipal admins locked out) | 🔴 Critical | ⚠️ Deferred to Layer 3 - use password reset for now |
| Non-atomic 3-tier writes | 🟡 Major | ⚠️ Accepted - add transactions in Layer 2 |
| GPS coordinates (0,0) accepted | 🟡 Major | ✅ Add validation in report verification |
| Photo upload failure silent | 🟡 Major | ✅ Add error handling in verification flow |
| IndexedDB unbounded queues | 🟡 Major | ✅ Add TTL pruning in Layer 3 |

### Defer to Layer 3 (Post-Beta)

The following features are valuable but not required for beta testing:

- Multi-screen support (dual monitor)
- Advanced clustering algorithms
- MFA for municipal admins
- Performance monitoring dashboard
- A/B testing framework

### Out of Scope

The following are explicitly out of scope for this implementation:

- Mobile app for municipal admins (desktop/tablet only)
- Voice/video communication
- Integration with external emergency services
- Automated weather alerts integration
- Drone/satellite imagery integration
