/**
 * useReportQueue Hook
 *
 * Manages offline-first report submission queue.
 * Stores failed submissions in IndexedDB and auto-syncs when online.
 *
 * @note Consumers should monitor `failedReports.length > 0` on app focus
 * and surface a notification to alert users of reports that could not be
 * synced after maximum retries.
 */

import { useEffect, useCallback, useState, useRef } from 'react'
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus'
import { reportQueueService } from '../services/reportQueue.service'
import { uploadReportPhoto } from '../services/reportStorage.service'
import { submitReport } from '@/domains/citizen/services/firestore.service'
import type { Report } from '@/shared/types/firestore.types'

export interface QueuedReport {
  id: string
  reportData: {
    incidentType: string
    photo: File | null
    location: {
      type: 'gps' | 'manual'
      latitude?: number
      longitude?: number
      municipality?: string
      barangay?: string
    }
    phone: string
  }
  retryCount: number
  lastAttempt?: number
  error?: string
  status: 'pending' | 'syncing' | 'failed'
  createdAt: number
}

export interface UseReportQueueResult {
  // Queue state
  queue: QueuedReport[]
  queueSize: number
  isSyncing: boolean
  loadError: string | null

  // Actions
  enqueueReport: (reportData: QueuedReport['reportData']) => Promise<void>
  syncQueue: () => Promise<{ success: number; failed: number }>
  clearQueue: () => Promise<void>
  removeReport: (id: string) => Promise<void>

  // Computed
  hasPendingReports: boolean
  failedReports: QueuedReport[]
}

const MAX_RETRY_COUNT = 3
const RETRY_DELAY_MS = 5 * 60 * 1000 // 5 minutes

export function useReportQueue(): UseReportQueueResult {
  const { isOnline } = useNetworkStatus()
  const [queue, setQueue] = useState<QueuedReport[]>([])
  const queueRef = useRef(queue)
  const [isSyncing, setIsSyncing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Keep the ref in sync with the queue state
  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  // Load queue on mount
  useEffect(() => {
    reportQueueService.getAll()
      .then((data) => {
        setQueue(data)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load offline queue'
        console.error('[QUEUE_LOAD_ERROR]', message)
        setLoadError(message)
      })
  }, [])

  const enqueueReport = useCallback(
    async (reportData: QueuedReport['reportData']) => {
      const queuedReport: QueuedReport = {
        id: `queued-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        reportData,
        retryCount: 0,
        status: 'pending',
        createdAt: Date.now(),
      }

      await reportQueueService.add(queuedReport)

      setQueue((prev) => [...prev, queuedReport])

      // Try to sync immediately if online
      if (isOnline) {
        syncQueue()
      }
    },
    [isOnline]
  )

  const syncQueue = useCallback(async (): Promise<{ success: number; failed: number }> => {
    if (!isOnline || isSyncing) {
      return { success: 0, failed: 0 }
    }

    // Defensive: Throw if queue service is unavailable (infrastructure failure)
    // This allows the auto-sync .catch() to be tested and handles edge cases
    if (!reportQueueService || typeof reportQueueService.update !== 'function') {
      throw new Error('Queue service unavailable')
    }

    setIsSyncing(true)

    let successCount = 0
    let failedCount = 0

    // Get reports ready for sync (pending or failed within retry limits)
    // Use queueRef to always get the latest queue value
    const readyToSync = queueRef.current.filter(
      (report) =>
        (report.status === 'pending' || report.status === 'failed') &&
        report.retryCount < MAX_RETRY_COUNT &&
        (!report.lastAttempt || Date.now() - report.lastAttempt > RETRY_DELAY_MS)
    )

    for (const report of readyToSync) {
      try {
        // Update status to syncing
        const syncingReport = { ...report, status: 'syncing' as const }
        await reportQueueService.update(syncingReport)
        setQueue((prev) => prev.map((r) => (r.id === report.id ? syncingReport : r)))

        // Step 1: Upload photo if present
        let photoUrl: string | undefined
        if (report.reportData.photo) {
          photoUrl = await uploadReportPhoto(report.reportData.photo, report.id)
        }

        // Step 2: Transform to three-tier report model
        const { reportData } = report

        // Public report data (approximate location, no PII)
        const publicReportData = {
          incidentType: reportData.incidentType as Report['incidentType'],
          severity: 'medium' as const, // Default severity, admin can adjust
          approximateLocation: {
            barangay: reportData.location.type === 'manual'
              ? reportData.location.barangay || ''
              : 'Unknown',
            municipality: reportData.location.type === 'manual'
              ? reportData.location.municipality || ''
              : 'Unknown',
            approximateCoordinates: reportData.location.type === 'gps' && reportData.location.latitude
              ? {
                  latitude: reportData.location.latitude,
                  longitude: reportData.location.longitude ?? 0,
                }
              : { latitude: 0, longitude: 0 },
          },
          description: `Reported ${reportData.incidentType} incident`,
          isAnonymous: true, // Citizens always report anonymously
        }

        // Private report data (exact location, contact info)
        const privateReportData = {
          exactLocation: {
            address: reportData.location.type === 'manual'
              ? `${reportData.location.barangay || ''}, ${reportData.location.municipality || ''}`
              : reportData.location.type === 'gps' && reportData.location.latitude
                ? `${reportData.location.latitude}, ${reportData.location.longitude}`
                : 'Unknown',
            coordinates: reportData.location.type === 'gps' && reportData.location.latitude
              ? { latitude: reportData.location.latitude, longitude: reportData.location.longitude }
              : { latitude: 0, longitude: 0 },
          },
          reporterContact: {
            name: 'Anonymous', // Citizens are anonymous by default
            phone: reportData.phone,
          },
          photoUrls: photoUrl ? [photoUrl] : [],
        }

        // Step 3: Submit to Firebase
        await submitReport(publicReportData, privateReportData)

        // Remove from queue on success
        await reportQueueService.delete(report.id)
        setQueue((prev) => prev.filter((r) => r.id !== report.id))
        successCount++
      } catch (error) {
        // Update as failed
        const failedReport = {
          ...report,
          status: 'failed' as const,
          retryCount: report.retryCount + 1,
          lastAttempt: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error',
        }
        // Note: If this update fails, syncQueue will reject and be caught by
        // the auto-sync .catch() handler, logging [AUTO_SYNC_ERROR]
        await reportQueueService.update(failedReport)
        setQueue((prev) => prev.map((r) => (r.id === report.id ? failedReport : r)))
        failedCount++
      }
    }

    setIsSyncing(false)
    return { success: successCount, failed: failedCount }
  }, [isOnline, isSyncing])

  // Auto-sync when coming online
  // Note: Using queueRef.current to avoid stale closure issues.
  // syncQueue also uses queueRef, so it's not in deps.
  useEffect(() => {
    if (isOnline && queueRef.current.length > 0 && !isSyncing) {
      syncQueue().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Auto-sync failed'
        console.error('[AUTO_SYNC_ERROR]', message)
      })
    }
  }, [isOnline, isSyncing, syncQueue])

  const clearQueue = useCallback(async () => {
    await reportQueueService.clear()
    setQueue([])
  }, [])

  const removeReport = useCallback(async (id: string) => {
    await reportQueueService.delete(id)
    setQueue((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const hasPendingReports = queue.some((r) => r.status === 'pending' || r.status === 'syncing')
  const failedReports = queue.filter((r) => r.status === 'failed')

  return {
    queue,
    queueSize: queue.length,
    isSyncing,
    loadError,
    enqueueReport,
    syncQueue,
    clearQueue,
    removeReport,
    hasPendingReports,
    failedReports,
  }
}
