/**
 * QueueIndicator Component
 *
 * Shows offline queue status and pending report count.
 * Displays as a banner or icon based on context.
 */

import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react'
import { useReportQueue } from '../hooks/useReportQueue'

export interface QueueIndicatorProps {
  variant?: 'banner' | 'icon'
  onSyncNow?: () => void
}

export function QueueIndicator({ variant = 'banner', onSyncNow }: QueueIndicatorProps) {
  const { queueSize, isSyncing, hasPendingReports, syncQueue } = useReportQueue()

  const handleSyncNow = async () => {
    await syncQueue()
    onSyncNow?.()
  }

  if (queueSize === 0 && !isSyncing) {
    return null
  }

  if (variant === 'icon') {
    return (
      <div className="relative" data-testid="queue-indicator-icon">
        {(hasPendingReports || isSyncing) && (
          <div
            className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
            data-testid="queue-count"
          >
            {queueSize}
          </div>
        )}
        {isSyncing ? (
          <RefreshCw className="w-5 h-5 text-primary-blue animate-spin" data-testid="syncing-spinner" />
        ) : (
          <WifiOff className="w-5 h-5 text-gray-600" data-testid="offline-icon" />
        )}
      </div>
    )
  }

  // Banner variant
  return (
    <div
      className="bg-orange-50 border-b border-orange-200 px-4 py-3"
      data-testid="queue-indicator-banner"
    >
      <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          {isSyncing ? (
            <RefreshCw className="w-5 h-5 text-orange-600 animate-spin" data-testid="syncing-spinner" />
          ) : (
            <WifiOff className="w-5 h-5 text-orange-600" data-testid="offline-icon" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-900">
              {isSyncing ? 'Syncing reports...' : `Waiting for connection`}
            </p>
            <p className="text-xs text-orange-700">
              {queueSize} {queueSize === 1 ? 'report' : 'reports'} pending
            </p>
          </div>
        </div>

        {!isSyncing && queueSize > 0 && (
          <button
            onClick={handleSyncNow}
            className="px-3 py-1.5 text-sm font-medium text-orange-900 bg-orange-200 hover:bg-orange-300 rounded-lg transition-colors"
            data-testid="sync-now-button"
          >
            Sync Now
          </button>
        )}
      </div>
    </div>
  )
}
