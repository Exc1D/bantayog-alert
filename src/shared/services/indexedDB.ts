/**
 * IndexedDB Service
 *
 * Manages offline report queue using IndexedDB for persistent client-side storage.
 * Provides CRUD operations for reports that need to be synced when network is available.
 */

import { DB_CONFIG } from '@/shared/types/indexedDB'

type ReportQueueItem = {
  id: string
  timestamp: string
  data: unknown
  status: 'pending' | 'uploaded' | 'error'
  errorMessage?: string
  retryCount?: number
  lastSyncAttempt?: string
}

let dbInstance: IDBDatabase | null = null

/**
 * Open or create IndexedDB database
 *
 * Initializes the database and creates object stores if they don't exist.
 * Handles database versioning for schema migrations.
 */
export async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Return existing instance if already open
    if (dbInstance) {
      resolve(dbInstance)
      return
    }

    const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version)

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`))
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create reports object store
      if (!db.objectStoreNames.contains(DB_CONFIG.stores.REPORTS)) {
        const objectStore = db.createObjectStore(DB_CONFIG.stores.REPORTS, {
          keyPath: 'id',
          autoIncrement: false,
        })

        // Create indexes for common queries
        objectStore.createIndex('status', 'status', { unique: false })
        objectStore.createIndex('timestamp', 'timestamp', { unique: false })
        objectStore.createIndex('lastSyncAttempt', 'lastSyncAttempt', { unique: false })
      }
    }
  })
}

/**
 * Close the database connection
 *
 * Should be called when done with database operations to free resources.
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

/**
 * Add a report to the offline queue
 *
 * @param data - Report data to store
 * @param options - Optional configuration (id, retryCount)
 * @returns The ID of the queued report
 */
export async function addReport(
  data: unknown,
  options: { id?: string; retryCount?: number } = {}
): Promise<string> {
  const db = await openDatabase()
  const transaction = db.transaction(DB_CONFIG.stores.REPORTS, 'readwrite')
  const objectStore = transaction.objectStore(DB_CONFIG.stores.REPORTS)

  const id = options.id || generateId()
  const timestamp = new Date().toISOString()

  const item: ReportQueueItem = {
    id,
    timestamp,
    data,
    status: 'pending',
    retryCount: options.retryCount || 0,
  }

  return new Promise((resolve, reject) => {
    const request = objectStore.add(item)

    request.onsuccess = () => resolve(id)
    request.onerror = () => reject(new Error(`Failed to add report: ${request.error?.message}`))
  })
}

/**
 * Get all reports from the offline queue
 *
 * @returns Array of all queued reports
 */
export async function getAllReports(): Promise<ReportQueueItem[]> {
  const db = await openDatabase()
  const transaction = db.transaction(DB_CONFIG.stores.REPORTS, 'readonly')
  const objectStore = transaction.objectStore(DB_CONFIG.stores.REPORTS)

  return new Promise((resolve, reject) => {
    const request = objectStore.getAll()

    request.onsuccess = () => resolve(request.result as ReportQueueItem[])
    request.onerror = () => reject(new Error(`Failed to get reports: ${request.error?.message}`))
  })
}

/**
 * Get reports by status
 *
 * @param status - The status to filter by
 * @returns Array of reports with the specified status
 */
export async function getReportsByStatus(
  status: 'pending' | 'uploaded' | 'error'
): Promise<ReportQueueItem[]> {
  const db = await openDatabase()
  const transaction = db.transaction(DB_CONFIG.stores.REPORTS, 'readonly')
  const objectStore = transaction.objectStore(DB_CONFIG.stores.REPORTS)
  const index = objectStore.index('status')

  return new Promise((resolve, reject) => {
    const request = index.getAll(status)

    request.onsuccess = () => resolve(request.result as ReportQueueItem[])
    request.onerror = () => reject(new Error(`Failed to get reports by status: ${request.error?.message}`))
  })
}

/**
 * Get a single report by ID
 *
 * @param id - The report ID
 * @returns The report or null if not found
 */
export async function getReport(id: string): Promise<ReportQueueItem | null> {
  const db = await openDatabase()
  const transaction = db.transaction(DB_CONFIG.stores.REPORTS, 'readonly')
  const objectStore = transaction.objectStore(DB_CONFIG.stores.REPORTS)

  return new Promise((resolve, reject) => {
    const request = objectStore.get(id)

    request.onsuccess = () => {
      const result = request.result as ReportQueueItem | undefined
      resolve(result || null)
    }
    request.onerror = () => reject(new Error(`Failed to get report: ${request.error?.message}`))
  })
}

/**
 * Update the status of a report
 *
 * @param id - The report ID
 * @param status - The new status
 * @param errorMessage - Optional error message if status is 'error'
 * @returns The updated report
 */
export async function updateReportStatus(
  id: string,
  status: 'pending' | 'uploaded' | 'error',
  errorMessage?: string
): Promise<ReportQueueItem> {
  const db = await openDatabase()
  const transaction = db.transaction(DB_CONFIG.stores.REPORTS, 'readwrite')
  const objectStore = transaction.objectStore(DB_CONFIG.stores.REPORTS)

  return new Promise((resolve, reject) => {
    // First get the existing report
    const getRequest = objectStore.get(id)

    getRequest.onsuccess = () => {
      const report = getRequest.result as ReportQueueItem | undefined

      if (!report) {
        reject(new Error(`Report with id ${id} not found`))
        return
      }

      // Update the report
      const updatedReport: ReportQueueItem = {
        ...report,
        status,
        errorMessage,
        lastSyncAttempt: new Date().toISOString(),
      }

      const putRequest = objectStore.put(updatedReport)

      putRequest.onsuccess = () => resolve(updatedReport)
      putRequest.onerror = () => reject(new Error(`Failed to update report: ${putRequest.error?.message}`))
    }

    getRequest.onerror = () => reject(new Error(`Failed to get report for update: ${getRequest.error?.message}`))
  })
}

/**
 * Increment the retry count for a report
 *
 * @param id - The report ID
 * @returns The updated report
 */
export async function incrementRetryCount(id: string): Promise<ReportQueueItem> {
  const db = await openDatabase()
  const transaction = db.transaction(DB_CONFIG.stores.REPORTS, 'readwrite')
  const objectStore = transaction.objectStore(DB_CONFIG.stores.REPORTS)

  return new Promise((resolve, reject) => {
    const getRequest = objectStore.get(id)

    getRequest.onsuccess = () => {
      const report = getRequest.result as ReportQueueItem | undefined

      if (!report) {
        reject(new Error(`Report with id ${id} not found`))
        return
      }

      const updatedReport: ReportQueueItem = {
        ...report,
        retryCount: (report.retryCount || 0) + 1,
        lastSyncAttempt: new Date().toISOString(),
      }

      const putRequest = objectStore.put(updatedReport)

      putRequest.onsuccess = () => resolve(updatedReport)
      putRequest.onerror = () => reject(new Error(`Failed to update retry count: ${putRequest.error?.message}`))
    }

    getRequest.onerror = () => reject(new Error(`Failed to get report: ${getRequest.error?.message}`))
  })
}

/**
 * Delete a report from the queue
 *
 * @param id - The report ID to delete
 * @returns true if deleted, false if not found
 */
export async function deleteReport(id: string): Promise<boolean> {
  const db = await openDatabase()
  const transaction = db.transaction(DB_CONFIG.stores.REPORTS, 'readwrite')
  const objectStore = transaction.objectStore(DB_CONFIG.stores.REPORTS)

  return new Promise((resolve, reject) => {
    // First check if the report exists
    const getRequest = objectStore.getKey(id)

    getRequest.onsuccess = () => {
      if (getRequest.result === undefined) {
        resolve(false)
        return
      }

      // Report exists, proceed with deletion
      const deleteRequest = objectStore.delete(id)

      deleteRequest.onsuccess = () => resolve(true)
      deleteRequest.onerror = () =>
        reject(new Error(`Failed to delete report: ${deleteRequest.error?.message}`))
    }

    getRequest.onerror = () => reject(new Error(`Failed to check report existence: ${getRequest.error?.message}`))
  })
}

/**
 * Delete all reports with a specific status
 *
 * @param status - The status of reports to delete
 * @returns Number of reports deleted
 */
export async function deleteReportsByStatus(
  status: 'pending' | 'uploaded' | 'error'
): Promise<number> {
  const reports = await getReportsByStatus(status)
  const db = await openDatabase()
  const transaction = db.transaction(DB_CONFIG.stores.REPORTS, 'readwrite')
  const objectStore = transaction.objectStore(DB_CONFIG.stores.REPORTS)

  let deletedCount = 0

  return new Promise((resolve, reject) => {
    const deletePromises = reports.map((report) => {
      return new Promise<void>((resolveDelete, rejectDelete) => {
        const request = objectStore.delete(report.id)
        request.onsuccess = () => {
          deletedCount++
          resolveDelete()
        }
        request.onerror = () => rejectDelete(new Error(`Failed to delete report ${report.id}`))
      })
    })

    Promise.all(deletePromises)
      .then(() => resolve(deletedCount))
      .catch((error) => reject(error))
  })
}

/**
 * Clear all reports from the queue
 *
 * Use with caution - this deletes all data.
 */
export async function clearAllReports(): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction(DB_CONFIG.stores.REPORTS, 'readwrite')
  const objectStore = transaction.objectStore(DB_CONFIG.stores.REPORTS)

  return new Promise((resolve, reject) => {
    const request = objectStore.clear()

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error(`Failed to clear reports: ${request.error?.message}`))
  })
}

/**
 * Get count of reports by status
 *
 * @param status - The status to count
 * @returns Number of reports with the specified status
 */
export async function getReportCountByStatus(
  status: 'pending' | 'uploaded' | 'error'
): Promise<number> {
  const db = await openDatabase()
  const transaction = db.transaction(DB_CONFIG.stores.REPORTS, 'readonly')
  const objectStore = transaction.objectStore(DB_CONFIG.stores.REPORTS)
  const index = objectStore.index('status')

  return new Promise((resolve, reject) => {
    const request = index.count(status)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error(`Failed to count reports: ${request.error?.message}`))
  })
}

/**
 * Generate a unique ID for reports
 *
 * Uses timestamp and random string for uniqueness.
 */
function generateId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 9)
  return `${timestamp}-${random}`
}
