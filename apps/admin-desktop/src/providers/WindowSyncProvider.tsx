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

export function WindowSyncProvider({ children }: { children: ReactNode }) {
  const bcRef = useRef<BroadcastChannel | null>(null)
  const listenersRef = useRef<Set<(msg: SyncMessage) => void>>(new Set())
  const seenIdsRef = useRef<Map<string, number>>(new Map())

  const isDuplicate = useCallback((msg: SyncMessage): boolean => {
    if (msg.id === undefined) return false
    const now = Date.now()
    // Prune expired entries first so the map cannot grow unbounded.
    for (const [seenId, ts] of seenIdsRef.current) {
      if (now - ts > MESSAGE_TTL_MS) {
        seenIdsRef.current.delete(seenId)
      }
    }
    if (seenIdsRef.current.has(msg.id)) return true
    seenIdsRef.current.set(msg.id, now)
    return false
  }, [])

  useEffect(() => {
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(CHANNEL_NAME)
      bcRef.current = bc
      bc.onmessage = (ev: MessageEvent<SyncMessage>) => {
        if (isDuplicate(ev.data)) return
        listenersRef.current.forEach((fn) => {
          fn(ev.data)
        })
      }
    } catch {
      // BroadcastChannel not supported — use localStorage fallback
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        const parsed = JSON.parse(e.newValue) as {
          data: SyncMessage
          timestamp: number
        }
        if (Date.now() - parsed.timestamp > MESSAGE_TTL_MS) return
        if (isDuplicate(parsed.data)) return
        listenersRef.current.forEach((fn) => {
          fn(parsed.data)
        })
      } catch {
        /* malformed payload — ignore */
      }
    }
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener('storage', onStorage)
      bc?.close()
    }
  }, [])

  const sendSync = useCallback(
    (msg: SyncMessage) => {
      const withId: SyncMessage = msg.id !== undefined ? msg : { ...msg, id: crypto.randomUUID() }
      // Record locally so an echo back from BC/storage is ignored.
      isDuplicate(withId)
      if (bcRef.current) {
        bcRef.current.postMessage(withId)
        return
      }
      // Fallback to localStorage when BroadcastChannel is unavailable
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: withId, timestamp: Date.now() }))
      } catch {
        /* storage quota — ignore */
      }
    },
    [isDuplicate],
  )

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
