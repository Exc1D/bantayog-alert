/**
 * Report Queue Service Tests
 *
 * Tests IndexedDB operations for offline report queue.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { reportQueueService } from '../reportQueue.service'
import type { QueuedReport } from '../../hooks/useReportQueue'

describe('reportQueueService', () => {
  const mockReport: QueuedReport = {
    id: 'test-report-1',
    reportData: {
      incidentType: 'flood',
      photo: null,
      location: { type: 'gps', latitude: 14.5995, longitude: 120.9842 },
      description: 'Test flood report',
      phone: '+63 912 345 6789',
    },
    retryCount: 0,
    status: 'pending',
    createdAt: Date.now(),
  }

  beforeEach(async () => {
    // Clear the database before each test
    await reportQueueService.clear()
  })

  afterEach(async () => {
    // Clean up after tests
    await reportQueueService.clear()
  })

  describe('add', () => {
    it('should add a report to the queue', async () => {
      await reportQueueService.add(mockReport)

      const reports = await reportQueueService.getAll()
      expect(reports).toHaveLength(1)
      expect(reports[0]).toEqual(mockReport)
    })

    it('should add multiple reports to the queue', async () => {
      const report2 = { ...mockReport, id: 'test-report-2' }

      await reportQueueService.add(mockReport)
      await reportQueueService.add(report2)

      const reports = await reportQueueService.getAll()
      expect(reports).toHaveLength(2)
    })
  })

  describe('getAll', () => {
    it('should return empty array when queue is empty', async () => {
      const reports = await reportQueueService.getAll()
      expect(reports).toEqual([])
    })

    it('should return all reports in queue', async () => {
      await reportQueueService.add(mockReport)

      const reports = await reportQueueService.getAll()
      expect(reports).toHaveLength(1)
      expect(reports[0].id).toBe('test-report-1')
    })
  })

  describe('get', () => {
    it('should return report by id', async () => {
      await reportQueueService.add(mockReport)

      const report = await reportQueueService.get('test-report-1')
      expect(report).toEqual(mockReport)
    })

    it('should return undefined for non-existent report', async () => {
      const report = await reportQueueService.get('non-existent')
      expect(report).toBeUndefined()
    })
  })

  describe('update', () => {
    it('should update existing report', async () => {
      await reportQueueService.add(mockReport)

      const updatedReport = {
        ...mockReport,
        status: 'syncing' as const,
        retryCount: 1,
      }

      await reportQueueService.update(updatedReport)

      const report = await reportQueueService.get('test-report-1')
      expect(report).toEqual(updatedReport)
    })
  })

  describe('delete', () => {
    it('should delete report from queue', async () => {
      await reportQueueService.add(mockReport)

      await reportQueueService.delete('test-report-1')

      const reports = await reportQueueService.getAll()
      expect(reports).toHaveLength(0)
    })
  })

  describe('clear', () => {
    it('should clear all reports from queue', async () => {
      await reportQueueService.add(mockReport)
      const report2 = { ...mockReport, id: 'test-report-2' }
      await reportQueueService.add(report2)

      await reportQueueService.clear()

      const reports = await reportQueueService.getAll()
      expect(reports).toEqual([])
    })
  })

  describe('getByStatus', () => {
    it('should return reports filtered by status', async () => {
      const pendingReport = { ...mockReport, id: 'pending-1', status: 'pending' as const }
      const syncingReport = { ...mockReport, id: 'syncing-1', status: 'syncing' as const }
      const failedReport = { ...mockReport, id: 'failed-1', status: 'failed' as const }

      await reportQueueService.add(pendingReport)
      await reportQueueService.add(syncingReport)
      await reportQueueService.add(failedReport)

      const pendingReports = await reportQueueService.getByStatus('pending')
      const syncingReports = await reportQueueService.getByStatus('syncing')
      const failedReports = await reportQueueService.getByStatus('failed')

      expect(pendingReports).toHaveLength(1)
      expect(syncingReports).toHaveLength(1)
      expect(failedReports).toHaveLength(1)
    })

    it('should return empty array for status with no reports', async () => {
      const reports = await reportQueueService.getByStatus('pending')
      expect(reports).toEqual([])
    })
  })
})
