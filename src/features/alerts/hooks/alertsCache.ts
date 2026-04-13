/**
 * Alerts Cache Service
 *
 * Thin IndexedDB layer for persisting the last known alert set.
 * Used as a fallback when Firestore onSnapshot fires an error — so the
 * UI can still show the most recently fetched data instead of a blank screen.
 *
 * Uses raw IndexedDB API (consistent with shared/services/indexedDB.ts).
 */

const DB_NAME = 'bantayog-alerts-cache'
const DB_VERSION = 1
const STORE_NAME = 'alerts'

/** Persisted alert entry — Alert flattened with id as keyPath */
interface CachedAlert {
  id: string
  /** Flattened alert fields for safe JSON round-trip */
  alert: string // JSON stringified Alert
}

let db: IDBDatabase | null = null

async function getDB(): Promise<IDBDatabase> {
  if (db) return db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(new Error(`Failed to open alerts cache DB: ${req.error?.message}`))
    req.onsuccess = () => {
      db = req.result
      resolve(db)
    }
    req.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

/**
 * Persist an array of alerts to IndexedDB.
 *
 * Fire-and-forget — errors are swallowed so caching never blocks the
 * snapshot callback. Callers should not await this unless they need to
 * confirm the cache was written.
 */
export async function cacheAlerts(alerts: import('@/shared/types/firestore.types').Alert[]): Promise<void> {
  try {
    const database = await getDB()
    const tx = database.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    // Clear existing entries then bulk-write fresh ones
    store.clear()
    for (const alert of alerts) {
      store.put({ id: alert.id, alert: JSON.stringify(alert) } satisfies CachedAlert)
    }

    return new Promise((resolve, reject) => {
      tx.onerror = () => reject(new Error(`cacheAlerts transaction error: ${tx.error?.message}`))
      tx.oncomplete = () => resolve()
    })
  } catch (err: unknown) {
    // Silently ignore — cache failures must never break the snapshot path
    console.warn('[alertsCache] Failed to persist alerts:', err instanceof Error ? err.message : err)
  }
}

/**
 * Load all cached alerts from IndexedDB.
 *
 * @returns Alert array (may be empty)
 */
export async function loadCachedAlerts(): Promise<import('@/shared/types/firestore.types').Alert[]> {
  try {
    const database = await getDB()
    const tx = database.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => {
        const alerts = req.result.map((entry: CachedAlert) => {
          try {
            return JSON.parse(entry.alert)
          } catch {
            return null
          }
        }).filter(Boolean)
        resolve(alerts as import('@/shared/types/firestore.types').Alert[])
      }
      req.onerror = () =>
        reject(new Error(`loadCachedAlerts read error: ${req.error?.message}`))
    })
  } catch (err: unknown) {
    console.warn('[alertsCache] Failed to load cached alerts:', err instanceof Error ? err.message : err)
    return []
  }
}
