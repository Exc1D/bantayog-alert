import { createContext, useContext, useEffect, useRef, useCallback, type ReactNode } from 'react'
import type { WindowSyncMessage } from '../stores/commandCenterStore'

interface WindowSyncContextValue {
  sendSync: (msg: WindowSyncMessage) => void
  subscribe: (fn: (msg: WindowSyncMessage) => void) => () => void
}

const WindowSyncContext = createContext<WindowSyncContextValue | null>(null)

const CHANNEL_NAME = 'bantayog-admin-sync'
const STORAGE_KEY = 'bantayog-sync-fallback'
const MESSAGE_TTL_MS = 5000

const VALID_MESSAGE_TYPES = new Set(['select:report', 'select:municipality', 'triage:action'])
const VALID_SYNC_SOURCES = new Set(['dashboard', 'map'])
const VALID_TRIAGE_ACTIONS = new Set(['verified', 'rejected', 'dispatched'])

type SyncMessageRecord = Record<string, unknown>

function isRecord(data: unknown): data is SyncMessageRecord {
  return typeof data === 'object' && data !== null
}

function hasOptionalStringId(msg: SyncMessageRecord): boolean {
  return msg.id === undefined || typeof msg.id === 'string'
}

function hasValidSource(msg: SyncMessageRecord): boolean {
  return typeof msg.source === 'string' && VALID_SYNC_SOURCES.has(msg.source)
}

function isSelectReportMessage(msg: SyncMessageRecord): boolean {
  return typeof msg.reportId === 'string' && hasValidSource(msg)
}

function isSelectMunicipalityMessage(msg: SyncMessageRecord): boolean {
  return typeof msg.municipalityId === 'string' && hasValidSource(msg)
}

function isTriageActionMessage(msg: SyncMessageRecord): boolean {
  return (
    typeof msg.reportId === 'string' &&
    typeof msg.action === 'string' &&
    VALID_TRIAGE_ACTIONS.has(msg.action)
  )
}

function isValidSyncMessage(data: unknown): data is WindowSyncMessage {
  if (!isRecord(data)) return false

  const type = data.type
  if (typeof type !== 'string' || !VALID_MESSAGE_TYPES.has(type)) return false
  if (!hasOptionalStringId(data)) return false

  switch (type) {
    case 'select:report':
      return isSelectReportMessage(data)
    case 'select:municipality':
      return isSelectMunicipalityMessage(data)
    case 'triage:action':
      return isTriageActionMessage(data)
    default:
      return false
  }
}

export function WindowSyncProvider({ children }: { children: ReactNode }) {
  const bcRef = useRef<BroadcastChannel | null>(null)
  const listenersRef = useRef<Set<(msg: WindowSyncMessage) => void>>(new Set())
  const seenIdsRef = useRef<Map<string, number>>(new Map())

  const isDuplicate = useCallback((msg: WindowSyncMessage): boolean => {
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
      bc.onmessage = (ev: MessageEvent<unknown>) => {
        const data = ev.data
        if (!isValidSyncMessage(data)) return
        if (isDuplicate(data)) return
        listenersRef.current.forEach((fn) => {
          fn(data)
        })
      }
    } catch {
      // BroadcastChannel not supported — use localStorage fallback
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        const parsed = JSON.parse(e.newValue) as {
          data: unknown
          timestamp: unknown
        }
        const data = parsed.data
        if (!isValidSyncMessage(data)) return
        const timestamp = parsed.timestamp
        if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return
        if (Date.now() - timestamp > MESSAGE_TTL_MS) return
        if (isDuplicate(data)) return
        listenersRef.current.forEach((fn) => {
          fn(data)
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
  }, [isDuplicate])

  const sendSync = useCallback(
    (msg: WindowSyncMessage) => {
      const withId: WindowSyncMessage =
        msg.id !== undefined ? msg : { ...msg, id: crypto.randomUUID() }
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

  const subscribe = useCallback((fn: (msg: WindowSyncMessage) => void) => {
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
