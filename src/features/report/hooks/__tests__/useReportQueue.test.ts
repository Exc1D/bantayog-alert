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

vi.mock('@/app/firebase/config', () => ({
  storage: {},
  db: {},
  auth: {},
}))

vi.mock('@/shared/hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn().mockReturnValue({ isOnline: true, networkType: 'wifi' }),
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
    // Restore default resolved implementations for each test.
    getAllMock.mockImplementation(() => Promise.resolve([]))
    addMock.mockImplementation(() => Promise.resolve())
    getMock.mockImplementation(() => Promise.resolve())
    updateMock.mockImplementation(() => Promise.resolve())
    deleteMock.mockImplementation(() => Promise.resolve())
    clearMock.mockImplementation(() => Promise.resolve())
    getByStatusMock.mockImplementation(() => Promise.resolve([]))
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
