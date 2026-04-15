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
import { submitCitizenReport } from '../services/reportSubmission.service'

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
  syncError: string | null

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
type SyncFn = () => Promise<{ success: number; failed: number }>

export function useReportQueue(): UseReportQueueResult {
  const { isOnline } = useNetworkStatus()
  const [queue, setQueue] = useState<QueuedReport[]>([])
  const queueRef = useRef(queue)
  const [isSyncing, setIsSyncing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  // Guards against concurrent sync calls.
  const syncInProgressRef = useRef(false)
  // Holds the latest syncQueue function. Updated via useEffect after each syncQueue
  // recreation so the auto-sync effect always calls the current function.
  const syncFnRef = useRef<SyncFn>(() => Promise.resolve({ success: 0, failed: 0 }))

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

  const syncQueue = useCallback(async (): Promise<{ success: number; failed: number }> => {
    if (!isOnline || syncInProgressRef.current) {
      return { success: 0, failed: 0 }
    }
    syncInProgressRef.current = true

    // Defensive: Throw if queue service is unavailable (infrastructure failure)
    // This allows the auto-sync .catch() to be tested and handles edge cases
    if (!reportQueueService || typeof reportQueueService.update !== 'function') {
      syncInProgressRef.current = false
      throw new Error('Queue service unavailable')
    }

    setIsSyncing(true)
    setSyncError(null)

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

    try {
      for (const report of readyToSync) {
        try {
          // Update status to syncing
          const syncingReport = { ...report, status: 'syncing' as const }
          await reportQueueService.update(syncingReport)
          setQueue((prev) => prev.map((r) => (r.id === report.id ? syncingReport : r)))

          // Delegate to shared submission service (handles photo upload + three-tier persistence)
          // Queued reports are always anonymous — citizens submit without identity
          await submitCitizenReport({ ...report.reportData, isAnonymous: true })

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
          // Update queue state BEFORE the potentially-failing update call.
          // This ensures the queue is drained even if the update fails (infra error),
          // preventing the auto-sync effect from re-triggering on the same item.
          setQueue((prev) => prev.map((r) => (r.id === report.id ? failedReport : r)))
          // Note: If this update fails, syncQueue will reject and be caught by
          // the auto-sync .catch() handler, logging [AUTO_SYNC_ERROR]
          await reportQueueService.update(failedReport)
          failedCount++
        }
      }
      return { success: successCount, failed: failedCount }
    } finally {
      setIsSyncing(false)
      syncInProgressRef.current = false
    }
  }, [isOnline, queue])

  // Keep syncFnRef.current in sync with syncQueue whenever it is recreated.
  // This effect runs AFTER the render, so syncInProgressRef is already true
  // by the time the new syncQueue executes — preventing the infinite loop
  // that would occur if this assignment were in the render body.
  useEffect(() => {
    syncFnRef.current = syncQueue
  }, [syncQueue])

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
        setSyncError(null)
        syncFnRef.current().catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Immediate sync failed'
          console.error('[IMMEDIATE_SYNC_ERROR]', message)
          setSyncError(message)
        })
      }
    },
    [isOnline]
  )

  // Auto-sync when coming online or queue becomes non-empty.
  // syncFnRef.current is kept in sync via the [syncQueue] useEffect above.
  useEffect(() => {
    if (isOnline && queueRef.current.length > 0) {
      syncFnRef.current().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Auto-sync failed'
        console.error('[AUTO_SYNC_ERROR]', message)
        setSyncError(message)
      })
    }
  }, [isOnline, queue])

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
    syncError,
    enqueueReport,
    syncQueue,
    clearQueue,
    removeReport,
    hasPendingReports,
    failedReports,
  }
}
