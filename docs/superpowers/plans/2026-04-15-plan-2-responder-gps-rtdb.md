# Plan 2 — Responder GPS → Realtime Database

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Move responder GPS writes from Firestore `responders/{uid}.location` to Firebase Realtime Database at `responder_locations/{uid}`, 30-second interval while on active dispatch. Admin/agency map reads via RTDB listener.

**Architecture:** New `LocationTracker` class wraps RTDB SDK; activated by `useActiveDispatch` hook. Firestore `responders` doc retains profile + availability only. Cost savings per spec §5.4 (~7x at 30s intervals).

**Tech Stack:** `firebase/database` (v9 modular), `useGeolocation` hook, RTDB rules.

---

## File Map

| File | Responsibility |
|---|---|
| `src/app/firebase/config.ts` | Export `rtdb` instance |
| `src/infrastructure/rtdb/LocationTracker.ts` *(new)* | Start/stop GPS writes |
| `src/infrastructure/rtdb/useResponderLocation.ts` *(new)* | Hook: listen to one responder's location |
| `src/infrastructure/rtdb/useActiveResponderLocations.ts` *(new)* | Hook: listen to all on-dispatch responders (muni-scoped) |
| `src/domains/responder/hooks/useDispatches.ts` | Trigger tracker on active dispatch |
| `database.rules.json` *(new)* | RTDB security rules |
| `firebase.json` | Register RTDB rules file |

---

## Task 1: RTDB setup + config

- [ ] **Step 1:** Enable RTDB in Firebase console for dev/staging/prod projects (user action).

- [ ] **Step 2: Update `src/app/firebase/config.ts`**

```typescript
import { getDatabase } from 'firebase/database'
export const rtdb = getDatabase(app)
```

- [ ] **Step 3: Create `database.rules.json`**

```json
{
  "rules": {
    "responder_locations": {
      "$uid": {
        ".read": "auth != null && (auth.uid == $uid || auth.token.role == 'municipal_admin' || auth.token.role == 'agency_admin' || auth.token.role == 'provincial_superadmin')",
        ".write": "auth != null && auth.uid == $uid && auth.token.role == 'responder'",
        ".validate": "newData.hasChildren(['lat','lng','timestamp'])",
        "lat": { ".validate": "newData.isNumber() && newData.val() >= 4.5 && newData.val() <= 21.5" },
        "lng": { ".validate": "newData.isNumber() && newData.val() >= 116 && newData.val() <= 127" },
        "timestamp": { ".validate": "newData.isNumber()" }
      }
    }
  }
}
```

- [ ] **Step 4: Register in `firebase.json`**

```json
"database": { "rules": "database.rules.json" }
```

- [ ] **Step 5: Deploy rules to dev**

```bash
firebase deploy --only database --project bantayog-alert-dev
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(rtdb): initialize Realtime Database config + rules"
```

---

## Task 2: `LocationTracker` — write path

**Files:** Create `src/infrastructure/rtdb/LocationTracker.ts`

- [ ] **Step 1: Failing test** at `__tests__/LocationTracker.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocationTracker } from '../LocationTracker'

vi.mock('firebase/database', () => ({
  ref: vi.fn(() => ({ _ref: 'responder_locations/u1' })),
  set: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/app/firebase/config', () => ({ rtdb: {} }))

describe('LocationTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(global.navigator as any).geolocation = {
      watchPosition: vi.fn((cb) => { cb({ coords: { latitude: 14.1, longitude: 122.9, accuracy: 10, heading: null, speed: null }, timestamp: Date.now() }); return 1 }),
      clearWatch: vi.fn(),
    }
  })

  it('starts writing at 30s interval', async () => {
    const { set } = await import('firebase/database')
    const t = new LocationTracker('u1', 'dispatch-1')
    t.start()
    vi.advanceTimersByTime(30_000)
    await Promise.resolve()
    expect(set).toHaveBeenCalled()
    t.stop()
  })

  it('stops writing on stop()', () => {
    const t = new LocationTracker('u1', 'dispatch-1')
    t.start(); t.stop()
    expect(global.navigator.geolocation.clearWatch).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Implement**

```typescript
// src/infrastructure/rtdb/LocationTracker.ts
import { ref, set } from 'firebase/database'
import { rtdb } from '@/app/firebase/config'

const WRITE_INTERVAL_MS = 30_000

export class LocationTracker {
  private watchId: number | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private lastPosition: GeolocationPosition | null = null

  constructor(private readonly uid: string, private readonly dispatchId: string) {}

  start(): void {
    if (this.watchId != null) return
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => { this.lastPosition = pos },
      (err) => console.error('[LOCATION_TRACKER]', err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
    this.intervalId = setInterval(() => this.flush(), WRITE_INTERVAL_MS)
    this.flush()
  }

  stop(): void {
    if (this.watchId != null) { navigator.geolocation.clearWatch(this.watchId); this.watchId = null }
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null }
  }

  private async flush(): Promise<void> {
    if (!this.lastPosition) return
    const { latitude, longitude, accuracy, heading, speed } = this.lastPosition.coords
    try {
      await set(ref(rtdb, `responder_locations/${this.uid}`), {
        lat: latitude, lng: longitude, accuracy, heading, speed,
        timestamp: Date.now(), dispatchId: this.dispatchId,
      })
    } catch (err) {
      console.error('[LOCATION_TRACKER_WRITE]', err)
    }
  }
}
```

- [ ] **Step 3:** Tests pass, commit.

---

## Task 3: Wire tracker into responder dispatch flow

**Files:** Modify `src/domains/responder/hooks/useDispatches.ts` (or create `useLocationTracking.ts`)

- [ ] **Step 1: Failing test** — when active dispatch present, tracker starts; when none, tracker stops.

- [ ] **Step 2: Add hook**

```typescript
// src/domains/responder/hooks/useLocationTracking.ts
import { useEffect, useRef } from 'react'
import { LocationTracker } from '@/infrastructure/rtdb/LocationTracker'

export function useLocationTracking(uid: string | undefined, activeDispatchId: string | null) {
  const trackerRef = useRef<LocationTracker | null>(null)
  useEffect(() => {
    if (!uid || !activeDispatchId) {
      trackerRef.current?.stop(); trackerRef.current = null
      return
    }
    trackerRef.current = new LocationTracker(uid, activeDispatchId)
    trackerRef.current.start()
    return () => { trackerRef.current?.stop(); trackerRef.current = null }
  }, [uid, activeDispatchId])
}
```

- [ ] **Step 3:** Call `useLocationTracking(uid, activeDispatch?.id ?? null)` in responder layout.

- [ ] **Step 4:** Commit.

---

## Task 4: Read hook — `useResponderLocation`

**Files:** Create `src/infrastructure/rtdb/useResponderLocation.ts`

- [ ] **Step 1: Failing test** — subscribes on mount, unsubscribes on unmount, updates state.

- [ ] **Step 2: Implement**

```typescript
import { useEffect, useState } from 'react'
import { onValue, ref, off } from 'firebase/database'
import { rtdb } from '@/app/firebase/config'

export interface ResponderLocation {
  lat: number; lng: number; accuracy?: number; heading?: number | null
  speed?: number | null; timestamp: number; dispatchId: string
}

export function useResponderLocation(uid: string | undefined): ResponderLocation | null {
  const [loc, setLoc] = useState<ResponderLocation | null>(null)
  useEffect(() => {
    if (!uid) return
    const r = ref(rtdb, `responder_locations/${uid}`)
    const unsub = onValue(r, (snap) => setLoc(snap.val() ?? null))
    return () => off(r, 'value', unsub)
  }, [uid])
  return loc
}
```

- [ ] **Step 3:** Test + commit.

---

## Task 5: Multi-responder admin view

**Files:** Create `src/infrastructure/rtdb/useActiveResponderLocations.ts`

- [ ] **Step 1: Failing test** — subscribes to root, filters by uids passed in.

- [ ] **Step 2: Implement** (hook takes array of uids, returns map)

```typescript
export function useActiveResponderLocations(uids: string[]): Record<string, ResponderLocation> {
  const [map, setMap] = useState<Record<string, ResponderLocation>>({})
  useEffect(() => {
    if (uids.length === 0) return
    const unsubs = uids.map(uid => {
      const r = ref(rtdb, `responder_locations/${uid}`)
      return onValue(r, (snap) => {
        setMap(prev => ({ ...prev, [uid]: snap.val() }))
      })
    })
    return () => unsubs.forEach(u => u())
  }, [uids.join(',')])
  return map
}
```

- [ ] **Step 3:** Wire into admin `MapView` — render markers from this hook.

- [ ] **Step 4:** Commit.

---

## Task 6: Remove GPS from Firestore `responders` doc

- [ ] **Step 1:** Grep for any Firestore writes to `responders/{uid}` touching `lat/lng/location`. Delete them.
- [ ] **Step 2:** Update Firestore rules — `responders` doc does not accept location fields.
- [ ] **Step 3:** Migration note: existing `responders.*.location` fields ignored; RTDB becomes source of truth on next dispatch.
- [ ] **Step 4:** Commit.

```bash
git commit -m "refactor(responder): remove GPS from Firestore — RTDB is source of truth (Finding #6)"
```

---

## Task 7: Final verification

- [ ] Emulator: 5 simulated responders writing, 2 admins reading. Confirm cost model: writes ≤ bandwidth budget.
- [ ] Deploy to staging. Monitor RTDB usage dashboard 48h.
- [ ] Update `docs/progress.md` + `docs/learnings.md`.

## Self-Review

Spec §5.4 — Tasks 2–5. RTDB rules — Task 1. Firestore cleanup — Task 6. No placeholders.
