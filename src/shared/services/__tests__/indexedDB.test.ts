/**
 * IndexedDB Service Tests
 *
 * Tests for offline report queue storage using fake-indexeddb.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import {
  openDatabase,
  closeDatabase,
  addReport,
  getAllReports,
  getReportsByStatus,
  getReport,
  updateReportStatus,
  incrementRetryCount,
  deleteReport,
  deleteReportsByStatus,
  clearAllReports,
  getReportCountByStatus,
} from '../indexedDB'

describe('IndexedDBService', () => {
  beforeEach(async () => {
    // Close any existing connection and clear database
    await closeDatabase()
  })

  afterEach(async () => {
    // Clean up after each test
    try {
      await clearAllReports()
    } catch (error) {
      // Ignore if database doesn't exist
    }
    await closeDatabase()
  })

  describe('openDatabase', () => {
    it('should open database connection', async () => {
      const db = await openDatabase()
      expect(db).toBeDefined()
      expect(db.name).toBe('bantayog-offline-queue')
      expect(db.version).toBe(1)
    })

    it('should create object stores on first open', async () => {
      const db = await openDatabase()
      expect(db.objectStoreNames.contains('reports')).toBe(true)
    })

    it('should return existing connection if already open', async () => {
      const db1 = await openDatabase()
      const db2 = await openDatabase()
      expect(db1).toBe(db2)
    })
  })

  describe('closeDatabase', () => {
    it('should close database connection', async () => {
      await openDatabase()
      await closeDatabase()

      // Should be able to open again after closing
      const db = await openDatabase()
      expect(db).toBeDefined()
    })
  })

  describe('addReport', () => {
    it('should add report with auto-generated ID', async () => {
      const reportData = { type: 'incident', description: 'Test report' }
      const id = await addReport(reportData)

      expect(id).toBeDefined()
      expect(typeof id).toBe('string')

      const report = await getReport(id)
      expect(report).toBeDefined()
      expect(report?.data).toEqual(reportData)
    })

    it('should add report with custom ID', async () => {
      const customId = 'custom-report-123'
      const reportData = { type: 'incident', description: 'Test report' }
      const id = await addReport(reportData, { id: customId })

      expect(id).toBe(customId)

      const report = await getReport(customId)
      expect(report).toBeDefined()
      expect(report?.id).toBe(customId)
    })

    it('should set initial status to pending', async () => {
      const reportData = { type: 'incident' }
      const id = await addReport(reportData)

      const report = await getReport(id)
      expect(report?.status).toBe('pending')
    })

    it('should initialize retry count', async () => {
      const reportData = { type: 'incident' }
      const id = await addReport(reportData, { retryCount: 5 })

      const report = await getReport(id)
      expect(report?.retryCount).toBe(5)
    })

    it('should default retry count to 0', async () => {
      const reportData = { type: 'incident' }
      const id = await addReport(reportData)

      const report = await getReport(id)
      expect(report?.retryCount).toBe(0)
    })

    it('should set timestamp', async () => {
      const beforeAdd = Date.now()
      const reportData = { type: 'incident' }
      const id = await addReport(reportData)
      const afterAdd = Date.now()

      const report = await getReport(id)
      const timestamp = new Date(report!.timestamp).getTime()

      expect(timestamp).toBeGreaterThanOrEqual(beforeAdd)
      expect(timestamp).toBeLessThanOrEqual(afterAdd)
    })
  })

  describe('getAllReports', () => {
    it('should return empty array when no reports', async () => {
      const reports = await getAllReports()
      expect(reports).toEqual([])
    })

    it('should return all reports', async () => {
      const data1 = { type: 'incident', description: 'Report 1' }
      const data2 = { type: 'incident', description: 'Report 2' }
      const data3 = { type: 'incident', description: 'Report 3' }

      await addReport(data1)
      await addReport(data2)
      await addReport(data3)

      const reports = await getAllReports()
      expect(reports.length).toBe(3)
    })
  })

  describe('getReportsByStatus', () => {
    beforeEach(async () => {
      // Add reports with different statuses
      const id1 = await addReport({ type: 'incident', description: 'Pending 1' })
      const id2 = await addReport({ type: 'incident', description: 'Pending 2' })
      const id3 = await addReport({ type: 'incident', description: 'Error' })

      await updateReportStatus(id3, 'error', 'Upload failed')
      await updateReportStatus(id1, 'uploaded')
    })

    it('should get pending reports', async () => {
      const pendingReports = await getReportsByStatus('pending')
      expect(pendingReports.length).toBe(1)
      expect(pendingReports[0].data.description).toBe('Pending 2')
    })

    it('should get uploaded reports', async () => {
      const uploadedReports = await getReportsByStatus('uploaded')
      expect(uploadedReports.length).toBe(1)
      expect(uploadedReports[0].data.description).toBe('Pending 1')
    })

    it('should get error reports', async () => {
      const errorReports = await getReportsByStatus('error')
      expect(errorReports.length).toBe(1)
      expect(errorReports[0].errorMessage).toBe('Upload failed')
    })
  })

  describe('getReport', () => {
    it('should get report by ID', async () => {
      const reportData = { type: 'incident', description: 'Test' }
      const id = await addReport(reportData)

      const report = await getReport(id)
      expect(report).toBeDefined()
      expect(report?.id).toBe(id)
      expect(report?.data).toEqual(reportData)
    })

    it('should return null for non-existent report', async () => {
      const report = await getReport('non-existent-id')
      expect(report).toBeNull()
    })
  })

  describe('updateReportStatus', () => {
    it('should update status to uploaded', async () => {
      const id = await addReport({ type: 'incident' })
      const updated = await updateReportStatus(id, 'uploaded')

      expect(updated.status).toBe('uploaded')
      expect(updated.lastSyncAttempt).toBeDefined()
    })

    it('should update status to error with message', async () => {
      const id = await addReport({ type: 'incident' })
      const errorMessage = 'Network timeout'
      const updated = await updateReportStatus(id, 'error', errorMessage)

      expect(updated.status).toBe('error')
      expect(updated.errorMessage).toBe(errorMessage)
      expect(updated.lastSyncAttempt).toBeDefined()
    })

    it('should update status back to pending', async () => {
      const id = await addReport({ type: 'incident' })
      await updateReportStatus(id, 'error', 'Failed')
      const updated = await updateReportStatus(id, 'pending')

      expect(updated.status).toBe('pending')
      expect(updated.errorMessage).toBeUndefined()
    })

    it('should throw error for non-existent report', async () => {
      await expect(updateReportStatus('fake-id', 'uploaded')).rejects.toThrow('not found')
    })
  })

  describe('incrementRetryCount', () => {
    it('should increment retry count', async () => {
      const id = await addReport({ type: 'incident' }, { retryCount: 2 })
      const updated = await incrementRetryCount(id)

      expect(updated.retryCount).toBe(3)
      expect(updated.lastSyncAttempt).toBeDefined()
    })

    it('should start from 0 if not set', async () => {
      const id = await addReport({ type: 'incident' })
      const updated = await incrementRetryCount(id)

      expect(updated.retryCount).toBe(1)
    })

    it('should throw error for non-existent report', async () => {
      await expect(incrementRetryCount('fake-id')).rejects.toThrow('not found')
    })
  })

  describe('deleteReport', () => {
    it('should delete report by ID', async () => {
      const id = await addReport({ type: 'incident' })
      await deleteReport(id)

      const report = await getReport(id)
      expect(report).toBeNull()
    })

    it('should return true when deleted', async () => {
      const id = await addReport({ type: 'incident' })
      const result = await deleteReport(id)
      expect(result).toBe(true)
    })

    it('should return false for non-existent report', async () => {
      const result = await deleteReport('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('deleteReportsByStatus', () => {
    beforeEach(async () => {
      const id1 = await addReport({ type: 'incident', description: 'Pending 1' })
      const id2 = await addReport({ type: 'incident', description: 'Pending 2' })
      const id3 = await addReport({ type: 'incident', description: 'Uploaded' })
      const id4 = await addReport({ type: 'incident', description: 'Error' })

      await updateReportStatus(id3, 'uploaded')
      await updateReportStatus(id4, 'error', 'Failed')
    })

    it('should delete all pending reports', async () => {
      const deletedCount = await deleteReportsByStatus('pending')
      expect(deletedCount).toBe(2)

      const pendingReports = await getReportsByStatus('pending')
      expect(pendingReports.length).toBe(0)
    })

    it('should delete all uploaded reports', async () => {
      const deletedCount = await deleteReportsByStatus('uploaded')
      expect(deletedCount).toBe(1)

      const uploadedReports = await getReportsByStatus('uploaded')
      expect(uploadedReports.length).toBe(0)
    })

    it('should not affect reports with other statuses', async () => {
      await deleteReportsByStatus('uploaded')

      const pendingReports = await getReportsByStatus('pending')
      const errorReports = await getReportsByStatus('error')

      expect(pendingReports.length).toBe(2)
      expect(errorReports.length).toBe(1)
    })
  })

  describe('clearAllReports', () => {
    it('should clear all reports', async () => {
      await addReport({ type: 'incident', description: 'Report 1' })
      await addReport({ type: 'incident', description: 'Report 2' })
      await addReport({ type: 'incident', description: 'Report 3' })

      await clearAllReports()

      const reports = await getAllReports()
      expect(reports).toEqual([])
    })
  })

  describe('getReportCountByStatus', () => {
    beforeEach(async () => {
      const id1 = await addReport({ type: 'incident', description: 'Pending 1' })
      const id2 = await addReport({ type: 'incident', description: 'Pending 2' })
      const id3 = await addReport({ type: 'incident', description: 'Uploaded 1' })
      const id4 = await addReport({ type: 'incident', description: 'Uploaded 2' })
      const id5 = await addReport({ type: 'incident', description: 'Error' })

      await updateReportStatus(id3, 'uploaded')
      await updateReportStatus(id4, 'uploaded')
      await updateReportStatus(id5, 'error', 'Failed')
    })

    it('should count pending reports', async () => {
      const count = await getReportCountByStatus('pending')
      expect(count).toBe(2)
    })

    it('should count uploaded reports', async () => {
      const count = await getReportCountByStatus('uploaded')
      expect(count).toBe(2)
    })

    it('should count error reports', async () => {
      const count = await getReportCountByStatus('error')
      expect(count).toBe(1)
    })

    it('should return 0 for status with no reports', async () => {
      // Delete all error reports
      await deleteReportsByStatus('error')

      const count = await getReportCountByStatus('error')
      expect(count).toBe(0)
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Close database to simulate error
      await closeDatabase()

      // Mock indexedDB.open to fail
      const originalOpen = indexedDB.open
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const request = {} as unknown as IDBOpenDBRequest
        setTimeout(() => {
          if (request.onerror) {
            request.onerror(new Event('error') as unknown as Event)
          }
        }, 0)
        return request
      })

      await expect(openDatabase()).rejects.toThrow()

      indexedDB.open = originalOpen
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete offline queue workflow', async () => {
      // 1. Queue reports when offline
      const report1Id = await addReport({
        type: 'flood',
        severity: 'high',
        location: { lat: 14.5995, lng: 120.9842 },
      })
      const report2Id = await addReport({
        type: 'fire',
        severity: 'medium',
        location: { lat: 14.6000, lng: 120.9850 },
      })

      // 2. Check pending reports
      const pendingReports = await getReportsByStatus('pending')
      expect(pendingReports.length).toBe(2)

      // 3. Simulate successful upload of first report
      await updateReportStatus(report1Id, 'uploaded')

      // 4. Simulate failed upload of second report
      await updateReportStatus(report2Id, 'error', 'Network timeout')
      await incrementRetryCount(report2Id)

      // 5. Verify state
      const uploadedReports = await getReportsByStatus('uploaded')
      const errorReports = await getReportsByStatus('error')

      expect(uploadedReports.length).toBe(1)
      expect(errorReports.length).toBe(1)
      expect(errorReports[0].retryCount).toBe(1)

      // 6. Retry failed report
      await updateReportStatus(report2Id, 'pending')
      await updateReportStatus(report2Id, 'uploaded')

      // 7. Verify all uploaded
      const allUploaded = await getReportsByStatus('uploaded')
      expect(allUploaded.length).toBe(2)

      // 8. Clean up uploaded reports
      await deleteReportsByStatus('uploaded')
      const remaining = await getAllReports()
      expect(remaining.length).toBe(0)
    })
  })
})
