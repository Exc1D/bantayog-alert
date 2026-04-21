import { QueryClient } from '@tanstack/react-query'
import { persistQueryClient, type Persister, type PersistedClient } from '@tanstack/query-persist-client-core'

export { QueryProvider } from './QueryProvider'

const DB_NAME = 'bantayog-query-cache'
const STORE_NAME = 'persist'
const KEY = 'query-cache'

function createIndexedDBPersister(): Persister {
  return {
    persistClient: async (client) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1)
        request.onerror = () => {
          reject(new Error(String(request.error)))
        }
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const store = tx.objectStore(STORE_NAME)
          store.put(JSON.stringify(client), KEY)
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(new Error(String(tx.error)))
          }
        }
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME)
          }
        }
      })
    },
    restoreClient: async () => {
      return new Promise<PersistedClient | undefined>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1)
        request.onerror = () => {
          reject(new Error(String(request.error)))
        }
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.close()
            resolve(undefined)
            return
          }
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
            reject(new Error(String(getRequest.error)))
          }
        }
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME)
          }
        }
      })
    },
    removeClient: async () => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1)
        request.onerror = () => {
          reject(new Error(String(request.error)))
        }
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.close()
            resolve()
            return
          }
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const store = tx.objectStore(STORE_NAME)
          store.delete(KEY)
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(new Error(String(tx.error)))
          }
        }
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME)
          }
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

  persistor = persistQueryClient({
    queryClient,
    persister: createIndexedDBPersister(),
    buster: 'v1',
  })

  await persistor[1]
}
