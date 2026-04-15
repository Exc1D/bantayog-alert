# Municipal Admin - Layer 1: Infrastructure Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational infrastructure for municipal admin command center - authentication, map with municipal boundaries, real-time data services, and map-centric desktop layout.

**Architecture:** Layer-cake approach - build secure foundation first. Server-state only (TanStack Query + Firestore), security-first (Firestore rules enforce municipality boundaries), map-centric interface (always visible, sliding panels).

**Tech Stack:** React, TypeScript, Firebase (Auth + Firestore), TanStack Query, Leaflet, Vitest, Playwright

---

## File Structure Map

**New Files to Create:**
```
src/domains/municipal-admin/
├── components/
│   ├── MunicipalAdminRoute.tsx          (route guard)
│   ├── MunicipalAdminDashboard.tsx     (main layout)
│   ├── AdminTopBar.tsx                  (top bar)
│   ├── QuickActionsBar.tsx               (quick stats/actions)
│   ├── MunicipalMapView.tsx              (extends MapView)
│   ├── MunicipalBoundariesLayer.tsx     (map overlay)
│   ├── AdminMapControls.tsx              (map controls)
│   └── LayerControls.tsx                 (layer toggles)
├── hooks/
│   ├── useMunicipalAdminAuth.ts         (auth hook)
│   ├── useMunicipalBoundaries.ts       (boundaries data)
│   ├── useMapLayers.ts                  (layer state)
│   ├── useOptimizedMarkers.ts           (marker clustering)
│   ├── useKeyboardShortcuts.ts          (keyboard shortcuts)
│   ├── useMunicipalReports.ts          (TanStack Query)
│   ├── usePendingReports.ts            (TanStack Query)
│   ├── useAvailableResponders.ts        (TanStack Query)
│   ├── useUrgentItems.ts                (TanStack Query)
│   ├── useRealtimeSubscriptions.ts     (onSnapshot)
│   └── index.ts                         (barrel exports)
├── services/
│   ├── firestore.service.ts             (FIX security issue)
│   ├── boundaries.service.ts            (GeoJSON fetch)
│   └── index.ts                         (barrel exports)
└── types/
    └── index.ts                         (domain types)

src/shared/components/
└── SlidingPanel.tsx                    (reusable sliding panel)

functions/src/
└── setMunicipalClaims.ts                (Cloud Function for custom claims)

firestore.indexes.json                    (composite indexes)
```

**Files to Modify:**
- `src/app/routes.tsx` - Add municipal-admin route
- `firestore.rules` - Add municipal admin rules
- `src/shared/types/auth.types.ts` - Extend with municipal admin types (if needed)

---

## Pre-Implementation: Critical Security Fixes

### Task 1: Fix Firestore Indexes

Create the required composite indexes before any queries.

**Files:**
- Create: `firestore.indexes.json`

- [ ] **Step 1: Create firestore.indexes.json**

```json
{
  "indexes": [
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "approximateLocation.municipality", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "approximateLocation.municipality", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "report_ops",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "municipality", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 2: Deploy indexes**

Run: `firebase deploy --only firestore:indexes`
Expected: Indexes created successfully

- [ ] **Step 3: Commit**

```bash
git add firestore.indexes.json
git commit -m "feat(firestore): add composite indexes for municipal admin queries"
```

---

## Week 1: Authentication & Authorization

### Task 2: Create Cloud Function for Custom Claims

**Files:**
- Create: `functions/src/setMunicipalClaims.ts`

- [ ] **Step 1: Create Cloud Function file**

```typescript
// functions/src/setMunicipalClaims.ts
import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import { https } from 'firebase-functions/v1'

const db = admin.firestore()
const auth = admin.auth()

/**
 * Sets municipal admin custom claims for a user
 *
 * Called after creating a municipal admin account to set their
 * municipality-based access control tokens.
 */
export const setMunicipalClaims = functions.https.onCall(async (data, context) => {
  // CRITICAL: Must be callable by provincial superadmin during account creation
  if (!context.auth) {
    throw new https.HttpsError('unauthenticated', 'Must be logged in')
  }

  const { uid } = context.auth
  const user = await auth.getUser(uid)

  // Get municipality from user profile
  const userProfile = await db.collection('users').doc(uid).get()
  if (!userProfile.exists) {
    throw new https.HttpsError('not-found', 'User profile not found')
  }
  const { municipality, role } = userProfile.data()

  if (role !== 'municipal_admin' || !municipality) {
    throw new https.HttpsError(
      'permission-denied',
      'User is not a municipal admin with assigned municipality'
    )
  }

  // Set custom claims
  const claims = {
    role: 'municipal_admin',
    municipality: municipality,
    emailVerified: user.emailVerified,
  }

  await auth.setCustomUserClaims(uid, claims)

  return { success: true, claims }
})

/**
 * Helper function to set municipal admin claims
 * Call this after creating a municipal admin account
 */
export async function setupMunicipalAdminClaims(
  uid: string,
  municipality: string
): Promise<void> {
  const claims = {
    role: 'municipal_admin',
    municipality: municipality,
  }
  await auth.setCustomUserClaims(uid, claims)
}
```

- [ ] **Step 2: Add to functions/src/index.ts**

Check if `functions/src/index.ts` exists and add the export.

- [ ] **Step 3: Deploy Cloud Function**

Run: `firebase deploy --only functions:setMunicipalClaims`
Expected: Function deployed successfully

- [ ] **Step 4: Commit**

```bash
git add functions/src/setMunicipalClaims.ts
git commit -m "feat(functions): add setMunicipalClaims Cloud Function"
```

---

### Task 3: Update Firestore Rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Read current firestore.rules**

Run: `cat firestore.rules`
Expected: See current rules

- [ ] **Step 2: Add municipal admin helper functions to firestore.rules**

Add these helper functions at the top level in firestore.rules:

```javascript
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
function isInMyMunicipality() {
  return isMunicipalAdmin() &&
         resource.data.approximateLocation.municipality == getUserMunicipality();
}
```

- [ ] **Step 3: Add reports collection rules**

Add/Update in firestore.rules:

```javascript
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

  // Deletes not allowed for municipal admins
  allow delete: if false;
}
```

- [ ] **Step 4: Add report_ops collection rules**

Add in firestore.rules:

```javascript
// Report operations collection (sensitive data)
match /report_ops/{opsId} {
  allow read, write: if isMunicipalAdmin() &&
                       resource.data.municipality == getUserMunicipality();
}
```

- [ ] **Step 5: Add responders collection rules**

Add in firestore.rules:

```javascript
// Responders collection
match /responders/{responderId} {
  allow read: if isMunicipalAdmin() &&
                resource.data.municipality == getUserMunicipality();
  allow write: if isMunicipalAdmin() &&
                 request.resource.data.municipality == getUserMunicipality();
}
```

- [ ] **Step 6: Test Firestore rules with emulator**

Run: `firebase emulators:start --only firestore`
Then run tests from `firestore.rules.test.ts`

- [ ] **Step 7: Deploy Firestore rules**

Run: `firebase deploy --only firestore:rules`
Expected: Rules deployed successfully

- [ ] **Step 8: Commit**

```bash
git add firestore.rules
git commit -m "feat(firestore): add municipal admin security rules"
```

---

### Task 4: Create Municipal Admin Auth Hook

**Files:**
- Create: `src/domains/municipal-admin/hooks/useMunicipalAdminAuth.ts`

- [ ] **Step 1: Create auth hook**

```typescript
// src/domains/municipal-admin/hooks/useMunicipalAdminAuth.ts
import { useMemo } from 'react'
import { useAuth } from '@/shared/hooks/useAuth'

export interface MunicipalAdminAuthState {
  municipality: string | null
  user: ReturnType<typeof useAuth>['user'] | null
  isLoading: boolean
  error: Error | null
  isAuthorized: boolean
}

/**
 * Hook for municipal admin authentication
 *
 * Extends useAuth to provide municipality context from custom claims.
 * Municipalality comes from Firebase custom claims set by Cloud Function.
 */
export function useMunicipalAdminAuth(): MunicipalAdminAuthState {
  const { user, loading, error } = useAuth()

  // Extract municipality from custom claims (in user.photoURL - workaround until claims are properly typed)
  const municipality = useMemo(() => {
    if (!user) return null
    // Custom claims are attached to the user by setMunicipalClaims
    // @ts-ignore - municipality is added via custom claims
    return user.municipality || null
  }, [user])

  const isAuthorized = useMemo(() => {
    return !!(user && municipality)
  }, [user, municipality])

  return {
    municipality,
    user,
    isLoading: loading,
    error,
    isAuthorized,
  }
}
```

- [ ] **Step 2: Create index barrel export**

```typescript
// src/domains/municipal-admin/hooks/index.ts
export { useMunicipalAdminAuth } from './useMunicipalAdminAuth'
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/municipal-admin/hooks/
git commit -m "feat(municipal-admin): add useMunicipalAdminAuth hook"
```

---

### Task 5: Create Municipal Admin Route Guard

**Files:**
- Create: `src/domains/municipal-admin/components/MunicipalAdminRoute.tsx`

- [ ] **Step 1: Create route guard component**

```typescript
// src/domains/municipal-admin/components/MunicipalAdminRoute.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMunicipalAdminAuth } from '../hooks/useMunicipalAdminAuth'

interface Props {
  children: React.ReactNode
}

/**
 * Route guard for municipal admin pages
 *
 * Redirects to login if user is not authenticated as municipal admin.
 * Municipality authorization is enforced via custom claims.
 */
export function MunicipalAdminRoute({ children }: Props) {
  const { user, isLoading, error, isAuthorized } = useMunicipalAdminAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !isAuthorized) {
      navigate('/login')
    }
  }, [isLoading, isAuthorized, navigate])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center text-red-600">
          <p>Error: {error.message}</p>
          <button onClick={() => navigate('/login')} className="underline">
            Return to login
          </button>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/municipal-admin/components/MunicipalAdminRoute.tsx
git commit -m "feat(municipal-admin): add MunicipalAdminRoute guard component"
```

---

### Task 6: Create Shared SlidingPanel Component

**Files:**
- Create: `src/shared/components/SlidingPanel.tsx`

- [ ] **Step 1: Create SlidingPanel component**

```typescript
// src/shared/components/SlidingPanel.tsx
import { useEffect, useRef } from 'react'

interface Props {
  isOpen: boolean
  position: 'left' | 'right' | 'top' | 'bottom'
  onClose: () => void
  children: React.ReactNode
  className?: string
}

/**
 * Sliding panel for map-centric UI
 *
 * Panels slide in/out without blocking the map view.
 * Clicking outside closes the panel. ESC key also closes.
 */
export function SlidingPanel({
  isOpen,
  position,
  onClose,
  children,
  className = '',
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const getPositionClasses = (): string => {
    switch (position) {
      case 'left':
        return 'left-0 top-0 bottom-0 w-96 transform -translate-x-full'
      case 'right':
        return 'right-0 top-0 bottom-0 w-96 transform translate-x-full'
      case 'top':
        return 'top-0 left-0 right-0 h-96 transform -translate-y-full'
      case 'bottom':
        return 'bottom-0 left-0 right-0 h-96 transform translate-y-full'
      default:
        return ''
    }
  }

  const getOpenClasses = (): string => {
    switch (position) {
      case 'left':
        return 'translate-x-0'
      case 'right':
        return 'translate-x-0'
      case 'top':
        return 'translate-y-0'
      case 'bottom':
        return 'translate-y-0'
      default:
        return ''
    }
  }

  return (
    <div
      ref={panelRef}
      className={`
        fixed z-50 bg-white shadow-lg transition-transform duration-300 ease-in-out
        ${getPositionClasses()}
        ${isOpen ? getOpenClasses() : ''}
        ${className}
      `}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">
            {position === 'left' && 'Panel'}
            {position === 'right' && 'Details'}
            {position === 'top' && 'Tools'}
            {position === 'bottom' && 'Actions'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create SlidingPanel test**

```typescript
// src/shared/components/__tests__/SlidingPanel.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { SlidingPanel } from '../SlidingPanel'

describe('SlidingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render when closed', () => {
    const { container } = render(
      <SlidingPanel isOpen={false} position="right" onClose={() => {}}>
        <div>Panel content</div>
      </SlidingPanel>
    )

    expect(container.querySelector('.sliding-panel')).not.toBeInTheDocument()
  })

  it('should render when open', () => {
    render(
      <SlidingPanel isOpen={true} position="right" onClose={() => {}}>
        <div>Panel content</div>
      </SlidingPanel>
    )

    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('should close when clicking outside', () => {
    const onClose = vi.fn()
    const { container } = render(
      <div>
        <div data-testid="outside">Outside</div>
        <SlidingPanel isOpen={true} position="right" onClose={onClose}>
          <div>Panel content</div>
        </SlidingPanel>
      </div>
    )

    const outside = container.querySelector('[data-testid="outside"]')
    if (outside) {
      outside.click()
    }

    // onClose should be called due to click outside
    expect(onClose).toHaveBeenCalled()
  })

  it('should close on ESC key', () => {
    const onClose = vi.fn()
    render(
      <SlidingPanel isOpen={true} position="right" onClose={onClose}>
        <div>Panel content</div>
      </SlidingPanel>
    )

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
    document.dispatchEvent(escapeEvent)

    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run test**

Run: `npm test -- SlidingPanel`
Expected: Test passes

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/SlidingPanel.tsx src/shared/components/__tests__/SlidingPanel.test.tsx
git commit -m "feat(shared): add SlidingPanel component for map-centric UI"
```

---

## Week 2: Map Foundation

### Task 7: Extend Types for Municipal Admin

**Files:**
- Create: `src/domains/municipal-admin/types/index.ts`

- [ ] **Step 1: Create municipal admin types**

```typescript
// src/domains/municipal-admin/types/index.ts
/**
 * Municipal boundary data from GeoJSON
 */
export interface MunicipalBoundary {
  id: string
  name: string
  geojson: GeoJSON.Feature<GeoJSON.Polygon>
}

/**
 * Map layer configuration
 */
export interface MapLayer {
  id: string
  name: string
  type: 'base' | 'overlay'
  visible: boolean
  opacity: number
  zIndex: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/municipal-admin/types/
git commit -m "feat(municipal-admin): add domain types"
```

---

### Task 8: Create Municipal Boundaries Service

**Files:**
- Create: `src/domains/municipal-admin/services/boundaries.service.ts`

- [ ] **Step 1: Create boundaries service**

```typescript
// src/domains/municipal-admin/services/boundaries.service.ts
import { getCollection } from '@/shared/services/firestore.service'
import type { MunicipalBoundary } from '../types'

/**
 * Fetch all municipal boundaries
 *
 * Retrieves GeoJSON data for all 12 municipalities in Camarines Norte.
 * Boundaries are cached locally for performance.
 */
export async function getMunicipalBoundaries(): Promise<MunicipalBoundary[]> {
  try {
    const boundaries = await getCollection<any>('municipal_boundaries')
    return boundaries.map((doc) => ({
      id: doc.id,
      name: doc.name,
      geojson: doc.geojson,
    }))
  } catch (error) {
    throw new Error('Failed to fetch municipal boundaries', { cause: error })
  }
}

/**
 * Get a specific municipality's boundary
 */
export async function getMunicipalBoundary(
  municipalityName: string
): Promise<MunicipalBoundary | null> {
  try {
    const boundaries = await getMunicipalBoundaries()
    return (
      boundaries.find((b) => b.name.toLowerCase() === municipalityName.toLowerCase()) ||
      null
    )
  } catch (error) {
    throw new Error(`Failed to fetch boundary for ${municipalityName}`, {
      cause: error,
    })
  }
}
```

- [ ] **Step 2: Create boundaries hook**

```typescript
// src/domains/municipal-admin/hooks/useMunicipalBoundaries.ts
import { useQuery } from '@tanstack/react-query'
import { getMunicipalBoundaries } from '../services/boundaries.service'

/**
 * Hook for fetching municipal boundaries
 *
 * Boundaries change rarely, so cache for 1 hour.
 */
export function useMunicipalBoundaries() {
  return useQuery({
    queryKey: ['municipal-boundaries'],
    queryFn: getMunicipalBoundaries,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/municipal-admin/services/boundaries.service.ts
git add src/domains/municipal-admin/hooks/useMunicipalBoundaries.ts
git commit -m "feat(municipal-admin): add municipal boundaries data service"
```

---

### Task 9: Create Municipal Boundaries Layer

**Files:**
- Create: `src/domains/municipal-admin/components/MunicipalBoundariesLayer.tsx`

- [ ] **Step 1: Create boundaries layer component**

```typescript
// src/domains/municipal-admin/components/MunicipalBoundariesLayer.tsx
import { useEffect } from 'react'
import L from 'leaflet'
import { useMunicipalBoundaries } from '../hooks/useMunicipalBoundaries'

interface Props {
  map: L.Map
  municipality: string
}

/**
 * Municipal boundaries overlay for Leaflet map
 *
 * Displays all 12 municipalities as boundary lines.
 * Admin's municipality is highlighted in green.
 */
export function MunicipalBoundariesLayer({ map, municipality }: Props) {
  const { data: boundaries } = useMunicipalBoundaries()

  useEffect(() => {
    if (!boundaries || !map) return

    // Clear existing boundary layers
    map.eachLayer((layer) => {
      if ((layer as L.GeoJSON).getLayers) {
        map.removeLayer(layer)
      }
    })

    // Add boundary layers
    const layers: L.GeoJSON[] = []

    boundaries.forEach((boundary) => {
      const isMyMunicipality =
        boundary.name.toLowerCase() === municipality.toLowerCase()

      const geoJsonLayer = L.geoJSON(boundary.geojson, {
        style: {
          color: isMyMunicipality ? '#10b981' : '#9ca3af',
          weight: isMyMunicipality ? 3 : 2,
          fillOpacity: isMyMunicipality ? 0.15 : 0.05,
        },
      })

      geoJsonLayer.bindTooltip(boundary.name)
      geoJsonLayer.addTo(map)
      layers.push(geoJsonLayer)
    })

    // Fit map to show all boundaries
    if (layers.length > 0) {
      const group = L.featureGroup(layers)
      map.fitBounds(group.getBounds(), { padding: [20, 20] })
    }

    return () => {
      layers.forEach((layer) => map.removeLayer(layer))
    }
  }, [boundaries, map, municipality])

  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/municipal-admin/components/MunicipalBoundariesLayer.tsx
git commit -m "feat(municipal-admin): add municipal boundaries map layer"
```

---

### Task 10: Create Admin Map Controls

**Files:**
- Create: `src/domains/municipal-admin/components/AdminMapControls.tsx`

- [ ] **Step 1: Create map controls component**

```typescript
// src/domains/municipal-admin/components/AdminMapControls.tsx
import { useState } from 'react'
import L from 'leaflet'

interface Props {
  map: L.Map
}

/**
 * Admin-specific map controls
 *
 * Provides zoom, reset, and layer toggle controls for municipal admin map.
 */
export function AdminMapControls({ map }: Props) {
  const [showLayers, setShowLayers] = useState(false)

  const handleZoomIn = () => map.zoomIn()
  const handleZoomOut = () => map.zoomOut()
  const handleReset = () => {
    map.setView(
      L.latLng(14.2972, 122.7417), // Camarines Norte center
      10
    )
  }

  return (
    <div className="absolute top-20 right-4 z-[1000] flex flex-col gap-2">
      {/* Zoom controls */}
      <button
        onClick={handleZoomIn}
        aria-label="Zoom in"
        className="bg-white px-3 py-2 rounded shadow hover:bg-gray-100"
      >
        +
      </button>
      <button
        onClick={handleZoomOut}
        aria-label="Zoom out"
        className="bg-white px-3 py-2 rounded shadow hover:bg-gray-100"
      >
        −
      </button>
      <button
        onClick={handleReset}
        aria-label="Reset view"
        className="bg-white px-3 py-2 rounded shadow hover:bg-gray-100"
      >
        📍
      </button>

      {/* Layers toggle */}
      <div className="relative">
        <button
          onClick={() => setShowLayers(!showLayers)}
          aria-label="Toggle layers"
          className="bg-white px-3 py-2 rounded shadow hover:bg-gray-100"
        >
          Layers ▼
        </button>

        {showLayers && (
          <div className="absolute top-full right-0 mt-1 bg-white rounded shadow p-2 text-sm w-48">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded" />
              <span>Municipal boundaries</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded" />
              <span>Incidents</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded" />
              <span>Responders</span>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/municipal-admin/components/AdminMapControls.tsx
git commit -m "feat(municipal-admin): add admin map controls component"
```

---

### Task 11: Create Map Layers Hook

**Files:**
- Create: `src/domains/municipal-admin/hooks/useMapLayers.ts`

- [ ] **Step 1: Create map layers hook**

```typescript
// src/domains/municipal-admin/hooks/useMapLayers.ts
import { useState } from 'react'
import type { MapLayer } from '../types'

/**
 * Hook for managing map layer visibility
 *
 * Manages which map layers are visible (incidents, responders, boundaries, etc.)
 */
export function useMapLayers() {
  const [layers, setLayers] = useState<Record<string, boolean>>({
    incidents: true,
    responders: true,
    boundaries: true,
    heatMap: false,
  })

  const toggleLayer = (id: string) => {
    setLayers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const isLayerVisible = (id: string): boolean => {
    return layers[id] || false
  }

  return {
    layers,
    toggleLayer,
    isLayerVisible,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/municipal-admin/hooks/useMapLayers.ts
git commit -m "feat(municipal-admin): add useMapLayers hook"
```

---

### Task 12: Create Optimized Markers Hook

**Files:**
- Create: `src/domains/municipal-admin/hooks/useOptimizedMarkers.ts`

- [ ] **Step 1: Create optimized markers hook**

```typescript
// src/domains/municipal-admin/hooks/useOptimizedMarkers.ts
import { useMemo } from 'react'
import type { Report } from '@/shared/types'
import L from 'leaflet'

/**
 * Hook for optimized marker rendering with clustering
 *
 * Uses marker clustering for 50+ pins to maintain performance.
 */
export function useOptimizedMarkers(
  reports: Report[],
  map: L.Map | null
): {
  mcg: L.MarkerClusterGroup | null
  addMarkers: (markers: L.Marker[]) => void
  clearMarkers: () => void
} {
  const mcg = useMemo(() => {
    if (!map || reports.length <= 50) return null

    // Dynamically import leaflet-markercluster
    import('leaflet-markercluster').then((module) => {
      const MarkerClusterGroup = module.default

      return new MarkerClusterGroup({
        spiderfyOnMaxZoom: 13,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderfyDistanceMultiplier: 2,
      })
    })

    return null
  }, [map, reports.length])

  const addMarkers = (markers: L.Marker[]) => {
    if (mcg) {
      mcg.addLayers(markers)
      mcg.addTo(map)
    }
  }

  const clearMarkers = () => {
    if (mcg) {
      mcg.clearLayers()
    }
  }

  return { mcg, addMarkers, clearMarkers }
}
```

- [ ] **Step 2: Install leaflet-markercluster**

Run: `npm install leaflet-markercluster @types/leaflet-markercluster`
Expected: Packages installed

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git add src/domains/municipal-admin/hooks/useOptimizedMarkers.ts
git commit -m "feat(municipal-admin): add useOptimizedMarkers hook with clustering"
```

---

### Task 13: Create Municipal Map View

**Files:**
- Create: `src/domains/municipal-admin/components/MunicipalMapView.tsx`

- [ ] **Step 1: Create municipal map view component**

```typescript
// src/domains/municipal-admin/components/MunicipalMapView.tsx
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { MapView } from '@/features/map/components/MapView'
import { MunicipalBoundariesLayer } from './MunicipalBoundariesLayer'
import { AdminMapControls } from './AdminMapControls'
import { useMunicipalAdminAuth } from '../hooks/useMunicipalAdminAuth'

/**
 * Municipal admin map view
 *
 * Extends base MapView with municipal boundaries and admin-specific controls.
 * The map is always visible - panels slide over it but never block it completely.
 */
export function MunicipalMapView() {
  const { municipality } = useMunicipalAdminAuth()
  const mapRef = useRef<L.Map | null>(null)

  // Get map instance from parent MapView
  useEffect(() => {
    // The MapView component exposes the map instance via ref
    // We'll access it through a ref prop or by extending MapView
    const mapContainer = document.getElementById('map')
    if (mapContainer && mapRef.current === null) {
      // @ts-ignore - MapView may have internal ref we can access
      const mapInstance = (mapContainer as any)._leaflet_map
      if (mapInstance) {
        mapRef.current = mapInstance
      }
    }
  }, [])

  if (!municipality) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading municipality...</p>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      {/* Base MapView */}
      <MapView />

      {/* Municipal boundaries overlay */}
      {mapRef.current && (
        <MunicipalBoundariesLayer
          map={mapRef.current}
          municipality={municipality}
        />
      )}

      {/* Admin controls */}
      {mapRef.current && <AdminMapControls map={mapRef.current} />}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/municipal-admin/components/MunicipalMapView.tsx
git commit -m "feat(municipal-admin): add MunicipalMapView component"
```

---

## Week 3: Data Services Layer

### Task 14: Fix Firestore Service Security Issue

**Files:**
- Modify: `src/domains/municipal-admin/services/firestore.service.ts`

- [ ] **Step 1: Fix getMunicipalityReports to enforce municipality filter**

Replace the existing `getMunicipalityReports` function (lines 32-56) with:

```typescript
export async function getMunicipalityReports(
  municipality: string
): Promise<Array<{ report: Report; private?: ReportPrivate }>> {
  if (!municipality) {
    throw new Error('Municipality parameter is required')
  }

  try {
    // SECURITY FIX: Use approximateLocation.municipality (not top-level field)
    // Enforce municipality filtering at query level (defense-in-depth)
    const constraints = [
      where('approximateLocation.municipality', '==', municipality),
      orderBy('createdAt', 'desc'),
      limit(100), // Prevent unbounded queries
    ]

    const reports = await getCollection<Report>('reports', constraints)

    // Fetch private data for each report
    const results = await Promise.all(
      reports.map(async (report) => {
        const privateData = await getDocument<ReportPrivate>(
          'report_private',
          report.id
        )
        return { report, private: privateData || undefined }
      })
    )

    return results
  } catch (error) {
    throw new Error('Failed to fetch municipality reports', { cause: error })
  }
}
```

- [ ] **Step 2: Add getPendingReports function**

```typescript
/**
 * Get pending reports in municipality
 *
 * Fetches reports awaiting verification for the admin's municipality.
 *
 * @param municipality - Municipality name
 */
export async function getPendingReports(
  municipality: string
): Promise<Report[]> {
  if (!municipality) {
    throw new Error('Municipality parameter is required')
  }

  try {
    const constraints = [
      where('approximateLocation.municipality', '==', municipality),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(50), // Prevent unbounded queries
    ]

    return await getCollection<Report>('reports', constraints)
  } catch (error) {
    throw new Error('Failed to fetch pending reports', { cause: error })
  }
}
```

- [ ] **Step 3: Add getReportsByStatus function**

```typescript
/**
 * Get reports by status in municipality
 *
 * Fetches reports with specific status for dashboard counts.
 *
 * @param municipality - Municipality name
 * @param status - Report status filter
 */
export async function getReportsByStatus(
  municipality: string,
  status: string
): Promise<Report[]> {
  if (!municipality) {
    throw new Error('Municipality parameter is required')
  }

  try {
    const constraints = [
      where('approximateLocation.municipality', '==', municipality),
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limit(100),
    ]

    return await getCollection<Report>('reports', constraints)
  } catch (error) {
    throw new Error(`Failed to fetch ${status} reports`, { cause: error })
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- firestore.service`
Expected: Tests pass (if they exist)

- [ ] **Step 5: Commit**

```bash
git add src/domains/municipal-admin/services/firestore.service.ts
git commit -m "fix(municipal-admin): enforce municipality filtering in getMunicipalityReports"
```

---

### Task 15: Create TanStack Query Hooks

**Files:**
- Create: `src/domains/municipal-admin/hooks/useMunicipalReports.ts`
- Create: `src/domains/municipal-admin/hooks/usePendingReports.ts`

- [ ] **Step 1: Create useMunicipalReports hook**

```typescript
// src/domains/municipal-admin/hooks/useMunicipalReports.ts
import { useQuery } from '@tanstack/react-query'
import { getMunicipalityReports } from '../services/firestore.service'

/**
 * Hook for fetching municipality reports
 *
 * Uses TanStack Query for caching, refetching, and error handling.
 * Data refreshes every 30 seconds.
 */
export function useMunicipalReports(municipality: string) {
  return useQuery({
    queryKey: ['reports', municipality],
    queryFn: () => getMunicipalityReports(municipality),
    enabled: !!municipality,
    refetchInterval: 30000, // 30-second auto-refresh
    staleTime: 15000, // Consider data fresh for 15s
    retry: 3,
  })
}
```

- [ ] **Step 2: Create usePendingReports hook**

```typescript
// src/domains/municipal-admin/hooks/usePendingReports.ts
import { useQuery } from '@tanstack/react-query'
import { getPendingReports } from '../services/firestore.service'

/**
 * Hook for fetching pending reports
 *
 * Pending queue is time-sensitive, so refresh every 10 seconds.
 */
export function usePendingReports(municipality: string) {
  return useQuery({
    queryKey: ['reports', municipality, 'pending'],
    queryFn: () => getPendingReports(municipality),
    enabled: !!municipality,
    refetchInterval: 10000, // 10-second refresh (urgent queue)
    staleTime: 5000,
    retry: 3,
  })
}
```

- [ ] **Step 3: Create useReportsByStatus hook**

```typescript
// src/domains/municipal-admin/hooks/useReportsByStatus.ts
import { useQuery } from '@tanstack/react-query'
import { getReportsByStatus } from '../services/firestore.service'

/**
 * Hook for fetching reports by status
 *
 * Used for dashboard counts (pending, verified, etc.)
 */
export function useReportsByStatus(municipality: string, status: string) {
  return useQuery({
    queryKey: ['reports', municipality, 'status', status],
    queryFn: () => getReportsByStatus(municipality, status),
    enabled: !!municipality && !!status,
    refetchInterval: 30000,
    staleTime: 15000,
    retry: 3,
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/municipal-admin/hooks/useMunicipalReports.ts
git add src/domains/municipal-admin/hooks/usePendingReports.ts
git add src/domains/municipal-admin/hooks/useReportsByStatus.ts
git commit -m "feat(municipal-admin): add TanStack Query hooks for reports"
```

---

### Task 16: Create Responder Query Hooks

**Files:**
- Create: `src/domains/municipal-admin/hooks/useAvailableResponders.ts`

- [ ] **Step 1: Create useAvailableResponders hook**

```typescript
// src/domains/municipal-admin/hooks/useAvailableResponders.ts
import { useQuery } from '@tanstack/react-query'
import { getAvailableResponders } from '../services/firestore.service'

/**
 * Hook for fetching available responders
 *
 * Returns responders in municipality who are currently available.
 */
export function useAvailableResponders(municipality: string) {
  return useQuery({
    queryKey: ['responders', municipality, 'available'],
    queryFn: () => getAvailableResponders(municipality),
    enabled: !!municipality,
    refetchInterval: 30000,
    staleTime: 15000,
    retry: 3,
  })
}
```

- [ ] **Step 2: Create useUrgentItems hook**

```typescript
// src/domains/municipal-admin/hooks/useUrgentItems.ts
import { useQuery } from '@tanstack/react-query'
import { getReportsByStatus } from '../services/firestore.service'

/**
 * Hook for fetching urgent items
 *
 * Urgent items are high-severity verified reports.
 */
export function useUrgentItems(municipality: string) {
  return useQuery({
    queryKey: ['reports', municipality, 'urgent'],
    queryFn: () => getReportsByStatus(municipality, 'verified'),
    enabled: !!municipality,
    refetchInterval: 15000, // More frequent for urgent items
    staleTime: 10000,
    retry: 3,
    select: (data) =>
      data.filter((report) => report.severity === 'high'),
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/municipal-admin/hooks/useAvailableResponders.ts
git add src/domains/municipal-admin/hooks/useUrgentItems.ts
git commit -m "feat(municipal-admin): add hooks for responders and urgent items"
```

---

### Task 17: Create Real-Time Subscriptions Hook

**Files:**
- Create: `src/domains/municipal-admin/hooks/useRealtimeSubscriptions.ts`

- [ ] **Step 1: Create real-time subscriptions hook**

```typescript
// src/domains/municipal-admin/hooks/useRealtimeSubscriptions.ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/app/firebase/config'

/**
 * Hook for real-time Firestore subscriptions
 *
 * Uses onSnapshot for instant updates when reports change.
 * Invalidates TanStack Query cache to trigger UI updates.
 */
export function useRealtimeSubscriptions(municipality: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!municipality) return

    const reportsRef = collection(db, 'reports')
    const q = query(
      reportsRef,
      where('approximateLocation.municipality', '==', municipality)
    )

    const unsubscribe = onSnapshot(
      q,
      () => {
        // Data changed - invalidate queries to trigger refetch
        queryClient.invalidateQueries(['reports', municipality])
      },
      (error) => {
        console.error('[REALTIME_SUBSCRIPTION] Error:', error)
        // On error, still invalidate to trigger refetch attempt
        queryClient.invalidateQueries(['reports', municipality])
      }
    )

    return () => unsubscribe()
  }, [municipality, queryClient])
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/municipal-admin/hooks/useRealtimeSubscriptions.ts
git commit -m "feat(municipal-admin): add real-time subscriptions hook"
```

---

## Week 4: Routing & Layout

### Task 18: Create Admin Top Bar

**Files:**
- Create: `src/domains/municipal-admin/components/AdminTopBar.tsx`

- [ ] **Step 1: Create admin top bar component**

```typescript
// src/domains/municipal-admin/components/AdminTopBar.tsx
import { useMunicipalAdminAuth } from '../hooks/useMunicipalAdminAuth'

/**
 * Top navigation bar for municipal admin dashboard
 *
 * Displays municipality name, alert count, and profile dropdown.
 * Always visible at the top of the screen.
 */
export function AdminTopBar() {
  const { municipality, user } = useMunicipalAdminAuth()

  return (
    <header className="bg-blue-800 text-white px-4 py-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold">
          Bantayog Alert
        </h1>
        <span className="text-blue-200">|</span>
        <span className="text-sm">
          MUNICIPAL ADMIN ({municipality?.toUpperCase() || 'Loading...'})
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          className="flex items-center gap-2 hover:bg-blue-700 px-3 py-2 rounded"
          aria-label="View alerts"
        >
          <span>🔔</span>
          <span>Alerts</span>
        </button>

        <div className="relative group">
          <button
            className="flex items-center gap-2 hover:bg-blue-700 px-3 py-2 rounded"
            aria-label="User menu"
          >
            <span>👤</span>
            <span className="text-sm">
              {user?.email || 'Profile'}
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/municipal-admin/components/AdminTopBar.tsx
git commit -m "feat(municipal-admin): add AdminTopBar component"
```

---

### Task 19: Create Quick Actions Bar

**Files:**
- Create: `src/domains/municipal-admin/components/QuickActionsBar.tsx`

- [ ] **Step 1: Create quick actions bar component**

```typescript
// src/domains/municipal-admin/components/QuickActionsBar.tsx
import { usePendingReports } from '../hooks/usePendingReports'
import { useAvailableResponders } from '../hooks/useAvailableResponders'
import { useUrgentItems } from '../hooks/useUrgentItems'
import { useState } from 'react'

/**
 * Quick actions bar for municipal admin
 *
 * Shows counts for pending reports, available responders, and urgent items.
 * Each button opens the corresponding panel.
 */
export function QuickActionsBar() {
  const { municipality } = useMunicipalAdminAuth()
  const { data: pendingReports } = usePendingReports(municipality || '')
  const { data: availableResponders } = useAvailableResponders(municipality || '')
  const { data: urgentItems } = useUrgentItems(municipality || '')

  const [openPanel, setOpenPanel] = useState<string | null>(null)

  const pendingCount = pendingReports?.length || 0
  const availableCount = availableResponders?.length || 0
  const urgentCount = urgentItems?.length || 0

  return (
    <div className="bg-white border-b px-4 py-2 flex items-center gap-6">
      <button
        onClick={() => setOpenPanel('pending')}
        className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 ${
          openPanel === 'pending' ? 'bg-blue-50' : ''
        }`}
      >
        <span>📋</span>
        <span>Pending:</span>
        <strong>{pendingCount}</strong>
      </button>

      <button
        onClick={() => setOpenPanel('responders')}
        className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 ${
          openPanel === 'responders' ? 'bg-blue-50' : ''
        }`}
      >
        <span>🚒</span>
        <span>Available:</span>
        <strong>{availableCount}</strong>
      </button>

      <button
        onClick={() => setOpenPanel('urgent')}
        className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 ${
          openPanel === 'urgent' ? 'bg-red-50' : ''
        }`}
      >
        <span>⚠️</span>
        <span>Urgent:</span>
        <strong className="text-red-600">{urgentCount}</strong>
      </button>

      <button
        onClick={() => setOpenPanel('mass-alert')}
        className="flex items-center gap-2 px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700"
      >
        <span>🆘</span>
        <span>Mass Alert</span>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/municipal-admin/components/QuickActionsBar.tsx
git commit -m "feat(municipal-admin): add QuickActionsBar component"
```

---

### Task 20: Create Keyboard Shortcuts Hook

**Files:**
- Create: `src/domains/municipal-admin/hooks/useKeyboardShortcuts.ts`

- [ ] **Step 1: Create keyboard shortcuts hook**

```typescript
// src/domains/municipal-admin/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react'

interface KeyboardShortcutsCallbacks {
  closeAllPanels?: () => void
  openPendingQueue?: () => void
  openActiveIncidents?: () => void
  openResponderDashboard?: () => void
  openMassAlertTools?: () => void
  toggleOverlaysPanel?: () => void
}

/**
 * Hook for keyboard shortcuts in municipal admin dashboard
 *
 * Enables power users to navigate quickly during surge events.
 * Shortcuts: V (pending), D (active), R (responders), A (alerts), ESC (close).
 */
export function useKeyboardShortcuts(callbacks: KeyboardShortcutsCallbacks) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      // Map navigation
      if (event.key === 'Escape') {
        callbacks.closeAllPanels?.()
        return
      }

      if (event.key === 'o' || event.key === 'O') {
        callbacks.toggleOverlaysPanel?.()
        return
      }

      // Quick actions
      if (event.key === 'v' || event.key === 'V') {
        callbacks.openPendingQueue?.()
        return
      }

      if (event.key === 'd' || event.key === 'D') {
        callbacks.openActiveIncidents?.()
        return
      }

      if (event.key === 'r' || event.key === 'R') {
        callbacks.openResponderDashboard?.()
        return
      }

      if (event.key === 'a' || event.key === 'A') {
        callbacks.openMassAlertTools?.()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    callbacks.closeAllPanels,
    callbacks.toggleOverlaysPanel,
    callbacks.openPendingQueue,
    callbacks.openActiveIncidents,
    callbacks.openResponderDashboard,
    callbacks.openMassAlertTools,
  ])
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/municipal-admin/hooks/useKeyboardShortcuts.ts
git commit -m "feat(municipal-admin): add keyboard shortcuts hook"
```

---

### Task 21: Create Municipal Admin Dashboard

**Files:**
- Create: `src/domains/municipal-admin/components/MunicipalAdminDashboard.tsx`

- [ ] **Step 1: Create main dashboard component**

```typescript
// src/domains/municipal-admin/components/MunicipalAdminDashboard.tsx
import { useState } from 'react'
import { MunicipalAdminRoute } from './MunicipalAdminRoute'
import { AdminTopBar } from './AdminTopBar'
import { QuickActionsBar } from './QuickActionsBar'
import { MunicipalMapView } from './MunicipalMapView'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { SlidingPanel } from '@/shared/components/SlidingPanel'
import { usePendingReports } from '../hooks/usePendingReports'
import { useMunicipalAdminAuth } from '../hooks/useMunicipalAdminAuth'

/**
 * Municipal admin main dashboard
 *
 * Map-centric layout with sliding panels that never block the map.
 * Always shows: top bar, quick actions, and map.
 * Panels slide in from left/right as needed.
 */
export function MunicipalAdminDashboard() {
  const { municipality } = useMunicipalAdminAuth()
  const [activePanel, setActivePanel] = useState<string | null>(null)
  const [panelsOpen, setPanelsOpen] = useState<Set<string>>(new Set())

  const { data: pendingReports } = usePendingReports(municipality || '')

  const closePanel = (panelId: string) => {
    setActivePanel(null)
    setPanelsOpen((prev) => {
      const newSet = new Set(prev)
      newSet.delete(panelId)
      return newSet
    })
  }

  const openPanel = (panelId: string) => {
    setActivePanel(panelId)
    setPanelsOpen((prev) => new Set(prev).add(panelId))
  }

  // Keyboard shortcuts
  useKeyboardShortcuts({
    closeAllPanels: () => setActivePanel(null),
    toggleOverlaysPanel: () => setActivePanel((prev) =>
      prev === 'overlays' ? null : 'overlays'
    ),
    openPendingQueue: () => setActivePanel('pending'),
    openActiveIncidents: () => setActivePanel('active-incidents'),
    openResponderDashboard: () => setActivePanel('responders'),
    openMassAlertTools: () => setActivePanel('mass-alert'),
  })

  if (!municipality) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <MunicipalAdminRoute>
      <div className="flex flex-col h-screen">
        <AdminTopBar />
        <QuickActionsBar />

        <div className="relative flex-1">
          <MunicipalMapView />

          {/* Pending Queue Panel (Left) */}
          <SlidingPanel
            isOpen={activePanel === 'pending'}
            position="left"
            onClose={() => closePanel('pending')}
          >
            <h2 className="text-xl font-bold mb-4">Pending Reports</h2>
            <p className="text-gray-600">
              {pendingReports?.length || 0} reports awaiting verification
            </p>
            {/* Report list will be added in Layer 2 */}
            <p className="text-sm text-gray-400">
              Report verification workflow coming in Layer 2
            </p>
          </SlidingPanel>
        </div>
      </div>
    </MunicipalAdminRoute>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/municipal-admin/components/MunicipalAdminDashboard.tsx
git commit -m "feat(municipal-admin): add MunicipalAdminDashboard component"
```

---

### Task 22: Add Municipal Admin Route

**Files:**
- Modify: `src/app/routes.tsx`

- [ ] **Step 1: Add municipal-admin import to routes.tsx**

Add at top of file with other imports:

```typescript
import { MunicipalAdminDashboard } from '@/domains/municipal-admin/components/MunicipalAdminDashboard'
```

- [ ] **Step 2: Add municipal-admin route**

Add in routes array (after privacy-policy route):

```typescript
{
  path: 'municipal-admin',
  element: <MunicipalAdminDashboard />,
},
```

- [ ] **Step 3: Test route navigation**

Run: `npm run dev`
Navigate to http://localhost:5173/municipal-admin
Expected: Redirects to /login if not authenticated

- [ ] **Step 4: Commit**

```bash
git add src/app/routes.tsx
git commit -m "feat(routes): add municipal-admin route"
```

---

## Final Tasks: Testing & Verification

### Task 23: Create E2E Test for Login Flow

**Files:**
- Create: `tests/e2e/municipal-admin-auth.spec.ts`

- [ ] **Step 1: Create E2E test**

```typescript
// tests/e2e/municipal-admin-auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Municipal Admin Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to municipal admin route
    await page.goto('/municipal-admin')
  })

  test('should redirect to login when not authenticated', async ({ page }) => {
    await expect(page).toHaveURL('/login')
  })

  test('should show dashboard after login', async ({ page }) => {
    // Navigate to login
    await page.goto('/login')

    // Enter credentials (use test municipal admin credentials)
    await page.fill('input[type="email"]', 'daet-admin@test.gov.ph')
    await page.fill('input[type="password"]', 'test-password-123')

    // Submit login
    await page.click('button[type="submit"]')

    // Wait for navigation to dashboard
    await expect(page).toHaveURL('/municipal-admin', { timeout: 5000 })

    // Verify municipality is displayed
    await expect(page.locator('text')).toContainText('MUNICIPAL ADMIN')
    await expect(page.locator('text')).toContainText('DAET')
  })

  test('should show quick actions bar with counts', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('input[type="email"]', 'daet-admin@test.gov.ph')
    await page.fill('input[type="password"]', 'test-password-123')
    await page.click('button[type="submit"]')

    // Wait for dashboard
    await expect(page).toHaveURL('/municipal-admin')

    // Verify quick actions bar
    const quickActions = page.locator('.quick-actions-bar')
    await expect(quickActions).toBeVisible()

    // Verify buttons are present
    await expect(quickActions.locator('text=Pending')).toBeVisible()
    await expect(quickActions.locator('text=Available')).toBeVisible()
    await expect(quickActions.locator('text=Urgent')).toBeVisible()
    await expect(quickActions.locator('text=Mass Alert')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run E2E test**

Run: `npm run test:e2e municipal-admin-auth`
Expected: Tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/municipal-admin-auth.spec.ts
git commit -m "test(e2e): add municipal admin authentication E2E tests"
```

---

### Task 24: Run Type Check and Lint

- [ ] **Step 1: Run TypeScript type check**

Run: `npm run typecheck`
Expected: No errors (fix any errors that appear)

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No errors (fix any errors that appear)

- [ ] **Step 3: Fix any issues and commit**

```bash
git add -A
git commit -m "chore: fix typecheck and lint issues"
```

---

### Task 25: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Check test coverage**

Run: `npm run test -- --coverage`
Expected: Coverage report generated

- [ ] **Step 3: Commit any test fixes**

```bash
git add -A
git commit -m "test: fix failing tests and improve coverage"
```

---

## Layer 1 Quality Gate Verification

Before proceeding to Layer 2, verify all Layer 1 quality gates pass:

- [ ] **Municipal admin can log in with email/password** ✅ (Task 23)
- [ ] **Custom claims with municipality are set on login** ✅ (Task 2)
- [ ] **Firestore rules enforce municipality filtering** ✅ (Task 3)
- [ ] **Map displays municipal boundaries (admin's highlighted)** ✅ (Task 9, 10)
- [ ] **TanStack Query hooks return municipality-filtered data** ✅ (Task 15-17)
- [ ] **Real-time subscriptions work (onSnapshot → UI update)** ✅ (Task 17)
- [ ] **Sliding panels work smoothly (no blocking of map)** ✅ (Task 6, 20)
- [ ] **Unit tests pass (>80% coverage)** ✅ (Tasks throughout)
- [ ] **TypeScript compiles without errors** ✅ (Task 24)
- [ ] **E2E test for login → map flow passes** ✅ (Task 23)

---

## Summary

**Total Tasks:** 25
**Estimated Duration:** 4 weeks

**Files Created:** 20+
**Files Modified:** 3

**Deliverable:** Working municipal admin interface with:
- Secure authentication with municipality-based access control
- Map displaying municipal boundaries
- Real-time data fetching with TanStack Query
- Map-centric layout with sliding panels
- Full test coverage

**Next Steps:** After Layer 1 is complete and all quality gates pass, proceed to Layer 2 implementation plan (10 subsystems over 8 weeks).
