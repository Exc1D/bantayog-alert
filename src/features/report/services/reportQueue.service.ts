/**
 * Report Queue Service
 *
 * Handles IndexedDB operations for offline report queue.
 * Stores pending submissions and sync metadata.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { QueuedReport } from '../hooks/useReportQueue'

const DB_NAME = 'bantayog-alert'
const DB_VERSION = 1
const STORE_NAME = 'report-queue'

interface ReportQueueDB extends DBSchema {
  'report-queue': {
    key: string
    value: QueuedReport
    indexes: {
      status: QueuedReport['status']
      createdAt: number
    }
  }
}

let db: IDBPDatabase<ReportQueueDB> | null = null

async function getDB() {
  if (!db) {
    db = await openDB<ReportQueueDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('status', 'status')
          store.createIndex('createdAt', 'createdAt')
        }
      },
    })
  }
  return db
}

export const reportQueueService = {
  async add(report: QueuedReport): Promise<void> {
    const database = await getDB()
    await database.add(STORE_NAME, report)
  },

  async getAll(): Promise<QueuedReport[]> {
    const database = await getDB()
    return database.getAll(STORE_NAME)
  },

  async get(id: string): Promise<QueuedReport | undefined> {
    const database = await getDB()
    return database.get(STORE_NAME, id)
  },

  async update(report: QueuedReport): Promise<void> {
    const database = await getDB()
    await database.put(STORE_NAME, report)
  },

  async delete(id: string): Promise<void> {
    const database = await getDB()
    await database.delete(STORE_NAME, id)
  },

  async clear(): Promise<void> {
    const database = await getDB()
    await database.clear(STORE_NAME)
  },

  async getByStatus(status: QueuedReport['status']): Promise<QueuedReport[]> {
    const database = await getDB()
    return database.getAllFromIndex(STORE_NAME, 'status', status)
  },
}
