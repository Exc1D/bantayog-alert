import { QueryClient } from '@tanstack/react-query'
import { persistQueryClient, persistQueryClientRestore, type Persister, type PersistedClient } from '@tanstack/query-persist-client-core'

const DB_NAME = 'bantayog-query-cache'
const STORE_NAME = 'persist'
const KEY = 'query-cache'
const MAX_CACHE_SIZE_BYTES = 2 * 1024 * 1024 // 2MB limit

/** Query keys that contain sensitive data and should NOT be persisted. */
const SENSITIVE_QUERY_PREFIXES = [
  ['users'],       // User profiles with PII
  ['responders'],  // Responder data with location
  ['report_private'], // Private report data
] as const

export function isSensitiveQueryKey(key: unknown): boolean {
  if (!Array.isArray(key)) return false
  const first = key[0]
  return SENSITIVE_QUERY_PREFIXES.some(([prefix]) => first === prefix)
}

export function stripSensitiveQueries(client: PersistedClient): PersistedClient {
  const filteredQueries = client.clientState.queries.filter(
    (query) => !isSensitiveQueryKey(query.queryKey)
  )
  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: filteredQueries,
    },
  }
}

function estimateSize(client: PersistedClient): number {
  return new Blob([JSON.stringify(client)]).size
}

function requestError(error: DOMException | null): Error {
  return new Error(String(error))
}

function ensurePersistStore(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    db.createObjectStore(STORE_NAME)
  }
}

function openPersistDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onerror = () => {
      reject(requestError(request.error))
    }
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onupgradeneeded = () => {
      ensurePersistStore(request.result)
    }
  })
}

function createIndexedDBPersister(): Persister {
  return {
    persistClient: async (client) => {
      const hasErrors = client.clientState.queries.some(
        (q) => q.state.error != null
      )
      if (hasErrors) return

      // Strip sensitive queries before persisting
      const sanitized = stripSensitiveQueries(client)

      // Skip if cache exceeds size limit
      if (estimateSize(sanitized) > MAX_CACHE_SIZE_BYTES) return

      const db = await openPersistDb()
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        store.put(JSON.stringify(sanitized), KEY)
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(requestError(tx.error))
        }
      })
    },
    restoreClient: async () => {
      const db = await openPersistDb()
      return new Promise<PersistedClient | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const getRequest = store.get(KEY)
        getRequest.onsuccess = () => {
          db.close()
          if (getRequest.result) {
            resolve(JSON.parse(getRequest.result as string) as PersistedClient)
          } else {
            resolve(undefined)
          }
        }
        getRequest.onerror = () => {
          db.close()
          reject(requestError(getRequest.error))
        }
      })
    },
    removeClient: async () => {
      const db = await openPersistDb()
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        store.delete(KEY)
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(requestError(tx.error))
        }
      })
    },
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
})

export let persistor: ReturnType<typeof persistQueryClient> | undefined

export async function initializeQueryClient() {
  if (persistor) return

  const persister = createIndexedDBPersister()

  persistor = persistQueryClient({
    queryClient,
    persister,
    buster: 'v1',
  })

  await persistQueryClientRestore({
    queryClient,
    persister,
    buster: 'v1',
  })
}
