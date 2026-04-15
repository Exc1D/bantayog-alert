# Plan 4 — Listener-Fed TanStack Query Cache

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Adopt the listener-fed cache pattern from spec §4.2 / §7.4 across all Firestore-backed hooks. `onSnapshot` pushes into TanStack Query's cache; no polling, no double-reads.

**Architecture:** Each list/detail hook has two parts: (1) a `useQuery` call with `staleTime: Infinity` for cache access + initial fetch, (2) a `useEffect` that runs `onSnapshot` and calls `queryClient.setQueryData`. Pattern lives in a small helper `useListenerFedQuery`.

**Tech Stack:** TanStack Query v5, Firebase v9. Depends on Plan 3 (repositories).

---

## Prerequisites

- Plan 3 merged (repositories with `subscribeTo*` methods).
- TanStack Query `QueryClientProvider` already wired in `src/app/App.tsx`.

## File Map

| File | Responsibility |
|---|---|
| `src/shared/hooks/useListenerFedQuery.ts` *(new)* | Generic helper |
| `src/features/alerts/hooks/useAlerts.ts` | Migrate to helper |
| `src/features/feed/hooks/useFeedReports.ts` | Migrate |
| `src/domains/municipal-admin/hooks/usePendingReports.ts` | Migrate |
| `src/domains/responder/hooks/useDispatches.ts` | Migrate |
| `src/domains/citizen/hooks/useMyReports.ts` | Migrate (create if missing) |

---

## Task 1: Write the helper

- [ ] **Step 1: Failing test** at `src/shared/hooks/__tests__/useListenerFedQuery.test.tsx`:

```typescript
// Assert: subscribe fn called with resolvedKey args; cache populated on emit; unsubscribed on unmount.
```

- [ ] **Step 2: Implement**

```typescript
// src/shared/hooks/useListenerFedQuery.ts
import { useEffect } from 'react'
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'

type Unsubscribe = () => void

interface Options<T> {
  queryKey: QueryKey
  initialFetch: () => Promise<T>
  subscribe: (onData: (data: T) => void, onError: (err: Error) => void) => Unsubscribe
  enabled?: boolean
}

export function useListenerFedQuery<T>({ queryKey, initialFetch, subscribe, enabled = true }: Options<T>) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!enabled) return
    const unsub = subscribe(
      (data) => qc.setQueryData(queryKey, data),
      (err) => console.error('[LISTENER_ERROR]', queryKey, err)
    )
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, JSON.stringify(queryKey)])

  return useQuery<T>({
    queryKey,
    queryFn: initialFetch,
    staleTime: Infinity,
    enabled,
  })
}
```

- [ ] **Step 3:** Test + commit.

---

## Task 2: Migrate `useAlerts`

Currently uses raw `onSnapshot` + `useState` (per 2026-04-12 learnings). Port to helper.

- [ ] **Step 1: Keep existing tests green** — hook public API unchanged (`{ alerts, isLoading, error, refetch }`).

- [ ] **Step 2: Replace internals**

```typescript
export function useAlerts({ municipality, role }: { municipality?: string; role?: string }) {
  const { data = [], isLoading, error } = useListenerFedQuery<Alert[]>({
    queryKey: ['alerts', { municipality, role }],
    initialFetch: () => alertRepository.getForUser({ municipality, role }),
    subscribe: (onData, onError) => alertRepository.subscribeForUser({ municipality, role }, onData, onError),
  })
  return { alerts: data, isLoading, error: error as Error | null, refetch: () => {} }
}
```

- [ ] **Step 3:** IndexedDB cache fallback (from 2026-04-12 learning) — move into `alertRepository.subscribeForUser`'s error path.

- [ ] **Step 4:** All 13 existing `useAlerts` tests pass. Commit.

---

## Task 3: Migrate `useFeedReports`, `usePendingReports`, `useDispatches`, `useMyReports`

For each:

- [ ] **Step 1:** Add repository method if missing (`subscribeToX`).
- [ ] **Step 2:** Rewrite hook to call `useListenerFedQuery`.
- [ ] **Step 3:** Existing tests pass (update mocks from raw `onSnapshot` to repo subscribe mock).
- [ ] **Step 4:** Commit each hook separately.

---

## Task 4: Remove any `refetchInterval` leftovers

- [ ] **Step 1:** `grep -rn "refetchInterval" src/` — must be empty.
- [ ] **Step 2:** If any found, remove + add listener. Commit.

---

## Task 5: Verification

- [ ] Inspect Firestore usage console — read count in dev should NOT scale with time-open (pure listener pushes, no polls).
- [ ] Update learnings.

## Self-Review

Spec §4.2, §7.4 covered. Every Firestore-backed hook uses helper. No polling.
