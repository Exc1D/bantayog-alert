# Learnings

Generalized lessons applicable to all sessions. Session-specific incidents are stripped; the patterns remain.

---

## Process: Trust-But-Verify

**Never trust间接 evidence of work.** Commit messages lie. Subagent summaries describe intent, not result. Test passes don't prove the change was exercised.

- After any subagent dispatch or context compaction, re-read actual files before assuming progress
- For new behavior: write failing test, observe red, then implement
- Run tests and read ALL output — don't assume they passed correctly

---

## Security: Access Control Filters

**For filters where absence of value means "deny", never use a fallback that produces a permissive query.** Always guard with explicit error or early return.

```typescript
// WRONG — silent exposure
const municipality = user.municipality ?? 'none' // queries with impossible value

// CORRECT — explicit deny
if (!user.municipality) {
  setAuthError('AUTH_EXPIRED')
  return
}
```

---

## Security: Schema Normalization

**When normalizing a field, update BOTH read and write paths.** A query that reads `status` returns zero documents if `updateStatus` only writes `responderStatus`.

- Reads use normalized fields
- Writes are dual-field for migration compatibility

---

## Error Handling: Firestore Errors

**Firestore errors have stable `err.code` strings** (`permission-denied`, `deadline-exceeded`, `already-exists`). String-matching `err.message` breaks when messages change or localize. Always check `err.code` first.

**In disaster systems, silent failures are deadly.** Every failure mode must surface to user or log with structured error ID.

---

## React: useEffect Deps and Infinite Loops

**Render-body ref assignments can create infinite loops; useEffect assignments break the chain.**

- Putting `syncFnRef.current = syncQueue` in the render body fires synchronously before effects
- Moving it to `useEffect(() => { syncFnRef.current = syncQueue }, [syncQueue])` fires after render — guard (`syncInProgressRef`) is already set when the callback runs

**Rule:** When adding deps to a `useCallback` that is itself a dep of a `useEffect`, check if the render-body assignment pattern creates a loop. Move ref assignments to effects.

---

## React: Ref + State Synchronization

`useRef(initialState)` initializes once; `ref.current` never updates when initialState changes. To keep them in sync:

```typescript
// WRONG — stale ref
const latestAlertsRef = useRef(alerts) // captures initial state only

// CORRECT — separate effect syncs them
const latestAlertsRef = useRef(alerts)
useEffect(() => { latestAlertsRef.current = alerts }, [alerts])
```

---

## React: Prop vs Internal State for Critical Data

**When a component depends on external data (geolocation, auth), either fetch it internally or make it a required prop.** Optional props for critical data = silent failure.

```typescript
// Fetch internally — resilient
const geo = useGeolocation()
const resolved = userLocation ?? geo.coordinates ?? undefined

// OR require it — explicit, caught at compile time
interface Props { userLocation: Coordinates; }
```

---

## Testing: vi.hoisted for Mock Factories

`vi.hoisted()` runs before module-level declarations. All mock functions must be defined INSIDE the callback:

```typescript
// WRONG — ReferenceError
const mock = vi.fn()
vi.hoisted(() => ({ mock })) // mock not yet declared

// CORRECT
const { mockFn } = vi.hoisted(() => ({
  mockFn: vi.fn().mockResolvedValue([])
}))
vi.mock('../../service', () => ({ service: { fn: mockFn } }))
```

---

## Testing: requestAnimationFrame in Vitest

`vi.useFakeTimers()` does not reliably auto-spy RAF in jsdom. Capture the callback reference and invoke it directly:

```typescript
const savedRAF = vi.hoisted(() => ({
  current: null as ((cb: FrameRequestCallback) => number) | null,
}))
vi.stubGlobal('requestAnimationFrame', (cb) => {
  savedRAF.current = cb
  return ++id
})
// In test:
if (savedRAF.current) savedRAF.current(performance.now())
```

---

## Testing: Firebase Mocks for Integration Tests

When a component uses Firestore contexts, mocks are needed at module level:

```typescript
vi.mock('@/app/firebase/config', () => ({ db: {}, auth: {} }))
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(), query: vi.fn(), where: vi.fn(),
  onSnapshot: vi.fn(), getDocs: vi.fn(),
}))
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn((cb) => { cb(null); return vi.fn() }),
}))
```

---

## Firestore Rules: Function Arguments

**In Firestore Rules DSL, function parameters are silently discarded if unused.** `isResponderOwner(opsId)` compiles fine — `opsId` is ignored. This is a security code smell: always match call sites to actual function signatures.

---

## Code: Catch Parameters

Always use `catch (err: unknown)` in TypeScript strict mode. The `unknown` type forces you to narrow before using.

```typescript
// WRONG
catch (err) // implicitly any in non-strict, silent in strict

// CORRECT
catch (err: unknown) {
  if (err instanceof Error) console.error(err.message)
}
```

---

## Code: Navigator Clipboard in Vitest

`navigator.clipboard` is an inherited getter in happy-dom — not an own property. Spying requires defining it as an own property:

```typescript
// In beforeEach — create mock with own clipboard property
const mockNav = Object.create(Object.getPrototypeOf(navigator))
Object.assign(mockNav, navigator)
mockNav.clipboard = { writeText: vi.fn() }
global.navigator = mockNav

// In test — direct assignment also works
;(navigator as any).clipboard = { writeText: mockWriteText }
```

`navigator.share` IS an own property — direct `vi.fn()` spy works reliably.

---

## General: One Concern Per Branch

- One concern per conversation, one per branch, one per PR
- Feature freezes for structural changes (folder restructures, schema migrations, rule changes)
- Never bundle unrelated fixes "since we're here"

## General: Risky Changes Require Overnight Soak

Firestore rules, DB indexes, Cloud Function deploys, and auth flow changes have blast radius too large for same-session deploy. Minimum: dev emulator → staging overnight → explicit prod approval.

Always include rollback command in PR description before deploying.

---

## General: Short Answers for Simple Questions

No headers, sections, or insights blocks when a sentence suffices.
