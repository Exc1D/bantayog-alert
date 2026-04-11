/**
 * useReportQueue Hook Tests
 *
 * Tests offline report queue management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useReportQueue } from '../useReportQueue'
import * as reportQueueService from '../../services/reportQueue.service'
import * as useNetworkStatusModule from '@/shared/hooks/useNetworkStatus'

// Mock dependencies
vi.mock('../services/reportQueue.service', () => ({
  reportQueueService: {
    getAll: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    getByStatus: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('@/shared/hooks/useNetworkStatus')

const mockReportData = {
  incidentType: 'flood' as const,
  photo: null,
  location: { type: 'gps' as const, latitude: 14.5995, longitude: 120.9842 },
  description: 'Test flood report',
  phone: '+63 912 345 6789',
}

describe('useReportQueue', () => {
  describe('initial state', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should load queue on mount', async () => {
      vi.mocked(reportQueueService.reportQueueService.getAll).mockResolvedValue([])

      const { result } = renderHook(() => useReportQueue())

      expect(result.current.queue).toEqual([])
      expect(result.current.queueSize).toBe(0)
      expect(result.current.isSyncing).toBe(false)
    })

    it('should return initial computed values', () => {
      vi.mocked(reportQueueService.reportQueueService.getAll).mockResolvedValue([])

      const { result } = renderHook(() => useReportQueue())

      expect(result.current.hasPendingReports).toBe(false)
      expect(result.current.failedReports).toEqual([])
    })
  })

  describe('enqueueReport', () => {
    it('should add report to queue when offline', async () => {
      vi.mocked(useNetworkStatusModule.useNetworkStatus).mockReturnValue({
        isOnline: false,
        networkType: null,
      })

      const { result } = renderHook(() => useReportQueue())

      await act(async () => {
        await result.current.enqueueReport(mockReportData)
      })

      expect(reportQueueService.reportQueueService.add).toHaveBeenCalled()
    })

    it('should add report to queue and sync immediately when online', async () => {
      const { result } = renderHook(() => useReportQueue())

      await act(async () => {
        await result.current.enqueueReport(mockReportData)
      })

      expect(reportQueueService.reportQueueService.add).toHaveBeenCalled()
    })
  })

  describe('syncQueue', () => {
    it('should not sync when offline', async () => {
      vi.mocked(useNetworkStatusModule.useNetworkStatus).mockReturnValue({
        isOnline: false,
        networkType: null,
      })

      const { result } = renderHook(() => useReportQueue())

      const syncResult = await act(async () => {
        return await result.current.syncQueue()
      })

      expect(syncResult).toEqual({ success: 0, failed: 0 })
    })

    it('should not sync when queue is empty', async () => {
      const { result } = renderHook(() => useReportQueue())

      const syncResult = await act(async () => {
        return await result.current.syncQueue()
      })

      expect(syncResult).toEqual({ success: 0, failed: 0 })
    })
  })

  describe('removeReport', () => {
    it('should remove report from queue', async () => {
      const mockQueue = [
        {
          id: 'report-1',
          reportData: mockReportData,
          retryCount: 0,
          status: 'pending' as const,
          createdAt: Date.now(),
        },
      ]
      vi.mocked(reportQueueService.reportQueueService.getAll).mockResolvedValue(mockQueue)

      const { result } = renderHook(() => useReportQueue())

      await act(async () => {
        await result.current.removeReport('report-1')
      })

      expect(reportQueueService.reportQueueService.delete).toHaveBeenCalledWith('report-1')
    })
  })

  describe('clearQueue', () => {
    it('should clear all reports from queue', async () => {
      vi.mocked(reportQueueService.reportQueueService.getAll).mockResolvedValue([
        {
          id: 'report-1',
          reportData: mockReportData,
          retryCount: 0,
          status: 'pending' as const,
          createdAt: Date.now(),
        },
      ])

      const { result } = renderHook(() => useReportQueue())

      await act(async () => {
        await result.current.clearQueue()
      })

      expect(reportQueueService.reportQueueService.clear).toHaveBeenCalled()
    })
  })
})
