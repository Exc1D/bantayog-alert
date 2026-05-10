import { createContext, useContext, useEffect, useRef, useCallback, type ReactNode } from 'react'
import type { SyncMessage } from '../stores/commandCenterStore'

interface WindowSyncContextValue {
  sendSync: (msg: SyncMessage) => void
  subscribe: (fn: (msg: SyncMessage) => void) => () => void
}

const WindowSyncContext = createContext<WindowSyncContextValue | null>(null)

const CHANNEL_NAME = 'bantayog-admin-sync'
const STORAGE_KEY = 'bantayog-sync-fallback'
const MESSAGE_TTL_MS = 5000

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Validate untrusted input from BroadcastChannel / localStorage before
// forwarding to subscribers. Another tab (or a stale storage entry) could
// post arbitrary JSON; subscribers assume the SyncMessage shape.
function isValidSyncMessage(value: unknown): value is SyncMessage {
  if (!isObject(value)) return false
  switch (value.type) {
    case 'select:report':
      return (
        typeof value.reportId === 'string' &&
        (value.source === 'dashboard' || value.source === 'map')
      )
    case 'select:municipality':
      return (
        typeof value.municipalityId === 'string' &&
        (value.source === 'dashboard' || value.source === 'map')
      )
    case 'triage:action':
      return (
        typeof value.reportId === 'string' &&
        (value.action === 'verified' ||
          value.action === 'rejected' ||
          value.action === 'dispatched')
      )
    case 'triage:bulk-action':
      return (
        Array.isArray(value.reportIds) &&
        value.reportIds.every((id) => typeof id === 'string') &&
        (value.action === 'verified' || value.action === 'rejected')
      )
    default:
      return false
  }
}

export function WindowSyncProvider({ children }: { children: ReactNode }) {
  const bcRef = useRef<BroadcastChannel | null>(null)
  const listenersRef = useRef<Set<(msg: SyncMessage) => void>>(new Set())

  useEffect(() => {
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(CHANNEL_NAME)
      bcRef.current = bc
      bc.onmessage = (ev: MessageEvent<unknown>) => {
        if (!isValidSyncMessage(ev.data)) return
        const msg = ev.data
        listenersRef.current.forEach((fn) => {
          fn(msg)
        })
      }
    } catch {
      // BroadcastChannel not supported — use localStorage fallback
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        const parsed: unknown = JSON.parse(e.newValue)
        if (!isObject(parsed)) return
        if (typeof parsed.timestamp !== 'number') return
        if (Date.now() - parsed.timestamp > MESSAGE_TTL_MS) return
        if (!isValidSyncMessage(parsed.data)) return
        const msg = parsed.data
        listenersRef.current.forEach((fn) => {
          fn(msg)
        })
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener('storage', onStorage)
      bc?.close()
    }
  }, [])

  const sendSync = useCallback((msg: SyncMessage) => {
    bcRef.current?.postMessage(msg)
    // Always write to localStorage as fallback
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: msg, timestamp: Date.now() }))
    } catch {
      /* ignore */
    }
  }, [])

  const subscribe = useCallback((fn: (msg: SyncMessage) => void) => {
    listenersRef.current.add(fn)
    return () => {
      listenersRef.current.delete(fn)
    }
  }, [])

  return (
    <WindowSyncContext.Provider value={{ sendSync, subscribe }}>
      {children}
    </WindowSyncContext.Provider>
  )
}

export function useWindowSyncContext() {
  const ctx = useContext(WindowSyncContext)
  if (!ctx) throw new Error('useWindowSyncContext must be used within WindowSyncProvider')
  return ctx
}
