/**
 * QueueIndicator Component Tests
 *
 * Tests offline queue status indicator component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueueIndicator } from '../QueueIndicator'
import * as useReportQueueModule from '../../hooks/useReportQueue'

// Mock the hook
vi.mock('../../hooks/useReportQueue')

describe('QueueIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when queue is empty', () => {
    it('should render nothing', () => {
      vi.mocked(useReportQueueModule.useReportQueue).mockReturnValue({
        queue: [],
        queueSize: 0,
        isSyncing: false,
        loadError: null,
        syncError: null,
        enqueueReport: vi.fn(),
        syncQueue: vi.fn(),
        clearQueue: vi.fn(),
        removeReport: vi.fn(),
        hasPendingReports: false,
        failedReports: [],
      })

      const { container } = render(<QueueIndicator />)

      expect(container.firstChild).toBe(null)
    })
  })

  describe('banner variant', () => {
    it('should show offline banner when queue has reports', () => {
      vi.mocked(useReportQueueModule.useReportQueue).mockReturnValue({
        queue: [
          {
            id: 'report-1',
            reportData: {
              incidentType: 'flood',
              photo: null,
              location: { type: 'gps', latitude: 14.5995, longitude: 120.9842 },
              description: 'Test',
              phone: '+63 912 345 6789',
            },
            retryCount: 0,
            status: 'pending',
            createdAt: Date.now(),
          },
        ],
        queueSize: 1,
        isSyncing: false,
        loadError: null,
        syncError: null,
        enqueueReport: vi.fn(),
        syncQueue: vi.fn(),
        clearQueue: vi.fn(),
        removeReport: vi.fn(),
        hasPendingReports: true,
        failedReports: [],
      })

      render(<QueueIndicator variant="banner" />)

      expect(screen.getByTestId('queue-indicator-banner')).toBeInTheDocument()
      expect(screen.getByText('Waiting for connection')).toBeInTheDocument()
      expect(screen.getByText('1 report pending')).toBeInTheDocument()
    })

    it('should show syncing state when syncing', () => {
      vi.mocked(useReportQueueModule.useReportQueue).mockReturnValue({
        queue: [
          {
            id: 'report-1',
            reportData: {
              incidentType: 'flood',
              photo: null,
              location: { type: 'gps', latitude: 14.5995, longitude: 120.9842 },
              description: 'Test',
              phone: '+63 912 345 6789',
            },
            retryCount: 0,
            status: 'syncing',
            createdAt: Date.now(),
          },
        ],
        queueSize: 1,
        isSyncing: true,
        loadError: null,
        syncError: null,
        enqueueReport: vi.fn(),
        syncQueue: vi.fn(),
        clearQueue: vi.fn(),
        removeReport: vi.fn(),
        hasPendingReports: true,
        failedReports: [],
      })

      render(<QueueIndicator variant="banner" />)

      expect(screen.getByText('Syncing reports...')).toBeInTheDocument()
      expect(screen.queryByTestId('sync-now-button')).not.toBeInTheDocument()
    })

    it('should show Sync Now button when not syncing', () => {
      const mockSyncQueue = vi.fn()
      vi.mocked(useReportQueueModule.useReportQueue).mockReturnValue({
        queue: [
          {
            id: 'report-1',
            reportData: {
              incidentType: 'flood',
              photo: null,
              location: { type: 'gps', latitude: 14.5995, longitude: 120.9842 },
              description: 'Test',
              phone: '+63 912 345 6789',
            },
            retryCount: 0,
            status: 'pending',
            createdAt: Date.now(),
          },
        ],
        queueSize: 1,
        isSyncing: false,
        loadError: null,
        syncError: null,
        enqueueReport: vi.fn(),
        syncQueue: mockSyncQueue,
        clearQueue: vi.fn(),
        removeReport: vi.fn(),
        hasPendingReports: true,
        failedReports: [],
      })

      render(<QueueIndicator variant="banner" />)

      const syncButton = screen.getByTestId('sync-now-button')
      expect(syncButton).toBeInTheDocument()

      // Note: We can't test the actual sync call here without proper async handling
      // The button should render correctly though
    })

    it('should show correct pluralization for multiple reports', () => {
      vi.mocked(useReportQueueModule.useReportQueue).mockReturnValue({
        queue: [
          {},
          {},
          {},
        ] as any,
        queueSize: 3,
        isSyncing: false,
        loadError: null,
        syncError: null,
        enqueueReport: vi.fn(),
        syncQueue: vi.fn(),
        clearQueue: vi.fn(),
        removeReport: vi.fn(),
        hasPendingReports: true,
        failedReports: [],
      })

      render(<QueueIndicator variant="banner" />)

      expect(screen.getByText('3 reports pending')).toBeInTheDocument()
    })

    it('renders sync error when present', () => {
      vi.mocked(useReportQueueModule.useReportQueue).mockReturnValue({
        queue: [
          {
            id: 'report-1',
            reportData: {
              incidentType: 'flood',
              photo: null,
              location: { type: 'gps', latitude: 14.5995, longitude: 120.9842 },
              description: 'Test',
              phone: '+63 912 345 6789',
            },
            retryCount: 0,
            status: 'pending',
            createdAt: Date.now(),
          },
        ],
        queueSize: 1,
        isSyncing: false,
        loadError: null,
        syncError: 'Auto-sync failed',
        enqueueReport: vi.fn(),
        syncQueue: vi.fn(),
        clearQueue: vi.fn(),
        removeReport: vi.fn(),
        hasPendingReports: true,
        failedReports: [],
      })

      render(<QueueIndicator variant="banner" />)

      const errorElement = screen.getByTestId('sync-error')
      expect(errorElement).toBeInTheDocument()
      expect(errorElement).toHaveTextContent('Unable to sync queued reports. Please try again.')
    })
  })

  describe('icon variant', () => {
    it('should show queue count badge', () => {
      vi.mocked(useReportQueueModule.useReportQueue).mockReturnValue({
        queue: [{}, {}] as any,
        queueSize: 2,
        isSyncing: false,
        loadError: null,
        syncError: null,
        enqueueReport: vi.fn(),
        syncQueue: vi.fn(),
        clearQueue: vi.fn(),
        removeReport: vi.fn(),
        hasPendingReports: true,
        failedReports: [],
      })

      render(<QueueIndicator variant="icon" />)

      expect(screen.getByTestId('queue-indicator-icon')).toBeInTheDocument()
      expect(screen.getByTestId('queue-count')).toHaveTextContent('2')
    })

    it('should show syncing spinner when syncing', () => {
      vi.mocked(useReportQueueModule.useReportQueue).mockReturnValue({
        queue: [{}] as any,
        queueSize: 1,
        isSyncing: true,
        loadError: null,
        syncError: null,
        enqueueReport: vi.fn(),
        syncQueue: vi.fn(),
        clearQueue: vi.fn(),
        removeReport: vi.fn(),
        hasPendingReports: true,
        failedReports: [],
      })

      render(<QueueIndicator variant="icon" />)

      expect(screen.getByTestId('syncing-spinner')).toBeInTheDocument()
    })

    it('should show offline icon when not syncing', () => {
      vi.mocked(useReportQueueModule.useReportQueue).mockReturnValue({
        queue: [{}] as any,
        queueSize: 1,
        isSyncing: false,
        loadError: null,
        syncError: null,
        enqueueReport: vi.fn(),
        syncQueue: vi.fn(),
        clearQueue: vi.fn(),
        removeReport: vi.fn(),
        hasPendingReports: true,
        failedReports: [],
      })

      render(<QueueIndicator variant="icon" />)

      expect(screen.getByTestId('offline-icon')).toBeInTheDocument()
    })
  })
})
