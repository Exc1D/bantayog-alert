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

  useEffect(() => {
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(CHANNEL_NAME)
      bcRef.current = bc
      bc.onmessage = (ev: MessageEvent<SyncMessage>) => {
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
        const msg = JSON.parse(e.newValue) as {
          data: SyncMessage
          timestamp: number
        }
        if (Date.now() - msg.timestamp > MESSAGE_TTL_MS) return
        listenersRef.current.forEach((fn) => {
          fn(msg.data)
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
    if (bcRef.current) {
      bcRef.current.postMessage(msg)
      return
    }
    // Fallback to localStorage when BroadcastChannel is unavailable
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
