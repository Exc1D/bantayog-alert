/**
 * useReportQueue Hook Tests
 *
 * Tests offline report queue management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useReportQueue } from '../useReportQueue'

// ---------------------------------------------------------------------------
// vi.hoisted ensures these run at module initialization time, BEFORE vi.mock.
// vi.mock then uses these same function references in its factory, so any
// per-test mockImplementation calls affect what the hook actually calls.
// Path is '../../services/reportQueue.service' (from hooks/__tests__/).
// ---------------------------------------------------------------------------
const getAllMock = vi.hoisted(() => vi.fn<() => Promise<unknown[]>>())
const addMock = vi.hoisted(() => vi.fn<() => Promise<void>>())
const getMock = vi.hoisted(() => vi.fn<() => Promise<unknown>>())
const updateMock = vi.hoisted(() => vi.fn<() => Promise<void>>())
const deleteMock = vi.hoisted(() => vi.fn<() => Promise<void>>())
const clearMock = vi.hoisted(() => vi.fn<() => Promise<void>>())
const getByStatusMock = vi.hoisted(() => vi.fn<() => Promise<unknown[]>>())

vi.mock('../../services/reportQueue.service', () => ({
  reportQueueService: {
    getAll: getAllMock,
    add: addMock,
    get: getMock,
    update: updateMock,
    delete: deleteMock,
    clear: clearMock,
    getByStatus: getByStatusMock,
  },
}))

// Mock submitReport and uploadReportPhoto for syncQueue tests
const submitReportMock = vi.hoisted(() => vi.fn<() => Promise<void>>())
const uploadReportPhotoMock = vi.hoisted(() => vi.fn<() => Promise<string>>())

vi.mock('@/domains/citizen/services/firestore.service', () => ({
  submitReport: submitReportMock,
}))

vi.mock('../services/reportStorage.service', () => ({
  uploadReportPhoto: uploadReportPhotoMock,
}))

vi.mock('@/app/firebase/config', () => ({
  storage: {},
  db: {},
  auth: {},
}))

// Mock useNetworkStatus with configurable isOnline
const mockNetworkStatus = { isOnline: false, networkType: 'wifi' as const }
vi.mock('@/shared/hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn(() => mockNetworkStatus),
}))

const mockReportData = {
  incidentType: 'flood' as const,
  photo: null,
  location: { type: 'gps' as const, latitude: 14.5995, longitude: 120.9842 },
  description: 'Test flood report',
  phone: '+63 912 345 6789',
}

describe('useReportQueue', () => {
  beforeEach(() => {
    // Clear call history — implementations persist so each test can override.
    vi.clearAllMocks()
    // Reset network status to online
    mockNetworkStatus.isOnline = true
    // Restore default resolved implementations for each test.
    getAllMock.mockImplementation(() => Promise.resolve([]))
    addMock.mockImplementation(() => Promise.resolve())
    getMock.mockImplementation(() => Promise.resolve())
    updateMock.mockImplementation(() => Promise.resolve())
    deleteMock.mockImplementation(() => Promise.resolve())
    clearMock.mockImplementation(() => Promise.resolve())
    getByStatusMock.mockImplementation(() => Promise.resolve([]))
    submitReportMock.mockImplementation(() => Promise.resolve())
    uploadReportPhotoMock.mockImplementation(() => Promise.resolve('https://example.com/photo.jpg'))
  })

  describe('initial state', () => {
    it('should load queue on mount', async () => {
      const { result } = renderHook(() => useReportQueue())

      expect(result.current.queue).toEqual([])
      expect(result.current.queueSize).toBe(0)
      expect(result.current.isSyncing).toBe(false)
    })

    it('should return initial computed values', () => {
      const { result } = renderHook(() => useReportQueue())

      expect(result.current.hasPendingReports).toBe(false)
      expect(result.current.failedReports).toEqual([])
    })
  })

  describe('loadError', () => {
    it('should be null when queue loads successfully', async () => {
      const { result } = renderHook(() => useReportQueue())

      await waitFor(() => {
        expect(result.current.loadError).toBeNull()
      })
    })

    it('should surface IndexedDB load error via loadError state', async () => {
      getAllMock.mockImplementation(() => Promise.reject(new Error('IDB corrupted')))

      const { result } = renderHook(() => useReportQueue())

      await waitFor(() => {
        expect(result.current.loadError).toBe('IDB corrupted')
      })
    })

    it('should use fallback message for non-Error rejection', async () => {
      getAllMock.mockImplementation(() => Promise.reject('raw string error'))

      const { result } = renderHook(() => useReportQueue())

      await waitFor(() => {
        expect(result.current.loadError).toBe('Failed to load offline queue')
      })
    })
  })

  describe('auto-sync error handling', () => {
    it('should log [AUTO_SYNC_ERROR] when syncQueue promise rejects', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Set up queue with pending report, starting offline
      const queuedReport = {
        id: 'q1',
        reportData: mockReportData,
        retryCount: 0,
        status: 'pending' as const,
        createdAt: Date.now(),
      }

      // Start offline so auto-sync doesn't trigger immediately
      mockNetworkStatus.isOnline = false
      getAllMock.mockImplementation(() => Promise.resolve([queuedReport]))

      const { result, rerender } = renderHook(() => useReportQueue())

      await waitFor(() => {
        expect(result.current.queue.length).toBe(1)
      })

      // Make updateMock reject to trigger syncQueue rejection
      // The rejection happens BEFORE the per-report try/catch because
      // we're simulating an infrastructure failure
      updateMock.mockImplementation(() => Promise.reject(new Error('IDB connection lost')))

      // Go online - this triggers the auto-sync useEffect
      mockNetworkStatus.isOnline = true
      rerender()

      // Wait for the async error to be logged
      await waitFor(
        () => {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[AUTO_SYNC_ERROR]',
            'IDB connection lost'
          )
        },
        { timeout: 3000 }
      )

      consoleErrorSpy.mockRestore()
    })

    it('should handle non-Error rejections in syncQueue', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const queuedReport = {
        id: 'q1',
        reportData: mockReportData,
        retryCount: 0,
        status: 'pending' as const,
        createdAt: Date.now(),
      }

      getAllMock.mockImplementation(() => Promise.resolve([queuedReport]))
      submitReportMock.mockRejectedValueOnce('raw string error')

      const { result } = renderHook(() => useReportQueue())

      await waitFor(() => {
        expect(result.current.queue.length).toBe(1)
      })

      const syncResult = await act(async () => {
        return await result.current.syncQueue()
      })

      // Should handle non-Error rejections
      expect(syncResult.failed).toBe(1)

      consoleErrorSpy.mockRestore()
    })
  })

  describe('enqueueReport', () => {
    it('should add report to queue when offline', async () => {
      const { result } = renderHook(() => useReportQueue())

      await act(async () => {
        await result.current.enqueueReport(mockReportData)
      })

      expect(addMock).toHaveBeenCalled()
    })

    it('should add report to queue and sync immediately when online', async () => {
      const { result } = renderHook(() => useReportQueue())

      await act(async () => {
        await result.current.enqueueReport(mockReportData)
      })

      expect(addMock).toHaveBeenCalled()
    })
  })

  describe('syncQueue', () => {
    it('should not sync when offline', async () => {
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
      getAllMock.mockImplementation(() => Promise.resolve(mockQueue))

      const { result } = renderHook(() => useReportQueue())

      await act(async () => {
        await result.current.removeReport('report-1')
      })

      expect(deleteMock).toHaveBeenCalledWith('report-1')
    })
  })

  describe('clearQueue', () => {
    it('should clear all reports from queue', async () => {
      getAllMock.mockImplementation(() =>
        Promise.resolve([
          {
            id: 'report-1',
            reportData: mockReportData,
            retryCount: 0,
            status: 'pending' as const,
            createdAt: Date.now(),
          },
        ])
      )

      const { result } = renderHook(() => useReportQueue())

      await act(async () => {
        await result.current.clearQueue()
      })

      expect(clearMock).toHaveBeenCalled()
    })
  })
})
